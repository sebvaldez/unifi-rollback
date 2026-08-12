-- name: GetCredentialMeta :one
SELECT
    key_type,
    label,
    last_validated_at,
    masked_suffix
FROM credentials_meta
WHERE key_type = ?;

-- name: ListCredentialsMeta :many
SELECT
    key_type,
    label,
    last_validated_at,
    masked_suffix
FROM credentials_meta
ORDER BY key_type;

-- name: UpsertCredentialMeta :exec
INSERT INTO credentials_meta (
    key_type,
    label,
    last_validated_at,
    masked_suffix
) VALUES (
    ?, ?, ?, ?
)
ON CONFLICT(key_type) DO UPDATE SET
    label = excluded.label,
    last_validated_at = excluded.last_validated_at,
    masked_suffix = excluded.masked_suffix;

-- name: DeleteCredentialMeta :exec
DELETE FROM credentials_meta
WHERE key_type = ?;
