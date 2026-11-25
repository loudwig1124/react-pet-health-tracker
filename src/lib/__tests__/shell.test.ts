import { describe, expect, it } from 'vitest'

import {
  APP_DESTINATIONS,
  EXPANDED_FROM,
  FORCED_RAIL_BELOW,
  PROFILE_PATH,
  isForcedRail,
  parseSidebarPreference,
  resolveSidebarMode,
  routeHandleFrom,
} from '@/lib/shell'

describe('navigation contract (03 §2 revised)', () => {
  it('has exactly the six approved destinations in sidebar order', () => {
    expect(APP_DESTINATIONS.map((item) => item.label)).toEqual([
      'Dashboard',
      'Pets',
      'Appointments',
      'Vaccinations',
      'Health records',
      'Journal',
    ])
    expect(APP_DESTINATIONS.map((item) => item.path)).toEqual([
      '/',
      '/pets',
      '/appointments',
      '/vaccinations',
      '/records',
      '/journal',
    ])
    // The shell carries no shortcut metadata: the app has no keyboard shortcuts.
    expect(APP_DESTINATIONS.every((item) => !('shortcut' in item))).toBe(true)
  })

  it('pins Profile to the footer and never exposes /settings', () => {
    const destinations: readonly { path: string }[] = APP_DESTINATIONS
    expect(destinations.some((item) => item.path === PROFILE_PATH)).toBe(false)
    expect(destinations.some((item) => item.path === '/settings')).toBe(false)
    expect(PROFILE_PATH).toBe('/profile')
  })
})

describe('sidebar collapse rule (03 §1)', () => {
  it('is expanded at 1440 and rail at 1024', () => {
    expect(resolveSidebarMode(1440, 'auto')).toBe('expanded')
    expect(resolveSidebarMode(1024, 'auto')).toBe('rail')
  })

  it('forces the rail below 1024 even when temporarily expanded', () => {
    expect(FORCED_RAIL_BELOW).toBe(1024)
    expect(isForcedRail(900)).toBe(true)
    expect(resolveSidebarMode(900, 'auto', true)).toBe('rail')
    expect(resolveSidebarMode(1023, 'rail', true)).toBe('rail')
  })

  it('expands on demand between 1024 and 1279 without persisting it', () => {
    expect(EXPANDED_FROM).toBe(1280)
    expect(resolveSidebarMode(1200, 'auto', false)).toBe('rail')
    expect(resolveSidebarMode(1200, 'auto', true)).toBe('expanded')
  })

  it('honours the persisted collapse preference at ≥1280 only', () => {
    expect(resolveSidebarMode(1440, 'rail')).toBe('rail')
    expect(resolveSidebarMode(1440, 'auto')).toBe('expanded')
  })

  it('parses only the two known stored preferences', () => {
    expect(parseSidebarPreference('rail')).toBe('rail')
    expect(parseSidebarPreference('auto')).toBe('auto')
    expect(parseSidebarPreference(null)).toBe('auto')
    expect(parseSidebarPreference('garbage')).toBe('auto')
  })
})

describe('route handles', () => {
  it('reads the deepest handle and defaults safely', () => {
    const handle = { title: 'Pets', description: 'All pets' }
    expect(routeHandleFrom([{ handle: { title: 'Root' } }, { handle }, {}])).toEqual(handle)
    expect(routeHandleFrom([{}])).toBeNull()
    expect(routeHandleFrom(undefined)).toBeNull()
  })
})
