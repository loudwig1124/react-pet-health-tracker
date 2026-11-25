/**
 * Live data for `/vaccinations`: every dose, the pet list and the vaccine
 * catalog, plus the due-soon window from settings (R2). One `liveQuery`, so a
 * dose saved in a dialog, a pet edited in another tab or a re-vaccination
 * immediately re-renders the table (R10).
 */
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useState } from 'react'

import { listPets } from '@/lib/db/repositories/pets'
import { listHouseholdVaccinations } from '@/lib/db/repositories/vaccinations'
import { listVaccineTypes } from '@/lib/db/repositories/vaccine-types'
import { loadSettings, subscribeSettings } from '@/lib/db/settings'
import type { Pet, Settings, Vaccination, VaccineType } from '@/lib/rules/types'
import { localToday } from '@/lib/schedule/format'
import { errorMessage, type LiveState } from '@/lib/schedule/live'

export interface VaccinationsData {
  pets: Pet[]
  doses: Vaccination[]
  vaccineTypes: VaccineType[]
}

export interface VaccinationsLive {
  state: LiveState<VaccinationsData>
  settings: Settings
  /** Local "today" for R1/R4, refreshed when the window regains focus. */
  today: string
  retry: () => void
}

export function useVaccinationsData(): VaccinationsLive {
  const [retryToken, setRetryToken] = useState(0)
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [today, setToday] = useState<string>(() => localToday())

  useEffect(() => subscribeSettings(() => setSettings(loadSettings())), [])

  useEffect(() => {
    const refresh = (): void => setToday(localToday())
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const state = useLiveQuery(
    async (): Promise<LiveState<VaccinationsData>> => {
      try {
        const [pets, doses, vaccineTypes] = await Promise.all([
          listPets(),
          listHouseholdVaccinations(),
          listVaccineTypes(),
        ])
        return { kind: 'ready', data: { pets, doses, vaccineTypes } }
      } catch (error) {
        return { kind: 'error', message: errorMessage(error) }
      }
    },
    [retryToken],
    { kind: 'loading' as const },
  )

  const retry = useCallback(() => setRetryToken((token) => token + 1), [])

  return { state, settings, today, retry }
}
