/**
 * `/pets` table (05 F5, 06 M2).
 *
 * TanStack Table v9 is imported only here, so it lives in the `/pets` route
 * chunk and never in the eager shell (the size gate scans for its markers).
 * Sorting is the controlled slice that mirrors the URL (`?sort=&dir=`, F6), and
 * every comparator is the pure F5 comparator from `src/lib/pets-table.ts` — the
 * table adds interaction, not a second sort implementation.
 *
 * Rendering is deliberately explicit rather than column-template driven: the
 * row is a composition of product cells (avatar, due chip, actions), and only
 * the model (row order, sort state) comes from TanStack.
 */
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type OnChangeFn,
  type SortingState,
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ChevronsUpDown, Pencil, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { petTabPath } from '@/lib/pet-tabs'
import {
  PET_SORT_LABELS,
  comparePetRows,
  type PetSortKey,
  type PetTableQuery,
  type PetTableRow,
  type SortDirection,
} from '@/lib/pets-table'
import type { Pet } from '@/lib/rules/types'
import { FOCUSABLE_ROW_PROPS, handleTableRowKey } from '@/lib/table-keyboard'
import { cn } from '@/lib/utils'

import { DueBadge } from './DueBadge'
import { PetAvatar } from './PetAvatar'
import { STICKY_IDENTITY_CELL, STICKY_IDENTITY_HEAD, StickyTable } from './StickyTable'

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, PetTableRow>()

/** URL sort key → TanStack column id (columns sort on their row-model field). */
const COLUMN_BY_SORT: Record<PetSortKey, string> = {
  name: 'name',
  species: 'species',
  age: 'ageYears',
  weight: 'weightKg',
  due: 'dueRank',
}

const SORT_BY_COLUMN: Record<string, PetSortKey> = {
  name: 'name',
  species: 'species',
  ageYears: 'age',
  weightKg: 'weight',
  dueRank: 'due',
}

const columns = columnHelper.columns([
  columnHelper.accessor('name', {
    header: 'Name',
    sortFn: (rowA, rowB) => comparePetRows(rowA.original, rowB.original, 'name'),
  }),
  columnHelper.accessor('species', {
    header: 'Species',
    sortFn: (rowA, rowB) => comparePetRows(rowA.original, rowB.original, 'species'),
  }),
  columnHelper.accessor('ageYears', {
    header: 'Age',
    sortFn: (rowA, rowB) => comparePetRows(rowA.original, rowB.original, 'age'),
  }),
  columnHelper.accessor('weightKg', {
    header: 'Weight',
    sortFn: (rowA, rowB) => comparePetRows(rowA.original, rowB.original, 'weight'),
  }),
  columnHelper.accessor('dueRank', {
    header: 'Due',
    sortDescFirst: true,
    sortFn: (rowA, rowB) => comparePetRows(rowA.original, rowB.original, 'due'),
  }),
])

function ariaSort(state: false | 'asc' | 'desc'): 'ascending' | 'descending' | 'none' {
  if (state === 'asc') {
    return 'ascending'
  }
  if (state === 'desc') {
    return 'descending'
  }
  return 'none'
}

export interface PetsTableProps {
  rows: readonly PetTableRow[]
  query: PetTableQuery
  onSortChange: (sort: PetSortKey, dir: SortDirection) => void
  onEdit: (pet: Pet) => void
  onDelete: (pet: Pet) => void
}

export function PetsTable({ rows, query, onSortChange, onEdit, onDelete }: PetsTableProps) {
  const navigate = useNavigate()

  const sorting = useMemo<SortingState>(
    () => [{ id: COLUMN_BY_SORT[query.sort], desc: query.dir === 'desc' }],
    [query.sort, query.dir],
  )

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    if (first === undefined) {
      return
    }
    const sortKey = SORT_BY_COLUMN[first.id]
    if (sortKey === undefined) {
      return
    }
    onSortChange(sortKey, first.desc ? 'desc' : 'asc')
  }

  const data = useMemo(() => [...rows], [rows])

  const table = useTable({
    features,
    columns,
    data,
    state: { sorting },
    onSortingChange,
    enableSortingRemoval: false,
    enableMultiSort: false,
    getRowId: (row) => row.id,
  })

  const openPet = (petId: string): void => {
    navigate(petTabPath(petId))
  }

  return (
    <StickyTable surface="page" data-testid="pets-table" aria-label="Household pets">
      <TableHeader>
        <TableRow className="h-[var(--row-height)] hover:bg-transparent">
          {table.getHeaderGroups().map((group) =>
            group.headers.map((header) => {
              const sortKey = SORT_BY_COLUMN[header.column.id]
              const label =
                sortKey === undefined
                  ? String(header.column.columnDef.header)
                  : PET_SORT_LABELS[sortKey]
              const sorted = header.column.getIsSorted()
              return (
                <TableHead
                  key={header.id}
                  aria-sort={ariaSort(sorted)}
                  data-testid={sortKey === undefined ? undefined : `pets-th-${sortKey}`}
                  className={sortKey === 'name' ? STICKY_IDENTITY_HEAD : undefined}
                >
                  <button
                    type="button"
                    onClick={header.column.getToggleSortingHandler()}
                    title={`Sort by ${label.toLowerCase()}`}
                    className="text-overline text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-sm uppercase focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {label}
                    {sorted === 'asc' ? (
                      <ArrowUp aria-hidden="true" className="size-3" />
                    ) : sorted === 'desc' ? (
                      <ArrowDown aria-hidden="true" className="size-3" />
                    ) : (
                      <ChevronsUpDown aria-hidden="true" className="size-3 opacity-40" />
                    )}
                  </button>
                </TableHead>
              )
            }),
          )}
          <TableHead className="w-[104px] text-right">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => {
          const item = row.original
          return (
            <TableRow
              key={row.id}
              data-testid={`pet-row-${item.id}`}
              {...FOCUSABLE_ROW_PROPS}
              className="hover:bg-muted/50 focus-visible:bg-muted h-[var(--row-height)] cursor-pointer focus-visible:outline-none"
              onClick={() => openPet(item.id)}
              onKeyDown={(event) => {
                handleTableRowKey(event, () => openPet(item.id))
              }}
            >
              <TableCell className={cn(STICKY_IDENTITY_CELL, 'text-small')}>
                <span className="flex items-center gap-2.5">
                  <PetAvatar pet={item.pet} />
                  <Link
                    to={petTabPath(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    className="text-small hover:text-primary font-medium hover:underline"
                  >
                    {item.name}
                  </Link>
                </span>
              </TableCell>
              <TableCell className="text-small text-muted-foreground">{item.speciesLine}</TableCell>
              <TableCell className="text-small tabular-nums">{item.ageLabel}</TableCell>
              <TableCell className="text-small tabular-nums">{item.weightLabel}</TableCell>
              <TableCell>
                <DueBadge status={item.dueStatus} detail={item.dueDetail} />
              </TableCell>
              <TableCell className="text-right">
                <span className="inline-flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Edit ${item.name}`}
                    title={`Edit ${item.name}`}
                    data-testid={`pet-edit-${item.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onEdit(item.pet)
                    }}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete ${item.name}`}
                    title={`Delete ${item.name}`}
                    data-testid={`pet-delete-${item.id}`}
                    onClick={(event) => {
                      event.stopPropagation()
                      onDelete(item.pet)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </StickyTable>
  )
}
