package handlers

import (
	"net/http/httptest"
	"testing"
)

func TestIsValidEmail(t *testing.T) {
	valid := []string{
		"user@example.com",
		"first.last@domain.co",
		"user+tag@sub.domain.org",
		"a@b.io",
	}
	invalid := []string{
		"",
		"plaintext",
		"@no-user.com",
		"user@",
		"user@.com",
		"user@com",
		"user @domain.com",
	}

	for _, email := range valid {
		if !isValidEmail(email) {
			t.Errorf("expected %q to be valid", email)
		}
	}
	for _, email := range invalid {
		if isValidEmail(email) {
			t.Errorf("expected %q to be invalid", email)
		}
	}
}

func TestIsValidBudgetType(t *testing.T) {
	cases := []struct {
		input string
		valid bool
	}{
		{"income", true},
		{"expense", true},
		{"Income", true},
		{"EXPENSE", true},
		{"", false},
		{"transfer", false},
		{"savings", false},
	}
	for _, c := range cases {
		got := isValidBudgetType(c.input)
		if got != c.valid {
			t.Errorf("isValidBudgetType(%q) = %v, want %v", c.input, got, c.valid)
		}
	}
}

func TestIsValidFrequency(t *testing.T) {
	valid := []string{"", "one-time", "weekly", "biweekly", "monthly", "1st-15th"}
	invalid := []string{"daily", "yearly", "quarterly", "random"}

	for _, f := range valid {
		if !isValidFrequency(f) {
			t.Errorf("expected frequency %q to be valid", f)
		}
	}
	for _, f := range invalid {
		if isValidFrequency(f) {
			t.Errorf("expected frequency %q to be invalid", f)
		}
	}
}

func TestValidationError(t *testing.T) {
	rr := httptest.NewRecorder()
	validationError(rr, "test error message")

	if rr.Code != 400 {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
	body := rr.Body.String()
	if body != "test error message\n" {
		t.Fatalf("unexpected body: %q", body)
	}
}
