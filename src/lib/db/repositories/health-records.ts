/**
 * Health-record repository (R5, amended 2026-11-27).
 *
 * Notes were append-only; a misclicked diagnosis was therefore permanent. The
 * owner accepted corrections, so this module now also exposes `updateHealthRecord`
 * and `deleteHealthRecord`, and a Vitest suite asserts that exact surface — bulk
 * wipes stay forbidden, and deleting a pet still cascades to its notes.
 *
 * Corrections replace the row: there is no audit trail (ACCEPTANCE §5d).
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

export async function updateHealthRecord(
  id: string,
  draft: HealthRecordDraft,
): Promise<HealthRecord> {
  const parsed = parseRow(healthRecordDraftSchema, draft, 'health record draft')
  const existing = await db.health_record.get(id)
  if (existing === undefined) {
    throw new Error(`Health record ${id} does not exist.`)
  }
  const pet = await db.pet.get(parsed.petId)
  if (pet === undefined) {
    throw new Error(`Pet ${parsed.petId} does not exist.`)
  }
  const record = parseRow(
    healthRecordSchema,
    { ...existing, ...parsed, id: existing.id, createdAt: existing.createdAt },
    'health record',
  )
  await db.health_record.put(record)
  return record
}

/** Removes one note; the dialog asks first. */
export async function deleteHealthRecord(id: string): Promise<void> {
  await db.health_record.delete(id)
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
