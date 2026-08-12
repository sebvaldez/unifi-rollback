import { useCallback, useEffect, useRef, useState } from "react"

import {
  TypedConfirmDialog,
  type TypedConfirmConfig,
} from "@/components/ui/typed-confirm-dialog"

export type { TypedConfirmConfig }

export function useTypedConfirm() {
  const [open, setOpen] = useState(false)
  const [config, setConfig] = useState<TypedConfirmConfig | null>(null)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const finish = useCallback((confirmed: boolean) => {
    setOpen(false)
    const resolve = resolverRef.current
    resolverRef.current = null
    setConfig(null)
    resolve?.(confirmed)
  }, [])

  const requestConfirm = useCallback(
    (nextConfig: TypedConfirmConfig) => {
      return new Promise<boolean>((resolve) => {
        if (resolverRef.current) {
          resolverRef.current(false)
        }
        resolverRef.current = resolve
        setConfig(nextConfig)
        setOpen(true)
      })
    },
    []
  )

  useEffect(() => {
    return () => {
      resolverRef.current?.(false)
      resolverRef.current = null
    }
  }, [])

  const confirmDialog = (
    <TypedConfirmDialog
      open={open}
      config={config}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  )

  return { requestConfirm, confirmDialog }
}
