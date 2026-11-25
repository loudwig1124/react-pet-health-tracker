import { describe, expect, it, vi } from 'vitest'

import { handleTableRowKey, type TableRowKeyEvent } from '@/lib/table-keyboard'

function mountRows(count: number): HTMLElement[] {
  const table = document.createElement('table')
  const body = document.createElement('tbody')
  table.append(body)
  document.body.append(table)
  const rows: HTMLElement[] = []
  for (let index = 0; index < count; index += 1) {
    const row = document.createElement('tr')
    row.dataset.rowFocusable = 'true'
    row.tabIndex = 0
    const cell = document.createElement('td')
    cell.textContent = `Row ${index}`
    row.append(cell)
    body.append(row)
    rows.push(row)
  }
  return rows
}

function keyEvent(row: HTMLElement, key: string): TableRowKeyEvent {
  return {
    key,
    currentTarget: row,
    preventDefault: vi.fn(),
  }
}

describe('table keyboard layer (05 F4)', () => {
  it('moves focus with arrows and Home/End', () => {
    const rows = mountRows(4)
    const second = rows[1]
    if (second === undefined) {
      throw new Error('rows missing')
    }

    handleTableRowKey(keyEvent(second, 'ArrowDown'), undefined)
    expect(document.activeElement).toBe(rows[2])

    handleTableRowKey(keyEvent(rows[2] as HTMLElement, 'ArrowUp'), undefined)
    expect(document.activeElement).toBe(rows[1])

    handleTableRowKey(keyEvent(second, 'End'), undefined)
    expect(document.activeElement).toBe(rows[3])

    handleTableRowKey(keyEvent(rows[3] as HTMLElement, 'Home'), undefined)
    expect(document.activeElement).toBe(rows[0])

    // The list clamps at its ends instead of wrapping into another table.
    handleTableRowKey(keyEvent(rows[0] as HTMLElement, 'ArrowUp'), undefined)
    expect(document.activeElement).toBe(rows[0])
  })

  it('activates the focused row on Enter, and only when there is an action', () => {
    const rows = mountRows(2)
    const first = rows[0]
    if (first === undefined) {
      throw new Error('rows missing')
    }
    const activate = vi.fn()

    const consumed = handleTableRowKey(keyEvent(first, 'Enter'), activate)
    expect(consumed).toBe(true)
    expect(activate).toHaveBeenCalledTimes(1)

    // A read-only row (no action) keeps Enter from doing anything at all.
    expect(handleTableRowKey(keyEvent(first, 'Enter'), undefined)).toBe(false)
    expect(handleTableRowKey(keyEvent(first, ' '), activate)).toBe(false)
  })

  it('leaves modified keys alone so browser/OS shortcuts keep working', () => {
    const rows = mountRows(2)
    const first = rows[0] as HTMLElement
    const meta = { ...keyEvent(first, 'ArrowDown'), metaKey: true }
    expect(handleTableRowKey(meta, undefined)).toBe(false)
    expect(document.activeElement).not.toBe(rows[1])
  })
})
