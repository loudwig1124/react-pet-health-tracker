import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db/db'
import {
  createAppointment,
  getAppointment,
  listHistoryAppointments,
  listUpcomingAppointments,
  rescheduleAppointment,
  updateAppointmentStatus,
} from '@/lib/db/repositories/appointments'
import { ensureOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { AppointmentRuleException } from '@/lib/rules/appointment-fsm'
import type { PetDraft } from '@/lib/rules/types'
import { resetDatabaseForTests } from '@/test/db-utils'

const NOW = new Date('2026-11-25T04:00:00.000Z')

const petDraft: PetDraft = {
  name: 'Nova',
  species: 'Dog',
  breed: null,
  sex: 'male',
  dateOfBirth: '2023-03-12',
  weightKg: 8.5,
  microchip: null,
}

async function booked(scheduledAt = '2026-11-26T01:30:00.000Z') {
  const pet = await createPet(petDraft, NOW)
  return createAppointment(
    { petId: pet.id, clinicName: 'Paws & Claws', purpose: 'Wellness', scheduledAt },
    NOW,
  )
}

describe('appointments repository — R3 state machine', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(NOW)
  })

  it('completes with completedAt and rejects a second transition', async () => {
    const appointment = await booked()
    const completed = await updateAppointmentStatus(appointment.id, 'completed', { now: NOW })
    expect(completed.status).toBe('completed')
    expect(completed.completedAt).not.toBeNull()
    expect(completed.cancelReason).toBeNull()

    await expect(
      updateAppointmentStatus(appointment.id, 'cancelled', {
        now: NOW,
        cancelReason: 'Too late',
      }),
    ).rejects.toBeInstanceOf(AppointmentRuleException)
  })

  it('blocks no-show at the scheduled instant and allows it one second later', async () => {
    const scheduledAt = new Date('2026-11-25T04:00:00.000Z')
    const appointment = await booked(scheduledAt.toISOString())

    await expect(
      updateAppointmentStatus(appointment.id, 'no_show', { now: scheduledAt }),
    ).rejects.toBeInstanceOf(AppointmentRuleException)

    const later = new Date(scheduledAt.getTime() + 1000)
    const noShow = await updateAppointmentStatus(appointment.id, 'no_show', { now: later })
    expect(noShow.status).toBe('no_show')
    expect(noShow.completedAt).toBeNull()
    expect(noShow.cancelReason).toBeNull()
  })

  it('requires a non-blank cancellation reason', async () => {
    const appointment = await booked()
    await expect(
      updateAppointmentStatus(appointment.id, 'cancelled', { now: NOW, cancelReason: '   ' }),
    ).rejects.toBeInstanceOf(AppointmentRuleException)

    const cancelled = await updateAppointmentStatus(appointment.id, 'cancelled', {
      now: NOW,
      cancelReason: 'Vet unavailable',
    })
    expect(cancelled.cancelReason).toBe('Vet unavailable')
    expect(cancelled.completedAt).toBeNull()
  })

  it('reschedules atomically: old row cancelled as "rescheduled", new row inserted', async () => {
    const appointment = await booked()
    const next = await rescheduleAppointment(appointment.id, {
      newScheduledAt: '2026-12-02T02:00:00.000Z',
      now: NOW,
    })

    const previous = await getAppointment(appointment.id)
    expect(previous?.status).toBe('cancelled')
    expect(previous?.cancelReason).toBe('rescheduled')
    expect(next.status).toBe('scheduled')
    expect(next.id).not.toBe(appointment.id)
    expect(next.scheduledAt).toBe('2026-12-02T02:00:00.000Z')
    expect(await db.appointment.count()).toBe(2)
  })

  it('splits upcoming from history at now', async () => {
    await booked('2026-12-01T01:30:00.000Z')
    const past = await booked('2026-11-01T01:30:00.000Z')
    await updateAppointmentStatus(past.id, 'completed', { now: NOW })

    const upcoming = await listUpcomingAppointments({ now: NOW })
    const history = await listHistoryAppointments({ now: NOW })
    expect(upcoming).toHaveLength(1)
    expect(upcoming[0]?.scheduledAt).toBe('2026-12-01T01:30:00.000Z')
    expect(history.map((row) => row.id)).toContain(past.id)
  })
})

describe('db schema indexes', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
  })

  it('declares v1 with seven stores and the documented indexes', () => {
    expect(db.verno).toBe(1)
    expect(db.tables.map((table) => table.name).sort()).toEqual([
      'appointment',
      'health_record',
      'journal_entry',
      'owner',
      'pet',
      'vaccination',
      'vaccine_type',
    ])

    const indexNames = (tableName: string): string[] =>
      db.table(tableName).schema.indexes.map((index) => index.name)
    const unique = (tableName: string, indexName: string): boolean =>
      db.table(tableName).schema.indexes.some((index) => index.name === indexName && index.unique)

    expect(indexNames('pet')).toContain('microchip')
    expect(unique('pet', 'microchip')).toBe(true)
    expect(indexNames('vaccine_type')).toContain('name')
    expect(unique('vaccine_type', 'name')).toBe(true)
    expect(indexNames('journal_entry')).toContain('[petId+occurredAt]')
    expect(indexNames('health_record')).toContain('[petId+recordedOn]')
    expect(indexNames('vaccination')).toContain('[petId+vaccinationDate]')
    expect(indexNames('appointment')).toContain('scheduledAt')
    expect(indexNames('vaccination')).toContain('nextDueDate')
  })
})
