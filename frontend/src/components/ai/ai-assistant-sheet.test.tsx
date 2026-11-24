import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AiAssistantSheet } from "@/components/ai/ai-assistant-sheet"
import { CLAUDE_KEYS_URL } from "@/components/ai/claude-key-gate"
import type { AiChatController } from "@/hooks/use-ai-chat"
import type { ClaudeKeyController } from "@/hooks/use-claude-key"

const openURL = vi.hoisted(() => vi.fn())
vi.mock("@wailsio/runtime", () => ({ Browser: { OpenURL: openURL } }))

const chat: AiChatController = {
  messages: [],
  input: "",
  isGenerating: false,
  error: null,
  setInput: vi.fn(),
  sendMessage: vi.fn(),
  submit: vi.fn(),
  stop: vi.fn(),
  clear: vi.fn(),
}

let root: Root
let container: HTMLDivElement

function render(claudeKey: Partial<ClaudeKeyController>) {
  const controller: ClaudeKeyController = {
    status: "missing",
    saving: false,
    error: null,
    save: vi.fn().mockResolvedValue(undefined),
    ...claudeKey,
  }
  act(() => {
    root.render(
      <AiAssistantSheet
        open
        onOpenChange={() => {}}
        chat={chat}
        claudeKey={controller}
      />
    )
  })
  return controller
}

function byText(text: string) {
  return Array.from(document.body.querySelectorAll("button")).find((el) =>
    el.textContent?.includes(text)
  )
}

beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  openURL.mockReset().mockResolvedValue(undefined)
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
  container = document.createElement("div")
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe("AiAssistantSheet key gate", () => {
  it("shows only a loading line while the check is in flight", () => {
    render({ status: "checking" })
    expect(document.body.textContent).toContain("Checking for a saved Claude API key")
    expect(document.body.querySelector("textarea")).toBeNull()
    expect(document.body.querySelector("input")).toBeNull()
  })

  it("blocks chat until a key is saved", () => {
    render({ status: "missing" })
    expect(document.body.querySelector('input[type="password"]')).not.toBeNull()
    expect(document.body.querySelector("textarea")).toBeNull()
    expect(document.body.textContent).not.toContain("Start a conversation")
  })

  it("saves the typed key", async () => {
    const { save } = render({ status: "missing" })
    const input = document.body.querySelector<HTMLInputElement>('input[type="password"]')!
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
    await act(async () => {
      setValue.call(input, "sk-ant-test")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    await act(async () => {
      byText("Save key")!.click()
    })
    expect(save).toHaveBeenCalledWith("sk-ant-test")
  })

  it("opens the Anthropic keys page in the system browser", async () => {
    render({ status: "missing" })
    await act(async () => {
      byText("Get a key from Anthropic")!.click()
    })
    expect(openURL).toHaveBeenCalledWith(CLAUDE_KEYS_URL)
    expect(CLAUDE_KEYS_URL).toBe("https://console.anthropic.com/settings/keys")
  })

  it("shows a check or save error on the panel", () => {
    render({ status: "missing", error: "keychain store not available" })
    expect(document.body.querySelector('[role="alert"]')?.textContent).toBe(
      "keychain store not available"
    )
  })

  it("shows the chat once the key is ready", async () => {
    render({ status: "ready" })
    await act(async () => {})
    expect(document.body.querySelector("textarea")).not.toBeNull()
    expect(document.body.querySelector('input[type="password"]')).toBeNull()
  })
})
