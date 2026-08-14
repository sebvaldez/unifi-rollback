import { describe, expect, it } from "vitest"
import { formatRelativeTime } from "@/hooks/use-fleet-inventory-refresh"

describe("formatRelativeTime", () => {
  it("returns just now for recent timestamps", () => {
    expect(formatRelativeTime(new Date(Date.now() - 5_000))).toBe("just now")
  })

  it("returns minutes ago for older timestamps", () => {
    expect(formatRelativeTime(new Date(Date.now() - 120_000))).toBe("2m ago")
  })
})
