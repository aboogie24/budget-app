import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  ActivityIndicator,
  Switch,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { ErrorState } from '@/components/ErrorState';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  glassEffects,
  typography,
  gradients,
  commonStyles,
  getValueColor,
} from '@/utils/design-system';
import { BackButton } from '@/components/BackButton';

type Property = {
  id: string;
  user_id: string;
  household_id?: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  zestimate?: number | null;
  manual_value?: number | null;
  zillow_url?: string;
  zpid?: string;
  debt_account_id?: string | null;
  last_fetched_at?: string | null;
  is_shared: boolean;
  debt_name?: string;
  debt_balance?: number;
};

type Debt = {
  id: string;
  name: string;
  balance: number;
};

// Tinted chip fills derived from tokens (≈12% / ≈16% / ≈8%).
const tint = {
  primary12: `${colors.primary2}1f`,
  primary16: `${colors.primary2}29`,
  primary8: `${colors.primary2}14`,
  primary70: `${colors.primary2}b3`,
  primary40: `${colors.primary2}66`,
  primary29: `${colors.primary2}29`,
  error12: `${colors.error}1f`,
  error66: `${colors.error}66`,
  info12: `${colors.info}1f`,
  info8: `${colors.info}14`,
  info29: `${colors.info}29`,
};

export default function PropertiesScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [streetAddress, setStreetAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [manualValue, setManualValue] = useState('');
  const [debtAccountId, setDebtAccountId] = useState<string | null>(null);
  const [isShared, setIsShared] = useState(true);

  const loadData = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      const userId = await api.getUserId();
      if (!userId) return;
      const [propsData, debtsData] = await Promise.all([
        api.get<Property[]>('/auth/properties', { user_id: userId }),
        api.get<Debt[]>('/auth/debts', { user_id: userId }),
      ]);
      setProperties(Array.isArray(propsData) ? propsData : []);
      setDebts(Array.isArray(debtsData) ? debtsData : []);
    } catch (e) {
      console.error('Failed to load properties:', e);
      setError('Failed to load properties');
    } finally {
      setLoading(false);
      setLoadedOnce(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resetForm = () => {
    setStreetAddress('');
    setCity('');
    setState('');
    setZipCode('');
    setManualValue('');
    setDebtAccountId(null);
    setIsShared(true);
    setEditing(null);
  };

  const openEdit = (p: Property) => {
    setEditing(p);
    setStreetAddress(p.street_address);
    setCity(p.city);
    setState(p.state);
    setZipCode(p.zip_code);
    setManualValue(p.manual_value != null ? String(p.manual_value) : '');
    setDebtAccountId(p.debt_account_id || null);
    setIsShared(p.is_shared);
    setShowForm(true);
  };

  const openAdd = () => {
    resetForm();
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!streetAddress.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      Alert.alert('Validation', 'Address, city, state, and zip are required.');
      return;
    }

    const userId = await api.getUserId();
    if (!userId) {
      Alert.alert('Error', 'No user session found.');
      return;
    }

    const payload = {
      user_id: userId,
      street_address: streetAddress.trim(),
      city: city.trim(),
      state: state.trim().toUpperCase(),
      zip_code: zipCode.trim(),
      manual_value: manualValue ? parseFloat(manualValue) : null,
      debt_account_id: debtAccountId || null,
      is_shared: isShared,
    };

    try {
      if (editing) {
        await api.put(`/auth/properties/${editing.id}?user_id=${userId}`, payload);
      } else {
        await api.post('/auth/properties', payload);
      }
      setShowForm(false);
      resetForm();
      loadData();
    } catch (e) {
      console.error('Save property error:', e);
      Alert.alert('Error', 'Failed to save property.');
    }
  };

  const handleDelete = (p: Property) => {
    Alert.alert('Delete Property', `Remove "${p.street_address}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const userId = await api.getUserId();
            await api.delete(`/auth/properties/${p.id}?user_id=${userId}`);
            loadData();
          } catch (e) {
            console.error('Delete error:', e);
            Alert.alert('Error', 'Failed to delete property.');
          }
        },
      },
    ]);
  };

  const handleRefresh = async (p: Property) => {
    setRefreshingId(p.id);
    try {
      const userId = await api.getUserId();
      await api.post(`/auth/properties/${p.id}/refresh?user_id=${userId}`, undefined);
      loadData();
    } catch (e: any) {
      const msg = e?.message || 'Failed to refresh value.';
      Alert.alert('Refresh Failed', msg);
    } finally {
      setRefreshingId(null);
    }
  };

  const fmt = (v: number) =>
    v.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 });

  const effectiveValue = (p: Property) => p.manual_value || p.zestimate || 0;
  const totalValue = properties.reduce((sum, p) => sum + effectiveValue(p), 0);
  const totalEquity = properties.reduce((sum, p) => {
    const val = effectiveValue(p);
    const mortgage = p.debt_balance || 0;
    return sum + (val - mortgage);
  }, 0);
  const equityPercent = totalValue > 0 ? Math.round((totalEquity / totalValue) * 100) : null;
  const mortgageTotal = Math.max(0, totalValue - totalEquity);
  // Equity share of value (0..1) for the ownership bar; guard divide-by-zero.
  const equityShare =
    totalValue > 0 ? Math.max(0, Math.min(1, totalEquity / totalValue)) : 1;

  const timeAgo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const showSkeleton = loading && !loadedOnce;

  // ── Portfolio headline (the ONE floating block) ──
  const renderHeadline = () => {
    if (properties.length === 0) return null;
    const equityLabel =
      equityPercent != null
        ? `Total equity ${fmt(totalEquity)}, ${equityPercent} percent owned`
        : `Total equity ${fmt(totalEquity)}`;
    return (
      <View
        style={styles.headline}
        accessible
        accessibilityLabel={`Portfolio: ${properties.length} ${
          properties.length === 1 ? 'home' : 'homes'
        }. Total value ${fmt(totalValue)}. ${equityLabel}.`}
      >
        <View style={styles.headlineLabelRow}>
          <Text style={styles.sectionLabel}>Portfolio</Text>
          <View style={styles.countPill}>
            <Text style={styles.countPillText}>
              {properties.length} {properties.length === 1 ? 'home' : 'homes'}
            </Text>
          </View>
        </View>

        <View style={styles.headlineValues}>
          <View style={styles.headlineCol}>
            <Text style={styles.valueColLabel}>Total value</Text>
            <Text style={styles.heroValue}>{fmt(totalValue)}</Text>
          </View>
          <View style={[styles.headlineCol, { alignItems: 'flex-end' }]}>
            <Text style={styles.valueColLabel}>Total equity</Text>
            <Text style={[styles.heroValue, { color: colors.primary2 }]}>{fmt(totalEquity)}</Text>
            {equityPercent != null && (
              <Text style={styles.equityShareText}>{equityPercent}% owned</Text>
            )}
          </View>
        </View>

        {equityPercent != null && (
          <>
            <View style={styles.ownershipBar}>
              <View
                style={[
                  styles.ownershipEquity,
                  { flex: Math.max(equityShare, 0.001) },
                ]}
              />
              {mortgageTotal > 0 && (
                <View
                  style={[
                    styles.ownershipMortgage,
                    { flex: Math.max(1 - equityShare, 0.001) },
                  ]}
                />
              )}
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendSwatch, { backgroundColor: colors.primary2 }]} />
                <Text style={styles.legendText}>equity</Text>
              </View>
              {mortgageTotal > 0 && (
                <View style={styles.legendItem}>
                  <View style={[styles.legendSwatch, { backgroundColor: tint.error66 }]} />
                  <Text style={styles.legendText}>mortgage</Text>
                </View>
              )}
            </View>
          </>
        )}
      </View>
    );
  };

  // ── Property card (the list row) ──
  const renderPropertyCard = (p: Property) => {
    const val = effectiveValue(p);
    const mortgage = p.debt_balance || 0;
    const hasMortgage = !!p.debt_name;
    const equity = val - mortgage;
    const isZestimate = !p.manual_value && !!p.zestimate;
    const zAge = timeAgo(p.last_fetched_at);

    const a11y =
      `${p.street_address}, ${p.city} ${p.state}. Value ${fmt(val)}, ${
        isZestimate ? 'Zestimate' : 'Manual'
      }.` +
      (hasMortgage ? ` Mortgage ${p.debt_name} ${fmt(mortgage)}.` : '') +
      ` Equity ${equity < 0 ? '-' : ''}${fmt(Math.abs(equity))}.` +
      (p.is_shared ? ' Shared with partner.' : '');

    return (
      <TouchableOpacity
        key={p.id}
        style={styles.card}
        onPress={() => openEdit(p)}
        activeOpacity={0.7}
        accessibilityLabel={a11y}
        accessibilityHint="Double tap to edit."
      >
        {/* Header row */}
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <View style={styles.homeIcon}>
              <Ionicons name="home" size={18} color={colors.primary2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {p.street_address}
              </Text>
              <Text style={styles.cardAddress} numberOfLines={1}>
                {p.city}, {p.state} {p.zip_code}
              </Text>
            </View>
          </View>
          {p.is_shared && (
            <View style={styles.sharedChip}>
              <Ionicons name="contrast-outline" size={11} color={colors.primary2} />
              <Text style={styles.sharedChipText}>Shared</Text>
            </View>
          )}
        </View>

        {/* Value section */}
        <View style={styles.valueSection}>
          <View style={styles.valueRow}>
            <Text style={styles.valueLabel}>Value</Text>
            <View style={styles.valueRight}>
              <Text style={styles.valueAmount}>{fmt(val)}</Text>
              {isZestimate ? (
                <View style={[styles.provChip, { backgroundColor: tint.info12 }]}>
                  <Ionicons
                    name="information-circle-outline"
                    size={12}
                    color={colors.textMuted}
                  />
                  <Text style={styles.provChipText}>
                    Zestimate{zAge ? ` · ${zAge}` : ''}
                  </Text>
                </View>
              ) : (
                <View style={[styles.provChip, { backgroundColor: colors.glassLight }]}>
                  <Ionicons name="create-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.provChipText}>Manual</Text>
                </View>
              )}
            </View>
          </View>

          {hasMortgage && (
            <View style={styles.valueRow}>
              <Text style={styles.valueLabel} numberOfLines={1}>
                Mortgage ({p.debt_name})
              </Text>
              <Text style={[styles.valueAmount, styles.noShrink, { color: colors.error }]}>
                -{fmt(mortgage)}
              </Text>
            </View>
          )}

          {hasMortgage && <View style={commonStyles.divider} />}

          <View style={styles.valueRow}>
            <Text style={styles.equityLabel}>Equity</Text>
            <Text style={[styles.equityValue, styles.noShrink, { color: getValueColor(equity) }]}>
              {equity < 0 ? '-' : ''}
              {fmt(Math.abs(equity))}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            style={[styles.actionPill, { backgroundColor: tint.primary12 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              handleRefresh(p);
            }}
            disabled={refreshingId === p.id}
            accessibilityRole="button"
            accessibilityLabel={`Refresh value for ${p.street_address}`}
          >
            {refreshingId === p.id ? (
              <ActivityIndicator size="small" color={colors.primary2} />
            ) : (
              <>
                <Ionicons name="refresh-outline" size={16} color={colors.primary2} />
                <Text style={[styles.actionText, { color: colors.primary2 }]}>Refresh</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionPill, { backgroundColor: tint.error12 }]}
            onPress={(e) => {
              e.stopPropagation?.();
              handleDelete(p);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${p.street_address}`}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Delete</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <Ionicons name="home-outline" size={48} color={colors.textDark} />
      <Text style={styles.emptyText}>No properties tracked yet</Text>
      <Text style={styles.emptySubtext}>
        Add your first home to track its value and equity
      </Text>
      <TouchableOpacity style={styles.emptyCta} onPress={openAdd} accessibilityRole="button">
        <LinearGradient
          colors={[...gradients.primaryGradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.emptyCtaInner}
        >
          <Text style={styles.emptyCtaText}>Add a property</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderLoadingSkeleton = () => (
    <View style={{ gap: spacing.lg }}>
      <Skeleton height={132} borderRadius={radius.xl} />
      <Skeleton width={120} height={12} borderRadius={radius.sm} />
      <View style={{ gap: spacing.md }}>
        <Skeleton height={168} borderRadius={radius.lg} />
        <Skeleton height={168} borderRadius={radius.lg} />
      </View>
    </View>
  );

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <BackButton fallback="/(tabs)/goals" color={colors.text} />
          <View style={styles.titleWrap}>
            <Text style={styles.headerTitle}>Properties</Text>
          </View>
          <View style={styles.headerRight}>
            {loadedOnce && refreshing && (
              <ActivityIndicator color={colors.primary2} size="small" />
            )}
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={openAdd}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Add property"
            >
              <Ionicons name="add" size={22} color={colors.primary2} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {error ? (
            <ErrorState
              title="Couldn't load your properties"
              message={error}
              retryLabel="Retry"
              onRetry={loadData}
              onDismiss={() => setError(null)}
            />
          ) : showSkeleton ? (
            renderLoadingSkeleton()
          ) : properties.length === 0 ? (
            renderEmpty()
          ) : (
            <>
              {renderHeadline()}
              <Text style={[styles.sectionLabel, styles.listLabel]}>Your properties</Text>
              {properties.map(renderPropertyCard)}
            </>
          )}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <KeyboardAvoidingView
            style={styles.modalBackdrop}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.modalContent}>
              <ScrollView keyboardShouldPersistTaps="handled">
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Property' : 'Add Property'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                  >
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>Street Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="123 Main Street"
                  placeholderTextColor={colors.textMuted}
                  value={streetAddress}
                  onChangeText={setStreetAddress}
                  accessibilityLabel="Street Address"
                />

                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Brooklyn"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                  accessibilityLabel="City"
                />

                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>State</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="NY"
                      placeholderTextColor={colors.textMuted}
                      value={state}
                      onChangeText={setState}
                      maxLength={2}
                      autoCapitalize="characters"
                      accessibilityLabel="State"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.label}>ZIP Code</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="11201"
                      placeholderTextColor={colors.textMuted}
                      value={zipCode}
                      onChangeText={setZipCode}
                      keyboardType="numeric"
                      maxLength={5}
                      accessibilityLabel="ZIP Code"
                    />
                  </View>
                </View>

                <Text style={styles.label}>Manual Value (optional)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Override Zestimate"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="numeric"
                  value={manualValue}
                  onChangeText={setManualValue}
                  accessibilityLabel="Manual Value"
                />

                <Text style={styles.label}>Link Mortgage</Text>
                <View style={styles.mortgagePicker}>
                  <TouchableOpacity
                    style={[styles.mortgageOption, !debtAccountId && styles.mortgageOptionActive]}
                    onPress={() => setDebtAccountId(null)}
                  >
                    <Text style={[styles.mortgageText, !debtAccountId && styles.mortgageTextActive]}>
                      None
                    </Text>
                  </TouchableOpacity>
                  {debts.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[
                        styles.mortgageOption,
                        debtAccountId === d.id && styles.mortgageOptionActive,
                      ]}
                      onPress={() => setDebtAccountId(d.id)}
                    >
                      <Text
                        style={[
                          styles.mortgageText,
                          debtAccountId === d.id && styles.mortgageTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {d.name} ({fmt(d.balance)})
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={styles.sharedToggle}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sharedLabel}>Share with partner</Text>
                    <Text style={styles.sharedDesc}>Visible to your household partner</Text>
                  </View>
                  <Switch
                    value={isShared}
                    onValueChange={setIsShared}
                    trackColor={{ false: colors.glassLight, true: tint.primary40 }}
                    thumbColor={isShared ? colors.accent : colors.textDark}
                    accessibilityLabel={`Share with partner, ${isShared ? 'on' : 'off'}`}
                  />
                </View>

                {!editing && (
                  <View style={styles.infoCard}>
                    <Ionicons
                      name="information-circle-outline"
                      size={16}
                      color={colors.primary2}
                    />
                    <Text style={styles.infoText}>
                      We'll automatically look up the Zestimate from Zillow when you save.
                    </Text>
                  </View>
                )}

                <TouchableOpacity
                  onPress={handleSave}
                  style={styles.saveBtn}
                  accessibilityRole="button"
                >
                  <LinearGradient
                    colors={[...gradients.primaryGradient]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.saveBtnInner}
                  >
                    <Text style={styles.saveBtnText}>{editing ? 'Update' : 'Add Property'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    color: colors.text,
    ...typography.h3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderGlass,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxl + spacing.xxl,
  },

  // ── Section labels ──
  sectionLabel: {
    color: colors.textMuted,
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listLabel: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  // ── Portfolio headline ──
  headline: {
    ...glassEffects.glassFloating,
    padding: spacing.xl,
    borderRadius: radius.xl,
  },
  headlineLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countPill: {
    backgroundColor: colors.glassLight,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  countPillText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  headlineValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
  },
  headlineCol: {
    flex: 1,
  },
  valueColLabel: {
    color: colors.textMuted,
    ...typography.caption,
    marginBottom: spacing.xs,
  },
  heroValue: {
    color: colors.text,
    ...typography.h2,
  },
  equityShareText: {
    color: colors.success,
    ...typography.caption,
    marginTop: spacing.xs,
  },
  ownershipBar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.full,
    overflow: 'hidden',
    marginTop: spacing.lg,
    backgroundColor: colors.glassLight,
  },
  ownershipEquity: {
    backgroundColor: colors.primary2,
  },
  ownershipMortgage: {
    backgroundColor: tint.error66,
  },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  legendText: {
    color: colors.textMuted,
    ...typography.caption,
  },

  // ── Property card ──
  card: {
    ...commonStyles.card,
    borderRadius: radius.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  homeIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: tint.primary12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text,
    ...typography.smallBold,
  },
  cardAddress: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },
  sharedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: tint.primary12,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginLeft: spacing.sm,
  },
  sharedChipText: {
    color: colors.primary2,
    ...typography.caption,
  },
  valueSection: { marginTop: spacing.md },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  valueLabel: {
    color: colors.textMuted,
    ...typography.small,
    flexShrink: 1,
  },
  valueRight: {
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  valueAmount: {
    color: colors.text,
    ...typography.smallBold,
  },
  noShrink: {
    flexShrink: 0,
  },
  provChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  provChipText: {
    color: colors.textMuted,
    ...typography.caption,
  },
  equityLabel: {
    color: colors.text,
    ...typography.smallBold,
  },
  equityValue: {
    ...typography.bodyBold,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    minHeight: 44,
    minWidth: 104,
  },
  actionText: {
    ...typography.smallBold,
  },

  // ── Empty state ──
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.text,
    ...typography.bodyBold,
  },
  emptySubtext: {
    color: colors.textMuted,
    ...typography.small,
    textAlign: 'center',
  },
  emptyCta: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
  },
  emptyCtaInner: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    color: colors.text,
    ...typography.button,
  },

  // ── Modal ──
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  modalTitle: {
    color: colors.text,
    ...typography.h3,
  },
  label: {
    color: colors.text,
    ...typography.smallBold,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.glassLight,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    ...typography.body,
    minHeight: 44,
  },
  mortgagePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  mortgageOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    maxWidth: '100%',
    minHeight: 44,
    justifyContent: 'center',
  },
  mortgageOptionActive: {
    backgroundColor: tint.primary16,
    borderColor: tint.primary70,
  },
  mortgageText: {
    color: colors.text,
    ...typography.small,
  },
  mortgageTextActive: {
    color: colors.text,
    ...typography.smallBold,
  },
  sharedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: tint.info8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: tint.info29,
  },
  sharedLabel: {
    color: colors.text,
    ...typography.smallBold,
  },
  sharedDesc: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: tint.primary8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: tint.primary29,
  },
  infoText: {
    color: colors.textMuted,
    ...typography.caption,
    flex: 1,
  },
  saveBtn: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  saveBtnText: {
    color: colors.text,
    ...typography.button,
  },
});
