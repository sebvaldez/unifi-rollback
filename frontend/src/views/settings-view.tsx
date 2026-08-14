import { ThemePreferencePicker } from "@/components/settings/theme-preference-picker"
import { DeviceSettingsCard } from "@/components/settings/device-settings-card"
import { CredentialsRegistry } from "@/components/settings/credentials-registry"
import { KeychainDevToolsCard } from "@/components/settings/keychain-dev-tools-card"
import { SettingsLayout } from "@/components/settings/settings-layout"
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
import {
  DEFAULT_SETTINGS_SECTION,
  readStoredSettingsSection,
  visibleSettingsSections,
  writeStoredSettingsSection,
  type SettingsSectionId,
} from "@/types/settings-navigation"
import { useCallback, useEffect, useState } from "react"
import { IsDevMode } from "../../wailsjs/go/main/App"

function AppearanceSettings() {
  const { preference, resolvedTheme } = useTheme()

  return (
    <Card className="border-[var(--unifi-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Theme</CardTitle>
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
  )
}

function DatabaseSettings() {
  const dbReadyQuery = useWailsQuery(
    fetchDatabaseReady,
    "Failed to check database status"
  )
  const dbPathQuery = useWailsQuery(fetchDatabasePath, "Failed to load database path")

  const dbReady = dbReadyQuery.data
  const dbPath = dbPathQuery.data ?? ""

  return (
    <Card className="border-[var(--unifi-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Local database</CardTitle>
        <CardDescription>
          SQLite store opened on app startup for inventory and credential metadata.
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
  )
}

function SettingsSectionContent({ section }: { section: SettingsSectionId }) {
  switch (section) {
    case "appearance":
      return <AppearanceSettings />
    case "credentials":
      return <CredentialsRegistry />
    case "inventory":
      return <DeviceSettingsCard />
    case "database":
      return <DatabaseSettings />
    case "developer":
      return <KeychainDevToolsCard />
    default:
      return null
  }
}

export function SettingsView() {
  const [devMode, setDevMode] = useState(false)
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    readStoredSettingsSection
  )

  useEffect(() => {
    let cancelled = false
    void IsDevMode()
      .then((enabled) => {
        if (!cancelled) setDevMode(enabled)
      })
      .catch(() => {
        if (!cancelled) setDevMode(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const sections = visibleSettingsSections(devMode)

  useEffect(() => {
    if (sections.some((section) => section.id === activeSection)) return
    const fallback = sections[0]?.id ?? DEFAULT_SETTINGS_SECTION
    setActiveSection(fallback)
    writeStoredSettingsSection(fallback)
  }, [activeSection, sections])

  const handleSectionChange = useCallback((section: SettingsSectionId) => {
    setActiveSection(section)
    writeStoredSettingsSection(section)
  }, [])

  return (
    <SettingsLayout
      sections={sections}
      activeSection={activeSection}
      onSectionChange={handleSectionChange}
    >
      <SettingsSectionContent section={activeSection} />
    </SettingsLayout>
  )
}
