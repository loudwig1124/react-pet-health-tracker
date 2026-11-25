import { beforeEach, describe, expect, it } from 'vitest'

import { listJournal, createJournalEntry } from '@/lib/db/repositories/journal'
import { ensureOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { listVaccineTypes } from '@/lib/db/repositories/vaccine-types'
import { seedVaccineCatalog, VACCINE_TYPE_IDS } from '@/lib/db/seed/catalog'
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

describe('vaccine catalog', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
  })

  it('always seeds seven unique catalog rows, idempotently', async () => {
    await seedVaccineCatalog()
    await seedVaccineCatalog()
    const types = await listVaccineTypes()
    expect(types).toHaveLength(7)
    expect(types.map((type) => type.name)).toEqual([
      'Rabies',
      'DHPP',
      'Leptospirosis',
      'Bordetella',
      'FVRCP',
      'FeLV',
      'Deworming',
    ])
    expect(types.some((type) => type.id === VACCINE_TYPE_IDS.rabies)).toBe(true)
  })
})

describe('journal read model (R6/R10)', () => {
  beforeEach(async () => {
    await resetDatabaseForTests()
    await ensureOwner(NOW)
  })

  it('returns newest first and applies the limit after ordering', async () => {
    const pet = await createPet(petDraft, NOW)
    for (const [index, occurredAt] of [
      '2026-11-20T01:00:00.000Z',
      '2026-11-23T01:00:00.000Z',
      '2026-11-21T01:00:00.000Z',
    ].entries()) {
      await createJournalEntry(
        {
          petId: pet.id,
          kind: 'walk',
          occurredAt,
          note: `entry ${index}`,
          durationMinutes: 10,
        },
        NOW,
      )
    }

    const household = await listJournal()
    expect(household.map((row) => row.occurredAt)).toEqual([
      '2026-11-23T01:00:00.000Z',
      '2026-11-21T01:00:00.000Z',
      '2026-11-20T01:00:00.000Z',
    ])
    expect((await listJournal({ limit: 2 })).map((row) => row.occurredAt)).toEqual([
      '2026-11-23T01:00:00.000Z',
      '2026-11-21T01:00:00.000Z',
    ])
    expect(await listJournal({ petId: pet.id })).toHaveLength(3)
  })
})
