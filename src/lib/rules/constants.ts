/**
 * Runtime constants for the pure rules: allowed enum tuples, label maps and
 * small fixed values. Kept apart from `types.ts` so that module stays
 * type-only.
 *
 * These tuples are the single source of truth for the Zod/repository checks and
 * for the UI selects — do not restate the lists in feature code.
 */

import type {
  AppointmentStatus,
  JournalKind,
  PetSex,
  VaccinationDueStatus,
  WeightUnit,
} from './types'

export const PET_SEXES = ['male', 'female', 'unknown'] as const satisfies readonly PetSex[]

export const JOURNAL_KINDS = [
  'walk',
  'fed',
  'meds',
  'grooming',
  'training',
  'note',
  'symptom',
] as const satisfies readonly JournalKind[]

/** Home's four quick-log chips, in fixed order (02 §1). */
export const QUICK_LOG_KINDS = [
  'walk',
  'fed',
  'meds',
  'note',
] as const satisfies readonly JournalKind[]

export const APPOINTMENT_STATUSES = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const satisfies readonly AppointmentStatus[]

export const VACCINATION_DUE_STATUSES = [
  'overdue',
  'due_soon',
  'up_to_date',
] as const satisfies readonly VaccinationDueStatus[]

export const WEIGHT_UNITS = ['kg', 'lb'] as const satisfies readonly WeightUnit[]

export const PET_SEX_LABELS: Record<PetSex, string> = {
  male: 'Male',
  female: 'Female',
  unknown: 'Unknown',
}

export const JOURNAL_KIND_LABELS: Record<JournalKind, string> = {
  walk: 'Walk',
  fed: 'Fed',
  meds: 'Meds',
  grooming: 'Grooming',
  training: 'Training',
  note: 'Note',
  symptom: 'Symptom',
}

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
}

export const VACCINATION_DUE_STATUS_LABELS: Record<VaccinationDueStatus, string> = {
  overdue: 'Overdue',
  due_soon: 'Due soon',
  up_to_date: 'Up to date',
}

export const WEIGHT_UNIT_LABELS: Record<WeightUnit, string> = {
  kg: 'Kilograms',
  lb: 'Pounds',
}

/** The 10 species the select offers; a legacy value outside the list still shows. */
export const SPECIES_OPTIONS = [
  'Dog',
  'Cat',
  'Rabbit',
  'Hamster',
  'Guinea pig',
  'Bird',
  'Ferret',
  'Turtle',
  'Fish',
  'Other',
] as const

/** Name a household starts with before anyone says who they are (R8). */
export const DEFAULT_OWNER_NAME = 'My household'

/** The demo persona's name; only ever replaces an untouched placeholder (R7). */
export const DEMO_OWNER_PERSONA_NAME = 'Maria Santos'
