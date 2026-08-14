import { useCallback, useEffect, useMemo, useState } from "react"
import {
  applyDeviceTableFilters,
  buildSiteFilterOptions,
  DEFAULT_DEVICE_TABLE_FILTERS,
  type SiteFilterOption,
} from "@/lib/device-table-filters"
import type { Device } from "@/types/inventory"

export type { SiteFilterOption }

export type SiteFilterValue = "all" | string

/** @deprecated Use useDeviceTable instead. Kept for legacy imports and tests. */
export function useDeviceSiteFilter(devices: Device[]) {
  const [siteFilter, setSiteFilterState] = useState<SiteFilterValue>("all")

  const siteOptions = useMemo<SiteFilterOption[]>(
    () => buildSiteFilterOptions(devices),
    [devices]
  )

  useEffect(() => {
    if (devices.length === 0 && siteFilter !== "all") {
      setSiteFilterState("all")
    }
  }, [devices.length, siteFilter])

  useEffect(() => {
    if (siteFilter === "all") return
    const stillValid = siteOptions.some((option) => option.siteId === siteFilter)
    if (!stillValid) {
      setSiteFilterState("all")
    }
  }, [siteFilter, siteOptions])

  const setSiteFilter = useCallback((value: SiteFilterValue) => {
    setSiteFilterState(value)
  }, [])

  const filteredDevices = useMemo(
    () =>
      applyDeviceTableFilters(
        devices,
        { ...DEFAULT_DEVICE_TABLE_FILTERS, siteId: siteFilter },
        new Set()
      ),
    [devices, siteFilter]
  )

  return {
    siteFilter,
    setSiteFilter,
    siteOptions,
    filteredDevices,
    hasMultipleSites: siteOptions.length > 1,
  }
}

export { buildSiteFilterOptions }

export function filterDevicesBySite(
  devices: Device[],
  siteFilter: SiteFilterValue
): Device[] {
  return applyDeviceTableFilters(
    devices,
    { ...DEFAULT_DEVICE_TABLE_FILTERS, siteId: siteFilter },
    new Set()
  )
}
