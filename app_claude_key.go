package main

import (
	"slices"
	"strings"

	"unifi-rollback/internal/secrets"
)

// claudeKeyStore is the slice of secrets.Store the Claude key gate needs.
type claudeKeyStore interface {
	ListAccounts() ([]string, error)
	Save(account string, secret string) error
}

// ClaudeKeyReady reports whether a Claude API key is saved in Keychain. It never returns the key.
func (a *App) ClaudeKeyReady() (bool, error) {
	store, err := a.secretsStore()
	if err != nil {
		return false, err
	}
	return claudeKeyReady(store)
}

// SaveClaudeKey stores the Claude API key in Keychain.
func (a *App) SaveClaudeKey(secret string) error {
	store, err := a.secretsStore()
	if err != nil {
		return err
	}
	return saveClaudeKey(store, secret)
}

func claudeKeyReady(store claudeKeyStore) (bool, error) {
	accounts, err := store.ListAccounts()
	if err != nil {
		return false, err
	}
	return slices.Contains(accounts, secrets.AccountClaudeAPIKey), nil
}

func saveClaudeKey(store claudeKeyStore, secret string) error {
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return secrets.ErrEmptySecret
	}
	return store.Save(secrets.AccountClaudeAPIKey, secret)
}
