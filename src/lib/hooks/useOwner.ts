import { useLiveQuery } from 'dexie-react-hooks'

import { getOwner } from '@/lib/db/repositories/owners'
import type { Owner } from '@/lib/rules/types'

/**
 * The owner row, live. `undefined` while the first read is in flight; the
 * sidebar footer renders a skeleton then. Any write (Profile in M4) re-renders
 * every mounted surface through Dexie's live query (R10).
 */
export function useOwner(): Owner | undefined {
  return useLiveQuery(() => getOwner(), [], undefined)
}
