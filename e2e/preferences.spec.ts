import { createJournalEntryViaUi } from './support/actions'
import { localDateISO, openApp, readStore, writeStore } from './support/app'
/**
 * M4 · Profile, preferences, sample data, reset and first run (06 §2 M4).
 *
 * Preferences must survive reload and re-render open screens (R2); the sample
 * toggle must delete exactly the demo rows (R7); reset keeps the owner name
 * unless "also forget" is checked (R8) and returns to the first-run takeover;
 * first run creates a household through the real form.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, TEST_OWNER_NAME, type SeedPet } from './support/household'

const BISCUIT: SeedPet = { id: 'e2e-pet-biscuit', name: 'Biscuit', weightKg: 12.4 }

async function waitForFirstRun(page: Parameters<typeof openApp>[0]): Promise<void> {
  await expect(page.getByTestId('first-run')).toBeVisible()
  await expect(page.getByTestId('app-shell')).toHaveCount(0)
}

test.describe('profile and preferences', () => {
  test.beforeEach(async ({ page }) => {
    await seedHousehold(page, { pets: [BISCUIT] })
  })

  test('owner name edits persist across reload', async ({ page }) => {
    await openApp(page, '/profile')
    // The display <p> and the dialog <input> share the hook; scope by container.
    const display = page.getByTestId('profile-owner').getByTestId('profile-owner-name')
    await expect(display).toHaveText(TEST_OWNER_NAME)

    await page.getByTestId('profile-owner-edit').click()
    const dialog = page.getByRole('dialog')
    await dialog.getByTestId('profile-owner-name').fill('Jordan Lee')
    await page.getByTestId('profile-owner-save').click()
    await expect(display).toHaveText('Jordan Lee')

    await page.reload()
    await expect(display).toHaveText('Jordan Lee')
    const owners = await readStore<{ name: string }>(page, 'owner')
    expect(owners[0]?.name).toBe('Jordan Lee')
  })

  test('due-soon window, weight unit and density persist and re-render open screens', async ({
    page,
  }) => {
    await openApp(page, '/profile')

    await page.getByTestId('settings-window').selectOption('14')
    await page.getByTestId('settings-units').selectOption('lb')
    await page.getByRole('radio', { name: 'Compact' }).click()

    // 12.4 kg renders as 27.3 lb everywhere the weight is shown (R2).
    await expect(page.getByTestId('profile-pets')).toContainText('27.3 lb')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')

    await page.reload()
    await expect(page.getByTestId('settings-window')).toHaveValue('14')
    await expect(page.getByTestId('settings-units')).toHaveValue('lb')
    await expect(page.locator('html')).toHaveAttribute('data-density', 'compact')
    await expect(page.getByTestId('profile-pets')).toContainText('27.3 lb')
  })

  test('density changes spacing only: feed rows go 64 px → 52 px', async ({ page }) => {
    await openApp(page, '/journal')
    const id = await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'walk',
      note: 'Density probe',
    })
    const row = page.getByTestId(`journal-entry-${id}`)
    const comfortable = await row.evaluate((element) => ({
      minHeight: getComputedStyle(element).minHeight,
      fontSize: getComputedStyle(element).fontSize,
    }))
    expect(comfortable.minHeight).toBe('64px')

    await openApp(page, '/profile')
    await page.getByRole('radio', { name: 'Compact' }).click()
    await openApp(page, '/journal')
    const compactRow = page.getByTestId(`journal-entry-${id}`)
    const compact = await compactRow.evaluate((element) => getComputedStyle(element).minHeight)
    expect(compact).toBe('52px')
    // Type size never changes with density (03 §6): compare to the value
    // measured in comfortable mode, not to a hard-coded font size.
    const fontSize = await compactRow.evaluate((element) => getComputedStyle(element).fontSize)
    expect(fontSize).toBe(comfortable.fontSize)
  })

  test('sample data toggles on and off without touching user rows (R7)', async ({ page }) => {
    await openApp(page, '/profile')
    const toggle = page.getByTestId('settings-sample-toggle')
    await expect(toggle).not.toBeChecked()

    await toggle.click()
    await expect(toggle).toBeChecked()
    await expect
      .poll(async () => (await readStore<{ id: string }>(page, 'pet')).map((pet) => pet.id))
      .toEqual(expect.arrayContaining(['demo-pet-bella', 'demo-pet-miso', 'e2e-pet-biscuit']))

    await toggle.click()
    await expect(toggle).not.toBeChecked()
    await expect
      .poll(async () => (await readStore<{ id: string }>(page, 'pet')).map((pet) => pet.id))
      .toEqual(['e2e-pet-biscuit'])

    await page.reload()
    await expect(page.getByTestId('settings-sample-toggle')).not.toBeChecked()
  })

  test('reset keeps the owner name unless "also forget" is checked (R8)', async ({ page }) => {
    await openApp(page, '/profile')
    await page.getByTestId('settings-reset').click()
    await expect(page.getByTestId('settings-reset-forget')).not.toBeChecked()
    await page.getByTestId('settings-reset-confirm').click()

    await waitForFirstRun(page)
    await expect(page.getByTestId('first-run-name')).toHaveValue(TEST_OWNER_NAME)
    await expect.poll(async () => readStore(page, 'pet')).toEqual([])
    await expect.poll(async () => readStore(page, 'journal_entry')).toEqual([])
    const owners = await readStore<{ name: string }>(page, 'owner')
    expect(owners[0]?.name).toBe(TEST_OWNER_NAME)
  })

  test('"also forget my details" clears the name and contacts', async ({ page }) => {
    await openApp(page, '/profile')
    await page.getByTestId('settings-reset').click()
    await page.getByTestId('settings-reset-forget').check()
    await page.getByTestId('settings-reset-confirm').click()

    await waitForFirstRun(page)
    await expect(page.getByTestId('first-run-name')).toHaveValue('')
    const owners = await readStore<{ name: string; email: string; phone: string }>(page, 'owner')
    expect(owners[0]?.name).toBe('My household')
    expect(owners[0]?.email).toBe('')
    expect(owners[0]?.phone).toBe('')
  })
})

test.describe('first run', () => {
  test('creates a household through the takeover and never returns on reload', async ({ page }) => {
    await page.goto('/')
    await waitForFirstRun(page)

    await page.getByTestId('first-run-name').fill('Rio Santos')
    await page.getByTestId('first-run-pet-name').fill('Biscuit')
    await page.getByTestId('first-run-species').selectOption('Dog')
    await page.getByTestId('first-run-weight').fill('12.4')
    await page.getByTestId('first-run-dob').fill(localDateISO(-400))
    await page.getByTestId('first-run-create').click()

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('dashboard-greeting')).toContainText('Rio')

    const pets = await readStore<{ name: string; species: string }>(page, 'pet')
    expect(pets).toHaveLength(1)
    expect(pets[0]).toMatchObject({ name: 'Biscuit', species: 'Dog' })

    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByTestId('first-run')).toHaveCount(0)
  })

  test('the sample-household shortcut seeds the demo rows and leaves the shell usable', async ({
    page,
  }) => {
    await page.goto('/')
    await waitForFirstRun(page)
    await page.getByTestId('first-run-sample').click()

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect
      .poll(async () => (await readStore<{ id: string }>(page, 'pet')).map((pet) => pet.id))
      .toEqual(expect.arrayContaining(['demo-pet-bella', 'demo-pet-miso']))

    await openApp(page, '/profile')
    await expect(page.getByTestId('settings-sample-toggle')).toBeChecked()
  })
})

/**
 * One guard for the M4 first-run gate itself: a fresh context sees the
 * takeover on every path, and the old M1 assumption (dashboard on `/`) only
 * holds for a seeded household.
 */
test('first run takes over any path on a fresh browser profile', async ({ page }) => {
  await page.goto('/pets')
  await waitForFirstRun(page)
})

/**
 * Kept here so an empty household can be prepared through the raw helper in a
 * test that is not about reset: a named owner with zero pets must not show the
 * takeover (06 M4: "only while owner unnamed and no pets exist").
 */
test('a named owner with no pets does not get ambushed by first run', async ({ page }) => {
  await page.goto('/profile')
  await expect(page.getByTestId('app-shell').or(page.getByTestId('first-run'))).toBeVisible()
  await writeStore(page, 'owner', [
    {
      id: 'owner',
      name: TEST_OWNER_NAME,
      email: '',
      phone: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ])
  await page.reload()
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('first-run')).toHaveCount(0)
})
