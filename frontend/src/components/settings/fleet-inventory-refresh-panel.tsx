import { Button } from "@/components/ui/button"
import {
  formatRelativeTime,
  useFleetInventoryRefresh,
} from "@/hooks/use-fleet-inventory-refresh"
import { cn } from "@/lib/utils"
import type { CredentialSlot } from "@/types/credentials"
import { RefreshCw } from "lucide-react"

type FleetInventoryRefreshPanelProps = {
  slot: CredentialSlot
  disabled?: boolean
}

export function FleetInventoryRefreshPanel({
  slot,
  disabled = false,
}: FleetInventoryRefreshPanelProps) {
  const {
    refresh,
    isRefreshing,
    lastRefreshedAt,
    refreshError,
    fleetReady,
    deviceCount,
  } = useFleetInventoryRefresh()

  if (slot.kind !== "site_manager" || slot.status !== "configured") {
    return null
  }

  if (!slot.capabilities.includes("inventory")) {
    return null
  }

  const statusLine = isRefreshing
    ? "Fetching devices from Site Manager…"
    : lastRefreshedAt
      ? `${deviceCount} device${deviceCount === 1 ? "" : "s"} · updated ${formatRelativeTime(lastRefreshedAt)}`
      : deviceCount > 0
        ? `${deviceCount} device${deviceCount === 1 ? "" : "s"} in local inventory`
        : "No local inventory yet — refresh to pull devices from the fleet."

  return (
    <section className="space-y-3 rounded-md border border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-surface-elevated,var(--unifi-surface))_60%,var(--unifi-surface))] p-3">
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-[var(--unifi-text)]">
          Fleet inventory
        </h3>
        <p className="text-xs text-[var(--unifi-text-muted)]">
          Pull the latest device list from Site Manager without leaving Settings.
        </p>
      </div>

      <p className="text-sm text-[var(--unifi-text-muted)]">{statusLine}</p>

      {refreshError ? (
        <p className="text-xs text-[var(--unifi-warning)]">{refreshError}</p>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || !fleetReady || isRefreshing}
        onClick={() => void refresh()}
      >
        <RefreshCw className={cn("size-3.5", isRefreshing && "animate-spin")} />
        {isRefreshing ? "Refreshing…" : "Refresh inventory"}
      </Button>
    </section>
  )
}
