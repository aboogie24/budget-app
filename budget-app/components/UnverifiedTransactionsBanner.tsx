import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  count: number;
  onPress: () => void;
};

export default function UnverifiedTransactionsBanner({ count, onPress }: Props) {
  if (count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconWrapper}>
        <Ionicons name="alert-circle" size={22} color="#fbbf24" />
      </View>

      <View style={styles.textWrapper}>
        <Text style={styles.title}>
          {count} transaction{count !== 1 ? 's' : ''} need{count === 1 ? 's' : ''} your review
        </Text>
        <Text style={styles.subtitle}>Auto-categorized — tap to verify</Text>
      </View>

      <View style={styles.actionWrapper}>
        <Text style={styles.actionText}>Review</Text>
        <Ionicons name="chevron-forward" size={14} color="#fbbf24" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(251, 191, 36, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.2)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 12,
  },
  iconWrapper: {
    flexShrink: 0,
  },
  textWrapper: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: 'white',
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.45)',
    marginTop: 2,
  },
  actionWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    flexShrink: 0,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
  },
});
