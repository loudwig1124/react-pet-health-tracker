/**
 * Vaccine-catalog repository. The catalog is always seeded at boot (M1 gate)
 * and referenced by vaccinations through `vaccineTypeId`; `vaccineName` on a
 * dose stays a display snapshot (R1).
 */
import type { VaccineType } from '@/lib/rules/types'

import { db } from '../db'

export async function listVaccineTypes(): Promise<VaccineType[]> {
  return db.vaccine_type.orderBy('sortOrder').toArray()
}

export async function getVaccineType(id: string): Promise<VaccineType | undefined> {
  return db.vaccine_type.get(id)
}
