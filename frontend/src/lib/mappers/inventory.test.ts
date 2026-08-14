import { describe, expect, it } from "vitest"
import { toDevice, toCredentialSlot } from "@/lib/mappers/inventory"
import { inventory, main } from "wailsjs/go/models"

describe("toDevice", () => {
  it("maps scope fields and normalizes unknown status", () => {
    const model = new inventory.Device({
      id: "dev-1",
      siteId: "site-a",
      name: "AP",
      model: "U6-Pro",
      firmware: "6.6.65",
      status: "connected",
      site: "Home",
      mac: "aa:bb:cc:dd:ee:01",
      inScope: false,
      scopeLostAt: "2026-08-13T00:00:00Z",
      capabilities: new inventory.DeviceCapabilities({
        inventory: true,
        restart: false,
        locate: false,
        rollback: false,
      }),
    })

    const device = toDevice(model)
    expect(device.inScope).toBe(false)
    expect(device.scopeLostAt).toBe("2026-08-13T00:00:00Z")
    expect(device.status).toBe("unknown")
    expect(device.mac).toBe("aa:bb:cc:dd:ee:01")
  })

  it("defaults inScope to true when omitted", () => {
    const model = new inventory.Device({
      id: "dev-2",
      siteId: "site-a",
      name: "Switch",
      model: "USW",
      firmware: "7.0.0",
      status: "online",
      site: "Home",
    })

    expect(toDevice(model).inScope).toBe(true)
  })
})

describe("toCredentialSlot", () => {
  it("maps validation summary from Wails model", () => {
    const model = new main.CredentialSlot({
      id: "site-manager-primary",
      kind: "site_manager",
      label: "Fleet access",
      status: "configured",
      capabilities: ["inventory"],
      enabled: true,
      maskedSuffix: "…abcd",
      validationSummary: new main.ValidationSummary({
        sites: [
          new main.ProbedSiteSummary({
            siteId: "site-a",
            siteName: "Home",
          }),
        ],
        applicationsObserved: ["network", "protect"],
        hostCount: 2,
        deviceCount: 10,
        notes: ["2 sites reachable"],
      }),
    })

    const slot = toCredentialSlot(model)
    expect(slot.validationSummary?.sites).toEqual([
      { siteId: "site-a", siteName: "Home" },
    ])
    expect(slot.validationSummary?.deviceCount).toBe(10)
  })
})
