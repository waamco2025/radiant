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
import { buildV22DirectoryDataForRole, buildV22SharedArtifacts, mergeProvisionals } from './v2_2Data.js'
import { playDirectoryLoadAnimation } from './directoryLoadAnimation.js'

// ─── Layout constants (world units) ────────────────────────────────────
const DOT_GRID = 12
const DOT_RADIUS = 3
const ACTOR_SQUARE = 6
const ACTOR_BORDER = 1                // hollow square border thickness (world units)
const RFP_BORDER = 1                  // hollow RFP circle border thickness
const MAX_COLS = 6
const ROW_GAP = DOT_GRID
const COL_GAP = DOT_GRID
const ACTOR_LABEL_OFFSET = 18
const CLUSTER_PAD = 5
const TOOLTIP_W = 230
const TOOLTIP_OFFSET = 12
const CLUSTER_BUFFER_CELLS = 12
const CLUSTER_BUFFER = CLUSTER_BUFFER_CELLS * DOT_GRID

// Phase 16.2.3: bounded canvas matching 16" MacBook Pro logical resolution
// at 10% zoom (default INITIAL_ZOOM = 0.1). At default zoom the canvas
// exactly fills the MBP viewport so the user sees the whole galactic view
// on first load.
const CANVAS_WIDTH = 17280
const CANVAS_HEIGHT = 11170
// Active Actor's own cluster anchors at canvas-bottom-center, shifted up
// 20% from the bottom edge so the cluster has visual breathing room above
// the footer.
const OWN_CLUSTER_ANCHOR_X = CANVAS_WIDTH / 2          // 8640
const OWN_CLUSTER_ANCHOR_Y = CANVAS_HEIGHT * 0.8       // 8936

// ─── Camera / zoom constants ───────────────────────────────────────────
// Phase 16.2.3: galactic-view defaults — load fully zoomed out (0.1 = 10%)
// so the whole 17280×11170 canvas fits in the viewport.
const MIN_ZOOM = 0.1
const MAX_ZOOM = 4.0
const INITIAL_ZOOM = 0.1
// Phase 16.2.3: grid spans the full canvas with sparser spacing (4×DOT_GRID)
// to keep the THREE.Points buffer count reasonable (~84k points).
const GRID_SPACING = DOT_GRID * 4
const GRID_MARGIN = 600
const DRAG_THRESHOLD_PX = 4
const PANEL_W = 480                   // Detail Panel width — mirrors V2App's PANEL_W

// Phase 16.1.3 Item 2 + 9: max InstancedMesh capacity for stable lifecycle.
const MAX_DOTS = 10000
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
        top: y - ACTOR_SQUARE / 2 - ACTOR_LABEL_OFFSET,
        transform: 'translateX(-50%)',
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

  // Phase 16.1.3 Item 8: lookup-by-claim-id for per-claim disclosure types.
  // Build maps for public + (umbrella from active actor's POV) DA types.
  // The Phase 16.0 view-builder doesn't return raw DAs; we re-derive here
  // from the cluster's `umbrellaClaims` + `publicClaims` arrays. To avoid
  // a wholesale refactor of the view-builder, we walk shared DAs inline.
  // (This is fine — `buildV22DirectoryDataForRole` already does similar
  // work; an alternative is to thread `daTypeForClaim` from the builder.)

  // Phase 16.2.3: active Actor's own cluster anchors at canvas-bottom-center.
  // The 12 mock supplier clusters + ChipCo + MicroCo fan outward from this
  // anchor across the upper hemisphere of the bounded canvas.
  const userCenterX = OWN_CLUSTER_ANCHOR_X
  const userCenterY = OWN_CLUSTER_ANCHOR_Y

  const allDots = []
  const clusterByDotIndex = []

  // Phase 16.1.3 Items 3 + 8: cell layout helper with squareCell reservation.
  // Per-Claim disclosure type passed in via per-Claim metadata.
  function layoutClusterCells(umbrellaClaims, publicClaims, rfps, squareCell) {
    const reservedSet = new Set()
    if (squareCell) reservedSet.add(`${squareCell.row},${squareCell.col}`)

    // Place umbrella row-major starting at row 1 (row 0 = top buffer), but
    // SKIP the squareCell if it falls on an umbrella position. Push to the
    // next available cell.
    const umbrellaCells = []
    if (umbrellaClaims.length > 0) {
      let r = 1, c = 0, safety = 0
      for (let i = 0; i < umbrellaClaims.length && safety < 1000; safety++) {
        const key = `${r},${c}`
        if (!reservedSet.has(key)) {
          umbrellaCells.push({
            ...umbrellaClaims[i],
            row: r, col: c,
          })
          i++
        }
        c++
        if (c >= MAX_COLS) { r++; c = 0 }
      }
    }
    const umbrellaSet = new Set(umbrellaCells.map((c) => `${c.row},${c.col}`))
    const bufferSet = new Set()
    for (const cell of umbrellaCells) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = cell.row + dr
        const nc = cell.col + dc
        const key = `${nr},${nc}`
        if (!umbrellaSet.has(key)) bufferSet.add(key)
      }
    }
    // Pack public + RFPs together via row-major scan, skipping umbrella +
    // buffer + reserved (squareCell).
    const remaining = [
      ...publicClaims.map((c) => ({ ...c, kind: 'public' })),
      ...rfps.map((r) => ({ ...r, kind: 'rfp' })),
    ]
    const remainingCells = []
    let r = 0, c = 0, safety = 0
    for (let i = 0; i < remaining.length; i++) {
      while (safety < 1000) {
        safety++
        const key = `${r},${c}`
        if (!umbrellaSet.has(key) && !bufferSet.has(key) && !reservedSet.has(key) && c >= 0 && c < MAX_COLS) {
          remainingCells.push({ ...remaining[i], row: r, col: c })
          c++
          if (c >= MAX_COLS) { r++; c = 0 }
          break
        }
        c++
        if (c >= MAX_COLS) { r++; c = 0 }
      }
    }
    return { umbrellaCells, remainingCells }
  }

  function buildCluster({ ownerParty, umbrellaItems, publicItems, rfpItems, isOwnCluster, centerOverride }) {
    const totalDots = umbrellaItems.length + publicItems.length + rfpItems.length
    const colsUsed = Math.min(MAX_COLS, Math.max(1, totalDots))
    const clusterPxWidth = colsUsed * DOT_GRID

    // Phase 16.1.3 Item 3: pre-compute squareCell so umbrella + public
    // placement can skip it. squareCol = middle of 6-col grid. squareRow
    // depends on whether umbrella exists (umbrella shifts dots down by 1).
    const totalRowsEstimate = Math.max(
      1,
      Math.ceil((umbrellaItems.length) / MAX_COLS),
    )
    const squareCol = Math.floor(MAX_COLS / 2)  // = 3
    // For umbrella clusters: row 0 is top buffer; place square at row 2
    // (visual midpoint with row 0 buffer + rows 1-N umbrella + post-umbrella indigo).
    // For non-umbrella clusters: place square at row 0 (only row used).
    const squareRow = umbrellaItems.length > 0
      ? Math.max(1, Math.ceil(totalRowsEstimate / 2) + 1)  // mid of umbrella+post region
      : 0
    const squareCell = { row: squareRow, col: squareCol }

    const { umbrellaCells, remainingCells } = layoutClusterCells(umbrellaItems, publicItems, rfpItems, squareCell)
    const cellsPlaced = [...umbrellaCells, ...remainingCells]

    let minRow = 0, maxRow = 0
    if (cellsPlaced.length > 0) {
      minRow = Math.min(...cellsPlaced.map((c) => c.row))
      maxRow = Math.max(...cellsPlaced.map((c) => c.row))
    }
    if (umbrellaItems.length > 0) {
      minRow = Math.min(minRow, 0)
      const lastUmbrella = umbrellaCells[umbrellaCells.length - 1]
      if (lastUmbrella) maxRow = Math.max(maxRow, lastUmbrella.row + 1)
    }
    // squareCell.row also factors into bounds.
    minRow = Math.min(minRow, squareCell.row)
    maxRow = Math.max(maxRow, squareCell.row)
    const rowsCount = maxRow - minRow + 1

    const center = centerOverride || { x: 0, y: 0 }
    const anchorX = snapGrid(center.x - clusterPxWidth / 2)
    const anchorY = snapGrid(center.y - ((maxRow + minRow) / 2) * ROW_GAP)

    const dots = cellsPlaced.map((entry) => {
      const colorVar = entry.kind === 'rfp'
        ? '--accent-cyan'
        : disclosureTypeToColorVar(entry.disclosureType)
      return {
        ...entry,
        colorVar,
        x: anchorX + entry.col * COL_GAP,
        y: anchorY + entry.row * ROW_GAP,
      }
    })

    const squareWorldX = anchorX + squareCell.col * COL_GAP
    const squareWorldY = anchorY + squareCell.row * ROW_GAP

    // L-shape boundary path. Built in WORLD coords. Color is now neutral
    // grey (Phase 16.1.3 Item 8) — amber is reserved for selective dots.
    let umbrellaPathWorld = null
    if (umbrellaCells.length > 0) {
      const cellLeftW = (col) => anchorX + col * COL_GAP - DOT_RADIUS - CLUSTER_PAD
      const cellRightW = (col) => anchorX + col * COL_GAP + DOT_RADIUS + CLUSTER_PAD
      const cellTopW = (row) => anchorY + row * ROW_GAP - DOT_RADIUS - CLUSTER_PAD
      const cellBottomW = (row) => anchorY + row * ROW_GAP + DOT_RADIUS + CLUSTER_PAD
      const rowMaxCol = new Map()
      for (const { row, col } of umbrellaCells) {
        rowMaxCol.set(row, Math.max(rowMaxCol.get(row) ?? -Infinity, col))
      }
      const urows = [...rowMaxCol.keys()].sort((a, b) => a - b)
      const points = []
      const firstUR = urows[0]
      const lastUR = urows[urows.length - 1]
      points.push([cellLeftW(0), cellTopW(firstUR)])
      points.push([cellRightW(rowMaxCol.get(firstUR)), cellTopW(firstUR)])
      for (let i = 0; i < urows.length - 1; i++) {
        const thisR = urows[i], nextR = urows[i + 1]
        points.push([cellRightW(rowMaxCol.get(thisR)), cellBottomW(thisR)])
        points.push([cellRightW(rowMaxCol.get(nextR)), cellBottomW(thisR)])
      }
      points.push([cellRightW(rowMaxCol.get(lastUR)), cellBottomW(lastUR)])
      points.push([cellLeftW(0), cellBottomW(lastUR)])
      points.push([cellLeftW(0), cellTopW(firstUR)])
      umbrellaPathWorld = points
    }

    const halfW = clusterPxWidth / 2 + CLUSTER_PAD
    const halfH = (rowsCount / 2 + 1) * ROW_GAP + CLUSTER_PAD
    const bbox = {
      minX: center.x - halfW,
      maxX: center.x + halfW,
      minY: center.y - halfH,
      maxY: center.y + halfH,
    }

    return {
      ownerParty,
      isOwnCluster,
      center,
      squareWorld: { x: squareWorldX, y: squareWorldY },
      dots,
      umbrellaPathWorld,
      rowsCount,
      bbox,
    }
  }

  // ─── User's own cluster ──────────────────────────────────────────────
  const ownClusters = []
  if (directoryData.isUserVisible) {
    const own = buildCluster({
      ownerParty: directoryData.activeParty,
      umbrellaItems: [],
      // Own Claims render as indigo (full disclosure to self).
      publicItems: directoryData.ownClaims.map((c) => ({ claim: c, disclosureType: 'full' })),
      rfpItems: directoryData.ownRfps.map((r) => ({ rfp: r })),
      isOwnCluster: true,
      centerOverride: { x: userCenterX, y: userCenterY },
    })
    ownClusters.push(own)
  }

  const placedBoxes = ownClusters.map((c) => c.bbox)
  const violatesBuffer = (candidateBbox) => placedBoxes.some((p) => {
    return !(
      candidateBbox.maxX + CLUSTER_BUFFER < p.minX ||
      candidateBbox.minX > p.maxX + CLUSTER_BUFFER ||
      candidateBbox.maxY + CLUSTER_BUFFER < p.minY ||
      candidateBbox.minY > p.maxY + CLUSTER_BUFFER
    )
  })

  // ─── Other clusters — Phase 16.2.3 polar Poisson disc fan-out. ────────
  // For each non-active cluster (12 mock + ChipCo + MicroCo where visible),
  // sample (θ, r) in polar space emanating from the active Actor anchor:
  //   • θ ∈ [-75°, +75°] from straight up (upper 150° arc).
  //   • r ∈ [r_min, r_max] world units (keeps off-anchor + within canvas).
  // Cartesian: cx = anchor.x + r·sin(θ); cy = anchor.y - r·cos(θ).
  // Collision check via the existing buffer rule; canvas-bounds check vs.
  // CANVAS_WIDTH/HEIGHT. Up to 50 retries with seed-perturbed samples.
  // Sort input by descending Claim count (jumbo first) so large clusters
  // get first pick of placement space.
  const POISSON_R_MIN = 2000
  const POISSON_R_MAX = CANVAS_HEIGHT * 0.75  // 8377.5
  const POISSON_THETA_HALF_DEG = 75
  const POISSON_MAX_RETRIES = 50
  const totalDotsFor = (c) => (c.umbrellaClaims?.length || 0) + (c.publicClaims?.length || 0)
  const otherClustersInput = [...directoryData.otherClusters].sort((a, b) => {
    const dotDiff = totalDotsFor(b) - totalDotsFor(a)
    if (dotDiff !== 0) return dotDiff
    return hashString(a.ownerParty) - hashString(b.ownerParty)
  })
  const inBounds = (bbox) =>
    bbox.minX >= 0 && bbox.maxX <= CANVAS_WIDTH &&
    bbox.minY >= 0 && bbox.maxY <= CANVAS_HEIGHT
  const otherClusters = []
  for (let i = 0; i < otherClustersInput.length; i++) {
    const cluster = otherClustersInput[i]
    const seed = hashString(cluster.ownerParty)
    const baseUmbrellaItems = cluster.umbrellaClaims.map((c) => ({
      claim: c,
      disclosureType: cluster.umbrellaTypeByClaimId?.[c.id] || 'full',
    }))
    const basePublicItems = cluster.publicClaims.map((c) => ({
      claim: c,
      disclosureType: cluster.publicTypeByClaimId?.[c.id] || 'full',
    }))
    let placed = null
    let lastAttempt = null
    for (let attempt = 0; attempt < POISSON_MAX_RETRIES; attempt++) {
      // Deterministic-ish PRNG via cluster-seed + attempt.
      const a = ((seed + attempt * 9173) >>> 0) % 10000 / 10000
      const b = ((seed * 31 + attempt * 12289) >>> 0) % 10000 / 10000
      const c2 = ((seed * 7 + attempt * 28201) >>> 0) % 10000 / 10000
      const thetaDeg = (a * 2 - 1) * POISSON_THETA_HALF_DEG
      const theta = thetaDeg * Math.PI / 180
      // Bias radius toward outer range so clusters spread out across the
      // canvas instead of clumping near the anchor. The `attempt` index
      // gradually pulls r inward if early outer attempts collide.
      const rScale = 0.35 + 0.65 * b  // 0.35..1.0
      const rAdjust = Math.max(0, 1 - attempt / POISSON_MAX_RETRIES * 0.5)
      const r = POISSON_R_MIN + (POISSON_R_MAX - POISSON_R_MIN) * rScale * rAdjust
      const cx = snapGrid(userCenterX + r * Math.sin(theta) + (c2 - 0.5) * 40)
      const cy = snapGrid(userCenterY - r * Math.cos(theta) + (c2 - 0.5) * 40)
      const candidate = buildCluster({
        ownerParty: cluster.ownerParty,
        umbrellaItems: baseUmbrellaItems,
        publicItems: basePublicItems,
        rfpItems: [],
        isOwnCluster: false,
        centerOverride: { x: cx, y: cy },
      })
      lastAttempt = candidate
      if (!inBounds(candidate.bbox)) continue
      if (violatesBuffer(candidate.bbox)) continue
      placed = candidate
      break
    }
    if (placed) {
      otherClusters.push(placed)
      placedBoxes.push(placed.bbox)
    } else if (lastAttempt) {
      // Fallback: keep the final attempt and surface a console warning so
      // density issues are visible during dev stress tests.
      if (typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn(`[DirectoryLayer] Polar Poisson disc fallback for cluster ${cluster.ownerParty} (${otherClustersInput.length} non-own clusters)`)
      }
      otherClusters.push(lastAttempt)
      placedBoxes.push(lastAttempt.bbox)
    }
  }

  // Other RFPs (Phase 16: only Bob's seeded one when active != Bob).
  const otherRfpEntries = []
  for (const rfp of directoryData.otherRfps) {
    const ownCluster = otherClusters.find((c) => c.ownerParty === rfp.owner)
    if (ownCluster) {
      const sq = ownCluster.center
      otherRfpEntries.push({ rfp, x: snapGrid(sq.x + DOT_GRID * 3), y: snapGrid(sq.y) })
    } else {
      otherRfpEntries.push({ rfp, x: snapGrid(userCenterX + 600), y: snapGrid(userCenterY - 320) })
    }
  }

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
    // Phase 16.2.3: grid spans the full bounded canvas (with a small margin
    // for breathing room when zoomed in close to an edge). Uses sparser
    // GRID_SPACING (4×DOT_GRID = 48 world units) to keep the point count
    // tractable at ~84k for a 17280×11170 canvas.
    const isDark = document.documentElement.dataset.theme !== 'light'
    const gridColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const gridPoints = []
    const gx0 = -GRID_MARGIN
    const gx1 = CANVAS_WIDTH + GRID_MARGIN
    const gy0 = -GRID_MARGIN
    const gy1 = CANVAS_HEIGHT + GRID_MARGIN
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
    const dotGeometry = new THREE.CircleGeometry(DOT_RADIUS, 16)
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

    // Actor squares (one per cluster; world position = cluster.squareWorld).
    const squares = layout.allClusters
    for (let i = 0; i < MAX_SQUARES; i++) {
      if (i < squares.length) {
        const sq = squares[i]
        m.makeTranslation(sq.squareWorld.x, -sq.squareWorld.y, 0)
        squaresMesh.setMatrixAt(i, m)
      } else {
        squaresMesh.setMatrixAt(i, hidden)
      }
    }
    squaresMesh.count = squares.length
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

    // Pre-zero opacities + label state so the very first frame is blank.
    const opacities = dotOpacitiesRef.current
    for (let i = 0; i < opacities.length; i++) opacities[i] = 0
    const initialLabelOpacities = {}
    for (const l of labels) initialLabelOpacities[l.party] = 0
    setLabelOpacities(initialLabelOpacities)
    dotsDirtyRef.current = true
    dirtyRef.current = true

    // Start the wave.
    const handle = playDirectoryLoadAnimation({
      dots: claimDots.map((d) => ({ x: d.x, y: d.y })),
      labels,
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

      {/* SVG overlay — umbrella subset L-shape boundary (Phase 16.1.3
          Item 8: neutral grey, no longer amber). */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {overlay?.umbrellaPaths?.map((p) => {
          if (!p.screenPoints || p.screenPoints.length === 0) return null
          const d = p.screenPoints.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ') + ' Z'
          return (
            <path
              key={`umbrella-${p.ownerParty}`}
              d={d}
              stroke="color-mix(in srgb, var(--text-secondary) 60%, transparent)"
              strokeWidth={1.5}
              fill="color-mix(in srgb, var(--text-secondary) 6%, transparent)"
              strokeLinejoin="round"
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
