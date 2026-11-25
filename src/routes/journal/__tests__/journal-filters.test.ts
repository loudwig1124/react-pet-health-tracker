import { describe, expect, it } from 'vitest'

import type { JournalEntry } from '@/lib/rules/types'
import {
  filterJournalEntries,
  hasActiveFilters,
  parseJournalFilters,
  writeJournalFilters,
} from '@/routes/journal/journal-filters'

const at = new Date(2026, 10, 26, 7, 10, 0, 0).toISOString()

function entry(overrides: Partial<JournalEntry> = {}): JournalEntry {
  return {
    id: 'entry',
    petId: 'pet-bella',
    kind: 'walk',
    occurredAt: at,
    note: 'Morning loop',
    durationMinutes: 30,
    createdAt: at,
    updatedAt: at,
    ...overrides,
  }
}

const entries: JournalEntry[] = [
  entry({ id: 'a' }),
  entry({ id: 'b', petId: 'pet-miso', kind: 'fed', note: 'Salmon pâté' }),
  entry({ id: 'c', petId: 'pet-miso', kind: 'note', note: null }),
]

describe('journal filters and URL state (F6)', () => {
  it('parses an absent filter as every pet and kind', () => {
    expect(parseJournalFilters(new URLSearchParams())).toEqual({
      petId: null,
      kind: null,
      search: '',
    })
  })

  it('treats ?pet=all as unfiltered and ignores unknown kinds', () => {
    const filters = parseJournalFilters(new URLSearchParams('pet=all&kind=teleport&q=loop'))
    expect(filters).toEqual({ petId: null, kind: null, search: 'loop' })
  })

  it('writes a filter and round-trips it through the URL', () => {
    const params = writeJournalFilters({
      petId: 'pet-miso',
      kind: 'fed',
      search: ' salmon ',
    })
    expect(params.get('pet')).toBe('pet-miso')
    expect(params.get('kind')).toBe('fed')
    expect(params.get('q')).toBe('salmon')

    expect(parseJournalFilters(params)).toEqual({
      petId: 'pet-miso',
      kind: 'fed',
      search: 'salmon',
    })
  })

  it('removes the parameters for "all" and preserves unrelated params', () => {
    const base = new URLSearchParams('view=feed&pet=pet-miso&kind=fed&q=x')
    const next = writeJournalFilters({ petId: null, kind: null, search: '' }, base)
    expect(next.get('view')).toBe('feed')
    expect(next.get('pet')).toBeNull()
    expect(next.get('kind')).toBeNull()
    expect(next.get('q')).toBeNull()
  })

  it('filters by pet, kind and note text while keeping newest-first order', () => {
    expect(
      filterJournalEntries(entries, { petId: 'pet-miso', kind: null, search: '' }),
    ).toHaveLength(2)
    expect(
      filterJournalEntries(entries, { petId: 'pet-miso', kind: 'fed', search: '' }).map(
        (item) => item.id,
      ),
    ).toEqual(['b'])
    expect(
      filterJournalEntries(entries, { petId: null, kind: null, search: 'SALMON' }).map(
        (item) => item.id,
      ),
    ).toEqual(['b'])
    expect(filterJournalEntries(entries, { petId: null, kind: null, search: 'loop' })).toHaveLength(
      1,
    )
  })

  it('reports whether anything is filtered', () => {
    expect(hasActiveFilters({ petId: null, kind: null, search: '   ' })).toBe(false)
    expect(hasActiveFilters({ petId: 'pet-bella', kind: null, search: '' })).toBe(true)
    expect(hasActiveFilters({ petId: null, kind: 'walk', search: '' })).toBe(true)
    expect(hasActiveFilters({ petId: null, kind: null, search: 'loop' })).toBe(true)
  })
})
