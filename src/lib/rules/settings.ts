/**
 * R2 — settings and storage formats.
 *
 * Due-soon window: options 7/14/30/60/90, default 30, valid 1–365.
 * Weight unit: `kg` (default) or `lb` (`× 2.2046226218`, one decimal).
 * Sample data: off by default.
 *
 * An unreadable/corrupt settings record falls back to defaults instead of
 * blocking boot: the JSON parse and the per-field normalisation never throw.
 */

import { WEIGHT_UNITS } from './constants'
import type { Settings, WeightUnit } from './types'

/** Options the Profile settings row offers (any integer 1–365 is also valid). */
export const DUE_SOON_WINDOW_OPTIONS = [7, 14, 30, 60, 90] as const

export const KG_TO_LB = 2.2046226218

export const DEFAULT_SETTINGS: Settings = Object.freeze({
  dueSoonWindowDays: 30,
  weightUnit: 'kg',
  sampleDataEnabled: false,
})

export function isValidDueSoonWindow(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 365
}

export function isValidWeightUnit(value: unknown): value is WeightUnit {
  return typeof value === 'string' && (WEIGHT_UNITS as readonly string[]).includes(value)
}

export function normalizeDueSoonWindow(value: unknown): number {
  return isValidDueSoonWindow(value) ? value : DEFAULT_SETTINGS.dueSoonWindowDays
}

export function normalizeWeightUnit(value: unknown): WeightUnit {
  return isValidWeightUnit(value) ? value : DEFAULT_SETTINGS.weightUnit
}

/**
 * Normalises a decoded settings object. Unknown fields are dropped and an
 * invalid field falls back to its own default, so one bad value cannot block
 * the rest of the preferences.
 */
export function normalizeSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS }
  }
  const record = raw as Record<string, unknown>
  return {
    dueSoonWindowDays: normalizeDueSoonWindow(record.dueSoonWindowDays),
    weightUnit: normalizeWeightUnit(record.weightUnit),
    sampleDataEnabled:
      typeof record.sampleDataEnabled === 'boolean'
        ? record.sampleDataEnabled
        : DEFAULT_SETTINGS.sampleDataEnabled,
  }
}

/** Parses the persisted JSON, falling back to defaults when it is absent/corrupt. */
export function parseSettingsJson(raw: string | null | undefined): Settings {
  if (raw == null || raw.trim() === '') {
    return { ...DEFAULT_SETTINGS }
  }
  try {
    return normalizeSettings(JSON.parse(raw))
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify(normalizeSettings(settings))
}

/** Raw conversion to the display unit; formatting rounds to one decimal. */
export function convertWeightFromKg(weightKg: number, unit: WeightUnit): number {
  if (!Number.isFinite(weightKg)) {
    return 0
  }
  const clamped = Math.max(0, weightKg)
  return unit === 'lb' ? clamped * KG_TO_LB : clamped
}

/** "12.4 kg" or "27.3 lb" — the one-decimal rule shared by every surface. */
export function formatWeight(weightKg: number, unit: WeightUnit): string {
  if (!Number.isFinite(weightKg)) {
    return '—'
  }
  return `${convertWeightFromKg(weightKg, unit).toFixed(1)} ${unit}`
}

/** Converts a value typed in the display unit back to the stored kilograms. */
export function weightInputToKg(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value)) {
    return 0
  }
  const clamped = Math.max(0, value)
  return unit === 'lb' ? clamped / KG_TO_LB : clamped
}
