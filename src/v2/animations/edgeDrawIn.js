// Phase 11E.3 + Phase 11E.4 — Two-edge reveal animation orchestrator (#139).
//
// Andrew's spec: when a provisional Claim flips to active, render TWO
// edges between the requester's anchor Asset and the now-active Claim
// during the animation window:
//
//   1. The canonical (provisional-styled, dashed grey) edge — already in
//      the V2Canvas edge group via the `_showAsProvisional` stamp on
//      reveal-incident edges. Stays visible during the draw-in. Fades
//      out concurrent with the Claim card flip.
//
//   2. A new typed-style overlay edge — added to V2Canvas's separate
//      reveal-overlay group with the **fully-resolved typed style from
//      frame one** (solid indigo for Full, dashed amber for Selective,
//      dashed green for Proof-only). Renders ON TOP of the provisional
//      edge. Geometry animates from a 2-point stub at the FROM (anchor)
//      end to the full bezier curve over `drawInMs`.
//
// Sequence (relative to this orchestrator's start at t=0):
//
//   t=0:                   addRevealOverlayEdge — overlay edge appears
//                          as a stub at the anchor.
//   t=0 → drawInMs:        playEdgeDrawInById — geometry grows.
//   t=fadeStartDelayMs:    fadeEdgeOpacityById on the provisional edge,
//                          0.0 over fadeMs. Fires concurrent with the
//                          Claim card flip (handed by playRevealAnimation).
//   t=...+postFlipPauseMs: removeRevealOverlayEdge — overlay cleanup.
//                          By this point the canonical buildEdges has
//                          re-rendered the now-active edge with typed
//                          style (post v22RevealActiveClaimId clear),
//                          so the overlay's removal is visually
//                          seamless: the typed canonical edge sits in
//                          the same world position with the same style.
//
// Pre-fix Phase 11E.3 mutated the canonical edge's geometry directly
// while it was still stamped `_showAsProvisional` — the visual result
// conflated the two edges and never produced the "supplier reaches out
// and the typed edge emerges from the provisional" effect Andrew's spec
// called for. Phase 11E.4 introduced V2Canvas's separate reveal-overlay
// group + four atomic methods to support the two-edge architecture.
//
// Edge cases:
//   - canvasRef not yet attached: every method call is null-checked;
//     primitive returns without error.
//   - missing fromNodeId / toNodeId / sdaType: addRevealOverlayEdge
//     no-ops; the orchestrator's downstream calls find no overlay and
//     resolve immediately. The reveal animation continues without the
//     edge ceremony.
//   - provisionalEdgeId not in canonical group: fadeEdgeOpacityById
//     no-ops. Reveal completes; the canonical buildEdges re-renders
//     the typed edge at reveal 'done' regardless.

/**
 * Orchestrate the two-edge reveal animation.
 *
 * @param {Object} opts
 * @param {Object} opts.canvasRef          React ref to V2Canvas. Must
 *                                         expose addRevealOverlayEdge,
 *                                         playEdgeDrawInById,
 *                                         fadeEdgeOpacityById,
 *                                         removeRevealOverlayEdge.
 * @param {string} opts.provisionalEdgeId  edgeId of the canonical edge
 *                                         currently rendered with
 *                                         `_showAsProvisional` stamp.
 *                                         Used to target the fade-out.
 * @param {string} opts.fromNodeId         Anchor Asset node id (FROM end
 *                                         of the bezier curve).
 * @param {string} opts.toNodeId           Claim node id (TO end).
 * @param {string} opts.sdaType            Disclosure type that drives the
 *                                         overlay edge's typed styling:
 *                                         'full' / 'selective' /
 *                                         'proofonly' / 'cascade'. The
 *                                         overlay uses this style from
 *                                         frame one of its draw-in.
 * @param {number} [opts.drawInMs=500]     Duration of the geometry
 *                                         growth animation.
 * @param {number} [opts.fadeStartDelayMs=600]
 *                                         Delay (relative to draw-in
 *                                         start) before the provisional
 *                                         edge fade begins. Aligned with
 *                                         the reveal flip phase by
 *                                         convention.
 * @param {number} [opts.fadeMs=400]       Duration of the provisional
 *                                         edge fade-out.
 * @param {number} [opts.postFlipPauseMs=900]
 *                                         How long after the fade ends
 *                                         to wait before removing the
 *                                         overlay edge. Sized to clear
 *                                         the reveal phase 'done' tick
 *                                         (~2500ms total reveal,
 *                                         ~1000ms past flip end) so the
 *                                         canonical buildEdges has
 *                                         re-rendered the typed edge
 *                                         before the overlay disappears.
 *
 * @returns {Promise<void>}                Resolves when the overlay
 *                                         edge has been removed.
 */
export async function playRevealEdgeAnimation({
  canvasRef,
  provisionalEdgeId,
  fromNodeId,
  toNodeId,
  sdaType,
  drawInMs = 500,
  fadeStartDelayMs = 600,
  fadeMs = 400,
  postFlipPauseMs = 900,
}) {
  const canvas = canvasRef?.current
  if (!canvas?.addRevealOverlayEdge) return
  if (!fromNodeId || !toNodeId) return

  const overlayEdgeId = `_reveal-overlay-${provisionalEdgeId || `${fromNodeId}-${toNodeId}`}-${Date.now().toString(36)}`

  canvas.addRevealOverlayEdge({
    edgeId: overlayEdgeId,
    fromNodeId,
    toNodeId,
    sdaType: sdaType || 'full',
  })

  const drawInPromise = canvas.playEdgeDrawInById?.(overlayEdgeId, drawInMs)
    || Promise.resolve()

  // Schedule the provisional fade-out to start at fadeStartDelayMs.
  // Fire-and-forget — the orchestrator doesn't block on fade completion;
  // the overall reveal is sized to comfortably outlast it.
  if (provisionalEdgeId) {
    setTimeout(() => {
      canvas.fadeEdgeOpacityById?.(provisionalEdgeId, 0.0, fadeMs)
    }, fadeStartDelayMs)
  }

  await drawInPromise

  // Hold the overlay until well after the flip + fade have completed.
  // Sized so the canonical buildEdges has had time to re-render the
  // now-active edge with typed style (post-reveal-done) before the
  // overlay is removed; visually the two edges occupy the same position
  // with the same style, so cleanup is seamless.
  const remainingMs = (fadeStartDelayMs + fadeMs + postFlipPauseMs) - drawInMs
  if (remainingMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingMs))
  }

  canvas.removeRevealOverlayEdge?.(overlayEdgeId)
}
