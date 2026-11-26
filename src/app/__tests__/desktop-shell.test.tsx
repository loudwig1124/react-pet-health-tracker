import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/**
 * The accepted build has **no keyboard shortcuts**: the owner removed them all,
 * so every action must be reachable by mouse/click. These tests deliberately
 * never press a shortcut key; the final test proves the removed keys are inert.
 */
describe('desktop shell — mouse paths and no keyboard shortcuts', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    await resetDatabaseForTests()
    await seed()
  })

  it('opens the command palette from the Search button and navigates by clicking a result', async () => {
    const router = renderApp('/')
    await waitForShell()

    fireEvent.click(screen.getByTestId('header-search'))
    const palette = await screen.findByTestId('command-palette', undefined, {
      timeout: 5000,
    })
    expect(within(palette).getByTestId('command-input')).toHaveFocus()
    expect(within(palette).getByRole('listbox')).toBeInTheDocument()

    fireEvent.change(within(palette).getByTestId('command-input'), {
      target: { value: 'bella' },
    })
    const petItem = await screen.findByTestId(/^command-item-pet:/, undefined, {
      timeout: 5000,
    })
    fireEvent.click(petItem)

    await waitFor(() => expect(router.state.location.pathname).toMatch(/^\/pets\//))
    expect(await screen.findByTestId('page-title')).toHaveTextContent('Pet')
  })

  it('runs a palette create command by clicking it', async () => {
    renderApp('/')
    await waitForShell()

    fireEvent.click(screen.getByTestId('header-search'))
    const createGroup = await screen.findByTestId('command-group-create', undefined, {
      timeout: 5000,
    })
    fireEvent.click(within(createGroup).getByTestId('command-item-create:visit'))

    expect(await screen.findByTestId('booking-form')).toBeInTheDocument()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Appointments')
  })

  it('keeps navigation, the profile footer and the sidebar toggle clickable', async () => {
    renderApp('/')
    await waitForShell()

    fireEvent.click(screen.getByTestId('nav-pets'))
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Pets'))

    fireEvent.click(screen.getByTestId('nav-journal'))
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Journal'))

    fireEvent.click(screen.getByTestId('nav-profile'))
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Profile'))

    fireEvent.click(screen.getByTestId('nav-dashboard'))
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard'))

    const sidebar = screen.getByTestId('app-sidebar')
    fireEvent.click(screen.getByTestId('sidebar-toggle'))
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'collapsed'))
    fireEvent.click(screen.getByTestId('sidebar-toggle'))
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'expanded'))
  })

  it('no longer listens for any of the removed shortcut keys', async () => {
    const router = renderApp('/')
    await waitForShell()

    const removedKeys: readonly [string, KeyboardEventInit][] = [
      ['k', { metaKey: true }],
      ['1', { metaKey: true }],
      ['6', { metaKey: true }],
      ['1', {}],
      ['b', { metaKey: true }],
      [',', { metaKey: true }],
      ['?', {}],
      ['n', {}],
      ['n', { metaKey: true }],
    ]
    for (const [key, init] of removedKeys) {
      fireEvent.keyDown(window, { key, ...init })
    }

    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(screen.queryByTestId('command-palette')).not.toBeInTheDocument()
    expect(screen.queryByTestId('shortcut-sheet')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard')
    expect(screen.getByTestId('app-sidebar')).toHaveAttribute('data-state', 'expanded')
    expect(router.state.location.pathname).toBe('/')

    // The create alias is gone on a list screen too.
    fireEvent.click(screen.getByTestId('nav-pets'))
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Pets'))
    fireEvent.keyDown(window, { key: 'n' })
    fireEvent.keyDown(window, { key: 'n', metaKey: true })
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(screen.queryByTestId('pet-form')).not.toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/pets')
  })

  it('shows no shortcut affordances in the shell, sidebar or header', async () => {
    renderApp('/')
    await waitForShell()

    expect(screen.queryByTestId('header-shortcuts')).not.toBeInTheDocument()
    expect(document.body.textContent).not.toContain('⌘')
    expect(document.querySelectorAll('kbd')).toHaveLength(0)
    expect(screen.getByTestId('header-search')).toHaveAttribute('aria-label', 'Search and commands')
    expect(screen.getByTestId('sidebar-toggle').getAttribute('title')).toBe('Collapse sidebar')
    expect(screen.getByTestId('nav-pets').getAttribute('title')).toBeNull()
    await waitFor(() =>
      expect(screen.getByTestId('nav-profile')).toHaveAttribute(
        'aria-label',
        'Profile — Test Owner',
      ),
    )
  })

  it('gives the header and content one shared gutter with no centred width cap', async () => {
    renderApp('/pets')
    await waitForShell()

    const headerInner = screen.getByTestId('app-header').firstElementChild as HTMLElement
    const content = screen.getByTestId('app-content')

    for (const element of [headerInner, content]) {
      expect(element.className).toContain('px-[var(--page-gutter)]')
      expect(element.className).not.toMatch(/\bmx-auto\b/)
      expect(element.className).not.toContain('max-w-')
      expect(element.className).not.toContain('content-max')
    }
    // The rail toggle lives in the sidebar's brand row, so the header starts
    // with the page title and lines up with the cards below.
    expect(screen.queryByTestId('sidebar-toggle')).toBeInTheDocument()
    expect(headerInner.contains(screen.getByTestId('sidebar-toggle'))).toBe(false)
    expect(headerInner.firstElementChild).toBe(screen.getByTestId('page-title').parentElement)
  })
})
