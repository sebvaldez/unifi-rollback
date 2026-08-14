import { useEffect, useRef, useState } from "react"

export function useInterval(callback: () => void, delayMs: number | null) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    if (delayMs === null) return

    const id = window.setInterval(() => {
      callbackRef.current()
    }, delayMs)

    return () => window.clearInterval(id)
  }, [delayMs])
}

/** Increments on a fixed interval to drive relative-time UI updates. */
export function useTick(intervalMs: number | null = 10_000): number {
  const [tick, setTick] = useState(0)

  useInterval(() => {
    setTick((value) => value + 1)
  }, intervalMs)

  return tick
}
