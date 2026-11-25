import {
  DESTINATIONS,
  ROUTES,
  collectTransformOpacityMotion,
  expectNoHorizontalOverflow,
  openApp,
} from './support/app'
/**
 * Reduced-motion gate (03 §4, 06 M5): with `prefers-reduced-motion: reduce`
 * no transform/opacity animation may run longer than 80 ms, nothing may be
 * motion-only (the DOM keeps every piece of information), and navigation keeps
 * working without console errors.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

test.use({ reducedMotion: 'reduce' })

const MOTION_CEILING_MS = 80
const MOTION_PET: SeedPet = { id: 'e2e-pet-motion', name: 'Biscuit', weightKg: 12.4 }

test.beforeEach(async ({ page }) => {
  await seedHousehold(page, { pets: [MOTION_PET] })
})

test('no transform or opacity animation runs longer than 80 ms on any destination', async ({
  page,
}) => {
  for (const [, path] of Object.entries(ROUTES)) {
    await openApp(page, path)
    await page.getByTestId('page-title').waitFor()

    // Trigger the hover choreography on the first sidebar destination, then
    // sample every animation/transition the browser is still running.
    await page.getByTestId('nav-dashboard').hover()
    await page.waitForTimeout(60)

    const findings = await collectTransformOpacityMotion(page)
    const long = findings.filter((finding) => finding.milliseconds > MOTION_CEILING_MS)
    expect(
      long,
      `transform/opacity motion over ${MOTION_CEILING_MS} ms under reduced motion on ${path}: ${JSON.stringify(long)}`,
    ).toEqual([])
  }
})

test('navigation and the rail keep working under reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 })
  await openApp(page)
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'collapsed')

  for (const [key, title] of DESTINATIONS) {
    await page.keyboard.press(`Meta+${DESTINATIONS.findIndex(([item]) => item === key) + 1}`)
    await expect(page.getByTestId('page-title')).toHaveText(title)
    await expectNoHorizontalOverflow(page, `${title} @900`)
  }

  await page.setViewportSize({ width: 1440, height: 900 })
  // The preference is `auto`, so leaving the forced-rail band must restore the
  // expanded sidebar before the shortcut is exercised.
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
  await page.keyboard.press('Meta+b')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'collapsed')
  await page.keyboard.press('Meta+b')
  await expect(page.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
})

/**
 * Information parity: the same route must expose the same visible text under
 * reduced motion as under normal motion. If a widget communicated something
 * only by moving (e.g. a status that slides in and is hidden while static),
 * this comparison exposes it.
 */
test('nothing is motion-only: reduced-motion text matches normal motion', async ({ browser }) => {
  const snapshot = async (reducedMotion: 'no-preference' | 'reduce'): Promise<string[]> => {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion,
    })
    const page = await context.newPage()
    await seedHousehold(page, { pets: [MOTION_PET] })
    const texts: string[] = []
    for (const path of Object.values(ROUTES)) {
      await openApp(page, path)
      await page.getByTestId('page-title').waitFor()
      await page.waitForTimeout(150)
      const visibleText = await page.evaluate(() => {
        const content = document.querySelector<HTMLElement>('[data-testid="app-content"]')
        return (content ?? document.body).innerText.replaceAll(/\s+/g, ' ').trim()
      })
      texts.push(`${path}:${visibleText}`)
    }
    await context.close()
    return texts
  }

  const normal = await snapshot('no-preference')
  const reduced = await snapshot('reduce')
  expect(reduced).toEqual(normal)
})
