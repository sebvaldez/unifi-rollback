package unifi

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
)

const defaultSiteManagerBaseURL = "https://api.ui.com/v1"

// SiteManagerClient calls the UniFi Site Manager cloud API (read-only inventory).
type SiteManagerClient struct {
	client *apiClient
}

// NewSiteManagerClient returns a client for https://api.ui.com/v1.
func NewSiteManagerClient(apiKey string) *SiteManagerClient {
	return NewSiteManagerClientWithHTTP(apiKey, nil)
}

// NewSiteManagerClientWithHTTP allows injecting a custom base URL and HTTP client (for tests).
func NewSiteManagerClientWithHTTP(apiKey string, httpClient *http.Client) *SiteManagerClient {
	return NewSiteManagerClientWithBase(defaultSiteManagerBaseURL, apiKey, httpClient)
}

// NewSiteManagerClientWithBase constructs a Site Manager client against an arbitrary base URL.
func NewSiteManagerClientWithBase(baseURL, apiKey string, httpClient *http.Client) *SiteManagerClient {
	return &SiteManagerClient{
		client: newAPIClient(baseURL, apiKey, httpClient),
	}
}

type siteManagerEnvelope[T any] struct {
	Data      T      `json:"data"`
	NextToken string `json:"nextToken"`
	Code      string `json:"code"`
}

// Site is a Site Manager site record.
type Site struct {
	SiteID     string         `json:"siteId"`
	HostID     string         `json:"hostId"`
	Meta       map[string]any `json:"meta"`
	Permission string         `json:"permission"`
	IsOwner    bool           `json:"isOwner"`
}

// Host is a Site Manager console/host record.
type Host struct {
	ID            string             `json:"id"`
	HardwareID    string             `json:"hardwareId"`
	Type          string             `json:"type"`
	IPAddress     string             `json:"ipAddress"`
	UserData      map[string]any     `json:"userData"`
	ReportedState *HostReportedState `json:"reportedState"`
}

// SiteManagerDevice is a device returned by GET /v1/devices (cloud inventory).
type SiteManagerDevice struct {
	ID              string         `json:"id"`
	MAC             string         `json:"mac"`
	Name            string         `json:"name"`
	Model           string         `json:"model"`
	ShortName       string         `json:"shortname"`
	IP              string         `json:"ip"`
	ProductLine     string         `json:"productLine"`
	Status          string         `json:"status"`
	Version         string         `json:"version"`
	FirmwareStatus  string         `json:"firmwareStatus"`
	UpdateAvailable *string        `json:"updateAvailable"`
	IsConsole       bool           `json:"isConsole"`
	IsManaged       bool           `json:"isManaged"`
	UIDB            map[string]any `json:"uidb"`
}

// HostDeviceGroup groups devices under a host from GET /v1/devices.
type HostDeviceGroup struct {
	HostID    string              `json:"hostId"`
	HostName  string              `json:"hostName"`
	Devices   []SiteManagerDevice `json:"devices"`
	UpdatedAt string              `json:"updatedAt"`
}

// ListDevicesParams controls pagination for GET /v1/devices.
type ListDevicesParams struct {
	HostIDs  []string
	PageSize int
	Token    string
	Time     string
}

// ValidateKey checks that the Site Manager API key is valid.
func (c *SiteManagerClient) ValidateKey(ctx context.Context) error {
	_, err := c.ListSites(ctx)
	return err
}

// ListSites returns all sites visible to the API key.
func (c *SiteManagerClient) ListSites(ctx context.Context) ([]Site, error) {
	var env siteManagerEnvelope[[]Site]
	if err := c.client.get(ctx, "sites", "", &env); err != nil {
		return nil, err
	}
	if env.Data == nil {
		return []Site{}, nil
	}
	return env.Data, nil
}

// ListHosts returns all hosts (consoles) visible to the API key.
func (c *SiteManagerClient) ListHosts(ctx context.Context) ([]Host, error) {
	var env siteManagerEnvelope[[]Host]
	if err := c.client.get(ctx, "hosts", "", &env); err != nil {
		return nil, err
	}
	if env.Data == nil {
		return []Host{}, nil
	}
	return env.Data, nil
}

// GetHost returns a single host by ID.
func (c *SiteManagerClient) GetHost(ctx context.Context, hostID string) (*Host, error) {
	var env siteManagerEnvelope[Host]
	if err := c.client.get(ctx, "hosts/"+url.PathEscape(hostID), "", &env); err != nil {
		return nil, err
	}
	return &env.Data, nil
}

// ListDevices returns one page of host-grouped devices. Use token from ListDevicesResult.NextToken.
func (c *SiteManagerClient) ListDevices(ctx context.Context, params ListDevicesParams) (ListDevicesResult, error) {
	q := url.Values{}
	for _, id := range params.HostIDs {
		q.Add("hostIds[]", id)
	}
	if params.PageSize > 0 {
		q.Set("pageSize", fmt.Sprintf("%d", params.PageSize))
	}
	if params.Token != "" {
		q.Set("nextToken", params.Token)
	}
	if params.Time != "" {
		q.Set("time", params.Time)
	}

	var env siteManagerEnvelope[[]HostDeviceGroup]
	if err := c.client.get(ctx, "devices", q.Encode(), &env); err != nil {
		return ListDevicesResult{}, err
	}
	groups := env.Data
	if groups == nil {
		groups = []HostDeviceGroup{}
	}
	return ListDevicesResult{
		Groups:    groups,
		NextToken: env.NextToken,
	}, nil
}

// ListDevicesResult is a paginated page from GET /v1/devices.
type ListDevicesResult struct {
	Groups    []HostDeviceGroup
	NextToken string
}

// ListAllDevices fetches every page of GET /v1/devices.
func (c *SiteManagerClient) ListAllDevices(ctx context.Context, params ListDevicesParams) ([]HostDeviceGroup, error) {
	var all []HostDeviceGroup
	for {
		page, err := c.ListDevices(ctx, params)
		if err != nil {
			return nil, err
		}
		all = append(all, page.Groups...)
		if page.NextToken == "" {
			return all, nil
		}
		params.Token = page.NextToken
	}
}

// APIKey returns the configured API key (used by Connector transport).
func (c *SiteManagerClient) APIKey() string {
	return c.client.apiKey
}

// BaseURL returns the configured Site Manager base URL.
func (c *SiteManagerClient) BaseURL() string {
	return c.client.baseURL
}
