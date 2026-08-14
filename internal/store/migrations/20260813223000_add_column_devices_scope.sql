-- +goose Up
ALTER TABLE devices ADD COLUMN in_scope INTEGER NOT NULL DEFAULT 1;
ALTER TABLE devices ADD COLUMN scope_lost_at DATETIME;

-- +goose Down
ALTER TABLE devices DROP COLUMN scope_lost_at;
ALTER TABLE devices DROP COLUMN in_scope;
