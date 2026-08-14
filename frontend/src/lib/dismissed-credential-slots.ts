const DISMISSED_STORAGE_KEY = "unifi-fleet.dismissed-network-slots"

export function networkIntegrationSlotId(siteId: string): string {
  return `network-integration-${siteId}`
}

export function loadDismissedNetworkSlotIds(): Set<string> {
  if (typeof localStorage === "undefined") {
    return new Set()
  }
  try {
    const raw = localStorage.getItem(DISMISSED_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as string[]
    return new Set(parsed.filter((value) => typeof value === "string" && value))
  } catch {
    return new Set()
  }
}

export function saveDismissedNetworkSlotIds(ids: Set<string>): void {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify(Array.from(ids)))
}

export function dismissNetworkSlot(slotId: string): void {
  const dismissed = loadDismissedNetworkSlotIds()
  dismissed.add(slotId)
  saveDismissedNetworkSlotIds(dismissed)
}

export function undismissNetworkSlot(slotId: string): void {
  const dismissed = loadDismissedNetworkSlotIds()
  dismissed.delete(slotId)
  saveDismissedNetworkSlotIds(dismissed)
}

export function isDismissedNetworkSlot(slotId: string): boolean {
  return loadDismissedNetworkSlotIds().has(slotId)
}

export function filterVisibleCredentialSlots<T extends { id: string }>(
  slots: T[]
): T[] {
  const dismissed = loadDismissedNetworkSlotIds()
  return slots.filter((slot) => !dismissed.has(slot.id))
}

export function dedupeDiscoveredSites(
  sites: { siteId: string; siteName: string }[]
): { siteId: string; siteName: string }[] {
  const byId = new Map<string, { siteId: string; siteName: string }>()
  for (const site of sites) {
    const siteId = site.siteId.trim()
    if (!siteId) continue
    const siteName = site.siteName.trim() || siteId
    const existing = byId.get(siteId)
    if (!existing || siteName.length > existing.siteName.length) {
      byId.set(siteId, { siteId, siteName })
    }
  }
  return Array.from(byId.values())
}
