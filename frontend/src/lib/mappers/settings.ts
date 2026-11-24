import { DeviceSettings as WailsDeviceSettings } from "bindings/unifi-rollback/internal/settings/models"
import type { DeviceSettings, RefreshMode } from "@/types/settings"

function isRefreshMode(value: string): value is RefreshMode {
  return value === "manual" || value === "poll"
}

export function toDeviceSettings(
  model: WailsDeviceSettings
): DeviceSettings {
  return {
    refreshMode: isRefreshMode(model.refreshMode) ? model.refreshMode : "manual",
    pollIntervalSeconds: model.pollIntervalSeconds,
    refreshOnStartup: model.refreshOnStartup,
  }
}

export function toWailsDeviceSettings(
  settings: DeviceSettings
): WailsDeviceSettings {
  return WailsDeviceSettings.createFrom(settings)
}
