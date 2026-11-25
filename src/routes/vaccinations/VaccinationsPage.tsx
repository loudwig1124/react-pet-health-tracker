import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { PageAction } from '@/components/app/PageAction'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnnouncement } from '@/lib/hooks/useAnnouncement'
import { useCreateIntent } from '@/lib/hooks/useCreateIntent'
import { VACCINATION_DUE_STATUS_LABELS } from '@/lib/rules/constants'
import type { Vaccination, VaccinationDueStatus } from '@/lib/rules/types'
import {
  defaultVaccinationDirection,
  parseVaccinationSearch,
  serializeVaccinationSearch,
  type VaccinationSearch,
  type VaccinationSortKey,
} from '@/lib/schedule/query'
import {
  filterVaccinationViews,
  sortVaccinationViews,
  summarizeVaccinationViews,
  toVaccinationViews,
  vaccineFilterOptions,
  vaccinationSortChange,
  type VaccinationView,
} from '@/lib/schedule/vaccinations'

import { VaccinationDialog } from './components/VaccinationDialog'
import { VaccinationsTable } from './components/VaccinationsTable'
import { useVaccinationsData } from './useVaccinationsData'

function TableSkeleton() {
  return (
    <div
      data-testid="vaccinations-loading"
      className="border-border bg-card overflow-hidden rounded-xl border"
    >
      <Skeleton className="border-border h-11 rounded-none border-b" />
      {[0, 1, 2, 3, 4].map((index) => (
        <Skeleton key={index} className="border-border h-11 rounded-none border-b last:border-0" />
      ))}
    </div>
  )
}

/**
 * `/vaccinations` — every dose in the household with its due status, filters and
 * sort in the URL (03 §2, F5/F6). The status filter uses the pet status from R1
 * (newest dose per vaccine), so a re-vaccinated pet leaves the overdue view even
 * though its old rows are still listed as history.
 */
export function VaccinationsPage() {
  const { state, settings, today, retry } = useVaccinationsData()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseVaccinationSearch(searchParams), [searchParams])
  const { message, announce } = useAnnouncement()
  const [dialog, setDialog] = useState<{ open: boolean; petId: string | null }>({
    open: false,
    petId: null,
  })

  // The palette's "Add vaccination" create command lands here (?new=1),
  // prefilled from the pet filter the command carried.
  useCreateIntent(
    () => setDialog({ open: true, petId: search.petId }),
    state.kind === 'ready' && (state.data.pets.length > 0 || search.petId !== null),
  )

  const updateSearch = useCallback(
    (patch: Partial<VaccinationSearch>) => {
      setSearchParams(serializeVaccinationSearch({ ...search, ...patch }))
    },
    [search, setSearchParams],
  )

  const data = state.kind === 'ready' ? state.data : null
  const pets = data?.pets ?? []

  const views = useMemo<VaccinationView[]>(() => {
    if (data === null) {
      return []
    }
    return toVaccinationViews(data.doses, data.pets, today, settings.dueSoonWindowDays)
  }, [data, today, settings.dueSoonWindowDays])

  const filteredViews = useMemo(
    () => sortVaccinationViews(filterVaccinationViews(views, search), search.sort, search.dir),
    [views, search],
  )

  const vaccineOptions = useMemo(() => vaccineFilterOptions(views), [views])
  const summary = useMemo(() => summarizeVaccinationViews(views), [views])
  const filtersActive =
    search.status !== null || search.petId !== null || search.vaccineKey !== null
  const unknownPet =
    search.petId !== null && data !== null && !pets.some((pet) => pet.id === search.petId)

  const clearFilters = useCallback(() => {
    setSearchParams(
      serializeVaccinationSearch({
        ...search,
        status: null,
        petId: null,
        petParam: undefined,
        vaccineKey: null,
      }),
    )
  }, [search, setSearchParams])

  const handleSort = useCallback(
    (sort: VaccinationSortKey) => {
      const change = vaccinationSortChange(
        search.sort,
        search.dir,
        sort,
        defaultVaccinationDirection(sort),
      )
      updateSearch(change)
    },
    [search.dir, search.sort, updateSearch],
  )

  function openDialog(petId: string | null): void {
    setDialog({ open: true, petId })
  }

  function handleSaved(dose: Vaccination): void {
    const petName = pets.find((pet) => pet.id === dose.petId)?.name ?? 'the pet'
    announce(`Vaccination added for ${petName}.`)
  }

  const defaultDialogPet = dialog.petId ?? search.petId ?? pets[0]?.id ?? null

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <PageAction>
        <Button
          type="button"
          data-testid="vaccination-add"
          onClick={() => openDialog(search.petId)}
        >
          <Plus aria-hidden="true" />
          Add vaccination
        </Button>
      </PageAction>

      <p
        role="status"
        aria-live="polite"
        data-testid="vaccinations-announcement"
        className={message === null ? 'sr-only' : 'text-small text-status-up-to-date'}
      >
        {message}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <Label
              htmlFor="vaccinations-filter-status"
              className="text-caption text-muted-foreground"
            >
              Status
            </Label>
            <NativeSelect
              id="vaccinations-filter-status"
              data-testid="vaccinations-filter-status"
              value={search.status ?? 'all'}
              onChange={(event) => {
                const value = event.target.value
                updateSearch({
                  status: value === 'all' ? null : (value as VaccinationDueStatus),
                })
              }}
            >
              <NativeSelectOption value="all">All statuses</NativeSelectOption>
              <NativeSelectOption value="overdue">
                {VACCINATION_DUE_STATUS_LABELS.overdue}
              </NativeSelectOption>
              <NativeSelectOption value="due_soon">
                {VACCINATION_DUE_STATUS_LABELS.due_soon}
              </NativeSelectOption>
              <NativeSelectOption value="up_to_date">
                {VACCINATION_DUE_STATUS_LABELS.up_to_date}
              </NativeSelectOption>
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="vaccinations-filter-pet" className="text-caption text-muted-foreground">
              Pet
            </Label>
            <NativeSelect
              id="vaccinations-filter-pet"
              data-testid="vaccinations-filter-pet"
              value={search.petId ?? 'all'}
              onChange={(event) => {
                const value = event.target.value
                if (value === 'all') {
                  updateSearch({ petParam: 'all', petId: null })
                } else {
                  updateSearch({ petParam: value, petId: value })
                }
              }}
            >
              <NativeSelectOption value="all">All pets</NativeSelectOption>
              {pets.map((pet) => (
                <NativeSelectOption key={pet.id} value={pet.id}>
                  {pet.name}
                </NativeSelectOption>
              ))}
              {unknownPet && search.petId !== null ? (
                <NativeSelectOption value={search.petId}>Pet not found</NativeSelectOption>
              ) : null}
            </NativeSelect>
          </div>

          <div className="flex flex-col gap-1">
            <Label
              htmlFor="vaccinations-filter-vaccine"
              className="text-caption text-muted-foreground"
            >
              Vaccine
            </Label>
            <NativeSelect
              id="vaccinations-filter-vaccine"
              data-testid="vaccinations-filter-vaccine"
              value={search.vaccineKey ?? 'all'}
              onChange={(event) => {
                const value = event.target.value
                updateSearch({ vaccineKey: value === 'all' ? null : value })
              }}
            >
              <NativeSelectOption value="all">All vaccines</NativeSelectOption>
              {vaccineOptions.map((option) => (
                <NativeSelectOption key={option.key} value={option.key}>
                  {option.label}
                </NativeSelectOption>
              ))}
              {search.vaccineKey !== null &&
              !vaccineOptions.some((option) => option.key === search.vaccineKey) ? (
                <NativeSelectOption value={search.vaccineKey}>Unknown vaccine</NativeSelectOption>
              ) : null}
            </NativeSelect>
          </div>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="vaccinations-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        <p
          className="text-small text-muted-foreground tabular-nums"
          data-testid="vaccinations-count"
        >
          {filtersActive
            ? `${filteredViews.length} of ${views.length} doses`
            : `${summary.doses} ${summary.doses === 1 ? 'dose' : 'doses'} · ${summary.pets} ${
                summary.pets === 1 ? 'pet' : 'pets'
              }`}
          {summary.overdue > 0 ? ` · ${summary.overdue} overdue` : ''}
        </p>
      </div>

      {state.kind === 'loading' ? <TableSkeleton /> : null}

      {state.kind === 'error' ? (
        <div
          data-testid="vaccinations-error"
          role="alert"
          className="border-status-overdue/30 bg-status-overdue-soft text-status-overdue rounded-xl border p-4"
        >
          <p className="text-body font-medium">Could not load the vaccinations.</p>
          <p className="text-small mt-1">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' && pets.length === 0 ? (
        <EmptyState
          testId="vaccinations-empty"
          title="No pets yet"
          description="Add a pet before recording a vaccination."
          action={
            <Button asChild>
              <Link to="/pets">Add a pet</Link>
            </Button>
          }
        />
      ) : null}

      {state.kind === 'ready' && pets.length > 0 && views.length === 0 ? (
        <EmptyState
          testId="vaccinations-empty"
          title="No vaccinations recorded yet"
          description="Add the first dose and its next-due date."
          action={
            <Button type="button" onClick={() => openDialog(search.petId)}>
              <Plus aria-hidden="true" />
              Add vaccination
            </Button>
          }
        />
      ) : null}

      {state.kind === 'ready' && views.length > 0 && filteredViews.length === 0 ? (
        <EmptyState
          testId="vaccinations-filter-empty"
          title={unknownPet ? 'This pet is not in the household' : 'Nothing for this filter'}
          description={
            unknownPet
              ? 'The pet in this link no longer exists.'
              : `No doses match${search.status === null ? '' : ` a ${VACCINATION_DUE_STATUS_LABELS[search.status].toLowerCase()} pet`}${
                  search.vaccineKey === null ? '' : ' for this vaccine'
                }.`
          }
          action={
            <Button type="button" variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          }
        />
      ) : null}

      {state.kind === 'ready' && filteredViews.length > 0 ? (
        <VaccinationsTable
          views={filteredViews}
          search={search}
          onSort={handleSort}
          onAddDose={openDialog}
        />
      ) : null}

      {dialog.open ? (
        <VaccinationDialog
          open
          onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
          pets={pets}
          vaccineTypes={data?.vaccineTypes ?? []}
          defaultPetId={defaultDialogPet}
          today={today}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}
