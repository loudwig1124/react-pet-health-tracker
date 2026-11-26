import { useLiveQuery } from 'dexie-react-hooks'

import { loadAttentionRows } from '@/lib/db/repositories/attention'
import { listHealthRecordsForPet } from '@/lib/db/repositories/health-records'
import { listJournal } from '@/lib/db/repositories/journal'
import { buildPaletteItems, type PaletteItem } from '@/lib/palette'

/** How many journal notes the palette searches; newest first. */
const PALETTE_JOURNAL_LIMIT = 500

/**
 * The palette's live search corpus. Mounted only while the palette is open (the
 * lazy chunk), so this read never runs during normal navigation.
 *
 * Pets and appointments come from the light read model; records are assembled
 * from the per-pet record read (R5's surface test covers the repository);
 * journal uses the same household read as `/journal`. Any write re-runs the
 * query, so a note added in another tab is findable immediately (R10).
 */
export function usePaletteItems(): PaletteItem[] | undefined {
  return useLiveQuery(
    async (): Promise<PaletteItem[]> => {
      const [rows, journal] = await Promise.all([
        loadAttentionRows(),
        listJournal({ limit: PALETTE_JOURNAL_LIMIT }),
      ])
      const records = (
        await Promise.all(rows.pets.map((pet) => listHealthRecordsForPet(pet.id)))
      ).flat()
      return buildPaletteItems({
        pets: rows.pets,
        records,
        journal,
        appointments: rows.appointments,
      })
    },
    [],
    undefined,
  )
}
