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
}

const CARD_W = 210
const CARD_H = 86
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
    zIndex: 9999,
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
        minWidth: 20,
        height: 20,
        padding: '0 6px',
        borderRadius: 6,
        background: hovered ? 'var(--bg-surface)' : 'var(--bg-surface)',
        border: hovered
          ? `1px solid ${categoryColor}`
          : '1px solid var(--border)',
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
        color: hovered ? categoryColor : 'var(--text-secondary)',
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
          background: hovered
            ? (categoryColor ? `color-mix(in srgb, ${categoryColor} 15%, var(--bg-surface))` : 'var(--bg-hover, var(--bg-surface))')
            : 'var(--bg-surface)',
          border: hovered && categoryColor
            ? `1px solid color-mix(in srgb, ${categoryColor} 50%, var(--border))`
            : '1px solid var(--border)',
          borderRadius: 4,
          color: hovered ? (categoryColor || 'var(--text-primary)') : 'var(--text-secondary)',
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

function ActionBar({ onCreateAsset, onCreateSDA, onAddEvidence, onParseEvidence, onRunEvaluation, onDive, onOpenSubgraph, onSurface, hasChildren, isAnchor, isChild, categoryColor, isParty }) {
  const buttons = []
  if (onCreateAsset) buttons.push({ icon: '+', tooltip: 'Connect Asset', onClick: onCreateAsset })
  if (onCreateSDA && !isParty) buttons.push({ icon: <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}>
    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
    <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" />
    <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" />
  </svg>, tooltip: 'Publish this Asset', onClick: onCreateSDA })
  if (onAddEvidence) buttons.push({ icon: '◧', tooltip: 'Add Evidence', onClick: onAddEvidence })
  if (onParseEvidence) buttons.push({ icon: '⊞', tooltip: 'Parse Evidence (PEP)', onClick: onParseEvidence })
  if (onRunEvaluation) buttons.push({ icon: '◆', tooltip: 'Run Evaluation', onClick: onRunEvaluation })
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
          border: `1px solid ${isHovered
            ? `color-mix(in srgb, ${categoryColor} 30%, var(--border))`
            : 'color-mix(in srgb, var(--border) 80%, transparent)'}`,
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
        border: `1px solid ${isHovered
          ? `color-mix(in srgb, ${categoryColor} 50%, var(--border))`
          : 'color-mix(in srgb, var(--border) 60%, transparent)'}`,
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
  const handleCreateAsset = (!node.isEvidence && !isTerminalNode && !isProvisional && isOwnedByUser) ? () => onConnect ? onConnect(node) : console.log('Create associated asset for', node.id) : undefined
  const handleCreateSDA = (!node.isEvidence && !isTerminalNode && !isProvisional && isOwnedByUser) ? () => onDisclose?.(node) : undefined
  const handleAddEvidence = (!node.isEvidence && !isTerminalNode && !isProvisional && isOwnedByUser) ? () => onAddEvidence?.(node) : undefined
  const handleParseEvidence = (node.isEvidence && !isProvisional && isOwnedByUser && !isAnchor) ? () => onParseEvidence?.(node) : undefined
  const hasPepChildren = node.children?.some(c => c.isParse || c.category === 'parse')
  const handleRunEvaluation = (node.isEvidence && node._isParsed && !isProvisional && onRunEvaluation) ? () => onRunEvaluation?.(node) : undefined
  const handleDive = isProvisional ? undefined : () => onDive?.(node)

  const borderColor = isDeclined
    ? 'var(--accent-red)'
    : isProvisional
    ? 'var(--text-dim)'
    : (hovered || isSelected)
      ? cat.color
      : `color-mix(in srgb, ${cat.color} 27%, transparent)`

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
        <StackPeeks count={childCount} isHovered={hovered} categoryColor={cat.color} />
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
          border: `2px solid ${showAsProvisional ? 'var(--text-dim)' : cat.color}`,
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
          background: showAsProvisional
            ? 'var(--bg-deep)'
            : isNew
              ? `color-mix(in srgb, var(--bg-card) 85%, ${cat.color})`
              : hovered
                ? `color-mix(in srgb, var(--bg-card) 90%, ${cat.color})`
                : `color-mix(in srgb, var(--bg-card) 95%, ${cat.color})`,
          border: `1px ${showAsProvisional ? 'dashed' : 'solid'} ${borderColor}`,
          opacity: showAsProvisional ? 0.6 : 1,
          borderRadius: 8 * scale,
          padding: `${9 * scale}px ${12 * scale}px`,
          cursor: 'pointer',
          position: 'relative',
          zIndex: 1,
          boxShadow: hovered ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
          transition: 'border-color 120ms, box-shadow 120ms, opacity 300ms',
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
        <div style={isFlipping ? { animation: 'revealContentFade 700ms ease-in-out forwards' } : undefined}>
        {/* Row 1: category + stack badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: cat.color,
            letterSpacing: '0.06em',
          }}>
            <span style={{
              position: 'relative',
              top: -1,
              fontSize: 8,
            }}>{cat.icon}</span>
            {cat.label}
            {showAsProvisional && !isDeclined && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 4,
                letterSpacing: '0.04em',
                color: 'var(--text-dim)',
                background: 'color-mix(in srgb, var(--text-dim) 10%, transparent)',
              }}>
                PROVISIONAL
              </span>
            )}
            {isDeclined && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 4,
                letterSpacing: '0.04em',
                color: 'var(--accent-red)',
                background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
              }}>
                DECLINED
              </span>
            )}
            {node.isEvidence && (
              <span style={{
                fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '2px 6px', borderRadius: 4,
                letterSpacing: '0.04em',
                color: node._isParsed ? 'var(--accent-purple, #a78bfa)' : 'var(--accent-amber)',
                background: node._isParsed
                  ? 'color-mix(in srgb, var(--accent-purple, #a78bfa) 10%, transparent)'
                  : 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
              }}>
                {node._isParsed ? 'PARSED' : 'UNPARSED'}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {node.hasEvidence && <EvidenceClip />}
            {(node.sdas || []).some(s => s.party === 'Radiant Network') && <GlobeBadge />}
            {!isAnchor && <StackBadge count={childCount} categoryColor={cat.color} />}
          </div>
        </div>

        {/* Row 2: name — wrapper protects descenders from overflow:hidden clipping */}
        <div style={{ paddingBottom: 2 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {node.name}
          </div>
        </div>

        {/* Row 3: owner */}
        {(node.isEvaluation ? node.evaluatorParty : node.owner) && (
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            color: 'var(--text-tertiary)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            lineHeight: 1.2,
            marginBottom: 0,
          }}>
            {node.isEvaluation ? node.evaluatorParty : node.owner}
          </div>
        )}

        {/* Row 4: health bar + claim count (or provisional message) */}
        {showAsProvisional ? (
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 9,
            color: isDeclined ? 'var(--accent-red)' : 'var(--text-dim)',
            fontStyle: 'italic',
          }}>
            {isDeclined ? 'Disclosure declined' : 'Awaiting owner response'}
          </div>
        ) : (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <HealthBar health={node.displayHealth || node.health} />
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-tertiary)',
              whiteSpace: 'nowrap',
            }}>
              {(() => {
                if (node.isEvidence) return null
                if (node.isParse || node.category === 'parse') {
                  const fc = node.parsedFields?.length || 0
                  return `${fc} fields`
                }
                const dh = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
                const dc = dh.ok + (dh.warn || 0) + dh.bad
                return dh.bad > 0
                  ? `${dh.ok} · ${dh.bad}`
                  : dc > 0
                    ? `${dc} claims`
                    : null
              })()}
            </span>
          </div>
        )}
        </div>
      </div>

      {showActionBar && (
        <ActionBar
          onCreateAsset={handleCreateAsset}
          onCreateSDA={handleCreateSDA}
          onAddEvidence={handleAddEvidence}
          onParseEvidence={handleParseEvidence}
          onRunEvaluation={handleRunEvaluation}
          onDive={handleDive}
          onOpenSubgraph={onOpenSubgraph ? () => onOpenSubgraph(node) : undefined}
          onSurface={onSurface}
          hasChildren={hasChildren}
          isAnchor={isAnchor}
          isChild={isChild}
          categoryColor={cat.color}
          isParty={node.category === 'party'}
        />
      )}
    </div>
  )
}

// LOD dot: shown when zoom < LOD_THRESHOLD
// Hover shows full AssetNode card as tooltip via portal
export function AssetNodeDot({ node, isSelected, onSelect, onDive, onOpenSubgraph, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, activeParty }) {
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
        background: cat.color,
        margin: 4,
        position: 'relative',
      }}>
        {isSelected && (
          <div style={{
            position: 'absolute',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: `color-mix(in srgb, ${cat.color} 18%, transparent)`,
            border: `1.5px solid ${cat.color}`,
            boxSizing: 'border-box',
            top: -6,
            left: -6,
          }} />
        )}
      </div>
      {showTooltip && createPortal(
        <div style={{
          position: 'fixed',
          zIndex: 9999,
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
            activeParty={activeParty}
          />
        </div>,
        document.body
      )}
    </div>
  )
}

export { CARD_W, CARD_H, CATEGORY_CONFIG }
