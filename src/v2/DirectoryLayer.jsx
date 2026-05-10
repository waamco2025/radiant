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

// ─── Camera / zoom constants ───────────────────────────────────────────
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4.0
const INITIAL_ZOOM = 1.5
const GRID_RANGE = 4000
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

function PillboxLabel({ ownerParty, x, y, faded }) {
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
        opacity: faded ? 0.25 : 1,
        transition: 'opacity 150ms ease',
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

  const userCenterX = 0
  const userCenterY = snapGrid(viewport.h / INITIAL_ZOOM * 0.18)

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

  // ─── Other clusters ──────────────────────────────────────────────────
  const otherClustersInput = [...directoryData.otherClusters].sort((a, b) =>
    hashString(a.ownerParty) - hashString(b.ownerParty),
  )
  const otherClusters = []
  const N = otherClustersInput.length
  for (let i = 0; i < N; i++) {
    const cluster = otherClustersInput[i]
    const spreadFraction = N === 1 ? 0 : (i / (N - 1)) - 0.5
    let cx = snapGrid(userCenterX + spreadFraction * 800)
    const seed = hashString(cluster.ownerParty)
    let cy = snapGrid(userCenterY - 240 - (seed % 80))
    let attempts = 0
    while (attempts < 30) {
      const candidate = buildCluster({
        ownerParty: cluster.ownerParty,
        umbrellaItems: cluster.umbrellaClaims.map((c) => ({
          claim: c,
          disclosureType: cluster.umbrellaTypeByClaimId?.[c.id] || 'full',
        })),
        publicItems: cluster.publicClaims.map((c) => ({
          claim: c,
          disclosureType: cluster.publicTypeByClaimId?.[c.id] || 'full',
        })),
        rfpItems: [],
        isOwnCluster: false,
        centerOverride: { x: cx, y: cy },
      })
      if (!violatesBuffer(candidate.bbox)) {
        otherClusters.push(candidate)
        placedBoxes.push(candidate.bbox)
        break
      }
      cy -= DOT_GRID * 4
      cx += (attempts % 2 === 0 ? 1 : -1) * DOT_GRID * 6
      cx = snapGrid(cx)
      cy = snapGrid(cy)
      attempts++
    }
    if (attempts === 30) {
      const candidate = buildCluster({
        ownerParty: cluster.ownerParty,
        umbrellaItems: cluster.umbrellaClaims.map((c) => ({
          claim: c,
          disclosureType: cluster.umbrellaTypeByClaimId?.[c.id] || 'full',
        })),
        publicItems: cluster.publicClaims.map((c) => ({
          claim: c,
          disclosureType: cluster.publicTypeByClaimId?.[c.id] || 'full',
        })),
        rfpItems: [],
        isOwnCluster: false,
        centerOverride: { x: cx, y: cy },
      })
      otherClusters.push(candidate)
      placedBoxes.push(candidate.bbox)
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
  const camPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(INITIAL_ZOOM)
  const draggingRef = useRef(false)
  const wasDragRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const camStartRef = useRef({ x: 0, y: 0 })
  const panAnimRef = useRef(null)
  const [threeReady, setThreeReady] = useState(false)
  const [zoom, setZoom] = useState(INITIAL_ZOOM)

  const [hover, setHover] = useState(null)
  const [pinned, setPinned] = useState(null)
  useEffect(() => { if (phase === 'closed') { setHover(null); setPinned(null) } }, [phase])
  useEffect(() => { setHover(null); setPinned(null) }, [roleId])

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

  const clampPan = useCallback((x, y) => {
    return {
      x: Math.max(-1500, Math.min(1500, x)),
      y: Math.max(-1500, Math.min(1500, y)),
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
    const isDark = document.documentElement.dataset.theme !== 'light'
    const gridColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const gridPoints = []
    const gridStart = -Math.ceil(GRID_RANGE / DOT_GRID) * DOT_GRID
    for (let gx = gridStart; gx <= GRID_RANGE; gx += DOT_GRID) {
      for (let gy = gridStart; gy <= GRID_RANGE; gy += DOT_GRID) {
        gridPoints.push(new THREE.Vector3(gx, gy, -1))
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

    const m = new THREE.Matrix4()
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)

    // Claim dots
    for (let i = 0; i < MAX_DOTS; i++) {
      if (i < claimDots.length) {
        const d = claimDots[i]
        m.makeTranslation(d.x, -d.y, 0)
        dotsMesh.setMatrixAt(i, m)
        let c = colorIndigo
        if (d.colorVar === '--accent-amber') c = colorAmber
        else if (d.colorVar === '--accent-green') c = colorGreen
        dotsMesh.setColorAt(i, c)
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
  useEffect(() => {
    if (!threeReady || !layout) return
    const mesh = dotsMeshRef.current
    if (!mesh) return
    const colorIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const colorAmber = cssVarToColor('--accent-amber', '#c49a45')
    const colorGreen = cssVarToColor('--accent-green', '#22c55e')
    const colorWhite = new THREE.Color('#ffffff')
    const lerpToWhite = (base) => {
      const c = base.clone()
      c.lerp(colorWhite, 0.15)
      return c
    }
    const claimDots = layout.allDots.filter((d) => d.kind !== 'rfp')
    const target = pinned || hover
    const targetIdx = target?.dotIndex ?? -1
    const targetClusterIdx = targetIdx >= 0 ? claimDots[targetIdx]?.clusterIdx : null
    for (let i = 0; i < claimDots.length; i++) {
      const d = claimDots[i]
      let base = colorIndigo
      if (d.colorVar === '--accent-amber') base = colorAmber
      else if (d.colorVar === '--accent-green') base = colorGreen
      let c = base
      if (i === targetIdx) c = colorWhite
      else if (targetClusterIdx !== null && targetClusterIdx !== undefined && d.clusterIdx === targetClusterIdx) c = lerpToWhite(base)
      mesh.setColorAt(i, c)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    dirtyRef.current = true
  }, [threeReady, layout, hover, pinned])

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
    if (!layout || layout.allClusters.length === 0) return
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const c of layout.allClusters) {
      if (c.bbox.minX < minX) minX = c.bbox.minX
      if (c.bbox.maxX > maxX) maxX = c.bbox.maxX
      if (c.bbox.minY < minY) minY = c.bbox.minY
      if (c.bbox.maxY > maxY) maxY = c.bbox.maxY
    }
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const w = (maxX - minX) + 80
    const h = (maxY - minY) + 80
    const container = containerRef.current
    if (!container) return
    const fitZoom = Math.min(container.clientWidth / w, container.clientHeight / h)
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom))
    camPosRef.current = clampPan(cx, cy)
    zoomRef.current = newZoom
    setZoom(newZoom)
    updateCamera()
  }, [layout, clampPan, updateCamera])

  const zoomPct = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10) + '%'

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
        return <PillboxLabel key={cluster.ownerParty} ownerParty={cluster.ownerParty} x={screen.x} y={screen.y} faded={faded} />
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
