package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"sort"
	"strings"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// plannerDBFactory allows swapping the DB in tests.
var plannerDBFactory = func() (db.DBTX, error) {
	return db.New()
}

func sanitizeUserID(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errors.New("missing user_id")
	}
	if _, err := uuid.Parse(trimmed); err != nil {
		return "", err
	}
	return trimmed, nil
}

func ListSavingsGoals(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	hh := db.ResolveHouseholdID(client.Raw(), userID)
	const goalCols = `
			g.id, g.user_id, COALESCE(g.household_id::text, ''), g.name, g.target_amount, g.current_amount, COALESCE(g.target_date, ''), g.priority, g.is_shared,
			COALESCE(g.linked_balance_id::text, ''), COALESCE(ab.name, '')
		FROM savings_goals g
		LEFT JOIN account_balances ab ON g.linked_balance_id = ab.id`
	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(`SELECT `+goalCols+`
			WHERE g.household_id IS NULL AND g.user_id = $1
		`, userID)
	} else {
		rows, err = client.Query(`SELECT `+goalCols+`
			WHERE g.household_id = $1
			   OR (g.household_id IS NULL AND g.user_id = $2)
		`, hh, userID)
	}
	if err != nil {
		log.Printf("ListSavingsGoals query error: %v", err)
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var goals []models.SavingsGoal
	for rows.Next() {
		var g models.SavingsGoal
		var hh sql.NullString
		var targetDate sql.NullString
		var linkedID, linkedName string
		if err := rows.Scan(&g.ID, &g.UserID, &hh, &g.Name, &g.TargetAmount, &g.CurrentAmount, &targetDate, &g.Priority, &g.IsShared, &linkedID, &linkedName); err != nil {
			log.Printf("ListSavingsGoals scan error: %v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		if hh.Valid {
			g.HouseholdID = hh.String
		} else {
			g.HouseholdID = ""
		}
		if targetDate.Valid {
			g.TargetDate = targetDate.String
		} else {
			g.TargetDate = ""
		}
		if linkedID != "" {
			g.LinkedBalanceID = &linkedID
			g.LinkedAccountName = linkedName
		}
		goals = append(goals, g)
	}

	// Overlay the effective $/month per goal (summed across active plans).
	eff := effectiveMonthlyByTarget(client.Raw(), userID)
	for i := range goals {
		goals[i].EffectiveMonthly = eff[goals[i].ID]
	}

	json.NewEncoder(w).Encode(goals)
}

func CreateSavingsGoal(w http.ResponseWriter, r *http.Request) {
	var g models.SavingsGoal
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		log.Printf("CreateSavingsGoal decode error: %v", err)
		http.Error(w, "Invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if g.ID == "" {
		g.ID = uuid.New().String()
	}
	if g.UserID == "" {
		g.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(g.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	g.UserID = userID

	client, err := plannerDBFactory()
	if err != nil {
		log.Printf("CreateSavingsGoal DB error: %v", err)
		http.Error(w, "DB connection error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Only attach to an existing household; do not auto-create
	if g.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), g.UserID); hh != "" {
			g.HouseholdID = hh
		}
	}
	if g.IsShared && g.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	var hhVal any
	if g.HouseholdID == "" {
		hhVal = nil
	} else {
		hhVal = g.HouseholdID
	}

	var linkedVal any
	if g.LinkedBalanceID != nil && *g.LinkedBalanceID != "" {
		if !balanceOwnedBy(client.Raw(), *g.LinkedBalanceID, g.UserID) {
			http.Error(w, "Linked account not found for this user", http.StatusBadRequest)
			return
		}
		linkedVal = *g.LinkedBalanceID
	}

	_, err = client.Exec(`
		INSERT INTO savings_goals (id, user_id, household_id, name, target_amount, current_amount, target_date, priority, is_shared, linked_balance_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, g.ID, g.UserID, hhVal, g.Name, g.TargetAmount, g.CurrentAmount, g.TargetDate, g.Priority, g.IsShared, linkedVal)
	if err != nil {
		if strings.Contains(err.Error(), "idx_savings_goals_linked_balance") {
			http.Error(w, "That account is already linked to another goal", http.StatusConflict)
			return
		}
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	// A linked goal's progress IS the account balance — snap it immediately.
	if linkedVal != nil {
		snapLinkedGoalBalance(client.Raw(), g.ID)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(g)
}

// balanceOwnedBy reports whether the account_balances row belongs to the user
// or their household.
func balanceOwnedBy(conn *sql.DB, balanceID, userID string) bool {
	hh := db.ResolveHouseholdID(conn, userID)
	var ok bool
	err := conn.QueryRow(`
		SELECT EXISTS(
			SELECT 1 FROM account_balances
			WHERE id = $1 AND (user_id = $2 OR ($3 <> '' AND household_id::text = $3))
		)
	`, balanceID, userID, hh).Scan(&ok)
	return err == nil && ok
}

// snapLinkedGoalBalance mirrors the linked account's balance into one goal's
// current_amount (used right after linking; syncs keep it fresh afterwards).
func snapLinkedGoalBalance(conn *sql.DB, goalID string) {
	if _, err := conn.Exec(`
		UPDATE savings_goals sg
		SET current_amount = GREATEST(ab.current_balance, 0)
		FROM account_balances ab
		WHERE sg.id = $1 AND sg.linked_balance_id = ab.id
	`, goalID); err != nil {
		log.Printf("snapLinkedGoalBalance error: %v", err)
	}
}

func UpdateSavingsGoal(w http.ResponseWriter, r *http.Request) {
	goalID := mux.Vars(r)["id"]
	if goalID == "" {
		http.Error(w, "Missing goal id", http.StatusBadRequest)
		return
	}

	var g models.SavingsGoal
	if err := json.NewDecoder(r.Body).Decode(&g); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var linkedVal any
	linking := g.LinkedBalanceID != nil && *g.LinkedBalanceID != ""
	if linking {
		if !balanceOwnedBy(client.Raw(), *g.LinkedBalanceID, g.UserID) {
			http.Error(w, "Linked account not found for this user", http.StatusBadRequest)
			return
		}
		linkedVal = *g.LinkedBalanceID
	}

	res, err := client.Exec(`
		UPDATE savings_goals
		SET name = $1, target_amount = $2, current_amount = $3, target_date = $4, priority = $5, is_shared = $6, linked_balance_id = $7
		WHERE id = $8
	`, g.Name, g.TargetAmount, g.CurrentAmount, g.TargetDate, g.Priority, g.IsShared, linkedVal, goalID)
	if err != nil {
		if strings.Contains(err.Error(), "idx_savings_goals_linked_balance") {
			http.Error(w, "That account is already linked to another goal", http.StatusConflict)
			return
		}
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Goal not found", http.StatusNotFound)
		return
	}

	// A linked goal's progress IS the account balance — the client-sent
	// current_amount is overridden by the real number.
	if linking {
		snapLinkedGoalBalance(client.Raw(), goalID)
	}

	// return merged record (client already has it)
	g.ID = goalID
	json.NewEncoder(w).Encode(g)
}

func UpdateSavingsProgress(w http.ResponseWriter, r *http.Request) {
	goalID := mux.Vars(r)["id"]
	if goalID == "" {
		http.Error(w, "Missing goal id", http.StatusBadRequest)
		return
	}

	var body struct {
		CurrentAmount float64 `json:"current_amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Balance-linked goals mirror a real account — manual progress edits would
	// be overwritten on the next sync and misrepresent where the money is.
	var linked sql.NullString
	_ = client.QueryRow(`SELECT linked_balance_id::text FROM savings_goals WHERE id = $1`, goalID).Scan(&linked)
	if linked.Valid && linked.String != "" {
		http.Error(w, "This goal tracks a linked bank account — its progress updates automatically from the account balance", http.StatusConflict)
		return
	}

	res, err := client.Exec(`UPDATE savings_goals SET current_amount = $1 WHERE id = $2`, body.CurrentAmount, goalID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Goal not found", http.StatusNotFound)
		return
	}

	json.NewEncoder(w).Encode(map[string]any{
		"id":             goalID,
		"current_amount": body.CurrentAmount,
	})
}

func ListDebts(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	rows, err := client.Query(`
		SELECT d.id, d.user_id, COALESCE(d.household_id::text, ''), d.name, d.balance,
		       COALESCE(d.original_balance, d.balance), d.apr, d.min_payment, d.due_day,
		       COALESCE(d.strategy, ''), d.is_shared, COALESCE(d.source, 'manual'),
		       COALESCE(d.debt_category, 'attack'), COALESCE(d.liability_type, 'other'), d.asset_depreciates,
		       COALESCE(d.linked_balance_id::text, ''), COALESCE(ab.name, '')
		FROM debt_accounts d
		LEFT JOIN account_balances ab ON d.linked_balance_id = ab.id
		WHERE d.user_id = $1
	`, userID)

	if err != nil {
		log.Printf("ListDebts query error: %v", err)
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var debts []models.DebtAccount
	for rows.Next() {
		var (
			d          models.DebtAccount
			dueDay     sql.NullInt32
			hhID       string
			linkedID   string
			linkedName string
		)
		if err := rows.Scan(&d.ID, &d.UserID, &hhID, &d.Name, &d.Balance, &d.OriginalBalance, &d.APR, &d.MinPayment, &dueDay, &d.Strategy, &d.IsShared, &d.Source, &d.DebtCategory, &d.LiabilityType, &d.AssetDepreciates, &linkedID, &linkedName); err != nil {
			log.Printf("ListDebts scan error: %v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		d.HouseholdID = hhID
		if dueDay.Valid {
			val := int(dueDay.Int32)
			d.DueDay = &val
		} else {
			d.DueDay = nil
		}
		if linkedID != "" {
			d.LinkedBalanceID = &linkedID
			d.LinkedAccountName = linkedName
		}
		debts = append(debts, d)
	}

	json.NewEncoder(w).Encode(debts)
}

func CreateDebt(w http.ResponseWriter, r *http.Request) {
	var d models.DebtAccount
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		log.Printf("CreateDebt decode error: %v", err)
		http.Error(w, "Invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}

	if d.ID == "" {
		d.ID = uuid.New().String()
	}
	if d.UserID == "" {
		d.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(d.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	d.UserID = userID
	log.Printf("CreateDebt payload user=%s household=%s name=%s amount=%f", d.UserID, d.HouseholdID, d.Name, d.Balance)

	client, err := plannerDBFactory()
	if err != nil {
		log.Printf("CreateDebt DB error: %v", err)
		http.Error(w, "DB connection error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Only attach to an existing household; do not auto-create
	if d.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), d.UserID); hh != "" {
			d.HouseholdID = hh
		}
	}
	if d.IsShared && d.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	var hhVal any
	if d.HouseholdID == "" {
		hhVal = nil
	} else {
		hhVal = d.HouseholdID
	}

	// Apply default debt_category based on liability_type if not set
	if d.DebtCategory == "" {
		if cat, ok := models.DebtCategoryDefaults[d.LiabilityType]; ok {
			d.DebtCategory = cat
		} else {
			d.DebtCategory = "attack"
		}
	}
	if d.LiabilityType == "" {
		d.LiabilityType = "other"
	}

	var linkedVal any
	if d.LinkedBalanceID != nil && *d.LinkedBalanceID != "" {
		if !balanceOwnedBy(client.Raw(), *d.LinkedBalanceID, d.UserID) {
			http.Error(w, "Linked account not found for this user", http.StatusBadRequest)
			return
		}
		linkedVal = *d.LinkedBalanceID
	}

	_, err = client.Exec(`
		INSERT INTO debt_accounts (id, user_id, household_id, name, balance, original_balance, apr, min_payment, due_day, strategy, is_shared, debt_category, liability_type, asset_depreciates, linked_balance_id)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
	`, d.ID, d.UserID, hhVal, d.Name, d.Balance, d.Balance, d.APR, d.MinPayment, d.DueDay, d.Strategy, d.IsShared, d.DebtCategory, d.LiabilityType, d.AssetDepreciates, linkedVal)
	if err != nil {
		if strings.Contains(err.Error(), "idx_debt_accounts_linked_balance") {
			http.Error(w, "That account is already linked to another debt", http.StatusConflict)
			return
		}
		log.Printf("CreateDebt insert error: %v", err)
		http.Error(w, "Insert error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// A linked debt's balance IS the account balance — snap it immediately.
	if linkedVal != nil {
		snapLinkedDebtBalance(client.Raw(), d.ID)
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(d)
}

// snapLinkedDebtBalance mirrors the linked account's balance into one debt's
// balance (used right after linking; syncs keep it fresh afterwards). Credit
// and loan balances arrive negative from some providers — what's owed is the
// magnitude. The opening balance rises with it so "% paid" never reads
// negative.
func snapLinkedDebtBalance(conn *sql.DB, debtID string) {
	if _, err := conn.Exec(`
		UPDATE debt_accounts d
		SET balance = ABS(ab.current_balance),
		    original_balance = GREATEST(COALESCE(d.original_balance, 0), ABS(ab.current_balance))
		FROM account_balances ab
		WHERE d.id = $1 AND d.linked_balance_id = ab.id
	`, debtID); err != nil {
		log.Printf("snapLinkedDebtBalance error: %v", err)
	}
}

func UpdateDebt(w http.ResponseWriter, r *http.Request) {
	debtID := mux.Vars(r)["id"]
	if debtID == "" {
		http.Error(w, "Missing debt id", http.StatusBadRequest)
		return
	}

	var d models.DebtAccount
	if err := json.NewDecoder(r.Body).Decode(&d); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	var linkedVal any
	linking := d.LinkedBalanceID != nil && *d.LinkedBalanceID != ""
	if linking {
		if d.UserID == "" {
			d.UserID = r.URL.Query().Get("user_id")
		}
		if !balanceOwnedBy(client.Raw(), *d.LinkedBalanceID, d.UserID) {
			http.Error(w, "Linked account not found for this user", http.StatusBadRequest)
			return
		}
		linkedVal = *d.LinkedBalanceID
	}

	// A manual balance edit above the recorded opening balance means the debt
	// grew (new charges, corrected entry) — raise the baseline so "% paid"
	// never reads negative.
	res, err := client.Exec(`
		UPDATE debt_accounts
		SET name=$1, balance=$2, apr=$3, min_payment=$4, due_day=$5, strategy=$6, is_shared=$7,
		    original_balance = GREATEST(COALESCE(original_balance, $2), $2),
		    linked_balance_id = $8
		WHERE id=$9
	`, d.Name, d.Balance, d.APR, d.MinPayment, d.DueDay, d.Strategy, d.IsShared, linkedVal, debtID)
	if err != nil {
		if strings.Contains(err.Error(), "idx_debt_accounts_linked_balance") {
			http.Error(w, "That account is already linked to another debt", http.StatusConflict)
			return
		}
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Debt not found", http.StatusNotFound)
		return
	}

	// A linked debt's balance IS the account balance — the client-sent balance
	// is overridden by the real number.
	if linking {
		snapLinkedDebtBalance(client.Raw(), debtID)
	}

	d.ID = debtID
	json.NewEncoder(w).Encode(d)
}

func ApplyDebtPayment(w http.ResponseWriter, r *http.Request) {
	debtID := mux.Vars(r)["id"]
	if debtID == "" {
		http.Error(w, "Missing debt id", http.StatusBadRequest)
		return
	}

	var body struct {
		Amount float64 `json:"amount"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	// Balance-linked debts mirror a real account — a manual payment entry
	// would be overwritten on the next sync and misstate what's owed.
	var linked sql.NullString
	_ = client.QueryRow(`SELECT linked_balance_id::text FROM debt_accounts WHERE id = $1`, debtID).Scan(&linked)
	if linked.Valid && linked.String != "" {
		http.Error(w, "This debt tracks a linked bank account — its balance updates automatically from the account", http.StatusConflict)
		return
	}

	// Decrease balance but not below zero
	_, err = client.Exec(`
		UPDATE debt_accounts
		SET balance = GREATEST(balance - $1, 0)
		WHERE id = $2
	`, body.Amount, debtID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}

	var updated models.DebtAccount
	row := client.QueryRow(`
		SELECT id, user_id, name, balance, apr, min_payment, due_day, COALESCE(strategy, ''), is_shared
		FROM debt_accounts WHERE id = $1
	`, debtID)
	var dueDay sql.NullInt32
	if err := row.Scan(&updated.ID, &updated.UserID, &updated.Name, &updated.Balance, &updated.APR, &updated.MinPayment, &dueDay, &updated.Strategy, &updated.IsShared); err != nil {
		http.Error(w, "Debt not found", http.StatusNotFound)
		return
	}
	if dueDay.Valid {
		val := int(dueDay.Int32)
		updated.DueDay = &val
	}

	json.NewEncoder(w).Encode(updated)
}

// PriorityTarget is one rankable target — a savings goal or a debt — with its
// rank. Priorities are now an ordering over real targets, not free text; this
// order drives plan allocation.
type PriorityTarget struct {
	TargetID   string `json:"target_id"`
	TargetType string `json:"target_type"` // savings_goal | debt
	Name       string `json:"name"`
	Rank       int    `json:"rank"` // 0 = unranked (sorts last)
	// Savings context
	Current    float64 `json:"current"`
	Target     float64 `json:"target"`
	TargetDate string  `json:"target_date,omitempty"`
	// Debt context
	Balance    float64 `json:"balance"`
	APR        float64 `json:"apr"`
	MinPayment float64 `json:"min_payment"`
	// EffectiveMonthly is the total $/month allocated to this target summed across
	// all active plans — the single source of truth for "how much toward it".
	EffectiveMonthly float64 `json:"effective_monthly"`
}

// scopeKeyFor returns the value used to scope a household's shared entities: the
// household id when in a household, else the user id (solo).
func scopeKeyFor(conn *sql.DB, userID string) (scopeKey, householdID string) {
	hh := db.ResolveHouseholdID(conn, userID)
	if hh != "" {
		return hh, hh
	}
	return userID, ""
}

// ListFinancialPriorities returns the couple's savings goals and debts as ONE
// ranked list. Unranked targets sort last (rank 0), then by name. This ordering
// is the single source of truth that plan allocation follows.
func ListFinancialPriorities(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	scopeKey, hh := scopeKeyFor(client.Raw(), userID)

	// Scope predicate for goals/debts: household rows + personal rows, or just
	// personal when solo. $1 = scopeKey (for the rank join), $2/$3 = scope args.
	var goalWhere, debtWhere string
	args := []interface{}{scopeKey}
	if hh == "" {
		goalWhere, debtWhere = "g.user_id = $2", "d.user_id = $2"
		args = append(args, userID)
	} else {
		goalWhere = "(g.household_id::text = $2 OR (g.household_id IS NULL AND g.user_id = $3))"
		debtWhere = "(d.household_id::text = $2 OR (d.household_id IS NULL AND d.user_id = $3))"
		args = append(args, hh, userID)
	}

	out := []PriorityTarget{}

	// Savings goals
	grows, err := client.Query(`
		SELECT g.id::text, g.name, COALESCE(g.current_amount,0), COALESCE(g.target_amount,0),
		       COALESCE(g.target_date,''), COALESCE(fp.rank, 0)
		FROM savings_goals g
		LEFT JOIN financial_priorities fp
		  ON fp.target_id = g.id AND fp.target_type = 'savings_goal'
		 AND COALESCE(fp.household_id::text, fp.user_id::text) = $1
		WHERE `+goalWhere, args...)
	if err != nil {
		log.Printf("ListFinancialPriorities goals query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	for grows.Next() {
		p := PriorityTarget{TargetType: "savings_goal"}
		if err := grows.Scan(&p.TargetID, &p.Name, &p.Current, &p.Target, &p.TargetDate, &p.Rank); err == nil {
			out = append(out, p)
		}
	}
	grows.Close()

	// Debts
	drows, err := client.Query(`
		SELECT d.id::text, d.name, COALESCE(d.balance,0), COALESCE(d.apr,0),
		       COALESCE(d.min_payment,0), COALESCE(fp.rank, 0)
		FROM debt_accounts d
		LEFT JOIN financial_priorities fp
		  ON fp.target_id = d.id AND fp.target_type = 'debt'
		 AND COALESCE(fp.household_id::text, fp.user_id::text) = $1
		WHERE `+debtWhere, args...)
	if err != nil {
		log.Printf("ListFinancialPriorities debts query error: %v", err)
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	for drows.Next() {
		p := PriorityTarget{TargetType: "debt"}
		if err := drows.Scan(&p.TargetID, &p.Name, &p.Balance, &p.APR, &p.MinPayment, &p.Rank); err == nil {
			out = append(out, p)
		}
	}
	drows.Close()

	// Overlay the effective $/month per target (summed across active plans).
	eff := effectiveMonthlyByTarget(client.Raw(), userID)
	for i := range out {
		out[i].EffectiveMonthly = eff[out[i].TargetID]
	}

	// Rank order: ranked first (ascending), unranked (0) last, then name.
	sort.SliceStable(out, func(i, j int) bool {
		ri, rj := out[i].Rank, out[j].Rank
		if (ri == 0) != (rj == 0) {
			return rj == 0 // non-zero (ranked) before zero (unranked)
		}
		if ri != rj {
			return ri < rj
		}
		return out[i].Name < out[j].Name
	})

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

func CreateFinancialPriority(w http.ResponseWriter, r *http.Request) {
	var p models.FinancialPriority
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.UserID == "" {
		p.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(p.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	p.UserID = userID

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if p.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), p.UserID); hh != "" {
			p.HouseholdID = hh
		}
	}
	if p.IsShared && p.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	_, err = client.Exec(`
		INSERT INTO financial_priorities (id, user_id, household_id, title, rank, notes, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7)
	`, p.ID, p.UserID, p.HouseholdID, p.Title, p.Rank, p.Notes, p.IsShared)
	if err != nil {
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(p)
}

func UpdateFinancialPriority(w http.ResponseWriter, r *http.Request) {
	priorityID := mux.Vars(r)["id"]
	if priorityID == "" {
		http.Error(w, "Missing priority id", http.StatusBadRequest)
		return
	}

	var p models.FinancialPriority
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	res, err := client.Exec(`
		UPDATE financial_priorities
		SET title=$1, rank=$2, notes=$3, is_shared=$4
		WHERE id=$5
	`, p.Title, p.Rank, p.Notes, p.IsShared, priorityID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Priority not found", http.StatusNotFound)
		return
	}

	p.ID = priorityID
	json.NewEncoder(w).Encode(p)
}

func DeleteFinancialPriority(w http.ResponseWriter, r *http.Request) {
	priorityID := mux.Vars(r)["id"]
	if priorityID == "" {
		http.Error(w, "Missing priority id", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	res, err := client.Exec(`DELETE FROM financial_priorities WHERE id=$1`, priorityID)
	if err != nil {
		http.Error(w, "Delete error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Priority not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// ReorderFinancialPriorities sets each target's rank from an ordered list.
// Body: { "user_id": "...", "order": [ {"target_id","target_type"}, ... ] }.
// Ranks are written 1..N into financial_priorities (upsert per target, scoped to
// the household so both partners share one ranking).
func ReorderFinancialPriorities(w http.ResponseWriter, r *http.Request) {
	var body struct {
		UserID string `json:"user_id"`
		Order  []struct {
			TargetID   string `json:"target_id"`
			TargetType string `json:"target_type"`
		} `json:"order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
		return
	}
	uid := body.UserID
	if uid == "" {
		uid = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(uid)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	if len(body.Order) == 0 {
		http.Error(w, "Order required", http.StatusBadRequest)
		return
	}

	client, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	_, hh := scopeKeyFor(client.Raw(), userID)
	var hhArg interface{}
	if hh != "" {
		hhArg = hh
	}

	for idx, item := range body.Order {
		if item.TargetID == "" || (item.TargetType != "savings_goal" && item.TargetType != "debt") {
			continue
		}
		_, err := client.Exec(`
			INSERT INTO financial_priorities (id, user_id, household_id, target_id, target_type, rank)
			VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
			ON CONFLICT (COALESCE(household_id, user_id), target_id, target_type) WHERE target_id IS NOT NULL
			DO UPDATE SET rank = EXCLUDED.rank
		`, userID, hhArg, item.TargetID, item.TargetType, idx+1)
		if err != nil {
			log.Printf("ReorderFinancialPriorities upsert error: %v", err)
			http.Error(w, "Update error", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{"status": "ok"})
}

func ListTrips(w http.ResponseWriter, r *http.Request) {
	userID, err := sanitizeUserID(r.URL.Query().Get("user_id"))
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	hh := db.ResolveHouseholdID(client.Raw(), userID)

	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), name, destination, start_date, end_date, budget, is_shared
			FROM trips
			WHERE household_id IS NULL AND user_id = $1
		`, userID)
	} else {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), name, destination, start_date, end_date, budget, is_shared
			FROM trips
			WHERE household_id = $1 OR is_shared = TRUE
		`, hh)
	}
	if err != nil {
		http.Error(w, "Query error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var trips []models.Trip
	for rows.Next() {
		var (
			t    models.Trip
			hhID string
		)
		if err := rows.Scan(&t.ID, &t.UserID, &hhID, &t.Name, &t.Destination, &t.StartDate, &t.EndDate, &t.Budget, &t.IsShared); err != nil {
			log.Printf("ListTrips scan error: %v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		t.HouseholdID = hhID
		trips = append(trips, t)
	}

	json.NewEncoder(w).Encode(trips)
}

func CreateTrip(w http.ResponseWriter, r *http.Request) {
	var t models.Trip
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		log.Printf("CreateTrip decode error: %v", err)
		http.Error(w, "Invalid body: "+err.Error(), http.StatusBadRequest)
		return
	}
	if t.ID == "" {
		t.ID = uuid.New().String()
	}
	if t.UserID == "" {
		t.UserID = r.URL.Query().Get("user_id")
	}
	userID, err := sanitizeUserID(t.UserID)
	if err != nil {
		http.Error(w, "Missing or invalid user_id", http.StatusBadRequest)
		return
	}
	t.UserID = userID

	client, err := plannerDBFactory()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer client.Close()

	if t.HouseholdID == "" {
		if hh := db.ResolveHouseholdID(client.Raw(), t.UserID); hh != "" {
			t.HouseholdID = hh
		}
	}
	if t.IsShared && t.HouseholdID == "" {
		http.Error(w, "Join or create a household before creating shared items", http.StatusBadRequest)
		return
	}

	_, err = client.Exec(`
		INSERT INTO trips (id, user_id, household_id, name, destination, start_date, end_date, budget, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`, t.ID, t.UserID, t.HouseholdID, t.Name, t.Destination, t.StartDate, t.EndDate, t.Budget, t.IsShared)
	if err != nil {
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(t)
}
