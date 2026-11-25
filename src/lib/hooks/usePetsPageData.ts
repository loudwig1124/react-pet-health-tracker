import { buildPetTableRows, type PetTableRow } from '@/lib/pets-table'
import { todayKey } from '@/lib/rules/calendar'
import type { Pet, WeightUnit } from '@/lib/rules/types'

/**
 * `/pets` read model, live (R10): pets + every household dose in one query, so
 * a write from the pet form, the detail page or another tab re-renders the table
 * without a manual refresh. The R1 due status is computed by `pets-table`, never
 * re-implemented here.
 */
import { getPetsAndDoses } from './shared-queries'
import { useLiveResult, type LiveResultHandle } from './useLiveResult'

/** The R2 settings slice the rows depend on (reactive through `useSettings`). */
export interface PetPageSettings {
  dueSoonWindowDays: number
  weightUnit: WeightUnit
}

export interface PetsPageData {
  pets: Pet[]
  rows: PetTableRow[]
  today: string
  windowDays: number
  weightUnit: WeightUnit
}

export function usePetsPageData(settings: PetPageSettings): LiveResultHandle<PetsPageData> {
  const { dueSoonWindowDays, weightUnit } = settings
  return useLiveResult(async () => {
    const today = todayKey(new Date())
    const { pets, dosesByPet } = await getPetsAndDoses()
    return {
      pets,
      rows: buildPetTableRows(pets, dosesByPet, {
        today,
        windowDays: dueSoonWindowDays,
        weightUnit,
      }),
      today,
      windowDays: dueSoonWindowDays,
      weightUnit,
    }
  }, [dueSoonWindowDays, weightUnit])
}
