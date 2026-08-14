import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import type { DeviceTableFilters, SiteFilterOption } from "@/lib/device-table-filters"
import type { DeviceStatusFilter } from "@/lib/device-table-filters"
import { Search, X } from "lucide-react"

const STATUS_OPTIONS: { value: DeviceStatusFilter; label: string }[] = [
  { value: "all", label: "All statuses" },
  { value: "online", label: "Online" },
  { value: "offline", label: "Offline" },
  { value: "adopting", label: "Adopting" },
  { value: "unknown", label: "Unknown" },
  { value: "out-of-scope", label: "Out of scope" },
]

type DeviceTableToolbarProps = {
  filters: DeviceTableFilters
  siteOptions: SiteFilterOption[]
  modelOptions: string[]
  totalDeviceCount: number
  filteredDeviceCount: number
  hiddenCount: number
  hasActiveFilters: boolean
  onChange: (patch: Partial<DeviceTableFilters>) => void
  onClearFilters: () => void
}

const selectClassName = cn(
  "h-8 min-w-[9rem] rounded-md border border-[var(--unifi-border)] bg-[var(--unifi-surface)]",
  "px-2.5 text-sm text-[var(--unifi-text)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--unifi-success)_35%,transparent)]"
)

export function DeviceTableToolbar({
  filters,
  siteOptions,
  modelOptions,
  totalDeviceCount,
  filteredDeviceCount,
  hiddenCount,
  hasActiveFilters,
  onChange,
  onClearFilters,
}: DeviceTableToolbarProps) {
  return (
    <div className="space-y-3 border-b border-[var(--unifi-border)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-[var(--unifi-text-muted)]" />
          <Input
            value={filters.search}
            onChange={(event) => onChange({ search: event.target.value })}
            placeholder="Search name, model, site, MAC…"
            className="pl-8"
            aria-label="Search devices"
          />
        </div>
        {hasActiveFilters ? (
          <Button type="button" variant="ghost" size="sm" onClick={onClearFilters}>
            <X className="size-4" />
            Clear filters
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {siteOptions.length > 0 ? (
          <>
            <label htmlFor="device-filter-site" className="text-xs font-medium text-[var(--unifi-text-muted)]">
              Site
            </label>
            <select
              id="device-filter-site"
              value={filters.siteId}
              onChange={(event) => onChange({ siteId: event.target.value })}
              className={selectClassName}
            >
              <option value="all">All sites ({totalDeviceCount})</option>
              {siteOptions.map((option) => (
                <option key={option.siteId} value={option.siteId}>
                  {option.siteName} ({option.deviceCount})
                </option>
              ))}
            </select>
          </>
        ) : null}

        {modelOptions.length > 0 ? (
          <>
            <label htmlFor="device-filter-model" className="text-xs font-medium text-[var(--unifi-text-muted)]">
              Model
            </label>
            <select
              id="device-filter-model"
              value={filters.model}
              onChange={(event) => onChange({ model: event.target.value })}
              className={selectClassName}
            >
              <option value="all">All models</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </>
        ) : null}

        <label htmlFor="device-filter-status" className="text-xs font-medium text-[var(--unifi-text-muted)]">
          Status
        </label>
        <select
          id="device-filter-status"
          value={filters.status}
          onChange={(event) =>
            onChange({ status: event.target.value as DeviceStatusFilter })
          }
          className={selectClassName}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {hiddenCount > 0 ? (
          <label className="ml-1 inline-flex items-center gap-2 text-sm text-[var(--unifi-text-muted)]">
            <input
              type="checkbox"
              checked={filters.showHidden}
              onChange={(event) => onChange({ showHidden: event.target.checked })}
              className="size-4 accent-[var(--unifi-success)]"
            />
            Show hidden ({hiddenCount})
          </label>
        ) : null}

        {hasActiveFilters && filteredDeviceCount !== totalDeviceCount ? (
          <span className="text-xs text-[var(--unifi-text-muted)]">
            Showing {filteredDeviceCount} of {totalDeviceCount} devices
          </span>
        ) : null}
      </div>
    </div>
  )
}
