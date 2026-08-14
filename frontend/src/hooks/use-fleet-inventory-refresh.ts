import { useCallback, useRef, useState } from "react"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { hasFleetInventoryAccess } from "@/lib/device-capabilities"
import { formatWailsError } from "@/lib/wails-error"
import { refreshInventory as refreshInventoryRpc } from "@/lib/wails-client"

const FLEET_KEY_MISSING = "site manager API key is not configured"

export function useFleetInventoryRefresh() {
  const { slots } = useCredentials()
  const { setDevices, devices } = useDeviceInventory()
  const fleetReady = hasFleetInventoryAccess(slots)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!fleetReady || refreshInFlight.current) return false

    refreshInFlight.current = true
    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const loaded = await refreshInventoryRpc()
      setDevices(loaded)
      setLastRefreshedAt(new Date())
      return true
    } catch (err) {
      const message = formatWailsError(err, "Inventory refresh failed")
      if (!message.toLowerCase().includes(FLEET_KEY_MISSING)) {
        setRefreshError(message)
      }
      return false
    } finally {
      setIsRefreshing(false)
      refreshInFlight.current = false
    }
  }, [fleetReady, setDevices])

  return {
    refresh,
    isRefreshing,
    lastRefreshedAt,
    refreshError,
    fleetReady,
    deviceCount: devices.length,
  }
}

export function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
