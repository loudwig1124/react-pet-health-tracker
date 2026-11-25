/**
 * A polite, self-clearing announcement for successful writes (03 §5).
 *
 * Both M3 screens report "Visit booked", "Dose saved" and similar without a
 * toast dependency in the shell (sonner is deferred: the eager budget is 200 kB).
 * The message renders in a `role="status"` live region, so a screen reader hears
 * it and the tests can assert it.
 */
import { useEffect, useState } from 'react'

export function useAnnouncement(timeoutMs = 5000): {
  message: string | null
  announce: (message: string) => void
} {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (message === null) {
      return
    }
    const timer = window.setTimeout(() => setMessage(null), timeoutMs)
    return () => window.clearTimeout(timer)
  }, [message, timeoutMs])

  return { message, announce: setMessage }
}
