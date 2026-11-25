/**
 * Appointment repository — the R3 state machine lives in
 * `src/lib/rules/appointment-fsm.ts`; this module is the write path that
 * re-checks it (never trusting a disabled button) and makes a reschedule
 * atomic: the old row is cancelled as `rescheduled` and the replacement is
 * inserted in one IndexedDB transaction, so a half-rescheduled visit cannot
 * exist.
 */
import {
  applyAppointmentTransition,
  planReschedule,
  RESCHEDULE_CANCEL_REASON,
} from '@/lib/rules/appointment-fsm'
import type { Appointment, AppointmentDraft, AppointmentStatus } from '@/lib/rules/types'

import { db } from '../db'
import { appointmentDraftSchema, appointmentSchema, parseRow } from '../schema'
import { newId, toIsoInstant } from '../write-helpers'

export interface AppointmentQuery {
  now: Date
  /** `undefined` = every pet; `null` is not a filter value here (02 R10). */
  petId?: string
}

export interface AppointmentStatusOptions {
  now?: Date
  cancelReason?: string | null
}

export interface RescheduleOptions {
  newScheduledAt: Date | string
  now?: Date
}

function sortAscending(rows: Appointment[]): Appointment[] {
  return rows.sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))
}

function sortDescending(rows: Appointment[]): Appointment[] {
  return rows.sort((a, b) => b.scheduledAt.localeCompare(a.scheduledAt) || b.id.localeCompare(a.id))
}

function isUpcoming(appointment: Appointment, now: Date): boolean {
  return appointment.status === 'scheduled' && appointment.scheduledAt > now.toISOString()
}

export async function listUpcomingAppointments(query: AppointmentQuery): Promise<Appointment[]> {
  const rows =
    query.petId === undefined
      ? await db.appointment.toArray()
      : await db.appointment.where('petId').equals(query.petId).toArray()
  return sortAscending(rows.filter((appointment) => isUpcoming(appointment, query.now)))
}

/** Everything that is not an upcoming scheduled visit (02 §3). */
export async function listHistoryAppointments(query: AppointmentQuery): Promise<Appointment[]> {
  const rows =
    query.petId === undefined
      ? await db.appointment.toArray()
      : await db.appointment.where('petId').equals(query.petId).toArray()
  return sortDescending(rows.filter((appointment) => !isUpcoming(appointment, query.now)))
}

export async function listAppointmentsForPet(petId: string): Promise<Appointment[]> {
  return sortDescending(await db.appointment.where('petId').equals(petId).toArray())
}

export async function getAppointment(id: string): Promise<Appointment | undefined> {
  return db.appointment.get(id)
}

export async function createAppointment(
  draft: AppointmentDraft,
  now: Date = new Date(),
): Promise<Appointment> {
  const parsed = parseRow(appointmentDraftSchema, draft, 'appointment draft')
  if (parsed.petId !== null) {
    const pet = await db.pet.get(parsed.petId)
    if (pet === undefined) {
      throw new Error(`Pet ${parsed.petId} does not exist.`)
    }
  }
  const instant = toIsoInstant(now)
  const appointment = parseRow(
    appointmentSchema,
    {
      id: newId(),
      ...parsed,
      status: 'scheduled',
      completedAt: null,
      cancelReason: null,
      createdAt: instant,
      updatedAt: instant,
    },
    'appointment',
  )
  await db.appointment.add(appointment)
  return appointment
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
  options: AppointmentStatusOptions = {},
): Promise<Appointment> {
  const now = options.now ?? new Date()
  return db.transaction('rw', db.appointment, async () => {
    const existing = await db.appointment.get(id)
    if (existing === undefined) {
      throw new Error(`Appointment ${id} does not exist.`)
    }
    const transitioned = applyAppointmentTransition(existing, status, {
      now,
      cancelReason: options.cancelReason ?? null,
    })
    const parsed = parseRow(appointmentSchema, transitioned, 'appointment')
    await db.appointment.put(parsed)
    return parsed
  })
}

export async function rescheduleAppointment(
  id: string,
  options: RescheduleOptions,
): Promise<Appointment> {
  const now = options.now ?? new Date()
  return db.transaction('rw', db.appointment, async () => {
    const existing = await db.appointment.get(id)
    if (existing === undefined) {
      throw new Error(`Appointment ${id} does not exist.`)
    }
    const plan = planReschedule(existing, {
      newId: newId(),
      newScheduledAt: options.newScheduledAt,
      now,
    })
    if (plan.previous.cancelReason !== RESCHEDULE_CANCEL_REASON) {
      throw new Error('Reschedule planning produced an unexpected cancel reason.')
    }
    const previous = parseRow(appointmentSchema, plan.previous, 'appointment')
    const next = parseRow(appointmentSchema, plan.next, 'appointment')
    await db.appointment.bulkPut([previous, next])
    return next
  })
}
