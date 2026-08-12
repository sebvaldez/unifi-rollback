package main

import (
	"context"
	"fmt"

	"unifi-rollback/internal/store"
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

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
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
