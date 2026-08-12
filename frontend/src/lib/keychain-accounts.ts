export const KEYCHAIN_KNOWN_ACCOUNTS = [
  "site-manager-api-key",
  "claude-api-key",
  "openai-api-key",
  "network-local-api-key:default",
  "device-ssh:aa:bb:cc:dd:ee:ff",
] as const

export type KeychainKnownAccount = (typeof KEYCHAIN_KNOWN_ACCOUNTS)[number]
