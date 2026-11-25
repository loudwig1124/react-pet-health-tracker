/**
 * F9 — the palette's local recents list.
 *
 * Only palette item ids are stored; they are resolved against the live command
 * set when the palette opens, so a deleted pet or a renamed command can never
 * surface a stale navigation. Local-only (05 F9), five entries, safe when
 * storage is unavailable.
 */

export const PALETTE_RECENTS_STORAGE_KEY = 'pet-health.palette.recents.v1'

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

export function readPaletteRecents(): string[] {
  const store = storage()
  if (store === null) {
    return []
  }
  try {
    const raw = store.getItem(PALETTE_RECENTS_STORAGE_KEY)
    if (raw === null) {
      return []
    }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed.filter((value): value is string => typeof value === 'string').slice(0, 5)
  } catch {
    return []
  }
}

export function writePaletteRecents(ids: readonly string[]): void {
  const store = storage()
  if (store === null) {
    return
  }
  try {
    store.setItem(PALETTE_RECENTS_STORAGE_KEY, JSON.stringify(ids.slice(0, 5)))
  } catch {
    // Storage disabled: the palette still works without recents.
  }
}
