import { describe, expect, it, beforeEach } from "vitest"
import {
  applyCapabilitiesToDevices,
  hasFleetInventoryAccess,
  resolveDeviceCapabilities,
  sitesMissingDeviceControl,
  uniqueSitesFromDevices,
} from "@/lib/device-capabilities"
import type { CredentialSlot } from "@/types/credentials"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

const baseDevice: Device = {
  id: "dev-1",
  siteId: "home",
  name: "AP",
  model: "U7-Pro-XGS",
  firmware: "7.0.0",
  status: "online",
  site: "Home Office",
  capabilities: EMPTY_DEVICE_CAPABILITIES,
}

const siteManagerConfigured: CredentialSlot = {
  id: "site-manager-primary",
  kind: "site_manager",
  label: "Fleet access",
  status: "configured",
  capabilities: ["inventory"],
  enabled: true,
}

const networkConfigured: CredentialSlot = {
  id: "network-home",
  kind: "network_integration",
  label: "Home Office",
  status: "configured",
  capabilities: ["device_read", "device_restart"],
  enabled: true,
  boundSiteId: "home",
  boundSiteName: "Home Office",
}

const classicConfigured: CredentialSlot = {
  id: "classic-home",
  kind: "classic_admin",
  label: "Classic admin",
  status: "configured",
  capabilities: ["device_locate"],
  enabled: true,
  boundSiteId: "home",
}

describe("resolveDeviceCapabilities", () => {
  it("grants inventory from configured site manager", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [siteManagerConfigured])
    expect(caps.inventory).toBe(true)
    expect(caps.restart).toBe(false)
  })

  it("grants restart from per-site network integration when online", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [networkConfigured])
    expect(caps.restart).toBe(true)
  })

  it("withholds restart when device is offline", () => {
    const caps = resolveDeviceCapabilities(
      { ...baseDevice, status: "offline" },
      [networkConfigured]
    )
    expect(caps.restart).toBe(false)
  })

  it("grants locate from classic admin credential", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [classicConfigured])
    expect(caps.locate).toBe(true)
  })
})

describe("sitesMissingDeviceControl", () => {
  it("lists sites without configured network integration keys", () => {
    const missing = sitesMissingDeviceControl([baseDevice], [siteManagerConfigured])
    expect(missing).toEqual([{ siteId: "home", siteName: "Home Office" }])
  })

  it("returns empty when all sites have network keys", () => {
    const missing = sitesMissingDeviceControl(
      [baseDevice],
      [siteManagerConfigured, networkConfigured]
    )
    expect(missing).toEqual([])
  })
})

describe("hasFleetInventoryAccess", () => {
  it("is false until site manager is configured with inventory capability", () => {
    expect(hasFleetInventoryAccess([])).toBe(false)
    expect(
      hasFleetInventoryAccess([
        { ...siteManagerConfigured, status: "unconfigured", capabilities: [] },
      ])
    ).toBe(false)
    expect(hasFleetInventoryAccess([siteManagerConfigured])).toBe(true)
  })
})

describe("uniqueSitesFromDevices", () => {
  it("deduplicates sites from device rows", () => {
    const sites = uniqueSitesFromDevices([
      baseDevice,
      { ...baseDevice, id: "dev-2", name: "Switch" },
      { ...baseDevice, id: "dev-3", siteId: "lab", site: "Lab" },
    ])
    expect(sites).toEqual([
      { siteId: "home", siteName: "Home Office" },
      { siteId: "lab", siteName: "Lab" },
    ])
  })
})

describe("applyCapabilitiesToDevices", () => {
  it("maps capabilities onto each device row", () => {
    const updated = applyCapabilitiesToDevices(
      [baseDevice],
      [siteManagerConfigured, networkConfigured, classicConfigured]
    )
    expect(updated[0].capabilities).toEqual({
      inventory: true,
      restart: true,
      locate: true,
      rollback: false,
    })
  })
})
