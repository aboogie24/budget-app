import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import GradientBackground from '@/components/GradientBackground';
import { Skeleton } from '@/components/Skeleton';
import { colors, spacing, radius, typography, gradients, glassEffects } from '@/utils/design-system';

const CHIPS = ['Couples-first', 'Shared goals', 'Smart insights', 'Invite-only households'];

/**
 * Welcome (Onboarding Entry) screen.
 *
 * Redesigned per docs/design/specs/welcome-redesign.md to be unmistakably
 * CoupleFlow: same bgDarkPurple gradient, glass surfaces, wordmark and button
 * language as the auth screens. All tokens come from design-system.ts.
 *
 * Navigation contract preserved: both CTAs use router.replace (welcome is a
 * launch root, so replace avoids a dead back stack).
 */
export default function WelcomeScreen() {
  const router = useRouter();

  // Loading covers the brief cold-start moment (fonts / any future
  // session-availability check). Nothing on this screen is server-fetched, so
  // this resolves on the next frame and the layout never jumps.
  const [ready, setReady] = useState(false);
  // Navigation-in-flight guard so a CTA can't be double-tapped.
  const [navigating, setNavigating] = useState<null | 'register' | 'login'>(null);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(t);
  }, []);

  const go = (target: 'register' | 'login') => {
    if (navigating) return;
    setNavigating(target);
    router.replace(`/${target}`);
  };

  return (
    <GradientBackground variant="bgDarkPurple" style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <View style={styles.container}>
          {/* ─── Brand wordmark (renders immediately, no async) ─── */}
          <View
            style={styles.wordmark}
            accessibilityRole="header"
            accessibilityLabel="CoupleFlow"
          >
            <Text style={[styles.wordmarkText, styles.wordmarkCouple]}>Couple</Text>
            <Ionicons name="heart" size={18} color={colors.accent} style={styles.wordmarkHeart} />
            <Text style={[styles.wordmarkText, styles.wordmarkFlow]}>Flow</Text>
          </View>

          {/* ─── Hero ─── */}
          <View style={styles.hero}>
            {ready ? (
              <>
                <Text style={styles.title} numberOfLines={2}>
                  Build your money rhythm together
                </Text>
                <Text style={styles.subtitle} numberOfLines={3}>
                  Shared budgets, linked accounts, and real-time priorities built for partners.
                </Text>
              </>
            ) : (
              <View accessibilityLabel="Loading">
                <Skeleton width="70%" height={32} borderRadius={8} />
                <Skeleton width="45%" height={32} borderRadius={8} style={styles.skelGap} />
                <Skeleton width="90%" height={16} borderRadius={6} style={styles.skelSubtitle} />
                <Skeleton width="60%" height={16} borderRadius={6} style={styles.skelGap} />
              </View>
            )}
          </View>

          {/* flex spacer lifts brand+hero to the upper third, anchors actions */}
          <View style={styles.flex} />

          {/* ─── Feature chips ─── */}
          {ready ? (
            <FlatList
              data={CHIPS}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
              accessibilityLabel={`Features: ${CHIPS.join(', ')}`}
              renderItem={({ item }) => (
                <View style={styles.chip}>
                  <Ionicons name="ellipse" size={6} color={colors.primary2} />
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={[styles.chipRow, styles.skelChipRow]}>
              <Skeleton width={110} height={34} borderRadius={radius.full} />
              <Skeleton width={130} height={34} borderRadius={radius.full} />
              <Skeleton width={140} height={34} borderRadius={radius.full} />
            </View>
          )}

          {/* ─── Primary CTA ─── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => go('register')}
            disabled={!!navigating}
            style={[styles.ctaWrap, navigating && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Create an account"
            accessibilityHint="Opens sign-up"
          >
            <LinearGradient
              colors={[...gradients.primaryGradient]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.primaryCta}
            >
              {navigating === 'register' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <>
                  <Text style={styles.primaryCtaText} numberOfLines={1}>
                    Create an account
                  </Text>
                  <Ionicons name="arrow-forward" size={18} color={colors.text} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* ─── Secondary CTA ─── */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => go('login')}
            disabled={!!navigating}
            style={[styles.secondaryCta, navigating && styles.ctaDisabled]}
            accessibilityRole="button"
            accessibilityLabel="I already have an account, log in"
            accessibilityHint="Opens sign-in"
          >
            {navigating === 'login' ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <Text style={styles.secondaryCtaText} numberOfLines={1}>
                I already have an account
              </Text>
            )}
          </TouchableOpacity>

          {/* ─── Consent line ─── */}
          <Text style={styles.consent}>
            By continuing you agree to our{' '}
            <Text
              style={styles.consentLink}
              onPress={() => router.push('/terms')}
              accessibilityRole="link"
            >
              Terms
            </Text>{' '}
            &amp;{' '}
            <Text
              style={styles.consentLink}
              onPress={() => router.push('/privacy')}
              accessibilityRole="link"
            >
              Privacy
            </Text>
            .
          </Text>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}

const CTA_HEIGHT = 52;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // Wordmark
  wordmark: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  wordmarkText: {
    ...typography.h3,
  },
  wordmarkCouple: { color: colors.primary2 },
  wordmarkFlow: { color: colors.accent },
  wordmarkHeart: { marginHorizontal: spacing.xs },

  // Hero
  hero: {
    marginTop: spacing.md,
  },
  title: {
    ...typography.h1,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    marginTop: spacing.md,
  },
  skelGap: { marginTop: spacing.sm },
  skelSubtitle: { marginTop: spacing.lg },

  // Chips
  chipRow: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  skelChipRow: {
    flexDirection: 'row',
  },
  chip: {
    ...glassEffects.glass,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 34,
  },
  chipText: {
    ...typography.smallBold,
    color: colors.text,
  },

  // Primary CTA
  ctaWrap: {
    marginTop: spacing.xl,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  primaryCta: {
    height: CTA_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.lg,
  },
  primaryCtaText: {
    ...typography.button,
    color: colors.text,
  },
  ctaDisabled: { opacity: 0.6 },

  // Secondary CTA
  secondaryCta: {
    ...glassEffects.glass,
    marginTop: spacing.md,
    height: CTA_HEIGHT,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryCtaText: {
    ...typography.button,
    color: colors.text,
  },

  // Consent
  consent: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  consentLink: {
    color: colors.primary2,
  },
});
