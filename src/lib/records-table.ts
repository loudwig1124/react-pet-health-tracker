/**
 * `/records` read model, F5 comparators and F6 URL state (05 F5/F6, 06 M2).
 *
 * Health records are correctable (R5, amended 2026-11-27): this module reads and sorts, and the
 * page renders no edit/delete affordance. `/records` is a plain sorted table —
 * deliberately no TanStack — so a household note list never pays the table
 * library's bytes (04 §2.2).
 */

import { healthRecordTitle } from '@/lib/rules/health-records'
import type { DateKey, HealthRecord, Pet } from '@/lib/rules/types'
import {
  FILTER_ALL,
  compareText,
  parseFilterValue,
  parseSortDirection,
  serializeFilterValue,
  type SortDirection,
} from '@/lib/table-state'

export { FILTER_ALL, type SortDirection }

export const RECORD_SORT_KEYS = ['date', 'pet', 'title'] as const

export type RecordSortKey = (typeof RECORD_SORT_KEYS)[number]

export const RECORD_SORT_LABELS: Record<RecordSortKey, string> = {
  date: 'Date',
  pet: 'Pet',
  title: 'Note',
}

export interface RecordsTableQuery {
  /** Free text over the note, its fields and the pet's name. */
  q: string
  /** One pet id, or `all` (the F6/R10 sentinel). */
  pet: string
  sort: RecordSortKey
  dir: SortDirection
}

export const DEFAULT_RECORDS_TABLE_QUERY: RecordsTableQuery = {
  q: '',
  pet: FILTER_ALL,
  sort: 'date',
  dir: 'desc',
}

/** Newest first is the useful first click for a clinical history. */
export function defaultDirectionForRecordSort(sort: RecordSortKey): SortDirection {
  return sort === 'date' ? 'desc' : 'asc'
}

function isRecordSortKey(value: unknown): value is RecordSortKey {
  return typeof value === 'string' && (RECORD_SORT_KEYS as readonly string[]).includes(value)
}

export function normalizeRecordsTableQuery(query: Partial<RecordsTableQuery>): RecordsTableQuery {
  const sort = isRecordSortKey(query.sort) ? query.sort : DEFAULT_RECORDS_TABLE_QUERY.sort
  return {
    q: (query.q ?? '').trim(),
    pet: parseFilterValue(query.pet),
    sort,
    dir: parseSortDirection(query.dir, defaultDirectionForRecordSort(sort)),
  }
}

/** F6: `?q=&pet=&sort=&dir=` → a validated records query. */
export function parseRecordsTableQuery(params: URLSearchParams): RecordsTableQuery {
  return normalizeRecordsTableQuery({
    q: params.get('q') ?? '',
    pet: params.get('pet') ?? FILTER_ALL,
    sort: (params.get('sort') ?? DEFAULT_RECORDS_TABLE_QUERY.sort) as RecordSortKey,
    dir: (params.get('dir') ?? undefined) as SortDirection | undefined,
  })
}

/** F6: a records query → search params, omitting every default. */
export function serializeRecordsTableQuery(query: Partial<RecordsTableQuery>): URLSearchParams {
  const normalized = normalizeRecordsTableQuery(query)
  const params = new URLSearchParams()
  if (normalized.q !== '') {
    params.set('q', normalized.q)
  }
  const pet = serializeFilterValue(normalized.pet)
  if (pet !== null) {
    params.set('pet', pet)
  }
  const defaultDirection = defaultDirectionForRecordSort(normalized.sort)
  if (normalized.sort !== DEFAULT_RECORDS_TABLE_QUERY.sort || normalized.dir !== defaultDirection) {
    params.set('sort', normalized.sort)
  }
  if (normalized.dir !== defaultDirection) {
    params.set('dir', normalized.dir)
  }
  return params
}

/* --------------------------------------------------------------- read model */

export interface RecordRow {
  id: string
  record: HealthRecord
  petId: string
  petName: string
  petSpecies: string
  date: DateKey
  title: string
  /** Every free-text field, lower-cased, for the search filter. */
  searchText: string
}

/** Joins notes (already newest-first per pet) to their pet for display. */
export function buildRecordRows(
  pets: readonly Pet[],
  records: readonly HealthRecord[],
): RecordRow[] {
  const byId = new Map(pets.map((pet) => [pet.id, pet]))
  return records.map((record) => {
    const pet = byId.get(record.petId)
    const petName = pet?.name ?? 'Unknown pet'
    return {
      id: record.id,
      record,
      petId: record.petId,
      petName,
      petSpecies: pet?.species ?? '',
      date: record.recordedOn,
      title: healthRecordTitle(record),
      searchText: [
        healthRecordTitle(record),
        record.condition ?? '',
        record.diagnosis ?? '',
        record.treatment ?? '',
        record.prescribedMedication ?? '',
        record.vetName ?? '',
        petName,
      ]
        .join(' ')
        .toLowerCase(),
    }
  })
}

/* ------------------------------------------------------------------ filters */

export function filterRecordRows(
  rows: readonly RecordRow[],
  query: Pick<RecordsTableQuery, 'q' | 'pet'>,
): RecordRow[] {
  const needle = query.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (needle !== '' && !row.searchText.includes(needle)) {
      return false
    }
    if (query.pet !== FILTER_ALL && row.petId !== query.pet) {
      return false
    }
    return true
  })
}

export function hasRecordFilters(query: Pick<RecordsTableQuery, 'q' | 'pet'>): boolean {
  return query.q.trim() !== '' || query.pet !== FILTER_ALL
}

/* --------------------------------------------------------------- comparators */

function compareRecordDate(a: RecordRow, b: RecordRow): number {
  if (a.date !== b.date) {
    return a.date < b.date ? -1 : 1
  }
  if (a.record.createdAt !== b.record.createdAt) {
    return a.record.createdAt < b.record.createdAt ? -1 : 1
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/**
 * The F5 ascending comparator for one column. The page applies the direction
 * multiplier, mirroring how TanStack treats `/pets` (kept symmetrical on
 * purpose so both tables read the same way).
 */
export function compareRecordRows(a: RecordRow, b: RecordRow, sort: RecordSortKey): number {
  switch (sort) {
    case 'pet': {
      const byPet = compareText(a.petName, b.petName)
      return byPet !== 0 ? byPet : compareRecordDate(a, b)
    }
    case 'title': {
      const byTitle = compareText(a.title, b.title)
      return byTitle !== 0 ? byTitle : compareRecordDate(a, b)
    }
    default:
      return compareRecordDate(a, b)
  }
}

/** The whole sort applied — shared by the table and its tests. */
export function sortRecordRows(
  rows: readonly RecordRow[],
  sort: RecordSortKey,
  dir: SortDirection = defaultDirectionForRecordSort(sort),
): RecordRow[] {
  return [...rows].sort((a, b) => {
    const result = compareRecordRows(a, b, sort)
    return dir === 'desc' ? -result : result
  })
}
