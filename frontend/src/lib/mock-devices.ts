import { resolveDeviceIconUrl } from "@/lib/unifi-device-icons"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

export const MOCK_DEVICE_ID_PREFIX = "dev-mock-"

const MOCK_SITE = { siteId: "home", site: "Home Office" }

function mockDevice(
  suffix: string,
  fields: Omit<Device, "id" | "siteId" | "site" | "capabilities"> & {
    capabilities?: Device["capabilities"]
  }
): Device {
  const { capabilities, ...rest } = fields
  return {
    id: `${MOCK_DEVICE_ID_PREFIX}${suffix}`,
    ...MOCK_SITE,
    capabilities: capabilities ?? { ...EMPTY_DEVICE_CAPABILITIES },
    iconUrl: resolveDeviceIconUrl(rest.model),
    ...rest,
  }
}

/** Dev-only fleet: 3× U7 Pro XGS, 2× Flex 2.5G 8, 1× UDM Pro SE. */
export function createMockDeviceFleet(): Device[] {
  return [
    mockDevice("u7-hall", {
      name: "Hall U7 Pro XGS",
      model: "U7-Pro-XGS",
      firmware: "7.0.102",
      status: "online",
      mac: "74:ac:b9:10:01:01",
    }),
    mockDevice("u7-office", {
      name: "Office U7 Pro XGS",
      model: "U7-Pro-XGS",
      firmware: "7.0.102",
      status: "online",
      mac: "74:ac:b9:10:01:02",
    }),
    mockDevice("u7-garage", {
      name: "Garage U7 Pro XGS",
      model: "U7-Pro-XGS",
      firmware: "7.0.101",
      status: "adopting",
      mac: "74:ac:b9:10:01:03",
    }),
    mockDevice("sw-core", {
      name: "Core Flex 2.5G",
      model: "USW-Flex-2.5G-8",
      firmware: "7.0.98",
      status: "online",
      mac: "74:ac:b9:20:02:01",
    }),
    mockDevice("sw-lab", {
      name: "Lab Flex 2.5G",
      model: "USW-Flex-2.5G-8",
      firmware: "7.0.98",
      status: "online",
      mac: "74:ac:b9:20:02:02",
    }),
    mockDevice("udm-gateway", {
      name: "Gateway UDM Pro SE",
      model: "UDM-Pro-SE",
      firmware: "4.1.30",
      status: "online",
      mac: "74:ac:b9:30:03:01",
    }),
  ]
}

export function isMockDevice(device: Pick<Device, "id">): boolean {
  return device.id.startsWith(MOCK_DEVICE_ID_PREFIX)
}

export function mergeMockDevices(
  current: Device[],
  mocks: Device[]
): Device[] {
  const withoutMocks = current.filter((device) => !isMockDevice(device))
  return [...withoutMocks, ...mocks]
}

export function stripMockDevices(devices: Device[]): Device[] {
  return devices.filter((device) => !isMockDevice(device))
}

export function hasMockDevices(devices: Device[]): boolean {
  return devices.some(isMockDevice)
}
