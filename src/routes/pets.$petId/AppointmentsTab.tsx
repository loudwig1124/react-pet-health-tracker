/**
 * `/pets/:petId/appointments` — this pet's visits (03 §2–§3, 06 M2/M3).
 *
 * Reuse, not a fork: the M3 `AppointmentTable`, `BookingDialog` and
 * `AppointmentActionsDialog` are imported as-is; the rows are the shared
 * `toAppointmentViews` rows filtered to this pet, the segment comes from the
 * shared partition, and every action is still gated and written by R3. The tab
 * never shows another pet's visit and never shows a household visit.
 *
 * `?status=upcoming|past`, `?sort=` and `?dir=` are the tab's URL state (F6), so
 * reload/bookmark restores the segment and order. Booking is preselected to this
 * pet (the dialog sees `pets={[pet]}`), and the tab stays put afterwards.
 */
import { CalendarDays } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAnnouncement } from '@/lib/hooks/useAnnouncement'
import type { Appointment, Pet } from '@/lib/rules/types'
import {
  appointmentSortChange,
  appointmentViewsForSegment,
  filterAppointmentViewsByPet,
  partitionAppointmentViews,
  sortAppointmentViews,
  toAppointmentViews,
  type AppointmentView,
} from '@/lib/schedule/appointments'
import { localToday } from '@/lib/schedule/format'
import {
  defaultAppointmentDirection,
  parseAppointmentSearch,
  serializeAppointmentSearch,
  type AppointmentSearch,
  type AppointmentSegment,
  type AppointmentSortKey,
} from '@/lib/schedule/query'
import { AppointmentActionsDialog } from '@/routes/appointments/components/AppointmentActionsDialog'
import { AppointmentTable } from '@/routes/appointments/components/AppointmentTable'
import { BookingDialog } from '@/routes/appointments/components/BookingDialog'
import { useAppointmentsData } from '@/routes/appointments/useAppointmentsData'

export interface PetAppointmentsTabProps {
  pet: Pet
}

export function PetAppointmentsTab({ pet }: PetAppointmentsTabProps) {
  const { state, now, retry } = useAppointmentsData()
  const [searchParams, setSearchParams] = useSearchParams()
  const search = useMemo(() => parseAppointmentSearch(searchParams), [searchParams])
  const { message, announce } = useAnnouncement()
  const [bookingOpen, setBookingOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const data = state.kind === 'ready' ? state.data : null
  const today = localToday(now)

  const petViews = useMemo(() => {
    if (data === null) {
      return []
    }
    return filterAppointmentViewsByPet(
      toAppointmentViews([...data.upcoming, ...data.past], data.pets, now),
      pet.id,
    )
  }, [data, now, pet.id])

  const partition = useMemo(() => partitionAppointmentViews(petViews), [petViews])
  const segmentViews = useMemo(
    () => appointmentViewsForSegment(partition, search.status),
    [partition, search.status],
  )
  const visible = useMemo(
    () => sortAppointmentViews(segmentViews, search.sort, search.dir),
    [segmentViews, search.dir, search.sort],
  )
  const selectedView = useMemo(
    () => petViews.find((view) => view.appointment.id === selectedId) ?? null,
    [petViews, selectedId],
  )

  /**
   * Writes only the tab's own state. `pet`/`view`/`day` are deliberately not
   * serialised: the pet is the route, this tab has no calendar, and a household
   * hand-off parameter must not leak onto a pet page. The M3 parser/serialiser
   * stays the single source of truth for the segment and sort pairs.
   */
  const updateSearch = useCallback(
    (patch: Partial<AppointmentSearch>) => {
      setSearchParams(
        serializeAppointmentSearch({
          status: search.status,
          view: 'table',
          petParam: undefined,
          petId: null,
          day: null,
          sort: search.sort,
          dir: search.dir,
          ...patch,
        }),
      )
    },
    [search.dir, search.sort, search.status, setSearchParams],
  )

  const changeSegment = useCallback(
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

  function handleBooked(appointment: Appointment): void {
    announce(`Visit booked for ${pet.name}.`)
    void appointment
    updateSearch({
      status: 'upcoming',
      dir: search.sort === 'when' ? 'asc' : search.dir,
    })
  }

  function handleRescheduled(day: string): void {
    void day
    updateSearch({ status: 'upcoming', dir: search.sort === 'when' ? 'asc' : search.dir })
  }

  const segmentEmpty = (
    <EmptyState
      testId="pet-appointments-segment-empty"
      title={
        search.status === 'upcoming'
          ? `No upcoming visits for ${pet.name}`
          : `No past visits for ${pet.name} yet`
      }
      description={
        search.status === 'upcoming'
          ? 'Book a visit and it will appear here.'
          : 'Completed and cancelled visits stay in this list.'
      }
    />
  )

  return (
    <div className="border-border bg-card flex flex-col rounded-xl border">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div className="flex flex-col gap-0.5">
          <p className="text-overline text-muted-foreground">Visits</p>
          <p className="text-caption text-muted-foreground" data-testid="pet-appointments-count">
            {data === null
              ? 'Loading the visits…'
              : `${petViews.length} ${petViews.length === 1 ? 'visit' : 'visits'} for ${pet.name}`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.kind === 'ready' && petViews.length > 0 ? (
            <ToggleGroup
              type="single"
              value={search.status}
              aria-label="Visit status"
              onValueChange={(value) => {
                if (value === 'upcoming' || value === 'past') {
                  changeSegment(value)
                }
              }}
            >
              <ToggleGroupItem
                value="upcoming"
                data-testid="pet-appointments-status-upcoming"
                aria-label="Upcoming"
              >
                Upcoming
              </ToggleGroupItem>
              <ToggleGroupItem
                value="past"
                data-testid="pet-appointments-status-past"
                aria-label="Past"
              >
                Past
              </ToggleGroupItem>
            </ToggleGroup>
          ) : null}
          <Button
            type="button"
            data-testid="pet-appointment-book"
            disabled={state.kind !== 'ready'}
            onClick={() => setBookingOpen(true)}
          >
            <CalendarDays aria-hidden="true" />
            Book visit
          </Button>
        </div>
      </div>

      <p
        role="status"
        aria-live="polite"
        data-testid="pet-appointments-announcement"
        className={message === null ? 'sr-only' : 'text-small text-status-up-to-date px-4 pt-3'}
      >
        {message}
      </p>

      {state.kind === 'loading' ? (
        <div
          data-testid="pet-appointments-loading"
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
          data-testid="pet-appointments-error"
          role="alert"
          className="border-status-overdue/30 bg-status-overdue-soft text-status-overdue m-4 rounded-xl border p-4"
        >
          <p className="text-body font-medium">Could not load this pet&apos;s visits.</p>
          <p className="text-small mt-1">{state.message}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3" onClick={retry}>
            Retry
          </Button>
        </div>
      ) : null}

      {state.kind === 'ready' && petViews.length === 0 ? (
        <div className="p-4">
          <EmptyState
            testId="pet-appointments-empty"
            icon={<CalendarDays aria-hidden="true" />}
            title={`No visits for ${pet.name} yet`}
            description="Book the first visit and it will show up here."
            action={
              <Button
                type="button"
                data-testid="pet-appointments-empty-book"
                onClick={() => setBookingOpen(true)}
              >
                <CalendarDays aria-hidden="true" />
                Book visit
              </Button>
            }
          />
        </div>
      ) : null}

      {state.kind === 'ready' && petViews.length > 0 ? (
        <div className="p-4">
          <AppointmentTable
            views={visible}
            sort={search.sort}
            direction={search.dir}
            onSort={changeSort}
            onManage={(view: AppointmentView) => setSelectedId(view.appointment.id)}
            emptyContent={segmentEmpty}
          />
        </div>
      ) : null}

      {data !== null && bookingOpen ? (
        <BookingDialog
          open
          onOpenChange={setBookingOpen}
          pets={[pet]}
          defaultPetId={pet.id}
          today={today}
          onBooked={handleBooked}
        />
      ) : null}

      {selectedView === null ? null : (
        <AppointmentActionsDialog
          key={selectedView.appointment.id}
          appointment={selectedView.appointment}
          petLabel={pet.name}
          open
          onOpenChange={(open) => {
            if (!open) {
              setSelectedId(null)
            }
          }}
          onMessage={announce}
          onRescheduled={handleRescheduled}
          onClosed={() =>
            updateSearch({
              status: 'past',
              dir: search.sort === 'when' ? 'desc' : search.dir,
            })
          }
        />
      )}
    </div>
  )
}
