#!/usr/bin/env bash
#
# Test workflow: Debt → Bill → Mark Paid → Verify debt balance decreases
#
# Usage:
#   1. Start the backend:  make dev  (or go run main.go)
#   2. Run migrations:     make migrate-up
#   3. Run this script:    bash test_bills_workflow.sh
#
# Prerequisites: jq installed, a registered user in the database.
#   If you don't have a user, the script will register one.
#
set -euo pipefail

API="http://localhost:8080"
EMAIL="testbills@example.com"
PASSWORD="testpass123"

green()  { printf "\033[32m%s\033[0m\n" "$1"; }
red()    { printf "\033[31m%s\033[0m\n" "$1"; }
yellow() { printf "\033[33m%s\033[0m\n" "$1"; }

echo "============================================"
echo "  Bills + Debt Linkage Workflow Test"
echo "============================================"
echo ""

# ── Step 0: Register / Login ──────────────────────────────
# Generate a UUID for registration (the register endpoint requires an id field)
TEST_USER_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

yellow "Step 0: Registering user (may fail if already exists)..."
curl -s -X POST "$API/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"id\":\"$TEST_USER_ID\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"full_name\":\"Test User\"}" > /dev/null 2>&1 || true

yellow "Step 0: Logging in..."
LOGIN_RES=$(curl -s -X POST "$API/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")

echo "  Login response: $LOGIN_RES"

TOKEN=$(echo "$LOGIN_RES" | jq -r '.token // empty')
USER_ID=$(echo "$LOGIN_RES" | jq -r '.user.id // empty')

if [ -z "$TOKEN" ] || [ -z "$USER_ID" ]; then
  red "Login failed. Response: $LOGIN_RES"
  exit 1
fi
green "Logged in: user_id=$USER_ID"
echo ""

AUTH="Authorization: Bearer $TOKEN"

# ── Step 1: Create a Debt (Auto Loan) ────────────────────
yellow "Step 1: Creating debt (Auto Loan — \$25,000 @ 5.9% APR)..."
DEBT_RES=$(curl -s -X POST "$API/auth/debts" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"name\": \"Auto Loan\",
    \"balance\": 25000,
    \"apr\": 5.9,
    \"min_payment\": 450,
    \"due_day\": 15,
    \"strategy\": \"avalanche\",
    \"is_shared\": false
  }")

DEBT_ID=$(echo "$DEBT_RES" | jq -r '.id // empty')
DEBT_BALANCE=$(echo "$DEBT_RES" | jq -r '.balance // empty')

if [ -z "$DEBT_ID" ]; then
  red "Failed to create debt. Response: $DEBT_RES"
  exit 1
fi
green "Created debt: id=$DEBT_ID, balance=\$$DEBT_BALANCE"
echo ""

# ── Step 2: Create a Bill linked to the Debt ─────────────
yellow "Step 2: Creating bill (Car Payment — \$450/mo, linked to Auto Loan)..."
BILL_RES=$(curl -s -X POST "$API/auth/bills" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{
    \"user_id\": \"$USER_ID\",
    \"name\": \"Car Payment\",
    \"amount_due\": 450,
    \"due_day\": 15,
    \"frequency\": \"monthly\",
    \"payee\": \"Toyota Financial\",
    \"debt_account_id\": \"$DEBT_ID\",
    \"is_autopay\": false,
    \"is_shared\": false
  }")

BILL_ID=$(echo "$BILL_RES" | jq -r '.id // empty')

if [ -z "$BILL_ID" ]; then
  red "Failed to create bill. Response: $BILL_RES"
  exit 1
fi
green "Created bill: id=$BILL_ID, linked to debt=$DEBT_ID"
echo ""

# ── Step 3: List bills — should show status=unpaid ───────
yellow "Step 3: Listing bills (expect status=unpaid)..."
BILLS_LIST=$(curl -s -X GET "$API/auth/bills?user_id=$USER_ID" \
  -H "$AUTH")

BILL_STATUS=$(echo "$BILLS_LIST" | jq -r ".[] | select(.id==\"$BILL_ID\") | .status")
echo "  Bill status: $BILL_STATUS"
if [ "$BILL_STATUS" = "unpaid" ] || [ "$BILL_STATUS" = "overdue" ]; then
  green "  Correct — bill is not yet paid"
else
  red "  Unexpected status: $BILL_STATUS"
fi
echo ""

# ── Step 4: Mark the bill as paid ────────────────────────
yellow "Step 4: Marking bill as paid (\$450)..."
PAY_RES=$(curl -s -X POST "$API/auth/bills/$BILL_ID/pay" \
  -H "Content-Type: application/json" \
  -H "$AUTH" \
  -d "{\"amount\": 450}")

PAY_STATUS=$(echo "$PAY_RES" | jq -r '.status // empty')
echo "  Bill status after payment: $PAY_STATUS"
if [ "$PAY_STATUS" = "paid" ]; then
  green "  Bill marked as paid"
else
  red "  Unexpected response: $PAY_RES"
fi
echo ""

# ── Step 5: Verify debt balance decreased ────────────────
yellow "Step 5: Checking debt balance (expect \$24,550)..."
DEBTS_LIST=$(curl -s -X GET "$API/auth/debts?user_id=$USER_ID" \
  -H "$AUTH")

NEW_BALANCE=$(echo "$DEBTS_LIST" | jq -r ".[] | select(.id==\"$DEBT_ID\") | .balance")
echo "  Debt balance: \$$NEW_BALANCE"

EXPECTED="24550"
if [ "$(echo "$NEW_BALANCE" | cut -d. -f1)" = "$EXPECTED" ]; then
  green "  Correct — balance decreased from \$25,000 to \$$NEW_BALANCE"
else
  red "  Expected ~\$$EXPECTED, got \$$NEW_BALANCE"
fi
echo ""

# ── Step 6: List bill payments ───────────────────────────
yellow "Step 6: Checking bill payment history..."
PAYMENTS=$(curl -s -X GET "$API/auth/bills/$BILL_ID/payments" \
  -H "$AUTH")

PAYMENT_COUNT=$(echo "$PAYMENTS" | jq 'length')
echo "  Payment records: $PAYMENT_COUNT"
if [ "$PAYMENT_COUNT" -ge 1 ]; then
  green "  Payment recorded successfully"
  echo "$PAYMENTS" | jq '.[0] | {amount_paid, paid_date, source, period_start, period_end}'
else
  red "  No payment records found"
fi
echo ""

# ── Step 7: List bills again — should show paid ──────────
yellow "Step 7: Listing bills again (expect status=paid)..."
BILLS_AFTER=$(curl -s -X GET "$API/auth/bills?user_id=$USER_ID" \
  -H "$AUTH")

FINAL_STATUS=$(echo "$BILLS_AFTER" | jq -r ".[] | select(.id==\"$BILL_ID\") | .status")
echo "  Bill status: $FINAL_STATUS"
if [ "$FINAL_STATUS" = "paid" ]; then
  green "  Correct — bill shows as paid for this period"
else
  red "  Unexpected status: $FINAL_STATUS"
fi
echo ""

# ── Cleanup (optional) ───────────────────────────────────
yellow "Step 8: Cleaning up test data..."
curl -s -X DELETE "$API/auth/bills/$BILL_ID" -H "$AUTH" > /dev/null 2>&1
# Note: deleting the debt is left to you if desired
green "  Deleted test bill"
echo ""

echo "============================================"
green "  Workflow test complete!"
echo "============================================"
