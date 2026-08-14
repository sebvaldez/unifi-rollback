package unifi

import (
	"context"
	"fmt"
	"strings"
)

// NetworkKeyProbe summarizes validation of a Network Integration API key for one site.
type NetworkKeyProbe struct {
	ApplicationVersion string   `json:"applicationVersion"`
	NetworkSiteID      string   `json:"networkSiteId,omitempty"`
	NetworkKeyVerified bool     `json:"networkKeyVerified"`
	DeviceCount        int      `json:"deviceCount"`
	Notes              []string `json:"notes,omitempty"`
}

// ResolveNetworkSiteID maps a Site Manager siteId (or name hint) to a Network Integration site id.
func (c *NetworkClient) ResolveNetworkSiteID(ctx context.Context, hint string) (string, error) {
	sites, err := c.ListSites(ctx)
	if err != nil {
		return "", err
	}
	if len(sites) == 0 {
		return "", fmt.Errorf("network integration returned no sites")
	}

	hint = strings.TrimSpace(hint)
	for _, site := range sites {
		if site.ID == hint {
			return site.ID, nil
		}
	}
	for _, site := range sites {
		if ref := strings.TrimSpace(site.InternalReference); ref != "" && ref == hint {
			return site.ID, nil
		}
	}

	if len(sites) == 1 {
		return sites[0].ID, nil
	}

	for _, site := range sites {
		if strings.EqualFold(strings.TrimSpace(site.Name), hint) {
			return site.ID, nil
		}
	}

	ids := make([]string, len(sites))
	for i, site := range sites {
		ids[i] = site.ID
	}
	return "", fmt.Errorf("site %q not found on console; network sites: %s", hint, strings.Join(ids, ", "))
}

// ProbeTarget returns the Integration API base URL used by this client.
func (c *NetworkClient) ProbeTarget() string {
	return c.client.baseURL
}

// ProbeKeyAccess validates the key against Network Integration endpoints for siteID.
func (c *NetworkClient) ProbeKeyAccess(ctx context.Context, siteID string, report ...ProbeReporter) (NetworkKeyProbe, error) {
	var reporter ProbeReporter
	if len(report) > 0 {
		reporter = report[0]
	}

	target := c.ProbeTarget()
	reportProbeStep(reporter, "Reading Network application info", target)
	info, err := c.Info(ctx)
	if err != nil {
		return NetworkKeyProbe{}, err
	}

	reportProbeStep(reporter, "Listing local sites on the console", target)
	networkSiteID, err := c.ResolveNetworkSiteID(ctx, siteID)
	if err != nil {
		return NetworkKeyProbe{}, err
	}

	reportProbeStep(reporter, "Listing devices for the site", target)
	devices, err := c.ListDevices(ctx, networkSiteID)
	if err != nil {
		return NetworkKeyProbe{}, err
	}

	notes := []string{
		fmt.Sprintf("Network application %s", info.ApplicationVersion),
		fmt.Sprintf("%d device(s) visible for site %q", len(devices), networkSiteID),
	}
	if networkSiteID != siteID {
		notes = append(notes, fmt.Sprintf("Resolved Site Manager site %q to network site %q", siteID, networkSiteID))
	}

	return NetworkKeyProbe{
		ApplicationVersion: info.ApplicationVersion,
		NetworkSiteID:      networkSiteID,
		DeviceCount:        len(devices),
		Notes:              notes,
	}, nil
}

// CapabilitiesFromNetworkProbe maps a successful network probe to app capability tokens.
func CapabilitiesFromNetworkProbe(probe NetworkKeyProbe) []string {
	if !probe.NetworkKeyVerified {
		return nil
	}
	return []string{"device_read", "device_restart"}
}
