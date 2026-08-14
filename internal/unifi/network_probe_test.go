package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkClient_ProbeKeyAccess(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/info", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "10.3.58"})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/default/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 1, "limit": 200, "offset": 0, "totalCount": 1,
			"data": []map[string]any{{"id": "dev-1", "name": "AP"}},
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewNetworkClientWithHTTP(srv.URL, "integration-key", srv.Client())
	probe, err := client.ProbeKeyAccess(context.Background(), "default")
	if err != nil {
		t.Fatalf("ProbeKeyAccess() error = %v", err)
	}
	if probe.ApplicationVersion != "10.3.58" {
		t.Fatalf("ApplicationVersion = %q", probe.ApplicationVersion)
	}
	if probe.DeviceCount != 1 {
		t.Fatalf("DeviceCount = %d, want 1", probe.DeviceCount)
	}

	caps := unifi.CapabilitiesFromNetworkProbe(probe)
	if len(caps) != 2 {
		t.Fatalf("CapabilitiesFromNetworkProbe() = %v", caps)
	}
}
