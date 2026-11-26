/**
 * R5 — clinical notes (amended 2026-11-27, owner decision C).
 *
 * The original rule was append-only: notes could be written but never corrected,
 * so a misclicked diagnosis was permanent. The owner accepted the trade of
 * mutability for correctness, so the repository surface is now read + append +
 * update + delete, and the surface test below asserts exactly that list.
 *
 * What R5 still guarantees:
 * - a note can never be written without one of condition/diagnosis (the draft
 *   rule below), and an update re-runs the same rule;
 * - deleting a pet still removes its records through the pet cascade;
 * - there is no bulk "clear all records" operation.
 *
 * There is deliberately no audit trail: a correction replaces the row. That is
 * stated in ACCEPTANCE §5d rather than implied.
 */

import { isDateKey } from './calendar'
import type { DateKey, HealthRecord, HealthRecordDraft } from './types'

/**
 * The exact export surface of the health-record repository. The surface test
 * imports the module and compares its export names with this list.
 */
export const HEALTH_RECORD_REPOSITORY_OPERATIONS = [
  'listHealthRecordsForPet',
  'appendHealthRecord',
  'updateHealthRecord',
  'deleteHealthRecord',
] as const

export type HealthRecordRepositoryOperation = (typeof HEALTH_RECORD_REPOSITORY_OPERATIONS)[number]

/** Operations that must never be exported for clinical notes: bulk wipes. */
export const HEALTH_RECORD_FORBIDDEN_OPERATIONS = [
  'clearHealthRecords',
  'resetHealthRecords',
  'deleteAllHealthRecords',
] as const

/** Deletion happens one record at a time, or with the pet that owns it. */
export const HEALTH_RECORD_DELETE_PATHS = ['pet-cascade', 'record-delete'] as const

export type HealthRecordField = 'petId' | 'recordedOn' | 'condition' | 'diagnosis'

export type HealthRecordFieldErrors = Partial<Record<HealthRecordField, string>>

export interface ValidatedHealthRecordDraft {
  petId: string
  recordedOn: DateKey
  condition: string | null
  diagnosis: string | null
  treatment: string | null
  prescribedMedication: string | null
  vetName: string | null
}

export interface HealthRecordValidationResult {
  isValid: boolean
  errors: HealthRecordFieldErrors
  value: ValidatedHealthRecordDraft | null
}

export function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed == null || trimmed === '' ? null : trimmed
}

/**
 * Validates an append. At least one of condition/diagnosis must be non-empty
 * after trimming (mirrors the Flutter DDL check).
 */
export function validateHealthRecordDraft(draft: HealthRecordDraft): HealthRecordValidationResult {
  const errors: HealthRecordFieldErrors = {}
  const petId = typeof draft.petId === 'string' ? draft.petId.trim() : ''
  if (petId === '') {
    errors.petId = 'Pick a pet'
  }
  if (typeof draft.recordedOn !== 'string' || !isDateKey(draft.recordedOn)) {
    errors.recordedOn = 'Pick the date of the visit'
  }
  const condition = normalizeOptionalText(draft.condition)
  const diagnosis = normalizeOptionalText(draft.diagnosis)
  if (condition === null && diagnosis === null) {
    errors.condition = 'Add a condition or a diagnosis'
  }
  const isValid = Object.keys(errors).length === 0
  return {
    isValid,
    errors,
    value: isValid
      ? {
          petId,
          recordedOn: draft.recordedOn,
          condition,
          diagnosis,
          treatment: normalizeOptionalText(draft.treatment),
          prescribedMedication: normalizeOptionalText(draft.prescribedMedication),
          vetName: normalizeOptionalText(draft.vetName),
        }
      : null,
  }
}

/** Condition when present, otherwise the diagnosis — the row title (02 §1). */
export function healthRecordTitle(record: Pick<HealthRecord, 'condition' | 'diagnosis'>): string {
  return normalizeOptionalText(record.condition) ?? normalizeOptionalText(record.diagnosis) ?? ''
}
