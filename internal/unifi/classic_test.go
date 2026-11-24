package unifi_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"unifi-rollback/internal/unifi"
)

func TestClassicClient_SetLocate(t *testing.T) {
	t.Parallel()

	var (
		loginPayload map[string]any
		locateCookie string
		locateBody   string
	)
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := json.NewDecoder(r.Body).Decode(&loginPayload); err != nil {
			http.Error(w, "bad json", http.StatusBadRequest)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "TOKEN", Value: "session-cookie-secret", Path: "/"})
		w.Header().Set("x-csrf-token", "csrf-test")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	mux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-CSRF-Token") != "csrf-test" {
			http.Error(w, "missing csrf", http.StatusForbidden)
			return
		}
		if cookie, err := r.Cookie("TOKEN"); err == nil {
			locateCookie = cookie.Value
		}
		raw, _ := io.ReadAll(r.Body)
		locateBody = string(raw)
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})

	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)

	client, err := unifi.NewClassicClient(unifi.ClassicConfig{
		ConsoleBaseURL: srv.URL,
		Username:       "ubnt",
		Password:       "ubnt",
		Site:           "default",
		HTTP:           srv.Client(),
	})
	if err != nil {
		t.Fatalf("NewClassicClient() error = %v", err)
	}

	if err := client.SetLocate(context.Background(), "AA:BB:CC:DD:EE:FF"); err != nil {
		t.Fatalf("SetLocate() error = %v", err)
	}
	if loginPayload["username"] != "ubnt" || loginPayload["password"] != "ubnt" {
		t.Fatalf("login payload = %+v, want ubnt/ubnt", loginPayload)
	}
	if locateCookie != "session-cookie-secret" {
		t.Fatalf("locate request TOKEN cookie = %q, want session-cookie-secret", locateCookie)
	}
	if !strings.Contains(locateBody, `"set-locate"`) || !strings.Contains(locateBody, `"aa:bb:cc:dd:ee:ff"`) {
		t.Fatalf("SetLocate body = %s", locateBody)
	}

	if err := client.UnsetLocate(context.Background(), "aa:bb:cc:dd:ee:ff"); err != nil {
		t.Fatalf("UnsetLocate() error = %v", err)
	}
}

func TestClassicClient_LoginRefused(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status int
		body   string
	}{
		{
			name:   "http 401 unauthorized",
			status: http.StatusUnauthorized,
			body:   `{"code":"AUTHENTICATION_FAILED_INVALID_CREDENTIALS"}`,
		},
		{
			name:   "http 403 forbidden",
			status: http.StatusForbidden,
			body:   `{"code":"FORBIDDEN"}`,
		},
		{
			name:   "http 200 meta error",
			status: http.StatusOK,
			body:   `{"meta":{"rc":"error","msg":"api.err.Invalid"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				http.SetCookie(w, &http.Cookie{Name: "TOKEN", Value: "do-not-leak-cookie", Path: "/"})
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			}))
			t.Cleanup(srv.Close)

			client, err := unifi.NewClassicClient(unifi.ClassicConfig{
				ConsoleBaseURL: srv.URL,
				Username:       "ubnt",
				Password:       "super-secret-password",
				HTTP:           srv.Client(),
			})
			if err != nil {
				t.Fatalf("NewClassicClient() error = %v", err)
			}

			err = client.SetLocate(context.Background(), "aa:bb:cc:dd:ee:ff")
			if !errors.Is(err, unifi.ErrClassicLoginRefused) {
				t.Fatalf("SetLocate() error = %v, want ErrClassicLoginRefused", err)
			}
			if strings.Contains(err.Error(), "super-secret-password") || strings.Contains(err.Error(), "do-not-leak-cookie") {
				t.Fatalf("error leaked secret material: %q", err.Error())
			}
		})
	}
}

func TestClassicClient_CommandRefused(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		status int
		body   string
	}{
		{
			name:   "http 403 forbidden",
			status: http.StatusForbidden,
			body:   `{"meta":{"rc":"error","msg":"api.err.NoPermission"}}`,
		},
		{
			name:   "http 200 meta error",
			status: http.StatusOK,
			body:   `{"meta":{"rc":"error","msg":"api.err.UnknownDevice"}}`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			mux := http.NewServeMux()
			mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("x-csrf-token", "csrf-ok")
				_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
			})
			mux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tt.status)
				_, _ = w.Write([]byte(tt.body))
			})

			srv := httptest.NewServer(mux)
			t.Cleanup(srv.Close)

			client, err := unifi.NewClassicClient(unifi.ClassicConfig{
				ConsoleBaseURL: srv.URL,
				Username:       "ubnt",
				Password:       "ubnt",
				HTTP:           srv.Client(),
			})
			if err != nil {
				t.Fatalf("NewClassicClient() error = %v", err)
			}

			err = client.SetLocate(context.Background(), "aa:bb:cc:dd:ee:ff")
			if !errors.Is(err, unifi.ErrClassicCommandRefused) {
				t.Fatalf("SetLocate() error = %v, want ErrClassicCommandRefused", err)
			}
		})
	}
}

func TestNewClassicClientForLocalConsole_SelfSignedTLS(t *testing.T) {
	t.Parallel()

	var gotCookie string
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{Name: "TOKEN", Value: "tls-cookie", Path: "/"})
		w.Header().Set("x-csrf-token", "csrf-tls")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	mux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		if c, err := r.Cookie("TOKEN"); err == nil {
			gotCookie = c.Value
		}
		if r.Header.Get("X-CSRF-Token") != "csrf-tls" {
			http.Error(w, "missing csrf", http.StatusForbidden)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})

	srv := httptest.NewTLSServer(mux)
	t.Cleanup(srv.Close)

	client, err := unifi.NewClassicClientForLocalConsole(unifi.ClassicConfig{
		ConsoleBaseURL: srv.URL,
		Username:       "ubnt",
		Password:       "ubnt",
	})
	if err != nil {
		t.Fatalf("NewClassicClientForLocalConsole() error = %v", err)
	}

	if err := client.SetLocate(context.Background(), "AA:BB:CC:DD:EE:FF"); err != nil {
		t.Fatalf("SetLocate() error = %v", err)
	}
	if gotCookie != "tls-cookie" {
		t.Fatalf("locate request TOKEN cookie = %q, want tls-cookie", gotCookie)
	}
}
