/**
 * The vaccine catalog — always seeded at boot (M1 gate), never removed by the
 * sample-data toggle or a household reset (02 §1, Flutter parity).
 *
 * The data and the seed live in `catalog-data.ts` since the M5 performance pass:
 * the root loader seeds before first paint, so importing the zod schema mirrors
 * here would put the whole schema graph in the eager first-load chunk. This
 * module stays the public import point so every existing caller/test is
 * unchanged; rows are a fixed literal set and are type-checked, not user input.
 */
export { seedVaccineCatalog, VACCINE_TYPE_IDS, VACCINE_TYPE_SEEDS } from './catalog-data'
