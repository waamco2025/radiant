// Phase 9D.2 — Unravel animation primitive (#124).
//
// Plays when a node leaves the canvas (today: revoked-Claim Dismiss + orphaned-
// Eval-Result Dismiss). Designed reusably so future "leaves the canvas"
// scenarios — expired agreements, transfer-accept on sender side, explicit
// delete actions — can call the same primitive.
//
// Sequence:
//   Stage 0 (~400ms, optional): pan/zoom to the target node.
//   Stage 1 (~400ms):           edge retract (Three.js, via canvasRef).
//   Stage 2-4 (~900ms):         CSS card unravel (border + content + bg fade
//                               + slight translate). Driven by an `_unraveling`
//                               flag on the node, picked up by AssetNode's
//                               `node-unravel` keyframe animation.
//
// Stage 1 starts at t=0 (after Stage 0). Stage 2-4 starts at t=300 so it
// overlaps Stage 1's tail — the user sees the edge halfway-retracted as the
// card begins to erode. Total ~1.2s after Stage 0 (within the 1.0–1.3s
// budget in the original spec).
//
// Stage 2 fallback note: the original spec called for a clockwise dashed-
// border unwind. Per the task brief's explicit allowance, this phase ships
// the simpler "border + card fade + slight translate" via CSS keyframe
// instead, deferring the clockwise unwind. The deferred work would require
// either an SVG overlay tracking card position+size through pan/zoom or a
// custom canvas2D layer — disproportionately expensive for marginal visual
// gain over a coordinated fade.
//
// Edge cases:
//   - Caller navigates away mid-animation (role switch / panel close): the
//     primitive doesn't observe React state directly. The Promise resolves
//     on its own timeline; the caller's state mutation runs unconditionally
//     after the await. AssetNode unmount during the CSS animation just
//     stops the animation — no crash.
//   - Concurrent dismisses: in practice the modal-driven dismiss flow is
//     serial (one modal at a time). No queuing implemented; if two
//     primitives run simultaneously they animate independently and don't
//     conflict (each targets a different nodeId).

// Phase 9D.2.2 Fix 3: testing-time toggle. Multiplies every JS-side
// timing constant AND drives the inline animation-duration overrides on
// the SVG border overlay + per-row content fades + card fade in
// AssetNode.jsx. Default `1` for production speed (~1.0–1.3s total).
// Bump to e.g. 5 to slow the entire choreography for visual QA.
//
// The constant is exported so AssetNode can pull the same value — single
// source of truth so JS-side timings and CSS-side animation-durations
// stay in sync at any multiplier.
export const SLOW_MODE_MULTIPLIER = 10

const _PAN_MS = 400
const _PAN_PAD = 60
const _EDGE_MS = 400
const _CARD_OFFSET_MS = 300
// Phase 9D.2.3 Fix 2: Stage -1 — wait for the Detail Panel slide-out
// transition to complete before starting the unravel. The Detail Panel
// uses `detail-panel-slide-in 200ms ease` (in V2App.jsx); the slide-OUT
// runs the same duration in reverse. 280ms = 200 + 80ms paint buffer.
// Caller passes panelCloseDelay (in ms; this is the default value when
// the option is set to true OR the literal default) — primitive multiplies
// by SLOW_MODE_MULTIPLIER so the wait scales in slow mode.
const _PANEL_CLOSE_MS = 280
// Phase 9D.2.1 Fix 3: split the 900ms-coordinated keyframe into staged
// timings. Held-flag duration = max stage end. Border erasure starts at
// flag-set, runs 600ms; content fade starts at +300ms relative to the
// flag, runs 400ms (so 700ms end); card fade + translate starts at
// +600ms, runs 300ms (900ms end). Plus 80ms paint buffer.
const _HOLD_MS = 980

const STAGE_PAN_MS = Math.round(_PAN_MS * SLOW_MODE_MULTIPLIER)
const STAGE_PAN_PAD = Math.round(_PAN_PAD * SLOW_MODE_MULTIPLIER)
const STAGE_EDGE_MS = Math.round(_EDGE_MS * SLOW_MODE_MULTIPLIER)
const STAGE_CARD_OFFSET_MS = Math.round(_CARD_OFFSET_MS * SLOW_MODE_MULTIPLIER)
const STAGE_HOLD_MS = Math.round(_HOLD_MS * SLOW_MODE_MULTIPLIER)
const STAGE_PANEL_CLOSE_MS = Math.round(_PANEL_CLOSE_MS * SLOW_MODE_MULTIPLIER)

const PAN_TARGET_ZOOM = 1.1
// Phase 9D.2.1 Fix 2: when the Detail Panel is open, the visible canvas
// area is reduced by 480px on the right. The primitive passes this as
// the panelWidthPx hint to V2Canvas's isNodeVisibleInViewport.
const PANEL_WIDTH_PX = 480

/**
 * CSS-side stage durations (used by AssetNode.jsx). Multiply by the same
 * SLOW_MODE_MULTIPLIER so JS waits and CSS animation lengths stay locked.
 * Numeric, in milliseconds.
 */
export const UNRAVEL_DURATIONS = {
  borderMs: Math.round(600 * SLOW_MODE_MULTIPLIER),
  contentFadeMs: Math.round(200 * SLOW_MODE_MULTIPLIER),
  contentBaseDelayMs: Math.round(300 * SLOW_MODE_MULTIPLIER),
  contentStaggerMs: Math.round(50 * SLOW_MODE_MULTIPLIER),
  cardFadeMs: Math.round(300 * SLOW_MODE_MULTIPLIER),
  cardFadeDelayMs: Math.round(600 * SLOW_MODE_MULTIPLIER),
  // Mini-card LOD uses a longer single-stage fade matching the staged
  // total so the disappearance timing is consistent.
  miniCardFadeMs: Math.round(600 * SLOW_MODE_MULTIPLIER),
  miniCardFadeDelayMs: Math.round(300 * SLOW_MODE_MULTIPLIER),
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * Play the unravel animation for a node leaving the canvas.
 *
 * @param {Object}   opts
 * @param {string}   opts.nodeId            The node id to unravel.
 * @param {Object}   opts.canvasRef         React ref to V2Canvas (must expose
 *                                          getNodeWorldPos, isFocusedOnPoint,
 *                                          animatedPanToWithZoom, playEdgeRetract).
 * @param {Function} opts.setUnravelingNodeId  React state setter:
 *                                          (id | null) → void. The setter
 *                                          drives an `_unraveling` flag on
 *                                          the node via v22DataWithReveal,
 *                                          which AssetNode reads to apply
 *                                          the `node-unravel` CSS keyframes.
 * @param {boolean}  [opts.ensureFocused=true]  If true, pan/zoom to the node
 *                                          first (skipped when already focused).
 * @param {boolean}  [opts.waitForPanelClose=false]  Phase 9D.2.3 Fix 2:
 *                                          when true, sleep ~280ms (scaled
 *                                          by SLOW_MODE_MULTIPLIER) before
 *                                          Stage 0 to let a closing Detail
 *                                          Panel slide out — caller is
 *                                          expected to set selection/panel
 *                                          state to null BEFORE invoking the
 *                                          primitive with this option. The
 *                                          delay matches detail-panel-slide-in's
 *                                          200ms reversed + 80ms paint buffer.
 * @param {Function} [opts.onComplete]      Optional callback after all stages
 *                                          settle. Called after the Promise
 *                                          resolves.
 * @returns {Promise<void>}
 */
export async function playUnravelAnimation({
  nodeId,
  canvasRef,
  setUnravelingNodeId,
  ensureFocused = true,
  waitForPanelClose = false,
  onComplete,
}) {
  if (!nodeId) {
    onComplete?.()
    return
  }
  const canvas = canvasRef?.current
  // Phase 9D.2.2 Fix 2: tell V2Canvas's selection-pan effect to suspend
  // for the duration of the unravel. The flag is cleared in the finally
  // block at the bottom of this function so the effect re-arms even if
  // an unexpected error tears down mid-animation.
  canvas?.setUnraveling?.(true)
  try {
  // Phase 9D.2.3 Fix 2: Stage -1 — wait for the Detail Panel slide-out
  // transition. Caller is expected to setSel(null) BEFORE invoking the
  // primitive (so the panel starts closing); this sleep just lets the
  // close animation paint to completion before edges + border begin to
  // animate, eliminating the visual conflict between selection state
  // and the unravel choreography. Scaled by SLOW_MODE_MULTIPLIER like
  // every other timing in this primitive.
  if (waitForPanelClose) {
    await sleep(STAGE_PANEL_CLOSE_MS)
  }
  // Stage 0 — pan/zoom to node (skipped when already on screen).
  // Phase 9D.2.1 Fix 2: visibility-based skip instead of focus-on-point.
  // The Detail Panel offsets the camera so the node sits to the LEFT of
  // the panel — it's clearly visible to the user but not centered on the
  // camera's literal world position. The previous isFocusedOnPoint check
  // measured "is the camera centered on the node?" and always answered
  // false in this scenario, firing a jittery pan that only shifted the
  // node by ~50px. Asking "is the node visible?" instead skips the pan
  // when the user already has the node on screen.
  if (ensureFocused && canvas?.getNodeWorldPos && canvas.animatedPanToWithZoom) {
    const pos = canvas.getNodeWorldPos(nodeId)
    if (pos) {
      const visible = canvas.isNodeVisibleInViewport?.(nodeId, {
        panelWidthPx: PANEL_WIDTH_PX,
      })
      if (!visible) {
        canvas.animatedPanToWithZoom(pos.x, pos.y, PAN_TARGET_ZOOM, STAGE_PAN_MS)
        await sleep(STAGE_PAN_MS + STAGE_PAN_PAD)
      }
    }
  }

  // Stage 1 — edge retract (Three.js). Don't await yet — we want Stage 2-4
  // to start overlapping in CSS while the edges are still retracting.
  const edgeRetractPromise = canvas?.playEdgeRetract
    ? canvas.playEdgeRetract(nodeId, STAGE_EDGE_MS)
    : Promise.resolve()

  // Stages 2-4 — flip the unraveling flag after a short overlap delay.
  // The flag drives three layered CSS animations on the card:
  //   • Stage 2 (border erasure, SVG overlay, ~600ms from flag-set)
  //   • Stage 3 (content stagger fade, ~700ms total from flag-set)
  //   • Stage 4 (card bg + translate, ~300ms starting at +600ms from flag-set)
  // See AssetNode.jsx + index.css for the keyframe definitions.
  await sleep(STAGE_CARD_OFFSET_MS)
  setUnravelingNodeId?.(nodeId)

  // Wait for both to fully complete. STAGE_HOLD_MS already includes the
  // ~80ms paint buffer past the longest sub-stage (card fade ends at
  // +900ms; +80ms ensures the keyframe's final state paints before the
  // node unmounts).
  await Promise.all([
    edgeRetractPromise,
    sleep(STAGE_HOLD_MS),
  ])

  // Clear the flag — at this point the caller will mutate state to remove
  // the artifact. The brief moment between flag-clear and view-builder
  // re-render is imperceptible.
  setUnravelingNodeId?.(null)
  onComplete?.()
  } finally {
    // Phase 9D.2.2 Fix 2: re-arm the selection-pan effect. Runs even if
    // an upstream Promise rejects so the canvas doesn't get permanently
    // locked out of selection panning.
    canvas?.setUnraveling?.(false)
  }
}
