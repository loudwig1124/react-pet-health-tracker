/**
 * Household operations that span entities — R8 reset (and the shared delete
 * order for demo rows). Every write runs in one transaction so a partial reset
 * cannot survive a failure.
 */
import {
  demoAppointmentIds,
  demoHealthRecordIds,
  demoJournalEntryIds,
  demoPetIds,
  demoVaccinationIds,
} from '@/lib/rules/demo-ownership'
import { planHouseholdReset } from '@/lib/rules/household-reset'

import { db } from '../db'
import { saveSettings } from '../settings'
import { toIsoInstant } from '../write-helpers'
import { OWNER_ID, ensureOwner } from './owners'

export interface ResetHouseholdOptions {
  /** The "Also forget my name and details" checkbox (R8, default off). */
  forgetOwner: boolean
}

/**
 * Delete all appointments, then all pets (cascading journal, vaccinations,
 * clinical notes), turn sample data off, and blank name/email/phone only when
 * "also forget" was checked. Not undoable — the UI always confirms first.
 */
export async function resetHousehold(
  options: ResetHouseholdOptions,
  now: Date = new Date(),
): Promise<void> {
  const plan = planHouseholdReset(options)
  const nowIso = toIsoInstant(now)

  await db.transaction(
    'rw',
    [db.owner, db.pet, db.vaccination, db.health_record, db.appointment, db.journal_entry],
    async () => {
      // 1. delete-all-appointments
      await db.appointment.clear()

      // 2. delete-demo-rows (exact ids; never a range or prefix, R7)
      await db.journal_entry.bulkDelete([...demoJournalEntryIds])
      await db.health_record.bulkDelete([...demoHealthRecordIds])
      await db.vaccination.bulkDelete([...demoVaccinationIds])
      await db.appointment.bulkDelete([...demoAppointmentIds])
      await db.pet.bulkDelete([...demoPetIds])

      // 3. delete-all-pets + the explicit cascade IndexedDB does not provide
      await db.journal_entry.clear()
      await db.health_record.clear()
      await db.vaccination.clear()
      await db.pet.clear()

      // 5. blank-owner (only with the checkbox)
      if (plan.ownerPatch !== null) {
        await ensureOwner(now)
        await db.owner.update(OWNER_ID, { ...plan.ownerPatch, updatedAt: nowIso })
      }
    },
  )

  // 4. set-sample-data-off (settings live outside the Dexie transaction)
  saveSettings({ sampleDataEnabled: false })
}

/** True while the fixed demo ids are present (R7 "demo exists"). */
export async function hasDemoData(): Promise<boolean> {
  return (
    (await db.pet
      .where('id')
      .anyOf([...demoPetIds])
      .count()) > 0
  )
}
