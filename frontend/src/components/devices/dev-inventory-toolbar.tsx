import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { applyCapabilitiesToDevices } from "@/lib/device-capabilities"
import {
  createMockDeviceFleet,
  hasMockDevices,
  mergeMockDevices,
  stripMockDevices,
} from "@/lib/mock-devices"
import { FlaskConical, Trash2 } from "lucide-react"

export function DevInventoryToolbar() {
  const { devices, setDevices } = useDeviceInventory()
  const { slots } = useCredentials()
  const mockLoaded = hasMockDevices(devices)

  function handleLoadMocks() {
    const mocks = createMockDeviceFleet()
    const merged = mergeMockDevices(devices, mocks)
    setDevices(applyCapabilitiesToDevices(merged, slots))
  }

  function handleClearMocks() {
    setDevices(stripMockDevices(devices))
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashed border-[color-mix(in_srgb,var(--unifi-blue)_35%,var(--unifi-border))] bg-[color-mix(in_srgb,var(--unifi-blue)_6%,var(--unifi-surface))] px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <FlaskConical className="size-4 shrink-0 text-[var(--unifi-blue)]" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--unifi-text)]">
            Dev inventory
          </p>
          <p className="text-xs text-[var(--unifi-text-muted)]">
            Load 6 mock devices (3× U7 Pro XGS, 2× Flex 2.5G 8, 1× UDM Pro SE)
          </p>
        </div>
        <Badge variant="outline" className="shrink-0 text-xs">
          DEV
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleLoadMocks}>
          Load mock fleet
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!mockLoaded}
          onClick={handleClearMocks}
        >
          <Trash2 className="size-4" />
          Clear mocks
        </Button>
      </div>
    </div>
  )
}
