import { DeviceRowActions } from "@/components/devices/device-row-actions"
import { DeviceScopeBadge } from "@/components/devices/device-scope-badge"
import { DeviceStatusBadge } from "@/components/devices/device-status-badge"
import { DeviceIcon } from "@/components/devices/device-icon"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"
import { isGhostDevice, type Device } from "@/types/inventory"
import { EyeOff } from "lucide-react"

type DeviceListViewProps = {
  devices: Device[]
  selectedIds: ReadonlySet<string>
  allVisibleSelected: boolean
  someVisibleSelected: boolean
  onToggleSelect: (deviceId: string) => void
  onToggleSelectAll: () => void
  onHideDevice: (deviceId: string) => void
}

export function DeviceListView({
  devices,
  selectedIds,
  allVisibleSelected,
  someVisibleSelected,
  onToggleSelect,
  onToggleSelectAll,
  onHideDevice,
}: DeviceListViewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[1%]">
            <Checkbox
              aria-label="Select all visible devices"
              checked={allVisibleSelected}
              indeterminate={someVisibleSelected && !allVisibleSelected}
              onCheckedChange={() => onToggleSelectAll()}
            />
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Model</TableHead>
          <TableHead>Firmware</TableHead>
          <TableHead>Site</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-[1%] text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {devices.map((device) => {
          const ghost = isGhostDevice(device)
          const selected = selectedIds.has(device.id)
          return (
            <TableRow
              key={device.id}
              data-state={selected ? "selected" : undefined}
              className={cn(
                selected &&
                  "bg-[color-mix(in_srgb,var(--unifi-blue)_5%,var(--unifi-surface))]",
                ghost &&
                  "border-dashed bg-[color-mix(in_srgb,var(--unifi-warning)_4%,var(--unifi-surface))] opacity-70"
              )}
            >
              <TableCell>
                <Checkbox
                  aria-label={`Select ${device.name}`}
                  checked={selected}
                  onCheckedChange={() => onToggleSelect(device.id)}
                />
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <DeviceIcon device={device} size="sm" />
                  <span
                    className={cn(
                      "font-medium",
                      ghost &&
                        "text-[var(--unifi-text-muted)] line-through decoration-dashed"
                    )}
                  >
                    {device.name}
                  </span>
                </div>
              </TableCell>
              <TableCell className={ghost ? "text-[var(--unifi-text-muted)]" : undefined}>
                {device.model}
              </TableCell>
              <TableCell className={ghost ? "text-[var(--unifi-text-muted)]" : undefined}>
                {device.firmware}
              </TableCell>
              <TableCell className={ghost ? "text-[var(--unifi-text-muted)]" : undefined}>
                {device.site}
              </TableCell>
              <TableCell>
                {ghost ? <DeviceScopeBadge /> : <DeviceStatusBadge status={device.status} />}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Tooltip content="Hide this device from the table">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-[var(--unifi-text-muted)] hover:text-[var(--unifi-text)]"
                      aria-label={`Hide ${device.name}`}
                      onClick={() => onHideDevice(device.id)}
                    >
                      <EyeOff className="size-4" />
                    </Button>
                  </Tooltip>
                  <DeviceRowActions device={device} />
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
