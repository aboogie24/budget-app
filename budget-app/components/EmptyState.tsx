import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { componentDefaults } from '@/utils/theme';
import GlassCard from './GlassCard';

interface EmptyStateProps {
  icon: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}) => {
  const { themeValues } = useTheme();

  return (
    <GlassCard
      intensity="light"
      style={styles.container}
      padding={componentDefaults.spacing.xl}
    >
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `${themeValues.accent}20`,
            },
          ]}
        >
          <Ionicons
            name={icon as any}
            size={48}
            color={themeValues.accent}
          />
        </View>

        <Text
          style={[
            styles.title,
            { color: themeValues.textPrimary },
          ]}
        >
          {title}
        </Text>

        <Text
          style={[
            styles.description,
            { color: themeValues.textSecondary },
          ]}
        >
          {description}
        </Text>

        {actionLabel && onAction && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              {
                backgroundColor: themeValues.accent,
              },
            ]}
            onPress={onAction}
            activeOpacity={0.8}
          >
            <Text style={styles.actionButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: componentDefaults.spacing.xl,
  },
  contentContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: componentDefaults.spacing.lg,
  },
  title: {
    fontSize: componentDefaults.fontSize.lg,
    fontWeight: '700',
    marginBottom: componentDefaults.spacing.sm,
    textAlign: 'center',
  },
  description: {
    fontSize: componentDefaults.fontSize.md,
    textAlign: 'center',
    marginBottom: componentDefaults.spacing.lg,
  },
  actionButton: {
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.md,
    borderRadius: componentDefaults.borderRadius.sm,
    marginTop: componentDefaults.spacing.md,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: componentDefaults.fontSize.md,
  },
});
