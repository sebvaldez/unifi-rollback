import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import {
  applyCapabilitiesToDevices,
  uniqueSitesFromDevices,
} from "@/lib/device-capabilities"
import type { DeviceCapabilities } from "@/types/inventory"
import { useEffect, useMemo } from "react"

function capabilitiesEqual(
  a: DeviceCapabilities,
  b: DeviceCapabilities
): boolean {
  return (
    a.inventory === b.inventory &&
    a.restart === b.restart &&
    a.locate === b.locate &&
    a.rollback === b.rollback
  )
}

/** Keeps device row capabilities in sync when credential slots change. */
export function CredentialCapabilitiesBridge() {
  const { devices, setDevices } = useDeviceInventory()
  const { slots, syncDiscoveredSites } = useCredentials()

  const discoveredSites = useMemo(
    () => uniqueSitesFromDevices(devices),
    [devices]
  )

  const siteSyncKey = useMemo(
    () =>
      discoveredSites
        .map(({ siteId, siteName }) => `${siteId}:${siteName}`)
        .sort()
        .join("|"),
    [discoveredSites]
  )

  useEffect(() => {
    if (!siteSyncKey) return
    void syncDiscoveredSites(discoveredSites)
  }, [siteSyncKey, discoveredSites, syncDiscoveredSites])

  useEffect(() => {
    if (devices.length === 0) return

    const updated = applyCapabilitiesToDevices(devices, slots)
    const changed = updated.some((device, index) => {
      const previous = devices[index]
      if (!previous || previous.id !== device.id) return true
      return !capabilitiesEqual(previous.capabilities, device.capabilities)
    })

    if (changed) {
      setDevices(updated)
    }
  }, [devices, slots, setDevices])

  return null
}
