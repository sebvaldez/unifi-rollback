import { Badge } from "@/components/ui/badge"

export function DeviceScopeBadge() {
  return (
    <Badge
      variant="outline"
      className="border-dashed border-[color-mix(in_srgb,var(--unifi-warning)_40%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-warning)_6%,var(--unifi-surface))] text-[var(--unifi-warning)]"
    >
      Out of scope
    </Badge>
  )
}
