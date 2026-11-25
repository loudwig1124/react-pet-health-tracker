import { listAppointmentsForPet } from '@/lib/db/repositories/appointments'
import { listHealthRecordsForPet } from '@/lib/db/repositories/health-records'
import { listJournalForPet } from '@/lib/db/repositories/journal'
/**
 * Pet-detail read model, live (R10): the pet, its owner, current doses, its
 * clinical history, appointments and the last few journal entries. Only the
 * M2 panels consume it now; M3/M4 tabs reuse the same subscription so a write
 * anywhere refreshes the whole page.
 */
import { getOwner } from '@/lib/db/repositories/owners'
import { getPet, listPets } from '@/lib/db/repositories/pets'
import { listVaccinationsForPet } from '@/lib/db/repositories/vaccinations'
import { todayKey } from '@/lib/rules/calendar'
import type {
  Appointment,
  HealthRecord,
  JournalEntry,
  Owner,
  Pet,
  Vaccination,
  WeightUnit,
} from '@/lib/rules/types'

import { useLiveResult, type LiveResultHandle } from './useLiveResult'
import type { PetPageSettings } from './usePetsPageData'

export interface PetDetailData {
  pet: Pet | null
  /** The whole household, for the edit form's microchip-uniqueness check. */
  pets: Pet[]
  owner: Owner | null
  doses: Vaccination[]
  records: HealthRecord[]
  appointments: Appointment[]
  /** The three newest entries for the context rail. */
  journal: JournalEntry[]
  today: string
  /** Read once per query so render never calls the clock (React purity lint). */
  nowIso: string
  windowDays: number
  weightUnit: WeightUnit
}

export function usePetDetailData(
  petId: string,
  settings: PetPageSettings,
): LiveResultHandle<PetDetailData> {
  const { dueSoonWindowDays, weightUnit } = settings
  return useLiveResult(async () => {
    const now = new Date()
    const today = todayKey(now)
    const nowIso = now.toISOString()
    const [pet, owner, pets] = await Promise.all([getPet(petId), getOwner(), listPets()])
    const base = {
      owner: owner ?? null,
      pets,
      today,
      nowIso,
      windowDays: dueSoonWindowDays,
      weightUnit,
    }
    if (pet === undefined) {
      return {
        ...base,
        pet: null,
        doses: [],
        records: [],
        appointments: [],
        journal: [],
      }
    }
    const [doses, records, appointments, journal] = await Promise.all([
      listVaccinationsForPet(pet.id),
      listHealthRecordsForPet(pet.id),
      listAppointmentsForPet(pet.id),
      listJournalForPet(pet.id, { limit: 3 }),
    ])
    return { ...base, pet, doses, records, appointments, journal }
  }, [petId, dueSoonWindowDays, weightUnit])
}
