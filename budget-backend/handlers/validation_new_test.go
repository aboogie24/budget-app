package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestValidateRequired(t *testing.T) {
	cases := []struct {
		value string
		field string
		want  bool
	}{
		{"hello", "name", false},
		{"", "name", true},
		{"   ", "email", true},
		{"test@example.com", "email", false},
	}

	for _, tc := range cases {
		result := validateRequired(tc.value, tc.field)
		hasError := result != nil
		if hasError != tc.want {
			t.Errorf("validateRequired(%q, %q): got error=%v, want %v", tc.value, tc.field, hasError, tc.want)
		}
		if result != nil && result.Field != tc.field {
			t.Errorf("validateRequired error field: got %q, want %q", result.Field, tc.field)
		}
	}
}

func TestValidateEmail(t *testing.T) {
	valid := []string{
		"user@example.com",
		"first.last@domain.co",
		"user+tag@sub.domain.org",
		"a@b.io",
		"test.user@example.co.uk",
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
		result := validateEmail(email)
		if result != nil {
			t.Errorf("validateEmail(%q) should be valid, got error: %v", email, result.Message)
		}
	}

	for _, email := range invalid {
		result := validateEmail(email)
		if result == nil {
			t.Errorf("validateEmail(%q) should be invalid", email)
		}
	}
}

func TestValidatePositiveFloat(t *testing.T) {
	cases := []struct {
		value float64
		field string
		want  bool
	}{
		{100.50, "amount", false},
		{0.01, "amount", false},
		{0, "amount", true},
		{-50.0, "amount", true},
		{1000000, "price", false},
	}

	for _, tc := range cases {
		result := validatePositiveFloat(tc.value, tc.field)
		hasError := result != nil
		if hasError != tc.want {
			t.Errorf("validatePositiveFloat(%f, %q): got error=%v, want %v", tc.value, tc.field, hasError, tc.want)
		}
	}
}

func TestValidateUUID(t *testing.T) {
	valid := []string{
		"550e8400-e29b-41d4-a716-446655440000",
		"f47ac10b-58cc-4372-a567-0e02b2c3d479",
		"00000000-0000-0000-0000-000000000000",
	}
	invalid := []string{
		"",
		"not-a-uuid",
		"550e8400-e29b-41d4-a716-44665544000",
		"550e8400-e29b-41d4-a716-4466554400000",
		"550e8400-e29b-41d4-a716-44665544000g",
	}

	for _, uuid := range valid {
		result := validateUUID(uuid, "id")
		if result != nil {
			t.Errorf("validateUUID(%q) should be valid, got error: %v", uuid, result.Message)
		}
	}

	for _, uuid := range invalid {
		result := validateUUID(uuid, "id")
		if result == nil {
			t.Errorf("validateUUID(%q) should be invalid", uuid)
		}
	}
}

func TestValidateEnum(t *testing.T) {
	allowed := []string{"income", "expense", "transfer"}

	cases := []struct {
		value string
		want  bool
	}{
		{"income", false},
		{"expense", false},
		{"transfer", false},
		{"savings", true},
		{"", true},
	}

	for _, tc := range cases {
		result := validateEnum(tc.value, "type", allowed)
		hasError := result != nil
		if hasError != tc.want {
			t.Errorf("validateEnum(%q): got error=%v, want %v", tc.value, hasError, tc.want)
		}
	}
}

func TestRespondValidationError(t *testing.T) {
	rr := httptest.NewRecorder()
	errors := []ValidationError{
		{Field: "email", Message: "invalid email format"},
		{Field: "amount", Message: "amount must be greater than 0"},
	}

	respondValidationError(rr, errors)

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected content type application/json, got %s", contentType)
	}

	body := rr.Body.String()
	if body == "" {
		t.Errorf("expected response body, got empty string")
	}

	// Verify it contains expected fields
	if !strings.Contains(body, "email") || !strings.Contains(body, "invalid email format") {
		t.Errorf("response body missing expected error details: %s", body)
	}
}

func TestRespondValidationErrorEmpty(t *testing.T) {
	rr := httptest.NewRecorder()

	respondValidationError(rr, []ValidationError{})

	if rr.Code != http.StatusBadRequest {
		t.Errorf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}

	body := rr.Body.String()
	if !strings.Contains(body, "[]") {
		t.Errorf("expected empty error array in response: %s", body)
	}
}
