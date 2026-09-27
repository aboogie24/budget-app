import React, { Children, isValidElement } from 'react';
import { View, StyleSheet } from 'react-native';
import { formTokens } from './formTokens';

type Props = {
  children: React.ReactNode;
};

/** Soft panel that stacks flat picker/switch rows with hairline separators (C033 v2). */
export function FormGroup({ children }: Props) {
  const items = Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.panel}>
      {items.map((child, i) => (
        <View key={isValidElement(child) && child.key != null ? String(child.key) : i}>
          {i > 0 ? <View style={styles.sep} /> : null}
          {child}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: formTokens.surfaceRaised,
    borderRadius: formTokens.radiusField,
    overflow: 'hidden',
  },
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: formTokens.hairline,
    marginLeft: 16,
  },
});

export default FormGroup;
