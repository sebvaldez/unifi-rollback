import { beforeEach, describe, expect, it } from "vitest"
import {
  dedupeDiscoveredSites,
  dismissNetworkSlot,
  filterVisibleCredentialSlots,
  isDismissedNetworkSlot,
  loadDismissedNetworkSlotIds,
  networkIntegrationSlotId,
  undismissNetworkSlot,
} from "@/lib/dismissed-credential-slots"

describe("dismissed-credential-slots", () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it("tracks dismissed network integration slot ids", () => {
    const slotId = networkIntegrationSlotId("default")
    dismissNetworkSlot(slotId)
    expect(isDismissedNetworkSlot(slotId)).toBe(true)
    undismissNetworkSlot(slotId)
    expect(isDismissedNetworkSlot(slotId)).toBe(false)
  })

  it("filters dismissed slots from visible lists", () => {
    const slotId = networkIntegrationSlotId("default")
    dismissNetworkSlot(slotId)
    const visible = filterVisibleCredentialSlots([
      { id: slotId },
      { id: "site-manager-primary" },
    ])
    expect(visible.map((slot) => slot.id)).toEqual(["site-manager-primary"])
  })

  it("dedupes discovered sites by siteId", () => {
    const sites = dedupeDiscoveredSites([
      { siteId: "default", siteName: "Default" },
      { siteId: "default", siteName: "Default Site" },
      { siteId: "lab", siteName: "Lab" },
    ])
    expect(sites).toHaveLength(2)
    expect(sites.find((site) => site.siteId === "default")?.siteName).toBe(
      "Default Site"
    )
  })

  it("persists dismissed slot ids", () => {
    dismissNetworkSlot(networkIntegrationSlotId("home"))
    expect(loadDismissedNetworkSlotIds().has(networkIntegrationSlotId("home"))).toBe(
      true
    )
  })
})
