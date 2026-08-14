package unifi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const headerAPIKey = "X-API-KEY"

type apiClient struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

func newAPIClient(baseURL, apiKey string, httpClient *http.Client) *apiClient {
	baseURL = strings.TrimRight(baseURL, "/")
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	return &apiClient{
		baseURL: baseURL,
		apiKey:  apiKey,
		http:    httpClient,
	}
}

func (c *apiClient) get(ctx context.Context, path string, query string, dest any) error {
	return c.do(ctx, http.MethodGet, path, query, nil, dest)
}

func (c *apiClient) post(ctx context.Context, path string, body any, dest any) error {
	return c.do(ctx, http.MethodPost, path, "", body, dest)
}

func (c *apiClient) do(ctx context.Context, method, path, query string, body any, dest any) error {
	path = strings.TrimPrefix(path, "/")
	url := c.baseURL + "/" + path
	if query != "" {
		url += "?" + query
	}

	var bodyReader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(raw)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set(headerAPIKey, c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", method, path, err)
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return &HTTPError{
			Method:     method,
			Path:       path,
			StatusCode: resp.StatusCode,
			Body:       strings.TrimSpace(string(raw)),
		}
	}

	if dest == nil || len(raw) == 0 {
		return nil
	}

	if err := json.Unmarshal(raw, dest); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

// HTTPError is returned for non-2xx API responses.
type HTTPError struct {
	Method     string
	Path       string
	StatusCode int
	Body       string
}

func (e *HTTPError) Error() string {
	if e.Body == "" {
		return fmt.Sprintf("%s %s: HTTP %d", e.Method, e.Path, e.StatusCode)
	}
	return fmt.Sprintf("%s %s: HTTP %d: %s", e.Method, e.Path, e.StatusCode, e.Body)
}

// IsHTTPStatus reports whether err is an HTTPError with the given status code.
func IsHTTPStatus(err error, code int) bool {
	var httpErr *HTTPError
	return errors.As(err, &httpErr) && httpErr.StatusCode == code
}
