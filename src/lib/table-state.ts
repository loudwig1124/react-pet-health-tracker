/**
 * Small shared pieces for the URL-backed table views (F6) and their sorting
 * (F5). Pure: no React, no router, no Dexie — the route adapters only translate
 * `URLSearchParams` to these values and back.
 */

export const SORT_DIRECTIONS = ['asc', 'desc'] as const

export type SortDirection = (typeof SORT_DIRECTIONS)[number]

/** The shared sentinel for "no filter"; distinct from an absent parameter. */
export const FILTER_ALL = 'all'

export function isSortDirection(value: unknown): value is SortDirection {
  return typeof value === 'string' && (SORT_DIRECTIONS as readonly string[]).includes(value)
}

export function parseSortDirection(
  raw: string | null | undefined,
  fallback: SortDirection,
): SortDirection {
  return isSortDirection(raw) ? raw : fallback
}

/** Blank and the `all` sentinel both mean "no filter" for an optional select. */
export function parseFilterValue(raw: string | null | undefined): string {
  const trimmed = raw?.trim() ?? ''
  return trimmed === '' ? FILTER_ALL : trimmed
}

/** Serialises a filter value, omitting the `all` sentinel from the URL. */
export function serializeFilterValue(value: string): string | null {
  const trimmed = value.trim()
  return trimmed === '' || trimmed === FILTER_ALL ? null : trimmed
}

/** Case-insensitive, accent-sensitive-free text compare for table sorting. */
export function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base' })
}
