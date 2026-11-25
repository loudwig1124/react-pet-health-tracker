import 'fake-indexeddb/auto'
import { liveQuery } from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { groupJournalEntriesByDay } from '@/lib/rules/journal'
import type { JournalEntry } from '@/lib/rules/types'

import { db } from '../db'
import {
  createJournalEntry,
  deleteJournalEntry,
  listJournalForPet,
  updateJournalEntry,
} from '../repositories/journal'
import { createPet } from '../repositories/pets'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const NOW = new Date('2026-03-02T09:00:00.000Z')
const localIso = (year: number, month: number, day: number, hour = 12, minute = 0): string =>
  new Date(year, month - 1, day, hour, minute, 0, 0).toISOString()

let unsubscribe: (() => void) | null = null

afterEach(() => {
  unsubscribe?.()
  unsubscribe = null
})

async function subscribeToJournal(petId: string): Promise<{
  latest: () => JournalEntry[]
  emissions: () => number
}> {
  let rows: JournalEntry[] = []
  let emissions = 0
  const subscription = liveQuery(() => listJournalForPet(petId)).subscribe({
    next: (next) => {
      rows = next
      emissions += 1
    },
    error: (error: unknown) => {
      throw error
    },
  })
  unsubscribe = () => subscription.unsubscribe()
  return { latest: () => rows, emissions: () => emissions }
}

async function seedEntry(petId: string): Promise<string> {
  const entry = await createJournalEntry(
    {
      petId,
      kind: 'walk',
      occurredAt: localIso(2026, 3, 1, 23, 55),
      note: 'Night loop',
      durationMinutes: 30,
    },
    NOW,
  )
  return entry.id
}

describe('R10 writes · a mounted live query refreshes without a manual counter', () => {
  it('accepts: create, edit and delete each reach the live subscriber', async () => {
    const pet = await createPet(makePetDraft())
    const view = await subscribeToJournal(pet.id)
    await vi.waitFor(() => expect(view.emissions()).toBeGreaterThan(0))
    expect(view.latest()).toEqual([])

    const id = await seedEntry(pet.id)
    await vi.waitFor(() => expect(view.latest().map((entry) => entry.id)).toContain(id))

    await updateJournalEntry(
      id,
      { occurredAt: localIso(2026, 3, 2, 0, 5), note: 'After midnight loop' },
      NOW,
    )
    await vi.waitFor(() => {
      const entry = view.latest().find((row) => row.id === id)
      expect(entry?.occurredAt).toBe(localIso(2026, 3, 2, 0, 5))
      expect(entry?.note).toBe('After midnight loop')
    })

    await deleteJournalEntry(id)
    await vi.waitFor(() => expect(view.latest()).toEqual([]))
  })

  it('rejects: a write that fails validation does not reach the subscriber', async () => {
    const pet = await createPet(makePetDraft())
    const id = await seedEntry(pet.id)
    const view = await subscribeToJournal(pet.id)
    await vi.waitFor(() => expect(view.emissions()).toBeGreaterThan(0))

    await expect(updateJournalEntry(id, { durationMinutes: 0 }, NOW)).rejects.toThrow(
      /durationMinutes|positive|Invalid/i,
    )
    const entry = await db.journal_entry.get(id)
    expect(entry?.durationMinutes).toBe(30)
    expect(view.latest().find((row) => row.id === id)?.durationMinutes).toBe(30)
  })
})

describe('R6 repository · editable fields and day sections', () => {
  it('accepts: changing the time moves the entry to the right day section', async () => {
    const pet = await createPet(makePetDraft())
    const id = await seedEntry(pet.id)

    const before = await listJournalForPet(pet.id)
    const beforeGroups = groupJournalEntriesByDay(before, '2026-03-02')
    expect(beforeGroups[0]?.day).toBe('2026-03-01')
    expect(beforeGroups[0]?.label).toBe('yesterday')

    const updated = await updateJournalEntry(id, { occurredAt: localIso(2026, 3, 2, 0, 5) }, NOW)
    const afterGroups = groupJournalEntriesByDay([updated], '2026-03-02')
    expect(afterGroups[0]?.day).toBe('2026-03-02')
    expect(afterGroups[0]?.label).toBe('today')
  })

  it('rejects: the repository never lets an edit change kind or pet', async () => {
    const pet = await createPet(makePetDraft())
    const other = await createPet(
      makePetDraft({ name: 'Miso', species: 'Cat', microchip: '900215004999999' }),
    )
    const id = await seedEntry(pet.id)

    const unchanged = await updateJournalEntry(
      id,
      // A hostile caller tries to smuggle immutable fields through the patch.
      { kind: 'fed', petId: other.id } as never,
      NOW,
    )
    expect(unchanged.kind).toBe('walk')
    expect(unchanged.petId).toBe(pet.id)
    expect((await db.journal_entry.get(id))?.kind).toBe('walk')
    expect((await db.journal_entry.get(id))?.petId).toBe(pet.id)
  })
})
