import { describe, expect, it } from "vitest"
import {
  readAppSidebarCollapsed,
  writeAppSidebarCollapsed,
} from "@/types/navigation"
import {
  readStoredSettingsSection,
  visibleSettingsSections,
  writeStoredSettingsSection,
} from "@/types/settings-navigation"

describe("app sidebar navigation", () => {
  it("persists collapsed state", () => {
    writeAppSidebarCollapsed(true)
    expect(readAppSidebarCollapsed()).toBe(true)
    writeAppSidebarCollapsed(false)
    expect(readAppSidebarCollapsed()).toBe(false)
  })
})

describe("settings navigation", () => {
  it("filters developer section unless dev mode", () => {
    expect(visibleSettingsSections(false).map((s) => s.id)).not.toContain(
      "developer"
    )
    expect(visibleSettingsSections(true).map((s) => s.id)).toContain(
      "developer"
    )
  })

  it("persists active section", () => {
    writeStoredSettingsSection("inventory")
    expect(readStoredSettingsSection()).toBe("inventory")
    writeStoredSettingsSection("credentials")
  })
})
