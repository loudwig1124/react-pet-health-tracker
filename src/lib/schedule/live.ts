/**
 * Shared live-read plumbing for the M3 screens.
 *
 * `useLiveQuery` re-throws read errors into the nearest error boundary, which
 * for this app is the boot/storage screen — far too heavy for one failed table.
 * The screens therefore wrap their read in a discriminated result and render an
 * inline error panel with Retry (03 §5), while writes still surface their own
 * errors next to the form that triggered them.
 */
export type LiveState<T> =
  | { kind: 'loading' }
  | { kind: 'ready'; data: T }
  | { kind: 'error'; message: string }

/** A short, human-readable message for a thrown value (no stack traces in UI). */
export function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }
  if (typeof error === 'string' && error.trim() !== '') {
    return error
  }
  return 'Could not load the household data.'
}
