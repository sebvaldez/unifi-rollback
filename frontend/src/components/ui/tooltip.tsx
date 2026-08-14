import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { cn } from "@/lib/utils"
import { isValidElement, type ReactElement, type ReactNode } from "react"

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <TooltipPrimitive.Provider closeDelay={80} delay={350} timeout={300}>
      {children}
    </TooltipPrimitive.Provider>
  )
}

type TooltipProps = {
  content: ReactNode
  side?: "top" | "bottom" | "left" | "right"
  children: ReactElement
}

export function Tooltip({ content, side = "top", children }: TooltipProps) {
  const disabled =
    isValidElement(children) &&
    Boolean((children.props as { disabled?: boolean }).disabled)

  const trigger = disabled ? (
    <span className="inline-flex" tabIndex={0}>
      {children}
    </span>
  ) : (
    children
  )

  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger delay={250} render={trigger} />
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Positioner align="center" side={side} sideOffset={6}>
          <TooltipPrimitive.Popup
            className={cn(
              "z-50 max-w-xs rounded-md border border-[var(--unifi-border)] bg-popover px-2.5 py-1.5 text-xs leading-snug text-popover-foreground shadow-md",
              "origin-[var(--transform-origin)] transition-[transform,scale,opacity]",
              "data-starting-style:scale-95 data-starting-style:opacity-0",
              "data-ending-style:scale-95 data-ending-style:opacity-0"
            )}
          >
            {content}
          </TooltipPrimitive.Popup>
        </TooltipPrimitive.Positioner>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
