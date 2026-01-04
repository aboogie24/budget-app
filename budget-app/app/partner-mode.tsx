import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function PartnerMode() {
  const router = useRouter();
  return (
    <LinearGradient colors={['#0b1021', '#371160', '#2b0f50']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>How will you use CoupleFlow?</Text>
        <Text style={styles.subtitle}>You can invite your partner anytime later.</Text>
        <View style={{ gap: 12, marginTop: 12 }}>
          <TouchableOpacity style={styles.card} onPress={() => router.replace('/household-setup')}>
            <View style={styles.iconCircle}>
              <Ionicons name="people-outline" size={24} color="#f8fafc" />
            </View>
            <View>
              <Text style={styles.cardTitle}>With Partner</Text>
              <Text style={styles.cardSub}>Share budgets & track together</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.card} onPress={() => router.replace('/register')}>
            <View style={styles.iconCircle}>
              <Ionicons name="heart-outline" size={24} color="#f8fafc" />
            </View>
            <View>
              <Text style={styles.cardTitle}>Solo for Now</Text>
              <Text style={styles.cardSub}>Personal finance tracking</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.dots}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.dot, i === 2 && styles.dotActive]} />
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  content: { alignItems: 'center', gap: 8 },
  title: { color: '#e5e7eb', fontSize: 22, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: '#cbd5e1', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minWidth: 320,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: { color: '#f8fafc', fontWeight: '700', fontSize: 15 },
  cardSub: { color: '#cbd5e1', fontSize: 13 },
  dots: { flexDirection: 'row', gap: 8, marginTop: 40 },
  dot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#6b7280' },
  dotActive: { backgroundColor: '#b26ef8', width: 12 },
});
