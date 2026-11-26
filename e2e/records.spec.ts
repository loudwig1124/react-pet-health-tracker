import { openApp } from './support/app'
/**
 * Clinical notes — record, correct, delete (R5, amended 2026-11-27).
 *
 * The notes tab was append-only, so a misclicked diagnosis could never be fixed.
 * These specs drive the correction flow on the real build: the dialog prefills
 * from the stored row, saving replaces it in place, and delete only happens after
 * the second confirming click.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BELLA: SeedPet = { id: 'e2e-pet-bella', name: 'Bella', species: 'Dog', weightKg: 12.4 }

test.beforeEach(async ({ page }) => {
  await seedHousehold(page, { pets: [BELLA] })
})

test('a note can be recorded, corrected in place, and deleted after a confirm', async ({
  page,
}) => {
  await openApp(page, '/records')

  // Record a note with a typo in the condition.
  await page.getByTestId('record-add').click()
  const form = page.getByTestId('record-form')
  await expect(form).toBeVisible()
  await page.locator('#record-condition').fill('Ear infektion')
  await page.locator('#record-diagnosis').fill('Bacterial otitis')
  await page.getByTestId('record-submit').click()
  await expect(form).toHaveCount(0)

  const row = page.locator('[data-testid^="record-row-"]').first()
  await expect(row).toContainText('Ear infektion')
  const rowId = (await row.getAttribute('data-testid')) ?? ''
  const recordId = rowId.replace('record-row-', '')

  // Correct it: the dialog comes back prefilled, and saving replaces the row.
  await page.getByTestId(`record-edit-${recordId}`).click()
  await expect(page.getByTestId('record-form')).toBeVisible()
  await expect(page.locator('#record-condition')).toHaveValue('Ear infektion')
  await page.locator('#record-condition').fill('Ear infection')
  await page.getByTestId('record-submit').click()
  await expect(page.getByTestId('record-form')).toHaveCount(0)
  await expect(page.getByTestId(`record-row-${recordId}`)).toContainText('Ear infection')
  await expect(page.locator('[data-testid^="record-row-"]')).toHaveCount(1)

  // Delete asks once; the row survives the first click.
  await page.getByTestId(`record-edit-${recordId}`).click()
  const remove = page.getByTestId('record-delete')
  await remove.click()
  await expect(remove).toHaveText('Delete permanently?')
  await expect(page.getByTestId(`record-row-${recordId}`)).toBeVisible()
  await remove.click()
  await expect(page.getByTestId(`record-row-${recordId}`)).toHaveCount(0)
})
