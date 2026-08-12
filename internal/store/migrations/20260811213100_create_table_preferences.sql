-- +goose Up
CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      DATETIME
);

-- +goose Down
DROP TABLE preferences;
