import { Button } from "@/components/ui/button"
import { useDeviceInventory } from "@/context/device-inventory-context"
import {
  DEVICE_ACTIONS,
  getDeviceActionAvailability,
} from "@/lib/device-actions"
import { cn } from "@/lib/utils"
import type { Device, DeviceActionId } from "@/types/inventory"
import { HardDriveDownload, MapPin, RotateCcw } from "lucide-react"

const actionIcons: Record<DeviceActionId, typeof MapPin> = {
  locate: MapPin,
  restart: RotateCcw,
  rollback: HardDriveDownload,
}

type DeviceRowActionsProps = {
  device: Device
  compact?: boolean
}

export function DeviceRowActions({ device, compact }: DeviceRowActionsProps) {
  const { runDeviceAction, isActionPending, actionError, clearActionError } =
    useDeviceInventory()

  async function handleAction(actionId: DeviceActionId) {
    clearActionError()
    const availability = getDeviceActionAvailability(device, actionId)
    if (!availability.enabled) return

    try {
      await runDeviceAction(device, actionId)
    } catch {
      // Error surfaced via context actionError
    }
  }

  return (
    <div className={cn("flex items-center gap-1", compact && "flex-wrap")}>
      {DEVICE_ACTIONS.map((action) => {
        const availability = getDeviceActionAvailability(device, action.id)
        const Icon = actionIcons[action.id]
        const pending = isActionPending(device.id, action.id)
        const title = availability.enabled
          ? action.description
          : (availability.reason ?? action.description)

        return (
          <Button
            key={action.id}
            type="button"
            variant="ghost"
            size="sm"
            disabled={!availability.enabled || pending}
            title={title}
            aria-label={action.label}
            className={cn(
              "h-8 px-2 text-[var(--unifi-text-muted)] hover:text-[var(--unifi-text)]",
              action.id === "locate" &&
                availability.enabled &&
                "hover:text-[var(--unifi-blue)]"
            )}
            onClick={() => void handleAction(action.id)}
          >
            <Icon className={cn("size-4", pending && "animate-pulse")} />
            {!compact ? (
              <span className="hidden xl:inline">{action.label}</span>
            ) : null}
          </Button>
        )
      })}
      {actionError ? (
        <span className="sr-only" role="status">
          {actionError}
        </span>
      ) : null}
    </div>
  )
}
