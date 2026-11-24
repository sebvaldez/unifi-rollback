import { Button } from "@/components/ui/button"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import {
  hasFleetInventoryAccess,
  sitesWithoutRestartAccess,
} from "@/lib/device-capabilities"
import { AlertTriangle, Settings } from "lucide-react"

type InventoryAccessBannerProps = {
  onOpenSettings?: () => void
}

export function InventoryAccessBanner({
  onOpenSettings,
}: InventoryAccessBannerProps) {
  const { slots } = useCredentials()
  const { devices } = useDeviceInventory()

  if (devices.length === 0) {
    return null
  }

  const fleetReady = hasFleetInventoryAccess(slots)
  const missingSites = sitesWithoutRestartAccess(devices, slots)

  if (fleetReady && missingSites.length === 0) {
    return null
  }

  let message: string
  if (!fleetReady) {
    message =
      "Add and validate your Site Manager key in Settings → Credentials to load inventory and enable restart and firmware checks."
  } else {
    const names = missingSites.map((site) => site.siteName).join(", ")
    message = `Restart is unavailable for ${names}. Revalidate Fleet access in Settings → Credentials. The console needs UniFi OS 5.0.3+ and Network admin rights.`
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-warning)_8%,var(--unifi-surface))] px-4 py-3 text-sm text-[var(--unifi-text)]">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--unifi-warning)]" />
        <p>{message}</p>
      </div>
      {onOpenSettings ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          Credentials
        </Button>
      ) : null}
    </div>
  )
}
