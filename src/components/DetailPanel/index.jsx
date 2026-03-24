import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import EvaluationsTab from './EvaluationsTab'
import ChildrenTab from './ChildrenTab'
import DisclosuresTab from './DisclosuresTab'
import ParsedFieldsTab from './ParsedFieldsTab'
import DataTable from './shared/DataTable'
import CopyBadge from './shared/CopyBadge'
import { Tip } from './shared/Tooltip'
import { CLAIM_STATUS } from '../../v2/evaluationHelpers.js'

export default function DetailPanel({ node, onClose, onViewChain, onExpandStack, onSurface, isAnchor, depth = 0, onDisclose, onConnect, onAddEvidence, onParseEvidence, onRunEvaluation, canEvaluate, onManageCascade, isOwner, onViewChild, onSelectAsset, onCancelRequest, onDismissDeclined, onRevokeSda, onOpenLibrary }) {
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
                  margin: '0 auto 14px', fontSize: 20, color: 'var(--text-dim)',
                }}>⏳</div>
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
        node={node}
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
      >
        <div style={{ padding: '4px 0' }}>
          {/* Header info */}
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
            <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              Evaluated by {node.evaluator || node.owner} · {node.date}
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

          {/* Claims table */}
          {claims.length > 0 && (
            <div>
              <div style={{
                fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700,
                color: 'var(--text-dim)', letterSpacing: '0.06em', marginBottom: 8,
              }}>
                CLAIMS ({claims.length})
              </div>
              <DataTable
                columns={[
                  {
                    key: 'type', header: null, width: 60,
                    render: (value) => (
                      <Tip text={value === 'extraction' ? 'Extraction — AI finds a specific value' : 'Inference — AI determines if a condition holds'}>
                        <span style={{
                          fontSize: 8, fontFamily: 'var(--font-mono)', fontWeight: 700,
                          padding: '2px 6px', borderRadius: 3,
                          color: value === 'extraction' ? 'var(--accent-cyan)' : 'var(--accent-amber)',
                          background: value === 'extraction'
                            ? 'color-mix(in srgb, var(--accent-cyan) 12%, transparent)'
                            : 'color-mix(in srgb, var(--accent-amber) 12%, transparent)',
                          cursor: 'default',
                        }}>
                          {value === 'extraction' ? 'EXT' : 'INF'}
                        </span>
                      </Tip>
                    ),
                  },
                  { key: 'label', header: 'Requirement', width: 'flex', bold: true, color: 'var(--text-primary)' },
                  {
                    key: 'humanValue', header: 'Value', width: 120, mono: true,
                    render: (value, row) => (
                      <span style={{ color: 'var(--text-primary)' }}>
                        {value || row.aiValue || '—'}
                      </span>
                    ),
                  },
                  {
                    key: 'aiConfidence', header: 'Conf.', width: 60, mono: true,
                    render: (value) => {
                      const pct = Math.round((value || 0) * 100)
                      const color = pct >= 90 ? 'var(--accent-green)' : pct >= 80 ? 'var(--accent-amber)' : 'var(--accent-red)'
                      return <span style={{ fontSize: 10, color }}>{pct}%</span>
                    },
                  },
                  {
                    key: 'status', header: 'Result', width: 100,
                    render: (value) => {
                      const cfg = CLAIM_STATUS[value]
                      if (!cfg) return <span style={{ color: 'var(--text-dim)' }}>—</span>
                      return (
                        <Tip text={cfg.label}>
                          <span style={{
                            fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 700,
                            padding: '2px 7px', borderRadius: 4,
                            color: cfg.color,
                            background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`,
                            cursor: 'default',
                          }}>
                            {cfg.short}
                          </span>
                        </Tip>
                      )
                    },
                  },
                ]}
                rows={claims}
                maxRows={8}
                compact
              />
            </div>
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
        summary={`${fields.length} parsed field${fields.length !== 1 ? 's' : ''}`}
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
      evidenceRows.push({ label: 'Retention', value: ev.retention })
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
        summary={isOwner ? ev?.filename : 'Evidence attached'}
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
      >
        {ev ? (
          <div>
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
        creditsUsed: ev.creditsUsed || 0,
        reviewer: ev.evaluator || 'Unknown',
        reviewDate: ev.date,
        claims: (ev.claims || []).map(c => ({
          requirement: c.label || c.requirementId,
          output: c.humanValue || c.aiValue || '—',
          type: c.type === 'extraction' ? 'extraction' : 'inference',
          status: c.status,
        })),
      }))
  }, [node])

  // Decide which tabs to show based on populated fields
  const tabs = useMemo(() => {
    const t = []
    const hasEvals = evals.length > 0
    const hasEvidenceChildren = node.children?.some(c => c.isEvidence)
    const showEvalTab = hasEvals || hasEvidenceChildren || isOwner
    if (showEvalTab)
      t.push({ id: 'evaluations', label: `Evaluations · ${evals.length}` })
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

  // Always reset to first tab and clear eval state on node change
  useEffect(() => {
    if (tabs.length > 0) {
      setTab(tabs[0].id)
    }
    setEvalOpen({})
    setClaimsOpen({})
    setEvOpen(false)
  }, [node.id])

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
      onRunEvaluation={onRunEvaluation}
      canEvaluate={canEvaluate}
      isEvidence={!!node.isEvidence}
      isParse={!!node.isParse || node.category === 'parse'}
      isOwner={isOwner}
    >
      {/* Conditionally mounted tabs — only render if tab exists in tabs array */}
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
            onRunEvaluation={onRunEvaluation}
            canEvaluate={canEvaluate}
          />
        </div>
      )}
      {tabs.some(t => t.id === 'children') && (
        <div style={{ display: tab === 'children' ? 'block' : 'none' }}>
          <ChildrenTab children={node.children || []} parentOwner={node.owner} onViewChild={onViewChild} />
        </div>
      )}
      {tabs.some(t => t.id === 'disclosures') && (
        <div style={{ display: tab === 'disclosures' ? 'block' : 'none' }}>
          <DisclosuresTab sdas={node.sdas || []} onDisclose={onDisclose} node={node} onManageCascade={onManageCascade} isOwner={isOwner} onSelectAsset={onSelectAsset} onRevokeSda={onRevokeSda} />
        </div>
      )}
      {tabs.some(t => t.id === 'parsed') && (
        <div style={{ display: tab === 'parsed' ? 'block' : 'none' }}>
          <ParsedFieldsTab fields={node.parsedFields || []} isSelective={!!node._isSelective} />
        </div>
      )}
    </PanelShell>
  )
}
