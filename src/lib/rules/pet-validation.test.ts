import { describe, expect, it } from 'vitest'

import { normalizeMicrochip, validatePetDraft } from './pet-validation'
import type { Pet, PetDraft } from './types'

const TODAY = '2026-11-25'

function draft(overrides: Partial<PetDraft> = {}): PetDraft {
  return {
    name: 'Bella',
    species: 'Dog',
    breed: 'Golden Retriever mix',
    sex: 'female',
    dateOfBirth: '2021-05-01',
    weightKg: 12.4,
    microchip: '900215004123456',
    ...overrides,
  }
}

const existing: Pick<Pet, 'id' | 'microchip'>[] = [
  { id: 'pet-bella', microchip: '900215004123456' },
  { id: 'pet-miso', microchip: '900215004999999' },
  { id: 'pet-null', microchip: null },
]

describe('R9 pet validation · accepted drafts', () => {
  it('accepts a valid draft and returns trimmed values', () => {
    const result = validatePetDraft(
      draft({
        name: '  Bella  ',
        species: ' Dog ',
        breed: '  Golden Retriever mix ',
        microchip: ' 900215004123456 ',
      }),
      { today: TODAY, existingPets: existing, currentPetId: 'pet-bella' },
    )
    expect(result.isValid).toBe(true)
    expect(result.errors).toEqual({})
    expect(result.value).toEqual({
      name: 'Bella',
      species: 'Dog',
      breed: 'Golden Retriever mix',
      sex: 'female',
      dateOfBirth: '2021-05-01',
      weightKg: 12.4,
      microchip: '900215004123456',
    })
  })

  it('accepts: blank optional fields normalise to null', () => {
    const result = validatePetDraft(draft({ breed: '   ', microchip: '  ' }), { today: TODAY })
    expect(result.isValid).toBe(true)
    expect(result.value?.breed).toBeNull()
    expect(result.value?.microchip).toBeNull()
  })

  it('accepts: every allowed sex value', () => {
    for (const sex of ['male', 'female', 'unknown'] as const) {
      expect(validatePetDraft(draft({ sex }), { today: TODAY }).isValid).toBe(true)
    }
  })

  it('accepts: field boundaries are inclusive', () => {
    expect(validatePetDraft(draft({ name: 'B' }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ name: 'B'.repeat(40) }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ species: 'S'.repeat(30) }), { today: TODAY }).isValid).toBe(
      true,
    )
    expect(validatePetDraft(draft({ breed: 'B'.repeat(40) }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ weightKg: 300 }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ weightKg: 0.1 }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ microchip: '123456789' }), { today: TODAY }).isValid).toBe(true)
    expect(
      validatePetDraft(draft({ microchip: '123456789012345' }), { today: TODAY }).isValid,
    ).toBe(true)
    expect(validatePetDraft(draft({ dateOfBirth: TODAY }), { today: TODAY }).isValid).toBe(true)
    expect(validatePetDraft(draft({ dateOfBirth: '1986-11-25' }), { today: TODAY }).isValid).toBe(
      true,
    )
  })

  it('accepts: the 40-year boundary clamps a leap-day birthday', () => {
    expect(
      validatePetDraft(draft({ dateOfBirth: '1988-02-29' }), { today: '2028-02-29' }).isValid,
    ).toBe(true)
  })

  it('accepts: editing a pet excludes its own microchip from the uniqueness check', () => {
    const result = validatePetDraft(draft({ microchip: '900215004123456' }), {
      today: TODAY,
      existingPets: existing,
      currentPetId: 'pet-bella',
    })
    expect(result.isValid).toBe(true)
  })
})

describe('R9 pet validation · rejected drafts', () => {
  it('rejects: blank or over-long name and species, over-long breed', () => {
    expect(validatePetDraft(draft({ name: '   ' }), { today: TODAY }).errors.name).toBe(
      'A pet needs a name',
    )
    expect(
      validatePetDraft(draft({ name: 'B'.repeat(41) }), { today: TODAY }).errors.name,
    ).toBeDefined()
    expect(validatePetDraft(draft({ species: ' ' }), { today: TODAY }).errors.species).toBe(
      'Pick a species',
    )
    expect(
      validatePetDraft(draft({ species: 'S'.repeat(31) }), { today: TODAY }).errors.species,
    ).toBeDefined()
    expect(
      validatePetDraft(draft({ breed: 'B'.repeat(41) }), { today: TODAY }).errors.breed,
    ).toBeDefined()
  })

  it('rejects: an unknown sex', () => {
    const result = validatePetDraft(draft({ sex: 'hamster' as never }), { today: TODAY })
    expect(result.isValid).toBe(false)
    expect(result.errors.sex).toBeDefined()
  })

  it('rejects: future, impossible, or over-40-year birthdays', () => {
    expect(
      validatePetDraft(draft({ dateOfBirth: '2026-11-26' }), { today: TODAY }).errors.dateOfBirth,
    ).toBe('The birthday cannot be in the future')
    expect(
      validatePetDraft(draft({ dateOfBirth: '2026-02-30' }), { today: TODAY }).errors.dateOfBirth,
    ).toBe('Pick a birthday')
    expect(validatePetDraft(draft({ dateOfBirth: '' }), { today: TODAY }).errors.dateOfBirth).toBe(
      'Pick a birthday',
    )
    expect(
      validatePetDraft(draft({ dateOfBirth: '1986-11-24' }), { today: TODAY }).errors.dateOfBirth,
    ).toBeDefined()
    expect(
      validatePetDraft(draft({ dateOfBirth: '1988-02-28' }), { today: '2028-02-29' }).errors
        .dateOfBirth,
    ).toBeDefined()
  })

  it('rejects: weight at or below zero, above 300, or not a number', () => {
    expect(validatePetDraft(draft({ weightKg: 0 }), { today: TODAY }).errors.weightKg).toBe(
      'Weight must be greater than zero',
    )
    expect(
      validatePetDraft(draft({ weightKg: -1 }), { today: TODAY }).errors.weightKg,
    ).toBeDefined()
    expect(
      validatePetDraft(draft({ weightKg: Number.NaN }), { today: TODAY }).errors.weightKg,
    ).toBeDefined()
    expect(
      validatePetDraft(draft({ weightKg: Number.POSITIVE_INFINITY }), { today: TODAY }).errors
        .weightKg,
    ).toBeDefined()
    expect(validatePetDraft(draft({ weightKg: 300.1 }), { today: TODAY }).errors.weightKg).toBe(
      'Weight must be 300 kg or less',
    )
  })

  it('rejects: a non-digit, too short or too long microchip', () => {
    for (const microchip of [
      '12345678',
      '1234567890123456',
      '90021500412A456',
      '90021 5004123456',
    ]) {
      expect(
        validatePetDraft(draft({ microchip }), { today: TODAY }).errors.microchip,
      ).toBeDefined()
    }
  })

  it('rejects: two pets cannot share a microchip', () => {
    const result = validatePetDraft(draft({ microchip: '900215004999999' }), {
      today: TODAY,
      existingPets: existing,
    })
    expect(result.isValid).toBe(false)
    expect(result.errors.microchip).toBe('That microchip is already registered to another pet')
  })

  it('rejects: an invalid draft returns no value and every problem at once', () => {
    const result = validatePetDraft(
      draft({
        name: ' ',
        species: '',
        sex: 'x' as never,
        dateOfBirth: '2030-01-01',
        weightKg: 0,
        microchip: '1',
      }),
      { today: TODAY },
    )
    expect(result.isValid).toBe(false)
    expect(result.value).toBeNull()
    expect(Object.keys(result.errors).sort()).toEqual([
      'dateOfBirth',
      'microchip',
      'name',
      'sex',
      'species',
      'weightKg',
    ])
  })

  it('rejects: an invalid today is a programming error, not a silent default', () => {
    expect(() => validatePetDraft(draft(), { today: '2026-02-30' })).toThrow(RangeError)
  })
})

describe('R9 pet validation · microchip normalisation', () => {
  it('accepts: blank becomes null, digits are trimmed', () => {
    expect(normalizeMicrochip(null)).toBeNull()
    expect(normalizeMicrochip(undefined)).toBeNull()
    expect(normalizeMicrochip('   ')).toBeNull()
    expect(normalizeMicrochip(' 900215004123456 ')).toBe('900215004123456')
  })
})
