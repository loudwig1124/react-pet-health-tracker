import { describe, expect, it } from 'vitest'

import {
  JournalRuleException,
  applyJournalEdit,
  groupJournalEntriesByDay,
  journalDayKey,
  normalizeJournalNote,
  validateJournalDraft,
} from './journal'
import type { JournalEntry, JournalKind } from './types'

const localIso = (year: number, month: number, day: number, hour = 12, minute = 0): string =>
  new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()

const NOW = '2026-03-02T09:00:00.000Z'

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry-1',
    petId: 'pet-bella',
    kind: 'walk',
    occurredAt: localIso(2026, 3, 1, 23, 55),
    note: 'Night loop',
    durationMinutes: 30,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('R6 journal · draft validation', () => {
  it('accepts: a complete draft, trimming the note', () => {
    const result = validateJournalDraft({
      petId: 'pet-bella',
      kind: 'walk',
      occurredAt: localIso(2026, 3, 1, 7, 10),
      note: '  Morning loop  ',
      durationMinutes: 30,
    })
    expect(result.isValid).toBe(true)
    expect(result.value).toMatchObject({
      petId: 'pet-bella',
      kind: 'walk',
      note: 'Morning loop',
      durationMinutes: 30,
    })
  })

  it('accepts: duration is optional and the note may be blank', () => {
    const result = validateJournalDraft({
      petId: 'pet-bella',
      kind: 'fed',
      occurredAt: localIso(2026, 3, 1, 7, 0),
      note: '   ',
      durationMinutes: null,
    })
    expect(result.isValid).toBe(true)
    expect(result.value?.note).toBeNull()
    expect(result.value?.durationMinutes).toBeNull()
  })

  it('rejects: an invalid kind, missing pet or unreadable time', () => {
    expect(
      validateJournalDraft({
        petId: 'pet-bella',
        kind: 'nap' as unknown as JournalKind,
        occurredAt: localIso(2026, 3, 1),
        note: null,
        durationMinutes: null,
      }).errors.kind,
    ).toBeDefined()
    expect(
      validateJournalDraft({
        petId: '  ',
        kind: 'walk',
        occurredAt: localIso(2026, 3, 1),
        note: null,
        durationMinutes: null,
      }).errors.petId,
    ).toBeDefined()
    expect(
      validateJournalDraft({
        petId: 'pet-bella',
        kind: 'walk',
        occurredAt: 'yesterday-ish',
        note: null,
        durationMinutes: null,
      }).errors.occurredAt,
    ).toBeDefined()
  })

  it('rejects: duration must be a positive whole number', () => {
    for (const durationMinutes of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = validateJournalDraft({
        petId: 'pet-bella',
        kind: 'walk',
        occurredAt: localIso(2026, 3, 1),
        note: null,
        durationMinutes,
      })
      expect(result.isValid).toBe(false)
      expect(result.errors.durationMinutes).toBeDefined()
    }
  })

  it('accepts: blank notes normalise to null', () => {
    expect(normalizeJournalNote(null)).toBeNull()
    expect(normalizeJournalNote('')).toBeNull()
    expect(normalizeJournalNote('  ')).toBeNull()
    expect(normalizeJournalNote(' meds given ')).toBe('meds given')
  })
})

describe('R6 journal · editing an entry', () => {
  it('accepts: changing the time moves the entry to the right day section', () => {
    const existing = entry({ occurredAt: localIso(2026, 3, 1, 23, 55) })
    expect(journalDayKey(existing)).toBe('2026-03-01')

    const updated = applyJournalEdit(
      existing,
      {
        petId: existing.petId,
        kind: 'walk',
        occurredAt: localIso(2026, 3, 2, 0, 5),
        note: 'After midnight loop',
        durationMinutes: 20,
      },
      { now: NOW },
    )
    expect(journalDayKey(updated)).toBe('2026-03-02')
    expect(updated.occurredAt).toBe(localIso(2026, 3, 2, 0, 5))
    expect(updated.note).toBe('After midnight loop')
    expect(updated.durationMinutes).toBe(20)
    expect(updated.updatedAt).toBe(NOW)

    const groups = groupJournalEntriesByDay([existing], '2026-03-02')
    expect(groups[0]?.day).toBe('2026-03-01')
    expect(groups[0]?.label).toBe('yesterday')
    const afterEdit = groupJournalEntriesByDay([updated], '2026-03-02')
    expect(afterEdit[0]?.day).toBe('2026-03-02')
    expect(afterEdit[0]?.label).toBe('today')
  })

  it('accepts: kind, pet, id and createdAt are preserved by an edit', () => {
    const existing = entry()
    const updated = applyJournalEdit(
      existing,
      {
        petId: 'pet-other',
        kind: 'walk',
        occurredAt: localIso(2026, 3, 1, 20, 0),
        note: null,
        durationMinutes: null,
      },
      { now: NOW },
    )
    expect(updated.id).toBe(existing.id)
    expect(updated.petId).toBe(existing.petId)
    expect(updated.kind).toBe(existing.kind)
    expect(updated.createdAt).toBe(existing.createdAt)
  })

  it('rejects: the kind is immutable after logging', () => {
    expect(() =>
      applyJournalEdit(
        entry({ kind: 'walk' }),
        {
          petId: 'pet-bella',
          kind: 'fed',
          occurredAt: localIso(2026, 3, 1, 20, 0),
          note: null,
          durationMinutes: null,
        },
        { now: NOW },
      ),
    ).toThrow(JournalRuleException)

    try {
      applyJournalEdit(
        entry({ kind: 'walk' }),
        {
          petId: 'pet-bella',
          kind: 'fed',
          occurredAt: localIso(2026, 3, 1, 20, 0),
          note: null,
          durationMinutes: null,
        },
        { now: NOW },
      )
      expect.unreachable('the kind change should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(JournalRuleException)
      expect((error as JournalRuleException).field).toBe('kind')
    }
  })

  it('rejects: an edit that would persist an invalid duration or time', () => {
    expect(() =>
      applyJournalEdit(
        entry(),
        {
          petId: 'pet-bella',
          kind: 'walk',
          occurredAt: localIso(2026, 3, 1, 20, 0),
          note: null,
          durationMinutes: 0,
        },
        { now: NOW },
      ),
    ).toThrow(JournalRuleException)
    expect(() =>
      applyJournalEdit(
        entry(),
        {
          petId: 'pet-bella',
          kind: 'walk',
          occurredAt: 'not-a-time',
          note: null,
          durationMinutes: 10,
        },
        { now: NOW },
      ),
    ).toThrow(JournalRuleException)
  })
})

describe('R6/R4 journal · day grouping', () => {
  it('accepts: newest day and newest entry first, with deterministic ties', () => {
    const entries: JournalEntry[] = [
      entry({ id: 'a', occurredAt: localIso(2026, 2, 27, 8, 0) }),
      entry({ id: 'b', occurredAt: localIso(2026, 3, 2, 7, 0) }),
      entry({ id: 'c', occurredAt: localIso(2026, 3, 1, 22, 0) }),
      entry({ id: 'd', occurredAt: localIso(2026, 3, 2, 7, 0) }),
    ]
    const groups = groupJournalEntriesByDay(entries, '2026-03-02')
    expect(groups.map((group) => group.day)).toEqual(['2026-03-02', '2026-03-01', '2026-02-27'])
    expect(groups[0]?.label).toBe('today')
    expect(groups[1]?.label).toBe('yesterday')
    expect(groups[2]?.label).toBe('date')
    expect(groups[0]?.entries.map((row) => row.id)).toEqual(['d', 'b'])
  })

  it('accepts: an entry logged 23:55 local on 1 Mar groups under 1 Mar, not Today', () => {
    const groups = groupJournalEntriesByDay([entry()], '2026-03-02')
    expect(groups).toHaveLength(1)
    expect(groups[0]?.day).toBe('2026-03-01')
    expect(groups[0]?.label).toBe('yesterday')
    expect(groups.some((group) => group.label === 'today')).toBe(false)
  })

  it('rejects: an unreadable occurredAt throws instead of grouping under a wrong day', () => {
    expect(() =>
      groupJournalEntriesByDay([entry({ occurredAt: 'not-a-time' })], '2026-03-02'),
    ).toThrow(TypeError)
    expect(() => journalDayKey(entry({ occurredAt: 'not-a-time' }))).toThrow(TypeError)
  })

  it('accepts: an empty journal has no groups', () => {
    expect(groupJournalEntriesByDay([], '2026-03-02')).toEqual([])
  })
})
