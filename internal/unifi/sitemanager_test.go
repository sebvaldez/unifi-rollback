package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestSiteManagerClient_ListSitesHostsDevices(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-KEY") != "test-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]string{{"siteId": "site-1", "hostId": "host-1"}},
		})
	})
	mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]string{{"id": "host-1", "type": "console"}},
		})
	})
	mux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("nextToken") == "page2" {
			_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"hostId":   "host-1",
				"hostName": "udm.local",
				"devices": []map[string]string{{
					"id": "dev-1", "mac": "aa:bb:cc:dd:ee:01", "name": "AP", "model": "U6-Pro", "status": "online", "version": "6.6.65",
				}},
			}},
			"nextToken": "page2",
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "test-key", srv.Client())

	sites, err := client.ListSites(context.Background())
	if err != nil {
		t.Fatalf("ListSites() error = %v", err)
	}
	if len(sites) != 1 || sites[0].SiteID != "site-1" {
		t.Fatalf("ListSites() = %+v", sites)
	}

	hosts, err := client.ListHosts(context.Background())
	if err != nil {
		t.Fatalf("ListHosts() error = %v", err)
	}
	if len(hosts) != 1 || hosts[0].ID != "host-1" {
		t.Fatalf("ListHosts() = %+v", hosts)
	}

	groups, err := client.ListAllDevices(context.Background(), unifi.ListDevicesParams{})
	if err != nil {
		t.Fatalf("ListAllDevices() error = %v", err)
	}
	if len(groups) != 1 || len(groups[0].Devices) != 1 {
		t.Fatalf("ListAllDevices() = %+v", groups)
	}
}

func TestSiteManagerClient_ValidateKey(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "bad key", http.StatusUnauthorized)
	}))
	t.Cleanup(srv.Close)

	client := unifi.NewSiteManagerClientWithBase(srv.URL+"/v1", "bad", srv.Client())
	if err := client.ValidateKey(context.Background()); err == nil {
		t.Fatal("ValidateKey() expected error")
	}
}
