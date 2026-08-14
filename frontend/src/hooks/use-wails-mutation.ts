import { useCallback, useState } from "react"
import { normalizeWailsError } from "@/lib/wails-client"

export type WailsMutationState<TArg> = {
  mutate: (arg: TArg) => Promise<void>
  saving: boolean
  error: string | null
  resetError: () => void
}

export function useWailsMutation<TArg>(
  mutationFn: (arg: TArg) => Promise<void>,
  errorMessage: string
): WailsMutationState<TArg> {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const resetError = useCallback(() => {
    setError(null)
  }, [])

  const mutate = useCallback(
    async (arg: TArg) => {
      setSaving(true)
      setError(null)
      try {
        await mutationFn(arg)
      } catch (err) {
        setError(normalizeWailsError(err, errorMessage))
        throw err
      } finally {
        setSaving(false)
      }
    },
    [errorMessage, mutationFn]
  )

  return { mutate, saving, error, resetError }
}
