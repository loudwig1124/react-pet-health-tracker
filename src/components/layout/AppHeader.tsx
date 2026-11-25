import { Keyboard, PanelLeft, Search } from 'lucide-react'

import { Kbd } from '@/components/ui/kbd'
import { ProgressiveBlur } from '@/components/ui/magicui/progressive-blur'
import { openCommandPalette, openShortcutSheet } from '@/lib/desktop/events'
import { cn } from '@/lib/utils'

export interface AppHeaderProps {
  title: string
  description: string
  maxWidth: 1200 | 1440
  /** Rail is forced below 1024 px, so the trigger is not rendered there. */
  showToggle: boolean
  open: boolean
  onToggle: () => void
}

/**
 * Sticky header (03 §1): 64 px (56 px <1024), opaque paper + hairline, title and
 * description aligned to the content column, the rail toggle on the left. The
 * Progressive Blur strip softens the content that scrolls under the edge — a
 * static CSS effect, never an animated filter (04 §5).
 */
export function AppHeader({
  title,
  description,
  maxWidth,
  showToggle,
  open,
  onToggle,
}: AppHeaderProps) {
  const widthClass =
    maxWidth === 1440 ? 'max-w-[var(--content-max-wide)]' : 'max-w-[var(--content-max-narrow)]'

  return (
    <header
      data-testid="app-header"
      className="border-border bg-background sticky top-0 z-30 flex h-[var(--header-height)] w-full shrink-0 items-center border-b"
    >
      <div
        className={cn(
          'mx-auto flex h-full w-full items-center gap-3 px-[var(--page-gutter)]',
          widthClass,
        )}
      >
        {showToggle ? (
          /*
           * A native button, not the shadcn Button: the sticky header is in the
           * eager shell and the first-load gate counts every byte. The visual and
           * accessible contract is unchanged (36 px target, ghost hover, 2 px ring).
           */
          <button
            type="button"
            className="hover:bg-muted focus-visible:ring-ring hover:text-foreground inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
            aria-label={open ? 'Collapse sidebar (⌘B)' : 'Expand sidebar (⌘B)'}
            aria-pressed={open}
            title="Toggle sidebar (⌘B)"
            onClick={onToggle}
            data-testid="sidebar-toggle"
          >
            <PanelLeft aria-hidden="true" className="size-4" />
          </button>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="text-title truncate" data-testid="page-title">
            {title}
          </h1>
          <p className="text-caption text-muted-foreground hidden truncate min-[1024px]:block">
            {description}
          </p>
        </div>

        {/*
         * F3/F8 global triggers. Native buttons (no shadcn Button chunk) because
         * the sticky header is in the eager shell; both only dispatch the lazy
         * overlay events, so no palette/sheet code is in the first-load budget.
         */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="header-search"
            aria-label="Search and commands (⌘K)"
            title="Search and commands (⌘K)"
            onClick={() => openCommandPalette()}
            className="border-border bg-card hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border px-2.5 transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="text-small hidden min-[900px]:inline">Search</span>
            <Kbd className="text-caption hidden h-5 min-w-5 min-[1100px]:inline-flex">⌘K</Kbd>
          </button>
          <button
            type="button"
            data-testid="header-shortcuts"
            aria-label="Keyboard shortcuts (?)"
            title="Keyboard shortcuts (?)"
            onClick={() => openShortcutSheet()}
            className="hover:bg-muted focus-visible:ring-ring inline-flex size-9 shrink-0 items-center justify-center rounded-[var(--radius)] transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
          >
            <Keyboard aria-hidden="true" className="size-4" />
          </button>
        </div>

        {/* Contextual primary action mounts here with each milestone's screens. */}
        <div className="flex shrink-0 items-center gap-2" data-testid="header-actions" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-full h-4">
        <ProgressiveBlur position="bottom" height="16px" blurLevels={[1, 2, 4, 8]} />
      </div>
    </header>
  )
}
