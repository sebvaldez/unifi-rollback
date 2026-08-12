package main

import (
	"errors"
	"sort"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"unifi-rollback/internal/secrets"
)

// CredentialEntry summarizes a stored Keychain account without exposing secret material.
type CredentialEntry struct {
	Account string `json:"account"`
}

// IsDevMode reports whether the app is running as a Wails development build.
func (a *App) IsDevMode() bool {
	if a.ctx == nil {
		return false
	}
	return runtime.Environment(a.ctx).BuildType == "dev"
}

func (a *App) requireDevMode() error {
	if !a.IsDevMode() {
		return errors.New("keychain dev tools are only available in development builds")
	}
	return nil
}

func (a *App) secretsStore() (*secrets.Store, error) {
	if a.keychain == nil {
		return nil, errors.New("keychain store not available")
	}
	return a.keychain, nil
}

// DevKeychainSave stores a credential in Keychain (development builds only).
func (a *App) DevKeychainSave(account string, secret string) error {
	if err := a.requireDevMode(); err != nil {
		return err
	}
	store, err := a.secretsStore()
	if err != nil {
		return err
	}
	return store.Save(account, secret)
}

// DevKeychainList returns Keychain account names for this app (development builds only).
func (a *App) DevKeychainList() ([]CredentialEntry, error) {
	if err := a.requireDevMode(); err != nil {
		return nil, err
	}
	store, err := a.secretsStore()
	if err != nil {
		return nil, err
	}

	accounts, err := store.ListAccounts()
	if err != nil {
		return nil, err
	}
	sort.Strings(accounts)

	entries := make([]CredentialEntry, len(accounts))
	for i, account := range accounts {
		entries[i] = CredentialEntry{Account: account}
	}
	return entries, nil
}

// DevKeychainDelete removes one credential from Keychain (development builds only).
func (a *App) DevKeychainDelete(account string) error {
	if err := a.requireDevMode(); err != nil {
		return err
	}
	store, err := a.secretsStore()
	if err != nil {
		return err
	}
	return store.Delete(account)
}

// DevKeychainWipeAll removes every credential for this app from Keychain (development builds only).
func (a *App) DevKeychainWipeAll() error {
	if err := a.requireDevMode(); err != nil {
		return err
	}
	store, err := a.secretsStore()
	if err != nil {
		return err
	}
	return store.WipeAll()
}

// DevKeychainVerify reads a credential round-trip without returning secret material (development builds only).
func (a *App) DevKeychainVerify(account string) (bool, error) {
	if err := a.requireDevMode(); err != nil {
		return false, err
	}
	store, err := a.secretsStore()
	if err != nil {
		return false, err
	}
	_, err = store.Get(account)
	if errors.Is(err, secrets.ErrNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}
