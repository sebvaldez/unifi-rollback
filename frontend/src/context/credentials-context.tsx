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
import { resetDeviceSiteFilter } from "@/hooks/use-device-site-filter"
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
}

const CredentialsContext = createContext<CredentialsContextValue | null>(null)

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
      setSlots(loaded)
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
      if (sites.length === 0) return
      try {
        const synced = await syncCredentialSiteSlots(sites)
        setSlots(synced)
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
    try {
      const updated = await saveCredentialRpc(request)
      setSlots((prev) => upsertSlot(prev, updated))
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
      setSlots((prev) => upsertSlot(prev, updated))
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
        }

        await reload()
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to remove credential"
        setError(message)
        throw err
      }
    },
    [reload, setDevices]
  )

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
