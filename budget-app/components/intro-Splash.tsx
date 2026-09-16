import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, AccessibilityInfo } from 'react-native';
import { SPLASH_DURATION_MS, SPLASH_BG, WORDMARK } from '@/utils/onboarding';
import { colors, spacing, typography } from '@/utils/design-system';

/**
 * C026 branded splash (#0f172a). Reduce-motion → instant cut (children render immediately).
 */
export function IntroSplash({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    (async () => {
      let reduce = false;
      try {
        reduce = await AccessibilityInfo.isReduceMotionEnabled();
      } catch {}
      if (cancelled) return;
      if (reduce) {
        setShowSplash(false);
        return;
      }
      timer = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished && !cancelled) setShowSplash(false);
        });
      }, SPLASH_DURATION_MS);
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [opacity]);

  if (!showSplash) return <>{children}</>;

  return (
    <View style={styles.root} accessibilityLabel="CoupleFlow">
      <Animated.View style={[styles.inner, { opacity }]}>
        <View style={styles.wordmark}>
          <Text style={[styles.couple, { color: WORDMARK.couple }]}>Couple</Text>
          <Text style={[styles.heart, { color: WORDMARK.heart }]}>♥</Text>
          <Text style={[styles.flow, { color: WORDMARK.flow }]}>Flow</Text>
        </View>
        <Text style={styles.tag}>Shared money, built together</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: SPLASH_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: { alignItems: 'center' },
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  couple: { ...typography.h1 },
  flow: { ...typography.h1 },
  heart: { fontSize: 28, marginHorizontal: spacing.xs },
  tag: { ...typography.small, color: colors.textMuted, marginTop: spacing.md },
});

export default IntroSplash;
