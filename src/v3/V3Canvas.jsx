import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { createPortal } from 'react-dom'
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import {
  ObjectNodeFull, ObjectNodeMini, ObjectNodeDot,
  CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H,
} from './ObjectNode.jsx'
import { getVisibleObjects } from './v3Data.js'

// Disclosure edge render style — matches V2
const SDA_EDGE_STYLE = {
  full:        { color: 0x6b8aff, width: 2.0, dash: 0, gap: 0 },
  selective:   { color: 0xf59e0b, width: 2.5, dash: 8, gap: 4 },
  proofonly:   { color: 0x22c55e, width: 2.2, dash: 2, gap: 4 },
  'proof-only':{ color: 0x22c55e, width: 2.2, dash: 2, gap: 4 },
  provisional: { color: 0x888888, width: 1.5, dash: 6, gap: 5 },
  pending:     { color: 0x888888, width: 1.5, dash: 6, gap: 5 },
}

const MIN_ZOOM = 0.15
const MAX_ZOOM = 1.50
const DECAY = 0.92
const VEL_STOP = 0.5
const LOD_FULL = 0.79
const LOD_MINI = 0.43
const GRID_RANGE = 6000
const GRID_SPACING = 100

function premixColor(fgHex, strength) {
  const isDark = document.documentElement.dataset.theme !== 'light'
  const bg = new THREE.Color(isDark ? 0x0a0c10 : 0xedeef1)
  const fg = new THREE.Color(fgHex)
  return new THREE.Color(
    fg.r * strength + bg.r * (1 - strength),
    fg.g * strength + bg.g * (1 - strength),
    fg.b * strength + bg.b * (1 - strength),
  )
}

function snapToGrid(val) {
  return Math.round(val / GRID_SPACING) * GRID_SPACING
}

// Layout: explicit positions per role matching V2 spatial arrangement
function computeLayout(visibleObjects, actorId, visibleEdges) {
  const positions = {}

  if (actorId === 'actor-bob') {
    positions['actor-bob'] = { x: snapToGrid(0), y: snapToGrid(0) }
    positions['obj-sentinel'] = { x: snapToGrid(400), y: snapToGrid(0) }
    positions['obj-propulsion'] = { x: snapToGrid(800), y: snapToGrid(-300) }
    positions['obj-avionics'] = { x: snapToGrid(800), y: snapToGrid(200) }
    positions['obj-mc-chip'] = { x: snapToGrid(1300), y: snapToGrid(100) }
    positions['obj-mc-sensor'] = { x: snapToGrid(1300), y: snapToGrid(400) }

  } else if (actorId === 'actor-alice') {
    positions['actor-alice'] = { x: snapToGrid(0), y: snapToGrid(0) }
    positions['obj-mc-chip'] = { x: snapToGrid(500), y: snapToGrid(-400) }
    positions['obj-mc-sensor'] = { x: snapToGrid(500), y: snapToGrid(-100) }
    positions['obj-mc-board'] = { x: snapToGrid(500), y: snapToGrid(200) }
    positions['obj-mc-housing'] = { x: snapToGrid(500), y: snapToGrid(500) }
    positions['obj-avionics'] = { x: snapToGrid(1000), y: snapToGrid(-300) }
  }

  // Position child objects (provenance) below their parents
  const childrenByParent = {}
  visibleObjects.forEach(o => {
    if (o.provenance) {
      const pid = o.provenance.derivedFrom
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(o)
    }
  })

  const childSpacingH = 300
  const childSpacingV = 200

  Object.entries(childrenByParent).forEach(([parentId, kids]) => {
    const parentPos = positions[parentId]
    if (!parentPos) return
    const kidWidth = (kids.length - 1) * childSpacingH
    const kidStartX = parentPos.x - kidWidth / 2
    kids.forEach((kid, i) => {
      if (!positions[kid.id]) {
        positions[kid.id] = {
          x: snapToGrid(kidStartX + i * childSpacingH),
          y: snapToGrid(parentPos.y + childSpacingV),
        }
      }
    })
  })

  // Fallback: position any remaining unplaced objects with provenance
  visibleObjects.forEach(o => {
    if (positions[o.id]) return
    if (!o.provenance) return
    const parentPos = positions[o.provenance.derivedFrom]
    if (!parentPos) return
    const placedSiblings = visibleObjects.filter(
      s => s.id !== o.id && s.provenance?.derivedFrom === o.provenance.derivedFrom && positions[s.id]
    )
    const offset = placedSiblings.length * childSpacingH
    positions[o.id] = {
      x: snapToGrid(parentPos.x + offset),
      y: snapToGrid(parentPos.y + childSpacingV),
    }
  })

  // Final fallback: position any remaining unplaced objects
  // These are typically external assets connected via disclosure edges
  visibleObjects.forEach(o => {
    if (positions[o.id]) return
    if (o.provenance) return

    const connectedEdge = visibleEdges?.find(e =>
      (e.from === o.id && positions[e.to]) || (e.to === o.id && positions[e.from])
    )

    if (connectedEdge) {
      const connectedId = connectedEdge.from === o.id ? connectedEdge.to : connectedEdge.from
      const connectedPos = positions[connectedId]
      if (connectedPos) {
        const nearby = visibleObjects.filter(other =>
          other.id !== o.id && positions[other.id] &&
          Math.abs(positions[other.id].x - connectedPos.x - 400) < 50
        ).length
        positions[o.id] = {
          x: snapToGrid(connectedPos.x + 400 + nearby * 300),
          y: snapToGrid(connectedPos.y),
        }
      }
    }
  })

  // Absolute last resort
  visibleObjects.forEach(o => {
    if (!positions[o.id]) {
      positions[o.id] = { x: snapToGrid(1600), y: snapToGrid(0) }
    }
  })

  return positions
}

// Compute BFS distances from roots using provenance links
function computeBFSDistances(visibleObjects) {
  const distances = {}
  const roots = visibleObjects.filter(o => !o.provenance)
  const childrenByParent = {}
  visibleObjects.forEach(o => {
    if (o.provenance) {
      const pid = o.provenance.derivedFrom
      if (!childrenByParent[pid]) childrenByParent[pid] = []
      childrenByParent[pid].push(o.id)
    }
  })

  const queue = []
  roots.forEach(r => { distances[r.id] = 0; queue.push(r.id) })

  while (queue.length > 0) {
    const cur = queue.shift()
    const kids = childrenByParent[cur] || []
    kids.forEach(kid => {
      if (distances[kid] === undefined) {
        distances[kid] = distances[cur] + 1
        queue.push(kid)
      }
    })
  }

  const maxDist = Math.max(0, ...Object.values(distances))
  visibleObjects.forEach(o => {
    if (distances[o.id] === undefined) distances[o.id] = maxDist + 1
  })

  return { distances, maxDist }
}

// Disclosure type config — matches V2 colors and dash patterns
const SDA_EDGE_CONFIG = {
  full:        { label: 'Full Disclosure' },
  selective:   { label: 'Selective Disclosure' },
  proofonly:   { label: 'Proof-only Disclosure' },
  provisional: { label: 'Provisional' },
}
const SDA_EDGE_CSS = {
  full:        '#6b8aff',
  selective:   '#f59e0b',
  proofonly:   '#22c55e',
  provisional: '#888888',
}
const SDA_LEGEND_TOOLTIPS = {
  full: 'Full disclosure — the receiving party can access all parsed data fields and run evaluations against them.',
  selective: 'Selective disclosure — the receiving party can only access data fields chosen by the asset owner.',
  proofonly: 'Proof-only — the receiving party sees only pass/fail results from existing evaluations. No data field access.',
  provisional: 'Provisional — a disclosure request has been sent but the asset owner has not yet responded.',
}

function LegendBar() {
  const [tooltip, setTooltip] = useState(null)

  const handleEnter = (e, type) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ type, x: rect.left + rect.width / 2, y: rect.top - 8 })
  }

  return (
    <>
      <div data-legend style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        display: 'flex',
        gap: 12,
        zIndex: 50,
        pointerEvents: 'auto',
        padding: '5px 10px',
        background: 'color-mix(in srgb, var(--bg-surface) 85%, transparent)',
        borderRadius: 6,
        border: '1px solid var(--border)',
      }}>
        {Object.entries(SDA_EDGE_CONFIG).map(([type, cfg]) => (
          <div
            key={type}
            style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'default' }}
            onMouseEnter={e => handleEnter(e, type)}
            onMouseLeave={() => setTooltip(null)}
          >
            <svg width="18" height="4" style={{ display: 'block' }}>
              <line
                x1="0" y1="2" x2="18" y2="2"
                stroke={SDA_EDGE_CSS[type]}
                strokeWidth="2"
                strokeDasharray={
                  type === 'selective' ? '6,3' :
                  type === 'proofonly' ? '2,3' :
                  type === 'provisional' ? '4,4' :
                  'none'
                }
              />
            </svg>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              letterSpacing: '0.02em',
            }}>
              {cfg.label}
            </span>
          </div>
        ))}
      </div>

      {tooltip && createPortal(
        <div style={{
          position: 'fixed',
          left: Math.max(8, tooltip.x - 130),
          top: tooltip.y,
          transform: 'translateY(-100%)',
          padding: '6px 10px',
          background: 'var(--bg-surface)',
          border: `1px solid ${SDA_EDGE_CSS[tooltip.type]}`,
          borderRadius: 5,
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          width: 260,
          lineHeight: 1.4,
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
        }}>
          <div style={{ fontWeight: 600, color: SDA_EDGE_CSS[tooltip.type], marginBottom: 3, fontSize: 10, letterSpacing: '.04em' }}>
            {SDA_EDGE_CONFIG[tooltip.type].label.toUpperCase()}
          </div>
          {SDA_LEGEND_TOOLTIPS[tooltip.type]}
        </div>,
        document.body
      )}
    </>
  )
}

const V3Canvas = forwardRef(function V3Canvas({
  actorId, edges, selectedObjectId, onSelect, onDeselect, phase, panelWidth = 0,
  onParse, onEvaluate, onDisclose, dataVersion = 0,
}, ref) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  // Three.js refs
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const edgeGroupRef = useRef(null)
  const gridGroupRef = useRef(null)
  const dirtyRef = useRef(true)

  // Camera state
  const camPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(0.55)
  const [zoom, setZoom] = useState(0.55)
  const [threeReady, setThreeReady] = useState(false)

  // Pan state
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const camStartRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastMouseRef = useRef({ x: 0, y: 0, t: 0 })
  const momentumRef = useRef(null)
  const wasDragRef = useRef(false)
  const panAnimRef = useRef(null)

  // Edge hover (raycaster-driven)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [edgeTooltipPos, setEdgeTooltipPos] = useState(null)
  const edgeHideTimeout = useRef(null)
  const raycasterRef = useRef(null)

  useEffect(() => {
    const rc = new THREE.Raycaster()
    rc.params.Line2 = { threshold: 8 }
    raycasterRef.current = rc
  }, [])

  // Chain highlighting refs
  const edgeAnimRef = useRef(null)
  const chainNodeIdsRef = useRef(null)

  // Visible objects + layout
  const visibleObjects = useMemo(() => getVisibleObjects(actorId), [actorId, dataVersion])
  const positions = useMemo(() => computeLayout(visibleObjects, actorId, edges), [visibleObjects, actorId, edges])

  const objectMap = useMemo(() => {
    const m = {}
    visibleObjects.forEach(o => { m[o.id] = o })
    return m
  }, [visibleObjects])

  // Compute chain: all nodes connected to selected node via edges (ancestors + descendants)
  const chainNodeIds = useMemo(() => {
    if (!selectedObjectId) return null
    if (!positions[selectedObjectId]) return null

    const childrenOf = {}
    const parentsOf = {}
    edges.forEach(e => {
      if (!childrenOf[e.from]) childrenOf[e.from] = []
      childrenOf[e.from].push(e.to)
      if (!parentsOf[e.to]) parentsOf[e.to] = []
      parentsOf[e.to].push(e.from)
    })

    const visited = new Set()
    visited.add(selectedObjectId)

    // Walk ancestors (upstream)
    const upQueue = [selectedObjectId]
    while (upQueue.length > 0) {
      const cur = upQueue.shift()
      for (const parent of (parentsOf[cur] || [])) {
        if (!visited.has(parent)) { visited.add(parent); upQueue.push(parent) }
      }
    }

    // Walk descendants (downstream)
    const downQueue = [selectedObjectId]
    while (downQueue.length > 0) {
      const cur = downQueue.shift()
      for (const child of (childrenOf[cur] || [])) {
        if (!visited.has(child)) { visited.add(child); downQueue.push(child) }
      }
    }

    return visited
  }, [selectedObjectId, edges, positions])

  useEffect(() => { chainNodeIdsRef.current = chainNodeIds }, [chainNodeIds])

  // Node screen positions
  const [screenPositions, setScreenPositions] = useState([])

  // Data bounds
  const bounds = useMemo(() => {
    const posArr = Object.values(positions)
    if (posArr.length === 0) return { minX: -400, maxX: 400, minY: -300, maxY: 300 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    posArr.forEach(p => {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    })
    return { minX: minX - 300, maxX: maxX + 300, minY: minY - 200, maxY: maxY + 200 }
  }, [positions])

  // Clamp pan
  const clampPan = useCallback((x, y) => {
    if (!containerRef.current) return { x, y }
    const w = containerRef.current.clientWidth
    const h = containerRef.current.clientHeight
    const z = zoomRef.current
    const halfW = (w / z) * 0.5
    const halfH = (h / z) * 0.5
    const extraW = halfW * 0.5
    const extraH = halfH * 0.5
    return {
      x: Math.max(bounds.minX - extraW, Math.min(bounds.maxX + extraW, x)),
      y: Math.max(bounds.minY - extraH, Math.min(bounds.maxY + extraH, y)),
    }
  }, [bounds])

  // World to screen
  const worldToScreen = useCallback((worldX, worldY) => {
    const camera = cameraRef.current
    const renderer = rendererRef.current
    if (!camera || !renderer) return { x: 0, y: 0 }
    const vec = new THREE.Vector3(worldX, -worldY, 0)
    vec.project(camera)
    return {
      x: (vec.x * 0.5 + 0.5) * renderer.domElement.clientWidth,
      y: (-vec.y * 0.5 + 0.5) * renderer.domElement.clientHeight,
    }
  }, [])

  // Update camera frustum
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

  // Update overlay positions
  const updateOverlay = useCallback(() => {
    const result = []
    Object.entries(positions).forEach(([id, pos]) => {
      const sp = worldToScreen(pos.x, pos.y)
      result.push({ id, x: sp.x, y: sp.y })
    })
    setScreenPositions(result)
  }, [positions, worldToScreen])

  const updateOverlayRef = useRef(updateOverlay)
  useEffect(() => { updateOverlayRef.current = updateOverlay }, [updateOverlay])

  // ── Edge management ──
  const clearGroup = useCallback((group) => {
    if (!group) return
    while (group.children.length > 0) {
      const child = group.children[0]
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
      group.remove(child)
    }
  }, [])

  // Compute edge endpoint based on direction
  // Returns { x1, y1, x2, y2 } — offsets from center toward the other node's edge
  const computeEdgeEndpoints = useCallback((fromPos, toPos, lodMode) => {
    if (lodMode) {
      // LOD mode: center to center
      return { x1: fromPos.x, y1: fromPos.y, x2: toPos.x, y2: toPos.y }
    }

    const halfW = CARD_W / 2
    const halfH = CARD_H / 2

    const dx = toPos.x - fromPos.x
    const dy = toPos.y - fromPos.y
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)

    // If edge is more horizontal than vertical, use side edges
    if (absDx > absDy) {
      if (dx >= 0) {
        return { x1: fromPos.x + halfW, y1: fromPos.y, x2: toPos.x - halfW, y2: toPos.y }
      } else {
        return { x1: fromPos.x - halfW, y1: fromPos.y, x2: toPos.x + halfW, y2: toPos.y }
      }
    } else {
      // More vertical: top/bottom edges
      if (dy >= 0) {
        return { x1: fromPos.x, y1: fromPos.y + halfH, x2: toPos.x, y2: toPos.y - halfH }
      } else {
        return { x1: fromPos.x, y1: fromPos.y - halfH, x2: toPos.x, y2: toPos.y + halfH }
      }
    }
  }, [])

  // Build a single bezier curve line from endpoint coords
  const buildBezierLine = useCallback((x1, y1, x2, y2, color, width, dash, gap, resX, resY) => {
    const p0 = new THREE.Vector3(x1, -y1, 0)
    const p3 = new THREE.Vector3(x2, -y2, 0)

    // Determine control points for smooth S-curves
    const hDist = Math.abs(x2 - x1)
    const vDist = Math.abs(y2 - y1)
    let p1, p2
    if (hDist > vDist) {
      // More horizontal — control points at midpoint X
      const midX = (x1 + x2) / 2
      p1 = new THREE.Vector3(midX, -y1, 0)
      p2 = new THREE.Vector3(midX, -y2, 0)
    } else {
      // More vertical — control points at midpoint Y
      const midY = (y1 + y2) / 2
      p1 = new THREE.Vector3(x1, -midY, 0)
      p2 = new THREE.Vector3(x2, -midY, 0)
    }

    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3)
    const curvePoints = curve.getPoints(20)
    const posArr = []
    curvePoints.forEach(p => posArr.push(p.x, p.y, p.z))

    const geometry = new LineGeometry()
    geometry.setPositions(posArr)

    const isDashed = dash > 0
    let material
    if (isDashed) {
      material = new LineMaterial({
        color: new THREE.Color(color),
        linewidth: width,
        opacity: 1.0,
        transparent: true,
        depthWrite: false,
        resolution: new THREE.Vector2(resX, resY),
        dashed: true,
        dashSize: dash,
        gapSize: gap,
        dashScale: 1,
      })
    } else {
      material = new LineMaterial({
        color: premixColor(color, 0.85),
        linewidth: width,
        opacity: 1.0,
        transparent: false,
        depthWrite: false,
        resolution: new THREE.Vector2(resX, resY),
      })
    }
    const line = new Line2(geometry, material)
    if (isDashed) line.computeLineDistances()
    return line
  }, [])

  const buildEdges = useCallback((group, lodMode) => {
    clearGroup(group)
    const container = containerRef.current
    const resX = container ? container.clientWidth : window.innerWidth
    const resY = container ? container.clientHeight : window.innerHeight

    if (edges) {
      edges.forEach(edge => {
        const fromPos = positions[edge.from]
        const toPos = positions[edge.to]
        if (!fromPos || !toPos) return

        const cfg = SDA_EDGE_STYLE[edge.sdaType] || SDA_EDGE_STYLE.full
        const { x1, y1, x2, y2 } = computeEdgeEndpoints(fromPos, toPos, lodMode)
        const line = buildBezierLine(x1, y1, x2, y2, cfg.color, cfg.width, cfg.dash, cfg.gap, resX, resY)
        line.userData = {
          edgeId: edge.id,
          sdaType: edge.sdaType || 'full',
          from: edge.from,
          to: edge.to,
          isDashed: cfg.dash > 0,
        }
        group.add(line)
      })
    }

    dirtyRef.current = true
  }, [clearGroup, positions, edges, computeEdgeEndpoints, buildBezierLine])

  // Re-apply chain dimming on existing Line2 objects (call after any buildEdges)
  const reapplyChainDimming = useCallback(() => {
    const chain = chainNodeIdsRef.current
    const group = edgeGroupRef.current
    if (!chain || !group) return
    group.children.forEach(line => {
      const mat = line.material
      if (!mat) return
      const inChain = chain.has(line.userData?.from) && chain.has(line.userData?.to)
      line.userData._inChain = inChain
      mat.transparent = true
      mat.opacity = inChain ? (line.userData?.isDashed ? 0.7 : 1.0) : 0.08
      mat.needsUpdate = true
    })
    dirtyRef.current = true
  }, [])

  // Animate edge draw: progressively reveal by instanceCount
  const animateEdgeDraw = useCallback((group, duration = 500, staggerTotal = 200) => {
    if (!group || group.children.length === 0) return
    const lines = group.children.filter(c => c.geometry?.instanceCount !== undefined)
    if (lines.length === 0) return
    const fullCounts = lines.map(l => l.geometry.instanceCount)
    lines.forEach(l => { l.geometry.instanceCount = 0 })
    dirtyRef.current = true

    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      lines.forEach((l, i) => {
        const staggerDelay = lines.length > 1 ? (i / (lines.length - 1)) * staggerTotal : 0
        const lineElapsed = Math.max(0, elapsed - staggerDelay)
        const p = Math.min(1, lineElapsed / duration)
        const ease = 1 - Math.pow(1 - p, 2)
        l.geometry.instanceCount = Math.round(ease * fullCounts[i])
      })
      dirtyRef.current = true
      const allDone = lines.every((l, i) => l.geometry.instanceCount >= fullCounts[i])
      if (!allDone) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // ── Dot Grid ──
  const buildGrid = useCallback(() => {
    const group = gridGroupRef.current
    if (!group) return
    clearGroup(group)

    const isDark = document.documentElement.dataset.theme !== 'light'
    const gridColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const gridPoints = []
    const gridStart = -Math.ceil(GRID_RANGE / GRID_SPACING) * GRID_SPACING
    for (let gx = gridStart; gx <= GRID_RANGE; gx += GRID_SPACING) {
      for (let gy = gridStart; gy <= GRID_RANGE; gy += GRID_SPACING) {
        gridPoints.push(new THREE.Vector3(gx, gy, -1))
      }
    }
    if (gridPoints.length > 0) {
      const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints)
      const gridMaterial = new THREE.PointsMaterial({
        color: gridColor, size: 2.4, sizeAttenuation: false,
        opacity: isDark ? 0.20 : 0.25, transparent: true,
      })
      group.add(new THREE.Points(gridGeometry, gridMaterial))
    }
    dirtyRef.current = true
  }, [clearGroup])

  // ── Initialize Three.js ──
  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.setClearColor(0x000000, 0)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const edgeGroup = new THREE.Group()
    edgeGroupRef.current = edgeGroup
    scene.add(edgeGroup)

    const gridGroup = new THREE.Group()
    gridGroupRef.current = gridGroup
    scene.add(gridGroup)

    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    updateCamera()
    buildGrid()
    buildEdges(edgeGroup, zoomRef.current < LOD_FULL)
    setThreeReady(true)

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
      if (edgeGroupRef.current) {
        edgeGroupRef.current.children.forEach(line => {
          if (line.material && line.material.resolution) {
            line.material.resolution.set(w, h)
          }
        })
      }
      updateCamera()
    })
    ro.observe(container)

    return () => {
      cancelAnimationFrame(animId)
      if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
      if (edgeAnimRef.current) cancelAnimationFrame(edgeAnimRef.current)
      ro.disconnect()
      renderer.dispose()
      setThreeReady(false)
    }
  }, [updateCamera, buildGrid, buildEdges])

  // Rebuild edges on data change
  useEffect(() => {
    if (!threeReady || !edgeGroupRef.current) return
    buildEdges(edgeGroupRef.current, zoomRef.current < LOD_FULL)
    reapplyChainDimming()
  }, [threeReady, buildEdges, reapplyChainDimming])

  // Chain highlighting — dim/animate edges
  useEffect(() => {
    if (edgeAnimRef.current) {
      cancelAnimationFrame(edgeAnimRef.current)
      edgeAnimRef.current = null
    }

    const group = edgeGroupRef.current
    if (!group || group.children.length === 0) return

    group.children.forEach(line => {
      const mat = line.material
      if (!mat) return
      const from = line.userData?.from
      const to = line.userData?.to
      const inChain = !chainNodeIds || (chainNodeIds.has(from) && chainNodeIds.has(to))
      line.userData._inChain = inChain

      if (inChain) {
        mat.transparent = true
        mat.opacity = line.userData?.isDashed ? 0.7 : 1.0
      } else {
        mat.transparent = true
        mat.opacity = 0.08
      }
      mat.needsUpdate = true
    })

    // Animate chain edges when a node is selected
    if (chainNodeIds && group.children.length > 0) {
      const startTime = performance.now()
      const tick = () => {
        const t = (performance.now() - startTime) * 0.001
        group.children.forEach(line => {
          if (!line.userData?._inChain) return
          const mat = line.material
          if (!mat) return
          if (!line.userData.isDashed) {
            mat.opacity = 0.55 + 0.45 * Math.sin(t * 1.8)
            mat.needsUpdate = true
          } else {
            mat.dashOffset = -t * 12
            mat.needsUpdate = true
          }
        })
        dirtyRef.current = true
        edgeAnimRef.current = requestAnimationFrame(tick)
      }
      edgeAnimRef.current = requestAnimationFrame(tick)
    }

    dirtyRef.current = true

    return () => {
      if (edgeAnimRef.current) {
        cancelAnimationFrame(edgeAnimRef.current)
        edgeAnimRef.current = null
      }
    }
  }, [chainNodeIds])

  // Theme change rebuilds grid + edges
  useEffect(() => {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        buildGrid()
        if (edgeGroupRef.current) {
          buildEdges(edgeGroupRef.current, zoomRef.current < LOD_FULL)
          reapplyChainDimming()
        }
        dirtyRef.current = true
      })
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [buildGrid, buildEdges, reapplyChainDimming])

  // ── Animated pan ──
  const animatedPanTo = useCallback((targetX, targetY, targetZoom, duration = 600) => {
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
    const startX = camPosRef.current.x
    const startY = camPosRef.current.y
    const startZ = zoomRef.current
    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const t = Math.min(1, (time - startTime) / duration)
      const ease = 1 - Math.pow(1 - t, 3)
      camPosRef.current = {
        x: startX + (targetX - startX) * ease,
        y: startY + (targetY - startY) * ease,
      }
      const newZ = startZ + (targetZoom - startZ) * ease
      zoomRef.current = newZ
      setZoom(newZ)
      updateCamera()
      if (t < 1) {
        panAnimRef.current = requestAnimationFrame(tick)
      } else {
        panAnimRef.current = null
        // Rebuild edges for final LOD state
        if (edgeGroupRef.current) {
          buildEdges(edgeGroupRef.current, newZ < LOD_FULL)
          reapplyChainDimming()
        }
      }
    }
    panAnimRef.current = requestAnimationFrame(tick)
  }, [updateCamera, buildEdges, reapplyChainDimming])

  // ── Network build animation (exposed via ref) ──
  useImperativeHandle(ref, () => ({
    prepNetworkBuild: () => {
      const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
      if (cards) {
        cards.forEach(card => {
          card.style.transition = 'none'
          card.style.opacity = '0'
        })
        overlayRef.current?.offsetHeight
      }
      clearGroup(edgeGroupRef.current)
      dirtyRef.current = true
    },
    playNetworkBuild: () => {
      const { distances, maxDist } = computeBFSDistances(visibleObjects)

      const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
      if (!cards || cards.length === 0) return

      // Ensure cards hidden
      cards.forEach(card => {
        card.style.transition = 'none'
        card.style.opacity = '0'
      })
      overlayRef.current?.offsetHeight

      const perLayerDelay = Math.min(180, 1200 / ((maxDist + 2) + 1))
      const phase1Start = 50
      const shells = []

      // PHASE 1: White-bordered shells fan out
      cards.forEach(card => {
        const cardId = card.getAttribute('data-card-id')
        const dist = distances[cardId] ?? maxDist + 1
        const delay = phase1Start + dist * perLayerDelay

        setTimeout(() => {
          card.style.transition = 'opacity 400ms ease-out'
          card.style.opacity = '0.02'
          card.style.filter = 'contrast(0) brightness(2)'

          const rect = card.getBoundingClientRect()
          const z = zoomRef.current
          const shell = document.createElement('div')
          shell.className = '_netbuild-shell'
          shell.style.cssText = `
            position: fixed;
            left: ${rect.left}px;
            top: ${rect.top}px;
            width: ${CARD_W * z}px;
            height: ${CARD_H * z}px;
            border: 1.5px solid rgba(255, 255, 255, 0.6);
            border-radius: ${8 * z}px;
            pointer-events: none;
            z-index: 5000;
            box-sizing: border-box;
            opacity: 0;
            transition: opacity 400ms ease-out;
          `
          document.body.appendChild(shell)
          shells.push(shell)
          requestAnimationFrame(() => { shell.style.opacity = '1' })
        }, delay)
      })

      // PHASE 2: Edges draw in
      const phase2Start = phase1Start + (maxDist + 1) * perLayerDelay + 200
      setTimeout(() => {
        const lodMode = zoomRef.current < LOD_FULL
        buildEdges(edgeGroupRef.current, lodMode)
        animateEdgeDraw(edgeGroupRef.current, 500, 200)
      }, phase2Start)

      // PHASE 3: Fade out shells, fill cards with color
      const phase3Start = phase2Start + 400
      setTimeout(() => {
        shells.forEach(shell => {
          shell.style.transition = 'opacity 300ms ease-out'
          shell.style.opacity = '0'
        })
      }, phase3Start)

      cards.forEach(card => {
        const cardId = card.getAttribute('data-card-id')
        const dist = distances[cardId] ?? maxDist + 1
        const delay = phase3Start + 100 + dist * (perLayerDelay * 0.5)

        setTimeout(() => {
          card.style.transition = 'opacity 350ms ease-out, filter 450ms ease-out'
          card.style.opacity = '1'
          card.style.filter = 'none'
        }, delay)
      })

      // CLEANUP
      const cleanupDelay = phase3Start + 100 + (maxDist + 1) * (perLayerDelay * 0.5) + 600
      setTimeout(() => {
        shells.forEach(shell => shell.remove())
        cards.forEach(card => {
          card.style.filter = ''
          card.style.transition = ''
          card.style.opacity = ''
        })
      }, cleanupDelay)
    },
    panToNode: (nodeId) => {
      const pos = positions[nodeId]
      if (!pos) return
      const targetZoom = Math.max(LOD_FULL + 0.05, zoomRef.current)
      // Offset X slightly right so the node appears centered in the visible canvas
      // (accounting for the detail panel that opens on the right)
      animatedPanTo(pos.x + 60, pos.y, targetZoom, 400)
    },
  }), [visibleObjects, clearGroup, buildEdges, animateEdgeDraw, positions, animatedPanTo])

  // ── Pan handlers ──
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    if (momentumRef.current) {
      cancelAnimationFrame(momentumRef.current)
      momentumRef.current = null
    }
    draggingRef.current = true
    wasDragRef.current = false
    dragStartRef.current = { x: e.clientX, y: e.clientY }
    camStartRef.current = { ...camPosRef.current }
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: Date.now() }
    velocityRef.current = { x: 0, y: 0 }
  }, [])

  const handleMouseMove = useCallback((e) => {
    if (!draggingRef.current) return
    const z = zoomRef.current
    const dx = (e.clientX - dragStartRef.current.x) / z
    const dy = (e.clientY - dragStartRef.current.y) / z
    const now = Date.now()
    const dt = now - lastMouseRef.current.t || 1
    velocityRef.current = {
      x: (e.clientX - lastMouseRef.current.x) / dt * 16,
      y: (e.clientY - lastMouseRef.current.y) / dt * 16,
    }
    lastMouseRef.current = { x: e.clientX, y: e.clientY, t: now }
    const rawDx = e.clientX - dragStartRef.current.x
    const rawDy = e.clientY - dragStartRef.current.y
    if (Math.abs(rawDx) > 3 || Math.abs(rawDy) > 3) wasDragRef.current = true
    const clamped = clampPan(camStartRef.current.x - dx, camStartRef.current.y - dy)
    camPosRef.current = clamped
    updateCamera()
  }, [clampPan, updateCamera])

  // Raycaster-based edge hover
  const handleEdgeHover = useCallback((e) => {
    const camera = cameraRef.current
    const edgeGroup = edgeGroupRef.current
    const container = containerRef.current
    const rc = raycasterRef.current
    if (!camera || !edgeGroup || !container || !rc) return
    if (draggingRef.current) return

    // Don't show edge tooltips when hovering over HTML card elements
    const overlay = overlayRef.current
    if (overlay) {
      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (target && overlay.contains(target)) {
        if (hoveredEdge !== null) {
          setHoveredEdge(null)
          setEdgeTooltipPos(null)
        }
        return
      }
    }

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    )
    rc.setFromCamera(mouse, camera)

    const intersects = rc.intersectObjects(edgeGroup.children, false)
    if (intersects.length > 0) {
      const hit = intersects[0].object
      const edgeId = hit.userData?.edgeId
      if (edgeId) {
        if (edgeHideTimeout.current) { clearTimeout(edgeHideTimeout.current); edgeHideTimeout.current = null }
        setHoveredEdge(edgeId)
        setEdgeTooltipPos({ x: e.clientX, y: e.clientY })
        return
      }
    }

    // No hit — debounced hide
    if (hoveredEdge && !edgeHideTimeout.current) {
      edgeHideTimeout.current = setTimeout(() => {
        setHoveredEdge(null)
        setEdgeTooltipPos(null)
        edgeHideTimeout.current = null
      }, 80)
    }
  }, [hoveredEdge])

  const handleMouseUp = useCallback(() => {
    if (!draggingRef.current) return
    draggingRef.current = false
    let vx = velocityRef.current.x
    let vy = velocityRef.current.y
    if (Math.abs(vx) < VEL_STOP && Math.abs(vy) < VEL_STOP) return
    const tick = () => {
      vx *= DECAY
      vy *= DECAY
      if (Math.abs(vx) < VEL_STOP && Math.abs(vy) < VEL_STOP) { momentumRef.current = null; return }
      const z = zoomRef.current
      const clamped = clampPan(camPosRef.current.x - vx / z, camPosRef.current.y - vy / z)
      camPosRef.current = clamped
      updateCamera()
      momentumRef.current = requestAnimationFrame(tick)
    }
    momentumRef.current = requestAnimationFrame(tick)
  }, [clampPan, updateCamera])

  // Zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    const dir = e.deltaY > 0 ? 0.97 : 1.03
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

    if (edgeGroupRef.current) {
      const wasLod = oldZoom < LOD_FULL
      const isLod = newZoom < LOD_FULL
      if (wasLod !== isLod) {
        buildEdges(edgeGroupRef.current, isLod)
        reapplyChainDimming()
      }
    }
  }, [clampPan, updateCamera, buildEdges, reapplyChainDimming])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Zoom controls ──
  const zoomIn = useCallback(() => {
    const oldZoom = zoomRef.current
    const newZoom = Math.min(MAX_ZOOM, oldZoom * 1.15)
    zoomRef.current = newZoom
    setZoom(newZoom)
    updateCamera()
    if (edgeGroupRef.current && (oldZoom < LOD_FULL) !== (newZoom < LOD_FULL)) {
      buildEdges(edgeGroupRef.current, newZoom < LOD_FULL)
      reapplyChainDimming()
    }
  }, [updateCamera, buildEdges, reapplyChainDimming])

  const zoomOut = useCallback(() => {
    const oldZoom = zoomRef.current
    const newZoom = Math.max(MIN_ZOOM, oldZoom * 0.87)
    zoomRef.current = newZoom
    setZoom(newZoom)
    updateCamera()
    if (edgeGroupRef.current && (oldZoom < LOD_FULL) !== (newZoom < LOD_FULL)) {
      buildEdges(edgeGroupRef.current, newZoom < LOD_FULL)
      reapplyChainDimming()
    }
  }, [updateCamera, buildEdges, reapplyChainDimming])

  const fitAll = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const posArr = Object.values(positions)
    if (posArr.length === 0) return

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    posArr.forEach(p => {
      if (p.x < minX) minX = p.x
      if (p.x > maxX) maxX = p.x
      if (p.y < minY) minY = p.y
      if (p.y > maxY) maxY = p.y
    })

    const padX = CARD_W + 60
    const padY = CARD_H + 60
    const dataW = (maxX - minX) + padX * 2
    const dataH = (maxY - minY) + padY * 2
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2

    const w = container.clientWidth
    const h = container.clientHeight
    const zoomX = w / dataW
    const zoomY = h / dataH
    const targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)))

    animatedPanTo(centerX, centerY, targetZoom, 500)
  }, [positions, animatedPanTo])

  // Handle background click → deselect
  const handleCanvasClick = useCallback((e) => {
    if (wasDragRef.current) return
    if (e.target.closest('[data-node-id]')) return
    if (e.target.closest('[data-zoom-controls]')) return
    if (e.target.closest('[data-legend]')) return
    onDeselect()
  }, [onDeselect])

  // LOD mode
  const lodMode = zoom >= LOD_FULL ? 'full' : zoom >= LOD_MINI ? 'mini' : 'dot'
  const zoomPct = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10) + '%'

  const zoomBtnStyle = {
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    padding: 0,
    lineHeight: 1,
  }

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', cursor: draggingRef.current ? 'grabbing' : 'grab' }}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => { handleMouseMove(e); handleEdgeHover(e) }}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* Three.js canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />

      {/* HTML overlay for nodes */}
      <div ref={overlayRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        {threeReady && screenPositions.map(sp => {
          const obj = objectMap[sp.id]
          if (!obj) return null
          const isSelected = selectedObjectId === sp.id
          const isActionable = isSelected && obj.artifactUri !== null
          const isOwned = obj.owner === actorId

          let cardW = CARD_W, cardH = CARD_H
          if (lodMode === 'mini') { cardW = MINI_CARD_W; cardH = MINI_CARD_H }
          else if (lodMode === 'dot') { cardW = 10; cardH = 10 }

          return (
            <div
              key={sp.id}
              data-node-id={sp.id}
              data-card-id={sp.id}
              style={{
                position: 'absolute',
                left: sp.x - cardW / 2,
                top: sp.y - cardH / 2,
                pointerEvents: 'auto',
                opacity: chainNodeIds && !chainNodeIds.has(sp.id) ? 0.25 : 1,
                transition: 'opacity 200ms ease',
              }}
              onClick={(e) => {
                if (wasDragRef.current) return
                e.stopPropagation()
                onSelect(sp.id)
              }}
            >
              {lodMode === 'full' && (
                <ObjectNodeFull
                  obj={obj}
                  selected={isSelected}
                  onParse={isActionable && isOwned ? onParse : undefined}
                  onEvaluate={isActionable ? onEvaluate : undefined}
                  onDisclose={isActionable && isOwned ? onDisclose : undefined}
                />
              )}
              {lodMode === 'mini' && <ObjectNodeMini obj={obj} selected={isSelected} />}
              {lodMode === 'dot' && <ObjectNodeDot selected={isSelected} />}
            </div>
          )
        })}
      </div>

      {/* Zoom controls */}
      <div data-zoom-controls style={{
        position: 'absolute',
        top: 12,
        right: 12 + panelWidth,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        zIndex: 50,
        pointerEvents: 'auto',
        transition: 'right 200ms ease',
      }}>
        <button onClick={zoomIn} style={zoomBtnStyle}>+</button>
        <button onClick={zoomOut} style={zoomBtnStyle}>−</button>
        <button onClick={fitAll} style={{ ...zoomBtnStyle, fontSize: 8, fontWeight: 600, letterSpacing: '0.04em' }}>FIT</button>
        <div style={{
          marginTop: 4,
          fontSize: 9,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-tertiary)',
          textAlign: 'center',
          letterSpacing: '0.02em',
        }}>
          {zoomPct}
        </div>
      </div>

      {/* Legend */}
      <LegendBar />

      {/* Edge hover tooltip (portal, raycaster-driven) */}
      {hoveredEdge && edgeTooltipPos && (() => {
        const edgeGroup = edgeGroupRef.current
        if (!edgeGroup) return null
        const hitLine = edgeGroup.children.find(c => c.userData?.edgeId === hoveredEdge)
        if (!hitLine) return null
        const sdaType = hitLine.userData.sdaType || 'full'
        const cssColor = {
          full: '#6b8aff',
          selective: '#f59e0b',
          proofonly: '#22c55e',
          'proof-only': '#22c55e',
          provisional: '#888888',
          pending: '#888888',
        }[sdaType] || '#6b8aff'
        const label = {
          full: 'Full Disclosure',
          selective: 'Selective Disclosure',
          proofonly: 'Proof-only Disclosure',
          'proof-only': 'Proof-only Disclosure',
          provisional: 'Provisional',
          pending: 'Pending — Awaiting Response',
        }[sdaType] || 'Full Disclosure'
        const fromName = objectMap[hitLine.userData.from]?.name || hitLine.userData.from
        const toName = objectMap[hitLine.userData.to]?.name || hitLine.userData.to

        return createPortal(
          <div style={{
            position: 'fixed',
            left: edgeTooltipPos.x + 12,
            top: edgeTooltipPos.y - 8,
            zIndex: 9999,
            padding: '6px 10px',
            background: 'var(--bg-surface)',
            border: `1px solid ${cssColor}`,
            borderRadius: 6,
            fontSize: 10,
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-secondary)',
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
            whiteSpace: 'nowrap',
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 18, height: 2,
                background: cssColor,
                borderRadius: 1,
                display: 'inline-block',
              }} />
              <span style={{ color: cssColor, fontWeight: 600 }}>
                {label}
              </span>
            </div>
            <div style={{ color: 'var(--text-tertiary)' }}>
              {fromName} → {toName}
            </div>
          </div>,
          document.body
        )
      })()}
    </div>
  )
})

export default V3Canvas
