import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { componentDefaults } from '@/utils/theme';
import GlassCard from './GlassCard';

interface QuickAction {
  id: string;
  icon: string;
  label: string;
  color: string;
  onPress: () => void;
}

interface FloatingActionButtonProps {
  onPress?: () => void;
  actions?: QuickAction[];
}

export const FloatingActionButton: React.FC<FloatingActionButtonProps> = ({
  onPress,
  actions,
}) => {
  const { themeValues, theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const scaleAnim = React.useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    if (actions && actions.length > 0) {
      setIsOpen(!isOpen);
      Animated.spring(scaleAnim, {
        toValue: isOpen ? 0 : 1,
        useNativeDriver: true,
      }).start();
    } else if (onPress) {
      onPress();
    }
  };

  const handleActionPress = (action: QuickAction) => {
    action.onPress();
    setIsOpen(false);
    Animated.spring(scaleAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  return (
    <>
      {/* Overlay backdrop */}
      {isOpen && (
        <TouchableOpacity
          style={styles.overlay}
          onPress={() => {
            setIsOpen(false);
            Animated.spring(scaleAnim, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }}
          activeOpacity={1}
        />
      )}

      {/* Quick action menu */}
      {isOpen && actions && actions.length > 0 && (
        <Animated.View
          style={[
            styles.actionMenuContainer,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.actionGrid}>
            {actions.map((action) => (
              <TouchableOpacity
                key={action.id}
                style={styles.actionItem}
                onPress={() => handleActionPress(action)}
                activeOpacity={0.7}
              >
                <GlassCard intensity="light" padding={12}>
                  <View style={{ alignItems: 'center', gap: 8 }}>
                    <View
                      style={[
                        styles.actionIconContainer,
                        { backgroundColor: action.color },
                      ]}
                    >
                      <Ionicons name={action.icon as any} size={20} color="#ffffff" />
                    </View>
                    <Text style={[styles.actionLabel, { color: themeValues.textPrimary }]}>
                      {action.label}
                    </Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      )}

      {/* Main FAB button */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: themeValues.accent,
            shadowColor: themeValues.accent,
          },
        ]}
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isOpen ? 'close' : 'add'}
          size={22}
          color="#ffffff"
          style={{ fontWeight: '700' }}
        />
      </TouchableOpacity>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 12,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
    zIndex: 100,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    zIndex: 50,
  },
  actionMenuContainer: {
    position: 'absolute',
    bottom: 72,
    right: 20,
    zIndex: 99,
  },
  actionGrid: {
    gap: 8,
    alignItems: 'flex-end',
    width: 180,
  },
  actionItem: {
    width: '100%',
  },
  actionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: componentDefaults.fontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
});
