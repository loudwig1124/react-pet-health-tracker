/**
 * Journal feed filters and their URL contract (03 §2–§3, F6).
 *
 * The per-pet filter is the URL-addressable part the milestone requires: a
 * reload or a bookmark comes back to the same pet's entries. Kind and the free
 * text search ride in the URL too, so the whole filtered view survives a
 * reload without extra state.
 *
 * `?pet=all` is accepted as the explicit "every pet" value (R10's hand-off
 * sentinel) while an absent `pet` means the same thing; writing always removes
 * the parameter for "all" so a filter is never ambiguous.
 */
import { JOURNAL_KINDS } from '@/lib/rules/constants'
import type { JournalEntry, JournalKind } from '@/lib/rules/types'

export interface JournalFilters {
  /** `null` = every pet. */
  petId: string | null
  /** `null` = every kind. */
  kind: JournalKind | null
  search: string
}

export const EMPTY_JOURNAL_FILTERS: JournalFilters = Object.freeze({
  petId: null,
  kind: null,
  search: '',
})

function isJournalKind(value: string): value is JournalKind {
  return (JOURNAL_KINDS as readonly string[]).includes(value)
}

export function parseJournalFilters(params: URLSearchParams): JournalFilters {
  const pet = params.get('pet')
  const kind = params.get('kind')
  return {
    petId: pet === null || pet === '' || pet === 'all' ? null : pet,
    kind: kind !== null && isJournalKind(kind) ? kind : null,
    search: params.get('q') ?? '',
  }
}

/** Writes the filter back, preserving any params this screen does not own. */
export function writeJournalFilters(
  filters: JournalFilters,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(base)
  next.delete('pet')
  next.delete('kind')
  next.delete('q')
  if (filters.petId !== null) {
    next.set('pet', filters.petId)
  }
  if (filters.kind !== null) {
    next.set('kind', filters.kind)
  }
  if (filters.search.trim() !== '') {
    next.set('q', filters.search.trim())
  }
  return next
}

/** Applies the whole filter set to already-newest-first entries. */
export function filterJournalEntries(
  entries: readonly JournalEntry[],
  filters: JournalFilters,
): JournalEntry[] {
  const query = filters.search.trim().toLowerCase()
  return entries.filter((entry) => {
    if (filters.petId !== null && entry.petId !== filters.petId) {
      return false
    }
    if (filters.kind !== null && entry.kind !== filters.kind) {
      return false
    }
    if (query !== '') {
      const haystack = `${entry.note ?? ''} ${entry.kind}`.toLowerCase()
      if (!haystack.includes(query)) {
        return false
      }
    }
    return true
  })
}

export function hasActiveFilters(filters: JournalFilters): boolean {
  return filters.petId !== null || filters.kind !== null || filters.search.trim() !== ''
}
