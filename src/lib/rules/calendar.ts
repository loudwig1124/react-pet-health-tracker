/**
 * R4 — one local calendar day.
 *
 * Due status, "last visit", journal day grouping, Today/Yesterday labels and
 * the next-visit day all use the **local** calendar day. Storage keeps UTC
 * instants and fixed-width `YYYY-MM-DD` date-only values, which compare as
 * strings.
 *
 * Pure: no `Date.now()`, no DOM, no Intl, no date library. Every function takes
 * the values it needs (`today`, `now`) as parameters.
 */

import type { Appointment, DateKey, IsoInstant } from './types'

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 86_400_000

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

/** Days in a calendar month; `month` is 1-based (1 = January). */
export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Invalid calendar month: ${year}-${month}`)
  }
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28
    case 4:
    case 6:
    case 9:
    case 11:
      return 30
    default:
      return 31
  }
}

interface DateParts {
  year: number
  month: number
  day: number
}

function parseDateKey(value: string, label = 'date'): DateParts {
  const match = DATE_KEY_PATTERN.exec(value)
  if (match === null) {
    throw new RangeError(`${label} must be a fixed-width YYYY-MM-DD date, received "${value}"`)
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`${label} is not a real calendar day: "${value}"`)
  }
  return { year, month, day }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0')
}

export function isDateKey(value: unknown): value is DateKey {
  if (typeof value !== 'string') {
    return false
  }
  try {
    parseDateKey(value)
    return true
  } catch {
    return false
  }
}

export function assertDateKey(value: unknown, label = 'date'): DateKey {
  if (typeof value !== 'string') {
    throw new RangeError(`${label} must be a YYYY-MM-DD string`)
  }
  parseDateKey(value, label)
  return value
}

/** Builds a validated, fixed-width date-only value. */
export function dateKeyFromParts(year: number, month: number, day: number): DateKey {
  if (!Number.isInteger(year) || year < 0 || year > 9999) {
    throw new RangeError(`Invalid calendar year: ${year}`)
  }
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`Invalid calendar day: ${year}-${month}-${day}`)
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

/** Days since the Unix epoch for a date-only value; used for day arithmetic. */
function utcDayNumber(key: DateKey): number {
  const { year, month, day } = parseDateKey(key)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)
  return Math.round(date.getTime() / MS_PER_DAY)
}

function dateKeyFromDayNumber(dayNumber: number): DateKey {
  const date = new Date(dayNumber * MS_PER_DAY)
  return dateKeyFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
}

export function parseInstant(value: string | Date): Date {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new TypeError(`Invalid ISO-8601 instant: ${String(value)}`)
  }
  return date
}

export function isIsoInstant(value: unknown): value is IsoInstant {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

export function instantMs(value: string | Date): number {
  return parseInstant(value).getTime()
}

/** Normalises any Date to the stored ISO-8601 UTC-with-milliseconds shape. */
export function isoInstantFromDate(value: Date | string): IsoInstant {
  return parseInstant(value).toISOString()
}

/** The local calendar day of an instant — never the UTC day (R4, bugs D3/D4). */
export function localDateKey(value: Date): DateKey {
  const date = parseInstant(value)
  return dateKeyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate())
}

/** The local calendar day of a stored instant. */
export function localDayOfInstant(instant: string | Date): DateKey {
  return localDateKey(parseInstant(instant))
}

/** Today as a local calendar day; callers pass `now` explicitly (no clock here). */
export function todayKey(now: Date | string): DateKey {
  return localDayOfInstant(now)
}

export function addDays(key: DateKey, days: number): DateKey {
  assertDateKey(key)
  if (!Number.isInteger(days)) {
    throw new RangeError(`addDays needs an integer day count, received ${days}`)
  }
  return dateKeyFromDayNumber(utcDayNumber(key) + days)
}

/** Adds calendar months, clamping to the target month's last day. */
export function addMonths(key: DateKey, months: number): DateKey {
  const { year, month, day } = parseDateKey(key)
  if (!Number.isInteger(months)) {
    throw new RangeError(`addMonths needs an integer month count, received ${months}`)
  }
  const monthIndex = year * 12 + (month - 1) + months
  const targetYear = Math.floor(monthIndex / 12)
  const targetMonth = monthIndex - targetYear * 12 + 1
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth))
  return dateKeyFromParts(targetYear, targetMonth, targetDay)
}

export function addYears(key: DateKey, years: number): DateKey {
  return addMonths(key, years * 12)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: DateKey, to: DateKey): number {
  assertDateKey(from, 'from')
  assertDateKey(to, 'to')
  return utcDayNumber(to) - utcDayNumber(from)
}

/** Lexicographic compare, which is chronological for fixed-width keys. */
export function compareDateKeys(a: DateKey, b: DateKey): number {
  assertDateKey(a, 'a')
  assertDateKey(b, 'b')
  if (a < b) {
    return -1
  }
  if (a > b) {
    return 1
  }
  return 0
}

export function isBeforeDateKey(a: DateKey, b: DateKey): boolean {
  return compareDateKeys(a, b) < 0
}

export function isAfterDateKey(a: DateKey, b: DateKey): boolean {
  return compareDateKeys(a, b) > 0
}

export function isSameDateKey(a: DateKey, b: DateKey): boolean {
  return compareDateKeys(a, b) === 0
}

export function monthEndKey(key: DateKey): DateKey {
  const { year, month } = parseDateKey(key)
  return dateKeyFromParts(year, month, daysInMonth(year, month))
}

/** Latest of the provided date keys, ignoring null/undefined; null when none. */
export function latestDateKey(values: Iterable<DateKey | null | undefined>): DateKey | null {
  let latest: DateKey | null = null
  for (const value of values) {
    if (value == null) {
      continue
    }
    assertDateKey(value, 'latestDateKey')
    if (latest === null || value > latest) {
      latest = value
    }
  }
  return latest
}

export interface LastVisitAppointment {
  status: Appointment['status']
  scheduledAt: IsoInstant
  completedAt: IsoInstant | null
}

/**
 * Last visit = later of the latest completed appointment's local day and the
 * latest clinical note's `recordedOn` (R4). Completed visits use `completedAt`,
 * falling back to `scheduledAt` for legacy rows.
 */
export function lastVisitDateKey(
  appointments: readonly LastVisitAppointment[],
  recordedOn: readonly (DateKey | null | undefined)[],
): DateKey | null {
  let latest: DateKey | null = null
  for (const appointment of appointments) {
    if (appointment.status !== 'completed') {
      continue
    }
    const visitDay = localDayOfInstant(appointment.completedAt ?? appointment.scheduledAt)
    if (latest === null || visitDay > latest) {
      latest = visitDay
    }
  }
  for (const day of recordedOn) {
    if (day == null) {
      continue
    }
    assertDateKey(day, 'recordedOn')
    if (latest === null || day > latest) {
      latest = day
    }
  }
  return latest
}

/** Whole years between a birth date and a reference day, never negative. */
export function ageInYears(dateOfBirth: DateKey, today: DateKey): number {
  const birth = parseDateKey(dateOfBirth, 'dateOfBirth')
  const reference = parseDateKey(today, 'today')
  let years = reference.year - birth.year
  const beforeBirthday =
    reference.month < birth.month || (reference.month === birth.month && reference.day < birth.day)
  if (beforeBirthday) {
    years -= 1
  }
  return Math.max(0, years)
}

export type RelativeDayLabel = 'today' | 'yesterday' | 'date'

/**
 * The section label for a journal day group: Today, Yesterday, then a date.
 * The date formatting itself lives in the UI layer, so this stays pure.
 */
export function relativeDayLabel(date: DateKey, today: DateKey): RelativeDayLabel {
  const diff = daysBetween(date, today)
  if (diff === 0) {
    return 'today'
  }
  if (diff === 1) {
    return 'yesterday'
  }
  return 'date'
}
