import { describe, expect, it } from 'vitest'

import {
  formatDateKey,
  formatDateTime,
  formatDateTimeWithYear,
  formatDayMonth,
  formatMonthYearOfKey,
  formatTime,
  instantFromLocalDateTime,
  isValidTimeInput,
  localDateFromKey,
  localDateTimeParts,
  localDayOf,
  monthStartKey,
} from './format'

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

describe('schedule date/time formatting (R2/R4)', () => {
  it('renders date-only values on the UTC day, never shifted by the reader zone', () => {
    expect(formatDateKey('2026-11-26')).toBe('26 Nov 2026')
    expect(formatDayMonth('2026-01-01')).toBe('01 Jan')
    expect(formatMonthYearOfKey('2026-11-01')).toBe('November 2026')
  })

  it('renders instants on the local clock', () => {
    const instant = '2026-11-26T01:30:00.000Z'
    const local = new Date(instant)
    expect(formatTime(instant)).toBe(`${pad(local.getHours())}:${pad(local.getMinutes())}`)
    expect(formatDateTime(instant)).toContain(formatTime(instant))
    expect(formatDateTimeWithYear(instant)).toContain(String(local.getFullYear()))
  })

  it('builds a real local instant from a date and a time and reads it back', () => {
    const iso = instantFromLocalDateTime('2026-11-26', '09:30')
    expect(localDateTimeParts(iso)).toEqual({ date: '2026-11-26', time: '09:30' })
    // Midday is never affected by a DST transition, unlike a midnight probe.
    expect(localDayOf(iso)).toBe('2026-11-26')
  })

  it('rejects invalid date/time inputs instead of storing a different instant', () => {
    expect(isValidTimeInput('09:30')).toBe(true)
    expect(isValidTimeInput('9:30')).toBe(false)
    expect(isValidTimeInput('24:00')).toBe(false)
    expect(() => instantFromLocalDateTime('2026-02-30', '09:30')).toThrow(/not a YYYY-MM-DD/)
    expect(() => instantFromLocalDateTime('2026-11-26', '25:00')).toThrow(/HH:mm/)
  })

  it('converts between date keys and local Date objects for the calendar', () => {
    const date = localDateFromKey('2026-11-26')
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(10)
    expect(date.getDate()).toBe(26)
    expect(monthStartKey(date)).toBe('2026-11-01')
  })
})
