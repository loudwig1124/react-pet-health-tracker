/**
 * Add / edit pet dialog (02 §1, R9).
 *
 * The form is presentational: it owns the draft and runs the shared
 * `validatePetDraft` rule, then hands a valid draft to `onSubmit` (the route's
 * repository call). A repository failure — the duplicate-microchip race, a
 * failed transaction — is caught here and shown as a form-level alert without
 * losing what the owner typed. Cancel discards because the parent unmounts the
 * dialog; a successful save also unmounts it, and the Dexie live query behind
 * the table/detail refreshes every mounted surface (R10).
 */
import { useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { PET_SEXES, PET_SEX_LABELS, SPECIES_OPTIONS } from '@/lib/rules/constants'
import { validatePetDraft, type PetFieldErrors } from '@/lib/rules/pet-validation'
import type { DateKey, Pet, PetDraft, PetSex } from '@/lib/rules/types'

interface FormState {
  name: string
  species: string
  breed: string
  sex: PetSex
  dateOfBirth: string
  weight: string
  microchip: string
}

const FIELD_IDS: Record<string, string> = {
  name: 'pet-name',
  species: 'pet-species',
  breed: 'pet-breed',
  sex: 'pet-sex',
  dateOfBirth: 'pet-dob',
  weightKg: 'pet-weight',
  microchip: 'pet-microchip',
}

/** The form keeps the weight as text, the rule calls the field `weightKg`. */
const FORM_TO_ERROR_KEY: Record<keyof FormState, keyof PetFieldErrors> = {
  name: 'name',
  species: 'species',
  breed: 'breed',
  sex: 'sex',
  dateOfBirth: 'dateOfBirth',
  weight: 'weightKg',
  microchip: 'microchip',
}

function toFormState(pet: Pet | null): FormState {
  return {
    name: pet?.name ?? '',
    species: pet?.species ?? '',
    breed: pet?.breed ?? '',
    sex: pet?.sex ?? 'unknown',
    dateOfBirth: pet?.dateOfBirth ?? '',
    weight: pet === null ? '' : String(pet.weightKg),
    microchip: pet?.microchip ?? '',
  }
}

function errorArray(message: string | undefined): { message: string }[] | undefined {
  return message === undefined ? undefined : [{ message }]
}

export interface PetFormDialogProps {
  /** The pet being edited, or null/absent for create. */
  pet?: Pet | null
  /** Every other household pet, for the R9 microchip-uniqueness check. */
  existingPets: readonly Pick<Pet, 'id' | 'microchip'>[]
  /** The local day the validation rules run against (R4). */
  today: DateKey
  onClose: () => void
  /** The route's write path: `createPet(draft)` / `updatePet(id, draft)`. */
  onSubmit: (draft: PetDraft) => Promise<void>
}

export function PetFormDialog({
  pet = null,
  existingPets,
  today,
  onClose,
  onSubmit,
}: PetFormDialogProps) {
  const [form, setForm] = useState<FormState>(() => toFormState(pet))
  const [errors, setErrors] = useState<PetFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const editing = pet !== null

  const speciesOptions = useMemo(() => {
    const options: string[] = [...SPECIES_OPTIONS]
    // R9: a legacy species outside the approved list still shows when editing.
    if (form.species !== '' && !options.includes(form.species)) {
      options.unshift(form.species)
    }
    return options
  }, [form.species])

  const update = <K extends keyof FormState>(field: K, value: FormState[K]): void => {
    setForm((previous) => ({ ...previous, [field]: value }))
    const errorKey = FORM_TO_ERROR_KEY[field]
    setErrors((previous) => {
      if (previous[errorKey] === undefined) {
        return previous
      }
      const next = { ...previous }
      delete next[errorKey]
      return next
    })
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setFormError(null)

    const draft: PetDraft = {
      name: form.name,
      species: form.species,
      breed: form.breed.trim() === '' ? null : form.breed,
      sex: form.sex,
      dateOfBirth: form.dateOfBirth,
      weightKg: form.weight.trim() === '' ? Number.NaN : Number(form.weight),
      microchip: form.microchip.trim() === '' ? null : form.microchip,
    }

    const result = validatePetDraft(draft, {
      today,
      existingPets,
      currentPetId: pet?.id ?? null,
    })
    if (!result.isValid || result.value === null) {
      setErrors(result.errors)
      const firstField = (Object.keys(result.errors) as (keyof PetFieldErrors)[])[0]
      const id = firstField === undefined ? undefined : FIELD_IDS[firstField]
      if (id !== undefined) {
        window.requestAnimationFrame(() => {
          document.getElementById(id)?.focus()
        })
      }
      return
    }

    setSaving(true)
    try {
      await onSubmit(result.value)
      onClose()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) {
          onClose()
        }
      }}
    >
      <DialogContent data-testid="pet-form" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${pet?.name ?? 'pet'}` : 'Add a pet'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Update the details below. Changes appear everywhere this pet is shown.'
              : 'A few details keep due dates and weights consistent. No photo needed — every pet gets a paw placeholder.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={errors.name !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.name}>Name</FieldLabel>
              <Input
                id={FIELD_IDS.name}
                value={form.name}
                autoFocus
                autoComplete="off"
                aria-invalid={errors.name !== undefined}
                aria-describedby={errors.name === undefined ? undefined : 'pet-name-error'}
                onChange={(event) => update('name', event.target.value)}
              />
              <FieldError id="pet-name-error" errors={errorArray(errors.name)} />
            </Field>

            <Field data-invalid={errors.species !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.species}>Species</FieldLabel>
              <NativeSelect
                id={FIELD_IDS.species}
                className="w-full"
                value={form.species}
                aria-invalid={errors.species !== undefined}
                aria-describedby={errors.species === undefined ? undefined : 'pet-species-error'}
                onChange={(event) => update('species', event.target.value)}
              >
                <NativeSelectOption value="">Select a species…</NativeSelectOption>
                {speciesOptions.map((species) => (
                  <NativeSelectOption key={species} value={species}>
                    {species}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError id="pet-species-error" errors={errorArray(errors.species)} />
            </Field>

            <Field data-invalid={errors.breed !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.breed}>Breed</FieldLabel>
              <Input
                id={FIELD_IDS.breed}
                value={form.breed}
                placeholder="Optional — e.g. Golden Retriever mix"
                aria-invalid={errors.breed !== undefined}
                aria-describedby={errors.breed === undefined ? undefined : 'pet-breed-error'}
                onChange={(event) => update('breed', event.target.value)}
              />
              <FieldError id="pet-breed-error" errors={errorArray(errors.breed)} />
            </Field>

            <Field data-invalid={errors.sex !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.sex}>Sex</FieldLabel>
              <NativeSelect
                id={FIELD_IDS.sex}
                className="w-full"
                value={form.sex}
                onChange={(event) => update('sex', event.target.value as PetSex)}
              >
                {PET_SEXES.map((sex) => (
                  <NativeSelectOption key={sex} value={sex}>
                    {PET_SEX_LABELS[sex]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldError id="pet-sex-error" errors={errorArray(errors.sex)} />
            </Field>

            <Field data-invalid={errors.dateOfBirth !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.dateOfBirth}>Date of birth</FieldLabel>
              <Input
                id={FIELD_IDS.dateOfBirth}
                type="date"
                max={today}
                value={form.dateOfBirth}
                aria-invalid={errors.dateOfBirth !== undefined}
                aria-describedby={errors.dateOfBirth === undefined ? undefined : 'pet-dob-error'}
                onChange={(event) => update('dateOfBirth', event.target.value)}
              />
              <FieldError id="pet-dob-error" errors={errorArray(errors.dateOfBirth)} />
            </Field>

            <Field data-invalid={errors.weightKg !== undefined}>
              <FieldLabel htmlFor={FIELD_IDS.weightKg}>Weight (kg)</FieldLabel>
              <Input
                id={FIELD_IDS.weightKg}
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="300"
                placeholder="e.g. 12.4"
                value={form.weight}
                aria-invalid={errors.weightKg !== undefined}
                aria-describedby={errors.weightKg === undefined ? undefined : 'pet-weight-error'}
                onChange={(event) => update('weight', event.target.value)}
              />
              <FieldError id="pet-weight-error" errors={errorArray(errors.weightKg)} />
            </Field>

            <Field data-invalid={errors.microchip !== undefined} className="sm:col-span-2">
              <FieldLabel htmlFor={FIELD_IDS.microchip}>Microchip</FieldLabel>
              <Input
                id={FIELD_IDS.microchip}
                value={form.microchip}
                inputMode="numeric"
                autoComplete="off"
                placeholder="Optional — 9–15 digits"
                aria-invalid={errors.microchip !== undefined}
                aria-describedby={
                  errors.microchip === undefined ? undefined : 'pet-microchip-error'
                }
                onChange={(event) => update('microchip', event.target.value)}
              />
              <FieldError id="pet-microchip-error" errors={errorArray(errors.microchip)} />
            </Field>
          </div>

          {formError === null ? null : (
            <p role="alert" data-testid="pet-form-error" className="text-destructive text-small">
              Could not save the pet: {formError}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} data-testid="pet-form-cancel">
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="pet-form-submit">
              {saving ? 'Saving…' : editing ? 'Save pet' : 'Add pet'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
