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

func TestClassicClient_SetLocate(t *testing.T) {
	t.Parallel()

	var locateBody string
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-csrf-token", "csrf-test")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	mux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-CSRF-Token") != "csrf-test" {
			http.Error(w, "missing csrf", http.StatusForbidden)
			return
		}
		raw, _ := io.ReadAll(r.Body)
		locateBody = string(raw)
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client, err := unifi.NewClassicClient(unifi.ClassicConfig{
		ConsoleBaseURL: srv.URL,
		Username:       "admin",
		Password:       "secret",
		Site:           "default",
		HTTP:           srv.Client(),
	})
	if err != nil {
		t.Fatalf("NewClassicClient() error = %v", err)
	}

	if err := client.SetLocate(context.Background(), "AA:BB:CC:DD:EE:FF"); err != nil {
		t.Fatalf("SetLocate() error = %v", err)
	}
	if !strings.Contains(locateBody, `"set-locate"`) || !strings.Contains(locateBody, `"aa:bb:cc:dd:ee:ff"`) {
		t.Fatalf("SetLocate body = %s", locateBody)
	}

	if err := client.UnsetLocate(context.Background(), "aa:bb:cc:dd:ee:ff"); err != nil {
		t.Fatalf("UnsetLocate() error = %v", err)
	}
}
