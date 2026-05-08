// Phase 15.0 (#172 part 1): PDF.js worker configuration. PDF.js requires
// a worker script for off-main-thread parsing/rendering.
//
// Phase 16.0.2 (hotfix): switched from Vite `?url` import to a static
// `public/pdf.worker.mjs` path. Root cause: when the dev server runs
// from a git worktree (e.g. `.claude/worktrees/...`), the `?url` import
// resolves to `/@fs/<absolute>/node_modules/pdfjs-dist/build/...`
// outside Vite's `server.fs.allow` boundary, producing a 404 for
// `pdf.worker.mjs` and a "Setting up fake worker failed" runtime error.
// Copying the worker to `public/` decouples the worker URL from
// node_modules path resolution: the file is served directly from the
// project root in dev AND production. Manual upgrade step: when
// `pdfjs-dist` updates, re-copy `node_modules/pdfjs-dist/build/pdf.worker.mjs`
// to `public/pdf.worker.mjs` (or rerun `cp node_modules/pdfjs-dist/build/pdf.worker.mjs public/`).

import * as pdfjsLib from 'pdfjs-dist'

// Idempotent: setting workerSrc more than once is harmless; we still
// guard with a flag to avoid the noisy console warning if a
// re-importation triggers a no-op assignment after first set.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'
}

export default pdfjsLib
