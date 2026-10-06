package households

import "database/sql"

// Querier is satisfied by *sql.DB and *sql.Tx so accept helpers can run inside a transaction.
type Querier interface {
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
	Exec(query string, args ...interface{}) (sql.Result, error)
}
