package main

import (
	"context"
	"errors"

	"unifi-rollback/internal/settings"
	"unifi-rollback/internal/store"
	"unifi-rollback/internal/store/sqlc"
)

// App struct
type App struct {
	ctx   context.Context
	store *store.Store
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	s, err := store.OpenDefault()
	if err != nil {
		println("database error:", err.Error())
		return
	}
	a.store = s
}

// shutdown closes resources opened during startup.
func (a *App) shutdown(ctx context.Context) {
	if a.store != nil {
		_ = a.store.Close()
		a.store = nil
	}
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
