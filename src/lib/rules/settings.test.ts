import { describe, expect, it } from 'vitest'

import {
  DEFAULT_SETTINGS,
  DUE_SOON_WINDOW_OPTIONS,
  KG_TO_LB,
  convertWeightFromKg,
  formatWeight,
  isValidDueSoonWindow,
  isValidWeightUnit,
  normalizeDueSoonWindow,
  normalizeSettings,
  normalizeWeightUnit,
  parseSettingsJson,
  serializeSettings,
  weightInputToKg,
} from './settings'
import { doseDueStatus } from './vaccination-due'

describe('R2 settings · defaults match the Flutter app', () => {
  it('accepts: window 30, kg, sample data off', () => {
    expect(DEFAULT_SETTINGS).toEqual({
      dueSoonWindowDays: 30,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
    expect(DUE_SOON_WINDOW_OPTIONS).toEqual([7, 14, 30, 60, 90])
    expect(Object.isFrozen(DEFAULT_SETTINGS)).toBe(true)
  })

  it('accepts: any whole window from 1 to 365, with the five UI options', () => {
    for (const days of [1, 7, 14, 30, 60, 90, 365]) {
      expect(isValidDueSoonWindow(days)).toBe(true)
      expect(normalizeDueSoonWindow(days)).toBe(days)
    }
  })

  it('rejects: out-of-range or non-integer windows fall back to 30', () => {
    for (const value of [0, -1, 366, 14.5, Number.NaN, '14', null, undefined]) {
      expect(isValidDueSoonWindow(value)).toBe(false)
      expect(normalizeDueSoonWindow(value)).toBe(30)
    }
  })

  it('rejects: an unknown weight unit falls back to kg', () => {
    expect(isValidWeightUnit('kg')).toBe(true)
    expect(isValidWeightUnit('lb')).toBe(true)
    expect(isValidWeightUnit('stone')).toBe(false)
    expect(normalizeWeightUnit('stone')).toBe('kg')
    expect(normalizeWeightUnit(undefined)).toBe('kg')
  })
})

describe('R2 settings · normalisation and corrupt records', () => {
  it('accepts: a partial record keeps valid values and defaults the rest', () => {
    expect(normalizeSettings({ dueSoonWindowDays: 14 })).toEqual({
      dueSoonWindowDays: 14,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
    expect(normalizeSettings({ weightUnit: 'lb', sampleDataEnabled: true })).toEqual({
      dueSoonWindowDays: 30,
      weightUnit: 'lb',
      sampleDataEnabled: true,
    })
  })

  it('accepts: one invalid field does not discard the others', () => {
    expect(
      normalizeSettings({ dueSoonWindowDays: 999, weightUnit: 'lb', sampleDataEnabled: 'yes' }),
    ).toEqual({ dueSoonWindowDays: 30, weightUnit: 'lb', sampleDataEnabled: false })
  })

  it('rejects: unreadable records fall back to defaults instead of blocking boot', () => {
    for (const raw of [null, undefined, 'nonsense', 42, [], true]) {
      expect(normalizeSettings(raw)).toEqual(DEFAULT_SETTINGS)
    }
    expect(parseSettingsJson(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettingsJson('')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettingsJson('{not json')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettingsJson('[1,2,3]')).toEqual(DEFAULT_SETTINGS)
  })

  it('accepts: stored JSON round-trips', () => {
    const settings = { dueSoonWindowDays: 60, weightUnit: 'lb' as const, sampleDataEnabled: true }
    expect(parseSettingsJson(serializeSettings(settings))).toEqual(settings)
    expect(
      parseSettingsJson('{"dueSoonWindowDays":14,"weightUnit":"kg","sampleDataEnabled":false}'),
    ).toEqual({
      dueSoonWindowDays: 14,
      weightUnit: 'kg',
      sampleDataEnabled: false,
    })
  })
})

describe('R2 settings · weight display conversion', () => {
  it('accepts: 12.4 kg renders as 27.3 lb everywhere', () => {
    expect(KG_TO_LB).toBe(2.2046226218)
    expect(convertWeightFromKg(12.4, 'lb')).toBeCloseTo(27.33732051032, 8)
    expect(formatWeight(12.4, 'lb')).toBe('27.3 lb')
    expect(formatWeight(12.4, 'kg')).toBe('12.4 kg')
    expect(formatWeight(4.2, 'lb')).toBe('9.3 lb')
    expect(formatWeight(300, 'lb')).toBe('661.4 lb')
  })

  it('accepts: entering a weight in pounds stores the kilograms', () => {
    expect(weightInputToKg(27.3, 'lb')).toBeCloseTo(12.383, 3)
    expect(weightInputToKg(12.4, 'kg')).toBe(12.4)
  })

  it('rejects: negative and non-finite weights never render a negative number', () => {
    expect(formatWeight(-5, 'kg')).toBe('0.0 kg')
    expect(formatWeight(Number.NaN, 'kg')).toBe('—')
    expect(weightInputToKg(Number.POSITIVE_INFINITY, 'lb')).toBe(0)
  })

  it('accepts: the window setting feeds the due rule (14-day edges)', () => {
    const today = '2026-11-25'
    expect(doseDueStatus('2026-11-24', today, 14)).toBe('overdue')
    expect(doseDueStatus('2026-11-25', today, 14)).toBe('due_soon')
    expect(doseDueStatus('2026-12-09', today, 14)).toBe('due_soon')
    expect(doseDueStatus('2026-12-10', today, 14)).toBe('up_to_date')
    expect(
      doseDueStatus(
        '2026-12-25',
        today,
        normalizeSettings({ dueSoonWindowDays: 14, weightUnit: 'lb', sampleDataEnabled: false })
          .dueSoonWindowDays,
      ),
    ).toBe('up_to_date')
  })
})
