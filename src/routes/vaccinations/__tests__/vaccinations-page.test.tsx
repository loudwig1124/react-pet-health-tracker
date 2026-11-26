import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { Toaster } from '@/components/layout/Toaster'
import { createPet } from '@/lib/db/repositories/pets'
import { appendVaccination } from '@/lib/db/repositories/vaccinations'
import { seedVaccineCatalog, VACCINE_TYPE_IDS } from '@/lib/db/seed/catalog'
import { addDays, addMonths } from '@/lib/rules/calendar'
import type { PetDraft } from '@/lib/rules/types'
import { localToday } from '@/lib/schedule/format'
import { resetDatabaseForTests } from '@/test/db-utils'

import { VaccinationsPage } from '../VaccinationsPage'

function renderPage(search = ''): ReturnType<typeof render> {
  return render(
    <MemoryRouter initialEntries={[`/vaccinations${search}`]}>
      <Routes>
        <Route path="/vaccinations" element={<VaccinationsPage />} />
      </Routes>
      {/* The page raises toasts through the shell store, so the Toaster has to
          be mounted here for the Undo affordance to exist. */}
      <Toaster />
    </MemoryRouter>,
  )
}

function petDraft(name: string, microchip: string | null = null): PetDraft {
  return {
    name,
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip,
  }
}

const TODAY = localToday()

async function seedOverduePet(name = 'Bella'): Promise<{ petId: string; doseId: string }> {
  const pet = await createPet(petDraft(name))
  const due = addDays(TODAY, -10)
  const dose = await appendVaccination(
    {
      petId: pet.id,
      vaccineTypeId: VACCINE_TYPE_IDS.rabies,
      vaccineName: 'Rabies',
      vaccinationDate: addDays(due, -365),
      nextDueDate: due,
      vetName: null,
    },
    new Date(Date.now() - 86_400_000),
  )
  return { petId: pet.id, doseId: dose.id }
}

beforeEach(async () => {
  window.localStorage.clear()
  await resetDatabaseForTests()
  await seedVaccineCatalog()
})

describe('/vaccinations (M3)', () => {
  it('R1: a re-vaccinated pet leaves the overdue filter while its old dose stays as history', async () => {
    const { petId, doseId } = await seedOverduePet()
    const page = renderPage('?status=overdue')

    const row = await screen.findByTestId(`vaccination-row-${doseId}`)
    expect(within(row).getByTestId('due-chip-overdue')).toHaveAttribute(
      'data-due-status',
      'overdue',
    )

    // A booster (newest dose for the same vaccine) lands while the screen is open (R10).
    await appendVaccination(
      {
        petId,
        vaccineTypeId: VACCINE_TYPE_IDS.rabies,
        vaccineName: 'Rabies',
        vaccinationDate: addDays(TODAY, -1),
        nextDueDate: addDays(TODAY, 200),
        vetName: null,
      },
      new Date(),
    )

    // The pet is no longer overdue, so the filtered view has nothing left — the
    // old row must not keep the pet in the overdue state (the fixed D2/Q2 bug).
    await waitFor(() => {
      expect(screen.getByTestId('vaccinations-filter-empty')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('vaccinations-table')).not.toBeInTheDocument()
    expect(screen.queryByTestId('due-chip-overdue')).not.toBeInTheDocument()
    page.unmount()

    // The re-vaccinated pet is now up to date in the household view.
    const view = renderPage('?status=up_to_date')
    const rows = await view.findAllByTestId(/^vaccination-row-/)
    expect(rows).toHaveLength(2)
    expect(within(rows[1] as HTMLElement).getByTestId('due-chip-superseded')).toBeInTheDocument()
  })

  it('expresses the pet hand-off as ?pet=<id> and as ?pet=all', async () => {
    const bella = await seedOverduePet('Bella')
    const miso = await seedOverduePet('Miso')

    const all = renderPage('?pet=all')
    await all.findByTestId('vaccinations-table')
    expect(all.getAllByTestId(/^vaccination-row-/)).toHaveLength(2)
    expect(
      (within(all.container).getByTestId('vaccinations-filter-pet') as HTMLSelectElement).value,
    ).toBe('all')
    all.unmount()

    const one = renderPage(`?pet=${bella.petId}`)
    const bellaRow = await one.findByTestId(`vaccination-row-${bella.doseId}`)
    expect(bellaRow).toBeInTheDocument()
    expect(one.getAllByTestId(/^vaccination-row-/)).toHaveLength(1)
    expect(one.queryByTestId(`vaccination-row-${miso.doseId}`)).not.toBeInTheDocument()
  })

  it('prefills the next due date from the catalog interval and saves a dose', async () => {
    const { petId, doseId } = await seedOverduePet()
    renderPage(`?pet=${petId}`)
    await screen.findByTestId(`vaccination-row-${doseId}`)

    fireEvent.click(screen.getByTestId(`vaccination-add-dose-${doseId}`))
    const form = await screen.findByTestId('vaccination-form')
    expect(form).toBeInTheDocument()

    const nextDue = within(form).getByTestId('vaccination-next-due') as HTMLInputElement
    // Rabies' catalog interval is 12 months; the given date defaults to today.
    expect(nextDue.value).toBe(addMonths(TODAY, 12))

    fireEvent.change(within(form).getByTestId('vaccination-vet'), {
      target: { value: 'Dr Ramos' },
    })
    fireEvent.click(within(form).getByTestId('vaccination-submit'))

    await waitFor(() => {
      expect(screen.getAllByTestId(/^vaccination-row-/)).toHaveLength(2)
    })
    expect(screen.getByTestId('vaccinations-announcement')).toHaveTextContent('Vaccination added')
  })

  it('corrects a misclicked dose from the row and re-derives the status', async () => {
    const { petId, doseId } = await seedOverduePet()
    renderPage(`?pet=${petId}`)

    const row = await screen.findByTestId(`vaccination-row-${doseId}`)
    expect(within(row).getByTestId('due-chip-overdue')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId(`vaccination-edit-${doseId}`))
    const form = await screen.findByTestId('vaccination-form')
    // Prefilled from the stored dose, not from today's defaults.
    const given = within(form).getByTestId('vaccination-date') as HTMLInputElement
    expect(given.value).toBe(addDays(TODAY, -375))

    // The misclick was the year; correcting it clears the overdue status.
    fireEvent.change(given, { target: { value: localToday() } })
    fireEvent.click(within(form).getByTestId('vaccination-submit'))

    await waitFor(() => {
      expect(screen.getByTestId('vaccinations-announcement')).toHaveTextContent(
        'Vaccination updated',
      )
    })
    await waitFor(() => {
      expect(screen.queryByTestId('due-chip-overdue')).not.toBeInTheDocument()
    })
  })

  it('deletes a dose only after the second confirmation click', async () => {
    const { petId, doseId } = await seedOverduePet()
    renderPage(`?pet=${petId}`)
    await screen.findByTestId(`vaccination-row-${doseId}`)

    fireEvent.click(screen.getByTestId(`vaccination-edit-${doseId}`))
    const deleteButton = await screen.findByTestId('vaccination-delete')

    // First click only arms the confirmation: the row must still exist.
    fireEvent.click(deleteButton)
    expect(deleteButton).toHaveTextContent('Delete permanently?')
    expect(screen.getByTestId(`vaccination-row-${doseId}`)).toBeInTheDocument()

    fireEvent.click(deleteButton)
    await waitFor(() => {
      expect(screen.queryByTestId(`vaccination-row-${doseId}`)).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('vaccinations-announcement')).toHaveTextContent('Vaccination deleted')
  })

  it('offers Undo after a dose is recorded', async () => {
    const { petId, doseId } = await seedOverduePet()
    renderPage(`?pet=${petId}`)
    await screen.findByTestId(`vaccination-row-${doseId}`)

    fireEvent.click(screen.getByTestId(`vaccination-add-dose-${doseId}`))
    const form = await screen.findByTestId('vaccination-form')
    fireEvent.click(within(form).getByTestId('vaccination-submit'))

    const undo = await screen.findByTestId('vaccination-undo')
    fireEvent.click(undo)
    await waitFor(() => {
      expect(screen.getAllByTestId(/^vaccination-row-/)).toHaveLength(1)
    })
  })

  it('shows the empty state for a household without doses', async () => {
    await createPet(petDraft('Bella'))
    renderPage()
    expect(await screen.findByTestId('vaccinations-empty')).toHaveTextContent(
      'No vaccinations recorded yet',
    )
  })
})
