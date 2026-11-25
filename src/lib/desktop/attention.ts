/**
 * F1/F2 read model — the one place the desktop counters and sidebar badges are
 * derived.
 *
 * 05 F1 is explicit: the counters must **call R1/R4, never re-implement them**.
 * This module therefore only orchestrates the existing pure rules:
 * - vaccination status and the headline dose come from `petDueSummary` (R1);
 * - every calendar day comes from the R4 helpers (`todayKey`,
 *   `localDayOfInstant`, `addDays`, `compareDateKeys`);
 * - the up-coming/appointment split reuses the same clock rule the repository
 *   and `/appointments` use (scheduled and strictly after `now`).
 *
 * Pure: no React, no Dexie and no clock reads — `now` and `windowDays` are
 * parameters. That is what makes "counters equal the rule outputs on fixture
 * households" a unit test instead of a browser assertion.
 */

import { dueDatePhrase } from '@/lib/due-phrase'
import { addDays, compareDateKeys, localDayOfInstant, todayKey } from '@/lib/rules/calendar'
import type { Appointment, DateKey, IsoInstant, Pet, Vaccination } from '@/lib/rules/types'
import {
  currentDoses,
  doseDueStatus,
  petDueSummary,
  type VaccinationDoseInput,
} from '@/lib/rules/vaccination-due'

/** The minimal pet shape every desktop count needs; a stored `Pet` satisfies it. */
export type AttentionPet = Pick<Pet, 'id' | 'name'>

export interface AttentionDose {
  petId: string
  petName: string
  /** The current (newest-per-vaccine) dose that carries the due date. */
  dose: VaccinationDoseInput
  status: 'overdue' | 'due_soon'
  dueDate: DateKey
  /** "35 days overdue" / "due in 10 days" (R1 + R4). */
  phrase: string
}

export interface WeekBounds {
  /** Monday of the current local week. */
  start: DateKey
  /** Sunday of the current local week, inclusive. */
  end: DateKey
}

/**
 * The household week is **Monday–Sunday** (ISO-8601), the convention the
 * Flutter app used for its "this week" copy and the one 03's diary layout reads
 * as. It is independent of the locale's first-day-of-week preference: the
 * counters must be stable for the tests and the demo.
 */
export function weekBounds(today: DateKey, weekStartsOn: 0 | 1 = 1): WeekBounds {
  const weekday = weekdayOfDateKey(today)
  const back = (weekday - weekStartsOn + 7) % 7
  const start = addDays(today, -back)
  return { start, end: addDays(start, 6) }
}

/** 0 = Sunday … 6 = Saturday for a fixed-width local date key. */
export function weekdayOfDateKey(key: DateKey): number {
  // Noon avoids a DST boundary at midnight moving the weekday in a few zones.
  const date = new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
    12,
    0,
    0,
    0,
  )
  return date.getDay()
}

export interface HouseholdAttention {
  /** Pets in the household (F1 counter 1). */
  petCount: number
  /** Pets whose worst current dose is overdue (F1 counter 2, F2 badge split). */
  overduePets: number
  /** Pets whose worst current dose is due soon and none overdue (counter 3). */
  dueSoonPets: number
  /** Every current dose that needs attention, worst first (the F1 rail). */
  attention: AttentionDose[]
  /** Scheduled visits whose local day is today (F2 appointments badge). */
  todayVisits: number
  /** Scheduled visits whose local day falls in the Monday–Sunday week (counter 4). */
  visitsThisWeek: number
  today: DateKey
  week: WeekBounds
}

export interface HouseholdAttentionInput {
  pets: readonly AttentionPet[]
  doses: readonly Vaccination[]
  appointments: readonly Appointment[]
  /** The clock is a parameter: the write path re-reads it per action (R3). */
  now: Date
  windowDays: number
}

const ATTENTION_RANK: Record<AttentionDose['status'], number> = {
  overdue: 0,
  due_soon: 1,
}

/** Every scheduled visit's local day, keyed by appointment id. */
function scheduledDays(appointments: readonly Appointment[]): Map<string, DateKey> {
  const days = new Map<string, DateKey>()
  for (const appointment of appointments) {
    if (appointment.status === 'scheduled') {
      days.set(appointment.id, localDayOfInstant(appointment.scheduledAt))
    }
  }
  return days
}

function inWeek(day: DateKey, week: WeekBounds): boolean {
  return compareDateKeys(day, week.start) >= 0 && compareDateKeys(day, week.end) <= 0
}

/**
 * All four F1 counters, the F2 badge values and the attention rail in one pass.
 * The same function backs the dashboard, the sidebar and (via `petTableRows`)
 * the `/pets` table, so the three cannot disagree about a pet's due status.
 */
export function computeHouseholdAttention(input: HouseholdAttentionInput): HouseholdAttention {
  const today = todayKey(input.now)
  const week = weekBounds(today)

  const dosesByPet = new Map<string, Vaccination[]>()
  for (const dose of input.doses) {
    const existing = dosesByPet.get(dose.petId)
    if (existing === undefined) {
      dosesByPet.set(dose.petId, [dose])
    } else {
      existing.push(dose)
    }
  }

  let overduePets = 0
  let dueSoonPets = 0
  const attention: AttentionDose[] = []

  for (const pet of input.pets) {
    const petDoses = dosesByPet.get(pet.id) ?? []
    const summary = petDueSummary(petDoses, today, input.windowDays)
    if (summary.status === 'overdue') {
      overduePets += 1
    } else if (summary.status === 'due_soon') {
      dueSoonPets += 1
    }

    // The rail names the actual doses: every current dose whose own next-due
    // date is overdue or due soon, not just the pet's headline.
    for (const dose of currentDoses(petDoses)) {
      const status = doseDueStatus(dose.nextDueDate, today, input.windowDays)
      if (status === 'up_to_date' || dose.nextDueDate == null) {
        continue
      }
      attention.push({
        petId: pet.id,
        petName: pet.name,
        dose,
        status,
        dueDate: dose.nextDueDate,
        phrase: dueDatePhrase(dose.nextDueDate, today) ?? 'needs attention',
      })
    }
  }

  attention.sort((left, right) => {
    const byStatus = ATTENTION_RANK[left.status] - ATTENTION_RANK[right.status]
    if (byStatus !== 0) {
      return byStatus
    }
    const byDue = compareDateKeys(left.dueDate, right.dueDate)
    if (byDue !== 0) {
      return byDue
    }
    const byPet = left.petName.localeCompare(right.petName, undefined, { sensitivity: 'base' })
    if (byPet !== 0) {
      return byPet
    }
    return left.dose.vaccineName.localeCompare(right.dose.vaccineName, undefined, {
      sensitivity: 'base',
    })
  })

  const days = scheduledDays(input.appointments)
  let todayVisits = 0
  let visitsThisWeek = 0
  for (const appointment of input.appointments) {
    if (appointment.status !== 'scheduled') {
      continue
    }
    const day = days.get(appointment.id)
    if (day === undefined) {
      continue
    }
    if (day === today) {
      todayVisits += 1
    }
    if (inWeek(day, week)) {
      visitsThisWeek += 1
    }
  }

  return {
    petCount: input.pets.length,
    overduePets,
    dueSoonPets,
    attention,
    todayVisits,
    visitsThisWeek,
    today,
    week,
  }
}

export interface UpcomingVisit {
  appointment: Appointment
  petLabel: string
  day: DateKey
}

export interface NextVisitDay {
  day: DateKey
  visits: UpcomingVisit[]
}

/**
 * "Next visit lists every visit on the earliest upcoming day" (03 §3). A visit
 * is upcoming by the same rule the repository uses: scheduled and strictly after
 * `now`; `Household` names a visit whose pet was deleted.
 */
export function nextVisitDay(
  appointments: readonly Appointment[],
  pets: readonly AttentionPet[],
  now: Date,
): NextVisitDay | null {
  const nowIso: IsoInstant = now.toISOString()
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name] as const))

  const upcoming = appointments
    .filter((appointment) => appointment.status === 'scheduled' && appointment.scheduledAt > nowIso)
    .map((appointment) => ({
      appointment,
      petLabel:
        appointment.petId === null ? 'Household' : (petNames.get(appointment.petId) ?? 'Household'),
      day: localDayOfInstant(appointment.scheduledAt),
    }))
    .sort(
      (left, right) =>
        left.day.localeCompare(right.day) ||
        left.appointment.scheduledAt.localeCompare(right.appointment.scheduledAt) ||
        left.appointment.id.localeCompare(right.appointment.id),
    )

  const first = upcoming[0]
  if (first === undefined) {
    return null
  }
  return {
    day: first.day,
    visits: upcoming.filter((visit) => visit.day === first.day),
  }
}
