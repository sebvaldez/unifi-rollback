import { ThemePreferencePicker } from "@/components/settings/theme-preference-picker"
import { DeviceSettingsCard } from "@/components/settings/device-settings-card"
import { CredentialsRegistry } from "@/components/settings/credentials-registry"
import { useTheme } from "@/components/theme-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useWailsQuery } from "@/hooks/use-wails-query"
import {
  fetchDatabasePath,
  fetchDatabaseReady,
} from "@/lib/wails-client"

export function SettingsView() {
  const { preference, resolvedTheme } = useTheme()
  const dbReadyQuery = useWailsQuery(
    fetchDatabaseReady,
    "Failed to check database status"
  )
  const dbPathQuery = useWailsQuery(fetchDatabasePath, "Failed to load database path")

  const dbReady = dbReadyQuery.data
  const dbPath = dbPathQuery.data ?? ""

  return (
    <div className="grid max-w-2xl gap-4">
      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Match macOS system appearance or choose light or dark mode.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ThemePreferencePicker />
          <p className="text-sm text-[var(--unifi-text-muted)]">
            {preference === "system"
              ? `Using system setting (${resolvedTheme} mode).`
              : `Using ${resolvedTheme} mode.`}
          </p>
        </CardContent>
      </Card>

      <CredentialsRegistry />

      <DeviceSettingsCard />

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Database</CardTitle>
          <CardDescription>
            Local SQLite store opened on app startup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--unifi-text)]">
              Status
            </span>
            {dbReadyQuery.loading ? (
              <Badge variant="outline">Checking…</Badge>
            ) : dbReady ? (
              <Badge
                variant="outline"
                className="border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-success)_12%,var(--unifi-surface))] text-[var(--unifi-success)]"
              >
                Ready
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
              >
                Unavailable
              </Badge>
            )}
          </div>
          {dbPath ? (
            <p className="break-all text-sm text-[var(--unifi-text-muted)]">
              {dbPath}
            </p>
          ) : null}
          {dbReadyQuery.error || dbPathQuery.error ? (
            <p className="text-sm text-[var(--unifi-text-muted)]">
              {dbReadyQuery.error ?? dbPathQuery.error}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
