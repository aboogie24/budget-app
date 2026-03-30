# CoupleFlow Budget App - Testing Guide

This document outlines the testing infrastructure for the CoupleFlow budget application, including unit tests, component tests, and end-to-end tests.

## Overview

The project uses a multi-layered testing approach:

1. **Unit Tests**: Test utility functions and business logic
2. **Component Tests**: Test React components in isolation
3. **E2E Tests**: Test complete user journeys using Maestro

## Setup

### Install Dependencies

```bash
npm install
```

### Configure Jest

Jest configuration is defined in `jest.config.js` and includes:
- jest-expo preset for React Native testing
- Module path aliases (@/ prefix)
- Coverage collection setup
- Transform configuration for TypeScript/JSX

Jest setup file (`jest.setup.js`) includes:
- Testing library extensions
- AsyncStorage mock
- expo-haptics mock
- expo-router mock
- Platform mock

## Running Tests

### Unit & Component Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode (re-run on file changes):
```bash
npm run test:watch
```

Run specific test file:
```bash
npm test currency.test.ts
```

Run tests matching pattern:
```bash
npm test -- --testNamePattern="formatCurrency"
```

Generate coverage report:
```bash
npm run test:coverage
```

### End-to-End Tests

See `e2e/README.md` for detailed E2E testing instructions using Maestro.

Quick start:
```bash
maestro test e2e/maestro/flows/login.yaml
```

## Test Files Structure

### Utility Tests

Located in `utils/__tests__/`:

#### currency.test.ts
Tests currency formatting and conversion utilities:
- `formatCurrency()` - Format amounts with proper currency symbols and locales
- `getCurrencySymbol()` - Get symbol for currency code
- `getCurrencyName()` - Get full name for currency code
- `formatCurrencySimple()` - Simple symbol-prefixed formatting
- CURRENCIES array validation

**Run:**
```bash
npm test currency.test.ts
```

#### haptics.test.ts
Tests haptic feedback utilities:
- `lightHaptic()` - Light haptic impact
- `mediumHaptic()` - Medium haptic impact
- `successHaptic()` - Success notification feedback
- `errorHaptic()` - Error notification feedback
- Platform-specific behavior (iOS, Android, Web)

**Run:**
```bash
npm test haptics.test.ts
```

### Component Tests

Located in `components/__tests__/`:

#### EmptyState.test.tsx
Tests the EmptyState component:
- Renders title and description
- Renders icon
- Renders action button when provided
- Calls onAction callback
- Handles missing callbacks gracefully

**Run:**
```bash
npm test EmptyState.test.tsx
```

#### ErrorState.test.tsx
Tests the ErrorState component:
- Renders error title and message
- Renders error icon
- Renders retry button with callback
- Renders dismiss button with callback
- Handles both buttons simultaneously
- Proper button labeling

**Run:**
```bash
npm test ErrorState.test.tsx
```

#### ProgressRing.test.tsx
Tests the ProgressRing component:
- Renders SVG structure
- Displays correct percentage text
- Handles edge cases (0%, 100%)
- Rounds percentage correctly
- Uses correct colors
- Animates progress changes
- Handles different sizes and stroke widths

**Run:**
```bash
npm test ProgressRing.test.tsx
```

## Test Examples

### Unit Test Example (currency.test.ts)

```typescript
describe('Currency Utilities', () => {
  describe('formatCurrency', () => {
    it('should format USD amounts correctly', () => {
      const result = formatCurrency(1234.56, 'USD', 'en-US');
      expect(result).toContain('$');
      expect(result).toContain('1,234.56');
    });

    it('should format zero amount correctly', () => {
      const result = formatCurrency(0, 'USD', 'en-US');
      expect(result).toContain('0.00');
    });
  });
});
```

### Component Test Example (EmptyState.test.tsx)

```typescript
describe('EmptyState Component', () => {
  it('calls onAction when action button is pressed', () => {
    const onAction = jest.fn();
    render(
      <EmptyState
        icon="inbox-outline"
        title="No Items"
        description="Create one to get started."
        actionLabel="Create"
        onAction={onAction}
      />
    );

    const button = screen.getByText('Create');
    fireEvent.press(button);

    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
```

## Mocking Strategy

### AsyncStorage
Mocked using the built-in jest mock:
```javascript
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

### expo-haptics
Mocked with jest functions for impact and notification feedback:
```javascript
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  // ... styles
}));
```

### expo-router
Mocked for navigation functionality:
```javascript
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
  useLocalSearchParams: () => ({}),
}));
```

### Theme Context
Component tests mock the theme context:
```typescript
jest.mock('@/utils/ThemeContext', () => ({
  useTheme: () => ({
    themeValues: {
      accent: '#a855f7',
      textPrimary: '#1f2937',
      // ...
    },
  }),
}));
```

## Test Coverage

View coverage report:
```bash
npm run test:coverage
```

This generates a coverage report showing:
- **Statements**: Percentage of statements executed
- **Branches**: Percentage of branches taken
- **Functions**: Percentage of functions called
- **Lines**: Percentage of lines executed

Coverage data is collected from:
- `utils/**/*.{ts,tsx}`
- `components/**/*.{ts,tsx}`

Excluded from coverage:
- TypeScript definition files (.d.ts)
- node_modules

## Best Practices

### Writing Tests

1. **Use Descriptive Names**: Test names should clearly describe what is being tested
   ```typescript
   it('should format USD amounts with thousands separator', () => { ... });
   ```

2. **Test Behavior, Not Implementation**: Focus on what the component/function does
   ```typescript
   // Good
   expect(onAction).toHaveBeenCalled();

   // Avoid testing internal state
   ```

3. **Use Setup and Teardown**: Use `beforeEach` for test setup
   ```typescript
   beforeEach(() => {
     jest.clearAllMocks();
   });
   ```

4. **Test Edge Cases**: Include boundary conditions
   ```typescript
   it('should handle zero amount', () => { ... });
   it('should handle negative amounts', () => { ... });
   it('should handle very large numbers', () => { ... });
   ```

5. **Mock External Dependencies**: Always mock API calls, native modules, etc.
   ```typescript
   jest.mock('expo-haptics');
   ```

### Component Testing

1. **Render with Required Props**: Always provide required props
   ```typescript
   render(
     <EmptyState
       icon="inbox"
       title="Empty"
       description="No items"
     />
   );
   ```

2. **Test User Interactions**: Use `fireEvent` for user actions
   ```typescript
   fireEvent.press(button);
   fireEvent.changeText(input, 'new value');
   ```

3. **Test Visibility**: Use `screen.getByText()` and `screen.queryByText()`
   ```typescript
   expect(screen.getByText('Title')).toBeTruthy();
   expect(screen.queryByText('Missing')).toBeNull();
   ```

4. **Cleanup**: Tests auto-cleanup, but can manually unmount if needed
   ```typescript
   const { unmount } = render(<Component />);
   unmount();
   ```

## Debugging Tests

### Run Single Test
```bash
npm test -- --testNamePattern="specific test name"
```

### Run Single File
```bash
npm test currency.test.ts
```

### Verbose Output
```bash
npm test -- --verbose
```

### No Coverage
```bash
npm test -- --no-coverage
```

### Update Snapshots
```bash
npm test -- -u
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Run unit tests
        run: npm test

      - name: Generate coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
```

## Continuous Testing

Watch mode automatically re-runs tests when files change:
```bash
npm run test:watch
```

This is useful during development to get instant feedback on changes.

## Common Issues

### Test Timeouts
If tests timeout, increase Jest timeout:
```typescript
jest.setTimeout(10000);
```

### Mock Issues
Clear mocks between tests:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

### Navigation Issues
Ensure expo-router is properly mocked:
```typescript
jest.mock('expo-router');
```

### Platform-Specific Tests
Test different platforms:
```typescript
it('should work on iOS', () => {
  (Platform.OS as any) = 'ios';
  // test code
});
```

## Resources

- [Jest Documentation](https://jestjs.io)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Expo Documentation](https://docs.expo.dev/guides/testing-with-jest/)
- [Maestro E2E Testing](https://maestro.mobile)

## Next Steps

To expand test coverage:

1. Add tests for additional utilities (storage, notifications, API)
2. Add tests for screens and complex components
3. Add integration tests for user flows
4. Add E2E tests for critical journeys
5. Set up code coverage thresholds
6. Configure pre-commit hooks to run tests

## Contributing

When adding new code:

1. Write tests first (TDD approach)
2. Ensure tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Run E2E tests: `maestro test e2e/maestro/flows/`
5. Commit with tests included

## Questions?

Refer to the test files in `utils/__tests__/`, `components/__tests__/`, and `e2e/` for examples of how to write tests for different types of code.
