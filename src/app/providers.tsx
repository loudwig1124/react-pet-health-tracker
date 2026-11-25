import type { ReactNode } from 'react'

import { TooltipProvider } from '@/components/ui/tooltip'

/**
 * App-level providers. Only the TooltipProvider is eager: settings/query
 * providers are deliberately absent because Dexie live queries are the data
 * layer (01 D5). Tooltips open after 400 ms, matching the sidebar rail spec
 * (03 §4).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={400} skipDelayDuration={250}>
      {children}
    </TooltipProvider>
  )
}
