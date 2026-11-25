import { describe, expect, it } from 'vitest'

import { CREATE_COMMANDS, createCommand } from '@/lib/desktop/commands'

describe('palette create commands', () => {
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
      expect(command.label.trim()).not.toBe('')
      expect(command.description.trim()).not.toBe('')
    }
  })

  it('resolves every command by key and never invents one', () => {
    for (const command of CREATE_COMMANDS) {
      expect(createCommand(command.key)).toBe(command)
    }
    expect(() => createCommand('settings' as never)).toThrow(/Unknown create command/)
  })

  it('keeps the paths unique so the palette can run each command once', () => {
    expect(new Set(CREATE_COMMANDS.map((command) => command.path)).size).toBe(
      CREATE_COMMANDS.length,
    )
  })
})
