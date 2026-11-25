/**
 * F4 create command registry and the ⌘N resolution rule.
 *
 * 03 §2: "⌘N = create (preselects the pet on a pet route)". Rather than each
 * screen inventing its own handler, every create command is one URL — the route
 * reads `?new=1` once and opens its dialog (and drops the parameter, so a Back
 * never re-opens it). The palette runs the exact same commands, which is what
 * keeps "every create command" in one place.
 */

export type CreateCommandKey = 'pet' | 'visit' | 'vaccination' | 'record' | 'journal'

export interface CreateCommand {
  key: CreateCommandKey
  label: string
  description: string
  /** Route + `?new=1`; `&pet=` is appended when a screen is scoped to a pet. */
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

const PET_DETAIL_PATTERN = /^\/pets\/([^/]+)(?:\/([^/]+))?\/?$/

/** Appends a pet scope to a create path, e.g. `/records?new=1&pet=abc`. */
export function createPathForPet(command: CreateCommand, petId: string): string {
  return `${command.path}&pet=${encodeURIComponent(petId)}`
}

export type CreateIntent = { kind: 'navigate'; to: string } | { kind: 'palette-create' }

/**
 * What ⌘N means on the current screen:
 * - a list screen creates its own entity;
 * - a pet detail creates the entity of its tab, scoped to that pet (the top-level
 *   dialog handles it so there is one implementation per form);
 * - the dashboard/profile open the palette focused on the create commands
 *   (03's "New ▾" without a second menu component in the eager shell).
 */
export function createIntentForPath(pathname: string): CreateIntent {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname

  if (path === '/') {
    return { kind: 'palette-create' }
  }
  switch (path) {
    case '/pets':
      return { kind: 'navigate', to: createCommand('pet').path }
    case '/appointments':
      return { kind: 'navigate', to: createCommand('visit').path }
    case '/vaccinations':
      return { kind: 'navigate', to: createCommand('vaccination').path }
    case '/records':
      return { kind: 'navigate', to: createCommand('record').path }
    case '/journal':
      return { kind: 'navigate', to: createCommand('journal').path }
    case '/profile':
      return { kind: 'navigate', to: createCommand('pet').path }
    default:
      break
  }

  const detail = PET_DETAIL_PATTERN.exec(path)
  const rawPetId = detail?.[1]
  if (detail !== null && rawPetId !== undefined) {
    const petId = decodeURIComponent(rawPetId)
    const tab = detail[2] ?? 'health'
    const command =
      tab === 'vaccinations'
        ? createCommand('vaccination')
        : tab === 'appointments'
          ? createCommand('visit')
          : tab === 'journal'
            ? createCommand('journal')
            : createCommand('record')
    return { kind: 'navigate', to: createPathForPet(command, petId) }
  }

  return { kind: 'palette-create' }
}
