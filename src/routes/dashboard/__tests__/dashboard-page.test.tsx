import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Toaster } from '@/components/layout/Toaster'
import { listJournal } from '@/lib/db/repositories/journal'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { resetToastsForTests } from '@/lib/toast'
import { DashboardPage } from '@/routes/dashboard/DashboardPage'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
      <Toaster />
    </MemoryRouter>,
  )
}

describe('dashboard quick log (M4)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    await resetDatabaseForTests()
    await saveOwner({ name: 'Daniel Reyes', email: 'daniel@example.com', phone: '' })
    await createPet({
      name: 'Bella',
      species: 'Dog',
      breed: null,
      sex: 'female',
      dateOfBirth: '2022-01-01',
      weightKg: 12.4,
      microchip: null,
    })
  })

  afterEach(() => {
    resetToastsForTests()
  })

  it('logs a walk at the current moment through the journal write path, with Undo', async () => {
    renderDashboard()

    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent('Daniel')
    const quickLog = await screen.findByTestId('quick-log')
    expect(quickLog).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('quick-log-walk'))

    await waitFor(async () => {
      expect(await listJournal()).toHaveLength(1)
    })
    const entry = (await listJournal())[0]
    expect(entry?.kind).toBe('walk')
    expect(entry?.durationMinutes).toBeNull()

    const undo = await screen.findByTestId('journal-undo')
    await userEvent.click(undo)
    await waitFor(async () => {
      expect(await listJournal()).toEqual([])
    })
  })

  it('offers the four quick kinds in the documented order', async () => {
    renderDashboard()
    await screen.findByTestId('quick-log')

    const labels = ['walk', 'fed', 'meds', 'note'].map(
      (kind) => screen.getByTestId(`quick-log-${kind}`).textContent,
    )
    expect(labels).toEqual(['Walk', 'Fed', 'Meds', 'Note'])
  })

  it('shows the empty-state when the household has no pets', async () => {
    await resetDatabaseForTests()
    await saveOwner({ name: 'Daniel Reyes', email: '', phone: '' })
    renderDashboard()

    expect(await screen.findByTestId('dashboard-pets-empty')).toBeInTheDocument()
    // The quick-log island lands on the idle callback; waiting is the contract.
    expect(await screen.findByTestId('quick-log-walk')).toBeDisabled()
  })
})
