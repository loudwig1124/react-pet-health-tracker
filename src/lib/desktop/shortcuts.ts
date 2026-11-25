/**
 * F4/F8 keyboard registry — the single source of truth the `?` shortcut sheet
 * renders and the help text (header tooltips, sidebar) quotes.
 *
 * Every binding here is implemented somewhere real:
 * - ⌘1–6 / plain 1–6: `matchShellShortcut` → `useShellShortcuts`
 * - ⌘K: shell → lazy command palette
 * - ⌘N / plain N: `createIntentForPath` → `?new=1` create intent
 * - ⌘B: sidebar rail, ⌘, / plain `,`: profile (03 §2 aliases)
 * - ?: this sheet; Esc: every radix dialog/overlay
 * - arrows/Home/End/Enter: the table row layer (`table-keyboard.ts`)
 *
 * Browsers may reserve ⌘1–9/⌘N/⌘,; the plain-key aliases are the documented
 * fallback, and the sidebar, palette and header buttons are the guaranteed path
 * (03 §2). The sheet must never show a binding that does nothing.
 */

import { APP_DESTINATIONS, PROFILE_SHORTCUT } from '@/lib/shell'

export interface ShortcutRow {
  /** Rendered as individual key caps, e.g. ['⌘', 'K']. */
  keys: string[]
  label: string
  /** A documented alternative binding, e.g. "or N outside a field". */
  alias?: string
}

export interface ShortcutGroup {
  id: string
  title: string
  rows: ShortcutRow[]
}

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    id: 'navigate',
    title: 'Go to',
    rows: [
      ...APP_DESTINATIONS.map((destination, index) => ({
        keys: ['⌘', destination.shortcut],
        label: destination.label,
        alias: `or ${index + 1} outside a field`,
      })),
      { keys: ['⌘', PROFILE_SHORTCUT], label: 'Profile' },
    ],
  },
  {
    id: 'actions',
    title: 'Actions',
    rows: [
      { keys: ['⌘', 'K'], label: 'Search and commands', alias: 'or the Search button' },
      { keys: ['⌘', 'N'], label: 'Create on this screen', alias: 'or N outside a field' },
      { keys: ['⌘', 'B'], label: 'Collapse or expand the sidebar' },
      { keys: ['?'], label: 'Keyboard shortcuts' },
      { keys: ['Esc'], label: 'Close a dialog, palette or sheet' },
    ],
  },
  {
    id: 'tables',
    title: 'Tables',
    rows: [
      { keys: ['↑', '↓'], label: 'Move between rows' },
      { keys: ['Home', 'End'], label: 'First or last row' },
      { keys: ['Enter'], label: 'Open the focused row' },
    ],
  },
]

/** Flat list of every binding, for the sheet test and a11y copy. */
export function shortcutRows(): ShortcutRow[] {
  return SHORTCUT_GROUPS.flatMap((group) => group.rows)
}
