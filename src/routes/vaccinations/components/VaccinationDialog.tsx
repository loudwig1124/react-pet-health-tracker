/**
 * "Add vaccination" dialog (02 §1 VaccinationDialog, R1).
 *
 * The vaccine must come from the catalog, so `vaccineTypeId` is the ranking key
 * and `vaccineName` is only the display snapshot. Choosing a vaccine prefills
 * "Next due" from its interval (month-end clamped by `addMonths`) until the user
 * edits that field; the rule still rejects a next-due date that is not strictly
 * after the dose date, and the repository re-runs the same rule on write.
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
import {
  appendVaccination,
  deleteVaccination,
  updateVaccination,
} from '@/lib/db/repositories/vaccinations'
import { isDateKey } from '@/lib/rules/calendar'
import type { Pet, Vaccination, VaccineType } from '@/lib/rules/types'
import { isValidNextDueDate, nextDueFromInterval } from '@/lib/rules/vaccination-due'
import { errorMessage } from '@/lib/schedule/live'

export interface VaccinationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pets: readonly Pet[]
  vaccineTypes: readonly VaccineType[]
  /** The pet preselected by the toolbar, a row action or a pet filter. */
  defaultPetId: string | null
  /** The local "today" from the page, so defaults are deterministic in tests. */
  today: string
  /** The dose being corrected; absent for "Add vaccination". */
  initial?: Vaccination | null
  onSaved: (dose: Vaccination) => void
  /** Called after the owner confirms Delete; the page announces it. */
  onDeleted?: (dose: Vaccination) => void
}

interface FormState {
  petId: string
  vaccineId: string
  vaccinationDate: string
  nextDueDate: string
  vetName: string
}

interface FormErrors {
  petId?: string
  vaccineId?: string
  vaccinationDate?: string
  nextDueDate?: string
  submit?: string
}

function initialState(
  pets: readonly Pet[],
  vaccineTypes: readonly VaccineType[],
  defaultPetId: string | null,
  today: string,
  initial: Vaccination | null,
): FormState {
  if (initial !== null) {
    return {
      petId: initial.petId,
      vaccineId: initial.vaccineTypeId ?? vaccineTypes[0]?.id ?? '',
      vaccinationDate: initial.vaccinationDate,
      nextDueDate: initial.nextDueDate ?? '',
      vetName: initial.vetName ?? '',
    }
  }
  const petId =
    defaultPetId !== null && pets.some((pet) => pet.id === defaultPetId)
      ? defaultPetId
      : (pets[0]?.id ?? '')
  const vaccineId = vaccineTypes[0]?.id ?? ''
  const interval = vaccineTypes.find((type) => type.id === vaccineId)?.intervalMonths ?? null
  return {
    petId,
    vaccineId,
    vaccinationDate: today,
    nextDueDate: nextDueFromInterval(today, interval) ?? '',
    vetName: '',
  }
}

export function VaccinationDialog({
  open,
  onOpenChange,
  pets,
  vaccineTypes,
  defaultPetId,
  today,
  initial = null,
  onSaved,
  onDeleted,
}: VaccinationDialogProps) {
  const editing = initial !== null
  const [form, setForm] = useState<FormState>(() =>
    initialState(pets, vaccineTypes, defaultPetId, today, initial),
  )
  // False in edit mode too: correcting the dose date must re-derive the next
  // due date, or the stale date sits before the new one and the edit is
  // rejected by the same rule that guards creation.
  const [nextDueTouched, setNextDueTouched] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)

  const selectedVaccine = useMemo(
    () => vaccineTypes.find((type) => type.id === form.vaccineId) ?? null,
    [vaccineTypes, form.vaccineId],
  )

  function update(patch: Partial<FormState>): void {
    setForm((current) => {
      const next = { ...current, ...patch }
      if (
        (patch.vaccineId !== undefined || patch.vaccinationDate !== undefined) &&
        !nextDueTouched
      ) {
        const interval =
          vaccineTypes.find((type) => type.id === next.vaccineId)?.intervalMonths ?? null
        next.nextDueDate =
          isDateKey(next.vaccinationDate) && interval !== null
            ? (nextDueFromInterval(next.vaccinationDate, interval) ?? '')
            : ''
      }
      return next
    })
  }

  function validate(current: FormState): FormErrors {
    const next: FormErrors = {}
    if (current.petId === '' || !pets.some((pet) => pet.id === current.petId)) {
      next.petId = 'Choose a pet.'
    }
    if (current.vaccineId === '' || selectedVaccine === null) {
      next.vaccineId = 'Choose a vaccine from the catalog.'
    }
    if (!isDateKey(current.vaccinationDate)) {
      next.vaccinationDate = 'Choose the date the dose was given.'
    }
    if (
      isDateKey(current.vaccinationDate) &&
      current.nextDueDate !== '' &&
      !isValidNextDueDate(current.vaccinationDate, current.nextDueDate)
    ) {
      next.nextDueDate = 'Next due must be after the date the dose was given.'
    }
    return next
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0 || selectedVaccine === null) {
      return
    }
    setPending(true)
    try {
      const draft = {
        petId: form.petId,
        vaccineTypeId: selectedVaccine.id,
        vaccineName: selectedVaccine.name,
        vaccinationDate: form.vaccinationDate,
        nextDueDate: form.nextDueDate === '' ? null : form.nextDueDate,
        vetName: form.vetName.trim() === '' ? null : form.vetName.trim(),
      }
      const dose =
        initial === null
          ? await appendVaccination(draft)
          : await updateVaccination(initial.id, draft)
      onSaved(dose)
      onOpenChange(false)
    } catch (error) {
      setErrors({ submit: errorMessage(error) })
    } finally {
      setPending(false)
    }
  }

  const noPets = pets.length === 0
  const noVaccines = vaccineTypes.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit vaccination' : 'Add vaccination'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Correct the dose. The newest dose of each vaccine decides the pet’s status.'
              : 'Record a dose for one pet. The newest dose of each vaccine decides the pet’s status.'}
          </DialogDescription>
        </DialogHeader>

        {noPets || noVaccines ? (
          <p role="alert" className="text-small text-destructive">
            {noPets
              ? 'Add a pet before recording a vaccination.'
              : 'The vaccine catalog is empty, so a dose cannot be saved yet.'}
          </p>
        ) : (
          <form data-testid="vaccination-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex flex-col gap-4">
              <Field data-invalid={errors.petId !== undefined}>
                <FieldLabel htmlFor="vaccination-pet">Pet</FieldLabel>
                <NativeSelect
                  id="vaccination-pet"
                  data-testid="vaccination-pet"
                  value={form.petId}
                  onChange={(event) => update({ petId: event.target.value })}
                >
                  {pets.map((pet) => (
                    <NativeSelectOption key={pet.id} value={pet.id}>
                      {pet.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.petId === undefined ? null : <FieldError>{errors.petId}</FieldError>}
              </Field>

              <Field data-invalid={errors.vaccineId !== undefined}>
                <FieldLabel htmlFor="vaccination-vaccine">Vaccine</FieldLabel>
                <NativeSelect
                  id="vaccination-vaccine"
                  data-testid="vaccination-vaccine"
                  value={form.vaccineId}
                  onChange={(event) => update({ vaccineId: event.target.value })}
                >
                  {vaccineTypes.map((type) => (
                    <NativeSelectOption key={type.id} value={type.id}>
                      {type.name}
                      {type.isCore ? ' (core)' : ''}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                {errors.vaccineId === undefined ? null : (
                  <FieldError>{errors.vaccineId}</FieldError>
                )}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.vaccinationDate !== undefined}>
                  <FieldLabel htmlFor="vaccination-date">Given on</FieldLabel>
                  <Input
                    id="vaccination-date"
                    data-testid="vaccination-date"
                    type="date"
                    value={form.vaccinationDate}
                    onChange={(event) => update({ vaccinationDate: event.target.value })}
                  />
                  {errors.vaccinationDate === undefined ? null : (
                    <FieldError>{errors.vaccinationDate}</FieldError>
                  )}
                </Field>

                <Field data-invalid={errors.nextDueDate !== undefined}>
                  <FieldLabel htmlFor="vaccination-next-due">Next due</FieldLabel>
                  <Input
                    id="vaccination-next-due"
                    data-testid="vaccination-next-due"
                    type="date"
                    value={form.nextDueDate}
                    onChange={(event) => {
                      setNextDueTouched(true)
                      update({ nextDueDate: event.target.value })
                    }}
                  />
                  {errors.nextDueDate === undefined ? null : (
                    <FieldError>{errors.nextDueDate}</FieldError>
                  )}
                </Field>
              </div>

              <Field>
                <FieldLabel htmlFor="vaccination-vet">
                  Vet <span className="text-muted-foreground font-normal">(optional)</span>
                </FieldLabel>
                <Input
                  id="vaccination-vet"
                  data-testid="vaccination-vet"
                  value={form.vetName}
                  maxLength={120}
                  onChange={(event) => update({ vetName: event.target.value })}
                />
              </Field>

              {errors.submit === undefined ? null : <FieldError>{errors.submit}</FieldError>}
            </div>

            <DialogFooter className="mt-6">
              {editing ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive sm:mr-auto"
                  data-testid="vaccination-delete"
                  disabled={pending || deleting}
                  onClick={() => {
                    if (!confirmingDelete) {
                      setConfirmingDelete(true)
                      return
                    }
                    setDeleting(true)
                    void deleteVaccination(initial.id)
                      .then(() => {
                        onDeleted?.(initial)
                        onOpenChange(false)
                      })
                      .catch((error: unknown) => {
                        setErrors({ submit: errorMessage(error) })
                        setDeleting(false)
                      })
                  }}
                >
                  {confirmingDelete ? 'Delete permanently?' : 'Delete dose'}
                </Button>
              ) : null}
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} data-testid="vaccination-submit">
                {pending ? 'Saving…' : editing ? 'Save changes' : 'Add dose'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
