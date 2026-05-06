// Phase 15.0 (#172 part 1): PDF.js renderer with numbered annotation
// overlay. Replaces iframe-based PDF rendering inside the evaluation flow,
// the Eval Result Output tab, and the PoE Output tab. Other surfaces
// (Asset Detail Panel preview, Claim referenced-asset preview, etc.)
// continue to use iframe rendering — opt-in via `AssetEvidencePanel`'s
// `usePdfJs` prop.
//
// Each `evidenceAnchor` provided as a prop renders as a small numbered
// circular dot positioned over the PDF canvas at the anchor's center
// `(x + w/2, y + h/2)`. Anchors with `sourceAssetId !== currentAssetId`
// are filtered out by the consumer (this component renders all anchors
// it receives — caller decides which Asset is on screen).
//
// Static rendering only in Phase 15.0; Phase 15.1 will wire bidirectional
// row-click ↔ dot-click interaction.
//
// Props:
//   fileUrl         — URL to the PDF (e.g. asset.file.localPath).
//   evidenceAnchors — array of { sourceAssetId, page, x, y, w, h,
//                                requirementsSetId, label, value,
//                                rowOrdinal }
//                     The consumer enriches anchors with rowOrdinal +
//                     requirementsSetId before passing them in. The
//                     dot's label is `{assetOrdinal}.{rowOrdinal}`.
//   assetOrdinal    — 1-indexed Asset position within the Claim's
//                     `referencedAssetIds` (drives the numerator of the
//                     dot label).
//   rsColorByRsId   — { [rsId]: cssColor } map — drives dot fill.
//   height          — viewer height in px (defaults to 480).
//
// Implementation note: cleanup deliberately does NOT destroy the PDF doc
// or cancel render tasks. Under React StrictMode the effect is invoked
// twice; cancelling the first run's tasks reliably leaves the canvas
// empty (the second run's tasks complete on a different render token).
// Simpler: tag each effect run with a `runId` ref, mutate the DOM only
// when the current runId matches at the moment of paint, and let stale
// runs finish their render tasks harmlessly. The PDF doc objects are
// short-lived; GC reclaims them.

import { useEffect, useRef, useState, useMemo } from 'react'
import pdfjsLib from '../v2/components/pdfJsWorker.js'

// Phase 15.0.1: derive the render scale from the container width at
// render time so the canvas fits the column without horizontal scroll.
// Cap at 1.6 to avoid over-scaling on very wide containers (>1024px).
const SCALE_CAP = 1.6
// Padding inside the outer wrapper (12px each side on the scrollable
// outer + a small margin for the page-wrapper shadow).
const HOST_HORIZONTAL_PADDING = 28

export default function AnnotatedPdfViewer({
  fileUrl,
  evidenceAnchors = [],
  assetOrdinal = null,
  rsColorByRsId = {},
  height = 480,
}) {
  const containerRef = useRef(null)
  const runIdRef = useRef(0)
  const [pageMetrics, setPageMetrics] = useState([])
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  // Load the PDF + render every page to a fresh canvas inside the
  // container. The runId guard is how we tolerate StrictMode's
  // mount → unmount → mount double-invocation: only the most recent run
  // is allowed to mutate the DOM container or set state. Older runs
  // continue to completion but their results are dropped.
  useEffect(() => {
    if (!fileUrl) return
    runIdRef.current += 1
    const myRunId = runIdRef.current

    const isCurrent = () => runIdRef.current === myRunId

    const run = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(fileUrl)
        const doc = await loadingTask.promise
        if (!isCurrent()) return
        const numPages = doc.numPages
        const container = containerRef.current
        if (!container) return
        // Wipe prior render artifacts before painting fresh canvases.
        container.innerHTML = ''
        const metrics = []

        // Phase 15.0.1: fit-to-width — pick a render scale based on the
        // host container's current width so multi-page PDFs don't force
        // horizontal scroll inside narrow modal columns. Read the host
        // wrapper (parentElement of containerRef) since the inner
        // container itself measures content-width and grows with us.
        const hostEl = container.parentElement || container
        const hostWidth = hostEl.clientWidth || 600

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          if (!isCurrent()) return
          const baseViewport = page.getViewport({ scale: 1 })
          // Compute a fit-to-width scale per page (PDF page widths can
          // differ across pages even within one document, though it's
          // uncommon). Cap to SCALE_CAP for clarity-vs-perf balance.
          const fitScale = Math.max(0.6, (hostWidth - HOST_HORIZONTAL_PADDING) / baseViewport.width)
          const renderScale = Math.min(fitScale, SCALE_CAP)
          const viewport = page.getViewport({ scale: renderScale })

          const pageWrap = document.createElement('div')
          pageWrap.style.position = 'relative'
          pageWrap.style.margin = '0 auto 12px'
          pageWrap.style.width = `${viewport.width}px`
          pageWrap.style.height = `${viewport.height}px`
          pageWrap.style.background = '#fff'
          pageWrap.style.boxShadow = '0 1px 4px rgba(0,0,0,0.25)'
          pageWrap.dataset.pageNum = String(pageNum)

          const canvas = document.createElement('canvas')
          canvas.width = viewport.width
          canvas.height = viewport.height
          canvas.style.display = 'block'
          pageWrap.appendChild(canvas)
          container.appendChild(pageWrap)

          // pdfjs-dist v5 changed the render API: `canvas` is the primary
          // parameter (was `canvasContext` in v4 and earlier). Passing the
          // deprecated `canvasContext` parameter still paints the canvas
          // but the returned promise never resolves on v5 — the render
          // task hangs indefinitely.
          await page.render({ canvas, viewport }).promise
          if (!isCurrent()) { console.log('[Pdf]', myRunId, 'stale-after-render', pageNum); return }

          metrics.push({
            pageNum,
            viewportW: viewport.width,
            viewportH: viewport.height,
            pdfW: baseViewport.width,
            pdfH: baseViewport.height,
            scale: renderScale,
          })
        }

        if (isCurrent()) {
          setPageMetrics(metrics)
          setLoaded(true)
        }
      } catch (e) {
        // Stale render tasks may reject with "Rendering cancelled" or
        // similar; only surface the error if this run is still the
        // active one.
        if (isCurrent()) setError(e?.message || String(e))
      }
    }

    setLoaded(false)
    setError(null)
    setPageMetrics([])
    run()
    // No destroy/cancel in the cleanup — see header comment.
  }, [fileUrl])

  // Group anchors by page for overlay rendering.
  const anchorsByPage = useMemo(() => {
    const map = new Map()
    for (const a of evidenceAnchors || []) {
      if (!a) continue
      if (!map.has(a.page)) map.set(a.page, [])
      map.get(a.page).push(a)
    }
    return map
  }, [evidenceAnchors])

  return (
    <div
      style={{
        width: '100%',
        height,
        overflow: 'auto',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 12,
        boxSizing: 'border-box',
      }}
    >
      {error && (
        <div style={{
          padding: 16, color: 'var(--accent-red)', fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}>
          PDF render error: {error}
        </div>
      )}
      {!loaded && !error && (
        <div style={{
          padding: 16, color: 'var(--text-dim)', fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}>
          Loading PDF…
        </div>
      )}
      <div ref={containerRef} style={{ position: 'relative' }} />
      {loaded && pageMetrics.length > 0 && (
        <AnnotationLayer
          containerRef={containerRef}
          pageMetrics={pageMetrics}
          anchorsByPage={anchorsByPage}
          assetOrdinal={assetOrdinal}
          rsColorByRsId={rsColorByRsId}
        />
      )}
    </div>
  )
}

// Annotation overlay portals dots into the per-page wrappers created by
// the loader effect above. Each dot's pixel position derives from the
// anchor's PDF point coords + the cached page viewport. Dots are
// pointer-events: none in 15.0 (no interaction yet — see Phase 15.1).
function AnnotationLayer({ containerRef, pageMetrics, anchorsByPage, assetOrdinal, rsColorByRsId }) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wrappers = container.querySelectorAll('[data-page-num]')

    for (const pageWrap of wrappers) {
      const pageNum = parseInt(pageWrap.dataset.pageNum, 10)
      const metric = pageMetrics.find((m) => m.pageNum === pageNum)
      if (!metric) continue
      const anchors = anchorsByPage.get(pageNum) || []

      // Clear any prior overlay before re-rendering.
      const prior = pageWrap.querySelector('[data-anchor-overlay]')
      if (prior) prior.remove()

      const overlay = document.createElement('div')
      overlay.dataset.anchorOverlay = 'true'
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.pointerEvents = 'none'
      pageWrap.appendChild(overlay)

      for (const anchor of anchors) {
        const cx = anchor.x + anchor.w / 2
        const cy = anchor.y + anchor.h / 2
        // PDF coords are bottom-left origin; canvas coords top-left.
        const pxX = cx * metric.scale
        const pxY = (metric.pdfH - cy) * metric.scale
        const color = rsColorByRsId[anchor.requirementsSetId] || 'var(--accent-indigo)'
        const label = `${assetOrdinal ?? '?'}.${anchor.rowOrdinal ?? '?'}`

        const dot = document.createElement('div')
        dot.style.position = 'absolute'
        dot.style.left = `${pxX}px`
        dot.style.top = `${pxY}px`
        dot.style.transform = 'translate(-50%, -50%)'
        dot.style.width = '20px'
        dot.style.height = '20px'
        dot.style.borderRadius = '50%'
        dot.style.background = color
        dot.style.border = '2px solid #fff'
        dot.style.boxShadow = '0 1px 4px rgba(0,0,0,0.5)'
        dot.style.color = '#fff'
        dot.style.fontFamily = 'var(--font-mono)'
        dot.style.fontSize = '10px'
        dot.style.fontWeight = '700'
        dot.style.display = 'flex'
        dot.style.alignItems = 'center'
        dot.style.justifyContent = 'center'
        dot.style.pointerEvents = 'none'
        dot.style.userSelect = 'none'
        dot.style.lineHeight = '1'
        dot.textContent = label
        dot.title = `${label} · ${anchor.label || ''} · ${anchor.value || ''}`
        overlay.appendChild(dot)
      }
    }

    return () => {
      // Don't remove dots on cleanup — the next render will replace them
      // when the page re-renders. Removing here causes flicker.
    }
  }, [containerRef, pageMetrics, anchorsByPage, assetOrdinal, rsColorByRsId])

  return null
}
