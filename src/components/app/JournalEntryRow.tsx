import {
  Activity,
  Footprints,
  GraduationCap,
  Pill,
  Scissors,
  StickyNote,
  Utensils,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { formatDuration, formatInstantTime } from '@/lib/format'
import { JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import type { JournalEntry, JournalKind } from '@/lib/rules/types'
import { cn } from '@/lib/utils'

const KIND_ICONS: Record<JournalKind, LucideIcon> = {
  walk: Footprints,
  fed: Utensils,
  meds: Pill,
  grooming: Scissors,
  training: GraduationCap,
  note: StickyNote,
  symptom: Activity,
}

export interface JournalEntryRowProps {
  entry: JournalEntry
  petName: string
  selected?: boolean
  onOpen: (entry: JournalEntry) => void
}

/**
 * One journal entry in the day-grouped feed (03 §3). A whole-row button opens
 * the inline editor/Sheet; the row is the 64 px (52 px compact) two-line rhythm
 * from 03 §6 and never shows hover-only actions, so touch and keyboard reach the
 * same place. Kind is a label — R6 makes it immutable, so the feed never offers
 * to change it.
 */
export function JournalEntryRow({
  entry,
  petName,
  selected = false,
  onOpen,
}: JournalEntryRowProps) {
  const Icon = KIND_ICONS[entry.kind]
  const kindLabel = JOURNAL_KIND_LABELS[entry.kind]

  return (
    <button
      type="button"
      data-testid={`journal-entry-${entry.id}`}
      data-kind={entry.kind}
      aria-current={selected ? 'true' : undefined}
      onClick={() => onOpen(entry)}
      className={cn(
        'flex min-h-[var(--feed-row-height)] w-full items-start gap-3 rounded-lg border bg-card px-3 py-2 text-left',
        'transition-colors duration-[var(--dur-fast)] ease-[var(--ease-standard)]',
        'hover:bg-muted/60 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
        selected && 'border-primary bg-accent-soft/60',
      )}
    >
      <span
        aria-hidden="true"
        className="bg-accent-soft text-primary mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
      >
        <Icon className="size-4" strokeWidth={2} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-small text-foreground font-medium">{kindLabel}</span>
          <span className="text-caption text-muted-foreground truncate">{petName}</span>
          <span className="text-caption text-muted-foreground tabular-nums">
            {formatInstantTime(entry.occurredAt)}
          </span>
          {entry.durationMinutes === null ? null : (
            <Badge variant="secondary" className="h-5">
              {formatDuration(entry.durationMinutes)}
            </Badge>
          )}
        </span>
        {entry.note === null ? null : (
          <span className="text-small text-muted-foreground line-clamp-2">{entry.note}</span>
        )}
      </span>
    </button>
  )
}
