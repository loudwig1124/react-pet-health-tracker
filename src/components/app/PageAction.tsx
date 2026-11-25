/**
 * Mounts a screen's contextual primary action into the sticky header.
 *
 * The M1 shell reserved `[data-testid="header-actions"]` for exactly this
 * (03 §1), but the header is a sibling of the route content, not a parent — so
 * the action is portalled into the reserved slot. The header node is external
 * state (it is not in the DOM during the route's first render), so it is read
 * through `useSyncExternalStore`: React re-checks the snapshot after subscribing,
 * which is exactly when the shell header has committed. Until the slot exists
 * nothing renders, and the screen's own content still offers the same action.
 */
import { useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const HEADER_ACTIONS_SELECTOR = '[data-testid="header-actions"]'

function getSnapshot(): HTMLElement | null {
  return document.querySelector<HTMLElement>(HEADER_ACTIONS_SELECTOR)
}

function getServerSnapshot(): HTMLElement | null {
  return null
}

/** A single post-mount nudge; the header commits with the route's first paint. */
function subscribe(onStoreChange: () => void): () => void {
  const timer = window.setTimeout(onStoreChange, 0)
  return () => window.clearTimeout(timer)
}

export function PageAction({ children }: { children: ReactNode }) {
  const target = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  if (target === null) {
    return null
  }
  return createPortal(children, target)
}
