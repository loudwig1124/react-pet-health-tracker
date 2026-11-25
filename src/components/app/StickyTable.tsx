/**
 * Sticky identity column support for the four data tables (pets, records,
 * appointments, vaccinations).
 *
 * The defect this fixes: each table painted its pinned first cell with
 * `bg-card` unconditionally. In the borderless tables (pets/records) that cell
 * sat on the page's paper surface, so a white column appeared even at
 * `scrollLeft = 0`; hover also stopped at the pinned cell.
 *
 * The treatment, shared by every table rather than forked per screen:
 * - the table declares the surface it sits on (`page` paper or `card`), and the
 *   pinned cell paints exactly that surface — invisible at rest;
 * - a scroll listener toggles `data-sticky-scrolled` on the table, and only then
 *   does the pinned cell gain a soft right edge (CSS in `src/index.css`);
 * - the pinned cell mirrors the row's hover/focus tint with an opaque
 *   `color-mix`, so the highlight spans the full row width.
 *
 * No layout is affected (box-shadow only), and the component lives in the lazy
 * table chunks, never in the eager shell.
 */
import { useEffect, useRef, useState, type ComponentProps } from 'react'

import { Table } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export type StickyTableSurface = 'page' | 'card'

/** Shared class for the pinned header cell. */
export const STICKY_IDENTITY_HEAD = 'table-sticky-identity'

/**
 * Shared class for the pinned body cell. The hover/focus variants replace the
 * surface paint with an opaque mix of the same tint the row uses, so a
 * horizontally scrolled table never shows content through the pinned cell and
 * the highlight still reaches the row's left edge.
 */
export const STICKY_IDENTITY_CELL =
  'table-sticky-identity group-hover/row:bg-[color-mix(in_srgb,var(--muted)_50%,var(--table-sticky-surface))] group-focus-visible/row:bg-muted'

export type StickyTableProps = ComponentProps<typeof Table> & {
  surface?: StickyTableSurface
}

export function StickyTable({ surface = 'page', className, children, ...props }: StickyTableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const container = wrapperRef.current?.querySelector<HTMLElement>(
      '[data-slot="table-container"]',
    )
    if (container == null) {
      return
    }

    // Boolean state: React bails out of re-rendering on the same value, so a
    // scroll handler that fires every frame costs one compare, not a render.
    const update = (): void => setScrolled(container.scrollLeft > 1)

    update()
    container.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      container.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  return (
    <div ref={wrapperRef} data-sticky-table={surface}>
      <Table
        data-sticky-scrolled={scrolled ? 'true' : 'false'}
        className={cn(
          'group/table',
          surface === 'card'
            ? '[--table-sticky-surface:var(--card)]'
            : '[--table-sticky-surface:var(--background)]',
          className,
        )}
        {...props}
      >
        {children}
      </Table>
    </div>
  )
}
