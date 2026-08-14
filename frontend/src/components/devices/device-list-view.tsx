import { DeviceRowActions } from "@/components/devices/device-row-actions"
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
import type { Device } from "@/types/inventory"

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
        {devices.map((device) => (
          <TableRow key={device.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <DeviceIcon device={device} size="sm" />
                <span className="font-medium">{device.name}</span>
              </div>
            </TableCell>
            <TableCell>{device.model}</TableCell>
            <TableCell>{device.firmware}</TableCell>
            <TableCell>{device.site}</TableCell>
            <TableCell>
              <DeviceStatusBadge status={device.status} />
            </TableCell>
            <TableCell className="text-right">
              <DeviceRowActions device={device} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
