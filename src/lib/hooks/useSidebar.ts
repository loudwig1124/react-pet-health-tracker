/**
 * Viewport and sidebar-preference hooks. Split from the pure rules in
 * `src/lib/shell.ts` so those can be tested without a DOM.
 */
import { useCallback, useSyncExternalStore } from 'react'

import {
  type SidebarPreference,
  FORCED_RAIL_BELOW,
  SIDEBAR_PREFERENCE_STORAGE_KEY,
  isForcedRail,
  parseSidebarPreference,
  resolveSidebarMode,
} from '@/lib/shell'

const DEFAULT_WIDTH = 1440

function subscribeViewport(listener: () => void): () => void {
  window.addEventListener('resize', listener)
  return () => window.removeEventListener('resize', listener)
}

function getViewportWidth(): number {
  return typeof window === 'undefined' ? DEFAULT_WIDTH : window.innerWidth
}

/** Live window width; updates on resize without a layout listener. */
export function useViewportWidth(): number {
  return useSyncExternalStore(subscribeViewport, getViewportWidth, () => DEFAULT_WIDTH)
}

const preferenceListeners = new Set<() => void>()

function readPreference(): SidebarPreference {
  try {
    return parseSidebarPreference(window.localStorage.getItem(SIDEBAR_PREFERENCE_STORAGE_KEY))
  } catch {
    return 'auto'
  }
}

function subscribePreference(listener: () => void): () => void {
  preferenceListeners.add(listener)
  const onStorage = (event: StorageEvent): void => {
    if (event.key === SIDEBAR_PREFERENCE_STORAGE_KEY) {
      listener()
    }
  }
  window.addEventListener('storage', onStorage)
  return () => {
    preferenceListeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function useSidebarPreference(): SidebarPreference {
  return useSyncExternalStore(subscribePreference, readPreference, () => 'auto')
}

function writePreference(preference: SidebarPreference): void {
  try {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_STORAGE_KEY, preference)
  } catch {
    // Storage disabled: keep the in-memory behaviour for this session.
  }
  for (const listener of preferenceListeners) {
    listener()
  }
}

export interface SidebarModel {
  mode: 'expanded' | 'rail'
  open: boolean
  forced: boolean
  /** Opens or closes the sidebar using the width-appropriate strategy. */
  setOpen: (open: boolean) => void
  toggle: () => void
}

/**
 * The responsive collapse rule in one place:
 * - ≥1024 px: the user's persisted preference — expanded unless they collapsed it
 * - <1024 px: rail forced; toggling is a no-op
 */
export function useSidebarModel(): SidebarModel {
  const width = useViewportWidth()
  const preference = useSidebarPreference()
  // The on-demand expansion is keyed to the viewport width it was requested at:
  // any resize inside the 1024–1279 band resets it, and leaving the band always
  // renders the rail. Deriving it during render (instead of an effect) keeps a
  // live resize from ever leaving the sidebar expanded where it must be a rail.
  const forced = isForcedRail(width)
  const mode = resolveSidebarMode(width, preference)

  const setOpen = useCallback(
    (open: boolean) => {
      if (width < FORCED_RAIL_BELOW) {
        return
      }
      writePreference(open ? 'auto' : 'rail')
    },
    [width],
  )

  const toggle = useCallback(() => {
    setOpen(mode !== 'expanded')
  }, [mode, setOpen])

  return { mode, open: mode === 'expanded', forced, setOpen, toggle }
}
