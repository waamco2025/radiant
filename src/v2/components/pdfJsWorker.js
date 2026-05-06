// Phase 15.0 (#172 part 1): PDF.js worker configuration. PDF.js requires
// a worker script for off-main-thread parsing/rendering. We resolve the
// bundled worker via Vite's `?url` import, which copies the worker .mjs
// into the build output and returns the resolved URL.
//
// If Vite ever fails to bundle the worker, the fallback is to host the
// worker file under public/ and set `workerSrc` to a relative path. Not
// the current approach.

import * as pdfjsLib from 'pdfjs-dist'
import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'

// Idempotent: setting workerSrc more than once is harmless; we still
// guard with a flag to avoid the noisy console warning if a
// re-importation triggers a no-op assignment after first set.
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc
}

export default pdfjsLib
