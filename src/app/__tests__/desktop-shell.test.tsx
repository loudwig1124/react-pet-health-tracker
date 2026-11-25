import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { appRoutes } from '@/app/router'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] })
  render(<RouterProvider router={router} />)
  return router
}

async function waitForShell(): Promise<void> {
  await screen.findByTestId('page-title')
}

async function seed(): Promise<void> {
  await saveOwner({ name: 'Test Owner', email: '', phone: '' })
  await createPet({
    name: 'Bella',
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2022-01-01',
    weightKg: 12.4,
    microchip: null,
  })
}

describe('M5 desktop shell (F3/F4/F8)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    await resetDatabaseForTests()
    await seed()
  })

  it('⌘K mounts the lazy palette, focuses its input and Esc closes it', async () => {
    renderApp('/')
    await waitForShell()

    act(() => {
      fireEvent.keyDown(window, { key: 'k', metaKey: true })
    })
    const palette = await screen.findByTestId('command-palette')
    const input = await screen.findByTestId('command-input')
    await waitFor(() => expect(input).toHaveFocus())
    expect(within(palette).getByRole('listbox')).toBeInTheDocument()

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument())
  })

  it('the header Search button opens the same palette', async () => {
    renderApp('/')
    await waitForShell()

    fireEvent.click(screen.getByTestId('header-search'))
    expect(await screen.findByTestId('command-palette')).toBeInTheDocument()
  })

  it('? opens the shortcut sheet outside a field and does nothing while typing', async () => {
    renderApp('/pets')
    await waitForShell()

    act(() => {
      fireEvent.keyDown(window, { key: '?' })
    })
    const sheet = await screen.findByTestId('shortcut-sheet')
    expect(sheet).toHaveTextContent('Keyboard shortcuts')
    expect(sheet).toHaveTextContent('Search and commands')

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByTestId('shortcut-sheet')).not.toBeInTheDocument())

    const input = document.createElement('input')
    document.body.append(input)
    input.focus()
    act(() => {
      fireEvent.keyDown(input, { key: '?' })
    })
    expect(screen.queryByTestId('shortcut-sheet')).not.toBeInTheDocument()
    input.remove()
  })

  it('⌘N on /pets opens the Add pet dialog through the ?new=1 intent', async () => {
    const router = renderApp('/pets')
    await waitForShell()

    act(() => {
      fireEvent.keyDown(window, { key: 'n', metaKey: true })
    })
    expect(await screen.findByTestId('pet-form')).toBeInTheDocument()
    // The intent is consumed, so closing/reloading cannot re-open the dialog.
    await waitFor(() => expect(router.state.location.search).toBe(''))
  })

  it('plain N outside a field is the documented create alias', async () => {
    renderApp('/pets')
    await waitForShell()

    act(() => {
      fireEvent.keyDown(window, { key: 'n' })
    })
    expect(await screen.findByTestId('pet-form')).toBeInTheDocument()
  })
})
