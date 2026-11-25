/**
 * The `/vaccinations` read model (R1, 02 §2 and 06 §2 M3).
 *
 * The table lists every dose on record, but a dose's chip is only a *current*
 * status when it is the newest dose for its vaccine — the old rows are shown as
 * superseded history so a re-vaccinated pet can never look overdue because of a
 * booster it already had. Filtering by status works on the **pet** status
 * (the worst current dose), which is the same rule Home and the sidebar use.
 */

import { compareDateKeys, instantMs } from '@/lib/rules/calendar'
import type { DateKey, Pet, Vaccination, VaccinationDueStatus } from '@/lib/rules/types'
import {
  currentDoses,
  doseDueStatus,
  petVaccinationDueStatus,
  vaccineKey,
} from '@/lib/rules/vaccination-due'

import type { SortDirection, VaccinationSearch, VaccinationSortKey } from './query'
import { flipSortDirection } from './query'

/** The chip a row renders: a due status while current, `superseded` once it is history. */
export type VaccinationChipStatus = VaccinationDueStatus | 'superseded'

export interface VaccinationView {
  dose: Vaccination
  pet: Pet | null
  petLabel: string
  vaccineLabel: string
  /** The R1 ranking key (`type:<id>` or `name:<normalised name>`). */
  vaccineKey: string
  isCurrent: boolean
  /** The dose's own next-due status, from the shared rule. */
  dueStatus: VaccinationDueStatus
  /** What the row chip shows; `superseded` for history rows. */
  chipStatus: VaccinationChipStatus
  /** The pet's worst current-dose status, the value the status filter uses. */
  petStatus: VaccinationDueStatus
}

/** Lower rank sorts first for `sort=status` ascending: overdue is the top concern. */
const CHIP_STATUS_RANK: Record<VaccinationChipStatus, number> = {
  overdue: 0,
  due_soon: 1,
  up_to_date: 2,
  superseded: 3,
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function compareNullableDateKeys(a: DateKey | null, b: DateKey | null): number {
  // "No booster set" always sorts last, whichever direction is selected.
  if (a === null && b === null) {
    return 0
  }
  if (a === null) {
    return 1
  }
  if (b === null) {
    return -1
  }
  return compareDateKeys(a, b)
}

/**
 * Builds the household rows. `doses` may be in any order; `pets` is the
 * household list used for names. The R1 rule runs per pet, never across pets.
 */
export function toVaccinationViews(
  doses: readonly Vaccination[],
  pets: readonly Pet[],
  today: DateKey,
  windowDays: number,
): VaccinationView[] {
  const petsById = new Map(pets.map((pet) => [pet.id, pet]))
  const dosesByPet = new Map<string, Vaccination[]>()
  for (const dose of doses) {
    const list = dosesByPet.get(dose.petId)
    if (list === undefined) {
      dosesByPet.set(dose.petId, [dose])
    } else {
      list.push(dose)
    }
  }

  const petStatus = new Map<string, VaccinationDueStatus>()
  const currentIds = new Set<string>()
  for (const [petId, petDoses] of dosesByPet) {
    petStatus.set(petId, petVaccinationDueStatus(petDoses, today, windowDays))
    for (const dose of currentDoses(petDoses)) {
      currentIds.add(dose.id)
    }
  }

  return doses.map((dose) => {
    const pet = petsById.get(dose.petId) ?? null
    const dueStatus = doseDueStatus(dose.nextDueDate, today, windowDays)
    const isCurrent = currentIds.has(dose.id)
    return {
      dose,
      pet,
      petLabel: pet?.name ?? 'Unknown pet',
      vaccineLabel: dose.vaccineName,
      vaccineKey: vaccineKey(dose),
      isCurrent,
      dueStatus,
      chipStatus: isCurrent ? dueStatus : 'superseded',
      petStatus: petStatus.get(dose.petId) ?? 'up_to_date',
    }
  })
}

/** Applies the URL filters. The status filter is the pet's status (R1). */
export function filterVaccinationViews(
  views: readonly VaccinationView[],
  search: Pick<VaccinationSearch, 'petId' | 'status' | 'vaccineKey'>,
): VaccinationView[] {
  return views.filter((view) => {
    if (search.petId !== null && view.dose.petId !== search.petId) {
      return false
    }
    if (search.status !== null && view.petStatus !== search.status) {
      return false
    }
    if (search.vaccineKey !== null && view.vaccineKey !== search.vaccineKey) {
      return false
    }
    return true
  })
}

/** Deterministic comparator for one sort key (ties fall back to the dose id). */
export function compareVaccinationViews(
  a: VaccinationView,
  b: VaccinationView,
  sort: VaccinationSortKey,
): number {
  switch (sort) {
    case 'pet': {
      const byPet = compareStrings(a.petLabel, b.petLabel)
      if (byPet !== 0) {
        return byPet
      }
      break
    }
    case 'vaccine': {
      const byVaccine = compareStrings(a.vaccineLabel, b.vaccineLabel)
      if (byVaccine !== 0) {
        return byVaccine
      }
      break
    }
    case 'next': {
      return compareNullableDateKeys(a.dose.nextDueDate, b.dose.nextDueDate)
    }
    case 'status': {
      const byRank = CHIP_STATUS_RANK[a.chipStatus] - CHIP_STATUS_RANK[b.chipStatus]
      if (byRank !== 0) {
        return byRank
      }
      break
    }
    case 'given':
    default: {
      const byDate = compareDateKeys(a.dose.vaccinationDate, b.dose.vaccinationDate)
      if (byDate !== 0) {
        return byDate
      }
      const byCreated = instantMs(a.dose.createdAt) - instantMs(b.dose.createdAt)
      if (byCreated !== 0) {
        return byCreated
      }
      break
    }
  }
  return a.dose.id < b.dose.id ? -1 : a.dose.id > b.dose.id ? 1 : 0
}

export function sortVaccinationViews(
  views: readonly VaccinationView[],
  sort: VaccinationSortKey,
  direction: SortDirection,
): VaccinationView[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...views].sort((a, b) => {
    if (sort === 'next') {
      // Null-last is direction-independent; only the real dates flip.
      if (a.dose.nextDueDate === null || b.dose.nextDueDate === null) {
        return compareNullableDateKeys(a.dose.nextDueDate, b.dose.nextDueDate)
      }
    }
    return factor * compareVaccinationViews(a, b, sort)
  })
}

export interface VaccineFilterOption {
  key: string
  label: string
}

/** The vaccine filter's options, derived from the doses actually on record. */
export function vaccineFilterOptions(views: readonly VaccinationView[]): VaccineFilterOption[] {
  const latest = new Map<string, VaccinationView>()
  for (const view of views) {
    const incumbent = latest.get(view.vaccineKey)
    if (
      incumbent === undefined ||
      view.dose.vaccinationDate > incumbent.dose.vaccinationDate ||
      (view.dose.vaccinationDate === incumbent.dose.vaccinationDate &&
        view.dose.createdAt > incumbent.dose.createdAt)
    ) {
      latest.set(view.vaccineKey, view)
    }
  }
  return [...latest.entries()]
    .map(([key, view]) => ({ key, label: view.vaccineLabel }))
    .sort((a, b) => compareStrings(a.label, b.label))
}

export interface VaccinationSummary {
  doses: number
  pets: number
  overdue: number
  dueSoon: number
  upToDate: number
}

/** Counts for the toolbar. Pet counts use the R1 pet status, not row chips. */
export function summarizeVaccinationViews(views: readonly VaccinationView[]): VaccinationSummary {
  const statuses = new Map<string, VaccinationDueStatus>()
  for (const view of views) {
    statuses.set(view.dose.petId, view.petStatus)
  }
  let overdue = 0
  let dueSoon = 0
  let upToDate = 0
  for (const status of statuses.values()) {
    if (status === 'overdue') {
      overdue += 1
    } else if (status === 'due_soon') {
      dueSoon += 1
    } else {
      upToDate += 1
    }
  }
  return { doses: views.length, pets: statuses.size, overdue, dueSoon, upToDate }
}

/** Header-click sort state for the vaccinations table. */
export function vaccinationSortChange(
  current: VaccinationSortKey,
  direction: SortDirection,
  clicked: VaccinationSortKey,
  defaultDirection: SortDirection,
): { sort: VaccinationSortKey; dir: SortDirection } {
  if (current === clicked) {
    return { sort: clicked, dir: flipSortDirection(direction) }
  }
  return { sort: clicked, dir: defaultDirection }
}
