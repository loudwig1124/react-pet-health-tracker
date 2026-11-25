import { useCallback, useEffect, useState } from 'react'

import {
  COMMAND_PALETTE_EVENT,
  SHORTCUT_SHEET_EVENT,
  commandPaletteDetail,
  type CommandPaletteSection,
} from '@/lib/desktop/events'

export interface DesktopOverlayState {
  paletteOpen: boolean
  /** ⌘N on `/` opens the palette focused on the create commands. */
  paletteSection: CommandPaletteSection | undefined
  shortcutSheetOpen: boolean
  closePalette: () => void
  closeShortcutSheet: () => void
}

/**
 * The eager shell's tiny overlay host: it only tracks whether the two lazy
 * chunks are mounted. Opening is **event-driven** (`pet-health:command-palette`
 * from ⌘K/the header search button, `pet-health:shortcut-sheet` from `?`), which
 * is the M1 contract and keeps palette/sheet code out of the first-load chunk.
 */
export function useDesktopOverlays(): DesktopOverlayState {
  const [palette, setPalette] = useState<
    { open: false; section: undefined } | { open: true; section: CommandPaletteSection | undefined }
  >({ open: false, section: undefined })
  const [shortcutSheetOpen, setShortcutSheetOpen] = useState(false)

  useEffect(() => {
    const onPalette = (event: Event): void => {
      const detail = commandPaletteDetail(event)
      setPalette({ open: true, section: detail.section })
    }
    const onSheet = (): void => setShortcutSheetOpen(true)
    window.addEventListener(COMMAND_PALETTE_EVENT, onPalette)
    window.addEventListener(SHORTCUT_SHEET_EVENT, onSheet)
    return () => {
      window.removeEventListener(COMMAND_PALETTE_EVENT, onPalette)
      window.removeEventListener(SHORTCUT_SHEET_EVENT, onSheet)
    }
  }, [])

  const closePalette = useCallback(() => {
    setPalette({ open: false, section: undefined })
  }, [])
  const closeShortcutSheet = useCallback(() => setShortcutSheetOpen(false), [])

  return {
    paletteOpen: palette.open,
    paletteSection: palette.open ? palette.section : undefined,
    shortcutSheetOpen,
    closePalette,
    closeShortcutSheet,
  }
}
