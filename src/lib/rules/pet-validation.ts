/**
 * R9 — pet identity rules. Pure: the form passes the draft, `today` and the
 * existing pets in; this returns per-field errors so the UI can place each
 * message next to its input, and never writes anything itself.
 *
 * Bounds: name 1–40, species 1–30, breed ≤ 40, sex `male|female|unknown`, DOB
 * required, not future and not older than 40 years, weight `0 < w ≤ 300`,
 * microchip 9–15 digits (blank → null, unique across pets).
 */

import { addMonths, compareDateKeys, isDateKey } from './calendar'
import { PET_SEXES } from './constants'
import type { DateKey, Pet, PetDraft, PetSex } from './types'

export type PetField =
  | 'name'
  | 'species'
  | 'breed'
  | 'sex'
  | 'dateOfBirth'
  | 'weightKg'
  | 'microchip'

export type PetFieldErrors = Partial<Record<PetField, string>>

/** A trimmed, null-normalised draft; only present when the draft is valid. */
export interface ValidatedPetDraft {
  name: string
  species: string
  breed: string | null
  sex: PetSex
  dateOfBirth: DateKey
  weightKg: number
  microchip: string | null
}

export interface PetValidationResult {
  isValid: boolean
  errors: PetFieldErrors
  value: ValidatedPetDraft | null
}

export interface PetValidationContext {
  /** Local calendar day; the caller decides the clock (R4). */
  today: DateKey
  /** Existing pets, used for the microchip-uniqueness check. */
  existingPets?: readonly Pick<Pet, 'id' | 'microchip'>[]
  /** When editing, the pet being edited is excluded from the uniqueness check. */
  currentPetId?: string | null
}

const MICROCHIP_PATTERN = /^\d{9,15}$/

/** Trims a microchip; blank becomes null so the unique index never stores ''. */
export function normalizeMicrochip(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  return trimmed == null || trimmed === '' ? null : trimmed
}

function trimOrNull(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim()
  return trimmed == null || trimmed === '' ? null : trimmed
}

function isPetSex(value: unknown): value is PetSex {
  return typeof value === 'string' && (PET_SEXES as readonly string[]).includes(value)
}

/**
 * Validates a pet draft as of `today`. A pet older than 40 years is almost
 * certainly a typo; the boundary is inclusive (`today − 40 years` is allowed).
 */
export function validatePetDraft(
  draft: PetDraft,
  context: PetValidationContext,
): PetValidationResult {
  if (!isDateKey(context.today)) {
    throw new RangeError(`Pet validation needs a real "today", received "${context.today}"`)
  }
  const errors: PetFieldErrors = {}

  const name = typeof draft.name === 'string' ? draft.name.trim() : ''
  if (name === '') {
    errors.name = 'A pet needs a name'
  } else if (name.length > 40) {
    errors.name = 'Keep the name under 40 characters'
  }

  const species = typeof draft.species === 'string' ? draft.species.trim() : ''
  if (species === '') {
    errors.species = 'Pick a species'
  } else if (species.length > 30) {
    errors.species = 'Keep the species under 30 characters'
  }

  const breed = trimOrNull(draft.breed)
  if (breed !== null && breed.length > 40) {
    errors.breed = 'Keep the breed under 40 characters'
  }

  if (!isPetSex(draft.sex)) {
    errors.sex = 'Choose male, female or unknown'
  }

  const dateOfBirth: unknown = draft.dateOfBirth
  if (typeof dateOfBirth !== 'string' || !isDateKey(dateOfBirth)) {
    errors.dateOfBirth = 'Pick a birthday'
  } else if (compareDateKeys(dateOfBirth, context.today) > 0) {
    errors.dateOfBirth = 'The birthday cannot be in the future'
  } else if (compareDateKeys(dateOfBirth, addMonths(context.today, -40 * 12)) < 0) {
    errors.dateOfBirth = 'Check the birthday — that is over 40 years'
  }

  const weightKg: unknown = draft.weightKg
  if (typeof weightKg !== 'number' || !Number.isFinite(weightKg) || weightKg <= 0) {
    errors.weightKg = 'Weight must be greater than zero'
  } else if (weightKg > 300) {
    errors.weightKg = 'Weight must be 300 kg or less'
  }

  const microchip = normalizeMicrochip(draft.microchip)
  if (microchip !== null && !MICROCHIP_PATTERN.test(microchip)) {
    errors.microchip = 'A microchip is 9–15 digits'
  } else if (microchip !== null) {
    const duplicate = (context.existingPets ?? []).some(
      (pet) =>
        pet.id !== context.currentPetId &&
        pet.microchip != null &&
        normalizeMicrochip(pet.microchip) === microchip,
    )
    if (duplicate) {
      errors.microchip = 'That microchip is already registered to another pet'
    }
  }

  const isValid = Object.keys(errors).length === 0
  return {
    isValid,
    errors,
    value: isValid
      ? {
          name,
          species,
          breed,
          sex: draft.sex,
          dateOfBirth: draft.dateOfBirth,
          weightKg: draft.weightKg,
          microchip,
        }
      : null,
  }
}
