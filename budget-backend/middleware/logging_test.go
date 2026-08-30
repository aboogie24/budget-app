package middleware

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

func captureLog(t *testing.T) *bytes.Buffer {
	t.Helper()
	var buf bytes.Buffer
	log.SetOutput(&buf)
	t.Cleanup(func() { log.SetOutput(os.Stderr) })
	return &buf
}

func testHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusCreated)
		w.Write([]byte("hello"))
	})
}

func TestLogging_Default(t *testing.T) {
	buf := captureLog(t)
	h := Logging(testHandler())

	req := httptest.NewRequest(http.MethodGet, "/auth/budgets?month=8", nil)
	h.ServeHTTP(httptest.NewRecorder(), req)

	line := buf.String()
	if !strings.Contains(line, "GET /auth/budgets -> 201") {
		t.Fatalf("unexpected log line: %q", line)
	}
	if strings.Contains(line, "ua=") || strings.Contains(line, "month=8") {
		t.Fatalf("default logging should not include verbose fields: %q", line)
	}
}

func TestLogging_Verbose(t *testing.T) {
	t.Setenv("LOG_VERBOSE", "1")
	buf := captureLog(t)
	h := Logging(testHandler()) // constructed after env is set

	req := httptest.NewRequest(http.MethodGet, "/auth/budgets?month=8", nil)
	req.Header.Set("User-Agent", "coupleflow-test")
	req.Header.Set("X-Forwarded-For", "10.1.2.3")
	h.ServeHTTP(httptest.NewRecorder(), req)

	line := buf.String()
	for _, want := range []string{
		"GET /auth/budgets?month=8 -> 201",
		"ip=10.1.2.3",
		`ua="coupleflow-test"`,
		"out=5B",
	} {
		if !strings.Contains(line, want) {
			t.Fatalf("verbose log missing %q: %q", want, line)
		}
	}
}
