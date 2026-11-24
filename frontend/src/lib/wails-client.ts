import {
  ClaudeKeyReady,
  DatabasePath,
  DatabaseReady,
  GetDeviceSettings,
  ListCredentialSlots,
  ListDevices,
  LocateDevice,
  RefreshInventory,
  RemoveCredential,
  SaveClaudeKey,
  SaveCredential,
  SaveDeviceSettings,
  SyncCredentialSiteSlots,
  ValidateCredential,
} from "bindings/unifi-rollback/app"
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

export async function fetchClaudeKeyReady(): Promise<boolean> {
  return ClaudeKeyReady()
}

export async function saveClaudeKey(secret: string): Promise<void> {
  await SaveClaudeKey(secret)
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
  return toCredentialSlots(loaded ?? [])
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
  return toCredentialSlots(synced ?? [])
}

export async function refreshInventory(): Promise<Device[]> {
  const loaded = await RefreshInventory()
  return toDevices(loaded ?? [])
}

export async function listDevices(): Promise<Device[]> {
  const loaded = await ListDevices()
  return toDevices(loaded ?? [])
}

/** Blink device LEDs via the console's classic API (factory ubnt login). */
export async function locateDevice(
  siteId: string,
  deviceId: string
): Promise<void> {
  await LocateDevice(siteId, deviceId)
}
