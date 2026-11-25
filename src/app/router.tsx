import { createBrowserRouter, type RouteObject } from 'react-router'

import { AppShell } from '@/components/layout/AppShell'
import { bootDatabase } from '@/lib/db/boot'
import type { RouteHandle } from '@/lib/shell'

import { StorageErrorBoundary } from './error-boundary'
import { loadFirstRunSnapshot } from './first-run-state'
import { HydrateFallback } from './hydrate-fallback'

/**
 * Route tree (03 §2, D2): a pathless shell layout keeps AppShell mounted while
 * every destination is a lazy child, so table/calendar/palette/motion code can
 * never land in the initial chunk (D8). The root loader is the DB prerequisite
 * gate only — data reads stay in Dexie live queries (D2 risk).
 */
const dashboardHandle: RouteHandle = {
  title: 'Dashboard',
  description: 'What needs attention today, the household at a glance, and the latest entries.',
  maxWidth: 1200,
}

const petsHandle: RouteHandle = {
  title: 'Pets',
  description: 'Every pet in the household, sortable and filterable.',
  maxWidth: 1440,
}

const petDetailHandle: RouteHandle = {
  title: 'Pet',
  description: 'Vaccinations, clinical records, visits and journal entries for one pet.',
  maxWidth: 1440,
}

const appointmentsHandle: RouteHandle = {
  title: 'Appointments',
  description: 'Upcoming and past vet visits, as a table or a month calendar.',
  maxWidth: 1440,
}

const vaccinationsHandle: RouteHandle = {
  title: 'Vaccinations',
  description: 'Every dose on record, with its due status.',
  maxWidth: 1440,
}

const recordsHandle: RouteHandle = {
  title: 'Health records',
  description: 'Append-only clinical notes for the household, newest first.',
  maxWidth: 1440,
}

const journalHandle: RouteHandle = {
  title: 'Journal',
  description: 'The household log, grouped by day.',
  maxWidth: 1200,
}

const profileHandle: RouteHandle = {
  title: 'Profile',
  description: 'Owner, pets, preferences and household data.',
  maxWidth: 1200,
}

const notFoundHandle: RouteHandle = {
  title: 'Page not found',
  description: 'That address is not part of the household notebook.',
  maxWidth: 1200,
}

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    Component: AppShell,
    HydrateFallback,
    ErrorBoundary: StorageErrorBoundary,
    loader: async () => {
      await bootDatabase()
      // First paint needs the first-run facts before the shell can decide
      // between the takeover mode and the navigation frame (03 §5).
      return await loadFirstRunSnapshot()
    },
    children: [
      {
        index: true,
        handle: dashboardHandle,
        lazy: () => import('@/routes/dashboard/route'),
      },
      {
        path: 'pets',
        handle: petsHandle,
        lazy: () => import('@/routes/pets/route'),
      },
      {
        path: 'pets/:petId/:tab?',
        handle: petDetailHandle,
        lazy: () => import('@/routes/pets.$petId/route'),
      },
      {
        path: 'appointments',
        handle: appointmentsHandle,
        lazy: () => import('@/routes/appointments/route'),
      },
      {
        path: 'vaccinations',
        handle: vaccinationsHandle,
        lazy: () => import('@/routes/vaccinations/route'),
      },
      {
        path: 'records',
        handle: recordsHandle,
        lazy: () => import('@/routes/records/route'),
      },
      {
        path: 'journal',
        handle: journalHandle,
        lazy: () => import('@/routes/journal/route'),
      },
      {
        path: 'profile',
        handle: profileHandle,
        lazy: () => import('@/routes/profile/route'),
      },
      {
        // `/settings` intentionally falls through here: Settings lives in Profile.
        path: '*',
        handle: notFoundHandle,
        lazy: () => import('@/routes/not-found'),
      },
    ],
  },
]

/** Browser router for the app; tests build a memory router from `appRoutes`. */
// BASE_URL is '/' for local runs and '/<repo>/' on GitHub Pages; the router must
// share it or every deep link 404s when the app is served from a sub-path.
export const router = createBrowserRouter(appRoutes, {
  basename: import.meta.env.BASE_URL,
})
