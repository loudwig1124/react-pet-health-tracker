import { describe, expect, it } from 'vitest'

/**
 * R10 / rule-purity guard: `src/lib/rules` is pure — no React, no Dexie, no
 * DOM, no clock read, no randomness. `today`/`now`/`id` are parameters.
 *
 * Reads the rule sources through Vite's raw glob (no Node APIs needed) and
 * fails if a rule module gains a forbidden dependency. Also fails when a rule
 * module has no Vitest suite, so "no UI consumes a rule before its cases are
 * green" stays enforceable.
 */

const ruleModules = import.meta.glob<string>('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
})

/** Files that are not executable rules: type-only declarations and constants. */
const NON_RULE_MODULES = new Set(['./types.ts', './constants.ts'])

interface Violation {
  file: string
  rule: string
  evidence: string
}

const FORBIDDEN_PATTERNS: readonly { rule: string; pattern: RegExp }[] = [
  {
    rule: 'react-import',
    pattern: /\bfrom\s+['"](react|react-dom|react-router|react-router-dom)['"]/,
  },
  { rule: 'store-import', pattern: /\bfrom\s+['"](dexie|dexie-react-hooks|fake-indexeddb)['"]/ },
  { rule: 'db-import', pattern: /\bfrom\s+['"][^'"]*\/db(?:\/|['"])/ },
  {
    rule: 'dom-access',
    pattern: /\b(document|window|localStorage|sessionStorage|navigator|indexedDB)\s*\./,
  },
  { rule: 'clock-read', pattern: /\bDate\.now\s*\(|\bnew\s+Date\s*\(\s*\)/ },
  { rule: 'clock-read', pattern: /\bperformance\.now\s*\(/ },
  { rule: 'randomness', pattern: /\b(Math\.random|crypto\.randomUUID)\s*\(/ },
]

/** Only strip comments: string literals in rule code never contain `//`. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')
}

function scanRuleSource(file: string, source: string): Violation[] {
  const code = stripComments(source)
  const violations: Violation[] = []
  for (const { rule, pattern } of FORBIDDEN_PATTERNS) {
    const match = pattern.exec(code)
    if (match !== null) {
      violations.push({ file, rule, evidence: match[0] })
    }
  }
  return violations
}

const sourceFiles = Object.keys(ruleModules)
  .filter((file) => !file.endsWith('.test.ts'))
  .sort()

describe('rule purity · src/lib/rules has no UI, store, DOM or clock dependency', () => {
  it('accepts: every rule module is pure, and every rule module has a suite', () => {
    for (const file of sourceFiles) {
      const source = ruleModules[file] ?? ''
      expect(scanRuleSource(file, source), `purity violations in ${file}`).toEqual([])
    }

    for (const file of sourceFiles) {
      if (NON_RULE_MODULES.has(file)) {
        continue
      }
      const suite = file.replace(/\.ts$/, '.test.ts')
      expect(ruleModules[suite], `${file} must have ${suite}`).toBeDefined()
    }
  })

  it('rejects: the scanner catches React, Dexie, DOM, clock and randomness imports', () => {
    const violating = [
      "import { useState } from 'react';",
      "import { liveQuery } from 'dexie';",
      "import { db } from '../db/db';",
      'const name = document.title;',
      'const startedAt = Date.now();',
      'const now = new Date();',
      'const id = crypto.randomUUID();',
    ].join('\n')
    const rules = scanRuleSource('./bad.ts', violating).map((violation) => violation.rule)
    expect(rules).toEqual(
      expect.arrayContaining([
        'react-import',
        'store-import',
        'db-import',
        'dom-access',
        'clock-read',
        'randomness',
      ]),
    )
  })

  it('rejects: a rule module without a test suite fails the guard', () => {
    const files = sourceFiles.filter((file) => !NON_RULE_MODULES.has(file))
    expect(files.length).toBeGreaterThan(0)
    const untested = files.filter(
      (file) => ruleModules[file.replace(/\.ts$/, '.test.ts')] === undefined,
    )
    expect(untested).toEqual([])
  })
})
