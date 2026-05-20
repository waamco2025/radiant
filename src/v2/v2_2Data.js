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
// Phase 15.0 (#172 part 1): generated PDF anchor coordinates + file
// metadata. Source of truth lives in scripts/generate-seed-pdfs.mjs;
// the .js file here is regenerated whenever PDFs are regenerated.
import { PDF_ANCHORS, PDF_FILES } from './data/evidenceAnchors.js'

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
const poeUri = (id) => `provenance://poe/${id}`

// Valid disclosure types per spec §4.2 (edge styling table).
const DISCLOSURE_TYPES = new Set(['full', 'selective', 'proofonly', 'provisional', 'expired'])

// Valid subject kinds per spec §10.4 (DA subject field).
const SUBJECT_KINDS = new Set(['asset', 'claim', 'evalResult', 'parseResult', 'poe'])

// Phase 13.1 (#168a): content-addressed-style id format. Replaces the
// `[type]-[party]-[claim]-NNN` legacy pattern with `[type]-[8-char-base32]`.
// Actor names no longer leak into ids.
const ID_BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
function makeShortIdSuffix(seed) {
  // Deterministic 8-char base32 — uses a hashed seed when supplied so the
  // seed-construction pass produces stable ids across reloads, while
  // runtime callers can pass `Date.now()` for entropy. Two independent
  // FNV-1a streams (different offsets) advance separately to avoid the
  // monotonic shift convergence that would otherwise repeat the last
  // char across the lower bits.
  let h1 = 2166136261 >>> 0
  let h2 = 1597334677 >>> 0
  const str = String(seed ?? Math.random())
  for (let i = 0; i < str.length; i += 1) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ c, 1597334677) >>> 0
  }
  let out = ''
  for (let i = 0; i < 8; i += 1) {
    out += ID_BASE32_ALPHABET[(h1 ^ h2) & 31]
    // Re-mix both streams between characters.
    h1 = Math.imul(h1 + i + 1, 16777619) >>> 0
    h2 = Math.imul(h2 ^ (i + 0x9e3779b9), 2654435761) >>> 0
  }
  return out
}
export function makeArtifactId(prefix, seed) {
  return `${prefix}-${makeShortIdSuffix(seed)}`
}

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
 *
 * Phase 12.1 (#120): `referencedRequirementsSets[]` is informational metadata
 * declaring which standards the Claim is built to satisfy. Non-binding —
 * does not couple to evaluation, does not auto-suggest in Run Evaluation,
 * does not produce notifications when changed. Owner-authoritative: only
 * the Claim owner can add/remove. Version-pinned: each entry stores the
 * specific RS version id, not a "latest" pointer. See §10.3a.
 *
 * Entry shape: `{ requirementsSetId: string, addedDate: ISO8601 string }`.
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
  // Phase 12.1 (#120): non-binding "Referenced Standards" metadata.
  referencedRequirementsSets = [],
  // Phase 12.2 (#122): Claim-internal Asset versioning chain. Parallel to
  // `referencedAssetIds[]` (which stays the EFFECTIVE active set, primitive
  // strings) — `assetReferences[]` carries the audit chain incl. removed
  // and superseded entries:
  //   { assetId, supersededBy, addedDate, removedDate }
  // - `supersededBy`: id of the replacement Asset (null until "Replace")
  // - `removedDate`: ISO timestamp when the entry was dropped (null until
  //   "Remove"); the Asset node itself is NEVER modified.
  // The factory derives this array from `referencedAssetIds[]` if not
  // provided so seed Claims and pre-12.2 callers migrate cleanly with
  // `supersededBy: null, removedDate: null` defaults.
  assetReferences = null,
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
    // Phase 12.1 (#120): version-pinned RS references. Each entry preserves
    // the specific version id at addition time so library supersessions
    // don't silently retarget existing references.
    referencedRequirementsSets: referencedRequirementsSets.map((r) => ({
      requirementsSetId: r.requirementsSetId,
      addedDate: r.addedDate,
    })),
    // Phase 12.2 (#122): Asset versioning chain. Defaults to one entry per
    // `referencedAssetIds[]` Asset with all supersession fields null when
    // not explicitly passed in (covers seed data + pre-12.2 callers).
    assetReferences: assetReferences
      ? assetReferences.map((r) => ({
          assetId: r.assetId,
          supersededBy: r.supersededBy ?? null,
          addedDate: r.addedDate ?? createdDate ?? null,
          removedDate: r.removedDate ?? null,
        }))
      : referencedAssetIds.map((assetId) => ({
          assetId,
          supersededBy: null,
          addedDate: createdDate ?? null,
          removedDate: null,
        })),
    createdDate,
    amendments: amendments.map((a) => ({
      date: a.date,
      added: [...(a.added || [])],
      removed: [...(a.removed || [])],
      // Phase 12.1: parallel diff arrays for Referenced Standards changes.
      // Empty for legacy Asset-only amendments. Both add/remove and the
      // supersession-update path (UpdateRSReferenceModal) write into these
      // fields; supersession updates produce one entry in each.
      addedRequirementsSetIds: [...(a.addedRequirementsSetIds || [])],
      removedRequirementsSetIds: [...(a.removedRequirementsSetIds || [])],
      // Phase 12.2 (#122): Asset supersession diff arrays. `supersededAssets`
      // entries have `{ from, to }` shape; `removedAssetIds` entries are
      // bare ids dropped without successor. Empty by default.
      supersededAssets: (a.supersededAssets || []).map((s) => ({ from: s.from, to: s.to })),
      removedAssetIds: [...(a.removedAssetIds || [])],
    })),
    dot: claimDot,
  }
}

// Phase 12.3 (Bug B): single source of truth for "what Assets does this
// Claim currently reference?" Filters out entries with `removedDate` set
// and resolves `supersededBy` chains to their latest active head. Pass an
// `allAssets` array (typically the merged shared dataset's `assets`) and
// receive Asset objects (not just ids). Returns `[]` for malformed claims.
//
// Consumers should prefer this helper over reading `claim.referencedAssetIds`
// directly when (a) they need full Asset objects and (b) they want the
// chain-resolution semantics. The primitive `referencedAssetIds[]` IS
// already the active set after `makeAmendedClaim` runs (the factory
// derives it from `assetReferences[].filter(r => !r.removedDate &&
// !r.supersededBy)`), so most existing call sites that read just the ids
// already get correct behavior — but a stale DA scope (`da.scope.assetIds`)
// or any other ids-from-elsewhere computation can leak removed entries.
// Filing #170 to consolidate the dual-shape model in a follow-up phase.
export function getInScopeAssets(claim, allAssets = []) {
  if (!claim) return []
  // Use the chain when present (Phase 12.2+); fall back to the primitive
  // list for pre-12.2 claims that haven't been amended yet.
  if (Array.isArray(claim.assetReferences) && claim.assetReferences.length > 0) {
    return claim.assetReferences
      .filter((r) => !r.removedDate && !r.supersededBy)
      .map((r) => allAssets.find((a) => a.id === r.assetId))
      .filter(Boolean)
  }
  return (claim.referencedAssetIds || [])
    .map((id) => allAssets.find((a) => a.id === id))
    .filter(Boolean)
}

// Phase 12.2 (#122): walk the Claim-internal Asset supersession chain and
// return the latest version's id. Mirrors `getLatestRSVersion` (Phase 12.1).
// Returns the input id when no supersession exists or the entry isn't on
// the Claim's chain (defensive). The chain is a linked list — each entry's
// `supersededBy` points to the next version (or null if this is the head).
export function getLatestAssetVersion(assetId, claim) {
  if (!assetId || !claim?.assetReferences) return assetId
  const byId = new Map()
  for (const r of claim.assetReferences) byId.set(r.assetId, r)
  let current = assetId
  const seen = new Set()
  while (true) {
    if (seen.has(current)) return current   // cycle guard
    seen.add(current)
    const entry = byId.get(current)
    if (!entry || !entry.supersededBy) return current
    current = entry.supersededBy
  }
}

// Phase 12.2 (#122): determine whether an Eval Result has gone OUTDATED
// against the current state of its source Claim. Returns true when any
// `evidenceUsed` Asset has been superseded OR removed on the Claim since
// the evaluation. Used at AmendClaim submit to flip Eval Result status
// and enqueue `v22-eval-result-stale` notifications.
//
// `claim` is the post-amendment Claim. Comparing `evidenceUsed` (snapshot
// from the evaluation moment) against the post-amendment chain captures
// both supersessions (entry has non-null supersededBy that wasn't there
// before) and removals (entry has non-null removedDate).
export function isEvalResultStale(evalResult, claim) {
  if (!evalResult || !claim?.assetReferences) return false
  if (evalResult.status === 'superseded') return false   // already terminal
  const usedIds = new Set(evalResult.evidenceUsed || [])
  if (usedIds.size === 0) return false   // self-attestation evals don't go stale on Asset changes
  for (const ref of claim.assetReferences) {
    if (!usedIds.has(ref.assetId)) continue
    if (ref.removedDate) return true
    if (ref.supersededBy) return true
  }
  return false
}

// Phase 13.3 (Step 2): Re-Run requires at least one new Asset that wasn't
// in the prior Eval Result's `evidenceUsed`. Otherwise re-running against
// the same evidence + same RSes would produce a duplicate evaluation.
// `inScopeAssetIds` is the set of Asset ids the evaluator can actually
// see for this Claim (caller computes via DA scope + Claim references).
// Returns true iff at least one in-scope Asset id is NOT in the prior
// `evidenceUsed`.
export function hasNewAssetsForRerun(inScopeAssetIds, priorEvalResult) {
  if (!priorEvalResult) return false
  const prior = new Set(priorEvalResult.evidenceUsed || [])
  for (const aid of (inScopeAssetIds || [])) {
    if (!prior.has(aid)) return true
  }
  return false
}

// Phase 12.2 (#117): compute the diff between a prior Eval Result's
// `evidenceUsed` snapshot and the current Claim's effective in-scope set.
// Used by the Run Evaluation modal banner and the new Eval Result Detail
// Panel "Changes from prior evaluation" section. Returns:
//   {
//     added: [assetId, ...],          // in current set, not in prior
//     removed: [assetId, ...],        // in prior, not in current; not via supersession
//     superseded: [{ from, to }, ...],// in prior; chain now points to a different head
//     carried: [assetId, ...],        // in both prior and current, unchanged
//   }
// `current` is the Claim's effective active set: assetReferences entries
// without `removedDate` AND not superseded (i.e. the chain heads).
export function computeEvidenceDiff(priorEvalResult, claim) {
  if (!priorEvalResult || !claim?.assetReferences) {
    return { added: [], removed: [], superseded: [], carried: [] }
  }
  const priorIds = new Set(priorEvalResult.evidenceUsed || [])
  const refsById = new Map()
  for (const r of claim.assetReferences) refsById.set(r.assetId, r)
  // Compute the current effective active set: walk each entry; an entry is
  // active iff it has no removedDate AND no supersededBy (the chain HEADS).
  // (Superseded entries' supersededBy points DOWN the chain to the new
  // active version; the active versions have supersededBy === null.)
  const currentActive = new Set()
  for (const r of claim.assetReferences) {
    if (r.removedDate) continue
    if (r.supersededBy) continue
    currentActive.add(r.assetId)
  }
  const added = []
  const removed = []
  const superseded = []
  const carried = []
  // Each prior id falls into one of: carried (still active),
  // superseded (chain head moved), removed (dropped without successor).
  for (const pid of priorIds) {
    if (currentActive.has(pid)) { carried.push(pid); continue }
    const head = getLatestAssetVersion(pid, claim)
    if (head !== pid && currentActive.has(head)) {
      superseded.push({ from: pid, to: head })
      continue
    }
    // Prior id is gone from the active set and has no live successor.
    removed.push(pid)
  }
  // Anything in currentActive not represented above is freshly added.
  const seenInDiff = new Set([...carried, ...superseded.map((s) => s.to)])
  for (const aid of currentActive) {
    if (!priorIds.has(aid) && !seenInDiff.has(aid)) added.push(aid)
  }
  return { added, removed, superseded, carried }
}

// Phase 12.1 (#120): helper that walks the RS supersession chain and
// returns the latest version's id given any version's id. `allRS` should
// be the union of every RS visible to the active actor (own authored +
// publicly published). Returns the input id unchanged when no successor
// exists (i.e. the RS is the latest in its lineage, or the lineage has
// no other entries in the supplied pool).
//
// V2.2 RS shape carries:
//   { id: 'reqset-foo-v1', lineageId: 'lineage-foo', version: 1, ... }
//
// All entries with the same `lineageId` are versions of the same logical
// standard. The latest is the highest `version`. RS without a `lineageId`
// (legacy/standalone) are treated as their own lineage of one.
//
// Phase 12.2 callers may also need the full latest RS object — this
// helper returns just the id for parity with how the field stores it;
// callers can `.find(rs => rs.id === id)` once they have the id.
export function getLatestRSVersion(rsId, allRS = []) {
  if (!rsId) return rsId
  const ref = allRS.find((rs) => rs.id === rsId)
  if (!ref) return rsId
  const lineageId = ref.lineageId || ref.id
  const inLineage = allRS.filter((rs) => (rs.lineageId || rs.id) === lineageId)
  if (inLineage.length === 0) return rsId
  let latest = ref
  for (const rs of inLineage) {
    if ((rs.version ?? 0) > (latest.version ?? 0)) latest = rs
  }
  return latest.id
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
      // Phase 13.1 (#168a): proof-only DAs are a discriminated union.
      // `subject.kind === 'evalResult'` carries `evaluationResultIds`
      // (auto-disclosure DA created at Eval Result save time, evaluator →
      // claim owner); `subject.kind === 'poe'` carries `poeIds` (created
      // at PoE creation time, plus published proof-only Claim DAs that
      // disclose the PoE wrapper to a third party). Both fields exist on
      // the data shape; consumers branch on subject.kind.
      evaluationResultIds: scope.evaluationResultIds ? [...scope.evaluationResultIds] : null,
      poeIds: scope.poeIds ? [...scope.poeIds] : null,
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
      poeIds: scope.poeIds ?? null,
      includeDerivatives: scope.includeDerivatives ?? true,
    },
    terms,
    status: 'active',
  })
}

/**
 * Proof-of-Evaluation Disclosure Agreement — evaluator (grantor) → claim owner
 * (grantee). Phase 13.1 (#168a): discriminated union. Pass either
 * `evaluationResultId` (auto-disclosure created at Eval Result save time) or
 * `poeId` (created at PoE creation time). Mutually exclusive — `subject.kind`
 * disambiguates the two shapes downstream:
 *   • `subject.kind === 'evalResult'` + `scope.evaluationResultIds: [evalId]`
 *   • `subject.kind === 'poe'`        + `scope.poeIds: [poeId]`
 */
export function makeProofOfEvalDisclosureAgreement({
  id,
  evaluator,
  evaluatorDot,
  claimOwner,
  claimOwnerDot,
  evaluationResultId = null,
  poeId = null,
  terms = {},
}) {
  if (!evaluationResultId && !poeId) {
    throw new Error('makeProofOfEvalDisclosureAgreement: one of evaluationResultId or poeId is required')
  }
  if (evaluationResultId && poeId) {
    throw new Error('makeProofOfEvalDisclosureAgreement: evaluationResultId and poeId are mutually exclusive')
  }
  const subject = poeId
    ? { kind: 'poe', id: poeId }
    : { kind: 'evalResult', id: evaluationResultId }
  const scope = poeId
    ? { poeIds: [poeId], includeDerivatives: false }
    : { evaluationResultIds: [evaluationResultId], includeDerivatives: false }
  return makeDisclosureAgreement({
    id,
    grantor: { party: evaluator, dot: evaluatorDot || makeDot(evaluator) },
    grantee: { party: claimOwner, dot: claimOwnerDot || makeDot(claimOwner) },
    subject,
    granteeAssetId: null,
    // Phase 13.2: auto-disclosure default is 'proofonly'. Both parties still
    // see all results in Detail Panels — proof-only is an edge style + the
    // discriminated-union subject discriminator, NOT a content restriction.
    // Reflects the real-world supply-chain pattern where evaluation outcomes
    // are shared without exposing the source documents.
    type: 'proofonly',
    scope,
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
 * Phase 17.3 — shared predicate for resolving an active or pending EA between
 * a requester (grantee) and a Claim's owner (grantor) for a specific Claim.
 *
 * Returns the resolved EA artifact when one exists, null otherwise. Used by:
 *   - V22NodeDetailPanel Claim view to gate the Directory-layer "EA in place
 *     with {owner}" vs "EA required" content + footer button (Phase 17.3).
 *   - AssetNode's V22ActionBar to drive the Directory-layer Claim card's
 *     "View Evaluation Agreement" vs "Request Evaluation Agreement" CTA.
 *   - V2App handlers when navigating from the View EA button on Directory.
 *
 * Filtering rules:
 *   - `ea.grantor.party === claim.owner` AND `ea.grantee.party === requesterParty`
 *     AND `ea.claimId === claim.id`
 *   - Skip EAs flagged with `_declineMeta` or `_revokedMeta` (the existing
 *     declined / revoked session-state markers).
 *   - Include `status: 'active'` (and any other in-flight status like
 *     'pending-acceptance' Phase 11.6, which behaves like active for the
 *     purposes of "EA exists between these two parties"). Excluded: declined
 *     (already filtered via _declineMeta), revoked (already filtered via
 *     _revokedMeta).
 *
 * Tie-breaking: if multiple EAs match (rare — would mean multiple EAs between
 * the same grantor/grantee on the same Claim, which can happen if an old EA
 * was superseded but not formally closed), prefer active over pending-
 * acceptance, then most recent by `createdDate` (terms.createdDate on the EA).
 */
export function getActiveEaForClaimAndRequester(claim, requesterParty, evaluationAgreements) {
  if (!claim || !requesterParty || !Array.isArray(evaluationAgreements)) return null
  const candidates = evaluationAgreements.filter((ea) => {
    if (!ea) return false
    if (ea._declineMeta || ea._revokedMeta) return false
    if (ea.grantor?.party !== claim.owner) return false
    if (ea.grantee?.party !== requesterParty) return false
    if (ea.claimId !== claim.id) return false
    return true
  })
  if (candidates.length === 0) return null
  if (candidates.length === 1) return candidates[0]
  const dateOf = (ea) => ea.terms?.createdDate || ea.createdDate || ''
  const active = candidates.filter((ea) => ea.status === 'active')
  if (active.length > 0) {
    return active.sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))))[0]
  }
  return candidates.sort((a, b) => String(dateOf(b)).localeCompare(String(dateOf(a))))[0]
}

/**
 * Evaluation Result artifact — spec §10.6. Owned by the evaluator; visible to the
 * Claim owner via a Proof-of-Evaluation Disclosure Agreement (see spec §3.5).
 *
 * Phase 13.1 (#168a) model correction: ONE Eval Result per Run Evaluation
 * submission. `requirementsSets[]` is plural (multi-RS evaluations bundle all
 * selected RSes) and `results[]` is flat — every row carries its own
 * `requirementsSetId`. The legacy singular `requirementsSet` field is gone, as
 * is the `batchId` grouping mechanism (Phase 12.2's wrong "N Eval Results
 * sharing batchId" pattern).
 */
export function makeEvaluationResult({
  id,
  owner,
  ownerDot,
  evaluationAgreementId,
  claimId,
  granteeAssetId = null,
  // Phase 13.1 (#168a): plural array of `{ id, name, version }` covering
  // every Requirements Set evaluated in this run. Backed by per-row
  // `requirementsSetId` on each `results[]` entry.
  requirementsSets = [],
  results = [],
  evidenceUsed = [],
  evaluationDate,
  status = 'active',
  supersededBy = null,
  // Phase 12.2 (#117): re-run audit metadata. `priorEvalResultId` links
  // to the Eval Result this run replaces; `evidenceDiff` captures the
  // delta between prior + current evidence snapshots. Both null on first
  // evaluation; populated on every re-run by V2App's submit handler.
  priorEvalResultId = null,
  evidenceDiff = null,
  dot,   // optional structured DOT; derived below if absent
}) {
  if (!id) throw new Error('makeEvaluationResult: id is required')
  if (!owner) throw new Error('makeEvaluationResult: owner is required')
  if (!evaluationAgreementId) {
    throw new Error('makeEvaluationResult: evaluationAgreementId is required')
  }
  if (!claimId) throw new Error('makeEvaluationResult: claimId is required')
  if (!Array.isArray(requirementsSets) || requirementsSets.length === 0) {
    throw new Error('makeEvaluationResult: requirementsSets[] is required (non-empty)')
  }
  for (const rs of requirementsSets) {
    if (!rs || !rs.id) {
      throw new Error('makeEvaluationResult: each requirementsSets entry needs { id, name, version }')
    }
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
    requirementsSets: requirementsSets.map((rs) => ({
      id: rs.id,
      name: rs.name,
      version: rs.version ?? 1,
    })),
    results: results.map((r) => ({
      requirementsSetId: r.requirementsSetId,
      requirementId: r.requirementId,
      label: r.label,
      value: r.value,
      status: r.status, // 'satisfactory' | 'unsatisfactory' | 'missing' | 'na'
      // Phase 9A item 8 sub-3 + item 10: preserve AI confidence + the original
      // AI-extracted value so the Detail Panel can render the confidence chip
      // and the human-edited pencil on artifacts after they've landed.
      confidence: r.confidence,
      _aiOriginalValue: r._aiOriginalValue,
      // Phase 15.0.1 (#172 part 1 hotfix): preserve evidenceAnchors —
      // the Phase 15.0 ship populated `evidenceAnchors: [...]` on seed
      // result rows but this factory map didn't pass it through, so
      // the seed data layer reported zero anchors at the consumer end.
      // The annotation overlay rendered correctly when probed
      // standalone but never via the seed; this preserves the field
      // for both fresh evaluations (passed at submit) and seed data.
      evidenceAnchors: Array.isArray(r.evidenceAnchors)
        ? r.evidenceAnchors.map((a) => ({ ...a }))
        : [],
    })),
    evidenceUsed: [...evidenceUsed],
    evaluationDate,
    status, // Phase 12.2: 'active' | 'superseded' | 'outdated'
    supersededBy,
    priorEvalResultId,
    evidenceDiff: evidenceDiff
      ? {
          added: [...(evidenceDiff.added || [])],
          removed: [...(evidenceDiff.removed || [])],
          superseded: (evidenceDiff.superseded || []).map((s) => ({ from: s.from, to: s.to })),
          carried: [...(evidenceDiff.carried || [])],
        }
      : null,
    dot: evalDot,
  }
}

/**
 * Phase 13.1 (#168a): aggregate counts across an Eval Result's flat
 * `results[]`. Returns `{ totalSat, totalUnsat, totalMissing, totalNa,
 * rsCount }` for card / Detail Panel rendering.
 */
export function getEvalResultAggregate(evalResult) {
  const counts = { totalSat: 0, totalUnsat: 0, totalMissing: 0, totalNa: 0, rsCount: 0 }
  if (!evalResult) return counts
  for (const r of (evalResult.results || [])) {
    if (r.status === 'satisfactory') counts.totalSat += 1
    else if (r.status === 'unsatisfactory') counts.totalUnsat += 1
    else if (r.status === 'missing') counts.totalMissing += 1
    else if (r.status === 'na') counts.totalNa += 1
  }
  counts.rsCount = (evalResult.requirementsSets || []).length
  return counts
}

/**
 * Proof of Evaluation (PoE) — Phase 13 (#168), simplified in Phase 13.1
 * (#168a) to a 1:1 wrap. A PoE wraps exactly one Eval Result. Created by a
 * deliberate Evaluator action; terminates the evaluation chain for the
 * (Asset set, RS set, evaluator) combination. PoE-targeting DAs replace
 * the prior pattern of disclosing individual Eval Results.
 *
 * Required:
 *   id, owner, claimId, wrappedEvalResultId, createdDate.
 * Optional:
 *   ownerDot, requirementsSetIds (derived from the wrapped Eval Result's
 *   `requirementsSets[]`), assetSnapshot (in-scope Asset ids at PoE
 *   creation time), claimName, dot (otherwise derived).
 */
export function makePoE({
  id,
  owner,
  ownerDot,
  claimId,
  claimName,
  wrappedEvalResultId,
  requirementsSetIds = [],
  assetSnapshot = [],
  createdDate,
  dot,
  status = 'active',
}) {
  if (!id) throw new Error('makePoE: id is required')
  if (!owner) throw new Error('makePoE: owner is required')
  if (!claimId) throw new Error('makePoE: claimId is required')
  if (!wrappedEvalResultId || typeof wrappedEvalResultId !== 'string') {
    throw new Error('makePoE: wrappedEvalResultId is required (1:1 wrap)')
  }
  if (!createdDate) {
    throw new Error('makePoE: createdDate is required')
  }
  const pin = makePin(id)
  const ownerDid = ownerDot || makeDot(owner)
  // Phase 13.3 (Step 9): name format `Proof of [Claim label] Evaluation`.
  // The createdDate suffix is dropped from the name — the date stays in
  // the data model and surfaces in the Detail Panel header. Pre-13.3
  // names were `PoE for [Claim] · YYYY-MM-DD`; the new wording reads more
  // naturally and reflects the artifact's role rather than the bookkeeping
  // detail.
  const name = claimName
    ? `Proof of ${claimName} Evaluation`
    : 'Proof of Evaluation'
  const poeDot = dot || makeDotObject({
    pin,
    hash: null,
    ownerDid,
    registrationTimestamp: createdDate,
    metadata: { claimId, wrappedEvalResultId },
  })
  return {
    artifactType: 'poe',
    artifactUri: poeUri(id),
    id,
    pin,
    owner,
    ownerDot: ownerDid,
    name,
    claimId,
    wrappedEvalResultId,
    requirementsSetIds: [...requirementsSetIds],
    assetSnapshot: [...assetSnapshot],
    createdDate,
    dot: poeDot,
    status,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE TEMPLATE — Phase 14.0 (#169 part 1)
// ═══════════════════════════════════════════════════════════════════════════
//
// A Badge Template is a versioned, public, network-wide artifact owned by an
// Actor. Issuers (Phase 14.1) reference a Badge Template + a wrapped
// Evaluation Result / PoE to mint a Badge Issuance. The template itself
// only declares "what counts" — `referencedRequirementsSetIds` enumerates
// the Requirements Sets an issuance must cover.
//
// Versioning mirrors Requirements Sets exactly: same `lineageId`, integer
// `version`, `supersededBy` chain. Prior versions remain in the Library and
// remain referenceable. `getLatestBadgeTemplateVersion` walks the chain.
//
// All Badge Templates are inherently `published: true` — Phase 14.0 doesn't
// model unpublished drafts. Phase 14.1 may revisit this if private templates
// are wanted.

const badgeTemplateUri = (id) => `provenance://badges/${id}`

export function makeBadgeTemplate({
  id,
  ownerDot,
  ownerParty,
  name,
  description = '',
  referencedRequirementsSetIds = [],
  lineageId,
  version = 1,
  supersededBy = null,
  createdDate,
  dot,
}) {
  if (!id) throw new Error('makeBadgeTemplate: id is required')
  if (!ownerParty) throw new Error('makeBadgeTemplate: ownerParty is required')
  if (!name) throw new Error('makeBadgeTemplate: name is required')
  if (!Array.isArray(referencedRequirementsSetIds) || referencedRequirementsSetIds.length === 0) {
    throw new Error('makeBadgeTemplate: at least one referencedRequirementsSetId is required')
  }
  if (!createdDate) {
    throw new Error('makeBadgeTemplate: createdDate is required')
  }
  const pin = makePin(id)
  const ownerDid = ownerDot || makeDot(ownerParty)
  const lid = lineageId || `badgetpl-lineage-${id}`
  const tplDot = dot || makeDotObject({
    pin,
    hash: null,
    ownerDid,
    registrationTimestamp: createdDate,
    metadata: { lineageId: lid, version },
  })
  return {
    artifactType: 'badgeTemplate',
    artifactUri: badgeTemplateUri(id),
    id,
    pin,
    ownerParty,
    ownerDot: ownerDid,
    name,
    description,
    referencedRequirementsSetIds: [...referencedRequirementsSetIds],
    lineageId: lid,
    version,
    supersededBy,
    createdDate,
    published: true,
    dot: tplDot,
  }
}

// Mirror of `getLatestRSVersion` for Badge Templates. Walks the lineage by
// id; returns the input id when no successor exists or the entry isn't on
// the supplied chain.
export function getLatestBadgeTemplateVersion(badgeTemplateId, allBadgeTemplates = []) {
  if (!badgeTemplateId) return badgeTemplateId
  const ref = allBadgeTemplates.find((t) => t.id === badgeTemplateId)
  if (!ref) return badgeTemplateId
  const lid = ref.lineageId || ref.id
  const inLineage = allBadgeTemplates.filter((t) => (t.lineageId || t.id) === lid)
  if (inLineage.length === 0) return badgeTemplateId
  let latest = ref
  for (const t of inLineage) {
    if ((t.version ?? 0) > (latest.version ?? 0)) latest = t
  }
  return latest.id
}

// ═══════════════════════════════════════════════════════════════════════════
// BADGE ISSUANCE — Phase 14.1 (#169 part 2), corrected in Phase 14.2 (#169a)
// ═══════════════════════════════════════════════════════════════════════════
//
// A Badge Issuance is an endorsement event. Phase 14.2 architectural shift:
// badges target the CLAIM, not the PoE. The Claim is what earns the badge;
// PoEs that wrap qualifying Eval Results display the badge via aggregation.
// This enables third-party-issued badges on self-evaluations: OSHA can
// endorse Alice's Claim regardless of who created the proving PoE.
//
// Recipient is NOT stored — derived at render time from the target Claim's
// owner. Single source of truth.
//
// Issuance gate: `issuerParty !== claim.ownerParty`. The Claim owner can't
// endorse their own Claim. Enforced at every entry point + factory caller.
// (The factory doesn't load the Claim, so the caller does the check.)

const badgeIssuanceUri = (id) => `provenance://badges/issuances/${id}`

export function makeBadgeIssuance({
  id,
  issuerDot,
  issuerParty,
  targetClaimId,
  badgeTemplateId,
  description = '',
  createdDate,
  status = 'active',
  revokedDate = null,
  revocationReason = null,
  dot,
}) {
  if (!id) throw new Error('makeBadgeIssuance: id is required')
  if (!issuerParty) throw new Error('makeBadgeIssuance: issuerParty is required')
  if (!targetClaimId) throw new Error('makeBadgeIssuance: targetClaimId is required')
  if (!badgeTemplateId) throw new Error('makeBadgeIssuance: badgeTemplateId is required')
  if (!createdDate) throw new Error('makeBadgeIssuance: createdDate is required')
  const pin = makePin(id)
  const ownerDid = issuerDot || makeDot(issuerParty)
  const issuanceDot = dot || makeDotObject({
    pin,
    hash: null,
    ownerDid,
    registrationTimestamp: createdDate,
    metadata: { targetClaimId, badgeTemplateId },
  })
  return {
    artifactType: 'badgeIssuance',
    artifactUri: badgeIssuanceUri(id),
    id,
    pin,
    issuerParty,
    issuerDot: ownerDid,
    targetClaimId,
    badgeTemplateId,
    description,
    createdDate,
    status,
    revokedDate,
    revocationReason,
    dot: issuanceDot,
  }
}

// Active Badge Issuances targeting a specific Claim — direct lookup.
// Phase 14.2: this is the canonical aggregation. PoEs derive their badges
// via the parent Claim (see `getBadgesForPoE`).
export function getBadgesForClaim(claimId, allBadgeIssuances = []) {
  if (!claimId) return []
  return (allBadgeIssuances || []).filter((b) => b.targetClaimId === claimId && b.status === 'active')
}

// Active Badge Issuances surfaced on a PoE — derived. Phase 14.2: walk
// PoE → wrappedEvalResultId → eval result's claimId → badges targeting
// that Claim. The PoE displays its parent Claim's badges.
export function getBadgesForPoE(poeId, allEvalResults = [], allPoEs = [], allBadgeIssuances = []) {
  if (!poeId) return []
  const poe = (allPoEs || []).find((p) => p.id === poeId)
  if (!poe) return []
  const er = (allEvalResults || []).find((e) => e.id === poe.wrappedEvalResultId)
  if (!er) return []
  return getBadgesForClaim(er.claimId, allBadgeIssuances)
}

// Active Badge Issuances received by an Actor — Phase 14.2 walk via Claim
// ownership. Returns badges where the target Claim's owner === actorParty.
// Issuances issued by this actor are still active in the list (they're
// canonically active records); UI surfaces filter further if needed.
export function getBadgesForRecipient(actorParty, allBadgeIssuances = [], allClaims = []) {
  if (!actorParty) return []
  const ownerByClaimId = new Map(
    (allClaims || []).map((c) => [c.id, c.owner || c.ownerParty]),
  )
  return (allBadgeIssuances || []).filter((b) => {
    if (b.status !== 'active') return false
    return ownerByClaimId.get(b.targetClaimId) === actorParty
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// RFP — Phase 16.0 (skeletal placeholder, full feature in Phase 17)
// ═══════════════════════════════════════════════════════════════════════════
//
// An RFP (Request For Proposal) is a buyer-side artifact: a public posting
// of "we're seeking suppliers for X requirements set". The Directory Layer
// renders open RFPs as green dots clustered around the posting Actor's
// square (or the active Actor's corner card for own RFPs).
//
// Phase 16 shipped the data-model placeholder + a Bob-owned seed RFP. Phase
// 17.0 introduced the click pipeline + read-only Detail Panel. Phase 17.0.1
// brought RFPs to LOD parity with Claims. Phase 17.1 opens lifecycle:
// owner-side Close / Reopen transitions with role-aware visibility.
//
// Lifecycle states (Phase 17.1):
//   • `'open'` — default. Visible on every actor's Directory subject to the
//     existing ownership / orphan-RFP rules.
//   • `'closed'` — visible only on the OWNER's Directory (with a dashed-
//     outline visual treatment at every LOD). Hidden from non-owners by
//     `buildV22DirectoryDataForRole`'s `otherRfps` / `cluster.rfps` filter.
//
// `closedDate` (ISO 8601 string, optional) — set when transitioning to
// `'closed'`; cleared (null) when transitioning back to `'open'`. Used by
// the Detail Panel's "Closed YYYY-MM-DD · HH:MM UTC" row.
//
// Phase 17.2+ extends this with `responses[]` (supplier solicitations
// against an open RFP) and EA-initiation lifecycle hooks.

const RFP_STATUSES = new Set(['open', 'closed'])

export function makeRfp({
  id,
  owner,
  ownerDot,
  name,
  description,
  // Phase 17.2.1.1: assetId is now required. The architectural rule is
  // that disclosure + evaluation requests originate from the requester's
  // Asset; previously this was supplied at solicitation-accept time via
  // an Asset-picker modal. Specifying it at RFP-creation time pushes the
  // anchor choice up to the buyer and lets the Accept flow skip the
  // intermediate picker — the RFP's `assetId` flows through to the
  // CombinedRequestModal pre-fill directly.
  assetId,
  requirementsSetIds = [],
  status = 'open',
  closedDate = null,
  createdDate,
}) {
  if (!id) throw new Error('makeRfp: id is required')
  if (!owner) throw new Error('makeRfp: owner is required')
  if (!name) throw new Error('makeRfp: name is required')
  if (!assetId) throw new Error('makeRfp: assetId is required')
  // Phase 17.1: validate status against the lifecycle taxonomy. Unknown
  // values throw — surfaces seed-authoring typos that would otherwise
  // silently default to behaving as `'open'`.
  if (!RFP_STATUSES.has(status)) {
    throw new Error(`makeRfp: unknown status '${status}' — expected one of ${[...RFP_STATUSES].join(' | ')}`)
  }
  return {
    id,
    artifactType: 'rfp',
    type: 'rfp',
    owner,
    ownerDot: ownerDot || makeDot(owner),
    name,
    description: description || '',
    assetId,
    requirementsSetIds: [...requirementsSetIds],
    status,
    closedDate,
    createdDate: createdDate || new Date().toISOString(),
  }
}

// Phase 17.1: pure transforms used by V2App's mergeClosedRfps + close /
// reopen handlers. The merge layer is what wires session-state closures
// into rendered RFPs; these helpers are intentionally stateless so seed
// authoring + the merge layer + test code can all share one call site.
export function closeRfp(rfp, closedDate = null) {
  if (!rfp) throw new Error('closeRfp: rfp is required')
  return { ...rfp, status: 'closed', closedDate: closedDate || new Date().toISOString() }
}

export function reopenRfp(rfp) {
  if (!rfp) throw new Error('reopenRfp: rfp is required')
  return { ...rfp, status: 'open', closedDate: null }
}

// Phase 17.1: overlays session-state closed-RFP closures on the shared
// artifact collection. Mirror of `mergeProvisionals`'s shape — pure
// function, returns a new shared object with RFPs replaced where ids
// match. Storage shape is a Map<rfpId, closedDate ISO string> so each
// closure keeps the timestamp that was recorded when the user clicked
// Close (re-rendering doesn't shift the date). When the Map is empty
// or missing, returns shared unchanged.
export function mergeClosedRfps(shared, closedRfpIds) {
  if (!closedRfpIds || (closedRfpIds.size ?? 0) === 0) return shared
  const next = shared.rfps.map((r) => {
    const closedDate = closedRfpIds.get ? closedRfpIds.get(r.id) : null
    if (!closedDate) return r
    return closeRfp(r, closedDate)
  })
  return { ...shared, rfps: next }
}

// Phase 17.2: RFP Solicitation — a seller invites a buyer to consider one of
// the seller's existing public Claims against the buyer's open RFP. One
// solicitation per (solicitor, rfpId) pair (enforced at the call site in V2App;
// the factory itself doesn't deduplicate).
//
// The 'accepted' status validates here but isn't reachable from the UI in
// Phase 17.2 — reserved for Phase 17.2.1's Request Agreement flow which
// will route through the existing cold-path EA+DA wiring.
const RFP_SOLICITATION_STATUSES = new Set(['pending', 'rejected', 'accepted'])

export function makeRfpSolicitation({
  id,
  rfpId,
  claimId,
  solicitor,
  recipient,
  message = '',
  status = 'pending',
  createdDate,
  respondedDate = null,
  rejectionMessage = null,
  // Phase 17.2.1: when status === 'accepted', acceptedEaId references the
  // provisional Evaluation Agreement created by the Request Agreement flow.
  // Null in pending / rejected states. Lets the solicitor-side accepted
  // view link back to the EA artifact on the parent canvas.
  acceptedEaId = null,
}) {
  if (!id) throw new Error('makeRfpSolicitation: id required')
  if (!rfpId) throw new Error('makeRfpSolicitation: rfpId required')
  if (!claimId) throw new Error('makeRfpSolicitation: claimId required')
  if (!solicitor) throw new Error('makeRfpSolicitation: solicitor required')
  if (!recipient) throw new Error('makeRfpSolicitation: recipient required')
  if (!RFP_SOLICITATION_STATUSES.has(status)) {
    throw new Error(`makeRfpSolicitation: invalid status ${status}`)
  }
  return {
    id,
    type: 'rfp-solicitation',
    rfpId,
    claimId,
    solicitor,
    recipient,
    message,
    status,
    createdDate: createdDate || new Date().toISOString(),
    respondedDate,
    rejectionMessage,
    acceptedEaId,
  }
}

// Phase 17.2.1: pure transform from a pending solicitation to its accepted
// state. Pairs with the existing rejection path (handleRejectSolicitation in
// V2App) but keeps the data transform decoupled from V2App's side-effect
// fan-out (notification + state update). Throws on missing inputs so an
// upstream miss surfaces immediately instead of writing a malformed
// solicitation.
export function acceptSolicitation(solicitation, eaId) {
  if (!solicitation) throw new Error('acceptSolicitation: solicitation required')
  if (!eaId) throw new Error('acceptSolicitation: eaId required')
  return {
    ...solicitation,
    status: 'accepted',
    respondedDate: new Date().toISOString(),
    acceptedEaId: eaId,
  }
}

// Phase 17.2: overlays session-state solicitations on the shared artifact
// collection. Mirror of `mergeProvisionals` / `mergeClosedRfps` shape — pure
// function, returns a new shared object with `rfpSolicitations` extended.
// Storage shape is a Map<solicitationId, RfpSolicitation>. Empty / missing
// Map returns shared unchanged.
export function mergeSolicitations(shared, solicitations) {
  if (!solicitations || (solicitations.size ?? 0) === 0) return shared
  return {
    ...shared,
    rfpSolicitations: [
      ...(shared.rfpSolicitations || []),
      ...Array.from(solicitations.values()),
    ],
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

/**
 * Phase 16.2: seed bundle for a non-switchable mock supplier Actor that exists
 * to populate the Directory at scale. Each call yields the Actor plus a fully
 * wired set of Claims + 1 stub Asset per Claim + ownership DAs + public DAs.
 *
 * No umbrella DAs are emitted. The mock Actor is invisible to every active
 * role except via the Radiant Network public-directory channel.
 *
 * claimSpecs entry shape:
 *   { slug: string, name: string, description?: string, disclosureType: 'full' | 'selective' | 'proofonly' }
 *
 * Returns: { actor, claims, assets, ownershipDas, publicDas }
 */
export function seedMockSupplierActor({ id, party, vertical, claimSpecs, baseDate = '2026-02-01T10:00:00Z' }) {
  const actor = makeActor({ id, user: null, party, role: 'supplier', credits: 0, vertical })
  const baseMs = new Date(baseDate).getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const stampFor = (idx) => new Date(baseMs + idx * dayMs).toISOString().replace(/\.\d{3}Z$/, 'Z')

  const claims = []
  const assets = []
  const ownershipDas = []
  const publicDas = []

  claimSpecs.forEach((spec, i) => {
    const idx = i + 1
    const ts = stampFor(idx)
    const assetId = `asset-${id}-${spec.slug}-ds`
    const claimId = `claim-${id}-${spec.slug}`

    const asset = makeAsset({
      id: assetId,
      owner: actor.party,
      ownerDot: actor.partyDot,
      name: `${spec.name} Datasheet`,
      description: spec.description || `${spec.name} stub datasheet for the ${vertical} catalog.`,
      file: {
        uri: `provenance://stub/${assetId}`,
        filename: `${assetId}.pdf`,
        size: 1024,
        mimeType: 'application/pdf',
        hash: `stub-hash-${assetId}`,
      },
      registrationDate: ts,
      parseResultIds: [],
    })
    assets.push(asset)

    const claim = makeClaim({
      id: claimId,
      owner: actor.party,
      ownerDot: actor.partyDot,
      name: spec.name,
      description: spec.description || `${spec.name} — ${vertical} component published to the Radiant Network directory.`,
      referencedAssetIds: [asset.id],
      referencedRequirementsSets: [
        { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: ts },
      ],
      createdDate: ts,
    })
    claims.push(claim)

    ownershipDas.push(makeInternalDisclosureAgreement({
      id: `da-own-${asset.id}`,
      owner: actor.party,
      ownerDot: actor.partyDot,
      subject: { kind: 'asset', id: asset.id },
      terms: { createdDate: ts },
    }))
    ownershipDas.push(makeInternalDisclosureAgreement({
      id: `da-own-${claim.id}`,
      owner: actor.party,
      ownerDot: actor.partyDot,
      subject: { kind: 'claim', id: claim.id },
      terms: { createdDate: ts },
    }))
    ownershipDas.push(makeInternalDisclosureAgreement({
      id: `da-ref-${claim.id}-${asset.id}`,
      owner: actor.party,
      ownerDot: actor.partyDot,
      subject: { kind: 'claim', id: claim.id },
      scope: { assetIds: [asset.id], includeDerivatives: true },
      terms: { createdDate: ts },
    }))
    publicDas.push(makePublicDirectoryDisclosureAgreement({
      id: `da-pub-${id}-${spec.slug}`,
      grantor: actor.party,
      grantorDot: actor.partyDot,
      subject: { kind: 'claim', id: claim.id },
      type: spec.disclosureType,
      scope: { assetIds: [asset.id], includeDerivatives: true },
      terms: { createdDate: ts },
    }))
  })

  return { actor, claims, assets, ownershipDas, publicDas }
}

// Phase 16.2: deterministic disclosure-type interleaver. Targets the brief's
// ~60% full / 25% selective / 15% proofonly mix so every cluster paints a
// visible indigo + amber + green spread. Small clusters (n ≤ 4) get a fixed
// pattern so the 3-color variety survives at low Claim counts.
function pickDirectoryType(i, total) {
  if (total <= 4) {
    if (i === total - 2) return 'proofonly'
    if (i === 1) return 'selective'
    return 'full'
  }
  const m = i % 8
  if (m === 5) return 'proofonly'
  if (m === 2 || m === 6) return 'selective'
  return 'full'
}

// Phase 16.2: compact builder — accepts `[slug, name]` tuples and stamps an
// interleaved disclosureType per-row via pickDirectoryType.
function specsFromTuples(tuples) {
  return tuples.map(([slug, name], i) => ({
    slug,
    name,
    disclosureType: pickDirectoryType(i, tuples.length),
  }))
}

// ── Phase 16.2.6: vertical lexicons + procedural Claim spec generator ─────
// 35 mock supplier Actors (3,328 dots) are too many for hand-rolled names.
// Each vertical defines families × prefixes × docTypes so Claims procedurally
// produced for that vertical read as plausible defense-electronics names.

const VERTICAL_LEXICONS = {
  'Power Systems & Propulsion': {
    families: ['Power Conditioning Unit', 'Battery Management Module', 'DC-DC Converter', 'Solar Array Regulator', 'Ion Thruster Controller', 'Bipropellant Valve Driver', 'Bus Voltage Monitor', 'Load Switch Module', 'Pyro Initiator Driver'],
    prefixes: ['PCU', 'BMM', 'DCD', 'SAR', 'ITC', 'BVD', 'BVM', 'LSM', 'PID', 'PWR'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification Report', 'Test Report', 'Acceptance Data', 'Performance Spec'],
  },
  'Flight Computers & Integration': {
    families: ['Flight Computer Module', 'On-Board Computer', 'Watchdog Timer Board', 'Boot ROM Module', 'Data Handling Unit', 'System Controller', 'Backplane Interface Card', 'TM/TC Processor'],
    prefixes: ['FCM', 'OBC', 'WTB', 'BRM', 'DHU', 'SCT', 'BIC', 'TMC', 'FLT'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification Report', 'Acceptance Test Report', 'Software Manifest'],
  },
  'RF Comms & Ground Systems': {
    families: ['X-Band Transponder', 'S-Band Transmitter', 'Ka-Band Receiver', 'UHF Modem', 'Beacon Generator', 'Ground Station Modem', 'IF Downconverter', 'High-Power Amplifier'],
    prefixes: ['XBT', 'SBX', 'KBR', 'UHF', 'BCN', 'GSM', 'IFD', 'HPA', 'RFC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'Link Budget Analysis', 'EMC Report'],
  },
  'Structures, Composites & Mechanisms': {
    families: ['Carbon-Fibre Panel', 'Honeycomb Sandwich', 'Optical Bench', 'Truss Joint', 'Bipod Strut', 'Mounting Bracket', 'Hinge Assembly', 'Latch Mechanism', 'Deployable Boom'],
    prefixes: ['CFP', 'HSP', 'OBP', 'TJN', 'BPS', 'MBR', 'HGA', 'LMC', 'DPB', 'STR'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'Stress Analysis Report', 'Modal Survey'],
  },
  'Connectors & Harnesses': {
    families: ['MIL-DTL-38999 Connector', 'D-Sub Backshell', 'Twinax Coupler', 'Coaxial Bulkhead', 'Wire Harness Assembly', 'Power Distribution Cable', 'High-Voltage Connector'],
    prefixes: ['MDC', 'DSB', 'TXC', 'CXB', 'WHA', 'PDC', 'HVC', 'CON'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Test Report', 'Mating Cycle Report'],
  },
  'Comms Signal Processing': {
    families: ['Software-Defined Modem', 'Forward Error Correction Module', 'Symbol Synchronizer', 'Frequency Reference', 'IF Filter Bank', 'Direct Digital Synthesizer'],
    prefixes: ['SDM', 'FEC', 'SYM', 'FRQ', 'IFB', 'DDS', 'SIG'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'BER Test Report', 'Qualification'],
  },
  'IMUs, Gyros & GPS Receivers': {
    families: ['Fiber-Optic Gyroscope', 'MEMS IMU', 'Ring Laser Gyro', 'Tactical-Grade Accelerometer', 'GPS Receiver Module', 'GNSS Antenna LNA'],
    prefixes: ['FOG', 'MIU', 'RLG', 'TGA', 'GPR', 'GLA', 'IMU'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Allan Variance Report', 'Qualification'],
  },
  'Imaging Optics & Lasers': {
    families: ['Cassegrain Telescope', 'Off-Axis Parabolic Mirror', 'Optical Filter Wheel', 'Laser Diode Module', 'Fold Mirror Assembly', 'Wavefront Sensor'],
    prefixes: ['CTA', 'OAP', 'OFW', 'LDM', 'FMA', 'WFS', 'OPT'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'MTF Test Report', 'Qualification'],
  },
  'Thermal Management & Cryogenics': {
    families: ['Heat Pipe Assembly', 'Pulse-Tube Cryocooler', 'Loop Heat Pipe', 'Thermal Strap', 'Deployable Radiator', 'MLI Blanket', 'Cold Plate'],
    prefixes: ['HPA', 'PTC', 'LHP', 'TST', 'DRP', 'MLI', 'CPL', 'THM'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification Report', 'Thermal Vacuum Report'],
  },
  'Mixed-Signal ICs & Processors': {
    families: ['16-bit ADC', '14-bit DAC', 'Rad-Hard Microprocessor', 'Voltage Reference IC', 'Op-Amp Array', 'Comparator IC', 'Multiplexer IC'],
    prefixes: ['ADC', 'DAC', 'RHM', 'VRF', 'OPA', 'CMP', 'MUX', 'IC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'TID Report', 'SEE Report', 'Qualification'],
  },
  'Atomic Clocks & Quantum Sensors': {
    families: ['Rubidium Atomic Clock', 'Cesium Beam Standard', 'Optical Lattice Clock', 'Cold-Atom Interferometer', 'NV-Centre Magnetometer'],
    prefixes: ['RAC', 'CBS', 'OLC', 'CAI', 'NVM', 'QNT'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Allan Variance Report', 'Qualification'],
  },
  'Composite Structures': {
    families: ['CFRP Panel', 'Kevlar Sandwich', 'Aluminum Honeycomb Core', 'Glass-Epoxy Substrate', 'Carbon-Carbon Heatshield'],
    prefixes: ['CFP', 'KSW', 'AHC', 'GES', 'CCH', 'CMP'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Stress Analysis', 'Material Cert'],
  },
  'Mission & Payload Computers': {
    families: ['Payload Data Handler', 'Mission Computer', 'Solid-State Recorder', 'Compression Engine', 'Encryption Card'],
    prefixes: ['PDH', 'MCM', 'SSR', 'CMP', 'ENC', 'MIS'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'Throughput Test Report'],
  },
  'RF & Microwave Modules': {
    families: ['Low-Noise Amplifier', 'Power Amplifier Module', 'Image-Reject Mixer', 'Microwave Filter', 'Circulator', 'OMUX Manifold'],
    prefixes: ['LNA', 'PAM', 'IRM', 'MWF', 'CIR', 'OMX', 'RF'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'S-Parameter Report'],
  },
  'Star Trackers & Sun Sensors': {
    families: ['Wide-FOV Star Tracker', 'Narrow-FOV Star Tracker', 'Coarse Sun Sensor', 'Fine Sun Sensor', 'Earth Horizon Sensor', 'Centroiding Camera'],
    prefixes: ['WST', 'NST', 'CSS', 'FSS', 'EHS', 'CTC', 'SEN'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'Pointing Accuracy Report'],
  },
  'Bus Controllers & Network Modules': {
    families: ['MIL-STD-1553 Bus Controller', 'SpaceWire Router', 'TTEthernet Switch', 'CAN Bus Bridge', 'RS-422 Transceiver'],
    prefixes: ['MBC', 'SWR', 'TES', 'CBB', 'RST', 'NET'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Conformance Test Report', 'Qualification'],
  },
  'Pyrotechnics & Ordnance': {
    families: ['NASA Standard Initiator', 'Pyrobolt Assembly', 'Frangible Joint', 'Pin Puller', 'Cable Cutter'],
    prefixes: ['NSI', 'PBA', 'FRJ', 'PPL', 'CBC', 'PYR'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Qualification', 'Lot Acceptance Report'],
  },
  'Adhesives & Coatings': {
    families: ['Structural Epoxy', 'Conductive Adhesive', 'Black-Body Coating', 'OSR Tile', 'Thermal Interface Material'],
    prefixes: ['SEP', 'CDA', 'BBC', 'OSR', 'TIM', 'ADH'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Outgassing Report', 'Cure Schedule'],
  },
  'Magnetics & Inductors': {
    families: ['Common-Mode Choke', 'Toroidal Inductor', 'Power Transformer', 'Current Sense Transformer', 'EMI Filter Coil'],
    prefixes: ['CMC', 'TRI', 'PTX', 'CST', 'EFC', 'MAG'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Saturation Report', 'Qualification'],
  },
  'Cybersecurity & Encryption Modules': {
    families: ['AES-256 Hardware Engine', 'Key Management Unit', 'Secure Boot ROM', 'Anti-Tamper Module', 'TRNG Chip'],
    prefixes: ['AHE', 'KMU', 'SBR', 'ATM', 'TRN', 'SEC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'FIPS Validation', 'Qualification'],
  },
  // ── Phase 16.2.6: lexicons added for verticals 20 + 22–35 ──────────────
  'Connectors & Backshells': {
    families: ['Circular MIL Backshell', 'EMI Shielded Backshell', 'Right-Angle Backshell', 'Strain-Relief Boot', 'Hermetic Bulkhead Receptacle', 'Composite Connector Shell'],
    prefixes: ['CMB', 'ESB', 'RAB', 'SRB', 'HBR', 'CCS', 'BSL'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Salt-Fog Report', 'Qualification'],
  },
  'Flight Software & Firmware': {
    families: ['Real-Time Kernel Image', 'Flight Software Build', 'Boot Loader Image', 'Telemetry Service Module', 'Fault Detection Module', 'Mode Manager Module', 'OS Abstraction Layer'],
    prefixes: ['RTK', 'FSB', 'BLD', 'TSM', 'FDM', 'MMG', 'OSA', 'FSW'],
    docTypes: ['Software Manifest', 'Compliance', 'Spec', 'Build Report', 'Qualification', 'Coverage Report'],
  },
  'Crystal Oscillators & Clock ICs': {
    families: ['TCXO Module', 'OCXO Reference', 'VCXO Module', 'PLL Clock IC', 'Clock Distribution Buffer', 'Crystal Filter'],
    prefixes: ['TCX', 'OCX', 'VCX', 'PLL', 'CDB', 'XFL', 'OSC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Allan Variance Report', 'Qualification'],
  },
  'Test Equipment & Calibration': {
    families: ['Bench Source Meter', 'Vector Network Analyzer', 'Calibration Standard Kit', 'Spectrum Analyzer Probe', 'Test Fixture Assembly', 'Reference Load'],
    prefixes: ['BSM', 'VNA', 'CSK', 'SAP', 'TFA', 'RLD', 'TST'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Calibration Certificate', 'Acceptance Data'],
  },
  'Switches & Relays': {
    families: ['Latching Relay', 'Solid-State Relay', 'RF Coaxial Switch', 'High-Current Contactor', 'Hybrid Power Switch', 'Reed Relay'],
    prefixes: ['LTR', 'SSR', 'RCS', 'HCC', 'HPS', 'RDR', 'SWR'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Endurance Report', 'Qualification'],
  },
  'Optical Coatings & Mirrors': {
    families: ['Anti-Reflective Coating', 'Dielectric Mirror', 'Cold Mirror Filter', 'Beamsplitter Cube', 'Protected Silver Mirror', 'Bandpass Filter Coating'],
    prefixes: ['ARC', 'DMR', 'CMF', 'BSC', 'PSM', 'BFC', 'OPC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Reflectance Report', 'Qualification'],
  },
  'EMI & RF Filters': {
    families: ['EMI Line Filter', 'Common-Mode Filter', 'Power Entry Filter', 'RF Lowpass Filter', 'Cavity Bandpass Filter', 'Tunable Notch Filter'],
    prefixes: ['EMI', 'CMF', 'PEF', 'RLF', 'CBF', 'TNF', 'FLT'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Insertion Loss Report', 'Qualification'],
  },
  'Laser Diodes & Optical Sources': {
    families: ['Fiber-Coupled Laser Diode', 'High-Power Pump Diode', 'Single-Mode Laser Diode', 'VCSEL Array', 'Superluminescent Diode', 'DFB Laser Module'],
    prefixes: ['FCL', 'HPD', 'SML', 'VCS', 'SLD', 'DFB', 'LSR'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Burn-In Report', 'Qualification'],
  },
  'Reaction Wheels & Momentum Storage': {
    families: ['Reaction Wheel Assembly', 'Momentum Wheel', 'Control Moment Gyro', 'Wheel Drive Electronics', 'Bearing Cartridge'],
    prefixes: ['RWA', 'MWH', 'CMG', 'WDE', 'BCR', 'MOM'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Acceptance Data', 'Qualification'],
  },
  'GNSS Receivers & Antennas': {
    families: ['Multi-Constellation GNSS Receiver', 'L1/L2 GNSS Antenna', 'Survey-Grade GNSS Module', 'GNSS Front-End LNA', 'Choke-Ring Antenna'],
    prefixes: ['MCR', 'LGA', 'SGM', 'GFE', 'CRA', 'GNS'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Acceptance Data', 'Qualification'],
  },
  'Magnetorquers & Magnetic Actuators': {
    families: ['Air-Core Magnetorquer Rod', 'Torque Rod Assembly', 'Magnetic Bearing Coil', 'Saturable Reactor', 'Magnetic Damper'],
    prefixes: ['ACM', 'TRA', 'MBC', 'STR', 'MDM', 'MAG'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Dipole Test Report', 'Qualification'],
  },
  'Deployable Mechanisms & Hinges': {
    families: ['Spring-Loaded Hinge', 'Burn-Wire Release', 'Tape-Spring Boom Hinge', 'Pin-Puller Mechanism', 'Latch Release Assembly', 'Hold-Down & Release Mechanism'],
    prefixes: ['SLH', 'BWR', 'TSH', 'PPM', 'LRA', 'HDR', 'DPL'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Life Test Report', 'Qualification'],
  },
  'Photodetectors & Photodiodes': {
    families: ['InGaAs Photodiode', 'Silicon Avalanche Photodiode', 'PIN Photodetector', 'Quadrant Photodiode', 'UV-Enhanced Photodiode'],
    prefixes: ['INP', 'APD', 'PIN', 'QPD', 'UVP', 'PDD'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Responsivity Report', 'Qualification'],
  },
  'Encoders & Position Sensors': {
    families: ['Absolute Optical Encoder', 'Incremental Encoder', 'Resolver Module', 'Linear Position Sensor', 'Inductive Proximity Sensor'],
    prefixes: ['AOE', 'IEC', 'RVM', 'LPS', 'IPS', 'ENC'],
    docTypes: ['Datasheet', 'Compliance', 'Spec', 'Accuracy Report', 'Qualification'],
  },
  'Material Samples & Test Coupons': {
    families: ['Tensile Test Coupon', 'Outgassing Sample', 'Witness Coupon Set', 'Thermal Cycling Sample', 'Radiation Test Coupon'],
    prefixes: ['TTC', 'OGS', 'WCS', 'TCS', 'RTC', 'MAT'],
    docTypes: ['Material Cert', 'Compliance', 'Spec', 'Test Report', 'Acceptance Data'],
  },
}

// Deterministic 32-bit string hash (cyrb53-lite) — seeds the per-actor PRNG
// so the same (actor, vertical, count) tuple always yields identical Claim
// specs across module reloads.
function hashString(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

// Mulberry32 PRNG — small, fast, well-distributed seeded random in [0, 1).
function seededRandom(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Phase 16.2.6: deterministic procedural Claim spec generation for a mock
 * supplier actor, based on its vertical's lexicon. Produces a count-sized
 * array of { slug, name, description, disclosureType } entries unique
 * within the actor's namespace.
 *
 * @param {string} actorParty   The actor's party name (e.g., 'Helios Industries').
 * @param {string} vertical     The actor's vertical (key into VERTICAL_LEXICONS).
 * @param {number} count        How many Claim specs to produce.
 * @returns {Array<{slug, name, description, disclosureType}>}
 */
export function generateClaimSpecsForVertical(actorParty, vertical, count) {
  const lexicon = VERTICAL_LEXICONS[vertical]
  if (!lexicon) throw new Error(`generateClaimSpecsForVertical: unknown vertical "${vertical}"`)

  const seed = hashString(actorParty)
  const rand = seededRandom(seed)
  const specs = []
  const usedNames = new Set()

  for (let i = 0; i < count; i++) {
    let attempts = 0
    let placed = false
    while (attempts < 20) {
      const family = lexicon.families[Math.floor(rand() * lexicon.families.length)]
      const prefix = lexicon.prefixes[Math.floor(rand() * lexicon.prefixes.length)]
      const number = 100 + Math.floor(rand() * 900)
      const partNumber = `${prefix}-${number}`
      const docType = lexicon.docTypes[Math.floor(rand() * lexicon.docTypes.length)]
      const name = `${family} ${partNumber} ${docType}`
      if (!usedNames.has(name)) {
        usedNames.add(name)
        const slug = `c${i + 1}`
        const description = `${family} ${partNumber} — ${docType.toLowerCase()} for compliance evaluation.`
        // Deterministic disclosure type per index: rough 60/25/15 mix.
        const disclosureRoll = (i * 7 + seed) % 100
        const disclosureType =
          disclosureRoll < 60 ? 'full' :
          disclosureRoll < 85 ? 'selective' :
          'proofonly'
        specs.push({ slug, name, description, disclosureType })
        placed = true
        break
      }
      attempts++
    }
    if (!placed) {
      // Fallback: append a uniqueness counter — guarantees uniqueness even
      // when the lexicon's combinatorial space is locally exhausted.
      const fallbackName = `${lexicon.families[0]} ${lexicon.prefixes[0]}-${1000 + i} ${lexicon.docTypes[0]}`
      specs.push({
        slug: `c${i + 1}`,
        name: fallbackName,
        description: `${lexicon.families[0]} ${lexicon.prefixes[0]}-${1000 + i} — generated spec.`,
        disclosureType: i % 5 === 0 ? 'proofonly' : i % 4 === 0 ? 'selective' : 'full',
      })
    }
  }

  return specs
}

// Phase 16.2.6: 35 new mock supplier Actors representing the broader
// defense-electronics supply chain underneath Bob's Sentinel-4 program.
// Heavy-tailed distribution: a few super-jumbo clusters carry most of the
// dot count, a long tail of medium and small clusters provides variety.
// All claims are procedurally generated via generateClaimSpecsForVertical.
// Phase 16.2.6.1: dot counts expanded ~6.5× per actor (same 35 actors, same
// verticals, same procedural Claim generation) to fill the canvas with ~22k
// dots. Now that dense Voronoi-clipped grid fill replaces Vogel sunflower in
// DirectoryLayer.jsx, super-jumbo clusters can finally use the cell area they
// were allocated — no more sunflower overflow on Helios/Atlas/Polaris/Vortex.
const PHASE_16_2_6_NEW_MOCK_ACTORS = [
  { id: 'helios-industries',   party: 'Helios Industries',   vertical: 'Power Systems & Propulsion',           dotCount: 3250 },
  { id: 'atlas-avionics',      party: 'Atlas Avionics',      vertical: 'Flight Computers & Integration',       dotCount: 2950 },
  { id: 'polaris-defense',     party: 'Polaris Defense',     vertical: 'RF Comms & Ground Systems',            dotCount: 2600 },
  { id: 'vortex-aerospace',    party: 'Vortex Aerospace',    vertical: 'Structures, Composites & Mechanisms',  dotCount: 2300 },
  { id: 'vega-components',     party: 'Vega Components',     vertical: 'Connectors & Harnesses',               dotCount: 1200 },
  { id: 'sirius-systems',      party: 'Sirius Systems',      vertical: 'Comms Signal Processing',              dotCount: 1050 },
  { id: 'beacon-dynamics',     party: 'Beacon Dynamics',     vertical: 'IMUs, Gyros & GPS Receivers',          dotCount: 900 },
  { id: 'aurora-labs',         party: 'Aurora Labs',         vertical: 'Imaging Optics & Lasers',              dotCount: 800 },
  { id: 'solstice-aerospace',  party: 'Solstice Aerospace',  vertical: 'Thermal Management & Cryogenics',      dotCount: 700 },
  { id: 'orion-microsystems',  party: 'Orion Microsystems',  vertical: 'Mixed-Signal ICs & Processors',        dotCount: 650 },
  { id: 'quantum-dynamics',    party: 'Quantum Dynamics',    vertical: 'Atomic Clocks & Quantum Sensors',      dotCount: 400 },
  { id: 'cascade-aerospace',   party: 'Cascade Aerospace',   vertical: 'Composite Structures',                 dotCount: 350 },
  { id: 'apex-avionics',       party: 'Apex Avionics',       vertical: 'Mission & Payload Computers',          dotCount: 325 },
  { id: 'nexus-electronics',   party: 'Nexus Electronics',   vertical: 'RF & Microwave Modules',               dotCount: 325 },
  { id: 'stellar-sensors',     party: 'Stellar Sensors',     vertical: 'Star Trackers & Sun Sensors',          dotCount: 300 },
  { id: 'pinnacle-systems',    party: 'Pinnacle Systems',    vertical: 'Bus Controllers & Network Modules',    dotCount: 300 },
  { id: 'citadel-aerospace',   party: 'Citadel Aerospace',   vertical: 'Pyrotechnics & Ordnance',              dotCount: 250 },
  { id: 'catalyst-industries', party: 'Catalyst Industries', vertical: 'Adhesives & Coatings',                 dotCount: 250 },
  { id: 'meridian-tech',       party: 'Meridian Tech',       vertical: 'Magnetics & Inductors',                dotCount: 250 },
  { id: 'zenith-components',   party: 'Zenith Components',   vertical: 'Connectors & Backshells',              dotCount: 250 },
  { id: 'andromeda-defense',   party: 'Andromeda Defense',   vertical: 'Cybersecurity & Encryption Modules',   dotCount: 250 },
  { id: 'eos-defense',         party: 'Eos Defense',         vertical: 'Flight Software & Firmware',           dotCount: 225 },
  { id: 'lyra-microsystems',   party: 'Lyra Microsystems',   vertical: 'Crystal Oscillators & Clock ICs',      dotCount: 225 },
  { id: 'equinox-systems',     party: 'Equinox Systems',     vertical: 'Test Equipment & Calibration',         dotCount: 225 },
  { id: 'bowsprit-defense',    party: 'Bowsprit Defense',    vertical: 'Switches & Relays',                    dotCount: 200 },
  { id: 'albedo-optics',       party: 'Albedo Optics',       vertical: 'Optical Coatings & Mirrors',           dotCount: 150 },
  { id: 'hyperion-components', party: 'Hyperion Components', vertical: 'EMI & RF Filters',                     dotCount: 125 },
  { id: 'gauntlet-industries', party: 'Gauntlet Industries', vertical: 'Laser Diodes & Optical Sources',       dotCount: 125 },
  { id: 'drifter-aerospace',   party: 'Drifter Aerospace',   vertical: 'Reaction Wheels & Momentum Storage',   dotCount: 100 },
  { id: 'falcon-tech',         party: 'Falcon Tech',         vertical: 'GNSS Receivers & Antennas',            dotCount: 100 },
  { id: 'kestrel-aerospace',   party: 'Kestrel Aerospace',   vertical: 'Magnetorquers & Magnetic Actuators',   dotCount: 75 },
  { id: 'onyx-defense',        party: 'Onyx Defense',        vertical: 'Deployable Mechanisms & Hinges',       dotCount: 75 },
  { id: 'niveus-optics',       party: 'Niveus Optics',       vertical: 'Photodetectors & Photodiodes',         dotCount: 75 },
  { id: 'prism-aerospace',     party: 'Prism Aerospace',     vertical: 'Encoders & Position Sensors',          dotCount: 50 },
  { id: 'cordite-labs',        party: 'Cordite Labs',        vertical: 'Material Samples & Test Coupons',      dotCount: 35 },
]

// Phase 16.2.6.3: 25 additional mock supplier actors (5 medium + 20 small)
// to make the canvas read denser via "more cluster boundaries butting"
// rather than larger super-jumbos (which already overflow at the current
// Lloyd's convergence). All verticals reuse existing 16.2.6 lexicons.
const PHASE_16_2_6_3_NEW_MOCK_ACTORS = [
  { id: 'caelum-defense',      party: 'Caelum Defense',      vertical: 'IMUs, Gyros & GPS Receivers',          dotCount: 140 },
  { id: 'pyxis-systems',       party: 'Pyxis Systems',       vertical: 'Bus Controllers & Network Modules',    dotCount: 130 },
  { id: 'vector-industries',   party: 'Vector Industries',   vertical: 'Pyrotechnics & Ordnance',              dotCount: 130 },
  { id: 'tangent-components',  party: 'Tangent Components',  vertical: 'Connectors & Harnesses',               dotCount: 110 },
  { id: 'spectra-labs',        party: 'Spectra Labs',        vertical: 'Imaging Optics & Lasers',              dotCount: 120 },
  { id: 'talos-defense',       party: 'Talos Defense',       vertical: 'Composite Structures',                 dotCount: 50 },
  { id: 'argus-optics',        party: 'Argus Optics',        vertical: 'Star Trackers & Sun Sensors',          dotCount: 45 },
  { id: 'vesta-aerospace',     party: 'Vesta Aerospace',     vertical: 'Structures, Composites & Mechanisms',  dotCount: 45 },
  { id: 'boreas-tech',         party: 'Boreas Tech',         vertical: 'Thermal Management & Cryogenics',      dotCount: 40 },
  { id: 'caliber-defense',     party: 'Caliber Defense',     vertical: 'Connectors & Harnesses',               dotCount: 40 },
  { id: 'lapis-components',    party: 'Lapis Components',    vertical: 'Magnetics & Inductors',                dotCount: 35 },
  { id: 'polara-defense',      party: 'Polara Defense',      vertical: 'RF Comms & Ground Systems',            dotCount: 35 },
  { id: 'crescent-aerospace',  party: 'Crescent Aerospace',  vertical: 'Structures, Composites & Mechanisms',  dotCount: 30 },
  { id: 'halcyon-systems',     party: 'Halcyon Systems',     vertical: 'Thermal Management & Cryogenics',      dotCount: 30 },
  { id: 'verge-defense',       party: 'Verge Defense',       vertical: 'Mixed-Signal ICs & Processors',        dotCount: 30 },
  { id: 'nimbus-industries',   party: 'Nimbus Industries',   vertical: 'Mixed-Signal ICs & Processors',        dotCount: 25 },
  { id: 'cinder-labs',         party: 'Cinder Labs',         vertical: 'Adhesives & Coatings',                 dotCount: 25 },
  { id: 'edgewater-tech',      party: 'Edgewater Tech',      vertical: 'Comms Signal Processing',              dotCount: 25 },
  { id: 'drumlin-defense',     party: 'Drumlin Defense',     vertical: 'Structures, Composites & Mechanisms',  dotCount: 20 },
  { id: 'sceptre-aerospace',   party: 'Sceptre Aerospace',   vertical: 'Pyrotechnics & Ordnance',              dotCount: 20 },
  { id: 'anchor-components',   party: 'Anchor Components',   vertical: 'Connectors & Harnesses',               dotCount: 20 },
  { id: 'sable-industries',    party: 'Sable Industries',    vertical: 'Adhesives & Coatings',                 dotCount: 20 },
  { id: 'quartz-labs',         party: 'Quartz Labs',         vertical: 'Crystal Oscillators & Clock ICs',      dotCount: 20 },
  { id: 'bedrock-defense',     party: 'Bedrock Defense',     vertical: 'Composite Structures',                 dotCount: 15 },
  { id: 'polar-tech',          party: 'Polar Tech',          vertical: 'Atomic Clocks & Quantum Sensors',      dotCount: 15 },
]

// Phase 16.2.6.5: 20 RFP-only buyer-side mock actors. Each gets `role: 'buyer'`
// (distinct from supplier mock actors so view-builder filters can branch on it
// in future phases) and issues 1-12 RFPs procedurally generated via
// generateRfpsForActor (mulberry32-seeded for determinism). No Claims, no
// Assets, no DAs. RFPs join the shared `rfps` collection at module load.
const PHASE_16_2_6_5_RFP_ONLY_BUNDLES = [
  { id: 'navalsys-authority',    party: 'NavalSys Authority',    rfpCount: 12 },
  { id: 'pegasus-defense',       party: 'Pegasus Defense',       rfpCount: 10 },
  { id: 'northstar-authority',   party: 'Northstar Authority',   rfpCount:  9 },
  { id: 'arrowguard-defense',    party: 'ArrowGuard Defense',    rfpCount:  8 },
  { id: 'vanguard-systems',      party: 'Vanguard Systems',      rfpCount:  7 },
  { id: 'solarshield',           party: 'SolarShield',           rfpCount:  7 },
  { id: 'hightower-industries',  party: 'Hightower Industries',  rfpCount:  6 },
  { id: 'cobalt-defense',        party: 'Cobalt Defense',        rfpCount:  6 },
  { id: 'aegis-prime',           party: 'Aegis Prime',           rfpCount:  5 },
  { id: 'citrine-programs',      party: 'Citrine Programs',      rfpCount:  5 },
  { id: 'halberd-systems',       party: 'Halberd Systems',       rfpCount:  4 },
  { id: 'talon-defense',         party: 'Talon Defense',         rfpCount:  4 },
  { id: 'marshall-defense',      party: 'Marshall Defense',      rfpCount:  3 },
  { id: 'brookline-procurement', party: 'Brookline Procurement', rfpCount:  3 },
  { id: 'sterling-industries',   party: 'Sterling Industries',   rfpCount:  2 },
  { id: 'trident-programs',      party: 'Trident Programs',      rfpCount:  2 },
  { id: 'garnet-authority',      party: 'Garnet Authority',      rfpCount:  2 },
  { id: 'nautilus-defense',      party: 'Nautilus Defense',      rfpCount:  1 },
  { id: 'cypress-programs',      party: 'Cypress Programs',      rfpCount:  1 },
  { id: 'vesper-defense',        party: 'Vesper Defense',        rfpCount:  1 },
]
// Total RFPs across PHASE_16_2_6_5_RFP_ONLY_BUNDLES = 98

// Phase 16.2.6.5: 4 "mixed" actors that have BOTH Claims (via seedMockSupplierActor)
// AND RFPs (via generateRfpsForActor). Positioned by computeLayout into a cross-zone
// band between the Claims zone (top 2/3) and the RFPs zone (bottom 1/3). Their cells
// contain dots (Claims) on the inner ring + hollow squares (RFPs) on the outer ring
// — the dense-pack algorithm sorts by distance from center, and the items array
// concatenates Claims before RFPs so Claims fall inner.
const PHASE_16_2_6_5_MIXED_BUNDLES = [
  { id: 'lighthouse-programs', party: 'Lighthouse Programs', vertical: 'Mixed-Signal ICs & Processors',       dotCount: 50, rfpCount: 6 },
  { id: 'marigold-systems',    party: 'Marigold Systems',    vertical: 'Bus Controllers & Network Modules',   dotCount: 45, rfpCount: 4 },
  { id: 'quarry-industries',   party: 'Quarry Industries',   vertical: 'Structures, Composites & Mechanisms', dotCount: 40, rfpCount: 5 },
  { id: 'auger-defense',       party: 'Auger Defense',       vertical: 'Connectors & Harnesses',              dotCount: 35, rfpCount: 4 },
]
// Total Claims = 170, total RFPs = 19 across PHASE_16_2_6_5_MIXED_BUNDLES

/**
 * Phase 16.2.6.5: procedural RFP generator for buyer-side mock actors.
 * Deterministic per (actor.party, count) via mulberry32 seeded with
 * hashString(`${actor.party}:rfps:${count}`). Produces RFPs that pass
 * makeRfp's required-field validation (id, owner, name).
 *
 * @param {Object} actor - Actor record (must have `id`, `party`, `partyDot`).
 * @param {number} count - How many RFPs to generate.
 * @returns {Array<RFP>}
 */
// Phase 17.2.1.1: third positional arg `defaultAssetId` makes the RFP
// factory's new required field satisfiable for procedurally-generated
// RFPs without changing the RFP-name procedural-generation logic.
// Every RFP shares the same anchor Asset id — fine because (a) the
// mock actors aren't switchable in the demo (no user navigates as a
// mock-buyer-actor to invoke the Accept flow), (b) the field is only
// read at Accept-time from `mergedShared.assets`, and (c) the lookup
// is by id, so a single shared Asset id per cluster is consistent.
export function generateRfpsForActor(actor, count, defaultAssetId) {
  if (!defaultAssetId) throw new Error('generateRfpsForActor: defaultAssetId required (Phase 17.2.1.1)')
  const rand = seededRandom(hashString(`${actor.party}:rfps:${count}`))

  const TEMPLATES = [
    '{prefix}-{year}-{number} {component} for {mission}',
    '{component} Compliance RFP',
    '{component} Procurement Solicitation',
    '{program} {component} Sourcing Inquiry',
    'RFP {number}: {component} Qualification',
    '{mission} {component} RFP',
  ]
  const PREFIXES = ['RFP', 'BAA', 'PRC', 'SOL']
  const COMPONENTS = [
    'Avionics Bus Controller', 'Solid-State Gyro', 'Star Tracker',
    'Atomic Clock Subassembly', 'Cryogenic Cooler', 'Hardened Mixed-Signal IC',
    'RF Front-End Module', 'Power Distribution Unit', 'Connector Harness',
    'Composite Structure Panel', 'Reaction Wheel Assembly',
    'Inertial Measurement Unit', 'Imaging Optics', 'Bus Network Module',
    'Pyrotechnic Initiator', 'Thermal Control Subsystem', 'Sun Sensor Array',
    'Antenna Assembly', 'Signal Processing Module', 'Composite Coating Set',
  ]
  const MISSIONS = [
    'Sentinel-7', 'Lighthouse-3', 'Aegis Phase II', 'Beacon Constellation',
    'Pathfinder-12', 'Resilience-IV', 'Vanguard Alpha', 'Northstar-9',
  ]
  const PROGRAMS = [
    'Mission Office', 'Procurement Authority', 'Joint Force Command',
    'Systems Integration', 'Acquisition Office', 'Program Management',
  ]

  const pick = (arr) => arr[Math.floor(rand() * arr.length)]
  const rfps = []
  for (let i = 0; i < count; i++) {
    const template = pick(TEMPLATES)
    const year = 2026 + Math.floor(rand() * 2)
    const number = 1000 + Math.floor(rand() * 9000)
    const name = template
      .replace('{prefix}', pick(PREFIXES))
      .replace('{year}', String(year))
      .replace('{number}', String(number))
      .replace('{component}', pick(COMPONENTS))
      .replace('{mission}', pick(MISSIONS))
      .replace('{program}', pick(PROGRAMS))
    const month = String(Math.floor(rand() * 12) + 1).padStart(2, '0')
    const day = String(Math.floor(rand() * 28) + 1).padStart(2, '0')
    rfps.push(makeRfp({
      id: `rfp-${actor.id}-${i + 1}`,
      owner: actor.party,
      ownerDot: actor.partyDot,
      name,
      description: `Solicitation for ${pick(COMPONENTS).toLowerCase()} qualifying against published requirements sets.`,
      assetId: defaultAssetId,
      requirementsSetIds: [],
      status: 'open',
      createdDate: `${year}-${month}-${day}T09:00:00Z`,
    }))
  }
  return rfps
}

// Phase 17.2.0.4: module-level cache for buildV22SharedArtifacts. The
// function has no inputs and constructs a deterministic ~23k-Claim,
// ~92k-DA dataset that takes hundreds of milliseconds to rebuild. V2App
// calls it from 20+ sites; the synchronous AI-Shopper-modal mount path
// in particular hit a ~5 s lag because the call landed during render
// alongside an O(n²) find-loop over the result. Caching the result on
// the first call drops subsequent calls to O(1) reference returns and
// is safe because:
//   • The function has no parameters — there is no input to invalidate.
//   • Every existing caller treats the result as read-only (find /
//     filter / map / `{...shared}` shallow-spread in mergeProvisionals
//     and friends). None mutate the returned arrays or objects.
//   • The data is invariant per app session by design — the seeded
//     world doesn't change.
// If a future change does mutate the returned data, that change MUST
// also invalidate this cache (export a `__resetV22SharedArtifactsCache`
// or shape the mutation as a new merge layer like
// `mergeProvisionals`).
let cachedV22SharedArtifacts = null
export function buildV22SharedArtifacts() {
  if (cachedV22SharedArtifacts) return cachedV22SharedArtifacts
  const result = buildV22SharedArtifactsUncached()
  cachedV22SharedArtifacts = result
  return result
}

function buildV22SharedArtifactsUncached() {
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

  // ── Phase 16.2: 12 mock supplier Actors (Sentinel-4 supply chain) ────
  // Each Actor is non-switchable (`user: null`, `credits: 0`) and exists to
  // populate the Directory at scale. All disclosures are public-directory
  // only — no umbrella DAs to any of the four primary actors. Bundle shapes
  // come from seedMockSupplierActor() above.
  const mockSeedBundles = [
    {
      id: 'nova-novafab',
      party: 'NovaFab',
      vertical: 'Wafer Foundry / Rad-Hard IC Fab',
      claimSpecs: specsFromTuples([
        ['rhf-820',  'Rad-Hard 0.18µm CMOS Logic Array RHF-820 Datasheet'],
        ['sck-440',  'Mil-Spec ASIC SCK-440 Compliance'],
        ['rh-32',    '32-bit Microcontroller Core RH-32 Spec'],
        ['rtf-220',  'Rad-Tolerant FPGA RTF-220 Qualification'],
        ['sgs-110',  'Space-Grade SoC SGS-110 Compliance'],
        ['rhs-440',  'Rad-Hard SRAM 4Mb RHS-440 Datasheet'],
        ['nvm-820',  'Non-Volatile MRAM 16Mb NVM-820 Spec'],
        ['nvr-220',  'Mil-Spec NVRAM 32Mb NVR-220 Compliance'],
        ['sqp-540',  'Space-Qualified Processor SQP-540 Datasheet'],
        ['trx-110',  'Rad-Hard Transceiver IC TRX-110 Test Report'],
        ['msf-220',  'Mil-Spec Sensor Front-End MSF-220 Datasheet'],
        ['msc-440',  'Mixed-Signal Conditioning IC MSC-440 Compliance'],
        ['rpm-820',  'Rad-Hard Power Management IC RPM-820 Datasheet'],
        ['sgd-110',  'Space-Grade DC-DC IC SGD-110 Spec'],
        ['rti-220',  'Rad-Tolerant CAN Interface IC RTI-220 Qualification'],
        ['mlv-440',  'Mil-Spec LVDS Interface IC MLV-440 Datasheet'],
        ['rco-820',  'Rad-Hard Clock Oscillator IC RCO-820 Datasheet'],
        ['sgp-110',  'Space-Grade PLL Clock IC SGP-110 Spec'],
        ['mce-220',  'Mil-Spec Configuration EEPROM MCE-220 Datasheet'],
        ['rad-440',  'Rad-Hard ADC IC RAD-440 Compliance'],
        ['sgda-820', 'Space-Grade DAC IC SGDA-820 Datasheet'],
        ['moa-110',  'Mil-Spec OpAmp Array MOA-110 Test Report'],
        ['rtv-220',  'Rad-Tolerant Voltage Reference RTV-220 Datasheet'],
        ['sqc-440',  'Space-Qualified Comparator IC SQC-440 Compliance'],
        ['rmc-820',  'Rad-Hard Memory Controller IC RMC-820 Datasheet'],
      ]),
    },
    {
      id: 'egrid-electrogrid',
      party: 'ElectroGrid',
      vertical: 'Spacecraft Power Systems (PCDU, regulators)',
      claimSpecs: specsFromTuples([
        ['pcdu-820', 'Power Conditioning & Distribution Unit PCDU-820 Compliance'],
        ['bcr-540',  'Battery Charge Regulator BCR-540 Spec'],
        ['sade-110', 'Solar Array Drive Electronics SADE-110 Datasheet'],
        ['pcdu-440', 'Modular PCDU PCDU-440 Qualification'],
        ['bcr-220',  'Lithium-Ion Battery Charge Regulator BCR-220 Datasheet'],
        ['inv-820',  '28V DC-AC Inverter Module INV-820 Spec'],
        ['bms-110',  'Battery Management Unit BMS-110 Compliance'],
        ['dcdc-540', 'Isolated DC-DC Converter DCDC-540 Datasheet'],
        ['lsw-220',  'Latching Load Switch LSW-220 Spec'],
        ['fm-440',   'Solid-State Fuse Module FM-440 Compliance'],
        ['pbi-110',  'Redundant Power Bus Interface PBI-110 Datasheet'],
        ['sade-820', 'High-Torque Solar Array Drive SADE-820 Spec'],
        ['pcdu-540', 'Centralized PCDU PCDU-540 Test Report'],
        ['bcr-110',  'Dual-Channel Charge Regulator BCR-110 Datasheet'],
        ['inv-440',  'Three-Phase Inverter INV-440 Compliance'],
        ['bms-220',  'Hot-Swappable BMS BMS-220 Spec'],
        ['dcdc-110', 'Buck-Boost DC-DC Converter DCDC-110 Datasheet'],
        ['lsw-820',  'High-Current Load Switch LSW-820 Compliance'],
        ['fm-220',   'Resettable Fuse Module FM-220 Datasheet'],
        ['pbi-440',  '28V Power Bus Interface PBI-440 Spec'],
        ['sade-220', 'Compact Solar Array Drive SADE-220 Datasheet'],
        ['bcr-820',  'Maximum-Power-Point BCR BCR-820 Qualification'],
        ['inv-110',  'Low-Power Inverter INV-110 Datasheet'],
        ['pcdu-220', 'Distributed PCDU PCDU-220 Compliance'],
      ]),
    },
    {
      id: 'prec-precision',
      party: 'Precision Components',
      vertical: 'Precision-Machined Structural / Mechanism Parts',
      claimSpecs: specsFromTuples([
        ['tob-440', 'Titanium Optical Bench Mount TOB-440 Datasheet'],
        ['bym-220', 'Beryllium Mirror Substrate BYM-220 Spec'],
        ['ctn-110', 'Composite Truss Node CTN-110 Compliance'],
        ['abr-820', 'Aluminium Bracket ABR-820 Datasheet'],
        ['thn-440', 'Titanium Hinge Assembly THN-440 Spec'],
        ['mlt-220', 'Magnetic Latch Module MLT-220 Datasheet'],
        ['wfl-110', 'Waveguide Flange WFL-110 Compliance'],
        ['opb-540', 'Optical Bench Assembly OPB-540 Datasheet'],
        ['tn-820',  'Composite Truss Node TN-820 Qualification'],
        ['shl-440', 'Equipment Shell SHL-440 Spec'],
        ['hsg-220', 'Avionics Housing HSG-220 Test Report'],
        ['fst-110', 'High-Strength Fastener Kit FST-110 Datasheet'],
        ['mnt-820', 'Vibration-Isolation Mount MNT-820 Compliance'],
        ['brk-440', 'Lightweight Bracket BRK-440 Datasheet'],
        ['hng-220', 'Deployment Hinge HNG-220 Spec'],
        ['lch-110', 'Spring-Loaded Latch LCH-110 Datasheet'],
        ['wgr-540', 'Waveguide Run WGR-540 Compliance'],
        ['bch-820', 'Optical Bench BCH-820 Datasheet'],
      ]),
    },
    {
      id: 'sub-substrate',
      party: 'Substrate Dynamics',
      vertical: 'High-Reliability PCB Substrates',
      claimSpecs: specsFromTuples([
        ['ps-1240',  '12-Layer Polyimide PCB Substrate PS-1240 Compliance'],
        ['cms-820',  'Ceramic Multilayer Substrate CMS-820 Datasheet'],
        ['ltcc-440', 'LTCC Substrate LTCC-440 Spec'],
        ['hdi-220',  'HDI Substrate HDI-220 Datasheet'],
        ['flex-110', 'Flex PCB Substrate FLEX-110 Compliance'],
        ['rflex-540','Rigid-Flex PCB Substrate RFLEX-540 Datasheet'],
        ['mcp-820',  'Metal-Core PCB MCP-820 Spec'],
        ['aln-440',  'Aluminium Nitride Substrate ALN-440 Qualification'],
        ['ps-820',   '8-Layer Polyimide PCB PS-820 Datasheet'],
        ['cms-220',  'Ceramic Single-Layer Substrate CMS-220 Compliance'],
        ['ltcc-110', 'LTCC RF Substrate LTCC-110 Datasheet'],
        ['hdi-820',  'High-Density HDI Substrate HDI-820 Spec'],
        ['flex-440', 'Heavy-Copper Flex PCB FLEX-440 Datasheet'],
        ['rflex-220','Rigid-Flex PCB RFLEX-220 Compliance'],
        ['mcp-110',  'Thermally-Bonded MCP MCP-110 Datasheet'],
        ['aln-820',  'High-Purity Aluminium Nitride Substrate ALN-820 Test Report'],
      ]),
    },
    {
      id: 'avsys-avionicsys',
      party: 'AvionicSys',
      vertical: 'Avionics & Flight Computers',
      claimSpecs: specsFromTuples([
        ['fcm-740',      'Flight Computer Module FCM-740 Compliance'],
        ['imu-220',      'Inertial Measurement Unit IMU-220 Datasheet'],
        ['st-ifc-110',   'Star Tracker Interface Card ST-IFC-110 Spec'],
        ['pdh-440',      'Payload Data Handler PDH-440 Datasheet'],
        ['mcm-820',      'Mission Computer Module MCM-820 Compliance'],
        ['imu-540',      'Fibre-Optic IMU IMU-540 Datasheet'],
        ['mil-1553-110', 'MIL-STD-1553 Bus Controller Card MIL-1553-110 Spec'],
        ['swr-220',      'SpaceWire Router SWR-220 Datasheet'],
        ['tmtc-440',     'TM/TC Interface Card TMTC-440 Compliance'],
        ['wdt-110',      'Watchdog Timer Board WDT-110 Datasheet'],
        ['fcm-220',      'Redundant Flight Computer FCM-220 Test Report'],
        ['pdh-820',      'Payload Data Handler PDH-820 Spec'],
        ['mcm-440',      'Compact Mission Computer MCM-440 Datasheet'],
        ['imu-110',      'MEMS IMU IMU-110 Compliance'],
        ['swr-540',      'SpaceWire Switch SWR-540 Datasheet'],
        ['tmtc-220',     'Dual-Redundant TM/TC Interface TMTC-220 Spec'],
        ['wdt-820',      'Programmable Watchdog Timer WDT-820 Datasheet'],
      ]),
    },
    {
      id: 'hrf-helixrf',
      party: 'Helix RF',
      vertical: 'RF / Microwave / Antenna Modules',
      claimSpecs: specsFromTuples([
        ['xda-440',  'X-Band Downlink Antenna XDA-440 Compliance'],
        ['stx-820',  'S-Band Transponder STX-820 Spec'],
        ['kln-110',  'Ka-Band LNA KLN-110 Datasheet'],
        ['pa-220',   'X-Band Power Amplifier PA-220 Datasheet'],
        ['mx-540',   'S-Band Mixer MX-540 Compliance'],
        ['flt-440',  'Cavity Bandpass Filter FLT-440 Datasheet'],
        ['mux-820',  'Output Multiplexer MUX-820 Spec'],
        ['crc-110',  'Ferrite Circulator CRC-110 Datasheet'],
        ['wgd-220',  'WR-90 Waveguide Section WGD-220 Compliance'],
        ['hyc-440',  '90° Hybrid Coupler HYC-440 Datasheet'],
        ['omux-820', 'Output Multiplexer Assembly OMUX-820 Test Report'],
      ]),
    },
    {
      id: 'opt-optech',
      party: 'Optech Sensors',
      vertical: 'Star Trackers & Imaging Sensors',
      claimSpecs: specsFromTuples([
        ['st-440',  'Wide-FOV Star Tracker ST-440 Compliance'],
        ['cis-820', 'CMOS Imaging Sensor CIS-820 Datasheet'],
        ['ehs-110', 'Earth Horizon Sensor EHS-110 Spec'],
        ['ccd-220', 'CCD Imaging Sensor CCD-220 Datasheet'],
        ['css-540', 'Coarse Sun Sensor CSS-540 Compliance'],
        ['mag-440', '3-Axis Magnetometer MAG-440 Datasheet'],
        ['gyr-820', 'Fibre-Optic Gyroscope GYR-820 Spec'],
        ['acc-110', 'MEMS Accelerometer ACC-110 Datasheet'],
        ['fps-220', 'Fine Pointing Sensor FPS-220 Compliance'],
        ['fss-440', 'Digital Fine Sun Sensor FSS-440 Datasheet'],
      ]),
    },
    {
      id: 'sv-solarvantage',
      party: 'SolarVantage',
      vertical: 'Solar Panels & Solar Cells',
      claimSpecs: specsFromTuples([
        ['tjs-440', 'Triple-Junction GaAs Solar Cell TJS-440 Compliance'],
        ['sap-820', 'Solar Array Panel SAP-820 Datasheet'],
        ['cpv-110', 'Concentrator Photovoltaic Cell CPV-110 Spec'],
        ['qjs-220', 'Quadruple-Junction Solar Cell QJS-220 Datasheet'],
        ['cvg-540', 'Cerium-Doped Coverglass CVG-540 Compliance'],
        ['icn-440', 'Inter-Cell Interconnect ICN-440 Datasheet'],
        ['yke-820', 'Solar Array Yoke YKE-820 Spec'],
        ['hng-110', 'Solar Panel Hinge Assembly HNG-110 Datasheet'],
        ['dpm-220', 'Solar Array Deployment Mechanism DPM-220 Compliance'],
        ['sap-440', 'Flexible Solar Array Panel SAP-440 Datasheet'],
      ]),
    },
    {
      id: 'tc-thermacore',
      party: 'ThermaCore',
      vertical: 'Thermal Management (Heat Pipes, Radiators)',
      claimSpecs: specsFromTuples([
        ['vchp-440', 'Variable Conductance Heat Pipe VCHP-440 Compliance'],
        ['drp-820',  'Deployable Radiator Panel DRP-820 Datasheet'],
        ['lhp-110',  'Loop Heat Pipe LHP-110 Spec'],
        ['cph-220',  'Constant-Conductance Heat Pipe CPH-220 Datasheet'],
        ['cdp-540',  'Aluminium Coldplate CDP-540 Compliance'],
        ['mli-440',  'MLI Thermal Blanket MLI-440 Datasheet'],
        ['tlv-820',  'Bimetallic Thermal Louver TLV-820 Spec'],
        ['thr-110',  'Kapton Heater THR-110 Datasheet'],
        ['tim-220',  'Thermal Interface Material TIM-220 Compliance'],
      ]),
    },
    {
      id: 'cs-compostruct',
      party: 'CompoStruct',
      vertical: 'Composite Structures & Panels',
      claimSpecs: specsFromTuples([
        ['cfrp-440', 'Carbon-Fibre Reinforced Panel CFRP-440 Compliance'],
        ['hsp-820',  'Honeycomb Sandwich Panel HSP-820 Datasheet'],
        ['smp-110',  'Sandwich Mounting Plate SMP-110 Spec'],
        ['ahp-220',  'Aluminium-Honeycomb Panel AHP-220 Datasheet'],
        ['ksp-540',  'Kevlar-Skin Composite Panel KSP-540 Compliance'],
        ['sbm-440',  'Composite Structural Beam SBM-440 Datasheet'],
        ['ibk-820',  'Composite Interface Bracket IBK-820 Spec'],
        ['emp-110',  'Equipment-Mounting Plate EMP-110 Datasheet'],
        ['cfrp-220', 'CFRP Stringer Panel CFRP-220 Test Report'],
      ]),
    },
    {
      id: 'pho-photonix',
      party: 'Photonix',
      vertical: 'Optical Instruments & Telescopes',
      claimSpecs: specsFromTuples([
        ['cta-440', 'Cassegrain Telescope Assembly CTA-440 Compliance'],
        ['oap-820', 'Off-Axis Parabolic Mirror OAP-820 Datasheet'],
        ['wfs-110', 'Wavefront Sensor WFS-110 Spec'],
        ['fsm-220', 'Fine-Steering Mirror FSM-220 Datasheet'],
      ]),
    },
    {
      id: 'cryo-cryotek',
      party: 'Cryotek',
      vertical: 'Cryocoolers & IR Detector Cooling',
      claimSpecs: specsFromTuples([
        ['ptc-440', 'Pulse-Tube Cryocooler PTC-440 Compliance'],
        ['scc-820', 'Stirling-Cycle Cryocooler SCC-820 Datasheet'],
        ['jtc-110', 'Joule-Thomson Cooler JTC-110 Spec'],
        ['acr-220', 'Active Cryogenic Radiator ACR-220 Datasheet'],
      ]),
    },
  ]
  const mockActors = []
  const mockAssets = []
  const mockClaims = []
  const mockOwnershipDas = []
  const mockPublicDas = []
  for (const bundleSpec of mockSeedBundles) {
    const bundle = seedMockSupplierActor(bundleSpec)
    mockActors.push(bundle.actor)
    mockAssets.push(...bundle.assets)
    mockClaims.push(...bundle.claims)
    mockOwnershipDas.push(...bundle.ownershipDas)
    mockPublicDas.push(...bundle.publicDas)
  }

  // ── Phase 16.2.6: 35 new mock supplier Actors (~3,328 dots) ───────────
  // Procedural Claim names per vertical via generateClaimSpecsForVertical.
  // Same architectural rules as the Phase 16.2 seed: every Actor is
  // non-switchable, public-directory-only disclosure, no umbrella DAs.
  // Kept in a separate accumulator solely so the Phase 16.2 caveats remain
  // easy to reason about — the unified union happens at return-shape time.
  const expandedMockActors = []
  const expandedMockAssets = []
  const expandedMockClaims = []
  const expandedMockOwnershipDas = []
  const expandedMockPublicDas = []
  // Phase 16.2.6.3 concat: feed both 16.2.6 and 16.2.6.3 actor specs through
  // the same expansion loop. Two arrays kept separate in the module scope for
  // documentation clarity but unioned here at the splice site.
  for (const spec of [...PHASE_16_2_6_NEW_MOCK_ACTORS, ...PHASE_16_2_6_3_NEW_MOCK_ACTORS]) {
    const claimSpecs = generateClaimSpecsForVertical(spec.party, spec.vertical, spec.dotCount)
    const bundle = seedMockSupplierActor({
      id: spec.id,
      party: spec.party,
      vertical: spec.vertical,
      claimSpecs,
    })
    expandedMockActors.push(bundle.actor)
    expandedMockAssets.push(...bundle.assets)
    expandedMockClaims.push(...bundle.claims)
    expandedMockOwnershipDas.push(...bundle.ownershipDas)
    expandedMockPublicDas.push(...bundle.publicDas)
  }

  // ── Phase 16.2.6.5: 20 RFP-only buyer mock actors ─────────────────────
  // Pre-17.2.1.1: no Claims, no Assets, no DAs — just an Actor + 1-12 RFPs
  // each. Phase 17.2.1.1 added a single stub Asset per RFP-only actor so
  // `makeRfp`'s new required `assetId` field has a valid reference.
  // Deviation surface: the brief's seed-data integrity rule said "STOP and
  // surface if any cluster has zero Assets" — RFP-only clusters had zero;
  // the resolution is a single deterministic stub Asset per cluster.
  // Mock owners aren't switchable, so the stub doesn't surface in any
  // user-facing canvas (no Detail Panel for these Assets ever opens via
  // a demo flow).
  const rfpOnlyMockActors = []
  const rfpOnlyMockAssets = []
  const rfpOnlyMockRfps = []
  for (const bundle of PHASE_16_2_6_5_RFP_ONLY_BUNDLES) {
    const actor = makeActor({
      id: bundle.id,
      user: null,
      party: bundle.party,
      role: 'buyer',
      credits: 0,
    })
    rfpOnlyMockActors.push(actor)
    const stubAssetId = `asset-${bundle.id}-rfp-anchor`
    const stubAsset = makeAsset({
      id: stubAssetId,
      owner: actor.party,
      ownerDot: actor.partyDot,
      name: `${actor.party} Program Anchor`,
      description: 'Auto-generated RFP anchor Asset (Phase 17.2.1.1 — see seed comment).',
      file: {
        uri: `provenance://evidence/${bundle.id}-rfp-anchor`,
        filename: `${bundle.id}-rfp-anchor.pdf`,
        size: 1024,
        mimeType: 'application/pdf',
        hash: `sha256:${bundle.id}-rfp-anchor`,
      },
      registrationDate: '2026-02-01T10:00:00Z',
      parseResultIds: [],
    })
    rfpOnlyMockAssets.push(stubAsset)
    rfpOnlyMockRfps.push(...generateRfpsForActor(actor, bundle.rfpCount, stubAssetId))
  }

  // ── Phase 16.2.6.5: 4 mixed actors (Claims + RFPs) ────────────────────
  // Use seedMockSupplierActor for the Claims half + generateRfpsForActor
  // for the RFP half. Both halves attach to the same Actor record so the
  // view builder sees them as a single owner with mixed artifacts.
  // Phase 17.2.1.1: thread `supplierBundle.assets[0].id` as the RFP anchor
  // so every mixed RFP has a valid `assetId` reference.
  const mixedMockActors = []
  const mixedMockAssets = []
  const mixedMockClaims = []
  const mixedMockOwnershipDas = []
  const mixedMockPublicDas = []
  const mixedMockRfps = []
  for (const bundle of PHASE_16_2_6_5_MIXED_BUNDLES) {
    const claimSpecs = generateClaimSpecsForVertical(bundle.party, bundle.vertical, bundle.dotCount)
    const supplierBundle = seedMockSupplierActor({
      id: bundle.id,
      party: bundle.party,
      vertical: bundle.vertical,
      claimSpecs,
    })
    mixedMockActors.push(supplierBundle.actor)
    mixedMockAssets.push(...supplierBundle.assets)
    mixedMockClaims.push(...supplierBundle.claims)
    mixedMockOwnershipDas.push(...supplierBundle.ownershipDas)
    mixedMockPublicDas.push(...supplierBundle.publicDas)
    const mixedAnchor = supplierBundle.assets[0]
    if (!mixedAnchor) {
      throw new Error(`Phase 17.2.1.1 seed: mixed bundle ${bundle.id} has zero Assets — cannot anchor its RFPs`)
    }
    mixedMockRfps.push(...generateRfpsForActor(supplierBundle.actor, bundle.rfpCount, mixedAnchor.id))
  }

  // ── Alice's Assets ────────────────────────────────────────────────────
  // Phase 15.0 (#172 part 1): aPrmDatasheet + aPrmTestReport now point at
  // the calibrated PDFs generated by scripts/generate-seed-pdfs.mjs. Both
  // PDFs carry MicroCo-branded headers and host evidence values that map
  // cleanly to the seed Eval Result requirement rows for the 2-Asset/2-RS
  // demo scenario (Bob evaluating Alice's PRM Claim).
  const aPrmDatasheet = makeAsset({
    id: 'asset-prm-datasheet',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Power Regulation Module Datasheet',
    description: 'Official datasheet for PRM-3A rev. 4.',
    file: {
      uri: 'provenance://evidence/prm-datasheet-v4',
      filename: 'microco-prm-datasheet.pdf',
      size: PDF_FILES['microco-prm-datasheet.pdf'].size,
      mimeType: 'application/pdf',
      hash: PDF_FILES['microco-prm-datasheet.pdf'].hash,
      // Phase 15.0: localPath points at the generated seed PDF under
      // /seed-pdfs/. Prototype-only field; production resolves the file
      // via the QS URI lookup against `file.uri` instead.
      localPath: '/seed-pdfs/microco-prm-datasheet.pdf',
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
      filename: 'microco-prm-test-report.pdf',
      size: PDF_FILES['microco-prm-test-report.pdf'].size,
      mimeType: 'application/pdf',
      hash: PDF_FILES['microco-prm-test-report.pdf'].hash,
      localPath: '/seed-pdfs/microco-prm-test-report.pdf',
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
    description: 'Datasheet for VReg-12C rev. 1.2.',
    file: {
      uri: 'provenance://evidence/vreg-datasheet-v2',
      filename: 'microco-vreg-datasheet.pdf',
      size: PDF_FILES['microco-vreg-datasheet.pdf'].size,
      mimeType: 'application/pdf',
      hash: PDF_FILES['microco-vreg-datasheet.pdf'].hash,
      // Phase 15.0: re-pointed at the calibrated VReg datasheet generated
      // by scripts/generate-seed-pdfs.mjs.
      localPath: '/seed-pdfs/microco-vreg-datasheet.pdf',
    },
    registrationDate: '2026-02-12T16:05:00Z',
    parseResultIds: ['parse-vreg-datasheet'],
  })
  // Phase 15.3 (revised in 15.4): VReg Test Report — Alice-owned, NOT
  // initially attached to any Claim. Surfaces in Alice's amend Asset
  // picker as the named candidate for the Re-Run amend prerequisite.
  // The Test Report's anchors are pre-stamped on the chain-head
  // erBobVreg result rows (see demo-trick comment below) so that when
  // Alice attaches it during the prereq, Bob's re-run shows annotations
  // on this newly-added Asset.
  const aVregTestReport = makeAsset({
    id: 'asset-vreg-test-report',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Voltage Regulator IC Test Report',
    description: 'Bench-measured compliance test results for VReg-12C (n=8 cohort).',
    file: {
      uri: 'provenance://evidence/vreg-test-report-v1',
      filename: 'microco-vreg-test-report.pdf',
      size: PDF_FILES['microco-vreg-test-report.pdf'].size,
      mimeType: 'application/pdf',
      hash: PDF_FILES['microco-vreg-test-report.pdf'].hash,
      localPath: '/seed-pdfs/microco-vreg-test-report.pdf',
    },
    registrationDate: '2026-02-15T10:20:00Z',
    parseResultIds: [],
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
  // Phase 17.5.0.4: stub Asset anchors for the five Phase 17.4 MicroCo
  // umbrella-seed Claims (closing the Phase 16.0 / 17.4 "no referenced
  // Assets" deferral). One Asset per Claim; the existing `claimRefEdges`
  // loop generates the internal `da-ref-` DAs automatically.
  const aPcbStackQualReport = makeAsset({
    id: 'asset-microco-pcbstack-qual',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'PCB Stackup MPC-12 Qualification Report',
    description: 'Qualification report for the twelve-layer controlled-impedance MPC-12 PCB stackup.',
    file: {
      uri: 'provenance://evidence/microco-pcbstack-qual',
      filename: 'microco-pcbstack-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:microco-pcbstack-qual',
      localPath: '/microco-pcbstack-qual.pdf',
    },
    registrationDate: '2026-03-01T09:00:00Z',
    parseResultIds: [],
  })
  const aConnSpec = makeAsset({
    id: 'asset-microco-connspec',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Connector Interface CIF-44 Spec',
    description: 'Mechanical and signal-integrity spec for the CIF-44 board-to-board connector interface.',
    file: {
      uri: 'provenance://evidence/microco-connspec',
      filename: 'microco-connspec.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:microco-connspec',
      localPath: '/microco-connspec.pdf',
    },
    registrationDate: '2026-03-02T09:00:00Z',
    parseResultIds: [],
  })
  const aThermalPad = makeAsset({
    id: 'asset-microco-thermalpad',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Thermal Pad TPM-08 Datasheet',
    description: 'Datasheet for the high-conductivity TPM-08 thermal interface pad.',
    file: {
      uri: 'provenance://evidence/microco-thermalpad',
      filename: 'microco-thermalpad.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:microco-thermalpad',
      localPath: '/microco-thermalpad.pdf',
    },
    registrationDate: '2026-03-03T09:00:00Z',
    parseResultIds: [],
  })
  const aFwBootloaderSource = makeAsset({
    id: 'asset-microco-fwbootloader',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Bootloader Firmware FBL-2 Source',
    description: 'Source package for the FBL-2 secure-boot bootloader firmware.',
    file: {
      uri: 'provenance://evidence/microco-fwbootloader',
      filename: 'microco-fwbootloader.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:microco-fwbootloader',
      localPath: '/microco-fwbootloader.pdf',
    },
    registrationDate: '2026-03-04T09:00:00Z',
    parseResultIds: [],
  })
  const aRfFilterSpec = makeAsset({
    id: 'asset-microco-rffilter',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'RF Filter RFF-900 Spec',
    description: 'Insertion-loss and rejection spec for the RFF-900 cavity RF bandpass filter.',
    file: {
      uri: 'provenance://evidence/microco-rffilter',
      filename: 'microco-rffilter.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:microco-rffilter',
      localPath: '/microco-rffilter.pdf',
    },
    registrationDate: '2026-03-05T09:00:00Z',
    parseResultIds: [],
  })

  // ── Bob's Assets ─────────────────────────────────────────────────────
  // Avionics Module (the Sentinel-4 anchor) is the original Phase 1 Asset and
  // already carries inter-party DAs to MicroCo for the Power Reg + VReg Claims.
  // Phase 13.1 (#168a): IDs regenerated to `[type]-[8-char-base32]` format —
  // actor names ("bob") removed from id strings.
  const bAvionics = makeAsset({
    id: makeArtifactId('asset', 'govco-avionics'),
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
    id: makeArtifactId('asset', 'govco-guidance'),
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
    id: makeArtifactId('asset', 'govco-thermal'),
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
    id: makeArtifactId('asset', 'auditco-workspace'),
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
    id: makeArtifactId('asset', 'auditco-compliance-queue'),
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
  // Phase 17.5.0.4: stub Asset anchors for the twelve Phase 16.0 ChipCo
  // catalog-expansion Claims (closing the Phase 16.0 "future phases can give
  // them real Assets if needed" deferral). One Asset per Claim; the existing
  // `claimRefEdges` loop generates the internal `da-ref-` DAs automatically.
  const dOpAmpDatasheet = makeAsset({
    id: 'asset-chipco-opamp-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Op-Amp ICA-340 Datasheet',
    description: 'Datasheet for the ICA-340 precision op-amp.',
    file: {
      uri: 'provenance://evidence/chipco-opamp-datasheet',
      filename: 'chipco-opamp-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-opamp-datasheet',
      localPath: '/chipco-opamp-datasheet.pdf',
    },
    registrationDate: '2026-02-19T09:00:00Z',
    parseResultIds: [],
  })
  const dBuckRegQualReport = makeAsset({
    id: 'asset-chipco-buckreg-qual',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Buck Regulator BCR-110 Qualification Report',
    description: 'Qualification report for the BCR-110 buck-converter regulator.',
    file: {
      uri: 'provenance://evidence/chipco-buckreg-qual',
      filename: 'chipco-buckreg-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-buckreg-qual',
      localPath: '/chipco-buckreg-qual.pdf',
    },
    registrationDate: '2026-02-20T09:00:00Z',
    parseResultIds: [],
  })
  const dTimingIcDatasheet = makeAsset({
    id: 'asset-chipco-timingic-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Timing IC TMG-225 Datasheet',
    description: 'Datasheet for the TMG-225 real-time clock + watchdog timing IC.',
    file: {
      uri: 'provenance://evidence/chipco-timingic-datasheet',
      filename: 'chipco-timingic-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-timingic-datasheet',
      localPath: '/chipco-timingic-datasheet.pdf',
    },
    registrationDate: '2026-02-21T09:00:00Z',
    parseResultIds: [],
  })
  const dLdoRegDatasheet = makeAsset({
    id: 'asset-chipco-ldoreg-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'LDO Regulator LDO-440 Datasheet',
    description: 'Datasheet for the radiation-tolerant LDO-440 low-dropout regulator.',
    file: {
      uri: 'provenance://evidence/chipco-ldoreg-datasheet',
      filename: 'chipco-ldoreg-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-ldoreg-datasheet',
      localPath: '/chipco-ldoreg-datasheet.pdf',
    },
    registrationDate: '2026-02-22T09:00:00Z',
    parseResultIds: [],
  })
  const dMixedSigQualReport = makeAsset({
    id: 'asset-chipco-mixedsig-qual',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Mixed-Signal IC MSI-180 Qualification Report',
    description: 'Qualification report for the MSI-180 mixed-signal conditioning IC.',
    file: {
      uri: 'provenance://evidence/chipco-mixedsig-qual',
      filename: 'chipco-mixedsig-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-mixedsig-qual',
      localPath: '/chipco-mixedsig-qual.pdf',
    },
    registrationDate: '2026-02-23T09:00:00Z',
    parseResultIds: [],
  })
  const dBandgapDatasheet = makeAsset({
    id: 'asset-chipco-bandgap-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Bandgap Reference BGR-095 Datasheet',
    description: 'Datasheet for the BGR-095 precision bandgap voltage reference.',
    file: {
      uri: 'provenance://evidence/chipco-bandgap-datasheet',
      filename: 'chipco-bandgap-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-bandgap-datasheet',
      localPath: '/chipco-bandgap-datasheet.pdf',
    },
    registrationDate: '2026-02-24T09:00:00Z',
    parseResultIds: [],
  })
  const dFlashMemQualReport = makeAsset({
    id: 'asset-chipco-flashmem-qual',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Flash Memory FMM-512 Qualification Report',
    description: 'Qualification report for the radiation-hardened FMM-512 flash memory.',
    file: {
      uri: 'provenance://evidence/chipco-flashmem-qual',
      filename: 'chipco-flashmem-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-flashmem-qual',
      localPath: '/chipco-flashmem-qual.pdf',
    },
    registrationDate: '2026-02-25T09:00:00Z',
    parseResultIds: [],
  })
  const dSramCtlQualReport = makeAsset({
    id: 'asset-chipco-sramctl-qual',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'SRAM Controller SCM-1024 Qualification Report',
    description: 'Qualification report for the SCM-1024 high-density SRAM controller with EDAC.',
    file: {
      uri: 'provenance://evidence/chipco-sramctl-qual',
      filename: 'chipco-sramctl-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-sramctl-qual',
      localPath: '/chipco-sramctl-qual.pdf',
    },
    registrationDate: '2026-02-26T09:00:00Z',
    parseResultIds: [],
  })
  const dAdcDacDatasheet = makeAsset({
    id: 'asset-chipco-adcdac-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'ADC/DAC Combo ADC-820 Datasheet',
    description: 'Datasheet for the ADC-820 12-bit ADC/DAC combo with integrated reference.',
    file: {
      uri: 'provenance://evidence/chipco-adcdac-datasheet',
      filename: 'chipco-adcdac-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-adcdac-datasheet',
      localPath: '/chipco-adcdac-datasheet.pdf',
    },
    registrationDate: '2026-02-27T09:00:00Z',
    parseResultIds: [],
  })
  const dMpuQualReport = makeAsset({
    id: 'asset-chipco-mpu-qual',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Microcontroller MCU-440 Qualification Report',
    description: 'Qualification report for the MCU-440 microcontroller.',
    file: {
      uri: 'provenance://evidence/chipco-mpu-qual',
      filename: 'chipco-mpu-qual.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-mpu-qual',
      localPath: '/chipco-mpu-qual.pdf',
    },
    registrationDate: '2026-02-25T11:00:00Z',
    parseResultIds: [],
  })
  const dSerdesDatasheet = makeAsset({
    id: 'asset-chipco-serdes-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'SerDes Interface SDX-650 Datasheet',
    description: 'Datasheet for the SDX-650 high-speed SerDes interface.',
    file: {
      uri: 'provenance://evidence/chipco-serdes-datasheet',
      filename: 'chipco-serdes-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-serdes-datasheet',
      localPath: '/chipco-serdes-datasheet.pdf',
    },
    registrationDate: '2026-02-26T11:00:00Z',
    parseResultIds: [],
  })
  const dPmicDatasheet = makeAsset({
    id: 'asset-chipco-pmic-datasheet',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'PMIC-330 Datasheet',
    description: 'Datasheet for the PMIC-330 multi-rail system power management IC.',
    file: {
      uri: 'provenance://evidence/chipco-pmic-datasheet',
      filename: 'chipco-pmic-datasheet.pdf',
      size: 1572864,
      mimeType: 'application/pdf',
      hash: 'sha256:chipco-pmic-datasheet',
      localPath: '/chipco-pmic-datasheet.pdf',
    },
    registrationDate: '2026-02-27T11:00:00Z',
    parseResultIds: [],
  })

  const assets = [
    aPrmDatasheet,
    aPrmTestReport,
    aPrmThermal,
    aVregDatasheet,
    aVregTestReport,            // Phase 15.4: floating; Alice attaches in Re-Run demo prereq (Compliance Notes Asset removed)
    aEmiDatasheet,
    bAvionics,
    bGuidance,
    bThermal,
    cAuditWorkspace,
    cComplianceQueue,
    dPrmIcDatasheet,
    dPrmIcTestReport,
    dVrefDatasheet,
    // Phase 17.5.0.4: stub Asset anchors for the 12 ChipCo catalog Claims
    // (Phase 16.0) + 5 MicroCo umbrella-seed Claims (Phase 17.4).
    dOpAmpDatasheet,
    dBuckRegQualReport,
    dTimingIcDatasheet,
    dLdoRegDatasheet,
    dMixedSigQualReport,
    dBandgapDatasheet,
    dFlashMemQualReport,
    dSramCtlQualReport,
    dAdcDacDatasheet,
    dMpuQualReport,
    dSerdesDatasheet,
    dPmicDatasheet,
    aPcbStackQualReport,
    aConnSpec,
    aThermalPad,
    aFwBootloaderSource,
    aRfFilterSpec,
    // Phase 16.2: 1 stub Asset per mock-supplier Claim (157 total).
    ...mockAssets,
    // Phase 16.2.6: 3,328 additional stub Assets from the 35 new mock actors.
    ...expandedMockAssets,
    // Phase 16.2.6.5: 170 stub Assets from the 4 mixed actors.
    ...mixedMockAssets,
    // Phase 17.2.1.1: 20 stub Assets for the RFP-only buyer mock actors.
    // Each anchors all of that buyer's RFPs. Single Asset per cluster
    // (these actors aren't switchable in the demo, so a single shared
    // anchor is sufficient and doesn't muddy the parent-canvas
    // rendering — these actors don't appear on the parent canvas).
    ...rfpOnlyMockAssets,
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
    // Phase 12.1 (#120): supersession seed — Alice references MIL-PRF-55681 v1
    // (publicly published by GovCo) plus her own Incoming QC standard. v2 of
    // MIL-PRF-55681 also exists in the public pool, so the Detail Panel will
    // surface a "Newer version available" pill on the v1 row.
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v1', addedDate: '2026-03-01T10:01:00Z' },
      { requirementsSetId: 'reqset-incoming-qc-v1', addedDate: '2026-03-01T10:01:30Z' },
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
    // Phase 15.4: reverted to single-Asset initial seed. Alice's amend
    // prerequisite step attaches `aVregTestReport` for the Re-Run demo;
    // before that, the Claim only references the Datasheet.
    referencedAssetIds: [aVregDatasheet.id],
    // Phase 12.1: single public reference — exercises owner-public combo
    // on a one-Asset Claim where no prior multi-RS row was visible.
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-system-integration-v1', addedDate: '2026-03-02T09:31:00Z' },
    ],
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
    // Phase 12.1 (#120): Dave references the latest MIL-PRF-55681 (v2),
    // exercising the "Public" badge without a supersession pill (since v2
    // IS the latest). Demonstrates a Claim authored against a current
    // public standard.
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: '2026-02-26T10:01:00Z' },
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
  // Phase 16.0: ChipCo's catalog expansion. 12 additional Claims spanning
  // public-only, umbrella-only, and dual-disclosure (public + umbrella to
  // Bob) so the Directory's per-role view computation has substance to
  // demonstrate. See §8.2.5. Phase 16 doesn't materialize Assets for
  // these — Detail Panel handles empty `referencedAssetIds` gracefully;
  // future phases can give them real Assets if needed.
  const cChipcoOpAmp = makeClaim({
    id: 'claim-chipco-opamp',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Op-Amp ICA-340 Linearity Spec',
    description: 'Precision op-amp ICA-340 linearity and offset spec.',
    referencedAssetIds: [dOpAmpDatasheet.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: '2026-02-20T09:00:00Z' },
    ],
    createdDate: '2026-02-20T09:00:00Z',
    amendments: [],
  })
  const cChipcoBuckReg = makeClaim({
    id: 'claim-chipco-buckreg',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Buck Regulator BCR-110 Compliance',
    description: 'Buck-converter regulator BCR-110 qualified to MIL-PRF-55681 v2.',
    referencedAssetIds: [dBuckRegQualReport.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: '2026-02-21T09:00:00Z' },
    ],
    createdDate: '2026-02-21T09:00:00Z',
    amendments: [],
  })
  const cChipcoTimingIc = makeClaim({
    id: 'claim-chipco-timing-ic',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Timing IC TMG-225 Datasheet',
    description: 'Real-time clock + watchdog timing IC TMG-225.',
    referencedAssetIds: [dTimingIcDatasheet.id],
    createdDate: '2026-02-22T09:00:00Z',
    amendments: [],
  })
  const cChipcoLdoReg = makeClaim({
    id: 'claim-chipco-ldoreg',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'LDO Regulator LDO-440 Spec',
    description: 'Low-dropout regulator LDO-440 — radiation-tolerant variant.',
    referencedAssetIds: [dLdoRegDatasheet.id],
    createdDate: '2026-02-23T09:00:00Z',
    amendments: [],
  })
  const cChipcoMixedSig = makeClaim({
    id: 'claim-chipco-mixedsig',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Mixed-Signal IC MSI-180 Compliance',
    description: 'Mixed-signal MSI-180 conditioning IC qualified to MIL-PRF-55681 v1.',
    referencedAssetIds: [dMixedSigQualReport.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v1', addedDate: '2026-02-24T09:00:00Z' },
    ],
    createdDate: '2026-02-24T09:00:00Z',
    amendments: [],
  })
  const cChipcoBandgap = makeClaim({
    id: 'claim-chipco-bandgap',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Bandgap Reference BGR-095 Spec',
    description: 'Precision bandgap voltage reference BGR-095.',
    referencedAssetIds: [dBandgapDatasheet.id],
    createdDate: '2026-02-25T09:00:00Z',
    amendments: [],
  })
  const cChipcoFlashMem = makeClaim({
    id: 'claim-chipco-flashmem',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Flash Memory FMM-512 Qualification',
    description: 'Radiation-hardened flash memory FMM-512 qualification spec.',
    referencedAssetIds: [dFlashMemQualReport.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-system-integration-v1', addedDate: '2026-02-26T09:00:00Z' },
    ],
    createdDate: '2026-02-26T09:00:00Z',
    amendments: [],
  })
  const cChipcoSramCtl = makeClaim({
    id: 'claim-chipco-sramctl',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'SRAM Controller SCM-1024 Qualification',
    description: 'High-density SRAM controller SCM-1024 with EDAC.',
    referencedAssetIds: [dSramCtlQualReport.id],
    createdDate: '2026-02-27T09:00:00Z',
    amendments: [],
  })
  const cChipcoAdcDac = makeClaim({
    id: 'claim-chipco-adcdac',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'ADC/DAC Combo ADC-820 Spec',
    description: '12-bit ADC/DAC combo ADC-820 with integrated reference.',
    referencedAssetIds: [dAdcDacDatasheet.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-system-integration-v1', addedDate: '2026-02-28T09:00:00Z' },
    ],
    createdDate: '2026-02-28T09:00:00Z',
    amendments: [],
  })
  const cChipcoMpu = makeClaim({
    id: 'claim-chipco-mpu',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Microcontroller MCU-440 Compliance',
    description: 'Microcontroller MCU-440 qualified to MIL-PRF-55681 v2.',
    referencedAssetIds: [dMpuQualReport.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: '2026-02-26T11:00:00Z' },
    ],
    createdDate: '2026-02-26T11:00:00Z',
    amendments: [],
  })
  const cChipcoSerdes = makeClaim({
    id: 'claim-chipco-serdes',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'SerDes Interface SDX-650 Spec',
    description: 'High-speed SerDes interface SDX-650 datasheet + jitter spec.',
    referencedAssetIds: [dSerdesDatasheet.id],
    createdDate: '2026-02-27T11:00:00Z',
    amendments: [],
  })
  const cChipcoPowerMgmt = makeClaim({
    id: 'claim-chipco-pmic',
    owner: dave.party,
    ownerDot: dave.partyDot,
    name: 'Power Management IC PMIC-330 Spec',
    description: 'Multi-rail PMIC-330 system-level power management spec.',
    referencedAssetIds: [dPmicDatasheet.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-system-integration-v1', addedDate: '2026-02-28T11:00:00Z' },
    ],
    createdDate: '2026-02-28T11:00:00Z',
    amendments: [],
  })
  // ── Phase 17.4: five non-public MicroCo Claims for the umbrella-DA seed
  // expansion. MicroCo's three existing Claims (cPrm / cVreg / cEmi) are
  // all publicly disclosed, and public takes precedence over umbrella per
  // §8.2.2 — so an umbrella DA on any of them would NOT render as an amber
  // perimeter subset. The brief explicitly sanctions adding new Claims for
  // the umbrella subset rather than reshaping the existing public Claims
  // (which are load-bearing in the parent-canvas demos). These are minimal
  // (no referenced Assets) — they exist purely to populate the umbrella
  // perimeter on Bob's + Carol's views of the MicroCo cluster.
  const cMicroPcbStack = makeClaim({
    id: 'claim-microco-pcb-stack',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'PCB Stackup MPC-12 Qualification',
    description: 'Twelve-layer controlled-impedance PCB stackup MPC-12 qualification report.',
    referencedAssetIds: [aPcbStackQualReport.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-mil-prf-55681-v2', addedDate: '2026-03-02T09:00:00Z' },
    ],
    createdDate: '2026-03-02T09:00:00Z',
    amendments: [],
  })
  const cMicroConnSpec = makeClaim({
    id: 'claim-microco-conn-spec',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Connector Interface CIF-44 Spec',
    description: 'Board-to-board connector interface CIF-44 mechanical + signal-integrity spec.',
    referencedAssetIds: [aConnSpec.id],
    createdDate: '2026-03-03T09:00:00Z',
    amendments: [],
  })
  const cMicroThermalPad = makeClaim({
    id: 'claim-microco-thermal-pad',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Thermal Pad TPM-08 Datasheet',
    description: 'High-conductivity thermal interface pad TPM-08 datasheet.',
    referencedAssetIds: [aThermalPad.id],
    createdDate: '2026-03-04T09:00:00Z',
    amendments: [],
  })
  const cMicroFwBootloader = makeClaim({
    id: 'claim-microco-fw-bootloader',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Bootloader Firmware FBL-2 Compliance',
    description: 'Secure-boot bootloader firmware FBL-2 compliance attestation.',
    referencedAssetIds: [aFwBootloaderSource.id],
    referencedRequirementsSets: [
      { requirementsSetId: 'reqset-system-integration-v1', addedDate: '2026-03-05T09:00:00Z' },
    ],
    createdDate: '2026-03-05T09:00:00Z',
    amendments: [],
  })
  const cMicroRfFilter = makeClaim({
    id: 'claim-microco-rf-filter',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'RF Filter RFF-900 Spec',
    description: 'Cavity RF bandpass filter RFF-900 insertion-loss + rejection spec.',
    referencedAssetIds: [aRfFilterSpec.id],
    createdDate: '2026-03-06T09:00:00Z',
    amendments: [],
  })
  // Phase 16.2: this list holds the primary-actor claims only. The
  // mock-supplier claims (`mockClaims`, 157 entries) carry their own
  // ownership / claim-ref DAs from `seedMockSupplierActor`, so they must
  // NOT flow through the generic `aliceOwnClaims` + `claimRefEdges` loops
  // below — those would re-produce duplicate-id DAs. The final return-shape
  // `claims` field is built as `[...claims, ...mockClaims]` so consumers
  // see the full set.
  const claims = [
    cPrm, cVreg, cEmi, cChipcoPrmIc, cChipcoVref,
    // Phase 16.0 expansion: Dave's catalog grows from 2 → 14 Claims.
    cChipcoOpAmp, cChipcoBuckReg, cChipcoTimingIc, cChipcoLdoReg,
    cChipcoMixedSig, cChipcoBandgap, cChipcoFlashMem, cChipcoSramCtl,
    cChipcoAdcDac, cChipcoMpu, cChipcoSerdes, cChipcoPowerMgmt,
    // Phase 17.4: five non-public MicroCo Claims for the umbrella seed.
    cMicroPcbStack, cMicroConnSpec, cMicroThermalPad,
    cMicroFwBootloader, cMicroRfFilter,
  ]

  // ── Disclosure Agreements ─────────────────────────────────────────────
  // Ownership/internal: Actor → each of their Assets (Full, implicit).
  // Edge derivation (Phase 2): grantor's Actor node ↔ subject.
  const aliceOwnAssets = [
    aPrmDatasheet,
    aPrmTestReport,
    aPrmThermal,
    aVregDatasheet,
    aVregTestReport,    // Phase 16.2.1: ownership DA restored; demo prereq attaches Asset to VReg Claim via amendment later.
    aEmiDatasheet,
    // Phase 17.5.0.4: stub Asset anchors for the 5 MicroCo umbrella-seed Claims.
    aPcbStackQualReport,
    aConnSpec,
    aThermalPad,
    aFwBootloaderSource,
    aRfFilterSpec,
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
  // Phase 17.5.0.4: + the 12 ChipCo catalog-Claim stub Asset anchors.
  const daveOwnAssets = [
    dPrmIcDatasheet, dPrmIcTestReport, dVrefDatasheet,
    dOpAmpDatasheet, dBuckRegQualReport, dTimingIcDatasheet, dLdoRegDatasheet,
    dMixedSigQualReport, dBandgapDatasheet, dFlashMemQualReport, dSramCtlQualReport,
    dAdcDacDatasheet, dMpuQualReport, dSerdesDatasheet, dPmicDatasheet,
  ].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: dave.party,
      ownerDot: dave.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  // Phase 16.0: ownership DAs cover all 14 of Dave's Claims.
  const daveOwnClaims = [
    cChipcoPrmIc, cChipcoVref,
    cChipcoOpAmp, cChipcoBuckReg, cChipcoTimingIc, cChipcoLdoReg,
    cChipcoMixedSig, cChipcoBandgap, cChipcoFlashMem, cChipcoSramCtl,
    cChipcoAdcDac, cChipcoMpu, cChipcoSerdes, cChipcoPowerMgmt,
  ].map((c) =>
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
  // Phase 17.4.5: filter to Alice's OWN claims. The primary `claims` array
  // holds claims from multiple parties — Alice's (cPrm/cVreg/cEmi + the five
  // Phase 17.4 MicroCo claims) AND Dave/ChipCo's 14 claims. Mapping the whole
  // array with a hardcoded `owner: alice.party` minted spurious MicroCo-owned
  // internal ownership DAs over ChipCo's claims, colliding with
  // `daveOwnClaims`' identical `da-own-${c.id}` ids. The MicroCo/MicroCo
  // duplicate then leaked an "Internal" Full Disclosure row into the Directory
  // Claim Detail Panel whenever Alice viewed a ChipCo umbrella Claim (the
  // V2App party-presence filter admits it because Alice IS both parties of the
  // internal DA). Restricting to claims Alice actually owns keeps each
  // ownership DA's party aligned with the claim's owner.
  const aliceOwnClaims = claims
    .filter((c) => c.owner === alice.party)
    .map((c) =>
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
    id: makeArtifactId('da', 'microco-govco-prm'),
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
    id: makeArtifactId('da', 'microco-govco-vreg'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cVreg.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: {
      // Phase 15.4: reverted to single-Asset initial scope. Alice's
      // amend prerequisite step adds Test Report to BOTH the Claim AND
      // this DA scope (matching the original walkthrough flow).
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
    id: makeArtifactId('da', 'microco-auditco-prm'),
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
    // Phase 16.1.3 Item 8: vary disclosure types so cluster dots paint a
    // mix of indigo (full) + amber (selective) + green (proof-only).
    type: 'proofonly',
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
    id: makeArtifactId('da', 'chipco-govco-prm-ic'),
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

  // Phase 16.0: ChipCo's expanded directory presence.
  // Public DAs (Dave/ChipCo → Radiant Network) — appear as indigo dots
  // in every Actor's Directory view. Mix of full + selective so the
  // disclosure-type variety surfaces in the Detail Panel.
  const daChipcoPublicVref = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-vref',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoVref.id },
    type: 'full',
    scope: { assetIds: [dVrefDatasheet.id], includeDerivatives: true },
    terms: { createdDate: '2026-02-28T10:00:00Z' },
  })
  const daChipcoPublicOpAmp = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-opamp',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoOpAmp.id },
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-02-20T10:00:00Z' },
  })
  const daChipcoPublicBuckReg = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-buckreg',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoBuckReg.id },
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-02-21T10:00:00Z' },
  })
  const daChipcoPublicTimingIc = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-timing-ic',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoTimingIc.id },
    // Phase 16.1.3 Item 8: type variety across cluster.
    type: 'proofonly',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-02-22T10:00:00Z' },
  })
  const daChipcoPublicLdoReg = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-ldoreg',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoLdoReg.id },
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-02-23T10:00:00Z' },
  })
  const daChipcoPublicMixedSig = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-mixedsig',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoMixedSig.id },
    // Phase 16.1.3 Item 8: type variety.
    type: 'proofonly',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-02-24T10:00:00Z' },
  })
  const daChipcoPublicBandgap = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-chipco-bandgap',
    grantor: dave.party,
    grantorDot: dave.partyDot,
    subject: { kind: 'claim', id: cChipcoBandgap.id },
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-02-25T10:00:00Z' },
  })

  // Umbrella DAs (Dave/ChipCo → Bob/GovCo) — render as amber dots in
  // Bob's view (or indigo when also publicly disclosed; public takes
  // precedence per §8.2.2). Mix of full / selective / proofonly to
  // demonstrate the per-Claim disclosure-type variability noted in
  // the §8.2.4 prototype shortcut.
  const daChipcoToBobOpAmp = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-opamp'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoOpAmp.id },
    granteeAssetId: bAvionics.id,
    // Phase 16.1.3 Item 8: umbrella-DA disclosure-type variety. This dot
    // is amber on Bob's view (selective DA takes precedence over the
    // public DA — see DirectoryLayer's color-resolution rule).
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-12T14:05:00Z', expires: '2027-03-12T14:05:00Z', autoRenew: false },
  })
  const daChipcoToBobBuckReg = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-buckreg'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoBuckReg.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-12T14:10:00Z', expires: '2027-03-12T14:10:00Z', autoRenew: false },
  })
  const daChipcoToBobFlashMem = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-flashmem'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoFlashMem.id },
    granteeAssetId: bAvionics.id,
    // Phase 16.1.3 Item 8: type variety.
    type: 'proofonly',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-12T14:15:00Z', expires: '2027-03-12T14:15:00Z', autoRenew: false },
  })
  const daChipcoToBobSramCtl = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-sramctl'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoSramCtl.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-12T14:20:00Z', expires: '2027-03-12T14:20:00Z', autoRenew: false },
  })
  const daChipcoToBobAdcDac = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-adcdac'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoAdcDac.id },
    granteeAssetId: bAvionics.id,
    type: 'proofonly',
    scope: { includeDerivatives: false },
    terms: { createdDate: '2026-03-12T14:25:00Z', expires: '2027-03-12T14:25:00Z', autoRenew: false },
  })
  const daChipcoToBobMpu = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-mpu'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoMpu.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-12T14:30:00Z', expires: '2027-03-12T14:30:00Z', autoRenew: false },
  })
  const daChipcoToBobSerdes = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-serdes'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoSerdes.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-12T14:35:00Z', expires: '2027-03-12T14:35:00Z', autoRenew: false },
  })
  const daChipcoToBobPowerMgmt = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-govco-pmic'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cChipcoPowerMgmt.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-12T14:40:00Z', expires: '2027-03-12T14:40:00Z', autoRenew: false },
  })

  // ── Phase 17.4: umbrella DA seed expansion across actor pairings ──────
  // Demonstrable umbrella disclosure for all four switchable roles (was:
  // only Dave→Bob). Each is a regular DA with grantee=non-active-party +
  // subject.kind='claim' — no new artifact type (per architecture, an
  // "umbrella DA" is just a directory-visible DA whose grantee isn't the
  // Radiant Network). Disclosure-type variety drives the dot color coding
  // (full=indigo, selective=amber, proofonly=green). granteeAssetId points
  // at the grantee's anchor Asset so the warm-path EA request flow can
  // pre-fill it.

  // Alice (MicroCo) → Bob (GovCo): 5 DAs, type variety (2 full, 2 selective,
  // 1 proofonly) so Bob's view of the MicroCo cluster shows all three colors.
  const daAliceToBobPcbStack = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-govco-pcb-stack'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cMicroPcbStack.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-14T10:00:00Z', expires: '2027-03-14T10:00:00Z', autoRenew: false },
  })
  const daAliceToBobConnSpec = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-govco-conn-spec'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cMicroConnSpec.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-14T10:05:00Z', expires: '2027-03-14T10:05:00Z', autoRenew: false },
  })
  const daAliceToBobThermalPad = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-govco-thermal-pad'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cMicroThermalPad.id },
    granteeAssetId: bAvionics.id,
    type: 'proofonly',
    scope: { includeDerivatives: false },
    terms: { createdDate: '2026-03-14T10:10:00Z', expires: '2027-03-14T10:10:00Z', autoRenew: false },
  })
  const daAliceToBobFwBootloader = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-govco-fw-bootloader'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cMicroFwBootloader.id },
    granteeAssetId: bAvionics.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-14T10:15:00Z', expires: '2027-03-14T10:15:00Z', autoRenew: false },
  })
  const daAliceToBobRfFilter = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-govco-rf-filter'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    subject: { kind: 'claim', id: cMicroRfFilter.id },
    granteeAssetId: bAvionics.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-14T10:20:00Z', expires: '2027-03-14T10:20:00Z', autoRenew: false },
  })

  // Alice (MicroCo) → Carol (AuditCo): 3 DAs, all full (auditors need
  // complete data access). Reuses 3 of Alice's new non-public Claims.
  const daAliceToCarolPcbStack = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-auditco-pcb-stack'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cMicroPcbStack.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-15T10:00:00Z', expires: '2027-03-15T10:00:00Z', autoRenew: false },
  })
  const daAliceToCarolConnSpec = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-auditco-conn-spec'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cMicroConnSpec.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-15T10:05:00Z', expires: '2027-03-15T10:05:00Z', autoRenew: false },
  })
  const daAliceToCarolThermalPad = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-auditco-thermal-pad'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cMicroThermalPad.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-15T10:10:00Z', expires: '2027-03-15T10:10:00Z', autoRenew: false },
  })

  // Dave (ChipCo) → Alice (MicroCo): 3 DAs, sub-supplier component spec
  // sharing (2 selective, 1 proofonly). Reuses Dave's existing non-public
  // Claims — a Claim can carry umbrella DAs to multiple grantees.
  const daDaveToAliceFlashMem = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-microco-flashmem'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: alice.party, dot: alice.partyDot },
    subject: { kind: 'claim', id: cChipcoFlashMem.id },
    granteeAssetId: aPrmDatasheet.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-16T10:00:00Z', expires: '2027-03-16T10:00:00Z', autoRenew: false },
  })
  const daDaveToAliceSramCtl = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-microco-sramctl'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: alice.party, dot: alice.partyDot },
    subject: { kind: 'claim', id: cChipcoSramCtl.id },
    granteeAssetId: aPrmDatasheet.id,
    type: 'selective',
    scope: { assetIds: [], includeDerivatives: false },
    terms: { createdDate: '2026-03-16T10:05:00Z', expires: '2027-03-16T10:05:00Z', autoRenew: false },
  })
  const daDaveToAliceAdcDac = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-microco-adcdac'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: alice.party, dot: alice.partyDot },
    subject: { kind: 'claim', id: cChipcoAdcDac.id },
    granteeAssetId: aPrmDatasheet.id,
    type: 'proofonly',
    scope: { includeDerivatives: false },
    terms: { createdDate: '2026-03-16T10:10:00Z', expires: '2027-03-16T10:10:00Z', autoRenew: false },
  })

  // Dave (ChipCo) → Carol (AuditCo): 3 DAs, all full (auditing). Reuses
  // Dave's existing non-public Claims.
  const daDaveToCarolMpu = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-auditco-mpu'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cChipcoMpu.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-17T10:00:00Z', expires: '2027-03-17T10:00:00Z', autoRenew: false },
  })
  const daDaveToCarolSerdes = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-auditco-serdes'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cChipcoSerdes.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-17T10:05:00Z', expires: '2027-03-17T10:05:00Z', autoRenew: false },
  })
  const daDaveToCarolPowerMgmt = makeDisclosureAgreement({
    id: makeArtifactId('da', 'chipco-auditco-pmic'),
    grantor: { party: dave.party, dot: dave.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cChipcoPowerMgmt.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: { assetIds: [], includeDerivatives: true },
    terms: { createdDate: '2026-03-17T10:10:00Z', expires: '2027-03-17T10:10:00Z', autoRenew: false },
  })

  // Phase 16.0: Bob's seeded RFP. Phase 16 renders the dot only; full
  // RFP feature lives in Phase 17.
  const rfpBobSentinel4 = makeRfp({
    id: 'rfp-bob-sentinel4-rfm',
    owner: bob.party,
    ownerDot: bob.partyDot,
    name: 'Sentinel-4 RF Module Compliance',
    description: 'Seeking suppliers for RF modules meeting MIL-PRF-55681 v2 + System Integration Requirements for the Sentinel-4 satellite program.',
    // Phase 17.2.1.1: RFP anchors at bAvionics (Avionics Module) since the
    // Sentinel-4 program's RF Module is housed within the avionics
    // subsystem. Bob's three seeded Assets (Avionics, Guidance, Thermal)
    // all sit under the Sentinel-4 program; the avionics one is the
    // closest thematic anchor for an RF-Module compliance RFP.
    assetId: bAvionics.id,
    requirementsSetIds: ['reqset-mil-prf-55681-v2', 'reqset-system-integration-v1'],
    status: 'open',
    createdDate: '2026-04-15T09:00:00Z',
  })
  // Phase 16.2.6.5: shared rfps collection now spans Bob's seeded RFP + the
  // 20 RFP-only buyer mocks (98 RFPs) + the 4 mixed actors (19 RFPs) = 118.
  const rfps = [rfpBobSentinel4, ...rfpOnlyMockRfps, ...mixedMockRfps]

  // ── Evaluation Agreements (paired with explicit inter-party DAs) ──────
  const eaBobOnPrm = makeEvaluationAgreement({
    id: makeArtifactId('ea', 'govco-on-prm'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    claimId: cPrm.id,
    granteeAssetId: bAvionics.id,
    disclosureAgreementId: daAliceToBobPrm.id,
    authorizedRequirementsSetIds: ['reqset-mil-prf-55681-v1'],
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      evaluationDeadline: '2028-04-04T16:42:00Z',  // Phase 11E.1.3 Fix 2: bumped +24mo from 2026-04-04 (was already past as of 2026-05-01).
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: {
      onSatisfactory: 'Certificate of compliance issued to grantee',
      onUnsatisfactory: null,
    },
  })
  const eaBobOnVreg = makeEvaluationAgreement({
    id: makeArtifactId('ea', 'govco-on-vreg'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    claimId: cVreg.id,
    granteeAssetId: bAvionics.id,
    disclosureAgreementId: daAliceToBobVreg.id,
    authorizedRequirementsSetIds: ['reqset-mil-prf-55681-v1'],
    terms: {
      createdDate: '2026-03-04T16:42:00Z',
      evaluationDeadline: '2028-04-15T16:42:00Z',  // Phase 11E.1.3 Fix 2: bumped +24mo from 2026-04-15.
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: { onSatisfactory: null, onUnsatisfactory: null },
  })
  const eaCarolOnPrm = makeEvaluationAgreement({
    id: makeArtifactId('ea', 'auditco-on-prm'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    claimId: cPrm.id,
    granteeAssetId: cAuditWorkspace.id,
    disclosureAgreementId: daAliceToCarolPrm.id,
    authorizedRequirementsSetIds: ['reqset-auditco-prm-audit-v1'],
    terms: {
      createdDate: '2026-03-10T10:00:00Z',
      evaluationDeadline: '2028-04-20T10:00:00Z',  // Phase 11E.1.3 Fix 2: bumped +24mo from 2026-04-20.
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: {
      onSatisfactory: 'Audit certification issued to AuditCo',
      onUnsatisfactory: null,
    },
  })
  // Phase 13.1: evaluationAgreements list assembled at return time so
  // eaCarolOnEmi (declared inline alongside its Eval Result below) can be
  // included.

  // ── Evaluation Results ────────────────────────────────────────────────
  // Phase 13.1 (#168a): one Eval Result per evaluation. Bob's prior
  // 2-Eval-Result batch (Phase 12.2) is collapsed into a single bundled
  // Eval Result whose `requirementsSets[]` covers both RSes and whose flat
  // `results[]` carries every row stamped with its `requirementsSetId`.
  // Carol's evaluation stays a single-RS Eval Result.
  const erBobPrm = makeEvaluationResult({
    id: makeArtifactId('eval', 'govco-prm-prm-bundle'),
    owner: bob.party,
    ownerDot: bob.partyDot,
    evaluationAgreementId: eaBobOnPrm.id,
    claimId: cPrm.id,
    granteeAssetId: bAvionics.id,
    requirementsSets: [
      { id: 'reqset-mil-prf-55681-v1', name: 'MIL-PRF-55681 Compliance', version: 1 },
      { id: 'reqset-system-integration-v1', name: 'System Integration Requirements', version: 1 },
    ],
    // Phase 15.0 (#172 part 1): each result row carries `evidenceAnchors[]`
    // mapping to coordinates in the generated PDFs. Most MIL-PRF and System
    // Integration values come from the Datasheet (Asset 1); the two values
    // that come from measurement (Thermal dissipation, Radiation tolerance)
    // anchor in the Test Report (Asset 2) — exercises the multi-Asset
    // scenario per Phase 15.0 §4. `evidenceUsed` lists both Assets.
    results: [
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-001', label: 'Power output stability', value: '3.3V ±0.5% under load', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-001'] }] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-002', label: 'Thermal dissipation', value: '< 2W at rated current', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmTestReport.id, ...PDF_ANCHORS['microco-prm-test-report.pdf']['req-002'] }] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-003', label: 'Operating temperature range', value: '-55°C to +125°C', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-003'] }] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-004', label: 'Radiation tolerance', value: 'TID > 100 krad(Si)', status: 'unsatisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmTestReport.id, ...PDF_ANCHORS['microco-prm-test-report.pdf']['req-004'] }] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-005', label: 'ITAR classification', value: 'Category XV, §121.1', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-005'] }] },
      { requirementsSetId: 'reqset-system-integration-v1', requirementId: 'req-011', label: 'Package type', value: 'CQFP-128 (ceramic quad flat pack)', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-011'] }] },
      { requirementsSetId: 'reqset-system-integration-v1', requirementId: 'req-012', label: 'Lead count', value: '128 pins', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-012'] }] },
      { requirementsSetId: 'reqset-system-integration-v1', requirementId: 'req-013', label: 'Interface voltage', value: '3.3V LVCMOS', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-013'] }] },
      { requirementsSetId: 'reqset-system-integration-v1', requirementId: 'req-014', label: 'Compatible with Sentinel-4 bus?', value: 'Yes', status: 'satisfactory',
        evidenceAnchors: [{ sourceAssetId: aPrmDatasheet.id, ...PDF_ANCHORS['microco-prm-datasheet.pdf']['req-014'] }] },
    ],
    evidenceUsed: [aPrmDatasheet.id, aPrmTestReport.id],
    evaluationDate: '2026-03-09T14:32:00Z',
    status: 'active',
    supersededBy: null,
  })
  const erCarolPrm = makeEvaluationResult({
    id: makeArtifactId('eval', 'auditco-prm-audit'),
    owner: carol.party,
    ownerDot: carol.partyDot,
    evaluationAgreementId: eaCarolOnPrm.id,
    claimId: cPrm.id,
    granteeAssetId: cAuditWorkspace.id,
    requirementsSets: [
      { id: 'reqset-auditco-prm-audit-v1', name: 'AuditCo PRM Audit', version: 1 },
    ],
    results: [
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-001', label: 'Document provenance', value: 'All documents have verifiable provenance', status: 'satisfactory' },
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-002', label: 'Test report independence', value: 'Test report references independent lab', status: 'satisfactory' },
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-003', label: 'Thermal margin ≥ 15%', value: 'Thermal margin 12% at rated current', status: 'unsatisfactory' },
    ],
    evidenceUsed: [aPrmDatasheet.id, aPrmTestReport.id, aPrmThermal.id],
    evaluationDate: '2026-03-18T14:00:00Z',
    status: 'active',
    supersededBy: null,
  })
  // Phase 13.1 (#168a) Step 3.4: unwrapped Eval Results for demo flexibility.
  // Bob has a Full DA + EA on Alice's VReg Claim but no PoE — Create-PoE
  // surfaces as an action button on this Eval Result on first interaction.
  // Carol gets a parallel unwrapped Eval Result via a second EA on EMI.
  // Phase 15.5/15.6: VReg evaluation simplified to a single Eval Result.
  // erBobVreg is Bob's standalone evaluation of the VReg Claim against
  // MIL-PRF-55681 v1 (7 requirements). 5 SAT from the Datasheet (the
  // only Asset in scope at evaluation time); 2 MISSING (req-006 SEL
  // immunity, req-007 Burn-in qualification) which the Datasheet
  // doesn't cover.
  //
  // Demo trick (narrowed in 15.5): req-006 and req-007's
  // evidenceAnchors[] reference the Test Report Asset even though
  // Test Report wasn't in evidenceUsed at evaluation time. Each Test
  // Report anchor also carries a `discoveredValue` field (Phase 15.6
  // schema addition). When Alice amends the Claim to attach Test
  // Report (the Re-Run demo prereq), Bob's re-run auto-populates
  // these rows with the discoveredValue + status SATISFACTORY (Phase
  // 15.6 re-run carry-forward logic in V22RunEvaluationModal's
  // `applyAutoFillFromNewAssets`). Demo narrative: "the AI evaluation
  // reads the new evidence and fills in the gaps."
  //
  // In production this would require Asset-intrinsic anchor support
  // with values; for prototype demo purposes the trick is accepted at
  // narrow scope (only req-006/007 on Test Report). The 5 SAT rows
  // reference Datasheet only and don't carry discoveredValue (no
  // gap to fill).
  // Documented in CLAUDE-phase-log.md Phase 15.5 + 15.6 notes.
  //
  // Phase 15.5: chain Eval Results (erBobVregV0/V1) removed entirely;
  // they contradicted the "Bob's first evaluation" narrative the
  // Re-Run demo arc needs. Their related chain DAs (daProofBobVregV0/
  // V1, daOwnEvalBobVregV0/V1) also removed.
  const erBobVreg = makeEvaluationResult({
    id: makeArtifactId('eval', 'govco-vreg-bundle'),
    owner: bob.party,
    ownerDot: bob.partyDot,
    evaluationAgreementId: eaBobOnVreg.id,
    claimId: cVreg.id,
    granteeAssetId: bAvionics.id,
    requirementsSets: [
      { id: 'reqset-mil-prf-55681-v1', name: 'MIL-PRF-55681 Compliance', version: 1 },
    ],
    results: [
      // 5 SAT rows — Datasheet anchors only.
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-001', label: 'Power output stability', value: '5.0V ±0.5% under load', status: 'satisfactory',
        evidenceAnchors: [
          { sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf']['req-001'] },
        ] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-002', label: 'Thermal dissipation', value: '< 1.7W at rated current', status: 'satisfactory',
        evidenceAnchors: [
          { sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf']['req-002'] },
        ] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-003', label: 'Operating temperature range', value: '-55°C to +125°C', status: 'satisfactory',
        evidenceAnchors: [
          { sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf']['req-003'] },
        ] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-004', label: 'Radiation tolerance', value: 'TID ~ 80 krad(Si)', status: 'satisfactory',
        evidenceAnchors: [
          { sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf']['req-004'] },
        ] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-005', label: 'ITAR classification', value: 'Category XV, §121.1', status: 'satisfactory',
        evidenceAnchors: [
          { sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf']['req-005'] },
        ] },
      // 2 MISSING rows — Test Report anchors stamped (demo trick — see
      // comment block above this results array). When Alice's amend
      // prereq attaches the Test Report, Bob's re-run renders these
      // markers on the newly-visible PDF.
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-006', label: 'Single Event Latch-up (SEL) immunity', value: 'Pending verification', status: 'missing',
        evidenceAnchors: [
          {
            sourceAssetId: aVregTestReport.id,
            ...PDF_ANCHORS['microco-vreg-test-report.pdf']['req-006'],
            discoveredValue: '> 75 MeV·cm²/mg LET threshold',
          },
        ] },
      { requirementsSetId: 'reqset-mil-prf-55681-v1', requirementId: 'req-007', label: 'Burn-in qualification', value: 'Pending verification', status: 'missing',
        evidenceAnchors: [
          {
            sourceAssetId: aVregTestReport.id,
            ...PDF_ANCHORS['microco-vreg-test-report.pdf']['req-007'],
            discoveredValue: '168 hours at 125°C · 0/100 failures',
          },
        ] },
    ],
    // Phase 15.5: evidenceUsed is single-Asset (Datasheet only) — what
    // was actually evaluated. Test Report wasn't in scope until Alice's
    // Re-Run prerequisite amendment. The req-006/req-007 anchors above
    // reference Test Report regardless (demo trick — see comment block
    // above this results array).
    evidenceUsed: [aVregDatasheet.id],
    evaluationDate: '2026-03-12T11:45:00Z',
    status: 'active',
    supersededBy: null,
    priorEvalResultId: null,
  })
  // Carol's second EA + Eval Result (unwrapped) — Alice → Carol on EMI.
  const daAliceToCarolEmi = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-auditco-emi'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    subject: { kind: 'claim', id: cEmi.id },
    granteeAssetId: cAuditWorkspace.id,
    type: 'full',
    scope: {
      assetIds: [aEmiDatasheet.id],
      includeDerivatives: true,
    },
    terms: {
      createdDate: '2026-03-15T09:00:00Z',
      expires: '2027-03-15T09:00:00Z',
      autoRenew: false,
    },
  })
  const eaCarolOnEmi = makeEvaluationAgreement({
    id: makeArtifactId('ea', 'auditco-on-emi'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: carol.party, dot: carol.partyDot },
    claimId: cEmi.id,
    granteeAssetId: cAuditWorkspace.id,
    disclosureAgreementId: daAliceToCarolEmi.id,
    authorizedRequirementsSetIds: ['reqset-auditco-prm-audit-v1'],
    terms: {
      createdDate: '2026-03-15T09:00:00Z',
      evaluationDeadline: '2028-04-25T09:00:00Z',
      resultExpiry: null,
      flowDownRequirements: [],
    },
    incentives: { onSatisfactory: null, onUnsatisfactory: null },
  })
  const erCarolEmi = makeEvaluationResult({
    id: makeArtifactId('eval', 'auditco-emi-bundle'),
    owner: carol.party,
    ownerDot: carol.partyDot,
    evaluationAgreementId: eaCarolOnEmi.id,
    claimId: cEmi.id,
    granteeAssetId: cAuditWorkspace.id,
    requirementsSets: [
      { id: 'reqset-auditco-prm-audit-v1', name: 'AuditCo PRM Audit', version: 1 },
    ],
    results: [
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-001', label: 'Document provenance', value: 'EMI datasheet has verifiable provenance', status: 'satisfactory' },
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-002', label: 'Test report independence', value: 'No external test report referenced', status: 'missing' },
      { requirementsSetId: 'reqset-auditco-prm-audit-v1', requirementId: 'a-003', label: 'Thermal margin ≥ 15%', value: 'N/A — passive shield', status: 'na' },
    ],
    evidenceUsed: [aEmiDatasheet.id],
    evaluationDate: '2026-03-22T10:00:00Z',
    status: 'active',
    supersededBy: null,
  })
  // Phase 13.2: chain ancestors for the VReg supersession sequence.
  // Phase 15.5: chain Eval Results (erBobVregV0/V1) removed; VReg is now
  // a single standalone Eval Result.
  const evaluationResults = [erBobPrm, erCarolPrm, erBobVreg, erCarolEmi]

  // Phase 13.1 (#168a): PoEs wrap exactly one Eval Result. Bob's PRM PoE
  // wraps the bundled (multi-RS) Eval Result; Carol's PRM PoE wraps her
  // single-RS audit Eval Result. erBobVreg + erCarolEmi are unwrapped on
  // purpose so demos can exercise the Create PoE flow on first click.
  const poeBobPrm = makePoE({
    id: makeArtifactId('poe', 'govco-prm'),
    owner: bob.party,
    ownerDot: bob.partyDot,
    claimId: cPrm.id,
    claimName: cPrm.name,
    wrappedEvalResultId: erBobPrm.id,
    requirementsSetIds: erBobPrm.requirementsSets.map((rs) => rs.id),
    assetSnapshot: [...erBobPrm.evidenceUsed],
    createdDate: erBobPrm.evaluationDate,
  })
  const poeCarolPrm = makePoE({
    id: makeArtifactId('poe', 'auditco-prm'),
    owner: carol.party,
    ownerDot: carol.partyDot,
    claimId: cPrm.id,
    claimName: cPrm.name,
    wrappedEvalResultId: erCarolPrm.id,
    requirementsSetIds: erCarolPrm.requirementsSets.map((rs) => rs.id),
    assetSnapshot: [...erCarolPrm.evidenceUsed],
    createdDate: erCarolPrm.evaluationDate,
  })
  const proofsOfEvaluation = [poeBobPrm, poeCarolPrm]

  // Proof-of-Evaluation Disclosure Agreements (PoE → Claim owner).
  // Phase 13.1 (#168a): the wrapped pair carries `subject.kind === 'poe'`;
  // unwrapped Eval Results carry an `evalResult`-targeting auto-disclosure DA
  // (the discriminated-union pattern).
  const daProofBobPrm = makeProofOfEvalDisclosureAgreement({
    id: makeArtifactId('da-proof', 'govco-prm-poe'),
    evaluator: bob.party,
    evaluatorDot: bob.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    poeId: poeBobPrm.id,
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daProofCarolPrm = makeProofOfEvalDisclosureAgreement({
    id: makeArtifactId('da-proof', 'auditco-prm-poe'),
    evaluator: carol.party,
    evaluatorDot: carol.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    poeId: poeCarolPrm.id,
    terms: { createdDate: erCarolPrm.evaluationDate },
  })
  // Phase 13.1 (#168a): auto-disclosure DAs for unwrapped Eval Results.
  // subject.kind === 'evalResult'; scope.evaluationResultIds = [evalId].
  const daProofBobVreg = makeProofOfEvalDisclosureAgreement({
    id: makeArtifactId('da-proof', 'govco-vreg-eval'),
    evaluator: bob.party,
    evaluatorDot: bob.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    evaluationResultId: erBobVreg.id,
    terms: { createdDate: erBobVreg.evaluationDate },
  })
  // Phase 15.5: VReg chain-ancestor auto-disclosure DAs (Phase 13.2)
  // removed alongside the V0/V1 Eval Results. Carol's EMI Eval Result
  // is unwrapped + standalone (no chain), so the chain-DA pattern is
  // not exercised by the current seed.
  const daProofCarolEmi = makeProofOfEvalDisclosureAgreement({
    id: makeArtifactId('da-proof', 'auditco-emi-eval'),
    evaluator: carol.party,
    evaluatorDot: carol.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    evaluationResultId: erCarolEmi.id,
    terms: { createdDate: erCarolEmi.evaluationDate },
  })

  // ── Proof-only Claim DA (Phase 11D.3) ────────────────────────────────
  // Alice → Dave, subject = Alice's PRM Claim, type = 'proofonly'. Discloses
  // Bob's MIL-PRF-55681 Eval Result to Dave without exposing the underlying
  // Assets. On Dave's canvas: the Claim is pulled in, the disclosed PoE
  // (and its wrapped Eval Result) is pulled in alongside it, and a
  // proof-only-styled edge connects Eval Result → Claim. The conventional
  // Claim ↔ granteeAssetId anchor edge also renders so the Claim has a
  // visual home on Dave's canvas.
  // (Re-disclosure semantics — whether Alice can disclose Bob's Eval Result —
  // are filed as #141; default-allow today.)
  const daAliceToDavePrmProof = makeDisclosureAgreement({
    id: makeArtifactId('da', 'microco-chipco-prm-proof'),
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: dave.party, dot: dave.partyDot },
    subject: { kind: 'claim', id: cPrm.id },
    granteeAssetId: dPrmIcDatasheet.id,
    type: 'proofonly',
    scope: {
      poeIds: [poeBobPrm.id],
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
    id: makeArtifactId('da-own', erBobPrm.id),
    owner: bob.party,
    ownerDot: bob.partyDot,
    subject: { kind: 'evalResult', id: erBobPrm.id },
    scope: {
      assetIds: [bAvionics.id],
    },
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daOwnEvalCarol = makeInternalDisclosureAgreement({
    id: makeArtifactId('da-own', erCarolPrm.id),
    owner: carol.party,
    ownerDot: carol.partyDot,
    subject: { kind: 'evalResult', id: erCarolPrm.id },
    scope: {
      assetIds: [cAuditWorkspace.id],
    },
    terms: { createdDate: erCarolPrm.evaluationDate },
  })
  // Phase 13.1: ownership DAs for the new unwrapped Eval Results.
  const daOwnEvalBobVreg = makeInternalDisclosureAgreement({
    id: makeArtifactId('da-own', erBobVreg.id),
    owner: bob.party,
    ownerDot: bob.partyDot,
    subject: { kind: 'evalResult', id: erBobVreg.id },
    scope: { assetIds: [bAvionics.id] },
    terms: { createdDate: erBobVreg.evaluationDate },
  })
  // Phase 15.5: VReg chain ownership DAs (Phase 13.2) removed alongside
  // V0/V1 Eval Results.
  const daOwnEvalCarolEmi = makeInternalDisclosureAgreement({
    id: makeArtifactId('da-own', erCarolEmi.id),
    owner: carol.party,
    ownerDot: carol.partyDot,
    subject: { kind: 'evalResult', id: erCarolEmi.id },
    scope: { assetIds: [cAuditWorkspace.id] },
    terms: { createdDate: erCarolEmi.evaluationDate },
  })

  // Phase 13.1: assemble the EA list now that eaCarolOnEmi is in scope.
  const evaluationAgreements = [eaBobOnPrm, eaBobOnVreg, eaCarolOnPrm, eaCarolOnEmi]

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
    daAliceToCarolEmi,
    daChipcoToBobPrmIc,
    // Phase 16.0: ChipCo public DAs (indigo dots cross-Actor).
    daChipcoPublicVref,
    daChipcoPublicOpAmp,
    daChipcoPublicBuckReg,
    daChipcoPublicTimingIc,
    daChipcoPublicLdoReg,
    daChipcoPublicMixedSig,
    daChipcoPublicBandgap,
    // Phase 16.0: ChipCo umbrella DAs to Bob (amber-dot subset).
    daChipcoToBobOpAmp,
    daChipcoToBobBuckReg,
    daChipcoToBobFlashMem,
    daChipcoToBobSramCtl,
    daChipcoToBobAdcDac,
    daChipcoToBobMpu,
    daChipcoToBobSerdes,
    daChipcoToBobPowerMgmt,
    // Phase 17.4: umbrella DA seed expansion across actor pairings.
    daAliceToBobPcbStack,
    daAliceToBobConnSpec,
    daAliceToBobThermalPad,
    daAliceToBobFwBootloader,
    daAliceToBobRfFilter,
    daAliceToCarolPcbStack,
    daAliceToCarolConnSpec,
    daAliceToCarolThermalPad,
    daDaveToAliceFlashMem,
    daDaveToAliceSramCtl,
    daDaveToAliceAdcDac,
    daDaveToCarolMpu,
    daDaveToCarolSerdes,
    daDaveToCarolPowerMgmt,
    daAlicePublicPrm,
    daAlicePublicVreg,
    daAlicePublicEmi,
    daProofBobPrm,
    daProofCarolPrm,
    daProofBobVreg,
    daProofCarolEmi,
    daAliceToDavePrmProof,
    daOwnEvalBob,
    daOwnEvalCarol,
    daOwnEvalBobVreg,
    daOwnEvalCarolEmi,
    // Phase 16.2: 4 × 157 = 628 internal + public DAs for the mock catalog.
    ...mockOwnershipDas,
    ...mockPublicDas,
    // Phase 16.2.6: 4 × 3,328 = 13,312 additional DAs for the 35 new mock
    // actors (3 internal ownership + 1 public per Claim).
    ...expandedMockOwnershipDas,
    ...expandedMockPublicDas,
    // Phase 16.2.6.5: 4 × 170 = 680 DAs for the 4 mixed actors.
    ...mixedMockOwnershipDas,
    ...mixedMockPublicDas,
  ]

  // ── Badge Templates — Phase 14.0 (#169 part 1) ────────────────────────
  // Network-wide, public-by-default Library artifacts. Versioning parallels
  // Requirements Sets exactly. Seeded across multiple Actors so first-load
  // exercises sectioning + cross-role visibility. One v1→v2 lineage on
  // Bob's "Aerospace Grade A" template exercises the new-version UI.
  const badgeAerospaceV1 = makeBadgeTemplate({
    id: 'badgetpl-aero26mil',
    ownerDot: bob.partyDot,
    ownerParty: bob.party,
    name: 'Aerospace Grade A',
    description: 'Issued for components meeting MIL-PRF-55681 baseline qualification under nominal aerospace conditions.',
    referencedRequirementsSetIds: ['reqset-mil-prf-55681-v1'],
    lineageId: 'badgetpl-lineage-aerospace-grade-a',
    version: 1,
    supersededBy: 'badgetpl-aerov2qual',
    createdDate: '2026-02-18T09:00:00Z',
  })
  const badgeAerospaceV2 = makeBadgeTemplate({
    id: 'badgetpl-aerov2qual',
    ownerDot: bob.partyDot,
    ownerParty: bob.party,
    name: 'Aerospace Grade A',
    description: 'Updated to reference the v2 EMI/EMC-aware MIL-PRF-55681 standard. Components must meet the expanded compliance scope.',
    referencedRequirementsSetIds: ['reqset-mil-prf-55681-v2'],
    lineageId: 'badgetpl-lineage-aerospace-grade-a',
    version: 2,
    createdDate: '2026-04-15T10:30:00Z',
  })
  const badgeAuditVerified = makeBadgeTemplate({
    id: 'badgetpl-audit26ck',
    ownerDot: carol.partyDot,
    ownerParty: carol.party,
    name: 'Audit Verified',
    description: 'AuditCo-issued attestation that an evaluation has been independently audited against the AuditCo PRM Audit checklist.',
    referencedRequirementsSetIds: ['reqset-auditco-prm-audit-v1'],
    lineageId: 'badgetpl-lineage-audit-verified',
    version: 1,
    createdDate: '2026-03-10T11:15:00Z',
  })
  const badgeComponentQA = makeBadgeTemplate({
    id: 'badgetpl-qaucm26j',
    ownerDot: alice.partyDot,
    ownerParty: alice.party,
    name: 'Component Quality Assured',
    description: 'MicroCo internal mark for components that have cleared incoming QC and System Integration sanity checks.',
    referencedRequirementsSetIds: ['reqset-incoming-qc-v1', 'reqset-system-integration-v1'],
    lineageId: 'badgetpl-lineage-component-qa',
    version: 1,
    createdDate: '2026-03-22T14:45:00Z',
  })
  const badgeTemplates = [
    badgeAerospaceV1,
    badgeAerospaceV2,
    badgeAuditVerified,
    badgeComponentQA,
  ]

  // ── Badge Issuances — Phase 14.1 (#169 part 2), corrected Phase 14.2.
  // Phase 14.2 (#169a): badges target Claims (not PoEs). Seed five issuances
  // against Alice's PRM Claim from non-Alice issuers — exercises +N overflow
  // (5 badges → 3 chips + "+2") on Alice's Claim card and on every PoE that
  // wraps an Eval Result of that Claim (PoE-side display derives via
  // aggregation walk). Issuance gate: `issuerParty !== claim.ownerParty`.
  // None of the seeded issuances violate the gate (all issuers are Bob or
  // Carol, neither owns the PRM Claim).
  const issAerospaceA = makeBadgeIssuance({
    id: 'badge-aerocarol',
    issuerDot: bob.partyDot,
    issuerParty: bob.party,
    targetClaimId: cPrm.id,                // Bob → Alice's PRM Claim
    badgeTemplateId: badgeAerospaceV1.id,
    description: 'GovCo endorses MicroCo’s Power Regulation Module Assembly Claim against the aerospace baseline.',
    createdDate: '2026-03-12T09:30:00Z',
  })
  const issAuditVerifiedBob = makeBadgeIssuance({
    id: 'badge-auditbob1',
    issuerDot: carol.partyDot,
    issuerParty: carol.party,
    targetClaimId: cPrm.id,                // Carol → Alice's PRM Claim
    badgeTemplateId: badgeAuditVerified.id,
    description: 'Independent audit confirms the methodology and findings on MicroCo’s Claim.',
    createdDate: '2026-03-15T14:00:00Z',
  })
  // Phase 14.2: Alice cannot issue against her own Claim — these were
  // formerly Alice's issuances; reissued from Bob (the second AuditVerified
  // template was Carol's, so Bob picks up the Component QA endorsement).
  const issComponentQABob = makeBadgeIssuance({
    id: 'badge-qabob26m',
    issuerDot: bob.partyDot,
    issuerParty: bob.party,
    targetClaimId: cPrm.id,                // Bob → Alice's PRM Claim
    badgeTemplateId: badgeComponentQA.id,
    description: 'GovCo recognizes that MicroCo’s incoming-QC baseline is met on this Claim.',
    createdDate: '2026-03-20T11:45:00Z',
  })
  const issComponentQACarol = makeBadgeIssuance({
    id: 'badge-qacarol2',
    issuerDot: carol.partyDot,
    issuerParty: carol.party,
    targetClaimId: cPrm.id,                // Carol → Alice's PRM Claim
    badgeTemplateId: badgeComponentQA.id,
    description: 'AuditCo concurs that the components on this Claim meet MicroCo’s QC baseline.',
    createdDate: '2026-03-22T10:00:00Z',
  })
  // 5th issuance maintains the +N overflow demo on the PRM Claim card.
  const issAuditVerifiedCarolByBob = makeBadgeIssuance({
    id: 'badge-auditcab2',
    issuerDot: bob.partyDot,
    issuerParty: bob.party,
    targetClaimId: cPrm.id,                // Bob → Alice's PRM Claim
    badgeTemplateId: badgeAuditVerified.id,
    description: 'GovCo recognizes the AuditCo audit methodology applied to this Claim.',
    createdDate: '2026-03-25T15:30:00Z',
  })
  const badgeIssuances = [
    issAerospaceA,
    issAuditVerifiedBob,
    issComponentQABob,
    issComponentQACarol,
    issAuditVerifiedCarolByBob,
  ]

  return {
    actors: [bob, alice, carol, dave, ...mockActors, ...expandedMockActors, ...rfpOnlyMockActors, ...mixedMockActors, RADIANT_NETWORK_ACTOR],
    assets,
    parseResults,
    // Phase 16.2: union of primary-actor claims + mock-supplier claims. The
    // primary `claims` constant intentionally does NOT include `mockClaims`
    // so the generic ownership / claim-ref loops above don't double-emit
    // DAs for them — see the comment on `const claims = [...]` above.
    // Phase 16.2.6: extended with expandedMockClaims (3,328 new Claims).
    // Phase 16.2.6.5: + 170 mixed-actor Claims.
    claims: [...claims, ...mockClaims, ...expandedMockClaims, ...mixedMockClaims],
    disclosureAgreements,
    evaluationAgreements,
    evaluationResults,
    // Phase 13 (#168): seed PoEs retroactively wrap every existing Eval Result.
    proofsOfEvaluation,
    // Phase 14.0 (#169 part 1): network-wide Badge Templates.
    badgeTemplates,
    // Phase 14.1 (#169 part 2): Badge Issuances. Network-wide, single-source-
    // of-truth recipient (derived from target PoE owner at render time).
    badgeIssuances,
    // Phase 16.0: RFPs. Skeletal placeholder; Phase 17 owns lifecycle.
    rfps,
    // Phase 17.2: seed solicitation set is empty — demo participants create
    // them in real time via the SolicitationCreateModal. V2App's session-
    // state Map overlays via `mergeSolicitations` at every view-builder call.
    rfpSolicitations: [],
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
  // Phase 17.5.0.4: a DA is "fully anchored" when its relationship has crossed
  // the threshold from directory-visibility into active disclosure. Umbrella
  // DAs (Phase 16.0 / 17.4 catalog visibility) fail this predicate — they grant
  // Directory-layer visibility only and must not pull artifacts onto the
  // parent canvas.
  //
  // Anchoring criteria (any one is sufficient):
  //   1. Paired with an EA via disclosureAgreementId.
  //   2. Subject is a PoE or Eval Result (proof disclosures anchored to a
  //      specific artifact, never umbrella-only by construction).
  //   3. Phase 11D.3 carveout: proof-only Claim DA with populated
  //      scope.poeIds — the "share PoE forward" pattern (e.g.,
  //      daAliceToDavePrmProof).
  const isFullyAnchoredDa = (da) =>
    pairedDaIds.has(da.id)
    || da.subject?.kind === 'poe'
    || da.subject?.kind === 'evalResult'
    || (da.subject?.kind === 'claim'
        && da.type === 'proofonly'
        && (da.scope?.poeIds?.length || 0) > 0)
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
    if (!isFullyAnchoredDa(da)) continue
    if (da.subject?.kind !== 'claim') continue
    if (da.type !== 'proofonly') continue
    if (da.grantee.party !== party) continue
    if (da.grantor.party === party) continue
    pulledInClaimIds.add(da.subject.id)
  }
  const pulledInClaims = shared.claims.filter(
    (c) => c.owner !== party && pulledInClaimIds.has(c.id),
  )

  // Eval Results visible: those the actor owns, plus those wrapped by a PoE
  // disclosed via a proof-of-evaluation DA where the actor is the grantee
  // (claim owner seeing evaluator's PoE), plus those wrapped by PoEs
  // disclosed via a proof-only Claim DA where the actor is grantee
  // (Phase 11D.3 — Alice → Dave proof-only-of-PoE; Phase 13 (#168)
  // migration: scope.evaluationResultIds → scope.poeIds, share-PoE-shares-
  // all auto-discloses every wrapped Eval Result).
  const sharedPoEs = shared.proofsOfEvaluation || []
  const poeById = new Map(sharedPoEs.map((p) => [p.id, p]))
  const proofDaEvalResultIds = new Set()
  // Phase 13 (#168): PoE ids visible via PoE-targeting DAs. The actor sees
  // PoEs they own (evaluator side) plus PoEs disclosed to them via proof-of-
  // eval DAs (claim-owner side) or proof-only Claim DAs (Phase 11D.3 →
  // Phase 13 migration). The canvas adapter places PoE nodes; their wrapped
  // Eval Results auto-pull-in via this same loop.
  const visiblePoeIds = new Set()
  for (const poe of sharedPoEs) {
    if (poe.owner === party) visiblePoeIds.add(poe.id)
  }
  // Phase 11D.3: track proof-only-pulled Eval Result ids separately so the
  // canvas adapter can place them in their own column near the pulled Claim
  // (instead of mixing them in with the actor's own evaluation column, which
  // is where proof-of-evaluation results live). Phase 13 extends this to
  // proof-only-pulled PoEs (the wrappers).
  const proofOnlyPulledEvalIds = new Set()
  const proofOnlyPulledPoeIds = new Set()
  const addPoeAndWrapped = (poeId, fromProofOnlyClaimDa) => {
    const poe = poeById.get(poeId)
    if (!poe) return
    visiblePoeIds.add(poe.id)
    if (fromProofOnlyClaimDa) proofOnlyPulledPoeIds.add(poe.id)
    if (poe.wrappedEvalResultId) {
      proofDaEvalResultIds.add(poe.wrappedEvalResultId)
      if (fromProofOnlyClaimDa) proofOnlyPulledEvalIds.add(poe.wrappedEvalResultId)
    }
  }
  for (const da of disclosureAgreements) {
    // Phase 9D.1.5: revoked POE DAs (cascade-annotated by 9D.1.4 when their
    // backing EA is revoked) no longer confer ER visibility to the Claim
    // owner. Without this filter, the grantor's `visibleEvaluationResults`
    // kept the grantee's ER even though the access agreement was revoked,
    // so the orphaned ER lingered on the grantor's canvas.
    if (da._revokedMeta) continue
    if (da.subject.kind === 'poe') {
      // Phase 13: proof-of-evaluation DA. subject = PoE; grantee is the
      // claim owner receiving the wrapped Eval Result.
      if (da.grantee.party === party && da.grantor.party !== party) {
        addPoeAndWrapped(da.subject.id, false)
      }
      continue
    }
    // Phase 13.1 (#168a): auto-disclosure DA at Eval Result save time —
    // subject.kind === 'evalResult'; the Claim owner sees the evaluator's
    // Eval Result via this DA (no PoE involved yet).
    if (da.subject.kind === 'evalResult') {
      const internalDa = da.grantor.party === da.grantee.party
      if (!internalDa && da.grantee.party === party && da.grantor.party !== party) {
        proofDaEvalResultIds.add(da.subject.id)
      }
      continue
    }
    // Phase 11D.3 / Phase 13 migration: proof-only Claim DA → pull each
    // disclosed PoE (and its wrapped Eval Result) onto the grantee's
    // canvas alongside the source Claim.
    if (da.subject.kind === 'claim' && da.type === 'proofonly') {
      if (da.grantee.party === party && da.grantor.party !== party) {
        for (const poeId of (da.scope?.poeIds || [])) {
          addPoeAndWrapped(poeId, true)
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
  // Phase 17.5.0.4 narrowing: this rule fires only for fully-anchored DAs
  // (EA-paired, PoE/Eval Result subject, or Phase 11D.3 proof-only Claim DA
  // with poeIds). Umbrella DAs (Phase 16.0 / 17.4 catalog visibility) carry a
  // `granteeAssetId` for the warm-path EA-request pre-fill but do not trigger
  // anchor pull-in until the relationship crosses into active disclosure.
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
    if (!isFullyAnchoredDa(da)) continue
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
    // Phase 11D.3 / Phase 13: Eval Result ids pulled in via proof-only
    // Claim DAs. Phase 13 adds parallel `proofOnlyPulledPoeIds` for the
    // wrapper PoEs themselves.
    proofOnlyPulledEvalIds,
    proofOnlyPulledPoeIds,
    // Phase 13 (#168): visible PoEs for this actor — owned + disclosed via
    // PoE-targeting DAs. Each PoE in this set has its wrapped Eval Results
    // already added to `visibleEvaluationResults` by the loop above.
    proofsOfEvaluation: sharedPoEs.filter((p) => visiblePoeIds.has(p.id)),
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
  // Phase 13 (#168): Create-PoE flow appends to v22Provisionals.proofsOfEvaluation.
  if (provisionals.proofsOfEvaluation?.length) {
    merged.proofsOfEvaluation = mergeById(merged.proofsOfEvaluation || [], provisionals.proofsOfEvaluation)
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
 * Phase 16.0 — Per-role Directory Layer view.
 *
 * Returns the structured per-role data DirectoryLayer needs to render:
 * the active Actor's own publicly-disclosed Claims (around the corner
 * card), other Actors' clusters with mixed indigo (public) + amber
 * (umbrella-to-active) Claim sets, umbrella edges from the active Actor
 * to umbrella grantors, and the all-Actor RFP set.
 *
 * Visibility math (per spec §8.2.5):
 *   • A Claim is publicly-disclosed if any active DA grants it to the
 *     `Radiant Network` party with `subject.kind === 'claim'`.
 *   • A Claim is umbrella-disclosed-to-active if any active DA grants
 *     it to the active Actor's party from a non-active Actor with
 *     `subject.kind === 'claim'`.
 *   • The active Actor's own Claims appear in `ownClaims` only when at
 *     least one public DA exists (per §8.2.5 — only public outputs
 *     cluster around the corner card; private internal claims don't
 *     surface on the Directory).
 *   • `otherClusters` is one entry per non-active Actor with at least
 *     one Claim visible to the active Actor (public OR umbrella).
 *   • `umbrellaEdges` is the set of non-active Actors who grant an
 *     umbrella DA to the active Actor (one edge per source Actor).
 *
 * Shape:
 *   {
 *     activeParty: string,
 *     ownClaims: Claim[],                 // active Actor's own publicly-disclosed Claims
 *     ownRfps: RFP[],                     // active Actor's own open RFPs
 *     otherClusters: [{
 *       ownerParty: string,
 *       publicClaims: Claim[],            // indigo dots
 *       umbrellaClaims: Claim[],          // amber dots — present only when active is umbrella grantee
 *     }],
 *     umbrellaEdges: [{ targetParty: string }],
 *     otherRfps: RFP[],                   // non-active-Actor RFPs (status === 'open')
 *   }
 */
export function buildV22DirectoryDataForRole(roleId, provisionals, closedRfpIds) {
  // Phase 17.1: closedRfpIds (Map<id, ISO closedDate> | null) overlays
  // session-state Close transitions on the seed RFPs. Threaded the same
  // way provisionals are — merged in-place here so call sites don't
  // need to pre-construct a wrapper. Order against mergeProvisionals
  // doesn't matter (provisionals never touch RFPs) but we apply
  // provisionals first for symmetry with other view-building paths.
  const shared = mergeClosedRfps(
    mergeProvisionals(buildV22SharedArtifacts(), provisionals),
    closedRfpIds,
  )
  const actor = (shared.actors || []).find((a) => a.id === roleId)
  const activeParty = actor?.party || null

  const allDas = shared.disclosureAgreements || []
  const activeDas = allDas.filter((d) => !d._declineMeta && !d._revokedMeta && d.type !== 'provisional')
  const claimsById = new Map((shared.claims || []).map((c) => [c.id, c]))

  // Public DAs: subject kind=claim, grantee=Radiant Network.
  const publicClaimIds = new Set()
  for (const da of activeDas) {
    if (da.subject?.kind !== 'claim') continue
    if (da.grantee?.party === 'Radiant Network') publicClaimIds.add(da.subject.id)
  }

  // Umbrella DAs to the active Actor: subject kind=claim, grantee=activeParty,
  // grantor is a non-active, non-network party.
  const umbrellaClaimIdsByGrantor = new Map()
  for (const da of activeDas) {
    if (da.subject?.kind !== 'claim') continue
    if (!activeParty) continue
    if (da.grantee?.party !== activeParty) continue
    const grantor = da.grantor?.party
    if (!grantor || grantor === activeParty || grantor === 'Radiant Network') continue
    if (!umbrellaClaimIdsByGrantor.has(grantor)) umbrellaClaimIdsByGrantor.set(grantor, new Set())
    umbrellaClaimIdsByGrantor.get(grantor).add(da.subject.id)
  }

  // Active Actor's own publicly-disclosed Claims.
  const ownClaims = []
  for (const id of publicClaimIds) {
    const c = claimsById.get(id)
    if (c && c.owner === activeParty) ownClaims.push(c)
  }

  // Other Actors' clusters: one entry per non-active Actor with any
  // Claim visible to the active Actor. A Claim that's both public AND
  // umbrella-to-active goes in publicClaims (public takes precedence
  // per §8.2.2; the amber border still wraps the actually-umbrella-only
  // subset).
  const clustersByOwner = new Map()
  const upsertCluster = (owner) => {
    if (!clustersByOwner.has(owner)) clustersByOwner.set(owner, { ownerParty: owner, publicClaims: [], umbrellaClaims: [] })
    return clustersByOwner.get(owner)
  }
  for (const id of publicClaimIds) {
    const c = claimsById.get(id)
    if (!c || c.owner === activeParty) continue
    upsertCluster(c.owner).publicClaims.push(c)
  }
  for (const [grantor, idSet] of umbrellaClaimIdsByGrantor.entries()) {
    for (const id of idSet) {
      if (publicClaimIds.has(id)) continue // public takes precedence — already added as public
      const c = claimsById.get(id)
      if (!c) continue
      upsertCluster(grantor).umbrellaClaims.push(c)
    }
  }
  const otherClusters = Array.from(clustersByOwner.values())

  // Dave-style "own catalog as indigo regardless of public" (per §8.2.5):
  // if the active Actor owns Claims that aren't publicly disclosed, they
  // still appear in ownClaims when viewed by their own role. Add any of
  // the active Actor's own Claims (regardless of public DA presence).
  const ownClaimIds = new Set(ownClaims.map((c) => c.id))
  for (const c of (shared.claims || [])) {
    if (c.owner === activeParty && !ownClaimIds.has(c.id)) {
      ownClaims.push(c)
      ownClaimIds.add(c.id)
    }
  }

  // Umbrella edges render only for Actors whose umbrella subset has at
  // least one amber-rendered Claim — i.e. at least one umbrella-to-active
  // Claim that ISN'T also publicly disclosed. If every umbrella DA's
  // subject is also public, the visual amber subset is empty and
  // drawing the umbrella edge would imply private access that doesn't
  // visually exist.
  // Phase 16.1.2 Item 4: edges dropped from Directory. Field retained for
  // backwards compatibility (any consumer iterating it sees an empty array).
  const umbrellaEdges = []

  // Phase 17.1: asymmetric visibility on `status === 'closed'`. The owner
  // of a closed RFP still sees it (with the dashed-outline treatment on
  // their Directory). Non-owners see only `'open'` RFPs — closed ones are
  // filtered out of `otherRfpsBaseline` (which feeds both `cluster.rfps`
  // and the `otherRfps` orphan path).
  const allRfps = shared.rfps || []
  const ownRfps = allRfps.filter((r) => r.owner === activeParty)
  const otherRfpsBaseline = allRfps.filter(
    (r) => r.owner !== activeParty && r.status === 'open',
  )

  // Phase 16.2.6.5: RFPs flow through clusters now. Each cluster carries
  // its owner's RFPs in `cluster.rfps`. RFPs from the 4 primary parties
  // (GovCo / MicroCo / AuditCo / ChipCo) on views where their cluster
  // doesn't render fall back to the existing orphan path via `otherRfps`
  // — preserves the 16.2.6.3 GovCo-on-Alice/Carol/Dave behavior.
  const PRIMARY_PARTIES_FOR_ORPHAN_RFP = new Set(['GovCo', 'MicroCo', 'AuditCo', 'ChipCo'])
  const rfpsByOwner = new Map()
  for (const r of otherRfpsBaseline) {
    if (!rfpsByOwner.has(r.owner)) rfpsByOwner.set(r.owner, [])
    rfpsByOwner.get(r.owner).push(r)
  }
  // (a) Existing clusters: attach owner's rfps.
  for (const cluster of otherClusters) {
    cluster.rfps = rfpsByOwner.get(cluster.ownerParty) || []
  }
  // (b) Upsert clusters for RFP-only owners (parties with RFPs but no
  // Claims). Primary parties excluded — their RFPs route through the
  // orphan path so GovCo's RFP on Alice's view still labels adjacently.
  const existingOwnersForRfps = new Set(otherClusters.map((c) => c.ownerParty))
  for (const [owner, ownerRfps] of rfpsByOwner.entries()) {
    if (existingOwnersForRfps.has(owner)) continue
    if (PRIMARY_PARTIES_FOR_ORPHAN_RFP.has(owner)) continue
    otherClusters.push({
      ownerParty: owner,
      publicClaims: [],
      umbrellaClaims: [],
      rfps: ownerRfps,
    })
  }
  // (c) otherRfps now contains ONLY orphan RFPs (primary-party RFPs whose
  // cluster isn't rendered on the active view). The 16.2.6.3 per-marker
  // owner-pillbox-label render in DirectoryLayer is filtered down to these
  // — see Item 6 (clusterIdx === -1 guard).
  const otherRfps = otherRfpsBaseline.filter(
    (r) => PRIMARY_PARTIES_FOR_ORPHAN_RFP.has(r.owner)
  )

  // Phase 16.1.2 Item 2: `isUserVisible` flag — true when the active actor
  // has at least one own publicly-disclosed Claim or own RFP. False for
  // anonymous actors (e.g. Carol/AuditCo in the seed). DirectoryLayer
  // consumes this to decide whether to render the user's own cluster +
  // Actor square.
  const isUserVisible = ownClaims.length > 0 || ownRfps.length > 0

  // Phase 16.2.8: enrich each surfaced Claim into a node-shaped object via
  // `claimToNode` + mock health/badges helpers. The enriched node drives
  // AssetNode / AssetNodeMini rendering in the Directory's mid/full LOD
  // (CLAIM label, minibar, red border, badge chips). Raw Claim objects on
  // the cluster (publicClaims, umbrellaClaims, ownClaims) stay untouched —
  // they continue to flow through onClaimDotClick → Detail Panel, which
  // reads referencedAssetIds / acknowledgments / pin etc. directly. The
  // enrichment is render-only, addressed by `claim.id` from a per-cluster
  // map (active actor uses the top-level `ownNodesByClaimId` map).
  const buildClaimNode = (claim) => {
    const health = mockClaimHealth(claim.id)
    const badges = mockClaimBadges(claim.id, health)
    const node = claimToNode(claim, { health, claimCount: 0 }, 0, 0)
    node._activeBadges = badges
    return node
  }
  for (const cluster of otherClusters) {
    const map = new Map()
    for (const c of cluster.publicClaims || []) map.set(c.id, buildClaimNode(c))
    for (const c of cluster.umbrellaClaims || []) {
      if (!map.has(c.id)) map.set(c.id, buildClaimNode(c))
    }
    cluster.nodesByClaimId = map
  }
  const ownNodesByClaimId = new Map()
  for (const c of ownClaims) {
    if (!ownNodesByClaimId.has(c.id)) ownNodesByClaimId.set(c.id, buildClaimNode(c))
  }

  return { activeParty, isUserVisible, ownClaims, ownRfps, otherClusters, umbrellaEdges, otherRfps, ownNodesByClaimId }
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
  // Phase 13 (#168): PoE nodes are first-class on the canvas.
  const visiblePoEs = view.proofsOfEvaluation || []
  const visiblePoeIds = new Set(visiblePoEs.map((p) => p.id))
  const poeById = new Map(visiblePoEs.map((p) => [p.id, p]))
  const actorPartyInView = new Set(view.actors.map((a) => a.party))
  const evalResultById = new Map(view.evaluationResults.map((e) => [e.id, e]))

  // Phase 13.2 (#177): build per-ER chain maps for chain-edge rerouting.
  //   • successorByErId: erId → next-ER-in-chain id (ER that has this id
  //                       as priorEvalResultId)
  //   • wrappingPoeByErId: erId → PoE id wrapping that ER (Phase 13.3 fix)
  //   • hasPredecessor:  set of erIds with a non-null priorEvalResultId
  //                       AND that predecessor is on canvas
  //
  // Edges are then derived as:
  //   - auto-disclosure DA for ER X:
  //       * if X has a successor on canvas → target the successor (chain).
  //       * elif X is wrapped by a PoE on canvas (Phase 13.3) → target
  //         the PoE; the PoE's own DA carries the PoE → Claim edge so
  //         the chain reads `... → ER → PoE → Claim` without a parallel
  //         ER → Claim bypass.
  //       * else → target the Claim (chain endpoint, no PoE).
  //   - ownership DA for ER X: if X has a predecessor on canvas, skip
  //     the Asset→ER edge entirely (only the chain origin links to the
  //     Asset; later chain members link forward through the chain).
  const successorByErId = new Map()
  for (const er of view.evaluationResults) {
    if (er.priorEvalResultId && evalResultById.has(er.priorEvalResultId)) {
      successorByErId.set(er.priorEvalResultId, er.id)
    }
  }
  const wrappingPoeByErId = new Map()
  for (const poe of visiblePoEs) {
    if (poe.wrappedEvalResultId && evalResultById.has(poe.wrappedEvalResultId)) {
      wrappingPoeByErId.set(poe.wrappedEvalResultId, poe.id)
    }
  }
  const hasPredecessor = (er) =>
    !!er.priorEvalResultId && evalResultById.has(er.priorEvalResultId)

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
    visibleParseIds.has(nodeId) ||
    visiblePoeIds.has(nodeId)

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
      // Phase 12.3 (Bug B): intersect against the Claim's current
      // `referencedAssetIds[]` (the active in-scope set per Phase 12.2's
      // `assetReferences[]` chain). Removed/superseded entries persist in
      // `da.scope.assetIds` for audit, but the edges should not draw on
      // canvas — the Asset is no longer logically referenced.
      const subjectClaim = view.claims.find((c) => c.id === id)
      const activeAssetIds = new Set(subjectClaim?.referencedAssetIds || [])
      for (const aid of da.scope.assetIds) {
        if (subjectClaim && !activeAssetIds.has(aid)) continue
        pushEdge(id, aid, da)
      }
      continue
    }
    if (kind === 'claim' && toPublic) {
      // Public-directory disclosure.
      pushEdge(id, RADIANT_NETWORK_ACTOR.id, da)
      continue
    }
    if (kind === 'claim' && !internal && !toPublic && da.type === 'proofonly') {
      // Phase 11D.3 / Phase 13: proof-only Claim DA. Two edge classes:
      //   (a) Conventional Claim ↔ granteeAssetId anchor (proof-only styled)
      //       so the pulled-in Claim has a visual home on the grantee's
      //       canvas, mirroring full/selective behavior.
      //   (b) One edge per disclosed PoE → Claim. The proof-only payload is
      //       now the PoE wrapper rather than individual Eval Results;
      //       wrapped Eval Results connect to the PoE via wrap edges (see
      //       PoE-EvalResult pass below).
      if (da.granteeAssetId) pushEdge(id, da.granteeAssetId, da)
      for (const poeId of (da.scope?.poeIds || [])) {
        pushEdge(poeId, id, da)
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
      // Phase 13.2 (#177): chain rerouting — only the *origin* ER in a
      // supersession chain links to the Asset. Chain members later in the
      // sequence reach the Asset transitively through their predecessors,
      // so emitting an Asset→ER edge for every chain member would render
      // a fan of redundant edges. Skip the edge when the ER has a
      // predecessor on canvas.
      const er = evalResultById.get(id)
      if (er && hasPredecessor(er)) continue
      for (const aid of da.scope.assetIds) pushEdge(id, aid, da)
      continue
    }
    if (kind === 'evalResult' && !internal) {
      // Phase 13.1 (#168a): auto-disclosure DA created at Eval Result save
      // time. evaluator (grantor) → claim owner (grantee).
      // Phase 13.2 (#177): chain rerouting — if the ER has a successor in
      // its supersession chain, the chain edge targets that successor.
      // Phase 13.3 (Step 1): when the ER is wrapped by a PoE, skip the
      // auto-disclosure DA's edge entirely — the synth wrap edge already
      // produces ER → PoE, and the PoE-targeting DA produces PoE → Claim.
      // Pre-13.3 the chain endpoint fell through to ER → Claim, which
      // bypassed the PoE node visually.
      const er = evalResultById.get(id)
      if (!er) continue
      const successorId = successorByErId.get(er.id)
      if (successorId) pushEdge(id, successorId, da)
      else if (wrappingPoeByErId.has(er.id)) {
        // Skip — synth wrap edge below handles ER → PoE.
      } else pushEdge(id, er.claimId, da)
      continue
    }
    if (kind === 'poe' && !internal) {
      // Phase 13 (#168): Proof-of-Evaluation DA. The disclosure subject is
      // the PoE.
      // Phase 13.2 (#177): chain insertion — the PoE-targeting DA emits an
      // edge from the PoE to the Claim. The Latest Eval Result → PoE edge
      // comes from the synth wrap pass below. Together they read as
      // `Latest → PoE → Claim`. The pre-13.2 design routed Latest → Claim
      // directly here, bypassing the PoE node visually; that meant the
      // PoE wrap edge sat off-chain rather than between the wrapped ER
      // and the Claim. Phase 13.2 inserts the PoE into the canvas chain.
      const poe = poeById.get(id)
      if (poe) pushEdge(poe.id, poe.claimId, da)
      continue
    }
    if (kind === 'evalResult' && internal && !hasScopeAssets) {
      // Self-evaluation proof-of-evaluation — owner is both grantor and grantee.
      // Phase 13.2 (#177): same chain rerouting as the cross-party path.
      // Phase 13.3 (Step 1): same PoE-wrap skip as cross-party.
      const er = evalResultById.get(id)
      if (!er) continue
      const successorId = successorByErId.get(er.id)
      if (successorId) pushEdge(id, successorId, da)
      else if (wrappingPoeByErId.has(er.id)) {
        // Skip — synth wrap edge handles ER → PoE.
      } else pushEdge(id, er.claimId, da)
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

  // Phase 13.1 (#168a): PoE → wrapped Eval Result wrapping edge. 1:1.
  // Synthesized (no backing DA) — reflects the artifact-level wrapping
  // relationship declared on the PoE itself.
  // Phase 13.2 (#177): edge style switches from `full` to `proofonly` —
  // PoE wrap is part of the proof-only chain (Latest Eval Result → PoE →
  // Claim). Direction also reversed to Latest → PoE so the chain reads
  // forward; pushEdge dedupes order-independently anyway.
  for (const poe of visiblePoEs) {
    const erId = poe.wrappedEvalResultId
    if (!erId || !visibleEvalIds.has(erId)) continue
    const synthDa = {
      id: `synth-poewrap-${poe.id}-${erId}`,
      type: 'proofonly',
      grantor: { party: poe.owner },
      grantee: { party: poe.owner },
      subject: { kind: 'poe', id: poe.id },
      scope: { poeIds: [poe.id] },
      terms: {},
      _isPoeWrap: true,
    }
    pushEdge(erId, poe.id, synthDa)
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
// Phase 16.2.2: was 2100; bumped to 2400 so the gap between the rightmost
// chain node (owned PoE at COL_OWN_EVAL + chainLength*ER_COL_SPACING = 2000
// for non-supersession chains) and the pulled Claim is ≥240 world units.
// The previous 2100 produced only a 100-unit gap, which read as visual
// overlap on Bob/Carol/Dave's grantee-direction canvases.
const COL_PULLED_CLAIM = 2400
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
// Phase 16.2.2: COL_PULLED_ASSET + COL_PUBLIC bumped by 300 to keep step
// spacing consistent with the new COL_PULLED_CLAIM (2400).
const COL_PULLED_ASSET = 2800
const COL_PUBLIC = 3200
// Phase 13 (#168): PoE column sits 400px right of own Eval Results so PoE
// nodes appear "downstream" of the Eval Results they wrap. The wrapping
// edges run leftward to the Eval Result column. Pulled-in (counterparty
// canvas) PoEs hang next to their source Claim — see placement loop.
// Phase 16.2.2: bumped to 2400 in line with COL_PULLED_CLAIM. Used only as
// a fallback when an owned PoE's wrapped Eval Result isn't on canvas — the
// main owned-PoE x-formula is `COL_OWN_EVAL_eff + chainLength*ER_COL_SPACING`.
const COL_OWN_POE = 2400
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
  // Phase 13.2 (#176): minibar maps SAT→ok (green), UNSAT→bad (red),
  // MISSING→warn (amber). N/A continues to be excluded from displays.
  // Aggregates across all non-superseded Eval Results referencing the
  // Claim — chain ancestors that are SUPERSEDED don't contribute (their
  // values are stale by definition).
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
      else if (r.status === 'missing') warn += 1
    }
  }
  return { health: { ok, warn, bad }, claimCount: total }
}

function rollupEvalResultHealth(er) {
  // Phase 13.2 (#176): MISSING maps to the warn (amber) slot, parallel to
  // rollupClaimHealth above.
  let ok = 0
  let warn = 0
  let bad = 0
  let total = 0
  for (const r of er.results) {
    if (r.status === 'na') continue
    total += 1
    if (r.status === 'satisfactory') ok += 1
    else if (r.status === 'unsatisfactory') bad += 1
    else if (r.status === 'missing') warn += 1
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

// Phase 16.2.8: deterministic per-Claim mock health distribution for the
// Directory layer's full/mid card LOD. Target across all Claims:
//   50% no minibar          health = { ok:0, warn:0, bad:0 } — HealthBar returns null
//    5% 100% green + ≥2 badges
//    5% 100% green + 1 badge
//   10% 100% green w/o badges
//   15% has bad (red border on the card)
//   15% mixed (ok + warn, no bad)
// Returns the same { ok, warn, bad } counts shape `claimToNode`'s rollup
// already expects (downstream feeds into AssetNode's HealthBar). PRNG seed
// is per-Claim, so the same Claim renders identically across reloads.
function mockClaimHealth(claimId) {
  const rand = seededRandom(hashString(claimId + ':health'))
  const r = rand()
  if (r < 0.50) return { ok: 0, warn: 0, bad: 0 }                       // no minibar
  if (r < 0.55) return { ok: 4 + Math.floor(rand() * 5), warn: 0, bad: 0 } // green + ≥2 badges
  if (r < 0.60) return { ok: 3 + Math.floor(rand() * 5), warn: 0, bad: 0 } // green + 1 badge
  if (r < 0.70) return { ok: 3 + Math.floor(rand() * 6), warn: 0, bad: 0 } // green w/o badges
  if (r < 0.85) {                                                          // has bad — red border
    const ok = 1 + Math.floor(rand() * 5)
    const warn = Math.floor(rand() * 3)
    const bad = 1 + Math.floor(rand() * 3)
    return { ok, warn, bad }
  }
  // mixed (ok + warn, no bad)
  const ok = 2 + Math.floor(rand() * 5)
  const warn = 1 + Math.floor(rand() * 3)
  return { ok, warn, bad: 0 }
}

// Phase 16.2.8: deterministic per-Claim mock `_activeBadges` for the
// Directory's full-card LOD. Badges only appear on 100% green minibars
// (Andrew's rule), confirmed by checking `health.bad === 0 && health.warn
// === 0 && health.ok > 0`. The two top buckets in `mockClaimHealth`
// (5% with ≥2 badges, 5% with exactly 1 badge) drive the count via the
// same RNG bucket — re-roll the bucket here so the two helpers stay in
// sync. If you change one threshold, change the other.
//
// Badge shape `{ id, badgeName, badgeVersion, issuerParty }` matches
// `BadgeChipContainer.jsx`'s `ShieldTooltipContent` + `OverflowTooltipContent`
// consumers (badge.badgeName / badgeVersion / issuerParty are the only
// fields read). No icon, no color (shield is constant indigo).
const MOCK_BADGE_NAMES = [
  'ISO 27001',
  'SOC 2 Type II',
  'ITAR Compliance',
  'DO-178C Level A',
  'EN 9100',
  'AS9100D',
  'CMMC Level 3',
  'NIST 800-171',
  'FIPS 140-3',
  'DO-254 Level B',
  'MIL-STD-810H',
  'RTCA DO-160G',
]
const MOCK_BADGE_ISSUERS = [
  'AuditCo',
  'Sentinel Compliance',
  'Veritas Standards',
  'Crucible Audit',
  'Meridian Certification',
]
function mockClaimBadges(claimId, health) {
  // Eligibility gate: badges only on 100% green minibars.
  if (health.bad > 0 || health.warn > 0 || health.ok === 0) return []
  // Same bucket re-roll as mockClaimHealth (same salt → same r value).
  const r = seededRandom(hashString(claimId + ':health'))()
  let badgeCount
  if (r >= 0.50 && r < 0.55) {
    // Top bucket: 2-4 badges.
    badgeCount = 2 + Math.floor(seededRandom(hashString(claimId + ':bcnt'))() * 3)
  } else if (r >= 0.55 && r < 0.60) {
    badgeCount = 1                                                          // single badge
  } else {
    return []                                                                // 100% green but no badges
  }
  const out = []
  for (let i = 0; i < badgeCount; i++) {
    const nameRand = seededRandom(hashString(claimId + ':bname:' + i))
    const issuerRand = seededRandom(hashString(claimId + ':bissuer:' + i))
    const verRand = seededRandom(hashString(claimId + ':bver:' + i))
    out.push({
      id: `${claimId}-badge-${i}`,
      badgeName: MOCK_BADGE_NAMES[Math.floor(nameRand() * MOCK_BADGE_NAMES.length)],
      badgeVersion: 1 + Math.floor(verRand() * 3),                          // v1-v3
      issuerParty: MOCK_BADGE_ISSUERS[Math.floor(issuerRand() * MOCK_BADGE_ISSUERS.length)],
    })
  }
  return out
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

function evalResultToNode(er, x, y, claim) {
  const rollup = rollupEvalResultHealth(er)
  // Phase 13.1 (#168a): multi-RS Eval Results carry a flat results[] across
  // all selected RSes. Auto-name uses the Claim name as the basis ("Evaluation
  // of [Claim name]"); falls back to the first RS's name for backwards-compat
  // when the Claim isn't resolvable.
  const rsList = er.requirementsSets || []
  const claimName = claim?.name || null
  const firstRsName = rsList[0]?.name || null
  const autoName = claimName
    ? `Evaluation of ${claimName}`
    : (rsList.length > 1 ? `${firstRsName} (+${rsList.length - 1} more)` : firstRsName || er.id)
  return {
    id: er.id,
    pin: er.pin,
    dot: er.ownerDot,
    name: autoName,
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
    // Phase 13.1: surface the bundled RSes for canvas-time decisions.
    requirementsSets: rsList.map((rs) => ({ ...rs })),
    evalAggregate: getEvalResultAggregate(er),
    evaluator: er.owner,
    evaluatorParty: er.owner,
    date: er.evaluationDate ? er.evaluationDate.slice(0, 10) : null,
    dateTime: er.evaluationDate,
    claims: er.results.map((r) => ({
      requirementsSetId: r.requirementsSetId,
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
 * Phase 13.1 (#168a): PoE → canvas node. PoEs wrap exactly one Eval Result;
 * the card body aggregate ("X SAT · Y UNSAT across N Requirements Sets")
 * matches the wrapped Eval Result's totals.
 */
function rollupPoeAggregate(poe, evalResultsList) {
  const wrapped = evalResultsList.find((e) => e.id === poe.wrappedEvalResultId)
  const agg = getEvalResultAggregate(wrapped)
  return {
    sat: agg.totalSat,
    unsat: agg.totalUnsat,
    missing: agg.totalMissing,
    na: agg.totalNa,
    rsCount: agg.rsCount,
  }
}

function poeToNode(poe, x, y, evalResultsList = []) {
  const agg = rollupPoeAggregate(poe, evalResultsList)
  return {
    id: poe.id,
    pin: poe.pin,
    dot: poe.ownerDot,
    name: poe.name,
    category: 'evaluation',
    owner: poe.owner,
    parentId: null,
    children: [],
    health: EMPTY_HEALTH,
    childHealth: null,
    totalHealth: null,
    displayHealth: EMPTY_HEALTH,
    claimCount: 1,
    displayClaimCount: 1,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x,
    y,
    parentOwner: poe.owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isClaim: false,
    isParse: false,
    isEvaluation: false,
    isPoe: true,
    isTerminalNode: true,
    status: poe.status,
    claimId: poe.claimId,
    wrappedEvalResultId: poe.wrappedEvalResultId,
    poeAggregate: agg,
    artifactUri: poe.artifactUri,
    date: poe.createdDate ? poe.createdDate.slice(0, 10) : null,
    dateTime: poe.createdDate,
    v22Type: 'PROOF OF EVALUATION',
    v22Artifact: poe,
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
      // Phase 11E.1.6 Fix 1: warm-path mirror of cold-path null-respect
      // semantics. `eaTerms?.expires === null` ("Never expires") must
      // not be coerced back to the provisional fallback by `??`.
      evaluationDeadline: eaTerms?.expires !== undefined
        ? eaTerms.expires
        : (provisionalEa.terms?.evaluationDeadline ?? null),
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
 *
 * Phase 11E.1.6 Fix 2: `daTerms.expires` and `eaTerms.expires` are now
 * separate inputs — the DA and EA each carry their own expiration set
 * independently in the response modal (CombinedResponseModal Step 2 and
 * Step 3 respectively). Pre-fix this helper coerced both to
 * `eaTerms.expires`, conflating two distinct contracts.
 */
export function finalizeProvisionalAgreementPair({
  provisionalDa, provisionalEa,
  type, scope, daTerms, eaTerms,
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
      expires: daTerms?.expires !== undefined
        ? daTerms.expires
        : (provisionalDa.terms?.expires ?? null),
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
      // Phase 11E.1.6 Fix 1: distinguish "user explicitly chose null"
      // (Never expires) from "user supplied no value" (fall back). Pre-fix
      // the `??` operator coerced an explicit null into the provisional
      // fallback, silently undoing the user's "Never expires" pick.
      evaluationDeadline: eaTerms?.expires !== undefined
        ? eaTerms.expires
        : (provisionalEa.terms?.evaluationDeadline ?? null),
      resultExpiry: provisionalEa.terms?.resultExpiry,
      flowDownRequirements: provisionalEa.terms?.flowDownRequirements,
    },
    incentives: provisionalEa.incentives,
    status: 'active',
  })
  return { disclosureAgreement: activeDa, evaluationAgreement: activeEa }
}

/**
 * Amend a Claim by adding additional referenced Assets (spec §11.1) and / or
 * editing the Claim's Referenced Standards (spec §10.3a, Phase 12.1 #120).
 * Returns a new Claim artifact with the merged state plus a new entry in
 * `amendments[]`. The original Claim's id is preserved so the artifact replaces
 * its prior version when merged into the shared dataset via `mergeProvisionals`.
 *
 * Also returns the new internal claim-ref Disclosure Agreements that need to be
 * added to the shared dataset for the new Asset references to render edges.
 * (The seeded `claimRefEdges` only covers original references.)
 *
 * Phase 12.1: `addedRequirementsSetIds` / `removedRequirementsSetIds` are
 * cascade-skip — they DO NOT mark Eval Results stale and DO NOT generate
 * notifications. The amendment record carries them in parallel diff fields
 * for audit purposes only.
 */
export function makeAmendedClaim({
  claim,
  addedAssetIds = [],
  removedAssetIds = [],
  addedRequirementsSetIds = [],
  removedRequirementsSetIds = [],
  // Phase 12.2 (#122): Asset supersession edits. Each entry replaces an
  // evaluated Asset with a successor without removing the original from
  // the audit chain. Shape: [{ from: oldAssetId, to: newAssetId }, ...].
  // Both Replace and Remove flow through this same factory; the difference
  // is the entry shape (Replace produces a `supersededAssets` entry,
  // Remove appends to `removedAssetIds`).
  supersededAssets = [],
}) {
  const amendmentDate = new Date().toISOString()

  // Phase 12.2: rebuild the assetReferences chain. Start from existing,
  // apply removals (stamp removedDate), apply supersessions (stamp the
  // old entry's supersededBy + add a new entry for the replacement),
  // apply additions (append fresh entries).
  const removedAssetSet = new Set(removedAssetIds)
  const supersedeMap = new Map()
  for (const s of supersededAssets) supersedeMap.set(s.from, s.to)

  const existingRefs = (claim.assetReferences || claim.referencedAssetIds.map((aid) => ({
    assetId: aid, supersededBy: null, addedDate: claim.createdDate, removedDate: null,
  }))).map((r) => ({ ...r }))   // shallow clone

  // Apply Remove: stamp removedDate on matching active entries.
  for (const ref of existingRefs) {
    if (removedAssetSet.has(ref.assetId) && !ref.removedDate && !ref.supersededBy) {
      ref.removedDate = amendmentDate
    }
  }
  // Apply Supersede: stamp supersededBy on matching active entries.
  // The new (replacement) entry is appended below.
  for (const ref of existingRefs) {
    const to = supersedeMap.get(ref.assetId)
    if (to && !ref.removedDate && !ref.supersededBy) {
      ref.supersededBy = to
    }
  }
  // Append entries for Supersede targets (the new active heads).
  for (const { from, to } of supersededAssets) {
    if (!existingRefs.some((r) => r.assetId === to)) {
      existingRefs.push({ assetId: to, supersededBy: null, addedDate: amendmentDate, removedDate: null })
    }
  }
  // Apply Add: append fresh entries for newly-added Assets that aren't
  // already represented as active heads.
  for (const aid of addedAssetIds) {
    const existingActive = existingRefs.find((r) => r.assetId === aid && !r.removedDate && !r.supersededBy)
    if (!existingActive) {
      existingRefs.push({ assetId: aid, supersededBy: null, addedDate: amendmentDate, removedDate: null })
    }
  }

  // Derive the effective `referencedAssetIds` from the post-amend chain:
  // active entries are those without removedDate AND without supersededBy.
  const nextActiveAssetIds = existingRefs
    .filter((r) => !r.removedDate && !r.supersededBy)
    .map((r) => r.assetId)

  // Phase 12.1: re-derive the Referenced Standards array. Removed entries
  // are dropped; added entries get a freshly stamped `addedDate`. Preserve
  // existing entries' `addedDate` (don't reset on every amendment).
  const removedRsSet = new Set(removedRequirementsSetIds)
  const carryRs = (claim.referencedRequirementsSets || [])
    .filter((r) => !removedRsSet.has(r.requirementsSetId))
  const addedRs = addedRequirementsSetIds.map((rsId) => ({
    requirementsSetId: rsId,
    addedDate: amendmentDate,
  }))
  const nextRs = [...carryRs, ...addedRs]

  const amendedClaim = makeClaim({
    id: claim.id,
    owner: claim.owner,
    ownerDot: claim.ownerDot,
    name: claim.name,
    description: claim.description,
    referencedAssetIds: nextActiveAssetIds,
    // Phase 11C.1: preserve existing acknowledgments through Asset
    // amendments. Editing acknowledgments themselves is a future workstream.
    acknowledgments: claim.acknowledgments || [],
    referencedRequirementsSets: nextRs,
    assetReferences: existingRefs,
    createdDate: claim.createdDate,
    amendments: [
      ...(claim.amendments || []),
      {
        date: amendmentDate,
        added: [...addedAssetIds],
        removed: [...removedAssetIds],
        addedRequirementsSetIds: [...addedRequirementsSetIds],
        removedRequirementsSetIds: [...removedRequirementsSetIds],
        supersededAssets: supersededAssets.map((s) => ({ from: s.from, to: s.to })),
        removedAssetIds: [...removedAssetIds],
      },
    ],
  })
  // Phase 12.2: Supersede targets also need internal claim-ref DA edges
  // (they're new Asset references on the Claim). Mirror the existing-add
  // path so canvas edges render for the new heads.
  const allNewlyAddedAssetIds = [
    ...addedAssetIds,
    ...supersededAssets.map((s) => s.to).filter((aid) => !addedAssetIds.includes(aid)),
  ]
  const newClaimRefEdges = allNewlyAddedAssetIds.map((assetId) =>
    makeInternalDisclosureAgreement({
      id: `da-ref-${claim.id}-${assetId}`,
      owner: claim.owner,
      ownerDot: claim.ownerDot,
      subject: { kind: 'claim', id: claim.id },
      scope: { assetIds: [assetId], includeDerivatives: true },
      terms: { createdDate: amendmentDate },
    }),
  )
  return { claim: amendedClaim, newClaimRefEdges }
}

/**
 * Amend a Disclosure Agreement's scope and/or expiration (spec §11.2).
 * Returns a new DA with the updated scope + terms.expires and an appended
 * `amendments[]` entry. Per §11.2, callers MUST have already enforced
 * "no removal of evaluated evidence" — this helper does not re-validate
 * (the caller knows whether evaluations have been run).
 *
 * Phase 11E.1.6 Fix 3: gained an optional `terms` argument to support
 * editing `terms.expires` alongside scope (parity with
 * `proposeEvaluationAgreementAmendment` which edits `terms.evaluationDeadline`).
 * The amendment record now carries `termsBefore.expires` so the DA Detail
 * Panel can render an "Expiration: before → after" delta line per
 * amendment, matching the EA panel pattern.
 */
export function makeAmendedDisclosureAgreement({ disclosureAgreement: da, scope, terms, note = '' }) {
  // `terms?.expires` may legitimately be null ("Never expires"); preserve
  // null vs. undefined so a deliberate "Never expires" pick during amend
  // doesn't get silently coerced back to the prior expires.
  const nextExpires = terms && terms.expires !== undefined
    ? terms.expires
    : (da.terms?.expires ?? null)
  return makeDisclosureAgreement({
    id: da.id,
    grantor: da.grantor,
    grantee: da.grantee,
    subject: da.subject,
    granteeAssetId: da.granteeAssetId,
    type: da.type,
    scope: scope || da.scope,
    terms: {
      ...da.terms,
      expires: nextExpires,
    },
    amendments: [
      ...(da.amendments || []),
      {
        date: new Date().toISOString(),
        note: (note || '').trim(),
        scopeBefore: da.scope,
        termsBefore: { expires: da.terms?.expires ?? null },
      },
    ],
    status: da.status,
  })
}

/**
 * Phase 11.6 (#164): Propose an amendment to an Evaluation Agreement
 * (spec §11.2a, amendment-as-proposal model). Returns a new EA with
 * `status: 'pending-acceptance'` and an appended `amendments[]` entry
 * with `status: 'pending'`. Pending amendments carry both the proposed
 * acknowledgments + the proposed `terms.evaluationDeadline` as
 * snapshots; the live Claim and the EA's terms stay AT THEIR PRE-
 * AMENDMENT VALUES until the grantee accepts.
 *
 * On accept (`acceptEvaluationAgreementAmendment`): the EA flips back
 * to `status: 'active'`, the Claim's acknowledgments mutate to match
 * the proposal's snapshot, and the amendment record is marked
 * `status: 'accepted'`.
 *
 * On reject (`rejectEvaluationAgreementAmendment`): the EA flips back
 * to `status: 'active'`, the Claim is untouched, and the amendment
 * record is marked `status: 'rejected'`.
 *
 * Spec §11.2a major revision (Phase 11.6): supersedes the Phase 11E.1
 * Option B unilateral-amendment model. The grantor cannot mutate the
 * grantee's accepted commitments without explicit consent — required
 * to close the post-acceptance acknowledgment-injection exploit.
 */
export function proposeEvaluationAgreementAmendment({
  evaluationAgreement: ea,
  terms,
  acknowledgments,
  acknowledgmentChanges = { added: [], removed: [], edited: [] },
  proposalMessage = '',
}) {
  const proposalId = `am-${ea.id}-${Date.now().toString(36)}-${Math.floor(Math.random() * 36 ** 3).toString(36)}`
  const proposedDeadline = terms?.evaluationDeadline !== undefined
    ? terms.evaluationDeadline
    : ea.terms?.evaluationDeadline
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
    // Pre-amendment terms preserved on the EA itself; the proposal's
    // proposed deadline lives on the amendment record's `proposed.evaluationDeadline`.
    terms: { ...ea.terms },
    incentives: ea.incentives,
    amendments: [
      ...(ea.amendments || []),
      {
        id: proposalId,
        status: 'pending',
        date: new Date().toISOString(),
        proposalMessage: (proposalMessage || '').trim(),
        responseMessage: null,
        responseDate: null,
        // Pre-amendment snapshot for diffing in the response modal.
        termsBefore: { evaluationDeadline: ea.terms?.evaluationDeadline ?? null },
        // Proposed snapshot — the values that will be applied on accept.
        proposed: {
          evaluationDeadline: proposedDeadline ?? null,
          acknowledgments: (acknowledgments || []).map((a) => ({
            id: a.id,
            title: a.title,
            description: a.description,
          })),
        },
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
    status: 'pending-acceptance',
  })
}

/**
 * Phase 11.6 (#164): Grantee accepts a pending amendment proposal.
 * The EA flips back to `status: 'active'` with the proposed
 * `terms.evaluationDeadline` applied, and the matching amendment
 * record is marked `status: 'accepted'`. Caller is responsible for
 * mutating the Claim's `acknowledgments[]` separately (the helper
 * returns the proposal's `proposed.acknowledgments` snapshot so the
 * caller can stage that mutation atomically).
 */
export function acceptEvaluationAgreementAmendment({
  evaluationAgreement: ea,
  amendmentId,
  responseMessage = '',
}) {
  const amendment = (ea.amendments || []).find((a) => a.id === amendmentId)
  if (!amendment) {
    throw new Error(`acceptEvaluationAgreementAmendment: amendment ${amendmentId} not found on EA ${ea.id}`)
  }
  if (amendment.status !== 'pending') {
    throw new Error(`acceptEvaluationAgreementAmendment: amendment ${amendmentId} is ${amendment.status}, expected pending`)
  }
  const proposedDeadline = amendment.proposed?.evaluationDeadline ?? null
  const proposedAcks = (amendment.proposed?.acknowledgments || []).map((a) => ({
    id: a.id, title: a.title, description: a.description,
  }))
  const updatedAmendments = (ea.amendments || []).map((a) => (
    a.id === amendmentId
      ? { ...a, status: 'accepted', responseMessage: (responseMessage || '').trim(), responseDate: new Date().toISOString() }
      : a
  ))
  return {
    evaluationAgreement: makeEvaluationAgreement({
      id: ea.id,
      grantor: ea.grantor,
      grantee: ea.grantee,
      claimId: ea.claimId,
      granteeAssetId: ea.granteeAssetId,
      disclosureAgreementId: ea.disclosureAgreementId,
      authorizedRequirementsSetIds: ea.authorizedRequirementsSetIds,
      acknowledgmentsAccepted: ea.acknowledgmentsAccepted,
      restrictions: ea.restrictions,
      terms: { ...ea.terms, evaluationDeadline: proposedDeadline },
      incentives: ea.incentives,
      amendments: updatedAmendments,
      status: 'active',
    }),
    proposedAcknowledgments: proposedAcks,
  }
}

/**
 * Phase 11.6 (#164): Grantee rejects a pending amendment proposal.
 * The EA flips back to `status: 'active'` with terms UNCHANGED, the
 * Claim is untouched, and the matching amendment record is marked
 * `status: 'rejected'`. Audit trail of the proposed values is
 * preserved on the amendment record.
 */
export function rejectEvaluationAgreementAmendment({
  evaluationAgreement: ea,
  amendmentId,
  responseMessage = '',
}) {
  const amendment = (ea.amendments || []).find((a) => a.id === amendmentId)
  if (!amendment) {
    throw new Error(`rejectEvaluationAgreementAmendment: amendment ${amendmentId} not found on EA ${ea.id}`)
  }
  if (amendment.status !== 'pending') {
    throw new Error(`rejectEvaluationAgreementAmendment: amendment ${amendmentId} is ${amendment.status}, expected pending`)
  }
  const updatedAmendments = (ea.amendments || []).map((a) => (
    a.id === amendmentId
      ? { ...a, status: 'rejected', responseMessage: (responseMessage || '').trim(), responseDate: new Date().toISOString() }
      : a
  ))
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
    terms: { ...ea.terms },
    incentives: ea.incentives,
    amendments: updatedAmendments,
    status: 'active',
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
 * Phase 13.1 (#168a): single-call evaluation submit. Produces ONE Eval
 * Result wrapping every selected RS, ONE proof-only DA targeting that Eval
 * Result (auto-disclosure), and ONE ownership DA. Multi-RS evaluation
 * submissions go through this once, not once-per-RS.
 *
 *   - The Evaluation Result itself (spec §10.6)
 *   - A Proof-of-Evaluation Disclosure Agreement (evaluator → claim owner)
 *     with subject.kind='evalResult'
 *   - The evaluator's ownership DA linking the Eval Result to their anchor Asset
 *
 * `priorActiveResult` supersession lineage is keyed on requirements-set
 * intersection — if any RS in the new run also appeared in the prior
 * Eval Result, the prior is marked 'superseded'.
 */
export function makeEvaluationRunArtifacts({
  evaluatorParty, evaluatorDot,
  claimOwnerParty, claimOwnerDot,
  evaluationAgreement,
  granteeAssetId,
  requirementsSets,    // [{ id, name, version }, ...] — all RSes evaluated
  rows,                // [{ requirementsSetId, requirementId, label, value, status, confidence, _aiOriginalValue }]
  evidenceUsed,        // [assetId, ...]
  priorActiveResult,
}) {
  const evalId = makeArtifactId('eval', `${evaluationAgreement.id}-${Date.now()}-${Math.random()}`)
  const evaluationDate = new Date().toISOString()

  const evalResult = makeEvaluationResult({
    id: evalId,
    owner: evaluatorParty,
    ownerDot: evaluatorDot || makeDot(evaluatorParty),
    evaluationAgreementId: evaluationAgreement.id,
    claimId: evaluationAgreement.claimId,
    granteeAssetId,
    requirementsSets,
    results: rows,
    evidenceUsed,
    evaluationDate,
    status: 'active',
    supersededBy: null,
  })

  const proofDa = makeProofOfEvalDisclosureAgreement({
    id: makeArtifactId('da-proof', `${evalId}-${Date.now()}`),
    evaluator: evaluatorParty,
    evaluatorDot,
    claimOwner: claimOwnerParty,
    claimOwnerDot,
    evaluationResultId: evalId,
    terms: { createdDate: evaluationDate },
  })

  const ownershipDa = makeInternalDisclosureAgreement({
    id: makeArtifactId('da-own', `${evalId}-${Date.now()}`),
    owner: evaluatorParty,
    ownerDot: evaluatorDot,
    subject: { kind: 'evalResult', id: evalId },
    scope: granteeAssetId
      ? { assetIds: [granteeAssetId], includeDerivatives: false }
      : { includeDerivatives: false },
    terms: { createdDate: evaluationDate },
  })

  // Phase 13.1 (#168a): supersession lineage. The prior result is
  // superseded when at least one RS in the new run matches an RS the
  // prior wrapped. (Re-running a subset of the prior's RSes still
  // supersedes — `priorActiveResult` lookup keys on a single RS so this
  // condition is equivalent to "prior covers that RS", which by
  // construction it does.)
  let supersededVersion = null
  const newRsIds = new Set(requirementsSets.map((rs) => rs.id))
  const priorRsIds = priorActiveResult
    ? (priorActiveResult.requirementsSets
        ? priorActiveResult.requirementsSets.map((rs) => rs.id)
        // Backwards compat for any caller still on the singular shape.
        : priorActiveResult.requirementsSet ? [priorActiveResult.requirementsSet.id] : [])
    : []
  const priorOverlaps = priorRsIds.some((id) => newRsIds.has(id))
  if (priorActiveResult && priorOverlaps && priorActiveResult.status === 'active') {
    supersededVersion = {
      ...priorActiveResult,
      status: 'superseded',
      supersededBy: evalResult.id,
    }
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
  // Phase 12.1 (#120): optional Referenced Standards. Bare RS ids; the
  // factory stamps `addedDate = createdDate` so the seed and create
  // pathways produce structurally identical entries.
  referencedRequirementsSetIds = [],
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

  // Phase 12.1: dedupe RS ids (defensive — UI shouldn't produce dupes but
  // the factory is the audit boundary) and stamp the addedDate.
  const dedupedRsIds = Array.from(new Set(referencedRequirementsSetIds || []))
  const referencedRequirementsSets = dedupedRsIds.map((rsId) => ({
    requirementsSetId: rsId,
    addedDate: createdDate,
  }))

  const claim = makeClaim({
    id: claimId,
    owner: ownerParty,
    ownerDot: ownerDot || makeDot(ownerParty),
    name: name.trim(),
    description,
    referencedAssetIds,
    acknowledgments: finalAcks,
    referencedRequirementsSets,
    // Phase 12.2 (#122): factory derives assetReferences from
    // referencedAssetIds when not explicitly passed; explicit pass-through
    // here is unnecessary but documented as the migration path.
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
    (e) => {
      if (e.claimId !== claimId) return false
      if (e.status !== 'active') return false
      const rsIds = e.requirementsSets ? e.requirementsSets.map((rs) => rs.id) : []
      return rsIds.includes(requirementsSetId)
    },
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

  // Phase 13.3 (Step 4): chain length determines an additional rightward
  // shift for downstream columns so chain ancestors don't collide with
  // the Pulled Claim / Pulled Asset / Public columns. Compute once here
  // before all placement runs so every column is consistent.
  const ER_COL_SPACING = 300
  const erIdToErArtifact = new Map(view.evaluationResults.map((e) => [e.id, e]))
  const chainPositionByErId = new Map()
  const chainOriginByErId = new Map()
  for (const er of view.evaluationResults) {
    let pos = 0
    let cursor = er
    while (cursor && cursor.priorEvalResultId && erIdToErArtifact.has(cursor.priorEvalResultId)) {
      pos += 1
      cursor = erIdToErArtifact.get(cursor.priorEvalResultId)
    }
    chainPositionByErId.set(er.id, pos)
    chainOriginByErId.set(er.id, cursor.id)
  }
  const chainLengthByOriginId = new Map()
  for (const er of view.evaluationResults) {
    const origin = chainOriginByErId.get(er.id)
    const pos = chainPositionByErId.get(er.id)
    const prev = chainLengthByOriginId.get(origin) || 0
    if (pos + 1 > prev) chainLengthByOriginId.set(origin, pos + 1)
  }
  const chainLengthForEr = (er) =>
    chainLengthByOriginId.get(chainOriginByErId.get(er.id)) || 1
  const maxChainLengthOnCanvas = view.evaluationResults.reduce(
    (acc, er) => Math.max(acc, chainLengthForEr(er)),
    1,
  )
  const chainColShift = Math.max(0, maxChainLengthOnCanvas - 1) * ER_COL_SPACING

  // Effective column positions — shifted right by Asset hierarchy depth
  // (assetColShift, Phase 10.2) AND chain length (chainColShift, Phase
  // 13.3). The eval column itself stays at COL_OWN_EVAL + assetColShift;
  // chain ancestors push right within that column's "lane" via
  // ER_COL_SPACING. Downstream columns absorb the chain expansion.
  const COL_OWN_PARSE_eff = COL_OWN_PARSE + assetColShift
  const COL_OWN_CLAIM_eff = COL_OWN_CLAIM + assetColShift
  const COL_OWN_EVAL_eff = COL_OWN_EVAL + assetColShift
  const COL_OWN_POE_eff = COL_OWN_POE + assetColShift + chainColShift
  const COL_PULLED_CLAIM_eff = COL_PULLED_CLAIM + assetColShift + chainColShift
  const COL_PULLED_EVAL_eff = COL_PULLED_EVAL + assetColShift
  const COL_PULLED_ASSET_eff = COL_PULLED_ASSET + assetColShift + chainColShift
  const COL_PUBLIC_eff = COL_PUBLIC + assetColShift + chainColShift

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
  // Phase 16.2.11: per-Claim effective disclosure type for the active
  // actor. Drives the disclosure-typed border + bg tint on the parent
  // canvas (mirror of Directory's Phase 16.2.10 treatment). Own Claims
  // → 'full' (no DA gate; the owner sees everything). Pulled Claims →
  // type from the DA where grantee.party === actor.party AND
  // subject.kind === 'claim' AND subject.id === claim.id (the disclosure
  // that brought it onto this canvas). Multiple matching DAs (e.g.
  // umbrella + direct) — first match wins; the seed is structured so
  // disclosure type agrees across DAs that grant the same Claim.
  // Fallback when no matching DA is found (defensive — shouldn't happen
  // for visible Claims): undefined → AssetNode chain falls through to
  // WARM_BORDER (safe default; doesn't misrepresent the disclosure).
  const disclosureTypeByClaimId = new Map()
  for (const c of ownedClaims) disclosureTypeByClaimId.set(c.id, 'full')
  const activePartyForDA = actor.party
  for (const da of view.disclosureAgreements || []) {
    if (da.subject?.kind !== 'claim') continue
    if (da.grantee?.party !== activePartyForDA) continue
    if (disclosureTypeByClaimId.has(da.subject.id)) continue
    disclosureTypeByClaimId.set(da.subject.id, da.type)
  }
  const stampDisclosureType = (node, claim) => {
    const t = disclosureTypeByClaimId.get(claim.id)
    if (t) node._disclosureType = t
    return node
  }
  ownedClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    // Phase 10.2.1: symmetric distribution; Owned Claims at offset 0 (two
    // columns away from owned Assets, so no overlap risk on horizontal lines).
    nodes.push(stampDisclosureType(claimToNode(claim, rollup, COL_OWN_CLAIM_eff, symmetricRowY(i)), claim))
  })
  pulledClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    // Phase 10.2.1: symmetric distribution; Pulled Claims at offset 0.
    const node = stampDisclosureType(claimToNode(claim, rollup, COL_PULLED_CLAIM_eff, symmetricRowY(i)), claim)
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
  // Phase 13.3 (Step 4): multi-column chain placement. ER_COL_SPACING +
  // chain maps were computed at the top of buildV22Canvas; each ER's
  // x-position derives from its supersession-chain position. Globally
  // aligned: column N is "chain position N" across all chains.
  //
  // Bob's view (own ER): x = COL_OWN_EVAL_eff + chainPos * ER_COL_SPACING
  //   (origin near Asset, Latest toward Claim).
  // Alice's view (proof-of-eval pulled ER): mirrored —
  //   effectivePos = (chainLength-1) - chainPos
  //   (Latest at COL_OWN_EVAL_eff close to Claim; origin farther right).
  const claimById = new Map(view.claims.map((c) => [c.id, c]))

  // Phase 16.2.2: y-anchor each evaluation CHAIN (one row per chain origin)
  // to its evaluator's grantee Asset on canvas (`EA.granteeAssetId`). Chains
  // sharing the same anchor Asset stack downward by ROW_STEP. Falls back to
  // symmetric distribution when the anchor Asset isn't on canvas (e.g.,
  // proof-only-pulled flows or future provisional ERs). Chain successors
  // (re-runs) share the y of their chain origin so the chain reads as a
  // single horizontal row, not a column of staggered rows.
  //
  // Architectural deviation surfaced for the prototype's actual seed:
  // both of Bob's evaluations (PRM + VReg) carry `granteeAssetId: bAvionics`,
  // so they share the same anchor Asset and stack — they do not split onto
  // bAvionics vs bThermal rows as the brief's example suggested. Aligning
  // strictly to "respective grantee Asset" is impossible when two distinct
  // chains share an anchor; stacking is the deterministic fallback.
  const eaById = new Map((view.evaluationAgreements || []).map((ea) => [ea.id, ea]))
  const assetNodeById = new Map(
    nodes.filter((n) => n.v22Type === 'ASSET').map((n) => [n.id, n])
  )
  // Phase 16.2.11: chain anchor lookup also consults the evaluated Claim
  // node. On grantor-direction views (e.g., Alice's), the EA's
  // granteeAssetId names the evaluator's Asset (Bob's `bAvionics`,
  // Carol's `cAuditWorkspace`) which often isn't on the active actor's
  // canvas — Phase 16.2.2's grantee-Asset-only anchor then fell through
  // to the pass-2 symmetric fallback and chains scattered. The Claim is
  // always on canvas when its chain is, so anchoring to Claim y first
  // keeps "for each Claim, its chain" visually adjacent regardless of
  // who's evaluating.
  const claimNodeForChainAnchor = new Map(
    nodes.filter((n) => n.v22Type === 'CLAIM').map((n) => [n.id, n])
  )
  const orderedErsForY = [...erOwn, ...erProofOfEval]
  const seenOrigins = new Set()
  const orderedOrigins = []
  for (const er of orderedErsForY) {
    const origin = chainOriginByErId.get(er.id)
    if (!seenOrigins.has(origin)) {
      seenOrigins.add(origin)
      orderedOrigins.push(origin)
    }
  }
  // Phase 16.2.11: anchor identity is the evaluated Claim's id (was
  // granteeAssetId in Phase 16.2.2). This shifts pass 1's "one chain
  // per anchor group" semantics from "one chain per evaluator-Asset"
  // to "one chain per evaluated Claim" — exactly the per-Claim y-band
  // rule the brief calls for. Falls back to granteeAssetId for any edge
  // case where the Claim isn't on canvas (defensive — shouldn't happen
  // for chains that ARE on canvas; an ER's claimId always points to a
  // visible Claim for the chain to exist on the active actor's view).
  const anchorIdForOrigin = (originId) => {
    const er = erIdToErArtifact.get(originId)
    if (!er) return null
    if (claimNodeForChainAnchor.has(er.claimId)) return er.claimId
    const ea = eaById.get(er.evaluationAgreementId)
    return ea?.granteeAssetId ?? null
  }
  // Phase 16.2.11: anchor y reads the evaluated Claim's y first; falls
  // back to the EA's granteeAssetId Asset y when the Claim isn't on
  // canvas (defensive). Together with the anchorId change above, this
  // produces the per-Claim y-band: each Claim's first chain claims the
  // Claim's exact y in pass 1; additional chains for the same Claim
  // (rare — e.g., two evaluators evaluating one Claim) get the nearest
  // free y via pass 2's symmetric outward search. Bob's view is
  // unaffected because pulled Claims at symmetricRowY(i) coincide with
  // his owned Assets at symmetricRowY(i); Alice's view chains now
  // cluster near the evaluated Claim instead of scattering.
  const anchorYForOrigin = (originId) => {
    const er = erIdToErArtifact.get(originId)
    const claimNode = er ? claimNodeForChainAnchor.get(er.claimId) : null
    if (claimNode) return claimNode.y
    const ea = er ? eaById.get(er.evaluationAgreementId) : null
    const fallbackAssetId = ea?.granteeAssetId
    const asset = fallbackAssetId ? assetNodeById.get(fallbackAssetId) : null
    return asset ? asset.y : Number.POSITIVE_INFINITY
  }
  // Sort origins by anchor-asset y (then by origin id for stability) so
  // pass 1 processes anchor groups in top-down order.
  orderedOrigins.sort((a, b) => {
    const yA = anchorYForOrigin(a)
    const yB = anchorYForOrigin(b)
    if (yA !== yB) return yA - yB
    return a < b ? -1 : 1
  })
  const chainYByOriginId = new Map()
  const usedErYs = new Set()
  // Pass 1: the FIRST chain at each anchor Asset claims that anchor's y,
  // so the visual association between chain row and grantee Asset is
  // exact when possible. Chains whose anchor is missing or whose anchor.y
  // is already claimed by a prior pass-1 row get deferred to pass 2.
  const seenAnchors = new Set()
  const deferred = []
  for (const origin of orderedOrigins) {
    const anchorId = anchorIdForOrigin(origin)
    const anchorY = anchorYForOrigin(origin)
    if (anchorId && !seenAnchors.has(anchorId) && Number.isFinite(anchorY) && !usedErYs.has(anchorY)) {
      seenAnchors.add(anchorId)
      usedErYs.add(anchorY)
      chainYByOriginId.set(origin, anchorY)
      continue
    }
    deferred.push(origin)
  }
  // Pass 2: deferred chains pick the nearest non-colliding y to their
  // anchor (symmetric search outward: +ROW_STEP, -ROW_STEP, +2*ROW_STEP,
  // ...). When the anchor Asset isn't on canvas (e.g., proof-only-pulled
  // flows where the grantee Asset isn't visible to the active actor),
  // fall back to symmetric distribution with COL_Y_OFFSET.
  let fallbackIdx = 0
  for (const origin of deferred) {
    const anchorY = anchorYForOrigin(origin)
    const baseY = Number.isFinite(anchorY)
      ? anchorY
      : symmetricRowY(fallbackIdx++) + COL_Y_OFFSET
    let y = baseY
    let step = 1
    while (usedErYs.has(y)) {
      const offset = Math.ceil(step / 2) * ROW_STEP
      y = baseY + (step % 2 === 1 ? offset : -offset)
      step++
    }
    usedErYs.add(y)
    chainYByOriginId.set(origin, y)
  }
  const yForEr = (er) => {
    const origin = chainOriginByErId.get(er.id)
    const y = chainYByOriginId.get(origin)
    return typeof y === 'number' ? y : 0
  }

  // Bob's view (own ERs): chain reads left-to-right toward Claim. x grows
  // with chainPosition.
  erOwn.forEach((er) => {
    const chainPos = chainPositionByErId.get(er.id) || 0
    const x = COL_OWN_EVAL_eff + chainPos * ER_COL_SPACING
    nodes.push(evalResultToNode(er, x, yForEr(er), claimById.get(er.claimId)))
  })
  // Alice's view (proof-of-eval pulled ERs): chain reads right-to-left
  // (Latest closest to Claim). effectivePos mirrors chainPosition.
  erProofOfEval.forEach((er) => {
    const chainPos = chainPositionByErId.get(er.id) || 0
    const len = chainLengthForEr(er)
    const effectivePos = (len - 1) - chainPos
    const x = COL_OWN_EVAL_eff + effectivePos * ER_COL_SPACING
    nodes.push(evalResultToNode(er, x, yForEr(er), claimById.get(er.claimId)))
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
      nodes.push(evalResultToNode(er, COL_PULLED_EVAL_eff, stackIdx * ROW_STEP, claimById.get(er.claimId)))
      return
    }
    const x = sourceClaim.x + 200
    const y = sourceClaim.y + 300 + (stackIdx * COL_Y_OFFSET)
    nodes.push(evalResultToNode(er, x, y, claimById.get(er.claimId)))
  })

  // Phase 13 (#168): PoE node placement.
  //   • Owned PoEs (the actor is the wrapping evaluator) go in the dedicated
  //     PoE column to the right of own Eval Results, vertically anchored to
  //     the centroid of the wrapped Eval Results' y positions so the wrap
  //     edges read cleanly.
  //   • Counterparty (proof-only-pulled) PoEs hang next to their source
  //     Claim, mirroring the proof-only-pulled Eval Result placement so the
  //     wrap edges between PoE and pulled Eval Result(s) stay short.
  const allViewPoEs = view.proofsOfEvaluation || []
  const proofOnlyPulledPoeIds = view.proofOnlyPulledPoeIds || new Set()
  const ownedPoEs = allViewPoEs.filter((p) => p.owner === actor.party)
  const proofOnlyPulledPoEs = allViewPoEs.filter((p) => proofOnlyPulledPoeIds.has(p.id))
  // Phase 13.1 (#168a): proof-of-evaluation pulled PoEs — counterparty PoEs
  // disclosed via a proof-of-eval DA (subject.kind='poe') where the actor
  // is the Claim owner. These belong on the actor's canvas next to their
  // own Claim, mirroring how the wrapped Eval Result was placed previously
  // (the same column as proof-of-eval ERs, just shifted further right).
  const proofOfEvalPulledPoEs = allViewPoEs.filter((p) =>
    p.owner !== actor.party && !proofOnlyPulledPoeIds.has(p.id),
  )
  const evalNodeById = new Map(nodes.filter((n) => n.v22Type === 'EVAL RESULT').map((n) => [n.id, n]))
  // Phase 13.3 (Step 4): PoE placement is chain-position-aware.
  //   • Owned PoE (Bob's PoE on Bob's canvas): one column right of latest
  //     ER, i.e. x = COL_OWN_EVAL_eff + chainLength * ER_COL_SPACING.
  //   • Pulled PoE (Bob's PoE on Alice's canvas): inserts between the
  //     Claim and Latest. Latest is at COL_OWN_EVAL_eff (mirrored); PoE
  //     sits one ER_COL_SPACING column to its LEFT toward the Claim.
  //   • If the PoE has no chain anchor (wrappedER not on canvas), fall
  //     back to COL_OWN_POE_eff (the standard PoE column).
  ownedPoEs.forEach((poe, i) => {
    const wrapped = poe.wrappedEvalResultId ? erIdToErArtifact.get(poe.wrappedEvalResultId) : null
    const wrappedY = evalNodeById.get(poe.wrappedEvalResultId)?.y
    const y = typeof wrappedY === 'number'
      ? wrappedY
      : symmetricRowY(i) + COL_Y_OFFSET
    let x
    if (wrapped) {
      const len = chainLengthForEr(wrapped)
      x = COL_OWN_EVAL_eff + len * ER_COL_SPACING
    } else {
      x = COL_OWN_POE_eff
    }
    nodes.push(poeToNode(poe, x, y, view.evaluationResults))
  })
  proofOfEvalPulledPoEs.forEach((poe, i) => {
    const wrapped = poe.wrappedEvalResultId ? erIdToErArtifact.get(poe.wrappedEvalResultId) : null
    const wrappedY = evalNodeById.get(poe.wrappedEvalResultId)?.y
    const y = typeof wrappedY === 'number'
      ? wrappedY
      : symmetricRowY(ownedPoEs.length + i) + COL_Y_OFFSET
    let x
    if (wrapped) {
      // Phase 16.2.2: on the Claim owner's canvas (grantor-direction),
      // the column order reads Claim → Eval Result → PoE → counterparty
      // Asset. Previously this code placed the PoE to the LEFT of the
      // Eval Result (between Claim and ER), producing a tight 100-unit
      // gap to the Claim that read as visual overlap. The PoE now sits
      // ONE ER_COL_SPACING to the RIGHT of Latest, matching the
      // grantee-direction layout's "PoE downstream of ER" semantics and
      // restoring the ≥240-unit minimum gap to the Claim.
      x = COL_OWN_EVAL_eff + ER_COL_SPACING
    } else {
      x = COL_OWN_POE_eff
    }
    nodes.push(poeToNode(poe, x, y, view.evaluationResults))
  })
  // Counterparty (proof-only-pulled) PoEs: anchor next to the source Claim
  // similar to the proof-only-pulled Eval Result placement, but offset
  // further so the PoE node sits between Claim and its pulled wrapped
  // Eval Results.
  const poePulledPerClaim = new Map()
  proofOnlyPulledPoEs.forEach((poe) => {
    const sourceClaim = claimNodeById.get(poe.claimId)
    const stackIdx = poePulledPerClaim.get(poe.claimId) || 0
    poePulledPerClaim.set(poe.claimId, stackIdx + 1)
    if (!sourceClaim) {
      nodes.push(poeToNode(poe, COL_OWN_POE_eff, stackIdx * ROW_STEP, view.evaluationResults))
      return
    }
    const x = sourceClaim.x + 400
    // Phase 16.2.2: inherit y from the wrapped Eval Result when on canvas
    // so PoE + wrapped ER share a chain row (matches the brief's
    // "ER + PoE on the same y-row" rule for grantee-direction views).
    // Falls back to the legacy sourceClaim.y + offset pattern when the
    // wrapped ER isn't visible on this canvas.
    const wrappedErY = evalNodeById.get(poe.wrappedEvalResultId)?.y
    const y = typeof wrappedErY === 'number'
      ? wrappedErY
      : sourceClaim.y + 200 + (stackIdx * COL_Y_OFFSET)
    nodes.push(poeToNode(poe, x, y, view.evaluationResults))
  })

  // ── Edges ────────────────────────────────────────────────────────────
  const edges = deriveAgreementEdges(view)

  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  return { nodes, edges, nodeMap }
}
