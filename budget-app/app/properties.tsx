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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '../utils/apiClient';
import GradientBackground from '@/components/GradientBackground';
import { ErrorState } from '@/components/ErrorState';
import { colors, spacing, glassEffects, typography, gradients } from '@/utils/design-system';

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

export default function PropertiesScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
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

  const timeAgo = (dateStr?: string | null) => {
    if (!dateStr) return '';
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.navigate('/(tabs)/goals' as any)} style={styles.iconButton}>
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Properties</Text>
            <TouchableOpacity
              onPress={() => {
                resetForm();
                setShowForm(true);
              }}
            >
              <Ionicons name="add-circle" size={28} color={colors.primary2} />
            </TouchableOpacity>
          </View>

          {/* Error state */}
          {error && (
            <ErrorState
              title="Error"
              message={error}
              onRetry={loadData}
              onDismiss={() => setError(null)}
            />
          )}

          {/* Summary card */}
          {!error && properties.length > 0 && (
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <View>
                  <Text style={styles.summaryLabel}>Total Value</Text>
                  <Text style={styles.summaryValue}>{fmt(totalValue)}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.summaryLabel}>Total Equity</Text>
                  <Text style={[styles.summaryValue, { color: colors.primary2 }]}>{fmt(totalEquity)}</Text>
                </View>
              </View>
            </View>
          )}

          {!error && loading ? (
            <ActivityIndicator color={colors.primary2} style={{ marginTop: 40 }} />
          ) : !error && properties.length === 0 && !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="home-outline" size={48} color={colors.textDark} />
              <Text style={styles.emptyText}>No properties tracked yet</Text>
              <Text style={styles.emptySubtext}>Tap + to add your first property</Text>
            </View>
          ) : !error ? (
            properties.map((p) => {
              const val = effectiveValue(p);
              const mortgage = p.debt_balance || 0;
              const equity = val - mortgage;
              const isZestimate = !p.manual_value && p.zestimate;

              return (
                <TouchableOpacity key={p.id} style={styles.card} onPress={() => openEdit(p)}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                      <View style={styles.homeIcon}>
                        <Ionicons name="home" size={18} color={colors.primary2} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle} numberOfLines={1}>{p.street_address}</Text>
                        <Text style={styles.cardAddress}>{p.city}, {p.state} {p.zip_code}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.valueSection}>
                    <View style={styles.valueRow}>
                      <Text style={styles.valueLabel}>Value</Text>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.valueAmount}>{fmt(val)}</Text>
                        {isZestimate && (
                          <Text style={styles.valueSource}>Zestimate {timeAgo(p.last_fetched_at) ? `· ${timeAgo(p.last_fetched_at)}` : ''}</Text>
                        )}
                        {p.manual_value != null && p.manual_value > 0 && (
                          <Text style={styles.valueSource}>Manual</Text>
                        )}
                      </View>
                    </View>

                    {p.debt_name && (
                      <View style={styles.valueRow}>
                        <Text style={styles.valueLabel}>Mortgage ({p.debt_name})</Text>
                        <Text style={[styles.valueAmount, { color: colors.error }]}>-{fmt(mortgage)}</Text>
                      </View>
                    )}

                    {p.debt_name && (
                      <>
                        <View style={styles.equityDivider} />
                        <View style={styles.valueRow}>
                          <Text style={styles.equityLabel}>Equity</Text>
                          <Text style={[styles.equityValue, { color: equity >= 0 ? colors.success : colors.error }]}>
                            {equity < 0 ? '-' : ''}{fmt(Math.abs(equity))}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.refreshBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleRefresh(p);
                      }}
                      disabled={refreshingId === p.id}
                    >
                      {refreshingId === p.id ? (
                        <ActivityIndicator size="small" color={colors.primary2} />
                      ) : (
                        <>
                          <Ionicons name="refresh-outline" size={14} color={colors.primary2} />
                          <Text style={styles.refreshBtnText}>Refresh</Text>
                        </>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        handleDelete(p);
                      }}
                    >
                      <Ionicons name="trash-outline" size={14} color={colors.error} />
                      <Text style={styles.deleteBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : null}
        </ScrollView>

        {/* Add/Edit Modal */}
        <Modal visible={showForm} animationType="slide" transparent>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <ScrollView>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {editing ? 'Edit Property' : 'Add Property'}
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
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
                />

                <Text style={styles.label}>City</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Brooklyn"
                  placeholderTextColor={colors.textMuted}
                  value={city}
                  onChangeText={setCity}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
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
                />

                <Text style={styles.label}>Link Mortgage</Text>
                <View style={styles.mortgagePicker}>
                  <TouchableOpacity
                    style={[styles.mortgageOption, !debtAccountId && styles.mortgageOptionActive]}
                    onPress={() => setDebtAccountId(null)}
                  >
                    <Text style={[styles.mortgageText, !debtAccountId && styles.mortgageTextActive]}>None</Text>
                  </TouchableOpacity>
                  {debts.map((d) => (
                    <TouchableOpacity
                      key={d.id}
                      style={[styles.mortgageOption, debtAccountId === d.id && styles.mortgageOptionActive]}
                      onPress={() => setDebtAccountId(d.id)}
                    >
                      <Text style={[styles.mortgageText, debtAccountId === d.id && styles.mortgageTextActive]} numberOfLines={1}>
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
                    trackColor={{ false: colors.glassLight, true: 'rgba(168,85,247,0.4)' }}
                    thumbColor={isShared ? colors.accent : colors.textDark}
                  />
                </View>

                {!editing && (
                  <View style={styles.infoCard}>
                    <Ionicons name="information-circle-outline" size={16} color={colors.primary2} />
                    <Text style={styles.infoText}>
                      We'll automatically look up the Zestimate from Zillow when you save.
                    </Text>
                  </View>
                )}

                <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
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
          </View>
        </Modal>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: 120,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glassLight,
  },
  summaryCard: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryLabel: {
    color: colors.textMuted,
    ...typography.caption,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  card: {
    ...glassEffects.glass,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  homeIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(167,139,250,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  cardAddress: {
    color: colors.textMuted,
    ...typography.caption,
    marginTop: 2,
  },
  valueSection: { marginTop: spacing.md },
  valueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  valueLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  valueAmount: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 15,
  },
  valueSource: {
    color: colors.textDark,
    fontSize: 11,
    marginTop: 1,
  },
  equityDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
    marginVertical: 6,
  },
  equityLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 13,
  },
  equityValue: {
    fontWeight: '800',
    fontSize: 16,
  },
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  refreshBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderRadius: 10,
  },
  refreshBtnText: {
    color: colors.primary2,
    fontWeight: '700',
    fontSize: 13,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderRadius: 10,
  },
  deleteBtnText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: 13,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 60,
    gap: spacing.sm,
  },
  emptyText: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 16,
  },
  emptySubtext: {
    color: colors.textMuted,
    fontSize: 13,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
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
    fontSize: 18,
    fontWeight: '800',
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.glassLight,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    fontSize: 15,
  },
  mortgagePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  mortgageOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: colors.glassLight,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    maxWidth: '100%',
  },
  mortgageOptionActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.7)',
  },
  mortgageText: {
    color: colors.text,
    fontSize: 13,
  },
  mortgageTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  sharedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(96,165,250,0.06)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.15)',
  },
  sharedLabel: {
    color: colors.text,
    fontWeight: '700',
    fontSize: 14,
  },
  sharedDesc: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: 'rgba(167,139,250,0.08)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.15)',
  },
  infoText: {
    color: colors.textMuted,
    ...typography.caption,
    flex: 1,
  },
  saveBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 20,
    marginBottom: 20,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  saveBtnText: {
    color: colors.text,
    fontWeight: '800',
    fontSize: 16,
  },
});
