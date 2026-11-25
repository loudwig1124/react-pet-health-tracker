import { describe, expect, it } from 'vitest'

import {
  createJournalEntry,
  deleteJournalEntry,
  listJournal,
  restoreJournalEntry,
  updateJournalEntry,
} from '../repositories/journal'
import { createPet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

describe('journal repository round-trip (R6/R10)', () => {
  it('creates, edits and deletes, and Undo restores the exact row', async () => {
    const pet = await createPet(makePetDraft())
    const created = await createJournalEntry({
      petId: pet.id,
      kind: 'walk',
      occurredAt: new Date(2026, 10, 26, 7, 10, 0, 0).toISOString(),
      note: 'Morning loop',
      durationMinutes: 30,
    })

    expect((await listJournal()).map((entry) => entry.id)).toEqual([created.id])

    const edited = await updateJournalEntry(created.id, {
      occurredAt: new Date(2026, 10, 26, 8, 0, 0, 0).toISOString(),
      note: 'Longer loop',
      durationMinutes: 45,
    })
    expect(edited.kind).toBe('walk')
    expect(edited.note).toBe('Longer loop')
    expect(edited.durationMinutes).toBe(45)
    expect(edited.updatedAt >= created.updatedAt).toBe(true)

    await deleteJournalEntry(created.id)
    expect(await listJournal()).toEqual([])

    // The toast's Undo puts back the pre-delete row, id and kind included.
    await restoreJournalEntry(edited)
    const restored = await listJournal()
    expect(restored).toHaveLength(1)
    expect(restored[0]).toEqual(edited)
  })

  it('does not resurrect an entry whose pet vanished', async () => {
    const pet = await createPet(makePetDraft())
    const created = await createJournalEntry({
      petId: pet.id,
      kind: 'note',
      occurredAt: new Date().toISOString(),
      note: null,
      durationMinutes: null,
    })
    await deleteJournalEntry(created.id)

    // Delete the pet (cascade) then attempt Undo inside the toast window.
    const { deletePet } = await import('../repositories/pets')
    await deletePet(pet.id)

    await expect(restoreJournalEntry(created)).rejects.toThrow(/does not exist/)
    expect(await listJournal()).toEqual([])
  })
})
