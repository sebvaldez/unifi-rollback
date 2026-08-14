import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useCredentials } from "@/context/credentials-context"
import { cn } from "@/lib/utils"
import {
  CREDENTIAL_CAPABILITY_LABELS,
  CREDENTIAL_KIND_LABELS,
  type CredentialCapability,
  type CredentialSlot,
  type CredentialSlotKind,
} from "@/types/credentials"
import { useState } from "react"

function statusBadgeClass(status: CredentialSlot["status"]): string {
  switch (status) {
    case "configured":
      return "border-[color-mix(in_srgb,var(--unifi-success)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-success)_12%,var(--unifi-surface))] text-[var(--unifi-success)]"
    case "invalid":
      return "border-[color-mix(in_srgb,var(--unifi-warning)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-warning)_12%,var(--unifi-surface))] text-[var(--unifi-warning)]"
    case "validating":
      return "border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
    default:
      return "border-[var(--unifi-border)] text-[var(--unifi-text-muted)]"
  }
}

function statusLabel(status: CredentialSlot["status"]): string {
  switch (status) {
    case "configured":
      return "Configured"
    case "invalid":
      return "Invalid"
    case "validating":
      return "Validating…"
    default:
      return "Not configured"
  }
}

function CapabilityChips({ capabilities }: { capabilities: CredentialCapability[] }) {
  if (capabilities.length === 0) {
    return (
      <span className="text-xs text-[var(--unifi-text-muted)]">
        Capabilities discovered after validation
      </span>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {capabilities.map((cap) => (
        <Badge key={cap} variant="outline" className="text-xs font-normal">
          {CREDENTIAL_CAPABILITY_LABELS[cap]}
        </Badge>
      ))}
    </div>
  )
}

type CredentialSlotRowProps = {
  slot: CredentialSlot
}

function CredentialSlotRow({ slot }: CredentialSlotRowProps) {
  const { saveCredential, validateCredential, removeCredential } =
    useCredentials()
  const [secret, setSecret] = useState("")
  const [expanded, setExpanded] = useState(slot.status === "unconfigured")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const subtitle =
    slot.boundSiteName ??
    (slot.kind === "site_manager"
      ? "Site Manager API · api.ui.com"
      : slot.kind === "network_integration"
        ? "Network Integration API · per site"
        : CREDENTIAL_KIND_LABELS[slot.kind])

  async function handleSave() {
    if (!secret.trim()) return
    setBusy(true)
    setActionError(null)
    try {
      await saveCredential({ slotId: slot.id, secret: secret.trim() })
      setSecret("")
      setExpanded(false)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to save credential"
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleValidate() {
    setBusy(true)
    setActionError(null)
    try {
      await validateCredential(slot.id)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Validation failed"
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    setBusy(true)
    setActionError(null)
    try {
      await removeCredential(slot.id)
      setExpanded(true)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove credential"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-[var(--unifi-border)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-[var(--unifi-text)]">
            {slot.label}
          </p>
          <p className="text-xs text-[var(--unifi-text-muted)]">{subtitle}</p>
          {slot.maskedSuffix ? (
            <p className="text-xs text-[var(--unifi-text-muted)]">
              Key ending in {slot.maskedSuffix}
              {slot.lastValidatedAt
                ? ` · validated ${new Date(slot.lastValidatedAt).toLocaleString()}`
                : null}
            </p>
          ) : null}
        </div>
        <Badge variant="outline" className={cn("shrink-0", statusBadgeClass(slot.status))}>
          {statusLabel(slot.status)}
        </Badge>
      </div>

      <div className="mt-3">
        <CapabilityChips capabilities={slot.capabilities} />
      </div>

      {(actionError || slot.validationError) ? (
        <p className="mt-2 text-xs text-[var(--unifi-warning)]">
          {actionError ?? slot.validationError}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {slot.status === "unconfigured" || expanded ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? "Cancel" : "Add key"}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleValidate()}
            >
              Revalidate
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              Remove
            </Button>
          </>
        )}
      </div>

      {expanded ? (
        <div className="mt-3 space-y-2">
          <Input
            type="password"
            placeholder="Paste API key"
            value={secret}
            disabled={busy}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave()
            }}
          />
          <Button
            type="button"
            size="sm"
            disabled={busy || !secret.trim()}
            onClick={() => void handleSave()}
          >
            Save to Keychain
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function groupSlots(
  slots: CredentialSlot[],
  kinds: CredentialSlotKind[]
): CredentialSlot[] {
  return slots.filter((slot) => kinds.includes(slot.kind))
}

export function CredentialsRegistry() {
  const { slots, loading, error } = useCredentials()

  const fleetSlots = groupSlots(slots, ["site_manager"])
  const siteSlots = groupSlots(slots, ["network_integration"])
  const optionalSlots = groupSlots(slots, [
    "classic_admin",
    "llm_claude",
    "llm_openai",
  ])

  return (
    <Card className="border-[var(--unifi-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Credentials</CardTitle>
        <CardDescription>
          Keys are stored in macOS Keychain. The app discovers what each key can
          do — you never pick scopes manually.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-[color-mix(in_srgb,var(--unifi-warning)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-warning)_8%,var(--unifi-surface))] px-4 py-3 text-sm text-[var(--unifi-text)]">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-[var(--unifi-text-muted)]">Loading…</p>
        ) : (
          <>
            <section className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--unifi-text)]">
                Fleet access
              </h3>
              <p className="text-xs text-[var(--unifi-text-muted)]">
                Site Manager API key for inventory across all sites you can access.
              </p>
              {fleetSlots.map((slot) => (
                <CredentialSlotRow key={slot.id} slot={slot} />
              ))}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--unifi-text)]">
                Device control (per site)
              </h3>
              <p className="text-xs text-[var(--unifi-text-muted)]">
                Network Integration keys bound to each site — required for restart
                and firmware verification. Rows appear after your first inventory
                refresh discovers sites.
              </p>
              {siteSlots.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--unifi-border)] px-4 py-3 text-sm text-[var(--unifi-text-muted)]">
                  No site keys yet. Configure fleet access, then refresh inventory
                  on the Devices tab.
                </p>
              ) : (
                siteSlots.map((slot) => (
                  <CredentialSlotRow key={slot.id} slot={slot} />
                ))
              )}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-medium text-[var(--unifi-text)]">
                Optional
              </h3>
              <p className="text-xs text-[var(--unifi-text-muted)]">
                Classic admin for LED locate, LLM keys for the AI assistant.
              </p>
              {optionalSlots.length === 0 ? (
                <p className="text-sm text-[var(--unifi-text-muted)]">
                  Optional credential slots will appear here as features ship.
                </p>
              ) : (
                optionalSlots.map((slot) => (
                  <CredentialSlotRow key={slot.id} slot={slot} />
                ))
              )}
            </section>
          </>
        )}
      </CardContent>
    </Card>
  )
}
