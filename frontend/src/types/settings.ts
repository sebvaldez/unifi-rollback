export type RefreshMode = "manual" | "poll"

export type DeviceSettings = {
  refreshMode: RefreshMode
  pollIntervalSeconds: number
  refreshOnStartup: boolean
}

export {
  DEVICE_SETTINGS_DEFAULTS,
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/device-settings"
