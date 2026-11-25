import { describe, expect, it } from 'vitest'

import { HOUSEHOLD_RESET_OPERATION_ORDER, planHouseholdReset } from './household-reset'

describe('R8 reset household', () => {
  it('accepts: a reset without "forget" keeps the owner row untouched', () => {
    const plan = planHouseholdReset({ forgetOwner: false })
    expect(plan.ownerPatch).toBeNull()
    expect(plan.operations).toContain('delete-all-appointments')
    expect(plan.operations).toContain('delete-all-pets')
    expect(plan.operations).toContain('set-sample-data-off')
    expect(plan.operations).not.toContain('blank-owner')
  })

  it('accepts: "also forget my details" blanks name, email and phone', () => {
    const plan = planHouseholdReset({ forgetOwner: true })
    expect(plan.ownerPatch).toEqual({ name: 'My household', email: '', phone: '' })
    expect(plan.operations[plan.operations.length - 1]).toBe('blank-owner')
  })

  it('accepts: appointments are deleted before pets so no Household shell is left behind', () => {
    const plan = planHouseholdReset({ forgetOwner: false })
    const appointmentIndex = plan.operations.indexOf('delete-all-appointments')
    const petIndex = plan.operations.indexOf('delete-all-pets')
    expect(appointmentIndex).toBeGreaterThanOrEqual(0)
    expect(petIndex).toBeGreaterThan(appointmentIndex)
  })

  it('rejects: reset never removes the owner row, only optionally its details', () => {
    for (const forgetOwner of [true, false]) {
      const plan = planHouseholdReset({ forgetOwner })
      const operations: readonly string[] = plan.operations
      expect(operations.some((operation) => operation.includes('owner-delete'))).toBe(false)
      expect(operations).toEqual(expect.arrayContaining(['set-sample-data-off']))
    }
  })

  it('accepts: every planned operation belongs to the canonical ordered list', () => {
    for (const forgetOwner of [true, false]) {
      const plan = planHouseholdReset({ forgetOwner })
      let previousIndex = -1
      for (const operation of plan.operations) {
        const index = HOUSEHOLD_RESET_OPERATION_ORDER.indexOf(operation)
        expect(index).toBeGreaterThan(previousIndex)
        previousIndex = index
      }
    }
  })
})
