import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { DeviceViewMode } from "@/types/inventory"
import { LayoutGrid, LayoutList } from "lucide-react"

type DeviceViewToggleProps = {
  mode: DeviceViewMode
  onChange: (mode: DeviceViewMode) => void
}

export function DeviceViewToggle({ mode, onChange }: DeviceViewToggleProps) {
  return (
    <div
      className="inline-flex rounded-lg border border-[var(--unifi-border)] p-0.5"
      role="group"
      aria-label="Inventory view mode"
    >
      <Tooltip content="List view">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={mode === "list"}
          aria-label="List view"
          className={cn(
            "h-7 px-2",
            mode === "list" &&
              "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
          )}
          onClick={() => onChange("list")}
        >
          <LayoutList className="size-4" />
        </Button>
      </Tooltip>
      <Tooltip content="Grid view">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-pressed={mode === "grid"}
          aria-label="Grid view"
          className={cn(
            "h-7 px-2",
            mode === "grid" &&
              "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
          )}
          onClick={() => onChange("grid")}
        >
          <LayoutGrid className="size-4" />
        </Button>
      </Tooltip>
    </div>
  )
}
