/**
 * `/pets/:petId/:tab?` — the pet detail shell (03 §3, 06 M2).
 *
 * Three regions: an ABOUT rail, the path-addressable tab panel, and a context
 * rail (next visit + recent journal). All five tabs are now real screens:
 * Overview and Records are M2, Vaccinations and Appointments reuse the M3
 * components against this pet, and Journal is the M4 journal tab. Every read is
 * a live query, so the form, the delete cascade and a write from another tab
 * all refresh the page (R10).
 */
import { ArrowLeft, CalendarDays, PawPrint, Pencil, Plus, Trash2 } from 'lucide-react'
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router'

import { DeletePetDialog } from '@/components/app/DeletePetDialog'
import { DueBadge } from '@/components/app/DueBadge'
import { EmptyState } from '@/components/app/EmptyState'
import { HealthRecordDialog } from '@/components/app/HealthRecordDialog'
import { ListErrorState } from '@/components/app/ListStates'
import { PetAvatar } from '@/components/app/PetAvatar'
import { PetFormDialog } from '@/components/app/PetFormDialog'
import { PetTabs } from '@/components/app/PetTabs'
import { PageSkeleton } from '@/components/layout/PageSkeleton'
import { Button } from '@/components/ui/button'
import { appendHealthRecord } from '@/lib/db/repositories/health-records'
import { deletePet, updatePet } from '@/lib/db/repositories/pets'
import {
  formatAge,
  formatDateKey,
  formatDateTime,
  formatTime,
  formatWeekdayDayMonth,
} from '@/lib/format'
import { usePetDetailData } from '@/lib/hooks/usePetDetailData'
import { useSettings } from '@/lib/hooks/useSettings'
import { petTabLabel, petTabPath, resolvePetTab } from '@/lib/pet-tabs'
import { dueDatePhrase } from '@/lib/pets-table'
import { lastVisitDateKey, localDayOfInstant } from '@/lib/rules/calendar'
import { JOURNAL_KIND_LABELS, PET_SEX_LABELS } from '@/lib/rules/constants'
import { healthRecordTitle } from '@/lib/rules/health-records'
import { formatWeight } from '@/lib/rules/settings'
import type { Appointment, HealthRecord, VaccinationDueStatus } from '@/lib/rules/types'
import {
  currentDoses,
  petDueSummary,
  vaccinationDueStatus,
  type VaccinationDoseInput,
} from '@/lib/rules/vaccination-due'

import { PetAppointmentsTab } from './AppointmentsTab'
import { PetVaccinationsTab } from './VaccinationsTab'

/**
 * The Journal tab is a lazy child of this already-lazy route: its editor, dialog
 * and quick-log chunk only load when the tab is opened, so the pet route chunk
 * (and the shell budget) stays untouched (06 M4/t10).
 */
const PetJournalTab = lazy(() =>
  import('./JournalTab').then((module) => ({ default: module.PetJournalTab })),
)

function dueStatusRank(status: VaccinationDueStatus): number {
  if (status === 'overdue') {
    return 0
  }
  return status === 'due_soon' ? 1 : 2
}

function nextScheduled(appointments: readonly Appointment[], nowIso: string): Appointment | null {
  const upcoming = appointments
    .filter((appointment) => appointment.status === 'scheduled' && appointment.scheduledAt > nowIso)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id))
  return upcoming[0] ?? null
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption text-muted-foreground shrink-0">{label}</dt>
      <dd className="text-small min-w-0 truncate text-right">{value}</dd>
    </div>
  )
}

export function PetDetailPage() {
  const { petId = '', tab } = useParams<{ petId: string; tab?: string }>()
  const settings = useSettings()
  const live = usePetDetailData(petId, settings)
  const navigate = useNavigate()

  const resolvedTab = resolvePetTab(tab)
  const [editing, setEditing] = useState(false)
  const [addingRecord, setAddingRecord] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const invalidTab = tab !== undefined && tab !== resolvedTab
  if (invalidTab) {
    return <Navigate replace to={petTabPath(petId, resolvedTab)} />
  }

  const shell = (content: ReactNode) => (
    <div data-testid="pet-detail-route" data-pet-id={petId} data-pet-tab={resolvedTab}>
      {content}
    </div>
  )

  if (live.status === 'loading') {
    return shell(<PageSkeleton variant="detail" />)
  }

  if (live.status === 'error') {
    return shell(<ListErrorState what="this pet" error={live.error} onRetry={live.retry} />)
  }

  const data = live.data
  const pet = data.pet
  if (pet === null) {
    return shell(
      <div data-testid="pet-not-found">
        <EmptyState
          icon={<PawPrint aria-hidden="true" />}
          title="Pet not found"
          description="This pet is no longer in the household — it may have been deleted or the link may be out of date."
          action={
            <Button asChild>
              <Link to="/pets">
                <ArrowLeft aria-hidden="true" />
                Back to Pets
              </Link>
            </Button>
          }
        />
      </div>,
    )
  }

  const today = data.today
  const nextAppointment = nextScheduled(data.appointments, data.nowIso)
  const lastVisit = lastVisitDateKey(
    data.appointments,
    data.records.map((record) => record.recordedOn),
  )
  const summary = petDueSummary(data.doses, today, data.windowDays)
  const dueRows = currentDoses(data.doses)
    .map((dose: VaccinationDoseInput) => ({
      dose,
      status: vaccinationDueStatus(dose, today, data.windowDays),
    }))
    .sort((a, b) => {
      const byStatus = dueStatusRank(a.status) - dueStatusRank(b.status)
      if (byStatus !== 0) {
        return byStatus
      }
      if (a.dose.nextDueDate == null || b.dose.nextDueDate == null) {
        return a.dose.nextDueDate == null ? 1 : -1
      }
      return a.dose.nextDueDate < b.dose.nextDueDate ? -1 : 1
    })
  const headline = summary.headline
  const meta = [
    pet.species,
    pet.breed,
    formatAge(pet.dateOfBirth, today),
    formatWeight(pet.weightKg, data.weightUnit),
  ]
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')

  return shell(
    <>
      <div data-testid="pet-detail" data-pet-id={pet.id} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3" data-testid="pet-header">
          <nav
            aria-label="Breadcrumb"
            className="text-caption text-muted-foreground flex items-center gap-1.5"
          >
            <Link to="/pets" className="hover:text-foreground hover:underline">
              Pets
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-foreground" aria-current="page">
              {pet.name}
            </span>
          </nav>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <PetAvatar pet={pet} size="lg" />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-title truncate" data-testid="pet-name">
                  {pet.name}
                </h2>
                <p className="text-small text-muted-foreground" data-testid="pet-meta">
                  {meta}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <DueBadge
                    status={summary.status}
                    detail={
                      headline === null
                        ? null
                        : `${headline.dose.vaccineName} · ${dueDatePhrase(headline.dose.nextDueDate ?? null, today) ?? 'no booster date'}`
                    }
                  />
                  <span className="text-caption text-muted-foreground">
                    Last visit: {lastVisit === null ? 'none yet' : formatDateKey(lastVisit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                data-testid="pet-edit"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden="true" />
                Edit pet
              </Button>
              <Button type="button" data-testid="record-add" onClick={() => setAddingRecord(true)}>
                <Plus aria-hidden="true" />
                Add record
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Delete ${pet.name}`}
                title={`Delete ${pet.name}`}
                data-testid="pet-delete"
                onClick={() => setDeleting(true)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_260px]">
          <aside
            data-testid="pet-about"
            aria-label="About this pet"
            className="border-border bg-card flex flex-col gap-5 rounded-xl border p-4"
          >
            <div>
              <p className="text-overline text-muted-foreground">About</p>
              <dl className="mt-2 flex flex-col gap-2">
                <AboutRow label="Owner" value={data.owner?.name ?? 'My household'} />
                <AboutRow label="Born" value={formatDateKey(pet.dateOfBirth)} />
                <AboutRow label="Age" value={formatAge(pet.dateOfBirth, today)} />
                <AboutRow label="Sex" value={PET_SEX_LABELS[pet.sex]} />
                <AboutRow label="Microchip" value={pet.microchip ?? 'Not recorded'} />
              </dl>
            </div>
            <div>
              <p className="text-overline text-muted-foreground">Due at a glance</p>
              {dueRows.length === 0 ? (
                <p className="text-caption text-muted-foreground mt-2">No vaccines recorded yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2.5">
                  {dueRows.map(({ dose, status }) => (
                    <li key={dose.id} className="flex flex-col gap-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-small min-w-0 truncate font-medium">
                          {dose.vaccineName}
                        </span>
                        <DueBadge status={status} />
                      </span>
                      <span className="text-caption text-muted-foreground">
                        {dueDatePhrase(dose.nextDueDate ?? null, today) ?? 'No booster date'}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          <section className="flex min-w-0 flex-col gap-4" aria-label="Pet sections">
            <PetTabs petId={pet.id} active={resolvedTab} />
            <div
              role="tabpanel"
              id={`pet-panel-${resolvedTab}`}
              aria-label={petTabLabel(resolvedTab)}
              data-testid={`pet-panel-${resolvedTab}`}
              className="min-w-0"
            >
              {resolvedTab === 'health' ? (
                <OverviewPanel
                  data={data}
                  nextAppointment={nextAppointment}
                  lastVisit={lastVisit}
                  onViewRecords={() => navigate(petTabPath(pet.id, 'records'))}
                />
              ) : resolvedTab === 'records' ? (
                <RecordsPanel records={data.records} onAdd={() => setAddingRecord(true)} />
              ) : resolvedTab === 'vaccinations' ? (
                <PetVaccinationsTab pet={pet} />
              ) : resolvedTab === 'appointments' ? (
                <PetAppointmentsTab pet={pet} />
              ) : (
                <Suspense
                  fallback={
                    <div
                      data-testid="pet-journal-loading"
                      className="bg-muted/60 h-16 animate-pulse rounded-lg"
                    />
                  }
                >
                  <PetJournalTab petId={pet.id} petName={pet.name} />
                </Suspense>
              )}
            </div>
          </section>

          <aside
            data-testid="pet-rail"
            aria-label="Pet context"
            className="flex min-w-0 flex-col gap-4 lg:col-span-2 xl:col-span-1"
          >
            <div className="border-border bg-card rounded-xl border p-4">
              <p className="text-overline text-muted-foreground flex items-center gap-1.5">
                <CalendarDays aria-hidden="true" className="size-3.5" />
                Next visit
              </p>
              {nextAppointment === null ? (
                <p className="text-caption text-muted-foreground mt-2">
                  No upcoming visits.{' '}
                  <Link to="/appointments" className="text-primary hover:underline">
                    Appointments
                  </Link>
                </p>
              ) : (
                <div className="mt-2 flex flex-col gap-0.5">
                  <p className="text-small font-medium">
                    {formatDateTime(nextAppointment.scheduledAt)}
                  </p>
                  <p className="text-small">{nextAppointment.purpose}</p>
                  <p className="text-caption text-muted-foreground">{nextAppointment.clinicName}</p>
                </div>
              )}
            </div>

            <div className="border-border bg-card rounded-xl border p-4">
              <p className="text-overline text-muted-foreground">Recent</p>
              {data.journal.length === 0 ? (
                <p className="text-caption text-muted-foreground mt-2">Nothing logged yet.</p>
              ) : (
                <ul className="mt-2 flex flex-col gap-2">
                  {data.journal.map((entry) => (
                    <li key={entry.id} className="flex items-baseline justify-between gap-2">
                      <span className="text-small min-w-0">
                        <span className="font-medium">{JOURNAL_KIND_LABELS[entry.kind]}</span>
                        {entry.note === null ? null : (
                          <span className="text-muted-foreground"> — {entry.note}</span>
                        )}
                      </span>
                      <span className="text-caption text-muted-foreground whitespace-nowrap">
                        {formatWeekdayDayMonth(localDayOfInstant(entry.occurredAt))}{' '}
                        {formatTime(entry.occurredAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </div>

      {editing ? (
        <PetFormDialog
          pet={pet}
          existingPets={data.pets}
          today={today}
          onClose={() => setEditing(false)}
          onSubmit={async (draft) => {
            await updatePet(pet.id, draft)
          }}
        />
      ) : null}

      {addingRecord ? (
        <HealthRecordDialog
          pets={data.pets}
          defaultPetId={pet.id}
          lockedPet={pet}
          today={today}
          onClose={() => setAddingRecord(false)}
          onSubmit={async (draft) => {
            await appendHealthRecord(draft)
          }}
        />
      ) : null}

      {deleting ? (
        <DeletePetDialog
          pet={pet}
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate('/pets')}
          onConfirm={async () => {
            await deletePet(pet.id)
          }}
        />
      ) : null}
    </>,
  )
}

/* -------------------------------------------------------------- tab panels */

interface OverviewPanelProps {
  data: {
    records: HealthRecord[]
  }
  nextAppointment: Appointment | null
  lastVisit: string | null
  onViewRecords: () => void
}

function OverviewPanel({ data, nextAppointment, lastVisit, onViewRecords }: OverviewPanelProps) {
  const latest = data.records.slice(0, 3)
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Next visit"
          value={
            nextAppointment === null ? 'None booked' : formatDateTime(nextAppointment.scheduledAt)
          }
          hint={
            nextAppointment === null
              ? 'Nothing on the calendar'
              : `${nextAppointment.purpose} · ${nextAppointment.clinicName}`
          }
        />
        <SummaryCard
          label="Last visit"
          value={lastVisit === null ? 'No visits yet' : formatDateKey(lastVisit)}
          hint={
            lastVisit === null
              ? 'A completed visit or a clinical note sets this'
              : 'From visits and notes'
          }
        />
        <SummaryCard
          label="Clinical notes"
          value={String(data.records.length)}
          hint={
            data.records.length === 1
              ? '1 note on record'
              : `${data.records.length} notes on record`
          }
        />
      </div>

      <div className="border-border bg-card rounded-xl border">
        <div className="border-border flex items-center justify-between gap-2 border-b p-4">
          <p className="text-overline text-muted-foreground">Latest clinical notes</p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-testid="pet-view-records"
            onClick={onViewRecords}
          >
            View all
          </Button>
        </div>
        {latest.length === 0 ? (
          <p className="text-small text-muted-foreground p-4">No clinical notes yet.</p>
        ) : (
          <ul className="divide-border divide-y">
            {latest.map((record) => (
              <li key={record.id} className="flex items-start justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col">
                  <p className="text-small truncate font-medium">{healthRecordTitle(record)}</p>
                  {record.diagnosis === null ||
                  record.diagnosis === healthRecordTitle(record) ? null : (
                    <p className="text-caption text-muted-foreground truncate">
                      {record.diagnosis}
                    </p>
                  )}
                </div>
                <p className="text-caption text-muted-foreground whitespace-nowrap">
                  {formatDateKey(record.recordedOn)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border-border bg-card flex flex-col gap-1 rounded-xl border p-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-small font-medium">{value}</p>
      <p className="text-caption text-muted-foreground truncate">{hint}</p>
    </div>
  )
}

function RecordsPanel({ records, onAdd }: { records: HealthRecord[]; onAdd: () => void }) {
  return (
    <div className="border-border bg-card rounded-xl border">
      <div className="border-border flex items-center justify-between gap-2 border-b p-4">
        <p className="text-overline text-muted-foreground">Clinical history</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="pet-records-add"
          onClick={onAdd}
        >
          <Plus aria-hidden="true" />
          Add record
        </Button>
      </div>

      {records.length === 0 ? (
        <div className="p-4">
          <EmptyState
            testId="pet-records-empty"
            title="No clinical notes yet"
            description="Notes are permanent once added — they can be read here but never edited or deleted."
            action={
              <Button type="button" data-testid="pet-records-empty-add" onClick={onAdd}>
                <Plus aria-hidden="true" />
                Add record
              </Button>
            }
          />
        </div>
      ) : (
        <ul data-testid="pet-records-list" className="divide-border divide-y">
          {records.map((record) => (
            <li key={record.id} className="flex flex-col gap-1 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="text-small font-medium">{healthRecordTitle(record)}</p>
                <p className="text-caption text-muted-foreground">
                  {formatDateKey(record.recordedOn)}
                  {record.vetName === null ? '' : ` · ${record.vetName}`}
                </p>
              </div>
              {record.diagnosis === null ||
              record.diagnosis === healthRecordTitle(record) ? null : (
                <p className="text-small">
                  <span className="text-muted-foreground">Diagnosis: </span>
                  {record.diagnosis}
                </p>
              )}
              {record.treatment === null ? null : (
                <p className="text-small">
                  <span className="text-muted-foreground">Treatment: </span>
                  {record.treatment}
                </p>
              )}
              {record.prescribedMedication === null ? null : (
                <p className="text-small">
                  <span className="text-muted-foreground">Prescribed: </span>
                  {record.prescribedMedication}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
