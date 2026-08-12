-- +goose Up
CREATE INDEX idx_devices_site_id ON devices (site_id);

-- +goose Down
DROP INDEX idx_devices_site_id;
