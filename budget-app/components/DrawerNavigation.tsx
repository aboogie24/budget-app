import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ScrollView, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/utils/ThemeContext';
import { componentDefaults } from '@/utils/theme';
import GlassCard from './GlassCard';

interface DrawerItem {
  id: string;
  icon: string;
  label: string;
  onPress: () => void;
}

interface DrawerNavigationProps {
  isOpen: boolean;
  onClose: () => void;
  items: DrawerItem[];
}

export const DrawerNavigation: React.FC<DrawerNavigationProps> = ({
  isOpen,
  onClose,
  items,
}) => {
  const { themeValues, theme, toggleTheme } = useTheme();
  const slideAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen, slideAnim]);

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [400, 0],
  });

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <TouchableOpacity
          style={[
            styles.overlay,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
            },
          ]}
          onPress={onClose}
          activeOpacity={1}
        />
      )}

      {/* Drawer */}
      <Animated.View
        style={[
          styles.drawer,
          {
            backgroundColor: themeValues.bgGradient[0],
            transform: [{ translateX }],
          },
        ]}
      >
        <GlassCard
          style={styles.drawerContent}
          intensity="light"
          padding={0}
        >
          {/* Header */}
          <View style={styles.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.drawerTitle, { color: themeValues.textPrimary }]}>
                Menu
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={themeValues.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Menu Items */}
          <ScrollView
            style={styles.menuItems}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ gap: componentDefaults.spacing.xs }}
          >
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  {
                    backgroundColor: themeValues.glassLight.backgroundColor,
                  },
                ]}
                onPress={() => {
                  item.onPress();
                  onClose();
                }}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={item.icon as any}
                  size={20}
                  color={themeValues.accent}
                  style={{ marginRight: componentDefaults.spacing.md }}
                />
                <Text
                  style={[
                    styles.menuItemText,
                    { color: themeValues.textPrimary },
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Theme Toggle */}
          <View style={styles.drawerFooter}>
            <TouchableOpacity
              style={[
                styles.themeToggle,
                {
                  backgroundColor: themeValues.glassLight.backgroundColor,
                  borderColor: themeValues.glassLight.borderColor,
                  borderWidth: 1,
                },
              ]}
              onPress={toggleTheme}
              activeOpacity={0.7}
            >
              <Ionicons
                name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'}
                size={18}
                color={themeValues.accent}
                style={{ marginRight: componentDefaults.spacing.sm }}
              />
              <Text
                style={[
                  styles.themeToggleText,
                  { color: themeValues.textPrimary },
                ]}
              >
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </Text>
            </TouchableOpacity>
          </View>
        </GlassCard>
      </Animated.View>
    </>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 40,
  },
  drawer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: '75%',
    maxWidth: 300,
    zIndex: 50,
  },
  drawerContent: {
    flex: 1,
    borderRadius: 0,
    padding: 0,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  drawerTitle: {
    fontSize: componentDefaults.fontSize.lg,
    fontWeight: '700',
  },
  menuItems: {
    flex: 1,
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: componentDefaults.spacing.md,
    paddingVertical: componentDefaults.spacing.md,
    borderRadius: componentDefaults.borderRadius.sm,
  },
  menuItemText: {
    fontSize: componentDefaults.fontSize.md,
    fontWeight: '600',
  },
  drawerFooter: {
    paddingHorizontal: componentDefaults.spacing.lg,
    paddingVertical: componentDefaults.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  themeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: componentDefaults.spacing.md,
    paddingVertical: componentDefaults.spacing.md,
    borderRadius: componentDefaults.borderRadius.sm,
  },
  themeToggleText: {
    fontSize: componentDefaults.fontSize.sm,
    fontWeight: '600',
  },
});
