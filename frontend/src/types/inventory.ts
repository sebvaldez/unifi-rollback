export type DeviceStatus = "online" | "offline" | "adopting" | "unknown"

export type DeviceViewMode = "list" | "grid"

/** Actions the UI exposes for adopted devices. */
export type DeviceActionId = "locate" | "restart" | "rollback"

/** Derived from credential validation — drives row action enablement. */
export type DeviceCapabilities = {
  inventory: boolean
  restart: boolean
  locate: boolean
  rollback: boolean
}

export const EMPTY_DEVICE_CAPABILITIES: DeviceCapabilities = {
  inventory: false,
  restart: false,
  locate: false,
  rollback: false,
}

export type Device = {
  id: string
  siteId: string
  name: string
  model: string
  firmware: string
  status: DeviceStatus
  site: string
  mac?: string
  /** Optional override; otherwise resolved from model via unifi-device-icons. */
  iconUrl?: string
  /** False when the device is no longer returned by the Site Manager API (scope reduced). */
  inScope?: boolean
  scopeLostAt?: string
  capabilities: DeviceCapabilities
}

export function isGhostDevice(device: Pick<Device, "inScope">): boolean {
  return device.inScope === false
}

export type DeviceActionAvailability = {
  id: DeviceActionId
  enabled: boolean
  reason?: string
}

export type InventoryPollState = {
  isRefreshing: boolean
  lastRefreshedAt: Date | null
  refreshError: string | null
  refresh: () => Promise<void>
  fleetReady: boolean
}

export type DeviceInventoryState = {
  devices: Device[]
  loading: boolean
}
