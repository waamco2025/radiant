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
  expires: '2027-03-01',
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
  expires: '2027-03-04',
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
  expires: null,
  pins: [],
  assetName: null,
  assetPin: null,
}

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
    lastEval: evaluations.filter(e => e.status !== 'superseded').length > 0
      ? evaluations.filter(e => e.status !== 'superseded').sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null,
  }
}

// ── Bob's dataset (GovCo buyer view) ──

function buildBobData() {
  const govco = makeNode('govco', 'GovCo', 'party', null, {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_GOVCO, pins: [] }],
    children: [],
    x: 0, y: 0,
  })

  const sentinel4 = makeNode('sentinel-4', 'Sentinel-4 Program', 'product', 'GovCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_GOVCO, pins: [] }],
    children: [],
    x: 400, y: 0,
  })

  const propulsion = makeNode('propulsion', 'Propulsion System', 'product', 'GovCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_GOVCO, pins: [] }],
    children: [],
    x: 900, y: -200,
  })

  const avionics = makeNode('avionics', 'Avionics Module', 'product', 'GovCo', {
    evaluations: [],
    sdas: [
      { ...SDA_INTERNAL_GOVCO, pins: [] },
      {
        type: 'selective',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-01',
        expires: '2027-03-01',
        pins: [],
        assetName: 'Power Regulation Module',
        assetPin: makePin('power-reg'),
      },
      {
        type: 'full',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-04',
        expires: '2027-03-04',
        pins: [],
        assetName: 'Voltage Regulator IC',
        assetPin: makePin('vreg-ic'),
      },
    ],
    children: [],
    x: 900, y: 200,
  })

  // Disclosed MicroCo assets
  const powerRegEv = makeEvidenceNode('power-reg',
    makeEvidence('power-reg', 'ASSY-PRM', 'MicroCo Quality Lab', '10 years per MIL-STD-129'),
    'MicroCo', [])

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
    status: 'completed',
    claims: [
      { requirementId: 'req-001', label: 'Power output stability', description: 'Rated output voltage and tolerance under load', type: 'extraction', aiValue: '3.3V ±0.5% under load', aiConfidence: 0.95, humanValue: '3.3V ±0.5% under load', status: 'satisfactory' },
      { requirementId: 'req-002', label: 'Thermal dissipation', description: 'Maximum power dissipation at rated current', type: 'extraction', aiValue: '< 2W at rated current', aiConfidence: 0.91, humanValue: '< 2W at rated current', status: 'satisfactory' },
      { requirementId: 'req-003', label: 'Operating temperature range', description: 'Minimum and maximum operating temperature', type: 'extraction', aiValue: '-55°C to +125°C', aiConfidence: 0.93, humanValue: '-55°C to +125°C', status: 'satisfactory' },
      { requirementId: 'req-004', label: 'Radiation tolerance', description: 'Total ionizing dose tolerance level', type: 'extraction', aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.72, humanValue: 'TID > 100 krad(Si)', status: 'unsatisfactory' },
      { requirementId: 'req-005', label: 'ITAR classification', description: 'Export control classification under ITAR', type: 'extraction', aiValue: 'Category XV, §121.1', aiConfidence: 0.88, humanValue: 'Category XV, §121.1', status: 'satisfactory' },
    ],
    creditsUsed: 50,
    description: 'MIL-PRF-55681 Compliance evaluation — 5 claims',
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
  }

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') }],
    children: [powerRegEv, powerRegPep, powerRegEval],
    x: 1400, y: 0,
  })

  // VReg IC: fully disclosed from MicroCo, no evaluations yet (Bob hasn't run one)
  const vregEv = makeEvidenceNode('vreg-ic',
    makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
    'MicroCo', [])  // no claims — Bob hasn't evaluated yet

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_VREG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') }],
    children: [vregEv],
    x: 1400, y: 400,
  })

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
        expires: '2027-03-01',
        pins: [],
        assetName: 'Power Regulation Module',
        assetPin: makePin('power-reg'),
      },
      {
        type: 'full',
        party: 'MicroCo',
        partyDot: MICROCO_DOT,
        created: '2026-03-04',
        expires: '2027-03-04',
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
    status: 'completed',
    claims: [
      { requirementId: 'req-001', label: 'Power output stability', description: 'Rated output voltage and tolerance under load', type: 'extraction', aiValue: '3.3V ±0.5% under load', aiConfidence: 0.95, humanValue: '3.3V ±0.5% under load', status: 'satisfactory' },
      { requirementId: 'req-002', label: 'Thermal dissipation', description: 'Maximum power dissipation at rated current', type: 'extraction', aiValue: '< 2W at rated current', aiConfidence: 0.91, humanValue: '< 2W at rated current', status: 'satisfactory' },
      { requirementId: 'req-003', label: 'Operating temperature range', description: 'Minimum and maximum operating temperature', type: 'extraction', aiValue: '-55°C to +125°C', aiConfidence: 0.93, humanValue: '-55°C to +125°C', status: 'satisfactory' },
      { requirementId: 'req-004', label: 'Radiation tolerance', description: 'Total ionizing dose tolerance level', type: 'extraction', aiValue: 'TID > 100 krad(Si)', aiConfidence: 0.72, humanValue: 'TID > 100 krad(Si)', status: 'unsatisfactory' },
      { requirementId: 'req-005', label: 'ITAR classification', description: 'Export control classification under ITAR', type: 'extraction', aiValue: 'Category XV, §121.1', aiConfidence: 0.88, humanValue: 'Category XV, §121.1', status: 'satisfactory' },
    ],
    creditsUsed: 50,
    description: 'MIL-PRF-55681 Compliance evaluation — 5 claims',
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
  }

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [
      { ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') },
      { ...SDA_INTERNAL_MICROCO, pins: [] },
    ],
    children: [powerRegEv, powerRegPep, powerRegEval],
    x: 500, y: -300,
  })

  // VReg IC: has evidence, fully disclosed to GovCo, no evaluations yet
  const vregEv = makeEvidenceNode('vreg-ic',
    makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
    'MicroCo', [])  // no claims yet — no evaluations run

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [],  // removed self-eval — will become PEP later
    sdas: [
      { ...SDA_VREG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') },
      { ...SDA_INTERNAL_MICROCO, pins: [] },
    ],
    children: [vregEv],
    x: 500, y: 0,
  })

  // PCB Substrate: shell, no evidence yet
  const pcbSub = makeNode('pcb-sub', 'PCB Substrate', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 500, y: 300,
  })

  // EMI Shield: shell, no evidence yet
  const emiShield = makeNode('emi-shield', 'EMI Shield Assembly', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 500, y: 600,
  })

  // Thermal Interface Pad: shell, no evidence — Register Asset demo
  const thermalPad = makeNode('thermal-pad', 'Thermal Interface Pad', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 500, y: 900,
  })

  // Connector Assembly: shell, no evidence — already in public directory demo
  const connectorAssy = makeNode('connector-assy', 'Connector Assembly', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_MICROCO, pins: [] }],
    children: [],
    x: 500, y: 1200,
  })

  const nodes = [microco, avionics, powerReg, vregIc, pcbSub, emiShield, thermalPad, connectorAssy]

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

function makeEvalNode(parentAssetId, requirementSet, claims, evaluatorParty, evaluatorUser, disclosureType) {
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
    status: 'completed',
    claims,
    creditsUsed: claims.length * 10,
    description: `${requirementSet.name} evaluation — ${claims.length} claims`,
    isCascade: false,
    cascadeVia: null,
    upstreamSda: null,
    lastEval: null,
  }
}

export { makePin, makeDot, makeEvidence, makeEvidenceNode, makePepNode, makeEvalNode, resolvePin }

export function getDataForRole(roleId) {
  if (roleId === 'alice-microco') return buildAliceData()
  return buildBobData()
}
