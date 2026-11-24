import type { DeviceActionId } from "@/types/inventory"

export type ActionLogOutcome = "pending" | "ok" | "auth" | "error"

export type ActionLogEntry = {
  id: number
  at: number
  action: DeviceActionId
  deviceName: string
  operation: string
  outcome: ActionLogOutcome
  /** HTTP status when the error text carries one. */
  status?: number
  error?: string
}

export const MAX_ACTION_LOG_ENTRIES = 200

export const LOCATE_PENDING_OPERATION =
  "resolve console IP, then POST set-locate"
export const LOCATE_OK_OPERATION = "POST set-locate"

const HTTP_REQUEST = /\b(GET|POST|PUT|PATCH|DELETE) (.+?): HTTP (\d{3})/
const HTTP_STATUS = /\bHTTP (\d{3})\b/
const AUTH_FAILURE = /unauthori[sz]ed|refused the factory default login|API key is not configured/i
const SECRET_FIELD =
  /(x-api-key|api[-_ ]?key|password|passwd|secret|token|cookie|csrf|authorization)(["']?\s*[:=]\s*["']?)[^\s"',;}]+/gi

/** Strips credential-looking values so an error string is safe to display. */
export function redactSecrets(text: string): string {
  return text.replace(SECRET_FIELD, "$1$2[redacted]")
}

export type FailureDetails = Pick<
  ActionLogEntry,
  "outcome" | "status" | "operation" | "error"
>

/** Classifies a locate failure from the error text the Go side returns. */
export function describeLocateFailure(message: string): FailureDetails {
  const error = redactSecrets(message)
  const request = HTTP_REQUEST.exec(message)
  const status = Number(request?.[3] ?? HTTP_STATUS.exec(message)?.[1]) || undefined
  const isAuth =
    status === 401 || status === 403 || AUTH_FAILURE.test(message)

  return {
    outcome: isAuth ? "auth" : "error",
    status,
    operation: request
      ? redactSecrets(`${request[1]} ${request[2]}`)
      : operationFromMessage(message),
    error,
  }
}

function operationFromMessage(message: string): string {
  if (/factory default login/i.test(message)) return "POST /api/auth/login"
  if (/refused the locate command/i.test(message)) return LOCATE_OK_OPERATION
  return "LocateDevice"
}

type OutcomePresentation = {
  /** Status word shown first on the row so color is never the only cue. */
  word: (entry: ActionLogEntry) => string
  /** Tailwind classes built from the app's CSS variables. */
  rowClass: string
  wordClass: string
}

export const OUTCOME_PRESENTATION: Record<ActionLogOutcome, OutcomePresentation> = {
  ok: {
    word: () => "OK",
    rowClass:
      "border-l-[color:var(--unifi-success)] bg-[color-mix(in_srgb,var(--unifi-success)_10%,var(--unifi-surface))]",
    wordClass: "text-[var(--unifi-success)]",
  },
  auth: {
    word: (entry) => (entry.status ? String(entry.status) : "AUTH"),
    rowClass:
      "border-l-[color:var(--unifi-warning)] bg-[color-mix(in_srgb,var(--unifi-warning)_14%,var(--unifi-surface))]",
    wordClass: "text-[var(--unifi-warning)]",
  },
  error: {
    word: () => "ERROR",
    rowClass:
      "border-l-[color:var(--destructive)] bg-[color-mix(in_srgb,var(--destructive)_10%,var(--unifi-surface))]",
    wordClass: "text-[var(--destructive)]",
  },
  pending: {
    word: () => "PENDING",
    rowClass:
      "border-l-[color:var(--unifi-text-muted)] bg-[color-mix(in_srgb,var(--unifi-text-muted)_8%,var(--unifi-surface))]",
    wordClass: "text-[var(--unifi-text-muted)]",
  },
}

export function prependLogEntry(
  log: ActionLogEntry[],
  entry: ActionLogEntry
): ActionLogEntry[] {
  return [entry, ...log].slice(0, MAX_ACTION_LOG_ENTRIES)
}

export function updateLogEntry(
  log: ActionLogEntry[],
  id: number,
  patch: Partial<ActionLogEntry>
): ActionLogEntry[] {
  return log.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry))
}
