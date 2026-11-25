/**
 * Display density — the persisted two-state control in Profile › Preferences
 * (03 §6, 04 §1.2). Density changes spacing only, never type size; the token
 * overrides live in `src/styles/tokens.css` under `:root[data-density='compact']`
 * and this module applies them to the document element.
 *
 * Kept outside the R2 settings record on purpose: the settings schema (and its
 * tests) predates the density row, and a display preference does not belong in
 * the household's data model.
 */

export type Density = 'comfortable' | 'compact'

export const DENSITY_STORAGE_KEY = 'pet-health.density.v1'

export function parseDensity(raw: string | null | undefined): Density {
  return raw === 'compact' ? 'compact' : 'comfortable'
}

/* ----------------------------------------------------------------- store */

type Listener = () => void

const listeners = new Set<Listener>()
let cached: Density | null = null

/** Stable snapshot for `useSyncExternalStore`. */
export function getDensity(): Density {
  if (cached === null) {
    cached = readStoredDensity()
  }
  return cached
}

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }
    return window.localStorage
  } catch {
    return null
  }
}

function readStoredDensity(): Density {
  const store = storage()
  if (store === null) {
    return 'comfortable'
  }
  try {
    return parseDensity(store.getItem(DENSITY_STORAGE_KEY))
  } catch {
    return 'comfortable'
  }
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

export function saveDensity(density: Density): Density {
  cached = parseDensity(density)
  const store = storage()
  if (store !== null) {
    try {
      store.setItem(DENSITY_STORAGE_KEY, cached)
    } catch {
      // Quota/private mode: keep the in-memory preference for this session.
    }
  }
  notify()
  return cached
}

export function subscribeDensity(listener: Listener): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent): void => {
    if (event.key === DENSITY_STORAGE_KEY) {
      cached = readStoredDensity()
      listener()
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

/** Applies the token scoping attribute; only `<html>`'s data attribute changes. */
export function applyDensity(density: Density): void {
  if (typeof document === 'undefined') {
    return
  }
  document.documentElement.dataset.density = parseDensity(density)
}

/** Applies the persisted value before/at shell mount (no spacing flash). */
export function applyStoredDensity(): Density {
  const density = getDensity()
  applyDensity(density)
  return density
}

/** Test seam: drop the module cache and listeners without touching storage. */
export function resetDensityForTests(): void {
  cached = null
  listeners.clear()
}
