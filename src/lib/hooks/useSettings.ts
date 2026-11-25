import { useEffect, useState } from 'react'

import { loadSettings, subscribeSettings } from '@/lib/db/settings'
import { DEFAULT_SETTINGS } from '@/lib/rules/settings'
import type { Settings } from '@/lib/rules/types'

/**
 * The R2 settings record as a reactive hook. The store notifies on every write
 * from this tab and from other tabs/focus, so open screens re-render without a
 * manual refetch (02 R2/R10). Initialised synchronously from the persisted JSON
 * so the first paint already uses the saved window and unit.
 */
export function useSettings(): Settings {
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      return loadSettings()
    } catch {
      return { ...DEFAULT_SETTINGS }
    }
  })

  useEffect(() => {
    return subscribeSettings(() => {
      setSettings(loadSettings())
    })
  }, [])

  return settings
}
