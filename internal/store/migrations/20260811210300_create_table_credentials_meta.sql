-- +goose Up
CREATE TABLE credentials_meta (
    key_type          TEXT PRIMARY KEY,
    label             TEXT,
    last_validated_at DATETIME,
    masked_suffix     TEXT
);

-- +goose Down
DROP TABLE credentials_meta;
