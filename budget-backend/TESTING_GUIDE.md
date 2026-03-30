# Backend Integration Tests and API Validation Guide

This document describes the integration testing framework and API validation layer built for the CoupleFlow budget backend.

## Overview

The testing infrastructure consists of:
1. **API Validation Layer** - Request validation with structured error responses
2. **Recovery Middleware** - Panic recovery with graceful error responses
3. **Integration Test Framework** - Full DB-to-API testing with test helpers
4. **Comprehensive Test Coverage** - Unit tests for validation and middleware

## Files Created

### 1. Validation Layer

#### `/handlers/validation.go`
Provides reusable validation functions and structured error responses:
- `ValidationError` - Individual field validation error structure
- `ValidationErrors` - Wrapper for multiple validation errors
- `respondValidationError()` - Returns 400 with JSON error array
- `validateRequired()` - Checks non-empty strings
- `validateEmail()` - Validates email format with regex
- `validatePositiveFloat()` - Ensures numbers > 0
- `validateUUID()` - Validates UUID v4 format
- `validateEnum()` - Ensures value is in allowed list

**Response Format:**
```json
{
  "errors": [
    {"field": "email", "message": "invalid email format"},
    {"field": "amount", "message": "amount must be greater than 0"}
  ]
}
```

#### `/handlers/validation_new_test.go`
Comprehensive unit tests for all validation functions:
- `TestValidateRequired()` - Tests empty/whitespace detection
- `TestValidateEmail()` - Tests valid/invalid email formats
- `TestValidatePositiveFloat()` - Tests number validation
- `TestValidateUUID()` - Tests UUID format validation
- `TestValidateEnum()` - Tests enum constraints
- `TestRespondValidationError()` - Tests JSON response formatting

**Test Coverage:**
- 20+ test cases across all validators
- Edge cases like whitespace-only strings, negative numbers, malformed UUIDs
- JSON response validation

### 2. Recovery Middleware

#### `/middleware/recovery.go`
Panic recovery middleware that prevents server crashes:
- Catches all panics during request handling
- Logs panic information for debugging
- Returns 500 status with structured JSON error
- Does not interfere with normal request flow

**Usage:**
```go
r.Use(middleware.RecoveryMiddleware)
```

**Response on Panic:**
```json
{
  "error": "internal server error"
}
```

#### `/middleware/recovery_test.go`
Tests for panic recovery:
- `TestRecoveryMiddleware_NormalExecution()` - Normal requests pass through
- `TestRecoveryMiddleware_PanicRecovery()` - Panics are caught and logged
- `TestRecoveryMiddleware_PanicWithNilValue()` - Handles nil panics
- `TestRecoveryMiddleware_MultipleRequests()` - Middleware survives multiple requests
- `TestRecoveryMiddleware_PanicWithDifferentTypes()` - Handles different panic types

### 3. Integration Test Framework

#### `/handlers/testutil_test.go` (Build tag: integration)
Helper functions for integration testing with a real test database:

**Key Functions:**
- `setupTestDB(t)` - Connects to test database and clears tables
- `teardownTestDB(t, td)` - Closes test database connection
- `createTestUser(t, td, email, password)` - Creates user with hashed password and JWT token
- `createTestHousehold(t, td, userID, name)` - Creates household with user as owner
- `createTestCategory(t, td, userID, name, categoryType)` - Creates budget category
- `createTestBudget(t, td, userID, categoryID, amount, month, year)` - Creates budget
- `makeAuthRequest(t, method, path, body, token)` - Creates authenticated HTTP request

**Database Configuration:**
Uses environment variables with fallbacks:
- `PG_USER_TEST` / `PG_USER` - Database user
- `PG_PASS_TEST` / `PG_PASS` - Database password
- `PG_HOST_TEST` / `PG_HOST` - Database host
- `PG_PORT_TEST` / `PG_PORT` - Database port
- `PG_DB_TEST` (default: `budget_test`) - Test database name

**Tables Cleared Before Tests:**
- household_invites
- household_members
- households
- spending_alerts
- transactions
- budgets
- user_categories
- linked_accounts
- settings
- users

#### `/handlers/integration_test.go` (Build tag: integration)
Full end-to-end integration tests covering complete workflows:

**Test Scenarios:**

1. **TestUserLifecycle** - Full user workflow
   - Register user 1
   - Login with credentials
   - Create household
   - Register user 2
   - Invite user 2 to household
   - Verifies complete user/household setup

2. **TestBudgetLifecycle** - Complete budget management
   - Create expense category
   - Create budget with amount
   - Add transaction to budget
   - Update budget amount
   - Delete budget
   - Verifies full CRUD cycle

3. **TestHouseholdSharing** - Shared budget access
   - Create two users
   - Create household for user 1
   - Create shared budget
   - Add user 2 to household
   - Verify user 2 can access household data
   - Tests household collaboration

4. **TestSpendingAlerts** - Alert management
   - Create budget and spending alert
   - Set threshold
   - Retrieve alerts
   - Verifies alert tracking

## Running Tests

### Unit Tests (No Database Required)
```bash
# Run validation tests
go test -v ./handlers -run TestValidate

# Run recovery middleware tests
go test -v ./middleware -run TestRecovery

# Run all unit tests
go test -v ./handlers ./middleware
```

### Integration Tests (Requires Test Database)
```bash
# Build with integration tag and run
go test -v -tags integration ./handlers -run TestUserLifecycle
go test -v -tags integration ./handlers -run TestBudgetLifecycle
go test -v -tags integration ./handlers -run TestHouseholdSharing
go test -v -tags integration ./handlers

# Run all tests with coverage
go test -v -tags integration -cover ./handlers
```

### Setup for Integration Tests

1. **Create test database:**
   ```bash
   createdb budget_test
   ```

2. **Set environment variables:**
   ```bash
   export PG_DB_TEST=budget_test
   export PG_USER_TEST=postgres
   export PG_PASS_TEST=password
   export PG_HOST_TEST=localhost
   export PG_PORT_TEST=5432
   export JWT_SECRET=test-secret-key
   ```

3. **Run migrations on test database:**
   ```bash
   # Ensure migrations are applied to budget_test database
   # This happens automatically in setupTestDB()
   ```

## Router Integration

The `RecoveryMiddleware` has been integrated into the main router:

```go
// In routes/routes.go SetupRoutes()
r.Use(middleware.RecoveryMiddleware)  // Added first
r.Use(middleware.Logging)              // Existing
```

This ensures all requests are protected from panics before logging middleware processes them.

## Validation Usage Example

In handlers, use the validation helpers:

```go
// Validate request fields
var errors []handlers.ValidationError

if err := handlers.validateRequired(email, "email"); err != nil {
    errors = append(errors, *err)
}
if err := handlers.validateEmail(email); err != nil {
    errors = append(errors, *err)
}
if err := handlers.validatePositiveFloat(amount, "amount"); err != nil {
    errors = append(errors, *err)
}

if len(errors) > 0 {
    handlers.respondValidationError(w, errors)
    return
}

// Continue with handler logic...
```

## Test Database Strategy

The test framework supports both:

### Option 1: Real PostgreSQL Test Database
- Connects to actual test database
- Full end-to-end testing with real DB queries
- Validates schema and migrations
- Required for integration tests

### Option 2: Mock/SQLite for CI/CD (Future Enhancement)
- Build tag separation allows switching databases
- Can add SQLite support without modifying core code
- Useful for continuous integration without PostgreSQL

## Error Handling

### Validation Errors
```json
{
  "errors": [
    {"field": "email", "message": "invalid email format"},
    {"field": "amount", "message": "amount must be greater than 0"}
  ]
}
```
Status: 400 Bad Request

### Server Errors
```json
{
  "error": "internal server error"
}
```
Status: 500 Internal Server Error

## Build Tags

Tests use Go build tags for conditional compilation:

```go
//go:build integration
// +build integration
```

This means:
- These files only compile with `go test -tags integration`
- Normal `go test` runs without integration tests
- Useful for CI/CD pipelines that may not have a test database

## Future Enhancements

1. **Test Fixtures** - Pre-built test data for common scenarios
2. **Database Factories** - Minimal test data generation
3. **Mock HTTP Clients** - Test external API calls (Plaid)
4. **Performance Benchmarks** - Load testing for budget operations
5. **API Documentation** - OpenAPI/Swagger specs with examples
6. **Concurrent Tests** - Race condition detection
7. **Code Coverage Goals** - Target 80%+ coverage per package

## Troubleshooting

### "Database connection failed"
- Check PG_* environment variables
- Ensure test database exists: `createdb budget_test`
- Verify PostgreSQL is running

### "Build constraint satisfied"
- Run with `-tags integration`: `go test -tags integration ./handlers`
- Or skip integration tests: `go test ./handlers`

### "Migration errors"
- Test framework clears tables but doesn't create them
- Ensure migrations are applied to test database first
- Manually run: `migrate -path migrations -database "postgres://..." up`

### "JWT token errors"
- Ensure `JWT_SECRET` is set in environment
- Test helpers set temporary value if not present

## Related Files

- `/routes/routes.go` - Router setup with middleware integration
- `/handlers/validate.go` - Existing validation functions (complementary)
- `/middleware/logging.go` - Logging middleware (paired with recovery)
- `/models/user.go` - User model with password hashing
- `/auth/jwt.go` - JWT token generation and validation
