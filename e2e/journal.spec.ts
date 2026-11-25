import { createJournalEntryViaUi } from './support/actions'
import { localDateISO, openApp, readStore } from './support/app'
/**
 * M4 · Journal (06 §2): create → day-grouped feed, edit time moves the day
 * section, kind stays immutable, delete confirms, the 3 s Undo restores the
 * entry, and the pet/kind filters survive reload.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BISCUIT: SeedPet = { id: 'e2e-pet-biscuit', name: 'Biscuit', weightKg: 12.4 }
const MISO: SeedPet = { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }

test.describe('journal', () => {
  test.beforeEach(async ({ page }) => {
    await seedHousehold(page, { pets: [BISCUIT, MISO] })
  })

  test('logs an entry under Today, and editing the date moves the day section', async ({
    page,
  }) => {
    await openApp(page, '/journal')
    const id = await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'walk',
      note: 'Morning loop around the park',
    })

    const today = localDateISO(0)
    await expect(page.getByTestId(`journal-day-${today}`)).toContainText('Morning loop')

    // Editing the local date moves the row to the right day section (R4/R6).
    await page.getByTestId(`journal-entry-${id}`).click()
    const editor = page.getByTestId('journal-editor')
    await editor.locator('[id="journal-inline-date"]').fill(localDateISO(-1))
    await page.getByTestId('journal-save').click()

    await expect(page.getByTestId(`journal-day-${localDateISO(-1)}`)).toContainText('Morning loop')
    const rows = await readStore<{ id: string; occurredAt: string }>(page, 'journal_entry')
    expect(rows.find((row) => row.id === id)).toBeDefined()
  })

  test('kind and pet are immutable while editing', async ({ page }) => {
    await openApp(page, '/journal')
    const id = await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'fed',
      note: 'Breakfast, all of it',
    })
    await page.getByTestId(`journal-entry-${id}`).click()
    const editor = page.getByTestId('journal-editor')
    await expect(editor.locator('[id="journal-inline-kind"]')).toBeDisabled()
    await expect(editor.locator('[id="journal-inline-pet"]')).toBeDisabled()
  })

  test('delete confirms, and Undo restores the entry inside the 3 s window', async ({ page }) => {
    await openApp(page, '/journal')
    const id = await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'note',
      note: 'Slightly limping on the left paw',
    })

    // The create toast also offers Undo for 3 s; let it expire so the next
    // assertion targets the delete toast unambiguously.
    await expect(page.getByTestId('toaster')).toHaveCount(0)

    // Delete → the toast offers Undo and restores the same row id.
    await page.getByTestId(`journal-entry-${id}`).click()
    await page.getByTestId(`journal-delete-${id}`).click()
    await expect(page.getByTestId('journal-delete-confirm')).toBeVisible()
    await page.getByTestId('journal-delete-confirm').click()
    await expect(page.getByTestId(`journal-entry-${id}`)).toHaveCount(0)

    const undo = page.getByTestId('journal-undo')
    await expect(undo).toBeVisible()
    await undo.click()
    await expect(page.getByTestId(`journal-entry-${id}`)).toBeVisible()

    // Delete again and let the whole 3 s window pass: the toast is gone and the
    // entry stays deleted (Undo is a window, not a permanent undo stack).
    await page.getByTestId(`journal-entry-${id}`).click()
    await page.getByTestId(`journal-delete-${id}`).click()
    await page.getByTestId('journal-delete-confirm').click()
    await expect(page.getByTestId(`journal-entry-${id}`)).toHaveCount(0)
    await page.waitForTimeout(3_300)
    await expect(page.getByTestId('toaster')).toHaveCount(0)
    await expect(page.getByTestId(`journal-entry-${id}`)).toHaveCount(0)
  })

  test('pet and kind filters survive a reload', async ({ page }) => {
    await openApp(page, '/journal')
    await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'walk',
      note: 'Walk with Biscuit',
      time: '08:00',
    })
    await createJournalEntryViaUi(page, {
      petId: MISO.id,
      kind: 'fed',
      note: 'Miso had dinner',
      time: '18:30',
    })

    await page.getByTestId('journal-filter-pet').selectOption(MISO.id)
    await page.getByTestId('journal-filter-kind').selectOption('fed')
    await expect(page).toHaveURL(/pet=e2e-pet-miso/)
    await expect(page).toHaveURL(/kind=fed/)

    await page.reload()
    await expect(page.getByTestId('journal-filter-pet')).toHaveValue(MISO.id)
    await expect(page.getByTestId('journal-filter-kind')).toHaveValue('fed')
    await expect(page.getByTestId('journal-feed')).toContainText('Miso had dinner')
    await expect(page.getByTestId('journal-feed')).not.toContainText('Walk with Biscuit')
  })

  test('pet detail Journal tab reuses the feed, editor and quick log for one pet', async ({
    page,
  }) => {
    await openApp(page, '/journal')
    const id = await createJournalEntryViaUi(page, {
      petId: BISCUIT.id,
      kind: 'note',
      note: 'Tab-scoped limping note',
    })

    // Deep link + the pet's tab marked active; the filter is the same data layer.
    await page.goto('/pets/e2e-pet-biscuit/journal')
    await expect(page.getByTestId('page-title')).toHaveText('Pet')
    await expect(page.getByTestId('pet-tab-journal')).toHaveAttribute('aria-current', 'page')
    await expect(page.getByTestId('pet-panel-journal')).toBeVisible()
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Tab-scoped limping note')

    // The shared inline editor opens from a row inside the tab.
    await page.getByTestId(`journal-entry-${id}`).click()
    const editor = page.getByTestId('journal-editor')
    await expect(editor).toHaveAttribute('data-mode', 'inline')
    await expect(editor.locator('[id="pet-journal-inline-kind"]')).toBeDisabled()
    await editor.locator('[id="pet-journal-inline-notes"]').fill('Tab edit: still limping')
    await page.getByTestId('journal-save').click()
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Tab edit: still limping')

    // Quick log is preselected to this pet and the live query shows it at once.
    await page.getByTestId('quick-log-fed').click()
    await expect(page.getByTestId(`pet-journal-day-${localDateISO(0)}`)).toContainText('Fed')

    // Deep link survives reload, and an unknown pet keeps the not-found state.
    await page.reload()
    await expect(page.getByTestId('pet-panel-journal')).toBeVisible()
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Tab edit: still limping')

    await page.goto('/pets/e2e-not-a-pet/journal')
    await expect(page.getByTestId('pet-not-found')).toBeVisible()
  })

  test('offers exactly one Log entry action, shared by the header, ?new=1 and the N shortcut', async ({
    page,
  }) => {
    // The header slot keeps the single primary action at every width; the filter
    // toolbar is filters + search + count only (t12).
    await page.setViewportSize({ width: 1440, height: 900 })
    await openApp(page, '/journal')
    await expect(page.getByRole('button', { name: 'Log entry' })).toHaveCount(1)
    await expect(page.getByTestId('journal-add')).toHaveCount(0)
    await expect(page.getByTestId('journal-filter-pet')).toBeVisible()
    await expect(page.getByTestId('journal-filter-kind')).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search journal' })).toBeVisible()
    await expect(page.getByTestId('journal-count')).toBeVisible()

    await page.setViewportSize({ width: 1024, height: 768 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Log entry' })).toHaveCount(1)
    await expect(page.getByTestId('journal-add')).toHaveCount(0)

    // Forced 72 px rail (<1024) keeps the same single header action.
    await page.setViewportSize({ width: 900, height: 800 })
    await page.reload()
    await expect(page.getByRole('button', { name: 'Log entry' })).toHaveCount(1)
    await expect(page.getByTestId('journal-add')).toHaveCount(0)

    // The deep-link create intent and the header action open the same Sheet.
    await page.goto('/journal?new=1')
    await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'sheet')
    await expect(page).not.toHaveURL(/new=1/)
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('journal-editor')).toHaveCount(0)

    await page.getByTestId('journal-add-header').click()
    await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'sheet')
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('journal-editor')).toHaveCount(0)

    // Plain N is the documented ⌘N fallback and routes through the same intent.
    await page.keyboard.press('n')
    await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'sheet')
    await expect(page).not.toHaveURL(/new=1/)
  })
})

test.describe('pet-detail journal tab (M4 wiring)', () => {
  test('deep-links to one pet, shows only its entries, and quick-logs into that pet', async ({
    page,
  }) => {
    const now = new Date()
    const entries = [
      {
        id: 'e2e-journal-bella-walk',
        petId: BISCUIT.id,
        kind: 'walk' as const,
        occurredAt: now.toISOString(),
        note: 'Biscuit park loop',
        durationMinutes: 30,
      },
      {
        id: 'e2e-journal-miso-fed',
        petId: MISO.id,
        kind: 'fed' as const,
        occurredAt: now.toISOString(),
        note: 'Miso dinner',
      },
    ]
    await seedHousehold(page, { pets: [BISCUIT, MISO], journal: entries })

    await openApp(page, `/pets/${BISCUIT.id}/journal`)
    await expect(page.getByTestId('pet-tab-journal')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Biscuit park loop')
    await expect(page.getByTestId('pet-panel-journal')).not.toContainText('Miso dinner')

    // Quick log from the tab writes through the same path, for this pet only.
    await page.getByTestId('quick-log-walk').click()
    await expect
      .poll(
        async () =>
          (await readStore<{ petId: string }>(page, 'journal_entry')).filter(
            (entry) => entry.petId === BISCUIT.id,
          ).length,
      )
      .toBe(2)
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Walk')

    // Edit an entry in the tab's inline editor.
    await page.getByTestId('journal-entry-e2e-journal-bella-walk').click()
    const editor = page.getByTestId('journal-editor')
    await expect(editor).toHaveAttribute('data-mode', 'inline')
    await editor.locator('[id="pet-journal-inline-notes"]').fill('Biscuit park loop, edited')
    await page.getByTestId('journal-save').click()
    await expect(page.getByTestId('pet-journal-feed')).toContainText('Biscuit park loop, edited')
  })
})
