export type ViewId = "devices" | "firmware" | "settings"

export type ViewHeader = {
  title: string
  description: string
}

export const VIEW_HEADERS: Record<ViewId, ViewHeader> = {
  devices: {
    title: "Devices",
    description: "Inventory across all accessible UniFi sites",
  },
  firmware: {
    title: "Firmware",
    description: "Curated manifest and checksum-verified builds",
  },
  settings: {
    title: "Settings",
    description: "API keys and application preferences",
  },
}

const APP_SIDEBAR_COLLAPSED_KEY = "app-sidebar-collapsed"

export function readAppSidebarCollapsed(): boolean {
  if (typeof window === "undefined") return false
  return window.localStorage.getItem(APP_SIDEBAR_COLLAPSED_KEY) === "true"
}

export function writeAppSidebarCollapsed(collapsed: boolean): void {
  if (collapsed) {
    window.localStorage.setItem(APP_SIDEBAR_COLLAPSED_KEY, "true")
  } else {
    window.localStorage.removeItem(APP_SIDEBAR_COLLAPSED_KEY)
  }
}
