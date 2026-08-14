import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { CredentialValidationProgressPanel } from "@/components/settings/credential-validation-progress-panel"
import { FleetInventoryRefreshPanel } from "@/components/settings/fleet-inventory-refresh-panel"
import { ValidationSummaryPanel } from "@/components/settings/validation-summary-panel"
import { cn } from "@/lib/utils"
import {
  CREDENTIAL_CAPABILITY_LABELS,
  CREDENTIAL_KIND_LABELS,
  type CredentialCapability,
  type CredentialSlot,
  type CredentialValidationProgress,
} from "@/types/credentials"
import { KeyRound } from "lucide-react"

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

function slotSubtitle(slot: CredentialSlot): string {
  if (slot.boundSiteName) return slot.boundSiteName
  switch (slot.kind) {
    case "site_manager":
      return "Site Manager API · api.ui.com"
    case "network_integration":
      return "Network Integration API · per site"
    default:
      return CREDENTIAL_KIND_LABELS[slot.kind]
  }
}

function CapabilityList({ capabilities }: { capabilities: CredentialCapability[] }) {
  if (capabilities.length === 0) {
    return (
      <p className="text-sm text-[var(--unifi-text-muted)]">
        Capabilities appear after a successful validation.
      </p>
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

type CredentialInsightSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  slot: CredentialSlot | null
  progress: CredentialValidationProgress | null
  errorMessage?: string | null
}

export function CredentialInsightSheet({
  open,
  onOpenChange,
  slot,
  progress,
  errorMessage,
}: CredentialInsightSheetProps) {
  const isValidating =
    slot?.status === "validating" || progress?.phase === "running"

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
      >
        <SheetHeader className="shrink-0 border-b border-[var(--unifi-border)] px-4 py-4 pr-12">
          <div className="flex items-center gap-2">
            <KeyRound className="size-4 text-[var(--unifi-blue)]" />
            <SheetTitle>{slot?.label ?? "Credential details"}</SheetTitle>
          </div>
          <SheetDescription>
            {slot ? slotSubtitle(slot) : "Validation progress and discovered access"}
          </SheetDescription>
          {slot ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn("text-xs font-normal", statusBadgeClass(slot.status))}
              >
                {isValidating
                  ? "Validating…"
                  : slot.status === "configured"
                    ? "Configured"
                    : slot.status === "invalid"
                      ? "Invalid"
                      : "Not configured"}
              </Badge>
              {slot.maskedSuffix ? (
                <span className="text-xs text-[var(--unifi-text-muted)]">
                  Key ending in {slot.maskedSuffix}
                </span>
              ) : null}
            </div>
          ) : null}
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-6 p-4">
            {progress && progress.steps.length > 0 ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--unifi-text)]">
                  Validation progress
                </h3>
                <CredentialValidationProgressPanel
                  progress={progress}
                  variant="plain"
                />
              </section>
            ) : null}

            {errorMessage ? (
              <p className="rounded-md border border-[color-mix(in_srgb,var(--unifi-warning)_35%,var(--unifi-surface))] bg-[color-mix(in_srgb,var(--unifi-warning)_8%,var(--unifi-surface))] px-3 py-2 text-sm text-[var(--unifi-text)]">
                {errorMessage}
              </p>
            ) : null}

            {slot?.validationSummary ? (
              <section className="space-y-2">
                <ValidationSummaryPanel
                  summary={slot.validationSummary}
                  variant="plain"
                />
              </section>
            ) : null}

            {slot ? (
              <FleetInventoryRefreshPanel slot={slot} disabled={isValidating} />
            ) : null}

            {slot ? (
              <section className="space-y-2">
                <h3 className="text-sm font-medium text-[var(--unifi-text)]">
                  Capabilities
                </h3>
                <CapabilityList capabilities={slot.capabilities} />
              </section>
            ) : null}

            {slot?.lastValidatedAt ? (
              <p className="text-xs text-[var(--unifi-text-muted)]">
                Last validated {new Date(slot.lastValidatedAt).toLocaleString()}
              </p>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

export function slotHasInsightContent(
  slot: CredentialSlot,
  progress: CredentialValidationProgress | null | undefined
): boolean {
  return Boolean(
    progress?.steps.length ||
      slot.validationSummary ||
      slot.validationError ||
      slot.status === "validating" ||
      slot.status === "configured"
  )
}
