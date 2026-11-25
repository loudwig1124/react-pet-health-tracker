import { addDays, addMonths, todayKey } from '@/lib/rules/calendar'
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'
/**
 * The opt-in demo household (02 R7, 06 M1) — two pets with an overdue rabies
 * booster, a due-soon FeLV dose, clinical notes, one upcoming and one completed
 * visit, and everyday journal entries. Dates are relative to the seed instant so
 * the demo never looks stale.
 *
 * Ownership is the **fixed id lists** in `src/lib/rules/demo-ownership.ts`,
 * never an id range or the `demo-` prefix (bug D1). `createdAt` values are
 * strictly increasing so same-day dose tie-breaks are deterministic (01 D6a).
 */
import {
  createDemoCreatedAt,
  demoAppointmentIds,
  demoHealthRecordIds,
  demoJournalEntryIds,
  demoPetIds,
  demoVaccinationIds,
  demoOwnerPersonaName,
  planDemoOwnerRestore,
} from '@/lib/rules/demo-ownership'
import type {
  Appointment,
  DateKey,
  HealthRecord,
  IsoInstant,
  JournalEntry,
  Pet,
  Vaccination,
} from '@/lib/rules/types'

import { db } from '../db'
import { OWNER_ID, ensureOwner } from '../repositories/owners'
import {
  appointmentSchema,
  healthRecordSchema,
  journalEntrySchema,
  parseRow,
  petSchema,
  vaccinationSchema,
} from '../schema'
import { toIsoInstant } from '../write-helpers'
import { VACCINE_TYPE_IDS } from './catalog'

/** Row order for the `createdAt` contract: pets, doses, records, visits, journal. */
const TOTAL_DEMO_ROWS =
  demoPetIds.length +
  demoVaccinationIds.length +
  demoHealthRecordIds.length +
  demoAppointmentIds.length +
  demoJournalEntryIds.length

/** Local fixed-clock instant for a date-only value (demo should read like a day). */
function atLocal(day: DateKey, hour: number, minute: number): IsoInstant {
  const year = Number(day.slice(0, 4))
  const month = Number(day.slice(5, 7))
  const date = Number(day.slice(8, 10))
  return new Date(year, month - 1, date, hour, minute, 0, 0).toISOString()
}

export async function hasDemoData(): Promise<boolean> {
  return (
    (await db.pet
      .where('id')
      .anyOf([...demoPetIds])
      .count()) > 0
  )
}

/**
 * Inserts the demo household. Returns `true` when it seeded, `false` when demo
 * rows already exist (idempotent; dates are not refreshed on a no-op).
 */
export async function seedDemoHousehold(now: Date = new Date()): Promise<boolean> {
  if (await hasDemoData()) {
    return false
  }

  const owner = await ensureOwner(now)
  const today = todayKey(now)
  const seedIso = toIsoInstant(now)
  let rowIndex = 0
  const createdAt = (): IsoInstant => createDemoCreatedAt(now, rowIndex++, TOTAL_DEMO_ROWS)

  const pets: Pet[] = [
    parseRow(
      petSchema,
      {
        id: demoPetIds[0],
        ownerId: OWNER_ID,
        name: 'Bella',
        species: 'Dog',
        breed: 'Golden Retriever mix',
        sex: 'female',
        dateOfBirth: addMonths(today, -62),
        weightKg: 12.4,
        microchip: '900215004123456',
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo pet',
    ),
    parseRow(
      petSchema,
      {
        id: demoPetIds[1],
        ownerId: OWNER_ID,
        name: 'Miso',
        species: 'Cat',
        breed: 'Domestic shorthair',
        sex: 'male',
        dateOfBirth: addMonths(today, -40),
        weightKg: 4.2,
        microchip: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo pet',
    ),
  ]

  const vaccinations: Vaccination[] = [
    parseRow(
      vaccinationSchema,
      {
        id: demoVaccinationIds[0],
        petId: demoPetIds[0],
        vaccineTypeId: VACCINE_TYPE_IDS.rabies,
        vaccineName: 'Rabies',
        vaccinationDate: addDays(today, -400),
        nextDueDate: addDays(today, -35),
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo vaccination',
    ),
    parseRow(
      vaccinationSchema,
      {
        id: demoVaccinationIds[1],
        petId: demoPetIds[0],
        vaccineTypeId: VACCINE_TYPE_IDS.dhpp,
        vaccineName: 'DHPP',
        vaccinationDate: addDays(today, -200),
        nextDueDate: addDays(today, 120),
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo vaccination',
    ),
    parseRow(
      vaccinationSchema,
      {
        id: demoVaccinationIds[2],
        petId: demoPetIds[1],
        vaccineTypeId: VACCINE_TYPE_IDS.fvrcp,
        vaccineName: 'FVRCP',
        vaccinationDate: addDays(today, -300),
        nextDueDate: addDays(today, 60),
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo vaccination',
    ),
    parseRow(
      vaccinationSchema,
      {
        id: demoVaccinationIds[3],
        petId: demoPetIds[1],
        vaccineTypeId: VACCINE_TYPE_IDS.felv,
        vaccineName: 'FeLV',
        vaccinationDate: addDays(today, -355),
        nextDueDate: addDays(today, 10),
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo vaccination',
    ),
  ]

  const healthRecords: HealthRecord[] = [
    parseRow(
      healthRecordSchema,
      {
        id: demoHealthRecordIds[0],
        petId: demoPetIds[0],
        recordedOn: addDays(today, -25),
        condition: 'Otitis externa (left ear)',
        diagnosis: 'Bacterial ear infection',
        treatment: 'Ear cleaning and antibiotic drops for 10 days',
        prescribedMedication: 'Ofloxacin otic drops',
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo health record',
    ),
    parseRow(
      healthRecordSchema,
      {
        id: demoHealthRecordIds[1],
        petId: demoPetIds[1],
        recordedOn: addDays(today, -120),
        condition: 'Healthy annual exam',
        diagnosis: null,
        treatment: 'None needed',
        prescribedMedication: null,
        vetName: 'Dr. Ana Cruz',
        createdAt: createdAt(),
      },
      'demo health record',
    ),
  ]

  const completedAt = new Date(
    new Date(atLocal(addDays(today, -20), 14, 0)).getTime() + 45 * 60 * 1000,
  ).toISOString()
  const appointments: Appointment[] = [
    parseRow(
      appointmentSchema,
      {
        id: demoAppointmentIds[0],
        petId: demoPetIds[0],
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Annual wellness check',
        scheduledAt: atLocal(addDays(today, 5), 9, 30),
        status: 'scheduled',
        completedAt: null,
        cancelReason: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo appointment',
    ),
    parseRow(
      appointmentSchema,
      {
        id: demoAppointmentIds[1],
        petId: demoPetIds[1],
        clinicName: 'Paws & Claws Veterinary Clinic',
        purpose: 'Dental cleaning',
        scheduledAt: atLocal(addDays(today, -20), 14, 0),
        status: 'completed',
        completedAt,
        cancelReason: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo appointment',
    ),
  ]

  const journal: JournalEntry[] = [
    parseRow(
      journalEntrySchema,
      {
        id: demoJournalEntryIds[0],
        petId: demoPetIds[0],
        kind: 'walk',
        occurredAt: atLocal(addDays(today, -1), 7, 10),
        note: 'Morning loop around the block',
        durationMinutes: 30,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo journal entry',
    ),
    parseRow(
      journalEntrySchema,
      {
        id: demoJournalEntryIds[1],
        petId: demoPetIds[1],
        kind: 'fed',
        occurredAt: atLocal(today, 7, 0),
        note: 'Half a can of salmon pâté',
        durationMinutes: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo journal entry',
    ),
    parseRow(
      journalEntrySchema,
      {
        id: demoJournalEntryIds[2],
        petId: demoPetIds[0],
        kind: 'note',
        occurredAt: atLocal(addDays(today, -3), 20, 15),
        note: 'Slept through the thunderstorm',
        durationMinutes: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo journal entry',
    ),
    parseRow(
      journalEntrySchema,
      {
        id: demoJournalEntryIds[3],
        petId: demoPetIds[1],
        kind: 'symptom',
        occurredAt: atLocal(addDays(today, -5), 8, 30),
        note: 'Sneezed twice after breakfast',
        durationMinutes: null,
        createdAt: createdAt(),
        updatedAt: seedIso,
      },
      'demo journal entry',
    ),
  ]

  await db.transaction(
    'rw',
    [db.owner, db.pet, db.vaccination, db.health_record, db.appointment, db.journal_entry],
    async () => {
      // Only an untouched placeholder is renamed; never a name the owner typed.
      if (owner.name === DEFAULT_OWNER_NAME) {
        await db.owner.update(OWNER_ID, {
          name: demoOwnerPersonaName,
          updatedAt: seedIso,
        })
      }
      await db.pet.bulkAdd(pets)
      await db.vaccination.bulkAdd(vaccinations)
      await db.health_record.bulkAdd(healthRecords)
      await db.appointment.bulkAdd(appointments)
      await db.journal_entry.bulkAdd(journal)
    },
  )

  return true
}

/**
 * Removes exactly the demo rows. Owner rows survive: an appointment attached to
 * a demo pet becomes a Household visit, and the owner is restored to the
 * placeholder only when the demo persona is untouched (D5/D11 parity).
 */
export async function clearDemoHousehold(now: Date = new Date()): Promise<void> {
  const nowIso = toIsoInstant(now)
  await db.transaction(
    'rw',
    [db.owner, db.pet, db.vaccination, db.health_record, db.appointment, db.journal_entry],
    async () => {
      // Keep user-created visits that happen to reference a demo pet.
      await db.appointment
        .where('petId')
        .anyOf([...demoPetIds])
        .modify({ petId: null, updatedAt: nowIso })
      await db.appointment.bulkDelete([...demoAppointmentIds])

      // Pet cascade for demo pets (covers user rows attached to a demo pet).
      await db.journal_entry
        .where('petId')
        .anyOf([...demoPetIds])
        .delete()
      await db.health_record
        .where('petId')
        .anyOf([...demoPetIds])
        .delete()
      await db.vaccination
        .where('petId')
        .anyOf([...demoPetIds])
        .delete()

      // Exact-id deletion for any demo row not attached to a demo pet.
      await db.journal_entry.bulkDelete([...demoJournalEntryIds])
      await db.health_record.bulkDelete([...demoHealthRecordIds])
      await db.vaccination.bulkDelete([...demoVaccinationIds])
      await db.pet.bulkDelete([...demoPetIds])

      const owner = await db.owner.get(OWNER_ID)
      if (owner !== undefined) {
        const restore = planDemoOwnerRestore(owner)
        if (restore !== null) {
          await db.owner.update(OWNER_ID, { ...restore, updatedAt: nowIso })
        }
      }
    },
  )
}
