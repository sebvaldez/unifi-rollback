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

// ErrSiteManagerKeyMissing is returned when fleet refresh is attempted without a Site Manager key.
var ErrSiteManagerKeyMissing = errors.New("site manager API key is not configured")

// Service syncs fleet inventory from UniFi Site Manager into SQLite.
type Service struct {
	siteManager *unifi.SiteManagerClient
}

// NewService returns an inventory service backed by a Site Manager client.
func NewService(siteManager *unifi.SiteManagerClient) *Service {
	return &Service{siteManager: siteManager}
}

// RefreshFromSiteManager fetches sites and devices, merges into SQLite, and returns all rows
// including devices that fell out of API key scope as ghost entries.
func (s *Service) RefreshFromSiteManager(ctx context.Context, q *sqlc.Queries) ([]Device, error) {
	if s.siteManager == nil {
		return nil, fmt.Errorf("site manager client is not configured")
	}

	sites, err := s.siteManager.ListSites(ctx)
	if err != nil {
		return nil, fmt.Errorf("list sites: %w", err)
	}

	hosts, err := s.siteManager.ListHosts(ctx)
	if err != nil {
		// Host names are optional — inventory still works from sites + device groups.
		hosts = nil
	}

	groups, err := s.siteManager.ListAllDevices(ctx, unifi.ListDevicesParams{})
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}

	activeDevices := MergeFleetInventory(sites, hosts, groups)
	now := time.Now().UTC()

	activeByID := make(map[string]Device, len(activeDevices))
	activeIDs := make(map[string]struct{}, len(activeDevices))
	for _, device := range activeDevices {
		activeByID[device.ID] = device
		activeIDs[device.ID] = struct{}{}
		params := deviceToParams(device, now)
		params.InScope = 1
		params.ScopeLostAt = sql.NullTime{}
		if err := q.UpsertDevice(ctx, params); err != nil {
			return nil, fmt.Errorf("upsert device %q: %w", device.ID, err)
		}
	}

	existing, err := q.ListDevices(ctx)
	if err != nil {
		return nil, fmt.Errorf("list existing devices: %w", err)
	}

	for _, row := range existing {
		if _, ok := activeIDs[row.ID]; ok {
			continue
		}
		if row.InScope == 0 {
			continue
		}
		if err := q.MarkDeviceOutOfScope(ctx, sqlc.MarkDeviceOutOfScopeParams{
			ScopeLostAt: sql.NullTime{Time: now, Valid: true},
			UpdatedAt:   sql.NullTime{Time: now, Valid: true},
			ID:          row.ID,
		}); err != nil {
			return nil, fmt.Errorf("mark device %q out of scope: %w", row.ID, err)
		}
	}

	devices, err := ListFromDB(ctx, q)
	if err != nil {
		return nil, err
	}
	return attachMergedSiteNames(devices, activeByID)
}

func attachMergedSiteNames(devices []Device, activeByID map[string]Device) ([]Device, error) {
	for i := range devices {
		if active, ok := activeByID[devices[i].ID]; ok && active.Site != "" {
			devices[i].Site = active.Site
		}
	}
	return devices, nil
}

// ListFromDB reads cached devices from SQLite.
func ListFromDB(ctx context.Context, q *sqlc.Queries) ([]Device, error) {
	rows, err := q.ListDevices(ctx)
	if err != nil {
		return nil, fmt.Errorf("list devices: %w", err)
	}

	devices := make([]Device, len(rows))
	for i, row := range rows {
		devices[i] = rowToDevice(row)
	}
	return devices, nil
}

// MergeFleetInventory joins Site Manager sites, hosts, and host-grouped devices.
// When a host has multiple Network sites, the first site wins (v1 limitation).
func MergeFleetInventory(sites []unifi.Site, hosts []unifi.Host, groups []unifi.HostDeviceGroup) []Device {
	hostSite := make(map[string]unifi.Site, len(sites))
	for _, site := range sites {
		if site.HostID == "" {
			continue
		}
		if _, exists := hostSite[site.HostID]; !exists {
			hostSite[site.HostID] = site
		}
	}

	hostLabels := make(map[string]string, len(hosts))
	for _, host := range hosts {
		if name := unifi.HostDisplayName(host); name != "" {
			hostLabels[host.ID] = name
		}
	}

	var devices []Device
	for _, group := range groups {
		site, ok := hostSite[group.HostID]
		siteID := ""
		if ok {
			siteID = site.SiteID
		} else if siteID == "" {
			siteID = group.HostID
		}

		siteName := resolveSiteName(group, site, ok, hostLabels)

		for _, device := range group.Devices {
			devices = append(devices, mapSiteManagerDevice(device, siteID, siteName))
		}
	}

	return devices
}

func resolveSiteName(
	group unifi.HostDeviceGroup,
	site unifi.Site,
	hasSite bool,
	hostLabels map[string]string,
) string {
	if hasSite {
		if name := unifi.SiteNameFromMeta(site.Meta); name != "" {
			return name
		}
	}

	if name := strings.TrimSpace(group.HostName); name != "" && !unifi.LooksLikeHostID(name) {
		return name
	}

	if name := hostLabels[group.HostID]; name != "" {
		return name
	}

	return unifi.ShortHostLabel(group.HostID)
}

func mapSiteManagerDevice(device unifi.SiteManagerDevice, siteID, siteName string) Device {
	id := device.ID
	if id == "" {
		id = device.MAC
	}

	model := device.Model
	if model == "" {
		model = device.ShortName
	}

	name := device.Name
	if name == "" {
		name = model
	}
	if name == "" {
		name = id
	}

	return Device{
		ID:       id,
		SiteID:   siteID,
		Name:     name,
		Model:    model,
		Firmware: device.Version,
		Status:   mapDeviceStatus(device),
		Site:     siteName,
		Mac:      device.MAC,
		InScope:  true,
		Capabilities: DeviceCapabilities{
			Inventory: false,
			Restart:   false,
			Locate:    false,
			Rollback:  false,
		},
	}
}

func mapDeviceStatus(device unifi.SiteManagerDevice) string {
	switch strings.ToLower(strings.TrimSpace(device.Status)) {
	case "online", "offline", "adopting":
		return strings.ToLower(device.Status)
	}
	if !device.IsManaged {
		return "adopting"
	}
	return "unknown"
}

func deviceToParams(device Device, now time.Time) sqlc.UpsertDeviceParams {
	inScope := int64(0)
	if device.InScope {
		inScope = 1
	}

	var scopeLostAt sql.NullTime
	if device.ScopeLostAt != "" {
		if parsed, err := time.Parse(time.RFC3339, device.ScopeLostAt); err == nil {
			scopeLostAt = sql.NullTime{Time: parsed, Valid: true}
		}
	}

	return sqlc.UpsertDeviceParams{
		ID:            device.ID,
		SiteID:        device.SiteID,
		Mac:           device.Mac,
		Model:         device.Model,
		Name:          nullString(device.Name),
		CurrentFw:     nullString(device.Firmware),
		AdoptionState: nullString(device.Status),
		LastSeen:      sql.NullTime{},
		UpdatedAt:     sql.NullTime{Time: now, Valid: true},
		InScope:       inScope,
		ScopeLostAt:   scopeLostAt,
	}
}

func rowToDevice(row sqlc.Device) Device {
	status := "unknown"
	if row.AdoptionState.Valid {
		status = row.AdoptionState.String
	}

	device := Device{
		ID:       row.ID,
		SiteID:   row.SiteID,
		Name:     nullStringValue(row.Name),
		Model:    row.Model,
		Firmware: nullStringValue(row.CurrentFw),
		Status:   status,
		Site:     "",
		Mac:      row.Mac,
		InScope:  row.InScope != 0,
		Capabilities: DeviceCapabilities{
			Inventory: false,
			Restart:   false,
			Locate:    false,
			Rollback:  false,
		},
	}

	if row.ScopeLostAt.Valid {
		device.ScopeLostAt = row.ScopeLostAt.Time.UTC().Format(time.RFC3339)
	}

	return device
}

func nullString(value string) sql.NullString {
	value = strings.TrimSpace(value)
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func nullStringValue(value sql.NullString) string {
	if !value.Valid {
		return ""
	}
	return value.String
}
