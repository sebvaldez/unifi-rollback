import { DeviceRowActions } from "@/components/devices/device-row-actions"
import { DeviceScopeBadge } from "@/components/devices/device-scope-badge"
import { DeviceStatusBadge } from "@/components/devices/device-status-badge"
import { DeviceIcon } from "@/components/devices/device-icon"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { isGhostDevice, type Device } from "@/types/inventory"
import { EyeOff } from "lucide-react"

type DeviceGridViewProps = {
  devices: Device[]
  selectedIds: ReadonlySet<string>
  onToggleSelect: (deviceId: string) => void
  onHideDevice: (deviceId: string) => void
}

export function DeviceGridView({
  devices,
  selectedIds,
  onToggleSelect,
  onHideDevice,
}: DeviceGridViewProps) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => {
        const ghost = isGhostDevice(device)
        const selected = selectedIds.has(device.id)
        return (
          <Card
            key={device.id}
            className={cn(
              "border-[var(--unifi-border)] shadow-sm",
              selected &&
                "border-[color-mix(in_srgb,var(--unifi-blue)_35%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-blue)_4%,var(--unifi-surface))]",
              ghost &&
                "border-dashed border-[color-mix(in_srgb,var(--unifi-warning)_35%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-warning)_4%,var(--unifi-surface))] opacity-80"
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <Checkbox
                    aria-label={`Select ${device.name}`}
                    checked={selected}
                    onCheckedChange={() => onToggleSelect(device.id)}
                    className="mt-1"
                  />
                  <DeviceIcon device={device} size="lg" />
                  <div className="min-w-0">
                    <CardTitle
                      className={cn(
                        "truncate text-base",
                        ghost &&
                          "text-[var(--unifi-text-muted)] line-through decoration-dashed"
                      )}
                    >
                      {device.name}
                    </CardTitle>
                    <CardDescription className="truncate">
                      {device.model} · {device.site}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip content="Hide this device from the table">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[var(--unifi-text-muted)]"
                      aria-label={`Hide ${device.name}`}
                      onClick={() => onHideDevice(device.id)}
                    >
                      <EyeOff className="size-4" />
                    </Button>
                  </Tooltip>
                  {ghost ? (
                    <DeviceScopeBadge />
                  ) : (
                    <DeviceStatusBadge status={device.status} />
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-[var(--unifi-text-muted)]">Firmware</dt>
                  <dd className="font-medium text-[var(--unifi-text)]">
                    {device.firmware}
                  </dd>
                </div>
                {device.mac ? (
                  <div>
                    <dt className="text-[var(--unifi-text-muted)]">MAC</dt>
                    <dd className="font-mono text-xs text-[var(--unifi-text)]">
                      {device.mac}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <DeviceRowActions device={device} compact />
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
