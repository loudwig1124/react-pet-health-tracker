/**
 * Boot sequence (M1 gate): open the database, guarantee the owner row, seed the
 * vaccine catalog (always) and the demo household (only when the persisted
 * toggle is on), then ask the browser to keep this origin's storage.
 *
 * The root route loader awaits `bootDatabase()`; a rejection lands on the
 * blocking storage-failure screen in `src/app/error-boundary.tsx`.
 *
 * M5 performance pass: boot reads only the light `household-status` repository
 * and the literal catalog seed, so the zod schema graph (which the entity write
 * repositories use) never enters the eager first-load chunk.
 */
import type { Owner } from '@/lib/rules/types'

import { openDb } from './db'
import { ensureOwnerRow } from './repositories/household-status'
import { seedVaccineCatalog } from './seed/catalog'
import { loadSettings } from './settings'

export interface BootResult {
  owner: Owner
  demoSeeded: boolean
  /** `false` when the browser declined `navigator.storage.persist()`. */
  persisted: boolean
}

let bootPromise: Promise<BootResult> | null = null

/**
 * Boot exactly once per page load. The router may revalidate the root loader on
 * navigation; a memoised promise keeps that from re-running the seed, while a
 * failure clears the memo so the error screen's Retry can try again.
 */
export function bootDatabase(): Promise<BootResult> {
  bootPromise ??= runBoot().catch((error: unknown) => {
    bootPromise = null
    throw error
  })
  return bootPromise
}

async function runBoot(): Promise<BootResult> {
  await openDb()
  const now = new Date()
  const owner = await ensureOwnerRow(now)
  await seedVaccineCatalog()

  const settings = loadSettings()
  let demoSeeded = false
  if (settings.sampleDataEnabled) {
    // The opt-in demo seed pulls the calendar-day helpers and its own dataset;
    // deferring it keeps them out of the eager first-load chunk (D8 gate).
    const { seedDemoHousehold } = await import('./seed/demo')
    demoSeeded = await seedDemoHousehold(now)
  }
  const persisted = await requestPersistentStorage()

  return { owner, demoSeeded, persisted }
}

/** Best-effort; a refusal is not fatal and simply means eviction stays possible. */
async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || navigator.storage?.persist === undefined) {
      return false
    }
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

/** Test/worker seam: forget the memoised boot so the next call runs again. */
export function resetBootForTests(): void {
  bootPromise = null
}
