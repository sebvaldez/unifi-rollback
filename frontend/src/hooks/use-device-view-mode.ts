import { useCallback, useState } from "react"
import type { DeviceViewMode } from "@/types/inventory"

const STORAGE_KEY = "unifi-fleet.deviceViewMode"

function readStoredViewMode(): DeviceViewMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "list" || stored === "grid") return stored
  } catch {
    // ignore
  }
  return "list"
}

export function useDeviceViewMode(): [DeviceViewMode, (mode: DeviceViewMode) => void] {
  const [mode, setModeState] = useState<DeviceViewMode>(readStoredViewMode)

  const setMode = useCallback((next: DeviceViewMode) => {
    setModeState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }, [])

  return [mode, setMode]
}
