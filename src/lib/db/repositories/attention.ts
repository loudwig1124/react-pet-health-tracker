/**
 * The desktop counters' read model — one live read of the three tables the
 * dashboard counters, the attention rail and the sidebar badges need.
 *
 * A read-model repository, like `household-status.ts` and `pet-summary.ts`: it
 * only reads through Dexie and never validates/writes, so the eager shell and
 * the two M5 lazy chunks do not have to pull the zod schemas of the entity
 * repositories. Each entity still has exactly one *write* repository (02 R7).
 */
import type { Appointment, Pet, Vaccination } from '@/lib/rules/types'

import { db } from '../db'

export interface AttentionRows {
  pets: Pet[]
  doses: Vaccination[]
  appointments: Appointment[]
}

export async function loadAttentionRows(): Promise<AttentionRows> {
  const [pets, doses, appointments] = await Promise.all([
    db.pet.toArray(),
    db.vaccination.toArray(),
    db.appointment.toArray(),
  ])
  return { pets, doses, appointments }
}
