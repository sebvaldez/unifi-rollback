import { settings as settingsModels } from "wailsjs/go/models"
import type { DeviceSettings, RefreshMode } from "@/types/settings"

function isRefreshMode(value: string): value is RefreshMode {
  return value === "manual" || value === "poll"
}

export function toDeviceSettings(
  model: settingsModels.DeviceSettings
): DeviceSettings {
  return {
    refreshMode: isRefreshMode(model.refreshMode) ? model.refreshMode : "manual",
    pollIntervalSeconds: model.pollIntervalSeconds,
    refreshOnStartup: model.refreshOnStartup,
  }
}

export function toWailsDeviceSettings(
  settings: DeviceSettings
): settingsModels.DeviceSettings {
  return settingsModels.DeviceSettings.createFrom(settings)
}
