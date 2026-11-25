import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DENSITY_STORAGE_KEY,
  applyDensity,
  getDensity,
  parseDensity,
  resetDensityForTests,
  saveDensity,
  subscribeDensity,
} from '@/lib/density'

describe('density preference (03 §6)', () => {
  beforeEach(() => {
    window.localStorage.clear()
    delete document.documentElement.dataset.density
    resetDensityForTests()
  })

  afterEach(() => {
    resetDensityForTests()
    vi.restoreAllMocks()
  })

  it('defaults to comfortable for absent or unknown values', () => {
    expect(parseDensity(null)).toBe('comfortable')
    expect(parseDensity('')).toBe('comfortable')
    expect(parseDensity('dense')).toBe('comfortable')
    expect(parseDensity('compact')).toBe('compact')
    expect(getDensity()).toBe('comfortable')
  })

  it('persists the choice and notifies open screens', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeDensity(listener)

    saveDensity('compact')
    expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact')
    expect(getDensity()).toBe('compact')
    expect(listener).toHaveBeenCalledTimes(1)

    unsubscribe()
    saveDensity('comfortable')
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it('applies the choice as a data attribute so only spacing tokens move', () => {
    applyDensity('compact')
    expect(document.documentElement.dataset.density).toBe('compact')
    applyDensity('comfortable')
    expect(document.documentElement.dataset.density).toBe('comfortable')
  })

  it('reads a persisted value through the cached snapshot', () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, 'compact')
    resetDensityForTests()
    expect(getDensity()).toBe('compact')
  })
})
