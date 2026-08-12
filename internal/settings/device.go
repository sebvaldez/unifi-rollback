package settings

import (
	"context"
	"database/sql"
	"fmt"
	"strconv"
	"time"

	"unifi-rollback/internal/store/sqlc"
)

const (
	PrefDeviceRefreshMode      = "device_refresh_mode"
	PrefDevicePollInterval     = "device_poll_interval_seconds"
	PrefDeviceRefreshOnStartup = "device_refresh_on_startup"

	MinPollIntervalSeconds     = 15
	DefaultPollIntervalSeconds = 60
)

// RefreshMode controls how device inventory is refreshed.
type RefreshMode string

const (
	RefreshModeManual RefreshMode = "manual"
	RefreshModePoll   RefreshMode = "poll"
)

// DeviceSettings controls how device inventory is refreshed.
type DeviceSettings struct {
	RefreshMode         RefreshMode `json:"refreshMode"`
	PollIntervalSeconds int         `json:"pollIntervalSeconds"`
	RefreshOnStartup    bool        `json:"refreshOnStartup"`
}

// DefaultDeviceSettings returns the initial device settings.
func DefaultDeviceSettings() DeviceSettings {
	return DeviceSettings{
		RefreshMode:         RefreshModeManual,
		PollIntervalSeconds: DefaultPollIntervalSeconds,
		RefreshOnStartup:    false,
	}
}

// LoadDeviceSettings reads device settings from preferences, falling back to defaults.
func LoadDeviceSettings(ctx context.Context, q *sqlc.Queries) (DeviceSettings, error) {
	defaults := DefaultDeviceSettings()

	mode, err := readStringPref(ctx, q, PrefDeviceRefreshMode, string(defaults.RefreshMode))
	if err != nil {
		return DeviceSettings{}, err
	}

	interval, err := readIntPref(ctx, q, PrefDevicePollInterval, defaults.PollIntervalSeconds)
	if err != nil {
		return DeviceSettings{}, err
	}

	onStartup, err := readBoolPref(ctx, q, PrefDeviceRefreshOnStartup, defaults.RefreshOnStartup)
	if err != nil {
		return DeviceSettings{}, err
	}

	settings := DeviceSettings{
		RefreshMode:         RefreshMode(mode),
		PollIntervalSeconds: interval,
		RefreshOnStartup:    onStartup,
	}

	if err := ValidateDeviceSettings(settings); err != nil {
		return DeviceSettings{}, fmt.Errorf("invalid stored device settings: %w", err)
	}

	return settings, nil
}

// SaveDeviceSettings validates and persists device settings to preferences.
func SaveDeviceSettings(ctx context.Context, q *sqlc.Queries, settings DeviceSettings) error {
	if err := ValidateDeviceSettings(settings); err != nil {
		return err
	}

	now := sql.NullTime{Time: time.Now().UTC(), Valid: true}

	prefs := []sqlc.UpsertPreferenceParams{
		{Key: PrefDeviceRefreshMode, Value: string(settings.RefreshMode), UpdatedAt: now},
		{Key: PrefDevicePollInterval, Value: strconv.Itoa(settings.PollIntervalSeconds), UpdatedAt: now},
		{Key: PrefDeviceRefreshOnStartup, Value: strconv.FormatBool(settings.RefreshOnStartup), UpdatedAt: now},
	}

	for _, pref := range prefs {
		if err := q.UpsertPreference(ctx, pref); err != nil {
			return fmt.Errorf("upsert preference %q: %w", pref.Key, err)
		}
	}

	return nil
}

// ValidateDeviceSettings checks device settings before save.
func ValidateDeviceSettings(settings DeviceSettings) error {
	switch settings.RefreshMode {
	case RefreshModeManual, RefreshModePoll:
	default:
		return fmt.Errorf("refresh mode must be %q or %q", RefreshModeManual, RefreshModePoll)
	}

	if settings.PollIntervalSeconds < MinPollIntervalSeconds {
		return fmt.Errorf("poll interval must be at least %d seconds", MinPollIntervalSeconds)
	}

	return nil
}

func readStringPref(ctx context.Context, q *sqlc.Queries, key, fallback string) (string, error) {
	pref, err := q.GetPreference(ctx, key)
	if err == sql.ErrNoRows {
		return fallback, nil
	}
	if err != nil {
		return "", fmt.Errorf("get preference %q: %w", key, err)
	}
	if pref.Value == "" {
		return fallback, nil
	}
	return pref.Value, nil
}

func readIntPref(ctx context.Context, q *sqlc.Queries, key string, fallback int) (int, error) {
	raw, err := readStringPref(ctx, q, key, strconv.Itoa(fallback))
	if err != nil {
		return 0, err
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback, nil
	}
	return value, nil
}

func readBoolPref(ctx context.Context, q *sqlc.Queries, key string, fallback bool) (bool, error) {
	raw, err := readStringPref(ctx, q, key, strconv.FormatBool(fallback))
	if err != nil {
		return false, err
	}

	value, err := strconv.ParseBool(raw)
	if err != nil {
		return fallback, nil
	}
	return value, nil
}
