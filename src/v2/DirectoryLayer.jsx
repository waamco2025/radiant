// DirectoryLayer — Phase 16.1.2 (spatial model rewrite + bug fixes).
//
// Design pivot from Phase 16.1.0–16.1.1:
//   • Corner card removed. The user's own representation is now a regular
//     cluster (Actor square + own Claims + own RFPs as InstancedMesh dots),
//     positioned at canvas-center horizontal + bottom-third vertical on
//     initial load. Pans/zooms with the rest of the scene.
//   • Anonymous actors (Carol/AuditCo, no own Claims or RFPs) render NO
//     own cluster — the bottom-third position becomes a virtual layout
//     anchor for fan-out only.
//   • Actor squares migrated to Three.js LineSegments so they scale with
//     the camera identically to dots. Pillbox labels remain HTML overlays
//     projected via worldToScreen (text stays readable at all zooms).
//   • All edges dropped from Directory. The umbrella DA edge is gone;
//     amber L-shape border + tint around umbrella subset remains as a
//     cluster-internal decoration.
//   • 12-cell buffer enforced between user's own cluster and others, and
//     between any two non-user clusters.
//
// Bug fixes in this phase:
//   • First-transition dot lifecycle stabilized — Three.js scene + renderer
//     persist for the layer's lifetime; InstancedMesh data updates via
//     setMatrixAt + setColorAt without recreating the mesh on every layer
//     transition.
//   • Zoom controls match parent layer (+/-/FIT vertical stack top-right
//     + percentage display); old bottom-right zoom indicator removed.

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { buildV22DirectoryDataForRole } from './v2_2Data.js'

// ─── Layout constants (world units) ────────────────────────────────────
const DOT_GRID = 12
const DOT_RADIUS = 3
const ACTOR_SQUARE = 6
const MAX_COLS = 6
const ROW_GAP = DOT_GRID
const COL_GAP = DOT_GRID
const ACTOR_LABEL_OFFSET = 18
const CLUSTER_PAD = 5
const TOOLTIP_W = 230
const TOOLTIP_OFFSET = 12

// Phase 16.1.2 Item 5: 12-cell minimum spacing between cluster bboxes.
const CLUSTER_BUFFER_CELLS = 12
const CLUSTER_BUFFER = CLUSTER_BUFFER_CELLS * DOT_GRID

// ─── Camera / zoom constants ───────────────────────────────────────────
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4.0
const INITIAL_ZOOM = 1.5
const GRID_RANGE = 4000
const DRAG_THRESHOLD_PX = 4

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

// Hash a string to a 32-bit unsigned int — used for deterministic
// per-actor cluster placement seed.
function hashString(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h | 0) || 1
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

// ─── Pillbox label (HTML overlay; positioned via worldToScreen) ────────
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

  // The user's "virtual center" — canvas-horizontal-center, bottom-third
  // vertical. This is where the user's own cluster anchors when visible,
  // and where other clusters fan around when the user is anonymous.
  // Bottom-third: y > 0 in world coords (world y increases downward).
  // For a typical viewport ~720px tall, +120 world units puts the user's
  // cluster roughly in the bottom third at zoom 1.5.
  const userCenterX = 0
  const userCenterY = snapGrid(viewport.h / INITIAL_ZOOM * 0.18)

  const allDots = []
  const clusterByDotIndex = []

  // Cell layout helper — same as Phase 16.1.1 (top buffer at row 0,
  // 1-cell buffer in all 4 directions around umbrella subset).
  function layoutClusterCells(umbrellaClaims, publicClaims, rfps) {
    const umbrellaCells = []
    if (umbrellaClaims.length > 0) {
      for (let i = 0; i < umbrellaClaims.length; i++) {
        umbrellaCells.push({
          claim: umbrellaClaims[i], color: 'amber',
          row: 1 + Math.floor(i / MAX_COLS),
          col: i % MAX_COLS,
        })
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
    // Pack public + RFPs together via row-major scan.
    const remaining = [
      ...publicClaims.map((c) => ({ claim: c, color: 'indigo' })),
      ...rfps.map((r) => ({ rfp: r, color: 'green' })),
    ]
    const remainingCells = []
    let r = 0, c = 0, safety = 0
    for (let i = 0; i < remaining.length; i++) {
      while (safety < 1000) {
        safety++
        const key = `${r},${c}`
        if (!umbrellaSet.has(key) && !bufferSet.has(key) && c >= 0 && c < MAX_COLS) {
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

  // Cluster construction — for both the user's own cluster (when visible)
  // and other actors' clusters. Returns a cluster descriptor with its
  // center, dots in world coords, optional amber L-shape path, and
  // bounding box for inter-cluster spacing checks.
  function buildCluster({ ownerParty, umbrellaClaims, publicClaims, rfps, isOwnCluster, centerOverride }) {
    const totalDots = umbrellaClaims.length + publicClaims.length + rfps.length
    const colsUsed = Math.min(MAX_COLS, totalDots) || 1
    const clusterPxWidth = colsUsed * DOT_GRID

    const { umbrellaCells, remainingCells } = layoutClusterCells(umbrellaClaims, publicClaims, rfps)
    const cellsPlaced = [...umbrellaCells, ...remainingCells]

    let minRow = 0, maxRow = 0
    if (cellsPlaced.length > 0) {
      minRow = Math.min(...cellsPlaced.map((c) => c.row))
      maxRow = Math.max(...cellsPlaced.map((c) => c.row))
    }
    if (umbrellaClaims.length > 0) {
      minRow = Math.min(minRow, 0)
      const lastUmbrella = umbrellaCells[umbrellaCells.length - 1]
      maxRow = Math.max(maxRow, lastUmbrella.row + 1)
    }
    const rowsCount = maxRow - minRow + 1
    const center = centerOverride || { x: 0, y: 0 }
    const anchorX = snapGrid(center.x - clusterPxWidth / 2)
    const anchorY = snapGrid(center.y - ((maxRow + minRow) / 2) * ROW_GAP)

    const dots = cellsPlaced.map((entry) => ({
      ...entry,
      x: anchorX + entry.col * COL_GAP,
      y: anchorY + entry.row * ROW_GAP,
    }))

    let amberPathWorld = null
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
      amberPathWorld = points
    }

    // Bounding box (world coords) for inter-cluster buffer enforcement.
    const halfW = clusterPxWidth / 2 + CLUSTER_PAD
    const halfH = ((rowsCount - 1) / 2 + 1) * ROW_GAP + CLUSTER_PAD
    const bbox = {
      minX: center.x - halfW,
      maxX: center.x + halfW,
      minY: center.y - halfH,
      maxY: center.y + halfH,
    }

    return { ownerParty, isOwnCluster, center, dots, amberPathWorld, rowsCount, bbox }
  }

  // ─── Build the user's own cluster (if visible) ───────────────────────
  const ownClusters = []
  if (directoryData.isUserVisible) {
    const own = buildCluster({
      ownerParty: directoryData.activeParty,
      umbrellaClaims: [],
      publicClaims: directoryData.ownClaims,
      rfps: directoryData.ownRfps,
      isOwnCluster: true,
      centerOverride: { x: userCenterX, y: userCenterY },
    })
    ownClusters.push(own)
  }

  // Track placed cluster bboxes for buffer enforcement.
  const placedBoxes = ownClusters.map((c) => c.bbox)
  const violatesBuffer = (candidateBbox) => placedBoxes.some((p) => {
    return !(
      candidateBbox.maxX + CLUSTER_BUFFER < p.minX ||
      candidateBbox.minX > p.maxX + CLUSTER_BUFFER ||
      candidateBbox.maxY + CLUSTER_BUFFER < p.minY ||
      candidateBbox.minY > p.maxY + CLUSTER_BUFFER
    )
  })

  // ─── Build other clusters fanned ABOVE the user center ───────────────
  // Sort deterministically by hashed party name for stable placement.
  const otherClustersInput = [...directoryData.otherClusters].sort((a, b) =>
    hashString(a.ownerParty) - hashString(b.ownerParty),
  )
  const otherClusters = []
  // Initial fan layout: spread horizontally across the upper canvas, with
  // some seed-driven jitter. Each candidate position is checked against
  // placed-bboxes; if it would violate the buffer, push it further up or
  // sideways.
  const N = otherClustersInput.length
  for (let i = 0; i < N; i++) {
    const cluster = otherClustersInput[i]
    // Initial guess: distribute horizontally (alternating left/right of
    // userCenterX), each one progressively further up.
    const spreadFraction = N === 1 ? 0 : (i / (N - 1)) - 0.5
    let cx = snapGrid(userCenterX + spreadFraction * 800)
    // Vertical: above the user — use negative offsets (world Y down means
    // negative is up). Stagger heights for visual variety.
    const seed = hashString(cluster.ownerParty)
    let cy = snapGrid(userCenterY - 240 - (seed % 80))
    // Buffer enforcement: if this candidate violates the buffer, nudge
    // upward + sideways until clear.
    let attempts = 0
    while (attempts < 30) {
      const candidate = buildCluster({
        ownerParty: cluster.ownerParty,
        umbrellaClaims: cluster.umbrellaClaims,
        publicClaims: cluster.publicClaims,
        rfps: [],
        isOwnCluster: false,
        centerOverride: { x: cx, y: cy },
      })
      if (!violatesBuffer(candidate.bbox)) {
        otherClusters.push(candidate)
        placedBoxes.push(candidate.bbox)
        break
      }
      // Nudge upward + alternate sideways.
      cy -= DOT_GRID * 4
      cx += (attempts % 2 === 0 ? 1 : -1) * DOT_GRID * 6
      cx = snapGrid(cx)
      cy = snapGrid(cy)
      attempts++
    }
    if (attempts === 30) {
      // Fallback: place at last candidate even if it violates buffer
      // (graceful degradation when seed scaling makes naive placement
      // break down — see backlog #196).
      const candidate = buildCluster({
        ownerParty: cluster.ownerParty,
        umbrellaClaims: cluster.umbrellaClaims,
        publicClaims: cluster.publicClaims,
        rfps: [],
        isOwnCluster: false,
        centerOverride: { x: cx, y: cy },
      })
      otherClusters.push(candidate)
      placedBoxes.push(candidate.bbox)
    }
  }

  // ─── Other RFPs (Phase 16: only Bob's seeded one when active != Bob) ─
  // Each other-actor RFP rides along inside the owning Actor's cluster
  // if that cluster exists; otherwise it gets a free-standing slot near
  // its owning Actor's cluster center (no dedicated free-standing Actor
  // square — Phase 17 may revisit).
  const otherRfpEntries = []
  for (const rfp of directoryData.otherRfps) {
    const ownCluster = otherClusters.find((c) => c.ownerParty === rfp.owner)
    if (ownCluster) {
      const sq = ownCluster.center
      otherRfpEntries.push({ rfp, x: snapGrid(sq.x + DOT_GRID * 3), y: snapGrid(sq.y) })
    } else {
      // Free-standing — place above the user center off to the side.
      otherRfpEntries.push({ rfp, x: snapGrid(userCenterX + 600), y: snapGrid(userCenterY - 320) })
    }
  }

  // ─── Flatten dots into the InstancedMesh data array ──────────────────
  // Order: own cluster dots → other clusters' dots → other RFP dots.
  const allClusters = [...ownClusters, ...otherClusters]
  for (let ci = 0; ci < allClusters.length; ci++) {
    const cluster = allClusters[ci]
    for (const d of cluster.dots) {
      allDots.push({
        x: d.x, y: d.y,
        color: d.color,
        claim: d.claim || null,
        rfp: d.rfp || null,
        clusterIdx: ci,
      })
      clusterByDotIndex.push(ci)
    }
  }
  for (const entry of otherRfpEntries) {
    allDots.push({ x: entry.x, y: entry.y, color: 'green', claim: null, rfp: entry.rfp, clusterIdx: -1 })
    clusterByDotIndex.push(-1)
  }

  return {
    activeParty: directoryData.activeParty,
    isUserVisible: directoryData.isUserVisible,
    allClusters,           // includes own + others
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
  // ─── Phase 11A entry/exit state machine (preserved) ──────────────────
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
    return buildV22DirectoryDataForRole(roleId, v22Provisionals)
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
  const dotsCapacityRef = useRef(0)   // current InstancedMesh capacity
  const actorSquaresGroupRef = useRef(null)
  const gridGroupRef = useRef(null)
  const dirtyRef = useRef(true)
  const camPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(INITIAL_ZOOM)
  const draggingRef = useRef(false)
  const wasDragRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const camStartRef = useRef({ x: 0, y: 0 })
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

  // ─── Overlay refresh ─────────────────────────────────────────────────
  const updateOverlayRef = useRef(() => {})
  useEffect(() => {
    updateOverlayRef.current = () => {
      if (!layout) return
      const ownerSquares = layout.allClusters.map((c) => ({
        ownerParty: c.ownerParty,
        screen: worldToScreen(c.center.x, c.center.y),
      }))
      const dotScreens = layout.allDots.map((d) => worldToScreen(d.x, d.y))
      const amberPaths = layout.allClusters
        .filter((c) => c.amberPathWorld)
        .map((c) => ({
          ownerParty: c.ownerParty,
          screenPoints: c.amberPathWorld.map((p) => worldToScreen(p[0], p[1])),
        }))
      setOverlay({ ownerSquares, dotScreens, amberPaths })
    }
  }, [layout, worldToScreen])

  // ─── Three.js scene init (Phase 16.1.2 Item 6: stable lifecycle) ─────
  // Created once per phase != 'closed'. Renderer + scene + grid persist
  // across data changes; only the InstancedMesh + Actor squares update.
  useEffect(() => {
    if (phase === 'closed') return
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    if (rendererRef.current) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const gridGroup = new THREE.Group()
    gridGroupRef.current = gridGroup
    scene.add(gridGroup)

    const actorSquaresGroup = new THREE.Group()
    actorSquaresGroupRef.current = actorSquaresGroup
    scene.add(actorSquaresGroup)

    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    updateCamera()

    // Grid as Points.
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
    setThreeReady(true)

    return () => {
      cancelAnimationFrame(animId)
      ro.disconnect()
      gridGeometry.dispose()
      gridMaterial.dispose()
      renderer.dispose()
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      gridGroupRef.current = null
      actorSquaresGroupRef.current = null
      dotsMeshRef.current = null
      dotsCapacityRef.current = 0
      setThreeReady(false)
    }
  }, [phase, updateCamera])

  // ─── Phase 16.1.2 Item 6: stable InstancedMesh lifecycle ──────────────
  // The InstancedMesh is created with a generous capacity on first build;
  // subsequent layout changes update the instance data in place via
  // setMatrixAt + setColorAt without recreating the mesh. If the dot count
  // exceeds capacity, the mesh is rebuilt with double the size.
  useEffect(() => {
    if (!threeReady || !layout) return
    const scene = sceneRef.current
    if (!scene) return
    const colorIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const colorAmber = cssVarToColor('--accent-amber', '#c49a45')
    const colorGreen = cssVarToColor('--accent-green', '#22c55e')
    const desiredCount = layout.allDots.length
    let mesh = dotsMeshRef.current
    if (!mesh || dotsCapacityRef.current < desiredCount) {
      // Initial creation OR grow.
      if (mesh) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        mesh.material.dispose()
      }
      const capacity = Math.max(desiredCount, 64)  // generous initial capacity
      const geometry = new THREE.CircleGeometry(DOT_RADIUS, 16)
      const material = new THREE.MeshBasicMaterial()
      mesh = new THREE.InstancedMesh(geometry, material, capacity)
      mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3)
      scene.add(mesh)
      dotsMeshRef.current = mesh
      dotsCapacityRef.current = capacity
    }
    // Populate instance data.
    const m = new THREE.Matrix4()
    const hidden = new THREE.Matrix4().makeScale(0, 0, 0)  // collapse unused instances
    for (let i = 0; i < dotsCapacityRef.current; i++) {
      if (i < desiredCount) {
        const d = layout.allDots[i]
        m.makeTranslation(d.x, -d.y, 0)
        mesh.setMatrixAt(i, m)
        const c = d.color === 'amber' ? colorAmber : d.color === 'green' ? colorGreen : colorIndigo
        mesh.setColorAt(i, c)
      } else {
        // Collapse to size 0 so unused instances don't render artifacts.
        mesh.setMatrixAt(i, hidden)
      }
    }
    mesh.count = desiredCount  // Three.js draws only the first `count` instances
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    dirtyRef.current = true

    // Sync render so dots appear on the very first frame.
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (renderer && camera) {
      renderer.render(scene, camera)
      dirtyRef.current = true
      updateOverlayRef.current?.()
    }
  }, [threeReady, layout])

  // ─── Phase 16.1.2 Item 3: Actor squares as Three.js LineSegments ──────
  // Squares render in world coords; scale automatically with camera zoom.
  useEffect(() => {
    if (!threeReady || !layout) return
    const group = actorSquaresGroupRef.current
    if (!group) return
    // Tear down previous squares (cheap; max ~5 squares).
    while (group.children.length > 0) {
      const child = group.children[0]
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
      group.remove(child)
    }
    const indigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const half = ACTOR_SQUARE / 2
    for (const cluster of layout.allClusters) {
      // Build square outline as 4 line segments (8 vertices total).
      // Three.js LineSegments expects pairs of points (start, end) per segment.
      const cx = cluster.center.x
      const cy = -cluster.center.y  // invert Y for Three.js
      const verts = new Float32Array([
        cx - half, cy - half, 0,   cx + half, cy - half, 0,  // top
        cx + half, cy - half, 0,   cx + half, cy + half, 0,  // right
        cx + half, cy + half, 0,   cx - half, cy + half, 0,  // bottom
        cx - half, cy + half, 0,   cx - half, cy - half, 0,  // left
      ])
      const geom = new THREE.BufferGeometry()
      geom.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      const mat = new THREE.LineBasicMaterial({ color: indigo })
      const lines = new THREE.LineSegments(geom, mat)
      group.add(lines)
    }
    dirtyRef.current = true
    const renderer = rendererRef.current
    const camera = cameraRef.current
    if (renderer && camera) renderer.render(sceneRef.current, camera)
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
    const target = pinned || hover
    const targetIdx = target?.dotIndex ?? -1
    const targetClusterIdx = targetIdx >= 0 ? layout.clusterByDotIndex[targetIdx] : null
    for (let i = 0; i < layout.allDots.length; i++) {
      const d = layout.allDots[i]
      let base
      if (d.color === 'amber') base = colorAmber
      else if (d.color === 'green') base = colorGreen
      else base = colorIndigo
      let c = base
      if (i === targetIdx) c = colorWhite
      else if (targetClusterIdx !== null && layout.clusterByDotIndex[i] === targetClusterIdx) c = lerpToWhite(base)
      mesh.setColorAt(i, c)
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    dirtyRef.current = true
  }, [threeReady, layout, hover, pinned])

  // ─── Pointer event handlers ──────────────────────────────────────────
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    draggingRef.current = true
    wasDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    camStartRef.current = { ...camPosRef.current }
  }, [])

  const raycast = useCallback((clientX, clientY) => {
    const renderer = rendererRef.current
    const camera = cameraRef.current
    const mesh = dotsMeshRef.current
    if (!renderer || !camera || !mesh) return null
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
    const d = layout?.allDots[dotIdx]
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
    const d = layout?.allDots[dotIdx]
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
  }, [layout, onClaimDotClick, raycast, worldToScreen])

  // ─── Zoom controls (Phase 16.1.2 Item 8: top-right +/-/FIT/%) ────────
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

      {/* Phase 16.1.2 Item 4: edges removed. SVG layer retained for amber
          L-shape paths only. */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {overlay?.amberPaths?.map((p) => {
          if (!p.screenPoints || p.screenPoints.length === 0) return null
          const d = p.screenPoints.map((pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `L ${pt.x} ${pt.y}`)).join(' ') + ' Z'
          return (
            <path
              key={`amber-${p.ownerParty}`}
              d={d}
              stroke="var(--accent-amber)"
              strokeWidth={1.5}
              fill="color-mix(in srgb, var(--accent-amber) 8%, transparent)"
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

      {/* Phase 16.1.2 Item 8: zoom controls top-right (+/-/FIT/%). */}
      <div style={{
        position: 'absolute',
        top: 12,
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

      {/* Exit hint (back-to-network, top-right above zoom controls). */}
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
