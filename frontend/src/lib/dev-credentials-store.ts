import type {
  CredentialCapability,
  CredentialSlot,
  CredentialSlotKind,
  SaveCredentialRequest,
} from "@/types/credentials"

const STORAGE_KEY = "unifi-fleet.dev-credentials"

const DEFAULT_SLOTS: CredentialSlot[] = [
  {
    id: "site-manager-primary",
    kind: "site_manager",
    label: "Fleet access",
    status: "unconfigured",
    capabilities: [],
    enabled: true,
  },
]

/** In-memory store until Keychain + Go validation probes land. */
const savedBySlotId = new Map<string, CredentialSlot>()

function siteSlotId(siteId: string): string {
  return `network-integration-${siteId}`
}

function maskSuffix(secret: string): string {
  const trimmed = secret.trim()
  if (trimmed.length <= 4) return trimmed
  return trimmed.slice(-4)
}

function capabilitiesForKind(kind: CredentialSlotKind): CredentialCapability[] {
  switch (kind) {
    case "site_manager":
      return ["inventory"]
    case "network_integration":
      return ["device_read", "device_restart"]
    case "classic_admin":
      return ["device_locate"]
    case "llm_claude":
    case "llm_openai":
      return ["llm_chat"]
    default:
      return []
  }
}

function mergeWithDefaults(slots: CredentialSlot[]): CredentialSlot[] {
  const byId = new Map(slots.map((slot) => [slot.id, slot]))
  for (const slot of DEFAULT_SLOTS) {
    if (!byId.has(slot.id)) {
      byId.set(slot.id, slot)
    }
  }
  return Array.from(byId.values())
}

function persistDevCredentials(): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(Object.fromEntries(savedBySlotId.entries()))
  )
}

function hydrateDevCredentials(): void {
  if (typeof localStorage === "undefined") return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, CredentialSlot>
    savedBySlotId.clear()
    for (const [id, slot] of Object.entries(parsed)) {
      savedBySlotId.set(id, slot)
    }
  } catch {
    savedBySlotId.clear()
  }
}

hydrateDevCredentials()

/** Reload persisted credentials — used by tests after mutating localStorage. */
export function reloadDevCredentialsFromStorage(): void {
  hydrateDevCredentials()
}

/** Test helper — clears persisted dev credentials. */
export function resetDevCredentialStore(): void {
  savedBySlotId.clear()
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(STORAGE_KEY)
  }
}

export function listDevCredentialSlots(): CredentialSlot[] {
  return mergeWithDefaults(Array.from(savedBySlotId.values()))
}

/** Create unconfigured Network Integration rows for sites seen in inventory. */
export function syncDevSiteCredentialSlots(
  sites: { siteId: string; siteName: string }[]
): CredentialSlot[] {
  for (const { siteId, siteName } of sites) {
    const id = siteSlotId(siteId)
    const existing = savedBySlotId.get(id)
    if (existing) {
      if (existing.boundSiteName !== siteName) {
        savedBySlotId.set(id, { ...existing, boundSiteName: siteName, label: siteName })
      }
      continue
    }

    savedBySlotId.set(id, {
      id,
      kind: "network_integration",
      label: siteName,
      status: "unconfigured",
      capabilities: [],
      enabled: true,
      boundSiteId: siteId,
      boundSiteName: siteName,
    })
  }

  persistDevCredentials()
  return listDevCredentialSlots()
}

export function saveDevCredential(
  request: SaveCredentialRequest
): CredentialSlot {
  const slots = listDevCredentialSlots()
  const slot = slots.find((entry) => entry.id === request.slotId)
  if (!slot) {
    throw new Error("Unknown credential slot")
  }

  const secret = request.secret.trim()
  if (!secret) {
    throw new Error("API key cannot be empty")
  }

  const updated: CredentialSlot = {
    ...slot,
    label: request.label?.trim() || slot.label,
    status: "configured",
    capabilities: capabilitiesForKind(slot.kind),
    maskedSuffix: maskSuffix(secret),
    lastValidatedAt: new Date().toISOString(),
    validationError: undefined,
  }

  savedBySlotId.set(updated.id, updated)
  persistDevCredentials()
  return updated
}

export function validateDevCredential(slotId: string): CredentialSlot {
  const slot =
    savedBySlotId.get(slotId) ??
    listDevCredentialSlots().find((entry) => entry.id === slotId)
  if (!slot) {
    throw new Error("Unknown credential slot")
  }
  if (slot.status !== "configured") {
    throw new Error("Add a key before validating")
  }

  const updated: CredentialSlot = {
    ...slot,
    status: "configured",
    capabilities: capabilitiesForKind(slot.kind),
    lastValidatedAt: new Date().toISOString(),
    validationError: undefined,
  }

  savedBySlotId.set(updated.id, updated)
  persistDevCredentials()
  return updated
}

export function removeDevCredential(slotId: string): void {
  const slot =
    savedBySlotId.get(slotId) ?? DEFAULT_SLOTS.find((entry) => entry.id === slotId)
  if (!slot) {
    throw new Error("Unknown credential slot")
  }

  savedBySlotId.delete(slotId)
  persistDevCredentials()
}
