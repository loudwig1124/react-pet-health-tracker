import { describe, expect, it } from 'vitest'

import {
  PALETTE_GROUP_LIMIT,
  buildPaletteItems,
  createCommandPaletteItems,
  foldPaletteText,
  groupPaletteItems,
  rememberPaletteItem,
  resolvePaletteRecents,
  searchPalette,
  type PaletteItem,
} from '@/lib/palette'
import type { Appointment, HealthRecord, JournalEntry, Pet } from '@/lib/rules/types'

const PETS: Pet[] = [
  {
    id: 'pet-bella',
    ownerId: 'owner',
    name: 'Bella',
    species: 'Dog',
    breed: 'Golden Retriever mix',
    sex: 'female',
    dateOfBirth: '2022-01-01',
    weightKg: 12.4,
    microchip: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'pet-zoe',
    ownerId: 'owner',
    name: 'Zoë',
    species: 'Cat',
    breed: null,
    sex: 'unknown',
    dateOfBirth: '2023-01-01',
    weightKg: 4.2,
    microchip: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

function record(id: string, petId: string, condition: string): HealthRecord {
  return {
    id,
    petId,
    recordedOn: '2026-11-20',
    condition,
    diagnosis: 'Ear infection',
    treatment: 'Drops',
    prescribedMedication: 'Otomax',
    vetName: 'Dr Reyes',
    createdAt: '2026-11-20T00:00:00.000Z',
  }
}

function journal(
  id: string,
  petId: string,
  kind: JournalEntry['kind'],
  note: string,
): JournalEntry {
  return {
    id,
    petId,
    kind,
    occurredAt: '2026-11-24T23:30:00.000Z',
    note,
    durationMinutes: null,
    createdAt: '2026-11-24T23:30:00.000Z',
    updatedAt: '2026-11-24T23:30:00.000Z',
  }
}

function appointment(
  id: string,
  petId: string | null,
  scheduledAt: string,
  status: Appointment['status'],
): Appointment {
  return {
    id,
    petId,
    clinicName: 'Paws & Claws',
    purpose: 'Annual wellness check',
    scheduledAt,
    status,
    completedAt: null,
    cancelReason: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

function sources(): Parameters<typeof buildPaletteItems>[0] {
  return {
    pets: PETS,
    records: [record('record-1', 'pet-bella', 'Ear infection')],
    journal: [journal('note-1', 'pet-bella', 'walk', 'Morning walk in the park')],
    appointments: [
      appointment('visit-1', 'pet-bella', new Date(2026, 10, 26, 9, 30).toISOString(), 'scheduled'),
      appointment('visit-2', null, new Date(2026, 10, 20, 9, 30).toISOString(), 'completed'),
    ],
  }
}

describe('palette search (05 F3)', () => {
  const items = buildPaletteItems(sources())

  it('folds case and diacritics', () => {
    expect(foldPaletteText('Zoë')).toBe('zoe')
    expect(searchPalette(items, 'ZOE').map((item) => item.id)).toContain('pet:pet-zoe')
    expect(searchPalette(items, 'bella').map((item) => item.id)).toContain('pet:pet-bella')
  })

  it('returns at most eight results per group, groups in a fixed order', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      journal(`note-many-${index}`, 'pet-bella', 'walk', `Long walk number ${index}`),
    )
    const limited = searchPalette(buildPaletteItems({ ...sources(), journal: many }), 'walk')
    const journalHits = limited.filter((item) => item.group === 'journal')
    expect(journalHits).toHaveLength(PALETTE_GROUP_LIMIT)
    const seenGroups = limited.map((item) => item.group)
    const order = ['navigate', 'create', 'pets', 'records', 'journal', 'appointments']
    const positions = seenGroups.map((group) => order.indexOf(group))
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })

  it('matches navigation, create commands, records, notes and visits', () => {
    expect(searchPalette(items, 'vaccinations').map((item) => item.id)).toContain(
      'nav:/vaccinations',
    )
    expect(searchPalette(items, 'add record').map((item) => item.id)).toContain('create:record')
    expect(searchPalette(items, 'ear infection').map((item) => item.id)).toContain(
      'record:record-1',
    )
    expect(searchPalette(items, 'morning walk').map((item) => item.id)).toContain('note:note-1')
    expect(searchPalette(items, 'annual').map((item) => item.id)).toContain('visit:visit-1')
  })

  it('returns no rows for an empty query and no fabricated ids for nonsense', () => {
    expect(searchPalette(items, '   ')).toEqual([])
    expect(searchPalette(items, 'zzzzzz')).toEqual([])
  })

  it('labels each group for the palette UI', () => {
    const groups = groupPaletteItems(createCommandPaletteItems())
    expect(groups).toHaveLength(1)
    expect(groups[0]?.group).toBe('create')
    expect(groups[0]?.items).toHaveLength(5)
  })
})

describe('palette deep links (F6-friendly)', () => {
  const items = buildPaletteItems(sources())
  const byId = new Map(items.map((item) => [item.id, item] as const))

  it('opens pets on their detail, records on the pet Records tab', () => {
    expect(byId.get('pet:pet-bella')?.to).toBe('/pets/pet-bella')
    expect(byId.get('record:record-1')?.to).toBe('/pets/pet-bella/records')
  })

  it('opens a journal note on a pet-filtered search', () => {
    const to = byId.get('note:note-1')?.to ?? ''
    const url = new URL(to, 'http://localhost')
    expect(url.pathname).toBe('/journal')
    expect(url.searchParams.get('pet')).toBe('pet-bella')
    expect(url.searchParams.get('q')).toBe('Morning walk in the park')
  })

  it('opens a visit on the URL-restored list, with the day and pet filters', () => {
    const to = byId.get('visit:visit-1')?.to ?? ''
    const url = new URL(to, 'http://localhost')
    expect(url.pathname).toBe('/appointments')
    expect(url.searchParams.get('status')).toBe('upcoming')
    expect(url.searchParams.get('day')).toBe('2026-11-26')
    expect(url.searchParams.get('pet')).toBe('pet-bella')

    const closed = new URL(byId.get('visit:visit-2')?.to ?? '', 'http://localhost')
    expect(closed.searchParams.get('status')).toBe('past')
    expect(closed.searchParams.get('pet')).toBeNull()
  })
})

describe('palette recents (05 F9)', () => {
  const items = buildPaletteItems(sources())

  it('offers the last five destinations or pets and prunes stale ids', () => {
    const ids = ['nav:/pets', 'pet:pet-bella', 'pet:pet-gone', 'record:record-1', 'nav:/journal']
    const resolved = resolvePaletteRecents(ids, items)
    expect(resolved.map((item) => item.id)).toEqual(['nav:/pets', 'pet:pet-bella', 'nav:/journal'])
  })

  it('never remembers a create command or a record', () => {
    const base: readonly string[] = []
    const createItem: PaletteItem = {
      id: 'create:pet',
      group: 'create',
      label: 'Add pet',
      description: '',
      to: '/pets?new=1',
      keywords: '',
    }
    expect(rememberPaletteItem(base, createItem)).toEqual([])

    const petItem = items.find((item) => item.id === 'pet:pet-bella')
    if (petItem === undefined) {
      throw new Error('fixture pet missing')
    }
    expect(rememberPaletteItem(['nav:/pets'], petItem)).toEqual(['pet:pet-bella', 'nav:/pets'])
    const five = ['a', 'b', 'c', 'd', 'e']
    expect(rememberPaletteItem(five, petItem)).toHaveLength(5)
    expect(rememberPaletteItem(five, petItem)[0]).toBe('pet:pet-bella')
  })
})
