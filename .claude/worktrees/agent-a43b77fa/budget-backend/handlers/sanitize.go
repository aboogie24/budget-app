package handlers

import "strings"

// sanitizeString removes leading/trailing whitespace and null bytes from a string.
func sanitizeString(s string) string {
	s = strings.TrimSpace(s)
	// Remove null bytes to prevent null-byte injection attacks
	s = strings.ReplaceAll(s, "\x00", "")
	return s
}

// sanitizeNote sanitizes a note field: removes whitespace, null bytes, and enforces max length.
// Max length is 1000 characters.
func sanitizeNote(s string) string {
	s = sanitizeString(s)
	if len(s) > 1000 {
		s = s[:1000]
	}
	return s
}

// sanitizeEmail sanitizes an email field: removes whitespace, null bytes, and converts to lowercase.
func sanitizeEmail(s string) string {
	s = sanitizeString(s)
	s = strings.ToLower(s)
	return s
}

// sanitizeFullName sanitizes a full name field: removes whitespace and null bytes, max 255 chars.
func sanitizeFullName(s string) string {
	s = sanitizeString(s)
	if len(s) > 255 {
		s = s[:255]
	}
	return s
}
