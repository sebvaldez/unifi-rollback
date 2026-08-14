package unifi

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"strings"
	"sync"
	"time"
)

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

	httpClient := cfg.HTTP
	if httpClient == nil {
		jar, err := cookiejar.New(nil)
		if err != nil {
			return nil, fmt.Errorf("create cookie jar: %w", err)
		}
		httpClient = &http.Client{
			Jar:     jar,
			Timeout: 30 * time.Second,
		}
	}

	return &ClassicClient{
		baseURL:  stringsTrimRightSlash(cfg.ConsoleBaseURL),
		username: cfg.Username,
		password: cfg.Password,
		site:     site,
		http:     httpClient,
	}, nil
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

func (c *ClassicClient) ensureLogin(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.csrfToken != "" && time.Since(c.loggedInAt) < 25*time.Minute {
		return nil
	}

	body, _ := json.Marshal(classicLoginRequest{
		Username: c.username,
		Password: c.password,
		Remember: true,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/auth/login", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("classic login: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("classic login: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	csrf := resp.Header.Get("x-csrf-token")
	if csrf == "" {
		csrf = resp.Header.Get("x-updated-csrf-token")
	}
	if csrf == "" {
		return fmt.Errorf("classic login: missing CSRF token in response headers")
	}

	var env classicEnvelope
	if err := json.Unmarshal(raw, &env); err == nil && env.Meta.RC != "" && env.Meta.RC != "ok" {
		return fmt.Errorf("classic login: %s", env.Meta.Msg)
	}

	c.csrfToken = csrf
	c.loggedInAt = time.Now()
	return nil
}

func (c *ClassicClient) postDevmgr(ctx context.Context, payload map[string]any) error {
	if err := c.ensureLogin(ctx); err != nil {
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
	req.Header.Set("X-CSRF-Token", c.csrfToken)

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("classic devmgr: %w", err)
	}
	defer resp.Body.Close()

	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("classic devmgr: HTTP %d: %s", resp.StatusCode, strings.TrimSpace(string(raw)))
	}

	var env classicEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return fmt.Errorf("classic devmgr decode: %w", err)
	}
	if env.Meta.RC != "ok" {
		if env.Meta.Msg != "" {
			return fmt.Errorf("classic devmgr: %s", env.Meta.Msg)
		}
		return fmt.Errorf("classic devmgr: rc=%q", env.Meta.RC)
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
