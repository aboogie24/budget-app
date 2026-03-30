import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, FlatList } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

const chips = ['Couples-first', 'Shared goals', 'Smart insights', 'Invite-only households'];

export default function WelcomeScreen() {
  const router = useRouter();
  const colors = {
    primary: '#7c3aed',
    secondary: '#a855f7',
    background: '#0f172a',
    text: '#0b1021',
    surface: '#ffffff',
  };

  return (
    <ImageBackground
      source={{ uri: 'https://images.unsplash.com/photo-1508387027703-8e3d1ff0b5fd?auto=format&fit=crop&w=1200&q=80' }}
      style={styles.image}
      resizeMode="cover"
    >
      <LinearGradient colors={['rgba(15,23,42,0.85)', 'rgba(15,23,42,0.75)']} style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>CoupleFlow</Text>
          </View>
          <Text style={styles.title}>Build your money rhythm together</Text>
          <Text style={styles.subtitle}>
            Shared budgets, linked accounts, and real-time priorities built for partners.
          </Text>

          <FlatList
            data={chips}
            keyExtractor={(item) => item}
            horizontal
            contentContainerStyle={{ gap: 8 }}
            renderItem={({ item }) => (
              <View style={styles.chip}>
                <Text style={styles.chipText}>{item}</Text>
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />

          <TouchableOpacity style={[styles.cta, { backgroundColor: colors.primary }]} onPress={() => router.replace('/register')}>
            <Text style={styles.ctaText}>Create an account</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.cta, styles.ctaGhost]} onPress={() => router.replace('/login')}>
            <Text style={[styles.ctaGhostText, { color: colors.primary }]}>I already have an account</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  image: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', padding: 24 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24,
    padding: 22,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#ede9fe',
    marginBottom: 12,
  },
  badgeText: { color: '#7c3aed', fontWeight: '700', fontSize: 12, letterSpacing: 0.4 },
  title: { fontSize: 28, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#475569', marginBottom: 16, lineHeight: 22 },
  chip: {
    backgroundColor: '#f4f3ff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e4ddff',
  },
  chipText: { color: '#6b21a8', fontWeight: '700', fontSize: 12 },
  cta: {
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  ctaText: { color: 'white', fontWeight: '700', fontSize: 16 },
  ctaGhost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  ctaGhostText: { fontWeight: '700', fontSize: 16 },
});
