-- +goose Up
CREATE TABLE firmware_manifest (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model           TEXT NOT NULL,
    version         TEXT NOT NULL,
    url             TEXT NOT NULL,
    sha256          TEXT NOT NULL,
    source_url      TEXT,
    pinned_at       DATETIME,
    verified        BOOLEAN DEFAULT 0,
    notes           TEXT,
    UNIQUE(model, version)
);

-- +goose Down
DROP TABLE firmware_manifest;
