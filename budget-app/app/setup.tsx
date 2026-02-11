import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentUser } from '../utils/storage';
import { api } from '../utils/apiClient';

const BUDGET_PRESETS = [
  { label: '$1,000', value: 1000 },
  { label: '$2,000', value: 2000 },
  { label: '$3,000', value: 3000 },
  { label: '$5,000', value: 5000 },
];

export default function SetupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = welcome, 1 = budget goal, 2 = link bank
  const [budgetGoal, setBudgetGoal] = useState('');
  const [userName, setUserName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await getCurrentUser();
      if (user?.full_name) setUserName(user.full_name);
    })();
  }, []);

  const handleSaveBudget = async () => {
    const goal = parseFloat(budgetGoal);
    if (!goal || goal <= 0) {
      Alert.alert('Enter a budget', 'Please enter a valid monthly budget goal.');
      return;
    }
    setSaving(true);
    try {
      const userId = await api.getUserId();
      if (!userId) throw new Error('No session');
      await api.post('/auth/onboarding/complete', {
        user_id: userId,
        monthly_budget_goal: goal,
      });
      setStep(2);
    } catch (e) {
      console.error('Save budget error:', e);
      Alert.alert('Error', 'Could not save your budget goal.');
    } finally {
      setSaving(false);
    }
  };

  const goToDashboard = () => {
    router.replace('/(tabs)/dashboard');
  };

  // Step 0: Welcome
  if (step === 0) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={styles.centered}>
            <View style={styles.iconCircle}>
              <Ionicons name="sparkles" size={40} color="#c084fc" />
            </View>
            <Text style={styles.welcomeTitle}>
              Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Let's get your finances set up in just a couple of steps.
            </Text>

            <View style={styles.stepPreview}>
              {[
                { icon: 'wallet-outline' as const, label: 'Set your monthly budget' },
                { icon: 'link-outline' as const, label: 'Connect your bank' },
              ].map((s, i) => (
                <View key={i} style={styles.stepPreviewRow}>
                  <View style={styles.stepPreviewBadge}>
                    <Text style={styles.stepPreviewNum}>{i + 1}</Text>
                  </View>
                  <Ionicons name={s.icon} size={18} color="#c084fc" />
                  <Text style={styles.stepPreviewText}>{s.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity onPress={() => setStep(1)} style={styles.primaryBtn}>
              <LinearGradient
                colors={['#a855f7', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.primaryBtnInner}
              >
                <Text style={styles.primaryBtnText}>Get Started</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity onPress={goToDashboard} style={styles.skipBtn}>
              <Text style={styles.skipText}>Skip setup for now</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Step 1: Budget goal
  if (step === 1) {
    return (
      <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.centered}>
                {/* Progress */}
                <View style={styles.progressRow}>
                  <View style={[styles.progressDot, styles.progressDotActive]} />
                  <View style={styles.progressDot} />
                </View>

                <View style={styles.iconCircle}>
                  <Ionicons name="wallet-outline" size={36} color="#c084fc" />
                </View>
                <Text style={styles.stepTitle}>Monthly Budget Goal</Text>
                <Text style={styles.stepSubtitle}>
                  How much do you plan to spend each month? You can always change this later.
                </Text>

                {/* Presets */}
                <View style={styles.presetRow}>
                  {BUDGET_PRESETS.map((p) => (
                    <TouchableOpacity
                      key={p.value}
                      style={[
                        styles.presetBtn,
                        budgetGoal === String(p.value) && styles.presetBtnActive,
                      ]}
                      onPress={() => setBudgetGoal(String(p.value))}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          budgetGoal === String(p.value) && styles.presetTextActive,
                        ]}
                      >
                        {p.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.orText}>or enter custom amount</Text>

                <View style={styles.inputRow}>
                  <Text style={styles.dollarSign}>$</Text>
                  <TextInput
                    placeholder="0.00"
                    placeholderTextColor="#64748b"
                    value={budgetGoal}
                    onChangeText={setBudgetGoal}
                    style={styles.inputBare}
                    keyboardType="numeric"
                  />
                </View>

                <TouchableOpacity
                  onPress={handleSaveBudget}
                  style={[styles.primaryBtn, saving && { opacity: 0.6 }]}
                  disabled={saving}
                >
                  <LinearGradient
                    colors={['#a855f7', '#7c3aed']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.primaryBtnInner}
                  >
                    <Text style={styles.primaryBtnText}>
                      {saving ? 'Saving...' : 'Continue'}
                    </Text>
                    {!saving && <Ionicons name="arrow-forward" size={18} color="#fff" style={{ marginLeft: 6 }} />}
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setStep(2)} style={styles.skipBtn}>
                  <Text style={styles.skipText}>Skip this step</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  // Step 2: Link bank
  return (
    <LinearGradient colors={['#0b1021', '#2b0f50', '#1b1039']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.centered}>
          {/* Progress */}
          <View style={styles.progressRow}>
            <View style={[styles.progressDot, styles.progressDotDone]} />
            <View style={[styles.progressDot, styles.progressDotActive]} />
          </View>

          <View style={styles.iconCircle}>
            <Ionicons name="link-outline" size={36} color="#c084fc" />
          </View>
          <Text style={styles.stepTitle}>Link Your Bank</Text>
          <Text style={styles.stepSubtitle}>
            Connect your bank account to automatically sync transactions, investments, and debts.
          </Text>

          <View style={styles.featureList}>
            {[
              { icon: 'swap-horizontal-outline' as const, text: 'Auto-import transactions' },
              { icon: 'trending-up-outline' as const, text: 'Track investments' },
              { icon: 'card-outline' as const, text: 'Monitor debt balances' },
            ].map((f, i) => (
              <View key={i} style={styles.featureRow}>
                <View style={styles.featureIcon}>
                  <Ionicons name={f.icon} size={18} color="#c084fc" />
                </View>
                <Text style={styles.featureText}>{f.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={() => router.push('/link-account')}
            style={styles.primaryBtn}
          >
            <LinearGradient
              colors={['#a855f7', '#7c3aed']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryBtnInner}
            >
              <Ionicons name="shield-checkmark-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Connect with Plaid</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={14} color="#94a3b8" />
            <Text style={styles.trustText}>Bank-level encryption · Read-only access</Text>
          </View>

          <TouchableOpacity onPress={goToDashboard} style={styles.skipBtn}>
            <Text style={styles.skipText}>I'll do this later</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  progressDot: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressDotActive: {
    backgroundColor: '#c084fc',
  },
  progressDotDone: {
    backgroundColor: '#34d399',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(192,132,252,0.25)',
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    color: '#94a3b8',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  stepPreview: {
    gap: 14,
    marginBottom: 32,
    width: '100%',
  },
  stepPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepPreviewBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(192,132,252,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepPreviewNum: {
    color: '#c084fc',
    fontWeight: '800',
    fontSize: 13,
  },
  stepPreviewText: {
    color: '#e5e7eb',
    fontWeight: '600',
    fontSize: 15,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
    justifyContent: 'center',
  },
  presetBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  presetBtnActive: {
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderColor: 'rgba(168,85,247,0.5)',
  },
  presetText: { color: '#cbd5e1', fontWeight: '600', fontSize: 15 },
  presetTextActive: { color: '#fff', fontWeight: '700' },
  orText: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 8,
  },
  dollarSign: { color: '#94a3b8', fontSize: 20, fontWeight: '700', marginRight: 6 },
  inputBare: { flex: 1, color: '#f8fafc', fontSize: 20, fontWeight: '700' },
  primaryBtn: { borderRadius: 14, overflow: 'hidden', width: '100%', marginTop: 16 },
  primaryBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  skipBtn: { marginTop: 16, padding: 8 },
  skipText: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  featureList: { gap: 12, width: '100%', marginBottom: 8 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(192,132,252,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { color: '#e5e7eb', fontWeight: '600', fontSize: 14 },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  trustText: { color: '#94a3b8', fontSize: 12 },
});
