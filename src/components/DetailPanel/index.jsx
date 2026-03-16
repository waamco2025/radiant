import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import EvaluationsTab from './EvaluationsTab'
import ChildrenTab from './ChildrenTab'
import DisclosuresTab from './DisclosuresTab'

export default function DetailPanel({ node, onClose, onViewChain, onExpandStack, onSurface, onPinToSurface, isAnchor, depth = 0, onDisclose, onConnect, onAddEvidence, onManageCascade, isOwner, onViewChild }) {
  if (!node) return null

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
      onPinToSurface={onPinToSurface}
      isAnchor={isAnchor}
      showPin={depth > 0 && !isAnchor}
      onConnect={onConnect}
      onDisclose={onDisclose}
      onAddEvidence={onAddEvidence}
      isEvidence={!!node.isEvidence}
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
          <DisclosuresTab sdas={node.sdas || []} onDisclose={onDisclose} node={node} onManageCascade={onManageCascade} isOwner={isOwner} />
        </div>
      )}
    </PanelShell>
  )
}
