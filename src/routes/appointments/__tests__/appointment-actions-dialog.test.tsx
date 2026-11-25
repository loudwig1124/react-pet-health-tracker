/**
 * R3 through the actions dialog: the button gate matches the shared state
 * machine, terminal visits expose no actions, and the write path really is the
 * repository (so the same rules are re-checked after the click).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { db } from '@/lib/db/db'
import { createAppointment, updateAppointmentStatus } from '@/lib/db/repositories/appointments'
import { createPet } from '@/lib/db/repositories/pets'
import { RESCHEDULE_CANCEL_REASON } from '@/lib/rules/appointment-fsm'
import { addDays } from '@/lib/rules/calendar'
import type { Appointment } from '@/lib/rules/types'
import { instantFromLocalDateTime, localToday } from '@/lib/schedule/format'
import { resetDatabaseForTests } from '@/test/db-utils'

import { AppointmentActionsDialog } from '../components/AppointmentActionsDialog'

const TODAY = localToday()

async function seedVisit(dayOffset: number, time = '09:30'): Promise<Appointment> {
  const pet = await createPet({
    name: 'Bella',
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip: null,
  })
  return createAppointment({
    petId: pet.id,
    clinicName: 'Paws & Claws',
    purpose: 'Annual wellness check',
    scheduledAt: instantFromLocalDateTime(addDays(TODAY, dayOffset), time),
  })
}

function renderDialog(appointment: Appointment) {
  const onOpenChange = vi.fn()
  const onMessage = vi.fn()
  render(
    <AppointmentActionsDialog
      appointment={appointment}
      petLabel="Bella"
      open
      onOpenChange={onOpenChange}
      onMessage={onMessage}
    />,
  )
  return { onOpenChange, onMessage }
}

beforeEach(async () => {
  window.localStorage.clear()
  await resetDatabaseForTests()
})

describe('appointment actions dialog (R3)', () => {
  it('disables no-show for a future visit and explains why', async () => {
    const appointment = await seedVisit(1)
    renderDialog(appointment)

    const dialog = await screen.findByTestId('appointment-actions-dialog')
    const noShow = within(dialog).getByTestId(`appointment-no-show-${appointment.id}`)
    expect(noShow).toBeDisabled()
    expect(noShow).toHaveAttribute('data-can-no-show', 'false')
    expect(within(dialog).getByTestId('appointment-no-show-blocked')).toHaveTextContent(
      'after the appointment time',
    )
    // The other actions are available while the visit is scheduled.
    expect(within(dialog).getByTestId(`appointment-complete-${appointment.id}`)).toBeEnabled()
    expect(within(dialog).getByTestId(`appointment-cancel-${appointment.id}`)).toBeEnabled()
    expect(within(dialog).getByTestId(`appointment-reschedule-${appointment.id}`)).toBeEnabled()
  })

  it('enables no-show for a scheduled visit whose time has passed', async () => {
    const appointment = await seedVisit(-1)
    renderDialog(appointment)
    const dialog = await screen.findByTestId('appointment-actions-dialog')
    expect(within(dialog).getByTestId(`appointment-no-show-${appointment.id}`)).toBeEnabled()
  })

  it('offers no actions on a terminal visit', async () => {
    const appointment = await seedVisit(-2)
    await updateAppointmentStatus(appointment.id, 'completed', {
      now: new Date(),
    })
    const completed = (await db.appointment.get(appointment.id)) as Appointment
    renderDialog(completed)

    const dialog = await screen.findByTestId('appointment-actions-dialog')
    expect(within(dialog).getByTestId('appointment-terminal-summary')).toHaveTextContent(
      'Completed',
    )
    expect(
      within(dialog).queryByTestId(`appointment-complete-${appointment.id}`),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByTestId(`appointment-cancel-${appointment.id}`),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByTestId(`appointment-no-show-${appointment.id}`),
    ).not.toBeInTheDocument()
    expect(
      within(dialog).queryByTestId(`appointment-reschedule-${appointment.id}`),
    ).not.toBeInTheDocument()
  })

  it('blocks a blank cancellation reason, then writes the trimmed reason', async () => {
    const appointment = await seedVisit(1)
    const { onMessage, onOpenChange } = renderDialog(appointment)
    const dialog = await screen.findByTestId('appointment-actions-dialog')

    fireEvent.click(within(dialog).getByTestId(`appointment-cancel-${appointment.id}`))
    const form = await screen.findByTestId('appointment-cancel-form')
    const confirm = within(form).getByTestId('appointment-confirm-cancel')
    expect(confirm).toBeDisabled()

    fireEvent.change(within(form).getByTestId('appointment-cancel-reason'), {
      target: { value: '   ' },
    })
    expect(confirm).toBeDisabled()

    fireEvent.change(within(form).getByTestId('appointment-cancel-reason'), {
      target: { value: '  Owner unwell  ' },
    })
    expect(confirm).toBeEnabled()
    fireEvent.click(confirm)

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Visit cancelled.')
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
    const stored = await db.appointment.get(appointment.id)
    expect(stored?.status).toBe('cancelled')
    expect(stored?.cancelReason).toBe('Owner unwell')
    expect(stored?.completedAt).toBeNull()
  })

  it('reschedules atomically: the old row is cancelled as rescheduled and a new row is scheduled', async () => {
    const appointment = await seedVisit(2)
    const { onMessage } = renderDialog(appointment)
    const dialog = await screen.findByTestId('appointment-actions-dialog')

    fireEvent.click(within(dialog).getByTestId(`appointment-reschedule-${appointment.id}`))
    const form = await screen.findByTestId('appointment-reschedule-form')
    fireEvent.change(within(form).getByTestId('appointment-reschedule-date'), {
      target: { value: addDays(TODAY, 5) },
    })
    fireEvent.change(within(form).getByTestId('appointment-reschedule-time'), {
      target: { value: '11:15' },
    })
    fireEvent.click(within(form).getByTestId('appointment-confirm-reschedule'))

    await waitFor(() => {
      expect(onMessage).toHaveBeenCalledWith('Visit rescheduled.')
    })

    const oldRow = await db.appointment.get(appointment.id)
    expect(oldRow?.status).toBe('cancelled')
    expect(oldRow?.cancelReason).toBe(RESCHEDULE_CANCEL_REASON)

    const scheduled = await db.appointment.where('status').equals('scheduled').toArray()
    expect(scheduled).toHaveLength(1)
    expect(scheduled[0]?.petId).toBe(appointment.petId)
    expect(scheduled[0]?.clinicName).toBe(appointment.clinicName)
    expect(scheduled[0]?.purpose).toBe(appointment.purpose)
    expect(scheduled[0]?.scheduledAt).toBe(instantFromLocalDateTime(addDays(TODAY, 5), '11:15'))
  })
})
