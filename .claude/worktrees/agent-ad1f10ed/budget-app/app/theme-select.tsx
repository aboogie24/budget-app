import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { setThemeChoice } from '@/utils/storage';

export default function ThemeSelect() {
  const router = useRouter();
  const [selected, setSelected] = useState<'light' | 'dark' | null>('dark');

  const select = async (mode: 'light' | 'dark') => {
    setSelected(mode);
    await setThemeChoice(mode);
    setTimeout(() => router.replace('/partner-mode'), 200);
  };

  return (
    <LinearGradient colors={['#0b1021', '#371160', '#2b0f50']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Choose Your Vibe</Text>
        <Text style={styles.subtitle}>Select a theme that suits your style. You can always change this later.</Text>
        <View style={styles.row}>
          <TouchableOpacity
            style={[styles.card, selected === 'light' && styles.cardActive]}
            onPress={() => select('light')}
          >
            <Ionicons name="sunny-outline" size={28} color={selected === 'light' ? '#7c3aed' : '#6b21a8'} />
            <Text style={styles.cardText}>Light</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.card, styles.cardDark, selected === 'dark' && styles.cardActiveDark]}
            onPress={() => select('dark')}
          >
            <Ionicons name="moon-outline" size={28} color="#c084fc" />
            <Text style={[styles.cardText, { color: '#e5e7eb' }]}>Dark</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.dot, i === 1 && styles.dotActive]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', gap: 12 },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  row: { flexDirection: 'row', gap: 12, marginTop: 10 },
  card: {
    width: 130,
    height: 140,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardDark: {
    backgroundColor: 'rgba(34, 32, 52, 0.8)',
    borderColor: '#8b5cf6',
  },
  cardActive: { borderColor: '#c084fc' },
  cardActiveDark: { borderColor: '#c084fc', backgroundColor: 'rgba(65, 44, 102, 0.7)' },
  cardText: { color: '#1f2937', fontWeight: '600' },
  dots: { flexDirection: 'row', gap: 8, marginTop: 60 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#6b7280' },
  dotActive: { backgroundColor: '#b26ef8', width: 12 },
});
