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
    updated_at,
    in_scope,
    scope_lost_at
FROM devices
ORDER BY in_scope DESC, name, id;

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
    updated_at,
    in_scope,
    scope_lost_at
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)
ON CONFLICT(id) DO UPDATE SET
    site_id = excluded.site_id,
    mac = excluded.mac,
    model = excluded.model,
    name = excluded.name,
    current_fw = excluded.current_fw,
    adoption_state = excluded.adoption_state,
    last_seen = excluded.last_seen,
    updated_at = excluded.updated_at,
    in_scope = excluded.in_scope,
    scope_lost_at = excluded.scope_lost_at;

-- name: MarkDeviceOutOfScope :exec
UPDATE devices
SET
    in_scope = 0,
    scope_lost_at = ?,
    updated_at = ?
WHERE id = ? AND in_scope = 1;

-- name: DeleteAllDevices :exec
DELETE FROM devices;
