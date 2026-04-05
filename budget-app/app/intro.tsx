import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

export default function IntroScreen() {
  const router = useRouter();

  const handleGetStarted = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/register');
  };

  return (
    <LinearGradient colors={['#0f0a1e', '#1a0a40', '#0f0a1e']} style={styles.container}>
      <View style={styles.content}>
        {/* Overlapping circles illustration */}
        <View style={styles.circlesContainer}>
          <View style={[styles.circle, styles.circlePurple]} />
          <View style={[styles.circle, styles.circlePink]} />
        </View>

        {/* Logo */}
        <View style={styles.logoRow}>
          <Text style={styles.logoPurple}>Couple</Text>
          <Ionicons name="heart" size={28} color="#ec4899" style={{ marginHorizontal: 4 }} />
          <Text style={styles.logoPink}>Flow</Text>
        </View>

        {/* Tagline */}
        <Text style={styles.headline}>
          Build your financial future, together
        </Text>
        <Text style={styles.subtitle}>
          Take control of your finances as a couple
        </Text>

        {/* CTA */}
        <TouchableOpacity onPress={handleGetStarted} style={styles.ctaWrapper}>
          <LinearGradient
            colors={['#a855f7', '#7c3aed']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.cta}
          >
            <Text style={styles.ctaText}>Get Started</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Sign in link */}
        <TouchableOpacity onPress={() => router.push('/login')} style={styles.signInLink}>
          <Text style={styles.signInText}>
            Already have an account? <Text style={{ color: '#a855f7', fontWeight: '600' }}>Sign In</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  circlesContainer: {
    width: 160,
    height: 120,
    marginBottom: 32,
    position: 'relative',
  },
  circle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    position: 'absolute',
    top: 10,
  },
  circlePurple: {
    backgroundColor: 'rgba(168, 85, 247, 0.3)',
    left: 0,
  },
  circlePink: {
    backgroundColor: 'rgba(236, 72, 153, 0.3)',
    right: 0,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  logoPurple: {
    color: '#a855f7',
    fontSize: 40,
    fontWeight: '800',
  },
  logoPink: {
    color: '#ec4899',
    fontSize: 40,
    fontWeight: '800',
  },
  headline: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 34,
    maxWidth: 320,
    marginBottom: 8,
  },
  subtitle: {
    color: '#9ca3af',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 40,
  },
  ctaWrapper: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  signInLink: {
    marginTop: 20,
    padding: 8,
  },
  signInText: {
    color: '#9ca3af',
    fontSize: 14,
  },
});
