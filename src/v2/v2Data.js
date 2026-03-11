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
  const h = hashStr('pin-' + seed)
  const a = (h >>> 0).toString(16).padStart(4, '0').slice(0, 4)
  const b = (hashStr(seed + '-tail') >>> 0).toString(16).padStart(4, '0').slice(0, 4)
  return `PIN-0x${a}...${b}`
}

function makeDot(seed) {
  const h = hashStr('dot-' + seed)
  const a = (h >>> 0).toString(16).padStart(4, '0').slice(0, 4)
  const b = (hashStr(seed + '-dot-tail') >>> 0).toString(16).padStart(4, '0').slice(0, 4)
  return `DOT-0x${a}...${b}`
}

// ── Roles ──

export const ROLES = [
  {
    id: 'bob-govco',
    user: 'Bob',
    party: 'GovCo',
    partyDot: 'DOT-0x7a3f...e1b2',
    role: 'buyer',
    credits: 2400,
    vertical: 'Government / Satellite',
  },
  {
    id: 'alice-microco',
    user: 'Alice',
    party: 'MicroCo',
    partyDot: 'DOT-0x4c8d...f3a7',
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

// ── Shared DOTs ──

const DOTS = {
  microco: 'DOT-0x4c8d...f3a7',
  govco: 'DOT-0x7a3f...e1b2',
  murata: makeDot('murata-mfg'),
  orbital: makeDot('orbital-systems'),
  northstar: makeDot('northstar-defense'),
  danaher: makeDot('danaher-precision'),
  ariba: makeDot('ariba-procurement'),
}

// ── Shared evaluations ──
// These appear in both Bob's and Alice's views

const EVAL_POWER_REG_GOVCO = {
  id: 'eval-061',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-03-01',
  requirements: 'System Integration Requirements',
  status: 'completed',
  creditsUsed: 50,
  reviewer: 'Bob Chen',
  reviewDate: '2026-03-02',
  claims: [
    { requirement: 'Power output stability', output: '3.3V ±0.5% under load', type: 'direct', status: 'verified' },
    { requirement: 'Thermal dissipation', output: '< 2W at rated current', type: 'direct', status: 'verified' },
    { requirement: 'Operating temp range', output: '-55°C to +125°C', type: 'inferred', status: 'verified' },
    { requirement: 'Radiation tolerance', output: 'TID > 100 krad(Si)', type: 'inferred', status: 'verified' },
    { requirement: 'ITAR compliance', output: 'Category XV, §121.1', type: 'direct', status: 'verified' },
  ],
}

const EVAL_POWER_REG_INTERNAL = {
  id: 'eval-058',
  org: 'MicroCo',
  orgDot: DOTS.microco,
  date: '2026-02-15',
  requirements: 'Internal Quality Audit',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Alice Nguyen',
  reviewDate: '2026-02-16',
  claims: [
    { requirement: 'Assembly procedure compliance', output: 'IPC-A-610 Class 3', type: 'direct', status: 'verified' },
    { requirement: 'Solder joint integrity', output: '0 defects / 847 joints', type: 'direct', status: 'verified' },
    { requirement: 'Conformal coating', output: 'MIL-I-46058C Type AR', type: 'direct', status: 'verified' },
    { requirement: 'ESD protection', output: 'ANSI/ESD S20.20 compliant', type: 'direct', status: 'verified' },
  ],
}

const EVAL_CAP_ARRAY_MICROCO = {
  id: 'eval-055',
  org: 'MicroCo',
  orgDot: DOTS.microco,
  date: '2026-01-20',
  requirements: 'Component Acceptance Testing',
  status: 'completed',
  creditsUsed: 50,
  reviewer: 'Alice Nguyen',
  reviewDate: '2026-01-21',
  claims: [
    { requirement: 'Capacitance tolerance', output: '10µF ±5% (X7R)', type: 'direct', status: 'verified' },
    { requirement: 'Dielectric withstand', output: '> 2.5× rated voltage', type: 'direct', status: 'verified' },
    { requirement: 'ESR measurement', output: '< 8 mΩ at 1 MHz', type: 'direct', status: 'verified' },
    { requirement: 'Temperature coefficient', output: 'X7R: ±15% over range', type: 'inferred', status: 'verified' },
    { requirement: 'RoHS compliance', output: 'EN 50581:2012 declared', type: 'direct', status: 'verified' },
  ],
}

const EVAL_CAP_ARRAY_GOVCO = {
  id: 'eval-070',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-03-05',
  requirements: 'MIL-PRF-55681 Compliance',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Bob Chen',
  reviewDate: '2026-03-06',
  claims: [
    { requirement: 'Capacitance stability', output: 'Within ±10% at 125°C', type: 'direct', status: 'verified' },
    { requirement: 'Insulation resistance', output: '> 10 GΩ at 25°C', type: 'direct', status: 'verified' },
    { requirement: 'Surge current rating', output: '5A peak, 1ms pulse', type: 'direct', status: 'verified' },
    {
      requirement: 'Tin whisker mitigation',
      output: 'Sn/Pb reflow — non-compliant with GEIA-STD-0005-2 §4.2',
      type: 'inferred',
      status: 'contested',
      dispute: {
        by: 'Murata Manufacturing',
        date: '2026-03-07',
        reason: 'Component uses matte tin finish with conformal coat per GEIA-STD-0005-2 §4.5 alternative mitigation. Whisker growth test (JESD201A) passed at 4000 hrs.',
      },
    },
  ],
}

const EVAL_PORTLAND_ISO = {
  id: 'eval-040',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-02-01',
  requirements: 'Environmental Compliance',
  status: 'completed',
  creditsUsed: 50,
  reviewer: 'Bob Chen',
  reviewDate: '2026-02-02',
  claims: [
    { requirement: 'ISO 14001 certification', output: 'Cert #EMS-2024-0891, valid through 2027', type: 'direct', status: 'verified' },
    { requirement: 'Waste management plan', output: 'RCRA compliant, zero violations 24 months', type: 'direct', status: 'verified' },
    { requirement: 'Air quality permit', output: 'DEQ Permit #34-0291-ST-01 active', type: 'direct', status: 'verified' },
    { requirement: 'Chemical inventory', output: 'Tier II report filed, 47 substances tracked', type: 'inferred', status: 'verified' },
    { requirement: 'Emergency response plan', output: 'LEPC-coordinated, last drill 2025-11-15', type: 'direct', status: 'verified' },
  ],
}

const EVAL_PORTLAND_ISO_SUPERSEDED = {
  id: 'eval-015',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2025-08-01',
  requirements: 'Environmental Compliance',
  status: 'superseded',
  creditsUsed: 50,
  reviewer: 'Bob Chen',
  reviewDate: '2025-08-02',
  claims: [],
}

const EVAL_CAL_GOVCO = {
  id: 'eval-065',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-02-20',
  requirements: 'Calibration Verification',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Bob Chen',
  reviewDate: '2026-02-21',
  claims: [
    { requirement: 'NIST traceability', output: 'Cal cert #NC-2026-0142, NIST traceable', type: 'direct', status: 'verified' },
    { requirement: 'Measurement uncertainty', output: 'U95 = ±0.003mm (k=2)', type: 'direct', status: 'verified' },
    { requirement: 'Calibration interval', output: '6-month cycle, last cal 2026-01-15', type: 'direct', status: 'verified' },
    { requirement: 'Environmental conditions', output: '20°C ±1°C, 45% ±5% RH during cal', type: 'inferred', status: 'verified' },
  ],
}

const EVAL_VENDOR_QUAL = {
  id: 'eval-068',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-02-25',
  requirements: 'Procurement Compliance',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Bob Chen',
  reviewDate: '2026-02-26',
  claims: [
    { requirement: 'Approved vendor list', output: '23 vendors, all AS9100D certified', type: 'direct', status: 'verified' },
    { requirement: 'Conflict minerals policy', output: 'SEC Rule 13p-1 compliant, CMRT v6.22 filed', type: 'direct', status: 'verified' },
    { requirement: 'Counterfeit parts prevention', output: 'AS6174 / AS6496 procedures active', type: 'direct', status: 'verified' },
    { requirement: 'Supplier audit schedule', output: '100% Tier-1 audited in trailing 12 months', type: 'inferred', status: 'verified' },
  ],
}

const EVAL_RFQ_FLOW = {
  id: 'eval-035',
  org: 'MicroCo',
  orgDot: DOTS.microco,
  date: '2026-01-10',
  requirements: 'Internal Process Audit',
  status: 'completed',
  creditsUsed: 30,
  reviewer: 'Alice Nguyen',
  reviewDate: '2026-01-11',
  claims: [
    { requirement: 'Process flow documented', output: 'BPMN 2.0 model rev 4.1 published', type: 'direct', status: 'verified' },
    { requirement: 'Approval gates defined', output: '4-gate review: Tech → Commercial → Legal → Exec', type: 'direct', status: 'verified' },
    { requirement: 'Cycle time target', output: '< 15 business days RFQ-to-quote', type: 'direct', status: 'verified' },
  ],
}

const EVAL_VREG_GOVCO = {
  id: 'eval-062',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-03-02',
  requirements: 'Component Screening',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Bob Chen',
  reviewDate: '2026-03-03',
  claims: [
    { requirement: 'Output voltage accuracy', output: '3.3V ±1% over temp range', type: 'direct', status: 'verified' },
    { requirement: 'Dropout voltage', output: '< 200mV at 500mA', type: 'direct', status: 'verified' },
    { requirement: 'PSRR', output: '> 60dB at 1 kHz', type: 'direct', status: 'verified' },
    { requirement: 'Latch-up immunity', output: 'JEDEC JESD78E Class II compliant', type: 'inferred', status: 'verified' },
  ],
}

const EVAL_PCB_GOVCO = {
  id: 'eval-063',
  org: 'GovCo',
  orgDot: DOTS.govco,
  date: '2026-03-02',
  requirements: 'Material Compliance',
  status: 'completed',
  creditsUsed: 30,
  reviewer: 'Bob Chen',
  reviewDate: '2026-03-03',
  claims: [
    { requirement: 'Laminate specification', output: 'Isola 370HR, Tg 180°C, Td 340°C', type: 'direct', status: 'verified' },
    { requirement: 'Copper weight', output: '1 oz (35µm) inner, 2 oz (70µm) outer', type: 'direct', status: 'verified' },
    { requirement: 'IPC-6012 class', output: 'Class 3/A (space/military)', type: 'direct', status: 'verified' },
  ],
}

// ── Alice-only evaluations (multi-buyer) ──

const EVAL_POWER_REG_ORBITAL = {
  id: 'eval-072',
  org: 'Orbital Systems Corp',
  orgDot: DOTS.orbital,
  date: '2026-02-28',
  requirements: 'Component Integration Check',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Marcus Webb',
  reviewDate: '2026-03-01',
  claims: [
    { requirement: 'Form factor compliance', output: 'Matches ICD-PWR-003 rev B footprint', type: 'direct', status: 'verified' },
    { requirement: 'EMI emissions', output: 'Below MIL-STD-461G RE102 limit', type: 'direct', status: 'verified' },
    { requirement: 'Power sequencing', output: 'Monotonic rise, < 5ms to regulation', type: 'direct', status: 'verified' },
    { requirement: 'Derating compliance', output: 'All components derated per EEE-INST-002', type: 'inferred', status: 'verified' },
  ],
}

const EVAL_CAP_ARRAY_ORBITAL = {
  id: 'eval-073',
  org: 'Orbital Systems Corp',
  orgDot: DOTS.orbital,
  date: '2026-02-20',
  requirements: 'Passive Component Screening',
  status: 'completed',
  creditsUsed: 30,
  reviewer: 'Marcus Webb',
  reviewDate: '2026-02-21',
  claims: [
    { requirement: 'DPA compliance', output: 'MIL-STD-1580 Group A passed', type: 'direct', status: 'verified' },
    { requirement: 'Lot traceability', output: 'Lot #MC-2025-4471 fully traceable to wafer', type: 'direct', status: 'verified' },
    { requirement: 'Vibration resistance', output: 'MIL-STD-883 Method 2007, Condition A passed', type: 'direct', status: 'verified' },
  ],
}

const EVAL_VREG_NORTHSTAR = {
  id: 'eval-074',
  org: 'Northstar Defense',
  orgDot: DOTS.northstar,
  date: '2026-02-10',
  requirements: 'Active Component Qualification',
  status: 'completed',
  creditsUsed: 50,
  reviewer: 'Dr. Sarah Kim',
  reviewDate: '2026-02-11',
  claims: [
    { requirement: 'Single-event effects', output: 'SEL immune to LET > 75 MeV·cm²/mg', type: 'direct', status: 'verified' },
    { requirement: 'Total ionizing dose', output: 'Functional to 300 krad(Si)', type: 'direct', status: 'verified' },
    { requirement: 'Thermal cycling', output: '-65°C to +150°C, 500 cycles, no degradation', type: 'direct', status: 'verified' },
    { requirement: 'Die attach integrity', output: 'SAM inspection — no voids > 10%', type: 'direct', status: 'verified' },
    { requirement: 'Wire bond pull test', output: 'Min 3.5 gf, mean 5.2 gf', type: 'direct', status: 'verified' },
  ],
}

const EVAL_CAL_DANAHER = {
  id: 'eval-075',
  org: 'Danaher Precision Systems',
  orgDot: DOTS.danaher,
  date: '2026-01-25',
  requirements: 'Calibration Standards Audit',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'James Park',
  reviewDate: '2026-01-26',
  claims: [
    { requirement: 'Reference standard traceability', output: 'Primary standards NIST cert #PS-2025-0087', type: 'direct', status: 'verified' },
    { requirement: 'Lab accreditation', output: 'ISO/IEC 17025:2017, A2LA cert #2847.01', type: 'direct', status: 'verified' },
    { requirement: 'Measurement capability index', output: 'Cg > 1.33 for all measured parameters', type: 'direct', status: 'verified' },
    { requirement: 'Gage R&R', output: '< 10% total variation (AIAG method)', type: 'direct', status: 'verified' },
  ],
}

// ── Alice-only evaluations for internal nodes ──

const EVAL_WAREHOUSE_ARCH = {
  id: 'eval-080',
  org: 'MicroCo',
  orgDot: DOTS.microco,
  date: '2026-01-05',
  requirements: 'Internal Systems Audit',
  status: 'completed',
  creditsUsed: 30,
  reviewer: 'Alice Nguyen',
  reviewDate: '2026-01-06',
  claims: [
    { requirement: 'System architecture documented', output: 'UML 2.5 diagrams rev 3.0, 14 views', type: 'direct', status: 'verified' },
    { requirement: 'Data flow mapping', output: 'All 23 integration points mapped', type: 'direct', status: 'verified' },
    { requirement: 'DR/BC plan', output: 'RPO < 1hr, RTO < 4hr, tested 2025-12-01', type: 'direct', status: 'verified' },
  ],
}

const EVAL_ARIBA_CERT = {
  id: 'eval-081',
  org: 'Ariba Procurement Solutions',
  orgDot: DOTS.ariba,
  date: '2026-02-05',
  requirements: 'Integration Certification',
  status: 'completed',
  creditsUsed: 40,
  reviewer: 'Raj Patel',
  reviewDate: '2026-02-06',
  claims: [
    { requirement: 'API conformance', output: 'cXML 1.2.050 full schema validated', type: 'direct', status: 'verified' },
    { requirement: 'Data mapping accuracy', output: '100% field coverage, 0 transformation errors', type: 'direct', status: 'verified' },
    { requirement: 'Performance SLA', output: '< 500ms P99 response, 99.95% uptime trailing 90d', type: 'direct', status: 'verified' },
    { requirement: 'Security assessment', output: 'SOC 2 Type II, pen test passed 2025-11-20', type: 'direct', status: 'verified' },
  ],
}

const EVAL_SUPPLIER_SCORECARD = {
  id: 'eval-082',
  org: 'MicroCo',
  orgDot: DOTS.microco,
  date: '2026-01-15',
  requirements: 'Internal Template Review',
  status: 'completed',
  creditsUsed: 20,
  reviewer: 'Alice Nguyen',
  reviewDate: '2026-01-16',
  claims: [
    { requirement: 'Scorecard criteria defined', output: '12 KPIs across quality, delivery, cost, compliance', type: 'direct', status: 'verified' },
    { requirement: 'Weighting methodology', output: 'AHP pairwise comparison, consistency ratio < 0.1', type: 'direct', status: 'verified' },
  ],
}

// ── Shared SDAs ──

const SDA_SELECTIVE_POWER = {
  id: 'sda-011',
  type: 'selective',
  party: 'GovCo',
  partyDot: DOTS.govco,
  created: '2025-10-15',
  expires: '2026-11-01',
  pins: [], // populated per-node below
}

const SDA_SELECTIVE_FACILITIES = {
  id: 'sda-012',
  type: 'selective',
  party: 'GovCo',
  partyDot: DOTS.govco,
  created: '2025-11-01',
  expires: '2027-01-01',
  pins: [],
}

const SDA_CASCADE_CAP = {
  id: 'sda-020',
  type: 'cascade',
  party: 'GovCo',
  partyDot: DOTS.govco,
  created: '2025-09-20',
  expires: '2026-08-15',
  pins: [],
  chain: [
    { from: 'Murata Manufacturing', to: 'MicroCo', sdaType: 'Selective', status: 'Active · expires 2026-12-01' },
    { from: 'MicroCo', to: 'GovCo', sdaType: 'Cascade (Selective)', status: 'Active · expires 2026-08-15' },
  ],
}

const SDA_PROOFONLY_CNC = {
  id: 'sda-013',
  type: 'proofonly',
  party: 'GovCo',
  partyDot: DOTS.govco,
  created: '2025-10-01',
  expires: '2026-08-15',
  pins: [],
  poeResult: 'PASS',
  evalRef: 'eval-075',
}

const SDA_INTERNAL_FULL = {
  id: 'sda-010',
  type: 'full',
  party: 'MicroCo',
  partyLabel: 'internal',
  partyDot: DOTS.microco,
  created: '2025-06-01',
  expires: null,
  pins: [],
  isOwnerSDA: true,
}

// ── Alice-only SDAs ──

const SDA_SELECTIVE_ORBITAL = {
  id: 'sda-030',
  type: 'selective',
  party: 'Orbital Systems Corp',
  partyDot: DOTS.orbital,
  created: '2025-11-15',
  expires: '2026-12-15',
  pins: [],
}

const SDA_SELECTIVE_NORTHSTAR = {
  id: 'sda-031',
  type: 'selective',
  party: 'Northstar Defense',
  partyDot: DOTS.northstar,
  created: '2025-12-01',
  expires: '2027-02-01',
  pins: [],
}

const SDA_SELECTIVE_ARIBA = {
  id: 'sda-032',
  type: 'selective',
  party: 'Ariba Procurement Solutions',
  partyDot: DOTS.ariba,
  created: '2025-12-15',
  expires: '2027-03-01',
  pins: [],
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
  } = opts

  const health = computeHealth(evaluations)
  const childHealth = children.length > 0 ? sumHealth(children) : null
  const totalHealth = childHealth
    ? { ok: health.ok + childHealth.ok, warn: 0, bad: health.bad + childHealth.bad }
    : null
  const claimCount = health.ok + health.bad
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
    claimCount,
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
    lastEval: evaluations.filter(e => e.status !== 'superseded').length > 0
      ? evaluations.filter(e => e.status !== 'superseded').sort((a, b) => b.date.localeCompare(a.date))[0].date
      : null,
  }
}

// ── Bob's dataset (GovCo buyer view) ──

function buildBobData() {
  // ── Leaf children first (bottom-up) ──

  const capArray = makeNode('cap-array', 'Ceramic Capacitor Array', 'product', 'Murata Manufacturing', {
    evaluations: [EVAL_CAP_ARRAY_MICROCO, EVAL_CAP_ARRAY_GOVCO],
    sdas: [{ ...SDA_CASCADE_CAP, pins: [] }],
    isCascade: true,
    cascadeVia: 'MicroCo (selective ← Murata Manufacturing)',
    evidence: makeEvidence('cap-array', 'SPEC-CC', 'Murata Manufacturing QMS', '7 years per MIL-STD'),
  })

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [EVAL_VREG_GOVCO],
    sdas: [{ ...SDA_SELECTIVE_POWER, pins: [] }],
    evidence: makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
  })

  const pcbSub = makeNode('pcb-sub', 'PCB Substrate', 'product', 'MicroCo', {
    evaluations: [EVAL_PCB_GOVCO],
    sdas: [{ ...SDA_SELECTIVE_POWER, pins: [] }],
    childCountOverride: 2, // deeper children not expanded
    evidence: makeEvidence('pcb-sub', 'SPEC-PCB', 'MicroCo Materials Lab', '10 years per ITAR'),
  })

  const portlandIso = makeNode('portland-iso', 'Facility Certification — ISO 14001', 'product', 'MicroCo', {
    evaluations: [EVAL_PORTLAND_ISO, EVAL_PORTLAND_ISO_SUPERSEDED],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    parentId: 'portland',
    evidence: makeEvidence('portland-iso', 'CERT-ISO', 'BSI Group Certification', 'Duration of certification + 3 years'),
  })

  const cncCal = makeNode('cnc-cal', 'Calibration Record', 'product', 'MicroCo', {
    evaluations: [EVAL_CAL_GOVCO],
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    parentId: 'cnc',
    evidence: makeEvidence('cnc-cal', 'CAL-RPT', 'Danaher Precision Systems', '5 years per ISO 17025'),
  })

  const cncMaint = makeNode('cnc-maint', 'Maintenance Log Q4', 'product', 'MicroCo', {
    evaluations: [], // intentionally empty — incomplete coverage
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    parentId: 'cnc',
    evidence: makeEvidence('cnc-maint', 'MAINT-LOG', 'MicroCo Facilities', '3 years per internal policy'),
  })

  const procVendor = makeNode('proc-vendor', 'Vendor Qualification Docs', 'product', 'MicroCo', {
    evaluations: [EVAL_VENDOR_QUAL],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    parentId: 'procurement',
    evidence: makeEvidence('proc-vendor', 'VQ-DOC', 'MicroCo Procurement', '7 years per FAR 4.703'),
  })

  const rfqFlow = makeNode('rfq-flow', 'Process Flow Document', 'product', 'MicroCo', {
    evaluations: [EVAL_RFQ_FLOW],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    parentId: 'rfq',
    evidence: makeEvidence('rfq-flow', 'PROC-FLOW', 'MicroCo Process Engineering', 'Duration of process + 2 years'),
  })

  // ── Depth-1 nodes ──

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [EVAL_POWER_REG_GOVCO, EVAL_POWER_REG_INTERNAL],
    sdas: [{ ...SDA_SELECTIVE_POWER, pins: [] }, { ...SDA_INTERNAL_FULL, pins: [] }],
    children: [capArray, vregIc, pcbSub],
    evidence: makeEvidence('power-reg', 'ASSY-PRM', 'MicroCo Quality Lab', '10 years per MIL-STD-129'),
    x: 500,
    y: -300,
  })

  const portland = makeNode('portland', 'Portland Facility', 'place', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    children: [portlandIso],
    x: 500,
    y: -100,
  })

  const cnc = makeNode('cnc', 'CNC Machining Line 3', 'process', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    children: [cncCal, cncMaint],
    x: 500,
    y: 100,
  })

  const procurement = makeNode('procurement', 'Procurement Office', 'place', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    children: [procVendor],
    x: 500,
    y: 300,
  })

  const rfq = makeNode('rfq', 'RFQ Process', 'process', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    children: [rfqFlow],
    x: 500,
    y: 500,
  })

  // ── Party node ──

  const microco = makeNode('microco', 'MicroCo', 'party', null, {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_FULL, pins: [] }],
    children: [], // top-level children connected via edges, not nesting
    x: 0,
    y: 0,
  })

  const nodes = [microco, powerReg, portland, cnc, procurement, rfq]

  const edges = [
    { id: 'edge-microco-power-reg', from: 'microco', to: 'power-reg', sdaType: 'selective' },
    { id: 'edge-microco-portland', from: 'microco', to: 'portland', sdaType: 'selective' },
    { id: 'edge-microco-cnc', from: 'microco', to: 'cnc', sdaType: 'proofonly' },
    { id: 'edge-microco-procurement', from: 'microco', to: 'procurement', sdaType: 'selective' },
    { id: 'edge-microco-rfq', from: 'microco', to: 'rfq', sdaType: 'selective' },
    // Cross-links
    { id: 'edge-cnc-portland', from: 'cnc', to: 'portland', sdaType: 'proofonly' },
    { id: 'edge-rfq-procurement', from: 'rfq', to: 'procurement', sdaType: 'selective' },
  ]

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })
  addChildrenToMap(nodes, nodeMap)

  return { nodes, edges, nodeMap, existingCascades: [], pendingRequests: [] }
}

// ── Alice's dataset (MicroCo seller view) ──

function buildAliceData() {
  // ── Same leaves as Bob, but some get extra evaluations ──

  const capArray = makeNode('cap-array', 'Ceramic Capacitor Array', 'product', 'Murata Manufacturing', {
    evaluations: [EVAL_CAP_ARRAY_MICROCO, EVAL_CAP_ARRAY_GOVCO, EVAL_CAP_ARRAY_ORBITAL],
    sdas: [{ ...SDA_CASCADE_CAP, pins: [] }, { ...SDA_SELECTIVE_ORBITAL, pins: [] }],
    isCascade: true,
    cascadeVia: 'MicroCo (selective ← Murata Manufacturing)',
    evidence: makeEvidence('cap-array', 'SPEC-CC', 'Murata Manufacturing QMS', '7 years per MIL-STD'),
    upstreamSda: {
      type: 'selective',
      policy: 'open',
      owner: 'Murata Manufacturing',
      ownerDot: 'DOT-0x9f1b...c2e8',
    },
  })

  const vregIc = makeNode('vreg-ic', 'Voltage Regulator IC', 'product', 'MicroCo', {
    evaluations: [EVAL_VREG_GOVCO, EVAL_VREG_NORTHSTAR],
    sdas: [{ ...SDA_SELECTIVE_POWER, pins: [] }, { ...SDA_SELECTIVE_NORTHSTAR, pins: [] }],
    evidence: makeEvidence('vreg-ic', 'SPEC-VR', 'MicroCo Component Lab', '10 years per ITAR'),
    upstreamSda: {
      type: 'full',
      policy: 'open',
      owner: 'Texas Instruments',
      ownerDot: 'DOT-0x3b7f...a4d2',
    },
  })

  const pcbSub = makeNode('pcb-sub', 'PCB Substrate', 'product', 'MicroCo', {
    evaluations: [EVAL_PCB_GOVCO],
    sdas: [{ ...SDA_SELECTIVE_POWER, pins: [] }],
    childCountOverride: 2,
    evidence: makeEvidence('pcb-sub', 'SPEC-PCB', 'MicroCo Materials Lab', '10 years per ITAR'),
    upstreamSda: {
      type: 'selective',
      policy: 'closed',
      owner: 'Isola Group',
      ownerDot: 'DOT-0x6e2a...d8c1',
    },
  })

  const portlandIso = makeNode('portland-iso', 'Facility Certification — ISO 14001', 'product', 'MicroCo', {
    evaluations: [EVAL_PORTLAND_ISO, EVAL_PORTLAND_ISO_SUPERSEDED],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }, { ...SDA_SELECTIVE_NORTHSTAR, pins: [] }],
    parentId: 'portland',
    evidence: makeEvidence('portland-iso', 'CERT-ISO', 'BSI Group Certification', 'Duration of certification + 3 years'),
  })

  const cncCal = makeNode('cnc-cal', 'Calibration Record', 'product', 'MicroCo', {
    evaluations: [EVAL_CAL_GOVCO, EVAL_CAL_DANAHER],
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    parentId: 'cnc',
    evidence: makeEvidence('cnc-cal', 'CAL-RPT', 'Danaher Precision Systems', '5 years per ISO 17025'),
  })

  const cncMaint = makeNode('cnc-maint', 'Maintenance Log Q4', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    parentId: 'cnc',
    evidence: makeEvidence('cnc-maint', 'MAINT-LOG', 'MicroCo Facilities', '3 years per internal policy'),
  })

  const procVendor = makeNode('proc-vendor', 'Vendor Qualification Docs', 'product', 'MicroCo', {
    evaluations: [EVAL_VENDOR_QUAL],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    parentId: 'procurement',
    evidence: makeEvidence('proc-vendor', 'VQ-DOC', 'MicroCo Procurement', '7 years per FAR 4.703'),
  })

  const rfqFlow = makeNode('rfq-flow', 'Process Flow Document', 'product', 'MicroCo', {
    evaluations: [EVAL_RFQ_FLOW],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    parentId: 'rfq',
    evidence: makeEvidence('rfq-flow', 'PROC-FLOW', 'MicroCo Process Engineering', 'Duration of process + 2 years'),
  })

  // ── Alice-only leaf children ──

  const warehouseArch = makeNode('warehouse-arch', 'System Architecture Doc', 'product', 'MicroCo', {
    evaluations: [EVAL_WAREHOUSE_ARCH],
    sdas: [],
    parentId: 'warehouse',
    evidence: makeEvidence('warehouse-arch', 'SYS-ARCH', 'MicroCo IT Systems', 'Duration of system lifecycle'),
  })

  const aribaCert = makeNode('ariba-cert', 'Ariba Integration Cert', 'product', 'MicroCo', {
    evaluations: [EVAL_ARIBA_CERT],
    sdas: [{ ...SDA_SELECTIVE_ARIBA, pins: [] }],
    parentId: 'supplier-quals',
    evidence: makeEvidence('ariba-cert', 'INT-CERT', 'Ariba Procurement Solutions', 'Duration of integration + 1 year'),
  })

  const supplierScorecard = makeNode('supplier-scorecard', 'Supplier Scorecard Template', 'product', 'MicroCo', {
    evaluations: [EVAL_SUPPLIER_SCORECARD],
    sdas: [],
    parentId: 'supplier-quals',
    evidence: makeEvidence('supplier-scorecard', 'SC-TMPL', 'MicroCo Procurement', 'Internal — no retention requirement'),
  })

  // ── Depth-1 nodes (shared + Alice extras) ──

  const powerReg = makeNode('power-reg', 'Power Regulation Module', 'product', 'MicroCo', {
    evaluations: [EVAL_POWER_REG_GOVCO, EVAL_POWER_REG_INTERNAL, EVAL_POWER_REG_ORBITAL],
    sdas: [
      { ...SDA_SELECTIVE_POWER, pins: [] },
      { ...SDA_SELECTIVE_ORBITAL, pins: [] },
      { ...SDA_INTERNAL_FULL, pins: [] },
    ],
    children: [capArray, vregIc, pcbSub],
    evidence: makeEvidence('power-reg', 'ASSY-PRM', 'MicroCo Quality Lab', '10 years per MIL-STD-129'),
    x: 500,
    y: -200,
  })

  const portland = makeNode('portland', 'Portland Facility', 'place', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }, { ...SDA_SELECTIVE_NORTHSTAR, pins: [] }],
    children: [portlandIso],
    x: 500,
    y: 0,
  })

  const cnc = makeNode('cnc', 'CNC Machining Line 3', 'process', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_PROOFONLY_CNC, pins: [] }],
    children: [cncCal, cncMaint],
    x: 500,
    y: 200,
  })

  const procurement = makeNode('procurement', 'Procurement Office', 'place', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    children: [procVendor],
    x: 500,
    y: 400,
  })

  const rfq = makeNode('rfq', 'RFQ Process', 'process', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_FACILITIES, pins: [] }],
    children: [rfqFlow],
    x: 500,
    y: 600,
  })

  // ── Alice-only depth-1 nodes ──

  const warehouse = makeNode('warehouse', 'Warehouse Inventory System', 'process', 'MicroCo', {
    evaluations: [],
    sdas: [],
    children: [warehouseArch],
    x: 500,
    y: 800,
  })

  const supplierQuals = makeNode('supplier-quals', 'Supplier Qualification Records', 'product', 'MicroCo', {
    evaluations: [],
    sdas: [{ ...SDA_SELECTIVE_ARIBA, pins: [] }],
    children: [aribaCert, supplierScorecard],
    x: 500,
    y: 1000,
  })

  // ── Party node ──

  const microco = makeNode('microco', 'MicroCo', 'party', null, {
    evaluations: [],
    sdas: [{ ...SDA_INTERNAL_FULL, pins: [] }],
    children: [],
    x: 0,
    y: 200,
  })

  const nodes = [microco, powerReg, portland, cnc, procurement, rfq, warehouse, supplierQuals]

  const edges = [
    { id: 'edge-microco-power-reg', from: 'microco', to: 'power-reg', sdaType: 'selective' },
    { id: 'edge-microco-portland', from: 'microco', to: 'portland', sdaType: 'selective' },
    { id: 'edge-microco-cnc', from: 'microco', to: 'cnc', sdaType: 'proofonly' },
    { id: 'edge-microco-procurement', from: 'microco', to: 'procurement', sdaType: 'selective' },
    { id: 'edge-microco-rfq', from: 'microco', to: 'rfq', sdaType: 'selective' },
    { id: 'edge-microco-warehouse', from: 'microco', to: 'warehouse', sdaType: 'full' },
    { id: 'edge-microco-supplier-quals', from: 'microco', to: 'supplier-quals', sdaType: 'selective' },
    // Cross-links
    { id: 'edge-cnc-portland', from: 'cnc', to: 'portland', sdaType: 'proofonly' },
    { id: 'edge-rfq-procurement', from: 'rfq', to: 'procurement', sdaType: 'selective' },
  ]

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })
  addChildrenToMap(nodes, nodeMap)

  return {
    nodes, edges, nodeMap,
    existingCascades: [
      { assetId: 'cap-array', toParty: 'GovCo' },
    ],
    pendingRequests: [
      {
        id: 'req-001',
        from: { name: 'GovCo', dot: 'DOT-0x7a3f...e1b2' },
        asset: { name: 'Power Regulation Module', pin: powerReg.pin },
        requestedLevel: 'selective',
        message: "We're evaluating MicroCo components for the Sentinel-4 satellite program. We need to run MIL-PRF-55681 compliance checks against your Power Regulation Module.",
        requirements: ['MIL-PRF-55681 Compliance', 'System Integration Requirements'],
        date: '2026-03-05',
      },
      {
        id: 'req-002',
        from: { name: 'Orbital Systems Corp', dot: 'DOT-0x8b3e...d2f5' },
        asset: { name: 'Ceramic Capacitor Array', pin: capArray.pin },
        requestedLevel: 'full',
        message: 'Requesting full disclosure for component integration testing on the Orion-X platform. We need to run capacitance tolerance and thermal cycling evaluations.',
        requirements: ['Component Integration Check', 'Passive Component Screening'],
        date: '2026-03-07',
      },
    ],
  }
}

// ── Public API ──

export function getDataForRole(roleId) {
  if (roleId === 'alice-microco') return buildAliceData()
  return buildBobData()
}
