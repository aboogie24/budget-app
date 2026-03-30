# CoupleFlow Budget App - Tests Index

Quick reference guide for all test files and documentation in the CoupleFlow project.

## Documentation

Start here to understand the testing setup:

1. **[TESTING.md](./TESTING.md)** - Complete testing guide
   - Setup and installation
   - Running tests (unit, component, E2E)
   - Mocking strategies
   - Best practices
   - Debugging and CI/CD

2. **[TEST_SUMMARY.md](./TEST_SUMMARY.md)** - Summary of test infrastructure
   - Files created
   - Test statistics
   - Quick start
   - Verification checklist

3. **[e2e/README.md](./e2e/README.md)** - E2E testing with Maestro
   - Maestro installation
   - Available flows
   - Running E2E tests
   - Writing new flows

## Test Files

### Unit Tests (Jest)

**Utilities:**
- `utils/__tests__/currency.test.ts` - 58 test cases
  - formatCurrency()
  - getCurrencySymbol()
  - getCurrencyName()
  - formatCurrencySimple()
  - CURRENCIES validation

- `utils/__tests__/haptics.test.ts` - 11 test cases
  - lightHaptic()
  - mediumHaptic()
  - successHaptic()
  - errorHaptic()
  - Platform-specific behavior

### Component Tests (React Native Testing Library)

- `components/__tests__/EmptyState.test.tsx` - 12 test cases
  - Props rendering
  - Icon display
  - Action buttons
  - Callbacks

- `components/__tests__/ErrorState.test.tsx` - 16 test cases
  - Error display
  - Retry functionality
  - Dismiss actions
  - Multiple buttons

- `components/__tests__/ProgressRing.test.tsx` - 17 test cases
  - SVG rendering
  - Percentage display
  - Color handling
  - Animation

### End-to-End Tests (Maestro)

**Flows:**
- `e2e/maestro/flows/login.yaml` - User authentication
- `e2e/maestro/flows/create-budget.yaml` - Budget creation
- `e2e/maestro/flows/add-transaction.yaml` - Transaction tracking
- `e2e/maestro/flows/household-setup.yaml` - Household setup and invitations

## Configuration Files

- `jest.config.js` - Jest configuration for React Native
- `jest.setup.js` - Jest setup with mocks and extensions
- `e2e/maestro/config.yaml` - Maestro test configuration

## Running Tests

### Quick Commands

```bash
# Run all unit and component tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test currency.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="formatCurrency"

# Run E2E tests
maestro test e2e/maestro/flows/login.yaml
```

## Test Coverage

| Category | Files | Test Cases |
|----------|-------|-----------|
| Unit Tests | 2 | 69 |
| Component Tests | 3 | 45 |
| E2E Flows | 4 | 4+ |
| **Total** | **9** | **114+** |

## File Structure

```
budget-app/
├── jest.config.js                          # Jest configuration
├── jest.setup.js                           # Jest setup & mocks
├── TESTING.md                              # Testing guide
├── TEST_SUMMARY.md                         # Summary
├── TESTS_INDEX.md                          # This file
│
├── utils/
│   └── __tests__/
│       ├── currency.test.ts                # 58 test cases
│       └── haptics.test.ts                 # 11 test cases
│
├── components/
│   └── __tests__/
│       ├── EmptyState.test.tsx             # 12 test cases
│       ├── ErrorState.test.tsx             # 16 test cases
│       └── ProgressRing.test.tsx           # 17 test cases
│
└── e2e/
    ├── README.md                           # E2E guide
    └── maestro/
        ├── config.yaml                     # Maestro config
        └── flows/
            ├── login.yaml                  # Login flow
            ├── create-budget.yaml          # Budget flow
            ├── add-transaction.yaml        # Transaction flow
            └── household-setup.yaml        # Household flow
```

## Testing Stack

- **Test Runner**: Jest 29.7.0
- **Component Testing**: React Native Testing Library 12.4.2
- **E2E Testing**: Maestro
- **Language**: TypeScript + JSX
- **Mocking**: Jest mocks for native modules

## Key Features

✓ Comprehensive unit tests for utilities
✓ Component tests with proper isolation
✓ E2E user journey flows
✓ Proper mocking of native modules
✓ Coverage reporting
✓ Watch mode for development
✓ CI/CD ready

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run tests**:
   ```bash
   npm test
   ```

3. **Check coverage**:
   ```bash
   npm run test:coverage
   ```

4. **Run E2E tests** (requires Maestro):
   ```bash
   maestro test e2e/maestro/flows/login.yaml
   ```

## Next Steps

Expand test coverage by:

1. Adding tests for screens and complex components
2. Adding integration tests for state management
3. Adding more E2E flows for edge cases
4. Setting up CI/CD with GitHub Actions
5. Adding pre-commit hooks for test validation
6. Setting up code coverage thresholds

## References

- [Jest Documentation](https://jestjs.io)
- [React Native Testing Library](https://callstack.github.io/react-native-testing-library/)
- [Jest Expo Guide](https://docs.expo.dev/guides/testing-with-jest/)
- [Maestro Documentation](https://maestro.mobile)

## Support

For testing questions:
- See TESTING.md for comprehensive guide
- Check TEST_SUMMARY.md for file descriptions
- Review e2e/README.md for E2E testing details
- Look at test files for examples

---

**All tests are ready to run!** Start with `npm test` to verify the setup.
