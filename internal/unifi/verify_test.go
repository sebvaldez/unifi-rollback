package unifi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"unifi-rollback/internal/unifi"
)

func TestRollbackVerifier_WaitForFirmwareVersion(t *testing.T) {
	t.Parallel()

	calls := 0
	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices/dev-uuid", func(w http.ResponseWriter, r *http.Request) {
		calls++
		version := "6.6.64"
		if calls >= 2 {
			version = "6.6.55"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id": "dev-uuid", "firmwareVersion": version, "state": "ONLINE",
			"macAddress": "94:2a:6f:26:c6:ca", "model": "U6Pro", "name": "AP",
			"firmwareUpdatable": true, "supported": true,
		})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewNetworkClientWithHTTP(srv.URL, "key", srv.Client())
	verifier := unifi.NewRollbackVerifier(client)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var polled []string
	err := verifier.WaitForFirmwareVersion(ctx, "site-uuid", "dev-uuid", "6.6.55", unifi.RollbackVerifyOptions{
		Interval: 20 * time.Millisecond,
		Timeout:  2 * time.Second,
		OnPoll:   func(reported string) { polled = append(polled, reported) },
	})
	if err != nil {
		t.Fatalf("WaitForFirmwareVersion() error = %v", err)
	}
	if calls < 2 {
		t.Fatalf("expected at least 2 polls, got %d", calls)
	}
	if len(polled) == 0 || polled[len(polled)-1] != "6.6.55" {
		t.Fatalf("polled versions = %v", polled)
	}
}

func TestRollbackVerifier_VerifyFirmwareVersion(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("/proxy/network/integration/v1/sites/site-uuid/devices/dev-uuid", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id": "dev-uuid", "firmwareVersion": "6.6.55", "state": "ONLINE",
			"firmwareUpdatable": true, "supported": true,
		})
	})
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client := unifi.NewNetworkClientWithHTTP(srv.URL, "key", srv.Client())
	ok, reported, err := unifi.NewRollbackVerifier(client).VerifyFirmwareVersion(
		context.Background(), "site-uuid", "dev-uuid", "6.6.55",
	)
	if err != nil {
		t.Fatalf("VerifyFirmwareVersion() error = %v", err)
	}
	if !ok || reported != "6.6.55" {
		t.Fatalf("ok=%v reported=%q", ok, reported)
	}
}
