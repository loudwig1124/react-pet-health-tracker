/**
 * Gate screenshots (06 §2/§5 "screenshots of the demo-able state"): the real
 * preview build with a populated household at 1440, 1024 and the forced 72 px
 * rail. Written to `docs/build/shots/` and prefixed with the gate they belong
 * to, so the captain can show them.
 *
 *   GATE=m3 pnpm e2e --grep @shots
 *   GATE=m5 pnpm e2e --grep @shots
 *   GATE=polish SHOT_ROUTES=journal SHOT_SIZES=1024,1440 pnpm e2e --grep @shots
 *
 * SHOT_ROUTES / SHOT_SIZES are optional comma lists for a focused refresh (used
 * by the t12 polish shots), so a single-screen fix does not rewrite every gate
 * screenshot.
 *
 * The household is seeded through the shared raw fixture (the same rows the
 * repositories write) so the screenshots show data even before every create
 * flow has been exercised.
 */
import { mkdirSync } from 'node:fs'
import path from 'node:path'

import type { Page } from '@playwright/test'

import { localDateISO, minutesFromNow, openApp } from './support/app'
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

export const GATE = process.env.GATE ?? 'local'
export const GATE_LABEL = /^\d+$/.test(GATE) ? `m${GATE}` : GATE
export const SHOTS_DIR = path.resolve(process.cwd(), 'docs/build/shots')

mkdirSync(SHOTS_DIR, { recursive: true })

const BELLA: SeedPet = {
  id: 'e2e-pet-bella',
  name: 'Bella',
  species: 'Dog',
  breed: 'Golden Retriever mix',
  sex: 'female',
  dateOfBirth: localDateISO(-1300),
  weightKg: 12.4,
}
const MISO: SeedPet = {
  id: 'e2e-pet-miso',
  name: 'Miso',
  species: 'Cat',
  breed: 'Domestic shorthair',
  weightKg: 4.2,
}
const COCO: SeedPet = { id: 'e2e-pet-coco', name: 'Coco', species: 'Dog', weightKg: 8.1 }

const ALL_ROUTES = [
  ['dashboard', '/', 'dashboard-counters'],
  ['pets', '/pets', 'pets-table'],
  ['appointments', '/appointments', 'appointments-table'],
  ['journal', '/journal', 'journal-feed'],
] as const

const ALL_SIZES = [
  { width: 1440, height: 900 },
  { width: 1024, height: 768 },
  { width: 900, height: 800 },
] as const

const ROUTE_FILTER = process.env.SHOT_ROUTES?.split(',').map((name) => name.trim())
const SIZE_FILTER = process.env.SHOT_SIZES?.split(',').map((width) => Number(width.trim()))

const ROUTES =
  ROUTE_FILTER === undefined
    ? ALL_ROUTES
    : ALL_ROUTES.filter(([name]) => ROUTE_FILTER.includes(name))
const SIZES =
  SIZE_FILTER === undefined
    ? ALL_SIZES
    : ALL_SIZES.filter((size) => SIZE_FILTER.includes(size.width))

async function seedDemo(page: Page): Promise<void> {
  await seedHousehold(page, {
    pets: [BELLA, MISO, COCO],
    vaccinations: [
      {
        id: 'e2e-dose-rabies',
        petId: BELLA.id,
        vaccineName: 'Rabies',
        vaccineTypeId: 'vaccine-rabies',
        vaccinationDate: localDateISO(-400),
        nextDueDate: localDateISO(-35),
      },
      {
        id: 'e2e-dose-felv',
        petId: MISO.id,
        vaccineName: 'FeLV',
        vaccineTypeId: 'vaccine-felv',
        vaccinationDate: localDateISO(-355),
        nextDueDate: localDateISO(10),
      },
    ],
    appointments: [
      {
        id: 'e2e-visit-upcoming',
        petId: BELLA.id,
        scheduledAt: minutesFromNow(3 * 24 * 60).toISOString(),
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Annual wellness check',
      },
      {
        id: 'e2e-visit-completed',
        petId: MISO.id,
        scheduledAt: minutesFromNow(-10 * 24 * 60).toISOString(),
        status: 'completed',
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Dental cleaning',
      },
    ],
    records: [
      {
        id: 'e2e-record-otitis',
        petId: BELLA.id,
        recordedOn: localDateISO(-5),
        condition: 'Ear infection',
        diagnosis: 'Otitis externa',
      },
    ],
    journal: [
      {
        id: 'e2e-journal-walk',
        petId: BELLA.id,
        kind: 'walk',
        occurredAt: new Date().toISOString(),
        note: 'Morning loop around the park',
        durationMinutes: 30,
      },
      {
        id: 'e2e-journal-fed',
        petId: MISO.id,
        kind: 'fed',
        occurredAt: minutesFromNow(-60 * 22).toISOString(),
        note: 'Dinner, all of it',
      },
      {
        id: 'e2e-journal-note',
        petId: BELLA.id,
        kind: 'note',
        occurredAt: minutesFromNow(-60 * 60).toISOString(),
        note: 'Slightly limping on the left paw after the dog park',
      },
    ],
  })
}

test('real screens at 1440, 1024 and the 72 px rail @shots', async ({ page }) => {
  await seedDemo(page)

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    for (const [name, route, readyTestId] of ROUTES) {
      await openApp(page, route)
      await page.getByTestId('page-title').waitFor()
      // Wait for the route's live data, not just the shell: a screenshot of a
      // skeleton would not be evidence of the demo-able state.
      await page
        .getByTestId(readyTestId)
        .or(page.getByTestId(`${name}-empty`))
        .first()
        .waitFor()
      expect(await page.getByTestId(readyTestId).count()).toBeGreaterThan(0)
      // Let the page-in animation settle.
      await page.waitForTimeout(250)
      await page.screenshot({
        path: path.join(SHOTS_DIR, `${GATE_LABEL}-${size.width}-${name}.png`),
        animations: 'disabled',
      })
    }
  }
})

test('full-width edge screenshots at 1440 and 1024 @shots', async ({ page }) => {
  await seedDemo(page)

  const edgeSizes = [
    { width: 1440, height: 900 },
    { width: 1024, height: 768 },
  ] as const

  for (const size of edgeSizes) {
    await page.setViewportSize({ width: size.width, height: size.height })
    for (const [name, route, readyTestId] of ALL_ROUTES) {
      await openApp(page, route)
      await page
        .getByTestId(readyTestId)
        .or(page.getByTestId(`${name}-empty`))
        .first()
        .waitFor()
      await page.waitForTimeout(250)
      await page.screenshot({
        path: path.join(SHOTS_DIR, `edge-${size.width}-${name}.png`),
        animations: 'disabled',
      })
    }
  }
})
