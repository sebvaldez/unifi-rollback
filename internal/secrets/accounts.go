package secrets

// ServiceName is the Keychain service namespace for this app.
const ServiceName = "com.wails.unifi-rollback"

// Well-known Keychain account identifiers (SPEC §5.2).
const (
	AccountSiteManagerAPIKey = "site-manager-api-key"
	AccountClaudeAPIKey      = "claude-api-key"
	AccountOpenAIAPIKey      = "openai-api-key"
)

// KnownAccounts lists account names used in dev tooling and validation.
var KnownAccounts = []string{
	AccountSiteManagerAPIKey,
	AccountClaudeAPIKey,
	AccountOpenAIAPIKey,
}

// NetworkLocalAPIKeyAccount returns the account id for a per-site Network API key.
func NetworkLocalAPIKeyAccount(siteID string) string {
	return "network-local-api-key:" + siteID
}

// DeviceSSHAccount returns the account id for a per-device SSH credential.
func DeviceSSHAccount(mac string) string {
	return "device-ssh:" + mac
}
