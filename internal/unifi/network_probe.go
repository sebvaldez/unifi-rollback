package unifi

import (
	"context"
	"fmt"
)

// NetworkKeyProbe summarizes validation of a Network Integration API key for one site.
type NetworkKeyProbe struct {
	ApplicationVersion string   `json:"applicationVersion"`
	DeviceCount        int      `json:"deviceCount"`
	Notes              []string `json:"notes,omitempty"`
}

// ProbeKeyAccess validates the key against Network Integration endpoints for siteID.
func (c *NetworkClient) ProbeKeyAccess(ctx context.Context, siteID string) (NetworkKeyProbe, error) {
	info, err := c.Info(ctx)
	if err != nil {
		return NetworkKeyProbe{}, err
	}

	devices, err := c.ListDevices(ctx, siteID)
	if err != nil {
		return NetworkKeyProbe{}, err
	}

	notes := []string{
		fmt.Sprintf("Network application %s", info.ApplicationVersion),
		fmt.Sprintf("%d device(s) visible for site %q", len(devices), siteID),
	}

	return NetworkKeyProbe{
		ApplicationVersion: info.ApplicationVersion,
		DeviceCount:        len(devices),
		Notes:              notes,
	}, nil
}

// CapabilitiesFromNetworkProbe maps a successful network probe to app capability tokens.
func CapabilitiesFromNetworkProbe(_ NetworkKeyProbe) []string {
	return []string{"device_read", "device_restart"}
}
