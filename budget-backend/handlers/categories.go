package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
)

func GetCategories(w http.ResponseWriter, r *http.Request) {
	categoryType := r.URL.Query().Get("type")

	log.Printf("GetCategories request received. Type: %s", categoryType)

	if categoryType != "income" && categoryType != "expense" {
		http.Error(w, "Invalid category type", http.StatusBadRequest)
		log.Print("Invalid category type", http.StatusBadRequest)
		return
	}

	conn, err := db.Init()
	if err != nil {
		http.Error(w, "DB connection error", http.StatusInternalServerError)
		log.Print("DB connection error", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	rows, err := conn.Query(`
		SELECT id, name FROM categories
		WHERE type = $1 AND user_id IS NULL
		ORDER BY name ASC
	`, categoryType)
	log.Print(err)
	if err != nil {
		http.Error(w, "Failed to fetch categories", http.StatusInternalServerError)
		log.Print("Failed to fetch categories", http.StatusInternalServerError)
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
