import { useState } from 'react'

import { createJournalEntry } from '@/lib/db/repositories/journal'
import { showJournalCreatedToast } from '@/lib/journal-actions'
import type { JournalKind } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

export interface QuickLogPet {
  id: string
  name: string
}

export interface QuickLogModel {
  petId: string
  pendingKind: JournalKind | null
  setPetId: (petId: string) => void
  log: (kind: JournalKind) => Promise<void>
}

/**
 * The one quick-log write path (Walk / Fed / Meds / Note at "now"), shared by
 * the dashboard island and the pet detail Journal tab. Keeping it here means the
 * tab cannot drift from the dashboard: same repository call, same 3 s Undo.
 */
export function useQuickLog(pets: readonly QuickLogPet[], preferredPetId?: string): QuickLogModel {
  const [choice, setChoice] = useState(preferredPetId ?? '')
  const [pendingKind, setPendingKind] = useState<JournalKind | null>(null)

  const petId = pets.some((pet) => pet.id === choice)
    ? choice
    : (pets.find((pet) => pet.id === preferredPetId)?.id ?? pets[0]?.id ?? '')
  const petNames = new Map(pets.map((pet) => [pet.id, pet.name] as const))

  async function log(kind: JournalKind): Promise<void> {
    if (petId === '') {
      return
    }
    setPendingKind(kind)
    try {
      const created = await createJournalEntry({
        petId,
        kind,
        occurredAt: new Date().toISOString(),
        note: null,
        durationMinutes: null,
      })
      showJournalCreatedToast(created, petNames.get(created.petId) ?? 'Pet')
    } catch (cause) {
      showToast({
        title: 'Could not log the entry',
        description: cause instanceof Error ? cause.message : 'Please try again.',
      })
    } finally {
      setPendingKind(null)
    }
  }

  return { petId, pendingKind, setPetId: setChoice, log }
}
