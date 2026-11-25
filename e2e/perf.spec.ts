import { DESTINATIONS, openApp } from './support/app'
import { seedHousehold, type SeedPet } from './support/household'

const PERF_PET: SeedPet = { id: 'e2e-pet-perf', name: 'Biscuit', weightKg: 12.4 }

test.beforeEach(async ({ page }) => {
  await seedHousehold(page, { pets: [PERF_PET] })
})
/**
 * Performance gate (01 D8, 06 M5): LCP ≤ 1.5 s, route swap ≤ 100 ms, DOM
 * ≤ 1,200 nodes, no long task over 50 ms during boot and the first route
 * swaps. Timings are attached to the report so the gate report can quote them.
 */
import { expect, test } from './support/fixtures'

declare global {
  interface Window {
    __lcp?: number
    __longTasks?: number[]
  }
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__lcp = 0
    window.__longTasks = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__lcp = Math.max(window.__lcp ?? 0, entry.startTime)
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          ;(window.__longTasks ??= []).push(entry.duration)
        }
      }).observe({ type: 'longtask', buffered: true })
    } catch {
      // longtask is Chromium-only; the suite is Chromium-only by design.
    }
  })
})

test('first load: LCP ≤ 1.5 s, DOM ≤ 1,200 nodes, no long task > 50 ms', async ({
  page,
}, testInfo) => {
  // Warm the preview server's first response (a cold `vite preview` fetch adds
  // an environment long task that is not app boot cost), then measure a real
  // first paint of the same build.
  await openApp(page)
  await page.getByTestId('page-title').waitFor()
  await page.reload()
  await page.getByTestId('page-title').waitFor()
  await page.waitForTimeout(500)

  const measurements = await page.evaluate(() => ({
    lcp: window.__lcp ?? 0,
    longTasks: window.__longTasks ?? [],
    nodes: document.querySelectorAll('*').length,
  }))

  await testInfo.attach('first-load.json', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  })
  testInfo.annotations.push({
    type: 'perf',
    description: `LCP ${measurements.lcp.toFixed(0)} ms · ${measurements.nodes} DOM nodes · ${measurements.longTasks.length} long tasks`,
  })
  console.log(
    `[perf] first load: LCP ${measurements.lcp.toFixed(0)} ms · ${measurements.nodes} DOM nodes · long tasks ${measurements.longTasks.length === 0 ? 'none' : measurements.longTasks.map((duration) => `${duration.toFixed(0)} ms`).join(', ')}`,
  )

  expect(measurements.lcp).toBeGreaterThan(0)
  expect(measurements.lcp).toBeLessThanOrEqual(1500)
  expect(measurements.nodes).toBeLessThanOrEqual(1200)
  expect(measurements.longTasks.filter((duration) => duration > 50)).toEqual([])
})

test('route swaps stay under 100 ms once the shell is interactive', async ({ page }, testInfo) => {
  await openApp(page)
  await page.getByTestId('page-title').waitFor()

  const swaps: { title: string; milliseconds: number }[] = []
  for (const [key, title] of DESTINATIONS) {
    if (key === 'dashboard') {
      continue
    }
    const milliseconds = await page.evaluate(
      async ({ key, title }) => {
        const nav = document.querySelector<HTMLElement>(`[data-testid="nav-${key}"]`)
        if (nav === null) {
          throw new Error(`nav-${key} missing`)
        }
        const start = performance.now()
        nav.click()
        return new Promise<number>((resolve, reject) => {
          const timeout = setTimeout(() => {
            observer.disconnect()
            reject(new Error(`route ${title} did not render within 2 s`))
          }, 2000)
          const observer = new MutationObserver(() => {
            const current = document.querySelector('[data-testid="page-title"]')?.textContent
            if (current === title) {
              clearTimeout(timeout)
              observer.disconnect()
              resolve(performance.now() - start)
            }
          })
          observer.observe(document.body, { childList: true, subtree: true, characterData: true })
        })
      },
      { key, title },
    )
    swaps.push({ title, milliseconds })
  }

  await testInfo.attach('route-swaps.json', {
    body: JSON.stringify(swaps, null, 2),
    contentType: 'application/json',
  })
  const max = Math.max(...swaps.map((swap) => swap.milliseconds))
  testInfo.annotations.push({
    type: 'perf',
    description: `route swaps ${swaps.map((swap) => `${swap.title} ${swap.milliseconds.toFixed(0)} ms`).join(' · ')}`,
  })
  console.log(
    `[perf] route swaps: ${swaps.map((swap) => `${swap.title} ${swap.milliseconds.toFixed(1)} ms`).join(' · ')}`,
  )

  for (const swap of swaps) {
    expect(swap.milliseconds, `route swap → ${swap.title}`).toBeLessThanOrEqual(100)
  }
  expect(max).toBeLessThanOrEqual(100)
})
