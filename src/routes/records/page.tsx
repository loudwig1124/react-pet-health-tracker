/**
 * `/records` — the household clinical history, newest first (03 §2–§3, 06 M2).
 *
 * Append-only by construction (R5): the only write affordance is "Add record";
 * there is no edit or delete path in this page or its table. Sort and filters
 * live in the URL (05 F6), and the list itself is a plain sorted table — no
 * TanStack in this route chunk (04 §2.2).
 */
import { FileHeart, Plus, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { HealthRecordDialog } from '@/components/app/HealthRecordDialog'
import { ListErrorState, TableSkeleton } from '@/components/app/ListStates'
import { PageAction } from '@/components/app/PageAction'
import { RecordsTable } from '@/components/app/RecordsTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  appendHealthRecord,
  deleteHealthRecord,
  updateHealthRecord,
} from '@/lib/db/repositories/health-records'
import { useCreateIntent } from '@/lib/hooks/useCreateIntent'
import { useRecordsPageData } from '@/lib/hooks/useRecordsPageData'
import {
  FILTER_ALL,
  filterRecordRows,
  hasRecordFilters,
  normalizeRecordsTableQuery,
  parseRecordsTableQuery,
  serializeRecordsTableQuery,
  type RecordsTableQuery,
  type RecordSortKey,
  type SortDirection,
} from '@/lib/records-table'
import type { HealthRecord } from '@/lib/rules/types'

function pluralNotes(count: number): string {
  return `${count} ${count === 1 ? 'note' : 'notes'}`
}

export function RecordsPage() {
  const live = useRecordsPageData()
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parseRecordsTableQuery(searchParams), [searchParams])
  const [adding, setAdding] = useState(false)
  // The note being corrected, or null when adding a new one.
  const [editingRecord, setEditingRecord] = useState<HealthRecord | null>(null)

  const updateQuery = useCallback(
    (patch: Partial<RecordsTableQuery>, options: { replace?: boolean } = {}) => {
      const next = normalizeRecordsTableQuery({ ...query, ...patch })
      setSearchParams(serializeRecordsTableQuery(next), { replace: options.replace ?? true })
    },
    [query, setSearchParams],
  )

  const data = live.status === 'ready' ? live.data : null
  const filteredRows = data === null ? [] : filterRecordRows(data.rows, query)
  const hasPets = data !== null && data.pets.length > 0
  const hasRecords = data !== null && data.rows.length > 0
  const filtersActive = hasRecordFilters(query)
  const defaultPetId =
    data !== null && query.pet !== FILTER_ALL && data.pets.some((pet) => pet.id === query.pet)
      ? query.pet
      : null

  const openAdd = (): void => setAdding(true)

  // The palette's "Add record" create command lands here. Needs a pet.
  useCreateIntent(() => {
    if (hasPets) {
      setAdding(true)
    }
  }, live.status === 'ready')

  return (
    <section className="flex flex-col gap-[var(--section-gap)]" data-testid="records-page">
      <PageAction>
        <Button
          type="button"
          data-testid="record-add"
          disabled={live.status !== 'ready' || !hasPets}
          onClick={openAdd}
        >
          <Plus aria-hidden="true" />
          Add record
        </Button>
      </PageAction>

      {hasRecords ? (
        <div className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <label htmlFor="records-search" className="text-caption text-muted-foreground">
              Search records
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                id="records-search"
                type="search"
                value={query.q}
                placeholder="Condition, diagnosis, treatment, vet or pet"
                className="pl-8"
                onChange={(event) => updateQuery({ q: event.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="records-pet" className="text-caption text-muted-foreground">
              Filter by pet
            </label>
            <NativeSelect
              id="records-pet"
              className="w-[180px]"
              value={query.pet}
              onChange={(event) => updateQuery({ pet: event.target.value })}
            >
              <NativeSelectOption value={FILTER_ALL}>All pets</NativeSelectOption>
              {(data?.pets ?? []).map((pet) => (
                <NativeSelectOption key={pet.id} value={pet.id}>
                  {pet.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          {filtersActive ? (
            <Button
              type="button"
              variant="outline"
              data-testid="records-clear-filters"
              onClick={() => updateQuery({ q: '', pet: FILTER_ALL })}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground" data-testid="records-count">
        {data === null
          ? 'Loading the clinical history…'
          : hasRecords
            ? `${pluralNotes(filteredRows.length)} shown${filtersActive ? ` of ${pluralNotes(data.rows.length)}` : ''} · append-only`
            : 'The household has no clinical notes yet.'}
      </p>

      {live.status === 'loading' ? <TableSkeleton testId="records-loading" columns={6} /> : null}

      {live.status === 'error' ? (
        <ListErrorState what="the clinical records" error={live.error} onRetry={live.retry} />
      ) : null}

      {data !== null && !hasPets ? (
        <EmptyState
          testId="records-empty"
          icon={<FileHeart aria-hidden="true" />}
          title="No pets yet"
          description="Clinical notes belong to a pet. Add a pet first, then record its visits and conditions here."
          action={
            <Button asChild>
              <Link to="/pets">
                <Plus aria-hidden="true" />
                Go to Pets
              </Link>
            </Button>
          }
        />
      ) : null}

      {data !== null && hasPets && !hasRecords ? (
        <EmptyState
          testId="records-empty"
          icon={<FileHeart aria-hidden="true" />}
          title="No clinical notes yet"
          description="Notes are permanent once added: they can be read here but never edited or deleted."
          action={
            <Button type="button" data-testid="records-empty-add" onClick={openAdd}>
              <Plus aria-hidden="true" />
              Add record
            </Button>
          }
        />
      ) : null}

      {data !== null && hasRecords && filteredRows.length === 0 ? (
        <EmptyState
          testId="records-filter-empty"
          title="Nothing matches these filters"
          description="No clinical note matches the current search or pet filter. The household still has notes."
          action={
            <Button
              type="button"
              variant="outline"
              data-testid="records-filter-empty-clear"
              onClick={() => updateQuery({ q: '', pet: FILTER_ALL })}
            >
              Clear filters
            </Button>
          }
        />
      ) : null}

      {data !== null && hasRecords && filteredRows.length > 0 ? (
        <RecordsTable
          rows={filteredRows}
          query={query}
          onSortChange={(sort: RecordSortKey, dir: SortDirection) =>
            updateQuery({ sort, dir }, { replace: false })
          }
          onEdit={(record) => setEditingRecord(record)}
        />
      ) : null}

      {adding && data !== null ? (
        <HealthRecordDialog
          pets={data.pets}
          defaultPetId={defaultPetId}
          today={data.today}
          onClose={() => setAdding(false)}
          onSubmit={async (draft) => {
            await appendHealthRecord(draft)
          }}
        />
      ) : null}

      {editingRecord !== null && data !== null ? (
        <HealthRecordDialog
          pets={data.pets}
          today={data.today}
          initial={editingRecord}
          onClose={() => setEditingRecord(null)}
          onSubmit={async (draft) => {
            await updateHealthRecord(editingRecord.id, draft)
          }}
          onDelete={async () => {
            await deleteHealthRecord(editingRecord.id)
          }}
        />
      ) : null}
    </section>
  )
}
