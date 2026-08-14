package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestSiteManagerClient_ProbeKeyAccess(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{
					"siteId":     "site-a",
					"hostId":     "host-1",
					"permission": "admin",
					"meta":       map[string]string{"name": "Portland - Oregon"},
				},
				{
					"siteId":     "site-b",
					"hostId":     "host-2",
					"permission": "admin",
					"meta":       map[string]string{"name": "UNAS Pro 4"},
				},
			},
		})
	})
	mux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{
					"hostId": "host-1",
					"devices": []map[string]string{
						{"id": "dev-1", "productLine": "network", "status": "online"},
						{"id": "dev-2", "productLine": "protect", "status": "online"},
					},
				},
			},
		})
	})
	mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{
					"id": "host-1",
					"userData": map[string]any{
						"controllers": []string{"network", "protect"},
					},
				},
			},
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "test-key", srv.Client())
	probe, err := client.ProbeKeyAccess(context.Background())
	if err != nil {
		t.Fatalf("ProbeKeyAccess() error = %v", err)
	}

	if len(probe.Sites) != 2 {
		t.Fatalf("len(Sites) = %d, want 2", len(probe.Sites))
	}
	if probe.DeviceCount != 2 {
		t.Fatalf("DeviceCount = %d, want 2", probe.DeviceCount)
	}
	if len(probe.ApplicationsObserved) != 2 {
		t.Fatalf("ApplicationsObserved = %v", probe.ApplicationsObserved)
	}

	caps := unifi.CapabilitiesFromProbe(probe)
	if len(caps) != 2 {
		t.Fatalf("CapabilitiesFromProbe() = %v", caps)
	}
}
