package unifi_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkClient_DevicesAndActions(t *testing.T) {
	t.Parallel()

	var restartCalled bool
	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/info", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "10.3.58"})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 1, "limit": 200, "offset": 0, "totalCount": 1,
			"data": []map[string]any{{
				"id": "dev-uuid", "macAddress": "94:2a:6f:26:c6:ca", "name": "AP",
				"model": "U6Pro", "state": "ONLINE", "firmwareVersion": "6.6.65",
				"firmwareUpdatable": true, "supported": true,
			}},
		})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices/dev-uuid", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"id": "dev-uuid", "firmwareVersion": "6.6.65", "state": "ONLINE",
				"macAddress": "94:2a:6f:26:c6:ca", "model": "U6Pro", "name": "AP",
				"firmwareUpdatable": true, "supported": true,
			})
			return
		}
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices/dev-uuid/statistics/latest", func(w http.ResponseWriter, r *http.Request) {
		uptime := int64(3600)
		_ = json.NewEncoder(w).Encode(map[string]any{"uptimeSec": uptime})
	})
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices/dev-uuid/actions", func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		if !strings.Contains(string(body), `"RESTART"`) {
			http.Error(w, "bad action", http.StatusBadRequest)
			return
		}
		restartCalled = true
		w.WriteHeader(http.StatusOK)
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewNetworkClientWithHTTP(srv.URL, "integration-key", srv.Client())

	info, err := client.Info(context.Background())
	if err != nil {
		t.Fatalf("Info() error = %v", err)
	}
	if info.ApplicationVersion != "10.3.58" {
		t.Fatalf("Info() = %+v", info)
	}

	devices, err := client.ListDevices(context.Background(), "site-uuid")
	if err != nil {
		t.Fatalf("ListDevices() error = %v", err)
	}
	if len(devices) != 1 || devices[0].FirmwareVersion != "6.6.65" {
		t.Fatalf("ListDevices() = %+v", devices)
	}

	detail, err := client.GetDevice(context.Background(), "site-uuid", "dev-uuid")
	if err != nil {
		t.Fatalf("GetDevice() error = %v", err)
	}
	if detail.FirmwareVersion != "6.6.65" {
		t.Fatalf("GetDevice() = %+v", detail)
	}

	stats, err := client.LatestStatistics(context.Background(), "site-uuid", "dev-uuid")
	if err != nil {
		t.Fatalf("LatestStatistics() error = %v", err)
	}
	if stats.UptimeSec == nil || *stats.UptimeSec != 3600 {
		t.Fatalf("LatestStatistics() = %+v", stats)
	}

	if err := client.RestartDevice(context.Background(), "site-uuid", "dev-uuid"); err != nil {
		t.Fatalf("RestartDevice() error = %v", err)
	}
	if !restartCalled {
		t.Fatal("RestartDevice() did not hit actions endpoint")
	}
}
