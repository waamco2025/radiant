import { useState, useEffect } from 'react'
import { PANEL_W, GUTTER, BTN_H } from './constants'
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
  onViewChain, onExpandStack, onSurface, isAnchor, onConnect, onDisclose, onAddEvidence, onParseEvidence, onRunEvaluation, canEvaluate, canAssetEvaluate, isEvidence, isParse, isEvaluation, isClaim, isOwner, onAmendEval, onCreateClaim, activeParty, depth,
}) {
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
        {/* Name + PIN + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', flex: 1 }}>{node.name}</span>
          {node._isNew && (
            <span style={{
              fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '2px 6px', borderRadius: 3,
              background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
              color: 'var(--accent-green)', flexShrink: 0,
            }}>NEW</span>
          )}
          <CopyBadge value={node.pin} truncated />
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: 15,
              color: 'var(--text-tertiary)', cursor: 'pointer',
              padding: '2px 4px', borderRadius: 4, transition: 'color 150ms',
              flexShrink: 0, marginLeft: 'auto',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--text-tertiary)'}
          >✕</button>
        </div>

        {/* Description */}
        {node.description && node.description.length > 60 && (
          <div onClick={() => setDescExpanded(prev => !prev)} style={{ marginBottom: 8, cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 4 }}>
            <span style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, flex: 1, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: descExpanded ? 'unset' : 1, WebkitBoxOrient: 'vertical' }}>
              {node.description}
            </span>
            <span style={{ fontSize: 20, color: 'var(--text-dim)', flexShrink: 0, marginTop: 2, transition: 'transform 150ms', transform: descExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
          </div>
        )}
        {node.description && node.description.length <= 60 && (
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5, marginBottom: 8 }}>
            {node.description}
          </div>
        )}

        {/* Owner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{node.owner}</span>
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
        const isChildLayer = isAnchor || depth > 0
        const buttons = []
        if (isOwner) {
          if (onCreateClaim) buttons.push({ icon: '+', label: 'Create Claim', onClick: onCreateClaim, id: 'claim' })
          if (onParseEvidence) buttons.push({ icon: '⊞', label: 'Parse', onClick: onParseEvidence, id: 'parse' })
          if (onRunEvaluation) buttons.push({ icon: '◆', label: 'Evaluate', onClick: onRunEvaluation, id: 'evaluate' })
          if (onDisclose) buttons.push({
            icon: <svg width={13} height={13} viewBox="0 0 16 16" fill="none" style={{ display: 'block' }}><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" /><ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="currentColor" strokeWidth="0.9" /><line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="0.9" /></svg>,
            label: 'Disclose',
            onClick: onDisclose,
            id: 'disclose',
          })
        } else {
          if (onRunEvaluation) buttons.push({ icon: '◆', label: 'Evaluate', onClick: onRunEvaluation, id: 'evaluate' })
        }
        if (isAnchor) buttons.push({ icon: '⊟', label: 'Exit Layer', onClick: onSurface, id: 'layer' })
        else if (hasStack) buttons.push({ icon: '⊞', label: 'Expand Stack', onClick: onExpandStack, id: 'layer' })
        else if (hasParent) buttons.push({ icon: '⊟', label: 'Exit Layer', onClick: onSurface, id: 'layer' })
        if (!isChildLayer) buttons.push({ icon: '⛓', label: 'View Chain', onClick: onViewChain, id: 'chain' })
        const showLabels = buttons.length <= 3
        return (
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: `12px ${GUTTER}px`,
            display: 'flex', gap: 6, flexShrink: 0, background: 'var(--bg-card)',
          }}>
            {buttons.map(b => (
              <FooterBtn key={b.id} icon={b.icon} label={b.label} onClick={b.onClick} disabled={b.disabled}
                btnId={b.id} hoveredId={hoveredFooterBtn} onHover={setHoveredFooterBtn} showLabels={showLabels} />
            ))}
          </div>
        )
      })()}
    </div>
  )
}
