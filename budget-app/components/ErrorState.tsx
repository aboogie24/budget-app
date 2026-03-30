import React from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { componentDefaults } from '@/utils/theme';
import { GlassCard } from './GlassCard';

interface ErrorStateProps {
  title: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
  dismissLabel?: string;
  onDismiss?: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  retryLabel = 'Try Again',
  onRetry,
  dismissLabel = 'Dismiss',
  onDismiss,
}) => {
  const { themeValues } = useTheme();

  return (
    <GlassCard
      variant="light"
      style={styles.container}
      padding={componentDefaults.spacing.lg}
    >
      <View style={styles.contentContainer}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor: `#ef444420`,
            },
          ]}
        >
          <Ionicons
            name="alert-circle-outline"
            size={40}
            color="#ef4444"
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
            styles.message,
            { color: themeValues.textSecondary },
          ]}
        >
          {message}
        </Text>

        <View style={styles.buttonContainer}>
          {onRetry && (
            <TouchableOpacity
              style={[
                styles.retryButton,
                {
                  backgroundColor: themeValues.accent,
                },
              ]}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color="#ffffff"
                style={{ marginRight: componentDefaults.spacing.sm }}
              />
              <Text style={styles.retryButtonText}>{retryLabel}</Text>
            </TouchableOpacity>
          )}

          {onDismiss && (
            <TouchableOpacity
              style={[
                styles.dismissButton,
                {
                  backgroundColor: themeValues.glassLight.backgroundColor,
                  borderColor: themeValues.glassLight.borderColor,
                  borderWidth: 1,
                },
              ]}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dismissButtonText,
                  { color: themeValues.textPrimary },
                ]}
              >
                {dismissLabel}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: componentDefaults.spacing.lg,
  },
  contentContainer: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: componentDefaults.spacing.md,
  },
  title: {
    fontSize: componentDefaults.fontSize.lg,
    fontWeight: '700',
    marginBottom: componentDefaults.spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: componentDefaults.fontSize.md,
    textAlign: 'center',
    marginBottom: componentDefaults.spacing.lg,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: componentDefaults.spacing.md,
    width: '100%',
    justifyContent: 'center',
  },
  retryButton: {
    flexDirection: 'row',
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.md,
    borderRadius: componentDefaults.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  retryButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: componentDefaults.fontSize.md,
  },
  dismissButton: {
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.md,
    borderRadius: componentDefaults.borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  dismissButtonText: {
    fontWeight: '600',
    fontSize: componentDefaults.fontSize.md,
  },
});
