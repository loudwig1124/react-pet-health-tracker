import { describe, expect, it } from 'vitest'

import type { Appointment, Pet } from '@/lib/rules/types'

import {
  appointmentActionState,
  appointmentSortChange,
  appointmentVisitDays,
  bookingDefaults,
  filterAppointmentViewsByDay,
  filterAppointmentViewsByPet,
  isCancelReasonValid,
  isUpcomingAppointment,
  partitionAppointmentViews,
  sortAppointmentViews,
  terminalSummary,
  toAppointmentViews,
} from './appointments'
import { localDateTimeParts } from './format'

const NOW = new Date('2026-11-25T08:00:00.000Z')

function makePet(id: string, name: string): Pet {
  return {
    id,
    ownerId: 'owner',
    name,
    species: 'Dog',
    breed: null,
    sex: 'unknown',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function makeAppointment(
  id: string,
  scheduledAt: string,
  overrides: Partial<Appointment> = {},
): Appointment {
  return {
    id,
    petId: 'pet-bella',
    clinicName: 'Paws & Claws',
    purpose: 'Annual wellness check',
    scheduledAt,
    status: 'scheduled',
    completedAt: null,
    cancelReason: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

const pets = [makePet('pet-bella', 'Bella'), makePet('pet-miso', 'Miso')]

describe('R3 visit actions — the UI mirrors the shared state machine', () => {
  it('blocks no-show exactly at the scheduled instant and allows it one second later', () => {
    const scheduledAt = '2026-11-30T01:30:00.000Z'
    const appointment = makeAppointment('a1', scheduledAt)
    const atInstant = appointmentActionState(appointment, new Date(scheduledAt))
    expect(atInstant.canNoShow).toBe(false)
    expect(atInstant.noShowBlockMessage).toMatch(/after the appointment time/i)

    const oneSecondLater = appointmentActionState(
      appointment,
      new Date(new Date(scheduledAt).getTime() + 1000),
    )
    expect(oneSecondLater.canNoShow).toBe(true)
    expect(oneSecondLater.noShowBlockMessage).toBeNull()
  })

  it('offers complete/cancel/reschedule on a scheduled visit at any time', () => {
    const actions = appointmentActionState(makeAppointment('a1', '2026-12-01T01:30:00.000Z'), NOW)
    expect(actions).toMatchObject({
      isScheduled: true,
      canComplete: true,
      canCancel: true,
      canReschedule: true,
    })
  })

  it('offers no action at all once the visit is terminal', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as const) {
      expect(
        appointmentActionState(makeAppointment('a1', '2026-11-20T01:30:00.000Z', { status }), NOW),
      ).toEqual({
        isScheduled: false,
        canComplete: false,
        canCancel: false,
        canNoShow: false,
        canReschedule: false,
        noShowBlockMessage: null,
      })
    }
  })

  it('requires a non-blank cancellation reason', () => {
    expect(isCancelReasonValid('   ')).toBe(false)
    expect(isCancelReasonValid('')).toBe(false)
    expect(isCancelReasonValid(' Owner unwell ')).toBe(true)
  })

  it('summarises a closed visit without offering an edit', () => {
    expect(terminalSummary(makeAppointment('a', NOW.toISOString()))).toBeNull()
    expect(
      terminalSummary(
        makeAppointment('a', '2026-11-20T01:30:00.000Z', {
          status: 'completed',
          completedAt: '2026-11-20T03:00:00.000Z',
        }),
      ),
    ).toMatch(/^Completed /)
    expect(
      terminalSummary(
        makeAppointment('a', '2026-11-20T01:30:00.000Z', {
          status: 'cancelled',
          cancelReason: 'rescheduled',
        }),
      ),
    ).toBe('Cancelled — rescheduled')
    expect(
      terminalSummary(makeAppointment('a', '2026-11-20T01:30:00.000Z', { status: 'no_show' })),
    ).toBe('Recorded as a no-show')
  })
})

describe('appointments read model', () => {
  it('partitions into upcoming (scheduled + ahead) and history (everything else)', () => {
    const rows = [
      makeAppointment('future', '2026-11-30T01:30:00.000Z'),
      makeAppointment('missed', '2026-11-20T01:30:00.000Z'),
      makeAppointment('done-future', '2026-12-30T01:30:00.000Z', { status: 'completed' }),
    ]
    const views = toAppointmentViews(rows, pets, NOW)
    const { upcoming, past } = partitionAppointmentViews(views)
    expect(upcoming.map((view) => view.appointment.id)).toEqual(['future'])
    expect(past.map((view) => view.appointment.id).sort()).toEqual(['done-future', 'missed'])
    expect(isUpcomingAppointment(rows[0] as Appointment, NOW)).toBe(true)
  })

  it('renders a visit whose pet was deleted as Household', () => {
    const views = toAppointmentViews(
      [makeAppointment('a1', '2026-11-30T01:30:00.000Z', { petId: null })],
      pets,
      NOW,
    )
    expect(views[0]?.petLabel).toBe('Household')
  })

  it('filters by pet id and by local day, and lists marked days once', () => {
    const views = toAppointmentViews(
      [
        makeAppointment('a1', '2026-11-30T01:30:00.000Z'),
        makeAppointment('a2', '2026-11-30T06:30:00.000Z'),
        makeAppointment('a3', '2026-12-02T01:30:00.000Z', { petId: null }),
      ],
      pets,
      NOW,
    )
    expect(filterAppointmentViewsByPet(views, 'pet-bella')).toHaveLength(2)
    expect(filterAppointmentViewsByPet(views, null)).toHaveLength(3)
    expect(filterAppointmentViewsByPet(views, 'pet-nobody')).toHaveLength(0)
    const marked = appointmentVisitDays(views)
    expect(marked).toHaveLength(2)
    const day = marked[0] as string
    expect(filterAppointmentViewsByDay(views, day)).toHaveLength(2)
    expect(filterAppointmentViewsByDay(views, null)).toHaveLength(3)
  })

  it('sorts by when, pet, clinic and status deterministically', () => {
    const views = toAppointmentViews(
      [
        makeAppointment('a2', '2026-12-02T01:30:00.000Z', {
          petId: 'pet-miso',
          clinicName: 'Zoo Vets',
        }),
        makeAppointment('a1', '2026-11-30T01:30:00.000Z', {
          clinicName: 'Alpha Vets',
          status: 'completed',
        }),
        makeAppointment('a3', '2026-11-30T02:30:00.000Z', { petId: null }),
      ],
      pets,
      NOW,
    )
    const byWhen = sortAppointmentViews(views, 'when', 'asc')
    expect(byWhen.map((view) => view.appointment.id)).toEqual(['a1', 'a3', 'a2'])
    const byPet = sortAppointmentViews(views, 'pet', 'asc')
    expect(byPet.map((view) => view.petLabel)).toEqual(['Bella', 'Household', 'Miso'])
    const byClinic = sortAppointmentViews(views, 'clinic', 'asc')
    expect(byClinic.map((view) => view.appointment.clinicName)).toEqual([
      'Alpha Vets',
      'Paws & Claws',
      'Zoo Vets',
    ])
    const byStatus = sortAppointmentViews(views, 'status', 'asc')
    expect(byStatus.map((view) => view.appointment.status)).toEqual([
      'scheduled',
      'scheduled',
      'completed',
    ])
  })

  it('flips the active column and uses the segment default on a new column', () => {
    expect(appointmentSortChange('when', 'asc', 'when', 'asc')).toEqual({
      sort: 'when',
      dir: 'desc',
    })
    expect(appointmentSortChange('when', 'asc', 'clinic', 'asc')).toEqual({
      sort: 'clinic',
      dir: 'asc',
    })
  })

  it('books tomorrow at 09:30 local and round-trips a local date + time', () => {
    const defaults = bookingDefaults(NOW)
    expect(defaults.time).toBe('09:30')
    const parts = localDateTimeParts(
      new Date(
        Number(defaults.date.slice(0, 4)),
        Number(defaults.date.slice(5, 7)) - 1,
        Number(defaults.date.slice(8, 10)),
        9,
        30,
      ).toISOString(),
    )
    expect(parts).toEqual(defaults)
  })
})
