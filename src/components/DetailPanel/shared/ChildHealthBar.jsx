import { useState, useRef } from 'react'
import { TT } from './Tooltip'

function BarSeg({ pct, okPct, label, hasBad }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)
  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        width: `${pct}%`,
        minWidth: 10,
        height: 7,
        display: 'flex',
        gap: 2,
        cursor: 'default',
        flexShrink: 0,
      }}
    >
      {show && ref.current && <TT text={label} anchorRef={ref} w={220} />}
      <div style={{
        width: hasBad ? `${okPct}%` : '100%',
        minWidth: 2,
        height: '100%',
        background: 'var(--accent-green)',
        borderRadius: 3,
      }} />
      {hasBad && (
        <div style={{
          width: `${100 - okPct}%`,
          minWidth: 2,
          height: '100%',
          background: 'var(--accent-red)',
          borderRadius: 3,
        }} />
      )}
    </div>
  )
}

export default function ChildHealthBar({ children }) {
  const total = children.reduce((s, ch) => s + ch.health.ok + ch.health.bad, 0)
  if (!total) return null
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        letterSpacing: '0.04em',
        marginBottom: 6,
      }}>
        HEALTH BY CHILD
      </div>
      <div style={{
        display: 'flex',
        height: 7,
        borderRadius: 4,
        background: 'var(--border)',
        gap: 6,
        overflow: 'visible',
      }}>
        {children.map((ch, i) => {
          const ct = ch.health.ok + ch.health.bad
          if (!ct) return null
          const pct = (ct / total) * 100
          const okPct = ct > 0 ? (ch.health.ok / ct) * 100 : 0
          const label = `${ch.name}: ${ch.health.ok} verified${ch.health.bad > 0 ? ` · ${ch.health.bad} failed` : ''}`
          return <BarSeg key={i} pct={pct} okPct={okPct} label={label} hasBad={ch.health.bad > 0} />
        })}
      </div>
    </div>
  )
}
