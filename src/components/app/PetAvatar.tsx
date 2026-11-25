/**
 * The one pet placeholder for v1 (02 §0): no photos, so every surface renders a
 * species-aware glyph plus the pet's initial on a deterministic soft tint.
 * Deterministic means the same pet always gets the same tint — a species
 * mapping first, then a stable hash for legacy species outside the list.
 */
import { Bird, Cat, Fish, PawPrint, Rabbit, Squirrel, Turtle } from 'lucide-react'

import { cn } from '@/lib/utils'

export type PetAvatarSize = 'sm' | 'md' | 'lg'

export interface PetAvatarPet {
  name: string
  species: string
}

/** Four approved soft tokens, never a random hue (04 §4). */
const TINTS = [
  'bg-accent-soft text-primary',
  'bg-status-due-soon-soft text-status-due-soon',
  'bg-status-up-to-date-soft text-status-up-to-date',
  'bg-secondary text-foreground',
] as const

const SIZES: Record<PetAvatarSize, { box: string; icon: string; initial: string }> = {
  sm: { box: 'size-8', icon: 'size-4', initial: 'text-caption' },
  md: { box: 'size-9', icon: 'size-5', initial: 'text-small' },
  lg: { box: 'size-12', icon: 'size-6', initial: 'text-heading' },
}

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) >>> 0
  }
  return result
}

function tintFor(pet: PetAvatarPet): string {
  const species = pet.species.trim().toLowerCase()
  if (species === 'dog' || species === 'ferret') {
    return TINTS[0]
  }
  if (species === 'cat') {
    return TINTS[1]
  }
  if (species === 'bird' || species === 'fish' || species === 'turtle') {
    return TINTS[2]
  }
  return TINTS[hash(`${species}:${pet.name}`) % TINTS.length] ?? TINTS[3]
}

function initialFor(name: string): string {
  const first = name.trim().charAt(0)
  return first === '' ? '?' : first.toUpperCase()
}

/** Static per-case JSX keeps every glyph a stable module component. */
function SpeciesGlyph({ species, className }: { species: string; className: string }) {
  const glyphProps = { 'aria-hidden': true, className } as const
  switch (species.trim().toLowerCase()) {
    case 'cat':
      return <Cat {...glyphProps} />
    case 'rabbit':
      return <Rabbit {...glyphProps} />
    case 'hamster':
    case 'guinea pig':
      return <Squirrel {...glyphProps} />
    case 'bird':
      return <Bird {...glyphProps} />
    case 'turtle':
      return <Turtle {...glyphProps} />
    case 'fish':
      return <Fish {...glyphProps} />
    default:
      return <PawPrint {...glyphProps} />
  }
}

export interface PetAvatarProps {
  pet: PetAvatarPet
  size?: PetAvatarSize
  className?: string
}

export function PetAvatar({ pet, size = 'sm', className }: PetAvatarProps) {
  const sizing = SIZES[size]
  return (
    <span
      data-testid="pet-avatar"
      data-size={size}
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        sizing.box,
        tintFor(pet),
        className,
      )}
    >
      <SpeciesGlyph species={pet.species} className={cn('absolute opacity-30', sizing.icon)} />
      <span className={cn('relative font-semibold tabular-nums', sizing.initial)}>
        {initialFor(pet.name)}
      </span>
    </span>
  )
}
