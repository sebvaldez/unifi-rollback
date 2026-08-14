import { useCallback, useEffect, useRef, useState } from "react"
import { normalizeWailsError } from "@/lib/wails-client"

export type WailsQueryState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  refetch: () => Promise<void>
}

type UseWailsQueryOptions = {
  enabled?: boolean
}

export function useWailsQuery<T>(
  queryFn: () => Promise<T>,
  errorMessage: string,
  options: UseWailsQueryOptions = {}
): WailsQueryState<T> {
  const { enabled = true } = options
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const queryFnRef = useRef(queryFn)
  queryFnRef.current = queryFn

  const refetch = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)
    try {
      const result = await queryFnRef.current()
      setData(result)
    } catch (err) {
      setData(null)
      setError(normalizeWailsError(err, errorMessage))
    } finally {
      setLoading(false)
    }
  }, [enabled, errorMessage])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refetch()
  }, [enabled, refetch])

  return { data, error, loading, refetch }
}
