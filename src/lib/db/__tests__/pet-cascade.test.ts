import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { db } from '../db'
import { createAppointment, getAppointment } from '../repositories/appointments'
import { appendHealthRecord } from '../repositories/health-records'
import { createJournalEntry } from '../repositories/journal'
import { createPet, deletePet, getPet, listPets, updatePet } from '../repositories/pets'
import { appendVaccination } from '../repositories/vaccinations'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-03-02T09:00:00.000Z')

describe('R9 repository · validation runs before any write', () => {
  it('rejects: a blank name or duplicate microchip never reaches the pet table', async () => {
    await expect(createPet(makePetDraft({ name: '   ' }), NOW)).rejects.toThrow(/Invalid pet/)
    expect(await db.pet.count()).toBe(0)

    await createPet(makePetDraft(), NOW)
    await expect(createPet(makePetDraft({ name: 'Miso', species: 'Cat' }), NOW)).rejects.toThrow(
      /already registered/,
    )
    expect(await db.pet.count()).toBe(1)
  })

  it('rejects: editing one pet onto another pet’s microchip', async () => {
    const first = await createPet(makePetDraft(), NOW)
    const second = await createPet(
      makePetDraft({ name: 'Miso', species: 'Cat', microchip: '900215004999999' }),
      NOW,
    )
    await expect(
      updatePet(second.id, makePetDraft({ name: 'Miso', species: 'Cat' }), NOW),
    ).rejects.toThrow(/already registered/)
    expect((await getPet(second.id))?.microchip).toBe('900215004999999')
    expect((await getPet(first.id))?.microchip).toBe('900215004123456')
  })

  it('rejects: out-of-bounds weight and an impossible birthday', async () => {
    await expect(createPet(makePetDraft({ weightKg: 301 }), NOW)).rejects.toThrow(/Invalid pet/)
    await expect(createPet(makePetDraft({ dateOfBirth: '2030-01-01' }), NOW)).rejects.toThrow(
      /Invalid pet/,
    )
    expect(await db.pet.count()).toBe(0)
  })
})

describe('R5 cascade · deleting a pet keeps its appointments as Household', () => {
  it('accepts: journal, vaccinations and clinical notes go; the visit survives as petId null', async () => {
    const kept = await createPet(
      makePetDraft({ name: 'Miso', species: 'Cat', microchip: '900215004999999' }),
      NOW,
    )
    const pet = await createPet(makePetDraft(), NOW)
    await createJournalEntry(
      {
        petId: pet.id,
        kind: 'walk',
        occurredAt: NOW.toISOString(),
        note: null,
        durationMinutes: null,
      },
      NOW,
    )
    await appendVaccination(
      {
        petId: pet.id,
        vaccineTypeId: null,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-01-01',
        nextDueDate: '2027-01-01',
        vetName: null,
      },
      NOW,
    )
    await appendHealthRecord(
      {
        petId: pet.id,
        recordedOn: '2026-02-01',
        condition: 'Otitis externa',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
      },
      NOW,
    )
    const appointment = await createAppointment(
      {
        petId: pet.id,
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Annual wellness check',
        scheduledAt: '2026-03-10T01:30:00.000Z',
      },
      NOW,
    )
    // A visit and a record for the other pet must survive untouched.
    await createAppointment(
      {
        petId: kept.id,
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Dental cleaning',
        scheduledAt: '2026-03-11T01:30:00.000Z',
      },
      NOW,
    )

    await deletePet(pet.id, NOW)

    expect((await listPets()).map((row) => row.id)).toEqual([kept.id])
    expect(await db.journal_entry.where('petId').equals(pet.id).count()).toBe(0)
    expect(await db.vaccination.where('petId').equals(pet.id).count()).toBe(0)
    expect(await db.health_record.where('petId').equals(pet.id).count()).toBe(0)
    const householdVisit = await getAppointment(appointment.id)
    expect(householdVisit?.petId).toBeNull()
    expect(await db.appointment.where('petId').equals(kept.id).count()).toBe(1)
    expect(await db.journal_entry.where('petId').equals(kept.id).count()).toBe(0)
  })
})
