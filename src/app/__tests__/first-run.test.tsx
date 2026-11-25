import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetFirstRunStateForTests } from '@/app/first-run-state'
import { appRoutes } from '@/app/router'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] })
  return render(<RouterProvider router={router} />)
}

describe('first run (M4)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    window.sessionStorage.clear()
    resetFirstRunStateForTests()
    await resetDatabaseForTests()
  })

  it('shows the takeover for an empty unnamed household, then the normal dashboard', async () => {
    const first = renderApp('/')

    expect(await screen.findByTestId('first-run')).toBeInTheDocument()
    expect(screen.queryByTestId('app-shell')).not.toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Your name'), 'Daniel Reyes')
    await userEvent.type(screen.getByLabelText('Pet name'), 'Bella')
    await userEvent.click(screen.getByTestId('first-run-create'))

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard')
    })
    expect(screen.getByTestId('app-shell')).toBeInTheDocument()
    expect(await screen.findByTestId('dashboard-greeting')).toHaveTextContent('Daniel')
    await waitFor(() => {
      expect(screen.getByTestId('footer-owner-name')).toHaveTextContent('Daniel Reyes')
    })
    // Never the old placeholder name.
    expect(screen.queryByText('My household')).not.toBeInTheDocument()

    // "Reload": the takeover stays gone because the household now has a pet.
    first.unmount()
    renderApp('/')
    await waitFor(() => {
      expect(screen.getByTestId('footer-owner-name')).toHaveTextContent('Daniel Reyes')
    })
    expect(screen.queryByTestId('first-run')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard')
  })

  it('returns to first run after a reset, prefilled with the live owner name', async () => {
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

    renderApp('/profile')
    await userEvent.click(await screen.findByTestId('settings-reset'))
    await userEvent.click(await screen.findByTestId('settings-reset-confirm'))

    expect(await screen.findByTestId('first-run')).toBeInTheDocument()
    // The reset kept the name, so the field shows the live owner name — never a
    // stale copy, and never the placeholder when a real name exists.
    expect(screen.getByLabelText('Your name')).toHaveValue('Daniel Reyes')

    await userEvent.type(screen.getByLabelText('Pet name'), 'Miso')
    await userEvent.click(screen.getByTestId('first-run-create'))
    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard')
    })
    expect(screen.queryByTestId('first-run')).not.toBeInTheDocument()
  })

  it('starts with the sample household in one click', async () => {
    renderApp('/')
    await screen.findByTestId('first-run')

    await userEvent.click(screen.getByTestId('first-run-sample'))

    await waitFor(() => {
      expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard')
    })
    // The demo persona names an otherwise untouched placeholder owner.
    await waitFor(() => {
      expect(screen.getByTestId('footer-owner-name')).toHaveTextContent('Maria Santos')
    })
    expect(await screen.findByTestId('dashboard-pets')).toHaveTextContent('Bella')
    expect(screen.getByTestId('dashboard-pets')).toHaveTextContent('Miso')
  })
})
