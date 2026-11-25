import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAttentionCounts } from '@/lib/hooks/useAttentionCounts'
import { cn } from '@/lib/utils'

export type SidebarBadgeKind = 'vaccinations' | 'appointments'

export interface SidebarAttentionBadgeProps {
  kind: SidebarBadgeKind
  /** The rail renders a 16 px counter over the 40 px destination tile. */
  rail?: boolean
}

const BADGE_BASE =
  'inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-none tabular-nums'

function toneClass(kind: SidebarBadgeKind, hasOverdue: boolean): string {
  if (kind === 'appointments') {
    return 'bg-primary text-primary-foreground'
  }
  return hasOverdue
    ? 'bg-status-overdue text-primary-foreground'
    : 'bg-status-due-soon text-primary-foreground'
}

/**
 * F2 — the sidebar attention counts, mounted lazily inside each nav row.
 *
 * Vaccinations counts the **doses** that need attention (05 F2: "overdue + due
 * soon (tooltip splits)"), i.e. exactly the rows the dashboard rail lists; the
 * tooltip names each part. Appointments shows how many visits are scheduled
 * today. Zero renders nothing (05 F2 "hide zeros").
 *
 * These are the same R1/R4 derivations the dashboard uses — the dashboard's four
 * counters count *pets* by worst status while the badge counts the *doses* the
 * rail names, so both questions are answered from one status model.
 */
export function SidebarAttentionBadge({ kind, rail = false }: SidebarAttentionBadgeProps) {
  const attention = useAttentionCounts()
  if (attention === undefined) {
    return null
  }

  const overdueDoses = attention.attention.filter((dose) => dose.status === 'overdue').length
  const dueSoonDoses = attention.attention.filter((dose) => dose.status === 'due_soon').length
  const hasOverdue = overdueDoses > 0
  const count = kind === 'vaccinations' ? overdueDoses + dueSoonDoses : attention.todayVisits
  if (count === 0) {
    return null
  }

  const split =
    kind === 'vaccinations'
      ? `${overdueDoses} overdue · ${dueSoonDoses} due soon`
      : `${count} ${count === 1 ? 'visit' : 'visits'} booked today`

  if (rail) {
    return (
      <span
        data-testid={`nav-badge-${kind}`}
        data-count={count}
        title={split}
        aria-label={split}
        className={cn(BADGE_BASE, toneClass(kind, hasOverdue), 'absolute -top-0.5 -right-0.5')}
      >
        <span aria-hidden="true">{count}</span>
      </span>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid={`nav-badge-${kind}`}
          data-count={count}
          title={split}
          aria-label={split}
          className={cn(BADGE_BASE, toneClass(kind, hasOverdue), 'cursor-default')}
        >
          <span aria-hidden="true">{count}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" align="center">
        <span data-testid={`nav-badge-${kind}-tooltip`}>{split}</span>
      </TooltipContent>
    </Tooltip>
  )
}
