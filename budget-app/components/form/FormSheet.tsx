import React from 'react';
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  /** Rendered below the ScrollView, pinned above the keyboard (usually FormButtons). */
  footer?: React.ReactNode;
  maxHeightPct?: number;
};

/**
 * Shared bottom-sheet form wrapper: dark backdrop, glass sheet with pinned
 * header (title + close), keyboard-avoiding scrollable body, and a sticky
 * footer slot. Consumers MUST render this from module scope (not a component
 * defined inside a screen's render) so TextInput children keep a stable
 * identity across re-renders — otherwise the keyboard dismisses per keystroke.
 */
export function FormSheet({ visible, title, onClose, children, footer, maxHeightPct = 0.85 }: Props) {
  const handleClose = () => {
    lightHaptic();
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.backdrop}>
          <Pressable style={{ flex: 1 }} onPress={handleClose} accessibilityLabel="Dismiss form" />
          <View style={[styles.sheet, { maxHeight: Dimensions.get('window').height * maxHeightPct }]}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity
                onPress={handleClose}
                style={styles.closeBtn}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Ionicons name="close" size={18} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: spacing.lg }}
            >
              {children}
            </ScrollView>
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surfaceDark,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderGlass,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    color: colors.text,
    ...typography.h3,
    fontWeight: '800',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.glassMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    gap: spacing.sm,
  },
});

export default FormSheet;
