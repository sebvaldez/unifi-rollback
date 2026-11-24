package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"slices"
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

func TestSiteManagerClient_ProbeKeyAccess_ConnectorCapabilities(t *testing.T) {
	t.Parallel()

	const connectorPrefix = "/v1/connector/consoles/host-1/proxy/network/integration/v1"

	tests := []struct {
		name          string
		connectorOK   bool
		hostID        string
		wantSiteCaps  []string
		wantProbeCaps []string
	}{
		{
			name:          "connector reachable grants restart and firmware check",
			connectorOK:   true,
			hostID:        "host-1",
			wantSiteCaps:  []string{"device_read", "device_restart", "firmware_check"},
			wantProbeCaps: []string{"inventory", "connector_proxy", "device_read", "device_restart", "firmware_check"},
		},
		{
			name:          "connector refused leaves inventory only",
			connectorOK:   false,
			hostID:        "host-1",
			wantProbeCaps: []string{"inventory", "connector_proxy"},
		},
		{
			name:          "site without a host is never probed",
			connectorOK:   true,
			hostID:        "",
			wantProbeCaps: []string{"inventory", "connector_proxy"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			mux := http.NewServeMux()
			mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{{
					"siteId": "default", "hostId": tc.hostID, "permission": "admin",
					"meta": map[string]string{"name": "Default"},
				}}})
			})
			mux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
			})
			mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
				_ = json.NewEncoder(w).Encode(map[string]any{"data": []map[string]any{{"id": "host-1"}}})
			})
			mux.HandleFunc(connectorPrefix+"/", func(w http.ResponseWriter, r *http.Request) {
				if !tc.connectorOK {
					http.Error(w, "forbidden", http.StatusForbidden)
					return
				}
				switch r.URL.Path {
				case connectorPrefix + "/info":
					_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "10.3.58"})
				case connectorPrefix + "/sites":
					_ = json.NewEncoder(w).Encode(map[string]any{
						"count": 1, "totalCount": 1,
						"data": []map[string]any{{"id": "site-uuid", "internalReference": "default", "name": "Default"}},
					})
				case connectorPrefix + "/sites/site-uuid/devices":
					_ = json.NewEncoder(w).Encode(map[string]any{
						"count": 1, "totalCount": 1,
						"data": []map[string]any{{"id": "dev-1"}},
					})
				default:
					http.NotFound(w, r)
				}
			})
			srv := httptest.NewServer(mux)
			t.Cleanup(srv.Close)

			client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "site-manager-key", srv.Client())
			probe, err := client.ProbeKeyAccess(context.Background())
			if err != nil {
				t.Fatalf("ProbeKeyAccess() error = %v", err)
			}

			if got := probe.Sites[0].Capabilities; !slices.Equal(got, tc.wantSiteCaps) {
				t.Fatalf("site capabilities = %v, want %v", got, tc.wantSiteCaps)
			}
			if got := unifi.CapabilitiesFromProbe(probe); !slices.Equal(got, tc.wantProbeCaps) {
				t.Fatalf("CapabilitiesFromProbe() = %v, want %v", got, tc.wantProbeCaps)
			}
		})
	}
}
