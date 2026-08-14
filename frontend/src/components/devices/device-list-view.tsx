import { DeviceRowActions } from "@/components/devices/device-row-actions"
import { DeviceScopeBadge } from "@/components/devices/device-scope-badge"
import { DeviceStatusBadge } from "@/components/devices/device-status-badge"
import { DeviceIcon } from "@/components/devices/device-icon"
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

type DeviceListViewProps = {
  devices: Device[]
}

export function DeviceListView({ devices }: DeviceListViewProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
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
          return (
          <TableRow
            key={device.id}
            className={cn(
              ghost &&
                "border-dashed bg-[color-mix(in_srgb,var(--unifi-warning)_4%,var(--unifi-surface))] opacity-70"
            )}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <DeviceIcon device={device} size="sm" />
                <span
                  className={cn(
                    "font-medium",
                    ghost && "text-[var(--unifi-text-muted)] line-through decoration-dashed"
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
              <DeviceRowActions device={device} />
            </TableCell>
          </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
