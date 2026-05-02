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
  makeAmendedEvaluationAgreement, diffAcknowledgments,
  makeParseRunArtifacts,
  makeAssetRegistrationArtifacts, makeClaimCreationArtifacts,
  makeTransferRecord, makeAsset, makeDotObject,
  makeInternalDisclosureAgreement,
  makeRevocationRecord,
  buildV22SharedArtifacts, mergeProvisionals,
  // Phase 11B: synthetic-node helper used by the directory cluster-click
  // flow so V22NodeDetailPanel can render for a Claim that lives only on
  // the directory layer (no parent-canvas node present).
  buildClaimNodeForDirectoryMaterialization,
  // Phase 11C: warm-path EA-only request factories.
  makeProvisionalEvaluationAgreement, finalizeProvisionalEvaluationAgreement,
} from './v2_2Data.js'
import EdgeHoverMenu from './EdgeHoverMenu.jsx'
import DisclosureAgreementDetailPanel from '../components/DetailPanel/DisclosureAgreementDetailPanel.jsx'
import EvaluationAgreementDetailPanel from '../components/DetailPanel/EvaluationAgreementDetailPanel.jsx'
import V22NodeDetailPanel from '../components/DetailPanel/V22NodeDetailPanel.jsx'
import CombinedRequestModal from '../components/modals/CombinedRequestModal.jsx'
import EARequestModal from '../components/modals/EARequestModal.jsx'
import AIShopperModal from '../components/modals/AIShopperModal.jsx'
import DirectoryLayer from './DirectoryLayer.jsx'
import Tooltip from '../components/Tooltip.jsx'
import V22ParseEvidenceModal from '../components/modals/V22ParseEvidenceModal.jsx'
import CombinedResponseModal from '../components/modals/CombinedResponseModal.jsx'
import V22RunEvaluationModal from '../components/modals/V22RunEvaluationModal.jsx'
import V22CreateAssetModal from '../components/modals/V22CreateAssetModal.jsx'
import V22CreateClaimModal from '../components/modals/V22CreateClaimModal.jsx'
import V22TransferAssetModal from '../components/modals/V22TransferAssetModal.jsx'
import V22TransferResponseModal from '../components/modals/V22TransferResponseModal.jsx'
import V22RevocationConfirmModal from '../components/modals/V22RevocationConfirmModal.jsx'
// Phase 9D.1.4 Fix 2: confirmation modal for orphaned-Eval-Result Dismiss.
// Replaces the prior window.confirm dialog.
import V22DismissEvalResultModal from '../components/modals/V22DismissEvalResultModal.jsx'
// Phase 11B: restored Detail Panel "expand" modal for Assets / Parse Results
// / Eval Results — port of the V2/V2.1 pattern that was lost in the V2.2
// retreat. Two tabs (Output / JSON); Output uses iframe-based file viewer
// for Assets when `file.localPath` is set.
import ExpandedArtifactModal from '../components/modals/ExpandedArtifactModal.jsx'
// Phase 9D.2 (#124): unravel animation primitive for nodes leaving the canvas.
import { playUnravelAnimation } from './animations/unravel.js'
// Phase 11C.3 W3: reveal animation primitive — migrated out of inline
// V2App.jsx so it parallels the unravel primitive's organization.
import { playRevealAnimation } from './animations/reveal.js'
// Phase 9D.1: V22RevocationNoticeModal is no longer mounted — notification
// click now routes into the Detail Panel. File kept as dead code pending the
// #50 dead-handler sweep. Import removed to keep the V2App surface clean.
// import V22RevocationNoticeModal from '../components/modals/V22RevocationNoticeModal.jsx'
import AmendClaimModal from '../components/modals/AmendClaimModal.jsx'
import AmendDisclosureModal from '../components/modals/AmendDisclosureModal.jsx'
import AmendEvaluationAgreementModal from '../components/modals/AmendEvaluationAgreementModal.jsx'
// Phase 10.3: unified Library modal replaces RequirementsLibraryModal +
// PEPLibraryModal. The two legacy files are retained as embeddable panels
// (consumed by LibraryModal in `embedded` mode); their default-export
// standalone forms are no longer mounted from V2App.
import LibraryModal from '../components/modals/LibraryModal.jsx'
import { Backdrop } from '../components/modals/ModalShared.jsx'
import { getRequirementSetsForRole } from './requirementSets.js'
import { getPEPTemplatesForRole } from './pepTemplates.js'

const SESSION_KEY = 'radiant-v2-booted'
// Phase 9A.6 Gate A (#65): credit cost constants for unilateral Register +
// Claim flows. Other V2.2 flows (ParseEvidence, RunEvaluation, CombinedRequest)
// remain free per the client model — only Registering + Claiming are charged.
const CREDITS_PER_ASSET = 5
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
    // Phase 9D (#112): revocation ledger records. Shape per makeRevocationRecord.
    // Appended on every DA / EA / Eval Result revocation (including cascaded).
    // Agreements themselves are either annotated with `_revokedMeta` (grantor-
    // initiated DA path, retained on canvas for grantee's REVOKED badge until
    // Dismiss) or dropped from state outright (all other revocation paths).
    revocationRecords: [],
  })
  // V2.2 modal state
  const [v22RequestOpen, setV22RequestOpen] = useState(false)
  const [v22RequestAnchor, setV22RequestAnchor] = useState(null) // Asset node passed when launched from per-Asset entry
  const [v22RespondingTo, setV22RespondingTo] = useState(null) // { daId }
  const [v22EvalContext, setV22EvalContext] = useState(null) // { evaluationAgreementId|null, claimId, selfEvaluation?, lockedRequirementsSetId?, priorActiveResultId? }
  const [v22AmendingClaimId, setV22AmendingClaimId] = useState(null) // claim id being amended
  const [v22AmendingDaId, setV22AmendingDaId] = useState(null) // disclosure agreement id being amended
  // Phase 11E.1 (#108): evaluation agreement id being amended via the new
  // AmendEvaluationAgreementModal flow.
  const [v22AmendingEaId, setV22AmendingEaId] = useState(null)
  const [v22RecentlyAcceptedClaimId, setV22RecentlyAcceptedClaimId] = useState(null) // drives _isNew + _wasProvisional
  // Phase 11C.5 W1: separate state var for the reveal-window-only
  // `_showAsProvisional` stamp on the recently-accepted Claim and its
  // incident edges. Cleared by `playRevealAnimation`'s onDone callback at
  // phase 'done' — _decoupled_ from `v22RecentlyAcceptedClaimId` (which is
  // cleared by the deselect-aware effect at line 2141 so the NEW badge
  // persists until the user moves selection off the node).
  const [v22RevealActiveClaimId, setV22RevealActiveClaimId] = useState(null)
  // Phase 9A.6.1 Fix 1: holds null, a single id, or an array of ids. Array
  // form supports multi-file Asset registration where all N new Assets need
  // the NEW badge. Consumers normalise via `toIdArray(...)` below.
  const [v22RecentlyAcceptedAssetId, setV22RecentlyAcceptedAssetId] = useState(null)
  const [v22PanToClaimId, setV22PanToClaimId] = useState(null) // drives pan-to-node on creation/accept
  // V2.2 Phase 7 — Directory Layer + AI Shopper (spec §8 / §9)
  const [v22DirectoryOpen, setV22DirectoryOpen] = useState(false)
  // Phase 11B: when the user clicks the ChipCo cluster in the Directory,
  // we materialize one of ChipCo's Claims as a card on top of the cluster
  // and open the Detail Panel for it. Shape: { claim, anchor: { xPct, yPct } }
  // or null. Cleared when the panel closes or the Directory closes.
  const [v22DirectoryMaterializedClaim, setV22DirectoryMaterializedClaim] = useState(null)
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
  // Phase 9D (#112): revocation modal state.
  //   v22Revoking — shape: { agreementType: 'DA' | 'EA', agreementId, counterpartyParty, subjectName, cascadeInfo }
  //     opened by Revoke label in Agreements section; closed by Cancel / Confirm.
  // Phase 9D.1: revocation notification-click no longer opens a modal. For the
  // grantee-side (revoked-Claim) path the REVOKED Detail Panel state handles
  // the ceremony via `_revokedMeta`. For the grantor-side (no revoked artifact
  // on canvas) path we thread the clicked notification into a panel-top
  // RevocationNoticeSection that renders on the standard Claim panel.
  //   v22ActiveRevocationNotice — shape: { notification, targetClaimId, kind: 'DA' | 'EA' }
  //     cleared on Dismiss (inside the notice section) or on role switch.
  const [v22Revoking, setV22Revoking] = useState(null)
  const [v22ActiveRevocationNotice, setV22ActiveRevocationNotice] = useState(null)
  // Phase 9D.1.4 Fix 2: orphaned Eval Result Dismiss confirmation modal.
  // Holds the ER artifact (or null) — when set, V22DismissEvalResultModal
  // renders. Confirm calls handleV22DismissOrphanedEvalResult; Cancel just
  // clears the state.
  const [v22DismissingEvalResult, setV22DismissingEvalResult] = useState(null)
  // Phase 11B: Detail Panel "expand" modal — set to { artifact, schema } to
  // open; cleared on close. Schemas: 'asset' | 'parse-output' | 'eval-output'.
  const [v22ExpandedArtifact, setV22ExpandedArtifact] = useState(null)
  // Phase 11C — warm-path EA request modal state.
  //   v22EaRequestContext shape: { claim, ownerParty, existingDisclosureAgreementId, requesterAsset }
  // Set when the user clicks "Request Evaluation Agreement" on a Claim with
  // an active DA but no EA (footer button or canvas action bar). Cleared
  // when the modal submits or closes.
  const [v22EaRequestContext, setV22EaRequestContext] = useState(null)
  // Phase 11C — EA-only response modal state. Mirrors v22RespondingTo but
  // for the warm-path notification path. Shape: { eaId } where eaId is the
  // provisional EA the grantor is responding to.
  const [v22RespondingToEaOnly, setV22RespondingToEaOnly] = useState(null)
  // Phase 11B.1: Esc closes the directory-materialized Detail Panel when
  // it's open AND no modal is sitting on top of it. The ExpandedArtifactModal
  // has its own Esc handler; we defer to it via a state check rather than
  // event-ordering tricks (both listeners would fire on the same Esc
  // otherwise, dismissing two layers at once).
  useEffect(() => {
    if (!v22DirectoryMaterializedClaim) return
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return
      if (v22ExpandedArtifact) return // let the modal's Esc handler close it first
      setV22DirectoryMaterializedClaim(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [v22DirectoryMaterializedClaim, v22ExpandedArtifact])
  // Phase 9D.2 (#124): node id currently running the unravel keyframe.
  // Set by playUnravelAnimation right before its CSS stage; cleared when
  // the primitive resolves. AssetNode reads `_unraveling` (stamped via
  // v22DataWithReveal) to apply the `node-unravel` keyframe.
  const [v22UnravelingNodeId, setV22UnravelingNodeId] = useState(null)

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
  const [edgeMenu, setEdgeMenu] = useState(null) // { edgeId, anchor: { x, y }, worldX, worldY }
  // Phase 9B §2/§3: hover state for the cursor-following rich menu tooltip.
  // Separate from edgeMenu so selection-pinned state doesn't race with hover.
  const [edgeHover, setEdgeHover] = useState(null) // { edgeId, sdaType, x, y } | null
  // Phase 9B.2 Fix 3: tooltip fade-during-animation (replaces 9B.1 RAF
  // world-space tracking, which drifted and appeared over nodes during
  // zoom). While the pan/zoom framing is running, the tooltip is hidden;
  // on animation complete it reprojects to the new screen-space position
  // of its world-space click point and fades back in.
  const [edgeMenuPanning, setEdgeMenuPanning] = useState(false)
  const [openAgreement, setOpenAgreement] = useState(null) // { kind: 'disclosure'|'evaluation', edgeId }

  const v22DataWithReveal = useMemo(() => {
    if (!v22Data) return v22Data
    // Phase 9A.6.1 Fix 1: v22RecentlyAcceptedAssetId may be a single id OR an
    // array of ids (multi-file registration). Flatten into the flagged set so
    // every newly-created Asset gets the _isNew reveal, not just the first.
    const assetReveal = Array.isArray(v22RecentlyAcceptedAssetId)
      ? v22RecentlyAcceptedAssetId
      : v22RecentlyAcceptedAssetId ? [v22RecentlyAcceptedAssetId] : []
    const flagged = new Set([v22RecentlyAcceptedClaimId, ...assetReveal].filter(Boolean))
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
        if (ea.grantee?.party === activeRole.party && ea.claimId && !ea._provisional) {
          eaByClaimForActor[ea.claimId] = ea
        }
      }
    }
    // Phase 11C: detect Claims where the active actor has an active DA but
    // no EA. The action-bar "Request Evaluation Agreement" CTA renders for
    // these Claims. We only need a Set of claim ids — the modal context is
    // derived in V2App when the user clicks the button.
    const claimsWithActiveDaWithoutEa = new Set()
    if (v22View) {
      const grantedActiveDaClaims = new Set()
      for (const da of (v22View.disclosureAgreements || [])) {
        if (da.subject?.kind !== 'claim') continue
        if (da.grantee?.party !== activeRole.party) continue
        if (da.type === 'provisional' || da._declineMeta || da._revokedMeta) continue
        grantedActiveDaClaims.add(da.subject.id)
      }
      for (const claimId of grantedActiveDaClaims) {
        if (!eaByClaimForActor[claimId]) claimsWithActiveDaWithoutEa.add(claimId)
      }
    }
    // Phase 9D.2 (#124): unravel-flag stamping. Only one node animates at a
    // time (the dismiss flow is serial via modal). The id flows through
    // node._unraveling, which AssetNode reads to apply the CSS keyframe.
    const unravelingId = v22UnravelingNodeId
    const anyDecoration = flagged.size > 0 || endpointSet.size > 0
      || Object.keys(eaByClaimForActor).length > 0
      || claimsWithActiveDaWithoutEa.size > 0
      || unravelingId != null
    if (!anyDecoration) return v22Data
    const nodes = v22Data.nodes.map(n => {
      const needsReveal = flagged.has(n.id)
      const isEndpoint = endpointSet.has(n.id)
      const eaForClaim = n.v22Type === 'CLAIM' ? eaByClaimForActor[n.id] : null
      const hasActiveDaWithoutEa = n.v22Type === 'CLAIM' && claimsWithActiveDaWithoutEa.has(n.id)
      const isUnraveling = unravelingId === n.id
      // Phase 11C.2 W1: stamp `_wasProvisional` ONLY on the recently-accepted
      // Claim id (not on accompanying Asset reveal ids). The notification-click
      // handler reads this flag to decide whether to fire `startReveal` (the
      // V2.1 flip-from-provisional → active animation) instead of the simple
      // animated pan. The flag was dead infrastructure since the V2.1 → V2.2
      // migration retreat — the accept reveal animation hasn't fired since.
      const justFinalizedClaim = needsReveal && n.id === v22RecentlyAcceptedClaimId
      // Phase 11C.5 W1: `_showAsProvisional` is now gated on a separate
      // `v22RevealActiveClaimId` state so it can clear at reveal phase
      // 'done' independently of `_isNew + _wasProvisional` (which persist
      // until the user deselects). Without this decoupling, the 11C.3
      // onDone callback over-cleared and dropped the NEW badge / orange
      // tint at ~2.5s instead of letting them persist until deselect.
      const isInRevealWindow = n.id === v22RevealActiveClaimId
      // Phase 11D #118: skip the NEW badge for Asset reveals where the
      // Asset is owned by the active party. The cold-path / warm-path
      // acceptance handlers stamp `v22RecentlyAcceptedAssetId` with the
      // requester's anchor Asset (e.g., Bob's Avionics Module) so the
      // grantor's view of the newly-pulled-in counterparty Asset gets a
      // NEW badge (Phase 6.5 #4). The same id leaks to the requester's
      // session via shared V2App state — on the requester's view the
      // anchor is their own pre-existing Asset, and showing NEW there is
      // a stale signal. Filtering on owner discriminates: counterparty
      // pull-in (NEW correct) vs. own pre-existing (skip).
      //
      // Trade-off acknowledged: this also skips the NEW badge on
      // freshly-registered Assets and transfer-accepted Assets (both end
      // up owned by the active party). Those paths still get pan-to and
      // selection via `v22PanToClaimId` + `setSel`, so the user still
      // sees the new Asset highlighted — just without the orange tint.
      // Per-role reveal-id scoping (filed as future polish #138 audit
      // scope) would preserve NEW on those paths without leaking
      // cross-session stamps from the acceptance handlers.
      const skipNewBadge = needsReveal && n.v22Type === 'ASSET' && n.owner === activeRole.party
      if (!needsReveal && !isEndpoint && !eaForClaim && !hasActiveDaWithoutEa && !isUnraveling && !isInRevealWindow) return n
      return {
        ...n,
        ...(needsReveal && !skipNewBadge ? { _isNew: true } : {}),
        // _wasProvisional rides along with _isNew (drives the
        // notification-click reveal-trigger guard at V2App:3221 + the
        // warm-path equivalent at V2App:3308).
        ...(justFinalizedClaim ? { _wasProvisional: true } : {}),
        // _showAsProvisional drives AssetNode's dashed/dimmed render
        // during the reveal animation window. Cleared at phase 'done'.
        ...(isInRevealWindow ? { _showAsProvisional: true } : {}),
        ...(isEndpoint ? {
          _isEdgeEndpoint: true,
          _edgeEndpointSide: endpointSideById[n.id] || 'right',
        } : {}),
        ...(eaForClaim ? { _evaluationAgreementForActor: eaForClaim } : {}),
        ...(hasActiveDaWithoutEa ? { _hasActiveDaWithoutEa: true } : {}),
        ...(isUnraveling ? { _unraveling: true } : {}),
      }
    })
    const nodeMap = {}
    for (const n of nodes) nodeMap[n.id] = n
    // Phase 11C.4 W1 + 11C.5 W1: stamp `_showAsProvisional: true` on edges
    // incident to the recently-accepted Claim so V2Canvas renders them
    // dashed during the reveal window. V2Canvas already reads this flag at
    // line ~863 — its `effectiveSdaType` collapses to `'provisional'` when
    // set, pulling the dashed line config. Gated on `v22RevealActiveClaimId`
    // (separate from `v22RecentlyAcceptedClaimId`) so the dashed→solid
    // edge transition happens at reveal phase 'done' regardless of whether
    // the user has deselected the Claim yet.
    let edges = v22Data.edges
    if (v22RevealActiveClaimId) {
      const claimId = v22RevealActiveClaimId
      edges = v22Data.edges.map((e) => (
        (e.from === claimId || e.to === claimId)
          ? { ...e, _showAsProvisional: true }
          : e
      ))
    }
    return { ...v22Data, nodes, edges, nodeMap }
  }, [v22Data, v22RecentlyAcceptedClaimId, v22RevealActiveClaimId, v22RecentlyAcceptedAssetId, selectedEdgeId, v22View, activeRole.party, v22UnravelingNodeId])

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
    const { claim, ownerParty, selectedRequirementsSetIds, message, acknowledgmentsAccepted } = payload
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
      // Phase 11C.1: ids of the Claim's acknowledgments the requester checked
      // at submission. Audit trail; rides through finalize onto the active EA.
      acknowledgmentsAccepted: acknowledgmentsAccepted || [],
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

  const handleV22Accept = useCallback(({ type, scope, daTerms, eaTerms }) => {
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
      // Phase 11E.1.6 Fix 2: forward daTerms so the DA's expiration is
      // independent of the EA's evaluationDeadline. Pre-fix the finalize
      // helper coerced both to `eaTerms.expires`.
      const finalized = finalizeProvisionalAgreementPair({
        provisionalDa, provisionalEa,
        type, scope, daTerms, eaTerms,
      })
      finalized.disclosureAgreement._requestMeta = provisionalDa._requestMeta
      claimIdForReveal = provisionalDa.subject.id
      requesterPartyForNotif = provisionalDa.grantee.party
      anchorIdForNotif = provisionalDa.granteeAssetId
      // Phase 9A.6.2.1 #103 fix: merge provisionals so user-created Claims
      // (via V22CreateClaimModal) resolve their name/pin for the acceptance
      // notification. Seeded-only lookup missed them.
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), prev).claims.find((c) => c.id === provisionalDa.subject.id)
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
      // Phase 9A.6.2.1 #103 fix: merge provisionals for user-created Claim
      // name/pin resolution on decline notifications (mirror of accept path).
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), prev).claims.find((c) => c.id === provisionalDa.subject.id)
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

  // Phase 11D #136: Cancel Request handler — covers cold path (provisional
  // DA + EA pair) AND warm path (provisional EA only, referencing an
  // existing active DA). Plays the unravel animation on the Claim node
  // before dropping state, mirroring the dismiss-declined pattern. Also
  // dismisses any pending notification on the responder's inbox so they
  // don't see a request that no longer exists.
  const handleV22CancelRequest = useCallback(async (claimId) => {
    if (!claimId) return
    // Resolve the provisional artifacts up front so we know what to
    // dismiss on the responder side BEFORE the state mutation.
    const snapshot = v22Provisionals
    const provisionalDa = snapshot.disclosureAgreements.find(
      (d) => d.subject?.id === claimId && d.type === 'provisional' && d.grantee?.party === activeRole.party,
    )
    const warmPathProvisionalEa = !provisionalDa
      ? snapshot.evaluationAgreements.find(
        (e) => e.claimId === claimId && e._provisional && e.grantee?.party === activeRole.party,
      )
      : null
    const responderParty = provisionalDa
      ? provisionalDa.grantor.party
      : warmPathProvisionalEa?.grantor.party || null
    const responderRole = responderParty ? ROLES.find((r) => r.party === responderParty) : null
    const notificationIdToDismiss = provisionalDa
      ? `v22-request-${provisionalDa.id}`
      : warmPathProvisionalEa
        ? `v22-request-ea-only-${warmPathProvisionalEa.id}`
        : null

    // Play unravel animation BEFORE dropping state — same pattern as
    // handleV22DismissDeclined / handleV22DismissRevoked. setSel(null)
    // first so the selection border doesn't compete with border erasure.
    setSel(null)
    await playUnravelAnimation({
      nodeId: claimId,
      canvasRef,
      setUnravelingNodeId: setV22UnravelingNodeId,
      waitForPanelClose: true,
    })

    // Drop the provisional artifacts.
    setV22Provisionals((prev) => {
      if (provisionalDa) {
        const pairedEa = prev.evaluationAgreements.find((e) => e.disclosureAgreementId === provisionalDa.id)
        return {
          ...prev,
          disclosureAgreements: prev.disclosureAgreements.filter((d) => d.id !== provisionalDa.id),
          evaluationAgreements: pairedEa
            ? prev.evaluationAgreements.filter((e) => e.id !== pairedEa.id)
            : prev.evaluationAgreements,
        }
      }
      if (warmPathProvisionalEa) {
        return {
          ...prev,
          evaluationAgreements: prev.evaluationAgreements.filter((e) => e.id !== warmPathProvisionalEa.id),
        }
      }
      return prev
    })

    // Dismiss the responder's pending request notification so they don't
    // see a request that no longer exists.
    if (responderRole && notificationIdToDismiss) {
      updateRoleState(responderRole.id, (prev) => ({
        ...prev,
        dismissedReqs: [...(prev.dismissedReqs || []), notificationIdToDismiss],
      }))
    }
  }, [activeRole.party, v22Provisionals, updateRoleState])

  const handleV22DismissDeclined = useCallback(async (claimId) => {
    if (!claimId) return
    // Phase 11C.1 W10: play the unravel animation BEFORE dropping state, so
    // declined Claims (cold or warm path) leave the canvas with the same
    // visual ceremony revoked Claims get. Mirrors handleV22DismissRevoked
    // above. setSel(null) MUST happen before playUnravel so the selection
    // border doesn't compete with the border-erasure stage. The primitive
    // gracefully no-ops on nodes that aren't on canvas.
    setSel(null)
    await playUnravelAnimation({
      nodeId: claimId,
      canvasRef,
      setUnravelingNodeId: setV22UnravelingNodeId,
      waitForPanelClose: true,
    })
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
      // Phase 11C: also drop any EA-only declined provisional EAs on this
      // Claim (warm-path decline path). The DA is unchanged in that case —
      // it stays active.
      const matchingEaOnlyIds = new Set(
        prev.evaluationAgreements
          .filter((e) => e.claimId === claimId && e._declineMeta && e.grantee?.party === activeRole.party)
          .map((e) => e.id),
      )
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.filter((d) => !matchingDaIds.has(d.id)),
        evaluationAgreements: prev.evaluationAgreements.filter((e) => !matchingEaIds.has(e.id) && !matchingEaOnlyIds.has(e.id)),
        declineRecords: prev.declineRecords.filter(
          (r) => !(r.claimId === claimId && r.requesterParty === activeRole.party),
        ),
      }
    })
  }, [activeRole.party])

  // ── Phase 11C: warm-path EA-only flow handlers ──────────────────────
  // The cold path (handleV22RequestSubmit / handleV22Accept / handleV22Decline /
  // handleV22CancelRequest) creates a provisional DA + EA pair. The warm path
  // creates only a provisional EA referencing an existing active DA.

  const handleV22EaRequestSubmit = useCallback((payload) => {
    const { claim, ownerParty, existingDisclosureAgreementId, requesterAsset, selectedRequirementsSetIds, message, acknowledgmentsAccepted } = payload
    if (!claim || !ownerParty || !existingDisclosureAgreementId) return
    const { evaluationAgreement } = makeProvisionalEvaluationAgreement({
      requesterParty: activeRole.party,
      requesterDot: activeRole.partyDot,
      requesterAssetId: requesterAsset?.id || null,
      ownerParty,
      claimId: claim.id,
      existingDisclosureAgreementId,
      requestedRequirementsSetIds: selectedRequirementsSetIds || [],
      message,
      // Phase 11C.1: ids of the Claim's acknowledgments the requester
      // checked at submission. Audit trail; rides through finalize.
      acknowledgmentsAccepted: acknowledgmentsAccepted || [],
    })
    // Annotate request meta for the response modal's requester display.
    evaluationAgreement._requestMeta = {
      ...(evaluationAgreement._requestMeta || {}),
      requesterParty: activeRole.party,
      requesterAssetName: requesterAsset?.name || null,
      message: message || '',
    }
    setV22Provisionals((prev) => ({
      ...prev,
      evaluationAgreements: [...prev.evaluationAgreements, evaluationAgreement],
    }))
    setV22EaRequestContext(null)
    // Pan/select the now-provisional Claim so the requester sees their action.
    setSel(claim.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(claim.id)
    setV22RecentlyAcceptedClaimId(claim.id)
    // Notify the grantor.
    const grantorRole = ROLES.find((r) => r.party === ownerParty)
    if (grantorRole) {
      enqueueV22NotificationForRequester(grantorRole.id, {
        id: `v22-request-ea-only-${evaluationAgreement.id}`,
        type: 'v22-request-ea-only',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: claim.name, pin: claim.pin },
        connectTo: { id: requesterAsset?.id || null, pin: null },
        v22EaId: evaluationAgreement.id,
        message: message || '',
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  const handleV22AcceptEAOnly = useCallback(({ eaTerms }) => {
    if (!v22RespondingToEaOnly) return
    const eaId = v22RespondingToEaOnly.eaId
    let claimIdForReveal = null
    let requesterPartyForNotif = null
    let claimNameForNotif = null
    let claimPinForNotif = null
    let anchorIdForNotif = null

    setV22Provisionals((prev) => {
      const provisionalEa = prev.evaluationAgreements.find((e) => e.id === eaId)
      if (!provisionalEa || !provisionalEa._provisional) return prev
      const finalized = finalizeProvisionalEvaluationAgreement({ provisionalEa, eaTerms })
      // Preserve _requestMeta for any post-mortem / panel display, but clear
      // _provisional so the view layer treats it as active.
      finalized._requestMeta = provisionalEa._requestMeta
      claimIdForReveal = provisionalEa.claimId
      requesterPartyForNotif = provisionalEa.grantee.party
      anchorIdForNotif = provisionalEa.granteeAssetId
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), prev).claims.find((c) => c.id === provisionalEa.claimId)
      if (sharedClaim) {
        claimNameForNotif = sharedClaim.name
        claimPinForNotif = sharedClaim.pin
      }
      return {
        ...prev,
        evaluationAgreements: prev.evaluationAgreements.map((e) => e.id === eaId ? finalized : e),
      }
    })
    setV22RespondingToEaOnly(null)
    if (claimIdForReveal) {
      // Phase 11C.1 W8: mirror the cold-path acceptance reveal — set the
      // recently-accepted id (drives the `_isNew` reveal on the requester's
      // canvas via v22DataWithReveal stamping) AND set the pan-to id so
      // V2Canvas's selection-pan effect targets the now-active Claim when
      // the requester switches in.
      setV22RecentlyAcceptedClaimId(claimIdForReveal)
      setV22PanToClaimId(claimIdForReveal)
    }
    // Phase 11C.1 W9: when Dave accepts, Bob's anchor Asset becomes pulled-in
    // on Dave's canvas. Set the recently-accepted Asset id + pan-to so Dave
    // sees the new node materialize with reveal animation, and pan/zoom to
    // the just-pulled-in Asset just like the cold-path Phase 6.5 #4 fix.
    if (anchorIdForNotif) {
      setV22RecentlyAcceptedAssetId(anchorIdForNotif)
      setSel(anchorIdForNotif)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(anchorIdForNotif)
    }
    // Dismiss the original v22-request-ea-only notification on this grantor's
    // inbox now that the request has been resolved.
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-request-ea-only-${eaId}`],
    }))
    if (requesterPartyForNotif && claimPinForNotif) {
      const requesterRole = ROLES.find((r) => r.party === requesterPartyForNotif)
      if (requesterRole) {
        enqueueV22NotificationForRequester(requesterRole.id, {
          id: `v22-ea-accepted-${eaId}-${Date.now().toString(36)}`,
          type: 'v22-ea-accepted',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: { id: anchorIdForNotif, pin: null },
          claimId: claimIdForReveal,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22RespondingToEaOnly, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

  const handleV22DeclineEAOnly = useCallback(({ reason } = {}) => {
    if (!v22RespondingToEaOnly) return
    const eaId = v22RespondingToEaOnly.eaId
    let claimNameForNotif = null
    let claimPinForNotif = null
    let requesterPartyForNotif = null
    let claimIdForNotif = null

    setV22Provisionals((prev) => {
      const provisionalEa = prev.evaluationAgreements.find((e) => e.id === eaId)
      if (!provisionalEa) return prev
      requesterPartyForNotif = provisionalEa.grantee.party
      claimIdForNotif = provisionalEa.claimId
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), prev).claims.find((c) => c.id === provisionalEa.claimId)
      if (sharedClaim) {
        claimNameForNotif = sharedClaim.name
        claimPinForNotif = sharedClaim.pin
      }
      // Annotate the EA as declined so the requester's canvas keeps the Claim
      // in the declined-state until they Dismiss (mirroring the cold-path
      // _declineMeta retention pattern from Phase 6.5 #3).
      const annotatedEa = {
        ...provisionalEa,
        _declineMeta: {
          reason: (reason || '').trim(),
          declinedDate: new Date().toISOString(),
        },
      }
      return {
        ...prev,
        evaluationAgreements: prev.evaluationAgreements.map((e) => e.id === eaId ? annotatedEa : e),
      }
    })
    setV22RespondingToEaOnly(null)
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-request-ea-only-${eaId}`],
    }))
    if (requesterPartyForNotif && claimPinForNotif) {
      const requesterRole = ROLES.find((r) => r.party === requesterPartyForNotif)
      if (requesterRole) {
        enqueueV22NotificationForRequester(requesterRole.id, {
          id: `v22-ea-declined-${eaId}-${Date.now().toString(36)}`,
          type: 'v22-ea-declined',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          claimId: claimIdForNotif,
          reason: (reason || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22RespondingToEaOnly, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

  // ─────────────────────────────────────────────────────────────────────
  // Phase 9D (#112) — Revocation handlers
  // ─────────────────────────────────────────────────────────────────────
  //
  // Four revocation paths: {DA | EA} × {grantor-initiated | grantee-initiated}.
  //
  // Grantor-initiated DA revocation is the only path that retains `_revokedMeta`
  // on the annotated artifacts so the grantee's canvas can render a REVOKED
  // badge + Dismiss CTA. The other three paths drop state immediately — the
  // counterparty gets an informational notification and a Notice-modal entry
  // point; no canvas retention UI.
  //
  // DA cascade: grantor DA revocation annotates the paired EA and all of the
  // grantee's Eval Results on the grantor's Claim. The Confirm modal surfaces
  // the cascade list before commit; the Notice modal surfaces it again on the
  // grantee side for context. Proof-of-Evaluation DAs are non-revocable by
  // design — guard here no-ops with a console.warn if invoked.
  //
  // EA-only revocation is standalone — no DA change, no Eval Result cascade.

  // Helper: find paired EA for a DA (same disclosureAgreementId back-reference).
  const findPairedEa = useCallback((daId, shared) => {
    return shared.evaluationAgreements.find((e) => e.disclosureAgreementId === daId) || null
  }, [])

  // Helper: find grantee's Eval Results on a grantor's Claim produced under
  // a specific EA (cascade scope for DA revocation).
  const findCascadedEvalResults = useCallback((eaId, claimId, granteePartyName, shared) => {
    if (!eaId || !claimId || !granteePartyName) return []
    return shared.evaluationResults.filter((er) =>
      er.claimId === claimId
      && er.owner === granteePartyName
      && er.evaluationAgreementId === eaId
      && !er._revokedMeta,
    )
  }, [])

  // Build the cascade summary the Confirm modal displays before commit.
  // Returns { willRevokeEa, evalResultCount, evalResultNames: [] } for DAs;
  // null for EAs (EA revocation doesn't cascade).
  const buildCascadeInfo = useCallback((agreement, agreementType) => {
    // Phase 9D.1.3 Fix 6: Eval Results no longer cascade on revocation.
    // The Confirm modal's Cascade block only lists the paired EA (if any).
    // evalResultCount always 0; evalResultNames always empty array —
    // preserved in the return shape so the Confirm modal doesn't need to
    // handle a schema change.
    if (agreementType !== 'DA') return { willRevokeEa: false, evalResultCount: 0, evalResultNames: [] }
    const shared = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const pairedEa = findPairedEa(agreement.id, shared)
    if (!pairedEa) return { willRevokeEa: false, evalResultCount: 0, evalResultNames: [] }
    return {
      willRevokeEa: true,
      evalResultCount: 0,
      evalResultNames: [],
    }
  }, [v22Provisionals, findPairedEa])

  // Open the Confirm modal for a given agreement + type. Wired by
  // V22NodeDetailPanel's Agreements Section Revoke action.
  const handleOpenRevocationConfirm = useCallback((agreement, agreementType) => {
    if (agreementType === 'DA' && agreement.subject?.kind === 'evalResult') {
      // Proof-of-Evaluation DAs are non-revocable by design. 9C hides the
      // Revoke label on these rows; this guard is defensive against future
      // dispatch drift.
      console.warn('[Phase 9D] Proof-of-Evaluation DAs are non-revocable; ignoring revocation request.')
      return
    }
    const counterpartyParty = agreement.grantor.party === activeRole.party
      ? agreement.grantee.party
      : agreement.grantor.party
    const shared = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    // Subject name for display. DAs subject out to claim / asset / parse /
    // evalResult; EAs claimId always.
    let subjectName = null
    if (agreementType === 'DA') {
      const { kind, id } = agreement.subject || {}
      if (kind === 'claim') subjectName = shared.claims.find((c) => c.id === id)?.name
      else if (kind === 'asset') subjectName = shared.assets.find((a) => a.id === id)?.name
      else if (kind === 'parseResult') subjectName = shared.parseResults.find((p) => p.id === id)?.templateName
    } else {
      subjectName = shared.claims.find((c) => c.id === agreement.claimId)?.name
    }
    setV22Revoking({
      agreement,
      agreementType,
      counterpartyParty,
      subjectName,
      cascadeInfo: buildCascadeInfo(agreement, agreementType),
    })
  }, [activeRole.party, v22Provisionals, buildCascadeInfo])

  // Commit handler — fires when user confirms in V22RevocationConfirmModal.
  // Branches on agreementType + grantor-vs-grantee to select the state path.
  const handleRevokeConfirm = useCallback((reason) => {
    if (!v22Revoking) return
    const { agreement, agreementType } = v22Revoking
    const timestamp = new Date().toISOString()
    const isGrantor = agreement.grantor.party === activeRole.party
    const counterpartyParty = isGrantor ? agreement.grantee.party : agreement.grantor.party
    const counterpartyRole = ROLES.find((r) => r.party === counterpartyParty)

    // Resolve data for notification payloads synchronously BEFORE the setState
    // updater — React defers updaters and we'd miss cascade details if we read
    // inside them (Phase 6.5 #2 / 9A.5 Fix 1 lesson).
    const shared = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const claimId = agreementType === 'DA' ? agreement.subject?.id : agreement.claimId
    const claim = shared.claims.find((c) => c.id === claimId) || null
    const pairedEa = agreementType === 'DA' ? findPairedEa(agreement.id, shared) : null
    // Phase 9D.1.3 Fix 6: Eval Results are independent artifacts owned by the
    // grantee. Revoking an access agreement (DA or EA) does NOT terminate the
    // grantee's Eval Results — they persist in the grantee's QS and on their
    // canvas. If the grantee wants to tidy up orphaned Eval Results after a
    // revocation, they can Dismiss each one individually from its Detail
    // Panel (handleV22DismissOrphanedEvalResult).
    const cascadedErs = []

    setV22Provisionals((prev) => {
      // Merge-by-id semantics: for annotations (grantor-initiated DA), we
      // splice an annotated copy into the provisionals list so the mergeById
      // in mergeProvisionals overwrites the seeded original. For drops
      // (grantee-initiated, or EA-only), we push a "tombstone" annotated
      // copy with _revokedMeta so buildViewForActor filters it out.
      //
      // Historical records always persist — appended to revocationRecords.
      const nextRecords = [...(prev.revocationRecords || [])]
      const nextDas = [...prev.disclosureAgreements]
      const nextEas = [...prev.evaluationAgreements]

      const upsertDa = (daUpdated) => {
        const idx = nextDas.findIndex((d) => d.id === daUpdated.id)
        if (idx >= 0) nextDas[idx] = daUpdated
        else nextDas.push(daUpdated)
      }
      const upsertEa = (eaUpdated) => {
        const idx = nextEas.findIndex((e) => e.id === eaUpdated.id)
        if (idx >= 0) nextEas[idx] = eaUpdated
        else nextEas.push(eaUpdated)
      }
      // Phase 9D.1.3 Fix 6: upsertEr removed — Eval Results no longer cascade
      // on revocation.

      if (agreementType === 'DA') {
        // Annotate the primary DA.
        const annotated = {
          ...agreement,
          _revokedMeta: {
            reason: (reason || '').trim(),
            revokedDate: timestamp,
            revokerParty: activeRole.party,
            cascadedFromDaId: null,
          },
        }
        upsertDa(annotated)
        nextRecords.push(makeRevocationRecord({
          agreementType: 'DA',
          agreementId: agreement.id,
          revokerParty: activeRole.party,
          counterpartyParty,
          claimId,
          reason,
        }))
        // Cascade the paired EA (if any).
        if (pairedEa) {
          upsertEa({
            ...pairedEa,
            _revokedMeta: {
              reason: 'Cascaded from DA revocation',
              revokedDate: timestamp,
              revokerParty: activeRole.party,
              cascadedFromDaId: agreement.id,
            },
          })
          nextRecords.push(makeRevocationRecord({
            agreementType: 'EA',
            agreementId: pairedEa.id,
            revokerParty: activeRole.party,
            counterpartyParty,
            claimId,
            reason: 'Cascaded from DA revocation',
            cascadedFromDaId: agreement.id,
          }))
          // Phase 9D.1.4 Fix 1B: cascade-revoke any Proof-of-Evaluation DAs
          // whose subject is an Eval Result tied to this paired EA.
          //
          // The POE DA grants the Claim owner (Alice) visibility on the
          // grantee's (Bob's) Eval Result via `proofDaEvalResultIds` in
          // buildViewForActor. Without this cascade, Alice keeps POE
          // visibility into Bob's ER even though she's revoked his DA —
          // his orphaned ER lingers on her canvas.
          //
          // The Eval Results themselves still don't get _revokedMeta — they
          // remain Bob's artifacts in his QS (Fix 6 invariant). This step
          // only touches the access agreement (POE DA) so Alice's view
          // stops resolving them as visible.
          const erIdsUnderEa = (shared.evaluationResults || [])
            .filter((er) => er.evaluationAgreementId === pairedEa.id)
            .map((er) => er.id)
          if (erIdsUnderEa.length > 0) {
            // Phase 9D.1.6: discriminate external POE DAs (grantor !==
            // grantee, e.g. Bob → Alice) from internal ownership DAs
            // (grantor === grantee, e.g. Bob → Bob). Both share the same
            // (subject.kind === 'evalResult', subject.id === er.id) shape
            // so the prior filter caught both. Only the external POE DA
            // confers cross-party visibility and should cascade-revoke;
            // the internal ownership DA wires the ER to the evaluator's
            // own Asset on their own canvas (e.g. Bob's Avionics Module
            // ownership edge to his MIL-PRF-55681 Compliance ER) and
            // would orphan that edge if cascaded.
            const poeDas = (shared.disclosureAgreements || []).filter((d) =>
              d.subject?.kind === 'evalResult'
              && erIdsUnderEa.includes(d.subject.id)
              && d.grantor.party !== d.grantee.party
              && !d._revokedMeta,
            )
            for (const poe of poeDas) {
              upsertDa({
                ...poe,
                _revokedMeta: {
                  reason: 'Cascaded from DA revocation (POE)',
                  revokedDate: timestamp,
                  revokerParty: activeRole.party,
                  cascadedFromDaId: agreement.id,
                },
              })
              nextRecords.push(makeRevocationRecord({
                agreementType: 'DA',
                agreementId: poe.id,
                revokerParty: activeRole.party,
                counterpartyParty,
                claimId,
                reason: 'Cascaded from DA revocation (POE)',
                cascadedFromDaId: agreement.id,
              }))
            }
          }
        }
        // Phase 9D.1.3 Fix 6: Eval Results do NOT cascade-revoke. They are
        // independent artifacts the grantee owns in their QS; revoking an
        // access agreement doesn't terminate them. The grantee can Dismiss
        // orphaned Eval Results individually from each Eval Result Detail
        // Panel (swapped footer action surfaces when orphan state detected).
      } else {
        // EA revocation — no cascade. Annotate; buildViewForActor filters it
        // out of both parties' active lists.
        upsertEa({
          ...agreement,
          _revokedMeta: {
            reason: (reason || '').trim(),
            revokedDate: timestamp,
            revokerParty: activeRole.party,
            cascadedFromDaId: null,
          },
        })
        nextRecords.push(makeRevocationRecord({
          agreementType: 'EA',
          agreementId: agreement.id,
          revokerParty: activeRole.party,
          counterpartyParty,
          claimId,
          reason,
        }))
      }

      return {
        ...prev,
        disclosureAgreements: nextDas,
        evaluationAgreements: nextEas,
        // Phase 9D.1.3 Fix 6: evaluationResults not mutated by revocation.
        revocationRecords: nextRecords,
      }
    })

    // Enqueue the counterparty notification. Type branches on agreementType.
    if (counterpartyRole) {
      const notifId = agreementType === 'DA'
        ? `v22-da-revoked-${agreement.id}-${Date.now().toString(36)}`
        : `v22-ea-revoked-${agreement.id}-${Date.now().toString(36)}`
      enqueueV22NotificationForRequester(counterpartyRole.id, {
        id: notifId,
        type: agreementType === 'DA' ? 'v22-da-revoked' : 'v22-ea-revoked',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        claim: claim ? { name: claim.name, pin: claim.pin } : null,
        claimOwnerParty: agreement.grantor.party === activeRole.party
          ? activeRole.party
          : agreement.grantor.party,
        reason: (reason || '').trim(),
        claimId,
        agreementId: agreement.id,
        pairedEaId: pairedEa?.id || null,
        cascadeIncludesEa: agreementType === 'DA' && !!pairedEa,
        // Phase 9D.1.3 Fix 6: Eval Results no longer cascade. Kept in the
        // notification payload shape (always empty array) so downstream
        // consumers don't need a schema migration.
        cascadeIncludesEvalResults: [],
        cascadedFromDa: false,
        date: timestamp.slice(0, 10),
      })
    }

    // Clean up edge / agreement UI state so the revoked agreement's Detail
    // Panel + edge menu don't linger after commit.
    setV22Revoking(null)
    setOpenAgreement(null)
    setSelectedEdgeId(null)
    setEdgeMenu(null)
  }, [v22Revoking, v22Provisionals, activeRole.party, activeRole.partyDot, findPairedEa, findCascadedEvalResults, enqueueV22NotificationForRequester])

  // Dismiss handler for revoked claims (grantee side, grantor-initiated DA
  // path). Phase 9D.1.1 (#112 Fix 6): annotate dismissed items with
  // `_dismissedRevoked: true` rather than filtering them out of provisionals.
  // Rationale: filtering out a revoked provisional DA would let its seeded
  // (non-revoked) version reappear via `mergeProvisionals`'s mergeById —
  // the Claim would come back un-revoked. Annotation keeps the provisional
  // override in place (still shadowing the seeded row) while
  // `buildViewForActor` pre-filters all `_dismissedRevoked` items out of
  // every view-layer output. Audit records in `revocationRecords` are
  // unaffected.
  // Phase 9D.1.3 Fix 6 / 9D.1.4 Fix 1A: dismiss an orphaned Eval Result.
  // An Eval Result is orphaned when its originating EA has been revoked —
  // the artifact itself persists in the owner's QS but its edges to the
  // Claim are gone. Dismiss removes it from the owner's canvas view only.
  //
  // 9D.1.4 Fix 1A: accept the full ER artifact (not just the id) so we can
  // ANNOTATE the row even when it lives only in the seeded dataset and not
  // yet in `v22Provisionals.evaluationResults`. Previous version only
  // mapped over `prev.evaluationResults`; for seeded ERs (e.g., the demo
  // MIL-PRF-55681 result) the array contained no matching entry, the map
  // was a no-op, and the dismiss silently failed. With the cascade-removal
  // change in 9D.1.3, ERs no longer get an upstream `_revokedMeta` write
  // — the orphaned-dismiss path is now the only path that pushes them
  // into provisionals, so it must handle the append case.
  const handleV22DismissOrphanedEvalResult = useCallback(async (evalResultArtifact) => {
    if (!evalResultArtifact?.id) return
    const id = evalResultArtifact.id
    // Phase 9D.2.3 Fix 2: deselect + close Detail Panel BEFORE running the
    // unravel. The previous order (await unravel; then setSel(null)) left
    // the selection border + panel rendering throughout the unravel,
    // creating a visual conflict between the gray selection treatment and
    // the red revoked-border erasure. Now: deselect → primitive waits for
    // the panel slide-out via waitForPanelClose → unravel runs without
    // competing visual state. State mutation still moves to AFTER the
    // unravel so the view-builder filter doesn't drop the artifact while
    // it's still animating.
    setSel(null)
    await playUnravelAnimation({
      nodeId: id,
      canvasRef,
      setUnravelingNodeId: setV22UnravelingNodeId,
      waitForPanelClose: true,
    })
    setV22Provisionals((prev) => {
      const existingIdx = prev.evaluationResults.findIndex((er) => er.id === id)
      if (existingIdx >= 0) {
        return {
          ...prev,
          evaluationResults: prev.evaluationResults.map((er, i) =>
            i === existingIdx ? { ...er, _dismissedRevoked: true } : er,
          ),
        }
      }
      // Seeded-only ER — append a tombstone-annotated copy. mergeProvisionals
      // shadows the seeded row via mergeById; buildViewForActor's pre-filter
      // (9D.1.1 Fix 6) drops the dismissed row from every view output.
      return {
        ...prev,
        evaluationResults: [
          ...prev.evaluationResults,
          { ...evalResultArtifact, _dismissedRevoked: true },
        ],
      }
    })
  }, [])

  // Phase 9D.1.2 W1: EA-only revocation dismiss (Cases C/D). Unlike the
  // DA revocation path, this dismisses ONLY the one targeted EA — the
  // Claim and any DA remain untouched. Eval Results persist across EA
  // revocation by design (they're independent artifacts once created).
  // Annotation pattern matches the DA path (Phase 9D.1.1 Fix 6) so the
  // provisional override keeps shadowing the seeded row via mergeById.
  const handleV22DismissRevokedEa = useCallback((eaId) => {
    if (!eaId) return
    setV22Provisionals((prev) => ({
      ...prev,
      evaluationAgreements: prev.evaluationAgreements.map((e) =>
        e.id === eaId && e._revokedMeta
          ? { ...e, _dismissedRevoked: true }
          : e,
      ),
    }))
    setV22ActiveRevocationNotice(null)
  }, [])

  // Phase 9D.1.3 Fix 1: Case B inline-DA dismiss. Grantor clicked a
  // v22-da-revoked notification about a DA the grantee terminated.
  // Dismisses the DA (and its paired EA, which was cascade-revoked per
  // existing 9D logic). The Claim stays on the grantor's canvas — it's
  // their Claim. Eval Results are independent and also persist (the
  // grantee's orphaned ERs, if any, live on the grantee's side per
  // Fix 6). Annotation mechanic matches the grantee-side DA dismiss.
  const handleV22DismissRevokedDaGrantorSide = useCallback((daId) => {
    if (!daId) return
    setV22Provisionals((prev) => {
      // Find the paired EA (if any) so we can dismiss it alongside.
      const da = prev.disclosureAgreements.find((d) => d.id === daId)
      const pairedEaId = da && prev.evaluationAgreements
        .find((e) => e.disclosureAgreementId === daId && e._revokedMeta)?.id
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.map((d) =>
          d.id === daId && d._revokedMeta
            ? { ...d, _dismissedRevoked: true }
            : d,
        ),
        evaluationAgreements: prev.evaluationAgreements.map((e) =>
          pairedEaId && e.id === pairedEaId
            ? { ...e, _dismissedRevoked: true }
            : e,
        ),
      }
    })
    setV22ActiveRevocationNotice(null)
  }, [])

  const handleV22DismissRevoked = useCallback(async (claimId) => {
    if (!claimId) return
    // Phase 9D.2.3 Fix 2: deselect + close Detail Panel BEFORE running the
    // unravel. See handleV22DismissOrphanedEvalResult above for rationale —
    // selection state and red border erasure conflict visually.
    setSel(null)
    await playUnravelAnimation({
      nodeId: claimId,
      canvasRef,
      setUnravelingNodeId: setV22UnravelingNodeId,
      waitForPanelClose: true,
    })
    setV22Provisionals((prev) => {
      const revokedDaIds = new Set(
        prev.disclosureAgreements
          .filter((d) => d._revokedMeta && d.subject?.id === claimId && d.grantee.party === activeRole.party)
          .map((d) => d.id),
      )
      const revokedEaIds = new Set(
        prev.evaluationAgreements
          .filter((e) => e._revokedMeta && revokedDaIds.has(e.disclosureAgreementId))
          .map((e) => e.id),
      )
      return {
        ...prev,
        disclosureAgreements: prev.disclosureAgreements.map((d) =>
          revokedDaIds.has(d.id) ? { ...d, _dismissedRevoked: true } : d,
        ),
        evaluationAgreements: prev.evaluationAgreements.map((e) =>
          revokedEaIds.has(e.id) ? { ...e, _dismissedRevoked: true } : e,
        ),
        evaluationResults: prev.evaluationResults.map((er) =>
          (er._revokedMeta && er.claimId === claimId && er.owner === activeRole.party)
            ? { ...er, _dismissedRevoked: true }
            : er,
        ),
      }
    })
    // Phase 9D.2.3 Fix 2: setSel(null) moved to BEFORE playUnravelAnimation.
  }, [activeRole.party])

  const handleV22OpenRunEvaluation = useCallback((evaluationAgreement) => {
    if (!evaluationAgreement) return
    // Phase 11C (#115): demo-only EA expiry check. The Run Evaluation flow
    // refuses to open the modal when the EA's evaluationDeadline is in the
    // past. Production would have real time-based policy enforcement at the
    // platform layer; this in-memory check covers the prototype's demo flow.
    const deadline = evaluationAgreement.terms?.evaluationDeadline
    if (deadline && new Date(deadline).getTime() < Date.now()) {
      // eslint-disable-next-line no-alert
      alert(`This Evaluation Agreement expired on ${deadline.slice(0, 10)}. Request a new agreement to continue evaluating.`)
      return
    }
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
      // Phase 9A.6.2.1 #103 fix: merge provisionals for user-created Claim
      // name/pin resolution on eval-completed notification.
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals).claims.find((c) => c.id === claimId)
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
  // Phase 9A.6 Gate B (#66): multi-file Asset registration. Payload now
  // `{ files: [{ file, displayName, hash }] }`. Single-file remains the
  // N=1 special case — the legacy shape `{ file, displayName }` is still
  // accepted for callers that haven't migrated. Returns the first new
  // Asset id (legacy) or an array of ids when nested (for Claim/Amend
  // pickers that auto-select all N new Assets).
  const handleV22CreateAssetSubmit = useCallback((payload) => {
    if (!payload) return null
    const files = Array.isArray(payload.files)
      ? payload.files
      : payload.file
        ? [{ file: payload.file, displayName: payload.displayName, hash: payload.hash }]
        : []
    if (files.length === 0) return null
    const _nested = !!payload._nested
    // Phase 10.2: when registering a child Asset, the parent comes through on
    // the v22RegisteringAsset state. Validate before invoking the factory:
    // (1) parent must exist on the active actor's view, (2) parent must be
    // owned by the active party, (3) cycles forbidden (defensive — at
    // registration time the new id doesn't exist yet, so the chain from the
    // proposed parent back through ancestors must not loop). If any check
    // fails, throw — this should only fire under corrupted state since the UI
    // already gates the action on owner equality.
    const parentAssetId = v22RegisteringAsset?.parentAsset?.id || null
    if (parentAssetId) {
      const sharedAndProvisional = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
      const parent = sharedAndProvisional.assets.find(a => a.id === parentAssetId)
      if (!parent) throw new Error(`Parent Asset ${parentAssetId} not found`)
      if (parent.owner !== activeRole.party) {
        throw new Error('Cannot register child Asset under another party\'s Asset')
      }
      // Cycle prevention: walk the proposed parent's chain. If we revisit an
      // id we've already seen, the existing data is corrupted.
      const visited = new Set([parentAssetId])
      let cursor = parent.parentAssetId
      while (cursor) {
        if (visited.has(cursor)) throw new Error('Cycle detected in Asset hierarchy')
        visited.add(cursor)
        const next = sharedAndProvisional.assets.find(a => a.id === cursor)
        cursor = next?.parentAssetId || null
      }
    }
    const newAssets = []
    const newOwnershipDAs = []
    for (const row of files) {
      const fileWithHash = row.hash ? { ...row.file, hash: row.hash } : row.file
      const artifacts = makeAssetRegistrationArtifacts({
        ownerParty: activeRole.party,
        ownerDot: activeRole.partyDot,
        file: fileWithHash,
        name: row.displayName,
        parentAssetId,
      })
      newAssets.push(artifacts.asset)
      newOwnershipDAs.push(artifacts.ownershipDa)
    }
    setV22Provisionals((prev) => ({
      ...prev,
      assets: [...(prev.assets || []), ...newAssets],
      disclosureAgreements: [...prev.disclosureAgreements, ...newOwnershipDAs],
    }))
    // Phase 9A.6 Gate A (#65): debit per Asset. Math.max safety net.
    setCredits(c => Math.max(0, c - CREDITS_PER_ASSET * newAssets.length))
    setV22RegisteringAsset(null)
    const firstId = newAssets[0].id
    // Phase 9A.6.1 Fix 1: stamp ALL new Assets for the NEW badge reveal, not
    // just the first. Multi-file registrations were landing with only one
    // flagged — _isNew was derived off the single-id state.
    const newIds = newAssets.map(a => a.id)
    // Suppress pan when nested — user is still in a modal.
    if (!_nested) {
      setSel(firstId)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(firstId)
      setV22RecentlyAcceptedAssetId(newIds.length > 1 ? newIds : firstId)
    } else {
      // Nested flows still need the reveal flags even though pan-to is skipped
      // (the parent modal closes on its own and the revealed Assets should
      // light up when the user lands on the canvas).
      setV22RecentlyAcceptedAssetId(newIds.length > 1 ? newIds : firstId)
    }
    return newAssets.length > 1 ? newAssets.map(a => a.id) : firstId
  }, [activeRole.party, activeRole.partyDot, v22RegisteringAsset, v22Provisionals])

  // Phase 9A.3: V2.2 Claim creation. Produces a new Claim + Actor→Claim
  // ownership DA + one Claim→Asset internal DA per reference. Unilateral.
  // NEW badge + pan-to via the shared `_isNew` reveal path.
  const handleV22CreateClaimSubmit = useCallback(({ name, description, referencedAssetIds, acknowledgments }) => {
    if (!name || !name.trim() || !Array.isArray(referencedAssetIds) || referencedAssetIds.length === 0) {
      return null
    }
    const artifacts = makeClaimCreationArtifacts({
      ownerParty: activeRole.party,
      ownerDot: activeRole.partyDot,
      name,
      description,
      referencedAssetIds,
      // Phase 11C.1: pass through acknowledgments authored at creation time.
      acknowledgments: acknowledgments || [],
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
    // Phase 9A.6 Gate A (#65): debit credits on Claim creation. Gated by the
    // modal's submit button — Math.max mirrors the Asset handler's safety net.
    setCredits(c => Math.max(0, c - CREDITS_PER_CLAIM))
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
    // Phase 9A.5 #76: replace the Asset's ownership DA so grantor becomes the
    // recipient. Without this, `buildViewForActor` filters the seeded DA
    // (grantor = sender) out of the recipient's view and no Actor → Asset
    // ownership edge renders on the recipient's canvas.
    const replacementOwnershipDa = makeInternalDisclosureAgreement({
      id: `da-own-${assetForTransfer.id}`,
      owner: transfer.toParty,
      ownerDot: transfer.toOwnerDid,
      subject: { kind: 'asset', id: assetForTransfer.id },
      terms: { createdDate: acceptedTimestamp },
    })
    setV22Provisionals((prev) => ({
      ...prev,
      transfers: (prev.transfers || []).filter((t) => t.id !== notif.transferId),
      assets: [
        ...((prev.assets || []).filter((a) => a.id !== assetForTransfer.id)),
        transferredAsset,
      ],
      disclosureAgreements: [
        ...((prev.disclosureAgreements || []).filter((d) => d.id !== replacementOwnershipDa.id)),
        replacementOwnershipDa,
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

  const handleV22AmendDisclosureSubmit = useCallback(({ scope, terms, note }) => {
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
    // Phase 9A.6.2.1 #103 fix: merge provisionals for user-created Claim
    // name/pin resolution on amend-DA notification.
    const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals).claims.find((c) => c.id === existing.subject.id)
    const claimNameForNotif = sharedClaim?.name || null
    const claimPinForNotif = sharedClaim?.pin || null
    // Phase 11E.1.6 Fix 3: forward `terms.expires` so the factory can
    // record termsBefore in the amendment record and apply the new
    // expiration to the resulting DA. Older callers that omitted `terms`
    // get a no-op on expiration via the factory's default-preserve.
    const amended = makeAmendedDisclosureAgreement({ disclosureAgreement: existing, scope, terms, note })

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

  // Phase 11E.1 (#108): Amend Evaluation Agreement.
  // Unilateral — only the EA grantor (Claim owner) can amend. Updates
  // `terms.evaluationDeadline` on the EA and (Option B) mutates the
  // underlying Claim's `acknowledgments[]` directly. The EA's
  // `acknowledgmentsAccepted` audit trail is preserved (historical record
  // of what the Evaluator originally accepted at request time). A single
  // `v22-ea-amendment` notification fires to the EA's grantee. Multi-EA
  // implicit propagation when a Claim has EAs to multiple grantees is the
  // documented Option B limitation — see architecture-spec §11.2a.
  const handleV22AmendEvaluationSubmit = useCallback(({ terms, acknowledgments, note }) => {
    if (!v22AmendingEaId) return

    // Resolve existing EA + paired Claim.
    const seededEa = buildV22SharedArtifacts().evaluationAgreements.find((e) => e.id === v22AmendingEaId)
    const existingEa = v22Provisionals.evaluationAgreements?.find((e) => e.id === v22AmendingEaId) || seededEa
    if (!existingEa) return
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const existingClaim = merged.claims.find((c) => c.id === existingEa.claimId)
    if (!existingClaim) return

    // Compute the acknowledgment delta for the EA audit trail.
    const acknowledgmentChanges = diffAcknowledgments(
      existingClaim.acknowledgments || [],
      acknowledgments || [],
    )
    const acksDirty =
      acknowledgmentChanges.added.length > 0 ||
      acknowledgmentChanges.removed.length > 0 ||
      acknowledgmentChanges.edited.length > 0

    // Build the amended EA artifact.
    const amendedEa = makeAmendedEvaluationAgreement({
      evaluationAgreement: existingEa,
      terms,
      acknowledgmentChanges,
      note,
    })

    // Resolve notification metadata before the state update so the closure
    // doesn't capture stale data (same pattern as the DA-amend handler).
    const granteeParty = existingEa.grantee.party
    const claimNameForNotif = existingClaim.name || null
    const claimPinForNotif = existingClaim.pin || null
    const claimIdForPan = existingClaim.id

    // Stage updates atomically.
    setV22Provisionals((prev) => {
      const next = {
        ...prev,
        evaluationAgreements: [
          ...(prev.evaluationAgreements || []).filter((e) => e.id !== amendedEa.id),
          amendedEa,
        ],
      }
      if (acksDirty) {
        const updatedClaim = {
          ...existingClaim,
          acknowledgments: acknowledgments.map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
          })),
        }
        next.claims = [
          ...((prev.claims || []).filter((c) => c.id !== updatedClaim.id)),
          updatedClaim,
        ]
      }
      return next
    })

    setV22AmendingEaId(null)
    setOpenAgreement(null)
    setSelectedEdgeId(null)

    // Phase 11E.1.1 Fix 3: pan + select only — do NOT set
    // `v22RecentlyAcceptedClaimId`. That state is global and would stamp
    // the NEW badge on every viewer's canvas for as long as it persists,
    // including counterparty roles (e.g., Carol) who have their own EA on
    // the same Claim and inherit acknowledgment changes silently per
    // §11.2a Option B. Stamping NEW for them contradicts the Option B
    // contract (only the targeted EA grantee receives a notification).
    // Trade-off: the grantor (Alice) doesn't get an orange tint flash
    // post-submit either — but she just clicked Amend in a modal and
    // immediately gets a panel-pan + selection, which is sufficient
    // visual confirmation without the cross-role bleed. Per-role reveal-
    // id scoping (the cleaner long-term fix) tracked under existing
    // backlog #138 audit scope.
    if (claimIdForPan) {
      setSel(claimIdForPan)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(claimIdForPan)
    }

    // Notify the EA grantee (single-grantee fan-out per Phase 11E.1 scope —
    // see architecture-spec §11.2a Option C TODO for the multi-EA case).
    if (
      granteeParty &&
      granteeParty !== 'Radiant Network' &&
      granteeParty !== activeRole.party
    ) {
      const granteeRole = ROLES.find((r) => r.party === granteeParty)
      if (granteeRole) {
        enqueueV22NotificationForRequester(granteeRole.id, {
          id: `v22-ea-amendment-${v22AmendingEaId}-${Date.now().toString(36)}`,
          type: 'v22-ea-amendment',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22EaId: v22AmendingEaId,
          v22ClaimId: claimIdForPan,
          note: (note || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22AmendingEaId, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

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
    // Phase 9A.6.1 Fix 1: Asset reveal id may be array form. If the deselected
    // node was one of the revealed Assets, drop it from the array (preserving
    // the remaining badges); if the array empties, reset to null.
    if (Array.isArray(v22RecentlyAcceptedAssetId)) {
      if (v22RecentlyAcceptedAssetId.includes(prevSel)) {
        const remaining = v22RecentlyAcceptedAssetId.filter(id => id !== prevSel)
        setV22RecentlyAcceptedAssetId(
          remaining.length === 0 ? null : remaining.length === 1 ? remaining[0] : remaining
        )
      }
    } else if (v22RecentlyAcceptedAssetId === prevSel) {
      setV22RecentlyAcceptedAssetId(null)
    }
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
  // Phase 9B.2 Fix 3: fade-during-animation tooltip handling. When edgeMenu
  // becomes set, the pan/zoom framing animation (animatedPanToWithZoom,
  // 600ms) is about to start. We hide the tooltip while it runs and
  // reposition on completion. Use setTimeout matching the animation duration
  // since animatedPanToWithZoom doesn't expose a completion callback.
  useEffect(() => {
    if (!edgeMenu) {
      setEdgeMenuPanning(false)
      return
    }
    if (edgeMenu.worldX == null || edgeMenu.worldY == null) {
      // No world-point capture — skip the fade dance and keep the tooltip
      // at its click-point anchor.
      setEdgeMenuPanning(false)
      return
    }
    // Hide the tooltip immediately; the 9A.1.5 framing useEffect will kick
    // the pan/zoom animation on the same render. 150ms is the spec opacity
    // transition — the hide state itself is cleared at animation end.
    setEdgeMenuPanning(true)
    const ANIM_MS = 600
    const t = setTimeout(() => {
      // Reposition the anchor to the projected world point after the
      // camera has settled, then fade back in.
      const proj = canvasRef.current?.projectToViewport?.(edgeMenu.worldX, edgeMenu.worldY)
      if (proj) {
        setEdgeMenu((prev) => prev ? { ...prev, anchor: { x: proj.x, y: proj.y } } : prev)
      }
      setEdgeMenuPanning(false)
    }, ANIM_MS + 20) // small tail-buffer so the last frame settles before we reproject
    return () => clearTimeout(t)
    // edgeMenu.edgeId changes when a different edge is clicked — re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edgeMenu?.edgeId])
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
  // Phase 9A.5 Gate B (#77): recipient-side transfer response surface is a
  // modal, not inline notification UI. Stores the pending notification when
  // the user clicks a v22-transfer-request row; null when no modal is open.
  const [v22TransferResponding, setV22TransferResponding] = useState(null)
  const [cascadeContext, setCascadeContext] = useState(null)
  const [evidenceNode, setEvidenceNode] = useState(null)
  const [parseContext, setParseContext] = useState(null)
  const [revocationNotice, setRevocationNotice] = useState(null)
  const [showLibrary, setShowLibrary] = useState(false)
  const [libraryInitialSetId, setLibraryInitialSetId] = useState(null)
  // Phase 10.3: unified Library opens to a default tab; deep links can pre-set
  // it via setLibraryInitialTab. Legacy `showPEPLibrary` removed; the
  // `open-pep-library` event now opens the unified Library on the parsing tab.
  const [libraryInitialTab, setLibraryInitialTab] = useState(null)
  const [publishedRequirementSets, setPublishedRequirementSets] = useState([])
  useEffect(() => {
    const handler = () => {
      setLibraryInitialTab('parsing')
      setLibraryInitialSetId(null)
      setShowLibrary(true)
    }
    document.addEventListener('open-pep-library', handler)
    return () => document.removeEventListener('open-pep-library', handler)
  }, [])
  const [evalContext, setEvalContext] = useState(null)
  const [claimContext, setClaimContext] = useState(null)
  const [reviseContext, setReviseContext] = useState(null)
  const [showChangelog, setShowChangelog] = useState(false)

  // Phase 11C.5 W1: thin wrapper around the migrated reveal primitive.
  //   • `setV22RevealActiveClaimId(nodeId)` at start drives the
  //     `_showAsProvisional` stamp on the Claim node + incident edges
  //     during the reveal window only. Cleared at phase 'done'.
  //   • `v22RecentlyAcceptedClaimId` was already set by the acceptance
  //     handler — drives `_isNew + _wasProvisional`. NOT cleared here;
  //     the deselect-aware effect at line 2141 clears it when the user
  //     moves selection off the revealed node, so the NEW badge persists
  //     until the user reads it (Phase 7 carry-over #1 semantics).
  // Acceptance-notification dismissal happens at the start of the reveal
  // so the notification doesn't linger after the user clicked it.
  const startReveal = useCallback((nodeId) => {
    const target = nodeMap[nodeId]
    setV22RevealActiveClaimId(nodeId)
    // Dismiss matching acceptance notification — fires immediately so the
    // notification disappears as the reveal kicks off.
    const targetPin = target?.pin
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
    playRevealAnimation({
      nodeId,
      canvasRef,
      targetNode: target ? { x: target.x, y: target.y } : null,
      setRevealAnim,
      onDone: () => {
        // Phase 11C.5 W1: clear ONLY the reveal-active stamp; the
        // recently-accepted-claim stamp stays so the NEW badge + orange
        // tint persist until the user deselects the node (deselect-aware
        // effect at line 2141 handles the clear).
        setV22RevealActiveClaimId(null)
      },
    })
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

  // Phase 11D #137: aggregate undismissed notifications across all OTHER
  // roles. Drives the cross-role notification indicator dots — yellow dot
  // on the user-menu chrome button + per-role dots in the dropdown row
  // list. The active role is excluded (its own pending notifications are
  // already surfaced via the chrome's notification bell).
  const rolesWithUnreadNotifications = useMemo(() => {
    const result = new Set()
    for (const r of ROLES) {
      if (r.id === roleId) continue
      const perRole = perRoleState[r.id]
      if (!perRole) continue
      const dismissed = new Set(perRole.dismissedReqs || [])
      const hasUnread = (perRole.addedRequests || []).some(req => !dismissed.has(req.id))
      if (hasUnread) result.add(r.id)
    }
    return result
  }, [perRoleState, roleId])
  const anyOtherRoleHasNotifications = rolesWithUnreadNotifications.size > 0

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
    // Phase 9D.1: revocation notice is per-viewer; clear on role switch so
    // it doesn't leak context across canvases.
    setV22ActiveRevocationNotice(null)
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

          {/* Phase 10.3: unified Library — Parsing Templates + Requirement
              Sets + Published Requirements. Replaces the two prior chrome
              buttons (Requirements Library + PEP Template Library). */}
          <Tooltip content="Library">
          <div
            onClick={() => {
              setLibraryInitialSetId(null)
              setLibraryInitialTab(null)
              setShowLibrary(true)
            }}
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

          {/* V2.2 Phase 7: Radiant Network (Directory Layer) + AI Shopper.
              Spec §8 anchors the Radiant Network button bottom-left; Andrew's
              Phase 7 task accepts chrome placement near the notification icon. */}
          {/* Radiant Network (Directory Layer) + AI Shopper chrome buttons. */}
          <>
              <Tooltip content={v22DirectoryOpen ? 'Close the Public Directory' : 'Radiant Network — browse the Public Directory'} width={280}>
              <div
                onClick={() => {
                  // Phase 11C.1 W11: clear any active node selection (and its
                  // Detail Panel) when navigating into / out of the Directory
                  // Layer so the panel doesn't persist over the directory.
                  // Also clear the directory-materialized Claim panel when
                  // closing the layer.
                  setSel(null)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22DirectoryOpen((open) => {
                    if (open) setV22DirectoryMaterializedClaim(null)
                    return !open
                  })
                }}
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
                    // Phase 11C: warm-path EA-only notifications.
                    const isV22EaRequest = req.type === 'v22-request-ea-only'
                    const isV22EaAccepted = req.type === 'v22-ea-accepted'
                    const isV22EaDeclined = req.type === 'v22-ea-declined'
                    // Phase 11E.1 (#108): EA amendment notifications.
                    const isV22EaAmendment = req.type === 'v22-ea-amendment'
                    // Phase 9A.4 Gate C: four new Transferring notification types.
                    const isV22TransferRequest = req.type === 'v22-transfer-request'
                    const isV22TransferAccepted = req.type === 'v22-transfer-accepted'
                    const isV22TransferDeclined = req.type === 'v22-transfer-declined'
                    const isV22TransferCancelled = req.type === 'v22-transfer-cancelled'
                    // Phase 9D (#112): revocation notifications.
                    const isV22DaRevoked = req.type === 'v22-da-revoked'
                    const isV22EaRevoked = req.type === 'v22-ea-revoked'
                    const badgeColor = isRevocation || isDecline || isV22TransferDeclined || isV22DaRevoked || isV22EaRevoked || isV22EaDeclined ? 'var(--accent-red)' : isAcceptance || isV22TransferAccepted || isV22EaAccepted ? 'var(--accent-green)' : isRevision || isEvaluation || isV22Amendment || isV22EaAmendment || isV22Evaluation ? 'var(--accent-indigo)' : isPublishedStandard ? 'var(--accent-blue)' : isV22TransferRequest || isV22EaRequest ? 'var(--accent-amber)' : isV22TransferCancelled ? 'var(--text-dim)' : 'var(--accent-indigo)'
                    const badgeLabel = isRevocation ? 'REVOKED' : isAcceptance ? 'ACCEPTED' : isDecline ? 'DECLINED' : isRevision ? 'REVISED' : isEvaluation ? (req.isAmend ? 'AMENDED' : 'EVALUATED') : isPublishedStandard ? 'PUBLISHED' : isV22EaAmendment ? 'EA AMENDED' : isV22Amendment ? 'AMENDED' : isV22Evaluation ? (req.supersedesPriorResultId ? 'RE-EVALUATED' : 'EVALUATED') : isV22Request ? 'REQUEST' : isV22EaRequest ? 'EA REQUEST' : isV22EaAccepted ? 'EA ACCEPTED' : isV22EaDeclined ? 'EA DECLINED' : isV22TransferRequest ? 'TRANSFER' : isV22TransferAccepted ? 'ACCEPTED' : isV22TransferDeclined ? 'DECLINED' : isV22TransferCancelled ? 'CANCELLED' : isV22DaRevoked || isV22EaRevoked ? 'REVOKED' : 'REQUEST'
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
                          // Phase 10.3: deep-link to the unified Library's
                          // Published Requirements tab so the recipient lands
                          // on the surface where they can review the
                          // newly-published standard.
                          setLibraryInitialSetId(null)
                          setLibraryInitialTab('published')
                          setShowLibrary(true)
                        } else if (req.type === 'v22-request') {
                          // Phase 6.5 #8: do NOT dismiss on click — only on
                          // terminal action (accept / decline in handleV22Accept
                          // / handleV22Decline). If the user closes the modal
                          // without resolving, the notification reappears.
                          if (req.v22DaId) setV22RespondingTo({ daId: req.v22DaId })
                        } else if (req.type === 'v22-request-ea-only') {
                          // Phase 11C: warm-path EA-only request → open the
                          // CombinedResponseModal in eaOnlyMode (same dismiss-
                          // on-terminal-action semantics as v22-request).
                          if (req.v22EaId) setV22RespondingToEaOnly({ eaId: req.v22EaId })
                        } else if (req.type === 'v22-ea-accepted' || req.type === 'v22-ea-declined') {
                          // Phase 11C: informational EA-only notifications.
                          // Click pans/selects the target Claim and dismisses.
                          // Phase 11C.4 W2: extend the cold-path reveal-trigger
                          // pattern (V2App:3221) to warm-path acceptances. The
                          // requester's Claim was provisional pre-accept; on
                          // notification click we want the same flip animation
                          // that fires for cold-path acceptances. Decline path
                          // skips reveal — declined Claims stay in declined
                          // visual state, no flip-to-active to play.
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            const claimId = req.claimId
                            const targetNode = claimId ? nodeMap[claimId] : null
                            if (targetNode) {
                              setSel(targetNode.id)
                              if (req.type === 'v22-ea-accepted' && targetNode._isNew && targetNode._wasProvisional) {
                                startReveal(targetNode.id)
                              } else {
                                canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                              }
                            }
                          })
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
                        } else if (req.type === 'v22-ea-amendment') {
                          // Phase 11E.1 (#108): EA amendment notifications
                          // deep-link directly to the affected EA's Detail
                          // Panel. Pan to the Claim node first for visual
                          // context.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const claimNode = req.v22ClaimId ? nodeMap[req.v22ClaimId] : null
                          if (claimNode) {
                            canvasRef.current?.animatedPanToWithZoom?.(claimNode.x, claimNode.y, 1.0, 500)
                          }
                          if (req.v22EaId) {
                            setOpenAgreement({
                              kind: 'evaluation',
                              evaluationAgreementId: req.v22EaId,
                            })
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
                          // Phase 9A.5 Gate B (#77): notification is the entry
                          // point; the decision happens in V22TransferResponseModal
                          // following the Disclosure Response pattern. Do NOT
                          // dismiss on click — the notification resolves only
                          // when Accept or Decline is confirmed inside the modal.
                          setV22TransferResponding(req)
                        } else if (req.type === 'v22-transfer-accepted' || req.type === 'v22-transfer-declined' || req.type === 'v22-transfer-cancelled') {
                          // Informational notifications — clicking dismisses.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                        } else if (req.type === 'v22-da-revoked' || req.type === 'v22-ea-revoked') {
                          // Phase 9D.1 (#112 UX redo): revocation notifications
                          // no longer open a modal. Click dismisses the
                          // notification row + pans/selects the relevant Claim
                          // on the viewer's canvas + opens the Detail Panel.
                          //   • Grantee side (revoked Claim pulled-in): REVOKED
                          //     branch of V22ClaimPanel renders the notice
                          //     section inline (driven by `_revokedMeta`).
                          //   • Grantor side (Claim still normal, no revoked
                          //     artifact to show): set `v22ActiveRevocationNotice`
                          //     so the standard Claim panel renders a top-level
                          //     RevocationNoticeSection carrying the case copy.
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            // Resolve the target Claim node in the viewer's
                            // canvas. Grantee side: the revoked Claim is
                            // present (_revokedMeta flagged). Grantor side:
                            // the viewer's own Claim is present (unaffected).
                            const claimId = req.claimId
                            const targetNode = claimId ? nodeMap[claimId] : null
                            if (targetNode) {
                              setSel(targetNode.id)
                              canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                            }
                            // Phase 9D.1.1 (Fix 5): set the notice-section
                            // state whenever the target Claim is NOT in the
                            // REVOKED state on this viewer's canvas. The
                            // REVOKED branch owns its own rendering (Case
                            // A). This covers:
                            //   • Case B (grantor sees DA revoked by grantee)
                            //   • Case C (grantee sees EA revoked by grantor
                            //     — Claim still visible via DA)
                            //   • Case D (grantor sees EA revoked by grantee)
                            const isRevokedOnThisCanvas = !!(targetNode && (targetNode.isRevoked || targetNode._isRevoked))
                            if (!isRevokedOnThisCanvas) {
                              setV22ActiveRevocationNotice({
                                notification: req,
                                targetClaimId: claimId,
                                kind: req.type === 'v22-da-revoked' ? 'DA' : 'EA',
                              })
                            }
                          })
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
                                            : isV22DaRevoked
                                              ? `${req.from.name} revoked the Disclosure Agreement on ${req.claim?.name || 'a Claim'}.`
                                              : isV22EaRevoked
                                                ? (req.cascadedFromDa
                                                  ? `Evaluation Agreement on ${req.claim?.name || 'a Claim'} was revoked (cascade from Disclosure revocation).`
                                                  : `${req.from.name} revoked your Evaluation Agreement on ${req.claim?.name || 'a Claim'}.`)
                                                : isV22EaRequest
                                                  ? `${req.from.name} is requesting an Evaluation Agreement on ${req.asset?.name || 'a Claim'}.`
                                                  : isV22EaAccepted
                                                    ? `${req.from.name} accepted your Evaluation Agreement request on ${req.asset?.name || 'a Claim'}.`
                                                    : isV22EaDeclined
                                                      ? (req.reason ? `${req.from.name} declined your Evaluation Agreement request — "${req.reason}"` : `${req.from.name} declined your Evaluation Agreement request on ${req.asset?.name || 'a Claim'}.`)
                                                      : isV22EaAmendment
                                                        ? `${req.from.name} amended the Evaluation Agreement on ${req.asset?.name || 'a Claim'}.`
                                                        : req.asset?.name || ''
                        }
                        {/* Phase 9A.5 #77: inline note preview on a pending transfer request.
                            (Full note + Accept/Decline actions live in V22TransferResponseModal.) */}
                        {isV22TransferRequest && req.note && (
                          <div style={{
                            marginTop: 6, padding: '6px 8px',
                            background: 'var(--bg-raised)', borderRadius: 4,
                            fontSize: 10, color: 'var(--text-secondary)', fontStyle: 'italic',
                          }}>"{req.note}"</div>
                        )}
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
                position: 'relative',
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
              {/* Phase 11D #137: cross-role notification indicator. Yellow
                  dot in the corner when ANY OTHER role has at least one
                  un-dismissed notification. The 1.5px ring matches the
                  chrome surface so the dot stays legible against the
                  avatar gradient. */}
              {anyOtherRoleHasNotifications && (
                <span style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--accent-amber)',
                  boxShadow: '0 0 0 1.5px var(--bg-surface)',
                  pointerEvents: 'none',
                }} />
              )}
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
                    // Phase 11D #137: per-role notification dot. Renders for
                    // non-active roles with un-dismissed notifications.
                    const hasUnread = rolesWithUnreadNotifications.has(r.id)
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
                        {!isCurrent && hasUnread && (
                          <span
                            title="Pending notifications on this role"
                            style={{
                              width: 6, height: 6, borderRadius: '50%',
                              background: 'var(--accent-amber)',
                              flexShrink: 0,
                            }}
                          />
                        )}
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
                // Phase 9A.3: owner-only; Actor card action fires this for
                // root-level Assets. Phase 10.2: Asset card action fires this
                // for child registration under the clicked Asset.
                if (node.v22Type === 'ACTOR' && node.name === activeRole.party && !node.isNetworkNode) {
                  setV22RegisteringAsset({ source: 'actor' })
                } else if (node.v22Type === 'ASSET' && node.owner === activeRole.party) {
                  setV22RegisteringAsset({ source: 'asset', parentAsset: node.v22Artifact || node })
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
              case 'cancelRequest':
                // Phase 11D #136: cancel a pending DA / EA request from the
                // canvas action bar. Only valid on a provisional Claim where
                // the active actor is the requester (non-owner).
                if (node.v22Type === 'CLAIM' && node.isProvisional && node.owner !== activeRole.party) {
                  handleV22CancelRequest(node.id)
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
              case 'requestEvaluationAgreement': {
                // Phase 11C: warm-path entry from the card action bar.
                // Same logic as the Detail Panel footer button (above) —
                // open EARequestModal with the existing active DA's id.
                if (node.v22Type !== 'CLAIM') return
                const activeDa = (v22View?.disclosureAgreements || []).find(d =>
                  d.subject?.kind === 'claim' && d.subject.id === node.id &&
                  d.grantee?.party === activeRole.party &&
                  d.type !== 'provisional' && !d._declineMeta && !d._revokedMeta,
                )
                if (!activeDa) return
                setV22EaRequestContext({
                  claim: node.v22Artifact,
                  ownerParty: node.owner,
                  existingDisclosureAgreementId: activeDa.id,
                  requesterAsset: activeDa.granteeAssetId
                    ? { id: activeDa.granteeAssetId, name: (v22View?.assets || []).find(a => a.id === activeDa.granteeAssetId)?.name || activeDa.granteeAssetId }
                    : null,
                })
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
            // Phase 9B §5: edge click pins the rich hover menu. The menu
            // always renders (View DA row always; View EA row conditional on
            // a paired EA). Clears node selection first so node and edge
            // selection stay mutually exclusive.
            // Phase 9B.3: tooltip anchors at the world-space MIDPOINT of the
            // two endpoint cards (not the click point — midpoint is
            // deterministic per edge). Click point still used as the initial
            // screen anchor pre-animation; the fade-during-animation effect
            // reprojects to midpoint on completion.
            const resolved = resolveAgreementsForEdge(edgeId, v22View, edges)
            if (!resolved || !resolved.disclosureAgreement) return
            const edgeObj = edges?.find(e => e.id === edgeId)
            const fromNode = edgeObj ? nodeMap[edgeObj.from] : null
            const toNode = edgeObj ? nodeMap[edgeObj.to] : null
            // Skip edges with an endpoint that has no world position (e.g.
            // Radiant Network pseudo-actor) — matches 9A.1.5 edge-select
            // framing behavior.
            const hasWorldPositions = fromNode && toNode
              && fromNode.x != null && fromNode.y != null
              && toNode.x != null && toNode.y != null
            const midX = hasWorldPositions ? (fromNode.x + toNode.x) / 2 : null
            const midY = hasWorldPositions ? (fromNode.y + toNode.y) / 2 : null
            setSel(null)
            setForcePanelTab(null)
            setForceExpandSda(null)
            setSelectedEdgeId(edgeId)
            setEdgeMenu({
              edgeId,
              anchor: { x: anchor.x, y: anchor.y },
              worldX: midX,
              worldY: midY,
            })
            setOpenAgreement(null)
            setEdgeHover(null)
          }}
          onEdgeHover={(info) => {
            // Phase 9B §2/§3: cursor-tracked hover state. Suppressed while a
            // pinned menu is open so we don't double-render.
            setEdgeHover(info)
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

        {/* Phase 9B: unified rich hover/pinned edge menu. Pinned wins over
            hover when selectedEdgeId is set so the two tooltips never
            stack. Hover-mode is pointer-events:none; pinned-mode is
            clickable with hover-highlighted rows. */}
        {edgeMenu && (() => {
          const resolved = resolveAgreementsForEdge(edgeMenu.edgeId, v22View, edges)
          if (!resolved || !resolved.disclosureAgreement) return null
          const da = resolved.disclosureAgreement
          const edgeObj = edges?.find(e => e.id === edgeMenu.edgeId)
          const fromNode = edgeObj ? nodeMap[edgeObj.from] : null
          const toNode = edgeObj ? nodeMap[edgeObj.to] : null
          // Phase 9B.2 Fix 3: anchor comes straight from edgeMenu.anchor,
          // which starts at the click point and is re-projected by the
          // fade-during-animation effect once the pan/zoom settles. The
          // `hidden` prop drives the fade.
          const anchorPt = edgeMenu.anchor
          return (
            <EdgeHoverMenu
              mode="pinned"
              hidden={edgeMenuPanning}
              anchorX={anchorPt.x}
              anchorY={anchorPt.y}
              sdaType={da.type || 'full'}
              fromNode={fromNode}
              toNode={toNode}
              grantorParty={da.grantor?.party}
              granteeParty={da.grantee?.party}
              disclosureAgreement={da}
              evaluationAgreement={resolved.evaluationAgreement || null}
              onViewDisclosure={() => {
                setOpenAgreement({ kind: 'disclosure', edgeId: edgeMenu.edgeId })
                setEdgeMenu(null)
              }}
              onViewEvaluation={() => {
                setOpenAgreement({ kind: 'evaluation', edgeId: edgeMenu.edgeId })
                setEdgeMenu(null)
              }}
            />
          )
        })()}
        {/* Phase 9B §3: hover menu — only when no pinned menu is open. */}
        {!edgeMenu && edgeHover && (() => {
          const resolved = resolveAgreementsForEdge(edgeHover.edgeId, v22View, edges)
          if (!resolved || !resolved.disclosureAgreement) return null
          const da = resolved.disclosureAgreement
          const edgeObj = edges?.find(e => e.id === edgeHover.edgeId)
          const fromNode = edgeObj ? nodeMap[edgeObj.from] : null
          const toNode = edgeObj ? nodeMap[edgeObj.to] : null
          return (
            <EdgeHoverMenu
              mode="hover"
              anchorX={edgeHover.x}
              anchorY={edgeHover.y}
              sdaType={edgeHover.sdaType}
              fromNode={fromNode}
              toNode={toNode}
              grantorParty={da.grantor?.party}
              granteeParty={da.grantee?.party}
              disclosureAgreement={da}
              evaluationAgreement={resolved.evaluationAgreement || null}
            />
          )
        })()}

        {/* V2.2 Agreement Detail Panels — slide over from the right, reuse the canvas panel slot. */}
        {openAgreement && (() => {
          // Phase 9C: rows in the node-panel Agreements Section open agreement
          // panels with an agreementId (edgeId may be null for suppressed internal
          // DAs). Edge-click entry still passes edgeId. Resolve both paths.
          let resolved = openAgreement.edgeId
            ? resolveAgreementsForEdge(openAgreement.edgeId, v22View, edges)
            : null
          if (!resolved && openAgreement.disclosureAgreementId) {
            const da = v22View?.disclosureAgreements.find((d) => d.id === openAgreement.disclosureAgreementId)
            if (da) {
              const ea = openAgreement.evaluationAgreementId
                ? v22View?.evaluationAgreements.find((e) => e.id === openAgreement.evaluationAgreementId)
                : v22View?.evaluationAgreements.find((e) => e.disclosureAgreementId === da.id)
              resolved = { edge: null, disclosureAgreement: da, evaluationAgreement: ea || null }
            }
          }
          if (!resolved && openAgreement.evaluationAgreementId) {
            const ea = v22View?.evaluationAgreements.find((e) => e.id === openAgreement.evaluationAgreementId)
            if (ea) {
              const da = v22View?.disclosureAgreements.find((d) => d.id === ea.disclosureAgreementId)
              if (da) resolved = { edge: null, disclosureAgreement: da, evaluationAgreement: ea }
            }
          }
          if (!resolved || !resolved.disclosureAgreement) return null
          const resolveNodeName = (id) => nodeMap[id]?.name || null
          const close = () => {
            setOpenAgreement(null)
            setSelectedEdgeId(null)
          }
          const preserve = {
            edgeId: openAgreement.edgeId,
            disclosureAgreementId: resolved.disclosureAgreement.id,
            evaluationAgreementId: resolved.evaluationAgreement?.id,
          }
          const swapToEvaluation = resolved.evaluationAgreement
            ? () => setOpenAgreement({ kind: 'evaluation', ...preserve })
            : undefined
          const swapToDisclosure = () => setOpenAgreement({ kind: 'disclosure', ...preserve })
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
                  // Phase 9D.1.1 (Fix 4): Revoke button wired to same handler
                  // the Agreements Section uses. Panel gates visibility; this
                  // just dispatches to the Confirm modal.
                  onRevoke={() => {
                    const da = resolved.disclosureAgreement
                    close()
                    handleOpenRevocationConfirm(da, 'DA')
                  }}
                  onViewEvaluationAgreement={swapToEvaluation}
                />
              ) : (
                <EvaluationAgreementDetailPanel
                  agreement={resolved.evaluationAgreement}
                  resolveNodeName={resolveNodeName}
                  activeParty={activeRole.party}
                  onClose={close}
                  onAmend={() => {
                    // Phase 11E.1 (#108): Amend EA. Only the grantor (=
                    // Claim owner) can amend. The Detail Panel already
                    // disables the button for non-grantors via its own
                    // gating, but we re-check here defensively.
                    const ea = resolved.evaluationAgreement
                    if (ea.grantor.party !== activeRole.party) return
                    setV22AmendingEaId(ea.id)
                    close()
                  }}
                  // Phase 9D.1.1 (Fix 4): Revoke EA via same handler.
                  onRevoke={() => {
                    const ea = resolved.evaluationAgreement
                    close()
                    handleOpenRevocationConfirm(ea, 'EA')
                  }}
                  onViewDisclosureAgreement={swapToDisclosure}
                  // Phase 11C.2 W3: open ExpandedArtifactModal in JSON-only
                  // mode for the EA artifact. The modal hides the Output tab
                  // for the 'evaluation-agreement' schema since EAs have no
                  // file or structured rows that map to it.
                  onExpand={() => setV22ExpandedArtifact({
                    artifact: resolved.evaluationAgreement,
                    schema: 'evaluation-agreement',
                  })}
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
            onClose={() => {
              setV22DirectoryOpen(false)
              setV22DirectoryMaterializedClaim(null)
            }}
            // Phase 11B: ChipCo cluster click → materialize the warm-path
            // Claim card + open its Detail Panel. The seeded warm-path is
            // `claim-chipco-prm-ic`; if the user has already accepted an EA
            // for it via Phase 11C, that flow will own the Claim's
            // visibility on the parent canvas instead.
            onClusterClick={(cluster) => {
              if (cluster.partyName !== 'ChipCo') return
              const shared = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
              const claim = shared.claims.find(c => c.id === 'claim-chipco-prm-ic')
              if (!claim) return
              setV22DirectoryMaterializedClaim({
                claim,
                anchor: { xPct: cluster.center.xPct, yPct: cluster.center.yPct },
              })
            }}
            materializedClaim={v22DirectoryMaterializedClaim}
            onCloseMaterializedClaim={() => setV22DirectoryMaterializedClaim(null)}
          />
        )}

        {/* Phase 11B: Detail Panel for the materialized directory Claim.
            Mounted alongside the DirectoryLayer (not inside it) so the
            existing Detail Panel z-index ordering and panel-shell styling
            apply. The panel reuses V22NodeDetailPanel's standard CLAIM
            rendering path; the claim is never on the parent canvas, so a
            synthetic node is built via buildClaimNodeForDirectoryMaterialization.
            "Request Evaluation Agreement" footer button is intentionally
            NOT wired in 11B — that's Phase 11C. The non-owner branch of
            V22ClaimPanel doesn't render Amend/Self-Evaluate; Run Evaluation
            requires an EA which Bob doesn't have for this Claim, so the
            footer is empty by design. */}
        {v22DirectoryOpen && v22DirectoryMaterializedClaim && (() => {
          const sharedForPanel = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const claim = v22DirectoryMaterializedClaim.claim
          const syntheticNode = buildClaimNodeForDirectoryMaterialization(claim, sharedForPanel.evaluationResults || [])
          // Build the in-scope referenced-Asset rows (same shape as the
          // standard panel mount). For non-owners, scope-filter to Assets
          // covered by an active DA where the active actor is grantee.
          const refIds = claim.referencedAssetIds || []
          const isOwnerViewing = claim.owner === activeRole.party
          const resolveAsset = (id) => sharedForPanel.assets.find((x) => x.id === id) || null
          let refAssetRows
          let claimIsProofOnlyOnlyDir = false
          if (isOwnerViewing) {
            refAssetRows = refIds.map(id => {
              const a = resolveAsset(id)
              return a ? { id: a.id, name: a.name, asset: a, disclosureType: 'owner' } : null
            }).filter(Boolean)
          } else {
            // Phase 11D.2: same per-Asset disclosure type + disclosed-field
            // enrichment as the standard panel mount, sourced from
            // sharedForPanel since the directory-materialized claim isn't on
            // the active actor's parent canvas.
            const activeGranteeDas = (sharedForPanel.disclosureAgreements || []).filter((d) =>
              d.subject?.id === claim.id &&
              d.grantee.party === activeRole.party &&
              d.type !== 'provisional' &&
              !d._declineMeta &&
              !d._revokedMeta,
            )
            // Phase 11D.3: detect proof-only-only viewing on directory-
            // materialized panel as well.
            claimIsProofOnlyOnlyDir = activeGranteeDas.length > 0
              && activeGranteeDas.every((d) => d.type === 'proofonly')
            const inScope = new Set()
            for (const da of activeGranteeDas) {
              if (Array.isArray(da.scope?.assetIds)) {
                for (const id of da.scope.assetIds) inScope.add(id)
              }
            }
            const allParseResults = sharedForPanel.parseResults || []
            refAssetRows = refIds
              .filter(id => inScope.has(id))
              .map(id => {
                const a = resolveAsset(id)
                if (!a) return null
                const coveringDa = activeGranteeDas.find(da =>
                  Array.isArray(da.scope?.assetIds) && da.scope.assetIds.includes(a.id),
                ) || null
                const disclosureType = coveringDa?.type || 'full'
                const row = { id: a.id, name: a.name, asset: a, disclosureType }
                if (disclosureType === 'selective') {
                  const fieldIdSet = new Set(coveringDa?.scope?.fieldIds || [])
                  const prsForAsset = allParseResults.filter(pr => pr.sourceAssetId === a.id)
                  const disclosedFields = []
                  for (const pr of prsForAsset) {
                    for (const f of (pr.fields || [])) {
                      if (fieldIdSet.has(`${pr.id}::${f.id}`)) {
                        disclosedFields.push({
                          id: f.id,
                          name: f.name,
                          value: f.value,
                          confidence: f.confidence,
                          parseResultId: pr.id,
                          parseResultName: pr.templateName || pr.id,
                        })
                      }
                    }
                  }
                  row.disclosedFieldCount = disclosedFields.length
                  row.disclosedFields = disclosedFields
                }
                return row
              })
              .filter(Boolean)
          }
          // Slide-in from the right; z-index above the directory (150)
          // and the materialized card (10), below the modal stack (10000).
          // Phase 11B.2: top offset matches the app chrome's bottom edge so
          // the panel header (and its X close button) doesn't sit underneath
          // the chrome (which is zIndex 300 — above the panel's 200). The
          // parent-canvas Detail Panel doesn't need this because it mounts
          // inside the canvas container, which is already offset below the
          // chrome via the V2App flex layout. This panel mounts at the V2App
          // root level (sibling of the chrome flex item), so position:fixed
          // places it relative to the viewport — hence the explicit offset.
          return (
            <div style={{
              position: 'fixed',
              top: 61, // chrome height — measured from getBoundingClientRect
              right: 0,
              bottom: 0,
              width: 480,
              zIndex: 200,
            }}>
              <V22NodeDetailPanel
                node={syntheticNode}
                activeParty={activeRole.party}
                onClose={() => setV22DirectoryMaterializedClaim(null)}
                referencedAssetNames={refAssetRows}
                claimIsProofOnlyOnly={claimIsProofOnlyOnlyDir}
                onExpandAsset={(row) => {
                  // Phase 11D.2: row may be either the legacy raw Asset
                  // artifact (older callers) or an enriched row carrying
                  // disclosure context. Branch defensively.
                  if (row && row.asset) {
                    setV22ExpandedArtifact({
                      artifact: row.asset,
                      schema: 'asset',
                      disclosureType: row.disclosureType || 'full',
                      disclosedFields: row.disclosedFields || null,
                    })
                  } else {
                    setV22ExpandedArtifact({ artifact: row, schema: 'asset' })
                  }
                }}
                evaluationResultsForClaim={[]}
                evaluationAgreementForActor={null}
                disclosureAgreementsForNode={[]}
                evaluationAgreementsForNode={[]}
                // Phase 11C: warm-path entry from the directory-materialized
                // panel. Detect the umbrella DA from the materialized Claim's
                // owner to the active actor, and surface the CTA when no EA
                // is paired yet. This is the canonical warm-path entry point
                // — the user clicks ChipCo's cluster, sees the Claim, then
                // requests an EA.
                {...(() => {
                  const activeDa = (sharedForPanel.disclosureAgreements || []).find(d =>
                    d.subject?.kind === 'claim' && d.subject.id === claim.id &&
                    d.grantee?.party === activeRole.party &&
                    d.type !== 'provisional' && !d._declineMeta && !d._revokedMeta,
                  )
                  const hasEa = (sharedForPanel.evaluationAgreements || []).some(e =>
                    e.claimId === claim.id && e.grantee?.party === activeRole.party && e.status === 'active' && !e._provisional,
                  )
                  const showWarm = !!activeDa && !hasEa && claim.owner !== activeRole.party
                  if (!showWarm) return {}
                  return {
                    hasActiveDaWithoutEa: true,
                    onRequestEvaluationAgreement: () => {
                      setV22EaRequestContext({
                        claim,
                        ownerParty: claim.owner,
                        existingDisclosureAgreementId: activeDa.id,
                        requesterAsset: activeDa.granteeAssetId
                          ? { id: activeDa.granteeAssetId, name: (sharedForPanel.assets || []).find(a => a.id === activeDa.granteeAssetId)?.name || activeDa.granteeAssetId }
                          : null,
                      })
                      // Close directory + materialized panel — the EA request
                      // modal becomes the foreground UI.
                      setV22DirectoryMaterializedClaim(null)
                      setV22DirectoryOpen(false)
                    },
                  }
                })()}
              />
            </div>
          )
        })()}

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
            // Phase 11D #134: pass the set of Claim ids already on the active
            // actor's canvas. The modal flags PINs that resolve to one of
            // these as `already-disclosed` so the user can't fire a duplicate
            // request when a satisfactory agreement is in place.
            claimsOnRequesterCanvas={new Set((v22View?.claims || []).map(c => c.id))}
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
          // Phase 11C.1: surface the requester's accepted acknowledgments (ids
          // referencing the Claim's `acknowledgments[]`) so the response
          // modal can render the read-only audit panel at step 3 + step 4.
          const provisionalEa = v22Provisionals.evaluationAgreements.find(e => e.disclosureAgreementId === da.id)
          const proposedEaTerms = provisionalEa ? {
            acknowledgmentsAccepted: [...(provisionalEa.acknowledgmentsAccepted || [])],
          } : null
          return (
            <CombinedResponseModal
              request={{
                claim,
                ownerParty: da.grantor.party,
                requesterParty: da.grantee.party,
                requesterAsset: da.granteeAssetId,
                message: da._requestMeta?.message || '',
                requestedRequirementsSetIds: da._requestMeta?.requestedRequirementsSetIds || [],
                proposedEaTerms,
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

        {/* Phase 11C: warm-path EA Request modal — opens via the
            "Request Evaluation Agreement" footer button or canvas action bar
            on Claims where the active actor has an active DA but no EA. */}
        {v22EaRequestContext && (
          <EARequestModal
            requesterParty={activeRole.party}
            requesterAsset={v22EaRequestContext.requesterAsset}
            claim={v22EaRequestContext.claim}
            ownerParty={v22EaRequestContext.ownerParty}
            existingDisclosureAgreementId={v22EaRequestContext.existingDisclosureAgreementId}
            availableRequirementsSets={requirementSets.map(rs => ({ id: rs.id, name: rs.name, version: rs.version ?? 1 }))}
            onSubmit={handleV22EaRequestSubmit}
            onClose={() => setV22EaRequestContext(null)}
          />
        )}

        {/* Phase 11C: EA-only response modal — opens when the grantor clicks
            a v22-request-ea-only notification. Reuses CombinedResponseModal
            in eaOnlyMode. */}
        {v22RespondingToEaOnly && (() => {
          const ea = v22Provisionals.evaluationAgreements.find(e => e.id === v22RespondingToEaOnly.eaId)
          if (!ea) return null
          const sharedForEa = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const claim = sharedForEa.claims.find(c => c.id === ea.claimId)
          if (!claim) return null
          const proposedEaTerms = {
            acknowledgmentsAccepted: [...(ea.acknowledgmentsAccepted || [])],
          }
          return (
            <CombinedResponseModal
              eaOnlyMode
              request={{
                claim,
                ownerParty: ea.grantor.party,
                requesterParty: ea.grantee.party,
                requesterAsset: ea.granteeAssetId,
                message: ea._requestMeta?.message || '',
                requestedRequirementsSetIds: ea._requestMeta?.requestedRequirementsSetIds || ea.authorizedRequirementsSetIds || [],
                proposedEaTerms,
              }}
              referencedAssets={[]}
              parseResults={[]}
              evalResultsForClaim={[]}
              onAccept={handleV22AcceptEAOnly}
              onDecline={handleV22DeclineEAOnly}
              onClose={() => setV22RespondingToEaOnly(null)}
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
          // Phase 9A.6.2.1 #103 fix: include provisionals so newly-registered
          // Assets (not yet merged into the seeded bundle) resolve correctly
          // in the counterparty's evidence list. Comment on this block
          // already said "(incl. provisionals)" — now the implementation
          // actually does that.
          const sharedForEval = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
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
              credits={credits}
              creditsPerAsset={CREDITS_PER_ASSET}
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
              claim={claim}
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

        {/* Phase 11E.1 (#108): Amend Evaluation Agreement modal. */}
        {v22AmendingEaId && (() => {
          const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const ea = merged.evaluationAgreements.find((e) => e.id === v22AmendingEaId)
          if (!ea) return null
          const claim = merged.claims.find((c) => c.id === ea.claimId)
          if (!claim) return null
          return (
            <AmendEvaluationAgreementModal
              agreement={ea}
              claim={claim}
              onSubmit={handleV22AmendEvaluationSubmit}
              onClose={() => setV22AmendingEaId(null)}
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
            credits={credits}
            creditsPerAsset={CREDITS_PER_ASSET}
            onClose={() => setV22RegisteringAsset(null)}
            onComplete={handleV22CreateAssetSubmit}
            parentAssetName={v22RegisteringAsset?.parentAsset?.name || null}
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
              credits={credits}
              creditsPerClaim={CREDITS_PER_CLAIM}
              creditsPerAsset={CREDITS_PER_ASSET}
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

        {/* V2.2 Transfer Response modal (Phase 9A.5 Gate B #77) — opens from
            the v22-transfer-request notification. Recipient accepts or
            declines (with optional reason). Replaces the inline accept/
            decline buttons that used to live in the notification row. */}
        {v22TransferResponding && (() => {
          const notif = v22TransferResponding
          const seededAssets = buildV22SharedArtifacts().assets
          const assetForNotif = (v22Provisionals.assets || []).find((a) => a.id === notif.assetId)
            || seededAssets.find((a) => a.id === notif.assetId)
          return (
            <V22TransferResponseModal
              notif={notif}
              asset={assetForNotif || { name: notif.asset?.name }}
              senderParty={notif.from?.name}
              senderDate={notif.date}
              note={notif.note}
              onAccept={handleV22TransferAccept}
              onDecline={handleV22TransferDecline}
              onClose={() => setV22TransferResponding(null)}
            />
          )
        })()}

        {/* Phase 9D (#112): Revocation Confirm modal — revoker-side.
            Opens from the Revoke action in the Agreements section of a
            node Detail Panel. Confirmation commits the revocation (with
            cascade handling for DA revocations) and enqueues the
            counterparty notification. */}
        {v22Revoking && (
          <V22RevocationConfirmModal
            agreement={v22Revoking.agreement}
            agreementType={v22Revoking.agreementType}
            counterpartyParty={v22Revoking.counterpartyParty}
            subjectName={v22Revoking.subjectName}
            cascadeInfo={v22Revoking.cascadeInfo}
            onConfirm={handleRevokeConfirm}
            onClose={() => setV22Revoking(null)}
          />
        )}

        {/* Phase 9D.1.4 Fix 2: orphaned Eval Result Dismiss confirmation. */}
        {v22DismissingEvalResult && (
          <V22DismissEvalResultModal
            evalResultArtifact={v22DismissingEvalResult}
            onConfirm={() => {
              const er = v22DismissingEvalResult
              setV22DismissingEvalResult(null)
              handleV22DismissOrphanedEvalResult(er)
            }}
            onClose={() => setV22DismissingEvalResult(null)}
          />
        )}

        {/* Phase 11B: Detail Panel "expand" modal — opens from the Expand
            button on referenced-Asset rows in V22ClaimPanel (and from any
            future caller that sets v22ExpandedArtifact). */}
        {v22ExpandedArtifact && (
          <ExpandedArtifactModal
            artifact={v22ExpandedArtifact.artifact}
            schema={v22ExpandedArtifact.schema}
            disclosureType={v22ExpandedArtifact.disclosureType}
            disclosedFields={v22ExpandedArtifact.disclosedFields}
            onClose={() => setV22ExpandedArtifact(null)}
          />
        )}

        {/* Phase 9D.1 (#112 UX redo): V22RevocationNoticeModal mount removed.
            Notification-click now pans/selects the Claim and opens the Detail
            Panel, which renders the revocation notice inline — grantee-side
            via the REVOKED branch (driven by `_revokedMeta`), grantor-side
            via the top-level RevocationNoticeSection keyed on the
            `v22ActiveRevocationNotice` state. V22RevocationNoticeModal.jsx is
            left as dead code pending the #50 dead-handler sweep. */}

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
          // Phase 9A.6.2.1 #103 fix: include provisionals so newly-registered
          // Assets resolve their names correctly in the counterparty's
          // Referenced Assets list. Without the merge, the find() call below
          // returns undefined for user-created Assets and .filter(Boolean)
          // silently drops them from the rendered list.
          const sharedForPanel = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const isOwnerViewing = node.v22Type === 'CLAIM' && node.owner === activeRole.party
          // Phase 11D.3: detect proof-only-only viewing (every active grantee
          // DA on this Claim is proof-only). Drives the Claim Detail Panel's
          // empty-state copy on the Referenced Assets section — proof-only
          // doesn't expose Assets, so the section reads "(0)" + a proof-only-
          // specific empty hint instead of a generic "No referenced Assets."
          let claimIsProofOnlyOnly = false
          if (!isOwnerViewing && node.v22Type === 'CLAIM') {
            const activeGranteeDasForClaim = (v22View?.disclosureAgreements || []).filter((d) =>
              d.subject?.id === node.id &&
              d.grantee?.party === activeRole.party &&
              d.type !== 'provisional' &&
              !d._declineMeta &&
              !d._revokedMeta,
            )
            claimIsProofOnlyOnly = activeGranteeDasForClaim.length > 0
              && activeGranteeDasForClaim.every((d) => d.type === 'proofonly')
          }
          let referencedAssetNames = []
          if (node.v22Artifact?.referencedAssetIds) {
            const refIds = node.v22Artifact.referencedAssetIds
            // Phase 11B: include the full Asset artifact (`asset`) so the
            // ExpandButton in V22ClaimPanel can hand it to the modal. The
            // canvas-node lookup via `nodeMap[id]` returns a node with
            // `v22Artifact`; the seeded fallback returns a raw Asset.
            const resolveAsset = (id) => {
              const node = nodeMap[id]
              if (node?.v22Artifact) return node.v22Artifact
              return sharedForPanel.assets.find((x) => x.id === id) || null
            }
            if (isOwnerViewing) {
              referencedAssetNames = refIds.map(id => {
                const a = resolveAsset(id)
                return a ? { id: a.id, name: a.name, asset: a, disclosureType: 'owner' } : null
              }).filter(Boolean)
            } else {
              // Build the union of in-scope Asset ids across all visible active
              // DAs on this Claim where the active actor is grantee.
              // Phase 11D.2: also collect each active DA so we can determine
              // per-Asset disclosure type (Selective vs Full) and resolve the
              // disclosed parsed fields the grantee can see.
              const activeGranteeDas = (v22View?.disclosureAgreements || []).filter((d) =>
                d.subject?.id === node.id &&
                d.grantee.party === activeRole.party &&
                d.type !== 'provisional' &&
                !d._declineMeta &&
                !d._revokedMeta,
              )
              const inScope = new Set()
              for (const da of activeGranteeDas) {
                if (Array.isArray(da.scope?.assetIds)) {
                  for (const id of da.scope.assetIds) inScope.add(id)
                }
              }
              const allParseResults = sharedForPanel.parseResults || []
              referencedAssetNames = refIds
                .filter(id => inScope.has(id))
                .map(id => {
                  const a = resolveAsset(id)
                  if (!a) return null
                  // Find the DA that covers this Asset. In practice one DA per
                  // (Claim, grantee) is active at a time, but per-Asset matching
                  // handles the multi-DA case correctly (e.g., a Selective DA
                  // covering Asset X plus a Full DA covering Asset Y).
                  const coveringDa = activeGranteeDas.find(da =>
                    Array.isArray(da.scope?.assetIds) && da.scope.assetIds.includes(a.id),
                  ) || null
                  const disclosureType = coveringDa?.type || 'full'
                  const row = { id: a.id, name: a.name, asset: a, disclosureType }
                  if (disclosureType === 'selective') {
                    // Phase 11D.2: enumerate disclosed fields. The DA stores
                    // fieldIds as `${parseResultId}::${fieldId}`. Resolve each
                    // against the Parse Results derived from this Asset so the
                    // panel can render a count and the Expand modal can render
                    // the field rows.
                    const fieldIdSet = new Set(coveringDa?.scope?.fieldIds || [])
                    const prsForAsset = allParseResults.filter(pr => pr.sourceAssetId === a.id)
                    const disclosedFields = []
                    for (const pr of prsForAsset) {
                      for (const f of (pr.fields || [])) {
                        if (fieldIdSet.has(`${pr.id}::${f.id}`)) {
                          disclosedFields.push({
                            id: f.id,
                            name: f.name,
                            value: f.value,
                            confidence: f.confidence,
                            parseResultId: pr.id,
                            parseResultName: pr.templateName || pr.id,
                          })
                        }
                      }
                    }
                    row.disclosedFieldCount = disclosedFields.length
                    row.disclosedFields = disclosedFields
                  }
                  return row
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
            !e._provisional &&
            (v22Provisionals.disclosureAgreements.find(d => d.id === e.disclosureAgreementId)?.type !== 'provisional')
          ) || (v22View?.evaluationAgreements || []).find(e =>
            e.claimId === node.id && e.grantee.party === activeRole.party && e.status === 'active' && !e._provisional
          )
          // Phase 11C: warm-path detection. Active DA exists + no EA on this
          // Claim where the viewer is grantee → surface the
          // "Request Evaluation Agreement" CTA (footer + canvas action bar).
          const activeDaForActor = node.v22Type === 'CLAIM'
            ? (v22View?.disclosureAgreements || []).find(d =>
                d.subject?.kind === 'claim' && d.subject.id === node.id &&
                d.grantee?.party === activeRole.party &&
                d.type !== 'provisional' && !d._declineMeta && !d._revokedMeta,
              )
            : null
          const hasActiveDaWithoutEa = !!activeDaForActor && !evaluationAgreementForActor
          const sourceAsset = node.v22Artifact?.sourceAssetId
            ? (v22View?.assets || []).find(a => a.id === node.v22Artifact.sourceAssetId)
            : null

          // ── Phase 9C: Agreements Section derivation ────────────────────
          // Filter DAs + EAs relevant to this node. Uses v22View (already
          // merged with provisionals via getV22DataForRole) so user-created
          // agreements appear without a #103-style regression. sharedForPanel
          // (also merged) covers subject-name lookups for public-directory DAs
          // and similar edge cases where the artifact may not be on the
          // active actor's canvas.
          const allDas = v22View?.disclosureAgreements || []
          const allEas = v22View?.evaluationAgreements || []
          let disclosureAgreementsForNode = []
          let evaluationAgreementsForNode = []
          if (node.v22Type === 'ACTOR') {
            const party = node.name
            disclosureAgreementsForNode = allDas.filter((d) =>
              d.grantor.party === party || d.grantee.party === party,
            )
            evaluationAgreementsForNode = allEas.filter((e) =>
              e.grantor.party === party || e.grantee.party === party,
            )
          } else if (node.v22Type === 'ASSET') {
            disclosureAgreementsForNode = allDas.filter((d) =>
              (Array.isArray(d.scope?.assetIds) && d.scope.assetIds.includes(node.id)) ||
              d.granteeAssetId === node.id ||
              (d.subject?.kind === 'asset' && d.subject.id === node.id),
            )
            evaluationAgreementsForNode = allEas.filter((e) => e.granteeAssetId === node.id)
          } else if (node.v22Type === 'CLAIM') {
            disclosureAgreementsForNode = allDas.filter((d) =>
              d.subject?.kind === 'claim' && d.subject.id === node.id,
            )
            evaluationAgreementsForNode = allEas.filter((e) => e.claimId === node.id)
          }
          // Phase 9D.1 (#112 UX redo): revoked DAs + EAs scoped to this Claim.
          // buildViewForActor exposes `revokedDisclosureAgreements` and
          // `revokedEvaluationAgreements` as separate arrays so the active
          // lists stay clean while the panel can surface pre-Dismiss context.
          const allRevokedDas = v22View?.revokedDisclosureAgreements || []
          const allRevokedEas = v22View?.revokedEvaluationAgreements || []
          let revokedDisclosureAgreementsForNode = []
          let revokedEvaluationAgreementsForNode = []
          if (node.v22Type === 'CLAIM') {
            revokedDisclosureAgreementsForNode = allRevokedDas.filter((d) =>
              d.subject?.kind === 'claim' && d.subject.id === node.id,
            )
            revokedEvaluationAgreementsForNode = allRevokedEas.filter((e) => e.claimId === node.id)
          }
          // Phase 9D.1.3 Fix 1: notification routing refined to four cases.
          //   • Case A (kind=DA, viewer=grantee) → Claim-level notice via
          //     `revocationNoticeForPanel` (REVOKED Claim branch).
          //   • Case B (kind=DA, viewer=grantor) → inline DA row expansion
          //     via `expandedRevokedDaId/Info` (Claim persists).
          //   • Case C (kind=EA, viewer=grantee) → inline EA row expansion.
          //   • Case D (kind=EA, viewer=grantor) → inline EA row expansion.
          // Cases B/C/D all keep the Claim on-canvas; only Case A removes
          // the Claim from the viewer's network. Eval Result cascade removed
          // in Fix 6 — Eval Results persist across all revocation paths.
          let revocationNoticeForPanel = null
          let expandedRevokedEaId = null
          let expandedRevokedEaInfo = null
          let expandedRevokedDaId = null
          let expandedRevokedDaInfo = null
          if (v22ActiveRevocationNotice && node.v22Type === 'CLAIM'
              && v22ActiveRevocationNotice.targetClaimId === node.id) {
            const notif = v22ActiveRevocationNotice.notification
            const viewerIsGrantor = activeRole.party === node.owner
            if (v22ActiveRevocationNotice.kind === 'DA') {
              // daType derivation: look up the referenced DA in the shared pool.
              let daType = 'full'
              if (notif?.agreementId) {
                const da = sharedForPanel.disclosureAgreements.find((d) => d.id === notif.agreementId)
                if (da?.type && da.type !== 'provisional') daType = da.type
              }
              if (viewerIsGrantor) {
                // Case B: inline DA row expansion on grantor's canvas.
                expandedRevokedDaId = notif?.agreementId || null
                expandedRevokedDaInfo = {
                  daType,
                  revokerParty: notif?.from?.name,
                  revokedDate: notif?.date,
                  reason: notif?.reason,
                }
              } else {
                // Case A: Claim-level notice in the REVOKED branch.
                revocationNoticeForPanel = {
                  kind: 'DA',
                  daType,
                  revokerParty: notif?.from?.name,
                  revokedDate: notif?.date,
                  reason: notif?.reason,
                  cascadeEa: !!notif?.cascadeIncludesEa,
                  // Phase 9D.1.3 Fix 6: always 0 — Eval Results no longer
                  // cascade on DA revocation.
                  cascadeEvalResultCount: 0,
                }
              }
            } else if (v22ActiveRevocationNotice.kind === 'EA') {
              // Cases C + D: inline EA row expansion. Same mechanic on both
              // sides; the case-C-vs-D copy branches inside the row based
              // on viewerIsGrantor.
              expandedRevokedEaId = notif?.agreementId || null
              expandedRevokedEaInfo = {
                revokerParty: notif?.from?.name,
                revokedDate: notif?.date,
                reason: notif?.reason,
              }
            }
          }
          const resolveSubjectName = (subject) => {
            if (!subject) return null
            const pools = {
              asset: sharedForPanel.assets,
              claim: sharedForPanel.claims,
              evalResult: sharedForPanel.evaluationResults,
              parseResult: sharedForPanel.parseResults,
            }
            const pool = pools[subject.kind]
            if (!pool) return null
            const artifact = pool.find((a) => a.id === subject.id)
            if (!artifact) return null
            return artifact.name || artifact.templateName || artifact.id
          }
          const resolveClaimName = (claimId) => {
            const c = sharedForPanel.claims.find((x) => x.id === claimId)
            return c ? c.name : null
          }
          const handleAgreementRowClick = (kind, agreement) => {
            setSel(null)
            setEdgeMenu(null)
            setForcePanelTab(null)
            setForceExpandSda(null)
            // Find corresponding edge so we get the pan/zoom framing. Multiple
            // edges may share a DA (e.g., internal claim-ref with multi-asset
            // scope); first match is fine for framing purposes.
            let edgeId = null
            if (kind === 'disclosure') {
              edgeId = edges?.find((e) => e.disclosureAgreementId === agreement.id)?.id || null
            } else {
              edgeId = edges?.find((e) => e.pairedEvaluationAgreementId === agreement.id)?.id || null
            }
            if (edgeId) setSelectedEdgeId(edgeId)
            setOpenAgreement({
              kind,
              edgeId,
              disclosureAgreementId: kind === 'disclosure' ? agreement.id : undefined,
              evaluationAgreementId: kind === 'evaluation' ? agreement.id : undefined,
            })
          }
          const handleAmendDaFromRow = (da) => {
            if (da.grantor.party !== activeRole.party) return
            if (da.type === 'provisional') {
              setV22RespondingTo({ daId: da.id })
            } else {
              setV22AmendingDaId(da.id)
            }
            // Close the node Detail Panel so the modal has a clean stage.
            setSel(null)
          }
          // Phase 11E.1.3 Fix 1: inline AMEND handler for EAs. Mirrors the
          // EA Detail Panel footer's onAmend (V2App:4477) — same gating
          // (grantor only) and same setter (`setV22AmendingEaId`). The
          // panel-close keeps the modal stage clean.
          const handleAmendEaFromRow = (ea) => {
            if (ea.grantor.party !== activeRole.party) return
            if (ea._revokedMeta) return
            if (ea.status && ea.status !== 'active') return
            setV22AmendingEaId(ea.id)
            setSel(null)
          }

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
                // Phase 10.2: Asset hierarchy
                onRegisterChildAsset={node.v22Type === 'ASSET' && node.owner === activeRole.party && !node._pendingTransfer
                  ? () => setV22RegisteringAsset({ source: 'asset', parentAsset: node.v22Artifact || node })
                  : undefined}
                childAssets={node.v22Type === 'ASSET'
                  ? (v22View?.assets || []).filter(a => a.parentAssetId === node.id)
                  : []}
                parentAsset={node.v22Type === 'ASSET' && node.v22Artifact?.parentAssetId
                  ? (v22View?.assets || []).find(a => a.id === node.v22Artifact.parentAssetId) || null
                  : null}
                onSelectAsset={(assetId) => {
                  // Pan/zoom + select the target Asset's canvas node.
                  setSel(assetId)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(assetId)
                }}
                parseResultsForAsset={parseResultsForAsset}
                // Claim actions
                referencedAssetNames={referencedAssetNames}
                claimIsProofOnlyOnly={claimIsProofOnlyOnly}
                onSelectEvalResult={(er) => {
                  // Phase 11D.3: pan to the Eval Result node and open its
                  // Detail Panel (replaces the Claim panel since selection
                  // changes).
                  setSel(er.id)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(er.id)
                }}
                // Phase 11B: open the ExpandedArtifactModal for an Asset row.
                onExpandAsset={(row) => {
                  // Phase 11D.2: row may be either the legacy raw Asset
                  // artifact (older callers) or an enriched row carrying
                  // disclosure context. Branch defensively.
                  if (row && row.asset) {
                    setV22ExpandedArtifact({
                      artifact: row.asset,
                      schema: 'asset',
                      disclosureType: row.disclosureType || 'full',
                      disclosedFields: row.disclosedFields || null,
                    })
                  } else {
                    setV22ExpandedArtifact({ artifact: row, schema: 'asset' })
                  }
                }}
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
                // Phase 11C: warm-path EA request entry from the Claim panel.
                // Renders only when active DA exists + no EA. Click opens
                // EARequestModal with the existing DA's id baked in.
                onRequestEvaluationAgreement={hasActiveDaWithoutEa
                  ? () => setV22EaRequestContext({
                    claim: node.v22Artifact,
                    ownerParty: node.owner,
                    existingDisclosureAgreementId: activeDaForActor.id,
                    requesterAsset: activeDaForActor.granteeAssetId
                      ? { id: activeDaForActor.granteeAssetId, name: (v22View?.assets || []).find(a => a.id === activeDaForActor.granteeAssetId)?.name || activeDaForActor.granteeAssetId }
                      : null,
                  })
                  : undefined}
                hasActiveDaWithoutEa={hasActiveDaWithoutEa}
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
                // Phase 9D.1.3 Fix 6: orphan detection for Eval Result panel.
                // An ER is orphaned when its backing EA is no longer in the
                // active view — either revoked or already dismissed. Self-
                // evaluated ERs (no evaluationAgreementId) are never orphaned.
                // Superseded ERs aren't flagged orphaned either; the existing
                // SUPERSEDED treatment handles that case.
                isOrphaned={(() => {
                  if (node.v22Type !== 'EVAL RESULT') return false
                  const er = node.v22Artifact
                  if (!er || !er.evaluationAgreementId) return false
                  if (er.status === 'superseded') return false
                  const ea = (v22View?.evaluationAgreements || []).find(e => e.id === er.evaluationAgreementId)
                  return !ea
                })()}
                onDismissOrphanedEvalResult={() => setV22DismissingEvalResult(node.v22Artifact || null)}
                // Phase 11D.3: linked Claim name for Eval Result panels.
                // Resolves the ER's claimId against the merged dataset so
                // proof-only grantees can see what the ER evaluates.
                linkedClaimName={node.v22Type === 'EVAL RESULT' && node.v22Artifact?.claimId
                  ? (sharedForPanel.claims.find((c) => c.id === node.v22Artifact.claimId)?.name || null)
                  : null}
                // Phase 9C — Agreements Section (backlog #111)
                disclosureAgreementsForNode={disclosureAgreementsForNode}
                evaluationAgreementsForNode={evaluationAgreementsForNode}
                resolveSubjectName={resolveSubjectName}
                resolveClaimName={resolveClaimName}
                onAgreementRowClick={handleAgreementRowClick}
                onAmendDa={handleAmendDaFromRow}
                // Phase 11E.1.3 Fix 1: inline AMEND on EA rows in the
                // Agreements section. Same handler the EA Detail Panel
                // footer fires.
                onAmendEa={handleAmendEaFromRow}
                // Phase 9D — Revoke wiring (#112)
                onRevokeDa={(da) => handleOpenRevocationConfirm(da, 'DA')}
                onRevokeEa={(ea) => handleOpenRevocationConfirm(ea, 'EA')}
                onDismissRevoked={() => {
                  // Grantee-side Dismiss (REVOKED branch) — drops revoked
                  // artifacts from state + clears any pending notice.
                  handleV22DismissRevoked(node.id)
                  setV22ActiveRevocationNotice(null)
                }}
                // Phase 9D.1 — grantor-side revocation notice + revoked-row
                // context (backlog #112 UX redo)
                revokedDisclosureAgreementsForNode={revokedDisclosureAgreementsForNode}
                revokedEvaluationAgreementsForNode={revokedEvaluationAgreementsForNode}
                revocationNotice={revocationNoticeForPanel}
                onDismissRevocationNotice={() => setV22ActiveRevocationNotice(null)}
                // Phase 9D.1.2 W1 — inline EA revocation pattern (Cases C/D)
                expandedRevokedEaId={expandedRevokedEaId}
                expandedRevokedEaInfo={expandedRevokedEaInfo}
                onDismissExpandedRevokedEa={handleV22DismissRevokedEa}
                // Phase 9D.1.3 Fix 1 — inline DA revocation pattern (Case B)
                expandedRevokedDaId={expandedRevokedDaId}
                expandedRevokedDaInfo={expandedRevokedDaInfo}
                onDismissExpandedRevokedDa={handleV22DismissRevokedDaGrantorSide}
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
          v0.11.19 &middot; Changelog
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
                { version: '0.11.19', date: '2026-05-02', label: 'Phase 11E.1.6', items: [
                  'Fix: "No expiry" picks in the response flow now actually never expire. Pre-fix the picker emitted "none" but the modal\'s switch handled "never", silently coercing the choice to a 1-year expiry. Cold + warm path both verified.',
                  'New: Disclosure Agreements now have their own expiration in the response flow. Step 2 (Disclosure Scope) gains an Expiration picker above the scope picker — DA and EA expirations are independent. Step 4 review shows both. Default for both = "Never expires."',
                  'New: Amend Disclosure Agreement modal can now edit expiration alongside scope. Detail Panel amendment cards render a "Expiration: <before> → <after>" delta line, mirroring the EA panel.',
                  'Polish: Amend DA modal title is now "Amend Disclosure Agreement" (was "Amend Disclosure"); subtitle weaves grantee + Claim name into the prose with bolding, parallel to Amend EA.',
                ]},
                { version: '0.11.18', date: '2026-05-01', label: 'Phase 11E.1.5', items: [
                  'Fix: REVOKED badge on revoked node cards moved to the type-label header row, so long node names no longer get truncated by the badge.',
                  'Polish: copy unification — the no-expiration state now reads "Never expires" everywhere (Detail Panels, edge tooltips, amend modals, response review). The Expiry picker option title remains "No expiry" since it labels a user action.',
                ]},
                { version: '0.11.17', date: '2026-05-01', label: 'Phase 11E.1.4', items: [
                  'Fix: AMEND button no longer renders on revoked Evaluation Agreement rows in node Detail Panels — matches REVOKE\'s gating and the Disclosure Agreement row pattern.',
                  'Fix: active Disclosure Agreement rows now read "Expires YYYY-MM-DD" (or "No expiry") on the right side, matching the EA-row pattern. The "Active · {creationDate}" label is dropped — the row\'s presence in the active Agreements section already implies active.',
                  'Polish: response modal title is now step-aware. Steps 1-2 read "Respond to Disclosure Request"; Step 3 reads "Respond to Evaluation Request"; Step 4 reads "Review your Disclosure + Evaluation Agreement Response" (or "Review your Evaluation Agreement Response" on the warm path).',
                ]},
                { version: '0.11.16', date: '2026-05-01', label: 'Phase 11E.1.3', items: [
                  'Fix: inline AMEND button on Evaluation Agreement rows in node Detail Panels is now wired. Replaces the stale "coming soon" placeholder with the same three-branch gating used by the EA Detail Panel footer.',
                  'Polish: refreshed seed-data EA evaluation deadlines from 2026-04-XX to 2028-04-XX so demos no longer show past dates on Active agreements.',
                ]},
                { version: '0.11.15', date: '2026-05-01', label: 'Phase 11E.1.2', items: [
                  'Fix: Detail Panel Agreements section now shows the EA\'s actual deadline (was always reading "Never expires" because of a wrong field name). Updates immediately after amend.',
                  'Polish: edge hover tooltip titles ("Selective Disclosure Agreement", "Proof-only Disclosure Agreement") no longer wrap onto two lines with "Agreement" orphaned.',
                ]},
                { version: '0.11.14', date: '2026-05-01', label: 'Phase 11E.1.1', items: [
                  'Fix: Amend Evaluation Agreement modal no longer enables Submit before any user input. The dirty-check now compares dates at YYYY-MM-DD precision.',
                  'Fix: edge hover tooltip now shows the EA\'s actual expiration (was always reading "Never expires" because of a wrong field name). Updates propagate live after amendments.',
                  'Fix: Carol no longer sees a stale NEW badge on Alice\'s Claim when Alice amends Bob\'s EA. Silent acknowledgment inheritance is documented (Option B) but should not trigger UI cues for unaffected counterparties.',
                  'Polish: ExpiryPicker preset cards now show correct YYYY-MM-DD dates relative to today (e.g. "Expires 2027-05-01") instead of the hard-coded "March 2027 / March 2028".',
                  'Polish: Amend EA modal header now names the grantee + Claim ("...with GovCo on Claim Voltage Regulator IC..."); footer summary shows explicit "Expiration: <before> → <after>" rather than the bare "Expiration changed".',
                ]},
                { version: '0.11.13', date: '2026-04-30', label: 'Phase 11E.1', items: [
                  'New: Amend Evaluation Agreement modal — Claim owners can update an EA\'s expiration date and edit the Claim\'s acknowledgments. Unilateral; the EA grantee is notified and may revoke if they don\'t accept the new terms.',
                  'New: EA Detail Panel grew an Amendments section showing each amendment\'s expiration delta + acknowledgment changes (added / removed / edited counts) + the optional grantor note.',
                  'New: v22-ea-amendment notification type — single-grantee, informational. Click pans to the affected Claim and opens the EA Detail Panel directly.',
                ]},
                { version: '0.11.12', date: '2026-04-30', label: 'Phase 11.5', items: [
                  'Hygiene: polish-backlog reorganized — completed items moved to a "Completed" section at the bottom of the file. Topic sections at the top now show only open / partial / deferred items. Each open item has standardized Status + Effort fields.',
                  'Hygiene: architecture spec audited — Phase 11 summary entry added; cross-canvas pull-in rule for proof-only added in §6.5; notification table extended with transfer + revocation types in §7.4; §14 staleness flagged inline.',
                  'New: ROUND-13-CONTEXT.md repo-root file created — setup checklist for the next Claude Code conversation, with phase queues for 11E, 12, 13, 14, 15, and beyond.',
                ]},
                { version: '0.11.11', date: '2026-04-30', label: 'Phase 11D.4.1', items: [
                  'Fix: pulled-in proof-only Evaluation Result now hangs off-and-below its source Claim instead of sitting in a fixed column. The connecting edge stays short and doesn\'t cross other canvas nodes.',
                  'Fix: at zoomed-out LOD levels, a selected node\'s pop-up card no longer renders on top of the open Detail Panel during canvas drag. Tooltip portal z-index lowered below the panel.',
                ]},
                { version: '0.11.10', date: '2026-04-30', label: 'Phase 11D.4', items: [
                  'Fix: pulled-in Evaluation Result nodes (proof-only Disclosure) now sit 400px left of the source Claim instead of 200px right — no more card overlap. The new column shares slot with the actor\'s own Evaluation Results; y separation keeps them from colliding.',
                  'Fix: Claim Detail Panel "Referenced Assets" count now reflects what the viewer can actually see. A Selective grantee whose DA covers 1 of 3 referenced Assets now reads "Referenced Assets (1)" instead of the Claim\'s full "(3)".',
                ]},
                { version: '0.11.9', date: '2026-04-29', label: 'Phase 11D.3', items: [
                  'New: proof-only Disclosure now materializes the chosen Evaluation Results onto the grantee\'s canvas. Each disclosed Eval Result appears as a node next to the source Claim with a proof-only-styled edge connecting them',
                  'New: under proof-only, the Claim Detail Panel\'s Referenced Assets section reads "(0) — No Assets disclosed under this agreement." Proof-only doesn\'t expose Assets; only the evaluation outcome is shared',
                  'New: Evaluation Results rows in the Claim Detail Panel are now clickable — click pans to the Eval Result node and opens its Detail Panel. Works for all viewers, not just proof-only',
                  'Polish: Eval Result Detail Panel section renamed Evaluator → Owner, with a new "Claim" row showing the linked Claim name. Useful for proof-only grantees who want to confirm what the pulled-in Eval Result evaluates',
                ]},
                { version: '0.11.8', date: '2026-04-29', label: 'Phase 11D.2', items: [
                  'New: Selective Disclosure grantees now see how many parsed fields each referenced Asset discloses on the Claim Detail Panel — a muted "{N} fields" label sits next to each Asset row\'s Expand button',
                  'New: Expand modal renders a parsed-fields table (label + value + confidence) for Selective grantees instead of the file viewer — the underlying file isn\'t disclosed under Selective, only the fields are',
                  'Polish: Selective grantees\' JSON tab in the Expand modal shows only the disclosed portion ({ assetId, name, owner, disclosureType, disclosedFields }) — file URI / hash / filename / localPath are no longer exposed in the JSON for fields they aren\'t entitled to see',
                ]},
                { version: '0.11.7', date: '2026-04-29', label: 'Phase 11D.1', items: [
                  'Polish: trimmed the "already on your network" error copy on the Request Agreement modal — second sentence removed',
                  'Polish: Run Evaluation modal header expands "EA" → "Evaluation Agreement" and the review-stage left panel reads "Assets" instead of "Evidence"',
                ]},
                { version: '0.11.6', date: '2026-04-29', label: 'Phase 11D', items: [
                  'New: Request Agreement modal now blocks PINs that resolve to a Claim already on your network — the error steers you to the Detail Panel instead of firing a duplicate request',
                  'Fix: counterparty-pulled Asset Detail Panels no longer leak the file\'s metadata or registration timestamp. You see the Asset name, description, owner, and an "Open Evidence Viewer" button — disclosure is directional',
                  'New: provisional Claim cards now show a ✕ Cancel Request action-bar button for the requester. Click cancels the pending DA / EA request, plays the unravel animation, and dismisses the responder\'s notification',
                  'New: yellow notification dot on the user menu chrome button when another role has un-dismissed notifications, plus per-role dots inside the SWITCH USER dropdown — guides the demo through multi-role flows',
                  'Fix: Bob\'s anchor Asset no longer gets a stale NEW badge after a disclosure is accepted. NEW now fires only when the Asset is genuinely new to your view (counterparty pull-in), not on Assets you already own',
                  'Polish: Run Evaluation modal renamed "Evidence in scope" → "Assets in scope" and aligned related copy. Internal naming kept; user-facing terminology is now consistent with V2.2 model',
                ]},
                { version: '0.11.5', date: '2026-04-29', label: 'Phase 11C.5', items: [
                  'Fix: NEW badge + orange tint on a freshly-accepted Claim now persist until you deselect the node (previously cleared at the end of the reveal animation, ~500ms after completion). The reveal-window provisional render still clears at reveal completion as before, but the "this is new, take a look" treatment hangs around until you move on',
                ]},
                { version: '0.11.4', date: '2026-04-29', label: 'Phase 11C.4', items: [
                  'Fix: the disclosure edge connecting to a recently-accepted Claim now also animates from provisional (dashed) to active (solid) during the reveal flip, alongside the Claim card. Edges incident to the recently-accepted Claim are stamped with the same provisional flag during the reveal window',
                  'Fix: warm-path Evaluation Agreement acceptance now triggers the reveal animation. The notification handler had been taking a simple-pan path; extended the cold-path reveal-trigger predicate to the warm-path handler so v22-ea-accepted clicks fire the flip animation when the Claim is freshly accepted',
                ]},
                { version: '0.11.3', date: '2026-04-29', label: 'Phase 11C.3', items: [
                  'Fix: the reveal animation that plays when an agreement is accepted now visually flips from provisional → active state (was playing from active → active because the artifact had already finalized). The flip mid-animation hand-off is now visible',
                  'Cleanup: reveal animation logic migrated out of inline V2App.jsx into src/v2/animations/reveal.js, parallel to the existing unravel primitive',
                  'Polish: Expand icon button is now a shared component used everywhere — Asset / Parse Result / Eval Result rows on the Claim Detail Panel and the Evaluation Agreement Detail Panel header all show the same two-opposing-corner-arrows icon',
                ]},
                { version: '0.11.2', date: '2026-04-29', label: 'Phase 11C.2', items: [
                  'Fix: the reveal animation that plays when an agreement is accepted (provisional Claim flips to active) finally fires. The flag the V2.1-era guard reads was dead infrastructure since the V2.2 retreat — wiring it back in surfaces the existing flip animation on cold-path and warm-path acceptance alike',
                  'New: Claim Detail Panels now show an Acknowledgments section listing the pre-set terms the Claim owner authored. Visible to all viewers',
                  'New: Evaluation Agreement Detail Panels gained an Expand button (header) that opens the raw EA JSON in the same modal pattern as Asset / Parse / Eval Result expands',
                  'Polish: response modal title in EA-only mode now reads "Respond to Evaluation Agreement Request" (was "Respond to EA Request"); decline title spells it out the same way',
                  'Polish: read-only acknowledgment chips on the response modal turned grey instead of indigo — they read as locked rather than actionable',
                ]},
                { version: '0.11.1', date: '2026-04-29', label: 'Phase 11C.1', items: [
                  'Architectural correction: Evaluation Agreement terms are set by the responder (Claim owner), not the requester. Removed the result-confidentiality / attribution checkboxes from the requester-side modals',
                  'New: Claims can carry pre-set acknowledgments (title + description). When you create a Claim, an Acknowledgments section lets you author terms requesters must accept before requesting Disclosure or Evaluation Agreements',
                  'Cold path Step 2 + warm path EA request modal both render the target Claim\'s acknowledgments as required checkboxes. Submit gates on every box checked. Zero-ack Claims proceed directly',
                  'Response modal step 3 shows a read-only "Requester accepted these acknowledgments" panel listing the requester\'s acceptances; the responder still authors the agreement\'s expiry',
                  'Fix: cold path requests now correctly render in provisional state on the requester\'s canvas',
                  'Fix: when an Evaluation Agreement is accepted on the warm path, the requester\'s Claim transitions provisional → active with the same reveal animation as the cold path, and the responder\'s canvas pans to the newly-pulled-in Asset',
                  'Fix: dismissing a declined Claim now plays the unravel animation before removing the node from the canvas',
                  'Fix: opening the Public Directory now clears any active node selection, so the Detail Panel doesn\'t persist over the directory layer',
                ]},
                { version: '0.11.0', date: '2026-04-29', label: 'Phase 11C', items: [
                  'New: Disclosure and Evaluation Agreements now have distinct request flows. Cold-path Request Agreement modal split into two steps — Step 1 picks the target Claim and suggests Requirements Sets; Step 2 sets the Evaluation Agreement\'s expiry (defaults to 1 year) and acknowledgments (result confidentiality + attribution)',
                  'Warm path: when you already have a Disclosure Agreement on a Claim but no Evaluation Agreement, a Request Evaluation Agreement button appears on the Claim Detail Panel + canvas action bar (▷). Submits a single-step EA request without renegotiating the existing DA',
                  'Dave (ChipCo) is now a switchable role alongside Bob, Alice, and Carol. Bob can request an EA from Dave through the warm path; Dave responds via the standard response flow showing only the EA terms (DA scope is unchanged)',
                  'Three new notifications: an EA-only request lands on the grantor\'s inbox; accept/decline outcomes notify the requester. Click an EA request to respond; click an accept/decline to pan to the Claim',
                  'Demo-only EA expiry check: clicking Run Evaluation refuses to open if the agreement\'s deadline is past, with a copy hint pointing toward requesting a new agreement',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 11B', items: [
                  'New: ChipCo cluster in the Public Directory is now clickable. Click materializes a Claim card on top of the cluster + opens its Detail Panel for browsing the Claim and its referenced Assets',
                  'Restored a V2/V2.1 Detail Panel feature lost in the V2.2 retreat: an Expand button on referenced-Asset rows opens a two-tab modal (Output / JSON). Output tab shows the file in an iframe with metadata header; JSON tab shows the raw artifact JSON',
                  '3 placeholder PDFs generated for ChipCo so the iframe has something real to render. Existing Assets matching /public/ PDFs (Power Reg, Voltage Regulator, EMI Shield) backfilled with localPath',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 11A.1', items: [
                  'Fixed: actor corner card in the Public Directory now actually shows its hover tooltip — positioning was on the inner card div instead of the Tooltip wrapper, so the wrapper had zero size for hover detection',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 11A', items: [
                  'New: ChipCo (Dave) seeded as a fourth actor — IC supplier whose catalog Bob has visibility into via a pre-existing Disclosure Agreement. No Claims on Bob\'s canvas yet (a future phase will let him request an Evaluation Agreement)',
                  'Public Directory: the ElectroGrid mock cluster replaced with a real ChipCo cluster. Per-role visibility — only actors with an active DA from ChipCo see the cluster. Other clusters unchanged for all roles',
                  'Public Directory: bottom-left corner anchor refreshed from a circle button into a proper Actor node card matching the parent-layer style. Click still returns to your network',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 10.4', items: [
                  'Cleanup: legacy Library modals relocated to src/components/modals/library/ as RequirementsPanel.jsx + ParsingTemplatesPanel.jsx. No user-visible change',
                  'Architecture spec gained a §8.6 Library section + Phase 9D + 10.x entries in the Changelog; §17.1 future-direction reference updated to past tense',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 10.3', items: [
                  'Library: the two chrome buttons (Requirements Library + PEP Template Library) collapsed into one. Click "Library" to see Parsing Templates, Requirement Sets, and Published Requirements as tabs in a single modal',
                  'Renamed "PEP Template" → "Parsing Template" in user-facing copy (the data model still uses PEP per the canon)',
                  'New "Published Requirements" tab — read-only browse of all requirement sets published to the network, including your own',
                  'A "published_standard" notification now opens the Library on the Published tab so you land where the new standard lives',
                ]},
                { version: '0.10.0', date: '2026-04-28', label: 'Phase 10.2.1', items: [
                  'Layout: every node card now snaps to the dot grid (positions are multiples of 100 on both axes)',
                  'Rows distribute symmetrically around the actor — some above, some below — instead of stacking downward only',
                  'Disclosure edges between adjacent columns no longer share horizontal lines; columns alternate Y offsets so edges gain vertical separation',
                ]},
                { version: '0.10.0', date: '2026-04-27', label: 'Phase 10.2', items: [
                  'New: Assets can now be registered under other Assets, restoring single-party hierarchy. Open an Asset and click "+" or "Register Asset" — the new child appears one column to the right with an edge from its parent',
                  'Detail Panel surfaces "Parent" and "Children" sections on Asset panels — clickable rows pan/zoom to the target',
                  'Layout: when hierarchy is present, downstream columns (Parse / Claims / Eval / Pulled / Public) shift right to accommodate the deepest tree; without hierarchy the layout is byte-identical to before',
                  'Counterparties never see hierarchy — it remains owner-only',
                ]},
                { version: '0.10.0', date: '2026-04-27', label: 'Phase 10.1', items: [
                  'Register Asset modal copy rewritten to use plain language — no more "V2.2 Asset", "internal (Full) Disclosure Agreement", or "filename stem" leaking into the user-facing surface',
                ]},
                { version: '0.9.10', date: '2026-04-27', label: 'Phase 9D.2.4', items: [
                  'Fixed: edges no longer reappear at full length mid-unravel — they stay retracted from Stage 1 through to artifact removal',
                ]},
                { version: '0.9.10', date: '2026-04-27', label: 'Phase 9D.2.3', items: [
                  'Edge retract animation now walks the line\'s terminus along its existing curve instead of curling the line inward',
                  'Dismissing a revoked node now closes the Detail Panel first so selection state doesn\'t compete with the unravel choreography',
                  'Stage 3 content rows now delete right-to-left like a backspace-key wipe instead of a generic opacity fade',
                ]},
                { version: '0.9.10', date: '2026-04-27', label: 'Phase 9D.2.2', items: [
                  'Fixed: revoked agreement edges now actually render in red (the styling was being overwritten on hover/select/zoom)',
                  'Fixed: dismissing a revoked node no longer double-pans the camera during the unravel animation',
                  'Added a slow-mode multiplier in the unravel module — bump the constant to slow the entire choreography for QA without redoing every timing',
                ]},
                { version: '0.9.10', date: '2026-04-27', label: 'Phase 9D.2.1', items: [
                  'Revoked agreement edges now persist on the canvas in a red, dimmed visual state — visible from revocation through Dismiss',
                  'Dismiss no longer jitter-pans when the node is already visible alongside an open Detail Panel',
                  'Unravel animation now plays as four distinct stages with a counter-clockwise border-erasure overlay, staggered content fade, and card settle-fade — instead of the single-keyframe collapse that shipped with 9D.2',
                ]},
                { version: '0.9.10', date: '2026-04-26', label: 'Phase 9D.2', items: [
                  'New: dismissed revoked nodes now play an unravel animation — pan/zoom to the node, edges retract back into their counterpart cards, then the card erodes and settles before disappearing',
                  'Animation fires on Case A (revoked Claim Dismiss) and on the orphaned-Evaluation-Result Dismiss flow',
                  'Other "leaves the canvas" scenarios can call the same primitive when they ship',
                ]},
                { version: '0.9.10', date: '2026-04-26', label: 'Phase 9D.1.6', items: [
                  'Fixed: when a counterparty revokes your Disclosure Agreement, your Evaluation Result on your own canvas no longer loses its ownership edge to your Asset',
                ]},
                { version: '0.9.10', date: '2026-04-26', label: 'Phase 9D.1.5', items: [
                  'Fixed: when you revoke a Disclosure Agreement, the counterparty\'s Evaluation Result now disappears from your canvas immediately instead of waiting for them to dismiss it on their side',
                ]},
                { version: '0.9.10', date: '2026-04-26', label: 'Phase 9D.1.4', items: [
                  'Fixed: dismissing an orphaned Evaluation Result now actually removes it from the canvas (the dismiss button was silently no-opping for seeded results)',
                  'When you revoke a Disclosure Agreement, the counterparty\'s Evaluation Results now also disappear from your canvas — you no longer see their orphaned results lingering',
                  'Replaced the browser confirmation dialog for orphaned-Evaluation-Result Dismiss with a styled modal',
                  'Tightened the inline copy on the grantor\'s view of a grantee-initiated Disclosure Agreement revocation',
                ]},
                { version: '0.9.10', date: '2026-04-24', label: 'Phase 9D.1.3', items: [
                  'Disclosure-Agreement revocations by the grantee now show the dismiss ceremony inline on the affected DA row on the grantor\'s panel (matching the EA pattern shipped in 9D.1.2)',
                  'Evaluation Results now persist across Disclosure Agreement revocation — they remain in your Qualified Storage and on your canvas',
                  'Orphaned Evaluation Results (where the backing agreement has been revoked) can be dismissed individually from each Result\'s Detail Panel',
                  'Revocation copy refreshed across all four cases to reflect Evaluation Result persistence',
                  'Revoked Claim cards now render with an opaque red-tinted background at all zoom levels',
                  'REVOKED badge now supersedes PROVISIONAL and DECLINED badges on the same Claim',
                  'Tooltip arrow alignment now respects the tooltip\'s actual width — arrow stays attached on near-edge anchors',
                ]},
                { version: '0.9.10', date: '2026-04-24', label: 'Phase 9D.1.2', items: [
                  'Evaluation-Agreement-only revocations now show the dismiss ceremony inline on the affected EA row — the Claim-level notice is used only when the Claim itself is being removed',
                  'Detail Panel auto-scrolls to the revoked EA row when you click its notification',
                  'Evaluation Results now correctly persist when an Evaluation Agreement is revoked (they are independent artifacts)',
                  'Tooltip arrow alignment fixed — small visual offset on Amend / Revoke row tooltips',
                ]},
                { version: '0.9.10', date: '2026-04-22', label: 'Phase 9D.1.1', items: [
                  'Fixed: Dismissing a revoked Claim now actually dismisses it — previously the seeded agreement would reappear after dismiss',
                  'Revoked agreements now show the revocation date (not the original created date)',
                  'Grantees can now revoke agreements from both the Agreements section and the Agreement Detail Panel footer — previously only grantors could',
                  'Added Revoke button to Disclosure + Evaluation Agreement Detail Panel footers',
                  'Evaluation-Agreement-only revocations now show a notice to the viewer on their Claim (Case C was silently swallowed)',
                  'Revocation notice section redesigned to match the standard Detail Panel look',
                  'Dismiss button is now a single, consistent footer action (removed duplicate inline)',
                ]},
                { version: '0.9.10', date: '2026-04-22', label: 'Phase 9D.1', items: [
                  'Revocation notifications no longer open a modal — clicking a revocation notification now opens the Detail Panel with a new revocation notice section inline',
                  'Four case-routed copy variants (grantor/grantee-initiated, Disclosure/Evaluation Agreement) replace the one-size-fits-all modal copy',
                  'Revoked Disclosure and Evaluation Agreements now render dimmed in the Agreements section for pre-Dismiss context',
                  'Dismiss button now accent-colored and prominent; non-Dismiss exit (ESC / click away) preserves the revoked state until you explicitly dismiss',
                ]},
                { version: '0.9.10', date: '2026-04-22', label: 'Phase 9E-parallel.4', items: [
                  'Fixed: Qualified Storage picker preview pane now hides when you uncheck all files (previously lingered on the last-clicked file)',
                  'Adjusted seed data so the multi-select summary\'s Modified-date collapse is demo-visible',
                ]},
                { version: '0.9.10', date: '2026-04-22', label: 'Phase 9E-parallel.3', items: [
                  'Fixed: Qualified Storage picker multi-select summary now reliably shows when you select 2+ files — inspecting any file in the list no longer dismisses the summary (#94)',
                  'Selections in Qualified Storage and Local Storage tabs are now mutually exclusive — switching tabs clears the other tab\'s selection (#125)',
                ]},
                { version: '0.9.10', date: '2026-04-21', label: 'Phase 9E-parallel.1', items: [
                  'Restored background dot matrix to full brightness at all zoom levels',
                  'Brightened node dot ring so nodes clearly pop against the grid at dot zoom (#60)',
                ]},
                { version: '0.9.10', date: '2026-04-21', label: 'Phase 9E-parallel', items: [
                  'Cleaned up unused V2.1 prop forwarding in V2Canvas (#51)',
                  'Fixed a render warning about conflicting border styles on node cards (#107)',
                  'Adjusted background grid opacity at dot zoom (reversed in 9E-parallel.1)',
                ]},
                { version: '0.9.10', date: '2026-04-21', label: 'Phase 9D', items: [
                  'New: Revoke Disclosure and Evaluation Agreements — from the Agreements section in any node Detail Panel',
                  'Revoked Disclosure Agreements propagate correctly: the paired Evaluation Agreement and any dependent Eval Results are also revoked',
                  'Revocation is bidirectional — either party can initiate',
                  'Notifications show revocation reason and cascade context; Dismiss removes revoked artifacts from your canvas',
                ]},
                { version: '0.9.9', date: '2026-04-21', label: 'Phase 9C', items: [
                  'New: Agreements section in Actor, Asset, and Claim Detail Panels — lists all Disclosure and Evaluation Agreements for the selected node',
                  'Click any agreement row to jump to its edge on the canvas and open the agreement\'s details',
                  'Amend available directly from the row (for grantors of Disclosure Agreements); Revoke placeholder pending next release',
                ]},
                { version: '0.9.8', date: '2026-04-21', label: 'Phase 9B.3', items: [
                  'Edge menu now appears at the midpoint between endpoint cards — position is consistent regardless of where on the edge you clicked',
                ]},
                { version: '0.9.7', date: '2026-04-21', label: 'Phase 9B.2', items: [
                  'Improved edge hover visibility on Selective, Proof-only, and Provisional (dashed) disclosures',
                  'Fixed edge highlight persistence — selected edge stays bright through pan/zoom and re-renders',
                  'Tooltip now fades during canvas animation instead of drifting above nodes',
                  'Larger cursor indicator (32px) on edge hover; appears more reliably under rapid cursor movement',
                ]},
                { version: '0.9.6', date: '2026-04-21', label: 'Phase 9B.1', items: [
                  'Edge hover/selection menu refined with clearer hover-vs-click affordances',
                  'Cursor-centered dot bumped to 24px so it reads as a clear indicator',
                  'Tooltip now follows the clicked edge point as the canvas pans and zooms',
                  'Cleaned up outdated Requirements Sets display in Evaluation Agreement panel',
                ]},
                { version: '0.9.5', date: '2026-04-21', label: 'Phase 9B', items: [
                  'Edge hover brightens the edge line itself (weaker variant of selection brightening)',
                  'Cursor-centered dot appears under the cursor when hovering an edge, colored by SDA type',
                  'Hover tooltip moved to top-left of cursor (was bottom-right); flips to bottom-right at viewport edges',
                  'Edge click pins a rich menu at the click point: View Disclosure Agreement + View Evaluation Agreement rows',
                  'Menu shows SDA type illustration, endpoints with party owners, and EA expiration date when present',
                  'Whole-row hover highlights on menu items; selection persists with existing brightness + stroke treatment',
                ]},
                { version: '0.9.4', date: '2026-04-21', label: 'Phase 9A.6.2.1', items: [
                  'Fixed: newly-registered Assets now visible in counterparty Claim Detail Panels and Run Evaluation modals. Previously 2 newly-created Assets were missing from a 7-Asset Claim on the counterparty\'s side.',
                ]},
                { version: '0.9.3', date: '2026-04-20', label: 'Phase 9A.6.1', items: [
                  'Multi-file Asset registration now shows the NEW badge on every Asset, not just the first',
                  'Actor Detail Panel DOT row now displays the party DOT (was showing empty)',
                  'Hashing sequence finalized to match V2.1: amber Hashing... → blue Endorsing on ledger... → green ✓ Hashed + hash badge, staggered across files',
                  'Action buttons now appear on hover at mini and dot zoom levels (previously required selecting the node first)',
                  'Spec §11.7 documents the prototype\'s file-custody assumption (replication model)',
                ]},
                { version: '0.9.2', date: '2026-04-20', label: 'Phase 9A.6', items: [
                  'Register multiple Assets in a single flow — each file becomes its own Asset with editable display name',
                  'Local Storage tab in the file picker — drag-and-drop or click to upload from your machine (simulated upload into Qualified Storage)',
                  'Per-file hashing sequence visible on each file before registration; mock SHA-256 appears as a click-to-copy badge',
                  'Credit cost for Registering (5 credits/Asset) and Claiming (25 credits/Claim); Insufficient Credits state blocks submit',
                  'Actor Detail Panel DOT is now click-to-copy',
                  'Notification bell tooltip no longer sticks after click; Parse Template + Requirements Set pickers scale to long lists',
                ]},
                { version: '0.9.1', date: '2026-04-20', label: 'Phase 9A.5', items: [
                  'Transfer accept now draws ownership edge to the recipient\'s Actor node (demo-blocking fix)',
                  'Transfer accept/decline moved into V22TransferResponseModal — inline notification buttons replaced by modal response (matches Disclosure Request pattern)',
                  'Transfer "Resolved" chip now shows party name only; PIN errors split into three distinct messages (self / Radiant Network / unknown)',
                  'Redundant Actor → Claim edge removed (ownership cascades through referenced Assets)',
                  'Disclosure Response Asset picker now defaults to zero-selected',
                  'architecture-spec.md §2.6 expands "DID" (Decentralized Identifier) on first use',
                ]},
                { version: '0.9.0', date: '2026-04-20', label: 'Phase 9A.4', items: [
                  'Transferring process shipped — seventh and final platform process, completing the 7-process demo',
                  'Asset ownership can now be transferred between parties via Transfer action on Asset cards/panels',
                  'Recipient receives notification, accepts or declines; transfers recorded on Asset\'s provenance chain',
                  'Structured DOT data model aligned with client canon — every Asset, Claim, and Eval Result carries a DOT with identity, hash, owner DID, and lineage',
                  'PIN resolution on transfer: catches self, Radiant Network, and unknown-PIN rejection cases',
                  'Sender-side TRANSFERRING badge while pending; cancel-while-pending supported',
                ]},
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

      {/* Phase 10.3: unified Library modal — Parsing Templates + Requirement
          Sets + Published Requirements in a single three-tab dialog.
          Reachable from the chrome Library icon, from the published_standard
          notification (deep-links to the Published tab), and from the legacy
          `open-pep-library` event (deep-links to the Parsing tab). */}
      {showLibrary && (() => {
        const closeLibrary = () => {
          setShowLibrary(false)
          setLibraryInitialSetId(null)
          setLibraryInitialTab(null)
        }
        return (
          <LibraryModal
            pepTemplates={pepTemplates}
            requirementSets={requirementSets}
            publishedRequirementSets={publishedRequirementSets}
            onSavePepTemplate={handleSavePEPTemplate}
            onSaveRequirementSet={handleSaveRequirementSet}
            onPublishRequirementSet={handlePublishRequirementSet}
            initialTab={libraryInitialTab || 'requirements'}
            initialSelectedId={libraryInitialSetId}
            onClose={closeLibrary}
          />
        )
      })()}
    </div>
  )
}
