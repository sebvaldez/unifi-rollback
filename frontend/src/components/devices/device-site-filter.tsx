import { cn } from "@/lib/utils"
import type { SiteFilterOption, SiteFilterValue } from "@/hooks/use-device-site-filter"

type DeviceSiteFilterProps = {
  siteFilter: SiteFilterValue
  siteOptions: SiteFilterOption[]
  totalDeviceCount: number
  filteredDeviceCount: number
  onChange: (value: SiteFilterValue) => void
}

export function DeviceSiteFilter({
  siteFilter,
  siteOptions,
  totalDeviceCount,
  filteredDeviceCount,
  onChange,
}: DeviceSiteFilterProps) {
  if (siteOptions.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--unifi-border)] px-4 py-3">
      <label
        htmlFor="device-site-filter"
        className="text-xs font-medium text-[var(--unifi-text-muted)]"
      >
        Site
      </label>
      <select
        id="device-site-filter"
        value={siteFilter}
        onChange={(event) => onChange(event.target.value as SiteFilterValue)}
        className={cn(
          "h-8 min-w-[12rem] rounded-md border border-[var(--unifi-border)] bg-[var(--unifi-surface)]",
          "px-2.5 text-sm text-[var(--unifi-text)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--unifi-success)_35%,transparent)]"
        )}
      >
        <option value="all">
          All sites ({totalDeviceCount})
        </option>
        {siteOptions.map((option) => (
          <option key={option.siteId} value={option.siteId}>
            {option.siteName} ({option.deviceCount})
          </option>
        ))}
      </select>
      {siteFilter !== "all" ? (
        <span className="text-xs text-[var(--unifi-text-muted)]">
          Showing {filteredDeviceCount} of {totalDeviceCount} devices
        </span>
      ) : null}
    </div>
  )
}
