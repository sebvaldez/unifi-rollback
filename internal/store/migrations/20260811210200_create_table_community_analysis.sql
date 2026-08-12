-- +goose Up
CREATE TABLE community_analysis (
    post_url        TEXT PRIMARY KEY,
    content_hash    TEXT NOT NULL,
    confidence_json TEXT NOT NULL,
    analyzed_at     DATETIME
);

-- +goose Down
DROP TABLE community_analysis;
