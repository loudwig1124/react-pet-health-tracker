/**
 * Shared E2E helpers (06 §2/§5). Everything the Playwright specs need to talk
 * to the real preview build the same way, so a selector or a date helper only
 * changes in one place.
 */
import { expect, type Page } from '@playwright/test'

/** The seven canonical destinations (03 §2). Settings lives inside /profile. */
export const ROUTES = {
  dashboard: '/',
  pets: '/pets',
  appointments: '/appointments',
  vaccinations: '/vaccinations',
  records: '/records',
  journal: '/journal',
  profile: '/profile',
} as const

export const DESTINATIONS = [
  ['dashboard', 'Dashboard'],
  ['pets', 'Pets'],
  ['appointments', 'Appointments'],
  ['vaccinations', 'Vaccinations'],
  ['records', 'Health records'],
  ['journal', 'Journal'],
] as const

/**
 * Navigates and waits for the shell to be interactive. The root loader opens
 * Dexie and seeds the catalog before rendering, so `app-shell` visible is the
 * "app is ready" signal every spec can rely on.
 */
export async function openApp(page: Page, path: string = ROUTES.dashboard): Promise<void> {
  await page.goto(path)
  await expect(page.getByTestId('app-shell')).toBeVisible()
  await expect(page.getByTestId('page-title')).toBeVisible()
}

export async function expectTitle(page: Page, title: string): Promise<void> {
  await expect(page.getByTestId('page-title')).toHaveText(title)
}

/**
 * The desktop floor guarantee (03 §1): the document never scrolls sideways.
 * The content pane may scroll its own tables horizontally, so it is checked
 * separately after a route renders.
 */
export async function expectNoHorizontalOverflow(
  page: Page,
  context: string = 'page',
): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement
    const main = document.querySelector<HTMLElement>('[data-testid="app-scroll"]')
    return {
      document: root.scrollWidth - root.clientWidth,
      main: main === null ? 0 : main.scrollWidth - main.clientWidth,
    }
  })
  expect(overflow.document, `${context}: document horizontal overflow (px)`).toBeLessThanOrEqual(1)
  expect(overflow.main, `${context}: content-pane horizontal overflow (px)`).toBeLessThanOrEqual(1)
}

/** Local calendar day as the app's R4 rule sees it (fixed-width ISO date). */
export function localDateISO(offsetDays = 0, from: Date = new Date()): string {
  const date = new Date(from)
  date.setDate(date.getDate() + offsetDays)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Local wall-clock time `HH:mm` for a Date. */
export function localTimeHHMM(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

/** Local datetime value for `<input type="datetime-local">`. */
export function localDateTimeValue(date: Date): string {
  return `${localDateISO(0, date)}T${localTimeHHMM(date)}`
}

/** A Date `offsetMinutes` from now, rounded to a whole minute. */
/** Today at 09:00 local — the clock the dashboard specs pin the page to. */
export function todayMorning(): Date {
  const date = new Date()
  date.setHours(9, 0, 0, 0)
  return date
}

/**
 * `minutesFromNow(120)` silently becomes *tomorrow* for any run after 22:00,
 * which turns "1 visit booked today" into zero and moves the next visit off
 * today's group. These specs pin the page clock to `todayMorning()` and seed
 * relative to the same instant, so the data and the app agree whatever hour the
 * suite runs at.
 */
export function minutesAfter(base: Date, offsetMinutes: number): Date {
  return new Date(base.getTime() + offsetMinutes * 60_000)
}

export function minutesFromNow(offsetMinutes: number): Date {
  const date = new Date()
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + offsetMinutes)
  return date
}

/** The `documentElement`'s scrollWidth/clientWidth pair, for failure messages. */
export async function measureOverflow(
  page: Page,
): Promise<{ viewport: number; document: number; main: number }> {
  return page.evaluate(() => {
    const root = document.documentElement
    const main = document.querySelector<HTMLElement>('[data-testid="app-scroll"]')
    return {
      viewport: window.innerWidth,
      document: root.scrollWidth - root.clientWidth,
      main: main === null ? 0 : main.scrollWidth - main.clientWidth,
    }
  })
}

/* ------------------------------------------------------------------ storage */

/**
 * A raw IndexedDB fixture writer. The UI is the normal path; this exists only
 * for states the UI cannot reach deterministically (a visit scheduled in the
 * past, a journal entry on an exact day). The app must have booted once so the
 * seven stores exist. Writes are plain object stores, mirroring Dexie's schema.
 */
export async function writeStore(
  page: Page,
  storeName: string,
  rows: readonly Record<string, unknown>[],
): Promise<void> {
  await page.evaluate(
    async ({ storeName, rows }) => {
      const request = indexedDB.open('pet-health')
      const connection = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onerror = () => reject(request.error)
        request.onsuccess = () => resolve(request.result)
      })
      try {
        await new Promise<void>((resolve, reject) => {
          const transaction = connection.transaction(storeName, 'readwrite')
          transaction.onerror = () => reject(transaction.error)
          transaction.oncomplete = () => resolve()
          const store = transaction.objectStore(storeName)
          for (const row of rows) {
            store.put(row)
          }
        })
      } finally {
        connection.close()
      }
    },
    { storeName, rows },
  )
}

export async function readStore<T = Record<string, unknown>>(
  page: Page,
  storeName: string,
): Promise<T[]> {
  return page.evaluate(async (storeName) => {
    const request = indexedDB.open('pet-health')
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      return await new Promise<T[]>((resolve, reject) => {
        const transaction = connection.transaction(storeName, 'readonly')
        transaction.onerror = () => reject(transaction.error)
        const rows: T[] = []
        const cursorRequest = transaction.objectStore(storeName).openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (cursor === null) {
            return
          }
          rows.push(cursor.value as T)
          cursor.continue()
        }
        transaction.oncomplete = () => resolve(rows)
      })
    } finally {
      connection.close()
    }
  }, storeName)
}

/** Number of records in one store, e.g. after a delete cascade assertion. */
export async function countStore(page: Page, storeName: string): Promise<number> {
  return page.evaluate(async (storeName) => {
    const request = indexedDB.open('pet-health')
    const connection = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve(request.result)
    })
    try {
      return await new Promise<number>((resolve, reject) => {
        const transaction = connection.transaction(storeName, 'readonly')
        transaction.onerror = () => reject(transaction.error)
        const countRequest = transaction.objectStore(storeName).count()
        countRequest.onsuccess = () => resolve(countRequest.result)
      })
    } finally {
      connection.close()
    }
  }, storeName)
}

/** Clears this origin's app storage (fresh context is the usual isolation). */
export async function clearAppStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    window.localStorage.clear()
    const databases = await indexedDB.databases()
    await Promise.all(
      databases
        .filter((database) => database.name !== undefined)
        .map(
          (database) =>
            new Promise<void>((resolve, reject) => {
              const request = indexedDB.deleteDatabase(database.name as string)
              request.onsuccess = () => resolve()
              request.onerror = () => reject(request.error)
              request.onblocked = () => resolve()
            }),
        ),
    )
  })
}

/* ------------------------------------------------------------- motion probe */

export interface MotionFinding {
  selector: string
  property: string
  milliseconds: number
}

/**
 * Every running CSS animation/transition whose effect touches transform or
 * opacity, with its duration. Used by the reduced-motion spec: at
 * `prefers-reduced-motion: reduce` none of them may run longer than 80 ms.
 */
export async function collectTransformOpacityMotion(page: Page): Promise<MotionFinding[]> {
  return page.evaluate(() => {
    const findings: {
      selector: string
      property: string
      milliseconds: number
    }[] = []

    function selectorFor(target: Element): string {
      const testId = target.getAttribute('data-testid')
      if (testId !== null) {
        return `[data-testid="${testId}"]`
      }
      const tag = target.tagName.toLowerCase()
      const className = typeof target.className === 'string' ? target.className : ''
      const firstClass = className.split(/\s+/).filter(Boolean)[0]
      return firstClass === undefined ? tag : `${tag}.${firstClass}`
    }

    function touchesTransformOrOpacity(properties: readonly string[]): boolean {
      return properties.some(
        (property) =>
          property === 'transform' ||
          property === 'opacity' ||
          property === 'translate' ||
          property === 'scale' ||
          property === 'rotate',
      )
    }

    for (const animation of document.getAnimations()) {
      const effect = animation.effect
      if (effect === null) {
        continue
      }
      const target = (effect as KeyframeEffect).target
      if (target === null) {
        continue
      }
      const timing = effect.getTiming()
      const duration = typeof timing.duration === 'number' ? timing.duration : 0

      if (animation instanceof CSSTransition) {
        if (touchesTransformOrOpacity([animation.transitionProperty])) {
          findings.push({
            selector: selectorFor(target),
            property: `transition:${animation.transitionProperty}`,
            milliseconds: duration,
          })
        }
        continue
      }

      let keyframes: Keyframe[] = []
      try {
        keyframes = (effect as KeyframeEffect).getKeyframes()
      } catch {
        keyframes = []
      }
      const properties = new Set<string>()
      for (const keyframe of keyframes) {
        for (const key of Object.keys(keyframe)) {
          properties.add(key)
        }
      }
      const animated = [...properties].filter(
        (property) => property !== 'offset' && property !== 'easing' && property !== 'composite',
      )
      if (touchesTransformOrOpacity(animated)) {
        const animationName =
          animation instanceof CSSAnimation ? animation.animationName : 'unnamed'
        findings.push({
          selector: selectorFor(target),
          property: `animation:${animationName}`,
          milliseconds: duration,
        })
      }
    }
    return findings
  })
}
