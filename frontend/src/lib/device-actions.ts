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
  const { capabilities, status } = device
  const online = status === "online"

  if (device.inScope === false) {
    return {
      id: actionId,
      enabled: false,
      reason: "Device is outside current API key scope",
    }
  }

  switch (actionId) {
    case "locate":
      if (!online) {
        return {
          id: actionId,
          enabled: false,
          reason: "Device must be online",
        }
      }
      if (!capabilities.locate) {
        return {
          id: actionId,
          enabled: false,
          reason:
            "Requires Classic admin credentials for this site — add in Settings",
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
      if (!capabilities.restart) {
        return {
          id: actionId,
          enabled: false,
          reason: `Requires a Network Integration key for ${device.site} — configure in Settings`,
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
      if (!capabilities.rollback) {
        return {
          id: actionId,
          enabled: false,
          reason: "Coming soon — verified manifest + device SSH required",
        }
      }
      return { id: actionId, enabled: true }

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
