/**
 * R10 — the filtered hand-off keeps "no request" apart from "no filter".
 *
 * Home → Appointments carries `{ petId: string | null }`, where `null` means
 * "open unfiltered even if a filter was set earlier". In the URL that is
 * `?pet=all`; no parameter at all means "no request" (keep whatever the route
 * already had). Bookmarkable and reload-safe (F6).
 */

export const PET_FILTER_ALL = 'all'

export interface PetFilterHandoff {
  petId: string | null
}

/** Serialises a hand-off request to the `?pet=` value. */
export function petFilterSearchValue(petId: string | null | undefined): string | undefined {
  if (petId === undefined) {
    return undefined
  }
  if (petId === null) {
    return PET_FILTER_ALL
  }
  const trimmed = petId.trim()
  if (trimmed === '' || trimmed === PET_FILTER_ALL) {
    // An empty id is not a filter; "all" is reserved for the explicit sentinel.
    return undefined
  }
  return trimmed
}

/**
 * Parses `?pet=`: `undefined` = no request (leave the current filter alone),
 * `null` = explicitly unfiltered, string = that pet.
 */
export function petFilterFromSearchValue(
  value: string | null | undefined,
): string | null | undefined {
  if (value == null) {
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed === '') {
    return undefined
  }
  if (trimmed === PET_FILTER_ALL) {
    return null
  }
  return trimmed
}

/** Round-trips a hand-off through the URL representation. */
export function normalizePetFilterHandoff(handoff: PetFilterHandoff): { petId: string | null } {
  const searchValue = petFilterSearchValue(handoff.petId)
  const parsed = petFilterFromSearchValue(searchValue)
  // An undefined search value can only come from an empty id, which is "no
  // request"; the caller then keeps the current filter rather than clearing it.
  return { petId: parsed === undefined ? handoff.petId : parsed }
}
