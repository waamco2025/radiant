import { useState } from 'react'
import { BTN_H } from './constants'
import EvidenceBlock from './EvidenceBlock'
import EvalPanel from './EvalPanel'
import { Tip } from './shared/Tooltip'

function ClipIcon({ s = 14, c = 'var(--text-secondary)' }) {
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <path d="M10.5 4.5v6a3 3 0 01-6 0v-7a2 2 0 014 0v6.5a1 1 0 01-2 0V5" stroke={c} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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

function Btn({ label, onClick, accent, style: sx }) {
  const [h, setH] = useState(false)
  const c = accent ? 'var(--accent-indigo)' : 'var(--text-secondary)'
  const bc = accent ? 'color-mix(in srgb, var(--accent-indigo) 40%, transparent)' : 'var(--border)'
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        height: BTN_H, padding: '0 14px', borderRadius: 5,
        border: `1px solid ${h ? 'var(--border-hover)' : bc}`,
        background: h ? (accent ? 'color-mix(in srgb, var(--accent-indigo) 7%, transparent)' : 'var(--bg-raised)') : 'transparent',
        color: c, fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 500,
        cursor: 'pointer', transition: 'all 180ms', whiteSpace: 'nowrap',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...(sx || {}),
      }}
    >
      {label}
    </button>
  )
}

export default function EvaluationsTab({
  evidence, evals, evalOpen, claimsOpen,
  toggleEval, toggleClaims, expandAll, collapseAll,
  evOpen, toggleEv, isOwner,
}) {
  return (
    <div>
      {evidence && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <ClipIcon s={14} c="var(--text-secondary)" />
            <span style={{
              fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-secondary)', letterSpacing: '0.06em',
            }}>EVIDENCE</span>
          </div>
          <EvidenceBlock evidence={evidence} open={!!evOpen} onToggle={toggleEv} isOwner={isOwner} />
        </>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 4, marginTop: evidence ? 6 : 0,
      }}>
        <span style={{
          fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: 'var(--accent-indigo)', letterSpacing: '0.05em',
        }}>EVALUATIONS</span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{evals.length}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          <TinyBtn icon="⊞" tip="Expand all" onClick={expandAll} />
          <TinyBtn icon="⊟" tip="Collapse all" onClick={collapseAll} />
        </div>
        <div style={{ flex: 1 }} />
        <Btn label="✦ Run Evaluation" accent />
      </div>
      {evals.map((ev, i) => (
        <EvalPanel
          key={ev.id}
          ev={ev}
          open={!!evalOpen[i]}
          onToggle={() => toggleEval(i)}
          claimsOpen={!!claimsOpen[i]}
          onToggleClaims={() => toggleClaims(i)}
        />
      ))}
    </div>
  )
}
