/**
 * Shared live-query loads: the pet list paired with its doses. Kept in one
 * place so `/pets` and any future surface compute R1 from the same read.
 */
import { listPets } from '@/lib/db/repositories/pets'
import { listHouseholdVaccinations } from '@/lib/db/repositories/vaccinations'
import type { Pet, Vaccination } from '@/lib/rules/types'

export interface PetsAndDoses {
  pets: Pet[]
  dosesByPet: Map<string, Vaccination[]>
}

export async function getPetsAndDoses(): Promise<PetsAndDoses> {
  const [pets, doses] = await Promise.all([listPets(), listHouseholdVaccinations()])
  const dosesByPet = new Map<string, Vaccination[]>()
  for (const dose of doses) {
    const existing = dosesByPet.get(dose.petId)
    if (existing === undefined) {
      dosesByPet.set(dose.petId, [dose])
    } else {
      existing.push(dose)
    }
  }
  return { pets, dosesByPet }
}
