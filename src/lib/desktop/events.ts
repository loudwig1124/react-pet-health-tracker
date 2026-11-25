/**
 * The command palette's open-event contract.
 *
 * The eager shell must not import palette code (01 D8, 06 M5), so the Search
 * button only dispatches a DOM event and the shell mounts the lazy chunk. One
 * trigger path, one lazy mount — no keyboard layer involved.
 */

export const COMMAND_PALETTE_EVENT = 'pet-health:command-palette'

function dispatch(name: string): void {
  if (typeof window === 'undefined') {
    return
  }
  window.dispatchEvent(new Event(name))
}

export function openCommandPalette(): void {
  dispatch(COMMAND_PALETTE_EVENT)
}
