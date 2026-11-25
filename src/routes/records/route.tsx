/**
 * `/records` — the read-only, append-only household list (03 §2, 06 M2). The
 * page lives in `./page` and stays inside this lazy chunk, so no table or dialog
 * code reaches the eager shell (D8).
 */
export { RecordsPage as Component } from './page'
