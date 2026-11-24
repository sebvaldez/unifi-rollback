import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { DEVICE_ACTIONS } from "@/lib/device-actions"
import {
  OUTCOME_PRESENTATION,
  type ActionLogEntry,
} from "@/lib/action-debug-log"
import { cn } from "@/lib/utils"
import { Bug, Trash2 } from "lucide-react"
import { useState } from "react"

function actionLabel(entry: ActionLogEntry): string {
  return DEVICE_ACTIONS.find((a) => a.id === entry.action)?.label ?? entry.action
}

function ActionLogRow({ entry }: { entry: ActionLogEntry }) {
  const presentation = OUTCOME_PRESENTATION[entry.outcome]

  return (
    <li
      data-slot="action-log-row"
      data-outcome={entry.outcome}
      className={cn(
        "space-y-1 rounded-md border border-l-4 border-[var(--unifi-border)] px-3 py-2 text-xs",
        presentation.rowClass
      )}
    >
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "min-w-[3.75rem] font-mono text-xs font-semibold",
            presentation.wordClass
          )}
        >
          {presentation.word(entry)}
        </span>
        <span className="font-medium text-[var(--unifi-text)]">
          {actionLabel(entry)} · {entry.deviceName}
        </span>
        <time className="ml-auto shrink-0 text-[var(--unifi-text-muted)]">
          {new Date(entry.at).toLocaleTimeString()}
        </time>
      </div>
      <p className="break-all font-mono text-[var(--unifi-text-muted)]">
        {entry.operation}
      </p>
      {entry.error ? (
        <p className="break-all font-mono text-[var(--unifi-text)]">
          {entry.error}
        </p>
      ) : null}
    </li>
  )
}

/** Side panel that lists every device action click, newest first. Stays open while you keep clicking. */
export function ActionDebugSheet() {
  const [open, setOpen] = useState(false)
  const { actionLog, clearActionLog } = useDeviceInventory()

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Bug className="size-4" />
        Debug log
        {actionLog.length > 0 ? ` (${actionLog.length})` : ""}
      </Button>

      <Sheet open={open} onOpenChange={setOpen} modal={false} disablePointerDismissal>
        <SheetContent
          side="right"
          showOverlay={false}
          className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        >
          <SheetHeader className="shrink-0 border-b border-[var(--unifi-border)] px-4 py-4 pr-12">
            <div className="flex items-center gap-2">
              <Bug className="size-4 text-[var(--unifi-blue)]" />
              <SheetTitle>Debug log — device actions</SheetTitle>
            </div>
            <SheetDescription>
              Every Locate click, newest first. Secrets are never recorded.
            </SheetDescription>
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={actionLog.length === 0}
                onClick={clearActionLog}
              >
                <Trash2 className="size-4" />
                Clear log
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="min-h-0 flex-1">
            {actionLog.length === 0 ? (
              <p className="p-4 text-sm text-[var(--unifi-text-muted)]">
                No actions yet. Click Locate on a device to see what it calls.
              </p>
            ) : (
              <ul className="space-y-2 p-4">
                {actionLog.map((entry) => (
                  <ActionLogRow key={entry.id} entry={entry} />
                ))}
              </ul>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
