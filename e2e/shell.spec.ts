import type { Page } from '@playwright/test'

import { seedHousehold, TEST_OWNER_NAME, type SeedPet } from './support/household'

/** From M4 a fresh browser context shows the first-run takeover on any path. */
const SHELL_PET: SeedPet = { id: 'e2e-pet-shell', name: 'Biscuit', weightKg: 12.4 }

test.beforeEach(async ({ page }) => {
  await seedHousehold(page, { pets: [SHELL_PET] })
})

import {
  DESTINATIONS,
  ROUTES,
  expectNoHorizontalOverflow,
  expectTitle,
  openApp,
} from './support/app'
import { expect, test } from './support/fixtures'

/**
 * M1 shell smoke (06 §2): boot, every route deep-links and reloads, six
 * destinations + the Profile footer reachable by mouse and ⌘1–6, rail
 * behaviour while resizing 1440 → 1024 → 900, visible focus, `/settings`
 * falling through to the in-shell 404, zero console errors. Runs against
 * `vite preview` of the production build, in Chromium.
 */

/** Waits for every route's lazy chunk to have rendered past the fallback. */
async function expectRouteReady(page: Page, path: string, title: string): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('page-title')).toHaveText(title)
}

test('boots at 1440: six destinations, icons, owner footer and 64px header', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)

  await expectTitle(page, 'Dashboard')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')

  for (const [key] of DESTINATIONS) {
    const item = page.getByTestId(`nav-${key}`)
    await expect(item).toBeVisible()
    await expect(item.locator('svg')).toBeVisible()
  }

  await expect(page.getByTestId('nav-profile')).toBeVisible()
  await expect(page.getByTestId('footer-owner-name')).toHaveText(TEST_OWNER_NAME)

  const headerHeight = await page
    .getByTestId('app-header')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(headerHeight).toBe(64)
  await expectNoHorizontalOverflow(page)
})

test('boots at 1024 directly: rail by default, deep link survives reload', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await expectRouteReady(page, ROUTES.journal, 'Journal')

  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'collapsed')
  await page.reload()
  await expect(page.getByTestId('page-title')).toHaveText('Journal')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'collapsed')
  await expect(page.getByTestId('nav-profile')).toBeVisible()
  await expectNoHorizontalOverflow(page)

  // On-demand expansion is offered at 1024–1279 (not forced rail).
  await page.getByTestId('sidebar-toggle').click()
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
})

test('every destination deep-links and survives reload', async ({ page }) => {
  const routes: readonly (readonly [string, string])[] = [
    [ROUTES.dashboard, 'Dashboard'],
    [ROUTES.pets, 'Pets'],
    [ROUTES.appointments, 'Appointments'],
    [ROUTES.vaccinations, 'Vaccinations'],
    [ROUTES.records, 'Health records'],
    [ROUTES.journal, 'Journal'],
    [ROUTES.profile, 'Profile'],
  ]

  for (const [path, title] of routes) {
    await expectRouteReady(page, path, title)
    await page.reload()
    await expect(page.getByTestId('page-title')).toHaveText(title)
    await expect(page.getByTestId('app-sidebar')).toBeVisible()
  }

  await page.goto('/pets/demo-pet-bella/vaccinations')
  await expect(page.getByTestId('pet-detail-route')).toHaveAttribute(
    'data-pet-id',
    'demo-pet-bella',
  )
  await expect(page.getByTestId('pet-detail-route')).toHaveAttribute('data-pet-tab', 'vaccinations')
})

test('mouse navigation reaches all six destinations and the Profile footer', async ({ page }) => {
  await openApp(page)

  for (const [key, title] of DESTINATIONS) {
    if (key === 'dashboard') {
      continue
    }
    await page.getByTestId(`nav-${key}`).click()
    await expectTitle(page, title)
    await expect(page.getByTestId(`nav-${key}`)).toHaveAttribute('data-active', 'true')
  }

  await page.getByTestId('nav-profile').click()
  await expect(page).toHaveURL(/\/profile$/)
  await expectTitle(page, 'Profile')
})

test('⌘1–6 navigate, ⌘B toggles the rail and ⌘, opens Profile', async ({ page }) => {
  await openApp(page)

  await page.keyboard.press('Meta+2')
  await expectTitle(page, 'Pets')

  await page.keyboard.press('Meta+6')
  await expectTitle(page, 'Journal')

  await page.keyboard.press('Meta+1')
  await expectTitle(page, 'Dashboard')

  await page.keyboard.press('Meta+b')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'collapsed')
  await page.keyboard.press('Meta+b')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')

  await page.keyboard.down('Meta')
  await page.keyboard.press(',')
  await page.keyboard.up('Meta')
  await expectTitle(page, 'Profile')
})

test('live resize 1440 → 1024 → 900 collapses to the rail without overflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await openApp(page)
  const sidebar = page.getByTestId('app-sidebar')
  await expect(sidebar).toHaveAttribute('data-state', 'expanded')
  await expectNoHorizontalOverflow(page, '1440')

  await page.setViewportSize({ width: 1024, height: 768 })
  await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  // 64 px at 1024; 56 px only below it (03 §1).
  const header1024 = await page
    .getByTestId('app-header')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(header1024).toBe(64)
  await expect(page.getByTestId('nav-profile')).toBeVisible()
  await expectNoHorizontalOverflow(page, '1024')

  // The footer stays reachable at 1024 — expandable on demand there.
  await page.getByTestId('sidebar-toggle').click()
  await expect(sidebar).toHaveAttribute('data-state', 'expanded')
  await page.getByTestId('nav-profile').click()
  await expect(page).toHaveURL(/\/profile$/)

  await page.setViewportSize({ width: 900, height: 800 })
  await expect(sidebar).toHaveAttribute('data-state', 'collapsed')
  const compactHeader = await page
    .getByTestId('app-header')
    .evaluate((element) => element.getBoundingClientRect().height)
  expect(compactHeader).toBe(56)
  await expect(page.getByTestId('sidebar-toggle')).toHaveCount(0)
  await expect(page.getByTestId('nav-profile')).toBeVisible()
  await expect(page.getByTestId('footer-owner-name')).toHaveCount(0) // avatar only in the rail
  await expectNoHorizontalOverflow(page, '900')
})

test('keyboard focus stays visible after the rail collapses', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await openApp(page)

  await page.keyboard.press('Tab')
  const focus = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null
    if (element === null) {
      return null
    }
    const style = getComputedStyle(element)
    return {
      label: element.getAttribute('aria-label') ?? element.textContent?.trim() ?? '',
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    }
  })
  expect(focus).not.toBeNull()
  expect(focus?.label.length).toBeGreaterThan(0)
  const visible =
    (focus?.outlineStyle !== 'none' && parseFloat(focus?.outlineWidth ?? '0') > 0) ||
    (focus?.boxShadow !== 'none' && (focus?.boxShadow ?? '').length > 0)
  expect(visible, `focus indicator missing on ${focus?.label}`).toBe(true)
})

test('/settings is not a route: it lands on the in-shell 404', async ({ page }) => {
  await openApp(page, '/settings')

  await expect(page.getByTestId('not-found')).toBeVisible()
  await expectTitle(page, 'Page not found')
  // The shell stays mounted so the sidebar remains the way back (03 §1).
  await expect(page.getByTestId('app-sidebar')).toBeVisible()
  await expect(page.getByTestId('nav-profile')).toBeVisible()
  await expect(page).toHaveURL(/\/settings$/)

  await page.getByRole('link', { name: /back to dashboard/i }).click()
  await expectTitle(page, 'Dashboard')
  await expectNoHorizontalOverflow(page)
})
