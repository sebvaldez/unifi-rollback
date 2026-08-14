import { describe, expect, it } from "vitest"
import {
  applyDeviceTableFilters,
  DEFAULT_DEVICE_TABLE_FILTERS,
  deviceMatchesSearch,
  uniqueModelsFromDevices,
} from "@/lib/device-table-filters"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

function device(overrides: Partial<Device> & Pick<Device, "id">): Device {
  return {
    siteId: "site-a",
    name: "Hall AP",
    model: "U7-Pro-XGS",
    firmware: "7.0.0",
    status: "online",
    site: "Home",
    capabilities: { ...EMPTY_DEVICE_CAPABILITIES },
    ...overrides,
  }
}

describe("deviceMatchesSearch", () => {
  it("matches device name case-insensitively", () => {
    expect(deviceMatchesSearch(device({ id: "d1", name: "1411 Junction" }), "1411")).toBe(
      true
    )
    expect(deviceMatchesSearch(device({ id: "d1", name: "1411 Junction" }), "junction")).toBe(
      true
    )
  })

  it("matches model and mac", () => {
    expect(
      deviceMatchesSearch(
        device({ id: "d1", model: "G6 PTZ", mac: "aa:bb:cc:dd:ee:01" }),
        "aa:bb"
      )
    ).toBe(true)
  })
})

describe("applyDeviceTableFilters", () => {
  const devices = [
    device({ id: "d1", siteId: "site-a", model: "U7-Pro-XGS", status: "online" }),
    device({ id: "d2", siteId: "site-b", model: "G6 PTZ", status: "offline" }),
    device({
      id: "d3",
      siteId: "site-a",
      model: "G6 PTZ",
      status: "offline",
      inScope: false,
    }),
  ]

  it("filters by site, model, status, and search together", () => {
    const filtered = applyDeviceTableFilters(
      devices,
      {
        ...DEFAULT_DEVICE_TABLE_FILTERS,
        siteId: "site-a",
        model: "G6 PTZ",
        status: "offline",
        search: "d3",
      },
      new Set()
    )

    expect(filtered.map((entry) => entry.id)).toEqual(["d3"])
  })

  it("excludes hidden devices unless showHidden is enabled", () => {
    const hidden = new Set(["d1"])
    expect(
      applyDeviceTableFilters(devices, DEFAULT_DEVICE_TABLE_FILTERS, hidden).map(
        (entry) => entry.id
      )
    ).toEqual(["d2", "d3"])

    expect(
      applyDeviceTableFilters(
        devices,
        { ...DEFAULT_DEVICE_TABLE_FILTERS, showHidden: true },
        hidden
      ).map((entry) => entry.id)
    ).toEqual(["d1", "d2", "d3"])
  })

  it("filters out-of-scope ghost devices", () => {
    const filtered = applyDeviceTableFilters(
      devices,
      { ...DEFAULT_DEVICE_TABLE_FILTERS, status: "out-of-scope" },
      new Set()
    )
    expect(filtered.map((entry) => entry.id)).toEqual(["d3"])
  })
})

describe("uniqueModelsFromDevices", () => {
  it("returns sorted unique models", () => {
    expect(
      uniqueModelsFromDevices([
        device({ id: "d1", model: "G6 PTZ" }),
        device({ id: "d2", model: "U7-Pro-XGS" }),
        device({ id: "d3", model: "G6 PTZ" }),
      ])
    ).toEqual(["G6 PTZ", "U7-Pro-XGS"])
  })
})
