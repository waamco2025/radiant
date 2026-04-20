import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import V2Canvas from './V2Canvas.jsx'
import V2SubgraphModal from './V2SubgraphModal.jsx'
import V2BootScreen from './V2BootScreen.jsx'
import PrimeRadiant from './PrimeRadiant.jsx'
import { ROLES, getDataForRole, makePin, makeDot, makeClaimNode } from './v2Data.js'
import {
  getV22DataForRole, buildV22Canvas, resolveAgreementsForEdge,
  resolveClaimByPinInShared, makeProvisionalAgreementPair, finalizeProvisionalAgreementPair,
  makeDeclineRecord, makeEvaluationRunArtifacts, findPriorActiveEvaluationResult,
  makeAmendedClaim, makeAmendedDisclosureAgreement,
  makeParseRunArtifacts,
  makeAssetRegistrationArtifacts, makeClaimCreationArtifacts,
  makeTransferRecord, makeAsset, makeDotObject,
  buildV22SharedArtifacts,
} from './v2_2Data.js'
import EdgeMenu from './EdgeMenu.jsx'
import DisclosureAgreementDetailPanel from '../components/DetailPanel/DisclosureAgreementDetailPanel.jsx'
import EvaluationAgreementDetailPanel from '../components/DetailPanel/EvaluationAgreementDetailPanel.jsx'
import V22NodeDetailPanel from '../components/DetailPanel/V22NodeDetailPanel.jsx'
import CombinedRequestModal from '../components/modals/CombinedRequestModal.jsx'
import AIShopperModal from '../components/modals/AIShopperModal.jsx'
import DirectoryLayer from './DirectoryLayer.jsx'
import Tooltip from '../components/Tooltip.jsx'
import V22ParseEvidenceModal from '../components/modals/V22ParseEvidenceModal.jsx'
import CombinedResponseModal from '../components/modals/CombinedResponseModal.jsx'
import V22RunEvaluationModal from '../components/modals/V22RunEvaluationModal.jsx'
import V22CreateAssetModal from '../components/modals/V22CreateAssetModal.jsx'
import V22CreateClaimModal from '../components/modals/V22CreateClaimModal.jsx'
import V22TransferAssetModal from '../components/modals/V22TransferAssetModal.jsx'
import AmendClaimModal from '../components/modals/AmendClaimModal.jsx'
import AmendDisclosureModal from '../components/modals/AmendDisclosureModal.jsx'
import RequirementsLibraryModal from '../components/modals/RequirementsLibraryModal.jsx'
import PEPLibraryModal from '../components/modals/PEPLibraryModal.jsx'
import { Backdrop } from '../components/modals/ModalShared.jsx'
import { getRequirementSetsForRole } from './requirementSets.js'
import { getPEPTemplatesForRole } from './pepTemplates.js'

const SESSION_KEY = 'radiant-v2-booted'
const CREDITS_PER_CLAIM = 25

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
  // V2.2 mode builds its own { nodes, edges, nodeMap } via the canvas adapter.
  // V2.1 mode keeps its existing role-data source and processing pipeline.
  // V2.2 provisional state — cross-role (Bob's request appears on Alice's view too).
  // Shape: { disclosureAgreements, evaluationAgreements, evaluationResults, declineRecords }.
  // Entries with a matching id REPLACE the seeded artifact (accept / supersede).
  const [v22Provisionals, setV22Provisionals] = useState({
    disclosureAgreements: [],
    evaluationAgreements: [],
    evaluationResults: [],
    declineRecords: [],
    // Phase 9A.4 Gate B: `transfers` holds provisional transfer records.
    //   Shape: [{ id, assetId, fromOwnerDid, fromParty, toOwnerDid, toParty, initiatedTimestamp, note }]
    //   On accept: removed from here, Asset is re-emitted with updated dot
    //     (ownerDid, lineage[]) into `assets`; the canvas adapter then
    //     renders the Asset on the recipient's canvas.
    //   On decline: removed from here, a declined transfer record is appended
    //     to the Asset's lineage via a re-emit; sender's Asset loses the
    //     TRANSFERRING badge. Sender's canvas retains the Asset.
    //   On cancel: removed from here, sender's Asset clears badge. No
    //     ledger record (cancelled transfers don't persist per §11.7).
    transfers: [],
  })
  // V2.2 modal state
  const [v22RequestOpen, setV22RequestOpen] = useState(false)
  const [v22RequestAnchor, setV22RequestAnchor] = useState(null) // Asset node passed when launched from per-Asset entry
  const [v22RespondingTo, setV22RespondingTo] = useState(null) // { daId }
  const [v22EvalContext, setV22EvalContext] = useState(null) // { evaluationAgreementId|null, claimId, selfEvaluation?, lockedRequirementsSetId?, priorActiveResultId? }
  const [v22AmendingClaimId, setV22AmendingClaimId] = useState(null) // claim id being amended
  const [v22AmendingDaId, setV22AmendingDaId] = useState(null) // disclosure agreement id being amended
  const [v22RecentlyAcceptedClaimId, setV22RecentlyAcceptedClaimId] = useState(null) // drives reveal
  const [v22RecentlyAcceptedAssetId, setV22RecentlyAcceptedAssetId] = useState(null) // drives Alice-side reveal on the pulled-in counterparty Asset
  const [v22PanToClaimId, setV22PanToClaimId] = useState(null) // drives pan-to-node on creation/accept
  // V2.2 Phase 7 — Directory Layer + AI Shopper (spec §8 / §9)
  const [v22DirectoryOpen, setV22DirectoryOpen] = useState(false)
  const [v22AIShopperOpen, setV22AIShopperOpen] = useState(false)
  // Pre-population carried from an AI Shopper candidate into the
  // CombinedRequestModal (Story 2 step 5 — spec §7.2).
  const [v22AIShopperResult, setV22AIShopperResult] = useState(null) // { claimPin, suggestedRequirementsSetId } | null
  // V2.2 parse flow (Phase 8): set by the Asset panel's Parse Evidence action.
  const [v22ParsingAsset, setV22ParsingAsset] = useState(null) // Asset node | null
  // V2.2 Phase 9A.3: creation flows.
  //   v22RegisteringAsset — opens V22CreateAssetModal. Object so callers can
  //     pass context (the Actor node that launched it) without conflating
  //     with the unilateral no-context case — both render the same modal.
  //   v22CreatingClaim    — opens V22CreateClaimModal. `initialAssetIds`
  //     pre-selects the Asset when launched from an Asset panel/card.
  const [v22RegisteringAsset, setV22RegisteringAsset] = useState(null) // null | { source: 'actor' }
  const [v22CreatingClaim, setV22CreatingClaim] = useState(null)       // null | { initialAssetIds: string[] }
  // Phase 9A.4 Gate B: Transferring process (spec §11.7).
  //   v22TransferringAsset — Asset node currently being transferred (modal open).
  //   v22Provisionals.transfers — provisional transfer artifacts (pending on sender's canvas).
  //     Shape: [{ id, assetId, fromOwnerDid, fromParty, toOwnerDid, toParty, initiatedTimestamp, note }]
  const [v22TransferringAsset, setV22TransferringAsset] = useState(null)

  const v22View = useMemo(
    () => getV22DataForRole(roleId, v22Provisionals),
    [roleId, v22Provisionals],
  )
  const v22Data = useMemo(
    () => (v22View ? buildV22Canvas(v22View) : null),
    [v22View],
  )

  // Mark the recently-accepted claim node and (Phase 6.5 #4) the recently
  // pulled-in counterparty Asset with `_isNew` so V2Canvas / AssetNode's
  // existing reveal-animation path fires on both Bob's and Alice's canvases.
  // V2.2 edge interactions — selectedEdgeId drives the highlight state in V2Canvas;
  // edgeMenu drives the contextual menu; openAgreement drives the side Detail Panel.
  // Per spec §4.4, edge selection clears when a node is selected OR the panel closes.
  // Declared before `v22DataWithReveal` so that memo can read `selectedEdgeId`
  // without hitting a TDZ (Phase 9A item 5 wires edge endpoints into the memo).
  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const [edgeMenu, setEdgeMenu] = useState(null) // { edgeId, anchor }
  const [openAgreement, setOpenAgreement] = useState(null) // { kind: 'disclosure'|'evaluation', edgeId }

  const v22DataWithReveal = useMemo(() => {
    if (!v22Data) return v22Data
    const flagged = new Set([v22RecentlyAcceptedClaimId, v22RecentlyAcceptedAssetId].filter(Boolean))
    // Phase 9A item 5: compute the endpoint set for the currently-selected
    // edge so AssetNode can render a glow on the two connected nodes.
    // Phase 9A.1.5 item 4: also compute which side of each endpoint card
    // faces the OTHER endpoint, so AssetNode can render the endpoint line
    // on the inside edge (facing the partner) rather than always on the
    // right. Compare card-centre x-coordinates: the endpoint whose centre
    // is LEFT of its partner's centre shows the line on its RIGHT edge
    // (facing right toward the partner); the other shows on its LEFT.
    const endpointSet = new Set()
    const endpointSideById = {}
    if (selectedEdgeId) {
      const edge = v22Data.edges.find(e => e.id === selectedEdgeId)
      if (edge) {
        endpointSet.add(edge.from)
        endpointSet.add(edge.to)
        const fromNode = v22Data.nodeMap?.[edge.from]
        const toNode = v22Data.nodeMap?.[edge.to]
        if (fromNode && toNode && fromNode.x != null && toNode.x != null) {
          // node.x is the card top-left; the centre is x + CARD_W/2. Since
          // both cards have the same width, comparing raw x is equivalent.
          if (fromNode.x < toNode.x) {
            endpointSideById[edge.from] = 'right'
            endpointSideById[edge.to] = 'left'
          } else if (fromNode.x > toNode.x) {
            endpointSideById[edge.from] = 'left'
            endpointSideById[edge.to] = 'right'
          } else {
            // Equal x (stacked vertically) — keep both on the right as a
            // stable fallback; the line is still a useful indicator.
            endpointSideById[edge.from] = 'right'
            endpointSideById[edge.to] = 'right'
          }
        }
      }
    }
    // Phase 9A item 9: decorate Claim nodes with the evaluation agreement
    // where the current actor is grantee. V22ActionBar reads this to decide
    // whether to show "Run Evaluation" on non-owner Claim cards.
    const eaByClaimForActor = {}
    if (v22View) {
      for (const ea of (v22View.evaluationAgreements || [])) {
        if (ea.grantee?.party === activeRole.party && ea.claimId) {
          eaByClaimForActor[ea.claimId] = ea
        }
      }
    }
    const anyDecoration = flagged.size > 0 || endpointSet.size > 0 || Object.keys(eaByClaimForActor).length > 0
    if (!anyDecoration) return v22Data
    const nodes = v22Data.nodes.map(n => {
      const needsReveal = flagged.has(n.id)
      const isEndpoint = endpointSet.has(n.id)
      const eaForClaim = n.v22Type === 'CLAIM' ? eaByClaimForActor[n.id] : null
      if (!needsReveal && !isEndpoint && !eaForClaim) return n
      return {
        ...n,
        ...(needsReveal ? { _isNew: true } : {}),
        ...(isEndpoint ? {
          _isEdgeEndpoint: true,
          _edgeEndpointSide: endpointSideById[n.id] || 'right',
        } : {}),
        ...(eaForClaim ? { _evaluationAgreementForActor: eaForClaim } : {}),
      }
    })
    const nodeMap = {}
    for (const n of nodes) nodeMap[n.id] = n
    return { ...v22Data, nodes, nodeMap }
  }, [v22Data, v22RecentlyAcceptedClaimId, v22RecentlyAcceptedAssetId, selectedEdgeId, v22View, activeRole.party])

  // V2.2 Phase 4–5 handlers + pan-to-node effect are declared *below*
  // updateRoleState (further down in this component) because they depend on
  // it via useCallback deps. Initial Phase 5 placement here triggered a TDZ
  // error; relocating fixed it. See the V2.2 handlers block after updateRoleState.

  // Mutual exclusion between node selection and edge selection (spec §4.4) is
  // enforced inside the click handlers themselves — not via a reactive effect —
  // because an effect that watches both keys races with the user's next click
  // (clicking a new edge while a node is still selected would otherwise fire
  // the effect and wipe the edge state immediately). See the onEdgeClick and
  // handleSelect handlers for the explicit clears.
  const roleData = useMemo(
    () => ({
      nodes: (v22DataWithReveal || v22Data).nodes,
      edges: (v22DataWithReveal || v22Data).edges,
      nodeMap: (v22DataWithReveal || v22Data).nodeMap,
      pendingRequests: [],
      existingCascades: [],
    }),
    [v22Data, v22DataWithReveal],
  )
  // Per-role dynamic state — persists across role switches
  const emptyRoleState = { addedNodes: [], addedSDAs: {}, addedEdges: [], dismissedReqs: [], addedChildren: {}, addedRequests: [], removedSDAs: [], removedNodes: [], removedEdges: [], newlyDisclosedIds: [], requirementSets: null, pepTemplates: null }
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

  // ── V2.2 Phase 4–5 handlers ───────────────────────────────────────────
  // Declared here (after updateRoleState) so the useCallback deps array can
  // safely reference it. Initial Phase 5 placement before updateRoleState
  // triggered a temporal-dead-zone ReferenceError at component init.

  // Helper: enqueue a notification on the requester's perRoleState inbox so the
  // V2.1 notification UI surfaces accept/decline events natively.
  const enqueueV22NotificationForRequester = useCallback((requesterRoleId, notif) => {
    updateRoleState(requesterRoleId, (prev) => ({
      ...prev,
      addedRequests: [...(prev.addedRequests || []), notif],
    }))
  }, [updateRoleState])

  const handleV22RequestSubmit = useCallback((payload) => {
    const { claim, ownerParty, selectedRequirementsSetIds, message } = payload
    const anchorNode = v22RequestAnchor
      || v22Data?.nodes.find((n) => n.v22Type === 'ASSET' && n.owner === activeRole.party)
    if (!anchorNode) return
    const pair = makeProvisionalAgreementPair({
      requesterParty: activeRole.party,
      requesterDot: activeRole.partyDot,
      requesterAssetId: anchorNode.id,
      ownerParty,
      claimId: claim.id,
      requestedRequirementsSetIds: selectedRequirementsSetIds,
      message,
    })
    pair.disclosureAgreement._requestMeta = {
      ...(pair.disclosureAgreement._requestMeta || {}),
      requesterParty: activeRole.party,
      requesterAssetName: anchorNode.name,
      createdDate: pair.disclosureAgreement.terms?.createdDate,
    }
    setV22Provisionals((prev) => ({
      ...prev,
      disclosureAgreements: [...prev.disclosureAgreements, pair.disclosureAgreement],
      evaluationAgreements: [...prev.evaluationAgreements, pair.evaluationAgreement],
    }))
    setV22RequestOpen(false)
    setV22RequestAnchor(null)
    // Select the new provisional Claim so V2Canvas's selection-pan targets it
    // (was panning to the anchor Asset because selection remained on the
    // anchor after submission). This also opens the "Awaiting Response" panel
    // for the requester, giving them immediate context.
    setSel(claim.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(claim.id)
    setV22RecentlyAcceptedClaimId(claim.id)
    // Phase 7 carry-over #1: _isNew persists until the user deselects (see
    // the v22-reveal-clear effect near the V2.1 sibling, below). No timeout.
    // Phase 6 carry-over #6: enqueue a 'v22-request' notification on the
    // grantor's inbox so they can open the response modal from notifications
    // (provisional edges no longer render on the grantor's canvas — see #5).
    const grantorRole = ROLES.find((r) => r.party === ownerParty)
    if (grantorRole) {
      enqueueV22NotificationForRequester(grantorRole.id, {
        id: `v22-request-${pair.disclosureAgreement.id}`,
        type: 'v22-request',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: claim.name, pin: claim.pin },
        connectTo: { id: anchorNode.id, pin: anchorNode.pin || null },
        v22DaId: pair.disclosureAgreement.id,
        message: message || '',
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [activeRole.party, activeRole.partyDot, v22Data, v22RequestAnchor, enqueueV22NotificationForRequester])

  const handleV22Accept = useCallback(({ type, scope, eaTerms }) => {
    if (!v22RespondingTo) return
    const daId = v22RespondingTo.daId
    let claimIdForReveal = null
    let requesterPartyForNotif = null
    let claimNameForNotif = null
    let claimPinForNotif = null
    let anchorIdForNotif = null

    setV22Provisionals((prev) => {
      const provisionalDa = prev.disclosureAgreements.find((d) => d.id === daId)
      if (!provisionalDa) return prev
      const provisionalEa = prev.evaluationAgreements.find((e) => e.disclosureAgreementId === daId)
      if (!provisionalEa) return prev
      const finalized = finalizeProvisionalAgreementPair({
        provisionalDa, provisionalEa,
        type, scope, eaTerms,
      })
      finalized.disclosureAgreement._requestMeta = provisionalDa._requestMeta
      claimIdForReveal = provisionalDa.subject.id
      requesterPartyForNotif = provisionalDa.grantee.party
      anchorIdForNotif = provisionalDa.granteeAssetId
      const sharedClaim = buildV22SharedArtifacts().claims.find((c) => c.id === provisionalDa.subject.id)
      if (sharedClaim) {
        claimNameForNotif = sharedClaim.name
        claimPinForNotif = sharedClaim.pin
      }
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.map((d) => d.id === daId ? finalized.disclosureAgreement : d),
        evaluationAgreements: prev.evaluationAgreements.map((e) => e.id === provisionalEa.id ? finalized.evaluationAgreement : e),
      }
    })
    setV22RespondingTo(null)
    if (claimIdForReveal) {
      setV22RecentlyAcceptedClaimId(claimIdForReveal)
      // Phase 7 carry-over #1: no timeout; clears on deselection.
    }
    // Phase 6.5 #4: also reveal the newly pulled-in counterparty Asset on
    // Alice's (the grantor's) canvas. anchorIdForNotif is the granteeAssetId,
    // which is exactly the Asset that just got pulled in via §6.1.
    if (anchorIdForNotif) {
      setV22RecentlyAcceptedAssetId(anchorIdForNotif)
      setSel(anchorIdForNotif)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(anchorIdForNotif)
    }
    // Phase 6 carry-over #6: dismiss the original v22-request notification on
    // the grantor's inbox now that the request has been resolved.
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-request-${daId}`],
    }))
    if (requesterPartyForNotif && claimPinForNotif) {
      const requesterRole = ROLES.find((r) => r.party === requesterPartyForNotif)
      if (requesterRole) {
        enqueueV22NotificationForRequester(requesterRole.id, {
          id: `v22-accept-${daId}-${Date.now().toString(36)}`,
          type: 'acceptance',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: { id: anchorIdForNotif, pin: null },
          disclosureType: type,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22RespondingTo, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

  const handleV22Decline = useCallback(({ reason } = {}) => {
    if (!v22RespondingTo) return
    const daId = v22RespondingTo.daId
    let claimNameForNotif = null
    let claimPinForNotif = null
    let requesterPartyForNotif = null
    let anchorIdForNotif = null

    setV22Provisionals((prev) => {
      const provisionalDa = prev.disclosureAgreements.find((d) => d.id === daId)
      if (!provisionalDa) return prev
      const provisionalEa = prev.evaluationAgreements.find((e) => e.disclosureAgreementId === daId)
      const declineRecord = makeDeclineRecord({ provisionalDa, reason })
      requesterPartyForNotif = provisionalDa.grantee.party
      anchorIdForNotif = provisionalDa.granteeAssetId
      const sharedClaim = buildV22SharedArtifacts().claims.find((c) => c.id === provisionalDa.subject.id)
      if (sharedClaim) {
        claimNameForNotif = sharedClaim.name
        claimPinForNotif = sharedClaim.pin
      }
      // Phase 6.5 #3: keep the provisional DA + EA in state (annotated as
      // declined) so Bob's canvas continues to render the edge to his anchor
      // Asset until he dismisses. Spec §11.4 calls for the artifacts to be
      // "deleted"; in V2.2 we keep them as a UI-layer affordance and collapse
      // them on dismiss. The decline reason rides along on the DA via
      // `_declineMeta` so the V22ClaimPanel can surface it.
      const annotatedDa = {
        ...provisionalDa,
        _declineMeta: { reason: (reason || '').trim(), declinedDate: declineRecord.declinedDate },
      }
      const annotatedEa = provisionalEa
        ? { ...provisionalEa, _declined: true }
        : null
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.map((d) => d.id === daId ? annotatedDa : d),
        evaluationAgreements: provisionalEa
          ? prev.evaluationAgreements.map((e) => e.id === provisionalEa.id ? annotatedEa : e)
          : prev.evaluationAgreements,
        declineRecords: [...prev.declineRecords, declineRecord],
      }
    })
    setV22RespondingTo(null)
    setSelectedEdgeId(null)
    setOpenAgreement(null)
    // Dismiss the v22-request notification on the grantor's inbox.
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-request-${daId}`],
    }))
    if (requesterPartyForNotif && claimPinForNotif) {
      const requesterRole = ROLES.find((r) => r.party === requesterPartyForNotif)
      if (requesterRole) {
        enqueueV22NotificationForRequester(requesterRole.id, {
          id: `v22-decline-${daId}-${Date.now().toString(36)}`,
          type: 'decline',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: { id: anchorIdForNotif, pin: null },
          reason: (reason || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22RespondingTo, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

  const handleV22CancelRequest = useCallback((claimId) => {
    setV22Provisionals((prev) => {
      const provisionalDa = prev.disclosureAgreements.find(
        (d) => d.subject.id === claimId && d.type === 'provisional' && d.grantee.party === activeRole.party,
      )
      if (!provisionalDa) return prev
      const provisionalEa = prev.evaluationAgreements.find((e) => e.disclosureAgreementId === provisionalDa.id)
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.filter((d) => d.id !== provisionalDa.id),
        evaluationAgreements: provisionalEa
          ? prev.evaluationAgreements.filter((e) => e.id !== provisionalEa.id)
          : prev.evaluationAgreements,
      }
    })
    setSel(null)
  }, [activeRole.party])

  const handleV22DismissDeclined = useCallback((claimId) => {
    setV22Provisionals((prev) => {
      // Find the declined DA(s) for this claim/actor and drop them along with
      // their paired EA(s) so the synthetic edge disappears on dismissal.
      const matchingDas = prev.disclosureAgreements.filter(
        (d) => d.subject?.id === claimId && d._declineMeta && d.grantee.party === activeRole.party,
      )
      const matchingDaIds = new Set(matchingDas.map((d) => d.id))
      const matchingEaIds = new Set(
        prev.evaluationAgreements
          .filter((e) => matchingDaIds.has(e.disclosureAgreementId))
          .map((e) => e.id),
      )
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.filter((d) => !matchingDaIds.has(d.id)),
        evaluationAgreements: prev.evaluationAgreements.filter((e) => !matchingEaIds.has(e.id)),
        declineRecords: prev.declineRecords.filter(
          (r) => !(r.claimId === claimId && r.requesterParty === activeRole.party),
        ),
      }
    })
    setSel(null)
  }, [activeRole.party])

  const handleV22OpenRunEvaluation = useCallback((evaluationAgreement) => {
    if (!evaluationAgreement) return
    setV22EvalContext({
      evaluationAgreementId: evaluationAgreement.id,
      claimId: evaluationAgreement.claimId,
    })
    setOpenAgreement(null)
    setEdgeMenu(null)
    setSelectedEdgeId(null)
  }, [])

  const handleV22EvaluationSubmit = useCallback(({ requirementsSet, rows, evidenceUsed }) => {
    if (!v22EvalContext) return
    const { evaluationAgreementId, claimId, selfEvaluation } = v22EvalContext
    const claim = v22View?.claims.find((c) => c.id === claimId)
    let ea
    if (selfEvaluation) {
      // Phase 6.D: synthesise a lightweight EA-like object so the artifact
      // factory has a stable id to thread through. The proof DA + ownership DA
      // it produces are both internal (Alice → Alice).
      const firstAsset = claim?.referencedAssetIds?.[0] || null
      ea = {
        id: `self-eval-${claimId}`,
        grantor: { party: activeRole.party, dot: activeRole.partyDot },
        grantee: { party: activeRole.party, dot: activeRole.partyDot },
        claimId,
        granteeAssetId: firstAsset,
      }
    } else {
      ea = v22View?.evaluationAgreements.find((e) => e.id === evaluationAgreementId)
      if (!ea) return
    }
    const prior = findPriorActiveEvaluationResult({
      claimId, requirementsSetId: requirementsSet.id,
      shared: buildV22SharedArtifacts(), provisionals: v22Provisionals,
    })
    const artifacts = makeEvaluationRunArtifacts({
      evaluatorParty: ea.grantee.party,
      evaluatorDot: activeRole.partyDot,
      claimOwnerParty: ea.grantor.party,
      evaluationAgreement: ea,
      granteeAssetId: ea.granteeAssetId,
      requirementsSet,
      rows,
      evidenceUsed,
      priorActiveResult: prior,
    })
    setV22Provisionals((prev) => {
      const newEvalResults = [...prev.evaluationResults, artifacts.evaluationResult]
      if (artifacts.supersededPriorResult) {
        const idx = newEvalResults.findIndex((e) => e.id === artifacts.supersededPriorResult.id)
        if (idx >= 0) newEvalResults[idx] = artifacts.supersededPriorResult
        else newEvalResults.push(artifacts.supersededPriorResult)
      }
      return {
        ...prev,
        disclosureAgreements: [
          ...prev.disclosureAgreements,
          artifacts.proofDisclosureAgreement,
          artifacts.ownershipDisclosureAgreement,
        ],
        evaluationResults: newEvalResults,
      }
    })
    setV22EvalContext(null)
    // Phase 6.5+ #5: explicitly select the new Eval Result BEFORE setting the
    // pan target. Otherwise V2Canvas's selection-pan effect (which observes
    // `sel`) keeps holding the pre-modal Claim selection and re-pans to the
    // Claim after the external pan completes. Also drop the pre-modal sel
    // (could be the Claim) so we don't fight V2Canvas's selection-pan during
    // the externalPanRef lockout window.
    setSel(artifacts.evaluationResult.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(artifacts.evaluationResult.id)
    setV22RecentlyAcceptedClaimId(artifacts.evaluationResult.id)
    // Phase 7 carry-over #1: no timeout; clears on deselection.
    // Phase 6.5 #6: notify the Claim owner that an evaluation completed
    // (skip self-eval, where evaluator === claim owner).
    if (!selfEvaluation) {
      const claimOwnerRole = ROLES.find((r) => r.party === ea.grantor.party)
      const sharedClaim = buildV22SharedArtifacts().claims.find((c) => c.id === claimId)
      if (claimOwnerRole && sharedClaim) {
        enqueueV22NotificationForRequester(claimOwnerRole.id, {
          id: `v22-evaluation-${artifacts.evaluationResult.id}`,
          type: 'v22-evaluation',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: sharedClaim.name, pin: sharedClaim.pin },
          v22EvalResultId: artifacts.evaluationResult.id,
          supersedesPriorResultId: artifacts.supersededPriorResult?.id || null,
          requirementsSetName: requirementsSet.name,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22EvalContext, v22View, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // ── Phase 6: Amendment handlers ──────────────────────────────────────

  const handleV22AmendClaimSubmit = useCallback(({ addedAssetIds }) => {
    if (!v22AmendingClaimId) return
    setV22Provisionals((prev) => {
      // Look up the latest version of the claim (could be a prior amendment).
      const existing = prev.claims?.find((c) => c.id === v22AmendingClaimId)
        || buildV22SharedArtifacts().claims.find((c) => c.id === v22AmendingClaimId)
      if (!existing) return prev
      const { claim: amended, newClaimRefEdges } = makeAmendedClaim({
        claim: existing,
        addedAssetIds,
      })
      return {
        ...prev,
        claims: [...(prev.claims || []).filter((c) => c.id !== amended.id), amended],
        disclosureAgreements: [...prev.disclosureAgreements, ...newClaimRefEdges],
      }
    })
    setV22AmendingClaimId(null)
    // Phase 6.5+ #5: select + pan to the amended Claim before triggering the
    // pan effect, so V2Canvas's selection-pan settles on the correct target
    // and doesn't fight the external pan.
    setSel(v22AmendingClaimId)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(v22AmendingClaimId)
    setV22RecentlyAcceptedClaimId(v22AmendingClaimId)
    // Phase 7 carry-over #1: no timeout; clears on deselection.
  }, [v22AmendingClaimId])

  // Phase 8: V2.2 parse flow — the Asset panel fires this via setV22ParsingAsset.
  // Produces a new Parse Result + an internal Full DA that wires it back to the
  // source Asset (same shape as the seeded `parseResultRefEdges` so edge
  // derivation treats it identically). Both artifacts land on v22Provisionals
  // and the Parse Result node gets a pan + `_isNew` reveal on the next render.
  const handleV22ParseSubmit = useCallback(({ template, rows }) => {
    const asset = v22ParsingAsset
    if (!asset) return
    const artifacts = makeParseRunArtifacts({
      ownerParty: activeRole.party,
      ownerDot: activeRole.partyDot,
      sourceAssetId: asset.id,
      template,
      rows,
    })
    setV22Provisionals((prev) => ({
      ...prev,
      parseResults: [...(prev.parseResults || []), artifacts.parseResult],
      disclosureAgreements: [...prev.disclosureAgreements, artifacts.refDisclosureAgreement],
    }))
    setV22ParsingAsset(null)
    setSel(artifacts.parseResult.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(artifacts.parseResult.id)
    setV22RecentlyAcceptedClaimId(artifacts.parseResult.id)
    // Phase 7 carry-over #1: no timeout; clears on deselection.
  }, [v22ParsingAsset, activeRole.party, activeRole.partyDot])

  // Phase 9A.3: V2.2 Asset registration. Produces a new Asset + ownership DA
  // (makeAssetRegistrationArtifacts) and merges both into v22Provisionals.
  // Unilateral — no counterparty acceptance. The new Asset gets `_isNew` +
  // pan-to via the standard reveal pipeline. Returns the new Asset id so
  // nested callers (Create Claim's inline Register-new-Asset CTA) can
  // auto-select the fresh row.
  const handleV22CreateAssetSubmit = useCallback(({ file, displayName, _nested = false } = {}) => {
    if (!file) return null
    const artifacts = makeAssetRegistrationArtifacts({
      ownerParty: activeRole.party,
      ownerDot: activeRole.partyDot,
      file,
      name: displayName,
    })
    setV22Provisionals((prev) => ({
      ...prev,
      assets: [...(prev.assets || []), artifacts.asset],
      disclosureAgreements: [...prev.disclosureAgreements, artifacts.ownershipDa],
    }))
    setV22RegisteringAsset(null)
    // Suppress pan when nested inside Create Claim — user is still in a modal.
    if (!_nested) {
      setSel(artifacts.asset.id)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(artifacts.asset.id)
      setV22RecentlyAcceptedAssetId(artifacts.asset.id)
    }
    return artifacts.asset.id
  }, [activeRole.party, activeRole.partyDot])

  // Phase 9A.3: V2.2 Claim creation. Produces a new Claim + Actor→Claim
  // ownership DA + one Claim→Asset internal DA per reference. Unilateral.
  // NEW badge + pan-to via the shared `_isNew` reveal path.
  const handleV22CreateClaimSubmit = useCallback(({ name, description, referencedAssetIds }) => {
    if (!name || !name.trim() || !Array.isArray(referencedAssetIds) || referencedAssetIds.length === 0) {
      return null
    }
    const artifacts = makeClaimCreationArtifacts({
      ownerParty: activeRole.party,
      ownerDot: activeRole.partyDot,
      name,
      description,
      referencedAssetIds,
    })
    setV22Provisionals((prev) => ({
      ...prev,
      claims: [...(prev.claims || []), artifacts.claim],
      disclosureAgreements: [
        ...prev.disclosureAgreements,
        artifacts.ownershipDa,
        ...artifacts.claimRefDas,
      ],
    }))
    setV22CreatingClaim(null)
    setSel(artifacts.claim.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(artifacts.claim.id)
    setV22RecentlyAcceptedClaimId(artifacts.claim.id)
    return artifacts.claim.id
  }, [activeRole.party, activeRole.partyDot])

  // Nested Register-new-Asset handler — fires from inside V22CreateClaimModal
  // or AmendClaimModal (Gate B). The shared handleV22CreateAssetSubmit does
  // the real work; the `_nested` flag suppresses pan-to because the parent
  // modal is still open. Returns the new Asset id so the parent modal can
  // auto-select the fresh row in its picker.
  const handleV22NestedAssetCreated = useCallback((payload) => {
    return handleV22CreateAssetSubmit({ ...payload, _nested: true })
  }, [handleV22CreateAssetSubmit])

  // ── Phase 9A.4 Gate B: Transferring handlers ────────────────────────
  //
  // Submit creates a provisional transfer record on `v22Provisionals.transfers`.
  // The view builder + adapter stamp `_pendingTransfer` on the sender's Asset
  // so it renders with the TRANSFERRING badge until the recipient accepts/
  // declines (Gate C) or the sender cancels (here).
  //
  // Notifications fire cross-role via `enqueueV22NotificationForRequester`
  // so the recipient sees a `v22-transfer-request` item in their inbox.
  const handleV22TransferSubmit = useCallback(({ recipientActor, note }) => {
    const asset = v22TransferringAsset
    if (!asset || !recipientActor) return
    const initiatedTimestamp = new Date().toISOString()
    const transferId = `transfer-${asset.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
    // We store party names alongside DIDs so the adapter can render
    // "Awaiting acceptance from Bob" without resolving DID → party on every
    // render. DIDs drive the ledger-level append to `dot.lineage[]` on accept.
    const fromOwnerDid = asset.dot?.ownerDid || asset.ownerDot
    const toOwnerDid = recipientActor.partyDot || makeDot(recipientActor.party)
    const transferRecord = {
      id: transferId,
      assetId: asset.id,
      assetName: asset.name,
      fromOwnerDid,
      fromParty: activeRole.party,
      toOwnerDid,
      toParty: recipientActor.party,
      toUser: recipientActor.user || recipientActor.party,
      initiatedTimestamp,
      note: (note || '').trim(),
    }
    setV22Provisionals((prev) => ({
      ...prev,
      transfers: [...(prev.transfers || []), transferRecord],
    }))
    setV22TransferringAsset(null)
    // Enqueue a v22-transfer-request notification on the recipient's inbox.
    const recipientRole = ROLES.find((r) => r.party === recipientActor.party)
    if (recipientRole) {
      enqueueV22NotificationForRequester(recipientRole.id, {
        id: `v22-transfer-request-${transferId}`,
        type: 'v22-transfer-request',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: asset.name, pin: asset.pin },
        connectTo: null,
        transferId,
        assetId: asset.id,
        note: (note || '').trim(),
        date: initiatedTimestamp.slice(0, 10),
      })
    }
    // Select the sender's Asset so the TRANSFERRING badge is visible on pan.
    setSel(asset.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(asset.id)
  }, [v22TransferringAsset, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // ── Phase 9A.4 Gate C: accept / decline handlers ────────────────────
  //
  // Accept: re-emit the Asset with updated DOT (ownerDid flipped to
  // recipient + accepted transfer record appended to dot.lineage[]) and
  // clear the provisional transfer record. The view builder will now
  // surface the Asset on the recipient's canvas; the sender's view
  // removes it automatically (filter by owner === party).
  //
  // Decline: re-emit the Asset with a declined transfer record appended
  // to dot.lineage[] (ownership stays) and clear the provisional. Sender
  // receives a v22-transfer-declined notification with the reason.
  const handleV22TransferAccept = useCallback((notif) => {
    if (!notif || !notif.transferId || !notif.assetId) return
    // Phase 9A.4 Gate C: resolve the transfer + asset SYNCHRONOUSLY from the
    // current render's v22Provisionals, not from inside the setState updater.
    // The updater runs during the next render — by the time the downstream
    // `if (!transfer) return` runs it's still null, and the whole flow
    // (notification dismiss, sender notification, pan) would short-circuit.
    const transfer = (v22Provisionals.transfers || []).find((t) => t.id === notif.transferId)
    if (!transfer) return
    const seededAssets = buildV22SharedArtifacts().assets
    const assetForTransfer = (v22Provisionals.assets || []).find((a) => a.id === transfer.assetId)
      || seededAssets.find((a) => a.id === transfer.assetId)
    if (!assetForTransfer) return
    const acceptedTimestamp = new Date().toISOString()
    const transferRecord = makeTransferRecord({
      fromOwnerDid: transfer.fromOwnerDid,
      toOwnerDid: transfer.toOwnerDid,
      initiatedTimestamp: transfer.initiatedTimestamp,
      acceptedTimestamp,
      status: 'accepted',
      declineReason: null,
    })
    // Re-emit the Asset with updated DOT. `makeAsset` accepts an explicit
    // `dot` override so we carry the appended lineage forward.
    const newDot = makeDotObject({
      pin: assetForTransfer.dot?.pin || assetForTransfer.pin,
      hash: assetForTransfer.dot?.hash ?? (assetForTransfer.file?.hash ?? null),
      ownerDid: transfer.toOwnerDid,
      registrationTimestamp: assetForTransfer.dot?.registrationTimestamp || assetForTransfer.registrationDate,
      metadata: assetForTransfer.dot?.metadata || { fileUri: assetForTransfer.file?.uri, filename: assetForTransfer.file?.filename },
      lineage: [...(assetForTransfer.dot?.lineage || []), transferRecord],
    })
    const transferredAsset = makeAsset({
      id: assetForTransfer.id,
      owner: transfer.toParty,
      ownerDot: transfer.toOwnerDid,
      name: assetForTransfer.name,
      description: assetForTransfer.description,
      file: assetForTransfer.file,
      registrationDate: assetForTransfer.registrationDate,
      parseResultIds: assetForTransfer.parseResultIds || [],
      dot: newDot,
    })
    setV22Provisionals((prev) => ({
      ...prev,
      transfers: (prev.transfers || []).filter((t) => t.id !== notif.transferId),
      assets: [
        ...((prev.assets || []).filter((a) => a.id !== assetForTransfer.id)),
        transferredAsset,
      ],
    }))
    // Dismiss the v22-transfer-request on the recipient's inbox.
    updateRoleState(roleId, (prevState) => ({
      ...prevState,
      dismissedReqs: [...(prevState.dismissedReqs || []), notif.id],
    }))
    // Reveal the Asset on the recipient's canvas (standard NEW badge path).
    setV22RecentlyAcceptedAssetId(assetForTransfer.id)
    setSel(assetForTransfer.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(assetForTransfer.id)
    // Fire v22-transfer-accepted notification to the sender.
    const senderRole = ROLES.find((r) => r.party === transfer.fromParty)
    if (senderRole) {
      enqueueV22NotificationForRequester(senderRole.id, {
        id: `v22-transfer-accepted-${transfer.id}`,
        type: 'v22-transfer-accepted',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: transfer.assetName, pin: assetForTransfer.pin },
        connectTo: null,
        transferId: transfer.id,
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [v22Provisionals, activeRole.party, activeRole.partyDot, roleId, updateRoleState, enqueueV22NotificationForRequester])

  const handleV22TransferDecline = useCallback((notif, reason) => {
    if (!notif || !notif.transferId || !notif.assetId) return
    // Resolve synchronously from current render state (same fix as the
    // accept path above).
    const transfer = (v22Provisionals.transfers || []).find((t) => t.id === notif.transferId)
    if (!transfer) return
    const seededAssets = buildV22SharedArtifacts().assets
    const assetForTransfer = (v22Provisionals.assets || []).find((a) => a.id === transfer.assetId)
      || seededAssets.find((a) => a.id === transfer.assetId)
    if (!assetForTransfer) return
    const declinedRecord = makeTransferRecord({
      fromOwnerDid: transfer.fromOwnerDid,
      toOwnerDid: transfer.toOwnerDid,
      initiatedTimestamp: transfer.initiatedTimestamp,
      acceptedTimestamp: null,
      status: 'declined',
      declineReason: (reason || '').trim() || null,
    })
    const newDot = makeDotObject({
      pin: assetForTransfer.dot?.pin || assetForTransfer.pin,
      hash: assetForTransfer.dot?.hash ?? (assetForTransfer.file?.hash ?? null),
      ownerDid: assetForTransfer.dot?.ownerDid || assetForTransfer.ownerDot,
      registrationTimestamp: assetForTransfer.dot?.registrationTimestamp || assetForTransfer.registrationDate,
      metadata: assetForTransfer.dot?.metadata || {},
      lineage: [...(assetForTransfer.dot?.lineage || []), declinedRecord],
    })
    const declinedAsset = makeAsset({
      id: assetForTransfer.id,
      owner: assetForTransfer.owner,
      ownerDot: assetForTransfer.ownerDot,
      name: assetForTransfer.name,
      description: assetForTransfer.description,
      file: assetForTransfer.file,
      registrationDate: assetForTransfer.registrationDate,
      parseResultIds: assetForTransfer.parseResultIds || [],
      dot: newDot,
    })
    setV22Provisionals((prev) => ({
      ...prev,
      transfers: (prev.transfers || []).filter((t) => t.id !== transfer.id),
      assets: [
        ...((prev.assets || []).filter((a) => a.id !== assetForTransfer.id)),
        declinedAsset,
      ],
    }))
    // Dismiss the v22-transfer-request on the recipient's inbox.
    updateRoleState(roleId, (prevState) => ({
      ...prevState,
      dismissedReqs: [...(prevState.dismissedReqs || []), notif.id],
    }))
    // Fire v22-transfer-declined notification to the sender with the reason.
    const senderRole = ROLES.find((r) => r.party === transfer.fromParty)
    if (senderRole) {
      enqueueV22NotificationForRequester(senderRole.id, {
        id: `v22-transfer-declined-${transfer.id}`,
        type: 'v22-transfer-declined',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: transfer.assetName, pin: null },
        connectTo: null,
        transferId: transfer.id,
        declineReason: (reason || '').trim() || null,
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [v22Provisionals, activeRole.party, activeRole.partyDot, roleId, updateRoleState, enqueueV22NotificationForRequester])

  const handleV22CancelTransfer = useCallback((assetId) => {
    let cancelledTransfer = null
    setV22Provisionals((prev) => {
      const remaining = (prev.transfers || []).filter((t) => {
        if (t.assetId === assetId && t.fromParty === activeRole.party) {
          cancelledTransfer = t
          return false
        }
        return true
      })
      return { ...prev, transfers: remaining }
    })
    if (!cancelledTransfer) return
    // Dismiss the pending v22-transfer-request on the recipient's inbox and
    // fire a v22-transfer-cancelled notice. Spec §11.7: cancelled transfers
    // leave no ledger record (the `lineage[]` only records accepted / declined).
    const recipientRole = ROLES.find((r) => r.party === cancelledTransfer.toParty)
    if (recipientRole) {
      updateRoleState(recipientRole.id, (prevState) => ({
        ...prevState,
        dismissedReqs: [...(prevState.dismissedReqs || []), `v22-transfer-request-${cancelledTransfer.id}`],
        addedRequests: [...(prevState.addedRequests || []), {
          id: `v22-transfer-cancelled-${cancelledTransfer.id}`,
          type: 'v22-transfer-cancelled',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: cancelledTransfer.assetName, pin: null },
          connectTo: null,
          transferId: cancelledTransfer.id,
          date: new Date().toISOString().slice(0, 10),
        }],
      }))
    }
  }, [activeRole.party, activeRole.partyDot, updateRoleState])

  const handleV22AmendDisclosureSubmit = useCallback(({ scope, note }) => {
    if (!v22AmendingDaId) return
    // Phase 7 carry-over #2: compute notification targets BEFORE the
    // setV22Provisionals updater runs. Previous implementation captured
    // counterpartyParty / claimPinForNotif inside the updater's closure
    // via mutable outer `let` vars, which is unreliable: React may defer
    // the updater to the next render phase, so the downstream
    // `if (counterpartyParty && ...)` branch saw nulls and the enqueue
    // never fired. Read from the current render's `v22Provisionals` snapshot
    // and fall back to the shared seeded data.
    const seededDa = buildV22SharedArtifacts().disclosureAgreements.find((d) => d.id === v22AmendingDaId)
    const existing = v22Provisionals.disclosureAgreements.find((d) => d.id === v22AmendingDaId) || seededDa
    if (!existing) return
    const counterpartyParty = existing.grantee.party
    const claimIdForPan = existing.subject.id
    const sharedClaim = buildV22SharedArtifacts().claims.find((c) => c.id === existing.subject.id)
    const claimNameForNotif = sharedClaim?.name || null
    const claimPinForNotif = sharedClaim?.pin || null
    const amended = makeAmendedDisclosureAgreement({ disclosureAgreement: existing, scope, note })

    setV22Provisionals((prev) => ({
      ...prev,
      disclosureAgreements: [
        ...prev.disclosureAgreements.filter((d) => d.id !== amended.id),
        amended,
      ],
    }))
    setV22AmendingDaId(null)
    setOpenAgreement(null)
    setSelectedEdgeId(null)
    if (claimIdForPan) {
      // Phase 6.5 #12: pan + reveal the amended Claim with the existing
      // _isNew infrastructure (badge reads "NEW" briefly — works as the
      // "AMENDED" cue in the absence of a dedicated badge style).
      setSel(claimIdForPan)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(claimIdForPan)
      setV22RecentlyAcceptedClaimId(claimIdForPan)
      // Phase 7 carry-over #1: no timeout; clears on deselection.
    }
    // Phase 6 own scope: cross-role amendment notification — counterparty
    // (grantee) is told the DA's scope changed, with a deep-link to the Claim.
    // Phase 7 carry-over #2: also skip when grantee == active role (internal
    // DA would otherwise notify the amender of their own amendment).
    if (
      counterpartyParty &&
      counterpartyParty !== 'Radiant Network' &&
      counterpartyParty !== activeRole.party &&
      claimPinForNotif
    ) {
      const counterpartyRole = ROLES.find((r) => r.party === counterpartyParty)
      if (counterpartyRole) {
        enqueueV22NotificationForRequester(counterpartyRole.id, {
          id: `v22-amendment-${v22AmendingDaId}-${Date.now().toString(36)}`,
          type: 'v22-amendment',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22DaId: v22AmendingDaId,
          note: (note || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22AmendingDaId, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // Phase 6.D: self-evaluation entry point. Owner clicks Run Evaluation on
  // their own Claim — no EA required. The eval modal opens in self-eval mode;
  // the resulting Eval Result is owned by the Claim owner.
  const handleV22OpenSelfEvaluation = useCallback((claim) => {
    if (!claim) return
    setV22EvalContext({
      evaluationAgreementId: null,
      claimId: claim.id,
      selfEvaluation: true,
      ownerParty: claim.owner,
    })
    setOpenAgreement(null)
    setEdgeMenu(null)
    setSelectedEdgeId(null)
  }, [])

  // Pan-to-node effect: triggered by v22PanToClaimId (provisional creation,
  // accept, eval run, amendment). Uses the animated pan path so V2Canvas sets
  // externalPanRef during the animation — short-circuits V2Canvas's own
  // selection-pan effect for the duration.
  //
  // Phase 6.5+ #5 — panel compensation:
  // V2Canvas's selection-pan adds `panelWidth > 0 ? 180/z : 0` to node.x and
  // `0.10 * containerHeight / z` to node.y so the target appears centred to
  // the LEFT of the open Detail Panel. After our animatedPanToWithZoom
  // completes (~500ms), the v22DataWithReveal effect eventually re-runs (e.g.
  // when v22RecentlyAcceptedClaimId clears at 900ms), nodeMap reference
  // changes, V2Canvas's selection-pan re-fires with externalPanRef now false,
  // and pans again to the panel-compensated position. The user sees a
  // "secondary adjustment" 400ms after the initial pan.
  //
  // Fix: apply the same panel compensation up-front so the initial pan lands
  // on the same coordinates the eventual selection-pan would target — no
  // secondary jump.
  useEffect(() => {
    if (!v22PanToClaimId) return
    const target = v22Data?.nodeMap?.[v22PanToClaimId]
    const ref = canvasRef.current
    if (target && target.x != null && target.y != null && ref) {
      Promise.resolve().then(() => {
        // Match V2Canvas's exact `panelWidth` calculation (V2App line ~2450)
        // so the offset agrees with what selection-pan would later apply.
        const selNode = sel ? v22Data?.nodeMap?.[sel] : null
        const panelOpen = !!(selNode && selNode.v22Type && !selNode.isNetworkNode)
        const container = document.querySelector('[data-canvas-container]')
        const z = 1.28
        const horizontalOffsetX = panelOpen ? (180 / z) : 0
        const verticalOffsetY = container ? (container.clientHeight * 0.10) / z : 0
        const tx = target.x + horizontalOffsetX
        const ty = target.y + verticalOffsetY
        if (ref.animatedPanToWithZoom) {
          ref.animatedPanToWithZoom(tx, ty, z, 500)
        } else {
          ref.panToWithZoom?.(tx, ty, z)
        }
      })
    }
    setV22PanToClaimId(null)
  }, [v22PanToClaimId, v22Data])

  // Phase 9A.1.5 item 5: edge-select framing. When the user selects an
  // Agreement Edge, animate-pan + animate-zoom the canvas to frame both
  // endpoint cards with ~25% padding around the union of their bounding
  // boxes. Detail Panel is accounted for by offsetting the target centre
  // into the visible canvas area (left of the open panel). Reuses the
  // existing `animatedPanToWithZoom` imperative handle that already drives
  // post-request / post-accept reveals.
  //
  // Fires when `selectedEdgeId` transitions from null → non-null, and when
  // it changes from one edge to another. Deselection (→ null) does not
  // re-frame. Edges whose endpoints lack positions (e.g., the Radiant
  // Network pseudo-actor) are skipped.
  useEffect(() => {
    if (!selectedEdgeId) return
    const edge = v22Data?.edges?.find(e => e.id === selectedEdgeId)
    if (!edge) return
    const from = v22Data?.nodeMap?.[edge.from]
    const to = v22Data?.nodeMap?.[edge.to]
    if (!from || !to || from.x == null || to.x == null || from.y == null || to.y == null) return
    const ref = canvasRef.current
    if (!ref || !ref.animatedPanToWithZoom) return
    const container = document.querySelector('[data-canvas-container]')
    if (!container) return

    // AssetNode CARD_W / CARD_H constants (held locally to avoid importing).
    const CARD_W = 210
    const CARD_H = 96

    // Union bounding box of the two cards.
    const xmin = Math.min(from.x, to.x)
    const xmax = Math.max(from.x, to.x) + CARD_W
    const ymin = Math.min(from.y, to.y)
    const ymax = Math.max(from.y, to.y) + CARD_H
    const unionW = xmax - xmin
    const unionH = ymax - ymin

    // Panel-aware visible canvas area (panelWidth matches V2App's own
    // panelWidth prop calculation at the V2Canvas mount).
    const selNode = sel ? v22Data.nodeMap[sel] : null
    const panelOpenFromSel = !!(selNode && selNode.v22Type && !selNode.isNetworkNode)
    const panelOpenFromEdge = !!openAgreement
    const panelOpen = panelOpenFromSel || panelOpenFromEdge
    const PANEL_W = 480
    const panelW = panelOpen ? PANEL_W : 0
    const visibleW = Math.max(200, container.clientWidth - panelW)
    const visibleH = container.clientHeight

    // Padding around the union — ~20-30% on each side. Convert to a scale
    // factor (1 + 2×padFrac) so a padFrac of 0.25 gives 25% padding each
    // side = 1.5× effective extent.
    const padFrac = 0.25
    const scaleFactor = 1 + 2 * padFrac

    const zoomByW = visibleW / (unionW * scaleFactor)
    const zoomByH = visibleH / (unionH * scaleFactor)
    // Clamp to the same range the manual zoom UI supports.
    const targetZoom = Math.max(0.3, Math.min(1.5, Math.min(zoomByW, zoomByH)))

    // Midpoint of the union. Panel compensation: shift camera target right
    // by half the panel width (in world units) so the rendered midpoint
    // lands in the centre of the visible canvas area instead of the full
    // canvas. Without this, the midpoint sits under the panel.
    const midX = (xmin + xmax) / 2
    const midY = (ymin + ymax) / 2
    const panelOffsetWorld = panelOpen ? (panelW / 2) / targetZoom : 0

    ref.animatedPanToWithZoom(midX + panelOffsetWorld, midY, targetZoom, 600)
  }, [selectedEdgeId, v22Data, sel, openAgreement])

  const currentRoleState = perRoleState[roleId] || emptyRoleState

  // Reset prevSelRef on role switch to prevent cross-role _isNew clearing
  const prevRoleRef = useRef(roleId)
  useEffect(() => {
    if (prevRoleRef.current !== roleId) {
      prevSelRef.current = null
      prevRoleRef.current = roleId
    }
  }, [roleId])

  // Phase 7 carry-over #1: V2.2 NEW badge persists until the user moves on.
  // The reveal ids (v22RecentlyAcceptedClaimId / v22RecentlyAcceptedAssetId)
  // are set when a handler creates a new node; they drive `_isNew` via the
  // `v22DataWithReveal` memo. Previously each handler also scheduled a 900ms
  // setTimeout to clear the id; that cleared the badge before the user had a
  // chance to read it. The new rule: clear the reveal id when `sel` moves
  // off the revealed node (click empty canvas, close panel, or select a
  // different node). Uses the same prevSelRef the V2.1 sibling effect reads
  // so role-switch semantics stay aligned.
  useEffect(() => {
    const prevSel = prevSelRef.current
    if (!prevSel || prevSel === sel) return
    if (v22RecentlyAcceptedClaimId === prevSel) setV22RecentlyAcceptedClaimId(null)
    if (v22RecentlyAcceptedAssetId === prevSel) setV22RecentlyAcceptedAssetId(null)
  }, [sel, v22RecentlyAcceptedClaimId, v22RecentlyAcceptedAssetId])

  // Phase 8: keep prevSelRef in sync with `sel` for the V2.2 reveal-clear
  // effect above (which reads prevSelRef). V2.1 had a parallel effect here
  // that cleared `_isNew` on `addedNodes` / `newlyDisclosedIds` / `addedEdges`
  // — all V2.1-only state that was removed when the feature flag came down.
  useEffect(() => {
    prevSelRef.current = sel
  }, [sel])

  // Phase 8: `addedNodes` / `addedSDAs` / `addedEdges` / `addedChildren` /
  // `removedX` / `newlyDisclosedIds` are no longer used by the V2.2 canvas
  // pipeline (it short-circuits to the adapter), but a handful of V2.1-era
  // handlers (kept in place pending a dedicated dead-code sweep — see polish
  // item #50) still reference them. Destructure with empty-array defaults so
  // those handlers resolve at runtime without throwing ReferenceErrors.
  const { dismissedReqs, addedRequests } = currentRoleState
  const addedNodes = currentRoleState.addedNodes || []
  const addedSDAs = currentRoleState.addedSDAs || {}
  const addedEdges = currentRoleState.addedEdges || []
  const addedChildren = currentRoleState.addedChildren || {}
  const removedSDAs = currentRoleState.removedSDAs || []
  const removedNodes = currentRoleState.removedNodes || []
  const removedEdges = currentRoleState.removedEdges || []

  const { nodes, edges, nodeMap, pendingRequests, existingCascades } = useMemo(() => {
    // The V2.2 adapter has already computed role-filtered nodes, edges, and
    // nodeMap (see `buildV22Canvas` in v2_2Data.js). V2.1's merge-and-rollup
    // pipeline — SDA mutations, addedNodes / addedEdges / addedChildren / the
    // removedX filters, per-node health aggregation, selective-disclosure
    // field filtering — was removed in Phase 8 when V2_2_ENABLED came down.
    // Notifications flow through `addedRequests` which V2.2 still uses.
    return {
      nodes: roleData.nodes,
      edges: roleData.edges,
      nodeMap: roleData.nodeMap,
      pendingRequests: [...addedRequests],
      existingCascades: [],
    }
  }, [roleData, addedRequests])


  // Public listings from other role's merged state (sees dynamic publishes)

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
  const footerTipRef = useRef(null)
  const pendingPanRef = useRef(null)
  const [showFooterTip, setShowFooterTip] = useState(false)
  const [revealAnim, setRevealAnim] = useState(null)
  const [forcePanelTab, setForcePanelTab] = useState(null)
  const [forceExpandSda, setForceExpandSda] = useState(null)
  const [publishNode, setPublishNode] = useState(null)
  const [connectNode, setConnectNode] = useState(null)
  const [registerNode, setRegisterNode] = useState(null)
  const [responseRequest, setResponseRequest] = useState(null)
  const [showInbox, setShowInbox] = useState(false)
  // Phase 9A.4 Gate C: when the recipient clicks Decline on a transfer
  // request, swap the notification row into a "reason" sub-form.
  //   Shape: { notifId, reason } — notif metadata + live textarea value.
  const [v22DecliningTransfer, setV22DecliningTransfer] = useState(null)
  const [cascadeContext, setCascadeContext] = useState(null)
  const [evidenceNode, setEvidenceNode] = useState(null)
  const [parseContext, setParseContext] = useState(null)
  const [revocationNotice, setRevocationNotice] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryInitialSetId, setLibraryInitialSetId] = useState(null)
  const [showPEPLibrary, setShowPEPLibrary] = useState(false)
  const [publishedRequirementSets, setPublishedRequirementSets] = useState([])
  useEffect(() => {
    const handler = () => setShowPEPLibrary(true)
    document.addEventListener('open-pep-library', handler)
    return () => document.removeEventListener('open-pep-library', handler)
  }, [])
  const [evalContext, setEvalContext] = useState(null)
  const [claimContext, setClaimContext] = useState(null)
  const [reviseContext, setReviseContext] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)

  // Reveal animation state machine for provisional→real card transitions
  const startReveal = useCallback((nodeId) => {
    setRevealAnim({ nodeId, phase: 'zoom' })
    // Immediately position camera with panel offsets — cancels any running pan animation
    const target = nodeMap[nodeId]
    if (target) {
      const container = document.querySelector('[data-canvas-container]')
      const z = 1.28
      const viewportOffsetY = container ? (container.clientHeight * 0.10) / z : 0
      const horizontalOffsetX = 180 / z
      canvasRef.current?.panToWithZoom?.(
        target.x + horizontalOffsetX,
        target.y + viewportOffsetY,
        z
      )
    }
    setTimeout(() => setRevealAnim(prev => prev?.nodeId === nodeId ? { ...prev, phase: 'border' } : prev), 500)
    setTimeout(() => {
      setRevealAnim(prev => prev?.nodeId === nodeId ? { ...prev, phase: 'flip' } : prev)
      // Clear provisional appearance on connected edges and the node itself
      updateRoleState(roleId, prev => {
        let newState = { ...prev }
        let changed = false
        // Clear edge flags
        const updatedEdges = prev.addedEdges.map(e => {
          if ((e.from === nodeId || e.to === nodeId) && e._showAsProvisional) {
            return { ...e, _showAsProvisional: false }
          }
          return e
        })
        if (updatedEdges.some((e, i) => e !== prev.addedEdges[i])) {
          newState.addedEdges = updatedEdges
          changed = true
        }
        // Clear node flag
        const nodeIdx = prev.addedNodes.findIndex(n => n.id === nodeId && n._showAsProvisional)
        if (nodeIdx >= 0) {
          const updatedNodes = [...prev.addedNodes]
          updatedNodes[nodeIdx] = { ...updatedNodes[nodeIdx], _showAsProvisional: false }
          newState.addedNodes = updatedNodes
          changed = true
        }
        return changed ? newState : prev
      })
    }, 1100)
    setTimeout(() => setRevealAnim(prev => prev?.nodeId === nodeId ? { ...prev, phase: 'badge' } : prev), 1800)
    setTimeout(() => setRevealAnim(prev => prev?.nodeId === nodeId ? { ...prev, phase: 'panel' } : prev), 2000)
    setTimeout(() => setRevealAnim(prev => prev?.nodeId === nodeId ? { ...prev, phase: 'done' } : prev), 2500)
    // Dismiss matching acceptance notification
    const targetPin = nodeMap[nodeId]?.pin
    if (targetPin) {
      updateRoleState(roleId, prev => {
        const matchReq = (prev.addedRequests || []).find(r =>
          r.type === 'acceptance' && r.asset?.pin === targetPin
        )
        if (matchReq && !(prev.dismissedReqs || []).includes(matchReq.id)) {
          return { ...prev, dismissedReqs: [...prev.dismissedReqs, matchReq.id] }
        }
        return prev
      })
    }
  }, [nodeMap, roleId])

  // Pan to pending target after Connect Asset or Disclosure Response modal closes
  useEffect(() => {
    if (!pendingPanRef.current) return
    if (connectNode !== null && responseRequest !== null) return
    const pending = pendingPanRef.current
    pendingPanRef.current = null

    if (pending.type === 'pair') {
      setTimeout(() => {
        setForcePanelTab('disclosures')
        setSel(pending.ownNodeId)
        const pairedNode = nodeMapRef.current[pending.pairedNodeId]
        if (pairedNode) {
          const midX = (pending.ownX + pairedNode.x) / 2
          const midY = (pending.ownY + pairedNode.y) / 2
          const container = document.querySelector('[data-canvas-container]')
          let targetZoom = 1.28
          if (container) {
            const pad = 300
            const dataW = Math.abs(pairedNode.x - pending.ownX) + pad * 2
            const dataH = Math.abs((pairedNode.y || 0) - pending.ownY) + pad * 2
            const fitZoom = Math.min(container.clientWidth / dataW, container.clientHeight / dataH) * 0.85
            targetZoom = Math.max(0.5, Math.min(1.35, fitZoom))
          }
          const panelCompX = container ? (180 / targetZoom) : 0
          canvasRef.current?.animatedPanToWithZoom?.(midX + panelCompX, midY, targetZoom, 600)
        } else {
          canvasRef.current?.animatedPanToWithZoom?.(pending.ownX, pending.ownY, 1.28, 600)
        }
      }, 100)
    } else {
      setTimeout(() => {
        setSel(pending.nodeId)
        canvasRef.current?.animatedPanToWithZoom?.(pending.x, pending.y, 1.28, 600)
      }, 100)
    }
  }, [connectNode, responseRequest])

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

  const handlePublishRequirementSet = useCallback((reqSet) => {
    setPublishedRequirementSets(prev => {
      if (prev.some(s => s.id === reqSet.id)) return prev
      return [...prev, {
        ...reqSet,
        _published: true,
        _publishedBy: activeRole.party,
        _publishedByRoleId: roleId,
        _publishedDate: new Date().toISOString().slice(0, 10),
      }]
    })
    const otherRoleId = ROLES.find(r => r.id !== roleId)?.id
    if (otherRoleId) {
      updateRoleState(otherRoleId, prev => ({
        ...prev,
        addedRequests: [...(prev.addedRequests || []), {
          id: `pub-reqset-${reqSet.id}-${Date.now().toString(36)}`,
          type: 'published_standard',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          standardName: reqSet.name,
          standardVersion: reqSet.version || 1,
          date: new Date().toISOString().slice(0, 10),
        }],
      }))
    }
  }, [activeRole, roleId, updateRoleState])

  const visiblePublishedSets = useMemo(() => {
    return publishedRequirementSets.filter(s => s._publishedByRoleId !== roleId)
  }, [publishedRequirementSets, roleId])

  // PEP templates — per-role, defaults from demo data
  const pepTemplates = useMemo(() => {
    const custom = currentRoleState.pepTemplates
    return custom ?? getPEPTemplatesForRole(roleId)
  }, [currentRoleState.pepTemplates, roleId])

  const handleSavePEPTemplate = useCallback((template) => {
    updateRoleState(roleId, prev => {
      const existing = prev.pepTemplates ?? getPEPTemplatesForRole(roleId)
      return { ...prev, pepTemplates: [...existing, template] }
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
    setTimeout(() => {
      canvasRef.current?.playNetworkBuild?.()
    }, 100)
  }, [])

  const handleSelect = useCallback((node) => {
    setSel(node.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    // Node selection is mutually exclusive with edge selection (spec §4.4).
    // Clear here explicitly instead of via effect — avoids a race where an
    // effect watching [sel, selectedEdgeId] fires on a subsequent edge-click
    // and wipes the fresh edge state.
    setSelectedEdgeId(null)
    setEdgeMenu(null)
    setOpenAgreement(null)
  }, [])

  const handleCloseSel = useCallback(() => {
    setSel(null)
    setForcePanelTab(null)
    setForceExpandSda(null)
    // V2.2: a "close selection" gesture (background click, Detail Panel close,
    // ESC) should clear edge state too. Node-selection and edge-selection are
    // mutually exclusive per spec §4.4.
    setSelectedEdgeId(null)
    setEdgeMenu(null)
    setOpenAgreement(null)
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

  const ensureParentLayer = useCallback((callback) => {
    if (layerInfo.depth > 0) {
      canvasRef.current?.surface()
      setTimeout(callback, 400)
    } else if (subchainFocusId) {
      exitSubchain()
      setTimeout(callback, 400)
    } else {
      callback()
    }
  }, [layerInfo.depth, subchainFocusId, exitSubchain])

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
        return { pin, status: 'error', error: 'Invalid PIN format.', errorCode: 'ERR-00' }
      }
      const resolved = resolvePin(pin)
      if (!resolved) {
        return { pin, status: 'error', error: 'PIN not found. Verify the PIN and try again.', errorCode: 'ERR-05' }
      }
      // Block child-layer nodes (evidence, parse, eval) — only parent-layer nodes are disclosable
      const isChildNode = resolved.isEvidence
        || resolved.isParse || resolved.category === 'parse'
        || resolved.isEvaluation || resolved.category === 'evaluation'
        || (resolved.parentId && !resolved.isClaim && resolved.category !== 'claim')
      if (isChildNode) {
        return { pin, status: 'error', error: 'This PIN does not reference a disclosable asset. Only claims and assets can be disclosed.', errorCode: 'ERR-01' }
      }
      // Self-owned node
      if (resolved.owner === activeRole.party) {
        return { pin, status: 'error', error: 'This asset is already on your network.', errorCode: 'ERR-02' }
      }
      // Already on network
      if (nodeMap[resolved.id]) {
        return { pin, status: 'error', error: 'This asset is already on your network via an existing disclosure.', errorCode: 'ERR-03' }
      }
      // Pending request
      const provId = `provisional-${resolved.id}`
      if (nodeMap[provId] || addedNodes.some(n => n.id === provId)) {
        return { pin, status: 'error', error: 'A disclosure request for this asset is already pending.', errorCode: 'ERR-04' }
      }
      if (pendingRequests.some(r => r.asset?.pin === resolved.pin && r.from?.name === activeRole.party)) {
        return { pin, status: 'error', error: 'A disclosure request for this asset is already pending.', errorCode: 'ERR-04' }
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
      // Block child nodes
      if (resolved.isEvidence || resolved.isParse || resolved.category === 'parse' || resolved.isEvaluation || resolved.category === 'evaluation') return
      if (resolved.parentId && !resolved.isClaim && resolved.category !== 'claim') return
      // Block self-owned
      if (resolved.owner === activeRole.party) return
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
        _isNew: true,
        _createdAt: Date.now(),
      })
    })

    // Single state update with all provisional nodes + edges
    if (newProvNodes.length > 0) {
      updateRoleState(roleId, prev => ({
        ...prev,
        addedNodes: [...prev.addedNodes, ...newProvNodes],
        addedEdges: [...prev.addedEdges, ...newProvEdges],
      }))
      // Store target — pan will fire when the modal closes
      pendingPanRef.current = {
        nodeId: newProvNodes[0].id,
        x: newProvNodes[0].x,
        y: newProvNodes[0].y,
      }
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
      {!booted && (
        <V2BootScreen
          onComplete={handleBootComplete}
          onFading={() => canvasRef.current?.prepNetworkBuild?.()}
        />
      )}

      {/* Top bar — z-index 300 sits above Detail Panel (200) and Agreement
           Panel (210) so notification icon, credits badge, and user menu
           stay clickable even when a panel is open (Phase 6.5+ #1). */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        zIndex: 300,
        position: 'relative',
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
          <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <div
            onClick={toggleTheme}
            style={{ ...iconBtnStyle, fontSize: 16 }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            {theme === 'dark' ? '☀' : '☾'}
          </div>
          </Tooltip>

          {/* Requirements Library */}
          <Tooltip content="Requirements Library">
          <div
            onClick={() => { setLibraryInitialSetId(null); setShowLibrary(true) }}
            style={iconBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="3" y="2.5" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <rect x="5.5" y="1" width="5" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--bg-deep)" />
              <line x1="5.5" y1="7" x2="10.5" y2="7" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="9.5" x2="10.5" y2="9.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
              <line x1="5.5" y1="12" x2="8.5" y2="12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
            </svg>
          </div>
          </Tooltip>

          {/* PEP Template Library */}
          <Tooltip content="PEP Template Library">
          <div
            onClick={() => setShowPEPLibrary(true)}
            style={iconBtnStyle}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
              <line x1="2" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1" />
              <line x1="6" y1="6" x2="6" y2="13" stroke="currentColor" strokeWidth="1" />
              <line x1="10" y1="6" x2="10" y2="13" stroke="currentColor" strokeWidth="1" />
            </svg>
          </div>
          </Tooltip>

          {/* V2.2 Phase 7: Radiant Network (Directory Layer) + AI Shopper.
              Spec §8 anchors the Radiant Network button bottom-left; Andrew's
              Phase 7 task accepts chrome placement near the notification icon. */}
          {/* Radiant Network (Directory Layer) + AI Shopper chrome buttons. */}
          <>
              <Tooltip content={v22DirectoryOpen ? 'Close the Public Directory' : 'Radiant Network — browse the Public Directory'} width={280}>
              <div
                onClick={() => setV22DirectoryOpen((v) => !v)}
                style={{
                  ...iconBtnStyle,
                  // Phase 8 polish #2: button reads as active when Directory
                  // is open so the user understands clicking again closes it.
                  background: v22DirectoryOpen ? 'color-mix(in srgb, var(--accent-amber) 18%, transparent)' : 'var(--bg-surface)',
                  borderColor: v22DirectoryOpen ? 'var(--accent-amber)' : 'var(--border)',
                  color: v22DirectoryOpen ? 'var(--accent-amber)' : 'var(--text-secondary)',
                }}
                onMouseEnter={e => { if (!v22DirectoryOpen) e.currentTarget.style.background = 'var(--bg-raised)' }}
                onMouseLeave={e => { if (!v22DirectoryOpen) e.currentTarget.style.background = 'var(--bg-surface)' }}
              >
                {/* Globe icon: circle + meridian + two latitude arcs. */}
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <ellipse cx="8" cy="8" rx="2.5" ry="6" stroke="currentColor" strokeWidth="1" fill="none" />
                  <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" strokeWidth="1" />
                  <path d="M3 5 Q8 3.5 13 5" stroke="currentColor" strokeWidth="1" fill="none" />
                  <path d="M3 11 Q8 12.5 13 11" stroke="currentColor" strokeWidth="1" fill="none" />
                </svg>
              </div>
              </Tooltip>
              <Tooltip content="AI Shopper — discover public Claims matching a Requirements Set" width={280}>
              <div
                onClick={() => setV22AIShopperOpen(true)}
                style={iconBtnStyle}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-raised)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-surface)'}
              >
                {/* Search + sparkle icon signalling AI-assisted discovery. */}
                <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.3" fill="none" />
                  <line x1="10" y1="10" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                  <path d="M12 3 L12.5 4.5 L14 5 L12.5 5.5 L12 7 L11.5 5.5 L10 5 L11.5 4.5 Z" fill="currentColor" />
                </svg>
              </div>
              </Tooltip>
          </>

          {/* Notification inbox */}
          <div ref={inboxRef} style={{ position: 'relative' }}>
            {/* Phase 9A.3 backlog #62(b): bell chrome button lacked a tooltip.
                Suppress the tooltip while the inbox is open (it obscures the
                dropdown; Tooltip's own disabled prop handles that). */}
            <Tooltip content={showInbox ? null : (visibleRequests.length > 0 ? `Notifications (${visibleRequests.length})` : 'Notifications')}>
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
            </Tooltip>

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
                    const isRevision = req.type === 'revision'
                    const isEvaluation = req.type === 'evaluation'
                    const isPublishedStandard = req.type === 'published_standard'
                    const isV22Request = req.type === 'v22-request'
                    const isV22Amendment = req.type === 'v22-amendment'
                    const isV22Evaluation = req.type === 'v22-evaluation'
                    // Phase 9A.4 Gate C: four new Transferring notification types.
                    const isV22TransferRequest = req.type === 'v22-transfer-request'
                    const isV22TransferAccepted = req.type === 'v22-transfer-accepted'
                    const isV22TransferDeclined = req.type === 'v22-transfer-declined'
                    const isV22TransferCancelled = req.type === 'v22-transfer-cancelled'
                    const badgeColor = isRevocation || isDecline || isV22TransferDeclined ? 'var(--accent-red)' : isAcceptance || isV22TransferAccepted ? 'var(--accent-green)' : isRevision || isEvaluation || isV22Amendment || isV22Evaluation ? 'var(--accent-indigo)' : isPublishedStandard ? 'var(--accent-blue)' : isV22TransferRequest ? 'var(--accent-amber)' : isV22TransferCancelled ? 'var(--text-dim)' : 'var(--accent-indigo)'
                    const badgeLabel = isRevocation ? 'REVOKED' : isAcceptance ? 'ACCEPTED' : isDecline ? 'DECLINED' : isRevision ? 'REVISED' : isEvaluation ? (req.isAmend ? 'AMENDED' : 'EVALUATED') : isPublishedStandard ? 'PUBLISHED' : isV22Amendment ? 'AMENDED' : isV22Evaluation ? (req.supersedesPriorResultId ? 'RE-EVALUATED' : 'EVALUATED') : isV22Request ? 'REQUEST' : isV22TransferRequest ? 'TRANSFER' : isV22TransferAccepted ? 'ACCEPTED' : isV22TransferDeclined ? 'DECLINED' : isV22TransferCancelled ? 'CANCELLED' : 'REQUEST'
                    const isDecliningThisTransfer = isV22TransferRequest && v22DecliningTransfer?.notifId === req.id
                    return (
                    <div
                      key={req.id}
                      onClick={() => {
                        setShowInbox(false)
                        if (isRevocation) {
                          ensureParentLayer(() => setRevocationNotice(req))
                        } else if (isRevision) {
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            const targetNode = Object.values(nodeMap).find(n => n.pin === req.asset?.pin)
                            if (targetNode) {
                              setSel(targetNode.id)
                              setForcePanelTab('disclosures')
                            }
                          })
                        } else if (isAcceptance || isDecline) {
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            if (isAcceptance) {
                              const targetNode = Object.values(nodeMap).find(n => n.pin === req.asset?.pin)
                              if (targetNode) {
                                setSel(targetNode.id)
                                if (targetNode._isNew && targetNode._wasProvisional) {
                                  // Reveal animation handles its own pan.
                                  startReveal(targetNode.id)
                                } else {
                                  // Phase 6.5+ #4: pan to the target node only,
                                  // zoom 1.28 (was midpointing toward a paired
                                  // node at zoom 0.7, which felt under-panned
                                  // and under-zoomed). Edge framing is a polish
                                  // follow-up.
                                  canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                                }
                              }
                            }
                            if (isDecline) {
                              const targetNode = Object.values(nodeMap).find(n =>
                                n.pin === req.asset?.pin && n._isDeclined
                              )
                              if (targetNode) {
                                // Phase 6.5+ #3: select + animated pan to the
                                // declined node, mirroring the ACCEPTED branch.
                                // (Was setSel-only with a 100ms delay and no
                                // pan call.)
                                setSel(targetNode.id)
                                canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                              }
                            }
                          })
                        } else if (req.type === 'evaluation') {
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const targetAsset = Object.values(nodeMap).find(n => n.id === req.assetId)
                          if (targetAsset) {
                            const alreadyInLayer = layerInfo.depth > 0 && layerInfo.anchorId === req.assetId
                            if (alreadyInLayer) {
                              setSel(req.evalId)
                              setForcePanelTab('evaluations')
                            } else {
                              ensureParentLayer(() => {
                                const freshTarget = nodeMapRef.current[req.assetId]
                                if (freshTarget) {
                                  canvasRef.current?.dive(freshTarget)
                                  setTimeout(() => { setSel(req.evalId); setForcePanelTab('evaluations') }, 600)
                                }
                              })
                            }
                          }
                        } else if (req.type === 'published_standard') {
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          setLibraryInitialSetId(null)
                          setShowLibrary(true)
                        } else if (req.type === 'v22-request') {
                          // Phase 6.5 #8: do NOT dismiss on click — only on
                          // terminal action (accept / decline in handleV22Accept
                          // / handleV22Decline). If the user closes the modal
                          // without resolving, the notification reappears.
                          if (req.v22DaId) setV22RespondingTo({ daId: req.v22DaId })
                        } else if (req.type === 'v22-amendment') {
                          // Phase 6 own scope: amendment notifications deep-link
                          // to the amended Claim on the recipient's canvas.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const targetNode = Object.values(nodeMap).find(n => n.pin === req.asset?.pin)
                          if (targetNode) {
                            setSel(targetNode.id)
                            canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.0, 500)
                          }
                        } else if (req.type === 'v22-evaluation') {
                          // Phase 6.5 #6: deep-link to the new Eval Result node.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const targetNode = req.v22EvalResultId ? nodeMap[req.v22EvalResultId] : null
                          if (targetNode) {
                            setSel(targetNode.id)
                            canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.0, 500)
                          }
                        } else if (req.type === 'v22-transfer-request') {
                          // Phase 9A.4 Gate C: do NOT dismiss on click — the
                          // notification resolves only on Accept or Decline.
                          // Actions render inline inside the row, so clicking
                          // the body chrome is a no-op (keeps the inbox open).
                          setShowInbox(true)
                        } else if (req.type === 'v22-transfer-accepted' || req.type === 'v22-transfer-declined' || req.type === 'v22-transfer-cancelled') {
                          // Informational notifications — clicking dismisses.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                        } else {
                          ensureParentLayer(() => {
                            const reqNode = req.asset?.pin ? Object.values(nodeMap).find(n => n.pin === req.asset.pin) : null
                            setResponseRequest(reqNode ? { ...req, node: reqNode } : req)
                          })
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
                          <Tooltip content="Discovered via Public Directory">
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', marginLeft: 4,
                          }}>
                            <svg width={12} height={12} viewBox="0 0 16 16" fill="none">
                              <circle cx="8" cy="8" r="6" stroke="#38bdf8" strokeWidth="1.2" />
                              <ellipse cx="8" cy="8" rx="2.8" ry="6" stroke="#38bdf8" strokeWidth="0.9" />
                              <line x1="2" y1="8" x2="14" y2="8" stroke="#38bdf8" strokeWidth="0.9" />
                            </svg>
                          </span>
                          </Tooltip>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', paddingLeft: 30 }}>
                        {isEvaluation
                          ? `${req.isAmend ? 'Amended' : 'Ran'} ${req.evalName} evaluation on ${req.asset?.name}`
                          : isRevision
                            ? `Revised ${req.disclosureType} disclosure to ${req.asset?.name}`
                            : isRevocation
                              ? `Revoked ${req.disclosureType} disclosure to ${req.asset?.name}`
                              : isAcceptance
                                ? `Granted ${req.disclosureType} disclosure to ${req.asset?.name}`
                                : isDecline
                                  ? `Declined disclosure to ${req.asset?.name}`
                                  : isPublishedStandard
                                    ? `Published ${req.standardName} v${req.standardVersion} to the Radiant Network`
                                    : isV22TransferRequest
                                      ? `${req.from.name} is offering to transfer ${req.asset?.name} to you.`
                                      : isV22TransferAccepted
                                        ? `${req.asset?.name} has been transferred to ${req.from.name}.`
                                        : isV22TransferDeclined
                                          ? (req.declineReason ? `Transfer declined by ${req.from.name} — "${req.declineReason}"` : `Transfer of ${req.asset?.name} declined by ${req.from.name}.`)
                                          : isV22TransferCancelled
                                            ? `${req.from.name} cancelled the transfer of ${req.asset?.name}.`
                                            : req.asset?.name || ''
                        }
                        {/* Phase 9A.4 Gate C: inline note preview on a pending transfer request. */}
                        {isV22TransferRequest && req.note && !isDecliningThisTransfer && (
                          <div style={{
                            marginTop: 6, padding: '6px 8px',
                            background: 'var(--bg-raised)', borderRadius: 4,
                            fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic',
                          }}>"{req.note}"</div>
                        )}
                      </div>
                      {/* Phase 9A.4 Gate C: Accept/Decline action buttons on a
                          v22-transfer-request, OR the decline-reason sub-form
                          when the user has clicked Decline. */}
                      {isV22TransferRequest && !isDecliningThisTransfer && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 10, paddingLeft: 30 }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleV22TransferAccept(req) }}
                            style={{
                              flex: 1, padding: '6px 12px', borderRadius: 4,
                              border: '1px solid var(--accent-green)',
                              background: 'color-mix(in srgb, var(--accent-green) 12%, transparent)',
                              color: 'var(--accent-green)',
                              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              letterSpacing: '0.06em', cursor: 'pointer',
                            }}
                          >ACCEPT</button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setV22DecliningTransfer({ notifId: req.id, reason: '' }) }}
                            style={{
                              flex: 1, padding: '6px 12px', borderRadius: 4,
                              border: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--text-tertiary)',
                              fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                              letterSpacing: '0.06em', cursor: 'pointer',
                            }}
                          >DECLINE</button>
                        </div>
                      )}
                      {isDecliningThisTransfer && (
                        <div style={{ marginTop: 10, paddingLeft: 30 }}>
                          <textarea
                            value={v22DecliningTransfer.reason}
                            onChange={(e) => setV22DecliningTransfer((prev) => prev ? { ...prev, reason: e.target.value } : prev)}
                            placeholder="Reason (optional)"
                            rows={2}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: '100%', padding: '6px 8px', borderRadius: 4,
                              border: '1px solid var(--border)', background: 'var(--bg-card)',
                              color: 'var(--text-primary)', fontFamily: 'var(--font-display)', fontSize: 11,
                              outline: 'none', resize: 'vertical', lineHeight: 1.5,
                            }}
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setV22DecliningTransfer(null) }}
                              style={{
                                flex: 1, padding: '6px 12px', borderRadius: 4,
                                border: '1px solid var(--border)', background: 'transparent',
                                color: 'var(--text-tertiary)',
                                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                letterSpacing: '0.06em', cursor: 'pointer',
                              }}
                            >BACK</button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                const reason = v22DecliningTransfer.reason
                                setV22DecliningTransfer(null)
                                handleV22TransferDecline(req, reason)
                              }}
                              style={{
                                flex: 1, padding: '6px 12px', borderRadius: 4,
                                border: '1px solid var(--accent-red)',
                                background: 'color-mix(in srgb, var(--accent-red) 12%, transparent)',
                                color: 'var(--accent-red)',
                                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 700,
                                letterSpacing: '0.06em', cursor: 'pointer',
                              }}
                            >CONFIRM DECLINE</button>
                          </div>
                        </div>
                      )}
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
                  <button
                    onClick={() => setCredits(0)}
                    style={{
                      width: '100%', padding: '6px 10px', borderRadius: 4,
                      border: '1px solid var(--border)', background: 'transparent',
                      color: 'var(--text-dim)', fontSize: 10, fontFamily: 'var(--font-mono)',
                      cursor: 'pointer', transition: 'all 150ms', marginTop: 4,
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-red)'; e.currentTarget.style.color = 'var(--accent-red)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-dim)' }}
                  >
                    Reset to 0
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
              <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>▾</span>
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

      {/* Phase 8: the "V2.2 MODE ACTIVE — architecture migration in progress"
          banner + its Request-Agreement shortcut were removed. Migration is
          complete; the banner's semantics no longer apply. The Request flow
          remains reachable via the per-Asset Detail Panel footer and via the
          AI Shopper. */}

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
          panelWidth={sel && nodeMap[sel] && nodeMap[sel].v22Type && !nodeMap[sel].isNetworkNode ? 480 : 0}
          onLayerChange={setLayerInfo}
          // Phase 8: onConnect was V2.1's "connect to counterparty" handler
          // on the Asset card. V2.2 has no equivalent (request flow lives in
          // the Detail Panel); pass undefined so the card's connect button
          // stays hidden (AssetNode guards on typeof onConnect === 'function').
          onConnect={undefined}
          onDisclose={(node) => setPublishNode(node)}
          onAddEvidence={(node) => {
            setEvidenceNode(node)
          }}
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
            if (node.isClaim || node.category === 'claim') {
              const parentAsset = nodes.find(n => n.children?.some(c => c.id === node.id))
              if (!parentAsset) return
              const sda = (parentAsset.sdas || []).find(s => s.party === activeRole.party || s.partyLabel === 'internal')
              const disclosureType = parentAsset.owner === activeRole.party ? 'full' : (sda?.type || 'full')
              const claimReqSet = requirementSets.find(rs => rs.id === node.requirementSetId)
                || requirementSets.find(rs => (rs.lineageId || rs.id) === node.requirementSetLineageId)
                || publishedRequirementSets.find(rs => rs.id === node.requirementSetId)
                || publishedRequirementSets.find(rs => (rs.lineageId || rs.id) === node.requirementSetLineageId)
              setEvalContext({ assetNode: parentAsset, claimNode: node, disclosureType, claimReqSet: claimReqSet || null })
              return
            }
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
          onAmendEval={(node) => {
            if (!node || !node.isEvaluation) return
            const parentAsset = nodes.find(n => n.children?.some(c => c.id === node.id))
            if (!parentAsset) return
            const sda = (parentAsset.sdas || []).find(s => s.party === activeRole.party || s.partyLabel === 'internal')
            const disclosureType = parentAsset.owner === activeRole.party ? 'full' : (sda?.type || 'full')

            const claimNode = node.claimId ? (parentAsset.children || []).find(c => c.id === node.claimId) : null

            if (claimNode) {
              const claimReqSet = requirementSets.find(rs => rs.id === claimNode.requirementSetId)
                || requirementSets.find(rs => (rs.lineageId || rs.id) === claimNode.requirementSetLineageId)
                || publishedRequirementSets.find(rs => rs.id === claimNode.requirementSetId)
                || null
              setEvalContext({
                assetNode: parentAsset,
                claimNode,
                disclosureType,
                claimReqSet,
                amendingEval: {
                  id: node.id,
                  requirementSetId: node.requirementSetId,
                  requirementSetName: node.requirementSetName || node.name,
                  claims: (node.claims || []).map(c => ({ ...c })),
                  version: node.evalVersion || 1,
                  selectedEvidenceIds: node.selectedEvidenceIds || [],
                },
              })
            } else {
              setEvalContext({
                assetNode: parentAsset,
                evidenceNode: null,
                disclosureType,
                amendingEval: {
                  id: node.id,
                  requirementSetId: node.requirementSetId,
                  requirementSetName: node.requirementSetName || node.name,
                  claims: (node.claims || []).map(c => ({ ...c })),
                  version: node.evalVersion || 1,
                  selectedEvidenceIds: node.selectedEvidenceIds || [],
                },
              })
            }
          }}
          onCreateClaim={(node) => setClaimContext(node ? { initiatingNode: node } : true)}
          // Phase 9A item 9: single dispatch for V2.2 card-attached actions.
          // Routes to the same handlers V22NodeDetailPanel's footer fires so
          // the card action bar and the Detail Panel stay one-to-one.
          onV22CardAction={(action, node) => {
            if (!node) return
            switch (action) {
              case 'requestAgreement':
                setV22RequestAnchor(node)
                setV22RequestOpen(true)
                return
              case 'parseEvidence':
                setV22ParsingAsset(node)
                return
              case 'registerAsset':
                // Phase 9A.3: owner-only; Actor card action fires this.
                if (node.v22Type === 'ACTOR' && node.name === activeRole.party && !node.isNetworkNode) {
                  setV22RegisteringAsset({ source: 'actor' })
                }
                return
              case 'createClaim':
                // Phase 9A.3: owner-only; Asset card action fires this with
                // the Asset pre-selected in the Claim's picker.
                if (node.v22Type === 'ASSET' && node.owner === activeRole.party) {
                  setV22CreatingClaim({ initialAssetIds: [node.id] })
                }
                return
              case 'transferAsset':
                // Phase 9A.4 Gate B: owner-only; Asset card action fires this.
                // `_pendingTransfer` guards a second initiation mid-flight.
                if (node.v22Type === 'ASSET' && node.owner === activeRole.party && !node._pendingTransfer) {
                  setV22TransferringAsset(node.v22Artifact || node)
                }
                return
              case 'cancelTransfer':
                if (node.v22Type === 'ASSET' && node.owner === activeRole.party && node._pendingTransfer) {
                  handleV22CancelTransfer(node.id)
                }
                return
              case 'amendClaim':
                if (node.owner === activeRole.party && node.v22Type === 'CLAIM') setV22AmendingClaimId(node.id)
                return
              case 'selfEvaluate':
                if (node.owner === activeRole.party && node.v22Type === 'CLAIM') handleV22OpenSelfEvaluation(node.v22Artifact)
                return
              case 'runEvaluation': {
                // Find the EA where this actor is grantee on the Claim's DA.
                const ea = (v22View?.evaluationAgreements || []).find(e => {
                  if (e.claimId !== node.id) return false
                  return e.grantee?.party === activeRole.party
                })
                if (ea) handleV22OpenRunEvaluation(ea)
                return
              }
              case 'reRunEvaluation': {
                const er = node.v22Artifact
                if (!er) return
                const eaForRerun = (v22View?.evaluationAgreements || []).find(e => e.id === er.evaluationAgreementId)
                setV22EvalContext({
                  evaluationAgreementId: eaForRerun ? eaForRerun.id : null,
                  claimId: er.claimId,
                  selfEvaluation: !eaForRerun,
                  lockedRequirementsSetId: er.requirementsSet?.id || null,
                  priorActiveResultId: er.id,
                })
                return
              }
              default:
                return
            }
          }}
          activeParty={activeRole.party}
          revealAnim={revealAnim}
          selectedEdgeId={selectedEdgeId}
          onEdgeClick={(edgeId, anchor) => {
            // Edge click opens the EdgeMenu (if a paired EA exists) or the
            // Disclosure Agreement panel directly. Clears node selection first
            // so node and edge selection stay mutually exclusive.
            const resolved = resolveAgreementsForEdge(edgeId, v22View, edges)
            if (!resolved || !resolved.disclosureAgreement) return
            setSel(null)
            setForcePanelTab(null)
            setForceExpandSda(null)
            setSelectedEdgeId(edgeId)
            if (resolved.evaluationAgreement) {
              setEdgeMenu({ edgeId, anchor })
              setOpenAgreement(null)
            } else {
              setEdgeMenu(null)
              setOpenAgreement({ kind: 'disclosure', edgeId })
            }
          }}
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

        {/* V2.2 Edge Menu — opens on edge click when paired EA exists (spec §4.3). */}
        {edgeMenu && (() => {
          const resolved = resolveAgreementsForEdge(edgeMenu.edgeId, v22View, edges)
          const hasEA = !!(resolved && resolved.evaluationAgreement)
          return (
            <EdgeMenu
              open
              anchor={edgeMenu.anchor}
              hasEvaluationAgreement={hasEA}
              onViewDisclosure={() => setOpenAgreement({ kind: 'disclosure', edgeId: edgeMenu.edgeId })}
              onViewEvaluation={() => setOpenAgreement({ kind: 'evaluation', edgeId: edgeMenu.edgeId })}
              onClose={() => setEdgeMenu(null)}
            />
          )
        })()}

        {/* V2.2 Agreement Detail Panels — slide over from the right, reuse the canvas panel slot. */}
        {openAgreement && (() => {
          const resolved = resolveAgreementsForEdge(openAgreement.edgeId, v22View, edges)
          if (!resolved || !resolved.disclosureAgreement) return null
          const resolveNodeName = (id) => nodeMap[id]?.name || null
          const close = () => {
            setOpenAgreement(null)
            setSelectedEdgeId(null)
          }
          const swapToEvaluation = resolved.evaluationAgreement
            ? () => setOpenAgreement({ kind: 'evaluation', edgeId: openAgreement.edgeId })
            : undefined
          const swapToDisclosure = () => setOpenAgreement({ kind: 'disclosure', edgeId: openAgreement.edgeId })
          return (
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 480, zIndex: 210,
              animation: 'detail-panel-slide-in 200ms ease',
            }}>
              {openAgreement.kind === 'disclosure' ? (
                <DisclosureAgreementDetailPanel
                  agreement={resolved.disclosureAgreement}
                  resolveNodeName={resolveNodeName}
                  activeParty={activeRole.party}
                  onClose={close}
                  onAmend={() => {
                    const da = resolved.disclosureAgreement
                    // Provisional DA + grantor → respond-to-request flow (Phase 4).
                    // Active DA + grantor → real amendment flow (Phase 6).
                    if (da.grantor.party !== activeRole.party) return
                    if (da.type === 'provisional') {
                      setV22RespondingTo({ daId: da.id })
                      close()
                    } else {
                      setV22AmendingDaId(da.id)
                      close()
                    }
                  }}
                  onViewEvaluationAgreement={swapToEvaluation}
                />
              ) : (
                <EvaluationAgreementDetailPanel
                  agreement={resolved.evaluationAgreement}
                  resolveNodeName={resolveNodeName}
                  activeParty={activeRole.party}
                  onClose={close}
                  onAmend={() => { /* Phase 6 wires up amendment flow */ }}
                  onViewDisclosureAgreement={swapToDisclosure}
                />
              )}
            </div>
          )
        })()}

        {/* V2.2 Phase 7 — Directory Layer (spec §8). Separate canvas layer
            reached via the Radiant Network button in the chrome. Always
            mounted in V2.2 mode; internal `phase` state controls visibility
            so the reverse wipe can play. */}
        {(
          <DirectoryLayer
            open={v22DirectoryOpen}
            activeParty={activeRole.party}
            onOpenAIShopper={() => setV22AIShopperOpen(true)}
            onClose={() => setV22DirectoryOpen(false)}
          />
        )}

        {/* V2.2 Phase 7 — AI Shopper modal (spec §9). Opens either from the
            chrome icon (user had no Directory context in mind) or from within
            the Directory Layer (user already browsing). */}
        {v22AIShopperOpen && (() => {
          const shared = buildV22SharedArtifacts()
          const publicDas = shared.disclosureAgreements.filter(
            (d) => d.grantee?.party === 'Radiant Network' && d.subject?.kind === 'claim',
          )
          const publicClaims = publicDas
            .map((d) => {
              const claim = shared.claims.find((c) => c.id === d.subject.id)
              if (!claim) return null
              return {
                id: claim.id,
                name: claim.name,
                pin: claim.pin,
                owner: claim.owner,
                publishedDisclosureType: d.type,
              }
            })
            .filter(Boolean)
          return (
            <AIShopperModal
              availableRequirementsSets={requirementSets.map((rs) => ({
                id: rs.id, name: rs.name, version: rs.version ?? 1,
              }))}
              publicClaims={publicClaims}
              onRequestAgreement={({ claimPin, suggestedRequirementsSetId }) => {
                // Story 2 step 5 → 6: close shopper/directory, open the
                // CombinedRequestModal with PIN + Req Set pre-populated, then
                // Phase 4's Request flow takes over and Story 1 resumes.
                setV22AIShopperResult({ claimPin, suggestedRequirementsSetId })
                setV22AIShopperOpen(false)
                setV22DirectoryOpen(false)
                setV22RequestAnchor(null)
                setV22RequestOpen(true)
              }}
              onClose={() => setV22AIShopperOpen(false)}
            />
          )
        })()}

        {/* V2.2 Combined Request Modal */}
        {v22RequestOpen && (
          <CombinedRequestModal
            requesterParty={activeRole.party}
            requesterAsset={
              // Phase 6 carry-over #2: the modal's "anchor" must be whatever
              // Asset the user clicked. Fall back to the first owned Asset only
              // when launched from the always-on banner button or the AI
              // Shopper result flow (no specific anchor in either case).
              v22RequestAnchor
              || v22Data?.nodes.find(n => n.v22Type === 'ASSET' && n.owner === activeRole.party)
              || null
            }
            availableRequirementsSets={requirementSets.map(rs => ({ id: rs.id, name: rs.name, version: rs.version ?? 1 }))}
            resolveClaimByPin={(pin) => resolveClaimByPinInShared(pin, v22Provisionals)}
            onSubmit={(payload) => {
              handleV22RequestSubmit(payload)
              setV22AIShopperResult(null)
            }}
            onClose={() => { setV22RequestOpen(false); setV22AIShopperResult(null) }}
            // Phase 7: AI Shopper pre-populates PIN + suggested Req Set.
            initialPin={v22AIShopperResult?.claimPin || ''}
            initialRequirementsSetIds={
              v22AIShopperResult?.suggestedRequirementsSetId
                ? [v22AIShopperResult.suggestedRequirementsSetId]
                : []
            }
          />
        )}

        {/* V2.2 Combined Response Modal — opens via the DA panel when a provisional request is selected. */}
        {v22RespondingTo && (() => {
          const da = v22Provisionals.disclosureAgreements.find(d => d.id === v22RespondingTo.daId)
          if (!da) return null
          const claim = v22View?.claims.find(c => c.id === da.subject.id)
          if (!claim) return null
          // Alice's Assets referenced by this Claim, and her Parse Results on them.
          const referencedAssets = (v22View?.assets || [])
            .filter(a => claim.referencedAssetIds.includes(a.id))
            .map(a => ({ id: a.id, name: a.name }))
          const parseResultsForModal = (v22View?.parseResults || [])
            .filter(pr => claim.referencedAssetIds.includes(pr.sourceAssetId))
            .map(pr => ({
              id: pr.id,
              sourceAssetId: pr.sourceAssetId,
              templateName: pr.templateName,
              fields: pr.fields.map(f => ({ id: f.id, name: f.name })),
            }))
          // Phase 6 carry-over #7: Eval Results visible to the grantor for the
          // Proof-Only scope step. Pull from view.evaluationResults filtered to
          // this Claim (includes both grantor-owned and proof-of-eval-shared).
          const evalResultsForClaim = (v22View?.evaluationResults || [])
            .filter(er => er.claimId === claim.id)
          return (
            <CombinedResponseModal
              request={{
                claim,
                ownerParty: da.grantor.party,
                requesterParty: da.grantee.party,
                requesterAsset: da.granteeAssetId,
                message: da._requestMeta?.message || '',
                requestedRequirementsSetIds: da._requestMeta?.requestedRequirementsSetIds || [],
              }}
              referencedAssets={referencedAssets}
              parseResults={parseResultsForModal}
              evalResultsForClaim={evalResultsForClaim}
              onAccept={handleV22Accept}
              onDecline={handleV22Decline}
              onClose={() => setV22RespondingTo(null)}
            />
          )
        })()}

        {/* V2.2 Run Evaluation Modal */}
        {v22EvalContext && (() => {
          const claim = v22View?.claims.find(c => c.id === v22EvalContext.claimId)
          if (!claim) return null
          const isSelf = !!v22EvalContext.selfEvaluation
          const ea = isSelf
            ? null
            : v22View?.evaluationAgreements.find(e => e.id === v22EvalContext.evaluationAgreementId)
          if (!isSelf && !ea) return null
          // Evidence assets: for inter-party, the DA's scope.assetIds; for
          // self-eval, all of the Claim's referenced Assets.
          const da = ea ? v22View?.disclosureAgreements.find(d => d.id === ea.disclosureAgreementId) : null
          const scopeAssetIds = isSelf
            ? (claim.referencedAssetIds || [])
            : (da?.scope?.assetIds || claim.referencedAssetIds || [])
          // Phase 6.5 #5 (Option A): the in-scope Assets are legitimately
          // disclosed under this Agreement, but they aren't pulled onto Bob's
          // main canvas (counterparty Assets stay private per spec §6.4). For
          // the modal's evidence list we therefore resolve directly from the
          // shared artifact dataset (incl. provisionals). Phase 6.5 polish
          // backlog tracks Option B: bring disclosed Assets onto the grantee's
          // canvas when an active Agreement covers them.
          const sharedForEval = buildV22SharedArtifacts()
          const allAssetSources = [
            ...sharedForEval.assets,
            ...(v22View?.assets || []),
          ]
          const seenAssetIds = new Set()
          const evidenceAssets = scopeAssetIds
            .map(id => {
              if (seenAssetIds.has(id)) return null
              seenAssetIds.add(id)
              const asset = allAssetSources.find(a => a.id === id)
              return asset ? { id: asset.id, name: asset.name, file: asset.file } : null
            })
            .filter(Boolean)
          // Library is the requester's full library; the EA's suggested ids
          // surface as a "SUGGESTED" chip per spec §10.5 (advisory).
          return (
            <V22RunEvaluationModal
              evaluationAgreement={ea}
              claim={claim}
              evidenceAssets={evidenceAssets}
              availableRequirementsSets={requirementSets.map(rs => ({
                id: rs.id,
                name: rs.name,
                version: rs.version ?? 1,
                requirements: rs.requirements || [],
                claims: rs.claims || [],
              }))}
              priorActiveResult={
                // Phase 9A item 6: when Re-Evaluate is launched from an Eval
                // Result panel, the modal gets the prior result so review
                // rows pre-populate and supersede notice fires.
                v22EvalContext.priorActiveResultId
                  ? (v22View?.evaluationResults || []).find((er) => er.id === v22EvalContext.priorActiveResultId) || null
                  : null
              }
              lockedRequirementsSetId={v22EvalContext.lockedRequirementsSetId || null}
              existingEvalResults={
                // Phase 6.5+ #6: feed the modal the eval results already on
                // this Claim so it can detect exact (Req Set, evidence) duplicates.
                // Phase 9A: exclude the prior result we're re-evaluating
                // against — otherwise "same Req Set, same evidence"
                // triggers a false duplicate-block on first render.
                (v22View?.evaluationResults || [])
                  .filter(er => er.claimId === claim.id && er.status !== 'superseded')
                  .filter(er => er.id !== v22EvalContext.priorActiveResultId)
              }
              onJumpToExistingEvalResult={(evalResultId) => {
                setV22EvalContext(null)
                setSel(evalResultId)
                setV22PanToClaimId(evalResultId)
              }}
              selfEvaluation={isSelf}
              onSubmit={handleV22EvaluationSubmit}
              onClose={() => setV22EvalContext(null)}
            />
          )
        })()}

        {/* V2.2 Amend Claim Modal */}
        {v22AmendingClaimId && (() => {
          // Look up the latest version of the Claim (could be in provisionals).
          const claim = v22View?.claims.find(c => c.id === v22AmendingClaimId)
          if (!claim) return null
          const ownedAssetIds = new Set([...v22View.ownedAssetIds])
          const alreadyReferenced = new Set(claim.referencedAssetIds || [])
          const candidateAssets = (v22View?.assets || [])
            .filter(a => ownedAssetIds.has(a.id) && !alreadyReferenced.has(a.id))
            .map(a => ({ id: a.id, name: a.name, file: a.file }))
          // Phase 6.5 #9: pass already-referenced Assets so the modal renders
          // them as read-only cards instead of a "{N} Assets already referenced"
          // text box.
          const alreadyReferencedAssets = (v22View?.assets || [])
            .filter(a => alreadyReferenced.has(a.id))
            .map(a => ({ id: a.id, name: a.name, file: a.file }))
          return (
            <AmendClaimModal
              activeParty={activeRole.party}
              claim={claim}
              candidateAssets={candidateAssets}
              alreadyReferencedAssets={alreadyReferencedAssets}
              onSubmit={handleV22AmendClaimSubmit}
              onNestedAssetCreated={handleV22NestedAssetCreated}
              onClose={() => setV22AmendingClaimId(null)}
            />
          )
        })()}

        {/* V2.2 Amend Disclosure Modal */}
        {v22AmendingDaId && (() => {
          const da = v22View?.disclosureAgreements.find(d => d.id === v22AmendingDaId)
          if (!da) return null
          const claim = v22View?.claims.find(c => c.id === da.subject.id)
          // Build candidate lists for whichever scope dimension this DA uses.
          const candidateAssets = (v22View?.assets || [])
            .filter(a => (claim?.referencedAssetIds || []).includes(a.id))
            .map(a => ({ id: a.id, name: a.name, file: a.file }))
          const candidateFields = (v22View?.parseResults || [])
            .filter(pr => (claim?.referencedAssetIds || []).includes(pr.sourceAssetId))
            .flatMap(pr => pr.fields.map(f => ({
              key: `${pr.id}::${f.id}`,
              label: f.name,
              parseTemplateName: pr.templateName,
            })))
          const candidateEvalResults = (v22View?.evaluationResults || [])
            .filter(er => er.claimId === da.subject.id)
            .map(er => ({ id: er.id, name: er.requirementsSet?.name || er.id }))
          // §11.2: items already evaluated (referenced by an active eval result)
          // cannot be removed. Compute lock sets per scope dimension.
          const evaluatedAssets = new Set(
            (v22View?.evaluationResults || [])
              .filter(er => er.claimId === da.subject.id && er.status !== 'superseded')
              .flatMap(er => er.evidenceUsed || []),
          )
          const evaluatedFields = new Set() // V2.1 evals don't track field provenance; safe to leave empty for Phase 6
          const evaluatedEvals = new Set(
            (v22View?.evaluationResults || [])
              .filter(er => er.claimId === da.subject.id && er.status !== 'superseded')
              .map(er => er.id),
          )
          return (
            <AmendDisclosureModal
              agreement={da}
              candidateAssets={candidateAssets}
              candidateFields={candidateFields}
              candidateEvalResults={candidateEvalResults}
              lockedAssetIds={Array.from(evaluatedAssets).filter(id => (da.scope?.assetIds || []).includes(id))}
              lockedFieldIds={Array.from(evaluatedFields)}
              lockedEvalResultIds={Array.from(evaluatedEvals).filter(id => (da.scope?.evaluationResultIds || []).includes(id))}
              onSubmit={handleV22AmendDisclosureSubmit}
              onClose={() => setV22AmendingDaId(null)}
            />
          )
        })()}

        {/* V2.2 Parse Evidence modal (Phase 8) — opens from the Asset panel's
            "Parse Evidence" footer action for the Asset's owner. */}
        {v22ParsingAsset && (() => {
          const existingParseResultTemplateIds = new Set(
            (v22View?.parseResults || [])
              .filter((pr) => pr.sourceAssetId === v22ParsingAsset.id)
              .map((pr) => pr.templateId),
          )
          return (
            <V22ParseEvidenceModal
              sourceAsset={{
                id: v22ParsingAsset.id,
                name: v22ParsingAsset.name,
                owner: v22ParsingAsset.owner,
                ownerDot: v22ParsingAsset.dot,
              }}
              availableTemplates={pepTemplates}
              existingParseResultIds={existingParseResultTemplateIds}
              onSubmit={handleV22ParseSubmit}
              onClose={() => setV22ParsingAsset(null)}
            />
          )
        })()}

        {/* V2.2 Create Asset modal (Phase 9A.3) — opens from the Actor
            panel/card action bar's "Register Asset" action for the active
            party. Also opens nested from Create Claim's inline CTA; that
            path is handled by V22CreateClaimModal itself passing
            `handleV22NestedAssetCreated` through. */}
        {v22RegisteringAsset && (
          <V22CreateAssetModal
            activeParty={activeRole.party}
            onClose={() => setV22RegisteringAsset(null)}
            onComplete={handleV22CreateAssetSubmit}
          />
        )}

        {/* V2.2 Create Claim modal (Phase 9A.3) — opens from an Asset's
            panel/card "Create Claim" action. `initialAssetIds` pre-selects
            the triggering Asset so the user lands on a valid selection. */}
        {v22CreatingClaim && (() => {
          const ownedAssets = (v22View?.assets || [])
            .filter(a => v22View.ownedAssetIds.has(a.id))
            .map(a => ({ id: a.id, name: a.name, file: a.file }))
          return (
            <V22CreateClaimModal
              activeParty={activeRole.party}
              ownedAssets={ownedAssets}
              initialAssetIds={v22CreatingClaim.initialAssetIds || []}
              onClose={() => setV22CreatingClaim(null)}
              onComplete={handleV22CreateClaimSubmit}
              onNestedAssetCreated={handleV22NestedAssetCreated}
            />
          )
        })()}

        {/* V2.2 Transfer Asset modal (Phase 9A.4 Gate B) — opens from the
            Asset panel/card Transfer action. Sender picks a recipient by
            PIN; submit creates a provisional transfer + v22-transfer-request
            notification on the recipient's inbox. */}
        {v22TransferringAsset && (
          <V22TransferAssetModal
            activeParty={activeRole.party}
            asset={v22TransferringAsset}
            onClose={() => setV22TransferringAsset(null)}
            onComplete={handleV22TransferSubmit}
          />
        )}

        {/* Detail Panel overlay — route V2.2 nodes to V22NodeDetailPanel.
            Phase 9A.3: ACTOR nodes now render the panel too (V22ActorPanel)
            so the owner can surface Register Asset from the footer.
            Radiant Network is excluded — it's not a party the user acts as. */}
        {sel && nodeMap[sel]?.v22Type && !nodeMap[sel].isNetworkNode && (() => {
          const node = nodeMap[sel]
          // Phase 6.5 #16: for non-owner viewers (e.g., Bob viewing Alice's
          // Claim), resolve referenced Asset names from the shared dataset
          // limited to those legitimately in scope under an active DA. Owner
          // viewers see all referenced Assets (they own them).
          const sharedForPanel = buildV22SharedArtifacts()
          const isOwnerViewing = node.v22Type === 'CLAIM' && node.owner === activeRole.party
          let referencedAssetNames = []
          if (node.v22Artifact?.referencedAssetIds) {
            const refIds = node.v22Artifact.referencedAssetIds
            if (isOwnerViewing) {
              referencedAssetNames = refIds.map(id => {
                const a = nodeMap[id] || sharedForPanel.assets.find(x => x.id === id)
                return a ? { id: a.id, name: a.name } : null
              }).filter(Boolean)
            } else {
              // Build the union of in-scope Asset ids across all visible active
              // DAs on this Claim where the active actor is grantee.
              const inScope = new Set()
              for (const da of (v22View?.disclosureAgreements || [])) {
                if (da.subject?.id !== node.id) continue
                if (da.grantee.party !== activeRole.party) continue
                if (da.type === 'provisional' || da._declineMeta) continue
                if (Array.isArray(da.scope?.assetIds)) {
                  for (const id of da.scope.assetIds) inScope.add(id)
                }
              }
              referencedAssetNames = refIds
                .filter(id => inScope.has(id))
                .map(id => {
                  const a = nodeMap[id] || sharedForPanel.assets.find(x => x.id === id)
                  return a ? { id: a.id, name: a.name } : null
                })
                .filter(Boolean)
            }
          }
          const evaluationResultsForClaim = (v22View?.evaluationResults || []).filter(e => e.claimId === node.id)
          const parseResultsForAsset = (v22View?.parseResults || []).filter(p => p.sourceAssetId === node.id)
          // EA the active actor can use to evaluate this Claim:
          const evaluationAgreementForActor = (v22View?.evaluationAgreements || []).find(e =>
            e.claimId === node.id &&
            e.grantee.party === activeRole.party &&
            e.status === 'active' &&
            (v22Provisionals.disclosureAgreements.find(d => d.id === e.disclosureAgreementId)?.type !== 'provisional')
          ) || (v22View?.evaluationAgreements || []).find(e =>
            e.claimId === node.id && e.grantee.party === activeRole.party && e.status === 'active'
          )
          const sourceAsset = node.v22Artifact?.sourceAssetId
            ? (v22View?.assets || []).find(a => a.id === node.v22Artifact.sourceAssetId)
            : null
          return (
            <div style={{
              position: 'absolute', top: 0, right: 0, bottom: 0,
              width: 480, zIndex: 200,
              animation: 'detail-panel-slide-in 200ms ease',
            }}>
              <V22NodeDetailPanel
                node={node}
                activeParty={activeRole.party}
                onClose={handleCloseSel}
                // Actor actions (Phase 9A.3)
                onRegisterAsset={node.v22Type === 'ACTOR' && node.name === activeRole.party && !node.isNetworkNode
                  ? () => setV22RegisteringAsset({ source: 'actor' })
                  : undefined}
                ownedAssetCount={node.v22Type === 'ACTOR'
                  ? (v22View?.assets || []).filter(a => a.owner === node.name).length
                  : 0}
                // Asset actions
                onRequestAgreement={() => { setV22RequestAnchor(node); setV22RequestOpen(true) }}
                onCreateClaim={node.v22Type === 'ASSET' && node.owner === activeRole.party
                  ? () => setV22CreatingClaim({ initialAssetIds: [node.id] })
                  : undefined}
                onParseEvidence={node.owner === activeRole.party && node.v22Type === 'ASSET'
                  ? () => setV22ParsingAsset(node)
                  : undefined}
                onTransferAsset={node.v22Type === 'ASSET' && node.owner === activeRole.party && !node._pendingTransfer
                  ? () => setV22TransferringAsset(node.v22Artifact || node)
                  : undefined}
                onCancelTransfer={node.v22Type === 'ASSET' && node.owner === activeRole.party && node._pendingTransfer
                  ? () => handleV22CancelTransfer(node.id)
                  : undefined}
                parseResultsForAsset={parseResultsForAsset}
                // Claim actions
                referencedAssetNames={referencedAssetNames}
                evaluationResultsForClaim={evaluationResultsForClaim}
                evaluationAgreementForActor={evaluationAgreementForActor && evaluationAgreementForActor.disclosureAgreementId &&
                  (() => {
                    const da = v22View?.disclosureAgreements.find(d => d.id === evaluationAgreementForActor.disclosureAgreementId)
                    return da && da.type !== 'provisional' ? evaluationAgreementForActor : null
                  })()}
                onRespondToRequest={() => {
                  // Find the provisional DA for this claim to start the response flow.
                  const provDa = (v22View?.disclosureAgreements || []).find(d =>
                    d.subject.id === node.id && d.type === 'provisional' &&
                    d.grantor.party === activeRole.party,
                  )
                  if (provDa) setV22RespondingTo({ daId: provDa.id })
                }}
                onCancelRequest={() => handleV22CancelRequest(node.id)}
                onDismissDeclined={() => handleV22DismissDeclined(node.id)}
                onRunEvaluation={() => handleV22OpenRunEvaluation(evaluationAgreementForActor)}
                onAmendClaim={node.owner === activeRole.party && node.v22Type === 'CLAIM' ? () => setV22AmendingClaimId(node.id) : undefined}
                onSelfEvaluate={node.owner === activeRole.party && node.v22Type === 'CLAIM' ? () => handleV22OpenSelfEvaluation(node.v22Artifact) : undefined}
                // Parse Result actions
                sourceAsset={sourceAsset}
                // Eval Result actions — Phase 9A item 6: Re-Evaluate locks
                // the Req Set to the one the prior result used, and passes
                // the prior result so the review rows pre-populate.
                onReRunEvaluation={() => {
                  const er = node.v22Artifact
                  if (!er) return
                  const ea = (v22View?.evaluationAgreements || []).find(e => e.id === er.evaluationAgreementId)
                  setV22EvalContext({
                    evaluationAgreementId: ea ? ea.id : null,
                    claimId: er.claimId,
                    selfEvaluation: !ea,
                    lockedRequirementsSetId: er.requirementsSet?.id || null,
                    priorActiveResultId: er.id,
                  })
                }}
              />
            </div>
          )
        })()}

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
        <div
          ref={footerTipRef}
          onMouseEnter={() => setShowFooterTip(true)}
          onMouseLeave={() => setShowFooterTip(false)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'help' }}
        >
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--accent-green, #22c55e)', flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 11,
            color: 'var(--accent-green, #22c55e)', letterSpacing: '0.04em',
          }}>
            Connected to AWS S3
          </span>
        </div>
        <span
          onClick={() => setShowChangelog(true)}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'var(--text-dim)', cursor: 'pointer',
            transition: 'color 150ms',
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-dim)'}
        >
          v0.4.0 &middot; Changelog
        </span>
      </div>
      {showFooterTip && footerTipRef.current && createPortal(
        <div style={{
          position: 'fixed',
          left: footerTipRef.current.getBoundingClientRect().left,
          top: footerTipRef.current.getBoundingClientRect().top - 48,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '6px 12px',
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--text-secondary)',
          zIndex: 99999,
          pointerEvents: 'none',
          boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}>
          {`s3://${activeRole.party.toLowerCase().replace(/\s+/g, '-')}-qualified-storage · Connected · All evidence files are hashed and endorsed on the ledger`}
        </div>,
        document.body
      )}

      {showChangelog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 10000,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowChangelog(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: 560, maxHeight: '80vh', background: 'var(--bg-surface)',
            border: '1px solid var(--border)', borderRadius: 10,
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Prototype Changelog</div>
                <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)', marginTop: 2 }}>Radiant V2 — PCN Prototyping</div>
              </div>
              <span onClick={() => setShowChangelog(false)} style={{ fontSize: 16, color: 'var(--text-dim)', cursor: 'pointer', padding: '4px 8px' }}>&#10005;</span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '18px 24px' }}>
              {[
                { version: '0.8.0', date: '2026-04-12', label: 'Round 12', items: [
                  'V2.1 Claims Migration — nodes are now Claims backed by evidence, replacing the old asset/container model',
                  'Category-free node cards — removed category icons, labels, and color tinting from all LOD levels',
                  'Unified two-tab Detail Panel (Overview + Artifact) replacing five separate rendering branches',
                  'Overview tab: Provenance, Disclosures, and Children sections with clickable navigation',
                  'Artifact tab: schema-specific content with evidence refs, parsed fields, eval claims, and artifact URIs',
                  'Create Claim modal — name + evidence from Qualified Storage picker, replaces Register Asset',
                  'New Claims connect to initiating node with full disclosure edge and reciprocal SDAs',
                  'Disclosure rows navigate to connected nodes — click any disclosure to select + pan',
                  'Minibar redesign — full-width health bar, no tallies, improved spacing',
                  'Ownership-based footer actions — owner sees Create Claim, Parse, Evaluate, Disclose; non-owner sees Evaluate only',
                  'Static data enrichment — artifact URIs, evidence file references, complete SDA wiring on all demo nodes',
                  'Connect Asset modal "Register New Asset" renamed to "Create Claim" with updated copy',
                ]},
                { version: '0.7.0', date: '2026-04-02', label: 'Round 11', items: [
                  'Requirements set publishing — publish standards to Radiant Network with confirmation flow',
                  'Published standards visible to connected parties in Requirements Library + Run Evaluation',
                  'Two-section eval picker: Your Standards + Published Standards with globe badges',
                  'Published standards panel anchored to bottom of library left panel with expand/collapse',
                  'Red border on cards with unsatisfactory claims (displayHealth.bad > 0)',
                  'NEW badge on recently created nodes in detail panel header',
                  'Pre-select satisfactory for high-confidence (>=90%) claims in eval review',
                  'Confidence percentage hidden for proof-only disclosure evaluations',
                  'Amend Evaluation hidden for proof-only evals',
                  'Version badge on eval review right panel header',
                  'Dimmed card opacity raised from 0.18 to 0.35 for legibility',
                  'Edge draw animation starts 50ms after creation (overlaps with pan)',
                  'Boot screen lightning: slower bolts, 500ms fade-in, 800ms hold, gentler rhythm',
                  'Dark mode date input styling (inverted calendar icon + color-scheme)',
                  'Escape key handling in Requirements + PEP Library modals (capture phase)',
                ]},
                { version: '0.6.0', date: '2026-04-01', label: 'Round 10', items: [
                  'PEP Template Library — two-panel modal with search, versioning, create/edit, CSV import',
                  'Per-org PEP templates with lineage versioning (parallels Requirements Library)',
                  'Parse Evidence modal uses per-org templates with lineage dedup',
                  'Open PEP Library link from all-templates-used warning',
                  'Credit cost updated to 10 per field',
                ]},
                { version: '0.5.0', date: '2026-04-01', label: 'Round 10', items: [
                  'Evaluation lineage gating — blocks duplicate evals per requirement set, auto-supersedes on version upgrade',
                  'Evidence evaluated section on eval node detail panel with resolved filenames',
                  'UTC timestamps on all node types — evidence, parse, evaluation, and disclosure cards',
                  'Evaluator org name replaces person name throughout eval panels',
                  'Eval description moved to PanelShell header with inline timestamp',
                  'Parse/evidence summaries now include creation date and UTC time',
                  'Disclosure panels show UTC times on Created/Expires rows',
                  'Streamlined disclosure cards — removed redundant Evidence, Fields, and PINs rows',
                  'Self-contained EvalClaimsSection with its own expand-to-modal',
                  'Backdrop portal fix — modals now render above canvas tooltips',
                  'Ownership guard on Amend Evaluation button (evaluatorParty check)',
                  'Boot screen login with CAC credentials and lightning animation',
                  'Cross-role evaluation sync with notification badges',
                  'Multi-evidence preview in eval review — stacked PDF viewers with collapsible headers',
                  'Parsed fields enriched with source evidence info and grouped by origin',
                  'Body font-family rule ensures portaled content inherits correct font',
                ]},
                { version: '0.4.0', date: '2026-03-31', label: 'Round 9', items: [
                  'Multi-evidence evaluation — run evals from asset level with evidence selection',
                  'Evaluation amendment — amend existing evals with new evidence, preserving SAT claims',
                  'Superseded eval chain — old evals marked SUPERSEDED with version badges and lineage edges',
                  'Evidence selection in Publish to Directory modal',
                  'Three-tier child layout — evidence, parse, evaluation rows with collision avoidance',
                  'Amend Evaluation button on eval node cards and inside EvalPanel',
                  'Footer button reorder — Run Eval on assets, Amend on evals, no View Chain in child layer',
                  'No-evidence/unparsed messaging in Run Evaluation modal',
                  'Light mode redesign — neutral grey palette, darker borders/text, desaturated SDA edges',
                  'Surface transition fix — anchor card fade-in replaces FLIP animation',
                  'Amend SDA auto-expands revised card in Disclosures tab',
                  'PRESERVED badge + before/after comparison in amend confirmation',
                ]},
                { version: '0.3.0', date: '2026-03-30', label: 'Round 8', items: [
                  'Evidence selection step — scope which evidence to include in any disclosure type',
                  'Proof-only evaluation selection — choose which eval results to share',
                  'Amend SDA modal — add evidence and fields to existing disclosures with locked/unlocked UI',
                  'Disclosed evidence and fields tables inside each SDA card',
                  'Grantor/grantee labeling on SDAs (Disclosure to / Disclosed by / Internal / Directory)',
                  'View evidence button in Disclosures tab — dives to child layer',
                  'Surface-before-navigate — notification clicks auto-surface from child layer',
                  'Prototype changelog modal',
                ]},
                { version: '0.2.0', date: '2026-03-29', label: 'Round 7', items: [
                  'Animated pan + zoom on disclosure creation and acceptance',
                  'Progressive edge draw animation for new connections',
                  'Qualified Storage file picker with S3 bucket browser and preview pane',
                  'Hash and Endorse animation in Add Evidence modal',
                  'Provisional card reveal animation (zoom, border wipe, flip, badge)',
                  'Publish to Radiant Network Public Directory with selective field scrollboxes',
                  'Proof-of-evaluation display for proof-only disclosures',
                  'Revision notifications with cross-role sync',
                  'Footer portal tooltip for QS indicator',
                ]},
                { version: '0.1.0', date: '2026-03-28', label: 'Rounds 5-6', items: [
                  'Unified ClaimsTable component (3-line rows with proofOnly mode)',
                  'Expand-to-modal + CSV download on all data tables',
                  'Bidirectional PEP layout in child layer',
                  'Subchain view with lateral streak transitions',
                  'Chevron size normalization, emoji removal (all SVG icons)',
                  'Revoke warning redesign with contextual messages',
                  'Requirements Library search match highlighting',
                ]},
                { version: '0.0.1', date: '2026-03-15', label: 'Rounds 1-4', items: [
                  'Two-layer graph with parent + child architecture',
                  'Five disclosure types: Full, Selective, Proof-only, Cascade, Provisional',
                  'AI-powered evaluation with human review',
                  'PEP parse with template selection',
                  'Requirements Library with search and versioning',
                  'Create Claims (single + bulk CSV)',
                  'Role switching between Bob@GovCo and Alice@MicroCo',
                ]},
              ].map(release => (
                <div key={release.version} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <span style={{
                      fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700,
                      color: 'var(--accent-indigo)', padding: '2px 8px', borderRadius: 4,
                      background: 'color-mix(in srgb, var(--accent-indigo) 10%, transparent)',
                    }}>v{release.version}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{release.label}</span>
                    <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-dim)' }}>{release.date}</span>
                  </div>
                  {release.items.map((item, ii) => (
                    <div key={ii} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8,
                      padding: '3px 0', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                    }}>
                      <span style={{ color: 'var(--text-dim)', flexShrink: 0, marginTop: 2 }}>&middot;</span>
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SubgraphModal — disabled, replaced by subchain canvas view */}
      {/* {modalNode && (
        <V2SubgraphModal node={modalNode} onClose={handleCloseModal} />
      )} */}

      {/* Library modals — Requirements Sets + PEP Templates. Reachable from
          the chrome icons and from the V2.2 Amend / Eval flows. */}
      {(showLibrary || showPEPLibrary) && (
        <Backdrop onClose={() => {
          if (showLibrary) { setShowLibrary(false); setLibraryInitialSetId(null) }
          else if (showPEPLibrary) setShowPEPLibrary(false)
        }}>
          {showLibrary && (
            <RequirementsLibraryModal
              requirementSets={requirementSets}
              onClose={() => { setShowLibrary(false); setLibraryInitialSetId(null) }}
              onSave={handleSaveRequirementSet}
              onPublish={handlePublishRequirementSet}
              publishedSets={publishedRequirementSets}
              initialSelectedId={libraryInitialSetId}
              _noBackdrop
            />
          )}
          {showPEPLibrary && (
            <PEPLibraryModal
              pepTemplates={pepTemplates}
              onClose={() => setShowPEPLibrary(false)}
              onSave={handleSavePEPTemplate}
              _noBackdrop
            />
          )}
        </Backdrop>
      )}
    </div>
  )
}
