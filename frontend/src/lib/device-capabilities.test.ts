import { describe, expect, it, beforeEach } from "vitest"
import {
  applyCapabilitiesToDevices,
  hasFleetInventoryAccess,
  resolveDeviceCapabilities,
  sitesWithoutRestartAccess,
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

const siteManagerWithConnector: CredentialSlot = {
  ...siteManagerConfigured,
  capabilities: ["inventory", "connector_proxy", "device_restart", "firmware_check"],
  validationSummary: {
    sites: [
      {
        siteId: "home",
        siteName: "Home Office",
        hostId: "host-1",
        capabilities: ["device_read", "device_restart", "firmware_check"],
      },
      { siteId: "lab", siteName: "Lab", hostId: "host-2" },
    ],
    applicationsObserved: ["network"],
    hostCount: 2,
    deviceCount: 2,
  },
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

  it("grants restart from the fleet connector without a per-site key", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [siteManagerWithConnector])
    expect(caps.restart).toBe(true)
  })

  it("withholds restart for a site the connector did not reach", () => {
    const caps = resolveDeviceCapabilities(
      { ...baseDevice, siteId: "lab" },
      [siteManagerWithConnector]
    )
    expect(caps.restart).toBe(false)
  })

  it("keeps connector restart when the LAN key is untested", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [
      siteManagerWithConnector,
      { ...networkConfigured, capabilities: [] },
    ])
    expect(caps.restart).toBe(true)
  })

  it("withholds connector restart when the device is offline", () => {
    const caps = resolveDeviceCapabilities(
      { ...baseDevice, status: "offline" },
      [siteManagerWithConnector]
    )
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

  it("withholds restart when network slot is disabled", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [
      { ...networkConfigured, enabled: false },
    ])
    expect(caps.restart).toBe(false)
  })

  it("grants locate from classic admin credential", () => {
    const caps = resolveDeviceCapabilities(baseDevice, [classicConfigured])
    expect(caps.locate).toBe(true)
  })
})

describe("sitesWithoutRestartAccess", () => {
  const labDevice = { ...baseDevice, id: "dev-2", siteId: "lab", site: "Lab" }

  it("lists sites with no connector or LAN restart access", () => {
    const missing = sitesWithoutRestartAccess([baseDevice], [siteManagerConfigured])
    expect(missing).toEqual([{ siteId: "home", siteName: "Home Office" }])
  })

  it("is empty when the connector reaches every site without LAN keys", () => {
    const missing = sitesWithoutRestartAccess(
      [baseDevice],
      [siteManagerWithConnector]
    )
    expect(missing).toEqual([])
  })

  it("lists only the sites the connector did not reach", () => {
    const missing = sitesWithoutRestartAccess(
      [baseDevice, labDevice],
      [siteManagerWithConnector]
    )
    expect(missing).toEqual([{ siteId: "lab", siteName: "Lab" }])
  })

  it("treats a LAN key with restart as access", () => {
    const missing = sitesWithoutRestartAccess(
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
