import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import PanelShell from './PanelShell'
import ClaimsTable from './shared/ClaimsTable'
import { TableActions, claimsToCSV } from './shared/TableActions'
import TableModal from './shared/TableModal'
import CopyBadge from './shared/CopyBadge'
import SDABadge from './shared/SDABadge'

// Inject panel reveal keyframes once
if (typeof document !== 'undefined' && !document.getElementById('panel-reveal-keyframes')) {
  const style = document.createElement('style')
  style.id = 'panel-reveal-keyframes'
  style.textContent = `
    @keyframes panelRowFade {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `
  document.head.appendChild(style)
}

// ─── Shared helpers ───

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, fontFamily: 'var(--font-mono)',
      color: 'var(--text-muted, var(--text-dim))', letterSpacing: '0.08em',
      textTransform: 'uppercase', marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function InfoRow({ label, value, mono, clickable, onClick, copyable }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      gap: 12, fontSize: 11, padding: '4px 0',
    }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      {copyable ? (
        <CopyBadge value={value} truncated />
      ) : (
        <span
          onClick={clickable ? onClick : undefined}
          style={{
            fontFamily: mono ? 'var(--font-mono)' : 'inherit',
            color: clickable ? 'var(--accent-amber)' : 'var(--text-primary)',
            textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            cursor: clickable ? 'pointer' : 'default',
          }}
        >
          {value}
        </span>
      )}
    </div>
  )
}

function ExpandButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Expand"
      style={{
        width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'none', border: '1px solid var(--border)', borderRadius: 4,
        color: 'var(--text-tertiary)', cursor: 'pointer', transition: 'all 100ms',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
    >
      <svg width={12} height={12} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M9 1h6v6M7 15H1V9M15 1L9 7M1 15l6-6" />
      </svg>
    </button>
  )
}

function formatFileSize(bytes) {
  if (bytes == null) return '\u2014'
  if (typeof bytes === 'string') return bytes
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1048576).toFixed(1)} MB`
}

function EvidenceRefsList({ refs }) {
  if (!refs || refs.length === 0) return null
  return (
    <div style={{
      borderRadius: 6, overflow: 'hidden',
      border: '1px solid var(--border)', background: 'var(--bg-deep)',
    }}>
      {refs.map((ref, i) => (
        <div key={ref.uri || i} style={{
          padding: '8px 10px',
          borderBottom: i < refs.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
              background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
              color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
            }}>EV</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ref.label || ref.filename}
            </span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
              {formatFileSize(ref.size)}
            </span>
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 3,
            fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
          }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ref.uri}
            </span>
            {ref.mimeType && (
              <span style={{ color: 'var(--text-dim)', flexShrink: 0 }}>
                {ref.mimeType}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function EvalClaimsSection({ claims, nodeName }) {
  const [showModal, setShowModal] = useState(null)
  return (
    <>
      <div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
          color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 8,
        }}>
          CLAIMS ({claims.length})
          <TableActions
            onExpand={() => setShowModal(true)}
            onDownload={() => claimsToCSV(claims, `${nodeName}-claims.csv`)}
          />
        </div>
        <ClaimsTable claims={claims} />
      </div>
      {showModal && (
        <TableModal title={`${nodeName} — Claims`} onClose={() => setShowModal(false)}>
          <ClaimsTable claims={claims} maxHeight={9999} />
        </TableModal>
      )}
    </>
  )
}

// ─── ArtifactRow ───

const STATUS_CONFIG = {
  satisfactory: { icon: '\u2713', color: 'var(--accent-green)', label: 'SAT' },
  unsatisfactory: { icon: '\u2715', color: 'var(--accent-red)', label: 'UNSAT' },
  missing: { icon: '?', color: 'var(--text-dim)', label: 'MISSING' },
}

function ArtifactRow({ item, schema, index, isLast }) {
  const isEval = schema === 'eval-output'

  const status = isEval ? item.status : null
  const statusCfg = status ? STATUS_CONFIG[status] : null

  const confidence = !isEval && item.confidence != null
    ? (typeof item.confidence === 'string'
      ? { high: 95, medium: 75, low: 50 }[item.confidence] || 50
      : Math.round(item.confidence * 100))
    : null
  const confColor = confidence != null
    ? (confidence >= 90 ? 'var(--accent-green)' : confidence >= 70 ? 'var(--accent-amber)' : 'var(--accent-red)')
    : null
  const confLabel = confidence != null
    ? (typeof item.confidence === 'string' ? item.confidence.toUpperCase() : `${confidence}%`)
    : null

  return (
    <div style={{
      padding: '10px 12px',
      borderBottom: isLast ? 'none' : '1px solid var(--border)',
      background: index % 2 === 0 ? 'transparent' : 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: 11, flex: 1 }}>
          {item.name || item.label || item.key || item.id}
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
        {confLabel && (
          <span style={{
            fontSize: 8, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 6px', borderRadius: 3, color: confColor,
            background: `color-mix(in srgb, ${confColor} 12%, transparent)`,
            border: `1px solid color-mix(in srgb, ${confColor} 25%, transparent)`,
          }}>
            {confLabel}
          </span>
        )}
      </div>
      {(item.value || item.humanValue || item.aiValue) && (
        <div style={{
          fontSize: 10, fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)', marginTop: 4,
        }}>
          {item.humanValue || item.value || item.aiValue}
        </div>
      )}
    </div>
  )
}

// ─── ExpandedArtifactModal ───

function ExpandedArtifactModal({ node, nodes, onClose }) {
  const [tab, setTab] = useState('results')

  const isEvidence = !!node.isEvidence
  const isParse = node.isParse || node.category === 'parse'
  const isEval = node.isEvaluation || node.category === 'evaluation'
  const isClaim = node.isClaim || node.category === 'claim'

  const jsonData = isEvidence
    ? { artifactUri: node.artifactUri, filename: node.evidence?.filename, hash: node.evidence?.hash, block: node.evidence?.block, provider: node.evidence?.provider, uri: node.evidence?.uri, retention: node.evidence?.retention, owner: node.owner, createdAt: node.dateTime }
    : isParse
      ? { template: node.name, fields: node.parsedFields, artifactUri: node.artifactUri }
      : isEval
        ? { requirementSet: node.requirementSetName, version: node.requirementSetVersion, evaluator: node.evaluatorParty, claims: node.claims, artifactUri: node.artifactUri }
        : isClaim
          ? { artifactUri: node.artifactUri, name: node.name, requirementSet: node.requirementSetName, version: node.requirementSetVersion, referencedEvidenceIds: node.referencedEvidenceIds, owner: node.owner, createdAt: node.dateTime }
          : { artifactUri: node.artifactUri, name: node.name, owner: node.owner, evidenceRefs: node.evidenceRefs, createdAt: node.dateTime }

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        e.preventDefault()
        onClose()
      }
    }
    window.addEventListener('keydown', handleKey, true)
    return () => window.removeEventListener('keydown', handleKey, true)
  }, [onClose])

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)',
    }} onClick={onClose}>
      <div style={{
        width: 800, height: '75vh',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            {node.name}
          </span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', fontSize: 16,
            color: 'var(--text-tertiary)', cursor: 'pointer',
          }}>{'\u2715'}</button>
        </div>
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 20px',
        }}>
          {['results', 'json'].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '10px 16px', fontSize: 11, fontFamily: 'var(--font-mono)',
              color: tab === t ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none', border: 'none',
              borderBottom: tab === t ? '2px solid var(--accent-amber)' : '2px solid transparent',
              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
              fontWeight: tab === t ? 600 : 400, marginBottom: -1,
            }}>
              {t === 'results' ? 'Results' : 'JSON'}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {tab === 'results' ? (
            isEvidence ? (
              node.evidence?.localPath && node.evidence.filename?.toLowerCase().endsWith('.pdf') ? (
                <div style={{ width: '100%', height: '100%', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
                  <iframe src={node.evidence.localPath} style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg-deep)' }} title={node.evidence.filename} />
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                  File preview not available for this format
                </div>
              )
            ) : (isParse || isEval) ? (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {(isParse ? (node.parsedFields || []) : (node.claims || [])).map((item, i, arr) => (
                  <ArtifactRow key={i} item={item} schema={isParse ? 'parse-output' : 'eval-output'} index={i} isLast={i === arr.length - 1} />
                ))}
              </div>
            ) : (() => {
              // Claim/asset: build evidence refs list
              const refs = isClaim
                ? (node.referencedEvidenceIds || []).map(evId => {
                    const ev = (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
                    return ev
                      ? { label: ev.name || ev.evidence?.filename, uri: ev.evidence?.uri || ev.artifactUri, filename: ev.evidence?.filename, size: ev.evidence?.size }
                      : { label: evId, uri: '\u2014', filename: evId }
                  })
                : (node.evidenceRefs || [])
              return refs.length > 0
                ? <EvidenceRefsList refs={refs} />
                : <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', textAlign: 'center', padding: 24 }}>No evidence files</div>
            })()
          ) : (
            <pre style={{
              fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
              background: 'var(--bg-deep)', padding: 16, borderRadius: 8,
              border: '1px solid var(--border)', overflow: 'auto',
              whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.6,
            }}>
              {JSON.stringify(jsonData, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Overview Tab ───

function OverviewTab({ node, nodes, isOwner, onViewChild, onSelectAsset }) {
  const derivedFromNode = (() => {
    if (!node.parentId && !node.sourceEvidenceId) return null
    // Parse nodes: derive from source evidence file
    if ((node.isParse || node.category === 'parse') && node.sourceEvidenceId) {
      const src = (nodes || []).flatMap(n => n.children || []).find(c => c.id === node.sourceEvidenceId)
      if (src) return src
    }
    // Eval nodes: derive from the claim they evaluated
    if ((node.isEvaluation || node.category === 'evaluation') && node.claimId) {
      const claim = (nodes || []).flatMap(n => n.children || []).find(c => c.id === node.claimId)
      if (claim) return claim
    }
    // Default: parentId lookup in root nodes then children
    if (node.parentId) {
      const p = (nodes || []).find(n => n.id === node.parentId)
      if (p) return p
      const pc = (nodes || []).flatMap(n => n.children || []).find(c => c.id === node.parentId)
      if (pc) return pc
    }
    return null
  })()

  const processLabel = (node.isClaim || node.category === 'claim')
    ? 'Claim Created'
    : node.isEvidence
      ? 'Evidence Attached'
      : (node.isParse || node.category === 'parse')
        ? 'Parse'
        : (node.isEvaluation || node.category === 'evaluation')
          ? 'Evaluate'
          : 'Registration'

  const timestamp = node.date
    ? `${node.date}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    : '\u2014'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Provenance */}
      <div>
        <SectionLabel>Provenance</SectionLabel>
        <InfoRow
          label="Derived from"
          value={derivedFromNode ? (derivedFromNode.name || derivedFromNode.id) : (node.owner || '\u2014')}
          clickable={!!derivedFromNode}
          onClick={() => derivedFromNode && (onViewChild ? onViewChild(derivedFromNode) : onSelectAsset?.(derivedFromNode.id))}
        />
        <InfoRow label="Process" value={processLabel} />
        <InfoRow label="Timestamp" value={timestamp} mono />
      </div>

      {/* Disclosures */}
      <div>
        <SectionLabel>Disclosures</SectionLabel>
        {(() => {
          const visibleSdas = node.sdas || []
          if (visibleSdas.length === 0) {
            return (
              <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 0' }}>
                No disclosures
              </div>
            )
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {visibleSdas.map((sda, i) => {
                const connectedNode = (() => {
                  if (!nodes) return null
                  if (sda.assetPin) {
                    const m = nodes.find(n => n.pin === sda.assetPin)
                    if (m) return m
                  }
                  if (sda.assetName) {
                    const m = nodes.find(n => n.name === sda.assetName)
                    if (m) return m
                  }
                  if (sda.party) {
                    const m = nodes.find(n => n.name === sda.party || n.owner === sda.party)
                    if (m) return m
                  }
                  return null
                })()
                const displayName = sda.assetName || sda.party || '\u2014'
                return (
                  <div
                    key={sda.id || i}
                    onClick={() => connectedNode && onSelectAsset?.(connectedNode.pin || connectedNode.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '6px 8px', borderRadius: 4,
                      cursor: connectedNode ? 'pointer' : 'default',
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={e => { if (connectedNode) e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 60%, transparent)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', flexShrink: 0 }}>
                      {'\u2192'}
                    </span>
                    <span style={{
                      fontSize: 11, color: connectedNode ? 'var(--text-primary)' : 'var(--text-dim)',
                      flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {displayName}
                    </span>
                    <SDABadge type={sda.type} />
                  </div>
                )
              })}
            </div>
          )
        })()}
      </div>

      {/* Children */}
      <div>
        <SectionLabel>Children</SectionLabel>
        {(node.children && node.children.length > 0) ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {node.children.map(child => {
              const schemaLabel = child.isEvidence ? 'evidence'
                : (child.isParse || child.category === 'parse') ? 'parse'
                : (child.isEvaluation || child.category === 'evaluation') ? 'evaluation'
                : (child.isClaim || child.category === 'claim') ? 'claim'
                : 'object'
              return (
                <div
                  key={child.id}
                  onClick={() => onViewChild?.(child)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '6px 8px', borderRadius: 4,
                    cursor: 'pointer', transition: 'background 100ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--bg-raised) 60%, transparent)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                    {child.name || child.id}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                    color: 'var(--text-tertiary)', letterSpacing: '0.04em',
                  }}>
                    {schemaLabel}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic', padding: '4px 0' }}>
            No children
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Artifact Tab ───

function ArtifactTab({ node, nodes, isOwner, onViewChild }) {
  const [showModal, setShowModal] = useState(null)

  const isEvidence = !!node.isEvidence
  const isParse = node.isParse || node.category === 'parse'
  const isEvaluation = node.isEvaluation || node.category === 'evaluation'
  const isClaim = node.isClaim || node.category === 'claim'

  const timestamp = node.date
    ? `${node.date}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Section 1: Artifact URI (all nodes) ── */}
      <div>
        <SectionLabel>Artifact</SectionLabel>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-primary)', padding: '6px 10px',
          background: 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
          border: '1px solid var(--border)', borderRadius: 4,
          wordBreak: 'break-all',
        }}>
          {node.artifactUri || node.evidence?.uri || '\u2014'}
        </div>
      </div>

      {/* ── Section 2: Metadata (varies by type) ── */}
      <div>
        {isEvidence && (() => {
          const ev = node.evidence
          return ev ? (
            <>
              <InfoRow label="Filename" value={ev.filename} />
              <InfoRow label="SHA-256" value={ev.hash} copyable />
              <InfoRow label="On-chain ref" value={ev.block} copyable />
              {isOwner && <InfoRow label="Storage URI" value={ev.uri} copyable />}
              {isOwner && <InfoRow label="Provider" value={ev.provider} />}
              {ev.size && <InfoRow label="Size" value={formatFileSize(ev.size)} />}
            </>
          ) : null
        })()}

        {isParse && (
          <>
            <InfoRow label="Template" value={node.templateName || node.name} />
            <InfoRow label="Owner" value={node.templateOwner || node.owner || '\u2014'} />
            <InfoRow label="Fields" value={`${(node.parsedFields || []).length} extracted`} />
            {timestamp && <InfoRow label="Date" value={timestamp} mono />}
          </>
        )}

        {isEvaluation && (() => {
          const claims = node.claims || []
          const sat = claims.filter(c => c.status === 'satisfactory').length
          const unsat = claims.filter(c => c.status === 'unsatisfactory').length
          const miss = claims.filter(c => c.status === 'missing').length
          return (
            <>
              <InfoRow label="Requirement Set" value={
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {node.requirementSetName || '\u2014'}
                  {node.requirementSetVersion && (
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      padding: '1px 4px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                      color: 'var(--accent-indigo)',
                    }}>v{node.requirementSetVersion}</span>
                  )}
                </span>
              } />
              <InfoRow label="Evaluator" value={node.evaluatorParty || '\u2014'} />
              <InfoRow label="Evidence" value={`${(node.selectedEvidenceIds || []).length} file${(node.selectedEvidenceIds || []).length !== 1 ? 's' : ''} evaluated`} />
              <InfoRow label="Results" value={`${sat} sat \u00b7 ${unsat} unsat \u00b7 ${miss} missing`} />
              {node.creditsUsed != null && <InfoRow label="Credits" value={String(node.creditsUsed)} />}
              {timestamp && <InfoRow label="Date" value={timestamp} mono />}
            </>
          )
        })()}

        {isClaim && (
          <>
            {node.requirementSetName && <InfoRow label="Requirement Set" value={node.requirementSetName} />}
            <InfoRow label="Evidence" value={`${(node.referencedEvidenceIds || node.evidenceRefs || []).length} file${(node.referencedEvidenceIds || node.evidenceRefs || []).length !== 1 ? 's' : ''} referenced`} />
            {timestamp && <InfoRow label="Date" value={timestamp} mono />}
          </>
        )}

        {!isEvidence && !isParse && !isEvaluation && !isClaim && (
          <>
            <InfoRow label="Owner" value={node.owner || '\u2014'} />
            <InfoRow label="Evidence" value={`${(node.evidenceRefs || []).length} file${(node.evidenceRefs || []).length !== 1 ? 's' : ''}`} />
            {timestamp && <InfoRow label="Date" value={timestamp} mono />}
          </>
        )}
      </div>

      {/* ── Section 3: Results / Content (varies by type) ── */}

      {/* Evidence: PDF preview or restricted notice */}
      {isEvidence && (() => {
        const ev = node.evidence
        if (!ev) return null
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SectionLabel>File Preview</SectionLabel>
              <div style={{ flex: 1 }} />
              <ExpandButton onClick={() => setShowModal('expand')} />
            </div>
            {isOwner && ev.localPath && ev.filename?.toLowerCase().endsWith('.pdf') ? (
              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', height: 280,
              }}>
                <iframe
                  src={ev.localPath}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg-deep)' }}
                  title={ev.filename}
                />
              </div>
            ) : !isOwner ? (
              <div style={{
                padding: '10px 12px',
                background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
                borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                Some evidence details are restricted to the asset owner.
              </div>
            ) : (
              <div style={{
                padding: '16px', borderRadius: 6, textAlign: 'center',
                background: 'var(--bg-deep)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
              }}>
                File preview not available
              </div>
            )}
          </div>
        )
      })()}

      {/* Parse: ArtifactRow results table */}
      {isParse && (() => {
        const fields = node.parsedFields || []
        if (fields.length === 0) return null
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SectionLabel>Results</SectionLabel>
              <div style={{ flex: 1 }} />
              <ExpandButton onClick={() => setShowModal('expand')} />
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {fields.map((f, i) => (
                <ArtifactRow key={f.id || i} item={f} schema="parse-output" index={i} isLast={i === fields.length - 1} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Eval: ArtifactRow results table */}
      {isEvaluation && (() => {
        const claims = node.claims || []
        if (claims.length === 0) return null
        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SectionLabel>Results</SectionLabel>
              <div style={{ flex: 1 }} />
              <ExpandButton onClick={() => setShowModal('expand')} />
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              {claims.map((c, i) => (
                <ArtifactRow key={c.requirementId || i} item={c} schema="eval-output" index={i} isLast={i === claims.length - 1} />
              ))}
            </div>
          </div>
        )
      })()}

      {/* Claim: evidence refs list */}
      {isClaim && (() => {
        const referencedEvidence = (node.referencedEvidenceIds || []).map(evId =>
          (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
        ).filter(Boolean)
        const evidenceRefs = node.evidenceRefs || []

        return (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SectionLabel>Evidence References</SectionLabel>
              <div style={{ flex: 1 }} />
              <ExpandButton onClick={() => setShowModal('expand')} />
            </div>
            {referencedEvidence.length > 0 ? (
              <div style={{
                borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', background: 'var(--bg-deep)',
              }}>
                {referencedEvidence.map((ev, ei) => (
                  <div key={ev.id}
                    onClick={() => onViewChild?.(ev)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px',
                      borderBottom: ei < referencedEvidence.length - 1 ? '1px solid var(--border)' : 'none',
                      cursor: onViewChild ? 'pointer' : 'default',
                      transition: 'background 120ms',
                    }}
                    onMouseEnter={e => { if (onViewChild) e.currentTarget.style.background = 'var(--bg-raised)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = '' }}
                  >
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                      background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                      color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                    }}>EV</span>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
                      {ev.name || ev.evidence?.filename || ev.id}
                    </span>
                    <span style={{
                      fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                      background: ev._isParsed ? 'color-mix(in srgb, var(--accent-green) 12%, transparent)' : 'var(--bg-raised)',
                      color: ev._isParsed ? 'var(--accent-green)' : 'var(--text-dim)',
                      fontFamily: 'var(--font-mono)',
                    }}>{ev._isParsed ? 'PARSED' : 'UNPARSED'}</span>
                  </div>
                ))}
              </div>
            ) : evidenceRefs.length > 0 ? (
              <EvidenceRefsList refs={evidenceRefs} />
            ) : (
              <div style={{
                padding: '16px', borderRadius: 6, textAlign: 'center',
                background: 'var(--bg-deep)', border: '1px solid var(--border)',
                fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
              }}>
                No evidence referenced
              </div>
            )}
          </div>
        )
      })()}

      {/* Root asset: evidence refs list */}
      {!isClaim && !isEvidence && !isParse && !isEvaluation && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SectionLabel>Evidence References</SectionLabel>
            <div style={{ flex: 1 }} />
            <ExpandButton onClick={() => setShowModal('expand')} />
          </div>
          {(node.evidenceRefs || []).length > 0 ? (
            <EvidenceRefsList refs={node.evidenceRefs} />
          ) : (
            <div style={{
              padding: '16px', borderRadius: 6, textAlign: 'center',
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
            }}>
              No evidence files
            </div>
          )}
        </div>
      )}

      {/* Expanded modal */}
      {showModal === 'expand' && (
        <ExpandedArtifactModal node={node} nodes={nodes} onClose={() => setShowModal(null)} />
      )}
    </div>
  )
}

// ─── Main DetailPanel ───

export default function DetailPanel({ node, nodes, onClose, onViewChain, onExpandStack, onSurface, isAnchor, depth = 0, onDisclose, onConnect, onAddEvidence, onParseEvidence, onRunEvaluation, canEvaluate, onManageCascade, isOwner, onViewChild, onSelectAsset, onCancelRequest, onDismissDeclined, onRevokeSda, onReviseSda, onOpenLibrary, revealPhase, forceTab, forceExpandSda, onAmendEval, activeParty, onCreateClaim }) {
  if (!node) return null

  // ─── Provisional nodes — unchanged from V2 ───
  if (node.provisional) {
    const ctx = node.requestContext
    const isDeclined = !!node._isDeclined
    return (
      <PanelShell
        node={node}
        tabs={[]}
        tab={null}
        setTab={() => {}}
        summary={null}
        onClose={onClose}
        hasStack={false}
        hasParent={false}
        onViewChain={onViewChain}
        isEvidence={false}
        isParse={false}
        isOwner={false}
        onSurface={onSurface}
        activeParty={activeParty}
        depth={depth}
      >
        <div style={{ padding: '24px 20px' }}>
          {isDeclined ? (
            <>
              {/* Declined state */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                  border: '2px solid var(--accent-red)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', fontSize: 20, color: 'var(--accent-red)',
                }}>✕</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--accent-red)', marginBottom: 6 }}>
                  Disclosure Declined
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  <strong style={{ color: 'var(--text-tertiary)' }}>{node.owner}</strong> has declined your disclosure request for this asset.
                </div>
              </div>

              <div style={{
                background: 'var(--bg-surface)', borderRadius: 8,
                border: '1px solid var(--border)', padding: '14px 16px',
                marginBottom: 16,
              }}>
                <div style={{
                  fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 10,
                  textTransform: 'uppercase',
                }}>
                  Reason from {node.owner}
                </div>
                <div style={{
                  fontSize: 12, lineHeight: 1.7, fontStyle: 'italic',
                  padding: '8px 10px', borderRadius: 4,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  color: node._declineReason ? 'var(--text-secondary)' : 'var(--text-dim)',
                }}>
                  {node._declineReason ? `"${node._declineReason}"` : 'No reason given'}
                </div>
              </div>

              {ctx && (
                <div style={{
                  background: 'var(--bg-surface)', borderRadius: 8,
                  border: '1px solid var(--border)', padding: '14px 16px',
                  marginBottom: 16,
                }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 12,
                  }}>
                    ORIGINAL REQUEST
                  </div>
                  <div style={{ display: 'flex', marginBottom: 10, fontSize: 12 }}>
                    <span style={{ width: 90, flexShrink: 0, color: 'var(--text-dim)' }}>Requested via</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ctx.contextNodeName}</span>
                  </div>
                  <div style={{ display: 'flex', marginBottom: 10, fontSize: 12 }}>
                    <span style={{ width: 90, flexShrink: 0, color: 'var(--text-dim)' }}>Date</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{ctx.date}</span>
                  </div>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <span
                  onClick={() => onDismissDeclined?.(node)}
                  style={{
                    display: 'inline-block',
                    fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: '#fff', background: 'var(--accent-red)',
                    padding: '8px 24px', borderRadius: 6,
                    cursor: 'pointer', transition: 'opacity 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                  Remove from Network
                </span>
              </div>
            </>
          ) : (
            <>
              {/* Awaiting disclosure state */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: '50%',
                  background: 'color-mix(in srgb, var(--text-dim) 8%, transparent)',
                  border: '2px dashed var(--text-dim)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', color: 'var(--text-dim)',
                }}>
                  <svg width={24} height={24} viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="1" width="10" height="2" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <rect x="3" y="13" width="10" height="2" rx="0.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
                    <path d="M4 3v2.5L7.5 8 4 10.5V13h8v-2.5L8.5 8 12 5.5V3" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  Awaiting Disclosure
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.7 }}>
                  Request sent to <strong style={{ color: 'var(--text-tertiary)' }}>{node.owner}</strong>
                </div>
              </div>

              {ctx && (
                <div style={{
                  background: 'var(--bg-surface)', borderRadius: 8,
                  border: '1px solid var(--border)', padding: '14px 16px',
                }}>
                  <div style={{
                    fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 600,
                    color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 12,
                  }}>
                    REQUEST DETAILS
                  </div>

                  <div style={{ display: 'flex', marginBottom: 10, fontSize: 12 }}>
                    <span style={{ width: 90, flexShrink: 0, color: 'var(--text-dim)' }}>Requested via</span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{ctx.contextNodeName}</span>
                  </div>

                  <div style={{ display: 'flex', marginBottom: 10, fontSize: 12 }}>
                    <span style={{ width: 90, flexShrink: 0, color: 'var(--text-dim)' }}>Date</span>
                    <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)' }}>{ctx.date}</span>
                  </div>

                  {ctx.requirements && ctx.requirements.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Requirements</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {ctx.requirements.map((req, i) => (
                          <div key={i} style={{
                            fontSize: 11,
                            padding: '6px 10px', borderRadius: 4,
                            background: 'var(--bg-card)',
                            border: '1px solid var(--border)',
                          }}>
                            {typeof req === 'string'
                              ? <span style={{ color: 'var(--text-secondary)' }}>{req}</span>
                              : (
                                <span
                                  onClick={() => onOpenLibrary?.(req.id)}
                                  style={{
                                    color: 'var(--accent-indigo)', cursor: 'pointer',
                                    transition: 'opacity 100ms',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
                                  onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                                >
                                  {req.name}
                                  {req.version && <span style={{
                                    fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                    marginLeft: 6, padding: '1px 5px', borderRadius: 3,
                                    background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                                    color: 'var(--accent-indigo)',
                                  }}>v{req.version}</span>}
                                </span>
                              )
                            }
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {ctx.message && (
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 6 }}>Message</div>
                      <div style={{
                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7,
                        padding: '8px 10px', borderRadius: 4,
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        fontStyle: 'italic',
                      }}>
                        "{ctx.message}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <span
                  onClick={() => onCancelRequest?.(node)}
                  style={{
                    fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-red)',
                    cursor: 'pointer', borderBottom: '1px solid transparent',
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'var(--accent-red)'}
                  onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
                >
                  Cancel Request
                </span>
              </div>
            </>
          )}
        </div>
      </PanelShell>
    )
  }

  // ─── Unified two-tab panel for all non-provisional nodes ───

  const isNodeEvidence = !!node.isEvidence
  const isNodeParse = node.isParse || node.category === 'parse'
  const isNodeEval = node.isEvaluation || node.category === 'evaluation'
  const isNodeClaim = node.isClaim || node.category === 'claim'

  const [tab, setTab] = useState('overview')
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'artifact', label: 'Artifact' },
  ]

  // Reset tab on node change or forceTab
  useEffect(() => {
    if (forceTab && (forceTab === 'overview' || forceTab === 'artifact')) {
      setTab(forceTab)
    } else {
      setTab('overview')
    }
  }, [node.id, forceTab])

  // Build summary line
  const summary = useMemo(() => {
    if (isNodeEvidence) {
      return isOwner ? node.evidence?.filename : `Evidence attached${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    }
    if (isNodeParse) {
      const fc = node.parsedFields?.length || 0
      return `${fc} field${fc !== 1 ? 's' : ''} parsed${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    }
    if (isNodeEval) {
      return `${(node.claims?.length || 0)} claim${(node.claims?.length || 0) !== 1 ? 's' : ''} evaluated by ${node.evaluatorParty || node.owner} on ${node.date || '\u2014'}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    }
    if (isNodeClaim) {
      return `Claim created${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` \u00b7 ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`
    }
    // Regular nodes — health summary
    const h = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
    const segments = []
    if (h.ok) segments.push(`${h.ok} satisfactory`)
    if (h.warn) segments.push(`${h.warn} missing`)
    if (h.bad) segments.push(`${h.bad} unsatisfactory`)
    return segments.length ? segments.join(' \u00b7 ') : null
  }, [node, isOwner])

  return (
    <PanelShell
      node={isNodeEval ? { ...node, description: summary } : node}
      tabs={[]}
      tab={null}
      setTab={() => {}}
      summary={isNodeEval ? null : summary}
      onClose={onClose}
      hasStack={node.hasStack && !isAnchor}
      hasParent={isAnchor || depth > 0}
      onViewChain={onViewChain}
      onExpandStack={onExpandStack}
      onSurface={onSurface}
      isAnchor={isAnchor}
      onConnect={onConnect}
      onDisclose={onDisclose}
      onAddEvidence={onAddEvidence}
      onParseEvidence={onParseEvidence}
      onRunEvaluation={() => onRunEvaluation && onRunEvaluation(node)}
      canEvaluate={canEvaluate}
      canAssetEvaluate={!node.isEvidence && !node.isParse && !node.isEvaluation && isOwner}
      isEvidence={isNodeEvidence}
      isParse={isNodeParse}
      isEvaluation={isNodeEval}
      isClaim={isNodeClaim}
      isOwner={isOwner}
      onAmendEval={onAmendEval}
      onCreateClaim={onCreateClaim}
      activeParty={activeParty}
      depth={depth}
    >
      {/* Two-tab bar — V3 underline style */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        marginBottom: 14,
        marginTop: -14,
      }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 16px',
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
              color: tab === t.id ? 'var(--text-primary)' : 'var(--text-tertiary)',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent-amber, #C49A45)' : '2px solid transparent',
              cursor: 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              fontWeight: tab === t.id ? 600 : 400,
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={
        revealPhase === 'panel'
          ? { animation: 'panelRowFade 500ms ease-out forwards' }
          : revealPhase && revealPhase !== 'done' && revealPhase !== 'panel'
            ? { opacity: 0 }
            : undefined
      }>
        {tab === 'overview' && (
          <OverviewTab
            node={node}
            nodes={nodes}
            isOwner={isOwner}
            onViewChild={onViewChild}
            onSelectAsset={onSelectAsset}
          />
        )}
        {tab === 'artifact' && (
          <ArtifactTab
            node={node}
            nodes={nodes}
            isOwner={isOwner}
            onViewChild={onViewChild}
          />
        )}
      </div>
    </PanelShell>
  )
}
