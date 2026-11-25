/**
 * Toasts — 3-second dwell with an optional action (03 §4: "toast dwell 3 s with
 * 3 s Undo (Flutter parity)"; 02 §1's "X logged" + Undo, "Entry updated/
 * deleted").
 *
 * A ~2 kB external store instead of adding Sonner: the M1 first-load gate has
 * only a few kB of headroom and a toaster belongs in the eager shell, so the
 * cost has to stay negligible (04 §2.1 records Sonner at 9.4 kB gzip). The
 * accessible contract still matches: each toast is a polite status region and
 * its action is an ordinary `Undo` button.
 *
 * The store is framework-free so the dwell/undo timing is unit-testable with
 * fake timers; `Toaster` only subscribes.
 */

export interface ToastAction {
  /** Visible button label, e.g. "Undo". */
  label: string
  /** Runs after the toast is dismissed. */
  onClick: () => void
  /** Optional stable hook for the Playwright/journal Undo affordance. */
  testId?: string
}

export interface ToastOptions {
  title: string
  description?: string
  action?: ToastAction
  /** Dwell before auto-dismiss; defaults to the 3 s contract. */
  durationMs?: number
}

export interface ToastRecord extends ToastOptions {
  id: string
  durationMs: number
}

export const TOAST_DURATION_MS = 3000
const MAX_VISIBLE_TOASTS = 4

type Listener = () => void

const listeners = new Set<Listener>()
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let records: readonly ToastRecord[] = []
let sequence = 0

/** Stable snapshot for `useSyncExternalStore`. */
export function getToasts(): readonly ToastRecord[] {
  return records
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function emit(next: readonly ToastRecord[]): void {
  records = next
  for (const listener of listeners) {
    listener()
  }
}

/** Shows one toast and arms its auto-dismiss timer. Returns the toast id. */
export function showToast(options: ToastOptions): string {
  const id = `toast-${(sequence += 1)}`
  const durationMs = options.durationMs ?? TOAST_DURATION_MS
  const record: ToastRecord = { ...options, id, durationMs }

  // Keep the newest few visible; older timers simply dismiss a no-op.
  const next = [...records, record]
  emit(next.length > MAX_VISIBLE_TOASTS ? next.slice(-MAX_VISIBLE_TOASTS) : next)

  timers.set(
    id,
    setTimeout(() => {
      dismissToast(id)
    }, durationMs),
  )
  return id
}

export function dismissToast(id: string): void {
  const timer = timers.get(id)
  if (timer !== undefined) {
    clearTimeout(timer)
    timers.delete(id)
  }
  if (!records.some((record) => record.id === id)) {
    return
  }
  emit(records.filter((record) => record.id !== id))
}

/**
 * Runs a toast action (Undo) and closes the toast. The action runs exactly once:
 * a later auto-dismiss or repeated click finds no record.
 */
export function runToastAction(id: string): void {
  const record = records.find((candidate) => candidate.id === id)
  if (record === undefined) {
    return
  }
  const action = record.action
  dismissToast(id)
  action?.onClick()
}

/** Test seam: drop every toast, timer and listener. */
export function resetToastsForTests(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer)
  }
  timers.clear()
  records = []
  listeners.clear()
  sequence = 0
}
