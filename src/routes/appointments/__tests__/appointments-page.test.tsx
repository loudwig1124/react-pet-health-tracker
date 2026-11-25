import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { createAppointment } from '@/lib/db/repositories/appointments'
import { createPet } from '@/lib/db/repositories/pets'
import { addDays } from '@/lib/rules/calendar'
import type { PetDraft } from '@/lib/rules/types'
import { formatDateKey, instantFromLocalDateTime, localToday } from '@/lib/schedule/format'
import { resetDatabaseForTests } from '@/test/db-utils'

import { AppointmentsPage } from '../AppointmentsPage'

function renderPage(search = ''): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/appointments${search}`]}>
      <Routes>
        <Route path="/appointments" element={<AppointmentsPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function petDraft(name: string): PetDraft {
  return {
    name,
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip: null,
  }
}

const TODAY = localToday()

async function seedUpcomingVisits(): Promise<{
  bellaId: string
  misoId: string
  bellaVisit: string
  misoVisit: string
}> {
  const bella = await createPet(petDraft('Bella'))
  const miso = await createPet(petDraft('Miso'))
  const bellaVisit = await createAppointment({
    petId: bella.id,
    clinicName: 'Paws & Claws',
    purpose: 'Annual wellness check',
    scheduledAt: instantFromLocalDateTime(addDays(TODAY, 2), '09:30'),
  })
  const misoVisit = await createAppointment({
    petId: miso.id,
    clinicName: 'City Vets',
    purpose: 'Dental cleaning',
    scheduledAt: instantFromLocalDateTime(addDays(TODAY, 3), '10:00'),
  })
  return {
    bellaId: bella.id,
    misoId: miso.id,
    bellaVisit: bellaVisit.id,
    misoVisit: misoVisit.id,
  }
}

beforeEach(async () => {
  window.localStorage.clear()
  await resetDatabaseForTests()
})

describe('/appointments (M3)', () => {
  it('expresses the pet hand-off as ?pet=<id> and as ?pet=all', async () => {
    const seeded = await seedUpcomingVisits()

    const all = renderPage('?status=upcoming&pet=all')
    await all.findByTestId(`appointment-row-${seeded.bellaVisit}`)
    expect(all.getAllByTestId(/^appointment-row-/)).toHaveLength(2)
    expect(
      (within(all.container).getByTestId('appointments-filter-pet') as HTMLSelectElement).value,
    ).toBe('all')
    all.unmount()

    const one = renderPage(`?status=upcoming&pet=${seeded.bellaId}`)
    await one.findByTestId(`appointment-row-${seeded.bellaVisit}`)
    expect(one.getAllByTestId(/^appointment-row-/)).toHaveLength(1)
    expect(one.queryByTestId(`appointment-row-${seeded.misoVisit}`)).not.toBeInTheDocument()
    one.unmount()

    // No `pet` parameter at all also means every pet (the default household view).
    const household = renderPage('?status=upcoming')
    await household.findByTestId(`appointment-row-${seeded.misoVisit}`)
    expect(household.getAllByTestId(/^appointment-row-/)).toHaveLength(2)
  })

  it('restores the sort from the URL', async () => {
    await seedUpcomingVisits()
    renderPage('?status=upcoming&sort=pet&dir=asc')
    const rows = await screen.findAllByTestId(/^appointment-row-/)
    expect(within(rows[0] as HTMLElement).getByText('Bella')).toBeInTheDocument()
    expect(within(rows[1] as HTMLElement).getByText('Miso')).toBeInTheDocument()
  })

  it('loads the calendar only for the calendar view', async () => {
    await seedUpcomingVisits()

    const table = renderPage('?status=upcoming&view=table')
    await table.findByTestId('appointments-table')
    expect(table.queryByTestId('appointments-calendar')).not.toBeInTheDocument()
    table.unmount()

    const calendar = renderPage('?status=upcoming&view=calendar')
    expect(await calendar.findByTestId('appointments-calendar')).toBeInTheDocument()
    expect(calendar.getByTestId('appointments-table')).toBeInTheDocument()
  })

  it('books a visit through the dialog and shows it in the upcoming table', async () => {
    await createPet(petDraft('Bella'))
    renderPage()

    expect(await screen.findByTestId('appointments-empty')).toHaveTextContent(
      'No visits booked yet',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Book visit' }))
    const form = await screen.findByTestId('booking-form')

    fireEvent.change(within(form).getByTestId('booking-clinic'), {
      target: { value: 'Paws & Claws' },
    })
    fireEvent.change(within(form).getByTestId('booking-purpose'), {
      target: { value: 'Annual wellness check' },
    })
    fireEvent.click(within(form).getByTestId('booking-submit'))

    await waitFor(() => {
      expect(screen.getAllByTestId(/^appointment-row-/)).toHaveLength(1)
    })
    expect(screen.getByTestId('appointments-announcement')).toHaveTextContent(
      'Visit booked for Bella',
    )
  })

  it('filters the table by the day in the URL', async () => {
    const seeded = await seedUpcomingVisits()
    const page = renderPage(`?status=upcoming&day=${addDays(TODAY, 2)}`)
    await page.findByTestId(`appointment-row-${seeded.bellaVisit}`)
    expect(page.queryByTestId(`appointment-row-${seeded.misoVisit}`)).not.toBeInTheDocument()
    expect(page.getByTestId('appointments-day-chip')).toHaveTextContent(
      formatDateKey(addDays(TODAY, 2)),
    )
  })

  it('keeps the month calendar visible even when there are no visits', async () => {
    await createPet(petDraft('Bella'))
    renderPage('?view=calendar')
    expect(await screen.findByTestId('appointments-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('appointments-empty')).toHaveTextContent('No visits booked yet')
  })

  it('moves a completed visit to Past and leaves no further action', async () => {
    const seeded = await seedUpcomingVisits()
    const page = renderPage('?status=upcoming')
    await page.findByTestId(`appointment-row-${seeded.bellaVisit}`)

    fireEvent.click(page.getByTestId(`appointment-actions-${seeded.bellaVisit}`))
    fireEvent.click(await page.findByTestId(`appointment-complete-${seeded.bellaVisit}`))

    await waitFor(
      () => {
        expect(page.getByTestId(`appointment-row-${seeded.bellaVisit}`)).toHaveAttribute(
          'data-status',
          'completed',
        )
      },
      { timeout: 3000 },
    )
    expect(page.queryByTestId(`appointment-actions-${seeded.bellaVisit}`)).not.toBeInTheDocument()
  })

  it('shows the empty state for a household without pets', async () => {
    renderPage()
    expect(await screen.findByTestId('appointments-empty')).toHaveTextContent('No pets yet')
  })
})
