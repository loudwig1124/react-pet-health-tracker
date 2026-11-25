import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { AppointmentRuleException, RESCHEDULE_CANCEL_REASON } from '@/lib/rules/appointment-fsm'

import { db } from '../db'
import {
  createAppointment,
  getAppointment,
  listHistoryAppointments,
  listUpcomingAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from '../repositories/appointments'
import { createPet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-11-25T08:00:00.000Z')
const SCHEDULED_AT = new Date('2026-11-30T01:30:00.000Z')
const NEW_SCHEDULED_AT = new Date('2026-12-05T02:00:00.000Z')

async function seedVisit(): Promise<string> {
  const pet = await createPet(makePetDraft())
  const appointment = await createAppointment(
    {
      petId: pet.id,
      clinicName: 'Paws & Claws Veterinary Clinic',
      purpose: 'Annual wellness check',
      scheduledAt: SCHEDULED_AT.toISOString(),
    },
    NOW,
  )
  return appointment.id
}

describe('R3 repository · status writes re-check the machine', () => {
  it('accepts: completion happens only after the machine allows it', async () => {
    const id = await seedVisit()
    const completed = await updateAppointmentStatus(id, 'completed', {
      now: new Date('2026-11-30T03:00:00.000Z'),
    })
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).toBe('2026-11-30T03:00:00.000Z')
    expect(completed.cancelReason).toBeNull()
  })

  it('rejects: a no-show exactly at the scheduled time (allowed one millisecond later)', async () => {
    const id = await seedVisit()
    const atInstant = new Date(SCHEDULED_AT.getTime())
    await expect(updateAppointmentStatus(id, 'no_show', { now: atInstant })).rejects.toThrow(
      AppointmentRuleException,
    )
    expect((await getAppointment(id))?.status).toBe('scheduled')

    const after = new Date(SCHEDULED_AT.getTime() + 1)
    const updated = await updateAppointmentStatus(id, 'no_show', { now: after })
    expect(updated.status).toBe('no_show')
    expect(updated.completedAt).toBeNull()
    expect(updated.cancelReason).toBeNull()
  })

  it('rejects: blank cancel reasons and terminal re-transitions leave the row unchanged', async () => {
    const id = await seedVisit()
    await expect(
      updateAppointmentStatus(id, 'cancelled', { now: NOW, cancelReason: '   ' }),
    ).rejects.toThrow(AppointmentRuleException)
    expect((await getAppointment(id))?.status).toBe('scheduled')

    const cancelled = await updateAppointmentStatus(id, 'cancelled', {
      now: NOW,
      cancelReason: '  Clinic closed  ',
    })
    expect(cancelled.cancelReason).toBe('Clinic closed')
    expect(cancelled.completedAt).toBeNull()

    await expect(updateAppointmentStatus(id, 'completed', { now: NOW })).rejects.toThrow(
      AppointmentRuleException,
    )
    expect((await getAppointment(id))?.status).toBe('cancelled')
    expect((await getAppointment(id))?.completedAt).toBeNull()
  })
})

describe('R3 repository · reschedule is atomic', () => {
  it('accepts: cancel(rescheduled) and the new scheduled row are written together', async () => {
    const id = await seedVisit()
    const original = await getAppointment(id)
    expect(original).toBeDefined()

    const next = await rescheduleAppointment(id, {
      newScheduledAt: NEW_SCHEDULED_AT,
      now: NOW,
    })

    expect(next.id).not.toBe(id)
    expect(next.status).toBe('scheduled')
    expect(next.scheduledAt).toBe(NEW_SCHEDULED_AT.toISOString())
    expect(next.petId).toBe(original?.petId)
    expect(next.clinicName).toBe(original?.clinicName)
    expect(next.purpose).toBe(original?.purpose)

    const previous = await getAppointment(id)
    expect(previous?.status).toBe('cancelled')
    expect(previous?.cancelReason).toBe(RESCHEDULE_CANCEL_REASON)
    expect(previous?.completedAt).toBeNull()
    expect(await db.appointment.count()).toBe(2)

    expect((await listUpcomingAppointments({ now: NOW })).map((row) => row.id)).toEqual([next.id])
    expect((await listHistoryAppointments({ now: NOW })).map((row) => row.id)).toEqual([id])
  })

  it('rejects: rescheduling a closed visit writes neither row (no half state)', async () => {
    const id = await seedVisit()
    await updateAppointmentStatus(id, 'completed', { now: NOW })

    await expect(
      rescheduleAppointment(id, { newScheduledAt: NEW_SCHEDULED_AT, now: NOW }),
    ).rejects.toThrow(AppointmentRuleException)

    expect(await db.appointment.count()).toBe(1)
    const unchanged = await getAppointment(id)
    expect(unchanged?.status).toBe('completed')
    expect(unchanged?.completedAt).toBe(NOW.toISOString())
    expect(await db.appointment.where('status').equals('scheduled').count()).toBe(0)
  })

  it('rejects: rescheduling a missing row', async () => {
    await expect(
      rescheduleAppointment('missing-appointment', { newScheduledAt: NEW_SCHEDULED_AT, now: NOW }),
    ).rejects.toThrow(/does not exist/)
    expect(await db.appointment.count()).toBe(0)
  })

  it('accepts: rescheduling a household-level visit keeps petId null', async () => {
    const appointment = await createAppointment(
      {
        petId: null,
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Household visit',
        scheduledAt: SCHEDULED_AT.toISOString(),
      },
      NOW,
    )
    const next = await rescheduleAppointment(appointment.id, {
      newScheduledAt: NEW_SCHEDULED_AT,
      now: NOW,
    })
    expect(next.petId).toBeNull()
    expect((await getAppointment(appointment.id))?.petId).toBeNull()
  })
})
