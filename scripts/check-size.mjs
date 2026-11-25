#!/usr/bin/env node
/**
 * Dependency-free gzip size gate (01 D8, 06 M1/M2).
 *
 * Reads the Vite manifest so "first load" means the eager shell + the initial
 * `/` route, not every lazy chunk:
 *   - first load (entry + static imports + dashboard chunk) ≤ 200 kB gzip
 *   - every other route/lazy chunk ≤ 90 kB gzip
 *   - initial CSS ≤ 35 kB gzip
 *   - the shell must not contain table/calendar/palette/chart/motion code
 *
 * Exits non-zero on any breach; `pnpm build` runs it, so the gate cannot be
 * forgotten.
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const kLimitFirstLoad = 200 * 1024
const kLimitLazyRoute = 90 * 1024
const kLimitCss = 35 * 1024

const distDir = path.resolve(process.cwd(), process.argv[2] ?? 'dist')
const manifestPath = path.join(distDir, '.vite', 'manifest.json')

const kRouteSources = new Map([
  ['src/routes/dashboard/route.tsx', '/'],
  ['src/routes/pets/route.tsx', '/pets'],
  ['src/routes/pets.$petId/route.tsx', '/pets/:petId/:tab?'],
  ['src/routes/appointments/route.tsx', '/appointments'],
  ['src/routes/vaccinations/route.tsx', '/vaccinations'],
  ['src/routes/records/route.tsx', '/records'],
  ['src/routes/journal/route.tsx', '/journal'],
  ['src/routes/profile/route.tsx', '/profile'],
  ['src/routes/not-found.tsx', '*'],
])

/** Strings that must never appear in the eager shell (04 §5). */
const kForbiddenShellMarkers = [
  'react-day-picker',
  'getCoreRowModel',
  'createColumnHelper',
  'getSortedRowModel',
  'cmdk',
  'recharts',
  'data-projection-id',
]

function fail(message) {
  console.error(`\nSize gate: ${message}`)
  process.exit(1)
}

if (!existsSync(manifestPath)) {
  fail(
    `${path.relative(process.cwd(), manifestPath)} is missing — run \`pnpm build\` (manifest: true).`,
  )
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const chunks = Object.entries(manifest).map(([key, value]) => ({ key, ...value }))
const byKey = new Map(chunks.map((chunk) => [chunk.key, chunk]))
const byFile = new Map(chunks.map((chunk) => [chunk.file, chunk]))

const gzipCache = new Map()
function gzipBytes(file) {
  if (!gzipCache.has(file)) {
    const absolute = path.join(distDir, file)
    if (!existsSync(absolute)) {
      fail(`manifest references a missing asset: ${file}`)
    }
    gzipCache.set(file, gzipSync(readFileSync(absolute)).length)
  }
  return gzipCache.get(file)
}

function transitivelyImported(key, seen = new Set()) {
  const chunk = byKey.get(key)
  if (chunk === undefined || seen.has(key)) {
    return seen
  }
  seen.add(key)
  for (const imported of chunk.imports ?? []) {
    transitivelyImported(imported, seen)
  }
  return seen
}

const entry = chunks.find((chunk) => chunk.isEntry)
if (entry === undefined) {
  fail('no entry chunk in the Vite manifest')
}

/*
 * First load = the eager entry closure, plus the initial `/` route chunk. Other
 * destinations are lazy and budgeted separately (D8).
 */
const firstLoadKeys = transitivelyImported(entry.key)
const dashboard = chunks.find((chunk) => kRouteSources.get(chunk.src) === '/')
if (dashboard !== undefined) {
  for (const key of transitivelyImported(dashboard.key)) {
    firstLoadKeys.add(key)
  }
}

const firstLoadFiles = []
for (const key of firstLoadKeys) {
  const chunk = byKey.get(key)
  if (chunk !== undefined && chunk.file.endsWith('.js')) {
    firstLoadFiles.push(chunk.file)
  }
}

const firstLoadCss = new Set(entry.css ?? [])
const firstLoadBytes = firstLoadFiles.reduce((sum, file) => sum + gzipBytes(file), 0)
const cssBytes = [...firstLoadCss].reduce((sum, file) => sum + gzipBytes(file), 0)

const lazyChunks = chunks.filter(
  (chunk) =>
    chunk.file.endsWith('.js') && !firstLoadFiles.includes(chunk.file) && chunk.file !== entry.file,
)

const failures = []

function kb(bytes) {
  return (bytes / 1024).toFixed(1).padStart(7)
}

console.log('\nSize gate (gzip, dist/)\n')
console.log('First load (shell + /)')
for (const file of firstLoadFiles) {
  const chunk = byFile.get(file)
  const label = chunk?.src !== undefined && chunk.src !== 'index.html' ? chunk.src : file
  console.log(`  ${kb(gzipBytes(file))} kB  ${label}`)
}
const firstStatus = firstLoadBytes <= kLimitFirstLoad ? 'PASS' : 'FAIL'
console.log(
  `  ${kb(firstLoadBytes)} kB  total  (limit ${kb(kLimitFirstLoad)} kB)  ${firstStatus}\n`,
)
if (firstLoadBytes > kLimitFirstLoad) {
  failures.push(`first load ${kb(firstLoadBytes)} kB > ${kb(kLimitFirstLoad)} kB`)
}

console.log('Lazy route chunks')
if (lazyChunks.length === 0) {
  console.log('  (none)')
}
for (const chunk of lazyChunks.toSorted((a, b) => gzipBytes(b.file) - gzipBytes(a.file))) {
  const route = kRouteSources.get(chunk.src) ?? chunk.src ?? chunk.file
  const bytes = gzipBytes(chunk.file)
  const status = bytes <= kLimitLazyRoute ? 'PASS' : 'FAIL'
  console.log(`  ${kb(bytes)} kB  ${route}  (limit ${kb(kLimitLazyRoute)} kB)  ${status}`)
  if (bytes > kLimitLazyRoute) {
    failures.push(`lazy chunk ${route} ${kb(bytes)} kB > ${kb(kLimitLazyRoute)} kB`)
  }
}

console.log('\nInitial CSS')
for (const file of firstLoadCss) {
  console.log(`  ${kb(gzipBytes(file))} kB  ${file}`)
}
const cssStatus = cssBytes <= kLimitCss ? 'PASS' : 'FAIL'
console.log(`  ${kb(cssBytes)} kB  total  (limit ${kb(kLimitCss)} kB)  ${cssStatus}`)
if (cssBytes > kLimitCss) {
  failures.push(`CSS ${kb(cssBytes)} kB > ${kb(kLimitCss)} kB`)
}

// "No table/calendar/palette/motion/chart code in the shell" — inspect the
// minified eager source, not just its size.
const firstLoadSource = firstLoadFiles
  .map((file) => readFileSync(path.join(distDir, file), 'utf8'))
  .join('\n')
const leaked = kForbiddenShellMarkers.filter((marker) => firstLoadSource.includes(marker))
console.log('\nEager-shell content')
if (leaked.length > 0) {
  console.log(`  FAIL  found forbidden module markers: ${leaked.join(', ')}`)
  failures.push(`forbidden shell code: ${leaked.join(', ')}`)
} else {
  console.log('  PASS  no table, calendar, palette, chart or motion code in the first chunk')
}

const totalJs = chunks
  .filter((chunk) => chunk.file.endsWith('.js'))
  .reduce((sum, chunk) => sum + gzipBytes(chunk.file), 0)
console.log(
  `\nAll JS chunks: ${kb(totalJs)} kB gzip across ${chunks.filter((c) => c.file.endsWith('.js')).length} files`,
)

if (failures.length > 0) {
  console.error('\nSize gate FAILED')
  for (const failure of failures) {
    console.error(`  - ${failure}`)
  }
  process.exit(1)
}

console.log('\nSize gate PASSED')
