// Phase 11C.3 W3 — Reveal animation primitive.
//
// Plays when a previously-provisional Claim node finalizes to active state.
// Triggered by the notification-click handler in V2App.jsx after the
// requester clicks the acceptance notification — the responder's accept
// fired finalize on their side; the requester arrives to see their
// provisional Claim transition to active with a coordinated animation.
//
// Sequence (from the V2.1 reveal infrastructure, ported here for code
// organization parity with src/v2/animations/unravel.js):
//
//   Phase 'zoom'    (t=0):     Camera zooms / pans to the target node with
//                              panel-aware offsets so the Claim sits to the
//                              left of the Detail Panel column.
//   Phase 'border'  (t=500):   Border treatment shifts in.
//   Phase 'flip'    (t=1100):  Card flips. AssetNode reads `flipMidpoint`
//                              (set ~315ms into the flip) to switch from
//                              the dashed-provisional render to the solid-
//                              active render — the visual hand-off.
//   Phase 'badge'   (t=1800):  NEW badge fades in.
//   Phase 'panel'   (t=2000):  Detail Panel slides in.
//   Phase 'done'    (t=2500):  Reveal complete. The reveal-id is cleared so
//                              v22DataWithReveal stops force-stamping the
//                              `_showAsProvisional` override on the Claim;
//                              the next render shows clean active state.
//
// AssetNode reads `revealAnim` (the state machine value passed via prop)
// alongside `node._showAsProvisional` to drive its render. The stamp
// override is what makes the flip play from provisional → active rather
// than active → active, since at notification-click time the artifact
// has already been finalized in v22Provisionals.
//
// Edge cases:
//   - Caller navigates away mid-animation (role switch, panel close):
//     the timeouts continue regardless. The state machine resolves on its
//     own timeline; the `prev?.nodeId === nodeId` guard inside each
//     setRevealAnim ensures stale timers don't clobber a newer reveal that
//     started for a different node.
//   - Concurrent reveals on different nodes: the new reveal supersedes the
//     old one's nodeId, so the old reveal's timers no-op via the guard.

const PHASE_BORDER_MS = 500
const PHASE_FLIP_MS = 1100
const PHASE_BADGE_MS = 1800
const PHASE_PANEL_MS = 2000
const PHASE_DONE_MS = 2500

const PAN_TARGET_ZOOM = 1.28
const PANEL_OFFSET_X_PX = 180
// Vertical viewport offset is computed at call time from the canvas
// container's actual height; 10% bias matches the V2.1 default.
const VERTICAL_OFFSET_RATIO = 0.10

/**
 * Play the reveal animation for `nodeId`. Mirrors the V2.1-era reveal
 * state machine that previously lived inline in V2App.jsx's `startReveal`.
 *
 * @param {object} opts
 * @param {string} opts.nodeId            The node id to reveal.
 * @param {object} opts.canvasRef         React ref to V2Canvas (for panToWithZoom).
 * @param {object} opts.targetNode        The {x, y} of the target node, resolved
 *                                        by the caller from nodeMap. Optional;
 *                                        when absent the pan step is skipped.
 * @param {Function} opts.setRevealAnim   State setter for the V2App reveal-state
 *                                        machine. Called with updater fn that
 *                                        no-ops when nodeId mismatches.
 * @param {Function} opts.onDone          Optional callback fired after the
 *                                        'done' phase. V2App uses this to clear
 *                                        the recently-accepted-claim stamp so
 *                                        the next render shows clean active
 *                                        state.
 */
export function playRevealAnimation({
  nodeId,
  canvasRef,
  targetNode,
  setRevealAnim,
  onDone,
}) {
  if (!nodeId) return

  // Phase 'zoom' (t=0). Camera positioning with panel-aware offsets — same
  // arithmetic the V2.1 reveal used. `panToWithZoom` (not animated*) cancels
  // any in-flight pan and snaps the camera to the target.
  setRevealAnim({ nodeId, phase: 'zoom' })
  if (targetNode && canvasRef?.current?.panToWithZoom) {
    const container = document.querySelector('[data-canvas-container]')
    const z = PAN_TARGET_ZOOM
    const viewportOffsetY = container ? (container.clientHeight * VERTICAL_OFFSET_RATIO) / z : 0
    const horizontalOffsetX = PANEL_OFFSET_X_PX / z
    canvasRef.current.panToWithZoom(
      targetNode.x + horizontalOffsetX,
      targetNode.y + viewportOffsetY,
      z
    )
  }

  // The setTimeout chain matches the V2.1 timing exactly. The
  // `prev?.nodeId === nodeId` guard inside each updater ensures a stale
  // timer doesn't clobber a newer reveal targeting a different node.
  const guard = (phase) => (prev) => (prev?.nodeId === nodeId ? { ...prev, phase } : prev)

  setTimeout(() => setRevealAnim(guard('border')), PHASE_BORDER_MS)
  setTimeout(() => setRevealAnim(guard('flip')), PHASE_FLIP_MS)
  setTimeout(() => setRevealAnim(guard('badge')), PHASE_BADGE_MS)
  setTimeout(() => setRevealAnim(guard('panel')), PHASE_PANEL_MS)
  setTimeout(() => {
    setRevealAnim(guard('done'))
    onDone?.()
  }, PHASE_DONE_MS)
}
