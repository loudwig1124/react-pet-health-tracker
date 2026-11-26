/**
 * R1 — vaccination due status: the newest dose per vaccine wins.
 *
 * A pet accumulates dose history (a row can be corrected, not rewritten out of the
 * record). Ranking every row
 * would let an old, overdue dose outrank the booster that superseded it — the
 * fixed D2/Q2 bug where a re-vaccinated pet could never clear "overdue".
 *
 * Pure: `today` and the due-soon window are parameters. No clock, no store.
 */

import {
  addDays,
  addMonths,
  assertDateKey,
  compareDateKeys,
  instantMs,
  isDateKey,
} from './calendar'
import type { DateKey, IsoInstant, Vaccination, VaccinationDueStatus } from './types'

/** The approved default window: a booster due within 30 days is "due soon". */
export const DEFAULT_DUE_SOON_WINDOW_DAYS = 30

/** The minimal dose shape the rule needs; a stored `Vaccination` satisfies it. */
export interface VaccinationDoseInput {
  id: string
  vaccineTypeId?: string | null
  vaccineName: string
  vaccinationDate: DateKey
  nextDueDate?: DateKey | null
  createdAt: IsoInstant
}

const DUE_STATUS_SEVERITY: Record<VaccinationDueStatus, number> = {
  overdue: 2,
  due_soon: 1,
  up_to_date: 0,
}

/**
 * The ranking key: the catalog id when present, otherwise the normalised name
 * snapshot for historical rows that predate the catalog.
 */
export function vaccineKey(
  dose: Pick<VaccinationDoseInput, 'vaccineTypeId' | 'vaccineName'>,
): string {
  if (dose.vaccineTypeId != null && dose.vaccineTypeId !== '') {
    return `type:${dose.vaccineTypeId}`
  }
  return `name:${normalizeVaccineName(dose.vaccineName)}`
}

/** Trim + lower-case; the name is only a fallback key, never a ranking key. */
export function normalizeVaccineName(name: string): string {
  return name.trim().toLowerCase()
}

function assertWindowDays(windowDays: number): void {
  if (!Number.isInteger(windowDays) || windowDays < 0) {
    throw new RangeError(`The due-soon window must be an integer >= 0, received ${windowDays}`)
  }
}

function compareDosesNewestFirst(a: VaccinationDoseInput, b: VaccinationDoseInput): number {
  const byDate = compareDateKeys(a.vaccinationDate, b.vaccinationDate)
  if (byDate !== 0) {
    // Later dose wins.
    return -byDate
  }
  const byCreatedAt = instantMs(a.createdAt) - instantMs(b.createdAt)
  if (byCreatedAt !== 0) {
    // Later creation order wins; `createdAt` is the ISO millisecond instant.
    return -byCreatedAt
  }
  // Deterministic final tie-break: the greater id wins (01 D6a / 06 §4).
  if (a.id === b.id) {
    return 0
  }
  return a.id > b.id ? -1 : 1
}

/**
 * The doses that still describe a pet's status: the newest one per vaccine key,
 * by `vaccinationDate`, then `createdAt`, then `id`. Deterministic output order
 * (sorted by key) so tests never depend on input order.
 */
export function currentDoses(doses: readonly VaccinationDoseInput[]): VaccinationDoseInput[] {
  const latest = new Map<string, VaccinationDoseInput>()
  for (const dose of doses) {
    assertDateKey(dose.vaccinationDate, 'vaccinationDate')
    const key = vaccineKey(dose)
    const incumbent = latest.get(key)
    if (incumbent === undefined || compareDosesNewestFirst(dose, incumbent) < 0) {
      latest.set(key, dose)
    }
  }
  return [...latest.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, dose]) => dose)
}

/**
 * Due status of one due date. A date before today is overdue; today or within
 * `windowDays` days is due soon; anything later is up to date. A null due date
 * means "not tracked" and reads up to date — nothing is due.
 */
export function doseDueStatus(
  nextDueDate: DateKey | null | undefined,
  today: DateKey,
  windowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): VaccinationDueStatus {
  assertDateKey(today, 'today')
  assertWindowDays(windowDays)
  if (nextDueDate == null) {
    return 'up_to_date'
  }
  assertDateKey(nextDueDate, 'nextDueDate')
  if (compareDateKeys(nextDueDate, today) < 0) {
    return 'overdue'
  }
  if (compareDateKeys(nextDueDate, addDays(today, windowDays)) <= 0) {
    return 'due_soon'
  }
  return 'up_to_date'
}

/** The most urgent of several statuses (overdue beats due soon beats up to date). */
export function worstDueStatus(statuses: Iterable<VaccinationDueStatus>): VaccinationDueStatus {
  let worst: VaccinationDueStatus = 'up_to_date'
  for (const status of statuses) {
    if (DUE_STATUS_SEVERITY[status] > DUE_STATUS_SEVERITY[worst]) {
      worst = status
    }
  }
  return worst
}

/** The due status of a single stored dose, using its own next-due date. */
export function vaccinationDueStatus(
  dose: Pick<VaccinationDoseInput, 'nextDueDate'>,
  today: DateKey,
  windowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): VaccinationDueStatus {
  return doseDueStatus(dose.nextDueDate, today, windowDays)
}

/**
 * The most urgent status across a pet's current doses. No tracked due dates
 * reads up to date (nothing is due); the old history rows never count.
 */
export function petVaccinationDueStatus(
  doses: readonly VaccinationDoseInput[],
  today: DateKey,
  windowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): VaccinationDueStatus {
  assertWindowDays(windowDays)
  return worstDueStatus(
    currentDoses(doses).map((dose) => doseDueStatus(dose.nextDueDate, today, windowDays)),
  )
}

/**
 * The current dose with the earliest next due date (overdue first), or null
 * when no current dose has a due date. This names the pet's headline chip
 * ("Rabies"). Ties resolve deterministically by `createdAt`, then `id`.
 */
export function headlineVaccinationDose(
  doses: readonly VaccinationDoseInput[],
): VaccinationDoseInput | null {
  let headline: VaccinationDoseInput | null = null
  for (const dose of currentDoses(doses)) {
    if (dose.nextDueDate == null) {
      continue
    }
    if (headline === null || headline.nextDueDate == null) {
      headline = dose
      continue
    }
    const byDue = compareDateKeys(dose.nextDueDate, headline.nextDueDate)
    if (byDue < 0) {
      headline = dose
      continue
    }
    if (byDue === 0) {
      const byCreatedAt = instantMs(dose.createdAt) - instantMs(headline.createdAt)
      if (byCreatedAt < 0 || (byCreatedAt === 0 && dose.id < headline.id)) {
        headline = dose
      }
    }
  }
  return headline
}

export interface PetDueSummary {
  status: VaccinationDueStatus
  /** The headline dose and its own status, or null when nothing is tracked. */
  headline: { dose: VaccinationDoseInput; status: VaccinationDueStatus } | null
}

/** Everything Home and the pet header need from the pure rule in one pass. */
export function petDueSummary(
  doses: readonly VaccinationDoseInput[],
  today: DateKey,
  windowDays: number = DEFAULT_DUE_SOON_WINDOW_DAYS,
): PetDueSummary {
  const current = currentDoses(doses)
  const headlineDose = headlineVaccinationDose(current)
  return {
    status: worstDueStatus(
      current.map((dose) => doseDueStatus(dose.nextDueDate, today, windowDays)),
    ),
    headline:
      headlineDose === null
        ? null
        : {
            dose: headlineDose,
            status: doseDueStatus(headlineDose.nextDueDate, today, windowDays),
          },
  }
}

/**
 * The vaccination form rule: a next due date is null or strictly after the dose
 * date (02 §3, R1 form contract).
 */
export function isValidNextDueDate(
  vaccinationDate: DateKey,
  nextDueDate: DateKey | null | undefined,
): boolean {
  assertDateKey(vaccinationDate, 'vaccinationDate')
  if (nextDueDate == null) {
    return true
  }
  if (!isDateKey(nextDueDate)) {
    return false
  }
  return compareDateKeys(nextDueDate, vaccinationDate) > 0
}

/** Prefill for the next-due field from a catalog interval (R1 / `addMonths`). */
export function nextDueFromInterval(
  vaccinationDate: DateKey,
  intervalMonths: number | null | undefined,
): DateKey | null {
  assertDateKey(vaccinationDate, 'vaccinationDate')
  return intervalMonths == null || intervalMonths <= 0
    ? null
    : addMonths(vaccinationDate, intervalMonths)
}

/** A stored `Vaccination` is accepted wherever a dose input is required. */
export type StoredVaccination = Pick<
  Vaccination,
  'id' | 'vaccineTypeId' | 'vaccineName' | 'vaccinationDate' | 'nextDueDate' | 'createdAt'
>
