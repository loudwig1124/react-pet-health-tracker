import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  loadSettings,
  saveSettings,
} from '@/lib/db/settings'

describe('settings JSON store (R2)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts from the documented defaults', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS).toEqual({
      dueSoonWindowDays: 30,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
  })

  it('persists a partial patch and normalises invalid values', () => {
    saveSettings({ dueSoonWindowDays: 14, weightUnit: 'lb' })
    expect(JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      dueSoonWindowDays: 14,
      weightUnit: 'lb',
    })

    saveSettings({ dueSoonWindowDays: 9999 })
    expect(loadSettings().dueSoonWindowDays).toBe(30)

    saveSettings({ sampleDataEnabled: true })
    expect(loadSettings().sampleDataEnabled).toBe(true)
  })

  it('falls back to defaults when the stored JSON is corrupt', () => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, '{not json')
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS)
  })
})
