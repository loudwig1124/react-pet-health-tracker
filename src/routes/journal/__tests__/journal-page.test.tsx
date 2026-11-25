import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it } from 'vitest'

import { Toaster } from '@/components/layout/Toaster'
import { createJournalEntry, listJournal } from '@/lib/db/repositories/journal'
import { createPet } from '@/lib/db/repositories/pets'
import { todayKey } from '@/lib/rules/calendar'
import { JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import type { JournalEntry, Pet } from '@/lib/rules/types'
import { JournalPage } from '@/routes/journal/JournalPage'
import { resetDatabaseForTests } from '@/test/db-utils'

function renderJournal(initialPath = '/journal') {
  const router = createMemoryRouter([{ path: '/journal', element: <JournalPage /> }], {
    initialEntries: [initialPath],
  })
  return render(
    <>
      <RouterProvider router={router} />
      <Toaster />
    </>,
  )
}

async function seedPet(name = 'Bella'): Promise<Pet> {
  return createPet({
    name,
    species: 'Dog',
    breed: null,
    sex: 'female',
    dateOfBirth: '2022-01-01',
    weightKg: 12.4,
    microchip: null,
  })
}

async function seedEntry(petId: string, overrides: Partial<JournalEntry> = {}) {
  return createJournalEntry({
    petId,
    kind: 'walk',
    occurredAt: new Date(2026, 10, 26, 7, 10, 0, 0).toISOString(),
    note: 'Morning loop',
    durationMinutes: 30,
    ...overrides,
  })
}

describe('/journal (M4)', () => {
  beforeEach(async () => {
    window.innerWidth = 1440
    window.localStorage.clear()
    window.sessionStorage.clear()
    await resetDatabaseForTests()
  })

  it('creates an entry and Undo removes it again', async () => {
    await seedPet()
    renderJournal()

    const editor = await screen.findByTestId('journal-editor')
    expect(editor).toHaveAttribute('data-mode', 'inline')
    expect(await screen.findByTestId('journal-empty')).toHaveTextContent('Nothing logged yet')

    await userEvent.type(screen.getByLabelText('Notes'), 'Evening loop')
    await userEvent.click(screen.getByTestId('journal-save'))

    let entry: JournalEntry | undefined
    await waitFor(() => {
      expect(document.querySelector('[data-testid^="journal-entry-"]')).not.toBeNull()
    })
    entry = (await listJournal())[0]
    expect(entry?.note).toBe('Evening loop')
    expect(await screen.findByTestId('journal-undo')).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('journal-undo'))
    await waitFor(() => {
      expect(document.querySelector('[data-testid^="journal-entry-"]')).toBeNull()
    })
    expect(await listJournal()).toEqual([])
  })

  it('edits time and note with the kind locked, then deletes with Undo', async () => {
    const pet = await seedPet()
    const seeded = await seedEntry(pet.id)
    renderJournal()

    await userEvent.click(await screen.findByTestId(`journal-entry-${seeded.id}`))
    expect(await screen.findByText('Edit Walk')).toBeInTheDocument()
    expect(screen.getByLabelText('Kind')).toBeDisabled()

    await userEvent.clear(screen.getByLabelText('Notes'))
    await userEvent.type(screen.getByLabelText('Notes'), 'Longer evening loop')
    await userEvent.click(screen.getByTestId('journal-save'))

    await waitFor(async () => {
      expect((await listJournal())[0]?.note).toBe('Longer evening loop')
    })

    // R6 edit + 3 s Undo restores the previous editable values exactly.
    await userEvent.click(await screen.findByTestId('journal-undo'))
    await waitFor(async () => {
      expect((await listJournal())[0]?.note).toBe('Morning loop')
    })

    await userEvent.click(screen.getByTestId(`journal-entry-${seeded.id}`))
    await userEvent.click(screen.getByTestId(`journal-delete-${seeded.id}`))
    await userEvent.click(screen.getByTestId('journal-delete-confirm'))

    await waitFor(() => {
      expect(document.querySelector('[data-testid^="journal-entry-"]')).toBeNull()
    })
    expect(await listJournal()).toEqual([])

    await userEvent.click(screen.getByTestId('journal-undo'))
    await waitFor(async () => {
      expect((await listJournal()).map((entry) => entry.id)).toEqual([seeded.id])
    })
    expect(await screen.findByTestId(`journal-entry-${seeded.id}`)).toBeInTheDocument()
  })

  it('opens the Sheet through the ?new=1 create intent below 1280 px', async () => {
    await seedPet()
    window.innerWidth = 1024
    renderJournal('/journal?new=1')

    const editor = await screen.findByTestId('journal-editor')
    expect(editor).toHaveAttribute('data-mode', 'sheet')
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Notes'), 'From the sheet')
    await userEvent.click(screen.getByTestId('journal-save'))
    await waitFor(async () => {
      expect((await listJournal())[0]?.note).toBe('From the sheet')
    })
  })

  it('converts the inline editor to a Sheet on live resize without losing text', async () => {
    await seedPet()
    renderJournal()

    expect(await screen.findByTestId('journal-editor')).toHaveAttribute('data-mode', 'inline')
    await userEvent.type(screen.getByLabelText('Notes'), 'Draft that must survive')

    act(() => {
      window.innerWidth = 1024
      window.dispatchEvent(new Event('resize'))
    })

    const sheetEditor = await screen.findByTestId('journal-editor')
    expect(sheetEditor).toHaveAttribute('data-mode', 'sheet')
    expect(screen.getByLabelText('Notes')).toHaveValue('Draft that must survive')

    act(() => {
      window.innerWidth = 1440
      window.dispatchEvent(new Event('resize'))
    })
    await waitFor(() => {
      expect(screen.getByTestId('journal-editor')).toHaveAttribute('data-mode', 'inline')
    })
    expect(screen.getByLabelText('Notes')).toHaveValue('Draft that must survive')
  })

  it('moves an edited entry to its new local day section (R4)', async () => {
    const pet = await seedPet()
    const seeded = await seedEntry(pet.id)
    renderJournal()

    await userEvent.click(await screen.findByTestId(`journal-entry-${seeded.id}`))
    const now = new Date()
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: todayKey(yesterday) } })
    await userEvent.click(screen.getByTestId('journal-save'))

    await waitFor(() => {
      expect(
        document.querySelector(`[data-testid="journal-day-${todayKey(yesterday)}"]`),
      ).not.toBeNull()
    })
    expect(document.querySelector(`[data-testid="journal-day-${todayKey(now)}"]`)).toBeNull()
    expect((await listJournal())[0]?.occurredAt).toContain('T')
  })

  it('filters by pet from the URL and keeps the filter control in sync', async () => {
    const bella = await seedPet('Bella')
    const miso = await seedPet('Miso')
    const bellaEntry = await seedEntry(bella.id, { kind: 'walk', note: 'Bella walk' })
    await seedEntry(miso.id, { kind: 'fed', note: 'Miso lunch' })

    renderJournal(`/journal?pet=${bella.id}`)

    await screen.findByTestId(`journal-entry-${bellaEntry.id}`)
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="journal-entry-"]')).toHaveLength(1)
    })
    expect(screen.getByTestId('journal-filter-pet')).toHaveValue(bella.id)
    expect(screen.getByLabelText('Notes')).toBeInTheDocument()
  })

  it('keeps the day-grouped feed labels and the kind filter', async () => {
    const pet = await seedPet()
    const today = new Date()
    await seedEntry(pet.id, { occurredAt: today.toISOString(), kind: 'walk' })
    await seedEntry(pet.id, {
      occurredAt: new Date(today.getTime() - 86_400_000).toISOString(),
      kind: 'fed',
    })
    renderJournal()

    expect(await screen.findByText('Today')).toBeInTheDocument()
    expect(screen.getByText('Yesterday')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByTestId('journal-filter-kind'), 'fed')
    await waitFor(() => {
      expect(document.querySelectorAll('[data-testid^="journal-entry-"]')).toHaveLength(1)
    })
    expect(screen.getAllByText(JOURNAL_KIND_LABELS.fed).length).toBeGreaterThan(0)
  })
})
