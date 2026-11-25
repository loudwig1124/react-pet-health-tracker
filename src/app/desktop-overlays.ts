import { useCallback, useEffect, useState } from 'react'

import { COMMAND_PALETTE_EVENT } from '@/lib/desktop/events'

export interface DesktopOverlayState {
  paletteOpen: boolean
  closePalette: () => void
}

/**
 * The eager shell's tiny overlay host: it only tracks whether the lazy palette
 * chunk is mounted. Opening is **event-driven** (the header Search button
 * dispatches `pet-health:command-palette`), which keeps palette code out of the
 * first-load chunk.
 */
export function useDesktopOverlays(): DesktopOverlayState {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    const onPalette = (): void => setPaletteOpen(true)
    window.addEventListener(COMMAND_PALETTE_EVENT, onPalette)
    return () => window.removeEventListener(COMMAND_PALETTE_EVENT, onPalette)
  }, [])

  const closePalette = useCallback(() => setPaletteOpen(false), [])

  return { paletteOpen, closePalette }
}
