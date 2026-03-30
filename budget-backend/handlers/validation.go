package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"
)

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type ValidationErrors struct {
	Errors []ValidationError `json:"errors"`
}

func respondValidationError(w http.ResponseWriter, errors []ValidationError) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusBadRequest)
	json.NewEncoder(w).Encode(ValidationErrors{Errors: errors})
}

func validateRequired(value, field string) *ValidationError {
	if strings.TrimSpace(value) == "" {
		return &ValidationError{Field: field, Message: fmt.Sprintf("%s is required", field)}
	}
	return nil
}

func validateEmail(email string) *ValidationError {
	re := regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)
	if !re.MatchString(email) {
		return &ValidationError{Field: "email", Message: "invalid email format"}
	}
	return nil
}

func validatePositiveFloat(value float64, field string) *ValidationError {
	if value <= 0 {
		return &ValidationError{Field: field, Message: fmt.Sprintf("%s must be greater than 0", field)}
	}
	return nil
}

func validateUUID(value, field string) *ValidationError {
	re := regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)
	if !re.MatchString(value) {
		return &ValidationError{Field: field, Message: fmt.Sprintf("%s must be a valid UUID", field)}
	}
	return nil
}

func validateEnum(value, field string, allowed []string) *ValidationError {
	for _, a := range allowed {
		if value == a {
			return nil
		}
	}
	return &ValidationError{Field: field, Message: fmt.Sprintf("%s must be one of: %s", field, strings.Join(allowed, ", "))}
}
