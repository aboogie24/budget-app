import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BackButton } from '@/components/BackButton';
import { colors, spacing, radius, typography, gradients } from '@/utils/design-system';
import { METHOD_LEVELS } from '@/utils/onboarding';
import { styles } from './onboardingStyles';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export function OnboardingProgressRail({
  totalSteps,
  currentStep,
}: {
  totalSteps: number;
  currentStep: number;
}) {
  return (
    <View
      style={styles.rail}
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${currentStep + 1} of ${totalSteps}`}
      accessibilityValue={{ min: 1, max: totalSteps, now: currentStep + 1 }}
    >
      {Array.from({ length: totalSteps }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.railSeg,
            { backgroundColor: i <= currentStep ? colors.primary : colors.glassLight },
          ]}
        />
      ))}
    </View>
  );
}

export function OnboardingHeader({
  title,
  onBack,
  onSkip,
  showBack,
}: {
  title: string;
  onBack: () => void;
  onSkip?: () => void;
  showBack: boolean;
}) {
  return (
    <View style={styles.header}>
      <View style={styles.headerSide}>
        {showBack ? <BackButton onPress={onBack} /> : <View style={styles.headerSpacer} />}
      </View>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.headerSide, styles.headerSideRight]}>
        {onSkip ? (
          <TouchableOpacity
            onPress={onSkip}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
          >
            <Text style={styles.skipHeaderText}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>
    </View>
  );
}

export function OnboardingPrimaryCta({
  label,
  onPress,
  loading,
  disabled,
  loadingLabel,
  iconLeading,
  iconTrailing,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  loadingLabel?: string;
  iconLeading?: IoniconName;
  iconTrailing?: IoniconName;
}) {
  const isDisabled = disabled || loading;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[styles.ctaWrapper, isDisabled && !loading && styles.ctaDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
    >
      <LinearGradient
        colors={[...gradients.primaryGradient]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.cta}
      >
        {loading ? (
          <>
            <ActivityIndicator color={colors.text} />
            {loadingLabel ? <Text style={styles.ctaText}>{loadingLabel}</Text> : null}
          </>
        ) : (
          <>
            {iconLeading ? <Ionicons name={iconLeading} size={18} color={colors.text} /> : null}
            <Text style={styles.ctaText}>{label}</Text>
            {iconTrailing ? <Ionicons name={iconTrailing} size={18} color={colors.text} /> : null}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

export function OnboardingGhostCta({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghostCta, disabled && styles.ctaDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.ghostCtaText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function OnboardingStatusPill({ label }: { label: string }) {
  return (
    <View style={styles.statusPill} accessibilityRole="text" accessibilityLabel={label} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle" size={20} color={colors.success} />
      <Text style={styles.statusPillText}>{label}</Text>
    </View>
  );
}

export function OnboardingNoticeCard({
  message,
  onRetry,
  retryLabel = 'Retry',
  tone = 'warning',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  tone?: 'warning' | 'error' | 'info' | 'success';
}) {
  const toneColor =
    tone === 'error'
      ? colors.error
      : tone === 'success'
      ? colors.success
      : tone === 'info'
      ? colors.info
      : colors.warning;
  return (
    <View style={styles.noticeCard} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={20} color={toneColor} />
      <Text style={styles.noticeText}>{message}</Text>
      {onRetry ? (
        <TouchableOpacity onPress={onRetry} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel={retryLabel}>
          <Text style={styles.noticeRetry}>{retryLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export function OnboardingField({
  label,
  value,
  onChangeText,
  placeholder,
  editable = true,
  keyboardType = 'email-address',
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  editable?: boolean;
  keyboardType?: 'email-address' | 'decimal-pad' | 'default';
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          { borderColor: focused ? colors.primary2 : colors.borderGlass },
          !editable && styles.fieldInputDisabled,
        ]}
        placeholder={placeholder}
        placeholderTextColor={colors.textDark}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        accessibilityLabel={label}
      />
    </View>
  );
}

export function OnboardingRoadmap() {
  return (
    <View style={styles.roadmapCard} accessibilityRole="list">
      {METHOD_LEVELS.map((level, index) => (
        <View key={level.title} style={styles.roadmapItem} accessibilityLabel={`${level.title}: ${level.description}`}>
          <View style={styles.roadmapLeft}>
            <View style={[styles.levelChip, { backgroundColor: `${colors.primary2}33` }]}>
              <Ionicons name={level.icon} size={20} color={colors.primary2} />
            </View>
            {index < METHOD_LEVELS.length - 1 && <View style={styles.connector} />}
          </View>
          <View style={styles.roadmapRight}>
            <Text style={styles.levelTitle}>{level.title}</Text>
            <Text style={styles.levelDesc} numberOfLines={2}>
              {level.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

export function WelcomeOrbs() {
  return (
    <View style={styles.orbsContainer} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={[styles.orb, { backgroundColor: `${colors.primary2}2e`, left: 0 }]} />
      <View style={[styles.orb, { backgroundColor: `${colors.info}2e`, right: 0 }]} />
    </View>
  );
}
