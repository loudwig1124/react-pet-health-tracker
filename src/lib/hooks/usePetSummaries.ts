import { useLiveQuery } from 'dexie-react-hooks'

import { listPetSummaries, type PetSummary } from '@/lib/db/repositories/pet-summary'

/**
 * The dashboard's pet chips and quick-log picker, live. Summary rows only, so
 * the initial route chunk stays out of the write-path rules (see the module
 * comment in `repositories/pet-summary.ts`).
 */
export function usePetSummaries(): PetSummary[] | undefined {
  return useLiveQuery(() => listPetSummaries(), [], undefined)
}
