/**
 * Status chips for the schedule screens (02 R1/R3, 04 §1.1).
 *
 * Status is never colour-only (WCAG 1.4.1): every chip carries an icon and a
 * word, and a `data-*` attribute so tests and future keyboard help can read the
 * same value without parsing the label. A superseded dose is deliberately not
 * called "overdue" — the newest dose decides the pet's status (R1).
 */
import { CircleAlert, CircleCheck, CircleDashed, Clock3, History } from 'lucide-react'
import type { ReactNode } from 'react'

import { APPOINTMENT_STATUS_LABELS, VACCINATION_DUE_STATUS_LABELS } from '@/lib/rules/constants'
import type { AppointmentStatus, VaccinationDueStatus } from '@/lib/rules/types'
import type { VaccinationChipStatus } from '@/lib/schedule/vaccinations'
import { cn } from '@/lib/utils'

const CHIP_BASE =
  'inline-flex h-6 w-fit items-center gap-1 rounded-[var(--radius-chip)] border px-2 text-caption font-medium whitespace-nowrap'

const DUE_STYLES: Record<VaccinationChipStatus, string> = {
  overdue: 'border-status-overdue/25 bg-status-overdue-soft text-status-overdue',
  due_soon: 'border-status-due-soon/25 bg-status-due-soon-soft text-status-due-soon',
  up_to_date: 'border-status-up-to-date/25 bg-status-up-to-date-soft text-status-up-to-date',
  superseded: 'border-border bg-muted text-muted-foreground',
}

const DUE_ICONS: Record<VaccinationChipStatus, ReactNode> = {
  overdue: <CircleAlert aria-hidden="true" className="size-3.5" />,
  due_soon: <Clock3 aria-hidden="true" className="size-3.5" />,
  up_to_date: <CircleCheck aria-hidden="true" className="size-3.5" />,
  superseded: <History aria-hidden="true" className="size-3.5" />,
}

const DUE_LABELS: Record<VaccinationChipStatus, string> = {
  ...VACCINATION_DUE_STATUS_LABELS,
  superseded: 'Superseded',
}

export interface DueStatusChipProps {
  status: VaccinationChipStatus
  /** The dose's own due status, kept alongside for the row's data attributes. */
  doseStatus?: VaccinationDueStatus
  className?: string
}

export function DueStatusChip({ status, doseStatus, className }: DueStatusChipProps) {
  return (
    <span
      data-slot="due-status-chip"
      data-testid={`due-chip-${status}`}
      data-due-status={status}
      data-dose-status={doseStatus ?? status}
      className={cn(CHIP_BASE, DUE_STYLES[status], className)}
    >
      {DUE_ICONS[status]}
      {DUE_LABELS[status]}
    </span>
  )
}

const APPOINTMENT_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'border-primary/25 bg-accent-soft text-primary',
  completed: 'border-status-up-to-date/25 bg-status-up-to-date-soft text-status-up-to-date',
  cancelled: 'border-border bg-muted text-muted-foreground',
  no_show: 'border-status-overdue/25 bg-status-overdue-soft text-status-overdue',
}

const APPOINTMENT_ICONS: Record<AppointmentStatus, ReactNode> = {
  scheduled: <Clock3 aria-hidden="true" className="size-3.5" />,
  completed: <CircleCheck aria-hidden="true" className="size-3.5" />,
  cancelled: <CircleDashed aria-hidden="true" className="size-3.5" />,
  no_show: <CircleAlert aria-hidden="true" className="size-3.5" />,
}

export interface AppointmentStatusChipProps {
  status: AppointmentStatus
  className?: string
}

export function AppointmentStatusChip({ status, className }: AppointmentStatusChipProps) {
  return (
    <span
      data-slot="appointment-status-chip"
      data-testid={`appointment-status-${status}`}
      data-status={status}
      className={cn(CHIP_BASE, APPOINTMENT_STYLES[status], className)}
    >
      {APPOINTMENT_ICONS[status]}
      {APPOINTMENT_STATUS_LABELS[status]}
    </span>
  )
}
