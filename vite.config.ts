import path from 'node:path'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the app from /<repo>/; local dev and preview stay at /.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
  build: {
    // The size gate reads dist/.vite/manifest.json to tell the eager shell
    // apart from the lazy route chunks (D8). The raw entry is one ~620 kB
    // chunk by design (one eager graph); D8 is a *gzip* budget enforced by
    // scripts/check-size.mjs, so Vite's raw-kB warning would be noise.
    manifest: true,
    chunkSizeWarningLimit: 700,
  },
})
