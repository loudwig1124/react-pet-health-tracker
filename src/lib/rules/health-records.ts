/**
 * R5 — clinical notes are append-only.
 *
 * IndexedDB has no triggers, so the guarantee is a repository-surface rule:
 * `src/lib/db/repositories/health-records.ts` exports exactly the read and
 * append operations below — no update, no delete (a test fails if one appears).
 * The only deletion is the pet-delete cascade.
 *
 * This module carries the draft rule (at least one of condition/diagnosis must
 * be non-empty) and the row title, both pure.
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
] as const

export type HealthRecordRepositoryOperation = (typeof HEALTH_RECORD_REPOSITORY_OPERATIONS)[number]

/** Operations that must never be exported for clinical notes. */
export const HEALTH_RECORD_FORBIDDEN_OPERATIONS = [
  'update',
  'updateHealthRecord',
  'saveHealthRecord',
  'delete',
  'deleteHealthRecord',
  'removeHealthRecord',
  'clearHealthRecords',
] as const

/** The only allowed deletion path is the pet-delete cascade. */
export const HEALTH_RECORD_DELETE_PATHS = ['pet-cascade'] as const

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
