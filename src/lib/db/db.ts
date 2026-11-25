/**
 * Dexie v1 — the seven household entities over IndexedDB (01 D6, 02 §3–§4).
 *
 * Indexes mirror 02 §4 risk 3: compound indexes for the two ordered per-pet
 * lists (`[petId+occurredAt]`, `[petId+recordedOn]`, `[petId+vaccinationDate]`)
 * plus the household query keys (`scheduledAt`, `nextDueDate`) and the two
 * UNIQUE constraints SQL used to enforce (`pet.microchip`, `vaccine_type.name`).
 *
 * No raw table access outside `src/lib/db/repositories/**` — repositories are
 * the write path (02 R10).
 */
import Dexie, { type EntityTable } from 'dexie'

import type {
  Appointment,
  HealthRecord,
  JournalEntry,
  Owner,
  Pet,
  Vaccination,
  VaccineType,
} from '@/lib/rules/types'

export const DB_NAME = 'pet-health'

/** The seven stores (02 §3). Snake-case names mirror `db/schema.sql`. */
export type PetHealthTable =
  | 'owner'
  | 'pet'
  | 'journal_entry'
  | 'health_record'
  | 'vaccination'
  | 'appointment'
  | 'vaccine_type'

export class PetHealthDB extends Dexie {
  owner!: EntityTable<Owner, 'id'>
  pet!: EntityTable<Pet, 'id'>
  journal_entry!: EntityTable<JournalEntry, 'id'>
  health_record!: EntityTable<HealthRecord, 'id'>
  vaccination!: EntityTable<Vaccination, 'id'>
  appointment!: EntityTable<Appointment, 'id'>
  vaccine_type!: EntityTable<VaccineType, 'id'>

  constructor(name: string = DB_NAME) {
    super(name)
    this.version(1).stores({
      owner: 'id',
      pet: 'id, &microchip, name',
      journal_entry: 'id, petId, occurredAt, [petId+occurredAt]',
      health_record: 'id, petId, recordedOn, [petId+recordedOn]',
      vaccination: 'id, petId, nextDueDate, vaccinationDate, [petId+vaccinationDate]',
      appointment: 'id, petId, scheduledAt, status, [status+scheduledAt]',
      vaccine_type: 'id, &name, sortOrder',
    })
  }
}

/** The app-wide connection. Tests instantiate `new PetHealthDB(uniqueName)`. */
export const db = new PetHealthDB()

/**
 * Opens the singleton once. Calling it again is cheap: Dexie caches the open
 * connection, and a `versionchange` (another tab upgrading) asks the browser to
 * reload rather than letting this tab run against a stale schema.
 */
export async function openDb(): Promise<PetHealthDB> {
  if (!db.isOpen()) {
    db.on('versionchange', () => {
      db.close()
      window.location.reload()
    })
    try {
      await db.open()
    } catch (error) {
      db.close()
      throw error
    }
  }
  return db
}
