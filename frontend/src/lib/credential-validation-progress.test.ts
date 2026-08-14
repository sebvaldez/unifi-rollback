import { describe, expect, it } from "vitest"
import { formatValidationTarget } from "@/lib/credential-validation-progress"

describe("formatValidationTarget", () => {
  it("extracts host from https URLs", () => {
    expect(formatValidationTarget("https://192.168.1.1")).toBe("192.168.1.1")
  })

  it("returns plain targets unchanged", () => {
    expect(formatValidationTarget("api.ui.com")).toBe("api.ui.com")
    expect(formatValidationTarget("Keychain")).toBe("Keychain")
  })

  it("returns null for empty values", () => {
    expect(formatValidationTarget(undefined)).toBeNull()
    expect(formatValidationTarget("  ")).toBeNull()
  })
})
