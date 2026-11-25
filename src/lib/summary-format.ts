/**
 * The small display helpers the **initial** `/` route needs (dashboard).
 *
 * Kept apart from `format.ts` because that module also renders ages and needs
 * the calendar rules; the first-load budget counts the dashboard chunk, and the
 * M4 gate only had a few kB of headroom. `format.ts` re-exports these, so every
 * other screen keeps importing one formatting module.
 */
import type { IsoInstant } from '@/lib/rules/types'

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function dateAtNoon(key: string): Date {
  return new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
    12,
    0,
    0,
    0,
  )
}

function plural(count: number, singular: string, pluralWord = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralWord}`
}

/** "Wednesday 26 November 2026" — the dashboard's date line. */
export function formatWeekdayDate(value: string | Date): string {
  const date = value instanceof Date ? value : dateAtNoon(value)
  return LONG_DATE_FORMATTER.format(date).replace(/,/g, '')
}

/** 24-hour local time of a stored instant, e.g. "07:10". */
export function formatInstantTime(instant: IsoInstant | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return TIME_FORMATTER.format(date)
}

/** "30 min" / "—" for a nullable duration. */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || !Number.isFinite(minutes)) {
    return '—'
  }
  return `${minutes} min`
}

/** "1 entry" / "4 entries" — UI copy counts. */
export function formatCount(count: number, singular: string, pluralWord = `${singular}s`): string {
  return plural(count, singular, pluralWord)
}

/** The 02 §1 greeting: morning until noon, afternoon until 18:00, then evening. */
export function greetingForHour(hour: number): string {
  if (hour < 12) {
    return 'Good morning'
  }
  if (hour < 18) {
    return 'Good afternoon'
  }
  return 'Good evening'
}

export function greetingForDate(now: Date): string {
  return greetingForHour(now.getHours())
}

/** First name only; falls back to the whole (already trimmed) name. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? ''
}

/**
 * The name that may follow a greeting. The placeholder household name is not a
 * person, so the greeting stays impersonal until the owner says who they are
 * (02 §1: "omitted while the owner is still `My household`").
 */
export function greetingName(ownerName: string, placeholder: string): string | null {
  const trimmed = ownerName.trim()
  if (trimmed === '' || trimmed === placeholder) {
    return null
  }
  return firstName(trimmed)
}
