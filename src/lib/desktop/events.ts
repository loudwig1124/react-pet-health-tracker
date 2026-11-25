/**
 * The desktop overlays' event contract.
 *
 * The eager shell must not import palette/sheet code (01 D8, 06 M5 "palette
 * mounts on open"), so the triggers only dispatch a DOM event and the shell
 * mounts the lazy chunk. The same events back the header buttons, ⌘K/⌘N/? and
 * any future surface — one trigger path, one lazy mount.
 */

export const COMMAND_PALETTE_EVENT = 'pet-health:command-palette'
export const SHORTCUT_SHEET_EVENT = 'pet-health:shortcut-sheet'

export type CommandPaletteSection = 'create'

export interface CommandPaletteDetail {
  /** `create` opens the palette filtered to the five create commands (⌘N on `/`). */
  section?: CommandPaletteSection
}

function dispatch(name: string, detail?: unknown): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new CustomEvent(name, { detail }))
}

export function openCommandPalette(detail: CommandPaletteDetail = {}): void {
  dispatch(COMMAND_PALETTE_EVENT, detail)
}

export function openShortcutSheet(): void {
  dispatch(SHORTCUT_SHEET_EVENT)
}

/** Reads the optional detail without trusting the event shape. */
export function commandPaletteDetail(event: Event): CommandPaletteDetail {
  const detail = (event as CustomEvent<unknown>).detail
  if (typeof detail !== 'object' || detail === null) {
    return {}
  }
  const section = (detail as { section?: unknown }).section
  return section === 'create' ? { section: 'create' } : {}
}
