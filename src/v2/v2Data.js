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

// ── Health computation ──

function computeHealth(evaluations) {
  let ok = 0, bad = 0
  for (const ev of evaluations) {
    if (ev.status === 'superseded') continue
    for (const c of ev.claims) {
      if (c.status === 'verified') ok++
      else bad++
    }
  }
  return { ok, warn: 0, bad }
}

function sumHealth(nodes) {
  let ok = 0, bad = 0
  for (const n of nodes) {
    ok += n.health.ok
    bad += n.health.bad
  }
  return { ok, warn: 0, bad }
}

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

  const health = computeHealth(evaluations)
  const childHealth = children.length > 0 ? sumHealth(children) : null
  const totalHealth = childHealth
    ? { ok: health.ok + childHealth.ok, warn: 0, bad: health.bad + childHealth.bad }
    : null
  // Display health: for nodes with evidence children, show pure child roll-up
  // (parent's own claims are attributed to evidence children, so showing own health would double-count)
  const hasEvidenceChildren = children.some(c => c.isEvidence)
  const displayHealth = hasEvidenceChildren
    ? (childHealth || health)
    : (totalHealth || health)
  const claimCount = health.ok + health.bad
  const displayClaimCount = displayHealth.ok + displayHealth.bad
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
    'MicroCo', EVAL_POWER_REG_BOB.claims)

  const powerRegPep = makePepNode('power-reg', powerRegEv.id, 'Electronics Component Profile', [
    { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range', value: '3.3V ±5%', confidence: 'high' },
    { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value', value: '< 2W at rated current', confidence: 'high' },
    { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range', value: '-55°C to +125°C', confidence: 'high' },
    { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value', value: 'TID > 100 krad(Si)', confidence: 'low' },
    { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text', value: 'Category XV, §121.1', confidence: 'high' },
  ], 'MicroCo')

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [EVAL_POWER_REG_BOB],
    sdas: [{ ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') }],
    children: [powerRegEv, powerRegPep],
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
    'MicroCo', EVAL_POWER_REG_BOB.claims)

  const powerRegPep = makePepNode('power-reg', powerRegEv.id, 'Electronics Component Profile', [
    { id: 'f-voltage', name: 'Operating voltage', category: 'electrical', type: 'range', value: '3.3V ±5%', confidence: 'high' },
    { id: 'f-power', name: 'Power dissipation', category: 'electrical', type: 'value', value: '< 2W at rated current', confidence: 'high' },
    { id: 'f-temp', name: 'Temperature range', category: 'environmental', type: 'range', value: '-55°C to +125°C', confidence: 'high' },
    { id: 'f-radiation', name: 'Radiation tolerance', category: 'environmental', type: 'value', value: 'TID > 100 krad(Si)', confidence: 'low' },
    { id: 'f-itar', name: 'ITAR classification', category: 'compliance', type: 'text', value: 'Category XV, §121.1', confidence: 'high' },
  ], 'MicroCo')

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [EVAL_POWER_REG_BOB],
    sdas: [
      { ...SDA_POWER_REG_TO_GOVCO, pins: [], assetName: 'Avionics Module', assetPin: makePin('avionics') },
      { ...SDA_INTERNAL_MICROCO, pins: [] },
    ],
    children: [powerRegEv, powerRegPep],
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
    pendingRequests: [
      {
        id: 'req-001',
        from: { name: 'GovCo', dot: GOVCO_DOT },
        asset: { name: 'PCB Substrate', pin: pcbSub.pin },
        connectTo: {
          id: 'avionics',
          name: 'Avionics Module',
          pin: makePin('avionics'),
          category: 'product',
          owner: 'GovCo',
        },
        message: "We'd like to evaluate the PCB Substrate for the Sentinel-4 avionics subsystem. Requesting disclosure to run IPC-6012 qualification screening.",
        requirements: ['IPC-6012 Class 3 Qualification'],
        date: '2026-03-12',
      },
    ],
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

export { makePin, makeDot, makeEvidence, makeEvidenceNode, makePepNode, resolvePin }

export function getDataForRole(roleId) {
  if (roleId === 'alice-microco') return buildAliceData()
  return buildBobData()
}
