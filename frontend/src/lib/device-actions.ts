import type {
  Device,
  DeviceActionAvailability,
  DeviceActionId,
} from "@/types/inventory"

export type DeviceActionDefinition = {
  id: DeviceActionId
  label: string
  description: string
}

export const DEVICE_ACTIONS: DeviceActionDefinition[] = [
  {
    id: "locate",
    label: "Locate",
    description: "Blink device LEDs to find hardware on-site",
  },
  {
    id: "restart",
    label: "Restart",
    description: "Reboot the device via Network Integration API",
  },
  {
    id: "rollback",
    label: "Rollback",
    description: "Push a verified firmware build (SSH, user-confirmed)",
  },
]

export function getDeviceActionAvailability(
  device: Device,
  actionId: DeviceActionId
): DeviceActionAvailability {
  const online = device.status === "online"

  switch (actionId) {
    case "locate":
      if (!online) {
        return {
          id: actionId,
          enabled: false,
          reason: "Device must be online",
        }
      }
      if (!device.hasLocalApi) {
        return {
          id: actionId,
          enabled: false,
          reason: "Requires a local Network API key for this site",
        }
      }
      return { id: actionId, enabled: true }

    case "restart":
      if (!online) {
        return {
          id: actionId,
          enabled: false,
          reason: "Device must be online",
        }
      }
      if (!device.hasLocalApi) {
        return {
          id: actionId,
          enabled: false,
          reason: "Requires a local Network API key for this site",
        }
      }
      return { id: actionId, enabled: true }

    case "rollback":
      if (!online) {
        return {
          id: actionId,
          enabled: false,
          reason: "Device must be online",
        }
      }
      return {
        id: actionId,
        enabled: false,
        reason: "Coming soon — pick a verified manifest entry first",
      }

    default:
      return { id: actionId, enabled: false, reason: "Unavailable" }
  }
}

export function getAvailableDeviceActions(
  device: Device
): DeviceActionAvailability[] {
  return DEVICE_ACTIONS.map((action) =>
    getDeviceActionAvailability(device, action.id)
  )
}
