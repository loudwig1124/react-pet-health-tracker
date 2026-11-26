import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { petVaccinationDueStatus } from '@/lib/rules/vaccination-due'

import { db } from '../db'
import {
  appendVaccination,
  deleteVaccination,
  listVaccinationsForPet,
  updateVaccination,
} from '../repositories/vaccinations'
import { createPet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const TODAY = '2026-11-27'

async function seedDose(overrides: { vaccinationDate: string; nextDueDate: string | null }) {
  const pet = await createPet(makePetDraft())
  const dose = await appendVaccination({
    petId: pet.id,
    vaccineTypeId: 'vaccine-rabies',
    vaccineName: 'Rabies',
    vaccinationDate: overrides.vaccinationDate,
    nextDueDate: overrides.nextDueDate,
    vetName: null,
  })
  return { petId: pet.id, dose }
}

describe('vaccination corrections (owner decision A, 2026-11-27)', () => {
  it('corrects a misclicked next-due date and re-derives the status through R1', async () => {
    // A typo leaves the dose overdue by 30 days.
    const { petId, dose } = await seedDose({
      vaccinationDate: '2025-10-28',
      nextDueDate: '2025-12-28',
    })
    const before = petVaccinationDueStatus(await listVaccinationsForPet(petId), TODAY, 30)
    expect(before).toBe('overdue')

    // Correcting the year fixes both the row and every derived status.
    const updated = await updateVaccination(dose.id, {
      petId,
      vaccineTypeId: 'vaccine-rabies',
      vaccineName: 'Rabies',
      vaccinationDate: '2026-10-28',
      nextDueDate: '2027-10-28',
      vetName: null,
    })
    expect(updated.id).toBe(dose.id)
    expect(updated.createdAt).toBe(dose.createdAt)

    const after = petVaccinationDueStatus(await listVaccinationsForPet(petId), TODAY, 30)
    expect(after).toBe('up_to_date')
  })

  it('rejects an edit that the create rule would reject', async () => {
    const { petId, dose } = await seedDose({
      vaccinationDate: '2026-01-10',
      nextDueDate: '2027-01-10',
    })
    await expect(
      updateVaccination(dose.id, {
        petId,
        vaccineTypeId: 'vaccine-rabies',
        vaccineName: 'Rabies',
        vaccinationDate: '2026-01-10',
        nextDueDate: '2025-01-10',
        vetName: null,
      }),
    ).rejects.toThrow()
    // The stored row is untouched by the failed write.
    const rows = await listVaccinationsForPet(petId)
    expect(rows[0]?.nextDueDate).toBe('2027-01-10')
  })

  it('deletes a dose and keeps the pet history consistent', async () => {
    const pet = await createPet(makePetDraft())
    const dose = await appendVaccination({
      petId: pet.id,
      vaccineTypeId: 'vaccine-rabies',
      vaccineName: 'Rabies',
      vaccinationDate: '2026-01-10',
      nextDueDate: '2027-01-10',
      vetName: null,
    })
    await deleteVaccination(dose.id)
    expect(await db.vaccination.get(dose.id)).toBeUndefined()
    expect(await listVaccinationsForPet(pet.id)).toHaveLength(0)
  })
})
