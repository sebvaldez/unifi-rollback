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
  capabilities: DeviceCapabilities
}

export type DeviceActionAvailability = {
  id: DeviceActionId
  enabled: boolean
  reason?: string
}

export type InventoryPollState = {
  isRefreshing: boolean
  lastRefreshedAt: Date | null
  refresh: () => Promise<void>
}

export type DeviceInventoryState = {
  devices: Device[]
  loading: boolean
}
