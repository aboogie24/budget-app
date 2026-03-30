package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

func GetCategories(w http.ResponseWriter, r *http.Request) {
	categoryType := r.URL.Query().Get("type")

	log.Printf("GetCategories request received. Type: %s", categoryType)

	if categoryType != "income" && categoryType != "expense" {
		http.Error(w, "Invalid category type", http.StatusBadRequest)
		log.Print("Invalid category type")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT c.id, c.name, bc.budget_id, c.limit_amount, c.rollover_enabled
		FROM categories c
		LEFT JOIN budget_categories bc ON bc.category_id = c.id
		WHERE c.type = $1 AND c.user_id IS NULL
		ORDER BY c.name ASC
	`, categoryType)
	if err != nil {
		http.Error(w, "Failed to fetch categories", http.StatusInternalServerError)
		log.Print("Failed to fetch categories")
		return
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var cat models.Category
		var budgetID sql.NullString
		if err := rows.Scan(&cat.ID, &cat.Name, &budgetID, &cat.LimitAmount, &cat.RolloverEnabled); err == nil {
			if budgetID.Valid {
				if bid, err := uuid.FromString(budgetID.String); err == nil {
					cat.BudgetID = &bid
				}
			}
			categories = append(categories, cat)
		}
	}

	json.NewEncoder(w).Encode(categories)
}

func CreateCategory(w http.ResponseWriter, r *http.Request) {
	var category models.Category

	if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("Invalid JSON: %v", err)
		return
	}

	if category.ID == uuid.Nil || category.Name == "" || category.Type == "" {
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		log.Print("Missing required category fields")
		return
	}

	if category.Type != "income" && category.Type != "expense" {
		http.Error(w, "Invalid category type", http.StatusBadRequest)
		log.Print("Invalid category type")
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	if category.UserID != nil {
		if hhStr := db.ResolveHouseholdID(conn.Conn, category.UserID.String()); hhStr != "" {
			hhUUID, err := uuid.FromString(hhStr)
			if err == nil {
				category.HouseholdID = &hhUUID
			}
		}
	}

	_, err = conn.Exec(`
		INSERT INTO categories (id, name, user_id, household_id, type, color, limit_amount, rollover_enabled)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7,0), COALESCE($8,false))
	`, category.ID, category.Name, category.UserID, category.HouseholdID, category.Type, category.Color, category.LimitAmount, category.RolloverEnabled)
	if err != nil {
		http.Error(w, "Failed to insert category", http.StatusInternalServerError)
		log.Printf("Insert error: %v", err)
		return
	}
	if category.BudgetID != nil {
		_, _ = conn.Exec(`
			INSERT INTO budget_categories (budget_id, category_id)
			VALUES ($1, $2)
			ON CONFLICT (category_id) DO UPDATE SET budget_id = EXCLUDED.budget_id
		`, category.BudgetID, category.ID)
	}

	log.Printf("Category created: %s", category.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func GetCategoriesForUser(userID string) ([]models.Category, error) {
	conn, err := db.New()
	if err != nil {
		log.Printf("DB connection error: %v", err)
		return nil, err
	}
	defer conn.Close()

	hh := db.ResolveHouseholdID(conn.Conn, userID)

	var rows *sql.Rows
	if hh == "" {
		rows, err = conn.Query(`
			SELECT c.id, c.name, c.user_id, c.type, c.color, c.household_id, bc.budget_id, c.limit_amount, c.rollover_enabled
			FROM categories c
			LEFT JOIN budget_categories bc ON bc.category_id = c.id
			WHERE (c.household_id IS NULL AND (c.user_id = $1 OR c.user_id IS NULL))
			   OR c.user_id IS NULL
			ORDER BY c.name ASC
		`, userID)
	} else {
		rows, err = conn.Query(`
			SELECT c.id, c.name, c.user_id, c.type, c.color, c.household_id, bc.budget_id, c.limit_amount, c.rollover_enabled
			FROM categories c
			LEFT JOIN budget_categories bc ON bc.category_id = c.id
			WHERE c.household_id = $1
			   OR c.user_id IN (SELECT user_id FROM household_members WHERE household_id = $1)
			   OR c.user_id IS NULL
			ORDER BY c.name ASC
		`, hh)
	}
	if err != nil {
		log.Printf("Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var c models.Category
		var hhID sql.NullString
		var budgetID sql.NullString
		err := rows.Scan(&c.ID, &c.Name, &c.UserID, &c.Type, &c.Color, &hhID, &budgetID, &c.LimitAmount, &c.RolloverEnabled)
		if err == nil {
			if hhID.Valid {
				if uuidVal, err := uuid.FromString(hhID.String); err == nil {
					c.HouseholdID = &uuidVal
				}
			}
			if budgetID.Valid {
				if uuidVal, err := uuid.FromString(budgetID.String); err == nil {
					c.BudgetID = &uuidVal
				}
			}
			categories = append(categories, c)
		}
	}

	return categories, nil
}

func GetCategoriesByUserID(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	categories, err := GetCategoriesForUser(userID)
	if err != nil {
		http.Error(w, "Failed to fetch categories", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

func UpdateCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var category models.Category
	if err := json.NewDecoder(r.Body).Decode(&category); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		log.Printf("Invalid JSON: %v", err)
		return
	}

	uid, err := uuid.FromString(id)
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		log.Printf("Invalid UUID format: %v", err)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		UPDATE categories
		SET name = $1, color = $2, limit_amount = COALESCE($3, limit_amount), rollover_enabled = COALESCE($4, rollover_enabled)
		WHERE id = $5
	`, category.Name, category.Color, category.LimitAmount, category.RolloverEnabled, uid)
	if err != nil {
		http.Error(w, "Failed to update category", http.StatusInternalServerError)
		log.Printf("Update error: %v", err)
		return
	}
	_, _ = conn.Exec(`DELETE FROM budget_categories WHERE category_id = $1`, uid)
	if category.BudgetID != nil {
		_, _ = conn.Exec(`
			INSERT INTO budget_categories (budget_id, category_id)
			VALUES ($1, $2)
			ON CONFLICT (category_id) DO UPDATE SET budget_id = EXCLUDED.budget_id
		`, category.BudgetID, uid)
	}

	category.ID = uid // ✅ UUID assignment
	log.Printf("Category updated: %s", category.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func DeleteCategory(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	uid, err := uuid.FromString(id)
	if err != nil {
		http.Error(w, "Invalid category ID", http.StatusBadRequest)
		log.Printf("Invalid UUID format: %v", err)
		return
	}

	conn, err := db.New()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`DELETE FROM categories WHERE id = $1`, uid)
	if err != nil {
		http.Error(w, "Failed to delete category", http.StatusInternalServerError)
		log.Printf("Delete error: %v", err)
		return
	}

	log.Printf("Category deleted: %s", uid)
	w.WriteHeader(http.StatusNoContent)
}
