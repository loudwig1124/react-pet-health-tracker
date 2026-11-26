import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { validateHealthRecordDraft } from '@/lib/rules/health-records'

import { db } from '../db'
import {
  appendHealthRecord,
  deleteHealthRecord,
  listHealthRecordsForPet,
  updateHealthRecord,
} from '../repositories/health-records'
import { createPet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-03-02T10:00:00.000Z')

function draft(petId: string, overrides: Record<string, unknown> = {}) {
  return {
    petId,
    recordedOn: '2026-03-01',
    condition: 'Otitis externa (left ear)',
    diagnosis: 'Bacterial ear infection',
    treatment: 'Ear cleaning and antibiotic drops for 10 days',
    prescribedMedication: 'Ofloxacin otic drops',
    vetName: 'Dr. Ana Cruz',
    ...overrides,
  }
}

describe('health-record corrections (R5 amended, owner decision C)', () => {
  it('corrects a misclicked diagnosis in place and keeps the audit columns', async () => {
    const pet = await createPet(makePetDraft())
    const note = await appendHealthRecord(draft(pet.id), NOW)

    const corrected = await updateHealthRecord(
      note.id,
      draft(pet.id, { diagnosis: 'Fungal ear infection', vetName: 'Dr. Ana Cruz' }),
    )

    expect(corrected.id).toBe(note.id)
    expect(corrected.createdAt).toBe(note.createdAt)
    expect(corrected.diagnosis).toBe('Fungal ear infection')

    const rows = await listHealthRecordsForPet(pet.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.diagnosis).toBe('Fungal ear infection')
  })

  it('rejects an edit that the draft rule rejects, leaving the row untouched', async () => {
    const pet = await createPet(makePetDraft())
    const note = await appendHealthRecord(draft(pet.id), NOW)

    // Neither condition nor diagnosis: the same rule that guards creation.
    const rejected = draft(pet.id, { condition: null, diagnosis: '   ' })
    expect(validateHealthRecordDraft(rejected).isValid).toBe(false)
    await expect(updateHealthRecord(note.id, rejected)).rejects.toThrow()

    const rows = await listHealthRecordsForPet(pet.id)
    expect(rows[0]?.condition).toBe('Otitis externa (left ear)')
  })

  it('deletes one note without touching the pet or its other notes', async () => {
    const pet = await createPet(makePetDraft())
    const keep = await appendHealthRecord(draft(pet.id), NOW)
    const remove = await appendHealthRecord(draft(pet.id, { recordedOn: '2026-02-01' }), NOW)

    await deleteHealthRecord(remove.id)

    expect(await db.health_record.get(remove.id)).toBeUndefined()
    expect(await db.pet.get(pet.id)).toBeDefined()
    const rows = await listHealthRecordsForPet(pet.id)
    expect(rows.map((row) => row.id)).toEqual([keep.id])
  })
})
