import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import EvaluationsTab from './EvaluationsTab'
import ChildrenTab from './ChildrenTab'
import DisclosuresTab from './DisclosuresTab'
import ParsedFieldsTab from './ParsedFieldsTab'
import DataTable from './shared/DataTable'
import ClaimsTable from './shared/ClaimsTable'
import { TableActions, claimsToCSV } from './shared/TableActions'
import TableModal from './shared/TableModal'
import CopyBadge from './shared/CopyBadge'
import { Tip } from './shared/Tooltip'

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

export default function DetailPanel({ node, nodes, onClose, onViewChain, onExpandStack, onSurface, isAnchor, depth = 0, onDisclose, onConnect, onAddEvidence, onParseEvidence, onRunEvaluation, canEvaluate, onManageCascade, isOwner, onViewChild, onSelectAsset, onCancelRequest, onDismissDeclined, onRevokeSda, onReviseSda, onOpenLibrary, revealPhase, forceTab, forceExpandSda, onAmendEval, activeParty, onCreateClaim }) {
  if (!node) return null

  // Provisional nodes get a minimal panel with request context
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

  // Evaluation nodes get a specialized panel — no tabs
  if (node.isEvaluation || node.category === 'evaluation') {
    const claims = node.claims || []
    const sat = claims.filter(c => c.status === 'satisfactory').length
    const unsat = claims.filter(c => c.status === 'unsatisfactory').length
    const miss = claims.filter(c => c.status === 'missing').length
    return (
      <PanelShell
        node={{
          ...node,
          description: `${(node.claims?.length || 0)} claim${(node.claims?.length || 0) !== 1 ? 's' : ''} evaluated by ${node.evaluatorParty || node.owner} on ${node.date || '—'}${node.dateTime ? ` · ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`,
        }}
        tabs={[]}
        tab={null}
        setTab={() => {}}
        summary={null}
        onClose={onClose}
        hasStack={false}
        hasParent={isAnchor || depth > 0}
        onViewChain={onViewChain}
        onSurface={onSurface}
        isEvidence={false}
        isParse={false}
        isEvaluation
        isOwner={isOwner}
        depth={depth}
        onAmendEval={onAmendEval}
        activeParty={activeParty}
      >
        <div style={{ padding: '4px 0' }}>
          {/* Header badges */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
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
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'var(--accent-orange)', letterSpacing: '0.05em',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>&#9703;</span>
                EVIDENCE EVALUATED · {node.selectedEvidenceIds.length}
              </div>
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

          {/* Claims table */}
          {claims.length > 0 && (
            <EvalClaimsSection claims={claims} nodeName={node.name} />
          )}

          {/* Credits used */}
          {node.creditsUsed != null && (
            <div style={{ marginTop: 14, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Credits used: {node.creditsUsed}
            </div>
          )}
        </div>
      </PanelShell>
    )
  }

  // Parse nodes get a tabless panel — just their parsed fields
  if (node.isParse || node.category === 'parse') {
    const fields = node.parsedFields || []
    return (
      <PanelShell
        node={node}
        tabs={[]}
        tab={null}
        setTab={() => {}}
        summary={`${fields.length} field${fields.length !== 1 ? 's' : ''} parsed${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` · ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`}
        onClose={onClose}
        hasStack={false}
        hasParent={isAnchor || depth > 0}
        onViewChain={onViewChain}
        onSurface={onSurface}
        isEvidence={false}
        isParse
        isEvaluation={false}
        isOwner={isOwner}
        onParseEvidence={onParseEvidence}
        activeParty={activeParty}
        depth={depth}
      >
        <ParsedFieldsTab fields={fields} isSelective={!!node._isSelective} />
      </PanelShell>
    )
  }

  // Evidence nodes get a tabless panel — flat DataTable of evidence metadata
  if (node.isEvidence) {
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

    return (
      <PanelShell
        node={node}
        tabs={[]}
        tab={null}
        setTab={() => {}}
        summary={isOwner ? ev?.filename : `Evidence attached${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` · ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`}
        onClose={onClose}
        hasStack={false}
        hasParent={isAnchor || depth > 0}
        onViewChain={onViewChain}
        onSurface={onSurface}
        isEvidence
        isParse={false}
        isEvaluation={false}
        isOwner={isOwner}
        onParseEvidence={onParseEvidence}
        canEvaluate={canEvaluate}
        onRunEvaluation={onRunEvaluation}
        activeParty={activeParty}
        depth={depth}
      >
        {ev ? (
          <div>
            {/* PDF preview — owner only */}
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
                    if (row.copyable) {
                      return <CopyBadge value={value} truncated />
                    }
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
        )}
      </PanelShell>
    )
  }

  // Claim nodes get a specialized panel — tabless
  if (node.isClaim || node.category === 'claim') {
    const claimEvals = (nodes || []).flatMap(n => n.children || []).filter(c =>
      (c.isEvaluation || c.category === 'evaluation') && c.claimId === node.id
    )
    const activeEvals = claimEvals.filter(e => e.status !== 'superseded')
    const referencedEvidence = (node.referencedEvidenceIds || []).map(evId => {
      return (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
    }).filter(Boolean)

    return (
      <PanelShell
        node={{
          ...node,
          description: `Claim created${node.date ? ` on ${node.date}` : ''}${node.dateTime ? ` · ${new Date(node.dateTime).toISOString().slice(11, 16)} UTC` : ''}`,
        }}
        tabs={[]}
        tab={null}
        setTab={() => {}}
        summary={null}
        onClose={onClose}
        hasStack={false}
        hasParent={isAnchor || depth > 0}
        onViewChain={onViewChain}
        onSurface={onSurface}
        isEvidence={false}
        isParse={false}
        isEvaluation={false}
        isClaim
        isOwner={isOwner}
        onAddEvidence={onAddEvidence}
        onRunEvaluation={() => onRunEvaluation && onRunEvaluation(node)}
        canAssetEvaluate={true}
        activeParty={activeParty}
        depth={depth}
      >
        <div style={{ padding: '4px 0' }}>
          {/* Requirement set badge */}
          <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            {node.requirementSetVersion && (
              <span style={{
                fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                padding: '1px 5px', borderRadius: 3,
                background: 'color-mix(in srgb, var(--accent-teal) 10%, transparent)',
                color: 'var(--accent-teal)',
              }}>v{node.requirementSetVersion}</span>
            )}
            {node.requirementSetName && (
              <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                {node.requirementSetName}
              </span>
            )}
          </div>

          {/* Referenced evidence */}
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
              color: 'var(--accent-orange)', letterSpacing: '0.05em',
              marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span style={{ fontSize: 12 }}>&#9703;</span>
              REFERENCED EVIDENCE · {referencedEvidence.length}
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

          {/* Evaluations */}
          {activeEvals.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'var(--accent-indigo)', letterSpacing: '0.05em',
                marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 12 }}>{'\u2726'}</span>
                EVALUATIONS · {activeEvals.length}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {activeEvals.map(ev => {
                  const sat = (ev.claims || []).filter(c => c.status === 'satisfactory').length
                  const unsat = (ev.claims || []).filter(c => c.status === 'unsatisfactory').length
                  return (
                    <div key={ev.id} style={{
                      padding: '10px 12px', borderRadius: 6,
                      background: 'var(--bg-deep)', border: '1px solid var(--border)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{ev.name}</span>
                        {ev.requirementSetVersion && (
                          <span style={{
                            fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '1px 4px', borderRadius: 3,
                            background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                            color: 'var(--accent-indigo)',
                          }}>v{ev.requirementSetVersion}</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                        {ev.evaluatorParty || ev.owner} · {sat} sat · {unsat} unsat
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Claims from requirement set */}
          {node.claims && node.claims.length > 0 && (
            <EvalClaimsSection claims={node.claims} nodeName={node.name} />
          )}
        </div>
      </PanelShell>
    )
  }

  // Build evals from child eval nodes
  const evals = useMemo(() => {
    return (node.children || [])
      .filter(c => c.isEvaluation || c.category === 'evaluation')
      .map(ev => ({
        id: ev.id,
        org: ev.evaluatorParty || ev.owner,
        orgDot: ev.dot,
        date: ev.date,
        requirements: ev.requirementSetName || ev.name,
        status: ev.status || 'completed',
        previousEvalId: ev.previousEvalId || null,
        evalVersion: ev.evalVersion || 1,
        requirementSetId: ev.requirementSetId || null,
        creditsUsed: ev.creditsUsed || 0,
        reviewer: ev.evaluatorParty || ev.owner,
        reviewDate: ev.date,
        dateTime: ev.dateTime || null,
        claims: (ev.claims || []).map(c => ({
          label: c.label || c.requirementId,
          description: c.description,
          humanValue: c.humanValue,
          aiValue: c.aiValue,
          aiConfidence: c.aiConfidence,
          type: c.type === 'extraction' ? 'extraction' : 'inference',
          status: c.status,
          requirementId: c.requirementId,
        })),
      }))
  }, [node])

  const claimChildren = useMemo(() => {
    return (node.children || []).filter(c => c.isClaim || c.category === 'claim')
  }, [node])

  // Decide which tabs to show based on populated fields
  const tabs = useMemo(() => {
    const t = []
    const hasClaims = claimChildren.length > 0
    if (hasClaims) {
      t.push({ id: 'claims', label: `Claims · ${claimChildren.length}` })
    } else {
      const hasEvals = evals.length > 0
      const hasEvidenceChildren = node.children?.some(c => c.isEvidence)
      const showEvalTab = hasEvals || hasEvidenceChildren || isOwner
      if (showEvalTab)
        t.push({ id: 'evaluations', label: `Evaluations · ${evals.length}` })
    }
    if (node.children?.length)
      t.push({ id: 'children', label: `Children · ${node.children.length}` })
    if (node.sdas?.length && !node.isEvidence)
      t.push({ id: 'disclosures', label: `Disclosures · ${node.sdas.length}` })
    const hasParsedFields = node.parsedFields?.length > 0
    if (hasParsedFields)
      t.push({ id: 'parsed', label: `Parsed Fields · ${node.parsedFields.length}` })
    return t
  }, [node, isOwner])

  const [tab, setTab] = useState(() => tabs[0]?.id || 'evaluations')
  const [expandedTable, setExpandedTable] = useState(null)

  // Switch to disclosures tab when reveal animation reaches panel phase
  useEffect(() => {
    if (revealPhase === 'panel' && tabs.some(t => t.id === 'disclosures')) {
      setTab('disclosures')
    }
  }, [revealPhase])

  // Always reset to first tab and clear eval state on node change, then apply forceTab
  useEffect(() => {
    if (tabs.length > 0) {
      setTab(forceTab && tabs.some(t => t.id === forceTab) ? forceTab : tabs[0].id)
    }
    setEvalOpen({})
    setClaimsOpen({})
    setEvOpen(false)
  }, [node.id, forceTab])

  // Eval panel state (lifted)
  const [evalOpen, setEvalOpen] = useState({})
  const [claimsOpen, setClaimsOpen] = useState({})
  const [evOpen, setEvOpen] = useState(false)

  const toggleEval = useCallback(i => setEvalOpen(p => ({ ...p, [i]: !p[i] })), [])
  const toggleClaims = useCallback(i => setClaimsOpen(p => ({ ...p, [i]: !p[i] })), [])
  const expandAll = useCallback(() => {
    const o = {}
    evals.forEach((_, i) => { o[i] = true })
    setEvalOpen(o)
  }, [evals])
  const collapseAll = useCallback(() => {
    const o = {}
    evals.forEach((_, i) => { o[i] = false })
    setEvalOpen(o)
    setClaimsOpen(o)
  }, [evals])

  // Paperclip click: switch to evals tab, then unfurl evidence after paint
  const handleClipClick = useCallback(() => {
    setTab('evaluations')
    requestAnimationFrame(() => requestAnimationFrame(() => setEvOpen(true)))
  }, [])

  // Compute summary line
  const summary = useMemo(() => {
    const parts = []
    const h = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
    const segments = []
    if (h.ok) segments.push(`${h.ok} satisfactory`)
    if (h.warn) segments.push(`${h.warn} missing`)
    if (h.bad) segments.push(`${h.bad} unsatisfactory`)
    if (segments.length) parts.push(segments.join(' · '))

    // Child claim count — count all children's claims
    const childNodes = node.children || []
    if (childNodes.length > 0) {
      let totalChildClaims = 0
      for (const c of childNodes) {
        const ch = c.displayHealth || c.health || { ok: 0, warn: 0, bad: 0 }
        totalChildClaims += ch.ok + (ch.warn || 0) + ch.bad
      }
      if (totalChildClaims > 0) {
        parts.push(`${totalChildClaims} claims across ${childNodes.length} children`)
      }
    }

    if (!parts.length && evals.length) parts.push(`${evals.length} evaluations`)
    return parts.join(' · ') || null
  }, [node])

  return (
    <PanelShell
      node={node}
      tabs={tabs}
      tab={tab}
      setTab={setTab}
      summary={summary}
      onClose={onClose}
      onClipClick={node.hasEvidence ? handleClipClick : undefined}
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
      isEvidence={!!node.isEvidence}
      isParse={!!node.isParse || node.category === 'parse'}
      isEvaluation={!!node.isEvaluation}
      isClaim={false}
      isOwner={isOwner}
      onAmendEval={onAmendEval}
      onCreateClaim={onCreateClaim}
      activeParty={activeParty}
      depth={depth}
    >
      {/* Conditionally mounted tabs — only render if tab exists in tabs array */}
      <div style={
        revealPhase === 'panel'
          ? { animation: 'panelRowFade 500ms ease-out forwards' }
          : revealPhase && revealPhase !== 'done' && revealPhase !== 'panel'
            ? { opacity: 0 }
            : undefined
      }>
      {tabs.some(t => t.id === 'evaluations') && (
        <div style={{ display: tab === 'evaluations' ? 'block' : 'none' }}>
          <EvaluationsTab
            evidence={node.evidence}
            evals={evals}
            evalOpen={evalOpen}
            claimsOpen={claimsOpen}
            toggleEval={toggleEval}
            toggleClaims={toggleClaims}
            expandAll={expandAll}
            collapseAll={collapseAll}
            evOpen={evOpen}
            toggleEv={() => setEvOpen(p => !p)}
            isOwner={isOwner}
            isEvidence={!!node.isEvidence}
            attributedClaims={node.attributedClaims}
            onRunEvaluation={() => onRunEvaluation && onRunEvaluation(node)}
            canEvaluate={canEvaluate}
            canAssetEvaluate={!node.isEvidence && !node.isParse && node.children?.some(c => c.isParse || c.category === 'parse')}
            onAmendEval={onAmendEval}
            activeParty={activeParty}
          />
        </div>
      )}
      {tabs.some(t => t.id === 'claims') && (
        <div style={{ display: tab === 'claims' ? 'block' : 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {claimChildren.map(claim => {
              const h = claim.displayHealth || claim.health || { ok: 0, warn: 0, bad: 0 }
              const totalClaims = h.ok + (h.warn || 0) + h.bad
              const evCount = (claim.referencedEvidenceIds || []).length
              return (
                <div
                  key={claim.id}
                  onClick={() => onViewChild?.(claim)}
                  style={{
                    padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border)',
                    transition: 'border-color 150ms',
                  }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-teal)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: 'var(--accent-teal)', fontFamily: 'var(--font-mono)' }}>{'\u25C7'}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{claim.name}</span>
                    {claim.requirementSetVersion && (
                      <span style={{
                        fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                        padding: '1px 5px', borderRadius: 3,
                        background: 'color-mix(in srgb, var(--accent-teal) 10%, transparent)',
                        color: 'var(--accent-teal)',
                      }}>v{claim.requirementSetVersion}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
                    <span>{evCount} evidence</span>
                    {totalClaims > 0 && <span>{h.ok} sat · {h.bad} unsat</span>}
                    {totalClaims === 0 && <span>No evaluations</span>}
                  </div>
                  {totalClaims > 0 && (
                    <div style={{ marginTop: 6, height: 3, borderRadius: 1.5, background: 'var(--border)', display: 'flex', gap: 1, overflow: 'hidden' }}>
                      {h.ok > 0 && <div style={{ width: `${(h.ok / totalClaims) * 100}%`, background: 'var(--accent-green)', borderRadius: 1.5 }} />}
                      {h.bad > 0 && <div style={{ width: `${(h.bad / totalClaims) * 100}%`, background: 'var(--accent-red)', borderRadius: 1.5 }} />}
                    </div>
                  )}
                </div>
              )
            })}
            {isOwner && onCreateClaim && (
              <button
                onClick={() => onCreateClaim(node)}
                style={{
                  width: '100%', padding: '10px 0', borderRadius: 6, cursor: 'pointer',
                  border: '1px dashed var(--border)',
                  background: 'transparent', color: 'var(--text-tertiary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'border-color 150ms, color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-teal)'; e.currentTarget.style.color = 'var(--accent-teal)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-tertiary)' }}
              >
                <span>{'\u25C7'}</span> Create Claim
              </button>
            )}
          </div>
        </div>
      )}
      {tabs.some(t => t.id === 'children') && (
        <div style={{ display: tab === 'children' ? 'block' : 'none' }}>
          <ChildrenTab children={node.children || []} parentOwner={node.owner} onViewChild={onViewChild} />
        </div>
      )}
      {tabs.some(t => t.id === 'disclosures') && (
        <div style={{ display: tab === 'disclosures' ? 'block' : 'none' }}>
          <DisclosuresTab sdas={node.sdas || []} onDisclose={onDisclose} node={node} nodes={nodes} onManageCascade={onManageCascade} isOwner={isOwner} onSelectAsset={onSelectAsset} onRevokeSda={onRevokeSda} onReviseSda={onReviseSda} forceExpandSda={forceExpandSda} onViewEvidence={onViewChild ? (evId) => {
            const evNode = (node.children || []).find(c => c.id === evId)
              || (nodes || []).flatMap(n => n.children || []).find(c => c.id === evId)
            if (evNode) onViewChild(evNode)
          } : undefined} />
        </div>
      )}
      {tabs.some(t => t.id === 'parsed') && (
        <div style={{ display: tab === 'parsed' ? 'block' : 'none' }}>
          <ParsedFieldsTab fields={node.parsedFields || []} isSelective={!!node._isSelective} nodeName={node.name} />
        </div>
      )}
      </div>
      {expandedTable?.type === 'claims' && (
        <TableModal title={expandedTable.title} onClose={() => setExpandedTable(null)}>
          <ClaimsTable claims={expandedTable.claims} maxHeight={9999} />
        </TableModal>
      )}
    </PanelShell>
  )
}
