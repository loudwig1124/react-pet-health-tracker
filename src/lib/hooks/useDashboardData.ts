import { useLiveQuery } from 'dexie-react-hooks'

import { loadAttentionRows } from '@/lib/db/repositories/attention'
import { listJournal } from '@/lib/db/repositories/journal'
import {
  computeHouseholdAttention,
  nextVisitDay,
  type HouseholdAttention,
  type NextVisitDay,
} from '@/lib/desktop/attention'
import type { JournalEntry, Pet } from '@/lib/rules/types'

/** How many recent journal rows the dashboard fetches; CSS reveals 3–6 by width. */
export const DASHBOARD_RECENT_LIMIT = 6

export interface DashboardData {
  pets: Pet[]
  attention: HouseholdAttention
  nextVisit: NextVisitDay | null
  recentJournal: JournalEntry[]
}

/**
 * F1's read model, live (R10): pets + doses + appointments in one read, the
 * dashboard's six newest journal entries, and the four counters / attention list
 * derived by `computeHouseholdAttention` from the shared R1/R4 rules.
 *
 * `windowDays` comes from the R2 settings hook; changing the preference re-runs
 * the query and every counter/detail follows without a reload.
 */
export function useDashboardData(windowDays: number): DashboardData | undefined {
  return useLiveQuery(
    async (): Promise<DashboardData> => {
      const now = new Date()
      const [rows, recentJournal] = await Promise.all([
        loadAttentionRows(),
        listJournal({ limit: DASHBOARD_RECENT_LIMIT }),
      ])
      return {
        pets: rows.pets,
        attention: computeHouseholdAttention({
          pets: rows.pets,
          doses: rows.doses,
          appointments: rows.appointments,
          now,
          windowDays,
        }),
        nextVisit: nextVisitDay(rows.appointments, rows.pets, now),
        recentJournal,
      }
    },
    [windowDays],
    undefined,
  )
}
