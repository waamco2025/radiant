import { useState } from 'react'
import { BTN_H } from './constants'
import DataTable from './shared/DataTable'
import ClaimsTable from './shared/ClaimsTable'
import { TableActions, claimsToCSV } from './shared/TableActions'
import TableModal from './shared/TableModal'
import { Tip } from './shared/Tooltip'

function Chev({ open }) {
  return (
    <span style={{
      fontSize: 20, color: 'var(--text-tertiary)',
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

export default function EvalPanel({ ev, open, onToggle, claimsOpen, onToggleClaims, onAmendEval, activeParty }) {
  const [showModal, setShowModal] = useState(false)
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
      opacity: sup ? (open ? 1 : 0.55) : 1,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{ev.org}</span>
          {sup && <Badge text="SUPERSEDED" color="var(--text-tertiary)" tooltip="Replaced by newer evaluation. Preserved for audit." />}
          {ev.evalVersion && (
            <span style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              padding: '1px 5px', borderRadius: 3,
              background: sup ? 'var(--bg-raised)' : 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
              color: sup ? 'var(--text-dim)' : 'var(--accent-indigo)',
            }}>v{ev.evalVersion}</span>
          )}
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
              { label: 'Evaluated', value: `${ev.date}${ev.dateTime ? ' · ' + new Date(ev.dateTime).toISOString().slice(11, 16) + ' UTC' : ''}`, color: 'var(--accent-green)' },
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
                <TableActions
                  onExpand={() => setShowModal(true)}
                  onDownload={() => claimsToCSV(ev.claims, `${ev.requirements || ev.id}-results.csv`)}
                />
                <Chev open={claimsOpen} />
              </div>
              {claimsOpen && (
                <>
                  <div style={{
                    padding: '10px 14px', borderRadius: 8, marginBottom: 10,
                    background: 'var(--bg-deep)', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 14,
                    fontSize: 11, fontFamily: 'var(--font-mono)',
                  }}>
                    <span style={{ color: 'var(--text-dim)' }}>{ev.claims.length} claims</span>
                    <span style={{ color: 'var(--accent-green)' }}>{satCount} satisfactory</span>
                    {unsatCount > 0 && <span style={{ color: 'var(--accent-red)' }}>{unsatCount} unsatisfactory</span>}
                    {missCount > 0 && <span style={{ color: 'var(--text-dim)' }}>{missCount} missing</span>}
                  </div>
                  <ClaimsTable claims={ev.claims} />
                </>
              )}
            </div>
          )}
          {sup && ev.claims.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 14, fontFamily: 'var(--font-mono)' }}>
              Claims from this evaluation are no longer active.
            </div>
          )}
          {!sup && ev.org === activeParty && ev.disclosureType !== 'proofonly' && onAmendEval && (
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
              <button
                onClick={e => { e.stopPropagation(); onAmendEval(ev) }}
                style={{
                  padding: '6px 12px', borderRadius: 5,
                  border: '1px solid color-mix(in srgb, var(--accent-indigo) 35%, transparent)',
                  background: 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)',
                  color: 'var(--accent-indigo)',
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  cursor: 'pointer', transition: 'all 150ms',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 12%, transparent)'}
                onMouseLeave={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-indigo) 5%, transparent)'}
              >&#9670; Amend Evaluation</button>
            </div>
          )}
        </div>
      )}
      {showModal && (
        <TableModal title={`${ev.requirements || ev.id} — Results`} onClose={() => setShowModal(false)}>
          <ClaimsTable claims={ev.claims} maxHeight={9999} />
        </TableModal>
      )}
    </div>
  )
}
