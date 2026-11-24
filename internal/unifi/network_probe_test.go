package unifi_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"strings"
	"sync"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkClient_ProbeKeyAccess(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/info", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "10.3.58"})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 1, "limit": 200, "offset": 0, "totalCount": 1,
			"data": []map[string]any{{
				"id": "site-uuid", "internalReference": "default", "name": "Default",
			}},
		})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices", func(w http.ResponseWriter, r *http.Request) {
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
	if probe.NetworkSiteID != "site-uuid" {
		t.Fatalf("NetworkSiteID = %q, want site-uuid", probe.NetworkSiteID)
	}
	if probe.DeviceCount != 1 {
		t.Fatalf("DeviceCount = %d, want 1", probe.DeviceCount)
	}

	caps := unifi.CapabilitiesFromNetworkProbe(probe)
	if len(caps) != 0 {
		t.Fatalf("CapabilitiesFromNetworkProbe() unverified = %v, want nil", caps)
	}

	probe.NetworkKeyVerified = true
	caps = unifi.CapabilitiesFromNetworkProbe(probe)
	if len(caps) != 2 {
		t.Fatalf("CapabilitiesFromNetworkProbe() verified = %v", caps)
	}
}

func TestSiteCapabilities(t *testing.T) {
	t.Parallel()

	connector := unifi.CapabilitiesFromConnectorProbe(unifi.ConnectorProbe{NetworkSiteID: "site-uuid"})

	tests := []struct {
		name      string
		connector []string
		lan       unifi.NetworkKeyProbe
		want      []string
	}{
		{
			name:      "connector only",
			connector: connector,
			want:      []string{"device_read", "device_restart", "firmware_check"},
		},
		{
			name:      "failed LAN probe keeps connector capabilities",
			connector: connector,
			lan:       unifi.UntestedLANProbe(),
			want:      []string{"device_read", "device_restart", "firmware_check"},
		},
		{
			name:      "verified LAN probe adds nothing new",
			connector: connector,
			lan:       unifi.NetworkKeyProbe{NetworkKeyVerified: true},
			want:      []string{"device_read", "device_restart", "firmware_check"},
		},
		{
			name: "verified LAN probe alone grants restart",
			lan:  unifi.NetworkKeyProbe{NetworkKeyVerified: true},
			want: []string{"device_read", "device_restart"},
		},
		{
			name: "nothing established",
			lan:  unifi.UntestedLANProbe(),
			want: []string{},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := unifi.SiteCapabilities(tc.connector, tc.lan)
			if !slices.Equal(got, tc.want) {
				t.Fatalf("SiteCapabilities() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestCapabilitiesFromConnectorProbe(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		probe unifi.ConnectorProbe
		want  []string
	}{
		{"site resolved", unifi.ConnectorProbe{NetworkSiteID: "site-uuid"}, []string{"device_read", "device_restart", "firmware_check"}},
		{"zero probe", unifi.ConnectorProbe{}, nil},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := unifi.CapabilitiesFromConnectorProbe(tc.probe); !slices.Equal(got, tc.want) {
				t.Fatalf("CapabilitiesFromConnectorProbe() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestClassifyLANProbe(t *testing.T) {
	t.Parallel()

	reached := unifi.NetworkKeyProbe{ApplicationVersion: "10.3.58", NetworkSiteID: "site-uuid", DeviceCount: 2}

	tests := []struct {
		name         string
		probe        unifi.NetworkKeyProbe
		err          error
		wantErr      bool
		wantVerified bool
		wantDevices  int
	}{
		{name: "key accepted", probe: reached, wantVerified: true, wantDevices: 2},
		{
			name:    "key rejected",
			err:     &unifi.HTTPError{Method: "GET", Path: "info", StatusCode: http.StatusUnauthorized},
			wantErr: true,
		},
		{
			name: "console unreachable is untested, not failed",
			err:  errors.New("dial tcp 192.168.1.1:443: i/o timeout"),
		},
		{
			name: "server error is untested, not failed",
			err:  &unifi.HTTPError{Method: "GET", Path: "info", StatusCode: http.StatusBadGateway},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := unifi.ClassifyLANProbe(tc.probe, tc.err)
			if (err != nil) != tc.wantErr {
				t.Fatalf("ClassifyLANProbe() error = %v, wantErr %v", err, tc.wantErr)
			}
			if got.NetworkKeyVerified != tc.wantVerified {
				t.Fatalf("NetworkKeyVerified = %v, want %v", got.NetworkKeyVerified, tc.wantVerified)
			}
			if got.DeviceCount != tc.wantDevices {
				t.Fatalf("DeviceCount = %d, want %d", got.DeviceCount, tc.wantDevices)
			}
		})
	}
}

func connectorTestServer(t *testing.T, siteManagerKey string, seenKeys *[]string) *httptest.Server {
	t.Helper()

	const prefix = "/v1/connector/consoles/host-1/proxy/network/integration/v1"
	var mu sync.Mutex
	record := func(r *http.Request) bool {
		mu.Lock()
		*seenKeys = append(*seenKeys, r.Header.Get("X-API-KEY"))
		mu.Unlock()
		return r.Header.Get("X-API-KEY") == siteManagerKey
	}

	mux := http.NewServeMux()
	mux.HandleFunc(prefix+"/info", func(w http.ResponseWriter, r *http.Request) {
		if !record(r) {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "10.3.58"})
	})
	mux.HandleFunc(prefix+"/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = record(r)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 1, "limit": 200, "offset": 0, "totalCount": 1,
			"data": []map[string]any{{"id": "site-uuid", "internalReference": "default", "name": "Default"}},
		})
	})
	mux.HandleFunc(prefix+"/sites/site-uuid/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = record(r)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 1, "limit": 200, "offset": 0, "totalCount": 1,
			"data": []map[string]any{{"id": "dev-1", "name": "AP"}},
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv
}

func TestSiteManagerClient_ProbeSiteViaConnector(t *testing.T) {
	t.Parallel()

	var seen []string
	srv := connectorTestServer(t, "site-manager-key", &seen)
	sm := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "site-manager-key", srv.Client())

	probe, err := sm.ProbeSiteViaConnector(context.Background(), "host-1", "default")
	if err != nil {
		t.Fatalf("ProbeSiteViaConnector() error = %v", err)
	}

	if probe.NetworkSiteID != "site-uuid" || probe.DeviceCount != 1 {
		t.Fatalf("probe = %+v", probe)
	}
	if len(seen) == 0 {
		t.Fatal("connector received no requests")
	}
	for _, key := range seen {
		if key != "site-manager-key" {
			t.Fatalf("connector request carried key %q, want only the Site Manager key", key)
		}
	}

	raw, err := json.Marshal(probe)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(strings.ToLower(string(raw)), "verified") {
		t.Fatalf("connector probe claims key verification: %s", raw)
	}
	if want := []string{"device_read", "device_restart", "firmware_check"}; !slices.Equal(unifi.CapabilitiesFromConnectorProbe(probe), want) {
		t.Fatalf("capabilities = %v, want %v", unifi.CapabilitiesFromConnectorProbe(probe), want)
	}
}

func TestResolveNetworkClient(t *testing.T) {
	t.Parallel()

	var seen []string
	srv := connectorTestServer(t, "site-manager-key", &seen)
	sm := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "site-manager-key", srv.Client())

	lanMux := http.NewServeMux()
	lanMux.HandleFunc("/proxy/network/integration/v1/info", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "lan"})
	})
	lanSrv := httptest.NewServer(lanMux)
	t.Cleanup(lanSrv.Close)
	lan := unifi.NewNetworkClientWithHTTP(lanSrv.URL, "per-site-key", lanSrv.Client())

	tests := []struct {
		name        string
		reachable   *unifi.NetworkClient
		wantVersion string
	}{
		{name: "no LAN client uses the connector", reachable: nil, wantVersion: "10.3.58"},
		{name: "reachable LAN client wins", reachable: lan, wantVersion: "lan"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			info, err := unifi.ResolveNetworkClient(sm, "host-1", tc.reachable).Info(context.Background())
			if err != nil {
				t.Fatalf("Info() error = %v", err)
			}
			if info.ApplicationVersion != tc.wantVersion {
				t.Fatalf("ApplicationVersion = %q, want %q", info.ApplicationVersion, tc.wantVersion)
			}
		})
	}
}
