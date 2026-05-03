// Phase 11E.3 — Edge draw-in animation primitive (#139).
//
// Inverse of `playEdgeRetract` (V2Canvas.jsx). Plays when a previously-
// provisional Claim flips to active: the Agreement Edge connecting the
// requester's anchor Asset to the now-active Claim animates from the
// anchor end outward, completing before the Claim card's flip starts.
// Mirrors the visual ceremony of unravel's edge retract — but in reverse,
// for the new-arrival ceremony rather than the departure ceremony.
//
// Sequence inside the reveal flow:
//   t=0:    `playRevealAnimation` kicks off; camera pans to target.
//   t=500:  `playEdgeDrawIn` fires (this primitive). Edge geometry trims
//           to a stub at the anchor end, then grows along the curve to
//           full length over ~500ms. Material opacity ramps 0 → base in
//           the first ~30% so the edge fades in at the head of the draw.
//   t=1100: `playRevealAnimation` flip phase starts — card flips from
//           dashed-provisional render to typed-active render. The
//           edge's `_showAsProvisional` stamp clears at flip-midpoint
//           via the existing reveal infrastructure, so the dashed-grey
//           edge becomes its final typed style at the visual hand-off.
//   t=2500: reveal 'done' phase. Stamps cleared. Static state.
//
// Edge cases:
//   - No edges connect to nodeId (e.g. orphan reveal): primitive resolves
//     immediately. Caller's await chain proceeds without delay.
//   - canvasRef not yet attached: returns Promise.resolve() so the reveal
//     orchestration doesn't block on a missing canvas.
//   - Geometry rebuild during the animation: the per-frame setPositions
//     call is wrapped in try/catch; a disposed geometry just bails the
//     target. The remaining frames continue for other targets.
//
// Edge style note: the brief calls for typed edge styling (Full = solid
// indigo, Selective = dashed amber, Proof-only = dashed green). In V2.2
// the edge already exists in the group with its final type styling; the
// `_showAsProvisional` stamp keeps it dashed-grey during the reveal
// window, then clears at flip-midpoint. The draw-in animates the
// existing edge's GEOMETRY only — material/style is owned by the V2Canvas
// edge derivation pipeline, not this primitive. End result reads as the
// brief's "typed edge draws in" because the dashed-grey provisional
// edge's geometry grows in, then the style swaps to typed at flip-mid.

/**
 * Play the edge draw-in animation for edges incident to `nodeId`.
 *
 * @param {Object} opts
 * @param {string} opts.nodeId       The target node id (the Claim being
 *                                   revealed). Edges where `userData.from`
 *                                   or `userData.to` matches this id are
 *                                   collected and animated.
 * @param {Object} opts.canvasRef    React ref to V2Canvas (must expose
 *                                   `playEdgeDrawIn(nodeId, durationMs)`).
 * @param {number} [opts.durationMs] Animation duration. Defaults to 500ms
 *                                   so the draw-in fits cleanly between
 *                                   the reveal pan (~500ms) and the flip
 *                                   (1100ms).
 * @returns {Promise<void>}          Resolves when the animation completes.
 */
export function playEdgeDrawIn({ nodeId, canvasRef, durationMs = 500 }) {
  if (!nodeId) return Promise.resolve()
  const canvas = canvasRef?.current
  if (!canvas?.playEdgeDrawIn) return Promise.resolve()
  return canvas.playEdgeDrawIn(nodeId, durationMs)
}
