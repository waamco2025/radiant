import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  objects, actors,
  getObjectHealth, getArtifactSchema, getEvalHealth,
} from './v3Data.js'

const PANEL_W = 360

export { PANEL_W }

const SDA_COLORS = {
  full: '#6b8aff',
  selective: '#f59e0b',
  proofonly: '#22c55e',
  'proof-only': '#22c55e',
  provisional: '#888888',
}

const SDA_LABELS = {
  full: 'Full',
  selective: 'Selective',
  proofonly: 'Proof-only',
  'proof-only': 'Proof-only',
  provisional: 'Provisional',
}

function formatDateTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`
}

function formatBytes(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function HealthMinibar({ health }) {
  if (!health) return null
  const { sat, unsat, total } = health
  const satPct = (sat / total) * 100
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        height: 5,
        borderRadius: 2.5,
        background: 'var(--border)',
        overflow: 'hidden',
        display: 'flex',
      }}>
        <div style={{
          width: `${satPct}%`,
          background: 'var(--accent-green)',
          borderRadius: satPct === 100 ? 2.5 : '2.5px 0 0 2.5px',
        }} />
        {unsat > 0 && (
          <div style={{
            width: `${100 - satPct}%`,
            background: 'var(--accent-red)',
            borderRadius: satPct === 0 ? 2.5 : '0 2.5px 2.5px 0',
          }} />
        )}
      </div>
      <div style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        color: 'var(--text-tertiary)',
        marginTop: 4,
        letterSpacing: '0.04em',
      }}>
        {sat}/{total} SAT
      </div>
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted)',
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function Row({ label, value, mono, clickable, onClick }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 12, fontSize: 11, padding: '4px 0',
    }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span
        onClick={clickable ? onClick : undefined}
        style={{
          fontFamily: mono ? 'var(--font-mono)' : 'inherit',
          color: clickable ? 'var(--accent-amber)' : 'var(--text-primary)',
          textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          cursor: clickable ? 'pointer' : 'default',
          transition: clickable ? 'opacity 100ms' : 'none',
        }}
        onMouseEnter={clickable ? (e => e.currentTarget.style.opacity = '0.7') : undefined}
        onMouseLeave={clickable ? (e => e.currentTarget.style.opacity = '1') : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function DataTable({ rows }) {
  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: 6,
      overflow: 'hidden',
      fontFamily: 'var(--font-mono)',
      fontSize: 11,
    }}>
      {rows.map((row, i) => (
        <div key={i} style={{
          display: 'grid',
          gridTemplateColumns: row.cols || '120px 1fr auto',
          gap: 8,
          padding: '6px 12px',
          background: i % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
          borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          {row.cells.map((cell, j) => (
            <div key={j} style={{
              color: j === 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

function SDABadge({ type }) {
  const color = SDA_COLORS[type] || SDA_COLORS.full
  const label = SDA_LABELS[type] || 'Full'
  return (
    <span style={{
      fontSize: 9,
      fontFamily: 'var(--font-mono)',
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 3,
      background: `color-mix(in srgb, ${color} 15%, transparent)`,
      color,
      border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

// ── Overview Tab ──

function OverviewTab({ obj, onNavigate, visibleEdges }) {
  const owner = actors.find(a => a.id === obj.owner)
  const parent = obj.provenance ? objects.find(o => o.id === obj.provenance.derivedFrom) : null
  const connections = (visibleEdges || []).filter(e => e.from === obj.id || e.to === obj.id)
  const children = objects.filter(o => o.provenance && o.provenance.derivedFrom === obj.id)

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 22 }}>
      {/* Identity */}
      <section>
        <SectionLabel>Identity</SectionLabel>
        <Row label="PIN" value={obj.pin} mono />
        <Row label="DOT" value={obj.dot} mono />
        {owner && <Row label="Owner" value={owner.org} />}
      </section>

      {/* Provenance */}
      <section>
        <SectionLabel>Provenance</SectionLabel>
        {obj.provenance ? (
          <>
            <Row
              label="Derived from"
              value={parent?.name || obj.provenance.derivedFrom}
              clickable={!!parent}
              onClick={parent ? () => onNavigate?.(parent.id) : undefined}
            />
            <Row label="Process" value={obj.provenance.process} />
            <Row label="Timestamp" value={formatDateTime(obj.provenance.timestamp)} mono />
          </>
        ) : (
          <>
            <Row label="Derived from" value={owner?.org || '—'} />
            <Row label="Process" value="Registration" />
            <Row label="Timestamp" value={formatDateTime(obj.dateTime)} mono />
          </>
        )}
      </section>

      {/* Connections */}
      <section>
        <SectionLabel>Connections</SectionLabel>
        {connections.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No connections
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {connections.map(e => {
              const isOutgoing = e.from === obj.id
              const otherId = isOutgoing ? e.to : e.from
              const other = objects.find(o => o.id === otherId)
              if (!other) return null
              return (
                <div
                  key={e.id}
                  onClick={() => onNavigate?.(otherId)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 60%, transparent)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                >
                  <span style={{
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-tertiary)',
                    flexShrink: 0,
                  }}>
                    {isOutgoing ? '→' : '←'}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: 'var(--text-primary)',
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {other.name}
                  </span>
                  <SDABadge type={e.sdaType} />
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Children */}
      <section>
        <SectionLabel>Children</SectionLabel>
        {children.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
            No derived objects
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {children.map(c => {
              const schema = getArtifactSchema(c.artifact)
              return (
                <div
                  key={c.id}
                  onClick={() => onNavigate?.(c.id)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    transition: 'background 100ms',
                  }}
                  onMouseEnter={ev => ev.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 60%, transparent)'}
                  onMouseLeave={ev => ev.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{c.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    color: 'var(--text-tertiary)',
                    letterSpacing: '0.04em',
                  }}>
                    {schema}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

// ── Artifact Tab ──

function ArtifactTab({ obj, onExpand }) {
  const artifact = obj.artifact
  if (!artifact) {
    return (
      <div style={{ padding: '18px 20px', fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic' }}>
        No artifact registered
      </div>
    )
  }

  const schema = getArtifactSchema(artifact)

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <section>
        <SectionLabel>Artifact URI</SectionLabel>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 10,
          color: 'var(--text-primary)',
          padding: '6px 10px',
          background: 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
          border: '1px solid var(--border)',
          borderRadius: 4,
          wordBreak: 'break-all',
        }}>
          {obj.artifactUri || '—'}
        </div>
      </section>

      {schema === 'raw' && (
        <section>
          <SectionLabel>File</SectionLabel>
          <Row label="Filename" value={artifact.filename || '—'} mono />
          {artifact.size != null && <Row label="Size" value={formatBytes(artifact.size)} mono />}
          {artifact.mimeType && <Row label="MIME Type" value={artifact.mimeType} mono />}
        </section>
      )}

      {schema === 'parse-output' && (
        <>
          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <SectionLabel>Parse Output</SectionLabel>
              <ExpandButton onClick={onExpand} />
            </div>
            {artifact.template && (() => {
              const tplOwner = actors.find(a => a.id === obj.owner)
              return <Row label="Template" value={`${artifact.template} · ${tplOwner?.org || ''}`} mono />
            })()}
          </section>
          <section>
            <SectionLabel>Results</SectionLabel>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {artifact.fields.map((f, i) => (
                <ArtifactRow key={f.id || f.key || i} item={f} schema={schema} index={i} isLast={i === artifact.fields.length - 1} />
              ))}
            </div>
            <div style={{ marginTop: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {artifact.fields.length} fields extracted
            </div>
          </section>
        </>
      )}

      {schema === 'eval-output' && (() => {
        const health = getEvalHealth(artifact)
        return (
          <>
            <section>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <SectionLabel>Evaluation Output</SectionLabel>
                <ExpandButton onClick={onExpand} />
              </div>
              {artifact.template && (() => {
                const tplOwner = actors.find(a => a.id === obj.owner)
                return <Row label="Template" value={`${artifact.template} · ${tplOwner?.org || ''}`} mono />
              })()}
            </section>
            <section>
              <SectionLabel>Results</SectionLabel>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {artifact.requirements.map((r, i) => (
                  <ArtifactRow key={r.id || i} item={r} schema={schema} index={i} isLast={i === artifact.requirements.length - 1} />
                ))}
              </div>
              {health && (
                <div style={{ marginTop: 10, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{health.sat} satisfactory</span>
                  {(health.missing || 0) > 0 && (<><span style={{ color: 'var(--text-muted)' }}>·</span><span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{health.missing} missing</span></>)}
                  {health.unsat > 0 && (<><span style={{ color: 'var(--text-muted)' }}>·</span><span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{health.unsat} unsatisfactory</span></>)}
                </div>
              )}
            </section>
          </>
        )
      })()}

      {schema === 'disclosure-agreement' && (
        <>
          <section>
            <SectionLabel>Disclosure Agreement</SectionLabel>
            <div style={{ marginBottom: 10 }}>
              <SDABadge type={artifact.type} />
            </div>
            {artifact.executedAt && <Row label="Executed" value={formatDateTime(artifact.executedAt)} mono />}
          </section>
          <section>
            <SectionLabel>Parties</SectionLabel>
            <Row label="Discloser" value={`${artifact.parties.discloser.name} · ${artifact.parties.discloser.org}`} />
            <Row label="Recipient" value={`${artifact.parties.recipient.name} · ${artifact.parties.recipient.org}`} />
          </section>
          <section>
            <SectionLabel>Scope</SectionLabel>
            <Row label="Object" value={artifact.scope.objectId} mono />
            <Row label="Includes derivatives" value={artifact.scope.includeDerivatives ? 'Yes' : 'No'} />
          </section>
          {artifact.terms && (
            <section>
              <SectionLabel>Terms</SectionLabel>
              {artifact.terms.duration && <Row label="Duration" value={artifact.terms.duration} />}
              {artifact.terms.autoRenew != null && <Row label="Auto-renew" value={artifact.terms.autoRenew ? 'Yes' : 'No'} />}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// ── Shared Artifact Components ──

function ArtifactRow({ item, schema, index, isLast }) {
  const isEval = schema === 'eval-output'
  const status = isEval ? (item.status || (item.sat ? 'sat' : 'unsat')) : null
  const statusCfg = status ? ({
    sat: { icon: '✓', color: 'var(--accent-green)', label: 'SAT' },
    unsat: { icon: '✕', color: 'var(--accent-red)', label: 'UNSAT' },
    missing: { icon: '?', color: 'var(--text-dim)', label: 'MISSING' },
  }[status] || { icon: '✕', color: 'var(--accent-red)', label: 'UNSAT' }) : null

  const confidence = item.confidence != null ? Math.round(item.confidence * 100) : null
  const confColor = confidence != null
    ? (confidence >= 90 ? 'var(--accent-green)' : confidence >= 80 ? 'var(--accent-amber)' : 'var(--accent-red)')
    : null
  const value = item.value || item.detail || null

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      background: index % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 11, flex: 1 }}>
          {item.name || item.key || item.id}
        </span>
        {statusCfg && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 6px', borderRadius: 3, color: statusCfg.color,
            background: `color-mix(in srgb, ${statusCfg.color} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${statusCfg.color} 25%, transparent)`,
            display: 'flex', alignItems: 'center', gap: 3,
          }}>
            {statusCfg.icon} {statusCfg.label}
          </span>
        )}
        {!isEval && confidence != null && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 6px', borderRadius: 3, color: confColor,
            background: `color-mix(in srgb, ${confColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${confColor} 25%, transparent)`,
          }}>
            {confidence}%
          </span>
        )}
      </div>
      {value && (
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginTop: 4 }}>
          {value}
        </div>
      )}
      {isEval && item.criterion && (
        <div style={{
          fontSize: 9, color: 'var(--accent-amber)', lineHeight: 1.5, marginTop: 5,
          padding: '3px 6px', borderRadius: 3,
          background: 'color-mix(in srgb, var(--accent-amber) 6%, transparent)',
          border: '1px solid color-mix(in srgb, var(--accent-amber) 12%, transparent)',
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, fontWeight: 600, letterSpacing: '0.06em' }}>CRITERION </span>
          {item.criterion}
        </div>
      )}
      {item.instruction && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 4 }}>
          {item.instruction}
        </div>
      )}
    </div>
  )
}

function ExpandButton({ onClick }) {
  return (
    <button onClick={onClick} title="Expand" style={{
      background: 'none', border: '1px solid var(--border)',
      borderRadius: 4, padding: '3px 5px', cursor: 'pointer',
      color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
      transition: 'all 100ms',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <polyline points="10,2 14,2 14,6" />
        <polyline points="6,14 2,14 2,10" />
        <line x1="14" y1="2" x2="9" y2="7" />
        <line x1="2" y1="14" x2="7" y2="9" />
      </svg>
    </button>
  )
}

function ExpandedArtifactModal({ artifact, schema, name, onClose }) {
  const [tab, setTab] = useState('table')
  const health = schema === 'eval-output' ? getEvalHealth(artifact) : null
  const items = schema === 'eval-output' ? artifact.requirements : artifact.fields

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    }
    window.addEventListener('keydown', handleEsc, true)
    return () => window.removeEventListener('keydown', handleEsc, true)
  }, [onClose])

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose() }} style={{
      position: 'fixed', inset: 0, zIndex: 10001,
      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: 720, height: '80vh',
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderRadius: 12, display: 'flex', flexDirection: 'column',
        overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{name}</div>
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', marginTop: 4 }}>
              {artifact.template}
              {health && (
                <span style={{ marginLeft: 12 }}>
                  <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{health.sat}</span>
                  <span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>·</span>
                  {(health.missing || 0) > 0 && (<><span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{health.missing}</span><span style={{ color: 'var(--text-muted)', margin: '0 3px' }}>·</span></>)}
                  <span style={{ color: health.unsat > 0 ? 'var(--accent-red)' : 'var(--text-muted)', fontWeight: 600 }}>{health.unsat}</span>
                </span>
              )}
              {schema === 'parse-output' && <span style={{ marginLeft: 12, color: 'var(--text-muted)' }}>{items.length} fields</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >✕</button>
        </div>

        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 24px', flexShrink: 0 }}>
          {['table', 'json'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent-amber)' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'uppercase',
              letterSpacing: '0.06em', fontWeight: tab === t ? 600 : 400, marginBottom: -1,
            }}>
              {t === 'table' ? 'Results' : 'JSON'}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '18px 24px', background: 'color-mix(in srgb, var(--bg-card) 50%, var(--bg-surface))' }}>
          {tab === 'table' ? (
            <div style={{ background: 'transparent', border: 'none', overflow: 'hidden' }}>
              {items.map((item, i) => (
                <ArtifactRow key={item.id || i} item={item} schema={schema} index={i} isLast={i === items.length - 1} />
              ))}
            </div>
          ) : (
            <pre style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              background: 'transparent', border: 'none',
              borderRadius: 6, padding: '14px 16px', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6, margin: 0,
            }}>
              {JSON.stringify(artifact, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Component ──

const footerBtnStyle = {
  padding: '6px 14px',
  fontSize: 11,
  fontFamily: 'var(--font-mono)',
  fontWeight: 600,
  color: 'var(--text-primary)',
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: 'pointer',
  transition: 'all 100ms',
  letterSpacing: '0.04em',
}

export default function DetailPanel({ obj, onClose, onNavigate, onParse, onEvaluate, onDisclose, visibleEdges, forceTab }) {
  const [tab, setTab] = useState(forceTab || 'overview')

  // Reset tab when object changes, respecting forceTab
  useEffect(() => {
    setTab(forceTab || 'overview')
    setShowExpanded(false)
  }, [obj?.id, forceTab])

  if (!obj) return null

  const owner = actors.find(a => a.id === obj.owner)
  const childHealth = getObjectHealth(obj.id)
  const ownEvalHealth = getArtifactSchema(obj.artifact) === 'eval-output' ? getEvalHealth(obj.artifact) : null
  const health = childHealth || ownEvalHealth
  const isPending = obj._pending || obj.provisional || obj._showAsProvisional
  const hasActions = !isPending && (onParse || onEvaluate || onDisclose)
  const [showExpanded, setShowExpanded] = useState(false)

  return (
    <>
    <style>{`
      @keyframes v3-panel-slide-in {
        from { transform: translateX(${PANEL_W}px); opacity: 0.5; }
        to { transform: translateX(0); opacity: 1; }
      }
    `}</style>
    <div style={{
      width: PANEL_W,
      height: '100%',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      flexShrink: 0,
      animation: 'v3-panel-slide-in 200ms ease-out',
    }}>
      {/* Header */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2,
            flex: 1,
          }}>
            {obj.name}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-dim)',
              fontSize: 14,
              cursor: 'pointer',
              padding: '4px 8px',
              flexShrink: 0,
              lineHeight: 1,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
          >
            ✕
          </button>
        </div>
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
          marginTop: 6,
        }}>
          {obj.pin}
        </div>
        {owner && (
          <div style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            marginTop: 4,
          }}>
            {owner.org}
          </div>
        )}
        {health && !isPending && (() => {
          const miss = health.missing || 0
          return (
          <div style={{ marginTop: 10 }}>
            <div style={{
              height: 5, borderRadius: 2.5, background: 'var(--border)',
              overflow: 'hidden', display: 'flex',
            }}>
              <div
                title={`${health.sat} satisfactory`}
                style={{
                  width: `${(health.sat / health.total) * 100}%`,
                  background: 'var(--accent-green)',
                  borderRadius: health.sat === health.total ? 2.5 : '2.5px 0 0 2.5px',
                  cursor: 'help',
                }}
              />
              {miss > 0 && (
                <div
                  title={`${miss} missing`}
                  style={{
                    width: `${(miss / health.total) * 100}%`,
                    background: 'var(--text-dim)',
                    cursor: 'help',
                  }}
                />
              )}
              {health.unsat > 0 && (
                <div
                  title={`${health.unsat} unsatisfactory`}
                  style={{
                    width: `${(health.unsat / health.total) * 100}%`,
                    background: 'var(--accent-red)',
                    borderRadius: health.sat === 0 && miss === 0 ? 2.5 : '0 2.5px 2.5px 0',
                    cursor: 'help',
                  }}
                />
              )}
            </div>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)', marginTop: 6,
              display: 'flex', gap: 6, flexWrap: 'wrap',
            }}>
              <span>
                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{health.sat}</span>
                <span style={{ color: 'var(--text-tertiary)' }}> satisfactory</span>
              </span>
              {miss > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span>
                    <span style={{ color: 'var(--text-dim)', fontWeight: 600 }}>{miss}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}> missing</span>
                  </span>
                </>
              )}
              {health.unsat > 0 && (
                <>
                  <span style={{ color: 'var(--text-muted)' }}>·</span>
                  <span>
                    <span style={{ color: 'var(--accent-red)', fontWeight: 600 }}>{health.unsat}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}> unsatisfactory</span>
                  </span>
                </>
              )}
            </div>
          </div>
          )
        })()}
      </div>

      {isPending ? (
        /* Pending / Awaiting Disclosure view */
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px', textAlign: 'center' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            border: '2px dashed #888',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '20px auto 16px',
          }}>
            <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5" strokeLinecap="round">
              <path d="M12 2v4m0 12v4M5 2h14M5 22h14" />
              <path d="M5 2c0 5 3 7 7 10c-4 3-7 5-7 10" />
              <path d="M19 2c0 5-3 7-7 10c4 3 7 5 7 10" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Awaiting Disclosure
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 24 }}>
            Request sent to {owner?.org || 'asset owner'}
          </div>

          <div style={{
            textAlign: 'left', padding: '14px 16px', borderRadius: 8,
            background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
          }}>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>
              REQUEST DETAILS
            </div>
            <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Asset</span>
              <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{obj.name}</span>
            </div>
            <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Owner</span>
              <span style={{ color: 'var(--text-primary)' }}>{owner?.org || '—'}</span>
            </div>
            <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status</span>
              <span style={{ color: '#888', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>PENDING</span>
            </div>
            {obj._requestDetails && (
              <>
                {obj._requestDetails.requestedVia && (
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Requested via</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{obj._requestDetails.requestedVia}</span>
                  </div>
                )}
                {obj._requestDetails.timestamp && (
                  <div style={{ fontSize: 11, display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderTop: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Date</span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{obj._requestDetails.timestamp.slice(0, 10)}</span>
                  </div>
                )}
                {obj._requestDetails.requirementSets?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Requirements</div>
                    {obj._requestDetails.requirementSets.map((rs, i) => (
                      <div key={i} style={{
                        padding: '6px 10px', borderRadius: 4, marginBottom: 4,
                        background: 'color-mix(in srgb, var(--accent-indigo) 6%, transparent)',
                        border: '1px solid color-mix(in srgb, var(--accent-indigo) 15%, transparent)',
                        fontSize: 11, color: 'var(--accent-indigo)', fontWeight: 600,
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}>
                        {rs.name}
                        {rs.version && <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', opacity: 0.7 }}>v{rs.version}</span>}
                      </div>
                    ))}
                  </div>
                )}
                {obj._requestDetails.message && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>Message</div>
                    <div style={{
                      padding: '8px 10px', borderRadius: 4,
                      background: 'var(--bg-card, var(--bg-surface))', border: '1px solid var(--border)',
                      fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.6, fontStyle: 'italic',
                    }}>
                      "{obj._requestDetails.message}"
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <div
            style={{
              marginTop: 20, fontSize: 11, fontFamily: 'var(--font-mono)',
              color: 'var(--accent-red)', cursor: 'pointer', transition: 'opacity 100ms',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Cancel Request
          </div>
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--border)',
            padding: '0 20px',
            flexShrink: 0,
          }}>
            {['overview', 'artifact'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                style={{
                  padding: '10px 16px',
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
                  background: 'none',
                  border: 'none',
                  borderBottom: tab === t ? '2px solid var(--accent-amber, #C49A45)' : '2px solid transparent',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontWeight: tab === t ? 600 : 400,
                  marginBottom: -1,
                }}
              >
                {t === 'overview' ? 'Overview' : 'Artifact'}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'overview' ? <OverviewTab obj={obj} onNavigate={onNavigate} visibleEdges={visibleEdges} /> : <ArtifactTab obj={obj} onExpand={() => setShowExpanded(true)} />}
          </div>
        </>
      )}

      {/* Footer actions */}
      {hasActions && (
        <div style={{
          padding: '10px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}>
          {onParse && (
            <button
              onClick={onParse}
              style={footerBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Parse
            </button>
          )}
          {onEvaluate && (
            <button
              onClick={onEvaluate}
              style={footerBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Evaluate
            </button>
          )}
          {onDisclose && (
            <button
              onClick={onDisclose}
              style={footerBtnStyle}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              Disclose
            </button>
          )}
        </div>
      )}
    </div>
    {showExpanded && obj.artifact && (getArtifactSchema(obj.artifact) === 'eval-output' || getArtifactSchema(obj.artifact) === 'parse-output') && createPortal(
      <ExpandedArtifactModal
        artifact={obj.artifact}
        schema={getArtifactSchema(obj.artifact)}
        name={obj.name}
        onClose={() => setShowExpanded(false)}
      />,
      document.body
    )}
    </>
  )
}
