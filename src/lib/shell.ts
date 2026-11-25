/**
 * Shell contract shared by the sidebar, the header and the keyboard layer.
 *
 * Pure and React-free so the navigation set, the shortcut matcher and the
 * responsive collapse rule are unit-testable (03 §1–§2):
 *
 *   ≥1280 px  expanded by default, collapsible with ⌘B and persisted
 *   1024–1279 rail by default, expandable on demand (temporary, not persisted)
 *   <1024     rail forced — never overlays or hides the destination list
 */

/** The six destinations, in sidebar order (03 §2, revised). */
export const APP_DESTINATIONS = [
  { key: 'dashboard', label: 'Dashboard', path: '/', shortcut: '1' },
  { key: 'pets', label: 'Pets', path: '/pets', shortcut: '2' },
  { key: 'appointments', label: 'Appointments', path: '/appointments', shortcut: '3' },
  { key: 'vaccinations', label: 'Vaccinations', path: '/vaccinations', shortcut: '4' },
  { key: 'records', label: 'Health records', path: '/records', shortcut: '5' },
  { key: 'journal', label: 'Journal', path: '/journal', shortcut: '6' },
] as const

export type AppDestination = (typeof APP_DESTINATIONS)[number]
export type AppDestinationKey = AppDestination['key']

/** Profile is the pinned footer row, never a seventh nav item (03 §2). */
export const PROFILE_PATH = '/profile'
export const PROFILE_SHORTCUT = ','

/* ------------------------------------------------------------ sidebar mode */

export const FORCED_RAIL_BELOW = 1024
export const EXPANDED_FROM = 1280

export type SidebarPreference = 'auto' | 'rail'
export type SidebarMode = 'expanded' | 'rail'

/**
 * Resolves the rendered sidebar mode. `temporaryExpanded` is the
 * "expand on demand" state available at 1024–1279 px only.
 */
export function resolveSidebarMode(
  viewportWidth: number,
  preference: SidebarPreference,
  temporaryExpanded = false,
): SidebarMode {
  if (viewportWidth < FORCED_RAIL_BELOW) {
    return 'rail'
  }
  if (viewportWidth < EXPANDED_FROM) {
    return temporaryExpanded ? 'expanded' : 'rail'
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

/* --------------------------------------------------------------- shortcuts */

export type ShellShortcut =
  | { type: 'navigate'; path: string }
  | { type: 'toggle-sidebar' }
  | { type: 'command-palette' }
  | { type: 'create' }
  | { type: 'shortcut-sheet' }

/** The subset of KeyboardEvent the matcher needs (pure tests can pass literals). */
export interface ShellKeyEvent {
  key: string
  metaKey?: boolean
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  target?: EventTarget | null
}

function isEditableTarget(target: EventTarget | null | undefined): boolean {
  if (target == null) {
    return false
  }
  const element = target as {
    tagName?: unknown
    isContentEditable?: unknown
  }
  const tagName = typeof element.tagName === 'string' ? element.tagName.toUpperCase() : ''
  if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
    return true
  }
  return element.isContentEditable === true
}

/**
 * Resolves one key event to a shell action. ⌘/Ctrl modifiers are the guaranteed
 * path; per 03 §2 plain `1`–`6` and `N` also work outside text fields (browsers
 * may reserve the modified digits/letters). `?` opens the shortcut sheet. The
 * matcher never fires inside a field.
 */
export function matchShellShortcut(event: ShellKeyEvent): ShellShortcut | null {
  if (event.altKey === true) {
    return null
  }

  const key = event.key.toLowerCase()
  const primary = event.metaKey === true || event.ctrlKey === true
  const inField = isEditableTarget(event.target)

  if (primary) {
    if (key === 'b') {
      return { type: 'toggle-sidebar' }
    }
    if (key === 'k') {
      return { type: 'command-palette' }
    }
    if (key === 'n') {
      return { type: 'create' }
    }
    if (key === PROFILE_SHORTCUT) {
      return { type: 'navigate', path: PROFILE_PATH }
    }
    if (!inField) {
      const destination = APP_DESTINATIONS.find((item) => item.shortcut === key)
      if (destination !== undefined) {
        return { type: 'navigate', path: destination.path }
      }
    }
    return null
  }

  if (inField) {
    return null
  }

  // F8: `?` (shift + /) opens the cheat sheet. `event.key` is already "?".
  if (event.key === '?') {
    return { type: 'shortcut-sheet' }
  }
  // The documented ⌘N alias: plain N outside a field (03 §2).
  if (key === 'n') {
    return { type: 'create' }
  }

  const destination = APP_DESTINATIONS.find((item) => item.shortcut === key)
  return destination === undefined ? null : { type: 'navigate', path: destination.path }
}

/* ------------------------------------------------------------- route handles */

/** Metadata a lazy route declares for the shell header/content width (03 §1). */
export interface RouteHandle {
  title: string
  description: string
  /** 1200 for dashboard/journal/profile; 1440 for the four data tables. */
  maxWidth?: 1200 | 1440
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
