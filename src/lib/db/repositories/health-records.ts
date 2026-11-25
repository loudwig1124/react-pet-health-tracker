/**
 * Health-record repository — append-only by design (R5).
 *
 * This module intentionally exports only a read and an append: there is no
 * update, no delete and no UI affordance for either. The only deletion path in
 * the app is the pet-delete cascade and the household reset, both of which act
 * on whole pets/rows from their own repositories. A Vitest suite asserts this
 * export surface stays two functions.
 */
import type { HealthRecord, HealthRecordDraft } from '@/lib/rules/types'

import { db } from '../db'
import { healthRecordDraftSchema, healthRecordSchema, parseRow } from '../schema'
import { newId, toIsoInstant } from '../write-helpers'

function sortNewestFirst(records: HealthRecord[]): HealthRecord[] {
  return records.sort(
    (a, b) =>
      b.recordedOn.localeCompare(a.recordedOn) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  )
}

export async function listHealthRecordsForPet(petId: string): Promise<HealthRecord[]> {
  return sortNewestFirst(await db.health_record.where('petId').equals(petId).toArray())
}

export async function appendHealthRecord(
  draft: HealthRecordDraft,
  now: Date = new Date(),
): Promise<HealthRecord> {
  const parsed = parseRow(healthRecordDraftSchema, draft, 'health record draft')
  const pet = await db.pet.get(parsed.petId)
  if (pet === undefined) {
    throw new Error(`Pet ${parsed.petId} does not exist.`)
  }
  const record = parseRow(
    healthRecordSchema,
    { id: newId(), ...parsed, createdAt: toIsoInstant(now) },
    'health record',
  )
  await db.health_record.add(record)
  return record
}
