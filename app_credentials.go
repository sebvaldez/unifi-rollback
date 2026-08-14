package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
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
		if siteID, ok := parseNetworkIntegrationSiteID(request.SlotID); ok {
			return a.saveNetworkIntegrationCredential(siteID, request)
		}
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
		if siteID, ok := parseNetworkIntegrationSiteID(slotID); ok {
			return a.validateNetworkIntegrationCredential(siteID)
		}
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
		siteID, ok := parseNetworkIntegrationSiteID(slotID)
		if !ok {
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

	for _, site := range dedupeDiscoveredSites(sites) {
		err := a.store.Queries().UpsertCredentialMetaLabel(a.ctx, sqlc.UpsertCredentialMetaLabelParams{
			KeyType: networkLocalKeyType(site.SiteID),
			Label:   sql.NullString{String: site.SiteName, Valid: true},
		})
		if err != nil {
			return nil, fmt.Errorf("upsert network slot for site %q: %w", site.SiteID, err)
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
	tracker := a.newCredentialProgressTracker(slotSiteManagerPrimary)
	var saveErr error
	defer func() {
		if saveErr != nil {
			tracker.fail()
		} else {
			tracker.done()
		}
	}()

	secret := strings.TrimSpace(request.Secret)
	if secret == "" {
		saveErr = errors.New("API key cannot be empty")
		return CredentialSlot{}, saveErr
	}

	tracker.step("Validating Site Manager API key", "api.ui.com")
	client := unifi.NewSiteManagerClient(secret)
	probe, err := client.ProbeKeyAccess(a.ctx, tracker.probeReporter())
	if err != nil {
		saveErr = fmt.Errorf("site manager validation failed: %w", err)
		return CredentialSlot{}, saveErr
	}

	label := strings.TrimSpace(request.Label)
	if label == "" {
		label = "Fleet access"
	}

	summary := validationSummaryFromProbe(probe)
	now := time.Now().UTC()

	tracker.step("Syncing site credential placeholders", "Local database")
	if err := a.syncDiscoveredSitesFromProbe(probe); err != nil {
		saveErr = err
		return CredentialSlot{}, saveErr
	}

	store, err := a.secretsStore()
	if err != nil {
		saveErr = err
		return CredentialSlot{}, saveErr
	}

	previousSecret, previousErr := store.Get(secrets.AccountSiteManagerAPIKey)
	hadPreviousSecret := previousErr == nil

	tracker.step("Saving key to macOS Keychain", "Keychain")
	if err := store.Save(secrets.AccountSiteManagerAPIKey, secret); err != nil {
		saveErr = fmt.Errorf("save site manager key: %w", err)
		return CredentialSlot{}, saveErr
	}

	tracker.step("Saving validation results", "Local database")
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         keyTypeSiteManager,
		Label:           sql.NullString{String: label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeProbeSummary(summary),
	}); err != nil {
		rollbackKeychainSecret(store, secrets.AccountSiteManagerAPIKey, previousSecret, hadPreviousSecret)
		saveErr = fmt.Errorf("save site manager metadata: %w", err)
		return CredentialSlot{}, saveErr
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
	tracker := a.newCredentialProgressTracker(slotSiteManagerPrimary)
	var validateErr error
	defer func() {
		if validateErr != nil {
			tracker.fail()
		} else {
			tracker.done()
		}
	}()

	store, err := a.secretsStore()
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	secret, err := store.Get(secrets.AccountSiteManagerAPIKey)
	if errors.Is(err, secrets.ErrNotFound) {
		validateErr = errors.New("add a key before validating")
		return CredentialSlot{}, validateErr
	}
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	tracker.step("Revalidating Site Manager API key", "api.ui.com")
	client := unifi.NewSiteManagerClient(secret)
	probe, err := client.ProbeKeyAccess(a.ctx, tracker.probeReporter())
	if err != nil {
		validateErr = fmt.Errorf("site manager validation failed: %w", err)
		return CredentialSlot{}, validateErr
	}

	slot, err := a.loadSiteManagerSlot()
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	summary := validationSummaryFromProbe(probe)
	now := time.Now().UTC()
	tracker.step("Updating validation results", "Local database")
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         keyTypeSiteManager,
		Label:           sql.NullString{String: slot.Label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeProbeSummary(summary),
	}); err != nil {
		validateErr = fmt.Errorf("update site manager metadata: %w", err)
		return CredentialSlot{}, validateErr
	}

	tracker.step("Syncing site credential placeholders", "Local database")
	if err := a.syncDiscoveredSitesFromProbe(probe); err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
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

func (a *App) saveNetworkIntegrationCredential(siteID string, request SaveCredentialRequest) (CredentialSlot, error) {
	slotID := networkSlotID(siteID)
	tracker := a.newCredentialProgressTracker(slotID)
	var saveErr error
	defer func() {
		if saveErr != nil {
			tracker.fail()
		} else {
			tracker.done()
		}
	}()

	secret := strings.TrimSpace(request.Secret)
	if secret == "" {
		saveErr = errors.New("API key cannot be empty")
		return CredentialSlot{}, saveErr
	}

	probe, hostID, err := a.probeNetworkIntegrationKey(siteID, secret, tracker)
	if err != nil {
		saveErr = err
		return CredentialSlot{}, saveErr
	}

	tracker.step("Saving key to macOS Keychain", "Keychain")
	store, err := a.secretsStore()
	if err != nil {
		saveErr = err
		return CredentialSlot{}, saveErr
	}
	account := secrets.NetworkLocalAPIKeyAccount(siteID)
	previousSecret, previousErr := store.Get(account)
	hadPreviousSecret := previousErr == nil

	if err := store.Save(account, secret); err != nil {
		saveErr = fmt.Errorf("save network integration key: %w", err)
		return CredentialSlot{}, saveErr
	}

	label := strings.TrimSpace(request.Label)
	if label == "" {
		label, _ = a.networkIntegrationLabel(siteID)
	}
	if label == "" {
		label = siteID
	}

	now := time.Now().UTC()
	tracker.step("Saving validation results", "Local database")
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         networkLocalKeyType(siteID),
		Label:           sql.NullString{String: label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeNetworkProbeSummary(probe),
	}); err != nil {
		rollbackKeychainSecret(store, account, previousSecret, hadPreviousSecret)
		saveErr = fmt.Errorf("save network integration metadata: %w", err)
		return CredentialSlot{}, saveErr
	}

	return CredentialSlot{
		ID:              networkSlotID(siteID),
		Kind:            "network_integration",
		Label:           label,
		Status:          "configured",
		Capabilities:    unifi.CapabilitiesFromNetworkProbe(probe),
		Enabled:         true,
		BoundSiteID:     siteID,
		BoundSiteName:   label,
		BoundHostID:     hostID,
		MaskedSuffix:    secrets.MaskedSuffix(secret),
		LastValidatedAt: now.Format(time.RFC3339),
		ValidationError: networkKeyValidationWarning(probe),
	}, nil
}

func (a *App) validateNetworkIntegrationCredential(siteID string) (CredentialSlot, error) {
	slotID := networkSlotID(siteID)
	tracker := a.newCredentialProgressTracker(slotID)
	var validateErr error
	defer func() {
		if validateErr != nil {
			tracker.fail()
		} else {
			tracker.done()
		}
	}()

	store, err := a.secretsStore()
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	account := secrets.NetworkLocalAPIKeyAccount(siteID)
	secret, err := store.Get(account)
	if errors.Is(err, secrets.ErrNotFound) {
		validateErr = errors.New("add a key before validating")
		return CredentialSlot{}, validateErr
	}
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	probe, hostID, err := a.probeNetworkIntegrationKey(siteID, secret, tracker)
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	slot, err := a.loadNetworkIntegrationSlot(siteID)
	if err != nil {
		validateErr = err
		return CredentialSlot{}, validateErr
	}

	now := time.Now().UTC()
	tracker.step("Updating validation results", "Local database")
	if err := a.store.Queries().UpsertCredentialMeta(a.ctx, sqlc.UpsertCredentialMetaParams{
		KeyType:         networkLocalKeyType(siteID),
		Label:           sql.NullString{String: slot.Label, Valid: true},
		LastValidatedAt: sql.NullTime{Time: now, Valid: true},
		MaskedSuffix:    sql.NullString{String: secrets.MaskedSuffix(secret), Valid: true},
		ProbeSummary:    encodeNetworkProbeSummary(probe),
	}); err != nil {
		validateErr = fmt.Errorf("update network integration metadata: %w", err)
		return CredentialSlot{}, validateErr
	}

	slot.Status = "configured"
	slot.Capabilities = unifi.CapabilitiesFromNetworkProbe(probe)
	slot.MaskedSuffix = secrets.MaskedSuffix(secret)
	slot.LastValidatedAt = now.Format(time.RFC3339)
	slot.ValidationError = networkKeyValidationWarning(probe)
	slot.BoundHostID = hostID
	return slot, nil
}

func (a *App) networkClientForSite(siteID, networkKey string) (*unifi.NetworkClient, string, error) {
	hostID, err := a.resolveHostIDForSite(siteID)
	if err != nil {
		return nil, "", err
	}
	if hostID == "" {
		if _, smErr := a.siteManagerClient(); smErr != nil {
			return nil, "", fmt.Errorf("configure fleet access before adding network keys: %w", smErr)
		}
		return nil, "", fmt.Errorf("no console found for site %q", siteID)
	}

	if networkKey != "" {
		if consoleURL, urlErr := a.consoleURLForHost(hostID); urlErr == nil {
			return unifi.NewNetworkClientForLocalConsole(consoleURL, networkKey), hostID, nil
		}
	}

	sm, smErr := a.siteManagerClient()
	if smErr == nil {
		return unifi.NewNetworkClientViaConnector(sm, hostID), hostID, nil
	}
	return nil, "", fmt.Errorf("configure fleet access before adding network keys: %w", smErr)
}

func (a *App) probeNetworkIntegrationKey(siteID, networkKey string, tracker *credentialProgressTracker) (unifi.NetworkKeyProbe, string, error) {
	if tracker != nil {
		tracker.step("Looking up console for site", siteID)
	}
	hostID, err := a.resolveHostIDForSite(siteID)
	if err != nil {
		return unifi.NetworkKeyProbe{}, "", err
	}
	if hostID == "" {
		return unifi.NetworkKeyProbe{}, "", fmt.Errorf("no console found for site %q", siteID)
	}

	var directErr error
	if consoleURL, urlErr := a.consoleURLForHost(hostID); urlErr == nil {
		if tracker != nil {
			tracker.step("Trying direct console access", consoleURL)
		}
		client := unifi.NewNetworkClientForLocalConsole(consoleURL, networkKey)
		reporter := unifi.ProbeReporter(nil)
		if tracker != nil {
			reporter = tracker.probeReporter()
		}
		probe, err := client.ProbeKeyAccess(a.ctx, siteID, reporter)
		if err == nil {
			probe.NetworkKeyVerified = true
			probe.Notes = append(probe.Notes, "Validated network key via direct console access")
			return probe, hostID, nil
		}
		directErr = err
		if unifi.IsHTTPStatus(err, http.StatusUnauthorized) {
			return unifi.NetworkKeyProbe{}, "", fmt.Errorf("network integration validation failed: invalid API key (HTTP 401)")
		}
		if tracker != nil {
			tracker.skip("Direct console access unavailable", consoleURL)
		}
	} else {
		directErr = urlErr
		if tracker != nil {
			tracker.skip("Direct console access unavailable", urlErr.Error())
		}
	}

	sm, smErr := a.siteManagerClient()
	if smErr != nil {
		if directErr != nil {
			return unifi.NetworkKeyProbe{}, "", fmt.Errorf("network integration validation failed: %w", directErr)
		}
		return unifi.NetworkKeyProbe{}, "", fmt.Errorf("configure fleet access before adding network keys: %w", smErr)
	}

	if tracker != nil {
		tracker.step("Connecting via fleet connector", "api.ui.com")
	}
	client := unifi.NewNetworkClientViaConnector(sm, hostID)
	reporter := unifi.ProbeReporter(nil)
	if tracker != nil {
		reporter = tracker.probeReporter()
	}
	probe, connErr := client.ProbeKeyAccess(a.ctx, siteID, reporter)
	if connErr != nil {
		if directErr != nil {
			return unifi.NetworkKeyProbe{}, "", fmt.Errorf(
				"network integration validation failed: direct: %v; connector: %w",
				directErr,
				connErr,
			)
		}
		return unifi.NetworkKeyProbe{}, "", fmt.Errorf("network integration validation failed: %w", connErr)
	}

	probe.Notes = append(probe.Notes,
		"Site reachable via fleet connector; network key not verified directly (console unreachable from this Mac)",
	)
	probe.NetworkKeyVerified = false
	return probe, hostID, nil
}

func (a *App) resolveHostIDForSite(siteID string) (string, error) {
	meta, metaErr := a.store.Queries().GetCredentialMeta(a.ctx, keyTypeSiteManager)
	if metaErr == nil {
		if summary, err := decodeProbeSummary(meta.ProbeSummary); err != nil {
			return "", err
		} else if summary != nil {
			for _, site := range summary.Sites {
				if site.SiteID == siteID && site.HostID != "" {
					return site.HostID, nil
				}
			}
		}
	} else if !errors.Is(metaErr, sql.ErrNoRows) {
		return "", fmt.Errorf("load site manager metadata: %w", metaErr)
	}

	sm, err := a.siteManagerClient()
	if errors.Is(err, secrets.ErrNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}

	sites, err := sm.ListSites(a.ctx)
	if err != nil {
		return "", fmt.Errorf("list sites: %w", err)
	}
	for _, site := range sites {
		if site.SiteID == siteID && site.HostID != "" {
			return site.HostID, nil
		}
	}

	if hostID := a.singleHostIDFromFleet(); hostID != "" {
		return hostID, nil
	}

	return "", nil
}

func (a *App) singleHostIDFromFleet() string {
	meta, err := a.store.Queries().GetCredentialMeta(a.ctx, keyTypeSiteManager)
	if err == nil {
		if summary, decodeErr := decodeProbeSummary(meta.ProbeSummary); decodeErr == nil && summary != nil {
			hosts := make(map[string]struct{})
			for _, site := range summary.Sites {
				if site.HostID != "" {
					hosts[site.HostID] = struct{}{}
				}
			}
			if len(hosts) == 1 {
				for hostID := range hosts {
					return hostID
				}
			}
		}
	}

	sm, err := a.siteManagerClient()
	if err != nil {
		return ""
	}

	sites, err := sm.ListSites(a.ctx)
	if err != nil {
		return ""
	}
	hosts := make(map[string]struct{})
	for _, site := range sites {
		if site.HostID != "" {
			hosts[site.HostID] = struct{}{}
		}
	}
	if len(hosts) == 1 {
		for hostID := range hosts {
			return hostID
		}
	}

	hostList, err := sm.ListHosts(a.ctx)
	if err != nil || len(hostList) != 1 {
		return ""
	}
	return hostList[0].ID
}

func (a *App) consoleURLForHost(hostID string) (string, error) {
	sm, err := a.siteManagerClient()
	if err != nil {
		return "", err
	}

	host, err := sm.GetHost(a.ctx, hostID)
	if err != nil {
		return "", fmt.Errorf("load console host: %w", err)
	}

	ip := strings.TrimSpace(host.IPAddress)
	if ip == "" {
		return "", errors.New("console IP unavailable for direct network validation")
	}
	return "https://" + ip, nil
}

func (a *App) networkIntegrationLabel(siteID string) (string, error) {
	meta, err := a.store.Queries().GetCredentialMeta(a.ctx, networkLocalKeyType(siteID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return siteID, nil
		}
		return "", err
	}
	if meta.Label.Valid && meta.Label.String != "" {
		return meta.Label.String, nil
	}
	return siteID, nil
}

func (a *App) loadNetworkIntegrationSlot(siteID string) (CredentialSlot, error) {
	meta, err := a.store.Queries().GetCredentialMeta(a.ctx, networkLocalKeyType(siteID))
	if err != nil {
		return CredentialSlot{}, fmt.Errorf("load network integration metadata for site %q: %w", siteID, err)
	}
	return networkSlotFromMeta(siteID, meta), nil
}

func (a *App) loadNetworkIntegrationSlots() ([]CredentialSlot, error) {
	rows, err := a.store.Queries().ListCredentialsMeta(a.ctx)
	if err != nil {
		return nil, fmt.Errorf("list credential metadata: %w", err)
	}

	bySiteID := make(map[string]CredentialSlot)
	for _, row := range rows {
		if !strings.HasPrefix(row.KeyType, keyTypeNetworkLocal) {
			continue
		}

		siteID := strings.TrimPrefix(row.KeyType, keyTypeNetworkLocal)
		siteID = strings.TrimSpace(siteID)
		if siteID == "" {
			continue
		}

		slot := networkSlotFromMeta(siteID, row)
		existing, ok := bySiteID[siteID]
		if !ok || networkSlotRank(slot) > networkSlotRank(existing) {
			bySiteID[siteID] = slot
		}
	}

	slots := make([]CredentialSlot, 0, len(bySiteID))
	for _, slot := range bySiteID {
		slots = append(slots, slot)
	}
	sortNetworkSlots(slots)
	return slots, nil
}

func networkSlotFromMeta(siteID string, row sqlc.CredentialsMetum) CredentialSlot {
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
		slot.MaskedSuffix = row.MaskedSuffix.String
		if probe, err := decodeNetworkProbeSummary(row.ProbeSummary); err == nil && probe != nil {
			slot.Capabilities = unifi.CapabilitiesFromNetworkProbe(*probe)
			if w := networkKeyValidationWarning(*probe); w != "" {
				slot.ValidationError = w
			}
		} else {
			slot.Capabilities = []string{"device_read", "device_restart"}
		}
	}

	if row.LastValidatedAt.Valid {
		slot.LastValidatedAt = row.LastValidatedAt.Time.UTC().Format(time.RFC3339)
	}

	return slot
}

func networkSlotRank(slot CredentialSlot) int {
	switch slot.Status {
	case "configured":
		return 2
	case "invalid":
		return 1
	default:
		return 0
	}
}

func sortNetworkSlots(slots []CredentialSlot) {
	sort.Slice(slots, func(i, j int) bool {
		return strings.ToLower(slots[i].Label) < strings.ToLower(slots[j].Label)
	})
}

func dedupeDiscoveredSites(sites []DiscoveredSite) []DiscoveredSite {
	byID := make(map[string]DiscoveredSite)
	for _, site := range sites {
		siteID := strings.TrimSpace(site.SiteID)
		if siteID == "" {
			continue
		}

		label := strings.TrimSpace(site.SiteName)
		if label == "" {
			label = siteID
		}

		existing, ok := byID[siteID]
		if !ok {
			byID[siteID] = DiscoveredSite{SiteID: siteID, SiteName: label}
			continue
		}
		if len(label) > len(existing.SiteName) {
			byID[siteID] = DiscoveredSite{SiteID: siteID, SiteName: label}
		}
	}

	result := make([]DiscoveredSite, 0, len(byID))
	for _, site := range byID {
		result = append(result, site)
	}
	sort.Slice(result, func(i, j int) bool {
		return strings.ToLower(result[i].SiteName) < strings.ToLower(result[j].SiteName)
	})
	return result
}

func parseNetworkIntegrationSiteID(slotID string) (string, bool) {
	if !strings.HasPrefix(slotID, "network-integration-") {
		return "", false
	}
	siteID := strings.TrimSpace(strings.TrimPrefix(slotID, "network-integration-"))
	if siteID == "" {
		return "", false
	}
	return siteID, true
}

func encodeNetworkProbeSummary(probe unifi.NetworkKeyProbe) sql.NullString {
	raw, err := json.Marshal(probe)
	if err != nil {
		return sql.NullString{}
	}
	return sql.NullString{String: string(raw), Valid: true}
}

func decodeNetworkProbeSummary(raw sql.NullString) (*unifi.NetworkKeyProbe, error) {
	if !raw.Valid || raw.String == "" {
		return nil, nil
	}
	var probe unifi.NetworkKeyProbe
	if err := json.Unmarshal([]byte(raw.String), &probe); err != nil {
		return nil, err
	}
	return &probe, nil
}

func networkKeyValidationWarning(probe unifi.NetworkKeyProbe) string {
	if probe.NetworkKeyVerified {
		return ""
	}
	return "Network key stored but not verified directly. Revalidate on the same LAN as your console to enable device actions."
}

func rollbackKeychainSecret(store *secrets.Store, account, previousSecret string, hadPrevious bool) {
	if hadPrevious {
		_ = store.Save(account, previousSecret)
		return
	}
	_ = store.Delete(account)
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
