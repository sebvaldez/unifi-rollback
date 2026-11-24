package unifi

import (
	"context"
	"fmt"
	"sort"
	"strings"
)

// ProbedSite is a site discovered during key validation.
type ProbedSite struct {
	SiteID     string `json:"siteId"`
	SiteName   string `json:"siteName"`
	HostID     string `json:"hostId,omitempty"`
	Permission string `json:"permission,omitempty"`
	// Capabilities come from the connector probe for this site (Site Manager key only).
	Capabilities []string `json:"capabilities,omitempty"`
}

// KeyAccessProbe summarizes what a Site Manager API key can access.
type KeyAccessProbe struct {
	Sites                []ProbedSite `json:"sites"`
	ApplicationsObserved []string     `json:"applicationsObserved"`
	HostCount            int          `json:"hostCount"`
	DeviceCount          int          `json:"deviceCount"`
	Notes                []string     `json:"notes,omitempty"`
}

// ProbeKeyAccess validates the key and discovers reachable sites, apps, and devices.
func (c *SiteManagerClient) ProbeKeyAccess(ctx context.Context, report ...ProbeReporter) (KeyAccessProbe, error) {
	var reporter ProbeReporter
	if len(report) > 0 {
		reporter = report[0]
	}

	target := c.BaseURL()
	reportProbeStep(reporter, "Listing sites visible to this key", target)
	sites, err := c.ListSites(ctx)
	if err != nil {
		return KeyAccessProbe{}, err
	}

	reportProbeStep(reporter, "Listing fleet devices", target)
	groups, err := c.ListAllDevices(ctx, ListDevicesParams{})
	if err != nil {
		return KeyAccessProbe{}, err
	}

	reportProbeStep(reporter, "Listing consoles (hosts)", target)
	hosts, hostsErr := c.ListHosts(ctx)
	if hostsErr != nil {
		// Host listing is optional for the probe — sites + devices are enough.
		hosts = nil
	}

	probe := KeyAccessProbe{
		Sites:     probeSitesFromAPI(sites),
		HostCount: len(hosts),
	}

	appSet := make(map[string]struct{})
	deviceCount := 0
	for _, group := range groups {
		deviceCount += len(group.Devices)
		for _, device := range group.Devices {
			if app := normalizeApplication(device.ProductLine); app != "" {
				appSet[app] = struct{}{}
			}
		}
	}
	for _, host := range hosts {
		for _, app := range controllersFromHost(host) {
			appSet[app] = struct{}{}
		}
	}

	probe.DeviceCount = deviceCount
	probe.ApplicationsObserved = sortedKeys(appSet)
	probe.Notes = buildProbeNotes(probe, hostsErr)

	connectorNote, err := c.probeConnectorCapabilities(ctx, probe.Sites, reporter)
	if err != nil {
		return KeyAccessProbe{}, err
	}
	if connectorNote != "" {
		probe.Notes = append(probe.Notes, connectorNote)
	}
	return probe, nil
}

// probeConnectorCapabilities records restart and firmware-check capabilities per site.
// A site the connector cannot reach is left without capabilities and does not fail the probe.
func (c *SiteManagerClient) probeConnectorCapabilities(ctx context.Context, sites []ProbedSite, reporter ProbeReporter) (string, error) {
	var withHost, reachable int
	for i := range sites {
		if sites[i].HostID == "" {
			continue
		}
		withHost++
		reportProbeStep(reporter, "Checking restart access for "+sites[i].SiteName, c.BaseURL())
		connector, err := c.ProbeSiteViaConnector(ctx, sites[i].HostID, sites[i].SiteID)
		if ctxErr := ctx.Err(); ctxErr != nil {
			return "", ctxErr
		}
		if err != nil {
			continue
		}
		if caps := CapabilitiesFromConnectorProbe(connector); len(caps) > 0 {
			sites[i].Capabilities = caps
			reachable++
		}
	}
	switch {
	case withHost == 0:
		return "", nil
	case reachable == withHost:
		return fmt.Sprintf("Restart and firmware checks available on %d site(s) via the fleet connector", reachable), nil
	default:
		return fmt.Sprintf(
			"Restart and firmware checks available on %d of %d site(s); the connector needs console UniFi OS 5.0.3+ and Network admin rights",
			reachable, withHost,
		), nil
	}
}

func probeSitesFromAPI(sites []Site) []ProbedSite {
	probed := make([]ProbedSite, 0, len(sites))
	for _, site := range sites {
		name := SiteDisplayName(site)
		probed = append(probed, ProbedSite{
			SiteID:     site.SiteID,
			SiteName:   name,
			HostID:     site.HostID,
			Permission: site.Permission,
		})
	}
	sort.Slice(probed, func(i, j int) bool {
		return strings.ToLower(probed[i].SiteName) < strings.ToLower(probed[j].SiteName)
	})
	return probed
}

func normalizeApplication(productLine string) string {
	productLine = strings.ToLower(strings.TrimSpace(productLine))
	switch productLine {
	case "network", "protect", "access", "talk", "connect", "innerspace":
		return productLine
	default:
		return productLine
	}
}

func controllersFromHost(host Host) []string {
	if host.UserData == nil {
		return nil
	}
	raw, ok := host.UserData["controllers"]
	if !ok {
		return nil
	}
	items, ok := raw.([]any)
	if !ok {
		return nil
	}
	var apps []string
	for _, item := range items {
		if app, ok := item.(string); ok {
			if normalized := normalizeApplication(app); normalized != "" {
				apps = append(apps, normalized)
			}
		}
	}
	return apps
}

func sortedKeys(set map[string]struct{}) []string {
	if len(set) == 0 {
		return nil
	}
	keys := make([]string, 0, len(set))
	for key := range set {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func buildProbeNotes(probe KeyAccessProbe, hostsErr error) []string {
	var notes []string

	switch len(probe.Sites) {
	case 0:
		notes = append(notes, "No sites returned for this key")
	case 1:
		notes = append(notes, fmt.Sprintf("1 site reachable (%s)", probe.Sites[0].SiteName))
	default:
		notes = append(notes, fmt.Sprintf("%d sites reachable", len(probe.Sites)))
	}

	if probe.DeviceCount == 0 {
		notes = append(notes, "No devices returned yet")
	} else {
		notes = append(notes, fmt.Sprintf("%d devices visible in fleet inventory", probe.DeviceCount))
	}

	if len(probe.ApplicationsObserved) > 0 {
		notes = append(notes, "Applications observed: "+strings.Join(probe.ApplicationsObserved, ", "))
	}

	if hostsErr != nil {
		notes = append(notes, "Host listing unavailable during probe")
	} else if probe.HostCount > 0 {
		notes = append(notes, fmt.Sprintf("%d console(s) visible", probe.HostCount))
	}

	return notes
}

// CapabilitiesFromProbe maps probe results to app capability tokens.
func CapabilitiesFromProbe(probe KeyAccessProbe) []string {
	caps := make([]string, 0, 2)
	if len(probe.Sites) > 0 || probe.DeviceCount > 0 {
		caps = append(caps, "inventory")
	}
	if probe.HostCount > 0 {
		caps = append(caps, "connector_proxy")
	}
	siteCaps := make([][]string, 0, len(probe.Sites)+1)
	siteCaps = append(siteCaps, caps)
	for _, site := range probe.Sites {
		siteCaps = append(siteCaps, site.Capabilities)
	}
	return MergeCapabilities(siteCaps...)
}
