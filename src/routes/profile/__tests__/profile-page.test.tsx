import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { FIRST_RUN_REQUEST_KEY, resetFirstRunStateForTests } from '@/app/first-run-state'
import { Toaster } from '@/components/layout/Toaster'
import { getOwner, saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { listPets } from '@/lib/db/repositories/pets'
import { loadSettings } from '@/lib/db/settings'
import { DENSITY_STORAGE_KEY, resetDensityForTests } from '@/lib/density'
import { DUE_SOON_WINDOW_OPTIONS } from '@/lib/rules/settings'
import { resetToastsForTests } from '@/lib/toast'
import { ProfilePage } from '@/routes/profile/ProfilePage'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderProfile() {
  return render(
    <MemoryRouter>
      <ProfilePage />
      <Toaster />
    </MemoryRouter>,
  )
}

async function seedHousehold() {
  await saveOwner({ name: 'Daniel Reyes', email: 'daniel@example.com', phone: '+63 917 555 0100' })
  return createPet({
    name: 'Coco',
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 8.1,
    microchip: null,
  })
}

describe('/profile (M4)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    window.sessionStorage.clear()
    resetDensityForTests()
    resetFirstRunStateForTests()
    await resetDatabaseForTests()
    await seedHousehold()
  })

  afterEach(() => {
    resetToastsForTests()
  })

  it('renders owner, pets summary, the preference rows and live counts', async () => {
    renderProfile()

    expect(await screen.findByTestId('profile-owner-name')).toHaveTextContent('Daniel Reyes')
    expect(screen.getByTestId('profile-page')).toBeInTheDocument()
    expect(screen.getByTestId('profile-owner-email')).toHaveTextContent('daniel@example.com')
    expect(screen.getByTestId('profile-pets')).toHaveTextContent('Coco')

    for (const testId of [
      'settings-window',
      'settings-units',
      'settings-density',
      'settings-sample-toggle',
      'settings-reset',
    ]) {
      expect(screen.getByTestId(testId)).toBeInTheDocument()
    }
    expect(screen.getByTestId('settings-window')).toHaveValue('30')
    expect(screen.getByTestId('settings-units')).toHaveValue('kg')
    expect(screen.getByTestId('settings-sample-toggle')).not.toBeChecked()
    expect(screen.getByTestId('profile-version')).toHaveTextContent(
      'Version 0.1.0 · 1 pet · 0 records',
    )
  })

  it('persists the due-soon window and the density preference', async () => {
    renderProfile()
    await screen.findByTestId('settings-window')

    expect(DUE_SOON_WINDOW_OPTIONS).toContain(14)
    await userEvent.selectOptions(screen.getByTestId('settings-window'), '14')
    await waitFor(() => {
      expect(loadSettings().dueSoonWindowDays).toBe(14)
    })

    await userEvent.click(screen.getByRole('radio', { name: 'Compact' }))
    await waitFor(() => {
      expect(window.localStorage.getItem(DENSITY_STORAGE_KEY)).toBe('compact')
    })
  })

  it('keeps the stored email and phone when only the owner name changes', async () => {
    renderProfile()
    await screen.findByTestId('profile-owner-edit')

    await userEvent.click(screen.getByTestId('profile-owner-edit'))
    const name = await screen.findByLabelText('Name')
    await userEvent.clear(name)
    await userEvent.type(name, 'Dana Reyes')
    await userEvent.click(screen.getByTestId('profile-owner-save'))

    await waitFor(async () => {
      expect((await getOwner())?.name).toBe('Dana Reyes')
    })
    const owner = await getOwner()
    expect(owner?.email).toBe('daniel@example.com')
    expect(owner?.phone).toBe('+63 917 555 0100')
    expect(await screen.findByTestId('profile-owner-name')).toHaveTextContent('Dana Reyes')
  })

  it('toggles the sample household without touching user rows', async () => {
    renderProfile()
    await screen.findByTestId('settings-sample-toggle')

    await userEvent.click(screen.getByTestId('settings-sample-toggle'))
    await waitFor(async () => {
      expect((await listPets()).length).toBe(3)
    })
    const withDemo = await listPets()
    expect(withDemo.map((pet) => pet.name)).toEqual(['Bella', 'Coco', 'Miso'])
    expect(loadSettings().sampleDataEnabled).toBe(true)

    await userEvent.click(screen.getByTestId('settings-sample-toggle'))
    await waitFor(async () => {
      expect((await listPets()).map((pet) => pet.name)).toEqual(['Coco'])
    })
    expect(loadSettings().sampleDataEnabled).toBe(false)
  })

  it('keeps the owner name on a reset without the forget option', async () => {
    renderProfile()
    await screen.findByTestId('settings-reset')

    await userEvent.click(screen.getByTestId('settings-reset'))
    await userEvent.click(await screen.findByTestId('settings-reset-confirm'))

    await waitFor(async () => {
      expect(await listPets()).toEqual([])
    })
    const owner = await getOwner()
    expect(owner?.name).toBe('Daniel Reyes')
    expect(owner?.email).toBe('daniel@example.com')
    expect(window.sessionStorage.getItem(FIRST_RUN_REQUEST_KEY)).toBe('1')
  })

  it('resets the household with the forget-details option and returns to first run', async () => {
    renderProfile()
    await screen.findByTestId('settings-reset')

    await userEvent.click(screen.getByTestId('settings-reset'))
    await userEvent.click(await screen.findByTestId('settings-reset-forget'))
    await userEvent.click(screen.getByTestId('settings-reset-confirm'))

    await waitFor(async () => {
      expect(await listPets()).toEqual([])
    })
    const owner = await getOwner()
    expect(owner?.name).toBe('My household')
    expect(owner?.email).toBe('')
    expect(window.sessionStorage.getItem(FIRST_RUN_REQUEST_KEY)).toBe('1')
    expect(loadSettings().sampleDataEnabled).toBe(false)
  })
})
