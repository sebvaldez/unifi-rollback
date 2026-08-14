export type DeviceStatus = "online" | "offline" | "adopting" | "unknown"

export type DeviceViewMode = "list" | "grid"

/** Actions the Network Integration API supports for adopted devices. */
export type DeviceActionId = "locate" | "restart" | "rollback"

export type Device = {
  id: string
  siteId: string
  name: string
  model: string
  firmware: string
  status: DeviceStatus
  site: string
  mac?: string
  /** Whether a local Network Integration API key is configured for this site. */
  hasLocalApi?: boolean
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
