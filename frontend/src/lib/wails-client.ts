import {
  DatabasePath,
  DatabaseReady,
  GetDeviceSettings,
  SaveDeviceSettings,
} from "wailsjs/go/main/App"
import { toDeviceSettings, toWailsDeviceSettings } from "@/lib/mappers/settings"
import type { DeviceSettings } from "@/types/settings"

export function normalizeWailsError(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback
}

export async function fetchDatabasePath(): Promise<string> {
  return DatabasePath()
}

export async function fetchDatabaseReady(): Promise<boolean> {
  return DatabaseReady()
}

export async function fetchDeviceSettings(): Promise<DeviceSettings> {
  const loaded = await GetDeviceSettings()
  return toDeviceSettings(loaded)
}

export async function persistDeviceSettings(
  settings: DeviceSettings
): Promise<void> {
  await SaveDeviceSettings(toWailsDeviceSettings(settings))
}
