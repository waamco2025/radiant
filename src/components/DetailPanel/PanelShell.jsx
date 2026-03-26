import { useState, useEffect } from 'react'
import { PANEL_W, GUTTER, BTN_H, CATEGORY_CONFIG } from './constants'
import HealthBar from './shared/HealthBar'
import CopyBadge from './shared/CopyBadge'
import { Tip } from './shared/Tooltip'

function ClipIcon({ s = 14, c = 'var(--text-secondary)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FooterBtn({ icon, label, onClick, disabled, btnId, hoveredId, onHover, showLabels }) {
  const isHovered = hoveredId === btnId
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && onHover?.(btnId)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        flex: showLabels ? 1 : (isHovered ? 'none' : 1),
        minWidth: showLabels ? 0 : (isHovered ? 'auto' : 0),
        height: BTN_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: '0 8px',
        borderRadius: 5,
        border: `1px solid ${isHovered && !disabled ? 'var(--border-hover)' : 'var(--border)'}`,
        background: isHovered && !disabled ? 'var(--bg-raised)' : 'transparent',
        color: disabled ? 'var(--text-dim)' : isHovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 500,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 180ms',
        opacity: disabled ? 0.3 : 1,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      <span style={{ flexShrink: 0, fontSize: 13, lineHeight: 1 }}>{icon}</span>
      <span style={{
        overflow: 'hidden',
        fontSize: 10,
        ...(showLabels
          ? { maxWidth: 120 }
          : { maxWidth: isHovered ? 120 : 0, transition: 'max-width 200ms ease' }
        ),
      }}>
        {label}
      </span>
    </button>
  )
}

export default function PanelShell({
  node, tabs, tab, setTab, summary, onClose,
  onClipClick, hasStack, hasParent, children,
  onViewChain, onExpandStack, onSurface, isAnchor, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, canEvaluate, isEvidence, isParse, isEvaluation, isOwner,
}) {
  const cat = CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product
  const [descExpanded, setDescExpanded] = useState(false)
  const [hoveredFooterBtn, setHoveredFooterBtn] = useState(null)
  useEffect(() => { setDescExpanded(false) }, [node.id])

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'var(--bg-card)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'var(--font-display)',
    }}>
      {/* Header */}
      <div style={{ padding: `${GUTTER}px ${GUTTER}px 16px`, flexShrink: 0 }}>
        {/* Category row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: cat.color }}>{cat.icon}</span>
          <span style={{
            fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 700,
            color: cat.color, letterSpacing: '0.08em',
          }}>{node.category.toUpperCase()}</span>
          <div style={{ flex: 1 }} />
          {node.hasEvidence && onClipClick && (
            <Tip text="View evidence details">
              <span
                onClick={onClipClick}
                style={{
                  cursor: 'pointer', display: 'inline-flex', padding: '2px 4px',
                  borderRadius: 4, transition: 'background 150ms',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <ClipIcon s={14} c="var(--text-secondary)" />
              </span>
            </Tip>
          )}
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 15,
              color: 'var(--text-tertiary)', cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4, transition: 'color 150ms',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
          >✕</button>
        </div>

        {/* Name + PIN */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{node.name}</span>
          <CopyBadge value={node.pin} truncated />
        </div>

        {/* Description */}
        {node.description && (
          <div onClick={() => setDescExpanded(prev => !prev)} style={{ marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: descExpanded ? 'unset' : 1, WebkitBoxOrient: 'vertical' }}>
              {node.description}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2, transition: 'transform 150ms', transform: descExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </div>
        )}

        {/* Owner + DOT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{node.owner}</span>
          <CopyBadge value={node.dot} />
        </div>

        {/* Health bar */}
        {!isParse && !isEvidence && (
          <HealthBar health={node.displayHealth || node.health} />
        )}

        {/* Summary */}
        {summary && (
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 8 }}>{summary}</div>
        )}
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div style={{ padding: `0 ${GUTTER}px 14px`, flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 4,
            background: 'var(--bg-surface)', borderRadius: 8,
            padding: 4, border: '1px solid var(--border)',
          }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 6, border: 'none',
                  cursor: 'pointer', fontSize: 11.5, fontFamily: 'var(--font-display)',
                  fontWeight: tab === t.id ? 600 : 400,
                  background: tab === t.id ? 'var(--accent-indigo)' : 'transparent',
                  color: tab === t.id ? '#fff' : 'var(--text-tertiary)',
                  transition: 'all 180ms',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: `14px ${GUTTER}px 28px`,
        borderTop: '1px solid var(--border)',
      }}>
        {children}
      </div>

      {/* Footer */}
      {(() => {
        let btnCount = 2 // layer + chain always present
        if (isOwner && !isEvidence && !isParse && !isEvaluation) btnCount += 3
        if (isOwner && isEvidence && !isEvaluation) btnCount += 1
        if (canEvaluate && !isEvaluation) btnCount += 1
        const showLabels = btnCount <= 3
        return (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: `12px ${GUTTER}px`,
            display: 'flex',
            gap: 6,
            flexShrink: 0,
            background: 'var(--bg-card)',
          }}>
            {isOwner && !isEvidence && !isParse && !isEvaluation && <FooterBtn icon="⇋" label="Disclose" onClick={onDisclose} btnId="disclose" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />}
            {isOwner && !isEvidence && !isParse && !isEvaluation && <FooterBtn icon="◧" label="Add Evidence" onClick={onAddEvidence} btnId="evidence" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />}
            {isOwner && !isEvidence && !isParse && !isEvaluation && <FooterBtn icon="+" label="Connect Asset" onClick={onConnect} btnId="connect" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />}
            {isOwner && isEvidence && !isEvaluation && <FooterBtn icon="⊞" label="Parse Evidence" onClick={onParseEvidence} btnId="parse" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />}
            {canEvaluate && !isEvaluation && <FooterBtn icon="◆" label="Run Evaluation" onClick={onRunEvaluation} btnId="evaluate" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />}
            <FooterBtn
              icon={isAnchor ? '⊟' : hasStack ? '⊞' : '⊟'}
              label={isAnchor ? 'Exit Layer' : hasStack ? 'Expand Stack' : hasParent ? 'Exit Layer' : 'Surface'}
              onClick={isAnchor ? onSurface : hasStack ? onExpandStack : onSurface}
              disabled={!isAnchor && !hasStack && !hasParent}
              btnId="layer" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels}
            />
            <FooterBtn icon="⛓" label="View Chain" onClick={onViewChain} btnId="chain" hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />
          </div>
        )
      })()}
    </div>
  )
}
