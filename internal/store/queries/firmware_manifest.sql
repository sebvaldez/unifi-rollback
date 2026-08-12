-- name: ListFirmwareManifest :many
SELECT
    id,
    model,
    version,
    url,
    sha256,
    source_url,
    pinned_at,
    verified,
    notes
FROM firmware_manifest
ORDER BY model, version;

-- name: GetFirmwareManifest :one
SELECT
    id,
    model,
    version,
    url,
    sha256,
    source_url,
    pinned_at,
    verified,
    notes
FROM firmware_manifest
WHERE id = ?;

-- name: InsertFirmwareManifest :one
INSERT INTO firmware_manifest (
    model,
    version,
    url,
    sha256,
    source_url,
    pinned_at,
    verified,
    notes
) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?
)
RETURNING id;
