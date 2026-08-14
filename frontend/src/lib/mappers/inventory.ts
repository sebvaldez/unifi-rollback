import { inventory, main } from "wailsjs/go/models"
import type { CredentialSlot, CredentialCapability, CredentialSlotKind, SaveCredentialRequest } from "@/types/credentials"
import type { Device, DeviceCapabilities, DeviceStatus } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

function mapCapabilities(
  caps: inventory.DeviceCapabilities | undefined
): DeviceCapabilities {
  if (!caps) {
    return { ...EMPTY_DEVICE_CAPABILITIES }
  }
  return {
    inventory: caps.inventory ?? false,
    restart: caps.restart ?? false,
    locate: caps.locate ?? false,
    rollback: caps.rollback ?? false,
  }
}

function isDeviceStatus(value: string): value is DeviceStatus {
  return (
    value === "online" ||
    value === "offline" ||
    value === "adopting" ||
    value === "unknown"
  )
}

export function toDevice(model: inventory.Device): Device {
  return {
    id: model.id,
    siteId: model.siteId,
    name: model.name,
    model: model.model,
    firmware: model.firmware,
    status: isDeviceStatus(model.status) ? model.status : "unknown",
    site: model.site,
    mac: model.mac || undefined,
    iconUrl: model.iconUrl || undefined,
    inScope: model.inScope !== false,
    scopeLostAt: model.scopeLostAt || undefined,
    capabilities: mapCapabilities(model.capabilities),
  }
}

export function toDevices(models: inventory.Device[]): Device[] {
  return models.map(toDevice)
}

export function toCredentialSlot(model: main.CredentialSlot): CredentialSlot {
  return {
    id: model.id,
    kind: model.kind as CredentialSlotKind,
    label: model.label,
    status: model.status as CredentialSlot["status"],
    capabilities: (model.capabilities ?? []) as CredentialCapability[],
    enabled: model.enabled,
    boundSiteId: model.boundSiteId || undefined,
    boundSiteName: model.boundSiteName || undefined,
    boundHostId: model.boundHostId || undefined,
    maskedSuffix: model.maskedSuffix || undefined,
    lastValidatedAt: model.lastValidatedAt || undefined,
    validationError: model.validationError || undefined,
    validationSummary: model.validationSummary
      ? toValidationSummary(model.validationSummary)
      : undefined,
  }
}

function toValidationSummary(
  model: main.ValidationSummary
): import("@/types/credentials").ValidationSummary {
  return {
    sites: (model.sites ?? []).map((site) => ({
      siteId: site.siteId,
      siteName: site.siteName,
      hostId: site.hostId || undefined,
      permission: site.permission || undefined,
    })),
    applicationsObserved: model.applicationsObserved ?? [],
    hostCount: model.hostCount ?? 0,
    deviceCount: model.deviceCount ?? 0,
    notes: model.notes?.length ? model.notes : undefined,
  }
}

export function toCredentialSlots(models: main.CredentialSlot[]): CredentialSlot[] {
  return models.map(toCredentialSlot)
}

export function toSaveCredentialRequest(
  request: SaveCredentialRequest
): main.SaveCredentialRequest {
  return main.SaveCredentialRequest.createFrom({
    slotId: request.slotId,
    secret: request.secret,
    label: request.label,
  })
}

export function toDiscoveredSites(
  sites: { siteId: string; siteName: string }[]
): main.DiscoveredSite[] {
  return sites.map((site) =>
    main.DiscoveredSite.createFrom({
      siteId: site.siteId,
      siteName: site.siteName,
    })
  )
}
