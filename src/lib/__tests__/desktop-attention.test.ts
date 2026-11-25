import { describe, expect, it } from 'vitest'

import {
  computeHouseholdAttention,
  nextVisitDay,
  weekBounds,
  weekdayOfDateKey,
} from '@/lib/desktop/attention'
import { addDays, todayKey } from '@/lib/rules/calendar'
import type { Appointment, Pet, Vaccination } from '@/lib/rules/types'

function pet(id: string, name: string): Pet {
  return {
    id,
    ownerId: 'owner',
    name,
    species: 'Dog',
    breed: null,
    sex: 'unknown',
    dateOfBirth: '2020-01-01',
    weightKg: 10,
    microchip: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

let doseSequence = 0
function dose(input: {
  petId: string
  vaccineName: string
  vaccinationDate: string
  nextDueDate: string | null
  vaccineTypeId?: string | null
  createdAt?: string
}): Vaccination {
  doseSequence += 1
  return {
    id: `dose-${String(doseSequence).padStart(3, '0')}`,
    petId: input.petId,
    vaccineTypeId: input.vaccineTypeId ?? null,
    vaccineName: input.vaccineName,
    vaccinationDate: input.vaccinationDate,
    nextDueDate: input.nextDueDate,
    vetName: null,
    createdAt: input.createdAt ?? '2026-01-01T00:00:00.000Z',
  }
}

function appointment(input: {
  id: string
  petId: string | null
  day: string
  time?: string
  status?: Appointment['status']
}): Appointment {
  return {
    id: input.id,
    petId: input.petId,
    clinicName: 'Paws & Claws',
    purpose: 'Check-up',
    scheduledAt: new Date(`${input.day}T${input.time ?? '10:00'}:00`).toISOString(),
    status: input.status ?? 'scheduled',
    completedAt: null,
    cancelReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

const NOW = new Date(2026, 10, 25, 9, 0, 0) // Wednesday 25 Nov 2026, local.
const TODAY = todayKey(NOW)

describe('F1/F2 household counters (R1/R4, 05 F1/F2)', () => {
  it('counts pets by their worst current dose, and re-vaccination clears overdue', () => {
    const bella = pet('bella', 'Bella')
    const miso = pet('miso', 'Miso')
    const coco = pet('coco', 'Coco')

    const doses: Vaccination[] = [
      // Bella: the old dose is overdue, but the booster supersedes it (R1).
      dose({
        petId: 'bella',
        vaccineName: 'Rabies',
        vaccineTypeId: 'type-rabies',
        vaccinationDate: addDays(TODAY, -400),
        nextDueDate: addDays(TODAY, -35),
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      dose({
        petId: 'bella',
        vaccineName: 'Rabies',
        vaccineTypeId: 'type-rabies',
        vaccinationDate: addDays(TODAY, -10),
        nextDueDate: addDays(TODAY, 355),
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
      // Miso: one current dose, 35 days overdue.
      dose({
        petId: 'miso',
        vaccineName: 'FeLV',
        vaccineTypeId: 'type-felv',
        vaccinationDate: addDays(TODAY, -400),
        nextDueDate: addDays(TODAY, -35),
        createdAt: '2025-01-02T00:00:00.000Z',
      }),
      // Coco: due inside the 30-day window.
      dose({
        petId: 'coco',
        vaccineName: 'DHPP',
        vaccineTypeId: 'type-dhpp',
        vaccinationDate: addDays(TODAY, -355),
        nextDueDate: addDays(TODAY, 10),
        createdAt: '2025-01-03T00:00:00.000Z',
      }),
    ]

    const attention = computeHouseholdAttention({
      pets: [bella, miso, coco],
      doses,
      appointments: [],
      now: NOW,
      windowDays: 30,
    })

    expect(attention.petCount).toBe(3)
    // The re-vaccinated pet is not overdue; the counter uses the pet status.
    expect(attention.overduePets).toBe(1)
    expect(attention.dueSoonPets).toBe(1)
    expect(attention.attention.map((item) => [item.petName, item.status])).toEqual([
      ['Miso', 'overdue'],
      ['Coco', 'due_soon'],
    ])
    expect(attention.attention[0]?.phrase).toBe('35 days overdue')
    expect(attention.attention[1]?.phrase).toBe('due in 10 days')
    expect(attention.today).toBe(TODAY)
  })

  it('honours the due-soon window edges (14/15 days) from the settings value', () => {
    const edges = [pet('p14', 'Fourteen'), pet('p15', 'Fifteen')]
    const doses = [
      dose({
        petId: 'p14',
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -365),
        nextDueDate: addDays(TODAY, 14),
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      dose({
        petId: 'p15',
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -365),
        nextDueDate: addDays(TODAY, 15),
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
    ]

    const attention = computeHouseholdAttention({
      pets: edges,
      doses,
      appointments: [],
      now: NOW,
      windowDays: 14,
    })
    expect(attention.dueSoonPets).toBe(1)
    expect(attention.attention.map((item) => item.petName)).toEqual(['Fourteen'])
  })

  it('counts today’s visits and the Monday–Sunday week, ignoring closed visits', () => {
    const week = weekBounds(TODAY)
    expect(weekdayOfDateKey(week.start)).toBe(1) // Monday
    expect(weekdayOfDateKey(week.end)).toBe(0) // Sunday
    expect(week.end).toBe(endOfWeek(week.start))

    const pets = [pet('bella', 'Bella')]
    const appointments: Appointment[] = [
      appointment({ id: 'today-1', petId: 'bella', day: TODAY, time: '10:00' }),
      appointment({ id: 'today-2', petId: 'bella', day: TODAY, time: '14:00' }),
      appointment({ id: 'tomorrow', petId: 'bella', day: addDays(TODAY, 1) }),
      appointment({
        id: 'closed-today',
        petId: 'bella',
        day: TODAY,
        status: 'completed',
      }),
      appointment({ id: 'last-sunday', petId: 'bella', day: addDays(week.start, -1) }),
    ]

    const attention = computeHouseholdAttention({
      pets,
      doses: [],
      appointments,
      now: NOW,
      windowDays: 30,
    })

    expect(attention.todayVisits).toBe(2)
    // today 10:00 + 14:00 + tomorrow; the completed and last-Sunday rows never count.
    expect(attention.visitsThisWeek).toBe(3)
  })

  it('reads an empty household as four zeros (the first-run dashboard state)', () => {
    const attention = computeHouseholdAttention({
      pets: [],
      doses: [],
      appointments: [],
      now: NOW,
      windowDays: 30,
    })
    expect(attention).toMatchObject({
      petCount: 0,
      overduePets: 0,
      dueSoonPets: 0,
      todayVisits: 0,
      visitsThisWeek: 0,
      attention: [],
    })
  })

  it('lists only current doses: a superseded overdue history row never re-enters the rail', () => {
    const bella = pet('bella', 'Bella')
    const doses = [
      dose({
        petId: 'bella',
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -400),
        nextDueDate: addDays(TODAY, -35),
        createdAt: '2025-01-01T00:00:00.000Z',
      }),
      dose({
        petId: 'bella',
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -5),
        nextDueDate: addDays(TODAY, 360),
        createdAt: '2026-02-01T00:00:00.000Z',
      }),
    ]
    const attention = computeHouseholdAttention({
      pets: [bella],
      doses,
      appointments: [],
      now: NOW,
      windowDays: 30,
    })
    expect(attention.attention).toEqual([])
    expect(attention.overduePets).toBe(0)
  })
})

function endOfWeek(start: string): string {
  return addDays(start, 6)
}

describe('next visit (03 §3)', () => {
  const pets = [pet('bella', 'Bella'), pet('miso', 'Miso')]

  it('returns every visit on the earliest upcoming day, after the current instant', () => {
    const appointments = [
      appointment({ id: 'past-today', petId: 'bella', day: TODAY, time: '08:00' }),
      appointment({ id: 'later-today-b', petId: 'miso', day: TODAY, time: '11:00' }),
      appointment({ id: 'later-today-a', petId: 'bella', day: TODAY, time: '10:00' }),
      appointment({ id: 'tomorrow', petId: 'bella', day: addDays(TODAY, 1) }),
      appointment({ id: 'deleted-pet', petId: null, day: TODAY, time: '12:00' }),
      appointment({
        id: 'closed-today',
        petId: 'bella',
        day: TODAY,
        time: '13:00',
        status: 'completed',
      }),
    ]

    const next = nextVisitDay(appointments, pets, NOW)
    expect(next?.day).toBe(TODAY)
    expect(next?.visits.map((visit) => visit.appointment.id)).toEqual([
      'later-today-a',
      'later-today-b',
      'deleted-pet',
    ])
    expect(next?.visits.map((visit) => visit.petLabel)).toEqual(['Bella', 'Miso', 'Household'])
  })

  it('is null when nothing is scheduled ahead', () => {
    expect(
      nextVisitDay(
        [appointment({ id: 'past', petId: 'bella', day: addDays(TODAY, -1) })],
        pets,
        NOW,
      ),
    ).toBeNull()
  })
})
