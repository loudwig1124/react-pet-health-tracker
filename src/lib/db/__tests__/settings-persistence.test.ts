import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  clearSettingsCacheForTests,
  loadSettings,
  saveSettings,
  subscribeSettings,
} from '../settings'

/**
 * R2 persistence: settings survive a reload (fresh module cache) and an
 * unreadable record falls back to defaults. jsdom provides localStorage; in a
 * node environment the test installs an in-memory `window.localStorage` so the
 * same contract is exercised either way.
 */
function createMemoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => {
      data.clear()
    },
    getItem: (key: string) => data.get(key) ?? null,
    key: (index: number) => [...data.keys()][index] ?? null,
    removeItem: (key: string) => {
      data.delete(key)
    },
    setItem: (key: string, value: string) => {
      data.set(key, String(value))
    },
  }
}

function installStorage(): Storage {
  if (typeof window !== 'undefined' && window.localStorage !== undefined) {
    return window.localStorage
  }
  const memory = createMemoryStorage()
  vi.stubGlobal('window', {
    localStorage: memory,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })
  return memory
}

const storage = installStorage()

beforeEach(() => {
  storage.clear()
  clearSettingsCacheForTests()
})

describe('R2 settings · defaults and persistence', () => {
  it('accepts: a fresh household loads the Flutter defaults', () => {
    expect(loadSettings()).toEqual({
      dueSoonWindowDays: 30,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts: saved settings survive a reload (fresh module cache)', () => {
    saveSettings({ dueSoonWindowDays: 14, weightUnit: 'lb', sampleDataEnabled: true })
    clearSettingsCacheForTests()
    expect(loadSettings()).toEqual({
      dueSoonWindowDays: 14,
      weightUnit: 'lb',
      sampleDataEnabled: true,
    })
  })

  it('accepts: partial writes keep the untouched fields', () => {
    saveSettings({ dueSoonWindowDays: 60 })
    saveSettings({ weightUnit: 'lb' })
    expect(loadSettings()).toEqual({
      dueSoonWindowDays: 60,
      weightUnit: 'lb',
      sampleDataEnabled: false,
    })
  })

  it('rejects: invalid values normalise instead of persisting', () => {
    const saved = saveSettings({
      dueSoonWindowDays: 999,
      weightUnit: 'stone' as never,
    })
    expect(saved).toEqual({ dueSoonWindowDays: 30, weightUnit: 'kg', sampleDataEnabled: false })
    clearSettingsCacheForTests()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})

describe('R2 settings · unreadable records fall back to defaults', () => {
  it('rejects: corrupt JSON never blocks boot', () => {
    storage.setItem(SETTINGS_STORAGE_KEY, '{not json')
    clearSettingsCacheForTests()
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })

  it('rejects: valid JSON with invalid fields falls back per field', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({ dueSoonWindowDays: 45, weightUnit: 'stone', sampleDataEnabled: 'yes' }),
    )
    clearSettingsCacheForTests()
    expect(loadSettings()).toEqual({
      dueSoonWindowDays: 45,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
  })

  it('accepts: unknown fields are dropped', () => {
    storage.setItem(
      SETTINGS_STORAGE_KEY,
      JSON.stringify({
        dueSoonWindowDays: 90,
        weightUnit: 'lb',
        sampleDataEnabled: true,
        darkMode: true,
      }),
    )
    clearSettingsCacheForTests()
    expect(loadSettings()).toEqual({
      dueSoonWindowDays: 90,
      weightUnit: 'lb',
      sampleDataEnabled: true,
    })
  })
})

describe('R2/R10 settings · open screens re-render on a write', () => {
  it('accepts: subscribers are notified by a settings write and can unsubscribe', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeSettings(listener)

    saveSettings({ dueSoonWindowDays: 7 })
    expect(listener).toHaveBeenCalledTimes(1)
    expect(loadSettings().dueSoonWindowDays).toBe(7)

    unsubscribe()
    saveSettings({ dueSoonWindowDays: 14 })
    expect(listener).toHaveBeenCalledTimes(1)
  })
})
