// DirectoryLayer — Phase 16.0 (spec §8.2) + Phase 16.0.1 layout polish.
//
// Per-role view onto the Radiant Network's public + privately-disclosed
// Claim and RFP catalog. Dot matrix background, per-Actor clusters with
// dot-sized hollow indigo Actor squares + pillbox-styled party labels,
// row-aligned grid layout (max 6 dots per row, 12px grid stride),
// per-role view filtering. Dots are hoverable (whitens + cluster
// brightens + tooltip card) and clickable (pins tooltip + opens Detail
// Panel via onClaimDotClick).
//
// Phase 16.0.1: layout polish.
//   • Header simplified to a single "Radiant Network" pillbox; subtitle
//     and in-canvas AI Shopper button removed.
//   • Dot size 8×8 → 6×6.
//   • Cluster layout switched from freeform polar fill to row-major
//     grid (max 6 wide, 12px cell stride, one-dot-width gaps). Umbrella
//     dots fill first so the amber subset occupies the leading cells
//     in row-major order; ChipCo's 7-amber + 7-public Bob view yields
//     6+6+2 rows with an L-shaped amber border around the leading 7.
//   • Actor squares shrunk to 6×6 (dot size, hollow indigo border);
//     party label moves to a pillbox above the square.
//   • Cluster centers re-anchored to vertical center of canvas.
//   • Bob's RFP green dot anchored directly above his corner card.
//
// Preserved from earlier phases:
//   • Phase 11.8 wipe-origin pinning (`pinnedOriginRef`) — entry/exit
//     transition mechanics.
//   • Phase 11A entry-exit phase state machine — opening RAF, closing
//     transition, mount-during-out-phase pattern.
//   • Bob's corner card visual — parent-layer Actor card style.

import { useEffect, useState, useMemo, useRef } from 'react'
import Tooltip from '../components/Tooltip.jsx'
import { buildV22DirectoryDataForRole } from './v2_2Data.js'

// ─── Layout constants ──────────────────────────────────────────────────
// Phase 16.0.3 Item 5: `DOT_GRID = 12` is the canonical grid stride for
// EVERYTHING positioned on the Directory canvas — cluster dots, Actor
// squares, label pillbox bottoms, RFP placeholders, and cluster anchor
// centers. Strict alignment is what makes the dot cloud read as a
// matrix at scale; sloppy positions compound visually as seed grows.
// `MATRIX_GRID = 16` is the BACKGROUND dot matrix that's painted via
// the radial-gradient background-image. Phase 16.1 may unify these.
const DOT_GRID = 12
const MATRIX_GRID = 16                // background dot-pattern spacing
const CELL = DOT_GRID                 // cluster grid cell stride (dot + gap)
const DOT_RADIUS = 3                  // Phase 16.0.1: 6×6 dots (was 8×8)
const ACTOR_SQUARE = 6                // Phase 16.0.1: dot-sized Actor square (was 40)
const MAX_COLS = 6                    // max dots per cluster row
const ROW_GAP = CELL                  // 12px between row centers
const COL_GAP = CELL                  // 12px between column centers
const ACTOR_LABEL_OFFSET = 18         // label pillbox height above Actor square
const ACTOR_TO_DOTS_GAP = CELL * 2    // gap between Actor square and first dot row
const CLUSTER_PAD = 5                 // padding outside dot footprints for amber border
const CORNER_CARD_W = 210
const CORNER_CARD_H = 88
const CORNER_CARD_LEFT = 32
const CORNER_CARD_BOTTOM = 32

// Phase 16.0.3 Item 5: snap an arbitrary pixel position to the dot grid.
function snapGrid(v) { return Math.round(v / DOT_GRID) * DOT_GRID }

// ─── Row-major grid layout for a single cluster ────────────────────────
// Returns an array of { x, y, isAmber, claim, row, col } with row-major
// fill: umbrella claims first, then public. Cluster grid is anchored at
// (anchorX, anchorY) — the top-left corner of cell (row=0, col=0). Dot
// centers sit at (anchorX + col*CELL + CELL/2, anchorY + row*CELL + CELL/2).
//
// Phase 16.0.3 Item 2: when a cluster has BOTH umbrella and public dots,
// insert a one-cell phantom gap between the subsets so the L-shaped
// amber border has visual breathing room from the public dots. If the
// last umbrella row has space for both gap-cell + first-public-cell,
// public flow continues on the same row; otherwise public starts at
// col 0 of the next row (the row break itself separates the subsets, so
// no extra gap is needed there).
function placeClusterRowMajor(anchorX, anchorY, umbrellaClaims, publicClaims) {
  const out = []
  // Place umbrella in pure row-major up to MAX_COLS per row.
  for (let i = 0; i < umbrellaClaims.length; i++) {
    out.push({
      claim: umbrellaClaims[i], isAmber: true,
      row: Math.floor(i / MAX_COLS),
      col: i % MAX_COLS,
    })
  }
  // Decide where public starts.
  let curRow, curCol
  const lastUmbrella = out[out.length - 1]
  if (lastUmbrella && publicClaims.length > 0) {
    if (lastUmbrella.col + 2 < MAX_COLS) {
      // Same row — gap cell at col+1, first public at col+2.
      curRow = lastUmbrella.row
      curCol = lastUmbrella.col + 2
    } else {
      // Drop to next row — row break itself separates subsets.
      curRow = lastUmbrella.row + 1
      curCol = 0
    }
  } else {
    curRow = 0
    curCol = 0
  }
  for (let i = 0; i < publicClaims.length; i++) {
    out.push({ claim: publicClaims[i], isAmber: false, row: curRow, col: curCol })
    curCol++
    if (curCol >= MAX_COLS) {
      curRow++
      curCol = 0
    }
  }
  return out.map((entry) => ({
    ...entry,
    x: anchorX + entry.col * COL_GAP + CELL / 2,
    y: anchorY + entry.row * ROW_GAP + CELL / 2,
  }))
}

// ─── L-shaped amber border path for the umbrella subset ────────────────
// Computes an SVG path string outlining the umbrella dots in row-major
// fill order. Handles two common cases observed in the seed:
//   • All umbrella dots fit in row 0 → simple rectangle around row 0.
//   • Umbrella dots span row 0 (full) + row 1 partial → L-shape down
//     the leftmost columns of row 1.
// For a third row of umbrella the function generalises: the rightmost
// "ledge" steps in at each row boundary.
//
// `cells` is an array of { row, col } for amber dots (in row-major fill
// order). anchorX/Y is the cluster grid's top-left corner.
function lShapePath(cells, anchorX, anchorY) {
  if (!cells || cells.length === 0) return null
  // Group cells by row, get max column per row.
  const rowMaxCol = new Map()
  for (const { row, col } of cells) {
    rowMaxCol.set(row, Math.max(rowMaxCol.get(row) ?? -1, col))
  }
  const rows = [...rowMaxCol.keys()].sort((a, b) => a - b)
  // Cell rectangle: each cell occupies (col*CELL, row*CELL) → (col*CELL+CELL, row*CELL+CELL).
  // We trace the outline with PAD outside that bbox.
  const cellLeft = (col) => anchorX + col * COL_GAP - CLUSTER_PAD
  const cellRight = (col) => anchorX + col * COL_GAP + CELL + CLUSTER_PAD
  const cellTop = (row) => anchorY + row * ROW_GAP - CLUSTER_PAD
  const cellBottom = (row) => anchorY + row * ROW_GAP + CELL + CLUSTER_PAD

  // Trace clockwise from top-left of row 0.
  // Top-left → top-right → step down right side, narrowing at row boundaries
  // → bottom-right of last row → bottom-left of last row → step up left side.
  const points = []
  // Top-left of row 0
  points.push([cellLeft(0), cellTop(rows[0])])
  // Top-right of row 0
  points.push([cellRight(rowMaxCol.get(rows[0])), cellTop(rows[0])])
  // Step down right side, with horizontal jogs where successive rows are narrower
  for (let i = 0; i < rows.length - 1; i++) {
    const thisRow = rows[i]
    const nextRow = rows[i + 1]
    // Drop to bottom of this row (= top of next row)
    points.push([cellRight(rowMaxCol.get(thisRow)), cellBottom(thisRow)])
    // Jog left to next row's right edge
    points.push([cellRight(rowMaxCol.get(nextRow)), cellBottom(thisRow)])
  }
  // Final row: drop to its bottom-right
  const lastRow = rows[rows.length - 1]
  points.push([cellRight(rowMaxCol.get(lastRow)), cellBottom(lastRow)])
  // Bottom-left of last row
  points.push([cellLeft(0), cellBottom(lastRow)])
  // Up the left side back to start
  points.push([cellLeft(0), cellTop(rows[0])])

  // Build SVG path string with rounded corners (use simple lineTo; small
  // radius corners are aesthetically nice but a sharp polyline reads
  // fine at this scale).
  const d = points.map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`)).join(' ') + ' Z'
  return d
}

// ─── Tooltip card (mirrors parent-layer AssetNodeDot pattern) ──────────
// Phase 16.0.3 Item 3: Tooltip anchors to the dot's right-center (or
// left-center on viewport-edge flip), vertically centered on the dot.
// CLAIM badge sits tight to the top of the inner content (no padding
// excess). Mirrors AssetNodeDot's `wouldClipRight` flip pattern from
// AssetNode.jsx.
const TOOLTIP_W = 230
const TOOLTIP_OFFSET = 12  // gap between dot edge and tooltip edge
function ClaimTooltipCard({ claim, disclosureType, x, y, viewportW }) {
  const dateStr = (claim.createdDate || '').slice(0, 10)
  const wouldClipRight = x + DOT_RADIUS + TOOLTIP_OFFSET + TOOLTIP_W > (viewportW || 1280) - 16
  // Place the tooltip's anchor edge at the dot's right (or left on flip);
  // CSS transform vertically centers it on the dot.
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
        // Pull the tooltip up by half its height (vertical-center on dot)
        // and, on flip, also pull left by 100% so its right edge anchors
        // to the dot's left side. Mirrors AssetNode.jsx:1259-1262.
        transform: wouldClipRight
          ? 'translate(-100%, -50%)'
          : 'translateY(-50%)',
        // Phase 16.0.3: tighter top padding so CLAIM badge sits at top.
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

// ─── Single Claim dot (Phase 16.0.1: 6×6) ──────────────────────────────
function ClaimDot({ claim, x, y, isAmber, disclosureType, isHovered, isPinned, onHover, onClick }) {
  const baseColor = isAmber ? 'var(--accent-amber)' : 'var(--accent-indigo)'
  const renderColor = (isHovered || isPinned) ? '#ffffff' : baseColor
  return (
    <div
      onMouseEnter={() => onHover(claim, { x, y, disclosureType })}
      onMouseLeave={() => onHover(null, null)}
      onClick={(e) => { e.stopPropagation(); onClick(claim, { x, y, disclosureType }) }}
      style={{
        position: 'absolute',
        left: x - DOT_RADIUS,
        top: y - DOT_RADIUS,
        width: DOT_RADIUS * 2,
        height: DOT_RADIUS * 2,
        borderRadius: '50%',
        background: renderColor,
        // Phase 16.0.1: hovered dots get a soft white halo so they read on
        // top of any pillbox label they happen to sit beneath.
        boxShadow: (isHovered || isPinned)
          ? `0 0 10px ${baseColor}, 0 0 8px rgba(255,255,255,0.6)`
          : `0 0 5px color-mix(in srgb, ${baseColor} 60%, transparent)`,
        cursor: 'pointer',
        transition: 'background 150ms ease, box-shadow 150ms ease, transform 150ms ease',
        transform: (isHovered || isPinned) ? 'scale(1.5)' : 'scale(1)',
        zIndex: (isHovered || isPinned) ? 12 : 5,
      }}
    />
  )
}

// ─── Single RFP dot (Phase 16: visual-only, non-functional) ───────────
function RfpDot({ rfp, x, y }) {
  return (
    <div
      data-rfp-id={rfp.id}
      style={{
        position: 'absolute',
        left: x - DOT_RADIUS,
        top: y - DOT_RADIUS,
        width: DOT_RADIUS * 2,
        height: DOT_RADIUS * 2,
        borderRadius: '50%',
        background: 'var(--accent-green)',
        boxShadow: '0 0 5px color-mix(in srgb, var(--accent-green) 60%, transparent)',
        // Phase 16: pointer-events:none — Phase 17 will wire interaction.
        pointerEvents: 'none',
      }}
    />
  )
}

// ─── Actor square (Phase 16.0.1: dot-sized hollow + pillbox label) ─────
// `faded` flag is set externally when an underlying Claim dot is hovered
// near the pillbox bounding box (keeps the dot's whiten + glow legible
// against the label).
function ActorSquare({ ownerParty, x, y, faded }) {
  const half = ACTOR_SQUARE / 2
  return (
    <>
      {/* Pillbox label — positioned above the Actor square. */}
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
      {/* Hollow square — dot-sized. */}
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

// ─── Cluster wrapper (handles "brighten on group hover") ──────────────
function ClusterGroup({ children, isHovered }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        filter: isHovered ? 'brightness(1.18)' : 'brightness(1)',
        transition: 'filter 150ms ease',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'auto' }}>{children}</div>
    </div>
  )
}

// ─── Pillbox-fade intersection check ───────────────────────────────────
// A pillbox label is approximately PILLBOX_W × PILLBOX_H px wide and sits
// ACTOR_LABEL_OFFSET above the Actor square center. We fade it when the
// hovered Claim dot's footprint (6×6) overlaps the pillbox's bounding
// box. Phase 16 has ≤ 4 pillboxes per role view so the per-hover scan is
// trivially cheap.
const PILLBOX_W = 64
const PILLBOX_H = 16
function isHoverNearPillbox(hover, pillX, pillY) {
  if (!hover) return false
  const dotL = hover.x - DOT_RADIUS, dotR = hover.x + DOT_RADIUS
  const dotT = hover.y - DOT_RADIUS, dotB = hover.y + DOT_RADIUS
  const pL = pillX - PILLBOX_W / 2, pR = pillX + PILLBOX_W / 2
  const pT = pillY - PILLBOX_H / 2, pB = pillY + PILLBOX_H / 2
  return !(dotR < pL || dotL > pR || dotB < pT || dotT > pB)
}

// ─── Main DirectoryLayer ───────────────────────────────────────────────
export default function DirectoryLayer({
  open,
  activeParty,
  roleId,
  v22Provisionals,
  // Phase 16.0.1: kept on the prop list so V2App can keep the chrome AI
  // Shopper entry point wired, but the Directory layer no longer
  // surfaces an in-canvas Launch button.
  onOpenAIShopper,    // eslint-disable-line no-unused-vars
  onClose,
  // Phase 16.0: per-dot click. Replaces Phase 11B's onClusterClick. The
  // V2App parent opens the Detail Panel for the clicked Claim. Pass null
  // to dismiss (e.g. background click).
  onClaimDotClick,
  // Phase 11.8 #44: route the wipe through a custom screen-space origin.
  wipeOrigin,
}) {
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

  // Phase 11.8 #44: pin the wipe origin to the first opening's wipeOrigin.
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

  // Per-role Directory data — recomputes on role switch.
  const directoryData = useMemo(() => {
    if (!roleId) return null
    return buildV22DirectoryDataForRole(roleId, v22Provisionals)
  }, [roleId, v22Provisionals])

  const [hover, setHover] = useState(null) // { claim, disclosureType, x, y, ownerParty } | null
  const [pinned, setPinned] = useState(null)

  useEffect(() => { if (phase === 'closed') { setHover(null); setPinned(null) } }, [phase])
  useEffect(() => { setHover(null); setPinned(null) }, [roleId])

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

  // ─── Layout ──────────────────────────────────────────────────────────
  // Cluster anchor convention (post-16.0.1):
  //   • Actor square + pillbox sit at (cluster.center.x, cluster.center.y).
  //   • Dot grid begins below the Actor square: anchor (top-left of row 0
  //     col 0) = (center.x - clusterWidth/2, center.y + ACTOR_TO_DOTS_GAP).
  //   • Cluster width is determined by min(MAX_COLS, totalDots) × CELL.
  //   • Cluster centers are spread horizontally and anchored at vertical
  //     center of the canvas (Item 7).
  const layout = useMemo(() => {
    if (!directoryData) return null
    const otherClusters = directoryData.otherClusters
    const N = otherClusters.length

    // Horizontal distribution centered on viewport mid-point. Two clusters
    // → x≈35% / 65%. One cluster → x≈50%. N>3 falls back to even spread.
    const sortedParties = [...otherClusters].sort((a, b) =>
      a.ownerParty.localeCompare(b.ownerParty),
    )
    // Phase 16.0.3 Item 5: snap cluster centers to the dot grid so all
    // downstream dot positions (which derive from `center`) inherit the
    // alignment.
    const positions = (() => {
      if (N === 0) return new Map()
      const map = new Map()
      const baseY = snapGrid(viewport.h * 0.5)
      if (N === 1) {
        map.set(sortedParties[0].ownerParty, { x: snapGrid(viewport.w * 0.5), y: baseY })
      } else if (N === 2) {
        map.set(sortedParties[0].ownerParty, { x: snapGrid(viewport.w * 0.35), y: baseY })
        map.set(sortedParties[1].ownerParty, { x: snapGrid(viewport.w * 0.65), y: baseY })
      } else {
        for (let i = 0; i < N; i++) {
          const fx = (i + 1) / (N + 1)
          map.set(sortedParties[i].ownerParty, { x: snapGrid(viewport.w * fx), y: baseY })
        }
      }
      return map
    })()

    const clusters = otherClusters.map((cluster) => {
      const center = positions.get(cluster.ownerParty) || { x: 200, y: 300 }
      const totalDots = cluster.publicClaims.length + cluster.umbrellaClaims.length
      const colsUsed = Math.min(MAX_COLS, totalDots)
      const clusterPxWidth = colsUsed * CELL
      // Phase 16.0.3 Item 5: snap the dot-grid anchor (top-left of cell
      // 0,0) to DOT_GRID. Cluster centers are already snapped above, so
      // anchorX = center.x - clusterPxWidth/2 lands on a half-cell when
      // clusterPxWidth is an even multiple of CELL — `snapGrid` re-rounds
      // to the nearest grid line for safety.
      const anchorX = snapGrid(center.x - clusterPxWidth / 2)
      const anchorY = snapGrid(center.y + ACTOR_TO_DOTS_GAP)
      const dots = placeClusterRowMajor(
        anchorX, anchorY,
        cluster.umbrellaClaims, cluster.publicClaims,
      )
      const umbrellaCells = dots.filter((d) => d.isAmber).map(({ row, col }) => ({ row, col }))
      const amberPath = umbrellaCells.length > 0 ? lShapePath(umbrellaCells, anchorX, anchorY) : null
      return { ownerParty: cluster.ownerParty, center, dots, amberPath }
    })

    // Own cluster placement: anchor near the bottom-left corner card,
    // applying the same row-major grid layout. Row 0 sits ~CELL*4 above
    // the corner card top edge so dots have breathing room.
    const ownTotal = directoryData.ownClaims.length
    const ownCols = Math.min(MAX_COLS, ownTotal)
    const ownPxWidth = ownCols * CELL
    const ownRowsCount = Math.ceil(ownTotal / MAX_COLS) || 1
    // Corner card top edge (in viewport coords): viewport.h - bottom - height.
    // Phase 16.0.3 Item 5: snap the own-cluster anchor to DOT_GRID.
    const cardTopY = viewport.h - CORNER_CARD_BOTTOM - CORNER_CARD_H
    const ownAnchorX = snapGrid(CORNER_CARD_LEFT + CORNER_CARD_W + CELL * 2)
    const ownAnchorY = snapGrid(cardTopY - (ownRowsCount * CELL) - CELL)
    const ownPlaced = placeClusterRowMajor(
      ownAnchorX, ownAnchorY,
      [], directoryData.ownClaims,  // own claims always rendered as indigo
    )
    const ownDots = ownPlaced.map((d) => ({ ...d, isAmber: false }))

    // Phase 16.0.1 Item 8: own RFPs anchor directly above the corner card.
    // Phase 16.0.3 Item 5: snap to DOT_GRID. CORNER_CARD_LEFT (32) +
    // CORNER_CARD_W/2 (105) = 137 isn't a clean grid multiple, so we snap.
    const cardCenterX = snapGrid(CORNER_CARD_LEFT + CORNER_CARD_W / 2)
    const ownRfpRowY = snapGrid(cardTopY - 24)
    const ownRfpDots = directoryData.ownRfps.map((rfp, i) => {
      // If multiple RFPs, spread them horizontally, centered on the card.
      const total = directoryData.ownRfps.length
      const offset = (i - (total - 1) / 2) * CELL
      return { rfp, x: cardCenterX + offset, y: ownRfpRowY }
    })

    // Other RFPs — placement adjacent to the owning Actor's cluster, or
    // free-standing if the owner has no cluster. Free-standing RFP gets
    // its own Actor square + pillbox label.
    // Phase 16.0.3 Item 5: snap RFP anchor positions to the dot grid.
    const otherRfpEntries = []
    for (const rfp of directoryData.otherRfps) {
      const existingCluster = clusters.find((c) => c.ownerParty === rfp.owner)
      if (existingCluster) {
        const sq = existingCluster.center
        otherRfpEntries.push({ rfp, x: snapGrid(sq.x + CELL), y: snapGrid(sq.y), freeStanding: false })
      } else {
        const slot = { x: snapGrid(viewport.w * 0.85), y: snapGrid(viewport.h * 0.5) }
        otherRfpEntries.push({ rfp, x: snapGrid(slot.x + CELL), y: slot.y, freeStanding: true, squareX: slot.x, squareY: slot.y, ownerParty: rfp.owner })
      }
    }

    return { clusters, ownDots, ownRfpDots, otherRfpEntries }
  }, [directoryData, viewport])

  if (phase === 'closed') return null
  if (!directoryData || !layout) return null

  const handleDotHover = (claim, pos) => {
    if (!claim) { setHover(null); return }
    setHover({ claim, x: pos.x, y: pos.y, ownerParty: claim.owner, disclosureType: pos.disclosureType || 'public' })
  }
  const handleDotClick = (claim, ctx) => {
    setPinned({
      claim,
      ownerParty: claim.owner,
      x: ctx?.x ?? 0,
      y: ctx?.y ?? 0,
      disclosureType: ctx?.disclosureType || 'public',
    })
    onClaimDotClick?.(claim)
  }
  const handleBackgroundClick = () => {
    setPinned(null)
    onClaimDotClick?.(null)
  }

  const activeHoverParty = hover?.ownerParty || pinned?.ownerParty || null
  // Pillbox-fade decision is a function of the currently hovered dot's
  // proximity to each pillbox's bounding box.
  const fadePillboxFor = (centerX, centerY) => {
    const pillX = centerX
    const pillY = centerY - ACTOR_SQUARE / 2 - ACTOR_LABEL_OFFSET
    return isHoverNearPillbox(hover, pillX, pillY)
  }

  return (
    <div
      data-v22-directory-layer
      onClick={handleBackgroundClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 150,
        clipPath,
        WebkitClipPath: clipPath,
        transition: 'clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1), -webkit-clip-path 550ms cubic-bezier(0.65, 0, 0.35, 1)',
        background: 'var(--bg-deep)',
        backgroundImage: 'radial-gradient(circle, color-mix(in srgb, var(--text-dim) 28%, transparent) 1px, transparent 1.6px)',
        backgroundSize: `${MATRIX_GRID}px ${MATRIX_GRID}px`,
        backgroundPosition: '0 0',
        overflow: 'hidden',
      }}
    >
      {/* Phase 16.0.1 Item 1: header pillbox.
          Phase 16.0.3 Item 0: top: 24 → 80 so the pillbox clears the top
          chrome bar (chrome is z-300 + ~60-80px tall; the layer sits at
          z-150 so its `top: 24` content rendered behind chrome). */}
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

      {/* Bob's corner card — preserved from Phase 11A. */}
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

      {/* Umbrella DA edges. Phase 16.0.3 Item 1: cubic Bezier curve from
          corner card right-edge → target Actor square left-edge. The
          control points sit halfway across the horizontal gap, on the
          same y as their endpoints, producing a smooth horizontal-exit /
          horizontal-entry S-curve. Visual character mirrors parent-layer
          full-disclosure edges (see V2Canvas.jsx SDA_EDGE_CONFIG.full). */}
      <svg
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
      >
        {directoryData.umbrellaEdges.map((edge) => {
          const cluster = layout.clusters.find((c) => c.ownerParty === edge.targetParty)
          if (!cluster) return null
          // Start: right-center of Bob's corner card.
          const fromX = CORNER_CARD_LEFT + CORNER_CARD_W
          const fromY = viewport.h - CORNER_CARD_BOTTOM - CORNER_CARD_H / 2
          // End: left-center of the Actor square.
          const toX = cluster.center.x - ACTOR_SQUARE / 2
          const toY = cluster.center.y
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

      {/* Per-Actor clusters */}
      {layout.clusters.map((cluster) => {
        const faded = fadePillboxFor(cluster.center.x, cluster.center.y)
        return (
          <ClusterGroup key={cluster.ownerParty} isHovered={activeHoverParty === cluster.ownerParty}>
            {/* L-shaped amber border (path SVG behind dots). */}
            {cluster.amberPath && (
              <svg
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 3 }}
              >
                <path
                  d={cluster.amberPath}
                  stroke="var(--accent-amber)"
                  strokeWidth={1.5}
                  fill="color-mix(in srgb, var(--accent-amber) 8%, transparent)"
                  strokeLinejoin="round"
                />
              </svg>
            )}
            <ActorSquare ownerParty={cluster.ownerParty} x={cluster.center.x} y={cluster.center.y} faded={faded} />
            {cluster.dots.map((d) => (
              <ClaimDot
                key={d.claim.id}
                claim={d.claim}
                x={d.x} y={d.y}
                isAmber={d.isAmber}
                disclosureType={d.isAmber ? 'umbrella' : 'public'}
                isHovered={hover?.claim?.id === d.claim.id}
                isPinned={pinned?.claim?.id === d.claim.id}
                onHover={handleDotHover}
                onClick={handleDotClick}
              />
            ))}
          </ClusterGroup>
        )
      })}

      {/* Active Actor's own publicly-disclosed Claims — clustered around
          the corner card. No Actor square (corner card serves that role). */}
      {layout.ownDots.length > 0 && (
        <ClusterGroup isHovered={activeHoverParty === directoryData.activeParty}>
          {layout.ownDots.map((d) => (
            <ClaimDot
              key={d.claim.id}
              claim={d.claim}
              x={d.x} y={d.y}
              isAmber={false}
              disclosureType="own"
              isHovered={hover?.claim?.id === d.claim.id}
              isPinned={pinned?.claim?.id === d.claim.id}
              onHover={handleDotHover}
              onClick={handleDotClick}
            />
          ))}
        </ClusterGroup>
      )}

      {/* RFPs — own + others. Phase 16: visual-only, non-functional. */}
      {layout.ownRfpDots.map((d) => (
        <RfpDot key={d.rfp.id} rfp={d.rfp} x={d.x} y={d.y} />
      ))}
      {layout.otherRfpEntries.map((entry) => (
        <div key={entry.rfp.id}>
          {entry.freeStanding && (
            <ActorSquare
              ownerParty={entry.ownerParty}
              x={entry.squareX}
              y={entry.squareY}
              faded={fadePillboxFor(entry.squareX, entry.squareY)}
            />
          )}
          <RfpDot rfp={entry.rfp} x={entry.x} y={entry.y} />
        </div>
      ))}

      {/* Hover/pinned tooltip (singleton). */}
      {(hover || pinned) && (() => {
        const t = pinned || hover
        return <ClaimTooltipCard claim={t.claim} disclosureType={t.disclosureType || 'public'} x={t.x ?? 0} y={t.y ?? 0} viewportW={viewport.w} />
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
    </div>
  )
}
