CREATE TABLE devices (
    id              TEXT PRIMARY KEY,
    site_id         TEXT NOT NULL,
    mac             TEXT NOT NULL,
    model           TEXT NOT NULL,
    name            TEXT,
    current_fw      TEXT,
    adoption_state  TEXT,
    last_seen       DATETIME,
    updated_at      DATETIME,
    in_scope        INTEGER NOT NULL DEFAULT 1,
    scope_lost_at   DATETIME
);

CREATE INDEX idx_devices_site_id ON devices (site_id);

CREATE TABLE firmware_manifest (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model           TEXT NOT NULL,
    version         TEXT NOT NULL,
    url             TEXT NOT NULL,
    sha256          TEXT NOT NULL,
    source_url      TEXT,
    pinned_at       DATETIME,
    verified        BOOLEAN DEFAULT 0,
    notes           TEXT,
    UNIQUE(model, version)
);

CREATE TABLE community_analysis (
    post_url        TEXT PRIMARY KEY,
    content_hash    TEXT NOT NULL,
    confidence_json TEXT NOT NULL,
    analyzed_at     DATETIME
);

CREATE TABLE credentials_meta (
    key_type          TEXT PRIMARY KEY,
    label             TEXT,
    last_validated_at DATETIME,
    masked_suffix     TEXT,
    probe_summary     TEXT
);

CREATE TABLE action_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       TEXT NOT NULL,
    from_version    TEXT,
    to_version      TEXT,
    manifest_id     INTEGER,
    initiated_at    DATETIME,
    completed_at    DATETIME,
    result          TEXT,
    error_detail    TEXT
);

CREATE TABLE preferences (
    key             TEXT PRIMARY KEY,
    value           TEXT NOT NULL,
    updated_at      DATETIME
);
