/**
 * The five path-addressable pet tabs (03 §2–§3). Only the key and label lists
 * live here, React-free, so the route can normalise an unknown `:tab?` before
 * rendering and the Vitest suite can prove the health fallback.
 *
 * Tab keys stay stable even where the visible label differs: `health` is the
 * "Overview" destination (the route 03's table row opens), and `records` is the
 * clinical-history tab.
 */

export const PET_TAB_KEYS = [
  'health',
  'vaccinations',
  'records',
  'appointments',
  'journal',
] as const

export type PetTabKey = (typeof PET_TAB_KEYS)[number]

export const DEFAULT_PET_TAB: PetTabKey = 'health'

export interface PetTabDefinition {
  key: PetTabKey
  label: string
}

export const PET_TABS: readonly PetTabDefinition[] = [
  { key: 'health', label: 'Overview' },
  { key: 'vaccinations', label: 'Vaccinations' },
  { key: 'records', label: 'Records' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'journal', label: 'Journal' },
]

export function isPetTabKey(value: unknown): value is PetTabKey {
  return typeof value === 'string' && (PET_TAB_KEYS as readonly string[]).includes(value)
}

/** Unknown and absent tabs both fall back to health (task contract). */
export function resolvePetTab(tab: string | undefined | null): PetTabKey {
  return isPetTabKey(tab) ? tab : DEFAULT_PET_TAB
}

export function petTabLabel(tab: PetTabKey): string {
  return PET_TABS.find((definition) => definition.key === tab)?.label ?? 'Overview'
}

/** The canonical detail path; the row action and tabs share this builder. */
export function petTabPath(petId: string, tab: PetTabKey = DEFAULT_PET_TAB): string {
  return `/pets/${encodeURIComponent(petId)}/${tab}`
}
