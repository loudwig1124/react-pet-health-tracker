import { CalendarDays, X } from 'lucide-react'
import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { PageAction } from '@/components/app/PageAction'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAnnouncement } from '@/lib/hooks/useAnnouncement'
import { useCreateIntent } from '@/lib/hooks/useCreateIntent'
import type { Appointment, DateKey } from '@/lib/rules/types'
import {
  appointmentSortChange,
  appointmentVisitDays,
  appointmentViewsForSegment,
  filterAppointmentViewsByDay,
  filterAppointmentViewsByPet,
  partitionAppointmentViews,
  sortAppointmentViews,
  toAppointmentViews,
  type AppointmentView,
} from '@/lib/schedule/appointments'
import { formatDateKey, localToday } from '@/lib/schedule/format'
import {
  defaultAppointmentDirection,
  parseAppointmentSearch,
  serializeAppointmentSearch,
  type AppointmentSearch,
  type AppointmentSegment,
  type AppointmentSortKey,
} from '@/lib/schedule/query'

import { AppointmentActionsDialog } from './components/AppointmentActionsDialog'
import { AppointmentTable } from './components/AppointmentTable'
import { BookingDialog } from './components/BookingDialog'
import { useAppointmentsData } from './useAppointmentsData'

/**
 * The calendar is the one date-picker luxury in v1 (04 §2.2), so it is its own
 * lazily imported chunk: the appointments route never ships it until the
 * household opens `?view=calendar`, and the initial shell never sees it.
 */
const AppointmentCalendar = lazy(() => import('@/components/app/AppointmentCalendar'))

function monthOf(day: DateKey): DateKey {
  return `${day.slice(0, 8)}01`
}

function TableSkeleton() {
  return (
    <div
      data-testid="appointments-loading"
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
 * `/appointments` — Upcoming/Past segmented table, the month calendar and the
 * booking/visit actions (03 §2–§3, F5/F6). View, segment, pet filter, selected
 * day and sort all live in the URL: `?status=&view=&pet=&day=&sort=&dir=`, with
 * `?pet=all` meaning "explicitly every pet" so a household hand-off can clear a
 * stale pet filter (R10).
 */
export function AppointmentsPage() {
  const { state, now, retry } = useAppointmentsData()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseAppointmentSearch(searchParams), [searchParams])
  const { message, announce } = useAnnouncement()
  const today = localToday(now)
  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Calendar navigation is local state; the displayed month falls back to the
  // month of the selected day (or today) without an effect.
  const [monthOverride, setMonthOverride] = useState<DateKey | null>(null)
  const month = monthOverride ?? monthOf(search.day ?? today)

  // ⌘N / the palette's "Book visit" command (F4 create intent).
  useCreateIntent(() => setBookingOpen(true), state.kind === 'ready')

  const data = state.kind === 'ready' ? state.data : null
  const pets = data?.pets ?? []

  const updateSearch = useCallback(
    (patch: Partial<AppointmentSearch>) => {
      setSearchParams(serializeAppointmentSearch({ ...search, ...patch }))
    },
    [search, setSearchParams],
  )

  const allViews = useMemo<AppointmentView[]>(() => {
    if (data === null) {
      return []
    }
    return toAppointmentViews([...data.upcoming, ...data.past], data.pets, now)
  }, [data, now])

  const partition = useMemo(() => partitionAppointmentViews(allViews), [allViews])
  const segmentViews = useMemo(
    () => appointmentViewsForSegment(partition, search.status),
    [partition, search.status],
  )
  const petFiltered = useMemo(
    () => filterAppointmentViewsByPet(segmentViews, search.petId),
    [segmentViews, search.petId],
  )
  const visible = useMemo(
    () =>
      sortAppointmentViews(
        filterAppointmentViewsByDay(petFiltered, search.day),
        search.sort,
        search.dir,
      ),
    [petFiltered, search.day, search.sort, search.dir],
  )
  const markedDays = useMemo(() => appointmentVisitDays(petFiltered), [petFiltered])
  const selectedView = useMemo(
    () => allViews.find((view) => view.appointment.id === selectedId) ?? null,
    [allViews, selectedId],
  )
  const unknownPet =
    search.petId !== null && data !== null && !pets.some((pet) => pet.id === search.petId)
  const filtersActive = search.petId !== null || search.day !== null

  const changeStatus = useCallback(
    (status: AppointmentSegment) => {
      updateSearch({
        status,
        dir: search.sort === 'when' ? defaultAppointmentDirection(status, 'when') : search.dir,
      })
    },
    [search.dir, search.sort, updateSearch],
  )

  const changeSort = useCallback(
    (sort: AppointmentSortKey) => {
      updateSearch(
        appointmentSortChange(
          search.sort,
          search.dir,
          sort,
          defaultAppointmentDirection(search.status, sort),
        ),
      )
    },
    [search.dir, search.sort, search.status, updateSearch],
  )

  const clearFilters = useCallback(() => {
    updateSearch({ petParam: undefined, petId: null, day: null })
  }, [updateSearch])

  const selectDay = useCallback(
    (day: DateKey | null) => {
      if (day !== null) {
        setMonthOverride(monthOf(day))
      }
      updateSearch({ day })
    },
    [updateSearch],
  )

  function handleBooked(appointment: Appointment): void {
    const petName = pets.find((pet) => pet.id === appointment.petId)?.name ?? 'the household'
    announce(`Visit booked for ${petName}.`)
    setSearchParams(
      serializeAppointmentSearch({
        ...search,
        status: 'upcoming',
        day: null,
        petParam: appointment.petId ?? 'all',
        petId: appointment.petId,
        dir: search.sort === 'when' ? 'asc' : search.dir,
      }),
    )
  }

  function handleRescheduled(day: DateKey): void {
    // The replacement row is scheduled, so bring the Upcoming segment forward.
    setMonthOverride(monthOf(day))
    updateSearch({
      status: 'upcoming',
      day: null,
      dir: search.sort === 'when' ? 'asc' : search.dir,
    })
  }

  const emptyContent = (() => {
    if (data === null) {
      return null
    }
    if (allViews.length === 0) {
      return (
        <EmptyState
          testId="appointments-empty"
          icon={<CalendarDays aria-hidden="true" />}
          title={pets.length === 0 ? 'No pets yet' : 'No visits booked yet'}
          description={
            pets.length === 0
              ? 'Add a pet before booking a visit.'
              : 'Book the first appointment and it will show up here.'
          }
          action={
            pets.length === 0 ? (
              <Button asChild>
                <Link to="/pets">Add a pet</Link>
              </Button>
            ) : (
              <Button type="button" onClick={() => setBookingOpen(true)}>
                Book visit
              </Button>
            )
          }
        />
      )
    }
    return (
      <EmptyState
        testId="appointments-filter-empty"
        title={
          unknownPet
            ? 'This pet is not in the household'
            : search.day === null
              ? 'Nothing for this filter'
              : `No visits on ${formatDateKey(search.day)}`
        }
        description={
          unknownPet ? 'The pet in this link no longer exists.' : 'Try another day, pet or segment.'
        }
        action={
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        }
      />
    )
  })()

  return (
    <div className="flex flex-col gap-[var(--section-gap)]">
      <PageAction>
        <Button type="button" data-testid="appointment-book" onClick={() => setBookingOpen(true)}>
          <CalendarDays aria-hidden="true" />
          Book visit
        </Button>
      </PageAction>

      <p
        role="status"
        aria-live="polite"
        data-testid="appointments-announcement"
        className={message === null ? 'sr-only' : 'text-small text-status-up-to-date'}
      >
        {message}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <ToggleGroup
            type="single"
            value={search.status}
            aria-label="Visit status"
            onValueChange={(value) => {
              if (value === 'upcoming' || value === 'past') {
                changeStatus(value)
              }
            }}
          >
            <ToggleGroupItem
              value="upcoming"
              data-testid="appointments-status-upcoming"
              aria-label="Upcoming"
            >
              Upcoming
            </ToggleGroupItem>
            <ToggleGroupItem value="past" data-testid="appointments-status-past" aria-label="Past">
              Past
            </ToggleGroupItem>
          </ToggleGroup>

          <div className="flex flex-col gap-1">
            <Label htmlFor="appointments-filter-pet" className="text-caption text-muted-foreground">
              Pet
            </Label>
            <NativeSelect
              id="appointments-filter-pet"
              data-testid="appointments-filter-pet"
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

          <ToggleGroup
            type="single"
            value={search.view}
            aria-label="View"
            onValueChange={(value) => {
              if (value === 'table' || value === 'calendar') {
                updateSearch({ view: value })
              }
            }}
          >
            <ToggleGroupItem value="table" data-testid="appointments-view-table" aria-label="Table">
              Table
            </ToggleGroupItem>
            <ToggleGroupItem
              value="calendar"
              data-testid="appointments-view-calendar"
              aria-label="Calendar"
            >
              Calendar
            </ToggleGroupItem>
          </ToggleGroup>

          {filtersActive ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="appointments-clear-filters"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          ) : null}
        </div>

        <p
          className="text-small text-muted-foreground tabular-nums"
          data-testid="appointments-count"
        >
          {visible.length}
          {visible.length === 1 ? ' visit' : ' visits'}
          {filtersActive ? ` of ${segmentViews.length}` : ''}
        </p>
      </div>

      {search.day === null ? null : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="appointments-day-chip"
            onClick={() => selectDay(null)}
          >
            {formatDateKey(search.day)}
            <X aria-hidden="true" />
            <span className="sr-only">Clear selected day</span>
          </Button>
        </div>
      )}

      {state.kind === 'loading' ? <TableSkeleton /> : null}

      {state.kind === 'error' ? (
        <div
          data-testid="appointments-error"
          role="alert"
          className="border-status-overdue/30 bg-status-overdue-soft text-status-overdue rounded-xl border p-4"
        >
          <p className="text-body font-medium">Could not load the appointments.</p>
          <p className="text-small mt-1">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' && search.view === 'table' ? (
        <AppointmentTable
          views={visible}
          sort={search.sort}
          direction={search.dir}
          onSort={changeSort}
          onManage={(view) => setSelectedId(view.appointment.id)}
          emptyContent={visible.length === 0 ? emptyContent : undefined}
        />
      ) : null}

      {state.kind === 'ready' && search.view === 'calendar' ? (
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <Suspense
            fallback={
              <Skeleton
                data-testid="appointments-calendar-loading"
                className="h-[340px] rounded-xl"
              />
            }
          >
            <AppointmentCalendar
              month={month}
              selectedDay={search.day}
              markedDays={markedDays}
              onSelectDay={selectDay}
              onMonthChange={setMonthOverride}
            />
          </Suspense>

          <div className="flex min-w-0 flex-col gap-3">
            <h2 className="text-heading">
              {search.day === null ? 'All visits in this segment' : formatDateKey(search.day)}
            </h2>
            <AppointmentTable
              views={visible}
              sort={search.sort}
              direction={search.dir}
              onSort={changeSort}
              onManage={(view) => setSelectedId(view.appointment.id)}
              emptyContent={visible.length === 0 ? emptyContent : undefined}
            />
          </div>
        </div>
      ) : null}

      {bookingOpen ? (
        <BookingDialog
          open
          onOpenChange={setBookingOpen}
          pets={pets}
          defaultPetId={search.petId}
          today={today}
          onBooked={handleBooked}
        />
      ) : null}

      {selectedView === null ? null : (
        <AppointmentActionsDialog
          key={selectedView.appointment.id}
          appointment={selectedView.appointment}
          petLabel={selectedView.petLabel}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedId(null)
            }
          }}
          onMessage={announce}
          onRescheduled={handleRescheduled}
          onClosed={() => {
            updateSearch({
              status: 'past',
              day: null,
              dir: search.sort === 'when' ? 'desc' : search.dir,
            })
          }}
        />
      )}
    </div>
  )
}
