import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface ProgressRingProps {
  progress: number;
  size: number;
  strokeWidth: number;
  color: string;
  backgroundColor: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  backgroundColor,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: progress,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress, animatedValue]);

  const strokeDashoffset = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  const centerX = size / 2;
  const centerY = size / 2;

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'relative', width: size, height: size }}>
        <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
          {/* Background circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke={backgroundColor}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${centerX} ${centerY})`}
          />
        </Svg>
        {/* Center text */}
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { alignItems: 'center', justifyContent: 'center' },
          ]}
        >
          <Text style={{ fontSize: 18, fontWeight: '700', color: color }}>
            {Math.round(progress * 100)}%
          </Text>
        </View>
      </View>
    </View>
  );
};
