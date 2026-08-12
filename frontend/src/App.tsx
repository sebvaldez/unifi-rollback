import { AppShell } from "@/components/layout/app-shell"
import { ThemePreferencePicker } from "@/components/settings/theme-preference-picker"
import { DeviceSettingsCard } from "@/components/settings/device-settings-card"
import { KeychainDevToolsCard } from "@/components/settings/keychain-dev-tools-card"
import { InventoryStatusIndicator } from "@/components/devices/inventory-status-indicator"
import { useDeviceInventoryPoll } from "@/hooks/use-device-inventory-poll"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { useEffect, useState } from "react"
import { DatabasePath, DatabaseReady } from "../wailsjs/go/main/App"

const placeholderDevices = [
  {
    name: "Office UDM-Pro",
    model: "UDM-Pro",
    firmware: "4.0.80",
    status: "Online",
    site: "Default",
  },
  {
    name: "Garage U6-Pro",
    model: "U6-Pro",
    firmware: "6.6.65",
    status: "Online",
    site: "Default",
  },
  {
    name: "Lab USW-24",
    model: "USW-24-POE",
    firmware: "7.0.158",
    status: "Offline",
    site: "Lab",
  },
]

type DevicesViewProps = {
  isRefreshing: boolean
}

function DevicesView({ isRefreshing }: DevicesViewProps) {
  return (
    <Card
      className={cn(
        "border-[var(--unifi-border)] shadow-sm transition-opacity duration-300",
        isRefreshing && "inventory-card-refreshing opacity-95"
      )}
    >
      <CardHeader className="border-b border-[var(--unifi-border)] pb-4">
        <CardTitle className="text-base">Device inventory</CardTitle>
        <CardDescription>
          Fleet-wide view across Site Manager sites. Connect API keys in
          Settings to load live data.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Firmware</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {placeholderDevices.map((device) => (
              <TableRow key={device.name}>
                <TableCell className="font-medium">{device.name}</TableCell>
                <TableCell>{device.model}</TableCell>
                <TableCell>{device.firmware}</TableCell>
                <TableCell>{device.site}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      device.status === "Online"
                        ? "border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-success)_12%,var(--unifi-surface))] text-[var(--unifi-success)]"
                        : "border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
                    }
                  >
                    {device.status}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function FirmwareView() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Verified manifest</CardTitle>
          <CardDescription>
            Pinned firmware builds with SHA256 verification before rollback.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--unifi-text-muted)]">
            No manifest entries yet. Add a mirror URL from a community release
            thread to get started.
          </p>
          <Button className="mt-4">Add firmware entry</Button>
        </CardContent>
      </Card>

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Validation gate</CardTitle>
          <CardDescription>
            Domain allowlist, download, and checksum before any push.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-[var(--unifi-text-muted)]">
          <p>Allowed: dl.ui.com, fw-download.ubnt.com</p>
          <p>Verified badge renders only on SHA256 match.</p>
        </CardContent>
      </Card>
    </div>
  )
}

function SettingsView() {
  const { preference, resolvedTheme } = useTheme()
  const [dbReady, setDbReady] = useState<boolean | null>(null)
  const [dbPath, setDbPath] = useState("")

  useEffect(() => {
    DatabaseReady().then(setDbReady)
    DatabasePath().then(setDbPath)
  }, [])

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

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Credentials</CardTitle>
          <CardDescription>
            API keys are stored in macOS Keychain — never in SQLite.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="site-manager-key"
              className="text-sm font-medium text-[var(--unifi-text)]"
            >
              Site Manager API key
            </label>
            <Input
              id="site-manager-key"
              type="password"
              placeholder="Paste api.ui.com key"
              disabled
            />
          </div>
          <Button disabled>Save to Keychain</Button>
        </CardContent>
      </Card>

      <DeviceSettingsCard />

      <KeychainDevToolsCard />

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
            {dbReady === null ? (
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
        </CardContent>
      </Card>
    </div>
  )
}

type ViewId = "devices" | "firmware" | "settings"

function App() {
  const [activeNav, setActiveNav] = useState<ViewId>("devices")
  const devicesPoll = useDeviceInventoryPoll(activeNav === "devices")

  const header = {
    devices: {
      title: "Devices",
      description: "Inventory across all accessible UniFi sites",
    },
    firmware: {
      title: "Firmware",
      description: "Curated manifest and checksum-verified builds",
    },
    settings: {
      title: "Settings",
      description: "API keys and application preferences",
    },
  }[activeNav]

  return (
    <AppShell
      activeNav={activeNav}
      onNavChange={(id) => setActiveNav(id as ViewId)}
      title={header.title}
      description={header.description}
      actions={
        activeNav === "devices" ? (
          <InventoryStatusIndicator poll={devicesPoll} />
        ) : undefined
      }
    >
      {activeNav === "devices" ? (
        <DevicesView isRefreshing={devicesPoll.isRefreshing} />
      ) : null}
      {activeNav === "firmware" ? <FirmwareView /> : null}
      {activeNav === "settings" ? <SettingsView /> : null}
    </AppShell>
  )
}

export default App
