import { useState, useRef, useCallback, useEffect } from 'react'
import { LABEL_W, ROW_H, MAX_ROWS } from './constants'
import { Tip } from './shared/Tooltip'
import { CheckIcon, XIcon } from './shared/StatPills'

function TruncCell({ text, bad, width }) {
  const ref = useRef(null)
  const [trunc, setTrunc] = useState(false)
  useEffect(() => {
    if (ref.current) setTrunc(ref.current.scrollWidth > ref.current.clientWidth)
  }, [text])
  const inner = (
    <div ref={ref} style={{
      width,
      flexShrink: 0,
      fontSize: 11,
      color: bad ? 'var(--accent-red)' : 'var(--text-primary)',
      paddingLeft: 8,
      display: 'flex',
      alignItems: 'center',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }}>
      {text}
    </div>
  )
  return trunc ? <Tip text={text} w={260}>{inner}</Tip> : inner
}

function ClaimCell({ output, type, bad }) {
  const ref = useRef(null)
  const [trunc, setTrunc] = useState(false)
  const typeLabel = type === 'inference' ? 'inference'
    : type === 'extraction' ? 'extraction'
    : type === 'inferred' ? 'inference'
    : type === 'direct' ? 'extraction'
    : type || 'extraction'
  const full = `${output} ${typeLabel}`
  useEffect(() => {
    if (ref.current) setTrunc(ref.current.scrollWidth > ref.current.clientWidth)
  }, [output, type])
  const inner = (
    <div ref={ref} style={{
      flex: 1,
      fontSize: 11,
      fontFamily: 'var(--font-mono)',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 10,
      borderLeft: '1px solid var(--border)',
      overflow: 'hidden',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        color: bad ? 'var(--accent-red)' : 'var(--text-primary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>
        {output}
      </span>
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>
        {typeLabel}
      </span>
    </div>
  )
  return trunc ? <Tip text={full} w={240}>{inner}</Tip> : inner
}

export default function ClaimsTable({ claims }) {
  const [focusIdx, setFocusIdx] = useState(-1)
  const scrollRef = useRef(null)

  const handleKey = useCallback(e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(p => Math.min(p + 1, claims.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setFocusIdx(p => Math.max(p - 1, 0)) }
    else if (e.key === 'Home') { e.preventDefault(); setFocusIdx(0) }
    else if (e.key === 'End') { e.preventDefault(); setFocusIdx(claims.length - 1) }
  }, [claims.length])

  useEffect(() => {
    if (focusIdx >= 0 && scrollRef.current) {
      const row = scrollRef.current.children[focusIdx]
      if (row) row.scrollIntoView({ block: 'nearest' })
    }
  }, [focusIdx])

  const maxH = ROW_H * MAX_ROWS
  const needsScroll = claims.length > MAX_ROWS

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKey}
      onFocus={() => { if (focusIdx < 0) setFocusIdx(0) }}
      onBlur={() => setFocusIdx(-1)}
      style={{
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: 'var(--bg-deep)',
        outline: 'none',
      }}
    >
      {/* Sticky header */}
      <div style={{
        display: 'flex',
        alignItems: 'stretch',
        height: 34,
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border)',
        position: 'sticky',
        top: 0,
        zIndex: 2,
      }}>
        <div style={{
          width: LABEL_W, flexShrink: 0, fontSize: 10.5, fontFamily: 'var(--font-mono)',
          fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em',
          paddingLeft: 8, display: 'flex', alignItems: 'center',
        }}>Requirement</div>
        <div style={{
          flex: 1, fontSize: 10.5, fontFamily: 'var(--font-mono)',
          fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em',
          paddingLeft: 10, borderLeft: '1px solid var(--border-hover)',
          display: 'flex', alignItems: 'center',
        }}>Claim</div>
        <div style={{
          width: 110, fontSize: 10.5, fontFamily: 'var(--font-mono)',
          fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.02em',
          paddingLeft: 10, borderLeft: '1px solid var(--border-hover)',
          display: 'flex', alignItems: 'center',
        }}>Result</div>
      </div>

      {/* Body */}
      <div ref={scrollRef} style={{ maxHeight: needsScroll ? maxH : 'none', overflowY: needsScroll ? 'auto' : 'visible' }}>
        {claims.map((c, i) => {
          const isGood = c.status === 'verified' || c.status === 'satisfactory'
          const isBad = c.status === 'contested' || c.status === 'failed' || c.status === 'unsatisfactory'
          const isMissing = c.status === 'missing'
          const focused = i === focusIdx
          return (
            <div key={i}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  minHeight: ROW_H,
                  borderBottom: (!isBad && i < claims.length - 1) ? '1px solid var(--border)' : 'none',
                  transition: 'background 100ms',
                  background: focused ? 'var(--bg-raised)' : 'transparent',
                  outline: focused ? '1px solid var(--border-hover)' : 'none',
                  outlineOffset: '-1px',
                }}
                onMouseEnter={e => { if (!focused) e.currentTarget.style.background = 'var(--bg-surface)' }}
                onMouseLeave={e => { if (!focused) e.currentTarget.style.background = 'transparent' }}
                onClick={() => setFocusIdx(i)}
              >
                <TruncCell text={c.requirement || c.label} bad={isBad} width={LABEL_W} />
                <ClaimCell output={c.output || c.humanValue || c.aiValue || '—'} type={c.type} bad={isBad} />
                <div style={{
                  width: 110, display: 'flex', alignItems: 'center', gap: 4,
                  paddingLeft: 10, borderLeft: '1px solid var(--border)',
                }}>
                  {isBad
                    ? <><XIcon s={11} /><span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)' }}>Unsatisfactory</span></>
                    : isMissing
                      ? <><span style={{ fontSize: 11, color: 'var(--text-dim)', flexShrink: 0 }}>?</span><span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>Missing</span></>
                      : <><CheckIcon s={11} /><span style={{ fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--accent-green)' }}>Satisfactory</span></>
                  }
                </div>
              </div>
              {isBad && c.dispute && (
                <div style={{
                  padding: '10px 14px 12px',
                  borderBottom: i < claims.length - 1 ? '1px solid var(--border)' : 'none',
                  background: 'color-mix(in srgb, var(--accent-red) 3%, transparent)',
                }}>
                  <div style={{ fontSize: 11, color: 'var(--accent-red)', fontFamily: 'var(--font-mono)' }}>
                    Disputed by {c.dispute.by} · {c.dispute.date}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                    {c.dispute.reason}
                  </div>
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                        color: 'var(--accent-red)', cursor: 'pointer',
                        borderBottom: '1px solid transparent', transition: 'border-color 150ms',
                      }}
                      onMouseEnter={e => e.target.style.borderBottomColor = 'var(--accent-red)'}
                      onMouseLeave={e => e.target.style.borderBottomColor = 'transparent'}
                    >
                      Review dispute →
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
