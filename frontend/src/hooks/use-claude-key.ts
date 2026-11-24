import { useCallback, useEffect, useState } from "react"
import {
  fetchClaudeKeyReady,
  normalizeWailsError,
  saveClaudeKey,
} from "@/lib/wails-client"

export type ClaudeKeyStatus = "checking" | "missing" | "ready"

/** Tracks whether a Claude API key is saved. Re-checks each time the AI sheet opens until it is. */
export function useClaudeKey(open: boolean) {
  const [status, setStatus] = useState<ClaudeKeyStatus>("checking")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || status === "ready") return

    let cancelled = false
    setStatus("checking")
    setError(null)
    fetchClaudeKeyReady()
      .then((ready) => {
        if (!cancelled) setStatus(ready ? "ready" : "missing")
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setStatus("missing")
        setError(normalizeWailsError(err, "Could not check for a saved key"))
      })
    return () => {
      cancelled = true
    }
    // status is read only to skip the check once ready.
  }, [open])

  const save = useCallback(async (secret: string) => {
    setSaving(true)
    setError(null)
    try {
      await saveClaudeKey(secret)
      setStatus("ready")
    } catch (err) {
      setError(normalizeWailsError(err, "Could not save the key"))
    } finally {
      setSaving(false)
    }
  }, [])

  return { status, saving, error, save }
}

export type ClaudeKeyController = ReturnType<typeof useClaudeKey>
