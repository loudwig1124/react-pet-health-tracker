import { lazy, Suspense, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { useOwnerIdentity } from '@/lib/hooks/useOwnerIdentity'
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'
import { formatWeekdayDate, greetingForDate, greetingName } from '@/lib/summary-format'

/**
 * The F1 overview (four counters, needs-attention rail, next visit, recent
 * journal, quick log) is an immediately-mounted lazy island. The `/` route is
 * part of the first-load budget (01 D8), and the M5 desktop composition must not
 * push the shell over 200 kB; the island's skeleton reserves the layout so there
 * is no shift when it lands (06 M5 performance pass).
 */
const DashboardOverview = lazy(() =>
  import('./DashboardOverview').then((module) => ({ default: module.DashboardOverview })),
)

/**
 * `/` — the desktop dashboard (03 §3, 05 F1). The first chunk keeps only the
 * greeting and the lazy boundary: the counters and the rail are derived by
 * `computeHouseholdAttention` (R1/R4) inside the overview chunk, and the quick
 * log arrives on an idle callback inside it.
 */
export function DashboardPage() {
  const owner = useOwnerIdentity()
  // The date line is read once per visit, like the Flutter home header.
  const [now] = useState(() => new Date())

  if (owner === undefined) {
    return (
      <div data-testid="dashboard-page" className="flex flex-col gap-6">
        <Skeleton className="h-16 max-w-md rounded-xl" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-[74px] rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  const name = greetingName(owner?.name ?? '', DEFAULT_OWNER_NAME)

  return (
    <div data-testid="dashboard-page" className="flex flex-col gap-6">
      <section className="flex flex-col gap-1" aria-label="Household summary">
        <p className="text-caption text-muted-foreground">{formatWeekdayDate(now)}</p>
        <h2 className="text-title" data-testid="dashboard-greeting">
          {greetingForDate(now)}
          {name === null ? '' : `, ${name}`}
        </h2>
        <p className="text-small text-muted-foreground">Everything stays on this computer.</p>
      </section>

      <Suspense fallback={<DashboardOverviewFallback />}>
        <DashboardOverview />
      </Suspense>
    </div>
  )
}

/** The island skeleton without a second lazy import (keeps the fallback instant). */
function DashboardOverviewFallback() {
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
