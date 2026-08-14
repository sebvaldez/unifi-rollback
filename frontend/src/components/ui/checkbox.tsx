import * as React from "react"
import { cn } from "@/lib/utils"

type CheckboxProps = Omit<
  React.ComponentProps<"input">,
  "type" | "checked" | "onChange"
> & {
  checked: boolean
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  function Checkbox(
    { checked, indeterminate = false, onCheckedChange, className, ...props },
    ref
  ) {
    const innerRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(ref, () => innerRef.current as HTMLInputElement)

    React.useEffect(() => {
      if (innerRef.current) {
        innerRef.current.indeterminate = indeterminate
      }
    }, [indeterminate])

    return (
      <input
        ref={innerRef}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange?.(event.target.checked)}
        className={cn(
          "size-4 shrink-0 rounded border border-[var(--unifi-border)]",
          "accent-[var(--unifi-success)] focus-visible:outline-none",
          "focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--unifi-success)_35%,transparent)]",
          className
        )}
        {...props}
      />
    )
  }
)
