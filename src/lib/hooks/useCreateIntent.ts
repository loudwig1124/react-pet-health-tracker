import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router'

/**
 * Create-command plumbing: `?new=1` opens a screen's create dialog once.
 *
 * The command palette's create commands navigate to `?new=1`, so every screen
 * has exactly one way to express "open the form", and it is deep-linkable. The
 * parameter is removed with a replace as soon as it is consumed, so Back/reload
 * never re-opens a dialog the user closed.
 */
export function useCreateIntent(open: () => void, enabled: boolean): void {
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('new') === '1'
  const openRef = useRef(open)

  // Update the callback in an effect, never by touching the ref during render
  // (React Compiler's refs rule); this effect is declared first so the intent
  // effect below always calls the latest callback.
  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    if (!requested || !enabled) {
      return
    }
    const next = new URLSearchParams(searchParams)
    next.delete('new')
    setSearchParams(next, { replace: true })
    openRef.current()
  }, [enabled, requested, searchParams, setSearchParams])
}
