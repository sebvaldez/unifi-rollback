import { useCallback, useEffect, useMemo, useState } from "react"

const STORAGE_KEY = "unifi-fleet.hidden-device-ids"

function readHiddenDeviceIds(): Set<string> {
  if (typeof localStorage === "undefined") return new Set()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === "string"))
  } catch {
    return new Set()
  }
}

function writeHiddenDeviceIds(ids: Set<string>): void {
  if (typeof localStorage === "undefined") return
  if (ids.size === 0) {
    localStorage.removeItem(STORAGE_KEY)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)))
}

export function resetHiddenDevices(): void {
  writeHiddenDeviceIds(new Set())
}

export function useHiddenDevices(deviceIds: string[]) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => readHiddenDeviceIds())

  useEffect(() => {
    const valid = new Set(deviceIds)
    setHiddenIds((current) => {
      const next = new Set<string>()
      for (const id of current) {
        if (valid.has(id)) next.add(id)
      }
      if (next.size === current.size) return current
      writeHiddenDeviceIds(next)
      return next
    })
  }, [deviceIds])

  const hideDevices = useCallback((ids: Iterable<string>) => {
    setHiddenIds((current) => {
      const next = new Set(current)
      for (const id of ids) next.add(id)
      writeHiddenDeviceIds(next)
      return next
    })
  }, [])

  const unhideDevices = useCallback((ids: Iterable<string>) => {
    setHiddenIds((current) => {
      const next = new Set(current)
      for (const id of ids) next.delete(id)
      writeHiddenDeviceIds(next)
      return next
    })
  }, [])

  const isHidden = useCallback(
    (deviceId: string) => hiddenIds.has(deviceId),
    [hiddenIds]
  )

  return useMemo(
    () => ({
      hiddenIds,
      hideDevices,
      unhideDevices,
      isHidden,
    }),
    [hiddenIds, hideDevices, unhideDevices, isHidden]
  )
}
