/**
 * Household fixtures for the feature specs.
 *
 * The UI is the normal path; this module exists because the M3/M4 screens are
 * being built in parallel with the M2 pet form and a spec for appointments must
 * not fail for a reason owned by another milestone. It writes exactly the rows
 * the repositories would write (schemas in `src/lib/db/schema.ts`) through the
 * shared raw IndexedDB helper, after the app has booted once so the stores
 * exist, then reloads so Dexie's live queries start from the fixture.
 *
 * Specs that are *about* creating pets/records still drive the real UI.
 */
import { expect, type Page } from '@playwright/test'

import { writeStore } from './app'

export const TEST_OWNER_NAME = 'Alex Rivera'

export interface SeedPet {
  id: string
  name: string
  species?: string
  breed?: string | null
  sex?: 'male' | 'female' | 'unknown'
  dateOfBirth?: string
  weightKg?: number
  microchip?: string | null
}

export interface SeedAppointment {
  id: string
  petId: string | null
  /** ISO instant. */
  scheduledAt: string
  status?: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  clinicName?: string
  purpose?: string
}

export interface SeedJournalEntry {
  id: string
  petId: string
  kind: 'walk' | 'fed' | 'meds' | 'grooming' | 'training' | 'note' | 'symptom'
  occurredAt: string
  note?: string | null
  durationMinutes?: number | null
}

export interface SeedHealthRecord {
  id: string
  petId: string
  recordedOn: string
  condition?: string | null
  diagnosis?: string | null
}

export interface SeedVaccination {
  id: string
  petId: string
  vaccineName: string
  vaccineTypeId?: string | null
  vaccinationDate: string
  nextDueDate: string | null
}

export function petRow(
  pet: SeedPet,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    id: pet.id,
    ownerId: 'owner',
    name: pet.name,
    species: pet.species ?? 'Dog',
    breed: pet.breed ?? null,
    sex: pet.sex ?? 'unknown',
    dateOfBirth: pet.dateOfBirth ?? '2022-04-12',
    weightKg: pet.weightKg ?? 12.4,
    microchip: pet.microchip ?? null,
    createdAt: now,
    updatedAt: now,
  }
}

export function appointmentRow(
  appointment: SeedAppointment,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  const status = appointment.status ?? 'scheduled'
  return {
    id: appointment.id,
    petId: appointment.petId,
    clinicName: appointment.clinicName ?? 'Paws & Claws Veterinary Clinic',
    purpose: appointment.purpose ?? 'Annual wellness check',
    scheduledAt: appointment.scheduledAt,
    status,
    completedAt: status === 'completed' ? now : null,
    cancelReason: status === 'cancelled' ? 'Cancelled in fixture' : null,
    createdAt: now,
    updatedAt: now,
  }
}

export function vaccinationRow(
  dose: SeedVaccination,
  now: string = new Date().toISOString(),
): Record<string, unknown> {
  return {
    id: dose.id,
    petId: dose.petId,
    vaccineTypeId: dose.vaccineTypeId ?? null,
    vaccineName: dose.vaccineName,
    vaccinationDate: dose.vaccinationDate,
    nextDueDate: dose.nextDueDate,
    vetName: null,
    createdAt: now,
    updatedAt: now,
  }
}

interface SeedHouseholdOptions {
  pets: SeedPet[]
  appointments?: SeedAppointment[]
  vaccinations?: SeedVaccination[]
  journal?: SeedJournalEntry[]
  records?: SeedHealthRecord[]
  ownerName?: string
}

/**
 * Writes an owner + pets (+ optional schedule rows) and reloads to a normal
 * shell (no first-run takeover). Safe on every milestone: it waits for either
 * the shell or the M4 takeover before writing, so it does not depend on which
 * screens exist yet.
 */
export async function seedHousehold(page: Page, options: SeedHouseholdOptions): Promise<void> {
  const now = new Date().toISOString()
  await page.goto('/profile')
  await expect(page.getByTestId('app-shell').or(page.getByTestId('first-run'))).toBeVisible()

  await writeStore(page, 'owner', [
    {
      id: 'owner',
      name: options.ownerName ?? TEST_OWNER_NAME,
      email: '',
      phone: '',
      createdAt: now,
      updatedAt: now,
    },
  ])
  await writeStore(
    page,
    'pet',
    options.pets.map((pet) => petRow(pet, now)),
  )
  if (options.appointments !== undefined && options.appointments.length > 0) {
    await writeStore(
      page,
      'appointment',
      options.appointments.map((appointment) => appointmentRow(appointment, now)),
    )
  }
  if (options.vaccinations !== undefined && options.vaccinations.length > 0) {
    await writeStore(
      page,
      'vaccination',
      options.vaccinations.map((dose) => vaccinationRow(dose, now)),
    )
  }
  if (options.journal !== undefined && options.journal.length > 0) {
    await writeStore(
      page,
      'journal_entry',
      options.journal.map((entry) => ({
        id: entry.id,
        petId: entry.petId,
        kind: entry.kind,
        occurredAt: entry.occurredAt,
        note: entry.note ?? null,
        durationMinutes: entry.durationMinutes ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    )
  }
  if (options.records !== undefined && options.records.length > 0) {
    await writeStore(
      page,
      'health_record',
      options.records.map((record) => ({
        id: record.id,
        petId: record.petId,
        recordedOn: record.recordedOn,
        condition: record.condition ?? null,
        diagnosis: record.diagnosis ?? null,
        treatment: null,
        prescribedMedication: null,
        vetName: null,
        createdAt: now,
      })),
    )
  }

  await page.reload()
  await expect(page.getByTestId('app-shell')).toBeVisible()
}

/** A pet's table row by accessible text (works for pets, appointments, doses). */
export function rowByTestId(page: Page, prefix: string, id: string) {
  return page.getByTestId(`${prefix}${id}`)
}
