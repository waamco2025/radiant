import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Tooltip from '../components/Tooltip.jsx'
// Phase 9D.2.2 Fix 3: shared timing constants for the unravel animation.
// Single source of truth for JS-side waits + CSS-side animation-durations.
// SLOW_MODE_MULTIPLIER lives in unravel.js; bump it to slow the whole
// choreography for QA.
import { UNRAVEL_DURATIONS } from './animations/unravel.js'
// Phase 14.3 (#176a): card-chip rendering lives in BadgeChipContainer —
// single rounded rectangle with hover fan-out + per-shield/+N tooltips.
import BadgeChipContainer from './BadgeChipContainer.jsx'
// Phase 14.6.2 Item 6: action-bar Issue Badge icon swap from `★` to the
// canonical shield silhouette so the entry-point matches the chip stack.
import BadgeShieldIcon from './BadgeShieldIcon.jsx'

// Inject reveal animation keyframes once
if (typeof document !== 'undefined' && !document.getElementById('reveal-keyframes')) {
  const style = document.createElement('style')
  style.id = 'reveal-keyframes'
  style.textContent = `
    @keyframes revealFlip {
      0% { transform: scaleY(1); }
      45% { transform: scaleY(0); }
      55% { transform: scaleY(0); }
      100% { transform: scaleY(1); }
    }
    @keyframes revealContentFade {
      0% { opacity: 1; }
      40% { opacity: 0; }
      60% { opacity: 0; }
      100% { opacity: 1; }
    }
  `
  document.head.appendChild(style)
}

const CATEGORY_CONFIG = {
  person:     { icon: '●', color: 'var(--accent-cyan)',   label: 'PERSON' },
  place:      { icon: '◆', color: 'var(--accent-green)',  label: 'PLACE' },
  process:    { icon: '◎', color: 'var(--accent-amber)',  label: 'PROCESS' },
  product:    { icon: '■', color: 'var(--accent-blue)',   label: 'PRODUCT' },
  party:      { icon: '⬡', color: 'var(--accent-indigo)', label: 'PARTY' },
  // Phase 14.6.1 (#184): the legacy `evidence` subtype config entry
  // was dropped here (V2.1 holdover; no current seed Asset uses
  // subtype `'evidence'` so the string never rendered). Lookups via
  // `CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product` provide
  // graceful fallback for any straggler V2.1 data still carrying
  // `category: 'evidence'`. Broader SUBTYPE_CFG audit deferred to the
  // future #50 V2.1 cleanup sweep.
  parse:      { icon: '⊞', color: 'var(--accent-purple, #a78bfa)', label: 'PARSE' },
  evaluation: { icon: '✦', color: 'var(--accent-indigo, #7e8ef8)', label: 'EVALUATION' },
  claim:      { icon: '◇', color: 'var(--accent-teal, #2dd4bf)', label: 'CLAIM' },
  // Phase 17.0.1: RFP joins as a 5th schema. AssetNode + AssetNodeMini
  // render a minimal layout for `node.category === 'rfp'` (type pill + name
  // for mini; +"Posted by {owner}" for full). No badges, no minibars, no
  // action bar, no expand affordance — see the early-return blocks below
  // in each component. RFPs don't carry a disclosure type so the
  // disclosure-type branches in the borderColor chain fall through cleanly.
  rfp:        { icon: '⬚', color: 'var(--accent-indigo)', label: 'RFP' },
}

const CARD_W = 210
// Phase 9A.1 item 2: baseline card height bumped 86 → 96. The extra 10px
// lets the health minibar sit with equal whitespace above and below when the
// inner content uses flex space-between.
const CARD_H = 96
const MINI_CARD_W = 160
const MINI_CARD_H = 48
const CLICK_DELAY = 250
const ACTION_BAR_W = 34 // 6px gap + 24px button + 4px breathing

// Phase 9A.1 warmer node border value — 40% indigo blended with var(--border).
// Surfaced as a shared constant so the full card, mini card, and dot card
// all render identically. Phase 9A.1.5 item 1 extended the treatment to the
// mini and dot LOD renderings (was full-size only in Phase 9A.1).
const WARM_BORDER = 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'

// Phase 9D.2.1 Fix 3 (#124): per-row unravel-fade animation styles.
// rowIdx 0 (type label) starts first; subsequent rows stagger by 50ms each.
// Each row runs a 200ms opacity fade ending at offset+200ms relative to the
// `_unraveling` flag flipping true. forwards keeps the final hidden state.
//
// Phase 9D.2.2 Fix 3: durations + delays now driven by UNRAVEL_DURATIONS
// from animations/unravel.js so SLOW_MODE_MULTIPLIER scales JS waits and
// CSS animation lengths in lockstep.
function unravelRowStyle(isUnraveling, rowIdx) {
  if (!isUnraveling) return null
  const { contentFadeMs, contentBaseDelayMs, contentStaggerMs } = UNRAVEL_DURATIONS
  const delay = contentBaseDelayMs + rowIdx * contentStaggerMs
  return { animation: `node-unravel-content ${contentFadeMs}ms ${delay}ms ease forwards` }
}

// Phase 9A.2: PortalTooltip removed in favour of the shared Tooltip primitive
// (src/components/Tooltip.jsx). StackBadge / GlobeBadge / EvidenceClip /
// ActionButton each wrap themselves in <Tooltip content=…> now.

// Phase 13.2 (#176): HealthBar = the SAT/UNSAT/MISSING minibar. `warn`
// stamps amber for MISSING; `ok` stamps green for SAT; `bad` stamps red
// for UNSAT. N/A is excluded from the data upstream (rollup helpers in
// v2_2Data.js drop na rows). Used on Claim, Eval Result, and PoE cards.
function HealthBar({ health, withLabels = false }) {
  const total = health.ok + health.warn + health.bad
  if (total === 0) return null
  const okPct = (health.ok / total) * 100
  const warnPct = (health.warn / total) * 100
  const badPct = (health.bad / total) * 100
  const bar = (
    <div style={{
      height: 3, borderRadius: 1.5, flex: 1,
      background: 'var(--border)',
      overflow: 'visible',
      display: 'flex',
      gap: 1,
    }}>
      {okPct > 0 && <div style={{ width: `${okPct}%`, background: 'var(--accent-green, #22c55e)', borderRadius: 1.5 }} />}
      {warnPct > 0 && <div style={{ width: `${warnPct}%`, minWidth: 3, background: 'var(--accent-amber, #f59e0b)', borderRadius: 1.5 }} />}
      {badPct > 0 && <div style={{ width: `${badPct}%`, minWidth: 3, background: 'var(--accent-red, #ef4444)', borderRadius: 1.5 }} />}
    </div>
  )
  if (!withLabels) return bar
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
      {bar}
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', gap: 3,
      }}>
        <span style={{ color: 'var(--accent-green)' }}>{health.ok}</span>
        {health.warn > 0 && (
          <>
            <span style={{ color: 'var(--text-dim)' }}>·</span>
            <span style={{ color: 'var(--accent-amber)' }}>{health.warn}</span>
          </>
        )}
        <span style={{ color: 'var(--text-dim)' }}>·</span>
        <span style={{ color: health.bad > 0 ? 'var(--accent-red)' : 'var(--text-dim)' }}>{health.bad}</span>
      </span>
    </div>
  )
}
// Phase 13.2 (#176): exported so the Detail Panel surfaces can render the
// same minibar primitive in their headers.
export { HealthBar }

function StackBadge({ count, categoryColor }) {
  const [hovered, setHovered] = useState(false)
  if (!count || count === 0) return null
  const tooltipText = `${count} associated asset${count === 1 ? '' : 's'} — evidence, evaluations, and linked records. Double-click or use the dive button to explore.`
  return (
    <Tooltip content={tooltipText} width={260}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          minWidth: 24,
          height: 20,
          padding: '0 6px',
          borderRadius: 6,
          background: 'var(--bg-surface)',
          border: hovered ? '1px solid var(--border-hover)' : '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'default',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-secondary)',
          fontWeight: 600,
          transition: 'color 120ms',
          lineHeight: 1,
        }}>
          {count}
        </span>
      </div>
    </Tooltip>
  )
}

function GlobeBadge() {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip content="Listed in Public Directory">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 24, height: 20, borderRadius: 6,
          background: hovered
            ? 'color-mix(in srgb, #38bdf8 12%, transparent)'
            : 'var(--bg-surface)',
          border: hovered
            ? '1px solid color-mix(in srgb, #38bdf8 30%, transparent)'
            : '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, cursor: 'default',
          transition: 'background 120ms, border-color 120ms',
        }}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="6" stroke={hovered ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="1.2" />
          <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke={hovered ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="0.9" />
          <line x1="2" y1="8" x2="14" y2="8" stroke={hovered ? '#38bdf8' : 'var(--text-dim)'} strokeWidth="0.9" />
        </svg>
      </div>
    </Tooltip>
  )
}

function EvidenceClip() {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip content="Has attached evidence">
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}
      >
        <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{
          opacity: hovered ? 0.8 : 0.5,
          transition: 'opacity 150ms',
        }}>
          <path d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5"
            stroke="var(--text-tertiary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </Tooltip>
  )
}

function ActionButton({ icon, tooltip, onClick, categoryColor }) {
  const [hovered, setHovered] = useState(false)
  return (
    <Tooltip content={tooltip}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          onClick={e => { e.stopPropagation(); onClick() }}
          onDoubleClick={e => e.stopPropagation()}
          style={{
            width: 24, height: 24,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: hovered ? 'var(--bg-raised)' : 'var(--bg-surface)',
            border: hovered ? '1px solid var(--border-hover)' : '1px solid var(--border)',
            borderRadius: 4,
            color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontSize: 12,
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
            fontFamily: 'var(--font-mono)',
            transition: 'background 100ms, color 100ms',
          }}
        >
          {icon}
        </button>
      </div>
    </Tooltip>
  )
}

function ActionBar({ onCreateAsset, onCreateSDA, onAddEvidence, onParseEvidence, onRunEvaluation, onAmendEval, onCreateClaim, onDive, onOpenSubgraph, onSurface, hasChildren, isAnchor, isChild, categoryColor, isParty }) {
  const buttons = []
  if (onCreateAsset) buttons.push({ icon: '+', tooltip: 'Connect Asset', onClick: onCreateAsset })
  if (onCreateSDA && !isParty) buttons.push({ icon: <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
    <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
  </svg>, tooltip: 'Publish this Asset', onClick: onCreateSDA })
  if (onAddEvidence) buttons.push({ icon: '◧', tooltip: 'Add Evidence', onClick: onAddEvidence })
  if (onCreateClaim) buttons.push({ icon: '◇', tooltip: 'Create Claim', onClick: onCreateClaim })
  if (onParseEvidence) buttons.push({ icon: '⊞', tooltip: 'Parse Evidence (PEP)', onClick: onParseEvidence })
  if (onRunEvaluation) buttons.push({ icon: '◆', tooltip: 'Run Evaluation', onClick: onRunEvaluation })
  if (onAmendEval) buttons.push({ icon: '◆', tooltip: 'Amend Evaluation', onClick: onAmendEval })
  if (isAnchor && onSurface) {
    buttons.push({ icon: '⊟', tooltip: 'Exit Layer', onClick: onSurface })
  } else if (hasChildren) {
    buttons.push({ icon: '⊞', tooltip: 'Dive into stack', onClick: onDive })
  }
  if (isChild && !isAnchor && onSurface) {
    buttons.push({ icon: '⊟', tooltip: 'Exit Layer', onClick: onSurface })
  }
  if (!isParty && onOpenSubgraph) buttons.push({ icon: '⛓', tooltip: 'View chain', onClick: onOpenSubgraph })

  return (
    <div style={{
      position: 'absolute',
      left: CARD_W + 6,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      animation: 'v2-action-slide 150ms ease',
    }}>
      <style>{`
        @keyframes v2-action-slide {
          from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
      {buttons.map((b, i) => (
        <ActionButton key={i} icon={b.icon} tooltip={b.tooltip} onClick={b.onClick} categoryColor={categoryColor} />
      ))}
    </div>
  )
}

function StackPeeks({ count, isHovered, categoryColor }) {
  if (count === 0) return null
  const peeks = Math.min(count, 2)
  const ease = 'cubic-bezier(0.2, 0, 0, 1)'

  return (
    <>
      {/* Peek 2 (furthest back) — renders first so it's behind peek 1 */}
      {peeks >= 2 && (
        <div style={{
          position: 'absolute',
          width: CARD_W,
          height: CARD_H,
          background: 'var(--bg-deep)',
          border: `1px solid ${isHovered ? 'var(--border-hover)' : 'color-mix(in srgb, var(--border) 80%, transparent)'}`,
          borderRadius: 8,
          top: isHovered ? 14 : 10,
          left: isHovered ? 12 : 8,
          zIndex: -2,
          transition: isHovered
            ? `left 200ms ${ease}, top 200ms ${ease}, border-color 150ms ease 80ms`
            : `left 200ms ${ease}, top 200ms ${ease}, border-color 100ms ease 0ms`,
        }} />
      )}
      {/* Peek 1 (closer) */}
      <div style={{
        position: 'absolute',
        width: CARD_W,
        height: CARD_H,
        background: 'var(--bg-deep)',
        border: `1px solid ${isHovered ? 'var(--border-hover)' : 'color-mix(in srgb, var(--border) 60%, transparent)'}`,
        borderRadius: 8,
        top: isHovered ? 7 : 5,
        left: isHovered ? 6 : 4,
        zIndex: -1,
        transition: isHovered
          ? `left 200ms ${ease}, top 200ms ${ease}, border-color 150ms ease 0ms`
          : `left 200ms ${ease}, top 200ms ${ease}, border-color 100ms ease 0ms`,
      }} />
    </>
  )
}

export default function AssetNode({
  node,
  isSelected,
  disclosureType,
  onSelect,
  onOpenSubgraph,
  onDive,
  onSurface,
  isAnchor = false,
  isChild = false,
  zoom = 1,
  scale = 1,
  onConnect,
  onDisclose,
  onAddEvidence,
  onParseEvidence,
  onRunEvaluation,
  onAmendEval,
  onCreateClaim,
  // Phase 9A item 9: single dispatch prop for V2.2 card-attached actions.
  // V2App routes action names ('requestAgreement' | 'parseEvidence' |
  // 'createClaim' | 'amendClaim' | 'selfEvaluate' | 'runEvaluation' |
  // 'reRunEvaluation') to the same handlers V22NodeDetailPanel's footer fires.
  onV22CardAction,
  activeParty,
  revealPhase,
}) {
  const [hovered, setHovered] = useState(false)
  const [flipMidpoint, setFlipMidpoint] = useState(false)
  const clickTimerRef = useRef(null)
  const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product
  const hasChildren = node.children && node.children.length > 0
  const childCount = hasChildren ? node.children.length : 0

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      if (hasChildren) {
        onDive?.(node)
      } else {
        onOpenSubgraph?.(node)
      }
      return
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      onSelect?.(node)
    }, CLICK_DELAY)
  }, [node, onSelect, onOpenSubgraph, onDive, hasChildren])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  const isOwnedByUser = !node.owner || node.owner === activeParty
  const isTerminalNode = node.isParse || node.category === 'parse' || node.isEvaluation || node.category === 'evaluation'
  const isProvisional = !!node.provisional || !!node._showAsProvisional
  const isDeclined = !!node._isDeclined
  const isRevoked = !!node._isRevoked
  // Phase 9D.2 (#124): unravel animation flag. When set, the card runs the
  // node-unravel keyframe (border + content fade + slight settle). Driven
  // by V2App's v22UnravelingNodeId state via v22DataWithReveal.
  const isUnraveling = !!node._unraveling
  const isNew = !!node._isNew

  // Reveal animation: swap provisional appearance at flip midpoint
  const isPostFlip = ['badge', 'panel', 'done'].includes(revealPhase)
  const isFlipping = revealPhase === 'flip'
  const showAsProvisional = isProvisional && !isPostFlip && !flipMidpoint

  useEffect(() => {
    if (revealPhase === 'flip') {
      const t = setTimeout(() => setFlipMidpoint(true), 315)
      return () => clearTimeout(t)
    }
    if (!revealPhase) setFlipMidpoint(false)
  }, [revealPhase])

  // ─── Phase 17.0.2: hoist `hoverSelectColor` ──────────────────────────
  // Phase 17.0.1 introduced the RFP early-return branch BELOW (line ~448)
  // but left the `hoverSelectColor` declaration in its Phase 16.2.11
  // position further down (just before the main `borderColor` chain). The
  // early-return reads `hoverSelectColor` for its inner-div border + outer
  // selection ring, which triggered a TDZ `ReferenceError: Cannot access
  // 'hoverSelectColor' before initialization` whenever `node.category ===
  // 'rfp'` (every RFP card at mid-LOD and full-LOD, every RFP hover, every
  // RFP click). Hoisting the declaration above the early-return is a
  // 3-line move with no semantic change for non-RFP renders — the value
  // depends only on `node.category`, which is always available at function
  // entry. Phase 16.2.11 + 17.0.1 commentary preserved below; the original
  // declaration site is removed to prevent a duplicate `const`.
  const hoverSelectColor = (node.category === 'claim' || node.category === 'rfp')
    ? 'var(--accent-amber, #C49A45)'
    : 'var(--accent-indigo)'

  // ─── Phase 17.0.1: RFP schema branch (minimal layout) ──────────────────
  // RFPs render as a fifth schema next to Asset / Claim / Eval Result / PoE.
  // Content per Andrew's spec: type pill + name + "Posted by {owner}". No
  // badges, no minibars, no action bar, no expand affordance, no dive hint.
  // Hover/select state uses the hoisted `hoverSelectColor` const above
  // (amber for rfp + claim; indigo for everything else). RFPs have no
  // disclosure type → the disclosure-type branches in `borderColor` fall
  // through cleanly to WARM_BORDER. handleClick is reused (RFPs have no
  // children so the double-click branch is a no-op).
  if (node.category === 'rfp') {
    const rfpName = node.name || node.rfp?.name || '—'
    const rfpOwner = node.ownerParty || node.rfp?.owner || node.owner || '—'
    // Phase 17.1: `node.isClosed` plumbed from DirectoryLayer's synthetic
    // node. When true, the card border renders dashed at every state
    // (default + hover + select) — signals "closed lifecycle state" while
    // still allowing the amber hover/select discrete state to read. The
    // outer selection ring also picks up the dashed treatment for
    // consistency.
    const rfpIsClosed = !!node.isClosed
    const rfpBorderStyle = rfpIsClosed ? 'dashed' : 'solid'
    // Phase 17.3.1 — Solicit CTA on RFP full-size cards. Active when the
    // synthetic node carries `_directorySolicitCandidate` (DirectoryLayer
    // resolves: non-owner + status === 'open' + no existing solicitation
    // from active actor). Click fires the action-dispatcher (parallel to
    // 17.3's Claim card pattern). Visible only when the card is hovered
    // or selected so the bar doesn't visually crowd un-attended cards.
    // Phase 17.3.2 — owner Close / Reopen CTAs on the RFP full-size card,
    // parity with the panel footer's Close/Reopen buttons. DirectoryLayer
    // stamps `_directoryCloseCandidate` (owner + open) or
    // `_directoryReopenCandidate` (owner + closed) — the two are mutually
    // exclusive so at most one button shows. Non-owner views see the
    // Solicit button instead via the existing marker. All three are
    // mutually exclusive per-actor-per-RFP.
    const rfpSolicitCandidate = !!node._directorySolicitCandidate
    const rfpCloseCandidate = !!node._directoryCloseCandidate
    const rfpReopenCandidate = !!node._directoryReopenCandidate
    // Phase 17.5.1.4 — owner Remove action, stamped only on closed-and-owned
    // RFPs (mutually exclusive with the Close candidate, parallel to Reopen).
    const rfpRemoveCandidate = !!node._directoryRemoveCandidate
    const rfpHasAnyAction = rfpSolicitCandidate || rfpCloseCandidate || rfpReopenCandidate || rfpRemoveCandidate
    const rfpShowActionBar = (isSelected || hovered) && rfpHasAnyAction && !!onV22CardAction
    return (
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          position: 'relative',
          width: CARD_W + ACTION_BAR_W,
          height: CARD_H,
          overflow: 'visible',
        }}
      >
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: -3, left: -3,
            width: CARD_W * scale + 6,
            height: CARD_H * scale + 6,
            borderRadius: (8 * scale) + 3,
            borderWidth: 2,
            borderStyle: rfpBorderStyle,
            borderColor: hoverSelectColor,
            transition: 'border-color 600ms ease',
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}
        <div
          onClick={handleClick}
          style={{
            width: CARD_W * scale,
            height: CARD_H * scale,
            background: hovered
              ? 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-amber, #C49A45))'
              : 'var(--bg-card)',
            borderWidth: 1,
            borderStyle: rfpBorderStyle,
            borderColor: (hovered || isSelected) ? hoverSelectColor : WARM_BORDER,
            borderRadius: 8 * scale,
            padding: `${9 * scale}px ${12 * scale}px`,
            cursor: 'pointer',
            position: 'relative',
            zIndex: 1,
            boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
            transition: 'border-color 120ms, box-shadow 120ms',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        >
          <div>
            <span style={{
              display: 'inline-block',
              fontSize: 9 * scale,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: 'var(--text-tertiary)',
              textTransform: 'uppercase',
              padding: '2px 6px',
              background: 'var(--bg-raised)',
              borderRadius: 3,
            }}>RFP</span>
            <div style={{
              fontSize: 13 * scale,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginTop: 6 * scale,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{rfpName}</div>
          </div>
          <div style={{
            fontSize: 11 * scale,
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            <span style={{ color: 'var(--text-dim)' }}>Posted by </span>
            <span style={{ color: 'var(--text-secondary)' }}>{rfpOwner}</span>
          </div>
        </div>
        {/* Phase 17.3.1 — Solicit-with-my-Claim action bar.
            Phase 17.3.2 — owner Close / Reopen buttons added in parallel.
            Mutual exclusion: a given (actor, RFP) pair can have at most
            one of (`_directorySolicitCandidate`, `_directoryCloseCandidate`,
            `_directoryReopenCandidate`) true. Rendered only on hover /
            select; click dispatches via `onV22CardAction` so V2App routes
            to the same handlers the panel footer fires. */}
        {rfpShowActionBar && (
          <div style={{
            position: 'absolute',
            left: CARD_W + 6,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            animation: 'v2-action-slide 150ms ease',
          }}>
            {rfpSolicitCandidate && (
              <ActionButton
                icon={(
                  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path
                      d="M14.5 1.5 L1.5 6.5 L6.5 8.5 L8.5 14.5 Z"
                      stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill="none"
                    />
                    <line x1="6.5" y1="8.5" x2="14.5" y2="1.5" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                )}
                tooltip="Solicit with my Claim"
                onClick={() => onV22CardAction?.('solicitWithClaim', node)}
                categoryColor={'var(--border-hover)'}
              />
            )}
            {rfpCloseCandidate && (
              <ActionButton
                icon={(
                  // Phase 17.3.2 — padlock (closed) icon for "Close this RFP".
                  // Matches the existing icon set's stroke weight (1.2) +
                  // 13×13 viewport rendered in a 16×16 viewBox.
                  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                    <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <path d="M5 7 L5 5 a3 3 0 0 1 6 0 L11 7" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
                tooltip="Close this RFP"
                onClick={() => onV22CardAction?.('closeRfp', node)}
                categoryColor={'var(--border-hover)'}
              />
            )}
            {rfpReopenCandidate && (
              <ActionButton
                icon={(
                  // Phase 17.3.2 — padlock-open icon for "Reopen this RFP".
                  // Same body as the closed lock; the shackle is rotated /
                  // open at the top to read as "unlocked".
                  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                    <rect x="3" y="7" width="10" height="7" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <path d="M5 7 L5 5 a3 3 0 0 1 5.4 -1.8" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
                  </svg>
                )}
                tooltip="Reopen this RFP"
                onClick={() => onV22CardAction?.('reopenRfp', node)}
                categoryColor={'var(--border-hover)'}
              />
            )}
            {rfpRemoveCandidate && (
              <ActionButton
                icon={(
                  // Phase 17.5.1.4 — trash-can icon for the irreversible
                  // "Remove RFP" action (closed-and-owned only). Distinct
                  // from the ✕ Cancel / ⊠ Dismiss glyphs.
                  <svg width={13} height={13} viewBox="0 0 16 16" fill="none" aria-hidden>
                    <path d="M3 4.5 H13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                    <path d="M6.5 4.5 V3 a1 1 0 0 1 1 -1 H8.5 a1 1 0 0 1 1 1 V4.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <path d="M4.5 4.5 L5 13 a1 1 0 0 0 1 1 H10 a1 1 0 0 0 1 -1 L11.5 4.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
                    <line x1="6.5" y1="6.5" x2="6.8" y2="12" stroke="currentColor" strokeWidth="1" />
                    <line x1="9.5" y1="6.5" x2="9.2" y2="12" stroke="currentColor" strokeWidth="1" />
                  </svg>
                )}
                tooltip="Remove this RFP"
                onClick={() => onV22CardAction?.('removeRfp', node)}
                categoryColor={'var(--accent-red)'}
              />
            )}
          </div>
        )}
      </div>
    )
  }

  // Only render the "+" Connect Asset action when an onConnect handler is
  // actually provided. In V2.2 mode V2App passes `onConnect={undefined}` so
  // the no-op console.log placeholder previously showed an inert button on
  // Asset cards (Phase 6.5 #7).
  const handleCreateAsset = (!node.isEvidence && !node.isClaim && !isTerminalNode && !isProvisional && isOwnedByUser && typeof onConnect === 'function')
    ? () => onConnect(node)
    : undefined
  const handleCreateSDA = (!node.isEvidence && !node.isClaim && !isTerminalNode && !isProvisional && isOwnedByUser) ? () => onDisclose?.(node) : undefined
  const handleAddEvidence = ((node.isClaim || node.category === 'claim') && !isProvisional && isOwnedByUser) ? () => onAddEvidence?.(node) : undefined
  const handleParseEvidence = (node.isEvidence && !isProvisional && isOwnedByUser && !isAnchor) ? () => onParseEvidence?.(node) : undefined
  const hasPepChildren = node.children?.some(c => c.isParse || c.category === 'parse')
  const handleRunEvaluation = ((node.isClaim || node.category === 'claim') && !isProvisional && node.category !== 'party' && onRunEvaluation) ? () => onRunEvaluation?.(node) : undefined
  const handleAmendEval = (node.isEvaluation && node.status !== 'superseded' && node.evaluatorParty === activeParty && node.disclosureType !== 'proofonly' && onAmendEval) ? () => onAmendEval?.(node) : undefined
  const handleCreateClaim = (node.isClaim || node.category === 'claim') ? undefined
    : (!node.isEvidence && !isTerminalNode && !isProvisional && isOwnedByUser && node.category !== 'party' && onCreateClaim)
      ? () => onCreateClaim?.(node) : undefined
  const handleDive = isProvisional ? undefined : () => onDive?.(node)

  const h = node.displayHealth || node.health
  const hasBadHealth = h && h.bad > 0
  // Phase 9A.1 item 4: bumped 22% → 40% indigo blend. The 22% baseline was
  // imperceptible in browser; 40% reads as a clear indigo-grey that stops
  // node terminations from fading into the dark canvas without competing
  // with edge indigo (edges render at full accent-indigo). Value is now a
  // module-level constant (WARM_BORDER) shared with the mini + dot cards
  // per Phase 9A.1.5 item 1.
  // Phase 16.2.10: new disclosure-type branch inserted between bad-health
  // and the WARM_BORDER fallback. Mirrors the AssetNodeMini chain so
  // mid-LOD and full-LOD render the same color signal.
  // Phase 16.2.11: hover/select color depends on node type. Claims keep
  // amber (distinguishes the discrete hover/select state from the
  // disclosure-type indigo/amber/green default). Non-Claim node types
  // (Actor, Asset, Eval Result, PoE) brighten to full indigo on hover
  // and select — keeps them visually indigo-themed throughout.
  // Phase 17.0.1: RFPs join the amber-on-hover/select branch. RFPs are
  // public-by-nature and carry no disclosure type, so the indigo accent
  // would clash with the WARM_BORDER default (which is itself a 40%
  // indigo blend). Amber on hover/select reads as a discrete state
  // change against the warm-grey default.
  // Phase 17.0.2: `hoverSelectColor` declaration hoisted above the RFP
  // early-return earlier in the function body — see the comment there
  // for the TDZ rationale.
  const borderColor = (isDeclined || isRevoked)
    ? 'var(--accent-red)'
    : isProvisional
    ? 'var(--text-dim)'
    : (hovered || isSelected)
      ? hoverSelectColor
      : hasBadHealth
        ? 'var(--accent-red)'
        : disclosureType === 'full' ? 'var(--accent-indigo)'
        : disclosureType === 'selective' ? 'var(--accent-amber)'
        : disclosureType === 'proofonly' ? 'var(--accent-green)'
        : WARM_BORDER

  // Phase 9A item 2: counterparty visual distinction. Pulled-in nodes owned
  // by a different party get a muted tint — same base bg-card, blended with a
  // small amount of the deep bg so the card reads darker/flatter without
  // introducing a new colour.
  const isCounterpartyNode = activeParty && node.owner && node.owner !== activeParty && node.category !== 'party'

  // Phase 9A item 5: edge-endpoint glow. `_isEdgeEndpoint` is set by the
  // canvas adapter for the two nodes touched by the selected edge. Distinct
  // from the selected-node amber border so users can tell "I selected this"
  // apart from "this is an endpoint of the selected edge".
  const isEdgeEndpoint = !!node._isEdgeEndpoint && !isSelected

  const showActionBar = isSelected || hovered

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: CARD_W + ACTION_BAR_W,
        height: CARD_H,
        overflow: 'visible',
      }}
    >
      {hasChildren && !isAnchor && !isProvisional && (
        <StackPeeks count={childCount} isHovered={hovered} categoryColor={'var(--border-hover)'} />
      )}

      {/* NEW badge */}
      {isNew && (
        <div style={{
          position: 'absolute',
          top: -8,
          right: -8 + ACTION_BAR_W,
          zIndex: 5,
          fontSize: 8,
          fontFamily: 'var(--font-mono)',
          fontWeight: 700,
          letterSpacing: '0.04em',
          color: '#fff',
          background: showAsProvisional ? 'var(--text-dim)' : 'var(--accent-green)',
          padding: '2px 7px',
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          pointerEvents: 'none',
          transition: 'background 300ms ease',
        }}>
          NEW
        </div>
      )}

      {/* Phase 14.3 (#176a): single rounded-rectangle chip container with
          hover fan-out + per-shield / +N tooltips. Position: top-right;
          when NEW is also present, container sits to the LEFT of NEW with
          a 6px gap (NEW pill is ~38px wide). */}
      {Array.isArray(node._activeBadges) && node._activeBadges.length > 0 && (() => {
        const NEW_PILL_W = isNew ? 38 : 0
        const rightOffset = -8 + ACTION_BAR_W + NEW_PILL_W + (isNew ? 6 : 0)
        return (
          <BadgeChipContainer
            badges={node._activeBadges}
            rightOffset={rightOffset}
            top={-8}
          />
        )
      })()}

      {/* Dive hint tooltip — shows when selected node has children */}
      {isSelected && !isAnchor && node.childCount > 0 && (
        <div style={{
          position: 'absolute',
          top: -50,
          left: CARD_W / 2,
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '5px 10px',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
          pointerEvents: 'none',
          boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          animation: 'diveHintIn 250ms ease-out forwards',
        }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
            {node.childCount} associated asset{node.childCount !== 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>
            Double-click to dive in
          </div>
        </div>
      )}

      {/* Selection border — sibling so it's unaffected by card flip animation.
          Phase 9E (#107): longhand border props (not `border` shorthand) so
          React's style reconciler doesn't flag a shorthand/longhand mix when
          transitioning `border-color`. */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -3, left: -3,
          width: CARD_W * scale + 6,
          height: CARD_H * scale + 6,
          borderRadius: (8 * scale) + 3,
          borderWidth: 2,
          borderStyle: 'solid',
          // Phase 16.2.11: non-Claim nodes use bright indigo for the
          // outer selection ring; Claims stay amber to match the inner
          // border hover/select rule.
          borderColor: showAsProvisional ? 'var(--text-dim)' : hoverSelectColor,
          transition: 'border-color 600ms ease',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}

      {/* Phase 9A.1 item 7 + Phase 9A.1.5 item 4: edge-endpoint indicator —
          vertical indigo line, 4px offset from the card, same height as
          the card. Renders on the INSIDE edge of the card — the side
          facing the other endpoint of the selected edge. V2App sets
          `_edgeEndpointSide` to 'left' or 'right' based on x-position
          comparison. Static, no pulse. Suppressed when the node is itself
          selected so the amber selection border wins. */}
      {isEdgeEndpoint && (() => {
        const side = node._edgeEndpointSide === 'left' ? 'left' : 'right'
        const horizStyle = side === 'left'
          ? { left: -7 }                        // 4px outside + 3px line width
          : { left: CARD_W * scale + 4 }
        return (
          <div style={{
            position: 'absolute',
            top: 0,
            width: 3,
            height: CARD_H * scale,
            background: 'var(--accent-indigo)',
            borderRadius: 1.5,
            pointerEvents: 'none',
            zIndex: 0,
            ...horizStyle,
          }} />
        )
      })()}

      <div
        onClick={handleClick}
        style={{
          width: CARD_W * scale,
          height: CARD_H * scale,
          // Phase 9D.1.3 Fix 5: revoked state gets an opaque red-tinted
          // surface, not the 60% opacity treatment used for purely provisional
          // cards. The revoked Claim is in a terminal state; fading it lets
          // underlying canvas content show through, which the zoomed-out
          // LODs make obvious. Red tint + full opacity reads as "frozen +
          // revoked" rather than "provisional + in-flight."
          // Phase 16.2.10: disclosure-type tint inserted ABOVE isCounterpartyNode
          // in the priority chain. Rationale: disclosure type is the more
          // specific signal (which-data-is-visible), counterparty is the
          // less-specific signal (whose-data-is-it). When both apply, disclosure
          // wins. Directory cards always carry disclosureType, so they always
          // land in this branch; parent canvas Claims that haven't opted in fall
          // through to isCounterpartyNode (unchanged).
          // Phase 16.2.11: hover background tint follows node type — Claims
          // use amber (matches inner border hover), non-Claims use indigo.
          background: isRevoked
            ? 'color-mix(in srgb, var(--bg-deep) 90%, var(--accent-red))'
            : showAsProvisional
              ? 'var(--bg-deep)'
              : isNew
                ? 'color-mix(in srgb, var(--bg-card) 85%, var(--accent-amber, #C49A45))'
                : hovered
                  ? (node.category === 'claim'
                    ? 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-amber, #C49A45))'
                    : 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-indigo))')
                  : disclosureType === 'full' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-indigo))'
                  : disclosureType === 'selective' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-amber))'
                  : disclosureType === 'proofonly' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-green))'
                  : isCounterpartyNode
                    // Phase 9A.1 item 5: stronger mix (82% → 55% bg-card) plus a
                    // subtle cooler shift via accent-blue so counterparty nodes
                    // read as noticeably not-mine at a glance.
                    ? 'color-mix(in srgb, color-mix(in srgb, var(--bg-card) 55%, var(--bg-deep)) 92%, var(--accent-blue, #38bdf8))'
                    : 'var(--bg-card)',
          // Phase 9E (#107): longhand border props (not `border` shorthand)
          // so React's style reconciler doesn't flag a shorthand/longhand mix
          // while transitioning `border-color`.
          borderWidth: 1,
          // Phase 12.2 (#122): OUTDATED Eval Results render with a dashed
          // amber border to read "needs attention" without reading "broken."
          // Distinct from PROVISIONAL (dashed grey) and REVOKED (solid red).
          borderStyle: (showAsProvisional || (node.isEvaluation && node.status === 'outdated')) ? 'dashed' : 'solid',
          // Phase 9D.2.1 Fix 3: while unraveling, hide the card's own border
          // so only the SVG overlay (Stage 2 erasure) reads.
          borderColor: isUnraveling
            ? 'transparent'
            : (node.isEvaluation && node.status === 'outdated' ? 'var(--accent-amber)' : borderColor),
          // Phase 9D.1.3 Fix 5: opaque for revoked; 0.6 only for still-
          // provisional (non-revoked, non-declined) cards.
          opacity: (showAsProvisional && !isRevoked) ? 0.6 : 1,
          borderRadius: 8 * scale,
          padding: `${9 * scale}px ${12 * scale}px`,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          // Phase 9A.1 item 7: endpoint indicator is now a dedicated vertical
          // line (rendered below) instead of a glow box-shadow. The old glow
          // washed into the edge's own selected-state brightening, making
          // both look wrong. `boxShadow` goes back to the plain hover lift.
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
          transition: 'border-color 120ms, box-shadow 120ms, opacity 300ms',
          // Phase 13.3 (Step 5): superseded Eval Result keeps the grayscale
          // filter for status differentiation but drops the 0.45 opacity
          // — the card background should stay opaque so the canvas grid
          // pattern doesn't show through. SUPERSEDED badge in Row 0 is the
          // primary status differentiator; minibar + text already render
          // dimmed via existing color choices.
          ...(node.isEvaluation && node.status === 'superseded' ? { filter: 'grayscale(60%)' } : {}),
          userSelect: 'none',
          WebkitUserSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          willChange: 'transform',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          // Phase 9D.2.1 Fix 3 (#124): staged unravel — Stage 4 (card bg +
          // translate) starts at 600ms relative to flag-set, after the
          // border erasure (SVG overlay) has mostly run. Stages 2 and 3
          // run as separate animations on the SVG and per-row spans
          // respectively. forwards keeps the final transparent state.
          // Phase 9D.2.2 Fix 3: durations from UNRAVEL_DURATIONS.
          ...(isUnraveling ? {
            animation: `node-unravel-card ${UNRAVEL_DURATIONS.cardFadeMs}ms ${UNRAVEL_DURATIONS.cardFadeDelayMs}ms ease-in-out forwards`,
            pointerEvents: 'none',
          } : {}),
          ...(isFlipping ? {
            animation: 'revealFlip 700ms ease-in-out forwards',
            transformOrigin: 'center center',
          } : {}),
        }}
      >
        {/* Phase 9D.2.1 Fix 3 (#124): SVG border-erasure overlay — Stage 2.
            Path traverses the card perimeter counter-clockwise from the
            top-right corner: top edge → top-left → left → bottom-left →
            bottom → bottom-right → right → close. Animating
            stroke-dashoffset 0 → +1000 (oversized vs. actual perimeter
            ~600) eats the dash from the path's start (top-right), going
            CCW. Card's own border is suppressed during the unravel via
            borderColor 'transparent' so the overlay reads cleanly. */}
        {isUnraveling && (() => {
          const W = CARD_W * scale
          const H = CARD_H * scale
          const R = 8 * scale
          // Path: M start, then CCW around the rect. Q = quadratic bezier
          // for rounded corners (close enough to a true arc at this radius).
          const d = `M ${W - R} 0
            L ${R} 0 Q 0 0 0 ${R}
            L 0 ${H - R} Q 0 ${H} ${R} ${H}
            L ${W - R} ${H} Q ${W} ${H} ${W} ${H - R}
            L ${W} ${R} Q ${W} 0 ${W - R} 0 Z`
          return (
            <svg
              width={W}
              height={H}
              viewBox={`0 0 ${W} ${H}`}
              style={{
                position: 'absolute',
                top: -1, left: -1,
                width: W + 2, height: H + 2,
                pointerEvents: 'none',
                zIndex: 2,
                overflow: 'visible',
              }}
              aria-hidden
            >
              <path
                d={d}
                fill="none"
                stroke="var(--accent-red)"
                strokeWidth="1.5"
                strokeDasharray="1000"
                strokeDashoffset="0"
                style={{
                  // Phase 9D.2.2 Fix 3: duration from UNRAVEL_DURATIONS.
                  animation: `node-unravel-border ${UNRAVEL_DURATIONS.borderMs}ms ease-out forwards`,
                }}
              />
            </svg>
          )
        })()}
        {/* Phase 9A item 4: wrapper is now flex column + space-between so
            the health minibar pins toward the bottom of the card and the
            whitespace equalises between the owner row and the card edge. */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          height: '100%',
          ...(isFlipping ? { animation: 'revealContentFade 700ms ease-in-out forwards' } : {}),
        }}>
        <div>
        {/* Row 0: V2.2 type label on its own line above the name (spec §3).
            Phase 9A.1 item 3: horizontal padding tightened to 4px; bottom
            margin bumped to 8px so name has clear breathing room.
            Phase 11E.1.5 Fix 1: REVOKED badge relocated here (was alongside
            the name in Row 1, where it crowded long node names). REVOKED
            is a lifecycle-state badge — per CLAUDE.md Code style, state
            badges render separately from the type label. */}
        {(node.v22Type || isRevoked) && (
          <div style={{
            marginBottom: 8, lineHeight: 1,
            display: 'flex', alignItems: 'center', gap: 4,
            ...unravelRowStyle(isUnraveling, 0),
          }}>
            {node.v22Type && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
                color: 'var(--text-tertiary)',
                background: 'var(--bg-raised)',
              }}>{node.v22Type}</span>
            )}
            {isRevoked && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
                color: 'var(--accent-red)',
                background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                flexShrink: 0,
              }}>REVOKED</span>
            )}
            {/* Phase 12.2 (#122): OUTDATED badge — Eval Result whose
                evidenceUsed has changed since the evaluation. Amber to read
                "needs attention" without reading "broken." Persists until
                re-run; dismissing the notification doesn't clear it. */}
            {node.isEvaluation && node.status === 'outdated' && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
                color: 'var(--accent-amber)',
                background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                border: '1px dashed color-mix(in srgb, var(--accent-amber) 50%, transparent)',
                flexShrink: 0,
              }}>OUTDATED</span>
            )}
          </div>
        )}
        {/* Row 1: name + status badges + stack badge.
            Phase 9A item 4: Claim and Eval Result names wrap to two lines
            (cap via -webkit-line-clamp) since they tend to be longer. Actor
            and Asset stay on one line with ellipsis. */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginBottom: 4,
          ...unravelRowStyle(isUnraveling, 1),
        }}>
          <div style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            // Phase 9A.1 item 1: all node types back to single-line ellipsis.
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name}
          </div>
          {/* Phase 9D.1.3 Fix 4: REVOKED outranks PROVISIONAL + DECLINED. */}
          {showAsProvisional && !isDeclined && !isRevoked && !node._pendingTransfer && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--text-dim)',
              background: 'color-mix(in srgb, var(--text-dim) 10%, transparent)',
              flexShrink: 0,
            }}>PROVISIONAL</span>
          )}
          {/* Phase 9A.4 Gate B: TRANSFERRING badge on the sender's Asset
              while a transfer is pending. Amber to match the provisional
              language used for Disclosure Agreements while keeping it
              distinct from the grey PROVISIONAL pill. */}
          {node._pendingTransfer && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--accent-amber)',
              background: 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
              flexShrink: 0,
            }}>TRANSFERRING</span>
          )}
          {node.isEvaluation && node.status === 'superseded' && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--text-dim)', background: 'var(--bg-raised)',
              flexShrink: 0,
            }}>SUPERSEDED</span>
          )}
          {/* Phase 9D.1.3 Fix 4: REVOKED outranks DECLINED.
              Phase 11E.1.5 Fix 1: REVOKED moved to Row 0 (header row);
              precedence preserved via the `!isRevoked` gate here. */}
          {isDeclined && !isRevoked && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--accent-red)',
              background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
              flexShrink: 0,
            }}>DECLINED</span>
          )}
          {!isAnchor && <StackBadge count={childCount} categoryColor={'var(--accent-amber)'} />}
        </div>

        {/* Row 2: owner + globe */}
        {(node.isEvaluation ? node.evaluatorParty : node.owner) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 4,
            ...unravelRowStyle(isUnraveling, 2),
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 11,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              flex: 1,
            }}>
              {node.isEvaluation ? node.evaluatorParty : node.owner}
            </span>
            {(node.sdas || []).some(s => s.party === 'Radiant Network') && <GlobeBadge />}
          </div>
        )}
        </div>

        {/* Row 3: health minibar (or provisional message). Phase 9A.1.5
            item 2: marginBottom on the minibar shifts it up from the
            inner-area bottom so the whitespace above (owner-row → minibar-
            top) and below (minibar-bottom → card bottom edge) reads as
            roughly symmetric. Empirically tuned in Chrome: with the 51px
            top group + 78px inner-area + 9px card padding-bottom, a
            marginBottom of 3 yields ~11px above / ~12px below — the
            minibar now sits visually centred in the lower half. */}
        {showAsProvisional ? (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: (isDeclined || isRevoked)
              ? 'var(--accent-red)'
              : node._pendingTransfer
                ? 'var(--accent-amber)'
                : 'var(--text-dim)',
            fontStyle: 'italic',
            marginBottom: 3,
            ...unravelRowStyle(isUnraveling, 3),
          }}>
            {isRevoked
              ? 'Disclosure revoked'
              : isDeclined
                ? 'Disclosure declined'
                : node._pendingTransfer
                  ? `Awaiting acceptance from ${node._pendingTransfer.toParty}`
                  : 'Awaiting disclosure from owner'}
          </div>
        ) : (() => {
          // Phase 13.2 (#176): minibar replaces the prior text aggregate on
          // Eval Result and PoE cards. SAT/UNSAT/MISSING only — N/A is
          // dropped from displays. The minibar is the same primitive used
          // for Claim cards, so the visual reads consistently across all
          // three artifact types. The "N RS" suffix is dropped.
          if (node.isPoe && node.poeAggregate) {
            const a = node.poeAggregate
            const dh = { ok: a.sat || 0, warn: a.missing || 0, bad: a.unsat || 0 }
            if (dh.ok + dh.warn + dh.bad === 0) return null
            return (
              <div style={{ display: 'flex', marginBottom: 3, ...unravelRowStyle(isUnraveling, 3) }}>
                <HealthBar health={dh} />
              </div>
            )
          }
          if (node.isEvaluation && node.evalAggregate) {
            const a = node.evalAggregate
            const dh = { ok: a.totalSat || 0, warn: a.totalMissing || 0, bad: a.totalUnsat || 0 }
            if (dh.ok + dh.warn + dh.bad === 0) return null
            return (
              <div style={{ display: 'flex', marginBottom: 3, ...unravelRowStyle(isUnraveling, 3) }}>
                <HealthBar health={dh} />
              </div>
            )
          }
          if (node.isEvidence || node.isParse || node.category === 'parse') return null
          const dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
          const total = dh.ok + (dh.warn || 0) + dh.bad
          if (total === 0) return null
          return (
            <div style={{ display: 'flex', marginBottom: 3, ...unravelRowStyle(isUnraveling, 3) }}>
              <HealthBar health={dh} />
            </div>
          )
        })()}
        </div>
      </div>

      {/* Phase 9A item 9: V2.2 nodes get a type-aware action bar that
          mirrors the Detail Panel footer one-to-one. The legacy V2.1
          ActionBar is retained for archived / non-V2.2 nodes (none in
          default mode post-Phase 8, but keeps the fallback intact for
          any future child-layer work). */}
      {showActionBar && (node.v22Type
        ? <V22ActionBar
            node={node}
            activeParty={activeParty}
            onV22CardAction={onV22CardAction}
            evaluationAgreementForActor={node._evaluationAgreementForActor}
            categoryColor={'var(--border-hover)'}
          />
        : <ActionBar
            onCreateAsset={handleCreateAsset}
            onCreateSDA={handleCreateSDA}
            onAddEvidence={handleAddEvidence}
            onParseEvidence={handleParseEvidence}
            onRunEvaluation={handleRunEvaluation}
            onAmendEval={handleAmendEval}
            onCreateClaim={handleCreateClaim}
            onDive={handleDive}
            onOpenSubgraph={onOpenSubgraph ? () => onOpenSubgraph(node) : undefined}
            onSurface={onSurface}
            hasChildren={hasChildren}
            isAnchor={isAnchor}
            isChild={isChild}
            categoryColor={'var(--border-hover)'}
            isParty={node.category === 'party'}
          />
      )}
    </div>
  )
}

// Phase 9A item 9 (extended Phase 9A.3): V2.2 action bar. Per-type button
// set matches V22NodeDetailPanel's footer exactly:
//   ACTOR (owner)        → Register Asset                                 (9A.3)
//   ASSET (owner)        → Request Agreement, Parse Evidence, Create Claim (9A.3)
//   CLAIM (owner)        → Amend Claim, Self-Evaluate
//   CLAIM (non-owner+EA) → Run Evaluation
//   EVAL RESULT (owner,  → Re-run Evaluation
//                 active)
//   PARSE RESULT         → no actions
function V22ActionBar({ node, activeParty, onV22CardAction, evaluationAgreementForActor, categoryColor }) {
  // For ACTOR nodes, `node.owner` is null (see actorToNode in v2_2Data.js).
  // The owner test is "this party equals the active party" — so we compare
  // the node's party name against the active party for ACTOR, and fall back
  // to node.owner for everything else.
  const isOwner = node.v22Type === 'ACTOR'
    ? node.name === activeParty && !node.isNetworkNode
    : (!node.owner || node.owner === activeParty)
  const fire = (action) => (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    onV22CardAction?.(action, node)
  }
  const buttons = []
  switch (node.v22Type) {
    case 'ACTOR':
      if (isOwner && onV22CardAction) {
        buttons.push({ icon: '＋', tooltip: 'Register Asset', onClick: fire('registerAsset') })
      }
      break
    case 'ASSET':
      if (isOwner && onV22CardAction) {
        // Phase 9A.4 Gate B: while a transfer is pending the owner can only
        // cancel it — the other actions would be ambiguous under a change
        // of ownership. Post-accept the Asset moves off this canvas entirely.
        if (node._pendingTransfer) {
          buttons.push({ icon: '✕', tooltip: 'Cancel Transfer', onClick: fire('cancelTransfer') })
        } else {
          // Phase 10.2: register child Asset under this Asset (matches the
          // ACTOR branch's "+" pattern — same icon, same dispatch verb).
          buttons.push({ icon: '＋', tooltip: 'Register Asset', onClick: fire('registerAsset') })
          buttons.push({ icon: '⤴', tooltip: 'Request Agreement', onClick: fire('requestAgreement') })
          buttons.push({ icon: '⊞', tooltip: 'Parse Evidence', onClick: fire('parseEvidence') })
          buttons.push({ icon: '◇', tooltip: 'Create Claim', onClick: fire('createClaim') })
          // Phase 17.5: Create RFP (between Create Claim and Transfer). Not
          // shown in the _pendingTransfer branch — posting an RFP while
          // ownership is in flight is inappropriate. Icon ⬚ matches
          // CATEGORY_CONFIG.rfp.icon, parallel to Create Claim's ◇.
          buttons.push({ icon: '⬚', tooltip: 'Create RFP', onClick: fire('createRfp') })
          buttons.push({ icon: '→', tooltip: 'Transfer', onClick: fire('transferAsset') })
        }
      }
      break
    case 'CLAIM': {
      const isProvisional = !!node.isProvisional
      const isDeclined = !!(node.isDeclined || node._isDeclined)
      // Phase 11D #136: provisional Claims show Cancel Request for the
      // requester (non-owner) — same intent as the Detail Panel footer's
      // Cancel Request CTA, surfaced inline so users don't have to open
      // the panel. Owner side of a provisional Claim isn't applicable
      // here: the responder doesn't see the provisional Claim on their
      // canvas; they get the v22-request notification instead.
      if (isProvisional && !isOwner && onV22CardAction) {
        buttons.push({ icon: '✕', tooltip: 'Cancel Request', onClick: fire('cancelRequest') })
      } else if (!isProvisional && !isDeclined && onV22CardAction) {
        if (isOwner) {
          buttons.push({ icon: '✎', tooltip: 'Amend Claim', onClick: fire('amendClaim') })
          buttons.push({ icon: '◆', tooltip: 'Self-Evaluate', onClick: fire('selfEvaluate') })
        } else if (evaluationAgreementForActor) {
          buttons.push({ icon: '◆', tooltip: 'Run Evaluation', onClick: fire('runEvaluation') })
        } else if (node._hasActiveDaWithoutEa) {
          // Phase 11C: warm-path "Request Evaluation Agreement" CTA. The
          // _hasActiveDaWithoutEa flag is stamped by V2App's
          // v22DataWithReveal memo so the action bar can decide without
          // re-deriving the DA/EA state.
          buttons.push({ icon: '▷', tooltip: 'Request Evaluation Agreement', onClick: fire('requestEvaluationAgreement') })
        } else if (node._directoryExistingEa) {
          // Phase 17.3 — Directory-layer Claim card CTA. When the synthetic
          // Claim node is stamped with an existing EA (resolved by V2App
          // via getActiveEaForClaimAndRequester), the card surfaces a View
          // EA action that mirrors the panel footer's button.
          buttons.push({ icon: '◉', tooltip: 'View Evaluation Agreement', onClick: fire('viewEvaluationAgreement') })
        } else if (node._directoryWarmPathRequestCandidate) {
          // Phase 17.4 — Directory warm-path Request EA CTA. Stamped when
          // an active DA exists (umbrella disclosure) but no EA. Mutually
          // exclusive with the cold-path candidate (no DA) + the View-EA
          // state (EA exists); checked BEFORE the cold-path so the more-
          // precise state wins per the brief's data-integrity rule. Click
          // dispatches a distinct action so V2App routes it to the
          // EARequestModal (DA exists — only the EA is requested) rather
          // than the cold-path AssetPickerModal → CombinedRequestModal.
          buttons.push({ icon: '▷', tooltip: 'Request Evaluation Agreement', onClick: fire('requestEvaluationAgreementWarmPath') })
        } else if (node._directoryRequestEaCandidate) {
          // Phase 17.3 — Directory cold-path Request EA CTA. Stamped on the
          // synthetic Claim node by V2App's Directory Claim-card render
          // path: non-owner viewing a Claim with no existing EA AND no DA.
          // Click fires the same handler as the panel footer (V2App routes
          // to AssetPickerModal → CombinedRequestModal).
          buttons.push({ icon: '▷', tooltip: 'Request Evaluation Agreement', onClick: fire('requestEvaluationAgreement') })
        }
        // Phase 14.2 (#169a): Issue Badge entry point on Claim cards.
        // Gate: any non-owner can issue (badges target Claims now). Visible
        // alongside any other non-owner actions (Run Evaluation, Request
        // Eval Agreement) — independent affordance.
        // Phase 14.6.2 Item 6: icon swapped from `★` to the canonical
        // BadgeShieldIcon so it matches the badge chip stack rendering.
        if (!isOwner) {
          buttons.push({ icon: <BadgeShieldIcon size={13} color="currentColor" />, tooltip: 'Issue Badge', onClick: fire('issueBadge') })
        }
      }
      break
    }
    case 'EVAL RESULT': {
      const isSuperseded = node.v22Artifact?.status === 'superseded'
      if (isOwner && !isSuperseded && onV22CardAction) {
        // Phase 13.1 (#168a): hide Re-Run when the Eval Result is in a
        // PoE-terminated chain.
        // Phase 13.3 (Step 2): also hide Re-Run when no new Assets exist
        // to evaluate. `_canRerun` is stamped by V2App's data adapter
        // based on `hasNewAssetsForRerun` against the Claim's current
        // in-scope Asset set. Detail Panel footer keeps Re-Run visible-
        // but-disabled with an explanatory tooltip in that case.
        if (!node._alreadyWrapped) {
          if (node._canRerun !== false) {
            buttons.push({ icon: '↻', tooltip: 'Re-run Evaluation', onClick: fire('reRunEvaluation') })
          }
          buttons.push({ icon: '◈', tooltip: 'Create Proof of Evaluation', onClick: fire('createPoE') })
        }
      }
      break
    }
    // PARSE RESULT, ACTOR intentionally have no card actions.
    case 'PROOF OF EVALUATION': {
      // Phase 14.2 (#169a): "Issue Badge" entry point on PoE node cards.
      // Gate: `activeParty !== claim.ownerParty`. The Claim owner is
      // stamped on the node as `_claimOwnerParty` by V2App's data adapter.
      // Falls back to `!isOwner` (PoE owner) when the stamp is absent —
      // safer-than-permissive default.
      if (onV22CardAction) {
        const claimOwnerParty = node._claimOwnerParty || null
        const blocked = claimOwnerParty
          ? activeParty === claimOwnerParty
          : isOwner   // fallback when stamp missing
        if (!blocked) {
          // Phase 14.6.2 Item 6: see Claim case above.
          buttons.push({ icon: <BadgeShieldIcon size={13} color="currentColor" />, tooltip: 'Issue Badge', onClick: fire('issueBadge') })
        }
      }
      break
    }
  }
  if (buttons.length === 0) return null
  return (
    <div style={{
      position: 'absolute',
      left: CARD_W + 6,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      animation: 'v2-action-slide 150ms ease',
    }}>
      {buttons.map((b, i) => (
        <ActionButton key={i} icon={b.icon} tooltip={b.tooltip} onClick={b.onClick} categoryColor={categoryColor} />
      ))}
    </div>
  )
}

// LOD dot: shown when zoom < LOD_THRESHOLD
// Hover shows full AssetNode card as tooltip via portal
export function AssetNodeDot({ node, isSelected, onSelect, onDive, onOpenSubgraph, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, onCreateClaim, onV22CardAction, activeParty }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)
  const dotRef = useRef(null)
  const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product

  const computeTooltipPos = useCallback((rect) => {
    const dotCenterY = rect.top + rect.height / 2
    const viewportW = typeof window !== 'undefined' ? window.innerWidth : 2000
    const cardTooltipW = CARD_W * 0.85 + 16
    const wouldClipRight = rect.right + 12 + cardTooltipW > viewportW - 16
    return {
      x: wouldClipRight ? rect.left - 12 : rect.right + 12,
      y: dotCenterY,
      anchor: wouldClipRight ? 'left' : 'right',
    }
  }, [])

  const handleMouseEnter = (e) => {
    setHovered(true)
    setTooltipPos(computeTooltipPos(e.currentTarget.getBoundingClientRect()))
  }

  // Track dot position with RAF while tooltip is visible (handles pan-to-center)
  useEffect(() => {
    if (!isSelected || !dotRef.current) return
    let rafId
    const track = () => {
      if (dotRef.current) {
        setTooltipPos(computeTooltipPos(dotRef.current.getBoundingClientRect()))
      }
      rafId = requestAnimationFrame(track)
    }
    rafId = requestAnimationFrame(track)
    return () => cancelAnimationFrame(rafId)
  }, [isSelected, computeTooltipPos])

  // Cleanup tooltip on unmount — prevents ghost tooltips during layer transitions
  useEffect(() => {
    return () => {
      setHovered(false)
      setTooltipPos(null)
    }
  }, [])

  const showTooltip = (hovered || isSelected) && tooltipPos

  return (
    <div
      ref={dotRef}
      onClick={e => { e.stopPropagation(); onSelect?.(node) }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); if (!isSelected) setTooltipPos(null) }}
      style={{
        width: 16,
        height: 16,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Phase 9A.2 item 2: dot-LOD edge-endpoint indicator — hollow indigo
          ring around the dot when _isEdgeEndpoint is set. Suppressed when
          the dot is itself selected (amber selection ring below wins).
          Phase 9A.3 backlog #62(a): ring was sized to the 16px wrapper, not
          the 8px inner dot (which sits with margin: 4). Ring now centres on
          the inner dot's centre (wrapper coords 8,8) with a 2px gap. */}
      {node._isEdgeEndpoint && !isSelected && (
        <div style={{
          position: 'absolute',
          width: 14,
          height: 14,
          borderRadius: '50%',
          border: '1.5px solid var(--accent-indigo)',
          boxSizing: 'border-box',
          top: 1,
          left: 1,
          pointerEvents: 'none',
        }} />
      )}
      {/* Phase 9A.1.5 item 1: dots get a stronger indigo ring than mini +
          full cards (which use WARM_BORDER at 40% indigo) so they remain
          clearly distinct from the background dot matrix at dot-LOD. Red
          UNSAT borders applied if the dot's node has bad health.
          Phase 9E-parallel.1 (#60): ring stroke 1 → 1.5px and indigo blend
          40 → 70% to make the dot pop against the full-brightness matrix. */}
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--text-tertiary)',
        margin: 4,
        border: `1.5px solid ${
          (node.displayHealth || node.health)?.bad > 0
            ? 'var(--accent-red)'
            : 'color-mix(in srgb, var(--accent-indigo) 70%, var(--border))'
        }`,
        boxSizing: 'border-box',
        position: 'relative',
      }}>
        {isSelected && (
          <div style={{
            position: 'absolute',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: 'color-mix(in srgb, var(--accent-amber, #C49A45) 18%, transparent)',
            border: '1.5px solid var(--accent-amber, #C49A45)',
            boxSizing: 'border-box',
            top: -6,
            left: -6,
          }} />
        )}
      </div>
      {showTooltip && createPortal(
        <div style={{
          position: 'fixed',
          // Phase 11D.4.1 W2: was 5000 — sat above the Detail Panel (zIndex
          // 200). At dot LOD when a node was selected and the user dragged
          // the canvas, the portal'd tooltip rendered ON TOP of the open
          // Detail Panel as the tooltip's screen position drifted into the
          // panel's footprint. Drop to 150 so it sits below the panel (200)
          // while still above the canvas itself (no zIndex) and edges.
          zIndex: 150,
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: tooltipPos.anchor === 'left'
            ? 'translate(-100%, -50%) scale(0.85)'
            : 'translateY(-50%) scale(0.85)',
          transformOrigin: tooltipPos.anchor === 'left' ? 'top right' : 'top left',
          pointerEvents: isSelected ? 'auto' : 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          borderRadius: 8,
        }}>
          <AssetNode
            node={node}
            isSelected={isSelected}
            zoom={1}
            scale={1}
            onDive={isSelected ? onDive : undefined}
            onOpenSubgraph={isSelected ? onOpenSubgraph : undefined}
            onConnect={isSelected ? onConnect : undefined}
            onDisclose={isSelected ? onDisclose : undefined}
            onAddEvidence={isSelected ? onAddEvidence : undefined}
            onParseEvidence={isSelected ? onParseEvidence : undefined}
            onRunEvaluation={isSelected ? onRunEvaluation : undefined}
            onCreateClaim={isSelected ? onCreateClaim : undefined}
            onV22CardAction={onV22CardAction}
            activeParty={activeParty}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Mid-LOD Mini Card ───
export function AssetNodeMini({ node, isSelected, disclosureType, onSelect, onDive, onOpenSubgraph, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, onCreateClaim, onV22CardAction, activeParty }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)
  const miniRef = useRef(null)
  const clickTimerRef = useRef(null)
  const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product
  const hasChildren = node.children && node.children.length > 0

  const isProvisional = !!node.provisional || !!node._showAsProvisional
  const isDeclined = !!node._isDeclined
  const isRevoked = !!node._isRevoked
  const isUnraveling = !!node._unraveling // Phase 9D.2 (#124)
  const h = node.displayHealth || node.health
  const hasBadHealth = h && h.bad > 0
  // Phase 9A.1.5 item 1: mini cards now use the same WARM_BORDER treatment
  // as full-size cards so node terminations don't fade into the canvas at
  // MID_LOD zoom.
  // Phase 16.2.10: new disclosure-type branch inserted between bad-health
  // and the WARM_BORDER fallback. When disclosureType is present and no
  // higher-priority state applies, the border color signals the
  // disclosure level visually. Color mapping matches the existing
  // disclosure-edge palette on parent canvas (indigo/amber/green for
  // full/selective/proofonly).
  // Phase 16.2.11: hover/select color depends on node type — Claims keep
  // amber, non-Claims brighten to indigo. Mirrors the full AssetNode chain.
  // Phase 17.0.1: RFPs join the amber branch (public-by-nature, no
  // disclosure type, so amber reads cleanly against WARM_BORDER default).
  const hoverSelectColor = (node.category === 'claim' || node.category === 'rfp')
    ? 'var(--accent-amber, #C49A45)'
    : 'var(--accent-indigo)'
  const borderColor = (isDeclined || isRevoked)
    ? 'var(--accent-red)'
    : isProvisional
    ? 'var(--text-dim)'
    : (hovered || isSelected)
      ? hoverSelectColor
      : hasBadHealth
        ? 'var(--accent-red)'
        : disclosureType === 'full' ? 'var(--accent-indigo)'
        : disclosureType === 'selective' ? 'var(--accent-amber)'
        : disclosureType === 'proofonly' ? 'var(--accent-green)'
        : WARM_BORDER

  const handleClick = useCallback((e) => {
    e.stopPropagation()
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current)
      clickTimerRef.current = null
      if (hasChildren) {
        onDive?.(node)
      } else {
        onOpenSubgraph?.(node)
      }
      return
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      onSelect?.(node)
    }, CLICK_DELAY)
  }, [node, onSelect, onOpenSubgraph, onDive, hasChildren])

  useEffect(() => {
    return () => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current)
    }
  }, [])

  const computeTooltipPos = useCallback((rect) => {
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }, [])

  const handleMouseEnter = (e) => {
    setHovered(true)
    setTooltipPos(computeTooltipPos(e.currentTarget.getBoundingClientRect()))
  }

  useEffect(() => {
    if (!isSelected || !miniRef.current) return
    let rafId
    const track = () => {
      if (miniRef.current) {
        setTooltipPos(computeTooltipPos(miniRef.current.getBoundingClientRect()))
      }
      rafId = requestAnimationFrame(track)
    }
    rafId = requestAnimationFrame(track)
    return () => cancelAnimationFrame(rafId)
  }, [isSelected, computeTooltipPos])

  useEffect(() => {
    return () => {
      setHovered(false)
      setTooltipPos(null)
    }
  }, [])

  const showTooltip = (hovered || isSelected) && tooltipPos

  // ─── Phase 17.0.1: RFP schema branch (minimal mini layout) ─────────────
  // Mini card content per Andrew's spec: type pill + name only — no owner
  // row, no minibar, no edge-endpoint indicator. Hover-preview portal is
  // reused via the same hovered/tooltipPos state; the portal renders the
  // full AssetNode preview, which itself takes the Phase 17.0.1 RFP
  // early-return (so the preview shows RFP / name / "Posted by {owner}").
  // Reuses handleClick + handleMouseEnter; no children → double-click
  // branch is a no-op for RFPs.
  if (node.category === 'rfp') {
    const rfpName = node.name || node.rfp?.name || '—'
    // Phase 17.1: mirror of the AssetNode (full) RFP branch — `isClosed`
    // drives a dashed border on the mini variant. Hover/select retains
    // dashed; only the color changes to amber.
    const rfpIsClosed = !!node.isClosed
    const rfpBorderStyle = rfpIsClosed ? 'dashed' : 'solid'
    return (
      <div
        ref={miniRef}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => { setHovered(false); if (!isSelected) setTooltipPos(null) }}
        style={{
          width: MINI_CARD_W,
          height: MINI_CARD_H,
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: -3, left: -3,
            width: MINI_CARD_W + 6,
            height: MINI_CARD_H + 6,
            borderRadius: 9,
            borderWidth: 2,
            borderStyle: rfpBorderStyle,
            borderColor: hoverSelectColor,
            pointerEvents: 'none',
            zIndex: 0,
          }} />
        )}
        <div style={{
          width: MINI_CARD_W,
          height: MINI_CARD_H,
          background: hovered
            ? 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-amber, #C49A45))'
            : 'var(--bg-card)',
          borderWidth: 1,
          borderStyle: rfpBorderStyle,
          borderColor: (hovered || isSelected) ? hoverSelectColor : WARM_BORDER,
          borderRadius: 6,
          padding: '4px 8px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: 1,
          boxShadow: hovered ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
          transition: 'border-color 120ms, box-shadow 120ms',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          position: 'relative',
          zIndex: 1,
        }}>
          <span style={{
            fontSize: 7,
            fontFamily: 'var(--font-mono)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-tertiary)',
            lineHeight: 1,
          }}>RFP</span>
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.2,
          }}>{rfpName}</span>
        </div>
        {showTooltip && createPortal(
          <div style={{
            position: 'fixed',
            zIndex: 150,
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: `translate(calc(-50% + ${(ACTION_BAR_W * 0.85) / 2}px), -50%) scale(0.85)`,
            transformOrigin: 'center center',
            pointerEvents: isSelected ? 'auto' : 'none',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            borderRadius: 8,
          }}>
            <AssetNode
              node={node}
              isSelected={isSelected}
              zoom={1}
              scale={1}
              activeParty={activeParty}
            />
          </div>,
          document.body
        )}
      </div>
    )
  }

  // Phase 9A.2 item 1: mini-LOD endpoint indicator. Same right/left-of-card
  // vertical indigo line as the full card, scaled for the smaller footprint.
  // Full card ships a 3px line with 4px offset against a 96px card; mini
  // card uses a 2px line with 3px offset against a 48px card so the visual
  // weight is proportional at the MID_LOD zoom range.
  const miniIsEdgeEndpoint = !!node._isEdgeEndpoint && !isSelected
  const miniEndpointSide = node._edgeEndpointSide === 'left' ? 'left' : 'right'
  const miniEndpointLineStyle = miniEndpointSide === 'left'
    ? { left: -5 }                                // 3px offset + 2px line width
    : { left: MINI_CARD_W + 3 }

  return (
    <div
      ref={miniRef}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); if (!isSelected) setTooltipPos(null) }}
      style={{
        width: MINI_CARD_W,
        height: MINI_CARD_H,
        position: 'relative',
        cursor: 'pointer',
      }}
    >
      {/* Phase 9A.2 item 1: mini-LOD edge-endpoint indicator. */}
      {miniIsEdgeEndpoint && (
        <div style={{
          position: 'absolute',
          top: 0,
          width: 2,
          height: MINI_CARD_H,
          background: 'var(--accent-indigo)',
          borderRadius: 1,
          pointerEvents: 'none',
          zIndex: 0,
          ...miniEndpointLineStyle,
        }} />
      )}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -3, left: -3,
          width: MINI_CARD_W + 6,
          height: MINI_CARD_H + 6,
          borderRadius: 9,
          // Phase 9E (#107): longhand border props to avoid shorthand/longhand mix.
          borderWidth: 2,
          borderStyle: 'solid',
          // Phase 16.2.11: non-Claim nodes use bright indigo for the outer
          // selection ring; Claims stay amber.
          borderColor: isProvisional ? 'var(--text-dim)' : hoverSelectColor,
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}
      <div style={{
        width: MINI_CARD_W,
        height: MINI_CARD_H,
        // Phase 9D.1.3 Fix 5: revoked cards at mini LOD get an opaque red-
        // tinted background + full opacity so cards/edges behind don't show
        // through at zoomed-out viewing. Keeps the dashed red border signal.
        // Phase 16.2.10: disclosure-type tint inserted as the new default
        // (replaces plain bg-card when disclosureType is present). 12%
        // color-mix with bg-card gives a subtle wash — visible but not
        // aggressive.
        // Phase 16.2.11: hover background tint follows node type — Claims
        // use amber, non-Claims use indigo.
        background: isRevoked
          ? 'color-mix(in srgb, var(--bg-card) 90%, var(--accent-red))'
          : hovered
            ? (node.category === 'claim'
              ? 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-amber, #C49A45))'
              : 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-indigo))')
            : disclosureType === 'full' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-indigo))'
            : disclosureType === 'selective' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-amber))'
            : disclosureType === 'proofonly' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-green))'
            : 'var(--bg-card)',
        // Phase 9E (#107): longhand border props to avoid shorthand/longhand mix.
        borderWidth: 1,
        borderStyle: isProvisional ? 'dashed' : 'solid',
        borderColor: borderColor,
        // Phase 9D.1.3 Fix 5: 0.6 opacity only for still-provisional (not
        // revoked) cards.
        opacity: (isProvisional && !isRevoked) ? 0.6 : 1,
        borderRadius: 6,
        padding: '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
        gap: 0,
        boxShadow: hovered ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
        transition: 'border-color 120ms, box-shadow 120ms, opacity 300ms',
        // Phase 13.3 (Step 5): same change as full-card LOD — drop the 0.45
        // outer-card opacity so superseded mini cards stay opaque against
        // the canvas grid. Grayscale filter preserves the status read.
        ...(node.isEvaluation && node.status === 'superseded' ? { filter: 'grayscale(60%)' } : {}),
        // Phase 9D.2 / 9D.2.1 (#124): unravel at mini LOD. Skips the
        // SVG border erasure + per-row stagger (those don't read at
        // zoomed-out scale); just runs the Stage-4 card fade so the
        // mini card disappears with the same timing as the full card.
        // Phase 9D.2.2 Fix 3: durations from UNRAVEL_DURATIONS.
        ...(isUnraveling ? {
          animation: `node-unravel-card ${UNRAVEL_DURATIONS.miniCardFadeMs}ms ${UNRAVEL_DURATIONS.miniCardFadeDelayMs}ms ease-in-out forwards`,
          pointerEvents: 'none',
        } : {}),
        userSelect: 'none',
        WebkitUserSelect: 'none',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Top half: title (v22Type on its own line above name when present) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1 }}>
          {node.v22Type && (
            <span style={{
              fontSize: 7, fontFamily: 'var(--font-mono)', fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--text-tertiary)',
              lineHeight: 1,
            }}>{node.v22Type}</span>
          )}
          <span style={{
            fontSize: 11, fontWeight: 600, color: 'var(--text-primary)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            fontFamily: 'var(--font-display)',
            lineHeight: 1.2,
          }}>{node.name}</span>
        </div>
        {/* Bottom half: minibar or empty space */}
        {/* Phase 13.2 (#176): minibar surfaces SAT/UNSAT/MISSING (green/
            red/amber). Eval Result and PoE cards now also render the
            minibar (was: text aggregate). */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 1 }}>
          {(() => {
            if (node.isEvidence || node.isParse || node.category === 'parse') return null
            let dh = null
            if (node.isPoe && node.poeAggregate) {
              const a = node.poeAggregate
              dh = { ok: a.sat || 0, warn: a.missing || 0, bad: a.unsat || 0 }
            } else if (node.isEvaluation && node.evalAggregate) {
              const a = node.evalAggregate
              dh = { ok: a.totalSat || 0, warn: a.totalMissing || 0, bad: a.totalUnsat || 0 }
            } else {
              dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
            }
            const total = dh.ok + (dh.warn || 0) + dh.bad
            if (total === 0) return null
            const okPct = (dh.ok / total) * 100
            const warnPct = (dh.warn / total) * 100
            const badPct = (dh.bad / total) * 100
            return (
              <div style={{
                height: 2, borderRadius: 1, width: '100%',
                background: 'var(--border)',
                display: 'flex', gap: 1, overflow: 'hidden',
              }}>
                {okPct > 0 && <div style={{ width: `${okPct}%`, background: 'var(--accent-green, #22c55e)', borderRadius: 1 }} />}
                {warnPct > 0 && <div style={{ width: `${warnPct}%`, minWidth: 2, background: 'var(--accent-amber, #f59e0b)', borderRadius: 1 }} />}
                {badPct > 0 && <div style={{ width: `${badPct}%`, minWidth: 2, background: 'var(--accent-red, #ef4444)', borderRadius: 1 }} />}
              </div>
            )
          })()}
        </div>
      </div>
      {showTooltip && createPortal(
        <div style={{
          position: 'fixed',
          // Phase 11D.4.1 W2: see AssetNodeDot tooltip — same fix at the
          // mini LOD. Drops portal tooltip below Detail Panel zIndex 200.
          zIndex: 150,
          left: tooltipPos.x,
          top: tooltipPos.y,
          // Phase 16.2.9 Item 2: shift the wrapper right by half of the
          // scaled ACTION_BAR_W so the VISIBLE card body (left CARD_W of
          // the CARD_W + ACTION_BAR_W = 244 px wrapper) centers on
          // `tooltipPos`, not the wrapper's geometric centre. Without
          // this shift, the visible body sits 14.45 px left of the
          // anchor — invisible on parent canvas at typical zooms (mini
          // card scales with zoom), but obvious on Directory at
          // unscaled 160 px mini-cards where the mini-card's amber
          // hover border peeks out on the right of the preview. The
          // translate is applied in post-scale visual px (the CSS
          // matrix combines scale + translate so the translate value
          // already reads as visual px), so the shift is
          // `(ACTION_BAR_W × 0.85) / 2 = 14.45 px`. Subtly improves
          // parent-canvas mini-LOD preview alignment too.
          transform: `translate(calc(-50% + ${(ACTION_BAR_W * 0.85) / 2}px), -50%) scale(0.85)`,
          transformOrigin: 'center center',
          pointerEvents: isSelected ? 'auto' : 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          borderRadius: 8,
        }}>
          <AssetNode
            node={node}
            isSelected={isSelected}
            zoom={1}
            scale={1}
            onDive={isSelected ? onDive : undefined}
            onOpenSubgraph={isSelected ? onOpenSubgraph : undefined}
            onConnect={isSelected ? onConnect : undefined}
            onDisclose={isSelected ? onDisclose : undefined}
            onAddEvidence={isSelected ? onAddEvidence : undefined}
            onParseEvidence={isSelected ? onParseEvidence : undefined}
            onRunEvaluation={isSelected ? onRunEvaluation : undefined}
            onCreateClaim={isSelected ? onCreateClaim : undefined}
            onV22CardAction={onV22CardAction}
            activeParty={activeParty}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export { CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H, CATEGORY_CONFIG }
