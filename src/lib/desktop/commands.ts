/**
 * Create-command registry for the command palette.
 *
 * Every create command is one URL: the destination route reads `?new=1` once,
 * opens its dialog and replaces the parameter, so a Back or reload never
 * re-opens the form. The palette runs these exact commands, which is what keeps
 * "every create command" in one place.
 */

export type CreateCommandKey = 'pet' | 'visit' | 'vaccination' | 'record' | 'journal'

export interface CreateCommand {
  key: CreateCommandKey
  label: string
  description: string
  /** Route + `?new=1`; the screen's own primary button opens the same form. */
  path: string
}

export const CREATE_COMMANDS: readonly CreateCommand[] = [
  {
    key: 'pet',
    label: 'Add pet',
    description: 'Create a profile for a new pet',
    path: '/pets?new=1',
  },
  {
    key: 'visit',
    label: 'Book visit',
    description: 'Schedule a veterinary appointment',
    path: '/appointments?new=1',
  },
  {
    key: 'vaccination',
    label: 'Add vaccination',
    description: 'Record a dose and its next-due date',
    path: '/vaccinations?new=1',
  },
  {
    key: 'record',
    label: 'Add record',
    description: 'Append a clinical note to the history',
    path: '/records?new=1',
  },
  {
    key: 'journal',
    label: 'Log entry',
    description: 'Log a walk, meal, medication or note',
    path: '/journal?new=1',
  },
]

export function createCommand(key: CreateCommandKey): CreateCommand {
  const command = CREATE_COMMANDS.find((candidate) => candidate.key === key)
  if (command === undefined) {
    throw new Error(`Unknown create command: ${key}`)
  }
  return command
}
