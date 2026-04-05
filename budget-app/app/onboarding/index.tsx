import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/utils/apiClient';
import { getCurrentUser } from '@/utils/storage';

// ─── CoupleFlow Method Levels ─────────────────────────────────

const LEVELS = [
  { title: 'Foundation', description: 'Set up budgets & emergency fund', icon: 'home-outline' as const, color: '#a855f7' },
  { title: 'Attack Debt', description: 'Eliminate high-interest debt', icon: 'flame-outline' as const, color: '#ec4899' },
  { title: 'Build Security', description: '3-6 month safety net', icon: 'shield-checkmark-outline' as const, color: '#10b981' },
  { title: 'Grow Wealth', description: 'Invest & build assets', icon: 'trending-up-outline' as const, color: '#a855f7' },
  { title: 'Dream Big', description: 'Plan your dream goals', icon: 'star-outline' as const, color: '#ec4899' },
];

const BANKS = [
  { name: 'Chase', icon: 'business-outline' as const },
  { name: 'Bank of America', icon: 'business-outline' as const },
  { name: 'Wells Fargo', icon: 'business-outline' as const },
  { name: 'Other Bank', icon: 'card-outline' as const },
];

// ─── Component ────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Step 1 state
  const [partnerEmail, setPartnerEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // Step 2 state
  const [selectedBank, setSelectedBank] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [linked, setLinked] = useState(false);

  // Step 3 state
  const [completing, setCompleting] = useState(false);

  // ─── Navigation ─────────────────────────────────────────────

  const animateTransition = (nextStep: number) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();
    setTimeout(() => setCurrentStep(nextStep), 150);
  };

  const goNext = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(Math.min(currentStep + 1, 3));
  };

  const goBack = () => {
    animateTransition(Math.max(currentStep - 1, 0));
  };

  // ─── Step 1: Send Invite ────────────────────────────────────

  const handleSendInvite = async () => {
    if (!partnerEmail.trim()) {
      goNext();
      return;
    }

    setInviteSending(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');

      // Create household if needed, then invite
      let householdId: string | null = null;
      try {
        const hh = await api.get<any>('/auth/households/me');
        householdId = hh?.household_id;
      } catch {}

      if (!householdId) {
        const newHH = await api.post<any>('/auth/households', {
          name: `${user.full_name || 'My'} Household`,
        });
        householdId = newHH?.id;
      }

      if (householdId) {
        await api.post('/auth/households/invite', {
          household_id: householdId,
          invitee_email: partnerEmail.trim(),
        });
      }

      setInviteSent(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => goNext(), 800);
    } catch (err) {
      console.error('Invite error:', err);
      Alert.alert('Invite Error', 'Could not send invite, but you can do this later from Settings.');
      goNext();
    } finally {
      setInviteSending(false);
    }
  };

  // ─── Step 2: Plaid Link ────────────────────────────────────

  const handleLinkAccount = async () => {
    setLinking(true);
    try {
      const { link_token } = await api.get<any>('/auth/link_token');
      if (!link_token) throw new Error('No link token');

      const baseUrl = api.getBaseUrl();
      const url = `${baseUrl}/plaid/link-page?token=${encodeURIComponent(link_token)}`;
      const result = await WebBrowser.openAuthSessionAsync(url, 'budgetapp://');

      if (result.type === 'success') {
        setLinked(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setTimeout(() => goNext(), 500);
      }
    } catch (err) {
      console.error('Plaid link error:', err);
      Alert.alert('Link Error', 'Could not connect your bank. You can try again later from Settings.');
    } finally {
      setLinking(false);
    }
  };

  // ─── Step 3: Complete Onboarding ───────────────────────────

  const handleComplete = async () => {
    setCompleting(true);
    try {
      const user = await getCurrentUser();
      if (!user?.id) throw new Error('No user session');

      await api.post('/auth/onboarding/complete', {
        user_id: user.id,
        monthly_budget_goal: 0,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/(tabs)/dashboard');
    } catch (err) {
      console.error('Complete onboarding error:', err);
      // Still navigate — don't block the user
      router.replace('/(tabs)/dashboard');
    } finally {
      setCompleting(false);
    }
  };

  // ─── Render Steps ──────────────────────────────────────────

  const renderStep0 = () => (
    <View style={styles.stepContent}>
      {/* Overlapping circles */}
      <View style={styles.circlesContainer}>
        <View style={[styles.circle, { backgroundColor: 'rgba(168,85,247,0.3)', left: 0 }]} />
        <View style={[styles.circle, { backgroundColor: 'rgba(236,72,153,0.3)', right: 0 }]} />
      </View>

      <View style={styles.logoRow}>
        <Text style={{ color: '#a855f7', fontSize: 40, fontWeight: '800' }}>Couple</Text>
        <Ionicons name="heart" size={28} color="#ec4899" style={{ marginHorizontal: 4 }} />
        <Text style={{ color: '#ec4899', fontSize: 40, fontWeight: '800' }}>Flow</Text>
      </View>

      <Text style={styles.headline}>Build your financial future, together</Text>
      <Text style={styles.subtitle}>Take control of your finances as a couple</Text>

      <TouchableOpacity onPress={goNext} style={styles.gradientBtnWrapper}>
        <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.gradientBtn}>
          <Text style={styles.gradientBtnText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <View style={styles.illustrationRow}>
        <Ionicons name="phone-portrait-outline" size={40} color="#a855f7" />
        <Ionicons name="arrow-forward" size={24} color="#5a5a6a" style={{ marginHorizontal: 12 }} />
        <Ionicons name="phone-portrait-outline" size={40} color="#ec4899" />
      </View>

      <Text style={styles.stepTitle}>Invite Your Partner</Text>
      <Text style={styles.subtitle}>Budget together — invite them to your household</Text>

      <Text style={styles.label}>Partner's Email</Text>
      <TextInput
        style={styles.input}
        placeholder="partner@example.com"
        placeholderTextColor="#5a5a6a"
        value={partnerEmail}
        onChangeText={setPartnerEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!inviteSending && !inviteSent}
      />

      {inviteSent ? (
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={{ color: '#10b981', fontWeight: '600', marginLeft: 8 }}>Invite sent!</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleSendInvite}
          disabled={inviteSending}
          style={styles.gradientBtnWrapper}
        >
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.gradientBtn}>
            {inviteSending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.gradientBtnText}>
                {partnerEmail.trim() ? 'Send Invite' : 'Continue'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={goNext} style={styles.skipLink}>
        <Text style={styles.skipText}>Skip for now</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Link Your Accounts</Text>
      <Text style={styles.poweredBy}>Powered by Plaid</Text>

      <View style={styles.bankGrid}>
        {BANKS.map((bank) => (
          <TouchableOpacity
            key={bank.name}
            style={[styles.bankTile, selectedBank === bank.name && styles.bankTileActive]}
            onPress={() => setSelectedBank(bank.name)}
          >
            <Ionicons name={bank.icon} size={24} color={selectedBank === bank.name ? '#a855f7' : '#9ca3af'} />
            <Text style={[styles.bankName, selectedBank === bank.name && { color: '#fff' }]}>{bank.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.securityBadge}>
        <Ionicons name="lock-closed" size={16} color="#10b981" />
        <Text style={styles.securityText}>We use bank-level encryption</Text>
      </View>

      {linked ? (
        <View style={styles.successBadge}>
          <Ionicons name="checkmark-circle" size={20} color="#10b981" />
          <Text style={{ color: '#10b981', fontWeight: '600', marginLeft: 8 }}>Account connected!</Text>
        </View>
      ) : (
        <TouchableOpacity
          onPress={handleLinkAccount}
          disabled={linking}
          style={styles.gradientBtnWrapper}
        >
          <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.gradientBtn}>
            {linking ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="link-outline" size={18} color="#fff" />
                <Text style={styles.gradientBtnText}>Connect</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={goNext} style={styles.skipLink}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Start Your CoupleFlow Journey</Text>
      <Text style={styles.subtitle}>Our AI will assess where you are</Text>

      <View style={styles.roadmap}>
        {LEVELS.map((level, index) => (
          <View key={level.title} style={styles.roadmapItem}>
            <View style={styles.roadmapLeft}>
              <View style={[styles.levelCircle, { backgroundColor: level.color + '33' }]}>
                <Ionicons name={level.icon} size={20} color={level.color} />
              </View>
              {index < 4 && <View style={styles.connector} />}
            </View>
            <View style={styles.roadmapRight}>
              <Text style={styles.levelTitle}>{level.title}</Text>
              <Text style={styles.levelDesc}>{level.description}</Text>
            </View>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleComplete}
        disabled={completing}
        style={styles.gradientBtnWrapper}
      >
        <LinearGradient colors={['#a855f7', '#7c3aed']} style={styles.gradientBtn}>
          {completing ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.gradientBtnText}>Let's Go!</Text>
              <Ionicons name="rocket-outline" size={18} color="#fff" />
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const STEPS = [renderStep0, renderStep1, renderStep2, renderStep3];

  // ─── Main Render ───────────────────────────────────────────

  return (
    <LinearGradient colors={['#0f0a1e', '#1a0a40', '#0f0a1e']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Step indicator dots */}
        <View style={styles.dotsRow}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === currentStep ? '#a855f7' : 'rgba(255,255,255,0.15)' },
                i === currentStep && { width: 20 },
              ]}
            />
          ))}
        </View>

        {/* Step content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {STEPS[currentStep]()}
          </Animated.View>
        </ScrollView>

        {/* Bottom navigation */}
        <View style={styles.bottomNav}>
          <TouchableOpacity
            disabled={currentStep === 0}
            onPress={goBack}
            style={styles.navBtn}
          >
            <Ionicons
              name="chevron-back"
              size={20}
              color={currentStep === 0 ? '#5a5a6a' : '#a855f7'}
            />
          </TouchableOpacity>
          <Text style={styles.stepCounter}>Step {currentStep + 1} of 4</Text>
          <TouchableOpacity
            disabled={currentStep === 3}
            onPress={goNext}
            style={styles.navBtn}
          >
            <Ionicons
              name="chevron-forward"
              size={20}
              color={currentStep === 3 ? '#5a5a6a' : '#ffffff'}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    height: 8,
    width: 8,
    borderRadius: 4,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  stepContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  stepCounter: {
    color: '#9ca3af',
    fontSize: 12,
  },

  // Shared
  headline: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    maxWidth: 320,
    marginBottom: 8,
  },
  stepTitle: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  label: {
    color: '#9ca3af',
    fontSize: 12,
    alignSelf: 'flex-start',
    marginBottom: 6,
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#3a3a4a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#f8fafc',
    fontSize: 15,
    marginBottom: 20,
  },
  gradientBtnWrapper: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  gradientBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  gradientBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  skipLink: {
    marginTop: 16,
    padding: 8,
  },
  skipText: {
    color: '#a855f7',
    fontSize: 14,
    fontWeight: '500',
  },
  successBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.2)',
  },
  poweredBy: {
    color: '#9ca3af',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -24,
    marginBottom: 24,
  },

  // Step 0: Circles
  circlesContainer: {
    width: 160,
    height: 120,
    marginBottom: 24,
    position: 'relative',
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'absolute',
    top: 10,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  // Step 1: Illustration
  illustrationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },

  // Step 2: Bank grid
  bankGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    width: '100%',
    marginBottom: 20,
  },
  bankTile: {
    width: '47%',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3a3a4a',
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    gap: 8,
  },
  bankTileActive: {
    borderWidth: 2,
    borderColor: '#a855f7',
    backgroundColor: 'rgba(168,85,247,0.08)',
  },
  bankName: {
    color: '#9ca3af',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  securityText: {
    color: '#9ca3af',
    fontSize: 12,
  },

  // Step 3: Roadmap
  roadmap: {
    width: '100%',
    marginBottom: 24,
  },
  roadmapItem: {
    flexDirection: 'row',
    gap: 16,
  },
  roadmapLeft: {
    alignItems: 'center',
  },
  levelCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    height: 24,
    backgroundColor: '#3a3a4a',
    marginVertical: 4,
  },
  roadmapRight: {
    flex: 1,
    paddingTop: 4,
    paddingBottom: 16,
  },
  levelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  levelDesc: {
    color: '#9ca3af',
    fontSize: 12,
  },
});
