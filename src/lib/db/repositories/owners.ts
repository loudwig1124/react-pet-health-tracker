/**
 * Owner repository — the single household profile row (fixed key `owner`).
 * One repository per entity (02 R7/§4 risk 1): nothing outside this folder
 * touches `db.owner`.
 */
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'
import type { Owner, OwnerDraft } from '@/lib/rules/types'

import { db } from '../db'
import { ownerDraftSchema, ownerSchema, parseRow } from '../schema'
import { toIsoInstant } from '../write-helpers'
import { OWNER_ID } from './household-status'

/**
 * The DDL's "exactly one row" is a fixed key here (02 §3). Defined in the light
 * `household-status` module so the eager shell's boot can import it without the
 * zod schema graph; re-exported here because this is the owner write repository.
 */
export { OWNER_ID }

export async function getOwner(): Promise<Owner | undefined> {
  return db.owner.get(OWNER_ID)
}

/** Boot guarantee: the household always has an owner row to greet/render. */
export async function ensureOwner(now: Date = new Date()): Promise<Owner> {
  return db.transaction('rw', db.owner, async () => {
    const existing = await db.owner.get(OWNER_ID)
    if (existing !== undefined) {
      return existing
    }
    const instant = toIsoInstant(now)
    const owner = parseRow(
      ownerSchema,
      {
        id: OWNER_ID,
        name: DEFAULT_OWNER_NAME,
        email: '',
        phone: '',
        createdAt: instant,
        updatedAt: instant,
      },
      'owner',
    )
    await db.owner.add(owner)
    return owner
  })
}

export async function saveOwner(draft: OwnerDraft, now: Date = new Date()): Promise<Owner> {
  const parsed = parseRow(ownerDraftSchema, draft, 'owner draft')
  return db.transaction('rw', db.owner, async () => {
    const existing = await db.owner.get(OWNER_ID)
    if (existing === undefined) {
      const instant = toIsoInstant(now)
      const owner = parseRow(
        ownerSchema,
        {
          id: OWNER_ID,
          ...parsed,
          createdAt: instant,
          updatedAt: instant,
        },
        'owner',
      )
      await db.owner.add(owner)
      return owner
    }
    const updated = parseRow(
      ownerSchema,
      { ...existing, ...parsed, updatedAt: toIsoInstant(now) },
      'owner',
    )
    await db.owner.put(updated)
    return updated
  })
}
