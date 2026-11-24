package inventory

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"unifi-rollback/internal/store/sqlc"
	"unifi-rollback/internal/unifi"
)

const consoleIPKeyPrefix = "console-ip:"

// ConsoleIPKey is the preferences key that holds a site's console IP.
func ConsoleIPKey(siteID string) string {
	return consoleIPKeyPrefix + siteID
}

func indexSitesByHost(sites []unifi.Site) map[string]unifi.Site {
	hostSite := make(map[string]unifi.Site, len(sites))
	for _, site := range sites {
		if site.HostID == "" {
			continue
		}
		if _, exists := hostSite[site.HostID]; !exists {
			hostSite[site.HostID] = site
		}
	}
	return hostSite
}

func siteIDForGroup(hostSite map[string]unifi.Site, group unifi.HostDeviceGroup) string {
	if site, ok := hostSite[group.HostID]; ok {
		return site.SiteID
	}
	return group.HostID
}

// ConsoleIPsBySite maps each device site ID to its console IP as seen in one fleet refresh.
// The host record IP wins; the console's own device row is the fallback.
func ConsoleIPsBySite(sites []unifi.Site, hosts []unifi.Host, groups []unifi.HostDeviceGroup) map[string]string {
	hostSite := indexSitesByHost(sites)

	hostIPs := make(map[string]string, len(hosts))
	for _, host := range hosts {
		if ip := strings.TrimSpace(host.IPAddress); ip != "" {
			hostIPs[host.ID] = ip
		}
	}

	ips := make(map[string]string)
	for _, group := range groups {
		ip := hostIPs[group.HostID]
		if ip == "" {
			ip = consoleDeviceIP(group)
		}
		if ip == "" {
			continue
		}
		siteID := siteIDForGroup(hostSite, group)
		if _, exists := ips[siteID]; !exists {
			ips[siteID] = ip
		}
	}
	return ips
}

func consoleDeviceIP(group unifi.HostDeviceGroup) string {
	for _, device := range group.Devices {
		if device.IsConsole {
			if ip := strings.TrimSpace(device.IP); ip != "" {
				return ip
			}
		}
	}
	return ""
}

func saveConsoleIPs(ctx context.Context, q *sqlc.Queries, ips map[string]string, now time.Time) error {
	for siteID, ip := range ips {
		err := q.UpsertPreference(ctx, sqlc.UpsertPreferenceParams{
			Key:       ConsoleIPKey(siteID),
			Value:     ip,
			UpdatedAt: sql.NullTime{Time: now, Valid: true},
		})
		if err != nil {
			return fmt.Errorf("save console IP for site %q: %w", siteID, err)
		}
	}
	return nil
}

// StoredConsoleIP returns the console IP saved by the last fleet refresh, or "" if none.
func StoredConsoleIP(ctx context.Context, q *sqlc.Queries, siteID string) (string, error) {
	if siteID == "" {
		return "", nil
	}
	pref, err := q.GetPreference(ctx, ConsoleIPKey(siteID))
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load console IP for site %q: %w", siteID, err)
	}
	return strings.TrimSpace(pref.Value), nil
}
