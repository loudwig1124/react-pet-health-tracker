import { useLiveQuery } from 'dexie-react-hooks'
import { Plus, Search } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'

import { EmptyState } from '@/components/app/EmptyState'
import { JournalEditor } from '@/components/app/JournalEditor'
import { JournalEntryRow } from '@/components/app/JournalEntryRow'
import { PageAction } from '@/components/app/PageAction'
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
import { Input } from '@/components/ui/input'
import { AnimatedList, AnimatedListItem } from '@/components/ui/magicui/animated-list'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { createJournalEntry, listJournal, updateJournalEntry } from '@/lib/db/repositories/journal'
import { listPets } from '@/lib/db/repositories/pets'
import { formatCount, formatDateKey } from '@/lib/format'
import { useCreateIntent } from '@/lib/hooks/useCreateIntent'
import { useNow } from '@/lib/hooks/useNow'
import { useViewportWidth } from '@/lib/hooks/useSidebar'
import { deleteJournalEntryWithUndo, showJournalCreatedToast } from '@/lib/journal-actions'
import {
  draftForNewEntry,
  draftFromEntry,
  draftToJournalDraft,
  journalDayHeading,
  splitLocalDateTime,
  type JournalEditorDraft,
  type JournalEditorErrors,
} from '@/lib/journal-editor'
import { todayKey } from '@/lib/rules/calendar'
import { JOURNAL_KINDS, JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import { groupJournalEntriesByDay } from '@/lib/rules/journal'
import type { JournalEntry } from '@/lib/rules/types'
import { showToast } from '@/lib/toast'
import { cn } from '@/lib/utils'

import {
  filterJournalEntries,
  hasActiveFilters,
  parseJournalFilters,
  writeJournalFilters,
  type JournalFilters,
} from './journal-filters'

/** The inline editor exists from xl (1280 px); below it the editor is a Sheet. */
const INLINE_EDITOR_FROM = 1280

type EditorSelection = { mode: 'edit'; entryId: string } | null

function errorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : 'Something went wrong. Please try again.'
}

/**
 * `/journal` — three columns at ≥1280 px (context rail · day-grouped feed ·
 * inline editor) collapsing to feed + Sheet below, per 03 §3.
 *
 * All editor state (draft, selection, errors) lives here rather than inside the
 * editor fields, which is what lets a live resize convert the editor between
 * inline and sheet without dropping a keystroke. The URL carries the filters so
 * a reload/bookmark restores the same view (F6).
 */
export function JournalPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseJournalFilters(searchParams)

  const data = useLiveQuery(async () => {
    const [entries, pets] = await Promise.all([listJournal(), listPets()])
    return { entries, pets }
  }, [])

  const width = useViewportWidth()
  const isWide = width >= INLINE_EDITOR_FROM

  const pets = data?.pets ?? []
  const now = useNow(60_000)
  const today = todayKey(now)
  const defaultPetId = filters.petId ?? pets[0]?.id ?? ''

  const petNames = new Map(pets.map((pet) => [pet.id, pet.name] as const))

  const [selection, setSelection] = useState<EditorSelection>(null)
  const [draft, setDraft] = useState<JournalEditorDraft>(() => draftForNewEntry('', new Date()))
  const [errors, setErrors] = useState<JournalEditorErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<JournalEntry | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)

  const [lastWide, setLastWide] = useState(isWide)

  // Live resize: inline → Sheet (and back) with the same draft, never a reset.
  // This is the render-phase "adjust state when a prop changes" pattern; the
  // draft itself lives above both containers, so no text is lost either way.
  if (lastWide !== isWide) {
    setLastWide(isWide)
    setSheetOpen(!isWide)
  }

  // A live delete elsewhere must not leave the editor attached to a gone row.
  if (selection !== null && data !== undefined) {
    if (!data.entries.some((entry) => entry.id === selection.entryId)) {
      setSelection(null)
      setDraft(draftForNewEntry(defaultPetId, now))
      setErrors({})
      setFormError(null)
    }
  }

  // The create form's pet follows the list/filter until the user picks one; the
  // draft stays the single source of truth for the text and time fields.
  const effectiveDraft: JournalEditorDraft =
    selection === null && draft.petId === '' && defaultPetId !== ''
      ? { ...draft, petId: defaultPetId }
      : draft

  const filteredEntries = data === undefined ? [] : filterJournalEntries(data.entries, filters)
  const groups = groupJournalEntriesByDay(filteredEntries, today)

  function updateFilters(patch: Partial<JournalFilters>): void {
    setSearchParams(writeJournalFilters({ ...filters, ...patch }, searchParams), {
      replace: true,
    })
  }

  function resetEditor(petId = defaultPetId): void {
    setSelection(null)
    setDraft(draftForNewEntry(petId, new Date()))
    setErrors({})
    setFormError(null)
    setSheetOpen(false)
  }

  function startCreate(): void {
    setSelection(null)
    setDraft(draftForNewEntry(defaultPetId, new Date()))
    setErrors({})
    setFormError(null)
    setSheetOpen(true)
  }

  function startEdit(entry: JournalEntry): void {
    setSelection({ mode: 'edit', entryId: entry.id })
    setDraft(draftFromEntry(entry))
    setErrors({})
    setFormError(null)
    setSheetOpen(true)
  }

  // ⌘N / the palette's "Log entry" command (F4 create intent).
  useCreateIntent(startCreate, data !== undefined && pets.length > 0)

  function handleSheetOpenChange(open: boolean): void {
    if (open) {
      setSheetOpen(true)
      return
    }
    resetEditor(selection?.mode === 'edit' ? defaultPetId : draft.petId)
  }

  async function save(): Promise<void> {
    const result = draftToJournalDraft(effectiveDraft)
    setErrors(result.errors)
    setFormError(null)
    if (result.value === null) {
      return
    }
    setPending(true)
    try {
      const petName = petNames.get(result.value.petId) ?? 'Pet'
      if (selection?.mode === 'edit') {
        // Capture the editable trio first so the 3 s Undo can put the exact
        // previous values back (kind and pet stay untouched, per R6).
        const before = editingEntry === undefined ? null : draftFromEntry(editingEntry)
        await updateJournalEntry(selection.entryId, {
          occurredAt: result.value.occurredAt,
          note: result.value.note,
          durationMinutes: result.value.durationMinutes,
        })
        const entryId = selection.entryId
        showToast({
          title: 'Entry updated',
          description: `${JOURNAL_KIND_LABELS[effectiveDraft.kind]} · ${petName}`,
          action:
            before === null
              ? undefined
              : {
                  label: 'Undo',
                  testId: 'journal-undo',
                  onClick: () => {
                    const previous = draftToJournalDraft(before)
                    if (previous.value === null) {
                      return
                    }
                    void updateJournalEntry(entryId, {
                      occurredAt: previous.value.occurredAt,
                      note: previous.value.note,
                      durationMinutes: previous.value.durationMinutes,
                    }).catch((cause: unknown) => {
                      showToast({
                        title: 'Could not undo the change',
                        description: errorMessage(cause),
                      })
                    })
                  },
                },
        })
      } else {
        const created = await createJournalEntry(result.value)
        setHighlightId(created.id)
        showJournalCreatedToast(created, petName)
      }
      resetEditor(result.value.petId)
    } catch (cause) {
      setFormError(errorMessage(cause))
    } finally {
      setPending(false)
    }
  }

  function requestDelete(entry: JournalEntry): void {
    setDeleteTarget(entry)
  }

  async function confirmDelete(): Promise<void> {
    const entry = deleteTarget
    setDeleteTarget(null)
    if (entry === null) {
      return
    }
    try {
      await deleteJournalEntryWithUndo(entry, petNames.get(entry.petId) ?? 'Pet')
      if (selection?.mode === 'edit' && selection.entryId === entry.id) {
        resetEditor(defaultPetId)
      }
    } catch (cause) {
      showToast({ title: 'Could not delete the entry', description: errorMessage(cause) })
    }
  }

  const editorMode = selection?.mode === 'edit' ? 'edit' : 'create'
  const editingEntry =
    selection?.mode === 'edit'
      ? data?.entries.find((entry) => entry.id === selection.entryId)
      : undefined
  const editorTitle =
    editorMode === 'edit' && editingEntry !== undefined
      ? `Edit ${JOURNAL_KIND_LABELS[editingEntry.kind]}`
      : 'New entry'
  const editorSubtitle =
    editingEntry === undefined
      ? 'Kind and pet are chosen once; only the time, note and duration can change later.'
      : `${petNames.get(editingEntry.petId) ?? 'Pet'} · ${formatDateKey(
          splitLocalDateTime(editingEntry.occurredAt).date,
        )}`

  const editor = (
    <JournalEditor
      mode={editorMode}
      draft={effectiveDraft}
      pets={pets}
      errors={errors}
      formError={formError}
      pending={pending}
      idPrefix={isWide ? 'journal-inline' : 'journal-sheet'}
      entryId={selection?.mode === 'edit' ? selection.entryId : undefined}
      onChange={(patch) => {
        setDraft((current) => ({
          ...(current.petId === '' ? { ...current, petId: defaultPetId } : current),
          ...patch,
        }))
      }}
      onSave={() => {
        void save()
      }}
      onRequestDelete={
        selection?.mode === 'edit' && editingEntry !== undefined
          ? () => {
              requestDelete(editingEntry)
            }
          : undefined
      }
      onCancelEdit={() => {
        resetEditor()
      }}
    />
  )

  if (data === undefined) {
    return (
      <div data-testid="journal-page" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Skeleton className="h-9 w-40 rounded-lg" />
          <Skeleton className="h-9 w-36 rounded-lg" />
          <Skeleton className="h-9 w-56 rounded-lg" />
        </div>
        <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
          <Skeleton className="hidden h-80 rounded-xl xl:block" />
          <div className="flex flex-col gap-3">
            {[0, 1, 2, 3].map((index) => (
              <Skeleton key={index} className="h-16 rounded-lg" />
            ))}
          </div>
          <Skeleton className="hidden h-96 rounded-xl xl:block" />
        </div>
      </div>
    )
  }

  const totalEntries = data.entries.length
  const empty = filteredEntries.length === 0
  const filtered = hasActiveFilters(filters)

  return (
    <div data-testid="journal-page" className="flex flex-col gap-4">
      <PageAction>
        <Button type="button" onClick={startCreate} data-testid="journal-add-header">
          <Plus aria-hidden="true" />
          Log entry
        </Button>
      </PageAction>

      <div className="flex flex-wrap items-center gap-2.5" data-testid="journal-toolbar">
        <NativeSelect
          aria-label="Filter by pet"
          data-testid="journal-filter-pet"
          size="sm"
          className="w-[10rem]"
          value={filters.petId ?? 'all'}
          onChange={(event) => {
            const value = event.currentTarget.value
            updateFilters({ petId: value === 'all' ? null : value })
          }}
        >
          <NativeSelectOption value="all">All pets</NativeSelectOption>
          {pets.map((pet) => (
            <NativeSelectOption key={pet.id} value={pet.id}>
              {pet.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <NativeSelect
          aria-label="Filter by kind"
          data-testid="journal-filter-kind"
          size="sm"
          className="w-[9rem]"
          value={filters.kind ?? 'all'}
          onChange={(event) => {
            const value = event.currentTarget.value
            updateFilters({
              kind: value === 'all' ? null : (value as JournalFilters['kind']),
            })
          }}
        >
          <NativeSelectOption value="all">All kinds</NativeSelectOption>
          {JOURNAL_KINDS.map((kind) => (
            <NativeSelectOption key={kind} value={kind}>
              {JOURNAL_KIND_LABELS[kind]}
            </NativeSelectOption>
          ))}
        </NativeSelect>

        <label className="relative">
          <span className="sr-only">Search journal</span>
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
          />
          <Input
            aria-label="Search journal"
            type="search"
            placeholder="Search notes…"
            className="w-56 pl-8"
            value={filters.search}
            onChange={(event) => {
              updateFilters({ search: event.currentTarget.value })
            }}
          />
        </label>

        {/* The primary create action lives in the sticky header (PageAction), as it
            does on every other screen; keeping a second one in the filter toolbar
            duplicated it. The count anchors the right edge instead. */}
        <span
          className="text-caption text-muted-foreground ml-auto tabular-nums"
          data-testid="journal-count"
        >
          {formatCount(filteredEntries.length, 'entry', 'entries')}
        </span>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[200px_minmax(0,1fr)_320px]">
        <aside className="hidden flex-col gap-5 xl:flex" aria-label="Journal filters">
          <FilterRail
            heading="Pets"
            allLabel="All pets"
            allActive={filters.petId === null}
            options={pets.map((pet) => ({ id: pet.id, label: pet.name }))}
            activeId={filters.petId}
            onSelect={(id) => {
              updateFilters({ petId: id })
            }}
          />
          <FilterRail
            heading="Kinds"
            allLabel="All kinds"
            allActive={filters.kind === null}
            options={JOURNAL_KINDS.map((kind) => ({
              id: kind,
              label: JOURNAL_KIND_LABELS[kind],
            }))}
            activeId={filters.kind}
            onSelect={(id) => {
              updateFilters({ kind: id === null ? null : (id as JournalFilters['kind']) })
            }}
          />
        </aside>

        <section className="flex min-w-0 flex-col gap-4" aria-label="Journal feed">
          {empty ? (
            <EmptyState
              testId="journal-empty"
              icon={<Search aria-hidden="true" />}
              title={
                totalEntries === 0
                  ? 'Nothing logged yet'
                  : filters.petId !== null
                    ? 'Nothing for this pet'
                    : 'No entries match these filters'
              }
              description={
                totalEntries === 0
                  ? 'Use Quick log on the dashboard or log the first entry here — walks, meals, meds and notes all live in one feed.'
                  : 'Clear the filter to see the rest of the household journal.'
              }
              action={
                totalEntries === 0 ? (
                  <Button type="button" onClick={startCreate}>
                    <Plus aria-hidden="true" />
                    Log the first entry
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSearchParams(new URLSearchParams(), { replace: true })
                    }}
                  >
                    Clear filters
                  </Button>
                )
              }
            />
          ) : (
            <AnimatedList data-testid="journal-feed" aria-label="Journal entries" className="gap-5">
              {groups.map((group) => (
                <section
                  key={group.day}
                  data-testid={`journal-day-${group.day}`}
                  aria-label={journalDayHeading(group)}
                  className="flex flex-col gap-1.5"
                >
                  <h2 className="text-overline text-muted-foreground px-1">
                    {journalDayHeading(group)}
                  </h2>
                  <ul className="flex flex-col gap-1.5">
                    {group.entries.map((entry, index) => (
                      <li key={entry.id}>
                        <AnimatedListItem
                          index={index}
                          animate={entry.id === highlightId}
                          className="rounded-lg"
                        >
                          <JournalEntryRow
                            entry={entry}
                            petName={petNames.get(entry.petId) ?? 'Unknown pet'}
                            selected={selection?.mode === 'edit' && selection.entryId === entry.id}
                            onOpen={startEdit}
                          />
                        </AnimatedListItem>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </AnimatedList>
          )}

          {filtered && !empty ? (
            <div className="flex justify-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchParams(new URLSearchParams(), { replace: true })
                }}
                data-testid="journal-clear-filters"
              >
                Clear filters
              </Button>
            </div>
          ) : null}
        </section>

        {isWide ? (
          <aside
            className="min-w-0"
            data-testid="journal-editor"
            data-mode="inline"
            aria-label="Entry editor"
          >
            <div className="border-border bg-card sticky top-4 rounded-xl border p-4">
              <EditorHeading title={editorTitle} subtitle={editorSubtitle} />
              {editor}
            </div>
          </aside>
        ) : null}
      </div>

      {isWide ? null : (
        <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
          <SheetContent
            side="right"
            className="w-full gap-0 overflow-y-auto sm:max-w-md"
            data-testid="journal-sheet"
          >
            <SheetHeader>
              <SheetTitle>{editorTitle}</SheetTitle>
              <SheetDescription>{editorSubtitle}</SheetDescription>
            </SheetHeader>
            <div data-testid="journal-editor" data-mode="sheet" className="px-4 pb-4">
              {editor}
            </div>
          </SheetContent>
        </Sheet>
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
              The entry disappears from the feed immediately and can be restored from the toast for
              three seconds. After that it is gone.
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

function EditorHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      <h2 className="text-heading">{title}</h2>
      <p className="text-caption text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function FilterRail({
  heading,
  allLabel,
  allActive,
  options,
  activeId,
  onSelect,
}: {
  heading: string
  allLabel: string
  allActive: boolean
  options: readonly { id: string; label: string }[]
  activeId: string | null
  onSelect: (id: string | null) => void
}) {
  return (
    <section className="flex flex-col gap-1.5" aria-label={heading}>
      <h2 className="text-overline text-muted-foreground px-1">{heading}</h2>
      <ul className="flex flex-col gap-0.5">
        <li>
          <FilterButton active={allActive} onClick={() => onSelect(null)}>
            {allLabel}
          </FilterButton>
        </li>
        {options.map((option) => (
          <li key={option.id}>
            <FilterButton active={activeId === option.id} onClick={() => onSelect(option.id)}>
              {option.label}
            </FilterButton>
          </li>
        ))}
      </ul>
    </section>
  )
}

function FilterButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'text-small flex h-8 w-full items-center gap-2 rounded-md px-2 text-left',
        'transition-colors duration-[var(--dur-fast)]',
        'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        active ? 'bg-accent-soft text-foreground font-medium' : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}
