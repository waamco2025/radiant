// v2 Data Layer — Role-aware datasets for Bob@GovCo and Alice@MicroCo

// ── PIN / DOT generation ──

function hashStr(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function makePin(seed) {
  let hex = ''
  for (let i = 0; i < 8; i++) {
    const h = hashStr('pin-' + seed + '-' + i)
    hex += (h >>> 0).toString(16).padStart(8, '0')
  }
  return `PIN-0x${hex}`
}

function makeDot(seed) {
  let hex = ''
  for (let i = 0; i < 8; i++) {
    const h = hashStr('dot-' + seed + '-' + i)
    hex += (h >>> 0).toString(16).padStart(8, '0')
  }
  return `DOT-0x${hex}`
}

// Globe icon paths for public directory nodes
export const GLOBE_ICON_PATHS = {
  circle: 'M8 1a7 7 0 100 14A7 7 0 008 1z',
  meridian: 'M8 1c-2.2 0-4 3.13-4 7s1.8 7 4 7 4-3.13 4-7-1.8-7-4-7z',
  equator: 'M1 8h14',
}

// ── Roles ──

const GOVCO_DOT = makeDot('GovCo')
const MICROCO_DOT = makeDot('MicroCo')

export const ROLES = [
  {
    id: 'bob-govco',
    user: 'Bob',
    party: 'GovCo',
    partyDot: GOVCO_DOT,
    role: 'buyer',
    credits: 2400,
    vertical: 'Government / Satellite',
  },
  {
    id: 'alice-microco',
    user: 'Alice',
    party: 'MicroCo',
    partyDot: MICROCO_DOT,
    role: 'seller',
    credits: 2400,
    vertical: 'Electronics',
  },
]


// ══════════════════════════════════════════════════════════════
// SHARED EVALUATIONS
// ══════════════════════════════════════════════════════════════

const EVAL_POWER_REG_BOB = {
  id: 'eval-001',
  org: 'GovCo',
  orgDot: GOVCO_DOT,
  date: '2026-03-08',
  requirements: 'MIL-PRF-55681 Compliance',
  status: 'completed',
  creditsUsed: 50,
  reviewer: 'Bob Chen',
  reviewDate: '2026-03-09',
  claims: [
    { requirement: 'Power output stability', output: '3.3V ±0.5% under load', type: 'inferred', status: 'verified' },
    { requirement: 'Thermal dissipation', output: '< 2W at rated current', type: 'inferred', status: 'verified' },
    { requirement: 'Operating temp range', output: '-55°C to +125°C', type: 'inferred', status: 'verified' },
    { requirement: 'Radiation tolerance', output: 'TID > 100 krad(Si)', type: 'inferred', status: 'failed' },
    { requirement: 'ITAR compliance', output: 'Category XV, §121.1', type: 'inferred', status: 'verified' },
  ],
}

// ══════════════════════════════════════════════════════════════
// SHARED SDAs
// ══════════════════════════════════════════════════════════════

// Alice disclosed Power Reg to Bob (selective)
const SDA_POWER_REG_TO_GOVCO = {
  type: 'selective',
  party: 'GovCo',
  partyDot: GOVCO_DOT,
  created: '2026-03-01',
  createdTime: '14:15 UTC',
  expires: '2027-03-01',
  expiresTime: '14:15 UTC',
  pins: [],
  assetName: null,
  assetPin: null,
}

// VReg IC fully disclosed to GovCo — Bob has full access
const SDA_VREG_TO_GOVCO = {
  type: 'full',
  party: 'GovCo',
  partyDot: GOVCO_DOT,
  created: '2026-03-04',
  createdTime: '16:42 UTC',
  expires: '2027-03-04',
  expiresTime: '16:42 UTC',
  pins: [],
  assetName: null,
  assetPin: null,
}

// Alice's internal full disclosure (owner access)
const SDA_INTERNAL_MICROCO = {
  type: 'full',
  party: 'MicroCo',
  partyLabel: 'internal',
  partyDot: MICROCO_DOT,
  created: '2025-01-01',
  createdTime: '09:00 UTC',
  expires: null,
  pins: [],
  assetName: null,
  assetPin: null,
}

// Bob's full disclosure for his own internal assets
const SDA_INTERNAL_GOVCO = {
  type: 'full',
  party: 'GovCo',
  partyLabel: 'internal',
  partyDot: GOVCO_DOT,
  created: '2025-06-01',
  createdTime: '13:30 UTC',
  expires: null,
  pins: [],
  assetName: null,
  assetPin: null,
}

// ── Radiant Network (public directory) ──

const RADIANT_NETWORK_PIN = makePin('radiant-network')
const RADIANT_NETWORK_DOT = makeDot('Radiant Network')

function addChildrenToMap(nodes, map) {
  for (const node of nodes) {
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        map[child.id] = child
        addChildrenToMap([child], map)
      }
    }
  }
}

function makeEvidence(nodeId, prefix, provider, retention) {
  const h = hashStr(nodeId).toString(16).padStart(8, '0')
  const h2 = hashStr(nodeId + '-hash').toString(16).padStart(16, '0')
  const day = 10 + (hashStr(nodeId + '-blk') % 18)
  const blkH = hashStr(nodeId + '-blk').toString(16).slice(0, 4)
  return {
    filename: `${prefix}-${h.slice(0, 8)}.pdf`,
    hash: `sha256:${h2}`,
    block: `BLK-2025-11-${String(day).padStart(2, '0')}-0x${blkH}`,
    provider,
    uri: `provenance://evidence/${prefix}-${h.slice(0, 8)}`,
    retention,
  }
}

function makeEvidenceNode(parentId, evidenceMeta, owner, claims = [], uniqueId = null) {
  const fileSlug = evidenceMeta.filename.split('.')[0].toLowerCase().replace(/[^a-z0-9]/g, '-')
  const evId = uniqueId || `ev-${parentId}-${fileSlug}`

  const health = { ok: 0, warn: 0, bad: 0 }
  for (const c of claims) {
    if (c.status === 'verified') health.ok++
    else health.bad++
  }

  const pin = makePin(evId)
  const dot = owner ? makeDot(owner) : makeDot(evId)

  return {
    id: evId,
    pin,
    dot,
    name: evidenceMeta.filename,
    category: 'evidence',
    owner,
    parentId,
    children: [],
    health,
    childHealth: null,
    totalHealth: null,
    displayHealth: health,
    claimCount: health.ok + health.bad,
    hasEvidence: true,
    hasStack: false,
    childCount: 0,
    evidence: evidenceMeta,
    evaluations: [],
    sdas: [],
    x: 0,
    y: 0,
    parentOwner: owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: true,
    lastEval: null,
    attributedClaims: claims,
    artifactUri: evidenceMeta.uri,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
  }
}

// ── PEP Parse Node builder ──

function makePepNode(parentAssetId, sourceEvidenceId, templateName, parsedFields, owner) {
  const pepId = `pep-${sourceEvidenceId}-${templateName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20)}`
  const pin = makePin(pepId)
  const dot = owner ? makeDot(owner) : makeDot(pepId)

  return {
    id: pepId,
    pin,
    dot,
    name: templateName,
    category: 'parse',
    owner,
    parentId: parentAssetId,
    sourceEvidenceId,
    children: [],
    health: { ok: 0, warn: 0, bad: 0 },
    childHealth: null,
    totalHealth: null,
    displayHealth: { ok: 0, warn: 0, bad: 0 },
    claimCount: 0,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    parsedFields: parsedFields,
    x: 0,
    y: 0,
    parentOwner: owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isParse: true,
    lastEval: null,
    artifactUri: `provenance://artifacts/${pepId}`,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
  }
}

// ── Claim Node builder ──

function makeClaimNode(parentAssetId, requirementSet, referencedEvidenceIds, owner) {
  const lineageId = requirementSet.lineageId || requirementSet.id
  const id = `claim-${parentAssetId}-${lineageId}`
  const pin = makePin(id)
  const dot = owner ? makeDot(owner) : makeDot(id)

  const claimDefs = (requirementSet.claims || []).map(c => ({
    ...c,
    status: 'pending',
  }))

  return {
    id,
    pin,
    dot,
    name: requirementSet.name,
    category: 'claim',
    owner,
    parentId: parentAssetId,
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
    x: 0,
    y: 0,
    parentOwner: owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isParse: false,
    isEvaluation: false,
    isClaim: true,
    isTerminalNode: false,
    requirementSetId: requirementSet.id,
    requirementSetName: requirementSet.name,
    requirementSetVersion: requirementSet.version || 1,
    requirementSetLineageId: lineageId,
    referencedEvidenceIds: referencedEvidenceIds || [],
    claims: claimDefs,
    artifactUri: `provenance://claims/${id}`,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
    lastEval: null,
  }
}

// ── Node builder ──

function makeNode(id, name, category, owner, opts = {}) {
  const {
    evaluations = [],
    sdas = [],
    evidence = null,
    children = [],
    x = 0,
    y = 0,
    parentId = null,
    childCountOverride = null,
    isCascade = false,
    cascadeVia = null,
    upstreamSda = null,
    upstreamAssets = null,
    isEvidence = false,
    artifactUri = null,
    evidenceRefs = [],
  } = opts

  const health = { ok: 0, warn: 0, bad: 0 }
  const childHealth = null
  const totalHealth = null
  const displayHealth = health
  const claimCount = 0
  const displayClaimCount = 0
  const pin = makePin(id)
  const dot = owner ? makeDot(owner) : makeDot(id)
  const hasEvidence = !!evidence
  const hasStack = children.length > 0 || (childCountOverride != null && childCountOverride > 0)
  const childCount = childCountOverride != null ? childCountOverride : children.length
  const parentOwner = owner // for child rendering

  // Populate SDA pins
  sdas.forEach(sda => {
    if (!sda.pins.includes(pin)) sda.pins = [...sda.pins, pin]
  })

  return {
    id,
    pin,
    dot,
    name,
    category,
    owner,
    parentId,
    children,
    health,
    childHealth,
    totalHealth,
    displayHealth,
    claimCount,
    displayClaimCount,
    hasEvidence,
    hasStack,
    childCount,
    evidence,
    evaluations,
    sdas,
    x,
    y,
    // Child-specific fields (used when this node appears as a child in children[])
    parentOwner: parentOwner,
    isCascade,
    cascadeVia,
    upstreamSda,
    upstreamAssets,
    isEvidence,
    artifactUri,
    evidenceRefs,
    lastEval: evaluations.filter(e => e.status !== 'superseded').length > 0
      ? evaluations.filter(e => e.status !== 'superseded').sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null,
  }
}

// ── Bob's dataset (GovCo buyer view) ──

function buildBobData() {
  const govco = makeNode('govco', 'GovCo', 'party', null, {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_GOVCO, pins: [], assetName: 'Sentinel-4 Program', assetPin: makePin('sentinel-4') }],
    children: [],
    x: 0, y: 0,
  })

  const sentinel4 = makeNode('sentinel-4', 'Sentinel-4 Program', 'product', 'GovCo', {
    evaluations: [],
    sdas: [
      { ...SDA_INTERNAL_GOVCO, pins: [] },
      { ...SDA_INTERNAL_GOVCO, pins: [], assetName: 'Propulsion System', assetPin: makePin('propulsion') },
      { ...SDA_INTERNAL_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') },
    ],
    children: [],
    x: 400, y: 0,
    artifactUri: 'provenance://claims/sentinel-4',
    evidenceRefs: [
      { uri: 'provenance://evidence/sentinel-4-spec-001', filename: 'sentinel-4-system-specification.pdf', size: 2456789, mimeType: 'application/pdf', label: 'System Specification' },
      { uri: 'provenance://evidence/sentinel-4-reqs-001', filename: 'sentinel-4-requirements-matrix.xlsx', size: 890123, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Requirements Matrix' },
    ],
  })

  const propulsion = makeNode('propulsion', 'Propulsion System', 'product', 'GovCo', {
    evaluations: [],
    sdas: [
      { ...SDA_INTERNAL_GOVCO, pins: [] },
      { ...SDA_INTERNAL_GOVCO, pins: [], assetName: 'Sentinel-4 Program', assetPin: makePin('sentinel-4') },
    ],
    children: [],
    x: 900, y: -200,
    artifactUri: 'provenance://claims/propulsion',
    evidenceRefs: [
      { uri: 'provenance://evidence/propulsion-thrust-001', filename: 'thrust-test-report.pdf', size: 3145728, mimeType: 'application/pdf', label: 'Thrust Test Report' },
      { uri: 'provenance://evidence/propulsion-safety-001', filename: 'propellant-safety-datasheet.pdf', size: 1572864, mimeType: 'application/pdf', label: 'Propellant Safety Datasheet' },
    ],
  })

  const avionics = makeNode('avionics', 'Avionics Module', 'product', 'GovCo', {
    evaluations: [],
    sdas: [
      { ...SDA_INTERNAL_GOVCO, pins: [] },
      { ...SDA_INTERNAL_GOVCO, pins: [], assetName: 'Sentinel-4 Program', assetPin: makePin('sentinel-4') },
      {
        type: 'selective',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-01',
        createdTime: '14:15 UTC',
        expires: '2027-03-01',
        expiresTime: '14:15 UTC',
        pins: [],
        assetName: 'Power Regulation Module',
        assetPin: makePin('power-reg'),
      },
      {
        type: 'full',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-04',
        createdTime: '16:42 UTC',
        expires: '2027-03-04',
        expiresTime: '16:42 UTC',
        pins: [],
        assetName: 'Voltage Regulator IC',
        assetPin: makePin('vreg-ic'),
      },
    ],
    children: [],
    x: 900, y: 200,
    artifactUri: 'provenance://claims/avionics',
    evidenceRefs: [
      { uri: 'provenance://evidence/avionics-spec-001', filename: 'avionics-integration-spec.pdf', size: 4718592, mimeType: 'application/pdf', label: 'Integration Specification' },
      { uri: 'provenance://evidence/avionics-emc-001', filename: 'emc-test-report.pdf', size: 2097152, mimeType: 'application/pdf', label: 'EMC Test Report' },
    ],
  })

  // Disclosed MicroCo assets (Bob's copies)
  const powerRegEv = makeEvidenceNode('power-reg',
    makeEvidence('power-reg', 'ASSY-PRM', 'MicroCo Quality Lab', '10 years per MIL-STD-129'),
    'MicroCo', [])
  powerRegEv.evidence.filename = 'powerregulationmodule-datasheet.pdf'
  powerRegEv.evidence.localPath = '/powerregulationmodule-datasheet.pdf'
  powerRegEv.name = 'powerregulationmodule-datasheet.pdf'
  powerRegEv.date = '2026-02-10'
  powerRegEv.dateTime = '2026-02-10T14:18:00Z'

  const powerRegPep = makePepNode('power-reg', powerRegEv.id, 'Electronics Component Profile', [
    { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range', value: '3.3V ±5%', confidence: 'high' },
    { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value', value: '< 2W at rated current', confidence: 'high' },
    { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range', value: '-55°C to +125°C', confidence: 'high' },
    { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value', value: 'TID > 100 krad(Si)', confidence: 'low' },
    { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text', value: 'Category XV, §121.1', confidence: 'high' },
  ], 'MicroCo')

  const powerRegEval = {
    id: 'eval-power-reg-bob-001',
    pin: makePin('eval-power-reg-bob-001'),
    dot: makeDot('GovCo'),
    name: 'MIL-PRF-55681 Compliance',
    category: 'evaluation',
    owner: 'GovCo',
    parentId: 'power-reg',
    children: [],
    health: { ok: 4, warn: 0, bad: 1 },
    childHealth: null,
    totalHealth: null,
    displayHealth: { ok: 4, warn: 0, bad: 1 },
    claimCount: 5,
    displayClaimCount: 5,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x: 0, y: 0,
    parentOwner: 'GovCo',
    isEvidence: false,
    isParse: false,
    isEvaluation: true,
    isTerminalNode: true,
    requirementSetId: EVAL_POWER_REG_BOB.id,
    requirementSetName: EVAL_POWER_REG_BOB.requirements,
    requirementSetVersion: 1,
    requirementSetLineageId: 'lineage-mil-prf-55681',
    disclosureType: 'selective',
    evaluator: EVAL_POWER_REG_BOB.reviewer,
    evaluatorParty: 'GovCo',
    date: EVAL_POWER_REG_BOB.reviewDate,
    dateTime: '2026-03-09T14:32:00Z',
    status: 'completed',
    claims: [
      { requirementId: 'req-001', label: 'Power output stability', description: 'Rated output voltage and tolerance under load', type: 'extraction', aiValue: '3.3V ±0.5% under load', aiConfidence: 0.95, humanValue: '3.3V ±0.5% under load', status: 'satisfactory' },
      { requirementId: 'req-002', label: 'Thermal dissipation', description: 'Maximum power dissipation at rated current', type: 'extraction', aiValue: '< 2W at rated current', aiConfidence: 0.91, humanValue: '< 2W at rated current', status: 'satisfactory' },
      { requirementId: 'req-003', label: 'Operating temperature range', description: 'Minimum and maximum operating temperature', type: 'extraction', aiValue: '-55°C to +125°C', aiConfidence: 0.93, humanValue: '-55°C to +125°C', status: 'satisfactory' },
      { requirementId: 'req-004', label: 'Radiation tolerance', description: 'Total ionizing dose tolerance level', type: 'extraction', aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.72, humanValue: 'TID > 100 krad(Si)', status: 'unsatisfactory' },
      { requirementId: 'req-005', label: 'ITAR classification', description: 'Export control classification under ITAR', type: 'extraction', aiValue: 'Category XV, §121.1', aiConfidence: 0.88, humanValue: 'Category XV, §121.1', status: 'satisfactory' },
    ],
    creditsUsed: 50,
    description: '5 claims evaluated',
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
    selectedEvidenceIds: [],
    artifactUri: 'provenance://artifacts/eval-power-reg-bob-001',
  }
  powerRegEval.selectedEvidenceIds = [powerRegEv.id]

  const powerRegClaim = makeClaimNode('power-reg', {
    id: EVAL_POWER_REG_BOB.id,
    name: EVAL_POWER_REG_BOB.requirements,
    lineageId: 'lineage-mil-prf-55681',
    version: 1,
    claims: [],
  }, [powerRegEv.id], 'MicroCo')
  powerRegClaim.date = '2026-03-01'
  powerRegClaim.dateTime = '2026-03-01T10:00:00Z'

  powerRegEval.parentId = powerRegClaim.id
  powerRegEval.claimId = powerRegClaim.id

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{
      ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics'),
      selectedEvidenceIds: [powerRegEv.id],
      selectedFieldIds: [`${powerRegPep.id}::f-voltage`, `${powerRegPep.id}::f-power`, `${powerRegPep.id}::f-temp`, `${powerRegPep.id}::f-radiation`, `${powerRegPep.id}::f-itar`],
    }],
    children: [powerRegEv, powerRegPep, powerRegClaim, powerRegEval],
    x: 1400, y: 0,
    artifactUri: 'provenance://claims/power-reg',
    evidenceRefs: [
      { uri: 'provenance://evidence/power-reg-datasheet-001', filename: 'powerregulationmodule-datasheet.pdf', size: 2411724, mimeType: 'application/pdf', label: 'Power Regulation Module Datasheet' },
      { uri: 'provenance://evidence/power-reg-thermal-001', filename: 'power-reg-thermal-analysis.pdf', size: 1153434, mimeType: 'application/pdf', label: 'Thermal Analysis Report' },
    ],
  })

  // VReg IC: fully disclosed from MicroCo, no evaluations yet (Bob hasn't run one)
  const vregEv = makeEvidenceNode('vreg-ic',
    makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
    'MicroCo', [])  // no claims — Bob hasn't evaluated yet
  vregEv.evidence.filename = 'voltageregulator-datasheet.pdf'
  vregEv.evidence.localPath = '/voltageregulator-datasheet.pdf'
  vregEv.name = 'voltageregulator-datasheet.pdf'
  vregEv.date = '2026-02-12'
  vregEv.dateTime = '2026-02-12T16:05:00Z'

  const vregPep = makePepNode('vreg-ic', vregEv.id, 'Electronics Component Profile', [
    { id: 'f-vin', name: 'Input voltage range', category: 'electrical', type: 'range', value: '4.5V – 16V', confidence: 'high' },
    { id: 'f-vout', name: 'Output voltage', category: 'electrical', type: 'value', value: '3.3V ±2%', confidence: 'high' },
    { id: 'f-iout', name: 'Output current', category: 'electrical', type: 'value', value: '500mA max', confidence: 'high' },
    { id: 'f-dropout', name: 'Dropout voltage', category: 'electrical', type: 'value', value: '350mV @ 500mA', confidence: 'medium' },
    { id: 'f-pkg', name: 'Package type', category: 'mechanical', type: 'text', value: 'SOT-223', confidence: 'high' },
  ], 'MicroCo')

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{
      ...SDA_VREG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics'),
      selectedEvidenceIds: [vregEv.id],
    }],
    children: [vregEv, vregPep],
    x: 1400, y: 400,
    artifactUri: 'provenance://claims/vreg-ic',
    evidenceRefs: [
      { uri: 'provenance://evidence/vreg-datasheet-001', filename: 'voltageregulator-datasheet.pdf', size: 1887437, mimeType: 'application/pdf', label: 'Voltage Regulator Datasheet' },
      { uri: 'provenance://evidence/vreg-qual-001', filename: 'vreg-qualification-report.pdf', size: 3355443, mimeType: 'application/pdf', label: 'Qualification Test Report' },
    ],
  })

  // Set static parse dates for Bob's disclosed copies
  powerRegPep.date = '2026-02-20'
  powerRegPep.dateTime = '2026-02-20T15:47:00Z'
  vregPep.date = '2026-02-25'
  vregPep.dateTime = '2026-02-25T17:12:00Z'

  // Backfill SDA evidence/field IDs on avionics (references created after avionics node)
  avionics.sdas[1].selectedEvidenceIds = [powerRegEv.id]
  avionics.sdas[1].selectedFieldIds = [`${powerRegPep.id}::f-voltage`, `${powerRegPep.id}::f-power`, `${powerRegPep.id}::f-temp`, `${powerRegPep.id}::f-radiation`, `${powerRegPep.id}::f-itar`]
  avionics.sdas[2].selectedEvidenceIds = [vregEv.id]

  const nodes = [govco, sentinel4, propulsion, avionics, powerReg, vregIc]

  const edges = [
    // GovCo internal structure
    { id: 'e-govco-sentinel', from: 'govco', to: 'sentinel-4', sdaType: 'full' },
    { id: 'e-sentinel-propulsion', from: 'sentinel-4', to: 'propulsion', sdaType: 'full' },
    { id: 'e-sentinel-avionics', from: 'sentinel-4', to: 'avionics', sdaType: 'full' },

    // Disclosed MicroCo assets connected to avionics
    { id: 'e-avionics-powerreg', from: 'avionics', to: 'power-reg', sdaType: 'selective' },
    { id: 'e-avionics-vreg', from: 'avionics', to: 'vreg-ic', sdaType: 'full' },
  ]

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })
  addChildrenToMap(nodes, nodeMap)

  return { nodes, edges, nodeMap, existingCascades: [], pendingRequests: [] }
}

// ── Alice's dataset (MicroCo seller view) ──

function buildAliceData() {
  const microco = makeNode('microco', 'MicroCo', 'party', null, {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 0, y: 0,
  })

  // Bob's Avionics Module — visible to Alice because her products are disclosed to it
  const avionics = makeNode('avionics', 'Avionics Module', 'product', 'GovCo', {
    evaluations: [],
    sdas: [
      {
        type: 'selective',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-01',
        createdTime: '14:15 UTC',
        expires: '2027-03-01',
        expiresTime: '14:15 UTC',
        pins: [],
        assetName: 'Power Regulation Module',
        assetPin: makePin('power-reg'),
      },
      {
        type: 'full',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-04',
        createdTime: '16:42 UTC',
        expires: '2027-03-04',
        expiresTime: '16:42 UTC',
        pins: [],
        assetName: 'Voltage Regulator IC',
        assetPin: makePin('vreg-ic'),
      },
    ],
    children: [],
    x: 1000, y: -200,
  })

  // Power Reg: has evidence, selectively disclosed to GovCo, Bob evaluated it
  const powerRegEv = makeEvidenceNode('power-reg',
    makeEvidence('power-reg', 'ASSY-PRM', 'MicroCo Quality Lab', '10 years per MIL-STD-129'),
    'MicroCo', [])
  powerRegEv.evidence.filename = 'powerregulationmodule-datasheet.pdf'
  powerRegEv.evidence.localPath = '/powerregulationmodule-datasheet.pdf'
  powerRegEv.name = 'powerregulationmodule-datasheet.pdf'
  powerRegEv.date = '2026-02-10'
  powerRegEv.dateTime = '2026-02-10T14:18:00Z'

  const powerRegPep = makePepNode('power-reg', powerRegEv.id, 'Electronics Component Profile', [
    { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range', value: '3.3V ±5%', confidence: 'high' },
    { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value', value: '< 2W at rated current', confidence: 'high' },
    { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range', value: '-55°C to +125°C', confidence: 'high' },
    { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value', value: 'TID > 100 krad(Si)', confidence: 'low' },
    { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text', value: 'Category XV, §121.1', confidence: 'high' },
  ], 'MicroCo')

  const powerRegEval = {
    id: 'eval-power-reg-bob-001',
    pin: makePin('eval-power-reg-bob-001'),
    dot: makeDot('GovCo'),
    name: 'MIL-PRF-55681 Compliance',
    category: 'evaluation',
    owner: 'GovCo',
    parentId: 'power-reg',
    children: [],
    health: { ok: 4, warn: 0, bad: 1 },
    childHealth: null,
    totalHealth: null,
    displayHealth: { ok: 4, warn: 0, bad: 1 },
    claimCount: 5,
    displayClaimCount: 5,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x: 0, y: 0,
    parentOwner: 'GovCo',
    isEvidence: false,
    isParse: false,
    isEvaluation: true,
    isTerminalNode: true,
    requirementSetId: EVAL_POWER_REG_BOB.id,
    requirementSetName: EVAL_POWER_REG_BOB.requirements,
    requirementSetVersion: 1,
    requirementSetLineageId: 'lineage-mil-prf-55681',
    disclosureType: 'selective',
    evaluator: EVAL_POWER_REG_BOB.reviewer,
    evaluatorParty: 'GovCo',
    date: EVAL_POWER_REG_BOB.reviewDate,
    dateTime: '2026-03-09T14:32:00Z',
    status: 'completed',
    claims: [
      { requirementId: 'req-001', label: 'Power output stability', description: 'Rated output voltage and tolerance under load', type: 'extraction', aiValue: '3.3V ±0.5% under load', aiConfidence: 0.95, humanValue: '3.3V ±0.5% under load', status: 'satisfactory' },
      { requirementId: 'req-002', label: 'Thermal dissipation', description: 'Maximum power dissipation at rated current', type: 'extraction', aiValue: '< 2W at rated current', aiConfidence: 0.91, humanValue: '< 2W at rated current', status: 'satisfactory' },
      { requirementId: 'req-003', label: 'Operating temperature range', description: 'Minimum and maximum operating temperature', type: 'extraction', aiValue: '-55°C to +125°C', aiConfidence: 0.93, humanValue: '-55°C to +125°C', status: 'satisfactory' },
      { requirementId: 'req-004', label: 'Radiation tolerance', description: 'Total ionizing dose tolerance level', type: 'extraction', aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.72, humanValue: 'TID > 100 krad(Si)', status: 'unsatisfactory' },
      { requirementId: 'req-005', label: 'ITAR classification', description: 'Export control classification under ITAR', type: 'extraction', aiValue: 'Category XV, §121.1', aiConfidence: 0.88, humanValue: 'Category XV, §121.1', status: 'satisfactory' },
    ],
    creditsUsed: 50,
    description: '5 claims evaluated',
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
    selectedEvidenceIds: [],
    artifactUri: 'provenance://artifacts/eval-power-reg-bob-001',
  }
  powerRegEval.selectedEvidenceIds = [powerRegEv.id]

  const powerRegClaim = makeClaimNode('power-reg', {
    id: EVAL_POWER_REG_BOB.id,
    name: EVAL_POWER_REG_BOB.requirements,
    lineageId: 'lineage-mil-prf-55681',
    version: 1,
    claims: [],
  }, [powerRegEv.id], 'MicroCo')
  powerRegClaim.date = '2026-03-01'
  powerRegClaim.dateTime = '2026-03-01T10:00:00Z'

  powerRegEval.parentId = powerRegClaim.id
  powerRegEval.claimId = powerRegClaim.id

  const SDA_RADIANT_POWERREG = {
    type: 'selective',
    party: 'Radiant Network',
    partyDot: RADIANT_NETWORK_DOT,
    created: '2026-02-01',
    createdTime: '17:08 UTC',
    expires: null,
    pins: [],
    assetName: 'Radiant Network',
    assetPin: RADIANT_NETWORK_PIN,
    _isGrantor: true,
  }

  const SDA_RADIANT_VREG = {
    type: 'full',
    party: 'Radiant Network',
    partyDot: RADIANT_NETWORK_DOT,
    created: '2026-02-01',
    createdTime: '17:22 UTC',
    expires: null,
    pins: [],
    assetName: 'Radiant Network',
    assetPin: RADIANT_NETWORK_PIN,
    _isGrantor: true,
  }

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [
      {
        ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics'),
        selectedEvidenceIds: [powerRegEv.id],
        selectedFieldIds: [`${powerRegPep.id}::f-voltage`, `${powerRegPep.id}::f-power`, `${powerRegPep.id}::f-temp`, `${powerRegPep.id}::f-radiation`, `${powerRegPep.id}::f-itar`],
        _isGrantor: true,
      },
      { ...SDA_INTERNAL_MICROCO, pins: [] },
      SDA_RADIANT_POWERREG,
    ],
    children: [powerRegEv, powerRegPep, powerRegClaim, powerRegEval],
    x: 500, y: -300,
    artifactUri: 'provenance://claims/power-reg',
    evidenceRefs: [
      { uri: 'provenance://evidence/power-reg-datasheet-001', filename: 'powerregulationmodule-datasheet.pdf', size: 2411724, mimeType: 'application/pdf', label: 'Power Regulation Module Datasheet' },
      { uri: 'provenance://evidence/power-reg-thermal-001', filename: 'power-reg-thermal-analysis.pdf', size: 1153434, mimeType: 'application/pdf', label: 'Thermal Analysis Report' },
    ],
  })

  // VReg IC: has evidence, fully disclosed to GovCo, no evaluations yet
  const vregEv = makeEvidenceNode('vreg-ic',
    makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
    'MicroCo', [])  // no claims yet — no evaluations run
  vregEv.evidence.filename = 'voltageregulator-datasheet.pdf'
  vregEv.evidence.localPath = '/voltageregulator-datasheet.pdf'
  vregEv.name = 'voltageregulator-datasheet.pdf'
  vregEv.date = '2026-02-12'
  vregEv.dateTime = '2026-02-12T16:05:00Z'

  const vregPep = makePepNode('vreg-ic', vregEv.id, 'Electronics Component Profile', [
    { id: 'f-vin', name: 'Input voltage range', category: 'electrical', type: 'range', value: '4.5V – 16V', confidence: 'high' },
    { id: 'f-vout', name: 'Output voltage', category: 'electrical', type: 'value', value: '3.3V ±2%', confidence: 'high' },
    { id: 'f-iout', name: 'Output current', category: 'electrical', type: 'value', value: '500mA max', confidence: 'high' },
    { id: 'f-dropout', name: 'Dropout voltage', category: 'electrical', type: 'value', value: '350mV @ 500mA', confidence: 'medium' },
    { id: 'f-pkg', name: 'Package type', category: 'mechanical', type: 'text', value: 'SOT-223', confidence: 'high' },
  ], 'MicroCo')

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [
      {
        ...SDA_VREG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics'),
        selectedEvidenceIds: [vregEv.id],
        _isGrantor: true,
      },
      { ...SDA_INTERNAL_MICROCO, pins: [] },
      SDA_RADIANT_VREG,
    ],
    children: [vregEv, vregPep],
    x: 500, y: 0,
    artifactUri: 'provenance://claims/vreg-ic',
    evidenceRefs: [
      { uri: 'provenance://evidence/vreg-datasheet-001', filename: 'voltageregulator-datasheet.pdf', size: 1887437, mimeType: 'application/pdf', label: 'Voltage Regulator Datasheet' },
      { uri: 'provenance://evidence/vreg-qual-001', filename: 'vreg-qualification-report.pdf', size: 3355443, mimeType: 'application/pdf', label: 'Qualification Test Report' },
    ],
  })

  // PCB Substrate: shell, no evidence yet
  const pcbSub = makeNode('pcb-sub', 'PCB Substrate', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 500, y: 300,
    artifactUri: 'provenance://claims/pcb-sub',
    evidenceRefs: [
      { uri: 'provenance://evidence/pcb-spec-001', filename: 'pcb-substrate-specification.pdf', size: 1048576, mimeType: 'application/pdf', label: 'PCB Specification' },
    ],
  })

  // EMI Shield: evidence + parse + published to directory
  const emiShieldEv = makeEvidenceNode('emi-shield',
    makeEvidence('emi-shield', 'EMI-TST', 'MicroCo EMC Lab', '7 years per MIL-STD-461'),
    'MicroCo', [])
  emiShieldEv.evidence.filename = 'emishielding-datasheet.pdf'
  emiShieldEv.evidence.localPath = '/emishielding-datasheet.pdf'
  emiShieldEv.name = 'emishielding-datasheet.pdf'
  emiShieldEv.date = '2026-02-08'
  emiShieldEv.dateTime = '2026-02-08T13:41:00Z'

  const emiShieldPep = makePepNode('emi-shield', emiShieldEv.id, 'Mechanical Assembly Profile', [
    { id: 'f-material', name: 'Shield material', category: 'mechanical', type: 'text', value: 'Nickel silver alloy', confidence: 'high' },
    { id: 'f-thickness', name: 'Wall thickness', category: 'mechanical', type: 'value', value: '0.3mm ±0.02', confidence: 'high' },
    { id: 'f-freq', name: 'Shielding frequency range', category: 'electrical', type: 'range', value: '100 MHz – 10 GHz', confidence: 'high' },
    { id: 'f-effectiveness', name: 'Shielding effectiveness', category: 'electrical', type: 'value', value: '> 60 dB @ 1 GHz', confidence: 'medium' },
    { id: 'f-mounting', name: 'Mounting method', category: 'mechanical', type: 'text', value: 'Soldered perimeter with snap-fit lid', confidence: 'high' },
  ], 'MicroCo')

  const emiShield = makeNode('emi-shield', 'EMI Shield Assembly', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [
      { ...SDA_INTERNAL_MICROCO, pins: [] },
      {
        type: 'full',
        party: 'Radiant Network',
        partyDot: RADIANT_NETWORK_DOT,
        created: '2026-02-10',
        createdTime: '15:30 UTC',
        expires: null,
        pins: [],
        assetName: null,
        assetPin: null,
        _isGrantor: true,
      },
    ],
    children: [emiShieldEv, emiShieldPep],
    x: 500, y: 600,
    description: 'Board-level EMI shielding assembly for high-frequency noise suppression.',
    artifactUri: 'provenance://claims/emi-shield',
    evidenceRefs: [
      { uri: 'provenance://evidence/emi-datasheet-001', filename: 'emishielding-datasheet.pdf', size: 1258291, mimeType: 'application/pdf', label: 'EMI Shield Datasheet' },
    ],
  })

  // Thermal Interface Pad: has evidence + parse
  const thermalPadEv = makeEvidenceNode('thermal-pad',
    makeEvidence('thermal-pad', 'TIP-SPEC', 'MicroCo Materials Lab', '5 years'),
    'MicroCo', [])
  thermalPadEv.evidence.filename = 'thermalinterfacepad-datasheet.pdf'
  thermalPadEv.evidence.localPath = '/thermalinterfacepad-datasheet.pdf'
  thermalPadEv.name = 'thermalinterfacepad-datasheet.pdf'
  thermalPadEv.date = '2026-02-22'
  thermalPadEv.dateTime = '2026-02-22T18:33:00Z'

  const thermalPadPep = makePepNode('thermal-pad', thermalPadEv.id, 'Mechanical Assembly Profile', [
    { id: 'f-conductivity', name: 'Thermal conductivity', category: 'thermal', type: 'value', value: '6.0 W/mK', confidence: 'high' },
    { id: 'f-thickness', name: 'Thickness', category: 'mechanical', type: 'value', value: '1.0mm ±0.1', confidence: 'high' },
    { id: 'f-hardness', name: 'Shore hardness', category: 'mechanical', type: 'value', value: 'Shore 00-45', confidence: 'medium' },
    { id: 'f-temp-range', name: 'Operating temperature', category: 'thermal', type: 'range', value: '-40°C to +200°C', confidence: 'high' },
    { id: 'f-dielectric', name: 'Dielectric strength', category: 'electrical', type: 'value', value: '> 10 kV/mm', confidence: 'high' },
  ], 'MicroCo')

  const thermalPad = makeNode('thermal-pad', 'Thermal Interface Pad', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [thermalPadEv, thermalPadPep],
    x: 500, y: 900,
    description: 'Thermally conductive gap filler pad for heat dissipation between components and heatsinks.',
    artifactUri: 'provenance://claims/thermal-pad',
    evidenceRefs: [
      { uri: 'provenance://evidence/thermal-datasheet-001', filename: 'thermalinterfacepad-datasheet.pdf', size: 1003520, mimeType: 'application/pdf', label: 'Thermal Pad Datasheet' },
    ],
  })

  // Connector Assembly: has evidence + parse
  const connectorAssyEv = makeEvidenceNode('connector-assy',
    makeEvidence('connector-assy', 'CONN-SPEC', 'MicroCo Assembly Lab', '7 years'),
    'MicroCo', [])
  connectorAssyEv.evidence.filename = 'connectorassembly-datasheet.pdf'
  connectorAssyEv.evidence.localPath = '/connectorassembly-datasheet.pdf'
  connectorAssyEv.name = 'connectorassembly-datasheet.pdf'
  connectorAssyEv.date = '2026-02-28'
  connectorAssyEv.dateTime = '2026-02-28T15:10:00Z'

  const connectorAssyPep = makePepNode('connector-assy', connectorAssyEv.id, 'Mechanical Assembly Profile', [
    { id: 'f-contacts', name: 'Contact count', category: 'mechanical', type: 'value', value: '24 positions', confidence: 'high' },
    { id: 'f-pitch', name: 'Contact pitch', category: 'mechanical', type: 'value', value: '1.25mm', confidence: 'high' },
    { id: 'f-current', name: 'Current rating', category: 'electrical', type: 'value', value: '1.0A per contact', confidence: 'high' },
    { id: 'f-mating', name: 'Mating cycles', category: 'mechanical', type: 'value', value: '> 500 cycles', confidence: 'medium' },
    { id: 'f-plating', name: 'Contact plating', category: 'mechanical', type: 'text', value: 'Gold over nickel', confidence: 'high' },
  ], 'MicroCo')

  const connectorAssy = makeNode('connector-assy', 'Connector Assembly', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [connectorAssyEv, connectorAssyPep],
    x: 500, y: 1200,
    description: 'Board-to-board connector assembly for inter-module signal and power routing.',
    artifactUri: 'provenance://claims/connector-assy',
    evidenceRefs: [
      { uri: 'provenance://evidence/connector-datasheet-001', filename: 'connectorassembly-datasheet.pdf', size: 1433600, mimeType: 'application/pdf', label: 'Connector Assembly Datasheet' },
    ],
  })

  const radiantNetwork = {
    id: 'radiant-network',
    pin: RADIANT_NETWORK_PIN,
    dot: RADIANT_NETWORK_DOT,
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
    x: 1400, y: 600,
    parentOwner: 'Radiant Network',
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    upstreamAssets: null,
    isEvidence: false,
    lastEval: null,
    description: 'Public asset directory — all published assets are discoverable here.',
    isNetworkNode: true,
  }

  // Set static parse dates for Alice's assets
  powerRegPep.date = '2026-02-20'
  powerRegPep.dateTime = '2026-02-20T15:47:00Z'
  vregPep.date = '2026-02-25'
  vregPep.dateTime = '2026-02-25T17:12:00Z'
  emiShieldPep.date = '2026-02-18'
  emiShieldPep.dateTime = '2026-02-18T14:03:00Z'
  thermalPadPep.date = '2026-03-01'
  thermalPadPep.dateTime = '2026-03-01T19:28:00Z'
  connectorAssyPep.date = '2026-03-05'
  connectorAssyPep.dateTime = '2026-03-05T16:55:00Z'

  const nodes = [microco, avionics, powerReg, vregIc, pcbSub, emiShield, thermalPad, connectorAssy, radiantNetwork]

  const edges = [
    // MicroCo's product catalog (internal full edges)
    { id: 'e-microco-powerreg', from: 'microco', to: 'power-reg', sdaType: 'full' },
    { id: 'e-microco-vreg', from: 'microco', to: 'vreg-ic', sdaType: 'full' },
    { id: 'e-microco-pcb', from: 'microco', to: 'pcb-sub', sdaType: 'full' },
    { id: 'e-microco-emi', from: 'microco', to: 'emi-shield', sdaType: 'full' },
    { id: 'e-microco-thermal', from: 'microco', to: 'thermal-pad', sdaType: 'full' },
    { id: 'e-microco-connector', from: 'microco', to: 'connector-assy', sdaType: 'full' },

    // Bob's Avionics connected to Alice's disclosed assets
    { id: 'e-avionics-powerreg', from: 'avionics', to: 'power-reg', sdaType: 'selective' },
    { id: 'e-avionics-vreg', from: 'avionics', to: 'vreg-ic', sdaType: 'full' },

    // Public directory edges
    { id: 'e-powerreg-radiant', from: 'power-reg', to: 'radiant-network', sdaType: 'selective' },
    { id: 'e-vreg-radiant', from: 'vreg-ic', to: 'radiant-network', sdaType: 'full' },
    { id: 'e-emi-public', from: 'emi-shield', to: 'radiant-network', sdaType: 'full' },
  ]

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })
  addChildrenToMap(nodes, nodeMap)

  return {
    nodes, edges, nodeMap,
    existingCascades: [],
    pendingRequests: [],
  }
}

// ── Public API ──

function resolvePin(pin) {
  const allData = [buildBobData(), buildAliceData()]
  for (const data of allData) {
    const match = Object.values(data.nodeMap).find(n => n.pin === pin)
    if (match) return match
  }
  return null
}

function makeEvalNode(parentAssetId, requirementSet, claims, evaluatorParty, evaluatorUser, disclosureType, previousEvalId = null, claimId = null) {
  const id = `eval-${parentAssetId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  const pin = makePin(id)
  const dot = makeDot(evaluatorParty)

  return {
    id,
    pin,
    dot,
    name: requirementSet.name,
    category: 'evaluation',
    owner: evaluatorParty,
    parentId: parentAssetId,
    claimId: claimId || parentAssetId,
    children: [],
    health: { ok: 0, warn: 0, bad: 0 },
    childHealth: null,
    totalHealth: null,
    displayHealth: { ok: 0, warn: 0, bad: 0 },
    claimCount: claims.length,
    hasEvidence: false,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x: 0,
    y: 0,
    parentOwner: evaluatorParty,
    isEvidence: false,
    isParse: false,
    isEvaluation: true,
    isTerminalNode: true,
    requirementSetId: requirementSet.id,
    requirementSetName: requirementSet.name,
    requirementSetVersion: requirementSet.version || 1,
    requirementSetLineageId: requirementSet.lineageId || requirementSet.id,
    disclosureType,
    evaluator: evaluatorUser,
    evaluatorParty,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
    status: 'completed',
    claims,
    creditsUsed: claims.length * 10,
    description: `${claims.length} claim${claims.length !== 1 ? 's' : ''} evaluated`,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
    previousEvalId,
    evalVersion: previousEvalId ? 2 : 1,
    selectedEvidenceIds: [],
    artifactUri: `provenance://artifacts/${id}`,
  }
}


export function makeRootClaim(name, evidenceFiles, owner, opts = {}) {
  const ts = Date.now()
  const id = `claim-root-${hashStr(name + '-' + ts).toString(16).padStart(8, '0')}`
  const pin = makePin(id)
  const dot = owner ? makeDot(owner) : makeDot(id)

  return {
    id,
    pin,
    dot,
    name,
    category: 'claim',
    owner,
    parentId: null,
    children: [],
    health: { ok: 0, warn: 0, bad: 0 },
    childHealth: null,
    totalHealth: null,
    displayHealth: { ok: 0, warn: 0, bad: 0 },
    claimCount: 0,
    displayClaimCount: 0,
    hasEvidence: true,
    hasStack: false,
    childCount: 0,
    evidence: null,
    evaluations: [],
    sdas: [],
    x: opts.x || 0,
    y: opts.y || 0,
    parentOwner: owner,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    isEvidence: false,
    isParse: false,
    isEvaluation: false,
    isClaim: true,
    isTerminalNode: false,
    evidenceRefs: evidenceFiles.map(f => ({
      uri: f.uri || f.path,
      filename: f.filename || f.name,
      size: f.size || null,
      mimeType: f.mimeType || null,
      label: f.label || f.filename || f.name,
      hash: f.hash || null,
    })),
    referencedEvidenceIds: [],
    artifactUri: `provenance://claims/${id}`,
    date: new Date().toISOString().slice(0, 10),
    dateTime: new Date().toISOString(),
    lastEval: null,
  }
}

export { makePin, makeDot, makeEvidence, makeEvidenceNode, makePepNode, makeClaimNode, makeEvalNode, resolvePin }

export function getDataForRole(roleId) {
  if (roleId === 'alice-microco') return buildAliceData()
  return buildBobData()
}
