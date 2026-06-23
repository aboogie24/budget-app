import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polygon, Polyline } from 'react-native-svg';

type SparklineProps = {
  /** Time-ordered values. Single point or empty renders a tiny placeholder. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke + fill color hint. Defaults to a green-ish accent when trend is up. */
  color?: string;
  /** When true, render up-vs-down color automatically based on first vs last value. */
  autoColor?: boolean;
  /** Placeholder text when there's no data yet. */
  emptyLabel?: string;
};

/**
 * Real historical sparkline driven by daily net-worth snapshots. No synthetic
 * data — when there aren't at least 2 points the component renders a small
 * "collecting data" placeholder so the user knows it's seeded, not broken.
 */
export function Sparkline({
  values,
  width = 100,
  height = 44,
  color,
  autoColor = true,
  emptyLabel = 'Collecting…',
}: SparklineProps) {
  if (!values || values.length < 2) {
    return (
      <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>
          {emptyLabel}
        </Text>
      </View>
    );
  }

  const first = values[0];
  const last = values[values.length - 1];
  const trendUp = last >= first;
  const stroke = color ?? (autoColor ? (trendUp ? '#10b981' : '#ef4444') : '#a855f7');

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 2;
  const usableW = width;
  const usableH = height - padding * 2;

  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * usableW;
      const y = padding + (1 - (v - min) / range) * usableH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  return (
    <Svg width={width} height={height}>
      <Polygon points={`0,${height} ${points} ${usableW},${height}`} fill={stroke} fillOpacity={0.15} />
      <Polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default Sparkline;
