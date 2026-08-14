import { DeviceEmptyState } from "@/components/devices/device-empty-state"
import { DevInventoryToolbar } from "@/components/devices/dev-inventory-toolbar"
import { DeviceBulkActionBar } from "@/components/devices/device-bulk-action-bar"
import { DeviceGridView } from "@/components/devices/device-grid-view"
import { DeviceListView } from "@/components/devices/device-list-view"
import { DeviceTableToolbar } from "@/components/devices/device-table-toolbar"
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
import { useDeviceTable } from "@/hooks/use-device-table"
import { useDeviceViewMode } from "@/hooks/use-device-view-mode"
import { isDevMode } from "@/lib/dev-mode"
import { cn } from "@/lib/utils"
import { isGhostDevice, type DeviceActionId } from "@/types/inventory"
import { X } from "lucide-react"
import { useCallback, useMemo } from "react"

type DevicesViewProps = {
  isRefreshing: boolean
  onOpenSettings?: () => void
}

export function DevicesView({ isRefreshing, onOpenSettings }: DevicesViewProps) {
  const {
    devices,
    actionError,
    clearActionError,
    runBulkDeviceAction,
    bulkActionPending,
  } = useDeviceInventory()
  const [viewMode, setViewMode] = useDeviceViewMode()
  const table = useDeviceTable(devices)
  const hasDevices = devices.length > 0

  const ghostCount = useMemo(
    () => table.filteredDevices.filter((device) => isGhostDevice(device)).length,
    [table.filteredDevices]
  )

  const handleBulkAction = useCallback(
    async (actionId: DeviceActionId) => {
      const ok = await runBulkDeviceAction(table.selectedDevices, actionId)
      if (ok) {
        table.clearSelection()
      }
    },
    [runBulkDeviceAction, table]
  )

  const handleHideSelected = useCallback(() => {
    table.hideDevices(table.selectedIds)
    table.clearSelection()
  }, [table])

  const handleHideDevice = useCallback(
    (deviceId: string) => {
      table.hideDevices([deviceId])
    },
    [table]
  )

  const allDevicesHidden =
    hasDevices &&
    table.filteredDevices.length === 0 &&
    table.hiddenCount > 0 &&
    !table.filters.showHidden &&
    !table.hasActiveFilters

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
              Search and filter your fleet, select devices for bulk actions, or
              hide rows you do not need in this view. Row actions unlock when
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

      {hasDevices ? (
        <DeviceTableToolbar
          filters={table.filters}
          siteOptions={table.siteOptions}
          modelOptions={table.modelOptions}
          totalDeviceCount={devices.length}
          filteredDeviceCount={table.filteredDevices.length}
          hiddenCount={table.hiddenCount}
          hasActiveFilters={table.hasActiveFilters}
          onChange={table.setFilters}
          onClearFilters={table.clearFilters}
        />
      ) : null}

      <DeviceBulkActionBar
        selectedDevices={table.selectedDevices}
        onClearSelection={table.clearSelection}
        onBulkAction={(actionId) => void handleBulkAction(actionId)}
        onHideSelected={handleHideSelected}
        pending={bulkActionPending}
      />

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
        ) : table.showingFilteredEmpty ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--unifi-text-muted)]">
            No devices match the current filters.
          </div>
        ) : allDevicesHidden ? (
          <div className="space-y-3 px-4 py-10 text-center text-sm text-[var(--unifi-text-muted)]">
            <p>All devices are hidden from this view.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => table.setFilters({ showHidden: true })}
            >
              Show hidden devices ({table.hiddenCount})
            </Button>
          </div>
        ) : viewMode === "list" ? (
          <DeviceListView
            devices={table.filteredDevices}
            selectedIds={table.selectedIds}
            allVisibleSelected={table.allVisibleSelected}
            someVisibleSelected={table.someVisibleSelected}
            onToggleSelect={table.toggleSelected}
            onToggleSelectAll={table.toggleSelectAllVisible}
            onHideDevice={handleHideDevice}
          />
        ) : (
          <DeviceGridView
            devices={table.filteredDevices}
            selectedIds={table.selectedIds}
            onToggleSelect={table.toggleSelected}
            onHideDevice={handleHideDevice}
          />
        )}
      </CardContent>
    </Card>
  )
}
