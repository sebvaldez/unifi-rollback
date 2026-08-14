import { AlertDialog } from "@base-ui/react/alert-dialog"
import { useEffect, useId, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type TypedConfirmConfig = {
  title: string
  description: ReactNode
  confirmWord?: string
  confirmActionLabel?: string
}

type TypedConfirmDialogProps = {
  open: boolean
  config: TypedConfirmConfig | null
  onConfirm: () => void | Promise<void>
  onCancel: () => void
}

export function TypedConfirmDialog({
  open,
  config,
  onConfirm,
  onCancel,
}: TypedConfirmDialogProps) {
  const inputId = useId()
  const [input, setInput] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const confirmWord = config?.confirmWord ?? "DELETE"
  const canConfirm = input === confirmWord && !submitting

  useEffect(() => {
    if (!open) {
      setInput("")
      setSubmitting(false)
    }
  }, [open])

  if (!config) {
    return null
  }

  async function handleConfirm() {
    if (!canConfirm) return

    setSubmitting(true)
    try {
      await onConfirm()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AlertDialog.Root
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !submitting) {
          onCancel()
        }
      }}
    >
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px]",
            "transition-opacity data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={cn(
              "w-full max-w-md rounded-xl border border-[var(--unifi-border)]",
              "bg-[var(--unifi-surface)] p-5 shadow-lg outline-none",
              "transition-all data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
              "data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
            )}
          >
            <AlertDialog.Title className="text-base font-semibold text-[var(--unifi-text)]">
              {config.title}
            </AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-sm text-[var(--unifi-text-muted)]">
              {config.description}
            </AlertDialog.Description>
            <div className="mt-4 space-y-2">
              <label htmlFor={inputId} className="block text-sm text-[var(--unifi-text)]">
                Type{" "}
                <code className="rounded bg-[color-mix(in_srgb,var(--unifi-blue)_10%,var(--unifi-surface))] px-1 py-0.5 font-mono text-xs">
                  {confirmWord}
                </code>{" "}
                to confirm
              </label>
              <Input
                id={inputId}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={submitting}
                placeholder={confirmWord}
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={!canConfirm}
                onClick={() => void handleConfirm()}
              >
                {submitting
                  ? "Working…"
                  : (config.confirmActionLabel ?? "Confirm")}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
