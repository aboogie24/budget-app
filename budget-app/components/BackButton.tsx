import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';

type BackButtonProps = {
  /**
   * Where to go when there's no navigation history (deep links, tab roots
   * reached directly, etc.). If omitted, the button hides itself when
   * `router.canGoBack()` is false instead of risking a no-op tap.
   */
  fallback?: Href;
  /** Override the icon — defaults to "arrow-back". */
  iconName?: React.ComponentProps<typeof Ionicons>['name'];
  /** Override the icon color — defaults to a high-contrast off-white. */
  color?: string;
  /** Override the icon size — defaults to 22. */
  size?: number;
  /** Style override for the touch target. */
  style?: StyleProp<ViewStyle>;
  /**
   * Run a custom handler instead of navigating. When provided, both `fallback`
   * and `router.back()` are ignored — caller is fully responsible for
   * navigation. Used for cases like "save then close".
   */
  onPress?: () => void;
};

/**
 * Standard back button. Always prefers `router.back()` when there's history;
 * falls back to the provided destination otherwise. When neither history nor
 * fallback are available, the button renders nothing rather than appearing
 * dead.
 */
export function BackButton({
  fallback,
  iconName = 'arrow-back',
  color = '#e5e7eb',
  size = 22,
  style,
  onPress,
}: BackButtonProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    // Prefer the declared fallback (canonical parent) over router.back().
    // The app root uses <Slot/> with a Tabs group, which means tab switches
    // don't add stack entries — so router.back() can pop past the screen the
    // user actually came from (e.g. Finance→Bills, back, lands on Home).
    //
    // For tab destinations specifically, router.replace() can leave the tabs
    // navigator showing the wrong (initial/default) tab. router.navigate()
    // properly activates the targeted tab.
    if (fallback !== undefined) {
      const fallbackStr = typeof fallback === 'string' ? fallback : '';
      if (fallbackStr.startsWith('/(tabs)/')) {
        router.navigate(fallback);
      } else {
        router.replace(fallback);
      }
      return;
    }
    if (router.canGoBack()) {
      router.back();
    }
  };

  // When there's no history and no fallback, don't render a dead button.
  if (!onPress && fallback === undefined && !router.canGoBack()) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={[styles.button, style]}
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      activeOpacity={0.7}
    >
      <Ionicons name={iconName} size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BackButton;
