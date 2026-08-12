import { AppShell, RefreshCw } from "@/components/layout/app-shell"
import { ThemePreferencePicker } from "@/components/settings/theme-preference-picker"
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
import { useState } from "react"
import { Greet } from "../wailsjs/go/main/App"

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

function DevicesView() {
  return (
    <Card className="border-[var(--unifi-border)] shadow-sm">
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
  const [name, setName] = useState("")
  const [message, setMessage] = useState(
    "Wails bridge is connected. Enter a name to test the Go backend."
  )

  function testBackend() {
    Greet(name || "UniFi").then(setMessage)
  }

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

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Backend smoke test</CardTitle>
          <CardDescription>
            Temporary Wails binding check until real settings are wired up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
          <Button variant="outline" onClick={testBackend}>
            Test Go binding
          </Button>
          <p className="text-sm text-[var(--unifi-text-muted)]">{message}</p>
        </CardContent>
      </Card>
    </div>
  )
}

const views = {
  devices: {
    title: "Devices",
    description: "Inventory across all accessible UniFi sites",
    content: <DevicesView />,
  },
  firmware: {
    title: "Firmware",
    description: "Curated manifest and checksum-verified builds",
    content: <FirmwareView />,
  },
  settings: {
    title: "Settings",
    description: "API keys and application preferences",
    content: <SettingsView />,
  },
} as const

type ViewId = keyof typeof views

function App() {
  const [activeNav, setActiveNav] = useState<ViewId>("devices")
  const view = views[activeNav]

  return (
    <AppShell
      activeNav={activeNav}
      onNavChange={(id) => setActiveNav(id as ViewId)}
      title={view.title}
      description={view.description}
      actions={
        activeNav === "devices" ? (
          <Button variant="outline" size="sm">
            <RefreshCw className="size-4" />
            Refresh inventory
          </Button>
        ) : undefined
      }
    >
      {view.content}
    </AppShell>
  )
}

export default App
