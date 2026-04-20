import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'

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
  evidence:   { icon: '◧', color: 'var(--accent-orange, #fb923c)', label: 'EVIDENCE' },
  parse:      { icon: '⊞', color: 'var(--accent-purple, #a78bfa)', label: 'PARSE' },
  evaluation: { icon: '✦', color: 'var(--accent-indigo, #7e8ef8)', label: 'EVALUATION' },
  claim:      { icon: '◇', color: 'var(--accent-teal, #2dd4bf)', label: 'CLAIM' },
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

// Portal tooltip: renders via createPortal to document.body with position:fixed
// Positioned to the RIGHT of the trigger by default, flips left if near viewport edge
function PortalTooltip({ text, x, y, anchor = 'right', maxWidth }) {
  if (!text || x == null || y == null) return null

  // Estimate tooltip width for flip check
  const estWidth = (typeof text === 'string' ? text.length * 6.5 : 80) + 20
  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 2000
  const wouldClipRight = anchor === 'right' && (x + 8 + estWidth > viewportW - 16)

  const effectiveAnchor = wouldClipRight ? 'left' : anchor

  const style = {
    position: 'fixed',
    zIndex: 5000,
    padding: '4px 8px',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    fontSize: 10,
    fontFamily: 'var(--font-mono)',
    color: 'var(--text-secondary)',
    pointerEvents: 'none',
    boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
    maxWidth: maxWidth || undefined,
    whiteSpace: maxWidth ? 'normal' : 'nowrap',
  }
  if (effectiveAnchor === 'above') {
    style.left = x
    style.top = y - 8
    style.transform = 'translate(-50%, -100%)'
  } else if (effectiveAnchor === 'left') {
    style.left = x - 8
    style.top = y
    style.transform = 'translate(-100%, -50%)'
  } else {
    // right (default)
    style.left = x + 8
    style.top = y
    style.transform = 'translateY(-50%)'
  }
  return createPortal(<div style={style}>{text}</div>, document.body)
}

function HealthBar({ health }) {
  const total = health.ok + health.warn + health.bad
  if (total === 0) return null
  const okPct = (health.ok / total) * 100
  const warnPct = (health.warn / total) * 100
  const badPct = (health.bad / total) * 100
  return (
    <div style={{
      height: 3, borderRadius: 1.5, flex: 1,
      background: 'var(--border)',
      overflow: 'visible',
      display: 'flex',
      gap: 1,
    }}>
      {okPct > 0 && <div style={{ width: `${okPct}%`, background: 'var(--accent-green, #22c55e)', borderRadius: 1.5 }} />}
      {warnPct > 0 && <div style={{ width: `${warnPct}%`, background: 'var(--text-dim)', borderRadius: 1.5 }} />}
      {badPct > 0 && <div style={{ width: `${badPct}%`, minWidth: 3, background: 'var(--accent-red, #ef4444)', borderRadius: 1.5 }} />}
    </div>
  )
}

function StackBadge({ count, categoryColor }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)

  if (!count || count === 0) return null

  const tooltipText = `${count} associated asset${count === 1 ? '' : 's'} — evidence, evaluations, and linked records. Double-click or use the dive button to explore.`

  const handleMouseEnter = (e) => {
    e.stopPropagation()
    setHovered(true)
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipPos(null) }}
      style={{
        minWidth: 24,
        height: 20,
        padding: '0 6px',
        borderRadius: 6,
        background: hovered ? 'var(--bg-surface)' : 'var(--bg-surface)',
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
        color: hovered ? 'var(--text-secondary)' : 'var(--text-secondary)',
        fontWeight: 600,
        transition: 'color 120ms',
        lineHeight: 1,
      }}>
        {count}
      </span>
      {hovered && tooltipPos && (
        <PortalTooltip text={tooltipText} x={tooltipPos.x} y={tooltipPos.y} anchor="above" maxWidth={260} />
      )}
    </div>
  )
}

function GlobeBadge() {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)

  const handleMouseEnter = (e) => {
    e.stopPropagation()
    setHovered(true)
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipPos(null) }}
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
      {hovered && tooltipPos && (
        <PortalTooltip text="Listed in Public Directory" x={tooltipPos.x} y={tooltipPos.y} anchor="above" />
      )}
    </div>
  )
}

function EvidenceClip() {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)
  return (
    <div
      onMouseEnter={(e) => {
        setHovered(true)
        const rect = e.currentTarget.getBoundingClientRect()
        setTooltipPos({ x: rect.left + rect.width / 2, y: rect.top })
      }}
      onMouseLeave={() => { setHovered(false); setTooltipPos(null) }}
      style={{ display: 'flex', alignItems: 'center', cursor: 'default' }}
    >
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" style={{
        opacity: hovered ? 0.8 : 0.5,
        transition: 'opacity 150ms',
      }}>
        <path d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5"
          stroke="var(--text-tertiary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {hovered && tooltipPos && (
        <PortalTooltip text="Has attached evidence" x={tooltipPos.x} y={tooltipPos.y} anchor="above" />
      )}
    </div>
  )
}

function ActionButton({ icon, tooltip, onClick, categoryColor }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)

  const handleMouseEnter = (e) => {
    setHovered(true)
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({ x: rect.right, y: rect.top + rect.height / 2 })
  }

  return (
    <div
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => { setHovered(false); setTooltipPos(null) }}
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
      {hovered && tooltipPos && (
        <PortalTooltip text={tooltip} x={tooltipPos.x} y={tooltipPos.y} anchor="right" />
      )}
    </div>
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
  // with edge indigo (edges render at full accent-indigo).
  const warmBorder = 'color-mix(in srgb, var(--accent-indigo) 40%, var(--border))'
  const borderColor = isDeclined
    ? 'var(--accent-red)'
    : isProvisional
    ? 'var(--text-dim)'
    : (hovered || isSelected)
      ? 'var(--accent-amber, #C49A45)'
      : hasBadHealth
        ? 'var(--accent-red)'
        : warmBorder

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

      {/* Selection border — sibling so it's unaffected by card flip animation */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: -3, left: -3,
          width: CARD_W * scale + 6,
          height: CARD_H * scale + 6,
          borderRadius: (8 * scale) + 3,
          border: `2px solid ${showAsProvisional ? 'var(--text-dim)' : 'var(--accent-amber, #C49A45)'}`,
          transition: 'border-color 600ms ease',
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}

      {/* Phase 9A.1 item 7: edge-endpoint indicator — right-side vertical
          indigo line, 4px offset from the card, same height as the card.
          Static, no pulse. Suppressed when the node is itself selected so
          the amber selection border wins and the two states stay visually
          distinct. */}
      {isEdgeEndpoint && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: CARD_W * scale + 4,
          width: 3,
          height: CARD_H * scale,
          background: 'var(--accent-indigo)',
          borderRadius: 1.5,
          pointerEvents: 'none',
          zIndex: 0,
        }} />
      )}

      <div
        onClick={handleClick}
        style={{
          width: CARD_W * scale,
          height: CARD_H * scale,
          background: showAsProvisional
            ? 'var(--bg-deep)'
            : isNew
              ? 'color-mix(in srgb, var(--bg-card) 85%, var(--accent-amber, #C49A45))'
              : hovered
                ? 'color-mix(in srgb, var(--bg-card) 92%, var(--accent-amber, #C49A45))'
                : isCounterpartyNode
                  // Phase 9A.1 item 5: stronger mix (82% → 55% bg-card) plus a
                  // subtle cooler shift via accent-blue so counterparty nodes
                  // read as noticeably not-mine at a glance.
                  ? 'color-mix(in srgb, color-mix(in srgb, var(--bg-card) 55%, var(--bg-deep)) 92%, var(--accent-blue, #38bdf8))'
                  : 'var(--bg-card)',
          border: `1px ${showAsProvisional ? 'dashed' : 'solid'} ${borderColor}`,
          opacity: showAsProvisional ? 0.6 : 1,
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
          ...(node.isEvaluation && node.status === 'superseded' ? { opacity: 0.45, filter: 'grayscale(60%)' } : {}),
          userSelect: 'none',
          WebkitUserSelect: 'none',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          willChange: 'transform',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          ...(isFlipping ? {
            animation: 'revealFlip 700ms ease-in-out forwards',
            transformOrigin: 'center center',
          } : {}),
        }}
      >
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
            margin bumped to 8px so name has clear breathing room. */}
        {node.v22Type && (
          <div style={{ marginBottom: 8, lineHeight: 1 }}>
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 4px', borderRadius: 3, letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              background: 'var(--bg-raised)',
            }}>{node.v22Type}</span>
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
          {showAsProvisional && !isDeclined && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--text-dim)',
              background: 'color-mix(in srgb, var(--text-dim) 10%, transparent)',
              flexShrink: 0,
            }}>PROVISIONAL</span>
          )}
          {node.isEvaluation && node.status === 'superseded' && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 4, letterSpacing: '0.04em',
              color: 'var(--text-dim)', background: 'var(--bg-raised)',
              flexShrink: 0,
            }}>SUPERSEDED</span>
          )}
          {isDeclined && (
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

        {/* Row 3: health minibar (or provisional message). Lives outside the
            top-content wrapper so flex:space-between on the parent pushes it
            to the bottom and centres the whitespace above it. */}
        {showAsProvisional ? (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: isDeclined ? 'var(--accent-red)' : 'var(--text-dim)',
            fontStyle: 'italic',
          }}>
            {isDeclined ? 'Disclosure declined' : 'Awaiting disclosure from owner'}
          </div>
        ) : (() => {
          if (node.isEvidence || node.isParse || node.category === 'parse') return null
          const dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
          const total = dh.ok + (dh.warn || 0) + dh.bad
          if (total === 0) return null
          return (
            <div style={{ display: 'flex' }}>
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

// Phase 9A item 9: V2.2 action bar. Per-type button set matches
// V22NodeDetailPanel's footer exactly:
//   ASSET (owner)        → Request Agreement, Parse Evidence, Create Claim
//   CLAIM (owner)        → Amend Claim, Self-Evaluate
//   CLAIM (non-owner+EA) → Run Evaluation
//   EVAL RESULT (owner,  → Re-run Evaluation
//                 active)
//   PARSE RESULT / ACTOR → no actions
function V22ActionBar({ node, activeParty, onV22CardAction, evaluationAgreementForActor, categoryColor }) {
  const isOwner = !node.owner || node.owner === activeParty
  const fire = (action) => (e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation()
    onV22CardAction?.(action, node)
  }
  const buttons = []
  switch (node.v22Type) {
    case 'ASSET':
      if (isOwner && onV22CardAction) {
        buttons.push({ icon: '⤴', tooltip: 'Request Agreement', onClick: fire('requestAgreement') })
        buttons.push({ icon: '⊞', tooltip: 'Parse Evidence', onClick: fire('parseEvidence') })
        buttons.push({ icon: '◇', tooltip: 'Create Claim (Phase 6+)', onClick: fire('createClaim') })
      }
      break
    case 'CLAIM': {
      const isProvisional = !!node.isProvisional
      const isDeclined = !!(node.isDeclined || node._isDeclined)
      if (!isProvisional && !isDeclined && onV22CardAction) {
        if (isOwner) {
          buttons.push({ icon: '✎', tooltip: 'Amend Claim', onClick: fire('amendClaim') })
          buttons.push({ icon: '◆', tooltip: 'Self-Evaluate', onClick: fire('selfEvaluate') })
        } else if (evaluationAgreementForActor) {
          buttons.push({ icon: '◆', tooltip: 'Run Evaluation', onClick: fire('runEvaluation') })
        }
      }
      break
    }
    case 'EVAL RESULT': {
      const isSuperseded = node.v22Artifact?.status === 'superseded'
      if (isOwner && !isSuperseded && onV22CardAction) {
        buttons.push({ icon: '↻', tooltip: 'Re-run Evaluation', onClick: fire('reRunEvaluation') })
      }
      break
    }
    // PARSE RESULT and ACTOR intentionally have no card actions — matches
    // the empty-footer state in V22NodeDetailPanel.
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
export function AssetNodeDot({ node, isSelected, onSelect, onDive, onOpenSubgraph, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, onCreateClaim, activeParty }) {
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
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: 'var(--text-tertiary)',
        margin: 4,
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
          zIndex: 5000,
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
            activeParty={activeParty}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Mid-LOD Mini Card ───
export function AssetNodeMini({ node, isSelected, onSelect, onDive, onOpenSubgraph, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, onCreateClaim, activeParty }) {
  const [hovered, setHovered] = useState(false)
  const [tooltipPos, setTooltipPos] = useState(null)
  const miniRef = useRef(null)
  const clickTimerRef = useRef(null)
  const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product
  const hasChildren = node.children && node.children.length > 0

  const isProvisional = !!node.provisional || !!node._showAsProvisional
  const isDeclined = !!node._isDeclined
  const h = node.displayHealth || node.health
  const hasBadHealth = h && h.bad > 0
  const borderColor = isDeclined
    ? 'var(--accent-red)'
    : isProvisional
    ? 'var(--text-dim)'
    : (hovered || isSelected)
      ? 'var(--accent-amber, #C49A45)'
      : hasBadHealth
        ? 'var(--accent-red)'
        : 'var(--border)'

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
          border: `2px solid ${isProvisional ? 'var(--text-dim)' : 'var(--accent-amber, #C49A45)'}`,
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
        border: `1px ${isProvisional ? 'dashed' : 'solid'} ${borderColor}`,
        opacity: isProvisional ? 0.6 : 1,
        borderRadius: 6,
        padding: '4px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
        gap: 0,
        boxShadow: hovered ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
        transition: 'border-color 120ms, box-shadow 120ms, opacity 300ms',
        ...(node.isEvaluation && node.status === 'superseded' ? { opacity: 0.45, filter: 'grayscale(60%)' } : {}),
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
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingTop: 1 }}>
          {(() => {
            if (node.isEvidence || node.isParse || node.category === 'parse') return null
            const dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
            const total = dh.ok + (dh.warn || 0) + dh.bad
            if (total === 0) return null
            const okPct = (dh.ok / total) * 100
            const badPct = (dh.bad / total) * 100
            return (
              <div style={{
                height: 2, borderRadius: 1, width: '100%',
                background: 'var(--border)',
                display: 'flex', gap: 1, overflow: 'hidden',
              }}>
                {okPct > 0 && <div style={{ width: `${okPct}%`, background: 'var(--accent-green, #22c55e)', borderRadius: 1 }} />}
                {badPct > 0 && <div style={{ width: `${badPct}%`, minWidth: 2, background: 'var(--accent-red, #ef4444)', borderRadius: 1 }} />}
              </div>
            )
          })()}
        </div>
      </div>
      {showTooltip && createPortal(
        <div style={{
          position: 'fixed',
          zIndex: 5000,
          left: tooltipPos.x,
          top: tooltipPos.y,
          transform: 'translate(-50%, -50%) scale(0.85)',
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
            activeParty={activeParty}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export { CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H, CATEGORY_CONFIG }
