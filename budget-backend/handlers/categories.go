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

// scanCategory scans a single category row including the new hierarchy columns.
func scanCategory(rows *sql.Rows) (models.Category, error) {
	var c models.Category
	var hhID sql.NullString
	var budgetID sql.NullString
	var parentID sql.NullString
	var icon sql.NullString

	err := rows.Scan(
		&c.ID, &c.Name, &c.UserID, &c.Type, &c.Color,
		&hhID, &budgetID, &c.LimitAmount, &c.RolloverEnabled,
		&parentID, &icon, &c.SortOrder,
	)
	if err != nil {
		return c, err
	}

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
	if parentID.Valid {
		c.ParentID = &parentID.String
	}
	if icon.Valid {
		c.Icon = &icon.String
	}

	return c, nil
}

// buildCategoryTree groups flat category rows into a parent->children tree.
// Top-level categories (parent_id IS NULL) become roots; children are nested.
func buildCategoryTree(flat []models.Category) []models.Category {
	byID := make(map[string]*models.Category, len(flat))
	var roots []*models.Category

	// First pass: index all by ID
	for i := range flat {
		cat := &flat[i]
		cat.Subcategories = nil // ensure empty slice is omitted in JSON
		byID[cat.ID.String()] = cat
	}

	// Second pass: attach children to parents
	for i := range flat {
		cat := &flat[i]
		if cat.ParentID != nil {
			if parent, ok := byID[*cat.ParentID]; ok {
				parent.Subcategories = append(parent.Subcategories, *cat)
			} else {
				// orphan — treat as root
				roots = append(roots, cat)
			}
		} else {
			roots = append(roots, cat)
		}
	}

	result := make([]models.Category, 0, len(roots))
	for _, r := range roots {
		result = append(result, *r)
	}
	return result
}

const categoryCols = `c.id, c.name, c.user_id, c.type, c.color, c.household_id,
	bc.budget_id, c.limit_amount, c.rollover_enabled,
	c.parent_id, c.icon, COALESCE(c.sort_order, 0)`

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
		SELECT `+categoryCols+`
		FROM categories c
		LEFT JOIN budget_categories bc ON bc.category_id = c.id
		WHERE c.type = $1 AND c.user_id IS NULL
		ORDER BY c.parent_id NULLS FIRST, COALESCE(c.sort_order, 0), c.name ASC
	`, categoryType)
	if err != nil {
		http.Error(w, "Failed to fetch categories", http.StatusInternalServerError)
		log.Printf("Query error: %v", err)
		return
	}
	defer rows.Close()

	var flat []models.Category
	for rows.Next() {
		cat, err := scanCategory(rows)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		flat = append(flat, cat)
	}

	tree := buildCategoryTree(flat)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tree)
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

	// Validate parent_id if provided
	if category.ParentID != nil && *category.ParentID != "" {
		var parentParentID sql.NullString
		var parentType string
		err := conn.QueryRow(`SELECT parent_id, type FROM categories WHERE id = $1`, *category.ParentID).
			Scan(&parentParentID, &parentType)
		if err != nil {
			http.Error(w, "Parent category not found", http.StatusBadRequest)
			log.Printf("Parent lookup error: %v", err)
			return
		}
		// Enforce max depth = 2: parent must not itself have a parent
		if parentParentID.Valid {
			http.Error(w, "Cannot nest deeper than 2 levels", http.StatusBadRequest)
			log.Print("Attempted to create category at depth > 2")
			return
		}
		// Inherit type from parent if not explicitly set differently
		if category.Type == "" {
			category.Type = parentType
		}
	}

	if category.UserID != nil {
		if hhStr := db.ResolveHouseholdID(conn.Conn, category.UserID.String()); hhStr != "" {
			hhUUID, err := uuid.FromString(hhStr)
			if err == nil {
				category.HouseholdID = &hhUUID
			}
		}
	}

	_, err = conn.Exec(`
		INSERT INTO categories (id, name, user_id, household_id, type, color, limit_amount, rollover_enabled, parent_id, icon, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7,0), COALESCE($8,false), $9, $10, COALESCE($11,0))
	`, category.ID, category.Name, category.UserID, category.HouseholdID, category.Type, category.Color,
		category.LimitAmount, category.RolloverEnabled, category.ParentID, category.Icon, category.SortOrder)
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
			SELECT `+categoryCols+`
			FROM categories c
			LEFT JOIN budget_categories bc ON bc.category_id = c.id
			WHERE (c.household_id IS NULL AND (c.user_id = $1 OR c.user_id IS NULL))
			   OR c.user_id IS NULL
			ORDER BY c.parent_id NULLS FIRST, COALESCE(c.sort_order, 0), c.name ASC
		`, userID)
	} else {
		rows, err = conn.Query(`
			SELECT `+categoryCols+`
			FROM categories c
			LEFT JOIN budget_categories bc ON bc.category_id = c.id
			WHERE c.household_id = $1
			   OR c.user_id IN (SELECT user_id FROM household_members WHERE household_id = $1)
			   OR c.user_id IS NULL
			ORDER BY c.parent_id NULLS FIRST, COALESCE(c.sort_order, 0), c.name ASC
		`, hh)
	}
	if err != nil {
		log.Printf("Query error: %v", err)
		return nil, err
	}
	defer rows.Close()

	var flat []models.Category
	for rows.Next() {
		c, err := scanCategory(rows)
		if err != nil {
			log.Printf("Scan error: %v", err)
			continue
		}
		flat = append(flat, c)
	}

	tree := buildCategoryTree(flat)
	return tree, nil
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
		SET name = $1, color = $2, limit_amount = COALESCE($3, limit_amount),
		    rollover_enabled = COALESCE($4, rollover_enabled),
		    icon = COALESCE($5, icon), sort_order = COALESCE($6, sort_order)
		WHERE id = $7
	`, category.Name, category.Color, category.LimitAmount, category.RolloverEnabled,
		category.Icon, category.SortOrder, uid)
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

	category.ID = uid
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

	// Reject deletion if category has children
	var childCount int
	err = conn.QueryRow(`SELECT COUNT(*) FROM categories WHERE parent_id = $1`, uid).Scan(&childCount)
	if err != nil {
		http.Error(w, "Failed to check subcategories", http.StatusInternalServerError)
		log.Printf("Child count error: %v", err)
		return
	}
	if childCount > 0 {
		http.Error(w, "Cannot delete category with subcategories. Delete subcategories first.", http.StatusConflict)
		log.Printf("Rejected delete of category %s: has %d children", uid, childCount)
		return
	}

	_, err = conn.Exec(`DELETE FROM categories WHERE id = $1`, uid)
	if err != nil {
		http.Error(w, "Failed to delete category", http.StatusInternalServerError)
		log.Printf("Delete error: %v", err)
		return
	}

	log.Printf("Category deleted: %s", uid)
	w.WriteHeader(http.StatusNoContent)
}
