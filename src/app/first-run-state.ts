/**
 * First-run state — "a shell mode, not a route" (03 §5).
 *
 * The takeover on `/` appears while the household has no pets **and** either
 * the owner is still unnamed or the household was just reset in this tab. The
 * reset half is a session flag rather than persisted state so that:
 *
 * - a fresh install (placeholder owner, zero pets) shows it;
 * - "Reset household" returns to it immediately, with or without the
 *   forget-my-details checkbox (the task's acceptance);
 * - reopening a household that simply has no pets yet — but whose owner has a
 *   name — does not ambush them with onboarding (06 M4's "only while owner
 *   unnamed and no pets exist").
 *
 * The owner fields come from the live row, never a copy, so a reset that clears
 * the name can never show the old one.
 */
import { useSyncExternalStore } from 'react'

import { hasAnyPet, readOwnerIdentity } from '@/lib/db/repositories/household-status'
import { DEFAULT_OWNER_NAME } from '@/lib/rules/constants'

export const FIRST_RUN_REQUEST_KEY = 'pet-health.onboarding.v1'

export interface FirstRunSnapshot {
  hasPets: boolean
  ownerName: string
  ownerEmail: string
  ownerPhone: string
}

/** The live household facts the gate needs; also the root route's loader value. */
export async function loadFirstRunSnapshot(): Promise<FirstRunSnapshot> {
  const [hasPets, owner] = await Promise.all([hasAnyPet(), readOwnerIdentity()])
  return {
    hasPets,
    ownerName: owner?.name ?? '',
    ownerEmail: owner?.email ?? '',
    ownerPhone: owner?.phone ?? '',
  }
}

/** True when the owner row is absent or still the placeholder household name. */
export function isOwnerUnnamed(ownerName: string): boolean {
  const trimmed = ownerName.trim()
  return trimmed === '' || trimmed === DEFAULT_OWNER_NAME
}

/**
 * Pure gate: pets always win (an established household is never onboarded), and
 * the reset request only matters while the household is empty.
 */
export function shouldShowFirstRun(input: {
  hasPets: boolean
  ownerName: string
  resetRequested: boolean
}): boolean {
  if (input.hasPets) {
    return false
  }
  return input.resetRequested || isOwnerUnnamed(input.ownerName)
}

/* --------------------------------------------------------- reset request store */

type Listener = () => void

const listeners = new Set<Listener>()
let cached: boolean | null = null

function storage(): Storage | null {
  try {
    if (typeof window === 'undefined') {
      return null
    }
    return window.sessionStorage
  } catch {
    return null
  }
}

function read(): boolean {
  const store = storage()
  if (store === null) {
    return false
  }
  try {
    return store.getItem(FIRST_RUN_REQUEST_KEY) === '1'
  } catch {
    return false
  }
}

export function isFirstRunRequested(): boolean {
  if (cached === null) {
    cached = read()
  }
  return cached
}

function notify(): void {
  for (const listener of listeners) {
    listener()
  }
}

/** Called by the reset flow before the deletes land, so the gate re-evaluates. */
export function requestFirstRun(): void {
  cached = true
  const store = storage()
  if (store !== null) {
    try {
      store.setItem(FIRST_RUN_REQUEST_KEY, '1')
    } catch {
      // Session storage unavailable: the in-memory flag still drives this tab.
    }
  }
  notify()
}

/** Called when onboarding completes (create or sample household). */
export function clearFirstRunRequest(): void {
  cached = false
  const store = storage()
  if (store !== null) {
    try {
      store.removeItem(FIRST_RUN_REQUEST_KEY)
    } catch {
      // Nothing to clear.
    }
  }
  notify()
}

export function subscribeFirstRunRequest(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useFirstRunRequested(): boolean {
  return useSyncExternalStore(subscribeFirstRunRequest, isFirstRunRequested, () => false)
}

/** Test seam: forget the cached flag and listeners. */
export function resetFirstRunStateForTests(): void {
  cached = null
  listeners.clear()
}
