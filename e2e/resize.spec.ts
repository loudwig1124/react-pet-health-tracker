import { expectNoHorizontalOverflow, openApp } from './support/app'
import { seedHousehold, type SeedPet } from './support/household'

const RESIZE_PET: SeedPet = { id: 'e2e-pet-resize', name: 'Biscuit', weightKg: 12.4 }

test.beforeEach(async ({ page }) => {
  await seedHousehold(page, { pets: [RESIZE_PET] })
})
/**
 * Live-resize gate (06 §2 M5, 03 §1 responsive table): 1440 → 1024 → 900 on
 * every composition that has its own responsive rule. The sidebar must
 * collapse only below its 1024 px floor (the footer degrades to avatar-only there), the
 * document must never scroll sideways, and the journal editor must convert to
 * a Sheet below 1280 px — all without console errors.
 *
 * The dashboard case is green from M1; the table, journal-editor and pet-detail
 * cases are extended in as their milestones land (06 §2 M2/M3/M4).
 */
import { expect, test } from './support/fixtures'

const SIZES = [
  { width: 1440, height: 900, sidebar: 'expanded', header: 64 },
  { width: 1024, height: 768, sidebar: 'expanded', header: 64 },
  { width: 900, height: 800, sidebar: 'collapsed', header: 56 },
] as const

test('dashboard: 1440 → 1024 → 900 keeps the rail, avatar footer and no overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', size.sidebar)
    // The header height eases across the breakpoint; poll rather than reading
    // the first frame of the transition.
    await expect
      .poll(
        async () =>
          await page
            .getByTestId('app-header')
            .evaluate((element) => element.getBoundingClientRect().height),
        { timeout: 1500 },
      )
      .toBe(size.header)
    await expectNoHorizontalOverflow(page, `dashboard @${size.width}`)

    if (size.width < 1024) {
      // Forced rail: the footer is the avatar only, but it is still reachable
      // and announces the owner (03 §2).
      await expect(page.getByTestId('footer-owner-name')).toHaveCount(0)
      await expect(page.getByTestId('nav-profile')).toBeVisible()
      const label = await page.getByTestId('nav-profile').getAttribute('aria-label')
      expect(label ?? '').toMatch(/profile/i)
      await expect(page.getByTestId('sidebar-toggle')).toHaveCount(0)
    }
  }

  // Back up: the rail expands again at 1440 and the footer shows the name.
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
  await expect(page.getByTestId('footer-owner-name')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'dashboard @1440 again')
})

test('a table (/pets) collapses the rail and never scrolls the page sideways', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, '/pets')
  await expect(page.getByTestId('pets-table')).toBeVisible()

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', size.sidebar)
    await expect(page.getByTestId('pets-table')).toBeVisible()
    await expectNoHorizontalOverflow(page, `pets table @${size.width}`)
    if (size.width < 1024) {
      await expect(page.getByTestId('footer-owner-name')).toHaveCount(0)
    }
  }
})

test('the journal editor converts to a Sheet below 1280 and back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, '/journal')

  await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'inline')
  await expect(page.getByTestId('journal-editor')).toBeVisible()

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
  // The same draft opens in a Sheet instead of the third column.
  await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'sheet')
  await expect(page.getByTestId('journal-sheet')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'journal sheet @1024')

  await page.setViewportSize({ width: 900, height: 800 })
  await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'sheet')
  await expect(page.getByTestId('journal-sheet')).toBeVisible()
  await expectNoHorizontalOverflow(page, 'journal sheet @900')

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'inline')
  await expect(page.getByTestId('journal-sheet')).toHaveCount(0)
})

test('a pet detail keeps the rail, tabs and layout at every width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page, `/pets/${RESIZE_PET.id}/health`)
  await expect(page.getByTestId('pet-detail')).toBeVisible()

  for (const size of SIZES) {
    await page.setViewportSize({ width: size.width, height: size.height })
    await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', size.sidebar)
    await expect(page.getByTestId('pet-name')).toHaveText(RESIZE_PET.name)
    await expect(page.getByTestId('pet-about')).toBeVisible()
    await expect(page.getByTestId('pet-tabs')).toBeVisible()
    await expectNoHorizontalOverflow(page, `pet detail @${size.width}`)
  }
})
