import { createJournalEntryViaUi } from './support/actions'
import { openApp } from './support/app'
/**
 * M4 · Two tabs on one IndexedDB (02 R5/R10, 06 §2 M5): a write in tab A must
 * appear in a mounted list in tab B without a manual refresh. The journal feed
 * is the mounted list because it is the first real cross-tab surface.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BISCUIT: SeedPet = { id: 'e2e-pet-biscuit', name: 'Biscuit', weightKg: 12.4 }

test('a journal write in one tab appears in the other tab without a refresh', async ({
  context,
}) => {
  const tabA = await context.newPage()
  await seedHousehold(tabA, { pets: [BISCUIT] })
  await openApp(tabA, '/journal')

  const tabB = await context.newPage()
  await openApp(tabB, '/journal')
  await expect(tabB.getByTestId('journal-feed').or(tabB.getByTestId('journal-empty'))).toBeVisible()

  await createJournalEntryViaUi(tabA, {
    petId: BISCUIT.id,
    kind: 'walk',
    note: 'Logged in tab A only',
  })

  // No reload, no focus switch: Dexie's live query must carry the write across.
  await expect(tabB.getByText('Logged in tab A only')).toBeVisible({ timeout: 5_000 })

  // Both tabs agree after a reload as well (the data is durable, not a broadcast).
  await tabB.reload()
  await expect(tabB.getByText('Logged in tab A only')).toBeVisible()
})
