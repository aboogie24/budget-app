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
import { colors, spacing, typography } from '@/utils/design-system';
import { lightHaptic } from '@/utils/haptics';
import { formTokens } from './formTokens';

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
 * Bottom-sheet form wrapper (C033 v2): frosted surface, 28px top radius,
 * thin grabber, sticky CTA footer. Mount from module scope so TextInputs
 * keep identity across re-renders.
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
            <View style={styles.grabber} accessibilityElementsHidden />
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
              contentContainerStyle={{ paddingBottom: spacing.lg, gap: 2 }}
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
    backgroundColor: formTokens.surface,
    borderTopLeftRadius: formTokens.radiusSheet,
    borderTopRightRadius: formTokens.radiusSheet,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: spacing.md,
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
    fontWeight: '700',
    flex: 1,
    paddingRight: spacing.sm,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: formTokens.radiusPill,
    backgroundColor: formTokens.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: formTokens.hairline,
    gap: spacing.sm,
  },
});

export default FormSheet;
