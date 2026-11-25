import { describe, expect, it } from 'vitest'

import {
  APPOINTMENT_TRANSITION_MESSAGES,
  AppointmentRuleException,
  applyAppointmentTransition,
  canAppointmentTransition,
  checkAppointmentTransition,
  isOpenAppointmentStatus,
  isTerminalAppointmentStatus,
  planReschedule,
  RESCHEDULE_CANCEL_REASON,
} from './appointment-fsm'
import type { Appointment } from './types'

const SCHEDULED_AT = '2026-11-25T09:30:00.000Z'
const NOW_BEFORE = '2026-11-25T09:29:59.999Z'
const NOW_AT = '2026-11-25T09:30:00.000Z'
const NOW_AFTER = '2026-11-25T09:30:00.001Z'
const LATER = '2026-12-01T10:00:00.000Z'

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: 'appt-1',
    petId: 'pet-bella',
    clinicName: 'Paws & Claws Veterinary Clinic',
    purpose: 'Annual wellness check',
    scheduledAt: SCHEDULED_AT,
    status: 'scheduled',
    completedAt: null,
    cancelReason: null,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('R3 appointment · allowed transitions', () => {
  it('accepts: scheduled → completed sets completedAt exactly once', () => {
    const check = checkAppointmentTransition({
      from: 'scheduled',
      to: 'completed',
      scheduledAt: SCHEDULED_AT,
      now: NOW_AFTER,
    })
    expect(check.allowed).toBe(true)
    const updated = applyAppointmentTransition(appointment(), 'completed', { now: NOW_AFTER })
    expect(updated.status).toBe('completed')
    expect(updated.completedAt).toBe(NOW_AFTER)
    expect(updated.cancelReason).toBeNull()
    expect(updated.updatedAt).toBe(NOW_AFTER)
    expect(isTerminalAppointmentStatus(updated.status)).toBe(true)
  })

  it('accepts: scheduled → cancelled requires and stores a trimmed reason', () => {
    const updated = applyAppointmentTransition(appointment(), 'cancelled', {
      now: NOW_AFTER,
      cancelReason: '  Family emergency  ',
    })
    expect(updated.status).toBe('cancelled')
    expect(updated.cancelReason).toBe('Family emergency')
    expect(updated.completedAt).toBeNull()
  })

  it('accepts: no-show one second after the time', () => {
    expect(
      checkAppointmentTransition({
        from: 'scheduled',
        to: 'no_show',
        scheduledAt: SCHEDULED_AT,
        now: NOW_AFTER,
      }).allowed,
    ).toBe(true)
    const updated = applyAppointmentTransition(appointment(), 'no_show', { now: NOW_AFTER })
    expect(updated.status).toBe('no_show')
    expect(updated.completedAt).toBeNull()
    expect(updated.cancelReason).toBeNull()
  })
})

describe('R3 appointment · open vs terminal', () => {
  it('accepts: only scheduled is open', () => {
    expect(isOpenAppointmentStatus('scheduled')).toBe(true)
    for (const status of ['completed', 'cancelled', 'no_show'] as const) {
      expect(isOpenAppointmentStatus(status)).toBe(false)
      expect(isTerminalAppointmentStatus(status)).toBe(true)
    }
    expect(isTerminalAppointmentStatus('scheduled')).toBe(false)
  })
})

describe('R3 appointment · rejected transitions', () => {
  it('rejects: no-show at or before the scheduled instant', () => {
    const at = checkAppointmentTransition({
      from: 'scheduled',
      to: 'no_show',
      scheduledAt: SCHEDULED_AT,
      now: NOW_AT,
    })
    expect(at.allowed).toBe(false)
    expect(at.block).toBe('no_show_before_scheduled_at')
    expect(at.message).toBe(APPOINTMENT_TRANSITION_MESSAGES.no_show_before_scheduled_at)

    const before = checkAppointmentTransition({
      from: 'scheduled',
      to: 'no_show',
      scheduledAt: SCHEDULED_AT,
      now: NOW_BEFORE,
    })
    expect(before.allowed).toBe(false)
    expect(() => applyAppointmentTransition(appointment(), 'no_show', { now: NOW_AT })).toThrow(
      AppointmentRuleException,
    )
  })

  it('rejects: a blank or missing cancellation reason', () => {
    for (const reason of [null, undefined, '', '   ', '\n\t']) {
      const check = checkAppointmentTransition({
        from: 'scheduled',
        to: 'cancelled',
        scheduledAt: SCHEDULED_AT,
        now: NOW_AFTER,
        cancelReason: reason,
      })
      expect(check.allowed).toBe(false)
      expect(check.block).toBe('cancel_reason_required')
    }
    expect(() =>
      applyAppointmentTransition(appointment(), 'cancelled', {
        now: NOW_AFTER,
        cancelReason: '   ',
      }),
    ).toThrow(AppointmentRuleException)
  })

  it('rejects: same-status moves', () => {
    const sameOpen = checkAppointmentTransition({
      from: 'scheduled',
      to: 'scheduled',
      scheduledAt: SCHEDULED_AT,
      now: NOW_AFTER,
    })
    expect(sameOpen.allowed).toBe(false)
    expect(sameOpen.block).toBe('same_status')

    // Same-status wins over the terminal check, matching the Flutter order.
    const sameTerminal = checkAppointmentTransition({
      from: 'completed',
      to: 'completed',
      scheduledAt: SCHEDULED_AT,
      now: NOW_AFTER,
    })
    expect(sameTerminal.block).toBe('same_status')
  })

  it('rejects: every transition out of a terminal state', () => {
    for (const from of ['completed', 'cancelled', 'no_show'] as const) {
      for (const to of ['completed', 'cancelled', 'no_show'] as const) {
        if (from === to) {
          continue
        }
        const check = checkAppointmentTransition({
          from,
          to,
          scheduledAt: SCHEDULED_AT,
          now: NOW_AFTER,
          cancelReason: 'anything',
        })
        expect(check.allowed).toBe(false)
        expect(check.block).toBe('already_terminal')
      }
      expect(() =>
        applyAppointmentTransition(appointment({ status: from }), 'completed', { now: NOW_AFTER }),
      ).toThrow(AppointmentRuleException)
    }
  })

  it('rejects: completedAt never appears outside completion and cancelReason only on cancellation', () => {
    const completed = applyAppointmentTransition(appointment(), 'completed', { now: NOW_AFTER })
    expect(completed.completedAt).toBe(NOW_AFTER)
    expect(completed.cancelReason).toBeNull()

    const cancelled = applyAppointmentTransition(appointment(), 'cancelled', {
      now: NOW_AFTER,
      cancelReason: 'Moved',
    })
    expect(cancelled.completedAt).toBeNull()
    expect(cancelled.cancelReason).toBe('Moved')

    const noShow = applyAppointmentTransition(appointment(), 'no_show', { now: NOW_AFTER })
    expect(noShow.completedAt).toBeNull()
    expect(noShow.cancelReason).toBeNull()
  })

  it('rejects: canAppointmentTransition mirrors the machine for disabled states', () => {
    expect(canAppointmentTransition(appointment(), 'no_show', { now: NOW_AT })).toBe(false)
    expect(canAppointmentTransition(appointment(), 'no_show', { now: NOW_AFTER })).toBe(true)
    expect(
      canAppointmentTransition(appointment({ status: 'cancelled' }), 'completed', {
        now: NOW_AFTER,
      }),
    ).toBe(false)
  })
})

describe('R3 appointment · atomic reschedule plan', () => {
  it('accepts: reschedule is exactly one cancelled row plus one scheduled row', () => {
    const original = appointment()
    const plan = planReschedule(original, {
      newId: 'appt-2',
      newScheduledAt: LATER,
      now: NOW_AFTER,
    })

    expect(plan.previous.id).toBe(original.id)
    expect(plan.previous.status).toBe('cancelled')
    expect(plan.previous.cancelReason).toBe(RESCHEDULE_CANCEL_REASON)
    expect(plan.previous.completedAt).toBeNull()
    expect(plan.previous.updatedAt).toBe(NOW_AFTER)

    expect(plan.next.id).toBe('appt-2')
    expect(plan.next.status).toBe('scheduled')
    expect(plan.next.scheduledAt).toBe(LATER)
    expect(plan.next.petId).toBe(original.petId)
    expect(plan.next.clinicName).toBe(original.clinicName)
    expect(plan.next.purpose).toBe(original.purpose)
    expect(plan.next.completedAt).toBeNull()
    expect(plan.next.cancelReason).toBeNull()
    expect(plan.next.createdAt).toBe(NOW_AFTER)
    expect(plan.next.updatedAt).toBe(NOW_AFTER)
  })

  it('rejects: no plan is produced for a closed visit, so no half-row can be written', () => {
    for (const status of ['completed', 'cancelled', 'no_show'] as const) {
      const original = appointment({ status })
      expect(() =>
        planReschedule(original, { newId: 'appt-2', newScheduledAt: LATER, now: NOW_AFTER }),
      ).toThrow(AppointmentRuleException)
    }
  })

  it('rejects: a missing or reused new-row id', () => {
    expect(() =>
      planReschedule(appointment(), { newId: '   ', newScheduledAt: LATER, now: NOW_AFTER }),
    ).toThrow(RangeError)
    expect(() =>
      planReschedule(appointment(), { newId: 'appt-1', newScheduledAt: LATER, now: NOW_AFTER }),
    ).toThrow(RangeError)
    expect(() =>
      planReschedule(appointment(), {
        newId: 'appt-2',
        newScheduledAt: 'not-an-instant',
        now: NOW_AFTER,
      }),
    ).toThrow(TypeError)
  })

  it('accepts: the plan is pure — the original appointment is unchanged', () => {
    const original = appointment()
    const snapshot = { ...original }
    planReschedule(original, { newId: 'appt-2', newScheduledAt: LATER, now: NOW_AFTER })
    expect(original).toEqual(snapshot)
  })
})
