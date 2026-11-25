import { useLiveQuery } from 'dexie-react-hooks'

import { loadAttentionRows } from '@/lib/db/repositories/attention'
import { computeHouseholdAttention, type HouseholdAttention } from '@/lib/desktop/attention'
import { useNow } from '@/lib/hooks/useNow'
import { useSettings } from '@/lib/hooks/useSettings'

/**
 * The live F2 badge model. Both badges read the same `computeHouseholdAttention`
 * derivation as the dashboard counters and `/pets` (R1/R4), so the number on
 * Vaccinations is exactly the number of pets the filtered overdue list shows.
 *
 * A minute tick keeps "today's visits" honest across midnight and a live Dexie
 * query (R10) keeps every count honest across tabs and writes. `undefined` while
 * the first read is in flight — badges render nothing rather than a zero.
 */
export function useAttentionCounts(): HouseholdAttention | undefined {
  const settings = useSettings()
  const now = useNow(60_000)
  const windowDays = settings.dueSoonWindowDays

  return useLiveQuery(
    async () => {
      const rows = await loadAttentionRows()
      return computeHouseholdAttention({ ...rows, now, windowDays })
    },
    [now.getTime(), windowDays],
    undefined,
  )
}
