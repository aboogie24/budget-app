import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, AccessibilityInfo } from 'react-native';
import { colors, radius } from '@/utils/design-system';

type SavingsProgressBarProps = {
  /** 0–100 fill percentage. */
  percent: number;
  /** Fill color — hero uses colors.primary, goal rows use the status color. */
  color: string;
  /** Track height. Defaults to 8 per the shared progress-bar recipe. */
  height?: number;
};

/**
 * Shared progress-bar recipe (spec §6). Track `colors.glassLight`, height 8,
 * `radius.full`; fill animates width when `percent` changes and snaps instantly
 * under OS reduce-motion.
 */
export function SavingsProgressBar({ percent, color, height = 8 }: SavingsProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const anim = useRef(new Animated.Value(clamped)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduceMotion(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) =>
      setReduceMotion(v),
    );
    return () => {
      mounted = false;
      // @ts-ignore older RN returns void, newer returns a subscription
      sub?.remove?.();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      anim.setValue(clamped);
      return;
    }
    Animated.timing(anim, {
      toValue: clamped,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [clamped, reduceMotion, anim]);

  const width = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={{
        height,
        backgroundColor: colors.glassLight,
        borderRadius: radius.full,
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          height: '100%',
          width,
          backgroundColor: color,
          borderRadius: radius.full,
        }}
      />
    </View>
  );
}

export default SavingsProgressBar;
