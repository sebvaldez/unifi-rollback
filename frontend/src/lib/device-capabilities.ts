import type { CredentialSlot } from "@/types/credentials"
import type { Device, DeviceCapabilities } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

/** Merge fleet-wide and per-site credential capabilities onto a device row. */
export function resolveDeviceCapabilities(
  device: Pick<Device, "siteId" | "status">,
  slots: CredentialSlot[]
): DeviceCapabilities {
  const online = device.status === "online"
  const caps: DeviceCapabilities = { ...EMPTY_DEVICE_CAPABILITIES }

  const siteManager = slots.find(
    (s) => s.kind === "site_manager" && s.enabled && s.status === "configured"
  )
  if (siteManager) {
    caps.inventory = siteManager.capabilities.includes("inventory")
  }

  // Restart comes from the fleet connector probe (Site Manager key only). The
  // optional per-site LAN key can add it but never removes it.
  const connectorRestart =
    siteManager?.validationSummary?.sites
      .find((site) => site.siteId === device.siteId)
      ?.capabilities?.includes("device_restart") ?? false
  const network = slots.find(
    (s) =>
      s.kind === "network_integration" &&
      s.enabled &&
      s.status === "configured" &&
      s.boundSiteId === device.siteId
  )
  const lanRestart = network?.capabilities.includes("device_restart") ?? false
  if (online) {
    caps.restart = connectorRestart || lanRestart
  }

  const classic = slots.find(
    (s) =>
      s.kind === "classic_admin" &&
      s.enabled &&
      s.status === "configured" &&
      (!s.boundSiteId || s.boundSiteId === device.siteId)
  )
  if (classic && online) {
    caps.locate = classic.capabilities.includes("device_locate")
  }

  // Rollback needs SSH credential per device (future) — stub false until wired
  caps.rollback = false

  return caps
}

export function applyCapabilitiesToDevices(
  devices: Device[],
  slots: CredentialSlot[]
): Device[] {
  return devices.map((device) => ({
    ...device,
    capabilities: resolveDeviceCapabilities(device, slots),
  }))
}

export function sitesFromDevices(
  devices: Device[]
): Map<string, string> {
  const bySite = new Map<string, string>()
  for (const device of devices) {
    bySite.set(device.siteId, device.site)
  }
  return bySite
}

export function uniqueSitesFromDevices(
  devices: Device[]
): { siteId: string; siteName: string }[] {
  return Array.from(sitesFromDevices(devices), ([siteId, siteName]) => ({
    siteId,
    siteName,
  }))
}

/** Sites in inventory where neither the fleet connector nor a LAN key grants restart. */
export function sitesWithoutRestartAccess(
  devices: Device[],
  slots: CredentialSlot[]
): { siteId: string; siteName: string }[] {
  const missing: { siteId: string; siteName: string }[] = []
  for (const [siteId, siteName] of sitesFromDevices(devices)) {
    const { restart } = resolveDeviceCapabilities(
      { siteId, status: "online" },
      slots
    )
    if (!restart) {
      missing.push({ siteId, siteName })
    }
  }
  return missing
}

export function hasFleetInventoryAccess(slots: CredentialSlot[]): boolean {
  return slots.some(
    (s) =>
      s.kind === "site_manager" &&
      s.enabled &&
      s.status === "configured" &&
      s.capabilities.includes("inventory")
  )
}
