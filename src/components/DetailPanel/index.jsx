import { useState, useCallback, useMemo, useEffect } from 'react'
import PanelShell from './PanelShell'
import EvaluationsTab from './EvaluationsTab'
import ChildrenTab from './ChildrenTab'
import DisclosuresTab from './DisclosuresTab'

export default function DetailPanel({ node, onClose, onViewChain, onExpandStack, onSurface, onPinToSurface, isAnchor, depth = 0, onDisclose, onConnect, onManageCascade, isOwner }) {
  if (!node) return null

  // Decide which tabs to show based on populated fields
  const tabs = useMemo(() => {
    const t = []
    // Always show Evaluations tab — it contains the "Run Evaluation" entry point
    t.push({ id: 'evaluations', label: `Evaluations · ${node.evaluations?.length || 0}` })
    if (node.children?.length)
      t.push({ id: 'children', label: `Children · ${node.children.length}` })
    if (node.sdas?.length)
      t.push({ id: 'disclosures', label: `Disclosures · ${node.sdas.length}` })
    return t
  }, [node])

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
    const h = node.health || { ok: 0, bad: 0 }
    if (h.ok || h.bad) parts.push(`${h.ok} verified · ${h.bad} failed`)
    if (node.childHealth) {
      const ch = node.childHealth
      parts.push(`${ch.ok + ch.bad} claims across ${node.childCount || node.children?.length || 0} children`)
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
    >
      {/* Always-mounted tabs — display:none/block preserves state */}
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
        />
      </div>
      <div style={{ display: tab === 'children' ? 'block' : 'none' }}>
        <ChildrenTab children={node.children || []} parentOwner={node.owner} />
      </div>
      <div style={{ display: tab === 'disclosures' ? 'block' : 'none' }}>
        <DisclosuresTab sdas={node.sdas || []} onDisclose={onDisclose} node={node} onManageCascade={onManageCascade} />
      </div>
    </PanelShell>
  )
}
