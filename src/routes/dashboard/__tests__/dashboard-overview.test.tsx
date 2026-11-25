import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { createAppointment } from '@/lib/db/repositories/appointments'
import { createJournalEntry } from '@/lib/db/repositories/journal'
import { saveOwner } from '@/lib/db/repositories/owners'
import { createPet } from '@/lib/db/repositories/pets'
import { appendVaccination } from '@/lib/db/repositories/vaccinations'
import { addDays, todayKey } from '@/lib/rules/calendar'
import { DashboardPage } from '@/routes/dashboard/DashboardPage'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderDashboard() {
  return render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  )
}

const NOW = new Date()
const TODAY = todayKey(NOW)

interface SeededAttention {
  attentionBella: string
  attentionMiso: string
}

async function seedHousehold(): Promise<SeededAttention> {
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
  const miso = await createPet({
    name: 'Miso',
    species: 'Cat',
    breed: null,
    sex: 'unknown',
    dateOfBirth: '2023-01-01',
    weightKg: 4.2,
    microchip: null,
  })

  // Bella: current dose 35 days overdue.
  const bellaDose = await appendVaccination({
    petId: bella.id,
    vaccineTypeId: null,
    vaccineName: 'Rabies',
    vaccinationDate: addDays(TODAY, -400),
    nextDueDate: addDays(TODAY, -35),
    vetName: null,
  })
  // Miso: due in 10 days (inside the default 30-day window).
  const misoDose = await appendVaccination({
    petId: miso.id,
    vaccineTypeId: null,
    vaccineName: 'FeLV',
    vaccinationDate: addDays(TODAY, -355),
    nextDueDate: addDays(TODAY, 10),
    vetName: null,
  })

  await createAppointment(
    {
      petId: bella.id,
      clinicName: 'Paws & Claws',
      purpose: 'Annual wellness check',
      scheduledAt: new Date(NOW.getTime() + 3_600_000).toISOString(),
    },
    NOW,
  )
  await createAppointment(
    {
      petId: miso.id,
      clinicName: 'Paws & Claws',
      purpose: 'Dental cleaning',
      scheduledAt: new Date(NOW.getTime() + 7_200_000).toISOString(),
    },
    NOW,
  )

  await createJournalEntry(
    {
      petId: bella.id,
      kind: 'walk',
      occurredAt: NOW.toISOString(),
      note: 'Evening walk',
      durationMinutes: 30,
    },
    NOW,
  )
  await createJournalEntry(
    {
      petId: miso.id,
      kind: 'note',
      occurredAt: NOW.toISOString(),
      note: 'Slept all day',
      durationMinutes: null,
    },
    NOW,
  )

  return {
    attentionBella: bellaDose.id,
    attentionMiso: misoDose.id,
  }
}

describe('F1 dashboard overview (05 F1, 06 M5)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    await resetDatabaseForTests()
  })

  it('renders the four counters from the shared R1/R4 rules, with drill-down links', async () => {
    await seedHousehold()
    renderDashboard()

    const counters = await screen.findByTestId('dashboard-counters')
    expect(counters).toBeInTheDocument()

    const petsCounter = within(counters).getByTestId('counter-pets')
    const overdueCounter = within(counters).getByTestId('counter-overdue')
    const dueSoonCounter = within(counters).getByTestId('counter-due-soon')
    const visitsCounter = within(counters).getByTestId('counter-visits')

    expect(petsCounter).toHaveAttribute('data-count', '2')
    expect(petsCounter).toHaveAttribute('aria-label', '2 pets')
    expect(overdueCounter).toHaveAttribute('data-count', '1')
    expect(overdueCounter).toHaveAttribute('href', '/vaccinations?status=overdue')
    expect(overdueCounter).toHaveAttribute('aria-label', '1 overdue')
    expect(dueSoonCounter).toHaveAttribute('data-count', '1')
    expect(dueSoonCounter).toHaveAttribute('href', '/vaccinations?status=due_soon')
    expect(visitsCounter).toHaveAttribute('data-count', '2')
    expect(visitsCounter).toHaveAttribute('href', '/appointments?status=upcoming')

    // Number Ticker exposes the final value so the value is never motion-only.
    expect(within(petsCounter).getByTestId('counter-pets-value')).toHaveAttribute('data-value', '2')
    expect(overdueCounter).toHaveTextContent(/overdue/i)
  })

  it('labels the pets card once and gives each pet its R1 due chip', async () => {
    await seedHousehold()
    renderDashboard()

    const petsSection = await screen.findByRole('region', { name: 'Pets' })
    expect(within(petsSection).getByTestId('dashboard-pets-count')).toHaveTextContent('2')
    // One heading reading "Pets" + badge "2", never the old "Pets · 2 pets".
    expect(within(petsSection).getByRole('heading').textContent?.trim()).toBe('Pets')
    expect(within(petsSection).queryByText(/Pets ·/)).not.toBeInTheDocument()

    const rows = within(petsSection).getAllByTestId('due-badge')
    expect(rows.map((badge) => badge.getAttribute('data-status')).sort()).toEqual([
      'due_soon',
      'overdue',
    ])
    expect(petsSection).toHaveTextContent('Bella')
    expect(petsSection).toHaveTextContent('Miso')
  })

  it('lists the actual doses in the needs-attention rail, with per-row drill-downs', async () => {
    const ids = await seedHousehold()
    renderDashboard()

    const rail = await screen.findByTestId('attention-rail')
    const bellaRow = within(rail).getByTestId(`attention-row-${ids.attentionBella}`)
    const misoRow = within(rail).getByTestId(`attention-row-${ids.attentionMiso}`)

    expect(bellaRow).toHaveTextContent('Bella · Rabies')
    expect(bellaRow).toHaveTextContent('35 days overdue')
    expect(bellaRow).toHaveAttribute(
      'href',
      expect.stringContaining('/vaccinations?status=overdue&pet='),
    )
    expect(misoRow).toHaveTextContent('Miso · FeLV')
    expect(misoRow).toHaveTextContent('due in 10 days')
    expect(misoRow).toHaveAttribute(
      'href',
      expect.stringContaining('/vaccinations?status=due_soon&pet='),
    )
  })

  it('shows every visit on the earliest upcoming day, and the newest journal entries', async () => {
    await seedHousehold()
    renderDashboard()

    const nextVisit = await screen.findByTestId('next-visit')
    expect(nextVisit).toHaveTextContent('Annual wellness check')
    expect(nextVisit).toHaveTextContent('Dental cleaning')
    expect(nextVisit).toHaveTextContent('Bella')

    const recent = await screen.findByTestId('recent-journal')
    expect(within(recent).getAllByTestId(/recent-journal-row-/)).toHaveLength(2)
    expect(recent).toHaveTextContent('Evening walk')
  })

  it('renders the empty household as zeros plus the first-pet call to action', async () => {
    await saveOwner({ name: 'Daniel Reyes', email: '', phone: '' })
    renderDashboard()

    const counters = await screen.findByTestId('dashboard-counters')
    expect(within(counters).getByTestId('counter-pets')).toHaveAttribute('data-count', '0')
    expect(within(counters).getByTestId('counter-overdue')).toHaveAttribute('data-count', '0')
    expect(within(counters).getByTestId('counter-due-soon')).toHaveAttribute('data-count', '0')
    expect(within(counters).getByTestId('counter-visits')).toHaveAttribute('data-count', '0')

    expect(await screen.findByTestId('attention-empty')).toHaveTextContent(
      'Nothing needs attention',
    )
    expect(await screen.findByTestId('dashboard-pets-empty')).toBeInTheDocument()
    expect(await screen.findByTestId('recent-journal-empty')).toBeInTheDocument()
    expect(await screen.findByTestId('next-visit-empty')).toBeInTheDocument()
  })
})
