/**
 * "Book visit" dialog (02 §1 AppointmentDialog, R3).
 *
 * Pet, clinic, purpose, date and time; the date range is today → +3 years and
 * the default is tomorrow at 09:30 local. The form builds a **local** instant
 * (R4), so what the household typed is what the rules compare against. The
 * repository re-checks the storage schema, which is where the write can fail.
 */
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'

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
import { createAppointment } from '@/lib/db/repositories/appointments'
import { addDays, addYears, isDateKey } from '@/lib/rules/calendar'
import type { Appointment, Pet } from '@/lib/rules/types'
import { formatDateTime, instantFromLocalDateTime, isValidTimeInput } from '@/lib/schedule/format'
import { errorMessage } from '@/lib/schedule/live'

export interface BookingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pets: readonly Pet[]
  /** Preselected pet (the active pet filter), else the first pet. */
  defaultPetId: string | null
  today: string
  onBooked: (appointment: Appointment) => void
}

interface FormState {
  petId: string
  clinicName: string
  purpose: string
  date: string
  time: string
}

interface FormErrors {
  petId?: string
  clinicName?: string
  purpose?: string
  date?: string
  time?: string
  submit?: string
}

function initialState(pets: readonly Pet[], defaultPetId: string | null, today: string): FormState {
  const petId =
    defaultPetId !== null && pets.some((pet) => pet.id === defaultPetId)
      ? defaultPetId
      : (pets[0]?.id ?? '')
  return {
    petId,
    clinicName: '',
    purpose: '',
    // Booking defaults are tomorrow at 09:30 local (02 §1).
    date: addDays(today, 1),
    time: '09:30',
  }
}

export function BookingDialog({
  open,
  onOpenChange,
  pets,
  defaultPetId,
  today,
  onBooked,
}: BookingDialogProps) {
  const [form, setForm] = useState<FormState>(() => initialState(pets, defaultPetId, today))
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)
  const maxDate = addYears(today, 3)
  const canBook = pets.length > 0

  let preview: string | null = null
  if (isDateKey(form.date) && isValidTimeInput(form.time)) {
    try {
      preview = formatDateTime(instantFromLocalDateTime(form.date, form.time))
    } catch {
      preview = null
    }
  }

  function update(patch: Partial<FormState>): void {
    setForm((current) => ({ ...current, ...patch }))
  }

  function validate(current: FormState): FormErrors {
    const found: FormErrors = {}
    if (!pets.some((pet) => pet.id === current.petId)) {
      found.petId = 'Choose a pet.'
    }
    if (current.clinicName.trim() === '') {
      found.clinicName = 'Add the clinic name.'
    }
    if (current.purpose.trim() === '') {
      found.purpose = 'Say what the visit is for.'
    }
    if (!isDateKey(current.date)) {
      found.date = 'Choose a date.'
    } else if (current.date < today) {
      found.date = 'The visit cannot be in the past.'
    } else if (current.date > maxDate) {
      found.date = 'Choose a date within the next three years.'
    }
    if (!isValidTimeInput(current.time)) {
      found.time = 'Choose a time.'
    }
    return found
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    const found = validate(form)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      return
    }
    setPending(true)
    try {
      const appointment = await createAppointment({
        petId: form.petId,
        clinicName: form.clinicName.trim(),
        purpose: form.purpose.trim(),
        scheduledAt: instantFromLocalDateTime(form.date, form.time),
      })
      onBooked(appointment)
      onOpenChange(false)
    } catch (error) {
      setErrors({ submit: errorMessage(error) })
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Book a visit</DialogTitle>
          <DialogDescription>
            One visit per booking. Times use this computer&apos;s local clock.
          </DialogDescription>
        </DialogHeader>

        {canBook ? (
          <form data-testid="booking-form" onSubmit={(event) => void handleSubmit(event)}>
            <div className="flex flex-col gap-4">
              <Field data-invalid={errors.petId !== undefined}>
                <FieldLabel htmlFor="booking-pet">Pet</FieldLabel>
                <NativeSelect
                  id="booking-pet"
                  data-testid="booking-pet"
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

              <Field data-invalid={errors.clinicName !== undefined}>
                <FieldLabel htmlFor="booking-clinic">Clinic</FieldLabel>
                <Input
                  id="booking-clinic"
                  data-testid="booking-clinic"
                  value={form.clinicName}
                  maxLength={120}
                  placeholder="Paws & Claws Veterinary Clinic"
                  onChange={(event) => update({ clinicName: event.target.value })}
                />
                {errors.clinicName === undefined ? null : (
                  <FieldError>{errors.clinicName}</FieldError>
                )}
              </Field>

              <Field data-invalid={errors.purpose !== undefined}>
                <FieldLabel htmlFor="booking-purpose">Purpose</FieldLabel>
                <Input
                  id="booking-purpose"
                  data-testid="booking-purpose"
                  value={form.purpose}
                  maxLength={120}
                  placeholder="Annual wellness check"
                  onChange={(event) => update({ purpose: event.target.value })}
                />
                {errors.purpose === undefined ? null : <FieldError>{errors.purpose}</FieldError>}
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.date !== undefined}>
                  <FieldLabel htmlFor="booking-date">Date</FieldLabel>
                  <Input
                    id="booking-date"
                    data-testid="booking-date"
                    type="date"
                    min={today}
                    max={maxDate}
                    value={form.date}
                    onChange={(event) => update({ date: event.target.value })}
                  />
                  {errors.date === undefined ? null : <FieldError>{errors.date}</FieldError>}
                </Field>

                <Field data-invalid={errors.time !== undefined}>
                  <FieldLabel htmlFor="booking-time">Time</FieldLabel>
                  <Input
                    id="booking-time"
                    data-testid="booking-time"
                    type="time"
                    value={form.time}
                    onChange={(event) => update({ time: event.target.value })}
                  />
                  {errors.time === undefined ? null : <FieldError>{errors.time}</FieldError>}
                </Field>
              </div>

              {preview === null ? null : (
                <p className="text-caption text-muted-foreground" data-testid="booking-preview">
                  Scheduled for {preview}.
                </p>
              )}

              {errors.submit === undefined ? null : <FieldError>{errors.submit}</FieldError>}
            </div>

            <DialogFooter className="mt-6">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending} data-testid="booking-submit">
                {pending ? 'Booking…' : 'Book visit'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <p role="alert" className="text-small text-muted-foreground">
              A visit needs a pet. Add a pet to the household first, then book the visit from here.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button asChild>
                <Link to="/pets">Add a pet</Link>
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
