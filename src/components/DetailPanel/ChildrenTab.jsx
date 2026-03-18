import { useState } from 'react'
import { LABEL_W, CATEGORY_CONFIG } from './constants'
import ChildHealthBar from './shared/ChildHealthBar'
import GridRow from './shared/GridRow'
import CopyBadge from './shared/CopyBadge'
import { SC, SX } from './shared/StatPills'
import { Tip } from './shared/Tooltip'

function ClipIcon({ s = 13, c = 'var(--text-tertiary)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChainIcon({ s = 13, c = 'var(--accent-purple)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.5 9.5l3-3" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 7l2.5-2.5a1.5 1.5 0 00-2.12-2.12L7 4.75" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 9l-2.5 2.5a1.5 1.5 0 002.12 2.12L9 11.25" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

function Chev({ open }) {
  return (
    <span style={{
      fontSize: 11, color: 'var(--text-tertiary)',
      transition: 'transform 180ms ease',
      transform: open ? 'rotate(90deg)' : 'rotate(0)',
      display: 'inline-block', marginLeft: 2,
    }}>▸</span>
  )
}

function TinyBtn({ icon, tip, onClick }) {
  return (
    <Tip text={tip}>
      <span
        onClick={e => { e.stopPropagation(); onClick && onClick() }}
        style={{
          fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
          cursor: 'pointer', padding: '2px 6px', borderRadius: 4,
          transition: 'color 150ms, background 150ms',
        }}
        onMouseEnter={e => { e.target.style.color = 'var(--text-primary)'; e.target.style.background = 'var(--bg-raised)' }}
        onMouseLeave={e => { e.target.style.color = 'var(--text-tertiary)'; e.target.style.background = 'transparent' }}
      >
        {icon}
      </span>
    </Tip>
  )
}

export default function ChildrenTab({ children, parentOwner, onViewChild }) {
  const [exp, setExp] = useState(() => {
    const o = {}
    children.forEach((_, i) => { o[i] = i === 0 })
    return o
  })

  const expandAll = () => {
    const o = {}
    children.forEach((_, i) => { o[i] = true })
    setExp(o)
  }

  const collapseAll = () => {
    const o = {}
    children.forEach((_, i) => { o[i] = false })
    setExp(o)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.7, flex: 1 }}>Child assets of this node.</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TinyBtn icon="⊞" tip="Expand all" onClick={expandAll} />
          <TinyBtn icon="⊟" tip="Collapse all" onClick={collapseAll} />
        </div>
      </div>

      <ChildHealthBar children={children} />

      {children.map((ch, i) => {
        const cat = CATEGORY_CONFIG[ch.category] || CATEGORY_CONFIG.product
        const o = exp[i]
        const diffOwner = ch.owner !== parentOwner
        return (
          <div key={i} style={{
            background: 'var(--bg-surface)',
            borderRadius: 8,
            border: '1px solid var(--border)',
            marginBottom: 10,
          }}>
            {/* Header */}
            <div
              onClick={() => setExp(p => ({ ...p, [i]: !p[i] }))}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 14px', cursor: 'pointer',
                borderRadius: o ? '8px 8px 0 0' : '8px',
                background: o ? 'var(--bg-raised)' : 'transparent',
                transition: 'background 150ms',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Tip text={cat.tipText || cat.label}><span style={{ fontSize: 12, color: cat.color }}>{cat.icon}</span></Tip>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ch.name}</span>
                {ch.hasEvidence && <Tip text="Has attached evidence"><ClipIcon s={13} c="var(--text-tertiary)" /></Tip>}
                {ch.isCascade && <Tip text="Received via cascade disclosure"><ChainIcon s={13} c="var(--accent-purple)" /></Tip>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <SC n={ch.health.ok} label="verified" />
                {ch.health.bad > 0 && <SX n={ch.health.bad} label="failed" />}
                <Chev open={o} />
              </div>
            </div>

            {/* Body */}
            {o && (
              <div style={{ padding: '6px 14px 16px' }}>
                <GridRow label="PIN" value={<CopyBadge value={ch.pin} truncated />} />
                {/* Owner row — stacked name + DOT */}
                <GridRow label="Owner" value={
                  <span style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                    color: diffOwner ? 'var(--accent-amber)' : 'var(--text-secondary)',
                  }}>{ch.owner}</span>
                } />
                {ch.category !== 'parse' && !ch.isParse && (
                  <>
                    <GridRow label="Last eval" value={ch.lastEval || 'None'} />
                    <GridRow label="Claims" value={ch.health.ok + ch.health.bad > 0 ? `${ch.health.ok + ch.health.bad}` : '—'} />
                  </>
                )}
                {(ch.isParse || ch.category === 'parse') && ch.parsedFields?.length > 0 && (
                  <GridRow label="Parsed fields" value={`${ch.parsedFields.length} fields`} />
                )}
                {ch.childCount > 0 && <GridRow label="Children" value={`${ch.childCount} sub-assets`} />}
                {ch.isCascade && <GridRow label="Via" value={<span style={{ color: 'var(--accent-purple)' }}>{ch.cascadeVia}</span>} />}
                <div style={{ marginTop: 12 }}>
                  <span
                    onClick={() => onViewChild && onViewChild(ch)}
                    style={{
                      fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                      color: 'var(--accent-indigo)', cursor: 'pointer',
                      borderBottom: '1px solid transparent', transition: 'border-color 150ms',
                    }}
                    onMouseEnter={e => e.target.style.borderBottomColor = 'var(--accent-indigo)'}
                    onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
                  >
                    View Asset Details →
                  </span>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
