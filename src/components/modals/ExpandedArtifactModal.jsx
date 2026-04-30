// ExpandedArtifactModal — Phase 11B port of the V2/V2.1 Detail Panel expand
// modal that was lost in the V2.2 retreat. Two tabs (Output / JSON), 720px
// wide, 80vh tall, portal-rendered via the shared Backdrop.
//
// Schemas supported:
//   • 'asset'        — Output tab renders AssetEvidenceViewer (file metadata
//                      header + iframe-based PDF viewer when localPath is set,
//                      placeholder card otherwise).
//   • 'parse-output' — Output tab renders the Parse Result's `fields[]` as
//                      ArtifactRow list (label + value + confidence chip).
//   • 'eval-output'  — Output tab renders the Eval Result's `results[]` as
//                      ArtifactRow list (label + value + status badge).
//
// JSON tab is universal — `JSON.stringify(artifact, null, 2)` in a scrollable
// preformatted block.

import { useState, useEffect } from 'react'
import { Backdrop } from './ModalShared.jsx'
import CopyBadge from '../DetailPanel/shared/CopyBadge.jsx'

function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const min = String(d.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} · ${hh}:${min} UTC`
}

function TabBar({ active, onChange, hideOutput = false }) {
  const tabs = hideOutput
    ? [{ id: 'json', label: 'JSON' }]
    : [
      { id: 'output', label: 'Output' },
      { id: 'json', label: 'JSON' },
    ]
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)', flexShrink: 0,
    }}>
      {tabs.map((t) => {
        const isActive = t.id === active
        return (
          <div
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '12px 18px',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? 'var(--accent-indigo)' : 'var(--text-tertiary)',
              borderBottom: isActive ? '2px solid var(--accent-indigo)' : '2px solid transparent',
              marginBottom: -1,
              transition: 'color 120ms, border-color 120ms',
            }}
            onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = 'var(--text-tertiary)' }}
          >
            {t.label}
          </div>
        )
      })}
    </div>
  )
}

/* ─── AssetEvidenceViewer — Phase 11B (new). iframe-based file viewer.
   Header shows filename + size + MIME + truncated hash with click-to-copy.
   Body uses an iframe pointed at file.localPath when present; falls back to
   a "Document preview not available" card otherwise. ─── */
function AssetEvidenceViewer({ asset }) {
  const file = asset?.file || {}
  const hash = file.hash || ''
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Metadata header */}
      <div style={{
        padding: '12px 14px',
        background: 'var(--bg-deep)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '6px 16px',
        fontSize: 11,
      }}>
        <span style={{ color: 'var(--text-tertiary)' }}>Filename</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{file.filename || '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Size</span>
        <span style={{ color: 'var(--text-primary)' }}>{formatBytes(file.size)}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>MIME</span>
        <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>{file.mimeType || '—'}</span>
        <span style={{ color: 'var(--text-tertiary)' }}>Hash</span>
        <span style={{ color: 'var(--text-primary)' }}>
          {hash ? <CopyBadge value={hash} truncated /> : '—'}
        </span>
      </div>

      {/* Body — iframe or placeholder */}
      {file.localPath ? (
        <iframe
          src={file.localPath}
          style={{
            width: '100%', height: 400, border: '1px solid var(--border)',
            borderRadius: 6, background: 'var(--bg-deep)',
          }}
          title={`Evidence: ${file.filename || asset?.name || 'asset'}`}
        />
      ) : (
        <div style={{
          height: 400,
          background: 'var(--bg-deep)',
          border: '2px dashed var(--border)',
          borderRadius: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-dim)',
          fontSize: 12,
          textAlign: 'center',
          padding: 24,
        }}>
          Document preview not available
        </div>
      )}

      {/* Optional metadata footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 16px',
        fontSize: 11,
        color: 'var(--text-tertiary)',
      }}>
        <span>Owner</span>
        <span style={{ color: 'var(--text-secondary)' }}>{asset?.owner || '—'}</span>
        <span>Registered</span>
        <span style={{ color: 'var(--text-secondary)' }}>{formatDateTime(asset?.registrationDate)}</span>
      </div>
    </div>
  )
}

/* ─── ArtifactRow — Phase 11B (port from V2.1 pattern). Renders a single
   parse-field or eval-result row with label + value + confidence/status. ─── */
function ArtifactRow({ row, schema }) {
  const isEval = schema === 'eval-output'
  const status = row.status   // 'satisfactory' | 'unsatisfactory' | 'missing' | 'na'
  const confidence = row.confidence  // 0..1 number

  const statusBadge = isEval && status ? (() => {
    const cfg = {
      satisfactory:    { label: 'SAT',     bg: 'color-mix(in srgb, var(--accent-green) 15%, transparent)', color: 'var(--accent-green)' },
      unsatisfactory:  { label: 'UNSAT',   bg: 'color-mix(in srgb, var(--accent-red) 15%, transparent)',   color: 'var(--accent-red)' },
      missing:         { label: 'MISSING', bg: 'color-mix(in srgb, var(--accent-amber) 15%, transparent)', color: 'var(--accent-amber)' },
      na:              { label: 'N/A',     bg: 'var(--bg-raised)',                                          color: 'var(--text-dim)' },
    }[status] || { label: status?.toUpperCase() || '—', bg: 'var(--bg-raised)', color: 'var(--text-dim)' }
    return (
      <span style={{
        fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
        padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
        background: cfg.bg, color: cfg.color, flexShrink: 0,
      }}>{cfg.label}</span>
    )
  })() : null

  const confidenceBadge = !isEval && typeof confidence === 'number' ? (
    <span style={{
      fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
      padding: '2px 6px', borderRadius: 3, letterSpacing: '0.04em',
      color: confidence >= 0.85 ? 'var(--accent-green)' : confidence >= 0.65 ? 'var(--accent-amber)' : 'var(--accent-red)',
      background: 'var(--bg-raised)',
      flexShrink: 0,
    }}>{Math.round(confidence * 100)}%</span>
  ) : null

  return (
    <div style={{
      padding: '10px 12px',
      background: 'var(--bg-deep)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
          {row.label || row.name || row.id || '—'}
        </span>
        {statusBadge}
        {confidenceBadge}
      </div>
      {row.value != null && row.value !== '' && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
          {String(row.value)}
        </div>
      )}
    </div>
  )
}

export default function ExpandedArtifactModal({
  artifact,
  schema,        // 'asset' | 'parse-output' | 'eval-output' | 'evaluation-agreement'
  title,         // optional override; falls back to artifact.name
  onClose,
}) {
  // Phase 11C.2 W3: EA schema is JSON-only — its artifact has no file or
  // structured rows that map cleanly to the Output tab pattern. Hide the
  // Output tab entirely and default the active tab to 'json' so the
  // initial render is meaningful.
  const hideOutput = schema === 'evaluation-agreement'
  const [tab, setTab] = useState(hideOutput ? 'json' : 'output')

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const headerLabel = schema === 'asset' ? 'ASSET'
    : schema === 'parse-output' ? 'PARSE RESULT'
    : schema === 'eval-output' ? 'EVAL RESULT'
    : schema === 'evaluation-agreement' ? 'EVALUATION AGREEMENT'
    : 'ARTIFACT'
  const displayTitle = title || artifact?.name || artifact?.id || 'Artifact'

  let outputBody
  if (schema === 'asset') {
    outputBody = <AssetEvidenceViewer asset={artifact} />
  } else if (schema === 'parse-output') {
    const fields = artifact?.fields || []
    outputBody = fields.length === 0 ? (
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No parsed fields.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {fields.map((f) => <ArtifactRow key={f.id || f.name} row={f} schema={schema} />)}
      </div>
    )
  } else if (schema === 'eval-output') {
    const rows = artifact?.results || []
    outputBody = rows.length === 0 ? (
      <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>No evaluation results.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r) => <ArtifactRow key={r.requirementId || r.label} row={r} schema={schema} />)}
      </div>
    )
  } else {
    outputBody = <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Unknown schema.</div>
  }

  return (
    <Backdrop onClose={onClose}>
      <div style={{
        width: 720, height: '80vh', background: 'var(--bg-surface)',
        borderRadius: 14, border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--text-tertiary)', letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '1px 4px', borderRadius: 3,
              background: 'var(--bg-raised)',
              display: 'inline-block', marginBottom: 4,
            }}>{headerLabel}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-bright)' }}>{displayTitle}</div>
          </div>
          <span
            onClick={onClose}
            style={{
              fontSize: 18, color: 'var(--text-dim)', cursor: 'pointer',
              padding: '4px 8px', borderRadius: 4, transition: 'color 100ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-dim)'}
          >×</span>
        </div>

        <TabBar active={tab} onChange={setTab} hideOutput={hideOutput} />

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          {tab === 'output' && outputBody}
          {tab === 'json' && (
            <pre style={{
              margin: 0,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '14px 16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}>{JSON.stringify(artifact, null, 2)}</pre>
          )}
        </div>
      </div>
    </Backdrop>
  )
}
