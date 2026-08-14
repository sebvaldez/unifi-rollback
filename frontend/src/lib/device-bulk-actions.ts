import { getDeviceActionAvailability } from "@/lib/device-actions"
import { DEVICE_ACTIONS, type DeviceActionDefinition } from "@/lib/device-actions"
import type { Device, DeviceActionId } from "@/types/inventory"

export type BulkActionAvailability = DeviceActionDefinition & {
  enabled: boolean
  eligibleCount: number
  reason?: string
}

export function getBulkActionAvailability(
  devices: Device[],
  actionId: DeviceActionId
): BulkActionAvailability {
  const definition = DEVICE_ACTIONS.find((action) => action.id === actionId)
  if (!definition) {
    return {
      id: actionId,
      label: actionId,
      description: "",
      enabled: false,
      eligibleCount: 0,
      reason: "Unavailable",
    }
  }

  const eligible = devices.filter(
    (device) => getDeviceActionAvailability(device, actionId).enabled
  )

  if (eligible.length === 0) {
    const sampleReason =
      devices.length > 0
        ? getDeviceActionAvailability(devices[0], actionId).reason
        : undefined
    return {
      ...definition,
      enabled: false,
      eligibleCount: 0,
      reason: sampleReason ?? "No selected devices can run this action",
    }
  }

  return {
    ...definition,
    enabled: true,
    eligibleCount: eligible.length,
  }
}

export function eligibleDevicesForAction(
  devices: Device[],
  actionId: DeviceActionId
): Device[] {
  return devices.filter(
    (device) => getDeviceActionAvailability(device, actionId).enabled
  )
}
