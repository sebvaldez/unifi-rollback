import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ClaudeKeyController } from "@/hooks/use-claude-key"
import { Browser } from "@wailsio/runtime"
import { KeyRound } from "lucide-react"
import { useState, type FormEvent } from "react"

export const CLAUDE_KEYS_URL = "https://console.anthropic.com/settings/keys"

type ClaudeKeyGateProps = {
  claudeKey: Pick<ClaudeKeyController, "status" | "saving" | "error" | "save">
}

export function ClaudeKeyGate({ claudeKey }: ClaudeKeyGateProps) {
  const { status, saving, error, save } = claudeKey
  const [secret, setSecret] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)

  if (status === "checking") {
    return (
      <p className="p-4 py-8 text-center text-sm text-[var(--unifi-text-muted)]">
        Checking for a saved Claude API key…
      </p>
    )
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (secret.trim()) void save(secret)
  }

  function openKeysPage() {
    setLinkError(null)
    Browser.OpenURL(CLAUDE_KEYS_URL).catch(() =>
      setLinkError(`Could not open the browser. Go to ${CLAUDE_KEYS_URL}`)
    )
  }

  const shownError = error ?? linkError

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 p-4"
      aria-label="Claude API key"
    >
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-[var(--unifi-blue)]" />
        <h3 className="text-sm font-medium">Add your Claude API key</h3>
      </div>
      <p className="text-sm text-[var(--unifi-text-muted)]">
        The AI assistant needs a Claude API key. It is saved in your macOS
        Keychain and stays on this Mac.
      </p>
      <Input
        type="password"
        value={secret}
        onChange={(event) => setSecret(event.target.value)}
        placeholder="sk-ant-…"
        autoComplete="off"
        spellCheck={false}
        aria-label="Claude API key"
        disabled={saving}
      />
      {shownError ? (
        <p role="alert" className="text-sm text-destructive">
          {shownError}
        </p>
      ) : null}
      <Button type="submit" disabled={saving || !secret.trim()}>
        {saving ? "Saving…" : "Save key"}
      </Button>
      <Button
        type="button"
        variant="link"
        className="h-auto justify-start p-0 text-sm"
        onClick={openKeysPage}
      >
        Get a key from Anthropic
      </Button>
    </form>
  )
}
