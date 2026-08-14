import { beforeEach, describe, expect, it } from "vitest"
import {
  listDevCredentialSlots,
  reloadDevCredentialsFromStorage,
  resetDevCredentialStore,
  saveDevCredential,
  syncDevSiteCredentialSlots,
} from "@/lib/dev-credentials-store"

describe("dev-credentials-store", () => {
  beforeEach(() => {
    resetDevCredentialStore()
  })

  it("seeds the default site manager slot", () => {
    const slots = listDevCredentialSlots()
    expect(slots.some((slot) => slot.kind === "site_manager")).toBe(true)
  })

  it("saves a fleet access key and marks slot configured", () => {
    const updated = saveDevCredential({
      slotId: "site-manager-primary",
      secret: "test-api-key-1234",
    })

    expect(updated.status).toBe("configured")
    expect(updated.maskedSuffix).toBe("1234")
    expect(updated.capabilities).toContain("inventory")
  })

  it("rejects empty secrets", () => {
    expect(() =>
      saveDevCredential({ slotId: "site-manager-primary", secret: "   " })
    ).toThrow("API key cannot be empty")
  })

  it("creates per-site network integration slots from inventory", () => {
    const slots = syncDevSiteCredentialSlots([
      { siteId: "home", siteName: "Home Office" },
    ])

    expect(
      slots.some(
        (slot) =>
          slot.kind === "network_integration" &&
          slot.boundSiteId === "home" &&
          slot.status === "unconfigured"
      )
    ).toBe(true)
  })

  it("writes saved credentials to localStorage", () => {
    saveDevCredential({
      slotId: "site-manager-primary",
      secret: "persist-me-9999",
    })

    const stored = localStorage.getItem("unifi-fleet.dev-credentials")
    expect(stored).toContain("site-manager-primary")
    expect(stored).toContain("configured")
  })

  it("reloads configured credentials from localStorage", () => {
    saveDevCredential({
      slotId: "site-manager-primary",
      secret: "persist-me-9999",
    })

    const stored = localStorage.getItem("unifi-fleet.dev-credentials")
    resetDevCredentialStore()
    localStorage.setItem("unifi-fleet.dev-credentials", stored!)
    reloadDevCredentialsFromStorage()

    const reloaded = listDevCredentialSlots()
    expect(
      reloaded.find((slot) => slot.id === "site-manager-primary")?.status
    ).toBe("configured")
  })
})
