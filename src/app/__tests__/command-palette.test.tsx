import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CommandPalette } from '@/components/layout/CommandPalette'
import { createAppointment } from '@/lib/db/repositories/appointments'
import { appendHealthRecord } from '@/lib/db/repositories/health-records'
import { createJournalEntry } from '@/lib/db/repositories/journal'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { PALETTE_RECENTS_STORAGE_KEY } from '@/lib/palette-recents'
import { resetDatabaseForTests } from '@/test/db-utils'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>
}

async function seedSearchable(): Promise<{ petId: string }> {
  await saveOwner({ name: 'Daniel Reyes', email: '', phone: '' })
  const bella = await createPet({
    name: 'Bella',
    species: 'Dog',
    breed: 'Golden Retriever mix',
    sex: 'female',
    dateOfBirth: '2022-01-01',
    weightKg: 12.4,
    microchip: null,
  })
  await appendHealthRecord({
    petId: bella.id,
    recordedOn: '2026-11-20',
    condition: 'Ear infection',
    diagnosis: 'Otitis externa',
    treatment: 'Drops',
    prescribedMedication: null,
    vetName: 'Dr Reyes',
  })
  await createJournalEntry({
    petId: bella.id,
    kind: 'walk',
    occurredAt: new Date().toISOString(),
    note: 'Morning walk in the park',
    durationMinutes: 30,
  })
  await createAppointment({
    petId: bella.id,
    clinicName: 'Paws & Claws',
    purpose: 'Annual wellness check',
    scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
  })
  return { petId: bella.id }
}

function renderPalette(onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/']}>
      <LocationProbe />
      <CommandPalette onClose={onClose} />
    </MemoryRouter>,
  )
  return onClose
}

describe('F3 command palette (05 F3/F9, 06 M5)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await resetDatabaseForTests()
    await seedSearchable()
  })

  it('focuses the input and searches pets, records, notes, visits and commands', async () => {
    renderPalette()
    const input = await screen.findByTestId('command-input')
    expect(input).toHaveRole('combobox')
    await waitFor(() => expect(input).toHaveFocus())
    expect(await screen.findByTestId('command-group-navigate')).toBeInTheDocument()
    expect(screen.getByTestId('command-group-create')).toBeInTheDocument()

    await userEvent.type(input, 'bella')
    expect(await screen.findByTestId('command-group-pets')).toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'ear infection')
    expect(await screen.findByTestId('command-group-records')).toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'morning walk')
    expect(await screen.findByTestId('command-group-journal')).toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'annual')
    expect(await screen.findByTestId('command-group-appointments')).toBeInTheDocument()

    await userEvent.clear(input)
    await userEvent.type(input, 'book visit')
    expect(screen.getAllByTestId(/command-item-create:/)).toHaveLength(1)
  })

  it('is keyboard-only: arrows move, Enter navigates, Escape closes', async () => {
    const onClose = renderPalette()
    const input = await screen.findByTestId('command-input')
    await screen.findByTestId('command-group-navigate')

    await userEvent.type(input, 'bella')
    await screen.findByTestId('command-group-pets')
    await userEvent.keyboard('{ArrowDown}{ArrowUp}')
    await userEvent.keyboard('{Enter}')

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/pets/'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('runs the create commands through the same ?new=1 routes as the screens', async () => {
    renderPalette()
    const input = await screen.findByTestId('command-input')
    await screen.findByTestId('command-group-create')

    await userEvent.type(input, 'book visit')
    const item = screen.getByTestId('command-item-create:visit')
    await userEvent.click(item)

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/appointments?new=1'),
    )
  })

  it('raises the accessible name of a selection through aria-activedescendant', async () => {
    renderPalette()
    const input = await screen.findByTestId('command-input')
    await screen.findByTestId('command-group-navigate')

    await userEvent.type(input, 'journal')
    await waitFor(() =>
      expect(input.getAttribute('aria-activedescendant')).toMatch(/^command-option-/),
    )
    const activeId = input.getAttribute('aria-activedescendant')
    expect(document.getElementById(activeId ?? '')).not.toBeNull()
  })

  it('offers the last visited destinations as recents (F9) and prunes stale ids', async () => {
    window.localStorage.setItem(
      PALETTE_RECENTS_STORAGE_KEY,
      JSON.stringify(['nav:/pets', 'pet:deleted-pet']),
    )
    renderPalette()
    await screen.findByTestId('command-group-navigate')

    const recent = await screen.findByTestId('command-group-recent')
    expect(recent).toHaveTextContent('Pets')
    expect(screen.queryByText('pet:deleted-pet')).not.toBeInTheDocument()
  })

  it('closes on Escape and returns control to the caller', async () => {
    const onClose = renderPalette()
    const input = await screen.findByTestId('command-input')
    await waitFor(() => expect(input).toHaveFocus())

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(onClose).toHaveBeenCalled())
  })
})
