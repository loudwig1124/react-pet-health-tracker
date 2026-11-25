import { useLiveQuery } from 'dexie-react-hooks'
import { NotebookPen } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { JournalEditor } from '@/components/app/JournalEditor'
import { JournalEntryRow } from '@/components/app/JournalEntryRow'
import { QuickLogBar } from '@/components/app/QuickLogBar'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { listJournalForPet, updateJournalEntry } from '@/lib/db/repositories/journal'
import { formatDateKey, formatCount } from '@/lib/format'
import { useNow } from '@/lib/hooks/useNow'
import { useQuickLog } from '@/lib/hooks/useQuickLog'
import { deleteJournalEntryWithUndo } from '@/lib/journal-actions'
import {
  draftFromEntry,
  draftToJournalDraft,
  journalDayHeading,
  splitLocalDateTime,
  type JournalEditorDraft,
  type JournalEditorErrors,
} from '@/lib/journal-editor'
import { todayKey } from '@/lib/rules/calendar'
import { JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import { groupJournalEntriesByDay } from '@/lib/rules/journal'
import type { JournalEntry } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'

export interface PetJournalTabProps {
  petId: string
  petName: string
}

/**
 * The pet detail **Journal** tab (06 §2 M4, t10).
 *
 * Reuses the M4 journal components rather than forking them: the pet-scoped
 * query is the same repository (`listJournalForPet`), the rows are
 * `JournalEntryRow`, the editor is `JournalEditor` with the same draft/validation
 * helpers, delete goes through the same `deleteJournalEntryWithUndo` 3 s Undo,
 * and quick log is the shared `useQuickLog` hook preselected to this pet.
 *
 * The tab is a lazy child of the lazy pet route, so its chunk (editor, dialog,
 * quick log) never reaches the initial shell budget.
 */
export function PetJournalTab({ petId, petName }: PetJournalTabProps) {
  const now = useNow(60_000)
  const entries = useLiveQuery(() => listJournalForPet(petId), [petId])
  const quickLog = useQuickLog([{ id: petId, name: petName }], petId)
  const emptyLogHref = `/journal?pet=${encodeURIComponent(petId)}`

  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<JournalEditorDraft | null>(null)
  const [errors, setErrors] = useState<JournalEditorErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)

  const editingEntry =
    editingId === null ? undefined : entries?.find((entry) => entry.id === editingId)

  function startEdit(entry: JournalEntry): void {
    setEditingId(entry.id)
    setDraft(draftFromEntry(entry))
    setErrors({})
    setFormError(null)
  }

  function closeEditor(): void {
    setEditingId(null)
    setDraft(null)
    setErrors({})
    setFormError(null)
  }

  async function saveEdit(): Promise<void> {
    if (editingEntry === undefined || draft === null) {
      return
    }
    const result = draftToJournalDraft(draft)
    setErrors(result.errors)
    setFormError(null)
    if (result.value === null) {
      return
    }
    setPending(true)
    try {
      const before = draftFromEntry(editingEntry)
      await updateJournalEntry(editingEntry.id, {
        occurredAt: result.value.occurredAt,
        note: result.value.note,
        durationMinutes: result.value.durationMinutes,
      })
      showToast({
        title: 'Entry updated',
        description: `${JOURNAL_KIND_LABELS[editingEntry.kind]} · ${petName}`,
        action: {
          label: 'Undo',
          testId: 'journal-undo',
          onClick: () => {
            const previous = draftToJournalDraft(before)
            if (previous.value === null) {
              return
            }
            void updateJournalEntry(editingEntry.id, {
              occurredAt: previous.value.occurredAt,
              note: previous.value.note,
              durationMinutes: previous.value.durationMinutes,
            }).catch((cause: unknown) => {
              showToast({
                title: 'Could not undo the change',
                description: cause instanceof Error ? cause.message : 'Please try again.',
              })
            })
          },
        },
      })
      closeEditor()
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Could not save the entry.')
    } finally {
      setPending(false)
    }
  }

  async function confirmDelete(): Promise<void> {
    const entry = deleteTarget
    setDeleteTarget(null)
    if (entry === null) {
      return
    }
    try {
      await deleteJournalEntryWithUndo(entry, petName)
      if (editingId === entry.id) {
        closeEditor()
      }
    } catch (cause) {
      showToast({
        title: 'Could not delete the entry',
        description: cause instanceof Error ? cause.message : 'Please try again.',
      })
    }
  }

  if (entries === undefined) {
    return (
      <div data-testid="pet-journal-tab" className="flex flex-col gap-2">
        {[0, 1, 2].map((index) => (
          <div key={index} className="bg-muted/60 h-16 animate-pulse rounded-lg" />
        ))}
      </div>
    )
  }

  const groups = groupJournalEntriesByDay(entries, todayKey(now))

  return (
    <div data-testid="pet-journal-tab" className="flex flex-col gap-4">
      <QuickLogBar
        pets={[{ id: petId, name: petName }]}
        petId={quickLog.petId}
        pendingKind={quickLog.pendingKind}
        onPetChange={quickLog.setPetId}
        onLog={(kind) => {
          void quickLog.log(kind)
        }}
      />

      {editingEntry !== undefined && draft !== null ? (
        <div
          className="border-border bg-card rounded-xl border p-4"
          data-testid="journal-editor"
          data-mode="inline"
          aria-label={`Edit ${petName}’s journal entry`}
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-0.5">
              <h3 className="text-heading">Edit {JOURNAL_KIND_LABELS[editingEntry.kind]}</h3>
              <p className="text-caption text-muted-foreground">
                {petName} · {formatDateKey(splitLocalDateTime(editingEntry.occurredAt).date)}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={closeEditor}
              disabled={pending}
            >
              Close
            </Button>
          </div>
          <JournalEditor
            mode="edit"
            draft={draft}
            pets={[{ id: petId, name: petName }]}
            errors={errors}
            formError={formError}
            pending={pending}
            idPrefix="pet-journal-inline"
            entryId={editingEntry.id}
            onChange={(patch) => {
              setDraft((current) => (current === null ? current : { ...current, ...patch }))
            }}
            onSave={() => {
              void saveEdit()
            }}
            onRequestDelete={() => {
              setDeleteTarget(editingEntry)
            }}
            onCancelEdit={closeEditor}
          />
        </div>
      ) : null}

      {entries.length === 0 ? (
        <EmptyState
          testId="pet-journal-empty"
          icon={<NotebookPen aria-hidden="true" />}
          title={`Nothing logged for ${petName} yet`}
          description="Use the quick log above for a walk, meal, meds or note — it appears here immediately. The full journal is one click away."
          action={
            <Button
              type="button"
              onClick={() => {
                void quickLog.log('walk')
              }}
            >
              Quick log a walk
            </Button>
          }
          secondaryAction={
            <Button asChild variant="ghost">
              <Link to={emptyLogHref}>Open in Journal</Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-caption text-muted-foreground">
              {formatCount(entries.length, 'entry', 'entries')} · newest first
            </p>
            <Link
              to={emptyLogHref}
              className="text-primary text-small underline-offset-4 hover:underline"
            >
              Open in Journal
            </Link>
          </div>

          <div data-testid="pet-journal-feed" className="flex flex-col gap-4">
            {groups.map((group) => (
              <section
                key={group.day}
                data-testid={`pet-journal-day-${group.day}`}
                aria-label={journalDayHeading(group)}
                className="flex flex-col gap-1.5"
              >
                <h3 className="text-overline text-muted-foreground px-1">
                  {journalDayHeading(group)}
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {group.entries.map((entry) => (
                    <li key={entry.id}>
                      <JournalEntryRow
                        entry={entry}
                        petName={petName}
                        selected={editingId === entry.id}
                        onOpen={startEdit}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears immediately and can be restored from the toast for three seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="journal-delete-cancel">Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              data-testid="journal-delete-confirm"
              onClick={() => {
                void confirmDelete()
              }}
            >
              Delete entry
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
