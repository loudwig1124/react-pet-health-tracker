/**
 * The five path-addressable pet tabs (03 §2–§3). They are real links — deep
 * links, Back and a bookmark must all reach the same tab — presented with the
 * ARIA tab role so the keyboard story is the standard one: Arrow keys move
 * between tabs and activate the destination, Tab leaves the tab strip.
 */
import type { KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'

import { PET_TABS, petTabPath, type PetTabKey } from '@/lib/pet-tabs'
import { cn } from '@/lib/utils'

export interface PetTabsProps {
  petId: string
  active: PetTabKey
}

export function PetTabs({ petId, active }: PetTabsProps) {
  const navigate = useNavigate()

  const focusTab = (key: PetTabKey): void => {
    window.requestAnimationFrame(() => {
      const element = document.getElementById(`pet-tab-${key}`)
      if (element instanceof HTMLElement) {
        element.focus()
      }
    })
  }

  const onKeyDown = (event: KeyboardEvent<HTMLAnchorElement>, index: number): void => {
    let nextIndex: number | null = null
    if (event.key === 'ArrowRight') {
      nextIndex = (index + 1) % PET_TABS.length
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + PET_TABS.length) % PET_TABS.length
    } else if (event.key === 'Home') {
      nextIndex = 0
    } else if (event.key === 'End') {
      nextIndex = PET_TABS.length - 1
    }
    if (nextIndex === null) {
      return
    }
    event.preventDefault()
    const next = PET_TABS[nextIndex]
    if (next === undefined) {
      return
    }
    navigate(petTabPath(petId, next.key))
    focusTab(next.key)
  }

  return (
    <div
      role="tablist"
      aria-label="Pet sections"
      data-testid="pet-tabs"
      className="border-border flex flex-wrap items-end gap-1 border-b"
    >
      {PET_TABS.map((tab, index) => {
        const selected = tab.key === active
        return (
          <Link
            key={tab.key}
            id={`pet-tab-${tab.key}`}
            to={petTabPath(petId, tab.key)}
            role="tab"
            aria-selected={selected}
            aria-current={selected ? 'page' : undefined}
            tabIndex={selected ? 0 : -1}
            data-testid={`pet-tab-${tab.key}`}
            data-active={selected}
            onClick={(event) => {
              // Already here: no navigation, no scroll reset.
              if (selected) {
                event.preventDefault()
              }
            }}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'text-small -mb-px inline-flex h-9 items-center rounded-t-md border-b-2 border-transparent px-3 font-medium',
              'text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]',
              'hover:text-foreground focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
              selected && 'border-primary text-foreground',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
