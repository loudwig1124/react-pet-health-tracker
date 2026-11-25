/**
 * A live, read-only pet list for pickers and filters (dialog pet selects,
 * `/vaccinations`, `/appointments`). Sorted by name, case-insensitive (02 §3);
 * `undefined` while the first IndexedDB read is in flight.
 */
import { useLiveQuery } from 'dexie-react-hooks'

import { listPets } from '@/lib/db/repositories/pets'
import type { Pet } from '@/lib/rules/types'

export function usePetsForPicker(): Pet[] | undefined {
  return useLiveQuery(() => listPets(), [])
}
