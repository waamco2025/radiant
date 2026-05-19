// Phase 16.2.3 — Directory galactic-view loading animation.
// Phase 17.3.1 — speed + organic-edge + sequential-appearance pass.
//
// Cluster dots fade/scale in via a radial wave emanating from the active
// Actor anchor (canvas-bottom-center). Each dot's `t_start` is its world-
// units distance from the anchor divided by `waveSpeed` (world-units per
// second), plus a per-instance seeded random jitter so the wavefront has
// a jagged organic edge instead of a perfect distance-sorted ring. Once
// the wave reaches a dot it ramps the dot's "appear" factor from 0 → 1
// over `dotFadeMs`. Cluster labels fade in `labelDelayMs` milliseconds
// after the first dot in their cluster appears.
//
// **Phase 17.3.1 semantics shift.** The per-instance value emitted by
// `setDotOpacity` is now interpreted by the consumer as an *appearance
// scale* (per-instance matrix scale factor) rather than a color multiplier.
// At 0, the dot is invisible (scale 0). At 1, the dot is at its final
// world-space size. The intermediate values produce a smooth grow-from-
// nothing animation in the dot's final disclosure-type color, replacing
// the prior color-from-black ramp. RFP markers (squares) participate via
// the new `rfps` + `setRfpAppear` API.
//
// The legacy `opacity` naming is preserved on the callbacks for callsite
// compatibility — the value semantics changed in the consumer, not in
// the helper.
//
// Skip semantics: an empty-canvas click in the DirectoryLayer calls
// `skip()` on the handle returned here. That instantly sets every dot,
// RFP, and label appearance factor to 1.0 and resolves the promise.
// Pan / zoom / dot-click interactions do NOT trigger skip — the animation
// runs on its own timeline, independent of camera state.

// Phase 17.3.1: bumped waveSpeed 4500 → 7000 wu/sec. At canvas 11520×7447
// with anchor at (5760, 5957.6), max radial distance to a corner is
// ~8284 wu — base duration drops from ~1.84s (4500wu/s) to ~1.18s. Add
// the dot fade tail (90ms) + worst-case jitter (200ms) and the perceived
// animation duration sits comfortably in the brief's 1.5–2s target band.
const DEFAULT_WAVE_SPEED = 7000     // world units per second
// Phase 17.3.1: 200 → 90ms. The per-dot ramp is the actual scale-in
// duration; snappier values trade smoothness for the "popping into
// place" feel that fits the dense ~22k-dot field better than a long
// per-dot fade did.
const DEFAULT_DOT_FADE_MS = 90
const DEFAULT_LABEL_DELAY_MS = 100
const LABEL_FADE_MS = 200
// Phase 17.3.1: per-instance random jitter added to each dot's start
// time. Range [0, JITTER_MS]; effective on top of the deterministic
// distance-based start. ~250ms is ~20% of the new base duration —
// produces a clearly jagged wavefront without losing the radial sense.
const DEFAULT_JITTER_MS = 250

// Phase 17.3.1: tiny seeded PRNG (xmur3 hash → mulberry32) so per-session
// jitter is deterministic given a stable seed. Same primitive used in
// v2_2Data.js for procedural Claim names + mock health/badge distributions.
function xmur3(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507)
    h = Math.imul(h ^ (h >>> 13), 3266489909)
    return (h ^= h >>> 16) >>> 0
  }
}
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s |= 0; s = (s + 0x6D2B79F5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Phase 16.2.3 / 16.2.4 / 17.3.1 — galactic-view loading animation.
 *
 * @param {Object} opts
 * @param {Array<{ x:number, y:number }>} opts.dots
 *   Dot world positions. The animation indexes setDotOpacity by the dot's
 *   position in this array.
 * @param {Array<{ x:number, y:number }>} [opts.rfps]
 *   Phase 17.3.1 — RFP marker world positions. Animation indexes
 *   setRfpAppear by the marker's position in this array. Omit / empty
 *   array → no RFP animation. Same wave mechanics as dots.
 * @param {Array<{ party:string, minDistFromAnchor:number }>} opts.labels
 *   Cluster labels with the pre-computed minimum distance from the anchor
 *   among their cluster's dots.
 * @param {Array<{ party:string, distFromAnchor:number }>} [opts.umbrellaOutlines]
 *   Per-cluster umbrella outline paths.
 * @param {{ x:number, y:number }} opts.anchor
 *   Wave origin world position.
 * @param {(idx:number, appear:number) => void} opts.setDotOpacity
 *   Callback invoked when a dot's appearance factor changes. Legacy name;
 *   value is now interpreted as a per-instance scale 0..1 by the consumer.
 * @param {(idx:number, appear:number) => void} [opts.setRfpAppear]
 *   Phase 17.3.1 — RFP appearance scale callback. Same semantics as
 *   `setDotOpacity` but for RFP marker instances.
 * @param {(party:string, opacity:number) => void} opts.setLabelOpacity
 *   Callback invoked when a label's opacity changes.
 * @param {(party:string, opacity:number) => void} [opts.setUmbrellaOpacity]
 *   Callback invoked when an umbrella outline's opacity changes.
 * @param {number} [opts.waveSpeed=7000]   World units per second.
 * @param {number} [opts.dotFadeMs=90]     Per-dot scale-in duration.
 * @param {number} [opts.labelDelayMs=100] Cluster-first-dot → label delay.
 * @param {number} [opts.jitterMs=250]     Max per-instance random start
 *                                          offset (Phase 17.3.1).
 * @param {string} [opts.jitterSeed='']    Seed for jitter PRNG. Pass a
 *                                          stable identifier (e.g. role id +
 *                                          phase counter) so re-renders
 *                                          during a single animation see
 *                                          identical jitter; each session-
 *                                          start re-rolls naturally because
 *                                          callers vary the seed.
 * @returns {{ skip: () => void, promise: Promise<void> }}
 */
export function playDirectoryLoadAnimation({
  dots,
  rfps = [],
  labels,
  umbrellaOutlines = [],
  anchor,
  setDotOpacity,
  setRfpAppear,
  setLabelOpacity,
  setUmbrellaOpacity,
  waveSpeed = DEFAULT_WAVE_SPEED,
  dotFadeMs = DEFAULT_DOT_FADE_MS,
  labelDelayMs = DEFAULT_LABEL_DELAY_MS,
  jitterMs = DEFAULT_JITTER_MS,
  jitterSeed = '',
}) {
  // Defensive: no-dot edge case short-circuits to a resolved promise (also
  // snaps labels + umbrellas + RFPs to fully-appeared).
  if (!dots || dots.length === 0) {
    if (labels) for (const l of labels) setLabelOpacity?.(l.party, 1)
    if (umbrellaOutlines) for (const u of umbrellaOutlines) setUmbrellaOpacity?.(u.party, 1)
    if (rfps) for (let i = 0; i < rfps.length; i++) setRfpAppear?.(i, 1)
    return { skip: () => {}, promise: Promise.resolve() }
  }

  // Phase 17.3.1 — seeded PRNG for per-instance jitter. Stable per session
  // given a stable seed.
  const rand = mulberry32(xmur3(String(jitterSeed || 'directory-load'))())
  const jitterSec = jitterMs / 1000

  // Per-dot start time in seconds (distance/speed + random jitter).
  const dotStart = new Float64Array(dots.length)
  for (let i = 0; i < dots.length; i++) {
    const d = dots[i]
    const dx = d.x - anchor.x
    const dy = d.y - anchor.y
    const base = Math.sqrt(dx * dx + dy * dy) / waveSpeed
    dotStart[i] = base + rand() * jitterSec
  }

  // Per-RFP start time in seconds (same mechanics as dots).
  const rfpStart = new Float64Array(rfps.length)
  for (let i = 0; i < rfps.length; i++) {
    const r = rfps[i]
    const dx = r.x - anchor.x
    const dy = r.y - anchor.y
    const base = Math.sqrt(dx * dx + dy * dy) / waveSpeed
    rfpStart[i] = base + rand() * jitterSec
  }

  // Per-label start time in seconds (first-dot-in-cluster + labelDelayMs).
  const labelEntries = (labels || []).map((l) => ({
    party: l.party,
    startSec: l.minDistFromAnchor / waveSpeed + labelDelayMs / 1000,
  }))

  // Per-umbrella start time uses cluster's distance from anchor.
  const umbrellaEntries = (umbrellaOutlines || []).map((u) => ({
    party: u.party,
    startSec: (u.distFromAnchor ?? 0) / waveSpeed + labelDelayMs / 1000,
  }))

  const dotDone = new Uint8Array(dots.length)
  const rfpDone = new Uint8Array(rfps.length)
  const labelDone = new Uint8Array(labelEntries.length)
  const umbrellaDone = new Uint8Array(umbrellaEntries.length)

  // Initialize everything to 0 up-front (invisible / faded out) so the
  // first frame is blank.
  for (let i = 0; i < dots.length; i++) setDotOpacity?.(i, 0)
  for (let i = 0; i < rfps.length; i++) setRfpAppear?.(i, 0)
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
    for (let i = 0; i < dots.length; i++) {
      if (!dotDone[i]) setDotOpacity?.(i, 1)
    }
    for (let i = 0; i < rfps.length; i++) {
      if (!rfpDone[i]) setRfpAppear?.(i, 1)
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
  const rfpFadeSec = dotFadeMs / 1000
  const labelFadeSec = LABEL_FADE_MS / 1000

  // Phase 17.3.1 — easing curve for the per-instance scale-in. The default
  // linear ramp reads as a "growing dot" but a snappier ease-out feels
  // more like a confident pop-in. Approximates cubic-bezier(0.16, 1, 0.3, 1).
  const easeOut = (t) => 1 - Math.pow(1 - t, 3)

  // Total duration so we know when to stop.
  let maxDotStart = 0
  for (let i = 0; i < dotStart.length; i++) {
    if (dotStart[i] > maxDotStart) maxDotStart = dotStart[i]
  }
  let maxRfpStart = 0
  for (let i = 0; i < rfpStart.length; i++) {
    if (rfpStart[i] > maxRfpStart) maxRfpStart = rfpStart[i]
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
    maxRfpStart + rfpFadeSec,
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
        const u = t / dotFadeSec
        setDotOpacity?.(i, easeOut(u))
      }
    }

    // Update RFPs (Phase 17.3.1).
    for (let i = 0; i < rfps.length; i++) {
      if (rfpDone[i]) continue
      const t = elapsedSec - rfpStart[i]
      if (t <= 0) continue
      if (t >= rfpFadeSec) {
        setRfpAppear?.(i, 1)
        rfpDone[i] = 1
      } else {
        const u = t / rfpFadeSec
        setRfpAppear?.(i, easeOut(u))
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

    // Update umbrella outline opacities.
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
