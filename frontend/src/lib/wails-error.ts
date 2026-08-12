export function formatWailsError(err: unknown, fallback: string): string {
  if (err instanceof Error) {
    return err.message
  }
  if (typeof err === "string" && err.trim()) {
    return err
  }
  return fallback
}
