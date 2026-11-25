import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'

import { todayKey } from '@/lib/rules/calendar'
import {
  demoAppointmentIds,
  demoHealthRecordIds,
  demoJournalEntryIds,
  demoPetIds,
  demoVaccinationIds,
} from '@/lib/rules/demo-ownership'
import { assertStrictlyIncreasingCreatedAt, createDemoCreatedAt } from '@/lib/rules/demo-ownership'
import {
  currentDoses,
  headlineVaccinationDose,
  petVaccinationDueStatus,
} from '@/lib/rules/vaccination-due'

import { db } from '../db'
import { appendHealthRecord } from '../repositories/health-records'
import { createJournalEntry } from '../repositories/journal'
import { getOwner, saveOwner } from '../repositories/owners'
import { createPet, listPets } from '../repositories/pets'
import { appendVaccination } from '../repositories/vaccinations'
import { clearDemoHousehold, hasDemoData, seedDemoHousehold } from '../seed'
import { makePetDraft, resetDatabaseBeforeEach } from './test-utils'

resetDatabaseBeforeEach()

const SEED_NOW = new Date('2026-11-25T08:00:00.000Z')
const SEED_ISO = SEED_NOW.toISOString()

async function countDemoRows(): Promise<Record<string, number>> {
  return {
    pets: await db.pet
      .where('id')
      .anyOf([...demoPetIds])
      .count(),
    vaccinations: await db.vaccination
      .where('id')
      .anyOf([...demoVaccinationIds])
      .count(),
    healthRecords: await db.health_record
      .where('id')
      .anyOf([...demoHealthRecordIds])
      .count(),
    appointments: await db.appointment
      .where('id')
      .anyOf([...demoAppointmentIds])
      .count(),
    journal: await db.journal_entry
      .where('id')
      .anyOf([...demoJournalEntryIds])
      .count(),
  }
}

describe('R7 demo seed · exact ids and deterministic timestamps', () => {
  it('accepts: the demo household seeds exactly the fixed id lists', async () => {
    await seedDemoHousehold(SEED_NOW)
    expect(await hasDemoData()).toBe(true)

    expect((await db.pet.toArray()).map((row) => row.id).sort()).toEqual([...demoPetIds].sort())
    expect((await db.vaccination.toArray()).map((row) => row.id).sort()).toEqual(
      [...demoVaccinationIds].sort(),
    )
    expect((await db.health_record.toArray()).map((row) => row.id).sort()).toEqual(
      [...demoHealthRecordIds].sort(),
    )
    expect((await db.appointment.toArray()).map((row) => row.id).sort()).toEqual(
      [...demoAppointmentIds].sort(),
    )
    expect((await db.journal_entry.toArray()).map((row) => row.id).sort()).toEqual(
      [...demoJournalEntryIds].sort(),
    )
  })

  it('accepts: every seeded createdAt is unique, strictly increasing in seed order, and at most the seed instant', async () => {
    await seedDemoHousehold(SEED_NOW)
    const rows = [
      ...(await db.pet.toArray()),
      ...(await db.vaccination.toArray()),
      ...(await db.health_record.toArray()),
      ...(await db.appointment.toArray()),
      ...(await db.journal_entry.toArray()),
    ].map((row) => ({ id: row.id, createdAt: row.createdAt }))

    // Store reads return primary-key order, not insertion order; the contract is
    // that the seed's row order (an index per row) produced this exact sequence.
    const byCreatedAt = [...rows].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt),
    )
    expect(new Set(rows.map((row) => row.createdAt)).size).toBe(rows.length)
    expect(() => assertStrictlyIncreasingCreatedAt(byCreatedAt)).not.toThrow()
    expect(byCreatedAt.map((row) => row.createdAt)).toEqual(
      Array.from({ length: rows.length }, (_, index) =>
        createDemoCreatedAt(SEED_NOW, index, rows.length),
      ),
    )
    expect(byCreatedAt[byCreatedAt.length - 1]?.createdAt).toBe(SEED_ISO)
    expect(rows.every((row) => row.createdAt <= SEED_ISO)).toBe(true)
    expect(rows).toHaveLength(14)
  })

  it('rejects: a second seed is a no-op, not duplicate rows', async () => {
    expect(await seedDemoHousehold(SEED_NOW)).toBe(true)
    const before = await countDemoRows()
    const beforePets = (await db.pet.toArray()).map((pet) => pet.createdAt)

    expect(await seedDemoHousehold(new Date('2026-12-01T08:00:00.000Z'))).toBe(false)
    expect(await countDemoRows()).toEqual(before)
    expect((await db.pet.toArray()).map((pet) => pet.createdAt)).toEqual(beforePets)
  })

  it('accepts: the seeded dates are relative to the seed day', async () => {
    await seedDemoHousehold(SEED_NOW)
    const today = todayKey(SEED_NOW)
    const bella = (await db.pet.toArray()).find((pet) => pet.id === demoPetIds[0])
    expect(bella).toBeDefined()
    const bellaDoses = await db.vaccination.where('petId').equals(demoPetIds[0]).toArray()
    expect(petVaccinationDueStatus(bellaDoses, today, 30)).toBe('overdue')
    expect(headlineVaccinationDose(bellaDoses)?.vaccineName).toBe('Rabies')

    const misoDoses = await db.vaccination.where('petId').equals(demoPetIds[1]).toArray()
    expect(petVaccinationDueStatus(misoDoses, today, 30)).toBe('due_soon')
    expect(headlineVaccinationDose(misoDoses)?.vaccineName).toBe('FeLV')

    const appointment = (await db.appointment.toArray()).find(
      (row) => row.id === demoAppointmentIds[0],
    )
    expect(appointment?.status).toBe('scheduled')
    expect(appointment?.scheduledAt).toBe(new Date(2026, 10, 30, 9, 30, 0, 0).toISOString())
  })
})

describe('R7/R8 demo clear · exact ids, user rows survive', () => {
  async function addUserHousehold(): Promise<{ petId: string; journalId: string }> {
    const pet = await createPet(makePetDraft({ name: 'Rex', microchip: '900215004777777' }))
    const journal = await createJournalEntry(
      {
        petId: pet.id,
        kind: 'walk',
        occurredAt: SEED_ISO,
        note: 'Owner walk',
        durationMinutes: 20,
      },
      SEED_NOW,
    )
    await appendVaccination(
      {
        petId: pet.id,
        vaccineTypeId: null,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-01-01',
        nextDueDate: '2027-01-01',
        vetName: null,
      },
      SEED_NOW,
    )
    await appendHealthRecord(
      {
        petId: pet.id,
        recordedOn: '2026-02-01',
        condition: 'Owner note',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
      },
      SEED_NOW,
    )
    return { petId: pet.id, journalId: journal.id }
  }

  it('accepts: seed → add a pet → clear leaves the owner pet and its rows', async () => {
    await seedDemoHousehold(SEED_NOW)
    const { petId, journalId } = await addUserHousehold()

    await clearDemoHousehold(SEED_NOW)

    expect(await hasDemoData()).toBe(false)
    expect(await countDemoRows()).toEqual({
      pets: 0,
      vaccinations: 0,
      healthRecords: 0,
      appointments: 0,
      journal: 0,
    })
    expect((await listPets()).map((pet) => pet.id)).toEqual([petId])
    expect(await db.journal_entry.get(journalId)).toBeDefined()
    expect(await db.vaccination.where('petId').equals(petId).count()).toBe(1)
    expect(await db.health_record.where('petId').equals(petId).count()).toBe(1)
  })

  it('accepts: clear → seed → clear leaves no orphans or duplicates', async () => {
    const { petId, journalId } = await addUserHousehold()

    await seedDemoHousehold(SEED_NOW)
    await clearDemoHousehold(SEED_NOW)
    await seedDemoHousehold(SEED_NOW)
    await clearDemoHousehold(SEED_NOW)

    expect(await hasDemoData()).toBe(false)
    expect(await countDemoRows()).toEqual({
      pets: 0,
      vaccinations: 0,
      healthRecords: 0,
      appointments: 0,
      journal: 0,
    })
    expect((await listPets()).map((pet) => pet.id)).toEqual([petId])
    expect(await db.journal_entry.get(journalId)).toBeDefined()
    // No duplicate rows anywhere.
    expect(await db.pet.count()).toBe(1)
    expect(await db.journal_entry.count()).toBe(1)
    expect(await db.vaccination.count()).toBe(1)
    expect(await db.health_record.count()).toBe(1)
  })

  it('rejects: a demo-* prefix alone does not make a row removable (exact-list ownership)', async () => {
    const template = await createPet(makePetDraft({ microchip: null }))
    await db.pet.delete(template.id)
    const impostor = { ...template, id: 'demo-pet-impostor' }
    await db.pet.add(impostor)

    await seedDemoHousehold(SEED_NOW)
    await clearDemoHousehold(SEED_NOW)

    expect(await db.pet.get('demo-pet-impostor')).toBeDefined()
    expect((await listPets()).map((pet) => pet.id)).toEqual(['demo-pet-impostor'])
  })

  it('accepts: clearing keeps a typed owner name and only restores the untouched persona', async () => {
    await seedDemoHousehold(SEED_NOW)
    expect((await getOwner())?.name).toBe('Maria Santos')

    await saveOwner({ name: 'Maria Santos', email: 'maria@example.com', phone: '' }, SEED_NOW)
    await clearDemoHousehold(SEED_NOW)
    expect((await getOwner())?.name).toBe('Maria Santos')
    expect((await getOwner())?.email).toBe('maria@example.com')

    await db.owner.clear()
    await seedDemoHousehold(SEED_NOW)
    await saveOwner({ name: 'Daniel', email: '', phone: '' }, SEED_NOW)
    await clearDemoHousehold(SEED_NOW)
    expect((await getOwner())?.name).toBe('Daniel')
  })

  it('rejects: seeding never overwrites a name the owner typed', async () => {
    await saveOwner({ name: 'Daniel', email: '', phone: '' }, SEED_NOW)
    await seedDemoHousehold(SEED_NOW)
    expect((await getOwner())?.name).toBe('Daniel')
  })
})

describe('R1 parity · seeded doses feed the newest-dose rule unchanged', () => {
  it('accepts: currentDoses returns one dose per vaccine for the demo pets', async () => {
    await seedDemoHousehold(SEED_NOW)
    const bellaDoses = await db.vaccination.where('petId').equals(demoPetIds[0]).toArray()
    const current = currentDoses(bellaDoses)
    expect(current).toHaveLength(2)
    expect(new Set(current.map((dose) => dose.vaccineName))).toEqual(new Set(['Rabies', 'DHPP']))
  })
})
