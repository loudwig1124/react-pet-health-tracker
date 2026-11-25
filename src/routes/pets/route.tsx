/**
 * `/pets` — the sortable household table (03 §3, 06 M2). The lazy boundary is
 * this module, so the table, dialogs and TanStack code stay out of the eager
 * shell (D8); the page itself lives in `./page`.
 */
export { PetsPage as Component } from './page'
