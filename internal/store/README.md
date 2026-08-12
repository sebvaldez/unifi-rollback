# store

SQLite persistence for devices, firmware manifest, credential metadata, and action logs.

## Stack

| Tool | Role |
|---|---|
| [Goose](https://github.com/pressly/goose) | Versioned SQL migrations |
| [sqlc](https://sqlc.dev) | Type-safe query generation |
| `modernc.org/sqlite` | cgo-free SQLite driver |

Schema is defined in SPEC.md §5.1. Secrets belong in Keychain, not here.

## Layout

```
internal/store/
├── migrations/     # Goose SQL migrations (source of truth for schema changes)
├── queries/        # sqlc query definitions
├── schema.sql      # Full schema snapshot for sqlc (update after migrations)
├── sqlc.yaml       # sqlc config
├── sqlc/           # Generated Go code (do not edit)
└── store.go        # Open, migrate, Store wrapper
```

## Migration naming

Rails-style timestamp + description:

```
YYYYMMDDHHMMSS_create_table_devices.sql
YYYYMMDDHHMMSS_add_idx_devices_site_id.sql
```

## Commands

Run from `internal/store/`:

```bash
# Apply migrations to a local dev database
goose -dir migrations sqlite3 /tmp/unifi-rollback-dev.db up

# Regenerate sqlc after schema/query changes
go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.29.0 generate
```

In the app, migrations run automatically on startup via embedded Goose migrations in `store.Open()`.

## Default database path

```
~/Library/Application Support/unifi-rollback/unifi-rollback.db
```

## Usage

```go
s, err := store.OpenDefault()
if err != nil {
    return err
}
defer s.Close()

devices, err := s.Queries().ListDevices(ctx)
```

Cursor-specific conventions are also documented in `.cursor/rules/database.mdc`.
