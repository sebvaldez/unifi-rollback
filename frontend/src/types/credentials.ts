/** Credential slot kinds stored in Keychain + credentials_meta. */
export type CredentialSlotKind =
  | "site_manager"
  | "network_integration"
  | "classic_admin"
  | "llm_claude"
  | "llm_openai"

export type CredentialStatus =
  | "unconfigured"
  | "configured"
  | "invalid"
  | "validating"

/** Capabilities derived from validation probes — not user-selected scopes. */
export type CredentialCapability =
  | "inventory"
  | "connector_proxy"
  | "device_read"
  | "device_restart"
  | "device_locate"
  | "rollback_ssh"
  | "llm_chat"

export type CredentialSlot = {
  id: string
  kind: CredentialSlotKind
  label: string
  status: CredentialStatus
  capabilities: CredentialCapability[]
  /** When false, slot is excluded from fleet merge (multi site-manager v2). */
  enabled: boolean
  boundSiteId?: string
  boundSiteName?: string
  boundHostId?: string
  maskedSuffix?: string
  lastValidatedAt?: string
  validationError?: string
  validationSummary?: ValidationSummary
}

export type ProbedSiteSummary = {
  siteId: string
  siteName: string
  hostId?: string
  permission?: string
}

export type ValidationSummary = {
  sites: ProbedSiteSummary[]
  applicationsObserved: string[]
  hostCount: number
  deviceCount: number
  notes?: string[]
}

export const APPLICATION_LABELS: Record<string, string> = {
  network: "Network",
  protect: "Protect",
  access: "Access",
  talk: "Talk",
  connect: "Connect",
  innerspace: "InnerSpace",
}

export type SaveCredentialRequest = {
  slotId: string
  secret: string
  label?: string
}

export const CREDENTIAL_CAPABILITY_LABELS: Record<CredentialCapability, string> =
  {
    inventory: "Fleet inventory",
    connector_proxy: "Remote console access",
    device_read: "Device details",
    device_restart: "Restart devices",
    device_locate: "Locate (LED blink)",
    rollback_ssh: "Firmware rollback",
    llm_chat: "AI assistant",
  }

export const CREDENTIAL_KIND_LABELS: Record<CredentialSlotKind, string> = {
  site_manager: "Fleet access",
  network_integration: "Device control",
  classic_admin: "Classic admin (locate)",
  llm_claude: "Claude",
  llm_openai: "OpenAI",
}
