import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resetFirstRunStateForTests } from '@/app/first-run-state'
import { Toaster } from '@/components/layout/Toaster'
import { createJournalEntry, listJournalForPet } from '@/lib/db/repositories/journal'
import { createPet } from '@/lib/db/repositories/pets'
import { resetToastsForTests } from '@/lib/toast'
import { PetJournalTab } from '@/routes/pets.$petId/JournalTab'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderTab(petId: string, petName = 'Bella') {
  return render(
    <MemoryRouter>
      <PetJournalTab petId={petId} petName={petName} />
      <Toaster />
    </MemoryRouter>,
  )
}

async function seedPet(name = 'Bella', species = 'Dog') {
  return createPet({
    name,
    species,
    breed: null,
    sex: 'female',
    dateOfBirth: '2022-01-01',
    weightKg: 12.4,
    microchip: null,
  })
}

async function seedEntry(petId: string) {
  const today = new Date()
  return createJournalEntry({
    petId,
    kind: 'walk',
    occurredAt: new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      7,
      10,
    ).toISOString(),
    note: 'Morning loop',
    durationMinutes: 30,
  })
}

describe('pet detail Journal tab (M4/t10)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    window.sessionStorage.clear()
    resetFirstRunStateForTests()
    resetToastsForTests()
    await resetDatabaseForTests()
  })

  afterEach(() => {
    resetToastsForTests()
  })

  it('shows the pet journal grouped by local day, newest first', async () => {
    const pet = await seedPet()
    const today = new Date()
    const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
    await seedEntry(pet.id)
    await createJournalEntry({
      petId: pet.id,
      kind: 'note',
      occurredAt: new Date(
        yesterday.getFullYear(),
        yesterday.getMonth(),
        yesterday.getDate(),
        20,
        15,
      ).toISOString(),
      note: 'Slept well',
      durationMinutes: null,
    })

    renderTab(pet.id)

    expect(await screen.findByTestId('pet-journal-tab')).toBeInTheDocument()
    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()
    expect(screen.getByText('Morning loop')).toBeInTheDocument()
    expect(screen.getByText('Slept well')).toBeInTheDocument()
    expect(await screen.findByText(/2 entries/)).toBeInTheDocument()
  })

  it('shows a pet-scoped empty state and preselects the pet for quick log', async () => {
    const pet = await seedPet('Miso', 'Cat')

    renderTab(pet.id, 'Miso')

    expect(await screen.findByTestId('pet-journal-empty')).toHaveTextContent(
      'Nothing logged for Miso yet',
    )
    // The quick-log picker is fixed to this pet (t10: preselect from the tab).
    expect(screen.getByLabelText('Pet for quick log')).toHaveValue(pet.id)

    await userEvent.click(screen.getByTestId('quick-log-walk'))
    expect(await screen.findByTestId('pet-journal-feed')).toHaveTextContent('Walk')
    await waitFor(async () => {
      expect(await listJournalForPet(pet.id)).toHaveLength(1)
    })
    expect(screen.queryByTestId('pet-journal-empty')).not.toBeInTheDocument()
  })

  it('edits time/note/duration with the shared editor and Undo restores the old values', async () => {
    const pet = await seedPet()
    const entry = await seedEntry(pet.id)
    renderTab(pet.id)

    await userEvent.click(await screen.findByTestId(`journal-entry-${entry.id}`))
    const editor = await screen.findByTestId('journal-editor')
    expect(editor).toHaveAttribute('data-mode', 'inline')
    expect(screen.getByLabelText('Kind')).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Notes'))
    await userEvent.type(screen.getByLabelText('Notes'), 'Evening loop instead')
    await userEvent.click(screen.getByTestId('journal-save'))

    await waitFor(async () => {
      expect((await listJournalForPet(pet.id))[0]?.note).toBe('Evening loop instead')
    })
    await userEvent.click(await screen.findByTestId('journal-undo'))
    await waitFor(async () => {
      expect((await listJournalForPet(pet.id))[0]?.note).toBe('Morning loop')
    })
  })

  it('deletes from the tab with the same confirmation + 3 s Undo', async () => {
    const pet = await seedPet()
    const entry = await seedEntry(pet.id)
    renderTab(pet.id)

    await userEvent.click(await screen.findByTestId(`journal-entry-${entry.id}`))
    await userEvent.click(await screen.findByTestId(`journal-delete-${entry.id}`))
    await userEvent.click(await screen.findByTestId('journal-delete-confirm'))

    await waitFor(async () => {
      expect(await listJournalForPet(pet.id)).toEqual([])
    })
    await userEvent.click(await screen.findByTestId('journal-undo'))
    await waitFor(async () => {
      expect((await listJournalForPet(pet.id)).map((row) => row.id)).toEqual([entry.id])
    })
    expect(await screen.findByTestId(`journal-entry-${entry.id}`)).toBeInTheDocument()
  })
})
