package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/db"
	"github.com/gofrs/uuid"
	"github.com/gorilla/mux"
)

func TestCreateCategory_ValidCreation(t *testing.T) {
	categoryID := uuid.Must(uuid.NewV4())
	userID := uuid.Must(uuid.NewV4())

	body := map[string]interface{}{
		"id":    categoryID.String(),
		"name":  "Groceries",
		"type":  "expense",
		"color": "#FF5733",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateCategory(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if result["name"] != "Groceries" {
		t.Fatalf("expected name=Groceries, got %v", result["name"])
	}
}

func TestCreateCategory_MissingRequired(t *testing.T) {
	tests := []struct {
		name string
		body map[string]interface{}
	}{
		{"missing id", map[string]interface{}{"name": "Groceries", "type": "expense"}},
		{"missing name", map[string]interface{}{"id": uuid.Must(uuid.NewV4()).String(), "type": "expense"}},
		{"missing type", map[string]interface{}{"id": uuid.Must(uuid.NewV4()).String(), "name": "Groceries"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			b, _ := json.Marshal(tc.body)
			req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			rr := httptest.NewRecorder()

			CreateCategory(rr, req)

			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
			}
		})
	}
}

func TestCreateCategory_InvalidType(t *testing.T) {
	categoryID := uuid.Must(uuid.NewV4())

	body := map[string]interface{}{
		"id":   categoryID.String(),
		"name": "Groceries",
		"type": "invalid",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/categories", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreateCategory(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetCategoriesForUser_ReturnsCategoriesForUser(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"

	catID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns empty
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// GetCategoriesForUser query - personal only
		rows := sqlmock.NewRows([]string{
			"id", "name", "user_id", "type", "color", "household_id", "budget_id", "limit_amount", "rollover_enabled",
		}).AddRow(
			catID.String(), "Groceries", userID, "expense", "#FF5733", nil, nil, 500.0, false,
		)
		mock.ExpectQuery(`FROM categories c`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	result, err := GetCategoriesForUser(userID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 category, got %d", len(result))
	}

	if result[0].Name != "Groceries" {
		t.Fatalf("expected name=Groceries, got %v", result[0].Name)
	}
}

func TestGetCategoriesForUser_WithHousehold(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	householdID := "hh111111-1111-1111-1111-111111111111"
	catID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID returns household ID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{"household_id"}).
				AddRow(householdID))

		// GetCategoriesForUser query with household
		rows := sqlmock.NewRows([]string{
			"id", "name", "user_id", "type", "color", "household_id", "budget_id", "limit_amount", "rollover_enabled",
		}).AddRow(
			catID.String(), "Groceries", nil, "expense", "#FF5733", householdID, nil, 500.0, false,
		)
		mock.ExpectQuery(`FROM categories c`).
			WithArgs(householdID).
			WillReturnRows(rows)
	})

	result, err := GetCategoriesForUser(userID)

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result) != 1 {
		t.Fatalf("expected 1 category, got %d", len(result))
	}
}

func TestGetCategoriesByUserID_Handler(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	catID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// GetCategoriesForUser query
		rows := sqlmock.NewRows([]string{
			"id", "name", "user_id", "type", "color", "household_id", "budget_id", "limit_amount", "rollover_enabled",
		}).AddRow(
			catID.String(), "Groceries", userID, "expense", "#FF5733", nil, nil, 500.0, false,
		)
		mock.ExpectQuery(`FROM categories c`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/categories/user/"+userID, nil)
	req = mux.SetURLVars(req, map[string]string{"user_id": userID})
	rr := httptest.NewRecorder()

	GetCategoriesByUserID(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var categories []map[string]interface{}
	if err := json.Unmarshal(rr.Body.Bytes(), &categories); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if len(categories) != 1 {
		t.Fatalf("expected 1 category, got %d", len(categories))
	}
}

func TestUpdateCategory_SuccessfulUpdate(t *testing.T) {
	categoryID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// UPDATE query
		mock.ExpectExec(`UPDATE categories`).
			WillReturnResult(sqlmock.NewResult(0, 1))

		// DELETE from budget_categories
		mock.ExpectExec(`DELETE FROM budget_categories`).
			WillReturnResult(sqlmock.NewResult(0, 0))
	})

	body := map[string]interface{}{
		"name":  "Updated Category",
		"color": "#FF0000",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/categories/"+categoryID.String(), bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": categoryID.String()})
	rr := httptest.NewRecorder()

	UpdateCategory(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestUpdateCategory_InvalidID(t *testing.T) {
	body := map[string]interface{}{
		"name": "Updated Category",
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPatch, "/categories/invalid-uuid", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req = mux.SetURLVars(req, map[string]string{"id": "invalid-uuid"})
	rr := httptest.NewRecorder()

	UpdateCategory(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestDeleteCategory_SuccessfulDelete(t *testing.T) {
	categoryID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// DELETE query
		mock.ExpectExec(`DELETE FROM categories`).
			WithArgs(categoryID).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	req := httptest.NewRequest(http.MethodDelete, "/categories/"+categoryID.String(), nil)
	req = mux.SetURLVars(req, map[string]string{"id": categoryID.String()})
	rr := httptest.NewRecorder()

	DeleteCategory(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDeleteCategory_InvalidID(t *testing.T) {
	req := httptest.NewRequest(http.MethodDelete, "/categories/invalid-uuid", nil)
	req = mux.SetURLVars(req, map[string]string{"id": "invalid-uuid"})
	rr := httptest.NewRecorder()

	DeleteCategory(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

func TestGetCategories_ValidType(t *testing.T) {
	catID := uuid.Must(uuid.NewV4())

	withCategoriesMockDB(t, func(mock sqlmock.Sqlmock) {
		// GetCategories query
		rows := sqlmock.NewRows([]string{
			"id", "name", "budget_id", "limit_amount", "rollover_enabled",
		}).AddRow(
			catID.String(), "Groceries", nil, 500.0, false,
		)
		mock.ExpectQuery(`FROM categories c`).
			WithArgs("expense").
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/categories?type=expense", nil)
	rr := httptest.NewRecorder()

	GetCategories(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestGetCategories_InvalidType(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/categories?type=invalid", nil)
	rr := httptest.NewRecorder()

	GetCategories(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}

// Helper function with categories DB factory mock
func withCategoriesMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	setup(mock)
}
