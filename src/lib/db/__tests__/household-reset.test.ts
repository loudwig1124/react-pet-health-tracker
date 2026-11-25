import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '../db'
import { createAppointment } from '../repositories/appointments'
import { appendHealthRecord } from '../repositories/health-records'
import { resetHousehold } from '../repositories/household'
import { createJournalEntry } from '../repositories/journal'
import { getOwner, saveOwner } from '../repositories/owners'
import { createPet } from '../repositories/pets'
import { appendVaccination } from '../repositories/vaccinations'
import { seedDemoHousehold } from '../seed'
import { clearSettingsCacheForTests, loadSettings, saveSettings } from '../settings'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-03-02T09:00:00.000Z')

beforeEach(() => {
  clearSettingsCacheForTests()
})

async function fillHousehold(): Promise<void> {
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
  await createAppointment(
    {
      petId: pet.id,
      clinicName: 'Paws & Claws Veterinary Clinic',
      purpose: 'Annual wellness check',
      scheduledAt: '2026-03-10T01:30:00.000Z',
    },
    NOW,
  )
}

describe('R8 reset household · deletes rows, keeps the owner by default', () => {
  it('accepts: a reset empties the store, keeps the typed owner and turns sample data off', async () => {
    await saveOwner({ name: 'Daniel', email: 'daniel@example.com', phone: '' }, NOW)
    await fillHousehold()
    saveSettings({ sampleDataEnabled: true })

    await resetHousehold({ forgetOwner: false }, NOW)

    expect(await db.pet.count()).toBe(0)
    expect(await db.journal_entry.count()).toBe(0)
    expect(await db.vaccination.count()).toBe(0)
    expect(await db.health_record.count()).toBe(0)
    expect(await db.appointment.count()).toBe(0)
    const owner = await getOwner()
    expect(owner?.name).toBe('Daniel')
    expect(owner?.email).toBe('daniel@example.com')
    expect(loadSettings().sampleDataEnabled).toBe(false)
  })

  it('accepts: "also forget my details" blanks the name and both contact fields', async () => {
    await saveOwner({ name: 'Daniel', email: 'daniel@example.com', phone: '0917 555 0100' }, NOW)
    await fillHousehold()

    await resetHousehold({ forgetOwner: true }, NOW)

    const owner = await getOwner()
    expect(owner?.name).toBe('My household')
    expect(owner?.email).toBe('')
    expect(owner?.phone).toBe('')
    expect(await db.pet.count()).toBe(0)
  })

  it('accepts: a reset removes a seeded demo household without touching the persona when keeping details', async () => {
    await seedDemoHousehold(NOW)
    expect(await db.pet.count()).toBe(2)

    await resetHousehold({ forgetOwner: false }, NOW)

    expect(await db.pet.count()).toBe(0)
    expect(await db.vaccination.count()).toBe(0)
    expect(await db.health_record.count()).toBe(0)
    expect(await db.appointment.count()).toBe(0)
    expect(await db.journal_entry.count()).toBe(0)
    // Only the "forget" checkbox blanks the owner; reset does not restore by accident.
    expect((await getOwner())?.name).toBe('Maria Santos')
  })
})
