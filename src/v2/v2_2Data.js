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
 * and public-directory disclosures; what differs is grantor/grantee/scope — see §4.1.
 */
export function makeDisclosureAgreement({
  id,
  grantor,
  grantee,
  claimId,
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
  if (!claimId) throw new Error('makeDisclosureAgreement: claimId is required')
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
    claimId,
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
 * Models Actor → Asset, Actor → Claim, and Claim → referenced-Asset relationships.
 * Rendered as a Full Disclosure edge; its Detail Panel reads "Internal — {party} to {party}".
 */
export function makeInternalDisclosureAgreement({
  id,
  owner,
  ownerDot,
  claimId,
  scope = {},
  terms = {},
}) {
  const party = owner
  const dot = ownerDot || makeDot(owner)
  return makeDisclosureAgreement({
    id,
    grantor: { party, dot },
    grantee: { party, dot },
    claimId,
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
 * (grantee), scoped to a single Eval Result. See spec §4.1 bullet 2.
 */
export function makeProofOfEvalDisclosureAgreement({
  id,
  evaluator,
  evaluatorDot,
  claimOwner,
  claimOwnerDot,
  claimId,
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
    claimId,
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
 * No paired Evaluation Agreement; the directory is a publishing channel only.
 */
export function makePublicDirectoryDisclosureAgreement({
  id,
  grantor,
  grantorDot,
  claimId,
  type,
  scope = {},
  terms = {},
}) {
  return makeDisclosureAgreement({
    id,
    grantor: { party: grantor, dot: grantorDot || makeDot(grantor) },
    grantee: { party: RADIANT_NETWORK_PARTY, dot: RADIANT_NETWORK_DOT },
    claimId,
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
      claimId: a.id,
      scope: { assetIds: [a.id] },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const bobOwnAssets = [bAvionics].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: bob.party,
      ownerDot: bob.partyDot,
      claimId: a.id,
      scope: { assetIds: [a.id] },
      terms: { createdDate: a.registrationDate },
    }),
  )
  const carolOwnAssets = [cAuditWorkspace].map((a) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${a.id}`,
      owner: carol.party,
      ownerDot: carol.partyDot,
      claimId: a.id,
      scope: { assetIds: [a.id] },
      terms: { createdDate: a.registrationDate },
    }),
  )

  // Actor → each of their Claims (Full, implicit).
  const aliceOwnClaims = claims.map((c) =>
    makeInternalDisclosureAgreement({
      id: `da-own-${c.id}`,
      owner: alice.party,
      ownerDot: alice.partyDot,
      claimId: c.id,
      scope: {},
      terms: { createdDate: c.createdDate },
    }),
  )

  // Claim → each referenced Asset (Full, implicit) — one DA per (claim, asset) pair.
  const claimRefEdges = claims.flatMap((claim) =>
    claim.referencedAssetIds.map((assetId) =>
      makeInternalDisclosureAgreement({
        id: `da-ref-${claim.id}-${assetId}`,
        owner: claim.owner,
        ownerDot: claim.ownerDot,
        claimId: claim.id,
        scope: { assetIds: [assetId], includeDerivatives: true },
        terms: { createdDate: claim.createdDate },
      }),
    ),
  )

  // Explicit inter-party Disclosure Agreements.
  const daAliceToBobPrm = makeDisclosureAgreement({
    id: 'da-alice-bob-prm',
    grantor: { party: alice.party, dot: alice.partyDot },
    grantee: { party: bob.party, dot: bob.partyDot },
    claimId: cPrm.id,
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
    claimId: cVreg.id,
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
    claimId: cPrm.id,
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

  // Public-directory disclosures (Alice publishes to Radiant Network).
  const daAlicePublicPrm = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-prm',
    grantor: alice.party,
    grantorDot: alice.partyDot,
    claimId: cPrm.id,
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
    claimId: cVreg.id,
    type: 'full',
    scope: { assetIds: [aVregDatasheet.id], includeDerivatives: true },
    terms: { createdDate: '2026-02-01T17:22:00Z' },
  })
  const daAlicePublicEmi = makePublicDirectoryDisclosureAgreement({
    id: 'da-pub-emi',
    grantor: alice.party,
    grantorDot: alice.partyDot,
    claimId: cEmi.id,
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
  const daProofBobPrm = makeProofOfEvalDisclosureAgreement({
    id: 'da-proof-bob-prm',
    evaluator: bob.party,
    evaluatorDot: bob.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    claimId: cPrm.id,
    evaluationResultId: erBobPrm.id,
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daProofCarolPrm = makeProofOfEvalDisclosureAgreement({
    id: 'da-proof-carol-prm',
    evaluator: carol.party,
    evaluatorDot: carol.partyDot,
    claimOwner: alice.party,
    claimOwnerDot: alice.partyDot,
    claimId: cPrm.id,
    evaluationResultId: erCarolPrm.id,
    terms: { createdDate: erCarolPrm.evaluationDate },
  })

  // Ownership edges for each Eval Result → evaluator's own Asset (spec §3.5).
  const daOwnEvalBob = makeInternalDisclosureAgreement({
    id: `da-own-${erBobPrm.id}`,
    owner: bob.party,
    ownerDot: bob.partyDot,
    claimId: erBobPrm.id,
    scope: {
      evaluationResultIds: [erBobPrm.id],
      assetIds: [bAvionics.id],
    },
    terms: { createdDate: erBobPrm.evaluationDate },
  })
  const daOwnEvalCarol = makeInternalDisclosureAgreement({
    id: `da-own-${erCarolPrm.id}`,
    owner: carol.party,
    ownerDot: carol.partyDot,
    claimId: erCarolPrm.id,
    scope: {
      evaluationResultIds: [erCarolPrm.id],
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
// VIEW BUILDERS
// ═══════════════════════════════════════════════════════════════════════════
//
// Phase 1 stubs: each view builder returns the full shared artifact set plus
// the active actor. Role-specific filtering lands in Phase 2 per spec §6.

/** Alice's view — MicroCo (seller / claim-maker). Phase 2 narrows per §6.1. */
export function buildAliceView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return {
    actor: src.actors.find((a) => a.id === 'alice-microco'),
    shared: src,
  }
}

/** Bob's view — GovCo (buyer / evaluator). Phase 2 narrows per §6.2. */
export function buildBobView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return {
    actor: src.actors.find((a) => a.id === 'bob-govco'),
    shared: src,
  }
}

/** Carol's view — AuditCo (auditor). Phase 2 narrows per §6.3. */
export function buildCarolView(shared) {
  const src = shared || buildV22SharedArtifacts()
  return {
    actor: src.actors.find((a) => a.id === 'carol-auditco'),
    shared: src,
  }
}

/**
 * Role dispatcher. Used by V2App when V2_2_ENABLED is true. Phase 1 is a
 * pass-through for future rendering paths; nothing consumes it yet.
 */
export function getV22DataForRole(roleId) {
  const shared = buildV22SharedArtifacts()
  if (roleId === 'alice-microco') return buildAliceView(shared)
  if (roleId === 'carol-auditco') return buildCarolView(shared)
  return buildBobView(shared)
}
