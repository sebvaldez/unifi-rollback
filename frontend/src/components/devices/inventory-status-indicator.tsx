import { cn } from "@/lib/utils"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceSettings } from "@/context/device-settings-context"
import { hasFleetInventoryAccess } from "@/lib/device-capabilities"
import { useTick } from "@/hooks/use-interval"
import type { InventoryPollState } from "@/types/inventory"

type InventoryStatusIndicatorProps = {
  poll: InventoryPollState
}

function formatRelativeTime(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 10) return "just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function InventoryStatusIndicator({ poll }: InventoryStatusIndicatorProps) {
  const { settings, loading, ready: settingsReady } = useDeviceSettings()
  const { slots, loading: credentialsLoading } = useCredentials()
  const fleetReady = poll.fleetReady ?? hasFleetInventoryAccess(slots)
  const { isRefreshing, lastRefreshedAt, refreshError, refresh } = poll
  useTick(lastRefreshedAt ? 10_000 : null)

  const isPollMode = settings?.refreshMode === "poll"
  const isManual = settings?.refreshMode === "manual"

  let label = "Loading…"
  if (settingsReady && settings && !credentialsLoading) {
    if (!fleetReady) {
      label = "Fleet key required"
    } else if (isRefreshing) {
      label = "Refreshing inventory…"
    } else if (isPollMode) {
      label = `Polling every ${settings.pollIntervalSeconds}s`
    } else if (lastRefreshedAt) {
      label = `Updated ${formatRelativeTime(lastRefreshedAt)}`
    } else {
      label = "Manual refresh"
    }
  } else if (loading || credentialsLoading) {
    label = "Loading…"
  }

  const clickable = fleetReady && isManual && !isRefreshing && settingsReady

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => {
        if (clickable) void refresh()
      }}
      className={cn(
        "inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
        "border-[var(--unifi-border)] bg-[var(--unifi-surface)]",
        clickable &&
          "cursor-pointer hover:border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-border))]",
        !clickable && "cursor-default"
      )}
      title={
        !fleetReady
          ? "Add and validate a Site Manager key in Settings → Credentials"
          : refreshError
          ? refreshError
          : clickable
            ? "Click to refresh inventory"
            : isPollMode
              ? "Automatic inventory polling is active"
              : undefined
      }
    >
      <span className="relative flex size-2.5 shrink-0 items-center justify-center">
        {isRefreshing ? (
          <>
            <span className="inventory-status-ring absolute inset-0 rounded-full bg-[var(--unifi-success)]" />
            <span className="inventory-status-ring inventory-status-ring-delay absolute inset-0 rounded-full bg-[var(--unifi-success)]" />
          </>
        ) : isPollMode && fleetReady ? (
          <span className="inventory-status-breathe absolute inset-0 rounded-full bg-[var(--unifi-success)]" />
        ) : null}
        <span
          className={cn(
            "relative z-10 size-2 rounded-full",
            fleetReady ? "bg-[var(--unifi-success)]" : "bg-[var(--unifi-text-muted)]",
            isRefreshing && "inventory-status-core-active",
            isPollMode && fleetReady && !isRefreshing && "inventory-status-core-live"
          )}
        />
      </span>
      <span className="font-medium text-[var(--unifi-text)]">{label}</span>
    </button>
  )
}
