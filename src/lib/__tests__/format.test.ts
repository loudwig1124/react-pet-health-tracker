import { describe, expect, it } from 'vitest'

import {
  formatCount,
  formatDateKey,
  formatDuration,
  formatInstantTime,
  formatWeekdayDate,
  greetingForDate,
  greetingForHour,
  greetingName,
} from '@/lib/format'

/** The display helpers added/consumed by M4 (journal, profile, dashboard). */
describe('format (M4 display contract)', () => {
  it('formats fixed-width date keys with the pinned en-GB locale', () => {
    expect(formatDateKey('2026-11-26')).toBe('26 Nov 2026')
    expect(formatDateKey('2026-03-02')).toBe('02 Mar 2026')
  })

  it('formats the dashboard date line with the full weekday', () => {
    expect(formatWeekdayDate('2026-11-26')).toBe('Thursday 26 November 2026')
  })

  it('formats a stored instant in local 24-hour time', () => {
    const localSevenTen = new Date(2026, 10, 26, 7, 10, 0, 0).toISOString()
    expect(formatInstantTime(localSevenTen)).toBe('07:10')
  })

  it('groups counts without plural rules surprises', () => {
    expect(formatCount(1, 'pet')).toBe('1 pet')
    expect(formatCount(0, 'pet')).toBe('0 pets')
    expect(formatCount(3, 'entry', 'entries')).toBe('3 entries')
  })

  it('formats nullable durations', () => {
    expect(formatDuration(30)).toBe('30 min')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
  })

  it('greets by time of day', () => {
    expect(greetingForHour(0)).toBe('Good morning')
    expect(greetingForHour(11)).toBe('Good morning')
    expect(greetingForHour(12)).toBe('Good afternoon')
    expect(greetingForHour(17)).toBe('Good afternoon')
    expect(greetingForHour(18)).toBe('Good evening')
    expect(greetingForDate(new Date(2026, 10, 26, 20, 0))).toBe('Good evening')
  })

  it('omits the placeholder household name from a greeting', () => {
    expect(greetingName('My household', 'My household')).toBeNull()
    expect(greetingName('  ', 'My household')).toBeNull()
    expect(greetingName('Daniel Reyes', 'My household')).toBe('Daniel')
  })
})
