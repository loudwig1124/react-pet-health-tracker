/**
 * The `/appointments` read model and the visit action gate (R3, 02 §2).
 *
 * The repository already re-checks the state machine on every write; this module
 * derives what the UI may offer from the same shared rule, so a disabled button
 * and a rejected write can never disagree. `now` is always a parameter — the
 * only wall-clock reads happen in the dialogs, once per action.
 */

import { checkAppointmentTransition } from '@/lib/rules/appointment-fsm'
import { addDays, instantMs, localDayOfInstant, todayKey } from '@/lib/rules/calendar'
import { APPOINTMENT_STATUS_LABELS } from '@/lib/rules/constants'
import type { Appointment, AppointmentStatus, DateKey, Pet } from '@/lib/rules/types'

import { formatDateTimeWithYear, localDateTimeParts } from './format'
import type { AppointmentSegment, AppointmentSortKey, SortDirection } from './query'
import { flipSortDirection } from './query'

export interface AppointmentView {
  appointment: Appointment
  pet: Pet | null
  /** The pet's name, or "Household" for a visit whose pet was deleted (02 §3). */
  petLabel: string
  /** The local calendar day of `scheduledAt` (R4). */
  day: DateKey
  /** Scheduled and strictly in the future (02 §3 derived read models). */
  isUpcoming: boolean
}

/** The repository's upcoming rule, shared by the table, calendar and counts. */
export function isUpcomingAppointment(appointment: Appointment, now: Date): boolean {
  return appointment.status === 'scheduled' && instantMs(appointment.scheduledAt) > now.getTime()
}

export function toAppointmentViews(
  appointments: readonly Appointment[],
  pets: readonly Pet[],
  now: Date,
): AppointmentView[] {
  const petsById = new Map(pets.map((pet) => [pet.id, pet]))
  return appointments.map((appointment) => {
    const pet = appointment.petId === null ? null : (petsById.get(appointment.petId) ?? null)
    return {
      appointment,
      pet,
      petLabel: pet?.name ?? 'Household',
      day: localDayOfInstant(appointment.scheduledAt),
      isUpcoming: isUpcomingAppointment(appointment, now),
    }
  })
}

export interface AppointmentPartition {
  upcoming: AppointmentView[]
  past: AppointmentView[]
}

/** Upcoming = scheduled and still ahead; everything else is history (02 §3). */
export function partitionAppointmentViews(views: readonly AppointmentView[]): AppointmentPartition {
  const upcoming: AppointmentView[] = []
  const past: AppointmentView[] = []
  for (const view of views) {
    if (view.isUpcoming) {
      upcoming.push(view)
    } else {
      past.push(view)
    }
  }
  return { upcoming, past }
}

export function appointmentViewsForSegment(
  partition: AppointmentPartition,
  segment: AppointmentSegment,
): AppointmentView[] {
  return segment === 'upcoming' ? partition.upcoming : partition.past
}

/** `null` = every pet. A deleted pet's visit (`petId: null`) shows under "Household". */
export function filterAppointmentViewsByPet(
  views: readonly AppointmentView[],
  petId: string | null,
): AppointmentView[] {
  if (petId === null) {
    return [...views]
  }
  return views.filter((view) => view.appointment.petId === petId)
}

export function filterAppointmentViewsByDay(
  views: readonly AppointmentView[],
  day: DateKey | null,
): AppointmentView[] {
  if (day === null) {
    return [...views]
  }
  return views.filter((view) => view.day === day)
}

/** The days that carry at least one visit, ascending — the calendar's markers. */
export function appointmentVisitDays(views: readonly AppointmentView[]): DateKey[] {
  return [...new Set(views.map((view) => view.day))].sort()
}

const STATUS_RANK: Record<AppointmentStatus, number> = {
  scheduled: 0,
  completed: 1,
  cancelled: 2,
  no_show: 3,
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}

function compareWhen(a: AppointmentView, b: AppointmentView): number {
  const byInstant = instantMs(a.appointment.scheduledAt) - instantMs(b.appointment.scheduledAt)
  if (byInstant !== 0) {
    return byInstant
  }
  return a.appointment.id < b.appointment.id ? -1 : a.appointment.id > b.appointment.id ? 1 : 0
}

/** Deterministic comparator for one sort key; ties fall back to the when order. */
export function compareAppointmentViews(
  a: AppointmentView,
  b: AppointmentView,
  sort: AppointmentSortKey,
): number {
  switch (sort) {
    case 'pet': {
      const byPet = compareStrings(a.petLabel, b.petLabel)
      if (byPet !== 0) {
        return byPet
      }
      break
    }
    case 'clinic': {
      const byClinic = compareStrings(a.appointment.clinicName, b.appointment.clinicName)
      if (byClinic !== 0) {
        return byClinic
      }
      break
    }
    case 'status': {
      const byStatus = STATUS_RANK[a.appointment.status] - STATUS_RANK[b.appointment.status]
      if (byStatus !== 0) {
        return byStatus
      }
      break
    }
    case 'when':
    default:
      break
  }
  return compareWhen(a, b)
}

export function sortAppointmentViews(
  views: readonly AppointmentView[],
  sort: AppointmentSortKey,
  direction: SortDirection,
): AppointmentView[] {
  const factor = direction === 'asc' ? 1 : -1
  return [...views].sort((a, b) => factor * compareAppointmentViews(a, b, sort))
}

/** Header-click sort state for the appointments table. */
export function appointmentSortChange(
  current: AppointmentSortKey,
  direction: SortDirection,
  clicked: AppointmentSortKey,
  defaultDirection: SortDirection,
): { sort: AppointmentSortKey; dir: SortDirection } {
  if (current === clicked) {
    return { sort: clicked, dir: flipSortDirection(direction) }
  }
  return { sort: clicked, dir: defaultDirection }
}

/* ------------------------------------------------------- visit action gate */

export interface AppointmentActionState {
  isScheduled: boolean
  canComplete: boolean
  canCancel: boolean
  canNoShow: boolean
  canReschedule: boolean
  /** Why "Mark no-show" is unavailable, shown next to the disabled button. */
  noShowBlockMessage: string | null
}

const NO_ACTIONS: AppointmentActionState = Object.freeze({
  isScheduled: false,
  canComplete: false,
  canCancel: false,
  canNoShow: false,
  canReschedule: false,
  noShowBlockMessage: null,
})

/**
 * What the actions dialog may offer, from the shared state machine (R3):
 * terminal visits are read-only; no-show waits for the clock; cancelling always
 * opens the reason form (the reason itself is validated on submit).
 */
export function appointmentActionState(
  appointment: Appointment,
  now: Date,
): AppointmentActionState {
  if (appointment.status !== 'scheduled') {
    return NO_ACTIONS
  }
  const noShow = checkAppointmentTransition({
    from: appointment.status,
    to: 'no_show',
    scheduledAt: appointment.scheduledAt,
    now,
  })
  return {
    isScheduled: true,
    canComplete: checkAppointmentTransition({
      from: appointment.status,
      to: 'completed',
      scheduledAt: appointment.scheduledAt,
      now,
    }).allowed,
    canCancel: checkAppointmentTransition({
      from: appointment.status,
      to: 'cancelled',
      scheduledAt: appointment.scheduledAt,
      now,
      cancelReason: 'pending',
    }).allowed,
    canNoShow: noShow.allowed,
    canReschedule: true,
    noShowBlockMessage: noShow.allowed ? null : noShow.message,
  }
}

/** A cancellation reason must contain more than whitespace (R3). */
export function isCancelReasonValid(reason: string): boolean {
  return reason.trim() !== ''
}

/** The reschedule form's initial local values, in the reader's clock. */
export function reschedulePrefill(appointment: Appointment): { date: DateKey; time: string } {
  return localDateTimeParts(appointment.scheduledAt)
}

/** Booking defaults: tomorrow at 09:30 local (02 §1 AppointmentDialog). */
export function bookingDefaults(now: Date): { date: DateKey; time: string } {
  return { date: addDays(todayKey(now), 1), time: '09:30' }
}

/**
 * One-line summary of a closed visit for the read-only dialog (R3: completedAt
 * exactly on completion, cancelReason exactly on cancellation).
 */
export function terminalSummary(appointment: Appointment): string | null {
  switch (appointment.status) {
    case 'completed':
      return `Completed ${formatDateTimeWithYear(
        appointment.completedAt ?? appointment.scheduledAt,
      )}`
    case 'cancelled':
      return `Cancelled — ${appointment.cancelReason ?? 'no reason recorded'}`
    case 'no_show':
      return 'Recorded as a no-show'
    case 'scheduled':
      return null
  }
}

/** The human status label, shared by the table and the dialog. */
export function appointmentStatusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUS_LABELS[status]
}
