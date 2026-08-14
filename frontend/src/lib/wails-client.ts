import {
  DatabasePath,
  DatabaseReady,
  GetDeviceSettings,
  SaveDeviceSettings,
} from "wailsjs/go/main/App"
import { toDeviceSettings, toWailsDeviceSettings } from "@/lib/mappers/settings"
import {
  listDevCredentialSlots,
  removeDevCredential,
  saveDevCredential,
  syncDevSiteCredentialSlots,
  validateDevCredential,
} from "@/lib/dev-credentials-store"
import type { CredentialSlot, SaveCredentialRequest } from "@/types/credentials"
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

/** Credential slots — dev in-memory store until Wails + Keychain backend lands. */
export async function fetchCredentialSlots(): Promise<CredentialSlot[]> {
  // TODO: replace with Wails ListCredentialSlots once secrets/ package lands.
  return listDevCredentialSlots()
}

export async function saveCredential(
  request: SaveCredentialRequest
): Promise<CredentialSlot> {
  // TODO: wire to Go secrets + validation probes.
  return saveDevCredential(request)
}

export async function validateCredential(slotId: string): Promise<CredentialSlot> {
  // TODO: wire to Go validation probes.
  return validateDevCredential(slotId)
}

export async function removeCredential(slotId: string): Promise<void> {
  // TODO: wire to Go secrets removal.
  removeDevCredential(slotId)
}

export async function syncCredentialSiteSlots(
  sites: { siteId: string; siteName: string }[]
): Promise<CredentialSlot[]> {
  // TODO: wire to Go backend when site discovery lands.
  return syncDevSiteCredentialSlots(sites)
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
