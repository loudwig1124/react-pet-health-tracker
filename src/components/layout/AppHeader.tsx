import { Search } from 'lucide-react'

import { ProgressiveBlur } from '@/components/ui/magicui/progressive-blur'
import { openCommandPalette } from '@/lib/desktop/events'

export interface AppHeaderProps {
  title: string
  description: string
}

/**
 * Sticky header (03 §1): 64 px (56 px <1024), opaque paper + hairline. The rail
 * toggle lives in the sidebar's own brand row, so this bar is only the page
 * title, the palette trigger and the screen's primary action — its title lines
 * up exactly with the cards below. The Progressive Blur strip softens the
 * content that scrolls under the edge — a static CSS effect, never an animated
 * filter (04 §5).
 */
export function AppHeader({ title, description }: AppHeaderProps) {
  return (
    <header
      data-testid="app-header"
      className="border-border bg-background sticky top-0 z-30 flex h-[var(--header-height)] w-full shrink-0 items-center border-b transition-[height] duration-[var(--dur-sidebar)] ease-[var(--ease-standard)]"
    >
      <div className="relative flex h-full w-full items-center gap-3 px-[var(--page-gutter)] transition-[padding] duration-[var(--dur-sidebar)] ease-[var(--ease-standard)]">
        <div className="min-w-0 flex-1">
          <h1 className="text-title truncate" data-testid="page-title">
            {title}
          </h1>
          <p className="text-caption text-muted-foreground hidden truncate min-[1024px]:block">
            {description}
          </p>
        </div>

        {/*
         * The Search button is the mouse path to the command palette. A native
         * button (no shadcn Button chunk) because the sticky header is in the
         * eager shell; it only dispatches the lazy overlay event, so no palette
         * code is in the first-load budget.
         */}
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            data-testid="header-search"
            aria-label="Search and commands"
            title="Search and commands"
            onClick={() => openCommandPalette()}
            className="border-border bg-card hover:bg-muted focus-visible:ring-ring inline-flex h-9 items-center gap-2 rounded-[var(--radius)] border px-2.5 transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none"
          >
            <Search aria-hidden="true" className="size-4" />
            <span className="text-small hidden min-[900px]:inline">Search</span>
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
