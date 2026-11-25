/**
 * Small write helpers shared by the repositories. `now` is always injectable so
 * rules/repository tests are deterministic (06 §4: rules take `now`/`today` as
 * parameters; only the composition root reads the wall clock).
 */

/** Mints a client-side UUID; two tabs cannot allocate the same id (01 D6a). */
export function newId(): string {
  return crypto.randomUUID()
}

/** The stored instant shape: ISO-8601 UTC with milliseconds (02 R2). */
export function toIsoInstant(now: Date = new Date()): string {
  return now.toISOString()
}

/** Trims a text input, turning blank strings into `null` for nullable columns. */
export function trimmedOrNull(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
