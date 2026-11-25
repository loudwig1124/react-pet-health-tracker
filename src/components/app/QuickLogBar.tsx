import { Link } from 'react-router'

import { JOURNAL_KIND_LABELS, QUICK_LOG_KINDS } from '@/lib/rules/constants'
import type { JournalKind } from '@/lib/rules/types'

export interface QuickLogBarProps {
  pets: readonly { id: string; name: string }[]
  petId: string
  pendingKind: JournalKind | null
  onPetChange: (petId: string) => void
  onLog: (kind: JournalKind) => void
}

const QUICK_BUTTON =
  'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-7 items-center justify-center gap-1 rounded-[min(var(--radius-md),12px)] border px-2.5 text-[0.8rem] font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50'

/**
 * The dashboard quick-log bar (03 §3): pick a pet, then one click logs that
 * kind at the current moment through the same journal write path as the full
 * editor. 02 §1's fixed order is Walk / Fed / Meds / Note; "More…" opens
 * `/journal` for the seven-kind form (the long-press replacement 05 asks for).
 *
 * Native controls on purpose: the dashboard is the initial route, so its chunk
 * is inside the 200 kB first-load gate — the shadcn Button/NativeSelect
 * wrappers are not worth their bytes here (see 01 D8).
 */
export function QuickLogBar({ pets, petId, pendingKind, onPetChange, onLog }: QuickLogBarProps) {
  const disabled = pets.length === 0

  return (
    <section
      aria-label="Quick log"
      data-testid="quick-log"
      className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3"
    >
      <span className="text-overline text-muted-foreground shrink-0">Quick log</span>

      <select
        aria-label="Pet for quick log"
        className="border-input bg-background text-foreground focus-visible:border-ring focus-visible:ring-ring/50 h-7 w-[9.5rem] appearance-none rounded-[min(var(--radius-md),10px)] border py-0.5 pr-7 pl-2.5 text-sm focus-visible:ring-3 focus-visible:outline-none disabled:opacity-50"
        value={petId}
        disabled={disabled}
        onChange={(event) => {
          onPetChange(event.currentTarget.value)
        }}
      >
        {pets.length === 0 ? <option value="">No pets yet</option> : null}
        {pets.map((pet) => (
          <option key={pet.id} value={pet.id}>
            {pet.name}
          </option>
        ))}
      </select>

      <div className="flex flex-wrap items-center gap-2">
        {QUICK_LOG_KINDS.map((kind) => {
          const label = JOURNAL_KIND_LABELS[kind]
          return (
            <button
              key={kind}
              type="button"
              className={QUICK_BUTTON}
              aria-label={`Log ${label.toLowerCase()}`}
              data-testid={`quick-log-${kind}`}
              disabled={disabled || pendingKind !== null}
              onClick={() => {
                onLog(kind)
              }}
            >
              {pendingKind === kind ? 'Saving…' : label}
            </button>
          )
        })}
      </div>

      <Link
        to="/journal"
        aria-label="Open the journal for a full entry"
        className="text-foreground hover:bg-muted focus-visible:ring-ring ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        More…
      </Link>

      {disabled ? (
        <p className="text-caption text-muted-foreground basis-full">
          Add a pet before logging anything.
        </p>
      ) : null}
    </section>
  )
}
