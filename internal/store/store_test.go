package store

import (
	"context"
	"path/filepath"
	"testing"
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
}
