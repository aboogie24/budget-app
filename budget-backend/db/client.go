package db

import (
	"database/sql"
	"fmt"
	"os"
	"sync"

	_ "github.com/lib/pq"
)

// DBTX is the minimal interface our handlers rely on. It allows swapping a mock in tests.
type DBTX interface {
	Query(query string, args ...interface{}) (*sql.Rows, error)
	QueryRow(query string, args ...interface{}) *sql.Row
	Exec(query string, args ...interface{}) (sql.Result, error)
	Close() error
	Raw() *sql.DB
}

// DB wraps a sql.DB connection
type DB struct {
	Conn   *sql.DB
	shared bool // if true, Close() is a no-op (pool is shared)
}

var (
	pool     *sql.DB
	poolOnce sync.Once
	poolErr  error
)

func connStr() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("PG_USER"),
		os.Getenv("PG_PASS"),
		os.Getenv("PG_HOST"),
		os.Getenv("PG_PORT"),
		os.Getenv("PG_DB"),
	)
}

// Pool returns the shared connection pool, creating it on first call.
func Pool() (*sql.DB, error) {
	poolOnce.Do(func() {
		p, err := sql.Open("postgres", connStr())
		if err != nil {
			poolErr = err
			return
		}
		p.SetMaxOpenConns(25)
		p.SetMaxIdleConns(5)
		if err := p.Ping(); err != nil {
			poolErr = err
			return
		}
		pool = p
	})
	return pool, poolErr
}

// New returns a DB handle backed by the shared pool.
// Close() is a no-op — the pool lives for the process lifetime.
func New() (*DB, error) {
	p, err := Pool()
	if err != nil {
		return nil, err
	}
	return &DB{Conn: p, shared: true}, nil
}

// Close is a no-op for the shared pool. Only non-shared connections are closed.
func (d *DB) Close() error {
	if d.shared {
		return nil // pool stays open
	}
	return d.Conn.Close()
}

// Query utility wrapper
func (d *DB) Query(query string, args ...interface{}) (*sql.Rows, error) {
	return d.Conn.Query(query, args...)
}

// QueryRow utility wrapper
func (d *DB) QueryRow(query string, args ...interface{}) *sql.Row {
	return d.Conn.QueryRow(query, args...)
}

// Exec utility wrapper
func (d *DB) Exec(query string, args ...interface{}) (sql.Result, error) {
	return d.Conn.Exec(query, args...)
}

// Raw exposes the underlying *sql.DB for helpers that need it.
func (d *DB) Raw() *sql.DB {
	return d.Conn
}
