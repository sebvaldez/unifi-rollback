import {
  DatabasePath,
  DatabaseReady,
  GetDeviceSettings,
  ListCredentialSlots,
  ListDevices,
  RefreshInventory,
  RemoveCredential,
  SaveCredential,
  SaveDeviceSettings,
  SyncCredentialSiteSlots,
  ValidateCredential,
} from "wailsjs/go/main/App"
import {
  toCredentialSlot,
  toCredentialSlots,
  toDevices,
  toDiscoveredSites,
  toSaveCredentialRequest,
} from "@/lib/mappers/inventory"
import { toDeviceSettings, toWailsDeviceSettings } from "@/lib/mappers/settings"
import type { CredentialSlot, SaveCredentialRequest } from "@/types/credentials"
import type { Device } from "@/types/inventory"
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

export async function fetchCredentialSlots(): Promise<CredentialSlot[]> {
  const loaded = await ListCredentialSlots()
  return toCredentialSlots(loaded)
}

export async function saveCredential(
  request: SaveCredentialRequest
): Promise<CredentialSlot> {
  const updated = await SaveCredential(toSaveCredentialRequest(request))
  return toCredentialSlot(updated)
}

export async function validateCredential(slotId: string): Promise<CredentialSlot> {
  const updated = await ValidateCredential(slotId)
  return toCredentialSlot(updated)
}

export async function removeCredential(slotId: string): Promise<void> {
  await RemoveCredential(slotId)
}

export async function syncCredentialSiteSlots(
  sites: { siteId: string; siteName: string }[]
): Promise<CredentialSlot[]> {
  const synced = await SyncCredentialSiteSlots(toDiscoveredSites(sites))
  return toCredentialSlots(synced)
}

export async function refreshInventory(): Promise<Device[]> {
  const loaded = await RefreshInventory()
  return toDevices(loaded)
}

export async function listDevices(): Promise<Device[]> {
  const loaded = await ListDevices()
  return toDevices(loaded)
}

/** Blink device LEDs — requires Classic admin or future Integration LOCATE action. */
export async function locateDevice(
  siteId: string,
  deviceId: string
): Promise<void> {
  void siteId
  void deviceId
  throw new Error(
    "Locate is not available until credentials and unifi client are connected"
  )
}
