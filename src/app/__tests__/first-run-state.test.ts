import { beforeEach, describe, expect, it } from 'vitest'

import {
  FIRST_RUN_REQUEST_KEY,
  clearFirstRunRequest,
  isFirstRunRequested,
  isOwnerUnnamed,
  requestFirstRun,
  resetFirstRunStateForTests,
  shouldShowFirstRun,
} from '@/app/first-run-state'

describe('first-run gate (03 §5, 06 M4)', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    resetFirstRunStateForTests()
  })

  it('shows only for an empty household whose owner is unnamed', () => {
    expect(
      shouldShowFirstRun({ hasPets: false, ownerName: 'My household', resetRequested: false }),
    ).toBe(true)
    expect(shouldShowFirstRun({ hasPets: false, ownerName: '', resetRequested: false })).toBe(true)
    expect(shouldShowFirstRun({ hasPets: false, ownerName: 'Daniel', resetRequested: false })).toBe(
      false,
    )
  })

  it('never onboards an established household, even after a stale request', () => {
    expect(
      shouldShowFirstRun({ hasPets: true, ownerName: 'My household', resetRequested: true }),
    ).toBe(false)
  })

  it('returns after a reset even when the owner name was kept', () => {
    expect(shouldShowFirstRun({ hasPets: false, ownerName: 'Daniel', resetRequested: true })).toBe(
      true,
    )
  })

  it('remembers the reset request in this tab only until completion', () => {
    expect(isFirstRunRequested()).toBe(false)

    requestFirstRun()
    expect(isFirstRunRequested()).toBe(true)
    expect(window.sessionStorage.getItem(FIRST_RUN_REQUEST_KEY)).toBe('1')

    clearFirstRunRequest()
    expect(isFirstRunRequested()).toBe(false)
    expect(window.sessionStorage.getItem(FIRST_RUN_REQUEST_KEY)).toBeNull()
  })

  it('recognises the placeholder name', () => {
    expect(isOwnerUnnamed('My household')).toBe(true)
    expect(isOwnerUnnamed('   ')).toBe(true)
    expect(isOwnerUnnamed('Maria Santos')).toBe(false)
  })
})
