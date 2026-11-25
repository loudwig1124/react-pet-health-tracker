/**
 * The light household reads the **eager** shell needs: does a pet exist, who is
 * the owner, and the owner row boot guarantees.
 *
 * Deliberately not `repositories/owners.ts` / `pets.ts`: those import the zod
 * schema mirrors (and the pet validation rules), and the shell runs on every
 * page — the first-load gate (01 D8) must not pay for write-path validation
 * before anyone writes anything. This module reads/writes exactly one raw row
 * and is the documented exception to "one repository per entity": it is the
 * shell's read model plus the owner-row boot guarantee, not an entity write path
 * (02 R7 is unchanged — Profile still writes through `repositories/owners.ts`).
 *
 * M5 performance pass: removing the schema/zod graph from the eager shell is
 * what keeps the first load under 200 kB once the desktop chrome (header
 * tools, palette host, badges) lands.
 */
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'
import type { Owner } from '@/lib/rules/types'

import { db } from '../db'

/** The DDL's "exactly one row" is a fixed key (02 §3). */
export const OWNER_ID = 'owner'

export interface OwnerIdentity {
  name: string
  email: string
  phone: string
}

/** True when the household has at least one pet. */
export async function hasAnyPet(): Promise<boolean> {
  return (await db.pet.count()) > 0
}

/** The three owner fields the sidebar/first-run gate render; null when absent. */
export async function readOwnerIdentity(): Promise<OwnerIdentity | null> {
  const owner = await db.owner.get(OWNER_ID)
  if (owner === undefined) {
    return null
  }
  return { name: owner.name, email: owner.email, phone: owner.phone }
}

/**
 * Boot guarantee: the household always has an owner row to greet/render. The
 * default row is a fixed literal, so it needs no schema parse; a user-edited
 * owner still goes through the validated Profile write path.
 */
export async function ensureOwnerRow(now: Date = new Date()): Promise<Owner> {
  return db.transaction('rw', db.owner, async () => {
    const existing = await db.owner.get(OWNER_ID)
    if (existing !== undefined) {
      return existing
    }
    const instant = now.toISOString()
    const owner: Owner = {
      id: OWNER_ID,
      name: DEFAULT_OWNER_NAME,
      email: '',
      phone: '',
      createdAt: instant,
      updatedAt: instant,
    }
    await db.owner.add(owner)
    return owner
  })
}
