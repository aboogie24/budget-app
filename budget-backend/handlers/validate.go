package handlers

import (
	"net/http"
	"regexp"
	"strings"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)

// validationError writes a 400 response with a JSON body.
func validationError(w http.ResponseWriter, msg string) {
	http.Error(w, msg, http.StatusBadRequest)
}

func isValidEmail(email string) bool {
	return emailRegex.MatchString(email)
}

func isValidBudgetType(t string) bool {
	t = strings.ToLower(t)
	return t == "income" || t == "expense"
}

func isValidFrequency(f string) bool {
	switch strings.ToLower(f) {
	case "", "one-time", "weekly", "biweekly", "monthly", "1st-15th":
		return true
	}
	return false
}
