import { describe, expect, it } from 'vitest'

import { localDayOfInstant } from './calendar'
import type { VaccinationDoseInput } from './vaccination-due'
import {
  currentDoses,
  doseDueStatus,
  headlineVaccinationDose,
  isValidNextDueDate,
  nextDueFromInterval,
  normalizeVaccineName,
  petDueSummary,
  petVaccinationDueStatus,
  vaccineKey,
  vaccinationDueStatus,
  worstDueStatus,
} from './vaccination-due'

const TODAY = '2026-11-25'
const WINDOW = 30

type DoseOverrides = Partial<Omit<VaccinationDoseInput, 'id'>> & { id: string }

function dose(overrides: DoseOverrides): VaccinationDoseInput {
  return {
    vaccineTypeId: 'rabies',
    vaccineName: 'Rabies',
    vaccinationDate: '2025-01-01',
    nextDueDate: '2026-01-09',
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('R1 vaccination · per-dose due status', () => {
  it('accepts: null due means not tracked and reads up to date', () => {
    expect(doseDueStatus(null, TODAY, WINDOW)).toBe('up_to_date')
    expect(doseDueStatus(undefined, TODAY, WINDOW)).toBe('up_to_date')
  })

  it('accepts: overdue, today and the window edges follow the local day', () => {
    expect(doseDueStatus('2026-11-24', TODAY, WINDOW)).toBe('overdue')
    expect(doseDueStatus('2026-11-25', TODAY, WINDOW)).toBe('due_soon')
    expect(doseDueStatus('2026-12-25', TODAY, WINDOW)).toBe('due_soon')
    expect(doseDueStatus('2026-12-26', TODAY, WINDOW)).toBe('up_to_date')
  })

  it('accepts: a 14-day window splits 14/15 days exactly as R2 requires', () => {
    expect(doseDueStatus('2026-11-24', TODAY, 14)).toBe('overdue')
    expect(doseDueStatus('2026-11-25', TODAY, 14)).toBe('due_soon')
    expect(doseDueStatus('2026-12-09', TODAY, 14)).toBe('due_soon')
    expect(doseDueStatus('2026-12-10', TODAY, 14)).toBe('up_to_date')
  })

  it('rejects: a malformed due date or window is not silently accepted', () => {
    expect(() => doseDueStatus('2026-02-30', TODAY, WINDOW)).toThrow(RangeError)
    expect(() => doseDueStatus('2026-12-01', TODAY, -1)).toThrow(RangeError)
    expect(() => doseDueStatus('2026-12-01', TODAY, 1.5)).toThrow(RangeError)
    expect(() => doseDueStatus('2026-12-01', 'not-a-date', WINDOW)).toThrow(RangeError)
  })

  it('accepts: the worst status wins, no matter the order', () => {
    expect(worstDueStatus(['up_to_date', 'due_soon', 'overdue'])).toBe('overdue')
    expect(worstDueStatus(['due_soon', 'up_to_date'])).toBe('due_soon')
    expect(worstDueStatus([])).toBe('up_to_date')
  })
})

describe('R1 vaccination · newest dose per vaccine wins', () => {
  it('accepts: a re-vaccinated pet clears overdue (old row is history)', () => {
    const oldOverdue = dose({
      id: 'dose-old',
      vaccinationDate: '2024-12-01',
      nextDueDate: '2026-01-09',
      createdAt: '2024-12-01T00:00:00.000Z',
    })
    const booster = dose({
      id: 'dose-booster',
      vaccinationDate: '2026-09-01',
      nextDueDate: '2027-03-01',
      createdAt: '2026-09-01T00:00:00.000Z',
    })

    expect(currentDoses([oldOverdue, booster]).map((entry) => entry.id)).toEqual(['dose-booster'])
    expect(petVaccinationDueStatus([oldOverdue, booster], TODAY, WINDOW)).toBe('up_to_date')
    // The fixed D2/Q2 reject case: ranking every row would keep this pet overdue.
    expect(petVaccinationDueStatus([oldOverdue], TODAY, WINDOW)).toBe('overdue')
  })

  it('accepts: same-day doses resolve by createdAt, later creation winning', () => {
    const earlierCreated = dose({
      id: 'dose-a',
      vaccinationDate: '2025-06-01',
      nextDueDate: '2025-12-01',
      createdAt: '2025-06-01T09:00:00.000Z',
    })
    const laterCreated = dose({
      id: 'dose-b',
      vaccinationDate: '2025-06-01',
      nextDueDate: '2027-06-01',
      createdAt: '2025-06-01T10:00:00.000Z',
    })
    expect(currentDoses([earlierCreated, laterCreated]).map((entry) => entry.id)).toEqual([
      'dose-b',
    ])
    expect(currentDoses([laterCreated, earlierCreated]).map((entry) => entry.id)).toEqual([
      'dose-b',
    ])
  })

  it('accepts: identical createdAt resolves by id as the final deterministic tie-break', () => {
    const lowerId = dose({
      id: 'dose-a',
      vaccinationDate: '2025-06-01',
      nextDueDate: '2025-12-01',
      createdAt: '2025-06-01T10:00:00.000Z',
    })
    const higherId = dose({
      id: 'dose-z',
      vaccinationDate: '2025-06-01',
      nextDueDate: '2027-06-01',
      createdAt: '2025-06-01T10:00:00.000Z',
    })
    expect(currentDoses([lowerId, higherId]).map((entry) => entry.id)).toEqual(['dose-z'])
    expect(currentDoses([higherId, lowerId]).map((entry) => entry.id)).toEqual(['dose-z'])
    expect(petVaccinationDueStatus([lowerId, higherId], TODAY, WINDOW)).toBe('up_to_date')
  })

  it('rejects: ordering by createdAt before vaccinationDate keeps a stale due date', () => {
    // The booster was created later but given earlier; the dose given later wins.
    const givenLater = dose({
      id: 'dose-later',
      vaccinationDate: '2025-06-01',
      nextDueDate: '2026-12-10',
      createdAt: '2025-06-02T00:00:00.000Z',
    })
    const createdLater = dose({
      id: 'dose-created-later',
      vaccinationDate: '2025-01-01',
      nextDueDate: '2025-06-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(currentDoses([givenLater, createdLater]).map((entry) => entry.id)).toEqual([
      'dose-later',
    ])
    expect(petVaccinationDueStatus([givenLater, createdLater], TODAY, WINDOW)).toBe('due_soon')
  })

  it('accepts: no doses, or only null due dates, reads up to date', () => {
    expect(petVaccinationDueStatus([], TODAY, WINDOW)).toBe('up_to_date')
    const untracked = dose({ id: 'dose-null', nextDueDate: null })
    expect(petVaccinationDueStatus([untracked], TODAY, WINDOW)).toBe('up_to_date')
    // An old overdue dose superseded by an untracked booster is still history.
    const oldOverdue = dose({ id: 'dose-old', vaccinationDate: '2024-01-01' })
    const newUntracked = dose({
      id: 'dose-new',
      vaccinationDate: '2026-01-01',
      nextDueDate: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(petVaccinationDueStatus([oldOverdue, newUntracked], TODAY, WINDOW)).toBe('up_to_date')
  })

  it('accepts: per-vaccine keys keep different vaccines independent', () => {
    const rabies = dose({ id: 'rabies', nextDueDate: '2026-01-09' })
    const felv = dose({
      id: 'felv',
      vaccineTypeId: 'felv',
      vaccineName: 'FeLV',
      nextDueDate: '2026-12-05',
    })
    expect(petVaccinationDueStatus([rabies, felv], TODAY, WINDOW)).toBe('overdue')
    const summary = petDueSummary([rabies, felv], TODAY, WINDOW)
    expect(summary.status).toBe('overdue')
    expect(summary.headline?.dose.vaccineName).toBe('Rabies')
    expect(summary.headline?.status).toBe('overdue')
  })

  it('accepts: historical rows without a type id rank by normalised name', () => {
    const historical = dose({
      id: 'dose-historical',
      vaccineTypeId: null,
      vaccineName: '  rabies ',
      nextDueDate: '2025-01-01',
      createdAt: '2025-01-01T00:00:00.000Z',
    })
    const typed = dose({
      id: 'dose-typed',
      vaccineName: 'Rabies',
      nextDueDate: '2027-01-01',
      createdAt: '2026-06-01T00:00:00.000Z',
    })
    // A typed id and a name fallback are different keys by contract.
    expect(vaccineKey(historical)).toBe('name:rabies')
    expect(vaccineKey(typed)).toBe('type:rabies')
    expect(normalizeVaccineName('  FeLV ')).toBe('felv')

    const nameOnlyOld = dose({
      id: 'name-old',
      vaccineTypeId: null,
      vaccineName: 'RABIES',
      vaccinationDate: '2024-01-01',
      nextDueDate: '2025-01-01',
    })
    const nameOnlyNew = dose({
      id: 'name-new',
      vaccineTypeId: null,
      vaccineName: ' rabies ',
      vaccinationDate: '2026-01-01',
      nextDueDate: '2027-01-01',
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    expect(currentDoses([nameOnlyOld, nameOnlyNew]).map((entry) => entry.id)).toEqual(['name-new'])
  })
})

describe('R1 vaccination · headline dose', () => {
  it('accepts: the current dose with the earliest due date names the chip', () => {
    const later = dose({
      id: 'later',
      vaccineTypeId: 'dhpp',
      vaccineName: 'DHPP',
      nextDueDate: '2026-12-05',
    })
    const earlier = dose({ id: 'earlier', nextDueDate: '2026-01-09' })
    const headline = headlineVaccinationDose([later, earlier])
    expect(headline?.id).toBe('earlier')
    expect(headline?.vaccineName).toBe('Rabies')
  })

  it('accepts: a due-soon dose can outrank a later up-to-date dose', () => {
    const soon = dose({
      id: 'soon',
      vaccineTypeId: 'felv',
      vaccineName: 'FeLV',
      nextDueDate: '2026-12-05',
    })
    const later = dose({ id: 'later', nextDueDate: '2027-12-05' })
    expect(headlineVaccinationDose([later, soon])?.id).toBe('soon')
  })

  it('accepts: null when no current dose has a due date', () => {
    expect(headlineVaccinationDose([dose({ id: 'none', nextDueDate: null })])).toBeNull()
    expect(headlineVaccinationDose([])).toBeNull()
  })

  it('accepts: same due date resolves deterministically and matches the summary', () => {
    const left = dose({
      id: 'dose-a',
      nextDueDate: '2026-12-01',
      createdAt: '2025-01-01T00:00:00.000Z',
    })
    const right = dose({
      id: 'dose-b',
      vaccineTypeId: 'dhpp',
      vaccineName: 'DHPP',
      nextDueDate: '2026-12-01',
      createdAt: '2025-02-01T00:00:00.000Z',
    })
    expect(headlineVaccinationDose([left, right])?.id).toBe('dose-a')
    expect(headlineVaccinationDose([right, left])?.id).toBe('dose-a')
    expect(petDueSummary([left, right], TODAY, WINDOW).headline?.dose.id).toBe('dose-a')
  })
})

describe('R1/R4 vaccination · the local day decides', () => {
  it('accepts: at 00:30 local on 2 Mar a dose due 1 Mar is overdue, not due today', () => {
    const justAfterMidnight = new Date(2026, 2, 2, 0, 30, 0, 0)
    const today = localDayOfInstant(justAfterMidnight)
    expect(today).toBe('2026-03-02')
    expect(doseDueStatus('2026-03-01', today, WINDOW)).toBe('overdue')
    // If this machine is east of UTC, the UTC day is still 1 Mar — the fixed
    // D3/D4 bug would have called this dose due today instead of overdue.
    const utcDay = justAfterMidnight.toISOString().slice(0, 10)
    if (utcDay !== today) {
      expect(doseDueStatus('2026-03-01', utcDay, WINDOW)).toBe('due_soon')
    }
  })
})

describe('R1 vaccination · form and prefill rules', () => {
  it('accepts: next due is null or strictly after the dose date', () => {
    expect(isValidNextDueDate('2026-01-01', null)).toBe(true)
    expect(isValidNextDueDate('2026-01-01', '2026-01-02')).toBe(true)
    expect(isValidNextDueDate('2026-01-01', '2027-01-01')).toBe(true)
  })

  it('rejects: same-day or earlier next-due dates', () => {
    expect(isValidNextDueDate('2026-01-01', '2026-01-01')).toBe(false)
    expect(isValidNextDueDate('2026-01-01', '2025-12-31')).toBe(false)
    expect(isValidNextDueDate('2026-01-01', '2026-02-30')).toBe(false)
  })

  it('accepts: prefill clamps month ends and leap years', () => {
    expect(nextDueFromInterval('2026-01-31', 1)).toBe('2026-02-28')
    expect(nextDueFromInterval('2024-01-31', 1)).toBe('2024-02-29')
    expect(nextDueFromInterval('2026-11-25', 12)).toBe('2027-11-25')
    expect(nextDueFromInterval('2026-11-25', 3)).toBe('2027-02-25')
    expect(nextDueFromInterval('2026-11-25', null)).toBeNull()
    expect(nextDueFromInterval('2026-11-25', 0)).toBeNull()
  })

  it('accepts: vaccinationDueStatus reads one dose', () => {
    expect(vaccinationDueStatus({ nextDueDate: '2026-01-09' }, TODAY, WINDOW)).toBe('overdue')
  })
})
