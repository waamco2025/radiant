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
  // Phase 11.6 (#164): amendment-as-proposal model — superseded the
  // unilateral `makeAmendedEvaluationAgreement` Phase 11E.1 helper.
  proposeEvaluationAgreementAmendment,
  acceptEvaluationAgreementAmendment,
  rejectEvaluationAgreementAmendment,
  diffAcknowledgments,
  makeParseRunArtifacts,
  makeAssetRegistrationArtifacts, makeClaimCreationArtifacts,
  makeTransferRecord, makeAsset, makeDotObject,
  makeInternalDisclosureAgreement,
  makeRevocationRecord,
  buildV22SharedArtifacts, mergeProvisionals,
  // Phase 17.1: closed-RFP lifecycle merge layer.
  mergeClosedRfps,
  // Phase 17.2: RFP solicitation factory + merge layer.
  makeRfpSolicitation, mergeSolicitations,
  // Phase 17.2.1: acceptSolicitation transitions a pending solicitation to
  // accepted with a reference to the resulting EA's id.
  acceptSolicitation,
  // Phase 11B: synthetic-node helper used by the directory cluster-click
  // flow so V22NodeDetailPanel can render for a Claim that lives only on
  // the directory layer (no parent-canvas node present).
  buildClaimNodeForDirectoryMaterialization,
  // Phase 11C: warm-path EA-only request factories.
  makeProvisionalEvaluationAgreement, finalizeProvisionalEvaluationAgreement,
  // Phase 12.1 (#120): RS supersession lookup for the Claim Detail Panel
  // "Newer version available" pill.
  getLatestRSVersion,
  // Phase 12.2 (#117 + #122): Asset versioning helpers used by the
  // AmendClaim handler (OUTDATED detection) and the Run Evaluation modal
  // (re-run diff banner / Detail Panel section).
  isEvalResultStale,
  getLatestAssetVersion,
  computeEvidenceDiff,
  // Phase 13.3 (Step 2): Re-Run gating helper.
  hasNewAssetsForRerun,
  // Phase 13 (#168): PoE factory for the Create-PoE flow.
  makePoE,
  // Phase 13.1 (#168a): id helper + proof-only DA factory for the
  // PoE-creation disclosure transition.
  makeArtifactId,
  makeProofOfEvalDisclosureAgreement,
  // Phase 14.1 (#169 part 2): Badge Issuance factory + helpers.
  makeBadgeIssuance,
  getBadgesForPoE,
  getBadgesForClaim,
  getBadgesForRecipient,
  // Phase 17.3: shared predicate for resolving an active EA between the
  // active actor (grantee) and a Claim owner (grantor) on a specific Claim.
  // Drives the Directory-layer Claim panel + card EA-status CTAs.
  getActiveEaForClaimAndRequester,
} from './v2_2Data.js'
import EdgeHoverMenu from './EdgeHoverMenu.jsx'
import DisclosureAgreementDetailPanel from '../components/DetailPanel/DisclosureAgreementDetailPanel.jsx'
import EvaluationAgreementDetailPanel from '../components/DetailPanel/EvaluationAgreementDetailPanel.jsx'
import V22NodeDetailPanel from '../components/DetailPanel/V22NodeDetailPanel.jsx'
// Phase 17.0: read-only Detail Panel for RFP markers on the Directory.
import RfpDetailPanel from '../components/DetailPanel/RfpDetailPanel.jsx'
// Phase 17.2: solicitation create / reject modals.
import SolicitationCreateModal from '../components/modals/SolicitationCreateModal.jsx'
import RequirementsSetDetailModal from '../components/modals/RequirementsSetDetailModal.jsx'
// Phase 17.2.1.1: AssetPickerModal removed from the RFP Accept flow (the
// Accept flow now uses the RFP's `assetId` directly).
// Phase 17.3: AssetPickerModal re-mounted for the Directory-layer Claim
// CTA flow — non-owner viewing a Claim with no existing EA clicks
// "Request Evaluation Agreement", which opens AssetPickerModal so they
// pick which of their Assets the request will anchor to before the
// existing CombinedRequestModal cold path runs.
import AssetPickerModal from '../components/modals/AssetPickerModal.jsx'
import SolicitationRejectModal from '../components/modals/SolicitationRejectModal.jsx'
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
// Phase 11E.4 (#139 fix): two-edge reveal animation orchestrator. Adds
// a typed-style overlay edge to V2Canvas's reveal-overlay group, animates
// its geometry from a stub at the anchor to full curve length, then
// fades out the dashed-grey provisional edge concurrent with the Claim
// card flip. Pre-fix Phase 11E.3 mutated the canonical edge directly —
// the visual conflated the two edges and never produced the "supplier
// reaches out" effect Andrew's spec called for.
import { playRevealEdgeAnimation } from './animations/edgeDrawIn.js'
// Phase 9D.1: V22RevocationNoticeModal is no longer mounted — notification
// click now routes into the Detail Panel. File kept as dead code pending the
// #50 dead-handler sweep. Import removed to keep the V2App surface clean.
// import V22RevocationNoticeModal from '../components/modals/V22RevocationNoticeModal.jsx'
import AmendClaimModal from '../components/modals/AmendClaimModal.jsx'
import UpdateRSReferenceModal from '../components/modals/UpdateRSReferenceModal.jsx'
import AmendDisclosureModal from '../components/modals/AmendDisclosureModal.jsx'
// Phase 13 (#168): Create-Proof-of-Evaluation confirmation modal.
import CreatePoEModal from '../components/modals/CreatePoEModal.jsx'
// Phase 14.1 (#169 part 2): Badge Issuance + Revocation modals.
import IssueBadgeModal from '../components/modals/IssueBadgeModal.jsx'
import RevokeBadgeModal from '../components/modals/RevokeBadgeModal.jsx'
import AmendEvaluationAgreementModal from '../components/modals/AmendEvaluationAgreementModal.jsx'
// Phase 11.6 (#164): grantee-side response modal for amendment proposals.
import AmendmentResponseModal from '../components/modals/AmendmentResponseModal.jsx'
// Phase 10.3: unified Library modal replaces RequirementsLibraryModal +
// PEPLibraryModal. The two legacy files are retained as embeddable panels
// (consumed by LibraryModal in `embedded` mode); their default-export
// standalone forms are no longer mounted from V2App.
import LibraryModal from '../components/modals/LibraryModal.jsx'
import { Backdrop, Modal, ModalHeader, ModalBody, ModalFooter, Btn } from '../components/modals/ModalShared.jsx'
import { getRequirementSetsForRole, SEED_PUBLISHED_REQUIREMENT_SETS } from './requirementSets.js'
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
  // Phase 12.1 (#120): inline supersession-update state. Shape:
  // { claimId, fromRsId, toRsId } — driven from the V22ClaimPanel
  // "Newer version available" pill (owner only) and consumed by
  // UpdateRSReferenceModal.
  const [v22UpdatingRsReference, setV22UpdatingRsReference] = useState(null)
  const [v22AmendingDaId, setV22AmendingDaId] = useState(null) // disclosure agreement id being amended
  // Phase 11E.1 (#108): evaluation agreement id being amended via the new
  // AmendEvaluationAgreementModal flow.
  const [v22AmendingEaId, setV22AmendingEaId] = useState(null)
  // Phase 13 (#168): Create-Proof-of-Evaluation modal context. Null when
  // closed; { evalResultId } when the user clicked Create PoE on an Eval
  // Result card or Detail Panel footer.
  const [v22CreatingPoEContext, setV22CreatingPoEContext] = useState(null)
  // Phase 11.6 (#164): grantee-side state for the AmendmentResponseModal.
  // Set when the grantee clicks a `v22-ea-amendment-proposal` notification;
  // shape: { eaId, amendmentId } | null. Cleared on accept / reject /
  // close.
  const [v22RespondingToEaAmendment, setV22RespondingToEaAmendment] = useState(null)
  const [v22RecentlyAcceptedClaimId, setV22RecentlyAcceptedClaimId] = useState(null) // drives _isNew + _wasProvisional
  // Phase 11C.5 W1: separate state var for the reveal-window-only
  // `_showAsProvisional` stamp on the recently-accepted Claim and its
  // incident edges. Cleared by `playRevealAnimation`'s onDone callback at
  // phase 'done' — _decoupled_ from `v22RecentlyAcceptedClaimId` (which is
  // cleared by the deselect-aware effect at line 2141 so the NEW badge
  // persists until the user moves selection off the node).
  const [v22RevealActiveClaimId, setV22RevealActiveClaimId] = useState(null)
  // Phase 11E.7: per-role map of pending reveal claim ids. The grantee's
  // view of an incident Claim + edges should render `_showAsProvisional`
  // from the moment of acceptance until the grantee clicks the
  // `acceptance` / `v22-ea-accepted` notification (which fires
  // `startReveal` and clears the pending entry). Populated by the
  // acceptance handlers; drained by the notification click handler.
  // Without this, the Claim renders in active state pre-click and the
  // reveal animation reads as "regressing then re-reaching active"
  // rather than a true first-time materialization.
  const [v22PendingRevealsByRole, setV22PendingRevealsByRole] = useState({})
  // Phase 9A.6.1 Fix 1: holds null, a single id, or an array of ids. Array
  // form supports multi-file Asset registration where all N new Assets need
  // the NEW badge. Consumers normalise via `toIdArray(...)` below.
  const [v22RecentlyAcceptedAssetId, setV22RecentlyAcceptedAssetId] = useState(null)
  const [v22PanToClaimId, setV22PanToClaimId] = useState(null) // drives pan-to-node on creation/accept
  // V2.2 Phase 7 — Directory Layer + AI Shopper (spec §8 / §9)
  const [v22DirectoryOpen, setV22DirectoryOpen] = useState(false)
  // Phase 11.8 #44: when the Radiant Network actor node is double-clicked,
  // we route the directory's circular wipe through the node's screen-space
  // center instead of the chrome globe-button corner. Null = use default
  // bottom-left origin (globe button click path).
  const [v22DirectoryWipeOrigin, setV22DirectoryWipeOrigin] = useState(null)
  // Phase 11B: when the user clicks the ChipCo cluster in the Directory,
  // we materialize one of ChipCo's Claims as a card on top of the cluster
  // Phase 16.0: per-dot Directory click → opens the Detail Panel for the
  // selected Claim. Replaces Phase 11B's `v22DirectoryMaterializedClaim`
  // state machine (which materialized a Claim card on top of a cluster
  // hit-area). Setting null dismisses both the tooltip pin and the panel.
  const [v22DirectorySelectedClaim, setV22DirectorySelectedClaim] = useState(null)
  // Phase 17.3 — in-flight context for the Directory-layer Claim Request EA
  // CTA. Set when the user clicks Request EA on a Directory Claim card or
  // panel footer; gates AssetPickerModal mount. Cleared on AssetPickerModal
  // cancel or after a successful asset pick (which opens CombinedRequestModal).
  const [v22RequestingEaForClaim, setV22RequestingEaForClaim] = useState(null) // Claim | null
  // Phase 17.0: clicking an RFP marker on the Directory opens the read-only
  // `RfpDetailPanel` (mounted below). Mutual exclusion with
  // `v22DirectorySelectedClaim` is enforced at the click-handler level —
  // each setter clears the other so only one Detail Panel is visible at a
  // time. `v22DirectoryOpen` toggling clears both.
  const [v22DirectorySelectedRfp, setV22DirectorySelectedRfp] = useState(null)
  // Phase 17.3.1: when non-null, RequirementsSetDetailModal mounts and
  // resolves this id against `publishedRequirementSets`. Click on a
  // Requirements row in RfpDetailPanel sets it; the modal's Close clears it.
  const [v22OpenRsId, setV22OpenRsId] = useState(null)
  // Phase 17.1: session-state Map<rfpId, ISO closedDate> for owner-side
  // Close / Reopen transitions on RFPs. Mirror of the `v22Provisionals`
  // pattern — overlaid on the shared artifact set via `mergeClosedRfps`
  // before per-role view construction. Map storage so the closedDate is
  // stable across re-renders (a Set + regenerating-on-render would shift
  // the timestamp every paint). Closed RFPs are visible to the owner with
  // a dashed-outline visual treatment at every Directory LOD; non-owners
  // see them filtered out by `buildV22DirectoryDataForRole`.
  const [v22ClosedRfpIds, setV22ClosedRfpIds] = useState(() => new Map())
  // Phase 17.2: session-state Map<solicitationId, RfpSolicitation> for
  // seller-initiated solicitations against an RFP. Mirror of
  // `v22ClosedRfpIds` shape — Map so updates (rejection, response date)
  // mutate in place via setV22Solicitations(prev => new Map(prev).set(...)).
  // Overlaid on the shared artifact set via `mergeSolicitations`. Demo
  // participants create these in real time; seed set is empty.
  const [v22Solicitations, setV22Solicitations] = useState(() => new Map())
  // Phase 17.2: transient UI state for the solicitation modals.
  // `v22SolicitOpenForRfp` — non-null when SolicitationCreateModal should
  // render (`{ rfp }`); null when closed.
  // `v22SolicitationToReject` — non-null when SolicitationRejectModal
  // should render (the target solicitation object); null when closed.
  const [v22SolicitOpenForRfp, setV22SolicitOpenForRfp] = useState(null)
  const [v22SolicitationToReject, setV22SolicitationToReject] = useState(null)
  // Phase 17.2.1: in-flight Accept-flow context. Set when the RFP owner
  // clicks "Request Agreement" on a SolicitationCard. Carries the
  // solicitation id + solicitor's Claim id + RFP id so AssetPickerModal +
  // CombinedRequestModal mount paths can resolve their inputs, and so
  // handleV22RequestSubmit can detect this entry path on submit to fire
  // the solicitation-accepted side effects (status update + notification).
  // Shape: { solicitationId, solicitorClaimId, rfpId } | null.
  const [v22AcceptingSolicitation, setV22AcceptingSolicitation] = useState(null)
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
  // Phase 16.0 (was 11B.1): Esc closes the directory-selected Claim's
  // Detail Panel when it's open AND no modal is sitting on top of it.
  // The ExpandedArtifactModal has its own Esc handler; we defer to it
  // via a state check rather than event-ordering tricks (both listeners
  // would fire on the same Esc otherwise, dismissing two layers at once).
  useEffect(() => {
    if (!v22DirectorySelectedClaim) return
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return
      if (v22ExpandedArtifact) return
      setV22DirectorySelectedClaim(null)
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [v22DirectorySelectedClaim, v22ExpandedArtifact])
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

  // Phase 14.0 (#169 part 1): Badge Templates state. Declared before
  // v22DataWithReveal so that memo can reference badge data for chip
  // rendering without hitting a TDZ.
  const [badgeTemplates, setBadgeTemplates] = useState(() => {
    const seed = buildV22SharedArtifacts()
    return seed.badgeTemplates || []
  })
  // Phase 14.1 (#169 part 2): Badge Issuances state. Same TDZ ordering rule.
  const [badgeIssuances, setBadgeIssuances] = useState(() => {
    const seed = buildV22SharedArtifacts()
    return seed.badgeIssuances || []
  })
  const [v22IssueBadgeContext, setV22IssueBadgeContext] = useState(null)
  const [v22RevokeBadgeContext, setV22RevokeBadgeContext] = useState(null)
  // Phase 14.2 (#169b): the standalone Badge Issuance Detail Panel was
  // removed — Detail Panel over Detail Panel violated the prototype's UX
  // patterns. Badge Issuance row clicks now route directly to the expand
  // modal (modal over Detail Panel is fine).

  const v22DataWithReveal = useMemo(() => {
    if (!v22Data) return v22Data
    // Phase 9A.6.1 Fix 1: v22RecentlyAcceptedAssetId may be a single id OR an
    // array of ids (multi-file registration). Flatten into the flagged set so
    // every newly-created Asset gets the _isNew reveal, not just the first.
    const assetReveal = Array.isArray(v22RecentlyAcceptedAssetId)
      ? v22RecentlyAcceptedAssetId
      : v22RecentlyAcceptedAssetId ? [v22RecentlyAcceptedAssetId] : []
    const flagged = new Set([v22RecentlyAcceptedClaimId, ...assetReveal].filter(Boolean))
    // Phase 11E.7: pending-reveal claim ids for the active viewer's role.
    // The `_showAsProvisional` gate applies to (a) the claim currently
    // mid-reveal animation (`v22RevealActiveClaimId`) OR (b) any claim with
    // a pending acceptance notification that hasn't been clicked yet —
    // ensuring the grantee's view stays in provisional state from
    // acceptance until the notification is clicked. The two gates compose:
    // either true → stamp applies; both false → stamp clears.
    const pendingRevealClaimIds = new Set(v22PendingRevealsByRole[roleId] || [])
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
    // Phase 11E.8 fix: include reveal-window state in the decoration gate.
    // Pre-fix the gate only checked `flagged` (recently-accepted ids
    // cleared on deselect), `endpointSet`, EA-for-actor, active-DA-without-
    // EA, and unraveling. When the grantee deselected the recently-accepted
    // Claim before clicking the notification (clearing `flagged`), the
    // memo's early-return short-circuited and the pending-reveal +
    // active-reveal edge stamping never ran — incident edges rendered in
    // their typed (active) styling instead of dashed grey provisional.
    // Phase 13 (#168): build a set of every Eval Result id wrapped by a
    // PoE owned by the active actor. AssetNode reads `_alreadyWrapped` to
    // hide the Create-PoE action-bar button on already-wrapped Eval
    // Results (per design decision 1 — only one PoE per (Asset set, RS
    // set, evaluator)).
    const wrappedByOwnedPoe = new Set()
    for (const poe of (v22View?.proofsOfEvaluation || [])) {
      if (poe.owner !== activeRole.party) continue
      // Phase 13.1: 1:1 wrapping — singular `wrappedEvalResultId`.
      if (poe.wrappedEvalResultId) wrappedByOwnedPoe.add(poe.wrappedEvalResultId)
    }
    // Phase 13.3 (Step 2): for each owned, active, non-PoE-wrapped Eval
    // Result, decide whether Re-Run is permitted. Re-Run requires at
    // least one Asset in the Claim's currently-disclosed in-scope set
    // that wasn't in the prior `evidenceUsed`. AssetNode reads
    // `_canRerun: false` to hide the action-bar Re-Run button; the
    // Detail Panel footer reads it to disable the button + render the
    // explanatory tooltip.
    const canRerunByErId = new Map()
    for (const er of (v22View?.evaluationResults || [])) {
      if (er.owner !== activeRole.party) continue
      if (er.status !== 'active') continue
      if (wrappedByOwnedPoe.has(er.id)) continue
      const claim = (v22View?.claims || []).find((c) => c.id === er.claimId)
      const inScope = claim ? (claim.referencedAssetIds || []) : []
      canRerunByErId.set(er.id, hasNewAssetsForRerun(inScope, er))
    }
    // Phase 14.2 (#169a): build per-node badge lists with the Claim-as-target
    // model. PoE nodes derive badges via the parent Claim (PoE → wrapped ER
    // → claimId → badges). Claim nodes use direct lookup. Stamp the parent
    // Claim's owner on PoE nodes so the action bar's Issue-Badge gate can
    // check `activeParty !== claim.ownerParty` without re-walking.
    const badgesByNodeId = new Map()
    const claimOwnerByNodeId = new Map()
    {
      const allErs = v22View?.evaluationResults || []
      const allPoEs = v22View?.proofsOfEvaluation || []
      const claimsById = new Map((v22View?.claims || []).map((c) => [c.id, c]))
      // Phase 14.3 (#176a): enrich badge-issuance entries with template
      // name + version so BadgeChipContainer renders tooltips without a
      // second prop chain through V2Canvas → AssetNode.
      const templatesById = new Map((badgeTemplates || []).map((t) => [t.id, t]))
      const enrich = (issuance) => {
        const tpl = templatesById.get(issuance.badgeTemplateId)
        return {
          id: issuance.id,
          issuerParty: issuance.issuerParty,
          badgeTemplateId: issuance.badgeTemplateId,
          badgeName: tpl?.name || 'Badge',
          badgeVersion: tpl?.version || 1,
        }
      }
      for (const poe of allPoEs) {
        const list = getBadgesForPoE(poe.id, allErs, allPoEs, badgeIssuances)
        if (list.length > 0) badgesByNodeId.set(poe.id, list.map(enrich))
        const claim = claimsById.get(poe.claimId)
        if (claim) claimOwnerByNodeId.set(poe.id, claim.owner || claim.ownerParty)
      }
      for (const claim of (v22View?.claims || [])) {
        const list = getBadgesForClaim(claim.id, badgeIssuances)
        if (list.length > 0) badgesByNodeId.set(claim.id, list.map(enrich))
      }
    }
    const anyDecoration = flagged.size > 0 || endpointSet.size > 0
      || Object.keys(eaByClaimForActor).length > 0
      || claimsWithActiveDaWithoutEa.size > 0
      || unravelingId != null
      || pendingRevealClaimIds.size > 0
      || v22RevealActiveClaimId != null
      || wrappedByOwnedPoe.size > 0
      || badgesByNodeId.size > 0
    if (!anyDecoration) return v22Data
    const nodes = v22Data.nodes.map(n => {
      const needsReveal = flagged.has(n.id)
      const isEndpoint = endpointSet.has(n.id)
      const eaForClaim = n.v22Type === 'CLAIM' ? eaByClaimForActor[n.id] : null
      const hasActiveDaWithoutEa = n.v22Type === 'CLAIM' && claimsWithActiveDaWithoutEa.has(n.id)
      const alreadyWrapped = n.v22Type === 'EVAL RESULT' && wrappedByOwnedPoe.has(n.id)
      const canRerunFlag = n.v22Type === 'EVAL RESULT' && canRerunByErId.has(n.id)
        ? canRerunByErId.get(n.id)
        : null  // null = N/A; AssetNode treats !== false as "show button"
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
      // Phase 11E.7: also stamp `_showAsProvisional` when the active
      // viewer has a pending acceptance notification for this Claim
      // (pre-click window). The gate composes with the active-reveal
      // gate so the stamp persists from acceptance through reveal
      // completion in one continuous window.
      const isInRevealWindow = n.id === v22RevealActiveClaimId
      const isInPendingRevealWindow = pendingRevealClaimIds.has(n.id)
      const showAsProvisional = isInRevealWindow || isInPendingRevealWindow
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
      const activeBadges = badgesByNodeId.get(n.id) || null
      const claimOwnerParty = claimOwnerByNodeId.get(n.id) || null
      if (!needsReveal && !isEndpoint && !eaForClaim && !hasActiveDaWithoutEa && !isUnraveling && !showAsProvisional && !alreadyWrapped && canRerunFlag === null && !activeBadges && !claimOwnerParty) return n
      return {
        ...n,
        ...(alreadyWrapped ? { _alreadyWrapped: true } : {}),
        ...(canRerunFlag !== null ? { _canRerun: canRerunFlag } : {}),
        ...(activeBadges ? { _activeBadges: activeBadges } : {}),
        ...(claimOwnerParty ? { _claimOwnerParty: claimOwnerParty } : {}),
        ...(needsReveal && !skipNewBadge ? { _isNew: true } : {}),
        // _wasProvisional rides along with _isNew (drives the
        // notification-click reveal-trigger guard at V2App:3221 + the
        // warm-path equivalent at V2App:3308).
        ...(justFinalizedClaim ? { _wasProvisional: true } : {}),
        // _showAsProvisional drives AssetNode's dashed/dimmed render
        // during the reveal animation window AND from acceptance until
        // notification-click (Phase 11E.7).
        ...(showAsProvisional ? { _showAsProvisional: true } : {}),
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
    // Phase 11E.7: also stamp edges incident to claims with a pending
    // acceptance notification so the provisional dashed-grey rendering
    // persists from acceptance until the grantee clicks the notification.
    // Both gates compose: union of active-reveal claim ids + pending-
    // reveal claim ids.
    const provisionalEdgeClaimIds = new Set([
      ...(v22RevealActiveClaimId ? [v22RevealActiveClaimId] : []),
      ...pendingRevealClaimIds,
    ])
    let edges = v22Data.edges
    if (provisionalEdgeClaimIds.size > 0) {
      edges = v22Data.edges.map((e) => (
        (provisionalEdgeClaimIds.has(e.from) || provisionalEdgeClaimIds.has(e.to))
          ? { ...e, _showAsProvisional: true }
          : e
      ))
    }
    return { ...v22Data, nodes, edges, nodeMap }
  }, [v22Data, v22RecentlyAcceptedClaimId, v22RevealActiveClaimId, v22RecentlyAcceptedAssetId, selectedEdgeId, v22View, activeRole.party, v22UnravelingNodeId, v22PendingRevealsByRole, roleId, badgeIssuances, badgeTemplates])

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

  // Phase 11E.7: register / drain a pending acceptance reveal for a
  // given role. `addPendingReveal` is called by the acceptance handlers
  // (cold path `handleV22Accept`, warm path `handleV22AcceptEAOnly`)
  // immediately after enqueueing the acceptance notification on the
  // requester's inbox. `removePendingReveal` is called by the
  // notification click handler just before `startReveal` fires, so the
  // pending-reveal stamp gate hands off cleanly to the active-reveal
  // gate without a one-frame visual gap (React batches both state
  // updates into the same render cycle).
  const addPendingReveal = useCallback((targetRoleId, claimId) => {
    if (!targetRoleId || !claimId) return
    setV22PendingRevealsByRole(prev => {
      const cur = prev[targetRoleId] || []
      if (cur.includes(claimId)) return prev
      return { ...prev, [targetRoleId]: [...cur, claimId] }
    })
  }, [])
  const removePendingReveal = useCallback((targetRoleId, claimId) => {
    if (!targetRoleId || !claimId) return
    setV22PendingRevealsByRole(prev => {
      const cur = prev[targetRoleId] || []
      if (!cur.includes(claimId)) return prev
      return { ...prev, [targetRoleId]: cur.filter(id => id !== claimId) }
    })
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
    // Phase 17.2.1: if this submit originated from a solicitation Accept
    // flow, fire the solicitation-side effects. The cold path leaves
    // v22AcceptingSolicitation null and this branch is a no-op — existing
    // behaviour preserved.
    if (v22AcceptingSolicitation && v22AcceptingSolicitation.solicitationId) {
      const acceptingId = v22AcceptingSolicitation.solicitationId
      const newEaId = pair.evaluationAgreement.id
      let acceptedSolicitation = null
      setV22Solicitations((prev) => {
        const existing = prev.get(acceptingId)
        if (!existing) return prev
        acceptedSolicitation = acceptSolicitation(existing, newEaId)
        const next = new Map(prev)
        next.set(acceptingId, acceptedSolicitation)
        return next
      })
      if (acceptedSolicitation) {
        const sharedForLookup = mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds)
        const rfp = (sharedForLookup.rfps || []).find((r) => r.id === acceptedSolicitation.rfpId)
        const solicitorRole = ROLES.find((r) => r.party === acceptedSolicitation.solicitor)
        if (solicitorRole) {
          enqueueV22NotificationForRequester(solicitorRole.id, {
            id: `v22-rfp-solicitation-accepted-${acceptedSolicitation.id}`,
            type: 'v22-rfp-solicitation-accepted',
            from: { name: activeRole.party, dot: activeRole.partyDot },
            asset: { name: rfp?.name || 'an RFP', pin: null },
            connectTo: null,
            solicitationId: acceptedSolicitation.id,
            rfpId: acceptedSolicitation.rfpId,
            rfpName: rfp?.name || '',
            eaId: newEaId,
            date: new Date().toISOString().slice(0, 10),
          })
        }
      }
      setV22AcceptingSolicitation(null)
    }
  }, [activeRole.party, activeRole.partyDot, v22Data, v22RequestAnchor, enqueueV22NotificationForRequester, v22AcceptingSolicitation, v22ClosedRfpIds])

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
        // Phase 11E.7: register the pending reveal on the requester's
        // role so their view stamps `_showAsProvisional` on the Claim +
        // incident edges from now until they click the notification.
        if (claimIdForReveal) {
          addPendingReveal(requesterRole.id, claimIdForReveal)
        }
      }
    }
  }, [v22RespondingTo, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId, addPendingReveal])

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
        // Phase 11E.7: register the pending reveal on the requester's
        // role — same gate as cold-path acceptance. Cleared by the
        // notification click handler immediately before startReveal.
        if (claimIdForReveal) {
          addPendingReveal(requesterRole.id, claimIdForReveal)
        }
      }
    }
  }, [v22RespondingToEaOnly, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId, addPendingReveal])

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

  // Phase 13.1 (#168a): single-call evaluation submit. The modal hands back
  // `perRsResults: [{ requirementsSet, rows }]` for the multi-RS case (or a
  // single-entry array for solo). All RSes are bundled into ONE Eval Result;
  // `makeEvaluationRunArtifacts` runs once per submission, producing one
  // Eval Result + one auto-disclosure DA + one ownership DA. The
  // `batchId` mechanism is gone — multi-RS evaluations are one artifact.
  const handleV22EvaluationSubmit = useCallback((payload) => {
    if (!v22EvalContext) return
    const { evaluationAgreementId, claimId, selfEvaluation } = v22EvalContext
    const claim = v22View?.claims.find((c) => c.id === claimId)
    let ea
    if (selfEvaluation) {
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
    // Normalize input: legacy single-RS callers expand to a one-entry
    // batch; modern callers pass `perRsResults` directly.
    const perRsResults = payload.perRsResults && payload.perRsResults.length > 0
      ? payload.perRsResults
      : [{
          requirementsSet: payload.requirementsSet,
          rows: payload.rows,
        }]
    const evidenceUsed = payload.evidenceUsed || []
    const evidenceDiff = payload.evidenceDiff || null
    const priorEvalResultId = payload.priorEvalResultId || null

    // Phase 13.1: bundle all selected RSes into one Eval Result.
    // Build the flat results[] with each row stamped with its requirementsSetId.
    const requirementsSets = perRsResults.map(({ requirementsSet }) => requirementsSet)
    const rows = []
    for (const { requirementsSet, rows: rsRows } of perRsResults) {
      for (const r of (rsRows || [])) {
        rows.push({ ...r, requirementsSetId: requirementsSet.id })
      }
    }
    // Look up a prior Eval Result whose RS overlaps any of the new RSes
    // (any single-RS match supersedes — the prior shape may be old singular
    // or new plural).
    let prior = null
    for (const rs of requirementsSets) {
      const candidate = findPriorActiveEvaluationResult({
        claimId, requirementsSetId: rs.id,
        shared: buildV22SharedArtifacts(), provisionals: v22Provisionals,
      })
      if (candidate) { prior = candidate; break }
    }
    const artifacts = makeEvaluationRunArtifacts({
      evaluatorParty: ea.grantee.party,
      evaluatorDot: activeRole.partyDot,
      claimOwnerParty: ea.grantor.party,
      evaluationAgreement: ea,
      granteeAssetId: ea.granteeAssetId,
      requirementsSets,
      rows,
      evidenceUsed,
      priorActiveResult: prior,
    })
    // Stamp re-run audit fields on the new Eval Result.
    artifacts.evaluationResult = {
      ...artifacts.evaluationResult,
      priorEvalResultId,
      evidenceDiff,
    }

    setV22Provisionals((prev) => {
      let newEvalResults = [...prev.evaluationResults]
      newEvalResults.push(artifacts.evaluationResult)
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
    const newER = artifacts.evaluationResult
    setSel(newER.id)
    setForcePanelTab(null)
    setForceExpandSda(null)
    setV22PanToClaimId(newER.id)
    setV22RecentlyAcceptedClaimId(newER.id)
    if (!selfEvaluation) {
      const claimOwnerRole = ROLES.find((r) => r.party === ea.grantor.party)
      const sharedClaim = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals).claims.find((c) => c.id === claimId)
      if (claimOwnerRole && sharedClaim) {
        // First RS name surfaces in the notification; multi-RS bundles
        // append a "(+N more)" hint for the inbox preview.
        const firstRs = newER.requirementsSets?.[0]
        const moreCount = (newER.requirementsSets?.length || 1) - 1
        const rsName = firstRs
          ? (moreCount > 0 ? `${firstRs.name} (+${moreCount} more)` : firstRs.name)
          : null
        enqueueV22NotificationForRequester(claimOwnerRole.id, {
          id: `v22-evaluation-${newER.id}`,
          type: 'v22-evaluation',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: sharedClaim.name, pin: sharedClaim.pin },
          v22EvalResultId: newER.id,
          supersedesPriorResultId: artifacts.supersededPriorResult?.id || null,
          requirementsSetName: rsName,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22EvalContext, v22View, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // ── Phase 6: Amendment handlers ──────────────────────────────────────

  const handleV22AmendClaimSubmit = useCallback(({
    addedAssetIds = [],
    addedRequirementsSetIds = [],
    removedRequirementsSetIds = [],
    // Phase 12.2 (#122): Asset supersession + drop diff buckets.
    supersededAssets = [],
    removedAssetIds = [],
  }) => {
    if (!v22AmendingClaimId) return
    // Phase 11E.4: rolled back the Phase 11E.2 `v22-claim-amendment`
    // fan-out. Counterparties don't see Claim amendments directly —
    // they only learn of new content when the grantor amends the
    // Disclosure Agreement to include the new Assets/fields. DA
    // amendment is the user-visible event; Claim amendment is internal
    // Claim-owner state. The corresponding spec §7.4 row + §11.2
    // prototype-note reference were also removed in Phase 11E.4.
    //
    // Phase 12.1 (#120): RS edits are also cascade-skip — they DO NOT
    // mark Eval Results stale and DO NOT generate notifications. The
    // amendment record carries the RS diff for audit only.
    //
    // Phase 12.2 (#122): Asset supersession + drop edits DO generate the
    // `v22-eval-result-stale` notification on each evaluator whose Eval
    // Result newly becomes OUTDATED. The notification is informational —
    // single-grantee, click deep-links to the Eval Result. Eval Result
    // status flips to 'outdated' synchronously here.
    let staleNotifyTargets = []   // captured during the setV22Provisionals updater
    setV22Provisionals((prev) => {
      // Look up the latest version of the claim (could be a prior amendment).
      const existing = prev.claims?.find((c) => c.id === v22AmendingClaimId)
        || buildV22SharedArtifacts().claims.find((c) => c.id === v22AmendingClaimId)
      if (!existing) return prev
      const { claim: amended, newClaimRefEdges } = makeAmendedClaim({
        claim: existing,
        addedAssetIds,
        addedRequirementsSetIds,
        removedRequirementsSetIds,
        supersededAssets,
        removedAssetIds,
      })
      // Phase 12.2 (#122): walk every Eval Result on this Claim and flip
      // newly-OUTDATED ones. Capture each transition for notification.
      const sharedForStaleCheck = mergeProvisionals(buildV22SharedArtifacts(), prev)
      const allEvalResults = [...(sharedForStaleCheck.evaluationResults || []), ...(prev.evaluationResults || [])]
      const evalResultsById = new Map()
      for (const er of allEvalResults) evalResultsById.set(er.id, er)
      const updatedEvalResults = []
      for (const er of evalResultsById.values()) {
        if (er.claimId !== amended.id) continue
        if (er.status === 'superseded' || er.status === 'outdated') continue
        if (isEvalResultStale(er, amended)) {
          updatedEvalResults.push({ ...er, status: 'outdated' })
          staleNotifyTargets.push(er)
        }
      }
      const nextProvisionalEvalResults = (prev.evaluationResults || []).map((er) => {
        const flipped = updatedEvalResults.find((u) => u.id === er.id)
        return flipped || er
      })
      // Eval Results in the seed (sharedForStaleCheck only) that newly
      // flipped need to be added to provisionals so their status persists.
      for (const flipped of updatedEvalResults) {
        if (!(prev.evaluationResults || []).some((er) => er.id === flipped.id)) {
          nextProvisionalEvalResults.push(flipped)
        }
      }
      return {
        ...prev,
        claims: [...(prev.claims || []).filter((c) => c.id !== amended.id), amended],
        disclosureAgreements: [...prev.disclosureAgreements, ...newClaimRefEdges],
        evaluationResults: nextProvisionalEvalResults,
      }
    })
    // Fire OUTDATED notifications outside the state updater (need access
    // to ROLES + updateRoleState). Each evaluator gets a single-grantee
    // informational `v22-eval-result-stale` on their inbox.
    for (const er of staleNotifyTargets) {
      const evaluatorRole = ROLES.find((r) => r.party === er.owner)
      if (!evaluatorRole) continue
      const notifId = `v22-eval-result-stale-${er.id}-${Date.now().toString(36)}`
      updateRoleState(evaluatorRole.id, (prevR) => ({
        ...prevR,
        addedRequests: [
          ...(prevR.addedRequests || []),
          {
            id: notifId,
            type: 'v22-eval-result-stale',
            evalResultId: er.id,
            claimId: er.claimId,
            evalResultName: er.requirementsSet?.name || er.id,
            from: { name: activeRole.party, dot: activeRole.partyDot },
            date: new Date().toISOString().slice(0, 10),
          },
        ],
      }))
    }
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

  // Phase 12.1 (#120): inline RS supersession update. Same cascade-skip
  // semantics as a regular AmendClaim RS edit — no Eval Result staleness,
  // no notifications. Records a one-line amendment with the from/to ids
  // in `addedRequirementsSetIds` / `removedRequirementsSetIds`.
  const handleV22UpdateRsReference = useCallback(() => {
    const ctx = v22UpdatingRsReference
    if (!ctx) return
    const { claimId, fromRsId, toRsId } = ctx
    if (!claimId || !fromRsId || !toRsId || fromRsId === toRsId) {
      setV22UpdatingRsReference(null)
      return
    }
    setV22Provisionals((prev) => {
      const existing = prev.claims?.find((c) => c.id === claimId)
        || buildV22SharedArtifacts().claims.find((c) => c.id === claimId)
      if (!existing) return prev
      const { claim: amended, newClaimRefEdges } = makeAmendedClaim({
        claim: existing,
        addedRequirementsSetIds: [toRsId],
        removedRequirementsSetIds: [fromRsId],
      })
      return {
        ...prev,
        claims: [...(prev.claims || []).filter((c) => c.id !== amended.id), amended],
        // newClaimRefEdges is empty here (no Asset add) but the helper
        // still returns the array — defensive spread keeps shape stable.
        disclosureAgreements: [...prev.disclosureAgreements, ...newClaimRefEdges],
      }
    })
    setV22UpdatingRsReference(null)
  }, [v22UpdatingRsReference])

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

  // Phase 13.1 (#168a): Create Proof of Evaluation, 1:1 wrap. Atomically:
  //   1. Build the new PoE wrapping the source Eval Result.
  //   2. Find the existing Eval-Result-targeting auto-disclosure DA (created
  //      at Eval Result save time) and mark it `status: 'revoked'` so its
  //      edge unravel-animates per the Phase 9D pattern.
  //   3. Build a new PoE-targeting proof-only DA from evaluator → claim owner.
  //   4. Reveal the PoE node + its new DA edge.
  const handleV22CreatePoE = useCallback(() => {
    const ctx = v22CreatingPoEContext
    if (!ctx) return
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const sourceEr = (merged.evaluationResults || []).find((er) => er.id === ctx.evalResultId)
    if (!sourceEr) return
    const sourceClaim = (merged.claims || []).find((c) => c.id === sourceEr.claimId)
    const requirementsSetIds = (sourceEr.requirementsSets || []).map((rs) => rs.id)
    const assetSnapshot = [...(sourceEr.evidenceUsed || [])]
    const now = new Date().toISOString()
    const poeId = makeArtifactId('poe', `${activeRole.party}-${sourceEr.id}-${Date.now()}`)
    const poe = makePoE({
      id: poeId,
      owner: activeRole.party,
      ownerDot: activeRole.partyDot,
      claimId: sourceEr.claimId,
      claimName: sourceClaim?.name,
      wrappedEvalResultId: sourceEr.id,
      requirementsSetIds,
      assetSnapshot,
      createdDate: now,
    })
    // Locate the existing Eval-Result-targeting auto-disclosure DA (the
    // proof-only DA created at Eval Result save time, evaluator → claim
    // owner). Marks it `revoked` so the edge unravels.
    const claimOwnerParty = sourceClaim?.owner
    const priorAutoDa = (merged.disclosureAgreements || []).find((da) => (
      da.subject?.kind === 'evalResult'
      && da.subject?.id === sourceEr.id
      && da.grantor?.party === activeRole.party
      && da.grantee?.party === claimOwnerParty
      && da.grantor?.party !== da.grantee?.party
      && da.status === 'active'
    ))
    const newProofDa = makeProofOfEvalDisclosureAgreement({
      id: makeArtifactId('da-proof', `${poeId}-${Date.now()}`),
      evaluator: activeRole.party,
      evaluatorDot: activeRole.partyDot,
      claimOwner: claimOwnerParty,
      claimOwnerDot: sourceClaim?.ownerDot,
      poeId,
      terms: { createdDate: now },
    })
    setV22Provisionals((prev) => {
      const nextDas = [...prev.disclosureAgreements]
      if (priorAutoDa) {
        // Mark the prior DA revoked. Same pattern as the regular revoke flow.
        const idx = nextDas.findIndex((d) => d.id === priorAutoDa.id)
        const revokedDa = { ...priorAutoDa, status: 'revoked', _supersededByPoeId: poeId }
        if (idx >= 0) nextDas[idx] = revokedDa
        else nextDas.push(revokedDa)
      }
      nextDas.push(newProofDa)
      return {
        ...prev,
        proofsOfEvaluation: [...(prev.proofsOfEvaluation || []), poe],
        disclosureAgreements: nextDas,
      }
    })
    setV22CreatingPoEContext(null)
    setSel(poe.id)
    setV22PanToClaimId(poe.id)
    setV22RecentlyAcceptedClaimId(poe.id)
    // Phase 14.2: fire `v22-poe-created` notification on the Claim owner's
    // inbox (gap from Phase 13.1 — visibility flowed via the proof-of-eval
    // DA, but no notification fired so the recipient had no inbox cue).
    // Self-PoE creation (evaluator === claim owner) skips the notification:
    // the actor is acting on their own canvas, so there's no cross-actor
    // signal to surface.
    if (claimOwnerParty && claimOwnerParty !== activeRole.party) {
      const recipientRole = ROLES.find((r) => r.party === claimOwnerParty)
      if (recipientRole) {
        enqueueV22NotificationForRequester(recipientRole.id, {
          id: `v22-poe-created-${poe.id}`,
          type: 'v22-poe-created',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          poeId: poe.id,
          poeName: poe.name,
          claimId: sourceClaim?.id,
          claimName: sourceClaim?.name,
          sourceErId: sourceEr.id,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22CreatingPoEContext, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

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
  const handleV22CreateClaimSubmit = useCallback(({ name, description, referencedAssetIds, acknowledgments, referencedRequirementsSetIds }) => {
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
      // Phase 12.1 (#120): pass through Referenced Standards (optional).
      referencedRequirementsSetIds: referencedRequirementsSetIds || [],
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

  // ── Phase 17.2: RFP Solicitation handlers ────────────────────────────
  //
  // Submit creates an RfpSolicitation in v22Solicitations + fires a
  // v22-rfp-solicitation-received notification on the RFP owner's inbox.
  // Reject updates the existing solicitation status to 'rejected', stamps
  // respondedDate + rejectionMessage, and fires a v22-rfp-solicitation-
  // rejected notification on the solicitor's inbox.
  const handleCreateSolicitation = useCallback(({ rfpId, claimId, message }) => {
    // Resolve the target RFP from the seed set + closed-RFP merge so the
    // owner party is available for notification routing. The seed `rfps`
    // never moves between owners, so a plain lookup is sufficient.
    const sharedForLookup = mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds)
    const rfp = (sharedForLookup.rfps || []).find((r) => r.id === rfpId)
    if (!rfp) return
    const id = `solicit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const solicitation = makeRfpSolicitation({
      id,
      rfpId,
      claimId,
      solicitor: activeRole.party,
      recipient: rfp.owner,
      message: message || '',
    })
    setV22Solicitations((prev) => {
      const next = new Map(prev)
      next.set(id, solicitation)
      return next
    })
    // Deliver notification to the RFP owner. ROLES lookup mirrors the
    // existing notification fan-out pattern; if the owner isn't a
    // switchable role (mock supplier actor), the notification simply has
    // no inbox to land in — that's OK, the demo flow only exercises
    // primary-party RFPs (Bob's Sentinel-4).
    const recipientRole = ROLES.find((r) => r.party === rfp.owner)
    if (recipientRole) {
      enqueueV22NotificationForRequester(recipientRole.id, {
        id: `v22-rfp-solicitation-received-${id}`,
        type: 'v22-rfp-solicitation-received',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        asset: { name: rfp.name, pin: null },
        connectTo: null,
        solicitationId: id,
        rfpId,
        rfpName: rfp.name,
        date: new Date().toISOString().slice(0, 10),
      })
    }
    // Close the create modal.
    setV22SolicitOpenForRfp(null)
  }, [activeRole.party, activeRole.partyDot, v22ClosedRfpIds, enqueueV22NotificationForRequester])

  const handleRejectSolicitation = useCallback(({ solicitationId, rejectionMessage }) => {
    let updated = null
    setV22Solicitations((prev) => {
      const existing = prev.get(solicitationId)
      if (!existing) return prev
      const next = new Map(prev)
      updated = {
        ...existing,
        status: 'rejected',
        respondedDate: new Date().toISOString(),
        rejectionMessage: rejectionMessage || null,
      }
      next.set(solicitationId, updated)
      return next
    })
    // Resolve outside the setter so notification payload reads the final
    // shape. We close over `updated` set inside the updater; React calls
    // the updater synchronously in the same tick.
    if (updated) {
      const sharedForLookup = mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds)
      const rfp = (sharedForLookup.rfps || []).find((r) => r.id === updated.rfpId)
      const solicitorRole = ROLES.find((r) => r.party === updated.solicitor)
      if (solicitorRole) {
        enqueueV22NotificationForRequester(solicitorRole.id, {
          id: `v22-rfp-solicitation-rejected-${updated.id}`,
          type: 'v22-rfp-solicitation-rejected',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: rfp?.name || 'an RFP', pin: null },
          connectTo: null,
          solicitationId: updated.id,
          rfpId: updated.rfpId,
          rfpName: rfp?.name || '',
          rejectionMessage: updated.rejectionMessage,
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
    setV22SolicitationToReject(null)
  }, [activeRole.party, activeRole.partyDot, v22ClosedRfpIds, enqueueV22NotificationForRequester])

  // Phase 17.2.1 / Phase 17.2.1.1: RFP owner clicked "Request Agreement"
  // on a SolicitationCard. Phase 17.2.1.1 collapses the prior two-modal
  // chain (AssetPickerModal → CombinedRequestModal) into a single direct
  // open of CombinedRequestModal — the RFP's `assetId` (set at RFP
  // creation per the architectural correction) replaces the intermediate
  // picker step. The submit-side effect in handleV22RequestSubmit is
  // gated on v22AcceptingSolicitation; we still set it here so the
  // post-submit branch can fire the solicitation-accepted side effects.
  const handleRequestAgreement = useCallback((solicitation) => {
    if (!solicitation) return
    const shared = buildV22SharedArtifacts()
    const rfp = (shared.rfps || []).find((r) => r.id === solicitation.rfpId)
    if (!rfp) return
    const anchorAsset = (shared.assets || []).find((a) => a.id === rfp.assetId)
    if (!anchorAsset) return  // defensive — every seeded RFP has a valid assetId
    const sharedClaim = (shared.claims || []).find((c) => c.id === solicitation.claimId)
    if (!sharedClaim) return
    setV22AcceptingSolicitation({
      solicitationId: solicitation.id,
      solicitorClaimId: solicitation.claimId,
      rfpId: solicitation.rfpId,
    })
    setV22RequestAnchor({
      id: anchorAsset.id,
      name: anchorAsset.name,
      pin: anchorAsset.pin,
    })
    // Reuse the AI Shopper pre-fill mechanism: claimPin + all RS ids.
    // Phase 17.2.1.2: thread the full RFP `requirementsSetIds` array
    // (was: just the first id) so multi-RS RFPs pre-check every
    // referenced RS, not only the first. The mount block prefers the
    // plural `suggestedRequirementsSetIds` field; falls back to the
    // singular `suggestedRequirementsSetId` for the AI Shopper path.
    const rfpRsIds = Array.isArray(rfp.requirementsSetIds) ? rfp.requirementsSetIds : []
    setV22AIShopperResult({
      claimPin: sharedClaim.pin,
      suggestedRequirementsSetIds: rfpRsIds,
    })
    setV22RequestOpen(true)
  }, [])

  // Phase 17.3 — Directory-layer Claim "Request Evaluation Agreement" CTA.
  // Triggered from V22NodeDetailPanel's footer button OR from the Claim
  // card's V22ActionBar (both surfaces share this handler). Opens
  // AssetPickerModal so the requester picks which of their Assets the EA+DA
  // request will anchor to. AssetPickerModal's Continue routes through
  // handleAssetPickedForClaim, which opens CombinedRequestModal pre-filled.
  const handleRequestEaForClaim = useCallback((claim) => {
    if (!claim) return
    setV22RequestingEaForClaim(claim)
  }, [])

  // Phase 17.3 — AssetPickerModal Continue handler for the Directory-layer
  // Claim CTA flow. Resolves the picked Asset and the target Claim, opens
  // CombinedRequestModal pre-filled (requesterAsset = picked Asset,
  // initialPin = target Claim PIN, no initialRequirementsSetIds — Directory
  // entry has no RFP context so no RS pre-selection). Reuses the existing
  // AI Shopper pre-fill mechanism the cold path already trusts.
  const handleAssetPickedForClaim = useCallback(({ assetId, claimId }) => {
    if (!assetId || !claimId) return
    const shared = buildV22SharedArtifacts()
    const claim = (shared.claims || []).find((c) => c.id === claimId)
    const requesterAsset = (shared.assets || []).find((a) => a.id === assetId)
    if (!claim || !requesterAsset) return
    setV22RequestingEaForClaim(null)
    setV22RequestAnchor({
      id: requesterAsset.id,
      name: requesterAsset.name,
      pin: requesterAsset.pin,
    })
    setV22AIShopperResult({
      claimPin: claim.pin,
      suggestedRequirementsSetIds: [],
    })
    setV22RequestOpen(true)
  }, [])

  // Phase 17.3 — handleViewEa is declared further down (after nodeMap +
  // canvasRef are in scope) and assigned to a ref so the Directory mount
  // blocks at lines ~6100 / ~6189 / inline handlers can reference it
  // without TDZ-on-nodeMap. See `handleViewEaRef` below.

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
    // Phase 11E.2 (#102): renamed `v22-amendment` → `v22-da-amendment` so
    // the type name parallels `v22-ea-amendment` and `v22-claim-amendment`.
    // Also added `v22ClaimId` for deep-link pan, mirroring the EA pattern.
    if (
      counterpartyParty &&
      counterpartyParty !== 'Radiant Network' &&
      counterpartyParty !== activeRole.party &&
      claimPinForNotif
    ) {
      const counterpartyRole = ROLES.find((r) => r.party === counterpartyParty)
      if (counterpartyRole) {
        enqueueV22NotificationForRequester(counterpartyRole.id, {
          id: `v22-da-amendment-${v22AmendingDaId}-${Date.now().toString(36)}`,
          type: 'v22-da-amendment',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22DaId: v22AmendingDaId,
          v22ClaimId: existing.subject?.id || null,
          note: (note || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22AmendingDaId, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // Phase 11.6 (#164): Propose an Evaluation Agreement amendment.
  // Spec §11.2a major revision — replaced the Phase 11E.1 unilateral
  // Option B model. The grantor submits a proposal; the grantee gets
  // a `v22-ea-amendment-proposal` notification and chooses to accept
  // or reject via AmendmentResponseModal. While pending, the EA is
  // "frozen": no new evaluations under it, no new amendments, only
  // revocation overrides. Accept applies the proposed terms +
  // acknowledgments; reject leaves both at their pre-proposal values.
  const handleV22ProposeEvaluationAmendment = useCallback(({ terms, acknowledgments, note }) => {
    if (!v22AmendingEaId) return

    // Resolve existing EA + paired Claim.
    const seededEa = buildV22SharedArtifacts().evaluationAgreements.find((e) => e.id === v22AmendingEaId)
    const existingEa = v22Provisionals.evaluationAgreements?.find((e) => e.id === v22AmendingEaId) || seededEa
    if (!existingEa) return
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const existingClaim = merged.claims.find((c) => c.id === existingEa.claimId)
    if (!existingClaim) return

    // Compute the acknowledgment delta for the proposal record (audit
    // trail + AmendmentResponseModal diff display).
    const acknowledgmentChanges = diffAcknowledgments(
      existingClaim.acknowledgments || [],
      acknowledgments || [],
    )

    // Build the proposal: EA flips to `pending-acceptance`, amendment
    // record carries the proposed snapshot. Claim is NOT mutated.
    const proposalEa = proposeEvaluationAgreementAmendment({
      evaluationAgreement: existingEa,
      terms,
      acknowledgments,
      acknowledgmentChanges,
      proposalMessage: note,
    })
    const newAmendment = proposalEa.amendments[proposalEa.amendments.length - 1]

    // Resolve notification metadata before the state update.
    const granteeParty = existingEa.grantee.party
    const claimNameForNotif = existingClaim.name || null
    const claimPinForNotif = existingClaim.pin || null
    const claimIdForPan = existingClaim.id

    // Stage updates atomically — only the EA changes, never the Claim.
    setV22Provisionals((prev) => ({
      ...prev,
      evaluationAgreements: [
        ...(prev.evaluationAgreements || []).filter((e) => e.id !== proposalEa.id),
        proposalEa,
      ],
    }))

    setV22AmendingEaId(null)
    setOpenAgreement(null)
    setSelectedEdgeId(null)

    if (claimIdForPan) {
      setSel(claimIdForPan)
      setForcePanelTab(null)
      setForceExpandSda(null)
      setV22PanToClaimId(claimIdForPan)
    }

    // Notify the EA grantee with the proposal notification. Same pre-
    // click pending-reveal treatment as acceptance notifications
    // (Phase 11E.7) so the EA edge stamps as provisional on the
    // grantee's view from proposal until they click the notification.
    if (
      granteeParty &&
      granteeParty !== 'Radiant Network' &&
      granteeParty !== activeRole.party
    ) {
      const granteeRole = ROLES.find((r) => r.party === granteeParty)
      if (granteeRole) {
        enqueueV22NotificationForRequester(granteeRole.id, {
          id: `v22-ea-amendment-proposal-${v22AmendingEaId}-${newAmendment.id}`,
          type: 'v22-ea-amendment-proposal',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22EaId: v22AmendingEaId,
          v22AmendmentId: newAmendment.id,
          v22ClaimId: claimIdForPan,
          proposalMessage: (note || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22AmendingEaId, v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester])

  // Phase 11.6 (#164): Grantee accepts a pending amendment proposal.
  // EA returns to `active` with proposed terms applied; Claim's
  // acknowledgments mutate to match the proposal snapshot. Grantor
  // gets `v22-ea-amendment-accepted` notification.
  const handleV22AmendmentAccept = useCallback(({ eaId, amendmentId, responseMessage = '' }) => {
    if (!eaId || !amendmentId) return
    const seededEa = buildV22SharedArtifacts().evaluationAgreements.find((e) => e.id === eaId)
    const existingEa = v22Provisionals.evaluationAgreements?.find((e) => e.id === eaId) || seededEa
    if (!existingEa) return
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const existingClaim = merged.claims.find((c) => c.id === existingEa.claimId)
    if (!existingClaim) return

    let acceptedEa, proposedAcks
    try {
      const result = acceptEvaluationAgreementAmendment({
        evaluationAgreement: existingEa,
        amendmentId,
        responseMessage,
      })
      acceptedEa = result.evaluationAgreement
      proposedAcks = result.proposedAcknowledgments
    } catch (err) {
      // Amendment not pending (already responded, race) — silently no-op.
      console.warn('[Phase11.6] amendment accept failed:', err.message)
      return
    }

    const grantorParty = existingEa.grantor.party
    const claimNameForNotif = existingClaim.name || null
    const claimPinForNotif = existingClaim.pin || null
    const claimIdForPan = existingClaim.id

    setV22Provisionals((prev) => {
      const updatedClaim = {
        ...existingClaim,
        acknowledgments: proposedAcks.map((a) => ({
          id: a.id, title: a.title, description: a.description,
        })),
      }
      return {
        ...prev,
        evaluationAgreements: [
          ...(prev.evaluationAgreements || []).filter((e) => e.id !== acceptedEa.id),
          acceptedEa,
        ],
        claims: [
          ...((prev.claims || []).filter((c) => c.id !== updatedClaim.id)),
          updatedClaim,
        ],
      }
    })

    setV22RespondingToEaAmendment(null)
    // Phase 11.6.1 Fix 1: dismiss the originating proposal notification
    // on the grantee's (active role's) inbox. The proposal id is
    // deterministic so we can target it directly without walking
    // addedRequests.
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-ea-amendment-proposal-${eaId}-${amendmentId}`],
    }))

    if (
      grantorParty &&
      grantorParty !== 'Radiant Network' &&
      grantorParty !== activeRole.party
    ) {
      const grantorRole = ROLES.find((r) => r.party === grantorParty)
      if (grantorRole) {
        enqueueV22NotificationForRequester(grantorRole.id, {
          id: `v22-ea-amendment-accepted-${eaId}-${amendmentId}`,
          type: 'v22-ea-amendment-accepted',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22EaId: eaId,
          v22AmendmentId: amendmentId,
          v22ClaimId: claimIdForPan,
          responseMessage: (responseMessage || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

  // Phase 11.6 (#164): Grantee rejects a pending amendment proposal.
  // EA returns to `active` with terms unchanged; Claim untouched.
  // Grantor gets `v22-ea-amendment-rejected` notification.
  const handleV22AmendmentReject = useCallback(({ eaId, amendmentId, responseMessage = '' }) => {
    if (!eaId || !amendmentId) return
    const seededEa = buildV22SharedArtifacts().evaluationAgreements.find((e) => e.id === eaId)
    const existingEa = v22Provisionals.evaluationAgreements?.find((e) => e.id === eaId) || seededEa
    if (!existingEa) return
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const existingClaim = merged.claims.find((c) => c.id === existingEa.claimId)
    if (!existingClaim) return

    let rejectedEa
    try {
      rejectedEa = rejectEvaluationAgreementAmendment({
        evaluationAgreement: existingEa,
        amendmentId,
        responseMessage,
      })
    } catch (err) {
      console.warn('[Phase11.6] amendment reject failed:', err.message)
      return
    }

    const grantorParty = existingEa.grantor.party
    const claimNameForNotif = existingClaim.name || null
    const claimPinForNotif = existingClaim.pin || null
    const claimIdForPan = existingClaim.id

    setV22Provisionals((prev) => ({
      ...prev,
      evaluationAgreements: [
        ...(prev.evaluationAgreements || []).filter((e) => e.id !== rejectedEa.id),
        rejectedEa,
      ],
    }))

    setV22RespondingToEaAmendment(null)
    // Phase 11.6.1 Fix 1: dismiss the originating proposal notification
    // on the grantee's (active role's) inbox. Mirrors the accept path —
    // both terminal responses should clear the inbox entry.
    updateRoleState(roleId, (prev) => ({
      ...prev,
      dismissedReqs: [...(prev.dismissedReqs || []), `v22-ea-amendment-proposal-${eaId}-${amendmentId}`],
    }))

    if (
      grantorParty &&
      grantorParty !== 'Radiant Network' &&
      grantorParty !== activeRole.party
    ) {
      const grantorRole = ROLES.find((r) => r.party === grantorParty)
      if (grantorRole) {
        enqueueV22NotificationForRequester(grantorRole.id, {
          id: `v22-ea-amendment-rejected-${eaId}-${amendmentId}`,
          type: 'v22-ea-amendment-rejected',
          from: { name: activeRole.party, dot: activeRole.partyDot },
          asset: { name: claimNameForNotif, pin: claimPinForNotif },
          connectTo: null,
          v22EaId: eaId,
          v22AmendmentId: amendmentId,
          v22ClaimId: claimIdForPan,
          responseMessage: (responseMessage || '').trim(),
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [v22Provisionals, activeRole.party, activeRole.partyDot, enqueueV22NotificationForRequester, updateRoleState, roleId])

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
  // Phase 11.8 #54: reset-all confirmation modal — clears every role's
  // canvas state, notifications, and provisionals back to seeded shape.
  const [v22ResetConfirmOpen, setV22ResetConfirmOpen] = useState(false)
  // Phase 11.8 #98: add-credits sub-modal — opens from CreditCostRow's
  // "Add credits →" link in V22CreateAssetModal / V22CreateClaimModal.
  // Sits at a higher z-index than the Create modal's backdrop; both
  // dismiss paths leave the parent Create modal open.
  const [v22AddCreditsOpen, setV22AddCreditsOpen] = useState(false)
  const [layerInfo, setLayerInfo] = useState({ depth: 0, anchorId: null })
  const canvasRef = useRef(null)
  // Phase 17.2.0.1: imperative handle to DirectoryLayer for notification-
  // driven RFP navigation. `panToRfp(rfp)` returns true on success, false
  // when the Directory isn't ready (still opening / layout not built). The
  // notification click handler retries via rAF until success or a 60-frame
  // cap, so the pan fires as soon as DirectoryLayer is ready.
  const directoryLayerRef = useRef(null)
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
  // Phase 12.1 (#120): seed Bob's MIL-PRF-55681 (v1 + v2) and System
  // Integration v1 into the public pool so the "Public" picker tab and
  // provenance badges work on first load. Every role except Bob sees these
  // as Public; Bob sees them as authored-by-self (filtered out via the
  // existing `_publishedByRoleId !== roleId` filter at line 3050+).
  const [publishedRequirementSets, setPublishedRequirementSets] = useState(SEED_PUBLISHED_REQUIREMENT_SETS)
  // Phase 14.0 (#169 part 1): Badge Templates. Network-wide, public-by-default
  // Library artifact owned by an Actor. State is shared across all roles
  // (every Actor sees every template; only own templates are editable).
  // Initialized once from `buildV22SharedArtifacts` seed; mutations land
  // here via `handleSaveBadgeTemplate`.
  // (badgeTemplates / badgeIssuances state declared earlier — moved above
  // v22DataWithReveal to avoid TDZ when chip rendering pulls badge data.)
  const handleSaveBadgeTemplate = useCallback((template, opts = {}) => {
    const { isNewVersion = false, priorTemplateId = null } = opts
    setBadgeTemplates((prev) => {
      const next = prev.slice()
      if (isNewVersion && priorTemplateId) {
        // Update prior version's `supersededBy` to point at the new template.
        const priorIdx = next.findIndex((t) => t.id === priorTemplateId)
        if (priorIdx >= 0) {
          next[priorIdx] = { ...next[priorIdx], supersededBy: template.id }
        }
      }
      next.push(template)
      return next
    })
    // Phase 14.1 (#169 part 2): fan-out `v22-badge-template-new-version`
    // notification to every recipient with an active issuance against any
    // prior version of this lineage. Walk active issuances → resolve target
    // PoE → find PoE owner = recipient; dedupe by recipient party.
    // Phase 14.2 (#169a): walk via Claim ownership (was via PoE owner).
    if (isNewVersion && priorTemplateId) {
      try {
        const seed = buildV22SharedArtifacts()
        const sharedClaims = seed.claims || []
        const ownerByClaimId = new Map(sharedClaims.map((c) => [c.id, c.owner || c.ownerParty]))
        const lineageId = template.lineageId
        if (lineageId) {
          const lineageVersionIds = new Set(
            badgeTemplates.filter((t) => t.lineageId === lineageId).map((t) => t.id),
          )
          const recipientParties = new Set()
          for (const issuance of badgeIssuances) {
            if (issuance.status !== 'active') continue
            if (!lineageVersionIds.has(issuance.badgeTemplateId)) continue
            const recipientParty = ownerByClaimId.get(issuance.targetClaimId)
            if (recipientParty) recipientParties.add(recipientParty)
          }
          for (const party of recipientParties) {
            const recipientRole = ROLES.find((r) => r.party === party)
            if (!recipientRole) continue
            enqueueV22NotificationForRequester(recipientRole.id, {
              id: `v22-badge-template-new-version-${template.id}-${party}`,
              type: 'v22-badge-template-new-version',
              from: { name: template.ownerParty, dot: template.ownerDot },
              badge: { templateId: template.id, name: template.name, version: template.version },
              date: new Date().toISOString().slice(0, 10),
            })
          }
        }
      } catch (e) {
        console.warn('Phase 14.1: badge-template-new-version fan-out failed', e)
      }
    }
  }, [badgeTemplates, badgeIssuances, enqueueV22NotificationForRequester])

  // Phase 14.2 (#169a): Issue Badge handler. Target shifted from PoE to
  // Claim. Self-issuance gate is now `issuerParty !== claim.ownerParty`.
  // The PoE-anchored entry points still work — they pass the parent
  // Claim's id (derived from the PoE's claimId field) as targetClaimId.
  const handleV22IssueBadge = useCallback((targetClaimId, badgeTemplateId, description) => {
    // Phase 14.6 (#189): use the merged dataset (seed + provisional
    // mutations) so the RS-coverage gate sees fresh PoEs / Eval Results
    // created during this session. Self-issuance guard remains
    // first-line defense.
    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
    const sharedClaims = merged.claims || []
    const targetClaim = sharedClaims.find((c) => c.id === targetClaimId)
    if (!targetClaim) return
    const recipientParty = targetClaim.owner || targetClaim.ownerParty
    if (recipientParty === activeRole.party) return  // self-issuance guard
    // Phase 14.6 (#189): RS-coverage gate. Every RS id in the template's
    // referencedRequirementsSetIds[] must appear in the wrapped Eval
    // Result of at least one ACTIVE PoE on the target Claim. Exact RS
    // id match (no lineage matching — badges reference frozen RS
    // versions). Defense-in-depth: the picker UI greys out templates
    // that fail this gate; this re-check rejects bypass attempts with
    // a console warning so the failure is debuggable.
    const template = badgeTemplates.find((t) => t.id === badgeTemplateId)
    if (!template) return
    const requiredRsIds = template.referencedRequirementsSetIds || []
    if (requiredRsIds.length > 0) {
      // Phase 14.6 (#189): build coveredRsIds + a name lookup from RS
      // snapshots embedded in Eval Result `requirementsSets[]` entries
      // (each snapshot carries `{ id, name, version }`). This avoids
      // closing over the `requirementSets` useMemo which is declared
      // below this useCallback in V2App's body — referencing it in the
      // deps array would be a temporal-dead-zone violation that the
      // build doesn't catch but blows up at first render.
      const evalResultsById = new Map((merged.evaluationResults || []).map((er) => [er.id, er]))
      const coveredRsIds = new Set()
      const rsNameById = new Map()
      for (const er of (merged.evaluationResults || [])) {
        const rsList = er.requirementsSets || (er.requirementsSet ? [er.requirementsSet] : [])
        for (const rs of rsList) if (rs?.id) rsNameById.set(rs.id, rs.name || rs.id)
      }
      for (const rs of (publishedRequirementSets || [])) {
        if (rs?.id) rsNameById.set(rs.id, rs.name || rs.id)
      }
      for (const poe of (merged.proofsOfEvaluation || [])) {
        if (poe.status && poe.status !== 'active') continue
        if (poe.targetClaimId !== targetClaimId && poe.claimId !== targetClaimId) continue
        const wrapped = evalResultsById.get(poe.wrappedEvalResultId)
        if (!wrapped) continue
        const rsList = wrapped.requirementsSets
          || (wrapped.requirementsSet ? [wrapped.requirementsSet] : [])
        for (const rs of rsList) if (rs?.id) coveredRsIds.add(rs.id)
      }
      const missingRsIds = requiredRsIds.filter((rsId) => !coveredRsIds.has(rsId))
      if (missingRsIds.length > 0) {
        const missingNames = missingRsIds.map((rsId) => rsNameById.get(rsId) || rsId)
        // eslint-disable-next-line no-console
        console.warn('[handleV22IssueBadge] RS-coverage gate failed; issuance rejected.', {
          targetClaimId,
          badgeTemplateId,
          missingRsIds,
          missingNames,
        })
        return
      }
    }
    const id = makeArtifactId('badge', `${targetClaimId}-${badgeTemplateId}-${Date.now()}`)
    const issuance = makeBadgeIssuance({
      id,
      issuerDot: activeRole.partyDot,
      issuerParty: activeRole.party,
      targetClaimId,
      badgeTemplateId,
      description: description || '',
      createdDate: new Date().toISOString(),
    })
    setBadgeIssuances((prev) => [...prev, issuance])
    setV22IssueBadgeContext(null)
    // Fire notification on the Claim owner's inbox.
    // Phase 14.6 (#189): `template` already resolved above for the
    // RS-coverage gate; reuse it here instead of re-finding.
    const recipientRole = ROLES.find((r) => r.party === recipientParty)
    if (recipientRole) {
      enqueueV22NotificationForRequester(recipientRole.id, {
        id: `v22-badge-issued-${id}`,
        type: 'v22-badge-issued',
        from: { name: activeRole.party, dot: activeRole.partyDot },
        badge: {
          issuanceId: id,
          templateId: badgeTemplateId,
          name: template?.name || 'Badge',
          version: template?.version || 1,
        },
        targetClaimId,
        description: description || '',
        date: new Date().toISOString().slice(0, 10),
      })
    }
  }, [activeRole.party, activeRole.partyDot, badgeTemplates, publishedRequirementSets, v22Provisionals, enqueueV22NotificationForRequester])

  const handleV22RevokeBadge = useCallback((badgeIssuanceId, reason) => {
    let revokedIssuance = null
    setBadgeIssuances((prev) => prev.map((b) => {
      if (b.id !== badgeIssuanceId) return b
      revokedIssuance = {
        ...b,
        status: 'revoked',
        revokedDate: new Date().toISOString(),
        revocationReason: reason || '',
      }
      return revokedIssuance
    }))
    setV22RevokeBadgeContext(null)
    // Phase 14.2: fire notification on the Claim owner's inbox.
    if (revokedIssuance) {
      const seed = buildV22SharedArtifacts()
      const sharedClaims = seed.claims || []
      const targetClaim = sharedClaims.find((c) => c.id === revokedIssuance.targetClaimId)
      const recipientParty = targetClaim?.owner || targetClaim?.ownerParty
      const recipientRole = recipientParty ? ROLES.find((r) => r.party === recipientParty) : null
      const template = badgeTemplates.find((t) => t.id === revokedIssuance.badgeTemplateId)
      if (recipientRole) {
        enqueueV22NotificationForRequester(recipientRole.id, {
          id: `v22-badge-revoked-${revokedIssuance.id}`,
          type: 'v22-badge-revoked',
          from: { name: revokedIssuance.issuerParty, dot: revokedIssuance.issuerDot },
          badge: {
            issuanceId: revokedIssuance.id,
            templateId: revokedIssuance.badgeTemplateId,
            name: template?.name || 'Badge',
            version: template?.version || 1,
          },
          targetClaimId: revokedIssuance.targetClaimId,
          reason: reason || '',
          date: new Date().toISOString().slice(0, 10),
        })
      }
    }
  }, [badgeTemplates, enqueueV22NotificationForRequester])
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
    // Phase 11E.4 (#139 fix): two-edge reveal animation. Find the
    // cross-party canonical edge incident to the Claim and orchestrate
    // a typed-style overlay edge drawing in over it, with the canonical
    // (provisional-styled) edge fading out concurrent with the flip.
    //
    // Edge resolution: prefer cross-party edges (grantorParty !==
    // granteeParty) since internal claim-ref / ownership edges aren't
    // the visible Agreement Edge between requester and Claim owner.
    // Fall back gracefully when no cross-party edge is found.
    const incidentEdges = (v22Data?.edges || []).filter((e) => (
      (e.from === nodeId || e.to === nodeId)
      && e.grantorParty
      && e.granteeParty
      && e.grantorParty !== e.granteeParty
    ))
    const primaryEdge = incidentEdges[0]
    if (primaryEdge) {
      // Phase 11E.9 Fix 1: swap the orchestrator's from/to so the typed
      // overlay edge animates from the requester's anchor Asset toward
      // the Claim ("supplier reaches out to pull in the Claim"), not
      // the reverse. `deriveAgreementEdges` (v2_2Data.js:2190) sets
      // `edge.from = claimId, edge.to = anchorAssetId` — the canonical
      // edge convention is downstream-stable, so the swap stays
      // confined to this call site rather than touching edge derivation.
      const fromNodeId = primaryEdge.to    // anchor Asset (animation FROM)
      const toNodeId = primaryEdge.from    // Claim (animation TO)
      // Schedule the orchestrator AFTER the reveal pan settles so the
      // user is already framed on the Claim when the typed overlay
      // begins drawing in. Pan completes at PHASE_BORDER_MS (500ms).
      // Phase 11E.8 Fix 2: drawInMs bumped 500 → 1200 so the curve
      // growth is perceivable to the eye (500ms was too fast — Andrew
      // reported the typed edge was completing before the user could
      // register it). fadeStartDelayMs bumped 600 → 1300 so the
      // provisional fade starts just after draw-in completes (relative
      // to the orchestrator's start, that's t=1300; absolute t=1800
      // from reveal start since the orchestrator is itself scheduled
      // at +500ms). The reveal flip phase still fires at 1100ms — the
      // fade-during-flip overlap is preserved. fadeMs (400) and
      // postFlipPauseMs (900) unchanged: flip duration is the
      // constraint on fade, and post-flip cleanup buffer needs to
      // outlast reveal phase 'done' (~2500ms) regardless.
      setTimeout(() => {
        playRevealEdgeAnimation({
          canvasRef,
          provisionalEdgeId: primaryEdge.id,
          fromNodeId,
          toNodeId,
          sdaType: primaryEdge.sdaType || 'full',
          drawInMs: 1200,
          fadeStartDelayMs: 1300,
          fadeMs: 400,
          postFlipPauseMs: 900,
        })
      }, 500)
    }
  }, [nodeMap, roleId, v22Data])

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

  // Phase 17.3 — View Evaluation Agreement navigation. Triggered from
  // V22NodeDetailPanel's footer button OR from the Claim card action bar
  // on Directory when an EA already exists between the active actor
  // (grantee) and the Claim's owner (grantor). Closes the Directory,
  // clears any selected Claim / RFP panel, and routes to the EA artifact
  // on the parent canvas via the existing `setOpenAgreement` mechanism
  // (mirrors Phase 11C / 17.2.1.1's EA-amendment routing — pan to the
  // Claim node + select the agreement edge + open the agreement panel).
  // Declared here (rather than alongside the other Phase 17.3 handlers
  // at line ~2740) because it closes over `nodeMap` and `canvasRef`,
  // both of which are declared later in the V2App body — co-locating
  // them avoids a TDZ on the useCallback deps array.
  const handleViewEa = useCallback((ea) => {
    if (!ea) return
    setV22DirectoryOpen(false)
    setV22DirectorySelectedClaim(null)
    setV22DirectorySelectedRfp(null)
    setV22RequestingEaForClaim(null)
    const claimNode = ea.claimId ? nodeMap[ea.claimId] : null
    if (claimNode) {
      canvasRef.current?.animatedPanToWithZoom?.(claimNode.x, claimNode.y, 1.0, 500)
    }
    const matchingEdge = (v22Data?.edges || []).find((e) => e.pairedEvaluationAgreementId === ea.id)
    setSelectedEdgeId(matchingEdge?.id || null)
    setOpenAgreement({
      kind: 'evaluation',
      evaluationAgreementId: ea.id,
    })
  }, [nodeMap, v22Data])

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
                  // Phase 11E.1.7 Fix 3: also clear the edge-selection +
                  // openAgreement state so DA / EA Detail Panels (driven
                  // by edge clicks, not node selection) don't persist
                  // over the directory either. Pre-fix only setSel ran,
                  // leaving the agreement panel visible above the layer.
                  setSel(null)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setSelectedEdgeId(null)
                  setOpenAgreement(null)
                  // Phase 11.8 #44: globe-button click uses the default
                  // bottom-left wipe origin. Clear any pinned origin from a
                  // prior node-double-click so the next open animates from
                  // the corner.
                  setV22DirectoryWipeOrigin(null)
                  // Phase 17.2.0.1: lift side effects out of the functional
                  // setState updater. The previous form called
                  // `canvasRef.current.clearHoverState()` inside the updater
                  // callback, which runs during React's reducer phase (i.e.
                  // during V2App's render). That triggered V2Canvas's
                  // setState from V2App's render and fired the
                  // "setState-in-render" warning. The fix reads the current
                  // open state from closure (this is an onClick handler, so
                  // `v22DirectoryOpen` is fresh) and runs all side effects
                  // BEFORE the toggle.
                  if (v22DirectoryOpen) {
                    // Closing the Directory.
                    setV22DirectorySelectedClaim(null)
                    setV22DirectorySelectedRfp(null)
                  } else {
                    // Opening the Directory — clear any open Parent-layer
                    // edge tooltip / hover state so it doesn't persist
                    // behind the wipe.
                    canvasRef.current?.clearHoverState?.()
                  }
                  setV22DirectoryOpen((open) => !open)
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
                    // Phase 11E.2 (#102): renamed `v22-amendment` → `v22-da-amendment`.
                    const isV22DaAmendment = req.type === 'v22-da-amendment'
                    const isV22Evaluation = req.type === 'v22-evaluation'
                    // Phase 11C: warm-path EA-only notifications.
                    const isV22EaRequest = req.type === 'v22-request-ea-only'
                    const isV22EaAccepted = req.type === 'v22-ea-accepted'
                    const isV22EaDeclined = req.type === 'v22-ea-declined'
                    // Phase 11.6 (#164): EA amendment-as-proposal notifications.
                    // Replaced the Phase 11E.1 informational `v22-ea-amendment` type.
                    const isV22EaAmendmentProposal = req.type === 'v22-ea-amendment-proposal'
                    const isV22EaAmendmentAccepted = req.type === 'v22-ea-amendment-accepted'
                    const isV22EaAmendmentRejected = req.type === 'v22-ea-amendment-rejected'
                    // Phase 9A.4 Gate C: four new Transferring notification types.
                    const isV22TransferRequest = req.type === 'v22-transfer-request'
                    const isV22TransferAccepted = req.type === 'v22-transfer-accepted'
                    const isV22TransferDeclined = req.type === 'v22-transfer-declined'
                    const isV22TransferCancelled = req.type === 'v22-transfer-cancelled'
                    // Phase 9D (#112): revocation notifications.
                    const isV22DaRevoked = req.type === 'v22-da-revoked'
                    const isV22EaRevoked = req.type === 'v22-ea-revoked'
                    // Phase 12.2 (#122): stale-eval-result notification —
                    // sent to the evaluator when an Asset they used in an
                    // Eval Result is superseded or removed on the source
                    // Claim. Click pans to the Eval Result; informational
                    // only (the OUTDATED badge stays until re-run).
                    const isV22EvalResultStale = req.type === 'v22-eval-result-stale'
                    // Phase 14.1 (#169 part 2): Badge notifications.
                    const isV22BadgeIssued = req.type === 'v22-badge-issued'
                    const isV22BadgeRevoked = req.type === 'v22-badge-revoked'
                    const isV22BadgeTemplateNewVersion = req.type === 'v22-badge-template-new-version'
                    // Phase 14.2: PoE creation notification.
                    const isV22PoeCreated = req.type === 'v22-poe-created'
                    // Phase 17.2: RFP solicitation notifications. Received
                    // lands on the RFP owner (Bob); rejected lands on the
                    // solicitor (Alice). Click on either routes Directory →
                    // RFP marker → RfpDetailPanel.
                    const isV22RfpSolicitationReceived = req.type === 'v22-rfp-solicitation-received'
                    const isV22RfpSolicitationRejected = req.type === 'v22-rfp-solicitation-rejected'
                    // Phase 17.2.1: the Accept flow lands here on Alice's
                    // inbox when Bob completes the Request Agreement modal
                    // chain. Click routing mirrors the
                    // rejection-notification path (Directory → RFP marker
                    // → RfpDetailPanel); the panel's solicitor-view
                    // accepted-state surfaces the new EA pointer.
                    const isV22RfpSolicitationAccepted = req.type === 'v22-rfp-solicitation-accepted'
                    // Phase 11.6 (#164): amendment-proposal accept/reject get
                    // their own colors — green for accepted, red for rejected
                    // — to match the actionable consequence (vs. the
                    // generic indigo "informational amendment" badges).
                    const badgeColor = isRevocation || isDecline || isV22TransferDeclined || isV22DaRevoked || isV22EaRevoked || isV22EaDeclined || isV22EaAmendmentRejected || isV22BadgeRevoked || isV22RfpSolicitationRejected ? 'var(--accent-red)' : isAcceptance || isV22TransferAccepted || isV22EaAccepted || isV22EaAmendmentAccepted || isV22RfpSolicitationAccepted ? 'var(--accent-green)' : isRevision || isEvaluation || isV22DaAmendment || isV22EaAmendmentProposal || isV22Evaluation || isV22BadgeIssued || isV22BadgeTemplateNewVersion || isV22PoeCreated ? 'var(--accent-indigo)' : isPublishedStandard ? 'var(--accent-blue)' : isV22TransferRequest || isV22EaRequest || isV22EvalResultStale || isV22RfpSolicitationReceived ? 'var(--accent-amber)' : isV22TransferCancelled ? 'var(--text-dim)' : 'var(--accent-indigo)'
                    // Phase 11E.4 (Fix 2): both DA + EA amendments now read
                    // a unified `AMENDMENT` label — the badge is a category
                    // tag, and the body copy already specifies which
                    // artifact was amended. Replaces the prior split
                    // `EA AMENDED` / `DA AMENDED` (Phase 11E.2 introduced
                    // those two; the unified label deprecates both).
                    // Phase 11.6 (#164): EA amendment-proposal triplet has
                    // its own labels — the proposal carries actionable
                    // consequences (accept/reject), distinct from the
                    // informational AMENDMENT category used for DA
                    // amendments and the rolled-back unilateral EA model.
                    const badgeLabel = isRevocation ? 'REVOKED' : isAcceptance ? 'ACCEPTED' : isDecline ? 'DECLINED' : isRevision ? 'REVISED' : isEvaluation ? (req.isAmend ? 'AMENDED' : 'EVALUATED') : isPublishedStandard ? 'PUBLISHED' : isV22EaAmendmentProposal ? 'AMENDMENT PROPOSAL' : isV22EaAmendmentAccepted ? 'AMENDMENT ACCEPTED' : isV22EaAmendmentRejected ? 'AMENDMENT REJECTED' : isV22DaAmendment ? 'AMENDMENT' : isV22Evaluation ? (req.supersedesPriorResultId ? 'RE-EVALUATED' : 'EVALUATED') : isV22Request ? 'REQUEST' : isV22EaRequest ? 'EA REQUEST' : isV22EaAccepted ? 'EA ACCEPTED' : isV22EaDeclined ? 'EA DECLINED' : isV22TransferRequest ? 'TRANSFER' : isV22TransferAccepted ? 'ACCEPTED' : isV22TransferDeclined ? 'DECLINED' : isV22TransferCancelled ? 'CANCELLED' : isV22DaRevoked || isV22EaRevoked ? 'REVOKED' : isV22EvalResultStale ? 'OUTDATED' : isV22BadgeIssued ? 'BADGE ISSUED' : isV22BadgeRevoked ? 'BADGE REVOKED' : isV22BadgeTemplateNewVersion ? 'BADGE UPDATED' : isV22PoeCreated ? 'POE CREATED' : isV22RfpSolicitationReceived ? 'SOLICITATION' : isV22RfpSolicitationRejected ? 'REJECTED' : isV22RfpSolicitationAccepted ? 'ACCEPTED' : 'REQUEST'
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
                                  // Phase 11E.7: drain the pending-reveal
                                  // entry BEFORE startReveal sets the
                                  // active-reveal state, so React batches
                                  // both updates into the same render —
                                  // the stamp gate hands off cleanly with
                                  // no one-frame visual gap between
                                  // pre-click "still provisional" and
                                  // animation "still provisional."
                                  removePendingReveal(roleId, targetNode.id)
                                  // Reveal animation handles its own pan.
                                  startReveal(targetNode.id)
                                } else {
                                  // Phase 6.5+ #4: pan to the target node only,
                                  // zoom 1.28 (was midpointing toward a paired
                                  // node at zoom 0.7, which felt under-panned
                                  // and under-zoomed). Edge framing is a polish
                                  // follow-up.
                                  // Phase 11E.7: even when the reveal
                                  // animation doesn't fire (e.g. the
                                  // grantee already deselected the
                                  // recently-accepted Claim before
                                  // clicking the notification, clearing
                                  // _isNew + _wasProvisional), still drain
                                  // the pending-reveal stamp so the Claim
                                  // doesn't stay forever provisional.
                                  removePendingReveal(roleId, targetNode.id)
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
                          // Phase 17.2.1.1: if the user is on the Directory
                          // layer, close it before opening the response modal
                          // so the user lands on their parent canvas after
                          // resolving the request.
                          if (v22DirectoryOpen) setV22DirectoryOpen(false)
                          if (req.v22DaId) setV22RespondingTo({ daId: req.v22DaId })
                        } else if (req.type === 'v22-request-ea-only') {
                          // Phase 11C: warm-path EA-only request → open the
                          // CombinedResponseModal in eaOnlyMode (same dismiss-
                          // on-terminal-action semantics as v22-request).
                          // Phase 17.2.1.1: close Directory if open (see above).
                          if (v22DirectoryOpen) setV22DirectoryOpen(false)
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
                          // Phase 17.2.1.1: close Directory if open so the
                          // user lands on the parent canvas at the target Claim.
                          if (v22DirectoryOpen) setV22DirectoryOpen(false)
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
                                // Phase 11E.7: drain the pending-reveal
                                // stamp before startReveal flips on the
                                // active-reveal state. Same batched-render
                                // handoff pattern as the cold-path branch.
                                removePendingReveal(roleId, targetNode.id)
                                startReveal(targetNode.id)
                              } else {
                                // Phase 11E.7: drain regardless when no
                                // animation will play, otherwise the
                                // pre-click provisional stamp would persist
                                // indefinitely on this viewer's view.
                                if (req.type === 'v22-ea-accepted') {
                                  removePendingReveal(roleId, targetNode.id)
                                }
                                canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                              }
                            }
                          })
                        } else if (req.type === 'v22-da-amendment') {
                          // Phase 11E.2 (#102): DA amendment notifications now
                          // deep-link directly to the amended DA's Detail
                          // Panel (parallel to v22-ea-amendment's EA panel
                          // routing). Pan to the Claim node first for visual
                          // context, then open the DA panel via the
                          // setOpenAgreement direct-id shape that
                          // V22NodeDetailPanel resolves at line 4413.
                          // Phase 11E.5 Fix 2: also select the canonical
                          // agreement edge for the amended DA so the user
                          // sees the amber selection styling on the edge
                          // alongside the open Detail Panel. Edge id resolves
                          // via `disclosureAgreementId === req.v22DaId`
                          // (v2_2Data.deriveAgreementEdges line 2103).
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const claimNode = req.v22ClaimId ? nodeMap[req.v22ClaimId] : null
                          if (claimNode) {
                            canvasRef.current?.animatedPanToWithZoom?.(claimNode.x, claimNode.y, 1.0, 500)
                          }
                          if (req.v22DaId) {
                            const matchingEdge = (v22Data?.edges || []).find((e) => e.disclosureAgreementId === req.v22DaId)
                            setSelectedEdgeId(matchingEdge?.id || null)
                            setOpenAgreement({
                              kind: 'disclosure',
                              disclosureAgreementId: req.v22DaId,
                            })
                          }
                        } else if (req.type === 'v22-ea-amendment-proposal') {
                          // Phase 11.6 (#164): grantee clicked an amendment
                          // proposal notification. Open AmendmentResponseModal
                          // with the EA + amendment id; the modal handles
                          // accept/reject. Notification is NOT auto-dismissed
                          // — same persistence semantics as v22-request /
                          // v22-request-ea-only (it stays in the inbox until
                          // the grantee submits a terminal action). Pan to
                          // the Claim node for visual context, but don't
                          // open the EA Detail Panel — the modal is the
                          // foreground UI.
                          const claimNode = req.v22ClaimId ? nodeMap[req.v22ClaimId] : null
                          if (claimNode) {
                            canvasRef.current?.animatedPanToWithZoom?.(claimNode.x, claimNode.y, 1.0, 500)
                          }
                          if (req.v22EaId && req.v22AmendmentId) {
                            setV22RespondingToEaAmendment({
                              eaId: req.v22EaId,
                              amendmentId: req.v22AmendmentId,
                            })
                          }
                        } else if (req.type === 'v22-ea-amendment-accepted' || req.type === 'v22-ea-amendment-rejected') {
                          // Phase 11.6 (#164): grantor clicked the response
                          // notification. Pan to Claim + open EA Detail
                          // Panel + select EA edge (mirrors Phase 11E.9
                          // pattern). Auto-dismiss on click since the
                          // outcome is terminal.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const claimNode = req.v22ClaimId ? nodeMap[req.v22ClaimId] : null
                          if (claimNode) {
                            canvasRef.current?.animatedPanToWithZoom?.(claimNode.x, claimNode.y, 1.0, 500)
                          }
                          if (req.v22EaId) {
                            const matchingEdge = (v22Data?.edges || []).find((e) => e.pairedEvaluationAgreementId === req.v22EaId)
                            setSelectedEdgeId(matchingEdge?.id || null)
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
                        } else if (req.type === 'v22-eval-result-stale') {
                          // Phase 12.2 (#122): pan to the OUTDATED Eval
                          // Result + open its Detail Panel. Click dismisses
                          // the notification row, but the OUTDATED status
                          // on the Eval Result persists until re-run.
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            const targetNode = req.evalResultId ? nodeMap[req.evalResultId] : null
                            if (targetNode) {
                              setSel(targetNode.id)
                              setForcePanelTab(null)
                              setForceExpandSda(null)
                              canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                            }
                          })
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
                        } else if (req.type === 'v22-rfp-solicitation-received' || req.type === 'v22-rfp-solicitation-rejected' || req.type === 'v22-rfp-solicitation-accepted') {
                          // Phase 17.2: click navigates to Directory → RFP
                          // marker → RfpDetailPanel. Both notification types
                          // route to the same RFP — received lands on the
                          // owner (Bob); rejected lands on the solicitor
                          // (Alice). Each side sees their own perspective
                          // (incoming list vs. own solicitation card) via
                          // the panel's three-way visibility branch.
                          //
                          // Phase 17.2.1: the accepted variant lands on the
                          // solicitor's inbox alongside the standard EA+DA
                          // request notification. Click routes here so the
                          // solicitor can see their solicitation in
                          // ACCEPTED state; the parent-canvas EA navigation
                          // is reachable via the separate v22-request
                          // notification (existing cold-path flow).
                          //
                          // Click is auto-dismissed for all three — the
                          // loop terminates after the rejection or
                          // acceptance.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          // Resolve the RFP from the seed + closed-RFP merge.
                          const sharedRfps = mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds).rfps || []
                          const targetRfp = sharedRfps.find((r) => r.id === req.rfpId) || null
                          if (targetRfp) {
                            // Ensure Directory is open. Mutual exclusion:
                            // clear any open Claim panel.
                            setV22DirectoryOpen(true)
                            setV22DirectorySelectedClaim(null)
                            setV22DirectorySelectedRfp(targetRfp)
                            // Phase 17.2.0.2: full select via DirectoryLayer's
                            // imperative `selectRfp` — drives the same on-
                            // canvas state as a manual marker click (setPinned
                            // → tooltip + select-state brightening) plus pan
                            // + zoom to full-card LOD when starting from a
                            // lower zoom so the marker reads clearly on
                            // arrival. Replaces 17.2.0.1's `panToRfp`, which
                            // was pan-only at current zoom and appeared to do
                            // nothing from the default 15% galactic view.
                            // DirectoryLayer may still be opening (phase
                            // machine + load animation), so the imperative
                            // returns false until ready — retry on each rAF
                            // tick until success or the 60-frame cap (~1 s
                            // @ 60fps — Directory opening is ~600 ms).
                            let attempts = 0
                            const trySelect = () => {
                              attempts += 1
                              const ok = directoryLayerRef.current?.selectRfp?.(targetRfp)
                              if (ok || attempts > 60) return
                              requestAnimationFrame(trySelect)
                            }
                            requestAnimationFrame(trySelect)
                          }
                        } else if (req.type === 'v22-poe-created') {
                          // Phase 14.2: click navigates to the PoE Detail
                          // Panel on the recipient's canvas.
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            const targetNode = req.poeId ? nodeMap[req.poeId] : null
                            if (targetNode) {
                              setSel(targetNode.id)
                              canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                            }
                          })
                        } else if (req.type === 'v22-badge-issued') {
                          // Phase 14.2: deep-link to the target Claim's
                          // Detail Panel (where the new badge appears in
                          // the Badges section). Recipient = Claim owner.
                          ensureParentLayer(() => {
                            updateRoleState(roleId, prev => ({
                              ...prev,
                              dismissedReqs: [...prev.dismissedReqs, req.id],
                            }))
                            const targetNode = req.targetClaimId ? nodeMap[req.targetClaimId] : null
                            if (targetNode) {
                              setSel(targetNode.id)
                              canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
                            }
                          })
                        } else if (req.type === 'v22-badge-revoked') {
                          // Phase 14.2: open the Badge Issuance expand modal
                          // (no longer a Detail Panel) so the recipient sees
                          // the revocation context (reason) directly.
                          updateRoleState(roleId, prev => ({
                            ...prev,
                            dismissedReqs: [...prev.dismissedReqs, req.id],
                          }))
                          const issuance = badgeIssuances.find((b) => b.id === req.badge?.issuanceId)
                          if (issuance) {
                            const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                            const targetClaim = (merged.claims || []).find((c) => c.id === issuance.targetClaimId) || null
                            const template = badgeTemplates.find((t) => t.id === issuance.badgeTemplateId) || null
                            setV22ExpandedArtifact({
                              artifact: issuance,
                              schema: 'badge-issuance',
                              badgeIssuanceContext: {
                                template,
                                recipientParty: targetClaim?.owner || targetClaim?.ownerParty,
                                targetClaimName: targetClaim?.name,
                                allClaims: merged.claims || [],
                                allBadgeTemplates: badgeTemplates,
                              },
                            })
                          }
                        } else if (req.type === 'v22-badge-template-new-version') {
                          // Phase 14.1 (#169 part 2): informational — clicking
                          // dismisses; no auto-navigation.
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
                                                      : isV22EaAmendmentProposal
                                                        ? `${req.from.name} proposed an amendment to the Evaluation Agreement on Claim ${req.asset?.name || 'a Claim'}.${req.proposalMessage ? ` "${req.proposalMessage}"` : ''}`
                                                        : isV22EaAmendmentAccepted
                                                          ? `${req.from.name} accepted your amendment proposal on Claim ${req.asset?.name || 'a Claim'}.${req.responseMessage ? ` "${req.responseMessage}"` : ''}`
                                                          : isV22EaAmendmentRejected
                                                            ? `${req.from.name} rejected your amendment proposal on Claim ${req.asset?.name || 'a Claim'}.${req.responseMessage ? ` "${req.responseMessage}"` : ''}`
                                                            : isV22DaAmendment
                                                              ? `Disclosure Agreement amended: ${req.asset?.name || 'a Claim'}.${req.note ? ` (Note: ${req.note})` : ''}`
                                                              : isV22EvalResultStale
                                                                ? `${req.from?.name || 'The Claim owner'} amended evidence on a Claim — your Evaluation Result "${req.evalResultName || req.evalResultId}" is now out of date.`
                                                                : isV22BadgeIssued
                                                                  ? `${req.from.name} issued the "${req.badge?.name || 'Badge'} v${req.badge?.version ?? 1}" badge against your Proof of Evaluation.${req.description ? ` "${req.description}"` : ''}`
                                                                  : isV22BadgeRevoked
                                                                    ? `${req.from.name} revoked the "${req.badge?.name || 'Badge'} v${req.badge?.version ?? 1}" badge.${req.reason ? ` "${req.reason}"` : ''}`
                                                                    : isV22BadgeTemplateNewVersion
                                                                      ? `${req.from.name} published v${req.badge?.version ?? '?'} of "${req.badge?.name || 'Badge Template'}". Your existing badge of this template remains valid.`
                                                                      : isV22PoeCreated
                                                                        ? `${req.from.name} created a Proof of Evaluation${req.claimName ? ` on your Claim "${req.claimName}"` : ''}.`
                                                                        : isV22RfpSolicitationReceived
                                                                          ? `${req.from.name} solicited your RFP${req.rfpName ? ` — Re: ${req.rfpName}` : ''}.`
                                                                          : isV22RfpSolicitationRejected
                                                                            ? `${req.from.name} rejected your solicitation${req.rfpName ? ` — Re: ${req.rfpName}` : ''}.${req.rejectionMessage ? ` "${req.rejectionMessage}"` : ''}`
                                                                            : isV22RfpSolicitationAccepted
                                                                              ? `${req.from.name} accepted your solicitation${req.rfpName ? ` — Re: ${req.rfpName}` : ''}. See your new EA on the parent canvas.`
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

                {/* Phase 11.8 #54: Reset all data — clears every role's
                    canvas state (perRoleState), provisional artifacts, and
                    credits back to their seeded defaults. Confirmation
                    modal explains the scope before committing. */}
                <div style={{ borderTop: '1px solid var(--border)', padding: '6px 0' }}>
                  <div
                    onClick={() => {
                      setShowAcct(false)
                      setV22ResetConfirmOpen(true)
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 14px',
                      cursor: 'pointer',
                      transition: 'background .15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--accent-red) 8%, transparent)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--accent-red)', width: 16, textAlign: 'center' }}>↺</span>
                    <span style={{ fontSize: 11, color: 'var(--accent-red)', flex: 1, fontWeight: 500 }}>Reset all data</span>
                  </div>
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
          // Phase 11.8 #44: double-click on the Radiant Network actor node
          // opens the Directory Layer with the circular wipe originating
          // from the node's screen-space center. V2Canvas computes the
          // origin via world-to-screen projection on the node's group.
          onV22OpenDirectoryFromNode={({ screenX, screenY }) => {
            setSel(null)
            setForcePanelTab(null)
            setForceExpandSda(null)
            setSelectedEdgeId(null)
            setOpenAgreement(null)
            // Phase 16.1.1 Item 5: clear parent-layer edge hover state
            // before transitioning so any open tooltip doesn't persist
            // behind the wipe.
            canvasRef.current?.clearHoverState?.()
            setV22DirectoryWipeOrigin({ x: screenX, y: screenY })
            setV22DirectoryOpen(true)
          }}
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
                // Phase 13.2: pass the full RS id list so multi-RS bundled
                // Eval Results carry every RS forward into the re-run picker.
                const lockedRsIds = (er.requirementsSets || []).map((rs) => rs.id)
                setV22EvalContext({
                  evaluationAgreementId: eaForRerun ? eaForRerun.id : null,
                  claimId: er.claimId,
                  selfEvaluation: !eaForRerun,
                  lockedRequirementsSetIds: lockedRsIds.length > 0 ? lockedRsIds : null,
                  lockedRequirementsSetId: lockedRsIds.length === 1 ? lockedRsIds[0] : null,
                  priorActiveResultId: er.id,
                })
                return
              }
              case 'createPoE': {
                // Phase 13 (#168): open the Create-PoE confirmation modal.
                // Gating (Eval Result is active + no PoE already wraps it)
                // is enforced by the action bar itself (button hidden in
                // those cases) — this dispatch just opens the modal.
                const er = node.v22Artifact
                if (!er) return
                setV22CreatingPoEContext({ evalResultId: er.id })
                return
              }
              case 'issueBadge': {
                // Phase 14.2 (#169a): Issue Badge entry point. Target is the
                // Claim. From a PoE node: derive Claim id from PoE.claimId.
                // From a Claim node: use the Claim's id directly. Self-
                // issuance is gated upstream (action bar hides the button
                // when the current actor owns the parent Claim).
                if (node.v22Type === 'PROOF OF EVALUATION') {
                  const poe = node.v22Artifact
                  if (!poe?.claimId) return
                  setV22IssueBadgeContext({ targetClaimId: poe.claimId })
                } else if (node.v22Type === 'CLAIM') {
                  const claim = node.v22Artifact
                  if (!claim?.id) return
                  setV22IssueBadgeContext({ targetClaimId: claim.id })
                }
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
                  // Phase 13.4 (#175): Expand → ExpandedArtifactModal
                  // ('disclosure-agreement' schema).
                  onExpand={() => setV22ExpandedArtifact({
                    artifact: resolved.disclosureAgreement,
                    schema: 'disclosure-agreement',
                  })}
                />
              ) : (
                <EvaluationAgreementDetailPanel
                  agreement={resolved.evaluationAgreement}
                  // Phase 11.6.1 Fix 2: pass the live Claim so the panel
                  // can render the current acknowledgments. Per spec
                  // §11.2a (Phase 11.6 revision), acknowledgments live
                  // on the Claim; the EA's `acknowledgmentsAccepted` is
                  // an audit-trail snapshot of the original agreement.
                  claim={v22View?.claims?.find((c) => c.id === resolved.evaluationAgreement?.claimId) || null}
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
            ref={directoryLayerRef}
            open={v22DirectoryOpen}
            activeParty={activeRole.party}
            // Phase 16.0: roleId + provisionals threaded so DirectoryLayer
            // can compute the per-role view (`buildV22DirectoryDataForRole`).
            roleId={roleId}
            v22Provisionals={v22Provisionals}
            // Phase 17.1: session-state RFP closures threaded into the
            // per-role view builder. Closed RFPs are visible only to
            // their owner (dashed treatment); non-owners see them
            // filtered out of `otherRfps` / `cluster.rfps`.
            v22ClosedRfpIds={v22ClosedRfpIds}
            // Phase 11.8 #44: route the circular wipe through the screen-space
            // origin captured when the Radiant Network actor node was
            // double-clicked. Null falls back to the chrome globe-button corner.
            wipeOrigin={v22DirectoryWipeOrigin}
            onOpenAIShopper={() => setV22AIShopperOpen(true)}
            onClose={() => {
              setV22DirectoryOpen(false)
              setV22DirectorySelectedClaim(null)
              // Phase 17.0: clear any open RFP panel on Directory close.
              setV22DirectorySelectedRfp(null)
            }}
            // Phase 16.0: per-dot click. Replaces Phase 11B's onClusterClick
            // + materializedClaim props. The DirectoryLayer pins its own
            // tooltip; here we just stash the selected Claim so the Detail
            // Panel mount path picks it up. Null = dismiss.
            //
            // Phase 17.0: mutual exclusion with the selected RFP — clicking
            // a Claim dot clears any open RFP Detail Panel so only one is
            // visible at a time. A null Claim (empty-canvas click) clears
            // both since the user is dismissing whichever panel is open.
            onClaimDotClick={(claim) => {
              setV22DirectorySelectedClaim(claim)
              setV22DirectorySelectedRfp(null)
            }}
            // Phase 17.0: clicking an RFP marker opens the read-only
            // RfpDetailPanel. Mirror of the Claim mutual-exclusion rule.
            onRfpClick={(rfp) => {
              setV22DirectorySelectedRfp(rfp)
              setV22DirectorySelectedClaim(null)
            }}
            // Phase 17.3 — thread the active actor's EA collection so the
            // per-claim card render path can resolve the existing EA via
            // `getActiveEaForClaimAndRequester` and stamp the
            // `_directoryExistingEa` / `_directoryRequestEaCandidate`
            // markers on the synthetic node V22ActionBar consults.
            evaluationAgreements={(() => {
              const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
              return merged.evaluationAgreements || []
            })()}
            // Phase 17.3 — card action dispatcher. Mirrors V22NodeDetailPanel
            // footer routing for the two Directory-only CTAs. `claim` is the
            // raw artifact; `existingEa` is the resolved EA (null when the
            // action is requestEvaluationAgreement).
            onClaimCardAction={(action, _node, claim, existingEa) => {
              if (action === 'requestEvaluationAgreement') {
                handleRequestEaForClaim(claim)
              } else if (action === 'viewEvaluationAgreement') {
                handleViewEa(existingEa)
              }
            }}
            // Phase 17.3.1 — session-state solicitations threaded so the
            // RFP card render path can detect "this active actor already
            // solicited this RFP" and suppress the Solicit CTA. The Map's
            // values list is what the brief's predicate consumes.
            solicitations={Array.from(v22Solicitations.values())}
            // Phase 17.3.1 — card action dispatcher for RFP cards. Mirrors
            // the panel footer's "Solicit with my Claim" handler — opens
            // SolicitationCreateModal with the RFP pre-loaded. Same
            // session-state setter the panel footer uses, so behaviour is
            // identical across the two surfaces.
            onRfpCardAction={(action, rfp) => {
              if (action === 'solicitWithClaim') {
                setV22SolicitOpenForRfp({ rfp })
              }
            }}
          />
        )}

        {/* Phase 16.0: Detail Panel for the directory-selected Claim.
            Mounted alongside the DirectoryLayer (not inside it) so the
            existing Detail Panel z-index ordering and panel-shell styling
            apply. The panel reuses V22NodeDetailPanel's standard CLAIM
            rendering path; the claim is never on the parent canvas, so a
            synthetic node is built via buildClaimNodeForDirectoryMaterialization
            (function name is a Phase 11B holdover — kept to limit blast
            radius; rename deferred). The non-owner branch of V22ClaimPanel
            doesn't render Amend/Self-Evaluate; Run Evaluation requires an
            EA. The Phase 11C warm-path "Request Evaluation Agreement"
            entry is wired below for non-owner cases with an active DA
            but no EA. */}
        {v22DirectoryOpen && v22DirectorySelectedClaim && (() => {
          const sharedForPanel = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const claim = v22DirectorySelectedClaim
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
              // Phase 16.1.3 Item 5: bottom: 28 so the panel ends ABOVE the
              // app footer (footer ≈ 28px tall at z-300). Previously
              // bottom: 0 made the Detail Panel extend behind the footer,
              // cutting off the "Request Evaluation Agreement" button.
              // Phase 17.2 Item 11: bumped 28 → 27 to close a 1px hairline
              // gap visible on the Directory-layer Claim Detail Panel.
              // Matches the parallel adjustment on the RFP panel mount.
              bottom: 27,
              width: 480,
              zIndex: 200,
            }}>
              <V22NodeDetailPanel
                node={syntheticNode}
                activeParty={activeRole.party}
                onClose={() => setV22DirectorySelectedClaim(null)}
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
                // Phase 13.4 (#175): Expand affordance for the directory-
                // materialized Claim. The synthetic node is always a CLAIM,
                // so route directly to the 'claim' schema.
                onExpand={(artifact) => setV22ExpandedArtifact({ artifact, schema: 'claim' })}
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
                // Phase 17.3 — also resolve the cold-path EA state for the
                // Directory mount. When no DA exists (no warm-path entry),
                // the panel surfaces either Request EA (cold path via
                // AssetPickerModal) or View EA depending on whether an EA
                // already exists between the viewer and the Claim's owner.
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
                  const isOwnerViewingDir = claim.owner === activeRole.party
                  // Phase 17.3 — resolve EA between the active actor and the
                  // Claim owner via the shared predicate. Result drives both
                  // the EA-status section and the footer button choice.
                  const existingEaForActor = (!isOwnerViewingDir && !showWarm)
                    ? getActiveEaForClaimAndRequester(claim, activeRole.party, sharedForPanel.evaluationAgreements || [])
                    : null
                  // Always wire the cold-path Request EA + View EA handlers
                  // on the Directory mount (the panel gates rendering by
                  // !hasActiveDaWithoutEa + EA presence).
                  const coldPathProps = (!isOwnerViewingDir && !showWarm)
                    ? {
                        existingEaForActor,
                        onRequestEa: handleRequestEaForClaim,
                        onViewEa: handleViewEa,
                      }
                    : {}
                  if (!showWarm) return coldPathProps
                  return {
                    ...coldPathProps,
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
                      // Phase 16.1.3 Item 7: do NOT close Directory or clear
                      // the selected Claim. The Request EA modal opens on
                      // top of Directory + Detail Panel; closing/cancelling
                      // the modal should leave Directory + Detail Panel
                      // intact. Previous behavior (closing Directory here)
                      // forced a return to parent layer when the user
                      // cancelled the modal, losing their navigation
                      // context.
                    },
                  }
                })()}
              />
            </div>
          )
        })()}

        {/* Phase 17.0 — Read-only RFP Detail Panel. Mounted parallel to the
            Claim Detail Panel block above; mutual exclusion is enforced at
            the click-handler level (each setter clears the other) so only
            one of these is ever non-null at a time. Panel shell positioning
            mirrors the Claim mount: position:fixed, top:61 (clears chrome),
            right:0, bottom:28 (clears footer), width:480, zIndex:200.
            `requirementsSets` lookup uses `publishedRequirementSets` (the
            same state V2App threads to Run Eval / Create Claim flows). */}
        {v22DirectoryOpen && v22DirectorySelectedRfp && (() => {
          // Phase 17.1: re-resolve the RFP from session-state-merged
          // shared artifacts each render so the panel reflects the
          // latest status / closedDate (close/reopen clicks update
          // `v22ClosedRfpIds` but `v22DirectorySelectedRfp` keeps the
          // snapshot from the original click). Fall back to the snapshot
          // if the artifact isn't in shared (defensive — shouldn't
          // happen for seeded RFPs).
          // Phase 17.2: also chain mergeSolicitations so the panel sees
          // session-state solicitations on every render. claimsById Map
          // is built once here and passed to the panel (which forwards
          // to each SolicitationCard for name + owner resolution).
          const mergedShared = mergeSolicitations(
            mergeClosedRfps(
              mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals),
              v22ClosedRfpIds,
            ),
            v22Solicitations,
          )
          const currentRfp = (mergedShared.rfps || []).find(
            (r) => r.id === v22DirectorySelectedRfp.id,
          ) || v22DirectorySelectedRfp
          const solicitationsForRfp = (mergedShared.rfpSolicitations || []).filter(
            (s) => s.rfpId === currentRfp.id,
          )
          const claimsByIdMap = new Map((mergedShared.claims || []).map((c) => [c.id, c]))
          // Phase 17.2.1.1: assetsById Map for the RFP "For Asset" row
          // lookup. Built from the merged shared artifact set (same source
          // RfpDetailPanel uses for everything else).
          const assetsByIdMap = new Map((mergedShared.assets || []).map((a) => [a.id, a]))
          // Active actor's own Claims — passed to the create modal as the
          // pickable list. Owner of a Claim is the active actor's party.
          const myClaims = (mergedShared.claims || []).filter((c) => c.owner === activeRole.party)
          return (
            <div style={{
              position: 'fixed',
              top: 61,
              right: 0,
              // Phase 17.2 Item 11: close the 1px gap between Detail
              // Panel and the app footer. The footer measures 27px at
              // its DOM bounding box at the canonical viewport zoom; the
              // Phase 16.1.3 Item 5 value of 28px left a 1px hairline
              // gap visible to the user. Setting bottom:27 closes it.
              bottom: 27,
              width: 480,
              zIndex: 200,
            }}>
              <RfpDetailPanel
                rfp={currentRfp}
                activeParty={activeRole.party}
                requirementsSets={publishedRequirementSets || []}
                onClose={() => setV22DirectorySelectedRfp(null)}
                onCloseRfp={(rfp) => {
                  // Phase 17.1: record the closure in session state. The
                  // closedDate is captured here (not regenerated by
                  // closeRfp inside mergeClosedRfps) so re-renders see a
                  // stable timestamp.
                  setV22ClosedRfpIds((prev) => {
                    const next = new Map(prev)
                    next.set(rfp.id, new Date().toISOString())
                    return next
                  })
                }}
                onReopenRfp={(rfp) => {
                  setV22ClosedRfpIds((prev) => {
                    if (!prev.has(rfp.id)) return prev
                    const next = new Map(prev)
                    next.delete(rfp.id)
                    return next
                  })
                }}
                // Phase 17.2: solicitation props.
                solicitations={solicitationsForRfp}
                activeClaims={myClaims}
                claimsById={claimsByIdMap}
                // Phase 17.2.1.1: assetsById Map drives the "For Asset"
                // row's Asset name resolution. Falls back to (Asset not
                // found) muted text when the assetId doesn't resolve.
                assetsById={assetsByIdMap}
                onOpenSolicitModal={({ rfp: targetRfp }) => setV22SolicitOpenForRfp({ rfp: targetRfp })}
                onRejectSolicitation={(solicitation) => setV22SolicitationToReject(solicitation)}
                // Phase 17.2.1 / 17.2.1.1: owner-side Accept flow entry.
                // Click on the SolicitationCard's "Request Agreement"
                // button opens CombinedRequestModal directly (no Asset
                // picker step — the RFP's assetId is the anchor).
                onRequestAgreement={handleRequestAgreement}
                // Phase 17.3.1: clicking a Requirements row opens
                // RequirementsSetDetailModal at the V2App level.
                onRequirementClick={(rsId) => setV22OpenRsId(rsId)}
              />
            </div>
          )
        })()}

        {/* Phase 17.2: SolicitationCreateModal — opened from the
            non-owner RfpDetailPanel footer. Single-Claim picker against
            the active actor's own Claims. On submit, V2App's
            handleCreateSolicitation builds the artifact + fires a
            v22-rfp-solicitation-received notification on the owner's
            inbox. */}
        {v22SolicitOpenForRfp && (() => {
          const sharedForModal = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const myClaims = (sharedForModal.claims || []).filter((c) => c.owner === activeRole.party)
          return (
            <SolicitationCreateModal
              rfp={v22SolicitOpenForRfp.rfp}
              activeClaims={myClaims}
              // Phase 17.2.0.2: thread RS lookup so the modal renders
              // a Required-Standards accordion above the Claim picker.
              // `publishedRequirementSets` is the same source the RFP
              // Detail Panel uses to resolve RS chips.
              requirementsSets={publishedRequirementSets}
              // Phase 17.2.1.1: thread EA collection + solicitor party so
              // the modal can grey out Claims already mapped to the RFP
              // owner via an active or pending EA.
              evaluationAgreements={sharedForModal.evaluationAgreements || []}
              solicitorParty={activeRole.party}
              onSubmit={handleCreateSolicitation}
              onCancel={() => setV22SolicitOpenForRfp(null)}
            />
          )
        })()}

        {/* Phase 17.2: SolicitationRejectModal — opened from
            SolicitationCard's Reject button on the owner view. Submit
            transitions the solicitation to 'rejected' + fires a
            v22-rfp-solicitation-rejected notification on the solicitor's
            inbox. */}
        {v22SolicitationToReject && (() => {
          const sharedForReject = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const claim = (sharedForReject.claims || []).find((c) => c.id === v22SolicitationToReject.claimId)
          return (
            <SolicitationRejectModal
              solicitation={v22SolicitationToReject}
              solicitorClaimName={claim?.name || v22SolicitationToReject.claimId}
              onSubmit={handleRejectSolicitation}
              onCancel={() => setV22SolicitationToReject(null)}
            />
          )
        })()}

        {/* Phase 17.2.1.1: AssetPickerModal mount block REMOVED. The
            Accept flow no longer has an intermediate Asset-picker step —
            the RFP carries its anchor Asset from creation via the
            required `rfp.assetId` field. `handleRequestAgreement` opens
            CombinedRequestModal directly with the RFP's Asset pre-filled.
            AssetPickerModal.jsx is preserved in the codebase for the
            future create-RFP flow (Phase 17.6+), which will pick the
            Asset at RFP-creation time instead. */}

        {/* V2.2 Phase 7 — AI Shopper modal (spec §9). Opens either from the
            chrome icon (user had no Directory context in mind) or from within
            the Directory Layer (user already browsing). */}
        {v22AIShopperOpen && (() => {
          const shared = buildV22SharedArtifacts()
          // Phase 17.2.0.4: O(n²) → O(n) rewrite. Previously the
          // `.map(d => shared.claims.find(...))` chain ran a linear
          // scan over all ~23k Claims for each of the ~23k public DAs
          // (~500 M comparisons), causing the ~5 s click-to-open lag.
          // Build a single id → claim Map once and look up in O(1).
          const claimsById = new Map(shared.claims.map((c) => [c.id, c]))
          const publicDas = shared.disclosureAgreements.filter(
            (d) => d.grantee?.party === 'Radiant Network' && d.subject?.kind === 'claim',
          )
          const publicClaims = publicDas
            .map((d) => {
              const claim = claimsById.get(d.subject.id)
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
            availableRequirementsSets={(() => {
              // Phase 17.2.1.1: scrollbox lists ALL published Requirements
              // Sets (network-wide) so RFP pre-selection works — `rfp.requirementsSetIds`
              // can reference any actor's published RS. The active actor's
              // own (non-published) RSes are appended below so they remain
              // selectable from this entry point. Dedupe by id (own wins so
              // own-private RSes can never disappear if they're also published).
              const rows = []
              const seen = new Set()
              for (const rs of (publishedRequirementSets || [])) {
                if (seen.has(rs.id)) continue
                seen.add(rs.id)
                rows.push({
                  id: rs.id,
                  name: rs.name,
                  version: rs.version ?? 1,
                  isPublished: true,
                  ownerParty: rs._publishedBy || null,
                })
              }
              for (const rs of (requirementSets || [])) {
                if (seen.has(rs.id)) continue
                seen.add(rs.id)
                rows.push({
                  id: rs.id,
                  name: rs.name,
                  version: rs.version ?? 1,
                  isPublished: false,
                  ownerParty: null,
                })
              }
              return rows
            })()}
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
            onClose={() => {
              setV22RequestOpen(false)
              setV22AIShopperResult(null)
              // Phase 17.2.1: cancelling/closing the CombinedRequestModal
              // while the Accept flow was in progress clears the in-flight
              // context so a future Request Agreement click starts fresh.
              setV22AcceptingSolicitation(null)
              setV22RequestAnchor(null)
            }}
            // Phase 7: AI Shopper pre-populates PIN + suggested Req Set.
            // Phase 17.2.1.2: prefer the plural `suggestedRequirementsSetIds`
            // (Accept-flow entry, full RFP RS array) over the singular
            // `suggestedRequirementsSetId` (AI Shopper entry, single id).
            initialPin={v22AIShopperResult?.claimPin || ''}
            initialRequirementsSetIds={
              Array.isArray(v22AIShopperResult?.suggestedRequirementsSetIds)
                ? v22AIShopperResult.suggestedRequirementsSetIds
                : v22AIShopperResult?.suggestedRequirementsSetId
                  ? [v22AIShopperResult.suggestedRequirementsSetId]
                  : []
            }
          />
        )}

        {/* Phase 17.3 — AssetPickerModal for the Directory-layer Claim
            Request EA cold-path CTA. Opens when the user clicks Request EA
            from either V22NodeDetailPanel's footer or the Claim card's
            action bar on Directory; once an Asset is picked the modal
            closes and CombinedRequestModal opens pre-filled with the
            picked Asset + the target Claim's PIN (no RFP context, so no
            `initialRequirementsSetIds` pre-selection). The modal is also
            available for the future create-RFP flow (Phase 17.5+). */}
        {v22RequestingEaForClaim && (() => {
          const sharedForPicker = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const activeAssets = (sharedForPicker.assets || []).filter((a) => a.owner === activeRole.party)
          return (
            <AssetPickerModal
              targetClaim={v22RequestingEaForClaim}
              context={{ type: 'directory-claim' }}
              activeAssets={activeAssets}
              activeParty={activeRole.party}
              onSubmit={handleAssetPickedForClaim}
              onCancel={() => setV22RequestingEaForClaim(null)}
            />
          )
        })()}

        {/* Phase 17.3.1 — RequirementsSetDetailModal. Opens from the
            new Requirements row click in RfpDetailPanel. Resolves the
            clicked rsId against the canonical publishedRequirementSets
            catalog. */}
        {v22OpenRsId && (() => {
          const rs = (publishedRequirementSets || []).find((r) => r.id === v22OpenRsId) || null
          return (
            <RequirementsSetDetailModal
              requirementsSet={rs}
              onClose={() => setV22OpenRsId(null)}
            />
          )
        })()}

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
          // Phase 13 (#168): Proof-Only step picks PoEs (not Eval Results).
          // Pull PoEs the grantor owns wrapping evaluations of this Claim.
          // The picker row shows the wrapped count + SAT/UNSAT aggregate.
          const evalResultByIdForPoe = new Map((v22View?.evaluationResults || []).map((er) => [er.id, er]))
          const poesForClaim = (v22View?.proofsOfEvaluation || [])
            .filter(poe => poe.claimId === claim.id && poe.owner === da.grantor.party)
            .map((poe) => {
              let sat = 0, unsat = 0
              const er = evalResultByIdForPoe.get(poe.wrappedEvalResultId)
              if (er) {
                for (const r of (er.results || [])) {
                  if (r.status === 'satisfactory') sat += 1
                  else if (r.status === 'unsatisfactory') unsat += 1
                }
              }
              return {
                id: poe.id,
                name: poe.name,
                owner: poe.owner,
                wrappedCount: 1,
                sat,
                unsat,
              }
            })
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
              poesForClaim={poesForClaim}
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
              poesForClaim={[]}
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
          // Phase 12.3 (Bug B): intersect `da.scope.assetIds` against the
          // Claim's current active `referencedAssetIds[]`. The DA scope
          // isn't auto-amended when Alice removes an Asset from her Claim,
          // so without this filter Bob would see removed Assets as
          // available evidence. The active set is already derived correctly
          // by `makeAmendedClaim` (Phase 12.2's `nextActiveAssetIds`).
          const activeReferencedSet = new Set(claim.referencedAssetIds || [])
          const rawScopeIds = isSelf
            ? (claim.referencedAssetIds || [])
            : (da?.scope?.assetIds || claim.referencedAssetIds || [])
          const scopeAssetIds = rawScopeIds.filter((id) => activeReferencedSet.has(id))
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
          const allParseResultsForEval = [
            ...(sharedForEval.parseResults || []),
            ...(v22View?.parseResults || []),
          ]
          const seenAssetIds = new Set()
          // Phase 12.4 (#171): enrich each in-scope Asset row with disclosure
          // context (`disclosureType` + `disclosedFields`) so the modal's
          // left-panel viewer can branch between the AssetEvidenceViewer
          // (Full / owner) and the parsed-fields table (Selective). Mirrors
          // the per-Asset enrichment used for the V22ClaimPanel referenced-
          // Asset rows so the same shared `<AssetEvidencePanel>` component
          // can render either context.
          const evidenceAssets = scopeAssetIds
            .map((id) => {
              if (seenAssetIds.has(id)) return null
              seenAssetIds.add(id)
              const asset = allAssetSources.find((a) => a.id === id)
              if (!asset) return null
              const row = {
                id: asset.id,
                name: asset.name,
                file: asset.file,
                asset,
              }
              if (isSelf) {
                row.disclosureType = 'owner'
              } else if (da?.type === 'selective') {
                row.disclosureType = 'selective'
                const fieldIdSet = new Set(da?.scope?.fieldIds || [])
                const prsForAsset = allParseResultsForEval.filter((pr) => pr.sourceAssetId === asset.id)
                const disclosedFields = []
                for (const pr of prsForAsset) {
                  for (const f of (pr.fields || [])) {
                    if (fieldIdSet.has(`${pr.id}::${f.id}`)) {
                      disclosedFields.push({
                        id: f.id,
                        name: f.name,
                        label: f.name,
                        value: f.value,
                        confidence: f.confidence,
                        parseResultId: pr.id,
                        parseResultName: pr.templateName || pr.id,
                      })
                    }
                  }
                }
                row.disclosedFields = disclosedFields
                row.disclosedFieldCount = disclosedFields.length
              } else {
                // Defensive default: full disclosure (matches Phase 11D.2's
                // `coveringDa?.type || 'full'` fallback). Proof-only DAs
                // don't grant evaluation rights so this path shouldn't fire
                // under that disclosure type — the Run Evaluation modal
                // wouldn't have been opened in the first place.
                row.disclosureType = da?.type === 'proofonly' ? 'proofonly' : 'full'
              }
              return row
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
                lineageId: rs.lineageId,
                name: rs.name,
                version: rs.version ?? 1,
                requirements: rs.requirements || [],
                claims: rs.claims || [],
              }))}
              // Phase 12.3 (Bug A + Pivot 1): public RS pool surfaces in
              // the checkbox picker too. The modal dedupes against the
              // owner-authored pool above; same id wins on the
              // owner-authored side (provenance: 'own' badge).
              publicRequirementSets={visiblePublishedSets.map((rs) => ({
                id: rs.id,
                lineageId: rs.lineageId,
                name: rs.name,
                version: rs.version ?? 1,
                requirements: rs.requirements || [],
                claims: rs.claims || [],
                _publishedBy: rs._publishedBy,
                _publishedDate: rs._publishedDate,
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
              lockedRequirementsSetIds={v22EvalContext.lockedRequirementsSetIds || null}
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
              // Phase 12.2 (#117): pre-compute evidence diff against the
              // prior result for the modal's banner.
              evidenceDiff={(() => {
                const prior = v22EvalContext.priorActiveResultId
                  ? (v22View?.evaluationResults || []).find((er) => er.id === v22EvalContext.priorActiveResultId) || null
                  : null
                if (!prior) return null
                return computeEvidenceDiff(prior, claim)
              })()}
              // Phase 12.2 (#105): role context drives the empty-evidence
              // copy split.
              isOwnerView={claim?.owner === activeRole.party}
              // Phase 12.2 (#117): asset names for the diff banner.
              assetNameLookup={(() => {
                const lookup = {}
                for (const a of (v22View?.assets || [])) {
                  lookup[a.id] = { name: a.name, id: a.id }
                }
                return lookup
              })()}
              // Phase 13 (#168): existing PoEs the active actor owns on
              // this Claim. The modal's submit-time gate consults this
              // list to block submissions whose (Asset set, RS) combo
              // is already finalized as a Proof of Evaluation.
              existingPoEs={
                (v22View?.proofsOfEvaluation || [])
                  .filter((poe) => poe.claimId === claim.id && poe.owner === activeRole.party)
                  .map((poe) => ({
                    id: poe.id,
                    name: poe.name,
                    requirementsSetIds: [...(poe.requirementsSetIds || [])],
                    assetSnapshot: [...(poe.assetSnapshot || [])],
                  }))
              }
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
          // Phase 12.1 (#120): assemble the RS lookup table so the modal
          // can render existing references with names + versions, and pass
          // through the picker pools.
          const rsLookup = {}
          for (const rs of requirementSets) rsLookup[rs.id] = rs
          for (const rs of publishedRequirementSets) {
            if (!rsLookup[rs.id]) rsLookup[rs.id] = rs
          }
          // Phase 12.2 (#122): determine which Assets on this Claim are
          // referenced by at least one non-superseded Eval Result. The
          // Replace/Remove affordances apply to all already-referenced
          // rows uniformly, but the EVALUATED tag highlights the rows
          // where the affordance carries OUTDATED-state consequences.
          const evalResultsForClaim = (v22View?.evaluationResults || [])
            .filter((er) => er.claimId === claim.id && er.status !== 'superseded')
          const evaluatedSet = new Set()
          for (const er of evalResultsForClaim) {
            for (const aid of (er.evidenceUsed || [])) evaluatedSet.add(aid)
          }
          // Replacement candidate pool: all of owner's Assets that aren't
          // already on the Claim's active reference list.
          const ownActiveOnClaim = new Set(claim.referencedAssetIds || [])
          const replacementCandidates = (v22View?.assets || [])
            .filter((a) => ownedAssetIds.has(a.id) && !ownActiveOnClaim.has(a.id))
            .map((a) => ({ id: a.id, name: a.name, file: a.file }))
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
              ownRequirementSets={requirementSets}
              publicRequirementSets={visiblePublishedSets}
              rsLookup={rsLookup}
              evaluatedAssetIds={Array.from(evaluatedSet)}
              replacementCandidates={replacementCandidates}
            />
          )
        })()}

        {/* Phase 12.1 (#120): inline RS supersession-update modal.
            Triggered exclusively from the Claim Detail Panel's
            "Newer version available" pill (owner-only click). The
            from/to RS lookup uses the union pool; the modal renders
            from-name + version vs to-name + version and confirms an
            in-place reference update on the Claim. Cascade-skip:
            no Eval Result staleness, no notifications. */}
        {v22UpdatingRsReference && (() => {
          const { fromRsId, toRsId } = v22UpdatingRsReference
          const allRsForLookup = [...requirementSets, ...publishedRequirementSets]
          const rsById = new Map()
          for (const rs of allRsForLookup) {
            if (!rsById.has(rs.id)) rsById.set(rs.id, rs)
          }
          const fromRs = rsById.get(fromRsId)
            || { id: fromRsId, name: fromRsId, version: undefined }
          const toRs = rsById.get(toRsId)
            || { id: toRsId, name: toRsId, version: undefined }
          return (
            <UpdateRSReferenceModal
              fromRs={fromRs}
              toRs={toRs}
              onConfirm={handleV22UpdateRsReference}
              onClose={() => setV22UpdatingRsReference(null)}
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
          // Phase 13 (#168): proof-only Claim DAs now disclose PoEs (which
          // wrap Eval Results) instead of individual Eval Results. Picker
          // candidates are the active PoEs that wrap evaluations of this
          // Claim — owned by the DA grantor (the disclosing actor).
          const candidatePoEs = (v22View?.proofsOfEvaluation || [])
            .filter(poe => poe.claimId === da.subject.id && poe.owner === da.grantor.party)
            .map(poe => ({ id: poe.id, name: poe.name }))
          // §11.2: items already evaluated (referenced by an active eval result)
          // cannot be removed. Compute lock sets per scope dimension.
          const evaluatedAssets = new Set(
            (v22View?.evaluationResults || [])
              .filter(er => er.claimId === da.subject.id && er.status !== 'superseded')
              .flatMap(er => er.evidenceUsed || []),
          )
          const evaluatedFields = new Set() // V2.1 evals don't track field provenance; safe to leave empty for Phase 6
          // For PoE scope: any PoE currently in the DA's scope.poeIds is
          // locked once it's been finalized (PoE creation is terminal).
          const lockedPoEs = new Set(da.scope?.poeIds || [])
          return (
            <AmendDisclosureModal
              agreement={da}
              claim={claim}
              candidateAssets={candidateAssets}
              candidateFields={candidateFields}
              candidatePoEs={candidatePoEs}
              lockedAssetIds={Array.from(evaluatedAssets).filter(id => (da.scope?.assetIds || []).includes(id))}
              lockedFieldIds={Array.from(evaluatedFields)}
              lockedPoeIds={Array.from(lockedPoEs)}
              onSubmit={handleV22AmendDisclosureSubmit}
              onClose={() => setV22AmendingDaId(null)}
            />
          )
        })()}

        {/* Phase 13.1 (#168a): Create Proof of Evaluation modal. 1:1 wrap —
            wraps exactly the targeted Eval Result (which may itself bundle
            multiple Requirements Sets via Phase 13.1's flat results[]). No
            batch-sibling walk; the prior multi-Eval-Result-batch concept
            is retired. */}
        {v22CreatingPoEContext && (() => {
          const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const evalResult = (merged.evaluationResults || []).find((er) => er.id === v22CreatingPoEContext.evalResultId)
          if (!evalResult) return null
          const claim = (merged.claims || []).find((c) => c.id === evalResult.claimId)
          return (
            <CreatePoEModal
              evalResult={evalResult}
              claim={claim}
              onConfirm={handleV22CreatePoE}
              onClose={() => setV22CreatingPoEContext(null)}
            />
          )
        })()}

        {/* Phase 14.1 (#169 part 2): Issue Badge modal. Two-step picker +
            description. Self-issuance is gated upstream (entry-point hides
            the button) and additionally guarded inside the modal. */}
        {v22IssueBadgeContext && (() => {
          const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const targetClaim = (merged.claims || []).find((c) => c.id === v22IssueBadgeContext.targetClaimId)
          if (!targetClaim) return null
          // Phase 14.6 (#189): RS-coverage data for the picker's
          // disabled-row gate. Walk active PoEs on this Claim → wrapped
          // Eval Result → requirementsSets[].id; union into a Set. Build
          // a Map of every known RS id → display name for tooltip text
          // when the gate fails.
          const evalResultsById = new Map((merged.evaluationResults || []).map((er) => [er.id, er]))
          const targetClaimCoveredRsIds = new Set()
          for (const poe of (merged.proofsOfEvaluation || [])) {
            if (poe.status && poe.status !== 'active') continue
            if (poe.targetClaimId !== targetClaim.id && poe.claimId !== targetClaim.id) continue
            const wrapped = evalResultsById.get(poe.wrappedEvalResultId)
            if (!wrapped) continue
            const rsList = wrapped.requirementsSets
              || (wrapped.requirementsSet ? [wrapped.requirementsSet] : [])
            for (const rs of rsList) if (rs?.id) targetClaimCoveredRsIds.add(rs.id)
          }
          const requirementSetNameById = new Map()
          for (const rs of [...(requirementSets || []), ...(publishedRequirementSets || [])]) {
            if (rs?.id) requirementSetNameById.set(rs.id, rs.name || rs.id)
          }
          return (
            <IssueBadgeModal
              targetClaim={{
                id: targetClaim.id,
                name: targetClaim.name,
                ownerParty: targetClaim.owner || targetClaim.ownerParty,
              }}
              activeParty={activeRole.party}
              badgeTemplates={badgeTemplates}
              coveredRsIds={targetClaimCoveredRsIds}
              requirementSetNameById={requirementSetNameById}
              onIssue={handleV22IssueBadge}
              onClose={() => setV22IssueBadgeContext(null)}
            />
          )
        })()}

        {/* Phase 14.1 (#169 part 2), corrected 14.2: Revoke Badge modal. */}
        {v22RevokeBadgeContext && (() => {
          const issuance = badgeIssuances.find((b) => b.id === v22RevokeBadgeContext.badgeIssuanceId)
          if (!issuance) return null
          const template = badgeTemplates.find((t) => t.id === issuance.badgeTemplateId)
          const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const targetClaim = (merged.claims || []).find((c) => c.id === issuance.targetClaimId)
          const recipientParty = targetClaim?.owner || targetClaim?.ownerParty
          return (
            <RevokeBadgeModal
              issuance={issuance}
              badgeTemplate={template}
              recipientParty={recipientParty}
              onRevoke={handleV22RevokeBadge}
              onClose={() => setV22RevokeBadgeContext(null)}
            />
          )
        })()}

        {/* Phase 11E.1 (#108) → Phase 11.6 (#164) amendment-as-proposal:
            grantor-side modal that submits a proposal (not a unilateral
            mutation). On submit, EA flips to `pending-acceptance` and
            grantee gets a v22-ea-amendment-proposal notification. */}
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
              onSubmit={handleV22ProposeEvaluationAmendment}
              onClose={() => setV22AmendingEaId(null)}
            />
          )
        })()}

        {/* Phase 11.6 (#164): grantee-side AmendmentResponseModal. Opens
            when the grantee clicks a v22-ea-amendment-proposal
            notification. Diff-displays acknowledgment changes + expiration
            change. Accept gates on every change being explicitly ticked;
            reject is always available. Both fire response notifications
            back to the grantor and flip the EA back to `active`. */}
        {v22RespondingToEaAmendment && (() => {
          const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
          const ea = merged.evaluationAgreements.find((e) => e.id === v22RespondingToEaAmendment.eaId)
          if (!ea) return null
          const claim = merged.claims.find((c) => c.id === ea.claimId)
          if (!claim) return null
          const amendment = (ea.amendments || []).find((a) => a.id === v22RespondingToEaAmendment.amendmentId)
          if (!amendment) return null
          return (
            <AmendmentResponseModal
              agreement={ea}
              claim={claim}
              amendment={amendment}
              onAccept={({ responseMessage }) => handleV22AmendmentAccept({
                eaId: ea.id,
                amendmentId: amendment.id,
                responseMessage,
              })}
              onReject={({ responseMessage }) => handleV22AmendmentReject({
                eaId: ea.id,
                amendmentId: amendment.id,
                responseMessage,
              })}
              onClose={() => setV22RespondingToEaAmendment(null)}
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
                // Phase 12.4 (#171): file + registrationDate feed the
                // left-panel AssetEvidenceViewer (parse is owner-only,
                // so disclosure-type is implicitly 'owner').
                file: v22ParsingAsset.v22Artifact?.file || v22ParsingAsset.file,
                registrationDate: v22ParsingAsset.v22Artifact?.registrationDate || v22ParsingAsset.registrationDate,
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
            onAddCreditsClick={() => setV22AddCreditsOpen(true)}
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
              onAddCreditsClick={() => setV22AddCreditsOpen(true)}
              // Phase 12.1 (#120): RS picker pools.
              ownRequirementSets={requirementSets}
              publicRequirementSets={visiblePublishedSets}
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

        {/* Phase 11.8 #54: reset-all confirmation modal. Wipes every role's
            canvas state, notifications, and provisional artifacts back to
            seeded shape; resets credits to the active role's default. The
            theme + boot-skip flags are preserved (those are user
            preferences, not demo state). */}
        {v22ResetConfirmOpen && (
          <Backdrop onClose={() => setV22ResetConfirmOpen(false)}>
            <Modal width={460}>
              <ModalHeader
                title="Reset all data?"
                subtitle="This will return the demo to its seeded state."
                onClose={() => setV22ResetConfirmOpen(false)}
              />
              <ModalBody>
                <div style={{
                  padding: '14px 16px', borderRadius: 8,
                  background: 'color-mix(in srgb, var(--accent-red) 4%, transparent)',
                  border: '1px solid color-mix(in srgb, var(--accent-red) 18%, transparent)',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: 'color-mix(in srgb, var(--accent-red) 10%, transparent)',
                    border: '1px solid color-mix(in srgb, var(--accent-red) 30%, transparent)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent-red)', fontSize: 11, fontWeight: 700,
                  }}>!</div>
                  <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
                    Every role's canvas state, notifications, and provisional
                    artifacts (requests, accepted agreements, evaluations,
                    transfers, revocations) will be cleared. Credits reset to
                    the active role's seeded balance. Theme preference and
                    the skip-boot flag are preserved. This action cannot be
                    undone.
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Btn label="Cancel" onClick={() => setV22ResetConfirmOpen(false)} />
                <Btn
                  label="Reset all data"
                  danger
                  onClick={() => {
                    setV22Provisionals({
                      disclosureAgreements: [],
                      evaluationAgreements: [],
                      evaluationResults: [],
                      declineRecords: [],
                      transfers: [],
                      revocationRecords: [],
                    })
                    setPerRoleState(() => {
                      const init = {}
                      ROLES.forEach((r) => {
                        init[r.id] = {
                          addedNodes: [], addedSDAs: {}, addedEdges: [],
                          dismissedReqs: [], addedChildren: {}, addedRequests: [],
                          removedSDAs: [], removedNodes: [], removedEdges: [],
                          newlyDisclosedIds: [], requirementSets: null, pepTemplates: null,
                        }
                      })
                      return init
                    })
                    setCredits(activeRole.credits)
                    setSel(null)
                    setSelectedEdgeId(null)
                    setOpenAgreement(null)
                    setForcePanelTab(null)
                    setForceExpandSda(null)
                    setV22DirectoryOpen(false)
                    setV22DirectorySelectedClaim(null)
                    setV22DirectorySelectedRfp(null)
                    setV22DirectoryWipeOrigin(null)
                    // Phase 17.1 + 17.2: clear session-state RFP closures
                    // and outgoing solicitations so the demo returns to the
                    // seeded RFP set (no closed RFPs, no solicitations).
                    setV22ClosedRfpIds(new Map())
                    setV22Solicitations(new Map())
                    setV22SolicitOpenForRfp(null)
                    setV22SolicitationToReject(null)
                    setV22ResetConfirmOpen(false)
                  }}
                />
              </ModalFooter>
            </Modal>
          </Backdrop>
        )}

        {/* Phase 11.8 #98: Add credits demo sub-modal. Opens from the
            CreditCostRow "Add credits →" link inside V22CreateAssetModal /
            V22CreateClaimModal. Renders as a sibling Backdrop after the
            parent modal so DOM paint order keeps it visually on top
            (Backdrop's z-index is fixed at 10000). Both buttons close only
            the sub-modal — the parent Create modal stays open so the user
            sees the updated balance reflected in the CREDIT COST row. */}
        {v22AddCreditsOpen && (
          <Backdrop onClose={() => setV22AddCreditsOpen(false)}>
            <Modal width={400}>
              <ModalHeader
                title="Add credits"
                subtitle="Top up your demo balance."
                onClose={() => setV22AddCreditsOpen(false)}
              />
              <ModalBody>
                <div style={{ fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-secondary)', marginBottom: 14 }}>
                  Current balance: <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{credits} credit{credits === 1 ? '' : 's'}</span>
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                  This is a demo top-up — no real billing. Choose how to
                  refill the active role's balance, then continue with your
                  pending registration.
                </div>
              </ModalBody>
              <ModalFooter>
                <Btn
                  label="Reset to role default"
                  onClick={() => {
                    setCredits(activeRole.credits)
                    setV22AddCreditsOpen(false)
                  }}
                />
                <Btn
                  label="+100 credits"
                  accent
                  onClick={() => {
                    setCredits((c) => c + 100)
                    setV22AddCreditsOpen(false)
                  }}
                />
              </ModalFooter>
            </Modal>
          </Backdrop>
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
            wrappedEvalResult={v22ExpandedArtifact.wrappedEvalResult}
            provenanceChain={v22ExpandedArtifact.provenanceChain}
            onSelectEvalResult={v22ExpandedArtifact.onSelectEvalResult}
            referencedRequirementSets={v22ExpandedArtifact.referencedRequirementSets}
            badgeIssuanceContext={v22ExpandedArtifact.badgeIssuanceContext}
            evidenceAssets={v22ExpandedArtifact.evidenceAssets}
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
          // Phase 12.1 (#120): Resolve `referencedRequirementsSets` rows for
          // V22ClaimPanel. The pool is the union of (active role's authored
          // RS) + (publishedRequirementSets — public pool, including own
          // and other-party entries). Provenance: 'own' if the active role
          // authored the RS, else 'public' if it lives in the public pool,
          // else null (e.g. a privately-shared RS — out of scope this phase
          // so we render no badge rather than guessing). The latestVersionId
          // is computed against the same pool so the supersession pill
          // surfaces drift cross-role consistently.
          let referencedStandardRows = []
          if (node.v22Type === 'CLAIM' && node.v22Artifact?.referencedRequirementsSets?.length) {
            const allRsForLookup = [...requirementSets, ...publishedRequirementSets]
            // Dedupe by id (own + public pools may overlap when the active
            // role's RS is also published).
            const rsById = new Map()
            for (const rs of allRsForLookup) {
              if (!rsById.has(rs.id)) rsById.set(rs.id, rs)
            }
            const rsArr = Array.from(rsById.values())
            const ownRsIds = new Set(requirementSets.map((r) => r.id))
            const publicRsIds = new Set(publishedRequirementSets.map((r) => r.id))
            referencedStandardRows = node.v22Artifact.referencedRequirementsSets.map((entry) => {
              const rs = rsById.get(entry.requirementsSetId)
              const provenance = ownRsIds.has(entry.requirementsSetId)
                ? 'own'
                : publicRsIds.has(entry.requirementsSetId) ? 'public' : null
              const latestVersionId = getLatestRSVersion(entry.requirementsSetId, rsArr)
              return {
                requirementsSetId: entry.requirementsSetId,
                addedDate: entry.addedDate,
                name: rs?.name || entry.requirementsSetId,
                version: rs?.version,
                lineageId: rs?.lineageId,
                provenance,
                latestVersionId,
              }
            })
          }
          const evaluationResultsForClaim = (v22View?.evaluationResults || []).filter(e => e.claimId === node.id)
          const parseResultsForAsset = (v22View?.parseResults || []).filter(p => p.sourceAssetId === node.id)
          // EA the active actor can use to evaluate this Claim.
          // Phase 11.6.1 Fix 3: include `pending-acceptance` alongside
          // `active` so the Detail Panel renders Run Evaluation (visually
          // disabled with a tooltip) instead of falling through to
          // "Request Evaluation Agreement" — the EA exists, the grantee
          // just hasn't responded to a pending amendment yet.
          const isActionableEaStatus = (s) => s === 'active' || s === 'pending-acceptance'
          const evaluationAgreementForActor = (v22View?.evaluationAgreements || []).find(e =>
            e.claimId === node.id &&
            e.grantee.party === activeRole.party &&
            isActionableEaStatus(e.status) &&
            !e._provisional &&
            (v22Provisionals.disclosureAgreements.find(d => d.id === e.disclosureAgreementId)?.type !== 'provisional')
          ) || (v22View?.evaluationAgreements || []).find(e =>
            e.claimId === node.id && e.grantee.party === activeRole.party && isActionableEaStatus(e.status) && !e._provisional
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
                // Phase 12.1 (#120): Referenced Standards section data + handlers.
                referencedStandardRows={referencedStandardRows}
                onSelectRsReference={(row) => {
                  // Open the Library deep-linked to the originally-referenced
                  // version (NOT the latest — per brief acceptance criterion
                  // 7). Provenance picks the tab: 'own' → Requirement Sets
                  // (authored), 'public' → Published. Default 'requirements'
                  // covers the unknown-provenance fallback (e.g. legacy
                  // references whose RS pool hasn't been resolved).
                  setLibraryInitialTab(row.provenance === 'public' ? 'published' : 'requirements')
                  setLibraryInitialSetId(row.requirementsSetId)
                  setShowLibrary(true)
                }}
                onUpdateRsReference={(row) => {
                  // Owner-only — V22ClaimPanel gates the click. Open the
                  // confirmation sub-modal with from/to context.
                  setV22UpdatingRsReference({
                    claimId: node.id,
                    fromRsId: row.requirementsSetId,
                    toRsId: row.latestVersionId,
                  })
                }}
                onSelectEvalResult={(arg) => {
                  // Phase 11D.3 + Phase 13.2 (#177): used by both
                  // V22ClaimPanel (which calls with the full Eval Result
                  // object) and V22PoEPanel's Evaluation Provenance rows
                  // (which call with the string id). Accept both shapes.
                  const erId = typeof arg === 'string' ? arg : arg?.id
                  if (!erId) return
                  setSel(erId)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(erId)
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
                // Phase 13.4 (#175): top-level Expand affordance for Claim,
                // Eval Result, PoE, and Parse Result Detail Panels. The
                // panel sub-components call this with their own artifact;
                // here we branch by node.v22Type to choose the modal schema
                // and resolve any per-type extras (wrapped Eval Result +
                // provenance chain for PoE).
                onExpand={(artifact) => {
                  const t = node.v22Type
                  // Phase 15.0 (#172 part 1): resolve evidence Assets from
                  // the eval result's `evidenceUsed[]` so the expand modal
                  // can render PDF.js + annotations on the Output tab.
                  // Single-Asset display in 15.0 — Phase 15.1 will add the
                  // multi-Asset switcher when an Eval Result references
                  // multiple Assets.
                  const resolveEvidenceAssets = (er) => (er?.evidenceUsed || []).map((id) =>
                    (sharedForPanel.assets || []).find((a) => a.id === id),
                  ).filter(Boolean)
                  if (t === 'CLAIM') {
                    setV22ExpandedArtifact({ artifact, schema: 'claim' })
                  } else if (t === 'EVAL RESULT') {
                    setV22ExpandedArtifact({
                      artifact, schema: 'eval-output',
                      evidenceAssets: resolveEvidenceAssets(artifact),
                    })
                  } else if (t === 'PROOF OF EVALUATION') {
                    const wrappedId = artifact?.wrappedEvalResultId
                    const erList = sharedForPanel.evaluationResults || []
                    const wrappedEvalResult = wrappedId ? erList.find((e) => e.id === wrappedId) : null
                    // Reuse the same provenance walk the PoE panel uses.
                    const provenanceChain = (() => {
                      if (!wrappedId) return []
                      const erById = new Map(erList.map((er) => [er.id, er]))
                      const reverseChain = []
                      let cursorId = wrappedId
                      const seen = new Set()
                      while (cursorId && !seen.has(cursorId)) {
                        seen.add(cursorId)
                        const er = erById.get(cursorId)
                        if (!er) break
                        const rsList = er.requirementsSets || (er.requirementsSet ? [er.requirementsSet] : [])
                        const name = rsList.length === 1
                          ? rsList[0].name
                          : rsList.length > 1 ? `${rsList[0].name} (+${rsList.length - 1} more)`
                            : er.id
                        reverseChain.push({
                          id: er.id,
                          name,
                          status: er.status,
                          evaluationDate: er.evaluationDate,
                        })
                        cursorId = er.priorEvalResultId
                      }
                      return reverseChain.reverse()
                    })()
                    setV22ExpandedArtifact({
                      artifact, schema: 'poe',
                      wrappedEvalResult,
                      provenanceChain,
                      // Phase 15.0: PoE Output tab Section 1 (the wrapped
                      // Eval Result content) needs access to evidence
                      // Assets to render PDF.js + annotations.
                      evidenceAssets: resolveEvidenceAssets(wrappedEvalResult),
                      onSelectEvalResult: (erId) => {
                        setSel(erId)
                        setForcePanelTab(null)
                        setForceExpandSda(null)
                        setV22PanToClaimId(erId)
                      },
                    })
                  } else if (t === 'PARSE RESULT') {
                    setV22ExpandedArtifact({ artifact, schema: 'parse-output' })
                  } else if (t === 'ASSET') {
                    setV22ExpandedArtifact({ artifact, schema: 'asset' })
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
                  // Phase 13.2: re-run carries forward EVERY RS in the prior
                  // Eval Result's bundle, not just the first. The picker
                  // pre-checks and locks all of them; user can add additional
                  // RSes to broaden scope but can't unlock the carried set.
                  const lockedRsIds = (er.requirementsSets || []).map((rs) => rs.id)
                  setV22EvalContext({
                    evaluationAgreementId: ea ? ea.id : null,
                    claimId: er.claimId,
                    selfEvaluation: !ea,
                    lockedRequirementsSetIds: lockedRsIds.length > 0 ? lockedRsIds : null,
                    lockedRequirementsSetId: lockedRsIds.length === 1 ? lockedRsIds[0] : null,
                    priorActiveResultId: er.id,
                  })
                }}
                // Phase 13 (#168): Create-PoE entry from the Eval Result
                // panel footer. Hidden when the Eval Result is already
                // wrapped (`node._alreadyWrapped` flag stamped above).
                onCreatePoE={node.v22Type === 'EVAL RESULT' && node.owner === activeRole.party && !node._alreadyWrapped
                  ? (er) => setV22CreatingPoEContext({ evalResultId: er?.id || node.id })
                  : undefined}
                // Phase 13 (#168): PoE panel resolution callbacks. Resolve
                // wrapped Eval Result names + source Claim name from the
                // merged shared dataset; click handlers route to setSel for
                // navigation. Phase 13.4 (#175) dedup: `resolveClaimName`
                // and `onSelectEvalResult` are wired earlier in this same
                // mount and shared across V22ClaimPanel + V22PoEPanel —
                // duplicates here would shadow the earlier handlers.
                resolveEvalResultName={(erId) => {
                  const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                  const er = merged.evaluationResults.find((e) => e.id === erId)
                  if (!er) return erId
                  const rsList = er.requirementsSets || []
                  if (rsList.length === 1) return rsList[0].name
                  if (rsList.length > 1) return `${rsList[0].name} (+${rsList.length - 1} more)`
                  return er.requirementsSet?.name || erId
                }}
                resolveDaSummary={(da) => `${da.granteeParty || da.grantee?.party || '?'} · ${da.type || '?'}`}
                onSelectClaim={(claimId) => { setSel(claimId); setV22PanToClaimId(claimId) }}
                onSelectDa={(daId) => { setOpenAgreement({ kind: 'disclosure', disclosureAgreementId: daId }) }}
                disclosingAgreements={node.v22Type === 'PROOF OF EVALUATION'
                  ? (v22View?.disclosureAgreements || []).filter(
                      (da) => Array.isArray(da.scope?.poeIds) && da.scope.poeIds.includes(node.id)
                        && !da._declineMeta && !da._revokedMeta && da.type !== 'provisional',
                    ).map((da) => ({
                      id: da.id,
                      granteeParty: da.grantee?.party,
                      type: da.type,
                      status: da.status,
                    }))
                  : []
                }
                // Phase 13.2 (#177): "Evaluation Provenance" chain for the
                // PoE panel. Walk priorEvalResultId from the wrapped Eval
                // Result back to the chain origin; emit oldest-first.
                provenanceChain={(() => {
                  if (node.v22Type !== 'PROOF OF EVALUATION') return []
                  const poe = node.v22Artifact
                  const wrappedId = poe?.wrappedEvalResultId
                  if (!wrappedId) return []
                  const erList = sharedForPanel.evaluationResults || []
                  const erById = new Map(erList.map((er) => [er.id, er]))
                  const reverseChain = []
                  let cursorId = wrappedId
                  const seen = new Set()
                  while (cursorId && !seen.has(cursorId)) {
                    seen.add(cursorId)
                    const er = erById.get(cursorId)
                    if (!er) break
                    const rsList = er.requirementsSets || (er.requirementsSet ? [er.requirementsSet] : [])
                    const name = rsList.length === 1
                      ? rsList[0].name
                      : rsList.length > 1 ? `${rsList[0].name} (+${rsList.length - 1} more)`
                        : er.id
                    reverseChain.push({
                      id: er.id,
                      name,
                      status: er.status,
                      evaluationDate: er.evaluationDate,
                    })
                    cursorId = er.priorEvalResultId
                  }
                  // Reverse so the oldest-first ordering reads as a timeline.
                  return reverseChain.reverse()
                })()}
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
                // Phase 13.1 (#168a): Re-Run gating moves from submit-time to
                // entry-point. The Detail Panel footer shows Re-Run disabled
                // with a tooltip when the Eval Result is in a PoE-terminated
                // chain. Action-bar Re-Run is hidden via _alreadyWrapped.
                isPoeTerminated={node.v22Type === 'EVAL RESULT' && !!node._alreadyWrapped}
                canRerun={node.v22Type !== 'EVAL RESULT' || node._canRerun !== false}
                // Phase 11D.3: linked Claim name for Eval Result panels.
                // Resolves the ER's claimId against the merged dataset so
                // proof-only grantees can see what the ER evaluates.
                linkedClaimName={node.v22Type === 'EVAL RESULT' && node.v22Artifact?.claimId
                  ? (sharedForPanel.claims.find((c) => c.id === node.v22Artifact.claimId)?.name || null)
                  : null}
                // Phase 13.1 (#168a): the Phase 12.2 batch concept is
                // retired — siblingEvalResults now carries only the
                // supersession successor (when this Eval Result is
                // superseded). The V22EvalResultPanel uses this lookup to
                // render the Supersession row clickable.
                siblingEvalResults={(() => {
                  if (node.v22Type !== 'EVAL RESULT') return []
                  const er = node.v22Artifact
                  const all = (sharedForPanel.evaluationResults || [])
                  const out = []
                  if (er?.supersededBy) {
                    const successor = all.find((s) => s.id === er.supersededBy)
                    if (successor) {
                      const rsList = successor.requirementsSets || []
                      const name = rsList.length === 1
                        ? rsList[0].name
                        : rsList.length > 1 ? `${rsList[0].name} (+${rsList.length - 1} more)`
                          : successor.requirementsSet?.name || successor.id
                      out.push({ id: successor.id, name, status: successor.status })
                    }
                  }
                  return out
                })()}
                onSelectSiblingEvalResult={(s) => {
                  setSel(s.id)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(s.id)
                }}
                // Phase 12.2 (#117): asset-name lookup for the diff section.
                assetNameLookup={(() => {
                  if (node.v22Type !== 'EVAL RESULT' || !node.v22Artifact?.evidenceDiff) return {}
                  const lookup = {}
                  for (const a of (sharedForPanel.assets || [])) {
                    lookup[a.id] = { name: a.name, id: a.id }
                  }
                  return lookup
                })()}
                onSelectDiffAsset={(assetId) => {
                  setSel(assetId)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(assetId)
                }}
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
                // Phase 14.1 (#169 part 2), corrected Phase 14.2 (#169a):
                // Badge surfaces — Claim is the canonical target. PoE-side
                // badges derive via aggregation; Claim-side badges are
                // direct lookups; Actor-side walks via Claim ownership.
                badgesForPoE={(() => {
                  if (node.v22Type !== 'PROOF OF EVALUATION') return []
                  const allErs = v22View?.evaluationResults || []
                  const allPoEs = v22View?.proofsOfEvaluation || []
                  return getBadgesForPoE(node.id, allErs, allPoEs, badgeIssuances)
                })()}
                badgesForClaim={(() => {
                  if (node.v22Type !== 'CLAIM') return []
                  return getBadgesForClaim(node.id, badgeIssuances)
                })()}
                badgesForActor={(() => {
                  if (node.v22Type !== 'ACTOR') return []
                  // Use the merged shared dataset so the actor sees badges
                  // received against all of their Claims, not just the
                  // ones currently on this canvas.
                  const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                  return getBadgesForRecipient(node.name, badgeIssuances, merged.claims || [])
                })()}
                // Phase 14.2 (#169a): subtext on the PoE Badges section
                // reads "Badges earned by [Claim name]". Caller resolves
                // the parent Claim's name + id for the click handler.
                poeBadgesParentClaim={(() => {
                  if (node.v22Type !== 'PROOF OF EVALUATION') return null
                  const poe = node.v22Artifact
                  if (!poe?.claimId) return null
                  const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                  const claim = (merged.claims || []).find((c) => c.id === poe.claimId)
                  if (!claim) return null
                  return { id: claim.id, name: claim.name, ownerParty: claim.owner || claim.ownerParty }
                })()}
                onSelectClaimFromBadgeSubtext={(claimId) => {
                  setSel(claimId)
                  setForcePanelTab(null)
                  setForceExpandSda(null)
                  setV22PanToClaimId(claimId)
                }}
                badgeTemplateLookup={(() => {
                  const lookup = {}
                  for (const t of badgeTemplates) lookup[t.id] = t
                  return lookup
                })()}
                // Phase 14.2: Issue Badge gate is `activeParty !== claim.ownerParty`.
                // PoE entry: derive Claim from PoE.claimId. Claim entry: own claim id.
                onIssueBadge={(() => {
                  if (node.v22Type === 'PROOF OF EVALUATION') {
                    const poe = node.v22Artifact
                    if (!poe?.claimId) return undefined
                    const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                    const claim = (merged.claims || []).find((c) => c.id === poe.claimId)
                    if (!claim) return undefined
                    if (claim.owner === activeRole.party) return undefined  // self-issuance gate
                    return () => setV22IssueBadgeContext({ targetClaimId: claim.id })
                  }
                  if (node.v22Type === 'CLAIM') {
                    if (node.owner === activeRole.party) return undefined  // self-issuance gate
                    return () => setV22IssueBadgeContext({ targetClaimId: node.id })
                  }
                  return undefined
                })()}
                // Phase 14.2 (#169b): Badge Issuance row click opens the
                // expand modal directly (no longer a standalone Detail
                // Panel — modals over Detail Panels is the right pattern,
                // Detail Panels over Detail Panels is not).
                onSelectBadgeIssuance={(badgeIssuanceId) => {
                  const issuance = badgeIssuances.find((b) => b.id === badgeIssuanceId)
                  if (!issuance) return
                  const template = badgeTemplates.find((t) => t.id === issuance.badgeTemplateId) || null
                  const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
                  const targetClaim = (merged.claims || []).find((c) => c.id === issuance.targetClaimId) || null
                  setV22ExpandedArtifact({
                    artifact: issuance,
                    schema: 'badge-issuance',
                    badgeIssuanceContext: {
                      template,
                      recipientParty: targetClaim?.owner || targetClaim?.ownerParty || null,
                      targetClaimName: targetClaim?.name || issuance.targetClaimId,
                      allClaims: merged.claims || [],
                      allBadgeTemplates: badgeTemplates,
                    },
                  })
                }}
                onRevokeBadge={(badgeIssuanceId) => setV22RevokeBadgeContext({ badgeIssuanceId })}
              />
            </div>
          )
        })()}

      </div>

      {/* Footer */}
      {/* Phase 16.0.3 Item 4: footer raised to zIndex 300 (parent-layer
          chrome z-level) so it stays visible when the Directory Layer
          (zIndex 150) is open. `position: relative` is required for
          zIndex to take effect on this flex child. */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '6px 16px',
        borderTop: '1px solid var(--border)',
        flexShrink: 0,
        background: 'var(--bg-deep)',
        position: 'relative',
        zIndex: 300,
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
          v0.17.3.1 &middot; Changelog
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
                { version: '0.17.3.1', date: '2026-05-19', label: 'Phase 17.3.1', items: [
                  'Phase 17.3.1 — Polish wrap before Phase 17.4 (umbrella DA edges). Four items batched: RFP card action bar with Solicit CTA; RfpDetailPanel categorical-pill cleanup + Requirements section overhaul; new RequirementsSetDetailModal; fan-out loading animation tweaks.',
                  'AssetNode RFP full-size card gains an action bar parallel to the Claim card pattern shipped in 17.3. When the synthetic node carries `_directorySolicitCandidate` (DirectoryLayer resolves: non-owner of an open RFP with no existing solicitation from active actor), the bar surfaces a "Solicit with my Claim" button with a new paper-airplane SVG icon. Click dispatches the `solicitWithClaim` action through `onV22CardAction`; V2App routes to the same SolicitationCreateModal mount the panel footer opens — both surfaces fire the same handler. Owner / existing-solicitation / closed-RFP cases suppress the button.',
                  'RfpDetailPanel categorical pill cleanup (extends #202 from 17.3, which scoped V22NodeDetailPanel only). "POSTED BY" row no longer renders the "ACTOR" pill next to the party name; "FOR ASSET" row no longer renders the "ASSET" pill next to the Asset name. Relational headers ("POSTED BY", "FOR ASSET") and the "YOU" indicator are preserved — those convey relationship, not category. #202 is now fully closed across both V22NodeDetailPanel and RfpDetailPanel.',
                  'Requirements section overhaul. Section title renamed "Required Standards" → "Requirements" per Andrew\'s broader-term preference. Layout converted from horizontal chips to vertical full-width clickable rows: each row renders the RS name at full width, version number as a small badge pill on the right, hover-state subtle indigo tint, click opens RequirementsSetDetailModal. Missing-RS rows render muted "Standard not found ({rsId})" + dashed-border treatment and are non-clickable.',
                  'New RequirementsSetDetailModal component (`src/components/modals/RequirementsSetDetailModal.jsx`). Read-only single-RS view: header with RS name (large) + version badge pill, sub-header "Published by {owner}" + canonical GlobeIcon, scrollable body listing each requirement (id mono pill + label + description + optional muted italic Criterion). Mirrors the requirement-row treatment SolicitationCreateModal\'s RsAccordionEntry uses (inline-rendered rather than refactor-extracted to avoid extracting a shared component coupled to the accordion\'s open/close state). Close button only — purely informational; ESC + backdrop click close via the shared Backdrop primitive.',
                  'Fan-out loading animation tweaks. `directoryLoadAnimation.js` bumps `waveSpeed` 4500 → 7000 wu/sec (base radial spread time drops ~37%) and `dotFadeMs` 200 → 90 ms (snappier per-dot ramp). New `jitterMs` (default 250 ms) seeded random per-instance start offset produces a jagged organic wavefront — adds an `xmur3 + mulberry32` PRNG seeded by a stable per-entry seed (passed as `jitterSeed: \'{roleId}:{i|r}\'`) so mid-flight re-renders see consistent jitter while each entry rolls fresh. Eased via `easeOut(t) = 1 - (1-t)^3` instead of linear ramp. RFP markers participate via new `rfps` + `setRfpAppear` API on the helper.',
                  'DirectoryLayer per-instance scale-driven appearance (replaces 16.2.3 color-multiplier-from-black). `dotOpacitiesRef` is reinterpreted: value is now a per-instance MATRIX SCALE factor (0 = invisible, 1 = final size), not a color multiplier. Dots render at their final disclosure-type color from the moment they appear; the wave grows each dot from a point to its full size, eliminating the prior visible black-to-color transition. New `flushDotMatrices` + `flushRfpMatrices` callbacks integrated into the existing animate-loop dirty-flag pattern. `flushDotColors` simplified — no longer touches opacity (color stays at full saturation always; only hover/select white-brighten remains). RFP hit-test mesh keeps full scale throughout (clickable mid-wave). Footer rolls forward to v0.17.3.1.',
                ]},
                { version: '0.17.3', date: '2026-05-19', label: 'Phase 17.3', items: [
                  'Phase 17.3 — Claim Detail Panel EA content on Directory + card action bar + #202 ACTOR/ASSET label cleanup. Opens the action surface for Directory-layer Claim discovery. Without this content, clicking a Claim on Directory opened a panel that didn\'t tell the viewer what they could do with it.',
                  'V22NodeDetailPanel Claim view: new EA-status section near the top of the body — "An Evaluation Agreement is required to evaluate this Claim." (no-EA state, amber callout) or "An Evaluation Agreement is in place with {owner}." (EA-exists state, indigo callout). Footer extensions match: "Request Evaluation Agreement" (cold-path, opens AssetPickerModal) or "View Evaluation Agreement" (navigates parent canvas to the EA artifact + opens the EA Detail Panel). Owner viewing own Claim gets no EA-status section and no footer EA actions. The pre-existing Phase 11C warm-path (DA exists, no EA) is preserved unchanged.',
                  'AssetNode V22ActionBar Claim branch: parallel CTAs on the Directory full-size Claim card. When the synthetic node carries `_directoryRequestEaCandidate`, the action bar surfaces a Request EA button (▷). When it carries `_directoryExistingEa`, the bar surfaces View EA (◉). Both fire the same V2App handlers as the panel footer. Parent-canvas Claim cards unchanged (those stamp markers come from DirectoryLayer\'s card-overlay render path only).',
                  'AssetPickerModal re-mounted in V2App for the Directory Claim cold-path. Generalized prop contract: accepts a generic `targetClaim` + optional `context` ({ type: \'directory-claim\' } | { type: \'rfp\', rfp }) — context drives the modal\'s subtitle / context block. Legacy solicitation/solicitorClaim/rfp props preserved as fallback. Continue resolves the picked Asset + target Claim and opens CombinedRequestModal pre-filled (requesterAsset + initialPin, no initialRequirementsSetIds — no RFP in this flow). The existing cold-path provisional EA+DA pipeline takes over from there.',
                  'New shared predicate `getActiveEaForClaimAndRequester(claim, requesterParty, evaluationAgreements)` exported from v2_2Data.js. Returns the resolved EA artifact (or null) for a given Claim/requester pair, filtering out declined/revoked EAs. Drives both the panel footer logic and the DirectoryLayer per-claim synthetic-node stamping (which V22ActionBar reads).',
                  'V2App handlers: `handleRequestEaForClaim(claim)` opens AssetPickerModal; `handleAssetPickedForClaim({ assetId, claimId })` closes the picker and opens CombinedRequestModal; `handleViewEa(ea)` closes Directory + pans parent canvas to the Claim node + selects the EA edge + opens the EA Detail Panel (mirrors Phase 11C / 17.2.1.1\'s EA-amendment notification pattern). DirectoryLayer mount block gets new `evaluationAgreements` + `onClaimCardAction` props to thread the action surface end-to-end.',
                  '#202 closed: ACTOR + ASSET typeLabel pills removed from V22ActorPanel + V22AssetPanel headers. The PanelHeader\'s `typeLabel` prop is now optional; when omitted (Actor + Asset cases), the header renders the name + PIN without a categorical pill. CLAIM / EVAL RESULT / PARSE RESULT / PROOF OF EVALUATION / BADGE TEMPLATE panels keep their type label since those are abstract artifact types. RfpDetailPanel\'s relational "Posted by" + "For Asset" rows unchanged (those convey relationship, not category).',
                  'Out of scope (deferred): parent-layer EA-required-message-when-not-needed bug — still 17.4+ pending umbrella DA work. RFP creation flow (17.5+). Solicitation withdraw/amend (17.6+). Footer rolls forward to v0.17.3.',
                ]},
                { version: '0.17.2.1.2', date: '2026-05-19', label: 'Phase 17.2.1.2', items: [
                  'CombinedRequestModal RS pre-selection: all RFP-referenced Requirements Sets now pre-checked when CombinedRequestModal opens via the Accept flow. Previously only the first id from `rfp.requirementsSetIds` was pre-checked because `handleRequestAgreement` stored only the singular `suggestedRequirementsSetId`. Fix threads the full array as `suggestedRequirementsSetIds` (plural); cold-path AI Shopper entry (singular id) still works. CombinedRequestModal\'s state initializer was already correct — the bug was entirely upstream at the V2App handler + mount.',
                  'Footer rolls to v0.17.2.1.2.',
                ]},
                { version: '0.17.2.1.1', date: '2026-05-19', label: 'Phase 17.2.1.1', items: [
                  'Phase 17.2.1.1 — Hotfix: RFP-bound Asset + Claim greying + EA+DA notification Directory close + CombinedRequestModal RS scrollbox. Four QA-driven items closing out the 17.2 arc before 17.3+ opens.',
                  'RFP factory `makeRfp` extends required field set with `assetId` (validated, throws on missing). All 118 seeded RFPs populated: Bob\'s Sentinel-4 RFP binds to his `bAvionics` Asset ("Avionics Module"); each of the 20 RFP-only mock-cluster owners gets one stub Asset (`asset-{actor.id}-rfp-anchor`, owner = actor.party) so the seed-data integrity check passes; the 4 mixed-cluster owners reuse their first existing Asset. `generateRfpsForActor(actor, count, defaultAssetId)` factory entry-point now requires `defaultAssetId` (throws if absent — surfaces missing-Asset seed inconsistencies at build time, not at render time). Architecture spec §8.7 + §8.9.6 updated.',
                  'RfpDetailPanel: new "For Asset" row rendered between the Posted-by row and the Description block. Renders the Asset name + inline ASSET pillbox; (Asset not found) muted fallback when `rfp.assetId` doesn\'t resolve in the passed `assetsById` Map. V2App threads a derived `assetsById` Map down to the mount.',
                  'Accept flow simplified: AssetPickerModal removed from the Accept path. `handleRequestAgreement` now goes directly from the SolicitationCard click → CombinedRequestModal pre-filled with the RFP\'s bound Asset (via `requesterAsset`) + the solicitor\'s Claim PIN (via `initialPin`) + the RFP\'s `requirementsSetIds` (via `initialRequirementsSetIds`). No intermediate Asset-pick step. The `AssetPickerModal` component file stays in the codebase for future create-RFP work; only the V2App mount + handlers were removed from the Accept flow path. `v22AcceptingSolicitation` retained as the in-flight context object (still carries solicitationId + solicitorClaimId + rfpId for the submit-side branch).',
                  'SolicitationCreateModal Claim picker now greys out Claims already mapped to the RFP owner via an active or pending EA. Predicate: scan `evaluationAgreements` for EAs where `grantee.party === rfp.owner` AND `grantor.party === solicitorParty` AND `subject.kind === \'claim\'` AND `!_declineMeta && !_revokedMeta`; the Claim row renders at opacity 0.45 with `cursor: not-allowed`, no click handler, a tooltip "Already on {ownerParty}\'s network", and an "ON NETWORK" pillbox. Submit gating blocks selection of greyed Claims defensively. Without this gate, the cold-path CombinedRequestModal would resolve the PIN to `already-disclosed` and block submission — surfacing the impossible state upstream lets the user pick a different Claim before opening the modal.',
                  'EA+DA notification click handlers close the Directory layer if it\'s open before running cold-path navigation. Applies to `v22-request` (cold-path EA+DA request received), `v22-request-ea-only` (warm-path EA-only request received), and `v22-ea-accepted` / `v22-ea-declined` (informational acceptance/decline notifications). Previously the Directory stayed open behind the response modal / over the parent canvas; now the user lands on their parent canvas at the target node as expected.',
                  'CombinedRequestModal RS scrollbox: data source extended to include all published Requirements Sets (network-wide), not just the active actor\'s own RS pool. Pre-selection via `initialRequirementsSetIds` now works for any actor\'s published RS (RFPs can reference any actor\'s published RS by design). Per-row rendering gains a globe icon (canonical GlobeIcon used in LibraryModal / BadgesPanel / RequirementsPanel) + "Published by {owner party}" muted line below the name. Own (non-published) RSes appended below published rows with their pre-17.2.1.1 minimal treatment (no globe, no owner line). Dedupe by id (own wins so own-private RSes can never disappear). Cold-path entry (Claim PIN click on parent canvas) unaffected — same modal, same per-row rendering.',
                  'Footer rolls forward to v0.17.2.1.1.',
                ]},
                { version: '0.17.2.1', date: '2026-05-19', label: 'Phase 17.2.1', items: [
                  'Phase 17.2.1 — RFP Accept flow / Request Agreement. The Accept side of the solicitation loop (placeholder-disabled across 17.2 and 17.2.0.x) is now wired end-to-end. Bob clicks Request Agreement on Alice\'s solicitation card → AssetPickerModal opens → Bob picks one of his Assets → CombinedRequestModal opens pre-filled → submit creates a provisional EA+DA → Alice gets both a solicitation-accepted notification and the standard EA+DA request notification. The full RFP arc (post → solicit → reject/accept → formalize) is now demoable end-to-end.',
                  'New `AssetPickerModal` component (src/components/modals/AssetPickerModal.jsx) — single-select scrollable list of the active actor\'s Assets + context block (solicitor + RFP + Claim name) + Continue button gated on selection. Honours the architectural rule that disclosure + evaluation requests must originate from one of the requester\'s Assets so the parent canvas can lay out the request-node + edge.',
                  'V2App handlers: `handleRequestAgreement` captures the in-flight Accept-flow context (`v22AcceptingSolicitation = { solicitationId, solicitorClaimId, rfpId }`); `handleAssetPicked` pre-fills the existing CombinedRequestModal via `v22RequestAnchor` (picked Asset) + `v22AIShopperResult` (claim PIN + first RFP RS id) — the existing pre-fill mechanism is reused, no CombinedRequestModal refactor needed. Submit-side effect hook lives inside the existing `handleV22RequestSubmit` (conditional on `v22AcceptingSolicitation` being non-null) so the cold path is fully preserved.',
                  'New `acceptSolicitation(solicitation, eaId)` pure transform in v2_2Data.js + `acceptedEaId` field on `makeRfpSolicitation` — solicitation links back to the resulting EA artifact when accepted. Used by handleV22RequestSubmit to transition the solicitation in-place + reference the new EA id.',
                  'New `v22-rfp-solicitation-accepted` notification type. Delivered to the solicitor (Alice) on submit. Affirmative green badge + ACCEPTED label + "{requester} accepted your solicitation — see your new EA on the parent canvas" copy. Click routing mirrors the rejection notification (Directory → RFP marker → RfpDetailPanel); the panel\'s solicitor-view accepted-state surfaces the EA pointer. Auto-dismissed on click (loop terminates after acceptance).',
                  'SolicitationCard accepted-state treatment (both viewer modes): green status badge, "Agreement requested on {date}" line, no action buttons. Owner sees "see the provisional EA on the parent canvas"; solicitor sees "Accepted — see your new Evaluation Agreement on the parent canvas". RfpDetailPanel\'s `onRequestAgreement` prop wired through to SolicitationCard.',
                  'CombinedRequestModal cold-path preserved verbatim — the existing entry point (Claim PIN click on parent canvas, AI Shopper result) still works identically because the conditional submit-side branch is gated on `v22AcceptingSolicitation` (null for cold path). onClose extended to also clear `v22AcceptingSolicitation` so cancelling the modal mid-Accept-flow returns to a clean state.',
                  'Architecture spec §8.9 extended with the Accept-path architecture (AssetPickerModal step + CombinedRequestModal reuse + dual notification model). Footer rolls forward to v0.17.2.1.',
                ]},
                { version: '0.17.2.0.4', date: '2026-05-18', label: 'Phase 17.2.0.4', items: [
                  'LOD thresholds reverted from 17.2.0.3\'s overly-aggressive 2.5–5.5 band to 3.4–5.0 (mini-cards 340%–500%, full-cards 500%–650%). At the 17.2.0.3 lower bound (250 %), mini-cards visibly overlapped in dense clusters like Pinnacle Systems; reverting to 3.4 puts screen spacing back close to the original density-invariant value. `MAX_ZOOM` stays at 6.5. selectRfp\'s `Math.max(zoomRef.current, LOD_THRESHOLD)` resolves to the new 5.0 — notification clicks still land at full-card LOD.',
                  'Zoom controls in the Directory layer raised above the card overlay (zIndex 50 → 1700). Mini-card and full-card overlays render at z=1500/1600 and were covering the +/-/FIT buttons when cards landed in the upper-right region. New value sits between the card overlay (1600) and the header pillbox (2000) so contextual chrome elements still render above the controls.',
                  'AI Shopper modal click-to-render lag fixed (measured 81 ms post-fix vs ~5 s reported pre-fix). Two surgical fixes: (1) module-level cache for `buildV22SharedArtifacts` in `v2_2Data.js` — the function rebuilds a ~23k-Claim, ~92k-DA dataset (320 ms cold) on every call, with 20+ call sites in V2App; the cache returns the same object on subsequent calls in 0.001 ms. Safe because every existing caller treats the result as read-only and the function has no inputs. (2) O(n²) → O(n) rewrite of the AI Shopper IIFE\'s public-claims derivation: replaced `publicDas.map(d => shared.claims.find(c => c.id === d.subject.id))` with a precomputed `claimsById` Map for O(1) lookups. The find-loop was ~1.6 s alone on the seeded data.',
                  'Footer rolls forward to v0.17.2.0.4.',
                ]},
                { version: '0.17.2.0.3', date: '2026-05-18', label: 'Phase 17.2.0.3', items: [
                  'SolicitationCreateModal now surfaces the RFP\'s description above the Required Standards accordion, between the modal subtitle and the RS list. Matches the RfpDetailPanel description treatment (prose body, multiline-preserving via `white-space: pre-wrap`, muted-italic "No description provided." fallback when empty).',
                  'Directory mini-card zoom range widened: `MID_LOD_THRESHOLD` 3.33 → 2.5 (mini-cards now appear at 250% zoom, was 350%); `LOD_THRESHOLD` 4.38 → 5.5 (full-cards now appear at 550% zoom, was 450%). `MAX_ZOOM` bumped 5.0 → 6.5 so the new full-card threshold sits well below the cap with comparable headroom. selectRfp\'s `Math.max(zoomRef.current, LOD_THRESHOLD)` override resolves to the new 5.5 — notification click still lands at full-card LOD. Trade-off: the original "density invariant" (cards never overlap horizontally at the threshold) breaks at the low end of the band — at 250% zoom × 48 wu DOT_GRID = 120 px screen spacing vs 160 px mini-card width, so mini-cards may overlap horizontally inside dense clusters. Per Andrew\'s judgement, readability win > collision risk.',
                  'Footer rolls forward to v0.17.2.0.3.',
                ]},
                { version: '0.17.2.0.2', date: '2026-05-18', label: 'Phase 17.2.0.2', items: [
                  'Notification click on a solicitation now fully selects the target RFP — pan + zoom to full-card LOD, RfpDetailPanel opens, AND the marker shows the pinned tooltip + select-state brightening (parallel to a manual marker click). Phase 17.2.0.1 panned at current zoom without selecting on-canvas; 17.2.0.2 introduces a `selectRfp` imperative handle that mirrors the internal click path end-to-end via a new `focusRfpInternal` helper shared between the marker / card click handlers and the imperative path.',
                  'Active actor\'s own-cluster label on the Directory layer renders with amber pillbox fill + dark text so the user can orient at a glance. Bob → GovCo styled; Alice → MicroCo styled; Dave → ChipCo styled; Carol → no styling (Carol/AuditCo has no cluster on the Directory, so the gating naturally degenerates). Same `--accent-amber` variable used by the chrome notification + Directory-active signals.',
                  'SolicitationCreateModal gains a Required Standards accordion above the Claim picker. Each RS the RFP references renders as a clickable header (name + version pill + chevron); expanding reveals the RS\'s requirements list with id (mono pill), label, description (secondary), and criterion (muted italic). Multiple entries can be open simultaneously. Missing-RS case surfaces "(Standard not found)"; empty case surfaces "No required standards specified." Section is scrollable at 240px max-height; modal body already had 90vh max-height via ModalShared.',
                  'Footer rolls forward to v0.17.2.0.2.',
                ]},
                { version: '0.17.2.0.1', date: '2026-05-18', label: 'Phase 17.2.0.1', items: [
                  'Hotfix: notification click routing + Directory cursor/hover + V2Canvas2 setState-in-render fix. Three runtime QA items from Phase 17.2 closed in one pass.',
                  'Notification click routing for both `v22-rfp-solicitation-received` (Bob\'s inbox) and `v22-rfp-solicitation-rejected` (Alice\'s inbox): the click now opens Directory (if closed), clears Claim panel, sets RFP panel, AND pans + zooms the Directory camera to the target RFP marker. The 17.2 implementation registered the first three sub-steps but omitted the camera pan. The new path uses an imperative `useImperativeHandle`-exposed `panToRfp(rfp)` method on DirectoryLayer, with a rAF-driven retry loop in V2App that fires the pan once the Directory\'s phase machine reaches `in` and the layout is built (the 600ms opening transition makes synchronous pan calls a no-op when Directory was closed before the click).',
                  'Directory cursor pointer on interactive hover (Claim dot / open RFP square / closed-and-owned RFP / mini-card / full-card). The canvas\'s inline cursor style sat at `default`, masking any container-level cursor change. Fix: imperatively set `canvasEl.style.cursor` in handleMouseMove based on raycast hit; reset on layer-exit via onMouseLeave. AssetNode / AssetNodeMini wrappers already carry `cursor: pointer`, so card hover works automatically.',
                  'RFP open-marker hover/select brightening (Items 19+20 from 17.2 QA) now visibly renders. The 17.2 path set `instanceColor = (1,1,1)` against an indigo material color — the multiplier landed at identity, no visible delta. Fix: switch material color to white and let the per-instance color carry the entire color signal. Base instance color = indigo; flushRfpColors lerps base 0.35 toward white on hover, 0.65 on select. Closed-RFP per-vertex colors get the same hover/select delta (was: single 0.55 lerp for both).',
                  'V2Canvas2 setState-in-render fix: `setV22DirectoryOpen((open) => ...)` functional updater called `canvasRef.current.clearHoverState()` as a side effect inside the reducer, which ran during V2App\'s render and triggered V2Canvas\'s setState. React\'s docs explicitly disallow side effects inside functional updaters. Surgical fix: lift the side effect out of the updater — read the current `v22DirectoryOpen` from closure, run the side effect, then call setState. No structural refactor.',
                  'Footer rolls forward to v0.17.2.0.1.',
                ]},
                { version: '0.17.2', date: '2026-05-18', label: 'Phase 17.2', items: [
                  'Phase 17.2 — RFP solicitation flow (submit + deliver + reject loop). Opens the seller→buyer engagement axis: sellers solicit their existing public Claims against a buyer\'s open RFP from the RfpDetailPanel; buyers see incoming solicitations in the panel and can reject with an optional reply.',
                  'New `makeRfpSolicitation(...)` factory in v2_2Data.js with status taxonomy `\'pending\' | \'rejected\' | \'accepted\'` (the accepted branch is reserved for Phase 17.2.1\'s Request Agreement flow). New `mergeSolicitations(shared, solicitations)` overlay (mirror of mergeProvisionals / mergeClosedRfps shape — Map storage so updates mutate in place).',
                  'V2App `v22Solicitations: Map<id, RfpSolicitation>` session state. Two new handlers: `handleCreateSolicitation` builds the artifact + fires a `v22-rfp-solicitation-received` notification on the RFP owner\'s inbox; `handleRejectSolicitation` updates status + respondedDate + rejectionMessage + fires a `v22-rfp-solicitation-rejected` notification on the solicitor\'s inbox.',
                  'New SolicitationCreateModal (Claim picker + optional message field, max 500 chars, picker defaults to zero selected per CLAUDE.md convention) + SolicitationRejectModal (optional 300-char reply, red destructive submit) + SolicitationCard (renders a single solicitation inside RfpDetailPanel with status badge, message blocks, action bar — `Request Agreement` disabled with `Coming in Phase 17.2.1` tooltip; `Reject` enabled on pending).',
                  'RfpDetailPanel three-way visibility branch on solicitations: owner sees `Incoming Solicitations (N)` with all cards (empty case shows muted `No solicitations yet.`); solicitor sees `Your Solicitation` with their single card (REJECTED state surfaces buyer\'s reply in a separate block); other non-owner sees no section. Footer extension: non-owner + status open + no existing solicitation → `Solicit with my Claim` button; non-owner + existing solicitation → muted `Already solicited — see above.` line.',
                  'Notification routing: both new types (`v22-rfp-solicitation-received` lands on owner; `v22-rfp-solicitation-rejected` lands on solicitor) navigate to Directory → RFP marker → RfpDetailPanel on click. Auto-dismissed since the loop terminates after rejection.',
                  'DirectoryLayer RFP marker hover + select brightening (Item 19 + 20): per-instance `instanceColor` attribute on rfpMesh + rfpFillMesh (brightens to white on hover/select index); per-vertex `color` attribute on the closed-RFP `LineDashedMaterial` (lerp toward white on the hovered/selected closed RFP\'s 8-vertex range). New `flushRfpColors` flush callback parallel to flushDotColors.',
                  'Detail Panel 1px gap fix (Item 21): bumped both Directory-layer Detail Panel mount blocks (Claim + RFP) from `bottom: 28` to `bottom: 27` to close a 1px hairline gap above the app footer.',
                  'Footer rolls forward to v0.17.2.',
                ]},
                { version: '0.17.1', date: '2026-05-18', label: 'Phase 17.1', items: [
                  'Phase 17.1 — RFP close/reopen lifecycle (owner-side). Bob (or any RFP owner) can now close an RFP from its Detail Panel; closed RFPs render dashed on the owner\'s Directory at every LOD and disappear from non-owners\' Directories.',
                  '`makeRfp` factory validates `status` against a `\'open\' | \'closed\'` taxonomy + accepts a `closedDate` ISO string (null when open). New exported `closeRfp(rfp, closedDate)` and `reopenRfp(rfp)` pure transforms; new `mergeClosedRfps(shared, closedRfpIds)` overlays session state on shared artifacts (mirror of mergeProvisionals shape, Map storage so each closure keeps its captured timestamp).',
                  '`buildV22DirectoryDataForRole(roleId, provisionals, closedRfpIds)` chains the new merge layer. Asymmetric filter: `ownRfps` includes all of the owner\'s RFPs regardless of status; `otherRfps` + per-cluster `cluster.rfps` filter out closed.',
                  'V2App `v22ClosedRfpIds` Map<rfpId, ISO closedDate> session state mirror of v22Provisionals. Threaded to DirectoryLayer. Close / Reopen handlers wired to RfpDetailPanel. The selected RFP is re-resolved from the merged shared artifacts each render so the Detail Panel reflects the latest status (the snapshot held by `v22DirectorySelectedRfp` would otherwise stay stale after Close).',
                  'RfpDetailPanel owner-only footer with single direct-action button: "Close this RFP" (status open) or "Reopen this RFP" (status closed). Non-owners see no footer. Status badge renders `OPEN` (green tint, existing) or `CLOSED` (muted grey, new). New "Closed YYYY-MM-DD · HH:MM UTC" row when closed.',
                  'Closed-owned RFP visual treatment at every LOD: per-instance dashed-line `THREE.LineSegments` + `LineDashedMaterial` overlay on the Directory canvas (Option A — bounded N, per-frame add/remove cost negligible); CSS `border-style: dashed` on AssetNode / AssetNodeMini RFP card variants (hover/select keeps dashed). Hit-test mesh keeps all RFP instances regardless of status so the owner can still click to reopen. New `closedRfpMesh` hides at zoom ≥ MID_LOD_THRESHOLD alongside the visible hollow-square mesh.',
                  'Footer rolls forward to v0.17.1.',
                ]},
                { version: '0.17.0.2', date: '2026-05-17', label: 'Phase 17.0.2', items: [
                  'Hotfix: TDZ `ReferenceError: Cannot access \'hoverSelectColor\' before initialization` crashing Directory full-card LOD on Bob\'s view and every RFP card click.',
                  'Root cause: Phase 17.0.1\'s RFP early-return branch in `AssetNode` (full) referenced `hoverSelectColor` before its `const` declaration — the Phase 16.2.11 declaration site sat further down in the function body, after the new early-return. Fix: hoist the declaration above the RFP early-return (3-line move, no semantic change for non-RFP renders since the value depends only on `node.category`). `AssetNodeMini`\'s RFP branch already had the declaration above it — no change needed there. Swept both components for other TDZ-trapped vars; none surfaced.',
                  'Footer rolls forward to v0.17.0.2.',
                ]},
                { version: '0.17.0.1', date: '2026-05-17', label: 'Phase 17.0.1', items: [
                  'Phase 17.0.1 — RFP card LOD swap + hover-preview pinning. RFP markers now transition hollow-square → mini-card → full-card at the same zoom thresholds as Claims (Phase 16.2.7), and RFP click paths setPinned with an RFP discriminator so the pinned-tooltip + Detail Panel stay in sync.',
                  'AssetNode + AssetNodeMini extended with a 5th schema (`category: "rfp"`) — minimal layout per Andrew\'s spec: full-card = type pill + name + "Posted by {owner}"; mini-card = type pill + name only. No badges, no minibars, no action bar. RFPs join the amber-on-hover/select branch (`hoverSelectColor`); their default border is WARM_BORDER because RFPs carry no disclosure type (public-by-nature).',
                  'DirectoryLayer card-overlay render block now iterates both Claim AND RFP entries from `allDots`. Each RFP entry builds a synthetic node `{ id, category: "rfp", rfp, name, ownerParty, owner }` and routes to AssetNode (full-LOD) / AssetNodeMini (mid-LOD). Hollow-square outline + fill + hit-test meshes all hide at zoom ≥ MID_LOD_THRESHOLD (extending the dot-mesh hide path).',
                  'Stale-pinned-tooltip bug fix (surfaced in 17.0 QA): `pinned` state extended to a discriminated union — exactly one of `{ claim, ... }` or `{ rfp, ... }` at any time. All RFP click paths (hollow-square at low zoom + mini-card + full-card via onCardClick) call setPinned with the RFP shape, which overwrites any previously-pinned Claim — and vice versa. Clicking from Claim to RFP (or RFP to Claim) now cleanly swaps the pinned tooltip.',
                  'New `RfpTooltipCard` mirrors `ClaimTooltipCard` for the dot-LOD pinned tooltip path (the small floating card pinned near the click point at low zoom). Pinned tooltip render block branches on `pinned.claim` vs `pinned.rfp` and renders the matching variant.',
                  'Empty-canvas click clears BOTH discriminators (calls onRfpClick(null) alongside onClaimDotClick(null)) — V2App\'s onRfpClick handler with `rfp=null` clears the RFP Detail Panel state.',
                  'Footer rolls forward to v0.17.0.1.',
                ]},
                { version: '0.17.0', date: '2026-05-17', label: 'Phase 17.0', items: [
                  'Phase 17.0 — Clickable RFP markers + read-only RFP Detail Panel (Directory only). Opens the Phase 17 RFP arc against polish-backlog #192 (Item J). First time RFPs become interactive — 118 seeded RFPs (Bob\'s Sentinel-4 + 20 RFP-only buyer mocks + 4 mixed actors) are now clickable.',
                  'New invisible solid-square hit-test InstancedMesh in DirectoryLayer.jsx — sized to RFP_BASE_OUTER, opacity 0, depthWrite off, matrices in lockstep with the visible outline + fill meshes. The visible hollow-square outline\'s centre would otherwise miss raycasts; the hit mesh fills that dead zone so any click inside the marker resolves. Defensive InstancedMesh settings preserved (frustumCulled = false, unbounded boundingSphere).',
                  'New RfpDetailPanel component (src/components/DetailPanel/RfpDetailPanel.jsx) — read-only. Header pill "RFP" + status badge + close button + name. Body: "Posted by" + owner ACTOR pill + YOU badge when applicable; description (or muted "No description provided"); "Required Standards" chip list (each rsId → "{name} v{version}" if found in publishedRequirementSets; muted raw id fallback); posted date (YYYY-MM-DD · HH:MM UTC). No footer / action buttons.',
                  'V2App.jsx wiring: new v22DirectorySelectedRfp state; DirectoryLayer onRfpClick prop; mutual exclusion with v22DirectorySelectedClaim (each setter clears the other so only one Detail Panel is visible at a time); both states cleared on Directory close + globe-button toggle. Panel mount shell mirrors the existing Claim mount: position:fixed top:61 right:0 bottom:28 width:480 zIndex:200.',
                  'Click flow: raycast extended to consult both dot-mesh and RFP hit-test mesh; closer hit wins (defensive — RFPs are placed outside cluster dots so concurrent hits are vanishingly unlikely). RFP hit fires onRfpClick + the same animatedPanToWithZoom pan-to-center mirror of the Claim dot pipeline (Phase 16.1.3 Item 6 / 16.2.9 Item 1 pattern). RFP hover-preview / pinned tooltip is deferred to Phase 17.0.1 alongside the RFP card LOD swap.',
                  'Out of scope (per brief): RFP mini-card + full-card LOD variants (17.0.1); RS chip click behaviour (17.0.1); makeRfp lifecycle metadata (17.1 post flow); parent canvas RFP rendering (later); Claim Detail Panel changes (17.3); umbrella DA edges (17.4+).',
                  'Footer rolls forward to v0.17.0 — first forward-progress phase after the Phase 16.2.11 footer freeze ended.',
                ]},
                { version: '0.16.2.11', date: '2026-05-17', label: 'Phase 16.2.11', items: [
                  'Phase 16.2.11 — Phase 16 wrap-up: Alice grouping + footer version + parent-layer visual calibration. Closes the Directory + parent-canvas appearance arc.',
                  'Alice per-Claim y-band grouping fix: `buildV22Canvas` chain anchor now reads the evaluated Claim\'s y as the primary anchor (was `EA.granteeAssetId` per Phase 16.2.2). The granteeAssetId Asset (Bob\'s `bAvionics`, Carol\'s `cAuditWorkspace`) isn\'t on grantor-direction views like Alice\'s, so chains were falling through to a symmetric-distribution fallback and scattering. With the new anchor, each Claim\'s chain lives on the Claim\'s exact y (pass 1) or the nearest free row (pass 2). Bob\'s view is unaffected because pulled Claims at `symmetricRowY(i)` coincide with owned Assets at `symmetricRowY(i)` by construction. Verified: Alice\'s 3 Claims now host chains within 0-2 rows of their Claim (was up to 7 rows scatter). Bob/Carol/Dave unchanged. Asset-clustering-near-Claim (separate concern from chain clustering) requires re-architecting Asset placement and is scoped to a future phase.',
                  'Footer version label bumped v0.16.2.0 → v0.16.2.11. The backtrack-hotfix freeze formally ends here; future phases roll the footer to match the phase number.',
                  'Parent canvas Claims now opt into the disclosure-type colored borders + tinted backgrounds (mirror of Phase 16.2.10\'s Directory treatment). `buildV22Canvas` computes a `_disclosureType` per Claim node — own Claims = `\'full\'`, pulled Claims = the type of the DA where `grantee.party === actor.party && subject.kind === \'claim\' && subject.id === claim.id`. V2Canvas passes `disclosureType={node.category === \'claim\' ? node._disclosureType : undefined}` to both `AssetNode` and `AssetNodeMini`. The 16.2.10 disclosure-type branches in `AssetNode.jsx` now fire on parent too. Bad-health overrides disclosure-type per the existing priority chain, so e.g. Bob\'s view of Alice\'s PRM Claim (selective) shows a red border (bad health) with an amber-tinted background (selective).',
                  'Non-Claim node types (Actor, Asset, Eval Result, PoE) now use bright indigo (`var(--accent-indigo)`) for hover and select states — was amber. Implemented as a top-of-component `hoverSelectColor` derived from `node.category` in both `AssetNode` and `AssetNodeMini`. Three sites updated per component: inner border, outer selection ring, inner-div hover background. Claims keep amber so the discrete hover/select state stays distinct from the disclosure-type indigo/amber/green default. Net visual rule: non-Claim nodes are always indigo-themed (40%-indigo WARM_BORDER → 100%-indigo on hover/select); Claims carry disclosure-color defaults that yield to amber on hover/select.',
                  'AssetNodeDot intentionally left unchanged in this phase — its existing hover/select treatment is orthogonal to the card-level rules. If QA surfaces a need for the same treatment on dots, follow-up phase.',
                  'Docs updated: architecture-spec.md §8 Changelog gains a Phase 16.2.11 entry; polish-backlog.md Update Log gains an entry marking Phase 16 closed; CLAUDE.md "Current state of the world" rolled; phase-log entry added.',
                  'Phase 16 (Directory Layer + parent-canvas visual calibration) is now closed. Forward queue: Phase 17.0 — RFP factory promotion + buyer post flow + clickable RFP dots + RFP Detail Panel.',
                  'Footer rolls forward to v0.16.2.11.',
                ]},
                { version: '0.16.2.10', date: '2026-05-17', label: 'Phase 16.2.10', items: [
                  'Phase 16.2.10 — Disclosure-type colored borders + tinted backgrounds on Directory Claim cards. Adds the disclosure-type color signal to AssetNodeMini (mid-LOD) and AssetNode (full-LOD) cards on the Directory layer, mirroring the existing dot-color mapping (full → indigo, selective → amber, proof-only → green).',
                  'A new `disclosureType` prop is added to both `AssetNode` and `AssetNodeMini`. When present (and no higher-priority state — declined/revoked, provisional, hover/selected, bad-health — applies), the card\'s border color signals the disclosure level. A 12% color-mix tint applies the same color as a subtle background wash. The mapping uses CSS variables `var(--accent-indigo)`, `var(--accent-amber)`, `var(--accent-green)`.',
                  'Plumbing: DirectoryLayer.jsx propagates `disclosureType` from cluster spec items → `placed` dots → `allDots` entries → card render block. Card overlay block in the LOD swap (Phase 16.2.7) passes `disclosureType={d.disclosureType}` to both `Card` components.',
                  'AssetNode (full) inserts the disclosure-type background ABOVE `isCounterpartyNode` in the priority chain — rationale: disclosure type is the more-specific signal (which-data-is-visible); counterparty is the less-specific signal (whose-data-is-it). Directory cards always carry `disclosureType` so they always land in the new branch; parent canvas Claims (which don\'t pass the prop) fall through to the existing chain unchanged.',
                  'Parent canvas opt-in deferred — V2Canvas invocations of AssetNode/AssetNodeMini don\'t pass `disclosureType`, so parent-layer rendering is unchanged. Implementer may wire parent layer in a future phase.',
                  'Hover / select precedence preserved: hovering a Directory card switches its border to amber (existing behavior), overriding disclosure-type. Selection adds the outer thick amber ring on top. Worth assessing in a future polish pass whether the disclosure color should peek through (e.g., bottom-edge accent or persistent left-edge stripe) — deferred.',
                  'Priority #1 (Directory appearance and feel) is now complete. Next forward-progress: Phase 17.0 (RFP factory promotion + buyer post flow + RFP Detail Panel).',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.9', date: '2026-05-17', label: 'Phase 16.2.9', items: [
                  'Phase 16.2.9 — Card-click pan + hover-preview offset fix. Two surgical QA-driven fixes following Phase 16.2.8.',
                  'Item 1: `onCardClick` in DirectoryLayer.jsx now appends the same `animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)` block the dot-click handler runs. Phase 16.2.7 omitted this on the wrong rationale that the user is "already viewing the card" — but with the Detail Panel taking ~PANEL_W of the right viewport, the clicked card is often masked by the panel until the user manually pans. Same 500 ms ease, `targetZoom = zoomRef.current` (no zoom change). `animatedPanToWithZoom` added to the `useCallback` deps.',
                  'Item 2: AssetNodeMini\'s portal-tooltip transform changed from `translate(-50%, -50%) scale(0.85)` to `translate(calc(-50% + ${(ACTION_BAR_W * 0.85) / 2}px), -50%) scale(0.85)`. The wrapper is `CARD_W + ACTION_BAR_W = 244 px`; without the shift, the visible card body\'s centre lands 14.45 px LEFT of tooltipPos.x. Mini-card\'s amber hover border was peeking out on the right of the preview — obvious on Directory\'s unscaled 160 px mini-cards, subtly off on parent canvas too. Subtle parent-canvas alignment improvement comes free.',
                  'No changes to AssetNodeDot\'s tooltip, RFP rendering, cluster labels, mock data, or other Directory state. Build clean; no console errors.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.8', date: '2026-05-17', label: 'Phase 16.2.8', items: [
                  'Phase 16.2.8 — Directory Claim card population (CLAIM type label, health minibars, badge chips, red borders on bad health). Phase 16.2.7 shipped the LOD swap by passing raw `claim` (output of `makeClaim`) as the `node` prop — cards rendered title + owner only. Root cause: `AssetNode` / `AssetNodeMini` read `node.category`, `node.displayHealth`, `node._activeBadges` — none of which exist on raw `makeClaim` output. Fix routes Directory Claims through the existing `claimToNode(claim, rollup, x, y)` helper.',
                  'New mock helpers: `mockClaimHealth(claimId)` returns `{ ok, warn, bad }` rollup keyed by claim.id via deterministic seededRandom; distribution: 50% no minibar, 5% all-green ≥ 2 badges, 5% all-green 1 badge, 10% all-green no badges, 15% has-bad (red border), 15% mixed. `mockClaimBadges(claimId, health)` returns badge entries only when `health.bad === 0 && health.warn === 0 && health.ok > 0`. Inline MOCK_BADGE_NAMES (12 standards) + MOCK_BADGE_ISSUERS (5 issuers). Badge shape matches BadgeChipContainer\'s consumer contract verbatim.',
                  'View-builder `buildV22DirectoryDataForRole` builds `cluster.nodesByClaimId` Maps per cluster + a top-level `ownNodesByClaimId` Map; each value is `claimToNode(...)` with `_activeBadges` attached. DirectoryLayer.jsx `buildItems` reads from these Maps and threads `node` through `placed` dots → `allDots` → the card overlay block.',
                  'Click flow preserved: `onCardClick` and dot-click both continue passing raw `d.claim` to `onClaimDotClick` (the Detail Panel still receives the shape it expects).',
                  'Probe verified across 22,994 enriched nodes on Bob\'s view: 49.9%/20.0%/15.2%/15.0% distribution; 10.0% with ≥ 1 badge; 4.9% with ≥ 2 badges. Determinism passes. Dev server verified at zoom 5.0: cards show CLAIM teal label, owner, minibar (~half), red borders on has-bad cards, badge chips on a subset.',
                  'No changes to AssetNode.jsx, BadgeChipContainer.jsx, RFP rendering, or `makeClaim` output.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.7', date: '2026-05-17', label: 'Phase 16.2.7', items: [
                  'Phase 16.2.7 — Mini-card + full-card LOD on Directory + size tweak. Closes polish-backlog #200. Three coordinated changes in DirectoryLayer.jsx.',
                  '(1) `BASE_DOT_FACTOR` 0.85 → 0.70 + `BASE_RFP_FACTOR` 0.95 → 0.80 — marker sizes in the linear regime shrink ~16-18%, cap-engaged appearance unchanged. (2) `MAX_ZOOM` 1.5 → 5.0 — makes room for two LOD swap thresholds. (3) LOD swap for Claim dots only — at zoom ≥ `MID_LOD_THRESHOLD = 160/48 = 3.333` dots are replaced by AssetNodeMini HTML overlays; at zoom ≥ `LOD_THRESHOLD = 210/48 = 4.375` they swap to full AssetNode.',
                  'Both card components reused verbatim from AssetNode.jsx (brief\'s hard rule: NO modifications). Density invariant: cards render at FIXED NATURAL PIXEL SIZE (no transform: scale()) — at the threshold, screen-space inter-dot spacing exactly equals card width, so cards never overlap. Viewport-cull skips cards outside viewport + cardW/cardH buffer.',
                  'New `dotsMesh.visible` useEffect (hidden in mid + full LOD), hover-clear useEffect, gated ClaimTooltipCard render, new `onCardClick` useCallback (mirrors dot click flow but originally skipped animated pan/zoom — corrected in Phase 16.2.9). RFPs stay as hollow squares at all LODs — RFP card swap deferred. Cluster pillbox labels stay as PillboxLabel.',
                  'Card dimension constants mirrored in DirectoryLayer.jsx (sync\'d duplicate; AssetNode.jsx doesn\'t export them). Verified on dev server (1400×900, Bob\'s view): at zoom 366% (mid-LOD), 23 AssetNodeMini cards rendered with non-overlapping spacing; at zoom 500% (full-LOD), AssetNode full cards visible; dot mesh hidden in both regimes.',
                  'Phase 16.1.4 / 16.1.5 / 16.2.3 / 16.2.6.1 / 16.2.6.4 / 16.2.6.5 / 16.2.6.6 defensive settings preserved.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6.6', date: '2026-05-16', label: 'Phase 16.2.6.6', items: [
                  'Phase 16.2.6.6 — RFP marker scaling + tinted fill. Resolves four 16.2.6.5 QA issues — RFP squares oversized at high zoom (no cap), borders proportionally tiny, adjacent grid-cell squares overlapping, and markers reading as empty rectangles without fill.',
                  'New constants in DirectoryLayer.jsx: `BASE_RFP_FACTOR = 0.95`, `MAX_SCREEN_RFP_PX = 22`, `RFP_FILL_ALPHA = 0.15`, `RFP_BASE_OUTER = DOT_GRID × 0.95 = 45.6 wu`. New `computeRfpWorldSize(zoom)` parallels `computeDotWorldSize`. Outline geometry built at `RFP_BASE_OUTER`.',
                  'New `rfpFillMeshRef` + PlaneGeometry + indigo MeshBasicMaterial(`transparent`, `opacity: 0.15`) companion InstancedMesh added BEFORE the outline mesh so the outline draws on top of the fill. Disposal added to cleanup. Populate loop bakes per-instance scale via `m.makeScale + setPosition` and writes to both meshes.',
                  'New `rfpScaleRef` + rescale-on-zoom useEffect updates both meshes\' matrices on scale change ≥ 1e-4. Effect declared BEFORE the border-rebuild effect so `rfpScaleRef` is current when read. Border-rebuild formula: `RFP_BORDER_SCREEN_PX / (scale × zoom)` — below the cap reduces to the pre-16.2.6.6 formula; above the cap settles to a single geometry.',
                  'Verified: 99 PillboxLabel + 118 RFP markers render on Bob\'s view at zoom 0.15. Dot rendering unchanged; mixed clusters preserve dots-inner-squares-outer pattern. No NaN warnings. Phase 16.1.4 / 16.1.5 / 16.2.3 / 16.2.6.1 / 16.2.6.4 / 16.2.6.5 defensive settings preserved.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6.5', date: '2026-05-16', label: 'Phase 16.2.6.5', items: [
                  'Phase 16.2.6.5 — RFP cluster expansion (20 RFP-only + 4 mixed actors). Populates the Directory\'s previously-empty bottom third with buyer-side signal: 20 new RFP-only mock actors (98 total RFPs across NavalSys Authority through Vesper Defense) + 4 mixed actors with both Claims and RFPs (Lighthouse Programs / Marigold Systems / Quarry Industries / Auger Defense — 170 Claims + 19 RFPs).',
                  'New exported `generateRfpsForActor(actor, count)` helper uses existing `hashString` + `seededRandom` (mulberry32) for deterministic procedural RFP names. View builder extended with `PRIMARY_PARTIES_FOR_ORPHAN_RFP` exception set (GovCo/MicroCo/AuditCo/ChipCo) — every cluster carries `cluster.rfps`; RFP-only owners upsert as new clusters except primary parties (preserves 16.2.6.3 GovCo orphan-label path on Alice/Carol/Dave views).',
                  '`computeLayout` gains an `ACTOR_KIND` taxonomy + branched initial seed positions (RFP-only bottom-bias 0.70-0.94 × usable height; mixed cross-zone band 0.60-0.70; Claims upper 0.10-0.65); target-area formula extended with `RFP_AREA_FACTOR = 1.44`; hard y-clamp inside Lloyd\'s loop pins RFP-only seeds. Per-RFP-marker label render filters on `clusterIdx === -1` (orphan-only).',
                  'Probe-verified totals: actors 77→101, claims 22,824→22,994, assets 22,821→22,991, DAs 91,321→92,001, rfps 1→118. Cluster overflow grew 18 → 20 (+2, within brief\'s "expected 4-8" tolerance — Bowsprit Defense + Andromeda Defense newly overflow at the denser seed).',
                  'Polish-backlog #201 closed by this phase. Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6.4', date: '2026-05-16', label: 'Phase 16.2.6.4', items: [
                  'Phase 16.2.6.4 — Label z-order fix (smaller clusters on top). Single-item phase resolving label-overlap issues surfaced after 16.2.6.3\'s 25-actor expansion: ChipCo buried behind Prism Aerospace, MicroCo behind Precision Components, Photonix truncated behind Substrate Dynamics.',
                  'Two new module-level constants in DirectoryLayer.jsx: `Z_BASE_CLUSTER_LABEL = 100` + `Z_RFP_LABEL = 1100`. PillboxLabel accepts a new `zIndex` prop (default 4) applied to the absolutely-positioned outer container. Cluster-label render block sorts `layout.allClusters` by `dots.length` descending, builds a party→rank Map, threads `zIndex={Z_BASE_CLUSTER_LABEL + rank}` per label — largest cluster gets lowest z, smallest gets highest. RFP owner-actor labels get `zIndex={Z_RFP_LABEL}` so they always render above every cluster label.',
                  'Trade-off per brief: large clusters\' pills may have corners clipped behind small-cluster pills (acceptable — large cluster identity is unmistakable from its footprint). DOM probe verified on Bob\'s view: Helios (3,250 dots) at z=101 → Photonix at z=172, MicroCo at z=173, GovCo at z=174 — inverse correlation with dotCount. On Alice\'s view the GovCo RFP owner-label renders at z=1100, above all cluster labels.',
                  'No regression. Phase 16.1.4 / 16.1.5 / 16.2.3 / 16.2.6.1 defensive settings preserved. Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                  'Companion z-index hotfixes between 16.2.6.4 and 16.2.6.5 (standalone commits): "RADIANT NETWORK" header pillbox zIndex 11 → 2000 (was rendering behind the Detail Panel chrome); Directory dot tooltip card zIndex 30 → 2500.',
                ]},
                { version: '0.16.2.6.3', date: '2026-05-16', label: 'Phase 16.2.6.3', items: [
                  'Phase 16.2.6.3 — More mock actors + label scaling + RFP hollow square + top inset trim. Six surgical polish items addressing post-16.2.6.2 QA.',
                  '(1) 25 more mock supplier Actors (5 medium + 20 small) added to a new `PHASE_16_2_6_3_NEW_MOCK_ACTORS` constant in v2_2Data.js, concatenated with `PHASE_16_2_6_NEW_MOCK_ACTORS` at the same expansion loop. All reuse 16.2.6 verticals + procedural Claim spec pipeline. Directory now ~22,824 dots across 77 Actors (was 52). Cluster boundaries grow ~48% — more "butting" between adjacent clusters.',
                  '(2) Zoom-aware cluster label scaling: new `BASE/MIN/MAX_LABEL_FONT_PX` + `computeLabelFontSize(zoom) = 14 × sqrt(zoom)` clamped to [11, 18]. PillboxLabel accepts `fontPx` prop; padding em-based (`0.3em 0.7em`) + lineHeight: 1 + flex centering so pill scales proportionally and text stays exact-centered at any zoom.',
                  '(3) Wave reveal speed 3000 → 4500 wu/sec in directoryLoadAnimation.js. Duration drops ~3s → ~2s. (4) RFP marker owner-actor label: PillboxLabel below the marker for every RFP whose owning actor ISN\'T the active actor. (5) RFP marker → hollow square primitive (indigo) using existing `makeHollowSquareGeometry`. (6) `DOMAIN_INSET_TOP` 500 → 475 — visible top buffer below header now matches L/R 1-cell edge buffer.',
                  'Polish-backlog #201 added: Directory RFP cluster expansion at canvas bottom third. Known regressions surfaced + accepted per brief\'s pinned conventions: cluster overflow now affects 18 clusters (was 10 in 16.2.6.2) — per brief\'s "Lloyd\'s at the current scale is already non-converging... Accept" rule.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6.2', date: '2026-05-16', label: 'Phase 16.2.6.2', items: [
                  'Phase 16.2.6.2 — Edge buffers + zoom range + dot scaling + wipe origin. Four surgical polish items addressing post-16.2.6.1 QA.',
                  '(1) Voronoi-domain insets: four new constants (`DOMAIN_INSET_LEFT/RIGHT = DOT_GRID`, `DOMAIN_INSET_TOP = 500`, `DOMAIN_INSET_BOTTOM = 250` world units) shrink the tessellation rectangle inward — 1-cell edge buffer on left/right, world-space equivalent of the app header (~61 css px) + footer (~32 css px) at MIN_ZOOM = 0.15 on top/bottom. Both `delaunay.voronoi(...)` call sites pass the inset bounds.',
                  '(2) `MAX_ZOOM` 4.0 → 1.5 — paired with new dot-size cap; beyond 150% no useful detail until Directory mini-card swap (deferred, filed as polish-backlog #200).',
                  '(3) Non-linear dot scaling: new `BASE_DOT_FACTOR = 0.85` (was 0.95) + `MAX_SCREEN_DOT_PX = 22` + `computeDotWorldSize(zoom)` helper. Cap threshold ≈ 0.54 zoom. Implementation: per-instance matrix bakes scale via `m.makeScale(s, s, 1); m.setPosition(d.x, -d.y, 0)` (NOT mesh-level scale, which would also move positions).',
                  '(4) Wipe origin default moved from bottom-left (\'0% 100%\') to bottom-center (\'50% 100%\') — visually says "the network expands from your active-actor anchor." Pre-pinned `wipeOrigin` (Phase 11.8 #44 node-double-click) still wins; only the chrome-globe-click default path changes.',
                  'Polish-backlog #200 added: Directory mini-card swap at higher zoom. Known regressions surfaced + accepted per brief\'s pinned conventions.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6.1', date: '2026-05-16', label: 'Phase 16.2.6.1', items: [
                  'Phase 16.2.6.1 — Dense organic cluster packing + ~22k dot expansion. Three coordinated changes resolve the trio of QA issues from Phase 16.2.6 (intra-cluster spiral gaps, half-empty canvas, super-jumbo overflow) via a single algorithmic shift: dense Voronoi-clipped grid fill replaces Vogel sunflower in DirectoryLayer.jsx.',
                  '(1) New `packClusterDense` — each cluster\'s Voronoi polygon shrunk inward by 1 DOT_GRID, every grid cell inside enumerated (label hole excluded), sorted by distance from centre, first N filled. New helper `shrinkConvexPolygon` (per-vertex bisector miter, orientation-detected). Removed Vogel-related constants. (2) Lloyd\'s target area swapped to physically-grounded `(dots × DOT_GRID² + LABEL_HOLE_AREA) × 1.20`. (3) 35 mock supplier dot counts expanded ~6.5× in v2_2Data.js. New totals: Directory now ~21,609 dots. Delta: +18,147 Claims, +18,147 Assets, +72,588 DAs vs 16.2.6 baseline.',
                  '(4) `DOT_RADIUS = DOT_GRID × 0.475` (was 0.425) — diameter `0.95 × DOT_GRID` so adjacent dots butt with ~5% gap. (5) `MAX_DOTS` 10000 → 25000 for InstancedMesh capacity.',
                  'Defensive fixes: shrink-collapse fallback (ChipCo\'s tiny cell reverts to unshrunken on console.warn); finite-vertex filter on umbrella SVG path render (drops paths with NaN screenPoints from the brief mount-race).',
                  'Known regressions surfaced per brief pinned conventions, filed as 16.2.6.2 candidates: Lloyd\'s residual still 161 wu at 20-iter cap (≈ 3.4 × DOT_GRID); cluster overflow on 9 clusters at new counts; ChipCo\'s tiny cell collapses on shrink. Visual result remains the brief\'s intent: top 75% of canvas densely populated, organic cluster shapes (Voronoi-polygon-edged), label holes preserved, inter-cluster buffer clearly visible, super-jumbos visibly massive.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.6', date: '2026-05-16', label: 'Phase 16.2.6', items: [
                  'Phase 16.2.6 — Directory seed expansion to ~3,288 dots (procedural lexicons). 35 new mock supplier Actors added to the Directory beneath Bob\'s Sentinel-4 program; total now 52 (4 switchable primary + 12 existing mock + 35 new mock + Radiant Network). Heavy-tailed by design — 4 super-jumbo clusters (Helios 500, Atlas 450, Polaris 400, Vortex 350) carry ~50% of new dots.',
                  'Procedural Claim names: new `VERTICAL_LEXICONS` constant in v2_2Data.js (21 verticals, hand-defined) + new exported helper `generateClaimSpecsForVertical(actorParty, vertical, count)` produces deterministic `{family} {prefix}-{number} {docType}` names via `hashString(actorParty) → mulberry32(seed)` PRNG so the same `(actor, vertical, count)` tuple always yields identical specs across module reloads.',
                  'Per-actor disclosure-type mix `(i × 7 + seed) % 100` produces deterministic 60/25/15 indigo/amber/green spread per cluster (Helios verified: 300/125/75 of 500).',
                  'Counts: +3,288 Claims, +3,288 Assets, +13,152 DAs (3 internal own/ref + 1 public per Claim); 4 invariants verified via data-layer probe (per-actor claim, asset, DA counts; zero umbrella DAs from any new actor; every new public DA has grantee=Radiant Network + subject.kind=claim). Existing 12-actor + 4-primary seeds frozen. Lloyd\'s iteration cap bumped 10 → 20 in DirectoryLayer.jsx.',
                  'Brief vs. table discrepancy surfaced: brief headline says "3,328 new dots" but the dotCount column actually sums to 3,288; implementation matches the canonical table. Also added a "Connectors & Backshells" lexicon to fill the gap between Item 1 (row 20, zenith-components) and Item 2 (vertical lexicons table).',
                  'Known regressions (filed as 16.2.6.1 candidates): (a) four super-jumbo clusters overflow the sunflower placement loop — Voronoi cells too small for assigned dot counts at this scale; (b) Lloyd\'s residual still 101.4 wu at the bumped cap. Both surface via console.warn per the brief\'s "stop and surface, don\'t raise the cap unilaterally" rule.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.5.1', date: '2026-05-16', label: 'Phase 16.2.5.1', items: [
                  'Phase 16.2.5.1 — Smooth cluster dot geometry. One-line bump: cluster-dot `CircleGeometry` segment count 16 → 64 in `DirectoryLayer.jsx`.',
                  'With Phase 16.2.5\'s `DOT_RADIUS = 20.4` (7× pre-16.2.5\'s 3-wu dots), 16-sided dots were visibly polygonal at zoom > ~100%. 64 segments produces a perceptually smooth circle at every supported zoom up to MAX_ZOOM = 4.0.',
                  'Chose segment-bump over a shader-based quad-discard implementation for the simpler / lower-risk path: zero new shader code, zero behavior change in raycast / hover / per-instance color paths. Per-frame cost negligible at ≤ 10k dot scale.',
                  'RFP hollow circles (separate `makeHollowCircleGeometry` code path, 32 segments) untouched — follow-up if needed.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.5', date: '2026-05-16', label: 'Phase 16.2.5', items: [
                  'Phase 16.2.5 — Grid alignment + dot rendering hotfix. QA on Phase 16.2.4 surfaced two presentation issues: cluster dots didn\'t visually align with the background dot matrix, and dots were barely visible at the 15% default zoom (0.45 screen px diameter).',
                  '`DOT_GRID` 12 → 48 — reconciled to match the background grid\'s actual world-space spacing (`GRID_SPACING` was `4×DOT_GRID = 48`). Every sunflower-snapped cluster dot now lands on a background-grid intersection. `GRID_SPACING` redefined as `DOT_GRID` directly so the relationship is structural; background-grid origin snapped to a multiple of `GRID_SPACING` so grid points pass through `(0, 0)`.',
                  '`DOT_RADIUS` 3 → `DOT_GRID × 0.425` (≈20.4 wu) — dots now fill ~85% of their grid cell. At 15% zoom each dot is ~6 screen px (was 0.9 px). `SUNFLOWER_SCALE` 1.7 → 1.0 so Vogel arm spacing matches grid (one cell apart at the cluster surface). Combined effect: pixelated sunflower clusters that read as solid filled discs around the centered label hole.',
                  'Derived constants scale automatically: `LABEL_HOLE_W = 6×DOT_GRID = 288`, `LABEL_HOLE_H = 3×DOT_GRID = 144`, `INTER_CLUSTER_BUFFER = 2×DOT_GRID = 96`, `LLOYD_CONVERGENCE_DELTA = DOT_GRID = 48`.',
                  'Lloyd\'s convergence re-test: at the 12-actor seed, max displacement after 10 iterations is 193.8 wu (≈4× the new 48-wu threshold; was ≈16× the old 12-wu threshold). Per the brief, accepted with `console.warn` rather than unilaterally raising the cap — Phase 16.2.6\'s denser seed (~3k dots) is the canonical convergence test.',
                  'Brief Item 2 caveat surfaced: footprint actually grows ~2.4× because `DOT_GRID` scaled in lockstep with the SCALE drop, but net visual reads as denser since dot size grew 6.8× — intent preserved (clusters read as solid blobs at default zoom).',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.4', date: '2026-05-16', label: 'Phase 16.2.4', items: [
                  'Phase 16.2.4 — Directory galactic view v2 (Voronoi packing + sunflower clusters). Andrew\'s feedback on Phase 16.2.3: the polar Poisson disc fan-out left the canvas feeling sparse. Phase 16.2.4 rebuilds the Directory\'s spatial primitives end-to-end. Seed stays at the current 12-actor scale; Phase 16.2.5 will expand to ~3k dots.',
                  'Smaller canvas: 17280×11170 → 11520×7447 (16" MBP logical at 15% zoom). MIN_ZOOM and INITIAL_ZOOM both 0.15 (was 0.1). Active Actor anchor at (5760, 5957.6).',
                  'Lloyd-iterated centroidal Voronoi tessellation replaces polar Poisson disc. Active Actor\'s seed pinned at the anchor; other seeds at hash-derived deterministic positions. Cells target area ∝ dot_count_i / total_dots × canvas_area via `stepFactor = 0.5 + 0.5·tanh(area_error)`. Iteration cap 10.',
                  'Sunflower clusters (Vogel phyllotaxis) replace rectangular row/col grid. Each cluster\'s dots placed via `angle = i × GOLDEN_ANGLE; radius = sqrt(i + 0.5) × DOT_GRID × 1.7` around its Voronoi cell centroid, with a reserved 6×3 cell label hole at the center. Inter-cluster buffer of 2 × DOT_GRID enforced. Umbrella items placed first so they sit on inner spiral arcs.',
                  'Centered Actor label: PillboxLabel HTML overlay moved from above-grid to cluster center via `transform: translate(-50%, -50%)`. Three.js Actor-squares InstancedMesh rendered with `count=0` (mesh kept for lifecycle symmetry).',
                  'Umbrella outline path: convex hull of umbrella dots offset outward by 1 DOT_GRID via per-vertex bisector miter. Fallbacks: bounding circle (1 dot), stadium (2 dots). Amber stroke + 8% amber fill — reverts Phase 16.1.3 grey treatment per brief. Legacy L-shape construction removed.',
                  'Loading animation v2: `playDirectoryLoadAnimation` extended with `umbrellaOutlines` param + `setUmbrellaOpacity` callback. Outlines fade in alongside their cluster labels; `skip()` snaps everything to opacity 1.',
                  'd3-delaunay (^6.0.4) added as a project dependency.',
                  'Lloyd\'s convergence caveat: at the current 12-actor seed, max displacement after 10 iterations is ~194 wu (above the 12-wu threshold). Per brief, we accept those positions and emit a `console.warn` rather than unilaterally raising the cap. Phase 16.2.5 will re-test convergence on a denser dataset.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.3', date: '2026-05-13', label: 'Phase 16.2.3', items: [
                  'Phase 16.2.3 — Directory galactic view + loading animation. `DirectoryLayer.jsx` rewritten to use a bounded 17280×11170 design surface (matching 16" MBP logical resolution at 10% zoom) + radial polar Poisson disc fan-out + radial wave loading animation.',
                  'Galactic view: `MIN_ZOOM` 0.5 → 0.1; `INITIAL_ZOOM` set to 0.1. On every Directory entry (initial mount + role switch) the camera resets to `(canvas-center-x, canvas-center-y)` at zoom 0.1, showing the full 17280×11170 canvas in an MBP viewport. The active Actor\'s own cluster anchors at (8640, 8936) — canvas-bottom-center, 20% up from the bottom edge. Zoom-percentage display now maps directly: "10%", "100%", "400%".',
                  'Radial fan-out: each non-active cluster picks (θ, r) via Poisson disc sampling — θ ∈ [-75°, +75°] from straight up, r ∈ [2000, 8377.5] world units. Sort input by descending Claim count so jumbo clusters get first pick; up to 50 retries with seed-perturbed samples; collision check via the existing 12-cell buffer; canvas-bounds check. Replaces the Phase 16.2 deterministic-bbox-overlap loop.',
                  'Pan-bounds recompute per zoom: at zoom=0.1 bounds collapse to a single point (full canvas already fits); at higher zoom bounds open up so the user can traverse the canvas without revealing void beyond it. FIT recalculates zoom from the canvas bounds and centers camera on canvas-center.',
                  'Loading animation (new helper `src/v2/directoryLoadAnimation.js`): cluster dots fade in via a radial wave emanating from the anchor on every Directory entry. Per-dot `t_start = d / waveSpeed` (3000 wu/s); ramp opacity 0 → 1 over 200ms; labels fade in 100ms after the first dot in their cluster appears. Total duration ~3s. Click on empty canvas during animation calls `skip()` and snaps everything to 1.0; dot clicks open Detail Panel normally without skipping; pan/zoom run independently of the wave.',
                  '#196 (force-directed Directory layout) closed — superseded by the polar Poisson disc fan-out. Camera-init NaN guard added to handle the brief window during initial mount before layout. Phase 16.1.5 + 16.1.4 defensive settings intact.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.2', date: '2026-05-13', label: 'Phase 16.2.2', items: [
                  'Phase 16.2.2 — Parent canvas node spreading. Refactor of `buildV22Canvas` (the parent-canvas layout function) in `v2_2Data.js`. Eval Result / PoE chains no longer cluster next to or overlap the Claims they reference, and chains now coalesce into clean horizontal rows aligned to their grantee Asset.',
                  'Chain-row coalescing: each evaluation chain (one row per chain origin) y-anchors to its evaluator\'s `EA.granteeAssetId` Asset on canvas via a two-pass allocator — pass 1 gives the first chain at each anchor that anchor\'s exact y; pass 2 places subsequent chains at the nearest non-colliding y via symmetric outward search. Chain successors (re-runs) share their origin\'s y so a chain reads as a single horizontal row.',
                  'Increased grantee-direction x-gap: `COL_PULLED_CLAIM` bumped 2100 → 2400 (with downstream constants 2500 → 2800, 2900 → 3200, 2100 → 2400). Gap between rightmost chain node (owned PoE) and the pulled Claim is now 400 world units — comfortably above the ≥240 minimum. Previous 100-unit gap read as visual overlap.',
                  'PoE column order on grantor-direction views: `proofOfEvalPulledPoEs` moved from "between Claim and ER" (100-unit gap to Claim) to "right of ER", matching the Claim → ER → PoE → counterparty Asset column order. Proof-only-pulled PoEs now inherit y from their wrapped Eval Result on Dave-style views.',
                  'Architectural deviation surfaced (per the brief\'s escape clause): both of Bob\'s evaluations carry `granteeAssetId: bAvionics` in the seed, so strict per-chain alignment to distinct Assets isn\'t possible — the two-pass allocator stacks them symmetrically as a deterministic fallback. Zero node-overlap pairs verified across all four role views.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.1', date: '2026-05-13', label: 'Phase 16.2.1', items: [
                  'Phase 16.2.1 — Hotfix: `aVregTestReport` ownership DA restored. Phase 15.4 promoted the Asset to an unattached "floating" entry that Alice attaches to her VReg Claim during the Re-Run demo prereq, but omitted the Actor → Asset ownership DA. Without it the Asset rendered floating on Alice\'s parent canvas with no Full Disclosure edge to the MicroCo Actor card.',
                  'Fix: single-line addition of `aVregTestReport` to the `aliceOwnAssets` array in `buildV22SharedArtifacts`. The standard `aliceOwnAssets.map` factory produces one new internal DA — `da-own-asset-vreg-test-report` (grantor + grantee both MicroCo, subject `{kind:"asset", id: aVregTestReport.id}`, type: "full"). Disclosure-agreements grows by exactly 1 (720 → 721).',
                  'Re-Run demo prereq flow unchanged. Ownership and Claim-reference are orthogonal in the V2.2 data model — Alice still amends VReg Claim to add `aVregTestReport` as a referenced Asset later; `hasNewAssetsForRerun` from Phase 13.3 still fires correctly.',
                  'Footer stays at v0.16.2.0 per backtrack-hotfix convention.',
                ]},
                { version: '0.16.2.0', date: '2026-05-13', label: 'Phase 16.2', items: [
                  'Phase 16.2 — Directory Layer seed expansion. Opens Round 17. The Directory now hosts 12 new mock supplier Actors representing the defense-electronics supply chain under Bob\'s Sentinel-4 satellite program: NovaFab (25 Claims), ElectroGrid (24), Precision Components (18), AvionicSys (17), Substrate Dynamics (16), Helix RF (11), Optech Sensors (10), SolarVantage (10), ThermaCore (9), CompoStruct (9), Photonix (4), Cryotek (4). Total: 157 new Claims, 157 stub Assets, and 628 internal + public Disclosure Agreements (1 own-asset + 1 own-claim + 1 claim-ref-asset + 1 public per Claim).',
                  'Every new Actor is non-switchable (`user: null`, `credits: 0`) and discloses exclusively to the Radiant Network — no umbrella DAs to any of the four primary actors. The four existing actor seeds (Bob/GovCo, Alice/MicroCo, Carol/AuditCo, Dave/ChipCo) are frozen for this phase; none of their Claims, Assets, DAs, EAs, RFPs, PoEs, Eval Results, or Parse Results were modified.',
                  'New exported helper `seedMockSupplierActor({ id, party, vertical, claimSpecs, baseDate })` in `v2_2Data.js` produces an Actor + Claims + 1 stub Asset per Claim + ownership DAs + public DAs in one call. A companion `pickDirectoryType(i, total)` interleaver assigns disclosure types per Claim to target ~60% full / 25% selective / 15% proofonly so every cluster paints a visible indigo + amber + green mix (with a forced fixed pattern for n ≤ 4 to keep Photonix and Cryotek non-monotone).',
                  'DirectoryLayer placement-scaling patch: the initial cluster x-spread band scales with cluster count `N` (`xSpread = Math.max(800, 600 × (N − 1))`) instead of the previous hardcoded 800-px band. With 14 non-own clusters on Bob\'s view, the initial band is ~7800 px — comfortably enough that the 30-attempt up-zigzag retry no longer needs to compensate. Force-directed layout (#196) remains deferred.',
                  'Footer rolls forward to v0.16.2.0.',
                ]},
                { version: '0.16.1.5', date: '2026-05-10', label: 'Phase 16.1.5', items: [
                  'Phase 16.1.5 — Hotfix. Two QA issues surfaced in 16.1.4, both downstream of the lifecycle change: (1) dots disappeared at zoom > ~60%; (2) dot clicks no longer opened the Detail Panel.',
                  'Root cause for both — `InstancedMesh.boundingSphere` is auto-computed from the underlying geometry vertices, which sit at world origin because instance positions live in per-instance matrices, not the geometry. The first computed sphere ended up tiny (radius = `DOT_RADIUS = 3`, centred at origin) and was cached on the mesh. The rendering frustum check (`Frustum.intersectsObject`) and the raycast pre-filter (`InstancedMesh.raycast` → `raycaster.ray.intersectsSphere(_sphere)`) both consult this cached sphere — the tiny origin-sphere fell outside the camera frustum at high zoom and outside the click ray at any zoom, so the entire mesh was rejected before per-instance work ran. Phase 16.1.4 stabilized the scene lifecycle but didn\'t touch the bounding-sphere caching, so both symptoms surfaced once the lifecycle stopped masking them.',
                  'Fix: on each InstancedMesh (dots + Actor squares + RFP), set `frustumCulled = false` and override `boundingSphere = new THREE.Sphere(origin, Infinity)`. The first opts out of the renderer frustum check entirely (no perceptible perf cost at our scale). The second forces the raycast pre-filter to always pass; per-instance raycast then runs correctly against the proper per-instance bounding spheres at the `Mesh.raycast` level.',
                  'The brief\'s alternate Item 2 diagnosis (\"closure staleness in event listeners attached in the scene-init effect\") did not match the actual code — mouse handlers in DirectoryLayer.jsx are React JSX event props bound via `useCallback` with full deps, not `addEventListener` calls inside a long-lived effect. No handler refactor was required; the bounding-sphere fix addressed the click symptom directly via the shared raycast pre-filter.',
                  'Verified: dots render at zoom factor 4.0 (UI 100%) when the camera is positioned on a cluster (verified by wheel-zoom-on-cluster and by directly setting camera world position to a known cluster centre). Click on a dot opens the Detail Panel with the correct Claim content + pans the camera to centre the clicked dot. Click works after role switch (Bob → Alice → Alice\'s view of Power Regulation Module Assembly with AMEND CLAIM button visible). Click works after close + reopen.',
                  'Footer rolls forward to v0.16.1.5.',
                ]},
                { version: '0.16.1.4', date: '2026-05-10', label: 'Phase 16.1.4', items: [
                  'Phase 16.1.4 — Hotfix. Directory layer dot rendering regression from Phase 16.1.3 resolved.',
                  'Root cause: the scene-init `useEffect` declared `phase` in its dependency array, so its cleanup fired on every internal phase transition (opening → in, in → out), not only on full close. The cleanup disposed the populated `InstancedMesh` + renderer mid-flight; the body re-ran and created a fresh empty mesh (`count = 0`). The downstream `useLayoutEffect` that repopulates dots had deps `[threeReady, layout]` — those deps did not register a change because React batched the `setThreeReady(false)` in cleanup with the `setThreeReady(true)` in the new body into a single update whose net value was unchanged. Result: an empty mesh in the scene + no repopulation = blank canvas.',
                  'Fix: derive a stable `shouldMountScene = phase !== \'closed\'` boolean and depend on that instead of `phase`. The scene-init effect now runs setup only on the `closed → non-closed` boundary and cleanup only on `non-closed → closed`. Internal phase transitions (opening → in → out) no longer tear down and rebuild the scene.',
                  'Verified: dots render reliably on hard reload + first open, across 10 open/close cycles, and across 5 rapid-succession toggles in 3 seconds. Cluster color variety (indigo + amber + green) restored. Role switching, wheel zoom, and the wipe-in/wipe-out animations all unaffected.',
                  'Footer rolls forward to v0.16.1.4.',
                ]},
                { version: '0.16.1.3', date: '2026-05-09', label: 'Phase 16.1.3', items: [
                  'Phase 16.1.3 — Directory Layer parent-parity fixes + color scheme realignment. Nine items.',
                  'Item 1: first-transition dot lifecycle hardened. InstancedMesh population moved to `useLayoutEffect` (runs synchronously after DOM mutations, before paint). Transition-end listener on the wipe container forces a render after the clip-path animation completes. Combined with the existing sync-render-after-attach, dots paint reliably on hard reload + first open, across rapid open/close cycles, and after zoom interactions.',
                  'Item 2: Actor square migrated from `LineSegments` to `Mesh` with `ShapeGeometry` (outer 6×6 square + inner 4×4 hole). Border thickness now scales with camera zoom — at 4× zoom, borders are visibly thicker; at 0.5× zoom, thinner. Matches Item 9 RFP pattern.',
                  'Item 3: Actor square cell is reserved in the cluster grid before umbrella/public/RFP placement. No more node overlaps (MicroCo\'s Actor square no longer sits atop a Claim dot).',
                  'Item 4: zoom controls vertical position bumped to `top: 73` (was 12), aligned with parent layer\'s apparent position below the 61px chrome bar.',
                  'Item 5: Directory Detail Panel `bottom: 0 → 28` so the panel ends ABOVE the app footer. The "REQUEST EVALUATION AGREEMENT" button is now fully visible.',
                  'Item 6: clicking a Claim dot animates the camera to center the dot in the visible area, with panel-aware offset (target X shifted right by PANEL_W/2 in world units) so the dot lands at the visible-area horizontal center, not under the Detail Panel. Mirrors V2Canvas\'s `animatedPanToWithZoom` pattern with the same easing.',
                  'Item 7: closing the Request Evaluation Agreement modal now keeps the user on Directory + Detail Panel. Previously the modal\'s open handler called `setV22DirectoryOpen(false)` + cleared the selected Claim; both removed so Directory + panel persist across modal open/close.',
                  'Item 8: dot colors now map to disclosure TYPE (full → indigo, selective → amber, proof-only → green), matching the parent-layer LegendBar\'s edge-color semantics. Umbrella DA takes precedence over public DA when both exist. Seed types diversified: Alice\'s `da-pub-emi` flipped to `proofonly`; ChipCo\'s `da-pub-chipco-timing-ic` + `da-pub-chipco-mixedsig` flipped to `proofonly`; ChipCo→Bob umbrella DAs for OpAmp flipped to `selective` + FlashMem flipped to `proofonly`. L-shape boundary around the umbrella subset changed from amber to neutral grey (amber is now reserved for selective disclosure semantics).',
                  'Item 9: RFP visual switched from filled green dot to a hollow circle (cyan, `var(--accent-cyan)`). Rendered as `THREE.Mesh` with `ShapeGeometry` (outer circle + inner hole), so the border thickness scales with camera zoom. Bob\'s seeded RFP green dot is replaced by this new cyan hollow circle.',
                  'Footer rolls forward to v0.16.1.3.',
                ]},
                { version: '0.16.1.2', date: '2026-05-09', label: 'Phase 16.1.2', items: [
                  'Phase 16.1.2 — Directory Layer spatial model rewrite + bug fixes. Eight items.',
                  'Item 1: corner card removed from Directory. The user\'s own representation is now a regular cluster, no longer a viewport-fixed HTML overlay.',
                  'Item 2: user\'s own cluster (Actor square + Claims + RFPs) positioned at canvas-horizontal-center + bottom-third vertically on initial load. Anonymous actors (Carol/AuditCo) render no own cluster — bottom-third is just a virtual layout anchor for fan-out. New `isUserVisible` flag on `buildV22DirectoryDataForRole` return.',
                  'Item 3: Actor squares migrated from HTML divs to Three.js `LineSegments` so they scale with camera zoom identically to dots. Pillbox labels remain HTML overlays projected via worldToScreen (text stays readable at all zooms).',
                  'Item 4: all edges dropped from Directory. The umbrella DA SVG cubic Bezier from corner card to ChipCo\'s square is gone (corner card is gone too). Amber L-shape border + tint around umbrella subset stays — that\'s a cluster-internal decoration, not an edge.',
                  'Item 5: 12-cell minimum buffer between user\'s own cluster and others, and between any two non-user clusters. Bbox-based deterministic placement; force-directed layout deferred to a future phase (#196 filed).',
                  'Item 6: first-transition dot lifecycle bug fixed. InstancedMesh now created once with generous capacity (64 instances initial); subsequent layout changes update via `setMatrixAt` + `setColorAt` + `mesh.count = desiredCount` without recreating the mesh. Stable across 5+ open/close cycles.',
                  'Item 7: parent-layer node + edge hover + selected state cleared on Directory transition (was wired in 16.1.1 but the doc claim was overstated; verified comprehensive in this phase).',
                  'Item 8: zoom controls top-right (+/-/FIT vertical stack with percentage display, matching parent-layer pattern). Old bottom-right `zoom 1.50x` indicator removed.',
                  'Footer rolls forward to v0.16.1.2.',
                ]},
                { version: '0.16.1.1', date: '2026-05-09', label: 'Phase 16.1.1', items: [
                  'Phase 16.1.1 — Three.js Directory Layer hotfix (eleven QA fixes from Phase 16.1.0).',
                  'Item 1: Zoom wheel handler now functional. Effect dep array gained `phase` so the wheel listener re-binds when the layer mounts (previously the listener was never attached because `containerRef.current` was null at first effect run).',
                  'Item 2: Zoom indicator lifted to `bottom: 56` so it clears the v0.16.1.x app footer.',
                  'Item 3: First-transition dot rendering race fixed — sync `renderer.render(scene, camera)` after the InstancedMesh attaches, so dots appear on the very first frame after Directory opens.',
                  'Item 4: Removed the `+DOT_GRID/2` offset from dot world-coord computation. Cluster dot centers now sit ON background grid points, not between them.',
                  'Item 5: Parent-layer edge tooltip cleared on Directory open. New `clearHoverState` imperative method on V2Canvas via useImperativeHandle; V2App invokes it from both Directory entry points (chrome globe button + Radiant Network actor double-click).',
                  'Item 6: Amber L-shape border + tinted-bg fill restored as an SVG overlay projected per-frame via worldToScreen. Boundary path computed from umbrella cells with CLUSTER_PAD breathing room.',
                  'Item 7: Tooltip card 4th row (`UMBRELLA · date` / `PUBLIC · date`) removed — tooltip is now badge + name + owner only.',
                  'Item 8: 1-cell buffer in all four directions around the umbrella subset (was just the inter-subset gap on the same row). New `layoutClusterCells` helper places umbrella starting at row 1 (top buffer), computes orthogonal-adjacent buffer cells, then fills public via row-major scan skipping umbrella + buffer.',
                  'Item 10: Corner card bottom margin = left margin (32) + footer height (~28) = 60. Card-to-footer spacing now matches card-to-viewport-left spacing.',
                  'Item 11: Own RFP green dot box-shadow halo removed. The 6×6 dot itself was already correct; the halo visually inflated perceived size.',
                  'Item 12: Cluster vertically centered on the Actor square. anchorY = squareY - ((maxRow + minRow) / 2) * ROW_GAP. ChipCo`s 4-row cluster (with row 0 buffer + rows 1-3 dots) places the square cleanly in the inter-row gap between rows 1 and 2.',
                  'Footer rolled forward to v0.16.1.1 per the corrected versioning convention (forward phases roll the footer).',
                ]},
                { version: '0.16.1.0', date: '2026-05-08', label: 'Phase 16.1.0', items: [
                  'Phase 16.1.0 — Three.js migration for Directory Layer. Dot matrix grid + Claim/RFP dots migrated to Three.js (Points + InstancedMesh, single draw call across all dots); pan (drag) + zoom (wheel) controls added matching the parent-layer canvas. HTML overlays (tooltip card, label pillboxes, Actor squares, SVG umbrella edges) project via worldToScreen and track camera moves via the same RAF loop that drives Three.js renders.',
                  'Footer version convention corrected — backtrack-hotfix exception removed; forward phases now roll the footer constant forward. Footer reads v0.16.1.0 (was frozen at v0.15.9 across the 16.0.x backtrack-hotfix cycle).',
                  'Bug fix — one-grid-cell buffer between amber (umbrella) and indigo (public) dots within a cluster. Phase 16.0.3 introduced the buffer in the HTML implementation; the migration preserves it in world-coordinate computation (lastUmbrella.col + 2 starting position for public subset).',
                  'Bug fix — strict grid alignment for all Claim and RFP dots. World coordinates are integer multiples of the DOT_GRID = 12 stride; the background grid Points use the same spacing so dot centers and grid intersections coincide automatically.',
                ]},
                { version: '0.16.0.3', date: '2026-05-08', label: 'Phase 16.0.3', items: [
                  'Fix 16.0.1 leftover — "RADIANT NETWORK" header pillbox repositioned below the top chrome bar so it actually renders.',
                  'Umbrella DA edge from corner card to Actor square now renders as a smooth horizontal-exit / horizontal-entry cubic bezier curve, matching the visual character of parent-layer full-disclosure edges.',
                  'One-dot-width buffer between amber (umbrella-private) and indigo (public) dot subsets within a cluster, so the L-shaped amber border has visual breathing room from the public dots.',
                  'Hover tooltip card mirrors the parent-layer AssetNodeDot pattern — CLAIM badge tight to the top of the card (no excess padding), tooltip anchored to the dot\'s right-center (not top-left), with a viewport-edge flip if the tooltip would overflow.',
                  'App footer (Connected to AWS S3 · v0.15.9 · Changelog) restored on the Directory view via z-index promotion to 300 (same as top chrome).',
                  'Strict dot-matrix grid alignment enforced for all dots, Actor squares, RFP placeholders, and label pillboxes via a `DOT_GRID = 12` constant. Setup for Phase 16.1\'s scaling pass.',
                ]},
                { version: '0.16.0.2', date: '2026-05-08', label: 'Phase 16.0.2', items: [
                  'PDF.js worker resolution fix — switched from Vite `?url` import to a static `public/pdf.worker.mjs` path. Root cause: when the dev server runs from a git worktree with an empty `node_modules`, the `?url` import resolves to `/@fs/<absolute>/node_modules/...` outside Vite\'s `server.fs.allow` boundary, producing a 404 + "Setting up fake worker failed" runtime error. The static `/pdf.worker.mjs` path is served directly from project root in dev AND production. Manual upgrade step: re-copy `node_modules/pdfjs-dist/build/pdf.worker.mjs` to `public/` after `pdfjs-dist` updates.',
                  'Duplicate React key warning fix — Changelog modal entry iteration keyed on `release.version` alone, but multiple historical phases share the same version string (e.g. v0.10.0 covers 8 entries). Switched to composite key `${release.version}-${release.label}`.',
                  'Documentation cleanup — Phase 11B-era "materialized directory Claim" comment block on the Detail Panel mount IIFE updated to reflect Phase 16.0\'s per-dot click flow. The leftover `v22DirectoryMaterializedClaim` references reported in the brief were already cleared during the Phase 16.0 ship; only a comment-level historical reference remains.',
                ]},
                { version: '0.16.0.1', date: '2026-05-08', label: 'Phase 16.0.1', items: [
                  'Directory Layer layout polish — header banner replaced with a centered "Radiant Network" pillbox; "2 clusters · 17 Claims" subtitle removed; in-canvas "Launch AI Shopper" button removed (chrome bar entry remains).',
                  'Claim dots resized from 8×8 to 6×6. Cluster layout switched to row-aligned grid (max 6 dots per row, dot-matrix-grid-aligned with one-dot-width gaps). ChipCo\'s 14 dots from Bob\'s view now render as 6+6+2 rows; the umbrella subset (first 7 dots) is wrapped in an L-shaped amber border.',
                  'Actor squares reduced to dot size (6×6 hollow) with party labels lifted to pillbox-styled labels above each square. Pillboxes fade when an underlying dot is hovered, letting the dot glow white in the foreground.',
                  'Cluster anchors moved to vertical center of canvas; Bob\'s RFP green dot anchored directly above his corner card.',
                ]},
                { version: '0.16.0', date: '2026-05-08', label: 'Phase 16.0', items: [
                  'Phase 16.0 — Directory Layer foundations. Replaces the Phase 7 / 11A / 11B Directory scaffolding with a new visual model: dot matrix background, per-Actor clusters with hollow indigo Actor squares at center, deterministic seeded layout, per-role view filtering. Mock supplier clusters (NovaFab, ElectroGrid, Precision Components) and the standalone ChipCo cluster removed.',
                  '#43 — Clickable Directory Layer dots. Each Claim dot is hoverable (whitens on direct hover, cluster brightens) and clickable (pins a tooltip + opens the Detail Panel). RFP dots render as non-functional placeholders; activate in Phase 17.',
                  '#45 — Real dot-cloud data sourcing. Cluster contents derive from per-role disclosure visibility via the new `buildV22DirectoryDataForRole` helper. Bob sees Dave\'s catalog through the umbrella DA (mix of amber umbrella-private dots + indigo public dots, with an amber-bordered region around the umbrella subset and an indigo umbrella edge from his corner card to Dave\'s Actor square). Alice and Carol see only public Claims; Dave sees his own catalog as indigo.',
                  'Seed expansion — Dave/ChipCo grows from 2 Claims to 14, mixing publicly disclosed and umbrella-private DAs to demonstrate the per-role view computation.',
                  'RFP factory placeholder — `makeRfp(...)` factory introduced; one Bob-owned RFP seeded for Phase 17 buildout (Sentinel-4 RF Module Compliance, MIL-PRF-55681 v2 + System Integration Requirements).',
                  'Architecture spec §8.2 + §8.5 rewritten to match the new model.',
                ]},
                { version: '0.15.9', date: '2026-05-07', label: 'Phase 15.6', items: [
                  '#172 closing scope: Re-Run auto-fill from new Asset evidence. The PDF annotation demo arc is now end-to-end happy-path — prior eval shows gaps → Alice amends with Test Report → Bob\'s re-run auto-populates the missing rows with values discovered from the new evidence → save → 7/7 SAT → create PoE. The narrative becomes "AI evaluation reads new evidence and fills in the gaps" rather than "user manually fills forms."',
                  'Schema addition: anchor entries gain an optional `discoveredValue: string` field. When the Asset hosting the anchor becomes newly in scope (via amend) and the corresponding result row is MISSING, re-run carry-forward auto-populates the row with `discoveredValue` and flips status to `satisfactory`. No badge, hint, or status indicator distinguishes auto-populated rows — by design (transparent AI assistance).',
                  'Auto-fill scope: triggered ONLY in re-run mode (`priorActiveResult` exists), ONLY for rows where prior status === `missing` AND the row has at least one anchor whose `sourceAssetId` is in the current Claim\'s in-scope evidence (`evidenceAssets`) AND NOT in the prior eval\'s `evidenceUsed` AND has a non-empty `discoveredValue`. Existing SAT/UNSAT/N/A rows are never overwritten. Fresh evaluations (no `priorActiveResult`) are unaffected.',
                  'Implementation site: `V22RunEvaluationModal.buildRowsForRs()` carries prior result rows into the working state via `priorRows.map(...)`. Phase 15.6 adds `autoFillRow(row)` closure that intercepts each row and applies the transformation when criteria are met. The transformation builds a derived row array — `priorActiveResult.results` in seed/global state is NOT mutated. `_aiOriginalValue` snapshots the discovered value too, so the human-edited pencil icon doesn\'t trigger spuriously when the auto-populated value lands.',
                  'VReg seed updated: req-006 (SEL immunity) anchor gains `discoveredValue: "> 75 MeV·cm²/mg LET threshold"`; req-007 (Burn-in qualification) anchor gains `discoveredValue: "168 hours at 125°C · 0/100 failures"`. Both values match the Test Report PDF\'s on-page text so visual coherence between PDF annotation and right-panel value is preserved when the row auto-populates. The `makeEvaluationResult` factory\'s anchor projection uses spread (`{ ...a }`) so the new field passes through without further changes.',
                  'Walkthrough doc Section 5b updated to reflect auto-fill — Step 2 expected outcome now shows all 7 rows as SATISFACTORY (was 5 SAT + 2 MISSING-ready-to-review); the explicit "Bob updates the missing rows" sub-section retired (no manual edit required for the happy-path demo). Note added that auto-populated rows can still be manually overridden if the demoer wants to demonstrate that path.',
                  '#172 closed. Phase 15 arc complete: 15.0 (PDF.js + seed PDFs + static dots), 15.0.1 (hotfix + multi-Asset switcher), 15.1 (visual redesign + bidirectional interaction), 15.1.1 (numbering + shape + layout reorg), 15.1.2 (modal consolidation), 15.2 (Download fix + walkthrough + cleanup), 15.3 (demo enhancement + EVIDENCE rename), 15.4 (correction), 15.5 (simplification), 15.6 (auto-fill closes the arc).',
                ]},
                { version: '0.15.8', date: '2026-05-07', label: 'Phase 15.5', items: [
                  'VReg Re-Run demo simplified into a coherent narrative arc: prior eval shows 5 SAT + 2 MISSING criteria → Alice amends with Test Report → Bob\'s re-run "discovers" values for the missing rows in the new evidence → save → 7/7 SAT → create PoE.',
                  'VReg Eval Result chain (V0/V1/V_main from Phase 13.2) collapsed to a single standalone Eval Result. The chain contradicted the "Bob\'s first evaluation" framing the new demo arc needs. `erBobVregV0` and `erBobVregV1` definitions removed; supersession patches removed; `evaluationResults` registry trimmed; chain DAs (`daProofBobVregV0/V1`, `daOwnEvalBobVregV0/V1`) removed; `disclosureAgreements` registry trimmed; Phase 13.2 chain comment removed (Carol\'s EMI Eval Result is unwrapped + standalone, so the chain-DA pattern is no longer exercised by the current seed).',
                  'New criteria added to MIL-PRF-55681 v1: req-006 (Single Event Latch-up immunity) and req-007 (Burn-in qualification). Both are MISSING in the prior eval (Datasheet doesn\'t cover them) with anchors pre-stamped on the Test Report — Phase 15.5 demo trick narrowed to req-006/007 only (was req-001-005 in 15.4). The 5 SAT rows reference Datasheet exclusively.',
                  'req-004 value updated from "TID > 100 krad(Si)" to "TID ~ 80 krad(Si)" (status stays SAT). Matches the Datasheet PDF\'s on-page text; the prototype RS doesn\'t encode threshold logic so the SAT status is a label-only outcome.',
                  'Test Report PDF rewritten: 1 page, 2 sections (SEL Immunity + Burn-in Qualification), 2 anchored values (`> 75 MeV·cm²/mg LET threshold` and `168 hours at 125°C · 0/100 failures`). Replaces the Phase 15.3/15.4 Test Report which had redundant req-001-005 sections that duplicated the Datasheet. evidenceAnchors.js auto-regenerated — PDF_ANCHORS["microco-vreg-test-report.pdf"] now contains only req-006 + req-007 entries.',
                  'Walkthrough doc Section 3 (Scenario 2) rewritten as "VReg Eval Result with missing criteria" — single Eval Result, 5 SAT + 2 MISSING. Section 5 (Scenario 4) rewritten as "find missing criteria from new evidence" with explicit Bob-updates-the-missing-rows-then-saves narrative leading to 7/7 SAT and PoE creation. At-a-glance scenario table updated.',
                ]},
                { version: '0.15.7', date: '2026-05-07', label: 'Phase 15.4', items: [
                  'Re-Run demo seed corrected. Phase 15.3 over-eagerly attached the Test Report Asset to the VReg Claim from initial seed AND added a separate Compliance Notes Asset for the amend prerequisite — that conflated the demo goals (VReg Expand modal stayed multi-Asset; the amend prereq used a different Asset; PRM was supposed to be the canonical multi-Asset Expand surface). Phase 15.4 reverts: VReg Claim initial seed back to single-Asset (Datasheet only); VReg Eval Result Expand modal shows Asset 1 of 1 again. PRM remains the canonical multi-Asset Expand modal demo path.',
                  'Compliance Notes Asset retired entirely. The amend prereq uses Test Report directly — Alice attaches the Test Report (now the single floating VReg Asset in her inventory) which both satisfies the `hasNewAssetsForRerun` gate AND, via a deliberate seed demo trick, displays annotation markers in Bob\'s subsequent re-run accordion.',
                  'Demo trick: erBobVreg chain-head\'s `evidenceUsed` reverts to single-Asset (Datasheet only — what was actually evaluated at chain-head time), but its `evidenceAnchors[]` arrays intentionally retain references to BOTH Datasheet and Test Report. In production this would be a data inconsistency (anchors shouldn\'t reference Assets outside `evidenceUsed`); for prototype demo purposes the inconsistency is accepted because it enables the amend-then-rerun-with-annotations demo path. Inline comment block in `v2_2Data.js` flags the trick; CLAUDE-phase-log.md Phase 15.4 notes document the rationale.',
                  '`daAliceToBobVreg` Disclosure Agreement scope reverts to single-Asset (Datasheet only) — Alice extends the DA scope as part of the same amend prereq step that attaches the Test Report.',
                  'PDF generator script: `microco-vreg-compliance-notes.pdf` spec entry retired (paragraphs[] page-spec affordance preserved on the generator for future documentation-style PDFs). The PDF file deleted from `public/seed-pdfs/`. evidenceAnchors.js regenerated without the Compliance Notes entry.',
                  'PDF value parity verified: microco-vreg-test-report.pdf already shipped Phase 15.3 with `TID > 100 krad(Si)` for req-004 (matches the chain-head\'s SAT value). The Phase 15.4 brief flagged a "TID ~ 80 krad(Si)" mismatch — that string lives only in the VReg Datasheet PDF (which represents the published spec) and the V1 superseded Eval Result\'s value (which the evaluator originally measured before re-running). The chain-head Eval Result and the Test Report PDF are at parity.',
                  'Walkthrough doc Section 2 reverts to single-Asset VReg Expand. Section 5a names "Voltage Regulator IC Test Report" as the amend candidate with the demo-trick rationale. Section 5b describes a 2-Asset accordion (Datasheet + Test Report, both annotated). Compliance Notes references removed throughout.',
                ]},
                { version: '0.15.6', date: '2026-05-07', label: 'Phase 15.3', items: [
                  'Re-Run flow demo enhanced — VReg Claim now seeded with TWO pre-existing Assets (Datasheet + Test Report), both anchored against the chain-head Eval Result so opening the Re-Run flow shows annotations across multiple pre-existing PDFs instead of just one. The chain-head erBobVreg now carries `evidenceAnchors: [datasheet, testreport]` (2 entries per row) for all five MIL-PRF-55681 v1 requirements; values authored to match the seed exactly so PDF text and seed values stay in sync.',
                  'Phase 15.0 PDF generator script extended with a third PDF spec (`microco-vreg-test-report.pdf`) plus a new optional `paragraphs[]` page-spec field for documentation Assets that don\'t host anchored requirements. `evidenceAnchors.js` regenerates with anchors for the test report\'s req-001 through req-005.',
                  'New "Voltage Regulator IC Compliance Notes" Asset (`asset-vreg-compliance-notes`, generated PDF `microco-vreg-compliance-notes.pdf`) pre-seeded as Alice\'s owned-but-unattached Asset specifically for the Re-Run amend prerequisite step. Phase 15.2 left Alice\'s prereq as "add any new Asset"; Phase 15.3 names the candidate so the demo path is deterministic. The Compliance Notes Asset is a paragraph-only PDF (no anchors) — when Alice attaches it during the prerequisite step, Bob\'s subsequent Re-Run accordion shows three Assets total (datasheet + test report annotated, compliance notes blank).',
                  'EVIDENCE → ASSETS rename in the Δ delta info box at the top of the Re-Evaluation flow review surface (V22RunEvaluationModal). This was the missed surface from the Phase 15.1.2 EVIDENCE → ASSET sweep; "Δ EVIDENCE" was the only remaining title-bar-style EVIDENCE token in user-facing copy. The `evidence` AssetNode subtype label config (`SUBTYPE_CFG.evidence.label`) was kept as-is — it labels a node-card subtype not a modal title bar, and no seeded Asset uses that subtype so the string never renders in the live app.',
                  'Walkthrough doc `docs/PHASE-15-DEMO-SCENARIOS.md` updated — Section 2 (VReg Eval Result Expand) now documents multi-Asset switcher behavior (was single-Asset through 15.2); Section 5a names the Compliance Notes Asset as the canonical amend prerequisite candidate with explanation; Section 5b\'s expected-outcome bullet describes the three-Asset accordion (Datasheet + Test Report annotated, Compliance Notes blank).',
                  'Disclosure Agreement scope expanded — `daAliceToBobVreg` scope now includes both VReg Datasheet and Test Report Asset IDs so Bob\'s canvas surfaces both pre-existing Assets under full disclosure (mirrors `cVreg.referencedAssetIds`). The Compliance Notes Asset is added to the DA scope dynamically by Alice during the amend prerequisite step.',
                ]},
                { version: '0.15.5', date: '2026-05-07', label: 'Phase 15.2', items: [
                  '#172 part 3 of 3: closes the PDF annotation arc. Three deliverables — Download icon button onClick + Tooltip wired, walkthrough guide expanded, legacy /public PDF cleanup.',
                  'Download icon button — Phase 15.1.2 shipped the icon disabled because the spec premise (a pre-existing Phase 13.4 onClick handler ready to bind) was wrong; the original `<DownloadButton>` placeholder has always been disabled with `title="Export coming soon."`. Phase 15.2 introduces the first working Download in the eval-output / poe surfaces. `<DownloadIconButton>` accepts an optional `onClick` prop (drops `disabled` when provided, switches to indigo hover styling); `EvalResultOutputBody` wires `handleDownloadJson` (Blob from `getEvalResultJsonRecord` → transient `<a download="eval-result-<id>.json">` click → revokeObjectURL on next tick). Native `title` attribute replaced by the shared `<Tooltip>` primitive — tooltip text "Download Evaluation Results JSON", `position="auto"` so it lands above the icon and flips below when viewport space is tight. PoE Expand modal Section 1 inherits the working Download via the shared `<EvalResultOutputBody>`.',
                  '`docs/PHASE-15-DEMO-SCENARIOS.md` rewritten from Phase 15.0.1 skeleton into a complete six-section walkthrough — Overview (with at-a-glance scenario table + prerequisites), Scenarios 1–4 (each with Role, Setup, Navigation, Expected outcome, Try the interactions), and Notes for QA + demos. The Re-Run prerequisite (Alice amends the VReg Claim before Bob\'s re-run, gated by `hasNewAssetsForRerun` from Phase 13.3) is documented as Section 5a with explicit role-switch steps and the gate explanation.',
                  'Legacy `/public/*.pdf` cleanup — 5 unreferenced files removed: connectorassembly-datasheet, pcbsubstrate-datasheet, powerregulationmodule-datasheet, thermalinterfacepad-datasheet, voltageregulator-datasheet. 4 still-referenced legacy PDFs retained (emishielding, prm-3a-ic-datasheet, prm-3a-ic-qualification-report, voltage-reference-ic-datasheet) — surfaced as a Phase 15.3 candidate to migrate to MicroCo seed-pdfs/ flow OR trim from seed; removing them would silently break their Asset previews.',
                  '#172 closed. Phase 15 arc complete across parts 1 (15.0), 2 (15.1 + polish: 15.0.1, 15.1.1, 15.1.2), and 3 (15.2). Next cycle: backlog hygiene then transition to a fresh thread.',
                ]},
                { version: '0.15.4', date: '2026-05-07', label: 'Phase 15.1.2', items: [
                  'Eval Result + PoE Expand modal Output tab consolidation. Timestamp + party metadata moved into the canonical modal header next to the title — Eval Result shows "Evaluated: [date] · Evaluator: [party]"; PoE shows "Created: [date] · Owner: [party]". Reclaims the vertical space the thin header band previously consumed inside the scrolling Output tab body.',
                  'Download button promoted into the right-panel "EVALUATION RESULTS" title bar as a 24×24 icon button at the right edge (download glyph + tooltip "Download Evaluation Results JSON"). The healthbar block now hosts the aggregate count + 3-segment SAT/UNSAT/MISSING minibar only.',
                  'File info repositioning — left-panel scroll content now renders [ASSET title bar] → [file viewer (PDF.js or iframe)] → [combined 6-row metadata block: Filename, Size, MIME, Hash, Owner, Registered]. Owner + Registered moved up from a tertiary footer into the same metadata card. Other AssetEvidencePanel consumers (Asset Detail Panel preview, Claim referenced-asset preview) keep the legacy ordering.',
                  'EVIDENCE → ASSET rename in the left-panel title bar of eval-output + poe Output tabs. Amber accent color unchanged; only the badge text. ASSET is the canonical noun across the prototype data model; EVIDENCE was a Phase 12.4 holdover.',
                  'PoE Output tab cleanup — full-width PROOF OF EVALUATION info box at the top removed (PoE name + Created + Owner already render in the canonical modal header). "Final Evaluation" SectionHeading also dropped — the wrapped Eval Result\'s own EVALUATION RESULTS title bar makes the context unambiguous. PoE Output tab body becomes structurally identical to Eval Result Output tab body, just with the modal header showing PoE metadata instead.',
                  'AssetEvidencePanel refactored — exposes new `AssetFileViewer` + `AssetFileMetadata` exports for consumers that need to rearrange viewer + metadata. `AssetEvidenceViewer` default export composes them in the legacy order so every existing call site is unaffected.',
                ]},
                { version: '0.15.3', date: '2026-05-07', label: 'Phase 15.1.1', items: [
                  'Annotation labels simplified — dropped the `{assetOrdinal}.` prefix; PDF dots, right-panel row indicators, and Run Evaluation review rows now show only `{rowOrdinal}` (per-Requirements-Set, 1-indexed). Same row keeps the same number across Asset switches; RS color coding distinguishes RS membership. The `assetOrdinal` prop is preserved on `AnnotatedPdfViewer` for future compound-label scenarios but no longer renders in the label.',
                  'Annotation shape — rounded rectangles (32×22, borderRadius 6) replace the 26px circles in the PDF overlay. Right-panel row indicators and Run Evaluation review-row indicators follow suit at 28×20 to match the shape language at slightly tighter scale.',
                  'Eval Result Expand modal Output tab layout reorganized — the healthbar (SAT/UNSAT/MISSING minibar + aggregate count) and the Download button moved out of the full-width header into the right panel\'s top section. The thin header band above the side-by-side row now contains only the Eval Result name + Evaluated date + Evaluator.',
                  'Right-panel title bar — new "EVALUATION RESULTS" strip mirrors the left panel\'s "EVIDENCE" strip (amber accent, same height + padding, eval result name in place of the Asset filename). Strips read as a paired header row across the side-by-side layout.',
                  'PoE Expand modal Section 1 (the wrapped Eval Result rendering) inherits the same layout reorganization automatically — Section 1 calls `<EvalResultOutputBody>` which now embeds the right-panel title bar + healthbar + Download.',
                ]},
                { version: '0.15.2', date: '2026-05-07', label: 'Phase 15.1', items: [
                  '#172 part 2 of 3: annotation visual redesign + bidirectional row↔dot interaction. Each evidence anchor now renders TWO visual elements: a translucent highlight rectangle (RS color, 15% opacity) drawn over the cited text in the PDF + a numbered indicator (26px circle, 12px mono bold label) placed immediately to the left of the highlight rect. When highlighted, the rect bumps to 30% opacity and the indicator picks up a 3px ring in the RS color outside its 2px white border.',
                  'Side-by-side layout for the Expand modal Output tab (eval-output + poe schemas). Two-column grid: PDF + indicators on the left (~60%), per-Requirements-Set results tables on the right (~40%). Sticky left column so the PDF stays visible while scrolling the results. Below 900px viewport width the layout collapses to a vertical stack.',
                  'Per-RS results tables gain a numbered indicator column on the left of each row. Indicator color matches the RS, label uses {assetOrdinal}.{rowOrdinal}, click highlights the matching dot in the PDF. Rows with empty evidenceAnchors (e.g. status `missing`) get an empty indicator slot.',
                  'Bidirectional interaction: clicking a row indicator scrolls the PDF to the matching dot + applies the highlighted state. Clicking a PDF dot scrolls the results table to the matching row + applies the highlighted state. Cross-Asset clicks auto-flip the multi-Asset switcher first, then highlight + scroll once the new PDF mounts.',
                  'Same row↔dot interaction extended to the Run Evaluation modal Step 2/3 review surface. The accordion left panel\'s expanded Asset is the auto-flip target on cross-Asset row clicks (parallel to the Asset switcher in the Expand modal).',
                  'Synthesized anchor IDs (`{sourceAssetId}|{requirementsSetId}|{requirementId}|{page}|{x}|{y}`) shared between dot and row consumers via a new `src/v2/data/anchorIds.js` utility module.',
                  'Step 0 outcome: VReg re-run is gated by `hasNewAssetsForRerun` until Alice amends the Claim with a new Asset. Per the Phase 15.0.1 demo scenarios doc, this is an acceptable demo prerequisite — no seed adjustment required for Phase 15.1.',
                ]},
                { version: '0.15.1', date: '2026-05-06', label: 'Phase 15.0.1', items: [
                  'Bug fix — annotation dots not rendering despite Phase 15.0 wiring being in place. Root cause: the `makeEvaluationResult` factory\'s `results.map((r) => ({ … }))` block in src/v2/v2_2Data.js explicitly preserved only specific result-row fields (requirementsSetId, requirementId, label, value, status, confidence, _aiOriginalValue) and silently dropped `evidenceAnchors` even though every Phase 15.0 seed call passed it. The factory now preserves `evidenceAnchors` (cloned per-anchor for safety). All four target surfaces (eval flow, Eval Result expand Output, PoE expand Output, Re-Run flow Step 2) now show dots correctly.',
                  'Layout — PDF fit-to-width. AnnotatedPdfViewer derives the render scale at load time from the host container\'s `clientWidth` (capped at 1.6× base scale on very wide containers). Eliminates horizontal scroll inside the modal evidence column; PDFs scale up cleanly on wider screens.',
                  'UX — multi-Asset switcher in the expand modal Output tab. Previous/Next arrow controls flip between in-scope evidence Assets when an Eval Result references more than one displayable Asset. The arrows hide for single-Asset cases. The displayed Asset drives both the PDF.js render and the anchor filter; an Asset-id `key` on AssetEvidenceViewer forces a fresh PDF load on flip. Phase 15.1 will add auto-flip on dot click.',
                  'New docs/PHASE-15-DEMO-SCENARIOS.md captures the four QA scenarios: multi-RS multi-Asset (erBobPrm), single-RS chain head (erBobVreg), PoE expand Output Section 1, and the Run Evaluation re-run flow.',
                  'Workflow lesson recorded in the spec: runtime probes verify components, not integration. Phase 15.0 shipped with the AnnotatedPdfViewer + AssetEvidencePanel correctly verified standalone — but never opened the actual Detail Panel → Expand → Output flow with seed data. The factory bug surfaced on the very first end-to-end check. Future phases that touch shared seed factories should add an explicit user-path walkthrough verification step before declaring complete.',
                ]},
                { version: '0.15.0', date: '2026-05-06', label: 'Phase 15.0', items: [
                  '#172 part 1 of 3: PDF.js integration. Three demo PDFs (PRM-3A Datasheet, PRM-3A Test Report, VReg-12C Datasheet) generated from a deterministic pdf-lib script and committed under public/seed-pdfs/. Each PDF carries a MicroCo-branded header (green accent, owner attribution, document type, revision, generation date) and a multi-page body with calibrated values that map to the seed Requirements Sets.',
                  'Annotated evidence overlay. Each Eval Result `result` row gains an `evidenceAnchors[]` array recording PDF point-space rectangles (`{ sourceAssetId, page, x, y, w, h }`) per requirement. Coordinates are emitted by the same script that generates the PDFs, so the seed and the PDFs never drift.',
                  'New `<AnnotatedPdfViewer>` component renders PDFs via pdfjs-dist (replacing iframe) and overlays numbered dots at the anchored coordinates. Dot labels follow `{assetOrdinal}.{rowOrdinal}`; per-Requirements-Set color coding via a new `getRsColor` palette helper.',
                  'Opt-in PDF.js rendering via a new `usePdfJs` prop on AssetEvidencePanel. Default false preserves iframe behaviour everywhere except the three target surfaces: Run Evaluation modal Step 1 evidence panel, Eval Result expand modal Output tab, and PoE expand modal Output tab. Asset Detail Panel previews + Claim referenced-asset previews continue to use iframe rendering.',
                  '2-Asset / 2-RS demo scenario: Bob\'s PRM Eval Result references both PRM Datasheet (Asset 1) and PRM Test Report (Asset 2). MIL-PRF requirements anchor in either PDF depending on whether the value is published spec (Datasheet) or measured (Test Report). System Integration requirements anchor in the Datasheet.',
                  'Static rendering only in 15.0 — dots are decorative. Phase 15.1 will wire bidirectional row-click ↔ dot-click interaction; Phase 15.2 will ship the walkthrough markdown + final polish.',
                ]},
                { version: '0.14.6.2', date: '2026-05-07', label: 'Phase 14.6.2', items: [
                  'Library Badges tab count now respects the active actor\'s own-templates filter (per 14.6.1 Bug A). Bob sees "Badges 2", Alice "Badges 1", Carol "Badges 1", Dave "Badges 0".',
                  'BadgesPanel toolbar minimum height set to 50px so the row no longer shrinks when toggling from list view (with "+ Create New Badge" button) to create view (button hidden).',
                  'Button label "+ Create new badge" → "+ Create New Badge"; create form title "Create Badge Template" → "Create New Badge". Title-case + simplified terminology.',
                  'Referenced Requirements Sets list (right-panel ViewDetails) now displays the RS owner attribution per row, replacing the technical RS id on line 2.',
                  'Claim and PoE card action bar Issue Badge icon switched from a star glyph (★) to the canonical BadgeShieldIcon SVG, matching the badge chip stack rendering.',
                ]},
                { version: '0.14.6.1', date: '2026-05-07', label: 'Phase 14.6.1', items: [
                  'Bug fix — Badge Library filtered to the active actor\'s own templates only. The original Phase 14.0 design surfaced other parties\' templates in alphabetical sections, but the canonical rule is that badge templates are private to their owner — only Published Standards (RSes) are cross-actor referenceable. The toolbar count + TemplateList input both consume a new `ownTemplates` memo; full `badgeTemplates` stays the source for `selectedTemplate` resolution + the new-version lineage walk so id-based lookups still work. Library now shows zero templates for actors who haven\'t authored any (empty state copy unchanged).',
                  'Bug fix — Badge chip stack hover fan-out visual gap reduced from ~10px to ~4px. STEP_FAN constant in BadgeChipContainer.jsx tuned 22 → 16 to account for the halo + SVG stroke geometry from Phase 14.5; the visible shield footprint exceeds SHIELD_SIZE due to the 2px halo, so the prior `SHIELD_SIZE + 4` math overshot. The mathematical 4px-gap target now lands accurately on screen. STEP_IDLE + SHIELD_SIZE + HEIGHT unchanged.',
                  '#184 — V2.1 holdover `evidence` subtype config entry purged from `CATEGORY_CONFIG` in AssetNode.jsx. The string never rendered (no current seed Asset uses subtype `evidence`); the entry was V2.1-era classification dead code surviving the Phase 15.3 EVIDENCE → ASSET rename. `CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product` provides graceful fallback for any straggler V2.1 data. Broader SUBTYPE_CFG audit deferred to the future #50 V2.1 cleanup sweep. The V2Canvas filter (`c.category === \'evidence\'`) was retained — it returns empty arrays in V2.2 and is also future-#50 cleanup material.',
                  '#183 — Investigation surfaced extensive downstream dependencies for all four legacy-PDF Assets (`aEmiDatasheet`, `dPrmIcDatasheet`, `dPrmIcTestReport`, `dVrefDatasheet`); each is woven into Claims (`cEmi`, ChipCo PRM-IC Assembly, ChipCo Voltage Reference IC), Eval Results (`erCarolEmi`), Disclosure Agreements (`daAlicePublicEmi`, `daAliceToCarolEmi`, ChipCo DAs), and Parse Results. Per the brief\'s "STOP and surface" rule for non-orphan Assets, the trim was deferred without code changes — Andrew picks per-Asset whether to (a) keep the unbranded PDF, (b) cascade-trim the dependency chain, or (c) substitute a generated PDF.',
                ]},
                { version: '0.14.6', date: '2026-05-07', label: 'Phase 14.6', items: [
                  '#187: Badge Template Active Issuances rows now display the target Claim label + Owner alongside the issuance date. Phase 14.2\'s data-model migration from `targetPoeId` → `targetClaimId` had left the row rendering on stale field reads in both the BadgesPanel right-panel ViewDetails and the V22BadgeTemplatePanel forward-looking surface; both are now consistent. The BadgesPanel + LibraryModal prop signatures swapped `proofsOfEvaluation` for `allClaims`; V2App\'s LibraryModal mount drops the now-unused `proofsOfEvaluation` pass-through.',
                  '#188: Badge Template create + new-version forms — RS picker rows in the YOUR REQUIREMENTS SETS section now render the globe icon when the listed RS is also a Published Standard authored by the active actor. Bob (the only role authoring Published Standards in seed) previously saw his published RSes in his own section without any visual indication of their published status; the globe marker resolves this without moving the rows between sections. The fix introduces a `publishedRsIdSet` membership Set built once per render and consulted from `renderRsRow`.',
                  '#189: IssueBadgeModal picker enforces an RS-coverage gate. Each Badge Template row evaluates whether the target Claim has active Proof-of-Evaluation coverage for every RS in the template\'s `referencedRequirementsSetIds` (exact RS ID match — RS-lineage matching is not used; badges reference frozen RS versions). Templates that fail render greyed-out (opacity 0.45, not-allowed cursor, no hover state) with a hover Tooltip listing missing RS names; SUGGESTED label is suppressed on greyed rows. The no-PoE case (Claim has no PoE at all) renders all templates greyed with a "no Proof of Evaluation" tooltip. Defense-in-depth: `handleV22IssueBadge` re-checks the gate at the data layer and silently rejects with a console warning if bypassed (e.g. via direct state manipulation). The gate honors `mergeProvisionals(seed, v22Provisionals)` so PoEs created during the session count toward coverage immediately.',
                  'Phase 14.6 is a backtrack ship from Phase 15.6 — closes the badge polish trio that got deprioritized when Phase 15 took over. The footer continues to display `v0.15.9 · Changelog` (NOT rolled back). v0.14.6 is inserted into the Changelog modal in chronological/phase order between v0.15.0 (2026-05-06) and v0.14.5 (2026-05-06).',
                ]},
                { version: '0.14.5', date: '2026-05-06', label: 'Phase 14.5', items: [
                  '#176c: Badge chip container visual tuning. Each shield gains a 2px halo stroked in the rectangle\'s exact background color, so adjacent overlapping shields now show the recognizable negative-space cut that reads as the classic overlapping-tokens look. Shields shrink 20px → 18px (size after halo), STEP_IDLE 15 → 12 (more pronounced overlap), STEP_FAN drops to 22 (matches 18 + 4px gap). Container height adjusts 26px → 24px. Shields vertically centered against the rectangle midline. Single-shield case (no overflow): the rectangle becomes a 24×24 square with the lone shield centered both horizontally and vertically. Container background, border, shadow, fan-out animation timing, and tooltip behavior unchanged.',
                ]},
                { version: '0.14.4', date: '2026-05-05', label: 'Phase 14.4', items: [
                  '#176b: Badge chip container visual polish. Dropped the circular wrapper around each shield and the pill wrapper around the "+N" indicator — shield silhouettes now render directly inside the rounded rectangle, and "+N" renders as plain indigo monospaced text. Shields scaled up from 16px to 20px to fill the freed space; the rectangle\'s height grows accordingly (22px → 26px). STEP values rescale proportionally so the 25%-overlap idle and 4px-gap fan-out feel balanced at the new size. Container background, border, shadow, fan-out animation timing (180ms ease-out), and tooltip behavior unchanged.',
                ]},
                { version: '0.14.3', date: '2026-05-05', label: 'Phase 14.3', items: [
                  'Bug fix: Issue Badge picker scope. Previously the picker showed Badge Templates owned by every actor (sectioned by party); other actors\' templates would render but submission would have been a violation of the per-template ownership rule. The picker now restricts strictly to the current actor\'s own templates. Other actors\' templates remain visible in the Library tab — they\'re simply not issuable cross-actor.',
                  '#176a: Badge chip container refactored from independent absolute-positioned chips + a separate "+N" pill to a single rounded-rectangle container. Same visual treatment as the NEW pill (4px border-radius, indigo-tinted background, subtle shadow). Cleaner read at idle.',
                  '#176a: Hover fan-out behavior. When a card has 2+ badges, hovering the chip rectangle expands it leftward; the rightmost shield + "+N" stay anchored, previously-overlapped shields slide left to un-overlap with 4px spacing. 180ms ease-out animation on both container width + per-shield position.',
                  '#176a: Per-shield tooltip on hover. Each shield in the fanned-out rectangle reveals a tooltip with the badge name + version (line 1) and the issuer party (line 2). Auto-flips below the shield when insufficient vertical space above (e.g., near the canvas top edge).',
                  '#176a: "+N" tooltip on hover. Listing of buried badges (those past the visible 3) — one row per badge, "Badge Name · Issuer Party" format. Same auto-flip behavior.',
                  '#176a: Click guard. Clicking inside the chip rectangle background no longer triggers card-level interactions (selection, drag).',
                  'Backlog hygiene: Netgraph cleanup item (#4) gains "Child-layer burial rules (Phase 14.3 design notes)" sub-section capturing burial candidates per node type + the Cascading Disclosures (#26) gating dependency.',
                ]},
                { version: '0.14.2', date: '2026-05-07', label: 'Phase 14.2', items: [
                  'Architectural correction (#169a): badges target Claims, not PoEs. The Claim is what earns the badge; PoEs that wrap qualifying Eval Results display the badge via aggregation. Enables third-party endorsements on self-evaluations (e.g. OSHA → Alice\'s self-evaluated Claim).',
                  'Issuance gate is now `issuerParty !== claim.ownerParty`. Visible from PoE Detail Panel footer + Claim Detail Panel footer + PoE action bar + Claim action bar. Self-issuance (Claim owner endorsing own Claim) is blocked at every entry point.',
                  'Issuance entry points expand to Claim Detail Panel + Claim node action bar. Both the PoE-anchored and the Claim-anchored entry resolve to the same target Claim before the modal opens.',
                  'Detail Panel sections updated: PoE Badges section now derives from the parent Claim ("Badges earned by [Claim name]" subtext clickable to navigate). Claim Badges section is the canonical surface (direct lookup). Actor Badges Received walks via Claim ownership.',
                  'Notification recipient routing fixed: `v22-badge-issued`, `v22-badge-revoked`, and `v22-badge-template-new-version` all route to the Claim owner (was: PoE owner). Same recipient in most existing scenarios; OSHA-style cases now route correctly. Badge-issued click → Claim Detail Panel; badge-revoked click → Badge Issuance expand modal.',
                  'Regression fix: PoE creation now fires `v22-poe-created` notification on the Claim owner\'s inbox. Phase 13.1 wired the visibility (proof-of-eval DA grantee=Claim owner makes Bob\'s PoE appear on Alice\'s canvas — this verifiably worked) but the notification was missing. The PoE visibility itself was never broken; only the inbox cue was.',
                  'Architectural correction (#169b): standalone Badge Issuance Detail Panel removed. Badge Issuance row clicks now open the Badge Issuance expand modal directly. Detail Panel-over-Detail Panel violated the prototype\'s overlay conventions; modal-over-Detail-Panel is the correct pattern.',
                  'Filed #182: Amend Claim to include a PoE as an Asset (deferred). Use case: third-party reviewer (OSHA) verifies a self-evaluation by receiving full disclosure to a Claim that includes the self-PoE in its Asset bundle.',
                ]},
                { version: '0.14.1', date: '2026-05-06', label: 'Phase 14.1', items: [
                  'New (#169 part 2): Badge Issuance artifact. Versioned, network-wide endorsements that reference a Proof of Evaluation + a specific Badge Template version. Recipient is derived from the target PoE owner — single source of truth.',
                  'Self-issuance is blocked: a user cannot issue a Badge against their own Proof of Evaluation. Gated at the action bar, the PoE Detail Panel footer, and inside IssueBadgeModal as a final guard.',
                  'New: two-step Issue Badge modal — sectioned Badge Template picker (My Badges + per-Actor) with latest-version SUGGESTED auto-promotion, then optional message → Confirm. Single-step Revoke Badge modal with required reason.',
                  'New: three notification types. v22-badge-issued (recipient sees the new badge, click → target PoE Detail Panel). v22-badge-revoked (recipient sees revocation reason, click → target PoE). v22-badge-template-new-version (informational fan-out to every recipient with an active badge of any prior version of the same lineage).',
                  'New: badge chips on PoE + Claim node cards. Chips render top-right corner, to the LEFT of any NEW badge. Up to 3 visible side-by-side at 25% horizontal overlap; +N indicator on the right when total > 3. Visible at full-card and mini-card LODs.',
                  'New: PoE Detail Panel Badges section is now populated (was a placeholder since Phase 13). Each row: shield + name + version + issuer + creation date. Issuer-of-row sees a Revoke affordance. Click → Badge Issuance Detail Panel.',
                  'New: Claim Detail Panel Badges section. Aggregated walk: claim → eval results → PoEs → badges. Section omitted when zero badges.',
                  'New: Actor Detail Panel Badges Received section. Filtered to issuances where this actor\'s PoEs are the target (issued-by-this-actor badges are NOT shown here).',
                  'New: Badge Issuance Detail Panel — Issuer / Recipient / Target PoE / Badge Template / Description sections + Revocation context (red-tinted block when status: revoked) + DOT. Footer "Revoke Badge" button visible only to the issuer.',
                  'New: Active Issuances section in Badge Template Detail Panel (Phase 14.0 placeholder → populated). Shows issuances of THIS specific version + subtext line "X total active issuances across this badge\'s history" rolling up the lineage.',
                  'New: Badge Issuance expand modal (Output + JSON tabs per Phase 13.4 convention). Output renders header + Parties + References + Description + Revocation context. JSON record carries computed fields (recipientDid, recipientParty, badgeTemplateLineageId) clearly marked as derived from the canonical references.',
                  'Architectural: getJsonRecordFor dispatcher accepts an optional context parameter for cross-artifact reference resolution. Used by Badge Issuance for derived recipient + lineage fields. Future artifacts that need cross-references can use the same hook without re-architecting.',
                  'Seed data: 5 Badge Issuances exercising display surfaces. Bob → Carol\'s PoE on PRM Claim (Aerospace Grade A v1). Carol → Bob\'s PoE on PRM Claim (Audit Verified). Alice → Bob\'s PoE on PRM Claim (Component Quality Assured). Alice → Carol\'s PoE on PRM Claim. Bob → Carol\'s PoE on PRM Claim (Audit Verified, second). The PRM Claim aggregates 4+ badges so the Claim card chip shows 3 chips + +1 overflow on first load.',
                ]},
                { version: '0.14.0', date: '2026-05-06', label: 'Phase 14.0', items: [
                  'New (#169 part 1): Badge Template artifact. Versioned, network-wide Library artifact owned by an Actor; references Requirements Sets it expects to be evaluated against. Phase 14.1 will layer Badge Issuance + display surfaces on top.',
                  'Library: 4th tab "Badges" appended after Published Requirements. Sectioned list shows your Badge Templates first (My Badges), then each other Actor\'s templates under their party heading.',
                  'Library: + Create new badge button gives you an inline form (name + description + multi-select Requirements Set picker); RS picker draws from your own RSes plus all Published Standards. At least one RS required to save.',
                  'Versioning: New Version button on your own Badge Templates pre-fills the form with prior values and locks the name. Save creates a new template with the same lineageId, version + 1, and updates the prior version\'s supersededBy. Both versions remain visible.',
                  'Badge Templates have an Expand button on the right-panel detail view — opens the canonical Output / JSON tab modal (Phase 13.4 convention). Output: header + description + referenced RS table. JSON: realistic distributed-storage record (references by ID).',
                  'New (#181 filed): User-uploaded Badge Template graphics deferred to a future phase. The shield silhouette is the Phase 14 placeholder.',
                  'Polish: Claim Detail Panel — Referenced Assets rows are now clickable. Click pans/zooms the canvas to the Asset and selects it.',
                  'Polish: Claim Detail Panel — Referenced Standards section replaces the "PUBLIC" text badge with the canonical globe icon used elsewhere (LibraryModal, RequirementsPanel published rows, BadgesPanel). Hovering shows a "Published Standard" tooltip.',
                ]},
                { version: '0.13.4', date: '2026-05-05', label: 'Phase 13.4', items: [
                  'New (#175): Expand modals for Eval Result and Proof of Evaluation. Both Detail Panels now carry an Expand button in the header; the modal opens at 1280px wide with the canonical [Output] [JSON] two-tab convention.',
                  'New: Eval Result expand Output renders a header (name + minibar + aggregate + evaluation date + evaluator), then a per-Requirements-Set section with a results table — Requirement, Value, Status (colored chip), Confidence (level + percentage). N/A rows are dropped from display per Phase 13.2.',
                  'New: PoE expand Output renders Section 1 (the wrapped Eval Result\'s Output content — same minibar + aggregate + per-RS results tables) and Section 2 (Evaluation Provenance — the full supersession chain, oldest-first, each row clickable to navigate to that Eval Result\'s Detail Panel).',
                  'Convention: every artifact type\'s expand modal now carries a JSON tab rendering a realistic distributed-storage record — references are ID-only (a Claim\'s referencedAssetIds is `[\"asset-...\", ...]`, not embedded Asset objects). Selective Asset views still surface a disclosed-portion-only record so file metadata stays private.',
                  'Convention: Asset / Claim / DA / EA / Parse Result expand modals\' first tab is now labeled "Output" (was a mix of "Asset Details" / unlabeled / etc.). Existing content is unchanged where the convention rename is the only delta; substantive Output for these types waits for the Detail Panel cleanup phase (#180).',
                  'New: Claim and Disclosure Agreement Detail Panels now carry an Expand button in their header. Parse Result Detail Panel does too.',
                  'Affordance: Both Output and JSON tab headers carry a "Download" button — disabled in 13.4 with the tooltip "Export coming soon." Wires up under #58 in a future phase. The affordance is in place so future callers don\'t restructure the modal.',
                  'Refactor (latent dedup): two pre-existing duplicate JSX attributes on the V22NodeDetailPanel mount (`onSelectEvalResult` and `resolveClaimName`) were collapsed. The single `onSelectEvalResult` handler now accepts either an Eval Result object (V22ClaimPanel\'s usage) or a string id (V22PoEPanel\'s usage).',
                ]},
                { version: '0.13.3', date: '2026-05-05', label: 'Phase 13.3', items: [
                  'Fix: Proof of Evaluation creation now reroutes the disclosure edge through the PoE node. Pre-13.3 the chain endpoint kept its direct ER → Claim edge alongside the new PoE-targeting DA, producing a parallel bypass. Now the path runs cleanly: Asset → ... → Latest ER → PoE → Claim with no parallel edges.',
                  'New (#177a): Multi-column chain placement — Eval Result chains span columns by chain position. Asset → E0 → E1 → ... → Latest → PoE → Claim reads left-to-right on the evaluator\'s canvas; mirror order on the Claim owner\'s canvas. Globally aligned: column N is "chain position N" everywhere, not per-chain. Downstream columns (Pulled Claim, Pulled Asset, Public) shift right to accommodate longer chains.',
                  'Tightening: Re-Run Evaluation now requires at least one Asset that wasn\'t in the prior evaluation\'s evidenceUsed. The action-bar Re-Run button hides when no new Assets exist; Detail Panel footer disables with tooltip "No new evidence to evaluate." Re-Run RS picker locks to the prior Eval Result\'s exact set — user can no longer expand selection.',
                  'UX: Re-Run mode Step 1 — Asset accordion rows start collapsed (vs all-expanded for fresh evaluations). Newly-disclosed Assets (not in prior evidenceUsed) render a NEW badge in their row header.',
                  'Visual: Superseded Eval Result cards now have opaque backgrounds. The grayscale filter still differentiates status; the canvas grid no longer shows through.',
                  'UX: Run Evaluation Step 3 header reads "Evaluating [Claim label] by [Claim owner]" so the artifact + provenance context is visible during row review.',
                  'UX: SUGGESTED badge hides on disabled / locked / PoE-blocked rows so the visual signal doesn\'t conflict with the unselectable state.',
                  'UX: SUGGESTED badge auto-promotes to the latest version of an RS family. If the EA suggested v1 but v2 of the same lineage exists in the library, the badge surfaces on v2.',
                  'Polish: PoE name format is now "Proof of [Claim label] Evaluation". The createdDate suffix is dropped — date stays in the data model and surfaces in the Detail Panel header.',
                  'Polish: PoE Detail Panel body-section PIN row removed. The click-to-copy PIN badge in the panel header is now the canonical surface.',
                  'New (#178): Run Evaluation RS picker is now a two-section accordion — "Your Requirements Sets" expanded by default, "Published Standards" collapsed by default. Published rows surface a globe icon + publishing actor inline.',
                  'New (#179): Published Standards in the Library now show globe icons inline on left-panel rows; the right-panel header surfaces a prominent globe + publishing actor line.',
                ]},
                { version: '0.13.2', date: '2026-05-05', label: 'Phase 13.2', items: [
                  'Fix: Re-Run Evaluation now carries forward EVERY Requirements Set from the prior Eval Result, not just one. The picker pre-checks and locks the carried-over set; you can still add additional Requirements Sets to broaden scope.',
                  'New (#177): Eval Result supersession chains render as connected sequences on the netgraph. Re-runs read as `[Asset] → [Superseded Eval Result] → ... → [Latest Eval Result] → [Claim]`, with proof-only edges throughout. Superseded Eval Results no longer have their own edge to the Claim — only the latest does. PoE creation extends the chain: `... → [Latest Eval Result] → [PoE] → [Claim]`. Reverses left-to-right on the Claim owner\'s canvas.',
                  'Architectural correction: Eval Result auto-disclosure DAs default to proof-only, not full. Both parties still see all evaluation results in Detail Panels — proof-only is the edge style + the discriminated-union subject discriminator, not a content restriction. Reflects the real-world supply-chain pattern where evaluation outcomes are shared without exposing the source documents.',
                  'New (#176): Minibars (the SAT/UNSAT/MISSING health bar) restored on Claim cards (V2.1 carryover) and added to Eval Result + PoE cards. Same primitive at full-card and mini-card LODs. Claim Detail Panel header also gains the minibar.',
                  'Refactor: Eval Result + PoE cards drop the prior text aggregates ("X SAT · Y UNSAT across N Requirements Sets") in favor of the minibar. The "across N Requirements Sets" suffix is gone from card displays.',
                  'Refactor: N/A drops from displays (Eval Result Detail Panel header aggregate, per-row rendering, minibar segments). The data model still carries N/A status; it\'s just not visualized. Per-row N/A rows render dimmed so the structure stays visible.',
                  'New (#177): PoE Detail Panel "Wrapped Eval Result" section renamed to "Evaluation Provenance". Lists the full supersession chain ending at the wrapped Eval Result, oldest first, with status badges and clickable rows for navigation.',
                  'Demo data: Bob\'s VReg evaluation now ships as a 3-Eval-Result chain (V0 superseded by V1 superseded by V_main). Demonstrates chain rendering across multiple supersession steps.',
                ]},
                { version: '0.13.1', date: '2026-05-04', label: 'Phase 13.1', items: [
                  'Fix: Save Evaluation Result no longer crashes. The Phase 13 grep-and-replace had renamed the proof-only DA factory parameter to `poeId` while the save-time call kept passing `evaluationResultId`. Phase 13.1 makes the factory a discriminated union: pass either `evaluationResultId` (auto-disclosure at save) or `poeId` (PoE-creation). The two shapes are distinguished by `subject.kind` downstream.',
                  'Model correction (#168a): multi-Requirements-Set evaluation submissions produce ONE Eval Result bundling every selected RS, not N Eval Results sharing a `batchId`. The Phase 12.2 batch model is retired. Eval Results now carry `requirementsSets[]` (plural) + a flat `results[]` array where every row carries its own `requirementsSetId`. The Detail Panel renders Results grouped by RS with section headers and a single aggregate row "X SAT · Y UNSAT · Z MISSING · W N/A across N Requirements Sets". The Sibling Evaluations section is gone with the concept.',
                  'Simplification: Proof of Evaluation now wraps exactly one Eval Result (1:1). The card body reads "X SAT · Y UNSAT · N RS" (no longer "Wraps N"). The PoE Detail Panel\'s "Wrapped Eval Result" section shows a single clickable row.',
                  'New: clicking Create Proof of Evaluation now revokes the prior Eval-Result-targeting auto-disclosure DA (its edge unravels) and replaces it with a new PoE-targeting DA — Alice sees the transition animate on her canvas the moment Bob finalizes the proof.',
                  'UX: Re-Run Evaluation gating moves from submit-time to entry-point. The action-bar Re-Run button hides when an Eval Result has been wrapped by a PoE; the Detail Panel footer keeps Re-Run visible-but-disabled with a tooltip explaining how to release the gate (modify evidence or pick a different RS). The RS picker on Run Evaluation disables PoE-covered Requirements Sets with a `PoE` chip + tooltip — the user can\'t even select them.',
                  'UX: Run Evaluation step 3 header now reads "Reviewing [Claim name]" so the Claim context is visible during row review (matching step 1\'s wording style).',
                  'UX: Double-clicking the rotating SAT/UNSAT/MISSING/N/A button no longer selects the label text.',
                  'Demo data: two new unwrapped Eval Results — Bob on Alice\'s VReg Claim, Carol on Alice\'s EMI Shield Claim. Both show "Create Proof of Evaluation" as an action button on first interaction. The existing PRM Eval Results stay wrapped.',
                  'ID hygiene: PoE / Eval Result / DA / EA seed identifiers regenerated to a content-addressed-style `[type]-[8-char-base32]` format. Actor names ("bob", "carol", etc.) no longer leak into seed IDs.',
                ]},
                { version: '0.13.0', date: '2026-05-04', label: 'Phase 13', items: [
                  'New (#168): Proof of Evaluation (PoE) — a new first-class node type that wraps an active Eval Result batch (or a solo Eval Result). Created via a deliberate "Create Proof of Evaluation" action on the Eval Result card / Detail Panel footer. PoE creation finalizes the evaluation and terminates further evaluations on the same (Asset set, Requirements Set) combination by the same evaluator until the Claim\'s evidence changes.',
                  'New: PoE node renders with PROOF OF EVALUATION type label, "Wraps N · X SAT · Y UNSAT" aggregate, and edges to each wrapped Eval Result.',
                  'New: PoE Detail Panel — Owner, Source Claim (clickable), Wrapped Eval Results (clickable), Disclosures, Badges placeholder, DOT.',
                  'Migration: proof-only Disclosure Agreements now target PoEs. The data field `scope.evaluationResultIds` was renamed to `scope.poeIds` across the codebase. Existing seed proof-only DAs were retroactively migrated to reference the wrapping PoE. Disclosing a PoE auto-discloses every wrapped Eval Result on the grantee\'s canvas (share-PoE-shares-all).',
                  'Run Evaluation gate: when a PoE you own already wraps an evaluation against a selected Requirements Set covering the current Asset set (or a superset), the modal still opens but Save is blocked at submit time with a copy explaining the gate. Modify the Claim\'s evidence or pick a different RS to release.',
                  'Fix (#173): collapsed Asset accordion rows in the Run Evaluation modal no longer appear to shrink when a sibling expands. Each card pinned to its natural height via flex-shrink: 0.',
                ]},
                { version: '0.12.7', date: '2026-05-04', label: 'Phase 12.7', items: [
                  'Pivot (#171c): Asset accordion left panel restructured from Phase 12.6\'s split-container layout (capped row list + dedicated body) to a single overflow container with inline-expanded bodies. Scales correctly to arbitrary Asset counts — at 10+ Assets the previous capped row list became too cramped. Each Asset\'s body now sits directly below its row header in natural flow.',
                  'Polish: inline-expanded body iframe sized at 480px (up from 12.5\'s 360px) for a more substantial preview now that only one Asset shows at a time. Single-expand semantics, accent-indigo treatment, default-first-expanded, and Parse Evidence height parity all preserved.',
                ]},
                { version: '0.12.6', date: '2026-05-04', label: 'Phase 12.6', items: [
                  'Pivot (#171b): Asset accordion changed from multi-expand to single-expand. Only one Asset\'s evidence renders at a time — clicking a different row\'s header expands it and collapses the previous one. Click the currently-expanded row to fully collapse to header-only.',
                  'New: the Asset row list is now a scroll container so many in-scope Assets remain navigable. Layout: row list capped at ~40% of column height with its own scroll, expanded body fills the rest.',
                  'Fix: Parse Evidence left/right panel heights now parity. The expanded Asset evidence iframe stretches to fill remaining column height (was capped at 360px, leaving a ~48px shortfall on the left side).',
                ]},
                { version: '0.12.5', date: '2026-05-04', label: 'Phase 12.5', items: [
                  'New (#171a): Run Evaluation and Parse Evidence modal left panels converted to V2.1 accordion pattern. Each Asset is a row that expands inline to show its evidence — all Assets are expanded by default so you can see everything at once, and you can collapse what you don\'t need. Multiple rows can be open at the same time.',
                  'Fix: Run Evaluation right panel now scrolls properly. The previous per-Requirements-Set tiny scroll boxes (which didn\'t actually scroll) are replaced with a single scroll surface. Section headers stick to the top while their rows scroll past, so you always know which Requirements Set you\'re looking at.',
                  'Polish: Parse Evidence right panel — helper text moved below the "Parse Template" title, template list scrolls when it grows, and the "Fields to extract" panel now fills the column height so it visually balances with the left panel.',
                  'Filed #172: PDF annotation overlay (numbered evidence dots) — flagged as an end-of-Phase-12 assessment item (depends on real PDF.js integration #41).',
                ]},
                { version: '0.12.4', date: '2026-05-04', label: 'Phase 12.4', items: [
                  'New (#171): the Run Evaluation modal grew a left-panel evidence viewer. Now you can see the underlying Asset file (or, for Selective Disclosure, the disclosed parsed-fields table) while curating per-requirement values on the right. Multi-Asset Claims get an Asset selector list at the top of the left panel — click a row to swap the viewer.',
                  'New: V22ParseEvidenceModal got the same split-panel parity (per §17.1). The single source Asset shows in the selector with the AssetEvidenceViewer below it — same component now used in three places.',
                  'Polish: Run Evaluation and Parse Evidence modals widen to ~1280px on desktop with a 1:1 column split. The modal width stays consistent across all three steps so the size doesn\'t jump as you progress.',
                ]},
                { version: '0.12.3', date: '2026-05-04', label: 'Phase 12.3', items: [
                  'New: Run Evaluation Requirements Set picker is now a checkbox multi-select. The "+ BATCH" chip mechanism is gone — every checked Set is treated equally; submit produces one Eval Result per checked Set, all sharing a batch id.',
                  'New: Review stage shows grouped requirement rows per selected Requirements Set, in the order you checked them. Submit-with-defaults works — AI-suggested values flow through unchanged for any Set you don\'t curate.',
                  'New: Public Requirements Sets are now visible in the Run Evaluation picker alongside your authored sets. Where the same Set is reachable via both, "Authored by you" wins.',
                  'Fix: Removing an Asset from a Claim now correctly clears the Asset → Claim disclosure edge from the netgraph and removes the Asset from any subsequent Run Evaluation\'s available evidence.',
                  'Fix: The "Superseded by" entry in a superseded Eval Result\'s Detail Panel is now clickable — jumps to the successor Eval Result.',
                  'Fix: Run Evaluation Requirements Set picker no longer renders duplicate entries when a Set is reachable through both your authored pool and the public pool.',
                ]},
                { version: '0.12.2', date: '2026-05-04', label: 'Phase 12.2', items: [
                  'New (#106): Run Evaluation modal opens directly to a review-rows surface — no Asset picker step. Evidence is auto-snapshot at submit time from all in-scope Assets on the Claim.',
                  'New (#121): Multi-Requirements-Set evaluation. Pick a primary RS for review + add additional RS via the "+ BATCH" chip; submit produces N Eval Results sharing a batchId. Sibling Eval Results section in the Detail Panel surfaces batch members.',
                  'New (#117): Re-run diff readout. Banner above review rows summarizes the change vs. the prior Eval Result (+N / −M / S superseded / K carried over). Detail Panel "Changes from prior evaluation" section persists the diff in audit trail.',
                  'New (#122): Claim-internal Asset versioning. Amend Claim grew Replace + Remove affordances on each evaluated Asset row. New OUTDATED Eval Result status with amber-dashed visual treatment + new v22-eval-result-stale notification fired to the evaluator on AmendClaim submit. Asset nodes themselves stay immutable — supersession lives on the Claim\'s reference chain.',
                  'New (#105): Run Evaluation empty-state copy split — owner sees "Add evidence to self-evaluate"; non-owner sees "Ask the owner of this Claim to add evidence to evaluate."',
                  'Demo data: Bob\'s PRM Eval Result now ships in a 2-RS batch with a sibling System Integration evaluation — the Sibling Evaluations section is visible on Alice\'s canvas on first load.',
                  'Backlog hygiene: 6 items moved to Completed; 4 items moved to a new Removed section; #72 (Transferring) rescoped to PoE-only; #168 (PoE node type) + #169 (Badges) filed as Phase 13+ priorities.',
                ]},
                { version: '0.12.1', date: '2026-05-04', label: 'Phase 12.1', items: [
                  'New (#120): Claims gain a non-binding "Referenced Standards" field. Owner can declare which Requirements Sets a Claim is built to satisfy at create time, edit them via Amend Claim, or update a single reference to the latest version inline. Strictly informational — does not couple to evaluation, does not auto-suggest in Run Evaluation, does not generate notifications.',
                  'New: Claim Detail Panel "Referenced Standards" section with provenance badges ("Authored by you" / "Public") and a "Newer version available" pill that opens an inline confirmation modal for owners and renders as informational text only for non-owners.',
                  'New: shared RequirementsSetPicker primitive with two-tab pool (My Requirements Sets / Published), now used by Create Claim and Amend Claim flows.',
                  'Demo data: Alice and Dave\'s seeded Claims now reference public + authored standards out of the box. MIL-PRF-55681 ships in v1 + v2 so the supersession surfacing is visible on first load (Alice\'s PRM Assembly references v1).',
                ]},
                { version: '0.11.31', date: '2026-05-04', label: 'Phase 11.8', items: [
                  'New (#44): double-clicking the Radiant Network actor card opens the Public Directory with a circular wipe originating from the node — same animation as the globe button, anchored to where you actually clicked.',
                  'New (#54): "Reset all data" action in the user menu — confirmation modal restores every role\'s canvas state, notifications, and provisional artifacts to seeded shape (theme + skip-boot preferences are preserved).',
                  'New (#98): credit-cost row now exposes an "Add credits →" link in registration modals; opens a demo top-up sub-modal with "+100 credits" and "Reset to role default" actions. Empty-state copy dropped the redundant "Only" prefix.',
                  'New (#99): Create Claim Asset picker now floats pre-selected and just-registered Assets to the top with NEW badges. Deselecting clears the badge for that row.',
                  'Backlog hygiene (#24, #39): two state-bug tickets verified against shipped code and moved to Completed.',
                ]},
                { version: '0.11.30', date: '2026-05-03', label: 'Phase 11.7', items: [
                  'Documentation hygiene pass: phase log brought current through Phase 11.6.1; spec body audited and synced; backlog Update Log verified.',
                ]},
                { version: '0.11.29', date: '2026-05-03', label: 'Phase 11.6.1', items: [
                  'Fix: amendment proposal notification now clears from the grantee\'s inbox after Accept or Reject (was lingering after a successful response).',
                  'Fix: EA Detail Panel now displays the Claim\'s current acknowledgments. Post-amendment changes are visible immediately.',
                  'Fix: Run Evaluation button stays visible during pending-acceptance — visually disabled with a tooltip directing the grantee to respond. Was incorrectly reverting to "Request Evaluation Agreement."',
                  'Fix: Revoke action available in the EA Detail Panel footer during pending-acceptance — revocation is the documented override per spec §11.2b.',
                  'Polish: Amend EA modal + Amendment Response modal both now show current terms above proposed amendments with a divider, so the grantor and grantee can compare without scrolling back to the Claim Detail Panel.',
                ]},
                { version: '0.11.28', date: '2026-05-03', label: 'Phase 11.6', items: [
                  'New (#164): Evaluation Agreement amendments are now bilateral proposals. The grantor submits a proposal, the grantee accepts or rejects in a new Amendment Response modal with diff display + per-change ticking. While pending, evaluations under the EA are paused and further amendments are blocked.',
                  'Polish (#165): edge draw-in animation is smoother — overlay edges now use 64 curve segments (was 12-32), removing the per-frame "steppy" quantization visible during the 1.2s draw-in.',
                  'Phase 11 retrospective: closed out Phase 11E (#108 + #102 + #139) and Phase 11.6 (#164 + #165). Phase 12 next.',
                ]},
                { version: '0.11.27', date: '2026-05-03', label: 'Phase 11E.9', items: [
                  'Fix: reveal-edge draw-in animation now grows from the requester\'s anchor Asset toward the Claim ("supplier reaches out"), not the reverse.',
                  'Fix: pre-click incident edges now correctly render in dashed grey provisional styling. The runtime restyle pass was overwriting the provisional treatment with the typed color on selection / hover / zoom / edge-list changes.',
                ]},
                { version: '0.11.26', date: '2026-05-03', label: 'Phase 11E.8', items: [
                  'Fix: edge provisional styling on grantee canvas pre-click. Incident edges now correctly render as dashed grey provisional (was rendering with the typed color + dashed pattern, because the v22DataWithReveal early-return guard short-circuited before reveal-window edge stamping could run).',
                  'Polish: edge draw-in animation slowed from 500ms to 1200ms for visual clarity. The typed edge now visibly grows along the curve at a perceivable pace; fade + flip + cleanup orchestration shifted accordingly.',
                ]},
                { version: '0.11.25', date: '2026-05-03', label: 'Phase 11E.7', items: [
                  'Fix: grantee provisional rendering. Claims received from acceptance now stay in provisional state on the grantee\'s canvas until the notification is clicked. The reveal animation plays as a true first-time materialization rather than a "regress then re-reach active" sequence.',
                ]},
                { version: '0.11.24', date: '2026-05-03', label: 'Phase 11E.6', items: [
                  'Fix: reveal-edge draw-in animation; the typed edge now grows smoothly along the full bezier curve over the provisional edge.',
                ]},
                { version: '0.11.23', date: '2026-05-03', label: 'Phase 11E.5', items: [
                  'Fix: edge draw-in animation now actually animates the curve growth. Pre-fix the typed-style overlay edge appeared as a ~100px stub at the anchor and sat motionless. Switched from per-frame setPositions (which silently throws when the new array exceeds LineGeometry\'s pre-allocated buffer) to per-frame instanceCount, mirroring animateNewEdges.',
                  'Polish: clicking a DA-amendment or EA-amendment notification now also selects the corresponding edge alongside opening the Detail Panel. The amber selection styling on the edge gives the user visual confirmation that the deep-link landed on the right artifact.',
                ]},
                { version: '0.11.22', date: '2026-05-02', label: 'Phase 11E.4', items: [
                  'Rollback: removed the v22-claim-amendment notification type added in Phase 11E.2 — counterparties only learn of new Claim content via Disclosure Agreement amendment, never via the Claim amendment itself. The v22-da-amendment side of Phase 11E.2 is preserved.',
                  'Polish: amendment notifications (DA + EA) now share a unified AMENDMENT badge — the badge is a category tag, the body copy already specifies which artifact was amended. Replaces the prior split DA AMENDED / EA AMENDED.',
                  'Fix: edge draw-in animation now uses a two-edge architecture per Andrew\'s spec. The dashed-grey provisional edge stays visible while a new typed-style edge (solid indigo / dashed amber / dashed green per disclosure type) draws in over it. Provisional fades out during the Claim card flip; typed edge stays.',
                ]},
                { version: '0.11.21', date: '2026-05-02', label: 'Phase 11E.2 + 11E.3', items: [
                  'New (#102): Claim amendments now fire a v22-claim-amendment notification to every counterparty with an active Disclosure Agreement on the affected Claim. Click pans to the Claim and opens its Detail Panel. Badge: CLAIM AMENDED.',
                  'Polish (#102): Disclosure Agreement amendment notification renamed v22-amendment → v22-da-amendment. Click now deep-links directly to the DA Detail Panel (was pan-only). Badge: DA AMENDED. Body copy reads "Disclosure Agreement amended: <claim>" with optional note suffix.',
                  'New (#139): edge draw-in animation on reveal. When a provisional Claim flips to active, the connecting Agreement Edge animates from the requester\'s anchor outward toward the Claim, completing before the card flip. Mirrors the unravel ceremony in reverse.',
                ]},
                { version: '0.11.20', date: '2026-05-02', label: 'Phase 11E.1.7', items: [
                  'Polish: Step 4 review labels expanded to "Disclosure Agreement expires" / "Evaluation Agreement expires" (was the abbreviated "DA expires" / "EA expires"). Label column widened to keep the value column readable.',
                  'Polish: response modal renders at a fixed 720px height across all four steps so the footer button row stays in the same place as the user advances through the flow.',
                  'Fix: Detail Panels (node + DA + EA) now close when entering the Radiant Network Directory Layer. Pre-fix the agreement panel persisted on top of the directory.',
                  'Fix: Amend Disclosure Agreement modal now blocks Submit when scope is empty (e.g. user unchecked the lone Asset). Inline amber italic warning surfaces after deselection brings the count to zero.',
                ]},
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
                // Phase 16.0.2: composite key — multiple historical phases
                // share the same `version` string (e.g. v0.10.0 covers
                // Phase 10.1 through 11B), so `key={release.version}` alone
                // produced duplicate-key React warnings. `label` is unique
                // per entry (it's the phase number) so the composite is
                // stable + collision-free.
                <div key={`${release.version}-${release.label}`} style={{ marginBottom: 24 }}>
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
            badgeTemplates={badgeTemplates}
            badgeIssuances={badgeIssuances}
            allClaims={(() => {
              const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
              return merged.claims || []
            })()}
            onSelectBadgeIssuance={(badgeIssuanceId) => {
              // Phase 14.2: open the expand modal directly (was: standalone
              // Detail Panel — removed in 14.2 (#169b)).
              const issuance = badgeIssuances.find((b) => b.id === badgeIssuanceId)
              if (!issuance) return
              const template = badgeTemplates.find((t) => t.id === issuance.badgeTemplateId) || null
              const merged = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)
              const targetClaim = (merged.claims || []).find((c) => c.id === issuance.targetClaimId) || null
              setShowLibrary(false)
              setLibraryInitialSetId(null)
              setLibraryInitialTab(null)
              setV22ExpandedArtifact({
                artifact: issuance,
                schema: 'badge-issuance',
                badgeIssuanceContext: {
                  template,
                  recipientParty: targetClaim?.owner || targetClaim?.ownerParty || null,
                  targetClaimName: targetClaim?.name || issuance.targetClaimId,
                  allClaims: merged.claims || [],
                  allBadgeTemplates: badgeTemplates,
                },
              })
            }}
            onSavePepTemplate={handleSavePEPTemplate}
            onSaveRequirementSet={handleSaveRequirementSet}
            onPublishRequirementSet={handlePublishRequirementSet}
            onSaveBadgeTemplate={handleSaveBadgeTemplate}
            activeParty={activeRole.party}
            initialTab={libraryInitialTab || 'requirements'}
            initialSelectedId={libraryInitialSetId}
            onClose={closeLibrary}
          />
        )
      })()}
    </div>
  )
}
