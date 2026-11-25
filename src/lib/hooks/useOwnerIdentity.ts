import { useLiveQuery } from 'dexie-react-hooks'

import { readOwnerIdentity, type OwnerIdentity } from '@/lib/db/repositories/household-status'

/**
 * The owner's name/email/phone, live, for the eager shell (sidebar footer) and
 * the dashboard greeting.
 *
 * Reads the light owner projection rather than `useOwner` (which imports the
 * zod write schema): the M5 performance pass keeps the schema graph out of the
 * first-load chunk. Profile and pet detail still use the full owner repository
 * in their lazy route chunks.
 *
 * `undefined` while the first IndexedDB read is in flight; `null` when the row
 * is missing (the boot guarantee makes that a transient state only).
 */
export function useOwnerIdentity(): OwnerIdentity | null | undefined {
  return useLiveQuery(() => readOwnerIdentity(), [], undefined)
}
