/**
 * Record or correct a clinical note (R5, amended 2026-11-27).
 *
 * Notes were append-only, which made a misclicked diagnosis permanent. The owner
 * accepted corrections, so the same dialog now handles both: `initial` is null
 * for a new note, or the stored note for an edit, and an edit can delete the row
 * after a second confirming click.
 *
 * Presentational like the pet form: it validates through the shared
 * `validateHealthRecordDraft` rule and hands a valid draft to the route's
 * repository call; a failed write stays in the dialog with its values intact.
 */
import { useState, type FormEvent } from 'react'

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
import { Textarea } from '@/components/ui/textarea'
import {
  normalizeOptionalText,
  validateHealthRecordDraft,
  type HealthRecordFieldErrors,
} from '@/lib/rules/health-records'
import type { DateKey, HealthRecord, HealthRecordDraft, Pet } from '@/lib/rules/types'

function errorArray(message: string | undefined): { message: string }[] | undefined {
  return message === undefined ? undefined : [{ message }]
}

export interface HealthRecordDialogProps {
  /** Pets the note can be attached to; empty only when the household is empty. */
  pets: readonly Pet[]
  /** Preselected pet (e.g. the pet filter, or the pet whose detail page we are on). */
  defaultPetId?: string | null
  /** On a pet's own page the pet is fixed and shown as text instead of a select. */
  lockedPet?: Pet | null
  today: DateKey
  /** The note being corrected; absent for a new one. */
  initial?: HealthRecord | null
  onClose: () => void
  onSubmit: (draft: HealthRecordDraft) => Promise<void>
  /** Confirmed delete of the edited note. */
  onDelete?: () => Promise<void>
}

export function HealthRecordDialog({
  pets,
  defaultPetId = null,
  lockedPet = null,
  today,
  initial = null,
  onClose,
  onSubmit,
  onDelete,
}: HealthRecordDialogProps) {
  const editing = initial !== null
  const [petId, setPetId] = useState<string>(
    () => initial?.petId ?? lockedPet?.id ?? defaultPetId ?? pets[0]?.id ?? '',
  )
  const [recordedOn, setRecordedOn] = useState(initial?.recordedOn ?? today)
  const [condition, setCondition] = useState(initial?.condition ?? '')
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? '')
  const [treatment, setTreatment] = useState(initial?.treatment ?? '')
  const [prescribedMedication, setPrescribedMedication] = useState(
    initial?.prescribedMedication ?? '',
  )
  const [vetName, setVetName] = useState(initial?.vetName ?? '')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [errors, setErrors] = useState<HealthRecordFieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    setFormError(null)

    const draft: HealthRecordDraft = {
      petId: lockedPet?.id ?? petId,
      recordedOn,
      condition: normalizeOptionalText(condition),
      diagnosis: normalizeOptionalText(diagnosis),
      treatment: normalizeOptionalText(treatment),
      prescribedMedication: normalizeOptionalText(prescribedMedication),
      vetName: normalizeOptionalText(vetName),
    }

    const result = validateHealthRecordDraft(draft)
    if (!result.isValid || result.value === null) {
      setErrors(result.errors)
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
      <DialogContent data-testid="record-form" className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit clinical note' : 'Add a clinical note'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Correct the note. Saving replaces the stored row; there is no audit trail.'
              : 'One note per visit. It can be corrected or deleted later from the records table.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {lockedPet === null ? (
              <Field data-invalid={errors.petId !== undefined}>
                <FieldLabel htmlFor="record-pet">Pet</FieldLabel>
                <NativeSelect
                  id="record-pet"
                  className="w-full"
                  value={petId}
                  aria-invalid={errors.petId !== undefined}
                  onChange={(event) => setPetId(event.target.value)}
                >
                  <NativeSelectOption value="">Select a pet…</NativeSelectOption>
                  {pets.map((pet) => (
                    <NativeSelectOption key={pet.id} value={pet.id}>
                      {pet.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldError errors={errorArray(errors.petId)} />
              </Field>
            ) : (
              <Field>
                <FieldLabel>Pet</FieldLabel>
                <p className="text-small flex h-8 items-center font-medium">{lockedPet.name}</p>
              </Field>
            )}

            <Field data-invalid={errors.recordedOn !== undefined}>
              <FieldLabel htmlFor="record-date">Date of visit</FieldLabel>
              <Input
                id="record-date"
                type="date"
                max={today}
                value={recordedOn}
                aria-invalid={errors.recordedOn !== undefined}
                onChange={(event) => setRecordedOn(event.target.value)}
              />
              <FieldError errors={errorArray(errors.recordedOn)} />
            </Field>

            <Field data-invalid={errors.condition !== undefined} className="sm:col-span-2">
              <FieldLabel htmlFor="record-condition">Condition</FieldLabel>
              <Input
                id="record-condition"
                value={condition}
                placeholder="What was observed — e.g. Ear infection"
                aria-invalid={errors.condition !== undefined}
                onChange={(event) => setCondition(event.target.value)}
              />
              <FieldError errors={errorArray(errors.condition)} />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="record-diagnosis">Diagnosis</FieldLabel>
              <Input
                id="record-diagnosis"
                value={diagnosis}
                placeholder="Optional — the vet's diagnosis"
                onChange={(event) => setDiagnosis(event.target.value)}
              />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="record-treatment">Treatment</FieldLabel>
              <Textarea
                id="record-treatment"
                value={treatment}
                placeholder="Optional — what was done"
                onChange={(event) => setTreatment(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="record-medication">Prescribed medication</FieldLabel>
              <Input
                id="record-medication"
                value={prescribedMedication}
                placeholder="Optional"
                onChange={(event) => setPrescribedMedication(event.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="record-vet">Vet</FieldLabel>
              <Input
                id="record-vet"
                value={vetName}
                placeholder="Optional"
                onChange={(event) => setVetName(event.target.value)}
              />
            </Field>
          </div>

          {formError === null ? null : (
            <p role="alert" data-testid="record-form-error" className="text-destructive text-small">
              Could not {editing ? 'save' : 'add'} the note: {formError}
            </p>
          )}

          <DialogFooter>
            {editing && onDelete !== undefined ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive sm:mr-auto"
                data-testid="record-delete"
                disabled={saving || deleting}
                onClick={() => {
                  if (!confirmingDelete) {
                    setConfirmingDelete(true)
                    return
                  }
                  setDeleting(true)
                  void onDelete()
                    .then(() => {
                      onClose()
                    })
                    .catch((error: unknown) => {
                      setFormError(error instanceof Error ? error.message : String(error))
                      setDeleting(false)
                    })
                }}
              >
                {confirmingDelete ? 'Delete permanently?' : 'Delete note'}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              data-testid="record-form-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving} data-testid="record-submit">
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add record'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
