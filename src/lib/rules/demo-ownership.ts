/**
 * R7 — demo rows are owned by exact ids, never an id range.
 *
 * The Flutter bug (D1) deleted `id >= 9000`, which destroyed household rows
 * created after seeding. The React id spaces cannot collide — user rows use
 * UUIDs, demo rows literal `demo-*` ids — but ownership is still decided by
 * these fixed lists, never by a prefix test or a range. The `demo-*` prefix is
 * only a readability aid.
 *
 * Also carries the seed's deterministic `createdAt` contract (strictly
 * increasing, at most the seed instant) so same-millisecond ties cannot make
 * the newest-dose tie-break tests order-dependent (01 D6a / 06 §4).
 *
 * Pure: store-agnostic. The Dexie seed/clear code imports these lists.
 */

import { instantMs } from './calendar'
import { DEFAULT_OWNER_NAME, DEMO_OWNER_PERSONA_NAME } from './constants'
import type { IsoInstant, Owner, OwnerDraft } from './types'

export const demoPetIds = ['demo-pet-bella', 'demo-pet-miso'] as const

export const demoVaccinationIds = [
  'demo-vaccination-rabies',
  'demo-vaccination-dhpp',
  'demo-vaccination-fvrcp',
  'demo-vaccination-felv',
] as const

export const demoHealthRecordIds = ['demo-record-otitis', 'demo-record-annual'] as const

export const demoAppointmentIds = ['demo-appointment-wellness', 'demo-appointment-dental'] as const

export const demoJournalEntryIds = [
  'demo-journal-walk',
  'demo-journal-fed',
  'demo-journal-note',
  'demo-journal-symptom',
] as const

export const demoOwnerPersonaName = DEMO_OWNER_PERSONA_NAME

export type DemoTable = 'pet' | 'vaccination' | 'healthRecord' | 'appointment' | 'journalEntry'

const DEMO_IDS_BY_TABLE: Record<DemoTable, readonly string[]> = {
  pet: demoPetIds,
  vaccination: demoVaccinationIds,
  healthRecord: demoHealthRecordIds,
  appointment: demoAppointmentIds,
  journalEntry: demoJournalEntryIds,
}

/** The authoritative id list for one table. */
export function demoIdsFor(table: DemoTable): readonly string[] {
  return DEMO_IDS_BY_TABLE[table]
}

export function allDemoIds(): readonly string[] {
  return (Object.keys(DEMO_IDS_BY_TABLE) as DemoTable[]).flatMap((table) => demoIdsFor(table))
}

/** Readability aid only — never use this to decide ownership (R7). */
export function isDemoPrefixId(id: string): boolean {
  return id.startsWith('demo-')
}

/** Authoritative membership test: is this id one of the fixed demo ids? */
export function isDemoEntityId(table: DemoTable, id: string): boolean {
  return demoIdsFor(table).includes(id)
}

export interface DemoPartition<Row> {
  demo: Row[]
  user: Row[]
}

/**
 * Splits rows by exact demo-id membership. A row whose id merely starts with
 * `demo-` but is not on the list is a user row — no range, no prefix.
 */
export function partitionDemoRows<Row extends { id: string }>(
  rows: readonly Row[],
  table: DemoTable,
): DemoPartition<Row> {
  const ids = new Set(demoIdsFor(table))
  const demo: Row[] = []
  const user: Row[] = []
  for (const row of rows) {
    ;(ids.has(row.id) ? demo : user).push(row)
  }
  return { demo, user }
}

/** Exact demo ids that are not present — used by reseed/clear assertions. */
export function missingDemoIds<Row extends { id: string }>(
  rows: readonly Row[],
  table: DemoTable,
): string[] {
  const present = new Set(rows.map((row) => row.id))
  return demoIdsFor(table).filter((id) => !present.has(id))
}

/** "Demo exists" must check the same lists as clear/reseed (R7). */
export function hasAnyDemoRows<Row extends { id: string }>(
  rows: readonly Row[],
  table: DemoTable,
): boolean {
  const ids = new Set(demoIdsFor(table))
  return rows.some((row) => ids.has(row.id))
}

/** One second between seeded rows: unique and strictly increasing. */
export const DEMO_CREATED_AT_STEP_MS = 1000

/**
 * The seed `createdAt` contract: fixed row order, unique ISO instants ending at
 * `seedNow`. Example: index 0 with 5 rows → `seedNow − 4 s`.
 */
export function createDemoCreatedAt(
  seedNow: Date | string,
  rowIndex: number,
  totalRows: number,
): IsoInstant {
  if (!Number.isInteger(totalRows) || totalRows <= 0) {
    throw new RangeError(`totalRows must be a positive integer, received ${totalRows}`)
  }
  if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= totalRows) {
    throw new RangeError(`rowIndex must be within 0..${totalRows - 1}, received ${rowIndex}`)
  }
  const nowMs = instantMs(seedNow)
  return new Date(nowMs - (totalRows - 1 - rowIndex) * DEMO_CREATED_AT_STEP_MS).toISOString()
}

/** Throws unless every `createdAt` is strictly later than the previous row's. */
export function assertStrictlyIncreasingCreatedAt(
  rows: readonly { id: string; createdAt: IsoInstant }[],
): void {
  let previous: { id: string; ms: number } | null = null
  for (const row of rows) {
    const ms = instantMs(row.createdAt)
    if (previous !== null && ms <= previous.ms) {
      throw new Error(
        `Seed createdAt must be strictly increasing: "${row.id}" (${row.createdAt}) is not after "${previous.id}"`,
      )
    }
    previous = { id: row.id, ms }
  }
}

/**
 * Clearing sample data restores the placeholder owner only when the demo
 * persona is untouched (no contact details typed) — D5/D11 parity.
 */
export function planDemoOwnerRestore(
  owner: Pick<Owner, 'name' | 'email' | 'phone'>,
): OwnerDraft | null {
  const isUntouchedPersona =
    owner.name === demoOwnerPersonaName && owner.email.trim() === '' && owner.phone.trim() === ''
  return isUntouchedPersona ? { name: DEFAULT_OWNER_NAME, email: '', phone: '' } : null
}
