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
