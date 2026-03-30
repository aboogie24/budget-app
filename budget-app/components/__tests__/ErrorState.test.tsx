import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ErrorState } from '../ErrorState';

// Mock the theme context
jest.mock('@/utils/ThemeContext', () => ({
  useTheme: () => ({
    themeValues: {
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
      accent: '#a855f7',
      glassLight: {
        backgroundColor: 'rgba(255, 255, 255, 0.4)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
      },
    },
  }),
}));

// Mock GlassCard component
jest.mock('../GlassCard', () => ({
  GlassCard: ({ children, ...props }: any) => (
    <div testID="glass-card" {...props}>
      {children}
    </div>
  ),
}));

// Mock Ionicons
jest.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name, size, color }: any) => (
    <div testID={`icon-${name}`} data-size={size} data-color={color}>
      {name}
    </div>
  ),
}));

describe('ErrorState Component', () => {
  const defaultProps = {
    title: 'Something went wrong',
    message: 'Please try again later.',
  };

  it('renders error title and message', () => {
    render(<ErrorState {...defaultProps} />);

    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByText('Please try again later.')).toBeTruthy();
  });

  it('renders error icon', () => {
    render(<ErrorState {...defaultProps} />);

    const icon = screen.getByTestID('icon-alert-circle-outline');
    expect(icon).toBeTruthy();
  });

  it('renders retry button with default label when onRetry is provided', () => {
    const onRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={onRetry} />);

    const button = screen.getByText('Try Again');
    expect(button).toBeTruthy();
  });

  it('renders retry button with custom label', () => {
    const onRetry = jest.fn();
    render(
      <ErrorState
        {...defaultProps}
        retryLabel="Retry Now"
        onRetry={onRetry}
      />
    );

    expect(screen.getByText('Retry Now')).toBeTruthy();
  });

  it('calls onRetry when retry button is pressed', () => {
    const onRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={onRetry} />);

    const button = screen.getByText('Try Again');
    fireEvent.press(button);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders dismiss button with default label when onDismiss is provided', () => {
    const onDismiss = jest.fn();
    render(<ErrorState {...defaultProps} onDismiss={onDismiss} />);

    const button = screen.getByText('Dismiss');
    expect(button).toBeTruthy();
  });

  it('renders dismiss button with custom label', () => {
    const onDismiss = jest.fn();
    render(
      <ErrorState
        {...defaultProps}
        dismissLabel="Close"
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('calls onDismiss when dismiss button is pressed', () => {
    const onDismiss = jest.fn();
    render(<ErrorState {...defaultProps} onDismiss={onDismiss} />);

    const button = screen.getByText('Dismiss');
    fireEvent.press(button);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders both retry and dismiss buttons when both handlers are provided', () => {
    const onRetry = jest.fn();
    const onDismiss = jest.fn();
    render(
      <ErrorState
        {...defaultProps}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    );

    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.getByText('Dismiss')).toBeTruthy();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState {...defaultProps} />);

    expect(screen.queryByText('Try Again')).toBeNull();
  });

  it('does not render dismiss button when onDismiss is not provided', () => {
    const onRetry = jest.fn();
    render(<ErrorState {...defaultProps} onRetry={onRetry} />);

    expect(screen.queryByText('Dismiss')).toBeNull();
  });

  it('renders GlassCard wrapper', () => {
    render(<ErrorState {...defaultProps} />);

    const glassCard = screen.getByTestID('glass-card');
    expect(glassCard).toBeTruthy();
  });

  it('handles long error messages', () => {
    const longMessage = 'This is a very long error message that describes in detail what went wrong. It may contain multiple sentences explaining the error condition and what the user should do to resolve it.';

    render(
      <ErrorState
        {...defaultProps}
        message={longMessage}
      />
    );

    expect(screen.getByText(longMessage)).toBeTruthy();
  });

  it('handles multiple button presses', () => {
    const onRetry = jest.fn();
    const onDismiss = jest.fn();

    render(
      <ErrorState
        {...defaultProps}
        onRetry={onRetry}
        onDismiss={onDismiss}
      />
    );

    const retryButton = screen.getByText('Try Again');
    const dismissButton = screen.getByText('Dismiss');

    fireEvent.press(retryButton);
    fireEvent.press(retryButton);
    fireEvent.press(dismissButton);

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders only with retry action', () => {
    const onRetry = jest.fn();
    const { unmount } = render(
      <ErrorState {...defaultProps} onRetry={onRetry} />
    );

    expect(screen.getByText('Try Again')).toBeTruthy();
    expect(screen.queryByText('Dismiss')).toBeNull();
    unmount();
  });

  it('renders only with dismiss action', () => {
    const onDismiss = jest.fn();
    const { unmount } = render(
      <ErrorState {...defaultProps} onDismiss={onDismiss} />
    );

    expect(screen.queryByText('Try Again')).toBeNull();
    expect(screen.getByText('Dismiss')).toBeTruthy();
    unmount();
  });
});
