package store

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"

	"unifi-rollback/internal/store/sqlc"
)

func TestOpenRunsMigrations(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "test.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	devices, err := s.Queries().ListDevices(ctx)
	if err != nil {
		t.Fatalf("ListDevices() error = %v", err)
	}
	if devices == nil {
		t.Fatal("ListDevices() returned nil slice")
	}
	if len(devices) != 0 {
		t.Fatalf("ListDevices() len = %d, want 0", len(devices))
	}

	creds, err := s.Queries().ListCredentialsMeta(ctx)
	if err != nil {
		t.Fatalf("ListCredentialsMeta() error = %v", err)
	}
	if len(creds) != 0 {
		t.Fatalf("ListCredentialsMeta() len = %d, want 0", len(creds))
	}

	if err := s.Queries().UpsertPreference(ctx, sqlc.UpsertPreferenceParams{
		Key:       "firmware_cache_dir",
		Value:     "/tmp/firmware-cache",
		UpdatedAt: sql.NullTime{},
	}); err != nil {
		t.Fatalf("UpsertPreference() error = %v", err)
	}

	pref, err := s.Queries().GetPreference(ctx, "firmware_cache_dir")
	if err != nil {
		t.Fatalf("GetPreference() error = %v", err)
	}
	if pref.Value != "/tmp/firmware-cache" {
		t.Fatalf("GetPreference() value = %q, want /tmp/firmware-cache", pref.Value)
	}
}

func TestUpsertCredentialMetaLabelPreservesValidationFields(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "test.db")
	s, err := Open(path)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	q := s.Queries()
	now := sql.NullTime{Valid: true}

	if err := q.UpsertCredentialMeta(ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         "network_local:site-home",
		Label:           sql.NullString{String: "Old label", Valid: true},
		LastValidatedAt: now,
		MaskedSuffix:    sql.NullString{String: "…1234", Valid: true},
		ProbeSummary:    sql.NullString{},
	}); err != nil {
		t.Fatalf("UpsertCredentialMeta() error = %v", err)
	}

	if err := q.UpsertCredentialMetaLabel(ctx, sqlc.UpsertCredentialMetaLabelParams{
		KeyType: "network_local:site-home",
		Label:   sql.NullString{String: "Home Office", Valid: true},
	}); err != nil {
		t.Fatalf("UpsertCredentialMetaLabel() error = %v", err)
	}

	meta, err := q.GetCredentialMeta(ctx, "network_local:site-home")
	if err != nil {
		t.Fatalf("GetCredentialMeta() error = %v", err)
	}
	if !meta.Label.Valid || meta.Label.String != "Home Office" {
		t.Fatalf("Label = %+v, want Home Office", meta.Label)
	}
	if !meta.MaskedSuffix.Valid || meta.MaskedSuffix.String != "…1234" {
		t.Fatalf("MaskedSuffix = %+v, want preserved …1234", meta.MaskedSuffix)
	}
}
