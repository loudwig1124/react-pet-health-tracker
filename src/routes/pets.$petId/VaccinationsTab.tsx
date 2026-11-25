/**
 * `/pets/:petId/vaccinations` — the pet's doses (03 §2–§3, 06 M2/M3).
 *
 * Reuse, not a fork: the M3 household table and dialog are imported as-is, the
 * rows are the same `toVaccinationViews` rows filtered to this pet with the
 * shared `filterVaccinationViews`, and the chips (including the neutral
 * "Superseded" history chip) come from the same component. R1 is never
 * re-implemented here — `toVaccinationViews` calls the shared rule per pet.
 *
 * Sort lives in the tab's own URL (`?sort=&dir=`), so a reload/bookmark restores
 * the tab. The dose dialog is opened with `pets={[pet]}` and `defaultPetId`, so
 * a dose can only be added to the pet whose page this is.
 */
import { Plus } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnnouncement } from '@/lib/hooks/useAnnouncement'
import type { Pet, Vaccination } from '@/lib/rules/types'
import {
  defaultVaccinationDirection,
  parseVaccinationSearch,
  serializeVaccinationSearch,
  type VaccinationSortKey,
} from '@/lib/schedule/query'
import {
  filterVaccinationViews,
  sortVaccinationViews,
  toVaccinationViews,
  vaccinationSortChange,
} from '@/lib/schedule/vaccinations'
import { VaccinationDialog } from '@/routes/vaccinations/components/VaccinationDialog'
import { VaccinationsTable } from '@/routes/vaccinations/components/VaccinationsTable'
import { useVaccinationsData } from '@/routes/vaccinations/useVaccinationsData'

export interface PetVaccinationsTabProps {
  pet: Pet
}

export function PetVaccinationsTab({ pet }: PetVaccinationsTabProps) {
  const { state, settings, today, retry } = useVaccinationsData()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseVaccinationSearch(searchParams), [searchParams])
  const { message, announce } = useAnnouncement()
  const [dialogOpen, setDialogOpen] = useState(false)

  const data = state.kind === 'ready' ? state.data : null

  const petViews = useMemo(() => {
    if (data === null) {
      return []
    }
    return filterVaccinationViews(
      toVaccinationViews(data.doses, data.pets, today, settings.dueSoonWindowDays),
      { petId: pet.id, status: null, vaccineKey: null },
    )
  }, [data, pet.id, settings.dueSoonWindowDays, today])

  const sortedViews = useMemo(
    () => sortVaccinationViews(petViews, search.sort, search.dir),
    [petViews, search.dir, search.sort],
  )

  const changeSort = useCallback(
    (sort: VaccinationSortKey) => {
      const change = vaccinationSortChange(
        search.sort,
        search.dir,
        sort,
        defaultVaccinationDirection(sort),
      )
      setSearchParams(
        serializeVaccinationSearch({
          status: null,
          petParam: undefined,
          petId: null,
          vaccineKey: null,
          ...change,
        }),
      )
    },
    [search.dir, search.sort, setSearchParams],
  )

  function handleSaved(dose: Vaccination): void {
    announce(`Vaccination added for ${pet.name}.`)
    void dose
  }

  return (
    <div className="border-border bg-card flex flex-col rounded-xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-overline text-muted-foreground">Vaccinations</p>
          <p className="text-caption text-muted-foreground" data-testid="pet-vaccinations-count">
            {data === null
              ? 'Loading the doses…'
              : `${petViews.length} ${petViews.length === 1 ? 'dose' : 'doses'} for ${pet.name}`}
          </p>
        </div>
        <Button
          type="button"
          data-testid="pet-vaccination-add"
          disabled={state.kind !== 'ready'}
          onClick={() => setDialogOpen(true)}
        >
          <Plus aria-hidden="true" />
          Add vaccination
        </Button>
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="pet-vaccinations-announcement"
        className={message === null ? 'sr-only' : 'text-small text-status-up-to-date px-4 pt-3'}
      >
        {message}
      </p>

      {state.kind === 'loading' ? (
        <div
          data-testid="pet-vaccinations-loading"
          className="border-border m-4 overflow-hidden rounded-xl border"
        >
          <Skeleton className="border-border h-11 rounded-none border-b" />
          {[0, 1, 2].map((index) => (
            <Skeleton
              key={index}
              className="border-border h-11 rounded-none border-b last:border-0"
            />
          ))}
        </div>
      ) : null}

      {state.kind === 'error' ? (
        <div
          data-testid="pet-vaccinations-error"
          role="alert"
          className="border-status-overdue/30 bg-status-overdue-soft text-status-overdue m-4 rounded-xl border p-4"
        >
          <p className="text-body font-medium">Could not load this pet&apos;s vaccinations.</p>
          <p className="text-small mt-1">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' && petViews.length === 0 ? (
        <div className="p-4">
          <EmptyState
            testId="pet-vaccinations-empty"
            title={`No doses recorded for ${pet.name} yet`}
            description="Add the first dose and its next-due date. The newest dose of each vaccine decides the pet's status."
            action={
              <Button
                type="button"
                data-testid="pet-vaccinations-empty-add"
                onClick={() => setDialogOpen(true)}
              >
                <Plus aria-hidden="true" />
                Add vaccination
              </Button>
            }
          />
        </div>
      ) : null}

      {state.kind === 'ready' && petViews.length > 0 ? (
        <div className="p-4">
          <VaccinationsTable
            views={sortedViews}
            search={search}
            onSort={changeSort}
            onAddDose={() => setDialogOpen(true)}
          />
        </div>
      ) : null}

      {data !== null && dialogOpen ? (
        <VaccinationDialog
          open
          onOpenChange={(open) => setDialogOpen(open)}
          pets={[pet]}
          vaccineTypes={data.vaccineTypes}
          defaultPetId={pet.id}
          today={today}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  )
}
