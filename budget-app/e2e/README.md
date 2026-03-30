# CoupleFlow E2E Testing

This directory contains end-to-end tests for the CoupleFlow budget application using Maestro.

## Overview

Maestro is a mobile-first UI testing framework that enables you to write reliable end-to-end tests that are easy to create and maintain.

- **Documentation**: https://maestro.mobile
- **Flows**: Located in `maestro/flows/`
- **Configuration**: `maestro/config.yaml`

## Prerequisites

### Install Maestro

```bash
# macOS
brew install mobile-dev-infra/tap/maestro

# Linux / Windows
curl -Ls "https://get.maestro.mobile/install.sh" | bash
```

Verify installation:
```bash
maestro --version
```

### Requirements

- macOS, Linux, or Windows
- iOS Simulator or Android Emulator running
- Xcode (for iOS) or Android SDK (for Android)

## Available Flows

### 1. login.yaml
Tests the basic login flow for the CoupleFlow application.

**What it tests:**
- App launches successfully
- Sign in screen is visible
- Can input email and password
- User can sign in and reach dashboard

**Run:**
```bash
maestro test e2e/maestro/flows/login.yaml
```

### 2. create-budget.yaml
Tests the budget creation flow.

**What it tests:**
- User can log in
- Navigate to Budget section
- Create a new budget with name and amount
- Select currency
- Budget appears in the list with correct formatting

**Run:**
```bash
maestro test e2e/maestro/flows/create-budget.yaml
```

### 3. add-transaction.yaml
Tests the transaction creation flow.

**What it tests:**
- User can log in
- Access transaction creation via FAB button
- Input transaction amount, category, and note
- Transaction is added and visible in the app

**Run:**
```bash
maestro test e2e/maestro/flows/add-transaction.yaml
```

### 4. household-setup.yaml
Tests the household creation and partner invitation flow.

**What it tests:**
- User can log in
- Navigate to Settings
- Create a new household with name and currency
- Invite a partner via email
- Invitation confirmation is shown

**Run:**
```bash
maestro test e2e/maestro/flows/household-setup.yaml
```

## Running Tests

### Run a Single Flow

```bash
maestro test e2e/maestro/flows/login.yaml
```

### Run All Flows

```bash
maestro test e2e/maestro/flows/
```

### Run with Specific Device

```bash
# iOS Simulator
maestro test --device iOS e2e/maestro/flows/login.yaml

# Android Emulator
maestro --device Android e2e/maestro/flows/login.yaml
```

### Run with Verbose Output

```bash
maestro test --verbose e2e/maestro/flows/login.yaml
```

### Interactive Mode

```bash
maestro studio
```

This opens an interactive interface for recording and testing flows on your device.

## Writing Tests

### Flow Structure

Each flow file is a YAML document with the following structure:

```yaml
appId: com.github.aboogie.budgetapp
---
- launchApp
- assertVisible:
    text: Expected Text
- tapOn:
    id: element-id
- inputText: user input
- waitForAnimationToEnd
```

### Common Commands

| Command | Purpose |
|---------|---------|
| `launchApp` | Launch the application |
| `tapOn` | Tap on element by text, id, or coordinate |
| `inputText` | Type text into a focused input field |
| `scroll` | Scroll up or down |
| `swipe` | Perform a swipe gesture |
| `back` | Press back button (Android) |
| `waitForAnimationToEnd` | Wait for animations to complete |
| `assertVisible` | Verify element is visible |
| `assertNotVisible` | Verify element is not visible |
| `runFlow` | Run another flow file |

### Finding Element IDs

1. Launch the app in Maestro Studio: `maestro studio`
2. Inspect elements to find their IDs
3. Use the inspector to identify elements by:
   - Text content
   - Resource ID
   - Coordinates

### Best Practices

1. **Use IDs over Text**: Prefer `id` for element selection when available
2. **Wait for Animations**: Use `waitForAnimationToEnd` after navigation
3. **Reuse Flows**: Use `runFlow` to avoid duplicating common steps (e.g., login)
4. **Assertions**: Always assert the expected state after actions
5. **Descriptive Names**: Use clear, descriptive flow names
6. **Avoid Flakiness**: Wait for elements and animations rather than using fixed delays

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  maestro:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Maestro
        run: curl -Ls "https://get.maestro.mobile/install.sh" | bash

      - name: Start Simulator
        run: |
          xcrun simctl create iPhone14 "iPhone 14"
          xcrun simctl boot iPhone14

      - name: Build App
        run: |
          cd budget-app
          npm run build

      - name: Run E2E Tests
        run: |
          maestro test e2e/maestro/flows/

      - name: Upload Results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: maestro-results
          path: results/
```

## Troubleshooting

### Tests Not Finding Elements

1. Check element IDs match your app
2. Use Maestro Studio to inspect elements
3. Ensure app is in expected state before test

### Simulator Issues

```bash
# List available simulators
xcrun simctl list

# Restart simulator
xcrun simctl shutdown all
xcrun simctl erase all
xcrun simctl create iPhone14 "iPhone 14"
xcrun simctl boot iPhone14
```

### Permission Errors

Ensure Maestro has proper permissions to interact with your device:
- iOS: Grant accessibility permissions
- Android: Enable developer options and USB debugging

## Debugging

### Record a Flow

Use Maestro Studio to record interactions:

```bash
maestro studio
```

### View Flow Execution

Run with verbose flag to see detailed execution:

```bash
maestro test --verbose e2e/maestro/flows/login.yaml
```

### Take Screenshots

Add to your flows to capture state at specific points:

```yaml
- takeScreenshot: login-screen
```

## Resources

- [Maestro Documentation](https://maestro.mobile)
- [Maestro CLI Reference](https://maestro.mobile/cli)
- [Maestro Flow Syntax](https://maestro.mobile/flows)
- [Testing Best Practices](https://maestro.mobile/best-practices)

## Maintenance

- Review flows quarterly for app changes
- Update element IDs when UI components change
- Keep flows focused on single user journeys
- Archive flows for deprecated features

## Contributing

When adding new flows:

1. Follow naming conventions (kebab-case)
2. Document the flow in this README
3. Add assertions for critical states
4. Use `runFlow` to reuse common steps
5. Test on both iOS and Android if possible
