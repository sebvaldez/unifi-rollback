package settings

import (
	"context"
	"path/filepath"
	"testing"

	"unifi-rollback/internal/store"
	"unifi-rollback/internal/store/sqlc"
)

func TestDeviceSettingsDefaults(t *testing.T) {
	t.Parallel()

	defaults := DefaultDeviceSettings()
	if defaults.RefreshMode != RefreshModeManual {
		t.Fatalf("RefreshMode = %q, want manual", defaults.RefreshMode)
	}
	if defaults.PollIntervalSeconds != DefaultPollIntervalSeconds {
		t.Fatalf("PollIntervalSeconds = %d, want %d", defaults.PollIntervalSeconds, DefaultPollIntervalSeconds)
	}
}

func TestSaveAndLoadDeviceSettings(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "test.db")
	s, err := store.Open(path)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	q := s.Queries()

	want := DeviceSettings{
		RefreshMode:         RefreshModePoll,
		PollIntervalSeconds: 30,
		RefreshOnStartup:    true,
	}

	if err := SaveDeviceSettings(ctx, q, want); err != nil {
		t.Fatalf("SaveDeviceSettings() error = %v", err)
	}

	got, err := LoadDeviceSettings(ctx, q)
	if err != nil {
		t.Fatalf("LoadDeviceSettings() error = %v", err)
	}
	if got != want {
		t.Fatalf("LoadDeviceSettings() = %+v, want %+v", got, want)
	}
}

func TestLoadDeviceSettingsRejectsInvalidStored(t *testing.T) {
	t.Parallel()

	path := filepath.Join(t.TempDir(), "test.db")
	s, err := store.Open(path)
	if err != nil {
		t.Fatalf("Open() error = %v", err)
	}
	t.Cleanup(func() { _ = s.Close() })

	ctx := context.Background()
	if err := s.Queries().UpsertPreference(ctx, sqlc.UpsertPreferenceParams{
		Key:   PrefDeviceRefreshMode,
		Value: "auto",
	}); err != nil {
		t.Fatalf("UpsertPreference() error = %v", err)
	}

	_, err = LoadDeviceSettings(ctx, s.Queries())
	if err == nil {
		t.Fatal("LoadDeviceSettings() error = nil, want invalid stored settings error")
	}
}

func TestValidateDeviceSettings(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		settings DeviceSettings
		wantErr bool
	}{
		{
			name: "valid manual",
			settings: DeviceSettings{
				RefreshMode:         RefreshModeManual,
				PollIntervalSeconds: 15,
			},
		},
		{
			name: "valid poll",
			settings: DeviceSettings{
				RefreshMode:         RefreshModePoll,
				PollIntervalSeconds: 60,
			},
		},
		{
			name: "invalid mode",
			settings: DeviceSettings{
				RefreshMode:         RefreshMode("auto"),
				PollIntervalSeconds: 30,
			},
			wantErr: true,
		},
		{
			name: "interval too low",
			settings: DeviceSettings{
				RefreshMode:         RefreshModePoll,
				PollIntervalSeconds: 10,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateDeviceSettings(tt.settings)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateDeviceSettings() error = %v, wantErr = %v", err, tt.wantErr)
			}
		})
	}
}
