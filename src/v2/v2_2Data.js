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

// ─── Feature flag ──────────────────────────────────────────────────────────
// Top-level constant with optional env override (VITE_V2_2_ENABLED=true).
// Flip FORCE_V2_2 locally to verify V2.2 mode without configuring env.
const FORCE_V2_2 = false
const ENV_V2_2 =
  typeof import.meta !== 'undefined' && import.meta && import.meta.env
    ? import.meta.env.VITE_V2_2_ENABLED === 'true'
    : false
export const V2_2_ENABLED = FORCE_V2_2 || ENV_V2_2

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

/** Asset artifact — spec §10.1. */
export function makeAsset({
  id,
  owner,
  ownerDot,
  name,
  description = '',
  file,
  registrationDate,
  parseResultIds = [],
}) {
  if (!id) throw new Error('makeAsset: id is required')
  if (!owner) throw new Error('makeAsset: owner is required')
  if (!file || !file.uri || !file.filename) {
    throw new Error('makeAsset: file { uri, filename } is required')
  }
  return {
    artifactType: 'asset',
    artifactUri: assetUri(id),
    id,
    pin: makePin(id),
    owner,
    ownerDot: ownerDot || makeDot(owner),
    name,
    description,
    file: {
      uri: file.uri,
      filename: file.filename,
      size: file.size ?? null,
      mimeType: file.mimeType ?? null,
      hash: file.hash ?? null,
    },
    registrationDate,
    parseResultIds: [...parseResultIds],
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
  createdDate,
  amendments = [],
}) {
  if (!id) throw new Error('makeClaim: id is required')
  if (!owner) throw new Error('makeClaim: owner is required')
  return {
    artifactType: 'claim',
    artifactUri: claimUri(id),
    id,
    pin: makePin(id),
    owner,
    ownerDot: ownerDot || makeDot(owner),
    name,
    description,
    referencedAssetIds: [...referencedAssetIds],
    createdDate,
    amendments: amendments.map((a) => ({
      date: a.date,
      added: [...(a.added || [])],
      removed: [...(a.removed || [])],
    })),
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
  restrictions = {},
  terms = {},
  incentives = {},
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
    },
    incentives: {
      onSatisfactory: incentives.onSatisfactory ?? null,
      onUnsatisfactory: incentives.onUnsatisfactory ?? null,
    },
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
  return {
    artifactType: 'evaluationResult',
    artifactUri: evaluationResultUri(id),
    id,
    pin: makePin(id),
    owner,
    ownerDot: ownerDot || makeDot(owner),
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
    })),
    evidenceUsed: [...evidenceUsed],
    evaluationDate,
    status, // 'active' | 'superseded'
    supersededBy,
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
    },
    registrationDate: '2026-02-08T13:41:00Z',
    parseResultIds: ['parse-emi-datasheet'],
  })

  // ── Bob's Asset ───────────────────────────────────────────────────────
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

  // ── Carol's Asset ─────────────────────────────────────────────────────
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

  const assets = [
    aPrmDatasheet,
    aPrmTestReport,
    aPrmThermal,
    aVregDatasheet,
    aEmiDatasheet,
    bAvionics,
    cAuditWorkspace,
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
  const parseResults = [prPrmDatasheet, prVregDatasheet, prEmiDatasheet]

  // ── Alice's Claims ────────────────────────────────────────────────────
  const cPrm = makeClaim({
    id: 'claim-prm-assembly',
    owner: alice.party,
    ownerDot: alice.partyDot,
    name: 'Power Regulation Module Assembly',
    description: 'Certified assembly backed by datasheet, test report, and thermal analysis.',
    referencedAssetIds: [aPrmDatasheet.id, aPrmTestReport.id, aPrmThermal.id],
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
  const claims = [cPrm, cVreg, cEmi]

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
  const bobOwnAssets = [bAvionics].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: bob.party,
      ownerDot: bob.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const carolOwnAssets = [cAuditWorkspace].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: carol.party,
      ownerDot: carol.partyDot,
      subject: { kind: 'asset', id: a.id },
      terms: { createdDate: a.registrationDate },
    }),
  )

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
    ...aliceOwnClaims,
    ...claimRefEdges,
    daAliceToBobPrm,
    daAliceToBobVreg,
    daAliceToCarolPrm,
    daAlicePublicPrm,
    daAlicePublicVreg,
    daAlicePublicEmi,
    daProofBobPrm,
    daProofCarolPrm,
    daOwnEvalBob,
    daOwnEvalCarol,
  ]

  return {
    actors: [bob, alice, carol, RADIANT_NETWORK_ACTOR],
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
  const ownedEvaluationResults = shared.evaluationResults.filter((e) => e.owner === party)

  // Disclosure Agreements where this actor is grantor or grantee.
  // Counterparty internal DAs are included only if *both* endpoints are visible on
  // this actor's canvas (see the second-pass loop after visibility is resolved). This
  // handles e.g. Carol's Eval-Result ownership edge on Alice's canvas — Carol owns
  // the Eval Result and her AuditCo Workspace, both already pulled onto Alice's
  // canvas via Proof-of-Evaluation + §6.1 grantee anchor, so the ownership edge
  // between them renders from the pre-existing DA rather than requiring a pulled-in
  // Carol Actor node (which would conflict with §6.4's "counterparty internals are
  // private" principle).
  const partyDisclosureAgreements = shared.disclosureAgreements.filter(
    (d) => d.grantor.party === party || d.grantee.party === party,
  )
  const disclosureAgreements = [...partyDisclosureAgreements]

  // Evaluation Agreements where this actor is grantor or grantee.
  const evaluationAgreements = shared.evaluationAgreements.filter(
    (e) => e.grantor.party === party || e.grantee.party === party,
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
  const pulledInClaims = shared.claims.filter(
    (c) => c.owner !== party && pulledInClaimIds.has(c.id),
  )

  // Eval Results visible: those the actor owns, plus those with a Proof-of-Evaluation
  // Disclosure Agreement where the actor is the grantee (claim owner seeing
  // evaluator's result).
  const proofDaEvalResultIds = new Set()
  for (const da of disclosureAgreements) {
    if (da.subject.kind !== 'evalResult') continue
    // Proof-of-eval: grantee is the claim owner receiving the result.
    if (da.grantee.party === party && da.grantor.party !== party) {
      proofDaEvalResultIds.add(da.subject.id)
    }
  }
  const visibleEvaluationResults = shared.evaluationResults.filter(
    (e) => e.owner === party || proofDaEvalResultIds.has(e.id),
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
  const pulledInAssetIds = new Set()
  for (const da of disclosureAgreements) {
    // Only when this actor is grantor and there's an explicit grantee-side anchor.
    if (da.grantor.party !== party) continue
    if (da.grantee.party === party) continue // skip internal
    if (da.grantee.party === RADIANT_NETWORK_PARTY) continue // directory has no asset anchor
    if (!da.granteeAssetId) continue
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

  return {
    actor,
    actors,
    assets: visibleAssets,
    ownedAssetIds: new Set(ownedAssets.map((a) => a.id)),
    parseResults: visibleParseResults,
    claims: visibleClaims,
    ownedClaimIds: new Set(ownedClaims.map((c) => c.id)),
    disclosureAgreements,
    evaluationAgreements,
    evaluationResults: visibleEvaluationResults,
    pairedDaIds,
    pulledInClaimIds,
    pulledInAssetIds,
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

/**
 * Role dispatcher. Used by V2App when V2_2_ENABLED is true.
 */
export function getV22DataForRole(roleId) {
  const shared = buildV22SharedArtifacts()
  if (roleId === 'alice-microco') return buildAliceView(shared)
  if (roleId === 'carol-auditco') return buildCarolView(shared)
  return buildBobView(shared)
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
  const actorPartyInView = new Set(view.actors.map((a) => a.party))
  const evalResultById = new Map(view.evaluationResults.map((e) => [e.id, e]))

  const daByEvalAgreementId = new Map()
  for (const ea of view.evaluationAgreements) {
    daByEvalAgreementId.set(ea.disclosureAgreementId, ea)
  }

  const isRenderable = (nodeId) =>
    nodeId === RADIANT_NETWORK_ACTOR.id ||
    nodeId.startsWith(ACTOR_NODE_ID_PREFIX) ||
    visibleAssetIds.has(nodeId) ||
    visibleClaimIds.has(nodeId) ||
    visibleEvalIds.has(nodeId)

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
    })
  }

  for (const da of view.disclosureAgreements) {
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
      // Actor → Asset ownership.
      pushEdge(grantorActorId, id, da)
      continue
    }
    if (kind === 'claim' && internal && !hasScopeAssets) {
      // Actor → Claim ownership.
      pushEdge(grantorActorId, id, da)
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
    // Anything else: silently skip. Phase 3 may introduce additional variants.
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
const COL_ACTOR = 0
const COL_OWN_ASSET = 520
const COL_OWN_PARSE = 900
const COL_OWN_CLAIM = 1300
const COL_OWN_EVAL = 1700
const COL_PULLED_CLAIM = 2100
const COL_PULLED_ASSET = 2500
const COL_PUBLIC = 2900
const ROW_STEP = 260

/**
 * Compute evaluation-result health rollup for a Claim: counts satisfactory,
 * warn (unused), and unsatisfactory rows across all non-superseded Eval Results
 * targeting that Claim. N/A rows excluded per spec §3.5.
 */
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
    v22Type: isSuperseded ? 'EVAL RESULT (SUPERSEDED)' : 'EVAL RESULT',
    v22Artifact: er,
  }
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
  if (view.actors.some((a) => a.id === RADIANT_NETWORK_ACTOR.id)) {
    nodes.push(actorToNode(RADIANT_NETWORK_ACTOR, COL_PUBLIC, 0))
  }

  // ── Owned Assets (column 1) ──────────────────────────────────────────
  const ownedAssets = view.assets.filter((a) => view.ownedAssetIds.has(a.id))
  const pulledAssets = view.assets.filter((a) => !view.ownedAssetIds.has(a.id))
  ownedAssets.forEach((asset, i) => {
    nodes.push(assetToNode(asset, COL_OWN_ASSET, i * ROW_STEP))
  })

  // ── Owned Parse Results (column 2) aligned with their source asset ───
  const assetRowIndex = new Map(ownedAssets.map((a, i) => [a.id, i]))
  // Multiple Parse Results on one Asset stack with small vertical offsets.
  const parseSlotByAsset = new Map()
  view.parseResults.forEach((pr) => {
    const baseIdx = assetRowIndex.get(pr.sourceAssetId)
    const slot = parseSlotByAsset.get(pr.sourceAssetId) || 0
    parseSlotByAsset.set(pr.sourceAssetId, slot + 1)
    const y = (baseIdx != null ? baseIdx * ROW_STEP : 0) + slot * 80
    nodes.push(parseResultToNode(pr, COL_OWN_PARSE, y))
  })

  // ── Claims (owned column 3; pulled-in column 5) ──────────────────────
  const ownedClaims = view.claims.filter((c) => view.ownedClaimIds.has(c.id))
  const pulledClaims = view.claims.filter((c) => !view.ownedClaimIds.has(c.id))
  ownedClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    nodes.push(claimToNode(claim, rollup, COL_OWN_CLAIM, i * ROW_STEP))
  })
  pulledClaims.forEach((claim, i) => {
    const rollup = rollupClaimHealth(claim.id, view.evaluationResults)
    nodes.push(claimToNode(claim, rollup, COL_PULLED_CLAIM, i * ROW_STEP))
  })

  // ── Pulled-in counterparty Assets (column 6) ────────────────────────
  pulledAssets.forEach((asset, i) => {
    nodes.push(assetToNode(asset, COL_PULLED_ASSET, i * ROW_STEP))
  })

  // ── Evaluation Results (column 4) ────────────────────────────────────
  // Owned Eval Results first, then proof-of-eval-visible ones from other parties.
  const erOwn = view.evaluationResults.filter((e) => e.owner === actor.party)
  const erExternal = view.evaluationResults.filter((e) => e.owner !== actor.party)
  erOwn.forEach((er, i) => {
    nodes.push(evalResultToNode(er, COL_OWN_EVAL, i * ROW_STEP))
  })
  erExternal.forEach((er, i) => {
    nodes.push(evalResultToNode(er, COL_OWN_EVAL, (erOwn.length + i) * ROW_STEP + 80))
  })

  // ── Edges ────────────────────────────────────────────────────────────
  const edges = deriveAgreementEdges(view)

  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  return { nodes, edges, nodeMap }
}
