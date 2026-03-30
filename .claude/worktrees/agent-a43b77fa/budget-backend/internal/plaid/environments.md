# Plaid Environments

This document describes the three Plaid API environments and when to use each.

## Sandbox Environment

**Use for:** Local development and testing

**Characteristics:**
- Completely isolated testing environment
- Test credentials and data only (no real bank data)
- No real financial institutions connected
- Unlimited usage with Plaid test accounts
- Instant processing of transactions
- No rate limiting

**Test Accounts:**
- Username: `user_good`
- Password: `pass_good`
- Multiple test institutional accounts available with test data

**Setup:**
```bash
export PLAID_ENV=sandbox
export PLAID_CLIENT_ID=your_sandbox_client_id
export PLAID_SECRET=your_sandbox_secret
```

## Development Environment

**Use for:** Staging/integration testing with real bank connections

**Characteristics:**
- Real bank connections and data
- Live institutional data (not test data)
- Same API behavior as production
- Subject to Plaid rate limits
- Requires separate credentials from production
- Good for testing end-to-end flows with real institutions

**Limitations:**
- May be subject to test transaction limits per institution
- Not recommended for load testing
- Development institutions only (limited bank coverage)

**Setup:**
```bash
export PLAID_ENV=development
export PLAID_CLIENT_ID=your_development_client_id
export PLAID_SECRET=your_development_secret
export PLAID_WEBHOOK_URL=https://staging.example.com/webhooks/plaid
```

## Production Environment

**Use for:** Live user-facing application

**Characteristics:**
- Real bank connections and user data
- Full access to all supported financial institutions
- Full rate limiting and quota enforcement
- Requires Plaid production approval
- PCI compliance requirements apply
- Production SLAs and support

**Requirements:**
- Plaid account with production approval
- Separate production credentials
- HTTPS endpoint with valid SSL certificate
- Webhook URL configured for receiving Plaid events
- Proper error handling and retry logic
- Full compliance with Plaid terms of service

**Setup:**
```bash
export PLAID_ENV=production
export PLAID_CLIENT_ID=your_production_client_id
export PLAID_SECRET=your_production_secret
export PLAID_WEBHOOK_URL=https://api.example.com/webhooks/plaid
```

## Switching Environments

The application automatically switches environments based on the `PLAID_ENV` environment variable at startup. To change environments:

1. Update the `PLAID_ENV` variable
2. Update corresponding `PLAID_CLIENT_ID` and `PLAID_SECRET`
3. Restart the application

Example transition flow:
```
Development → Testing in Sandbox
Sandbox passes tests → Move to Development
Development ready → Deploy to Production (with production credentials)
```

## Configuration Validation

The `internal/plaid/config.go` module validates:
- All required credentials are present
- `PLAID_ENV` is one of: `sandbox`, `development`, `production`
- Environment name is case-insensitive

## Security Notes

1. **Never commit credentials** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate credentials** regularly
4. **Use different credentials** for each environment
5. **Monitor webhook events** for unusual activity
6. **Implement rate limiting** on your endpoints
7. **Log API errors** for audit trails (but not sensitive data)

## Common Issues

### "Invalid environment" error
- Check `PLAID_ENV` spelling (must be lowercase)
- Verify it's set to one of: sandbox, development, production

### "Authentication failed" error
- Verify `PLAID_CLIENT_ID` and `PLAID_SECRET` are correct for the environment
- Ensure credentials match the environment (sandbox creds won't work in production)

### Webhook not receiving events
- Verify `PLAID_WEBHOOK_URL` is set and reachable
- Ensure HTTPS certificate is valid
- Check firewall/network settings
- Verify webhook URL in Plaid dashboard settings

## References

- [Plaid Documentation](https://plaid.com/docs/)
- [Plaid API Environments](https://plaid.com/docs/api/overview/)
- [Plaid Integration Guide](https://plaid.com/docs/quickstart/)
