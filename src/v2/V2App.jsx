import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import V2Canvas from './V2Canvas.jsx'
import V2SubgraphModal from './V2SubgraphModal.jsx'
import V2BootScreen from './V2BootScreen.jsx'
import PrimeRadiant from './PrimeRadiant.jsx'
import { ROLES, getDataForRole, makePin, makeDot, makeEvidence, makeEvidenceNode, makePepNode, makeEvalNode, resolvePin } from './v2Data.js'
import { PEP_TEMPLATES } from './pepTemplates.js'
import DetailPanel from '../components/DetailPanel/index.jsx'
import PublishModal from '../components/modals/PublishModal.jsx'
import RequestDisclosureModal from '../components/modals/RequestDisclosureModal.jsx'
import DisclosureResponseModal from '../components/modals/DisclosureResponseModal.jsx'
import CascadeModal from '../components/modals/CascadeModal.jsx'
import RegisterAssetModal from '../components/modals/RegisterAssetModal.jsx'
import AddEvidenceModal from '../components/modals/AddEvidenceModal.jsx'
import ParseEvidenceModal from '../components/modals/ParseEvidenceModal.jsx'
import RevocationNoticeModal from '../components/modals/RevocationNoticeModal.jsx'
import RequirementsLibraryModal from '../components/modals/RequirementsLibraryModal.jsx'
import RunEvaluationModal from '../components/modals/RunEvaluationModal.jsx'
import { Backdrop } from '../components/modals/ModalShared.jsx'
import { getRequirementSetsForRole } from './requirementSets.js'

const SESSION_KEY = 'radiant-v2-booted'

function findClearY(targetX, idealY, allNodes, spacingY = 300, toleranceX = 150) {
  const occupiedYs = allNodes
    .filter(n => n.x !== undefined && Math.abs(n.x - targetX) < toleranceX)
    .map(n => n.y)
    .sort((a, b) => a - b)

  const isClear = (y) => !occupiedYs.some(oy => Math.abs(oy - y) < spacingY)

  if (isClear(idealY)) return idealY

  // Search outward in both directions, return the closest clear slot
  for (let offset = spacingY; offset < spacingY * 50; offset += spacingY) {
    const below = idealY + offset
    const above = idealY - offset
    const belowClear = isClear(below)
    const aboveClear = isClear(above)
    if (belowClear && aboveClear) return below // tie: prefer below
    if (aboveClear) return above
    if (belowClear) return below
  }
  return idealY + spacingY * 50
}

export default function V2App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('radiant-theme') || 'dark')
  const [roleId, setRoleId] = useState('bob-govco')
  const [sel, setSel] = useState(null)
  const [modalNode, setModalNode] = useState(null)
  const [subchainFocusId, setSubchainFocusId] = useState(null)
  const transitioningSubchain = useRef(false)
  const prevSelRef = useRef(null)

  const activeRole = ROLES.find(r => r.id === roleId) || ROLES[0]
  const roleData = useMemo(() => getDataForRole(roleId), [roleId])
  // Per-role dynamic state — persists across role switches
  const emptyRoleState = { addedNodes: [], addedSDAs: {}, addedEdges: [], dismissedReqs: [], addedChildren: {}, addedRequests: [], removedSDAs: [], removedNodes: [], removedEdges: [], newlyDisclosedIds: [], requirementSets: null }
  const [perRoleState, setPerRoleState] = useState(() => {
    const init = {}
    ROLES.forEach(r => { init[r.id] = { ...emptyRoleState } })
    return init
  })

  const updateRoleState = useCallback((targetRoleId, updater) => {
    setPerRoleState(prev => ({
      ...prev,
      [targetRoleId]: updater(prev[targetRoleId] || { ...emptyRoleState }),
    }))
  }, [])

  const currentRoleState = perRoleState[roleId] || emptyRoleState

  // Reset prevSelRef on role switch to prevent cross-role _isNew clearing
  const prevRoleRef = useRef(roleId)
  useEffect(() => {
    if (prevRoleRef.current !== roleId) {
      prevSelRef.current = null
      prevRoleRef.current = roleId
    }
  }, [roleId])

  // Clear _isNew from previously selected node on deselection
  useEffect(() => {
    const prevSel = prevSelRef.current
    prevSelRef.current = sel
    if (prevSel && prevSel !== sel) {
      updateRoleState(roleId, prev => {
        let changed = false
        let newState = { ...prev }

        // Clear _isNew from addedNodes
        const idx = prev.addedNodes.findIndex(n => n.id === prevSel && n._isNew)
        if (idx >= 0) {
          const updated = [...prev.addedNodes]
          updated[idx] = { ...updated[idx], _isNew: false }
          newState.addedNodes = updated
          changed = true
        }

        // Clear from newlyDisclosedIds
        const discIdx = (prev.newlyDisclosedIds || []).indexOf(prevSel)
        if (discIdx >= 0) {
          newState.newlyDisclosedIds = prev.newlyDisclosedIds.filter(id => id !== prevSel)
          changed = true
        }

        return changed ? newState : prev
      })
    }
  }, [sel, roleId])
  const { addedNodes, addedSDAs, addedEdges, dismissedReqs, addedRequests } = currentRoleState
  const addedChildren = currentRoleState.addedChildren || {}
  const removedSDAs = currentRoleState.removedSDAs || []
  const removedNodes = currentRoleState.removedNodes || []
  const removedEdges = currentRoleState.removedEdges || []

  const { nodes, edges, nodeMap, pendingRequests, existingCascades } = useMemo(() => {
    const data = { ...roleData }

    // Step 0: Filter removed nodes from static data
    if (removedNodes.length > 0) {
      const removedSet = new Set(removedNodes)
      data.nodes = data.nodes.filter(n => !removedSet.has(n.id))
    }

    // Step 0b: Filter removed edges from static data
    if (removedEdges.length > 0) {
      const removedEdgeSet = new Set(removedEdges)
      data.edges = data.edges.filter(e => !removedEdgeSet.has(e.id))
    }

    // Step 0c: Filter removed SDAs from static data
    if (removedSDAs.length > 0) {
      data.nodes = data.nodes.map(n => {
        const removals = removedSDAs.filter(r => r.nodeId === n.id)
        if (removals.length === 0) return n
        const filteredSDAs = (n.sdas || []).filter(sda =>
          !removals.some(r => r.party === sda.party && r.type === sda.type && r.created === sda.created)
        )
        return { ...n, sdas: filteredSDAs }
      })
    }

    // Merge added nodes
    if (addedNodes.length > 0) {
      data.nodes = [...data.nodes, ...addedNodes]
    }

    // Merge added SDAs into matching nodes
    if (Object.keys(addedSDAs).length > 0) {
      data.nodes = data.nodes.map(n => {
        const added = addedSDAs[n.id]
        if (!added) return n
        return { ...n, sdas: [...(n.sdas || []), ...added] }
      })
    }

    // Merge added children into matching parent nodes
    if (Object.keys(addedChildren).length > 0) {
      data.nodes = data.nodes.map(n => {
        const added = addedChildren[n.id]
        if (!added) return n
        const newChildren = [...(n.children || []), ...added]
        return {
          ...n,
          children: newChildren,
          hasStack: true,
          childCount: newChildren.length,
          hasEvidence: newChildren.some(c => c.isEvidence) || n.hasEvidence,
        }
      })
    }

    // Flag evidence nodes that have been parsed (a sibling 'parse' node references them)
    data.nodes = data.nodes.map(n => {
      if (!n.children || n.children.length === 0) return n
      const parseNodes = n.children.filter(c => c.isParse || c.category === 'parse')
      if (parseNodes.length === 0) return n
      const parsedEvidenceIds = new Set(parseNodes.map(c => c.sourceEvidenceId))
      const updatedChildren = n.children.map(c => {
        if (c.isEvidence && parsedEvidenceIds.has(c.id)) {
          return { ...c, _isParsed: true }
        }
        return c
      })
      return { ...n, children: updatedChildren }
    })

    // Unified health computation: eval child health, evidence cleanup, parent rollup
    data.nodes = data.nodes.map(n => {
      // Step A: Compute health on eval child nodes from their claims + zero evidence health
      let children = n.children
      if (children && children.length > 0) {
        children = children.map(c => {
          if ((c.isEvaluation || c.category === 'evaluation') && c.claims && c.claims.length > 0) {
            const ok = c.claims.filter(cl => cl.status === 'satisfactory').length
            const bad = c.claims.filter(cl => cl.status === 'unsatisfactory').length
            const warn = c.claims.filter(cl => cl.status === 'missing').length
            return {
              ...c,
              health: { ok, warn, bad },
              displayHealth: { ok, warn, bad },
              claimCount: c.claims.length,
              displayClaimCount: c.claims.length,
            }
          }
          if (c.isEvidence) {
            return {
              ...c,
              health: { ok: 0, warn: 0, bad: 0 },
              displayHealth: { ok: 0, warn: 0, bad: 0 },
              claimCount: 0,
              displayClaimCount: 0,
            }
          }
          return c
        })
      }

      // Step B: Roll up to parent from eval child nodes
      let ok = 0, warn = 0, bad = 0, totalClaims = 0
      if (children) {
        const evalChildren = children.filter(c => c.isEvaluation || c.category === 'evaluation')
        for (const ev of evalChildren) {
          const h = ev.health || { ok: 0, warn: 0, bad: 0 }
          ok += h.ok
          warn += (h.warn || 0)
          bad += h.bad
          totalClaims += (ev.claimCount || 0)
        }
      }

      const hasEvalData = totalClaims > 0
      const combinedHealth = { ok, warn, bad }

      return {
        ...n,
        children,
        ...(hasEvalData ? {
          childHealth: combinedHealth,
          displayHealth: combinedHealth,
          claimCount: totalClaims,
          displayClaimCount: totalClaims,
        } : {}),
      }
    })

    // Filter disclosed fields for selective disclosures (non-owned nodes only)
    data.nodes = data.nodes.map(n => {
      // Only filter fields on nodes we don't own
      if (n.owner === activeRole.party) return n

      let fieldIds = n._disclosedFieldIds
      if (!fieldIds) {
        const selectiveSda = (n.sdas || []).find(s => s.type === 'selective' && s.selectedFieldIds)
        if (selectiveSda) fieldIds = selectiveSda.selectedFieldIds
      }

      if (!fieldIds || !n.children) return n
      const disclosedSet = new Set(fieldIds)
      const filteredChildren = n.children.map(c => {
        if (!c.isParse && c.category !== 'parse') return c
        if (!c.parsedFields) return c
        return {
          ...c,
          parsedFields: c.parsedFields.filter(f => disclosedSet.has(`${c.id}::${f.id}`)),
          _isSelective: true,
        }
      })
      return { ...n, children: filteredChildren, _isSelective: true }
    })

    // Rebuild nodeMap
    const newMap = {}
    data.nodes.forEach(n => { newMap[n.id] = n })
    data.nodes.forEach(n => {
      if (n.children) n.children.forEach(c => { newMap[c.id] = c })
    })
    data.nodeMap = newMap

    // Merge added edges
    if (addedEdges.length > 0) {
      data.edges = [...data.edges, ...addedEdges]
    }

    // Merge added requests into pendingRequests
    if (addedRequests && addedRequests.length > 0) {
      data.pendingRequests = [...(data.pendingRequests || []), ...addedRequests]
    }

    // Apply _isNew from newlyDisclosedIds (for disclosure acceptance on existing nodes)
    const newlyDisclosed = new Set(currentRoleState.newlyDisclosedIds || [])
    if (newlyDisclosed.size > 0) {
      data.nodes = data.nodes.map(n => {
        if (newlyDisclosed.has(n.id) && !n._isNew) {
          return { ...n, _isNew: true }
        }
        return n
      })
      // Update nodeMap for flagged nodes
      data.nodes.forEach(n => { if (newlyDisclosed.has(n.id)) data.nodeMap[n.id] = n })
    }

    return data
  }, [roleData, addedNodes, addedSDAs, addedEdges, addedChildren, addedRequests, removedSDAs, removedNodes, removedEdges, currentRoleState.newlyDisclosedIds])

  // Public listings from other role's merged state (sees dynamic publishes)
  const publicListings = useMemo(() => {
    const otherRoleId = ROLES.find(r => r.id !== roleId)?.id
    if (!otherRoleId) return []

    const otherData = getDataForRole(otherRoleId)
    const otherState = perRoleState[otherRoleId] || emptyRoleState

    let otherNodes = [...otherData.nodes]

    if (otherState.removedNodes?.length > 0) {
      const removedSet = new Set(otherState.removedNodes)
      otherNodes = otherNodes.filter(n => !removedSet.has(n.id))
    }
    if (otherState.addedNodes?.length > 0) {
      otherNodes = [...otherNodes, ...otherState.addedNodes]
    }
    if (Object.keys(otherState.addedSDAs || {}).length > 0) {
      otherNodes = otherNodes.map(n => {
        const added = otherState.addedSDAs[n.id]
        if (!added) return n
        return { ...n, sdas: [...(n.sdas || []), ...added] }
      })
    }
    if (Object.keys(otherState.addedChildren || {}).length > 0) {
      otherNodes = otherNodes.map(n => {
        const added = otherState.addedChildren[n.id]
        if (!added) return n
        return { ...n, children: [...(n.children || []), ...added] }
      })
    }

    const listings = []
    for (const node of otherNodes) {
      const publicSda = (node.sdas || []).find(s => s.party === 'Radiant Network')
      if (!publicSda) continue
      if (nodeMap[node.id]) continue
      if (node.provisional) continue

      listings.push({
        id: node.id,
        name: node.name,
        pin: node.pin,
        dot: node.dot,
        category: node.category,
        owner: node.owner,
        description: node.description || null,
        childCount: node.children?.length || 0,
        hasEvidence: node.children?.some(c => c.isEvidence) || !!node.hasEvidence,
        hasParsedData: node.children?.some(c => c.isParse || c.category === 'parse') || false,
        hasEvaluations: node.children?.some(c => c.isEvaluation || c.category === 'evaluation') || false,
        disclosureType: publicSda.type,
      })
    }
    return listings
  }, [roleId, perRoleState, nodeMap])

  // Subchain computation — filters nodes/edges to connected chain and lays out horizontally
  const subchainData = useMemo(() => {
    if (!subchainFocusId || !nodeMap[subchainFocusId]) return null

    const chainNodeIds = new Set([subchainFocusId])

    // Walk UPSTREAM: follow edges where node is "to", trace back via "from"
    function walkUpstream(nodeId) {
      edges.forEach(e => {
        if (e.to === nodeId && !chainNodeIds.has(e.from)) {
          chainNodeIds.add(e.from)
          walkUpstream(e.from)
        }
      })
    }
    // Walk DOWNSTREAM: follow edges where node is "from", trace forward via "to"
    function walkDownstream(nodeId) {
      edges.forEach(e => {
        if (e.from === nodeId && !chainNodeIds.has(e.to)) {
          chainNodeIds.add(e.to)
          walkDownstream(e.to)
        }
      })
    }

    walkUpstream(subchainFocusId)
    walkDownstream(subchainFocusId)

    // Ensure own party is included if it has a direct edge to any chain node
    const activeParty = activeRole?.party
    const ownPartyNode = nodes.find(n => n.category === 'party' && (n.owner === activeParty || n.name === activeParty))
    if (ownPartyNode && !chainNodeIds.has(ownPartyNode.id)) {
      const connectsToChain = edges.some(e =>
        e.from === ownPartyNode.id && chainNodeIds.has(e.to)
      )
      if (connectsToChain) chainNodeIds.add(ownPartyNode.id)
    }

    const chainNodes = nodes.filter(n => chainNodeIds.has(n.id))
    const chainEdges = edges.filter(e => chainNodeIds.has(e.from) && chainNodeIds.has(e.to))

    // ===== DEPTH COMPUTATION: forward BFS from own party =====
    const depths = {}
    const queue = []

    // Find own party node in the chain (may have been added above)
    const ownPartyInChain = chainNodes.find(n =>
      n.category === 'party' && (n.owner === activeParty || n.name === activeParty)
    )

    if (ownPartyInChain) {
      depths[ownPartyInChain.id] = 0
      queue.push(ownPartyInChain.id)
    } else {
      // No own party in chain — use node with no incoming chain edges
      const inDegree = {}
      chainNodes.forEach(n => { inDegree[n.id] = 0 })
      chainEdges.forEach(e => { if (inDegree[e.to] !== undefined) inDegree[e.to]++ })
      const root = chainNodes.find(n => inDegree[n.id] === 0)
      if (root) { depths[root.id] = 0; queue.push(root.id) }
    }

    // Forward BFS: follow from → to only
    while (queue.length > 0) {
      const current = queue.shift()
      const currentDepth = depths[current]
      chainEdges.forEach(e => {
        if (e.from === current && depths[e.to] === undefined) {
          depths[e.to] = currentDepth + 1
          queue.push(e.to)
        }
      })
    }

    // Unreached nodes: place 1 depth after closest reached neighbor
    const reachedDepths = Object.values(depths)
    const maxReached = reachedDepths.length > 0 ? Math.max(...reachedDepths) : 0
    chainNodes.forEach(n => {
      if (depths[n.id] !== undefined) return
      let bestNeighborDepth = -1
      chainEdges.forEach(e => {
        if (e.from === n.id && depths[e.to] !== undefined)
          bestNeighborDepth = Math.max(bestNeighborDepth, depths[e.to])
        if (e.to === n.id && depths[e.from] !== undefined)
          bestNeighborDepth = Math.max(bestNeighborDepth, depths[e.from])
      })
      depths[n.id] = bestNeighborDepth >= 0 ? bestNeighborDepth + 1 : (maxReached || 0) + 1
    })

    const byDepth = {}
    chainNodes.forEach(n => {
      const d = depths[n.id] || 0
      if (!byDepth[d]) byDepth[d] = []
      byDepth[d].push(n)
    })

    const COL_SPACING = 500
    const ROW_SPACING = 200
    const focusDepth = depths[subchainFocusId] || 0

    const repositioned = chainNodes.map(n => {
      const d = depths[n.id] || 0
      const group = byDepth[d]
      const idx = group.indexOf(n)
      const x = (d - focusDepth) * COL_SPACING
      const y = (idx - (group.length - 1) / 2) * ROW_SPACING
      return { ...n, x, y, _subchainDepth: d }
    })

    const chainNodeMap = {}
    repositioned.forEach(n => { chainNodeMap[n.id] = n })

    return { nodes: repositioned, edges: chainEdges, nodeMap: chainNodeMap, focusId: subchainFocusId }
  }, [subchainFocusId, nodes, edges, nodeMap, activeRole])

  const [credits, setCredits] = useState(activeRole.credits)
  const [showCredits, setShowCredits] = useState(false)
  const [showAcct, setShowAcct] = useState(false)
  const [layerInfo, setLayerInfo] = useState({ depth: 0, anchorId: null })
  const canvasRef = useRef(null)
  const [publishNode, setPublishNode] = useState(null)
  const [connectNode, setConnectNode] = useState(null)
  const [registerNode, setRegisterNode] = useState(null)
  const [responseRequest, setResponseRequest] = useState(null)
  const [showInbox, setShowInbox] = useState(false)
  const [cascadeContext, setCascadeContext] = useState(null)
  const [evidenceNode, setEvidenceNode] = useState(null)
  const [parseContext, setParseContext] = useState(null)
  const [revocationNotice, setRevocationNotice] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryInitialSetId, setLibraryInitialSetId] = useState(null)
  const [evalContext, setEvalContext] = useState(null)

  // Requirement sets — per-role, defaults from demo data
  const requirementSets = useMemo(() => {
    const custom = currentRoleState.requirementSets
    if (custom !== null && custom !== undefined) return custom
    return getRequirementSetsForRole(roleId)
  }, [currentRoleState.requirementSets, roleId])

  const handleSaveRequirementSet = useCallback((reqSet) => {
    updateRoleState(roleId, prev => {
      const existing = prev.requirementSets ?? getRequirementSetsForRole(roleId)
      return { ...prev, requirementSets: [...existing, reqSet] }
    })
  }, [roleId, updateRoleState])

  const inboxRef = useRef(null)
  const nodeMapRef = useRef(nodeMap)
  useEffect(() => { nodeMapRef.current = nodeMap }, [nodeMap])

  const visibleRequests = pendingRequests.filter(r => !dismissedReqs.includes(r.id))
  const [bellHover, setBellHover] = useState(false)
  const [glowIntensity, setGlowIntensity] = useState(0) // 0 = no glow, >0 = glow factor
  const [booted, setBooted] = useState(() => {
    const nav = performance.getEntriesByType?.('navigation')?.[0]
    if (nav?.type === 'reload') {
      sessionStorage.removeItem(SESSION_KEY)
      return false
    }
    return sessionStorage.getItem(SESSION_KEY) === '1'
  })

  const creditsRef = useRef(null)
  const acctRef = useRef(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('radiant-theme', theme)
  }, [theme])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (showCredits && creditsRef.current && !creditsRef.current.contains(e.target)) setShowCredits(false)
      if (showAcct && acctRef.current && !acctRef.current.contains(e.target)) setShowAcct(false)
      if (showInbox && inboxRef.current && !inboxRef.current.contains(e.target)) setShowInbox(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCredits, showAcct, showInbox])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const handleGlowChange = useCallback((isGlowing, speedFactor) => {
    setGlowIntensity(isGlowing ? Math.min(speedFactor - 1, 3) / 3 : 0) // normalize 0-1
  }, [])

  const handleBootComplete = useCallback(() => {
    setBooted(true)
    sessionStorage.setItem(SESSION_KEY, '1')
  }, [])

  const handleSelect = useCallback((node) => {
    setSel(node.id)
  }, [])

  const handleCloseSel = useCallback(() => {
    setSel(null)
  }, [])

  const enterSubchain = useCallback((nodeId) => {
    if (!nodeId || !nodeMap[nodeId] || nodeMap[nodeId].category === 'party') return
    if (transitioningSubchain.current) return
    transitioningSubchain.current = true

    canvasRef.current?.playLateralStreaks?.('enter')
    canvasRef.current?.fadeOutCards?.()

    setTimeout(() => {
      setSubchainFocusId(nodeId)
      setSel(nodeId)
      setTimeout(() => {
        canvasRef.current?.fadeInCards?.()
        canvasRef.current?.fitAll?.()
        transitioningSubchain.current = false
      }, 50)
    }, 250)
  }, [nodeMap])

  const handleOpenSubgraph = useCallback((node) => {
    if (!node || node.category === 'party') return

    if (subchainFocusId) {
      if (node.id === subchainFocusId) return
      if (transitioningSubchain.current) return
      transitioningSubchain.current = true

      canvasRef.current?.playLateralStreaks?.('enter')
      canvasRef.current?.fadeOutCards?.()

      setTimeout(() => {
        setSubchainFocusId(node.id)
        setSel(node.id)
        setTimeout(() => {
          canvasRef.current?.fadeInCards?.()
          canvasRef.current?.fitAll?.()
          transitioningSubchain.current = false
        }, 50)
      }, 250)
    } else {
      enterSubchain(node.id)
    }
  }, [subchainFocusId, enterSubchain])

  const handleCloseModal = useCallback(() => {
    setModalNode(null)
  }, [])

  const handleSwitchRole = useCallback((newRoleId) => {
    if (newRoleId === roleId) return
    setRoleId(newRoleId)
    setSel(null)
    setModalNode(null)
    setSubchainFocusId(null)
    const role = ROLES.find(r => r.id === newRoleId)
    if (role) setCredits(role.credits)
    setShowAcct(false)
  }, [roleId])

  // Detail Panel footer actions
  const handlePanelViewChain = useCallback(() => {
    if (!sel || !nodeMap[sel]) return
    const node = nodeMap[sel]
    if (node.category === 'party') return
    handleOpenSubgraph(node)
  }, [sel, nodeMap, handleOpenSubgraph])

  const handlePanelExpandStack = useCallback(() => {
    if (sel && nodeMap[sel]) canvasRef.current?.dive(nodeMap[sel])
  }, [sel, nodeMap])

  const exitSubchain = useCallback(() => {
    if (transitioningSubchain.current) return
    transitioningSubchain.current = true
    const lastSel = sel

    canvasRef.current?.playLateralStreaks?.('exit')
    canvasRef.current?.fadeOutCards?.()

    setTimeout(() => {
      setSubchainFocusId(null)
      setTimeout(() => {
        canvasRef.current?.fadeInCards?.()
        if (lastSel && nodeMap[lastSel]) {
          canvasRef.current?.panToWithZoom?.(nodeMap[lastSel].x, nodeMap[lastSel].y, 0.7)
        } else {
          canvasRef.current?.panToWithZoom?.(0, 0, 0.7)
        }
        transitioningSubchain.current = false
      }, 50)
    }, 250)
  }, [sel, nodeMap])

  const handlePanelSurface = useCallback(() => {
    if (layerInfo.depth > 0) {
      canvasRef.current?.surface()
      return
    }
    if (subchainFocusId) {
      exitSubchain()
      return
    }
    canvasRef.current?.surface()
  }, [subchainFocusId, layerInfo.depth, exitSubchain])

  const handleViewChild = useCallback((childNode) => {
    if (layerInfo.depth > 0) {
      // Already in child layer — just select the child node
      setSel(childNode.id)
    } else {
      // On parent layer — dive into the parent, then select the child
      const parentNode = sel ? nodeMap[sel] : null
      if (parentNode && canvasRef.current) {
        canvasRef.current.dive(parentNode)
        setTimeout(() => {
          setSel(childNode.id)
        }, 600)
      }
    }
  }, [sel, nodeMap, layerInfo.depth])

  // Validate PINs — used by RequestDisclosureModal before submission
  const handleValidatePins = useCallback((pinList) => {
    return pinList.map(pin => {
      if (!pin.startsWith('PIN-0x')) {
        return { pin, status: 'error', error: 'Invalid PIN format' }
      }
      const resolved = resolvePin(pin)
      if (!resolved) {
        return { pin, status: 'error', error: 'PIN not found on the network' }
      }
      if (nodeMap[resolved.id]) {
        return { pin, status: 'error', error: 'Asset already on your network' }
      }
      const provId = `provisional-${resolved.id}`
      if (nodeMap[provId] || addedNodes.some(n => n.id === provId)) {
        return { pin, status: 'error', error: 'Disclosure already requested' }
      }
      if (pendingRequests.some(r => r.asset?.pin === resolved.pin && r.from?.name === activeRole.party)) {
        return { pin, status: 'error', error: 'Disclosure already requested' }
      }
      return { pin, status: 'valid', resolved }
    })
  }, [nodeMap, addedNodes, pendingRequests, activeRole])

  // Handle PIN-based disclosure request submission
  const handleSubmitRequest = useCallback(({ pins, requirements, message, contextNode: ctxNode, fromDirectory }) => {
    const today = new Date().toISOString().slice(0, 10)
    const otherRoleId = ROLES.find(r => r.id !== roleId)?.id

    // Phase 1: validate all PINs
    const validPins = []
    pins.forEach(pin => {
      if (!pin.startsWith('PIN-0x')) return
      const resolved = resolvePin(pin)
      if (!resolved) return
      if (nodeMap[resolved.id]) return
      const provId = `provisional-${resolved.id}`
      if (nodeMap[provId]) return
      if (addedNodes.some(n => n.id === provId)) return
      if (pendingRequests.some(r => r.asset?.pin === resolved.pin && r.from?.name === activeRole.party)) return
      validPins.push({ pin, resolved })
    })

    // Phase 2: accumulate all provisional nodes + edges, then commit in one update
    const newProvNodes = []
    const newProvEdges = []

    validPins.forEach(({ pin, resolved }) => {
      const provNodeId = `provisional-${resolved.id}`

      // Place one column right of the context node
      const newX = (ctxNode.x || 0) + 500
      let newY = ctxNode.y || 0

      // Include previously created batch nodes in collision check
      newY = findClearY(newX, newY, [...nodes, ...newProvNodes])

      newProvNodes.push({
        id: provNodeId,
        pin: resolved.pin,
        dot: resolved.dot,
        name: resolved.name,
        category: resolved.category || 'product',
        owner: resolved.owner || '?',
        parentId: null,
        children: [],
        health: { ok: 0, warn: 0, bad: 0 },
        childHealth: null,
        totalHealth: null,
        displayHealth: { ok: 0, warn: 0, bad: 0 },
        claimCount: 0,
        displayClaimCount: 0,
        hasEvidence: false,
        hasStack: false,
        childCount: 0,
        evidence: null,
        evaluations: [],
        sdas: [],
        x: newX,
        y: newY,
        parentOwner: resolved.owner,
        isCascade: false,
        cascadeVia: null,
        upstreamSda: null,
        upstreamAssets: null,
        isEvidence: false,
        lastEval: null,
        provisional: true,
        _isNew: true,
        requestContext: {
          requirements: requirements,
          message: message || '',
          date: today,
          contextNodeName: ctxNode.name,
          contextNodePin: ctxNode.pin,
        },
      })

      newProvEdges.push({
        id: `e-prov-${ctxNode.id}-${provNodeId}`,
        from: ctxNode.id,
        to: provNodeId,
        sdaType: 'provisional',
      })
    })

    // Single state update with all provisional nodes + edges
    if (newProvNodes.length > 0) {
      updateRoleState(roleId, prev => ({
        ...prev,
        addedNodes: [...prev.addedNodes, ...newProvNodes],
        addedEdges: [...prev.addedEdges, ...newProvEdges],
      }))
      // Pan to the first provisional node after state settles
      setTimeout(() => setSel(newProvNodes[0].id), 300)
    }

    // Cross-role requests — also batch into single update
    if (otherRoleId) {
      const newRequests = []
      validPins.forEach(({ pin, resolved }, index) => {
        if (resolved.owner !== ROLES.find(r => r.id === otherRoleId)?.party) return
        newRequests.push({
          id: `req-dynamic-${resolved.id}-${Date.now().toString(36)}-${index}`,
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: resolved.name, pin: resolved.pin },
          connectTo: {
            id: ctxNode.id,
            name: ctxNode.name,
            pin: ctxNode.pin,
            category: ctxNode.category,
            owner: activeRole.party,
            x: ctxNode.x,
            y: ctxNode.y,
          },
          message: message || '',
          requirements: requirements,
          date: today,
          fromDirectory: fromDirectory || false,
        })
      })

      if (newRequests.length > 0) {
        updateRoleState(otherRoleId, prev => {
          // Only deduplicate against pending disclosure requests (not acceptances/declines/revocations)
          const dismissedSet = new Set(prev.dismissedReqs || [])
          const pendingRequestPins = new Set(
            (prev.addedRequests || [])
              .filter(r => !r.type && !dismissedSet.has(r.id))
              .map(r => r.asset?.pin)
          )
          const filtered = newRequests.filter(r => !pendingRequestPins.has(r.asset?.pin))
          if (filtered.length === 0) return prev
          return {
            ...prev,
            addedRequests: [...(prev.addedRequests || []), ...filtered],
          }
        })
      }
    }
  }, [roleId, nodeMap, nodes, edges, addedNodes, pendingRequests, activeRole, updateRoleState])

  const isAnchorSelected = layerInfo.depth > 0 && sel === layerInfo.anchorId

  const pillStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    height: 36,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 5,
    cursor: 'pointer',
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    transition: 'border-color .2s',
  }

  const iconBtnStyle = {
    width: 36, height: 36, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    transition: 'background 100ms',
    color: 'var(--text-secondary)',
  }

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-deep)',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-display)',
      overflow: 'hidden',
    }}>
      {/* Boot screen */}
      {!booted && <V2BootScreen onComplete={handleBootComplete} />}

      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 100,
        background: 'var(--bg-deep)',
      }}>
        {/* Left group: 3D radiant + RADIANT logotype */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div
            className="radiant-logo-hover"
            style={{
              lineHeight: 0,
              cursor: 'grab',
              padding: 4,
              borderRadius: '50%',
              boxShadow: glowIntensity > 0
                ? `0 0 ${14 + glowIntensity * 16}px ${4 + glowIntensity * 6}px rgba(212, 175, 55, ${0.3 + glowIntensity * 0.3}), 0 0 ${30 + glowIntensity * 20}px ${8 + glowIntensity * 10}px rgba(212, 175, 55, ${0.1 + glowIntensity * 0.15})`
                : undefined,
              transition: 'box-shadow 0.3s ease',
            }}
          >
            <PrimeRadiant size={36} fps={30} strutScale={1.8} brightness={0.2} interactive onGlowChange={handleGlowChange} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            textTransform: 'uppercase',
          }}>
            RADIANT
          </span>
        </div>

        {/* Right group: theme toggle + credits + user menu */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Theme toggle */}
          <div
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{ ...iconBtnStyle, fontSize: 16 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </div>

          {/* Requirements Library */}
          <div
            onClick={() => { setLibraryInitialSetId(null); setShowLibrary(true) }}
            style={iconBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
            title="Requirements Library"
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="3" y="2.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <rect x="5.5" y="1" width="5" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--bg-deep)" />
              <line x1="5.5" y1="7" x2="10.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="12" x2="8.5" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>

          {/* Notification inbox */}
          <div ref={inboxRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowInbox(v => !v); setShowCredits(false); setShowAcct(false) }}
              onMouseEnter={() => setBellHover(true)}
              onMouseLeave={() => setBellHover(false)}
              style={{
                ...pillStyle,
                color: visibleRequests.length > 0 ? 'var(--accent-amber)' : 'var(--text-secondary)',
                position: 'relative',
                borderColor: (bellHover || showInbox)
                  ? (visibleRequests.length > 0 ? 'var(--accent-amber)' : 'var(--border-hover)')
                  : 'var(--border)',
                transition: 'border-color 150ms',
              }}
            >
              <svg width={14} height={14} viewBox="0 0 16 16" fill="none">
                <path d="M8 1.5a4.5 4.5 0 00-4.5 4.5c0 2.5-1.5 4-1.5 4h12s-1.5-1.5-1.5-4A4.5 4.5 0 008 1.5z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6.5 13.5a1.5 1.5 0 003 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {visibleRequests.length > 0 && (
                <span style={{
                  position: 'absolute', top: -2, right: -2,
                  width: 14, height: 14, borderRadius: '50%',
                  background: 'var(--accent-amber)',
                  color: '#000', fontSize: 8, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>{visibleRequests.length}</span>
              )}
            </button>

            {showInbox && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 300,
                maxWidth: 340,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '10px 14px 8px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', letterSpacing: '.08em' }}>NOTIFICATIONS</div>
                </div>
                {visibleRequests.length === 0 ? (
                  <div style={{ padding: '20px 14px', textAlign: 'center', fontSize: 12, color: 'var(--text-dim)' }}>
                    No pending notifications
                  </div>
                ) : (
                  visibleRequests.map(req => {
                    const isRevocation = req.type === 'revocation'
                    const isAcceptance = req.type === 'acceptance'
                    const isDecline = req.type === 'decline'
                    const badgeColor = isRevocation || isDecline ? 'var(--accent-red)' : isAcceptance ? 'var(--accent-green)' : 'var(--accent-indigo)'
                    const badgeLabel = isRevocation ? 'REVOKED' : isAcceptance ? 'ACCEPTED' : isDecline ? 'DECLINED' : 'REQUEST'
                    return (
                    <div
                      key={req.id}
                      onClick={() => {
                        setShowInbox(false)
                        if (isRevocation) {
                          setRevocationNotice(req)
                        } else if (isAcceptance || isDecline) {
                          // Dismiss notification and pan to asset
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          if (isAcceptance) {
                            const targetNode = Object.values(nodeMap).find(n => n.pin === req.asset?.pin)
                            if (targetNode) {
                              setTimeout(() => setSel(targetNode.id), 100)
                            }
                          }
                          if (isDecline) {
                            const targetNode = Object.values(nodeMap).find(n =>
                              n.pin === req.asset?.pin && n._isDeclined
                            )
                            if (targetNode) {
                              setTimeout(() => setSel(targetNode.id), 100)
                            }
                          }
                        } else {
                          const reqNode = req.asset?.pin ? Object.values(nodeMap).find(n => n.pin === req.asset.pin) : null
                          setResponseRequest(reqNode ? { ...req, node: reqNode } : req)
                        }
                      }}
                      style={{
                        padding: '10px 14px',
                        borderBottom: '1px solid var(--border)',
                        cursor: 'pointer',
                        transition: 'background 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: `color-mix(in srgb, ${badgeColor} 15%, transparent)`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700,
                          color: badgeColor,
                          fontFamily: 'var(--font-mono)', flexShrink: 0,
                        }}>{req.from.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{req.from.name}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>{req.date}</div>
                        </div>
                        <span style={{
                          fontSize: 9, fontFamily: 'var(--font-mono)', fontWeight: 600,
                          color: badgeColor,
                          padding: '2px 6px',
                          background: `color-mix(in srgb, ${badgeColor} 10%, transparent)`,
                          borderRadius: 4,
                        }}>{badgeLabel}</span>
                        {req.fromDirectory && (
                          <span title="Discovered via Public Directory" style={{
                            display: 'inline-flex', alignItems: 'center', marginLeft: 4,
                          }}>
                            <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" stroke="#38bdf8" strokeWidth="1.2" />
                              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="#38bdf8" strokeWidth="0.9" />
                              <line x1="2" y1="8" x2="14" y2="8" stroke="#38bdf8" strokeWidth="0.9" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 30 }}>
                        {isRevocation
                          ? `Revoked ${req.disclosureType} disclosure to ${req.asset?.name}`
                          : isAcceptance
                            ? `Granted ${req.disclosureType} disclosure to ${req.asset?.name}`
                            : isDecline
                              ? `Declined disclosure to ${req.asset?.name}`
                              : req.asset.name
                        }
                      </div>
                    </div>
                    )
                  })
                )}
              </div>
            )}
          </div>

          {/* Credits pill */}
          <div ref={creditsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowCredits(v => !v); setShowAcct(false) }}
              style={{
                ...pillStyle,
                color: 'var(--accent-indigo)',
                fontWeight: 600,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-indigo)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <span style={{ fontSize: 13 }}>◇</span>
              {credits}
              <span style={{ fontSize: 8, color: 'var(--text-muted)', fontWeight: 400 }}>credits</span>
            </button>

            {/* Credits dropdown */}
            {showCredits && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 220,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em', marginBottom: 6 }}>CREDIT BALANCE</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)' }}>{credits}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>credits remaining</span>
                  </div>
                </div>
                <div style={{ padding: '8px 14px' }}>
                  <button
                    onClick={() => setCredits(c => c + 100)}
                    style={{
                      width: '100%',
                      padding: '7px 0',
                      background: 'var(--accent-indigo)',
                      border: 'none',
                      borderRadius: 4,
                      color: '#fff',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'opacity .15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}
                  >
                    + Add 100 Credits
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User menu */}
          <div ref={acctRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowAcct(v => !v); setShowCredits(false) }}
              style={{
                ...pillStyle,
                color: 'var(--text-primary)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-hover)' }}
              onMouseLeave={e => { if (!showAcct) e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <div style={{
                width: 20,
                height: 20,
                borderRadius: '50%',
                background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 10,
                fontWeight: 700,
                lineHeight: 1,
                color: 'var(--text-bright)',
              }}>{activeRole.user[0]}</div>
              <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeRole.user}</span>
              <span style={{ fontSize: 20, color: 'var(--text-muted)' }}>▾</span>
            </button>

            {/* Account dropdown */}
            {showAcct && (
              <div style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                right: 0,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 0,
                zIndex: 200,
                minWidth: 240,
                boxShadow: 'var(--shadow-dropdown)',
                overflow: 'hidden',
              }}>
                {/* Current user header */}
                <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg,#6366f1,#818cf8)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--text-bright)',
                      flexShrink: 0,
                    }}>{activeRole.user[0]}</div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-bright)' }}>{activeRole.user}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{activeRole.party}</div>
                    </div>
                  </div>
                </div>

                {/* Role switching */}
                <div style={{ padding: '6px 0' }}>
                  <div style={{ padding: '4px 14px 6px', fontSize: 9, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '.08em' }}>SWITCH USER</div>
                  {ROLES.map(r => {
                    const isCurrent = r.id === roleId
                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSwitchRole(r.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '7px 14px',
                          cursor: isCurrent ? 'default' : 'pointer',
                          background: isCurrent ? 'rgba(99,102,241,.08)' : 'transparent',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => { if (!isCurrent) e.currentTarget.style.background = 'var(--bg-hover)' }}
                        onMouseLeave={e => { if (!isCurrent) e.currentTarget.style.background = 'transparent' }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          background: isCurrent ? 'linear-gradient(135deg,#6366f1,#818cf8)' : 'var(--bg-raised)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 700,
                          color: isCurrent ? 'var(--text-bright)' : 'var(--text-tertiary)',
                        }}>{r.user[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: isCurrent ? 'var(--accent-indigo-text)' : 'var(--text-primary)' }}>{r.user}</div>
                          <div style={{ fontSize: 9, color: isCurrent ? 'var(--accent-indigo)' : 'var(--text-muted)' }}>{r.party} · {r.role}</div>
                        </div>
                        {isCurrent && <span style={{ fontSize: 8, color: 'var(--accent-indigo)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>ACTIVE</span>}
                      </div>
                    )
                  })}
                </div>

                {/* Account actions */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                  {[
                    { icon: '⚙', label: 'Account Settings' },
                    { icon: '☰', label: 'Preferences' },
                    { icon: '↗', label: 'Logout' },
                  ].map(a => (
                    <div
                      key={a.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '7px 14px',
                        cursor: 'default',
                        opacity: 0.4,
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.02)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', width: 16, textAlign: 'center' }}>{a.icon}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flex: 1 }}>{a.label}</span>
                      <span style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>COMING SOON</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <V2Canvas
          ref={canvasRef}
          key={roleId}
          nodes={subchainData ? subchainData.nodes : nodes}
          edges={subchainData ? subchainData.edges : edges}
          nodeMap={subchainData ? subchainData.nodeMap : nodeMap}
          selectedId={sel}
          onSelect={handleSelect}
          onCloseSel={handleCloseSel}
          onOpenSubgraph={handleOpenSubgraph}
          isSubchain={!!subchainFocusId}
          subchainFocusId={subchainFocusId}
          onExitSubchain={exitSubchain}
          modalOpen={!!modalNode}
          panelWidth={sel && nodeMap[sel] && nodeMap[sel].category !== 'party' ? 480 : 0}
          onLayerChange={setLayerInfo}
          onConnect={(node) => setConnectNode(node)}
          onDisclose={(node) => setPublishNode(node)}
          onAddEvidence={(node) => setEvidenceNode(node)}
          onParseEvidence={(evidenceNodeArg) => {
            const parentAsset = nodes.find(n => n.children?.some(c => c.id === evidenceNodeArg.id))
            setParseContext({
              evidenceNode: evidenceNodeArg,
              parentAssetId: parentAsset?.id || null,
              parentAssetName: parentAsset?.name || 'Unknown Asset',
            })
          }}
          onRunEvaluation={(node) => {
            if (!node) return
            if (node.isEvidence) {
              const parentAsset = nodes.find(n => n.children?.some(c => c.id === node.id))
              if (!parentAsset) return
              const resolvedParsedFields = (parentAsset.children || [])
                .filter(c => c.isParse || c.category === 'parse')
                .flatMap(pn => pn.parsedFields || [])
              let discType = 'full'
              if (parentAsset.owner !== activeRole.party) {
                const sda = (parentAsset.sdas || []).find(s => s.party === activeRole.party)
                discType = sda?.type || 'full'
              }
              setEvalContext({ assetNode: parentAsset, evidenceNode: node, disclosureType: discType, parsedFields: resolvedParsedFields })
            } else {
              const sda = (node.sdas || []).find(s => s.party === activeRole.party || s.party !== node.owner)
              const disclosureType = sda?.type || 'full'
              setEvalContext({ assetNode: node, disclosureType })
            }
          }}
          activeParty={activeRole.party}
        />

        {/* Subchain pill */}
        {subchainFocusId && (
          <div style={{
            position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
            zIndex: 55,
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 16px', borderRadius: 20,
            background: 'color-mix(in srgb, var(--accent-indigo) 10%, var(--bg-deep))',
            border: '1px solid color-mix(in srgb, var(--accent-indigo) 25%, transparent)',
            backdropFilter: 'blur(8px)',
          }}>
            <span style={{ fontSize: 12, color: 'var(--accent-indigo)' }}>⛓</span>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>
              {nodeMap[subchainFocusId]?.name || subchainFocusId}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>
              {subchainData?.nodes.length || 0} nodes
            </span>
            <span
              onClick={() => {
                if (layerInfo.depth > 0) {
                  canvasRef.current?.surface()
                } else {
                  exitSubchain()
                }
              }}
              style={{
                padding: '2px 10px', borderRadius: 10,
                background: 'var(--bg-raised)', border: '1px solid var(--border)',
                fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              ✕ Exit
            </span>
          </div>
        )}

        {/* Detail Panel overlay */}
        {sel && nodeMap[sel] && nodeMap[sel].category !== 'party' && (
          <div style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            width: 480,
            zIndex: 50,
            animation: 'detail-panel-slide-in 200ms ease',
          }}>
            <DetailPanel
              node={nodeMap[sel]}
              onClose={handleCloseSel}
              onViewChain={handlePanelViewChain}
              onExpandStack={handlePanelExpandStack}
              onSurface={handlePanelSurface}
              isAnchor={isAnchorSelected}
              depth={layerInfo.depth}
              onDisclose={() => sel && nodeMap[sel] && setPublishNode(nodeMap[sel])}
              onConnect={() => sel && nodeMap[sel] && setConnectNode(nodeMap[sel])}
              onAddEvidence={() => sel && nodeMap[sel] && setEvidenceNode(nodeMap[sel])}
              onParseEvidence={() => {
                if (!sel || !nodeMap[sel]) return
                const evNode = nodeMap[sel]
                if (!evNode.isEvidence) return
                const parentAsset = nodes.find(n => n.children?.some(c => c.id === evNode.id))
                setParseContext({
                  evidenceNode: evNode,
                  parentAssetId: parentAsset?.id || null,
                  parentAssetName: parentAsset?.name || 'Unknown Asset',
                })
              }}
              onRunEvaluation={() => {
                if (!sel || !nodeMap[sel]) return
                const evidenceNode = nodeMap[sel]
                if (!evidenceNode.isEvidence) return
                // Find parent asset
                const parentAsset = nodes.find(n => n.children?.some(c => c.id === evidenceNode.id))
                if (!parentAsset) return
                // Resolve parsed fields from sibling parse nodes
                const resolvedParsedFields = (parentAsset.children || [])
                  .filter(c => c.isParse || c.category === 'parse')
                  .flatMap(pn => pn.parsedFields || [])
                // Determine disclosure type
                let discType = 'full'
                if (parentAsset.owner !== activeRole.party) {
                  const sda = (parentAsset.sdas || []).find(s => s.party === activeRole.party)
                  discType = sda?.type || 'full'
                }
                setEvalContext({ assetNode: parentAsset, evidenceNode, disclosureType: discType, parsedFields: resolvedParsedFields })
              }}
              canEvaluate={(() => {
                const n = nodeMap[sel]
                if (!n) return false
                if (!n.isEvidence) return false
                // Find parent asset and check for sibling parse nodes
                const parentAsset = nodes.find(p => p.children?.some(c => c.id === n.id))
                if (!parentAsset) return false
                const hasSiblingParse = parentAsset.children?.some(c => c.isParse || c.category === 'parse')
                if (!hasSiblingParse) return false
                const isNodeOwner = parentAsset.owner === activeRole.party
                const hasAccess = (parentAsset.sdas || []).some(s =>
                  s.party === activeRole.party && (s.type === 'full' || s.type === 'selective')
                )
                return isNodeOwner || hasAccess
              })()}
              onManageCascade={(sda) => sel && nodeMap[sel] && setCascadeContext({ node: nodeMap[sel], sda })}
              isOwner={nodeMap[sel]?.owner === activeRole.party}
              onViewChild={handleViewChild}
              onCancelRequest={(provNode) => {
                updateRoleState(roleId, prev => ({
                  ...prev,
                  addedNodes: prev.addedNodes.filter(n => n.id !== provNode.id),
                  addedEdges: prev.addedEdges.filter(e => e.to !== provNode.id && e.from !== provNode.id),
                }))
                const otherRoleId = ROLES.find(r => r.id !== roleId)?.id
                if (otherRoleId) {
                  updateRoleState(otherRoleId, prev => ({
                    ...prev,
                    addedRequests: (prev.addedRequests || []).filter(r =>
                      r.asset?.pin !== provNode.pin
                    ),
                  }))
                }
                setSel(null)
              }}
              onSelectAsset={(pinOrId) => {
                if (!pinOrId) return
                const target = Object.values(nodeMap).find(n => n.pin === pinOrId || n.id === pinOrId)
                if (target) setSel(target.id)
              }}
              onOpenLibrary={(setId) => {
                setLibraryInitialSetId(setId || null)
                setShowLibrary(true)
              }}
              onDismissDeclined={(provNode) => {
                updateRoleState(roleId, prev => ({
                  ...prev,
                  addedNodes: prev.addedNodes.filter(n => n.id !== provNode.id),
                  addedEdges: prev.addedEdges.filter(e => e.to !== provNode.id && e.from !== provNode.id),
                }))
                setSel(null)
              }}
              onRevokeSda={({ sda, nodeId, message }) => {
                const today = new Date().toISOString().slice(0, 10)
                const otherRoleId = ROLES.find(r => r.id !== roleId)?.id
                const clickedNode = nodeMap[nodeId]

                // ===== SELF-REVOCATION: removing own asset from own network =====
                const isInternal = sda.partyLabel === 'internal' ||
                  (clickedNode?.owner === activeRole.party && sda.party === activeRole.party)

                if (isInternal) {
                  updateRoleState(roleId, prev => {
                    const newState = { ...prev }
                    const ownRoleData = getDataForRole(roleId)

                    const isStatic = !!ownRoleData.nodeMap[nodeId]
                    const isDynamic = prev.addedNodes.some(n => n.id === nodeId)
                    if (isDynamic) {
                      newState.addedNodes = prev.addedNodes.filter(n => n.id !== nodeId)
                    } else if (isStatic) {
                      newState.removedNodes = [...(prev.removedNodes || []), nodeId]
                    }

                    newState.addedEdges = prev.addedEdges.filter(e =>
                      e.from !== nodeId && e.to !== nodeId
                    )
                    const staticEdgesToRemove = ownRoleData.edges
                      .filter(e => e.from === nodeId || e.to === nodeId)
                      .map(e => e.id)
                    if (staticEdgesToRemove.length > 0) {
                      newState.removedEdges = [...(prev.removedEdges || []), ...staticEdgesToRemove]
                    }

                    if (prev.addedChildren?.[nodeId]) {
                      const { [nodeId]: _, ...rest } = prev.addedChildren
                      newState.addedChildren = rest
                    }
                    if (prev.addedSDAs?.[nodeId]) {
                      const { [nodeId]: _, ...rest2 } = prev.addedSDAs
                      newState.addedSDAs = rest2
                    }

                    return newState
                  })
                  setSel(null)
                  return
                }

                // ===== FOREIGN DISCLOSURE REVOCATION =====
                const connectorPin = sda.assetPin
                let connectorNode = connectorPin
                  ? Object.values(nodeMap).find(n => n.pin === connectorPin)
                  : null

                // Fallback: find connected node via party name when assetPin is null
                if (!connectorNode && sda.party) {
                  connectorNode = Object.values(nodeMap).find(n =>
                    n.name === sda.party || n.id === sda.party.toLowerCase().replace(/\s+/g, '-')
                  ) || null
                }

                // Determine which side is "ours" and which is "theirs"
                let ownAssetId, ownAssetPin, foreignNodeId, foreignNodePin

                if (clickedNode?.owner === activeRole.party) {
                  ownAssetId = nodeId
                  ownAssetPin = clickedNode?.pin
                  foreignNodeId = connectorNode?.id
                  foreignNodePin = connectorPin
                } else {
                  foreignNodeId = nodeId
                  foreignNodePin = clickedNode?.pin
                  ownAssetId = connectorNode?.id
                  ownAssetPin = connectorPin
                }

                // ===== STEP 1: Remove SDA from our own asset =====
                if (ownAssetId) {
                  updateRoleState(roleId, prev => {
                    const addedForNode = prev.addedSDAs[ownAssetId] || []
                    const matchIndex = addedForNode.findIndex(s =>
                      s.party === sda.party && s.type === sda.type && s.created === sda.created
                    )
                    // Also try matching by type+created only (SDA party field varies by perspective)
                    const matchIndex2 = matchIndex >= 0 ? matchIndex : addedForNode.findIndex(s =>
                      s.type === sda.type && s.created === sda.created
                    )

                    const newState = { ...prev }
                    if (matchIndex2 >= 0) {
                      const updated = [...addedForNode]
                      updated.splice(matchIndex2, 1)
                      newState.addedSDAs = { ...prev.addedSDAs, [ownAssetId]: updated }
                    } else {
                      newState.removedSDAs = [...(prev.removedSDAs || []), {
                        nodeId: ownAssetId,
                        party: sda.party,
                        type: sda.type,
                        created: sda.created,
                      }]
                    }
                    return newState
                  })
                }

                // ===== STEP 1b: Remove the foreign node + edge from our own network =====
                if (foreignNodeId) {
                  updateRoleState(roleId, prev => {
                    const newState = { ...prev }
                    const ownRoleData = getDataForRole(roleId)

                    // Remove edge between own asset and foreign node
                    newState.addedEdges = prev.addedEdges.filter(e =>
                      !((e.from === ownAssetId && e.to === foreignNodeId) || (e.from === foreignNodeId && e.to === ownAssetId))
                    )
                    const staticEdgesToRemove = ownRoleData.edges
                      .filter(e =>
                        (e.from === ownAssetId && e.to === foreignNodeId) ||
                        (e.from === foreignNodeId && e.to === ownAssetId)
                      )
                      .map(e => e.id)
                    if (staticEdgesToRemove.length > 0) {
                      newState.removedEdges = [...(prev.removedEdges || []), ...staticEdgesToRemove]
                    }

                    // Remove SDA from the foreign node that references our asset
                    const foreignNodeData = nodeMap[foreignNodeId]
                    if (foreignNodeData) {
                      const staticSda = (foreignNodeData.sdas || []).find(s => s.assetPin === ownAssetPin)
                      if (staticSda) {
                        newState.removedSDAs = [...(prev.removedSDAs || []), {
                          nodeId: foreignNodeId,
                          party: staticSda.party,
                          type: staticSda.type,
                          created: staticSda.created,
                        }]
                      }
                      const dynamicSdas = prev.addedSDAs[foreignNodeId] || []
                      if (dynamicSdas.length > 0) {
                        newState.addedSDAs = {
                          ...(newState.addedSDAs || prev.addedSDAs),
                          [foreignNodeId]: dynamicSdas.filter(s => s.assetPin !== ownAssetPin),
                        }
                      }
                    }

                    // Check if foreign node has any remaining edges
                    const allCurrentEdges = [
                      ...ownRoleData.edges.filter(e =>
                        !(prev.removedEdges || []).includes(e.id) && !staticEdgesToRemove.includes(e.id)
                      ),
                      ...newState.addedEdges,
                    ]
                    const remainingForeignEdges = allCurrentEdges.filter(e =>
                      e.from === foreignNodeId || e.to === foreignNodeId
                    )

                    if (remainingForeignEdges.length === 0) {
                      const isStaticNode = !!ownRoleData.nodeMap[foreignNodeId]
                      const isDynamicNode = prev.addedNodes.some(n => n.id === foreignNodeId)
                      if (isDynamicNode) {
                        newState.addedNodes = prev.addedNodes.filter(n => n.id !== foreignNodeId)
                      } else if (isStaticNode) {
                        newState.removedNodes = [...(prev.removedNodes || []), foreignNodeId]
                      }
                    }

                    return newState
                  })
                }

                // ===== STEP 2: Cross-role — remove our asset from other role's network =====
                if (otherRoleId && ownAssetId) {
                  const otherRoleData = getDataForRole(otherRoleId)

                  updateRoleState(otherRoleId, prev => {
                    const newState = { ...prev }
                    const targetNodeId = ownAssetId

                    // Remove node — dynamic or static
                    const isStatic = !!otherRoleData.nodeMap[targetNodeId]
                    const isDynamic = prev.addedNodes.some(n => n.id === targetNodeId)
                    if (isDynamic) {
                      newState.addedNodes = prev.addedNodes.filter(n => n.id !== targetNodeId)
                    } else if (isStatic) {
                      newState.removedNodes = [...(prev.removedNodes || []), targetNodeId]
                    }

                    // Remove edges
                    newState.addedEdges = prev.addedEdges.filter(e =>
                      e.to !== targetNodeId && e.from !== targetNodeId
                    )
                    const staticEdgesToRemove = otherRoleData.edges
                      .filter(e => e.to === targetNodeId || e.from === targetNodeId)
                      .map(e => e.id)
                    if (staticEdgesToRemove.length > 0) {
                      newState.removedEdges = [...(prev.removedEdges || []), ...staticEdgesToRemove]
                    }

                    // Remove dynamic SDAs referencing our asset
                    const updatedAddedSDAs = { ...prev.addedSDAs }
                    Object.keys(updatedAddedSDAs).forEach(nid => {
                      updatedAddedSDAs[nid] = (updatedAddedSDAs[nid] || []).filter(s =>
                        s.assetPin !== ownAssetPin
                      )
                    })
                    newState.addedSDAs = updatedAddedSDAs

                    // Remove static SDAs on the other role's connector
                    if (foreignNodeId) {
                      const otherConnector = otherRoleData.nodes.find(n => n.id === foreignNodeId)
                      if (otherConnector) {
                        const staticSda = (otherConnector.sdas || []).find(s => s.assetPin === ownAssetPin)
                        if (staticSda) {
                          newState.removedSDAs = [...(prev.removedSDAs || []), {
                            nodeId: foreignNodeId,
                            party: staticSda.party,
                            type: staticSda.type,
                            created: staticSda.created,
                          }]
                        }
                      }
                    }

                    // Revocation notification
                    newState.addedRequests = [...(prev.addedRequests || []), {
                      id: `revoke-${targetNodeId}-${Date.now().toString(36)}`,
                      type: 'revocation',
                      from: { name: activeRole.party, dot: activeRole.partyDot },
                      asset: {
                        name: nodeMap[ownAssetId]?.name || 'Unknown Asset',
                        pin: ownAssetPin || '',
                      },
                      disclosureType: sda.type,
                      message: message || '',
                      date: today,
                    }]

                    return newState
                  })
                }

                // Deselect after revoke (the selected node may have been removed)
                setSel(null)
              }}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-deep)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-green, #22c55e)',
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--accent-green, #22c55e)',
            letterSpacing: '0.04em',
          }}>
            Connected to AWS S3
          </span>
          <span style={{ margin: '0 8px', color: 'var(--border)' }}>·</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: 'var(--text-muted)',
          }}>
            {activeRole.vertical}
          </span>
        </div>
      </div>

      {/* SubgraphModal — disabled, replaced by subchain canvas view */}
      {/* {modalNode && (
        <V2SubgraphModal node={modalNode} onClose={handleCloseModal} />
      )} */}

      {/* Disclosure modals — shared persistent backdrop */}
      {(publishNode || connectNode || registerNode || responseRequest || cascadeContext || evidenceNode || parseContext || revocationNotice || showLibrary || evalContext) && (
        <Backdrop onClose={() => {
          if (evalContext) setEvalContext(null)
          else if (showLibrary) { setShowLibrary(false); setLibraryInitialSetId(null) }
          else if (connectNode) setConnectNode(null)
          else if (registerNode) setRegisterNode(null)
          else if (evidenceNode) setEvidenceNode(null)
          else if (parseContext) setParseContext(null)
          else if (responseRequest) setResponseRequest(null)
          else if (publishNode) setPublishNode(null)
          else if (cascadeContext) setCascadeContext(null)
          else if (revocationNotice) setRevocationNotice(null)
        }}>
      {publishNode && (
        <PublishModal
          node={nodeMap[publishNode.id] || publishNode}
          onClose={() => setPublishNode(null)}
          onComplete={({ assetId, disclosureType, selectedFields, expiry, customDate }) => {
            const today = new Date().toISOString().slice(0, 10)
            const radiantDot = makeDot('Radiant Network')
            const publicSda = {
              type: disclosureType,
              party: 'Radiant Network',
              partyDot: radiantDot,
              created: today,
              expires: expiry === 'no-expiry' ? null : expiry === 'custom' ? customDate : (() => {
                const d = new Date()
                if (expiry === '1-year') d.setFullYear(d.getFullYear() + 1)
                if (expiry === '2-year') d.setFullYear(d.getFullYear() + 2)
                return d.toISOString().slice(0, 10)
              })(),
              pins: [],
              assetName: null,
              assetPin: null,
              disclosedFields: selectedFields || null,
            }

            updateRoleState(roleId, prev => {
              const newState = { ...prev }

              // Add SDA to the asset
              newState.addedSDAs = {
                ...prev.addedSDAs,
                [assetId]: [...(prev.addedSDAs[assetId] || []), publicSda],
              }

              // Check if Radiant Network node already exists
              const radiantExists = prev.addedNodes.some(n => n.id === 'radiant-network') ||
                nodes.some(n => n.id === 'radiant-network')

              if (!radiantExists) {
                const radiantNode = {
                  id: 'radiant-network',
                  pin: makePin('radiant-network'),
                  dot: radiantDot,
                  name: 'Radiant Network',
                  category: 'party',
                  owner: 'Radiant Network',
                  parentId: null,
                  children: [],
                  health: { ok: 0, warn: 0, bad: 0 },
                  childHealth: null,
                  totalHealth: null,
                  displayHealth: { ok: 0, warn: 0, bad: 0 },
                  claimCount: 0,
                  displayClaimCount: 0,
                  hasEvidence: false,
                  hasStack: false,
                  childCount: 0,
                  evidence: null,
                  evaluations: [],
                  sdas: [],
                  x: (publishNode.x || 0) + 600,
                  y: (publishNode.y || 0),
                  parentOwner: 'Radiant Network',
                  isCascade: false,
                  cascadeVia: null,
                  upstreamSda: null,
                  upstreamAssets: null,
                  isEvidence: false,
                  lastEval: null,
                  description: 'Public asset directory — all published assets are discoverable here.',
                  isNetworkNode: true,
                  _isNew: true,
                }
                newState.addedNodes = [...prev.addedNodes, radiantNode]
              }

              // Add edge from published asset to Radiant Network
              const edgeExists = prev.addedEdges.some(e =>
                (e.from === assetId && e.to === 'radiant-network') ||
                (e.from === 'radiant-network' && e.to === assetId)
              )
              if (!edgeExists) {
                newState.addedEdges = [...prev.addedEdges, {
                  id: `e-${assetId}-radiant-${Date.now().toString(36)}}`,
                  from: assetId,
                  to: 'radiant-network',
                  sdaType: disclosureType,
                }]
              }

              return newState
            })
          }}
          _noBackdrop
        />
      )}
      {connectNode && (
        <RequestDisclosureModal
          contextNode={connectNode}
          requirementSets={requirementSets}
          publicListings={publicListings}
          onClose={() => setConnectNode(null)}
          onRegisterAsset={() => {
            const node = connectNode
            setConnectNode(null)
            setRegisterNode(node)
          }}
          onSubmitRequest={handleSubmitRequest}
          onValidatePins={handleValidatePins}
          _noBackdrop
        />
      )}
      {registerNode && (
        <RegisterAssetModal
          parentNode={registerNode}
          activeParty={activeRole.party}
          nodeMap={nodeMap}
          onClose={() => setRegisterNode(null)}
          onBack={() => {
            const node = registerNode
            setRegisterNode(null)
            setConnectNode(node)
          }}
          onComplete={(result) => {
            if (result.bulk) {
              // Bulk import: create multiple nodes + edges
              const today = new Date().toISOString().slice(0, 10)
              const newNodes = []
              const newEdges = []
              let firstNodeId = null

              result.assets.forEach((asset, index) => {
                const slug = asset.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
                const nodeId = `${slug}-${Date.now().toString(36)}-${index}`
                if (!firstNodeId) firstNodeId = nodeId

                const parentId = Object.values(nodeMap).find(n => n.pin === asset.parentPin)?.id || registerNode.id
                const parentNodeRef = nodeMap[parentId] || registerNode

                const connectedEdgesForParent = edges.filter(e => e.from === parentId)
                const connectedNodesForParent = connectedEdgesForParent.map(e => nodeMap[e.to]).filter(Boolean)
                const batchSiblings = newNodes.filter(n => newEdges.some(e => e.from === parentId && e.to === n.id))
                const allSiblings = [...connectedNodesForParent, ...batchSiblings]

                let newX, newY
                if (allSiblings.length > 0) {
                  newX = allSiblings[0].x
                  newY = parentNodeRef.y || 0
                } else {
                  newX = (parentNodeRef.x || 0) + 500
                  newY = parentNodeRef.y || 0
                }

                // Collision check against all existing + batch-created nodes
                newY = findClearY(newX, newY, [...nodes, ...newNodes])

                const newNode = {
                  id: nodeId,
                  pin: makePin(nodeId),
                  dot: makeDot(activeRole.party),
                  name: asset.name,
                  category: asset.category,
                  owner: activeRole.party,
                  parentId: null,
                  children: [],
                  health: { ok: 0, warn: 0, bad: 0 },
                  childHealth: null,
                  totalHealth: null,
                  displayHealth: { ok: 0, warn: 0, bad: 0 },
                  claimCount: 0,
                  displayClaimCount: 0,
                  hasEvidence: !!asset.evidenceUri,
                  hasStack: !!asset.evidenceUri,
                  childCount: asset.evidenceUri ? 1 : 0,
                  evidence: null,
                  evaluations: [],
                  sdas: [{
                    type: 'full',
                    party: activeRole.party,
                    partyLabel: 'internal',
                    partyDot: activeRole.partyDot,
                    created: today,
                    expires: null,
                    pins: [],
                    assetName: null,
                    assetPin: null,
                  }],
                  x: newX,
                  y: newY,
                  parentOwner: activeRole.party,
                  isCascade: false,
                  cascadeVia: null,
                  upstreamSda: null,
                  upstreamAssets: null,
                  isEvidence: false,
                  lastEval: null,
                  description: null,
                  _isNew: true,
                }

                if (asset.evidenceUri) {
                  const evMeta = makeEvidence(
                    nodeId,
                    asset.name.replace(/\s+/g, '-').toUpperCase().slice(0, 12),
                    activeRole.party + ' Lab',
                    '10 years'
                  )
                  const uriFilename = asset.evidenceUri.split('/').pop() || 'evidence.pdf'
                  evMeta.filename = uriFilename
                  evMeta.uri = asset.evidenceUri

                  const evUniqueId = `ev-${nodeId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
                  const evNode = makeEvidenceNode(nodeId, evMeta, activeRole.party, [], evUniqueId)
                  newNode.children = [evNode]
                  newNode.hasStack = true
                  newNode.childCount = 1
                  newNode.hasEvidence = true
                }

                newNodes.push(newNode)
                newEdges.push({
                  id: `e-${parentId}-${nodeId}`,
                  from: parentId,
                  to: nodeId,
                  sdaType: 'full',
                })
              })

              updateRoleState(roleId, prev => ({
                ...prev,
                addedNodes: [...prev.addedNodes, ...newNodes],
                addedEdges: [...prev.addedEdges, ...newEdges],
              }))

              setRegisterNode(null)
              if (firstNodeId) {
                setTimeout(() => setSel(firstNodeId), 100)
              }
            } else {
              // Single registration
              const { name, category, description } = result
              const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '')
              const nodeId = `${slug}-${Date.now().toString(36)}`
              const today = new Date().toISOString().slice(0, 10)

              const connectedEdges = edges.filter(e => e.from === registerNode.id)
              const connectedNodes = connectedEdges
                .map(e => nodeMap[e.to])
                .filter(Boolean)

              let newX, newY
              if (connectedNodes.length > 0) {
                newX = connectedNodes[0].x
                newY = registerNode.y || 0
              } else {
                newX = (registerNode.x || 0) + 500
                newY = registerNode.y || 0
              }

              // Collision check against all nodes on the graph
              newY = findClearY(newX, newY, nodes)

              const newNode = {
                id: nodeId,
                pin: makePin(nodeId),
                dot: makeDot(activeRole.party),
                name,
                category,
                owner: activeRole.party,
                parentId: null,
                children: [],
                health: { ok: 0, warn: 0, bad: 0 },
                childHealth: null,
                totalHealth: null,
                displayHealth: { ok: 0, warn: 0, bad: 0 },
                claimCount: 0,
                displayClaimCount: 0,
                hasEvidence: false,
                hasStack: false,
                childCount: 0,
                evidence: null,
                evaluations: [],
                sdas: [{
                  type: 'full',
                  party: activeRole.party,
                  partyLabel: 'internal',
                  partyDot: activeRole.partyDot,
                  created: today,
                  expires: null,
                  pins: [],
                  assetName: null,
                  assetPin: null,
                }],
                x: newX,
                y: newY,
                parentOwner: activeRole.party,
                isCascade: false,
                cascadeVia: null,
                upstreamSda: null,
                upstreamAssets: null,
                isEvidence: false,
                lastEval: null,
                description: description || null,
                _isNew: true,
              }

              updateRoleState(roleId, prev => ({
                ...prev,
                addedNodes: [...prev.addedNodes, newNode],
                addedEdges: [...prev.addedEdges, {
                  id: `e-${registerNode.id}-${nodeId}`,
                  from: registerNode.id,
                  to: nodeId,
                  sdaType: 'full',
                }],
              }))

              setRegisterNode(null)
              setTimeout(() => setSel(nodeId), 100)
            }
          }}
          _noBackdrop
        />
      )}
      {responseRequest && (
        <DisclosureResponseModal
          request={responseRequest}
          assetNode={nodeMap[responseRequest.node?.id]}
          onClose={() => setResponseRequest(null)}
          onComplete={(disclosureType, selectedFieldIds) => {
            const req = responseRequest
            const reqNodeId = req.node?.id
            const today = new Date().toISOString().slice(0, 10)

            if (reqNodeId && disclosureType) {
              // Find the other role for cross-role mutations
              const otherRoleId = ROLES.find(r => r.id !== roleId)?.id

              // 1. Create SDA on the target asset (current role)
              const newSDA = {
                type: disclosureType,
                party: req.from.name,
                partyDot: req.from.dot,
                created: today,
                expires: '2027-03-15',
                pins: [],
                assetName: req.connectTo?.name || null,
                assetPin: req.connectTo?.pin || null,
                selectedFieldIds: selectedFieldIds || null,
              }
              updateRoleState(roleId, prev => ({
                ...prev,
                addedSDAs: {
                  ...prev.addedSDAs,
                  [reqNodeId]: [...(prev.addedSDAs[reqNodeId] || []), newSDA],
                },
              }))

              // 2. If connectTo exists and the node isn't already on the network, add it
              if (req.connectTo && !nodeMap[req.connectTo.id]) {
                const connectNodeObj = {
                  id: req.connectTo.id,
                  pin: req.connectTo.pin,
                  dot: req.from.dot,
                  name: req.connectTo.name,
                  category: req.connectTo.category || 'product',
                  owner: req.connectTo.owner || req.from.name,
                  parentId: null,
                  children: [],
                  health: { ok: 0, warn: 0, bad: 0 },
                  childHealth: null,
                  totalHealth: null,
                  displayHealth: { ok: 0, warn: 0, bad: 0 },
                  claimCount: 0,
                  displayClaimCount: 0,
                  hasEvidence: false,
                  hasStack: false,
                  childCount: 0,
                  evidence: null,
                  evaluations: [],
                  sdas: [{
                    type: disclosureType,
                    party: activeRole.party,
                    partyDot: activeRole.partyDot,
                    created: today,
                    expires: '2027-03-15',
                    pins: [],
                    assetName: req.asset.name,
                    assetPin: req.node?.pin || null,
                  }],
                  x: (req.node?.x || 500) + 500,
                  y: req.node?.y || 0,
                  parentOwner: req.connectTo.owner || req.from.name,
                  isCascade: false,
                  cascadeVia: null,
                  upstreamSda: null,
                  upstreamAssets: null,
                  isEvidence: false,
                  lastEval: null,
                  _isNew: true,
                }
                updateRoleState(roleId, prev => ({
                  ...prev,
                  addedNodes: [...prev.addedNodes, connectNodeObj],
                  addedEdges: [...prev.addedEdges, {
                    id: `e-dynamic-${req.connectTo.id}-${reqNodeId}`,
                    from: req.connectTo.id,
                    to: reqNodeId,
                    sdaType: disclosureType,
                  }],
                }))
              }
              // If the connectTo node already exists, just add the edge + SDA
              else if (req.connectTo && nodeMap[req.connectTo.id]) {
                const connectSDA = {
                  type: disclosureType,
                  party: activeRole.party,
                  partyDot: activeRole.partyDot,
                  created: today,
                  expires: '2027-03-15',
                  pins: [],
                  assetName: req.asset.name,
                  assetPin: req.node?.pin || null,
                }
                updateRoleState(roleId, prev => ({
                  ...prev,
                  addedEdges: [...prev.addedEdges, {
                    id: `e-dynamic-${req.connectTo.id}-${reqNodeId}`,
                    from: req.connectTo.id,
                    to: reqNodeId,
                    sdaType: disclosureType,
                  }],
                  addedSDAs: {
                    ...prev.addedSDAs,
                    [req.connectTo.id]: [...(prev.addedSDAs[req.connectTo.id] || []), connectSDA],
                  },
                }))
              }

              // 3. Cross-role mutation: write to the other role's state
              if (otherRoleId && req.connectTo) {
                // The other role (buyer) sees: SDA on their connectTo node + SDA on the disclosed asset + edge
                const crossSdaOnConnectTo = {
                  type: disclosureType,
                  party: activeRole.party,
                  partyDot: activeRole.partyDot,
                  created: today,
                  expires: '2027-03-15',
                  pins: [],
                  assetName: req.asset.name,
                  assetPin: req.node?.pin || null,
                  selectedFieldIds: selectedFieldIds || null,
                }

                const crossSdaOnAsset = {
                  type: disclosureType,
                  party: req.from.name,
                  partyDot: req.from.dot,
                  created: today,
                  expires: '2027-03-15',
                  pins: [],
                  assetName: req.connectTo.name,
                  assetPin: req.connectTo.pin || null,
                  selectedFieldIds: selectedFieldIds || null,
                }

                // Compute position for the disclosed node in the target role's layout
                const otherRoleData = getDataForRole(otherRoleId)
                const otherConnectNodeReal = otherRoleData.nodeMap[req.connectTo.id]
                const targetParty = ROLES.find(r => r.id === otherRoleId)?.party
                const disclosedNodes = otherRoleData.nodes.filter(n => n.owner && n.owner !== targetParty && n.owner !== null)
                const disclosedX = disclosedNodes.length > 0
                  ? disclosedNodes[0].x
                  : (otherConnectNodeReal?.x || 900) + 500
                const existingDynamic = perRoleState[otherRoleId]?.addedNodes || []
                const allRelevantNodes = [...disclosedNodes, ...existingDynamic]
                const nodesInColumn = allRelevantNodes.filter(n => Math.abs(n.x - disclosedX) < 100)
                const lowestY = nodesInColumn.length > 0
                  ? Math.max(...nodesInColumn.map(n => n.y))
                  : (otherConnectNodeReal?.y || 0)
                const idealY = lowestY + 300

                // Collision check against the other role's full node set
                const otherAllNodes = [...otherRoleData.nodes, ...existingDynamic]
                const newY = findClearY(disclosedX, idealY, otherAllNodes)

                // Copy children from the source asset for the disclosed node
                const sourceAsset = nodeMap[reqNodeId]
                let disclosedChildren = []

                if (sourceAsset?.children && sourceAsset.children.length > 0) {
                  if (disclosureType === 'selective' && selectedFieldIds && selectedFieldIds.length > 0) {
                    // Selective: copy children but filter PEP fields
                    const disclosedSet = new Set(selectedFieldIds)
                    disclosedChildren = sourceAsset.children.map(c => {
                      if (!c.isParse && c.category !== 'parse') return { ...c }
                      if (!c.parsedFields) return { ...c }
                      return {
                        ...c,
                        parsedFields: c.parsedFields.filter(f => disclosedSet.has(`${c.id}::${f.id}`)),
                        _isSelective: true,
                      }
                    })
                  } else if (disclosureType === 'proofonly') {
                    // Proof-only: no children copied
                    disclosedChildren = []
                  } else {
                    // Full: copy all children as-is
                    disclosedChildren = sourceAsset.children.map(c => ({ ...c }))
                  }
                }

                // Build the disclosed asset node for the other role's network
                const disclosedNodeForOther = {
                  id: reqNodeId,
                  pin: req.node?.pin || makePin(reqNodeId),
                  dot: makeDot(activeRole.party),
                  name: req.asset.name,
                  category: 'product',
                  owner: activeRole.party,
                  parentId: null,
                  children: disclosedChildren,
                  health: { ok: 0, warn: 0, bad: 0 },
                  childHealth: null,
                  totalHealth: null,
                  displayHealth: { ok: 0, warn: 0, bad: 0 },
                  claimCount: 0,
                  displayClaimCount: 0,
                  hasEvidence: disclosedChildren.some(c => c.isEvidence),
                  hasStack: disclosedChildren.length > 0,
                  childCount: disclosedChildren.length,
                  evidence: null,
                  evaluations: [],
                  sdas: [crossSdaOnAsset],
                  x: disclosedX,
                  y: newY,
                  parentOwner: activeRole.party,
                  isCascade: false,
                  cascadeVia: null,
                  upstreamSda: null,
                  upstreamAssets: null,
                  isEvidence: false,
                  lastEval: null,
                  _isNew: true,
                  _disclosedFieldIds: selectedFieldIds || null,
                  _isSelective: disclosureType === 'selective' ? true : undefined,
                }

                updateRoleState(otherRoleId, prev => {
                  // Check if the asset node already exists in the other role's static or dynamic data
                  const existsInStatic = !!otherRoleData.nodeMap[reqNodeId]
                  const existsInDynamic = prev.addedNodes.some(n => n.id === reqNodeId && !n.provisional)
                  const provId = `provisional-${reqNodeId}`
                  const provisionalNode = prev.addedNodes.find(n => n.id === provId && n.provisional)

                  const newState = { ...prev }

                  // Add SDA on the connectTo node (buyer's asset that requested disclosure)
                  newState.addedSDAs = {
                    ...prev.addedSDAs,
                    [req.connectTo.id]: [...(prev.addedSDAs[req.connectTo.id] || []), crossSdaOnConnectTo],
                  }

                  // Upgrade provisional → real, or add new node, or just add SDA
                  if (provisionalNode) {
                    // Replace provisional node with real disclosed node, keeping position
                    newState.addedNodes = prev.addedNodes
                      .filter(n => n.id !== provId)
                      .concat({ ...disclosedNodeForOther, x: provisionalNode.x, y: provisionalNode.y, _isNew: true })
                    // Replace provisional edges with real disclosure edges
                    newState.addedEdges = prev.addedEdges
                      .filter(e => !((e.to === provId || e.from === provId) && e.sdaType === 'provisional'))
                      .concat({
                        id: `e-dynamic-${req.connectTo.id}-${reqNodeId}`,
                        from: req.connectTo.id,
                        to: reqNodeId,
                        sdaType: disclosureType,
                      })
                  } else if (!existsInStatic && !existsInDynamic) {
                    newState.addedNodes = [...prev.addedNodes, disclosedNodeForOther]
                    // Add edge between connectTo and disclosed asset
                    newState.addedEdges = [...prev.addedEdges, {
                      id: `e-dynamic-${req.connectTo.id}-${reqNodeId}`,
                      from: req.connectTo.id,
                      to: reqNodeId,
                      sdaType: disclosureType,
                    }]
                  } else {
                    // Node exists — just add the SDA to it
                    newState.addedSDAs = {
                      ...newState.addedSDAs,
                      [reqNodeId]: [...(newState.addedSDAs[reqNodeId] || []), crossSdaOnAsset],
                    }
                    // Add edge between connectTo and disclosed asset
                    newState.addedEdges = [...prev.addedEdges, {
                      id: `e-dynamic-${req.connectTo.id}-${reqNodeId}`,
                      from: req.connectTo.id,
                      to: reqNodeId,
                      sdaType: disclosureType,
                    }]
                  }

                  // Add acceptance notification to the other role's inbox
                  newState.addedRequests = [...(newState.addedRequests || prev.addedRequests || []), {
                    id: `accept-${reqNodeId}-${Date.now().toString(36)}`,
                    type: 'acceptance',
                    from: { name: activeRole.party, dot: activeRole.partyDot },
                    asset: {
                      name: req.asset.name,
                      pin: req.node?.pin || '',
                    },
                    disclosureType: disclosureType,
                    date: today,
                  }]

                  // Track for NEW badge (works for both dynamic and static nodes)
                  newState.newlyDisclosedIds = [...(prev.newlyDisclosedIds || []), reqNodeId]

                  return newState
                })
              }
            } else if (reqNodeId && !disclosureType) {
              // DECLINE: mark provisional as declined (keep visible) and notify requester
              const otherRoleId = ROLES.find(r => r.id !== roleId)?.id
              if (otherRoleId) {
                updateRoleState(otherRoleId, prev => {
                  const provId = `provisional-${reqNodeId}`
                  return {
                    ...prev,
                    addedNodes: prev.addedNodes.map(n =>
                      n.id === provId ? { ...n, _isDeclined: true, _isNew: false } : n
                    ),
                    addedRequests: [...(prev.addedRequests || []), {
                      id: `decline-${reqNodeId}-${Date.now().toString(36)}`,
                      type: 'decline',
                      from: { name: activeRole.party, dot: activeRole.partyDot },
                      asset: {
                        name: req.asset.name,
                        pin: req.node?.pin || '',
                      },
                      date: today,
                    }],
                  }
                })
              }
            }

            updateRoleState(roleId, prev => ({
              ...prev,
              dismissedReqs: [...prev.dismissedReqs, req.id],
            }))
            setResponseRequest(null)
            if (reqNodeId) {
              setTimeout(() => setSel(reqNodeId), 100)
            }
          }}
          _noBackdrop
        />
      )}
      {cascadeContext && (
        <CascadeModal
          node={cascadeContext.node}
          sda={cascadeContext.sda}
          existingCascades={existingCascades || []}
          onClose={() => setCascadeContext(null)}
          _noBackdrop
        />
      )}
      {evidenceNode && (
        <AddEvidenceModal
          parentNode={evidenceNode}
          activeParty={activeRole.party}
          onClose={() => setEvidenceNode(null)}
          onComplete={({ name, filename }) => {
            const parentId = evidenceNode.id

            const evidenceMeta = makeEvidence(
              parentId + '-' + Date.now().toString(36),
              name.replace(/\s+/g, '-').toUpperCase().slice(0, 12),
              activeRole.party + ' Lab',
              '10 years'
            )
            evidenceMeta.filename = filename

            const evUniqueId = `ev-${parentId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
            const evNode = makeEvidenceNode(parentId, evidenceMeta, activeRole.party, [], evUniqueId)

            updateRoleState(roleId, prev => {
              const existingChildren = prev.addedChildren?.[parentId] || []
              return {
                ...prev,
                addedChildren: {
                  ...(prev.addedChildren || {}),
                  [parentId]: [...existingChildren, evNode],
                },
              }
            })

            const parentNodeRef = evidenceNode
            setEvidenceNode(null)

            // If already in child layer of this parent, just select the new node
            // The child layer sync will rebuild with the new evidence node
            if (layerInfo.depth > 0 && layerInfo.anchorId === parentNodeRef.id) {
              setTimeout(() => setSel(evNode.id), 200)
            } else {
              // Not in child layer — dive first, then select
              setTimeout(() => {
                if (canvasRef.current) {
                  const updatedParent = nodeMapRef.current[parentNodeRef.id]
                  if (updatedParent) {
                    canvasRef.current.dive(updatedParent)
                    setTimeout(() => setSel(evNode.id), 600)
                  }
                }
              }, 150)
            }
          }}
          _noBackdrop
        />
      )}
      {parseContext && (
        <ParseEvidenceModal
          evidenceNode={parseContext.evidenceNode}
          parentAssetName={parseContext.parentAssetName}
          activeParty={activeRole.party}
          existingParseTemplateIds={(() => {
            const parentAsset = nodeMap[parseContext.parentAssetId]
            if (!parentAsset?.children) return new Set()
            const existingParses = parentAsset.children.filter(c =>
              (c.isParse || c.category === 'parse') &&
              c.sourceEvidenceId === parseContext.evidenceNode.id
            )
            const ids = new Set()
            existingParses.forEach(p => {
              const matched = PEP_TEMPLATES.find(t => t.name === p.name)
              if (matched) ids.add(matched.id)
            })
            return ids
          })()}
          onClose={() => setParseContext(null)}
          onComplete={({ template, parsedFields, creditCost }) => {
            const pepNode = makePepNode(
              parseContext.parentAssetId,
              parseContext.evidenceNode.id,
              template.name,
              parsedFields,
              activeRole.party
            )

            updateRoleState(roleId, prev => {
              const parentId = parseContext.parentAssetId
              const existingChildren = prev.addedChildren?.[parentId] || []
              return {
                ...prev,
                addedChildren: {
                  ...(prev.addedChildren || {}),
                  [parentId]: [...existingChildren, pepNode],
                },
              }
            })

            setCredits(c => c - creditCost)
            setParseContext(null)
            setTimeout(() => setSel(pepNode.id), 150)
          }}
          _noBackdrop
        />
      )}
      {revocationNotice && (
        <RevocationNoticeModal
          notification={revocationNotice}
          onClose={() => {
            updateRoleState(roleId, prev => ({
              ...prev,
              dismissedReqs: [...prev.dismissedReqs, revocationNotice.id],
            }))
            setRevocationNotice(null)
          }}
          _noBackdrop
        />
      )}
      {showLibrary && (
        <RequirementsLibraryModal
          requirementSets={requirementSets}
          onClose={() => { setShowLibrary(false); setLibraryInitialSetId(null) }}
          onSave={handleSaveRequirementSet}
          initialSelectedId={libraryInitialSetId}
          _noBackdrop
        />
      )}
      {evalContext && (
        <RunEvaluationModal
          assetNode={evalContext.assetNode}
          evidenceNode={evalContext.evidenceNode}
          disclosureType={evalContext.disclosureType}
          parsedFields={evalContext.parsedFields}
          requirementSets={requirementSets}
          activeParty={activeRole.party}
          activeUser={activeRole.user || activeRole.party}
          credits={credits}
          onClose={() => setEvalContext(null)}
          onComplete={({ requirementSet, claims, creditCost }) => {
            const assetNode = evalContext.assetNode
            const evalNode = makeEvalNode(
              assetNode.id,
              requirementSet,
              claims,
              activeRole.party,
              activeRole.user || activeRole.party,
              evalContext.disclosureType
            )

            // Add eval node as child of the asset
            updateRoleState(roleId, prev => {
              const existingChildren = prev.addedChildren?.[assetNode.id] || []
              return {
                ...prev,
                addedChildren: {
                  ...(prev.addedChildren || {}),
                  [assetNode.id]: [...existingChildren, evalNode],
                },
              }
            })

            // Deduct credits
            setCredits(c => c - creditCost)
            setEvalContext(null)

            // Dive into the asset's child layer and select the eval node
            if (layerInfo.depth > 0 && layerInfo.anchorId === assetNode.id) {
              setTimeout(() => setSel(evalNode.id), 200)
            } else {
              setTimeout(() => {
                if (canvasRef.current) {
                  const updatedParent = nodeMapRef.current[assetNode.id]
                  if (updatedParent) {
                    canvasRef.current.dive(updatedParent)
                    setTimeout(() => setSel(evalNode.id), 600)
                  }
                }
              }, 150)
            }
          }}
          _noBackdrop
        />
      )}
        </Backdrop>
      )}
    </div>
  )
}
