import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const alias = { '@': path.resolve(import.meta.dirname, './src') }

/**
 * Two projects (06 M1):
 * - `node`: pure rules (t1) and Dexie repositories against fake-indexeddb
 * - `dom`: React shell tests in jsdom (Testing Library + jest-dom)
 *
 * `pnpm test` runs both; no test may live in both projects.
 */
export default defineConfig({
  plugins: [react()],
  resolve: { alias },
  test: {
    projects: [
      {
        test: {
          name: 'node',
          environment: 'node',
          include: ['src/lib/rules/**/*.test.ts', 'src/lib/db/**/*.test.ts'],
          setupFiles: ['./src/test/setup-node.ts'],
        },
      },
      {
        test: {
          name: 'dom',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/lib/rules/**', 'src/lib/db/**', 'src/test/**'],
          setupFiles: ['./src/test/setup-dom.ts'],
        },
      },
    ],
  },
})
