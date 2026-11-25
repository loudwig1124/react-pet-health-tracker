import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import {
  HEALTH_RECORD_FORBIDDEN_OPERATIONS,
  HEALTH_RECORD_REPOSITORY_OPERATIONS,
} from '@/lib/rules/health-records'

import { db } from '../db'
import * as healthRecordRepository from '../repositories/health-records'
import { appendHealthRecord, listHealthRecordsForPet } from '../repositories/health-records'
import { createPet, deletePet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-03-02T10:00:00.000Z')

function recordDraft(petId: string, overrides: Record<string, unknown> = {}) {
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

describe('R5 append-only · repository export surface', () => {
  it('accepts: the module exports exactly the read and append operations', () => {
    expect(Object.keys(healthRecordRepository).sort()).toEqual(
      [...HEALTH_RECORD_REPOSITORY_OPERATIONS].sort(),
    )
    expect(typeof healthRecordRepository.listHealthRecordsForPet).toBe('function')
    expect(typeof healthRecordRepository.appendHealthRecord).toBe('function')
  })

  it('rejects: no update/delete/clear export can appear', () => {
    const exported = Object.keys(healthRecordRepository)
    for (const forbidden of HEALTH_RECORD_FORBIDDEN_OPERATIONS) {
      expect(exported).not.toContain(forbidden)
    }
    expect(exported.some((name) => /update|delete|remove|clear/i.test(name))).toBe(false)
  })
})

describe('R5 append-only · append and read', () => {
  it('accepts: a clinical note is appended and listed newest first', async () => {
    const pet = await createPet(makePetDraft())
    const earlier = await appendHealthRecord(recordDraft(pet.id), NOW)
    const later = await appendHealthRecord(
      recordDraft(pet.id, {
        recordedOn: '2026-03-02',
        condition: 'Healthy annual exam',
        diagnosis: null,
      }),
      new Date('2026-03-03T10:00:00.000Z'),
    )

    const rows = await listHealthRecordsForPet(pet.id)
    expect(rows.map((row) => row.id)).toEqual([later.id, earlier.id])
    expect(rows[0]?.condition).toBe('Healthy annual exam')
    expect(rows[1]?.condition).toBe('Otitis externa (left ear)')
  })

  it('rejects: a note with neither condition nor diagnosis is never stored', async () => {
    const pet = await createPet(makePetDraft())
    await expect(
      appendHealthRecord(recordDraft(pet.id, { condition: null, diagnosis: '   ' }), NOW),
    ).rejects.toThrow(/condition|diagnosis/i)
    await expect(db.health_record.count()).resolves.toBe(0)
  })

  it('rejects: appending to a missing pet', async () => {
    await expect(appendHealthRecord(recordDraft('demo-pet-missing'), NOW)).rejects.toThrow(
      /does not exist/,
    )
  })
})

describe('R5 append-only · only deletion is the pet cascade', () => {
  it('accepts: deleting a pet removes its clinical notes', async () => {
    const pet = await createPet(makePetDraft())
    const kept = await createPet(
      makePetDraft({ name: 'Miso', species: 'Cat', microchip: '900215004999999' }),
    )
    await appendHealthRecord(recordDraft(pet.id), NOW)
    await appendHealthRecord(recordDraft(kept.id), NOW)

    await deletePet(pet.id)

    expect(await listHealthRecordsForPet(pet.id)).toEqual([])
    expect((await listHealthRecordsForPet(kept.id)).length).toBe(1)
    expect(await db.health_record.count()).toBe(1)
  })
})
