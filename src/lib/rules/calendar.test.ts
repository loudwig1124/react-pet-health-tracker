import { describe, expect, it } from 'vitest'

import {
  addDays,
  addMonths,
  addYears,
  ageInYears,
  compareDateKeys,
  dateKeyFromParts,
  daysBetween,
  daysInMonth,
  isAfterDateKey,
  isBeforeDateKey,
  isDateKey,
  isIsoInstant,
  isLeapYear,
  isSameDateKey,
  isoInstantFromDate,
  lastVisitDateKey,
  latestDateKey,
  localDateKey,
  localDayOfInstant,
  monthEndKey,
  parseInstant,
  relativeDayLabel,
  assertDateKey,
  todayKey,
} from './calendar'

const localInstant = (year: number, month: number, day: number, hour = 12, minute = 0): Date =>
  new Date(year, month - 1, day, hour, minute, 0, 0)

describe('R4 calendar · local calendar day', () => {
  it('accepts: a local 00:30 instant belongs to its local day, not the UTC day', () => {
    const instant = localInstant(2026, 3, 2, 0, 30)
    expect(localDateKey(instant)).toBe('2026-03-02')
    expect(localDayOfInstant(instant.toISOString())).toBe('2026-03-02')
    // When the machine is east of UTC (as the school laptop is, UTC+8), the UTC
    // slice is a day behind. The helper must never return that day.
    const utcDay = instant.toISOString().slice(0, 10)
    if (utcDay !== '2026-03-02') {
      expect(localDateKey(instant)).not.toBe(utcDay)
    }
  })

  it('accepts: a 23:55 local entry keeps its own day and is Yesterday, not Today', () => {
    const lateEntry = localInstant(2026, 3, 1, 23, 55)
    const entryDay = localDayOfInstant(lateEntry.toISOString())
    expect(entryDay).toBe('2026-03-01')
    expect(relativeDayLabel(entryDay, '2026-03-02')).toBe('yesterday')
    expect(relativeDayLabel(entryDay, '2026-03-01')).toBe('today')
    expect(relativeDayLabel('2026-02-27', '2026-03-02')).toBe('date')
  })

  it('accepts: a visit completed 07:30 local on 2 Mar shows last visit 2 Mar', () => {
    const completedAt = localInstant(2026, 3, 2, 7, 30)
    const lastVisit = lastVisitDateKey(
      [
        {
          status: 'completed',
          scheduledAt: localInstant(2026, 3, 2, 7, 0).toISOString(),
          completedAt: completedAt.toISOString(),
        },
      ],
      [],
    )
    expect(lastVisit).toBe('2026-03-02')
  })

  it('accepts: last visit is the later of the latest completed visit and the latest note', () => {
    expect(
      lastVisitDateKey(
        [
          {
            status: 'completed',
            scheduledAt: localInstant(2026, 3, 2, 7, 0).toISOString(),
            completedAt: localInstant(2026, 3, 2, 7, 30).toISOString(),
          },
        ],
        ['2026-03-01'],
      ),
    ).toBe('2026-03-02')
    expect(
      lastVisitDateKey(
        [
          {
            status: 'completed',
            scheduledAt: localInstant(2026, 3, 2, 7, 0).toISOString(),
            completedAt: localInstant(2026, 3, 2, 7, 30).toISOString(),
          },
        ],
        ['2026-03-05'],
      ),
    ).toBe('2026-03-05')
  })

  it('rejects: cancelled and scheduled visits never count as a last visit', () => {
    expect(
      lastVisitDateKey(
        [
          {
            status: 'cancelled',
            scheduledAt: localInstant(2026, 3, 2, 7, 0).toISOString(),
            completedAt: null,
          },
          {
            status: 'scheduled',
            scheduledAt: localInstant(2026, 3, 3, 7, 0).toISOString(),
            completedAt: null,
          },
        ],
        [null, undefined, '2026-02-01'],
      ),
    ).toBe('2026-02-01')
    expect(lastVisitDateKey([], [])).toBeNull()
  })

  it('rejects: an impossible date is not a date key', () => {
    expect(isDateKey('2026-02-30')).toBe(false)
    expect(isDateKey('2026-13-01')).toBe(false)
    expect(isDateKey('2026-2-3')).toBe(false)
    expect(isDateKey(20260203)).toBe(false)
    expect(() => daysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError)
    expect(() => dateKeyFromParts(2026, 2, 30)).toThrow(RangeError)
  })

  it('accepts: todayKey uses the local day', () => {
    const now = localInstant(2026, 3, 2, 0, 30)
    expect(todayKey(now)).toBe('2026-03-02')
    expect(todayKey(now.toISOString())).toBe('2026-03-02')
  })
})

describe('R4 calendar · fixed-width YYYY-MM-DD compares as strings', () => {
  it('accepts: fixed-width keys sort chronologically', () => {
    const keys = ['2026-03-02', '2026-01-09', '2026-12-31', '2024-02-29']
    expect([...keys].sort()).toEqual(['2024-02-29', '2026-01-09', '2026-03-02', '2026-12-31'])
    expect(compareDateKeys('2026-01-09', '2026-01-10')).toBe(-1)
    expect(compareDateKeys('2026-01-10', '2026-01-09')).toBe(1)
    expect(compareDateKeys('2026-01-10', '2026-01-10')).toBe(0)
    expect(isBeforeDateKey('2024-12-31', '2025-01-01')).toBe(true)
    expect(isAfterDateKey('2026-03-01', '2026-02-28')).toBe(true)
  })

  it('rejects: a non-fixed-width key fails validation', () => {
    expect(isDateKey('2026-1-09')).toBe(false)
    expect(() => compareDateKeys('2026-1-09', '2026-01-10')).toThrow(RangeError)
  })
})

describe('R4 calendar · day difference and month arithmetic', () => {
  it('accepts: daysBetween counts whole days, including leap years', () => {
    expect(daysBetween('2024-02-28', '2024-03-01')).toBe(2)
    expect(daysBetween('2025-02-28', '2025-03-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
    expect(daysBetween('2026-03-02', '2026-03-02')).toBe(0)
    expect(daysBetween('2026-03-02', '2026-03-01')).toBe(-1)
    expect(daysBetween('1986-11-25', '2026-11-25')).toBe(14610)
  })

  it('accepts: addDays crosses month, year and leap boundaries', () => {
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('accepts: addMonths clamps to the target month end', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28')
    expect(addMonths('2025-03-31', 1)).toBe('2025-04-30')
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28')
    expect(addMonths('2024-02-29', 12)).toBe('2025-02-28')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-11-25', -480)).toBe('1986-11-25')
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28')
  })

  it('accepts: leap-year and month-end helpers', () => {
    expect(isLeapYear(2024)).toBe(true)
    expect(isLeapYear(1900)).toBe(false)
    expect(isLeapYear(2000)).toBe(true)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(monthEndKey('2024-02-11')).toBe('2024-02-29')
    expect(monthEndKey('2026-04-01')).toBe('2026-04-30')
  })

  it('rejects: non-integer month/day arithmetic', () => {
    expect(() => addMonths('2026-01-31', 1.5)).toThrow(RangeError)
    expect(() => addDays('2026-01-31', 0.5)).toThrow(RangeError)
    expect(() => addMonths('2026-02-30', 1)).toThrow(RangeError)
  })
})

describe('R4 calendar · age and instants', () => {
  it('accepts: ageInYears is whole years and never negative', () => {
    expect(ageInYears('2020-05-01', '2026-04-30')).toBe(5)
    expect(ageInYears('2020-05-01', '2026-05-01')).toBe(6)
    expect(ageInYears('2026-06-01', '2026-05-01')).toBe(0)
  })

  it('accepts: latestDateKey ignores nulls', () => {
    expect(latestDateKey(['2026-01-01', null, '2026-03-02', undefined, '2024-12-31'])).toBe(
      '2026-03-02',
    )
    expect(latestDateKey([null, undefined])).toBeNull()
  })

  it('accepts: ISO instants normalise to UTC with milliseconds', () => {
    const date = new Date('2026-03-01T16:30:00Z')
    expect(date.toISOString()).toBe('2026-03-01T16:30:00.000Z')
    expect(isIsoInstant('2026-03-01T16:30:00.000Z')).toBe(true)
    expect(parseInstant('2026-03-01T16:30:00.000Z').toISOString()).toBe('2026-03-01T16:30:00.000Z')
  })

  it('rejects: an unreadable instant throws instead of becoming an invalid date', () => {
    expect(isIsoInstant('not a date')).toBe(false)
    expect(() => parseInstant('not a date')).toThrow(TypeError)
  })
})

describe('R4 calendar · defensive boundaries', () => {
  it('rejects: impossible month and year inputs', () => {
    expect(() => daysInMonth(2026, 0)).toThrow(RangeError)
    expect(() => daysInMonth(2026, 13)).toThrow(RangeError)
    expect(() => daysInMonth(2026, 2.5)).toThrow(RangeError)
    expect(() => dateKeyFromParts(-1, 1, 1)).toThrow(RangeError)
    expect(() => dateKeyFromParts(10000, 1, 1)).toThrow(RangeError)
    expect(() => dateKeyFromParts(2026, 13, 1)).toThrow(RangeError)
    expect(() => dateKeyFromParts(2026, 1, 0)).toThrow(RangeError)
    expect(() => assertDateKey(20260101)).toThrow(RangeError)
  })

  it('accepts: isoInstantFromDate normalises any instant to UTC with milliseconds', () => {
    expect(isoInstantFromDate(new Date('2026-03-01T16:30:00Z'))).toBe('2026-03-01T16:30:00.000Z')
    expect(isoInstantFromDate('2026-03-01T16:30:00.000Z')).toBe('2026-03-01T16:30:00.000Z')
  })

  it('accepts: isSameDateKey compares fixed-width keys', () => {
    expect(isSameDateKey('2026-03-02', '2026-03-02')).toBe(true)
    expect(isSameDateKey('2026-03-02', '2026-03-03')).toBe(false)
  })
})
