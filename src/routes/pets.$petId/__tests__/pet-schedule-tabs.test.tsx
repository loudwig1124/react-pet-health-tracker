import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { createAppointment, updateAppointmentStatus } from '@/lib/db/repositories/appointments'
import { createPet } from '@/lib/db/repositories/pets'
import { appendVaccination } from '@/lib/db/repositories/vaccinations'
import { seedVaccineCatalog, VACCINE_TYPE_IDS } from '@/lib/db/seed/catalog'
import { addDays } from '@/lib/rules/calendar'
import type { Pet, PetDraft, Vaccination } from '@/lib/rules/types'
import { instantFromLocalDateTime, localToday } from '@/lib/schedule/format'
import { resetDatabaseForTests } from '@/test/db-utils'

import { PetAppointmentsTab } from '../AppointmentsTab'
import { PetDetailPage } from '../page'
import { PetVaccinationsTab } from '../VaccinationsTab'

const TODAY = localToday()

function petDraft(name: string): PetDraft {
  return {
    name,
    species: name === 'Miso' ? 'Cat' : 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2022-05-01',
    weightKg: 8.1,
    microchip: null,
  }
}

async function seedPet(name: string): Promise<Pet> {
  return createPet(petDraft(name))
}

function renderTab(element: React.ReactElement, search = ''): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/pets/pet-1/tab${search}`]}>{element}</MemoryRouter>,
  )
}

function dueChipIn(row: HTMLElement, testId: string): HTMLElement {
  return within(row).getByTestId(testId)
}

beforeEach(async () => {
  window.localStorage.clear()
  await resetDatabaseForTests()
  await seedVaccineCatalog()
})

describe('pet detail Vaccinations tab (M2/M3 reuse)', () => {
  it('lists only this pet’s doses with the shared R1 chips, including history', async () => {
    const bella = await seedPet('Bella')
    const miso = await seedPet('Miso')
    const oldDose: Vaccination = await appendVaccination(
      {
        petId: bella.id,
        vaccineTypeId: VACCINE_TYPE_IDS.rabies,
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -400),
        nextDueDate: addDays(TODAY, -10),
        vetName: null,
      },
      new Date(Date.now() - 120_000),
    )
    const booster: Vaccination = await appendVaccination(
      {
        petId: bella.id,
        vaccineTypeId: VACCINE_TYPE_IDS.rabies,
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -1),
        nextDueDate: addDays(TODAY, 200),
        vetName: null,
      },
      new Date(Date.now() - 60_000),
    )
    const misoDose: Vaccination = await appendVaccination({
      petId: miso.id,
      vaccineTypeId: VACCINE_TYPE_IDS.felv,
      vaccineName: 'FeLV',
      vaccinationDate: addDays(TODAY, -30),
      nextDueDate: addDays(TODAY, -5),
      vetName: null,
    })

    const page = renderTab(<PetVaccinationsTab pet={bella} />)

    const oldRow = await screen.findByTestId(`vaccination-row-${oldDose.id}`)
    const boosterRow = await screen.findByTestId(`vaccination-row-${booster.id}`)
    // A re-vaccinated pet's old dose is history, never an overdue chip (R1/D2).
    expect(dueChipIn(oldRow, 'due-chip-superseded')).toBeInTheDocument()
    expect(dueChipIn(boosterRow, 'due-chip-up_to_date')).toBeInTheDocument()

    expect(screen.queryByTestId(`vaccination-row-${misoDose.id}`)).not.toBeInTheDocument()
    expect(screen.getAllByTestId(/^vaccination-row-/)).toHaveLength(2)
    expect(screen.getByTestId('pet-vaccinations-count')).toHaveTextContent('2 doses for Bella')
    page.unmount()
  })

  it('shows a pet-scoped empty state and prefills the add-dose dialog to this pet', async () => {
    const rex = await seedPet('Rex')

    renderTab(<PetVaccinationsTab pet={rex} />)

    const empty = await screen.findByTestId('pet-vaccinations-empty')
    expect(empty).toHaveTextContent('No doses recorded for Rex yet')
    expect(screen.queryByText('No pets yet')).not.toBeInTheDocument()
    expect(screen.queryByText('No vaccinations recorded yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('pet-vaccinations-empty-add'))
    const form = await screen.findByTestId('vaccination-form')
    const petSelect = within(form).getByTestId('vaccination-pet') as HTMLSelectElement
    expect(petSelect.value).toBe(rex.id)
    expect(petSelect.options).toHaveLength(1)
    // The catalog prefill still comes from the M3 dialog (Rabies, 12 months).
    expect((within(form).getByTestId('vaccination-next-due') as HTMLInputElement).value).not.toBe(
      '',
    )

    fireEvent.click(within(form).getByTestId('vaccination-submit'))
    await screen.findByTestId(/^vaccination-row-/)
    expect(await screen.findByTestId('pet-vaccinations-announcement')).toHaveTextContent(
      'Vaccination added for Rex.',
    )
  })
})

describe('pet detail Appointments tab (M2/M3 reuse)', () => {
  it('segments this pet’s upcoming and past visits and never leaks another pet', async () => {
    const bella = await seedPet('Bella')
    const miso = await seedPet('Miso')
    const upcoming = await createAppointment({
      petId: bella.id,
      clinicName: 'Paws & Claws',
      purpose: 'Annual wellness check',
      scheduledAt: instantFromLocalDateTime(addDays(TODAY, 2), '09:30'),
    })
    const completed = await createAppointment({
      petId: bella.id,
      clinicName: 'Paws & Claws',
      purpose: 'Dental cleaning',
      scheduledAt: instantFromLocalDateTime(addDays(TODAY, -10), '14:00'),
    })
    await updateAppointmentStatus(completed.id, 'completed', { now: new Date() })
    const otherPet = await createAppointment({
      petId: miso.id,
      clinicName: 'City Vets',
      purpose: 'Six-month check',
      scheduledAt: instantFromLocalDateTime(addDays(TODAY, 3), '10:00'),
    })

    renderTab(<PetAppointmentsTab pet={bella} />)

    await screen.findByTestId(`appointment-row-${upcoming.id}`)
    expect(screen.getByTestId('pet-appointments-count')).toHaveTextContent('2 visits for Bella')
    expect(screen.queryByTestId(`appointment-row-${otherPet.id}`)).not.toBeInTheDocument()
    expect(screen.queryByTestId(`appointment-row-${completed.id}`)).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('pet-appointments-status-past'))
    expect(await screen.findByTestId(`appointment-row-${completed.id}`)).toBeInTheDocument()
    expect(screen.queryByTestId(`appointment-row-${upcoming.id}`)).not.toBeInTheDocument()
  })

  it('shows a pet-scoped empty state and preselects this pet when booking', async () => {
    const rex = await seedPet('Rex')

    renderTab(<PetAppointmentsTab pet={rex} />)

    const empty = await screen.findByTestId('pet-appointments-empty')
    expect(empty).toHaveTextContent('No visits for Rex yet')
    expect(screen.queryByText('No visits booked yet')).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('pet-appointments-empty-book'))
    const form = await screen.findByTestId('booking-form')
    const petSelect = within(form).getByTestId('booking-pet') as HTMLSelectElement
    expect(petSelect.value).toBe(rex.id)
    expect(petSelect.options).toHaveLength(1)
  })
})

describe('pet detail tab wiring', () => {
  function renderDetail(petId: string, tab: string): ReturnType<typeof render> {
    return render(
      <MemoryRouter initialEntries={[`/pets/${petId}/${tab}`]}>
        <Routes>
          <Route path="/pets/:petId/:tab?" element={<PetDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('renders the M3 tab panels with the correct tab active', async () => {
    const rex = await seedPet('Rex')

    const page = renderDetail(rex.id, 'vaccinations')
    await screen.findByTestId('pet-panel-vaccinations')
    expect(screen.getByTestId('pet-tab-vaccinations')).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByTestId('pet-vaccinations-empty')).toHaveTextContent(
      'No doses recorded for Rex yet',
    )
    expect(screen.getByTestId('pet-detail-route')).toHaveAttribute('data-pet-tab', 'vaccinations')
    page.unmount()

    renderDetail(rex.id, 'appointments')
    await screen.findByTestId('pet-panel-appointments')
    expect(screen.getByTestId('pet-tab-appointments')).toHaveAttribute('aria-selected', 'true')
    expect(await screen.findByTestId('pet-appointments-empty')).toHaveTextContent(
      'No visits for Rex yet',
    )
  })
})
