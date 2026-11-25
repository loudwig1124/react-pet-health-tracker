/**
 * `/pets/:petId/:tab?` — the deep-linkable pet page (03 §2–§3). The M1 shell
 * test still finds `pet-detail-route` + `data-pet-id`/`data-pet-tab` on the real
 * page, so the route contract is unchanged while the screen is now real.
 */
export { PetDetailPage as Component } from './page'
