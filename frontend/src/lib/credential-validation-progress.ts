export const CREDENTIAL_VALIDATION_PROGRESS_EVENT =
  "credential-validation-progress"

export function formatValidationTarget(target: string | undefined): string | null {
  if (!target?.trim()) return null
  const trimmed = target.trim()
  if (trimmed.startsWith("https://")) {
    try {
      return new URL(trimmed).host
    } catch {
      return trimmed
    }
  }
  return trimmed
}
