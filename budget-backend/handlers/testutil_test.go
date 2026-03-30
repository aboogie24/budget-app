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
	"os"
	"testing"

	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/aboogie/budget-backend/models"
	"github.com/gofrs/uuid"
	_ "github.com/lib/pq"
)

// TestDatabase holds references to the test DB connection.
type TestDatabase struct {
	Conn *sql.DB
}

// setupTestDB connects to the test database and runs migrations.
// It returns a TestDatabase handle that can be used in tests.
func setupTestDB(t *testing.T) *TestDatabase {
	// Read test database configuration from environment
	pgUser := os.Getenv("PG_USER_TEST")
	if pgUser == "" {
		pgUser = os.Getenv("PG_USER")
	}
	pgPass := os.Getenv("PG_PASS_TEST")
	if pgPass == "" {
		pgPass = os.Getenv("PG_PASS")
	}
	pgHost := os.Getenv("PG_HOST_TEST")
	if pgHost == "" {
		pgHost = os.Getenv("PG_HOST")
	}
	pgPort := os.Getenv("PG_PORT_TEST")
	if pgPort == "" {
		pgPort = os.Getenv("PG_PORT")
	}
	pgDB := os.Getenv("PG_DB_TEST")
	if pgDB == "" {
		pgDB = "budget_test"
	}

	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		pgUser, pgPass, pgHost, pgPort, pgDB,
	)

	conn, err := sql.Open("postgres", connStr)
	if err != nil {
		t.Fatalf("failed to open test database: %v", err)
	}

	if err := conn.Ping(); err != nil {
		t.Fatalf("failed to ping test database: %v", err)
	}

	// Clear all data from tables in dependency order
	clearTestDB(t, conn)

	return &TestDatabase{Conn: conn}
}

// clearTestDB drops all data from relevant tables without dropping tables themselves.
func clearTestDB(t *testing.T, conn *sql.DB) {
	tables := []string{
		"household_invites",
		"household_members",
		"households",
		"spending_alerts",
		"transactions",
		"budgets",
		"user_categories",
		"linked_accounts",
		"settings",
		"users",
	}

	for _, table := range tables {
		if _, err := conn.Exec(fmt.Sprintf("DELETE FROM %s", table)); err != nil {
			t.Logf("warning: failed to clear table %s: %v", table, err)
		}
	}
}

// teardownTestDB closes the test database connection.
func teardownTestDB(t *testing.T, td *TestDatabase) {
	if td != nil && td.Conn != nil {
		if err := td.Conn.Close(); err != nil {
			t.Logf("warning: failed to close test database: %v", err)
		}
	}
}

// createTestUser creates a test user in the database and returns user ID and JWT token.
func createTestUser(t *testing.T, td *TestDatabase, email, password string) (string, string) {
	userID := uuid.Must(uuid.NewV4()).String()

	user := models.User{
		ID:       userID,
		Email:    email,
		Password: password,
	}
	if err := user.HashPassword(); err != nil {
		t.Fatalf("failed to hash password: %v", err)
	}

	_, err := td.Conn.Exec(
		"INSERT INTO users (id, email, password) VALUES ($1, $2, $3)",
		userID, user.Email, user.Password,
	)
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}

	// Set JWT_SECRET for token generation if not already set
	oldSecret := os.Getenv("JWT_SECRET")
	if oldSecret == "" {
		os.Setenv("JWT_SECRET", "test-secret-key-for-testing-only")
	}

	token, err := auth.GenerateToken(userID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	if oldSecret == "" {
		os.Unsetenv("JWT_SECRET")
	}

	return userID, token
}

// createTestHousehold creates a test household and adds the user as a member.
// Returns the household ID.
func createTestHousehold(t *testing.T, td *TestDatabase, userID string, name string) string {
	hhID := uuid.Must(uuid.NewV4()).String()

	_, err := td.Conn.Exec(
		"INSERT INTO households (id, name) VALUES ($1, $2)",
		hhID, name,
	)
	if err != nil {
		t.Fatalf("failed to create test household: %v", err)
	}

	_, err = td.Conn.Exec(
		"INSERT INTO household_members (id, household_id, user_id, role) VALUES ($1, $2, $3, $4)",
		uuid.Must(uuid.NewV4()).String(), hhID, userID, "owner",
	)
	if err != nil {
		t.Fatalf("failed to add user to household: %v", err)
	}

	return hhID
}

// createTestCategory creates a test category and returns the category ID.
func createTestCategory(t *testing.T, td *TestDatabase, userID string, name string, categoryType string) string {
	catID := uuid.Must(uuid.NewV4()).String()

	_, err := td.Conn.Exec(
		"INSERT INTO categories (id, name, type, user_id) VALUES ($1, $2, $3, $4)",
		catID, name, categoryType, userID,
	)
	if err != nil {
		t.Fatalf("failed to create test category: %v", err)
	}

	return catID
}

// createTestBudget creates a test budget and returns the budget ID.
func createTestBudget(t *testing.T, td *TestDatabase, userID string, categoryID string, amount float64, month int, year int) string {
	budgetID := uuid.Must(uuid.NewV4()).String()

	_, err := td.Conn.Exec(
		"INSERT INTO budgets (id, user_id, category_id, amount, month, year) VALUES ($1, $2, $3, $4, $5, $6)",
		budgetID, userID, categoryID, amount, month, year,
	)
	if err != nil {
		t.Fatalf("failed to create test budget: %v", err)
	}

	return budgetID
}

// makeAuthRequest creates an authenticated HTTP request with a Bearer token.
func makeAuthRequest(t *testing.T, method string, path string, body interface{}, token string) *http.Request {
	var bodyBytes []byte
	var err error

	if body != nil {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			t.Fatalf("failed to marshal body: %v", err)
		}
	}

	req := httptest.NewRequest(method, path, bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	return req
}

// TestHelperDB provides a mock DBTX for testing without a real database.
type TestHelperDB struct {
	Rows map[string]interface{}
}

func (t *TestHelperDB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return nil, fmt.Errorf("not implemented")
}

func (t *TestHelperDB) QueryRow(query string, args ...interface{}) *sql.Row {
	return nil
}

func (t *TestHelperDB) Exec(query string, args ...interface{}) (sql.Result, error) {
	return nil, fmt.Errorf("not implemented")
}

func (t *TestHelperDB) Close() error {
	return nil
}

func (t *TestHelperDB) Raw() *sql.DB {
	return nil
}
