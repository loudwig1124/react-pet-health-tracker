/**
 * F4 table keyboard layer — arrows/Home/End move between focusable rows and
 * Enter opens the focused row.
 *
 * React-free and DOM-shape driven: rows opt in with `data-row-focusable="true"`
 * and call this from their `onKeyDown`. Keeping it out of each table means the
 * four list screens cannot drift in how a row responds to the keyboard.
 */

export interface TableRowKeyEvent {
  key: string
  currentTarget: HTMLElement
  shiftKey?: boolean
  altKey?: boolean
  metaKey?: boolean
  ctrlKey?: boolean
  preventDefault: () => void
}

const ROW_SELECTOR = 'tr[data-row-focusable="true"]'

function rowsOf(row: HTMLElement): HTMLElement[] {
  const body = row.parentElement
  if (body === null) {
    return [row]
  }
  return Array.from(body.querySelectorAll<HTMLElement>(ROW_SELECTOR))
}

/**
 * Handles one row key event. Returns `true` when the key was consumed, so a
 * caller can assert it in tests; the browser default is prevented for handled
 * keys only (Space keeps scrolling, Tab keeps moving focus out of the table).
 */
export function handleTableRowKey(
  event: TableRowKeyEvent,
  onActivate: (() => void) | undefined,
): boolean {
  if (event.altKey === true || event.metaKey === true || event.ctrlKey === true) {
    return false
  }
  const rows = rowsOf(event.currentTarget)
  const index = rows.indexOf(event.currentTarget)

  switch (event.key) {
    case 'ArrowDown': {
      event.preventDefault()
      rows[Math.min(rows.length - 1, index + 1)]?.focus()
      return true
    }
    case 'ArrowUp': {
      event.preventDefault()
      rows[Math.max(0, index - 1)]?.focus()
      return true
    }
    case 'Home': {
      event.preventDefault()
      rows[0]?.focus()
      return true
    }
    case 'End': {
      event.preventDefault()
      rows[rows.length - 1]?.focus()
      return true
    }
    case 'Enter': {
      if (onActivate === undefined) {
        return false
      }
      event.preventDefault()
      onActivate()
      return true
    }
    default:
      return false
  }
}

/** Shared row props so every focusable table row behaves the same. */
export const FOCUSABLE_ROW_PROPS = {
  tabIndex: 0,
  'data-row-focusable': 'true',
} as const
