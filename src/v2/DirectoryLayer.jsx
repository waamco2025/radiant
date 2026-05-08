// DirectoryLayer — Phase 16.1.0 (Three.js migration).
//
// Per-role view onto the Radiant Network's public + privately-disclosed
// Claim and RFP catalog. Dot matrix grid + Claim/RFP dots rendered via
// Three.js (Points + InstancedMesh); HTML overlays (tooltip card, Actor
// squares, label pillboxes, umbrella SVG edges) project from world coords
// via worldToScreen and track camera moves via the shared RAF loop.
// Pan via drag; zoom via mouse wheel — same control patterns as V2Canvas.
//
// Phase 16.0 retained pieces:
//   • buildV22DirectoryDataForRole view-builder (per-role data contract)
//   • Phase 11.8 wipe-origin pinning + Phase 11A entry-exit phase state
//   • Bob's corner card visual + header pillbox
//   • Per-role view filtering (public-only / public+umbrella / own clusters)
//   • L-shaped amber border concept around the umbrella subset
//
// Phase 16.1.0 changes from 16.0.x:
//   • DirectoryLayer becomes a Three.js host + HTML overlay renderer.
//     Replaces the prior absolute-positioned HTML dots.
//   • Pan + zoom mirror V2Canvas (drag → camera translate; wheel → camera
//     zoom around cursor). MIN_ZOOM/MAX_ZOOM scoped narrower than parent
//     layer since clusters are smaller than parent-layer node graphs.
//   • Dots render via THREE.InstancedMesh (single draw call across all
//     dots). Per-instance colors via setColorAt; hover whitens the dot
//     and brightens its cluster siblings via a precomputed cluster
//     index lookup.
//   • Strict grid alignment: dot world-coords are integer multiples of
//     DOT_GRID; grid Points use the same spacing so dots and grid
//     intersections always coincide.
//   • One-cell buffer between umbrella (amber) and public (indigo) dots
//     within a cluster — rolled forward from 16.0.3's HTML phantom-slot
//     layout but enforced in world-coord computation now.

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import * as THREE from 'three'
import Tooltip from '../components/Tooltip.jsx'
import { buildV22DirectoryDataForRole } from './v2_2Data.js'

// ─── Layout constants (world units) ────────────────────────────────────
const DOT_GRID = 12               // world-units per grid cell stride
const DOT_RADIUS = 3              // world-unit radius (= 6×6 visual at zoom 1)
const ACTOR_SQUARE = 6            // px (screen-space, HTML overlay)
const MAX_COLS = 6
const ROW_GAP = DOT_GRID
const COL_GAP = DOT_GRID
const ACTOR_TO_DOTS_GAP = DOT_GRID * 2
const CLUSTER_PAD = 5
const CORNER_CARD_W = 210
const CORNER_CARD_H = 88
const CORNER_CARD_LEFT = 32
const CORNER_CARD_BOTTOM = 32
const ACTOR_LABEL_OFFSET = 18
const TOOLTIP_W = 230
const TOOLTIP_OFFSET = 12

// ─── Camera / zoom constants ───────────────────────────────────────────
const MIN_ZOOM = 0.5
const MAX_ZOOM = 4.0
const INITIAL_ZOOM = 1.5
const GRID_RANGE = 4000           // world-coord half-extent of background grid
const DRAG_THRESHOLD_PX = 4

// ─── Helpers ───────────────────────────────────────────────────────────
function snapGrid(v) { return Math.round(v / DOT_GRID) * DOT_GRID }

// Resolve a CSS variable name to a hex color via getComputedStyle.
// Used to feed Three.js Color from the same theme tokens HTML uses.
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

// ─── Tooltip card (mirrors parent-layer AssetNodeDot pattern) ──────────
function ClaimTooltipCard({ claim, disclosureType, x, y, viewportW }) {
  const dateStr = (claim.createdDate || '').slice(0, 10)
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
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 2 }}>{claim.owner}</div>
      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', display: 'flex', gap: 6 }}>
        <span style={{ textTransform: 'uppercase', letterSpacing: '0.06em' }}>{disclosureType || 'public'}</span>
        {dateStr && <><span>·</span><span>{dateStr}</span></>}
      </div>
    </div>
  )
}

// ─── Actor square + pillbox label (HTML overlay, screen coords) ────────
function ActorSquare({ ownerParty, x, y, faded }) {
  const half = ACTOR_SQUARE / 2
  return (
    <>
      <div
        data-actor-pillbox={ownerParty}
        style={{
          position: 'absolute',
          left: x,
          top: y - half - ACTOR_LABEL_OFFSET,
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
      <div
        style={{
          position: 'absolute',
          left: x - half,
          top: y - half,
          width: ACTOR_SQUARE,
          height: ACTOR_SQUARE,
          border: '1.5px solid var(--accent-indigo)',
          background: 'transparent',
          pointerEvents: 'none',
          zIndex: 4,
        }}
      />
    </>
  )
}

// Pillbox-fade helper: hover over a dot whose footprint overlaps the
// pillbox bbox fades the label to 25% opacity so the dot's hover halo
// reads on top.
const PILLBOX_W = 64
const PILLBOX_H = 16
function isHoverNearPillbox(hoverScreen, pillX, pillY) {
  if (!hoverScreen) return false
  // Approx: dot is 6×6 px screen. Use that footprint.
  const dotR = 3
  const dotL = hoverScreen.x - dotR, dotR_ = hoverScreen.x + dotR
  const dotT = hoverScreen.y - dotR, dotB = hoverScreen.y + dotR
  const pL = pillX - PILLBOX_W / 2, pR = pillX + PILLBOX_W / 2
  const pT = pillY - PILLBOX_H / 2, pB = pillY + PILLBOX_H / 2
  return !(dotR_ < pL || dotL > pR || dotB < pT || dotT > pB)
}

// ─── Layout: world-coord positions per cluster ─────────────────────────
// Returns { clusters, ownDots, ownRfpDots, otherRfpEntries, allDots,
// clusterByDotIndex }. `allDots` is the flat array of every dot the
// InstancedMesh will render; clusterByDotIndex maps dot index → cluster
// index (or -1 for own dots / RFPs that aren't part of an other-cluster).
function computeLayout(directoryData) {
  if (!directoryData) return null
  const N = directoryData.otherClusters.length

  // Horizontal spread of cluster centers in world coords. Two clusters →
  // x = ±450; one → x=0; N≥3 → spread evenly across [-700, +700].
  const sortedClusters = [...directoryData.otherClusters].sort((a, b) =>
    a.ownerParty.localeCompare(b.ownerParty),
  )
  const positions = new Map()
  const baseY = 0
  if (N === 1) {
    positions.set(sortedClusters[0].ownerParty, { x: 0, y: baseY })
  } else if (N === 2) {
    positions.set(sortedClusters[0].ownerParty, { x: -450, y: baseY })
    positions.set(sortedClusters[1].ownerParty, { x: 450, y: baseY })
  } else if (N > 0) {
    for (let i = 0; i < N; i++) {
      const fx = (i + 1) / (N + 1)
      const x = -700 + 1400 * fx
      positions.set(sortedClusters[i].ownerParty, { x: snapGrid(x), y: baseY })
    }
  }

  const allDots = []
  const clusterByDotIndex = []  // index → cluster idx, -1 for own/standalone

  const clusters = directoryData.otherClusters.map((cluster, clusterIdx) => {
    const center = positions.get(cluster.ownerParty) || { x: 0, y: 0 }
    const totalDots = cluster.publicClaims.length + cluster.umbrellaClaims.length
    const colsUsed = Math.min(MAX_COLS, totalDots)
    const clusterPxWidth = colsUsed * DOT_GRID
    // Anchor: top-left of cell (row=0, col=0). Cluster-center X centered
    // on the dot grid; vertical offset below the Actor square.
    const anchorX = snapGrid(center.x - clusterPxWidth / 2)
    const anchorY = snapGrid(center.y + ACTOR_TO_DOTS_GAP)

    // Row-major fill with one-cell buffer between subsets.
    const cellsPlaced = []
    for (let i = 0; i < cluster.umbrellaClaims.length; i++) {
      cellsPlaced.push({
        claim: cluster.umbrellaClaims[i],
        isAmber: true,
        row: Math.floor(i / MAX_COLS),
        col: i % MAX_COLS,
      })
    }
    let curRow, curCol
    const lastUmbrella = cellsPlaced[cellsPlaced.length - 1]
    if (lastUmbrella && cluster.publicClaims.length > 0) {
      if (lastUmbrella.col + 2 < MAX_COLS) {
        curRow = lastUmbrella.row
        curCol = lastUmbrella.col + 2  // gap at lastUmbrella.col + 1
      } else {
        curRow = lastUmbrella.row + 1
        curCol = 0
      }
    } else {
      curRow = 0
      curCol = 0
    }
    for (let i = 0; i < cluster.publicClaims.length; i++) {
      cellsPlaced.push({ claim: cluster.publicClaims[i], isAmber: false, row: curRow, col: curCol })
      curCol++
      if (curCol >= MAX_COLS) {
        curRow++
        curCol = 0
      }
    }

    const dots = cellsPlaced.map((entry) => ({
      ...entry,
      // World coords. NB: y increases downward in our convention; Three.js
      // OrthographicCamera in V2Canvas uses inverted Y (camera.position.set
      // with -y), so we feed worldY as-is and let the camera handle the flip.
      x: anchorX + entry.col * COL_GAP + DOT_GRID / 2,
      y: anchorY + entry.row * ROW_GAP + DOT_GRID / 2,
    }))
    // Track this cluster's contribution to the flat InstancedMesh.
    const clusterDotStart = allDots.length
    for (const d of dots) {
      allDots.push({
        x: d.x,
        y: d.y,
        color: d.isAmber ? 'amber' : 'indigo',
        claim: d.claim,
        clusterIdx,
      })
      clusterByDotIndex.push(clusterIdx)
    }
    const clusterDotEnd = allDots.length
    return {
      ownerParty: cluster.ownerParty,
      center,
      dots,
      dotIndices: { start: clusterDotStart, end: clusterDotEnd },
    }
  })

  // Own cluster: active actor's own Claims clustered around the corner card.
  // Anchored in screen-space (corner card is fixed at left:32, bottom:32),
  // so own dots also live in screen-space — we project back to world coords
  // by sitting them off to one side of the corner card. To keep them in
  // the InstancedMesh world but still adjacent to the corner card, we
  // dedicate a fixed world region near (-cornerOffset, +cornerOffset)
  // that nominally "lives" near the bottom-left of the canvas at zoom=1.
  const ownTotal = directoryData.ownClaims.length
  const ownAnchorX = snapGrid(-700)  // far-left world region
  const ownAnchorY = snapGrid(420)   // lower world region
  const ownDotEntries = []
  for (let i = 0; i < ownTotal; i++) {
    const row = Math.floor(i / MAX_COLS)
    const col = i % MAX_COLS
    const x = ownAnchorX + col * COL_GAP + DOT_GRID / 2
    const y = ownAnchorY + row * ROW_GAP + DOT_GRID / 2
    ownDotEntries.push({ claim: directoryData.ownClaims[i], x, y })
    allDots.push({ x, y, color: 'indigo', claim: directoryData.ownClaims[i], clusterIdx: -1 })
    clusterByDotIndex.push(-2)  // -2 = own dot (for cluster-brighten, treat ownDots as a cluster of their own)
  }

  // RFPs — own + others. Phase 16.1: keep Bob's RFP as an HTML overlay
  // next to the corner card. Other-cluster-adjacent RFPs ride along in
  // the InstancedMesh as green dots; standalone RFPs (no owner cluster)
  // get a free-standing slot.
  const ownRfpDots = directoryData.ownRfps.map((rfp) => ({ rfp }))
  const otherRfpEntries = []
  for (const rfp of directoryData.otherRfps) {
    const existingCluster = clusters.find((c) => c.ownerParty === rfp.owner)
    if (existingCluster) {
      const sq = existingCluster.center
      const x = snapGrid(sq.x + DOT_GRID * 4)
      const y = sq.y
      otherRfpEntries.push({ rfp, x, y, freeStanding: false })
      allDots.push({ x, y, color: 'green', claim: null, clusterIdx: -1, isRfp: true })
      clusterByDotIndex.push(-1)
    } else {
      const slot = { x: snapGrid(700), y: snapGrid(0) }
      otherRfpEntries.push({ rfp, x: slot.x, y: slot.y, freeStanding: true, squareX: slot.x, squareY: slot.y, ownerParty: rfp.owner })
      allDots.push({ x: slot.x, y: slot.y, color: 'green', claim: null, clusterIdx: -1, isRfp: true })
      clusterByDotIndex.push(-1)
    }
  }

  return { clusters, ownDots: ownDotEntries, ownRfpDots, otherRfpEntries, allDots, clusterByDotIndex }
}

// ─── Main DirectoryLayer ───────────────────────────────────────────────
export default function DirectoryLayer({
  open,
  activeParty,
  roleId,
  v22Provisionals,
  onOpenAIShopper,    // eslint-disable-line no-unused-vars -- chrome bar carries the entry
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

  // Phase 11.8: pinned wipe origin.
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

  // ─── Per-role data + layout ──────────────────────────────────────────
  const directoryData = useMemo(() => {
    if (!roleId) return null
    return buildV22DirectoryDataForRole(roleId, v22Provisionals)
  }, [roleId, v22Provisionals])

  const layout = useMemo(() => computeLayout(directoryData), [directoryData])

  // ─── Three.js refs + state ──────────────────────────────────────────
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const dotsMeshRef = useRef(null)
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

  // Hover/pinned state.
  const [hover, setHover] = useState(null)   // { claim, x, y (world), screenX, screenY, ownerParty, disclosureType }
  const [pinned, setPinned] = useState(null)
  useEffect(() => { if (phase === 'closed') { setHover(null); setPinned(null) } }, [phase])
  useEffect(() => { setHover(null); setPinned(null) }, [roleId])

  // Viewport size (for tooltip flip).
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

  // Screen positions for HTML overlay tracking. Refreshed every RAF tick
  // when camera changes; structure: { clusterCenters: Map<party, {x,y}>,
  // dotScreens: Array<{x,y}> aligned with allDots, ownRfpScreens, etc. }
  const [overlay, setOverlay] = useState(null)

  // ─── worldToScreen / camera helpers ──────────────────────────────────
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
    if (!containerRef.current) return { x, y }
    // Soft clamp: allow ample pan beyond cluster extent so the user can
    // explore. Bounds are 1500 world units in each direction.
    return {
      x: Math.max(-1500, Math.min(1500, x)),
      y: Math.max(-1500, Math.min(1500, y)),
    }
  }, [])

  // ─── Overlay refresh (called from animate loop after each render) ────
  const updateOverlayRef = useRef(() => {})
  useEffect(() => {
    updateOverlayRef.current = () => {
      if (!layout) return
      const ownerSquares = layout.clusters.map((c) => ({
        ownerParty: c.ownerParty,
        screen: worldToScreen(c.center.x, c.center.y),
      }))
      const dotScreens = layout.allDots.map((d) => worldToScreen(d.x, d.y))
      const freeStandingRfpSquares = layout.otherRfpEntries
        .filter((e) => e.freeStanding)
        .map((e) => ({
          ownerParty: e.ownerParty,
          screen: worldToScreen(e.squareX, e.squareY),
        }))
      setOverlay({ ownerSquares, dotScreens, freeStandingRfpSquares })
    }
  }, [layout, worldToScreen])

  // ─── Three.js scene init (once when phase enters 'in') ───────────────
  useEffect(() => {
    if (phase === 'closed') return
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return
    if (rendererRef.current) return  // already initialized

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

    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera
    updateCamera()

    // Build background grid as Points.
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
      dotsMeshRef.current = null
      setThreeReady(false)
    }
  }, [phase, updateCamera])

  // ─── Build / rebuild the dots InstancedMesh whenever layout changes ──
  useEffect(() => {
    if (!threeReady || !layout) return
    const scene = sceneRef.current
    if (!scene) return
    // Tear down previous mesh.
    if (dotsMeshRef.current) {
      scene.remove(dotsMeshRef.current)
      dotsMeshRef.current.geometry.dispose()
      dotsMeshRef.current.material.dispose()
      dotsMeshRef.current = null
    }
    if (layout.allDots.length === 0) return

    const geometry = new THREE.CircleGeometry(DOT_RADIUS, 16)
    const material = new THREE.MeshBasicMaterial()
    const mesh = new THREE.InstancedMesh(geometry, material, layout.allDots.length)
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(layout.allDots.length * 3), 3)

    const colorIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const colorAmber = cssVarToColor('--accent-amber', '#c49a45')
    const colorGreen = cssVarToColor('--accent-green', '#22c55e')
    const m = new THREE.Matrix4()
    for (let i = 0; i < layout.allDots.length; i++) {
      const d = layout.allDots[i]
      // Three.js Y is up, our world Y is down — invert at instance-matrix
      // time so dot positions match the worldToScreen convention.
      m.makeTranslation(d.x, -d.y, 0)
      mesh.setMatrixAt(i, m)
      const c = d.color === 'amber' ? colorAmber : d.color === 'green' ? colorGreen : colorIndigo
      mesh.setColorAt(i, c)
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    scene.add(mesh)
    dotsMeshRef.current = mesh
    dirtyRef.current = true

    return () => {
      if (mesh) {
        scene.remove(mesh)
        geometry.dispose()
        material.dispose()
      }
    }
  }, [threeReady, layout])

  // ─── Hover repaint: rewrite per-instance colors based on hover/pinned ─
  useEffect(() => {
    if (!threeReady || !layout) return
    const mesh = dotsMeshRef.current
    if (!mesh) return
    const colorIndigo = cssVarToColor('--accent-indigo', '#6b8aff')
    const colorAmber = cssVarToColor('--accent-amber', '#c49a45')
    const colorGreen = cssVarToColor('--accent-green', '#22c55e')
    const colorWhite = new THREE.Color('#ffffff')
    // Cluster-brighten: lerp toward white by 15% for siblings.
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
      if (i === targetIdx) {
        c = colorWhite
      } else if (targetClusterIdx !== null && layout.clusterByDotIndex[i] === targetClusterIdx) {
        c = lerpToWhite(base)
      }
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
    // Hover raycast.
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
      disclosureType: d.color === 'amber' ? 'umbrella' : 'public',
      dotIndex: dotIdx,
    })
  }, [hover, layout, clampPan, raycast, updateCamera, worldToScreen])

  const handleMouseUp = useCallback((e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (wasDragRef.current) {
      // Was a drag, not a click — don't pin.
      return
    }
    // Click intent. Resolve via raycaster.
    const dotIdx = raycast(e.clientX, e.clientY)
    if (dotIdx === null) {
      // Background click → dismiss.
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
      disclosureType: d.color === 'amber' ? 'umbrella' : 'public',
      dotIndex: dotIdx,
    })
    onClaimDotClick?.(d.claim)
  }, [layout, onClaimDotClick, raycast, worldToScreen])

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

  // Wire wheel listener — needs passive:false to call preventDefault().
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Keep pinned/hover screen positions in sync when camera moves.
  // dirtyRef → animate → updateOverlayRef.current → re-projects dotScreens.
  // We project the pinned/hover claim's world coords too whenever zoom or
  // overlay updates.
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

  // Hover pillbox-fade decision (per cluster).
  const activeHoverScreen = hover ? { x: hover.screenX, y: hover.screenY } : (pinned ? { x: pinned.screenX, y: pinned.screenY } : null)
  const fadePillboxFor = (centerX, centerY) => {
    const pillX = centerX
    const pillY = centerY - ACTOR_SQUARE / 2 - ACTOR_LABEL_OFFSET
    return isHoverNearPillbox(activeHoverScreen, pillX, pillY)
  }

  // Bob's RFP (own RFP) screen position — fixed, above the corner card.
  const ownRfpScreens = (layout?.ownRfpDots || []).map((d, i) => {
    const total = layout.ownRfpDots.length
    const cardCenterX = CORNER_CARD_LEFT + CORNER_CARD_W / 2
    const cardTopY = viewport.h - CORNER_CARD_BOTTOM - CORNER_CARD_H
    const offset = (i - (total - 1) / 2) * 14
    return { rfp: d.rfp, x: cardCenterX + offset, y: cardTopY - 24 }
  })

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
      <div
        style={{
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
        }}
      >Radiant Network</div>

      {/* Bob's corner card. */}
      <Tooltip
        content="Return to your network"
        position="top"
        wrapperStyle={{ position: 'absolute', left: CORNER_CARD_LEFT, bottom: CORNER_CARD_BOTTOM }}
      >
      <div
        onClick={(e) => { e.stopPropagation(); onClose?.() }}
        style={{
          width: CORNER_CARD_W,
          minHeight: CORNER_CARD_H,
          padding: '14px 16px',
          borderRadius: 10,
          background: 'var(--bg-card)',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))',
          cursor: 'pointer',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'border-color 150ms, background 150ms, box-shadow 150ms',
          boxShadow: '0 4px 14px rgba(0,0,0,0.32)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = 'var(--accent-indigo)'
          e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 6%, var(--bg-card))'
          e.currentTarget.style.boxShadow = '0 6px 22px rgba(0,0,0,0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
          e.currentTarget.style.background = 'var(--bg-card)'
          e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.32)'
        }}
      >
        <span style={{
          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
          padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
          color: 'var(--text-tertiary)', background: 'var(--bg-raised)',
          alignSelf: 'flex-start',
        }}>ACTOR</span>
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
          lineHeight: 1.3,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>{activeParty || 'You'}</div>
      </div>
      </Tooltip>

      {/* Umbrella DA edges — corner card → projected Actor square center. */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {layout && directoryData?.umbrellaEdges?.map((edge) => {
          const cluster = layout.clusters.find((c) => c.ownerParty === edge.targetParty)
          if (!cluster) return null
          const screen = overlay?.ownerSquares.find((s) => s.ownerParty === edge.targetParty)?.screen
          if (!screen) return null
          const fromX = CORNER_CARD_LEFT + CORNER_CARD_W
          const fromY = viewport.h - CORNER_CARD_BOTTOM - CORNER_CARD_H / 2
          const toX = screen.x - ACTOR_SQUARE / 2
          const toY = screen.y
          const dx = toX - fromX
          const cp1x = fromX + dx * 0.5
          const cp1y = fromY
          const cp2x = toX - dx * 0.5
          const cp2y = toY
          const d = `M ${fromX},${fromY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${toX},${toY}`
          return (
            <path
              key={edge.targetParty}
              d={d}
              stroke="var(--accent-indigo)"
              strokeWidth={1.5}
              strokeOpacity={0.6}
              fill="none"
            />
          )
        })}
      </svg>

      {/* Actor squares + label pillboxes (per cluster). */}
      {layout && overlay && layout.clusters.map((cluster) => {
        const screen = overlay.ownerSquares.find((s) => s.ownerParty === cluster.ownerParty)?.screen
        if (!screen) return null
        const faded = fadePillboxFor(screen.x, screen.y)
        return <ActorSquare key={cluster.ownerParty} ownerParty={cluster.ownerParty} x={screen.x} y={screen.y} faded={faded} />
      })}

      {/* Free-standing Actor squares (RFP-only owners, no cluster). */}
      {layout && overlay && overlay.freeStandingRfpSquares.map((s) => (
        <ActorSquare key={`fs-${s.ownerParty}`} ownerParty={s.ownerParty} x={s.screen.x} y={s.screen.y} faded={fadePillboxFor(s.screen.x, s.screen.y)} />
      ))}

      {/* Bob's own RFP green dot — fixed in viewport above corner card. */}
      {ownRfpScreens.map((d) => (
        <div
          key={d.rfp.id}
          data-rfp-id={d.rfp.id}
          style={{
            position: 'absolute',
            left: d.x - 3,
            top: d.y - 3,
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-green)',
            boxShadow: '0 0 5px color-mix(in srgb, var(--accent-green) 60%, transparent)',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      ))}

      {/* Tooltip (singleton). */}
      {(hover || pinned) && (() => {
        const t = pinned || hover
        return <ClaimTooltipCard claim={t.claim} disclosureType={t.disclosureType || 'public'} x={t.screenX ?? 0} y={t.screenY ?? 0} viewportW={viewport.w} />
      })()}

      {/* Exit hint */}
      <div style={{
        position: 'absolute',
        top: 16,
        right: 16,
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

      {/* Zoom indicator (debug-friendly, low-opacity). */}
      <div style={{
        position: 'absolute',
        bottom: 16,
        right: 16,
        padding: '4px 10px',
        borderRadius: 999,
        background: 'color-mix(in srgb, var(--bg-card) 80%, transparent)',
        border: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)',
        fontSize: 10,
        color: 'var(--text-dim)',
        pointerEvents: 'none',
        zIndex: 10,
      }}>
        zoom {zoom.toFixed(2)}×
      </div>
    </div>
  )
}
