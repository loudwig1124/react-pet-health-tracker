'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils'

export interface DotPatternProps extends React.ComponentProps<'svg'> {
  width?: number
  height?: number
  x?: number
  y?: number
  cx?: number
  cy?: number
  cr?: number
}

/**
 * Magic UI's **Dot Pattern** (04 §3), vendored as a static SVG: the welcome
 * panel and empty-state backdrop. No animation loop, no runtime, zero bundle
 * cost beyond the markup — the paper texture 04 asks for.
 */
export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  ...props
}: DotPatternProps) {
  const patternId = useId()

  return (
    <svg
      aria-hidden="true"
      data-slot="dot-pattern"
      className={cn(
        'pointer-events-none absolute inset-0 h-full w-full fill-current text-muted-foreground/25',
        className,
      )}
      {...props}
    >
      <defs>
        <pattern
          id={patternId}
          width={width}
          height={height}
          patternUnits="userSpaceOnUse"
          x={x}
          y={y}
        >
          <circle cx={cx} cy={cy} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}
