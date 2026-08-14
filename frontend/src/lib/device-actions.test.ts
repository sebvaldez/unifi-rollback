import { describe, expect, it } from "vitest"
import { getDeviceActionAvailability } from "@/lib/device-actions"
import {
  createMockDeviceFleet,
  hasMockDevices,
  isMockDevice,
  mergeMockDevices,
  stripMockDevices,
} from "@/lib/mock-devices"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

const onlineDevice: Device = {
  id: "dev-1",
  siteId: "home",
  name: "AP",
  model: "U7-Pro-XGS",
  firmware: "7.0.0",
  status: "online",
  site: "Home Office",
  capabilities: {
    ...EMPTY_DEVICE_CAPABILITIES,
    restart: true,
    locate: true,
  },
}

describe("getDeviceActionAvailability", () => {
  it("explains missing restart capability with site name", () => {
    const availability = getDeviceActionAvailability(
      { ...onlineDevice, capabilities: EMPTY_DEVICE_CAPABILITIES },
      "restart"
    )
    expect(availability.enabled).toBe(false)
    expect(availability.reason).toContain("Home Office")
  })

  it("explains missing locate capability as classic admin requirement", () => {
    const availability = getDeviceActionAvailability(
      { ...onlineDevice, capabilities: EMPTY_DEVICE_CAPABILITIES },
      "locate"
    )
    expect(availability.enabled).toBe(false)
    expect(availability.reason).toContain("Classic admin")
  })

  it("enables restart when capability is present and device is online", () => {
    const availability = getDeviceActionAvailability(onlineDevice, "restart")
    expect(availability.enabled).toBe(true)
  })
})

describe("mock-devices", () => {
  it("creates six mock devices for the dev fleet", () => {
    expect(createMockDeviceFleet()).toHaveLength(6)
  })

  it("tags mock ids and supports merge/strip helpers", () => {
    const mocks = createMockDeviceFleet()
    expect(isMockDevice(mocks[0])).toBe(true)
    expect(hasMockDevices(mergeMockDevices([], mocks))).toBe(true)
    expect(stripMockDevices(mocks)).toEqual([])
  })
})
