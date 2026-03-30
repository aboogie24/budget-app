# CoupleFlow Design System

A centralized, glassmorphic design system for the CoupleFlow budget app, aligned with the coupleflow-prototype.jsx vision.

## Overview

The design system provides:
- **Color palette** with semantic colors (success, error, warning, info)
- **Glassmorphic effects** (glass cards, blur effects, transparent surfaces)
- **Gradient definitions** for backgrounds and accents
- **Typography scales** for headings, body, and captions
- **Spacing & radius** utilities for consistent layout
- **Reusable components** (GlassCard, GradientBackground)

## Quick Start

### 1. Import the design system

```typescript
import { colors, glassEffects, spacing, typography } from '@/utils/design-system';
import GlassCard from '@/components/GlassCard';
import GradientBackground from '@/components/GradientBackground';
```

### 2. Use in a screen

```tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GradientBackground from '@/components/GradientBackground';
import GlassCard from '@/components/GlassCard';
import { colors, spacing, typography } from '@/utils/design-system';

export default function ExampleScreen() {
  return (
    <GradientBackground variant="bgDark">
      <SafeAreaView style={{ flex: 1 }}>
        <View style={{ padding: spacing.lg }}>
          <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.xl }]}>
            Welcome
          </Text>

          <GlassCard intensity="medium" padding={spacing.lg}>
            <Text style={[typography.body, { color: colors.text }]}>
              This is a glass card with the design system styling
            </Text>
          </GlassCard>
        </View>
      </SafeAreaView>
    </GradientBackground>
  );
}
```

## Components

### GlassCard

A reusable glassmorphic card component.

**Props:**
- `intensity`: 'light' | 'medium' | 'strong' (default: 'light')
- `padding`: number (default: 16)
- `marginBottom`: number (default: 12)
- `style`: ViewStyle (optional)
- `onPress`: () => void (optional)

**Usage:**
```tsx
<GlassCard intensity="medium">
  <Text>Card content</Text>
</GlassCard>
```

### GradientBackground

A gradient background container using the design system's predefined gradients.

**Props:**
- `variant`: keyof gradients (default: 'bgDark')
- `colors`: string[] (optional, overrides variant)
- `start`: { x, y } (default: { x: 0, y: 0 })
- `end`: { x, y } (default: { x: 1, y: 1 })
- `style`: any (optional)

**Usage:**
```tsx
<GradientBackground variant="bgDarkPurple">
  {/* content */}
</GradientBackground>
```

## Color Palette

### Primary Colors
- `colors.primary` — #7c3aed (Purple, main brand color)
- `colors.primary2` — #a855f7 (Light purple, secondary)
- `colors.accent` — #c084fc (Lightest purple, accents)

### Backgrounds & Surfaces
- `colors.bg` — #0f172a (Dark navy background)
- `colors.surface` — #111827 (Card background)
- `colors.surface2` — #1e293b (Elevated surface)

### Text
- `colors.text` — #f8fafc (Primary text, white-ish)
- `colors.textMuted` — #94a3b8 (Secondary, gray)
- `colors.textDark` — #475569 (Tertiary, darker gray)

### Semantic
- `colors.success` — #22c55e (Green, positive/income)
- `colors.error` — #ef4444 (Red, negative/expense)
- `colors.warning` — #eab308 (Yellow)
- `colors.info` — #3b82f6 (Blue)

## Gradients

### Background Gradients
```typescript
gradients.bgDark        // Main dark background
gradients.bgDarkPurple  // Dark with purple tint
gradients.bgDeep        // Deepest dark background
```

### Accent Gradients
```typescript
gradients.primaryGradient  // Purple to violet
gradients.accentGradient   // Light purple to accent
gradients.vibrant          // Multi-color vibrant
```

### Semantic Gradients
```typescript
gradients.successGradient  // Green gradient
gradients.errorGradient    // Red gradient
gradients.infoGradient     // Blue gradient
```

## Glass Effects

### Available Intensities
```typescript
glassEffects.glass          // Light glass (subtle)
glassEffects.glassEnhanced  // Medium glass (visible)
glassEffects.glassStrong    // Strong glass (prominent)
glassEffects.glassFloating  // Glass with elevation/shadow
```

Each provides:
- Semi-transparent background
- Border with white accent
- Border radius (16px for standard, 20px for floating)

## Spacing Scale

```typescript
spacing.xs   // 4px
spacing.sm   // 8px
spacing.md   // 12px
spacing.lg   // 16px (default padding)
spacing.xl   // 24px
spacing.xxl  // 32px
spacing.xxxl // 48px
```

## Typography

### Headings
```typescript
typography.h1  // 32px, bold
typography.h2  // 28px, bold
typography.h3  // 24px, semi-bold
```

### Body
```typescript
typography.body      // 16px, regular
typography.bodyBold  // 16px, semi-bold
```

### Small Text
```typescript
typography.small      // 14px, regular
typography.smallBold  // 14px, semi-bold
```

### Captions & Buttons
```typescript
typography.caption  // 12px
typography.button   // 16px, semi-bold
```

## Utility Functions

### formatCurrency
```typescript
import { formatCurrency } from '@/utils/design-system';

formatCurrency(1234.56) // "$1234.56"
formatCurrency(1234)    // "$1234.00"
```

### getValueColor
```typescript
import { getValueColor } from '@/utils/design-system';

const color = getValueColor(150);    // colors.success (positive)
const color = getValueColor(-150);   // colors.error (negative)
```

### getSemanticColor
```typescript
import { getSemanticColor } from '@/utils/design-system';

getSemanticColor('success')  // colors.success
getSemanticColor('error')    // colors.error
getSemanticColor('warning')  // colors.warning
getSemanticColor('info')     // colors.info
```

## Best Practices

1. **Always use the design system colors** — Never hardcode color values
2. **Use GlassCard for all cards** — Ensures consistent glass effect
3. **Use GradientBackground for screens** — Provides consistent background
4. **Use spacing utilities** — For consistent padding/margins
5. **Use typography styles** — For consistent text sizing
6. **Reference the prototype** — Check coupleflow-prototype.jsx for visual guidance

## Migration Guide

Converting old screens to use the design system:

**Before:**
```tsx
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderColor: '#334155',
    borderWidth: 1,
  },
});

// In component:
<View style={styles.card}>
  <Text style={{ color: '#f8fafc', fontSize: 16 }}>Title</Text>
</View>
```

**After:**
```tsx
import GlassCard from '@/components/GlassCard';
import { colors, typography, spacing } from '@/utils/design-system';

// In component:
<GlassCard intensity="medium">
  <Text style={[typography.body, { color: colors.text }]}>Title</Text>
</GlassCard>
```

## Color Usage Examples

### Displaying Money
```tsx
// Income (green)
<Text style={{ color: getValueColor(income) }}>
  +{formatCurrency(income)}
</Text>

// Expense (red)
<Text style={{ color: getValueColor(-expense) }}>
  -{formatCurrency(expense)}
</Text>
```

### Status States
```tsx
// Success state
<GlassCard style={{ borderColor: colors.success, borderWidth: 2 }}>
  Success!
</GlassCard>

// Error state
<GlassCard style={{ borderColor: colors.error, borderWidth: 2 }}>
  Error!
</GlassCard>
```

## Testing/Verifying

The design system is TypeScript-compliant. Run:
```bash
cd budget-app && npx tsc --noEmit --skipLibCheck
```

Should compile without design-system-related errors.

---

**Last Updated:** 2026-03-29
**Status:** Task #50 Complete
