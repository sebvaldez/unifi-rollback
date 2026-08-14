import { describe, expect, it } from "vitest"
import { getBulkActionAvailability } from "@/lib/device-bulk-actions"
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
  },
}

describe("getBulkActionAvailability", () => {
  it("reports eligible count for enabled devices only", () => {
    const availability = getBulkActionAvailability(
      [onlineDevice, { ...onlineDevice, id: "dev-2", inScope: false }],
      "restart"
    )
    expect(availability.enabled).toBe(true)
    expect(availability.eligibleCount).toBe(1)
  })

  it("is disabled when no selected devices can run the action", () => {
    const availability = getBulkActionAvailability(
      [{ ...onlineDevice, capabilities: EMPTY_DEVICE_CAPABILITIES }],
      "restart"
    )
    expect(availability.enabled).toBe(false)
    expect(availability.eligibleCount).toBe(0)
  })
})
