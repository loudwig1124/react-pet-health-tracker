/**
 * R6 — journal entries are editable; R4 day grouping.
 *
 * Time, note and duration may change after creation; **kind is immutable** in
 * the edit form; duration must be a positive whole number when present. An
 * entry groups under its local calendar day, so editing its time can move it to
 * a different day section.
 *
 * Pure: `now` and `today` are parameters. Deleting asks for confirmation in the
 * UI and goes through the journal repository's one delete path.
 */

import {
  instantMs,
  isIsoInstant,
  localDayOfInstant,
  parseInstant,
  relativeDayLabel,
  type RelativeDayLabel,
} from './calendar'
import { JOURNAL_KINDS } from './constants'
import type { DateKey, IsoInstant, JournalDraft, JournalEntry, JournalKind } from './types'

export type JournalField = 'petId' | 'kind' | 'occurredAt' | 'note' | 'durationMinutes'

export type JournalFieldErrors = Partial<Record<JournalField, string>>

export interface JournalValidationResult {
  isValid: boolean
  errors: JournalFieldErrors
  value: JournalDraft | null
}

/** Trims a note; blank becomes null so the stored value is never `''`. */
export function normalizeJournalNote(note: string | null | undefined): string | null {
  const trimmed = note?.trim()
  return trimmed == null || trimmed === '' ? null : trimmed
}

function isJournalKind(value: unknown): value is JournalKind {
  return typeof value === 'string' && (JOURNAL_KINDS as readonly string[]).includes(value)
}

/**
 * Validates a create/edit draft. Duration: null or a positive whole number —
 * zero, negatives, fractions and NaN are rejected (not silently dropped).
 */
export function validateJournalDraft(draft: JournalDraft): JournalValidationResult {
  const errors: JournalFieldErrors = {}

  const petId = typeof draft.petId === 'string' ? draft.petId.trim() : ''
  if (petId === '') {
    errors.petId = 'Pick a pet'
  }

  if (!isJournalKind(draft.kind)) {
    errors.kind = 'Pick an entry kind'
  }

  if (typeof draft.occurredAt !== 'string' || !isIsoInstant(draft.occurredAt)) {
    errors.occurredAt = 'Pick the time this happened'
  }

  if (
    draft.durationMinutes != null &&
    (typeof draft.durationMinutes !== 'number' ||
      !Number.isInteger(draft.durationMinutes) ||
      draft.durationMinutes <= 0)
  ) {
    errors.durationMinutes = 'Duration must be a positive whole number of minutes'
  }

  const isValid = Object.keys(errors).length === 0
  return {
    isValid,
    errors,
    value: isValid
      ? {
          petId,
          kind: draft.kind,
          occurredAt: parseInstant(draft.occurredAt).toISOString(),
          note: normalizeJournalNote(draft.note),
          durationMinutes: draft.durationMinutes ?? null,
        }
      : null,
  }
}

/** Thrown when a blocked journal edit is attempted (kind is immutable). */
export class JournalRuleException extends Error {
  readonly field: JournalField | 'kind'

  constructor(field: JournalField | 'kind', message: string) {
    super(message)
    this.name = 'JournalRuleException'
    this.field = field
  }
}

/**
 * Applies an edit. The kind and the owning pet are immutable (the edit form
 * never offers them); id/createdAt are preserved. Throws on a kind change or an
 * invalid draft, so the write path cannot persist a bad row.
 */
export function applyJournalEdit(
  existing: JournalEntry,
  draft: JournalDraft,
  options: { now: IsoInstant | Date },
): JournalEntry {
  if (draft.kind !== existing.kind) {
    throw new JournalRuleException('kind', 'The entry kind cannot be changed after logging')
  }
  const validated = validateJournalDraft(draft)
  if (!validated.isValid || validated.value === null) {
    const firstError = Object.entries(validated.errors)[0]
    const field = (firstError?.[0] as JournalField | undefined) ?? 'occurredAt'
    throw new JournalRuleException(field, firstError?.[1] ?? 'The entry is not valid')
  }
  return {
    ...existing,
    petId: existing.petId,
    kind: existing.kind,
    occurredAt: validated.value.occurredAt,
    note: validated.value.note,
    durationMinutes: validated.value.durationMinutes,
    updatedAt: parseInstant(options.now).toISOString(),
  }
}

/** The local calendar day a journal entry groups under (R4). */
export function journalDayKey(entry: Pick<JournalEntry, 'occurredAt'>): DateKey {
  return localDayOfInstant(entry.occurredAt)
}

export interface JournalDayGroup {
  day: DateKey
  label: RelativeDayLabel
  /** Newest first, with `id` as the deterministic tie-break. */
  entries: JournalEntry[]
}

/**
 * Groups entries by local day, newest day first, newest entry first inside a
 * day. `today` is a parameter so tests control the clock.
 */
export function groupJournalEntriesByDay(
  entries: readonly JournalEntry[],
  today: DateKey,
): JournalDayGroup[] {
  const sorted = [...entries].sort((left, right) => {
    const byInstant = instantMs(right.occurredAt) - instantMs(left.occurredAt)
    if (byInstant !== 0) {
      return byInstant
    }
    return left.id > right.id ? -1 : left.id < right.id ? 1 : 0
  })
  const byDay = new Map<DateKey, JournalEntry[]>()
  for (const entry of sorted) {
    const day = journalDayKey(entry)
    const bucket = byDay.get(day)
    if (bucket === undefined) {
      byDay.set(day, [entry])
    } else {
      bucket.push(entry)
    }
  }
  return [...byDay.entries()]
    .sort(([left], [right]) => (left < right ? 1 : left > right ? -1 : 0))
    .map(([day, dayEntries]) => ({
      day,
      label: relativeDayLabel(day, today),
      entries: dayEntries,
    }))
}
