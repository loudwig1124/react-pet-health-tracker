import {
  countStore,
  localDateISO,
  openApp,
  expectNoHorizontalOverflow,
  readStore,
  writeStore,
} from './support/app'
/**
 * M2 · Pets and records (06 §2): create → edit → delete through the real
 * dialogs, R9 validation (duplicate microchip, future birthday, weight bounds),
 * the cascade delete (appointments survive as household visits), sort/filter
 * URL state across reload, and the append-only records surface.
 */
import { expect, test } from './support/fixtures'
import { seedHousehold, type SeedPet } from './support/household'

const BELLA: SeedPet = { id: 'e2e-pet-bella', name: 'Bella', species: 'Dog', weightKg: 12.4 }
const MISO: SeedPet = { id: 'e2e-pet-miso', name: 'Miso', species: 'Cat', weightKg: 4.2 }
const COCO: SeedPet = { id: 'e2e-pet-coco', name: 'Coco', species: 'Dog', weightKg: 8.1 }

interface PetFormInput {
  name: string
  species?: string
  breed?: string
  sex?: string
  dateOfBirth?: string
  weightKg?: string
  microchip?: string
}

async function fillPetForm(
  page: Parameters<typeof openApp>[0],
  input: PetFormInput,
): Promise<void> {
  const form = page.getByTestId('pet-form')
  await form.locator('#pet-name').fill(input.name)
  await form.locator('#pet-species').selectOption(input.species ?? 'Dog')
  if (input.breed !== undefined) {
    await form.locator('#pet-breed').fill(input.breed)
  }
  if (input.sex !== undefined) {
    await form.locator('#pet-sex').selectOption(input.sex)
  }
  await form.locator('#pet-dob').fill(input.dateOfBirth ?? localDateISO(-800))
  await form.locator('#pet-weight').fill(input.weightKg ?? '8.1')
  if (input.microchip !== undefined) {
    await form.locator('#pet-microchip').fill(input.microchip)
  }
}

async function firstPetRowId(page: Parameters<typeof openApp>[0]): Promise<string> {
  const row = page.locator('[data-testid^="pet-row-"]').first()
  await expect(row).toBeVisible()
  const testId = await row.getAttribute('data-testid')
  return (testId ?? '').replace('pet-row-', '')
}

test.describe('pets', () => {
  test('create → edit → delete a pet through the dialogs', async ({ page }) => {
    await seedHousehold(page, { pets: [] })
    await openApp(page, '/pets')
    await expect(page.getByTestId('pets-empty')).toBeVisible()

    // Create.
    await page.getByTestId('pet-add').click()
    await expect(page.getByTestId('pet-form')).toBeVisible()
    await fillPetForm(page, {
      name: 'Coco',
      species: 'Dog',
      breed: 'Beagle',
      sex: 'female',
      weightKg: '8.1',
      microchip: '123456789',
    })
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByTestId('pet-form')).toHaveCount(0)

    const id = await firstPetRowId(page)
    await expect(page.getByTestId(`pet-row-${id}`)).toContainText('Coco')
    await expect(page.getByTestId(`pet-row-${id}`)).toContainText('8.1 kg')

    // Row opens the path-addressable detail page.
    await page.getByTestId(`pet-row-${id}`).click()
    await expect(page).toHaveURL(new RegExp(`/pets/${id}/health$`))
    await expect(page.getByTestId('pet-name')).toHaveText('Coco')

    // Edit.
    await page.getByTestId('pet-edit').click()
    await expect(page.getByTestId('pet-form')).toBeVisible()
    await page.getByTestId('pet-form').locator('#pet-name').fill('Coco Chanel')
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByTestId('pet-name')).toHaveText('Coco Chanel')

    await openApp(page, '/pets')
    await expect(page.getByTestId(`pet-row-${id}`)).toContainText('Coco Chanel')

    // Delete.
    await page.getByTestId(`pet-delete-${id}`).click()
    await expect(page.getByTestId('delete-pet-dialog')).toBeVisible()
    await page.getByTestId('confirm-delete').click()
    await expect(page.getByTestId('pets-empty')).toBeVisible()
    expect(await countStore(page, 'pet')).toBe(0)
  })

  test('R9 validation: duplicate microchip, future birthday, weight bounds, blank name', async ({
    page,
  }) => {
    await seedHousehold(page, {
      pets: [{ id: 'e2e-pet-base', name: 'Base', microchip: '123456789' }],
    })
    await openApp(page, '/pets')
    await page.getByTestId('pet-add').click()
    await expect(page.getByTestId('pet-form')).toBeVisible()

    // Duplicate microchip is rejected with a message, not a write.
    await fillPetForm(page, { name: 'Copycat', microchip: '123456789' })
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByRole('alert')).toContainText(/microchip/i)
    await expect(page.getByTestId('pet-form')).toBeVisible()
    expect(await countStore(page, 'pet')).toBe(1)

    // Future birthday.
    await page.getByTestId('pet-form').locator('#pet-microchip').fill('987654321')
    await page.getByTestId('pet-form').locator('#pet-dob').fill(localDateISO(1))
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByRole('alert')).toContainText(/future/i)

    // Weight > 300 kg.
    await page.getByTestId('pet-form').locator('#pet-dob').fill(localDateISO(-800))
    await page.getByTestId('pet-form').locator('#pet-weight').fill('301')
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByRole('alert')).toContainText(/300/)

    // Blank name.
    await page.getByTestId('pet-form').locator('#pet-weight').fill('8.1')
    await page.getByTestId('pet-form').locator('#pet-name').fill('   ')
    await page.getByTestId('pet-form-submit').click()
    await expect(page.getByRole('alert')).toContainText(/name/i)
    expect(await countStore(page, 'pet')).toBe(1)
  })

  test('deleting a pet cascades and keeps appointments as household visits', async ({ page }) => {
    await seedHousehold(page, {
      pets: [BELLA],
      appointments: [
        {
          id: 'e2e-visit-household',
          petId: BELLA.id,
          scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
          purpose: 'Annual wellness',
        },
      ],
    })
    const now = new Date().toISOString()
    await writeStore(page, 'journal_entry', [
      {
        id: 'e2e-journal-bella',
        petId: BELLA.id,
        kind: 'walk',
        occurredAt: now,
        note: null,
        durationMinutes: null,
        createdAt: now,
        updatedAt: now,
      },
    ])
    await writeStore(page, 'vaccination', [
      {
        id: 'e2e-dose-bella',
        petId: BELLA.id,
        vaccineTypeId: null,
        vaccineName: 'Rabies',
        vaccinationDate: localDateISO(-30),
        nextDueDate: localDateISO(335),
        vetName: null,
        createdAt: now,
        updatedAt: now,
      },
    ])
    await writeStore(page, 'health_record', [
      {
        id: 'e2e-record-bella',
        petId: BELLA.id,
        recordedOn: localDateISO(-5),
        condition: 'Ear infection',
        diagnosis: null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
        createdAt: now,
      },
    ])
    await page.reload()
    await expect(page.getByTestId('app-shell')).toBeVisible()

    await openApp(page, '/pets')
    await page.getByTestId(`pet-delete-${BELLA.id}`).click()
    await page.getByTestId('confirm-delete').click()
    await expect(page.getByTestId('pets-empty')).toBeVisible()

    expect(await countStore(page, 'pet')).toBe(0)
    expect(await countStore(page, 'journal_entry')).toBe(0)
    expect(await countStore(page, 'vaccination')).toBe(0)
    expect(await countStore(page, 'health_record')).toBe(0)
    const appointments = await readStore<{ id: string; petId: string | null }>(page, 'appointment')
    expect(appointments).toHaveLength(1)
    expect(appointments[0]?.petId).toBeNull()
  })

  test('sort and filters live in the URL and survive reload', async ({ page }) => {
    await seedHousehold(page, { pets: [BELLA, MISO, COCO] })
    await openApp(page, '/pets')

    // Default name asc: Bella first.
    await expect(page.locator('[data-testid^="pet-row-"]').first()).toContainText('Bella')
    const nameHeader = page.getByTestId('pets-th-name')
    await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    await nameHeader.getByRole('button', { name: 'Name' }).click()
    await expect(page).toHaveURL(/sort=name/)
    await expect(page).toHaveURL(/dir=desc/)
    await expect(nameHeader).toHaveAttribute('aria-sort', 'descending')
    await expect(page.locator('[data-testid^="pet-row-"]').first()).toContainText('Miso')

    // Per-pet filter: explicit `?pet=` selection.
    await page.locator('#pets-pet').selectOption(MISO.id)
    await expect(page).toHaveURL(/pet=e2e-pet-miso/)
    await expect(page.locator('[data-testid^="pet-row-"]')).toHaveCount(1)

    // Species filter + reload restores the view.
    await page.getByTestId('pets-clear-filters').click()
    // Wait for the replace-state navigation to settle before the next control,
    // otherwise the two URL writes can commit out of order.
    await expect(page.locator('#pets-pet')).toHaveValue('all')
    await page.locator('#pets-species').selectOption('Dog')
    await expect(page).toHaveURL(/species=Dog/)
    await page.reload()
    await expect(page.locator('#pets-species')).toHaveValue('Dog')
    await expect(page.locator('[data-testid^="pet-row-"]')).toHaveCount(2)
    // The species change keeps the committed sort (desc): Coco before Bella.
    await expect(page.getByTestId('pets-th-name')).toHaveAttribute('aria-sort', 'descending')
    await expect(page.locator('[data-testid^="pet-row-"]').first()).toContainText('Coco')

    // Free-text search after clearing the species filter, so the query is
    // meaningful across the household.
    await page.getByTestId('pets-clear-filters').click()
    await expect(page.locator('#pets-species')).toHaveValue('all')
    await page.locator('#pets-search').fill('mis')
    await expect(page).toHaveURL(/q=mis/)
    await page.reload()
    await expect(page.locator('#pets-search')).toHaveValue('mis')
    await expect(page.locator('[data-testid^="pet-row-"]')).toHaveCount(1)
    await expectNoHorizontalOverflow(page, 'pets filtered')
  })

  test('records are append-only: add from the household list, no edit/delete affordance', async ({
    page,
  }) => {
    await seedHousehold(page, { pets: [BELLA] })
    await openApp(page, '/records')
    await expect(page.getByTestId('records-empty')).toBeVisible()

    await page.getByTestId('record-add').click()
    await expect(page.getByTestId('record-form')).toBeVisible()
    await page.getByTestId('record-form').locator('#record-pet').selectOption(BELLA.id)
    await page.getByTestId('record-form').locator('#record-date').fill(localDateISO(0))
    await page.getByTestId('record-form').locator('#record-condition').fill('Ear infection')
    await page.getByTestId('record-form').locator('#record-diagnosis').fill('Otitis externa')
    await page.getByTestId('record-submit').click()
    await expect(page.getByTestId('record-form')).toHaveCount(0)

    const row = page.locator('[data-testid^="record-row-"]').first()
    await expect(row).toContainText('Ear infection')
    await expect(page.getByTestId('records-list')).not.toContainText(/edit/i)
    await expect(page.getByTestId('records-list')).not.toContainText(/delete/i)
    expect(await countStore(page, 'health_record')).toBe(1)

    // The same note appears read-only on the pet's Records tab.
    await openApp(page, `/pets/${BELLA.id}/records`)
    await expect(page.getByTestId('pet-records-list')).toContainText('Ear infection')
    await expect(page.getByTestId('pet-records-list')).not.toContainText(/delete/i)
  })

  test('a pet detail deep link for a missing pet explains itself', async ({ page }) => {
    await seedHousehold(page, { pets: [] })
    await openApp(page, '/pets/missing-pet/health')
    await expect(page.getByTestId('pet-not-found')).toBeVisible()
  })
})
