import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import ParsedFieldsTab from './ParsedFieldsTab'
import DataTable from './shared/DataTable'
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
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          borderBottom: i < refs.length - 1 ? '1px solid var(--border)' : 'none',
        }}>
          <span style={{
            fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
            background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
            color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
          }}>EV</span>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {ref.label || ref.filename}
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', flexShrink: 0 }}>
            {formatFileSize(ref.size)}
          </span>
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

// ─── Overview Tab ───

function OverviewTab({ node, nodes, isOwner, onViewChild, onSelectAsset }) {
  const parentNode = node.parentId
    ? (nodes || []).find(n => n.id === node.parentId)
      || (nodes || []).flatMap(n => n.children || []).find(c => c.id === node.parentId)
    : null

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
          value={parentNode ? (parentNode.name || parentNode.id) : (node.owner || '\u2014')}
          clickable={!!parentNode}
          onClick={() => parentNode && (onViewChild ? onViewChild(parentNode) : onSelectAsset?.(parentNode.id))}
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

  const artifactUri = node.artifactUri || node.evidence?.uri || '\u2014'

  const isEvidence = !!node.isEvidence
  const isParse = node.isParse || node.category === 'parse'
  const isEvaluation = node.isEvaluation || node.category === 'evaluation'
  const isClaim = node.isClaim || node.category === 'claim'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Artifact URI */}
      <div>
        <SectionLabel>Artifact URI</SectionLabel>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 10,
          color: 'var(--text-primary)', padding: '6px 10px',
          background: 'color-mix(in srgb, var(--bg-raised) 50%, transparent)',
          border: '1px solid var(--border)', borderRadius: 4,
          wordBreak: 'break-all',
        }}>
          {artifactUri}
        </div>
      </div>

      {/* === Claim nodes === */}
      {isClaim && (() => {
        const referencedEvidence = (node.referencedEvidenceIds || []).map(evId => {
          return (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
        }).filter(Boolean)
        const evidenceRefs = node.evidenceRefs || []

        return (
          <>
            <div>
              <SectionLabel>Evidence References</SectionLabel>
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
                        padding: '6px 10px',
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
                  padding: '12px 14px', borderRadius: 6,
                  background: 'var(--bg-deep)', border: '1px solid var(--border)',
                  fontSize: 11, color: 'var(--text-dim)', fontStyle: 'italic',
                }}>
                  No evidence referenced
                </div>
              )}
            </div>
            {node.claims && node.claims.length > 0 && (
              <EvalClaimsSection claims={node.claims} nodeName={node.name} />
            )}
          </>
        )
      })()}

      {/* === Evidence nodes === */}
      {isEvidence && (() => {
        const ev = node.evidence
        const evidenceRows = []
        if (ev) {
          evidenceRows.push({ label: 'SHA-256', value: ev.hash, copyable: true })
          evidenceRows.push({ label: 'On-chain ref', value: ev.block, copyable: true })
          if (isOwner) {
            evidenceRows.push({ label: 'Filename', value: ev.filename })
            evidenceRows.push({ label: 'Storage URI', value: ev.uri, copyable: true })
            evidenceRows.push({ label: 'Provider', value: ev.provider })
          }
        }
        return ev ? (
          <div>
            {isOwner && ev.localPath && ev.filename?.toLowerCase().endsWith('.pdf') && (
              <div style={{
                marginBottom: 14, borderRadius: 6, overflow: 'hidden',
                border: '1px solid var(--border)', height: 280,
              }}>
                <iframe
                  src={ev.localPath}
                  style={{ width: '100%', height: '100%', border: 'none', background: 'var(--bg-deep)' }}
                  title={ev.filename}
                />
              </div>
            )}
            <DataTable
              columns={[
                { key: 'label', width: 120, color: 'var(--text-dim)' },
                {
                  key: 'value', width: 'flex', mono: true,
                  render: (value, row) => {
                    if (row.copyable) return <CopyBadge value={value} truncated />
                    return <span style={{ color: 'var(--text-secondary)' }}>{value}</span>
                  },
                },
              ]}
              rows={evidenceRows}
              compact
            />
            {!isOwner && (
              <div style={{
                marginTop: 12, padding: '10px 12px',
                background: 'color-mix(in srgb, var(--accent-amber) 5%, transparent)',
                border: '1px solid color-mix(in srgb, var(--accent-amber) 15%, transparent)',
                borderRadius: 6, fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.6,
              }}>
                Some evidence details are restricted to the asset owner.
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding: '24px 0', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
            Evidence metadata not available
          </div>
        )
      })()}

      {/* === Parse output nodes === */}
      {isParse && (() => {
        const fields = node.parsedFields || []
        return (
          <div>
            {node.templateName && (
              <div style={{ marginBottom: 12 }}>
                <SectionLabel>Template</SectionLabel>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {node.templateName}{node.templateOwner ? ` \u00b7 ${node.templateOwner}` : ''}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <SectionLabel>Results</SectionLabel>
              <div style={{ flex: 1 }} />
              <ExpandButton onClick={() => setShowModal('parse')} />
            </div>
            <ParsedFieldsTab fields={fields} isSelective={!!node._isSelective} />
            <div style={{
              marginTop: 8, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)',
            }}>
              {fields.length} field{fields.length !== 1 ? 's' : ''} extracted
            </div>
          </div>
        )
      })()}

      {/* === Evaluation output nodes === */}
      {isEvaluation && (() => {
        const claims = node.claims || []
        const sat = claims.filter(c => c.status === 'satisfactory').length
        const unsat = claims.filter(c => c.status === 'unsatisfactory').length
        const miss = claims.filter(c => c.status === 'missing').length
        return (
          <div>
            {/* Header badges */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {node.requirementSetName && (
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {node.requirementSetName}
                </span>
              )}
              {node.requirementSetVersion && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '1px 5px', borderRadius: 3,
                  background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                  color: 'var(--accent-indigo)',
                }}>v{node.requirementSetVersion}</span>
              )}
              {node.disclosureType && (
                <span style={{
                  fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 6px', borderRadius: 3,
                  textTransform: 'uppercase',
                  color: node.disclosureType === 'full' ? 'var(--accent-indigo)' : 'var(--accent-amber)',
                  background: node.disclosureType === 'full'
                    ? 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)'
                    : 'color-mix(in srgb, var(--accent-amber) 10%, transparent)',
                }}>{node.disclosureType}</span>
              )}
            </div>

            {/* Summary bar */}
            <div style={{
              padding: '10px 14px', borderRadius: 8, marginBottom: 14,
              background: 'var(--bg-deep)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 14,
              fontSize: 11, fontFamily: 'var(--font-mono)',
            }}>
              <span style={{ color: 'var(--text-dim)' }}>{claims.length} claims</span>
              <span style={{ color: 'var(--accent-green)' }}>{sat} satisfactory</span>
              <span style={{ color: 'var(--accent-red)' }}>{unsat} unsatisfactory</span>
              <span style={{ color: 'var(--text-dim)' }}>{miss} missing</span>
            </div>

            {/* Evidence used */}
            {node.selectedEvidenceIds && node.selectedEvidenceIds.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <SectionLabel>Evidence Evaluated · {node.selectedEvidenceIds.length}</SectionLabel>
                <div style={{
                  borderRadius: 6, overflow: 'hidden',
                  border: '1px solid var(--border)', background: 'var(--bg-deep)',
                }}>
                  {node.selectedEvidenceIds.map((evId, ei) => {
                    const evNode = nodes?.flatMap(n => n.children || []).find(c => c.id === evId)
                    return (
                      <div key={evId} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px',
                        borderBottom: ei < node.selectedEvidenceIds.length - 1 ? '1px solid var(--border)' : 'none',
                      }}>
                        <span style={{
                          fontSize: 8, fontWeight: 700, padding: '1px 4px', borderRadius: 3,
                          background: 'color-mix(in srgb, var(--accent-orange) 12%, transparent)',
                          color: 'var(--accent-orange)', fontFamily: 'var(--font-mono)',
                        }}>EV</span>
                        <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
                          {evNode?.name || evNode?.evidence?.filename || evId}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Claims table with expand */}
            {claims.length > 0 && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <div style={{ flex: 1 }} />
                  <ExpandButton onClick={() => setShowModal('eval')} />
                </div>
                <EvalClaimsSection claims={claims} nodeName={node.name} />
              </div>
            )}

            {/* Credits used */}
            {node.creditsUsed != null && (
              <div style={{ marginTop: 14, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                Credits used: {node.creditsUsed}
              </div>
            )}
          </div>
        )
      })()}

      {/* === Regular/legacy nodes === */}
      {!isClaim && !isEvidence && !isParse && !isEvaluation && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <SectionLabel>Metadata</SectionLabel>
            <InfoRow label="Name" value={node.name} />
            <InfoRow label="Owner" value={node.owner || '\u2014'} />
            {node.date && <InfoRow label="Created" value={node.date} mono />}
          </div>
          {(node.evidenceRefs || []).length > 0 && (
            <div>
              <SectionLabel>Evidence References</SectionLabel>
              <EvidenceRefsList refs={node.evidenceRefs} />
            </div>
          )}
        </div>
      )}

      {/* Expanded modal for parse/eval */}
      {showModal === 'parse' && (
        <TableModal title={`${node.name} \u2014 Parsed Fields`} onClose={() => setShowModal(null)}>
          <ParsedFieldsTab fields={node.parsedFields || []} isSelective={!!node._isSelective} />
        </TableModal>
      )}
      {showModal === 'eval' && (
        <TableModal title={`${node.name} \u2014 Claims`} onClose={() => setShowModal(null)}>
          <ClaimsTable claims={node.claims || []} maxHeight={9999} />
        </TableModal>
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
