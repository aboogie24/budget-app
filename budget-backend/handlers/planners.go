package handlers

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
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
	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), name, target_amount, current_amount, COALESCE(target_date, ''), priority, is_shared
			FROM savings_goals
			WHERE household_id IS NULL AND user_id = $1
		`, userID)
	} else {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), name, target_amount, current_amount, COALESCE(target_date, ''), priority, is_shared
			FROM savings_goals
			WHERE household_id = $1
			   OR (household_id IS NULL AND user_id = $2)
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
		if err := rows.Scan(&g.ID, &g.UserID, &hh, &g.Name, &g.TargetAmount, &g.CurrentAmount, &targetDate, &g.Priority, &g.IsShared); err != nil {
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
		goals = append(goals, g)
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

	_, err = client.Exec(`
		INSERT INTO savings_goals (id, user_id, household_id, name, target_amount, current_amount, target_date, priority, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
	`, g.ID, g.UserID, hhVal, g.Name, g.TargetAmount, g.CurrentAmount, g.TargetDate, g.Priority, g.IsShared)
	if err != nil {
		http.Error(w, "Insert error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(g)
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

	res, err := client.Exec(`
		UPDATE savings_goals
		SET name = $1, target_amount = $2, current_amount = $3, target_date = $4, priority = $5, is_shared = $6
		WHERE id = $7
	`, g.Name, g.TargetAmount, g.CurrentAmount, g.TargetDate, g.Priority, g.IsShared, goalID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Goal not found", http.StatusNotFound)
		return
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
		SELECT id, user_id, COALESCE(household_id::text, ''), name, balance, apr, min_payment, due_day, COALESCE(strategy, ''), is_shared, COALESCE(source, 'manual')
		FROM debt_accounts
		WHERE user_id = $1
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
			d      models.DebtAccount
			dueDay sql.NullInt32
			hhID   string
		)
		if err := rows.Scan(&d.ID, &d.UserID, &hhID, &d.Name, &d.Balance, &d.APR, &d.MinPayment, &dueDay, &d.Strategy, &d.IsShared, &d.Source); err != nil {
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

	_, err = client.Exec(`
		INSERT INTO debt_accounts (id, user_id, household_id, name, balance, apr, min_payment, due_day, strategy, is_shared)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
	`, d.ID, d.UserID, hhVal, d.Name, d.Balance, d.APR, d.MinPayment, d.DueDay, d.Strategy, d.IsShared)
	if err != nil {
		log.Printf("CreateDebt insert error: %v", err)
		http.Error(w, "Insert error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(d)
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

	res, err := client.Exec(`
		UPDATE debt_accounts
		SET name=$1, balance=$2, apr=$3, min_payment=$4, due_day=$5, strategy=$6, is_shared=$7
		WHERE id=$8
	`, d.Name, d.Balance, d.APR, d.MinPayment, d.DueDay, d.Strategy, d.IsShared, debtID)
	if err != nil {
		http.Error(w, "Update error", http.StatusInternalServerError)
		return
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		http.Error(w, "Debt not found", http.StatusNotFound)
		return
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

	hh := db.ResolveHouseholdID(client.Raw(), userID)
	var rows *sql.Rows
	if hh == "" {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), title, rank, COALESCE(notes, ''), is_shared
			FROM financial_priorities
			WHERE household_id IS NULL AND user_id = $1
		`, userID)
	} else {
		rows, err = client.Query(`
			SELECT id, user_id, COALESCE(household_id::text, ''), title, rank, COALESCE(notes, ''), is_shared
			FROM financial_priorities
			WHERE household_id = $1
			   OR (household_id IS NULL AND user_id = $2)
		`, hh, userID)
	}
	if err != nil {
		log.Printf("ListFinancialPriorities query error: %v", err)
		http.Error(w, "Query error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var priorities []models.FinancialPriority
	for rows.Next() {
		var (
			p    models.FinancialPriority
			hhID string
		)
		if err := rows.Scan(&p.ID, &p.UserID, &hhID, &p.Title, &p.Rank, &p.Notes, &p.IsShared); err != nil {
			log.Printf("ListFinancialPriorities scan error: %v", err)
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		p.HouseholdID = hhID
		priorities = append(priorities, p)
	}

	json.NewEncoder(w).Encode(priorities)
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

func ReorderFinancialPriorities(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Order []string `json:"order"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, "Invalid body", http.StatusBadRequest)
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

	// assign ranks sequentially (1-based)
	for idx, id := range body.Order {
		_, err := client.Exec(`UPDATE financial_priorities SET rank=$1 WHERE id=$2`, idx+1, id)
		if err != nil {
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
