package middleware

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRecoveryMiddleware_NormalExecution(t *testing.T) {
	handler := RecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("success"))
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}

	if rr.Body.String() != "success" {
		t.Errorf("expected body 'success', got %q", rr.Body.String())
	}
}

func TestRecoveryMiddleware_PanicRecovery(t *testing.T) {
	handler := RecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("test panic")
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", rr.Code)
	}

	contentType := rr.Header().Get("Content-Type")
	if contentType != "application/json" {
		t.Errorf("expected content type application/json, got %s", contentType)
	}

	var response map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if response["error"] != "internal server error" {
		t.Errorf("expected error message 'internal server error', got %q", response["error"])
	}
}

func TestRecoveryMiddleware_PanicWithNilValue(t *testing.T) {
	handler := RecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic(nil)
	}))

	rr := httptest.NewRecorder()
	req := httptest.NewRequest("GET", "/test", nil)

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", rr.Code)
	}
}

func TestRecoveryMiddleware_MultipleRequests(t *testing.T) {
	// First request with panic
	handler := RecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/panic" {
			panic("error")
		}
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	}))

	// Test panic handling
	rr1 := httptest.NewRecorder()
	req1 := httptest.NewRequest("GET", "/panic", nil)
	handler.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusInternalServerError {
		t.Errorf("panic request: expected status 500, got %d", rr1.Code)
	}

	// Test normal request after panic
	rr2 := httptest.NewRecorder()
	req2 := httptest.NewRequest("GET", "/normal", nil)
	handler.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusOK {
		t.Errorf("normal request: expected status 200, got %d", rr2.Code)
	}

	if rr2.Body.String() != "ok" {
		t.Errorf("normal request: expected body 'ok', got %q", rr2.Body.String())
	}
}

func TestRecoveryMiddleware_PanicWithDifferentTypes(t *testing.T) {
	testCases := []interface{}{
		"string panic",
		42,
		3.14,
		errors.New("error panic"),
	}

	for _, panicValue := range testCases {
		handler := RecoveryMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			panic(panicValue)
		}))

		rr := httptest.NewRecorder()
		req := httptest.NewRequest("GET", "/test", nil)

		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Errorf("panic with %T: expected status 500, got %d", panicValue, rr.Code)
		}

		if !strings.Contains(rr.Header().Get("Content-Type"), "application/json") {
			t.Errorf("panic with %T: expected JSON content type", panicValue)
		}
	}
}
