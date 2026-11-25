import { useSyncExternalStore } from 'react'

import { getDensity, subscribeDensity, type Density } from '@/lib/density'

/**
 * The persisted density preference, live. The shell applies it to
 * `<html data-density>`; Profile renders the two-state control from the same
 * value, so both stay in sync across tabs.
 */
export function useDensity(): Density {
  return useSyncExternalStore(subscribeDensity, getDensity, () => 'comfortable' as const)
}
