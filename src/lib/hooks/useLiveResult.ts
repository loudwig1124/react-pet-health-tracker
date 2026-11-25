/**
 * One live-query state wrapper for every M2 list and detail screen.
 *
 * Dexie's `useLiveQuery` deliberately returns `undefined` while the first read
 * is in flight; a rejected querier surfaces as an unhandled render error. This
 * wrapper turns both into explicit `loading` / `error` / `ready` states so each
 * list can render its skeleton, its inline error panel with Retry, and its
 * content without a separate effect per screen (03 §5, R10).
 *
 * `deps` are the values the querier closes over (e.g. the pet id). `retry`
 * increments an internal attempt and re-subscribes the same query.
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'

export type LiveResult<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T }

export type LiveResultHandle<T> = LiveResult<T> & { retry: () => void }

type Settled<T> = { status: 'ready'; data: T } | { status: 'error'; error: Error }

export function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error))
}

export function useLiveResult<T>(
  querier: () => Promise<T>,
  deps: readonly unknown[],
): LiveResultHandle<T> {
  const [attempt, setAttempt] = useState(0)
  const retry = useCallback(() => setAttempt((value) => value + 1), [])

  const result = useLiveQuery<Settled<T>, undefined>(
    async () => {
      try {
        return { status: 'ready' as const, data: await querier() }
      } catch (error) {
        return { status: 'error' as const, error: asError(error) }
      }
    },
    [...deps, attempt],
    undefined,
  )

  if (result === undefined) {
    return { status: 'loading', retry }
  }
  return { ...result, retry }
}
