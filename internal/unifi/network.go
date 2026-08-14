package unifi

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/url"
)

const networkIntegrationPathPrefix = "/proxy/network/integration/v1"

// NetworkClient calls the UniFi Network Integration API (local or via Connector Proxy).
type NetworkClient struct {
	client *apiClient
}

// NewNetworkClient creates a client for a local console Integration API.
// baseURL is the console origin, e.g. https://192.168.1.1 — the /proxy/network/integration/v1 prefix is appended.
func NewNetworkClient(consoleBaseURL, apiKey string) *NetworkClient {
	return NewNetworkClientWithHTTP(consoleBaseURL, apiKey, nil)
}

// NewNetworkClientWithHTTP allows injecting a custom HTTP client (for tests).
func NewNetworkClientWithHTTP(consoleBaseURL, apiKey string, httpClient *http.Client) *NetworkClient {
	base := stringsTrimRightSlash(consoleBaseURL) + networkIntegrationPathPrefix
	return &NetworkClient{
		client: newAPIClient(base, apiKey, httpClient),
	}
}

// NewNetworkClientForLocalConsole dials a LAN console with a self-signed TLS certificate.
func NewNetworkClientForLocalConsole(consoleBaseURL, apiKey string) *NetworkClient {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true} //nolint:gosec // local UniFi consoles use self-signed certs
	return NewNetworkClientWithHTTP(consoleBaseURL, apiKey, &http.Client{Transport: transport})
}

func stringsTrimRightSlash(s string) string {
	for len(s) > 0 && s[len(s)-1] == '/' {
		s = s[:len(s)-1]
	}
	return s
}

// ApplicationInfo is returned by GET /v1/info.
type ApplicationInfo struct {
	ApplicationVersion string `json:"applicationVersion"`
}

// NetworkSite is a local site from GET /v1/sites.
type NetworkSite struct {
	ID                  string `json:"id"`
	InternalReference   string `json:"internalReference"`
	Name                string `json:"name"`
}

type networkSitePage struct {
	Count      int32         `json:"count"`
	Data       []NetworkSite `json:"data"`
	Limit      int32         `json:"limit"`
	Offset     int64         `json:"offset"`
	TotalCount int64         `json:"totalCount"`
}

// DeviceOverview is a summary device row from GET /v1/sites/{siteId}/devices.
type DeviceOverview struct {
	ID                string   `json:"id"`
	MACAddress        string   `json:"macAddress"`
	IPAddress         string   `json:"ipAddress"`
	Name              string   `json:"name"`
	Model             string   `json:"model"`
	State             string   `json:"state"`
	FirmwareVersion   string   `json:"firmwareVersion"`
	FirmwareUpdatable bool     `json:"firmwareUpdatable"`
	Supported         bool     `json:"supported"`
	Features          []string `json:"features"`
	Interfaces        []string `json:"interfaces"`
}

type deviceOverviewPage struct {
	Count      int32            `json:"count"`
	Data       []DeviceOverview `json:"data"`
	Limit      int32            `json:"limit"`
	Offset     int64            `json:"offset"`
	TotalCount int64            `json:"totalCount"`
}

// DeviceDetails is returned by GET /v1/sites/{siteId}/devices/{deviceId}.
type DeviceDetails struct {
	ID                string         `json:"id"`
	MACAddress        string         `json:"macAddress"`
	IPAddress         string         `json:"ipAddress"`
	Name              string         `json:"name"`
	Model             string         `json:"model"`
	State             string         `json:"state"`
	FirmwareVersion   string         `json:"firmwareVersion"`
	FirmwareUpdatable bool           `json:"firmwareUpdatable"`
	Supported         bool           `json:"supported"`
	Features          map[string]any `json:"features"`
	Interfaces        map[string]any `json:"interfaces"`
	AdoptedAt         string         `json:"adoptedAt"`
	ProvisionedAt     string         `json:"provisionedAt"`
}

// DeviceStatistics is returned by GET .../statistics/latest.
type DeviceStatistics struct {
	CPUUtilizationPct    *float64 `json:"cpuUtilizationPct"`
	MemoryUtilizationPct *float64 `json:"memoryUtilizationPct"`
	UptimeSec            *int64   `json:"uptimeSec"`
}

// DeviceActionRequest is the body for POST .../devices/{deviceId}/actions.
type DeviceActionRequest struct {
	Action string `json:"action"`
}

const DeviceActionRestart = "RESTART"

// Info returns Network application version (capability detection).
func (c *NetworkClient) Info(ctx context.Context) (ApplicationInfo, error) {
	var info ApplicationInfo
	if err := c.client.get(ctx, "info", "", &info); err != nil {
		return ApplicationInfo{}, err
	}
	return info, nil
}

// ListSites returns local sites on the console.
func (c *NetworkClient) ListSites(ctx context.Context) ([]NetworkSite, error) {
	var page networkSitePage
	if err := c.client.get(ctx, "sites", "", &page); err != nil {
		return nil, err
	}
	if page.Data == nil {
		return []NetworkSite{}, nil
	}
	return page.Data, nil
}

// ListDevices returns all adopted devices for a site (paginated internally).
func (c *NetworkClient) ListDevices(ctx context.Context, siteID string) ([]DeviceOverview, error) {
	const pageSize = 200
	var all []DeviceOverview
	var offset int64

	for {
		q := fmt.Sprintf("offset=%d&limit=%d", offset, pageSize)
		var page deviceOverviewPage
		path := "sites/" + url.PathEscape(siteID) + "/devices"
		if err := c.client.get(ctx, path, q, &page); err != nil {
			return nil, err
		}
		all = append(all, page.Data...)
		offset += int64(page.Count)
		if offset >= page.TotalCount || page.Count == 0 {
			return all, nil
		}
	}
}

// GetDevice returns detailed information for one device.
func (c *NetworkClient) GetDevice(ctx context.Context, siteID, deviceID string) (DeviceDetails, error) {
	var device DeviceDetails
	path := fmt.Sprintf("sites/%s/devices/%s", url.PathEscape(siteID), url.PathEscape(deviceID))
	if err := c.client.get(ctx, path, "", &device); err != nil {
		return DeviceDetails{}, err
	}
	return device, nil
}

// LatestStatistics returns the latest statistics snapshot for a device.
func (c *NetworkClient) LatestStatistics(ctx context.Context, siteID, deviceID string) (DeviceStatistics, error) {
	var stats DeviceStatistics
	path := fmt.Sprintf("sites/%s/devices/%s/statistics/latest", url.PathEscape(siteID), url.PathEscape(deviceID))
	if err := c.client.get(ctx, path, "", &stats); err != nil {
		return DeviceStatistics{}, err
	}
	return stats, nil
}

// RestartDevice sends RESTART via the official Integration device action endpoint.
func (c *NetworkClient) RestartDevice(ctx context.Context, siteID, deviceID string) error {
	path := fmt.Sprintf("sites/%s/devices/%s/actions", url.PathEscape(siteID), url.PathEscape(deviceID))
	return c.client.post(ctx, path, DeviceActionRequest{Action: DeviceActionRestart}, nil)
}
