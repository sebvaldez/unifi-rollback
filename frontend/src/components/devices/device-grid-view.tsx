import { DeviceRowActions } from "@/components/devices/device-row-actions"
import { DeviceStatusBadge } from "@/components/devices/device-status-badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { Device } from "@/types/inventory"

type DeviceGridViewProps = {
  devices: Device[]
}

export function DeviceGridView({ devices }: DeviceGridViewProps) {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => (
        <Card
          key={device.id}
          className="border-[var(--unifi-border)] shadow-sm"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-base">
                  {device.name}
                </CardTitle>
                <CardDescription className="truncate">
                  {device.model} · {device.site}
                </CardDescription>
              </div>
              <DeviceStatusBadge status={device.status} />
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
      ))}
    </div>
  )
}
