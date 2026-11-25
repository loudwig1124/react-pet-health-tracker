/**
 * Vaccination due-status chip (R1/04 §1.1). Status is never colour-only: every
 * chip pairs its tint with an icon and the status word, so the overdue/due-soon
 * distinction survives colour blindness and greyscale screenshots.
 */
import { CircleCheck, Clock, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { VACCINATION_DUE_STATUS_LABELS } from '@/lib/rules/constants'
import type { VaccinationDueStatus } from '@/lib/rules/types'
import { cn } from '@/lib/utils'

interface DueBadgeMeta {
  icon: LucideIcon
  classes: string
}

const META: Record<VaccinationDueStatus, DueBadgeMeta> = {
  overdue: {
    icon: TriangleAlert,
    classes: 'border-status-overdue/25 bg-status-overdue-soft text-status-overdue',
  },
  due_soon: {
    icon: Clock,
    classes: 'border-status-due-soon/25 bg-status-due-soon-soft text-status-due-soon',
  },
  up_to_date: {
    icon: CircleCheck,
    classes: 'border-status-up-to-date/25 bg-status-up-to-date-soft text-status-up-to-date',
  },
}

export interface DueBadgeProps {
  status: VaccinationDueStatus
  /** The headline dose / due phrase, e.g. "Rabies · 35 days overdue". */
  detail?: string | null
  label?: string
  className?: string
}

export function DueBadge({ status, detail, label, className }: DueBadgeProps) {
  const meta = META[status]
  const Icon = meta.icon
  return (
    <span
      data-testid="due-badge"
      data-status={status}
      className={cn(
        'text-caption inline-flex h-6 max-w-full items-center gap-1 truncate rounded-[var(--radius-chip)] border px-2 font-medium',
        meta.classes,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3 shrink-0" />
      <span className="shrink-0">{label ?? VACCINATION_DUE_STATUS_LABELS[status]}</span>
      {detail === undefined || detail === null || detail === '' ? null : (
        <span className="text-caption truncate font-normal opacity-80">· {detail}</span>
      )}
    </span>
  )
}
