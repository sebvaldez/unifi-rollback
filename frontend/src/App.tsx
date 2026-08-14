import { AppShell } from "@/components/layout/app-shell"
import { InventoryStatusIndicator } from "@/components/devices/inventory-status-indicator"
import { useDeviceInventoryPoll } from "@/hooks/use-device-inventory-poll"
import { DevicesView } from "@/views/devices-view"
import { FirmwareView } from "@/views/firmware-view"
import { SettingsView } from "@/views/settings-view"
import { VIEW_HEADERS, type ViewId } from "@/types/navigation"
import { useState } from "react"

function App() {
  const [activeNav, setActiveNav] = useState<ViewId>("devices")
  const devicesPoll = useDeviceInventoryPoll(activeNav === "devices")
  const header = VIEW_HEADERS[activeNav]

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
        <DevicesView
          isRefreshing={devicesPoll.isRefreshing}
          onOpenSettings={() => setActiveNav("settings")}
        />
      ) : null}
      {activeNav === "firmware" ? <FirmwareView /> : null}
      {activeNav === "settings" ? <SettingsView /> : null}
    </AppShell>
  )
}

export default App
