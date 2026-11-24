package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"

	"unifi-rollback/internal/inventory"
	"unifi-rollback/internal/secrets"
	"unifi-rollback/internal/store/sqlc"
	"unifi-rollback/internal/unifi"
)

const (
	defaultClassicUsername = "ubnt"
	defaultClassicPassword = "ubnt"
	defaultClassicSite     = "default"
)

var (
	// ErrLocateNoSiteManagerKey is returned when LocateDevice runs without a Site Manager API key.
	ErrLocateNoSiteManagerKey = errors.New("Site Manager API key is not configured — add Fleet access in Settings")
	// ErrLocateNoConsoleIP is returned when Site Manager has no console IP for the device's host.
	ErrLocateNoConsoleIP = errors.New("Console IP is unavailable for this device in Site Manager")
	// ErrLocateFactoryLoginRefused is returned when the console rejects the factory ubnt login.
	ErrLocateFactoryLoginRefused = errors.New("Console refused the factory default login (username ubnt) — credentials may have been changed or local login is disabled")
	// ErrLocateCommandRefused is returned when the console refuses the classic set-locate command.
	ErrLocateCommandRefused = errors.New("Console refused the locate command")
)

type locateDeps struct {
	queries       *sqlc.Queries
	siteManager   func() (*unifi.SiteManagerClient, error)
	classicClient func(cfg unifi.ClassicConfig) (*unifi.ClassicClient, error)
}

// LocateDevice blinks the LEDs on an inventoried device via its console's classic API
// using the factory ubnt account.
func (a *App) LocateDevice(siteID, deviceID string) error {
	if a.store == nil {
		return errors.New("database not available")
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	return locateDevice(
		ctx,
		locateDeps{
			queries:       a.store.Queries(),
			siteManager:   a.siteManagerClient,
			classicClient: unifi.NewClassicClientForLocalConsole,
		},
		siteID,
		deviceID,
	)
}

func locateDevice(ctx context.Context, deps locateDeps, siteID, deviceID string) error {
	deviceID = strings.TrimSpace(deviceID)
	if deviceID == "" {
		return errors.New("device ID is required")
	}

	device, err := findInventoryDevice(ctx, deps.queries, deviceID)
	if err != nil {
		return err
	}

	mac := strings.TrimSpace(device.Mac)
	if mac == "" {
		return fmt.Errorf("device %q has no MAC address in inventory", deviceID)
	}

	effectiveSiteID := strings.TrimSpace(device.SiteID)
	if effectiveSiteID == "" {
		effectiveSiteID = strings.TrimSpace(siteID)
	}

	consoleIP, err := inventory.StoredConsoleIP(ctx, deps.queries, effectiveSiteID)
	if err != nil {
		return err
	}
	if consoleIP == "" {
		sm, err := deps.siteManager()
		if errors.Is(err, secrets.ErrNotFound) {
			return ErrLocateNoSiteManagerKey
		}
		if err != nil {
			return err
		}
		consoleIP, err = resolveConsoleIPForSite(ctx, deps.queries, sm, effectiveSiteID)
		if err != nil {
			return err
		}
	}

	client, err := deps.classicClient(unifi.ClassicConfig{
		ConsoleBaseURL: consoleBaseURLFromIP(consoleIP),
		Username:       defaultClassicUsername,
		Password:       defaultClassicPassword,
		Site:           defaultClassicSite,
	})
	if err != nil {
		return fmt.Errorf("create classic client: %w", err)
	}

	if err := client.SetLocate(ctx, mac); err != nil {
		return classifyLocateError(err)
	}
	return nil
}

func findInventoryDevice(ctx context.Context, queries *sqlc.Queries, deviceID string) (sqlc.Device, error) {
	rows, err := queries.ListDevices(ctx)
	if err != nil {
		return sqlc.Device{}, fmt.Errorf("list devices: %w", err)
	}
	for _, row := range rows {
		if row.ID == deviceID {
			return row, nil
		}
	}
	return sqlc.Device{}, fmt.Errorf("device %q not found in inventory", deviceID)
}

func resolveConsoleIPForSite(
	ctx context.Context,
	queries *sqlc.Queries,
	sm *unifi.SiteManagerClient,
	siteID string,
) (string, error) {
	hostID, err := cachedHostIDForSite(ctx, queries, siteID)
	if err != nil {
		return "", err
	}

	if hostID == "" {
		sites, err := sm.ListSites(ctx)
		if err != nil {
			return "", fmt.Errorf("list sites from Site Manager: %w", err)
		}
		for _, site := range sites {
			if site.SiteID == siteID && site.HostID != "" {
				hostID = site.HostID
				break
			}
		}
	}

	if hostID != "" {
		host, err := sm.GetHost(ctx, hostID)
		if err != nil {
			if unifi.IsHTTPStatus(err, http.StatusNotFound) {
				return "", ErrLocateNoConsoleIP
			}
			return "", fmt.Errorf("load console host from Site Manager: %w", err)
		}
		ip := strings.TrimSpace(host.IPAddress)
		if ip == "" {
			return "", ErrLocateNoConsoleIP
		}
		return ip, nil
	}

	hosts, err := sm.ListHosts(ctx)
	if err != nil {
		return "", fmt.Errorf("list console hosts from Site Manager: %w", err)
	}
	for _, host := range hosts {
		if host.ID == siteID {
			ip := strings.TrimSpace(host.IPAddress)
			if ip == "" {
				return "", ErrLocateNoConsoleIP
			}
			return ip, nil
		}
	}
	if len(hosts) == 1 {
		ip := strings.TrimSpace(hosts[0].IPAddress)
		if ip == "" {
			return "", ErrLocateNoConsoleIP
		}
		return ip, nil
	}

	return "", ErrLocateNoConsoleIP
}

func cachedHostIDForSite(ctx context.Context, queries *sqlc.Queries, siteID string) (string, error) {
	if siteID == "" {
		return "", nil
	}
	meta, err := queries.GetCredentialMeta(ctx, keyTypeSiteManager)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("load site manager metadata: %w", err)
	}
	summary, err := decodeProbeSummary(meta.ProbeSummary)
	if err != nil || summary == nil {
		return "", err
	}
	for _, site := range summary.Sites {
		if site.SiteID == siteID && site.HostID != "" {
			return site.HostID, nil
		}
	}
	return "", nil
}

func consoleBaseURLFromIP(ip string) string {
	ip = strings.TrimSpace(ip)
	if parsed := net.ParseIP(ip); parsed != nil && strings.Contains(ip, ":") {
		return "https://[" + ip + "]"
	}
	return "https://" + ip
}

func classifyLocateError(err error) error {
	if errors.Is(err, unifi.ErrClassicLoginRefused) {
		return ErrLocateFactoryLoginRefused
	}
	if errors.Is(err, unifi.ErrClassicCommandRefused) {
		prefix := unifi.ErrClassicCommandRefused.Error() + ": "
		if detail, ok := strings.CutPrefix(err.Error(), prefix); ok && detail != "" {
			return fmt.Errorf("%w (%s)", ErrLocateCommandRefused, detail)
		}
		return ErrLocateCommandRefused
	}
	return fmt.Errorf("locate request failed: %w", err)
}
