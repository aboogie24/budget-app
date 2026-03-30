import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { EmptyState } from '../EmptyState';

// Mock the theme context
jest.mock('@/utils/ThemeContext', () => ({
  useTheme: () => ({
    themeValues: {
      accent: '#a855f7',
      textPrimary: '#1f2937',
      textSecondary: '#6b7280',
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

describe('EmptyState Component', () => {
  const defaultProps = {
    icon: 'inbox-outline',
    title: 'No Items',
    description: 'You have no items yet. Create one to get started.',
  };

  it('renders title and description', () => {
    render(<EmptyState {...defaultProps} />);

    expect(screen.getByText('No Items')).toBeTruthy();
    expect(screen.getByText('You have no items yet. Create one to get started.')).toBeTruthy();
  });

  it('renders with correct icon', () => {
    render(<EmptyState {...defaultProps} icon="cart-outline" />);

    const icon = screen.getByTestID('icon-cart-outline');
    expect(icon).toBeTruthy();
  });

  it('renders action button when actionLabel and onAction are provided', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        {...defaultProps}
        actionLabel="Create Item"
        onAction={onAction}
      />
    );

    const button = screen.getByText('Create Item');
    expect(button).toBeTruthy();
  });

  it('does not render action button when actionLabel is not provided', () => {
    render(<EmptyState {...defaultProps} />);

    expect(screen.queryByText('Create Item')).toBeNull();
  });

  it('calls onAction when action button is pressed', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        {...defaultProps}
        actionLabel="Add New"
        onAction={onAction}
      />
    );

    const button = screen.getByText('Add New');
    fireEvent.press(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when actionLabel is provided but onAction is missing', () => {
    render(<EmptyState {...defaultProps} actionLabel="Create Item" />);

    expect(screen.queryByText('Create Item')).toBeNull();
  });

  it('renders GlassCard wrapper', () => {
    render(<EmptyState {...defaultProps} />);

    const glassCard = screen.getByTestID('glass-card');
    expect(glassCard).toBeTruthy();
  });

  it('renders with different icons', () => {
    render(<EmptyState {...defaultProps} icon="heart-outline" />);
    expect(screen.getByTestID('icon-heart-outline')).toBeTruthy();

    const { unmount } = render(
      <EmptyState {...defaultProps} icon="star-outline" />
    );
    expect(screen.getByTestID('icon-star-outline')).toBeTruthy();
    unmount();
  });

  it('handles long descriptions', () => {
    const longDescription = 'This is a very long description that should wrap properly without any issues. It contains multiple sentences and should still render correctly in the empty state component.';

    render(
      <EmptyState
        {...defaultProps}
        description={longDescription}
      />
    );

    expect(screen.getByText(longDescription)).toBeTruthy();
  });

  it('allows multiple action button presses', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        {...defaultProps}
        actionLabel="Try Again"
        onAction={onAction}
      />
    );

    const button = screen.getByText('Try Again');
    fireEvent.press(button);
    fireEvent.press(button);
    fireEvent.press(button);

    expect(onAction).toHaveBeenCalledTimes(3);
  });
});
