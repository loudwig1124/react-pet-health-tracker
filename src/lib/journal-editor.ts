import { formatDateKey } from '@/lib/format'
/**
 * The journal editor's draft model (R6/R4).
 *
 * The editor works in local date + `HH:mm` fields because that is what the user
 * sees; the stored value is still an ISO-8601 UTC instant. Keeping the
 * conversion here (pure, no React, no store) means the round-trip — including
 * the 23:55 local day edge that R4 cares about — is unit-testable.
 *
 * Editing is limited to time, note and duration: `petId` and `kind` are carried
 * only so the disabled controls can show what the entry is.
 */
import { isDateKey } from '@/lib/rules/calendar'
import { JOURNAL_KINDS } from '@/lib/rules/constants'
import { validateJournalDraft } from '@/lib/rules/journal'
import type {
  DateKey,
  IsoInstant,
  JournalDraft,
  JournalEntry,
  JournalKind,
} from '@/lib/rules/types'

export interface JournalEditorDraft {
  petId: string
  kind: JournalKind
  /** Fixed-width local calendar day. */
  date: DateKey
  /** Local clock time `HH:mm`. */
  time: string
  note: string
  /** Raw input text; empty means "no duration". */
  duration: string
}

export type JournalEditorField = 'petId' | 'kind' | 'date' | 'time' | 'note' | 'durationMinutes'

export type JournalEditorErrors = Partial<Record<JournalEditorField, string>>

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

export function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/** The local day and clock of a stored instant, as the editor's fields. */
export function splitLocalDateTime(instant: IsoInstant): { date: DateKey; time: string } {
  const value = new Date(instant)
  return {
    date: `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`,
    time: `${pad2(value.getHours())}:${pad2(value.getMinutes())}`,
  }
}

/**
 * Combines local date and time fields into a Date. Returns `null` for an
 * impossible combination instead of silently rolling over (e.g. 24:00).
 */
export function combineLocalDateTime(date: DateKey, time: string): Date | null {
  if (!isDateKey(date)) {
    return null
  }
  const match = TIME_PATTERN.exec(time)
  if (match === null) {
    return null
  }
  const year = Number(date.slice(0, 4))
  const month = Number(date.slice(5, 7))
  const day = Number(date.slice(8, 10))
  const hours = Number(match[1])
  const minutes = Number(match[2])
  return new Date(year, month - 1, day, hours, minutes, 0, 0)
}

export function draftForNewEntry(petId: string, now: Date = new Date()): JournalEditorDraft {
  return {
    petId,
    kind: 'walk',
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
    note: '',
    duration: '',
  }
}

export function draftFromEntry(entry: JournalEntry): JournalEditorDraft {
  const { date, time } = splitLocalDateTime(entry.occurredAt)
  return {
    petId: entry.petId,
    kind: entry.kind,
    date,
    time,
    note: entry.note ?? '',
    duration: entry.durationMinutes === null ? '' : String(entry.durationMinutes),
  }
}

function parseDurationText(text: string): number | null | 'invalid' {
  const trimmed = text.trim()
  if (trimmed === '') {
    return null
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value) || !Number.isInteger(value) || value <= 0) {
    return 'invalid'
  }
  return value
}

export interface JournalDraftResult {
  value: JournalDraft | null
  errors: JournalEditorErrors
}

/**
 * Turns the editable fields into a validated `JournalDraft` for the repository.
 * The R6 validation runs here as well, so the write path never receives a
 * fractional or zero duration even though the form is not trusted.
 */
export function draftToJournalDraft(draft: JournalEditorDraft): JournalDraftResult {
  const errors: JournalEditorErrors = {}

  if (draft.petId.trim() === '') {
    errors.petId = 'Pick a pet'
  }
  if (!(JOURNAL_KINDS as readonly string[]).includes(draft.kind)) {
    errors.kind = 'Pick an entry kind'
  }

  const occurrence = combineLocalDateTime(draft.date, draft.time)
  if (occurrence === null) {
    if (!isDateKey(draft.date)) {
      errors.date = 'Pick the day this happened'
    }
    if (!TIME_PATTERN.test(draft.time)) {
      errors.time = 'Enter a time as HH:mm'
    }
  }

  const duration = parseDurationText(draft.duration)
  if (duration === 'invalid') {
    errors.durationMinutes = 'Duration must be a positive whole number of minutes'
  }

  if (Object.keys(errors).length > 0 || occurrence === null) {
    return { value: null, errors }
  }

  const durationMinutes = duration === 'invalid' ? null : duration
  const candidate: JournalDraft = {
    petId: draft.petId.trim(),
    kind: draft.kind,
    occurredAt: occurrence.toISOString(),
    note: draft.note,
    durationMinutes,
  }

  const validated = validateJournalDraft(candidate)
  if (!validated.isValid || validated.value === null) {
    return {
      value: null,
      errors: {
        ...(validated.errors.note === undefined ? {} : { note: validated.errors.note }),
        ...(validated.errors.durationMinutes === undefined
          ? {}
          : { durationMinutes: validated.errors.durationMinutes }),
        ...(validated.errors.petId === undefined ? {} : { petId: validated.errors.petId }),
        ...(validated.errors.kind === undefined ? {} : { kind: validated.errors.kind }),
        ...(validated.errors.occurredAt === undefined ? {} : { time: validated.errors.occurredAt }),
      },
    }
  }

  return { value: validated.value, errors: {} }
}

/** True when the draft has anything the user would miss if it vanished. */
export function hasMeaningfulDraft(draft: JournalEditorDraft): boolean {
  return draft.note.trim() !== '' || draft.duration.trim() !== ''
}

/**
 * The heading for one day section: "Today", "Yesterday", then the full date.
 * Shared by `/journal` and the pet detail Journal tab so a row lands under the
 * same label on both screens (03 §3).
 */
export function journalDayHeading(group: {
  label: 'today' | 'yesterday' | 'date'
  day: DateKey
}): string {
  if (group.label === 'today') {
    return 'Today'
  }
  if (group.label === 'yesterday') {
    return 'Yesterday'
  }
  return formatDateKey(group.day)
}
