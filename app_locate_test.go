package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"unifi-rollback/internal/inventory"
	"unifi-rollback/internal/secrets"
	"unifi-rollback/internal/store"
	"unifi-rollback/internal/store/sqlc"
	"unifi-rollback/internal/unifi"
)

func openTestStoreWithDevice(t *testing.T, siteID, deviceID, mac string) *store.Store {
	t.Helper()

	s, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() {
		_ = s.Close()
	})

	err = s.Queries().UpsertDevice(context.Background(), sqlc.UpsertDeviceParams{
		ID:            deviceID,
		SiteID:        siteID,
		Mac:           mac,
		Model:         "U7-Pro-XGS",
		Name:          sql.NullString{String: "Hall AP", Valid: true},
		CurrentFw:     sql.NullString{String: "7.0.102", Valid: true},
		AdoptionState: sql.NullString{String: "online", Valid: true},
		UpdatedAt:     sql.NullTime{Time: time.Now().UTC(), Valid: true},
		InScope:       1,
	})
	if err != nil {
		t.Fatalf("UpsertDevice() error = %v", err)
	}

	return s
}

func TestLocateDevice_SuccessViaHostRecordAndFactoryUbntLogin(t *testing.T) {
	var (
		loginMethod string
		loginPath   string
		loginReq    map[string]any
		locatePath  string
		locateCSRF  string
		locateToken string
		locateReq   map[string]any
	)

	consoleMux := http.NewServeMux()
	consoleMux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		loginMethod = r.Method
		loginPath = r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&loginReq); err != nil {
			http.Error(w, "invalid login json", http.StatusBadRequest)
			return
		}
		http.SetCookie(w, &http.Cookie{Name: "TOKEN", Value: "console-session-token", Path: "/"})
		w.Header().Set("x-csrf-token", "csrf-locate-token")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleMux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		locatePath = r.URL.Path
		locateCSRF = r.Header.Get("X-CSRF-Token")
		if c, err := r.Cookie("TOKEN"); err == nil {
			locateToken = c.Value
		}
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &locateReq)
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleSrv := httptest.NewTLSServer(consoleMux)
	t.Cleanup(consoleSrv.Close)
	consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")

	smMux := http.NewServeMux()
	smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("X-API-KEY") != "sm-fleet-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"siteId": "site-home", "hostId": "host-udm-1"},
			},
		})
	})
	smMux.HandleFunc("/v1/hosts/host-udm-1", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": map[string]any{
				"id":        "host-udm-1",
				"ipAddress": consoleHostPort,
			},
		})
	})
	smSrv := httptest.NewServer(smMux)
	t.Cleanup(smSrv.Close)

	s := openTestStoreWithDevice(t, "site-home", "dev-ap-1", "AA:BB:CC:DD:EE:01")

	err := locateDevice(
		context.Background(),
		locateDeps{
			queries: s.Queries(),
			siteManager: func() (*unifi.SiteManagerClient, error) {
				return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "sm-fleet-key", smSrv.Client()), nil
			},
			classicClient: unifi.NewClassicClientForLocalConsole,
		},
		"site-home",
		"dev-ap-1",
	)
	if err != nil {
		t.Fatalf("locateDevice() error = %v", err)
	}

	if loginMethod != http.MethodPost || loginPath != "/api/auth/login" {
		t.Fatalf("login request = %s %s, want POST /api/auth/login", loginMethod, loginPath)
	}
	if loginReq["username"] != "ubnt" || loginReq["password"] != "ubnt" {
		t.Fatalf("login credentials = %+v, want username=ubnt password=ubnt", loginReq)
	}
	if locatePath != "/proxy/network/api/s/default/cmd/devmgr" {
		t.Fatalf("locate path = %q, want /proxy/network/api/s/default/cmd/devmgr", locatePath)
	}
	if locateCSRF != "csrf-locate-token" {
		t.Fatalf("locate X-CSRF-Token = %q, want csrf-locate-token", locateCSRF)
	}
	if locateToken != "console-session-token" {
		t.Fatalf("locate TOKEN cookie = %q, want console-session-token", locateToken)
	}
	if locateReq["cmd"] != "set-locate" || locateReq["mac"] != "aa:bb:cc:dd:ee:01" {
		t.Fatalf("locate payload = %+v, want cmd=set-locate mac=aa:bb:cc:dd:ee:01", locateReq)
	}
}

func TestLocateDevice_UsesCachedProbeHostIDAndDirectHostSiteID(t *testing.T) {
	tests := []struct {
		name           string
		deviceSiteID   string
		seedProbeMeta  bool
		smHandler      func(consoleHostPort string) http.Handler
		wantLocateSent bool
	}{
		{
			name:          "uses cached hostId from credentials_meta probe summary",
			deviceSiteID:  "site-cached",
			seedProbeMeta: true,
			smHandler: func(consoleHostPort string) http.Handler {
				mux := http.NewServeMux()
				mux.HandleFunc("/v1/hosts/host-cached", func(w http.ResponseWriter, r *http.Request) {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"data": map[string]any{"id": "host-cached", "ipAddress": consoleHostPort},
					})
				})
				return mux
			},
			wantLocateSent: true,
		},
		{
			name:          "resolves host directly when device siteId is hostId",
			deviceSiteID:  "host-direct-1",
			seedProbeMeta: false,
			smHandler: func(consoleHostPort string) http.Handler {
				mux := http.NewServeMux()
				mux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
					_ = json.NewEncoder(w).Encode(map[string]any{"data": []any{}})
				})
				mux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
					_ = json.NewEncoder(w).Encode(map[string]any{
						"data": []map[string]any{
							{"id": "host-other", "ipAddress": "10.0.0.1"},
							{"id": "host-direct-1", "ipAddress": consoleHostPort},
						},
					})
				})
				return mux
			},
			wantLocateSent: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			locateCalled := false
			consoleMux := http.NewServeMux()
			consoleMux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("x-csrf-token", "csrf-1")
				_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
			})
			consoleMux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
				locateCalled = true
				_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
			})
			consoleSrv := httptest.NewTLSServer(consoleMux)
			t.Cleanup(consoleSrv.Close)

			consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")
			smSrv := httptest.NewServer(tt.smHandler(consoleHostPort))
			t.Cleanup(smSrv.Close)

			s := openTestStoreWithDevice(t, tt.deviceSiteID, "dev-1", "aa:bb:cc:dd:ee:02")
			if tt.seedProbeMeta {
				err := s.Queries().UpsertCredentialMeta(context.Background(), sqlc.UpsertCredentialMetaParams{
					KeyType: keyTypeSiteManager,
					ProbeSummary: encodeProbeSummary(ValidationSummary{
						Sites: []ProbedSiteSummary{{SiteID: "site-cached", HostID: "host-cached"}},
					}),
				})
				if err != nil {
					t.Fatalf("UpsertCredentialMeta() error = %v", err)
				}
			}

			err := locateDevice(
				context.Background(),
				locateDeps{
					queries: s.Queries(),
					siteManager: func() (*unifi.SiteManagerClient, error) {
						return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
					},
					classicClient: unifi.NewClassicClientForLocalConsole,
				},
				tt.deviceSiteID,
				"dev-1",
			)
			if err != nil {
				t.Fatalf("locateDevice() error = %v", err)
			}
			if locateCalled != tt.wantLocateSent {
				t.Fatalf("locateCalled = %v, want %v", locateCalled, tt.wantLocateSent)
			}
		})
	}
}

func TestLocateDevice_Errors(t *testing.T) {
	t.Run("no site manager key", func(t *testing.T) {
		s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
		err := locateDevice(
			context.Background(),
			locateDeps{
				queries: s.Queries(),
				siteManager: func() (*unifi.SiteManagerClient, error) {
					return nil, secrets.ErrNotFound
				},
				classicClient: unifi.NewClassicClientForLocalConsole,
			},
			"site-home",
			"dev-1",
		)
		if !errors.Is(err, ErrLocateNoSiteManagerKey) {
			t.Fatalf("locateDevice() error = %v, want ErrLocateNoSiteManagerKey", err)
		}
	})

	t.Run("no console IP on host record", func(t *testing.T) {
		smMux := http.NewServeMux()
		smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{{"siteId": "site-home", "hostId": "host-no-ip"}},
			})
		})
		smMux.HandleFunc("/v1/hosts/host-no-ip", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{"id": "host-no-ip", "ipAddress": ""},
			})
		})
		smSrv := httptest.NewServer(smMux)
		t.Cleanup(smSrv.Close)

		s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
		err := locateDevice(
			context.Background(),
			locateDeps{
				queries: s.Queries(),
				siteManager: func() (*unifi.SiteManagerClient, error) {
					return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
				},
				classicClient: unifi.NewClassicClientForLocalConsole,
			},
			"site-home",
			"dev-1",
		)
		if !errors.Is(err, ErrLocateNoConsoleIP) {
			t.Fatalf("locateDevice() error = %v, want ErrLocateNoConsoleIP", err)
		}
	})

	t.Run("factory login refused", func(t *testing.T) {
		consoleSrv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.SetCookie(w, &http.Cookie{Name: "TOKEN", Value: "sensitive-cookie-value", Path: "/"})
			w.WriteHeader(http.StatusUnauthorized)
			_, _ = w.Write([]byte(`{"code":"AUTHENTICATION_FAILED_INVALID_CREDENTIALS"}`))
		}))
		t.Cleanup(consoleSrv.Close)
		consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")

		smMux := http.NewServeMux()
		smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{{"siteId": "site-home", "hostId": "host-1"}},
			})
		})
		smMux.HandleFunc("/v1/hosts/host-1", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{"id": "host-1", "ipAddress": consoleHostPort},
			})
		})
		smSrv := httptest.NewServer(smMux)
		t.Cleanup(smSrv.Close)

		s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
		err := locateDevice(
			context.Background(),
			locateDeps{
				queries: s.Queries(),
				siteManager: func() (*unifi.SiteManagerClient, error) {
					return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
				},
				classicClient: unifi.NewClassicClientForLocalConsole,
			},
			"site-home",
			"dev-1",
		)
		if !errors.Is(err, ErrLocateFactoryLoginRefused) {
			t.Fatalf("locateDevice() error = %v, want ErrLocateFactoryLoginRefused", err)
		}
		if strings.Contains(err.Error(), "sensitive-cookie-value") {
			t.Fatalf("error leaked cookie: %q", err.Error())
		}
	})

	t.Run("locate command refused", func(t *testing.T) {
		consoleMux := http.NewServeMux()
		consoleMux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("x-csrf-token", "csrf-1")
			_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
		})
		consoleMux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusForbidden)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"meta": map[string]string{"rc": "error", "msg": "api.err.NoPermission"},
			})
		})
		consoleSrv := httptest.NewTLSServer(consoleMux)
		t.Cleanup(consoleSrv.Close)
		consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")

		smMux := http.NewServeMux()
		smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": []map[string]any{{"siteId": "site-home", "hostId": "host-1"}},
			})
		})
		smMux.HandleFunc("/v1/hosts/host-1", func(w http.ResponseWriter, r *http.Request) {
			_ = json.NewEncoder(w).Encode(map[string]any{
				"data": map[string]any{"id": "host-1", "ipAddress": consoleHostPort},
			})
		})
		smSrv := httptest.NewServer(smMux)
		t.Cleanup(smSrv.Close)

		s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
		err := locateDevice(
			context.Background(),
			locateDeps{
				queries: s.Queries(),
				siteManager: func() (*unifi.SiteManagerClient, error) {
					return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
				},
				classicClient: unifi.NewClassicClientForLocalConsole,
			},
			"site-home",
			"dev-1",
		)
		if !errors.Is(err, ErrLocateCommandRefused) {
			t.Fatalf("locateDevice() error = %v, want ErrLocateCommandRefused", err)
		}
		if !strings.Contains(err.Error(), "api.err.NoPermission") {
			t.Fatalf("locateDevice() error = %q, want detail api.err.NoPermission", err.Error())
		}
	})

	t.Run("nil database returns error", func(t *testing.T) {
		t.Parallel()

		app := &App{}
		if err := app.LocateDevice("site-home", "dev-1"); err == nil {
			t.Fatal("LocateDevice() with nil store should error")
		}
	})
}

func TestConsoleBaseURLFromIP(t *testing.T) {
	t.Parallel()

	tests := []struct {
		ip   string
		want string
	}{
		{"192.168.1.1", "https://192.168.1.1"},
		{"127.0.0.1:8443", "https://127.0.0.1:8443"},
		{"2001:db8::1", "https://[2001:db8::1]"},
		{"[::1]:8443", "https://[::1]:8443"},
	}

	for _, tc := range tests {
		if got := consoleBaseURLFromIP(tc.ip); got != tc.want {
			t.Errorf("consoleBaseURLFromIP(%q) = %q, want %q", tc.ip, got, tc.want)
		}
	}
}

func TestLocateDevice_UsesStoredConsoleIPWithoutHostLookup(t *testing.T) {
	locateCalled := false
	consoleMux := http.NewServeMux()
	consoleMux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-csrf-token", "csrf-1")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleMux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		locateCalled = true
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleSrv := httptest.NewTLSServer(consoleMux)
	t.Cleanup(consoleSrv.Close)
	consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")

	smSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("unexpected Site Manager call %s %s", r.Method, r.URL.Path)
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	}))
	t.Cleanup(smSrv.Close)

	s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
	err := s.Queries().UpsertPreference(context.Background(), sqlc.UpsertPreferenceParams{
		Key:   inventory.ConsoleIPKey("site-home"),
		Value: consoleHostPort,
	})
	if err != nil {
		t.Fatalf("UpsertPreference() error = %v", err)
	}

	keychainReads := 0
	err = locateDevice(
		context.Background(),
		locateDeps{
			queries: s.Queries(),
			siteManager: func() (*unifi.SiteManagerClient, error) {
				keychainReads++
				return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
			},
			classicClient: unifi.NewClassicClientForLocalConsole,
		},
		"site-home",
		"dev-1",
	)
	if err != nil {
		t.Fatalf("locateDevice() error = %v", err)
	}
	if !locateCalled {
		t.Fatal("set-locate was not sent to the console")
	}
	if keychainReads != 0 {
		t.Fatalf("Site Manager secret read %d times, want 0 when the console IP is stored", keychainReads)
	}
}

func TestLocateDevice_HostLookup401KeepsErrorAndReadsSecretOnce(t *testing.T) {
	var hostCalls int
	smMux := http.NewServeMux()
	smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"siteId": "site-home", "hostId": "host-1"}},
		})
	})
	smMux.HandleFunc("/v1/hosts/host-1", func(w http.ResponseWriter, r *http.Request) {
		hostCalls++
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"code":"unauthorized","httpStatusCode":401}`))
	})
	smSrv := httptest.NewServer(smMux)
	t.Cleanup(smSrv.Close)

	s := openTestStoreWithDevice(t, "site-home", "dev-1", "aa:bb:cc:dd:ee:01")
	keychainReads := 0
	err := locateDevice(
		context.Background(),
		locateDeps{
			queries: s.Queries(),
			siteManager: func() (*unifi.SiteManagerClient, error) {
				keychainReads++
				return unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client()), nil
			},
			classicClient: unifi.NewClassicClientForLocalConsole,
		},
		"site-home",
		"dev-1",
	)
	if !unifi.IsHTTPStatus(err, http.StatusUnauthorized) {
		t.Fatalf("locateDevice() error = %v, want wrapped HTTP 401", err)
	}
	if want := "GET hosts/host-1: HTTP 401"; !strings.Contains(err.Error(), want) {
		t.Fatalf("locateDevice() error = %q, want it to contain %q", err.Error(), want)
	}
	if hostCalls != 1 || keychainReads != 1 {
		t.Fatalf("hostCalls = %d, keychainReads = %d, want 1 and 1", hostCalls, keychainReads)
	}
}

func TestLocateDevice_FleetRefreshStoresConsoleIPSoLocateSkipsHostLookup(t *testing.T) {
	locateCalled := false
	consoleMux := http.NewServeMux()
	consoleMux.HandleFunc("/api/auth/login", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("x-csrf-token", "csrf-1")
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleMux.HandleFunc("/proxy/network/api/s/default/cmd/devmgr", func(w http.ResponseWriter, r *http.Request) {
		locateCalled = true
		_ = json.NewEncoder(w).Encode(map[string]any{"meta": map[string]string{"rc": "ok"}})
	})
	consoleSrv := httptest.NewTLSServer(consoleMux)
	t.Cleanup(consoleSrv.Close)
	consoleHostPort := strings.TrimPrefix(consoleSrv.URL, "https://")

	smMux := http.NewServeMux()
	smMux.HandleFunc("/v1/sites", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"siteId": "site-home", "hostId": "host-1"}},
		})
	})
	smMux.HandleFunc("/v1/hosts", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{"id": "host-1", "ipAddress": consoleHostPort}},
		})
	})
	smMux.HandleFunc("/v1/devices", func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{{
				"hostId": "host-1",
				"devices": []map[string]any{{
					"id": "dev-1", "mac": "aa:bb:cc:dd:ee:01", "name": "Hall AP",
					"model": "U7-Pro-XGS", "status": "online", "isManaged": true,
				}},
			}},
		})
	})
	smMux.HandleFunc("/v1/hosts/host-1", func(w http.ResponseWriter, r *http.Request) {
		t.Errorf("locate must not call GET /v1/hosts/{id} after a refresh stored the console IP")
		http.Error(w, "unauthorized", http.StatusUnauthorized)
	})
	smSrv := httptest.NewServer(smMux)
	t.Cleanup(smSrv.Close)

	s, err := store.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("store.Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	sm := unifi.NewSiteManagerClientWithBase(smSrv.URL+"/v1", "key", smSrv.Client())
	if _, err := inventory.NewService(sm).RefreshFromSiteManager(context.Background(), s.Queries()); err != nil {
		t.Fatalf("RefreshFromSiteManager() error = %v", err)
	}

	err = locateDevice(
		context.Background(),
		locateDeps{
			queries:       s.Queries(),
			siteManager:   func() (*unifi.SiteManagerClient, error) { return sm, nil },
			classicClient: unifi.NewClassicClientForLocalConsole,
		},
		"site-home",
		"dev-1",
	)
	if err != nil {
		t.Fatalf("locateDevice() error = %v", err)
	}
	if !locateCalled {
		t.Fatal("set-locate was not sent to the console")
	}
}
