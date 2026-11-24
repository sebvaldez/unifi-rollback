package unifi

import (
	"bytes"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"
)

var (
	// ErrClassicLoginRefused is returned when the console rejects classic login credentials.
	ErrClassicLoginRefused = errors.New("classic login refused")
	// ErrClassicCommandRefused is returned when the console rejects a classic controller command.
	ErrClassicCommandRefused = errors.New("classic command refused")
)

const maxClassicResponseBytes = 1 << 20

// ClassicClient calls the legacy UniFi controller API (cookie + CSRF auth).
//
// Use this for capabilities not exposed by the official Network Integration API,
// notably LED locate (set-locate / unset-locate). Integration OpenAPI v10.3.58
// documents only RESTART for device actions — not LOCATE.
//
// Requires a local admin account (cloud/SSO accounts return 401). Do not use
// API keys on classic paths.
type ClassicClient struct {
	baseURL  string
	username string
	password string
	site     string
	http     *http.Client

	mu         sync.Mutex
	csrfToken  string
	loggedInAt time.Time
}

// ClassicConfig configures a ClassicClient for a UniFi OS console.
type ClassicConfig struct {
	// ConsoleBaseURL is the console origin, e.g. https://192.168.1.1
	ConsoleBaseURL string
	Username       string
	Password       string
	// Site is the classic site name (usually "default").
	Site string
	HTTP *http.Client
}

// NewClassicClient creates a client for classic /proxy/network/api/s/{site}/ endpoints.
func NewClassicClient(cfg ClassicConfig) (*ClassicClient, error) {
	if cfg.ConsoleBaseURL == "" {
		return nil, fmt.Errorf("ConsoleBaseURL is required")
	}
	if cfg.Username == "" || cfg.Password == "" {
		return nil, fmt.Errorf("Username and Password are required")
	}
	site := cfg.Site
	if site == "" {
		site = "default"
	}

	var httpClient *http.Client
	if cfg.HTTP == nil {
		jar, err := cookiejar.New(nil)
		if err != nil {
			return nil, fmt.Errorf("create cookie jar: %w", err)
		}
		httpClient = &http.Client{
			Jar:     jar,
			Timeout: 30 * time.Second,
		}
	} else {
		cloned := *cfg.HTTP
		if cloned.Jar == nil {
			jar, err := cookiejar.New(nil)
			if err != nil {
				return nil, fmt.Errorf("create cookie jar: %w", err)
			}
			cloned.Jar = jar
		}
		httpClient = &cloned
	}

	return &ClassicClient{
		baseURL:  stringsTrimRightSlash(cfg.ConsoleBaseURL),
		username: cfg.Username,
		password: cfg.Password,
		site:     site,
		http:     httpClient,
	}, nil
}

// NewClassicClientForLocalConsole creates a ClassicClient that dials a LAN console
// with a self-signed TLS certificate and an in-memory cookie jar.
func NewClassicClientForLocalConsole(cfg ClassicConfig) (*ClassicClient, error) {
	if cfg.HTTP == nil {
		jar, err := cookiejar.New(nil)
		if err != nil {
			return nil, fmt.Errorf("create cookie jar: %w", err)
		}
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} //nolint:gosec // local UniFi consoles use self-signed certs
		cfg.HTTP = &http.Client{
			Jar:       jar,
			Transport: transport,
			Timeout:   30 * time.Second,
		}
	}
	return NewClassicClient(cfg)
}

type classicLoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Remember bool   `json:"remember"`
}

type classicMeta struct {
	RC  string `json:"rc"`
	Msg string `json:"msg"`
}

type classicEnvelope struct {
	Meta classicMeta `json:"meta"`
}

func (c *ClassicClient) ensureLogin(ctx context.Context) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.csrfToken != "" && time.Since(c.loggedInAt) < 25*time.Minute {
		return c.csrfToken, nil
	}

	body, err := json.Marshal(classicLoginRequest{
		Username: c.username,
		Password: c.password,
		Remember: true,
	})
	if err != nil {
		return "", fmt.Errorf("classic login encode: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/auth/login", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", fmt.Errorf("classic login: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxClassicResponseBytes))
	if err != nil {
		return "", fmt.Errorf("classic login read: %w", err)
	}
	if resp.StatusCode == http.StatusBadRequest ||
		resp.StatusCode == http.StatusUnauthorized ||
		resp.StatusCode == http.StatusForbidden {
		return "", fmt.Errorf("%w: HTTP %d", ErrClassicLoginRefused, resp.StatusCode)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("classic login: HTTP %d", resp.StatusCode)
	}

	var env classicEnvelope
	if err := json.Unmarshal(raw, &env); err == nil && env.Meta.RC != "" && env.Meta.RC != "ok" {
		if env.Meta.Msg != "" {
			return "", fmt.Errorf("%w: %s", ErrClassicLoginRefused, env.Meta.Msg)
		}
		return "", fmt.Errorf("%w: rc=%q", ErrClassicLoginRefused, env.Meta.RC)
	}

	csrf := resp.Header.Get("x-csrf-token")
	if csrf == "" {
		csrf = resp.Header.Get("x-updated-csrf-token")
	}
	if csrf == "" {
		return "", fmt.Errorf("classic login: missing CSRF token in response headers")
	}

	c.csrfToken = csrf
	c.loggedInAt = time.Now()
	return csrf, nil
}

func (c *ClassicClient) postDevmgr(ctx context.Context, payload map[string]any) error {
	csrf, err := c.ensureLogin(ctx)
	if err != nil {
		return err
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	path := fmt.Sprintf("%s/proxy/network/api/s/%s/cmd/devmgr", c.baseURL, url.PathEscape(c.site))
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, path, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-CSRF-Token", csrf)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("classic devmgr: %w", err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, maxClassicResponseBytes))
	if err != nil {
		return fmt.Errorf("classic devmgr read: %w", err)
	}

	var env classicEnvelope
	decoded := json.Unmarshal(raw, &env) == nil

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if decoded && env.Meta.Msg != "" {
			return fmt.Errorf("%w: HTTP %d (%s)", ErrClassicCommandRefused, resp.StatusCode, env.Meta.Msg)
		}
		return fmt.Errorf("%w: HTTP %d", ErrClassicCommandRefused, resp.StatusCode)
	}

	if !decoded {
		return fmt.Errorf("classic devmgr decode: invalid JSON response")
	}
	if env.Meta.RC != "ok" {
		if env.Meta.Msg != "" {
			return fmt.Errorf("%w: %s", ErrClassicCommandRefused, env.Meta.Msg)
		}
		return fmt.Errorf("%w: rc=%q", ErrClassicCommandRefused, env.Meta.RC)
	}
	return nil
}

// SetLocate blinks device LEDs (classic API set-locate).
func (c *ClassicClient) SetLocate(ctx context.Context, mac string) error {
	return c.postDevmgr(ctx, map[string]any{
		"cmd": "set-locate",
		"mac": strings.ToLower(mac),
	})
}

// UnsetLocate stops LED locate mode (classic API unset-locate).
func (c *ClassicClient) UnsetLocate(ctx context.Context, mac string) error {
	return c.postDevmgr(ctx, map[string]any{
		"cmd": "unset-locate",
		"mac": strings.ToLower(mac),
	})
}
