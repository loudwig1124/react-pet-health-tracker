import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  parseSettingsJson,
  serializeSettings,
} from '@/lib/rules/settings'
/**
 * Settings — the one JSON record kept outside the seven tables (02 R2, 01 D6).
 *
 * localStorage is for settings only (02 §4's JSON-store candidate, rejected as
 * the main store). An unreadable record falls back to defaults instead of
 * blocking boot, and a tiny external store lets open screens re-render on a
 * change without a manual refetch (`useSyncExternalStore` in D5).
 */
import type { Settings } from '@/lib/rules/types'

export const SETTINGS_STORAGE_KEY = 'pet-health.settings.v1'

export { DEFAULT_SETTINGS }

type Listener = () => void

const listeners = new Set<Listener>()
let cached: Settings | null = null

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }
    return window.localStorage
  } catch {
    // Private-mode / storage-disabled browsers: settings live in memory for
    // this session rather than blocking the app.
    return null
  }
}

function read(): Settings {
  const store = storage()
  if (store === null) {
    return cached ?? { ...DEFAULT_SETTINGS }
  }
  try {
    cached = parseSettingsJson(store.getItem(SETTINGS_STORAGE_KEY))
  } catch {
    cached = { ...DEFAULT_SETTINGS }
  }
  return cached
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** Current settings; reads through to localStorage each time so another tab's
 * write is picked up on focus (R2/R10). */
export function loadSettings(): Settings {
  return read()
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = normalizeSettings({ ...read(), ...patch })
  cached = next
  const store = storage()
  if (store !== null) {
    try {
      store.setItem(SETTINGS_STORAGE_KEY, serializeSettings(next))
    } catch {
      // Quota/private mode: keep the in-memory value; the UI still reflects it.
    }
  }
  notify()
  return next
}

/** Subscribes to settings writes from this tab and from other tabs/focus. */
export function subscribeSettings(listener: Listener): () => void {
  listeners.add(listener)

  const onStorage = (event: StorageEvent): void => {
    if (event.key === SETTINGS_STORAGE_KEY) {
      cached = null
      listener()
    }
  }
  const onFocus = (): void => {
    listener()
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', onFocus)
  }

  return () => {
    listeners.delete(listener)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', onFocus)
    }
  }
}

/** Test seam: forget the module cache without touching persisted storage. */
export function clearSettingsCacheForTests(): void {
  cached = null
}
