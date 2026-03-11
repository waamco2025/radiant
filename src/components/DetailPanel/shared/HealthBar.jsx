import { useState, useRef } from 'react'
import { TT } from './Tooltip'

function Seg({ pct, color, label }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)
  return (
    <div
      ref={ref}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      style={{
        width: `${pct}%`,
        minWidth: 5,
        height: '100%',
        background: color,
        borderRadius: 2,
        cursor: 'default',
      }}
    >
      {show && ref.current && <TT text={label} anchorRef={ref} />}
    </div>
  )
}

export default function HealthBar({ health }) {
  const t = health.ok + health.bad
  if (!t) {
    return <div style={{ height: 7, borderRadius: 4, background: 'var(--border)', width: '100%' }} />
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
      <div style={{
        flex: 1,
        height: 7,
        borderRadius: 4,
        background: 'var(--border)',
        display: 'flex',
        gap: 2,
        overflow: 'visible',
      }}>
        {health.ok > 0 && <Seg pct={(health.ok / t) * 100} color="var(--accent-green)" label={`${health.ok} verified`} />}
        {health.bad > 0 && <Seg pct={(health.bad / t) * 100} color="var(--accent-red)" label={`${health.bad} failed`} />}
      </div>
    </div>
  )
}
