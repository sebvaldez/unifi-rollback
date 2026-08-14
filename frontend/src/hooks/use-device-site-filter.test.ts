import { describe, expect, it } from "vitest"
import {
  buildSiteFilterOptions,
  filterDevicesBySite,
  resetDeviceSiteFilter,
} from "@/hooks/use-device-site-filter"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

function device(siteId: string, site: string, id: string): Device {
  return {
    id,
    siteId,
    site,
    name: id,
    model: "Test",
    firmware: "1.0.0",
    status: "online",
    capabilities: { ...EMPTY_DEVICE_CAPABILITIES },
  }
}

describe("buildSiteFilterOptions", () => {
  it("returns sorted site options with device counts", () => {
    const options = buildSiteFilterOptions([
      device("site-b", "Beta", "d1"),
      device("site-a", "Alpha", "d2"),
      device("site-b", "Beta", "d3"),
    ])

    expect(options).toEqual([
      { siteId: "site-a", siteName: "Alpha", deviceCount: 1 },
      { siteId: "site-b", siteName: "Beta", deviceCount: 2 },
    ])
  })
})

describe("filterDevicesBySite", () => {
  it("returns all devices when filter is all", () => {
    const devices = [
      device("site-a", "Alpha", "d1"),
      device("site-b", "Beta", "d2"),
    ]
    expect(filterDevicesBySite(devices, "all")).toHaveLength(2)
  })

  it("filters devices by site id", () => {
    const devices = [
      device("site-a", "Alpha", "d1"),
      device("site-b", "Beta", "d2"),
      device("site-a", "Alpha", "d3"),
    ]
    expect(filterDevicesBySite(devices, "site-a").map((entry) => entry.id)).toEqual([
      "d1",
      "d3",
    ])
  })
})

describe("resetDeviceSiteFilter", () => {
  it("clears persisted site filter", () => {
    localStorage.setItem("unifi-fleet.device-site-filter", "site-a")
    resetDeviceSiteFilter()
    expect(localStorage.getItem("unifi-fleet.device-site-filter")).toBeNull()
  })
})
