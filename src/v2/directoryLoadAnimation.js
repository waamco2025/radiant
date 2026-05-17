// Phase 16.2.3 — Directory galactic-view loading animation.
//
// Cluster dots fade in via a radial wave emanating from the active Actor
// anchor (canvas-bottom-center). Each dot's `t_start` is its world-units
// distance from the anchor divided by `waveSpeed` (world-units / second);
// once the wave reaches a dot it ramps from opacity 0 → 1 over `dotFadeMs`.
// Cluster labels fade in `labelDelayMs` milliseconds after the first dot in
// their cluster appears.
//
// The companion in `DirectoryLayer.jsx` translates "dot opacity" into a
// per-instance color multiplier on the Three.js InstancedMesh (since the
// MeshBasicMaterial doesn't support per-instance alpha cleanly, and the
// Directory's background is opaque dark, multiplying the dot's full color
// by `opacity` produces the same visual effect — at opacity 0 the dot
// renders black and blends into `var(--bg-deep)`).
//
// Skip semantics: an empty-canvas click in the DirectoryLayer calls
// `skip()` on the handle returned here. That instantly sets every dot and
// label opacity to 1.0 and resolves the promise. Pan / zoom / dot-click
// interactions do NOT trigger skip — the animation runs on its own
// timeline, independent of camera state.

// Phase 16.2.6.3: 3000 → 4500 wu/sec. At canvas 11520×7447 with anchor at
// (5760, 5957.6), max radial distance to a corner is ~8284 wu — so animation
// duration drops from ~3.0s to ~2.0s. Cleaner pacing for the demo.
const DEFAULT_WAVE_SPEED = 4500     // world units per second
const DEFAULT_DOT_FADE_MS = 200
const DEFAULT_LABEL_DELAY_MS = 100
const LABEL_FADE_MS = 200

/**
 * Phase 16.2.3 / 16.2.4: galactic-view loading animation. Cluster dots fade
 * in via a radial wave emanating from the active Actor anchor. Phase 16.2.4
 * extends the API with `umbrellaOutlines` so the convex-hull umbrella
 * indicator paths fade in alongside their cluster labels.
 *
 * @param {Object} opts
 * @param {Array<{ x:number, y:number }>} opts.dots
 *   Dot world positions. The animation indexes setDotOpacity by the dot's
 *   position in this array.
 * @param {Array<{ party:string, minDistFromAnchor:number }>} opts.labels
 *   Cluster labels with the pre-computed minimum distance from the anchor
 *   among their cluster's dots (so the helper doesn't need to know which
 *   dots belong to which cluster).
 * @param {Array<{ party:string, distFromAnchor:number }>} [opts.umbrellaOutlines]
 *   Phase 16.2.4: per-cluster umbrella outline paths. `distFromAnchor` is
 *   typically the cluster centroid's distance from the wave origin (same
 *   metric as labels). Fade in alongside their cluster label.
 * @param {{ x:number, y:number }} opts.anchor
 *   Wave origin world position (the active Actor's own cluster anchor).
 * @param {(idx:number, opacity:number) => void} opts.setDotOpacity
 *   Callback invoked when a dot's opacity changes.
 * @param {(party:string, opacity:number) => void} opts.setLabelOpacity
 *   Callback invoked when a label's opacity changes.
 * @param {(party:string, opacity:number) => void} [opts.setUmbrellaOpacity]
 *   Phase 16.2.4: callback invoked when an umbrella outline's opacity changes.
 * @param {number} [opts.waveSpeed=3000]   World units per second.
 * @param {number} [opts.dotFadeMs=200]    Per-dot opacity ramp duration.
 * @param {number} [opts.labelDelayMs=100] Delay between first dot in a
 *                                         cluster appearing and the label
 *                                         starting to fade in.
 * @returns {{ skip: () => void, promise: Promise<void> }}
 */
export function playDirectoryLoadAnimation({
  dots,
  labels,
  umbrellaOutlines = [],
  anchor,
  setDotOpacity,
  setLabelOpacity,
  setUmbrellaOpacity,
  waveSpeed = DEFAULT_WAVE_SPEED,
  dotFadeMs = DEFAULT_DOT_FADE_MS,
  labelDelayMs = DEFAULT_LABEL_DELAY_MS,
}) {
  // Defensive: no-dot/no-label edge cases short-circuit to a resolved promise.
  if (!dots || dots.length === 0) {
    if (labels) for (const l of labels) setLabelOpacity?.(l.party, 1)
    if (umbrellaOutlines) for (const u of umbrellaOutlines) setUmbrellaOpacity?.(u.party, 1)
    return { skip: () => {}, promise: Promise.resolve() }
  }

  // Per-dot start time in seconds.
  const dotStart = new Float64Array(dots.length)
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    const dx = d.x - anchor.x
    const dy = d.y - anchor.y
    dotStart[i] = Math.sqrt(dx * dx + dy * dy) / waveSpeed
  }

  // Per-label start time in seconds (first-dot-in-cluster + labelDelayMs).
  const labelEntries = (labels || []).map((l) => ({
    party: l.party,
    startSec: l.minDistFromAnchor / waveSpeed + labelDelayMs / 1000,
  }))

  // Phase 16.2.4: per-umbrella start time uses the cluster's distance from
  // anchor (typically centroid distance), same convention as labels.
  const umbrellaEntries = (umbrellaOutlines || []).map((u) => ({
    party: u.party,
    startSec: (u.distFromAnchor ?? 0) / waveSpeed + labelDelayMs / 1000,
  }))

  // Track completion-per-dot/label/umbrella so we don't call setters on
  // every frame for items already at opacity 1.
  const dotDone = new Uint8Array(dots.length)
  const labelDone = new Uint8Array(labelEntries.length)
  const umbrellaDone = new Uint8Array(umbrellaEntries.length)

  // Initialize everything to opacity 0 up-front so the first frame is blank.
  // (Callers can elide this by pre-seeding zero opacities themselves, but
  // doing it here is safer.)
  for (let i = 0; i < dots.length; i++) setDotOpacity?.(i, 0)
  for (const l of labelEntries) setLabelOpacity?.(l.party, 0)
  for (const u of umbrellaEntries) setUmbrellaOpacity?.(u.party, 0)

  let rafId = 0
  let skipped = false
  let resolved = false
  let resolveFn = null
  const promise = new Promise((res) => { resolveFn = res })

  const finish = () => {
    if (resolved) return
    resolved = true
    if (rafId) cancelAnimationFrame(rafId)
    rafId = 0
    resolveFn?.()
  }

  const skip = () => {
    if (resolved || skipped) return
    skipped = true
    // Snap everything to opacity 1.
    for (let i = 0; i < dots.length; i++) {
      if (!dotDone[i]) setDotOpacity?.(i, 1)
    }
    for (let li = 0; li < labelEntries.length; li++) {
      if (!labelDone[li]) setLabelOpacity?.(labelEntries[li].party, 1)
    }
    for (let ui = 0; ui < umbrellaEntries.length; ui++) {
      if (!umbrellaDone[ui]) setUmbrellaOpacity?.(umbrellaEntries[ui].party, 1)
    }
    finish()
  }

  let startTime = null
  const dotFadeSec = dotFadeMs / 1000
  const labelFadeSec = LABEL_FADE_MS / 1000

  // Total duration so we know when to stop. Worst case: furthest dot.
  let maxDotStart = 0
  for (let i = 0; i < dotStart.length; i++) {
    if (dotStart[i] > maxDotStart) maxDotStart = dotStart[i]
  }
  let maxLabelStart = 0
  for (const l of labelEntries) {
    if (l.startSec > maxLabelStart) maxLabelStart = l.startSec
  }
  let maxUmbrellaStart = 0
  for (const u of umbrellaEntries) {
    if (u.startSec > maxUmbrellaStart) maxUmbrellaStart = u.startSec
  }
  const totalDuration = Math.max(
    maxDotStart + dotFadeSec,
    maxLabelStart + labelFadeSec,
    maxUmbrellaStart + labelFadeSec,
  )

  const tick = (timeMs) => {
    if (resolved) return
    if (startTime === null) startTime = timeMs
    const elapsedSec = (timeMs - startTime) / 1000

    // Update dots.
    for (let i = 0; i < dots.length; i++) {
      if (dotDone[i]) continue
      const t = elapsedSec - dotStart[i]
      if (t <= 0) continue
      if (t >= dotFadeSec) {
        setDotOpacity?.(i, 1)
        dotDone[i] = 1
      } else {
        const opacity = t / dotFadeSec
        setDotOpacity?.(i, opacity)
      }
    }

    // Update labels.
    for (let li = 0; li < labelEntries.length; li++) {
      if (labelDone[li]) continue
      const l = labelEntries[li]
      const t = elapsedSec - l.startSec
      if (t <= 0) continue
      if (t >= labelFadeSec) {
        setLabelOpacity?.(l.party, 1)
        labelDone[li] = 1
      } else {
        const opacity = t / labelFadeSec
        setLabelOpacity?.(l.party, opacity)
      }
    }

    // Update umbrella outline opacities (Phase 16.2.4).
    for (let ui = 0; ui < umbrellaEntries.length; ui++) {
      if (umbrellaDone[ui]) continue
      const u = umbrellaEntries[ui]
      const t = elapsedSec - u.startSec
      if (t <= 0) continue
      if (t >= labelFadeSec) {
        setUmbrellaOpacity?.(u.party, 1)
        umbrellaDone[ui] = 1
      } else {
        const opacity = t / labelFadeSec
        setUmbrellaOpacity?.(u.party, opacity)
      }
    }

    if (elapsedSec >= totalDuration) {
      finish()
      return
    }
    rafId = requestAnimationFrame(tick)
  }

  rafId = requestAnimationFrame(tick)

  return { skip, promise }
}
