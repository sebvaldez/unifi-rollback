-- +goose Up
ALTER TABLE credentials_meta ADD COLUMN probe_summary TEXT;

-- +goose Down
ALTER TABLE credentials_meta DROP COLUMN probe_summary;
