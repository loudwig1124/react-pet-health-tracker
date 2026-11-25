import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import type { JournalEditorDraft, JournalEditorErrors } from '@/lib/journal-editor'
import { JOURNAL_KINDS, JOURNAL_KIND_LABELS } from '@/lib/rules/constants'

export interface JournalEditorProps {
  mode: 'create' | 'edit'
  draft: JournalEditorDraft
  pets: readonly { id: string; name: string }[]
  errors: JournalEditorErrors
  formError: string | null
  pending: boolean
  idPrefix: string
  /** Set in edit mode so the delete affordance can carry the entry id. */
  entryId?: string
  onChange: (patch: Partial<JournalEditorDraft>) => void
  onSave: () => void
  onRequestDelete?: () => void
  onCancelEdit?: () => void
}

/**
 * The journal editor's fields, shared by the ≥1280 px third column and the
 * <1280 px Sheet (03 §3). It is fully controlled by the page: the draft lives
 * above this component, so converting between inline and sheet on a live resize
 * remounts the fields without losing a character.
 *
 * R6: kind (and pet) are shown but disabled when editing — the repository
 * refuses those patches too. Time, Notes and Duration are the editable fields.
 */
export function JournalEditor({
  mode,
  draft,
  pets,
  errors,
  formError,
  pending,
  idPrefix,
  entryId,
  onChange,
  onSave,
  onRequestDelete,
  onCancelEdit,
}: JournalEditorProps) {
  const ids = {
    pet: `${idPrefix}-pet`,
    kind: `${idPrefix}-kind`,
    date: `${idPrefix}-date`,
    time: `${idPrefix}-time`,
    duration: `${idPrefix}-duration`,
    notes: `${idPrefix}-notes`,
  }
  const editing = mode === 'edit'
  const hasSelectedPet = pets.some((pet) => pet.id === draft.petId)

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        onSave()
      }}
      noValidate
    >
      <Field data-invalid={errors.petId === undefined ? undefined : 'true'}>
        <FieldLabel htmlFor={ids.pet}>Pet</FieldLabel>
        <NativeSelect
          id={ids.pet}
          className="w-full"
          value={draft.petId}
          disabled={editing}
          aria-invalid={errors.petId === undefined ? undefined : true}
          onChange={(event) => {
            onChange({ petId: event.currentTarget.value })
          }}
        >
          {hasSelectedPet ? null : (
            <NativeSelectOption value={draft.petId}>
              {draft.petId === '' ? 'No pets yet' : 'Unknown pet'}
            </NativeSelectOption>
          )}
          {pets.map((pet) => (
            <NativeSelectOption key={pet.id} value={pet.id}>
              {pet.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {editing ? (
          <FieldDescription>The entry belongs to this pet permanently.</FieldDescription>
        ) : null}
        {errors.petId === undefined ? null : <FieldError>{errors.petId}</FieldError>}
      </Field>

      <Field data-invalid={errors.kind === undefined ? undefined : 'true'}>
        <FieldLabel htmlFor={ids.kind}>Kind</FieldLabel>
        <NativeSelect
          id={ids.kind}
          className="w-full"
          value={draft.kind}
          disabled={editing}
          aria-invalid={errors.kind === undefined ? undefined : true}
          onChange={(event) => {
            onChange({ kind: event.currentTarget.value as JournalEditorDraft['kind'] })
          }}
        >
          {JOURNAL_KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {JOURNAL_KIND_LABELS[kind]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {editing ? (
          <FieldDescription>
            The kind is fixed after logging; only the time, note and duration can change.
          </FieldDescription>
        ) : null}
        {errors.kind === undefined ? null : <FieldError>{errors.kind}</FieldError>}
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field data-invalid={errors.date === undefined ? undefined : 'true'}>
          <FieldLabel htmlFor={ids.date}>Date</FieldLabel>
          <Input
            id={ids.date}
            type="date"
            value={draft.date}
            aria-invalid={errors.date === undefined ? undefined : true}
            onChange={(event) => {
              onChange({ date: event.currentTarget.value })
            }}
          />
          {errors.date === undefined ? null : <FieldError>{errors.date}</FieldError>}
        </Field>

        <Field data-invalid={errors.time === undefined ? undefined : 'true'}>
          <FieldLabel htmlFor={ids.time}>Time</FieldLabel>
          <Input
            id={ids.time}
            type="time"
            value={draft.time}
            aria-invalid={errors.time === undefined ? undefined : true}
            onChange={(event) => {
              onChange({ time: event.currentTarget.value })
            }}
          />
          {errors.time === undefined ? null : <FieldError>{errors.time}</FieldError>}
        </Field>
      </div>

      <Field data-invalid={errors.durationMinutes === undefined ? undefined : 'true'}>
        <FieldLabel htmlFor={ids.duration}>Duration (min)</FieldLabel>
        <Input
          id={ids.duration}
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          placeholder="Optional, e.g. 30"
          value={draft.duration}
          aria-invalid={errors.durationMinutes === undefined ? undefined : true}
          onChange={(event) => {
            onChange({ duration: event.currentTarget.value })
          }}
        />
        {errors.durationMinutes === undefined ? null : (
          <FieldError>{errors.durationMinutes}</FieldError>
        )}
      </Field>

      <Field data-invalid={errors.note === undefined ? undefined : 'true'}>
        <FieldLabel htmlFor={ids.notes}>Notes</FieldLabel>
        <Textarea
          id={ids.notes}
          rows={3}
          placeholder="Anything worth remembering?"
          value={draft.note}
          aria-invalid={errors.note === undefined ? undefined : true}
          onChange={(event) => {
            onChange({ note: event.currentTarget.value })
          }}
        />
        {errors.note === undefined ? null : <FieldError>{errors.note}</FieldError>}
      </Field>

      {formError === null ? null : (
        <p role="alert" className="text-small text-destructive">
          {formError}
        </p>
      )}

      {pets.length === 0 ? (
        <p className="text-small text-muted-foreground">Add a pet before logging an entry.</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={pending || pets.length === 0} data-testid="journal-save">
          {pending ? 'Saving…' : editing ? 'Save changes' : 'Save entry'}
        </Button>
        {editing && onCancelEdit !== undefined ? (
          <Button type="button" variant="ghost" onClick={onCancelEdit} disabled={pending}>
            Cancel
          </Button>
        ) : null}
        {editing && onRequestDelete !== undefined ? (
          <Button
            type="button"
            variant="destructive"
            className="ml-auto"
            data-testid={`journal-delete-${entryId ?? 'entry'}`}
            onClick={onRequestDelete}
            disabled={pending}
          >
            Delete
          </Button>
        ) : null}
      </div>
    </form>
  )
}
