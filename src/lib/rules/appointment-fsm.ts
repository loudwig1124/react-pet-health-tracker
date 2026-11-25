/**
 * R3 — the appointment state machine.
 *
 * `scheduled → completed | cancelled | no_show`; terminal states are immutable;
 * same-status is rejected; `no_show` only when `now` is **strictly after**
 * `scheduledAt`; cancelling requires a non-blank trimmed reason; `completedAt`
 * is set exactly on completion and `cancelReason` exactly on cancellation.
 *
 * Rescheduling is a *plan* (cancel with reason `rescheduled` + a new scheduled
 * row); the repository must apply both writes in one transaction so a
 * half-rescheduled visit is impossible. Pure functions only — `now` is a
 * parameter, never `Date.now()`.
 */

import { parseInstant } from './calendar'
import type { Appointment, AppointmentStatus, IsoInstant } from './types'

export type AppointmentTransitionBlock =
  | 'already_terminal'
  | 'same_status'
  | 'no_show_before_scheduled_at'
  | 'cancel_reason_required'

export const APPOINTMENT_TRANSITION_MESSAGES: Record<AppointmentTransitionBlock, string> = {
  already_terminal: 'This appointment is already closed',
  same_status: 'Already in that state',
  no_show_before_scheduled_at: 'A no-show can only be recorded after the appointment time',
  cancel_reason_required: 'A cancellation needs a reason',
}

/** The reason stored on the cancelled row when a visit is rescheduled. */
export const RESCHEDULE_CANCEL_REASON = 'rescheduled'

export interface AppointmentTransitionCheck {
  allowed: boolean
  block: AppointmentTransitionBlock | null
  message: string | null
}

function blocked(block: AppointmentTransitionBlock): AppointmentTransitionCheck {
  return { allowed: false, block, message: APPOINTMENT_TRANSITION_MESSAGES[block] }
}

const ALLOWED: AppointmentTransitionCheck = { allowed: true, block: null, message: null }

export function isTerminalAppointmentStatus(status: AppointmentStatus): boolean {
  return status !== 'scheduled'
}

export function isOpenAppointmentStatus(status: AppointmentStatus): boolean {
  return status === 'scheduled'
}

export interface AppointmentTransitionInput {
  from: AppointmentStatus
  to: AppointmentStatus
  scheduledAt: IsoInstant | Date
  now: IsoInstant | Date
  cancelReason?: string | null
}

/**
 * Checks `from -> to` without mutating anything. The check order matches the
 * Flutter rule so blocked reasons stay identical: same status first, then
 * terminal, then the no-show clock, then the cancellation reason.
 */
export function checkAppointmentTransition(
  input: AppointmentTransitionInput,
): AppointmentTransitionCheck {
  if (input.from === input.to) {
    return blocked('same_status')
  }
  if (isTerminalAppointmentStatus(input.from)) {
    return blocked('already_terminal')
  }
  const scheduledAt = parseInstant(input.scheduledAt)
  const now = parseInstant(input.now)
  if (input.to === 'no_show' && !(now.getTime() > scheduledAt.getTime())) {
    return blocked('no_show_before_scheduled_at')
  }
  if (
    input.to === 'cancelled' &&
    (input.cancelReason == null || input.cancelReason.trim() === '')
  ) {
    return blocked('cancel_reason_required')
  }
  return ALLOWED
}

/** Thrown when a repository or controller attempts a blocked transition. */
export class AppointmentRuleException extends Error {
  readonly block: AppointmentTransitionBlock

  constructor(block: AppointmentTransitionBlock) {
    super(APPOINTMENT_TRANSITION_MESSAGES[block])
    this.name = 'AppointmentRuleException'
    this.block = block
  }
}

function normalizeCancelReason(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/**
 * Applies a transition and returns the new appointment. Throws
 * `AppointmentRuleException` when the machine blocks it — the write path
 * re-checks, never trusting a disabled button (R3).
 */
export function applyAppointmentTransition(
  appointment: Appointment,
  to: AppointmentStatus,
  options: { now: IsoInstant | Date; cancelReason?: string | null },
): Appointment {
  const now = parseInstant(options.now)
  const check = checkAppointmentTransition({
    from: appointment.status,
    to,
    scheduledAt: appointment.scheduledAt,
    now,
    cancelReason: options.cancelReason,
  })
  if (!check.allowed || check.block !== null) {
    throw new AppointmentRuleException(check.block ?? 'already_terminal')
  }
  const updatedAt = now.toISOString()
  const trimmedReason = normalizeCancelReason(options.cancelReason)
  return {
    ...appointment,
    status: to,
    completedAt: to === 'completed' ? updatedAt : null,
    cancelReason: to === 'cancelled' ? trimmedReason : null,
    updatedAt,
  }
}

export interface ReschedulePlanInput {
  /** The new row's id, minted by the caller (`crypto.randomUUID()`). */
  newId: string
  newScheduledAt: IsoInstant | Date
  now: IsoInstant | Date
}

export interface ReschedulePlan {
  /** The old row, now terminal as `cancelled` with reason `rescheduled`. */
  previous: Appointment
  /** The replacement visit, same pet/clinic/purpose, status `scheduled`. */
  next: Appointment
}

/**
 * Plans a reschedule as two rows. The caller writes both inside one IndexedDB
 * transaction — this function alone never persists anything, and it throws
 * before returning a plan when the old row cannot be cancelled.
 */
export function planReschedule(
  appointment: Appointment,
  input: ReschedulePlanInput,
): ReschedulePlan {
  if (input.newId.trim() === '') {
    throw new RangeError('A rescheduled visit needs a new row id')
  }
  if (input.newId === appointment.id) {
    throw new RangeError('The rescheduled row must not reuse the cancelled row id')
  }
  const now = parseInstant(input.now)
  const newScheduledAt = parseInstant(input.newScheduledAt)
  const previous = applyAppointmentTransition(appointment, 'cancelled', {
    now,
    cancelReason: RESCHEDULE_CANCEL_REASON,
  })
  const next: Appointment = {
    id: input.newId,
    petId: appointment.petId,
    clinicName: appointment.clinicName,
    purpose: appointment.purpose,
    scheduledAt: newScheduledAt.toISOString(),
    status: 'scheduled',
    completedAt: null,
    cancelReason: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
  return { previous, next }
}

/** Convenience for disabled states in the UI; the write path re-checks anyway. */
export function canAppointmentTransition(
  appointment: Appointment,
  to: AppointmentStatus,
  options: { now: IsoInstant | Date; cancelReason?: string | null },
): boolean {
  return checkAppointmentTransition({
    from: appointment.status,
    to,
    scheduledAt: appointment.scheduledAt,
    now: options.now,
    cancelReason: options.cancelReason,
  }).allowed
}
