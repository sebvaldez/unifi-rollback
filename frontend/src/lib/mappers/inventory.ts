import {
  Device as WailsDevice,
  DeviceCapabilities as WailsDeviceCapabilities,
} from "bindings/unifi-rollback/internal/inventory/models"
import {
  CredentialSlot as WailsCredentialSlot,
  DiscoveredSite,
  SaveCredentialRequest as WailsSaveCredentialRequest,
  ValidationSummary as WailsValidationSummary,
} from "bindings/unifi-rollback/models"
import type { CredentialSlot, CredentialCapability, CredentialSlotKind, SaveCredentialRequest } from "@/types/credentials"
import type { Device, DeviceCapabilities, DeviceStatus } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

function mapCapabilities(
  caps: WailsDeviceCapabilities | undefined
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

export function toDevice(model: WailsDevice): Device {
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

export function toDevices(models: WailsDevice[]): Device[] {
  return models.map(toDevice)
}

export function toCredentialSlot(model: WailsCredentialSlot): CredentialSlot {
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
  model: WailsValidationSummary
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

export function toCredentialSlots(models: WailsCredentialSlot[]): CredentialSlot[] {
  return models.map(toCredentialSlot)
}

export function toSaveCredentialRequest(
  request: SaveCredentialRequest
): WailsSaveCredentialRequest {
  return WailsSaveCredentialRequest.createFrom({
    slotId: request.slotId,
    secret: request.secret,
    label: request.label,
  })
}

export function toDiscoveredSites(
  sites: { siteId: string; siteName: string }[]
): DiscoveredSite[] {
  return sites.map((site) =>
    DiscoveredSite.createFrom({
      siteId: site.siteId,
      siteName: site.siteName,
    })
  )
}
