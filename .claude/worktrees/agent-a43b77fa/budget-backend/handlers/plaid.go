package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
	"github.com/plaid/plaid-go/v20/plaid"
)

type exchangeTokenRequest struct {
	PublicToken string `json:"public_token"`
	UserID      string `json:"user_id"`
	HouseholdID string `json:"household_id,omitempty"`
	Institution string `json:"institution_name,omitempty"`
}

type exchangeTokenResponse struct {
	AccessToken string `json:"access_token"`
	ItemID      string `json:"item_id"`
}

// This returns a handler function that has access to your models.Client
func ExchangeToken(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req exchangeTokenRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		if req.PublicToken == "" || req.UserID == "" {
			http.Error(w, "Missing public_token", http.StatusBadRequest)
			return
		}

		resp, _, err := client.API.PlaidApi.ItemPublicTokenExchange(context.Background()).
			ItemPublicTokenExchangeRequest(plaid.ItemPublicTokenExchangeRequest{
				PublicToken: req.PublicToken,
			}).Execute()

		if err != nil {
			http.Error(w, "Plaid token exchange failed: "+err.Error(), http.StatusInternalServerError)
			log.Printf("Plaid token exchange failed")
			return
		}

		// persist linked account
		dbClient, err := db.New()
		if err == nil {
			defer dbClient.Close()
			linkedID := uuid.Must(uuid.NewV4()).String()
			_, _ = dbClient.Exec(
				`INSERT INTO linked_accounts (id, user_id, household_id, item_id, access_token, institution_name) 
				 VALUES ($1,$2,$3,$4,$5,$6)`,
				linkedID,
				req.UserID,
				nullable(req.HouseholdID),
				resp.GetItemId(),
				resp.GetAccessToken(),
				req.Institution,
			)
		}

		json.NewEncoder(w).Encode(exchangeTokenResponse{
			AccessToken: resp.GetAccessToken(),
			ItemID:      resp.GetItemId(),
		})
	}
}

// CreateLinkToken issues a one-time link_token for Plaid Link.
func CreateLinkToken(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}

		user := plaid.LinkTokenCreateRequestUser{ClientUserId: userID}
		req := plaid.NewLinkTokenCreateRequest("Budget App", "en", []plaid.CountryCode{plaid.COUNTRYCODE_US}, user)
		req.SetProducts([]plaid.Products{
			plaid.PRODUCTS_TRANSACTIONS,
		})
		req.SetOptionalProducts([]plaid.Products{
			plaid.PRODUCTS_INVESTMENTS,
			plaid.PRODUCTS_LIABILITIES,
		})
		if redirect := os.Getenv("PLAID_REDIRECT_URI"); redirect != "" {
			req.SetRedirectUri(redirect)
		}

		resp, _, err := client.API.PlaidApi.LinkTokenCreate(context.Background()).
			LinkTokenCreateRequest(*req).
			Execute()

		if err != nil {
			http.Error(w, "Failed to create link token: "+err.Error(), http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]string{
			"link_token": resp.GetLinkToken(),
		})
	}
}

// SyncTransactions pulls new transactions from Plaid for all linked accounts
// belonging to a user and inserts them into the transactions table.
// POST /auth/plaid/sync?user_id=...
func SyncTransactions(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}

		dbClient, err := db.New()
		if err != nil {
			http.Error(w, "DB connection error", http.StatusInternalServerError)
			return
		}
		defer dbClient.Close()

		hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

		// Fetch all linked accounts for this user.
		rows, err := dbClient.Query(`
			SELECT id, access_token, household_id
			FROM linked_accounts
			WHERE user_id = $1
		`, userID)
		if err != nil {
			http.Error(w, "Failed to fetch linked accounts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type account struct {
			id          string
			accessToken string
			householdID *string
		}
		var accounts []account
		for rows.Next() {
			var a account
			var hh *string
			if err := rows.Scan(&a.id, &a.accessToken, &hh); err == nil {
				a.householdID = hh
				accounts = append(accounts, a)
			}
		}

		if len(accounts) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"synced": 0,
				"message": "No linked accounts found",
			})
			return
		}

		totalSynced := 0
		var syncErrors []string

		for _, acct := range accounts {
			// Use Plaid TransactionsSync to get incremental updates.
			// For simplicity we use an empty cursor (full sync) — in production you'd
			// persist the cursor per linked_account for incremental syncs.
			cursor := ""
			hasMore := true

			for hasMore {
				syncReq := plaid.NewTransactionsSyncRequest(acct.accessToken)
				if cursor != "" {
					syncReq.SetCursor(cursor)
				}

				resp, _, err := client.API.PlaidApi.TransactionsSync(context.Background()).
					TransactionsSyncRequest(*syncReq).
					Execute()
				if err != nil {
					log.Printf("Plaid sync failed for account %s: %v", acct.id, err)
					syncErrors = append(syncErrors, acct.id)
					break
				}

				added := resp.GetAdded()
				for _, tx := range added {
					txID := uuid.Must(uuid.NewV4()).String()
					txType := "expense"
					amount := tx.GetAmount()
					// Plaid amounts: positive = money leaving account (expense),
					// negative = money entering (income/refund).
					if amount < 0 {
						txType = "income"
						amount = -amount
					}

					catName := ""
					if cats := tx.GetCategory(); len(cats) > 0 {
						catName = cats[0]
					}

					effectiveHH := acct.householdID
					if effectiveHH == nil && hhID != "" {
						effectiveHH = &hhID
					}

					source := "bank"
					_, insertErr := dbClient.Exec(`
						INSERT INTO transactions (id, user_id, household_id, type, amount, category_name, note, date, source)
						VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
						ON CONFLICT DO NOTHING
					`,
						txID,
						userID,
						effectiveHH,
						txType,
						amount,
						catName,
						tx.GetName(),
						tx.GetDate(),
						source,
					)
					if insertErr != nil {
						log.Printf("Failed to insert Plaid transaction: %v", insertErr)
						continue
					}
					totalSynced++
				}

				cursor = resp.GetNextCursor()
				hasMore = resp.GetHasMore()
			}
		}

		w.Header().Set("Content-Type", "application/json")
		result := map[string]interface{}{
			"synced": totalSynced,
		}
		if len(syncErrors) > 0 {
			result["failed_accounts"] = syncErrors
		}
		json.NewEncoder(w).Encode(result)
	}
}

// PlaidLinkPage serves an HTML page that runs Plaid Link via the JS SDK.
// After successful linking, it redirects to budgetapp://plaid-success?public_token=xxx
// so that the mobile app's openAuthSessionAsync can catch it.
// GET /plaid/link-page?token=<link_token>
func PlaidLinkPage(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		http.Error(w, "Missing token param", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	// Use fmt.Fprintf so the link_token is injected server-side
	page := `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{background:#0b1021;color:#94a3b8;font-family:system-ui,-apple-system,sans-serif;
       display:flex;align-items:center;justify-content:center;height:100vh;text-align:center}
  .wrap{padding:24px}
  .spinner{width:32px;height:32px;border:3px solid rgba(192,132,252,0.2);border-top-color:#c084fc;
           border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 16px}
  @keyframes spin{to{transform:rotate(360deg)}}
  .err{color:#f87171;margin-top:12px}
</style>
</head><body>
<div class="wrap">
  <div class="spinner"></div>
  <p id="msg">Loading Plaid Link…</p>
  <p id="err" class="err"></p>
</div>
<script src="https://cdn.plaid.com/link/v2/stable/link-initialize.js"></script>
<script>
(function(){
  var msg = document.getElementById('msg');
  var errEl = document.getElementById('err');
  try {
    var handler = Plaid.create({
      token: '` + token + `',
      onSuccess: function(public_token, metadata) {
        var inst = metadata && metadata.institution ? metadata.institution.name : '';
        window.location.href = 'budgetapp://plaid-success?public_token=' +
          encodeURIComponent(public_token) + '&institution_name=' + encodeURIComponent(inst);
      },
      onExit: function(err, metadata) {
        window.location.href = 'budgetapp://plaid-exit';
      },
      onEvent: function(eventName, metadata) {},
      onLoad: function() {
        msg.textContent = 'Select your bank…';
      }
    });
    handler.open();
  } catch(e) {
    errEl.textContent = 'Failed to initialize: ' + e.message;
  }
})();
</script>
</body></html>`

	w.Write([]byte(page))
}

// SyncInvestments pulls investment holdings from Plaid for all linked accounts
// belonging to a user and upserts them into the investment_holdings table.
// POST /auth/plaid/investments?user_id=...
func SyncInvestments(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}

		dbClient, err := db.New()
		if err != nil {
			http.Error(w, "DB connection error", http.StatusInternalServerError)
			return
		}
		defer dbClient.Close()

		hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

		// Fetch all linked accounts for this user.
		rows, err := dbClient.Query(`
			SELECT id, access_token, household_id
			FROM linked_accounts
			WHERE user_id = $1
		`, userID)
		if err != nil {
			http.Error(w, "Failed to fetch linked accounts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type account struct {
			id          string
			accessToken string
			householdID *string
		}
		var accounts []account
		for rows.Next() {
			var a account
			var hh *string
			if err := rows.Scan(&a.id, &a.accessToken, &hh); err == nil {
				a.householdID = hh
				accounts = append(accounts, a)
			}
		}

		if len(accounts) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"synced":  0,
				"message": "No linked accounts found",
			})
			return
		}

		totalSynced := 0
		var syncErrors []string

		for _, acct := range accounts {
			holdingsReq := plaid.NewInvestmentsHoldingsGetRequest(acct.accessToken)
			resp, _, err := client.API.PlaidApi.InvestmentsHoldingsGet(context.Background()).
				InvestmentsHoldingsGetRequest(*holdingsReq).
				Execute()
			if err != nil {
				log.Printf("Plaid investments sync failed for account %s: %v", acct.id, err)
				syncErrors = append(syncErrors, acct.id)
				continue
			}

			// Build a map of security_id → security for denormalization
			secMap := map[string]plaid.Security{}
			for _, s := range resp.GetSecurities() {
				secMap[s.GetSecurityId()] = s
			}

			effectiveHH := acct.householdID
			if effectiveHH == nil && hhID != "" {
				effectiveHH = &hhID
			}

			// Clear old holdings for this linked account before inserting fresh ones
			_, _ = dbClient.Exec(`DELETE FROM investment_holdings WHERE linked_account_id = $1`, acct.id)

			for _, h := range resp.GetHoldings() {
				holdingID := uuid.Must(uuid.NewV4()).String()
				sec := secMap[h.GetSecurityId()]

				var secName, ticker, secType, priceAsOf *string
				if v, ok := sec.GetNameOk(); ok && v != nil {
					secName = v
				}
				if v, ok := sec.GetTickerSymbolOk(); ok && v != nil {
					ticker = v
				}
				if v, ok := sec.GetTypeOk(); ok && v != nil {
					secType = v
				}
				if v, ok := h.GetInstitutionPriceAsOfOk(); ok && v != nil {
					priceAsOf = v
				}

				var costBasis *float64
				if v, ok := h.GetCostBasisOk(); ok && v != nil {
					costBasis = v
				}

				currency := "USD"
				if v, ok := h.GetIsoCurrencyCodeOk(); ok && v != nil && *v != "" {
					currency = *v
				}

				_, insertErr := dbClient.Exec(`
					INSERT INTO investment_holdings
						(id, user_id, household_id, linked_account_id, plaid_account_id, plaid_security_id,
						 security_name, ticker_symbol, security_type,
						 quantity, institution_price, institution_value, cost_basis,
						 iso_currency_code, price_as_of)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
				`,
					holdingID, userID, effectiveHH, acct.id,
					h.GetAccountId(), h.GetSecurityId(),
					secName, ticker, secType,
					h.GetQuantity(), h.GetInstitutionPrice(), h.GetInstitutionValue(), costBasis,
					currency, priceAsOf,
				)
				if insertErr != nil {
					log.Printf("Failed to insert holding: %v", insertErr)
					continue
				}
				totalSynced++
			}
		}

		w.Header().Set("Content-Type", "application/json")
		result := map[string]interface{}{"synced": totalSynced}
		if len(syncErrors) > 0 {
			result["failed_accounts"] = syncErrors
		}
		json.NewEncoder(w).Encode(result)
	}
}

// SyncLiabilities pulls liabilities from Plaid for all linked accounts
// belonging to a user and upserts them into the liabilities table.
// POST /auth/plaid/liabilities?user_id=...
func SyncLiabilities(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}

		dbClient, err := db.New()
		if err != nil {
			http.Error(w, "DB connection error", http.StatusInternalServerError)
			return
		}
		defer dbClient.Close()

		hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

		rows, err := dbClient.Query(`
			SELECT id, access_token, household_id
			FROM linked_accounts WHERE user_id = $1
		`, userID)
		if err != nil {
			http.Error(w, "Failed to fetch linked accounts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type account struct {
			id          string
			accessToken string
			householdID *string
		}
		var accounts []account
		for rows.Next() {
			var a account
			var hh *string
			if err := rows.Scan(&a.id, &a.accessToken, &hh); err == nil {
				a.householdID = hh
				accounts = append(accounts, a)
			}
		}

		if len(accounts) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"synced":  0,
				"message": "No linked accounts found",
			})
			return
		}

		totalSynced := 0
		var syncErrors []string

		for _, acct := range accounts {
			liabReq := plaid.NewLiabilitiesGetRequest(acct.accessToken)
			resp, _, err := client.API.PlaidApi.LiabilitiesGet(context.Background()).
				LiabilitiesGetRequest(*liabReq).
				Execute()
			if err != nil {
				log.Printf("Plaid liabilities sync failed for account %s: %v", acct.id, err)
				syncErrors = append(syncErrors, acct.id)
				continue
			}

			effectiveHH := acct.householdID
			if effectiveHH == nil && hhID != "" {
				effectiveHH = &hhID
			}

			// Clear old liabilities for this linked account
			_, _ = dbClient.Exec(`DELETE FROM liabilities WHERE linked_account_id = $1`, acct.id)

			liabs := resp.GetLiabilities()

			// Credit cards
			for _, cc := range liabs.GetCredit() {
				id := uuid.Must(uuid.NewV4()).String()
				acctID := ""
				if v := cc.GetAccountId(); v != "" {
					acctID = v
				}
				_, insertErr := dbClient.Exec(`
					INSERT INTO liabilities
						(id, user_id, household_id, linked_account_id, plaid_account_id, liability_type,
						 last_payment_amount, last_payment_date, minimum_payment_amount,
						 next_payment_due_date, is_overdue, last_statement_balance)
					VALUES ($1,$2,$3,$4,$5,'credit',$6,$7,$8,$9,$10,$11)
				`,
					id, userID, effectiveHH, acct.id, acctID,
					nullableFloat(cc.GetLastPaymentAmount()),
					nullableStr(cc.GetLastPaymentDate()),
					nullableFloat(cc.GetMinimumPaymentAmount()),
					nullableStr(cc.GetNextPaymentDueDate()),
					nullableBool(cc.GetIsOverdue()),
					nullableFloat(cc.GetLastStatementBalance()),
				)
				if insertErr != nil {
					log.Printf("Failed to insert credit liability: %v", insertErr)
					continue
				}
				totalSynced++
			}

			// Mortgages
			for _, m := range liabs.GetMortgage() {
				id := uuid.Must(uuid.NewV4()).String()
				var intRate *float64
				if ir := m.GetInterestRate(); ir.Percentage.IsSet() {
					v := ir.GetPercentage()
					intRate = &v
				}
				var propAddr *string
				if pa := m.GetPropertyAddress(); pa.Street.IsSet() {
					full := pa.GetStreet() + ", " + pa.GetCity() + ", " + pa.GetRegion() + " " + pa.GetPostalCode()
					propAddr = &full
				}
				_, insertErr := dbClient.Exec(`
					INSERT INTO liabilities
						(id, user_id, household_id, linked_account_id, plaid_account_id, liability_type,
						 account_number, last_payment_amount, last_payment_date,
						 minimum_payment_amount, next_payment_due_date,
						 loan_term, loan_type_description, maturity_date, origination_date,
						 origination_principal, interest_rate, escrow_balance, has_pmi,
						 property_address, ytd_interest_paid, ytd_principal_paid)
					VALUES ($1,$2,$3,$4,$5,'mortgage',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
				`,
					id, userID, effectiveHH, acct.id, m.GetAccountId(),
					nullable(m.GetAccountNumber()),
					nullableFloat(m.GetLastPaymentAmount()),
					nullableStr(m.GetLastPaymentDate()),
					nullableFloat(m.GetNextMonthlyPayment()),
					nullableStr(m.GetNextPaymentDueDate()),
					nullableStr(m.GetLoanTerm()),
					nullableStr(m.GetLoanTypeDescription()),
					nullableStr(m.GetMaturityDate()),
					nullableStr(m.GetOriginationDate()),
					nullableFloat(m.GetOriginationPrincipalAmount()),
					intRate,
					nullableFloat(m.GetEscrowBalance()),
					nullableBool(m.GetHasPmi()),
					propAddr,
					nullableFloat(m.GetYtdInterestPaid()),
					nullableFloat(m.GetYtdPrincipalPaid()),
				)
				if insertErr != nil {
					log.Printf("Failed to insert mortgage liability: %v", insertErr)
					continue
				}
				totalSynced++
			}

			// Student loans
			for _, sl := range liabs.GetStudent() {
				id := uuid.Must(uuid.NewV4()).String()
				acctID := ""
				if v := sl.GetAccountId(); v != "" {
					acctID = v
				}
				var loanStatus *string
				if ls := sl.GetLoanStatus(); ls.Type.IsSet() {
					s := string(ls.GetType())
					loanStatus = &s
				}
				var repayPlan *string
				if rp := sl.GetRepaymentPlan(); rp.Type.IsSet() {
					s := string(rp.GetType())
					repayPlan = &s
				}
				_, insertErr := dbClient.Exec(`
					INSERT INTO liabilities
						(id, user_id, household_id, linked_account_id, plaid_account_id, liability_type,
						 account_number, last_payment_amount, last_payment_date,
						 minimum_payment_amount, next_payment_due_date, is_overdue,
						 loan_name, loan_status, expected_payoff_date, guarantor,
						 interest_rate_pct, outstanding_interest, repayment_plan,
						 origination_date, origination_principal,
						 ytd_interest_paid, ytd_principal_paid)
					VALUES ($1,$2,$3,$4,$5,'student',$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)
				`,
					id, userID, effectiveHH, acct.id, acctID,
					nullableStr(sl.GetAccountNumber()),
					nullableFloat(sl.GetLastPaymentAmount()),
					nullableStr(sl.GetLastPaymentDate()),
					nullableFloat(sl.GetMinimumPaymentAmount()),
					nullableStr(sl.GetNextPaymentDueDate()),
					nullableBool(sl.GetIsOverdue()),
					nullableStr(sl.GetLoanName()),
					loanStatus,
					nullableStr(sl.GetExpectedPayoffDate()),
					nullableStr(sl.GetGuarantor()),
					sl.GetInterestRatePercentage(),
					nullableFloat(sl.GetOutstandingInterestAmount()),
					repayPlan,
					nullableStr(sl.GetOriginationDate()),
					nullableFloat(sl.GetOriginationPrincipalAmount()),
					nullableFloat(sl.GetYtdInterestPaid()),
					nullableFloat(sl.GetYtdPrincipalPaid()),
				)
				if insertErr != nil {
					log.Printf("Failed to insert student loan liability: %v", insertErr)
					continue
				}
				totalSynced++
			}

			// ── Auto-sync liabilities into debt_accounts ──
			acctBalMap := map[string]plaid.AccountBase{}
			for _, pa := range resp.GetAccounts() {
				acctBalMap[pa.GetAccountId()] = pa
			}

			debtAPRs := map[string]float64{}
			debtMinPays := map[string]float64{}
			debtDueDays := map[string]int{}

			for _, cc := range liabs.GetCredit() {
				aid := cc.GetAccountId()
				debtMinPays[aid] = cc.GetMinimumPaymentAmount()
				if aprs := cc.GetAprs(); len(aprs) > 0 {
					debtAPRs[aid] = aprs[0].GetAprPercentage()
				}
				if dd := cc.GetNextPaymentDueDate(); dd != "" {
					if t, err := time.Parse("2006-01-02", dd); err == nil {
						debtDueDays[aid] = t.Day()
					}
				}
			}
			for _, m := range liabs.GetMortgage() {
				aid := m.GetAccountId()
				debtMinPays[aid] = m.GetNextMonthlyPayment()
				if ir := m.GetInterestRate(); ir.Percentage.IsSet() {
					debtAPRs[aid] = ir.GetPercentage()
				}
				if dd := m.GetNextPaymentDueDate(); dd != "" {
					if t, err := time.Parse("2006-01-02", dd); err == nil {
						debtDueDays[aid] = t.Day()
					}
				}
			}
			for _, sl := range liabs.GetStudent() {
				aid := sl.GetAccountId()
				debtMinPays[aid] = sl.GetMinimumPaymentAmount()
				debtAPRs[aid] = sl.GetInterestRatePercentage()
				if dd := sl.GetNextPaymentDueDate(); dd != "" {
					if t, err := time.Parse("2006-01-02", dd); err == nil {
						debtDueDays[aid] = t.Day()
					}
				}
			}

			for aid := range debtMinPays {
				pa, ok := acctBalMap[aid]
				if !ok {
					continue
				}
				newID := uuid.Must(uuid.NewV4()).String()
				bal := pa.GetBalances()
				debtBalance := bal.GetCurrent()
				debtName := pa.GetName()
				if debtName == "" {
					debtName = "Linked Account"
				}
				var debtID string
				debtErr := dbClient.QueryRow(`
					INSERT INTO debt_accounts (id, user_id, household_id, name, balance, apr, min_payment, is_shared, plaid_account_id, linked_account_id, source)
					VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8, $9, 'plaid')
					ON CONFLICT (user_id, plaid_account_id) WHERE plaid_account_id IS NOT NULL
					DO UPDATE SET balance = EXCLUDED.balance, min_payment = EXCLUDED.min_payment, name = EXCLUDED.name, apr = EXCLUDED.apr
					RETURNING id
				`, newID, userID, effectiveHH, debtName, debtBalance, debtAPRs[aid], debtMinPays[aid], aid, acct.id).Scan(&debtID)
				if debtErr != nil {
					log.Printf("Failed to upsert debt for plaid acct %s: %v", aid, debtErr)
					continue
				}

				// Auto-create a bill linked to this debt if none exists yet.
				var billCount int
				_ = dbClient.QueryRow(`SELECT COUNT(*) FROM bills WHERE debt_account_id = $1`, debtID).Scan(&billCount)
				if billCount == 0 {
					dueDay := 1
					if dd, ok := debtDueDays[aid]; ok {
						dueDay = dd
					}
					billID := uuid.Must(uuid.NewV4()).String()
					_, billErr := dbClient.Exec(`
						INSERT INTO bills (id, user_id, household_id, name, amount_due, due_day, frequency, debt_account_id, is_autopay, is_shared)
						VALUES ($1, $2, $3, $4, $5, $6, 'monthly', $7, false, false)
					`, billID, userID, effectiveHH, debtName+" Payment", debtMinPays[aid], dueDay, debtID)
					if billErr != nil {
						log.Printf("Failed to auto-create bill for debt %s: %v", debtID, billErr)
					} else {
						log.Printf("Auto-created bill '%s Payment' for Plaid debt %s (due day %d)", debtName, debtID, dueDay)
					}
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		result := map[string]interface{}{"synced": totalSynced}
		if len(syncErrors) > 0 {
			result["failed_accounts"] = syncErrors
		}
		json.NewEncoder(w).Encode(result)
	}
}

// GetInvestmentHoldings returns all holdings for a user.
// GET /auth/plaid/investments?user_id=...
func GetInvestmentHoldings(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	rows, err := dbClient.Query(`
		SELECT id, user_id, household_id, linked_account_id, plaid_account_id, plaid_security_id,
		       security_name, ticker_symbol, security_type,
		       quantity, institution_price, institution_value, cost_basis,
		       iso_currency_code, price_as_of, created_at, updated_at
		FROM investment_holdings WHERE user_id = $1
		ORDER BY institution_value DESC
	`, userID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var holdings []models.InvestmentHolding
	for rows.Next() {
		var h models.InvestmentHolding
		if err := rows.Scan(
			&h.ID, &h.UserID, &h.HouseholdID, &h.LinkedAccountID,
			&h.PlaidAccountID, &h.PlaidSecurityID,
			&h.SecurityName, &h.TickerSymbol, &h.SecurityType,
			&h.Quantity, &h.InstitutionPrice, &h.InstitutionValue, &h.CostBasis,
			&h.IsoCurrencyCode, &h.PriceAsOf, &h.CreatedAt, &h.UpdatedAt,
		); err != nil {
			log.Printf("Failed to scan holding: %v", err)
			continue
		}
		holdings = append(holdings, h)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(holdings)
}

// GetLiabilities returns all liabilities for a user.
// GET /auth/plaid/liabilities?user_id=...
func GetLiabilities(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	rows, err := dbClient.Query(`
		SELECT id, user_id, household_id, linked_account_id, plaid_account_id, liability_type,
		       account_number, last_payment_amount, last_payment_date,
		       minimum_payment_amount, next_payment_due_date, is_overdue,
		       last_statement_balance,
		       loan_term, loan_type_description, maturity_date, origination_date,
		       origination_principal, interest_rate, escrow_balance, has_pmi,
		       property_address, ytd_interest_paid, ytd_principal_paid,
		       loan_name, loan_status, expected_payoff_date, guarantor,
		       interest_rate_pct, outstanding_interest, repayment_plan, servicer_address,
		       created_at, updated_at
		FROM liabilities WHERE user_id = $1
		ORDER BY liability_type, created_at
	`, userID)
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var liabilities []models.Liability
	for rows.Next() {
		var l models.Liability
		if err := rows.Scan(
			&l.ID, &l.UserID, &l.HouseholdID, &l.LinkedAccountID,
			&l.PlaidAccountID, &l.LiabilityType,
			&l.AccountNumber, &l.LastPaymentAmount, &l.LastPaymentDate,
			&l.MinimumPaymentAmount, &l.NextPaymentDueDate, &l.IsOverdue,
			&l.LastStatementBalance,
			&l.LoanTerm, &l.LoanTypeDescription, &l.MaturityDate, &l.OriginationDate,
			&l.OriginationPrincipal, &l.InterestRate, &l.EscrowBalance, &l.HasPMI,
			&l.PropertyAddress, &l.YtdInterestPaid, &l.YtdPrincipalPaid,
			&l.LoanName, &l.LoanStatus, &l.ExpectedPayoffDate, &l.Guarantor,
			&l.InterestRatePct, &l.OutstandingInterest, &l.RepaymentPlan, &l.ServicerAddress,
			&l.CreatedAt, &l.UpdatedAt,
		); err != nil {
			log.Printf("Failed to scan liability: %v", err)
			continue
		}
		liabilities = append(liabilities, l)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(liabilities)
}

// SyncAccountBalances pulls account balances from Plaid for all linked accounts
// and upserts them into the account_balances table.
// POST /auth/plaid/balances?user_id=...
func SyncAccountBalances(client *models.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.URL.Query().Get("user_id")
		if userID == "" {
			http.Error(w, "Missing user_id", http.StatusBadRequest)
			return
		}

		dbClient, err := db.New()
		if err != nil {
			http.Error(w, "DB connection error", http.StatusInternalServerError)
			return
		}
		defer dbClient.Close()

		hhID := db.ResolveHouseholdID(dbClient.Conn, userID)

		rows, err := dbClient.Query(`
			SELECT id, access_token, household_id, institution_name
			FROM linked_accounts
			WHERE user_id = $1
		`, userID)
		if err != nil {
			http.Error(w, "Failed to fetch linked accounts", http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		type acctInfo struct {
			id              string
			accessToken     string
			householdID     *string
			institutionName string
		}
		var linkedAccts []acctInfo
		for rows.Next() {
			var a acctInfo
			var hh *string
			if err := rows.Scan(&a.id, &a.accessToken, &hh, &a.institutionName); err == nil {
				a.householdID = hh
				linkedAccts = append(linkedAccts, a)
			}
		}

		if len(linkedAccts) == 0 {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"synced": 0, "message": "No linked accounts found"})
			return
		}

		totalSynced := 0
		for _, acct := range linkedAccts {
			balReq := plaid.NewAccountsBalanceGetRequest(acct.accessToken)
			resp, _, err := client.API.PlaidApi.AccountsBalanceGet(context.Background()).
				AccountsBalanceGetRequest(*balReq).
				Execute()
			if err != nil {
				log.Printf("Plaid balance sync failed for account %s: %v", acct.id, err)
				continue
			}

			effectiveHH := acct.householdID
			if effectiveHH == nil && hhID != "" {
				effectiveHH = &hhID
			}

			for _, pa := range resp.GetAccounts() {
				acctType := string(pa.GetType())
				subtype := ""
				if st, ok := pa.GetSubtypeOk(); ok && st != nil {
					subtype = string(*st)
				}

				bal := pa.GetBalances()
				current := bal.GetCurrent()
				var available *float64
				if v := bal.GetAvailable(); v > 0 {
					available = &v
				}

				currency := "USD"
				if v, ok := bal.GetIsoCurrencyCodeOk(); ok && v != nil && *v != "" {
					currency = *v
				}

				var mask *string
				if v, ok := pa.GetMaskOk(); ok && v != nil {
					mask = v
				}

				var officialName *string
				if v, ok := pa.GetOfficialNameOk(); ok && v != nil {
					officialName = v
				}

				newID := uuid.Must(uuid.NewV4()).String()
				_, insertErr := dbClient.Exec(`
					INSERT INTO account_balances
						(id, user_id, household_id, linked_account_id, plaid_account_id,
						 name, official_name, type, subtype, current_balance, available_balance,
						 iso_currency_code, institution_name, mask, updated_at)
					VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14, NOW())
					ON CONFLICT (user_id, plaid_account_id) DO UPDATE SET
						name = EXCLUDED.name,
						official_name = EXCLUDED.official_name,
						type = EXCLUDED.type,
						subtype = EXCLUDED.subtype,
						current_balance = EXCLUDED.current_balance,
						available_balance = EXCLUDED.available_balance,
						iso_currency_code = EXCLUDED.iso_currency_code,
						institution_name = EXCLUDED.institution_name,
						mask = EXCLUDED.mask,
						updated_at = NOW()
				`,
					newID, userID, effectiveHH, acct.id, pa.GetAccountId(),
					pa.GetName(), officialName, acctType, nullableStr(subtype),
					current, available, currency, acct.institutionName, mask,
				)
				if insertErr != nil {
					log.Printf("Failed to upsert account balance: %v", insertErr)
					continue
				}
				totalSynced++
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{"synced": totalSynced})
	}
}

// GetAccountBalances returns cached account balances for a user.
// GET /auth/plaid/balances?user_id=...&type=depository (optional type filter)
func GetAccountBalances(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "Missing user_id", http.StatusBadRequest)
		return
	}

	dbClient, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	typeFilter := r.URL.Query().Get("type")
	var balRows *sql.Rows
	if typeFilter != "" {
		balRows, err = dbClient.Query(`
			SELECT id, user_id, household_id, linked_account_id, plaid_account_id,
			       name, official_name, type, subtype, current_balance, available_balance,
			       iso_currency_code, institution_name, mask, created_at, updated_at
			FROM account_balances WHERE user_id = $1 AND type = $2
			ORDER BY current_balance DESC
		`, userID, typeFilter)
	} else {
		balRows, err = dbClient.Query(`
			SELECT id, user_id, household_id, linked_account_id, plaid_account_id,
			       name, official_name, type, subtype, current_balance, available_balance,
			       iso_currency_code, institution_name, mask, created_at, updated_at
			FROM account_balances WHERE user_id = $1
			ORDER BY current_balance DESC
		`, userID)
	}
	if err != nil {
		http.Error(w, "query error", http.StatusInternalServerError)
		return
	}
	defer balRows.Close()

	var balances []models.AccountBalance
	for balRows.Next() {
		var b models.AccountBalance
		if err := balRows.Scan(
			&b.ID, &b.UserID, &b.HouseholdID, &b.LinkedAccountID,
			&b.PlaidAccountID, &b.Name, &b.OfficialName, &b.Type, &b.Subtype,
			&b.CurrentBalance, &b.AvailableBalance,
			&b.IsoCurrencyCode, &b.InstitutionName, &b.Mask,
			&b.CreatedAt, &b.UpdatedAt,
		); err != nil {
			log.Printf("Failed to scan account balance: %v", err)
			continue
		}
		balances = append(balances, b)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(balances)
}

func nullable(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableStr(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

func nullableFloat(f float64) interface{} {
	if f == 0 {
		return nil
	}
	return f
}

func nullableBool(b bool) interface{} {
	return b
}
