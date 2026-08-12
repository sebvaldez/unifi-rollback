-- +goose Up
CREATE TABLE devices (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL,
    mac             TEXT NOT NULL,
    model           TEXT NOT NULL,
    name            TEXT,
    current_fw      TEXT,
    adoption_state  TEXT,
    last_seen       DATETIME,
    updated_at      DATETIME
);

-- +goose Down
DROP TABLE devices;
