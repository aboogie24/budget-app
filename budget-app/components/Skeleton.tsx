import React, { useEffect, useRef } from 'react';
import { Animated, View, StyleProp, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A pulsing placeholder block for loading states. Keep the same shape as the
 * content it stands in for (matching width/height/borderRadius) so the layout
 * doesn't jump when real data arrives.
 */
export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: 'rgba(255,255,255,0.08)',
          opacity,
        },
        style,
      ]}
    />
  );
}

export default Skeleton;

/** A row of skeleton lines, useful for list/card placeholders. */
export function SkeletonStack({
  count = 3,
  height = 12,
  gap = 8,
}: {
  count?: number;
  height?: number;
  gap?: number;
}) {
  return (
    <View style={{ gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          height={height}
          width={i === count - 1 ? '60%' : '100%'}
        />
      ))}
    </View>
  );
}
