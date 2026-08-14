package secrets

import (
	"errors"
	"strings"

	keychain "github.com/keybase/go-keychain"
)

var (
	ErrNotFound     = errors.New("secret not found")
	ErrEmptyAccount = errors.New("account is required")
	ErrEmptySecret  = errors.New("secret is required")
)

// Store wraps macOS Keychain access for this application's service namespace.
type Store struct {
	service string
}

// NewStore returns a Store using the default service name.
func NewStore() *Store {
	return NewStoreWithService(ServiceName)
}

// NewStoreWithService returns a Store scoped to the given Keychain service name.
func NewStoreWithService(service string) *Store {
	return &Store{service: service}
}

// Save stores secret material under account, replacing any existing item.
func (s *Store) Save(account string, secret string) error {
	account = strings.TrimSpace(account)
	secret = strings.TrimSpace(secret)
	if account == "" {
		return ErrEmptyAccount
	}
	if secret == "" {
		return ErrEmptySecret
	}

	item := keychain.NewGenericPassword(s.service, account, account, []byte(secret), "")
	item.SetSynchronizable(keychain.SynchronizableNo)
	item.SetAccessible(keychain.AccessibleWhenUnlockedThisDeviceOnly)

	err := keychain.AddItem(item)
	if err == keychain.ErrorDuplicateItem {
		query := keychain.NewItem()
		query.SetSecClass(keychain.SecClassGenericPassword)
		query.SetService(s.service)
		query.SetAccount(account)
		query.SetLabel(account)

		update := keychain.NewItem()
		update.SetData([]byte(secret))
		return keychain.UpdateItem(query, update)
	}
	return err
}

// Get returns secret material for account.
func (s *Store) Get(account string) (string, error) {
	account = strings.TrimSpace(account)
	if account == "" {
		return "", ErrEmptyAccount
	}

	data, err := keychain.GetGenericPassword(s.service, account, account, "")
	if err != nil {
		return "", err
	}
	if data == nil {
		return "", ErrNotFound
	}
	return string(data), nil
}

// Delete removes the Keychain item for account.
func (s *Store) Delete(account string) error {
	account = strings.TrimSpace(account)
	if account == "" {
		return ErrEmptyAccount
	}

	err := keychain.DeleteItem(s.deleteAccountItem(account))
	if err == nil {
		return nil
	}
	if err == keychain.ErrorItemNotFound {
		return ErrNotFound
	}
	return wrapKeychainErr("delete keychain item", err)
}

// ListAccounts returns account names stored under this service.
func (s *Store) ListAccounts() ([]string, error) {
	return s.listAccountItems()
}

// MaskedSuffix returns the last four characters of secret for display metadata.
func MaskedSuffix(secret string) string {
	secret = strings.TrimSpace(secret)
	if len(secret) <= 4 {
		return secret
	}
	return secret[len(secret)-4:]
}
