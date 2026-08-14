import { resolveDeviceIconUrl } from "@/lib/unifi-device-icons"
import { cn } from "@/lib/utils"
import type { Device } from "@/types/inventory"
import { Router } from "lucide-react"
import { useState } from "react"

type DeviceIconProps = {
  device: Pick<Device, "model" | "iconUrl">
  className?: string
  size?: "sm" | "md" | "lg"
}

const sizeClass = {
  sm: "size-8",
  md: "size-10",
  lg: "size-14",
} as const

export function DeviceIcon({ device, className, size = "md" }: DeviceIconProps) {
  const [failed, setFailed] = useState(false)
  const iconUrl = resolveDeviceIconUrl(device.model, device.iconUrl)

  if (!iconUrl || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--unifi-blue)_10%,var(--unifi-surface))] text-[var(--unifi-blue)]",
          sizeClass[size],
          className
        )}
      >
        <Router className={size === "lg" ? "size-7" : "size-4"} />
      </div>
    )
  }

  return (
    <img
      src={iconUrl}
      alt=""
      aria-hidden
      className={cn("shrink-0 object-contain", sizeClass[size], className)}
      onError={() => setFailed(true)}
    />
  )
}
