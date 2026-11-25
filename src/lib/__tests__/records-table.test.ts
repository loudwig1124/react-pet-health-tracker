import { describe, expect, it } from 'vitest'

import {
  DEFAULT_RECORDS_TABLE_QUERY,
  buildRecordRows,
  compareRecordRows,
  filterRecordRows,
  hasRecordFilters,
  normalizeRecordsTableQuery,
  parseRecordsTableQuery,
  serializeRecordsTableQuery,
  sortRecordRows,
} from '@/lib/records-table'
import type { HealthRecord, Pet } from '@/lib/rules/types'

function pet(overrides: Partial<Pet> & Pick<Pet, 'id' | 'name'>): Pet {
  const base: Pet = {
    id: overrides.id,
    ownerId: 'owner',
    name: overrides.name,
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2023-03-12',
    weightKg: 12.4,
    microchip: null,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
  }
  return { ...base, ...overrides }
}

function record(
  overrides: Partial<HealthRecord> & Pick<HealthRecord, 'id' | 'petId' | 'recordedOn'>,
): HealthRecord {
  const base: HealthRecord = {
    id: overrides.id,
    petId: overrides.petId,
    recordedOn: overrides.recordedOn,
    condition: 'Ear infection',
    diagnosis: 'Otitis externa',
    treatment: 'Antibiotic drops',
    prescribedMedication: 'Ofloxacin',
    vetName: 'Dr. Ana Cruz',
    createdAt: '2026-10-01T09:00:00.000Z',
  }
  return { ...base, ...overrides }
}

const BELLA = pet({ id: 'bella', name: 'Bella' })
const MISO = pet({ id: 'miso', name: 'Miso', species: 'Cat' })

describe('/records read model (R5)', () => {
  it('joins each note to its pet and uses condition-then-diagnosis as the title', () => {
    const rows = buildRecordRows(
      [BELLA, MISO],
      [
        record({ id: 'r1', petId: 'bella', recordedOn: '2026-10-20' }),
        record({
          id: 'r2',
          petId: 'miso',
          recordedOn: '2026-09-01',
          condition: null,
          diagnosis: 'Healthy annual exam',
        }),
      ],
    )
    expect(rows[0]?.petName).toBe('Bella')
    expect(rows[0]?.title).toBe('Ear infection')
    expect(rows[1]?.title).toBe('Healthy annual exam')
    expect(rows[1]?.petSpecies).toBe('Cat')
  })

  it('labels a note whose pet row is missing rather than crashing', () => {
    const rows = buildRecordRows(
      [],
      [record({ id: 'r1', petId: 'gone', recordedOn: '2026-10-20' })],
    )
    expect(rows[0]?.petName).toBe('Unknown pet')
  })

  it('builds a searchable haystack from every clinical field and the pet name', () => {
    const rows = buildRecordRows(
      [BELLA],
      [
        record({
          id: 'r1',
          petId: 'bella',
          recordedOn: '2026-10-20',
          treatment: 'Ear cleaning',
          prescribedMedication: 'Ofloxacin otic',
          vetName: 'Dr. Cruz',
        }),
      ],
    )
    const row = rows[0]
    expect(row?.searchText).toContain('ear infection')
    expect(row?.searchText).toContain('ofloxacin otic')
    expect(row?.searchText).toContain('dr. cruz')
    expect(row?.searchText).toContain('bella')
  })
})

describe('/records URL state (F6)', () => {
  it('defaults to newest first with no filters', () => {
    expect(parseRecordsTableQuery(new URLSearchParams(''))).toEqual(DEFAULT_RECORDS_TABLE_QUERY)
    expect(serializeRecordsTableQuery(DEFAULT_RECORDS_TABLE_QUERY).toString()).toBe('')
  })

  it('parses ?pet=all as the explicit "every pet" sentinel', () => {
    const query = parseRecordsTableQuery(new URLSearchParams('pet=all'))
    expect(query.pet).toBe('all')
    // The sentinel is the default, so it never appears in a serialised URL.
    expect(serializeRecordsTableQuery(query).get('pet')).toBeNull()
  })

  it('parses a pet filter, search and sort', () => {
    expect(
      parseRecordsTableQuery(new URLSearchParams('q=ear&pet=bella&sort=title&dir=desc')),
    ).toEqual({ q: 'ear', pet: 'bella', sort: 'title', dir: 'desc' })
  })

  it('falls back on invalid values', () => {
    expect(
      parseRecordsTableQuery(new URLSearchParams('sort=bogus&dir=sideways&pet=&q=%20')),
    ).toEqual(DEFAULT_RECORDS_TABLE_QUERY)
    // The first click on Pet/Note ascends; Date stays newest-first.
    expect(parseRecordsTableQuery(new URLSearchParams('sort=pet')).dir).toBe('asc')
    expect(parseRecordsTableQuery(new URLSearchParams('sort=date')).dir).toBe('desc')
  })

  it('round-trips through a URL', () => {
    const query = normalizeRecordsTableQuery({
      q: '  ear  ',
      pet: 'bella',
      sort: 'pet',
      dir: 'desc',
    })
    expect(parseRecordsTableQuery(serializeRecordsTableQuery(query))).toEqual(query)

    // Date ascending names both parameters (date is the default column).
    const dateAsc = serializeRecordsTableQuery({ sort: 'date', dir: 'asc' })
    expect(dateAsc.get('sort')).toBe('date')
    expect(dateAsc.get('dir')).toBe('asc')
  })
})

describe('/records filters and comparators (F5)', () => {
  const rows = buildRecordRows(
    [BELLA, MISO],
    [
      record({ id: 'a', petId: 'bella', recordedOn: '2026-10-01' }),
      record({
        id: 'b',
        petId: 'miso',
        recordedOn: '2026-11-01',
        condition: 'Healthy annual exam',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: 'Dr. Reyes',
        createdAt: '2026-11-01T09:00:00.000Z',
      }),
      record({
        id: 'c',
        petId: 'bella',
        recordedOn: '2026-11-01',
        condition: 'Sneezing',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
        createdAt: '2026-11-02T09:00:00.000Z',
      }),
    ],
  )

  it('searches the note, its fields, the vet and the pet name', () => {
    expect(filterRecordRows(rows, { q: 'ofloxacin', pet: 'all' })).toHaveLength(1)
    expect(filterRecordRows(rows, { q: 'reyes', pet: 'all' })).toHaveLength(1)
    expect(filterRecordRows(rows, { q: 'MISO', pet: 'all' })).toHaveLength(1)
    expect(filterRecordRows(rows, { q: 'ear infection', pet: 'all' })).toHaveLength(1)
  })

  it('filters by pet and reports whether a filter is active', () => {
    expect(filterRecordRows(rows, { q: '', pet: 'bella' })).toHaveLength(2)
    expect(hasRecordFilters({ q: '', pet: 'all' })).toBe(false)
    expect(hasRecordFilters({ q: ' ', pet: 'all' })).toBe(false)
    expect(hasRecordFilters({ q: '', pet: 'bella' })).toBe(true)
    expect(hasRecordFilters({ q: 'sneez', pet: 'all' })).toBe(true)
  })

  it('sorts by date with createdAt then id as deterministic tie-breaks', () => {
    // Same recordedOn: the later createdAt wins the newest-first ordering.
    expect(sortRecordRows(rows, 'date').map((row) => row.id)).toEqual(['c', 'b', 'a'])
    expect(sortRecordRows(rows, 'date', 'asc').map((row) => row.id)).toEqual(['a', 'b', 'c'])
  })

  it('sorts by pet name and by note title', () => {
    expect(sortRecordRows(rows, 'pet').map((row) => row.id)).toEqual(['a', 'c', 'b'])
    expect(sortRecordRows(rows, 'title').map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(compareRecordRows(rows[0]!, rows[1]!, 'title')).toBeLessThan(0)
  })
})
