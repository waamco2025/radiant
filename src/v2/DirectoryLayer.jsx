// DirectoryLayer — Phase 16.1.3 (parent-parity + color scheme + lifecycle).
//
// Builds on Phase 16.1.0–16.1.2:
//   • Three.js scene + InstancedMesh dots + Points grid (16.1.0)
//   • L-shape boundary around umbrella subset (16.1.1)
//   • Spatial model rewrite — no corner card; user cluster center-bottom-third;
//     Actor squares migrated to Three.js (16.1.2)
//
// Phase 16.1.3 changes:
//   • Item 1: first-transition dot lifecycle hardened. InstancedMesh setup
//     moved to `useLayoutEffect`. Transition-end listener on the wipe
//     container forces a render after the clip-path animation completes.
//     Dots persist correctly across hard-reload → first-open and across
//     rapid open/close cycles.
//   • Item 2: Actor square rendered as `THREE.Mesh` with hollow
//     `ShapeGeometry` (outer square + inner hole), so the border thickness
//     scales naturally with camera zoom.
//   • Item 3: Actor square's cell is reserved before umbrella/public/RFP
//     placement so no dot overlaps the square.
//   • Item 4: zoom controls vertical position bumped below the chrome bar
//     (top: 73 instead of 12) to match parent layer's apparent position.
//   • Item 6: clicking a dot animates the camera to center the dot in the
//     visible area (minus the Detail Panel's width on the right), mirroring
//     parent-layer pan-to-center.
//   • Item 8: dot colors now map to disclosure TYPE (full → indigo,
//     selective → amber, proof-only → green), not visibility scope.
//     L-shape boundary around umbrella subset is now neutral grey rather
//     than amber.
//   • Item 9: RFP rendered as hollow circle in cyan, border scales with
//     zoom (same pattern as Item 2's Actor square).

import { useEffect, useState, useMemo, useRef, useCallback, useLayoutEffect } from 'react'
import * as THREE from 'three'
import { Delaunay } from 'd3-delaunay'
import { buildV22DirectoryDataForRole, buildV22SharedArtifacts, mergeProvisionals } from './v2_2Data.js'
import { playDirectoryLoadAnimation } from './directoryLoadAnimation.js'
// Phase 16.2.7: reuse parent-canvas card components verbatim for the LOD
// swap. AssetNode = full-size card (210×96 px). AssetNodeMini = compact
// card (160×48 px). Both exported from AssetNode.jsx. The dimension
// constants (CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H) are file-internal
// there; we mirror them in this file as a sync'd duplicate (see the
// LOD_THRESHOLD constants block below).
import AssetNode, { AssetNodeMini } from './AssetNode.jsx'

// ─── Layout constants (world units) ────────────────────────────────────
// Phase 16.2.5 — Grid alignment + dot rendering hotfix.
//   • DOT_GRID was 12 in Phase 16.2.4. Background grid (THREE.Points)
//     rendered at GRID_SPACING = 48 = 4×DOT_GRID, so cluster-dot snap
//     produced sub-cell offsets every 4 cells. Reconciled to G = 48 so
//     every cluster dot snaps to a background-grid intersection.
//   • DOT_RADIUS bumped to DOT_GRID × 0.425 (= 20.4): dots fill ~85% of
//     their grid cell, leaving a thin 7.5% gap on each side. Was 3 wu —
//     barely visible at 15% default zoom (0.45 screen px).
const DOT_GRID = 48
// Phase 16.2.6.2: dot-render baseline lowered 0.475 → 0.425 (diameter
// 0.95 → 0.85 × DOT_GRID). The base geometry sits at this unscaled size;
// the per-frame `computeDotWorldSize(zoom)` helper applies a uniform
// scale on the InstancedMesh to enforce the 22-px on-screen cap above
// the cap-threshold zoom (~0.54). At zoom ≤ cap-threshold the scale is
// 1.0; at higher zoom the scale shrinks the dots so their on-screen
// pixel size stays at MAX_SCREEN_DOT_PX. See computeDotWorldSize below.
const BASE_DOT_FACTOR = 0.70                           // 16.2.7: 0.85 → 0.70 — slimmer dots in linear regime
const MAX_SCREEN_DOT_PX = 22                           // on-screen size cap at high zoom
const DOT_RADIUS = DOT_GRID * BASE_DOT_FACTOR / 2      // 20.4 — geometry radius at zoom ≤ cap-threshold
const ACTOR_SQUARE = 6
const ACTOR_BORDER = 1                // hollow square border thickness (world units)
// Phase 16.2.6.3 baseline + Phase 16.2.6.6 rewrite. RFP marker is now a
// tinted-fill hollow square (indigo) that scales with zoom on the same
// curve as cluster dots — linear below cap, fixed on-screen size above.
//   • BASE_RFP_FACTOR matches dots' 0.85 → 0.95 lineage choice; squares
//     leave a ~5% inter-cell gap at adjacent grid positions so adjacent
//     RFP markers in a dense pack no longer overlap (16.2.6.5 fix).
//   • MAX_SCREEN_RFP_PX = 22 matches the dot cap so dots & squares are
//     visually comparable at every zoom.
//   • RFP_FILL_ALPHA puts a low-opacity indigo plane behind the outline
//     so the marker reads as filled rather than as an empty rectangle.
const BASE_RFP_FACTOR = 0.80                           // 16.2.7: 0.95 → 0.80 — parallel reduction
const MAX_SCREEN_RFP_PX = 22
const RFP_FILL_ALPHA = 0.15
const RFP_BASE_OUTER = DOT_GRID * BASE_RFP_FACTOR        // 45.6 wu — base outer at unscaled zoom
// Kept as an alias for label-positioning formulas elsewhere in the file
// that read RFP_OUTER_SIZE; safe because the new base is the same scale
// shape (square outer at constant world size for layout purposes).
const RFP_OUTER_SIZE = RFP_BASE_OUTER

const RFP_BORDER_SCREEN_PX = 2
// Initial border (world units) sized for INITIAL_ZOOM 0.15 at scale 1.0.
// The geometry-rebuild useEffect updates this to
// `RFP_BORDER_SCREEN_PX / (scale × zoom)` whenever zoom changes.
const RFP_BORDER = RFP_BORDER_SCREEN_PX / 0.15           // ≈ 13.3 wu
const ROW_GAP = DOT_GRID
const COL_GAP = DOT_GRID
const ACTOR_LABEL_OFFSET = 18
const TOOLTIP_W = 230
const TOOLTIP_OFFSET = 12

// Phase 16.2.4: bounded canvas at 16" MBP logical resolution × (1/0.15).
// Default zoom 0.15 → full canvas fills the MBP viewport. Smaller area than
// 16.2.3 (11520×7447 vs 17280×11170) yields denser-feeling clusters at the
// current seed size and reduces the dot-count target for Phase 16.2.5.
const CANVAS_WIDTH = 11520
const CANVAS_HEIGHT = 7447
const OWN_CLUSTER_ANCHOR_X = CANVAS_WIDTH / 2          // 5760
const OWN_CLUSTER_ANCHOR_Y = CANVAS_HEIGHT * 0.8       // 5957.6 — 20% up from bottom

// ─── Camera / zoom constants ───────────────────────────────────────────
// Phase 16.2.4: galactic-view default — load fully zoomed out (0.15 = 15%)
// so the whole 11520×7447 canvas fits in the viewport.
const MIN_ZOOM = 0.15
// Phase 16.2.6.2: 4.0 → 1.5 — capped at 150% because dot-LOD reveals no
// new detail beyond that point.
// Phase 16.2.7: 1.5 → 5.0 — re-opens the zoom range to make room for the
// mini-card LOD (zoom ≥ 3.333) and full-card LOD (zoom ≥ 4.375) swaps.
// MAX_ZOOM 5.0 leaves ~14% headroom above the full-card threshold.
const MAX_ZOOM = 5.0

// Phase 16.2.7: LOD swap thresholds. At zoom ≥ MID_LOD_THRESHOLD, dot
// InstancedMesh hides and AssetNodeMini overlays render at each Claim
// dot's screen position (no scale transform — natural 160×48 px). At
// zoom ≥ LOD_THRESHOLD, AssetNodeMini swaps to full-size AssetNode
// (210×96 px). Thresholds derived from the density invariant: cards
// fit horizontally when `zoom × DOT_GRID ≥ card_width_px`.
//
// Card dimensions mirrored from AssetNode.jsx (CARD_W / CARD_H /
// MINI_CARD_W / MINI_CARD_H). Those constants are file-internal there
// (no `export` keyword) and the phase brief's hard rule forbids
// modifying AssetNode.jsx, so we mirror the values here. If AssetNode's
// dimensions ever change, this block needs to be kept in sync.
const CARD_W = 210
const CARD_H = 96
const MINI_CARD_W = 160
const MINI_CARD_H = 48
const MID_LOD_THRESHOLD = MINI_CARD_W / DOT_GRID       // 160 / 48 = 3.333…
const LOD_THRESHOLD = CARD_W / DOT_GRID                // 210 / 48 = 4.375
const INITIAL_ZOOM = 0.15
// Phase 16.2.6.2: Voronoi-domain insets shrink the tessellation
// rectangle inward from the full canvas bounds. Left/right reserve a
// 1-cell buffer so cluster dots aren't visibly cut off at the canvas
// edge. Top/bottom reserve world-space equivalent to the app header
// (~61 css px) + footer legend (~32 css px) at MIN_ZOOM (the worst
// case — at higher zoom the chrome occupies less world area).
// Phase 16.2.6.3: TOP tightened 500 → 475 = `64 css px / 0.15` (header
// world height at MIN_ZOOM) + 1 × DOT_GRID (visible-buffer parity with
// the L/R 1-dot edge buffer). Static value used instead of dynamic
// measurement so the Directory layout pipeline doesn't depend on
// parent-component DOM mount order.
const DOMAIN_INSET_LEFT = DOT_GRID
const DOMAIN_INSET_RIGHT = DOT_GRID
const DOMAIN_INSET_TOP = 475
const DOMAIN_INSET_BOTTOM = 250
// Phase 16.2.5: background-grid spacing now equals DOT_GRID (was 4×DOT_GRID
// pre-reconciliation). Same point count as before because DOT_GRID grew
// 12 → 48 in lockstep — the visible grid spacing is unchanged in world
// units (still 48 wu between adjacent grid dots), the cluster snap simply
// matches it now.
const GRID_SPACING = DOT_GRID
const GRID_MARGIN = 600
const DRAG_THRESHOLD_PX = 4
const PANEL_W = 480                   // Detail Panel width — mirrors V2App's PANEL_W

// Phase 16.2.6.1: cluster dot placement primitives.
// Each cluster's N dots are placed via dense Voronoi-clipped grid fill
// (replaces the Phase 16.2.4 Vogel sunflower phyllotaxis): the cluster's
// Voronoi polygon is shrunk inward by 1 DOT_GRID, every grid cell inside
// the shrunken polygon is enumerated (except cells inside the label hole),
// cells are sorted by distance from cluster center, and the first N are
// filled. The 2-cell inter-cluster buffer falls out naturally — both
// adjacent clusters shrink their polygon by 1 cell, so the gap between
// the last dot of one and the first of the next is 2 × DOT_GRID.
const LABEL_HOLE_W = 6 * DOT_GRID                      // 288 world units (was 72 pre-16.2.5)
const LABEL_HOLE_H = 3 * DOT_GRID                      // 144 (was 36)
const CLUSTER_SHRINK_CELLS = 1                         // 16.2.6.1: inward shrink in DOT_GRID units; both sides = 2 cell gap
// Phase 16.2.6.1: Lloyd's target area formula factors.
const LABEL_HOLE_AREA = LABEL_HOLE_W * LABEL_HOLE_H    // 6×3 cells of DOT_GRID²
const BUFFER_OVERHEAD_FACTOR = 1.20                    // dense-pack inefficiency + label-hole corner + Lloyd's wobble
// Lloyd-iterated centroidal Voronoi tessellation parameters.
// Phase 16.2.6: 10 → 20. At 52 seeds (35 new mock + 12 existing + 4 switchable +
// Radiant Network anchor) Lloyd's needs more iterations to converge cell areas
// to the target distribution. 16.2.5 reported ~194 wu residual at 12 actors;
// extra headroom helps the denser tessellation reach DOT_GRID-scale residual.
const LLOYD_MAX_ITER = 20
const LLOYD_CONVERGENCE_DELTA = DOT_GRID               // converged when max displacement < this

// Phase 16.1.3 Item 2 + 9: max InstancedMesh capacity for stable lifecycle.
// Phase 16.2.6.1: 10000 → 25000. Phase 16.2.6.1's seed targets 21,609 dots
// (21,435 new mock + 157 existing mock + 17 switchable role Claims).
// Headroom keeps the lifecycle constant stable across future expansions.
const MAX_DOTS = 25000
const MAX_SQUARES = 64
const MAX_RFPS = 256

// ─── Helpers ───────────────────────────────────────────────────────────
function snapGrid(v) { return Math.round(v / DOT_GRID) * DOT_GRID }

/**
 * Phase 16.2.6.2: compute the world-space dot render diameter for a given
 * zoom level. Below the cap threshold (where on-screen size ≤ MAX_SCREEN_DOT_PX)
 * dots are at their unscaled `DOT_GRID × BASE_DOT_FACTOR` world diameter and
 * scale linearly with zoom on screen. Above the cap threshold the on-screen
 * size stays fixed at MAX_SCREEN_DOT_PX, so the returned world diameter
 * shrinks inversely with zoom. Cap threshold ≈ MAX_SCREEN_DOT_PX / (DOT_GRID
 * × BASE_DOT_FACTOR) ≈ 0.54 at the current constants.
 */
function computeDotWorldSize(zoom) {
  const linearScreenSize = DOT_GRID * BASE_DOT_FACTOR * zoom
  const cappedScreenSize = Math.min(linearScreenSize, MAX_SCREEN_DOT_PX)
  return cappedScreenSize / zoom
}

/**
 * Phase 16.2.6.6: parallel helper for RFP marker outer size — same curve
 * as `computeDotWorldSize` but with the RFP constants. Cap threshold ≈
 * MAX_SCREEN_RFP_PX / (DOT_GRID × BASE_RFP_FACTOR) ≈ 0.48 at the current
 * constants (slightly below the dot cap threshold of 0.54 because RFP
 * markers are sized 0.95 vs dots' 0.85, so they hit the cap sooner).
 */
function computeRfpWorldSize(zoom) {
  const linearScreenSize = DOT_GRID * BASE_RFP_FACTOR * zoom
  const cappedScreenSize = Math.min(linearScreenSize, MAX_SCREEN_RFP_PX)
  return cappedScreenSize / zoom
}

// Phase 16.2.6.3: zoom-aware cluster-label font size. Labels grow slowly
// with zoom (sqrt) so they stay readable at low zoom and substantial — but
// not overwhelming — at high zoom. Clamped to MIN/MAX so the pillbox doesn't
// vanish or eat the label hole.
const BASE_LABEL_FONT_PX = 14
const MIN_LABEL_FONT_PX = 11
const MAX_LABEL_FONT_PX = 18
function computeLabelFontSize(zoom) {
  const scaled = BASE_LABEL_FONT_PX * Math.sqrt(zoom)
  return Math.max(MIN_LABEL_FONT_PX, Math.min(MAX_LABEL_FONT_PX, scaled))
}

// Phase 16.2.6.4: z-order cluster labels so smaller clusters render on top
// of larger ones — guarantees small clusters' labels stay readable when
// they collide with bigger neighbors. The largest cluster gets the lowest
// z-rank (Z_BASE_CLUSTER_LABEL); each successive smaller cluster gets +1.
// RFP owner-actor labels always render above all cluster labels (functionally
// "smaller than the smallest cluster" — they belong to single markers).
const Z_BASE_CLUSTER_LABEL = 100
const Z_RFP_LABEL = Z_BASE_CLUSTER_LABEL + 1000   // 1100 — clear of any plausible cluster z-rank

function cssVarToColor(varName, fallback = '#8888ff') {
  if (typeof window === 'undefined') return new THREE.Color(fallback)
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
    if (!v) return new THREE.Color(fallback)
    return new THREE.Color(v)
  } catch (_e) {
    return new THREE.Color(fallback)
  }
}

// Phase 16.1.3 Item 8: disclosure-type → color mapping.
function disclosureTypeToColorVar(type) {
  if (type === 'selective') return '--accent-amber'
  if (type === 'proofonly') return '--accent-green'
  return '--accent-indigo' // 'full' or default
}

function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0) || 1
}

// ─── Phase 16.1.3 Item 2 + 9: hollow shape geometry helpers ────────────
function makeHollowSquareGeometry(outerSize, borderThickness) {
  const half = outerSize / 2
  const innerHalf = half - borderThickness
  const shape = new THREE.Shape()
  shape.moveTo(-half, -half)
  shape.lineTo(half, -half)
  shape.lineTo(half, half)
  shape.lineTo(-half, half)
  shape.lineTo(-half, -half)
  const hole = new THREE.Path()
  hole.moveTo(-innerHalf, -innerHalf)
  hole.lineTo(innerHalf, -innerHalf)
  hole.lineTo(innerHalf, innerHalf)
  hole.lineTo(-innerHalf, innerHalf)
  hole.lineTo(-innerHalf, -innerHalf)
  shape.holes.push(hole)
  return new THREE.ShapeGeometry(shape)
}

function makeHollowCircleGeometry(outerRadius, borderThickness, segments = 32) {
  const innerRadius = outerRadius - borderThickness
  const shape = new THREE.Shape()
  shape.moveTo(outerRadius, 0)
  shape.absarc(0, 0, outerRadius, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.moveTo(innerRadius, 0)
  hole.absarc(0, 0, innerRadius, 0, Math.PI * 2, true)
  shape.holes.push(hole)
  return new THREE.ShapeGeometry(shape, segments)
}

// ─── Tooltip card (3 rows: badge + name + owner) ───────────────────────
function ClaimTooltipCard({ claim, x, y, viewportW }) {
  const wouldClipRight = x + DOT_RADIUS + TOOLTIP_OFFSET + TOOLTIP_W > (viewportW || 1280) - 16
  const anchorX = wouldClipRight
    ? x - DOT_RADIUS - TOOLTIP_OFFSET
    : x + DOT_RADIUS + TOOLTIP_OFFSET
  return (
    <div
      style={{
        position: 'absolute',
        left: anchorX,
        top: y,
        width: TOOLTIP_W,
        transform: wouldClipRight ? 'translate(-100%, -50%)' : 'translateY(-50%)',
        padding: '10px 14px 12px 14px',
        borderRadius: 8,
        background: 'var(--bg-card)',
        border: '1px solid color-mix(in srgb, var(--accent-indigo) 35%, var(--border))',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        // 2026-05-17 follow-up: bumped 30 → 2500 so the dot tooltip card
        // renders above cluster Actor labels (z=100-175 per Phase 16.2.6.4),
        // RFP owner labels (z=1100), and the RADIANT NETWORK header pillbox
        // (z=2000), while staying below Detail Panels / modals (5900+).
        zIndex: 2500,
      }}
    >
      <span style={{
        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
        color: 'var(--text-tertiary)', background: 'var(--bg-raised)',
        display: 'inline-block', marginBottom: 6,
      }}>CLAIM</span>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{claim.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{claim.owner}</div>
    </div>
  )
}

// Phase 17.0.1: RFP-flavoured tooltip pinned near the click point at
// low zoom (dot-LOD; below MID_LOD_THRESHOLD). Mirror of ClaimTooltipCard
// but type label reads "RFP" and the body shows name + owner. Shares
// positioning + clip-right anchoring logic so the visual feels identical
// across the two artifact types.
function RfpTooltipCard({ rfp, x, y, viewportW }) {
  const wouldClipRight = x + DOT_RADIUS + TOOLTIP_OFFSET + TOOLTIP_W > (viewportW || 1280) - 16
  const anchorX = wouldClipRight
    ? x - DOT_RADIUS - TOOLTIP_OFFSET
    : x + DOT_RADIUS + TOOLTIP_OFFSET
  return (
    <div
      style={{
        position: 'absolute',
        left: anchorX,
        top: y,
        width: TOOLTIP_W,
        transform: wouldClipRight ? 'translate(-100%, -50%)' : 'translateY(-50%)',
        padding: '10px 14px 12px 14px',
        borderRadius: 8,
        background: 'var(--bg-card)',
        border: '1px solid color-mix(in srgb, var(--accent-indigo) 35%, var(--border))',
        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        pointerEvents: 'none',
        zIndex: 2500,
      }}
    >
      <span style={{
        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
        color: 'var(--text-tertiary)', background: 'var(--bg-raised)',
        display: 'inline-block', marginBottom: 6,
      }}>RFP</span>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600,
        color: 'var(--text-primary)', lineHeight: 1.3, marginBottom: 4,
        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{rfp.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{rfp.owner}</div>
    </div>
  )
}

function PillboxLabel({ ownerParty, x, y, faded, opacity = 1, fontPx = 11, zIndex = 4 }) {
  // Phase 16.2.3: outer opacity multiplies the loaded fade-in opacity (0..1
  // during the wave animation, then 1 thereafter) with the existing
  // hover-pillbox-fade behaviour (faded = 0.25 when a dot is hovered near
  // the pillbox).
  // Guard against the brief window during initial mount when the camera /
  // renderer aren't ready yet — worldToScreen returns NaN if the camera's
  // projection matrix hasn't been computed against a non-zero viewport.
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null
  const hoverFade = faded ? 0.25 : 1
  return (
    <div
      data-actor-pillbox={ownerParty}
      style={{
        position: 'absolute',
        left: x,
        // Phase 16.2.4: label centered inside cluster (occupies the
        // reserved 6×3 cell label hole). Previously sat above the
        // Actor square at top = y - ACTOR_SQUARE/2 - ACTOR_LABEL_OFFSET;
        // the Actor square has been retired in this phase.
        top: y,
        // Phase 16.2.6.3: flex-centered text + em-relative padding +
        // lineHeight 1 so the pill scales proportionally with fontPx and
        // the text reads vertically + horizontally centered at any zoom
        // (the off-center drift QA saw at zoom 1.5 was a stacked effect of
        // font ascender/descender pushing text upward inside fixed-pixel
        // padding; lineHeight: 1 + em-padding flattens that).
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.3em 0.7em',
        lineHeight: 1,
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--bg-card) 92%, var(--text-dim))',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: fontPx,
        fontWeight: 600,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        opacity: opacity * hoverFade,
        // Skip the transition while the load-in animation drives opacity
        // (between 0 and 1 exclusive) — the helper applies its own ramp
        // each frame, and a CSS transition would smear it.
        transition: opacity >= 1 ? 'opacity 150ms ease' : 'none',
        pointerEvents: 'none',
        // Phase 16.2.6.4: caller-driven z so smaller clusters render on
        // top of larger ones (and RFP labels render on top of everything).
        zIndex,
      }}
    >{ownerParty}</div>
  )
}

const PILLBOX_W = 64
const PILLBOX_H = 16
// ─── Phase 16.2.4 geometry helpers ────────────────────────────────────
//
// Inline polygon utilities for the Voronoi tessellation pipeline. Imported
// here rather than via a third-party polygon library — each function is
// short and the dependency surface is kept minimal.

function polygonArea(poly) {
  let s = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    s += (poly[j][0] + poly[i][0]) * (poly[j][1] - poly[i][1])
  }
  return s * 0.5
}

function polygonCentroid(poly) {
  let cx = 0, cy = 0, a = 0
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = poly[j][0] * poly[i][1] - poly[i][0] * poly[j][1]
    cx += (poly[j][0] + poly[i][0]) * f
    cy += (poly[j][1] + poly[i][1]) * f
    a += f
  }
  a *= 0.5
  if (Math.abs(a) < 1e-9) {
    // Degenerate polygon — fall back to vertex average.
    cx = poly.reduce((s, p) => s + p[0], 0) / poly.length
    cy = poly.reduce((s, p) => s + p[1], 0) / poly.length
    return [cx, cy]
  }
  return [cx / (6 * a), cy / (6 * a)]
}

function pointInPolygon(x, y, poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1]
    const xj = poly[j][0], yj = poly[j][1]
    const intersect = ((yi > y) !== (yj > y)) &&
      (x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

// Andrew's monotone-chain convex hull. Returns vertices in counter-clockwise
// order (or empty array when fewer than 3 unique points are supplied).
function convexHull(points) {
  if (points.length < 3) return [...points]
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop()
    }
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop()
    }
    upper.push(p)
  }
  lower.pop()
  upper.pop()
  return lower.concat(upper)
}

// Offset a polygon outward by `dist` world units. Uses the per-vertex
// bisector normal — works for the convex polygons we produce (from
// convexHull above). Returns a new polygon.
function offsetPolygonOutward(poly, dist) {
  if (poly.length < 3) return [...poly]
  // Ensure CCW orientation so outward bisectors point outward.
  const a = polygonArea(poly)
  const oriented = a < 0 ? [...poly].reverse() : poly
  const n = oriented.length
  const out = []
  for (let i = 0; i < n; i++) {
    const prev = oriented[(i - 1 + n) % n]
    const cur = oriented[i]
    const next = oriented[(i + 1) % n]
    // Inward edges (cur - prev) and (next - cur); outward normal is the
    // bisector of their outward-pointing perpendiculars.
    const e1x = cur[0] - prev[0], e1y = cur[1] - prev[1]
    const e2x = next[0] - cur[0], e2y = next[1] - cur[1]
    const len1 = Math.hypot(e1x, e1y) || 1
    const len2 = Math.hypot(e2x, e2y) || 1
    // Outward perpendiculars (right-hand, for CCW polygons).
    const n1x = e1y / len1, n1y = -e1x / len1
    const n2x = e2y / len2, n2y = -e2x / len2
    let bx = n1x + n2x
    let by = n1y + n2y
    const blen = Math.hypot(bx, by) || 1
    bx /= blen
    by /= blen
    // Miter length: dist / cos(half-angle). cos(half-angle) = dot(n1, b).
    const cosHalf = Math.max(0.2, n1x * bx + n1y * by)
    const miter = dist / cosHalf
    out.push([cur[0] + bx * miter, cur[1] + by * miter])
  }
  return out
}

// Clip a polygon to the canvas rectangle (Sutherland–Hodgman). The Voronoi
// cells from d3-delaunay are already clipped via the bounding box passed
// to `delaunay.voronoi([0,0,W,H])`, but extra clipping is cheap insurance
// against numerical edge cases.
function clipPolygonToRect(poly, x0, y0, x1, y1) {
  let out = poly
  const clip = (input, edge) => {
    const result = []
    for (let i = 0, j = input.length - 1; i < input.length; j = i++) {
      const a = input[j], b = input[i]
      const aIn = edge(a), bIn = edge(b)
      if (aIn && bIn) result.push(b)
      else if (aIn && !bIn) result.push(intersect(a, b, edge))
      else if (!aIn && bIn) { result.push(intersect(a, b, edge)); result.push(b) }
    }
    return result
  }
  const intersect = (a, b, _edge) => {
    // Walk parametrically t∈[0,1] and find the t where edge() flips sign.
    // For axis-aligned edges this is exact.
    return [(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]  // fallback midpoint (rarely hit)
  }
  out = clip(out, (p) => p[0] >= x0)
  out = clip(out, (p) => p[0] <= x1)
  out = clip(out, (p) => p[1] >= y0)
  out = clip(out, (p) => p[1] <= y1)
  return out
}
void clipPolygonToRect  // reserved for future use

// ── Phase 16.2.6.1: dense Voronoi-clipped grid fill ──────────────────────
// Inward offset of a convex polygon by `distance`. Voronoi cells from
// d3-delaunay are always convex (and returned closed, last vertex == first).
// Detects orientation via signed area so the shrink moves *inward* regardless
// of cell winding. Returns the shrunken polygon as an open vertex list, or
// an empty array if the shrink collapsed the polygon (cluster cell too thin
// for the buffer at the current Lloyd's convergence).
function shrinkConvexPolygon(poly, distance) {
  if (!poly || poly.length < 3) return []
  // d3-delaunay closes its polygons; drop the duplicate trailing vertex if
  // present so prev/next neighbour math doesn't double-count.
  const last = poly[poly.length - 1]
  const first = poly[0]
  const open = (last && first && last[0] === first[0] && last[1] === first[1])
    ? poly.slice(0, -1)
    : poly
  if (open.length < 3) return []
  // Orient CCW so the inward normal is consistent. `polygonArea` returns
  // positive for CCW; negative ⇒ flip.
  const a = polygonArea(open)
  const oriented = a < 0 ? [...open].reverse() : open
  const n = oriented.length
  const result = []
  for (let i = 0; i < n; i++) {
    const prev = oriented[(i - 1 + n) % n]
    const curr = oriented[i]
    const next = oriented[(i + 1) % n]
    const e1x = curr[0] - prev[0], e1y = curr[1] - prev[1]
    const e2x = next[0] - curr[0], e2y = next[1] - curr[1]
    const len1 = Math.hypot(e1x, e1y)
    const len2 = Math.hypot(e2x, e2y)
    if (len1 < 1e-6 || len2 < 1e-6) continue
    // Inward normals for CCW edges are 90° clockwise rotation of the edge
    // direction: n = (e_y, -e_x) / len.
    const n1x = e1y / len1, n1y = -e1x / len1
    const n2x = e2y / len2, n2y = -e2x / len2
    const bx = n1x + n2x, by = n1y + n2y
    const blen = Math.hypot(bx, by)
    if (blen < 1e-6) continue
    const cosTheta = (n1x * bx + n1y * by) / blen
    if (cosTheta < 0.2) continue  // very acute angle — would project too far
    const miter = distance / cosTheta
    result.push([curr[0] + (bx / blen) * miter, curr[1] + (by / blen) * miter])
  }
  return result.length >= 3 ? result : []
}

/**
 * Phase 16.2.6.1: dense Voronoi-clipped grid fill replaces Vogel sunflower.
 * Tiles grid cells inside the cluster's Voronoi polygon (shrunken by 1 DOT_GRID
 * to leave a 2-cell inter-cluster buffer), excluding the label hole at cluster
 * center, sorted by distance from center, taking the first N cells.
 *
 * Returns positions for the N closest available cells; if fewer than N cells
 * are available (Voronoi cell too small at current Lloyd's convergence) the
 * caller logs an overflow warning so we know which cluster overflowed.
 */
function packClusterDense({ cellPoly, centerX, centerY, count, clusterParty }) {
  // Phase 16.2.6.1 pinned convention: if shrink collapses (cell too thin
  // for a 1-cell inward offset — happens when Lloyd's hasn't pushed jumbo
  // neighbours away enough to give the small cluster real area), fall back
  // to the unshrunk Voronoi cell. This produces a 1-cell inter-cluster gap
  // (vs. the usual 2-cell gap) instead of dropping the cluster entirely.
  let poly = shrinkConvexPolygon(cellPoly, CLUSTER_SHRINK_CELLS * DOT_GRID)
  if (poly.length < 3) {
    if (cellPoly && cellPoly.length >= 3 && typeof console !== 'undefined') {
      // eslint-disable-next-line no-console
      console.warn(`[DirectoryLayer] packClusterDense: shrink collapsed for ${clusterParty}; falling back to unshrunken cell (1-cell buffer instead of 2).`)
    }
    poly = cellPoly && cellPoly.length >= 3 ? cellPoly : []
  }
  if (poly.length < 3) return []
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const [px, py] of poly) {
    if (px < minX) minX = px
    if (px > maxX) maxX = px
    if (py < minY) minY = py
    if (py > maxY) maxY = py
  }
  const halfHoleW = LABEL_HOLE_W / 2
  const halfHoleH = LABEL_HOLE_H / 2
  // Snap to the same grid origin used by snapGrid so cluster dots align with
  // the background-grid Points and with cluster-to-cluster gaps measured in
  // whole cells.
  const xStart = Math.ceil(minX / DOT_GRID) * DOT_GRID
  const yStart = Math.ceil(minY / DOT_GRID) * DOT_GRID
  const cells = []
  for (let x = xStart; x <= maxX; x += DOT_GRID) {
    for (let y = yStart; y <= maxY; y += DOT_GRID) {
      if (Math.abs(x - centerX) < halfHoleW && Math.abs(y - centerY) < halfHoleH) continue
      if (!pointInPolygon(x, y, poly)) continue
      const dx = x - centerX
      const dy = y - centerY
      cells.push({ x, y, dist: dx * dx + dy * dy })
    }
  }
  cells.sort((a, b) => a.dist - b.dist)
  return cells.slice(0, count).map((c) => ({ x: c.x, y: c.y }))
}

// Build the per-cluster umbrella outline path. Concave-hull would be the
// preferred shape but the canonical `concaveman` algorithm requires another
// dep — for the current cluster sizes the convex hull is visually clean.
// Fallback for <3 dots: bounding circle approximated as a 24-sided polygon.
function umbrellaOutlinePath(umbrellaDots) {
  if (!umbrellaDots || umbrellaDots.length === 0) return null
  const points = umbrellaDots.map((d) => [d.x, d.y])
  if (points.length === 1) {
    const [cx, cy] = points[0]
    const r = DOT_GRID + DOT_RADIUS + DOT_GRID  // +1 cell margin
    const segs = 24
    const ring = []
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2
      ring.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
    }
    return ring
  }
  if (points.length === 2) {
    // Stadium (capsule) approximation via convex-hull of two circles.
    const [a, b] = points
    const r = DOT_RADIUS + DOT_GRID
    const segs = 24
    const ring = []
    for (let i = 0; i < segs; i++) {
      const t = (i / segs) * Math.PI * 2
      ring.push([a[0] + r * Math.cos(t), a[1] + r * Math.sin(t)])
      ring.push([b[0] + r * Math.cos(t), b[1] + r * Math.sin(t)])
    }
    return convexHull(ring)
  }
  const hull = convexHull(points)
  return offsetPolygonOutward(hull, DOT_GRID)
}

function isHoverNearPillbox(hoverScreen, pillX, pillY) {
  if (!hoverScreen) return false
  const dotR = 3
  const dotL = hoverScreen.x - dotR, dotR_ = hoverScreen.x + dotR
  const dotT = hoverScreen.y - dotR, dotB = hoverScreen.y + dotR
  const pL = pillX - PILLBOX_W / 2, pR = pillX + PILLBOX_W / 2
  const pT = pillY - PILLBOX_H / 2, pB = pillY + PILLBOX_H / 2
  return !(dotR_ < pL || dotL > pR || dotB < pT || dotT > pB)
}

// ─── Layout: world-coord positions per cluster ─────────────────────────
function computeLayout(directoryData, viewport) {
  if (!directoryData) return null

  // Phase 16.2.4 baseline + Phase 16.2.6.1 dense-pack rewrite:
  //   1. Lloyd-iterated centroidal Voronoi tessellation for cluster
  //      placement (active Actor's seed pinned at the bottom-center anchor;
  //      cell areas pulled toward physically-grounded target_area_i =
  //      (dots × DOT_GRID² + LABEL_HOLE_AREA) × BUFFER_OVERHEAD_FACTOR).
  //   2. Phase 16.2.6.1: dense Voronoi-clipped grid fill per cluster
  //      (replaces Phase 16.2.4 Vogel sunflower). Voronoi polygon shrunk
  //      inward by 1 DOT_GRID; every grid cell inside enumerated, sorted by
  //      distance from centre, first N taken. Label hole excluded.
  //   3. Convex-hull umbrella outline (replacing Phase 16.0's rectangular
  //      L-shape boundary). Falls back to circle/stadium for <3 dots.
  //
  // Phase 16.1.3 Item 8: lookup-by-claim-id for per-claim disclosure types.
  // Per-Claim disclosure type comes in via cluster.publicTypeByClaimId /
  // cluster.umbrellaTypeByClaimId (see the parent component's view-builder
  // decoration). For non-umbrella publics we map disclosure type → color
  // var via disclosureTypeToColorVar.

  // Phase 16.2.4: active Actor's own cluster anchors at canvas-bottom-center.
  // Lloyd's iterations pin index-0 seed; other clusters distribute around it.
  const userCenterX = OWN_CLUSTER_ANCHOR_X
  const userCenterY = OWN_CLUSTER_ANCHOR_Y

  const allDots = []
  const clusterByDotIndex = []

  // ─── Step 1: assemble cluster specs ──────────────────────────────────
  // The active Actor goes FIRST so its index is 0 (pinned at the anchor
  // through Lloyd's). Carol (anonymous, no own Claims) still gets a seed
  // here so the tessellation has a cell at the anchor — the cell just has
  // dot_count = 0 and renders no dots/label.
  const clusterSpecs = []
  const activeParty = directoryData.activeParty
  const buildItems = (cluster) => {
    // Phase 16.2.8: per-cluster `nodesByClaimId` map of pre-enriched node-
    // shaped objects (claimToNode + mock health + mock badges) — drives the
    // mid/full card LOD render. Raw `c` stays attached as `item.claim` for
    // the click-to-Detail-Panel pipeline.
    const nodesByClaimId = cluster.nodesByClaimId || new Map()
    const umbrellaItems = (cluster.umbrellaClaims || []).map((c) => ({
      claim: c,
      node: nodesByClaimId.get(c.id) || null,
      disclosureType: cluster.umbrellaTypeByClaimId?.[c.id] || 'full',
      kind: 'umbrella',
    }))
    const publicItems = (cluster.publicClaims || []).map((c) => ({
      claim: c,
      node: nodesByClaimId.get(c.id) || null,
      disclosureType: cluster.publicTypeByClaimId?.[c.id] || 'full',
      kind: 'public',
    }))
    // Phase 16.2.6.5: pull cluster's RFPs (from view-builder Item 4) into
    // rfpItems so mixed actors get dots + hollow squares, and RFP-only
    // actors get hollow squares only. Concatenation order in packClusterDense
    // (umbrella + public then rfp) means Claims fall inner / RFPs outer
    // because cells are sorted by distance from centre.
    const rfpItems = (cluster.rfps || []).map((r) => ({
      rfp: r,
      kind: 'rfp',
      disclosureType: 'full',
    }))
    return { umbrellaItems, publicItems, rfpItems }
  }
  // Active Actor's own cluster — always present in clusterSpecs so the
  // tessellation has an anchor seed. dot_count = 0 if no own claims (Carol).
  // Phase 16.2.8: own Claims also get enriched nodes (via the top-level
  // `ownNodesByClaimId` map from the view builder).
  const activeOwnUmbrella = []
  const ownNodesByClaimId = directoryData.ownNodesByClaimId || new Map()
  const activeOwnPublic = (directoryData.ownClaims || []).map((c) => ({
    claim: c, node: ownNodesByClaimId.get(c.id) || null, disclosureType: 'full', kind: 'public',
  }))
  const activeOwnRfp = (directoryData.ownRfps || []).map((r) => ({
    rfp: r, kind: 'rfp', disclosureType: 'full',
  }))
  clusterSpecs.push({
    ownerParty: activeParty,
    isOwnCluster: true,
    umbrellaItems: activeOwnUmbrella,
    publicItems: activeOwnPublic,
    rfpItems: activeOwnRfp,
    isUserVisible: !!directoryData.isUserVisible,
  })
  // Other clusters in deterministic alphabetical order.
  const otherClustersInput = [...directoryData.otherClusters].sort(
    (a, b) => a.ownerParty.localeCompare(b.ownerParty)
  )
  for (const c of otherClustersInput) {
    const { umbrellaItems, publicItems, rfpItems } = buildItems(c)
    clusterSpecs.push({
      ownerParty: c.ownerParty,
      isOwnCluster: false,
      umbrellaItems,
      publicItems,
      rfpItems,
      isUserVisible: true,
    })
  }

  // Phase 16.2.6.5: classify each spec's `kind` so initial seed placement
  // + Lloyd's hard y-clamp can branch on it. ACTIVE is the active actor
  // (index 0, pinned at the anchor). CLAIMS_CLUSTER has dots only (upper
  // region). RFP_CLUSTER has hollow squares only (bottom-third clamp).
  // MIXED_CLUSTER has both (cross-zone band between).
  const ACTOR_KIND = {
    ACTIVE: 'active',
    CLAIMS_CLUSTER: 'claims-cluster',
    RFP_CLUSTER: 'rfp-cluster',
    MIXED_CLUSTER: 'mixed-cluster',
  }
  for (let i = 0; i < clusterSpecs.length; i++) {
    if (i === 0) { clusterSpecs[i].kind = ACTOR_KIND.ACTIVE; continue }
    const s = clusterSpecs[i]
    const dotCount = s.umbrellaItems.length + s.publicItems.length
    const rfpCount = s.rfpItems.length
    if (dotCount > 0 && rfpCount > 0) s.kind = ACTOR_KIND.MIXED_CLUSTER
    else if (rfpCount > 0)            s.kind = ACTOR_KIND.RFP_CLUSTER
    else                              s.kind = ACTOR_KIND.CLAIMS_CLUSTER
  }

  // ─── Step 2: Lloyd-iterated centroidal Voronoi tessellation ──────────
  // Seed positions: active pinned, others seeded by hash → deterministic
  // (CANVAS_WIDTH/HEIGHT-bounded) start, then relaxed toward centroid each
  // iteration. Cells target area = (dot area + rfp area + label hole) × 1.2.
  // Phase 16.2.6.5: zone thresholds bias RFP-only seeds into the bottom
  // third and mixed seeds into a narrow cross-zone band between Claims
  // (top 2/3) and RFPs (bottom 1/3).
  const usableHeight = CANVAS_HEIGHT - DOMAIN_INSET_TOP - DOMAIN_INSET_BOTTOM
  const RFP_ZONE_TOP_THRESHOLD = DOMAIN_INSET_TOP + usableHeight * 0.70
  const CROSS_ZONE_BAND_TOP    = DOMAIN_INSET_TOP + usableHeight * 0.60
  const CROSS_ZONE_BAND_BOTTOM = DOMAIN_INSET_TOP + usableHeight * 0.70
  const RFP_ZONE_BOTTOM        = CANVAS_HEIGHT - DOMAIN_INSET_BOTTOM - DOT_GRID
  const seeds = clusterSpecs.map((spec, i) => {
    if (spec.kind === ACTOR_KIND.ACTIVE) return [userCenterX, userCenterY]
    const h = hashString(spec.ownerParty)
    const ax = ((h * 31) >>> 0) % 10000 / 10000
    const ay = ((h * 17) >>> 0) % 10000 / 10000
    const x = 0.1 * CANVAS_WIDTH + ax * 0.8 * CANVAS_WIDTH
    let y
    if (spec.kind === ACTOR_KIND.RFP_CLUSTER) {
      y = RFP_ZONE_TOP_THRESHOLD + ay * (RFP_ZONE_BOTTOM - RFP_ZONE_TOP_THRESHOLD)
    } else if (spec.kind === ACTOR_KIND.MIXED_CLUSTER) {
      y = CROSS_ZONE_BAND_TOP + ay * (CROSS_ZONE_BAND_BOTTOM - CROSS_ZONE_BAND_TOP)
    } else {
      // CLAIMS_CLUSTER: existing upper-region distribution.
      y = 0.1 * CANVAS_HEIGHT + ay * 0.55 * CANVAS_HEIGHT
    }
    return [x, y]
  })
  // Phase 16.2.6.2: usable area accounts for the Voronoi-domain insets
  // (edge buffer + header/footer chrome compensation). Lloyd's target-area
  // sum is checked against this — not full canvas area — since cells are
  // tessellated inside the inset rectangle.
  const usableArea = (CANVAS_WIDTH - DOMAIN_INSET_LEFT - DOMAIN_INSET_RIGHT) * usableHeight
  // Phase 16.2.6.5: target area splits Claims (DOT_GRID²) from RFPs
  // ((DOT_GRID × 1.2)² = DOT_GRID² × 1.44) — RFP markers are slightly
  // larger than dots, so cells need proportionally more area. Both
  // contribute alongside the LABEL_HOLE_AREA, scaled by the inefficiency
  // factor that absorbs perimeter rounding losses + Lloyd's wobble.
  const RFP_AREA_FACTOR = 1.44
  const targetAreas = clusterSpecs.map((spec) => {
    const dotCount = spec.umbrellaItems.length + spec.publicItems.length
    const rfpCount = spec.rfpItems.length
    const dotArea = dotCount * DOT_GRID * DOT_GRID
    const rfpArea = rfpCount * DOT_GRID * DOT_GRID * RFP_AREA_FACTOR
    return (dotArea + rfpArea + LABEL_HOLE_AREA) * BUFFER_OVERHEAD_FACTOR
  })
  const targetSum = targetAreas.reduce((s, a) => s + a, 0)
  if (targetSum > usableArea && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[DirectoryLayer] Lloyd's target-area sum ${(targetSum / 1e6).toFixed(2)} Mwu² exceeds usable canvas area ${(usableArea / 1e6).toFixed(2)} Mwu² (insets applied) — clusters will compete; expect overflow.`)
  }
  let lloydIters = 0
  let lloydConverged = false
  let lloydMaxDisplacement = 0
  for (let iter = 0; iter < LLOYD_MAX_ITER; iter++) {
    lloydIters = iter + 1
    const delaunay = Delaunay.from(seeds)
    const voronoi = delaunay.voronoi([DOMAIN_INSET_LEFT, DOMAIN_INSET_TOP, CANVAS_WIDTH - DOMAIN_INSET_RIGHT, CANVAS_HEIGHT - DOMAIN_INSET_BOTTOM])
    let maxDelta = 0
    for (let i = 0; i < seeds.length; i++) {
      if (i === 0) continue  // active Actor's seed pinned
      const poly = voronoi.cellPolygon(i)
      if (!poly) continue
      const [ccx, ccy] = polygonCentroid(poly)
      const currentArea = Math.abs(polygonArea(poly))
      const areaError = (targetAreas[i] - currentArea) / Math.max(1, targetAreas[i])
      // tanh-sigmoid step factor: 0.5..1.0 (deficit cells take bigger steps,
      // overflow cells take smaller steps toward their centroid).
      const stepFactor = 0.5 + 0.5 * Math.tanh(areaError)
      const newX = seeds[i][0] + (ccx - seeds[i][0]) * stepFactor
      let newY = seeds[i][1] + (ccy - seeds[i][1]) * stepFactor
      // Phase 16.2.6.5: hard y-clamp on RFP-only seeds — they stay pinned
      // to the bottom third regardless of where Lloyd's centroidal pull
      // would carry them. Mixed and Claims clusters move freely.
      if (clusterSpecs[i].kind === ACTOR_KIND.RFP_CLUSTER && newY < RFP_ZONE_TOP_THRESHOLD) {
        newY = RFP_ZONE_TOP_THRESHOLD
      }
      maxDelta = Math.max(maxDelta, Math.hypot(newX - seeds[i][0], newY - seeds[i][1]))
      seeds[i] = [newX, newY]
    }
    lloydMaxDisplacement = maxDelta
    if (maxDelta < LLOYD_CONVERGENCE_DELTA) {
      lloydConverged = true
      break
    }
  }
  if (!lloydConverged && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[DirectoryLayer] Lloyd's iteration capped at ${LLOYD_MAX_ITER}; max displacement ${lloydMaxDisplacement.toFixed(1)} wu still > ${LLOYD_CONVERGENCE_DELTA}`)
  }
  // Final Voronoi cells after iteration.
  const finalDelaunay = Delaunay.from(seeds)
  const finalVoronoi = finalDelaunay.voronoi([DOMAIN_INSET_LEFT, DOMAIN_INSET_TOP, CANVAS_WIDTH - DOMAIN_INSET_RIGHT, CANVAS_HEIGHT - DOMAIN_INSET_BOTTOM])

  // ─── Step 3: per-cluster dense Voronoi-clipped grid fill ──────────────
  // Phase 16.2.6.1: replaces the Phase 16.2.4 Vogel sunflower. Each cluster's
  // Voronoi polygon is shrunk inward by 1 DOT_GRID (creates the 2-cell
  // inter-cluster gap when both neighbours shrink), every grid cell inside
  // the shrunken polygon is enumerated (excluding the label hole), sorted by
  // distance from the cluster centre, and the first N are filled. Umbrella
  // items consume the innermost cells so the convex-hull outline traces a
  // tight inner subset.
  const clusters = []
  for (let ci = 0; ci < clusterSpecs.length; ci++) {
    const spec = clusterSpecs[ci]
    const seed = seeds[ci]
    const cellPoly = finalVoronoi.cellPolygon(ci) || []
    const centerX = seed[0]
    const centerY = seed[1]
    const items = [...spec.umbrellaItems, ...spec.publicItems, ...spec.rfpItems]
    const N = items.length

    // If this is the active Actor's seed AND no own claims (Carol), render
    // nothing — but keep the cluster entry so downstream code (camera
    // animations, label maps) has a place to look.
    const placedDots = []
    if (N > 0) {
      const positions = packClusterDense({ cellPoly, centerX, centerY, count: N, clusterParty: spec.ownerParty })
      if (positions.length < N && typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(`[DirectoryLayer] packClusterDense overflow for ${spec.ownerParty}: placed ${positions.length}/${N} (Voronoi cell too small at current Lloyd's convergence — bump Lloyd's cap or grow canvas).`)
      }
      for (let i = 0; i < positions.length; i++) {
        const item = items[i]
        const { x, y } = positions[i]
        const colorVar = item.kind === 'rfp'
          ? '--accent-cyan'
          : disclosureTypeToColorVar(item.disclosureType)
        const placed = {
          x, y,
          colorVar,
          kind: item.kind || 'public',
          claim: item.claim || null,
          // Phase 16.2.8: enriched node-shaped object — read by the card
          // overlay block (mid/full LOD). Null for RFP items.
          node: item.node || null,
          rfp: item.rfp || null,
          type: item.kind === 'umbrella' ? 'umbrella' : (item.kind || 'public'),
          clusterIdx: ci,
          // Phase 16.2.10: drives card border + bg tint at mid/full LOD.
          disclosureType: item.disclosureType,
        }
        placedDots.push(placed)
      }
    }

    // Umbrella outline path: convex hull of umbrella dots, +1 cell margin.
    const umbrellaDots = placedDots.filter((d) => d.kind === 'umbrella')
    const umbrellaPathWorld = umbrellaDots.length > 0
      ? umbrellaOutlinePath(umbrellaDots)
      : null

    // Bbox for hit-testing / camera animations — derived from placed dots
    // or fall back to the Voronoi cell when there are no dots.
    let bbox
    if (placedDots.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const d of placedDots) {
        if (d.x < minX) minX = d.x
        if (d.x > maxX) maxX = d.x
        if (d.y < minY) minY = d.y
        if (d.y > maxY) maxY = d.y
      }
      bbox = { minX, maxX, minY, maxY }
    } else {
      bbox = {
        minX: centerX - LABEL_HOLE_W / 2,
        maxX: centerX + LABEL_HOLE_W / 2,
        minY: centerY - LABEL_HOLE_H / 2,
        maxY: centerY + LABEL_HOLE_H / 2,
      }
    }

    clusters.push({
      ownerParty: spec.ownerParty,
      isOwnCluster: spec.isOwnCluster,
      center: { x: centerX, y: centerY },
      // squareWorld coincides with cluster center now — the Actor "square"
      // is no longer rendered as a Three.js mesh; the centered HTML label
      // (PillboxLabel) consumes this position. Kept under the same field
      // name so downstream code (PillboxLabel x/y lookup, hover-fade
      // pillbox detection) doesn't need to change.
      squareWorld: { x: centerX, y: centerY },
      dots: placedDots,
      umbrellaPathWorld,
      voronoiCellPolygon: cellPoly,
      bbox,
    })
  }

  // Decide which cluster entries actually render dots/labels. Carol's empty
  // anchor cluster: render no label (isUserVisible === false → keep the
  // empty cluster slot but skip its label later via the same flag).
  const ownClusters = clusters[0].dots.length > 0 || clusters[0].isUserVisible
    ? [clusters[0]]
    : []
  // For Carol's case the active cluster entry still exists but isUserVisible
  // is false, signaling the label should be hidden.
  const otherClusters = clusters.slice(1)

  // (Phase 16.2.4: layoutClusterCells + buildCluster helpers removed — the
  // sunflower placement above replaces both. The legacy CLUSTER_PAD-based
  // L-shape rectangular umbrella border is replaced by the convex-hull
  // outline computed inline above via umbrellaOutlinePath.)

  // Other RFPs anchored alongside their owning cluster (or near the anchor
  // if the cluster isn't on canvas).
  const otherRfpEntries = []
  for (const rfp of directoryData.otherRfps || []) {
    const ownCluster = otherClusters.find((c) => c.ownerParty === rfp.owner)
    if (ownCluster) {
      const sq = ownCluster.center
      otherRfpEntries.push({ rfp, x: snapGrid(sq.x + DOT_GRID * 3), y: snapGrid(sq.y) })
    } else {
      otherRfpEntries.push({ rfp, x: snapGrid(userCenterX + 600), y: snapGrid(userCenterY - 320) })
    }
  }

  // ─── Step 4: flatten per-cluster dots into allDots ──────────────────
  const allClusters = [...ownClusters, ...otherClusters]
  for (let ci = 0; ci < allClusters.length; ci++) {
    const cluster = allClusters[ci]
    for (const d of cluster.dots) {
      allDots.push({
        x: d.x, y: d.y,
        colorVar: d.colorVar,
        kind: d.kind || 'public',
        claim: d.claim || null,
        // Phase 16.2.8: propagate enriched node through allDots so the card
        // overlay block (which iterates layout.allDots) can read it directly.
        node: d.node || null,
        rfp: d.rfp || null,
        clusterIdx: ci,
        // Phase 16.2.10: propagate disclosureType for card border/bg tint.
        disclosureType: d.disclosureType,
      })
      clusterByDotIndex.push(ci)
    }
  }
  for (const entry of otherRfpEntries) {
    allDots.push({
      x: entry.x, y: entry.y,
      colorVar: '--accent-cyan',
      kind: 'rfp',
      claim: null,
      rfp: entry.rfp,
      clusterIdx: -1,
      // Phase 16.2.10: RFPs don't render as cards; field stays for shape consistency.
      disclosureType: 'full',
    })
    clusterByDotIndex.push(-1)
  }

  return {
    activeParty: directoryData.activeParty,
    isUserVisible: directoryData.isUserVisible,
    allClusters,
    ownClusters,
    otherClusters,
    otherRfpEntries,
    allDots,
    clusterByDotIndex,
    userCenterX,
    userCenterY,
  }
}

// ─── Main DirectoryLayer ───────────────────────────────────────────────
export default function DirectoryLayer({
  open,
  activeParty,
  roleId,
  v22Provisionals,
  // Phase 17.1: session-state Map<rfpId, ISO closedDate> threaded from
  // V2App. Closed RFPs are visible only to their owner (with a dashed-
  // outline visual treatment); non-owners see the RFP filtered out by
  // `buildV22DirectoryDataForRole`. See §8.8 in the architecture spec
  // for the asymmetric-visibility rationale.
  v22ClosedRfpIds,
  // eslint-disable-next-line no-unused-vars
  onOpenAIShopper,
  onClose,
  onClaimDotClick,
  // Phase 17.0: clicking an RFP marker fires this with the underlying
  // `rfp` artifact. V2App routes to a read-only RfpDetailPanel; mutual
  // exclusion with `onClaimDotClick` is enforced on V2App's side.
  onRfpClick,
  wipeOrigin,
}) {
  // ─── Entry/exit state machine ────────────────────────────────────────
  const [phase, setPhase] = useState('closed')
  const phaseRef = useRef(phase)
  useEffect(() => { phaseRef.current = phase }, [phase])

  useEffect(() => {
    if (open) {
      if (phaseRef.current === 'closed') {
        setPhase('opening')
        let raf2 = 0
        const raf1 = requestAnimationFrame(() => {
          raf2 = requestAnimationFrame(() => setPhase('in'))
        })
        return () => { cancelAnimationFrame(raf1); if (raf2) cancelAnimationFrame(raf2) }
      }
    } else if (phaseRef.current !== 'closed') {
      setPhase('out')
      const t = setTimeout(() => setPhase('closed'), 600)
      return () => clearTimeout(t)
    }
  }, [open])

  const pinnedOriginRef = useRef(null)
  if (phase === 'closed') pinnedOriginRef.current = null
  if (phase === 'opening' && pinnedOriginRef.current === null) {
    pinnedOriginRef.current = wipeOrigin || null
  }
  const activeOrigin = pinnedOriginRef.current
  // Phase 16.2.6.2: default wipe origin moved from bottom-left ('0% 100%')
  // to bottom-center ('50% 100%') — visually says "the network expands out
  // from your active-actor anchor (canvas-bottom-center) toward the rest of
  // the directory." The `circle(180% at ...)` end-state radius is expressed
  // as a viewport-diagonal percentage so it still reaches all four corners
  // from the new origin.
  const originStr = activeOrigin
    ? `${Math.round(activeOrigin.x)}px ${Math.round(activeOrigin.y)}px`
    : '50% 100%'
  const clipCollapsed = `circle(0% at ${originStr})`
  const clipExpanded = `circle(180% at ${originStr})`
  const clipPath = phase === 'in' ? clipExpanded : clipCollapsed

  // ─── Per-role data + viewport + layout ──────────────────────────────
  const directoryData = useMemo(() => {
    if (!roleId) return null
    const base = buildV22DirectoryDataForRole(roleId, v22Provisionals, v22ClosedRfpIds)
    // Phase 16.1.3 Item 8: enrich the directory data with per-Claim
    // disclosure-type lookup tables for both public DAs and umbrella DAs.
    // The view-builder currently doesn't expose these directly; we look
    // them up from the shared artifact set here.
    if (!base) return base
    try {
      // Avoid duplicating the view-builder. The simplest path is to walk
      // shared DAs once and map by claimId for each visibility scope.
      const shared = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
      const activeDas = (shared.disclosureAgreements || []).filter((d) => !d._declineMeta && !d._revokedMeta && d.type !== 'provisional')
      const publicTypeByClaimId = {}
      for (const da of activeDas) {
        if (da.subject?.kind !== 'claim') continue
        if (da.grantee?.party === 'Radiant Network') publicTypeByClaimId[da.subject.id] = da.type
      }
      const umbrellaTypeByClaimId = {}
      for (const da of activeDas) {
        if (da.subject?.kind !== 'claim') continue
        if (da.grantee?.party !== base.activeParty) continue
        const grantor = da.grantor?.party
        if (!grantor || grantor === base.activeParty || grantor === 'Radiant Network') continue
        umbrellaTypeByClaimId[da.subject.id] = da.type
      }
      // Decorate each cluster with type-by-claim-id maps.
      const decorated = {
        ...base,
        otherClusters: base.otherClusters.map((c) => ({
          ...c,
          publicTypeByClaimId,
          umbrellaTypeByClaimId,
        })),
      }
      return decorated
    } catch (_e) {
      return base
    }
  }, [roleId, v22Provisionals, v22ClosedRfpIds])

  const [viewport, setViewport] = useState({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const layout = useMemo(() => computeLayout(directoryData, viewport), [directoryData, viewport])

  // ─── Three.js refs + state ──────────────────────────────────────────
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const dotsMeshRef = useRef(null)
  // Phase 16.2.6.2: tracks the per-instance scale currently baked into the
  // dots mesh's matrices. Read + written by the zoom-change rescale effect
  // so a no-op zoom step (scale unchanged) skips the 22k-matrix rewrite.
  const dotScaleRef = useRef(1)
  // Phase 16.2.6.3: tracks the current RFP border thickness in world units
  // (baked into rfpMesh.geometry). A zoom-change useEffect compares against
  // the desired `RFP_BORDER_SCREEN_PX / zoom` and rebuilds the geometry on
  // mismatch so the on-screen border stays ~2 px across the zoom range.
  const rfpBorderRef = useRef(RFP_BORDER)
  // Phase 16.2.6.6: tracks the per-instance scale currently baked into the
  // RFP outline + fill meshes' matrices. Updated by the rfp-rescale-on-zoom
  // useEffect; read by the border-rebuild useEffect when computing the
  // geometry's border thickness (`RFP_BORDER_SCREEN_PX / (scale × zoom)`).
  const rfpScaleRef = useRef(1)
  const actorSquaresMeshRef = useRef(null)
  const rfpMeshRef = useRef(null)
  // Phase 16.2.6.6: companion InstancedMesh for the tinted indigo fill
  // rendered behind the outline. Shares the same per-instance scale +
  // position matrices as `rfpMeshRef`. PlaneGeometry, never rebuilt on zoom
  // (visual size driven entirely by the per-instance scale).
  const rfpFillMeshRef = useRef(null)
  // Phase 17.0: invisible solid-square hit-test InstancedMesh for RFP markers.
  // The visible `rfpMesh` uses `makeHollowSquareGeometry` (a ring), so a
  // raycast against the centre of an RFP marker misses entirely. This
  // companion mesh uses a solid `PlaneGeometry` at the same per-instance
  // size + position as the outline, with `opacity: 0` and `depthWrite: false`
  // so it contributes nothing visually but resolves a click on the marker's
  // interior. Matrices are written in lockstep with `rfpMeshRef` (same
  // populate loop + same rescale-on-zoom effect).
  //
  // Phase 17.1 update: the hit-test mesh continues to carry ALL RFP
  // instances regardless of status — closed-and-owned RFPs are still
  // clickable so the owner can reopen them. Only the visible outline +
  // fill meshes partition on status (closed-owned instances hide there
  // and render via `closedRfpMeshRef` below).
  const rfpHitMeshRef = useRef(null)
  // Phase 17.1: dashed-outline LineSegments for closed-and-owned RFPs.
  // Single `THREE.LineSegments` whose `BufferGeometry` is rebuilt on
  // every layout / zoom change (the closed-owned set is bounded — a
  // demo session typically has 0-5 closed RFPs — so rebuilding a few
  // hundred bytes of vertex data per change is trivial). Material uses
  // `LineDashedMaterial`; the geometry's per-vertex line distances are
  // computed via `computeLineDistances()` after each rebuild (required
  // for the dashing to render at all).
  const closedRfpMeshRef = useRef(null)
  const gridGroupRef = useRef(null)
  const dirtyRef = useRef(true)
  // Phase 16.2.3: initial camera target = canvas-horizontal-center +
  // vertical-center (so the full bounded canvas fits at INITIAL_ZOOM = 0.1).
  const camPosRef = useRef({ x: OWN_CLUSTER_ANCHOR_X, y: CANVAS_HEIGHT / 2 })
  const zoomRef = useRef(INITIAL_ZOOM)
  const draggingRef = useRef(false)
  const wasDragRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const camStartRef = useRef({ x: 0, y: 0 })
  const panAnimRef = useRef(null)
  const [threeReady, setThreeReady] = useState(false)
  const [zoom, setZoom] = useState(INITIAL_ZOOM)

  // Phase 16.2.3: loading animation state.
  //   • dotOpacitiesRef — per-dot opacity (0..1) used to scale each dot's
  //     base color so opacity 0 renders black (blends into the opaque dark
  //     `--bg-deep` background) and opacity 1 renders the dot's full color.
  //   • labelOpacities — per-party opacity for the cluster PillboxLabel.
  //   • animationHandleRef — { skip, promise } returned by
  //     playDirectoryLoadAnimation; consumed by the empty-canvas click
  //     handler to skip the in-flight wave.
  //   • lastAnimatedRoleRef + entryNonce — used to gate re-animation so the
  //     wave replays only on Directory entry (initial mount + role switch)
  //     and not on every layout recompute (provisional updates, resize).
  const dotOpacitiesRef = useRef(new Float32Array(MAX_DOTS).fill(1))
  const [labelOpacities, setLabelOpacities] = useState({})
  // Phase 16.2.4: per-cluster umbrella outline opacity. Same fade-in timeline
  // as the label; default 1 (loaded). During the wave animation each
  // umbrella-bearing cluster's outline ramps 0 → 1 alongside its label.
  const [umbrellaOpacities, setUmbrellaOpacities] = useState({})
  const animationHandleRef = useRef(null)
  const lastAnimatedRoleRef = useRef(null)
  const lastAnimatedPhaseRef = useRef('closed')

  const [hover, setHover] = useState(null)
  const [pinned, setPinned] = useState(null)
  useEffect(() => {
    if (phase === 'closed') {
      setHover(null); setPinned(null)
      // Phase 17.2: clear RFP hover state when Directory closes so the next
      // entry starts at baseline.
      hoveredRfpIdxRef.current = -1
      rfpDirtyRef.current = true
    }
  }, [phase])
  useEffect(() => {
    setHover(null); setPinned(null)
    // Phase 17.2: same reset on role switch.
    hoveredRfpIdxRef.current = -1
    rfpDirtyRef.current = true
  }, [roleId])

  // Phase 16.2.3: ref mirrors of hover/pinned/layout so the load-animation
  // mesh-color flush (called from the Three.js animate loop) reads fresh
  // values without rebuilding the callback on every state change.
  const hoverRef = useRef(null)
  const pinnedRef = useRef(null)
  const layoutRef = useRef(null)
  useEffect(() => { hoverRef.current = hover }, [hover])
  useEffect(() => { pinnedRef.current = pinned }, [pinned])
  // Per-dot base color cache (one THREE.Color per Claim dot, keyed by
  // index in `layout.allDots.filter(d => d.kind !== 'rfp')`). Populated in
  // the layout `useLayoutEffect` and read by `flushDotColors`.
  const baseDotColorsRef = useRef([])
  const dotsDirtyRef = useRef(false)
  const flushDotColorsRef = useRef(() => {})

  // Phase 17.2: RFP marker hover state — separate from `hover` (which is
  // Claim-only) so the existing tooltip-fade behaviour doesn't fire on RFP
  // hover (RFP tooltip is opened only on click via `pinned.rfp`). Stored
  // as a ref-only state to avoid React re-renders on every mouse move.
  // The mark-as-dirty path runs from `handleMouseMove`.
  const hoveredRfpIdxRef = useRef(-1)
  // Per-RFP-marker base color cache (one THREE.Color per RFP, keyed by
  // index in `layout.allDots.filter(d => d.kind === 'rfp')`). Populated in
  // the layout `useLayoutEffect` and read by `flushRfpColors`.
  const baseRfpColorsRef = useRef([])
  const rfpDirtyRef = useRef(false)
  const flushRfpColorsRef = useRef(() => {})
  // Per-closed-owned-RFP base color cache (vertex colors). Keyed by index
  // in the closed-owned subset filtered at populate-time. Each entry is a
  // single THREE.Color used to fill all 16 vertices (8 line segments) of
  // that closed RFP's dashed outline.
  const baseClosedRfpColorsRef = useRef([])
  // Closed-owned RFP positions in the rfpDots array (so we can map an
  // overall RFP index to its closed-RFP index). null when none are closed.
  const closedRfpIdxMapRef = useRef(new Map())

  const [overlay, setOverlay] = useState(null)

  // ─── Camera helpers ─────────────────────────────────────────────────
  const worldToScreen = useCallback((wx, wy) => {
    const camera = cameraRef.current
    const renderer = rendererRef.current
    if (!camera || !renderer) return { x: 0, y: 0 }
    const vec = new THREE.Vector3(wx, -wy, 0)
    vec.project(camera)
    return {
      x: (vec.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
      y: (-vec.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
    }
  }, [])

  const updateCamera = useCallback(() => {
    const camera = cameraRef.current
    const container = containerRef.current
    if (!camera || !container) return
    const w = container.clientWidth
    const h = container.clientHeight
    // Phase 16.2.3: guard against zero-sized container (briefly true during
    // initial mount before layout). A zero-width frustum produces NaN in
    // the orthographic projection matrix, which propagates through
    // worldToScreen and breaks every HTML overlay positioned via it.
    if (w <= 0 || h <= 0) return
    const z = zoomRef.current
    const halfW = (w / z) * 0.5
    const halfH = (h / z) * 0.5
    camera.left = -halfW
    camera.right = halfW
    camera.top = halfH
    camera.bottom = -halfH
    camera.position.set(camPosRef.current.x, -camPosRef.current.y, 100)
    camera.updateProjectionMatrix()
    dirtyRef.current = true
  }, [])

  // Phase 16.2.3: pan-bounds recompute based on the bounded canvas + current
  // zoom + viewport size. At INITIAL_ZOOM=0.1 the bounds collapse to a
  // single point (full canvas already fits) so the user can't pan into
  // empty void; at higher zooms the bounds open up and the user can
  // traverse the canvas without revealing space beyond [0, CANVAS_WIDTH] ×
  // [0, CANVAS_HEIGHT].
  const clampPan = useCallback((x, y) => {
    const container = containerRef.current
    const z = zoomRef.current || INITIAL_ZOOM
    const vw = container?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1280)
    const vh = container?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 720)
    const halfW = vw / (2 * z)
    const halfH = vh / (2 * z)
    // If the canvas is smaller than the half-viewport in either axis, snap
    // to the canvas center for that axis (no panning possible at this zoom).
    const minX = halfW >= CANVAS_WIDTH / 2 ? CANVAS_WIDTH / 2 : halfW
    const maxX = halfW >= CANVAS_WIDTH / 2 ? CANVAS_WIDTH / 2 : CANVAS_WIDTH - halfW
    const minY = halfH >= CANVAS_HEIGHT / 2 ? CANVAS_HEIGHT / 2 : halfH
    const maxY = halfH >= CANVAS_HEIGHT / 2 ? CANVAS_HEIGHT / 2 : CANVAS_HEIGHT - halfH
    return {
      x: Math.max(minX, Math.min(maxX, x)),
      y: Math.max(minY, Math.min(maxY, y)),
    }
  }, [])

  // Phase 16.1.3 Item 6: animated pan-to-center (mirrors V2Canvas pattern).
  const animatedPanToWithZoom = useCallback((worldX, worldY, targetZoom, duration = 500) => {
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
    const startX = camPosRef.current.x
    const startY = camPosRef.current.y
    const startZoom = zoomRef.current
    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(1, elapsed / duration)
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
      const clamped = clampPan(
        startX + (worldX - startX) * ease,
        startY + (worldY - startY) * ease,
      )
      camPosRef.current = clamped
      zoomRef.current = startZoom + (targetZoom - startZoom) * ease
      setZoom(zoomRef.current)
      updateCamera()
      if (t < 1) {
        panAnimRef.current = requestAnimationFrame(tick)
      } else {
        panAnimRef.current = null
      }
    }
    panAnimRef.current = requestAnimationFrame(tick)
  }, [clampPan, updateCamera])

  // ─── Overlay refresh ─────────────────────────────────────────────────
  const updateOverlayRef = useRef(() => {})
  useEffect(() => {
    updateOverlayRef.current = () => {
      if (!layout) return
      const ownerSquares = layout.allClusters.map((c) => ({
        ownerParty: c.ownerParty,
        screen: worldToScreen(c.squareWorld.x, c.squareWorld.y),
      }))
      const dotScreens = layout.allDots.map((d) => worldToScreen(d.x, d.y))
      const umbrellaPaths = layout.allClusters
        .filter((c) => c.umbrellaPathWorld)
        .map((c) => ({
          ownerParty: c.ownerParty,
          screenPoints: c.umbrellaPathWorld.map((p) => worldToScreen(p[0], p[1])),
        }))
      setOverlay({ ownerSquares, dotScreens, umbrellaPaths })
    }
  }, [layout, worldToScreen])

  // ─── Three.js scene init (Phase 16.1.4: depend on a stable boolean,
  //     not on `phase`, so the scene is built once on first open and torn
  //     down only on full close. With `phase` in the deps, the cleanup
  //     fired on every internal transition (opening → in, in → out),
  //     disposing the populated mesh while the `useLayoutEffect` that
  //     repopulates didn't re-run — its `[threeReady, layout]` deps were
  //     unchanged after React batched the false/true threeReady toggle,
  //     leaving the canvas empty.) ───────────────────────────────────
  const shouldMountScene = phase !== 'closed'
  useEffect(() => {
    if (!shouldMountScene) return
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    if (rendererRef.current) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const gridGroup = new THREE.Group()
    gridGroupRef.current = gridGroup
    scene.add(gridGroup)

    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    updateCamera()

    // Background grid as Points.
    // Phase 16.2.3: grid spans the full bounded canvas with a small margin
    // for breathing room when zoomed in close to an edge.
    // Phase 16.2.5: grid origin snapped to a multiple of GRID_SPACING so
    // grid points include (0, 0). Combined with the cluster snap
    // (`snapGrid(v) = Math.round(v/DOT_GRID)*DOT_GRID` where `DOT_GRID ===
    // GRID_SPACING`), every sunflower-snapped dot now lands on a
    // background-grid intersection at every zoom level.
    const isDark = document.documentElement.dataset.theme !== 'light'
    const gridColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const gridPoints = []
    const gx0 = -Math.ceil(GRID_MARGIN / GRID_SPACING) * GRID_SPACING
    const gx1 = Math.ceil((CANVAS_WIDTH + GRID_MARGIN) / GRID_SPACING) * GRID_SPACING
    const gy0 = -Math.ceil(GRID_MARGIN / GRID_SPACING) * GRID_SPACING
    const gy1 = Math.ceil((CANVAS_HEIGHT + GRID_MARGIN) / GRID_SPACING) * GRID_SPACING
    for (let gx = gx0; gx <= gx1; gx += GRID_SPACING) {
      for (let gy = gy0; gy <= gy1; gy += GRID_SPACING) {
        // Note: world y stored as negative in Three.js (camera consumes -y).
        gridPoints.push(new THREE.Vector3(gx, -gy, -1))
      }
    }
    const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints)
    const gridMaterial = new THREE.PointsMaterial({
      color: gridColor, size: 1.4, sizeAttenuation: false, opacity: 0.28, transparent: true,
    })
    gridGroup.add(new THREE.Points(gridGeometry, gridMaterial))

    // Phase 16.1.3 Items 1 + 2 + 9: pre-create InstancedMeshes with generous
    // capacity. Population happens in subsequent useLayoutEffects.
    // Phase 16.1.5 Item 1: `frustumCulled = false` on every InstancedMesh.
    // Three.js auto-culls meshes whose bounding sphere falls outside the
    // camera frustum. For InstancedMesh, the auto-computed bounding sphere
    // comes from the underlying GEOMETRY vertices — which sit at origin
    // because instance positions live in per-instance matrices, not in the
    // geometry. At high zoom, the camera frustum tightens; the
    // origin-centred bounding sphere falls outside the frustum and Three.js
    // culls the entire mesh — even though individual instances are clearly
    // inside the visible area. Disabling frustum culling is the simplest
    // fix; there's no perceptible perf cost at our scale (≤ thousands of
    // dots). Also override `boundingSphere` to an unbounded sphere so the
    // raycast pre-filter (which also consults the bounding sphere) never
    // rejects the mesh outright at high zoom.
    const unboundedSphere = () => new THREE.Sphere(new THREE.Vector3(0, 0, 0), Number.POSITIVE_INFINITY)
    // Phase 16.2.5.1: 16 segments → 64. With Phase 16.2.5's `DOT_RADIUS = 20.4`
    // (was 3), each cluster dot is ~7× bigger on screen and the 16-sided
    // polygon silhouette became visible at higher zoom (clearly polygonal at
    // 100 %+). Bumping to 64 segments produces a perceptually smooth circle
    // at every supported zoom level (up to MAX_ZOOM = 4.0). Per-frame cost
    // is one fragment shader pass over the same per-instance matrices —
    // negligible at our dot scale (≤ 10k dots).
    const dotGeometry = new THREE.CircleGeometry(DOT_RADIUS, 64)
    const dotMaterial = new THREE.MeshBasicMaterial()
    const dotsMesh = new THREE.InstancedMesh(dotGeometry, dotMaterial, MAX_DOTS)
    dotsMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_DOTS * 3), 3)
    dotsMesh.count = 0  // empty until populated
    dotsMesh.frustumCulled = false
    dotsMesh.boundingSphere = unboundedSphere()
    scene.add(dotsMesh)
    dotsMeshRef.current = dotsMesh

    const squareGeometry = makeHollowSquareGeometry(ACTOR_SQUARE, ACTOR_BORDER)
    const squareMaterial = new THREE.MeshBasicMaterial({ color: cssVarToColor('--accent-indigo', '#6b8aff') })
    const squaresMesh = new THREE.InstancedMesh(squareGeometry, squareMaterial, MAX_SQUARES)
    squaresMesh.count = 0
    squaresMesh.frustumCulled = false
    squaresMesh.boundingSphere = unboundedSphere()
    scene.add(squaresMesh)
    actorSquaresMeshRef.current = squaresMesh

    // Phase 16.2.6.3: RFP marker is a hollow square (resurrected primitive
    // from pre-16.2.4 Actor squares), indigo accent. Border thickness sized
    // for the initial zoom; a zoom-change useEffect rebuilds the geometry
    // so the on-screen border stays ~RFP_BORDER_SCREEN_PX at every zoom.
    // Phase 16.2.6.6: built at RFP_BASE_OUTER (was RFP_OUTER_SIZE = 1.2 ×
    // DOT_GRID); a per-instance scale on the matrix caps the on-screen size
    // at MAX_SCREEN_RFP_PX above the cap threshold — same pattern as dots.
    //
    // Two meshes are added in this order so the outline draws on top of the
    // tinted fill: scene.add(fill) BEFORE scene.add(outline). Both share
    // identical per-instance matrices (position + scale).
    const rfpFillGeometry = new THREE.PlaneGeometry(RFP_BASE_OUTER, RFP_BASE_OUTER)
    // Phase 17.2: per-instance vertex colors enable hover/select brightening
    // on RFP markers. Material's base `color` is multiplied by per-instance
    // colors at fragment-shader time — both must be set to neutral white in
    // the base attribute so the fill alpha + indigo come from the material
    // color (the multiplier defaults to white when an instance is in the
    // baseline state).
    const rfpFillMaterial = new THREE.MeshBasicMaterial({
      color: cssVarToColor('--accent-indigo', '#6b8aff'),
      transparent: true,
      opacity: RFP_FILL_ALPHA,
    })
    const rfpFillMesh = new THREE.InstancedMesh(rfpFillGeometry, rfpFillMaterial, MAX_RFPS)
    rfpFillMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RFPS * 3), 3)
    rfpFillMesh.count = 0
    rfpFillMesh.frustumCulled = false
    rfpFillMesh.boundingSphere = unboundedSphere()
    scene.add(rfpFillMesh)
    rfpFillMeshRef.current = rfpFillMesh

    const rfpGeometry = makeHollowSquareGeometry(RFP_BASE_OUTER, RFP_BORDER)
    const rfpMaterial = new THREE.MeshBasicMaterial({ color: cssVarToColor('--accent-indigo', '#6b8aff') })
    const rfpMesh = new THREE.InstancedMesh(rfpGeometry, rfpMaterial, MAX_RFPS)
    rfpMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX_RFPS * 3), 3)
    rfpMesh.count = 0
    rfpMesh.frustumCulled = false
    rfpMesh.boundingSphere = unboundedSphere()
    scene.add(rfpMesh)
    rfpMeshRef.current = rfpMesh

    // Phase 17.0: invisible hit-test mesh — solid PlaneGeometry, opacity 0,
    // depthWrite off; matrices written in lockstep with rfpMesh. Resolves
    // raycasts on the marker's interior (the outline ring's hole leaves a
    // dead zone otherwise).
    const rfpHitGeometry = new THREE.PlaneGeometry(RFP_BASE_OUTER, RFP_BASE_OUTER)
    const rfpHitMaterial = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })
    const rfpHitMesh = new THREE.InstancedMesh(rfpHitGeometry, rfpHitMaterial, MAX_RFPS)
    rfpHitMesh.count = 0
    rfpHitMesh.frustumCulled = false
    rfpHitMesh.boundingSphere = unboundedSphere()
    scene.add(rfpHitMesh)
    rfpHitMeshRef.current = rfpHitMesh

    // Phase 17.1: dashed-outline LineSegments for closed-and-owned RFPs.
    // BufferGeometry is empty at construction; the populate effect below
    // fills its `position` attribute on every layout / zoom change. The
    // material's dashSize / gapSize are in world units; values picked so
    // the dashing reads as roughly 4-on-2 at default zoom against the
    // ~45 wu RFP_BASE_OUTER outline. Defensive InstancedMesh-style
    // settings apply to LineSegments too (the boundingSphere is computed
    // from geometry vertices — empty geometry → tiny default sphere →
    // frustum + raycast cull the whole mesh).
    const closedRfpGeometry = new THREE.BufferGeometry()
    // Phase 17.2: vertex colors on the closed-RFP dashed outline drive
    // hover/select brightening (the LineSegments has 8 line segments per
    // closed-owned RFP = 16 vertices). Material's base `color` stays
    // indigo as a fallback; with `vertexColors = true`, the per-vertex
    // color attribute multiplies the base color at fragment-shader time.
    const closedRfpMaterial = new THREE.LineDashedMaterial({
      color: 0xffffff,
      vertexColors: true,
      dashSize: 8,
      gapSize: 4,
    })
    const closedRfpMesh = new THREE.LineSegments(closedRfpGeometry, closedRfpMaterial)
    closedRfpMesh.frustumCulled = false
    closedRfpMesh.boundingSphere = unboundedSphere()
    scene.add(closedRfpMesh)
    closedRfpMeshRef.current = closedRfpMesh

    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      // Phase 16.2.3: if the load animation (or hover state change) marked
      // dotsDirtyRef, flush per-instance colors before rendering. This is
      // the single integration point for per-dot color/opacity updates.
      if (dotsDirtyRef.current) {
        flushDotColorsRef.current?.()
        dotsDirtyRef.current = false
      }
      // Phase 17.2: matching flush for RFP marker hover/select brightening.
      // Set by `handleMouseMove` (hover) and by the pinned-state effect
      // (click selection); flushed once per frame before render.
      if (rfpDirtyRef.current) {
        flushRfpColorsRef.current?.()
        rfpDirtyRef.current = false
      }
      if (dirtyRef.current) {
        renderer.render(scene, camera)
        updateOverlayRef.current()
        dirtyRef.current = false
      }
    }
    animate()

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth
      const h = container.clientHeight
      renderer.setSize(w, h)
      updateCamera()
    })
    ro.observe(container)

    // Phase 16.1.3 Item 1: force render when the wipe transition completes.
    const onWipeEnd = (e) => {
      if (e.propertyName !== 'clip-path' && e.propertyName !== '-webkit-clip-path') return
      dirtyRef.current = true
      renderer.render(scene, camera)
      updateOverlayRef.current()
    }
    container.addEventListener('transitionend', onWipeEnd)

    setThreeReady(true)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      container.removeEventListener('transitionend', onWipeEnd)
      gridGeometry.dispose()
      gridMaterial.dispose()
      dotGeometry.dispose()
      dotMaterial.dispose()
      squareGeometry.dispose()
      squareMaterial.dispose()
      rfpGeometry.dispose()
      rfpMaterial.dispose()
      // Phase 16.2.6.6: dispose fill mesh geom + material alongside outline.
      // `rfpMesh.geometry` is rebuilt by the border-rebuild useEffect each
      // time the on-screen border crosses the 5% threshold; the cleanup
      // disposes whatever the current geometry is at unmount time.
      rfpFillGeometry.dispose()
      rfpFillMaterial.dispose()
      // Phase 17.0: dispose hit-test mesh geom + material.
      rfpHitGeometry.dispose()
      rfpHitMaterial.dispose()
      // Phase 17.1: dispose closed-RFP dashed-outline geometry + material.
      // Geometry may have been rebuilt many times across the component
      // lifetime; the current attached geometry is what we dispose here
      // (the populate effect always disposes the previous one before
      // attaching a fresh BufferGeometry).
      closedRfpMesh.geometry.dispose()
      closedRfpMaterial.dispose()
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      gridGroupRef.current = null
      dotsMeshRef.current = null
      actorSquaresMeshRef.current = null
      rfpMeshRef.current = null
      rfpFillMeshRef.current = null
      rfpHitMeshRef.current = null
      closedRfpMeshRef.current = null
      setThreeReady(false)
    }
  }, [shouldMountScene, updateCamera])

  // ─── Phase 16.1.3 Item 1: useLayoutEffect for dots + squares + RFPs. ─
  // Runs synchronously after DOM mutations, before browser paint, so the
  // mesh data is committed before the first visible frame.
  useLayoutEffect(() => {
    if (!threeReady || !layout) return
    const scene = sceneRef.current
    const dotsMesh = dotsMeshRef.current
    const squaresMesh = actorSquaresMeshRef.current
    const rfpMesh = rfpMeshRef.current
    // Phase 16.2.6.6: fill mesh refs grab alongside outline — both populated
    // in the same pass with identical per-instance matrices.
    const rfpFillMesh = rfpFillMeshRef.current
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!scene || !dotsMesh || !squaresMesh || !rfpMesh || !rfpFillMesh || !renderer || !camera) return

    // Resolve theme colors once per update.
    const colorIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const colorAmber = cssVarToColor('--accent-amber', '#c49a45')
    const colorGreen = cssVarToColor('--accent-green', '#22c55e')
    const colorCyan = cssVarToColor('--accent-cyan', '#22d3ee')

    // Populate Claim dots (skip RFP dots — those go to the separate RFP mesh).
    const claimDots = layout.allDots.filter((d) => d.kind !== 'rfp')
    const rfpDots = layout.allDots.filter((d) => d.kind === 'rfp')

    // Phase 16.2.3: cache base colors per dot for the load animation +
    // hover-state color blending. Indexed by position in claimDots.
    layoutRef.current = layout
    const baseColors = new Array(claimDots.length)
    for (let i = 0; i < claimDots.length; i++) {
      const d = claimDots[i]
      if (d.colorVar === '--accent-amber') baseColors[i] = colorAmber.clone()
      else if (d.colorVar === '--accent-green') baseColors[i] = colorGreen.clone()
      else baseColors[i] = colorIndigo.clone()
    }
    baseDotColorsRef.current = baseColors

    const m = new THREE.Matrix4()
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
    // Phase 16.2.6.2: per-instance matrix bakes in the current zoom-driven
    // scale so the on-screen dot diameter stays capped at MAX_SCREEN_DOT_PX
    // when zoom > cap-threshold. Stored in dotScaleRef so the rescale-on-zoom
    // effect can write fresh matrices without recomputing positions.
    const initialDotScale = computeDotWorldSize(zoomRef.current) / (DOT_GRID * BASE_DOT_FACTOR)
    dotScaleRef.current = initialDotScale

    // Claim dots
    // Phase 16.2.3: opacities are pre-zeroed by the load-animation effect
    // when a new wave starts; otherwise default 1 (set via .fill(1) on the
    // initial array and on animation completion). Each dot's instance color
    // is its base color multiplied by its current opacity; since the
    // Directory background is opaque dark `--bg-deep`, scaling color → 0
    // makes the dot disappear into the background.
    const dotOpacities = dotOpacitiesRef.current
    const scaled = new THREE.Color()
    for (let i = 0; i < MAX_DOTS; i++) {
      if (i < claimDots.length) {
        const d = claimDots[i]
        m.makeScale(initialDotScale, initialDotScale, 1)
        m.setPosition(d.x, -d.y, 0)
        dotsMesh.setMatrixAt(i, m)
        let c = colorIndigo
        if (d.colorVar === '--accent-amber') c = colorAmber
        else if (d.colorVar === '--accent-green') c = colorGreen
        const op = dotOpacities[i]
        if (op >= 1) {
          dotsMesh.setColorAt(i, c)
        } else {
          scaled.copy(c).multiplyScalar(Math.max(0, op))
          dotsMesh.setColorAt(i, scaled)
        }
      } else {
        dotsMesh.setMatrixAt(i, hidden)
      }
    }
    dotsMesh.count = claimDots.length
    dotsMesh.instanceMatrix.needsUpdate = true
    if (dotsMesh.instanceColor) dotsMesh.instanceColor.needsUpdate = true

    // Phase 16.2.4: Actor squares replaced by the centered PillboxLabel.
    // The instanced mesh is kept (so existing scene-init / dispose paths
    // stay symmetric) but rendered with count=0 so no squares draw. The
    // `cluster.squareWorld` field still carries the cluster center for
    // the HTML PillboxLabel overlay's worldToScreen lookup.
    for (let i = 0; i < MAX_SQUARES; i++) squaresMesh.setMatrixAt(i, hidden)
    squaresMesh.count = 0
    squaresMesh.instanceMatrix.needsUpdate = true

    // RFP markers (hollow square outline + tinted indigo fill underneath).
    // Phase 16.2.6.6: per-instance matrix bakes the zoom-driven scale so the
    // on-screen marker size stays capped at MAX_SCREEN_RFP_PX when zoom is
    // above the cap threshold. Stored in rfpScaleRef so the rescale-on-zoom
    // effect can write fresh matrices without recomputing positions. Both
    // meshes (outline + fill) receive identical per-instance matrices.
    const initialRfpScale = computeRfpWorldSize(zoomRef.current) / RFP_BASE_OUTER
    rfpScaleRef.current = initialRfpScale
    const rfpHitMesh = rfpHitMeshRef.current
    // Phase 17.1: partition rfpMesh + rfpFillMesh on closed-and-owned.
    // The active actor sees their own closed RFPs rendered via the
    // dashed-outline `closedRfpMesh` below — the visible solid outline +
    // tinted fill at the same instance index are set to `hidden`. The
    // hit-test mesh (rfpHitMesh) carries ALL instances so the owner can
    // still click to reopen.
    const activePartyForClosed = layout?.activeParty
    for (let i = 0; i < MAX_RFPS; i++) {
      if (i < rfpDots.length) {
        const d = rfpDots[i]
        const isClosedOwned = d.rfp?.status === 'closed' && !!activePartyForClosed && d.rfp?.owner === activePartyForClosed
        m.makeScale(initialRfpScale, initialRfpScale, 1)
        m.setPosition(d.x, -d.y, 0)
        if (isClosedOwned) {
          rfpMesh.setMatrixAt(i, hidden)
          rfpFillMesh.setMatrixAt(i, hidden)
        } else {
          rfpMesh.setMatrixAt(i, m)
          rfpFillMesh.setMatrixAt(i, m)
        }
        // Phase 17.0: hit-test mesh tracks the same per-instance matrix
        // regardless of status (closed-owned still clickable for reopen).
        if (rfpHitMesh) rfpHitMesh.setMatrixAt(i, m)
      } else {
        rfpMesh.setMatrixAt(i, hidden)
        rfpFillMesh.setMatrixAt(i, hidden)
        if (rfpHitMesh) rfpHitMesh.setMatrixAt(i, hidden)
      }
    }
    rfpMesh.count = rfpDots.length
    rfpFillMesh.count = rfpDots.length
    rfpMesh.instanceMatrix.needsUpdate = true
    rfpFillMesh.instanceMatrix.needsUpdate = true
    if (rfpHitMesh) {
      rfpHitMesh.count = rfpDots.length
      rfpHitMesh.instanceMatrix.needsUpdate = true
    }

    // Phase 17.2: per-instance base colors on rfpMesh + rfpFillMesh —
    // initialised to white (which leaves the material color unchanged at
    // fragment-shader time). `flushRfpColors` writes brighter colors at
    // the hovered/selected index after every state change.
    const rfpBaseColor = new THREE.Color('#ffffff')
    const rfpBaseColors = new Array(rfpDots.length)
    for (let i = 0; i < rfpDots.length; i++) {
      rfpBaseColors[i] = rfpBaseColor.clone()
      rfpMesh.setColorAt(i, rfpBaseColor)
      rfpFillMesh.setColorAt(i, rfpBaseColor)
    }
    baseRfpColorsRef.current = rfpBaseColors
    if (rfpMesh.instanceColor) rfpMesh.instanceColor.needsUpdate = true
    if (rfpFillMesh.instanceColor) rfpFillMesh.instanceColor.needsUpdate = true

    // Phase 17.1: rebuild closed-RFP dashed outline geometry. Build a
    // BufferGeometry with 4 line segments per closed-owned RFP (each
    // segment = 2 vertices × 3 coords). With the bounded closed-owned
    // set the buffer is small enough that disposing + reattaching on
    // every layout / zoom change is trivial. `computeLineDistances()` is
    // REQUIRED after attaching the position attribute — without it the
    // LineDashedMaterial renders as a solid line.
    const closedRfpMesh = closedRfpMeshRef.current
    if (closedRfpMesh) {
      const closedOwnedRfps = []
      // Phase 17.2: build a map from rfpDots-index → closedOwned-index so
      // `flushRfpColors` can resolve a hover/select rfpIdx to the right
      // vertex range in the closed-RFP color buffer. The vertex layout is
      // 8 vertices per closed-owned RFP (4 line segments × 2 endpoints).
      const closedIdxMap = new Map()
      for (let i = 0; i < rfpDots.length; i++) {
        const d = rfpDots[i]
        if (d.rfp?.status === 'closed' && !!activePartyForClosed && d.rfp?.owner === activePartyForClosed) {
          closedIdxMap.set(i, closedOwnedRfps.length)
          closedOwnedRfps.push(d)
        }
      }
      closedRfpIdxMapRef.current = closedIdxMap
      const halfBase = RFP_BASE_OUTER / 2
      const half = halfBase * initialRfpScale
      const vertices = new Float32Array(closedOwnedRfps.length * 4 * 2 * 3)
      // Phase 17.2: matching per-vertex color buffer. Default colour = the
      // accent-indigo theme value (LineDashedMaterial.color is white, so the
      // per-vertex value becomes the actual rendered color via the
      // vertexColors multiplication path).
      const closedIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
      const colors = new Float32Array(closedOwnedRfps.length * 4 * 2 * 3)
      const closedBaseColors = new Array(closedOwnedRfps.length)
      let vIdx = 0
      let cIdx = 0
      for (let k = 0; k < closedOwnedRfps.length; k++) {
        const d = closedOwnedRfps[k]
        closedBaseColors[k] = closedIndigo.clone()
        const x = d.x
        const y = -d.y
        // top edge
        vertices[vIdx++] = x - half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        // right edge
        vertices[vIdx++] = x + half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        // bottom edge
        vertices[vIdx++] = x + half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x - half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        // left edge
        vertices[vIdx++] = x - half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x - half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        // Fill all 8 vertices with the base color.
        for (let v = 0; v < 8; v++) {
          colors[cIdx++] = closedIndigo.r
          colors[cIdx++] = closedIndigo.g
          colors[cIdx++] = closedIndigo.b
        }
      }
      baseClosedRfpColorsRef.current = closedBaseColors
      // Dispose previous geometry before replacing — the mesh keeps a
      // reference to its current `geometry`, so unattached old geometries
      // would leak otherwise.
      const prevGeom = closedRfpMesh.geometry
      const nextGeom = new THREE.BufferGeometry()
      nextGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      nextGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      closedRfpMesh.geometry = nextGeom
      closedRfpMesh.computeLineDistances()
      if (prevGeom) prevGeom.dispose()
    }

    dirtyRef.current = true

    // Phase 16.1.3 Item 1: force an explicit render after populating, so
    // the first paint includes dots even if the animate loop hasn't ticked
    // yet. Also covers the case where the wipe transition would otherwise
    // hide an empty frame.
    renderer.render(scene, camera)
    updateOverlayRef.current?.()

    // Use unused variable so eslint/no-unused-vars doesn't complain.
    void colorCyan
  }, [threeReady, layout])

  // ─── Phase 16.2.6.2: rescale per-instance dot matrices on zoom change ─
  // The base geometry sits at DOT_RADIUS (= DOT_GRID × BASE_DOT_FACTOR / 2).
  // At zooms below the cap-threshold the per-instance scale stays at 1.0
  // (no-op rewrite). Above the cap-threshold the scale shrinks so the
  // on-screen dot diameter stays pinned to MAX_SCREEN_DOT_PX. Mesh-level
  // `dotsMesh.scale` is intentionally NOT used (it would scale positions
  // too); instead each instance matrix bakes the scale via compose-style
  // makeScale + setPosition. 22k matrix updates per zoom change is cheap.
  useEffect(() => {
    if (!threeReady || !layout) return
    const dotsMesh = dotsMeshRef.current
    if (!dotsMesh) return
    const desiredScale = computeDotWorldSize(zoom) / (DOT_GRID * BASE_DOT_FACTOR)
    if (Math.abs(desiredScale - dotScaleRef.current) < 1e-4) return
    const claimDots = layout.allDots.filter((d) => d.kind !== 'rfp')
    const m = new THREE.Matrix4()
    for (let i = 0; i < claimDots.length; i++) {
      const d = claimDots[i]
      m.makeScale(desiredScale, desiredScale, 1)
      m.setPosition(d.x, -d.y, 0)
      dotsMesh.setMatrixAt(i, m)
    }
    dotsMesh.instanceMatrix.needsUpdate = true
    dotScaleRef.current = desiredScale
    dirtyRef.current = true
  }, [zoom, threeReady, layout])

  // ─── Phase 16.2.6.6: per-zoom rescale for RFP markers (outline + fill) ──
  // Mirror of the dot rescale-on-zoom effect above. Both RFP meshes share
  // the same per-instance matrices (position baked in, plus a uniform scale
  // baked via `makeScale + setPosition`), so we write to both in the same
  // pass. 118-marker matrix updates × 2 = trivially cheap per zoom change.
  // Declared BEFORE the border-rebuild useEffect so `rfpScaleRef.current`
  // is up-to-date when the border calculation reads it.
  useEffect(() => {
    if (!threeReady || !layout) return
    const rfpMesh = rfpMeshRef.current
    const rfpFillMesh = rfpFillMeshRef.current
    if (!rfpMesh || !rfpFillMesh) return
    const desiredScale = computeRfpWorldSize(zoom) / RFP_BASE_OUTER
    if (Math.abs(desiredScale - rfpScaleRef.current) < 1e-4) return
    const rfpDots = layout.allDots.filter((d) => d.kind === 'rfp')
    const m = new THREE.Matrix4()
    // Phase 17.1: local hidden-matrix mirror of the populate-effect's
    // `hidden` (each useEffect has its own scope). Used to suppress
    // outline + fill rendering for closed-owned instances at rescale time
    // — they'll render via the dashed-outline LineSegments below.
    const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0)
    // Phase 17.0: rescale the hit-test mesh in lockstep with outline + fill.
    // Phase 17.1: preserve the closed-owned partition during rescale —
    // closed-owned instances keep their outline + fill hidden, hit-test
    // stays normal at every zoom.
    const rfpHitMesh = rfpHitMeshRef.current
    const activePartyForClosed = layout?.activeParty
    for (let i = 0; i < rfpDots.length; i++) {
      const d = rfpDots[i]
      const isClosedOwned = d.rfp?.status === 'closed' && !!activePartyForClosed && d.rfp?.owner === activePartyForClosed
      m.makeScale(desiredScale, desiredScale, 1)
      m.setPosition(d.x, -d.y, 0)
      if (isClosedOwned) {
        rfpMesh.setMatrixAt(i, hiddenMatrix)
        rfpFillMesh.setMatrixAt(i, hiddenMatrix)
      } else {
        rfpMesh.setMatrixAt(i, m)
        rfpFillMesh.setMatrixAt(i, m)
      }
      if (rfpHitMesh) rfpHitMesh.setMatrixAt(i, m)
    }
    rfpMesh.instanceMatrix.needsUpdate = true
    rfpFillMesh.instanceMatrix.needsUpdate = true
    if (rfpHitMesh) rfpHitMesh.instanceMatrix.needsUpdate = true
    rfpScaleRef.current = desiredScale

    // Phase 17.1: rebuild closed-RFP dashed outline at the new scale.
    // The vertex buffer was baked at the previous scale; replacing it
    // here keeps the on-screen dashing size proportional to the rest of
    // the RFP markers as zoom changes. computeLineDistances() is
    // required after each rebuild.
    const closedRfpMesh = closedRfpMeshRef.current
    if (closedRfpMesh) {
      const closedOwnedRfps = rfpDots.filter(
        (d) => d.rfp?.status === 'closed' && !!activePartyForClosed && d.rfp?.owner === activePartyForClosed,
      )
      const half = (RFP_BASE_OUTER / 2) * desiredScale
      const vertices = new Float32Array(closedOwnedRfps.length * 4 * 2 * 3)
      // Phase 17.2: rebuild vertex colors at the new scale too —
      // `flushRfpColors` runs after this rebuild (via rfpDirtyRef) so the
      // baseline color attribute is sufficient here; the flush re-writes
      // the hovered/selected vertices.
      const closedIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
      const colors = new Float32Array(closedOwnedRfps.length * 4 * 2 * 3)
      let vIdx = 0
      let cIdx = 0
      for (const d of closedOwnedRfps) {
        const x = d.x
        const y = -d.y
        vertices[vIdx++] = x - half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x + half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x - half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x - half; vertices[vIdx++] = y - half; vertices[vIdx++] = 0
        vertices[vIdx++] = x - half; vertices[vIdx++] = y + half; vertices[vIdx++] = 0
        for (let v = 0; v < 8; v++) {
          colors[cIdx++] = closedIndigo.r
          colors[cIdx++] = closedIndigo.g
          colors[cIdx++] = closedIndigo.b
        }
      }
      const prevGeom = closedRfpMesh.geometry
      const nextGeom = new THREE.BufferGeometry()
      nextGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
      nextGeom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      closedRfpMesh.geometry = nextGeom
      closedRfpMesh.computeLineDistances()
      if (prevGeom) prevGeom.dispose()
    }
    dirtyRef.current = true
    // Phase 17.2: after rescale, re-flush colors so hover/select state
    // persists through zoom changes.
    rfpDirtyRef.current = true
  }, [zoom, threeReady, layout])

  // ─── Phase 16.2.6.3: rebuild RFP hollow-square geometry on zoom change ─
  // Border thickness is world-units. With the Phase 16.2.6.6 per-instance
  // scale on the RFP mesh, the geometry's on-screen size is
  // `border_geom × scale × zoom`. To keep on-screen border constant at
  // RFP_BORDER_SCREEN_PX, re-derive `border_geom = RFP_BORDER_SCREEN_PX /
  // (scale × zoom)`. Below the cap (scale = 1) this reduces to the
  // pre-16.2.6.6 formula `RFP_BORDER_SCREEN_PX / zoom`. Above the cap,
  // scale × zoom is constant so border_geom is constant too — the rebuild
  // settles on a single value. Position matrices are unaffected.
  useEffect(() => {
    if (!threeReady) return
    const rfpMesh = rfpMeshRef.current
    if (!rfpMesh) return
    const scale = rfpScaleRef.current
    const desiredBorder = RFP_BORDER_SCREEN_PX / (scale * zoom)
    // Skip rebuild for trivial changes (<5% delta) — avoids per-wheel-tick
    // geometry churn while the on-screen border stays visually constant.
    if (Math.abs(desiredBorder - rfpBorderRef.current) / rfpBorderRef.current < 0.05) return
    const newGeom = makeHollowSquareGeometry(RFP_BASE_OUTER, desiredBorder)
    const oldGeom = rfpMesh.geometry
    rfpMesh.geometry = newGeom
    oldGeom.dispose()
    rfpBorderRef.current = desiredBorder
    dirtyRef.current = true
  }, [zoom, threeReady])

  // ─── Phase 16.2.7: hide Claim-dots InstancedMesh in mid/full-LOD ────
  // Once zoom ≥ MID_LOD_THRESHOLD the Claim dots are replaced by the
  // AssetNodeMini / AssetNode HTML overlays in the render tree above.
  // Hiding the dot mesh prevents Three.js from drawing both at the same
  // time.
  // Phase 17.0.1: RFP meshes (outline + fill + hit-test) join the hide-
  // on-card-LOD pattern. Below MID_LOD_THRESHOLD the hollow squares render
  // and are clickable via the hit-test mesh; at or above the threshold the
  // mini-card / full-card HTML overlays take over (rendered in the card
  // overlay block) and the meshes hide. `rfpHitMesh` hiding matters
  // because the hit-test mesh is invisible but still raycastable — leaving
  // it visible would intercept clicks meant for the cards above.
  useEffect(() => {
    if (!threeReady) return
    const dotsMesh = dotsMeshRef.current
    const rfpMesh = rfpMeshRef.current
    const rfpFillMesh = rfpFillMeshRef.current
    const rfpHitMesh = rfpHitMeshRef.current
    const closedRfpMesh = closedRfpMeshRef.current
    if (!dotsMesh) return
    const cardLOD = zoom >= MID_LOD_THRESHOLD
    dotsMesh.visible = !cardLOD
    if (rfpMesh) rfpMesh.visible = !cardLOD
    if (rfpFillMesh) rfpFillMesh.visible = !cardLOD
    if (rfpHitMesh) rfpHitMesh.visible = !cardLOD
    // Phase 17.1: dashed-outline mesh joins the LOD-swap visibility group
    // — at card LOD, the AssetNode / AssetNodeMini RFP card variants
    // render the dashed-CSS-border treatment for closed-owned, replacing
    // this LineSegments overlay.
    if (closedRfpMesh) closedRfpMesh.visible = !cardLOD
    dirtyRef.current = true
  }, [zoom, threeReady])

  // ─── Phase 16.2.7: clear hover when crossing into mid/full-LOD ──────
  // Raycast against the now-hidden dot mesh returns no hits, so a stale
  // hover state would linger past the LOD transition and continue to
  // show the dot-LOD tooltip (also suppressed by the same threshold —
  // see the JSX render gate below). Clear it explicitly. `pinned` is
  // intentionally NOT cleared — it must survive LOD transitions so the
  // relevant card / dot renders with isSelected={true}.
  useEffect(() => {
    if (zoom >= MID_LOD_THRESHOLD && hover) setHover(null)
  }, [zoom, hover])

  // ─── Hover repaint via per-instance colors ───────────────────────────
  // Phase 16.2.3: consolidated into `flushDotColors` so the load-animation
  // wave + hover state + base color all blend via the same code path. The
  // hover effect just marks dotsDirtyRef so the animate loop flushes on
  // the next tick.
  useEffect(() => {
    dotsDirtyRef.current = true
    dirtyRef.current = true
  }, [hover, pinned])

  const flushDotColors = useCallback(() => {
    const mesh = dotsMeshRef.current
    const baseColors = baseDotColorsRef.current
    const layoutCur = layoutRef.current
    if (!mesh || !baseColors || baseColors.length === 0 || !layoutCur) return
    const colorWhite = new THREE.Color('#ffffff')
    const lerpToWhite = (base) => {
      const c = base.clone()
      c.lerp(colorWhite, 0.15)
      return c
    }
    const claimDots = layoutCur.allDots.filter((d) => d.kind !== 'rfp')
    const target = pinnedRef.current || hoverRef.current
    const targetIdx = target?.dotIndex ?? -1
    const targetClusterIdx = targetIdx >= 0 ? claimDots[targetIdx]?.clusterIdx : null
    const opacities = dotOpacitiesRef.current
    const scaled = new THREE.Color()
    for (let i = 0; i < baseColors.length; i++) {
      let c = baseColors[i]
      if (i === targetIdx) c = colorWhite
      else if (targetClusterIdx !== null && targetClusterIdx !== undefined && claimDots[i]?.clusterIdx === targetClusterIdx) {
        c = lerpToWhite(c)
      }
      const op = opacities[i]
      if (op < 1) {
        scaled.copy(c).multiplyScalar(Math.max(0, op))
        mesh.setColorAt(i, scaled)
      } else {
        mesh.setColorAt(i, c)
      }
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    dirtyRef.current = true
  }, [])
  useEffect(() => { flushDotColorsRef.current = flushDotColors }, [flushDotColors])
  // Flush after every layout change too (so the freshly-populated mesh
  // picks up the current hover/opacity state).
  useEffect(() => {
    if (!threeReady || !layout) return
    dotsDirtyRef.current = true
    dirtyRef.current = true
  }, [threeReady, layout])

  // ─── Phase 17.2: flush RFP marker colors on hover/select change. ─────
  //
  // Brightens the hovered or selected RFP marker's outline + fill (and
  // closed-RFP dashed outline, when applicable) toward white. The hovered
  // RFP index is tracked via `hoveredRfpIdxRef` (set by handleMouseMove);
  // the selected RFP index lives in `pinned.dotIndex` when `pinned.rfp`
  // is non-null. Selection takes precedence over hover (the selected
  // marker reaches full white; siblings hovered get a milder lerp).
  const flushRfpColors = useCallback(() => {
    const rfpMesh = rfpMeshRef.current
    const rfpFillMesh = rfpFillMeshRef.current
    const closedRfpMesh = closedRfpMeshRef.current
    const baseColors = baseRfpColorsRef.current
    if (!rfpMesh || !rfpFillMesh || !baseColors) return
    const pinnedRfp = pinnedRef.current?.rfp ? pinnedRef.current : null
    const selectedIdx = pinnedRfp ? (pinnedRfp.dotIndex ?? -1) : -1
    const hoveredIdx = hoveredRfpIdxRef.current
    const whiteColor = new THREE.Color('#ffffff')
    // Open / non-closed RFP outline + fill via instanceColor multiplier.
    // Base color = white (1,1,1) which multiplies out to the material's
    // indigo color at baseline. Hovered = 1.5× lerp toward white from the
    // already-saturated indigo (visible bump). Selected = the same brightening
    // (we don't have a stronger ceiling on instanceColor; the slight visual
    // difference between hover + select on the same marker is the +1.0
    // pinned tooltip card overlaying the marker on click).
    for (let i = 0; i < baseColors.length; i++) {
      let c = baseColors[i]    // base = white
      if (i === selectedIdx || i === hoveredIdx) {
        // Brighten by overshoot multiplier so the indigo perceptibly
        // brightens. Anything above 1.0 on an instanceColor channel pushes
        // the indigo base toward white at fragment-shader time.
        c = whiteColor
      }
      rfpMesh.setColorAt(i, c)
      rfpFillMesh.setColorAt(i, c)
    }
    if (rfpMesh.instanceColor) rfpMesh.instanceColor.needsUpdate = true
    if (rfpFillMesh.instanceColor) rfpFillMesh.instanceColor.needsUpdate = true
    // Closed-RFP dashed outline via per-vertex colors. Map an overall
    // rfpDots-index to its 8-vertex range in the color buffer; lerp toward
    // white at the hovered/selected vertices, restore base elsewhere.
    if (closedRfpMesh && closedRfpMesh.geometry) {
      const closedIdxMap = closedRfpIdxMapRef.current
      const closedBase = baseClosedRfpColorsRef.current
      const colorAttr = closedRfpMesh.geometry.getAttribute('color')
      if (colorAttr && closedBase && closedBase.length > 0) {
        const arr = colorAttr.array
        const c = new THREE.Color()
        for (let k = 0; k < closedBase.length; k++) {
          // Resolve overall rfp-index from the closed-subset index.
          let targetIsHighlighted = false
          for (const [overallIdx, closedIdx] of closedIdxMap.entries()) {
            if (closedIdx === k && (overallIdx === selectedIdx || overallIdx === hoveredIdx)) {
              targetIsHighlighted = true
              break
            }
          }
          if (targetIsHighlighted) {
            c.copy(closedBase[k]).lerp(new THREE.Color('#ffffff'), 0.55)
          } else {
            c.copy(closedBase[k])
          }
          const start = k * 8 * 3
          for (let v = 0; v < 8; v++) {
            arr[start + v * 3] = c.r
            arr[start + v * 3 + 1] = c.g
            arr[start + v * 3 + 2] = c.b
          }
        }
        colorAttr.needsUpdate = true
      }
    }
    dirtyRef.current = true
  }, [])
  useEffect(() => { flushRfpColorsRef.current = flushRfpColors }, [flushRfpColors])
  // Trigger a flush on pinned change (the click handler) AND on layout
  // change (so the freshly-populated mesh picks up current hover/pinned
  // state). Hover-driven flushes happen synchronously from handleMouseMove
  // — they don't depend on this effect.
  useEffect(() => {
    if (!threeReady || !layout) return
    rfpDirtyRef.current = true
    dirtyRef.current = true
  }, [threeReady, layout, pinned])

  // ─── Phase 16.2.3: loading animation entry trigger. ──────────────────
  // Fires when:
  //   • phase transitions closed → in (initial Directory entry).
  //   • roleId changes while phase === 'in' (role-switch re-entry).
  // Does NOT re-fire on:
  //   • Provisional updates (those change `layout` but not roleId / phase).
  //   • Window resize (changes `viewport` and thus layout).
  //   • Detail Panel open/close (just sets `pinned`; doesn't touch layout).
  // Resets camera to canvas-center at INITIAL_ZOOM, zeros all dot + label
  // opacities, then starts the wave. The handle is stored in
  // animationHandleRef so the empty-canvas click handler can call skip().
  useEffect(() => {
    if (phase === 'closed') {
      lastAnimatedRoleRef.current = null
      lastAnimatedPhaseRef.current = 'closed'
      return
    }
    if (phase !== 'in' || !threeReady) return
    const prevPhase = lastAnimatedPhaseRef.current
    const prevRole = lastAnimatedRoleRef.current
    // Only fire on (closed→in) or (in→in with role change).
    if (prevPhase === 'in' && prevRole === roleId) return
    lastAnimatedPhaseRef.current = phase
    lastAnimatedRoleRef.current = roleId

    // Cancel any in-flight animation cleanly.
    animationHandleRef.current?.skip()
    animationHandleRef.current = null

    // Reset camera + zoom to initial galactic-view state on every entry.
    zoomRef.current = INITIAL_ZOOM
    camPosRef.current = clampPan(OWN_CLUSTER_ANCHOR_X, CANVAS_HEIGHT / 2)
    setZoom(INITIAL_ZOOM)
    updateCamera()

    // Compute dot + label inputs for the wave animation. Read layout via
    // ref so this effect's deps stay tight to (phase, roleId, threeReady)
    // — provisional updates and window resizes recompute `layout` but must
    // NOT replay the animation per the brief.
    const layoutCur = layoutRef.current
    if (!layoutCur) return
    const claimDots = layoutCur.allDots.filter((d) => d.kind !== 'rfp')
    if (claimDots.length === 0) return
    // Per-cluster min-distance for label start times.
    const anchor = { x: OWN_CLUSTER_ANCHOR_X, y: OWN_CLUSTER_ANCHOR_Y }
    const minDistByCluster = new Map()
    for (const d of claimDots) {
      const dx = d.x - anchor.x
      const dy = d.y - anchor.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const prev = minDistByCluster.get(d.clusterIdx)
      if (prev === undefined || dist < prev) minDistByCluster.set(d.clusterIdx, dist)
    }
    const labels = layoutCur.allClusters.map((c, idx) => ({
      party: c.ownerParty,
      minDistFromAnchor: minDistByCluster.get(idx) ?? 0,
    }))
    // Phase 16.2.4: umbrella outlines fade in alongside their cluster
    // label. Distance metric = cluster centroid → anchor (same convention
    // as the label, since the outline lives at the cluster's location).
    const umbrellaOutlines = layoutCur.allClusters
      .filter((c) => c.umbrellaPathWorld && c.umbrellaPathWorld.length > 0)
      .map((c) => ({
        party: c.ownerParty,
        distFromAnchor: Math.hypot(c.center.x - anchor.x, c.center.y - anchor.y),
      }))

    // Pre-zero opacities + label state so the very first frame is blank.
    const opacities = dotOpacitiesRef.current
    for (let i = 0; i < opacities.length; i++) opacities[i] = 0
    const initialLabelOpacities = {}
    for (const l of labels) initialLabelOpacities[l.party] = 0
    setLabelOpacities(initialLabelOpacities)
    const initialUmbrellaOpacities = {}
    for (const u of umbrellaOutlines) initialUmbrellaOpacities[u.party] = 0
    setUmbrellaOpacities(initialUmbrellaOpacities)
    dotsDirtyRef.current = true
    dirtyRef.current = true

    // Start the wave.
    const handle = playDirectoryLoadAnimation({
      dots: claimDots.map((d) => ({ x: d.x, y: d.y })),
      labels,
      umbrellaOutlines,
      anchor,
      setDotOpacity: (idx, op) => {
        opacities[idx] = op
        dotsDirtyRef.current = true
      },
      setLabelOpacity: (party, op) => {
        setLabelOpacities((prev) => {
          if (prev[party] === op) return prev
          return { ...prev, [party]: op }
        })
      },
      setUmbrellaOpacity: (party, op) => {
        setUmbrellaOpacities((prev) => {
          if (prev[party] === op) return prev
          return { ...prev, [party]: op }
        })
      },
    })
    animationHandleRef.current = handle
    handle.promise.then(() => {
      if (animationHandleRef.current === handle) animationHandleRef.current = null
    })
    return () => {
      // If the effect re-fires (role change) or unmounts (phase=closed),
      // snap to the final state so the next entry starts from a known good
      // baseline.
      handle.skip()
      if (animationHandleRef.current === handle) animationHandleRef.current = null
    }
  }, [phase, roleId, threeReady, clampPan, updateCamera])

  // ─── Pointer event handlers ──────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    if (panAnimRef.current) { cancelAnimationFrame(panAnimRef.current); panAnimRef.current = null }
    draggingRef.current = true
    wasDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    camStartRef.current = { ...camPosRef.current }
  }, [])

  const raycast = useCallback((clientX, clientY) => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const dotsMesh = dotsMeshRef.current
    const rfpHitMesh = rfpHitMeshRef.current
    if (!renderer || !camera) return null
    const rect = renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    // Phase 17.0: raycast against both dot + RFP-hit meshes; pick the
    // closer hit by `distance`. `intersectObjects` sorts by distance
    // descending vs ascending? Per Three.js docs, `intersectObjects`
    // returns hits sorted by distance ascending (closer first) when
    // `recursive` is false on each object. We still consult both arrays
    // because we need to map an instanceId back to its source list (dot
    // vs RFP). RFPs are placed outside cluster dots so concurrent hits
    // are vanishingly unlikely; the closer-wins rule is defensive.
    const targets = []
    if (dotsMesh && dotsMesh.count > 0) targets.push(dotsMesh)
    if (rfpHitMesh && rfpHitMesh.count > 0) targets.push(rfpHitMesh)
    if (targets.length === 0) return null
    const hits = raycaster.intersectObjects(targets, false)
    if (hits.length === 0) return null
    const closest = hits[0]
    const instanceId = closest.instanceId ?? null
    if (instanceId === null) return null
    if (closest.object === rfpHitMesh) return { kind: 'rfp', index: instanceId }
    return { kind: 'dot', index: instanceId }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (draggingRef.current) {
      const z = zoomRef.current
      const dx = (e.clientX - dragStartRef.current.x) / z
      const dy = (e.clientY - dragStartRef.current.y) / z
      const rawDx = e.clientX - dragStartRef.current.x
      const rawDy = e.clientY - dragStartRef.current.y
      if (Math.abs(rawDx) > DRAG_THRESHOLD_PX || Math.abs(rawDy) > DRAG_THRESHOLD_PX) wasDragRef.current = true
      const clamped = clampPan(camStartRef.current.x - dx, camStartRef.current.y - dy)
      camPosRef.current = clamped
      updateCamera()
      return
    }
    const hit = raycast(e.clientX, e.clientY)
    // Phase 17.0: hover is Claim-only — RFP hover-preview (the tooltip
    // card) is deferred. Phase 17.2: but we DO track RFP hover for marker
    // brightening (the QA's "hover over an RFP hollow square → outline
    // brightens" item). Stored as a ref-only state (no tooltip render
    // depends on it) + a frame-level mark-as-dirty so `flushRfpColors`
    // runs once on the next render.
    if (!hit) {
      if (hover) setHover(null)
      if (hoveredRfpIdxRef.current !== -1) {
        hoveredRfpIdxRef.current = -1
        rfpDirtyRef.current = true
        dirtyRef.current = true
      }
      return
    }
    if (hit.kind === 'rfp') {
      // Update RFP hover state — clear any Claim hover.
      if (hover) setHover(null)
      if (hoveredRfpIdxRef.current !== hit.index) {
        hoveredRfpIdxRef.current = hit.index
        rfpDirtyRef.current = true
        dirtyRef.current = true
      }
      return
    }
    // Claim hover: clear any RFP hover from a previous tick.
    if (hoveredRfpIdxRef.current !== -1) {
      hoveredRfpIdxRef.current = -1
      rfpDirtyRef.current = true
      dirtyRef.current = true
    }
    const claimDots = layout?.allDots.filter((d) => d.kind !== 'rfp') || []
    const d = claimDots[hit.index]
    if (!d || !d.claim) {
      if (hover) setHover(null)
      return
    }
    const screen = worldToScreen(d.x, d.y)
    setHover({
      claim: d.claim,
      x: d.x, y: d.y,
      screenX: screen.x, screenY: screen.y,
      ownerParty: d.claim.owner,
      dotIndex: hit.index,
    })
  }, [hover, layout, clampPan, raycast, updateCamera, worldToScreen])

  const handleMouseUp = useCallback((e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (wasDragRef.current) return
    const hit = raycast(e.clientX, e.clientY)
    if (!hit) {
      // Phase 16.2.3: empty-canvas click during the load animation snaps
      // the wave to completion. Click missed a dot AND no drag → skip.
      if (animationHandleRef.current) {
        animationHandleRef.current.skip()
      }
      // Phase 17.0.1: clear BOTH possible pinned discriminators —
      // setPinned(null) handles the local tooltip; onClaimDotClick(null)
      // and onRfpClick(null) clear V2App's Detail Panel state on whichever
      // side is open. (Per the 17.0 wiring, V2App's onClaimDotClick(null)
      // dismisses the Claim panel; onRfpClick(null) was not invoked from
      // empty canvas before — extending here closes the loop.)
      setPinned(null)
      onClaimDotClick?.(null)
      onRfpClick?.(null)
      return
    }
    // Phase 17.0 + 17.0.1: RFP hit → fire onRfpClick + pan-to-center +
    // setPinned with RFP shape. setPinned with the RFP discriminator
    // overwrites any previously-pinned Claim tooltip, fixing the stale-
    // tooltip bug surfaced in 17.0 QA (click Claim → click RFP left the
    // Claim's pinned tooltip visible). The discriminator is presence of
    // `claim` XOR `rfp`; downstream render block branches on which one.
    if (hit.kind === 'rfp') {
      const rfpDots = layout?.allDots.filter((d) => d.kind === 'rfp') || []
      const d = rfpDots[hit.index]
      if (!d || !d.rfp) return
      const screen = worldToScreen(d.x, d.y)
      setPinned({
        rfp: d.rfp,
        x: d.x, y: d.y,
        screenX: screen.x, screenY: screen.y,
        ownerParty: d.rfp.owner,
        dotIndex: hit.index,
      })
      onRfpClick?.(d.rfp)
      const container = containerRef.current
      if (container) {
        const targetZoom = zoomRef.current
        const panelOffsetWorld = (PANEL_W / 2) / targetZoom
        animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)
      }
      return
    }
    const claimDots = layout?.allDots.filter((d) => d.kind !== 'rfp') || []
    const d = claimDots[hit.index]
    if (!d || !d.claim) return
    const screen = worldToScreen(d.x, d.y)
    setPinned({
      claim: d.claim,
      x: d.x, y: d.y,
      screenX: screen.x, screenY: screen.y,
      ownerParty: d.claim.owner,
      dotIndex: hit.index,
    })
    onClaimDotClick?.(d.claim)
    // Phase 16.1.3 Item 6: pan to center the clicked dot. Mirrors V2Canvas
    // — the visible area excludes the Detail Panel's width on the right,
    // so the camera target shifts left by panelOffsetWorld = (PANEL_W/2)/zoom.
    const container = containerRef.current
    if (container) {
      const targetZoom = zoomRef.current
      const panelOffsetWorld = (PANEL_W / 2) / targetZoom
      animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)
    }
  }, [layout, onClaimDotClick, onRfpClick, raycast, worldToScreen, animatedPanToWithZoom])

  // ─── Phase 16.2.7 / 16.2.9: card click in mid-LOD / full-LOD ─────────
  // Mirrors the dot click flow including the animated pan-to-center
  // (added in 16.2.9 after correcting the 16.2.7 design decision — the
  // user is "already viewing the card" rationale missed that the Detail
  // Panel opens on the right and partially covers the card without the
  // panelOffsetWorld correction). targetZoom = current zoom — no zoom
  // change, just pan. 500ms animation matches dot click for continuity.
  //
  // Phase 17.0.1: branch on `d.kind === 'rfp'` to fire onRfpClick + pin
  // an RFP tooltip. setPinned overwrites previously-pinned state, so the
  // stale-tooltip bug (clicking from Claim to RFP card or vice versa)
  // resolves naturally — `pinned` carries exactly one of `claim` / `rfp`.
  const onCardClick = useCallback((d, dotIdx) => {
    const screen = worldToScreen(d.x, d.y)
    if (d.kind === 'rfp') {
      setPinned({
        rfp: d.rfp,
        x: d.x, y: d.y,
        screenX: screen.x, screenY: screen.y,
        ownerParty: d.rfp?.owner,
        dotIndex: dotIdx,
      })
      onRfpClick?.(d.rfp)
    } else {
      setPinned({
        claim: d.claim,
        x: d.x, y: d.y,
        screenX: screen.x, screenY: screen.y,
        ownerParty: d.claim?.owner,
        dotIndex: dotIdx,
      })
      onClaimDotClick?.(d.claim)
    }
    // Phase 16.2.9 Item 1: pan-to-center on card click, mirroring the
    // dot-click handler — Detail Panel opens on the right, so the camera
    // shifts left by panelOffsetWorld = (PANEL_W/2) / zoom so the clicked
    // card sits in the visible left portion of the viewport.
    const container = containerRef.current
    if (container) {
      const targetZoom = zoomRef.current
      const panelOffsetWorld = (PANEL_W / 2) / targetZoom
      animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)
    }
  }, [onClaimDotClick, onRfpClick, worldToScreen, animatedPanToWithZoom])

  // ─── Zoom controls (top-right, parent-parity) ────────────────────────
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const dir = e.deltaY > 0 ? 0.95 : 1.05
    const oldZoom = zoomRef.current
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * dir))
    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const worldX = camPosRef.current.x + (mx - rect.width / 2) / oldZoom
      const worldY = camPosRef.current.y + (my - rect.height / 2) / oldZoom
      const newCamX = worldX - (mx - rect.width / 2) / newZoom
      const newCamY = worldY - (my - rect.height / 2) / newZoom
      camPosRef.current = clampPan(newCamX, newCamY)
    }
    zoomRef.current = newZoom
    setZoom(newZoom)
    updateCamera()
  }, [clampPan, updateCamera])

  useEffect(() => {
    if (phase === 'closed') return
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel, phase])

  const zoomIn = useCallback(() => {
    zoomRef.current = Math.min(MAX_ZOOM, zoomRef.current * 1.15)
    setZoom(zoomRef.current)
    updateCamera()
  }, [updateCamera])
  const zoomOut = useCallback(() => {
    zoomRef.current = Math.max(MIN_ZOOM, zoomRef.current * 0.87)
    setZoom(zoomRef.current)
    updateCamera()
  }, [updateCamera])
  const zoomFit = useCallback(() => {
    // Phase 16.2.3: FIT targets the bounded canvas (not the cluster-bbox
    // aggregate). Camera centers on (canvas-center-x, canvas-center-y);
    // zoom is set so [0, CANVAS_WIDTH] × [0, CANVAS_HEIGHT] fits inside the
    // viewport with aspect ratio preserved.
    const container = containerRef.current
    if (!container) return
    const fitZoom = Math.min(
      container.clientWidth / CANVAS_WIDTH,
      container.clientHeight / CANVAS_HEIGHT,
    )
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom))
    zoomRef.current = newZoom
    camPosRef.current = clampPan(OWN_CLUSTER_ANCHOR_X, CANVAS_HEIGHT / 2)
    setZoom(newZoom)
    updateCamera()
  }, [clampPan, updateCamera])

  // Phase 16.2.3: zoom display maps `zoom` directly to a percentage so
  // 0.1 → "10%", 1.0 → "100%", 4.0 → "400%".
  const zoomPct = Math.round(zoom * 100) + '%'

  // Hover/pinned screen position sync.
  useEffect(() => {
    if (!hover) return
    const screen = worldToScreen(hover.x, hover.y)
    if (Math.abs(screen.x - hover.screenX) > 0.5 || Math.abs(screen.y - hover.screenY) > 0.5) {
      setHover((h) => h ? { ...h, screenX: screen.x, screenY: screen.y } : h)
    }
  }, [overlay, hover, worldToScreen])
  useEffect(() => {
    if (!pinned) return
    const screen = worldToScreen(pinned.x, pinned.y)
    if (Math.abs(screen.x - pinned.screenX) > 0.5 || Math.abs(screen.y - pinned.screenY) > 0.5) {
      setPinned((p) => p ? { ...p, screenX: screen.x, screenY: screen.y } : p)
    }
  }, [overlay, pinned, worldToScreen])

  if (phase === 'closed') return null

  const activeHoverScreen = hover ? { x: hover.screenX, y: hover.screenY } : (pinned ? { x: pinned.screenX, y: pinned.screenY } : null)
  const fadePillboxFor = (centerX, centerY) => {
    const pillX = centerX
    const pillY = centerY - ACTOR_SQUARE / 2 - ACTOR_LABEL_OFFSET
    return isHoverNearPillbox(activeHoverScreen, pillX, pillY)
  }

  return (
    <div
      data-v22-directory-layer
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => { draggingRef.current = false; setHover(null) }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        clipPath,
        WebkitClipPath: clipPath,
        transition: 'clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1), -webkit-clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1)',
        background: 'var(--bg-deep)',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: draggingRef.current ? 'grabbing' : 'default' }}
      />

      {/* Header pillbox. */}
      <div style={{
        position: 'absolute',
        top: 80,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '6px 16px',
        borderRadius: 999,
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        pointerEvents: 'none',
        // Phase 16.2.6.4 follow-up (2026-05-17): bumped 11 → 2000 so the
        // RADIANT NETWORK header pillbox sits above every cluster label
        // (z=100-175) and every RFP owner label (z=1100), while staying
        // well below Detail Panels / modals / EdgeHoverMenu (5900+).
        zIndex: 2000,
      }}>Radiant Network</div>

      {/* SVG overlay — umbrella subset concave/convex hull outline (Phase
          16.2.4: replaces the rectangular L-shape from Phase 16.0/16.1.3.
          Color reverts to amber per the brief: amber stroke + 8% amber
          fill flag the umbrella subset within a cluster). Opacity per-
          cluster is driven by the load-animation wave. */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {overlay?.umbrellaPaths?.map((p) => {
          if (!p.screenPoints || p.screenPoints.length === 0) return null
          // Phase 16.2.6.1: drop the umbrella path entirely if any vertex is
          // non-finite (worldToScreen returned NaN — happens in a brief
          // mount-race window before the projection matrix is initialised,
          // and previously surfaced as a `NaN` invalid CSS-style React warn).
          const finitePts = p.screenPoints.filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y))
          if (finitePts.length < p.screenPoints.length || finitePts.length === 0) return null
          const d = finitePts.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ') + ' Z'
          const op = umbrellaOpacities[p.ownerParty]
          const opacity = op === undefined ? 1 : op
          return (
            <path
              key={`umbrella-${p.ownerParty}`}
              d={d}
              stroke="var(--accent-amber)"
              strokeWidth={1.5}
              fill="color-mix(in srgb, var(--accent-amber) 8%, transparent)"
              strokeLinejoin="round"
              opacity={opacity}
            />
          )
        })}
      </svg>

      {/* Pillbox labels (HTML overlay; positioned via worldToScreen). */}
      {layout && overlay && (() => {
        // Phase 16.2.6.3: derive label font-size from current zoom once per
        // render — sqrt scaling clamped to MIN/MAX (see computeLabelFontSize).
        const labelFontPx = computeLabelFontSize(zoom)
        // Phase 16.2.6.4: assign per-cluster zIndex inversely to dotCount —
        // smallest cluster gets the highest z so its label renders on top
        // of any larger-cluster label it collides with. Sort once per render,
        // then map party → z-rank for the actual render pass below.
        const clusterZByParty = new Map()
        const sortedByDots = [...layout.allClusters].sort(
          (a, b) => (b.dots?.length || 0) - (a.dots?.length || 0)
        )
        sortedByDots.forEach((cluster, rank) => {
          clusterZByParty.set(cluster.ownerParty, Z_BASE_CLUSTER_LABEL + rank)
        })
        return layout.allClusters.map((cluster) => {
          const screen = overlay.ownerSquares.find((s) => s.ownerParty === cluster.ownerParty)?.screen
          if (!screen) return null
          const faded = fadePillboxFor(screen.x, screen.y)
          // Phase 16.2.3: opacity defaults to 1 (loaded). During the wave
          // animation each cluster's entry ramps 0 → 1; the value comes
          // from `labelOpacities[party]` set by the helper.
          const op = labelOpacities[cluster.ownerParty]
          const labelOp = op === undefined ? 1 : op
          return (
            <PillboxLabel
              key={cluster.ownerParty}
              ownerParty={cluster.ownerParty}
              x={screen.x}
              y={screen.y}
              faded={faded}
              opacity={labelOp}
              fontPx={labelFontPx}
              zIndex={clusterZByParty.get(cluster.ownerParty) ?? Z_BASE_CLUSTER_LABEL}
            />
          )
        })
      })()}

      {/* Phase 16.2.6.3: owner-actor label below each RFP marker. Suppressed
          when the RFP's owning actor IS the active actor (avoids duplicate
          label next to the cluster's own pillbox). Position computed in
          world coords below the marker (1 cell of breathing room below the
          square's bottom edge) and projected through worldToScreen. */}
      {layout && (() => {
        const labelFontPx = computeLabelFontSize(zoom)
        const activeParty = layout.activeParty
        return layout.allDots.map((d, i) => {
          if (d.kind !== 'rfp') return null
          // Phase 16.2.6.5: only render the per-marker owner label for
          // ORPHAN RFPs (clusterIdx === -1 — set by computeLayout for RFPs
          // that don't belong to a Voronoi cluster; currently only the
          // four-primary-parties path, e.g. GovCo on non-Bob views).
          // RFPs inside clusters get their owner identity from the cluster's
          // own label (rendered above at a higher z).
          if (d.clusterIdx !== -1) return null
          const ownerParty = d.rfp?.owner
          if (!ownerParty || ownerParty === activeParty) return null
          const labelY = d.y + RFP_OUTER_SIZE / 2 + DOT_GRID
          const screen = worldToScreen(d.x, labelY)
          return (
            <PillboxLabel
              key={`rfp-owner-${ownerParty}-${i}`}
              ownerParty={ownerParty}
              x={screen.x}
              y={screen.y}
              faded={false}
              opacity={1}
              fontPx={labelFontPx}
              zIndex={Z_RFP_LABEL}
            />
          )
        })
      })()}

      {/* Phase 16.2.7: LOD card overlay. At zoom ≥ MID_LOD_THRESHOLD,
          Claim dots are replaced by AssetNodeMini (mid-LOD) or AssetNode
          (full-LOD) HTML overlays positioned at the dot's projected
          screen position. Cards render at natural pixel size — no scale
          transform — so they fit cleanly given the density invariant
          (zoom × DOT_GRID ≥ card_width_px at the threshold). Viewport
          culled: only dots whose screen position falls inside the viewport
          plus a one-card buffer on each edge are rendered. Cluster
          pillbox labels stay as well.
          Phase 17.0.1: RFPs join the LOD card overlay — each RFP entry
          renders an AssetNode (full-LOD) / AssetNodeMini (mid-LOD) with
          a synthetic node carrying `category: 'rfp'` so the new RFP
          early-return branch in AssetNode.jsx fires. The visible hollow-
          square outline + hit-test mesh are hidden at this LOD (see the
          `useEffect` above). */}
      {layout && zoom >= MID_LOD_THRESHOLD && (() => {
        const isFullLOD = zoom >= LOD_THRESHOLD
        const cardW = isFullLOD ? CARD_W : MINI_CARD_W
        const cardH = isFullLOD ? CARD_H : MINI_CARD_H
        // Phase 17.0.1: iterate both Claim and RFP entries from allDots.
        // Each entry decides locally whether to render a Claim or RFP card.
        const cardDots = layout.allDots.filter((d) =>
          (d.kind !== 'rfp' && d.claim) || (d.kind === 'rfp' && d.rfp)
        )
        const minX = -cardW
        const maxX = viewport.w + cardW
        const minY = -cardH
        const maxY = viewport.h + cardH
        return cardDots.map((d, i) => {
          const screen = worldToScreen(d.x, d.y)
          // Viewport-cull. Skip cards outside viewport + one-card buffer.
          if (!Number.isFinite(screen.x) || !Number.isFinite(screen.y)) return null
          if (screen.x < minX || screen.x > maxX || screen.y < minY || screen.y > maxY) return null
          const Card = isFullLOD ? AssetNode : AssetNodeMini
          if (d.kind === 'rfp') {
            const isSelected = pinned?.rfp === d.rfp
            // Phase 17.0.1: synthetic node shape consumed by AssetNode's
            // RFP early-return. category='rfp' routes the dispatcher; the
            // `rfp` field carries the original artifact for downstream
            // lookups (e.g. tooltip preview).
            // Phase 17.1: `isClosed` drives the dashed-CSS-border treatment
            // on the RFP card variants when the active actor owns a closed
            // RFP. Closed-but-not-owned won't reach this point (the view-
            // builder filters them out); defensive guard preserved on the
            // owner match just in case.
            const isClosedOwned = d.rfp?.status === 'closed' && d.rfp?.owner === layout.activeParty
            const rfpSyntheticNode = {
              id: d.rfp.id,
              category: 'rfp',
              rfp: d.rfp,
              name: d.rfp.name,
              ownerParty: d.rfp.owner,
              owner: d.rfp.owner,
              isClosed: isClosedOwned,
            }
            return (
              <div
                key={`rfp-card-${i}`}
                style={{
                  position: 'absolute',
                  left: screen.x,
                  top: screen.y,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'auto',
                  zIndex: isSelected ? 1600 : 1500,
                }}
              >
                <Card
                  node={rfpSyntheticNode}
                  isSelected={isSelected}
                  onSelect={() => onCardClick(d, i)}
                  activeParty={layout.activeParty}
                />
              </div>
            )
          }
          const isSelected = pinned?.claim === d.claim
          return (
            <div
              key={`claim-card-${i}`}
              style={{
                position: 'absolute',
                left: screen.x,
                top: screen.y,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'auto',
                // z=1500 sits between the highest RFP owner label (z=1100)
                // and the existing tooltip/modal stack. Selected card pops
                // to 1600 so it draws above its un-pinned peers.
                zIndex: isSelected ? 1600 : 1500,
              }}
            >
              <Card
                node={d.node || d.claim}
                isSelected={isSelected}
                onSelect={() => onCardClick(d, i)}
                activeParty={layout.activeParty}
                disclosureType={d.disclosureType}
              />
            </div>
          )
        })
      })()}

      {/* Tooltip (singleton). Phase 16.2.7: legacy tooltip only renders
          in dot-LOD. In mid-LOD and full-LOD, AssetNodeMini / AssetNode
          have their own internal hover behavior — suppress the Directory's
          tooltip to avoid duplication.
          Phase 17.0.1: discriminator branch — `pinned`/`hover` may carry
          either `claim` or `rfp` (never both). Render the matching tooltip
          variant. `hover` stays Claim-only (RFP hover preview at dot-LOD
          is deferred — the hover-preview portal on cards handles preview
          at mid/full LOD), so the rfp branch is reachable via `pinned`. */}
      {zoom < MID_LOD_THRESHOLD && (hover || pinned) && (() => {
        const t = pinned || hover
        if (t.rfp) {
          return <RfpTooltipCard rfp={t.rfp} x={t.screenX ?? 0} y={t.screenY ?? 0} viewportW={viewport.w} />
        }
        if (t.claim) {
          return <ClaimTooltipCard claim={t.claim} x={t.screenX ?? 0} y={t.screenY ?? 0} viewportW={viewport.w} />
        }
        return null
      })()}

      {/* Phase 16.1.3 Item 4: zoom controls top-right, vertical position
          matches parent layer (below the 61px chrome bar). */}
      <div style={{
        position: 'absolute',
        top: 73,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 50,
        pointerEvents: 'auto',
      }}>
        {[
          { label: '+', onClick: zoomIn },
          { label: '−', onClick: zoomOut },
          { label: 'FIT', onClick: zoomFit },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={(e) => { e.stopPropagation(); btn.onClick() }}
            style={{
              width: 28, height: 28,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: btn.label === 'FIT' ? 8 : 14,
              cursor: 'pointer',
              padding: 0,
              lineHeight: 1,
            }}
          >{btn.label}</button>
        ))}
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-tertiary)',
          marginTop: 2,
        }}>{zoomPct}</div>
      </div>

      {/* Exit hint (back-to-network, top-left). */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        cursor: 'pointer',
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        letterSpacing: '0.06em',
        color: 'var(--text-secondary)',
        zIndex: 10,
      }}
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-raised)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-surface)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <span>← Back to Network</span>
      </div>
    </div>
  )
}
