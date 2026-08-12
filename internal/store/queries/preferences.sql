-- name: GetPreference :one
SELECT
    key,
    value,
    updated_at
FROM preferences
WHERE key = ?;

-- name: UpsertPreference :exec
INSERT INTO preferences (
    key,
    value,
    updated_at
) VALUES (
    ?, ?, ?
)
ON CONFLICT(key) DO UPDATE SET
    value = excluded.value,
    updated_at = excluded.updated_at;
