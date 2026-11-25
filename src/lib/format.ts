/**
 * Display formatting for dates, times and pet ages (02 R2/R4).
 *
 * UI-layer only: `src/lib/rules/**` stays pure (no Intl, no clock). Every
 * function here takes the value it formats, and every calendar-day value is
 * rendered through a **local** `Date` never through the UTC instant — the fixed
 * D3/D4 off-by-one-day class.
 *
 * Locale is pinned to `en-GB` so the screens, the Playwright assertions and the
 * review screenshots agree regardless of the machine's locale. The output is
 * what 03's wireframes show: "26 Nov 2026", "04 Dec", "Wed 26 Nov 09:30".
 */

import { ageInYears, daysBetween } from '@/lib/rules/calendar'
import type { DateKey, IsoInstant } from '@/lib/rules/types'

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

const DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
})

const WEEKDAY_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: '2-digit',
  month: 'short',
})

const MONTH_YEAR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
})

const TIME_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * A local `Date` for a fixed-width date-only key. Noon local avoids a DST
 * transition at midnight moving the rendered day in a few zones.
 */
function dateAtNoon(key: DateKey): Date {
  const year = Number(key.slice(0, 4))
  const month = Number(key.slice(5, 7))
  const day = Number(key.slice(8, 10))
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

function plural(count: number, singular: string, pluralWord = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralWord}`
}

/** "26 Nov 2026" — the canonical full-date rendering. */
export function formatDateKey(key: DateKey): string {
  return DATE_FORMATTER.format(dateAtNoon(key))
}

/** "26 Nov" — table cells and compact chips. */
export function formatDayMonth(key: DateKey): string {
  return DAY_MONTH_FORMATTER.format(dateAtNoon(key))
}

/** "Wed 26 Nov" — a local day with its weekday, comma-free for the wireframes. */
export function formatWeekdayDayMonth(value: DateKey | Date): string {
  const date = value instanceof Date ? value : dateAtNoon(value)
  return WEEKDAY_DAY_MONTH_FORMATTER.format(date).replace(/,/g, '')
}

/** "November 2026" — calendar and section headings. */
export function formatMonthYear(value: DateKey | Date): string {
  const date = value instanceof Date ? value : dateAtNoon(value)
  return MONTH_YEAR_FORMATTER.format(date)
}

/** "09:30" — 24-hour local time of an instant. */
export function formatTime(instant: IsoInstant | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return TIME_FORMATTER.format(date)
}

/** "Wed 26 Nov 09:30" — appointment rows and the context rail. */
export function formatDateTime(instant: IsoInstant | Date): string {
  const date = instant instanceof Date ? instant : new Date(instant)
  return `${formatWeekdayDayMonth(date)} ${formatTime(date)}`
}

/**
 * Pet age from two local calendar days: "3 yrs", "1 yr", "4 mths", "12 days".
 * Years first (the tables and the pet meta line), then whole months, then days.
 */
export function formatAge(dateOfBirth: DateKey, today: DateKey): string {
  const years = ageInYears(dateOfBirth, today)
  if (years > 0) {
    return plural(years, 'yr')
  }

  const birthYear = Number(dateOfBirth.slice(0, 4))
  const birthMonth = Number(dateOfBirth.slice(5, 7))
  const birthDay = Number(dateOfBirth.slice(8, 10))
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7))
  const todayDay = Number(today.slice(8, 10))

  let months = (todayYear - birthYear) * 12 + (todayMonth - birthMonth)
  if (todayDay < birthDay) {
    months -= 1
  }
  if (months > 0) {
    return plural(months, 'mth')
  }

  return plural(Math.max(0, daysBetween(dateOfBirth, today)), 'day')
}

/* --------------------------------------------------- M4 additions (journal/profile/dashboard)
 *
 * Shared with the initial dashboard route through `summary-format.ts` (which
 * avoids the calendar-rules import in the first-load chunk); re-exported here so
 * every screen still has one formatting import.
 */
export {
  formatCount,
  formatDuration,
  formatInstantTime,
  formatWeekdayDate,
  firstName,
  greetingForDate,
  greetingForHour,
  greetingName,
} from './summary-format'
