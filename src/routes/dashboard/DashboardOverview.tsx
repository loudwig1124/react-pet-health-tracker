import { ArrowRight, CalendarDays, NotebookPen, PawPrint } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { DueBadge } from '@/components/app/DueBadge'
import { NumberTicker } from '@/components/ui/magicui/number-ticker'
import { Skeleton } from '@/components/ui/skeleton'
import type { AttentionDose } from '@/lib/desktop/attention'
import { formatDayMonth, formatInstantTime, formatWeekdayDayMonth } from '@/lib/format'
import { useDashboardData } from '@/lib/hooks/useDashboardData'
import { useSettings } from '@/lib/hooks/useSettings'
import { localDayOfInstant, relativeDayLabel } from '@/lib/rules/calendar'
import { JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import type { JournalEntry, Pet } from '@/lib/rules/types'
import { cn } from '@/lib/utils'

/**
 * The interactive quick-log half is a lazy island of its own. The first-load
 * budget counts this dashboard chunk, so the journal write path and toast store
 * arrive after first paint on an idle callback; the placeholder keeps the bar's
 * footprint so nothing shifts when it lands.
 */
const QuickLogIsland = lazy(() =>
  import('./QuickLogIsland').then((module) => ({ default: module.QuickLogIsland })),
)

function QuickLogSlot({ pets }: { pets: readonly { id: string; name: string }[] }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (typeof idleWindow.requestIdleCallback === 'function') {
      const handle = idleWindow.requestIdleCallback(() => setReady(true), { timeout: 1000 })
      return () => idleWindow.cancelIdleCallback?.(handle)
    }
    const timer = window.setTimeout(() => setReady(true), 100)
    return () => window.clearTimeout(timer)
  }, [])

  const placeholder = (
    <section
      aria-label="Quick log"
      aria-busy={ready ? undefined : 'true'}
      data-testid="quick-log-placeholder"
      className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3"
    >
      <span className="text-overline text-muted-foreground shrink-0">Quick log</span>
      <Skeleton className="h-7 w-[9.5rem] rounded-md" />
      {[0, 1, 2, 3].map((index) => (
        <Skeleton key={index} className="h-7 w-14 rounded-md" />
      ))}
    </section>
  )

  if (!ready) {
    return placeholder
  }
  return (
    <Suspense fallback={placeholder}>
      <QuickLogIsland pets={pets} />
    </Suspense>
  )
}

const COUNTER_LINK =
  'focus-visible:ring-ring group flex min-w-0 items-center justify-between gap-3 rounded-xl border px-4 py-3 transition-colors duration-[var(--dur-fast)] focus-visible:ring-2 focus-visible:outline-none'

interface CounterProps {
  testId: string
  to: string
  value: number
  label: string
  detail: string
  tone: 'neutral' | 'overdue' | 'due-soon' | 'brand'
}

function Counter({ testId, to, value, label, detail, tone }: CounterProps) {
  const toneClasses =
    tone === 'overdue'
      ? 'border-status-overdue/25 bg-status-overdue-soft text-status-overdue'
      : tone === 'due-soon'
        ? 'border-status-due-soon/25 bg-status-due-soon-soft text-status-due-soon'
        : tone === 'brand'
          ? 'border-primary/20 bg-accent-soft text-primary'
          : 'border-border bg-card text-foreground'

  return (
    <Link
      to={to}
      data-testid={testId}
      data-count={value}
      aria-label={`${value} ${label}`}
      className={cn(COUNTER_LINK, toneClasses, 'hover:brightness-[0.985]')}
    >
      <span className="flex min-w-0 flex-col">
        <span className="text-stat leading-none">
          <NumberTicker value={value} testId={`${testId}-value`} label={label} />
        </span>
        <span className="text-caption mt-1 truncate opacity-80">{detail}</span>
      </span>
      <span className="text-overline shrink-0 text-right">{label}</span>
    </Link>
  )
}

function attentionTo(dose: AttentionDose): string {
  const query = new URLSearchParams()
  query.set('status', dose.status)
  query.set('pet', dose.petId)
  return `/vaccinations?${query.toString()}`
}

function journalDayLabel(entry: JournalEntry, today: string): string {
  const day = localDayOfInstant(entry.occurredAt)
  const relative = relativeDayLabel(day, today)
  if (relative === 'today') {
    return 'Today'
  }
  if (relative === 'yesterday') {
    return 'Yesterday'
  }
  return formatDayMonth(day)
}

/**
 * The desktop's reveal classes implement 03 §3's recent-journal cap (3 / 4 / 5 /
 * 6 rows as the viewport grows) without a resize listener: the six newest are
 * fetched once and CSS hides the overflow. Never on scroll or filter (03 §4).
 */
const RECENT_VISIBILITY = [
  'flex',
  'flex',
  'flex',
  'hidden min-[1024px]:flex',
  'hidden min-[1280px]:flex',
  'hidden min-[1440px]:flex',
] as const

/**
 * Per-pet attention for the dashboard card: the existing `attention` list is
 * already worst-first (overdue beats due soon), so the first row for a pet is
 * its worst current status. Pets without a row are in date. This is display
 * composition over the F1 read model — no second status implementation.
 */
function worstAttentionByPet(
  attention: readonly AttentionDose[],
): ReadonlyMap<string, AttentionDose> {
  const byPet = new Map<string, AttentionDose>()
  for (const dose of attention) {
    if (!byPet.has(dose.petId)) {
      byPet.set(dose.petId, dose)
    }
  }
  return byPet
}

function HouseholdPets({
  pets,
  attention,
}: {
  pets: readonly Pet[]
  attention: readonly AttentionDose[]
}) {
  const worstByPet = worstAttentionByPet(attention)

  return (
    <section
      className="border-border bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4"
      aria-label="Pets"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h2 className="text-overline text-muted-foreground">
            Pets
            <span className="sr-only"> </span>
          </h2>
          <span
            aria-hidden="true"
            data-testid="dashboard-pets-count"
            className="bg-muted text-muted-foreground text-caption inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 font-semibold tabular-nums"
          >
            {pets.length}
          </span>
        </div>
        <Link to="/pets" className="text-small text-primary shrink-0 hover:underline">
          View all pets
        </Link>
      </div>

      {pets.length === 0 ? (
        <div
          data-testid="dashboard-pets-empty"
          className="border-border bg-card/60 flex flex-wrap items-center gap-3 rounded-lg border border-dashed px-4 py-4"
        >
          <p className="text-small font-medium">No pets yet</p>
          <p className="text-caption text-muted-foreground">
            Add the first pet to start tracking its health.
          </p>
          <Link
            to="/pets?new=1"
            data-testid="dashboard-pets-empty-add"
            className="bg-primary text-primary-foreground hover:bg-primary/80 focus-visible:ring-ring ml-auto inline-flex h-8 items-center justify-center rounded-[var(--radius)] px-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Add a pet
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y" data-testid="dashboard-pets">
          {pets.map((pet) => {
            const worst = worstByPet.get(pet.id)
            const status = worst?.status ?? 'up_to_date'
            const detail = worst === undefined ? null : worst.phrase
            return (
              <li key={pet.id}>
                <Link
                  to={`/pets/${encodeURIComponent(pet.id)}`}
                  className="focus-visible:ring-ring hover:bg-muted/50 -mx-2 flex items-center gap-2.5 rounded-md px-2 py-2.5 focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="bg-accent-soft text-primary flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold">
                    {pet.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-small truncate font-medium">{pet.name}</span>
                    <span className="text-caption text-muted-foreground truncate">
                      {pet.breed === null ? pet.species : `${pet.species} · ${pet.breed}`}
                    </span>
                  </span>
                  <DueBadge
                    status={status}
                    detail={detail}
                    label={
                      status === 'overdue'
                        ? 'Overdue'
                        : status === 'due_soon'
                          ? 'Due soon'
                          : 'In date'
                    }
                  />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function AttentionRail({ attention }: { attention: readonly AttentionDose[] }) {
  return (
    <section
      data-testid="attention-rail"
      aria-label="Needs attention"
      className="border-border bg-card flex min-w-0 flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-overline text-muted-foreground">Needs attention</h2>
        {attention.length > 0 ? (
          <span className="text-caption text-muted-foreground tabular-nums">
            {attention.length}
          </span>
        ) : null}
      </div>

      {attention.length === 0 ? (
        <p className="text-small text-muted-foreground" data-testid="attention-empty">
          Nothing needs attention. Every tracked booster is in date.
        </p>
      ) : (
        <ul className="flex flex-col divide-y">
          {attention.map((dose) => (
            <li key={dose.dose.id}>
              <Link
                to={attentionTo(dose)}
                data-testid={`attention-row-${dose.dose.id}`}
                data-status={dose.status}
                className="focus-visible:ring-ring flex items-center gap-3 py-2 focus-visible:ring-2 focus-visible:outline-none"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    dose.status === 'overdue' ? 'bg-status-overdue' : 'bg-status-due-soon',
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-small truncate font-medium">
                    {dose.petName} · {dose.dose.vaccineName}
                  </span>
                  <span
                    className={cn(
                      'text-caption',
                      dose.status === 'overdue' ? 'text-status-overdue' : 'text-status-due-soon',
                    )}
                  >
                    {dose.phrase}
                  </span>
                </span>
                <span className="text-caption text-muted-foreground inline-flex shrink-0 items-center gap-1">
                  Review
                  <ArrowRight aria-hidden="true" className="size-3" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        to="/vaccinations"
        className="text-caption text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1 rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        View all vaccinations
        <ArrowRight aria-hidden="true" className="size-3" />
      </Link>
    </section>
  )
}

function NextVisit({ data }: { data: NonNullable<ReturnType<typeof useDashboardData>> }) {
  const visit = data.nextVisit
  return (
    <section
      data-testid="next-visit"
      aria-label="Next visit"
      className="border-border bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4"
    >
      <h2 className="text-overline text-muted-foreground">Next visit</h2>
      {visit === null ? (
        <div className="flex flex-col gap-3" data-testid="next-visit-empty">
          <p className="text-small text-muted-foreground">
            No visit booked. Schedule one from Appointments.
          </p>
          <Link
            to="/appointments"
            data-testid="next-visit-book"
            className="border-border bg-background hover:bg-muted focus-visible:ring-ring text-small inline-flex h-10 w-fit items-center gap-2 rounded-md border px-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <CalendarDays aria-hidden="true" className="size-4" />
            Book a visit
          </Link>
        </div>
      ) : (
        <>
          <p className="text-small font-medium">{formatWeekdayDayMonth(visit.day)}</p>
          <ul className="flex flex-col gap-1">
            {visit.visits.map((entry) => (
              <li key={entry.appointment.id} data-testid={`next-visit-row-${entry.appointment.id}`}>
                <Link
                  to={`/appointments?status=upcoming&day=${visit.day}`}
                  className="focus-visible:ring-ring flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md focus-visible:ring-2 focus-visible:outline-none"
                >
                  <span className="text-small font-medium">
                    {formatInstantTime(entry.appointment.scheduledAt)}
                  </span>
                  <span className="text-small">{entry.petLabel}</span>
                  <span className="text-caption text-muted-foreground">
                    {entry.appointment.purpose}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <Link
        to="/appointments"
        className="text-caption text-primary focus-visible:ring-ring inline-flex w-fit items-center gap-1 rounded-sm hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        All appointments
        <ArrowRight aria-hidden="true" className="size-3" />
      </Link>
    </section>
  )
}

function RecentJournal({ entries, today }: { entries: readonly JournalEntry[]; today: string }) {
  return (
    <section
      data-testid="recent-journal"
      aria-label="Recent journal"
      className="border-border bg-card flex min-w-0 flex-col gap-2 rounded-xl border p-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-overline text-muted-foreground">Recent journal</h2>
        <Link to="/journal" className="text-caption text-primary hover:underline">
          View all
        </Link>
      </div>
      {entries.length === 0 ? (
        <p className="text-small text-muted-foreground" data-testid="recent-journal-empty">
          Nothing logged yet — use Quick log or open the Journal.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {entries.map((entry, index) => (
            <li
              key={entry.id}
              data-testid={`recent-journal-row-${entry.id}`}
              className={cn(RECENT_VISIBILITY[index] ?? 'hidden', 'items-baseline gap-2')}
            >
              <span className="text-caption text-muted-foreground w-16 shrink-0 tabular-nums">
                {journalDayLabel(entry, today)}
              </span>
              <span className="text-caption text-muted-foreground w-12 shrink-0 tabular-nums">
                {formatInstantTime(entry.occurredAt)}
              </span>
              <span className="text-small min-w-0 flex-1 truncate">
                {JOURNAL_KIND_LABELS[entry.kind]}
                {entry.note === null || entry.note.trim() === '' ? '' : ` · ${entry.note}`}
              </span>
              {entry.durationMinutes === null ? null : (
                <span className="text-caption text-muted-foreground shrink-0 tabular-nums">
                  {entry.durationMinutes} min
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function DashboardOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-overview-loading" aria-busy="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[74px] rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-[58px] rounded-xl" />
      <div className="grid gap-4 xl:grid-cols-2">
        <Skeleton className="h-[210px] rounded-xl" />
        <Skeleton className="h-[210px] rounded-xl" />
        <Skeleton className="h-[130px] rounded-xl" />
        <Skeleton className="h-[130px] rounded-xl" />
      </div>
    </div>
  )
}

/**
 * F1 — the dashboard overview island.
 *
 * Loaded from `DashboardPage` as a lazy chunk so the new desktop composition
 * (counters, attention rail, next visit, recent journal, Number Ticker) cannot
 * push the eager shell over the 200 kB first-load gate. It paints immediately
 * after the shell (counters are the LCP candidate and land well inside 1.5 s),
 * and every counter is a drill-down link to the filtered list.
 */
export function DashboardOverview() {
  const settings = useSettings()
  const data = useDashboardData(settings.dueSoonWindowDays)

  if (data === undefined) {
    return <DashboardOverviewSkeleton />
  }

  const { attention, pets, recentJournal } = data

  return (
    <div className="flex flex-col gap-6" data-testid="dashboard-overview">
      <section
        data-testid="dashboard-counters"
        aria-label="Household counters"
        className="grid grid-cols-2 gap-3 md:grid-cols-4"
      >
        <Counter
          testId="counter-pets"
          to="/pets"
          value={attention.petCount}
          label={attention.petCount === 1 ? 'pet' : 'pets'}
          detail="In the household"
          tone="neutral"
        />
        <Counter
          testId="counter-overdue"
          to="/vaccinations?status=overdue"
          value={attention.overduePets}
          label="overdue"
          detail="Drill into vaccinations"
          tone="overdue"
        />
        <Counter
          testId="counter-due-soon"
          to="/vaccinations?status=due_soon"
          value={attention.dueSoonPets}
          label="due soon"
          detail={`Within ${settings.dueSoonWindowDays} days`}
          tone="due-soon"
        />
        <Counter
          testId="counter-visits"
          to="/appointments?status=upcoming"
          value={attention.visitsThisWeek}
          label="visits this week"
          detail="Mon–Sun, upcoming"
          tone="brand"
        />
      </section>

      <QuickLogSlot pets={pets} />

      {/*
       * Two equal rows of cards (05 F1 composition). A grid — not two
       * independent columns — is what keeps the pair of cards in each row the
       * same height at 1280+ and stops the old tall empty band under one card.
       * Below 1280 the four cards stack full-width (03 §1's one-column band).
       * Row 1 pairs the two list cards (pets with per-pet due chips, needs
       * attention); row 2 pairs next visit with the recent journal.
       */}
      <div className="grid gap-4 xl:grid-cols-2" data-testid="dashboard-cards">
        <HouseholdPets pets={pets} attention={attention.attention} />
        <AttentionRail attention={attention.attention} />
        <NextVisit data={data} />
        <RecentJournal entries={recentJournal} today={attention.today} />
      </div>

      {/*
       * Three household links, one style: the sidebar's own row metrics
       * (40 px tall, 12 px padding, 4 px radius, 14 px label). Previously the
       * journal was a bordered button while the other two were bare text links,
       * which read as two different weights of action.
       */}
      <section className="flex flex-wrap items-center gap-2" aria-label="Household links">
        <Link
          to="/journal"
          className="border-border bg-background hover:bg-muted focus-visible:ring-ring text-small inline-flex h-10 items-center gap-2 rounded-md border px-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <NotebookPen aria-hidden="true" className="size-4" />
          Open the journal
        </Link>
        <Link
          to="/appointments"
          className="border-border bg-background hover:bg-muted focus-visible:ring-ring text-small inline-flex h-10 items-center gap-2 rounded-md border px-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <CalendarDays aria-hidden="true" className="size-4" />
          Appointments
        </Link>
        <Link
          to="/records"
          className="border-border bg-background hover:bg-muted focus-visible:ring-ring text-small inline-flex h-10 items-center gap-2 rounded-md border px-3 font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <PawPrint aria-hidden="true" className="size-4" />
          Health records
        </Link>
      </section>
    </div>
  )
}
