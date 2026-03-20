import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import EvaluationsTab from './EvaluationsTab'
import ChildrenTab from './ChildrenTab'
import DisclosuresTab from './DisclosuresTab'
import ParsedFieldsTab from './ParsedFieldsTab'

export default function DetailPanel({ node, onClose, onViewChain, onExpandStack, onSurface, isAnchor, depth = 0, onDisclose, onConnect, onAddEvidence, onParseEvidence, onManageCascade, isOwner, onViewChild, onSelectAsset, onCancelRequest, onRevokeSda }) {
  if (!node) return null

  // Provisional nodes get a minimal panel with request context
  if (node.provisional) {
    const ctx = node.requestContext
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
          {/* Status icon */}
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

          {/* Request details */}
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
                        fontSize: 11, color: 'var(--text-secondary)',
                        padding: '6px 10px', borderRadius: 4,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border)',
                      }}>
                        {typeof req === 'string' ? req : req.name}
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

          {/* Cancel button */}
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
        </div>
      </PanelShell>
    )
  }

  // Decide which tabs to show based on populated fields
  const tabs = useMemo(() => {
    const t = []
    // Show Evaluations tab if: node has evaluations, node has evidence children, or user owns the node (can run evaluations)
    const hasEvals = node.evaluations?.length > 0
    const hasEvidenceChildren = node.children?.some(c => c.isEvidence)
    const showEvalTab = hasEvals || hasEvidenceChildren || isOwner
    if (showEvalTab)
      t.push({ id: 'evaluations', label: `Evaluations · ${node.evaluations?.length || 0}` })
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
    node.evaluations?.forEach((_, i) => { o[i] = true })
    setEvalOpen(o)
  }, [node])
  const collapseAll = useCallback(() => {
    const o = {}
    node.evaluations?.forEach((_, i) => { o[i] = false })
    setEvalOpen(o)
    setClaimsOpen(o)
  }, [node])

  // Paperclip click: switch to evals tab, then unfurl evidence after paint
  const handleClipClick = useCallback(() => {
    setTab('evaluations')
    requestAnimationFrame(() => requestAnimationFrame(() => setEvOpen(true)))
  }, [])

  // Compute summary line
  const summary = useMemo(() => {
    const parts = []
    const h = node.displayHealth || node.health || { ok: 0, warn: 0, bad: 0 }
    if (h.ok || h.bad) parts.push(`${h.ok} verified · ${h.bad} failed`)

    // Child claim count — count all children's claims
    const childNodes = node.children || []
    if (childNodes.length > 0) {
      let totalChildClaims = 0
      for (const c of childNodes) {
        const ch = c.displayHealth || c.health || { ok: 0, warn: 0, bad: 0 }
        totalChildClaims += ch.ok + ch.bad
      }
      if (totalChildClaims > 0) {
        parts.push(`${totalChildClaims} claims across ${childNodes.length} children`)
      }
    }

    if (!parts.length && node.evaluations?.length) parts.push(`${node.evaluations.length} evaluations`)
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
      isEvidence={!!node.isEvidence}
      isParse={!!node.isParse || node.category === 'parse'}
      isOwner={isOwner}
    >
      {/* Conditionally mounted tabs — only render if tab exists in tabs array */}
      {tabs.some(t => t.id === 'evaluations') && (
        <div style={{ display: tab === 'evaluations' ? 'block' : 'none' }}>
          <EvaluationsTab
            evidence={node.evidence}
            evals={node.evaluations || []}
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
