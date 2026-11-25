import { describe, expect, it } from 'vitest'

import {
  DEFAULT_APPOINTMENT_SEARCH,
  DEFAULT_VACCINATION_SEARCH,
  defaultAppointmentDirection,
  defaultVaccinationDirection,
  nextSortChange,
  parseAppointmentSearch,
  parseVaccinationSearch,
  serializeAppointmentSearch,
  serializeVaccinationSearch,
} from './query'

const params = (search: string): URLSearchParams => new URLSearchParams(search)

describe('appointments URL state (F6)', () => {
  it('defaults to the upcoming table with no pet request and no day', () => {
    expect(parseAppointmentSearch(params(''))).toEqual(DEFAULT_APPOINTMENT_SEARCH)
    expect(serializeAppointmentSearch(DEFAULT_APPOINTMENT_SEARCH).toString()).toBe('')
  })

  it('reads ?pet=all as an explicit "every pet" request, not a missing filter', () => {
    const all = parseAppointmentSearch(params('?pet=all'))
    expect(all.petParam).toBe('all')
    expect(all.petId).toBeNull()
    expect(serializeAppointmentSearch(all).get('pet')).toBe('all')

    const one = parseAppointmentSearch(params('?pet=demo-pet-bella'))
    expect(one.petParam).toBe('demo-pet-bella')
    expect(one.petId).toBe('demo-pet-bella')
    expect(serializeAppointmentSearch(one).get('pet')).toBe('demo-pet-bella')
  })

  it('round-trips status, view, pet, day, sort and direction through the URL', () => {
    const first = parseAppointmentSearch(
      params('status=past&view=calendar&pet=demo-pet-bella&day=2026-11-26&sort=pet&dir=desc'),
    )
    expect(first).toMatchObject({
      status: 'past',
      view: 'calendar',
      petId: 'demo-pet-bella',
      day: '2026-11-26',
      sort: 'pet',
      dir: 'desc',
    })
    const second = parseAppointmentSearch(serializeAppointmentSearch(first))
    expect(second).toEqual(first)
    expect(serializeAppointmentSearch(second).toString()).toBe(
      'status=past&view=calendar&pet=demo-pet-bella&day=2026-11-26&sort=pet&dir=desc',
    )
  })

  it('ignores invalid values instead of throwing, keeping the screen usable', () => {
    const parsed = parseAppointmentSearch(
      params('status=tomorrow&view=grid&day=2026-02-30&sort=mood&dir=sideways'),
    )
    expect(parsed).toEqual(DEFAULT_APPOINTMENT_SEARCH)
  })

  it('defaults the when direction per segment: upcoming soonest-first, past newest-first', () => {
    expect(defaultAppointmentDirection('upcoming', 'when')).toBe('asc')
    expect(defaultAppointmentDirection('past', 'when')).toBe('desc')
    expect(parseAppointmentSearch(params('status=past')).dir).toBe('desc')
    expect(parseAppointmentSearch(params('status=upcoming')).dir).toBe('asc')
  })

  it('flips direction when the active column is clicked and keeps a segment default otherwise', () => {
    expect(nextSortChange('when', 'asc', 'when', 'asc')).toEqual({ sort: 'when', dir: 'desc' })
    expect(nextSortChange('when', 'desc', 'pet', 'asc')).toEqual({ sort: 'pet', dir: 'asc' })
  })
})

describe('vaccinations URL state (F6)', () => {
  it('defaults to every status/pet/vaccine, newest dose first', () => {
    expect(parseVaccinationSearch(params(''))).toEqual(DEFAULT_VACCINATION_SEARCH)
    expect(serializeVaccinationSearch(DEFAULT_VACCINATION_SEARCH).toString()).toBe('')
  })

  it('reads the overdue drill-down URL used by the dashboard/sidebar', () => {
    const parsed = parseVaccinationSearch(params('?status=overdue'))
    expect(parsed.status).toBe('overdue')
  })

  it('round-trips status, pet, vaccine and sort (the reload/bookmark contract)', () => {
    const first = parseVaccinationSearch(
      params('status=due_soon&pet=all&vaccine=type%3Avaccine-rabies&sort=next'),
    )
    expect(first).toMatchObject({
      status: 'due_soon',
      petParam: 'all',
      petId: null,
      vaccineKey: 'type:vaccine-rabies',
      sort: 'next',
      dir: 'desc',
    })
    const second = parseVaccinationSearch(serializeVaccinationSearch(first))
    expect(second).toEqual(first)
  })

  it('drops unknown status/sort and empty pet/vaccine values', () => {
    const parsed = parseVaccinationSearch(params('status=late&sort=name&pet=&vaccine='))
    expect(parsed).toEqual(DEFAULT_VACCINATION_SEARCH)
  })

  it('gives each sort column a sensible natural direction', () => {
    expect(defaultVaccinationDirection('given')).toBe('desc')
    expect(defaultVaccinationDirection('next')).toBe('desc')
    expect(defaultVaccinationDirection('status')).toBe('asc')
    expect(defaultVaccinationDirection('pet')).toBe('asc')
  })
})
