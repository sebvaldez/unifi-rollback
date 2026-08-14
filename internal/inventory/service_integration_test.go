package inventory_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"unifi-rollback/internal/inventory"
	"unifi-rollback/internal/store"
	"unifi-rollback/internal/unifi"
)

func TestServiceRefreshFromSiteManager(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
	})
	mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"siteId": "site-home",
				"hostId": "host-1",
				"meta":   map[string]string{"name": "Home"},
			}},
		})
	})
	mux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"hostId":   "host-1",
				"hostName": "udm.local",
				"devices": []map[string]string{{
					"id": "dev-1", "mac": "aa:bb:cc:dd:ee:01", "name": "AP", "model": "U6-Pro",
					"status": "online", "version": "6.6.65",
				}},
			}},
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "test-key", srv.Client())
	service := inventory.NewService(client)

	dbPath := filepath.Join(t.TempDir(), "inventory.db")
	s, err := store.Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	devices, err := service.RefreshFromSiteManager(ctx, s.Queries())
	if err != nil {
		t.Fatalf("RefreshFromSiteManager() error = %v", err)
	}
	if len(devices) != 1 {
		t.Fatalf("len(devices) = %d, want 1", len(devices))
	}
	if devices[0].ID != "dev-1" {
		t.Fatalf("ID = %q, want dev-1", devices[0].ID)
	}
	if !devices[0].InScope {
		t.Fatal("expected device to be in scope")
	}
	if devices[0].Site != "Home" {
		t.Fatalf("Site = %q, want Home", devices[0].Site)
	}
}

func TestServiceRefreshFromSiteManager_MarksOutOfScopeDevices(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
	})
	mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"siteId": "site-home",
				"hostId": "host-1",
				"meta":   map[string]string{"name": "Home"},
			}},
		})
	})
	deviceResponses := []map[string]any{
		{
			"data": []map[string]any{{
				"hostId": "host-1",
				"devices": []map[string]string{
					{"id": "dev-1", "mac": "aa:bb:cc:dd:ee:01", "name": "AP 1", "model": "U6-Pro", "status": "online", "version": "1.0"},
					{"id": "dev-2", "mac": "aa:bb:cc:dd:ee:02", "name": "AP 2", "model": "U6-Pro", "status": "online", "version": "1.0"},
				},
			}},
		},
		{
			"data": []map[string]any{{
				"hostId": "host-1",
				"devices": []map[string]string{
					{"id": "dev-1", "mac": "aa:bb:cc:dd:ee:01", "name": "AP 1", "model": "U6-Pro", "status": "online", "version": "1.0"},
				},
			}},
		},
	}
	responseIndex := 0
	mux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
		payload := deviceResponses[responseIndex]
		if responseIndex < len(deviceResponses)-1 {
			responseIndex++
		}
		_ = json.NewEncoder(w).Encode(payload)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "test-key", srv.Client())
	service := inventory.NewService(client)

	dbPath := filepath.Join(t.TempDir(), "inventory.db")
	s, err := store.Open(dbPath)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	if _, err := service.RefreshFromSiteManager(ctx, s.Queries()); err != nil {
		t.Fatalf("first RefreshFromSiteManager() error = %v", err)
	}

	devices, err := service.RefreshFromSiteManager(ctx, s.Queries())
	if err != nil {
		t.Fatalf("second RefreshFromSiteManager() error = %v", err)
	}
	if len(devices) != 2 {
		t.Fatalf("len(devices) = %d, want 2", len(devices))
	}

	var ghost *inventory.Device
	for i := range devices {
		if devices[i].ID == "dev-2" {
			ghost = &devices[i]
			break
		}
	}
	if ghost == nil {
		t.Fatal("dev-2 not found")
	}
	if ghost.InScope {
		t.Fatal("dev-2 should be out of scope")
	}
	if ghost.ScopeLostAt == "" {
		t.Fatal("expected scopeLostAt to be set")
	}
}
