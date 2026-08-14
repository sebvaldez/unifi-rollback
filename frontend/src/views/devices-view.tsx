import { DeviceEmptyState } from "@/components/devices/device-empty-state"
import { DevInventoryToolbar } from "@/components/devices/dev-inventory-toolbar"
import { DeviceGridView } from "@/components/devices/device-grid-view"
import { DeviceListView } from "@/components/devices/device-list-view"
import { DeviceSiteFilter } from "@/components/devices/device-site-filter"
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
import { useDeviceSiteFilter } from "@/hooks/use-device-site-filter"
import { useDeviceViewMode } from "@/hooks/use-device-view-mode"
import { isDevMode } from "@/lib/dev-mode"
import { cn } from "@/lib/utils"
import { isGhostDevice } from "@/types/inventory"
import { X } from "lucide-react"
import { useMemo } from "react"

type DevicesViewProps = {
  isRefreshing: boolean
  onOpenSettings?: () => void
}

export function DevicesView({ isRefreshing, onOpenSettings }: DevicesViewProps) {
  const { devices, actionError, clearActionError } = useDeviceInventory()
  const [viewMode, setViewMode] = useDeviceViewMode()
  const {
    siteFilter,
    setSiteFilter,
    siteOptions,
    filteredDevices,
    hasMultipleSites,
  } = useDeviceSiteFilter(devices)
  const hasDevices = devices.length > 0
  const visibleDevices = filteredDevices
  const showingFilteredEmpty =
    hasDevices && visibleDevices.length === 0 && siteFilter !== "all"

  const ghostCount = useMemo(
    () => visibleDevices.filter((device) => isGhostDevice(device)).length,
    [visibleDevices]
  )

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
              Fleet-wide view across Site Manager sites
              {hasMultipleSites ? " — filter by site below" : ""}. Row actions
              unlock when credentials in Settings grant the required capabilities.
            </CardDescription>
          </div>
          {hasDevices ? (
            <DeviceViewToggle mode={viewMode} onChange={setViewMode} />
          ) : null}
        </div>
      </CardHeader>

      {isDevMode ? <DevInventoryToolbar /> : null}

      <InventoryAccessBanner onOpenSettings={onOpenSettings} />

      {hasDevices && siteOptions.length > 0 ? (
        <DeviceSiteFilter
          siteFilter={siteFilter}
          siteOptions={siteOptions}
          totalDeviceCount={devices.length}
          filteredDeviceCount={visibleDevices.length}
          onChange={setSiteFilter}
        />
      ) : null}

      {ghostCount > 0 ? (
        <div className="border-b border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-warning)_6%,var(--unifi-surface))] px-4 py-3 text-sm text-[var(--unifi-text)]">
          {ghostCount} device{ghostCount === 1 ? "" : "s"} no longer appear in
          Site Manager for this API key — shown as out-of-scope ghosts until
          access returns or you remove the fleet key.
        </div>
      ) : null}

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
        ) : showingFilteredEmpty ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--unifi-text-muted)]">
            No devices match the selected site filter.
          </div>
        ) : viewMode === "list" ? (
          <DeviceListView devices={visibleDevices} />
        ) : (
          <DeviceGridView devices={visibleDevices} />
        )}
      </CardContent>
    </Card>
  )
}
