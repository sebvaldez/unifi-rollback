-- +goose Up
CREATE TABLE action_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       TEXT NOT NULL,
    from_version    TEXT,
    to_version      TEXT,
    manifest_id     INTEGER,
    initiated_at    DATETIME,
    completed_at    DATETIME,
    result          TEXT,
    error_detail    TEXT
);

-- +goose Down
DROP TABLE action_log;
