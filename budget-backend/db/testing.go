package db

import (
	"database/sql"
	"sync"
)

// OverridePool replaces the shared pool with the given *sql.DB.
// This is intended for tests only — it allows injecting a sqlmock connection.
// It returns a cleanup function that restores the original pool.
func OverridePool(mock *sql.DB) func() {
	origPool := pool
	origErr := poolErr

	// Replace the pool with the mock and mark the Once as "done"
	// so Pool() won't try to connect for real.
	pool = mock
	poolErr = nil
	poolOnce.Do(func() {}) // no-op if already done; marks done if not

	return func() {
		pool = origPool
		poolErr = origErr
		// Reset poolOnce so the real pool can be initialized again if needed.
		poolOnce = sync.Once{}
	}
}
