import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { AppProviders } from '@/app/providers'
import { SidebarAttentionBadge } from '@/components/layout/SidebarAttentionBadge'
import { createAppointment } from '@/lib/db/repositories/appointments'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { appendVaccination } from '@/lib/db/repositories/vaccinations'
import { addDays, todayKey } from '@/lib/rules/calendar'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderBadges() {
  return render(
    <MemoryRouter>
      <AppProviders>
        <SidebarAttentionBadge kind="vaccinations" />
        <SidebarAttentionBadge kind="appointments" />
      </AppProviders>
    </MemoryRouter>,
  )
}

describe('F2 sidebar attention counts (05 F2, 06 M5)', () => {
  beforeEach(async () => {
    window.localStorage.clear()
    await resetDatabaseForTests()
    await saveOwner({ name: 'Daniel Reyes', email: '', phone: '' })
  })

  it('shows the pet count split into overdue and due soon, live from Dexie', async () => {
    const pet = await createPet({
      name: 'Bella',
      species: 'Dog',
      breed: null,
      sex: 'female',
      dateOfBirth: '2022-01-01',
      weightKg: 12.4,
      microchip: null,
    })
    const today = todayKey(new Date())
    await appendVaccination({
      petId: pet.id,
      vaccineTypeId: null,
      vaccineName: 'Rabies',
      vaccinationDate: addDays(today, -400),
      nextDueDate: addDays(today, -5),
      vetName: null,
    })
    await appendVaccination({
      petId: pet.id,
      vaccineTypeId: null,
      vaccineName: 'DHPP',
      vaccinationDate: addDays(today, -360),
      nextDueDate: addDays(today, 10),
      vetName: null,
    })

    renderBadges()

    const badge = await screen.findByTestId('nav-badge-vaccinations')
    expect(badge).toHaveAttribute('data-count', '2')
    expect(badge).toHaveTextContent('2')
    expect(badge).toHaveAttribute('title', '1 overdue · 1 due soon')
    // No appointment is scheduled, so the appointments badge stays hidden.
    expect(screen.queryByTestId('nav-badge-appointments')).not.toBeInTheDocument()
  })

  it('shows today’s scheduled visit count and hides every zero', async () => {
    const pet = await createPet({
      name: 'Miso',
      species: 'Cat',
      breed: null,
      sex: 'unknown',
      dateOfBirth: '2023-01-01',
      weightKg: 4.2,
      microchip: null,
    })
    await createAppointment({
      petId: pet.id,
      clinicName: 'Paws & Claws',
      purpose: 'Dental cleaning',
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    })

    renderBadges()

    const badge = await screen.findByTestId('nav-badge-appointments')
    expect(badge).toHaveAttribute('data-count', '1')
    expect(badge).toHaveAttribute('title', '1 visit booked today')
    // No dose needs attention, so the vaccinations badge renders nothing.
    await waitFor(() =>
      expect(screen.queryByTestId('nav-badge-vaccinations')).not.toBeInTheDocument(),
    )
  })

  it('renders a 16 px counter in the rail variant instead of a colour-only dot', async () => {
    const pet = await createPet({
      name: 'Coco',
      species: 'Dog',
      breed: null,
      sex: 'male',
      dateOfBirth: '2024-01-01',
      weightKg: 8.1,
      microchip: null,
    })
    await createAppointment({
      petId: pet.id,
      clinicName: 'Paws & Claws',
      purpose: 'Boosters',
      scheduledAt: new Date(Date.now() + 7_200_000).toISOString(),
    })

    render(
      <MemoryRouter>
        <AppProviders>
          <SidebarAttentionBadge kind="appointments" rail />
        </AppProviders>
      </MemoryRouter>,
    )

    const badge = await screen.findByTestId('nav-badge-appointments')
    expect(badge).toHaveTextContent('1')
    expect(badge.className).toContain('absolute')
    expect(badge.getAttribute('aria-label')).toBe('1 visit booked today')
  })
})
