import { DeviceEmptyState } from "@/components/devices/device-empty-state"
import { DevInventoryToolbar } from "@/components/devices/dev-inventory-toolbar"
import { DeviceGridView } from "@/components/devices/device-grid-view"
import { DeviceListView } from "@/components/devices/device-list-view"
import { DeviceViewToggle } from "@/components/devices/device-view-toggle"
import { InventoryAccessBanner } from "@/components/devices/inventory-access-banner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { useDeviceViewMode } from "@/hooks/use-device-view-mode"
import { isDevMode } from "@/lib/dev-mode"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

type DevicesViewProps = {
  isRefreshing: boolean
  onOpenSettings?: () => void
}

export function DevicesView({ isRefreshing, onOpenSettings }: DevicesViewProps) {
  const { devices, actionError, clearActionError } = useDeviceInventory()
  const [viewMode, setViewMode] = useDeviceViewMode()
  const hasDevices = devices.length > 0

  return (
    <Card
      className={cn(
        "border-[var(--unifi-border)] shadow-sm transition-opacity duration-300",
        isRefreshing && "inventory-card-refreshing opacity-95"
      )}
    >
      <CardHeader className="border-b border-[var(--unifi-border)] pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Device inventory</CardTitle>
            <CardDescription>
              Fleet-wide view across Site Manager sites. Row actions unlock when
              credentials in Settings grant the required capabilities.
            </CardDescription>
          </div>
          {hasDevices ? (
            <DeviceViewToggle mode={viewMode} onChange={setViewMode} />
          ) : null}
        </div>
      </CardHeader>

      {isDevMode ? <DevInventoryToolbar /> : null}

      <InventoryAccessBanner onOpenSettings={onOpenSettings} />

      {actionError ? (
        <div className="flex items-start justify-between gap-3 border-b border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-warning)_8%,var(--unifi-surface))] px-4 py-3 text-sm text-[var(--unifi-text)]">
          <p>{actionError}</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 px-2"
            aria-label="Dismiss error"
            onClick={clearActionError}
          >
            <X className="size-4" />
          </Button>
        </div>
      ) : null}

      <CardContent className="p-0">
        {!hasDevices ? (
          <DeviceEmptyState onOpenSettings={onOpenSettings} />
        ) : viewMode === "list" ? (
          <DeviceListView devices={devices} />
        ) : (
          <DeviceGridView devices={devices} />
        )}
      </CardContent>
    </Card>
  )
}
