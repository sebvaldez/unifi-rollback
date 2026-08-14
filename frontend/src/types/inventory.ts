export type Device = {
  name: string
  model: string
  firmware: string
  status: string
  site: string
}

export type InventoryPollState = {
  isRefreshing: boolean
  lastRefreshedAt: Date | null
  refresh: () => Promise<void>
}
