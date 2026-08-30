import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormButton } from '../form/FormButton';

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return { LinearGradient: ({ children, ...props }: any) => <View {...props}>{children}</View> };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

describe('FormButton', () => {
  it('renders the label and fires onPress', () => {
    const onPress = jest.fn();
    render(<FormButton label="Save Bill" onPress={onPress} />);

    fireEvent.press(screen.getByText('Save Bill'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire onPress when disabled', () => {
    const onPress = jest.fn();
    render(<FormButton label="Save" onPress={onPress} disabled />);

    fireEvent.press(screen.getByText('Save'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('blocks presses and shows a spinner while loading', () => {
    const onPress = jest.fn();
    render(<FormButton label="Saving" onPress={onPress} loading />);

    fireEvent.press(screen.getByText('Saving'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Saving').props.accessibilityState.busy).toBe(true);
  });

  it('renders destructive and secondary variants', () => {
    render(<FormButton label="Delete" onPress={() => {}} variant="destructive" />);
    expect(screen.getByText('Delete')).toBeTruthy();

    render(<FormButton label="Cancel" onPress={() => {}} variant="secondary" />);
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders a trailing icon when not loading', () => {
    render(<FormButton label="Next" onPress={() => {}} icon="arrow-forward" />);
    expect(screen.getByTestId('icon-arrow-forward')).toBeTruthy();
  });
});
