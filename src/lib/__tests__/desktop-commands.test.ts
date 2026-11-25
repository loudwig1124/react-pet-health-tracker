import { describe, expect, it } from 'vitest'

import { CREATE_COMMANDS, createIntentForPath, createPathForPet } from '@/lib/desktop/commands'
import { SHORTCUT_GROUPS, shortcutRows } from '@/lib/desktop/shortcuts'
import { APP_DESTINATIONS, matchShellShortcut } from '@/lib/shell'

describe('⌘N create intents (03 §2, 05 F4)', () => {
  it('registers exactly the five create commands with their ?new=1 routes', () => {
    expect(CREATE_COMMANDS.map((command) => command.key)).toEqual([
      'pet',
      'visit',
      'vaccination',
      'record',
      'journal',
    ])
    for (const command of CREATE_COMMANDS) {
      expect(command.path).toMatch(/\?new=1$/)
    }
  })

  it('maps each list screen to its own create dialog', () => {
    expect(createIntentForPath('/pets')).toEqual({ kind: 'navigate', to: '/pets?new=1' })
    expect(createIntentForPath('/appointments')).toEqual({
      kind: 'navigate',
      to: '/appointments?new=1',
    })
    expect(createIntentForPath('/vaccinations/')).toEqual({
      kind: 'navigate',
      to: '/vaccinations?new=1',
    })
    expect(createIntentForPath('/records')).toEqual({ kind: 'navigate', to: '/records?new=1' })
    expect(createIntentForPath('/journal')).toEqual({ kind: 'navigate', to: '/journal?new=1' })
  })

  it('opens the create section of the palette on the dashboard and unknown screens', () => {
    expect(createIntentForPath('/')).toEqual({ kind: 'palette-create' })
    expect(createIntentForPath('/somewhere-else')).toEqual({ kind: 'palette-create' })
  })

  it('maps a pet detail tab to the top-level form, scoped to that pet', () => {
    const bella = 'pet-bella'
    expect(createIntentForPath(`/pets/${bella}`)).toEqual({
      kind: 'navigate',
      to: `/records?new=1&pet=${bella}`,
    })
    expect(createIntentForPath(`/pets/${bella}/health`)).toEqual({
      kind: 'navigate',
      to: `/records?new=1&pet=${bella}`,
    })
    expect(createIntentForPath(`/pets/${bella}/vaccinations`)).toEqual({
      kind: 'navigate',
      to: `/vaccinations?new=1&pet=${bella}`,
    })
    expect(createIntentForPath(`/pets/${bella}/appointments`)).toEqual({
      kind: 'navigate',
      to: `/appointments?new=1&pet=${bella}`,
    })
    expect(createIntentForPath(`/pets/${bella}/journal`)).toEqual({
      kind: 'navigate',
      to: `/journal?new=1&pet=${bella}`,
    })
  })

  it('encodes pet ids in the scope parameter', () => {
    const command = CREATE_COMMANDS[3]
    if (command === undefined) {
      throw new Error('record command missing')
    }
    expect(createPathForPet(command, 'pet with space')).toBe(
      '/records?new=1&pet=pet%20with%20space',
    )
  })
})

describe('shortcut registry and the ? sheet (05 F4/F8)', () => {
  it('documents every destination plus the global actions', () => {
    const rows = shortcutRows()
    for (const destination of APP_DESTINATIONS) {
      const row = rows.find((candidate) => candidate.label === destination.label)
      expect(row, `missing shortcut row for ${destination.label}`).toBeDefined()
      expect(row?.keys).toEqual(['⌘', destination.shortcut])
    }
    for (const label of [
      'Search and commands',
      'Create on this screen',
      'Collapse or expand the sidebar',
      'Keyboard shortcuts',
      'Close a dialog, palette or sheet',
    ]) {
      expect(
        rows.some((row) => row.label === label),
        `missing ${label}`,
      ).toBe(true)
    }
    expect(rows.some((row) => row.label === 'Move between rows')).toBe(true)
    expect(rows.some((row) => row.label === 'Open the focused row')).toBe(true)
  })

  it('advertises the documented aliases for browser-reserved keys', () => {
    const rows = shortcutRows()
    expect(rows.find((row) => row.label === 'Pets')?.alias).toBe('or 2 outside a field')
    expect(rows.find((row) => row.label === 'Create on this screen')?.alias).toBe(
      'or N outside a field',
    )
  })

  it('matches the bindings the sheet advertises', () => {
    expect(matchShellShortcut({ key: 'n', metaKey: true })).toEqual({ type: 'create' })
    expect(matchShellShortcut({ key: 'N' })).toEqual({ type: 'create' })
    expect(matchShellShortcut({ key: '?' })).toEqual({ type: 'shortcut-sheet' })
    expect(matchShellShortcut({ key: '?', metaKey: true })).toBeNull()
    expect(
      matchShellShortcut({
        key: '?',
        target: { tagName: 'INPUT' } as unknown as EventTarget,
      }),
    ).toBeNull()
    expect(
      matchShellShortcut({
        key: 'n',
        target: { tagName: 'TEXTAREA' } as unknown as EventTarget,
      }),
    ).toBeNull()
  })

  it('keeps the ⌘1–6 and ⌘K bindings intact', () => {
    expect(matchShellShortcut({ key: '4', metaKey: true })).toEqual({
      type: 'navigate',
      path: '/vaccinations',
    })
    expect(matchShellShortcut({ key: 'k', metaKey: true })).toEqual({ type: 'command-palette' })
    expect(SHORTCUT_GROUPS.map((group) => group.id)).toEqual(['navigate', 'actions', 'tables'])
  })
})
