package db

import (
	"database/sql"
)

// Init returns the shared connection pool.
// Deprecated: prefer db.New() which returns a *DB wrapper with the DBTX interface.
func Init() (*sql.DB, error) {
	return Pool()
}
