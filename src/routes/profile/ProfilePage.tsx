import { useLiveQuery } from 'dexie-react-hooks'
import { Mail, PawPrint, Phone } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'

import { requestFirstRun } from '@/app/first-run-state'
import { EmptyState } from '@/components/app/EmptyState'
import { OwnerFormDialog } from '@/components/app/OwnerFormDialog'
import { ResetHouseholdDialog } from '@/components/app/ResetHouseholdDialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { listHealthRecordsForPet } from '@/lib/db/repositories/health-records'
import { resetHousehold } from '@/lib/db/repositories/household'
import { saveOwner } from '@/lib/db/repositories/owners'
import { listPets } from '@/lib/db/repositories/pets'
import { clearDemoHousehold, seedDemoHousehold } from '@/lib/db/seed/demo'
import { saveSettings } from '@/lib/db/settings'
import { saveDensity, type Density } from '@/lib/density'
import { formatCount } from '@/lib/format'
import { useDensity } from '@/lib/hooks/useDensity'
import { useNow } from '@/lib/hooks/useNow'
import { useOwner } from '@/lib/hooks/useOwner'
import { useSettings } from '@/lib/hooks/useSettings'
import { ageInYears, todayKey } from '@/lib/rules/calendar'
import { DEFAULT_OWNER_NAME, WEIGHT_UNIT_LABELS } from '@/lib/rules/constants'
import { DUE_SOON_WINDOW_OPTIONS, formatWeight } from '@/lib/rules/settings'
import type { OwnerDraft, WeightUnit } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

/** Kept in step with package.json; shown in the Profile › About line. */
const APP_VERSION = '0.1.0'

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'
}

function initials(name: string): string {
  const first = name.trim().charAt(0)
  return first === '' ? 'P' : first.toUpperCase()
}

/**
 * `/profile` — the sidebar footer's destination (03 §2, superseding
 * `/settings`): owner block with edit dialog, pets summary → `/pets`, the
 * preference rows (due-soon window, weight unit, density, sample data), the
 * reset with the forget-details checkbox, and a version line with live counts.
 *
 * The owner row is always read live; the edit dialog saves the whole draft so a
 * name-only change keeps the stored email and phone.
 */
export function ProfilePage() {
  const owner = useOwner()
  const settings = useSettings()
  const density = useDensity()

  const household = useLiveQuery(async () => {
    const pets = await listPets()
    const recordLists = await Promise.all(pets.map((pet) => listHealthRecordsForPet(pet.id)))
    return { pets, recordCount: recordLists.reduce((sum, list) => sum + list.length, 0) }
  }, [])

  const [ownerDialogOpen, setOwnerDialogOpen] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [samplePending, setSamplePending] = useState(false)

  const now = useNow(60_000)
  const today = todayKey(now)

  if (owner === undefined || household === undefined) {
    return (
      <div data-testid="profile-page" className="flex flex-col gap-4">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    )
  }

  const pets = household.pets

  async function saveOwnerDraft(draft: OwnerDraft): Promise<void> {
    await saveOwner(draft)
    showToast({ title: 'Profile updated' })
  }

  async function toggleSampleData(next: boolean): Promise<void> {
    setSamplePending(true)
    try {
      saveSettings({ sampleDataEnabled: next })
      if (next) {
        await seedDemoHousehold()
        showToast({
          title: 'Sample data on',
          description: 'Bella and Miso join the household; your own rows are untouched.',
        })
      } else {
        await clearDemoHousehold()
        showToast({
          title: 'Sample data off',
          description: 'The demo rows were removed; everything you typed stays.',
        })
      }
    } catch (cause) {
      saveSettings({ sampleDataEnabled: !next })
      showToast({ title: 'Could not change the sample data', description: errorMessage(cause) })
    } finally {
      setSamplePending(false)
    }
  }

  return (
    <div data-testid="profile-page" className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card data-testid="profile-owner">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Household</CardTitle>
            <p className="text-small text-muted-foreground">
              The one profile this household notebook greets.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setOwnerDialogOpen(true)
            }}
            data-testid="profile-owner-edit"
          >
            Edit
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-12">
              <AvatarFallback className="bg-accent-soft text-primary text-body font-semibold">
                {initials(owner.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col">
              <p className="text-heading truncate" data-testid="profile-owner-name">
                {owner.name === DEFAULT_OWNER_NAME ? 'My household' : owner.name}
              </p>
              <p className="text-caption text-muted-foreground">
                {owner.name === DEFAULT_OWNER_NAME
                  ? 'No name yet — edit to say who you are.'
                  : 'Owner of the household'}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <ContactLine
              icon={<Mail aria-hidden="true" className="size-3.5" />}
              value={owner.email}
              emptyLabel="Add an email"
              onAdd={() => {
                setOwnerDialogOpen(true)
              }}
              testId="profile-owner-email"
            />
            <ContactLine
              icon={<Phone aria-hidden="true" className="size-3.5" />}
              value={owner.phone}
              emptyLabel="Add a phone number"
              onAdd={() => {
                setOwnerDialogOpen(true)
              }}
              testId="profile-owner-phone"
            />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="profile-pets">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <CardTitle>Pets · {formatCount(pets.length, 'pet')}</CardTitle>
            <p className="text-small text-muted-foreground">
              Every pet lives on its own page; the full household is one click away.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/pets">Manage pets</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pets.length === 0 ? (
            <EmptyState
              testId="profile-pets-empty"
              icon={<PawPrint aria-hidden="true" />}
              title="No pets yet"
              description="Add the first pet to start tracking its health."
              action={
                <Button asChild size="sm">
                  <Link to="/pets">Add a pet</Link>
                </Button>
              }
            />
          ) : (
            <ul className="divide-border border-border divide-y rounded-lg border">
              {pets.map((pet) => (
                <li key={pet.id}>
                  <Link
                    to={`/pets/${pet.id}`}
                    className="hover:bg-muted/60 flex items-center gap-3 px-3 py-2.5"
                  >
                    <span className="bg-accent-soft text-primary flex size-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold">
                      {initials(pet.name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-small block truncate font-medium">{pet.name}</span>
                      <span className="text-caption text-muted-foreground block truncate">
                        {pet.species} · {ageInYears(pet.dateOfBirth, today)} y ·{' '}
                        {formatWeight(pet.weightKg, settings.weightUnit)}
                      </span>
                    </span>
                    <span className="text-caption text-muted-foreground">Open</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card data-testid="profile-preferences">
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <PreferenceRow
            title="Due-soon window"
            description="How close a vaccine due date must be to count as due soon."
            control={
              <NativeSelect
                aria-label="Due-soon window"
                data-testid="settings-window"
                className="w-[9.5rem]"
                value={String(settings.dueSoonWindowDays)}
                onChange={(event) => {
                  saveSettings({ dueSoonWindowDays: Number(event.currentTarget.value) })
                }}
              >
                {DUE_SOON_WINDOW_OPTIONS.map((option) => (
                  <NativeSelectOption key={option} value={String(option)}>
                    {option} days
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            }
          />

          <PreferenceRow
            title="Weight units"
            description="Weights are stored in kilograms and shown in your chosen unit."
            control={
              <NativeSelect
                aria-label="Weight units"
                data-testid="settings-units"
                className="w-[9.5rem]"
                value={settings.weightUnit}
                onChange={(event) => {
                  saveSettings({ weightUnit: event.currentTarget.value as WeightUnit })
                }}
              >
                {(['kg', 'lb'] as const).map((unit) => (
                  <NativeSelectOption key={unit} value={unit}>
                    {WEIGHT_UNIT_LABELS[unit]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            }
          />

          <PreferenceRow
            title="Density"
            description="Spacing for tables and the journal feed. Type size never changes."
            control={
              <ToggleGroup
                type="single"
                variant="outline"
                size="sm"
                aria-label="Density"
                data-testid="settings-density"
                value={density}
                onValueChange={(value) => {
                  if (value === 'comfortable' || value === 'compact') {
                    saveDensity(value as Density)
                  }
                }}
              >
                <ToggleGroupItem value="comfortable">Comfortable</ToggleGroupItem>
                <ToggleGroupItem value="compact">Compact</ToggleGroupItem>
              </ToggleGroup>
            }
          />
        </CardContent>
      </Card>

      <Card data-testid="profile-data">
        <CardHeader>
          <CardTitle>Data</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <PreferenceRow
            title="Sample data"
            description="The demo household (two pets, visits, notes, entries) beside your own rows. Turning it off removes only the demo rows."
            control={
              <Switch
                id="sample-data"
                aria-label="Sample data"
                data-testid="settings-sample-toggle"
                checked={settings.sampleDataEnabled}
                disabled={samplePending}
                onCheckedChange={(checked) => {
                  void toggleSampleData(checked)
                }}
              />
            }
            htmlFor="sample-data"
          />

          <PreferenceRow
            title="Reset household"
            description="Delete every pet and everything recorded about them in this browser. You will be asked to confirm."
            control={
              <Button
                type="button"
                variant="destructive"
                size="sm"
                data-testid="settings-reset"
                onClick={() => {
                  setResetDialogOpen(true)
                }}
              >
                Reset…
              </Button>
            }
          />
        </CardContent>
      </Card>

      <footer className="flex flex-wrap items-center justify-between gap-2 px-1">
        <p className="text-caption text-muted-foreground" data-testid="profile-version">
          Version {APP_VERSION} · {formatCount(pets.length, 'pet')} ·{' '}
          {formatCount(household.recordCount, 'record')}
        </p>
        <p className="text-caption text-muted-foreground">Stored only in this browser.</p>
      </footer>

      <OwnerFormDialog
        open={ownerDialogOpen}
        owner={owner}
        onOpenChange={setOwnerDialogOpen}
        onSave={saveOwnerDraft}
      />

      <ResetHouseholdDialog
        open={resetDialogOpen}
        onOpenChange={setResetDialogOpen}
        onConfirm={async (forgetOwner) => {
          await resetHousehold({ forgetOwner })
          requestFirstRun()
          showToast({
            title: 'Household reset',
            description: forgetOwner
              ? 'Everything was cleared, including your name and details.'
              : 'Everything was cleared; your name and details were kept.',
          })
        }}
      />
    </div>
  )
}

function ContactLine({
  icon,
  value,
  emptyLabel,
  onAdd,
  testId,
}: {
  icon: ReactNode
  value: string
  emptyLabel: string
  onAdd: () => void
  testId: string
}) {
  return (
    <div className="text-small flex items-center gap-2" data-testid={testId}>
      <span className="text-muted-foreground">{icon}</span>
      {value.trim() === '' ? (
        <button
          type="button"
          className="text-primary text-left underline-offset-4 hover:underline"
          onClick={onAdd}
        >
          {emptyLabel}
        </button>
      ) : (
        <span className="truncate">{value}</span>
      )}
    </div>
  )
}

function PreferenceRow({
  title,
  description,
  control,
  htmlFor,
}: {
  title: string
  description: string
  control: ReactNode
  htmlFor?: string
}) {
  const titleNode =
    htmlFor === undefined ? (
      <p className="text-small font-medium">{title}</p>
    ) : (
      <Label htmlFor={htmlFor} className="text-small font-medium">
        {title}
      </Label>
    )

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex max-w-md min-w-0 flex-col gap-0.5">
        {titleNode}
        <p className="text-caption text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  )
}
