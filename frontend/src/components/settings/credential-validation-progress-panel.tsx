import { cn } from "@/lib/utils"
import { formatValidationTarget } from "@/lib/credential-validation-progress"
import type {
  CredentialValidationProgress,
  CredentialValidationStep,
} from "@/types/credentials"

function StepIcon({ status }: { status: CredentialValidationStep["status"] }) {
  switch (status) {
    case "complete":
      return (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--unifi-success)_18%,var(--unifi-surface))] text-[10px] text-[var(--unifi-success)]"
          aria-hidden
        >
          ✓
        </span>
      )
    case "active":
      return (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center"
          aria-hidden
        >
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--unifi-border)] border-t-[var(--unifi-accent)]" />
        </span>
      )
    case "error":
      return (
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--unifi-warning)_18%,var(--unifi-surface))] text-[10px] text-[var(--unifi-warning)]"
          aria-hidden
        >
          !
        </span>
      )
    case "skipped":
      return (
        <span
          className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--unifi-text-muted)] opacity-50"
          aria-hidden
        />
      )
    default:
      return (
        <span
          className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full border border-[var(--unifi-border)]"
          aria-hidden
        />
      )
  }
}

function stepTextClass(status: CredentialValidationStep["status"]): string {
  switch (status) {
    case "active":
      return "text-[var(--unifi-text)]"
    case "complete":
      return "text-[var(--unifi-text-muted)]"
    case "error":
      return "text-[var(--unifi-warning)]"
    case "skipped":
      return "text-[var(--unifi-text-muted)] line-through opacity-70"
    default:
      return "text-[var(--unifi-text-muted)]"
  }
}

export function CredentialValidationProgressPanel({
  progress,
  variant = "card",
}: {
  progress: CredentialValidationProgress
  variant?: "card" | "plain"
}) {
  if (progress.steps.length === 0) return null

  const heading =
    progress.phase === "error"
      ? "Validation failed"
      : progress.phase === "done"
        ? "Validation complete"
        : "Validating credential…"

  return (
    <div
      className={
        variant === "card"
          ? "mt-3 space-y-2 rounded-md border border-[var(--unifi-border)] bg-[color-mix(in_srgb,var(--unifi-surface-elevated,var(--unifi-surface))_60%,var(--unifi-surface))] p-3"
          : "space-y-3"
      }
      role="status"
      aria-live="polite"
    >
      <p
        className={
          variant === "card"
            ? "text-xs font-medium text-[var(--unifi-text)]"
            : "text-sm font-medium text-[var(--unifi-text)]"
        }
      >
        {heading}
      </p>
      <ol className={variant === "card" ? "space-y-2" : "space-y-3"}>
        {progress.steps.map((step, index) => {
          const target = formatValidationTarget(step.target)
          return (
            <li
              key={`${index}-${step.label}`}
              className={cn(
                "flex gap-2",
                variant === "card" ? "text-xs" : "text-sm",
                stepTextClass(step.status)
              )}
            >
              <StepIcon status={step.status} />
              <div className="min-w-0 space-y-0.5">
                <p>{step.label}</p>
                {target ? (
                  <p className="truncate font-mono text-[10px] text-[var(--unifi-text-muted)]">
                    → {target}
                  </p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
