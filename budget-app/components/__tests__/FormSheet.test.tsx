import React from 'react';
import { Text } from 'react-native';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { FormSheet } from '../form/FormSheet';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => {
    const { Text } = require('react-native');
    return <Text testID={`icon-${name}`}>{name}</Text>;
  },
}));

jest.mock('@/utils/haptics', () => ({
  lightHaptic: jest.fn(),
}));

describe('FormSheet', () => {
  it('renders title, body, and footer when visible', () => {
    render(
      <FormSheet visible title="Edit Bill" onClose={() => {}} footer={<Text>Footer CTA</Text>}>
        <Text>Body content</Text>
      </FormSheet>,
    );

    expect(screen.getByText('Edit Bill')).toBeTruthy();
    expect(screen.getByText('Body content')).toBeTruthy();
    expect(screen.getByText('Footer CTA')).toBeTruthy();
  });

  it('renders nothing when not visible', () => {
    render(
      <FormSheet visible={false} title="Hidden" onClose={() => {}}>
        <Text>Body</Text>
      </FormSheet>,
    );

    expect(screen.queryByText('Hidden')).toBeNull();
    expect(screen.queryByText('Body')).toBeNull();
  });

  it('calls onClose from the close button', () => {
    const onClose = jest.fn();
    render(
      <FormSheet visible title="Sheet" onClose={onClose}>
        <Text>Body</Text>
      </FormSheet>,
    );

    fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when the backdrop is tapped', () => {
    const onClose = jest.fn();
    render(
      <FormSheet visible title="Sheet" onClose={onClose}>
        <Text>Body</Text>
      </FormSheet>,
    );

    fireEvent.press(screen.getByLabelText('Dismiss form'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('omits the footer slot when no footer is passed', () => {
    render(
      <FormSheet visible title="Sheet" onClose={() => {}}>
        <Text>Body</Text>
      </FormSheet>,
    );

    expect(screen.queryByText('Footer CTA')).toBeNull();
  });
});
