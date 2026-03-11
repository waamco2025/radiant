import { Tip } from './Tooltip'

function CheckIcon({ s = 11, c = 'var(--accent-green)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon({ s = 11, c = 'var(--accent-red)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M4.5 4.5L11.5 11.5M11.5 4.5L4.5 11.5" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export function SC({ n, label }) {
  if (!n) return null
  return (
    <Tip text={`${n} ${label || 'verified'}`}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 7px',
        borderRadius: 5,
        background: 'color-mix(in srgb, var(--accent-green) 8%, transparent)',
      }}>
        <CheckIcon />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-green)' }}>{n}</span>
      </span>
    </Tip>
  )
}

export function SX({ n, label }) {
  if (!n) return null
  return (
    <Tip text={`${n} ${label || 'failed'}`}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 7px',
        borderRadius: 5,
        background: 'color-mix(in srgb, var(--accent-red) 8%, transparent)',
      }}>
        <XIcon />
        <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--accent-red)' }}>{n}</span>
      </span>
    </Tip>
  )
}

export { CheckIcon, XIcon }
