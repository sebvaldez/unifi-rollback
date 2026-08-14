import { useCallback, useEffect, useMemo, useState } from "react"
import { uniqueSitesFromDevices } from "@/lib/device-capabilities"
import type { Device } from "@/types/inventory"

export type SiteFilterOption = {
  siteId: string
  siteName: string
  deviceCount: number
}

export type SiteFilterValue = "all" | string

const STORAGE_KEY = "unifi-fleet.device-site-filter"

function readStoredFilter(): SiteFilterValue {
  if (typeof localStorage === "undefined") return "all"
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored && stored.length > 0 ? stored : "all"
}

function writeStoredFilter(value: SiteFilterValue): void {
  if (typeof localStorage === "undefined") return
  if (value === "all") {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, value)
}

export function resetDeviceSiteFilter(): void {
  writeStoredFilter("all")
}

export function buildSiteFilterOptions(devices: Device[]): SiteFilterOption[] {
  const unique = uniqueSitesFromDevices(devices)
  const counts = new Map<string, number>()
  for (const device of devices) {
    counts.set(device.siteId, (counts.get(device.siteId) ?? 0) + 1)
  }

  return unique
    .map(({ siteId, siteName }) => ({
      siteId,
      siteName,
      deviceCount: counts.get(siteId) ?? 0,
    }))
    .sort((a, b) => a.siteName.localeCompare(b.siteName))
}

export function filterDevicesBySite(
  devices: Device[],
  siteFilter: SiteFilterValue
): Device[] {
  if (siteFilter === "all") return devices
  return devices.filter((device) => device.siteId === siteFilter)
}

export function useDeviceSiteFilter(devices: Device[]) {
  const [siteFilter, setSiteFilterState] = useState<SiteFilterValue>(() =>
    readStoredFilter()
  )

  const siteOptions = useMemo<SiteFilterOption[]>(
    () => buildSiteFilterOptions(devices),
    [devices]
  )

  useEffect(() => {
    if (devices.length === 0 && siteFilter !== "all") {
      setSiteFilterState("all")
      writeStoredFilter("all")
    }
  }, [devices.length, siteFilter])

  useEffect(() => {
    if (siteFilter === "all") return
    const stillValid = siteOptions.some((option) => option.siteId === siteFilter)
    if (!stillValid) {
      setSiteFilterState("all")
      writeStoredFilter("all")
    }
  }, [siteFilter, siteOptions])

  const setSiteFilter = useCallback((value: SiteFilterValue) => {
    setSiteFilterState(value)
    writeStoredFilter(value)
  }, [])

  const filteredDevices = useMemo(
    () => filterDevicesBySite(devices, siteFilter),
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
