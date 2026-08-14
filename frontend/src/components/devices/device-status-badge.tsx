import { Badge } from "@/components/ui/badge"
import type { Device, DeviceStatus } from "@/types/inventory"

const statusLabels: Record<DeviceStatus, string> = {
  online: "Online",
  offline: "Offline",
  adopting: "Adopting",
  unknown: "Unknown",
}

type DeviceStatusBadgeProps = {
  status: DeviceStatus
}

export function DeviceStatusBadge({ status }: DeviceStatusBadgeProps) {
  const online = status === "online"

  return (
    <Badge
      variant="outline"
      className={
        online
          ? "border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-success)_12%,var(--unifi-surface))] text-[var(--unifi-success)]"
          : "border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
      }
    >
      {statusLabels[status]}
    </Badge>
  )
}
