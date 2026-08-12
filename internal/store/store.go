package store

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"
	"unifi-rollback/internal/store/sqlc"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var embedMigrations embed.FS

const (
	appSupportDir = "unifi-rollback"
	defaultDBName = "unifi-rollback.db"
)

// Store wraps the SQLite database and sqlc-generated queries.
type Store struct {
	db      *sql.DB
	queries *sqlc.Queries
	path    string
}

// DefaultDBPath returns the default database file path for this app.
func DefaultDBPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home directory: %w", err)
	}
	dir := filepath.Join(home, "Library", "Application Support", appSupportDir)
	return filepath.Join(dir, defaultDBName), nil
}

// Open opens (or creates) the database at path and runs pending migrations.
func Open(path string) (*Store, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("create db directory: %w", err)
	}

	dsn := fmt.Sprintf("file:%s?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Store{
		db:      db,
		queries: sqlc.New(db),
		path:    path,
	}, nil
}

// OpenDefault opens the database at the default Application Support path.
func OpenDefault() (*Store, error) {
	path, err := DefaultDBPath()
	if err != nil {
		return nil, err
	}
	return Open(path)
}

func migrate(db *sql.DB) error {
	goose.SetBaseFS(embedMigrations)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return fmt.Errorf("goose dialect: %w", err)
	}
	if err := goose.Up(db, "migrations"); err != nil {
		return fmt.Errorf("goose up: %w", err)
	}
	return nil
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

// Queries returns the sqlc query handle.
func (s *Store) Queries() *sqlc.Queries {
	return s.queries
}

// Path returns the filesystem path of the open database.
func (s *Store) Path() string {
	return s.path
}

// Ping verifies the database connection is alive.
func (s *Store) Ping() error {
	if s == nil || s.db == nil {
		return fmt.Errorf("store not initialized")
	}
	return s.db.Ping()
}

// WithTx runs fn in a transaction.
func (s *Store) WithTx(fn func(*sqlc.Queries) error) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	q := s.queries.WithTx(tx)
	if err := fn(q); err != nil {
		if rbErr := tx.Rollback(); rbErr != nil {
			return fmt.Errorf("rollback after error %v: %w", err, rbErr)
		}
		return err
	}
	return tx.Commit()
}
