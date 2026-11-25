import { openApp } from './support/app'
/**
 * Full-width layout (t14): the header and content span the whole main column —
 * no centred max-width dead margins — while the header toggle sits flush in the
 * shared 24 px gutter beside the sidebar and the title/cards align to it.
 * Checked at 1440, 1280 and 1024 with zero horizontal overflow.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const LAYOUT_PET: SeedPet = { id: 'e2e-pet-layout', name: 'Biscuit', weightKg: 12.4 }

interface Box {
  left: number
  right: number
  width: number
}

const closeTo = (actual: number, expected: number, label: string): void => {
  expect(Math.abs(actual - expected), `${label}: ${actual} vs ${expected}`).toBeLessThanOrEqual(1)
}

async function measureDashboard(page: Parameters<typeof openApp>[0]) {
  return page.evaluate(() => {
    const rect = (selector: string): Box | null => {
      const element = document.querySelector(selector)
      if (element === null) {
        return null
      }
      const box = element.getBoundingClientRect()
      return { left: box.left, right: box.right, width: box.width }
    }
    return {
      viewport: window.innerWidth,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      main: rect('[data-testid="app-scroll"]'),
      sidebar: rect('[data-testid="app-sidebar"]'),
      header: rect('[data-testid="app-header"]'),
      toggle: rect('[data-testid="sidebar-toggle"]'),
      title: rect('[data-testid="page-title"]'),
      content: rect('[data-testid="app-content"]'),
      counters: rect('[data-testid="dashboard-counters"]'),
    }
  })
}

test('full width at 1440/1280/1024: no overflow, flush toggle, aligned gutter', async ({
  page,
}) => {
  await seedHousehold(page, { pets: [LAYOUT_PET] })

  for (const width of [1440, 1280, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    await openApp(page, '/')
    await expect(page.getByTestId('dashboard-counters')).toBeVisible()

    const m = await measureDashboard(page)
    expect(m.overflow, `${width}: horizontal overflow`).toBeLessThanOrEqual(1)
    expect(m.main, 'main column').not.toBeNull()
    expect(m.sidebar, 'sidebar').not.toBeNull()
    expect(m.header, 'header').not.toBeNull()
    expect(m.toggle, 'toggle').not.toBeNull()
    expect(m.title, 'title').not.toBeNull()
    expect(m.content, 'content').not.toBeNull()
    expect(m.counters, 'counters').not.toBeNull()
    if (
      m.main === null ||
      m.sidebar === null ||
      m.header === null ||
      m.toggle === null ||
      m.title === null ||
      m.content === null ||
      m.counters === null
    ) {
      continue
    }

    // The main column starts exactly at the sidebar edge and runs to the viewport.
    closeTo(m.main.left, m.sidebar.right, `${width}: main left = sidebar right`)
    closeTo(m.main.right, m.viewport, `${width}: main right = viewport`)
    closeTo(m.header.left, m.main.left, `${width}: header starts at the sidebar edge`)
    closeTo(m.header.width, m.main.width, `${width}: header spans the main column`)

    // The toggle sits flush in that gutter; the title and every card share it.
    closeTo(m.toggle.left, m.main.left, `${width}: toggle flush to the sidebar`)
    closeTo(m.toggle.right, m.title.left, `${width}: title starts after the toggle`)
    closeTo(m.title.left, m.main.left + 24, `${width}: title in the 24px gutter`)
    closeTo(m.counters.left, m.main.left + 24, `${width}: cards in the 24px gutter`)
    closeTo(m.counters.right, m.viewport - 24, `${width}: cards reach viewport - 24`)
    closeTo(m.content.left, m.main.left, `${width}: content starts at the sidebar`)
    closeTo(m.content.right, m.viewport, `${width}: content reaches the viewport edge`)
  }
})

test('tables fill the main column; no centred max-width margin at 1440/1024', async ({ page }) => {
  await seedHousehold(page, { pets: [LAYOUT_PET] })

  for (const width of [1440, 1024]) {
    await page.setViewportSize({ width, height: 900 })
    await openApp(page, '/pets')
    await expect(page.getByTestId('pets-table')).toBeVisible()

    const m = await page.evaluate(() => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector)
        if (element === null) {
          return null
        }
        const box = element.getBoundingClientRect()
        return { left: box.left, right: box.right, width: box.width }
      }
      return {
        viewport: window.innerWidth,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        main: rect('[data-testid="app-scroll"]'),
        table: rect('[data-testid="pets-table"]'),
        content: rect('[data-testid="app-content"]'),
      }
    })
    expect(m.overflow, `${width}: horizontal overflow`).toBeLessThanOrEqual(1)
    if (m.main === null || m.table === null || m.content === null) {
      throw new Error(`${width}: layout landmarks missing`)
    }
    closeTo(m.table.left, m.main.left + 24, `${width}: table starts in the gutter`)
    closeTo(m.table.right, m.viewport - 24, `${width}: table reaches viewport - 24`)
    closeTo(m.content.right, m.viewport, `${width}: content reaches the viewport edge`)
  }
})
