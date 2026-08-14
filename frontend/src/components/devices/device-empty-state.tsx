import { Button } from "@/components/ui/button"
import { Router, Settings } from "lucide-react"

type DeviceEmptyStateProps = {
  onOpenSettings?: () => void
}

export function DeviceEmptyState({ onOpenSettings }: DeviceEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--unifi-blue)_10%,var(--unifi-surface))] text-[var(--unifi-blue)]">
        <Router className="size-7" />
      </div>
      <h3 className="text-base font-semibold text-[var(--unifi-text)]">
        No devices yet
      </h3>
      <p className="mt-2 max-w-sm text-sm text-[var(--unifi-text-muted)]">
        Add your Site Manager key under Settings → Credentials, then refresh
        inventory to pull devices from your UniFi sites.
      </p>
      {onOpenSettings ? (
        <Button
          type="button"
          variant="outline"
          className="mt-6"
          onClick={onOpenSettings}
        >
          <Settings className="size-4" />
          Open Settings
        </Button>
      ) : null}
    </div>
  )
}
