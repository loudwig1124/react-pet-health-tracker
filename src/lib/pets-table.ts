/**
 * `/pets` read model, F5 comparators and F6 URL state (05 F5/F6, 06 M2).
 *
 * The route feeds these rows to TanStack Table for sorting; the URL parser and
 * the filtering/comparators stay pure so they are unit-tested without a DOM or
 * a store. Status itself is never recomputed here — `petDueSummary` is the R1
 * rule (newest dose wins), so the table, the dashboard and the detail header
 * cannot drift apart.
 */

import { dueDatePhrase } from '@/lib/due-phrase'
import { formatAge } from '@/lib/format'
import { ageInYears } from '@/lib/rules/calendar'
import { SPECIES_OPTIONS, VACCINATION_DUE_STATUS_LABELS } from '@/lib/rules/constants'
import { formatWeight } from '@/lib/rules/settings'
import type { DateKey, Pet, Vaccination, VaccinationDueStatus, WeightUnit } from '@/lib/rules/types'
import { petDueSummary } from '@/lib/rules/vaccination-due'
import {
  FILTER_ALL,
  SORT_DIRECTIONS,
  compareText,
  parseFilterValue,
  parseSortDirection,
  serializeFilterValue,
  type SortDirection,
} from '@/lib/table-state'

export { FILTER_ALL, SORT_DIRECTIONS, type SortDirection }

export const PET_SORT_KEYS = ['name', 'species', 'age', 'weight', 'due'] as const

export type PetSortKey = (typeof PET_SORT_KEYS)[number]

export const PET_SORT_LABELS: Record<PetSortKey, string> = {
  name: 'Name',
  species: 'Species',
  age: 'Age',
  weight: 'Weight',
  due: 'Due',
}

export const PET_DUE_FILTERS = ['all', 'overdue', 'due_soon', 'up_to_date'] as const

export type PetDueFilter = (typeof PET_DUE_FILTERS)[number]

export interface PetTableQuery {
  /** Free-text over name, species and breed. */
  q: string
  /** One species value, or `all`. */
  species: string
  due: PetDueFilter
  /** One pet id, or `all` (the F6/R10 sentinel). */
  pet: string
  sort: PetSortKey
  dir: SortDirection
}

export const DEFAULT_PET_TABLE_QUERY: PetTableQuery = {
  q: '',
  species: FILTER_ALL,
  due: FILTER_ALL,
  pet: FILTER_ALL,
  sort: 'name',
  dir: 'asc',
}

/** The first click on Due is most useful worst-first; every other column ascends. */
export function defaultDirectionForPetSort(sort: PetSortKey): SortDirection {
  return sort === 'due' ? 'desc' : 'asc'
}

function isPetSortKey(value: unknown): value is PetSortKey {
  return typeof value === 'string' && (PET_SORT_KEYS as readonly string[]).includes(value)
}

function isPetDueFilter(value: unknown): value is PetDueFilter {
  return typeof value === 'string' && (PET_DUE_FILTERS as readonly string[]).includes(value)
}

/** Normalises any partial query, so callers can pass unvalidated state in. */
export function normalizePetTableQuery(query: Partial<PetTableQuery>): PetTableQuery {
  const sort = isPetSortKey(query.sort) ? query.sort : DEFAULT_PET_TABLE_QUERY.sort
  return {
    q: (query.q ?? '').trim(),
    species: parseFilterValue(query.species),
    due: isPetDueFilter(query.due) ? query.due : FILTER_ALL,
    pet: parseFilterValue(query.pet),
    sort,
    dir: parseSortDirection(query.dir, defaultDirectionForPetSort(sort)),
  }
}

/** F6: `?q=&species=&due=&pet=&sort=&dir=` → a validated table query. */
export function parsePetTableQuery(params: URLSearchParams): PetTableQuery {
  return normalizePetTableQuery({
    q: params.get('q') ?? '',
    species: params.get('species') ?? FILTER_ALL,
    due: (params.get('due') ?? FILTER_ALL) as PetDueFilter,
    pet: params.get('pet') ?? FILTER_ALL,
    sort: (params.get('sort') ?? DEFAULT_PET_TABLE_QUERY.sort) as PetSortKey,
    dir: (params.get('dir') ?? undefined) as SortDirection | undefined,
  })
}

/** F6: a table query → search params, omitting every default so URLs stay short. */
export function serializePetTableQuery(query: Partial<PetTableQuery>): URLSearchParams {
  const normalized = normalizePetTableQuery(query)
  const params = new URLSearchParams()
  if (normalized.q !== '') {
    params.set('q', normalized.q)
  }
  const species = serializeFilterValue(normalized.species)
  if (species !== null) {
    params.set('species', species)
  }
  if (normalized.due !== FILTER_ALL) {
    params.set('due', normalized.due)
  }
  const pet = serializeFilterValue(normalized.pet)
  if (pet !== null) {
    params.set('pet', pet)
  }
  // Keep the sort/direction pair readable: a non-default direction names its
  // column even when that column is the default one (`?sort=name&dir=desc`).
  const defaultDirection = defaultDirectionForPetSort(normalized.sort)
  if (normalized.sort !== DEFAULT_PET_TABLE_QUERY.sort || normalized.dir !== defaultDirection) {
    params.set('sort', normalized.sort)
  }
  if (normalized.dir !== defaultDirection) {
    params.set('dir', normalized.dir)
  }
  return params
}

/* --------------------------------------------------------------- read model */

const DUE_RANK: Record<VaccinationDueStatus, number> = {
  overdue: 2,
  due_soon: 1,
  up_to_date: 0,
}

export interface PetTableRow {
  id: string
  pet: Pet
  name: string
  species: string
  breed: string | null
  /** "Dog · Golden Retriever mix" for the species cell. */
  speciesLine: string
  ageYears: number
  ageLabel: string
  weightKg: number
  weightLabel: string
  dueStatus: VaccinationDueStatus
  dueRank: number
  dueLabel: string
  /** The headline dose naming line, e.g. "Rabies · 35 days overdue". */
  dueDetail: string
  headlineVaccineName: string | null
  dueDate: DateKey | null
  /** Lower-cased name/species/breed haystack for the free-text filter. */
  searchText: string
}

export interface PetRowContext {
  today: DateKey
  windowDays: number
  weightUnit: WeightUnit
}

/** "35 days overdue" · "due today" · "due in 10 days" (R1/R4 local day). */
export { dueDatePhrase } from '@/lib/due-phrase'

/** Rows for `/pets`: R1 status per pet plus the display values the columns need. */
export function buildPetTableRows(
  pets: readonly Pet[],
  dosesByPet: ReadonlyMap<string, readonly Vaccination[]>,
  context: PetRowContext,
): PetTableRow[] {
  return pets.map((pet) => {
    const doses = dosesByPet.get(pet.id) ?? []
    const summary = petDueSummary(doses, context.today, context.windowDays)
    const headline = summary.headline
    const dueDate = headline?.dose.nextDueDate ?? null
    const phrase = dueDatePhrase(dueDate, context.today)
    return {
      id: pet.id,
      pet,
      name: pet.name,
      species: pet.species,
      breed: pet.breed,
      speciesLine: pet.breed === null ? pet.species : `${pet.species} · ${pet.breed}`,
      ageYears: ageInYears(pet.dateOfBirth, context.today),
      ageLabel: formatAge(pet.dateOfBirth, context.today),
      weightKg: pet.weightKg,
      weightLabel: formatWeight(pet.weightKg, context.weightUnit),
      dueStatus: summary.status,
      dueRank: DUE_RANK[summary.status],
      dueLabel: VACCINATION_DUE_STATUS_LABELS[summary.status],
      dueDetail:
        headline == null
          ? 'No tracked boosters'
          : `${headline.dose.vaccineName} · ${phrase ?? 'no booster date'}`,
      headlineVaccineName: headline?.dose.vaccineName ?? null,
      dueDate,
      searchText: `${pet.name} ${pet.species} ${pet.breed ?? ''}`.toLowerCase(),
    }
  })
}

/* ------------------------------------------------------------------ filters */

export function filterPetRows(
  rows: readonly PetTableRow[],
  query: Pick<PetTableQuery, 'q' | 'species' | 'due' | 'pet'>,
): PetTableRow[] {
  const needle = query.q.trim().toLowerCase()
  return rows.filter((row) => {
    if (needle !== '' && !row.searchText.includes(needle)) {
      return false
    }
    if (query.species !== FILTER_ALL && row.species.toLowerCase() !== query.species.toLowerCase()) {
      return false
    }
    if (query.due !== FILTER_ALL && row.dueStatus !== query.due) {
      return false
    }
    if (query.pet !== FILTER_ALL && row.id !== query.pet) {
      return false
    }
    return true
  })
}

/** True when any filter (not the sort) is narrowing the table. */
export function hasPetFilters(
  query: Pick<PetTableQuery, 'q' | 'species' | 'due' | 'pet'>,
): boolean {
  return (
    query.q.trim() !== '' ||
    query.species !== FILTER_ALL ||
    query.due !== FILTER_ALL ||
    query.pet !== FILTER_ALL
  )
}

/** The species present in the household, plus any legacy value outside the list. */
export function speciesFilterOptions(pets: readonly Pet[]): string[] {
  const seen = new Set<string>()
  for (const pet of pets) {
    if (pet.species.trim() !== '') {
      seen.add(pet.species)
    }
  }
  const known: readonly string[] = SPECIES_OPTIONS
  return [...seen].sort((a, b) => {
    const aKnown = known.indexOf(a)
    const bKnown = known.indexOf(b)
    if (aKnown !== -1 && bKnown !== -1) {
      return aKnown - bKnown
    }
    if (aKnown !== -1) {
      return -1
    }
    if (bKnown !== -1) {
      return 1
    }
    return compareText(a, b)
  })
}

/* --------------------------------------------------------------- comparators */

/**
 * The F5 ascending comparator for one sort column. TanStack applies the
 * descending multiplier, so direction is intentionally not a parameter here.
 */
export function comparePetRows(a: PetTableRow, b: PetTableRow, sort: PetSortKey): number {
  switch (sort) {
    case 'species': {
      const bySpecies = compareText(a.species, b.species)
      return bySpecies !== 0 ? bySpecies : compareText(a.name, b.name)
    }
    case 'age':
      return a.ageYears - b.ageYears || compareText(a.name, b.name)
    case 'weight':
      return a.weightKg - b.weightKg || compareText(a.name, b.name)
    case 'due': {
      const bySeverity = a.dueRank - b.dueRank
      if (bySeverity !== 0) {
        return bySeverity
      }
      if (a.dueDate !== null && b.dueDate !== null) {
        const byDate = a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0
        if (byDate !== 0) {
          return byDate
        }
      } else if (a.dueDate !== null) {
        return -1
      } else if (b.dueDate !== null) {
        return 1
      }
      return compareText(a.name, b.name)
    }
    default:
      return compareText(a.name, b.name)
  }
}

/** The whole sort applied — used by the comparator tests and non-TanStack lists. */
export function sortPetRows(
  rows: readonly PetTableRow[],
  sort: PetSortKey,
  dir: SortDirection = 'asc',
): PetTableRow[] {
  return [...rows].sort((a, b) => {
    const result = comparePetRows(a, b, sort)
    return dir === 'desc' ? -result : result
  })
}
