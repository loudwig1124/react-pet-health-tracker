/**
 * R8 — reset household.
 *
 * Delete every appointment, then every pet (IndexedDB has no cascades, so the
 * repository does the explicit multi-step delete: the pet delete removes its
 * journal entries, vaccinations and clinical notes and keeps its appointments
 * with `petId = null`), turn sample data off, and blank name/email/phone only
 * when "also forget my details" was checked. A reset is not undoable, so the UI
 * always confirms first.
 *
 * Pure: this module plans the write; the household repository executes it.
 */

import { DEFAULT_OWNER_NAME } from './constants'
import type { OwnerDraft } from './types'

export type HouseholdResetOperation =
  | 'delete-all-appointments'
  | 'delete-all-pets'
  | 'delete-demo-rows'
  | 'set-sample-data-off'
  | 'blank-owner'

/** The write order the repository must follow (appointments before pets). */
export const HOUSEHOLD_RESET_OPERATION_ORDER = [
  'delete-all-appointments',
  'delete-demo-rows',
  'delete-all-pets',
  'set-sample-data-off',
  'blank-owner',
] as const satisfies readonly HouseholdResetOperation[]

export interface HouseholdResetPlan {
  /** Appointments are deleted first, then pets (whose cascade keeps none). */
  operations: HouseholdResetOperation[]
  /** `null` keeps the owner row exactly as typed (checkbox off). */
  ownerPatch: OwnerDraft | null
}

/**
 * Plans a reset. `forgetOwner` is the "Also forget my name and details"
 * checkbox: off → the owner row keeps its name and contacts; on → name back to
 * the placeholder and both contact fields emptied.
 */
export function planHouseholdReset(options: { forgetOwner: boolean }): HouseholdResetPlan {
  const operations: HouseholdResetOperation[] = [
    'delete-all-appointments',
    'delete-demo-rows',
    'delete-all-pets',
    'set-sample-data-off',
  ]
  if (options.forgetOwner) {
    operations.push('blank-owner')
  }
  return {
    operations,
    ownerPatch: options.forgetOwner ? { name: DEFAULT_OWNER_NAME, email: '', phone: '' } : null,
  }
}
