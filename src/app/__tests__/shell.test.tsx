import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { render } from '@testing-library/react'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { appRoutes } from '@/app/router'
import { saveOwner } from '@/lib/db/repositories/owners'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderApp(initialPath = '/') {
  const router = createMemoryRouter(appRoutes, { initialEntries: [initialPath] })
  return render(<RouterProvider router={router} />)
}

async function waitForShell(): Promise<void> {
  await screen.findByTestId('page-title')
}

describe('AppShell (M1)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    await resetDatabaseForTests()
    // M4 introduces the first-run takeover for an unnamed, pet-less household.
    // These are shell tests, so give the household a name (the gate then stays
    // closed); first-run has its own suite.
    await saveOwner({ name: 'Test Owner', email: '', phone: '' })
  })

  it('renders the six destinations with icons and the pinned owner footer', async () => {
    renderApp('/')
    await waitForShell()

    const destinations = ['dashboard', 'pets', 'appointments', 'vaccinations', 'records', 'journal']
    for (const key of destinations) {
      const navItem = screen.getByTestId(`nav-${key}`)
      expect(navItem).toBeInTheDocument()
      expect(navItem.querySelector('svg')).not.toBeNull()
    }

    expect(screen.getByTestId('nav-profile')).toHaveAttribute('href', '/profile')
    expect(screen.getByTestId('app-sidebar').getAttribute('data-state')).toBe('expanded')
    // The DB boot guarantees an owner row; the footer shows it live.
    await waitFor(() => {
      expect(screen.getByTestId('footer-owner-name')).toHaveTextContent('Test Owner')
    })
  })

  it('deep-links into the pet route and reloads its parameters', async () => {
    renderApp('/pets/demo-pet-bella/vaccinations')
    await waitForShell()

    const detail = await screen.findByTestId('pet-detail-route')
    expect(detail).toHaveAttribute('data-pet-id', 'demo-pet-bella')
    expect(detail).toHaveAttribute('data-pet-tab', 'vaccinations')
    expect(screen.getByTestId('page-title')).toHaveTextContent('Pet')
  })

  it('has no /settings route — Settings lives inside Profile', async () => {
    renderApp('/settings')
    await waitForShell()

    expect(await screen.findByTestId('not-found')).toBeInTheDocument()
    expect(screen.getByTestId('page-title')).toHaveTextContent('Page not found')
    expect(screen.getByTestId('app-sidebar')).toBeInTheDocument()
  })

  it('collapses to the rail on live resize 1440 → 1024 → 900 without losing Profile', async () => {
    renderApp('/')
    await waitForShell()
    const sidebar = screen.getByTestId('app-sidebar')
    expect(sidebar).toHaveAttribute('data-state', 'expanded')

    act(() => {
      window.innerWidth = 1024
      window.dispatchEvent(new Event('resize'))
    })
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'collapsed'))
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument()

    act(() => {
      window.innerWidth = 900
      window.dispatchEvent(new Event('resize'))
    })
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'collapsed'))
    // Below 1024 the rail is forced, so the expand trigger must not be offered.
    expect(screen.queryByTestId('sidebar-toggle')).not.toBeInTheDocument()
    expect(screen.getByTestId('nav-profile')).toBeInTheDocument()

    act(() => {
      window.innerWidth = 1440
      window.dispatchEvent(new Event('resize'))
    })
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'expanded'))
  })

  it('navigates with ⌘1–6 and toggles the rail with ⌘B', async () => {
    renderApp('/')
    await waitForShell()

    act(() => {
      fireEvent.keyDown(window, { key: '2', metaKey: true })
    })
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Pets'))

    act(() => {
      fireEvent.keyDown(window, { key: '6', metaKey: true })
    })
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Journal'))

    // Plain digits work outside fields (browser-reserved modified digits fallback).
    act(() => {
      fireEvent.keyDown(window, { key: '1' })
    })
    await waitFor(() => expect(screen.getByTestId('page-title')).toHaveTextContent('Dashboard'))

    const sidebar = screen.getByTestId('app-sidebar')
    act(() => {
      fireEvent.keyDown(window, { key: 'b', metaKey: true })
    })
    await waitFor(() => expect(sidebar).toHaveAttribute('data-state', 'collapsed'))
  })

  it('opens the simulated command-palette event for ⌘K without palette code', async () => {
    renderApp('/')
    await waitForShell()

    let fired = 0
    const listener = (): void => {
      fired += 1
    }
    window.addEventListener('pet-health:command-palette', listener)
    try {
      // Dispatch is synchronous, but the shell's keydown effect can land a tick
      // after `waitForShell()` on a slow CI runner — the first press would be
      // lost. Re-pressing inside `waitFor` is safe (it only increments a
      // counter) and removes the race without weakening the assertion.
      await waitFor(() => {
        act(() => {
          fireEvent.keyDown(window, { key: 'k', metaKey: true })
        })
        expect(fired).toBeGreaterThan(0)
      })
    } finally {
      window.removeEventListener('pet-health:command-palette', listener)
    }
    expect(fired).toBe(1)
  })
})
