import { describe, expect, it } from 'vitest'

import {
  HEALTH_RECORD_DELETE_PATHS,
  HEALTH_RECORD_FORBIDDEN_OPERATIONS,
  HEALTH_RECORD_REPOSITORY_OPERATIONS,
  healthRecordTitle,
  normalizeOptionalText,
  validateHealthRecordDraft,
} from './health-records'

const TODAY = '2026-11-25'

const draft = (overrides: Partial<Parameters<typeof validateHealthRecordDraft>[0]> = {}) => ({
  petId: 'pet-bella',
  recordedOn: TODAY,
  condition: 'Otitis externa (left ear)',
  diagnosis: 'Bacterial ear infection',
  treatment: 'Ear cleaning and antibiotic drops for 10 days',
  prescribedMedication: 'Ofloxacin otic drops',
  vetName: 'Dr. Ana Cruz',
  ...overrides,
})

describe('R5 (amended) · repository surface contract', () => {
  it('accepts: the surface is read, append and single-row correction', () => {
    expect(HEALTH_RECORD_REPOSITORY_OPERATIONS).toEqual([
      'listHealthRecordsForPet',
      'appendHealthRecord',
      'updateHealthRecord',
      'deleteHealthRecord',
    ])
  })

  it('rejects: bulk wipes are still not part of the surface', () => {
    for (const forbidden of HEALTH_RECORD_FORBIDDEN_OPERATIONS) {
      expect(HEALTH_RECORD_REPOSITORY_OPERATIONS as readonly string[]).not.toContain(forbidden)
    }
    // A note disappears one at a time, or with the pet that owns it.
    expect(HEALTH_RECORD_DELETE_PATHS).toEqual(['pet-cascade', 'record-delete'])
  })
})

describe('R5 (amended) · draft validation', () => {
  it('accepts: condition only, diagnosis only, or both', () => {
    expect(validateHealthRecordDraft(draft()).isValid).toBe(true)
    expect(
      validateHealthRecordDraft(draft({ condition: 'Healthy annual exam', diagnosis: null }))
        .isValid,
    ).toBe(true)
    expect(
      validateHealthRecordDraft(draft({ condition: null, diagnosis: 'Bacterial ear infection' }))
        .isValid,
    ).toBe(true)
  })

  it('accepts: optional text is trimmed and blank becomes null', () => {
    const result = validateHealthRecordDraft(
      draft({ condition: '  Otitis  ', treatment: '   ', prescribedMedication: null }),
    )
    expect(result.value?.condition).toBe('Otitis')
    expect(result.value?.treatment).toBeNull()
    expect(result.value?.prescribedMedication).toBeNull()
    expect(result.value?.vetName).toBe('Dr. Ana Cruz')
  })

  it('rejects: a note with neither condition nor diagnosis', () => {
    for (const overrides of [
      { condition: null, diagnosis: null },
      { condition: '   ', diagnosis: '  ' },
      { condition: '', diagnosis: null },
    ]) {
      const result = validateHealthRecordDraft(draft(overrides))
      expect(result.isValid).toBe(false)
      expect(result.errors.condition).toBe('Add a condition or a diagnosis')
      expect(result.value).toBeNull()
    }
  })

  it('rejects: a missing pet or impossible visit date', () => {
    expect(validateHealthRecordDraft(draft({ petId: '  ' })).errors.petId).toBeDefined()
    expect(
      validateHealthRecordDraft(draft({ recordedOn: '2026-02-30' })).errors.recordedOn,
    ).toBeDefined()
    expect(validateHealthRecordDraft(draft({ recordedOn: '' })).errors.recordedOn).toBeDefined()
  })

  it('accepts: the row title prefers the condition, otherwise the diagnosis', () => {
    expect(
      healthRecordTitle({ condition: 'Otitis externa', diagnosis: 'Bacterial infection' }),
    ).toBe('Otitis externa')
    expect(healthRecordTitle({ condition: null, diagnosis: 'Bacterial infection' })).toBe(
      'Bacterial infection',
    )
    expect(healthRecordTitle({ condition: '   ', diagnosis: null })).toBe('')
  })

  it('accepts: optional text normalisation helper', () => {
    expect(normalizeOptionalText(null)).toBeNull()
    expect(normalizeOptionalText('   ')).toBeNull()
    expect(normalizeOptionalText('  kept  ')).toBe('kept')
  })
})
