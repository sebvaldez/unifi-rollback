import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ActionDebugSheet } from "@/components/devices/action-debug-sheet"
import {
  DeviceInventoryProvider,
  useDeviceInventory,
} from "@/context/device-inventory-context"
import type { Device } from "@/types/inventory"
import { EMPTY_DEVICE_CAPABILITIES } from "@/types/inventory"

const locateDevice = vi.hoisted(() => vi.fn())
vi.mock("@/lib/wails-client", () => ({ locateDevice }))

const HOST_401 =
  'load console host from Site Manager: GET hosts/AC8B96E2:1826709523: HTTP 401: {"code":"unauthorized","httpStatusCode":401,"message":"unauthorized"}'

const device: Device = {
  id: "dev-1",
  siteId: "home",
  name: "Hall AP",
  model: "U7-Pro-XGS",
  firmware: "7.0.0",
  status: "online",
  site: "Home",
  capabilities: { ...EMPTY_DEVICE_CAPABILITIES, locate: true },
}

function LocateButton() {
  const { runDeviceAction } = useDeviceInventory()
  return (
    <button onClick={() => void runDeviceAction(device, "locate").catch(() => {})}>
      locate-click
    </button>
  )
}

let root: Root
let container: HTMLDivElement

function byText(text: string) {
  return Array.from(document.body.querySelectorAll("button")).find((el) =>
    el.textContent?.includes(text)
  )!
}

function rows() {
  return Array.from(
    document.body.querySelectorAll<HTMLElement>('[data-slot="action-log-row"]')
  )
}

async function click(text: string) {
  await act(async () => {
    byText(text).click()
  })
}

beforeEach(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  locateDevice.mockReset()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => {
    root.render(
      <DeviceInventoryProvider>
        <LocateButton />
        <ActionDebugSheet />
      </DeviceInventoryProvider>
    )
  })
  await click("Debug log")
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("ActionDebugSheet", () => {
  it("titles the panel as a debug log", () => {
    expect(document.body.textContent).toContain("Debug log — device actions")
  })

  it("appends a warning-colored 401 row for a failed locate without leaking secrets", async () => {
    locateDevice.mockRejectedValue(
      new Error(`${HOST_401} X-API-KEY: sk-live-secret-123 password=hunter2`)
    )
    await click("locate-click")

    const [row] = rows()
    expect(rows()).toHaveLength(1)
    expect(row.dataset.outcome).toBe("auth")
    expect(row.className).toContain("var(--unifi-warning)")
    expect(row.textContent).toContain("401")
    expect(row.textContent).toContain("Locate · Hall AP")
    expect(row.textContent).toContain("GET hosts/AC8B96E2:1826709523")
    expect(row.textContent).toContain("unauthorized")
    expect(document.body.textContent).not.toContain("sk-live-secret-123")
    expect(document.body.textContent).not.toContain("hunter2")
  })

  it("colors non-auth failures destructive and successes positive, newest first", async () => {
    locateDevice.mockRejectedValueOnce(new Error("Console refused the locate command"))
    await click("locate-click")
    locateDevice.mockResolvedValueOnce(undefined)
    await click("locate-click")

    const [newest, older] = rows()
    expect(newest.dataset.outcome).toBe("ok")
    expect(newest.className).toContain("var(--unifi-success)")
    expect(newest.textContent).toContain("OK")
    expect(newest.textContent).toContain("POST set-locate")
    expect(older.dataset.outcome).toBe("error")
    expect(older.className).toContain("var(--destructive)")
    expect(older.textContent).toContain("ERROR")
  })

  it("shows an in-flight call as muted PENDING and stays open across clicks", async () => {
    locateDevice.mockReturnValue(new Promise(() => {}))
    await click("locate-click")

    const [row] = rows()
    expect(row.dataset.outcome).toBe("pending")
    expect(row.className).toContain("var(--unifi-text-muted)")
    expect(row.textContent).toContain("PENDING")
    expect(document.body.textContent).toContain("Debug log — device actions")
  })

  it("empties the log with Clear log", async () => {
    locateDevice.mockResolvedValue(undefined)
    await click("locate-click")
    expect(rows()).toHaveLength(1)

    await click("Clear log")
    expect(rows()).toHaveLength(0)
    expect(document.body.textContent).toContain("No actions yet")
  })
})
