/**
 * Live data for `/appointments`: the pet list plus the repository's two read
 * models — upcoming (scheduled and ahead) and history (everything else) — in
 * one `liveQuery`. A booking, completion, cancellation or reschedule anywhere
 * re-renders every mounted view without a refresh (R10).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useState } from 'react'

import {
  listHistoryAppointments,
  listUpcomingAppointments,
} from '@/lib/db/repositories/appointments'
import { listPets } from '@/lib/db/repositories/pets'
import type { Appointment, Pet } from '@/lib/rules/types'
import { errorMessage, type LiveState } from '@/lib/schedule/live'

export interface AppointmentsData {
  pets: Pet[]
  upcoming: Appointment[]
  past: Appointment[]
}

export interface AppointmentsLive {
  state: LiveState<AppointmentsData>
  /** The partition clock, read once per mount (R3: the write path re-reads on action). */
  now: Date
  retry: () => void
}

export function useAppointmentsData(): AppointmentsLive {
  const [retryToken, setRetryToken] = useState(0)
  const [now] = useState(() => new Date())

  const state = useLiveQuery(
    async (): Promise<LiveState<AppointmentsData>> => {
      try {
        const [pets, upcoming, past] = await Promise.all([
          listPets(),
          listUpcomingAppointments({ now }),
          listHistoryAppointments({ now }),
        ])
        return { kind: 'ready', data: { pets, upcoming, past } }
      } catch (error) {
        return { kind: 'error', message: errorMessage(error) }
      }
    },
    [now, retryToken],
    { kind: 'loading' as const },
  )

  const retry = useCallback(() => setRetryToken((token) => token + 1), [])

  return { state, now, retry }
}
