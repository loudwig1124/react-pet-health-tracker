import { resetBootForTests } from '@/lib/db/boot'
import { db } from '@/lib/db/db'
import { SETTINGS_STORAGE_KEY, clearSettingsCacheForTests } from '@/lib/db/settings'

/**
 * Fresh IndexedDB + settings for every DB test. Uses the app singleton so the
 * repositories under test are the real ones (no test-only dependency seam).
 */
export async function resetDatabaseForTests(): Promise<void> {
  resetBootForTests()
  if (db.isOpen()) {
    db.close()
  }
  await db.delete()
  await db.open()
  clearSettingsCacheForTests()
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(SETTINGS_STORAGE_KEY)
    } catch {
      // Storage unavailable; nothing to clear.
    }
  }
}
