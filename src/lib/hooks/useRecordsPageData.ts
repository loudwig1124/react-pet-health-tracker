import { listHealthRecordsForPet } from '@/lib/db/repositories/health-records'
/**
 * `/records` read model, live (R10). Health records are correctable (R5), so
 * the household view is assembled from the per-pet read — never by adding an
 * update/delete/list-everything export to the repository. Deleting a pet
 * cascades its notes, so iterating the pet list stays complete.
 */
import { listPets } from '@/lib/db/repositories/pets'
import { buildRecordRows, type RecordRow } from '@/lib/records-table'
import { todayKey } from '@/lib/rules/calendar'
import type { Pet } from '@/lib/rules/types'

import { useLiveResult, type LiveResultHandle } from './useLiveResult'

export interface RecordsPageData {
  pets: Pet[]
  rows: RecordRow[]
  today: string
}

export function useRecordsPageData(): LiveResultHandle<RecordsPageData> {
  return useLiveResult(async () => {
    const today = todayKey(new Date())
    const pets = await listPets()
    const recordLists = await Promise.all(pets.map((pet) => listHealthRecordsForPet(pet.id)))
    return { pets, rows: buildRecordRows(pets, recordLists.flat()), today }
  }, [])
}
