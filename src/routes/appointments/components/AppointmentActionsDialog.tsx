/**
 * Visit actions dialog (02 §1 AppointmentActionsDialog, R3).
 *
 * The shared state machine decides what may be offered: a scheduled visit can be
 * completed, cancelled (with a trimmed reason), marked no-show once the
 * scheduled instant has passed, or rescheduled — which the repository performs
 * atomically as "cancel as rescheduled + insert the replacement". A terminal
 * visit renders its closing fact and no action at all.
 *
 * The no-show gate ticks once a second so it becomes available the moment the
 * appointment time passes, without a reload; the write path still re-reads the
 * clock and re-checks the rule, so a stale button cannot corrupt a row.
 */
import { useState, type FormEvent } from 'react'

import { AppointmentStatusChip } from '@/components/app/ScheduleChips'
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
import { updateAppointmentStatus, rescheduleAppointment } from '@/lib/db/repositories/appointments'
import { useNow } from '@/lib/hooks/useNow'
import { isDateKey } from '@/lib/rules/calendar'
import type { Appointment } from '@/lib/rules/types'
import {
  appointmentActionState,
  isCancelReasonValid,
  reschedulePrefill,
  terminalSummary,
} from '@/lib/schedule/appointments'
import {
  formatDateTimeWithYear,
  instantFromLocalDateTime,
  isValidTimeInput,
} from '@/lib/schedule/format'
import { errorMessage } from '@/lib/schedule/live'

export interface AppointmentActionsDialogProps {
  appointment: Appointment
  petLabel: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Announcement for the page's live region after a write. */
  onMessage: (message: string) => void
  /** Called with the new local day so the page can switch to Upcoming. */
  onRescheduled?: (day: string) => void
  /** Called after a visit becomes terminal, so the page can show Past. */
  onClosed?: () => void
}

type Mode = 'summary' | 'cancel' | 'reschedule'

interface FormErrors {
  reason?: string
  schedule?: string
  submit?: string
}

export function AppointmentActionsDialog({
  appointment,
  petLabel,
  open,
  onOpenChange,
  onMessage,
  onRescheduled,
  onClosed,
}: AppointmentActionsDialogProps) {
  const now = useNow(1000)
  const prefill = reschedulePrefill(appointment)
  const [mode, setMode] = useState<Mode>('summary')
  const [reason, setReason] = useState('')
  const [newDate, setNewDate] = useState(prefill.date)
  const [newTime, setNewTime] = useState(prefill.time)
  const [errors, setErrors] = useState<FormErrors>({})
  const [pending, setPending] = useState(false)

  const actions = appointmentActionState(appointment, now)
  const closedSummary = terminalSummary(appointment)

  async function run(
    task: () => Promise<unknown>,
    message: string,
    afterClose?: () => void,
  ): Promise<void> {
    setPending(true)
    setErrors({})
    try {
      await task()
      onMessage(message)
      afterClose?.()
      onOpenChange(false)
    } catch (error) {
      setErrors({ submit: errorMessage(error) })
    } finally {
      setPending(false)
    }
  }

  async function handleCancel(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!isCancelReasonValid(reason)) {
      setErrors({ reason: 'A cancellation needs a reason.' })
      return
    }
    await run(
      () =>
        updateAppointmentStatus(appointment.id, 'cancelled', {
          now: new Date(),
          cancelReason: reason,
        }),
      'Visit cancelled.',
      onClosed,
    )
  }

  async function handleReschedule(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!isDateKey(newDate)) {
      setErrors({ schedule: 'Choose a date.' })
      return
    }
    if (!isValidTimeInput(newTime)) {
      setErrors({ schedule: 'Choose a time.' })
      return
    }
    let instant: string
    try {
      instant = instantFromLocalDateTime(newDate, newTime)
    } catch {
      setErrors({ schedule: 'That local time does not exist on this date.' })
      return
    }
    await run(async () => {
      await rescheduleAppointment(appointment.id, {
        newScheduledAt: instant,
        now: new Date(),
      })
      // Keep the new visit on screen: the page switches to Upcoming.
      onRescheduled?.(newDate)
    }, 'Visit rescheduled.')
  }

  const title =
    mode === 'cancel'
      ? 'Cancel visit'
      : mode === 'reschedule'
        ? 'Reschedule visit'
        : 'Visit actions'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="appointment-actions-dialog"
        data-appointment-id={appointment.id}
        data-scheduled-at={appointment.scheduledAt}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {petLabel} · {appointment.clinicName} · {appointment.purpose}
            <br />
            <span className="tabular-nums">{formatDateTimeWithYear(appointment.scheduledAt)}</span>
          </DialogDescription>
        </DialogHeader>

        {mode === 'summary' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <AppointmentStatusChip status={appointment.status} />
              {closedSummary === null ? null : (
                <span
                  data-testid="appointment-terminal-summary"
                  className="text-caption text-muted-foreground"
                >
                  {closedSummary}
                </span>
              )}
            </div>

            {closedSummary !== null ? (
              <p className="text-small text-muted-foreground">
                This visit is closed. Closed visits cannot be changed.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="default"
                  data-testid={`appointment-complete-${appointment.id}`}
                  disabled={!actions.canComplete || pending}
                  onClick={() =>
                    void run(
                      () =>
                        updateAppointmentStatus(appointment.id, 'completed', { now: new Date() }),
                      'Appointment marked completed.',
                      onClosed,
                    )
                  }
                >
                  Mark completed
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid={`appointment-reschedule-${appointment.id}`}
                  disabled={!actions.canReschedule || pending}
                  onClick={() => setMode('reschedule')}
                >
                  Reschedule…
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid={`appointment-cancel-${appointment.id}`}
                  disabled={!actions.canCancel || pending}
                  onClick={() => setMode('cancel')}
                >
                  Cancel visit…
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  data-testid={`appointment-no-show-${appointment.id}`}
                  data-can-no-show={actions.canNoShow ? 'true' : 'false'}
                  aria-describedby={
                    actions.noShowBlockMessage === null ? undefined : 'no-show-block-message'
                  }
                  disabled={!actions.canNoShow || pending}
                  onClick={() =>
                    void run(
                      () => updateAppointmentStatus(appointment.id, 'no_show', { now: new Date() }),
                      'Appointment recorded as a no-show.',
                      onClosed,
                    )
                  }
                >
                  Mark no-show
                </Button>
                {actions.noShowBlockMessage === null ? null : (
                  <p
                    id="no-show-block-message"
                    data-testid="appointment-no-show-blocked"
                    className="text-caption text-muted-foreground"
                  >
                    {actions.noShowBlockMessage}
                  </p>
                )}
              </div>
            )}

            {errors.submit === undefined ? null : (
              <p
                role="alert"
                data-testid="appointment-actions-error"
                className="text-small text-destructive"
              >
                {errors.submit}
              </p>
            )}
          </div>
        ) : null}

        {mode === 'cancel' ? (
          <form
            data-testid="appointment-cancel-form"
            onSubmit={(event) => void handleCancel(event)}
          >
            <div className="flex flex-col gap-4">
              <Field data-invalid={errors.reason !== undefined}>
                <FieldLabel htmlFor="appointment-cancel-reason">Reason</FieldLabel>
                <Input
                  id="appointment-cancel-reason"
                  data-testid="appointment-cancel-reason"
                  value={reason}
                  maxLength={200}
                  placeholder="Why is this visit being cancelled?"
                  onChange={(event) => setReason(event.target.value)}
                />
                {errors.reason === undefined ? null : <FieldError>{errors.reason}</FieldError>}
              </Field>
              {errors.submit === undefined ? null : <FieldError>{errors.submit}</FieldError>}
              <p className="text-caption text-muted-foreground">
                The reason is stored on the cancelled visit; it cannot be undone.
              </p>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setMode('summary')}>
                Back
              </Button>
              <Button
                type="submit"
                variant="destructive"
                data-testid="appointment-confirm-cancel"
                disabled={!isCancelReasonValid(reason) || pending}
              >
                {pending ? 'Cancelling…' : 'Cancel visit'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {mode === 'reschedule' ? (
          <form
            data-testid="appointment-reschedule-form"
            onSubmit={(event) => void handleReschedule(event)}
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field data-invalid={errors.schedule !== undefined}>
                  <FieldLabel htmlFor="appointment-reschedule-date">New date</FieldLabel>
                  <Input
                    id="appointment-reschedule-date"
                    data-testid="appointment-reschedule-date"
                    type="date"
                    value={newDate}
                    onChange={(event) => setNewDate(event.target.value)}
                  />
                </Field>
                <Field data-invalid={errors.schedule !== undefined}>
                  <FieldLabel htmlFor="appointment-reschedule-time">New time</FieldLabel>
                  <Input
                    id="appointment-reschedule-time"
                    data-testid="appointment-reschedule-time"
                    type="time"
                    value={newTime}
                    onChange={(event) => setNewTime(event.target.value)}
                  />
                </Field>
              </div>
              {errors.schedule === undefined ? null : <FieldError>{errors.schedule}</FieldError>}
              {errors.submit === undefined ? null : <FieldError>{errors.submit}</FieldError>}
              <p className="text-caption text-muted-foreground">
                The old visit is cancelled as &ldquo;rescheduled&rdquo; and a new visit is created
                in the same step.
              </p>
            </div>
            <DialogFooter className="mt-6">
              <Button type="button" variant="ghost" onClick={() => setMode('summary')}>
                Back
              </Button>
              <Button type="submit" data-testid="appointment-confirm-reschedule" disabled={pending}>
                {pending ? 'Rescheduling…' : 'Reschedule'}
              </Button>
            </DialogFooter>
          </form>
        ) : null}

        {mode === 'summary' ? (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
