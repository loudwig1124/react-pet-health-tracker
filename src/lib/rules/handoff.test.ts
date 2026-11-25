import { describe, expect, it } from 'vitest'

import {
  PET_FILTER_ALL,
  normalizePetFilterHandoff,
  petFilterFromSearchValue,
  petFilterSearchValue,
} from './handoff'

describe('R10 hand-off · no request vs. no filter', () => {
  it('accepts: { petId: null } becomes ?pet=all (explicitly unfiltered)', () => {
    expect(PET_FILTER_ALL).toBe('all')
    expect(petFilterSearchValue(null)).toBe('all')
    expect(normalizePetFilterHandoff({ petId: null })).toEqual({ petId: null })
  })

  it('accepts: no request stays absent so the current filter is untouched', () => {
    expect(petFilterSearchValue(undefined)).toBeUndefined()
    expect(petFilterFromSearchValue(undefined)).toBeUndefined()
    expect(petFilterFromSearchValue(null)).toBeUndefined()
    expect(petFilterFromSearchValue('')).toBeUndefined()
    expect(petFilterFromSearchValue('   ')).toBeUndefined()
  })

  it('accepts: a concrete pet id round-trips, including a demo id', () => {
    for (const petId of ['demo-pet-bella', '6f1c2f3e-0000-4000-8000-000000000001']) {
      expect(petFilterSearchValue(petId)).toBe(petId)
      expect(petFilterFromSearchValue(petFilterSearchValue(petId))).toBe(petId)
      expect(normalizePetFilterHandoff({ petId })).toEqual({ petId })
    }
  })

  it('accepts: ?pet=all parses to null, not to the literal id "all"', () => {
    expect(petFilterFromSearchValue('all')).toBeNull()
    expect(petFilterFromSearchValue(' all ')).toBeNull()
  })

  it('rejects: an empty or reserved id is not a filter', () => {
    expect(petFilterSearchValue('')).toBeUndefined()
    expect(petFilterSearchValue('   ')).toBeUndefined()
    // "all" is the sentinel, so a pet id equal to it cannot be represented —
    // user ids are UUIDs and demo ids are demo-*, so this cannot collide.
    expect(petFilterSearchValue('all')).toBeUndefined()
  })
})
