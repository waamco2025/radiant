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
// Phase 16.2.6.1: 0.425 → 0.475. With dense-pack adjacent dots one cell
// apart center-to-center, diameter = DOT_GRID × 0.95 leaves a thin ~5%
// visible gap between dot edges. Going to 1.0 (full cell fill) makes
// adjacent dots butt with no visible gap at all, which is visually crisper
// but more sensitive to antialiasing. 0.95 is the sweet spot.
const DOT_RADIUS = DOT_GRID * 0.475                    // ≈ 22.8 (diameter ≈ 0.95 × DOT_GRID)
const ACTOR_SQUARE = 6
const ACTOR_BORDER = 1                // hollow square border thickness (world units)
const RFP_BORDER = 1                  // hollow RFP circle border thickness
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
const MAX_ZOOM = 4.0
const INITIAL_ZOOM = 0.15
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
        zIndex: 30,
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

function PillboxLabel({ ownerParty, x, y, faded, opacity = 1 }) {
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
        transform: 'translate(-50%, -50%)',
        padding: '3px 8px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--bg-card) 92%, var(--text-dim))',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-display)',
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
        opacity: opacity * hoverFade,
        // Skip the transition while the load-in animation drives opacity
        // (between 0 and 1 exclusive) — the helper applies its own ramp
        // each frame, and a CSS transition would smear it.
        transition: opacity >= 1 ? 'opacity 150ms ease' : 'none',
        pointerEvents: 'none',
        zIndex: 4,
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
    const umbrellaItems = (cluster.umbrellaClaims || []).map((c) => ({
      claim: c,
      disclosureType: cluster.umbrellaTypeByClaimId?.[c.id] || 'full',
      kind: 'umbrella',
    }))
    const publicItems = (cluster.publicClaims || []).map((c) => ({
      claim: c,
      disclosureType: cluster.publicTypeByClaimId?.[c.id] || 'full',
      kind: 'public',
    }))
    return { umbrellaItems, publicItems }
  }
  // Active Actor's own cluster — always present in clusterSpecs so the
  // tessellation has an anchor seed. dot_count = 0 if no own claims (Carol).
  const activeOwnUmbrella = []
  const activeOwnPublic = (directoryData.ownClaims || []).map((c) => ({
    claim: c, disclosureType: 'full', kind: 'public',
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
    const { umbrellaItems, publicItems } = buildItems(c)
    clusterSpecs.push({
      ownerParty: c.ownerParty,
      isOwnCluster: false,
      umbrellaItems,
      publicItems,
      rfpItems: [],
      isUserVisible: true,
    })
  }
  const dotCountOf = (s) => s.umbrellaItems.length + s.publicItems.length + s.rfpItems.length

  // ─── Step 2: Lloyd-iterated centroidal Voronoi tessellation ──────────
  // Seed positions: active pinned, others seeded by hash → deterministic
  // (CANVAS_WIDTH/HEIGHT-bounded) start, then relaxed toward centroid each
  // iteration. Cells target area ∝ dot count.
  const seeds = clusterSpecs.map((spec, i) => {
    if (i === 0) return [userCenterX, userCenterY]
    const h = hashString(spec.ownerParty)
    // Hash-derived deterministic position avoiding the immediate anchor
    // neighborhood — keep initial seeds in the upper 70% of the canvas so
    // Lloyd's converges quickly toward the desired fan-out shape.
    const ax = ((h * 31) >>> 0) % 10000 / 10000
    const ay = ((h * 17) >>> 0) % 10000 / 10000
    return [
      0.1 * CANVAS_WIDTH + ax * 0.8 * CANVAS_WIDTH,
      0.1 * CANVAS_HEIGHT + ay * 0.55 * CANVAS_HEIGHT,
    ]
  })
  const canvasArea = CANVAS_WIDTH * CANVAS_HEIGHT
  // Phase 16.2.6.1: physically-grounded target area replaces the
  // proportional `share × canvasArea` formula. Each cluster needs
  // (dots × DOT_GRID²) for its grid cells + LABEL_HOLE_AREA for the centred
  // label rectangle, scaled by an inefficiency factor that absorbs perimeter
  // rounding losses + Lloyd's convergence wobble. Empty clusters (Carol's
  // anonymous anchor) still get the label hole's worth of area so they
  // can't be squeezed to zero by neighbouring jumbos.
  const targetAreas = clusterSpecs.map((spec) => {
    const n = dotCountOf(spec)
    return (n * DOT_GRID * DOT_GRID + LABEL_HOLE_AREA) * BUFFER_OVERHEAD_FACTOR
  })
  const targetSum = targetAreas.reduce((s, a) => s + a, 0)
  if (targetSum > canvasArea && typeof console !== 'undefined') {
    // eslint-disable-next-line no-console
    console.warn(`[DirectoryLayer] Lloyd's target-area sum ${(targetSum / 1e6).toFixed(2)} Mwu² exceeds canvas area ${(canvasArea / 1e6).toFixed(2)} Mwu² — clusters will compete; expect overflow.`)
  }
  let lloydIters = 0
  let lloydConverged = false
  let lloydMaxDisplacement = 0
  for (let iter = 0; iter < LLOYD_MAX_ITER; iter++) {
    lloydIters = iter + 1
    const delaunay = Delaunay.from(seeds)
    const voronoi = delaunay.voronoi([0, 0, CANVAS_WIDTH, CANVAS_HEIGHT])
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
      const newY = seeds[i][1] + (ccy - seeds[i][1]) * stepFactor
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
  const finalVoronoi = finalDelaunay.voronoi([0, 0, CANVAS_WIDTH, CANVAS_HEIGHT])

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
          rfp: item.rfp || null,
          type: item.kind === 'umbrella' ? 'umbrella' : (item.kind || 'public'),
          clusterIdx: ci,
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
        rfp: d.rfp || null,
        clusterIdx: ci,
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
  // eslint-disable-next-line no-unused-vars
  onOpenAIShopper,
  onClose,
  onClaimDotClick,
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
  const originStr = activeOrigin
    ? `${Math.round(activeOrigin.x)}px ${Math.round(activeOrigin.y)}px`
    : '0% 100%'
  const clipCollapsed = `circle(0% at ${originStr})`
  const clipExpanded = `circle(180% at ${originStr})`
  const clipPath = phase === 'in' ? clipExpanded : clipCollapsed

  // ─── Per-role data + viewport + layout ──────────────────────────────
  const directoryData = useMemo(() => {
    if (!roleId) return null
    const base = buildV22DirectoryDataForRole(roleId, v22Provisionals)
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
  }, [roleId, v22Provisionals])

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
  const actorSquaresMeshRef = useRef(null)
  const rfpMeshRef = useRef(null)
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
  useEffect(() => { if (phase === 'closed') { setHover(null); setPinned(null) } }, [phase])
  useEffect(() => { setHover(null); setPinned(null) }, [roleId])

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

    const rfpGeometry = makeHollowCircleGeometry(DOT_RADIUS, RFP_BORDER)
    const rfpMaterial = new THREE.MeshBasicMaterial({ color: cssVarToColor('--accent-cyan', '#22d3ee') })
    const rfpMesh = new THREE.InstancedMesh(rfpGeometry, rfpMaterial, MAX_RFPS)
    rfpMesh.count = 0
    rfpMesh.frustumCulled = false
    rfpMesh.boundingSphere = unboundedSphere()
    scene.add(rfpMesh)
    rfpMeshRef.current = rfpMesh

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
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      gridGroupRef.current = null
      dotsMeshRef.current = null
      actorSquaresMeshRef.current = null
      rfpMeshRef.current = null
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
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (!scene || !dotsMesh || !squaresMesh || !rfpMesh || !renderer || !camera) return

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
        m.makeTranslation(d.x, -d.y, 0)
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

    // RFP dots (hollow circles).
    for (let i = 0; i < MAX_RFPS; i++) {
      if (i < rfpDots.length) {
        const d = rfpDots[i]
        m.makeTranslation(d.x, -d.y, 0)
        rfpMesh.setMatrixAt(i, m)
      } else {
        rfpMesh.setMatrixAt(i, hidden)
      }
    }
    rfpMesh.count = rfpDots.length
    rfpMesh.instanceMatrix.needsUpdate = true

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
    const mesh = dotsMeshRef.current
    if (!renderer || !camera || !mesh || mesh.count === 0) return null
    const rect = renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObject(mesh, false)
    if (hits.length > 0) return hits[0].instanceId ?? null
    return null
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
    const dotIdx = raycast(e.clientX, e.clientY)
    if (dotIdx === null) {
      if (hover) setHover(null)
      return
    }
    const claimDots = layout?.allDots.filter((d) => d.kind !== 'rfp') || []
    const d = claimDots[dotIdx]
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
      dotIndex: dotIdx,
    })
  }, [hover, layout, clampPan, raycast, updateCamera, worldToScreen])

  const handleMouseUp = useCallback((e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (wasDragRef.current) return
    const dotIdx = raycast(e.clientX, e.clientY)
    if (dotIdx === null) {
      // Phase 16.2.3: empty-canvas click during the load animation snaps
      // the wave to completion. Click missed a dot AND no drag → skip.
      if (animationHandleRef.current) {
        animationHandleRef.current.skip()
      }
      setPinned(null)
      onClaimDotClick?.(null)
      return
    }
    const claimDots = layout?.allDots.filter((d) => d.kind !== 'rfp') || []
    const d = claimDots[dotIdx]
    if (!d || !d.claim) return
    const screen = worldToScreen(d.x, d.y)
    setPinned({
      claim: d.claim,
      x: d.x, y: d.y,
      screenX: screen.x, screenY: screen.y,
      ownerParty: d.claim.owner,
      dotIndex: dotIdx,
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
  }, [layout, onClaimDotClick, raycast, worldToScreen, animatedPanToWithZoom])

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
        zIndex: 11,
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
      {layout && overlay && layout.allClusters.map((cluster) => {
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
          />
        )
      })}

      {/* Tooltip (singleton). */}
      {(hover || pinned) && (() => {
        const t = pinned || hover
        return <ClaimTooltipCard claim={t.claim} x={t.screenX ?? 0} y={t.screenY ?? 0} viewportW={viewport.w} />
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
