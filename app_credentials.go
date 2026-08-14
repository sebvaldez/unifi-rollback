package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"unifi-rollback/internal/secrets"
	"unifi-rollback/internal/store/sqlc"
	"unifi-rollback/internal/unifi"
)

const (
	slotSiteManagerPrimary = "site-manager-primary"
	keyTypeSiteManager     = "site_manager"
	keyTypeNetworkLocal    = "network_local:"
)

// ValidationSummary mirrors discovered API key access from validation probes.
type ValidationSummary struct {
	Sites                []ProbedSiteSummary `json:"sites"`
	ApplicationsObserved []string            `json:"applicationsObserved"`
	HostCount            int                 `json:"hostCount"`
	DeviceCount          int                 `json:"deviceCount"`
	Notes                []string            `json:"notes,omitempty"`
}

// ProbedSiteSummary is a site entry in ValidationSummary.
type ProbedSiteSummary struct {
	SiteID     string `json:"siteId"`
	SiteName   string `json:"siteName"`
	HostID     string `json:"hostId,omitempty"`
	Permission string `json:"permission,omitempty"`
}

// CredentialSlot mirrors frontend/src/types/credentials.ts CredentialSlot.
type CredentialSlot struct {
	ID                string             `json:"id"`
	Kind              string             `json:"kind"`
	Label             string             `json:"label"`
	Status            string             `json:"status"`
	Capabilities      []string           `json:"capabilities"`
	Enabled           bool               `json:"enabled"`
	BoundSiteID       string             `json:"boundSiteId,omitempty"`
	BoundSiteName     string             `json:"boundSiteName,omitempty"`
	BoundHostID       string             `json:"boundHostId,omitempty"`
	MaskedSuffix      string             `json:"maskedSuffix,omitempty"`
	LastValidatedAt   string             `json:"lastValidatedAt,omitempty"`
	ValidationError   string             `json:"validationError,omitempty"`
	ValidationSummary *ValidationSummary `json:"validationSummary,omitempty"`
}

// SaveCredentialRequest mirrors frontend SaveCredentialRequest.
type SaveCredentialRequest struct {
	SlotID string `json:"slotId"`
	Secret string `json:"secret"`
	Label  string `json:"label"`
}

// DiscoveredSite is a site seen during inventory sync.
type DiscoveredSite struct {
	SiteID   string `json:"siteId"`
	SiteName string `json:"siteName"`
}

// ListCredentialSlots returns credential registry slots for the UI.
func (a *App) ListCredentialSlots() ([]CredentialSlot, error) {
	if a.store == nil {
		return nil, errors.New("database not available")
	}

	slots := []CredentialSlot{defaultSiteManagerSlot()}
	siteManager, err := a.loadSiteManagerSlot()
	if err != nil {
		return nil, err
	}
	slots[0] = siteManager

	networkSlots, err := a.loadNetworkIntegrationSlots()
	if err != nil {
		return nil, err
	}

	return append(slots, networkSlots...), nil
}

// SaveCredential validates, stores, and returns an updated credential slot.
func (a *App) SaveCredential(request SaveCredentialRequest) (CredentialSlot, error) {
	if a.store == nil {
		return CredentialSlot{}, errors.New("database not available")
	}

	switch request.SlotID {
	case slotSiteManagerPrimary:
		return a.saveSiteManagerCredential(request)
	default:
		return CredentialSlot{}, fmt.Errorf("unsupported credential slot %q", request.SlotID)
	}
}

// ValidateCredential re-probes the API for a credential slot.
func (a *App) ValidateCredential(slotID string) (CredentialSlot, error) {
	if a.store == nil {
		return CredentialSlot{}, errors.New("database not available")
	}

	switch slotID {
	case slotSiteManagerPrimary:
		return a.validateSiteManagerCredential()
	default:
		return CredentialSlot{}, fmt.Errorf("unsupported credential slot %q", slotID)
	}
}

// RemoveCredential deletes secret material and metadata for a slot.
func (a *App) RemoveCredential(slotID string) error {
	if a.store == nil {
		return errors.New("database not available")
	}

	switch {
	case slotID == slotSiteManagerPrimary:
		return a.removeSiteManagerCredential()
	case strings.HasPrefix(slotID, "network-integration-"):
		siteID := strings.TrimPrefix(slotID, "network-integration-")
		if siteID == "" {
			return fmt.Errorf("invalid network integration slot %q", slotID)
		}
		return a.removeNetworkIntegrationCredential(siteID)
	default:
		return fmt.Errorf("unsupported credential slot %q", slotID)
	}
}

// SyncCredentialSiteSlots upserts placeholder Network Integration slots for discovered sites.
func (a *App) SyncCredentialSiteSlots(sites []DiscoveredSite) ([]CredentialSlot, error) {
	if a.store == nil {
		return nil, errors.New("database not available")
	}

	for _, site := range sites {
		siteID := strings.TrimSpace(site.SiteID)
		if siteID == "" {
			continue
		}

		label := strings.TrimSpace(site.SiteName)
		if label == "" {
			label = siteID
		}

		err := a.store.Queries().UpsertCredentialMetaLabel(a.ctx, sqlc.UpsertCredentialMetaLabelParams{
			KeyType: networkLocalKeyType(siteID),
			Label:   sql.NullString{String: label, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("upsert network slot for site %q: %w", siteID, err)
		}
	}

	return a.ListCredentialSlots()
}

func defaultSiteManagerSlot() CredentialSlot {
	return CredentialSlot{
		ID:           slotSiteManagerPrimary,
		Kind:         "site_manager",
		Label:        "Fleet access",
		Status:       "unconfigured",
		Capabilities: nil,
		Enabled:      true,
	}
}

func (a *App) loadSiteManagerSlot() (CredentialSlot, error) {
	slot := defaultSiteManagerSlot()

	meta, metaErr := a.store.Queries().GetCredentialMeta(a.ctx, keyTypeSiteManager)
	hasMeta := metaErr == nil
	if metaErr != nil && !errors.Is(metaErr, sql.ErrNoRows) {
		return CredentialSlot{}, fmt.Errorf("load site manager metadata: %w", metaErr)
	}

	if !hasMeta || !meta.MaskedSuffix.Valid {
		return slot, nil
	}

	slot.MaskedSuffix = meta.MaskedSuffix.String
	slot.Status = "configured"
	slot.Capabilities = []string{"inventory"}

	if meta.Label.Valid && meta.Label.String != "" {
		slot.Label = meta.Label.String
	}
	if meta.LastValidatedAt.Valid {
		slot.LastValidatedAt = meta.LastValidatedAt.Time.UTC().Format(time.RFC3339)
	}
	if summary, err := decodeProbeSummary(meta.ProbeSummary); err != nil {
		return CredentialSlot{}, err
	} else if summary != nil {
		slot.ValidationSummary = summary
		slot.Capabilities = unifi.CapabilitiesFromProbe(probeFromSummary(*summary))
	}

	return slot, nil
}

func (a *App) saveSiteManagerCredential(request SaveCredentialRequest) (CredentialSlot, error) {
	secret := strings.TrimSpace(request.Secret)
	if secret == "" {
		return CredentialSlot{}, errors.New("API key cannot be empty")
	}

	client := unifi.NewSiteManagerClient(secret)
	probe, err := client.ProbeKeyAccess(a.ctx)
	if err != nil {
		return CredentialSlot{}, fmt.Errorf("site manager validation failed: %w", err)
	}

	store, err := a.secretsStore()
	if err != nil {
		return CredentialSlot{}, err
	}
	if err := store.Save(secrets.AccountSiteManagerAPIKey, secret); err != nil {
		return CredentialSlot{}, fmt.Errorf("save site manager key: %w", err)
	}

	label := strings.TrimSpace(request.Label)
	if label == "" {
		label = "Fleet access"
	}

	summary := validationSummaryFromProbe(probe)
	now := time.Now().UTC()
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         keyTypeSiteManager,
		Label:           sql.NullString{String: label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeProbeSummary(summary),
	}); err != nil {
		return CredentialSlot{}, fmt.Errorf("save site manager metadata: %w", err)
	}

	if err := a.syncDiscoveredSitesFromProbe(probe); err != nil {
		return CredentialSlot{}, err
	}

	return CredentialSlot{
		ID:                slotSiteManagerPrimary,
		Kind:              "site_manager",
		Label:             label,
		Status:            "configured",
		Capabilities:      unifi.CapabilitiesFromProbe(probe),
		Enabled:           true,
		MaskedSuffix:      secrets.MaskedSuffix(secret),
		LastValidatedAt:   now.Format(time.RFC3339),
		ValidationSummary: &summary,
	}, nil
}

func (a *App) validateSiteManagerCredential() (CredentialSlot, error) {
	store, err := a.secretsStore()
	if err != nil {
		return CredentialSlot{}, err
	}

	secret, err := store.Get(secrets.AccountSiteManagerAPIKey)
	if errors.Is(err, secrets.ErrNotFound) {
		return CredentialSlot{}, errors.New("add a key before validating")
	}
	if err != nil {
		return CredentialSlot{}, err
	}

	client := unifi.NewSiteManagerClient(secret)
	probe, err := client.ProbeKeyAccess(a.ctx)
	if err != nil {
		return CredentialSlot{}, fmt.Errorf("site manager validation failed: %w", err)
	}

	slot, err := a.loadSiteManagerSlot()
	if err != nil {
		return CredentialSlot{}, err
	}

	summary := validationSummaryFromProbe(probe)
	now := time.Now().UTC()
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         keyTypeSiteManager,
		Label:           sql.NullString{String: slot.Label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeProbeSummary(summary),
	}); err != nil {
		return CredentialSlot{}, fmt.Errorf("update site manager metadata: %w", err)
	}

	if err := a.syncDiscoveredSitesFromProbe(probe); err != nil {
		return CredentialSlot{}, err
	}

	slot.Status = "configured"
	slot.Capabilities = unifi.CapabilitiesFromProbe(probe)
	slot.MaskedSuffix = secrets.MaskedSuffix(secret)
	slot.LastValidatedAt = now.Format(time.RFC3339)
	slot.ValidationError = ""
	slot.ValidationSummary = &summary
	return slot, nil
}

func (a *App) syncDiscoveredSitesFromProbe(probe unifi.KeyAccessProbe) error {
	sites := make([]DiscoveredSite, len(probe.Sites))
	for i, site := range probe.Sites {
		sites[i] = DiscoveredSite{SiteID: site.SiteID, SiteName: site.SiteName}
	}
	_, err := a.SyncCredentialSiteSlots(sites)
	return err
}

func (a *App) removeSiteManagerCredential() error {
	store, err := a.secretsStore()
	if err != nil {
		return err
	}

	if err := store.Delete(secrets.AccountSiteManagerAPIKey); err != nil && !errors.Is(err, secrets.ErrNotFound) {
		return err
	}

	if err := a.store.Queries().DeleteCredentialMeta(a.ctx, keyTypeSiteManager); err != nil {
		return fmt.Errorf("delete site manager metadata: %w", err)
	}

	if err := a.deleteAllNetworkLocalCredentialMeta(); err != nil {
		return err
	}

	if err := a.store.Queries().DeleteAllDevices(a.ctx); err != nil {
		return fmt.Errorf("clear device inventory: %w", err)
	}

	return nil
}

func (a *App) removeNetworkIntegrationCredential(siteID string) error {
	store, err := a.secretsStore()
	if err != nil {
		return err
	}

	account := secrets.NetworkLocalAPIKeyAccount(siteID)
	if err := store.Delete(account); err != nil && !errors.Is(err, secrets.ErrNotFound) {
		return err
	}

	if err := a.store.Queries().DeleteCredentialMeta(a.ctx, networkLocalKeyType(siteID)); err != nil {
		return fmt.Errorf("delete network integration metadata for site %q: %w", siteID, err)
	}

	return nil
}

func (a *App) deleteAllNetworkLocalCredentialMeta() error {
	rows, err := a.store.Queries().ListCredentialsMeta(a.ctx)
	if err != nil {
		return fmt.Errorf("list credential metadata: %w", err)
	}

	secretStore, err := a.secretsStore()
	if err != nil {
		return err
	}

	for _, row := range rows {
		if !strings.HasPrefix(row.KeyType, keyTypeNetworkLocal) {
			continue
		}
		siteID := strings.TrimPrefix(row.KeyType, keyTypeNetworkLocal)
		account := secrets.NetworkLocalAPIKeyAccount(siteID)
		if err := secretStore.Delete(account); err != nil && !errors.Is(err, secrets.ErrNotFound) {
			return fmt.Errorf("delete network integration secret for site %q: %w", siteID, err)
		}
		if err := a.store.Queries().DeleteCredentialMeta(a.ctx, row.KeyType); err != nil {
			return fmt.Errorf("delete credential metadata %q: %w", row.KeyType, err)
		}
	}

	return nil
}

func (a *App) loadNetworkIntegrationSlots() ([]CredentialSlot, error) {
	rows, err := a.store.Queries().ListCredentialsMeta(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("list credential metadata: %w", err)
	}

	var slots []CredentialSlot
	for _, row := range rows {
		if !strings.HasPrefix(row.KeyType, keyTypeNetworkLocal) {
			continue
		}

		siteID := strings.TrimPrefix(row.KeyType, keyTypeNetworkLocal)
		label := siteID
		if row.Label.Valid && row.Label.String != "" {
			label = row.Label.String
		}

		slot := CredentialSlot{
			ID:            networkSlotID(siteID),
			Kind:          "network_integration",
			Label:         label,
			Status:        "unconfigured",
			Capabilities:  nil,
			Enabled:       true,
			BoundSiteID:   siteID,
			BoundSiteName: label,
		}

		if row.MaskedSuffix.Valid && row.MaskedSuffix.String != "" {
			slot.Status = "configured"
			slot.Capabilities = []string{"device_read", "device_restart"}
			slot.MaskedSuffix = row.MaskedSuffix.String
		}

		if row.LastValidatedAt.Valid {
			slot.LastValidatedAt = row.LastValidatedAt.Time.UTC().Format(time.RFC3339)
		}

		slots = append(slots, slot)
	}

	return slots, nil
}

func (a *App) siteManagerAPIKey() (string, error) {
	store, err := a.secretsStore()
	if err != nil {
		return "", err
	}

	secret, err := store.Get(secrets.AccountSiteManagerAPIKey)
	if errors.Is(err, secrets.ErrNotFound) {
		return "", secrets.ErrNotFound
	}
	return secret, err
}

func networkLocalKeyType(siteID string) string {
	return keyTypeNetworkLocal + siteID
}

func networkSlotID(siteID string) string {
	return "network-integration-" + siteID
}

func (a *App) siteManagerClient() (*unifi.SiteManagerClient, error) {
	key, err := a.siteManagerAPIKey()
	if err != nil {
		return nil, err
	}
	return unifi.NewSiteManagerClient(key), nil
}

func validationSummaryFromProbe(probe unifi.KeyAccessProbe) ValidationSummary {
	sites := make([]ProbedSiteSummary, len(probe.Sites))
	for i, site := range probe.Sites {
		sites[i] = ProbedSiteSummary{
			SiteID:     site.SiteID,
			SiteName:   site.SiteName,
			HostID:     site.HostID,
			Permission: site.Permission,
		}
	}
	return ValidationSummary{
		Sites:                sites,
		ApplicationsObserved: append([]string(nil), probe.ApplicationsObserved...),
		HostCount:            probe.HostCount,
		DeviceCount:          probe.DeviceCount,
		Notes:                append([]string(nil), probe.Notes...),
	}
}

func probeFromSummary(summary ValidationSummary) unifi.KeyAccessProbe {
	sites := make([]unifi.ProbedSite, len(summary.Sites))
	for i, site := range summary.Sites {
		sites[i] = unifi.ProbedSite{
			SiteID:     site.SiteID,
			SiteName:   site.SiteName,
			HostID:     site.HostID,
			Permission: site.Permission,
		}
	}
	return unifi.KeyAccessProbe{
		Sites:                sites,
		ApplicationsObserved: append([]string(nil), summary.ApplicationsObserved...),
		HostCount:            summary.HostCount,
		DeviceCount:          summary.DeviceCount,
		Notes:                append([]string(nil), summary.Notes...),
	}
}

func encodeProbeSummary(summary ValidationSummary) sql.NullString {
	raw, err := json.Marshal(summary)
	if err != nil {
		return sql.NullString{}
	}
	return sql.NullString{String: string(raw), Valid: true}
}

func decodeProbeSummary(value sql.NullString) (*ValidationSummary, error) {
	if !value.Valid || strings.TrimSpace(value.String) == "" {
		return nil, nil
	}
	var summary ValidationSummary
	if err := json.Unmarshal([]byte(value.String), &summary); err != nil {
		return nil, fmt.Errorf("decode probe summary: %w", err)
	}
	return &summary, nil
}
