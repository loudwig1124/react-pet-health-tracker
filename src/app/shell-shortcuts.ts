import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'

import { createIntentForPath } from '@/lib/desktop/commands'
import { openCommandPalette, openShortcutSheet } from '@/lib/desktop/events'
import { useSidebarModel } from '@/lib/hooks/useSidebar'
import { matchShellShortcut } from '@/lib/shell'

export interface ShellShortcutHandlers {
  navigate: (path: string, options?: { replace?: boolean }) => void
  toggleSidebar: () => void
  sidebarForced: boolean
  /** The current path, used to resolve what ⌘N means on this screen. */
  pathname: string
}

/**
 * The shell keyboard layer (F4):
 * - ⌘1–6 navigate (plain 1–6 outside fields as the documented alias);
 * - ⌘K / the header search button open the lazy command palette;
 * - ⌘N (plain N) runs the route's create intent — a `?new=1` route, or the
 *   palette's Create section on `/`;
 * - `?` opens the lazy shortcut sheet;
 * - ⌘B toggles the rail, ⌘, opens Profile.
 *
 * Every action is an event/navigation, so palette and sheet code stay out of the
 * eager chunk; the shell only routes intent.
 */
export function useShellShortcuts({
  navigate,
  toggleSidebar,
  sidebarForced,
  pathname,
}: ShellShortcutHandlers): void {
  // The listener stays mounted across route changes: re-subscribing on every
  // navigation could drop a key press in the cleanup/commit gap (and a dropped
  // ⌘K is exactly the F4 failure this layer exists to prevent).
  const pathnameRef = useRef(pathname)
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const shortcut = matchShellShortcut(event)
      if (shortcut === null) {
        return
      }
      switch (shortcut.type) {
        case 'navigate': {
          event.preventDefault()
          navigate(shortcut.path)
          return
        }
        case 'toggle-sidebar': {
          event.preventDefault()
          if (!sidebarForced) {
            toggleSidebar()
          }
          return
        }
        case 'command-palette': {
          event.preventDefault()
          openCommandPalette()
          return
        }
        case 'create': {
          event.preventDefault()
          const intent = createIntentForPath(pathnameRef.current)
          if (intent.kind === 'palette-create') {
            openCommandPalette({ section: 'create' })
          } else {
            navigate(intent.to)
          }
          return
        }
        case 'shortcut-sheet': {
          event.preventDefault()
          openShortcutSheet()
          return
        }
        default:
          return
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, sidebarForced, toggleSidebar])
}

/** Convenience for the shell: one model shared by header, sidebar and keys. */
export function useAppShellNavigation(): {
  navigate: ReturnType<typeof useNavigate>
  sidebar: ReturnType<typeof useSidebarModel>
} {
  return { navigate: useNavigate(), sidebar: useSidebarModel() }
}
