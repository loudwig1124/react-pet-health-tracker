/**
 * Lightweight pet rows for the dashboard's initial route.
 *
 * The dashboard needs names, species and ids only (quick-log picker + pet
 * chips); importing `repositories/pets` would pull the validation and calendar
 * rules into the first-load chunk. Write paths never use this.
 */
import type { Pet } from '@/lib/rules/types'

import { db } from '../db'

export interface PetSummary {
  id: string
  name: string
  species: string
}

/** Pets sorted by name, case-insensitive (02 §3), as summary rows only. */
export async function listPetSummaries(): Promise<PetSummary[]> {
  const rows: Pet[] = await db.pet.toArray()
  return rows
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((pet) => ({ id: pet.id, name: pet.name, species: pet.species }))
}
