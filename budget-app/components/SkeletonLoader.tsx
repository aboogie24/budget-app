import React, { useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useTheme } from '@/utils/ThemeContext';
import { componentDefaults } from '@/utils/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height,
  borderRadius = componentDefaults.borderRadius.md,
  style,
}) => {
  const { themeValues, theme } = useTheme();
  const shimmerAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    ).start();
  }, [shimmerAnim]);

  const backgroundColor = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [
      theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      theme === 'dark' ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
    ],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

interface SkeletonCardProps {
  lines?: number;
  style?: any;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  lines = 3,
  style,
}) => {
  const { themeValues } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: themeValues.glassLight.backgroundColor,
          borderColor: themeValues.glassLight.borderColor,
          borderWidth: 1,
          borderRadius: componentDefaults.borderRadius.md,
          padding: componentDefaults.spacing.md,
          marginBottom: componentDefaults.spacing.md,
        },
        style,
      ]}
    >
      <SkeletonLoader height={16} style={{ marginBottom: 12 }} width="60%" />
      {Array.from({ length: lines - 1 }).map((_, i) => (
        <SkeletonLoader
          key={i}
          height={12}
          style={{
            marginBottom: i === lines - 2 ? 0 : 8,
            width: i === lines - 2 ? '80%' : '100%',
          }}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  skeleton: {
    overflow: 'hidden',
  },
});
