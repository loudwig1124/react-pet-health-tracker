import { ChevronDown, ChevronUp } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppointmentStatusChip } from '@/components/app/ScheduleChips'
import {
  STICKY_IDENTITY_CELL,
  STICKY_IDENTITY_HEAD,
  StickyTable,
} from '@/components/app/StickyTable'
import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { AppointmentView } from '@/lib/schedule/appointments'
import { formatDateTime } from '@/lib/schedule/format'
import type { AppointmentSortKey, SortDirection } from '@/lib/schedule/query'
import { FOCUSABLE_ROW_PROPS, handleTableRowKey } from '@/lib/table-keyboard'
import { cn } from '@/lib/utils'

export interface AppointmentTableProps {
  views: readonly AppointmentView[]
  sort: AppointmentSortKey
  direction: SortDirection
  onSort: (sort: AppointmentSortKey) => void
  onManage: (view: AppointmentView) => void
  /** Rendered inside the table body when there is nothing to show. */
  emptyContent?: ReactNode
}

interface SortHeaderProps {
  label: string
  sortKey: AppointmentSortKey
  sort: AppointmentSortKey
  direction: SortDirection
  onSort: (sort: AppointmentSortKey) => void
  className?: string
}

function SortHeader({ label, sortKey, sort, direction, onSort, className }: SortHeaderProps) {
  const active = sort === sortKey
  return (
    <TableHead
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
    >
      <button
        type="button"
        data-testid={`appointment-sort-${sortKey}`}
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded-sm text-left font-medium text-muted-foreground transition-colors hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active ? (
          direction === 'asc' ? (
            <ChevronUp aria-hidden="true" className="size-3.5" />
          ) : (
            <ChevronDown aria-hidden="true" className="size-3.5" />
          )
        ) : (
          <ChevronDown aria-hidden="true" className="size-3.5 opacity-0" />
        )}
      </button>
    </TableHead>
  )
}

/** A small second line under the status chip for a closed visit's facts (R3). */
function statusDetail(view: AppointmentView): string | null {
  const appointment = view.appointment
  switch (appointment.status) {
    case 'completed':
      return appointment.completedAt === null
        ? 'Completed'
        : `Completed ${formatDateTime(appointment.completedAt)}`
    case 'cancelled':
      return appointment.cancelReason === null ? 'Cancelled' : `Reason: ${appointment.cancelReason}`
    case 'no_show':
      return 'No-show'
    case 'scheduled':
      return null
  }
}

/**
 * The visits table (03 §3 `/appointments`). Rows are flat and sortable; a
 * scheduled visit exposes one "Manage" action, while a terminal visit shows its
 * closing fact and no affordance at all — the state machine's terminal states
 * are immutable (R3).
 */
export function AppointmentTable({
  views,
  sort,
  direction,
  onSort,
  onManage,
  emptyContent,
}: AppointmentTableProps) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <StickyTable surface="card" data-testid="appointments-table" aria-label="Vet appointments">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortHeader
              label="When"
              sortKey="when"
              sort={sort}
              direction={direction}
              onSort={onSort}
              className={STICKY_IDENTITY_HEAD}
            />
            <SortHeader
              label="Pet"
              sortKey="pet"
              sort={sort}
              direction={direction}
              onSort={onSort}
            />
            <SortHeader
              label="Clinic"
              sortKey="clinic"
              sort={sort}
              direction={direction}
              onSort={onSort}
            />
            <TableHead scope="col">Purpose</TableHead>
            <SortHeader
              label="Status"
              sortKey="status"
              sort={sort}
              direction={direction}
              onSort={onSort}
            />
            <TableHead scope="col" className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {views.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={6} className="py-4">
                {emptyContent}
              </TableCell>
            </TableRow>
          ) : null}
          {views.map((view) => {
            const appointment = view.appointment
            const detail = statusDetail(view)
            return (
              <TableRow
                key={appointment.id}
                data-testid={`appointment-row-${appointment.id}`}
                data-status={appointment.status}
                data-day={view.day}
                {...FOCUSABLE_ROW_PROPS}
                className="focus-visible:bg-muted h-[var(--row-height)] focus-visible:outline-none"
                onKeyDown={(event) => {
                  handleTableRowKey(
                    event,
                    appointment.status === 'scheduled' ? () => onManage(view) : undefined,
                  )
                }}
              >
                <TableCell className={cn(STICKY_IDENTITY_CELL, 'whitespace-nowrap tabular-nums')}>
                  <time dateTime={appointment.scheduledAt}>
                    {formatDateTime(appointment.scheduledAt)}
                  </time>
                </TableCell>
                <TableCell className="font-medium">{view.petLabel}</TableCell>
                <TableCell>{appointment.clinicName}</TableCell>
                <TableCell className="text-muted-foreground">{appointment.purpose}</TableCell>
                <TableCell>
                  <div className="flex flex-col items-start gap-0.5">
                    <AppointmentStatusChip status={appointment.status} />
                    {detail === null ? null : (
                      <span className="text-caption text-muted-foreground">{detail}</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {appointment.status === 'scheduled' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid={`appointment-actions-${appointment.id}`}
                      onClick={() => onManage(view)}
                    >
                      Manage
                    </Button>
                  ) : (
                    <span className="text-caption text-muted-foreground">Closed</span>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </StickyTable>
    </div>
  )
}
