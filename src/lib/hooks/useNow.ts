/**
 * A ticking wall clock for UI gates that depend on the current instant.
 *
 * The rules and repositories take `now` as a parameter and the write path reads
 * its own clock once per action; this hook only decides what a disabled button
 * may show. The actions dialog ticks once a second so "Mark no-show" becomes
 * available at the scheduled instant without a reload (R3 / 06 M3).
 */
import { useEffect, useState } from 'react'

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const tick = (): void => setNow(new Date())
    const timer = window.setInterval(tick, intervalMs)
    const onFocus = (): void => tick()
    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') {
        tick()
      }
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs])

  return now
}
