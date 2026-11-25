/**
 * UI action helpers shared by more than one spec. Kept small: if an action is
 * used once it lives in its spec, so the readable sequence stays visible there.
 */
import { expect, type Page } from '@playwright/test'

import { localDateISO } from './app'

export interface JournalEntryInput {
  petId: string
  kind: string
  note: string
  date?: string
  time?: string
  durationMinutes?: string
}

/**
 * Creates a journal entry through the real editor (1440 px inline mode) and
 * returns its id, taken from the feed row's test id.
 */
export async function createJournalEntryViaUi(
  page: Page,
  input: JournalEntryInput,
): Promise<string> {
  await page.getByTestId('journal-add-header').click()
  const editor = page.getByTestId('journal-editor')
  await expect(editor).toHaveAttribute('data-mode', 'inline')
  await editor.locator('[id="journal-inline-pet"]').selectOption(input.petId)
  await editor.locator('[id="journal-inline-kind"]').selectOption(input.kind)
  await editor.locator('[id="journal-inline-date"]').fill(input.date ?? localDateISO(0))
  await editor.locator('[id="journal-inline-time"]').fill(input.time ?? '09:30')
  if (input.durationMinutes !== undefined) {
    await editor.locator('[id="journal-inline-duration"]').fill(input.durationMinutes)
  }
  await editor.locator('[id="journal-inline-notes"]').fill(input.note)
  await page.getByTestId('journal-save').click()

  const entry = page
    .getByTestId('journal-feed')
    .getByRole('button', { name: new RegExp(input.note) })
  await expect(entry).toBeVisible()
  const testId = await entry.getAttribute('data-testid')
  return (testId ?? '').replace('journal-entry-', '')
}
