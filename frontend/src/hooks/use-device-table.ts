import { useCallback, useEffect, useMemo, useState } from "react"
import {
  applyDeviceTableFilters,
  buildSiteFilterOptions,
  countHiddenDevices,
  DEFAULT_DEVICE_TABLE_FILTERS,
  hasActiveTableFilters,
  uniqueModelsFromDevices,
  type DeviceTableFilters,
} from "@/lib/device-table-filters"
import { useHiddenDevices } from "@/hooks/use-hidden-devices"
import type { Device } from "@/types/inventory"

const SITE_FILTER_STORAGE_KEY = "unifi-fleet.device-site-filter"

function readStoredSiteFilter(): DeviceTableFilters["siteId"] {
  if (typeof localStorage === "undefined") return "all"
  const stored = localStorage.getItem(SITE_FILTER_STORAGE_KEY)
  return stored && stored.length > 0 ? stored : "all"
}

function writeStoredSiteFilter(siteId: DeviceTableFilters["siteId"]): void {
  if (typeof localStorage === "undefined") return
  if (siteId === "all") {
    localStorage.removeItem(SITE_FILTER_STORAGE_KEY)
    return
  }
  localStorage.setItem(SITE_FILTER_STORAGE_KEY, siteId)
}

export function resetDeviceSiteFilter(): void {
  writeStoredSiteFilter("all")
}

export function useDeviceTable(devices: Device[]) {
  const [filters, setFilters] = useState<DeviceTableFilters>(() => ({
    ...DEFAULT_DEVICE_TABLE_FILTERS,
    siteId: readStoredSiteFilter(),
  }))
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  const deviceIds = useMemo(() => devices.map((device) => device.id), [devices])
  const { hiddenIds, hideDevices, unhideDevices } = useHiddenDevices(deviceIds)

  const siteOptions = useMemo(() => buildSiteFilterOptions(devices), [devices])
  const modelOptions = useMemo(() => uniqueModelsFromDevices(devices), [devices])

  const filteredDevices = useMemo(
    () => applyDeviceTableFilters(devices, filters, hiddenIds),
    [devices, filters, hiddenIds]
  )

  const hiddenCount = useMemo(
    () => countHiddenDevices(devices, hiddenIds),
    [devices, hiddenIds]
  )

  useEffect(() => {
    if (devices.length === 0 && filters.siteId !== "all") {
      setFilters((current) => ({ ...current, siteId: "all" }))
      writeStoredSiteFilter("all")
    }
  }, [devices.length, filters.siteId])

  useEffect(() => {
    if (filters.siteId === "all") return
    const stillValid = siteOptions.some((option) => option.siteId === filters.siteId)
    if (!stillValid) {
      setFilters((current) => ({ ...current, siteId: "all" }))
      writeStoredSiteFilter("all")
    }
  }, [filters.siteId, siteOptions])

  useEffect(() => {
    setSelectedIds((current) => {
      const visible = new Set(filteredDevices.map((device) => device.id))
      const next = new Set<string>()
      for (const id of current) {
        if (visible.has(id)) next.add(id)
      }
      return next.size === current.size ? current : next
    })
  }, [filteredDevices])

  const setFiltersPartial = useCallback((patch: Partial<DeviceTableFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch }
      if (patch.siteId !== undefined) {
        writeStoredSiteFilter(patch.siteId)
      }
      return next
    })
  }, [])

  const clearFilters = useCallback(() => {
    setFilters((current) => ({
      ...DEFAULT_DEVICE_TABLE_FILTERS,
      siteId: current.siteId,
    }))
  }, [])

  const toggleSelected = useCallback((deviceId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(deviceId)) next.delete(deviceId)
      else next.add(deviceId)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedIds((current) => {
      const visibleIds = filteredDevices.map((device) => device.id)
      const allSelected =
        visibleIds.length > 0 && visibleIds.every((id) => current.has(id))
      if (allSelected) return new Set()
      return new Set(visibleIds)
    })
  }, [filteredDevices])

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const selectedDevices = useMemo(
    () => filteredDevices.filter((device) => selectedIds.has(device.id)),
    [filteredDevices, selectedIds]
  )

  const allVisibleSelected =
    filteredDevices.length > 0 &&
    filteredDevices.every((device) => selectedIds.has(device.id))
  const someVisibleSelected = filteredDevices.some((device) =>
    selectedIds.has(device.id)
  )

  return {
    filters,
    setFilters: setFiltersPartial,
    clearFilters,
    siteOptions,
    modelOptions,
    filteredDevices,
    hiddenIds,
    hiddenCount,
    hideDevices,
    unhideDevices,
    selectedIds,
    selectedDevices,
    toggleSelected,
    toggleSelectAllVisible,
    clearSelection,
    allVisibleSelected,
    someVisibleSelected,
    hasMultipleSites: siteOptions.length > 1,
    hasActiveFilters: hasActiveTableFilters(filters),
    showingFilteredEmpty:
      devices.length > 0 && filteredDevices.length === 0 && hasActiveTableFilters(filters),
  }
}

export type DeviceTableState = ReturnType<typeof useDeviceTable>
