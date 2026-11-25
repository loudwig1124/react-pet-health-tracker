import { Check, PawPrint } from 'lucide-react'
import { useState } from 'react'

import { clearFirstRunRequest, type FirstRunSnapshot } from '@/app/first-run-state'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DotPattern } from '@/components/ui/magicui/dot-pattern'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { seedDemoHousehold } from '@/lib/db/seed/demo'
import { saveSettings } from '@/lib/db/settings'
import { addYears, todayKey } from '@/lib/rules/calendar'
import { DEFAULT_OWNER_NAME, SPECIES_OPTIONS } from '@/lib/rules/constants'
import { validatePetDraft } from '@/lib/rules/pet-validation'
import type { OwnerDraft } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

export interface FirstRunTakeoverProps {
  snapshot: FirstRunSnapshot
  /** The shell hides behind the takeover; completing navigates to `/`. */
  onComplete: () => void
}

interface FirstRunErrors {
  ownerName?: string
  petName?: string
  species?: string
  weight?: string
  dateOfBirth?: string
  form?: string
}

function initialOwnerName(ownerName: string): string {
  return ownerName === DEFAULT_OWNER_NAME ? '' : ownerName
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'
}

/**
 * First-run takeover — a mode of `/`, not a route (03 §5): the sidebar and
 * header are hidden while the household is empty and unnamed.
 *
 * One card collects the household name and the first pet (name, species,
 * weight, DOB), then either creates the household or seeds the sample one.
 * Completion clears the session reset flag and returns to the normal shell.
 *
 * The owner fields start from the live row passed by the shell; after "forget
 * my details" they are empty rather than the old name.
 */
export default function FirstRunTakeover({ snapshot, onComplete }: FirstRunTakeoverProps) {
  const [ownerName, setOwnerName] = useState(() => initialOwnerName(snapshot.ownerName))
  const [petName, setPetName] = useState('')
  const [species, setSpecies] = useState<string>(SPECIES_OPTIONS[0])
  const [weight, setWeight] = useState('5')
  const [dateOfBirth, setDateOfBirth] = useState(() => addYears(todayKey(new Date()), -1))
  const [errors, setErrors] = useState<FirstRunErrors>({})
  const [pending, setPending] = useState<'create' | 'sample' | null>(null)

  const baseOwner = (name: string): OwnerDraft => ({
    name: name.trim(),
    // Profile contacts survive this form (02 §1: "saves owner, keeps existing
    // email/phone"); the first-run fields never overwrite them.
    email: snapshot.ownerEmail,
    phone: snapshot.ownerPhone,
  })

  async function createHousehold(): Promise<void> {
    const nextErrors: FirstRunErrors = {}
    const trimmedOwner = ownerName.trim()
    if (trimmedOwner === '') {
      nextErrors.ownerName = 'Enter your name'
    }
    if (petName.trim() === '') {
      nextErrors.petName = 'Enter your pet’s name'
    }
    const weightKg = Number(weight)
    if (weight.trim() === '' || !Number.isFinite(weightKg)) {
      nextErrors.weight = 'Enter a weight in kilograms'
    }

    const validation = validatePetDraft(
      {
        name: petName,
        species,
        breed: null,
        sex: 'unknown',
        dateOfBirth,
        weightKg: Number.isFinite(weightKg) ? weightKg : 0,
        microchip: null,
      },
      { today: todayKey(new Date()) },
    )
    if (!validation.isValid) {
      if (validation.errors.name !== undefined) {
        nextErrors.petName = validation.errors.name
      }
      if (validation.errors.species !== undefined) {
        nextErrors.species = validation.errors.species
      }
      if (validation.errors.dateOfBirth !== undefined) {
        nextErrors.dateOfBirth = validation.errors.dateOfBirth
      }
      if (validation.errors.weightKg !== undefined) {
        nextErrors.weight = validation.errors.weightKg
      }
    }

    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0 || validation.value === null) {
      return
    }

    setPending('create')
    const previousOwner: OwnerDraft = {
      name: snapshot.ownerName,
      email: snapshot.ownerEmail,
      phone: snapshot.ownerPhone,
    }
    let ownerSaved = false
    try {
      await saveOwner(baseOwner(trimmedOwner))
      ownerSaved = true
      await createPet(validation.value)
      clearFirstRunRequest()
      showToast({ title: 'Household created', description: 'Welcome to Pet Health Tracker.' })
      onComplete()
    } catch (cause) {
      // Do not leave a half-created household: the gate hides as soon as the
      // owner is named, so roll the name back if the pet write failed.
      if (ownerSaved) {
        await saveOwner(previousOwner).catch(() => undefined)
      }
      setErrors({ form: messageOf(cause) })
      setPending(null)
    }
  }

  async function startSampleHousehold(): Promise<void> {
    const trimmedOwner = ownerName.trim()
    if (trimmedOwner !== '') {
      setErrors({})
    }
    setPending('sample')
    const previousOwner: OwnerDraft = {
      name: snapshot.ownerName,
      email: snapshot.ownerEmail,
      phone: snapshot.ownerPhone,
    }
    try {
      if (trimmedOwner !== '') {
        await saveOwner(baseOwner(trimmedOwner))
      }
      saveSettings({ sampleDataEnabled: true })
      await seedDemoHousehold()
      clearFirstRunRequest()
      showToast({
        title: 'Sample household loaded',
        description: 'Bella and Miso are ready to explore — turn it off in Profile.',
      })
      onComplete()
    } catch (cause) {
      await saveOwner(previousOwner).catch(() => undefined)
      setErrors({ form: messageOf(cause) })
      setPending(null)
    }
  }

  return (
    <main
      data-testid="first-run"
      className="bg-background grid min-h-svh w-full place-items-center px-6 py-10"
    >
      <div className="border-border bg-card grid w-full max-w-5xl overflow-hidden rounded-2xl border shadow-sm lg:grid-cols-[minmax(0,1fr)_460px]">
        <aside className="bg-secondary relative hidden overflow-hidden p-8 lg:flex lg:flex-col lg:gap-6 lg:p-10">
          <DotPattern className="text-primary/10" width={18} height={18} cx={1} cy={1} cr={1} />
          <div className="relative flex items-center gap-2.5">
            <span className="bg-accent-soft text-primary flex size-9 items-center justify-center rounded-lg">
              <PawPrint aria-hidden="true" className="size-4.5" strokeWidth={2.25} />
            </span>
            <span className="text-small font-semibold tracking-tight">Pet Health Tracker</span>
          </div>

          <div className="relative flex flex-col gap-3">
            <h1 className="text-display max-w-sm">
              A calmer way to keep track of every pet’s health.
            </h1>
            <p className="text-small text-muted-foreground max-w-sm">
              One shared notebook for the whole household: vaccinations that never quietly go
              overdue, visits, clinical notes and the everyday little things.
            </p>
          </div>

          <ul className="relative flex flex-col gap-2.5">
            {[
              'The newest dose decides what is overdue',
              'Today means your local calendar day',
              'Everything stays on this computer — no account, no server',
            ].map((item) => (
              <li key={item} className="text-small flex items-start gap-2">
                <Check aria-hidden="true" className="text-primary mt-0.5 size-4 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <p className="text-caption text-muted-foreground relative mt-auto">
            Made for a laptop, not a login.
          </p>
        </aside>

        <div className="flex flex-col gap-5 p-6 lg:p-8">
          <div className="flex flex-col gap-1">
            <p className="text-overline text-muted-foreground">First run</p>
            <h2 className="text-title">Let’s set up your household</h2>
            <p className="text-small text-muted-foreground">
              Your name and your first pet. You can change either later in Profile.
            </p>
          </div>

          <form
            className="flex flex-col gap-4"
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void createHousehold()
            }}
          >
            <Field data-invalid={errors.ownerName === undefined ? undefined : 'true'}>
              <FieldLabel htmlFor="first-run-name">Your name</FieldLabel>
              <Input
                id="first-run-name"
                data-testid="first-run-name"
                autoComplete="name"
                value={ownerName}
                aria-invalid={errors.ownerName === undefined ? undefined : true}
                onChange={(event) => {
                  setOwnerName(event.currentTarget.value)
                }}
              />
              {errors.ownerName === undefined ? null : <FieldError>{errors.ownerName}</FieldError>}
            </Field>

            <div className="border-border border-t" />

            <Field data-invalid={errors.petName === undefined ? undefined : 'true'}>
              <FieldLabel htmlFor="first-run-pet-name">Pet name</FieldLabel>
              <Input
                id="first-run-pet-name"
                data-testid="first-run-pet-name"
                placeholder="e.g. Bella"
                value={petName}
                aria-invalid={errors.petName === undefined ? undefined : true}
                onChange={(event) => {
                  setPetName(event.currentTarget.value)
                }}
              />
              {errors.petName === undefined ? null : <FieldError>{errors.petName}</FieldError>}
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={errors.species === undefined ? undefined : 'true'}>
                <FieldLabel htmlFor="first-run-species">Species</FieldLabel>
                <NativeSelect
                  id="first-run-species"
                  data-testid="first-run-species"
                  className="w-full"
                  value={species}
                  aria-invalid={errors.species === undefined ? undefined : true}
                  onChange={(event) => {
                    setSpecies(event.currentTarget.value)
                  }}
                >
                  {SPECIES_OPTIONS.map((option) => (
                    <NativeSelectOption key={option} value={option}>
                      {option}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.species === undefined ? null : <FieldError>{errors.species}</FieldError>}
              </Field>

              <Field data-invalid={errors.weight === undefined ? undefined : 'true'}>
                <FieldLabel htmlFor="first-run-weight">Weight (kg)</FieldLabel>
                <Input
                  id="first-run-weight"
                  data-testid="first-run-weight"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.1"
                  value={weight}
                  aria-invalid={errors.weight === undefined ? undefined : true}
                  onChange={(event) => {
                    setWeight(event.currentTarget.value)
                  }}
                />
                {errors.weight === undefined ? null : <FieldError>{errors.weight}</FieldError>}
              </Field>
            </div>

            <Field data-invalid={errors.dateOfBirth === undefined ? undefined : 'true'}>
              <FieldLabel htmlFor="first-run-dob">Date of birth</FieldLabel>
              <Input
                id="first-run-dob"
                data-testid="first-run-dob"
                type="date"
                value={dateOfBirth}
                aria-invalid={errors.dateOfBirth === undefined ? undefined : true}
                onChange={(event) => {
                  setDateOfBirth(event.currentTarget.value)
                }}
              />
              <FieldDescription>Not future-dated, and not more than 40 years ago.</FieldDescription>
              {errors.dateOfBirth === undefined ? null : (
                <FieldError>{errors.dateOfBirth}</FieldError>
              )}
            </Field>

            {errors.form === undefined ? null : (
              <p role="alert" className="text-small text-destructive">
                {errors.form}
              </p>
            )}

            <div className="flex flex-col gap-2 pt-1">
              <Button
                type="submit"
                size="lg"
                disabled={pending !== null}
                data-testid="first-run-create"
              >
                {pending === 'create' ? 'Creating…' : 'Create my household'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                disabled={pending !== null}
                data-testid="first-run-sample"
                onClick={() => {
                  void startSampleHousehold()
                }}
              >
                {pending === 'sample' ? 'Loading sample…' : 'Or start with the sample household'}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </main>
  )
}
