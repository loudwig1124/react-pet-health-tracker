import { describe, expect, it } from 'vitest'

import {
  DEFAULT_PET_TABLE_QUERY,
  buildPetTableRows,
  comparePetRows,
  dueDatePhrase,
  filterPetRows,
  hasPetFilters,
  normalizePetTableQuery,
  parsePetTableQuery,
  serializePetTableQuery,
  sortPetRows,
  speciesFilterOptions,
  type PetTableRow,
} from '@/lib/pets-table'
import type { Pet, Vaccination } from '@/lib/rules/types'

const TODAY = '2026-11-25'

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

function dose(
  overrides: Partial<Vaccination> & Pick<Vaccination, 'id' | 'petId' | 'vaccineName'>,
): Vaccination {
  const base: Vaccination = {
    id: overrides.id,
    petId: overrides.petId,
    vaccineTypeId: 'vaccine-rabies',
    vaccineName: overrides.vaccineName,
    vaccinationDate: '2025-10-21',
    nextDueDate: '2026-10-21',
    vetName: 'Dr. Ana Cruz',
    createdAt: '2025-10-21T09:00:00.000Z',
  }
  return { ...base, ...overrides }
}

function rowsFor(pets: Pet[], dosesByPet: Map<string, Vaccination[]>): PetTableRow[] {
  return buildPetTableRows(pets, dosesByPet, {
    today: TODAY,
    windowDays: 30,
    weightUnit: 'kg',
  })
}

describe('/pets read model (F5, R1)', () => {
  it('shows the worst due status and names the headline dose', () => {
    const bella = pet({ id: 'bella', name: 'Bella', breed: 'Golden Retriever mix' })
    const rows = rowsFor(
      [bella],
      new Map([['bella', [dose({ id: 'v1', petId: 'bella', vaccineName: 'Rabies' })]]]),
    )
    const row = rows[0]
    expect(row?.dueStatus).toBe('overdue')
    expect(row?.dueLabel).toBe('Overdue')
    expect(row?.dueDetail).toBe('Rabies · 35 days overdue')
    expect(row?.ageLabel).toBe('3 yrs')
    expect(row?.speciesLine).toBe('Dog · Golden Retriever mix')
    expect(row?.weightLabel).toBe('12.4 kg')
  })

  it('lets a booster clear the overdue status (newest dose wins, not every row)', () => {
    const miso = pet({ id: 'miso', name: 'Miso', species: 'Cat', weightKg: 4.2 })
    const rows = rowsFor(
      [miso],
      new Map([
        [
          'miso',
          [
            dose({
              id: 'old',
              petId: 'miso',
              vaccineName: 'Rabies',
              nextDueDate: '2026-01-09',
              createdAt: '2025-01-09T09:00:00.000Z',
            }),
            dose({
              id: 'new',
              petId: 'miso',
              vaccineName: 'Rabies',
              vaccinationDate: '2026-03-01',
              nextDueDate: '2027-03-01',
              createdAt: '2026-03-01T09:00:00.000Z',
            }),
          ],
        ],
      ]),
    )
    expect(rows[0]?.dueStatus).toBe('up_to_date')
    expect(rows[0]?.dueDetail).toBe('Rabies · due in 96 days')
  })

  it('reads up to date when no dose tracks a due date', () => {
    const coco = pet({ id: 'coco', name: 'Coco' })
    const rows = rowsFor([coco], new Map())
    expect(rows[0]?.dueStatus).toBe('up_to_date')
    expect(rows[0]?.dueDetail).toBe('No tracked boosters')
  })

  it('renders weight in the display unit through R2 (lb, one decimal)', () => {
    const rows = buildPetTableRows([pet({ id: 'bella', name: 'Bella' })], new Map(), {
      today: TODAY,
      windowDays: 30,
      weightUnit: 'lb',
    })
    expect(rows[0]?.weightLabel).toBe('27.3 lb')
  })

  it('describes the local-day distance to a due date', () => {
    expect(dueDatePhrase('2026-10-21', TODAY)).toBe('35 days overdue')
    expect(dueDatePhrase('2026-11-24', TODAY)).toBe('1 day overdue')
    expect(dueDatePhrase(TODAY, TODAY)).toBe('due today')
    expect(dueDatePhrase('2026-11-26', TODAY)).toBe('due in 1 day')
    expect(dueDatePhrase(null, TODAY)).toBeNull()
  })
})

describe('/pets URL state (F6)', () => {
  it('defaults to name ascending with no filters', () => {
    expect(parsePetTableQuery(new URLSearchParams(''))).toEqual(DEFAULT_PET_TABLE_QUERY)
    expect(serializePetTableQuery(DEFAULT_PET_TABLE_QUERY).toString()).toBe('')
  })

  it('parses every documented parameter', () => {
    const query = parsePetTableQuery(
      new URLSearchParams('q=bella&species=Cat&due=overdue&pet=pet-1&sort=weight&dir=desc'),
    )
    expect(query).toEqual({
      q: 'bella',
      species: 'Cat',
      due: 'overdue',
      pet: 'pet-1',
      sort: 'weight',
      dir: 'desc',
    })
  })

  it('falls back on invalid values and keeps the sort/direction pair coherent', () => {
    expect(
      parsePetTableQuery(new URLSearchParams('sort=girth&dir=sideways&due=bogus&species=')),
    ).toEqual(DEFAULT_PET_TABLE_QUERY)

    // A first click on Due is worst-first.
    expect(parsePetTableQuery(new URLSearchParams('sort=due')).dir).toBe('desc')
    expect(parsePetTableQuery(new URLSearchParams('sort=age')).dir).toBe('asc')
  })

  it('round-trips through a URL, omitting defaults', () => {
    const query = normalizePetTableQuery({
      q: '  miso  ',
      species: 'Cat',
      due: 'due_soon',
      pet: 'pet-2',
      sort: 'due',
      dir: 'asc',
    })
    const params = serializePetTableQuery(query)
    expect(params.get('q')).toBe('miso')
    expect(params.get('species')).toBe('Cat')
    expect(params.get('due')).toBe('due_soon')
    expect(params.get('pet')).toBe('pet-2')
    expect(params.get('sort')).toBe('due')
    expect(params.get('dir')).toBe('asc')
    expect(parsePetTableQuery(params)).toEqual(query)

    expect(parsePetTableQuery(serializePetTableQuery({ sort: 'due' })).dir).toBe('desc')
    expect(serializePetTableQuery({ sort: 'due', dir: 'desc' }).get('dir')).toBeNull()

    // A non-default direction on the default column names both parameters.
    const nameDesc = serializePetTableQuery({ sort: 'name', dir: 'desc' })
    expect(nameDesc.get('sort')).toBe('name')
    expect(nameDesc.get('dir')).toBe('desc')
    expect(parsePetTableQuery(nameDesc)).toMatchObject({ sort: 'name', dir: 'desc' })
  })
})

describe('/pets filters (F5)', () => {
  const rows = rowsFor(
    [
      pet({ id: 'bella', name: 'Bella', breed: 'Golden Retriever mix' }),
      pet({ id: 'miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }),
      pet({ id: 'coco', name: 'Coco', species: 'Dog', weightKg: 8.1 }),
    ],
    new Map([
      ['bella', [dose({ id: 'v1', petId: 'bella', vaccineName: 'Rabies' })]],
      [
        'miso',
        [
          dose({
            id: 'v2',
            petId: 'miso',
            vaccineName: 'FeLV',
            nextDueDate: '2026-12-05',
          }),
        ],
      ],
    ]),
  )

  it('searches name, species and breed case-insensitively', () => {
    expect(
      filterPetRows(rows, { q: 'bella', species: 'all', due: 'all', pet: 'all' }),
    ).toHaveLength(1)
    expect(filterPetRows(rows, { q: 'CAT', species: 'all', due: 'all', pet: 'all' })).toHaveLength(
      1,
    )
    expect(
      filterPetRows(rows, { q: 'retriever', species: 'all', due: 'all', pet: 'all' }),
    ).toHaveLength(1)
  })

  it('filters by species, due status, and the explicit pet id', () => {
    expect(
      filterPetRows(rows, { q: '', species: 'Dog', due: 'all', pet: 'all' }).map((row) => row.id),
    ).toEqual(['bella', 'coco'])
    expect(
      filterPetRows(rows, { q: '', species: 'all', due: 'due_soon', pet: 'all' }).map(
        (row) => row.id,
      ),
    ).toEqual(['miso'])
    expect(
      filterPetRows(rows, { q: '', species: 'all', due: 'all', pet: 'coco' }).map((row) => row.id),
    ).toEqual(['coco'])
    expect(
      filterPetRows(rows, { q: 'dog', species: 'Dog', due: 'overdue', pet: 'bella' }),
    ).toHaveLength(1)
  })

  it('reports whether any filter is narrowing the list', () => {
    expect(hasPetFilters({ q: '', species: 'all', due: 'all', pet: 'all' })).toBe(false)
    expect(hasPetFilters({ q: ' ', species: 'all', due: 'all', pet: 'all' })).toBe(false)
    expect(hasPetFilters({ q: '', species: 'Cat', due: 'all', pet: 'all' })).toBe(true)
    expect(hasPetFilters({ q: '', species: 'all', due: 'overdue', pet: 'all' })).toBe(true)
    expect(hasPetFilters({ q: '', species: 'all', due: 'all', pet: 'bella' })).toBe(true)
    expect(hasPetFilters({ q: 'mi', species: 'all', due: 'all', pet: 'all' })).toBe(true)
  })
})

describe('/pets sort comparators (F5)', () => {
  function row(overrides: Partial<PetTableRow> & Pick<PetTableRow, 'id' | 'name'>): PetTableRow {
    return {
      pet: pet({ id: overrides.id, name: overrides.name }),
      species: 'Dog',
      breed: null,
      speciesLine: 'Dog',
      ageYears: 3,
      ageLabel: '3 yrs',
      weightKg: 10,
      weightLabel: '10.0 kg',
      dueStatus: 'up_to_date',
      dueRank: 0,
      dueLabel: 'Up to date',
      dueDetail: 'No tracked boosters',
      headlineVaccineName: null,
      dueDate: null,
      searchText: overrides.name.toLowerCase(),
      ...overrides,
    }
  }

  it('sorts names case-insensitively and uses name as the tie-break', () => {
    const rows = [row({ id: 'miso', name: 'miso' }), row({ id: 'bella', name: 'Bella' })]
    expect(sortPetRows(rows, 'name').map((item) => item.id)).toEqual(['bella', 'miso'])
    expect(sortPetRows(rows, 'name', 'desc').map((item) => item.id)).toEqual(['miso', 'bella'])
  })

  it('sorts age and weight numerically, not as text', () => {
    const rows = [
      row({ id: 'ten', name: 'Ten', weightKg: 10, ageYears: 10 }),
      row({ id: 'two', name: 'Two', weightKg: 2, ageYears: 2 }),
    ]
    expect(sortPetRows(rows, 'weight').map((item) => item.id)).toEqual(['two', 'ten'])
    expect(sortPetRows(rows, 'age').map((item) => item.id)).toEqual(['two', 'ten'])
  })

  it('sorts due severity worst-first when descending, then by nearest due date', () => {
    const rows = [
      row({ id: 'ok', name: 'Ok', dueRank: 0, dueDate: null }),
      row({ id: 'soon', name: 'Soon', dueRank: 1, dueDate: '2026-12-01' }),
      row({ id: 'late-b', name: 'Late B', dueRank: 2, dueDate: '2026-11-01' }),
      row({ id: 'late-a', name: 'Late A', dueRank: 2, dueDate: '2026-10-01' }),
    ]
    expect(sortPetRows(rows, 'due', 'asc').map((item) => item.id)).toEqual([
      'ok',
      'soon',
      'late-a',
      'late-b',
    ])
    // Descending mirrors the ascending comparator: worst first, later due first
    // inside one severity, then the untracked row last.
    expect(sortPetRows(rows, 'due', 'desc').map((item) => item.id)).toEqual([
      'late-b',
      'late-a',
      'soon',
      'ok',
    ])
    // Same severity: the earlier due date sorts first (late-a < late-b).
    expect(comparePetRows(rows[3]!, rows[2]!, 'due')).toBeLessThan(0)
  })

  it('sorts species first, then name', () => {
    const rows = [
      row({ id: 'dog-b', name: 'Bella', species: 'Dog' }),
      row({ id: 'cat', name: 'Miso', species: 'Cat' }),
      row({ id: 'dog-a', name: 'Ace', species: 'Dog' }),
    ]
    expect(sortPetRows(rows, 'species').map((item) => item.id)).toEqual(['cat', 'dog-a', 'dog-b'])
  })

  it('offers every present species to the filter, known species first', () => {
    expect(
      speciesFilterOptions([
        pet({ id: 'dragon', name: 'Dragon', species: 'Dragon' }),
        pet({ id: 'miso', name: 'Miso', species: 'Cat' }),
        pet({ id: 'bella', name: 'Bella', species: 'Dog' }),
      ]),
    ).toEqual(['Dog', 'Cat', 'Dragon'])
  })
})
