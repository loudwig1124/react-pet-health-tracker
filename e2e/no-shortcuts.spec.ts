import { openApp } from './support/app'
/**
 * Shortcut removal guard (owner request, t14). The former global shortcuts must
 * do nothing at all: no palette, no navigation, no shortcut sheet, no rail
 * change, no console/page error. Mouse affordances are the only global path;
 * the palette still opens from the header Search button and keyboard use inside
 * widgets (typing, dialog Tab/Enter, palette arrows) is unaffected.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const SHORTCUT_PET: SeedPet = { id: 'e2e-pet-shortcuts', name: 'Biscuit', weightKg: 12.4 }

/** Every key that used to do something globally, including the aliases. */
const FORMER_KEYS = [
  'Meta+k',
  'Meta+1',
  'Meta+2',
  'Meta+3',
  'Meta+4',
  'Meta+5',
  'Meta+6',
  'Meta+n',
  'Meta+b',
  'Meta+,',
  'Control+k',
  'Control+1',
  'Control+2',
  'Control+3',
  'Control+4',
  'Control+5',
  'Control+6',
  'Control+n',
  'Control+b',
  'Control+,',
  '?',
  'Shift+?',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  'n',
  ',',
] as const

async function pressFormerKeys(page: Parameters<typeof openApp>[0]): Promise<void> {
  for (const key of FORMER_KEYS) {
    await page.keyboard.press(key)
  }
}

test('former shortcuts are inert on the dashboard: no palette, sheet, navigation or rail change', async ({
  page,
}) => {
  await seedHousehold(page, { pets: [SHORTCUT_PET] })
  await openApp(page, '/')

  const sidebar = page.getByTestId('app-sidebar')
  const title = page.getByTestId('page-title')
  await expect(sidebar).toHaveAttribute('data-state', 'expanded')
  await expect(title).toHaveText('Dashboard')

  await pressFormerKeys(page)

  await expect(page.getByTestId('command-palette')).toHaveCount(0)
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
  await expect(page.getByText('Keyboard shortcuts')).toHaveCount(0)
  await expect(title).toHaveText('Dashboard')
  await expect(page).toHaveURL(/\/$/)
  await expect(sidebar).toHaveAttribute('data-state', 'expanded')

  // The page is still alive and the mouse affordances do the former jobs.
  await page.getByTestId('nav-pets').click()
  await expect(title).toHaveText('Pets')
  await page.getByTestId('header-search').click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('command-palette')).toHaveCount(0)
})

test('former shortcuts are inert on a table route too', async ({ page }) => {
  await seedHousehold(page, { pets: [SHORTCUT_PET] })
  await openApp(page, '/pets')
  const title = page.getByTestId('page-title')
  const sidebar = page.getByTestId('app-sidebar')

  await pressFormerKeys(page)

  await expect(page.getByTestId('command-palette')).toHaveCount(0)
  await expect(page.getByTestId('shortcut-sheet')).toHaveCount(0)
  await expect(title).toHaveText('Pets')
  await expect(page).toHaveURL(/\/pets$/)
  await expect(sidebar).toHaveAttribute('data-state', 'expanded')

  // Typing still works inside a field: a field swallows digits/letters, and
  // that is typing, not a shortcut.
  const search = page.locator('#pets-search')
  await search.fill('')
  await expect(search).toHaveValue('')
  await search.press('2')
  await expect(search).toHaveValue('2')
  await search.press('n')
  await expect(search).toHaveValue('2n')
  await expect(title).toHaveText('Pets')
})
