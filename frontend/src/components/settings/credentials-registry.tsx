import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
} from "@/components/ui/card"
import {
  CredentialInsightSheet,
  slotHasInsightContent,
} from "@/components/settings/credential-insight-sheet"
import { useCredentials } from "@/context/credentials-context"
import { useDeviceInventory } from "@/context/device-inventory-context"
import { useTypedConfirm } from "@/hooks/use-typed-confirm"
import { formatWailsError } from "@/lib/wails-error"
import { cn } from "@/lib/utils"
import {
  CREDENTIAL_CAPABILITY_LABELS,
  CREDENTIAL_KIND_LABELS,
  type CredentialCapability,
  type CredentialSlot,
  type CredentialSlotKind,
} from "@/types/credentials"
import { ChevronRight } from "lucide-react"
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

function statusLabel(
  status: CredentialSlot["status"],
  isValidating: boolean
): string {
  if (isValidating) return "Validating…"
  switch (status) {
    case "configured":
      return "Configured"
    case "invalid":
      return "Invalid"
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
  expanded: boolean
  onExpandedChange: (expanded: boolean) => void
}

function CredentialSlotRow({
  slot,
  expanded,
  onExpandedChange,
}: CredentialSlotRowProps) {
  const {
    saveCredential,
    validateCredential,
    removeCredential,
    dismissCredentialSlot,
    validationProgressBySlotId,
    openInsight,
  } = useCredentials()
  const { devices } = useDeviceInventory()
  const { requestConfirm, confirmDialog } = useTypedConfirm()
  const [secret, setSecret] = useState("")
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const validationProgress = validationProgressBySlotId[slot.id]
  const isValidating =
    slot.status === "validating" || validationProgress?.phase === "running"
  const showInsightButton = slotHasInsightContent(slot, validationProgress)

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
      onExpandedChange(false)
    } catch (err) {
      setActionError(formatWailsError(err, "Failed to save credential"))
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
      setActionError(formatWailsError(err, "Validation failed"))
    } finally {
      setBusy(false)
    }
  }

  async function handleDismiss() {
    setBusy(true)
    setActionError(null)
    try {
      await dismissCredentialSlot(slot.id)
      setSecret("")
      onExpandedChange(false)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to dismiss credential row"
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove() {
    if (slot.kind === "site_manager" && slot.status === "configured") {
      const deviceCount = devices.length
      const confirmed = await requestConfirm({
        title: "Remove fleet access key?",
        description: (
          <>
            <p>
              This removes your Site Manager API key from Keychain and clears
              discovered site credential placeholders.
            </p>
            <p className="mt-2">
              {deviceCount === 0
                ? "No devices are stored locally."
                : `${deviceCount} device${deviceCount === 1 ? "" : "s"} will be removed from the local inventory.`}
            </p>
          </>
        ),
        confirmActionLabel: "Remove key",
      })
      if (!confirmed) return
    }

    setBusy(true)
    setActionError(null)
    try {
      await removeCredential(slot.id)
      setSecret("")
      onExpandedChange(false)
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove credential"
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {confirmDialog}
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
          <Badge
            variant="outline"
            className={cn("shrink-0", statusBadgeClass(slot.status))}
          >
            {statusLabel(slot.status, isValidating)}
          </Badge>
        </div>

        <div className="mt-3">
          <CapabilityChips capabilities={slot.capabilities} />
        </div>

        {isValidating ? (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-between rounded-md border border-dashed border-[var(--unifi-border)] px-3 py-2 text-left text-xs text-[var(--unifi-text-muted)] transition-colors hover:border-[var(--unifi-accent)] hover:text-[var(--unifi-text)]"
            onClick={() => openInsight(slot.id)}
          >
            <span>Validation in progress — view live steps</span>
            <ChevronRight className="size-3.5 shrink-0" />
          </button>
        ) : null}

        {(actionError || slot.validationError) && !isValidating ? (
          <p className="mt-2 text-xs text-[var(--unifi-warning)]">
            {actionError ?? slot.validationError}
          </p>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-2">
          {slot.status === "configured" && !expanded ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy || isValidating}
                onClick={() => void handleValidate()}
              >
                {isValidating ? "Validating…" : "Revalidate"}
              </Button>
              {showInsightButton ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => openInsight(slot.id)}
                >
                  Details
                </Button>
              ) : null}
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
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setActionError(null)
                  onExpandedChange(!expanded)
                }}
              >
                {expanded ? "Cancel" : "Add key"}
              </Button>
              {slot.kind === "network_integration" &&
              slot.status === "unconfigured" &&
              !expanded ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => void handleDismiss()}
                >
                  Dismiss
                </Button>
              ) : null}
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
              disabled={busy || isValidating || !secret.trim()}
              onClick={() => void handleSave()}
            >
              {isValidating ? "Validating…" : "Save to Keychain"}
            </Button>
          </div>
        ) : null}
      </div>
    </>
  )
}

function groupSlots(
  slots: CredentialSlot[],
  kinds: CredentialSlotKind[]
): CredentialSlot[] {
  return slots.filter((slot) => kinds.includes(slot.kind))
}

export function CredentialsRegistry() {
  const {
    slots,
    loading,
    error,
    insightSlotId,
    closeInsight,
    validationProgressBySlotId,
  } = useCredentials()
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null)

  const fleetSlots = groupSlots(slots, ["site_manager"])
  const siteSlots = groupSlots(slots, ["network_integration"])
  const optionalSlots = groupSlots(slots, [
    "classic_admin",
    "llm_claude",
    "llm_openai",
  ])

  const insightSlot = insightSlotId
    ? slots.find((slot) => slot.id === insightSlotId) ?? null
    : null
  const insightProgress = insightSlotId
    ? validationProgressBySlotId[insightSlotId] ?? null
    : null

  return (
    <>
      <CredentialInsightSheet
        open={insightSlotId !== null}
        onOpenChange={(open) => {
          if (!open) closeInsight()
        }}
        slot={insightSlot}
        progress={insightProgress}
        errorMessage={insightSlot?.validationError ?? null}
      />

      <Card className="border-[var(--unifi-border)] shadow-sm">
        <CardContent className="space-y-6 pt-6">
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
                  <CredentialSlotRow
                    key={slot.id}
                    slot={slot}
                    expanded={expandedSlotId === slot.id}
                    onExpandedChange={(nextExpanded) =>
                      setExpandedSlotId(nextExpanded ? slot.id : null)
                    }
                  />
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
                  <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
                    {siteSlots.map((slot) => (
                      <CredentialSlotRow
                        key={slot.id}
                        slot={slot}
                        expanded={expandedSlotId === slot.id}
                        onExpandedChange={(nextExpanded) =>
                          setExpandedSlotId(nextExpanded ? slot.id : null)
                        }
                      />
                    ))}
                  </div>
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
                    <CredentialSlotRow
                      key={slot.id}
                      slot={slot}
                      expanded={expandedSlotId === slot.id}
                      onExpandedChange={(nextExpanded) =>
                        setExpandedSlotId(nextExpanded ? slot.id : null)
                      }
                    />
                  ))
                )}
              </section>
            </>
          )}
        </CardContent>
      </Card>
    </>
  )
}
