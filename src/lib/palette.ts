/**
 * F3 command-palette model: navigation + create commands + a plain substring
 * search over pets, clinical records, journal notes and visits.
 *
 * 05 F3 fixes the search contract: case- and diacritic-folded substring, eight
 * results per group, no fuzzy ranking. Keeping it pure (with the sources passed
 * in) means the eight-per-group limit and the recents pruning are unit tests,
 * while the lazy palette component only owns keyboard focus and layout.
 *
 * `cmdk` is deliberately not installed: the shell budget (01 D8) counts every
 * eager chunk, and the palette is mounted on demand from its own lazy chunk. A
 * small listbox on radix Dialog's focus trap is closer to this app's design
 * system than vendoring another command library.
 */

import { createCommand, CREATE_COMMANDS } from '@/lib/desktop/commands'
import { formatDateTime, formatDateKey, formatTime } from '@/lib/format'
import { localDayOfInstant } from '@/lib/rules/calendar'
import { APPOINTMENT_STATUS_LABELS, JOURNAL_KIND_LABELS } from '@/lib/rules/constants'
import { healthRecordTitle } from '@/lib/rules/health-records'
import type { Appointment, HealthRecord, JournalEntry, Pet } from '@/lib/rules/types'
import { APP_DESTINATIONS, PROFILE_PATH, type AppDestinationKey } from '@/lib/shell'

/**
 * Group keys double as the stable `command-group-<key>` test hooks the QA
 * suite (and the e2e/README hand-off) asks for: navigate · create · pets ·
 * records · journal · appointments.
 */
export type PaletteGroup = 'navigate' | 'create' | 'pets' | 'records' | 'journal' | 'appointments'

export const PALETTE_GROUP_ORDER: readonly PaletteGroup[] = [
  'navigate',
  'create',
  'pets',
  'records',
  'journal',
  'appointments',
]

export const PALETTE_GROUP_LABELS: Record<PaletteGroup, string> = {
  navigate: 'Go to',
  create: 'Create',
  pets: 'Pets',
  records: 'Health records',
  journal: 'Journal',
  appointments: 'Appointments',
}

/** 05 F3: "8 per group, no fuzzy ranking". */
export const PALETTE_GROUP_LIMIT = 8

/** F9: the empty palette offers the last five destinations or pets. */
export const PALETTE_RECENTS_LIMIT = 5

export interface PaletteItem {
  /** Stable across renders and used as the recents key (F9). */
  id: string
  group: PaletteGroup
  label: string
  description: string
  /** The route + query the command opens (F6-friendly, reload restores it). */
  to: string
  /** Extra searchable text that must not clutter the visible label. */
  keywords: string
}

const NAV_DESCRIPTIONS: Record<AppDestinationKey, string> = {
  dashboard: 'Counters, needs attention and recent entries',
  pets: 'The household table, sortable and filterable',
  appointments: 'Upcoming and past vet visits',
  vaccinations: 'Every dose on record with its due status',
  records: 'Append-only clinical notes',
  journal: 'The day-grouped household log',
}

/** Case- and diacritic-folded text; `é` matches `e` (F3 contract). */
export function foldPaletteText(value: string): string {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export interface PaletteSources {
  pets: readonly Pet[]
  records: readonly HealthRecord[]
  journal: readonly JournalEntry[]
  appointments: readonly Appointment[]
}

function recordKeywords(record: HealthRecord): string {
  return [
    record.condition ?? '',
    record.diagnosis ?? '',
    record.treatment ?? '',
    record.prescribedMedication ?? '',
    record.vetName ?? '',
  ].join(' ')
}

function journalKeywords(entry: JournalEntry): string {
  return `${entry.note ?? ''} ${entry.kind} ${JOURNAL_KIND_LABELS[entry.kind]}`
}

/** Builds the searchable command set from the live household rows. */
export function buildPaletteItems(sources: PaletteSources): PaletteItem[] {
  const petNames = new Map(sources.pets.map((pet) => [pet.id, pet.name] as const))
  const items: PaletteItem[] = []

  for (const destination of APP_DESTINATIONS) {
    items.push({
      id: `nav:${destination.path}`,
      group: 'navigate',
      label: destination.label,
      description: NAV_DESCRIPTIONS[destination.key],
      to: destination.path,
      keywords: 'go open page',
    })
  }
  items.push({
    id: `nav:${PROFILE_PATH}`,
    group: 'navigate',
    label: 'Profile',
    description: 'Owner, pets summary, preferences and household data',
    to: PROFILE_PATH,
    keywords: 'owner settings preferences data reset',
  })

  for (const command of CREATE_COMMANDS) {
    items.push({
      id: `create:${command.key}`,
      group: 'create',
      label: command.label,
      description: command.description,
      to: command.path,
      keywords: `new add create ${command.key}`,
    })
  }

  for (const pet of sources.pets) {
    items.push({
      id: `pet:${pet.id}`,
      group: 'pets',
      label: pet.name,
      description: `${pet.breed === null ? pet.species : `${pet.species} · ${pet.breed}`}`,
      to: `/pets/${encodeURIComponent(pet.id)}`,
      keywords: `${pet.species} ${pet.breed ?? ''} pet`,
    })
  }

  for (const record of sources.records) {
    const petName = petNames.get(record.petId) ?? 'Household'
    items.push({
      id: `record:${record.id}`,
      group: 'records',
      label: healthRecordTitle(record),
      description: `${petName} · ${formatDateKey(record.recordedOn)}`,
      to: `/pets/${encodeURIComponent(record.petId)}/records`,
      keywords: `${petName} record clinical ${recordKeywords(record)}`,
    })
  }

  for (const entry of sources.journal) {
    const petName = petNames.get(entry.petId) ?? 'Household'
    const note = entry.note?.trim() ?? ''
    const kindLabel = JOURNAL_KIND_LABELS[entry.kind]
    const label = note === '' ? `${kindLabel} entry` : note
    const search = note === '' ? kindLabel : note.slice(0, 40)
    const query = new URLSearchParams()
    query.set('pet', entry.petId)
    query.set('q', search)
    items.push({
      id: `note:${entry.id}`,
      group: 'journal',
      label,
      description: `${petName} · ${kindLabel} · ${formatDateTime(entry.occurredAt)}`,
      to: `/journal?${query.toString()}`,
      keywords: `${petName} journal log ${journalKeywords(entry)}`,
    })
  }

  for (const appointment of sources.appointments) {
    const petLabel =
      appointment.petId === null ? 'Household' : (petNames.get(appointment.petId) ?? 'Household')
    const day = localDayOfInstant(appointment.scheduledAt)
    const segment = appointment.status === 'scheduled' ? 'upcoming' : 'past'
    const query = new URLSearchParams()
    query.set('status', segment)
    query.set('day', day)
    if (appointment.petId !== null) {
      query.set('pet', appointment.petId)
    }
    items.push({
      id: `visit:${appointment.id}`,
      group: 'appointments',
      label: appointment.purpose,
      description: `${petLabel} · ${formatDateKey(day)} ${formatTime(appointment.scheduledAt)} · ${
        APPOINTMENT_STATUS_LABELS[appointment.status]
      }`,
      to: `/appointments?${query.toString()}`,
      keywords: `${petLabel} visit appointment ${appointment.clinicName} ${appointment.status}`,
    })
  }

  return items
}

function matchRank(item: PaletteItem, needle: string): number | null {
  const label = foldPaletteText(item.label)
  if (label.startsWith(needle)) {
    return 0
  }
  if (label.includes(needle)) {
    return 1
  }
  if (foldPaletteText(item.description).includes(needle)) {
    return 2
  }
  if (foldPaletteText(item.keywords).includes(needle)) {
    return 3
  }
  return null
}

/**
 * 05 F3's search: a folded substring match, worst rank last, at most
 * `PALETTE_GROUP_LIMIT` per group, groups in a fixed order.
 */
export function searchPalette(
  items: readonly PaletteItem[],
  query: string,
  limit: number = PALETTE_GROUP_LIMIT,
): PaletteItem[] {
  const needle = foldPaletteText(query)
  if (needle === '') {
    return []
  }
  const ranked = new Map<PaletteGroup, { item: PaletteItem; rank: number }[]>()
  for (const item of items) {
    const rank = matchRank(item, needle)
    if (rank === null) {
      continue
    }
    const bucket = ranked.get(item.group)
    if (bucket === undefined) {
      ranked.set(item.group, [{ item, rank }])
    } else {
      bucket.push({ item, rank })
    }
  }

  const output: PaletteItem[] = []
  for (const group of PALETTE_GROUP_ORDER) {
    const bucket = ranked.get(group)
    if (bucket === undefined) {
      continue
    }
    bucket.sort(
      (left, right) =>
        left.rank - right.rank ||
        left.item.label.localeCompare(right.item.label, undefined, { sensitivity: 'base' }),
    )
    for (const entry of bucket.slice(0, limit)) {
      output.push(entry.item)
    }
  }
  return output
}

/** The groups that carry at least one visible item, in display order. */
export function groupPaletteItems(
  items: readonly PaletteItem[],
): { group: PaletteGroup; label: string; items: PaletteItem[] }[] {
  const groups: { group: PaletteGroup; label: string; items: PaletteItem[] }[] = []
  for (const group of PALETTE_GROUP_ORDER) {
    const groupItems = items.filter((item) => item.group === group)
    if (groupItems.length > 0) {
      groups.push({ group, label: PALETTE_GROUP_LABELS[group], items: groupItems })
    }
  }
  return groups
}

/**
 * F9: the empty palette offers the last five destinations or pets. Recents are
 * stored as palette item ids and resolved against the current live items, so a
 * deleted pet (or a renamed command) is pruned without migrating storage.
 */
export function resolvePaletteRecents(
  ids: readonly string[],
  items: readonly PaletteItem[],
  limit: number = PALETTE_RECENTS_LIMIT,
): PaletteItem[] {
  const byId = new Map(items.map((item) => [item.id, item] as const))
  const resolved: PaletteItem[] = []
  const seen = new Set<string>()
  for (const id of ids) {
    if (seen.has(id)) {
      continue
    }
    const item = byId.get(id)
    if (item === undefined) {
      continue
    }
    if (item.group !== 'navigate' && item.group !== 'pets') {
      continue
    }
    seen.add(id)
    resolved.push(item)
    if (resolved.length === limit) {
      break
    }
  }
  return resolved
}

/** The recents id list after running an item (newest first, cap 5). */
export function rememberPaletteItem(
  ids: readonly string[],
  item: PaletteItem,
  limit: number = PALETTE_RECENTS_LIMIT,
): string[] {
  if (item.group !== 'navigate' && item.group !== 'pets') {
    return [...ids]
  }
  return [item.id, ...ids.filter((id) => id !== item.id)].slice(0, limit)
}

/** The create commands shown in the palette's empty state. */
export function createCommandPaletteItems(): PaletteItem[] {
  return CREATE_COMMANDS.map((command) => ({
    id: `create:${command.key}`,
    group: 'create' as const,
    label: command.label,
    description: command.description,
    to: command.path,
    keywords: `new add create ${command.key}`,
  }))
}

/** Convenience for the palette's empty-state copy; also proves the registry. */
export function createPaletteItem(key: string): PaletteItem | null {
  const command = CREATE_COMMANDS.find((candidate) => candidate.key === key)
  if (command === undefined) {
    return null
  }
  return {
    id: `create:${command.key}`,
    group: 'create',
    label: command.label,
    description: command.description,
    to: command.path,
    keywords: '',
  }
}

/** Re-export so the palette component and its tests share the command lookup. */
export { createCommand }
