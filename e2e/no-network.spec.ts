import { ROUTES, openApp } from './support/app'
/**
 * Final-acceptance proof for the release-one exclusions (00-PLAN §3): the app
 * is local-only — no external requests, no webfonts, no media/images, no
 * service worker, no cookies, and only this origin's storage. The demo claim
 * is "Wi-Fi off still works": the build is served from localhost and never
 * reaches another host.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BISCUIT: SeedPet = { id: 'e2e-pet-biscuit', name: 'Biscuit', weightKg: 12.4 }

test('the app is local-only: no external requests, webfonts, media, service worker or cookies', async ({
  page,
  baseURL,
}) => {
  await seedHousehold(page, { pets: [BISCUIT] })

  const requests: string[] = []
  page.on('request', (request) => {
    requests.push(request.url())
  })

  for (const path of Object.values(ROUTES)) {
    await openApp(page, path)
    await page.getByTestId('page-title').waitFor()
  }

  // A palette open (from the header Search button) pulls its lazy chunk from
  // this origin only.
  await openApp(page, '/')
  await page.getByTestId('header-search').click()
  await expect(page.getByTestId('command-palette')).toBeVisible()
  await page.keyboard.press('Escape')

  const external = requests.filter((url) => {
    if (url.startsWith('data:') || url.startsWith('blob:')) {
      return false
    }
    return baseURL === undefined || !url.startsWith(baseURL)
  })
  expect(external, `requests outside ${baseURL}: ${external.join(', ')}`).toEqual([])

  const surface = await page.evaluate(async () => {
    const serviceWorkers =
      'serviceWorker' in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0
    return {
      fontFaces: document.fonts.size,
      img: document.querySelectorAll('img').length,
      media: document.querySelectorAll('audio, video, iframe, object, embed').length,
      externalAnchors: [...document.querySelectorAll('a[href]')].filter((anchor) => {
        const href = anchor.getAttribute('href') ?? ''
        return /^https?:\/\//u.test(href) && !href.startsWith(window.location.origin)
      }).length,
      serviceWorkers,
      cookies: document.cookie,
      localStorageKeys: Object.keys(window.localStorage),
      databases: (await indexedDB.databases()).map((database) => database.name),
    }
  })

  expect(surface.fontFaces, 'webfonts').toBe(0)
  expect(surface.img, '<img> elements (no photos in v1)').toBe(0)
  expect(surface.media, 'media/iframe elements').toBe(0)
  expect(surface.externalAnchors, 'links to another origin').toBe(0)
  expect(surface.serviceWorkers, 'service worker registrations').toBe(0)
  expect(surface.cookies, 'cookies').toBe('')
  // Settings write lazily (defaults live in memory), so the keys may be empty;
  // every key that does exist must be the app's own namespaced key.
  expect(
    surface.localStorageKeys.filter((key) => !key.startsWith('pet-health.')),
    `non-app localStorage keys: ${surface.localStorageKeys.join(', ')}`,
  ).toEqual([])
  expect(surface.databases).toEqual(['pet-health'])
})
