import { ChevronDown, ChevronUp, Plus } from 'lucide-react'

import { DueStatusChip } from '@/components/app/ScheduleChips'
import {
  STICKY_IDENTITY_CELL,
  STICKY_IDENTITY_HEAD,
  StickyTable,
} from '@/components/app/StickyTable'
import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateKey } from '@/lib/schedule/format'
import type { VaccinationSearch, VaccinationSortKey } from '@/lib/schedule/query'
import type { VaccinationView } from '@/lib/schedule/vaccinations'
import { FOCUSABLE_ROW_PROPS, handleTableRowKey } from '@/lib/table-keyboard'
import { cn } from '@/lib/utils'

export interface VaccinationsTableProps {
  views: readonly VaccinationView[]
  search: Pick<VaccinationSearch, 'sort' | 'dir'>
  onSort: (sort: VaccinationSortKey) => void
  onAddDose: (petId: string) => void
}

interface SortHeaderProps {
  label: string
  sortKey: VaccinationSortKey
  active: boolean
  direction: 'asc' | 'desc'
  onSort: (sort: VaccinationSortKey) => void
  className?: string
}

function SortHeader({ label, sortKey, active, direction, onSort, className }: SortHeaderProps) {
  return (
    <TableHead
      scope="col"
      aria-sort={active ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={className}
    >
      <button
        type="button"
        data-testid={`vaccination-sort-${sortKey}`}
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

/**
 * The household dose table (03 §3 `/vaccinations`). Every dose is a row; a
 * superseded row keeps its history but never claims a due status, because the
 * newest dose per vaccine is what the pet's status means (R1).
 */
export function VaccinationsTable({ views, search, onSort, onAddDose }: VaccinationsTableProps) {
  return (
    <div className="border-border bg-card overflow-hidden rounded-xl border">
      <StickyTable
        surface="card"
        data-testid="vaccinations-table"
        aria-label="Household vaccinations"
      >
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <SortHeader
              label="Pet"
              sortKey="pet"
              active={search.sort === 'pet'}
              direction={search.dir}
              onSort={onSort}
              className={STICKY_IDENTITY_HEAD}
            />
            <SortHeader
              label="Vaccine"
              sortKey="vaccine"
              active={search.sort === 'vaccine'}
              direction={search.dir}
              onSort={onSort}
            />
            <SortHeader
              label="Given"
              sortKey="given"
              active={search.sort === 'given'}
              direction={search.dir}
              onSort={onSort}
            />
            <SortHeader
              label="Next due"
              sortKey="next"
              active={search.sort === 'next'}
              direction={search.dir}
              onSort={onSort}
            />
            <SortHeader
              label="Status"
              sortKey="status"
              active={search.sort === 'status'}
              direction={search.dir}
              onSort={onSort}
            />
            <TableHead scope="col" className="hidden lg:table-cell">
              Vet
            </TableHead>
            <TableHead scope="col" className="text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {views.map((view) => (
            <TableRow
              key={view.dose.id}
              data-testid={`vaccination-row-${view.dose.id}`}
              data-superseded={view.isCurrent ? 'false' : 'true'}
              data-pet-status={view.petStatus}
              data-dose-status={view.dueStatus}
              {...FOCUSABLE_ROW_PROPS}
              className="focus-visible:bg-muted h-[var(--row-height)] focus-visible:outline-none"
              onKeyDown={(event) => {
                handleTableRowKey(event, () => onAddDose(view.dose.petId))
              }}
            >
              <TableCell className={cn(STICKY_IDENTITY_CELL, 'font-medium')}>
                {view.petLabel}
              </TableCell>
              <TableCell>
                <span className="text-small">{view.vaccineLabel}</span>
              </TableCell>
              <TableCell className="tabular-nums">
                {formatDateKey(view.dose.vaccinationDate)}
              </TableCell>
              <TableCell className="text-muted-foreground tabular-nums">
                {view.dose.nextDueDate === null ? '—' : formatDateKey(view.dose.nextDueDate)}
              </TableCell>
              <TableCell>
                <DueStatusChip status={view.chipStatus} doseStatus={view.dueStatus} />
              </TableCell>
              <TableCell className="text-muted-foreground hidden lg:table-cell">
                {view.dose.vetName ?? '—'}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  data-testid={`vaccination-add-dose-${view.dose.id}`}
                  onClick={() => onAddDose(view.dose.petId)}
                >
                  <Plus aria-hidden="true" />
                  Add dose
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </StickyTable>
    </div>
  )
}
