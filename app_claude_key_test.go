package main

import (
	"errors"
	"testing"

	"unifi-rollback/internal/secrets"
)

type fakeClaudeKeyStore struct {
	accounts map[string]string
	listErr  error
}

func (f *fakeClaudeKeyStore) ListAccounts() ([]string, error) {
	if f.listErr != nil {
		return nil, f.listErr
	}
	names := make([]string, 0, len(f.accounts))
	for name := range f.accounts {
		names = append(names, name)
	}
	return names, nil
}

func (f *fakeClaudeKeyStore) Save(account string, secret string) error {
	if f.accounts == nil {
		f.accounts = map[string]string{}
	}
	f.accounts[account] = secret
	return nil
}

func TestClaudeKeyReady(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		store *fakeClaudeKeyStore
		want  bool
	}{
		{"empty store", &fakeClaudeKeyStore{}, false},
		{"other accounts only", &fakeClaudeKeyStore{accounts: map[string]string{secrets.AccountSiteManagerAPIKey: "x"}}, false},
		{"claude key saved", &fakeClaudeKeyStore{accounts: map[string]string{secrets.AccountClaudeAPIKey: "x"}}, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, err := claudeKeyReady(tt.store)
			if err != nil {
				t.Fatalf("claudeKeyReady() error = %v", err)
			}
			if got != tt.want {
				t.Fatalf("claudeKeyReady() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestClaudeKeyReadyPropagatesListError(t *testing.T) {
	t.Parallel()

	want := errors.New("keychain locked")
	got, err := claudeKeyReady(&fakeClaudeKeyStore{listErr: want})
	if !errors.Is(err, want) || got {
		t.Fatalf("claudeKeyReady() = %v, %v; want false, %v", got, err, want)
	}
}

func TestSaveClaudeKeyTrimsAndStores(t *testing.T) {
	t.Parallel()

	store := &fakeClaudeKeyStore{}
	if err := saveClaudeKey(store, "  sk-ant-test  \n"); err != nil {
		t.Fatalf("saveClaudeKey() error = %v", err)
	}
	if got := store.accounts[secrets.AccountClaudeAPIKey]; got != "sk-ant-test" {
		t.Fatalf("stored secret = %q, want trimmed value", got)
	}
	ready, err := claudeKeyReady(store)
	if err != nil || !ready {
		t.Fatalf("claudeKeyReady() after save = %v, %v; want true, nil", ready, err)
	}
}

func TestSaveClaudeKeyRejectsEmpty(t *testing.T) {
	t.Parallel()

	store := &fakeClaudeKeyStore{}
	if err := saveClaudeKey(store, "   "); !errors.Is(err, secrets.ErrEmptySecret) {
		t.Fatalf("saveClaudeKey(blank) error = %v, want ErrEmptySecret", err)
	}
	if len(store.accounts) != 0 {
		t.Fatal("blank secret must not be stored")
	}
}

func TestClaudeKeyMethodsErrorWithoutKeychain(t *testing.T) {
	t.Parallel()

	app := &App{}
	if _, err := app.ClaudeKeyReady(); err == nil {
		t.Fatal("ClaudeKeyReady() with nil keychain should error")
	}
	if err := app.SaveClaudeKey("sk-ant-test"); err == nil {
		t.Fatal("SaveClaudeKey() with nil keychain should error")
	}
}
