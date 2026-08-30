package ai

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
)

func TestCreateSavingsGoal_SharedWithHousehold(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock: %v", err)
	}
	defer db.Close()

	mock.ExpectQuery(`INSERT INTO savings_goals`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("goal-1"))
	// Activity feed entry for the household.
	mock.ExpectExec(`INSERT INTO activity_events`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	input := json.RawMessage(`{"name":"Jamaica trip — December","target_amount":4200,"target_date":"2026-12-01"}`)
	out, err := createSavingsGoalTool(db, "user-1", "hh-1", input)
	if err != nil {
		t.Fatalf("createSavingsGoalTool error: %v", err)
	}
	var res map[string]interface{}
	if err := json.Unmarshal([]byte(out), &res); err != nil {
		t.Fatalf("bad JSON result: %v", err)
	}
	if res["goal_id"] != "goal-1" || res["is_shared"] != true {
		t.Fatalf("unexpected result: %v", res)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestCreateSavingsGoal_Validation(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()

	cases := []struct {
		name  string
		input string
		want  string
	}{
		{"missing name", `{"target_amount":100}`, "name is required"},
		{"zero amount", `{"name":"x","target_amount":0}`, "must be positive"},
		{"bad date", `{"name":"x","target_amount":100,"target_date":"12/01/2026"}`, "YYYY-MM-DD"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := createSavingsGoalTool(db, "user-1", "", json.RawMessage(tc.input))
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("expected error containing %q, got %v", tc.want, err)
			}
		})
	}
}

func TestCreateSavingsGoal_SoloUserNeverShared(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	mock.ExpectQuery(`INSERT INTO savings_goals`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("goal-2"))
	// No household → no activity event expected.

	out, err := createSavingsGoalTool(db, "user-1", "", json.RawMessage(`{"name":"Solo fund","target_amount":500,"is_shared":true}`))
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	var res map[string]interface{}
	_ = json.Unmarshal([]byte(out), &res)
	if res["is_shared"] != false {
		t.Fatalf("solo user goal must not be shared: %v", res)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateSavingsGoal_RejectsForeignGoal(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists", "linked_id", "linked_name"}).AddRow(false, "", ""))

	_, err := updateSavingsGoalTool(db, "user-1", "hh-1", json.RawMessage(`{"goal_id":"other-goal","add_amount":100}`))
	if err == nil || !strings.Contains(err.Error(), "not found") {
		t.Fatalf("expected ownership rejection, got %v", err)
	}
}

func TestUpdateSavingsGoal_AddsProgress(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists", "linked_id", "linked_name"}).AddRow(true, "", ""))
	mock.ExpectQuery(`UPDATE savings_goals`).
		WillReturnRows(sqlmock.NewRows([]string{"name", "current_amount", "target_amount"}).AddRow("Jamaica", 700.0, 4200.0))
	mock.ExpectExec(`INSERT INTO activity_events`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	out, err := updateSavingsGoalTool(db, "user-1", "hh-1", json.RawMessage(`{"goal_id":"goal-1","add_amount":200}`))
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	var res map[string]interface{}
	_ = json.Unmarshal([]byte(out), &res)
	if res["current_amount"] != 700.0 || res["percent"] != 16.0 {
		t.Fatalf("unexpected result: %v", res)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestUpdateSavingsGoal_BlocksManualProgressOnLinkedGoal(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists", "linked_id", "linked_name"}).AddRow(true, "bal-1", "USAA Savings"))

	_, err := updateSavingsGoalTool(db, "user-1", "hh-1", json.RawMessage(`{"goal_id":"goal-1","add_amount":200}`))
	if err == nil || !strings.Contains(err.Error(), "USAA Savings") {
		t.Fatalf("expected linked-goal guardrail mentioning the account, got %v", err)
	}
	// Target/date changes remain allowed (no add_amount).
	mock.ExpectQuery(`SELECT EXISTS`).
		WillReturnRows(sqlmock.NewRows([]string{"exists", "linked_id", "linked_name"}).AddRow(true, "bal-1", "USAA Savings"))
	mock.ExpectQuery(`UPDATE savings_goals`).
		WillReturnRows(sqlmock.NewRows([]string{"name", "current_amount", "target_amount"}).AddRow("Emergency fund", 9000.0, 12000.0))

	out, err := updateSavingsGoalTool(db, "user-1", "hh-1", json.RawMessage(`{"goal_id":"goal-1","target_amount":12000}`))
	if err != nil {
		t.Fatalf("target change on linked goal should be allowed: %v", err)
	}
	var res map[string]interface{}
	_ = json.Unmarshal([]byte(out), &res)
	if res["target_amount"] != 12000.0 {
		t.Fatalf("unexpected result: %v", res)
	}
}

func TestLogTransaction_Validation(t *testing.T) {
	db, _, _ := sqlmock.New()
	defer db.Close()

	cases := []struct {
		input string
		want  string
	}{
		{`{"type":"transfer","amount":10,"note":"x"}`, "income or expense"},
		{`{"type":"expense","amount":-5,"note":"x"}`, "must be positive"},
		{`{"type":"expense","amount":5,"note":"x","date":"tomorrow"}`, "YYYY-MM-DD"},
	}
	for _, tc := range cases {
		_, err := logTransactionTool(db, "user-1", "", json.RawMessage(tc.input))
		if err == nil || !strings.Contains(err.Error(), tc.want) {
			t.Fatalf("input %s: expected error containing %q, got %v", tc.input, tc.want, err)
		}
	}
}

func TestCreateBudget_DefaultsAndValidation(t *testing.T) {
	db, mock, _ := sqlmock.New()
	defer db.Close()

	mock.ExpectQuery(`INSERT INTO budgets`).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("budget-1"))
	mock.ExpectExec(`INSERT INTO activity_events`).
		WillReturnResult(sqlmock.NewResult(0, 1))

	// Bogus type/frequency fall back to expense/monthly.
	out, err := createBudgetTool(db, "user-1", "hh-1", json.RawMessage(`{"name":"Trip fund","amount":350,"type":"weird","frequency":"sometimes"}`))
	if err != nil {
		t.Fatalf("error: %v", err)
	}
	var res map[string]interface{}
	_ = json.Unmarshal([]byte(out), &res)
	if res["type"] != "expense" || res["frequency"] != "monthly" {
		t.Fatalf("defaults not applied: %v", res)
	}

	if _, err := createBudgetTool(db, "user-1", "", json.RawMessage(`{"name":"","amount":10}`)); err == nil {
		t.Fatal("expected name validation error")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}
