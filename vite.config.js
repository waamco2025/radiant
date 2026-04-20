import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// Phase 8.5 (2026-04-19): `v2.html` renamed to `index.html` so the base URL
// serves the app. `v3.html` is retained as archived reference material.
// With `index.html` as the default, Vite auto-detects it — no explicit input
// entry is required for it. Keep `v3` listed so it still builds.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        v3: resolve(__dirname, 'v3.html'),
      },
    },
  },
})
