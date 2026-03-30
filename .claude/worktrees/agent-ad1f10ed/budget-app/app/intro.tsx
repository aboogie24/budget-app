import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

export default function IntroScreen() {
  const router = useRouter();
  return (
    <LinearGradient colors={['#0b1021', '#371160', '#2b0f50']} style={styles.container}>
      <View style={styles.content}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=200&q=80' }}
          style={styles.logo}
        />
        <Text style={styles.title}>CoupleFlow</Text>
        <Text style={styles.subtitle}>
          A shared money experience that feels calm, supportive, and built for real relationships.
        </Text>
        <TouchableOpacity style={styles.cta} onPress={() => router.replace('/theme-select')}>
          <Text style={styles.ctaText}>Get Started  →</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={[styles.dot, i === 0 && styles.dotActive]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  content: { alignItems: 'center', paddingHorizontal: 24, marginBottom: 80 },
  logo: { width: 120, height: 120, borderRadius: 30, marginBottom: 24, backgroundColor: 'rgba(255,255,255,0.1)' },
  title: { color: '#c084fc', fontSize: 28, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: '#d1d5db', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 320 },
  cta: {
    marginTop: 24,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 16,
    backgroundColor: '#b26ef8',
    minWidth: 260,
    alignItems: 'center',
  },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#6b7280' },
  dotActive: { backgroundColor: '#b26ef8', width: 12 },
});
