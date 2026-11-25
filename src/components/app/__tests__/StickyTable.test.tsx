import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

import { STICKY_IDENTITY_CELL, STICKY_IDENTITY_HEAD, StickyTable } from '../StickyTable'

function renderStickyTable(surface: 'page' | 'card' = 'page'): ReturnType<typeof render> {
  return render(
    <StickyTable surface={surface} data-testid="sticky-test">
      <TableHeader>
        <TableRow>
          <TableHead className={STICKY_IDENTITY_HEAD}>Name</TableHead>
          <TableHead>Species</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className={STICKY_IDENTITY_CELL}>Bella</TableCell>
          <TableCell>Dog</TableCell>
        </TableRow>
      </TableBody>
    </StickyTable>,
  )
}

function setScrollLeft(container: HTMLElement, value: number): void {
  Object.defineProperty(container, 'scrollLeft', { configurable: true, value })
}

describe('StickyTable (photo-free table identity column)', () => {
  it('paints the page surface at rest and toggles the scrolled flag from the real container', async () => {
    renderStickyTable('page')
    const table = screen.getByTestId('sticky-test')
    const wrapper = table.parentElement?.parentElement
    const scroller = table.parentElement

    expect(table).toHaveAttribute('data-sticky-scrolled', 'false')
    expect(wrapper).toHaveAttribute('data-sticky-table', 'page')
    expect(table.className).toContain('[--table-sticky-surface:var(--background)]')
    expect(table.className).toContain('group/table')

    const pinned = screen.getByText('Bella')
    expect(pinned.className).toContain('table-sticky-identity')
    expect(pinned.className).toContain('group-hover/row:bg-')
    expect(pinned.className).toContain('group-focus-visible/row:bg-muted')

    if (!(scroller instanceof HTMLElement)) {
      throw new Error('table container missing')
    }

    setScrollLeft(scroller, 48)
    fireEvent.scroll(scroller)
    await waitFor(() => expect(table).toHaveAttribute('data-sticky-scrolled', 'true'))

    setScrollLeft(scroller, 0)
    fireEvent.scroll(scroller)
    await waitFor(() => expect(table).toHaveAttribute('data-sticky-scrolled', 'false'))
  })

  it('uses the card surface inside card-wrapped tables', () => {
    renderStickyTable('card')
    const table = screen.getByTestId('sticky-test')
    expect(table.className).toContain('[--table-sticky-surface:var(--card)]')
    expect(table.className).not.toContain('[--table-sticky-surface:var(--background)]')
  })
})
