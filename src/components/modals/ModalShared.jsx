import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Tooltip from '../Tooltip'

/* ═══════════════════════════════════════════════════════════════════════
   SDA TYPE CONFIG
   ═══════════════════════════════════════════════════════════════════════ */
export const SDA_TYPES = {
  full: {
    c: '#7e8ef8', short: 'FULL', label: 'Full Disclosure',
    desc: 'Evaluators can extract data fields and run inference requirements against your evidence.',
    border: 'solid',
  },
  selective: {
    c: '#fbbf24', short: 'SELECTIVE', label: 'Selective Disclosure',
    desc: 'Evaluators can run inference requirements but cannot extract raw data from your evidence.',
    border: 'dashed',
  },
  proofonly: {
    c: '#36d49a', short: 'PROOF-ONLY', label: 'Proof-only Disclosure',
    desc: 'Shares the pass/fail result of a prior evaluation. No access to the evidence is granted, and no further evaluations can be run by other parties.',
    border: 'dotted',
  },
}

/* ═══════════════════════════════════════════════════════════════════════
   LAYOUT PRIMITIVES
   ═══════════════════════════════════════════════════════════════════════ */
export function Backdrop({ children, onClose }) {
  const mouseDownOnBackdrop = useRef(false)
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)

  const handleClose = useCallback(() => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    setTimeout(() => {
      onClose?.()
    }, 180)
  }, [onClose])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [handleClose])

  return createPortal(
    <div
      onMouseDown={e => {
        mouseDownOnBackdrop.current = (e.target === e.currentTarget)
      }}
      onClick={e => {
        if (e.target === e.currentTarget && mouseDownOnBackdrop.current) {
          handleClose()
        }
        mouseDownOnBackdrop.current = false
      }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10000,
        animation: closing ? 'fade-out 180ms ease forwards' : 'fade-in 200ms ease',
      }}
    >
      <style>{`@keyframes fade-in{from{opacity:0}to{opacity:1}} @keyframes fade-out{from{opacity:1}to{opacity:0}} @keyframes modal-up{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
      {children}
    </div>,
    document.body
  )
}

export function Modal({ children, width = 680 }) {
  return (
    <div style={{
      width, maxWidth: '94vw', maxHeight: '90vh',
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      animation: 'modal-up 250ms ease',
      boxShadow: '0 24px 80px rgba(0,0,0,.5)',
      textWrap: 'pretty',
    }}>
      {children}
    </div>
  )
}

export function ModalHeader({ title, subtitle, step, totalSteps, onClose }) {
  return (
    <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: subtitle ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{title}</span>
          {step != null && totalSteps && (
            <span style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
              padding: '3px 10px', background: 'var(--bg-raised)', borderRadius: 10,
            }}>Step {step} of {totalSteps}</span>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', fontSize: 16,
            color: 'var(--text-dim)', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 4, transition: 'color 150ms',
          }}
          onMouseEnter={e => e.target.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.target.style.color = 'var(--text-dim)'}
        >✕</button>
      </div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{subtitle}</div>}
    </div>
  )
}

export const ModalBody = React.forwardRef(function ModalBody({ children }, ref) {
  return <div ref={ref} style={{ flex: 1, overflow: 'auto', padding: '22px 28px' }}>{children}</div>
})

export function ModalFooter({ children }) {
  return (
    <div style={{
      padding: '18px 28px', borderTop: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: 0, background: 'var(--bg-card)',
    }}>
      {children}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════
   UI COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */
export function Btn({ label, onClick, accent, disabled, danger, purple, style: sx }) {
  const [h, sh] = useState(false)
  const baseC = purple ? 'var(--accent-purple, #a78bfa)' : accent ? 'var(--accent-indigo)' : danger ? 'var(--accent-red)' : null
  const bg = disabled ? 'transparent'
    : baseC ? (h ? `color-mix(in srgb, ${baseC} 85%, #fff)` : baseC)
    : h ? 'var(--bg-raised)' : 'transparent'
  const c = disabled ? 'var(--text-dim)'
    : baseC ? '#fff'
    : h ? 'var(--text-primary)' : 'var(--text-tertiary)'
  const bc = disabled ? 'var(--border)' : baseC || 'var(--border)'
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && sh(true)}
      onMouseLeave={() => sh(false)}
      style={{
        height: 38, padding: '0 20px', borderRadius: 6,
        border: `1px solid ${bc}`, background: bg, color: c,
        fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms', opacity: disabled ? 0.4 : 1,
        whiteSpace: 'nowrap',
        ...(sx || {}),
      }}
    >
      {label}
    </button>
  )
}

export function FieldLabel({ label, required }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
      {label}{required && <span style={{ color: 'var(--accent-red)', fontSize: 11 }}>*</span>}
    </div>
  )
}

export function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', minHeight: 32, borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 130, flexShrink: 0, fontSize: 11, color: 'var(--text-dim)', paddingLeft: 8 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
    </div>
  )
}

export function CopyBadge({ value, truncated }) {
  const [copied, setCopied] = useState(false)
  const display = truncated && value && value.length > 24
    ? value.slice(0, 10) + '...' + value.slice(-4)
    : value
  const copy = (e) => { e.stopPropagation(); navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1500) }
  return (
    <Tooltip content={copied ? 'Copied!' : 'Click to copy'} mono>
      <span data-badge-type={value?.startsWith?.('DOT-') ? 'dot' : undefined} onClick={copy} style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '3px 9px', borderRadius: 4,
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        fontFamily: 'var(--font-mono)', fontSize: 11,
        color: copied ? 'var(--accent-green)' : 'var(--text-dim)',
        cursor: 'pointer', transition: 'color 150ms', userSelect: 'none',
        whiteSpace: 'nowrap',
      }}>
        {copied ? '✓ Copied' : display}
      </span>
    </Tooltip>
  )
}

export function StepDots({ current, total }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: i === current ? 20 : 6, height: 6, borderRadius: 3,
          background: i === current ? 'var(--accent-indigo)' : i < current ? 'var(--accent-green)' : 'var(--border)',
          transition: 'all 200ms',
        }} />
      ))}
    </div>
  )
}

export function SDATypeCard({ type, selected, onSelect, disabled, disabledReason }) {
  const s = SDA_TYPES[type]
  if (!s) return null
  const active = selected === type
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={disabled ? undefined : () => onSelect(type)}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: '18px 16px', borderRadius: 8,
        border: `1.5px ${s.border} ${active ? s.c : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${s.c} 6%, transparent)` : hov ? 'var(--bg-raised)' : 'var(--bg-card)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: disabled ? 'var(--text-dim)' : active ? s.c : 'var(--text-dim)', transition: 'background 150ms' }} />
        <span style={{
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: disabled ? 'var(--text-dim)' : active ? s.c : hov ? 'var(--text-secondary)' : 'var(--text-tertiary)',
          letterSpacing: '0.03em', transition: 'color 150ms',
        }}>{s.short}</span>
      </div>
      <div style={{
        fontSize: 12, lineHeight: 1.65, transition: 'color 150ms',
        color: disabled ? 'var(--text-dim)' : active ? 'var(--text-secondary)' : hov ? 'var(--text-tertiary)' : 'var(--text-dim)',
      }}>{s.desc}</div>
      {disabled && disabledReason && (
        <div style={{
          marginTop: 12, padding: '10px 12px',
          background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
          borderRadius: 6,
        }}>
          <div style={{
            fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
            display: 'flex', alignItems: 'flex-start', gap: 6,
          }}>
            <span style={{ color: 'var(--accent-amber)', fontSize: 12, flexShrink: 0, marginTop: 1 }}>⚠</span>
            <div>
              <span>{disabledReason}</span>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: 'var(--accent-indigo)', cursor: 'pointer',
                  borderBottom: '1px solid transparent', transition: 'border-color 150ms',
                }}
                onMouseEnter={e => e.target.style.borderBottomColor = 'var(--accent-indigo)'}
                onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
                >
                  Run an evaluation →
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function DecisionCard({ id, label, desc, color, icon, disabled, active, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => !disabled && setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: 16, borderRadius: 8,
        border: `1.5px solid ${active ? color : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: active ? `color-mix(in srgb, ${color} 6%, transparent)` : hov ? 'var(--bg-raised)' : 'var(--bg-card)',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 150ms', textAlign: 'center',
        opacity: disabled ? 0.35 : 1,
      }}
    >
      <div style={{ fontSize: 20, marginBottom: 8, color: active ? color : hov ? 'var(--text-secondary)' : 'var(--text-dim)', transition: 'color 150ms' }}>{icon}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: active ? color : hov ? 'var(--text-secondary)' : 'var(--text-tertiary)', marginBottom: 4, transition: 'color 150ms' }}>{label}</div>
      <div style={{ fontSize: 11, color: active ? 'var(--text-tertiary)' : 'var(--text-dim)', lineHeight: 1.5 }}>{desc}</div>
    </div>
  )
}

export function ExpiryPicker({ expiry, setExpiry, customDate, setCustomDate }) {
  const opts = [
    { id: '1-year', label: '1 year', desc: 'Expires March 2027' },
    { id: '2-year', label: '2 years', desc: 'Expires March 2028' },
    { id: 'none', label: 'No expiry', desc: 'Active until manually revoked' },
    { id: 'custom', label: 'Custom date', desc: 'Set a specific expiration' },
  ]
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
        {opts.map(o => (
          <div key={o.id} onClick={() => setExpiry(o.id)} style={{
            padding: '14px 16px', borderRadius: 8,
            border: `1px solid ${expiry === o.id ? 'var(--accent-indigo)' : 'var(--border)'}`,
            background: expiry === o.id ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : 'var(--bg-card)',
            cursor: 'pointer', transition: 'all 150ms',
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: expiry === o.id ? 'var(--accent-indigo)' : 'var(--text-primary)', marginBottom: 3 }}>{o.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{o.desc}</div>
          </div>
        ))}
      </div>
      {expiry === 'custom' && (
        <div style={{ marginBottom: 18 }}>
          <input
            type="date" value={customDate} onChange={e => setCustomDate(e.target.value)}
            style={{
              width: '100%', height: 38, padding: '0 14px', borderRadius: 6,
              border: '1px solid var(--border)', background: 'var(--bg-card)',
              color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
            }}
          />
        </div>
      )}
    </>
  )
}

export function expiryLabel(expiry, customDate) {
  if (expiry === 'none') return 'No expiry'
  if (expiry === 'custom') return customDate || 'Not set'
  if (expiry === '1-year') return 'March 2027'
  return 'March 2028'
}

/* ═══════════════════════════════════════════════════════════════════════
   TOOLTIPS & SDA BADGES
   ═══════════════════════════════════════════════════════════════════════ */
export const SDA_TIPS = {
  full: 'Full Disclosure: evaluators can extract data fields and run inference requirements against the evidence.',
  selective: 'Selective Disclosure: evaluators can run inference requirements but cannot extract raw data from the evidence.',
  proofonly: 'Proof-only Disclosure: shares only the pass/fail result of a completed evaluation. No access to evidence is granted.',
  cascade: 'Cascade Disclosure: access through an intermediary. Permission is capped at the lower of the upstream and downstream agreements.',
}

export function Tip({ text, children }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)
  const [pos, setPos] = useState(null)
  const enter = () => {
    setShow(true)
    if (ref.current) {
      const r = ref.current.getBoundingClientRect()
      setPos({ x: r.left + r.width / 2, y: r.bottom + 6 })
    }
  }
  return (
    <span ref={ref} onMouseEnter={enter} onMouseLeave={() => setShow(false)} style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default' }}>
      {children}
      {show && pos && createPortal(
        <div style={{
          position: 'fixed', left: Math.max(8, pos.x - 140), top: pos.y,
          width: 280, padding: '10px 12px',
          background: 'var(--bg-card)', border: '1px solid var(--border-hover)',
          borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
          fontFamily: 'var(--font-display)',
          zIndex: 9999, boxShadow: '0 8px 24px rgba(0,0,0,.4)', pointerEvents: 'none',
        }}>{text}</div>,
        document.body
      )}
    </span>
  )
}

const SDA_BORDER_STYLES = { full: 'solid', selective: 'dashed', proofonly: 'dotted', cascade: 'dashed' }

export function SDABadge({ type, tip }) {
  const s = SDA_TYPES[type] || SDA_TYPES.full
  const c = s.c || '#7e8ef8'
  const label = s.short || 'FULL'
  const border = SDA_BORDER_STYLES[type] || 'solid'
  const badge = (
    <span style={{
      padding: '3px 8px', borderRadius: 4,
      fontSize: 10.5, fontFamily: 'var(--font-mono)', fontWeight: 600,
      background: `color-mix(in srgb, ${c} 10%, transparent)`,
      color: c,
      border: `1px ${border} color-mix(in srgb, ${c} 45%, transparent)`,
      whiteSpace: 'nowrap',
    }}>{label}</span>
  )
  return tip ? <Tip text={SDA_TIPS[type] || ''}>{badge}</Tip> : badge
}

export function LevelInline({ type, tip }) {
  const c = SDA_TYPES[type]?.c || '#7e8ef8'
  const label = SDA_TYPES[type]?.short || 'FULL'
  const el = (
    <span style={{
      fontFamily: 'var(--font-mono)', fontWeight: 600, color: c, fontSize: 12,
      borderBottom: tip ? `1px dashed color-mix(in srgb, ${c} 35%, transparent)` : 'none',
      cursor: tip ? 'default' : 'inherit',
    }}>{label}</span>
  )
  return tip ? <Tip text={SDA_TIPS[type] || ''}>{el}</Tip> : el
}

export function ChainIcon({ s = 14 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M6.5 9.5l3-3" stroke="var(--accent-purple, #a78bfa)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M9 7l2.5-2.5a1.5 1.5 0 00-2.12-2.12L7 4.75" stroke="var(--accent-purple, #a78bfa)" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M7 9l-2.5 2.5a1.5 1.5 0 002.12 2.12L9 11.25" stroke="var(--accent-purple, #a78bfa)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function ToggleCard({ selected, onClick, label, desc }) {
  const [hov, setHov] = useState(false)
  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: '14px 16px', borderRadius: 8, cursor: 'pointer',
        border: `1.5px solid ${selected ? 'var(--accent-indigo)' : hov ? 'var(--border-hover)' : 'var(--border)'}`,
        background: selected ? 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)' : hov ? 'var(--bg-raised)' : 'var(--bg-surface)',
        transition: 'all 150ms',
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: selected ? 'var(--accent-indigo)' : 'var(--text-dim)',
        }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: selected ? 'var(--accent-indigo)' : 'var(--text-tertiary)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>{desc}</div>
    </div>
  )
}

export function getEffectiveLevel(upstream, downstream) {
  const order = ['proofonly', 'selective', 'full']
  return order[Math.min(order.indexOf(upstream), order.indexOf(downstream))]
}

export function ConfidenceBadge({ level }) {
  const config = {
    high: { color: 'var(--accent-green)', label: 'HIGH' },
    medium: { color: 'var(--accent-amber)', label: 'MED' },
    low: { color: 'var(--accent-red)', label: 'LOW' },
  }
  const cfg = config[level] || config.medium
  return (
    <span style={{
      fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
      padding: '2px 6px', borderRadius: 3, color: cfg.color,
      background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
      border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`,
    }}>
      {cfg.label}
    </span>
  )
}
