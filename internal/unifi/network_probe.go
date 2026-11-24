package unifi

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
)

// NetworkKeyProbe summarizes a direct LAN probe of a per-site Network Integration key.
// NetworkKeyVerified is true only when that key was sent to the console and accepted.
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

// Capability tokens shared by both probe paths.
const (
	CapabilityDeviceRead    = "device_read"
	CapabilityDeviceRestart = "device_restart"
	CapabilityFirmwareCheck = "firmware_check"
)

// ConnectorProbe is the result of reaching one site's Network application through the
// Site Manager connector. Only the Site Manager key is sent on this path, so the result
// carries no claim about any per-site Network key.
type ConnectorProbe struct {
	ApplicationVersion string `json:"applicationVersion"`
	NetworkSiteID      string `json:"networkSiteId,omitempty"`
	DeviceCount        int    `json:"deviceCount"`
}

// ProbeSiteViaConnector reads Network info and the site's devices through
// api.ui.com/v1/connector/consoles/{hostID} using the Site Manager key.
func (c *SiteManagerClient) ProbeSiteViaConnector(ctx context.Context, hostID, siteID string, report ...ProbeReporter) (ConnectorProbe, error) {
	probe, err := NewNetworkClientViaConnector(c, hostID).ProbeKeyAccess(ctx, siteID, report...)
	if err != nil {
		return ConnectorProbe{}, err
	}
	return ConnectorProbe{
		ApplicationVersion: probe.ApplicationVersion,
		NetworkSiteID:      probe.NetworkSiteID,
		DeviceCount:        probe.DeviceCount,
	}, nil
}

// CapabilitiesFromConnectorProbe maps a successful connector probe to restart and
// firmware-check capability tokens. A zero probe (failed or not run) grants nothing.
func CapabilitiesFromConnectorProbe(probe ConnectorProbe) []string {
	if probe.NetworkSiteID == "" {
		return nil
	}
	return []string{CapabilityDeviceRead, CapabilityDeviceRestart, CapabilityFirmwareCheck}
}

// CapabilitiesFromNetworkProbe maps a direct LAN probe to app capability tokens.
// Only a probe that sent the per-site key and was accepted grants anything.
func CapabilitiesFromNetworkProbe(probe NetworkKeyProbe) []string {
	if !probe.NetworkKeyVerified {
		return nil
	}
	return []string{CapabilityDeviceRead, CapabilityDeviceRestart}
}

// SiteCapabilities combines what the connector probe established with what a direct
// LAN probe established. The LAN probe can add capabilities but never removes one the
// connector already proved.
func SiteCapabilities(connector []string, lan NetworkKeyProbe) []string {
	return MergeCapabilities(connector, CapabilitiesFromNetworkProbe(lan))
}

// MergeCapabilities returns the union of capability sets in first-seen order.
// The result is never nil, so it encodes as [] rather than null.
func MergeCapabilities(sets ...[]string) []string {
	merged := []string{}
	seen := make(map[string]struct{})
	for _, set := range sets {
		for _, capability := range set {
			if _, ok := seen[capability]; ok {
				continue
			}
			seen[capability] = struct{}{}
			merged = append(merged, capability)
		}
	}
	return merged
}

// ClassifyLANProbe interprets the outcome of sending a per-site key directly to the console.
//   - success: the key was accepted, so it is verified.
//   - HTTP 401: the console rejected the key, which is a real failure.
//   - anything else: the console was not reachable, so the key was never tested.
//     That is not a failure and the key is not marked verified.
func ClassifyLANProbe(probe NetworkKeyProbe, err error) (NetworkKeyProbe, error) {
	switch {
	case err == nil:
		probe.NetworkKeyVerified = true
		probe.Notes = append(probe.Notes, "Validated network key via direct console access")
		return probe, nil
	case IsHTTPStatus(err, http.StatusUnauthorized):
		return NetworkKeyProbe{}, errors.New("network key rejected by console (HTTP 401)")
	default:
		return UntestedLANProbe(), nil
	}
}

// UntestedLANProbe is the result when the console was not reachable, so the key was never sent.
func UntestedLANProbe() NetworkKeyProbe {
	return NetworkKeyProbe{
		Notes: []string{"Console not reachable from this Mac; key saved but not tested"},
	}
}

// ResolveNetworkClient picks the client for device actions and firmware checks on one host.
// The connector client (Site Manager key) is the default. A direct LAN client is used only
// when the caller already has one that reached the console.
func ResolveNetworkClient(sm *SiteManagerClient, hostID string, reachableLAN *NetworkClient) *NetworkClient {
	if reachableLAN != nil {
		return reachableLAN
	}
	return NewNetworkClientViaConnector(sm, hostID)
}
