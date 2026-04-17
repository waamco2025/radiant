import { useState } from 'react'
import { getObjectHealth, getEvalHealth, getArtifactSchema, actors } from './v3Data.js'

const CARD_W = 220
const CARD_H = 72
const MINI_CARD_W = 140
const MINI_CARD_H = 36

export { CARD_W, CARD_H, MINI_CARD_W, MINI_CARD_H }

function ActionButton({ label, tooltip, onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      title={tooltip}
      style={{
        width: 28, height: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: hovered ? 'var(--bg-raised)' : 'var(--bg-surface)',
        border: `1px solid ${hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        borderRadius: 4,
        color: hovered ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        fontWeight: 600,
        cursor: 'pointer',
        padding: 0,
        lineHeight: 1,
        transition: 'all 100ms',
      }}
    >
      {label}
    </button>
  )
}

function ActionBar({ onParse, onEvaluate, onDisclose }) {
  const buttons = []
  if (onParse) buttons.push({ label: 'P', tooltip: 'Parse', onClick: onParse })
  if (onEvaluate) buttons.push({ label: 'E', tooltip: 'Evaluate', onClick: onEvaluate })
  if (onDisclose) buttons.push({ label: 'D', tooltip: 'Disclose', onClick: onDisclose })
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
      animation: 'v3-action-slide 150ms ease',
      pointerEvents: 'auto',
    }}>
      <style>{`
        @keyframes v3-action-slide {
          from { opacity: 0; transform: translateY(-50%) translateX(-6px); }
          to { opacity: 1; transform: translateY(-50%) translateX(0); }
        }
      `}</style>
      {buttons.map((b, i) => (
        <ActionButton key={i} label={b.label} tooltip={b.tooltip} onClick={b.onClick} />
      ))}
    </div>
  )
}

function HealthMinibar({ health }) {
  if (!health) return null
  const { sat, unsat, total, missing } = health
  const miss = missing || 0
  const usat = unsat || 0
  const satPct = (sat / total) * 100
  const missPct = (miss / total) * 100
  const unsatPct = (usat / total) * 100

  return (
    <div style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 4, borderRadius: 2, background: 'var(--border)',
        overflow: 'hidden', display: 'flex',
      }}>
        {satPct > 0 && <div style={{ width: `${satPct}%`, background: 'var(--accent-green)', borderRadius: '2px 0 0 2px' }} />}
        {missPct > 0 && <div style={{ width: `${missPct}%`, background: 'var(--text-dim)' }} />}
        {unsatPct > 0 && <div style={{ width: `${unsatPct}%`, background: 'var(--accent-red)', borderRadius: '0 2px 2px 0' }} />}
      </div>
      <div style={{
        fontSize: 9, fontFamily: 'var(--font-mono)',
        display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0,
      }}>
        <span style={{ color: 'var(--accent-green)' }}>{sat}</span>
        <span style={{ color: 'var(--text-muted)' }}>·</span>
        {miss > 0 && (
          <>
            <span style={{ color: 'var(--text-dim)' }}>{miss}</span>
            <span style={{ color: 'var(--text-muted)' }}>·</span>
          </>
        )}
        <span style={{ color: usat > 0 ? 'var(--accent-red)' : 'var(--text-muted)' }}>{usat}</span>
      </div>
    </div>
  )
}

export function ObjectNodeFull({ obj, selected, onParse, onEvaluate, onDisclose }) {
  const [hovered, setHovered] = useState(false)
  const isProvisional = obj._pending || obj.provisional || obj._showAsProvisional
  const skipHealth = obj._noHealth || obj._pending
  const childHealth = skipHealth ? null : (obj._previewHealth || getObjectHealth(obj.id))
  const ownEvalHealth = skipHealth ? null : (getArtifactSchema(obj.artifact) === 'eval-output' ? getEvalHealth(obj.artifact) : null)
  const health = childHealth || ownEvalHealth
  const owner = actors.find(a => a.id === obj.owner)
  const showActions = !isProvisional && selected && (onParse || onEvaluate || onDisclose)

  return (
    <div style={{
      position: 'relative',
      width: CARD_W,
      overflow: 'visible',
      opacity: isProvisional ? 0.6 : 1,
      transition: 'opacity 300ms ease',
    }}>
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: CARD_W,
          height: CARD_H,
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: isProvisional ? 'var(--bg-deep, #0a0a0f)' : 'var(--bg-surface)',
          border: isProvisional
            ? '1.5px dashed #888'
            : `1px solid ${selected ? 'var(--accent-amber, #C49A45)' : hovered ? 'var(--border-hover)' : 'var(--border)'}`,
          borderRadius: 8,
          cursor: 'pointer',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
          boxShadow: isProvisional ? 'none' : selected
            ? '0 0 12px rgba(196, 154, 69, 0.15)'
            : hovered
              ? '0 2px 8px rgba(0,0,0,0.15)'
              : 'none',
          userSelect: 'none',
        }}>
        {/* Top: Name */}
        <div style={{
          fontSize: 13, fontWeight: 600,
          color: isProvisional ? 'var(--text-dim)' : 'var(--text-primary)',
          lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {obj.name}
        </div>

        {/* Middle: Health minibar or spacer */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {health ? <HealthMinibar health={health} /> : null}
        </div>

        {/* Bottom: Org + provisional label */}
        {owner && (
          <div style={{ fontSize: 10, color: isProvisional ? 'var(--text-muted)' : 'var(--text-secondary)' }}>
            {owner.org}
          </div>
        )}
        {isProvisional && (
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700, letterSpacing: '0.08em', color: '#888', marginTop: 4 }}>
            PROVISIONAL
          </div>
        )}
      </div>

      {showActions && (
        <ActionBar
          onParse={onParse}
          onEvaluate={onEvaluate}
          onDisclose={onDisclose}
        />
      )}
    </div>
  )
}

export function ObjectNodeMini({ obj, selected }) {
  const [hovered, setHovered] = useState(false)
  const isProvisional = obj._pending || obj.provisional || obj._showAsProvisional
  const childHealth = isProvisional ? null : getObjectHealth(obj.id)
  const ownEvalHealth = isProvisional ? null : (getArtifactSchema(obj.artifact) === 'eval-output' ? getEvalHealth(obj.artifact) : null)
  const health = childHealth || ownEvalHealth

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: MINI_CARD_W,
        height: MINI_CARD_H,
        padding: '5px 8px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        gap: 3,
        background: 'var(--bg-surface)',
        border: isProvisional
          ? '1px dashed #888'
          : `1px solid ${selected ? 'var(--accent-amber, #C49A45)' : hovered ? 'var(--border-hover)' : 'var(--border)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        userSelect: 'none',
        opacity: isProvisional ? 0.6 : 1,
      }}
    >
      <div style={{
        fontSize: 10, fontWeight: 600,
        color: isProvisional ? 'var(--text-dim)' : 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {obj.name}
      </div>
      {health && (
        <div style={{
          height: 3, borderRadius: 1.5, background: 'var(--border)',
          overflow: 'hidden', display: 'flex',
        }}>
          <div style={{ width: `${(health.sat / health.total) * 100}%`, background: 'var(--accent-green)' }} />
          {health.unsat > 0 && (
            <div style={{ width: `${(health.unsat / health.total) * 100}%`, background: 'var(--accent-red)' }} />
          )}
        </div>
      )}
    </div>
  )
}

export function ObjectNodeDot({ selected }) {
  return (
    <div style={{
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: selected ? 'var(--accent-amber, #C49A45)' : 'var(--text-tertiary)',
      transition: 'background 150ms ease',
      cursor: 'pointer',
    }} />
  )
}
