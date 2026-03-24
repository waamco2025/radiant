import { useRef, useEffect, useState } from 'react'
import DataTable from './shared/DataTable'
import CopyBadge from './shared/CopyBadge'

function DocIcon({ s = 20 }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
      <path d="M4 1h5.5L13 4.5V14a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1z" stroke="var(--text-secondary)" strokeWidth="1" fill="none" />
      <path d="M9 1v4h4" stroke="var(--text-secondary)" strokeWidth="1" fill="none" strokeLinejoin="round" />
      <line x1="5" y1="8.5" x2="11" y2="8.5" stroke="var(--text-dim)" strokeWidth="0.7" />
      <line x1="5" y1="10.5" x2="9" y2="10.5" stroke="var(--text-dim)" strokeWidth="0.7" />
    </svg>
  )
}

export default function EvidenceBlock({ evidence, open, onToggle, isOwner = true }) {
  const bodyRef = useRef(null)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    if (open && bodyRef.current) setHeight(bodyRef.current.scrollHeight)
  }, [open])

  return (
    <div style={{
      background: 'var(--bg-surface)',
      borderRadius: 8,
      border: '1px solid var(--border)',
      marginBottom: 22,
    }}>
      <div
        onClick={onToggle || undefined}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 14px',
          cursor: onToggle ? 'pointer' : 'default',
          borderRadius: open ? '8px 8px 0 0' : '8px',
          background: open ? 'var(--bg-raised)' : 'transparent',
          transition: 'background 150ms',
        }}
      >
        <DocIcon s={20} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{isOwner ? evidence.filename : 'Evidence attached'}</div>
          <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 1 }}>{evidence.block}</div>
        </div>
        {onToggle && <Chev open={open} />}
      </div>
      <div style={{
        overflow: 'hidden',
        maxHeight: open ? height || 500 : 0,
        transition: 'max-height 250ms ease',
        opacity: open ? 1 : 0,
      }}>
        <div ref={bodyRef} style={{ padding: '4px 8px 16px' }}>
          <DataTable
            columns={[
              { key: 'label', width: 120, color: 'var(--text-dim)' },
              {
                key: 'value', width: 'flex', mono: true,
                render: (value, row) => {
                  if (row.copyable) return <CopyBadge value={value} truncated />
                  if (row.colored) return <span style={{ color: row.colored, fontWeight: 600, fontSize: 11, fontFamily: 'var(--font-mono)' }}>{value}</span>
                  return <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                },
              },
            ]}
            rows={[
              { label: 'SHA-256', value: evidence.hash, copyable: true },
              { label: 'Status', value: 'VERIFIED', colored: 'var(--accent-green)' },
              { label: 'On-chain ref', value: evidence.block },
              { label: 'Retention', value: evidence.retention },
              ...(isOwner ? [
                { label: 'Filename', value: evidence.filename },
                { label: 'Storage URI', value: evidence.uri, copyable: true },
                { label: 'Provider', value: evidence.provider },
              ] : []),
            ]}
            compact
          />
          {!isOwner && (
            <div style={{
              marginTop: 10, padding: '10px 12px',
              background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
              border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
              borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
            }}>
              Some evidence details are restricted to the asset owner.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Chev({ open }) {
  return (
    <span style={{
      fontSize: 11,
      color: 'var(--text-tertiary)',
      transition: 'transform 180ms ease',
      transform: open ? 'rotate(90deg)' : 'rotate(0)',
      display: 'inline-block',
      marginLeft: 2,
    }}>▸</span>
  )
}
