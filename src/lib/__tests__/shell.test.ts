import { describe, expect, it } from 'vitest'

import {
  APP_DESTINATIONS,
  EXPANDED_FROM,
  FORCED_RAIL_BELOW,
  PROFILE_PATH,
  isForcedRail,
  matchShellShortcut,
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
    expect(APP_DESTINATIONS.map((item) => item.shortcut)).toEqual(['1', '2', '3', '4', '5', '6'])
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

describe('keyboard shortcuts (F4 shell layer)', () => {
  it('⌘1–6 navigate to the six destinations', () => {
    for (const [index, item] of APP_DESTINATIONS.entries()) {
      const event = { key: String(index + 1), metaKey: true } as const
      expect(matchShellShortcut(event)).toEqual({ type: 'navigate', path: item.path })
      // Browsers may reserve ⌘1–9; plain digits outside fields are the fallback.
      expect(matchShellShortcut({ key: String(index + 1) })).toEqual({
        type: 'navigate',
        path: item.path,
      })
    }
  })

  it('⌘B toggles the rail, ⌘, opens Profile and ⌘K is reserved for the palette', () => {
    expect(matchShellShortcut({ key: 'b', metaKey: true })).toEqual({ type: 'toggle-sidebar' })
    expect(matchShellShortcut({ key: 'B', ctrlKey: true })).toEqual({ type: 'toggle-sidebar' })
    expect(matchShellShortcut({ key: ',', metaKey: true })).toEqual({
      type: 'navigate',
      path: '/profile',
    })
    expect(matchShellShortcut({ key: 'k', metaKey: true })).toEqual({
      type: 'command-palette',
    })
  })

  it('never fires inside text fields and ignores unsupported combinations', () => {
    const input = { tagName: 'INPUT' }
    expect(matchShellShortcut({ key: '1', target: input as unknown as EventTarget })).toBeNull()
    expect(
      matchShellShortcut({ key: '2', metaKey: true, target: input as unknown as EventTarget }),
    ).toBeNull()
    expect(matchShellShortcut({ key: '7', metaKey: true })).toBeNull()
    expect(matchShellShortcut({ key: 'x', metaKey: true })).toBeNull()
    expect(matchShellShortcut({ key: 'b', metaKey: true, altKey: true })).toBeNull()
  })
})

describe('route handles', () => {
  it('reads the deepest handle and defaults safely', () => {
    const handle = { title: 'Pets', description: 'All pets', maxWidth: 1440 as const }
    expect(routeHandleFrom([{ handle: { title: 'Root' } }, { handle }, {}])).toEqual(handle)
    expect(routeHandleFrom([{}])).toBeNull()
    expect(routeHandleFrom(undefined)).toBeNull()
  })
})
