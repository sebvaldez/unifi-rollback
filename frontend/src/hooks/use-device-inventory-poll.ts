import { useCallback, useEffect, useReducer, useRef } from "react"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { useDeviceSettings } from "@/context/device-settings-context"
import { useInterval } from "@/hooks/use-interval"
import { hasFleetInventoryAccess } from "@/lib/device-capabilities"
import {
  listDevices as listDevicesRpc,
  refreshInventory as refreshInventoryRpc,
} from "@/lib/wails-client"
import { MIN_POLL_INTERVAL_SECONDS } from "@/types/settings"
import type { InventoryPollState } from "@/types/inventory"

const FLEET_KEY_MISSING = "site manager API key is not configured"

// Once per app session — not reset when leaving the Devices tab.
let sessionStartupRefreshDone = false
let sessionPollInitialRefreshDone = false

type PollState = {
  isRefreshing: boolean
  lastRefreshedAt: Date | null
  refreshError: string | null
}

type PollAction =
  | { type: "refreshStart" }
  | { type: "refreshDone" }
  | { type: "refreshStop" }
  | { type: "refreshError"; message: string }
  | { type: "clearRefreshError" }

function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case "refreshStart":
      return { ...state, isRefreshing: true, refreshError: null }
    case "refreshDone":
      return { isRefreshing: false, lastRefreshedAt: new Date(), refreshError: null }
    case "refreshStop":
      return { ...state, isRefreshing: false }
    case "refreshError":
      return { ...state, isRefreshing: false, refreshError: action.message }
    case "clearRefreshError":
      return { ...state, refreshError: null }
    default:
      return state
  }
}

export function useDeviceInventoryPoll(active: boolean): InventoryPollState {
  const { settings, ready: settingsReady } = useDeviceSettings()
  const { slots, loading: credentialsLoading } = useCredentials()
  const { setDevices, devices } = useDeviceInventory()
  const fleetReady = hasFleetInventoryAccess(slots)
  const [state, dispatch] = useReducer(pollReducer, {
    isRefreshing: false,
    lastRefreshedAt: null,
    refreshError: null,
  })
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (!fleetReady || refreshInFlight.current) return
    refreshInFlight.current = true
    dispatch({ type: "refreshStart" })
    try {
      const devices = await refreshInventoryRpc()
      setDevices(devices)
      dispatch({ type: "refreshDone" })
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Inventory refresh failed"
      if (message.toLowerCase().includes(FLEET_KEY_MISSING)) {
        dispatch({ type: "refreshStop" })
        return
      }
      dispatch({ type: "refreshError", message })
      dispatch({ type: "refreshStop" })
    } finally {
      refreshInFlight.current = false
    }
  }, [fleetReady, setDevices])

  useEffect(() => {
    if (!active || devices.length > 0) {
      return
    }

    let cancelled = false
    void listDevicesRpc()
      .then((loaded) => {
        if (!cancelled && loaded.length > 0) {
          setDevices(loaded)
        }
      })
      .catch(() => {
        // Cached inventory is best-effort on tab open.
      })

    return () => {
      cancelled = true
    }
  }, [active, devices.length, setDevices])

  useEffect(() => {
    if (
      !active ||
      !settingsReady ||
      credentialsLoading ||
      !fleetReady ||
      !settings?.refreshOnStartup ||
      sessionStartupRefreshDone
    ) {
      return
    }
    sessionStartupRefreshDone = true
    void refresh()
  }, [
    active,
    settingsReady,
    credentialsLoading,
    fleetReady,
    settings?.refreshOnStartup,
    refresh,
  ])

  const pollIntervalMs =
    active &&
    settingsReady &&
    credentialsLoading === false &&
    fleetReady &&
    settings?.refreshMode === "poll" &&
    settings.pollIntervalSeconds >= MIN_POLL_INTERVAL_SECONDS
      ? settings.pollIntervalSeconds * 1000
      : null

  useEffect(() => {
    if (
      !active ||
      !settingsReady ||
      credentialsLoading ||
      !fleetReady ||
      !settings ||
      settings.refreshMode !== "poll" ||
      settings.pollIntervalSeconds < MIN_POLL_INTERVAL_SECONDS ||
      settings.refreshOnStartup ||
      sessionPollInitialRefreshDone
    ) {
      return
    }
    sessionPollInitialRefreshDone = true
    void refresh()
  }, [
    active,
    settingsReady,
    credentialsLoading,
    fleetReady,
    settings?.refreshMode,
    settings?.pollIntervalSeconds,
    settings?.refreshOnStartup,
    refresh,
    settings,
  ])

  useInterval(() => {
    void refresh()
  }, pollIntervalMs)

  return {
    isRefreshing: state.isRefreshing,
    lastRefreshedAt: state.lastRefreshedAt,
    refreshError: state.refreshError,
    refresh,
    fleetReady,
  }
}

export type { InventoryPollState } from "@/types/inventory"
