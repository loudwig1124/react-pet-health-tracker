/**
 * R1 integration — the `/vaccinations` read model over the real Dexie
 * repositories: the newest dose per vaccine drives the pet status, so
 * re-vaccinating clears `overdue` for the household filters (02 R1, 06 M3).
 *
 * Node project (fake-indexeddb), like the other repository suites.
 */
import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'

import { db } from '@/lib/db/db'
import { createPet } from '@/lib/db/repositories/pets'
import { appendVaccination, listVaccinationsForPet } from '@/lib/db/repositories/vaccinations'
import { seedVaccineCatalog, VACCINE_TYPE_IDS } from '@/lib/db/seed/catalog'
import type { VaccinationDraft } from '@/lib/rules/types'
import { petVaccinationDueStatus } from '@/lib/rules/vaccination-due'
import {
  filterVaccinationViews,
  sortVaccinationViews,
  summarizeVaccinationViews,
  toVaccinationViews,
  vaccineFilterOptions,
} from '@/lib/schedule/vaccinations'

const TODAY = '2026-11-25'
const WINDOW = 30
const EARLY_NOW = new Date('2025-01-09T02:00:00.000Z')
const BOOSTER_NOW = new Date('2026-11-20T02:00:00.000Z')

async function reset(): Promise<void> {
  if (!db.isOpen()) {
    await db.open()
  }
  await Promise.all(db.tables.map((table) => table.clear()))
  await seedVaccineCatalog()
}

beforeEach(reset)

async function makePet(
  name = 'Bella',
  microchip: string | null = '900215004123456',
): Promise<string> {
  const pet = await createPet({
    name,
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip,
  })
  return pet.id
}

function dose(overrides: Partial<VaccinationDraft> & { petId: string }): VaccinationDraft {
  return {
    vaccineTypeId: VACCINE_TYPE_IDS.rabies,
    vaccineName: 'Rabies',
    vaccinationDate: '2025-01-09',
    nextDueDate: '2026-01-09',
    vetName: null,
    ...overrides,
  }
}

async function viewsFor(petIds: readonly string[], windowDays: number = WINDOW) {
  const doses = (await Promise.all(petIds.map((id) => listVaccinationsForPet(id)))).flat()
  const pets = await Promise.all(petIds.map((id) => db.pet.get(id)))
  const present = pets.filter((pet) => pet !== undefined)
  return toVaccinationViews(doses, present, TODAY, windowDays)
}

describe('R1 · the newest dose per vaccine drives the pet status', () => {
  it('accepts: a booster clears overdue — the old dose becomes superseded history', async () => {
    const petId = await makePet()
    await appendVaccination(dose({ petId }), EARLY_NOW)

    const before = await viewsFor([petId])
    expect(before).toHaveLength(1)
    expect(before[0]?.isCurrent).toBe(true)
    expect(before[0]?.petStatus).toBe('overdue')
    expect(before[0]?.chipStatus).toBe('overdue')
    expect(
      filterVaccinationViews(before, { petId: null, status: 'overdue', vaccineKey: null }),
    ).toHaveLength(1)
    expect(summarizeVaccinationViews(before)).toMatchObject({ doses: 1, pets: 1, overdue: 1 })

    // Re-vaccinate: new dose given later, next due in the future.
    await appendVaccination(
      dose({
        petId,
        vaccinationDate: '2026-11-20',
        nextDueDate: '2027-03-01',
      }),
      BOOSTER_NOW,
    )

    const after = await viewsFor([petId])
    expect(after).toHaveLength(2)
    const superseded = after.find((view) => view.dose.vaccinationDate === '2025-01-09')
    const current = after.find((view) => view.dose.vaccinationDate === '2026-11-20')
    expect(superseded?.isCurrent).toBe(false)
    expect(superseded?.chipStatus).toBe('superseded')
    expect(current?.isCurrent).toBe(true)
    expect(current?.chipStatus).toBe('up_to_date')
    expect(current?.petStatus).toBe('up_to_date')

    // The overdue filter (the dashboard drill-down) can no longer match the pet.
    expect(
      filterVaccinationViews(after, { petId: null, status: 'overdue', vaccineKey: null }),
    ).toHaveLength(0)
    expect(summarizeVaccinationViews(after)).toMatchObject({
      doses: 2,
      pets: 1,
      overdue: 0,
      upToDate: 1,
    })
  })

  it('accepts: same-day doses resolve by createdAt (and never by input order)', async () => {
    const petId = await makePet()
    const sameDay = '2026-11-20'
    await appendVaccination(
      dose({ petId, vaccinationDate: sameDay, nextDueDate: '2026-12-01' }),
      new Date('2026-11-20T01:00:00.000Z'),
    )
    // Created one minute later, same vaccination day: this is the newer dose.
    await appendVaccination(
      dose({ petId, vaccinationDate: sameDay, nextDueDate: '2027-11-20' }),
      new Date('2026-11-20T01:01:00.000Z'),
    )

    const views = await viewsFor([petId])
    const currentViews = views.filter((view) => view.isCurrent)
    expect(currentViews).toHaveLength(1)
    expect(currentViews[0]?.dose.nextDueDate).toBe('2027-11-20')
    expect(currentViews[0]?.petStatus).toBe('up_to_date')
  })

  it('keeps one current dose per vaccine type, not per row', async () => {
    const petId = await makePet()
    await appendVaccination(
      dose({ petId, vaccinationDate: '2025-01-09', nextDueDate: '2026-01-09' }),
      EARLY_NOW,
    )
    await appendVaccination(
      dose({
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.felv,
        vaccineName: 'FeLV',
        vaccinationDate: '2026-08-30',
        nextDueDate: '2026-12-01',
      }),
      BOOSTER_NOW,
    )

    const views = await viewsFor([petId])
    expect(views.filter((view) => view.isCurrent)).toHaveLength(2)
    // Overdue rabies still outranks the due-soon FeLV (worst-of-pets rule).
    expect(views[0]?.petStatus).toBe('overdue')
    expect(
      petVaccinationDueStatus(
        views.map((view) => view.dose),
        TODAY,
        WINDOW,
      ),
    ).toBe('overdue')
  })

  it('applies the due-soon window edges (today / +window / +window+1)', async () => {
    const petId = await makePet()
    const doses: VaccinationDraft[] = [
      dose({
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.rabies,
        vaccineName: 'Rabies',
        vaccinationDate: '2026-11-24',
        nextDueDate: '2026-11-25',
      }),
      dose({
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.dhpp,
        vaccineName: 'DHPP',
        vaccinationDate: '2026-11-24',
        nextDueDate: '2026-12-09',
      }),
      dose({
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.felv,
        vaccineName: 'FeLV',
        vaccinationDate: '2026-11-24',
        nextDueDate: '2026-12-10',
      }),
    ]
    for (const draft of doses) {
      await appendVaccination(draft, BOOSTER_NOW)
    }

    const views = await viewsFor([petId], 14)
    const byName = new Map(views.map((view) => [view.vaccineLabel, view]))
    expect(byName.get('Rabies')?.dueStatus).toBe('due_soon') // due today
    expect(byName.get('DHPP')?.dueStatus).toBe('due_soon') // +14
    expect(byName.get('FeLV')?.dueStatus).toBe('up_to_date') // +15, outside a 14-day window
  })
})

describe('vaccinations table helpers', () => {
  it('sorts by given (newest first), pet, vaccine, next due and status', async () => {
    const bella = await makePet('Bella', '900215004123456')
    const miso = await makePet('Miso', '900215004123457')
    await appendVaccination(
      dose({ petId: bella, vaccinationDate: '2025-01-09', nextDueDate: '2026-01-09' }),
      EARLY_NOW,
    )
    await appendVaccination(
      dose({
        petId: miso,
        vaccinationDate: '2026-10-01',
        nextDueDate: null,
        vaccineTypeId: VACCINE_TYPE_IDS.felv,
        vaccineName: 'FeLV',
      }),
      BOOSTER_NOW,
    )

    const views = await viewsFor([bella, miso])
    const byGivenDesc = sortVaccinationViews(views, 'given', 'desc')
    expect(byGivenDesc[0]?.dose.vaccinationDate).toBe('2026-10-01')
    const byPet = sortVaccinationViews(views, 'pet', 'asc')
    expect(byPet.map((view) => view.petLabel)).toEqual(['Bella', 'Miso'])
    const byNextAsc = sortVaccinationViews(views, 'next', 'asc')
    // "No booster set" always sorts last, whichever direction.
    expect(byNextAsc.at(-1)?.dose.nextDueDate).toBeNull()
    const byNextDesc = sortVaccinationViews(views, 'next', 'desc')
    expect(byNextDesc.at(-1)?.dose.nextDueDate).toBeNull()
    const byStatus = sortVaccinationViews(views, 'status', 'asc')
    expect(byStatus[0]?.chipStatus).toBe('overdue')
    expect(byStatus.at(-1)?.chipStatus).toBe('up_to_date')
  })

  it('derives vaccine filter options from the doses on record', async () => {
    const petId = await makePet()
    await appendVaccination(
      dose({ petId, vaccinationDate: '2025-01-09', nextDueDate: '2026-01-09' }),
      EARLY_NOW,
    )
    await appendVaccination(
      dose({
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.deworming,
        vaccineName: 'Deworming',
        vaccinationDate: '2026-11-01',
        nextDueDate: '2027-02-01',
      }),
      BOOSTER_NOW,
    )
    const options = vaccineFilterOptions(await viewsFor([petId]))
    expect(options.map((option) => option.label)).toEqual(['Deworming', 'Rabies'])
    expect(options.map((option) => option.key)).toEqual([
      `type:${VACCINE_TYPE_IDS.deworming}`,
      `type:${VACCINE_TYPE_IDS.rabies}`,
    ])
  })
})
