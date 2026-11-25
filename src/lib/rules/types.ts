/**
 * The seven household entities, their enum unions and the draft shapes the
 * forms submit (02 §3).
 *
 * This module is intentionally **type-only**: it has no runtime imports and no
 * runtime values, so both the pure rules and the Dexie layer can import it with
 * `import type` without creating a dependency edge. Runtime constants (the
 * allowed enum tuples, label maps and defaults) live in `constants.ts`.
 *
 * Conventions:
 * - ids are strings: `crypto.randomUUID()` for household rows, literal
 *   `demo-*` ids for the sample household (01 D6a).
 * - instants are ISO-8601 UTC strings with milliseconds.
 * - date-only values are fixed-width `YYYY-MM-DD` strings that compare as
 *   strings (R2/R4).
 */

/** ISO-8601 UTC instant with milliseconds, e.g. `2026-03-02T08:30:00.000Z`. */
export type IsoInstant = string

/** Date-only value, fixed width, e.g. `2026-03-02` (R2/R4). */
export type DateKey = string

export type PetSex = 'male' | 'female' | 'unknown'

export type JournalKind = 'walk' | 'fed' | 'meds' | 'grooming' | 'training' | 'note' | 'symptom'

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show'

/** R1: the three faces of a vaccination due date. */
export type VaccinationDueStatus = 'overdue' | 'due_soon' | 'up_to_date'

export type WeightUnit = 'kg' | 'lb'

/** The single household profile row (fixed key, no accounts). */
export interface Owner {
  id: string
  name: string
  email: string
  phone: string
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export interface OwnerDraft {
  name: string
  email: string
  phone: string
}

/** A household pet. Deliberately has **no** photo field in v1 (02 §0). */
export interface Pet {
  id: string
  ownerId: string
  name: string
  species: string
  breed: string | null
  sex: PetSex
  dateOfBirth: DateKey
  weightKg: number
  microchip: string | null
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export interface PetDraft {
  name: string
  species: string
  breed: string | null
  sex: PetSex
  dateOfBirth: DateKey
  weightKg: number
  microchip: string | null
}

/** An everyday household log entry (R6). */
export interface JournalEntry {
  id: string
  petId: string
  kind: JournalKind
  occurredAt: IsoInstant
  note: string | null
  durationMinutes: number | null
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export interface JournalDraft {
  petId: string
  kind: JournalKind
  occurredAt: IsoInstant
  note: string | null
  durationMinutes: number | null
}

/**
 * A clinical note. Append-only: there is no `updatedAt` and the repository
 * surface exposes no update/delete (R5).
 */
export interface HealthRecord {
  id: string
  petId: string
  recordedOn: DateKey
  condition: string | null
  diagnosis: string | null
  treatment: string | null
  prescribedMedication: string | null
  vetName: string | null
  createdAt: IsoInstant
}

export interface HealthRecordDraft {
  petId: string
  recordedOn: DateKey
  condition: string | null
  diagnosis: string | null
  treatment: string | null
  prescribedMedication: string | null
  vetName: string | null
}

/**
 * A vaccination dose. `vaccineName` is a display snapshot and never a ranking
 * key; `nextDueDate` is null or strictly after `vaccinationDate` (R1).
 */
export interface Vaccination {
  id: string
  petId: string
  vaccineTypeId: string | null
  vaccineName: string
  vaccinationDate: DateKey
  nextDueDate: DateKey | null
  vetName: string | null
  createdAt: IsoInstant
}

export interface VaccinationDraft {
  petId: string
  vaccineTypeId: string | null
  vaccineName: string
  vaccinationDate: DateKey
  nextDueDate: DateKey | null
  vetName: string | null
}

/** A seeded catalog entry; `intervalMonths` prefills the next due date. */
export interface VaccineType {
  id: string
  name: string
  intervalMonths: number | null
  isCore: boolean
  sortOrder: number
}

/** A vet visit and its state machine (R3). */
export interface Appointment {
  id: string
  /** `null` means a household-level visit, rendered as "Household". */
  petId: string | null
  clinicName: string
  purpose: string
  scheduledAt: IsoInstant
  status: AppointmentStatus
  completedAt: IsoInstant | null
  cancelReason: string | null
  createdAt: IsoInstant
  updatedAt: IsoInstant
}

export interface AppointmentDraft {
  petId: string | null
  clinicName: string
  purpose: string
  scheduledAt: IsoInstant
}

/** R2 settings; stored outside the seven tables as one JSON record. */
export interface Settings {
  dueSoonWindowDays: number
  weightUnit: WeightUnit
  sampleDataEnabled: boolean
}

/** Derived read model: everything the pet card/header needs in one object. */
export interface PetOverview {
  pet: Pet
  dueStatus: VaccinationDueStatus
  nextVaccination: Vaccination | null
  nextAppointment: Appointment | null
  lastVisit: DateKey | null
}

/** Derived read model for the dashboard (F1 consumes it from M5). */
export interface Dashboard {
  owner: Owner
  pets: PetOverview[]
  nextAppointments: Appointment[]
  recentEntries: JournalEntry[]
}

/** A pet filter request: `null` means "open unfiltered" (R10). */
export interface PetFilterHandoff {
  petId: string | null
}
