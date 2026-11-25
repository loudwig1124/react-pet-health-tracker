import { localDateISO, minutesFromNow, openApp, readStore } from './support/app'
/**
 * M5 · Dashboard overview, sidebar attention counts and the desktop shell
 * extras (06 §2 M5, 05 F1/F2/F4). Counts must come from the same R1/R4 rules as
 * the lists, each counter drills into the filtered view, the sidebar badges
 * split overdue/due-soon and hide zeros, the recent-journal cap follows the
 * breakpoint table, and no service worker is registered.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BELLA: SeedPet = { id: 'e2e-pet-bella', name: 'Bella', species: 'Dog', weightKg: 12.4 }
const MISO: SeedPet = { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }
const COCO: SeedPet = { id: 'e2e-pet-coco', name: 'Coco', species: 'Dog', weightKg: 8.1 }

const dueData = {
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
      id: 'e2e-visit-today',
      petId: BELLA.id,
      scheduledAt: minutesFromNow(120).toISOString(),
      clinicName: 'Paws & Claws',
      purpose: 'Today check',
    },
  ],
  journal: [1, 2, 3, 4, 5, 6].map((index) => ({
    id: `e2e-journal-${index}`,
    petId: BELLA.id,
    kind: 'walk' as const,
    occurredAt: minutesFromNow(-index * 60).toISOString(),
    note: `Journal row ${index}`,
  })),
}

test('counters match the rules and each one drills into its filtered view', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  await expect(page.getByTestId('dashboard-counters')).toBeVisible()
  await expect(page.getByTestId('counter-pets')).toContainText('3')
  await expect(page.getByTestId('counter-overdue')).toContainText('1')
  await expect(page.getByTestId('counter-due-soon')).toContainText('1')
  await expect(page.getByTestId('counter-visits')).toContainText('1')
  await expect(page.getByTestId('attention-rail')).toContainText('Rabies')
  await expect(page.getByTestId('attention-row-e2e-dose-rabies')).toBeVisible()
  await expect(page.getByTestId('attention-row-e2e-dose-felv')).toBeVisible()
  await expect(page.getByTestId('next-visit')).toBeVisible()
  await expect(page.getByTestId('next-visit-row-e2e-visit-today')).toContainText('Today check')

  // The overdue counter lands on the filtered vaccinations view (R1 status).
  await page.getByTestId('counter-overdue').click()
  await expect(page).toHaveURL(/\/vaccinations\?status=overdue/)
  await expect(page.getByTestId('vaccinations-table')).toContainText('Rabies')
  await expect(page.getByTestId('vaccinations-table')).not.toContainText('FeLV')
})

test('sidebar badges split overdue/due-soon and hide zero counts', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  const vaccinationsBadge = page.getByTestId('nav-badge-vaccinations')
  await expect(vaccinationsBadge).toBeVisible()
  await expect(vaccinationsBadge).toHaveAttribute('data-count', '2')
  await expect(vaccinationsBadge).toHaveAttribute('title', '1 overdue · 1 due soon')

  const appointmentsBadge = page.getByTestId('nav-badge-appointments')
  await expect(appointmentsBadge).toHaveAttribute('data-count', '1')
  await expect(appointmentsBadge).toHaveAttribute('title', /1 visit booked today/)
})

test('sidebar badges hide when nothing needs attention', async ({ page }) => {
  await seedHousehold(page, { pets: [COCO] })
  await openApp(page, '/')

  await expect(page.getByTestId('nav-badge-vaccinations')).toHaveCount(0)
  await expect(page.getByTestId('nav-badge-appointments')).toHaveCount(0)
})

test('recent-journal cap follows the breakpoint table (3 / 4 / 5 / 6 rows)', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  const visibleRows = async (): Promise<number> => {
    const rows = page.locator('[data-testid^="recent-journal-row-"]')
    const total = await rows.count()
    let visible = 0
    for (let index = 0; index < total; index += 1) {
      if (await rows.nth(index).isVisible()) {
        visible += 1
      }
    }
    return visible
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByTestId('recent-journal')).toBeVisible()
  expect(await visibleRows()).toBe(6)

  await page.setViewportSize({ width: 1280, height: 800 })
  expect(await visibleRows()).toBe(5)

  await page.setViewportSize({ width: 1024, height: 768 })
  expect(await visibleRows()).toBe(4)

  await page.setViewportSize({ width: 900, height: 800 })
  expect(await visibleRows()).toBe(3)
})

test('no service worker is registered and the dashboard stays under the DOM budget', async ({
  page,
}) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  const registrations = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return []
    }
    return (await navigator.serviceWorker.getRegistrations()).map(
      (registration) => registration.scope,
    )
  })
  expect(registrations).toEqual([])
  expect(await page.evaluate(() => document.querySelectorAll('*').length)).toBeLessThanOrEqual(1200)

  // The dashboard reads the same rows the counters describe.
  const doses = await readStore<{ id: string }>(page, 'vaccination')
  expect(doses.map((dose) => dose.id).sort()).toEqual(['e2e-dose-felv', 'e2e-dose-rabies'])
})

test('⌘K palette searches pets, navigates, and closes with Escape', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await expect(page.getByTestId('command-input')).toBeFocused()

  // Search matches the R1/R4 read model, not a second data path.
  await page.getByTestId('command-input').fill('Bella')
  await expect(page.getByTestId('command-group-pets')).toBeVisible()
  await expect(page.getByTestId('command-item-pet:e2e-pet-bella')).toBeVisible()

  await page.keyboard.press('Enter')
  await expect(page.getByTestId('command-palette')).toHaveCount(0)
  await expect(page).toHaveURL(/\/pets\/e2e-pet-bella(\/health)?$/)
  await expect(page.getByTestId('pet-name')).toHaveText('Bella')

  // Escape closes without navigating.
  await openApp(page, '/')
  await page.keyboard.press('Meta+k')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette')).toHaveCount(0)
  await expect(page).toHaveURL(/\/$/)
})

test('⌘N opens the create commands and a create command opens its dialog', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  await page.keyboard.press('Meta+n')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await expect(page.getByTestId('command-group-create')).toBeVisible()
  await page.getByTestId('command-item-create:visit').click()

  // The route consumes `?new=1` immediately, so the open dialog (not the URL
  // parameter) is the stable assertion; the path proves where it landed.
  await expect(page.getByTestId('booking-form')).toBeVisible()
  await expect(page).toHaveURL(/\/appointments(\?new=1)?$/)
})

test('palette groups never exceed 8 results and the shortcut sheet opens with ?', async ({
  page,
}) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  await page.keyboard.press('Meta+k')
  await page.getByTestId('command-input').fill('a')
  await expect(page.getByTestId('command-palette')).toBeVisible()
  const groups = page.locator('[data-testid^="command-group-"]')
  const groupCount = await groups.count()
  expect(groupCount).toBeGreaterThan(0)
  for (let index = 0; index < groupCount; index += 1) {
    const items = groups.nth(index).locator('[data-testid^="command-item-"]')
    expect(await items.count(), `group ${index} exceeds the 8-result cap`).toBeLessThanOrEqual(8)
  }
  await page.keyboard.press('Escape')

  // `?` outside a field opens the lazy shortcut sheet; Escape closes it.
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
  await page.keyboard.press('Shift+?')
  await expect(page.getByTestId('shortcut-sheet')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
})

test('documented plain-key aliases navigate, create and stay out of fields', async ({ page }) => {
  await seedHousehold(page, dueData)
  await openApp(page, '/')

  // Plain 2-6 outside a field are the documented ⌘-reserved aliases (03 §2).
  await page.keyboard.press('2')
  await expect(page.getByTestId('page-title')).toHaveText('Pets')
  await page.keyboard.press('6')
  await expect(page.getByTestId('page-title')).toHaveText('Journal')

  // Plain N means "create on this screen" (the route consumes ?new=1 and opens
  // its dialog, so the dialog — not the URL — is the stable assertion).
  await page.keyboard.press('2')
  await expect(page.getByTestId('page-title')).toHaveText('Pets')
  await page.keyboard.press('n')
  await expect(page.getByTestId('pet-form')).toBeVisible()
  await page.getByTestId('pet-form-cancel').click()
  await expect(page.getByTestId('pet-form')).toHaveCount(0)

  // A field swallows the alias: typing "2" must not navigate.
  await openApp(page, '/pets')
  await page.locator('#pets-search').fill('')
  await page.locator('#pets-search').press('2')
  await expect(page.getByTestId('page-title')).toHaveText('Pets')
  await expect(page.locator('#pets-search')).toHaveValue('2')
})
