import { useState } from 'react'
import { BTN_H } from './constants'
import DataTable from './shared/DataTable'
import { Tip } from './shared/Tooltip'

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

function Badge({ text, color, tooltip }) {
  const inner = (
    <span style={{
      padding: '3px 8px', borderRadius: 4, fontSize: 10.5,
      fontFamily: 'var(--font-mono)', fontWeight: 600,
      background: `color-mix(in srgb, ${color} 10%, transparent)`,
      color,
      border: `1px solid color-mix(in srgb, ${color} 22%, transparent)`,
      whiteSpace: 'nowrap',
    }}>{text}</span>
  )
  return tooltip ? <Tip text={tooltip} w={220}>{inner}</Tip> : inner
}

export default function EvalPanel({ ev, open, onToggle, claimsOpen, onToggleClaims }) {
  const sup = ev.status === 'superseded'
  const satCount = ev.claims.filter(c => c.status === 'satisfactory' || c.status === 'verified').length
  const unsatCount = ev.claims.filter(c => c.status === 'unsatisfactory' || c.status === 'contested' || c.status === 'failed').length
  const missCount = ev.claims.filter(c => c.status === 'missing').length

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      marginTop: 10,
      opacity: sup ? 0.4 : 1,
      transition: 'opacity 200ms',
    }}>
      {/* Header */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', cursor: 'pointer',
          borderRadius: open ? '8px 8px 0 0' : '8px',
          background: open ? 'var(--bg-raised)' : 'transparent',
          transition: 'background 150ms',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.org}</span>
          {sup && <Badge text="SUPERSEDED" color="var(--text-tertiary)" tooltip="Replaced by newer evaluation. Preserved for audit." />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{ev.date}</span>
          {!sup && satCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              <span style={{ color: 'var(--accent-green)' }}>✓</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{satCount}</span>
            </span>
          )}
          {!sup && unsatCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              <span style={{ color: 'var(--accent-red)' }}>✕</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{unsatCount}</span>
            </span>
          )}
          {!sup && missCount > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              <span style={{ color: 'var(--text-dim)' }}>?</span>
              <span style={{ color: 'var(--text-tertiary)' }}>{missCount}</span>
            </span>
          )}
          <Chev open={open} />
        </div>
      </div>

      {/* Body */}
      {open && (
        <div style={{ padding: '4px 14px 16px' }}>
          <div style={{
            fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo)',
            fontWeight: 600, marginTop: 8, marginBottom: 14,
          }}>{ev.id}</div>
          <DataTable
            columns={[
              { key: 'label', width: 130, color: 'var(--text-dim)' },
              {
                key: 'value', width: 'flex', mono: true,
                render: (value, row) => (
                  <span style={{ color: row.color || 'var(--text-secondary)' }}>{value}</span>
                ),
              },
            ]}
            rows={[
              { label: 'Requirements', value: ev.requirements, color: 'var(--accent-indigo)' },
              { label: 'Reviewer', value: `${ev.reviewer} · ${ev.reviewDate}`, color: 'var(--accent-green)' },
              { label: 'Credits', value: String(ev.creditsUsed) },
            ]}
            compact
          />

          {ev.claims.length > 0 && (
            <div style={{ marginTop: 18 }}>
              <div
                onClick={e => { e.stopPropagation(); onToggleClaims() }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}
              >
                <span style={{
                  fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  color: 'var(--text-secondary)', letterSpacing: '0.05em',
                }}>RESULTS</span>
                <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{ev.claims.length}</span>
                <Chev open={claimsOpen} />
              </div>
              {claimsOpen && (
                <DataTable
                  columns={[
                    { key: 'requirement', header: 'Requirement', width: 160, bold: true, color: 'var(--text-primary)' },
                    {
                      key: 'output', header: 'Claim', width: 'flex', mono: true,
                      render: (value, row) => (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</span>
                          <span style={{ fontSize: 10, color: 'var(--text-dim)', flexShrink: 0 }}>
                            {row.type === 'inference' ? 'inference' : 'extraction'}
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'status', header: 'Result', width: 100,
                      render: (value) => {
                        const isGood = value === 'verified' || value === 'satisfactory'
                        const isBad = value === 'contested' || value === 'failed' || value === 'unsatisfactory'
                        const isMissing = value === 'missing'
                        const color = isGood ? 'var(--accent-green)' : isBad ? 'var(--accent-red)' : 'var(--text-dim)'
                        const label = isGood ? 'Satisfactory' : isBad ? 'Unsatisfactory' : isMissing ? 'Missing' : '—'
                        const short = isGood ? 'SAT' : isBad ? 'UNSAT' : isMissing ? 'MISS' : '—'
                        return (
                          <Tip text={label}>
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              padding: '2px 7px', borderRadius: 4,
                              color, background: `color-mix(in srgb, ${color} 12%, transparent)`,
                              cursor: 'default',
                            }}>
                              {short}
                            </span>
                          </Tip>
                        )
                      },
                    },
                  ]}
                  rows={ev.claims}
                  maxRows={8}
                  compact
                />
              )}
            </div>
          )}
          {sup && ev.claims.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 14, fontFamily: 'var(--font-mono)' }}>
              Claims from this evaluation are no longer active.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
