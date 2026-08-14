import { Badge } from "@/components/ui/badge"
import {
  APPLICATION_LABELS,
  type CredentialSlot,
  type ValidationSummary,
} from "@/types/credentials"

function applicationLabel(app: string): string {
  return APPLICATION_LABELS[app] ?? app
}

export function ValidationSummaryPanel({
  summary,
}: {
  summary: ValidationSummary
}) {
  return (
    <div className="mt-3 space-y-3 rounded-md border border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-surface-elevated,var(--unifi-surface))_60%,var(--unifi-surface))] p-3">
      <div>
        <p className="text-xs font-medium text-[var(--unifi-text)]">
          Discovered access
        </p>
        <p className="mt-1 text-xs text-[var(--unifi-text-muted)]">
          Live probe results — not the UniFi UI scope picker.
        </p>
      </div>

      {summary.sites.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--unifi-text-muted)]">Sites</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.sites.map((site) => (
              <Badge key={site.siteId} variant="outline" className="text-xs font-normal">
                {site.siteName}
                {site.permission ? ` · ${site.permission}` : ""}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {summary.applicationsObserved.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--unifi-text-muted)]">Applications</p>
          <div className="flex flex-wrap gap-1.5">
            {summary.applicationsObserved.map((app) => (
              <Badge key={app} variant="outline" className="text-xs font-normal">
                {applicationLabel(app)}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      {summary.notes && summary.notes.length > 0 ? (
        <ul className="space-y-1 text-xs text-[var(--unifi-text-muted)]">
          {summary.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function hasValidationSummary(
  slot: CredentialSlot
): slot is CredentialSlot & { validationSummary: ValidationSummary } {
  return Boolean(slot.validationSummary && slot.validationSummary.sites.length > 0)
}
