import {
  localDateISO,
  minutesFromNow,
  openApp,
  readStore,
  expectNoHorizontalOverflow,
} from './support/app'
/**
 * M3 · Vaccinations and appointments (06 §2).
 *
 * Ordered as the gate acceptance reads: a re-vaccinated pet clears overdue,
 * filter/sort URL state survives reload, a visit is booked → completed,
 * cancelled with a stored reason, and no-show is rejected before the scheduled
 * instant but allowed after it. Calendar lazy-loading and the `?pet=all`
 * hand-off are asserted here too.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BISCUIT: SeedPet = {
  id: 'e2e-pet-biscuit',
  name: 'Biscuit',
  species: 'Dog',
  breed: 'Beagle',
  weightKg: 12.4,
}
const BELLA: SeedPet = { id: 'e2e-pet-bella', name: 'Bella', species: 'Dog', weightKg: 12.4 }
const MISO: SeedPet = { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }
const COCO: SeedPet = { id: 'e2e-pet-coco', name: 'Coco', species: 'Dog', weightKg: 8.1 }

test.describe('vaccinations', () => {
  test.beforeEach(async ({ page }) => {
    await seedHousehold(page, { pets: [BISCUIT] })
  })

  test('a newer dose clears overdue (newest-dose-wins) and the old row is history', async ({
    page,
  }) => {
    await openApp(page, '/vaccinations')

    // 1. An expired rabies booster makes the pet overdue.
    await page.getByTestId('vaccination-add').click()
    await expect(page.getByTestId('vaccination-form')).toBeVisible()
    await page.getByTestId('vaccination-pet').selectOption(BISCUIT.id)
    await page.getByTestId('vaccination-vaccine').selectOption('vaccine-rabies')
    await page.getByTestId('vaccination-date').fill(localDateISO(-400))
    await page.getByTestId('vaccination-next-due').fill(localDateISO(-35))
    await page.getByTestId('vaccination-submit').click()
    await expect(page.getByTestId('vaccination-form')).toHaveCount(0)

    const table = page.getByTestId('vaccinations-table')
    await expect(table.getByTestId('due-chip-overdue').first()).toBeVisible()
    await expect(table.getByText('Rabies').first()).toBeVisible()

    // The URL status filter narrows to the pet's R1 status and survives reload.
    await page.goto('/vaccinations?status=overdue')
    await expect(
      page.getByTestId('vaccinations-table').getByTestId('due-chip-overdue'),
    ).toHaveCount(1)
    await page.reload()
    await expect(page).toHaveURL(/status=overdue/)
    await expect(
      page.getByTestId('vaccinations-table').getByTestId('due-chip-overdue'),
    ).toHaveCount(1)

    // 2. A fresh rabies dose with a future due date supersedes it.
    await openApp(page, '/vaccinations')
    await page.getByTestId('vaccination-add').click()
    await page.getByTestId('vaccination-pet').selectOption(BISCUIT.id)
    await page.getByTestId('vaccination-vaccine').selectOption('vaccine-rabies')
    await page.getByTestId('vaccination-date').fill(localDateISO(0))
    await page.getByTestId('vaccination-next-due').fill(localDateISO(365))
    await page.getByTestId('vaccination-submit').click()
    await expect(page.getByTestId('vaccination-form')).toHaveCount(0)

    // Old dose = Superseded history, new dose = up to date; no overdue anywhere.
    await expect(page.getByTestId('due-chip-superseded')).toHaveCount(1)
    await expect(page.getByTestId('due-chip-up_to_date')).toHaveCount(1)
    await expect(page.getByTestId('due-chip-overdue')).toHaveCount(0)

    // The R1 status filter follows the pet status, not the history row.
    await page.goto('/vaccinations?status=overdue')
    await expect(page.getByTestId('vaccinations-table')).toHaveCount(0)
    await expect(page.getByTestId('vaccinations-filter-empty')).toBeVisible()

    const doses = await readStore<{ vaccineName: string; nextDueDate: string }>(page, 'vaccination')
    expect(doses).toHaveLength(2)
  })

  test('a misclicked dose can be corrected, deleted, and undone after recording', async ({
    page,
  }) => {
    await seedHousehold(page, {
      pets: [BISCUIT],
      vaccinations: [
        {
          id: 'e2e-dose-typo',
          petId: BISCUIT.id,
          vaccineName: 'Rabies',
          vaccineTypeId: 'vaccine-rabies',
          // The misclick: a year too early, so the pet reads overdue.
          vaccinationDate: localDateISO(-400),
          nextDueDate: localDateISO(-35),
        },
      ],
    })
    await openApp(page, '/vaccinations')
    const row = page.getByTestId('vaccination-row-e2e-dose-typo')
    await expect(row).toContainText('Overdue')

    // Correct the date: the row and its status update without a new row.
    await page.getByTestId('vaccination-edit-e2e-dose-typo').click()
    const form = page.getByTestId('vaccination-form')
    await expect(form).toBeVisible()
    await expect(page.getByTestId('vaccination-date')).not.toHaveValue('')
    await page.getByTestId('vaccination-date').fill(localDateISO(-2))
    await page.getByTestId('vaccination-submit').click()
    await expect(form).toHaveCount(0)
    await expect(row).not.toContainText('Overdue')
    await expect(page.locator('[data-testid^="vaccination-row-"]')).toHaveCount(1)

    // Delete asks once, then removes the row.
    await page.getByTestId('vaccination-edit-e2e-dose-typo').click()
    const remove = page.getByTestId('vaccination-delete')
    await remove.click()
    await expect(remove).toHaveText('Delete permanently?')
    await expect(row).toBeVisible()
    await remove.click()
    await expect(page.locator('[data-testid^="vaccination-row-"]')).toHaveCount(0)

    // Recording a dose offers a three-second Undo, the same contract as the journal.
    await page.getByTestId('vaccination-add').click()
    await page.getByTestId('vaccination-pet').selectOption(BISCUIT.id)
    await page.getByTestId('vaccination-vaccine').selectOption('vaccine-rabies')
    await page.getByTestId('vaccination-submit').click()
    await expect(page.locator('[data-testid^="vaccination-row-"]')).toHaveCount(1)
    await page.getByTestId('vaccination-undo').click()
    await expect(page.locator('[data-testid^="vaccination-row-"]')).toHaveCount(0)
  })

  test('status, pet and sort state live in the URL and survive reload', async ({ page }) => {
    await seedHousehold(page, {
      pets: [BISCUIT, { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }],
      vaccinations: [
        {
          id: 'e2e-dose-miso',
          petId: 'e2e-pet-miso',
          vaccineName: 'FVRCP',
          vaccineTypeId: 'vaccine-fvrcp',
          vaccinationDate: localDateISO(-30),
          nextDueDate: localDateISO(335),
        },
      ],
    })
    await openApp(page, '/vaccinations')

    await page.getByTestId('vaccinations-filter-pet').selectOption('e2e-pet-miso')
    await expect(page).toHaveURL(/pet=e2e-pet-miso/)

    await page.reload()
    await expect(page.getByTestId('vaccinations-filter-pet')).toHaveValue('e2e-pet-miso')
    await expect(page.getByTestId('vaccinations-table').getByText('Miso')).toBeVisible()

    // `?pet=all` is the explicit "no filter" sentinel (R10), not absent.
    await page.goto('/vaccinations?pet=all')
    await expect(page.getByTestId('vaccinations-filter-pet')).toHaveValue('all')
  })
})

test.describe('appointments', () => {
  test.beforeEach(async ({ page }) => {
    await seedHousehold(page, { pets: [BISCUIT] })
  })

  async function bookVisit(page: Parameters<typeof openApp>[0], purpose: string): Promise<string> {
    await openApp(page, '/appointments')
    await page.getByTestId('appointment-book').click()
    await expect(page.getByTestId('booking-form')).toBeVisible()
    await page.getByTestId('booking-pet').selectOption(BISCUIT.id)
    await page.getByTestId('booking-clinic').fill('Paws & Claws')
    await page.getByTestId('booking-purpose').fill(purpose)
    await page.getByTestId('booking-date').fill(localDateISO(3))
    await page.getByTestId('booking-time').fill('10:30')
    await page.getByTestId('booking-submit').click()
    await expect(page.getByTestId('booking-form')).toHaveCount(0)

    const row = page.locator('[data-testid^="appointment-row-"]').filter({ hasText: purpose })
    await expect(row).toBeVisible()
    const testId = await row.getAttribute('data-testid')
    return (testId ?? '').replace('appointment-row-', '')
  }

  test('a booked visit can be completed and becomes terminal', async ({ page }) => {
    const id = await bookVisit(page, 'Annual wellness check')
    await expect(page.getByTestId(`appointment-row-${id}`)).toHaveAttribute(
      'data-status',
      'scheduled',
    )

    await page.getByTestId(`appointment-actions-${id}`).click()
    await expect(page.getByTestId('appointment-actions-dialog')).toBeVisible()
    await page.getByTestId(`appointment-complete-${id}`).click()
    await expect(page.getByTestId('appointment-actions-dialog')).toHaveCount(0)

    await expect(page.getByTestId(`appointment-row-${id}`)).toHaveAttribute(
      'data-status',
      'completed',
    )
    await expect(page.getByTestId('appointment-status-completed')).toBeVisible()

    const rows = await readStore<{ id: string; status: string; completedAt: string | null }>(
      page,
      'appointment',
    )
    const completed = rows.find((row) => row.id === id)
    expect(completed?.status).toBe('completed')
    expect(completed?.completedAt).not.toBeNull()

    // Terminal: the row exposes no manage affordance any more.
    await expect(page.getByTestId(`appointment-actions-${id}`)).toHaveCount(0)
  })

  test('cancel needs a reason, stores it, and cannot be blank', async ({ page }) => {
    const id = await bookVisit(page, 'Dental cleaning')
    await page.getByTestId(`appointment-actions-${id}`).click()
    await page.getByTestId(`appointment-cancel-${id}`).click()

    await expect(page.getByTestId('appointment-cancel-form')).toBeVisible()
    const confirm = page.getByTestId('appointment-confirm-cancel')
    await expect(confirm).toBeDisabled()

    await page.getByTestId('appointment-cancel-reason').fill('   ')
    await expect(confirm).toBeDisabled()

    await page.getByTestId('appointment-cancel-reason').fill('Owner unwell')
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(page.getByTestId(`appointment-row-${id}`)).toHaveAttribute(
      'data-status',
      'cancelled',
    )
    const rows = await readStore<{ id: string; status: string; cancelReason: string | null }>(
      page,
      'appointment',
    )
    const cancelled = rows.find((row) => row.id === id)
    expect(cancelled?.status).toBe('cancelled')
    expect(cancelled?.cancelReason).toBe('Owner unwell')
  })

  test('no-show is rejected before the scheduled instant and allowed after it', async ({
    page,
  }) => {
    // A visit booked in the future is not yet a no-show (R3).
    const futureId = await bookVisit(page, 'Six-month check')
    await page.getByTestId(`appointment-actions-${futureId}`).click()
    await expect(page.getByTestId(`appointment-no-show-${futureId}`)).toBeDisabled()
    await expect(page.getByTestId('appointment-no-show-blocked')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('appointment-actions-dialog')).toHaveCount(0)

    // A visit whose scheduled instant has passed may be marked no-show.
    await seedHousehold(page, {
      pets: [BISCUIT],
      appointments: [
        {
          id: 'e2e-visit-past',
          petId: BISCUIT.id,
          scheduledAt: minutesFromNow(-120).toISOString(),
          purpose: 'Past check',
        },
      ],
    })
    await openApp(page, '/appointments?status=past')
    await expect(page.getByTestId('appointment-row-e2e-visit-past')).toBeVisible()
    await page.getByTestId('appointment-actions-e2e-visit-past').click()
    const noShow = page.getByTestId('appointment-no-show-e2e-visit-past')
    await expect(noShow).toBeEnabled()
    await noShow.click()
    await expect(page.getByTestId('appointment-row-e2e-visit-past')).toHaveAttribute(
      'data-status',
      'no_show',
    )
  })

  test('reschedule closes the old visit as rescheduled and creates the new one', async ({
    page,
  }) => {
    const id = await bookVisit(page, 'Boosters')
    await page.getByTestId(`appointment-actions-${id}`).click()
    await page.getByTestId(`appointment-reschedule-${id}`).click()
    await expect(page.getByTestId('appointment-reschedule-form')).toBeVisible()
    await page.getByTestId('appointment-reschedule-date').fill(localDateISO(6))
    await page.getByTestId('appointment-reschedule-time').fill('09:15')
    await page.getByTestId('appointment-confirm-reschedule').click()
    await expect(page.getByTestId('appointment-actions-dialog')).toHaveCount(0)

    const rows = await readStore<{
      id: string
      status: string
      cancelReason: string | null
      scheduledAt: string
    }>(page, 'appointment')
    const oldRow = rows.find((row) => row.id === id)
    expect(oldRow?.status).toBe('cancelled')
    expect(oldRow?.cancelReason).toBe('rescheduled')
    const replacement = rows.find(
      (row) => row.id !== id && row.status === 'scheduled' && row.cancelReason === null,
    )
    expect(replacement, 'a replacement scheduled visit exists').toBeDefined()
  })

  test('calendar view is URL state and loads its chunk lazily', async ({ page }) => {
    await openApp(page, '/appointments')
    await expect(page.getByTestId('appointments-table')).toBeVisible()

    const calendarRequests: string[] = []
    page.on('request', (request) => {
      if (/AppointmentCalendar/iu.test(request.url())) {
        calendarRequests.push(request.url())
      }
    })

    await page.getByTestId('appointments-view-calendar').click()
    await expect(page.getByTestId('appointments-calendar')).toBeVisible()
    await expect(page).toHaveURL(/view=calendar/)
    // The calendar is its own lazy chunk — never part of the first load.
    expect(calendarRequests, 'calendar chunk requested on demand').toHaveLength(1)

    await page.reload()
    await expect(page.getByTestId('appointments-calendar')).toBeVisible()
    await expectNoHorizontalOverflow(page, 'appointments calendar')
  })

  test('the household hand-off keeps an explicit ?pet=all', async ({ page }) => {
    await seedHousehold(page, {
      pets: [BISCUIT, { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }],
    })
    await openApp(page, '/appointments?pet=all')
    await expect(page.getByTestId('appointments-filter-pet')).toHaveValue('all')
  })
})

test.describe('pet-detail schedule tabs (M3 wiring)', () => {
  test('vaccinations tab deep-links, shows only that pet, and locks the add form', async ({
    page,
  }) => {
    await seedHousehold(page, {
      pets: [BELLA, MISO, COCO],
      vaccinations: [
        {
          id: 'e2e-dose-bella-old',
          petId: BELLA.id,
          vaccineName: 'Rabies',
          vaccineTypeId: 'vaccine-rabies',
          vaccinationDate: localDateISO(-400),
          nextDueDate: localDateISO(-35),
        },
        {
          id: 'e2e-dose-bella-new',
          petId: BELLA.id,
          vaccineName: 'Rabies',
          vaccineTypeId: 'vaccine-rabies',
          vaccinationDate: localDateISO(-10),
          nextDueDate: localDateISO(355),
        },
        {
          id: 'e2e-dose-miso',
          petId: MISO.id,
          vaccineName: 'FVRCP',
          vaccineTypeId: 'vaccine-fvrcp',
          vaccinationDate: localDateISO(-30),
          nextDueDate: localDateISO(335),
        },
      ],
    })

    await openApp(page, `/pets/${BELLA.id}/vaccinations`)
    await expect(page.getByTestId('pet-panel-vaccinations')).toBeVisible()
    await expect(page.getByTestId('pet-tab-vaccinations')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('pet-vaccinations-count')).toContainText('2 doses')
    // The newest dose is current; the old one is history, never "overdue".
    await expect(page.getByTestId('due-chip-superseded')).toHaveCount(1)
    await expect(page.getByTestId('due-chip-up_to_date')).toHaveCount(1)
    await expect(page.getByTestId('due-chip-overdue')).toHaveCount(0)
    await expect(page.getByTestId('pet-panel-vaccinations')).not.toContainText('Miso')

    // A pet with no doses gets its own empty state, not the household one.
    await openApp(page, `/pets/${COCO.id}/vaccinations`)
    await expect(page.getByTestId('pet-vaccinations-empty')).toContainText(
      'No doses recorded for Coco yet',
    )

    // Add from the tab: the pet is locked to the tab's pet.
    await openApp(page, `/pets/${COCO.id}/vaccinations`)
    await page.getByTestId('pet-vaccination-add').click()
    await expect(page.getByTestId('vaccination-form')).toBeVisible()
    await expect(page.getByTestId('vaccination-pet')).toHaveValue(COCO.id)
  })

  test('appointments tab deep-links, keeps the past segment in the URL, and locks booking', async ({
    page,
  }) => {
    await seedHousehold(page, {
      pets: [BELLA, MISO],
      appointments: [
        {
          id: 'e2e-bella-upcoming',
          petId: BELLA.id,
          scheduledAt: minutesFromNow(60 * 24 * 2).toISOString(),
          purpose: 'Annual wellness',
        },
        {
          id: 'e2e-bella-completed',
          petId: BELLA.id,
          scheduledAt: minutesFromNow(-60 * 24 * 5).toISOString(),
          status: 'completed',
          purpose: 'Dental follow-up',
        },
        {
          id: 'e2e-miso-upcoming',
          petId: MISO.id,
          scheduledAt: minutesFromNow(60 * 24 * 4).toISOString(),
          purpose: 'Cat check',
        },
      ],
    })

    await openApp(page, `/pets/${BELLA.id}/appointments`)
    await expect(page.getByTestId('pet-panel-appointments')).toBeVisible()
    await expect(page.getByTestId('pet-tab-appointments')).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('appointment-row-e2e-bella-upcoming')).toBeVisible()
    await expect(page.getByTestId('appointment-row-e2e-bella-completed')).toHaveCount(0)
    await expect(page.getByTestId('pet-panel-appointments')).not.toContainText('Cat check')

    // Past segment is URL state and survives reload.
    await page.getByTestId('pet-appointments-status-past').click()
    await expect(page).toHaveURL(/status=past/)
    await expect(page.getByTestId('appointment-row-e2e-bella-completed')).toBeVisible()
    await page.reload()
    await expect(page).toHaveURL(/status=past/)
    await expect(page.getByTestId('appointment-row-e2e-bella-completed')).toBeVisible()

    // Booking from the tab keeps the pet locked to this tab.
    await openApp(page, `/pets/${MISO.id}/appointments`)
    await page.getByTestId('pet-appointment-book').click()
    await expect(page.getByTestId('booking-form')).toBeVisible()
    await expect(page.getByTestId('booking-pet')).toHaveValue(MISO.id)
  })
})
