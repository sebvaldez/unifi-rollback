import type { Device } from "@/types/inventory"

/** Sample devices for local UI development — not shown in production inventory. */
export const sampleDevices: Device[] = [
  {
    id: "dev-udm-pro",
    siteId: "default",
    name: "Office UDM-Pro",
    model: "UDM-Pro",
    firmware: "4.0.80",
    status: "online",
    site: "Default",
    mac: "00:11:22:33:44:55",
    hasLocalApi: true,
  },
  {
    id: "dev-u6-pro",
    siteId: "default",
    name: "Garage U6-Pro",
    model: "U6-Pro",
    firmware: "6.6.65",
    status: "online",
    site: "Default",
    mac: "00:11:22:33:44:56",
    hasLocalApi: true,
  },
  {
    id: "dev-usw-24",
    siteId: "lab",
    name: "Lab USW-24",
    model: "USW-24-POE",
    firmware: "7.0.158",
    status: "offline",
    site: "Lab",
    mac: "00:11:22:33:44:57",
    hasLocalApi: false,
  },
]
