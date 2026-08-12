/** Defaults mirror internal/settings/device.go — keep in sync. */
export const DEVICE_SETTINGS_DEFAULTS = {
  refreshMode: "manual",
  pollIntervalSeconds: 60,
  refreshOnStartup: false,
} as const

export const MIN_POLL_INTERVAL_SECONDS = 15
