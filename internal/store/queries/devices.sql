-- name: ListDevices :many
SELECT
    id,
    site_id,
    mac,
    model,
    name,
    current_fw,
    adoption_state,
    last_seen,
    updated_at
FROM devices
ORDER BY name, id;

-- name: UpsertDevice :exec
INSERT INTO devices (
    id,
    site_id,
    mac,
    model,
    name,
    current_fw,
    adoption_state,
    last_seen,
    updated_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT(id) DO UPDATE SET
    site_id = excluded.site_id,
    mac = excluded.mac,
    model = excluded.model,
    name = excluded.name,
    current_fw = excluded.current_fw,
    adoption_state = excluded.adoption_state,
    last_seen = excluded.last_seen,
    updated_at = excluded.updated_at;

-- name: DeleteAllDevices :exec
DELETE FROM devices;
