//go:build darwin

package secrets

import (
	"fmt"
	"testing"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	return NewStoreWithService(fmt.Sprintf("%s.test.%s", ServiceName, t.Name()))
}

func TestStoreSaveGetDeleteRoundTrip(t *testing.T) {
	store := testStore(t)
	account := fmt.Sprintf("test-roundtrip-%s", t.Name())
	secret := "dev-test-secret-value"

	t.Cleanup(func() {
		_ = store.Delete(account)
	})

	if err := store.Save(account, secret); err != nil {
		t.Fatalf("Save() error = %v", err)
	}

	got, err := store.Get(account)
	if err != nil {
		t.Fatalf("Get() error = %v", err)
	}
	if got != secret {
		t.Fatalf("Get() = %q, want %q", got, secret)
	}

	if err := store.Save(account, "updated-secret"); err != nil {
		t.Fatalf("Save(update) error = %v", err)
	}
	got, err = store.Get(account)
	if err != nil {
		t.Fatalf("Get(after update) error = %v", err)
	}
	if got != "updated-secret" {
		t.Fatalf("Get(after update) = %q, want updated-secret", got)
	}

	if err := store.Save(account, secret); err != nil {
		t.Fatalf("Save(re-save same account) error = %v", err)
	}
	got, err = store.Get(account)
	if err != nil {
		t.Fatalf("Get(after re-save) error = %v", err)
	}
	if got != secret {
		t.Fatalf("Get(after re-save) = %q, want %q", got, secret)
	}

	if err := store.Delete(account); err != nil {
	 t.Fatalf("Delete() error = %v", err)
	}
	if _, err := store.Get(account); err != ErrNotFound {
		t.Fatalf("Get(after delete) error = %v, want ErrNotFound", err)
	}
}

func TestStoreWipeAll(t *testing.T) {
	store := testStore(t)
	accounts := []string{
		fmt.Sprintf("test-wipe-a-%s", t.Name()),
		fmt.Sprintf("test-wipe-b-%s", t.Name()),
	}

	t.Cleanup(func() {
		_ = store.WipeAll()
	})

	for i, account := range accounts {
		if err := store.Save(account, fmt.Sprintf("secret-%d", i)); err != nil {
			t.Fatalf("Save(%q) error = %v", account, err)
		}
	}

	listed, err := store.ListAccounts()
	if err != nil {
		t.Fatalf("ListAccounts() error = %v", err)
	}
	found := 0
	for _, account := range accounts {
		for _, listedAccount := range listed {
			if listedAccount == account {
				found++
			}
		}
	}
	if found != len(accounts) {
		t.Fatalf("ListAccounts found %d test accounts, want %d", found, len(accounts))
	}

	if err := store.WipeAll(); err != nil {
		t.Fatalf("WipeAll() error = %v", err)
	}

	for _, account := range accounts {
		if _, err := store.Get(account); err != ErrNotFound {
			t.Fatalf("Get(%q) after WipeAll error = %v, want ErrNotFound", account, err)
		}
	}
}

func TestStoreValidation(t *testing.T) {
	store := testStore(t)

	if err := store.Save("", "secret"); err != ErrEmptyAccount {
		t.Fatalf("Save(empty account) error = %v, want ErrEmptyAccount", err)
	}
	if err := store.Save("account", ""); err != ErrEmptySecret {
		t.Fatalf("Save(empty secret) error = %v, want ErrEmptySecret", err)
	}
	if _, err := store.Get(""); err != ErrEmptyAccount {
		t.Fatalf("Get(empty account) error = %v, want ErrEmptyAccount", err)
	}
	if err := store.Delete("definitely-missing-account-for-test"); err != ErrNotFound {
		t.Fatalf("Delete(missing) error = %v, want ErrNotFound", err)
	}
}
