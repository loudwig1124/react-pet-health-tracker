/**
 * The vaccine catalog data + its always-run seed. Split from `catalog.ts` in the
 * M5 performance pass so the root boot can seed without importing the zod
 * schema graph into the eager first-load chunk (`catalog.ts` only re-exports
 * these names, so every existing import keeps working).
 *
 * The rows are a fixed, reviewed literal set, not user input: TypeScript checks
 * them against `VaccineType` at compile time. Ids are stable literals so the demo
 * seed can reference them and the seed stays idempotent (INSERT OR IGNORE in the
 * Flutter app).
 */
import type { VaccineType } from '@/lib/rules/types'

import { db } from '../db'

/** Stable catalog ids used by the demo seed and, later, vaccination forms. */
export const VACCINE_TYPE_IDS = {
  rabies: 'vaccine-rabies',
  dhpp: 'vaccine-dhpp',
  leptospirosis: 'vaccine-leptospirosis',
  bordetella: 'vaccine-bordetella',
  fvrcp: 'vaccine-fvrcp',
  felv: 'vaccine-felv',
  deworming: 'vaccine-deworming',
} as const

export const VACCINE_TYPE_SEEDS: readonly VaccineType[] = [
  {
    id: VACCINE_TYPE_IDS.rabies,
    name: 'Rabies',
    intervalMonths: 12,
    isCore: true,
    sortOrder: 10,
  },
  { id: VACCINE_TYPE_IDS.dhpp, name: 'DHPP', intervalMonths: 12, isCore: true, sortOrder: 20 },
  {
    id: VACCINE_TYPE_IDS.leptospirosis,
    name: 'Leptospirosis',
    intervalMonths: 12,
    isCore: false,
    sortOrder: 30,
  },
  {
    id: VACCINE_TYPE_IDS.bordetella,
    name: 'Bordetella',
    intervalMonths: 12,
    isCore: false,
    sortOrder: 40,
  },
  { id: VACCINE_TYPE_IDS.fvrcp, name: 'FVRCP', intervalMonths: 12, isCore: true, sortOrder: 50 },
  { id: VACCINE_TYPE_IDS.felv, name: 'FeLV', intervalMonths: 12, isCore: false, sortOrder: 60 },
  {
    id: VACCINE_TYPE_IDS.deworming,
    name: 'Deworming',
    intervalMonths: 3,
    isCore: false,
    sortOrder: 70,
  },
]

/** Idempotent: adds only the catalog rows that are missing. */
export async function seedVaccineCatalog(): Promise<void> {
  await db.transaction('rw', db.vaccine_type, async () => {
    for (const seed of VACCINE_TYPE_SEEDS) {
      const existing = await db.vaccine_type.get(seed.id)
      if (existing === undefined) {
        await db.vaccine_type.add({ ...seed })
      }
    }
  })
}
