import { describe, expect, it } from 'vitest'

import {
  combineLocalDateTime,
  draftForNewEntry,
  draftFromEntry,
  draftToJournalDraft,
  hasMeaningfulDraft,
  splitLocalDateTime,
} from '@/lib/journal-editor'
import type { JournalEntry } from '@/lib/rules/types'

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  const occurredAt = new Date(2026, 2, 1, 23, 55, 0, 0).toISOString()
  return {
    id: 'entry-1',
    petId: 'pet-1',
    kind: 'walk',
    occurredAt,
    note: 'Evening loop',
    durationMinutes: 30,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    ...overrides,
  }
}

describe('journal draft (R4/R6)', () => {
  it('round-trips a 23:55 local instant without crossing the day', () => {
    const source = entry()
    const draft = draftFromEntry(source)
    expect(draft.date).toBe('2026-03-01')
    expect(draft.time).toBe('23:55')

    const result = draftToJournalDraft(draft)
    expect(result.errors).toEqual({})
    expect(result.value?.occurredAt).toBe(source.occurredAt)
    expect(splitLocalDateTime(source.occurredAt)).toEqual({ date: '2026-03-01', time: '23:55' })
  })

  it('creates a draft at the current local moment, defaulting to walk', () => {
    const now = new Date(2026, 10, 25, 7, 10, 0, 0)
    const draft = draftForNewEntry('pet-1', now)
    expect(draft).toMatchObject({ petId: 'pet-1', kind: 'walk', date: '2026-11-25', time: '07:10' })
    expect(hasMeaningfulDraft(draft)).toBe(false)
  })

  it('keeps kind and pet from the entry (they are not editable)', () => {
    const draft = draftFromEntry(entry({ kind: 'meds', petId: 'pet-9' }))
    expect(draft.kind).toBe('meds')
    expect(draft.petId).toBe('pet-9')
  })

  it('moves an edited time to the right local day', () => {
    const draft = draftFromEntry(entry())
    const result = draftToJournalDraft({ ...draft, date: '2026-02-28', time: '08:00' })
    expect(result.value).not.toBeNull()
    expect(splitLocalDateTime(result.value!.occurredAt)).toEqual({
      date: '2026-02-28',
      time: '08:00',
    })
  })

  it('rejects a blank pet, an impossible day and a malformed time', () => {
    const base = draftForNewEntry('pet-1')
    expect(draftToJournalDraft({ ...base, petId: '  ' }).errors.petId).toBeDefined()
    expect(draftToJournalDraft({ ...base, date: '2026-02-31' }).errors.date).toBeDefined()
    expect(draftToJournalDraft({ ...base, time: '24:00' }).errors.time).toBeDefined()
    expect(combineLocalDateTime('2026-02-31', '10:00')).toBeNull()
  })

  it('rejects zero, negative and fractional durations (R6)', () => {
    const base = draftForNewEntry('pet-1')
    for (const duration of ['0', '-5', '1.5', 'abc']) {
      const result = draftToJournalDraft({ ...base, duration })
      expect(result.value, `duration "${duration}"`).toBeNull()
      expect(result.errors.durationMinutes).toBeDefined()
    }
  })

  it('accepts a positive whole duration and a blank one as null', () => {
    const base = draftForNewEntry('pet-1')
    expect(draftToJournalDraft({ ...base, duration: '45' }).value?.durationMinutes).toBe(45)
    expect(draftToJournalDraft({ ...base, duration: '' }).value?.durationMinutes).toBeNull()
  })

  it('trims the note and turns blank into null', () => {
    const draft = { ...draftForNewEntry('pet-1'), note: '   ' }
    expect(draftToJournalDraft(draft).value?.note).toBeNull()
    const withNote = { ...draftForNewEntry('pet-1'), note: '  Slept well  ' }
    expect(draftToJournalDraft(withNote).value?.note).toBe('Slept well')
  })
})
