/**
 * Pet repository — CRUD plus the transactional pet-delete cascade (02 §3).
 *
 * Deleting a pet removes its journal entries, vaccinations and clinical notes
 * and keeps its appointments with `petId = null` (rendered "Household");
 * IndexedDB has no cascades, so the explicit multi-step delete lives here and
 * runs in one transaction.
 */
import { todayKey } from '@/lib/rules/calendar'
import { validatePetDraft } from '@/lib/rules/pet-validation'
import type { Pet, PetDraft } from '@/lib/rules/types'

import { db } from '../db'
import { parseRow, petDraftSchema, petSchema } from '../schema'
import { newId, toIsoInstant } from '../write-helpers'
import { OWNER_ID } from './owners'

function sortPets(pets: Pet[]): Pet[] {
  return pets.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
}

export async function listPets(): Promise<Pet[]> {
  return sortPets(await db.pet.toArray())
}

export async function getPet(id: string): Promise<Pet | undefined> {
  return db.pet.get(id)
}

async function assertMicrochipFree(microchip: string | null, exceptPetId?: string): Promise<void> {
  if (microchip === null) {
    return
  }
  const holder = await db.pet.where('microchip').equals(microchip).first()
  if (holder !== undefined && holder.id !== exceptPetId) {
    throw new Error(`Microchip ${microchip} is already registered to ${holder.name}.`)
  }
}

/** R9 runs before any write; the repository never trusts the form alone. */
function assertValidDraft(draft: PetDraft, now: Date): PetDraft {
  // R9 first: it trims/normalises the draft (e.g. a padded microchip) before the
  // storage-shape schema mirrors the DDL checks.
  const validation = validatePetDraft(draft, { today: todayKey(now) })
  if (!validation.isValid || validation.value === null) {
    const detail = Object.entries(validation.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join('; ')
    throw new Error(`Invalid pet: ${detail}`)
  }
  return parseRow(petDraftSchema, validation.value, 'pet draft')
}

export async function createPet(draft: PetDraft, now: Date = new Date()): Promise<Pet> {
  const valid = assertValidDraft(draft, now)
  await assertMicrochipFree(valid.microchip)
  const instant = toIsoInstant(now)
  const pet = parseRow(
    petSchema,
    {
      id: newId(),
      ownerId: OWNER_ID,
      ...valid,
      createdAt: instant,
      updatedAt: instant,
    },
    'pet',
  )
  await db.pet.add(pet)
  return pet
}

export async function updatePet(id: string, draft: PetDraft, now: Date = new Date()): Promise<Pet> {
  const valid = assertValidDraft(draft, now)
  return db.transaction('rw', db.pet, async () => {
    const existing = await db.pet.get(id)
    if (existing === undefined) {
      throw new Error(`Pet ${id} does not exist.`)
    }
    await assertMicrochipFree(valid.microchip, id)
    const updated = parseRow(
      petSchema,
      { ...existing, ...valid, updatedAt: toIsoInstant(now) },
      'pet',
    )
    await db.pet.put(updated)
    return updated
  })
}

export async function deletePet(id: string, now: Date = new Date()): Promise<void> {
  await db.transaction(
    'rw',
    [db.pet, db.journal_entry, db.health_record, db.vaccination, db.appointment],
    async () => {
      const existing = await db.pet.get(id)
      if (existing === undefined) {
        throw new Error(`Pet ${id} does not exist.`)
      }
      await db.journal_entry.where('petId').equals(id).delete()
      await db.health_record.where('petId').equals(id).delete()
      await db.vaccination.where('petId').equals(id).delete()
      await db.appointment
        .where('petId')
        .equals(id)
        .modify({ petId: null, updatedAt: toIsoInstant(now) })
      await db.pet.delete(id)
    },
  )
}
