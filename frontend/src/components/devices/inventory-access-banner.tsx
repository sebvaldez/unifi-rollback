import { Button } from "@/components/ui/button"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import {
  hasFleetInventoryAccess,
  sitesMissingDeviceControl,
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
  const missingSites = sitesMissingDeviceControl(devices, slots)

  if (fleetReady && missingSites.length === 0) {
    return null
  }

  let message: string
  if (!fleetReady) {
    message =
      "Fleet inventory is limited — add and validate your Site Manager key in Settings → Credentials."
  } else if (missingSites.length === 1) {
    message = `Restart actions need a Network Integration key for ${missingSites[0].siteName}. Add it in Settings → Credentials.`
  } else {
    const names = missingSites.map((site) => site.siteName).join(", ")
    message = `Network Integration keys are missing for ${names}. Restart actions stay disabled until keys are configured.`
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
