/**
 * Journal action helpers shared by `/journal`, the dashboard quick-log island
 * and the pet detail Journal tab (02 §1, 06 M4).
 *
 * The toast copy and the 3-second Undo wiring are product behaviour, so they
 * live in one place instead of being retyped per surface:
 * - create → "X logged" + Undo deletes the just-created row;
 * - delete → row disappears immediately, toast + Undo restores the exact row.
 */
import { deleteJournalEntry, restoreJournalEntry } from '@/lib/db/repositories/journal'
import { formatInstantTime } from '@/lib/format'
import { JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import type { JournalEntry } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

export function showJournalCreatedToast(entry: JournalEntry, petName: string): void {
  showToast({
    title: `${JOURNAL_KIND_LABELS[entry.kind]} logged`,
    description: `${petName} · ${formatInstantTime(entry.occurredAt)}`,
    action: {
      label: 'Undo',
      testId: 'journal-undo',
      onClick: () => {
        void deleteJournalEntry(entry.id).catch((cause: unknown) => {
          showToast({
            title: 'Could not undo the entry',
            description: cause instanceof Error ? cause.message : 'Please try again.',
          })
        })
      },
    },
  })
}

/** Deletes the row first, then offers the same 3 s Undo as every other surface. */
export async function deleteJournalEntryWithUndo(
  entry: JournalEntry,
  petName: string,
): Promise<void> {
  await deleteJournalEntry(entry.id)
  showToast({
    title: 'Entry deleted',
    description: `${JOURNAL_KIND_LABELS[entry.kind]} · ${petName}`,
    action: {
      label: 'Undo',
      testId: 'journal-undo',
      onClick: () => {
        void restoreJournalEntry(entry).catch((cause: unknown) => {
          showToast({
            title: 'Could not restore the entry',
            description: cause instanceof Error ? cause.message : 'Please try again.',
          })
        })
      },
    },
  })
}
