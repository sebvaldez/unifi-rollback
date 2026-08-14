import { Button } from "@/components/ui/button"
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
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={mode === "list"}
        className={cn(
          "h-7 px-2",
          mode === "list" && "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
        )}
        onClick={() => onChange("list")}
      >
        <LayoutList className="size-4" />
        <span className="sr-only">List view</span>
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={mode === "grid"}
        className={cn(
          "h-7 px-2",
          mode === "grid" && "bg-[var(--unifi-nav-active-bg)] text-[var(--unifi-blue)]"
        )}
        onClick={() => onChange("grid")}
      >
        <LayoutGrid className="size-4" />
        <span className="sr-only">Grid view</span>
      </Button>
    </div>
  )
}
