import { describe, expect, it } from 'vitest'

import {
  DEMO_CREATED_AT_STEP_MS,
  allDemoIds,
  assertStrictlyIncreasingCreatedAt,
  createDemoCreatedAt,
  demoAppointmentIds,
  demoHealthRecordIds,
  demoIdsFor,
  demoJournalEntryIds,
  demoOwnerPersonaName,
  demoPetIds,
  demoVaccinationIds,
  hasAnyDemoRows,
  isDemoEntityId,
  isDemoPrefixId,
  missingDemoIds,
  partitionDemoRows,
  planDemoOwnerRestore,
} from './demo-ownership'

const SEED_NOW = '2026-11-25T08:00:00.000Z'

describe('R7 demo ownership · exact id lists', () => {
  it('accepts: the fixed demo-* lists match the seed contract', () => {
    expect(demoPetIds).toEqual(['demo-pet-bella', 'demo-pet-miso'])
    expect(demoVaccinationIds).toEqual([
      'demo-vaccination-rabies',
      'demo-vaccination-dhpp',
      'demo-vaccination-fvrcp',
      'demo-vaccination-felv',
    ])
    expect(demoHealthRecordIds).toEqual(['demo-record-otitis', 'demo-record-annual'])
    expect(demoAppointmentIds).toEqual(['demo-appointment-wellness', 'demo-appointment-dental'])
    expect(demoJournalEntryIds).toEqual([
      'demo-journal-walk',
      'demo-journal-fed',
      'demo-journal-note',
      'demo-journal-symptom',
    ])
    expect(demoOwnerPersonaName).toBe('Maria Santos')
    for (const id of allDemoIds()) {
      expect(id.startsWith('demo-')).toBe(true)
    }
  })

  it('rejects: duplicate demo ids would make clear/reseed ambiguous', () => {
    for (const table of [
      'pet',
      'vaccination',
      'healthRecord',
      'appointment',
      'journalEntry',
    ] as const) {
      const ids = demoIdsFor(table)
      expect(new Set(ids).size).toBe(ids.length)
    }
    expect(new Set(allDemoIds()).size).toBe(allDemoIds().length)
  })

  it('accepts: clearing removes exactly the listed ids and user rows survive', () => {
    const userPet = { id: '6f1c2f3e-0000-4000-8000-000000000001', name: 'Owner pet' }
    const holder = { id: '6f1c2f3e-0000-4000-8000-000000000002', name: 'Owner appointment' }
    const rows = [
      { id: demoPetIds[0], name: 'Bella' },
      { id: demoPetIds[1], name: 'Miso' },
      userPet,
    ]
    const { demo, user } = partitionDemoRows(rows, 'pet')
    expect(demo.map((row) => row.id)).toEqual([...demoPetIds])
    expect(user).toEqual([userPet])

    const appointmentRows = [{ id: demoAppointmentIds[0] }, holder]
    expect(partitionDemoRows(appointmentRows, 'appointment').user).toEqual([holder])
  })

  it('rejects: a demo-* prefix alone never grants ownership (no range, no prefix test)', () => {
    const impostor = { id: 'demo-pet-impostor', name: 'Typed by the owner' }
    expect(isDemoPrefixId(impostor.id)).toBe(true)
    expect(isDemoEntityId('pet', impostor.id)).toBe(false)
    const { demo, user } = partitionDemoRows([{ id: demoPetIds[0] }, impostor], 'pet')
    expect(demo.map((row) => row.id)).toEqual([demoPetIds[0]])
    expect(user).toEqual([impostor])
    // The fixed list is authoritative for "demo exists" too.
    expect(hasAnyDemoRows([impostor], 'pet')).toBe(false)
    expect(hasAnyDemoRows([{ id: demoPetIds[0] }], 'pet')).toBe(true)
  })

  it('accepts: seed → add pet → clear leaves the owner pet alive', () => {
    const seeded = demoPetIds.map((id) => ({ id }))
    const ownerPet = { id: '6f1c2f3e-0000-4000-8000-000000000003' }
    const afterSeedAndAdd = [...seeded, ownerPet]
    const afterClear = partitionDemoRows(afterSeedAndAdd, 'pet').user
    expect(afterClear).toEqual([ownerPet])
  })

  it('accepts: clear → seed → clear leaves no rows or duplicates', () => {
    const seed = () => demoPetIds.map((id) => ({ id }))
    const clear = (rows: { id: string }[]) => partitionDemoRows(rows, 'pet').user
    const firstClear = clear(seed())
    expect(firstClear).toEqual([])
    const reseeded = [...clear(seed()), ...seed()]
    expect(partitionDemoRows(reseeded, 'pet').demo.map((row) => row.id)).toEqual([...demoPetIds])
    expect(clear(reseeded)).toEqual([])
    expect(missingDemoIds(seed(), 'pet')).toEqual([])
    expect(missingDemoIds([{ id: demoPetIds[0] }], 'pet')).toEqual([demoPetIds[1]])
  })
})

describe('R7 demo ownership · strictly increasing seed createdAt', () => {
  it('accepts: the seed helper yields unique ascending instants at most now', () => {
    const totalRows = 16
    const instants = Array.from({ length: totalRows }, (_, index) =>
      createDemoCreatedAt(SEED_NOW, index, totalRows),
    )
    expect(new Set(instants).size).toBe(totalRows)
    expect(instants[totalRows - 1]).toBe(SEED_NOW)
    expect(Date.parse(instants[0] ?? '')).toBe(
      Date.parse(SEED_NOW) - (totalRows - 1) * DEMO_CREATED_AT_STEP_MS,
    )
    expect(() =>
      assertStrictlyIncreasingCreatedAt(
        instants.map((createdAt, index) => ({ id: `row-${index}`, createdAt })),
      ),
    ).not.toThrow()
  })

  it('rejects: equal or descending createdAts would make ranking order-dependent', () => {
    expect(() =>
      assertStrictlyIncreasingCreatedAt([
        { id: 'a', createdAt: '2026-11-25T08:00:00.000Z' },
        { id: 'b', createdAt: '2026-11-25T08:00:00.000Z' },
      ]),
    ).toThrow(/strictly increasing/)
    expect(() =>
      assertStrictlyIncreasingCreatedAt([
        { id: 'a', createdAt: '2026-11-25T08:00:01.000Z' },
        { id: 'b', createdAt: '2026-11-25T08:00:00.999Z' },
      ]),
    ).toThrow(/strictly increasing/)
  })

  it('rejects: invalid seed indexes and row counts', () => {
    expect(() => createDemoCreatedAt(SEED_NOW, -1, 4)).toThrow(RangeError)
    expect(() => createDemoCreatedAt(SEED_NOW, 4, 4)).toThrow(RangeError)
    expect(() => createDemoCreatedAt(SEED_NOW, 0, 0)).toThrow(RangeError)
    expect(() => createDemoCreatedAt('not-a-date', 0, 1)).toThrow(TypeError)
  })
})

describe('R7 demo ownership · restoring the placeholder owner', () => {
  it('accepts: an untouched demo persona returns to "My household"', () => {
    expect(planDemoOwnerRestore({ name: 'Maria Santos', email: '', phone: '' })).toEqual({
      name: 'My household',
      email: '',
      phone: '',
    })
    expect(planDemoOwnerRestore({ name: 'Maria Santos', email: '  ', phone: ' ' })).toEqual({
      name: 'My household',
      email: '',
      phone: '',
    })
  })

  it('rejects: a typed name or any contact detail is left alone', () => {
    expect(planDemoOwnerRestore({ name: 'Daniel Cruz', email: '', phone: '' })).toBeNull()
    expect(
      planDemoOwnerRestore({ name: 'Maria Santos', email: 'maria@example.com', phone: '' }),
    ).toBeNull()
    expect(
      planDemoOwnerRestore({ name: 'Maria Santos', email: '', phone: '0917 555 0100' }),
    ).toBeNull()
  })
})
