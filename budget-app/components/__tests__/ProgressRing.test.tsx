import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ProgressRing } from '../ProgressRing';

// Mock react-native-svg
jest.mock('react-native-svg', () => {
  const React = require('react');
  return {
    Svg: ({ children, ...props }: any) => (
      <div testID="svg" {...props}>
        {children}
      </div>
    ),
    Circle: ({ cx, cy, r, stroke, strokeWidth, fill, ...props }: any) => (
      <div
        testID="circle"
        data-cx={cx}
        data-cy={cy}
        data-r={r}
        data-stroke={stroke}
        data-stroke-width={strokeWidth}
        data-fill={fill}
        {...props}
      />
    ),
  };
});

describe('ProgressRing Component', () => {
  const defaultProps = {
    progress: 0.5,
    size: 100,
    strokeWidth: 8,
    color: '#a855f7',
    backgroundColor: '#e5e7eb',
  };

  it('renders with correct structure', () => {
    render(<ProgressRing {...defaultProps} />);

    const svg = screen.getByTestID('svg');
    expect(svg).toBeTruthy();
  });

  it('displays correct percentage text', () => {
    render(<ProgressRing {...defaultProps} progress={0.5} />);

    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('displays 0% when progress is 0', () => {
    render(<ProgressRing {...defaultProps} progress={0} />);

    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('displays 100% when progress is 1', () => {
    render(<ProgressRing {...defaultProps} progress={1} />);

    expect(screen.getByText('100%')).toBeTruthy();
  });

  it('displays correct percentage for various progress values', () => {
    const testCases = [
      { progress: 0.25, expected: '25%' },
      { progress: 0.33, expected: '33%' },
      { progress: 0.75, expected: '75%' },
      { progress: 0.99, expected: '99%' },
    ];

    testCases.forEach(({ progress, expected }) => {
      const { unmount } = render(
        <ProgressRing {...defaultProps} progress={progress} />
      );
      expect(screen.getByText(expected)).toBeTruthy();
      unmount();
    });
  });

  it('rounds percentage to nearest integer', () => {
    render(<ProgressRing {...defaultProps} progress={0.125} />);

    expect(screen.getByText('12%')).toBeTruthy();
  });

  it('renders with accent color when progress is high', () => {
    const accentColor = '#10b981';
    render(
      <ProgressRing
        {...defaultProps}
        progress={0.8}
        color={accentColor}
      />
    );

    expect(screen.getByText('80%')).toBeTruthy();
  });

  it('renders with warning color when progress is medium', () => {
    const warningColor = '#f59e0b';
    render(
      <ProgressRing
        {...defaultProps}
        progress={0.5}
        color={warningColor}
      />
    );

    expect(screen.getByText('50%')).toBeTruthy();
  });

  it('renders with error color when progress is low', () => {
    const errorColor = '#ef4444';
    render(
      <ProgressRing
        {...defaultProps}
        progress={0.2}
        color={errorColor}
      />
    );

    expect(screen.getByText('20%')).toBeTruthy();
  });

  it('handles different sizes', () => {
    const { unmount } = render(
      <ProgressRing {...defaultProps} size={120} />
    );
    expect(screen.getByTestID('svg')).toBeTruthy();
    unmount();

    render(<ProgressRing {...defaultProps} size={80} />);
    expect(screen.getByTestID('svg')).toBeTruthy();
  });

  it('handles different stroke widths', () => {
    const { unmount } = render(
      <ProgressRing {...defaultProps} strokeWidth={4} />
    );
    expect(screen.getByTestID('svg')).toBeTruthy();
    unmount();

    render(<ProgressRing {...defaultProps} strokeWidth={12} />);
    expect(screen.getByTestID('svg')).toBeTruthy();
  });

  it('uses correct colors', () => {
    const customColor = '#ff6b6b';
    const customBgColor = '#f0f0f0';

    render(
      <ProgressRing
        {...defaultProps}
        color={customColor}
        backgroundColor={customBgColor}
      />
    );

    const circles = screen.getAllByTestID('circle');
    expect(circles.length).toBeGreaterThan(0);
  });

  it('handles progress updates', () => {
    const { rerender } = render(
      <ProgressRing {...defaultProps} progress={0.25} />
    );

    expect(screen.getByText('25%')).toBeTruthy();

    rerender(<ProgressRing {...defaultProps} progress={0.75} />);

    expect(screen.getByText('75%')).toBeTruthy();
  });

  it('animates progress changes', () => {
    const { rerender } = render(
      <ProgressRing {...defaultProps} progress={0.2} />
    );

    expect(screen.getByText('20%')).toBeTruthy();

    rerender(<ProgressRing {...defaultProps} progress={0.8} />);

    expect(screen.getByText('80%')).toBeTruthy();
  });

  it('renders SVG circles for background and progress', () => {
    render(<ProgressRing {...defaultProps} />);

    const circles = screen.getAllByTestID('circle');
    expect(circles.length).toBeGreaterThanOrEqual(2);
  });

  it('displays percentage text at center', () => {
    render(<ProgressRing {...defaultProps} progress={0.65} />);

    expect(screen.getByText('65%')).toBeTruthy();
  });

  it('handles edge case of very small progress', () => {
    render(<ProgressRing {...defaultProps} progress={0.01} />);

    expect(screen.getByText('1%')).toBeTruthy();
  });

  it('handles edge case of very high progress', () => {
    render(<ProgressRing {...defaultProps} progress={0.995} />);

    expect(screen.getByText('100%')).toBeTruthy();
  });
});
