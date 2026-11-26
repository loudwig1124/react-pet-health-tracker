/**
 * Vaccination repository — doses only. "Newest dose per vaccine wins" is the
 * pure rule in `src/lib/rules/vaccination-due.ts`; this module stores and
 * returns rows newest-first so every consumer can apply the same rule.
 */
import type { Vaccination, VaccinationDraft } from '@/lib/rules/types'

import { db } from '../db'
import { parseRow, vaccinationDraftSchema, vaccinationSchema } from '../schema'
import { newId, toIsoInstant } from '../write-helpers'

function sortNewestFirst(doses: Vaccination[]): Vaccination[] {
  return doses.sort(
    (a, b) =>
      b.vaccinationDate.localeCompare(a.vaccinationDate) ||
      b.createdAt.localeCompare(a.createdAt) ||
      b.id.localeCompare(a.id),
  )
}

export async function listVaccinationsForPet(petId: string): Promise<Vaccination[]> {
  return sortNewestFirst(await db.vaccination.where('petId').equals(petId).toArray())
}

/** The `/vaccinations` household read view (03 §2): every pet's doses. */
export async function listHouseholdVaccinations(): Promise<Vaccination[]> {
  return sortNewestFirst(await db.vaccination.toArray())
}

export async function appendVaccination(
  draft: VaccinationDraft,
  now: Date = new Date(),
): Promise<Vaccination> {
  const parsed = parseRow(vaccinationDraftSchema, draft, 'vaccination draft')
  const pet = await db.pet.get(parsed.petId)
  if (pet === undefined) {
    throw new Error(`Pet ${parsed.petId} does not exist.`)
  }
  const dose = parseRow(
    vaccinationSchema,
    { id: newId(), ...parsed, createdAt: toIsoInstant(now) },
    'vaccination',
  )
  await db.vaccination.add(dose)
  return dose
}

/**
 * Corrects a dose in place (owner decision A, 2026-11-27).
 *
 * Doses are appended, never rewritten historically — but a misclicked vaccine or
 * date is otherwise permanent, so the row can be corrected. `id` and `createdAt`
 * are preserved (the R1 tie-break keeps its original position for an unchanged
 * date), and the same draft schema as `appendVaccination` re-validates the edit,
 * so an edited row can never be in a state a new row could not be.
 */
export async function updateVaccination(id: string, draft: VaccinationDraft): Promise<Vaccination> {
  const parsed = parseRow(vaccinationDraftSchema, draft, 'vaccination draft')
  const existing = await db.vaccination.get(id)
  if (existing === undefined) {
    throw new Error(`Vaccination ${id} does not exist.`)
  }
  const pet = await db.pet.get(parsed.petId)
  if (pet === undefined) {
    throw new Error(`Pet ${parsed.petId} does not exist.`)
  }
  const dose = parseRow(
    vaccinationSchema,
    {
      ...existing,
      ...parsed,
      id: existing.id,
      createdAt: existing.createdAt,
    },
    'vaccination',
  )
  await db.vaccination.put(dose)
  return dose
}

/** Removes a dose the owner deleted (the dialog asks first). */
export async function deleteVaccination(id: string): Promise<void> {
  await db.vaccination.delete(id)
}
