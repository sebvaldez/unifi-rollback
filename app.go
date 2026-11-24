package main

import (
	"context"
	"errors"

	"github.com/wailsapp/wails/v3/pkg/application"
	"unifi-rollback/internal/secrets"
	"unifi-rollback/internal/settings"
	"unifi-rollback/internal/store"
	"unifi-rollback/internal/store/sqlc"
)

// App is the bound Wails service. It owns the SQLite store and the Keychain store.
type App struct {
	wails    *application.App
	ctx      context.Context
	store    *store.Store
	keychain *secrets.Store
}

// NewApp creates the bound service. wails is used for events and is nil in tests.
func NewApp(wails *application.App) *App {
	return &App{wails: wails}
}

// ServiceStartup opens the local database. A database error leaves the service
// running so DatabaseReady can report it, matching the previous startup path.
func (a *App) ServiceStartup(ctx context.Context, _ application.ServiceOptions) error {
	a.ctx = ctx
	a.keychain = secrets.NewStore()

	s, err := store.OpenDefault()
	if err != nil {
		println("database error:", err.Error())
		return nil
	}
	a.store = s
	return nil
}

// ServiceShutdown closes resources opened during startup.
func (a *App) ServiceShutdown() error {
	if a.store != nil {
		_ = a.store.Close()
		a.store = nil
	}
	return nil
}

// DatabasePath returns the path to the local SQLite database file.
func (a *App) DatabasePath() string {
	if a.store == nil {
		return ""
	}
	return a.store.Path()
}

// DatabaseReady reports whether the local database opened successfully.
func (a *App) DatabaseReady() bool {
	if a.store == nil {
		return false
	}
	return a.store.Ping() == nil
}

// GetDeviceSettings returns persisted device inventory refresh preferences.
func (a *App) GetDeviceSettings() (settings.DeviceSettings, error) {
	if a.store == nil {
		return settings.DeviceSettings{}, errors.New("database not available")
	}
	return settings.LoadDeviceSettings(a.ctx, a.store.Queries())
}

// SaveDeviceSettings validates and persists device inventory refresh preferences.
func (a *App) SaveDeviceSettings(s settings.DeviceSettings) error {
	if a.store == nil {
		return errors.New("database not available")
	}
	return a.store.WithTx(func(q *sqlc.Queries) error {
		return settings.SaveDeviceSettings(a.ctx, q, s)
	})
}
