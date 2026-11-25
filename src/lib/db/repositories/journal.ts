/**
 * Journal repository (R6/R10) — the only write path for entries.
 *
 * Kind is immutable after creation: `updateJournalEntry` accepts only the three
 * editable fields. Deletes require the UI's confirmation dialog; the repository
 * simply deletes when asked.
 */
import type { JournalEntry, JournalDraft } from '@/lib/rules/types'

import { db } from '../db'
import { journalDraftSchema, journalEntrySchema, parseRow } from '../schema'
import { newId, toIsoInstant } from '../write-helpers'

export interface JournalQuery {
  /** `undefined` = the whole household, never `null` (02 R10). */
  petId?: string
  limit?: number
}

export type JournalEntryPatch = Pick<JournalEntry, 'occurredAt' | 'note' | 'durationMinutes'>

function sortNewestFirst(entries: JournalEntry[]): JournalEntry[] {
  return entries.sort(
    (a, b) =>
      b.occurredAt.localeCompare(a.occurredAt) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  )
}

export async function listJournal(query: JournalQuery = {}): Promise<JournalEntry[]> {
  const rows =
    query.petId === undefined
      ? await db.journal_entry.toArray()
      : await db.journal_entry.where('petId').equals(query.petId).toArray()
  const sorted = sortNewestFirst(rows)
  return query.limit === undefined ? sorted : sorted.slice(0, query.limit)
}

export async function listJournalForPet(
  petId: string,
  options: { limit?: number } = {},
): Promise<JournalEntry[]> {
  return listJournal({ petId, ...options })
}

export async function getJournalEntry(id: string): Promise<JournalEntry | undefined> {
  return db.journal_entry.get(id)
}

async function assertPetExists(petId: string): Promise<void> {
  const pet = await db.pet.get(petId)
  if (pet === undefined) {
    throw new Error(`Pet ${petId} does not exist.`)
  }
}

export async function createJournalEntry(
  draft: JournalDraft,
  now: Date = new Date(),
): Promise<JournalEntry> {
  const parsed = parseRow(journalDraftSchema, draft, 'journal draft')
  await assertPetExists(parsed.petId)
  const instant = toIsoInstant(now)
  const entry = parseRow(
    journalEntrySchema,
    { id: newId(), ...parsed, createdAt: instant, updatedAt: instant },
    'journal entry',
  )
  await db.journal_entry.add(entry)
  return entry
}

export async function updateJournalEntry(
  id: string,
  patch: Partial<JournalEntryPatch>,
  now: Date = new Date(),
): Promise<JournalEntry> {
  return db.transaction('rw', db.journal_entry, async () => {
    const existing = await db.journal_entry.get(id)
    if (existing === undefined) {
      throw new Error(`Journal entry ${id} does not exist.`)
    }
    // `kind` and `petId` are deliberately not patchable (R6).
    const updated = parseRow(
      journalEntrySchema,
      {
        ...existing,
        ...(patch.occurredAt !== undefined ? { occurredAt: patch.occurredAt } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        ...(patch.durationMinutes !== undefined ? { durationMinutes: patch.durationMinutes } : {}),
        updatedAt: toIsoInstant(now),
      },
      'journal entry',
    )
    await db.journal_entry.put(updated)
    return updated
  })
}

export async function deleteJournalEntry(id: string): Promise<void> {
  await db.journal_entry.delete(id)
}

/**
 * Puts a just-deleted entry back for the 3-second Undo (02 §1, 06 M4). The whole
 * row is restored — same id, kind, pet and timestamps — so Undo after a delete is
 * a true reversal rather than a new entry that merely looks similar.
 *
 * The only failure inside the 3 s window is a pet that vanished in the same
 * breath; the pet check makes that explicit instead of leaving orphan rows.
 */
export async function restoreJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  const parsed = parseRow(journalEntrySchema, entry, 'journal entry')
  await db.transaction('rw', db.journal_entry, db.pet, async () => {
    const pet = await db.pet.get(parsed.petId)
    if (pet === undefined) {
      throw new Error(`Pet ${parsed.petId} does not exist.`)
    }
    await db.journal_entry.put(parsed)
  })
  return parsed
}
