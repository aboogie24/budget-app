package handlers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/aboogie/budget-backend/auth"
	"github.com/aboogie/budget-backend/db"
	"github.com/gorilla/mux"
)

// withPlanMockDB swaps planDBFactory with a sqlmock-backed implementation.
func withPlanMockDB(t *testing.T, setup func(sqlmock.Sqlmock)) {
	t.Helper()
	mockSQL, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("failed to create sqlmock: %v", err)
	}
	t.Cleanup(func() { mockSQL.Close() })

	oldFactory := planDBFactory
	planDBFactory = func() (db.DBTX, error) { return &mockDB{db: mockSQL}, nil }
	t.Cleanup(func() { planDBFactory = oldFactory })

	setup(mock)
}

// planTestToken generates a JWT for the given userID. Sets JWT_SECRET if needed.
func planTestToken(t *testing.T, userID string) string {
	t.Helper()
	old := os.Getenv("JWT_SECRET")
	if old == "" {
		os.Setenv("JWT_SECRET", "test-secret-key-for-testing-only")
		t.Cleanup(func() { os.Unsetenv("JWT_SECRET") })
	}
	token, err := auth.GenerateToken(userID)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}
	return token
}

// ─── CreatePlan Tests ────────────────────────────────────────

func TestCreatePlan_Valid(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	now := time.Now()

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID — no household
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// Insert plan
		mock.ExpectQuery(`INSERT INTO financial_plans`).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "household_id", "created_by", "name", "plan_type", "status",
				"framework_level", "monthly_contribution",
				"start_date", "projected_end_date",
				"ai_analysis", "scenarios",
				"created_at", "updated_at",
			}).AddRow(
				"plan-1", "", userID, "My Plan", "combined", "draft",
				"", 500.0,
				now.Format("2006-01-02"), "",
				"{}", "{}",
				now, now,
			))
	})

	body := map[string]any{
		"name":                 "My Plan",
		"plan_type":            "combined",
		"monthly_contribution": 500.0,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	CreatePlan(rr, req)

	if rr.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["name"] != "My Plan" {
		t.Fatalf("wrong name: %v", result["name"])
	}
	if result["plan_type"] != "combined" {
		t.Fatalf("wrong plan_type: %v", result["plan_type"])
	}
}

func TestCreatePlan_MissingName(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	body := map[string]any{
		"plan_type":            "combined",
		"monthly_contribution": 500.0,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	CreatePlan(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestCreatePlan_Unauthorized(t *testing.T) {
	body := map[string]any{"name": "Plan", "monthly_contribution": 100.0}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/plans", bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	CreatePlan(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", rr.Code)
	}
}

// ─── ListPlans Tests ─────────────────────────────────────────

func TestListPlans_ReturnsPlans(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	now := time.Now()

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		// ResolveHouseholdID — no household
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		// ListPlans query (personal, no household)
		rows := sqlmock.NewRows([]string{
			"id", "household_id", "created_by", "name", "plan_type", "status",
			"framework_level", "monthly_contribution",
			"start_date", "projected_end_date",
			"created_at", "updated_at",
		}).AddRow(
			"plan-1", "", userID, "Debt Plan", "debt_payoff", "active",
			"Foundation", 300.0,
			"2026-01-01", "",
			now, now,
		).AddRow(
			"plan-2", "", userID, "Savings Plan", "savings", "draft",
			"", 200.0,
			"2026-03-01", "",
			now, now,
		)
		mock.ExpectQuery(`FROM financial_plans`).
			WithArgs(userID).
			WillReturnRows(rows)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/plans", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	ListPlans(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var plans []map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &plans); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if len(plans) != 2 {
		t.Fatalf("expected 2 plans, got %d", len(plans))
	}
	if plans[0]["name"] != "Debt Plan" {
		t.Fatalf("unexpected first plan name: %v", plans[0]["name"])
	}
}

func TestListPlans_Empty(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT household_id FROM household_members`).
			WithArgs(userID).
			WillReturnError(sql.ErrNoRows)

		mock.ExpectQuery(`FROM financial_plans`).
			WithArgs(userID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "household_id", "created_by", "name", "plan_type", "status",
				"framework_level", "monthly_contribution",
				"start_date", "projected_end_date",
				"created_at", "updated_at",
			}))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/plans", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()

	ListPlans(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}

	var plans []map[string]any
	json.Unmarshal(rr.Body.Bytes(), &plans)
	if len(plans) != 0 {
		t.Fatalf("expected 0 plans, got %d", len(plans))
	}
}

// ─── GetPlan Tests ───────────────────────────────────────────

func TestGetPlan_IncludesMilestonesAndAllocations(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "plan-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	now := time.Now()

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		// Fetch plan
		mock.ExpectQuery(`FROM financial_plans WHERE id`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "household_id", "created_by", "name", "plan_type", "status",
				"framework_level", "monthly_contribution",
				"start_date", "projected_end_date",
				"ai_analysis", "scenarios",
				"created_at", "updated_at",
			}).AddRow(
				planID, "", userID, "Test Plan", "combined", "active",
				"Foundation", 500.0,
				"2026-01-01", "2027-01-01",
				"{}", "{}",
				now, now,
			))

		// Milestones
		mock.ExpectQuery(`FROM plan_milestones WHERE plan_id`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "plan_id", "title", "target_amount", "target_date", "status", "completed_at",
			}).AddRow("m1", planID, "Emergency fund done", 1000.0, "2026-06-01", "pending", nil))

		// Allocations
		mock.ExpectQuery(`FROM plan_allocations WHERE plan_id`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "plan_id", "target_id", "target_type", "monthly_amount", "priority_order",
			}).AddRow("a1", planID, "debt-1", "debt", 300.0, 1))

		// Approvals
		mock.ExpectQuery(`FROM plan_approvals`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{
				"id", "plan_id", "user_id", "user_name", "status", "feedback", "responded_at", "created_at",
			}))
	})

	req := httptest.NewRequest(http.MethodGet, "/api/plans/"+planID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	GetPlan(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["name"] != "Test Plan" {
		t.Fatalf("wrong plan name: %v", result["name"])
	}

	milestones, ok := result["milestones"].([]any)
	if !ok || len(milestones) != 1 {
		t.Fatalf("expected 1 milestone, got: %v", result["milestones"])
	}

	allocations, ok := result["allocations"].([]any)
	if !ok || len(allocations) != 1 {
		t.Fatalf("expected 1 allocation, got: %v", result["allocations"])
	}
}

func TestGetPlan_NotFound(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "nonexistent-plan"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`FROM financial_plans WHERE id`).
			WithArgs(planID).
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/plans/"+planID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	GetPlan(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ─── UpdatePlan Tests ────────────────────────────────────────

func TestUpdatePlan_PartialUpdate(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "plan-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		// Verify ownership
		mock.ExpectQuery(`SELECT created_by FROM financial_plans`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{"created_by"}).AddRow(userID))

		// Update
		mock.ExpectExec(`UPDATE financial_plans`).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	newName := "Updated Plan"
	body := map[string]any{
		"name": newName,
	}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/plans/"+planID, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	UpdatePlan(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rr.Code, rr.Body.String())
	}

	var result map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &result); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if result["updated"] != true {
		t.Fatalf("expected updated=true, got %v", result["updated"])
	}
}

func TestUpdatePlan_NotFound(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "nonexistent-plan"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT created_by FROM financial_plans`).
			WithArgs(planID).
			WillReturnError(sql.ErrNoRows)
	})

	body := map[string]any{"name": "Test"}
	b, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPut, "/api/plans/"+planID, bytes.NewReader(b))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	UpdatePlan(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
	}
}

// ─── DeletePlan Tests ────────────────────────────────────────

func TestDeletePlan_Success(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "plan-1111-1111-1111-111111111111"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		// Verify ownership
		mock.ExpectQuery(`SELECT created_by FROM financial_plans`).
			WithArgs(planID).
			WillReturnRows(sqlmock.NewRows([]string{"created_by"}).AddRow(userID))

		// Delete
		mock.ExpectExec(`DELETE FROM financial_plans`).
			WithArgs(planID).
			WillReturnResult(sqlmock.NewResult(0, 1))
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/plans/"+planID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	DeletePlan(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204, got %d: %s", rr.Code, rr.Body.String())
	}
}

func TestDeletePlan_NotFound(t *testing.T) {
	userID := "11111111-1111-1111-1111-111111111111"
	planID := "nonexistent-plan"
	token := planTestToken(t, userID)

	withPlanMockDB(t, func(mock sqlmock.Sqlmock) {
		mock.ExpectQuery(`SELECT created_by FROM financial_plans`).
			WithArgs(planID).
			WillReturnError(sql.ErrNoRows)
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/plans/"+planID, nil)
	req.Header.Set("Authorization", "Bearer "+token)
	req = mux.SetURLVars(req, map[string]string{"id": planID})
	rr := httptest.NewRecorder()

	DeletePlan(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
	}
}
