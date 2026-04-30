// V2.2 Data Model — factories, shared artifact collection, view-builder stubs, and the
// V2_2_ENABLED feature flag. Introduced in Phase 1 of the V2.1 → V2.2 migration.
// Source of truth: v2.2-architecture-migration-spec.md (sections 2, 3, 4, 6, 10, 12.5).
//
// Design notes:
//   • Factories produce JSON that conforms to spec §10 schemas. They are pure and
//     import-safe — merely importing this module must not alter V2.1 behavior.
//   • While V2_2_ENABLED is false, nothing in V2App.jsx calls into this module's
//     data-construction paths.
//   • View-builders (buildBobView / buildAliceView / buildCarolView) exist as stubs
//     in Phase 1 and return the full shared artifact set. Phase 2 narrows per §6.
//   • Reuses makePin / makeDot from v2Data.js so PINs/DOTs are stable across sessions.

import { makePin, makeDot } from './v2Data.js'

// Phase 8 (2026-04-19): V2_2_ENABLED feature flag removed. V2.2 is the only
// behaviour shipped now that Phases 1–7 are complete. See git history pre-Phase 8
// for the gated V2.1 code paths if a rollback is ever needed.

// ─── URI helpers ───────────────────────────────────────────────────────────
const assetUri = (id) => `provenance://assets/${id}`
const parseResultUri = (id) => `provenance://artifacts/${id}`
const claimUri = (id) => `provenance://claims/${id}`
const disclosureAgreementUri = (id) => `provenance://agreements/${id}`
const evaluationAgreementUri = (id) => `provenance://agreements/${id}`
const evaluationResultUri = (id) => `provenance://artifacts/${id}`

// Valid disclosure types per spec §4.2 (edge styling table).
const DISCLOSURE_TYPES = new Set(['full', 'selective', 'proofonly', 'provisional', 'expired'])

// Valid subject kinds per spec §10.4 (DA subject field).
const SUBJECT_KINDS = new Set(['asset', 'claim', 'evalResult', 'parseResult'])

// ═══════════════════════════════════════════════════════════════════════════
// DOT (Data Object Title) — client canon X.1–X.10 / spec §2.4
// ═══════════════════════════════════════════════════════════════════════════
//
// Every registered data element (Asset, Claim, Eval Result) is anchored to
// a DOT — a cryptographically verifiable identity object carrying PIN, hash,
// owner DID, registration timestamp, metadata, and ownership lineage.
//
// Mental model: DOT is to data element as vehicle title is to car. The PIN
// is the VIN — printed on the title, used as everyday identifier. Ownership
// transfers between parties by updating the title; the car (file) doesn't
// move. Each transfer is recorded on the back of the title (`lineage[]`)
// as an immutable state transition (canon X.5).

/**
 * Structured DOT object — spec §2.4 / canon X.1–X.10.
 *
 * Required: `pin`, `ownerDid`. All other fields default per canon:
 *   • `hash` — file fingerprint (Assets only; null for Claims / Eval Results
 *     which are derived artifacts without a canonical file).
 *   • `registrationTimestamp` — ISO-8601; defaults to now.
 *   • `metadata` — free-form bag for artifact-specific context.
 *   • `lineage` — append-only transfer history (see `makeTransferRecord`).
 */
export function makeDotObject({
  pin,
  hash = null,
  ownerDid,
  registrationTimestamp = new Date().toISOString(),
  metadata = {},
  lineage = [],
}) {
  if (!pin) throw new Error('makeDotObject: pin is required')
  if (!ownerDid) throw new Error('makeDotObject: ownerDid is required')
  return {
    pin,
    hash,
    ownerDid,
    registrationTimestamp,
    metadata: { ...metadata },
    lineage: [...lineage],
  }
}

/**
 * Transfer record — spec §11.7 / canon X.5.
 *
 * Appended to `dot.lineage[]` on every transfer (accepted or declined).
 * Declined transfers are retained in lineage for auditability — the
 * provenance chain documents what was attempted, not just what succeeded.
 */
export function makeTransferRecord({
  fromOwnerDid,
  toOwnerDid,
  initiatedTimestamp,
  acceptedTimestamp = null,
  status = 'pending', // 'pending' | 'accepted' | 'declined'
  declineReason = null,
}) {
  if (!fromOwnerDid) throw new Error('makeTransferRecord: fromOwnerDid is required')
  if (!toOwnerDid) throw new Error('makeTransferRecord: toOwnerDid is required')
  if (!initiatedTimestamp) throw new Error('makeTransferRecord: initiatedTimestamp is required')
  return {
    fromOwnerDid,
    toOwnerDid,
    initiatedTimestamp,
    acceptedTimestamp,
    status,
    declineReason,
  }
}

// ─── Radiant Network pseudo-actor (public directory) ──────────────────────
const RADIANT_NETWORK_PARTY = 'Radiant Network'
const RADIANT_NETWORK_DOT = makeDot(RADIANT_NETWORK_PARTY)
const RADIANT_NETWORK_PIN = makePin('radiant-network')

const RADIANT_NETWORK_ACTOR = {
  id: 'radiant-network',
  user: null,
  party: RADIANT_NETWORK_PARTY,
  partyDot: RADIANT_NETWORK_DOT,
  pin: RADIANT_NETWORK_PIN,
  role: 'directory',
  credits: 0,
  vertical: 'Public Directory',
  isPublicDirectory: true,
}

export { RADIANT_NETWORK_ACTOR, RADIANT_NETWORK_PARTY, RADIANT_NETWORK_DOT, RADIANT_NETWORK_PIN }

/**
 * Actor pool — the four known actors whose PINs the transfer modal will
 * accept. Kept in a module-level lazy cache so PIN resolution is a pure
 * lookup, not a full `buildV22SharedArtifacts` walk per keystroke.
 */
let _actorPoolCache = null
function actorPool() {
  if (_actorPoolCache) return _actorPoolCache
  const actors = [
    { id: 'bob-govco',     user: 'Bob',   party: 'GovCo',   role: 'buyer'    },
    { id: 'alice-microco', user: 'Alice', party: 'MicroCo', role: 'seller'   },
    { id: 'carol-auditco', user: 'Carol', party: 'AuditCo', role: 'auditor'  },
    // Phase 11A: ChipCo as a fourth actor. Not yet in the role switcher
    // (UI only exposes the original three demo personas); included here so
    // PIN resolution works for any 11C/11D flow that addresses Dave directly.
    { id: 'dave-chipco',   user: 'Dave',  party: 'ChipCo',  role: 'supplier' },
    RADIANT_NETWORK_ACTOR,
  ]
  _actorPoolCache = actors.map((a) => ({
    ...a,
    pin: a.pin || makePin(a.id),
    partyDot: a.partyDot || makeDot(a.party),
  }))
  return _actorPoolCache
}

/**
 * Resolve an Actor by PIN. Used by V22TransferAssetModal to validate the
 * recipient the user typed.
 *
 * Returns `{ actor, isSelf, isNetwork }` where:
 *   • actor     — the resolved actor object (or null if no match)
 *   • isSelf    — true when the resolved PIN belongs to activeParty
 *   • isNetwork — true when the resolved PIN is the Radiant Network
 *
 * Callers typically reject self + network transfers; the resolver surfaces
 * both conditions so callers can tailor error copy.
 */
export function resolveActorByPin(pin, { activeParty } = {}) {
  if (!pin || typeof pin !== 'string') return { actor: null, isSelf: false, isNetwork: false }
  const trimmed = pin.trim()
  for (const actor of actorPool()) {
    if (actor.pin === trimmed) {
      const isNetwork = actor.id === RADIANT_NETWORK_ACTOR.id
      const isSelf = !!activeParty && actor.party === activeParty
      return { actor, isSelf, isNetwork }
    }
  }
  return { actor: null, isSelf: false, isNetwork: false }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY FUNCTIONS — spec §10
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Actor — see spec §2.1. Not one of the six artifact types; included here so the
 * shared dataset has a consistent way to surface the three demo actors plus the
 * Radiant Network pseudo-actor.
 */
export function makeActor({ id, user, party, role, credits = 0, vertical = '' }) {
  if (!id) throw new Error('makeActor: id is required')
  if (!party) throw new Error('makeActor: party is required')
  return {
    id,
    user: user || null,
    party,
    partyDot: makeDot(party),
    role: role || null,
    credits,
    vertical,
  }
}

/** Asset artifact — spec §10.1. Identity anchored by a DOT object (spec §2.4).
 * Phase 10.2: optional `parentAssetId` enables single-party Asset hierarchy.
 * Children must share their parent's owner; cycles forbidden. Counterparties
 * never see parent/child relationships — hierarchy is owner-only (spec §6).
 */
export function makeAsset({
  id,
  owner,
  ownerDot,
  name,
  description = '',
  file,
  registrationDate,
  parseResultIds = [],
  parentAssetId = null,
  dot,   // optional structured DOT; derived below if absent
}) {
  if (!id) throw new Error('makeAsset: id is required')
  if (!owner) throw new Error('makeAsset: owner is required')
  if (!file || !file.uri || !file.filename) {
    throw new Error('makeAsset: file { uri, filename } is required')
  }
  const pin = makePin(id)
  const ownerDid = ownerDot || makeDot(owner)
  // Phase 9A.4 Gate A: structured DOT per canon X.1–X.10. Top-level `pin` /
  // `ownerDot` / `file.hash` remain as convenience aliases pointing into
  // `asset.dot.*` for backward compat — read sites keep working unchanged.
  const assetDot = dot || makeDotObject({
    pin,
    hash: file.hash ?? null,
    ownerDid,
    registrationTimestamp: registrationDate,
    metadata: { fileUri: file.uri, filename: file.filename },
  })
  return {
    artifactType: 'asset',
    artifactUri: assetUri(id),
    id,
    pin,
    owner,
    ownerDot: ownerDid,
    name,
    description,
    parentAssetId: parentAssetId || null,
    file: {
      uri: file.uri,
      filename: file.filename,
      size: file.size ?? null,
      mimeType: file.mimeType ?? null,
      hash: file.hash ?? null,
      // Phase 11B: Prototype-only pointer to a placeholder PDF in /public/
      // so AssetEvidenceViewer's iframe has something real to render.
      // Production resolves files via Platform-side QS URI lookups instead.
      localPath: file.localPath ?? null,
    },
    registrationDate,
    parseResultIds: [...parseResultIds],
    dot: assetDot,
  }
}

/** Parse Result artifact — spec §10.2. Rendered on parent layer (see §3.3 / §5). */
export function makeParseResult({
  id,
  owner,
  sourceAssetId,
  templateId,
  templateName,
  templateVersion = 1,
  fields = [],
  parseDate,
}) {
  if (!id) throw new Error('makeParseResult: id is required')
  if (!owner) throw new Error('makeParseResult: owner is required')
  if (!sourceAssetId) throw new Error('makeParseResult: sourceAssetId is required')
  return {
    artifactType: 'parseResult',
    artifactUri: parseResultUri(id),
    id,
    owner,
    sourceAssetId,
    templateId,
    templateName,
    templateVersion,
    fields: fields.map((f) => ({
      id: f.id,
      name: f.name,
      value: f.value,
      confidence: f.confidence,
      // Phase 9A item 10: preserve AI original so the Parse Result panel
      // can render the human-edited pencil on fields the user modified.
      _aiOriginalValue: f._aiOriginalValue,
    })),
    parseDate,
  }
}

/**
 * Claim artifact — spec §10.3.
 * V2.2 uses `referencedAssetIds[]` to reference Assets as first-class nodes. V2.1's
 * embedded evidence arrays are not carried over.
 */
export function makeClaim({
  id,
  owner,
  ownerDot,
  name,
  description = '',
  referencedAssetIds = [],
  // Phase 11C.1: pre-set acknowledgments authored by the Claim owner.
  // Format: [{ id, title, description }]. Surface to requesters as
  // required-checkbox gates for any DA / EA / combined request against
  // this Claim.
  acknowledgments = [],
  createdDate,
  amendments = [],
  dot,   // optional structured DOT; derived below if absent
}) {
  if (!id) throw new Error('makeClaim: id is required')
  if (!owner) throw new Error('makeClaim: owner is required')
  const pin = makePin(id)
  const ownerDid = ownerDot || makeDot(owner)
  // Phase 9A.4 Gate A: structured DOT (spec §2.4 / canon X.1–X.10).
  // Claims have no file, so dot.hash is null. `referencedAssetCount` on
  // metadata lets future UI surface Claim provenance at a glance.
  const claimDot = dot || makeDotObject({
    pin,
    hash: null,
    ownerDid,
    registrationTimestamp: createdDate,
    metadata: { referencedAssetCount: referencedAssetIds.length },
  })
  return {
    artifactType: 'claim',
    artifactUri: claimUri(id),
    id,
    pin,
    owner,
    ownerDot: ownerDid,
    name,
    description,
    referencedAssetIds: [...referencedAssetIds],
    acknowledgments: acknowledgments.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
    })),
    createdDate,
    amendments: amendments.map((a) => ({
      date: a.date,
      added: [...(a.added || [])],
      removed: [...(a.removed || [])],
    })),
    dot: claimDot,
  }
}

/**
 * Disclosure Agreement artifact — spec §10.4.
 * The same primitive models inter-party, internal (ownership), proof-of-evaluation,
 * and public-directory disclosures; what differs is grantor/grantee/subject/scope —
 * see §4.1. `subject` identifies the artifact being disclosed: one of asset, claim,
 * evalResult, or parseResult.
 */
export function makeDisclosureAgreement({
  id,
  grantor,
  grantee,
  subject,
  granteeAssetId = null,
  type,
  scope = {},
  terms = {},
  amendments = [],
  status = 'active',
}) {
  if (!id) throw new Error('makeDisclosureAgreement: id is required')
  if (!grantor || !grantor.party) {
    throw new Error('makeDisclosureAgreement: grantor { party, dot } is required')
  }
  if (!grantee || !grantee.party) {
    throw new Error('makeDisclosureAgreement: grantee { party, dot } is required')
  }
  if (!subject || !subject.kind || !subject.id) {
    throw new Error('makeDisclosureAgreement: subject { kind, id } is required')
  }
  if (!SUBJECT_KINDS.has(subject.kind)) {
    throw new Error(`makeDisclosureAgreement: invalid subject.kind "${subject.kind}"`)
  }
  if (!DISCLOSURE_TYPES.has(type)) {
    throw new Error(`makeDisclosureAgreement: invalid type "${type}"`)
  }
  return {
    artifactType: 'disclosureAgreement',
    artifactUri: disclosureAgreementUri(id),
    id,
    grantor: {
      party: grantor.party,
      dot: grantor.dot || makeDot(grantor.party),
    },
    grantee: {
      party: grantee.party,
      dot: grantee.dot || makeDot(grantee.party),
    },
    subject: { kind: subject.kind, id: subject.id },
    granteeAssetId,
    type,
    scope: {
      assetIds: scope.assetIds ? [...scope.assetIds] : null,
      fieldIds: scope.fieldIds ? [...scope.fieldIds] : null,
      evaluationResultIds: scope.evaluationResultIds ? [...scope.evaluationResultIds] : null,
      includeDerivatives: scope.includeDerivatives !== undefined ? scope.includeDerivatives : true,
    },
    terms: {
      createdDate: terms.createdDate || null,
      expires: terms.expires || null,
      autoRenew: terms.autoRenew === true,
    },
    amendments: amendments.map((a) => ({ ...a })),
    status,
  }
}

/**
 * Implicit internal Disclosure Agreement — grantor === grantee.
 * Models Actor → Asset, Actor → Claim, Claim → referenced-Asset, and Eval Result →
 * evaluator's Asset relationships. Rendered as a Full Disclosure edge; its Detail
 * Panel reads "Internal — {party} to {party}".
 */
export function makeInternalDisclosureAgreement({
  id,
  owner,
  ownerDot,
  subject,
  scope = {},
  terms = {},
}) {
  const party = owner
  const dot = ownerDot || makeDot(owner)
  return makeDisclosureAgreement({
    id,
    grantor: { party, dot },
    grantee: { party, dot },
    subject,
    granteeAssetId: null,
    type: 'full',
    scope: {
      assetIds: scope.assetIds ?? null,
      fieldIds: scope.fieldIds ?? null,
      evaluationResultIds: scope.evaluationResultIds ?? null,
      includeDerivatives: scope.includeDerivatives ?? true,
    },
    terms,
    status: 'active',
  })
}

/**
 * Proof-of-Evaluation Disclosure Agreement — evaluator (grantor) → claim owner
 * (grantee). subject is the Eval Result itself; the Claim context is resolved via
 * the Eval Result's `claimId` during edge derivation. See spec §4.1 bullet 2.
 */
export function makeProofOfEvalDisclosureAgreement({
  id,
  evaluator,
  evaluatorDot,
  claimOwner,
  claimOwnerDot,
  evaluationResultId,
  terms = {},
}) {
  if (!evaluationResultId) {
    throw new Error('makeProofOfEvalDisclosureAgreement: evaluationResultId is required')
  }
  return makeDisclosureAgreement({
    id,
    grantor: { party: evaluator, dot: evaluatorDot || makeDot(evaluator) },
    grantee: { party: claimOwner, dot: claimOwnerDot || makeDot(claimOwner) },
    subject: { kind: 'evalResult', id: evaluationResultId },
    granteeAssetId: null,
    type: 'full',
    scope: {
      evaluationResultIds: [evaluationResultId],
      includeDerivatives: false,
    },
    terms,
  })
}

/**
 * Public-directory Disclosure Agreement — grantor → Radiant Network pseudo-actor.
 * subject is always the Claim being published. No paired Evaluation Agreement; the
 * directory is a publishing channel only.
 */
export function makePublicDirectoryDisclosureAgreement({
  id,
  grantor,
  grantorDot,
  subject,
  type,
  scope = {},
  terms = {},
}) {
  return makeDisclosureAgreement({
    id,
    grantor: { party: grantor, dot: grantorDot || makeDot(grantor) },
    grantee: { party: RADIANT_NETWORK_PARTY, dot: RADIANT_NETWORK_DOT },
    subject,
    granteeAssetId: null,
    type,
    scope,
    terms,
  })
}

/** Evaluation Agreement artifact — spec §10.5. Pairs with a Disclosure Agreement. */
export function makeEvaluationAgreement({
  id,
  grantor,
  grantee,
  claimId,
  granteeAssetId = null,
  disclosureAgreementId,
  authorizedRequirementsSetIds = [],
  // Phase 11C.1: top-level audit-trail field — ids of acknowledgments on the
  // Claim that the requester checked at request time. Empty array when the
  // Claim has no acknowledgments OR when this artifact predates 11C.1.
  acknowledgmentsAccepted = [],
  restrictions = {},
  terms = {},
  incentives = {},
  // Phase 11E.1 (#108): mirror DA `amendments[]` so Amend EA can append
  // entries with `termsBefore.evaluationDeadline` + an `acknowledgmentChanges`
  // delta for audit. Acknowledgment edits themselves live on the underlying
  // Claim per the prototype's Option B (see architecture-spec §11.2a).
  amendments = [],
  status = 'active',
}) {
  if (!id) throw new Error('makeEvaluationAgreement: id is required')
  if (!grantor || !grantor.party) {
    throw new Error('makeEvaluationAgreement: grantor { party, dot } is required')
  }
  if (!grantee || !grantee.party) {
    throw new Error('makeEvaluationAgreement: grantee { party, dot } is required')
  }
  if (!claimId) throw new Error('makeEvaluationAgreement: claimId is required')
  if (!disclosureAgreementId) {
    throw new Error('makeEvaluationAgreement: disclosureAgreementId is required')
  }
  return {
    artifactType: 'evaluationAgreement',
    artifactUri: evaluationAgreementUri(id),
    id,
    grantor: { party: grantor.party, dot: grantor.dot || makeDot(grantor.party) },
    grantee: { party: grantee.party, dot: grantee.dot || makeDot(grantee.party) },
    claimId,
    granteeAssetId,
    disclosureAgreementId,
    authorizedRequirementsSetIds: [...authorizedRequirementsSetIds],
    acknowledgmentsAccepted: [...acknowledgmentsAccepted],
    restrictions: {
      priorEvaluationRequired: restrictions.priorEvaluationRequired ?? null,
      additionalParticipants: restrictions.additionalParticipants
        ? [...restrictions.additionalParticipants]
        : [],
    },
    terms: {
      createdDate: terms.createdDate || null,
      evaluationDeadline: terms.evaluationDeadline || null,
      resultExpiry: terms.resultExpiry || null,
      flowDownRequirements: terms.flowDownRequirements ? [...terms.flowDownRequirements] : [],
      // Phase 11C.1 architectural correction: removed `resultConfidentiality`
      // and `attribution` from EA terms. Those fields treated terms as
      // requester-authored, but in the actual model terms are responder-
      // authored. The closest the requester gets is *acknowledging* pre-set
      // terms the Claim owner authored on the Claim itself — see the
      // top-level `acknowledgmentsAccepted` field above and the `acknowledgments`
      // array on the Claim artifact.
    },
    incentives: {
      onSatisfactory: incentives.onSatisfactory ?? null,
      onUnsatisfactory: incentives.onUnsatisfactory ?? null,
    },
    amendments: amendments.map((a) => ({ ...a })),
    status,
  }
}

/**
 * Evaluation Result artifact — spec §10.6. Owned by the evaluator; visible to the
 * Claim owner via a Proof-of-Evaluation Disclosure Agreement (see spec §3.5).
 */
export function makeEvaluationResult({
  id,
  owner,
  ownerDot,
  evaluationAgreementId,
  claimId,
  granteeAssetId = null,
  requirementsSet,
  results = [],
  evidenceUsed = [],
  evaluationDate,
  status = 'active',
  supersededBy = null,
  dot,   // optional structured DOT; derived below if absent
}) {
  if (!id) throw new Error('makeEvaluationResult: id is required')
  if (!owner) throw new Error('makeEvaluationResult: owner is required')
  if (!evaluationAgreementId) {
    throw new Error('makeEvaluationResult: evaluationAgreementId is required')
  }
  if (!claimId) throw new Error('makeEvaluationResult: claimId is required')
  if (!requirementsSet || !requirementsSet.id) {
    throw new Error('makeEvaluationResult: requirementsSet { id, name, version } is required')
  }
  const pin = makePin(id)
  const ownerDid = ownerDot || makeDot(owner)
  // Phase 9A.4 Gate A: structured DOT (spec §2.4 / canon X.1–X.10). Metadata
  // captures the paired Claim + Evaluation Agreement ids so the provenance
  // chain can be navigated from any Eval Result without re-querying.
  const evalDot = dot || makeDotObject({
    pin,
    hash: null,
    ownerDid,
    registrationTimestamp: evaluationDate,
    metadata: { claimId, evaluationAgreementId },
  })
  return {
    artifactType: 'evaluationResult',
    artifactUri: evaluationResultUri(id),
    id,
    pin,
    owner,
    ownerDot: ownerDid,
    evaluationAgreementId,
    claimId,
    granteeAssetId,
    requirementsSet: {
      id: requirementsSet.id,
      name: requirementsSet.name,
      version: requirementsSet.version ?? 1,
    },
    results: results.map((r) => ({
      requirementId: r.requirementId,
      label: r.label,
      value: r.value,
      status: r.status, // 'satisfactory' | 'unsatisfactory' | 'missing' | 'na'
      // Phase 9A item 8 sub-3 + item 10: preserve AI confidence + the original
      // AI-extracted value so the Detail Panel can render the confidence chip
      // and the human-edited pencil on artifacts after they've landed.
      confidence: r.confidence,
      _aiOriginalValue: r._aiOriginalValue,
    })),
    evidenceUsed: [...evidenceUsed],
    evaluationDate,
    status, // 'active' | 'superseded'
    supersededBy,
    dot: evalDot,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SHARED ARTIFACT COLLECTION
// ═══════════════════════════════════════════════════════════════════════════
//
// A single source of truth across Bob/Alice/Carol views. Role-specific filtering
// is Phase 2; Phase 1 view builders return the full set.
//
// Demo scenarios exercised:
//   • Alice's Power Reg Claim disclosed to Bob (Selective) + paired Evaluation
//     Agreement + Bob's Evaluation Result (Story 1).
//   • Alice's VReg Claim disclosed to Bob (Full) + paired Evaluation Agreement,
//     not yet evaluated.
//   • Alice's Power Reg Claim disclosed to Carol (Full) + Carol's Evaluation
//     Result (Story 3 seed).
//   • Alice's Power Reg, VReg, and EMI Shield Claims published to the Radiant
//     Network (Story 2 seed).

export function buildV22SharedArtifacts() {
  // ── Actors ────────────────────────────────────────────────────────────
  const bob = makeActor({
    id: 'bob-govco',
    user: 'Bob',
    party: 'GovCo',
    role: 'buyer',
    credits: 2400,
    vertical: 'Government / Satellite',
  })
  const alice = makeActor({
    id: 'alice-microco',
    user: 'Alice',
    party: 'MicroCo',
    role: 'seller',
    credits: 2400,
    vertical: 'Electronics',
  })
  const carol = makeActor({
    id: 'carol-auditco',
    user: 'Carol',
    party: 'AuditCo',
    role: 'auditor',
    credits: 2400,
    vertical: 'Audit Services',
  })
  // Phase 11A: ChipCo (Dave) — IC supplier whose published catalog
  // intersects MicroCo's PRM-3A. Pre-existing DA to GovCo seeds Bob's
  // "warm path" for Phase 11C's DA/EA flow separation work: Bob already
  // has visibility into ChipCo's catalog via the directory cluster, but
  // no Claims pull onto his canvas because no EA is paired yet.
  const dave = makeActor({
    id: 'dave-chipco',
    user: 'Dave',
    party: 'ChipCo',
    role: 'supplier',
    credits: 2400,
    vertical: 'Electronics',
  })

  // ── Alice's Assets ────────────────────────────────────────────────────
  const aPrmDatasheet = makeAsset({
    id: 'asset-prm-datasheet',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Power Regulation Module Datasheet',
    description: 'Official datasheet for PRM-3A rev. 4.',
    file: {
      uri: 'provenance://evidence/prm-datasheet-v4',
      filename: 'powerregulationmodule-datasheet.pdf',
      size: 2458792,
      mimeType: 'application/pdf',
      hash: 'sha256:prm-datasheet-v4',
      // Phase 11B: localPath points at a placeholder PDF in /public/ so
      // the Detail Panel's expand-evidence iframe has something real to
      // render. Prototype-only field; production resolves the file via
      // the QS URI lookup against `file.uri` instead.
      localPath: '/powerregulationmodule-datasheet.pdf',
    },
    registrationDate: '2026-02-10T14:18:00Z',
    parseResultIds: ['parse-prm-datasheet'],
  })
  const aPrmTestReport = makeAsset({
    id: 'asset-prm-testreport',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'PRM-3A Test Report',
    description: 'Bench test report for PRM-3A rev. 4.',
    file: {
      uri: 'provenance://evidence/prm-testreport-v4',
      filename: 'prm-test-report.pdf',
      size: 1853241,
      mimeType: 'application/pdf',
      hash: 'sha256:prm-testreport-v4',
    },
    registrationDate: '2026-02-14T11:02:00Z',
    parseResultIds: [],
  })
  const aPrmThermal = makeAsset({
    id: 'asset-prm-thermal',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'PRM-3A Thermal Analysis',
    description: 'Thermal simulation and bench correlation for PRM-3A.',
    file: {
      uri: 'provenance://evidence/prm-thermal-v4',
      filename: 'prm-thermal-analysis.pdf',
      size: 1153434,
      mimeType: 'application/pdf',
      hash: 'sha256:prm-thermal-v4',
    },
    registrationDate: '2026-02-18T09:33:00Z',
    parseResultIds: [],
  })
  const aVregDatasheet = makeAsset({
    id: 'asset-vreg-datasheet',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Voltage Regulator IC Datasheet',
    description: 'Datasheet for VREG-IC-500 rev. 2.',
    file: {
      uri: 'provenance://evidence/vreg-datasheet-v2',
      filename: 'voltageregulator-datasheet.pdf',
      size: 1887437,
      mimeType: 'application/pdf',
      hash: 'sha256:vreg-datasheet-v2',
      localPath: '/voltageregulator-datasheet.pdf',
    },
    registrationDate: '2026-02-12T16:05:00Z',
    parseResultIds: ['parse-vreg-datasheet'],
  })
  const aEmiDatasheet = makeAsset({
    id: 'asset-emi-datasheet',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'EMI Shield Assembly Datasheet',
    description: 'Board-level EMI shielding assembly datasheet.',
    file: {
      uri: 'provenance://evidence/emi-datasheet-v1',
      filename: 'emishielding-datasheet.pdf',
      size: 1258291,
      mimeType: 'application/pdf',
      hash: 'sha256:emi-datasheet-v1',
      localPath: '/emishielding-datasheet.pdf',
    },
    registrationDate: '2026-02-08T13:41:00Z',
    parseResultIds: ['parse-emi-datasheet'],
  })

  // ── Bob's Assets ─────────────────────────────────────────────────────
  // Avionics Module (the Sentinel-4 anchor) is the original Phase 1 Asset and
  // already carries inter-party DAs to MicroCo for the Power Reg + VReg Claims.
  const bAvionics = makeAsset({
    id: 'asset-bob-avionics',
    owner: bob.party,
    ownerDot: bob.partyDot,
    name: 'Avionics Module',
    description: 'Internal claim anchor for Sentinel-4 avionics integration.',
    file: {
      uri: 'provenance://evidence/avionics-integration-spec',
      filename: 'avionics-integration-spec.pdf',
      size: 4718592,
      mimeType: 'application/pdf',
      hash: 'sha256:avionics-integration-spec',
    },
    registrationDate: '2026-01-15T10:00:00Z',
    parseResultIds: [],
  })
  // Guidance Computer + Thermal Subsystem are unattached Bob anchors — added
  // for Phase 5 so the per-Asset request flow can be exercised end-to-end
  // against Alice's remaining un-disclosed Claims (e.g., EMI Shield).
  const bGuidance = makeAsset({
    id: 'asset-bob-guidance',
    owner: bob.party,
    ownerDot: bob.partyDot,
    name: 'Guidance Computer',
    description: 'Sentinel-4 attitude control and orbit determination compute module.',
    file: {
      uri: 'provenance://evidence/guidance-computer-spec',
      filename: 'guidance-computer-spec.pdf',
      size: 3210496,
      mimeType: 'application/pdf',
      hash: 'sha256:guidance-computer-spec',
    },
    registrationDate: '2026-01-22T11:30:00Z',
    parseResultIds: [],
  })
  const bThermal = makeAsset({
    id: 'asset-bob-thermal',
    owner: bob.party,
    ownerDot: bob.partyDot,
    name: 'Thermal Subsystem',
    description: 'Spacecraft thermal management — radiators, heaters, MLI blanket spec.',
    file: {
      uri: 'provenance://evidence/thermal-subsystem-spec',
      filename: 'thermal-subsystem-spec.pdf',
      size: 2854400,
      mimeType: 'application/pdf',
      hash: 'sha256:thermal-subsystem-spec',
    },
    registrationDate: '2026-02-01T09:00:00Z',
    parseResultIds: [],
  })

  // ── Carol's Assets ────────────────────────────────────────────────────
  const cAuditWorkspace = makeAsset({
    id: 'asset-carol-audit-workspace',
    owner: carol.party,
    ownerDot: carol.partyDot,
    name: 'AuditCo Evaluation Workspace',
    description: "Internal anchor Asset for Carol's evaluations.",
    file: {
      uri: 'provenance://evidence/auditco-workspace',
      filename: 'auditco-workspace.md',
      size: 4096,
      mimeType: 'text/markdown',
      hash: 'sha256:auditco-workspace',
    },
    registrationDate: '2026-01-20T09:00:00Z',
    parseResultIds: [],
  })
  // Carol's secondary anchor — useful for Story 3 (auditing additional Claims).
  const cComplianceQueue = makeAsset({
    id: 'asset-carol-compliance-queue',
    owner: carol.party,
    ownerDot: carol.partyDot,
    name: 'Compliance Audit Queue',
    description: 'Open audit engagements awaiting evidence disclosure.',
    file: {
      uri: 'provenance://evidence/auditco-compliance-queue',
      filename: 'auditco-compliance-queue.md',
      size: 8192,
      mimeType: 'text/markdown',
      hash: 'sha256:auditco-compliance-queue',
    },
    registrationDate: '2026-02-05T10:00:00Z',
    parseResultIds: [],
  })

  // ── ChipCo's Assets (Phase 11A) ───────────────────────────────────────
  // ChipCo supplies the IC components that go into MicroCo's PRM-3A
  // assembly. Three Assets seed enough material for a Claim with
  // referenced datasheet + test report + a separate Voltage Reference IC
  // Claim, plus a Parse Result against the IC datasheet.
  const dPrmIcDatasheet = makeAsset({
    id: 'asset-chipco-prm-ic-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'PRM-3A IC Datasheet',
    description: 'Datasheet for the buck-converter IC used in MicroCo PRM-3A.',
    file: {
      uri: 'provenance://evidence/chipco-prm-ic-datasheet-v3',
      filename: 'prm-3a-ic-datasheet.pdf',
      size: 1738112,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-prm-ic-datasheet-v3',
      // Phase 11B: placeholder PDF generated via scripts/generate-placeholder-pdfs.js.
      localPath: '/prm-3a-ic-datasheet.pdf',
    },
    registrationDate: '2026-02-04T11:00:00Z',
    parseResultIds: ['parse-chipco-prm-ic-datasheet'],
  })
  const dPrmIcTestReport = makeAsset({
    id: 'asset-chipco-prm-ic-testreport',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'PRM-3A IC Qualification Report',
    description: 'Bench + radiation qualification report for the PRM-3A IC.',
    file: {
      uri: 'provenance://evidence/chipco-prm-ic-testreport-v3',
      filename: 'prm-3a-ic-qualification-report.pdf',
      size: 2197504,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-prm-ic-testreport-v3',
      localPath: '/prm-3a-ic-qualification-report.pdf',
    },
    registrationDate: '2026-02-09T15:30:00Z',
    parseResultIds: [],
  })
  const dVrefDatasheet = makeAsset({
    id: 'asset-chipco-vref-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Voltage Reference IC Datasheet',
    description: 'Datasheet for ChipCo VREF-IC-220 ±0.05% precision reference.',
    file: {
      uri: 'provenance://evidence/chipco-vref-datasheet-v1',
      filename: 'voltage-reference-ic-datasheet.pdf',
      size: 1428736,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-vref-datasheet-v1',
      localPath: '/voltage-reference-ic-datasheet.pdf',
    },
    registrationDate: '2026-02-12T09:18:00Z',
    parseResultIds: [],
  })

  const assets = [
    aPrmDatasheet,
    aPrmTestReport,
    aPrmThermal,
    aVregDatasheet,
    aEmiDatasheet,
    bAvionics,
    bGuidance,
    bThermal,
    cAuditWorkspace,
    cComplianceQueue,
    dPrmIcDatasheet,
    dPrmIcTestReport,
    dVrefDatasheet,
  ]

  // ── Parse Results (Alice's parsed datasheets) ─────────────────────────
  const prPrmDatasheet = makeParseResult({
    id: 'parse-prm-datasheet',
    owner: alice.party,
    sourceAssetId: aPrmDatasheet.id,
    templateId: 'tmpl-electronics-component',
    templateName: 'Electronics Component Profile',
    templateVersion: 2,
    parseDate: '2026-02-20T15:47:00Z',
    fields: [
      { id: 'f-voltage', name: 'Operating voltage', value: '3.3V ±5%', confidence: 0.95 },
      { id: 'f-power', name: 'Power dissipation', value: '< 2W at rated current', confidence: 0.91 },
      { id: 'f-temp', name: 'Temperature range', value: '-55°C to +125°C', confidence: 0.93 },
      { id: 'f-radiation', name: 'Radiation tolerance', value: 'TID > 100 krad(Si)', confidence: 0.72 },
      { id: 'f-itar', name: 'ITAR classification', value: 'Category XV, §121.1', confidence: 0.88 },
    ],
  })
  const prVregDatasheet = makeParseResult({
    id: 'parse-vreg-datasheet',
    owner: alice.party,
    sourceAssetId: aVregDatasheet.id,
    templateId: 'tmpl-electronics-component',
    templateName: 'Electronics Component Profile',
    templateVersion: 2,
    parseDate: '2026-02-25T17:12:00Z',
    fields: [
      { id: 'f-vin', name: 'Input voltage range', value: '4.5V – 16V', confidence: 0.94 },
      { id: 'f-vout', name: 'Output voltage', value: '3.3V ±2%', confidence: 0.92 },
      { id: 'f-iout', name: 'Output current', value: '500mA max', confidence: 0.9 },
      { id: 'f-dropout', name: 'Dropout voltage', value: '350mV @ 500mA', confidence: 0.78 },
      { id: 'f-pkg', name: 'Package type', value: 'SOT-223', confidence: 0.96 },
    ],
  })
  const prEmiDatasheet = makeParseResult({
    id: 'parse-emi-datasheet',
    owner: alice.party,
    sourceAssetId: aEmiDatasheet.id,
    templateId: 'tmpl-mechanical-assembly',
    templateName: 'Mechanical Assembly Profile',
    templateVersion: 1,
    parseDate: '2026-02-18T14:03:00Z',
    fields: [
      { id: 'f-material', name: 'Shield material', value: 'Nickel silver alloy', confidence: 0.93 },
      { id: 'f-thickness', name: 'Wall thickness', value: '0.3mm ±0.02', confidence: 0.91 },
      { id: 'f-freq', name: 'Shielding frequency range', value: '100 MHz – 10 GHz', confidence: 0.9 },
      { id: 'f-effectiveness', name: 'Shielding effectiveness', value: '> 60 dB @ 1 GHz', confidence: 0.76 },
      { id: 'f-mounting', name: 'Mounting method', value: 'Soldered perimeter with snap-fit lid', confidence: 0.89 },
    ],
  })
  // Phase 11A: ChipCo's IC datasheet parse — same template Alice uses for
  // her PRM datasheet so the demo has structural symmetry across suppliers.
  const prChipcoPrmIcDatasheet = makeParseResult({
    id: 'parse-chipco-prm-ic-datasheet',
    owner: dave.party,
    sourceAssetId: dPrmIcDatasheet.id,
    templateId: 'tmpl-electronics-component',
    templateName: 'Electronics Component Profile',
    templateVersion: 2,
    parseDate: '2026-02-22T11:08:00Z',
    fields: [
      { id: 'f-vin', name: 'Input voltage range', value: '6V – 36V', confidence: 0.95 },
      { id: 'f-vout', name: 'Output voltage', value: '3.3V ±2%', confidence: 0.93 },
      { id: 'f-iout', name: 'Output current', value: '3A continuous', confidence: 0.92 },
      { id: 'f-eff', name: 'Conversion efficiency', value: '≥ 92% at full load', confidence: 0.86 },
      { id: 'f-radiation', name: 'Radiation tolerance', value: 'TID > 75 krad(Si)', confidence: 0.74 },
    ],
  })
  const parseResults = [prPrmDatasheet, prVregDatasheet, prEmiDatasheet, prChipcoPrmIcDatasheet]

  // ── Alice's Claims ────────────────────────────────────────────────────
  const cPrm = makeClaim({
    id: 'claim-prm-assembly',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Power Regulation Module Assembly',
    description: 'Certified assembly backed by datasheet, test report, and thermal analysis.',
    referencedAssetIds: [aPrmDatasheet.id, aPrmTestReport.id, aPrmThermal.id],
    // Phase 11C.1: pre-set acknowledgments demonstrate the requester-side
    // gating UX. Two acks here so the cold-path Step 2 has multiple checkboxes.
    acknowledgments: [
      {
        id: 'ack-claim-prm-assembly-1',
        title: 'Result confidentiality',
        description: 'Evaluation results are for internal use only and will not be shared with third parties.',
      },
      {
        id: 'ack-claim-prm-assembly-2',
        title: 'Attribution',
        description: 'If results are referenced externally (audits, certifications), MicroCo will be credited.',
      },
    ],
    createdDate: '2026-03-01T10:00:00Z',
    amendments: [],
  })
  const cVreg = makeClaim({
    id: 'claim-vreg-ic',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Voltage Regulator IC',
    description: 'Fully disclosed VREG-IC-500 component with datasheet.',
    referencedAssetIds: [aVregDatasheet.id],
    createdDate: '2026-03-02T09:30:00Z',
    amendments: [],
  })
  const cEmi = makeClaim({
    id: 'claim-emi-shield',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'EMI Shield Assembly',
    description: 'Board-level EMI shield for high-frequency noise suppression.',
    referencedAssetIds: [aEmiDatasheet.id],
    createdDate: '2026-02-15T11:45:00Z',
    amendments: [],
  })
  // ── ChipCo's Claims (Phase 11A) ───────────────────────────────────────
  const cChipcoPrmIc = makeClaim({
    id: 'claim-chipco-prm-ic',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'PRM-3A IC Compliance',
    description: 'Buck-converter IC qualified for PRM-3A — datasheet + radiation qual report.',
    referencedAssetIds: [dPrmIcDatasheet.id, dPrmIcTestReport.id],
    // Phase 11C.1: single ack on ChipCo's Claim drives the warm-path
    // EARequestModal gate. (Bob already has the DA → only the EA flow.)
    acknowledgments: [
      {
        id: 'ack-claim-chipco-prm-ic-1',
        title: 'Result confidentiality',
        description: 'Evaluation results are for internal use only and will not be shared with third parties.',
      },
    ],
    createdDate: '2026-02-26T10:00:00Z',
    amendments: [],
  })
  const cChipcoVref = makeClaim({
    id: 'claim-chipco-vref',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Voltage Reference IC Spec',
    description: 'VREF-IC-220 precision voltage reference component spec.',
    referencedAssetIds: [dVrefDatasheet.id],
    createdDate: '2026-02-28T09:30:00Z',
    amendments: [],
  })
  const claims = [cPrm, cVreg, cEmi, cChipcoPrmIc, cChipcoVref]

  // ── Disclosure Agreements ─────────────────────────────────────────────
  // Ownership/internal: Actor → each of their Assets (Full, implicit).
  // Edge derivation (Phase 2): grantor's Actor node ↔ subject.
  const aliceOwnAssets = [
    aPrmDatasheet,
    aPrmTestReport,
    aPrmThermal,
    aVregDatasheet,
    aEmiDatasheet,
  ].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: alice.party,
      ownerDot: alice.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const bobOwnAssets = [bAvionics, bGuidance, bThermal].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: bob.party,
      ownerDot: bob.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const carolOwnAssets = [cAuditWorkspace, cComplianceQueue].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: carol.party,
      ownerDot: carol.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  // Phase 11A: ChipCo's ownership DAs (Assets + Claims + Parse Result).
  const daveOwnAssets = [dPrmIcDatasheet, dPrmIcTestReport, dVrefDatasheet].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: dave.party,
      ownerDot: dave.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const daveOwnClaims = [cChipcoPrmIc, cChipcoVref].map((c) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${c.id}`,
      owner: dave.party,
      ownerDot: dave.partyDot,
      subject: { kind: 'claim', id: c.id },
      scope: {},
      terms: { createdDate: c.createdDate },
    }),
  )
  const daveClaimRefEdges = [cChipcoPrmIc, cChipcoVref].flatMap((claim) =>
    claim.referencedAssetIds.map((assetId) =>
      makeInternalDisclosureAgreement({
        id: `da-ref-${claim.id}-${assetId}`,
        owner: claim.owner,
        ownerDot: claim.ownerDot,
        subject: { kind: 'claim', id: claim.id },
        scope: { assetIds: [assetId], includeDerivatives: true },
        terms: { createdDate: claim.createdDate },
      }),
    ),
  )
  const daveParseResultRefEdge = makeInternalDisclosureAgreement({
    id: `da-parse-${prChipcoPrmIcDatasheet.id}`,
    owner: dave.party,
    ownerDot: dave.partyDot,
    subject: { kind: 'parseResult', id: prChipcoPrmIcDatasheet.id },
    scope: { assetIds: [prChipcoPrmIcDatasheet.sourceAssetId], includeDerivatives: true },
    terms: { createdDate: prChipcoPrmIcDatasheet.parseDate },
  })

  // Actor → each of their Claims (Full, implicit). Edge: Actor ↔ Claim.
  const aliceOwnClaims = claims.map((c) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${c.id}`,
      owner: alice.party,
      ownerDot: alice.partyDot,
      subject: { kind: 'claim', id: c.id },
      scope: {},
      terms: { createdDate: c.createdDate },
    }),
  )

  // Claim → each referenced Asset (Full, implicit) — one DA per (claim, asset) pair.
  // subject is the Claim; scope.assetIds names the referenced Asset. Edge: Claim ↔ Asset.
  const claimRefEdges = claims.flatMap((claim) =>
    claim.referencedAssetIds.map((assetId) =>
      makeInternalDisclosureAgreement({
        id: `da-ref-${claim.id}-${assetId}`,
        owner: claim.owner,
        ownerDot: claim.ownerDot,
        subject: { kind: 'claim', id: claim.id },
        scope: { assetIds: [assetId], includeDerivatives: true },
        terms: { createdDate: claim.createdDate },
      }),
    ),
  )

  // Parse Result → source Asset (Full, implicit) — one DA per parse result (spec §3.3).
  // subject is the Parse Result; scope.assetIds names the source Asset. Edge: Parse ↔ Asset.
  const parseResultRefEdges = parseResults.map((pr) =>
    makeInternalDisclosureAgreement({
      id: `da-parse-${pr.id}`,
      owner: pr.owner,
      ownerDot: makeDot(pr.owner),
      subject: { kind: 'parseResult', id: pr.id },
      scope: { assetIds: [pr.sourceAssetId], includeDerivatives: true },
      terms: { createdDate: pr.parseDate },
    }),
  )

  // Explicit inter-party Disclosure Agreements. Edge: subject (Claim) ↔ granteeAssetId.
  const daAliceToBobPrm = makeDisclosureAgreement({
    id: 'da-alice-bob-prm',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cPrm.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: {
      assetIds: [aPrmDatasheet.id],
      fieldIds: [
        `${prPrmDatasheet.id}::f-voltage`,
        `${prPrmDatasheet.id}::f-power`,
        `${prPrmDatasheet.id}::f-temp`,
        `${prPrmDatasheet.id}::f-radiation`,
        `${prPrmDatasheet.id}::f-itar`,
      ],
      includeDerivatives: false,
    },
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      expires: '2027-03-04T16:42:00Z',
      autoRenew: false,
    },
  })
  const daAliceToBobVreg = makeDisclosureAgreement({
    id: 'da-alice-bob-vreg',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cVreg.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: {
      assetIds: [aVregDatasheet.id],
      includeDerivatives: true,
    },
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      expires: '2027-03-04T16:42:00Z',
      autoRenew: false,
    },
  })
  const daAliceToCarolPrm = makeDisclosureAgreement({
    id: 'da-alice-carol-prm',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cPrm.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: {
      assetIds: [aPrmDatasheet.id, aPrmTestReport.id, aPrmThermal.id],
      includeDerivatives: true,
    },
    terms: {
      createdDate: '2026-03-10T10:00:00Z',
      expires: '2027-03-10T10:00:00Z',
      autoRenew: false,
    },
  })

  // Public-directory disclosures (Alice publishes to Radiant Network). subject = Claim.
  const daAlicePublicPrm = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-prm',
    grantor: alice.party,
    grantorDot: alice.partyDot,
    subject: { kind: 'claim', id: cPrm.id },
    type: 'selective',
    scope: {
      assetIds: [aPrmDatasheet.id],
      fieldIds: [`${prPrmDatasheet.id}::f-voltage`, `${prPrmDatasheet.id}::f-temp`],
      includeDerivatives: false,
    },
    terms: { createdDate: '2026-02-01T17:08:00Z' },
  })
  const daAlicePublicVreg = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-vreg',
    grantor: alice.party,
    grantorDot: alice.partyDot,
    subject: { kind: 'claim', id: cVreg.id },
    type: 'full',
    scope: { assetIds: [aVregDatasheet.id], includeDerivatives: true },
    terms: { createdDate: '2026-02-01T17:22:00Z' },
  })
  const daAlicePublicEmi = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-emi',
    grantor: alice.party,
    grantorDot: alice.partyDot,
    subject: { kind: 'claim', id: cEmi.id },
    type: 'full',
    scope: { assetIds: [aEmiDatasheet.id], includeDerivatives: true },
    terms: { createdDate: '2026-02-10T15:30:00Z' },
  })

  // Phase 11A: warm-path "umbrella" DA from ChipCo to GovCo.
  // Pre-existing inter-party DA that gives Bob directory-level visibility
  // into ChipCo's catalog without yet pulling any Claim onto his canvas
  // (no paired EA — Phase 11C's flow will let Bob request one). The
  // DirectoryLayer's per-role cluster filter keys off this DA: ChipCo's
  // dot cluster appears on Bob's directory view because at least one
  // active DA from ChipCo to his party exists. The schema doesn't have a
  // dedicated "umbrella" type today; semantically this is the warm-path
  // anchor and Phase 11C may extend the schema if the umbrella concept
  // needs first-class representation.
  const daChipcoToBobPrmIc = makeDisclosureAgreement({
    id: 'da-chipco-bob-prm-ic',
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoPrmIc.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: {
      assetIds: [dPrmIcDatasheet.id, dPrmIcTestReport.id],
      includeDerivatives: true,
    },
    terms: {
      createdDate: '2026-03-12T14:00:00Z',
      expires: '2027-03-12T14:00:00Z',
      autoRenew: false,
    },
  })

  // ── Evaluation Agreements (paired with explicit inter-party DAs) ──────
  const eaBobOnPrm = makeEvaluationAgreement({
    id: 'ea-bob-prm',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    claimId: cPrm.id,
    granteeAssetId: bAvionics.id,
    disclosureAgreementId: daAliceToBobPrm.id,
    authorizedRequirementsSetIds: ['req-mil-prf-55681-v1'],
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      evaluationDeadline: '2026-04-04T16:42:00Z',
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: {
      onSatisfactory: 'Certificate of compliance issued to grantee',
      onUnsatisfactory: null,
    },
  })
  const eaBobOnVreg = makeEvaluationAgreement({
    id: 'ea-bob-vreg',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    claimId: cVreg.id,
    granteeAssetId: bAvionics.id,
    disclosureAgreementId: daAliceToBobVreg.id,
    authorizedRequirementsSetIds: ['req-mil-prf-55681-v1'],
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      evaluationDeadline: '2026-04-15T16:42:00Z',
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: { onSatisfactory: null, onUnsatisfactory: null },
  })
  const eaCarolOnPrm = makeEvaluationAgreement({
    id: 'ea-carol-prm',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    claimId: cPrm.id,
    granteeAssetId: cAuditWorkspace.id,
    disclosureAgreementId: daAliceToCarolPrm.id,
    authorizedRequirementsSetIds: ['req-auditco-prm-audit-v1'],
    terms: {
      createdDate: '2026-03-10T10:00:00Z',
      evaluationDeadline: '2026-04-20T10:00:00Z',
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: {
      onSatisfactory: 'Audit certification issued to AuditCo',
      onUnsatisfactory: null,
    },
  })
  const evaluationAgreements = [eaBobOnPrm, eaBobOnVreg, eaCarolOnPrm]

  // ── Evaluation Results ────────────────────────────────────────────────
  const erBobPrm = makeEvaluationResult({
    id: 'eval-bob-prm-001',
    owner: bob.party,
    ownerDot: bob.partyDot,
    evaluationAgreementId: eaBobOnPrm.id,
    claimId: cPrm.id,
    granteeAssetId: bAvionics.id,
    requirementsSet: {
      id: 'req-mil-prf-55681-v1',
      name: 'MIL-PRF-55681 Compliance',
      version: 1,
    },
    results: [
      { requirementId: 'req-001', label: 'Power output stability', value: '3.3V ±0.5% under load', status: 'satisfactory' },
      { requirementId: 'req-002', label: 'Thermal dissipation', value: '< 2W at rated current', status: 'satisfactory' },
      { requirementId: 'req-003', label: 'Operating temperature range', value: '-55°C to +125°C', status: 'satisfactory' },
      { requirementId: 'req-004', label: 'Radiation tolerance', value: 'TID > 100 krad(Si)', status: 'unsatisfactory' },
      { requirementId: 'req-005', label: 'ITAR classification', value: 'Category XV, §121.1', status: 'satisfactory' },
    ],
    evidenceUsed: [aPrmDatasheet.id],
    evaluationDate: '2026-03-09T14:32:00Z',
    status: 'active',
    supersededBy: null,
  })
  const erCarolPrm = makeEvaluationResult({
    id: 'eval-carol-prm-001',
    owner: carol.party,
    ownerDot: carol.partyDot,
    evaluationAgreementId: eaCarolOnPrm.id,
    claimId: cPrm.id,
    granteeAssetId: cAuditWorkspace.id,
    requirementsSet: {
      id: 'req-auditco-prm-audit-v1',
      name: 'AuditCo PRM Audit',
      version: 1,
    },
    results: [
      { requirementId: 'a-001', label: 'Document provenance', value: 'All documents have verifiable provenance', status: 'satisfactory' },
      { requirementId: 'a-002', label: 'Test report independence', value: 'Test report references independent lab', status: 'satisfactory' },
      { requirementId: 'a-003', label: 'Thermal margin ≥ 15%', value: 'Thermal margin 12% at rated current', status: 'unsatisfactory' },
    ],
    evidenceUsed: [aPrmDatasheet.id, aPrmTestReport.id, aPrmThermal.id],
    evaluationDate: '2026-03-18T14:00:00Z',
    status: 'active',
    supersededBy: null,
  })
  const evaluationResults = [erBobPrm, erCarolPrm]

  // Proof-of-Evaluation Disclosure Agreements (Eval Result → Claim owner).
  // subject = evalResult; edge derivation resolves the Claim via the Eval Result's claimId.
  const daProofBobPrm = makeProofOfEvalDisclosureAgreement({
    id: 'da-proof-bob-prm',
    evaluator: bob.party,
    evaluatorDot: bob.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    evaluationResultId: erBobPrm.id,
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daProofCarolPrm = makeProofOfEvalDisclosureAgreement({
    id: 'da-proof-carol-prm',
    evaluator: carol.party,
    evaluatorDot: carol.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    evaluationResultId: erCarolPrm.id,
    terms: { createdDate: erCarolPrm.evaluationDate },
  })

  // ── Proof-only Claim DA (Phase 11D.3) ────────────────────────────────
  // Alice → Dave, subject = Alice's PRM Claim, type = 'proofonly'. Discloses
  // Bob's MIL-PRF-55681 Eval Result to Dave without exposing the underlying
  // Assets. On Dave's canvas: the Claim is pulled in, the disclosed Eval
  // Result is pulled in alongside it, and a proof-only-styled edge connects
  // Eval Result → Claim. The conventional Claim ↔ granteeAssetId anchor edge
  // also renders so the Claim has a visual home on Dave's canvas.
  // (Re-disclosure semantics — whether Alice can disclose Bob's Eval Result —
  // are filed as #141; default-allow today.)
  const daAliceToDavePrmProof = makeDisclosureAgreement({
    id: 'da-alice-dave-prm-proof',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: dave.party, dot: dave.partyDot },
    subject: { kind: 'claim', id: cPrm.id },
    granteeAssetId: dPrmIcDatasheet.id,
    type: 'proofonly',
    scope: {
      evaluationResultIds: [erBobPrm.id],
      includeDerivatives: false,
    },
    terms: {
      createdDate: '2026-03-20T11:15:00Z',
      expires: '2027-03-20T11:15:00Z',
      autoRenew: false,
    },
  })

  // Ownership edges for each Eval Result → evaluator's own Asset (spec §3.5).
  // subject = evalResult; scope.assetIds names the evaluator's anchor Asset.
  // Edge: subject (evalResult) ↔ scope.assetIds[0].
  const daOwnEvalBob = makeInternalDisclosureAgreement({
    id: `da-own-${erBobPrm.id}`,
    owner: bob.party,
    ownerDot: bob.partyDot,
    subject: { kind: 'evalResult', id: erBobPrm.id },
    scope: {
      assetIds: [bAvionics.id],
    },
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daOwnEvalCarol = makeInternalDisclosureAgreement({
    id: `da-own-${erCarolPrm.id}`,
    owner: carol.party,
    ownerDot: carol.partyDot,
    subject: { kind: 'evalResult', id: erCarolPrm.id },
    scope: {
      assetIds: [cAuditWorkspace.id],
    },
    terms: { createdDate: erCarolPrm.evaluationDate },
  })

  const disclosureAgreements = [
    ...aliceOwnAssets,
    ...bobOwnAssets,
    ...carolOwnAssets,
    ...daveOwnAssets,
    ...aliceOwnClaims,
    ...daveOwnClaims,
    ...claimRefEdges,
    ...daveClaimRefEdges,
    ...parseResultRefEdges,
    daveParseResultRefEdge,
    daAliceToBobPrm,
    daAliceToBobVreg,
    daAliceToCarolPrm,
    daChipcoToBobPrmIc,
    daAlicePublicPrm,
    daAlicePublicVreg,
    daAlicePublicEmi,
    daProofBobPrm,
    daProofCarolPrm,
    daAliceToDavePrmProof,
    daOwnEvalBob,
    daOwnEvalCarol,
  ]

  return {
    actors: [bob, alice, carol, dave, RADIANT_NETWORK_ACTOR],
    assets,
    parseResults,
    claims,
    disclosureAgreements,
    evaluationAgreements,
    evaluationResults,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VIEW BUILDERS — per spec §6
// ═══════════════════════════════════════════════════════════════════════════
//
// Each actor sees a different slice of the shared artifact set. Visibility is
// driven by: (a) ownership, (b) Disclosure + Evaluation Agreements the actor is
// a party to (including public-directory disclosures), and (c) Evaluation Results
// the actor is a party to.

/**
 * Collect the set of artifact references visible to `actor` from `shared`.
 * Returns a narrowed artifact bundle plus a flag set for downstream adapters.
 */
function buildViewForActor(actor, shared) {
  const party = actor.party
  const ownedAssets = shared.assets.filter((a) => a.owner === party)
  const ownedClaims = shared.claims.filter((c) => c.owner === party)
  const ownedParseResults = shared.parseResults.filter((p) => p.owner === party)
  // Phase 9D.1.1 (#112 Fix 6): dismissed-revoked Eval Results are invisible
  // owner-side too. Seeded ERs are never dismissed (flag only lands via the
  // provisional update path).
  const ownedEvaluationResults = shared.evaluationResults.filter((e) => e.owner === party && !e._dismissedRevoked)

  // Disclosure Agreements where this actor is grantor or grantee.
  // Counterparty internal DAs are included only if *both* endpoints are visible on
  // this actor's canvas (see the second-pass loop after visibility is resolved). This
  // handles e.g. Carol's Eval-Result ownership edge on Alice's canvas — Carol owns
  // the Eval Result and her AuditCo Workspace, both already pulled onto Alice's
  // canvas via Proof-of-Evaluation + §6.1 grantee anchor, so the ownership edge
  // between them renders from the pre-existing DA rather than requiring a pulled-in
  // Carol Actor node (which would conflict with §6.4's "counterparty internals are
  // private" principle).
  // Phase 9D.1.1 (#112 Fix 6): dismissed-revoked items stay in provisionals
  // for audit (their presence shadows the seeded row via mergeProvisionals)
  // but are invisible in every view-layer output — both the active and the
  // revoked-meta arrays. Applied as a pre-filter on the party-scoped
  // agreement + result sets so downstream visibility, pull-in, and edge
  // derivation never encounters them.
  const partyDisclosureAgreements = shared.disclosureAgreements.filter(
    (d) => (d.grantor.party === party || d.grantee.party === party) && !d._dismissedRevoked,
  )
  const disclosureAgreements = [...partyDisclosureAgreements]

  // Evaluation Agreements where this actor is grantor or grantee.
  const evaluationAgreements = shared.evaluationAgreements.filter(
    (e) => (e.grantor.party === party || e.grantee.party === party) && !e._dismissedRevoked,
  )

  // Pulled-in Claims — the grantee side sees the grantor's Claim as a parent-layer
  // node when both a Disclosure Agreement and an Evaluation Agreement exist (spec §1,
  // §6.2). An Evaluation Agreement's presence is the gating condition.
  const pairedDaIds = new Set(
    evaluationAgreements.map((ea) => ea.disclosureAgreementId).filter(Boolean),
  )
  const pulledInClaimIds = new Set()
  for (const ea of evaluationAgreements) {
    if (ea.grantee.party !== party) continue // only pull in as grantee
    pulledInClaimIds.add(ea.claimId)
  }
  // Phase 11D.3: proof-only Claim DAs also pull the source Claim in for the
  // grantee, regardless of EA presence — proof-only is a standalone disclosure
  // type whose payload is the chosen Eval Results, anchored to the Claim.
  for (const da of disclosureAgreements) {
    if (da._revokedMeta) continue
    if (da.subject?.kind !== 'claim') continue
    if (da.type !== 'proofonly') continue
    if (da.grantee.party !== party) continue
    if (da.grantor.party === party) continue
    pulledInClaimIds.add(da.subject.id)
  }
  const pulledInClaims = shared.claims.filter(
    (c) => c.owner !== party && pulledInClaimIds.has(c.id),
  )

  // Eval Results visible: those the actor owns, plus those with a Proof-of-Evaluation
  // Disclosure Agreement where the actor is the grantee (claim owner seeing
  // evaluator's result), plus those disclosed via a proof-only Claim DA where
  // the actor is grantee (Phase 11D.3 — Alice → Dave proof-only of Bob's ER).
  const proofDaEvalResultIds = new Set()
  // Phase 11D.3: track proof-only-pulled Eval Result ids separately so the
  // canvas adapter can place them in their own column near the pulled Claim
  // (instead of mixing them in with the actor's own evaluation column, which
  // is where proof-of-evaluation results live).
  const proofOnlyPulledEvalIds = new Set()
  for (const da of disclosureAgreements) {
    // Phase 9D.1.5: revoked POE DAs (cascade-annotated by 9D.1.4 when their
    // backing EA is revoked) no longer confer ER visibility to the Claim
    // owner. Without this filter, the grantor's `visibleEvaluationResults`
    // kept the grantee's ER even though the access agreement was revoked,
    // so the orphaned ER lingered on the grantor's canvas.
    if (da._revokedMeta) continue
    if (da.subject.kind === 'evalResult') {
      // Proof-of-eval: grantee is the claim owner receiving the result.
      if (da.grantee.party === party && da.grantor.party !== party) {
        proofDaEvalResultIds.add(da.subject.id)
      }
      continue
    }
    // Phase 11D.3: proof-only Claim DA → pull each chosen Eval Result onto
    // the grantee's canvas alongside the source Claim.
    if (da.subject.kind === 'claim' && da.type === 'proofonly') {
      if (da.grantee.party === party && da.grantor.party !== party) {
        for (const erId of (da.scope?.evaluationResultIds || [])) {
          proofDaEvalResultIds.add(erId)
          proofOnlyPulledEvalIds.add(erId)
        }
      }
    }
  }
  const visibleEvaluationResults = shared.evaluationResults.filter(
    (e) => (e.owner === party || proofDaEvalResultIds.has(e.id)) && !e._dismissedRevoked,
  )

  // Parse Results that belong to visible Assets' source, or that the actor owns.
  // In V2.2, Parse Results travel with their source Asset; counterparties see
  // them through the Disclosure Agreement scope. For Phase 2 rendering, only
  // owner-side Parse Results are rendered as parent-layer nodes (spec §3.3).
  const visibleParseResults = ownedParseResults

  // Assets pulled in are ASYMMETRIC per spec §6:
  //   • As grantee (Bob's view of Alice's disclosure): Alice's Assets are NOT pulled in
  //     (§6.4: "Bob does not see Alice's individual Assets — he only sees her Claim").
  //   • As grantor (Alice's view of her disclosure to Bob): Bob's `granteeAssetId` IS
  //     pulled in as the anchor where the edge lands on Bob's canvas (§6.1).
  //   • Similarly, a proof-of-eval DA pulls in the evaluator's granteeAssetId for the
  //     claim owner's canvas (the Eval Result's ownership edge to the evaluator's Asset
  //     is an internal ownership relation and not pulled in for the claim owner).
  // Phase 6 carry-over #5: provisional requests live ONLY in the grantor's
  // notification inbox until they accept. The grantor's canvas stays unchanged
  // during the provisional state — no counterparty Asset is pulled in. After
  // acceptance, the DA's type flips to full/selective/proofonly and the
  // grantee-side anchor pulls in normally with a reveal animation.
  const pulledInAssetIds = new Set()
  for (const da of disclosureAgreements) {
    if (da.grantor.party !== party) continue
    if (da.grantee.party === party) continue
    if (da.grantee.party === RADIANT_NETWORK_PARTY) continue
    if (!da.granteeAssetId) continue
    if (da.type === 'provisional') continue
    // Phase 9D: revoked DAs no longer pull the counterparty anchor onto the
    // grantor's canvas — the disclosure relationship is terminated.
    if (da._revokedMeta) continue
    pulledInAssetIds.add(da.granteeAssetId)
  }
  const pulledInAssets = shared.assets.filter(
    (a) => a.owner !== party && pulledInAssetIds.has(a.id),
  )
  const visibleAssets = [...ownedAssets, ...pulledInAssets]
  const visibleClaims = [...ownedClaims, ...pulledInClaims]

  // Radiant Network inclusion — only if actor has published at least one Claim.
  const hasPublished = shared.disclosureAgreements.some(
    (d) =>
      d.grantor.party === party && d.grantee.party === RADIANT_NETWORK_PARTY,
  )
  const actors = [actor]
  if (hasPublished) actors.push(RADIANT_NETWORK_ACTOR)

  // Second-pass inclusion — counterparty internal DAs whose endpoints are all
  // visible on this actor's canvas. Guarded to Eval-Result ownership DAs today
  // (subject.kind='evalResult' + grantor===grantee + scope.assetIds non-empty)
  // so we don't leak unrelated internal edges. Widen this pass deliberately if
  // future phases need additional cross-party ownership visibility.
  const visibleAssetIds = new Set(visibleAssets.map((a) => a.id))
  const visibleEvalResultIds = new Set(visibleEvaluationResults.map((e) => e.id))
  for (const d of shared.disclosureAgreements) {
    if (d.grantor.party === party || d.grantee.party === party) continue // already included
    if (d.grantor.party !== d.grantee.party) continue // only internal counterparty DAs
    if (d.subject.kind !== 'evalResult') continue
    if (!visibleEvalResultIds.has(d.subject.id)) continue
    const assetIds = d.scope?.assetIds
    if (!Array.isArray(assetIds) || assetIds.length === 0) continue
    if (!assetIds.every((aid) => visibleAssetIds.has(aid))) continue
    disclosureAgreements.push(d)
  }

  // Cross-party actor nodes are NOT rendered on this actor's canvas — the Actor
  // node is personal to each view (see §6). Counterparty artifacts appear as
  // pulled-in Claims/Assets anchored to the actor's own Asset, not to a Party node.

  // Decline records — claims previously requested by this actor but declined by
  // the owner. Per spec §11.4 these surface on the requester's canvas in a
  // "Disclosure Declined" state until the requester dismisses them.
  // Phase 6.5 #3: also derive declined state from DAs annotated with
  // `_declineMeta` (handler keeps the provisional DA in state so the synthetic
  // edge to the requester's anchor Asset persists until dismissal).
  const declineRecordsForActor = (shared.declineRecords || []).filter(
    (r) => r.requesterParty === party,
  )
  const declinedClaimIds = new Map() // claimId → record (for adapter)
  for (const r of declineRecordsForActor) declinedClaimIds.set(r.claimId, r)
  for (const d of partyDisclosureAgreements) {
    if (!d._declineMeta) continue
    if (d.grantee.party !== party) continue
    if (declinedClaimIds.has(d.subject.id)) continue
    declinedClaimIds.set(d.subject.id, {
      claimId: d.subject.id,
      requesterParty: d.grantee.party,
      ownerParty: d.grantor.party,
      requesterAssetId: d.granteeAssetId,
      reason: d._declineMeta.reason,
      declinedDate: d._declineMeta.declinedDate,
    })
  }
  // Phase 11C (spec §11.6a): warm-path EA-only declines flag the Claim as
  // declined for the requester. Same pattern as DA decline above but the
  // declined artifact is the EA, not the DA.
  for (const e of evaluationAgreements) {
    if (!e._declineMeta) continue
    if (e.grantee?.party !== party) continue
    if (declinedClaimIds.has(e.claimId)) continue
    declinedClaimIds.set(e.claimId, {
      claimId: e.claimId,
      requesterParty: e.grantee.party,
      ownerParty: e.grantor.party,
      requesterAssetId: e.granteeAssetId,
      reason: e._declineMeta.reason,
      declinedDate: e._declineMeta.declinedDate,
      eaOnly: true, // flag so handlers can route to EA-only dismiss
    })
  }
  // Add the declined claims to the visible set so the adapter can render them.
  for (const [claimId, r] of declinedClaimIds) {
    if (!visibleClaims.some((c) => c.id === claimId)) {
      const claim = shared.claims.find((c) => c.id === claimId)
      if (claim) visibleClaims.push(claim)
    }
    if (r.requesterAssetId && !visibleAssets.some((a) => a.id === r.requesterAssetId)) {
      const asset = shared.assets.find((a) => a.id === r.requesterAssetId)
      if (asset && asset.owner === party) visibleAssets.push(asset)
    }
  }

  // Mark claims / assets as provisional when their only connection to this
  // actor is a provisional DA (i.e., an outstanding request not yet responded
  // to). Visual treatment flows from this set in the adapter.
  // Phase 6.5 #3: declined claims (above) are NOT also marked provisional —
  // decline takes precedence over awaiting-response.
  const provisionalClaimIds = new Set()
  const provisionalAssetIds = new Set()
  for (const pulledId of pulledInClaimIds) {
    if (declinedClaimIds.has(pulledId)) continue
    // Phase 11C.1 fix: surface provisional state when ANY DA on the Claim
    // (where the actor is grantee) is `type === 'provisional'`. The legacy
    // `every`-based check required ALL related DAs to be provisional, which
    // missed cases where the user re-requests against a Claim they already
    // have a pre-existing active DA on — backlog #134 will gate that case
    // properly at the UI layer; meanwhile the visual state needs to reflect
    // the pending request.
    const provisionalDa = disclosureAgreements.find(
      (d) => d.subject.kind === 'claim' && d.subject.id === pulledId &&
             d.type === 'provisional' && d.grantee?.party === party,
    )
    if (provisionalDa) {
      provisionalClaimIds.add(pulledId)
    }
  }
  // Phase 11C (spec §11.6a): warm-path provisional EAs flag the Claim as
  // provisional on the requester's view too. The DA is already active so the
  // legacy DA-only check above wouldn't catch it; we also add Claims that
  // have a provisional EA where the active actor is grantee (and the EA isn't
  // declined). Visually identical to cold-path provisional treatment.
  for (const ea of evaluationAgreements) {
    if (!ea._provisional) continue
    if (ea._declineMeta) continue
    if (ea.grantee?.party !== party) continue
    if (declinedClaimIds.has(ea.claimId)) continue
    provisionalClaimIds.add(ea.claimId)
  }
  for (const pulledId of pulledInAssetIds) {
    const relatedDAs = disclosureAgreements.filter(
      (d) => (d.granteeAssetId === pulledId || (d.subject.kind === 'asset' && d.subject.id === pulledId)) &&
             d.grantor.party === party && d.grantee.party !== party,
    )
    if (relatedDAs.length > 0 && relatedDAs.every((d) => d.type === 'provisional' || d.status !== 'active')) {
      provisionalAssetIds.add(pulledId)
    }
  }

  // Phase 9A.4 Gate B: pending transfers where this actor is the SENDER
  // produce a TRANSFERRING badge on the actor's Asset. Map: assetId → transfer
  // record. The canvas adapter stamps `_pendingTransfer` from this map.
  const pendingTransfersByAssetId = new Map()
  for (const t of (shared.transfers || [])) {
    if (t.fromParty === party) {
      pendingTransfersByAssetId.set(t.assetId, t)
    }
  }

  // ── Phase 9D: Revocation visibility ─────────────────────────────────
  // `_revokedMeta` annotations on DAs/EAs mirror the Phase 6.5 #3 decline
  // pattern. Keep revoked agreements in state (so the grantee can render
  // REVOKED Claim + Dismiss CTA) but filter them out of the active list
  // the canvas / Agreements Section consumes. On the grantee side, the
  // Claim stays visible with a `_revokedMeta` flag so the AssetNode card
  // shows a REVOKED badge and the Claim Detail Panel gates on the revoked
  // state. On the grantor side (when the grantee revoked their own
  // visibility), no Claim treatment is needed — the pulled-in anchor just
  // disappears because the DA is filtered out of the active list.
  const revokedClaimIds = new Map() // claimId → { record, reason, revokerParty, date, cascadeSummary }
  for (const da of disclosureAgreements) {
    if (!da._revokedMeta) continue
    // Only surface REVOKED on the grantee's canvas (their visibility was
    // terminated). The revoker-side canvas just loses the edge.
    if (da.grantee.party !== party) continue
    if (revokedClaimIds.has(da.subject.id)) continue
    revokedClaimIds.set(da.subject.id, {
      claimId: da.subject.id,
      granteeParty: da.grantee.party,
      grantorParty: da.grantor.party,
      revokerParty: da._revokedMeta.revokerParty,
      reason: da._revokedMeta.reason,
      revokedDate: da._revokedMeta.revokedDate,
      granteeAssetId: da.granteeAssetId,
      daId: da.id,
    })
  }
  // Filter the active list to drop revoked agreements. They stay in
  // `shared.disclosureAgreements` (still accessible via v22View-level
  // accessors) but the canvas / Agreements Section consumes the active
  // view only.
  const activeDisclosureAgreements = disclosureAgreements.filter((d) => !d._revokedMeta)
  const activeEvaluationAgreements = evaluationAgreements.filter((e) => !e._revokedMeta)
  // Revoked Eval Results also drop from the visible set. Metadata is
  // preserved in shared.evaluationResults for audit.
  const activeEvaluationResults = visibleEvaluationResults.filter((e) => !e._revokedMeta)

  return {
    actor,
    actors,
    assets: visibleAssets,
    ownedAssetIds: new Set(ownedAssets.map((a) => a.id)),
    parseResults: visibleParseResults,
    claims: visibleClaims,
    ownedClaimIds: new Set(ownedClaims.map((c) => c.id)),
    disclosureAgreements: activeDisclosureAgreements,
    evaluationAgreements: activeEvaluationAgreements,
    evaluationResults: activeEvaluationResults,
    // Phase 9D: surface the revoked-meta-annotated DAs so the grantee's
    // REVOKED-claim Detail Panel can resolve reason + revoker on render
    // without re-reading shared state. Empty set on revoker-side views.
    revokedClaimIds,
    revokedDisclosureAgreements: disclosureAgreements.filter((d) => d._revokedMeta),
    revokedEvaluationAgreements: evaluationAgreements.filter((e) => e._revokedMeta),
    pairedDaIds,
    pulledInClaimIds,
    pulledInAssetIds,
    // Phase 11D.3: Eval Result ids pulled in via proof-only Claim DAs (the
    // actor is grantee). Used by `buildV22Canvas` to place these Eval Results
    // in their own column near the source Claim, separate from the actor's
    // own evaluation flow + the proof-of-evaluation results.
    proofOnlyPulledEvalIds,
    provisionalClaimIds,
    provisionalAssetIds,
    declinedClaimIds,
    pendingTransfersByAssetId,
  }
}

/** Alice's view — MicroCo (seller / claim-maker). spec §6.1. */
export function buildAliceView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return buildViewForActor(src.actors.find((a) => a.id === 'alice-microco'), src)
}

/** Bob's view — GovCo (buyer / evaluator). spec §6.2. */
export function buildBobView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return buildViewForActor(src.actors.find((a) => a.id === 'bob-govco'), src)
}

/** Carol's view — AuditCo (auditor). spec §6.3. */
export function buildCarolView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return buildViewForActor(src.actors.find((a) => a.id === 'carol-auditco'), src)
}

/** Dave's view — ChipCo (supplier). spec §6.3a (Phase 11C). */
export function buildDaveView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return buildViewForActor(src.actors.find((a) => a.id === 'dave-chipco'), src)
}

/**
 * Merge optional runtime artifacts (request/response/eval-run flows) into a
 * shared artifact set. Used by V2App for Phase 4 provisional cycles AND Phase 5
 * evaluation runs / decline records.
 *
 * `provisionals` shape: {
 *   disclosureAgreements, evaluationAgreements, evaluationResults,
 *   declineRecords: [{ id, requesterParty, ownerParty, claimId, requesterAssetId, reason, declinedDate }],
 * }
 * All fields optional. Matching ids on existing artifacts REPLACE (used to
 * supersede prior eval results / flip provisional DAs to active).
 */
export function mergeProvisionals(shared, provisionals) {
  if (!provisionals) return shared
  const merged = { ...shared }
  const mergeById = (existing, incoming) => {
    if (!incoming || incoming.length === 0) return existing
    const byId = new Map(existing.map((x) => [x.id, x]))
    for (const item of incoming) byId.set(item.id, item)
    return Array.from(byId.values())
  }
  if (provisionals.disclosureAgreements?.length) {
    merged.disclosureAgreements = mergeById(merged.disclosureAgreements, provisionals.disclosureAgreements)
  }
  if (provisionals.evaluationAgreements?.length) {
    merged.evaluationAgreements = mergeById(merged.evaluationAgreements, provisionals.evaluationAgreements)
  }
  if (provisionals.evaluationResults?.length) {
    merged.evaluationResults = mergeById(merged.evaluationResults, provisionals.evaluationResults)
  }
  if (provisionals.parseResults?.length) {
    merged.parseResults = mergeById(merged.parseResults, provisionals.parseResults)
  }
  // Phase 6: amended Claims live in provisionals.claims so the original seeded
  // Claim is replaced by the amended version (carrying its updated
  // referencedAssetIds + amendments[] history).
  if (provisionals.claims?.length) {
    merged.claims = mergeById(merged.claims, provisionals.claims)
  }
  // Phase 9A.3: Create Asset produces a new Asset in provisionals.assets.
  // Merge-by-id here so the canvas adapter picks it up on next render.
  if (provisionals.assets?.length) {
    merged.assets = mergeById(merged.assets, provisionals.assets)
  }
  // declineRecords ride along on the merged shared bundle so view builders can
  // surface declined claims without inventing a new module-level store.
  merged.declineRecords = [...(shared.declineRecords || []), ...(provisionals.declineRecords || [])]
  // Phase 9A.4 Gate B: pending transfer records surface on the sender's
  // Asset as a TRANSFERRING badge. Canvas adapter reads these to stamp
  // `_pendingTransfer` onto the sender's Asset node.
  merged.transfers = [...(shared.transfers || []), ...(provisionals.transfers || [])]
  // Phase 9D: revocation records ride along on the merged shared bundle so
  // view builders can surface REVOKED claim state on the grantee's canvas
  // (mirror of the declineRecords pattern).
  merged.revocationRecords = [...(shared.revocationRecords || []), ...(provisionals.revocationRecords || [])]
  return merged
}

/**
 * Role dispatcher. Used by V2App when V2_2_ENABLED is true. `provisionals`
 * optional — pass the V2App `v22Provisionals` state here to include in-progress
 * request/response flows.
 */
export function getV22DataForRole(roleId, provisionals) {
  const shared = mergeProvisionals(buildV22SharedArtifacts(), provisionals)
  if (roleId === 'alice-microco') return buildAliceView(shared)
  if (roleId === 'carol-auditco') return buildCarolView(shared)
  if (roleId === 'dave-chipco') return buildDaveView(shared)
  return buildBobView(shared)
}

/**
 * Resolve a Claim by its PIN across the shared artifact set (plus any
 * provisionals). Returns `{ claim, ownerParty }` or null.
 */
export function resolveClaimByPinInShared(pin, provisionals) {
  const shared = mergeProvisionals(buildV22SharedArtifacts(), provisionals)
  const claim = shared.claims.find((c) => c.pin === pin)
  if (!claim) return null
  return { claim, ownerParty: claim.owner }
}

// ═══════════════════════════════════════════════════════════════════════════
// EDGE DERIVATION — spec §4, §10.4 subject-assignment table
// ═══════════════════════════════════════════════════════════════════════════

const ACTOR_NODE_ID_PREFIX = 'actor-'

/**
 * Canonical Actor node id, derived from party name so V2.1 and V2.2 ids don't
 * collide. This id is assigned when we build canvas nodes from artifacts.
 */
function actorNodeIdForParty(party) {
  return `${ACTOR_NODE_ID_PREFIX}${party.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

/**
 * Derive Agreement Edges for the canvas from a view's Disclosure Agreements.
 * Edges are `{ id, from, to, sdaType, disclosureAgreementId, pairedEvaluationAgreementId }`.
 *
 * Per spec §4.1: one edge type. Internal, proof-of-eval, public-directory, and
 * inter-party relationships are all derived from Disclosure Agreement artifacts,
 * styled by the DA's `type` field.
 */
export function deriveAgreementEdges(view) {
  const edges = []
  const seen = new Set() // dedupe: same endpoints + type collapse to one visible edge

  const visibleAssetIds = new Set(view.assets.map((a) => a.id))
  const visibleClaimIds = new Set(view.claims.map((c) => c.id))
  const visibleEvalIds = new Set(view.evaluationResults.map((e) => e.id))
  const visibleParseIds = new Set(view.parseResults.map((p) => p.id))
  const actorPartyInView = new Set(view.actors.map((a) => a.party))
  const evalResultById = new Map(view.evaluationResults.map((e) => [e.id, e]))

  const daByEvalAgreementId = new Map()
  for (const ea of view.evaluationAgreements) {
    daByEvalAgreementId.set(ea.disclosureAgreementId, ea)
  }
  // Phase 9D.2.1 Fix 1: also map revoked EAs so paired-EA lookup still
  // resolves when the parent DA is itself revoked. Edges for revoked
  // agreements render in a dimmed red state; the unravel animation
  // retracts them on Dismiss.
  for (const ea of (view.revokedEvaluationAgreements || [])) {
    if (!daByEvalAgreementId.has(ea.disclosureAgreementId)) {
      daByEvalAgreementId.set(ea.disclosureAgreementId, ea)
    }
  }

  const isRenderable = (nodeId) =>
    nodeId === RADIANT_NETWORK_ACTOR.id ||
    nodeId.startsWith(ACTOR_NODE_ID_PREFIX) ||
    visibleAssetIds.has(nodeId) ||
    visibleClaimIds.has(nodeId) ||
    visibleEvalIds.has(nodeId) ||
    visibleParseIds.has(nodeId)

  const pushEdge = (from, to, da) => {
    if (!from || !to || from === to) return
    if (!isRenderable(from) || !isRenderable(to)) return
    // Normalize endpoints so the dedupe key is order-independent for display.
    const [lo, hi] = from < to ? [from, to] : [to, from]
    const key = `${lo}::${hi}::${da.type}::${da.id}`
    if (seen.has(key)) return
    seen.add(key)
    const pairedEa = daByEvalAgreementId.get(da.id)
    edges.push({
      id: `edge-${da.id}-${lo}-${hi}`,
      from,
      to,
      sdaType: da.type,
      disclosureAgreementId: da.id,
      pairedEvaluationAgreementId: pairedEa ? pairedEa.id : null,
      // Phase 9A item 3: carry grantor/grantee party names through to the
      // canvas so V2Canvas can de-emphasise internal (same-party) edges with
      // a thinner stroke.
      grantorParty: da.grantor.party,
      granteeParty: da.grantee.party,
      // Phase 9D.2.1 Fix 1: revoked-state flag drives red+dimmed styling in
      // V2Canvas's buildEdges. Revoked edges persist on the canvas through
      // the user's Dismiss action; the unravel primitive's Stage 1 then
      // visually retracts them as the artifact is removed from view.
      isRevoked: !!da._revokedMeta,
    })
  }

  // Phase 9D.2.1 Fix 1: walk both active and revoked DAs. Revoked DAs
  // produce edges marked `isRevoked: true` for the dimmed-red styling +
  // unravel-retract treatment. Order matters: actives first, then revokeds —
  // the dedupe key in pushEdge includes da.id so the two passes don't
  // collide, but the active version always wins if both exist for some
  // reason (defensive against any future code path that pushes both).
  const allDasForEdges = [
    ...view.disclosureAgreements,
    ...(view.revokedDisclosureAgreements || []),
  ]
  for (const da of allDasForEdges) {
    const grantorActorId = actorNodeIdForParty(da.grantor.party)
    const granteeActorId =
      da.grantee.party === RADIANT_NETWORK_PARTY
        ? RADIANT_NETWORK_ACTOR.id
        : actorNodeIdForParty(da.grantee.party)

    const internal = da.grantor.party === da.grantee.party
    const toPublic = da.grantee.party === RADIANT_NETWORK_PARTY

    const { kind, id } = da.subject
    const hasScopeAssets = Array.isArray(da.scope?.assetIds) && da.scope.assetIds.length > 0

    if (kind === 'asset' && internal) {
      // Actor → Asset ownership. Phase 10.2: when this Asset has a
      // `parentAssetId` and that parent is on the canvas, redirect the edge
      // FROM the parent Asset instead of the owning Actor — the ownership DA
      // itself is unchanged (the Actor still owns the child via the DA), only
      // the rendered edge anchors to the parent so the hierarchy reads as a
      // tree. Fallback to the Actor when the parent isn't visible (defensive).
      const subjectAsset = view.assets.find((a) => a.id === id)
      const fromNode = (subjectAsset?.parentAssetId && visibleAssetIds.has(subjectAsset.parentAssetId))
        ? subjectAsset.parentAssetId
        : grantorActorId
      pushEdge(fromNode, id, da)
      continue
    }
    if (kind === 'claim' && internal && !hasScopeAssets) {
      // Phase 9A.5 #83: Claim → owner Actor edge suppressed. Ownership
      // cascades through referenced Assets (every Claim has
      // referencedAssetIds.length >= 1 per spec §3.4), so the Actor → Claim
      // edge was visually redundant and added density without information.
      // The ownership DA itself stays in state for provenance; we just stop
      // drawing it as a canvas edge.
      continue
    }
    if (kind === 'claim' && internal && hasScopeAssets) {
      // Claim → referenced Asset (one edge per (claim, asset) pair).
      for (const aid of da.scope.assetIds) pushEdge(id, aid, da)
      continue
    }
    if (kind === 'claim' && toPublic) {
      // Public-directory disclosure.
      pushEdge(id, RADIANT_NETWORK_ACTOR.id, da)
      continue
    }
    if (kind === 'claim' && !internal && !toPublic && da.type === 'proofonly') {
      // Phase 11D.3: proof-only Claim DA. Two edge classes:
      //   (a) The conventional Claim ↔ granteeAssetId anchor (proof-only
      //       styled) so the pulled-in Claim has a visual home on the
      //       grantee's canvas, mirroring full/selective behavior.
      //   (b) One edge per disclosed Eval Result → Claim, also proof-only
      //       styled. These edges carry the actual disclosure payload —
      //       the proof-only relationship is THROUGH the Eval Result.
      if (da.granteeAssetId) pushEdge(id, da.granteeAssetId, da)
      for (const erId of (da.scope?.evaluationResultIds || [])) {
        pushEdge(erId, id, da)
      }
      continue
    }
    if (kind === 'claim' && !internal && !toPublic) {
      // Inter-party Claim disclosure — subject ↔ granteeAssetId.
      if (da.granteeAssetId) pushEdge(id, da.granteeAssetId, da)
      continue
    }
    if (kind === 'evalResult' && internal && hasScopeAssets) {
      // Eval Result → evaluator's Asset (ownership anchor).
      for (const aid of da.scope.assetIds) pushEdge(id, aid, da)
      continue
    }
    if (kind === 'evalResult' && !internal) {
      // Proof-of-Evaluation — resolve Claim via the Eval Result.
      const er = evalResultById.get(id)
      if (er) pushEdge(id, er.claimId, da)
      continue
    }
    if (kind === 'evalResult' && internal && !hasScopeAssets) {
      // Self-evaluation proof-of-evaluation — owner is both grantor and grantee.
      // scope.evaluationResultIds carries the eval id; edge goes to the Claim
      // (resolved via the eval's claimId) so it reads visually identical to a
      // non-self proof-of-eval edge.
      const er = evalResultById.get(id)
      if (er) pushEdge(id, er.claimId, da)
      continue
    }
    if (kind === 'parseResult' && internal && hasScopeAssets) {
      // Parse Result → source Asset (spec §3.3). One edge per (parse, asset) pair.
      for (const aid of da.scope.assetIds) pushEdge(id, aid, da)
      continue
    }
    // Anything else: silently skip. Later phases may introduce additional variants.
    void actorPartyInView
  }

  return edges
}

// ═══════════════════════════════════════════════════════════════════════════
// CANVAS ADAPTER — V2.2 artifacts → V2Canvas-compatible { nodes, edges, nodeMap }
// ═══════════════════════════════════════════════════════════════════════════
//
// The V2Canvas component was built for the V2.1 node shape. Rather than fork
// canvas rendering, this adapter projects V2.2 artifacts into V2.1-compatible
// node objects with sensible defaults. New fields: `v22Type` (the type label
// shown in the card header per spec §3) and `v22Artifact` (a raw reference
// retained for panels/edges in later phases).
//
// Layout is simple and deterministic: columns by role (actor-owned vs
// pulled-in), rows by artifact kind. Phase 2 prioritizes readability over
// aesthetic density; post-migration routing/layout is §4.5 follow-up work.

// Column X coordinates. The actor sits at COL_ACTOR; owned artifacts extend to
// the right; pulled-in counterparty artifacts extend further right still.
// Phase 10.2.1: every X / Y / per-column offset / hierarchy-shift here is a
// multiple of 100 so node positions snap cleanly onto the dot grid (the grid
// is rendered at the same 100px step in V2Canvas's `getGridParams`). Column
// constants kept comfortably above the visual gutter.
const COL_ACTOR = 0
const COL_OWN_ASSET = 500           // Phase 10.2.1: was 520; snap to 100-grid
const COL_OWN_PARSE = 900
const COL_OWN_CLAIM = 1300
const COL_OWN_EVAL = 1700
const COL_PULLED_CLAIM = 2100
// Phase 11D.4: proof-only-pulled Eval Results sit 400px LEFT of the pulled
// Claim (matching the existing ASSET_COL_GAP convention) — same column as
// the actor's own Eval Results (`COL_OWN_EVAL = 1700`). Y separation keeps
// the two from colliding: own evals carry COL_Y_OFFSET (=100) on top of the
// symmetric distribution; proof-only-pulled evals match the source Claim's
// y, which is on the centre row (y=0 for the first pulled Claim). This
// reads as "Eval Result informs the Claim" — directional semantic of
// proof-only disclosure. Phase 11D.3 placed this at 2300 (200px from the
// Claim) which produced visible card overlap.
const COL_PULLED_EVAL = 1700
const COL_PULLED_ASSET = 2500
const COL_PUBLIC = 2900
const ROW_STEP = 300                // Phase 10.2.1: was 260; snap to 100-grid
// Phase 10.2: per-depth horizontal spacing for the Asset hierarchy column.
// Phase 10.2.1: bumped 380 → 400 so it stays on the 100-grid (the elastic
// shift `assetColShift = maxDepth × ASSET_COL_GAP` is therefore always a
// multiple of 100, keeping every downstream column on grid too).
const ASSET_COL_GAP = 400
// Phase 10.2.1: per-column-type Y offset (one full grid step = 100px). Pairs
// of adjacent columns alternate offset / no-offset so disclosure edges across
// columns gain a guaranteed vertical component instead of stacking on the
// same horizontal line. Generalises the Phase 6.5 #17 EVAL_ROW_OFFSET nudge.
const COL_Y_OFFSET = 100

/**
 * Phase 10.2.1: distribute N indices symmetrically around y=0 so the Actor
 * sits centred on the canvas and other nodes pack alternately above and
 * below. Replaces the legacy `i * ROW_STEP` pattern that packed downward
 * only and produced a top-heavy layout once column counts grew.
 *
 *   i=0 → 0
 *   i=1 → +ROW_STEP
 *   i=2 → -ROW_STEP
 *   i=3 → +2*ROW_STEP
 *   i=4 → -2*ROW_STEP
 *   ...
 */
function symmetricRowY(i, rowStep = ROW_STEP) {
  if (i === 0) return 0
  const offset = Math.ceil(i / 2) * rowStep
  return i % 2 === 1 ? offset : -offset
}

/**
 * Compute evaluation-result health rollup for a Claim: counts satisfactory,
 * warn (unused), and unsatisfactory rows across all non-superseded Eval Results
 * targeting that Claim. N/A rows excluded per spec §3.5.
 */
// Phase 11B: exported so V2App can synthesize a Detail-Panel-shaped node
// for the materialized ChipCo Claim that lives only on the directory layer.
export function buildClaimNodeForDirectoryMaterialization(claim, evalResults = []) {
  const rollup = rollupClaimHealth(claim.id, evalResults)
  return claimToNode(claim, rollup, 0, 0)
}

function rollupClaimHealth(claimId, evalResults) {
  let ok = 0
  let warn = 0
  let bad = 0
  let total = 0
  for (const er of evalResults) {
    if (er.claimId !== claimId) continue
    if (er.status === 'superseded') continue
    for (const r of er.results) {
      if (r.status === 'na') continue
      total += 1
      if (r.status === 'satisfactory') ok += 1
      else if (r.status === 'unsatisfactory') bad += 1
    }
  }
  return { health: { ok, warn, bad }, claimCount: total }
}

function rollupEvalResultHealth(er) {
  let ok = 0
  let warn = 0
  let bad = 0
  let total = 0
  for (const r of er.results) {
    if (r.status === 'na') continue
    total += 1
    if (r.status === 'satisfactory') ok += 1
    else if (r.status === 'unsatisfactory') bad += 1
  }
  return { health: { ok, warn, bad }, claimCount: total }
}

const EMPTY_HEALTH = { ok: 0, warn: 0, bad: 0 }

/**
 * Project an Actor (or the Radiant Network pseudo-actor) into a canvas node.
 */
function actorToNode(actor, x, y) {
  const isDirectory = actor.id === RADIANT_NETWORK_ACTOR.id
  return {
    id: isDirectory ? RADIANT_NETWORK_ACTOR.id : actorNodeIdForParty(actor.party),
    pin: actor.pin || makePin(actor.id),
    dot: actor.partyDot,
    // Phase 9A.6.1 Fix 2: also surface the party-level DOT under its canonical
    // name so V22ActorPanel can read `node.partyDot` (the alias `node.dot` is
    // retained for V2Canvas compat — V2.1 code paths read it for non-actor
    // nodes too, where `dot` and `partyDot` would mean different things).
    partyDot: actor.partyDot,
    name: actor.party,
    category: 'party',
    owner: null,
    parentId: null,
    children: [],
    health: EMPTY_HEALTH,
    childHealth: null,
    totalHealth: null,
    displayHealth: EMPTY_HEALTH,
    claimCount: 0,
    displayClaimCount: 0,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x,
    y,
    parentOwner: actor.party,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isClaim: false,
    isParse: false,
    isEvaluation: false,
    isNetworkNode: isDirectory,
    artifactUri: null,
    v22Type: 'ACTOR',
    v22Artifact: actor,
  }
}

function assetToNode(asset, x, y) {
  return {
    id: asset.id,
    pin: asset.pin,
    dot: asset.ownerDot,
    name: asset.name,
    category: 'product',
    owner: asset.owner,
    parentId: null,
    children: [],
    health: EMPTY_HEALTH,
    childHealth: null,
    totalHealth: null,
    displayHealth: EMPTY_HEALTH,
    claimCount: 0,
    displayClaimCount: 0,
    hasEvidence: true,
    hasStack: false,
    childCount: 0,
    evidence: {
      filename: asset.file.filename,
      hash: asset.file.hash,
      block: null,
      provider: null,
      uri: asset.file.uri,
      retention: null,
    },
    evaluations: [],
    sdas: [],
    x,
    y,
    parentOwner: asset.owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false, // spec §3.2: Assets are first-class parent-layer nodes, not evidence children
    isClaim: false,
    isParse: false,
    isEvaluation: false,
    artifactUri: asset.artifactUri,
    v22Type: 'ASSET',
    v22Artifact: asset,
  }
}

function parseResultToNode(pr, x, y) {
  return {
    id: pr.id,
    pin: makePin(pr.id),
    dot: makeDot(pr.owner),
    name: pr.templateName,
    category: 'parse',
    owner: pr.owner,
    parentId: null,
    children: [],
    health: EMPTY_HEALTH,
    childHealth: null,
    totalHealth: null,
    displayHealth: EMPTY_HEALTH,
    claimCount: 0,
    displayClaimCount: 0,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    parsedFields: pr.fields.map((f) => ({
      id: f.id,
      name: f.name,
      value: f.value,
      confidence: f.confidence,
    })),
    x,
    y,
    parentOwner: pr.owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isClaim: false,
    isParse: true,
    isEvaluation: false,
    sourceAssetId: pr.sourceAssetId,
    artifactUri: pr.artifactUri,
    date: pr.parseDate ? pr.parseDate.slice(0, 10) : null,
    dateTime: pr.parseDate,
    v22Type: 'PARSE RESULT',
    v22Artifact: pr,
  }
}

function claimToNode(claim, rollup, x, y) {
  return {
    id: claim.id,
    pin: claim.pin,
    dot: claim.ownerDot,
    name: claim.name,
    category: 'claim',
    owner: claim.owner,
    parentId: null,
    children: [],
    health: rollup.health,
    childHealth: null,
    totalHealth: null,
    displayHealth: rollup.health,
    claimCount: rollup.claimCount,
    displayClaimCount: rollup.claimCount,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x,
    y,
    parentOwner: claim.owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isClaim: true,
    isParse: false,
    isEvaluation: false,
    referencedEvidenceIds: [...claim.referencedAssetIds],
    artifactUri: claim.artifactUri,
    date: claim.createdDate ? claim.createdDate.slice(0, 10) : null,
    dateTime: claim.createdDate,
    description: claim.description,
    v22Type: 'CLAIM',
    v22Artifact: claim,
  }
}

function evalResultToNode(er, x, y) {
  const rollup = rollupEvalResultHealth(er)
  const isSuperseded = er.status === 'superseded'
  return {
    id: er.id,
    pin: er.pin,
    dot: er.ownerDot,
    name: er.requirementsSet.name,
    category: 'evaluation',
    owner: er.owner,
    parentId: null,
    children: [],
    health: rollup.health,
    childHealth: null,
    totalHealth: null,
    displayHealth: rollup.health,
    claimCount: rollup.claimCount,
    displayClaimCount: rollup.claimCount,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x,
    y,
    parentOwner: er.owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isClaim: false,
    isParse: false,
    isEvaluation: true,
    isTerminalNode: true,
    status: er.status,
    supersededBy: er.supersededBy,
    claimId: er.claimId,
    requirementSetId: er.requirementsSet.id,
    requirementSetName: er.requirementsSet.name,
    requirementSetVersion: er.requirementsSet.version,
    evaluator: er.owner,
    evaluatorParty: er.owner,
    date: er.evaluationDate ? er.evaluationDate.slice(0, 10) : null,
    dateTime: er.evaluationDate,
    claims: er.results.map((r) => ({
      requirementId: r.requirementId,
      label: r.label,
      status: r.status,
      aiValue: r.value,
      humanValue: r.value,
    })),
    artifactUri: er.artifactUri,
    // AssetNode renders its own SUPERSEDED badge when status === 'superseded';
    // v22Type stays a single canonical label (Phase 6 carry-over #4).
    v22Type: 'EVAL RESULT',
    v22Artifact: er,
  }
}

/**
 * Build a new provisional Disclosure Agreement + Evaluation Agreement pair for
 * a request (spec §7.1 step 1). Both artifacts start with `status: 'active'`
 * structurally (so the view builder includes them) but the DA's `type` is
 * `'provisional'` which drives the edge styling in §4.2.
 *
 * `options` carries the identifying request context:
 *   - requesterParty / requesterDot   — grantee of the DA (Bob on Story 1)
 *   - requesterAssetId                — anchor on the grantee's canvas
 *   - ownerParty / ownerDot           — grantor of the DA (Alice)
 *   - claimId                         — the subject Claim being requested
 *   - requestedRequirementsSetIds     — optional suggestions forwarded to EA
 *   - message                         — free-text context (not stored on-chain in real life; attached here for UI)
 */
export function makeProvisionalAgreementPair({
  idSeed,
  requesterParty, requesterDot,
  requesterAssetId,
  ownerParty, ownerDot,
  claimId,
  requestedRequirementsSetIds = [],
  message = '',
  // Phase 11C.1: ids of the Claim's acknowledgments the requester checked
  // when submitting. Surfaces on the response modal as a read-only audit
  // panel and rides through finalize onto the active EA.
  acknowledgmentsAccepted = [],
}) {
  const stamp = idSeed || `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const daId = `da-prov-${stamp}`
  const eaId = `ea-prov-${stamp}`
  const createdDate = new Date().toISOString()

  const da = makeDisclosureAgreement({
    id: daId,
    grantor: { party: ownerParty, dot: ownerDot || makeDot(ownerParty) },
    grantee: { party: requesterParty, dot: requesterDot || makeDot(requesterParty) },
    subject: { kind: 'claim', id: claimId },
    granteeAssetId: requesterAssetId,
    type: 'provisional',
    scope: { includeDerivatives: false },
    terms: { createdDate },
    status: 'active',
  })

  const ea = makeEvaluationAgreement({
    id: eaId,
    grantor: { party: ownerParty, dot: ownerDot || makeDot(ownerParty) },
    grantee: { party: requesterParty, dot: requesterDot || makeDot(requesterParty) },
    claimId,
    granteeAssetId: requesterAssetId,
    disclosureAgreementId: daId,
    authorizedRequirementsSetIds: requestedRequirementsSetIds,
    acknowledgmentsAccepted,
    terms: {
      createdDate,
    },
    status: 'active',
  })

  // Attach request metadata to the DA for round-trip display in the response
  // modal. This field is outside spec §10.4; it's a UI-layer convenience.
  da._requestMeta = { message, requestedRequirementsSetIds: [...requestedRequirementsSetIds] }

  return { disclosureAgreement: da, evaluationAgreement: ea }
}

/**
 * Phase 11C — flip a warm-path provisional EA to active.
 * Returns the updated EA (same id) with `_provisional` cleared and the
 * responder-authored terms applied (only `evaluationDeadline` is responder-
 * editable today). `acknowledgmentsAccepted` carries through unchanged from
 * the provisional EA — the responder doesn't mutate the requester's
 * acknowledgments.
 */
export function finalizeProvisionalEvaluationAgreement({
  provisionalEa,
  eaTerms,
}) {
  if (!provisionalEa) throw new Error('finalizeProvisionalEvaluationAgreement: provisionalEa is required')
  return makeEvaluationAgreement({
    id: provisionalEa.id,
    grantor: provisionalEa.grantor,
    grantee: provisionalEa.grantee,
    claimId: provisionalEa.claimId,
    granteeAssetId: provisionalEa.granteeAssetId,
    disclosureAgreementId: provisionalEa.disclosureAgreementId,
    authorizedRequirementsSetIds: eaTerms?.authorizedRequirementsSetIds ?? provisionalEa.authorizedRequirementsSetIds,
    acknowledgmentsAccepted: provisionalEa.acknowledgmentsAccepted || [],
    restrictions: provisionalEa.restrictions,
    terms: {
      createdDate: provisionalEa.terms?.createdDate,
      evaluationDeadline: eaTerms?.expires ?? provisionalEa.terms?.evaluationDeadline,
      resultExpiry: provisionalEa.terms?.resultExpiry,
      flowDownRequirements: provisionalEa.terms?.flowDownRequirements,
    },
    incentives: provisionalEa.incentives,
    status: 'active',
  })
}

/**
 * Phase 11C — warm-path Evaluation-Agreement-only request factory (spec §11.6a).
 * Used when an active DA already exists between requester and Claim owner; the
 * requester proposes adding an EA to gain evaluation rights without renegotiating
 * disclosure scope.
 *
 * Produces a provisional EA referencing the existing active DA (no new DA is
 * created). On accept, the EA flips to active. On decline, the EA is annotated
 * `_declineMeta` and dismissable from the requester's canvas.
 *
 * Returns `{ evaluationAgreement }`.
 */
export function makeProvisionalEvaluationAgreement({
  idSeed,
  requesterParty, requesterDot,
  requesterAssetId,
  ownerParty, ownerDot,
  claimId,
  existingDisclosureAgreementId,
  requestedRequirementsSetIds = [],
  message = '',
  // Phase 11C.1: ids of the Claim's acknowledgments the requester checked
  // when submitting the warm-path EA request.
  acknowledgmentsAccepted = [],
}) {
  if (!existingDisclosureAgreementId) {
    throw new Error('makeProvisionalEvaluationAgreement: existingDisclosureAgreementId is required')
  }
  const stamp = idSeed || `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const eaId = `ea-prov-${stamp}`
  const createdDate = new Date().toISOString()

  const ea = makeEvaluationAgreement({
    id: eaId,
    grantor: { party: ownerParty, dot: ownerDot || makeDot(ownerParty) },
    grantee: { party: requesterParty, dot: requesterDot || makeDot(requesterParty) },
    claimId,
    granteeAssetId: requesterAssetId,
    disclosureAgreementId: existingDisclosureAgreementId,
    authorizedRequirementsSetIds: requestedRequirementsSetIds,
    acknowledgmentsAccepted,
    terms: { createdDate },
    status: 'active',
  })

  // _provisional flag distinguishes the warm-path EA from finalized EAs in the
  // view layer. Adapter renders the Claim with the standard provisional
  // dashed border + AWAITING RESPONSE badge.
  ea._provisional = true
  ea._requestMeta = {
    message,
    requesterParty,
    requesterAssetId,
    requestedRequirementsSetIds: [...requestedRequirementsSetIds],
    createdDate,
  }
  return { evaluationAgreement: ea }
}

/**
 * Flip a provisional DA+EA pair to active with the grantor's chosen settings.
 * Returns `{ disclosureAgreement, evaluationAgreement }`, each a new artifact
 * with the updated fields. Callers replace the prior provisionals in the
 * V2App `v22Provisionals` state.
 */
export function finalizeProvisionalAgreementPair({
  provisionalDa, provisionalEa,
  type, scope, eaTerms,
}) {
  const activeDa = makeDisclosureAgreement({
    id: provisionalDa.id,
    grantor: provisionalDa.grantor,
    grantee: provisionalDa.grantee,
    subject: provisionalDa.subject,
    granteeAssetId: provisionalDa.granteeAssetId,
    type, // full | selective | proofonly
    scope: scope || provisionalDa.scope,
    terms: {
      createdDate: provisionalDa.terms?.createdDate,
      expires: eaTerms?.expires ?? provisionalDa.terms?.expires,
      autoRenew: false,
    },
    amendments: provisionalDa.amendments,
    status: 'active',
  })
  const activeEa = makeEvaluationAgreement({
    id: provisionalEa.id,
    grantor: provisionalEa.grantor,
    grantee: provisionalEa.grantee,
    claimId: provisionalEa.claimId,
    granteeAssetId: provisionalEa.granteeAssetId,
    disclosureAgreementId: provisionalEa.disclosureAgreementId,
    authorizedRequirementsSetIds: eaTerms?.authorizedRequirementsSetIds ?? provisionalEa.authorizedRequirementsSetIds,
    // Phase 11C.1: forward the requester's accepted acknowledgments through
    // finalization. The responder doesn't get to mutate them — they ride
    // along on the active EA as immutable audit trail.
    acknowledgmentsAccepted: provisionalEa.acknowledgmentsAccepted || [],
    restrictions: provisionalEa.restrictions,
    terms: {
      createdDate: provisionalEa.terms?.createdDate,
      evaluationDeadline: eaTerms?.expires ?? provisionalEa.terms?.evaluationDeadline,
      resultExpiry: provisionalEa.terms?.resultExpiry,
      flowDownRequirements: provisionalEa.terms?.flowDownRequirements,
    },
    incentives: provisionalEa.incentives,
    status: 'active',
  })
  return { disclosureAgreement: activeDa, evaluationAgreement: activeEa }
}

/**
 * Amend a Claim by adding additional referenced Assets (spec §11.1). Returns a
 * new Claim artifact with the merged `referencedAssetIds` plus a new entry in
 * `amendments[]`. The original Claim's id is preserved so the artifact replaces
 * its prior version when merged into the shared dataset via `mergeProvisionals`.
 *
 * Also returns the new internal claim-ref Disclosure Agreements that need to be
 * added to the shared dataset for the new Asset references to render edges.
 * (The seeded `claimRefEdges` only covers original references.)
 */
export function makeAmendedClaim({ claim, addedAssetIds = [], removedAssetIds = [] }) {
  const existing = new Set(claim.referencedAssetIds)
  for (const id of removedAssetIds) existing.delete(id)
  for (const id of addedAssetIds) existing.add(id)
  const amendedClaim = makeClaim({
    id: claim.id,
    owner: claim.owner,
    ownerDot: claim.ownerDot,
    name: claim.name,
    description: claim.description,
    referencedAssetIds: Array.from(existing),
    // Phase 11C.1: preserve existing acknowledgments through Asset
    // amendments. Editing acknowledgments themselves is a future workstream.
    acknowledgments: claim.acknowledgments || [],
    createdDate: claim.createdDate,
    amendments: [
      ...(claim.amendments || []),
      {
        date: new Date().toISOString(),
        added: [...addedAssetIds],
        removed: [...removedAssetIds],
      },
    ],
  })
  const newClaimRefEdges = addedAssetIds.map((assetId) =>
    makeInternalDisclosureAgreement({
      id: `da-ref-${claim.id}-${assetId}`,
      owner: claim.owner,
      ownerDot: claim.ownerDot,
      subject: { kind: 'claim', id: claim.id },
      scope: { assetIds: [assetId], includeDerivatives: true },
      terms: { createdDate: amendedClaim.amendments.at(-1).date },
    }),
  )
  return { claim: amendedClaim, newClaimRefEdges }
}

/**
 * Amend a Disclosure Agreement's scope (spec §11.2). Returns a new DA with the
 * updated scope and an appended `amendments[]` entry. Per §11.2, callers MUST
 * have already enforced "no removal of evaluated evidence" — this helper does
 * not re-validate (the caller knows whether evaluations have been run).
 */
export function makeAmendedDisclosureAgreement({ disclosureAgreement: da, scope, note = '' }) {
  return makeDisclosureAgreement({
    id: da.id,
    grantor: da.grantor,
    grantee: da.grantee,
    subject: da.subject,
    granteeAssetId: da.granteeAssetId,
    type: da.type,
    scope,
    terms: da.terms,
    amendments: [
      ...(da.amendments || []),
      { date: new Date().toISOString(), note: (note || '').trim(), scopeBefore: da.scope },
    ],
    status: da.status,
  })
}

/**
 * Phase 11E.1 (#108): Amend an Evaluation Agreement (spec §11.2a). Returns a
 * new EA with updated `terms.evaluationDeadline` and an appended `amendments[]`
 * entry. Acknowledgment edits live on the underlying Claim (Option B — see
 * architecture-spec §11.2a); this factory captures the acknowledgment delta
 * for audit purposes only.
 *
 * The caller MUST mutate the Claim's `acknowledgments[]` separately. This
 * helper does NOT touch the Claim — keeping concerns separated lets the V2App
 * handler stage both updates atomically.
 */
export function makeAmendedEvaluationAgreement({
  evaluationAgreement: ea,
  terms,
  acknowledgmentChanges = { added: [], removed: [], edited: [] },
  note = '',
}) {
  return makeEvaluationAgreement({
    id: ea.id,
    grantor: ea.grantor,
    grantee: ea.grantee,
    claimId: ea.claimId,
    granteeAssetId: ea.granteeAssetId,
    disclosureAgreementId: ea.disclosureAgreementId,
    authorizedRequirementsSetIds: ea.authorizedRequirementsSetIds,
    acknowledgmentsAccepted: ea.acknowledgmentsAccepted,
    restrictions: ea.restrictions,
    terms: {
      ...ea.terms,
      evaluationDeadline: terms?.evaluationDeadline !== undefined
        ? terms.evaluationDeadline
        : ea.terms.evaluationDeadline,
    },
    incentives: ea.incentives,
    amendments: [
      ...(ea.amendments || []),
      {
        date: new Date().toISOString(),
        note: (note || '').trim(),
        termsBefore: { evaluationDeadline: ea.terms.evaluationDeadline },
        acknowledgmentChanges: {
          added: (acknowledgmentChanges.added || []).map((a) => ({ ...a })),
          removed: (acknowledgmentChanges.removed || []).map((a) => ({ ...a })),
          edited: (acknowledgmentChanges.edited || []).map((e) => ({
            id: e.id,
            before: { ...e.before },
            after: { ...e.after },
          })),
        },
      },
    ],
    status: ea.status,
  })
}

/**
 * Phase 11E.1 (#108): pure helper for computing the delta between two
 * acknowledgment arrays. Used by Amend EA flow to capture an audit-trail
 * delta on the EA while the Claim's own `acknowledgments[]` mutates.
 */
export function diffAcknowledgments(before = [], after = []) {
  const beforeMap = new Map(before.map((a) => [a.id, a]))
  const afterMap = new Map(after.map((a) => [a.id, a]))
  const added = after.filter((a) => !beforeMap.has(a.id))
  const removed = before.filter((a) => !afterMap.has(a.id))
  const edited = []
  for (const a of after) {
    const old = beforeMap.get(a.id)
    if (!old) continue
    if (old.title !== a.title || old.description !== a.description) {
      edited.push({
        id: a.id,
        before: { title: old.title, description: old.description },
        after: { title: a.title, description: a.description },
      })
    }
  }
  return { added, removed, edited }
}

/**
 * Build a decline record (spec §11.4). Caller pulls the provisional DA+EA
 * separately; this just produces the surface that the requester sees.
 */
export function makeDeclineRecord({ provisionalDa, reason = '' }) {
  return {
    id: `decline-${provisionalDa.id}`,
    requesterParty: provisionalDa.grantee.party,
    ownerParty: provisionalDa.grantor.party,
    claimId: provisionalDa.subject.id,
    requesterAssetId: provisionalDa.granteeAssetId || null,
    reason: reason.trim(),
    declinedDate: new Date().toISOString(),
  }
}

/**
 * Phase 9D: Revocation record factory. Shipped alongside the agreement
 * annotation (`_revokedMeta`) pattern mirroring `_declineMeta` from Phase 6.5
 * #3. Revocation records ride along on the shared bundle via mergeProvisionals
 * so view builders + notification payloads can resolve metadata without
 * re-querying the primary agreement list.
 *
 * Cascade semantics:
 *   • DA revocation produces one DA record plus (if a paired EA exists) an
 *     EA record with `cascadedFromDaId` set, plus one record per Eval Result
 *     the grantee produced on the grantor's Claim under that EA (also
 *     cascaded).
 *   • EA revocation produces only an EA record. No cascade.
 *   • Proof-of-Evaluation DAs are non-revocable by design — handlers should
 *     no-op on attempts.
 */
export function makeRevocationRecord({
  agreementType,       // 'DA' | 'EA' | 'EvalResult'
  agreementId,
  revokerParty,
  counterpartyParty,
  claimId = null,
  evalResultId = null,
  reason = '',
  cascadedFromDaId = null,
}) {
  return {
    id: `revoke-${agreementType.toLowerCase()}-${agreementId}-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`,
    agreementType,
    agreementId,
    revokerParty,
    counterpartyParty,
    claimId,
    evalResultId,
    reason: (reason || '').trim(),
    cascadedFromDaId,
    revokedDate: new Date().toISOString(),
  }
}

/**
 * Build the artifact triple a completed evaluation run produces:
 *   - The Evaluation Result itself (spec §10.6)
 *   - A Proof-of-Evaluation Disclosure Agreement (evaluator → claim owner)
 *   - The evaluator's ownership DA linking the Eval Result to their anchor Asset
 *
 * If `priorActiveResult` is supplied AND its requirementsSet.id matches, the
 * caller should also include the prior result with status='superseded' and
 * supersededBy=newId in the v22Provisionals state.
 */
export function makeEvaluationRunArtifacts({
  evaluatorParty, evaluatorDot,
  claimOwnerParty, claimOwnerDot,
  evaluationAgreement,
  granteeAssetId,
  requirementsSet,
  rows,            // [{ requirementId, label, value, status }]
  evidenceUsed,    // [assetId, ...]
  priorActiveResult,
}) {
  const idSeed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const evalId = `eval-${evaluationAgreement.id}-${idSeed}`
  const evaluationDate = new Date().toISOString()

  const evalResult = makeEvaluationResult({
    id: evalId,
    owner: evaluatorParty,
    ownerDot: evaluatorDot || makeDot(evaluatorParty),
    evaluationAgreementId: evaluationAgreement.id,
    claimId: evaluationAgreement.claimId,
    granteeAssetId,
    requirementsSet,
    results: rows,
    evidenceUsed,
    evaluationDate,
    status: 'active',
    supersededBy: null,
  })

  const proofDa = makeProofOfEvalDisclosureAgreement({
    id: `da-proof-${evalId}`,
    evaluator: evaluatorParty,
    evaluatorDot,
    claimOwner: claimOwnerParty,
    claimOwnerDot,
    evaluationResultId: evalId,
    terms: { createdDate: evaluationDate },
  })

  const ownershipDa = makeInternalDisclosureAgreement({
    id: `da-own-${evalId}`,
    owner: evaluatorParty,
    ownerDot: evaluatorDot,
    subject: { kind: 'evalResult', id: evalId },
    scope: granteeAssetId
      ? { assetIds: [granteeAssetId], includeDerivatives: false }
      : { includeDerivatives: false },
    terms: { createdDate: evaluationDate },
  })

  // If a prior result with the same requirements-set lineage exists, mark it
  // superseded and link its supersededBy field.
  let supersededVersion = null
  if (priorActiveResult && priorActiveResult.requirementsSet?.id === requirementsSet.id && priorActiveResult.status === 'active') {
    supersededVersion = makeEvaluationResult({
      id: priorActiveResult.id,
      owner: priorActiveResult.owner,
      ownerDot: priorActiveResult.ownerDot,
      evaluationAgreementId: priorActiveResult.evaluationAgreementId,
      claimId: priorActiveResult.claimId,
      granteeAssetId: priorActiveResult.granteeAssetId,
      requirementsSet: priorActiveResult.requirementsSet,
      results: priorActiveResult.results,
      evidenceUsed: priorActiveResult.evidenceUsed,
      evaluationDate: priorActiveResult.evaluationDate,
      status: 'superseded',
      supersededBy: evalResult.id,
    })
  }

  return {
    evaluationResult: evalResult,
    proofDisclosureAgreement: proofDa,
    ownershipDisclosureAgreement: ownershipDa,
    supersededPriorResult: supersededVersion,
  }
}

/**
 * Phase 9A.3: factory for registering a new Asset.
 *
 * Produces:
 *   • `asset`        — the Asset artifact (makeAsset).
 *   • `ownershipDa`  — internal Full DA wiring Actor → Asset, matching the
 *                       seeded `aliceOwnAssets` / `bobOwnAssets` shape so
 *                       edge derivation treats it identically.
 *
 * Asset creation is unilateral (no counterparty acceptance). V2App merges
 * both artifacts into `v22Provisionals` and triggers the standard
 * `_isNew` + pan-to reveal.
 */
export function makeAssetRegistrationArtifacts({
  ownerParty,
  ownerDot,
  file,             // { uri, filename, size, mimeType, hash }
  name,             // optional display name — falls back to stripped filename
  description = '',
  parentAssetId = null,  // Phase 10.2: optional parent for hierarchy
}) {
  if (!ownerParty) throw new Error('makeAssetRegistrationArtifacts: ownerParty is required')
  if (!file || !file.uri || !file.filename) {
    throw new Error('makeAssetRegistrationArtifacts: file { uri, filename } is required')
  }
  const idSeed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const partySlug = ownerParty.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const assetId = `asset-${partySlug}-${idSeed}`
  const registrationDate = new Date().toISOString()

  const displayName = (name && name.trim())
    || file.filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    || file.filename

  const asset = makeAsset({
    id: assetId,
    owner: ownerParty,
    ownerDot: ownerDot || makeDot(ownerParty),
    name: displayName,
    description,
    file,
    registrationDate,
    parseResultIds: [],
    parentAssetId,
  })

  const ownershipDa = makeInternalDisclosureAgreement({
    id: `da-own-${assetId}`,
    owner: ownerParty,
    ownerDot,
    subject: { kind: 'asset', id: assetId },
    terms: { createdDate: registrationDate },
  })

  return { asset, ownershipDa }
}

/**
 * Phase 9A.3: factory for creating a new Claim referencing ≥1 Asset.
 *
 * Produces:
 *   • `claim`         — the Claim artifact (makeClaim).
 *   • `ownershipDa`   — Actor → Claim ownership DA (internal Full).
 *   • `claimRefDas`   — one internal Full DA per referenced Asset, matching
 *                       the seeded `claimRefEdges` shape so edge derivation
 *                       emits a Claim ↔ Asset edge for each reference.
 *
 * Spec §3.4 requires `referencedAssetIds.length >= 1` — enforced here so
 * callers catch the invariant at the factory boundary. V2App merges all
 * three artifact groups into `v22Provisionals`.
 */
export function makeClaimCreationArtifacts({
  ownerParty,
  ownerDot,
  name,
  description = '',
  referencedAssetIds = [],
  // Phase 11C.1: optional acknowledgments authored by the Claim creator.
  // Format: [{ title, description }] — the factory generates per-row ids.
  acknowledgments = [],
}) {
  if (!ownerParty) throw new Error('makeClaimCreationArtifacts: ownerParty is required')
  if (!name || !name.trim()) throw new Error('makeClaimCreationArtifacts: name is required')
  if (!Array.isArray(referencedAssetIds) || referencedAssetIds.length === 0) {
    throw new Error('makeClaimCreationArtifacts: referencedAssetIds must be non-empty (spec §3.4)')
  }
  const idSeed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const partySlug = ownerParty.toLowerCase().replace(/[^a-z0-9]+/g, '-')
  const claimId = `claim-${partySlug}-${idSeed}`
  const createdDate = new Date().toISOString()

  // Filter out empty rows (no title AND no description) — the modal allows
  // empty rows to exist mid-edit; we shouldn't persist them. Generate ids
  // for the remaining rows.
  const finalAcks = (acknowledgments || [])
    .filter((a) => (a?.title || '').trim() || (a?.description || '').trim())
    .map((a, i) => ({
      id: a.id || `ack-${claimId}-${i + 1}`,
      title: (a.title || '').trim(),
      description: (a.description || '').trim(),
    }))

  const claim = makeClaim({
    id: claimId,
    owner: ownerParty,
    ownerDot: ownerDot || makeDot(ownerParty),
    name: name.trim(),
    description,
    referencedAssetIds,
    acknowledgments: finalAcks,
    createdDate,
    amendments: [],
  })

  const ownershipDa = makeInternalDisclosureAgreement({
    id: `da-own-${claimId}`,
    owner: ownerParty,
    ownerDot,
    subject: { kind: 'claim', id: claimId },
    terms: { createdDate },
  })

  const claimRefDas = referencedAssetIds.map((assetId) =>
    makeInternalDisclosureAgreement({
      id: `da-ref-${claimId}-${assetId}`,
      owner: ownerParty,
      ownerDot,
      subject: { kind: 'claim', id: claimId },
      scope: { assetIds: [assetId], includeDerivatives: true },
      terms: { createdDate },
    }),
  )

  return { claim, ownershipDa, claimRefDas }
}

/**
 * Phase 8: factory for a new Parse Result run, mirroring
 * `makeEvaluationRunArtifacts`. Produces the Parse Result plus the internal
 * Full DA that wires the new Parse Result node back to its source Asset
 * (same shape as the seeded `parseResultRefEdges` so edge derivation treats
 * it identically). Parse flow doesn't produce ownership or proof DAs — parsing
 * is internal to the Asset owner.
 */
export function makeParseRunArtifacts({
  ownerParty,
  ownerDot,
  sourceAssetId,
  template,         // { id, name, version, fields: [{ id, name }] }
  rows,             // [{ id, name, value, confidence }]
}) {
  const idSeed = `${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 4).toString(36)}`
  const parseId = `parse-${sourceAssetId}-${idSeed}`
  const parseDate = new Date().toISOString()

  const parseResult = makeParseResult({
    id: parseId,
    owner: ownerParty,
    ownerDot: ownerDot || makeDot(ownerParty),
    sourceAssetId,
    templateId: template.id,
    templateName: template.name,
    templateVersion: template.version ?? 1,
    fields: rows.map((r) => ({
      id: r.id,
      name: r.name,
      value: r.value,
      confidence: r.confidence,
      // Phase 9A item 10: persist the AI's original extraction so the Parse
      // Result's Detail Panel can render a pencil icon for rows the human
      // edited before submitting.
      _aiOriginalValue: r._aiOriginalValue,
    })),
    parseDate,
  })

  // Same shape as the seeded `parseResultRefEdges` in buildV22SharedArtifacts
  // so edge derivation treats the new Parse Result identically.
  const refDa = makeInternalDisclosureAgreement({
    id: `da-parse-${parseId}`,
    owner: ownerParty,
    ownerDot,
    subject: { kind: 'parseResult', id: parseId },
    scope: { assetIds: [sourceAssetId], includeDerivatives: true },
    terms: { createdDate: parseDate },
  })

  return { parseResult, refDisclosureAgreement: refDa }
}

/**
 * Find any active prior Eval Result for (claimId, requirementsSetId) lineage
 * across the merged shared+provisional set. Used by the eval modal/handler to
 * detect supersede cases (spec §11.3).
 */
export function findPriorActiveEvaluationResult({ claimId, requirementsSetId, shared, provisionals }) {
  const merged = mergeProvisionals(shared || buildV22SharedArtifacts(), provisionals)
  return merged.evaluationResults.find(
    (e) => e.claimId === claimId && e.requirementsSet?.id === requirementsSetId && e.status === 'active',
  ) || null
}

/**
 * Given an edge id and the view used to derive edges, return the underlying
 * Disclosure Agreement and (optionally) paired Evaluation Agreement. Used by
 * Phase 3's edge menu and detail panels.
 */
export function resolveAgreementsForEdge(edgeId, view, edges) {
  if (!edgeId || !view || !edges) return null
  const edge = edges.find((e) => e.id === edgeId)
  if (!edge) return null
  const disclosureAgreement = view.disclosureAgreements.find(
    (d) => d.id === edge.disclosureAgreementId,
  )
  const evaluationAgreement = edge.pairedEvaluationAgreementId
    ? view.evaluationAgreements.find((e) => e.id === edge.pairedEvaluationAgreementId)
    : null
  return { edge, disclosureAgreement, evaluationAgreement }
}

/**
 * Convert a view into the `{ nodes, edges, nodeMap }` shape V2Canvas expects.
 * Layout is column-based and deterministic so that repeated renders produce
 * stable coordinates.
 */
export function buildV22Canvas(view) {
  const actor = view.actor
  const nodes = []

  // ── Actor + optional Radiant Network ─────────────────────────────────
  nodes.push(actorToNode(actor, COL_ACTOR, 0))
  // Note: Radiant Network anchor uses the shifted public column when
  // hierarchy is present. Computed below after `assetColShift`.
  const hasNetworkAnchor = view.actors.some((a) => a.id === RADIANT_NETWORK_ACTOR.id)

  // ── Owned Assets (column 1, expands right by depth) ──────────────────
  // Phase 10.2: Asset hierarchy. Owned Assets carrying a `parentAssetId`
  // sit one column to the right of their parent. The downstream columns
  // (Parse / Claim / Eval / Pulled / Public) shift right by `maxDepth *
  // ASSET_COL_GAP` so they don't collide with deep Asset trees. When no
  // hierarchy exists, maxDepth === 0 and the layout is identical to today.
  const ownedAssets = view.assets.filter((a) => view.ownedAssetIds.has(a.id))
  const pulledAssets = view.assets.filter((a) => !view.ownedAssetIds.has(a.id))

  const ownedAssetMap = new Map(ownedAssets.map((a) => [a.id, a]))
  const computeDepth = (assetId, visited = new Set()) => {
    if (visited.has(assetId)) return 0  // cycle safety
    visited.add(assetId)
    const asset = ownedAssetMap.get(assetId)
    if (!asset || !asset.parentAssetId) return 0
    return 1 + computeDepth(asset.parentAssetId, visited)
  }
  const ownedAssetDepth = new Map(
    ownedAssets.map((a) => [a.id, computeDepth(a.id)])
  )
  const maxOwnedAssetDepth = ownedAssets.length
    ? Math.max(0, ...ownedAssetDepth.values())
    : 0
  const assetColShift = maxOwnedAssetDepth * ASSET_COL_GAP

  // Effective column positions — shifted right when hierarchy depth > 0.
  const COL_OWN_PARSE_eff = COL_OWN_PARSE + assetColShift
  const COL_OWN_CLAIM_eff = COL_OWN_CLAIM + assetColShift
  const COL_OWN_EVAL_eff = COL_OWN_EVAL + assetColShift
  const COL_PULLED_CLAIM_eff = COL_PULLED_CLAIM + assetColShift
  const COL_PULLED_EVAL_eff = COL_PULLED_EVAL + assetColShift
  const COL_PULLED_ASSET_eff = COL_PULLED_ASSET + assetColShift
  const COL_PUBLIC_eff = COL_PUBLIC + assetColShift

  // Group owned Assets by depth and place each at its depth's column.
  // Within a depth group, vertical position uses the asset's index inside
  // that group (so depth-0 roots stack at i*ROW_STEP, depth-1 children also
  // stack at i*ROW_STEP within the depth-1 column, etc.). The "squeeze
  // children into rows aligned with their parent" UX optimization is
  // deferred — see polish backlog.
  const assetsByDepth = new Map()
  ownedAssets.forEach((a) => {
    const d = ownedAssetDepth.get(a.id)
    if (!assetsByDepth.has(d)) assetsByDepth.set(d, [])
    assetsByDepth.get(d).push(a)
  })

  ownedAssets.forEach((asset) => {
    const depth = ownedAssetDepth.get(asset.id) || 0
    const peers = assetsByDepth.get(depth) || []
    const i = peers.indexOf(asset)
    const x = COL_OWN_ASSET + (depth * ASSET_COL_GAP)
    // Phase 10.2.1: symmetric distribution around y=0; Asset column carries
    // no per-column offset (it's the base column).
    const y = symmetricRowY(i)
    const node = assetToNode(asset, x, y)
    // Phase 9A.4 Gate B: stamp _pendingTransfer so AssetNode can render the
    // TRANSFERRING badge. Canvas adapter also sets _showAsProvisional so the
    // dashed-border treatment fires (same visual language as Phase 4 PROVISIONAL).
    const pendingTransfer = view.pendingTransfersByAssetId?.get(asset.id)
    if (pendingTransfer) {
      node._pendingTransfer = pendingTransfer
      node._showAsProvisional = true
    }
    nodes.push(node)
  })

  // Now that assetColShift is known, push the Radiant Network anchor at
  // the shifted public column.
  if (hasNetworkAnchor) {
    nodes.push(actorToNode(RADIANT_NETWORK_ACTOR, COL_PUBLIC_eff, 0))
  }

  // Phase 6 carry-over #4: do NOT append "· PROVISIONAL" / "· DECLINED" to v22Type.
  // The node card already renders separate PROVISIONAL/DECLINED badges via
  // AssetNode.jsx (showAsProvisional / isDeclined). Doubling up looks duplicated.
  // Phase 6 carry-over #3: set _isNew on provisional nodes so the NEW badge
  // renders for the entire provisional duration (not just for the brief reveal).
  const markProvisional = (node, set) => {
    if (set && set.has(node.id)) {
      node.isProvisional = true
      node._showAsProvisional = true
      node._isNew = true
    }
    return node
  }

  // ── Owned Parse Results (column 2) aligned with their source asset ───
  // Phase 10.2.1: each Parse Result anchors on the Y of its source Asset
  // (computed via the same symmetricRowY + depth-grouping the Asset uses)
  // plus the per-column COL_Y_OFFSET so Parse rows don't sit at the same
  // y-line as their parent Asset. Multiple Parse Results on one Asset stack
  // in 100px (one full grid step) increments to stay grid-aligned — was 80px.
  const parseSlotByAsset = new Map()
  view.parseResults.forEach((pr) => {
    const sourceAsset = ownedAssets.find((a) => a.id === pr.sourceAssetId)
    let baseY = 0
    if (sourceAsset) {
      const sourceDepth = ownedAssetDepth.get(sourceAsset.id) || 0
      const sourcePeers = assetsByDepth.get(sourceDepth) || []
      const sourceIdx = sourcePeers.indexOf(sourceAsset)
      baseY = symmetricRowY(sourceIdx)
    }
    const slot = parseSlotByAsset.get(pr.sourceAssetId) || 0
    parseSlotByAsset.set(pr.sourceAssetId, slot + 1)
    const y = baseY + COL_Y_OFFSET + (slot * 100)
    nodes.push(parseResultToNode(pr, COL_OWN_PARSE_eff, y))
  })

  // ── Claims (owned column 3; pulled-in column 5) ──────────────────────
  const ownedClaims = view.claims.filter((c) => view.ownedClaimIds.has(c.id))
  const pulledClaims = view.claims.filter((c) => !view.ownedClaimIds.has(c.id))
  ownedClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    // Phase 10.2.1: symmetric distribution; Owned Claims at offset 0 (two
    // columns away from owned Assets, so no overlap risk on horizontal lines).
    nodes.push(claimToNode(claim, rollup, COL_OWN_CLAIM_eff, symmetricRowY(i)))
  })
  pulledClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    // Phase 10.2.1: symmetric distribution; Pulled Claims at offset 0.
    const node = claimToNode(claim, rollup, COL_PULLED_CLAIM_eff, symmetricRowY(i))
    markProvisional(node, view.provisionalClaimIds)
    // Declined claims (Phase 5 / spec §11.4 + Phase 6.5 #3). AssetNode renders
    // its own DECLINED badge from `isDeclined`; we keep `_showAsProvisional`
    // true so the dashed border persists, but clear `_isNew` (no NEW badge).
    const declineRecord = view.declinedClaimIds?.get(claim.id)
    if (declineRecord) {
      node.isDeclined = true
      // V2.1's AssetNode reads `_isDeclined` (underscore-prefixed) for badge
      // precedence; V22NodeDetailPanel reads `isDeclined`. Set both so node
      // card and panel agree (Phase 6.5+ #2 — without this, the inline badge
      // fell through to PROVISIONAL because `_isDeclined` stayed undefined).
      node._isDeclined = true
      node._declineReason = declineRecord.reason
      node._declineRecord = declineRecord
      node._showAsProvisional = true
      node._isNew = false
      node.isProvisional = false
    }
    // Phase 9D: revoked Claims on the grantee's canvas. Pattern mirrors the
    // declined treatment — REVOKED badge, persistent dashed border, cleared
    // NEW state. Claim Detail Panel gates on `isRevoked` to render the
    // REVOKED header + reason + Dismiss CTA.
    const revokeRecord = view.revokedClaimIds?.get(claim.id)
    if (revokeRecord) {
      node.isRevoked = true
      node._isRevoked = true
      node._revokeReason = revokeRecord.reason
      node._revokeRecord = revokeRecord
      node._showAsProvisional = true
      node._isNew = false
      node.isProvisional = false
    }
    nodes.push(node)
  })

  // ── Pulled-in counterparty Assets (column 6) ────────────────────────
  // Phase 10.2.1: symmetric distribution + COL_Y_OFFSET so Pulled Assets
  // sit one grid step below the Pulled Claims they live alongside —
  // claim → asset edges across the column gap gain a guaranteed vertical
  // component instead of stacking on the same horizontal line.
  pulledAssets.forEach((asset, i) => {
    const y = symmetricRowY(i) + COL_Y_OFFSET
    const node = assetToNode(asset, COL_PULLED_ASSET_eff, y)
    markProvisional(node, view.provisionalAssetIds)
    nodes.push(node)
  })

  // ── Evaluation Results ───────────────────────────────────────────────
  // Three groupings:
  //   • erOwn — actor's own Eval Results (own evaluation column).
  //   • erProofOfEval — counterparty Eval Results visible via proof-of-
  //     evaluation DAs (subject=evalResult); the actor is the Claim owner
  //     receiving the proof. These sit alongside the actor's own Eval
  //     Results because conceptually they evaluate the actor's Claims.
  //   • erProofOnlyPulled — Phase 11D.3: counterparty Eval Results pulled
  //     in via proof-only Claim DAs. These belong to a counterparty's
  //     Claim that's now on the actor's canvas, so they sit in the
  //     pulled-Eval column near the source Claim, not in the actor's
  //     own evaluation flow.
  const proofOnlyPulledEvalIds = view.proofOnlyPulledEvalIds || new Set()
  const erOwn = view.evaluationResults.filter((e) => e.owner === actor.party)
  const erProofOfEval = view.evaluationResults.filter((e) =>
    e.owner !== actor.party && !proofOnlyPulledEvalIds.has(e.id),
  )
  const erProofOnlyPulled = view.evaluationResults.filter((e) =>
    e.owner !== actor.party && proofOnlyPulledEvalIds.has(e.id),
  )
  // Phase 10.2.1: replaces the legacy `EVAL_ROW_OFFSET = ROW_STEP / 2`
  // (Phase 6.5 #17) with the standard COL_Y_OFFSET (100 — one full grid
  // step). External Eval Results stack continuously below the owned ones
  // via `symmetricRowY(erOwn.length + i)`; the prior `+80` magic spacer is
  // gone since the symmetric distribution handles separation naturally.
  erOwn.forEach((er, i) => {
    nodes.push(evalResultToNode(er, COL_OWN_EVAL_eff, symmetricRowY(i) + COL_Y_OFFSET))
  })
  erProofOfEval.forEach((er, i) => {
    nodes.push(evalResultToNode(er, COL_OWN_EVAL_eff, symmetricRowY(erOwn.length + i) + COL_Y_OFFSET))
  })
  // Phase 11D.4.1: place each proof-only-pulled Eval Result derived from
  // its source Claim's position, NOT at a fixed column. This avoids
  // collisions with horizontal traffic lanes on the actor's canvas (the
  // earlier Phase 11D.4 fixed column at COL_OWN_EVAL = 1700 pushed the
  // node into the actor's own evaluation flow on the grantee canvas, and
  // the connecting edge crossed unrelated nodes). The Eval Result hangs
  // off-and-below the source Claim:
  //   x = sourceClaim.x + 200  (slight offset right; reads as "attached")
  //   y = sourceClaim.y + 300  (clearly below the Claim's row, leaving
  //                            the Claim's horizontal traffic lane clean)
  // Multiple ERs disclosed under one DA stack vertically by COL_Y_OFFSET.
  const claimNodeById = new Map(nodes.filter((n) => n.v22Type === 'CLAIM').map((n) => [n.id, n]))
  const erPulledPerClaim = new Map() // claimId → count placed so far (for stacking)
  erProofOnlyPulled.forEach((er) => {
    const sourceClaim = claimNodeById.get(er.claimId)
    const stackIdx = erPulledPerClaim.get(er.claimId) || 0
    erPulledPerClaim.set(er.claimId, stackIdx + 1)
    if (!sourceClaim) {
      // Defensive fallback — source Claim isn't on canvas (shouldn't
      // happen since W1 of Phase 11D.3 pulls it in). Drop at the far-right
      // edge of the actor's own evaluation flow.
      nodes.push(evalResultToNode(er, COL_PULLED_EVAL_eff, stackIdx * ROW_STEP))
      return
    }
    const x = sourceClaim.x + 200
    const y = sourceClaim.y + 300 + (stackIdx * COL_Y_OFFSET)
    nodes.push(evalResultToNode(er, x, y))
  })

  // ── Edges ────────────────────────────────────────────────────────────
  const edges = deriveAgreementEdges(view)

  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  return { nodes, edges, nodeMap }
}
