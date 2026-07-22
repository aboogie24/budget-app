import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormChips } from '../form/FormChips';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

jest.mock('@/utils/haptics', () => ({
  lightHaptic: jest.fn(),
}));

const OPTIONS = [
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

describe('FormChips', () => {
  it('renders every option', () => {
    render(<FormChips options={OPTIONS} value="weekly" onChange={() => {}} />);
    expect(screen.getByText('Weekly')).toBeTruthy();
    expect(screen.getByText('Monthly')).toBeTruthy();
  });

  it('marks the selected option checked', () => {
    render(<FormChips options={OPTIONS} value="monthly" onChange={() => {}} />);
    expect(screen.getByLabelText('Monthly').props.accessibilityState.checked).toBe(true);
    expect(screen.getByLabelText('Weekly').props.accessibilityState.checked).toBe(false);
  });

  it('fires onChange with the tapped value and a haptic tick', () => {
    const onChange = jest.fn();
    const { lightHaptic } = require('@/utils/haptics');
    render(<FormChips options={OPTIONS} value="weekly" onChange={onChange} />);

    fireEvent.press(screen.getByText('Monthly'));
    expect(onChange).toHaveBeenCalledWith('monthly');
    expect(lightHaptic).toHaveBeenCalled();
  });

  it('renders option icons when provided', () => {
    render(
      <FormChips
        options={[{ value: 'x' as const, label: 'X', icon: 'flash-outline' as any }]}
        value="x"
        onChange={() => {}}
      />,
    );
    expect(screen.getByTestId('icon-flash-outline')).toBeTruthy();
  });
});
