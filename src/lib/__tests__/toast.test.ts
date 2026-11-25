import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  TOAST_DURATION_MS,
  dismissToast,
  getToasts,
  resetToastsForTests,
  runToastAction,
  showToast,
  subscribeToasts,
} from '@/lib/toast'

describe('toasts (3 s dwell + Undo)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    resetToastsForTests()
  })

  afterEach(() => {
    vi.useRealTimers()
    resetToastsForTests()
  })

  it('dwells for 3 s and not before', () => {
    showToast({ title: 'Walk logged' })
    expect(getToasts()).toHaveLength(1)

    vi.advanceTimersByTime(TOAST_DURATION_MS - 1)
    expect(getToasts()).toHaveLength(1)

    vi.advanceTimersByTime(1)
    expect(getToasts()).toHaveLength(0)
  })

  it('runs Undo once and closes the toast', () => {
    const undo = vi.fn()
    showToast({ title: 'Entry deleted', action: { label: 'Undo', onClick: undo } })
    const toast = getToasts()[0]
    if (toast === undefined) {
      throw new Error('expected a visible toast')
    }

    runToastAction(toast.id)
    expect(undo).toHaveBeenCalledTimes(1)
    expect(getToasts()).toHaveLength(0)

    // A later auto-dismiss/repeat click cannot run the action twice.
    vi.advanceTimersByTime(TOAST_DURATION_MS)
    runToastAction(toast.id)
    expect(undo).toHaveBeenCalledTimes(1)
  })

  it('allows manual dismissal and a custom dwell', () => {
    const id = showToast({ title: 'Quick', durationMs: 1000 })
    dismissToast(id)
    expect(getToasts()).toHaveLength(0)

    showToast({ title: 'Custom', durationMs: 500 })
    vi.advanceTimersByTime(500)
    expect(getToasts()).toHaveLength(0)
  })

  it('keeps the newest four toasts visible', () => {
    for (let index = 0; index < 6; index += 1) {
      showToast({ title: `Entry ${index}` })
    }
    const titles = getToasts().map((toast) => toast.title)
    expect(titles).toEqual(['Entry 2', 'Entry 3', 'Entry 4', 'Entry 5'])
  })

  it('notifies subscribers on show and dismiss', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeToasts(listener)

    showToast({ title: 'One' })
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })
})
