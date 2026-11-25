/**
 * `/pets` — the household as a sortable table (03 §3, 06 M2).
 *
 * Sort and every filter live in the URL (05 F6): `?q=&species=&due=&pet=&sort=&dir=`
 * survive a reload, a bookmark and Back/Forward. Reads are a Dexie live query,
 * so adding, editing or deleting a pet re-renders the table with no manual
 * refetch (R10).
 */
import { PawPrint, Plus, Search } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { DeletePetDialog } from '@/components/app/DeletePetDialog'
import { EmptyState } from '@/components/app/EmptyState'
import { ListErrorState, TableSkeleton } from '@/components/app/ListStates'
import { PageAction } from '@/components/app/PageAction'
import { PetFormDialog } from '@/components/app/PetFormDialog'
import { PetsTable } from '@/components/app/PetsTable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { createPet, deletePet, updatePet } from '@/lib/db/repositories/pets'
import { useCreateIntent } from '@/lib/hooks/useCreateIntent'
import { usePetsPageData } from '@/lib/hooks/usePetsPageData'
import { useSettings } from '@/lib/hooks/useSettings'
import {
  FILTER_ALL,
  PET_DUE_FILTERS,
  filterPetRows,
  hasPetFilters,
  normalizePetTableQuery,
  parsePetTableQuery,
  serializePetTableQuery,
  speciesFilterOptions,
  type PetDueFilter,
  type PetTableQuery,
  type PetSortKey,
  type SortDirection,
} from '@/lib/pets-table'
import { VACCINATION_DUE_STATUS_LABELS } from '@/lib/rules/constants'
import type { Pet } from '@/lib/rules/types'

const DUE_FILTER_LABELS: Record<PetDueFilter, string> = {
  all: 'Any status',
  overdue: VACCINATION_DUE_STATUS_LABELS.overdue,
  due_soon: VACCINATION_DUE_STATUS_LABELS.due_soon,
  up_to_date: VACCINATION_DUE_STATUS_LABELS.up_to_date,
}

function pluralPets(count: number): string {
  return `${count} ${count === 1 ? 'pet' : 'pets'}`
}

function pluralAlerts(count: number): string {
  return `${count} ${count === 1 ? 'alert' : 'alerts'}`
}

export function PetsPage() {
  const settings = useSettings()
  const live = usePetsPageData(settings)
  const [searchParams, setSearchParams] = useSearchParams()
  const query = useMemo(() => parsePetTableQuery(searchParams), [searchParams])

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPet, setEditingPet] = useState<Pet | null>(null)
  const [deletingPet, setDeletingPet] = useState<Pet | null>(null)

  const updateQuery = useCallback(
    (patch: Partial<PetTableQuery>, options: { replace?: boolean } = {}) => {
      const next = normalizePetTableQuery({ ...query, ...patch })
      setSearchParams(serializePetTableQuery(next), { replace: options.replace ?? true })
    },
    [query, setSearchParams],
  )

  const openCreate = (): void => {
    setEditingPet(null)
    setEditorOpen(true)
  }

  const openEdit = (pet: Pet): void => {
    setEditingPet(pet)
    setEditorOpen(true)
  }

  // ⌘N / the palette's "Add pet" command land here (F4 create intent).
  useCreateIntent(openCreate, live.status === 'ready')

  const data = live.status === 'ready' ? live.data : null
  const filteredRows = data === null ? [] : filterPetRows(data.rows, query)
  const hasPets = data !== null && data.pets.length > 0
  const filtersActive = hasPetFilters(query)
  const speciesOptions = data === null ? [] : speciesFilterOptions(data.pets)
  const alertCount =
    data === null ? 0 : data.rows.filter((row) => row.dueStatus !== 'up_to_date').length

  return (
    <section className="flex flex-col gap-[var(--section-gap)]" data-testid="pets-page">
      <PageAction>
        <Button
          type="button"
          data-testid="pet-add"
          disabled={live.status !== 'ready'}
          onClick={openCreate}
        >
          <Plus aria-hidden="true" />
          Add pet
        </Button>
      </PageAction>

      {data !== null && hasPets ? (
        <div className="border-border bg-card flex flex-wrap items-end gap-3 rounded-xl border p-3">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1">
            <label htmlFor="pets-search" className="text-caption text-muted-foreground">
              Search pets
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              />
              <Input
                id="pets-search"
                type="search"
                value={query.q}
                placeholder="Name, species or breed"
                className="pl-8"
                onChange={(event) => updateQuery({ q: event.target.value })}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pets-species" className="text-caption text-muted-foreground">
              Filter by species
            </label>
            <NativeSelect
              id="pets-species"
              className="w-[150px]"
              value={query.species}
              onChange={(event) => updateQuery({ species: event.target.value })}
            >
              <NativeSelectOption value={FILTER_ALL}>All species</NativeSelectOption>
              {speciesOptions.map((species) => (
                <NativeSelectOption key={species} value={species}>
                  {species}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pets-due" className="text-caption text-muted-foreground">
              Filter by due status
            </label>
            <NativeSelect
              id="pets-due"
              className="w-[150px]"
              value={query.due}
              onChange={(event) => updateQuery({ due: event.target.value as PetDueFilter })}
            >
              {PET_DUE_FILTERS.map((due) => (
                <NativeSelectOption key={due} value={due}>
                  {DUE_FILTER_LABELS[due]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="pets-pet" className="text-caption text-muted-foreground">
              Filter by pet
            </label>
            <NativeSelect
              id="pets-pet"
              className="w-[160px]"
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
              data-testid="pets-clear-filters"
              onClick={() =>
                updateQuery({ q: '', species: FILTER_ALL, due: FILTER_ALL, pet: FILTER_ALL })
              }
            >
              Clear filters
            </Button>
          ) : null}
        </div>
      ) : null}

      <p className="text-caption text-muted-foreground" data-testid="pets-count">
        {data === null
          ? 'Loading the household…'
          : hasPets
            ? `${pluralPets(filteredRows.length)} shown · ${pluralAlerts(alertCount)} across the household`
            : 'The household has no pets yet.'}
      </p>

      {live.status === 'loading' ? <TableSkeleton testId="pets-loading" columns={6} /> : null}

      {live.status === 'error' ? (
        <ListErrorState what="the pets" error={live.error} onRetry={live.retry} />
      ) : null}

      {data !== null && !hasPets ? (
        <EmptyState
          testId="pets-empty"
          icon={<PawPrint aria-hidden="true" />}
          title="No pets yet"
          description="Add the first pet to keep vaccinations, vet visits and clinical notes in one place."
          action={
            <Button type="button" data-testid="pets-empty-add" onClick={openCreate}>
              <Plus aria-hidden="true" />
              Add pet
            </Button>
          }
        />
      ) : null}

      {data !== null && hasPets && filteredRows.length === 0 ? (
        <EmptyState
          testId="pets-filter-empty"
          title="Nothing matches these filters"
          description="No pet matches the current search, species, due status or pet filter. The household itself still has pets."
          action={
            <Button
              type="button"
              variant="outline"
              data-testid="pets-filter-empty-clear"
              onClick={() =>
                updateQuery({ q: '', species: FILTER_ALL, due: FILTER_ALL, pet: FILTER_ALL })
              }
            >
              Clear filters
            </Button>
          }
        />
      ) : null}

      {data !== null && hasPets && filteredRows.length > 0 ? (
        <PetsTable
          rows={filteredRows}
          query={query}
          onSortChange={(sort: PetSortKey, dir: SortDirection) =>
            updateQuery({ sort, dir }, { replace: false })
          }
          onEdit={openEdit}
          onDelete={setDeletingPet}
        />
      ) : null}

      {editorOpen && data !== null ? (
        <PetFormDialog
          pet={editingPet}
          existingPets={data.pets}
          today={data.today}
          onClose={() => {
            setEditorOpen(false)
            setEditingPet(null)
          }}
          onSubmit={async (draft) => {
            if (editingPet === null) {
              await createPet(draft)
            } else {
              await updatePet(editingPet.id, draft)
            }
          }}
        />
      ) : null}

      {deletingPet !== null ? (
        <DeletePetDialog
          pet={deletingPet}
          onClose={() => setDeletingPet(null)}
          onConfirm={async () => {
            await deletePet(deletingPet.id)
          }}
        />
      ) : null}
    </section>
  )
}
