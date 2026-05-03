import { useRef, useEffect, useState, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react'
import { createPortal, flushSync } from 'react-dom'
import * as THREE from 'three'
import { Line2 } from 'three/examples/jsm/lines/Line2.js'
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import AssetNode, { AssetNodeDot, AssetNodeMini, CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H, CATEGORY_CONFIG } from './AssetNode.jsx'
import LayerBorder from './LayerBorder.jsx'
import LayerPill from './LayerPill.jsx'
// LayerTransitionOverlay kept as file but no longer used — View Transitions API replaces it

const MIN_ZOOM = 0.20
const MAX_ZOOM = 1.50
const DECAY = 0.92
const VEL_STOP = 0.5
const LOD_THRESHOLD = 0.79
const MID_LOD_THRESHOLD = 0.43

// SDA edge type visual config
const SDA_EDGE_CONFIG = {
  full:       { color: 0x6b8aff, dash: 0, gap: 0,   label: 'Full Disclosure' },
  selective:  { color: 0xf59e0b, dash: 8, gap: 4,   label: 'Selective Disclosure' },
  proofonly:  { color: 0x22c55e, dash: 2, gap: 4,   label: 'Proof-only Disclosure' },
  cascade:    { color: 0xa78bfa, dash: 4, gap: 3,   label: 'Cascade Disclosure', hidden: true },
  provisional:{ color: 0x888888, dash: 6, gap: 5,   label: 'Provisional' },
}
const SDA_EDGE_CSS = {
  full:       '#6b8aff',
  selective:  '#f59e0b',
  proofonly:  '#22c55e',
  cascade:    '#a78bfa',
  provisional:'#888888',
}
const SDA_EDGE_WIDTH = {
  full:       2.0,
  selective:  2.5,
  proofonly:  2.2,
  cascade:    2.0,
  provisional:1.5,
}

// Dot grid params by depth
const BASE_GRID_SPACING = 100
const GRID_SPACING_MULT = 1.3    // per depth level
const GRID_RANGE = 8000

function getCSSVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim()
}

function cssColorToThreeColor(cssVar) {
  const val = getCSSVar(cssVar)
  if (!val) return new THREE.Color(0x444444)
  return new THREE.Color(val)
}

// Parse a CSS color string to a Three.js Color (for computed tint colors)
function parseCSSColor(str) {
  if (!str) return null
  // Use a temp element to resolve CSS color-mix / var() to rgb
  const el = document.createElement('div')
  el.style.color = str
  document.body.appendChild(el)
  const computed = getComputedStyle(el).color
  document.body.removeChild(el)
  // Parse rgb(r, g, b) or rgb(r g b) — extract numbers for THREE.Color
  const nums = computed.match(/[\d.]+/g)
  if (!nums || nums.length < 3) return null
  return new THREE.Color(
    parseFloat(nums[0]) / 255,
    parseFloat(nums[1]) / 255,
    parseFloat(nums[2]) / 255,
  )
}

// Pre-mix edge color with background to simulate transparency without alpha blending
function premixColor(fgHex, strength) {
  const isDark = document.documentElement.dataset.theme !== 'light'
  const bg = new THREE.Color(isDark ? 0x0a0c10 : 0xede9e3)
  const fg = new THREE.Color(fgHex)
  return new THREE.Color(
    fg.r * strength + bg.r * (1 - strength),
    fg.g * strength + bg.g * (1 - strength),
    fg.b * strength + bg.b * (1 - strength),
  )
}

function setViewTransitionBg() {
  const isDark = document.documentElement.dataset.theme !== 'light'
  const color = isDark ? '#0a0c10' : '#ede9e3'
  let style = document.getElementById('vt-bg-style')
  if (!style) {
    style = document.createElement('style')
    style.id = 'vt-bg-style'
    document.head.appendChild(style)
  }
  style.textContent = `::view-transition { background: ${color}; }`
}

function getGridParams(depthLevel) {
  const isDark = document.documentElement.dataset.theme !== 'light'
  const spacing = BASE_GRID_SPACING * Math.pow(GRID_SPACING_MULT, depthLevel)
  const opacity = isDark ? 0.28 : 0.32
  const radius = depthLevel === 0 ? 1.2 : 1.6
  return { spacing, opacity: Math.min(opacity, 0.4), radius }
}

// Layout children in a horizontal row centered at origin
const SDA_LEGEND_TOOLTIPS = {
  full: 'Full disclosure — the receiving party can access all parsed data fields and run evaluations against them.',
  selective: 'Selective disclosure — the receiving party can only access data fields chosen by the asset owner.',
  proofonly: 'Proof-only — the receiving party sees only pass/fail results from existing evaluations. No data field access.',
  provisional: 'Provisional — a disclosure request has been sent but the asset owner has not yet responded.',
  cascade: 'Cascade disclosure — access was forwarded through an intermediary. Permission is capped at the intermediary\'s own access level.',
}

function LegendBar() {
  const [tooltip, setTooltip] = useState(null) // { type, x, y }

  const handleEnter = (e, type) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip({ type, x: rect.left + rect.width / 2, y: rect.top - 8 })
  }

  return (
    <>
      <div style={{
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
        viewTransitionName: 'none',
      }}>
        {Object.entries(SDA_EDGE_CONFIG).filter(([, cfg]) => !cfg.hidden).map(([type, cfg]) => (
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
                  type === 'cascade' ? '4,3' :
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

      {/* Portal tooltip */}
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

function snapToGrid(val, depthLevel) {
  const spacing = BASE_GRID_SPACING * Math.pow(GRID_SPACING_MULT, depthLevel)
  return Math.round(Math.round(val / spacing) * spacing)
}

function layoutChildren(children, depthLevel = 1) {
  const spacing = BASE_GRID_SPACING * Math.pow(GRID_SPACING_MULT, depthLevel)
  let stepUnits = Math.ceil(300 / spacing)
  if (stepUnits % 2 !== 0) stepUnits++
  const stepX = stepUnits * spacing
  const tierGap = Math.round(200 / spacing) * spacing

  const positioned = []

  // Classify children
  const claims = children.filter(c => c.isClaim || c.category === 'claim')
  const evidence = children.filter(c => c.isEvidence || c.category === 'evidence')
  const parses = children.filter(c => c.isParse || c.category === 'parse')
  const evalsActive = children.filter(c =>
    (c.isEvaluation || c.category === 'evaluation') && c.status !== 'superseded'
  )
  const evalsSuperseded = children.filter(c =>
    (c.isEvaluation || c.category === 'evaluation') && c.status === 'superseded'
  )

  const hasClaims = claims.length > 0

  if (hasClaims) {
    // ── Claims-aware layout ──
    const hasEvidence = evidence.length > 0
    const horizontalOffset = (hasEvidence && claims.length > 0) ? Math.round(stepX * 0.75) : 0

    // Tier 1 (y=0): Claims — offset left when evidence exists
    const claimsW = (claims.length - 1) * stepX
    const claimsStartX = -claimsW / 2 - horizontalOffset
    claims.forEach((claim, i) => {
      positioned.push({
        ...claim,
        x: snapToGrid(claimsStartX + i * stepX, depthLevel),
        y: snapToGrid(0, depthLevel),
      })
    })

    // Tier 2: Evals — grouped below their parent claim
    const claimPositions = {}
    positioned.filter(p => p.isClaim || p.category === 'claim').forEach(p => {
      claimPositions[p.id] = { x: p.x, evalCount: 0 }
    })

    // Superseded evals: one tierGap below claims
    const evalSupY = tierGap
    const occupiedSupXs = new Set()
    evalsSuperseded.forEach(supNode => {
      const claimPos = claimPositions[supNode.claimId]
      let preferredX = claimPos ? claimPos.x : snapToGrid(0, depthLevel)
      let candidateX = snapToGrid(preferredX, depthLevel)
      while (occupiedSupXs.has(candidateX)) {
        candidateX = snapToGrid(candidateX + stepX, depthLevel)
      }
      occupiedSupXs.add(candidateX)
      positioned.push({ ...supNode, x: candidateX, y: snapToGrid(evalSupY, depthLevel) })
    })

    // Active evals: below superseded (or at tierGap if no superseded)
    const evalActiveY = evalsSuperseded.length > 0 ? tierGap * 2 : tierGap
    const occupiedEvalXs = new Set()
    evalsActive.forEach(evalNode => {
      const claimPos = claimPositions[evalNode.claimId]
      let preferredX = claimPos ? claimPos.x : snapToGrid(0, depthLevel)
      let candidateX = snapToGrid(preferredX, depthLevel)
      while (occupiedEvalXs.has(candidateX)) {
        candidateX = snapToGrid(candidateX + stepX, depthLevel)
      }
      occupiedEvalXs.add(candidateX)
      positioned.push({ ...evalNode, x: candidateX, y: snapToGrid(evalActiveY, depthLevel) })
    })

    // Tier 3: Evidence — below evals, offset right when claims exist
    const evBaseY = evalsActive.length > 0 || evalsSuperseded.length > 0
      ? (evalsSuperseded.length > 0 ? tierGap * 3 : tierGap * 2)
      : tierGap
    const evW = (evidence.length - 1) * stepX
    const evStartX = -evW / 2 + horizontalOffset
    evidence.forEach((ev, i) => {
      positioned.push({
        ...ev,
        x: snapToGrid(evStartX + i * stepX, depthLevel),
        y: snapToGrid(evBaseY, depthLevel),
      })
    })

    // Tier 4: Parse — below source evidence
    const parseY = evBaseY + tierGap
    const occupiedParseXs = new Set()
    parses.forEach(pepNode => {
      const sourceEvNode = positioned.find(p => p.id === pepNode.sourceEvidenceId)
      let preferredX = sourceEvNode ? sourceEvNode.x : snapToGrid(0, depthLevel)
      let candidateX = snapToGrid(preferredX, depthLevel)
      while (occupiedParseXs.has(candidateX)) {
        candidateX = snapToGrid(candidateX + stepX, depthLevel)
      }
      occupiedParseXs.add(candidateX)
      positioned.push({ ...pepNode, x: candidateX, y: snapToGrid(parseY, depthLevel) })
    })

  } else {
    // ── Legacy layout (no claims) ──

    // Tier 1 (y=0): Evidence + other non-parse, non-eval nodes
    const tier1 = children.filter(c =>
      c.isEvidence || c.category === 'evidence' ||
      (!c.isParse && c.category !== 'parse' && !c.isEvaluation && c.category !== 'evaluation' && !c.isClaim && c.category !== 'claim')
    )
    const tier1W = (tier1.length - 1) * stepX
    const tier1StartX = -tier1W / 2
    tier1.forEach((child, i) => {
      positioned.push({
        ...child,
        x: snapToGrid(tier1StartX + i * stepX, depthLevel),
        y: snapToGrid(0, depthLevel),
      })
    })

    // Tier 2: Parse below source evidence
    if (parses.length > 0) {
      const occupiedTier2Xs = new Set()
      parses.forEach(pepNode => {
        const sourceEvNode = positioned.find(p => p.id === pepNode.sourceEvidenceId)
        let preferredX = sourceEvNode ? snapToGrid(sourceEvNode.x, depthLevel) : snapToGrid(0, depthLevel)
        let candidateX = preferredX
        if (occupiedTier2Xs.has(candidateX)) {
          let offset = stepX
          while (true) {
            const rightX = snapToGrid(preferredX + offset, depthLevel)
            if (!occupiedTier2Xs.has(rightX)) { candidateX = rightX; break }
            const leftX = snapToGrid(preferredX - offset, depthLevel)
            if (!occupiedTier2Xs.has(leftX)) { candidateX = leftX; break }
            offset += stepX
          }
        }
        occupiedTier2Xs.add(candidateX)
        positioned.push({ ...pepNode, x: candidateX, y: snapToGrid(tierGap, depthLevel) })
      })
    }

    // Helper: check tier1 collision
    const collidesWithTier1 = (x) => positioned.some(p =>
      (p.isEvidence || p.category === 'evidence' || (!p.isParse && p.category !== 'parse' && !p.isEvaluation && p.category !== 'evaluation'))
      && Math.abs(p.x - x) < stepX * 0.5
    )

    // Tier 3: Superseded evals
    const evalY = parses.length > 0 ? tierGap * 2 : tierGap
    if (evalsSuperseded.length > 0) {
      const supW = (evalsSuperseded.length - 1) * stepX
      const supStartX = -supW / 2
      evalsSuperseded.forEach((supNode, i) => {
        let supX = snapToGrid(supStartX + i * stepX, depthLevel)
        if (collidesWithTier1(supX)) supX = snapToGrid(supX + stepX, depthLevel)
        positioned.push({ ...supNode, x: supX, y: snapToGrid(evalY, depthLevel) })
      })
    }

    // Tier 3/4: Active evals
    const activeEvalY = evalsSuperseded.length > 0 ? evalY + tierGap : evalY
    if (evalsActive.length > 0) {
      const tier3W = (evalsActive.length - 1) * stepX
      const tier3StartX = -tier3W / 2
      evalsActive.forEach((evalNode, i) => {
        let evalX = snapToGrid(tier3StartX + i * stepX, depthLevel)
        if (collidesWithTier1(evalX)) evalX = snapToGrid(evalX + stepX, depthLevel)
        positioned.push({ ...evalNode, x: evalX, y: snapToGrid(activeEvalY, depthLevel) })
      })
    }
  }

  return positioned
}

// FLIP animation: animate element from old rect to new rect
function flipAnimate(element, fromRect, toRect, duration = 350, finalScale = null) {
  if (!element || !fromRect || !toRect) return
  const dx = fromRect.left - toRect.left
  const dy = fromRect.top - toRect.top
  const sx = fromRect.width / (toRect.width || 1)
  const sy = fromRect.height / (toRect.height || 1)
  element.style.transition = 'none'
  element.style.transformOrigin = 'top left'
  element.style.transform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
  element.style.zIndex = '100'
  element.offsetHeight // force reflow
  element.style.transition = `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`
  element.style.transform = finalScale ? `scale(${finalScale})` : 'translate(0, 0) scale(1, 1)'
  setTimeout(() => {
    element.style.transition = ''
    // Don't clear transform — handleSurface step 5 sets the correct scale
    element.style.transformOrigin = ''
    element.style.zIndex = ''
  }, duration + 50)
}

const V2Canvas = forwardRef(function V2Canvas({
  nodes: rootNodes,
  edges: rootEdges,
  nodeMap: rootNodeMap,
  selectedId,
  onSelect,
  onCloseSel,
  onOpenSubgraph,
  isSubchain,
  subchainFocusId,
  onExitSubchain,
  modalOpen,
  panelWidth = 0,
  onLayerChange,
  // Phase 9A item 9: single-dispatch card-action handler for V2.2 nodes.
  // Forwarded into `<AssetNode>`; V2App routes action names to the same
  // handlers its Detail Panel footer uses.
  onV22CardAction,
  activeParty,
  revealAnim,
  selectedEdgeId = null,
  onEdgeClick,
  onEdgeHover,                // Phase 9B: ({ edgeId, sdaType, x, y }) | null
}, ref) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const overlayRef = useRef(null)

  // Three.js refs
  const rendererRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const edgeGroupRef = useRef(null)
  // Phase 11E.4 (#139 fix): separate group for reveal overlay edges so
  // they survive `buildEdges`'s `clearGroup(edgeGroupRef.current)` call.
  // The overlay group renders ON TOP of the canonical edge group during
  // the reveal window: a typed (final-style) edge draws in over the
  // dashed-grey provisional edge, the provisional fades during flip,
  // and the overlay is removed after the canonical edge re-renders
  // with typed style at reveal phase 'done'.
  const revealOverlayGroupRef = useRef(null)
  const gridGroupRef = useRef(null)
  const newEdgeAnimTimerRef = useRef(null)

  // Camera state
  const camPosRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(0.80)
  const [zoom, setZoom] = useState(0.80)
  const [threeReady, setThreeReady] = useState(false)
  const chainNodeIdsRef = useRef(null)
  const dirtyRef = useRef(true)
  const edgeAnimRef = useRef(null)
  const externalPanRef = useRef(false)

  // Pan state
  const draggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const camStartRef = useRef({ x: 0, y: 0 })
  const velocityRef = useRef({ x: 0, y: 0 })
  const lastMouseRef = useRef({ x: 0, y: 0, t: 0 })
  const momentumRef = useRef(null)
  const wasDragRef = useRef(false)

  // Transition state
  const transitioningRef = useRef(false)
  // Phase 9D.2.2 Fix 2: while the unravel primitive is running, the
  // selection-pan effect at line ~1586 must NOT fire — flipping the
  // _unraveling flag in V2App produces a new currentNodeMap reference,
  // which retriggers the selection effect mid-animation and double-pans
  // the camera. Set/cleared via setUnraveling on the imperative handle.
  const unravelingRef = useRef(false)
  const [transitioning, setTransitioning] = useState(false)
  const [diveTargetId, setDiveTargetId] = useState(null)
  const [unfurlSettle, setUnfurlSettle] = useState(false) // true = cards settling into place after dive
  const gridAnimRef = useRef(null)
  const streakAnimRef = useRef(null)

  // Layer stack
  const [layerStack, setLayerStack] = useState(() => [{
    parentNode: null,
    nodes: rootNodes.filter(n => n.x !== undefined && n.y !== undefined),
    edges: rootEdges,
    pan: { x: 0, y: 0 },
    zoom: 0.7,
    color: null,
    label: 'Root',
  }])

  // Sync root layer when prop data changes — always keep layerStack[0] current,
  // even when viewing child layers, so surfacing + re-diving sees updated children
  useEffect(() => {
    const filteredNodes = rootNodes.filter(n => n.x !== undefined && n.y !== undefined)
    setLayerStack(prev => {
      const root = prev[0]
      const updatedRoot = { ...root, nodes: filteredNodes, edges: rootEdges }
      if (prev.length === 1) return [updatedRoot]
      return [updatedRoot, ...prev.slice(1)]
    })
  }, [rootNodes, rootEdges])

  // Ref to read layerStack without creating a dependency cycle
  const layerStackRef = useRef(layerStack)
  useEffect(() => { layerStackRef.current = layerStack }, [layerStack])

  // Sync child layer when parent node's children change (e.g. after PEP parse or Add Evidence while diving)
  useEffect(() => {
    const stack = layerStackRef.current
    if (stack.length <= 1) return
    if (transitioningRef.current) return

    const childLayer = stack[stack.length - 1]
    const parentNode = childLayer.parentNode
    if (!parentNode) return

    const latestParent = rootNodeMap[parentNode.id]
    if (!latestParent || !latestParent.children) return

    const currentChildCount = childLayer.nodes.filter(n => !n._isAnchor).length
    const latestChildCount = latestParent.children.length

    // Also check if reference edges changed (claim evidence additions don't change child count)
    const latestRefEdgeCount = latestParent.children
      .filter(c => c.isClaim || c.category === 'claim')
      .reduce((sum, c) => sum + (c.referencedEvidenceIds?.length || 0), 0)
    const currentRefEdgeCount = childLayer.nodes
      .filter(n => !n._isAnchor && (n.isClaim || n.category === 'claim'))
      .reduce((sum, n) => sum + (n.referencedEvidenceIds?.length || 0), 0)

    if (latestChildCount === currentChildCount && latestRefEdgeCount === currentRefEdgeCount) return

    const targetDepth = stack.length - 1
    const childrenWithPos = layoutChildren(latestParent.children, targetDepth)
    const childSpacing = BASE_GRID_SPACING * Math.pow(GRID_SPACING_MULT, targetDepth)
    const ANCHOR_GAP = Math.round(200 / childSpacing) * childSpacing
    const childRowY = childrenWithPos.length > 0 ? childrenWithPos[0].y : 0
    const anchorY = snapToGrid(childRowY - ANCHOR_GAP, targetDepth)
    const anchorNode = { ...latestParent, _isAnchor: true, x: 0, y: anchorY }
    const allNodes = [anchorNode, ...childrenWithPos]

    const childEdges = []
    const hasClaims = childrenWithPos.some(c => c.isClaim || c.category === 'claim')

    if (hasClaims) {
      childrenWithPos.filter(c => c.isClaim || c.category === 'claim').forEach(claim => {
        childEdges.push({ id: `edge-anchor-${claim.id}`, from: anchorNode.id, to: claim.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isEvidence || c.category === 'evidence').forEach(ev => {
        childEdges.push({ id: `edge-anchor-${ev.id}`, from: anchorNode.id, to: ev.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isParse || c.category === 'parse').forEach(pepChild => {
        childEdges.push({ id: `edge-${pepChild.sourceEvidenceId}-${pepChild.id}`, from: pepChild.sourceEvidenceId, to: pepChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status !== 'superseded').forEach(evalChild => {
        const predecessor = childrenWithPos.find(s =>
          (s.isEvaluation || s.category === 'evaluation') && s.status === 'superseded' && evalChild.previousEvalId === s.id
        )
        const parentId = predecessor ? predecessor.id : (evalChild.claimId || anchorNode.id)
        childEdges.push({ id: `edge-eval-${evalChild.id}`, from: parentId, to: evalChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status === 'superseded').forEach(supChild => {
        const parentId = supChild.claimId || anchorNode.id
        childEdges.push({ id: `edge-sup-${supChild.id}`, from: parentId, to: supChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isClaim || c.category === 'claim').forEach(claim => {
        if (claim.referencedEvidenceIds && claim.referencedEvidenceIds.length > 0) {
          claim.referencedEvidenceIds.forEach(evId => {
            const evNode = childrenWithPos.find(p => p.id === evId)
            if (evNode) {
              childEdges.push({ id: `edge-ref-${claim.id}-${evId}`, from: claim.id, to: evId, sdaType: 'full', _reference: true })
            }
          })
        }
      })
    } else {
      childrenWithPos.filter(c => c.category !== 'parse' && !c.isParse && !c.isEvaluation && c.category !== 'evaluation').forEach(child => {
        childEdges.push({ id: `edge-anchor-${child.id}`, from: anchorNode.id, to: child.id, sdaType: child.sda?.type || 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isParse || c.category === 'parse').forEach(pepChild => {
        childEdges.push({ id: `edge-${pepChild.sourceEvidenceId}-${pepChild.id}`, from: pepChild.sourceEvidenceId, to: pepChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status === 'superseded').forEach(supChild => {
        childEdges.push({ id: `edge-anchor-sup-${supChild.id}`, from: anchorNode.id, to: supChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status !== 'superseded').forEach(evalChild => {
        const predecessor = childrenWithPos.find(s => (s.isEvaluation || s.category === 'evaluation') && s.status === 'superseded' && evalChild.previousEvalId === s.id)
        childEdges.push({ id: `edge-eval-${evalChild.id}`, from: predecessor ? predecessor.id : anchorNode.id, to: evalChild.id, sdaType: 'full', _vertical: true })
      })
    }

    setLayerStack(prev => {
      if (prev.length <= 1) return prev  // safety: don't update if we've already surfaced
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        parentNode: latestParent,
        nodes: allNodes,
        edges: childEdges,
      }
      return updated
    })

    requestAnimationFrame(() => {
      dirtyRef.current = true
    })
  }, [rootNodeMap])

  const currentLayer = layerStack[layerStack.length - 1]
  const depth = layerStack.length - 1

  // Build node map for current layer
  const currentNodeMap = useMemo(() => {
    const map = {}
    currentLayer.nodes.forEach(n => { map[n.id] = n })
    return map
  }, [currentLayer.nodes])

  // Compute supply chain for selected node — ancestors + descendants, not full component
  // Edges are directed: from=parent, to=child. Walk up (ancestors) and down (descendants).
  const chainNodeIds = useMemo(() => {
    if (!selectedId) return null
    if (!currentNodeMap[selectedId]) return null
    const edgeList = currentLayer.edges
    // Build directed adjacency: parent→children and child→parents
    const childrenOf = {}  // parent id → [child ids]
    const parentsOf = {}   // child id → [parent ids]
    edgeList.forEach(e => {
      if (!childrenOf[e.from]) childrenOf[e.from] = []
      childrenOf[e.from].push(e.to)
      if (!parentsOf[e.to]) parentsOf[e.to] = []
      parentsOf[e.to].push(e.from)
    })
    const visited = new Set()
    visited.add(selectedId)
    // Walk ancestors (upstream)
    const upQueue = [selectedId]
    while (upQueue.length > 0) {
      const cur = upQueue.shift()
      for (const parent of (parentsOf[cur] || [])) {
        if (!visited.has(parent)) {
          visited.add(parent)
          upQueue.push(parent)
        }
      }
    }
    // Walk descendants (downstream)
    const downQueue = [selectedId]
    while (downQueue.length > 0) {
      const cur = downQueue.shift()
      for (const child of (childrenOf[cur] || [])) {
        if (!visited.has(child)) {
          visited.add(child)
          downQueue.push(child)
        }
      }
    }
    return visited
  }, [selectedId, currentLayer.edges, currentNodeMap])
  useEffect(() => { chainNodeIdsRef.current = chainNodeIds }, [chainNodeIds])

  // Node positions for overlay (screen coords)
  const [screenPositions, setScreenPositions] = useState([])

  // Data bounds for current layer
  const bounds = useMemo(() => {
    const nodes = currentLayer.nodes
    if (nodes.length === 0) return { minX: -400, maxX: 400, minY: -300, maxY: 300 }
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodes.forEach(n => {
      if (n.x === undefined) return
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })
    const pad = 200
    return { minX: minX - pad, maxX: maxX + pad, minY: minY - pad, maxY: maxY + pad }
  }, [currentLayer.nodes])

  // Persistent layer tint background color — resolved to hex in JS
  const layerBgColor = useMemo(() => {
    // Subchain mode — subtle warm-grey tint
    if (isSubchain) {
      const isDark = document.documentElement.dataset.theme !== 'light'
      return isDark ? '#10131a' : '#dbd7d0'
    }
    if (depth === 0 || !currentLayer.color) return null
    const resolved = parseCSSColor(currentLayer.color)
    if (!resolved) return null
    const isDark = document.documentElement.dataset.theme !== 'light'
    const bg = new THREE.Color(isDark ? 0x0a0c10 : 0xe4e0da)
    const mix = isDark ? 0.004 : 0.04
    const tinted = new THREE.Color(
      bg.r * (1 - mix) + resolved.r * mix,
      bg.g * (1 - mix) + resolved.g * mix,
      bg.b * (1 - mix) + resolved.b * mix,
    )
    return '#' + tinted.getHexString()
  }, [depth, currentLayer.color, isSubchain])

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

  // Project world coords to screen
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
    const nodes = currentLayer.nodes
    const positions = nodes
      .filter(n => n.x !== undefined && n.y !== undefined)
      .map(n => {
        const sp = worldToScreen(n.x, n.y)
        return { id: n.id, x: sp.x, y: sp.y }
      })
    setScreenPositions(positions)
  }, [currentLayer.nodes, worldToScreen])

  const updateOverlayRef = useRef(updateOverlay)
  useEffect(() => { updateOverlayRef.current = updateOverlay }, [updateOverlay])

  // ===== EDGE MANAGEMENT =====
  const clearGroup = useCallback((group) => {
    if (!group) return
    while (group.children.length > 0) {
      const child = group.children[0]
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
      group.remove(child)
    }
  }, [])

  // Build edges using Line2 (fat lines with pixel-width control)
  // When lodMode is true, edges connect to node center (dot position) instead of card edges
  const buildEdges = useCallback((group, edgeList, nodeMapForEdges, targetOpacity, scaleFactor = 1.0, lodMode = false) => {
    clearGroup(group)

    const renderer = rendererRef.current
    const container = containerRef.current
    const resX = container ? container.clientWidth : window.innerWidth
    const resY = container ? container.clientHeight : window.innerHeight

    // Half-dimensions in world coords (cards are centered at node position)
    const halfW = CARD_W / 2
    const halfH = CARD_H / 2

    edgeList.forEach(edge => {
      const fromNode = nodeMapForEdges[edge.from]
      const toNode = nodeMapForEdges[edge.to]
      if (!fromNode || !toNode || fromNode.x === undefined || toNode.x === undefined) return

      let x1, y1, x2, y2
      if (lodMode) {
        // LOD mode: connect to node center (both horizontal and vertical)
        x1 = fromNode.x; y1 = fromNode.y
        x2 = toNode.x; y2 = toNode.y
      } else if (edge._vertical) {
        // Vertical edge (card mode): bottom-center of parent → top-center of child
        x1 = fromNode.x
        y1 = fromNode.y + halfH
        x2 = toNode.x
        y2 = toNode.y - halfH
      } else {
        // Card mode: exit/enter from the side facing the other node
        const dx = toNode.x - fromNode.x
        if (dx >= 0) {
          // to is to the right: exit from right-center, enter from left-center
          x1 = fromNode.x + halfW; y1 = fromNode.y
          x2 = toNode.x - halfW;   y2 = toNode.y
        } else {
          // to is to the left: exit from left-center, enter from right-center
          x1 = fromNode.x - halfW; y1 = fromNode.y
          x2 = toNode.x + halfW;   y2 = toNode.y
        }
      }

      // Apply scale factor (centered on midpoint for edge scale animation)
      let fx, fy, tx, ty
      if (scaleFactor !== 1.0) {
        const mx = (x1 + x2) / 2
        const my = (y1 + y2) / 2
        fx = mx + (x1 - mx) * scaleFactor
        fy = my + (y1 - my) * scaleFactor
        tx = mx + (x2 - mx) * scaleFactor
        ty = my + (y2 - my) * scaleFactor
      } else {
        fx = x1; fy = y1; tx = x2; ty = y2
      }

      // Negate Y for Three.js (Y-up)
      const p0 = new THREE.Vector3(fx, -fy, 0)
      const p3 = new THREE.Vector3(tx, -ty, 0)

      let p1, p2
      if (edge._vertical) {
        // Vertical control points for smooth downward curve
        const cpy = (fy + ty) / 2
        p1 = new THREE.Vector3(fx, -cpy, 0)
        p2 = new THREE.Vector3(tx, -cpy, 0)
      } else {
        // Horizontal control points for smooth curve
        // Use 40% of horizontal distance as control arm length, with a minimum
        // to prevent degenerate curves when nodes are nearly vertically aligned
        const hDist = Math.abs(tx - fx)
        const vDist = Math.abs(ty - fy)
        const armLength = Math.max(hDist * 0.4, Math.min(60, vDist * 0.25))

        // Control points extend horizontally from each endpoint
        // Direction matches the edge flow (outward from source, inward to target)
        const dirX = tx >= fx ? 1 : -1
        p1 = new THREE.Vector3(fx + armLength * dirX, -fy, 0)
        p2 = new THREE.Vector3(tx - armLength * dirX, -ty, 0)
      }

      const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3)

      // Adaptive vertex count: fewer points for gentle curves, more for tight ones
      const cdx = Math.abs(tx - fx)
      const cdy = Math.abs(ty - fy)
      const curvature = cdy / (cdx || 1)
      const pointCount = curvature < 0.3 ? 12 : curvature < 1.0 ? 20 : 32
      const curvePoints = curve.getPoints(pointCount)

      // Per-edge SDA type styling
      const effectiveSdaType = edge._showAsProvisional ? 'provisional' : edge.sdaType
      const sdaCfg = SDA_EDGE_CONFIG[effectiveSdaType] || SDA_EDGE_CONFIG.full
      const isNewEdge = !!edge._isNew
      const isSelectedEdge = !!edge._isSelected
      // Phase 9D.2.1 Fix 1: revoked-state edge styling. Red + dimmed; keeps
      // the dash pattern (so a Selective revoked edge still reads as
      // selective). Wins over isNewEdge / isSelectedEdge color treatment
      // since a revoked agreement is terminal — no point lerping toward
      // white. Width preserved at the SDA's base.
      const isRevokedEdge = !!edge.isRevoked
      // Selected edge treatment per spec §4.4 (tuned from spec's 40%/+0.5px to
      // 65%/+1.5px after visual testing showed the spec's values were invisible
      // on dashed/dotted edges).
      const baseWidth = SDA_EDGE_WIDTH[effectiveSdaType] || 2.0
      // Phase 9A item 3 / Phase 9A.1 item 6: internal edges (grantor party
      // === grantee party) de-emphasised with 50% of the default stroke
      // (was 0.7, but imperceptible at base widths of ~2-2.5px). Selected
      // and NEW edges keep full emphasis regardless.
      const isInternalEdge = edge.grantorParty && edge.granteeParty
        && edge.grantorParty === edge.granteeParty
      const internalFactor = (isInternalEdge && !isSelectedEdge && !isNewEdge) ? 0.5 : 1.0
      const edgeColor = isRevokedEdge
        // Phase 9D.2.1 Fix 1: revoked → resolved CSS var --accent-red.
        // Read once at module scope would require theme-change handling;
        // hardcode the dark-theme value matching var(--accent-red) so we
        // don't tangle with theme.
        ? new THREE.Color('#ef4444')
        : isNewEdge
          ? new THREE.Color(sdaCfg.color).lerp(new THREE.Color('#ffffff'), 0.4)
          : isSelectedEdge
            ? new THREE.Color(sdaCfg.color).lerp(new THREE.Color('#ffffff'), 0.65)
            : new THREE.Color(sdaCfg.color)
      const lineWidth = isNewEdge
        ? 3.0
        : (isSelectedEdge ? baseWidth + 1.5 : baseWidth * internalFactor)
      // Phase 9D.2.1 Fix 1: target opacity for revoked edges. Multiplies
      // into the existing chain-opacity logic at the material-creation
      // site below.
      const revokedOpacityFactor = isRevokedEdge ? 0.5 : 1.0

      // Flatten curve points for LineGeometry
      const positions = []
      curvePoints.forEach(p => positions.push(p.x, p.y, p.z))

      const geometry = new LineGeometry()
      geometry.setPositions(positions)

      let isDashed = sdaCfg.dash > 0
      let dashSize = sdaCfg.dash
      let gapSize = sdaCfg.gap
      let material
      // Phase 9D.2.1 Fix 1: revoked edges always go through the transparent-
      // material path (regardless of dashed-ness) so the 0.5 opacity
      // multiplier reads. Solid revoked edges get re-flagged transparent
      // and lose the premixColor optimization — acceptable tradeoff for the
      // small number of revoked edges that may exist at any time.
      if (isDashed || isRevokedEdge) {
        // Dashed lines: need transparent for gaps. Revoked: ditto for dim.
        material = new LineMaterial({
          color: edgeColor,
          linewidth: lineWidth,
          opacity: targetOpacity * revokedOpacityFactor,
          transparent: true,
          depthWrite: false,
          resolution: new THREE.Vector2(resX, resY),
          dashed: isDashed,
          dashSize,
          gapSize,
          dashScale: 1,
        })
      } else {
        // Solid lines: fully opaque with pre-mixed color to avoid joint artifacts
        const mixedColor = premixColor(sdaCfg.color, targetOpacity)
        material = new LineMaterial({
          color: mixedColor,
          linewidth: lineWidth,
          opacity: 1.0,
          transparent: false,
          depthWrite: false,
          resolution: new THREE.Vector2(resX, resY),
          dashed: false,
        })
      }
      material.userData = { isSolid: !isDashed }

      const line = new Line2(geometry, material)
      if (isDashed) line.computeLineDistances()
      // Store edge metadata for hover lookup
      line.userData = {
        edgeId: edge.id,
        sdaType: edge.sdaType || 'full',
        from: edge.from,
        to: edge.to,
        discloser: edge.discloser || null,
        cascadePolicy: edge.cascadePolicy || null,
        redacted: edge.redacted || null,
        _isNew: !!edge._isNew,
        _createdAt: edge._createdAt || null,
        // Phase 9A.1 item 7: flag stored on userData so the select/deselect
        // effect at the bottom of this component can restore the 0.5× factor
        // on deselection.
        isInternal: !!isInternalEdge,
        // Phase 9D.2.2 Fix 1: revoked-state flag carried onto userData so
        // applyEdgeStylingRef can preserve the red+dimmed treatment when
        // restyling on selection / hover / zoom changes. Without this the
        // restyle re-reads color from SDA_EDGE_CONFIG and overwrites the
        // red set in this same buildEdges call.
        isRevoked: !!edge.isRevoked,
        // Phase 11E.9 Fix 2: same precedent — carry the provisional-stamp
        // flag onto userData so applyEdgeStylingRef can collapse
        // effectiveSdaType to 'provisional' on restyle. Pre-fix the
        // restyle pass read line.userData.sdaType (the typed sdaType set
        // unconditionally above) and overwrote the dashed-grey provisional
        // treatment with the typed color whenever any of its triggers
        // fired (selectedEdgeId / hoveredEdge / currentLayer.edges /
        // zoom). The initial `buildEdges` already collapses the rendered
        // sdaCfg via `effectiveSdaType` (line ~871), so the bug only
        // manifested after the first restyle.
        showAsProvisional: !!edge._showAsProvisional,
      }
      group.add(line)
    })

    dirtyRef.current = true
  }, [clearGroup])

  const fadeEdgesIn = useCallback((group, target, duration, delay, chainSet) => {
    if (!group) return
    group.children.forEach(c => {
      if (c.material.userData?.isSolid) c.material.transparent = true
      c.material.opacity = 0
    })
    dirtyRef.current = true

    setTimeout(() => {
      let startTime = null
      const tick = (time) => {
        if (!startTime) startTime = time
        const progress = Math.min(1, (time - startTime) / duration)
        group.children.forEach(c => {
          // Determine per-edge target opacity based on chain membership
          const inChain = !chainSet || (chainSet.has(c.userData?.from) && chainSet.has(c.userData?.to))
          const edgeTarget = inChain
            ? (c.material.userData?.isSolid ? 1.0 : target)
            : 0.12
          c.material.opacity = progress * edgeTarget
        })
        dirtyRef.current = true
        if (progress < 1) {
          requestAnimationFrame(tick)
        } else {
          // Restore opaque state for in-chain solid lines
          group.children.forEach(c => {
            const inChain = !chainSet || (chainSet.has(c.userData?.from) && chainSet.has(c.userData?.to))
            if (c.material.userData?.isSolid && inChain) {
              c.material.transparent = false
              c.material.opacity = 1.0
            }
          })
          dirtyRef.current = true
        }
      }
      requestAnimationFrame(tick)
    }, delay)
  }, [])

  const fadeEdgesOut = useCallback((group, duration) => {
    if (!group || group.children.length === 0) return
    // Enable transparency on solid lines for the fade animation
    group.children.forEach(c => {
      if (c.material.userData?.isSolid) c.material.transparent = true
    })
    const startOpacities = group.children.map(c => c.material.opacity)
    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const progress = Math.min(1, (time - startTime) / duration)
      group.children.forEach((c, i) => { c.material.opacity = startOpacities[i] * (1 - progress) })
      dirtyRef.current = true
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // Edge draw animation: progressively reveal edges by increasing instanceCount
  const animateEdgeDraw = useCallback((group, duration = 400, staggerTotal = 200) => {
    if (!group || group.children.length === 0) return
    const lines = group.children.filter(c => c.geometry?.instanceCount !== undefined)
    if (lines.length === 0) return

    // Store full instance counts and zero them out
    const fullCounts = lines.map(l => l.geometry.instanceCount)
    lines.forEach(l => { l.geometry.instanceCount = 0 })
    // Ensure visible
    lines.forEach(l => {
      if (l.material.userData?.isSolid) l.material.transparent = false
      l.material.opacity = l.material.userData?.isSolid ? 1.0 : 0.5
    })
    dirtyRef.current = true

    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime

      lines.forEach((l, i) => {
        const staggerDelay = lines.length > 1 ? (i / (lines.length - 1)) * staggerTotal : 0
        const lineElapsed = Math.max(0, elapsed - staggerDelay)
        const p = Math.min(1, lineElapsed / duration)
        const ease = 1 - Math.pow(1 - p, 2) // ease-out quad
        l.geometry.instanceCount = Math.round(ease * fullCounts[i])
      })
      dirtyRef.current = true

      const allDone = lines.every((l, i) => l.geometry.instanceCount >= fullCounts[i])
      if (!allDone) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  const animateNewEdges = useCallback(() => {
    const group = edgeGroupRef.current
    if (!group) return
    const newLines = group.children.filter(c =>
      c.userData?._isNew && c.geometry?.instanceCount !== undefined
    )
    if (newLines.length === 0) return
    const fullCounts = newLines.map(l => l.geometry.instanceCount)
    newLines.forEach(l => { l.geometry.instanceCount = 0 })
    dirtyRef.current = true
    let startTime = null
    const duration = 800
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - t, 2)
      newLines.forEach((l, i) => {
        l.geometry.instanceCount = Math.round(ease * fullCounts[i])
      })
      dirtyRef.current = true
      if (t < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [])

  // Edge scale animation: rebuild edges with changing scale factor
  const animateEdgeScale = useCallback((group, edgeList, nodeMapForEdges, fromScale, toScale, opacity, duration) => {
    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const p = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - p, 3) // ease-out cubic
      const scale = fromScale + (toScale - fromScale) * ease
      buildEdges(group, edgeList, nodeMapForEdges, opacity, scale)
      if (p < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [buildEdges])

  // ===== DOT GRID =====
  // Build dot grid with specific params
  const buildGridWithParams = useCallback((spacing, opacity, radius) => {
    const group = gridGroupRef.current
    if (!group) return
    clearGroup(group)

    const isDark = document.documentElement.dataset.theme !== 'light'
    const gridColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const gridPoints = []
    const gridStart = -Math.ceil(GRID_RANGE / spacing) * spacing
    for (let gx = gridStart; gx <= GRID_RANGE; gx += spacing) {
      for (let gy = gridStart; gy <= GRID_RANGE; gy += spacing) {
        gridPoints.push(new THREE.Vector3(gx, gy, -1))
      }
    }
    if (gridPoints.length > 0) {
      const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints)
      const gridMaterial = new THREE.PointsMaterial({
        color: gridColor, size: radius * 2, sizeAttenuation: false,
        opacity, transparent: true,
      })
      group.add(new THREE.Points(gridGeometry, gridMaterial))
    }
    dirtyRef.current = true
  }, [clearGroup])

  // Build grid for a specific depth
  const buildGrid = useCallback((depthLevel = 0) => {
    const { spacing, opacity, radius } = getGridParams(depthLevel)
    buildGridWithParams(spacing, opacity, radius)
  }, [buildGridWithParams])

  // Animate dot grid between two depth levels (simple ease-out)
  const animateGrid = useCallback((fromDepth, toDepth, duration) => {
    if (gridAnimRef.current) cancelAnimationFrame(gridAnimRef.current)
    const from = getGridParams(fromDepth)
    const to = getGridParams(toDepth)
    let startTime = null

    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const p = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - p, 3)
      const spacing = from.spacing + (to.spacing - from.spacing) * ease
      const opacity = from.opacity + (to.opacity - from.opacity) * ease
      const radius = from.radius + (to.radius - from.radius) * ease
      buildGridWithParams(spacing, opacity, radius)
      if (p < 1) {
        gridAnimRef.current = requestAnimationFrame(tick)
      } else {
        gridAnimRef.current = null
      }
    }
    gridAnimRef.current = requestAnimationFrame(tick)
  }, [buildGridWithParams])

  // Enhanced dot grid dive: overshoot spacing + size/opacity pulse
  const animateDotGridDive = useCallback((fromDepth, toDepth, duration) => {
    if (gridAnimRef.current) cancelAnimationFrame(gridAnimRef.current)
    const from = getGridParams(fromDepth)
    const to = getGridParams(toDepth)
    let startTime = null

    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(1, elapsed / duration)

      // Overshoot curve for spacing (goes 15% past target then settles)
      const overshootEase = t < 0.5
        ? 2 * t * t * 1.15
        : 1 - Math.pow(-2 * t + 2, 2) / 2 * (1 / 1.15)
      const clampedEase = Math.min(overshootEase, 1.05)
      const spacing = from.spacing + (to.spacing - from.spacing) * clampedEase

      // Size pulse: grow to 1.6x in first 30%, shrink back over remaining 70%
      const sizePulse = t < 0.3
        ? 1.0 + (t / 0.3) * 0.6
        : 1.6 - ((t - 0.3) / 0.7) * 0.6

      // Opacity pulse: brighten 50% in first 25%, settle back
      const opacityPulse = t < 0.25
        ? 1.0 + (t / 0.25) * 0.5
        : 1.5 - ((t - 0.25) / 0.75) * 0.5

      const targetOpacity = from.opacity + (to.opacity - from.opacity) * Math.min(t * 1.5, 1)
      const targetRadius = from.radius + (to.radius - from.radius) * Math.min(t * 1.5, 1)
      buildGridWithParams(spacing, targetOpacity * opacityPulse, targetRadius * sizePulse)

      if (t < 1) {
        gridAnimRef.current = requestAnimationFrame(tick)
      } else {
        gridAnimRef.current = null
      }
    }
    gridAnimRef.current = requestAnimationFrame(tick)
  }, [buildGridWithParams])

  // Enhanced dot grid surface: inward contraction with size/opacity pulse
  const animateDotGridSurface = useCallback((fromDepth, toDepth, duration) => {
    if (gridAnimRef.current) cancelAnimationFrame(gridAnimRef.current)
    const from = getGridParams(fromDepth)
    const to = getGridParams(toDepth)
    let startTime = null

    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(1, elapsed / duration)

      // Ease-out cubic with slight undershoot
      const ease = 1 - Math.pow(1 - t, 3)
      const spacing = from.spacing + (to.spacing - from.spacing) * ease

      // Gentle size pulse on surface (smaller effect)
      const sizePulse = t < 0.2
        ? 1.0 + (t / 0.2) * 0.3
        : 1.3 - ((t - 0.2) / 0.8) * 0.3

      const targetOpacity = from.opacity + (to.opacity - from.opacity) * ease
      const targetRadius = from.radius + (to.radius - from.radius) * ease
      buildGridWithParams(spacing, targetOpacity * sizePulse, targetRadius * sizePulse)

      if (t < 1) {
        gridAnimRef.current = requestAnimationFrame(tick)
      } else {
        gridAnimRef.current = null
      }
    }
    gridAnimRef.current = requestAnimationFrame(tick)
  }, [buildGridWithParams])

  // Update Three.js clear color to match layer tint
  const updateClearColor = useCallback((depthLevel, catColor) => {
    const renderer = rendererRef.current
    if (!renderer) return
    if (depthLevel === 0 || !catColor) {
      renderer.setClearColor(0x000000, 0)
      return
    }
    // Resolve CSS variable to a computed color, then mix with background in JS
    const resolved = parseCSSColor(catColor)
    if (!resolved) return
    const isDark = document.documentElement.dataset.theme !== 'light'
    const bg = new THREE.Color(isDark ? 0x0a0c10 : 0xe4e0da)
    const mix = isDark ? 0.004 : 0.04
    const tinted = new THREE.Color(
      bg.r * (1 - mix) + resolved.r * mix,
      bg.g * (1 - mix) + resolved.g * mix,
      bg.b * (1 - mix) + resolved.b * mix,
    )
    renderer.setClearColor(tinted, 1)
    dirtyRef.current = true
  }, [])

  // ===== LIGHTSPEED DOT STREAKS =====

  // Animate dot grid into radial line streaks (warp effect)
  // inward=false: dive (streaks radiate outward), inward=true: surface (streaks converge inward)
  const animateDotStreaks = useCallback((duration, inward = false) => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const gridGroup = gridGroupRef.current
    if (!scene || !camera || !gridGroup || gridGroup.children.length === 0) return

    // Cancel any previous streak animation + clean up leftover streak geometry (tagged)
    if (streakAnimRef.current) {
      cancelAnimationFrame(streakAnimRef.current)
      streakAnimRef.current = null
    }
    const leftover = []
    scene.traverse(obj => { if (obj.userData?._isStreak) leftover.push(obj) })
    leftover.forEach(obj => { scene.remove(obj); obj.geometry?.dispose(); obj.material?.dispose() })

    // Get current dot positions from the grid Points object
    const dotPoints = gridGroup.children[0]
    if (!dotPoints || !dotPoints.geometry) return

    const dotPositions = dotPoints.geometry.attributes.position.array.slice()
    const dotCount = dotPositions.length / 3
    const centerX = camera.position.x
    const centerY = camera.position.y
    const savedDotOpacity = dotPoints.material.opacity

    // Create streak LineSegments geometry (2 vertices per dot)
    const streakArray = new Float32Array(dotCount * 6)
    const streakGeo = new THREE.BufferGeometry()
    streakGeo.setAttribute('position', new THREE.Float32BufferAttribute(streakArray, 3))

    const isDark = document.documentElement.dataset.theme !== 'light'
    const streakColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const maxOpacity = isDark ? 0.25 : 0.18

    const streakMat = new THREE.LineBasicMaterial({
      color: streakColor,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    })

    const streakLines = new THREE.LineSegments(streakGeo, streakMat)
    streakLines.position.z = -0.5 // just above the grid dots
    streakLines.userData._isStreak = true
    scene.add(streakLines)

    // Dim dots rather than hiding them — keeps spatial context
    dotPoints.material.opacity = savedDotOpacity * 0.3

    const frustumW = camera.right - camera.left
    const maxLength = frustumW * 0.06

    const start = performance.now()

    const tick = () => {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / duration)

      // Smooth ease-out cubic for streak growth
      const ease = 1 - Math.pow(1 - t, 3)
      const currentLength = maxLength * ease

      // Opacity: gentle fade in over first 25%, hold, long fade out over last 45%
      let opacity
      if (t < 0.25) {
        opacity = (t / 0.25) * maxOpacity
      } else if (t < 0.55) {
        opacity = maxOpacity
      } else {
        opacity = maxOpacity * (1 - (t - 0.55) / 0.45)
      }
      streakMat.opacity = opacity

      // Restore dot opacity gradually in the last 40%
      if (t > 0.6) {
        const restore = (t - 0.6) / 0.4
        dotPoints.material.opacity = savedDotOpacity * (0.3 + 0.7 * restore)
      }

      // Update streak positions
      const positions = streakGeo.attributes.position.array
      for (let i = 0; i < dotCount; i++) {
        const x = dotPositions[i * 3]
        const y = dotPositions[i * 3 + 1]
        const z = dotPositions[i * 3 + 2]

        const dx = x - centerX
        const dy = y - centerY
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        const nx = dx / len
        const ny = dy / len

        if (inward) {
          // Surface: streak points inward toward dot position
          positions[i * 6 + 0] = x + nx * currentLength
          positions[i * 6 + 1] = y + ny * currentLength
          positions[i * 6 + 2] = z
          positions[i * 6 + 3] = x
          positions[i * 6 + 4] = y
          positions[i * 6 + 5] = z
        } else {
          // Dive: gentle tail behind dot, head extends outward
          positions[i * 6 + 0] = x - nx * currentLength * 0.15
          positions[i * 6 + 1] = y - ny * currentLength * 0.15
          positions[i * 6 + 2] = z
          positions[i * 6 + 3] = x + nx * currentLength
          positions[i * 6 + 4] = y + ny * currentLength
          positions[i * 6 + 5] = z
        }
      }
      streakGeo.attributes.position.needsUpdate = true
      dirtyRef.current = true

      if (t < 1) {
        streakAnimRef.current = requestAnimationFrame(tick)
      } else {
        // Cleanup: remove streaks, restore dots fully
        scene.remove(streakLines)
        streakGeo.dispose()
        streakMat.dispose()
        dotPoints.material.opacity = savedDotOpacity
        dotPoints.visible = true
        dirtyRef.current = true
        streakAnimRef.current = null
      }
    }
    streakAnimRef.current = requestAnimationFrame(tick)
  }, [])

  // Animate dot grid into horizontal line streaks (lateral slide for subchain transitions)
  const animateLateralStreaks = useCallback((duration, direction = 'enter') => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    const gridGroup = gridGroupRef.current
    if (!scene || !camera || !gridGroup || gridGroup.children.length === 0) return

    if (streakAnimRef.current) {
      cancelAnimationFrame(streakAnimRef.current)
      streakAnimRef.current = null
    }
    const leftover = []
    scene.traverse(obj => { if (obj.userData?._isStreak) leftover.push(obj) })
    leftover.forEach(obj => { scene.remove(obj); obj.geometry?.dispose(); obj.material?.dispose() })

    const dotPoints = gridGroup.children[0]
    if (!dotPoints || !dotPoints.geometry) return

    const dotPositions = dotPoints.geometry.attributes.position.array.slice()
    const dotCount = dotPositions.length / 3
    const savedDotOpacity = dotPoints.material.opacity

    const streakArray = new Float32Array(dotCount * 6)
    const streakGeo = new THREE.BufferGeometry()
    streakGeo.setAttribute('position', new THREE.Float32BufferAttribute(streakArray, 3))

    const isDark = document.documentElement.dataset.theme !== 'light'
    const streakColor = isDark ? new THREE.Color(0xffffff) : new THREE.Color(0x000000)
    const maxOpacity = isDark ? 0.35 : 0.25

    const streakMat = new THREE.LineBasicMaterial({
      color: streakColor, transparent: true, opacity: 0, depthWrite: false,
    })

    const streakLines = new THREE.LineSegments(streakGeo, streakMat)
    streakLines.position.z = -0.5
    streakLines.userData._isStreak = true
    scene.add(streakLines)

    dotPoints.material.opacity = savedDotOpacity * 0.3

    const frustumW = camera.right - camera.left
    const maxLength = frustumW * 0.10
    const sign = direction === 'enter' ? 1 : -1

    const start = performance.now()
    const tick = () => {
      const elapsed = performance.now() - start
      const t = Math.min(1, elapsed / duration)
      const ease = 1 - Math.pow(1 - t, 3)
      const currentLength = maxLength * ease

      let opacity
      if (t < 0.25) opacity = (t / 0.25) * maxOpacity
      else if (t < 0.55) opacity = maxOpacity
      else opacity = maxOpacity * (1 - (t - 0.55) / 0.45)
      streakMat.opacity = opacity

      if (t > 0.6) {
        const restore = (t - 0.6) / 0.4
        dotPoints.material.opacity = savedDotOpacity * (0.3 + 0.7 * restore)
      }

      const positions = streakGeo.attributes.position.array
      for (let i = 0; i < dotCount; i++) {
        const x = dotPositions[i * 3]
        const y = dotPositions[i * 3 + 1]
        const z = dotPositions[i * 3 + 2]
        positions[i * 6 + 0] = x
        positions[i * 6 + 1] = y
        positions[i * 6 + 2] = z
        positions[i * 6 + 3] = x + currentLength * sign
        positions[i * 6 + 4] = y
        positions[i * 6 + 5] = z
      }
      streakGeo.attributes.position.needsUpdate = true
      dirtyRef.current = true

      if (t < 1) {
        streakAnimRef.current = requestAnimationFrame(tick)
      } else {
        scene.remove(streakLines)
        streakGeo.dispose()
        streakMat.dispose()
        dotPoints.material.opacity = savedDotOpacity
        dotPoints.visible = true
        dirtyRef.current = true
        streakAnimRef.current = null
      }
    }
    streakAnimRef.current = requestAnimationFrame(tick)
  }, [])

  // Fit camera to a node list
  // Pure computation: returns { centerX, centerY, zoom } for framing a set of nodes
  const computeFitCamera = useCallback((nodeList) => {
    const container = containerRef.current
    if (!container || nodeList.length === 0) return null
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    nodeList.forEach(n => {
      if (n.x === undefined) return
      if (n.x < minX) minX = n.x
      if (n.x > maxX) maxX = n.x
      if (n.y < minY) minY = n.y
      if (n.y > maxY) maxY = n.y
    })
    const pad = 200
    const dataW = (maxX - minX) + pad * 2
    const dataH = (maxY - minY) + pad * 2
    const w = container.clientWidth
    const h = container.clientHeight
    const fitZoom = Math.min(w / dataW, h / dataH) * 0.85
    const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, fitZoom))
    return { centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2, zoom: clampedZoom }
  }, [])

  const fitToNodes = useCallback((nodeList) => {
    const fit = computeFitCamera(nodeList)
    if (!fit) return
    camPosRef.current = { x: fit.centerX, y: fit.centerY }
    zoomRef.current = fit.zoom
    setZoom(fit.zoom)
    updateCamera()
  }, [computeFitCamera, updateCamera])

  // ===== PAN-TO-NODE ANIMATION =====
  const panAnimRef = useRef(null)

  const panToNode = useCallback((worldX, worldY, duration = 400) => {
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
    const startX = camPosRef.current.x
    const startY = camPosRef.current.y
    const dx = worldX - startX
    const dy = worldY - startY
    // Skip if already centered (within 5 world units)
    if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return
    let startTime = null
    const tick = (time) => {
      if (!startTime) startTime = time
      const elapsed = time - startTime
      const t = Math.min(1, elapsed / duration)
      // Ease-in-out quad
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
      const clamped = clampPan(startX + dx * ease, startY + dy * ease)
      camPosRef.current = clamped
      updateCamera()
      if (t < 1) {
        panAnimRef.current = requestAnimationFrame(tick)
      } else {
        panAnimRef.current = null
      }
    }
    panAnimRef.current = requestAnimationFrame(tick)
  }, [clampPan, updateCamera])

  const animatedPanToWithZoom = useCallback((worldX, worldY, targetZoom, duration = 500) => {
    if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
    externalPanRef.current = true
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
        startY + (worldY - startY) * ease
      )
      camPosRef.current = clamped
      zoomRef.current = startZoom + (targetZoom - startZoom) * ease
      setZoom(zoomRef.current)
      updateCamera()
      if (t < 1) {
        panAnimRef.current = requestAnimationFrame(tick)
      } else {
        panAnimRef.current = null
        externalPanRef.current = false
      }
    }
    panAnimRef.current = requestAnimationFrame(tick)
  }, [clampPan, updateCamera])

  // Pan to selected node when selection changes
  // Offset upward by ~10% of visible viewport height (in world units)
  // Offset left to compensate for Detail Panel width
  useEffect(() => {
    if (!selectedId || transitioningRef.current) return
    if (externalPanRef.current) return
    // Phase 9D.2.2 Fix 2: skip during unravel. The primitive sets the
    // _unraveling flag on the target node, which propagates a new
    // currentNodeMap → retriggers this effect mid-animation. Without
    // this guard the camera double-pans during the edge retract.
    if (unravelingRef.current) return
    const node = currentNodeMap[selectedId]
    if (!node || node.x === undefined) return
    const container = containerRef.current
    if (!container) { panToNode(node.x, node.y); return }
    const z = zoomRef.current || 1
    const viewportOffsetY = (container.clientHeight * 0.10) / z
    const horizontalOffsetX = panelWidth > 0 ? (180 / z) : 0
    panToNode(node.x + horizontalOffsetX, node.y + viewportOffsetY)
  }, [selectedId, currentNodeMap, panToNode, panelWidth])

  // ===== DIVE (View Transitions API + WebGL environmental effects) =====

  const handleDive = useCallback((node) => {
    if (transitioningRef.current) return
    if (!node.children || node.children.length === 0) return

    transitioningRef.current = true
    setTransitioning(true)
    setDiveTargetId(node.id)
    onCloseSel?.()

    const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product
    const currentDepth = layerStack.length - 1
    const targetDepth = currentDepth + 1

    // Save current pan/zoom into current layer (sync, before transition)
    setLayerStack(prev => {
      const updated = [...prev]
      updated[updated.length - 1] = {
        ...updated[updated.length - 1],
        pan: { ...camPosRef.current },
        zoom: zoomRef.current,
      }
      return updated
    })

    // Prepare new layer data before starting the transition
    const childrenWithPos = layoutChildren(node.children)

    // Prepend anchor card (parent node) above the children row, snapped to grid
    const childSpacing = BASE_GRID_SPACING * Math.pow(GRID_SPACING_MULT, targetDepth)
    const ANCHOR_GAP = Math.round(200 / childSpacing) * childSpacing
    const childRowY = childrenWithPos.length > 0 ? childrenWithPos[0].y : 0
    const anchorY = snapToGrid(childRowY - ANCHOR_GAP, targetDepth)
    const anchorNode = { ...node, _isAnchor: true, x: 0, y: anchorY }
    const allNodes = [anchorNode, ...childrenWithPos]

    // Create edges: claims-aware or legacy
    const childEdges = []
    const hasClaims = childrenWithPos.some(c => c.isClaim || c.category === 'claim')

    if (hasClaims) {
      childrenWithPos.filter(c => c.isClaim || c.category === 'claim').forEach(claim => {
        childEdges.push({ id: `edge-anchor-${claim.id}`, from: anchorNode.id, to: claim.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isEvidence || c.category === 'evidence').forEach(ev => {
        childEdges.push({ id: `edge-anchor-${ev.id}`, from: anchorNode.id, to: ev.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isParse || c.category === 'parse').forEach(pepChild => {
        childEdges.push({ id: `edge-${pepChild.sourceEvidenceId}-${pepChild.id}`, from: pepChild.sourceEvidenceId, to: pepChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status !== 'superseded').forEach(evalChild => {
        const predecessor = childrenWithPos.find(s =>
          (s.isEvaluation || s.category === 'evaluation') && s.status === 'superseded' && evalChild.previousEvalId === s.id
        )
        const parentId = predecessor ? predecessor.id : (evalChild.claimId || anchorNode.id)
        childEdges.push({ id: `edge-eval-${evalChild.id}`, from: parentId, to: evalChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status === 'superseded').forEach(supChild => {
        const parentId = supChild.claimId || anchorNode.id
        childEdges.push({ id: `edge-sup-${supChild.id}`, from: parentId, to: supChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isClaim || c.category === 'claim').forEach(claim => {
        if (claim.referencedEvidenceIds && claim.referencedEvidenceIds.length > 0) {
          claim.referencedEvidenceIds.forEach(evId => {
            const evNode = childrenWithPos.find(p => p.id === evId)
            if (evNode) {
              childEdges.push({ id: `edge-ref-${claim.id}-${evId}`, from: claim.id, to: evId, sdaType: 'full', _reference: true })
            }
          })
        }
      })
    } else {
      childrenWithPos.filter(c => c.category !== 'parse' && !c.isParse && !c.isEvaluation && c.category !== 'evaluation').forEach(child => {
        childEdges.push({ id: `edge-anchor-${child.id}`, from: anchorNode.id, to: child.id, sdaType: child.sda?.type || 'full', _vertical: true })
      })
      childrenWithPos.filter(c => c.isParse || c.category === 'parse').forEach(pepChild => {
        childEdges.push({ id: `edge-${pepChild.sourceEvidenceId}-${pepChild.id}`, from: pepChild.sourceEvidenceId, to: pepChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status === 'superseded').forEach(supChild => {
        childEdges.push({ id: `edge-anchor-sup-${supChild.id}`, from: anchorNode.id, to: supChild.id, sdaType: 'full', _vertical: true })
      })
      childrenWithPos.filter(c => (c.isEvaluation || c.category === 'evaluation') && c.status !== 'superseded').forEach(evalChild => {
        const predecessor = childrenWithPos.find(s => (s.isEvaluation || s.category === 'evaluation') && s.status === 'superseded' && evalChild.previousEvalId === s.id)
        childEdges.push({ id: `edge-eval-${evalChild.id}`, from: predecessor ? predecessor.id : anchorNode.id, to: evalChild.id, sdaType: 'full', _vertical: true })
      })
    }

    // Compute final camera state BEFORE the transition so React renders
    // child cards at correct screen positions during the snapshot
    const fit = computeFitCamera(allNodes)
    const fitZoom = fit ? fit.zoom : 0.7
    const fitCenterX = fit ? fit.centerX : 0
    const fitCenterY = fit ? fit.centerY : 0

    const newLayer = {
      parentNode: node,
      nodes: allNodes,
      edges: childEdges,
      pan: { x: fitCenterX, y: fitCenterY },
      zoom: fitZoom,
      color: cat.color,
      label: node.name,
    }

    // Pre-compute child screen positions using pure math — no camera mutation.
    // This avoids a rendering glitch where the browser could capture a frame
    // with the camera briefly at the child position, causing a "bounce" during dive.
    const canvas = rendererRef.current?.domElement
    const vpW = canvas ? canvas.clientWidth : window.innerWidth
    const vpH = canvas ? canvas.clientHeight : window.innerHeight
    // Replicate orthographic camera projection math from updateCamera + worldToScreen:
    // camera frustum halfW = (vpW / zoom) * 0.5, camera.position = (camX, -camY, 100)
    // ndc.x = (worldX - camX) / halfW, ndc.y = (-worldY + camY) / halfH
    // screen.x = (ndc.x * 0.5 + 0.5) * vpW, screen.y = (-ndc.y * 0.5 + 0.5) * vpH
    const halfW = (vpW / fitZoom) * 0.5
    const halfH = (vpH / fitZoom) * 0.5
    const childPositions = allNodes
      .filter(n => n.x !== undefined && n.y !== undefined)
      .map(n => {
        const ndcX = (n.x - fitCenterX) / halfW
        const ndcY = (-n.y + fitCenterY) / halfH
        return {
          id: n.id,
          x: (ndcX * 0.5 + 0.5) * vpW,
          y: (-ndcY * 0.5 + 0.5) * vpH,
        }
      })

    if (!document.startViewTransition) {
      // Fallback: instant swap
      camPosRef.current = { x: fitCenterX, y: fitCenterY }
      zoomRef.current = fitZoom
      updateCamera()
      clearGroup(edgeGroupRef.current)
      flushSync(() => {
        setLayerStack(prev => [...prev, newLayer])
        setZoom(fitZoom)
        setScreenPositions(childPositions)
      })
      updateClearColor(targetDepth, cat.color)
      requestAnimationFrame(() => {
        const nMap = {}
        allNodes.forEach(n => { nMap[n.id] = n })
        buildEdges(edgeGroupRef.current, childEdges, nMap, 0.5)
        animateEdgeDraw(edgeGroupRef.current, 350, 150)
        buildGrid(targetDepth)
        transitioningRef.current = false
        setTransitioning(false)
        requestAnimationFrame(() => setUnfurlSettle(true))
      })
      return
    }

    // Set direction and background for CSS targeting
    document.documentElement.dataset.vtDirection = 'dive'
    setViewTransitionBg()

    // Old snapshot captured here — edges + cards at current parent camera position
    const transition = document.startViewTransition(() => {
      // Move camera to child position for the new snapshot
      camPosRef.current = { x: fitCenterX, y: fitCenterY }
      zoomRef.current = fitZoom
      updateCamera()
      clearGroup(edgeGroupRef.current)

      flushSync(() => {
        setLayerStack(prev => [...prev, newLayer])
        setZoom(fitZoom)
        setScreenPositions(childPositions)
      })
      updateClearColor(targetDepth, cat.color)
    })

    transition.ready.then(() => {
      const nMap = {}
      allNodes.forEach(n => { nMap[n.id] = n })
      buildEdges(edgeGroupRef.current, childEdges, nMap, 0.5)
      // Draw lines progressively from anchor to children
      animateEdgeDraw(edgeGroupRef.current, 350, 150)
      // Lightspeed streaks: dots become radial lines shooting outward
      animateDotStreaks(600, false)
    })

    transition.finished.then(() => {
      delete document.documentElement.dataset.vtDirection
      transitioningRef.current = false
      setTransitioning(false)
      buildGrid(targetDepth)
      // Fade in child cards after edges have drawn
      requestAnimationFrame(() => setUnfurlSettle(true))
    }).catch(() => {
      delete document.documentElement.dataset.vtDirection
      transitioningRef.current = false
      setTransitioning(false)
      buildGrid(targetDepth)
    })
  }, [layerStack, updateCamera, computeFitCamera, clearGroup, buildEdges, animateEdgeDraw, fadeEdgesIn, updateClearColor, worldToScreen, animateDotStreaks, onCloseSel, buildGrid])

  // ===== SURFACE (View Transitions API + WebGL environmental effects) =====
  const handleSurface = useCallback(() => {
    if (transitioningRef.current) return
    if (layerStack.length <= 1) return

    transitioningRef.current = true
    setTransitioning(true)
    setDiveTargetId(null)  // Clear immediately — only needed during dive, not surface

    // Clear any stale selection from the child layer — prevents ghost tooltips
    onCloseSel?.()

    const parentLayer = layerStack[layerStack.length - 2]
    const currentDepth = layerStack.length - 1
    const targetDepth = currentDepth - 1
    const diveParentNode = currentLayer.parentNode

    // Pre-compute parent screen positions: temporarily set camera to parent position,
    // compute positions, then restore so old snapshot captures current child state
    const savedCam = { ...camPosRef.current }
    const savedZoom = zoomRef.current
    const parentCam = (diveParentNode && diveParentNode.x !== undefined)
      ? { x: diveParentNode.x, y: diveParentNode.y }
      : { ...parentLayer.pan }
    camPosRef.current = parentCam
    zoomRef.current = parentLayer.zoom
    updateCamera()

    const parentPositions = parentLayer.nodes
      .filter(n => n.x !== undefined && n.y !== undefined)
      .map(n => {
        const sp = worldToScreen(n.x, n.y)
        return { id: n.id, x: sp.x, y: sp.y }
      })

    // Restore camera to child position — old snapshot captures child edges + cards
    camPosRef.current = savedCam
    zoomRef.current = savedZoom
    updateCamera()

    // Pre-compute chain set for the selected node so edges fade in with correct dimming
    const surfaceChainSet = (() => {
      if (!diveParentNode) return null
      const selId = diveParentNode.id
      const childrenOf = {}
      const parentsOf = {}
      parentLayer.edges.forEach(e => {
        if (!childrenOf[e.from]) childrenOf[e.from] = []
        childrenOf[e.from].push(e.to)
        if (!parentsOf[e.to]) parentsOf[e.to] = []
        parentsOf[e.to].push(e.from)
      })
      const visited = new Set([selId])
      const up = [selId]
      while (up.length) { const c = up.shift(); for (const p of (parentsOf[c] || [])) if (!visited.has(p)) { visited.add(p); up.push(p) } }
      const down = [selId]
      while (down.length) { const c = down.shift(); for (const ch of (childrenOf[c] || [])) if (!visited.has(ch)) { visited.add(ch); down.push(ch) } }
      return visited
    })()

    const buildParentEdges = () => {
      const nMap = {}
      parentLayer.nodes.forEach(n => { nMap[n.id] = n })
      buildEdges(edgeGroupRef.current, parentLayer.edges, nMap, 0.5)
      fadeEdgesIn(edgeGroupRef.current, 0.5, 250, 100, surfaceChainSet)
    }

    if (!document.startViewTransition) {
      // Fallback: instant swap
      camPosRef.current = parentCam
      zoomRef.current = parentLayer.zoom
      updateCamera()
      clearGroup(edgeGroupRef.current)
      flushSync(() => {
        setLayerStack(prev => prev.length <= 1 ? prev : prev.slice(0, -1))
        setZoom(parentLayer.zoom)
        setScreenPositions(parentPositions)
        if (diveParentNode) onSelect?.(diveParentNode)
      })
      updateClearColor(targetDepth, parentLayer.color)
      requestAnimationFrame(() => {
        buildParentEdges()
        buildGrid(targetDepth)
        transitioningRef.current = false
        setTransitioning(false)
        setDiveTargetId(null)
        setUnfurlSettle(false)
      })
      return
    }

    // Direct surface animation with FLIP card morph

    // 1. Record anchor card position + fade out other child cards
    const anchorCardId = diveParentNode?.id
    const anchorEl = anchorCardId ? overlayRef.current?.querySelector(`[data-card-id="${anchorCardId}"]`) : null
    const fromRect = anchorEl?.getBoundingClientRect()

    const allCards = overlayRef.current?.querySelectorAll('[data-card-id]') || []
    allCards.forEach(card => {
      if (card.dataset.cardId !== anchorCardId) {
        card.style.transition = 'opacity 150ms ease-out'
        card.style.opacity = '0'
      }
    })

    // 2. Start inward streaks
    animateDotStreaks(500, true)

    // 3. After fade + streaks underway, swap state
    setTimeout(() => {
      camPosRef.current = parentCam
      zoomRef.current = parentLayer.zoom
      updateCamera()
      clearGroup(edgeGroupRef.current)

      flushSync(() => {
        setLayerStack(prev => prev.length <= 1 ? prev : prev.slice(0, -1))
        setZoom(parentLayer.zoom)
        setScreenPositions(parentPositions)
        if (diveParentNode) onSelect?.(diveParentNode)
      })

      updateClearColor(targetDepth, parentLayer.color)
      buildParentEdges()

      // 4. FLIP animate anchor card from child to parent position
      requestAnimationFrame(() => {
        const newAnchorEl = anchorCardId ? overlayRef.current?.querySelector(`[data-card-id="${anchorCardId}"]`) : null
        const toRect = newAnchorEl?.getBoundingClientRect()
        // Fade in anchor card (replaces FLIP animation)
        if (newAnchorEl) {
          newAnchorEl.style.transition = 'none'
          newAnchorEl.style.opacity = '0'
          newAnchorEl.offsetHeight
          newAnchorEl.style.transition = 'opacity 250ms ease-out'
          newAnchorEl.style.opacity = '1'
        }

        // Fade in other parent cards — respect chain dimming
        const newCards = overlayRef.current?.querySelectorAll('[data-card-id]') || []
        newCards.forEach(card => {
          if (card.dataset.cardId !== anchorCardId) {
            const cardId = card.dataset.cardId
            const inChain = !chainNodeIds || chainNodeIds.has(cardId)
            const targetOpacity = inChain ? '1' : '0.35'
            card.style.transition = 'none'
            card.style.opacity = '0'
            card.offsetHeight
            card.style.transition = 'opacity 300ms ease-out 100ms'
            card.style.opacity = targetOpacity
          }
        })
      })
    }, 200)

    // 5. Finish
    setTimeout(() => {
      delete document.documentElement.dataset.vtDirection
      buildGrid(targetDepth)
      transitioningRef.current = false
      setTransitioning(false)
      setDiveTargetId(null)
      setUnfurlSettle(false)
      // Re-apply correct styles using refs (avoids stale closure)
      requestAnimationFrame(() => {
        const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
        if (cards) {
          const chain = chainNodeIdsRef.current
          const z = zoomRef.current
          cards.forEach(card => {
            card.style.viewTransitionName = ''
            card.style.transition = 'none'
          })
          overlayRef.current?.offsetHeight
          cards.forEach(card => {
            card.style.transform = `scale(${z})`
            const cardId = card.getAttribute('data-card-id')
            const inChain = !chain || chain.has(cardId)
            card.style.opacity = inChain ? '1' : '0.35'
          })
          requestAnimationFrame(() => {
            cards.forEach(card => { card.style.transition = 'opacity 200ms ease' })
            dirtyRef.current = true
          })
        }
      })
    }, 600)
  }, [layerStack, currentLayer.parentNode, updateCamera, clearGroup, buildEdges, fadeEdgesIn, updateClearColor, worldToScreen, onSelect, animateDotStreaks, buildGrid])

  // Expose actions for Detail Panel footer
  useImperativeHandle(ref, () => ({
    dive: (node) => handleDive(node),
    surface: () => handleSurface(),
    playWarpStreaks: (inward) => animateDotStreaks(600, inward),
    playLateralStreaks: (direction) => animateLateralStreaks(800, direction),
    fitAll: () => {
      const layer = layerStackRef.current[layerStackRef.current.length - 1]
      if (layer?.nodes) {
        fitToNodes(layer.nodes)
        if (zoomRef.current < 0.68) {
          zoomRef.current = 0.68
          setZoom(0.68)
          updateCamera()
        }
      }
    },
    panTo: (x, y) => {
      camPosRef.current = { x, y }
      updateCamera()
      dirtyRef.current = true
    },
    panToWithZoom: (x, y, z) => {
      camPosRef.current = { x, y }
      zoomRef.current = z
      setZoom(z)
      updateCamera()
      dirtyRef.current = true
    },
    animatedPanToWithZoom: (x, y, z, duration) => animatedPanToWithZoom(x, y, z, duration),
    // Phase 9D.2.2 Fix 2: tells V2Canvas's selection-pan effect to suspend
    // during the unravel sequence. The primitive sets `true` before any
    // pan/zoom or edge-retract work, sets `false` in a finally block when
    // the entire chain settles. Without this, flipping the _unraveling
    // flag (which propagates a new currentNodeMap) causes the selection
    // effect to fire mid-animation and double-pan the camera.
    setUnraveling: (flag) => {
      unravelingRef.current = !!flag
    },
    // Phase 9D.2: lookups + edge-retract animation for the unravel primitive.
    // getNodeWorldPos resolves a nodeId to its world-space (x,y) on the
    // current layer; null if not found or coords are non-finite (e.g.
    // pseudo Radiant Network actor).
    getNodeWorldPos: (nodeId) => {
      const layer = layerStackRef.current[layerStackRef.current.length - 1]
      const n = layer?.nodes?.find((nn) => nn.id === nodeId)
      if (!n) return null
      if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return null
      return { x: n.x, y: n.y }
    },
    // Compare current camera focus to a world point. Returns true when
    // the camera is centered on (x, y) within `tolPx` screen pixels at
    // the current zoom AND the zoom is in a "reasonable" range so the
    // user can actually see the target node. Used by playUnravelAnimation
    // to skip the pan step when already focused.
    isFocusedOnPoint: (x, y, tolPx = 60) => {
      const cam = camPosRef.current
      if (!cam) return false
      const z = zoomRef.current || 1
      const dxPx = (x - cam.x) * z
      const dyPx = (y - cam.y) * z
      // "Reasonable zoom": don't skip the pan if we're zoomed way out (the
      // target would be a tiny dot the user can't see).
      const zoomOk = z >= 0.6
      return zoomOk && Math.hypot(dxPx, dyPx) <= tolPx
    },
    // Phase 9D.2.1 Fix 2: panel-aware visibility check. Returns true when
    // the node's current screen position falls within the visible canvas
    // area, accounting for an open Detail Panel reducing the usable width.
    // Used by playUnravelAnimation to skip Stage 0 when the user already
    // has the node in view — avoids jittery pan/zoom when the panel-click
    // already centered the canvas. `padding` reserves a margin near each
    // edge so we don't claim "visible" when the node is half-clipped.
    isNodeVisibleInViewport: (nodeId, opts = {}) => {
      const { panelWidthPx = 0, padding = 40 } = opts
      const layer = layerStackRef.current[layerStackRef.current.length - 1]
      const n = layer?.nodes?.find((nn) => nn.id === nodeId)
      if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y)) return false
      const container = containerRef.current
      if (!container) return false
      const sp = worldToScreen(n.x, n.y)
      const w = container.clientWidth
      const h = container.clientHeight
      // Detail Panel sits on the right (zIndex 200, width 480 by V2App).
      // Visible area is x ∈ [padding, w - panelWidthPx - padding].
      const minX = padding
      const maxX = w - panelWidthPx - padding
      const minY = padding
      const maxY = h - padding
      // Sanity: the camera also needs to be at a "reasonable" zoom — if
      // the user has zoomed way out so the node is a tiny dot, treat it
      // as "not visible enough" so the unravel pans + zooms in.
      const z = zoomRef.current || 1
      if (z < 0.6) return false
      return sp.x >= minX && sp.x <= maxX && sp.y >= minY && sp.y <= maxY
    },
    // Edge retract animation. For each Line2 in the edge group whose
    // userData.from === nodeId or userData.to === nodeId, walk the line's
    // terminus back along its existing curve toward the OPPOSITE endpoint.
    // Implementation: per-frame, slice the original curve points and
    // re-emit a shorter prefix/suffix via setPositions — the curve shape
    // stays put; only its length progressively shortens from one end.
    // Phase 9D.2.3 Fix 1: switched from per-point lerp (which curled the
    // line) to point trimming (which preserves curvature, walks the
    // terminus along the path).
    // ease-out cubic. Returns a Promise that resolves when the animation
    // is complete (after `durationMs`). Resolves immediately when no
    // edges connect to the target node.
    playEdgeRetract: (nodeId, durationMs = 400) => {
      const group = edgeGroupRef.current
      if (!group || !nodeId) return Promise.resolve()
      const targets = []
      for (const line of group.children) {
        if (!line?.userData) continue
        const isFrom = line.userData.from === nodeId
        const isTo = line.userData.to === nodeId
        if (!isFrom && !isTo) continue
        // Capture the current geometry so per-frame interpolation has a
        // stable starting point.
        const arr = line.geometry?.attributes?.instanceStart?.array
            || line.geometry?.attributes?.position?.array
        // LineGeometry stores positions on instanceStart/End buffers.
        // Easiest path: pull the original positions array from setPositions
        // — V2Canvas's buildEdges uses geometry.setPositions(positions),
        // so we can replay a flattened copy. Read from the line's
        // computed start positions when available.
        // Safer: walk the points via the attribute we know exists.
        // For LineSegments2 / Line2, the curve points were flattened to
        // [x0,y0,z0,x1,y1,z1,…]. We capture them from instanceStart pairs.
        if (!arr) continue
        // Reconstruct flat positions [x,y,z,...] from the buffered pairs.
        // Each instanceStart entry is one segment start; the last segment's
        // end isn't in instanceStart, but we can reconstruct by using
        // (start, end) pairs from instanceStart + instanceEnd.
        const startArr = line.geometry?.attributes?.instanceStart?.array
        const endArr = line.geometry?.attributes?.instanceEnd?.array
        if (!startArr || !endArr) continue
        const segCount = startArr.length / 3
        const flat = new Array((segCount + 1) * 3)
        for (let i = 0; i < segCount; i++) {
          flat[i * 3] = startArr[i * 3]
          flat[i * 3 + 1] = startArr[i * 3 + 1]
          flat[i * 3 + 2] = startArr[i * 3 + 2]
        }
        // Append the last segment's end to close out the curve.
        flat[segCount * 3] = endArr[(segCount - 1) * 3]
        flat[segCount * 3 + 1] = endArr[(segCount - 1) * 3 + 1]
        flat[segCount * 3 + 2] = endArr[(segCount - 1) * 3 + 2]
        targets.push({
          line,
          original: flat,
          // retractFromStart === true means the FROM end is the target node;
          // we collapse curve points toward the END (last position).
          retractFromStart: isFrom,
        })
      }
      if (targets.length === 0) return Promise.resolve()
      return new Promise((resolve) => {
        let startTime = null
        const tick = (time) => {
          if (!startTime) startTime = time
          const elapsed = time - startTime
          const t = Math.min(1, elapsed / durationMs)
          const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
          for (const tgt of targets) {
            const { line, original, retractFromStart } = tgt
            const ptCount = original.length / 3
            // Phase 9D.2.3 Fix 1: point-trim retract. Compute how many
            // points to keep from the anchor side; the rest are dropped.
            // Three.js needs at least 2 points for a valid line segment.
            const pointsToShow = Math.max(2, Math.ceil(ptCount * (1 - eased)))
            // retractFromStart === true → target endpoint is at index 0
            // (the FROM side). We keep points [ptCount - pointsToShow ..
            // ptCount - 1] (the anchor-side tail). Otherwise we keep
            // points [0 .. pointsToShow - 1] (the anchor-side head).
            const newPositions = new Array(pointsToShow * 3)
            for (let i = 0; i < pointsToShow; i++) {
              const sourceIdx = retractFromStart
                ? (ptCount - pointsToShow + i)
                : i
              newPositions[i * 3] = original[sourceIdx * 3]
              newPositions[i * 3 + 1] = original[sourceIdx * 3 + 1]
              newPositions[i * 3 + 2] = original[sourceIdx * 3 + 2]
            }
            try {
              line.geometry.setPositions(newPositions)
              if (line.material?.dashed) {
                line.computeLineDistances()
              }
            } catch {
              // setPositions can throw if geometry was disposed mid-anim
              // (e.g., layer change). Swallow and bail this target.
            }
            // Also fade material opacity at the tail of the animation so
            // the line doesn't end as a single bright pixel at the anchor.
            if (line.material) {
              const opacityFactor = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
              const baseOpacity = line.material.userData?.baseOpacity
                ?? (line.material.transparent ? line.material.opacity : 1)
              if (line.material.userData) {
                if (line.material.userData.baseOpacity == null) {
                  line.material.userData.baseOpacity = baseOpacity
                }
              }
              line.material.opacity = baseOpacity * opacityFactor
              line.material.transparent = true
            }
          }
          dirtyRef.current = true
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(tick)
      })
    },
    // Phase 11E.4 (#139 fix): two-edge reveal animation primitives.
    //
    // The reveal flow needs to render TWO edges between the requester's
    // anchor Asset and the now-active Claim during the animation window:
    //   1. The canonical (provisional-styled, dashed grey) edge stays in
    //      `edgeGroupRef.current` and fades out during the Claim card flip.
    //   2. A new typed-style overlay edge is added to
    //      `revealOverlayGroupRef.current`, drawing in from the anchor over
    //      the geometry curve. The overlay survives `buildEdges`'s
    //      `clearGroup` calls because it lives in a separate group.
    //
    // V2Canvas exposes four atomic methods for this orchestration; the
    // higher-level sequencing lives in `src/v2/animations/edgeDrawIn.js`'s
    // `playRevealEdgeAnimation` orchestrator (called from V2App's
    // startReveal). Pre-fix Phase 11E.3 mutated the canonical edge's
    // geometry directly — the visual result conflated the two edges and
    // never produced the "typed edge emerges from the provisional" effect
    // Andrew's spec called for.

    // Build a typed-style overlay edge (Line2) and add it to
    // revealOverlayGroupRef. Reuses buildEdges's curve-construction logic
    // inline so styling matches what `effectiveSdaType !== 'provisional'`
    // would produce in the canonical pipeline. Geometry is initialized
    // with the FULL bezier curve and `instanceCount` is then zeroed —
    // playEdgeDrawInById grows the line frame-by-frame by raising
    // instanceCount, mirroring `animateNewEdges`'s pattern. Pre-fix
    // (Phase 11E.4) used a 2-point stub seed + `setPositions` per frame,
    // but `LineGeometry` allocates its `instanceStart` / `instanceEnd`
    // InstancedBufferAttributes at the size of the initial position array
    // — subsequent setPositions calls with longer arrays exceeded the
    // allocation and threw silently, freezing the geometry at the stub.
    addRevealOverlayEdge: ({ edgeId, fromNodeId, toNodeId, sdaType }) => {
      const group = revealOverlayGroupRef.current
      if (!group || !edgeId || !fromNodeId || !toNodeId) return
      const layer = layerStackRef.current[layerStackRef.current.length - 1]
      const layerNodes = layer?.nodes
      if (!layerNodes) return
      const fromNode = layerNodes.find((n) => n.id === fromNodeId)
      const toNode = layerNodes.find((n) => n.id === toNodeId)
      if (!fromNode || !toNode) return
      if (!Number.isFinite(fromNode.x) || !Number.isFinite(toNode.x)) return
      // Already present? Don't double-add.
      if (group.children.some((c) => c.userData?.edgeId === edgeId)) return

      const halfW = CARD_W / 2
      const dx = toNode.x - fromNode.x
      let x1, y1, x2, y2
      if (dx >= 0) {
        x1 = fromNode.x + halfW; y1 = fromNode.y
        x2 = toNode.x - halfW;   y2 = toNode.y
      } else {
        x1 = fromNode.x - halfW; y1 = fromNode.y
        x2 = toNode.x + halfW;   y2 = toNode.y
      }
      const p0 = new THREE.Vector3(x1, -y1, 0)
      const p3 = new THREE.Vector3(x2, -y2, 0)
      const hDist = Math.abs(x2 - x1)
      const vDist = Math.abs(y2 - y1)
      const armLength = Math.max(hDist * 0.4, Math.min(60, vDist * 0.25))
      const dirX = x2 >= x1 ? 1 : -1
      const p1 = new THREE.Vector3(x1 + armLength * dirX, -y1, 0)
      const p2 = new THREE.Vector3(x2 - armLength * dirX, -y2, 0)
      const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3)
      const curvature = vDist / (hDist || 1)
      const pointCount = curvature < 0.3 ? 12 : curvature < 1.0 ? 20 : 32
      const curvePoints = curve.getPoints(pointCount)
      const fullPositions = []
      curvePoints.forEach((p) => fullPositions.push(p.x, p.y, p.z))

      const sdaCfg = SDA_EDGE_CONFIG[sdaType] || SDA_EDGE_CONFIG.full
      const isDashed = sdaCfg.dash > 0
      const lineWidth = SDA_EDGE_WIDTH[sdaType] || 2.0
      const container = containerRef.current
      const resX = container ? container.clientWidth : window.innerWidth
      const resY = container ? container.clientHeight : window.innerHeight

      const material = new LineMaterial({
        color: new THREE.Color(sdaCfg.color),
        linewidth: lineWidth,
        opacity: 1.0,
        transparent: true,
        depthWrite: false,
        resolution: new THREE.Vector2(resX, resY),
        dashed: isDashed,
        dashSize: sdaCfg.dash,
        gapSize: sdaCfg.gap,
        dashScale: 1,
      })
      material.userData = { isSolid: !isDashed, baseOpacity: 1.0 }

      // Phase 11E.5 Fix 1: initialize with the FULL bezier curve so
      // LineGeometry allocates its instanceStart / instanceEnd buffers
      // at full size. computeLineDistances() runs once at full geometry
      // (still required for dashed materials). Capture the resulting
      // segment count, then zero `instanceCount` so the line renders as
      // empty on its first frame; playEdgeDrawInById grows it back up
      // over the animation. Mirror of `animateNewEdges` (V2Canvas:1080).
      // Phase 11E.6 fix: derive segment count directly from curvePoints
      // rather than reading geometry.instanceCount post-setPositions.
      // LineGeometry.setPositions does NOT update `instanceCount` —
      // InstancedBufferGeometry's constructor leaves it at the default
      // `Infinity`, which silently broke the per-frame ramp in
      // playEdgeDrawInById (Math.round(0 * Infinity) = NaN; Math.round(t
      // > 0 * Infinity) = Infinity → no animated draw-in was visible).
      // For an N-point curve there are N-1 line segments, which is
      // exactly the value Three.js uses for rendering.
      const geometry = new LineGeometry()
      geometry.setPositions(fullPositions)
      const line = new Line2(geometry, material)
      if (isDashed) line.computeLineDistances()
      const fullInstanceCount = curvePoints.length - 1
      geometry.instanceCount = 0
      line.userData = {
        edgeId,
        sdaType,
        from: fromNodeId,
        to: toNodeId,
        // Snapshot of the full segment count for the per-frame
        // instanceCount ramp in playEdgeDrawInById.
        _fullInstanceCount: fullInstanceCount,
        _isRevealOverlay: true,
      }
      group.add(line)
      dirtyRef.current = true
    },

    // Animate a specific overlay edge's geometry from zero-length at the
    // FROM end to the full bezier curve over `durationMs` by raising
    // `geometry.instanceCount` per frame. Mirrors the existing
    // `animateNewEdges` pattern (V2Canvas:1080) so it stays within the
    // pre-allocated InstancedBufferAttribute buffer set at construction
    // time by addRevealOverlayEdge.
    //
    // Phase 11E.5 Fix 1: replaces the prior per-frame `setPositions`
    // mutation. LineGeometry's instanceStart / instanceEnd buffers are
    // sized at first setPositions; subsequent setPositions with a longer
    // array silently throws inside Three.js (caught and swallowed by
    // this method's try/catch in 11E.4), freezing the visible curve at
    // its initial 2-point stub. instanceCount manipulation is the
    // canonical pattern Three.js exposes for partial line rendering.
    playEdgeDrawInById: (edgeId, durationMs = 500) => {
      const group = revealOverlayGroupRef.current
      if (!group || !edgeId) return Promise.resolve()
      const line = group.children.find((c) => c.userData?.edgeId === edgeId)
      if (!line || !line.geometry) return Promise.resolve()
      const fullCount = line.userData?._fullInstanceCount
      if (typeof fullCount !== 'number' || fullCount <= 0) return Promise.resolve()
      return new Promise((resolve) => {
        let startTime = null
        const tick = (time) => {
          if (!startTime) startTime = time
          const elapsed = time - startTime
          const t = Math.min(1, elapsed / durationMs)
          const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
          if (line.geometry) {
            line.geometry.instanceCount = Math.round(eased * fullCount)
          }
          dirtyRef.current = true
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            // Snap to full count at completion to avoid rounding drift.
            if (line.geometry) line.geometry.instanceCount = fullCount
            resolve()
          }
        }
        requestAnimationFrame(tick)
      })
    },

    // Animate the material opacity of the canonical edge with
    // `userData.edgeId === edgeId` from its current opacity to `toOpacity`
    // over `durationMs`. Used to fade the dashed-grey provisional edge
    // out concurrent with the Claim card flip. Operates on
    // edgeGroupRef.current (canonical edges), NOT the overlay group.
    fadeEdgeOpacityById: (edgeId, toOpacity = 0, durationMs = 400) => {
      const group = edgeGroupRef.current
      if (!group || !edgeId) return Promise.resolve()
      const line = group.children.find((c) => c.userData?.edgeId === edgeId)
      if (!line || !line.material) return Promise.resolve()
      const fromOpacity = line.material.opacity
      // Capture base opacity if not already captured so a later restyle
      // doesn't over-write it. baseOpacity preserved here too.
      if (line.material.userData) {
        if (line.material.userData.baseOpacity == null) {
          line.material.userData.baseOpacity = fromOpacity
        }
      }
      line.material.transparent = true
      return new Promise((resolve) => {
        let startTime = null
        const tick = (time) => {
          if (!startTime) startTime = time
          const elapsed = time - startTime
          const t = Math.min(1, elapsed / durationMs)
          const eased = 1 - Math.pow(1 - t, 3)
          line.material.opacity = fromOpacity + (toOpacity - fromOpacity) * eased
          dirtyRef.current = true
          if (t < 1) {
            requestAnimationFrame(tick)
          } else {
            resolve()
          }
        }
        requestAnimationFrame(tick)
      })
    },

    // Remove the overlay edge with `userData.edgeId === edgeId` from
    // revealOverlayGroupRef. Caller is responsible for sequencing this
    // AFTER the canonical buildEdges has produced the typed edge (post
    // reveal phase 'done'), so visual continuity is preserved.
    removeRevealOverlayEdge: (edgeId) => {
      const group = revealOverlayGroupRef.current
      if (!group || !edgeId) return
      const idx = group.children.findIndex((c) => c.userData?.edgeId === edgeId)
      if (idx === -1) return
      const line = group.children[idx]
      group.remove(line)
      try { line.geometry?.dispose?.() } catch { /* noop */ }
      try { line.material?.dispose?.() } catch { /* noop */ }
      dirtyRef.current = true
    },
    // Phase 9B.1 §4: project world coords to VIEWPORT (fixed) coords so the
    // pinned edge tooltip can track its world-space anchor through pan/zoom.
    // `worldToScreen` alone returns canvas-local coords; add the container's
    // viewport rect so callers using `position: fixed` get correct numbers.
    projectToViewport: (worldX, worldY) => {
      const container = containerRef.current
      if (!container) return null
      const rect = container.getBoundingClientRect()
      const sp = worldToScreen(worldX, worldY)
      return { x: sp.x + rect.left, y: sp.y + rect.top }
    },
    animateNewEdges: () => animateNewEdges(),
    fadeOutCards: (duration = 180) => {
      const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
      if (!cards) return
      cards.forEach(card => {
        card.style.transition = `opacity ${duration}ms ease-out`
        card.style.opacity = '0'
      })
    },
    fadeInCards: (duration = 250) => {
      requestAnimationFrame(() => {
        const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
        if (!cards) return
        cards.forEach(card => {
          card.style.transition = 'none'
          card.style.opacity = '0'
          card.offsetHeight
          card.style.transition = `opacity ${duration}ms ease-out`
          card.style.opacity = '1'
        })
        setTimeout(() => {
          cards.forEach(card => { card.style.transition = ''; card.style.opacity = '' })
        }, duration + 50)
      })
    },
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
      // Shift camera right so party node appears on left, showing more of the network
      camPosRef.current = { x: camPosRef.current.x + 500, y: camPosRef.current.y }
      updateCamera()
      dirtyRef.current = true
    },
    playNetworkBuild: () => {
      const layer = layerStack[layerStack.length - 1]
      if (!layer?.nodes || !layer.edges) return

      const nodes = layer.nodes
      const edges = layer.edges
      const rootNode = nodes.find(n => n.category === 'party') || nodes[0]
      if (!rootNode) return

      // BFS distance from root
      const adj = {}
      edges.forEach(e => {
        if (!adj[e.from]) adj[e.from] = []
        if (!adj[e.to]) adj[e.to] = []
        adj[e.from].push(e.to)
        adj[e.to].push(e.from)
      })
      const distances = {}
      const queue = [rootNode.id]
      distances[rootNode.id] = 0
      while (queue.length > 0) {
        const cur = queue.shift()
        for (const neighbor of (adj[cur] || [])) {
          if (distances[neighbor] === undefined) {
            distances[neighbor] = distances[cur] + 1
            queue.push(neighbor)
          }
        }
      }
      const maxDist = Math.max(0, ...Object.values(distances))
      nodes.forEach(n => {
        if (distances[n.id] === undefined) distances[n.id] = maxDist + 1
      })

      const cards = overlayRef.current?.querySelectorAll('[data-card-id]')
      if (!cards || cards.length === 0) return

      // Ensure cards are hidden (prep should have done this, but safety check)
      cards.forEach(card => {
        card.style.transition = 'none'
        card.style.opacity = '0'
      })
      overlayRef.current?.offsetHeight

      // ── Timing ──
      const perLayerDelay = Math.min(180, 1200 / ((maxDist + 2) + 1))
      const phase1Start = 50

      // Shell overlays — appended to document.body so they're unaffected by card opacity
      const shells = []

      // ── PHASE 1: White-bordered shells fan out ──
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

      // ── PHASE 2: Edges draw in ──
      const phase2Start = phase1Start + (maxDist + 1) * perLayerDelay + 200
      setTimeout(() => {
        const nMap = {}
        layer.nodes.forEach(n => { nMap[n.id] = n })
        const lodMode = zoomRef.current < LOD_THRESHOLD
        buildEdges(edgeGroupRef.current, layer.edges, nMap, 0.5, 1.0, lodMode)
        animateEdgeDraw(edgeGroupRef.current, 500, 200)
      }, phase2Start)

      // ── PHASE 3: Fade out shells, fill cards with color ──
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

      // ── CLEANUP ──
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
  }), [handleDive, handleSurface, animateDotStreaks, animateLateralStreaks, fitToNodes, updateCamera, animatedPanToWithZoom, animateNewEdges, clearGroup, buildEdges, animateEdgeDraw, layerStack])

  // Report layer changes to parent
  useEffect(() => {
    const d = layerStack.length - 1
    const anchorId = d > 0 ? layerStack[d]?.parentNode?.id : null
    onLayerChange?.({ depth: d, anchorId })
  }, [layerStack, onLayerChange])

  // Keyboard: Escape to surface
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape' && !transitioningRef.current && !modalOpen && depth > 0) {
        handleSurface()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleSurface, modalOpen, depth])

  // Rebuild edges when layer/chain changes — synchronous so chain dimming works correctly
  useEffect(() => {
    if (!edgeGroupRef.current) return
    if (transitioningRef.current) return
    // Phase 9D.2.4: skip the rebuild while playUnravelAnimation is running.
    // The unravel primitive trims edge geometry per-frame via setPositions
    // (see playEdgeRetract in this file's imperative handle). React state
    // changes during the unravel — `setSel(null)` on entry, then the
    // `_unraveling` flag flip on the target node — produce new
    // `currentNodeMap` references, retriggering this effect mid-animation
    // and rebuilding full-length edges that overwrite the trimmed state.
    // The `unravelingRef` guard added in 9D.2.2 already protects the
    // selection-pan effect; same suppression applies here.
    //
    // Cleanup is automatic: when the unravel completes and
    // `setUnraveling(false)` fires, V2App's subsequent state mutation
    // updates `currentLayer.edges` to drop the dismissed artifact's edges.
    // The next render after the ref clears triggers exactly one rebuild
    // run, which uses the post-mutation edge list — so the now-removed
    // edges naturally don't reappear.
    if (unravelingRef.current) return
    const lodMode = zoomRef.current < LOD_THRESHOLD

    buildEdges(edgeGroupRef.current, currentLayer.edges, currentNodeMap, 0.5, 1.0, lodMode)

    // Cancel any pending new-edge draw animation from a previous rebuild
    const group = edgeGroupRef.current
    if (newEdgeAnimTimerRef.current) {
      clearTimeout(newEdgeAnimTimerRef.current)
      newEdgeAnimTimerRef.current = null
    }

    // Find recent _isNew edges that haven't been zeroed yet
    const now = Date.now()
    const newEdgeLines = group.children.filter(c =>
      c.userData?._isNew &&
      c.geometry?.instanceCount !== undefined &&
      c.userData._fullInstanceCount === undefined &&
      (!c.userData._createdAt || (now - c.userData._createdAt) < 3000)
    )
    if (newEdgeLines.length > 0) {
      newEdgeLines.forEach(l => {
        l.userData._fullInstanceCount = l.geometry.instanceCount
        l.geometry.instanceCount = 0
      })
    }

    // If any lines have a pending animation, schedule the draw
    const pendingLines = group.children.filter(c => c.userData?._fullInstanceCount !== undefined)
    if (pendingLines.length > 0) {
      newEdgeAnimTimerRef.current = setTimeout(() => {
        newEdgeAnimTimerRef.current = null
        const currentGroup = edgeGroupRef.current
        if (!currentGroup) return
        const linesToAnimate = currentGroup.children.filter(c =>
          c.userData?._fullInstanceCount !== undefined &&
          c.geometry?.instanceCount !== undefined
        )
        if (linesToAnimate.length === 0) return
        let startTime = null
        const dur = 800
        const tick = (time) => {
          if (!startTime) startTime = time
          const t = Math.min(1, (time - startTime) / dur)
          const ease = 1 - Math.pow(1 - t, 2)
          let anyIncomplete = false
          linesToAnimate.forEach(l => {
            if (!l.geometry || l.geometry.instanceCount === undefined) return
            const target = l.userData._fullInstanceCount
            l.geometry.instanceCount = Math.round(ease * target)
            if (l.geometry.instanceCount < target) anyIncomplete = true
          })
          dirtyRef.current = true
          if (anyIncomplete && t < 1) {
            requestAnimationFrame(tick)
          } else {
            linesToAnimate.forEach(l => { delete l.userData._fullInstanceCount })
          }
        }
        requestAnimationFrame(tick)
      }, 50)
    }

    // Re-apply chain dimming after edge build
    if (chainNodeIds) {
      group.children.forEach(line => {
        const mat = line.material
        if (!mat) return
        const inChain = chainNodeIds.has(line.userData.from) && chainNodeIds.has(line.userData.to)
        if (mat.userData?.isSolid) {
          mat.transparent = true
          mat.opacity = inChain ? 1.0 : 0.12
        } else {
          mat.opacity = inChain ? 0.5 : 0.12
        }
        mat.needsUpdate = true
      })
    }

    // Phase 9B.2 Fix 2: reapply selection/hover brightening AT the end of
    // the rebuild effect. Closes the race window where a separate
    // useEffect could skip a render and leave the edge rebuilt-but-unbright.
    applyEdgeStylingRef.current?.()

    dirtyRef.current = true
  }, [currentLayer, currentNodeMap, buildEdges, zoom, chainNodeIds, threeReady])

  // Dim non-chain edges + animate in-chain edges when selection changes
  useEffect(() => {
    // Cancel any running edge animation
    if (edgeAnimRef.current) {
      cancelAnimationFrame(edgeAnimRef.current)
      edgeAnimRef.current = null
    }

    const group = edgeGroupRef.current
    if (!group) return
    const needsRender = group.children.length > 0

    // Tag each edge as in-chain and set base opacity
    group.children.forEach(line => {
      const mat = line.material
      if (!mat) return
      const from = line.userData.from
      const to = line.userData.to
      const inChain = !chainNodeIds || (chainNodeIds.has(from) && chainNodeIds.has(to))
      line.userData._inChain = inChain

      if (mat.userData?.isSolid) {
        if (inChain) {
          mat.transparent = true
          mat.opacity = 1.0
        } else {
          mat.transparent = true
          mat.opacity = 0.12
        }
      } else {
        mat.opacity = inChain ? 0.5 : 0.12
        // Reset dashOffset when deselected
        if (!chainNodeIds) mat.dashOffset = 0
      }
      mat.needsUpdate = true
    })

    // Start edge animation loop when a chain is active
    if (chainNodeIds && group.children.length > 0) {
      const startTime = performance.now()
      const tick = () => {
        const t = (performance.now() - startTime) * 0.001 // seconds
        let changed = false
        group.children.forEach(line => {
          if (!line.userData._inChain) return
          const mat = line.material
          if (!mat) return
          if (mat.userData?.isSolid) {
            // Solid: gentle opacity pulse
            const pulse = 0.55 + 0.45 * Math.sin(t * 1.8)
            mat.opacity = pulse
            mat.needsUpdate = true
            changed = true
          } else {
            // Dashed: marching ants via dashOffset
            mat.dashOffset = -t * 12
            mat.needsUpdate = true
            changed = true
          }
        })
        if (changed) dirtyRef.current = true
        edgeAnimRef.current = requestAnimationFrame(tick)
      }
      edgeAnimRef.current = requestAnimationFrame(tick)
    }

    if (needsRender && rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current)
    }

    return () => {
      if (edgeAnimRef.current) {
        cancelAnimationFrame(edgeAnimRef.current)
        edgeAnimRef.current = null
      }
    }
  }, [chainNodeIds, zoom])

  // Rebuild grid for current depth when not transitioning
  useEffect(() => {
    if (transitioningRef.current) return
    buildGrid(depth)
  }, [depth, buildGrid])

  // Initialize Three.js
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

    // Edge group
    const edgeGroup = new THREE.Group()
    edgeGroupRef.current = edgeGroup
    scene.add(edgeGroup)

    // Phase 11E.4 (#139 fix): reveal overlay edge group. Added AFTER
    // edgeGroup so its children render after the canonical edges (z-order
    // by scene-graph order; LineMaterial's depthWrite is already false so
    // there's no depth-buffer competition). renderOrder bumped above the
    // default to be defensive against future scene-graph reorderings.
    const revealOverlayGroup = new THREE.Group()
    revealOverlayGroup.renderOrder = 10
    revealOverlayGroupRef.current = revealOverlayGroup
    scene.add(revealOverlayGroup)

    // Grid group
    const gridGroup = new THREE.Group()
    gridGroupRef.current = gridGroup
    scene.add(gridGroup)

    const camera = new THREE.OrthographicCamera()
    camera.position.set(0, 0, 100)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    updateCamera()
    buildGrid(0)
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
      // Update LineMaterial resolution on all edge lines
      if (edgeGroupRef.current) {
        edgeGroupRef.current.children.forEach(line => {
          if (line.material && line.material.resolution) {
            line.material.resolution.set(w, h)
          }
        })
      }
      // Phase 11E.4 (#139 fix): same resolution update for reveal-overlay
      // edges so they don't render at the wrong line-width post-resize.
      if (revealOverlayGroupRef.current) {
        revealOverlayGroupRef.current.children.forEach(line => {
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
      if (gridAnimRef.current) cancelAnimationFrame(gridAnimRef.current)
      if (streakAnimRef.current) cancelAnimationFrame(streakAnimRef.current)
      if (panAnimRef.current) cancelAnimationFrame(panAnimRef.current)
      ro.disconnect()
      renderer.dispose()
      setThreeReady(false)
    }
  }, [updateCamera, buildGrid])

  // Cleanup streak artifacts on unmount (handles key-change remounts mid-animation)
  useEffect(() => {
    return () => {
      if (streakAnimRef.current) {
        cancelAnimationFrame(streakAnimRef.current)
        streakAnimRef.current = null
      }
      const scene = sceneRef.current
      if (scene) {
        const toRemove = []
        scene.traverse(obj => { if (obj.userData?._isStreak) toRemove.push(obj) })
        toRemove.forEach(obj => { scene.remove(obj); obj.geometry?.dispose(); obj.material?.dispose() })
      }
    }
  }, [])

  // Theme change rebuilds grid + edges + clear color
  useEffect(() => {
    const observer = new MutationObserver(() => {
      requestAnimationFrame(() => {
        buildGrid(depth)
        if (edgeGroupRef.current) {
          const lodMode = zoomRef.current < LOD_THRESHOLD
          buildEdges(edgeGroupRef.current, currentLayer.edges, currentNodeMap, 0.5, 1.0, lodMode)
        }
        updateClearColor(depth, currentLayer.color)
        dirtyRef.current = true
      })
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [buildGrid, buildEdges, currentLayer.edges, currentNodeMap, depth, currentLayer.color, updateClearColor])

  // Pan handlers — blocked during transition
  const handleMouseDown = useCallback((e) => {
    if (transitioningRef.current || e.button !== 0) return
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
    if (!draggingRef.current || transitioningRef.current) return
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

  // Zoom — blocked during transition
  const handleWheel = useCallback((e) => {
    e.preventDefault()
    if (transitioningRef.current) return
    const dir = e.deltaY > 0 ? 0.985 : 1.015
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
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Zoom controls
  const zoomIn = useCallback(() => {
    if (transitioningRef.current) return
    zoomRef.current = Math.min(MAX_ZOOM, zoomRef.current * 1.15)
    setZoom(zoomRef.current)
    updateCamera()
  }, [updateCamera])

  const zoomOut = useCallback(() => {
    if (transitioningRef.current) return
    zoomRef.current = Math.max(MIN_ZOOM, zoomRef.current * 0.87)
    setZoom(zoomRef.current)
    updateCamera()
  }, [updateCamera])

  const fitAll = useCallback(() => {
    if (transitioningRef.current) return
    fitToNodes(currentLayer.nodes)
  }, [currentLayer.nodes, fitToNodes])

  // Background click to deselect
  const handleBackgroundClick = useCallback((e) => {
    if (transitioningRef.current) return
    if (wasDragRef.current) return
    // Only react to clicks that landed on the canvas/overlay/container background.
    if (e.target !== overlayRef.current && e.target !== canvasRef.current && e.target !== containerRef.current) return

    // V2.2 edge click: raycast against the edge group; if a line hits, emit
    // onEdgeClick with screen coordinates so V2App can open the edge menu or panel.
    if (onEdgeClick) {
      const camera = cameraRef.current
      const edgeGroup = edgeGroupRef.current
      const container = containerRef.current
      const rc = raycasterRef.current
      if (camera && edgeGroup && container && rc) {
        const rect = container.getBoundingClientRect()
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1,
        )
        rc.setFromCamera(mouse, camera)
        const intersects = rc.intersectObjects(edgeGroup.children, false)
        if (intersects.length > 0) {
          const edgeId = intersects[0].object.userData?.edgeId
          if (edgeId) {
            // Phase 9B.1 §4: capture the world-space hit point so the pinned
            // tooltip can track it through the pan/zoom framing animation.
            const hitPoint = intersects[0].point
            onEdgeClick(edgeId, {
              x: e.clientX,
              y: e.clientY,
              worldX: hitPoint.x,
              worldY: hitPoint.y,
            })
            return
          }
        }
      }
    }

    onCloseSel?.()
  }, [onCloseSel, onEdgeClick])

  // Double-click empty canvas: zoom in at root, surface at child depth
  const handleBackgroundDblClick = useCallback((e) => {
    if (transitioningRef.current) return
    if (wasDragRef.current) return
    if (e.target !== overlayRef.current && e.target !== canvasRef.current && e.target !== containerRef.current) return

    if (layerStack.length > 1) {
      handleSurface()
      return
    }

    if (isSubchain && onExitSubchain) {
      onExitSubchain()
      return
    }

    // Zoom in 2x centered on double-click position
    const factor = 2
    const oldZoom = zoomRef.current
    const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * factor))
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
  }, [layerStack.length, handleSurface, clampPan, updateCamera, isSubchain, onExitSubchain])

  // Apply selected-edge treatment per spec §4.4. Spec calls for "color shifts
  // toward white (40% blend)" and "+0.5px stroke," but in practice the 40% blend
  // was barely visible on amber dashed / green dotted lines against the dark
  // background. Bumped to 65% white blend + 1.5px stroke so the selection state
  // is unmistakable across all four disclosure types (Full indigo solid,
  // Selective amber dashed, Proof-Only green dotted, Provisional muted dashed).
  //
  // Phase 9A.2 item 3: added `currentLayer.edges` and `zoom` to deps. The
  // buildEdges effect at line ~2188 rebuilds all edge materials when the
  // layer or zoom changes, which wipes the selection brightening from the
  // previous render. Re-running this effect after each rebuild re-applies
  // the brightening so selection persists through zoom + layer changes.
  // Edge hover state for tooltip (raycaster-based).
  // Phase 9B §1: declared BEFORE the selection/brightening effect below so
  // the effect can depend on `hoveredEdge` without a TDZ. (V2Canvas useState
  // order is stable — React just needs the identifier in scope for the deps
  // array evaluation on each render.)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [edgeTooltipPos, setEdgeTooltipPos] = useState(null)
  // Phase 9B §2: track SDA type for the cursor-centered dot colour.
  const [hoveredEdgeSdaType, setHoveredEdgeSdaType] = useState(null)
  const edgeHideTimeout = useRef(null)
  const raycasterRef = useRef(null)

  // Phase 9B.2 Fix 2: ref-backed selection state + pure helper. Previously
  // the selection/brightening logic lived only in a separate useEffect that
  // ran AFTER the rebuild effect at line 2200. Any render where React
  // reordered or skipped that second effect left the edge rebuilt without
  // selection styling, which manifested as the "click-state reverses
  // unexpectedly" bug. Fix: expose the logic as a helper that reads from
  // refs (always current values), and call it BOTH from the useEffect
  // (cheap updates on state change) AND directly at the end of the
  // buildEdges rebuild effect (closes the race).
  const selectedEdgeIdRef = useRef(selectedEdgeId)
  const hoveredEdgeRef = useRef(hoveredEdge)
  useEffect(() => { selectedEdgeIdRef.current = selectedEdgeId }, [selectedEdgeId])
  useEffect(() => { hoveredEdgeRef.current = hoveredEdge }, [hoveredEdge])
  const applyEdgeStylingRef = useRef(() => {})
  applyEdgeStylingRef.current = () => {
    const group = edgeGroupRef.current
    if (!group) return
    const selId = selectedEdgeIdRef.current
    const hovId = hoveredEdgeRef.current
    group.children.forEach((line) => {
      const mat = line.material
      if (!mat) return
      // Phase 11E.9 Fix 2: collapse to 'provisional' when the edge carries
      // the showAsProvisional flag — same precedent as the initial
      // buildEdges effectiveSdaType resolution at line ~871. Without this,
      // the restyle re-reads the typed sdaType from userData and overwrites
      // the dashed-grey provisional treatment whenever a downstream trigger
      // fires (selection / hover / zoom / edge-list change).
      const effectiveSdaType = line.userData?.showAsProvisional
        ? 'provisional'
        : (line.userData?.sdaType || 'full')
      const cfg = SDA_EDGE_CONFIG[effectiveSdaType] || SDA_EDGE_CONFIG.full
      const isSelected = !!selId && line.userData?.edgeId === selId
      // Phase 9B §1: hover brightening — weaker version of selection's 65%
      // blend. Selection wins when both apply on the same edge.
      // Phase 9B.2 Fix 1: type-aware hover blend. Dashed/dotted edges
      // need a stronger blend (50%) to read as hovered through the dash
      // gaps; solid edges stay at 30%.
      const isHovered = !isSelected && !!hovId && line.userData?.edgeId === hovId
      const baseWidth = SDA_EDGE_WIDTH[effectiveSdaType] || 2.0
      // Phase 9D.2.2 Fix 1: revoked edges keep their red+dimmed treatment
      // through every restyle (selection / hover / zoom / layer change).
      // Width stays at base; selection lerp toward white skipped so the
      // user doesn't lose the revoked visual cue when they click the edge
      // to inspect it. Selection state still drives Detail Panel, just not
      // the edge color.
      const isRevokedEdge = !!line.userData?.isRevoked
      if (isRevokedEdge) {
        mat.linewidth = baseWidth
        if (mat.color) mat.color.set('#ef4444')
        mat.needsUpdate = true
        return
      }
      const baseColor = new THREE.Color(cfg.color)
      const hoverBlend = (cfg.dash || 0) > 0 ? 0.5 : 0.3
      const color = isSelected
        ? baseColor.clone().lerp(new THREE.Color('#ffffff'), 0.65)
        : isHovered
          ? baseColor.clone().lerp(new THREE.Color('#ffffff'), hoverBlend)
          : baseColor
      // Phase 9A.1 item 7: internal edges de-emphasised to 0.5× when not
      // selected; selected edges bump past that factor as usual.
      const isInternal = !!line.userData?.isInternal
      const factor = isInternal && !isSelected ? 0.5 : 1.0
      mat.linewidth = isSelected ? baseWidth + 1.5 : baseWidth * factor
      if (mat.color) mat.color.copy(color)
      mat.needsUpdate = true
    })
    dirtyRef.current = true
  }

  useEffect(() => {
    applyEdgeStylingRef.current()
  }, [selectedEdgeId, hoveredEdge, currentLayer.edges, zoom])

  // Initialize raycaster for Line2 edge hover.
  // Phase 9B.2 Fix 5b: bumped threshold 8 → 12. The dot was flickering
  // during rapid cursor movement because tight hit detection dropped edges
  // between frames. 12px is still well within the visual stroke width so
  // the raycaster doesn't start hitting unrelated edges.
  useEffect(() => {
    const rc = new THREE.Raycaster()
    rc.params.Line2 = { threshold: 12 }
    raycasterRef.current = rc
  }, [])

  // Raycaster-based edge hover on pointer move
  const handleEdgeHover = useCallback((e) => {
    const camera = cameraRef.current
    const edgeGroup = edgeGroupRef.current
    const container = containerRef.current
    const rc = raycasterRef.current
    if (!camera || !edgeGroup || !container || !rc) return
    if (transitioningRef.current) return

    // Don't show edge tooltips when hovering over HTML card elements
    const overlay = overlayRef.current
    if (overlay) {
      const target = document.elementFromPoint(e.clientX, e.clientY)
      if (target && overlay.contains(target)) {
        setHoveredEdge(null)
        setEdgeTooltipPos(null)
        setHoveredEdgeSdaType(null)
        onEdgeHover?.(null)
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
      const sdaType = hit.userData?.sdaType || 'full'
      if (edgeId) {
        if (edgeHideTimeout.current) { clearTimeout(edgeHideTimeout.current); edgeHideTimeout.current = null }
        setHoveredEdge(edgeId)
        setEdgeTooltipPos({ x: e.clientX, y: e.clientY })
        setHoveredEdgeSdaType(sdaType)
        onEdgeHover?.({ edgeId, sdaType, x: e.clientX, y: e.clientY })
        return
      }
    }

    // No hit — debounced hide.
    // Phase 9B.2 Fix 5b: bumped 80 → 150ms so the dot doesn't flicker on
    // rapid cursor movement across adjacent edges or near edge boundaries.
    if (hoveredEdge && !edgeHideTimeout.current) {
      edgeHideTimeout.current = setTimeout(() => {
        setHoveredEdge(null)
        setEdgeTooltipPos(null)
        setHoveredEdgeSdaType(null)
        onEdgeHover?.(null)
        edgeHideTimeout.current = null
      }, 150)
    }
  }, [hoveredEdge, onEdgeHover])

  const isDot = zoom < MID_LOD_THRESHOLD
  const isMidLOD = zoom >= MID_LOD_THRESHOLD && zoom < LOD_THRESHOLD
  const isLOD = isDot || isMidLOD
  const zoomPct = Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10) + '%'

  // Card wrapper styles — View Transitions API handles departure/arrival animation
  const getCardStyle = (sp) => ({
    position: 'absolute',
    left: sp.x - CARD_W / 2,
    top: sp.y - CARD_H / 2,
    transform: `scale(${zoom})`,
    transformOrigin: 'center center',
    pointerEvents: transitioning ? 'none' : 'auto',
    opacity: chainNodeIds && !chainNodeIds.has(sp.id) ? 0.35 : 1,
    transition: 'opacity 200ms ease',
  })

  return (
    <div
      ref={containerRef}
      data-canvas-container
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        cursor: transitioning ? 'default' : (draggingRef.current ? 'grabbing' : 'grab'),
        overflow: 'hidden',
        backgroundColor: layerBgColor || undefined,
        transition: 'background-color 300ms ease',
      }}
      onClick={handleBackgroundClick}
      onDoubleClick={handleBackgroundDblClick}
      onMouseDown={handleMouseDown}
      onMouseMove={(e) => { handleMouseMove(e); handleEdgeHover(e) }}
      onMouseUp={handleMouseUp}
      onMouseLeave={(e) => { handleMouseUp(e); setHoveredEdge(null); setEdgeTooltipPos(null) }}
    >
      {/* Scene layer — canvas + card overlay, snapshotted together for view transitions */}
      <div style={{ position: 'absolute', inset: 0, viewTransitionName: 'card-layer' }}>
        <canvas
          ref={canvasRef}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
        />

        {/* HTML overlay for node cards */}
        <div
          ref={overlayRef}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
          }}
        >
        {(() => {
          return screenPositions.map((sp, index) => {
          const node = currentNodeMap[sp.id]
          if (!node) return null

          const isAnchor = !!node._isAnchor
          const isDiveTarget = diveTargetId === node.id

          if (isMidLOD && !transitioning) {
            return (
              <div key={isAnchor ? `${node.id}-anchor` : node.id} data-card-id={node.id} style={{
                position: 'absolute',
                left: sp.x - MINI_CARD_W / 2,
                top: sp.y - MINI_CARD_H / 2,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                pointerEvents: transitioning ? 'none' : 'auto',
                opacity: chainNodeIds && !chainNodeIds.has(sp.id) ? 0.35 : 1,
                transition: 'opacity 200ms ease',
                ...((isDiveTarget || isAnchor) && transitioning ? { viewTransitionName: 'dive-target' } : {}),
              }}>
                <AssetNodeMini
                  node={node}
                  isSelected={selectedId === node.id}
                  onSelect={onSelect}
                  onDive={isAnchor ? undefined : handleDive}
                  onOpenSubgraph={(node.id === subchainFocusId || depth > 0) ? undefined : onOpenSubgraph}
                  onV22CardAction={transitioning ? undefined : onV22CardAction}
                  activeParty={activeParty}
                />
              </div>
            )
          }

          if (isDot && !transitioning) {
            // Concentric rings for nodes with children
            const childRings = (() => {
              const kids = node.children
              if (!kids || kids.length === 0) return null
              const ringColors = kids.slice(0, 3).map(c =>
                c.isEvidence ? '#fb923c'
                : (c.isParse || c.category === 'parse') ? '#a78bfa'
                : (c.isEvaluation || c.category === 'evaluation') ? '#818cf8'
                : 'var(--text-dim)'
              )
              const svgSize = 16 + ringColors.length * 8
              return (
                <svg
                  width={svgSize} height={svgSize}
                  style={{
                    position: 'absolute',
                    left: 8 - svgSize / 2,
                    top: 8 - svgSize / 2,
                    pointerEvents: 'none',
                  }}
                >
                  {ringColors.map((color, ri) => {
                    const r = 8 + ri * 4
                    return <circle key={ri} cx={svgSize / 2} cy={svgSize / 2} r={r} fill="none" stroke={color} strokeWidth={2} opacity={0.7} />
                  })}
                </svg>
              )
            })()

            return (
              <div key={isAnchor ? `${node.id}-anchor` : node.id} data-card-id={node.id} style={{
                position: 'absolute',
                left: sp.x - 8,
                top: sp.y - 8,
                // Phase 9A.4 preamble (defect 2): without explicit size the
                // wrapper's line-box allocation stretched height to ~20px
                // (~1.2 × font-size = 19.2px) AND offset the 16×16 child by
                // 4px. Explicit width/height plus `display: flex` removes
                // the line-box entirely so the child lands at (0, 0) of the
                // wrapper — visual dot-centre matches sp.y, which is where
                // edge geometry aims. `lineHeight: 0` alone shrank the
                // wrapper but left the child's baseline offset intact.
                width: 16,
                height: 16,
                display: 'flex',
                pointerEvents: transitioning ? 'none' : 'auto',
                opacity: chainNodeIds && !chainNodeIds.has(node.id) ? 0.35 : 1,
                transition: 'opacity 200ms ease',
                ...((isDiveTarget || isAnchor) && transitioning ? { viewTransitionName: 'dive-target' } : {}),
              }}>
                {childRings}
                <AssetNodeDot
                  node={node}
                  isSelected={selectedId === node.id}
                  onSelect={onSelect}
                  onDive={isAnchor ? undefined : handleDive}
                  onOpenSubgraph={(node.id === subchainFocusId || depth > 0) ? undefined : onOpenSubgraph}
                  onV22CardAction={transitioning ? undefined : onV22CardAction}
                  activeParty={activeParty}
                />
              </div>
            )
          }

          // Build card style with dive-target and anchor modifications
          const cardStyle = isAnchor ? {
            ...getCardStyle(sp),
            opacity: 1.0,
            ...(transitioning ? { viewTransitionName: 'dive-target' } : {}),
            pointerEvents: transitioning ? 'none' : 'auto',
          } : {
            ...getCardStyle(sp),
            ...(isDiveTarget && transitioning ? { viewTransitionName: 'dive-target' } : {}),
          }

          // Child cards: hidden until edges draw, then fade in with stagger
          if (!isAnchor && depth > 0 && diveTargetId) {
            if (unfurlSettle) {
              // Edges have drawn — fade in at final position
              const staggerDelay = Math.min(index * 80, 400)
              cardStyle.opacity = chainNodeIds && !chainNodeIds.has(sp.id) ? 0.35 : 1
              cardStyle.transition = `opacity 250ms ease ${staggerDelay}ms`
            } else {
              // Pre-settle: invisible while edges are drawing
              cardStyle.opacity = 0
            }
          }

          return (
            <div key={isAnchor ? `${node.id}-anchor` : node.id} data-card-id={node.id} style={cardStyle}>
              <AssetNode
                node={node}
                isSelected={selectedId === node.id}
                onSelect={transitioning ? undefined : onSelect}
                onOpenSubgraph={(transitioning || node.id === subchainFocusId || depth > 0) ? undefined : onOpenSubgraph}
                onDive={(transitioning || isAnchor) ? undefined : handleDive}
                onSurface={depth > 0 ? handleSurface : undefined}
                isAnchor={isAnchor}
                isChild={depth > 0 && !isAnchor}
                zoom={zoom}
                onV22CardAction={transitioning ? undefined : onV22CardAction}
                activeParty={activeParty}
                revealPhase={revealAnim?.nodeId === node.id ? revealAnim.phase : null}
              />
            </div>
          )
        })
        })()}
      </div>
      </div>{/* close scene layer wrapper */}


      {/* Cursor-centered dot under the cursor while hovering an edge.
          Phase 9B §2 (initial), 9B.1 §1 (12 → 24), 9B.2 Fix 5a (24 → 32px).
          SDA-type fill, 70% opacity, no stroke, pointer-events: none so the
          cursor can keep interacting with the edge. Rich tooltip content
          lives in EdgeHoverMenu (rendered by V2App via the onEdgeHover
          emit). Raycaster threshold + hide debounce also bumped for
          reliability (Fix 5b). */}
      {hoveredEdge && edgeTooltipPos && hoveredEdgeSdaType && !selectedEdgeId && createPortal(
        <div style={{
          position: 'fixed',
          left: edgeTooltipPos.x - 16,
          top: edgeTooltipPos.y - 16,
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: SDA_EDGE_CSS[hoveredEdgeSdaType] || SDA_EDGE_CSS.full,
          opacity: 0.7,
          pointerEvents: 'none',
          zIndex: 5900,
        }} />,
        document.body,
      )}

      {/* Layer border highlight */}
      <LayerBorder
        color={currentLayer.color || 'var(--text-secondary)'}
        visible={depth > 0 && !transitioning}
        rightInset={panelWidth}
      />
      {/* Subchain border */}
      <LayerBorder
        color="rgba(255, 255, 255, 0.4)"
        visible={isSubchain && !transitioning}
        rightInset={panelWidth}
      />

      {/* Layer pill + up arrow */}
      {!transitioning ? (
        <LayerPill layerStack={layerStack} onSurface={handleSurface} />
      ) : null}

      {/* HUD — zoom controls (excluded from view transition) */}
      <div style={{
        position: 'absolute',
        top: 12,
        right: 12 + panelWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        zIndex: 50,
        pointerEvents: 'auto',
        viewTransitionName: 'none',
        transition: 'right 200ms ease',
      }}>
        {[
          { label: '+', onClick: zoomIn },
          { label: '−', onClick: zoomOut },
          { label: 'FIT', onClick: fitAll },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.onClick}
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
          >
            {btn.label}
          </button>
        ))}
        <div style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-tertiary)',
          marginTop: 2,
        }}>
          {zoomPct}
        </div>
      </div>

      {/* Edge type legend */}
      {depth === 0 && (
        <LegendBar />
      )}
    </div>
  )
})

export default V2Canvas
