/**
 * Magic UI · Number Ticker (vendored, 04 §3 / 06 M5).
 *
 * Four compact counters only (05 F1): the ticker is the one moving number in the
 * product, and it is deliberately the smallest usable implementation — a
 * requestAnimationFrame count-up with no animation library, no transform and no
 * layout animation. It honours `prefers-reduced-motion: reduce` by rendering the
 * final value immediately (03 §4), and it exposes the final value as
 * `data-value`/`aria-label` so the value is never motion-only.
 *
 * The component lives in the dashboard's lazy island chunk, never the shell.
 */
import { useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

export interface NumberTickerProps {
  value: number
  durationMs?: number
  className?: string
  testId?: string
  /** Accessible suffix, e.g. "pets". The visible label sits beside the number. */
  label?: string
}

function prefersReducedMotion(): boolean {
  try {
    return typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  } catch {
    return false
  }
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3
}

export function NumberTicker({
  value,
  durationMs = 600,
  className,
  testId,
  label,
}: NumberTickerProps) {
  const [display, setDisplay] = useState(() => (prefersReducedMotion() ? value : 0))
  const fromRef = useRef(value)
  const frameRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = value

    if (prefersReducedMotion() || durationMs <= 0 || from === value) {
      setDisplay(value)
      return
    }

    const start = performance.now()
    const step = (now: number): void => {
      const progress = Math.min(1, (now - start) / durationMs)
      setDisplay(Math.round(from + (value - from) * easeOutCubic(progress)))
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }
    frameRef.current = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameRef.current)
  }, [value, durationMs])

  return (
    <span
      data-testid={testId}
      data-value={value}
      aria-label={label === undefined ? String(value) : `${value} ${label}`}
      className={cn('tabular-nums', className)}
    >
      {display}
    </span>
  )
}
