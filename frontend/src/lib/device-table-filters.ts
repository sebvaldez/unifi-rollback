import { uniqueSitesFromDevices } from "@/lib/device-capabilities"
import { isGhostDevice, type Device, type DeviceStatus } from "@/types/inventory"

export type DeviceStatusFilter = "all" | DeviceStatus | "out-of-scope"

export type DeviceTableFilters = {
  search: string
  siteId: "all" | string
  model: "all" | string
  status: DeviceStatusFilter
  showHidden: boolean
}

export const DEFAULT_DEVICE_TABLE_FILTERS: DeviceTableFilters = {
  search: "",
  siteId: "all",
  model: "all",
  status: "all",
  showHidden: false,
}

export type SiteFilterOption = {
  siteId: string
  siteName: string
  deviceCount: number
}

export function deviceMatchesSearch(device: Device, query: string): boolean {
  const trimmed = query.trim().toLowerCase()
  if (!trimmed) return true

  const haystack = [
    device.name,
    device.model,
    device.site,
    device.mac ?? "",
    device.id,
  ]
    .join(" ")
    .toLowerCase()

  return haystack.includes(trimmed)
}

export function applyDeviceTableFilters(
  devices: Device[],
  filters: DeviceTableFilters,
  hiddenIds: ReadonlySet<string>
): Device[] {
  return devices.filter((device) => {
    if (!filters.showHidden && hiddenIds.has(device.id)) {
      return false
    }
    if (filters.siteId !== "all" && device.siteId !== filters.siteId) {
      return false
    }
    if (filters.model !== "all" && device.model !== filters.model) {
      return false
    }
    if (filters.status === "out-of-scope") {
      if (!isGhostDevice(device)) return false
    } else if (filters.status !== "all" && device.status !== filters.status) {
      return false
    }
    if (!deviceMatchesSearch(device, filters.search)) {
      return false
    }
    return true
  })
}

export function buildSiteFilterOptions(devices: Device[]): SiteFilterOption[] {
  const unique = uniqueSitesFromDevices(devices)
  const counts = new Map<string, number>()
  for (const device of devices) {
    counts.set(device.siteId, (counts.get(device.siteId) ?? 0) + 1)
  }

  return unique
    .map(({ siteId, siteName }) => ({
      siteId,
      siteName,
      deviceCount: counts.get(siteId) ?? 0,
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName))
}

export function uniqueModelsFromDevices(devices: Device[]): string[] {
  const models = new Set<string>()
  for (const device of devices) {
    if (device.model.trim()) {
      models.add(device.model)
    }
  }
  return Array.from(models).sort((a, b) => a.localeCompare(b))
}

export function countHiddenDevices(
  devices: Device[],
  hiddenIds: ReadonlySet<string>
): number {
  return devices.filter((device) => hiddenIds.has(device.id)).length
}

export function hasActiveTableFilters(filters: DeviceTableFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.siteId !== "all" ||
    filters.model !== "all" ||
    filters.status !== "all" ||
    filters.showHidden
  )
}
