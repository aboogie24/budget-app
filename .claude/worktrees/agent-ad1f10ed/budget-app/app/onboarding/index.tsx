import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const steps = [
  { id: 1, title: 'Welcome', subtitle: 'Let’s tailor your plan', type: 'welcome' },
  { id: 2, title: 'Budget Mode', subtitle: 'Shared or personal focus?', type: 'mode' },
  { id: 3, title: 'Income & Expenses', subtitle: 'Rough monthly numbers', type: 'numbers' },
  { id: 4, title: 'Finish', subtitle: 'Ready to go', type: 'finish' },
];

export default function OnboardingFlow() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [mode, setMode] = useState<'shared' | 'personal' | null>(null);
  const [income, setIncome] = useState<number | null>(null);
  const [expenses, setExpenses] = useState<number | null>(null);

  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const prev = () => setStepIndex((i) => Math.max(i - 1, 0));

  const current = steps[stepIndex];

  const colors = {
    primary: '#7c3aed',
    primary2: '#a855f7',
    bg: '#0f172a',
    surface: '#111827',
    text: '#f8fafc',
    muted: '#cbd5e1',
  };

  const renderContent = () => {
    switch (current.type) {
      case 'welcome':
        return (
          <>
            <Text style={styles.hero}>Let’s make a plan</Text>
            <Text style={styles.body}>We’ll set up budgets for this month and keep both of you in sync.</Text>
            <View style={styles.chipRow}>
              {['Couples-first', 'Shared goals', 'Smart insights'].map((c) => (
                <View key={c} style={styles.chip}>
                  <Text style={styles.chipText}>{c}</Text>
                </View>
              ))}
            </View>
          </>
        );
      case 'mode':
        return (
          <>
            <Text style={styles.hero}>How are you budgeting?</Text>
            <Text style={styles.body}>Choose what to focus on. You can switch later.</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              <TouchableOpacity
                style={[styles.cardButton, mode === 'shared' && styles.cardButtonActive]}
                onPress={() => setMode('shared')}
              >
                <Text style={styles.cardTitle}>Shared household</Text>
                <Text style={styles.cardSub}>Track joint income, shared bills, and invites.</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.cardButton, mode === 'personal' && styles.cardButtonActive]}
                onPress={() => setMode('personal')}
              >
                <Text style={styles.cardTitle}>Personal</Text>
                <Text style={styles.cardSub}>Start solo, add your partner when ready.</Text>
              </TouchableOpacity>
            </View>
          </>
        );
      case 'numbers':
        return (
          <>
            <Text style={styles.hero}>Monthly snapshot</Text>
            <Text style={styles.body}>Give us a ballpark for income and expenses. We’ll refine later.</Text>
            <View style={{ gap: 12, marginTop: 12 }}>
              {[
                { label: 'Monthly income', value: income, setter: setIncome, preset: 6000 },
                { label: 'Monthly expenses', value: expenses, setter: setExpenses, preset: 4000 },
              ].map((row) => (
                <TouchableOpacity
                  key={row.label}
                  style={styles.cardButton}
                  onPress={() => row.setter(row.preset)}
                >
                  <Text style={styles.cardTitle}>{row.label}</Text>
                  <Text style={styles.cardSub}>{row.value ? `$${row.value.toLocaleString()}` : 'Tap to set'}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        );
      case 'finish':
        return (
          <>
            <Text style={styles.hero}>You’re set</Text>
            <Text style={styles.body}>We’ll generate your month view and budgets. You can invite your partner any time.</Text>
          </>
        );
      default:
        return null;
    }
  };

  const canNext =
    (current.type === 'mode' && mode) ||
    (current.type === 'numbers' && income !== null && expenses !== null) ||
    current.type === 'welcome' ||
    current.type === 'finish';

  const handleNext = () => {
    if (current.type === 'finish') {
      router.replace('/(tabs)/dashboard');
      return;
    }
    next();
  };

  return (
    <LinearGradient colors={['#0f172a', '#0b1021']} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.progressRow}>
          {steps.map((s, idx) => (
            <View key={s.id} style={[styles.progressDot, idx <= stepIndex && styles.progressDotActive]} />
          ))}
        </View>
        <View style={styles.card}>
          <Text style={styles.stepLabel}>Step {stepIndex + 1} of {steps.length}</Text>
          <Text style={styles.stepTitle}>{current.title}</Text>
          <Text style={styles.stepSubtitle}>{current.subtitle}</Text>
          {renderContent()}
        </View>

        <View style={styles.actions}>
          {stepIndex > 0 ? (
            <TouchableOpacity style={[styles.buttonGhost, { borderColor: '#7c3aed' }]} onPress={prev}>
              <Text style={[styles.buttonGhostText, { color: '#7c3aed' }]}>Back</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ height: 1 }} />
          )}
          <TouchableOpacity
            style={[styles.button, !canNext && { opacity: 0.5 }]}
            onPress={handleNext}
            disabled={!canNext}
          >
            <Text style={styles.buttonText}>{current.type === 'finish' ? 'Go to dashboard' : 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, flexGrow: 1, justifyContent: 'center', gap: 16 },
  progressRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 4 },
  progressDot: { width: 10, height: 10, borderRadius: 999, backgroundColor: '#1f2937' },
  progressDotActive: { backgroundColor: '#7c3aed' },
  card: {
    backgroundColor: 'rgba(17,24,39,0.75)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  stepLabel: { color: '#9ca3af', fontSize: 12, marginBottom: 4 },
  stepTitle: { color: '#f8fafc', fontSize: 22, fontWeight: '800', marginBottom: 4 },
  stepSubtitle: { color: '#cbd5e1', fontSize: 14, marginBottom: 16 },
  hero: { color: '#f8fafc', fontSize: 24, fontWeight: '800', marginBottom: 8 },
  body: { color: '#cbd5e1', fontSize: 14, lineHeight: 20, marginBottom: 12 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  chip: { backgroundColor: '#1f2937', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#2d2f3a' },
  chipText: { color: '#c4b5fd', fontWeight: '700', fontSize: 12 },
  cardButton: { backgroundColor: '#1f2937', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2d2f3a' },
  cardButtonActive: { borderColor: '#7c3aed', backgroundColor: 'rgba(124,58,237,0.1)' },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 16, marginBottom: 4 },
  cardSub: { color: '#9ca3af', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  button: { flex: 1, backgroundColor: '#7c3aed', paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 16 },
  buttonGhost: { width: 120, paddingVertical: 14, borderRadius: 14, alignItems: 'center', borderWidth: 2 },
  buttonGhostText: { fontWeight: '700', fontSize: 16 },
});
