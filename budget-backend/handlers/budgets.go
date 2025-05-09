package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"

	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

func CreateBudget(w http.ResponseWriter, r *http.Request) {
	var budget models.Budget
	if err := json.NewDecoder(r.Body).Decode(&budget); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	if budget.ID == "" {
		budget.ID = uuid.Must(uuid.NewV4()).String()
	}
	budget.CreatedAt = time.Now()
	budget.UpdatedAt = time.Now()

	dbClient, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	_, err = dbClient.Exec(`
		INSERT INTO budgets (
			id, user_id, name, amount, type, category_id, created_at, updated_at, start_date
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, budget.ID, budget.UserID, budget.Name, budget.Amount, budget.Type, budget.CategoryID, budget.CreatedAt, budget.UpdatedAt, budget.StartDate)
	if err != nil {
		http.Error(w, "Failed to create budget", http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(budget)
}

func GetBudgetsByUser(w http.ResponseWriter, r *http.Request) {
	userID := mux.Vars(r)["user_id"]
	UserUUID, err := uuid.FromString(userID)
	monthStr := r.URL.Query().Get("month")
	yearStr := r.URL.Query().Get("year")
	month, _ := strconv.Atoi(monthStr)
	year, _ := strconv.Atoi(yearStr)

	log.Print("Getting budget by user: ", UserUUID)
	log.Printf("Month: %v and Year %v", month, year)

	dbClient, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	rows, err := dbClient.Query(`
		SELECT 
			b.id, b.user_id, b.name, b.amount, b.type, 
			b.category_id, c.name AS category_name, 
			b.created_at, b.updated_at, b.start_date
		FROM budgets b
		LEFT JOIN categories c ON b.category_id = c.id
		WHERE b.user_id = $1 
	`, UserUUID)
	if err != nil {
		http.Error(w, "Failed to fetch budgets", http.StatusInternalServerError)
		log.Printf("Failed to fetch budgets: %v", err)
		return
	}
	defer rows.Close()

	var budgets []models.Budget
	for rows.Next() {
		var b models.Budget
		if err := rows.Scan(&b.ID, &b.UserID, &b.Name, &b.Amount, &b.Type, &b.CategoryID, &b.CategoryName, &b.CreatedAt, &b.UpdatedAt, &b.StartDate); err == nil {
			budgets = append(budgets, b)
		}
	}

	// ✅ Always return valid JSON
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(budgets)

}

func UpdateBudget(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]
	var budget models.Budget
	if err := json.NewDecoder(r.Body).Decode(&budget); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}
	budget.UpdatedAt = time.Now()

	dbClient, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	_, err = dbClient.Exec(`
		UPDATE budgets
		SET name = $1, amount = $2, type = $3, category_id = $4, updated_at = $5
		WHERE id = $6
	`, budget.Name, budget.Amount, budget.Type, budget.CategoryID, budget.UpdatedAt, id)
	if err != nil {
		http.Error(w, "Failed to update budget", http.StatusInternalServerError)
		return
	}
	budget.ID = id
	json.NewEncoder(w).Encode(budget)
}

func DeleteBudget(w http.ResponseWriter, r *http.Request) {
	id := mux.Vars(r)["id"]

	dbClient, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		return
	}
	defer dbClient.Close()

	_, err = dbClient.Exec("DELETE FROM budgets WHERE id = $1", id)
	if err != nil {
		http.Error(w, "Failed to delete budget", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
