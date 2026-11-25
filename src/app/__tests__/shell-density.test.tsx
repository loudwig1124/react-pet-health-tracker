import { render, screen, waitFor } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetFirstRunStateForTests } from '@/app/first-run-state'
import { appRoutes } from '@/app/router'
import { saveOwner } from '@/lib/db/repositories/owners'
import { DENSITY_STORAGE_KEY, resetDensityForTests } from '@/lib/density'
import { resetDatabaseForTests } from '@/test/db-utils'

describe('density in the shell (03 §6)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    window.sessionStorage.clear()
    resetDensityForTests()
    resetFirstRunStateForTests()
    delete document.documentElement.dataset.density
    await resetDatabaseForTests()
    // A named, pet-less household keeps the first-run takeover closed.
    await saveOwner({ name: 'Test Owner', email: '', phone: '' })
  })

  it('applies the persisted density as a data attribute before measuring spacing', async () => {
    window.localStorage.setItem(DENSITY_STORAGE_KEY, 'compact')
    resetDensityForTests()

    const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-title')

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe('compact')
    })
  })

  it('defaults to comfortable when no preference was saved', async () => {
    const router = createMemoryRouter(appRoutes, { initialEntries: ['/'] })
    render(<RouterProvider router={router} />)
    await screen.findByTestId('page-title')

    await waitFor(() => {
      expect(document.documentElement.dataset.density).toBe('comfortable')
    })
  })
})
