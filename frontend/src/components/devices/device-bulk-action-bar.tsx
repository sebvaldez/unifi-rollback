import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import {
  getBulkActionAvailability,
  type BulkActionAvailability,
} from "@/lib/device-bulk-actions"
import type { Device, DeviceActionId } from "@/types/inventory"
import { EyeOff, MapPin, RotateCcw, X } from "lucide-react"

type DeviceBulkActionBarProps = {
  selectedDevices: Device[]
  onClearSelection: () => void
  onBulkAction: (actionId: DeviceActionId) => void
  onHideSelected: () => void
  pending?: boolean
}

function bulkTooltip(action: BulkActionAvailability): string {
  if (action.enabled) {
    return `${action.label} on ${action.eligibleCount} selected device${action.eligibleCount === 1 ? "" : "s"}`
  }
  return action.reason ?? `${action.label} unavailable`
}

export function DeviceBulkActionBar({
  selectedDevices,
  onClearSelection,
  onBulkAction,
  onHideSelected,
  pending = false,
}: DeviceBulkActionBarProps) {
  if (selectedDevices.length === 0) return null

  const locate = getBulkActionAvailability(selectedDevices, "locate")
  const restart = getBulkActionAvailability(selectedDevices, "restart")

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--unifi-blue)_25%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-blue)_6%,var(--unifi-surface))] px-4 py-3">
      <p className="text-sm font-medium text-[var(--unifi-text)]">
        {selectedDevices.length} selected
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip content={bulkTooltip(locate)}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!locate.enabled || pending}
            onClick={() => onBulkAction("locate")}
          >
            <MapPin className="size-4" />
            Locate
          </Button>
        </Tooltip>
        <Tooltip content={bulkTooltip(restart)}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!restart.enabled || pending}
            onClick={() => onBulkAction("restart")}
          >
            <RotateCcw className="size-4" />
            Restart
          </Button>
        </Tooltip>
        <Button type="button" variant="outline" size="sm" onClick={onHideSelected}>
          <EyeOff className="size-4" />
          Hide
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClearSelection}>
          <X className="size-4" />
          Clear
        </Button>
      </div>
    </div>
  )
}
