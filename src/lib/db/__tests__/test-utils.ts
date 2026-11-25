/**
 * Shared helpers for the db-layer/rules integration suites (R5, R6, R7/R8, R10).
 *
 * `fake-indexeddb/auto` must be installed before `db.ts` is imported, so it is
 * the first import here. Tests run one file per worker, so the singleton Dexie
 * connection is safe; each test clears the stores instead of deleting the DB.
 */

import 'fake-indexeddb/auto'
import { beforeEach } from 'vitest'

import type { PetDraft } from '@/lib/rules/types'

import { db } from '../db'

export async function openTestDb(): Promise<void> {
  if (!db.isOpen()) {
    await db.open()
  }
}

export async function resetTables(): Promise<void> {
  await openTestDb()
  await Promise.all(db.tables.map((table) => table.clear()))
}

/** Registers the per-test store reset; call once at module scope. */
export function resetDatabaseBeforeEach(): void {
  beforeEach(async () => {
    await resetTables()
  })
}

export function makePetDraft(overrides: Partial<PetDraft> = {}): PetDraft {
  return {
    name: 'Bella',
    species: 'Dog',
    breed: 'Golden Retriever mix',
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip: '900215004123456',
    ...overrides,
  }
}
