package secrets

import (
	"errors"
	"fmt"
	"strings"

	keychain "github.com/keybase/go-keychain"
)

// KeychainError wraps macOS Security framework status codes for clearer UI messages.
type KeychainError struct {
	Op     string
	Status int
	Msg    string
}

func (e *KeychainError) Error() string {
	if e.Msg != "" {
		return fmt.Sprintf("%s: %s (%d)", e.Op, e.Msg, e.Status)
	}
	return fmt.Sprintf("%s: Keychain error (%d)", e.Op, e.Status)
}

func wrapKeychainErr(op string, err error) error {
	if err == nil {
		return nil
	}
	var kcErr keychain.Error
	if errors.As(err, &kcErr) {
		return &KeychainError{
			Op:     op,
			Status: int(kcErr),
			Msg:    kcErr.Error(),
		}
	}
	return fmt.Errorf("%s: %w", op, err)
}

func deleteItem(item keychain.Item) error {
	return wrapKeychainErr("delete keychain item", keychain.DeleteItem(item))
}

func queryItem(item keychain.Item) ([]keychain.QueryResult, error) {
	results, err := keychain.QueryItem(item)
	return results, wrapKeychainErr("query keychain", err)
}

// deleteAccountItem builds the attribute set used when items are saved.
func (s *Store) deleteAccountItem(account string) keychain.Item {
	item := keychain.NewItem()
	item.SetSecClass(keychain.SecClassGenericPassword)
	item.SetService(s.service)
	item.SetAccount(account)
	item.SetLabel(account)
	return item
}

// WipeAll deletes every generic password item for this service namespace.
func (s *Store) WipeAll() error {
	accounts, err := s.listAccountItems()
	if err != nil {
		return err
	}

	var errs []error
	for _, account := range accounts {
		if err := s.Delete(account); err != nil && !errors.Is(err, ErrNotFound) {
			errs = append(errs, fmt.Errorf("delete %q: %w", account, err))
		}
	}
	return errors.Join(errs...)
}

// listAccountItems returns account names by querying Keychain attributes directly.
func (s *Store) listAccountItems() ([]string, error) {
	query := keychain.NewItem()
	query.SetSecClass(keychain.SecClassGenericPassword)
	query.SetService(s.service)
	query.SetMatchLimit(keychain.MatchLimitAll)
	query.SetReturnAttributes(true)

	results, err := queryItem(query)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return []string{}, nil
	}

	accounts := make([]string, 0, len(results))
	for _, result := range results {
		account := strings.TrimSpace(result.Account)
		if account == "" {
			account = strings.TrimSpace(result.Label)
		}
		if account != "" {
			accounts = append(accounts, account)
		}
	}
	return accounts, nil
}
