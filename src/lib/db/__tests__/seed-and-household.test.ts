import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db/db'
import { appendHealthRecord, listHealthRecordsForPet } from '@/lib/db/repositories/health-records'
import * as healthRecordsModule from '@/lib/db/repositories/health-records'
import { resetHousehold } from '@/lib/db/repositories/household'
import { createJournalEntry } from '@/lib/db/repositories/journal'
import { ensureOwner, getOwner } from '@/lib/db/repositories/owners'
import { createPet, deletePet, getPet } from '@/lib/db/repositories/pets'
import { appendVaccination } from '@/lib/db/repositories/vaccinations'
import { clearDemoHousehold, seedDemoHousehold } from '@/lib/db/seed/demo'
import {
  assertStrictlyIncreasingCreatedAt,
  demoAppointmentIds,
  demoHealthRecordIds,
  demoJournalEntryIds,
  demoPetIds,
  demoVaccinationIds,
} from '@/lib/rules/demo-ownership'
import type { PetDraft } from '@/lib/rules/types'
import { resetDatabaseForTests } from '@/test/db-utils'

const SEED_NOW = new Date('2026-11-25T04:00:00.000Z')

const petDraft = (overrides: Partial<PetDraft> = {}): PetDraft => ({
  name: 'Nova',
  species: 'Dog',
  breed: null,
  sex: 'male',
  dateOfBirth: '2023-03-12',
  weightKg: 8.5,
  microchip: null,
  ...overrides,
})

describe('demo seed (R7)', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(SEED_NOW)
  })

  it('inserts exactly the fixed demo ids with strictly increasing createdAt', async () => {
    const seeded = await seedDemoHousehold(SEED_NOW)
    expect(seeded).toBe(true)

    const pets = await db.pet
      .where('id')
      .anyOf([...demoPetIds])
      .toArray()
    const vaccinations = await db.vaccination
      .where('id')
      .anyOf([...demoVaccinationIds])
      .toArray()
    const records = await db.health_record
      .where('id')
      .anyOf([...demoHealthRecordIds])
      .toArray()
    const appointments = await db.appointment
      .where('id')
      .anyOf([...demoAppointmentIds])
      .toArray()
    const journal = await db.journal_entry
      .where('id')
      .anyOf([...demoJournalEntryIds])
      .toArray()

    expect(pets.map((row) => row.id).sort()).toEqual([...demoPetIds].sort())
    expect(vaccinations).toHaveLength(demoVaccinationIds.length)
    expect(records).toHaveLength(demoHealthRecordIds.length)
    expect(appointments).toHaveLength(demoAppointmentIds.length)
    expect(journal).toHaveLength(demoJournalEntryIds.length)

    // Idb returns primary-key order, not insertion order; sort by the stored
    // instant before asserting the seeder's strict sequence.
    const seededRows = [...pets, ...vaccinations, ...records, ...appointments, ...journal].sort(
      (a, b) => a.createdAt.localeCompare(b.createdAt),
    )
    assertStrictlyIncreasingCreatedAt(seededRows)
    expect(new Set(seededRows.map((row) => row.createdAt)).size).toBe(seededRows.length)

    const owner = await getOwner()
    expect(owner?.name).toBe('Maria Santos')
  })

  it('is idempotent and only ever owns the listed rows', async () => {
    await seedDemoHousehold(SEED_NOW)
    const second = await seedDemoHousehold(SEED_NOW)
    expect(second).toBe(false)
    expect(await db.pet.count()).toBe(2)
    expect(await db.vaccination.count()).toBe(4)
  })

  it('clearing removes exactly the demo rows and keeps user rows (bug D1)', async () => {
    await seedDemoHousehold(SEED_NOW)
    const mine = await createPet(petDraft({ name: 'Pixel', microchip: '123456789' }), SEED_NOW)
    await createJournalEntry(
      {
        petId: mine.id,
        kind: 'walk',
        occurredAt: SEED_NOW.toISOString(),
        note: 'user entry',
        durationMinutes: 20,
      },
      SEED_NOW,
    )

    await clearDemoHousehold(SEED_NOW)

    expect(await db.pet.count()).toBe(1)
    expect((await getPet(mine.id))?.name).toBe('Pixel')
    expect(await db.journal_entry.where('petId').equals(mine.id).count()).toBe(1)
    expect(
      await db.pet
        .where('id')
        .anyOf([...demoPetIds])
        .count(),
    ).toBe(0)
    expect(await db.vaccination.count()).toBe(0)
    expect((await getOwner())?.name).toBe('My household')
  })
})

describe('pet cascade (02 §3)', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(SEED_NOW)
  })

  it('deleting a pet removes its rows and turns its appointments into Household visits', async () => {
    const pet = await createPet(petDraft(), SEED_NOW)
    await createJournalEntry(
      {
        petId: pet.id,
        kind: 'fed',
        occurredAt: SEED_NOW.toISOString(),
        note: null,
        durationMinutes: null,
      },
      SEED_NOW,
    )
    await appendHealthRecord(
      {
        petId: pet.id,
        recordedOn: '2026-11-20',
        condition: 'Check-up',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
      },
      SEED_NOW,
    )
    await appendVaccination(
      {
        petId: pet.id,
        vaccineTypeId: null,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-01-09',
        nextDueDate: '2027-01-09',
        vetName: null,
      },
      SEED_NOW,
    )
    const { createAppointment } = await import('@/lib/db/repositories/appointments')
    const appointment = await createAppointment(
      {
        petId: pet.id,
        clinicName: 'Clinic',
        purpose: 'Check-up',
        scheduledAt: '2026-12-01T01:30:00.000Z',
      },
      SEED_NOW,
    )

    await deletePet(pet.id, SEED_NOW)

    expect(await getPet(pet.id)).toBeUndefined()
    expect(await db.journal_entry.where('petId').equals(pet.id).count()).toBe(0)
    expect(await db.health_record.where('petId').equals(pet.id).count()).toBe(0)
    expect(await db.vaccination.where('petId').equals(pet.id).count()).toBe(0)
    expect((await db.appointment.get(appointment.id))?.petId).toBeNull()
  })

  it('rejects a duplicate microchip before writing', async () => {
    await createPet(petDraft({ microchip: '900215004123456' }), SEED_NOW)
    await expect(
      createPet(petDraft({ name: 'Other', microchip: '900215004123456' }), SEED_NOW),
    ).rejects.toThrow(/already registered/)
  })
})

describe('health records are append-only (R5)', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(SEED_NOW)
  })

  it('exposes exactly a read and an append', () => {
    expect(Object.keys(healthRecordsModule).sort()).toEqual([
      'appendHealthRecord',
      'listHealthRecordsForPet',
    ])
  })

  it('lists newest first without any update/delete affordance', async () => {
    const pet = await createPet(petDraft(), SEED_NOW)
    await appendHealthRecord(
      {
        petId: pet.id,
        recordedOn: '2026-01-05',
        condition: 'Ear infection',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
      },
      new Date('2026-01-05T02:00:00.000Z'),
    )
    await appendHealthRecord(
      {
        petId: pet.id,
        recordedOn: '2026-03-05',
        condition: null,
        diagnosis: 'Allergy',
        treatment: null,
        prescribedMedication: null,
        vetName: null,
      },
      new Date('2026-03-05T02:00:00.000Z'),
    )
    const rows = await listHealthRecordsForPet(pet.id)
    expect(rows.map((row) => row.recordedOn)).toEqual(['2026-03-05', '2026-01-05'])
  })
})

describe('reset household (R8)', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(SEED_NOW)
  })

  it('keeps the owner name without the forget checkbox and clears every table', async () => {
    await seedDemoHousehold(SEED_NOW)
    await createPet(petDraft({ name: 'Pixel', microchip: '123456789' }), SEED_NOW)

    await resetHousehold({ forgetOwner: false }, SEED_NOW)

    expect(await db.pet.count()).toBe(0)
    expect(await db.appointment.count()).toBe(0)
    expect(await db.journal_entry.count()).toBe(0)
    expect(await db.vaccination.count()).toBe(0)
    expect(await db.health_record.count()).toBe(0)
    expect((await getOwner())?.name).toBe('Maria Santos')
  })

  it('blanks the owner when "also forget" is checked', async () => {
    await seedDemoHousehold(SEED_NOW)
    await resetHousehold({ forgetOwner: true }, SEED_NOW)
    expect((await getOwner())?.name).toBe('My household')
  })
})
