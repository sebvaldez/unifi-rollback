import { useCallback, useEffect, useReducer, useRef } from "react"
import { useDeviceSettings } from "@/context/device-settings-context"
import { useInterval } from "@/hooks/use-interval"
import { MIN_POLL_INTERVAL_SECONDS } from "@/types/settings"
import type { InventoryPollState } from "@/types/inventory"

// Once per app session — not reset when leaving the Devices tab.
let sessionStartupRefreshDone = false

async function simulateInventoryRefresh(): Promise<void> {
  // TODO: replace with Wails inventory refresh once unifi/ client is wired up.
  await new Promise((resolve) => setTimeout(resolve, 750))
}

type PollState = {
  isRefreshing: boolean
  lastRefreshedAt: Date | null
}

type PollAction =
  | { type: "refreshStart" }
  | { type: "refreshDone" }
  | { type: "refreshStop" }

function pollReducer(state: PollState, action: PollAction): PollState {
  switch (action.type) {
    case "refreshStart":
      return { ...state, isRefreshing: true }
    case "refreshDone":
      return { isRefreshing: false, lastRefreshedAt: new Date() }
    case "refreshStop":
      return { ...state, isRefreshing: false }
    default:
      return state
  }
}

export function useDeviceInventoryPoll(active: boolean): InventoryPollState {
  const { settings, ready: settingsReady } = useDeviceSettings()
  const [state, dispatch] = useReducer(pollReducer, {
    isRefreshing: false,
    lastRefreshedAt: null,
  })
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    dispatch({ type: "refreshStart" })
    try {
      await simulateInventoryRefresh()
      dispatch({ type: "refreshDone" })
    } catch {
      dispatch({ type: "refreshStop" })
    } finally {
      refreshInFlight.current = false
    }
  }, [])

  useEffect(() => {
    if (
      !active ||
      !settingsReady ||
      !settings?.refreshOnStartup ||
      sessionStartupRefreshDone
    ) {
      return
    }
    sessionStartupRefreshDone = true
    void refresh()
  }, [active, settingsReady, settings?.refreshOnStartup, refresh])

  const pollIntervalMs =
    active &&
    settingsReady &&
    settings?.refreshMode === "poll" &&
    settings.pollIntervalSeconds >= MIN_POLL_INTERVAL_SECONDS
      ? settings.pollIntervalSeconds * 1000
      : null

  useEffect(() => {
    if (
      !active ||
      !settingsReady ||
      !settings ||
      settings.refreshMode !== "poll" ||
      settings.pollIntervalSeconds < MIN_POLL_INTERVAL_SECONDS
    ) {
      return
    }

    if (!settings.refreshOnStartup) {
      void refresh()
    }
  }, [
    active,
    settingsReady,
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
    refresh,
  }
}

export type { InventoryPollState } from "@/types/inventory"
