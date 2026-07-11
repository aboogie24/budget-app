import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';
import { BackButton } from '@/components/BackButton';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import {
  colors,
  spacing,
  radius,
  typography,
  glassEffects,
  gradients,
} from '@/utils/design-system';

type SharingPrefs = {
  shareBudgets: boolean;
  shareTransactions: boolean;
  shareDebts: boolean;
  shareSavings: boolean;
  sharePriorities: boolean;
  shareNotes: boolean;
  notifyPartner: boolean;
};

type Member = { user_id: string; full_name?: string; role?: string };

const PREFS_KEY = 'coupleflowSharingPrefs';

const defaultPrefs: SharingPrefs = {
  shareBudgets: true,
  shareTransactions: true,
  shareDebts: true,
  shareSavings: true,
  sharePriorities: true,
  shareNotes: true,
  notifyPartner: true,
};

// ─── Master summary + toggle-all row ───
function SharingMasterRow({
  allOn,
  partnerName,
  onToggleAll,
}: {
  allOn: boolean;
  partnerName?: string;
  onToggleAll: (on: boolean) => void;
}) {
  const who = partnerName || 'Your partner';
  return (
    <View style={styles.masterCard}>
      <View style={styles.masterLeft}>
        <View style={styles.chip}>
          <Ionicons
            name={allOn ? 'people-circle-outline' : 'options-outline'}
            size={18}
            color={colors.primary2}
          />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {allOn ? 'Sharing everything' : 'Custom sharing'}
          </Text>
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {allOn ? `${who} sees all shared categories` : "You've hidden some categories"}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={() => onToggleAll(!allOn)}
        activeOpacity={0.7}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={allOn ? 'Turn off all sharing' : 'Turn on all sharing'}
        style={[styles.masterBtn, allOn ? styles.masterBtnOff : styles.masterBtnOn]}
      >
        <Text
          style={[
            styles.masterBtnText,
            { color: allOn ? colors.textMuted : colors.primary2 },
          ]}
        >
          {allOn ? 'Turn off' : 'Turn all on'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── A single data/activity toggle row (SettingsRow switch variant + status word) ───
function SharingToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  onLabel = 'Shared',
  offLabel = 'Private',
  showDivider,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  onLabel?: string;
  offLabel?: string;
  showDivider?: boolean;
}) {
  const a11yLabel = [title, subtitle, value ? onLabel : offLabel].filter(Boolean).join(', ');
  return (
    <TouchableOpacity
      style={[styles.row, showDivider && styles.rowDivider]}
      activeOpacity={0.7}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={a11yLabel}
    >
      <View style={styles.rowLeft}>
        <View style={styles.chip}>
          <Ionicons name={icon} size={18} color={colors.primary2} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.rowTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.rowSubtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[
            styles.statusLabel,
            { color: value ? colors.success : colors.textMuted },
          ]}
          numberOfLines={1}
        >
          {`${value ? '●' : '○'} ${value ? onLabel : offLabel}`}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          thumbColor={colors.text}
          trackColor={{ true: colors.primary2, false: colors.glassMedium }}
        />
      </View>
    </TouchableOpacity>
  );
}

// ─── Partner context card ───
function SharingPartnerCard({
  loading,
  partnerName,
  partnerInitial,
  householdName,
  memberCount,
}: {
  loading?: boolean;
  partnerName?: string;
  partnerInitial?: string;
  householdName?: string;
  memberCount?: number;
}) {
  if (loading) {
    return (
      <View style={styles.partnerCard}>
        <Skeleton width={40} height={40} borderRadius={radius.full} />
        <View style={{ flex: 1, gap: spacing.sm }}>
          <Skeleton width="60%" height={12} />
          <Skeleton width="40%" height={10} />
        </View>
      </View>
    );
  }

  const subtitleParts: string[] = [];
  if (householdName) subtitleParts.push(householdName);
  if (typeof memberCount === 'number') subtitleParts.push(`${memberCount} members`);

  return (
    <View style={styles.partnerCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{partnerInitial || 'P'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {`Sharing with ${partnerName || 'your partner'}`}
        </Text>
        {subtitleParts.length > 0 ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitleParts.join(' · ')}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function SharingPreferencesScreen() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<SharingPrefs>(defaultPrefs);
  const [householdId, setHouseholdId] = useState<string | undefined>(undefined);
  const [householdName, setHouseholdName] = useState<string | undefined>(undefined);
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [savedOk, setSavedOk] = useState(false);

  const toastOpacity = useRef(new Animated.Value(0)).current;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        setLoadError(true);
        return;
      }
      setCurrentUserId(String(user.id));

      // Resolve household + members first.
      let hhId: string | undefined;
      try {
        const hh = await api.get<any>(`/auth/households/me`, { user_id: user.id });
        if (hh?.household_id) {
          hhId = String(hh.household_id);
          setHouseholdId(hhId);
        }
        if (hh?.household_name) setHouseholdName(String(hh.household_name));
        let mem = hh?.members;
        if (typeof mem === 'string') {
          try {
            mem = JSON.parse(mem);
          } catch {
            mem = [];
          }
        }
        if (Array.isArray(mem)) setMembers(mem as Member[]);
      } catch (e) {
        console.error('Failed to load household:', e);
      }

      // Fetch server prefs.
      const params: Record<string, string | number> = { user_id: user.id };
      if (hhId) params.household_id = hhId;
      const serverPrefs = await api.get<any>(`/auth/sharing-preferences`, params);
      const mapped: SharingPrefs = {
        shareBudgets: serverPrefs.share_budgets ?? true,
        shareTransactions: serverPrefs.share_transactions ?? true,
        shareDebts: serverPrefs.share_debts ?? true,
        shareSavings: serverPrefs.share_savings ?? true,
        sharePriorities: serverPrefs.share_priorities ?? true,
        shareNotes: serverPrefs.share_notes ?? true,
        notifyPartner: serverPrefs.notify_partner ?? true,
      };
      setPrefs(mapped);
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(mapped));
    } catch (e) {
      console.error('Failed to load sharing preferences:', e);
      // Try local cache before declaring failure.
      try {
        const stored = await AsyncStorage.getItem(PREFS_KEY);
        if (stored) {
          setPrefs({ ...defaultPrefs, ...JSON.parse(stored) });
        } else {
          setLoadError(true);
        }
      } catch {
        setLoadError(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flashToast = useCallback(
    (onDone?: () => void) => {
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }).start(() => {
        setTimeout(() => {
          Animated.timing(toastOpacity, {
            toValue: 0,
            duration: 180,
            useNativeDriver: true,
          }).start(() => onDone?.());
        }, 900);
      });
    },
    [toastOpacity],
  );

  const savePrefs = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      const user = await getCurrentUser();
      if (!user?.id) {
        setSaveError(true);
        return;
      }

      const payload = {
        user_id: user.id,
        household_id: householdId,
        share_budgets: prefs.shareBudgets,
        share_transactions: prefs.shareTransactions,
        share_debts: prefs.shareDebts,
        share_savings: prefs.shareSavings,
        share_priorities: prefs.sharePriorities,
        share_notes: prefs.shareNotes,
        notify_partner: prefs.notifyPartner,
      };

      await api.post(`/auth/sharing-preferences`, payload);
      await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
      setSavedOk(true);
      flashToast(() => router.back());
    } catch (e) {
      console.error('Failed to save sharing preferences:', e);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const allOn = Object.values(prefs).every(Boolean);

  const toggleAll = (on: boolean) => {
    setSaveError(false);
    setPrefs({
      shareBudgets: on,
      shareTransactions: on,
      shareDebts: on,
      shareSavings: on,
      sharePriorities: on,
      shareNotes: on,
      notifyPartner: on,
    });
  };

  const updatePref = (key: keyof SharingPrefs) => (v: boolean) => {
    setSaveError(false);
    setPrefs((p) => ({ ...p, [key]: v }));
  };

  // Partner = a member who isn't the current user.
  const partner = members.find(
    (m) => currentUserId && String(m.user_id) !== String(currentUserId),
  );
  const partnerName = (partner?.full_name || '').split(' ')[0] || undefined;
  const partnerInitial = (partner?.full_name || 'P').charAt(0).toUpperCase();
  const hasPartner = members.length >= 2;

  const Header = (
    <View style={styles.topBar}>
      <BackButton fallback="/(tabs)/settings" color={colors.primary2} size={20} />
      <Text style={styles.headerText}>Sharing Preferences</Text>
      <View style={{ width: 40 }} />
    </View>
  );

  // ── Loading ──
  if (loading) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <SharingPartnerCard loading />
            <View style={styles.masterCard}>
              <View style={styles.masterLeft}>
                <Skeleton width={34} height={34} borderRadius={radius.md} />
                <Skeleton width="55%" height={12} />
              </View>
              <Skeleton width={64} height={26} borderRadius={radius.full} />
            </View>
            <Text style={styles.sectionLabel}>WHAT TO SHARE</Text>
            <View style={styles.card}>
              {Array.from({ length: 6 }).map((_, i) => (
                <View key={i} style={[styles.row, i > 0 && styles.rowDivider]}>
                  <View style={styles.rowLeft}>
                    <Skeleton width={34} height={34} borderRadius={radius.md} />
                    <View style={{ flex: 1, gap: spacing.sm }}>
                      <Skeleton width="60%" height={12} />
                      <Skeleton width="40%" height={10} />
                    </View>
                  </View>
                  <Skeleton width={44} height={26} borderRadius={radius.full} />
                </View>
              ))}
            </View>
            <Text style={styles.sectionLabel}>ACTIVITY</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <View style={styles.rowLeft}>
                  <Skeleton width={34} height={34} borderRadius={radius.md} />
                  <View style={{ flex: 1, gap: spacing.sm }}>
                    <Skeleton width="60%" height={12} />
                    <Skeleton width="40%" height={10} />
                  </View>
                </View>
                <Skeleton width={44} height={26} borderRadius={radius.full} />
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Load error ──
  if (loadError) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <View style={styles.centered}>
            <View style={styles.stateCard}>
              <Ionicons name="alert-circle-outline" size={44} color={colors.error} />
              <Text style={styles.stateTitle}>Couldn't load your sharing settings</Text>
              <Text style={styles.stateBody}>
                We didn't want to show the wrong toggles.
              </Text>
              <TouchableOpacity
                onPress={load}
                activeOpacity={0.7}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                accessibilityRole="button"
                accessibilityLabel="Retry loading sharing settings"
                style={styles.retryBtn}
              >
                <Ionicons name="refresh" size={16} color={colors.primary2} />
                <Text style={styles.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Empty (no partner) ──
  if (!hasPartner) {
    return (
      <GradientBackground variant="bgDarkPurple">
        <SafeAreaView style={{ flex: 1 }}>
          {Header}
          <View style={styles.centered}>
            <View style={styles.stateCard}>
              <View style={styles.emptyIcon}>
                <Ionicons name="people-outline" size={30} color={colors.textDark} />
              </View>
              <Text style={styles.stateTitle}>No partner to share with yet</Text>
              <Text style={styles.stateBody}>
                Invite your partner to a household and you can choose exactly what they
                see here.
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/household-setup')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Invite a partner"
                style={styles.ctaWrap}
              >
                <LinearGradient
                  colors={[...gradients.primaryGradient]}
                  style={styles.ctaInner}
                >
                  <Text style={styles.ctaText}>Invite a partner</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </GradientBackground>
    );
  }

  // ── Default / populated ──
  return (
    <GradientBackground variant="bgDarkPurple">
      <SafeAreaView style={{ flex: 1 }}>
        {Header}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <SharingPartnerCard
            partnerName={partnerName}
            partnerInitial={partnerInitial}
            householdName={householdName}
            memberCount={members.length}
          />

          <SharingMasterRow allOn={allOn} partnerName={partnerName} onToggleAll={toggleAll} />

          <Text style={styles.sectionLabel}>WHAT TO SHARE</Text>
          <View style={styles.card}>
            <SharingToggleRow
              icon="wallet-outline"
              title="Budgets"
              subtitle="Allow partner to view shared budgets"
              value={prefs.shareBudgets}
              onChange={updatePref('shareBudgets')}
            />
            <SharingToggleRow
              icon="swap-horizontal-outline"
              title="Transactions"
              subtitle="Show spending & income activity"
              value={prefs.shareTransactions}
              onChange={updatePref('shareTransactions')}
              showDivider
            />
            <SharingToggleRow
              icon="card-outline"
              title="Debts"
              subtitle="Loans, credit cards, payoff progress"
              value={prefs.shareDebts}
              onChange={updatePref('shareDebts')}
              showDivider
            />
            <SharingToggleRow
              icon="trending-up-outline"
              title="Savings"
              subtitle="Goals, balances, contributions"
              value={prefs.shareSavings}
              onChange={updatePref('shareSavings')}
              showDivider
            />
            <SharingToggleRow
              icon="flag-outline"
              title="Priorities"
              subtitle="Roadmap items and rankings"
              value={prefs.sharePriorities}
              onChange={updatePref('sharePriorities')}
              showDivider
            />
            <SharingToggleRow
              icon="pricetag-outline"
              title="Notes & Categories"
              subtitle="Include labels and notes with shared items"
              value={prefs.shareNotes}
              onChange={updatePref('shareNotes')}
              showDivider
            />
          </View>

          <Text style={styles.sectionLabel}>ACTIVITY</Text>
          <View style={styles.card}>
            <SharingToggleRow
              icon="notifications-outline"
              title="Notify Partner"
              subtitle="When I update budgets, debts, savings, or priorities"
              value={prefs.notifyPartner}
              onChange={updatePref('notifyPartner')}
              onLabel="On"
              offLabel="Off"
            />
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          {savedOk ? (
            <Animated.View style={[styles.toast, { opacity: toastOpacity }]}>
              <Ionicons name="checkmark-circle" size={16} color={colors.success} />
              <Text style={[styles.toastText, { color: colors.success }]}>Saved</Text>
            </Animated.View>
          ) : null}

          {saveError ? (
            <TouchableOpacity
              onPress={savePrefs}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Couldn't save, tap to retry"
              style={styles.saveErrorToast}
            >
              <Ionicons name="alert-circle" size={16} color={colors.error} />
              <Text style={[styles.toastText, { color: colors.error }]}>
                Couldn't save — tap to retry
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={savePrefs}
            disabled={saving}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Save Preferences"
            accessibilityState={{ disabled: saving }}
          >
            <LinearGradient
              colors={[...gradients.primaryGradient]}
              style={[styles.saveBtnInner, saving && { opacity: 0.7 }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color={colors.text} />
              ) : (
                <Ionicons name="checkmark" size={18} color={colors.text} />
              )}
              <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Preferences'}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  topBar: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerText: {
    ...typography.bodyBold,
    color: colors.text,
  },

  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Partner card
  partnerCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.info,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...typography.smallBold,
    color: colors.text,
  },

  // Master row
  masterCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  masterLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  masterBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    flexShrink: 0,
  },
  masterBtnOff: {
    backgroundColor: colors.glassMedium,
    borderColor: colors.borderLight,
  },
  masterBtnOn: {
    backgroundColor: `${colors.primary2}26`,
    borderColor: `${colors.primary2}40`,
  },
  masterBtnText: {
    ...typography.caption,
    fontWeight: '700',
  },

  // Section label
  sectionLabel: {
    ...typography.caption,
    color: colors.textMuted,
    letterSpacing: 1.2,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },

  // Grouped card
  card: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },

  // Rows
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
    justifyContent: 'flex-end',
  },
  chip: {
    width: 34,
    height: 34,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary2}1a`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  rowTitle: {
    ...typography.smallBold,
    color: colors.text,
  },
  rowSubtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 1,
  },
  statusLabel: {
    ...typography.caption,
    fontWeight: '600',
    flexShrink: 0,
  },

  // Centered states (empty / error)
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  stateCard: {
    ...glassEffects.glass,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    gap: spacing.md,
  },
  stateTitle: {
    ...typography.bodyBold,
    color: colors.text,
    textAlign: 'center',
  },
  stateBody: {
    ...typography.small,
    color: colors.textMuted,
    textAlign: 'center',
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.sm,
  },
  retryText: {
    ...typography.smallBold,
    color: colors.primary2,
  },
  ctaWrap: {
    width: '100%',
    marginTop: spacing.sm,
  },
  ctaInner: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    ...typography.button,
    color: colors.text,
  },

  // Footer
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  saveBtnInner: {
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveText: {
    ...typography.button,
    color: colors.text,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  saveErrorToast: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  toastText: {
    ...typography.caption,
    fontWeight: '600',
  },
});
