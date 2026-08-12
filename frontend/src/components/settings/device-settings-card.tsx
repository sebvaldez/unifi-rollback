import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Hand, RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  GetDeviceSettings,
  SaveDeviceSettings,
} from "../../../wailsjs/go/main/App"
import { settings as settingsModels } from "../../../wailsjs/go/models"
import {
  MIN_POLL_INTERVAL_SECONDS,
} from "@/lib/device-settings"

type RefreshMode = "manual" | "poll"

const refreshModeOptions: {
  value: RefreshMode
  label: string
  description: string
  icon: typeof Hand
}[] = [
  {
    value: "manual",
    label: "Manual",
    description:
      "Refresh only when you click the status indicator on Devices.",
    icon: Hand,
  },
  {
    value: "poll",
    label: "Automatic polling",
    description: "Refresh inventory on a fixed interval while the app is open.",
    icon: RefreshCw,
  },
]

export function DeviceSettingsCard() {
  const [deviceSettings, setDeviceSettings] =
    useState<settingsModels.DeviceSettings | null>(null)
  const [intervalInput, setIntervalInput] = useState("60")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await GetDeviceSettings()
      setDeviceSettings(loaded)
      setIntervalInput(String(loaded.pollIntervalSeconds))
    } catch (err) {
      setDeviceSettings(null)
      setError(
        err instanceof Error ? err.message : "Failed to load device settings"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(next: settingsModels.DeviceSettings) {
    setSaving(true)
    setError(null)
    try {
      await SaveDeviceSettings(next)
      setDeviceSettings(next)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save device settings"
      )
      await load()
    } finally {
      setSaving(false)
    }
  }

  function handleModeChange(mode: RefreshMode) {
    if (!deviceSettings || saving) return
    void persist({
      ...deviceSettings,
      refreshMode: mode,
    })
  }

  function handleStartupChange(checked: boolean) {
    if (!deviceSettings || saving) return
    void persist({
      ...deviceSettings,
      refreshOnStartup: checked,
    })
  }

  function handleIntervalSave() {
    if (!deviceSettings || saving) return

    const parsed = Number.parseInt(intervalInput, 10)
    if (Number.isNaN(parsed) || parsed < MIN_POLL_INTERVAL_SECONDS) {
      setError(
        `Poll interval must be at least ${MIN_POLL_INTERVAL_SECONDS} seconds`
      )
      setIntervalInput(String(deviceSettings.pollIntervalSeconds))
      return
    }

    if (parsed === deviceSettings.pollIntervalSeconds) {
      setError(null)
      return
    }

    void persist({
      ...deviceSettings,
      pollIntervalSeconds: parsed,
    })
  }

  const pollMode = deviceSettings?.refreshMode === "poll"

  return (
    <Card className="border-[var(--unifi-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Devices</CardTitle>
        <CardDescription>
          How inventory is refreshed from UniFi APIs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {loading ? (
          <p className="text-sm text-[var(--unifi-text-muted)]">Loading…</p>
        ) : error && !deviceSettings ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--unifi-text-muted)]">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </div>
        ) : deviceSettings ? (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium text-[var(--unifi-text)]">
                Refresh mode
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {refreshModeOptions.map(({ value, label, description, icon: Icon }) => {
                  const active = deviceSettings.refreshMode === value
                  return (
                    <button
                      key={value}
                      type="button"
                      disabled={saving}
                      onClick={() => handleModeChange(value)}
                      className={cn(
                        "rounded-md border p-3 text-left transition-colors",
                        active
                          ? "border-primary bg-[color-mix(in_srgb,var(--unifi-blue)_12%,var(--unifi-surface))]"
                          : "border-[var(--unifi-border)] bg-[var(--unifi-surface)] hover:border-[color-mix(in_srgb,var(--unifi-blue)_25%,var(--unifi-border))]"
                      )}
                    >
                      <span className="flex items-center gap-2 text-sm font-medium text-[var(--unifi-text)]">
                        <Icon className="size-4" />
                        {label}
                      </span>
                      <span className="mt-1 block text-xs text-[var(--unifi-text-muted)]">
                        {description}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="device-poll-interval"
                className="text-sm font-medium text-[var(--unifi-text)]"
              >
                Poll interval (seconds)
              </label>
              <p className="text-xs text-[var(--unifi-text-muted)]">
                Minimum {MIN_POLL_INTERVAL_SECONDS} seconds. Used when automatic
                polling is enabled.
              </p>
              <div className="flex max-w-xs items-center gap-2">
                <Input
                  id="device-poll-interval"
                  type="number"
                  min={MIN_POLL_INTERVAL_SECONDS}
                  step={1}
                  value={intervalInput}
                  disabled={!pollMode || saving}
                  onChange={(e) => setIntervalInput(e.target.value)}
                  onBlur={handleIntervalSave}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleIntervalSave()
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!pollMode || saving}
                  onClick={handleIntervalSave}
                >
                  Apply
                </Button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-4 rounded border-[var(--unifi-border)]"
                checked={deviceSettings.refreshOnStartup}
                disabled={saving}
                onChange={(e) => handleStartupChange(e.target.checked)}
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-[var(--unifi-text)]">
                  Refresh on app launch
                </span>
                <span className="block text-xs text-[var(--unifi-text-muted)]">
                  Fetch inventory once when the app opens, before any scheduled
                  polling.
                </span>
              </span>
            </label>
          </>
        ) : null}

        {error && deviceSettings ? (
          <p className="text-sm text-[var(--unifi-text-muted)]">{error}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
