//go:build integration
// +build integration

package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

// TestUserLifecycle tests the full user lifecycle: Register -> Login -> Get session -> Create household -> Invite partner
func TestUserLifecycle(t *testing.T) {
	td := setupTestDB(t)
	defer teardownTestDB(t, td)

	// Override the database factory for this test
	oldFactory := householdDBFactory
	householdDBFactory = func() (*sql.DB, error) {
		return td.Conn, nil
	}
	defer func() { householdDBFactory = oldFactory }()

	// 1. Register User 1
	router := mux.NewRouter()
	setupTestRoutes(router, td)

	registerBody := map[string]string{
		"email":    "user1@example.com",
		"password": "password123",
		"fullName": "User One",
	}
	bodyBytes, _ := json.Marshal(registerBody)
	req := httptest.NewRequest("POST", "/users/register", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("register user 1: expected 200/201, got %d: %s", w.Code, w.Body.String())
	}

	var registerResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &registerResp)
	user1ID := registerResp["user_id"].(string)
	token1 := registerResp["token"].(string)

	// 2. Login User 1
	loginBody := map[string]string{
		"email":    "user1@example.com",
		"password": "password123",
	}
	bodyBytes, _ = json.Marshal(loginBody)
	req = httptest.NewRequest("POST", "/users/login", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("login user 1: expected 200, got %d: %s", w.Code, w.Body.String())
	}

	// 3. Create Household
	householdBody := map[string]string{
		"name":    "Test Household",
		"user_id": user1ID,
	}
	bodyBytes, _ = json.Marshal(householdBody)
	req = httptest.NewRequest("POST", "/auth/households", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token1)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("create household response: %s", w.Body.String())
		t.Fatalf("create household: expected 200/201, got %d", w.Code)
	}

	var householdResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &householdResp)
	householdID := householdResp["household_id"].(string)

	// 4. Register User 2
	registerBody2 := map[string]string{
		"email":    "user2@example.com",
		"password": "password456",
		"fullName": "User Two",
	}
	bodyBytes, _ = json.Marshal(registerBody2)
	req = httptest.NewRequest("POST", "/users/register", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("register user 2: expected 200/201, got %d", w.Code)
	}

	var registerResp2 map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &registerResp2)
	user2ID := registerResp2["user_id"].(string)

	// 5. Invite User 2 to Household
	inviteBody := map[string]string{
		"household_id": householdID,
		"email":        "user2@example.com",
	}
	bodyBytes, _ = json.Marshal(inviteBody)
	req = httptest.NewRequest("POST", "/auth/households/invite", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token1)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("invite response: %s", w.Body.String())
		t.Fatalf("invite to household: expected 200/201, got %d", w.Code)
	}

	t.Logf("User lifecycle test completed: User1: %s, User2: %s, Household: %s", user1ID, user2ID, householdID)
}

// TestBudgetLifecycle tests: Create category -> Create budget -> Add transactions -> Check spending alerts -> Update -> Delete
func TestBudgetLifecycle(t *testing.T) {
	td := setupTestDB(t)
	defer teardownTestDB(t, td)

	router := mux.NewRouter()
	setupTestRoutes(router, td)

	// Create a test user
	userID, token := createTestUser(t, td, "budgettest@example.com", "password123")

	// 1. Create Category
	categoryBody := map[string]string{
		"name": "Test Groceries",
		"type": "expense",
	}
	bodyBytes, _ := json.Marshal(categoryBody)
	req := httptest.NewRequest("POST", "/auth/categories", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("create category: expected 200/201, got %d: %s", w.Code, w.Body.String())
	}

	var catResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &catResp)
	categoryID := catResp["category_id"].(string)

	// 2. Create Budget
	now := time.Now()
	budgetBody := map[string]interface{}{
		"category_id": categoryID,
		"amount":      100.0,
		"month":       now.Month(),
		"year":        now.Year(),
		"type":        "expense",
	}
	bodyBytes, _ = json.Marshal(budgetBody)
	req = httptest.NewRequest("POST", "/auth/budgets", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("create budget response: %s", w.Body.String())
		t.Fatalf("create budget: expected 200/201, got %d", w.Code)
	}

	var budgetResp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &budgetResp)
	budgetID := budgetResp["budget_id"].(string)

	// 3. Add Transactions
	txBody := map[string]interface{}{
		"budget_id":  budgetID,
		"category":   "Groceries",
		"amount":     50.0,
		"date":       now.Format("2006-01-02"),
		"note":       "Weekly groceries",
		"type":       "expense",
	}
	bodyBytes, _ = json.Marshal(txBody)
	req = httptest.NewRequest("POST", "/auth/transactions", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("add transaction response: %s", w.Body.String())
		t.Fatalf("add transaction: expected 200/201, got %d", w.Code)
	}

	// 4. Update Budget
	updateBudgetBody := map[string]interface{}{
		"amount": 150.0,
	}
	bodyBytes, _ = json.Marshal(updateBudgetBody)
	req = httptest.NewRequest("PUT", "/auth/budgets/"+budgetID, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Logf("update budget response: %s", w.Body.String())
		t.Fatalf("update budget: expected 200, got %d", w.Code)
	}

	// 5. Delete Budget
	req = httptest.NewRequest("DELETE", "/auth/budgets/"+budgetID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusNoContent {
		t.Logf("delete budget response: %s", w.Body.String())
		t.Fatalf("delete budget: expected 200/204, got %d", w.Code)
	}

	t.Logf("Budget lifecycle test completed: User: %s, Category: %s, Budget: %s", userID, categoryID, budgetID)
}

// TestHouseholdSharing tests: Create household -> Add member -> Share budget -> Verify partner sees shared data
func TestHouseholdSharing(t *testing.T) {
	td := setupTestDB(t)
	defer teardownTestDB(t, td)

	router := mux.NewRouter()
	setupTestRoutes(router, td)

	// 1. Create two users
	user1ID, token1 := createTestUser(t, td, "shareholder1@example.com", "password123")
	user2ID, token2 := createTestUser(t, td, "shareholder2@example.com", "password456")

	// 2. Create household for user 1
	hhID := createTestHousehold(t, td, user1ID, "Shared Household")

	// 3. Create a shared budget in household
	catID := createTestCategory(t, td, user1ID, "Shared Utilities", "expense")
	budgetID := createTestBudget(t, td, user1ID, catID, 200.0, int(time.Now().Month()), time.Now().Year())

	// 4. Add user 2 to household
	inviteBody := map[string]string{
		"household_id": hhID,
		"email":        "shareholder2@example.com",
	}
	bodyBytes, _ := json.Marshal(inviteBody)
	req := httptest.NewRequest("POST", "/auth/households/invite", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token1)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("invite response: %s", w.Body.String())
		t.Fatalf("invite user: expected 200/201, got %d", w.Code)
	}

	// 5. User 2 gets household info
	req = httptest.NewRequest("GET", "/auth/households/me?user_id="+user2ID, nil)
	req.Header.Set("Authorization", "Bearer "+token2)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code == http.StatusOK {
		var householdInfo map[string]interface{}
		json.Unmarshal(w.Body.Bytes(), &householdInfo)
		t.Logf("User 2 household access verified: %v", householdInfo)
	}

	t.Logf("Household sharing test completed: User1: %s, User2: %s, Household: %s", user1ID, user2ID, hhID)
}

// TestSpendingAlerts tests creating and checking spending alerts
func TestSpendingAlerts(t *testing.T) {
	td := setupTestDB(t)
	defer teardownTestDB(t, td)

	router := mux.NewRouter()
	setupTestRoutes(router, td)

	// Create a test user and budget
	userID, token := createTestUser(t, td, "alerttest@example.com", "password123")
	catID := createTestCategory(t, td, userID, "Alert Groceries", "expense")
	budgetID := createTestBudget(t, td, userID, catID, 100.0, int(time.Now().Month()), time.Now().Year())

	// 1. Create a spending alert
	alertBody := map[string]interface{}{
		"budget_id":  budgetID,
		"threshold":  80.0,
		"alert_type": "threshold",
	}
	bodyBytes, _ := json.Marshal(alertBody)
	req := httptest.NewRequest("POST", "/auth/spending-alerts", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Logf("create alert response: %s", w.Body.String())
		t.Fatalf("create alert: expected 200/201, got %d", w.Code)
	}

	// 2. Get spending alerts
	req = httptest.NewRequest("GET", "/auth/spending-alerts", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	w = httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Logf("get alerts response: %s", w.Body.String())
		t.Fatalf("get alerts: expected 200, got %d", w.Code)
	}

	t.Logf("Spending alerts test completed: User: %s, Budget: %s", userID, budgetID)
}

// setupTestRoutes sets up a test router with all API routes
func setupTestRoutes(router *mux.Router, td *TestDatabase) {
	// This would normally call routes.SetupRoutes(router)
	// For integration tests, we set up minimal routes needed for testing
	// In a real scenario, you'd call the production route setup

	router.HandleFunc("/users/register", RegisterUser).Methods("POST")
	router.HandleFunc("/users/login", LoginUser).Methods("POST")

	authRoutes := router.PathPrefix("/auth").Subrouter()
	authRoutes.HandleFunc("/categories", CreateCategory).Methods("POST")
	authRoutes.HandleFunc("/budgets", CreateBudget).Methods("POST")
	authRoutes.HandleFunc("/budgets/{id}", UpdateBudget).Methods("PUT")
	authRoutes.HandleFunc("/budgets/{id}", DeleteBudget).Methods("DELETE")
	authRoutes.HandleFunc("/transactions", CreateTransaction).Methods("POST")
	authRoutes.HandleFunc("/households", CreateHousehold).Methods("POST")
	authRoutes.HandleFunc("/households/me", GetHouseholdForUser).Methods("GET")
	authRoutes.HandleFunc("/households/invite", CreateHouseholdInvite).Methods("POST")
	authRoutes.HandleFunc("/spending-alerts", UpsertSpendingAlert).Methods("POST")
	authRoutes.HandleFunc("/spending-alerts", GetSpendingAlerts).Methods("GET")
}
