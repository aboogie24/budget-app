# Security Audit Report - CoupleFlow Budget App

**Date:** 2026-03-29
**Status:** Findings and remediations documented below

## Findings

### 1. SQL Injection Protection
**Status:** SECURE ✓

All database queries in the codebase use parameterized queries with `$1, $2, $n` placeholders via the pq driver. The database layer (`db/client.go`) properly wraps queries through `Query()`, `QueryRow()`, and `Exec()` methods that accept variadic arguments.

**Verified in:**
- `handlers/login.go` (line 36)
- `handlers/users.go` (lines 35-37, 83, 93-96)
- All other handlers consistently use parameterized queries

**Action:** No fixes required — implementation is secure.

---

### 2. JWT Security
**Status:** SECURE ✓

The JWT implementation in `auth/jwt.go` includes:
- Explicit algorithm enforcement using `jwt.SigningMethodHS256` (prevents "none" algorithm attack)
- Token expiry validation (24-hour expiry set at generation)
- Claims validation (user_id extraction with type checking)
- Proper HMAC signature verification

**Verified in:**
- `auth/jwt.go` lines 24, 43-47, 50-62

**Action:** No fixes required — implementation is secure.

---

### 3. Password Hashing
**Status:** SECURE ✓

Password hashing uses bcrypt with `bcrypt.DefaultCost` (which is 10, the recommended minimum for production).

**Verified in:**
- `models/user.go` lines 12-18 (HashPassword uses DefaultCost)
- `models/user.go` lines 21-22 (CheckPassword uses proper comparison)
- `handlers/users.go` line 69 (HashPassword called before storage)

**Action:** No fixes required — implementation is secure.

---

### 4. Rate Limiting on Auth Endpoints
**Status:** NOT IMPLEMENTED

The application has a general rate limiting middleware (`middleware/ratelimit.go`) but it is not specifically applied to authentication endpoints (`/users/login`, `/users/register`).

**Action:** Created `middleware/auth_ratelimit.go` with stricter rate limits (5 attempts per minute) and registered it in `routes/routes.go`.

---

### 5. Input Sanitization
**Status:** PARTIAL

Some input validation exists (email format, password length), but no general string sanitization against null bytes or excessive length.

**Action:** Created `handlers/sanitize.go` with sanitization utilities and can be integrated into request handling.

---

### 6. Security Headers
**Status:** NOT IMPLEMENTED

No security headers middleware is present.

**Action:** Created `middleware/security_headers.go` with comprehensive HTTP security headers and registered it in `routes/routes.go`.

---

## Remediations Implemented

### Created Files

1. **`middleware/auth_ratelimit.go`** - Stricter rate limiting for authentication endpoints
2. **`handlers/sanitize.go`** - String sanitization utilities
3. **`middleware/security_headers.go`** - HTTP security headers middleware

### Modified Files

1. **`routes/routes.go`** - Registered security headers and auth rate limit middleware

---

## Recommendations

1. **Environment Variables:** Ensure `JWT_SECRET` and `SESSION_SECRET` are sufficiently long (32+ bytes) and randomly generated in production.

2. **HTTPS Enforcement:** Deploy behind HTTPS reverse proxy (e.g., nginx) to enforce secure cookie transmission.

3. **CORS Configuration:** Review `middleware/cors.go` to ensure CORS policies are restrictive and appropriate for your deployment.

4. **Session Timeout:** Consider reducing session timeout from 24 hours or implementing refresh token rotation.

5. **Plaid Token Storage:** Ensure Plaid access tokens are never logged or exposed in error messages.

6. **Secrets Management:** Use a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault) instead of .env files in production.

---

## Testing

- [x] SQL injection: All queries use parameterized syntax
- [x] JWT validation: Explicit algorithm and expiry enforcement
- [x] Password security: bcrypt with DefaultCost
- [x] Rate limiting: Auth endpoints now have 5 req/min limit
- [x] Security headers: Implemented and registered
- [x] Input sanitization: Utilities created for use in handlers

