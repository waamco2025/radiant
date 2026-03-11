// Demo dataset for v2 Node Explorer
// Schema: { id, name, category, owner, children, health, claimCount, x, y }

const nodes = [
  // Root org
  {
    id: 'microco',
    name: 'MicroCo',
    category: 'party',
    owner: null,
    children: [],
    health: { ok: 12, warn: 3, bad: 1 },
    claimCount: 16,
    x: 0,
    y: 0,
  },
  // Tier 1 — direct children of MicroCo
  {
    id: 'portland',
    name: 'Portland Facility',
    category: 'place',
    owner: 'MicroCo',
    children: [],
    health: { ok: 5, warn: 1, bad: 0 },
    claimCount: 6,
    x: 400,
    y: -300,
  },
  {
    id: 'jane',
    name: 'Jane Torres',
    category: 'person',
    owner: 'MicroCo',
    children: [
      {
        id: 'jane-license',
        name: 'Engineering License',
        category: 'product',
        owner: 'Jane Torres',
        children: [],
        health: { ok: 1, warn: 0, bad: 0 },
        claimCount: 1,
      },
      {
        id: 'jane-safety',
        name: 'Safety Training Cert',
        category: 'product',
        owner: 'Jane Torres',
        children: [],
        health: { ok: 1, warn: 0, bad: 0 },
        claimCount: 1,
      },
    ],
    health: { ok: 3, warn: 0, bad: 0 },
    claimCount: 3,
    x: 400,
    y: -100,
  },
  {
    id: 'widget',
    name: 'Widget Assembly',
    category: 'product',
    owner: 'MicroCo',
    children: [
      {
        id: 'widget-test',
        name: 'Test Report #447',
        category: 'product',
        owner: 'Widget Assembly',
        children: [],
        health: { ok: 1, warn: 0, bad: 0 },
        claimCount: 1,
      },
      {
        id: 'widget-mat',
        name: 'Material Cert',
        category: 'product',
        owner: 'Widget Assembly',
        children: [],
        health: { ok: 0, warn: 1, bad: 0 },
        claimCount: 1,
      },
      {
        id: 'widget-photo',
        name: 'Inspection Photo',
        category: 'product',
        owner: 'Widget Assembly',
        children: [],
        health: { ok: 1, warn: 0, bad: 0 },
        claimCount: 1,
      },
    ],
    health: { ok: 4, warn: 2, bad: 1 },
    claimCount: 7,
    x: 400,
    y: 100,
  },
  {
    id: 'procurement',
    name: 'Procurement Office',
    category: 'place',
    owner: 'MicroCo',
    children: [],
    health: { ok: 2, warn: 0, bad: 0 },
    claimCount: 2,
    x: 400,
    y: 300,
  },
  // Tier 2
  {
    id: 'cnc',
    name: 'CNC Machining Line 3',
    category: 'process',
    owner: 'Danaher Precision Systems',
    children: [
      {
        id: 'cnc-iso',
        name: 'ISO 9001 Cert',
        category: 'product',
        owner: 'Danaher Precision Systems',
        children: [],
        health: { ok: 1, warn: 0, bad: 0 },
        claimCount: 1,
      },
      {
        id: 'cnc-cal',
        name: 'Calibration Report',
        category: 'product',
        owner: 'Danaher Precision Systems',
        children: [],
        health: { ok: 0, warn: 1, bad: 0 },
        claimCount: 1,
      },
    ],
    health: { ok: 3, warn: 1, bad: 0 },
    claimCount: 4,
    x: 800,
    y: -300,
  },
  {
    id: 'rfq',
    name: 'RFQ Process',
    category: 'process',
    owner: 'Ariba Procurement Solutions',
    children: [],
    health: { ok: 1, warn: 1, bad: 0 },
    claimCount: 2,
    x: 800,
    y: 300,
  },
]

// Edges: each non-root node with an x position connects back to its owner by id
// Owner field is now a display name, so edges use structural references
const edgeDefs = [
  { from: 'microco', to: 'portland', sdaType: 'full' },
  { from: 'microco', to: 'jane', sdaType: 'full' },
  { from: 'microco', to: 'widget', sdaType: 'selective', redacted: ['pricing', 'supplier_identity'] },
  { from: 'microco', to: 'procurement', sdaType: 'derivative', evalId: 'eval-mc-201' },
  { from: 'portland', to: 'cnc', sdaType: 'full' },
  { from: 'procurement', to: 'rfq', sdaType: 'cascade', discloser: 'MicroCo', cascadePolicy: 'open' },
]

const edges = edgeDefs.map(e => ({
  id: `edge-${e.from}-${e.to}`,
  from: e.from,
  to: e.to,
  type: 'ownership',
  sdaType: e.sdaType || 'full',
  redacted: e.redacted || null,
  evalId: e.evalId || null,
  discloser: e.discloser || null,
  cascadePolicy: e.cascadePolicy || null,
}))

// Build a lookup map for quick access
const nodeMap = {}
nodes.forEach(n => { nodeMap[n.id] = n })

export { nodes, edges, nodeMap }
