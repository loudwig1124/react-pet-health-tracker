/**
 * `/records` household table (05 F5/F6, 06 M2).
 *
 * Deliberately dependency-free: a plain sorted table, no TanStack (04 §2.2).
 * Health records are append-only (R5), so there is no actions column at all —
 * no chevron, edit or delete affordance exists to render.
 */
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react'
import { useMemo } from 'react'

import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateKey } from '@/lib/format'
import {
  RECORD_SORT_LABELS,
  defaultDirectionForRecordSort,
  sortRecordRows,
  type RecordRow,
  type RecordSortKey,
  type RecordsTableQuery,
  type SortDirection,
} from '@/lib/records-table'
import { cn } from '@/lib/utils'

import { PetAvatar } from './PetAvatar'
import { STICKY_IDENTITY_CELL, STICKY_IDENTITY_HEAD, StickyTable } from './StickyTable'

function ariaSort(state: SortDirection | null): 'ascending' | 'descending' | 'none' {
  if (state === 'asc') {
    return 'ascending'
  }
  if (state === 'desc') {
    return 'descending'
  }
  return 'none'
}

export interface RecordsTableProps {
  rows: readonly RecordRow[]
  query: RecordsTableQuery
  onSortChange: (sort: RecordSortKey, dir: SortDirection) => void
}

export function RecordsTable({ rows, query, onSortChange }: RecordsTableProps) {
  const sorted = useMemo(
    () => sortRecordRows(rows, query.sort, query.dir),
    [rows, query.sort, query.dir],
  )

  const toggleSort = (sort: RecordSortKey): void => {
    if (query.sort === sort) {
      onSortChange(sort, query.dir === 'asc' ? 'desc' : 'asc')
      return
    }
    onSortChange(sort, defaultDirectionForRecordSort(sort))
  }

  return (
    <StickyTable surface="page" data-testid="records-list" aria-label="Clinical records">
      <TableHeader>
        <TableRow className="h-[var(--row-height)] hover:bg-transparent">
          {(['date', 'pet', 'title'] as const).map((key) => (
            <TableHead
              key={key}
              aria-sort={ariaSort(query.sort === key ? query.dir : null)}
              data-testid={`records-th-${key}`}
              className={key === 'date' ? STICKY_IDENTITY_HEAD : undefined}
            >
              <button
                type="button"
                onClick={() => toggleSort(key)}
                title={`Sort by ${RECORD_SORT_LABELS[key].toLowerCase()}`}
                className="text-overline text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm uppercase focus-visible:ring-2 focus-visible:outline-none"
              >
                {RECORD_SORT_LABELS[key]}
                {query.sort === key ? (
                  query.dir === 'asc' ? (
                    <ArrowUp aria-hidden="true" className="size-3" />
                  ) : (
                    <ArrowDown aria-hidden="true" className="size-3" />
                  )
                ) : (
                  <ChevronsUpDown aria-hidden="true" className="size-3 opacity-40" />
                )}
              </button>
            </TableHead>
          ))}
          <TableHead className="hidden lg:table-cell">Vet</TableHead>
          <TableHead className="hidden xl:table-cell">Treatment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((row) => (
          <TableRow
            key={row.id}
            data-testid={`record-row-${row.id}`}
            className="h-[var(--row-height)]"
          >
            <TableCell
              className={cn(
                STICKY_IDENTITY_CELL,
                'text-small text-muted-foreground whitespace-nowrap tabular-nums',
              )}
            >
              {formatDateKey(row.date)}
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-2">
                <PetAvatar pet={{ name: row.petName, species: row.petSpecies }} />
                <span className="text-small font-medium">{row.petName}</span>
              </span>
            </TableCell>
            <TableCell className="max-w-[28rem] whitespace-normal">
              <span className="flex min-w-0 flex-col">
                <span className="text-small font-medium">{row.title}</span>
                {row.record.diagnosis !== null && row.record.diagnosis !== row.title ? (
                  <span className="text-caption text-muted-foreground">{row.record.diagnosis}</span>
                ) : null}
                {row.record.prescribedMedication === null ? null : (
                  <span className="text-caption text-muted-foreground">
                    Rx {row.record.prescribedMedication}
                  </span>
                )}
              </span>
            </TableCell>
            <TableCell className="text-small text-muted-foreground hidden lg:table-cell">
              {row.record.vetName ?? '—'}
            </TableCell>
            <TableCell
              className={cn(
                'text-small text-muted-foreground hidden max-w-[20rem] truncate xl:table-cell',
              )}
            >
              {row.record.treatment ?? '—'}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </StickyTable>
  )
}
