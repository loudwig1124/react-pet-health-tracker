import { Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { usePaletteItems } from '@/lib/hooks/usePaletteItems'
import {
  createCommandPaletteItems,
  groupPaletteItems,
  rememberPaletteItem,
  resolvePaletteRecents,
  searchPalette,
  type PaletteItem,
} from '@/lib/palette'
import { readPaletteRecents, writePaletteRecents } from '@/lib/palette-recents'
import { cn } from '@/lib/utils'

interface PaletteSection {
  key: string
  label: string
  items: PaletteItem[]
}

export interface CommandPaletteProps {
  onClose: () => void
}

/**
 * The command palette, opened by the header Search button.
 *
 * Mounted only on demand from its own lazy chunk (the shell dispatches
 * `pet-health:command-palette`; no palette code is in the first-load budget).
 * One input searches navigation, pets, clinical records, journal notes and
 * visits, and runs every create command — the exact same `?new=1` URLs the
 * screens' own primary buttons use.
 *
 * The app has no keyboard shortcuts: the palette is a normal search dialog, so
 * its inner combobox/listbox keeps standard dialog interaction (the radix
 * Dialog supplies the focus trap and restores focus on close), but nothing
 * global listens for keys and no key hints are advertised.
 */
export function CommandPalette({ onClose }: CommandPaletteProps) {
  const navigate = useNavigate()
  const items = usePaletteItems()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [recentsIds, setRecentsIds] = useState<string[]>(() => readPaletteRecents())
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const sections = useMemo<PaletteSection[]>(() => {
    const queryText = query.trim()
    if (queryText !== '') {
      return groupPaletteItems(items === undefined ? [] : searchPalette(items, queryText)).map(
        (group) => ({ key: group.group, label: group.label, items: group.items }),
      )
    }
    if (items === undefined) {
      return []
    }
    const recents = resolvePaletteRecents(recentsIds, items)
    const recentIds = new Set(recents.map((item) => item.id))
    const rest = [
      ...createCommandPaletteItems(),
      ...items.filter((item) => item.group === 'navigate'),
    ].filter((item) => !recentIds.has(item.id))
    const groups: PaletteSection[] = groupPaletteItems(rest).map((group) => ({
      key: group.group,
      label: group.label,
      items: group.items,
    }))
    return recents.length === 0
      ? groups
      : [{ key: 'recent', label: 'Recent', items: recents }, ...groups]
  }, [items, query, recentsIds])

  const visible = useMemo(() => sections.flatMap((section) => section.items), [sections])
  const active = visible.length === 0 ? -1 : Math.min(activeIndex, visible.length - 1)

  // Keep the active option in view without stealing focus from the input.
  useEffect(() => {
    if (active < 0) {
      return
    }
    const option = listRef.current?.querySelector<HTMLElement>(`[data-option-index="${active}"]`)
    option?.scrollIntoView?.({ block: 'nearest' })
  }, [active])

  function activate(item: PaletteItem): void {
    if (item.group === 'navigate' || item.group === 'pets') {
      const next = rememberPaletteItem(recentsIds, item)
      setRecentsIds(next)
      writePaletteRecents(next)
    }
    onClose()
    navigate(item.to)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (visible.length === 0) {
      return
    }
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % visible.length)
        return
      }
      case 'ArrowUp': {
        event.preventDefault()
        setActiveIndex((index) => (index - 1 + visible.length) % visible.length)
        return
      }
      case 'Home': {
        event.preventDefault()
        setActiveIndex(0)
        return
      }
      case 'End': {
        event.preventDefault()
        setActiveIndex(visible.length - 1)
        return
      }
      case 'Enter': {
        event.preventDefault()
        const item = visible[active] ?? visible[0]
        if (item !== undefined) {
          activate(item)
        }
        return
      }
      default:
        return
    }
  }

  const indexById = new Map(visible.map((item, index) => [item.id, index] as const))

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
    >
      <DialogContent
        data-testid="command-palette"
        showCloseButton={false}
        className="top-[10%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Command palette</DialogTitle>
          <DialogDescription>
            Search the household, jump to a screen or run a create command.
          </DialogDescription>
        </DialogHeader>

        <div className="border-border flex items-center gap-2 border-b px-3">
          <Search aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
          <input
            ref={inputRef}
            data-testid="command-input"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `command-option-${active}` : undefined}
            aria-label="Search pets, records, notes, visits or commands"
            autoComplete="off"
            spellCheck={false}
            value={query}
            placeholder="Search pets, records, notes, visits or commands…"
            onChange={(event) => {
              setQuery(event.target.value)
              setActiveIndex(0)
            }}
            onKeyDown={onKeyDown}
            className="text-body placeholder:text-muted-foreground h-11 w-full min-w-0 bg-transparent outline-none"
          />
        </div>

        <div
          ref={listRef}
          id="command-palette-results"
          role="listbox"
          aria-label="Command results"
          className="max-h-[min(60vh,26rem)] overflow-y-auto p-1.5"
        >
          {items === undefined && query.trim() === '' ? (
            <p data-testid="command-loading" className="text-small text-muted-foreground p-3">
              Loading the household…
            </p>
          ) : null}

          {sections.map((section) => (
            <div
              key={section.key}
              role="group"
              aria-labelledby={`command-group-${section.key}`}
              data-testid={`command-group-${section.key}`}
              className="pb-1"
            >
              <p
                id={`command-group-${section.key}`}
                className="text-overline text-muted-foreground px-2 py-1.5"
              >
                {section.label}
              </p>
              {section.items.map((item) => {
                const index = indexById.get(item.id) ?? 0
                return (
                  <div
                    key={item.id}
                    id={`command-option-${index}`}
                    role="option"
                    aria-selected={index === active}
                    data-testid={`command-item-${item.id}`}
                    data-option-index={index}
                    onMouseMove={() => setActiveIndex(index)}
                    onClick={() => activate(item)}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-md px-2 py-2',
                      index === active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-small truncate font-medium">{item.label}</span>
                      <span className="text-caption text-muted-foreground truncate">
                        {item.description}
                      </span>
                    </span>
                  </div>
                )
              })}
            </div>
          ))}

          {items !== undefined && visible.length === 0 ? (
            <p data-testid="command-empty" className="text-small text-muted-foreground p-3">
              No matches for “{query.trim()}”.
            </p>
          ) : null}
        </div>

        <div className="border-border text-caption text-muted-foreground flex items-center border-t px-3 py-2">
          <span className="ml-auto tabular-nums">
            {visible.length} {visible.length === 1 ? 'result' : 'results'}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
