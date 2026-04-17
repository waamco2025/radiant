// V3 Data Layer — Actor + Object + Edge
// No type flags. Artifact schema determines rendering.

// ── Dynamic state (runtime additions) ──
let dynamicObjects = []
let dynamicEdges = []

export function addObject(obj) { dynamicObjects.push(obj) }
export function addEdge(edge) { dynamicEdges.push(edge) }
export function resetDynamicData() { dynamicObjects = []; dynamicEdges = [] }

let pinCounter = 1000
export function generatePin() {
  pinCounter++
  const hex = pinCounter.toString(16).padStart(16, '0').toUpperCase()
  return `PIN-0x${hex}`
}

export const actors = [
  { id: 'actor-bob', name: 'Bob Donloe', org: 'GovCo', dot: 'DOT-GOV-001' },
  { id: 'actor-alice', name: 'Alice Nakamura', org: 'MicroCo', dot: 'DOT-MCO-001' },
]

export const objects = [
  // ── Actor objects (organizations as nodes) ──
  {
    id: 'actor-bob',
    name: 'GovCo',
    pin: 'PIN-0x0000000000000001',
    dot: 'DOT-GOV-001',
    owner: 'actor-bob',
    artifactUri: null,
    artifact: null,
    provenance: null,
    date: '2026-01-01',
    dateTime: '2026-01-01T00:00:00Z',
  },
  {
    id: 'actor-alice',
    name: 'MicroCo',
    pin: 'PIN-0x0000000000000002',
    dot: 'DOT-MCO-001',
    owner: 'actor-alice',
    artifactUri: null,
    artifact: null,
    provenance: null,
    date: '2026-01-01',
    dateTime: '2026-01-01T00:00:00Z',
  },

  // ── Bob's objects (GovCo) ──
  {
    id: 'obj-sentinel',
    name: 'Sentinel-4 Program',
    pin: 'PIN-0x3A7F92B1E8D04C6A',
    dot: 'DOT-GOV-S4P',
    owner: 'actor-bob',
    artifactUri: 'qs://govco/sentinel-4-program.pdf',
    artifact: { filename: 'sentinel-4-program.pdf', size: 2048576, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-15',
    dateTime: '2026-03-15T09:30:00Z',
  },
  {
    id: 'obj-avionics',
    name: 'Avionics Module',
    pin: 'PIN-0x1B4E6A8C3F0D72E5',
    dot: 'DOT-GOV-AVM',
    owner: 'actor-bob',
    artifactUri: 'qs://govco/avionics-module-spec.pdf',
    artifact: { filename: 'avionics-module-spec.pdf', size: 1536000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-16',
    dateTime: '2026-03-16T11:00:00Z',
  },
  {
    id: 'obj-propulsion',
    name: 'Propulsion System',
    pin: 'PIN-0x7C2D9F5A4B1E68D3',
    dot: 'DOT-GOV-PRS',
    owner: 'actor-bob',
    artifactUri: 'qs://govco/propulsion-system-spec.pdf',
    artifact: { filename: 'propulsion-system-spec.pdf', size: 3072000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-17',
    dateTime: '2026-03-17T14:20:00Z',
  },
  {
    id: 'obj-sentinel-parse',
    name: 'Sentinel-4 Program Parse Result',
    pin: 'PIN-0x9E1A3B5D7F2C48A6',
    dot: 'DOT-GOV-S4R',
    owner: 'actor-bob',
    artifactUri: 'qs://govco/sentinel-4-parse.json',
    artifact: {
      schema: 'parse-output',
      template: 'Defense Systems Profile',
      fields: [
        { id: 'f-program', name: 'Program name', instruction: 'Extract the official program designation as stated in the document header or title page.', value: 'Sentinel-4', confidence: 0.98 },
        { id: 'f-classification', name: 'Classification level', instruction: 'Identify the highest classification marking on the document. Look for banner markings or classification authority blocks.', value: 'UNCLASSIFIED//FOUO', confidence: 0.95 },
        { id: 'f-contractor', name: 'Prime contractor', instruction: 'Identify the prime contractor organization. Check the title page, distribution statement, or contract data block.', value: 'Northvane Aerospace', confidence: 0.92 },
        { id: 'f-contract', name: 'Contract number', instruction: 'Extract the contract or task order number. Look for FAR/DFARS-formatted contract numbers.', value: 'FA8802-26-C-0042', confidence: 0.97 },
        { id: 'f-milestone', name: 'Current milestone', instruction: 'Determine the current acquisition milestone or program phase. Return the abbreviation.', value: 'CDR', confidence: 0.88 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-sentinel',
      process: 'parse',
      template: 'Defense Systems Profile',
      timestamp: '2026-03-18T08:15:00Z',
    },
    date: '2026-03-18',
    dateTime: '2026-03-18T08:15:00Z',
  },
  {
    id: 'obj-avionics-eval',
    name: 'Avionics Module Evaluation',
    pin: 'PIN-0x4D6F8A2E1C3B59D7',
    dot: 'DOT-GOV-AVE',
    owner: 'actor-bob',
    artifactUri: 'qs://govco/avionics-eval.json',
    artifact: {
      schema: 'eval-output',
      template: 'AS9100 Rev D Compliance',
      requirements: [
        { id: 'req-001', name: 'Design documentation', instruction: 'Verify that a complete design documentation package exists with full requirements traceability.', criterion: 'Design package must include requirements traceability matrix, interface control documents, and test procedures per AS9100 §8.3.', value: 'Complete traceability matrix present, 142 requirements traced to test cases', sat: true, status: 'sat', confidence: 0.94 },
        { id: 'req-002', name: 'Environmental testing', instruction: 'Check for environmental test reports covering vibration, thermal cycling, and humidity per MIL-STD-810H.', criterion: 'Must pass MIL-STD-810H Methods 514.8 (vibration), 501.7/502.7 (thermal), and 507.6 (humidity).', value: 'MIL-STD-810H Methods 514.8, 501.7, 502.7, 507.6 — all passed', sat: true, status: 'sat', confidence: 0.91 },
        { id: 'req-003', name: 'EMI/EMC compliance', instruction: 'Extract EMI/EMC test results. Check for MIL-STD-461G compliance data, particularly RE102 and CE102.', criterion: 'Must meet MIL-STD-461G RE102 and CE102 limits with minimum 6dB margin across all frequency bands.', value: 'RE102 margin 2.1dB at 2.4 GHz — below required 6dB threshold', sat: false, status: 'unsat', confidence: 0.89 },
        { id: 'req-004', name: 'Reliability analysis', instruction: 'Extract reliability predictions or demonstration test results. Look for MTBF calculations per MIL-HDBK-217.', criterion: 'Predicted or demonstrated MTBF must exceed 10,000 hours per MIL-HDBK-217F.', value: 'MTBF predicted at 14,200 hours per MIL-HDBK-217F, parts count method', sat: true, status: 'sat', confidence: 0.93 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-avionics',
      process: 'evaluate',
      template: 'AS9100 Rev D Compliance',
      timestamp: '2026-03-19T16:45:00Z',
    },
    date: '2026-03-19',
    dateTime: '2026-03-19T16:45:00Z',
  },

  // ── Alice's objects (MicroCo) ──
  {
    id: 'obj-mc-chip',
    name: 'MC-7 Processor',
    pin: 'PIN-0x5F3A1D8E6B2C74A9',
    dot: 'DOT-MCO-MC7',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/mc7-datasheet.pdf',
    artifact: { filename: 'mc7-datasheet.pdf', size: 4096000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-10',
    dateTime: '2026-03-10T10:00:00Z',
  },
  {
    id: 'obj-mc-chip-parse',
    name: 'MC-7 Processor Parse Result',
    pin: 'PIN-0x2E7B9C4A1F6D385E',
    dot: 'DOT-MCO-M7P',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/mc7-parse.json',
    artifact: {
      schema: 'parse-output',
      template: 'Electronics Component Profile',
      fields: [
        { id: 'f-voltage', name: 'Operating voltage', instruction: 'Extract the recommended operating voltage range and tolerance from the electrical characteristics table.', value: '1.0V core, 3.3V I/O ±5%', confidence: 0.97 },
        { id: 'f-power', name: 'Power dissipation', instruction: 'Extract the maximum power dissipation at rated current and ambient temperature.', value: '15W TDP at 3.2 GHz', confidence: 0.94 },
        { id: 'f-temp', name: 'Temperature range', instruction: 'Extract the operating temperature range from the recommended operating conditions.', value: '-40°C to +125°C', confidence: 0.93 },
        { id: 'f-radiation', name: 'Radiation tolerance', instruction: 'Extract the total ionizing dose (TID) tolerance if specified. May not be present in commercial datasheets.', value: 'TID > 100 krad(Si)', confidence: 0.78 },
        { id: 'f-package', name: 'Package type', instruction: 'Extract the IC package type designation from the ordering information or package outline section.', value: 'CQFP-256', confidence: 0.96 },
        { id: 'f-leads', name: 'Lead count', instruction: 'Extract the number of leads/pins from the pin configuration or package outline.', value: '256', confidence: 0.99 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-mc-chip',
      process: 'parse',
      template: 'Electronics Component Profile',
      timestamp: '2026-03-11T14:30:00Z',
    },
    date: '2026-03-11',
    dateTime: '2026-03-11T14:30:00Z',
  },
  {
    id: 'obj-mc-chip-eval',
    name: 'MC-7 Processor Evaluation',
    pin: 'PIN-0x8A4C2F6E9D1B73A5',
    dot: 'DOT-MCO-M7E',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/mc7-eval.json',
    artifact: {
      schema: 'eval-output',
      template: 'MIL-PRF-55681 Compliance',
      requirements: [
        { id: 'req-001', name: 'Power output stability', instruction: 'Extract the rated output voltage and tolerance under load from the electrical specifications.', criterion: 'Output voltage must be within ±5% of nominal under rated load conditions.', value: '3.3V ±3% under 500mA load — within ±5% tolerance', sat: true, status: 'sat', confidence: 0.96 },
        { id: 'req-002', name: 'Thermal dissipation', instruction: 'Extract the maximum power dissipation at rated current from the thermal characteristics section.', criterion: 'Power dissipation must not exceed 2.5W at maximum rated current and 85°C ambient.', value: '1.8W at rated current, 25°C ambient — within 2.5W limit', sat: true, status: 'sat', confidence: 0.92 },
        { id: 'req-003', name: 'Operating temperature range', instruction: 'Extract the operating temperature range from the recommended operating conditions.', criterion: 'Must support full military temperature range: -55°C to +125°C minimum.', value: '-40°C to +125°C — does not meet -55°C minimum', sat: false, status: 'unsat', confidence: 0.95 },
        { id: 'req-004', name: 'Radiation tolerance', instruction: 'Extract total ionizing dose (TID) tolerance from radiation hardness assurance data.', criterion: 'TID tolerance must exceed 100 krad(Si) for LEO mission profile.', value: 'TID > 100 krad(Si), SEL immune to 80 MeV·cm²/mg', sat: true, status: 'sat', confidence: 0.78 },
        { id: 'req-005', name: 'ITAR classification', instruction: 'Identify export control classification from compliance markings or distribution statements.', criterion: 'Must have a valid USML or CCL classification. Unclassified items require EAR99 or explicit ECCN.', value: 'Category XV, §121.1 — USML controlled', sat: true, status: 'sat', confidence: 0.97 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-mc-chip',
      process: 'evaluate',
      template: 'MIL-PRF-55681 Compliance',
      timestamp: '2026-03-12T09:00:00Z',
    },
    date: '2026-03-12',
    dateTime: '2026-03-12T09:00:00Z',
  },
  {
    id: 'obj-mc-sensor',
    name: 'TH-400 Thermal Sensor',
    pin: 'PIN-0x6D9E3B7A2C1F485D',
    dot: 'DOT-MCO-TH4',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/th400-datasheet.pdf',
    artifact: { filename: 'th400-datasheet.pdf', size: 2560000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-08',
    dateTime: '2026-03-08T15:45:00Z',
  },
  {
    id: 'obj-mc-sensor-parse',
    name: 'TH-400 Thermal Sensor Parse Result',
    pin: 'PIN-0xA3F7E1D94B2C685E',
    dot: 'DOT-MCO-T4P',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/th400-parse.json',
    artifact: {
      schema: 'parse-output',
      template: 'Electronics Component Profile',
      fields: [
        { id: 'f-voltage', name: 'Operating voltage', instruction: 'Extract the recommended operating voltage range and tolerance from the electrical characteristics table.', value: '5V excitation ±0.5%', confidence: 0.96 },
        { id: 'f-temp', name: 'Temperature range', instruction: 'Extract the operating temperature range from the recommended operating conditions.', value: '-200°C to +850°C', confidence: 0.98 },
        { id: 'f-package', name: 'Package type', instruction: 'Extract the IC package type designation from the ordering information or package outline section.', value: 'Ceramic RTD probe, 3-wire', confidence: 0.92 },
        { id: 'f-rohs', name: 'RoHS status', instruction: 'Determine RoHS compliance status. Look for RoHS compliance declarations or lead-free designations.', value: 'Compliant', confidence: 0.95 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-mc-sensor',
      process: 'parse',
      template: 'Electronics Component Profile',
      timestamp: '2026-03-09T10:30:00Z',
    },
    date: '2026-03-09',
    dateTime: '2026-03-09T10:30:00Z',
  },
  {
    id: 'obj-mc-board',
    name: 'PCB-X9 Control Board',
    pin: 'PIN-0xB5C8D2A4E9F1367A',
    dot: 'DOT-MCO-PX9',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/pcb-x9-spec.pdf',
    artifact: { filename: 'pcb-x9-spec.pdf', size: 1792000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-12',
    dateTime: '2026-03-12T08:00:00Z',
  },
  {
    id: 'obj-mc-board-eval',
    name: 'PCB-X9 Control Board Evaluation',
    pin: 'PIN-0xE4A7F3C1D2B568A9',
    dot: 'DOT-MCO-PXE',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/pcb-x9-eval.json',
    artifact: {
      schema: 'eval-output',
      template: 'IPC-A-610 Workmanship',
      requirements: [
        { id: 'req-041', name: 'Solder joint quality', instruction: 'Assess solder joint quality from inspection reports or X-ray imagery data referenced in the documentation.', criterion: 'All solder joints must meet IPC-A-610 Class 3 criteria. No cold joints, bridges, or insufficient wetting.', value: 'X-ray inspection passed — no voids >25%, no bridges detected', sat: true, status: 'sat', confidence: 0.94 },
        { id: 'req-042', name: 'Trace width and spacing', instruction: 'Extract minimum trace width and spacing from the PCB design documentation or fab drawing.', criterion: 'Trace width and spacing must meet IPC-2221B Class 3 minimums for the voltage class.', value: '4mil trace / 4mil space minimum — exceeds Class 3 requirement', sat: true, status: 'sat', confidence: 0.91 },
        { id: 'req-043', name: 'Via integrity', instruction: 'Check via reliability data from cross-section analysis, microsection reports, or thermal cycling test results.', criterion: 'Vias must pass IPC-TM-650 thermal stress test. No barrel cracking or separation.', value: 'Micro-via reliability concern at layer 6 — marginal barrel cracking after 4x reflow', sat: false, status: 'unsat', confidence: 0.82 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-mc-board',
      process: 'evaluate',
      template: 'IPC-A-610 Workmanship',
      timestamp: '2026-03-14T11:20:00Z',
    },
    date: '2026-03-14',
    dateTime: '2026-03-14T11:20:00Z',
  },
  {
    id: 'obj-mc-housing',
    name: 'AL-Frame Housing',
    pin: 'PIN-0xC1D4E7A2B5F3968A',
    dot: 'DOT-MCO-ALF',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/al-frame-cert.pdf',
    artifact: { filename: 'al-frame-cert.pdf', size: 1024000, mimeType: 'application/pdf' },
    provenance: null,
    date: '2026-03-06',
    dateTime: '2026-03-06T13:15:00Z',
  },
  {
    id: 'obj-mc-housing-eval',
    name: 'AL-Frame Housing Evaluation',
    pin: 'PIN-0xF2A8C6D3E1B4579A',
    dot: 'DOT-MCO-ALE',
    owner: 'actor-alice',
    artifactUri: 'qs://microco/al-frame-eval.json',
    artifact: {
      schema: 'eval-output',
      template: 'ASTM B221 Material Compliance',
      requirements: [
        { id: 'req-051', name: 'Tensile strength', instruction: 'Extract the ultimate tensile strength value from the material test report or certification.', criterion: 'Ultimate tensile strength must meet or exceed 275 MPa per ASTM B221 for 6061-T6.', value: '310 MPa — exceeds 275 MPa minimum', sat: true, status: 'sat', confidence: 0.97 },
        { id: 'req-052', name: 'Hardness testing', instruction: 'Extract the hardness measurement and scale used from the test report or material cert.', criterion: 'Brinell hardness must be 80–120 HB per ASTM B221 specification for 6061-T6.', value: 'Brinell 95 HB — within 80-120 HB range', sat: true, status: 'sat', confidence: 0.95 },
        { id: 'req-053', name: 'Dimensional tolerance', instruction: 'Extract the tightest dimensional tolerance callout from the engineering drawing.', criterion: 'All critical dimensions must be within ±0.05mm per drawing tolerances.', value: 'All mating surfaces within ±0.03mm — tighter than required ±0.05mm', sat: true, status: 'sat', confidence: 0.88 },
        { id: 'req-054', name: 'Surface finish', instruction: 'Extract the surface treatment or finish specification from the drawing or process spec.', criterion: 'Must have Type III hard anodize per MIL-A-8625F, thickness 0.002-0.003 inch.', value: 'Type III hard anodize verified, 0.0025 inch thickness measured', sat: true, status: 'sat', confidence: 0.93 },
      ],
    },
    provenance: {
      derivedFrom: 'obj-mc-housing',
      process: 'evaluate',
      template: 'ASTM B221 Material Compliance',
      timestamp: '2026-03-07T16:00:00Z',
    },
    date: '2026-03-07',
    dateTime: '2026-03-07T16:00:00Z',
  },

  // ── Disclosure agreement objects ──
  {
    id: 'obj-disc-1',
    name: 'MC-7 Full Disclosure Agreement',
    pin: 'PIN-0xD3E5A7B9C1F2684A',
    dot: 'DOT-DIS-001',
    owner: 'actor-alice',
    artifactUri: 'qs://shared/disc-mc7-full.json',
    artifact: {
      schema: 'disclosure-agreement',
      type: 'full',
      parties: {
        discloser: { actorId: 'actor-alice', name: 'Alice Nakamura', org: 'MicroCo' },
        recipient: { actorId: 'actor-bob', name: 'Bob Donloe', org: 'GovCo' },
      },
      scope: { objectId: 'obj-mc-chip', includeDerivatives: true },
      terms: { duration: '12 months', autoRenew: false },
      executedAt: '2026-03-20T10:00:00Z',
    },
    provenance: null,
    date: '2026-03-20',
    dateTime: '2026-03-20T10:00:00Z',
  },
  {
    id: 'obj-disc-2',
    name: 'TH-400 Proof-Only Disclosure',
    pin: 'PIN-0xA1B2C3D4E5F6789A',
    dot: 'DOT-DIS-002',
    owner: 'actor-alice',
    artifactUri: 'qs://shared/disc-th400-proof.json',
    artifact: {
      schema: 'disclosure-agreement',
      type: 'selective',
      parties: {
        discloser: { actorId: 'actor-alice', name: 'Alice Nakamura', org: 'MicroCo' },
        recipient: { actorId: 'actor-bob', name: 'Bob Donloe', org: 'GovCo' },
      },
      scope: { objectId: 'obj-mc-sensor', includeDerivatives: false },
      terms: { duration: '6 months', autoRenew: true },
      executedAt: '2026-03-21T14:30:00Z',
    },
    provenance: null,
    date: '2026-03-21',
    dateTime: '2026-03-21T14:30:00Z',
  },
]

export const edges = [
  // ── Bob's view: GovCo internal structure (full disclosure = org owns all these) ──
  { id: 'e-govco-sentinel', from: 'actor-bob', to: 'obj-sentinel', sdaType: 'full' },
  { id: 'e-sentinel-propulsion', from: 'obj-sentinel', to: 'obj-propulsion', sdaType: 'full' },
  { id: 'e-sentinel-avionics', from: 'obj-sentinel', to: 'obj-avionics', sdaType: 'full' },

  // ── Cross-org disclosures: Alice's objects disclosed to Bob via Avionics ──
  { id: 'e-avionics-mc7', from: 'obj-avionics', to: 'obj-mc-chip', sdaType: 'full', agreementObjectId: 'obj-disc-1' },
  { id: 'e-avionics-th400', from: 'obj-avionics', to: 'obj-mc-sensor', sdaType: 'selective', agreementObjectId: 'obj-disc-2' },

  // ── Alice's view: MicroCo internal structure ──
  { id: 'e-microco-mc7', from: 'actor-alice', to: 'obj-mc-chip', sdaType: 'full' },
  { id: 'e-microco-th400', from: 'actor-alice', to: 'obj-mc-sensor', sdaType: 'full' },
  { id: 'e-microco-board', from: 'actor-alice', to: 'obj-mc-board', sdaType: 'full' },
  { id: 'e-microco-housing', from: 'actor-alice', to: 'obj-mc-housing', sdaType: 'full' },

  // ── Cross-org: Bob's Avionics disclosed to Alice (she can see what her products connect to) ──
  { id: 'e-mc7-avionics', from: 'obj-mc-chip', to: 'obj-avionics', sdaType: 'selective' },
  { id: 'e-th400-avionics', from: 'obj-mc-sensor', to: 'obj-avionics', sdaType: 'selective' },

  // ── Provenance-implied full disclosures (parent → derived child) ──
  { id: 'e-sentinel-parse', from: 'obj-sentinel', to: 'obj-sentinel-parse', sdaType: 'full' },
  { id: 'e-avionics-eval', from: 'obj-avionics', to: 'obj-avionics-eval', sdaType: 'full' },
  { id: 'e-mc7-parse', from: 'obj-mc-chip', to: 'obj-mc-chip-parse', sdaType: 'full' },
  { id: 'e-mc7-eval', from: 'obj-mc-chip', to: 'obj-mc-chip-eval', sdaType: 'full' },
  { id: 'e-sensor-parse', from: 'obj-mc-sensor', to: 'obj-mc-sensor-parse', sdaType: 'full' },
  { id: 'e-board-eval', from: 'obj-mc-board', to: 'obj-mc-board-eval', sdaType: 'full' },
  { id: 'e-housing-eval', from: 'obj-mc-housing', to: 'obj-mc-housing-eval', sdaType: 'full' },
]

// ── Helper Functions ──

function allObjects() { return [...objects, ...dynamicObjects] }
function allEdges() { return [...edges, ...dynamicEdges] }

export function getObjectsByOwner(ownerId) {
  return allObjects().filter(o => o.owner === ownerId)
}

export function getChildObjects(objectId) {
  return allObjects().filter(o => o.provenance && o.provenance.derivedFrom === objectId)
}

export function findObjectByPin(pin) {
  return allObjects().find(o => o.pin === pin.trim()) || null
}

export function getDisclosuresForObject(objectId) {
  return allEdges().filter(e => e.objectId === objectId)
}

export function getArtifactSchema(artifact) {
  if (!artifact) return 'raw'
  if (artifact.schema === 'parse-output' && artifact.fields) return 'parse-output'
  if (artifact.schema === 'eval-output' && artifact.requirements) return 'eval-output'
  if (artifact.schema === 'disclosure-agreement' && artifact.type && artifact.parties) return 'disclosure-agreement'
  return 'raw'
}

export function getEvalHealth(artifact) {
  if (getArtifactSchema(artifact) !== 'eval-output') return null
  const reqs = artifact.requirements
  const sat = reqs.filter(r => r.sat === true || r.status === 'sat').length
  const missing = reqs.filter(r => r.status === 'missing').length
  const unsat = reqs.filter(r => (r.sat === false || r.status === 'unsat') && r.status !== 'missing').length
  return { sat, unsat, missing, total: sat + unsat + missing }
}

export function getObjectHealth(objectId) {
  const children = getChildObjects(objectId)
  let totalSat = 0
  let totalUnsat = 0
  let totalMissing = 0
  children.forEach(child => {
    const health = getEvalHealth(child.artifact)
    if (health) {
      totalSat += health.sat
      totalUnsat += health.unsat
      totalMissing += health.missing || 0
    }
  })
  if (totalSat + totalUnsat + totalMissing === 0) return null
  return { sat: totalSat, unsat: totalUnsat, missing: totalMissing, total: totalSat + totalUnsat + totalMissing }
}

// Get all objects visible to a given role
export function getVisibleObjects(actorId) {
  const all = allObjects()
  const allE = allEdges()
  const own = all.filter(o => o.owner === actorId)
  const visibleIds = new Set(own.map(o => o.id))

  // BFS through edges — don't traverse THROUGH nodes reached via pending edges
  const pendingTargetIds = new Set()
  let changed = true
  while (changed) {
    changed = false
    allE.forEach(e => {
      if (visibleIds.has(e.from) && !visibleIds.has(e.to)) {
        if (pendingTargetIds.has(e.from)) return
        visibleIds.add(e.to)
        changed = true
        if (e.status === 'pending') {
          pendingTargetIds.add(e.to)
        }
      }
    })
  }

  const visibleObjs = all.filter(o => visibleIds.has(o.id))
  const rootIds = new Set(visibleObjs.map(o => o.id))
  const pendingObjIds = new Set([
    ...all.filter(o => o._pending).map(o => o.id),
    ...pendingTargetIds,
  ])
  const children = all.filter(
    o => o.provenance && rootIds.has(o.provenance.derivedFrom) && !pendingObjIds.has(o.provenance.derivedFrom)
  )

  const seen = new Set()
  const result = []
  ;[...visibleObjs, ...children].forEach(o => {
    if (!seen.has(o.id)) {
      seen.add(o.id)
      result.push(o)
    }
  })
  // Mark pending targets so downstream components can render them as provisional
  result.forEach(o => {
    if (pendingTargetIds.has(o.id)) {
      o._pending = true
    }
  })
  return result
}

// Get all edges visible to a given role (both endpoints visible).
// Deduplicates pairs of nodes that have edges in both directions.
export function getVisibleEdges(actorId) {
  const all = allObjects()
  const allE = allEdges()
  const visibleObjs = getVisibleObjects(actorId)
  const visibleIds = new Set(visibleObjs.map(o => o.id))
  const visible = allE.filter(e => visibleIds.has(e.from) && visibleIds.has(e.to))

  const ownedIds = new Set(all.filter(o => o.owner === actorId).map(o => o.id))

  const pairMap = new Map()
  visible.forEach(e => {
    const pairKey = [e.from, e.to].sort().join('|')
    const existing = pairMap.get(pairKey)
    if (!existing) {
      pairMap.set(pairKey, e)
      return
    }
    const eFromOwned = ownedIds.has(e.from)
    const existingFromOwned = ownedIds.has(existing.from)
    if (eFromOwned && !existingFromOwned) {
      pairMap.set(pairKey, e)
    }
  })

  return Array.from(pairMap.values())
}
