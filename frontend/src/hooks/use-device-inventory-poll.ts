import { useCallback, useEffect, useRef, useState } from "react"
import { GetDeviceSettings } from "../../wailsjs/go/main/App"
import { settings as settingsModels } from "../../wailsjs/go/models"
import { DEVICE_SETTINGS_DEFAULTS } from "@/lib/device-settings"

export type InventoryPollState = {
  settings: settingsModels.DeviceSettings | null
  settingsReady: boolean
  isRefreshing: boolean
  lastRefreshedAt: Date | null
  refresh: () => Promise<void>
}

// Once per app session — not reset when leaving the Devices tab.
let sessionStartupRefreshDone = false

async function simulateInventoryRefresh(): Promise<void> {
  // TODO: replace with Wails inventory refresh once unifi/ client is wired up.
  await new Promise((resolve) => setTimeout(resolve, 750))
}

function defaultDeviceSettings(): settingsModels.DeviceSettings {
  return settingsModels.DeviceSettings.createFrom({
    ...DEVICE_SETTINGS_DEFAULTS,
  })
}

export function useDeviceInventoryPoll(active: boolean): InventoryPollState {
  const [settings, setSettings] =
    useState<settingsModels.DeviceSettings | null>(null)
  const [settingsReady, setSettingsReady] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)
  const refreshInFlight = useRef(false)

  const refresh = useCallback(async () => {
    if (refreshInFlight.current) return
    refreshInFlight.current = true
    setIsRefreshing(true)
    try {
      await simulateInventoryRefresh()
      setLastRefreshedAt(new Date())
    } finally {
      setIsRefreshing(false)
      refreshInFlight.current = false
    }
  }, [])

  const loadSettings = useCallback(async () => {
    setSettingsReady(false)
    try {
      const loaded = await GetDeviceSettings()
      setSettings(loaded)
    } catch {
      setSettings(defaultDeviceSettings())
    } finally {
      setSettingsReady(true)
    }
  }, [])

  useEffect(() => {
    if (!active) {
      setSettings(null)
      setSettingsReady(false)
      return
    }
    void loadSettings()
  }, [active, loadSettings])

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

  useEffect(() => {
    if (
      !active ||
      !settingsReady ||
      !settings ||
      settings.refreshMode !== "poll" ||
      settings.pollIntervalSeconds < 1
    ) {
      return
    }

    if (!settings.refreshOnStartup) {
      void refresh()
    }

    const intervalMs = settings.pollIntervalSeconds * 1000
    const id = window.setInterval(() => {
      void refresh()
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [
    active,
    settingsReady,
    settings?.refreshMode,
    settings?.pollIntervalSeconds,
    settings?.refreshOnStartup,
    refresh,
  ])

  return {
    settings,
    settingsReady,
    isRefreshing,
    lastRefreshedAt,
    refresh,
  }
}
