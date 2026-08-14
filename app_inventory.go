package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"unifi-rollback/internal/inventory"
	"unifi-rollback/internal/secrets"
	"unifi-rollback/internal/store/sqlc"
	"unifi-rollback/internal/unifi"
)

// RefreshInventory fetches fleet inventory from Site Manager and persists it to SQLite.
func (a *App) RefreshInventory() ([]inventory.Device, error) {
	if a.store == nil {
		return nil, errors.New("database not available")
	}

	client, err := a.siteManagerClient()
	if errors.Is(err, secrets.ErrNotFound) {
		return nil, inventory.ErrSiteManagerKeyMissing
	}
	if err != nil {
		return nil, err
	}

	service := inventory.NewService(client)
	var devices []inventory.Device
	err = a.store.WithTx(func(q *sqlc.Queries) error {
		var refreshErr error
		devices, refreshErr = service.RefreshFromSiteManager(a.ctx, q)
		return refreshErr
	})
	if err != nil {
		return nil, fmt.Errorf("refresh inventory: %w", err)
	}

	if syncErr := a.syncSiteMetadataFromDevices(devices); syncErr != nil {
		return nil, syncErr
	}

	return enrichDevicesWithSiteNames(a.ctx, a.store.Queries(), devices)
}

// ListDevices returns cached inventory from SQLite without calling Site Manager.
func (a *App) ListDevices() ([]inventory.Device, error) {
	if a.store == nil {
		return nil, errors.New("database not available")
	}

	devices, err := inventory.ListFromDB(a.ctx, a.store.Queries())
	if err != nil {
		return nil, err
	}

	return enrichDevicesWithSiteNames(a.ctx, a.store.Queries(), devices)
}

func enrichDevicesWithSiteNames(ctx context.Context, q *sqlc.Queries, devices []inventory.Device) ([]inventory.Device, error) {
	siteNames, err := loadSiteNames(ctx, q)
	if err != nil {
		return nil, err
	}

	for i := range devices {
		stored := siteNames[devices[i].SiteID]
		devices[i].Site = unifi.ResolveSiteDisplayName(
			devices[i].SiteID,
			devices[i].Site,
			stored,
		)
	}

	return devices, nil
}

func loadSiteNames(ctx context.Context, q *sqlc.Queries) (map[string]string, error) {
	rows, err := q.ListCredentialsMeta(ctx)
	if err != nil {
		return nil, fmt.Errorf("list credential metadata: %w", err)
	}

	names := make(map[string]string)
	for _, row := range rows {
		if !strings.HasPrefix(row.KeyType, keyTypeNetworkLocal) {
			continue
		}
		siteID := strings.TrimPrefix(row.KeyType, keyTypeNetworkLocal)
		label := siteID
		if row.Label.Valid && row.Label.String != "" {
			label = row.Label.String
		}
		names[siteID] = label
	}
	return names, nil
}

func (a *App) syncSiteMetadataFromDevices(devices []inventory.Device) error {
	seen := make(map[string]string)
	for _, device := range devices {
		if device.SiteID == "" {
			continue
		}
		if _, ok := seen[device.SiteID]; ok {
			continue
		}
		name := device.Site
		if name == "" || unifi.LooksLikeHostID(name) {
			continue
		}
		seen[device.SiteID] = name
	}

	for siteID, siteName := range seen {
		if err := a.store.Queries().UpsertCredentialMetaLabel(a.ctx, sqlc.UpsertCredentialMetaLabelParams{
			KeyType: networkLocalKeyType(siteID),
			Label:   sql.NullString{String: siteName, Valid: true},
		}); err != nil {
			return fmt.Errorf("sync site metadata for %q: %w", siteID, err)
		}
	}

	return nil
}
