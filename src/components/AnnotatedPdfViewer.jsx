// Phase 15.0 (#172 part 1): PDF.js renderer with numbered annotation
// overlay. Replaces iframe-based PDF rendering inside the evaluation flow,
// the Eval Result Output tab, and the PoE Output tab. Other surfaces
// (Asset Detail Panel preview, Claim referenced-asset preview, etc.)
// continue to use iframe rendering — opt-in via `AssetEvidencePanel`'s
// `usePdfJs` prop.
//
// Phase 15.1 (#172 part 2) — visual redesign + bidirectional interaction:
//   • Each anchor renders TWO visual elements: a highlight rectangle
//     drawn over the cited text (RS color at 15% opacity; bumps to 30%
//     when highlighted) + a numbered indicator placed immediately to
//     the LEFT of the highlight rect.
//   • Indicators are click targets — clicking fires `onAnchorClick`
//     with the synthesized anchor ID so the consumer can highlight the
//     matching results row.
//   • When `highlightedAnchorId` matches an anchor: indicator gets a
//     3px ring in the RS color, highlight rect bumps to 30% opacity.
//   • When `highlightedAnchorId` changes, the viewer scrolls the
//     matching dot into view (smooth, block: 'center').
//
// Phase 15.1.1 — annotation label + shape refinements:
//   • Label scheme dropped the `{assetOrdinal}.` prefix; indicators now
//     show only `{rowOrdinal}` (per-RS, 1-indexed). Same row keeps the
//     same number across Asset switches; RS color coding distinguishes
//     RS membership.
//   • Indicator shape: rounded rectangle (32×22, borderRadius 6)
//     instead of a 26px circle. Wider footprint accommodates 2-digit
//     row ordinals if RSes ever exceed 9 rows.
//   • `assetOrdinal` prop preserved in the API but no longer renders
//     in the label — reserved for future compound-label scenarios
//     (multi-Asset disambiguation tooltips, etc.).
//
// Implementation note (15.0 — preserved): cleanup deliberately does NOT
// destroy the PDF doc or cancel render tasks. Under React StrictMode the
// effect is invoked twice; cancelling the first run's tasks reliably
// leaves the canvas empty. Simpler: tag each effect run with a `runId`
// ref, mutate the DOM only when the current runId matches at the moment
// of paint, and let stale runs finish their render tasks harmlessly.
//
// Implementation note (15.0 — preserved): pdfjs-dist v5 changed the
// render API to use `canvas` (HTMLCanvasElement) as the primary parameter.
// Passing the legacy `canvasContext` parameter still paints the canvas
// but the returned promise never resolves — render task hangs.

import { useEffect, useRef, useState, useMemo } from 'react'
import pdfjsLib from '../v2/components/pdfJsWorker.js'
import { synthesizeAnchorId } from '../v2/data/anchorIds.js'

// Phase 15.0.1: derive the render scale from the container width at
// render time so the canvas fits the column without horizontal scroll.
const SCALE_CAP = 1.6
const HOST_HORIZONTAL_PADDING = 28

// Phase 15.1.1: indicator sizing — rounded rectangle (was 26px circle).
const INDICATOR_WIDTH = 32     // px width of the numbered rounded rectangle
const INDICATOR_HEIGHT = 22    // px height of the numbered rounded rectangle
const INDICATOR_RADIUS = 6     // px border-radius (rounded but not pill-shaped)
const INDICATOR_GAP = 6        // px between indicator's right edge and highlight rect's left edge
const INDICATOR_LEFT_CLAMP = 4 // minimum left offset within page wrapper

export default function AnnotatedPdfViewer({
  fileUrl,
  evidenceAnchors = [],
  assetOrdinal = null,
  rsColorByRsId = {},
  height = 480,
  // Phase 15.1: bidirectional interaction.
  highlightedAnchorId = null,
  onAnchorClick = null,
}) {
  const containerRef = useRef(null)
  const runIdRef = useRef(0)
  const [pageMetrics, setPageMetrics] = useState([])
  const [error, setError] = useState(null)
  const [loaded, setLoaded] = useState(false)

  // Load the PDF + render every page to a fresh canvas inside the
  // container. The runId guard tolerates StrictMode's mount → unmount →
  // mount double-invocation: only the most recent run mutates state or
  // DOM. Older runs continue to completion but their results are dropped.
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
        container.innerHTML = ''
        const metrics = []

        const hostEl = container.parentElement || container
        const hostWidth = hostEl.clientWidth || 600

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await doc.getPage(pageNum)
          if (!isCurrent()) return
          const baseViewport = page.getViewport({ scale: 1 })
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

          await page.render({ canvas, viewport }).promise
          if (!isCurrent()) return

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
        if (isCurrent()) setError(e?.message || String(e))
      }
    }

    setLoaded(false)
    setError(null)
    setPageMetrics([])
    run()
  }, [fileUrl])

  const anchorsByPage = useMemo(() => {
    const map = new Map()
    for (const a of evidenceAnchors || []) {
      if (!a) continue
      if (!map.has(a.page)) map.set(a.page, [])
      map.get(a.page).push(a)
    }
    return map
  }, [evidenceAnchors])

  // Phase 15.1: smooth-scroll the highlighted anchor into view once the
  // PDF has loaded. The dot has `data-anchor-id` so we query for it after
  // the AnnotationLayer effect has painted.
  useEffect(() => {
    if (!loaded || !highlightedAnchorId) return
    const container = containerRef.current
    if (!container) return
    // Defer one frame so AnnotationLayer's effect has painted the dots
    // for the current pageMetrics + anchor set.
    const handle = requestAnimationFrame(() => {
      const target = container.querySelector(`[data-anchor-id="${CSS.escape(highlightedAnchorId)}"]`)
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    })
    return () => cancelAnimationFrame(handle)
  }, [highlightedAnchorId, loaded, pageMetrics])

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
          highlightedAnchorId={highlightedAnchorId}
          onAnchorClick={onAnchorClick}
        />
      )}
    </div>
  )
}

// Phase 15.1 redesign: each anchor renders a highlight rectangle (over
// the cited text) + a numbered indicator (immediately left of the rect).
// Indicators are click targets when `onAnchorClick` is provided.
// Highlighted anchor state is visible as: indicator gets a 3px RS-color
// ring outside its 2px white border, highlight rect bumps to 30% opacity
// (was 15%), AND the consumer's results row picks up its own tint.
function AnnotationLayer({ containerRef, pageMetrics, anchorsByPage, assetOrdinal, rsColorByRsId, highlightedAnchorId, onAnchorClick }) {
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const wrappers = container.querySelectorAll('[data-page-num]')

    for (const pageWrap of wrappers) {
      const pageNum = parseInt(pageWrap.dataset.pageNum, 10)
      const metric = pageMetrics.find((m) => m.pageNum === pageNum)
      if (!metric) continue
      const anchors = anchorsByPage.get(pageNum) || []

      const prior = pageWrap.querySelector('[data-anchor-overlay]')
      if (prior) prior.remove()

      const overlay = document.createElement('div')
      overlay.dataset.anchorOverlay = 'true'
      overlay.style.position = 'absolute'
      overlay.style.inset = '0'
      overlay.style.pointerEvents = 'none'
      pageWrap.appendChild(overlay)

      for (const anchor of anchors) {
        const anchorId = synthesizeAnchorId(anchor)
        const isHighlighted = anchorId === highlightedAnchorId
        const color = rsColorByRsId[anchor.requirementsSetId] || 'var(--accent-indigo)'
        // Phase 15.1.1: label is `{rowOrdinal}` only — per-RS, stable
        // across Asset switches. RS color distinguishes RS membership.
        const label = `${anchor.rowOrdinal ?? '?'}`

        // PDF coords are bottom-left origin; canvas coords top-left.
        // The rect spans (x, y) to (x+w, y+h) in PDF space; flip Y by
        // computing top from (pdfH - y - h).
        const rectLeft = anchor.x * metric.scale
        const rectTop = (metric.pdfH - anchor.y - anchor.h) * metric.scale
        const rectWidth = anchor.w * metric.scale
        const rectHeight = anchor.h * metric.scale

        // Highlight rectangle — RS color at 15% (or 30% when highlighted).
        // Use rgba via a small color-mix for theme parity.
        const rect = document.createElement('div')
        rect.style.position = 'absolute'
        rect.style.left = `${rectLeft}px`
        rect.style.top = `${rectTop}px`
        rect.style.width = `${rectWidth}px`
        rect.style.height = `${rectHeight}px`
        rect.style.background = isHighlighted
          ? `color-mix(in srgb, ${color} 30%, transparent)`
          : `color-mix(in srgb, ${color} 15%, transparent)`
        rect.style.pointerEvents = 'none'
        rect.style.borderRadius = '2px'
        rect.style.zIndex = '1'
        overlay.appendChild(rect)

        // Phase 15.1.1: rounded-rectangle indicator (32×22, radius 6) to
        // the LEFT of the rect. Vertically centered on the rect's
        // mid-line. Clamps to INDICATOR_LEFT_CLAMP when the natural
        // position would push it offscreen-left.
        const indicatorTop = rectTop + rectHeight / 2 - INDICATOR_HEIGHT / 2
        const naturalLeft = rectLeft - INDICATOR_WIDTH - INDICATOR_GAP
        const indicatorLeft = Math.max(INDICATOR_LEFT_CLAMP, naturalLeft)

        const indicator = document.createElement('div')
        indicator.style.position = 'absolute'
        indicator.style.left = `${indicatorLeft}px`
        indicator.style.top = `${indicatorTop}px`
        indicator.style.width = `${INDICATOR_WIDTH}px`
        indicator.style.height = `${INDICATOR_HEIGHT}px`
        indicator.style.borderRadius = `${INDICATOR_RADIUS}px`
        indicator.style.background = color
        indicator.style.border = '2px solid #fff'
        // Highlighted state: stack a 3px RS-color ring outside the white
        // border via box-shadow.
        indicator.style.boxShadow = isHighlighted
          ? `0 1px 4px rgba(0,0,0,0.5), 0 0 0 3px ${color}`
          : '0 1px 4px rgba(0,0,0,0.5)'
        indicator.style.color = '#fff'
        indicator.style.fontFamily = 'var(--font-mono)'
        indicator.style.fontSize = '12px'
        indicator.style.fontWeight = '700'
        indicator.style.display = 'flex'
        indicator.style.alignItems = 'center'
        indicator.style.justifyContent = 'center'
        indicator.style.userSelect = 'none'
        indicator.style.lineHeight = '1'
        indicator.style.zIndex = '2'
        indicator.textContent = label
        indicator.title = `${label} · ${anchor.label || ''} · ${anchor.value || ''}`
        indicator.dataset.anchorId = anchorId
        // Click target — pointer-events flips to auto, the overlay parent
        // stays at 'none' so the rest of the page remains interaction-
        // transparent.
        if (onAnchorClick) {
          indicator.style.pointerEvents = 'auto'
          indicator.style.cursor = 'pointer'
          indicator.addEventListener('click', (e) => {
            e.stopPropagation()
            onAnchorClick(anchorId)
          })
        } else {
          indicator.style.pointerEvents = 'none'
        }
        overlay.appendChild(indicator)
      }
    }
  }, [containerRef, pageMetrics, anchorsByPage, assetOrdinal, rsColorByRsId, highlightedAnchorId, onAnchorClick])

  return null
}
