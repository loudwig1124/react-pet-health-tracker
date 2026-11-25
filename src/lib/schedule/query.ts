/**
 * URL state for the two M3 screens (F6, 06 §2 M2/M3).
 *
 * The URL is the single source of truth for the sort, filters, view and the
 * selected calendar day, so a reload or a bookmark restores the screen (03 §2).
 * Parsing is forgiving — an unknown/typo'd value falls back to the default
 * instead of throwing — while serialising only writes non-default values, which
 * keeps shared links short.
 *
 * The pet filter keeps R10's three-way distinction:
 * - no `pet` parameter at all = no request (the household view);
 * - `?pet=all` = explicitly every pet (clears a stale filter);
 * - `?pet=<id>` = that pet.
 */

import { isDateKey } from '@/lib/rules/calendar'
import { VACCINATION_DUE_STATUSES } from '@/lib/rules/constants'
import { PET_FILTER_ALL } from '@/lib/rules/handoff'
import type { DateKey, VaccinationDueStatus } from '@/lib/rules/types'

export type SortDirection = 'asc' | 'desc'

export function parseSortDirection(value: string | null): SortDirection | null {
  return value === 'asc' || value === 'desc' ? value : null
}

export function flipSortDirection(direction: SortDirection): SortDirection {
  return direction === 'asc' ? 'desc' : 'asc'
}

export interface SortChange {
  sort: string
  dir: SortDirection
}

/**
 * The header-click behaviour every data table shares: clicking the active
 * column flips its direction; clicking another column selects it with that
 * column's natural default direction.
 */
export function nextSortChange(
  currentSort: string,
  currentDirection: SortDirection,
  clickedSort: string,
  defaultDirectionForClicked: SortDirection,
): SortChange {
  if (currentSort === clickedSort) {
    return { sort: clickedSort, dir: flipSortDirection(currentDirection) }
  }
  return { sort: clickedSort, dir: defaultDirectionForClicked }
}

/* ------------------------------------------------------------ appointments */

export const APPOINTMENT_SEGMENTS = ['upcoming', 'past'] as const
export type AppointmentSegment = (typeof APPOINTMENT_SEGMENTS)[number]

export const APPOINTMENT_VIEWS = ['table', 'calendar'] as const
export type AppointmentView = (typeof APPOINTMENT_VIEWS)[number]

export const APPOINTMENT_SORT_KEYS = ['when', 'pet', 'clinic', 'status'] as const
export type AppointmentSortKey = (typeof APPOINTMENT_SORT_KEYS)[number]

export interface AppointmentSearch {
  status: AppointmentSegment
  view: AppointmentView
  /** `undefined` = no parameter, `'all'` = explicit all pets, else the pet id. */
  petParam: 'all' | string | undefined
  /** The resolved filter: `null` means every pet. */
  petId: string | null
  day: DateKey | null
  sort: AppointmentSortKey
  dir: SortDirection
}

export const DEFAULT_APPOINTMENT_SEARCH: AppointmentSearch = Object.freeze({
  status: 'upcoming',
  view: 'table',
  petParam: undefined,
  petId: null,
  day: null,
  sort: 'when',
  dir: 'asc',
})

export function isAppointmentSegment(value: string | null): value is AppointmentSegment {
  return value !== null && (APPOINTMENT_SEGMENTS as readonly string[]).includes(value)
}

export function isAppointmentView(value: string | null): value is AppointmentView {
  return value !== null && (APPOINTMENT_VIEWS as readonly string[]).includes(value)
}

export function isAppointmentSortKey(value: string | null): value is AppointmentSortKey {
  return value !== null && (APPOINTMENT_SORT_KEYS as readonly string[]).includes(value)
}

/** Upcoming reads soonest-first; Past reads newest-first (02 §3). */
export function defaultAppointmentDirection(
  status: AppointmentSegment,
  sort: AppointmentSortKey,
): SortDirection {
  if (sort === 'when') {
    return status === 'past' ? 'desc' : 'asc'
  }
  return 'asc'
}

export function parseAppointmentSearch(params: URLSearchParams): AppointmentSearch {
  const status = isAppointmentSegment(params.get('status'))
    ? (params.get('status') as AppointmentSegment)
    : DEFAULT_APPOINTMENT_SEARCH.status
  const view = isAppointmentView(params.get('view'))
    ? (params.get('view') as AppointmentView)
    : 'table'
  const rawPet = params.get('pet')?.trim() ?? ''
  const petParam = rawPet === '' ? undefined : rawPet === PET_FILTER_ALL ? PET_FILTER_ALL : rawPet
  const petId = petParam === undefined || petParam === PET_FILTER_ALL ? null : petParam
  const rawDay = params.get('day')?.trim() ?? ''
  const day = rawDay !== '' && isDateKey(rawDay) ? rawDay : null
  const sort = isAppointmentSortKey(params.get('sort'))
    ? (params.get('sort') as AppointmentSortKey)
    : 'when'
  const dir = parseSortDirection(params.get('dir')) ?? defaultAppointmentDirection(status, sort)

  return { status, view, petParam, petId, day, sort, dir }
}

export function serializeAppointmentSearch(search: AppointmentSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.status !== DEFAULT_APPOINTMENT_SEARCH.status) {
    params.set('status', search.status)
  }
  if (search.view !== 'table') {
    params.set('view', search.view)
  }
  if (search.petParam !== undefined) {
    params.set('pet', search.petParam)
  }
  if (search.day !== null) {
    params.set('day', search.day)
  }
  if (search.sort !== 'when') {
    params.set('sort', search.sort)
  }
  if (search.dir !== defaultAppointmentDirection(search.status, search.sort)) {
    params.set('dir', search.dir)
  }
  return params
}

/* ------------------------------------------------------------ vaccinations */

export const VACCINATION_SORT_KEYS = ['pet', 'vaccine', 'given', 'next', 'status'] as const
export type VaccinationSortKey = (typeof VACCINATION_SORT_KEYS)[number]

export interface VaccinationSearch {
  /** `null` = every status. */
  status: VaccinationDueStatus | null
  petParam: 'all' | string | undefined
  petId: string | null
  /** The shared `vaccineKey()` value (`type:<id>` / `name:<name>`). */
  vaccineKey: string | null
  sort: VaccinationSortKey
  dir: SortDirection
}

export const DEFAULT_VACCINATION_SEARCH: VaccinationSearch = Object.freeze({
  status: null,
  petParam: undefined,
  petId: null,
  vaccineKey: null,
  sort: 'given',
  dir: 'desc',
})

export function isVaccinationDueStatus(value: string | null): value is VaccinationDueStatus {
  return value !== null && (VACCINATION_DUE_STATUSES as readonly string[]).includes(value)
}

export function isVaccinationSortKey(value: string | null): value is VaccinationSortKey {
  return value !== null && (VACCINATION_SORT_KEYS as readonly string[]).includes(value)
}

export function defaultVaccinationDirection(sort: VaccinationSortKey): SortDirection {
  // Most recent dose / soonest due date first; status and names read A→Z where
  // "A" for status is the most urgent one.
  return sort === 'given' || sort === 'next' ? 'desc' : 'asc'
}

export function parseVaccinationSearch(params: URLSearchParams): VaccinationSearch {
  const status = isVaccinationDueStatus(params.get('status'))
    ? (params.get('status') as VaccinationDueStatus)
    : null
  const rawPet = params.get('pet')?.trim() ?? ''
  const petParam = rawPet === '' ? undefined : rawPet === PET_FILTER_ALL ? PET_FILTER_ALL : rawPet
  const petId = petParam === undefined || petParam === PET_FILTER_ALL ? null : petParam
  const rawVaccine = params.get('vaccine')?.trim() ?? ''
  const vaccineKey = rawVaccine === '' || rawVaccine === PET_FILTER_ALL ? null : rawVaccine
  const sort = isVaccinationSortKey(params.get('sort'))
    ? (params.get('sort') as VaccinationSortKey)
    : 'given'
  const dir = parseSortDirection(params.get('dir')) ?? defaultVaccinationDirection(sort)

  return { status, petParam, petId, vaccineKey, sort, dir }
}

export function serializeVaccinationSearch(search: VaccinationSearch): URLSearchParams {
  const params = new URLSearchParams()
  if (search.status !== null) {
    params.set('status', search.status)
  }
  if (search.petParam !== undefined) {
    params.set('pet', search.petParam)
  }
  if (search.vaccineKey !== null) {
    params.set('vaccine', search.vaccineKey)
  }
  if (search.sort !== 'given') {
    params.set('sort', search.sort)
  }
  if (search.dir !== defaultVaccinationDirection(search.sort)) {
    params.set('dir', search.dir)
  }
  return params
}
