/**
 * Schedule-screen date helpers on top of the household formatter.
 *
 * `src/lib/format.ts` (M2) owns the shared "26 Nov 2026" / "09:30" rendering
 * and pins `en-GB`; this module adds only what the M3 screens need: the local
 * instant ↔ date+time round trip used by the booking/reschedule forms, the
 * date-key ↔ local-`Date` bridge the calendar needs, and an instant rendering
 * that includes the year for terminal visit summaries.
 *
 * Two rules from 02 R2/R4 still hold here:
 * - date-only values are fixed-width `YYYY-MM-DD`;
 * - an instant's human time is the reader's local clock, which is also the
 *   calendar day the rules use.
 */

import { formatDateKey, formatTime } from '@/lib/format'
import { isDateKey, localDateKey, parseInstant, todayKey } from '@/lib/rules/calendar'
import type { DateKey, IsoInstant } from '@/lib/rules/types'

export { formatDateKey, formatDayMonth, formatTime } from '@/lib/format'

export { formatMonthYear as formatMonthYearOfKey } from '@/lib/format'

/** "Wed 26 Nov 09:30" — the when column (shared formatter, local clock). */
export { formatDateTime } from '@/lib/format'

/** "26 Nov 2026, 09:30" — terminal summaries where the year matters. */
export function formatDateTimeWithYear(instant: IsoInstant | Date): string {
  return `${formatDateKey(localDayOf(instant))}, ${formatTime(instant)}`
}

/** Today's local date key, for components that need the default "today". */
export function localToday(now: Date = new Date()): DateKey {
  return todayKey(now)
}

/** The local calendar day of a stored instant (R4), e.g. for `?day=`. */
export function localDayOf(instant: IsoInstant | Date): DateKey {
  return localDateKey(parseInstant(instant))
}

/* ------------------------------------------------------------- date inputs */

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/

/** True for a valid 24-hour `HH:mm` value from `<input type="time">`. */
export function isValidTimeInput(value: string): boolean {
  return TIME_PATTERN.test(value)
}

/**
 * Builds a real local instant from a date-only value and a 24-hour time.
 * Throws for an invalid shape or a local time that does not exist (a DST gap),
 * so a booking can never silently store a different clock time.
 */
export function instantFromLocalDateTime(dateKey: DateKey, time: string): IsoInstant {
  if (!isDateKey(dateKey)) {
    throw new RangeError(`"${dateKey}" is not a YYYY-MM-DD date`)
  }
  const match = TIME_PATTERN.exec(time)
  if (match === null) {
    throw new RangeError(`"${time}" is not an HH:mm time`)
  }
  const year = Number(dateKey.slice(0, 4))
  const month = Number(dateKey.slice(5, 7))
  const day = Number(dateKey.slice(8, 10))
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const local = new Date(year, month - 1, day, hours, minutes, 0, 0)
  if (
    local.getFullYear() !== year ||
    local.getMonth() !== month - 1 ||
    local.getDate() !== day ||
    local.getHours() !== hours ||
    local.getMinutes() !== minutes
  ) {
    throw new RangeError(`That local time does not exist on ${dateKey}`)
  }
  return local.toISOString()
}

/** The local date + time form values for an instant (reschedule prefill). */
export function localDateTimeParts(instant: IsoInstant | Date): { date: DateKey; time: string } {
  const date = parseInstant(instant)
  return { date: localDateKey(date), time: formatTime(date) }
}

/**
 * A local-midnight Date for a date-only value, which is what react-day-picker
 * and the native date input work with.
 */
export function localDateFromKey(key: DateKey): Date {
  if (!isDateKey(key)) {
    throw new RangeError(`"${key}" is not a YYYY-MM-DD date`)
  }
  return new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10)))
}

/** The first day of the local month containing `date`, as a date key. */
export function monthStartKey(date: Date): DateKey {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1))
}
