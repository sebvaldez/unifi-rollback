package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestNetworkClient_ResolveNetworkSiteID(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"count": 2, "limit": 200, "offset": 0, "totalCount": 2,
			"data": []map[string]any{
				{"id": "site-uuid", "internalReference": "default", "name": "Default"},
				{"id": "lab-uuid", "internalReference": "lab", "name": "Lab"},
			},
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewNetworkClientWithHTTP(srv.URL, "integration-key", srv.Client())

	got, err := client.ResolveNetworkSiteID(context.Background(), "default")
	if err != nil {
		t.Fatalf("ResolveNetworkSiteID(default) error = %v", err)
	}
	if got != "site-uuid" {
		t.Fatalf("ResolveNetworkSiteID(default) = %q, want site-uuid", got)
	}

	got, err = client.ResolveNetworkSiteID(context.Background(), "lab-uuid")
	if err != nil {
		t.Fatalf("ResolveNetworkSiteID(lab-uuid) error = %v", err)
	}
	if got != "lab-uuid" {
		t.Fatalf("ResolveNetworkSiteID(lab-uuid) = %q", got)
	}

	_, err = client.ResolveNetworkSiteID(context.Background(), "missing")
	if err == nil {
		t.Fatal("ResolveNetworkSiteID(missing) expected error")
	}
}
