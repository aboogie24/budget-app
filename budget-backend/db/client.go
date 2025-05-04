package db

import (
	"database/sql"
	"fmt"
	"os"

	_ "github.com/lib/pq"
)

// DB wraps a sql.DB connection
type DB struct {
	Conn *sql.DB
}

// New creates a reusable DB client
func New() (*DB, error) {
	connStr := fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("PG_USER"),
		os.Getenv("PG_PASS"),
		os.Getenv("PG_HOST"),
		os.Getenv("PG_PORT"),
		os.Getenv("PG_DB"),
	)

	conn, err := sql.Open("postgres", connStr)
	if err != nil {
		return nil, err
	}

	if err := conn.Ping(); err != nil {
		return nil, err
	}

	return &DB{Conn: conn}, nil
}

// Close shuts down the DB connection
func (d *DB) Close() error {
	return d.Conn.Close()
}

// Query utility wrapper
func (d *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return d.Conn.Query(query, args...)
}

// Exec utility wrapper
func (d *DB) Exec(query string, args ...interface{}) (sql.Result, error) {
	return d.Conn.Exec(query, args...)
}
