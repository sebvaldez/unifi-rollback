import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { resetHiddenDevices } from "@/hooks/use-hidden-devices"
import { resetDeviceSiteFilter } from "@/hooks/use-device-table"
import {
  dedupeDiscoveredSites,
  dismissNetworkSlot,
  filterVisibleCredentialSlots,
  networkIntegrationSlotId,
  undismissNetworkSlot,
  isDismissedNetworkSlot,
} from "@/lib/dismissed-credential-slots"
import {
  fetchCredentialSlots,
  removeCredential as removeCredentialRpc,
  saveCredential as saveCredentialRpc,
  syncCredentialSiteSlots,
  validateCredential as validateCredentialRpc,
} from "@/lib/wails-client"
import type { CredentialSlot, SaveCredentialRequest } from "@/types/credentials"

const SITE_MANAGER_SLOT_ID = "site-manager-primary"

type CredentialsContextValue = {
  slots: CredentialSlot[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  syncDiscoveredSites: (
    sites: { siteId: string; siteName: string }[]
  ) => Promise<void>
  saveCredential: (request: SaveCredentialRequest) => Promise<void>
  validateCredential: (slotId: string) => Promise<void>
  removeCredential: (slotId: string) => Promise<void>
  dismissCredentialSlot: (slotId: string) => Promise<void>
}

const CredentialsContext = createContext<CredentialsContextValue | null>(null)

function dedupeCredentialSlots(slots: CredentialSlot[]): CredentialSlot[] {
  const byId = new Map<string, CredentialSlot>()
  for (const slot of slots) {
    const existing = byId.get(slot.id)
    if (!existing) {
      byId.set(slot.id, slot)
      continue
    }
    if (existing.status !== "configured" && slot.status === "configured") {
      byId.set(slot.id, slot)
    }
  }
  return Array.from(byId.values())
}

function applyVisibleSlots(slots: CredentialSlot[]): CredentialSlot[] {
  return dedupeCredentialSlots(filterVisibleCredentialSlots(slots))
}

function sameCredentialSlotSnapshot(
  left: CredentialSlot[],
  right: CredentialSlot[]
): boolean {
  if (left.length !== right.length) return false
  const rightById = new Map(right.map((slot) => [slot.id, slot]))
  for (const slot of left) {
    const other = rightById.get(slot.id)
    if (!other) return false
    if (
      slot.status !== other.status ||
      slot.label !== other.label ||
      slot.kind !== other.kind ||
      slot.enabled !== other.enabled ||
      slot.boundSiteId !== other.boundSiteId ||
      slot.boundSiteName !== other.boundSiteName ||
      slot.maskedSuffix !== other.maskedSuffix ||
      slot.capabilities.join("\0") !== other.capabilities.join("\0")
    ) {
      return false
    }
  }
  return true
}

function upsertSlot(
  slots: CredentialSlot[],
  updated: CredentialSlot
): CredentialSlot[] {
  const index = slots.findIndex((slot) => slot.id === updated.id)
  if (index === -1) return [...slots, updated]
  return slots.map((slot) => (slot.id === updated.id ? updated : slot))
}

export function CredentialsProvider({ children }: { children: ReactNode }) {
  const { setDevices } = useDeviceInventory()
  const [slots, setSlots] = useState<CredentialSlot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await fetchCredentialSlots()
      setSlots(applyVisibleSlots(loaded))
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load credentials"
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const syncDiscoveredSites = useCallback(
    async (sites: { siteId: string; siteName: string }[]) => {
      const deduped = dedupeDiscoveredSites(sites).filter(
        (site) => !isDismissedNetworkSlot(networkIntegrationSlotId(site.siteId))
      )
      if (deduped.length === 0) return
      try {
        const synced = await syncCredentialSiteSlots(deduped)
        const visible = applyVisibleSlots(synced)
        setSlots((prev) =>
          sameCredentialSlotSnapshot(prev, visible) ? prev : visible
        )
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to sync site credentials"
        )
      }
    },
    []
  )

  const saveCredential = useCallback(async (request: SaveCredentialRequest) => {
    setError(null)
    undismissNetworkSlot(request.slotId)
    try {
      const updated = await saveCredentialRpc(request)
      setSlots((prev) => applyVisibleSlots(upsertSlot(prev, updated)))
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save credential"
      setError(message)
      throw err
    }
  }, [])

  const validateCredential = useCallback(async (slotId: string) => {
    setError(null)
    setSlots((prev) =>
      prev.map((slot) =>
        slot.id === slotId ? { ...slot, status: "validating" as const } : slot
      )
    )
    try {
      const updated = await validateCredentialRpc(slotId)
      setSlots((prev) => applyVisibleSlots(upsertSlot(prev, updated)))
    } catch (err) {
      setSlots((prev) =>
        prev.map((slot) =>
          slot.id === slotId
            ? {
                ...slot,
                status: "invalid" as const,
                validationError:
                  err instanceof Error ? err.message : "Validation failed",
              }
            : slot
        )
      )
      throw err
    }
  }, [])

  const removeCredential = useCallback(
    async (slotId: string) => {
      setError(null)
      try {
        await removeCredentialRpc(slotId)

        if (slotId === SITE_MANAGER_SLOT_ID) {
          setDevices([])
          resetDeviceSiteFilter()
          resetHiddenDevices()
        }

        const loaded = await fetchCredentialSlots()
        setSlots(applyVisibleSlots(loaded))
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove credential"
        setError(message)
        throw err
      }
    },
    [setDevices]
  )

  const dismissCredentialSlot = useCallback(async (slotId: string) => {
    setError(null)
    dismissNetworkSlot(slotId)
    try {
      await removeCredentialRpc(slotId)
    } catch {
      // Placeholder rows may not exist in the backend yet.
    }
    setSlots((prev) => prev.filter((slot) => slot.id !== slotId))
  }, [])

  const value = useMemo<CredentialsContextValue>(
    () => ({
      slots,
      loading,
      error,
      reload,
      syncDiscoveredSites,
      saveCredential,
      validateCredential,
      removeCredential,
      dismissCredentialSlot,
    }),
    [
      slots,
      loading,
      error,
      reload,
      syncDiscoveredSites,
      saveCredential,
      validateCredential,
      removeCredential,
      dismissCredentialSlot,
    ]
  )

  return (
    <CredentialsContext.Provider value={value}>
      {children}
    </CredentialsContext.Provider>
  )
}

export function useCredentials(): CredentialsContextValue {
  const context = useContext(CredentialsContext)
  if (!context) {
    throw new Error("useCredentials must be used within CredentialsProvider")
  }
  return context
}
