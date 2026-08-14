package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkClientViaConnector(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/connector/consoles/console-1/proxy/network/integration/v1/info", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-KEY") != "cloud-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"applicationVersion": "9.1.0"})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	sm := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "cloud-key", srv.Client())
	net := unifi.NewNetworkClientViaConnector(sm, "console-1")

	info, err := net.Info(context.Background())
	if err != nil {
		t.Fatalf("Info() via connector error = %v", err)
	}
	if info.ApplicationVersion != "9.1.0" {
		t.Fatalf("Info() = %+v", info)
	}
}
