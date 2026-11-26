/**
 * Shell contract shared by the sidebar, the header and the content column.
 *
 * Pure and React-free so the navigation set and the responsive collapse rule
 * are unit-testable (03 §1–§2):
 *
 *   ≥1280 px  expanded by default, collapsible from the header toggle and persisted
 *   1024–1279 rail by default, expandable on demand (temporary, not persisted)
 *   <1024     rail forced — never overlays or hides the destination list
 */

/** The six destinations, in sidebar order (03 §2, revised). */
export const APP_DESTINATIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/' },
  { key: 'pets', label: 'Pets', path: '/pets' },
  { key: 'appointments', label: 'Appointments', path: '/appointments' },
  { key: 'vaccinations', label: 'Vaccinations', path: '/vaccinations' },
  { key: 'records', label: 'Health records', path: '/records' },
  { key: 'journal', label: 'Journal', path: '/journal' },
] as const

export type AppDestination = (typeof APP_DESTINATIONS)[number]
export type AppDestinationKey = AppDestination['key']

/** Profile is the pinned footer row, never a seventh nav item (03 §2). */
export const PROFILE_PATH = '/profile'

/* ------------------------------------------------------------ sidebar mode */

export const FORCED_RAIL_BELOW = 1024
/** The sidebar is expanded by default from this width up; only the user's own
 * choice ('rail', persisted) collapses it. Below FORCED_RAIL_BELOW it is forced. */
export const EXPANDED_FROM = FORCED_RAIL_BELOW

export type SidebarPreference = 'auto' | 'rail'
export type SidebarMode = 'expanded' | 'rail'

/**
 * Resolves the rendered sidebar mode: forced rail under 1024 px, otherwise the
 * user's persisted choice (expanded unless they collapsed it).
 */
export function resolveSidebarMode(
  viewportWidth: number,
  preference: SidebarPreference,
): SidebarMode {
  if (viewportWidth < FORCED_RAIL_BELOW) {
    return 'rail'
  }
  return preference === 'rail' ? 'rail' : 'expanded'
}

/** True when the rail is forced by the viewport and cannot be expanded. */
export function isForcedRail(viewportWidth: number): boolean {
  return viewportWidth < FORCED_RAIL_BELOW
}

export const SIDEBAR_PREFERENCE_STORAGE_KEY = 'pet-health.sidebar.v1'

export function parseSidebarPreference(raw: string | null | undefined): SidebarPreference {
  return raw === 'rail' ? 'rail' : 'auto'
}

/* ------------------------------------------------------------- route handles */

/** Metadata a lazy route declares for the shell header (03 §1). */
export interface RouteHandle {
  title: string
  description: string
}

/** Finds the deepest route handle carrying a title. */
export function routeHandleFrom(
  matches: readonly { handle?: unknown }[] | undefined,
): RouteHandle | null {
  if (matches === undefined) {
    return null
  }
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const handle = matches[index]?.handle
    if (
      typeof handle === 'object' &&
      handle !== null &&
      'title' in handle &&
      typeof (handle as RouteHandle).title === 'string'
    ) {
      return handle as RouteHandle
    }
  }
  return null
}
