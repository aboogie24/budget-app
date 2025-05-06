package handlers

import (
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

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, name FROM categories
		WHERE type = $1 AND user_id IS NULL
		ORDER BY name ASC
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
		if err := rows.Scan(&cat.ID, &cat.Name); err == nil {
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

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		INSERT INTO categories (id, name, user_id, type, color)
		VALUES ($1, $2, $3, $4, $5)
	`, category.ID, category.Name, category.UserID, category.Type, category.Color)
	if err != nil {
		http.Error(w, "Failed to insert category", http.StatusInternalServerError)
		log.Printf("Insert error: %v", err)
		return
	}

	log.Printf("Category created: %s", category.Name)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(category)
}

func GetCategoriesForUser(userID string) ([]models.Category, error) {
	conn, err := db.Init()
	if err != nil {
		log.Printf("DB connection error: %v", err)
		return nil, err
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, name, user_id, type, color FROM categories
		WHERE user_id = $1 
		ORDER BY name ASC
	`, userID)
	if err != nil {
		log.Printf("Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var categories []models.Category
	for rows.Next() {
		var c models.Category
		err := rows.Scan(&c.ID, &c.Name, &c.UserID, &c.Type, &c.Color)
		if err == nil {
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

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error")
		return
	}
	defer conn.Close()

	_, err = conn.Exec(`
		UPDATE categories
		SET name = $1, color = $2
		WHERE id = $3
	`, category.Name, category.Color, uid)
	if err != nil {
		http.Error(w, "Failed to update category", http.StatusInternalServerError)
		log.Printf("Update error: %v", err)
		return
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

	conn, err := db.Init()
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
