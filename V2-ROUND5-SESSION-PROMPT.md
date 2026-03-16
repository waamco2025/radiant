# Radiant V2 — Round 5 Session Prompt

You are continuing development of the Radiant V2 prototype, a React/Vite supply chain trust and traceability platform with a WebGL (Three.js) network graph.

**Read `CLAUDE.md` and `V2-ROUND5-HANDOFF.md` in the project root before doing anything.** These contain the full architecture, data model, component inventory, and known bugs.

---

## Context

Radiant is a blockchain-based platform where organizations register assets, attach evidence, parse evidence into structured data (PEP), disclose assets to other parties, and run evaluations against disclosed data. The prototype demonstrates this with two demo users:

- **Bob@GovCo** — a government buyer assembling the Sentinel-4 satellite. He connects supplier assets to his program, runs evaluations, and manages his supply chain network.
- **Alice@MicroCo** — an electronics supplier. She registers products, attaches evidence, parses it via PEP, and responds to disclosure requests from buyers like Bob.

The V2 prototype uses a **flat parent layer** (all orgs + assets as peer nodes with horizontal edges) and a **single child layer** per asset (containing artifact nodes: evidence → PEP parse → evaluations). Users dive into an asset to see its artifacts.

### Current State (Batches 1–8.4)

Working: WebGL NetGraph with card + dot LOD levels, Detail Panel with conditional tabs, 3 disclosure modal flows (Publish, Connect Asset, Respond), cascade disclosure management, notification inbox with persistence, ownership gating on all action buttons, evidence field visibility gated by ownership, disclosure persistence (accepting a request dynamically creates SDAs + nodes + edges), stack spread on nodes with children, dive hint tooltips, dot-level edge tooltips, "View Asset Details" wiring in Children tab.

**Alice has 8 nodes** (MicroCo org + 6 products + GovCo's Avionics Module visible via disclosure). **Bob has 6 nodes** (GovCo org + Sentinel-4 + Propulsion + Avionics + 2 MicroCo products received via disclosure). Alice has 1 pending request from GovCo for PCB Substrate.

### Data Architecture

`src/v2/v2Data.js` — static role data built by `buildBobData()` and `buildAliceData()`. Returns `{ nodes, edges, nodeMap, pendingRequests, existingCascades }`.

`src/v2/V2App.jsx` — maintains three dynamic mutation arrays merged into static data via `useMemo`:
- `addedNodes[]` — dynamically created nodes
- `addedSDAs{}` — `{ [nodeId]: SDA[] }` merged into matching nodes
- `addedEdges[]` — dynamically created edges

All reset on role switch. This is the mechanism for making disclosure acceptance, asset registration, and other actions persist within a session.

### Key Architectural Rules
1. **Requestor cannot dictate disclosure type** — owner decides Full/Selective/Proof-only
2. **All disclosures are invitation-driven** — no unsolicited pushes
3. **Human review always required** in evaluations
4. **Flat parent layer** — supply chain = horizontal edges, not nested nodes
5. **Child layer = artifacts only** — evidence (Tier 1), PEP parse (Tier 2), evaluations (Tier 3)
6. **Ownership gating** — can only act on nodes you own (both Disclose and Connect buttons)

---

## Phase 0: Fix Edge Rendering Bugs (Do This First)

Three bugs from Batch 8.4 that need fixing before anything else:

### Bug 1: Edges disappear on role switch to Alice
Edges render for Bob on load but vanish when switching to Alice until zoom changes. The edge rebuild `useEffect` fires but the renderer doesn't pick up the changes. Likely `dirtyRef.current = true` isn't being set at the right time, or the edge group is rebuilt before the new camera/scene state is committed.

**Debug:** Add `console.log('[EDGE REBUILD]', currentLayer.edges.length, edgeGroupRef.current?.children.length)` in the edge rebuild effect. Verify it fires with the correct edge count. Try wrapping the rebuild in `requestAnimationFrame`. Also check that the render loop respects `dirtyRef` — if it only renders on dirty, the flag must be set AFTER edges are added.

### Bug 2: Edge endpoints emerge from wrong positions on cards
Current implementation uses a simple horizontal offset (`CARD_W/2`) which doesn't handle vertical separation between nodes. Need ray-box intersection:

```javascript
function edgeEndpoint(fromX, fromY, toX, toY, halfW, halfH) {
  const dx = toX - fromX
  const dy = toY - fromY
  if (dx === 0 && dy === 0) return { x: fromX, y: fromY }
  const sx = halfW / Math.abs(dx || 0.001)
  const sy = halfH / Math.abs(dy || 0.001)
  const s = Math.min(sx, sy)
  return { x: fromX + dx * s, y: fromY + dy * s }
}

// Usage in buildEdges:
const start = edgeEndpoint(fromNode.x, fromNode.y, toNode.x, toNode.y, CARD_W/2, CARD_H/2)
const end = edgeEndpoint(toNode.x, toNode.y, fromNode.x, fromNode.y, CARD_W/2, CARD_H/2)
```

Only apply at card-level LOD. At dot LOD, use center-to-center (no offset). `CARD_W = 210`, `CARD_H = 86`.

### Bug 3: Edges disappear after disclosure completion
State updates (addedSDAs, addedEdges, dismissedReqs) trigger re-renders that may clear the edge group. The edge rebuild effect should catch this via its dependency on `currentLayer.edges`. Verify the merged edges array updates correctly in the `useMemo`.

**Verify all three before proceeding:**
- [ ] Switch Bob → Alice → edges appear immediately
- [ ] All edges emerge from card edges (not centers) at card zoom
- [ ] At dot zoom, edges connect dot centers
- [ ] Accept PCB Substrate disclosure → new edge appears and all existing edges persist

---

## Phase 1: Register Asset Flow (Both Roles)

Build a "Register Asset" modal accessible from any owned org or product node's "+ Connect Asset" button (or a dedicated "+ Register Asset" button in the action bar).

### 1a. Register Asset Modal
- **Step 1: Asset Details** — name (text input), category (dropdown: product, process, place, person), description (textarea), optional fields per category
- **Step 2: Review** — summary of what will be created
- **Step 3: Confirmation** — "Asset Registered" with the new PIN displayed

On completion:
- Create a new node via `setAddedNodes` with a generated PIN (use `makePin()` from v2Data.js — export it)
- Create a `full` internal SDA on the new node
- Create an edge from the initiating node to the new node (sdaType: 'full')
- The new node appears on the NetGraph immediately

### 1b. Wire to both roles
- Alice: registers products under MicroCo (e.g. Thermal Interface Pad demo)
- Bob: registers systems under GovCo (e.g. a new subsystem for Sentinel-4)

### 1c. Data
Export `makePin` and `makeDot` from `v2Data.js` so modals can generate identifiers.

---

## Phase 2: Add Evidence to an Asset (Alice)

When Alice selects one of her assets and clicks a "+ Add Evidence" button (in the Evaluations tab or as an action button), open a modal to attach mock evidence.

### 2a. Add Evidence Modal
- **Step 1: Upload** — file picker (local file, demo only), or paste a document hash. Show filename, hash preview, provider field, retention period dropdown.
- **Step 2: Review** — evidence metadata summary
- **Step 3: Confirmation** — "Evidence Attached" with the evidence PIN

On completion:
- Create an evidence child node via `makeEvidenceNode()` (export from v2Data.js)
- Add it to the parent node's `children[]` via a mutation mechanism (similar to addedSDAs but for children)
- The asset's stack badge updates, and diving into the asset shows the new evidence node

### 2b. Data mutation
Add `addedChildren{}` state to V2App: `{ [parentNodeId]: childNode[] }`. Merge into nodes in the same `useMemo` that handles addedSDAs:

```javascript
if (Object.keys(addedChildren).length > 0) {
  data.nodes = data.nodes.map(n => {
    const added = addedChildren[n.id]
    if (!added) return n
    const newChildren = [...(n.children || []), ...added]
    return { ...n, children: newChildren, hasStack: true, childCount: newChildren.length }
  })
}
```

---

## Phase 3: PEP Template + Parse (Alice)

After evidence is attached, Alice can run PEP (Parse & Extract Protocol) to create structured key-value data from the evidence.

### 3a. PEP concepts
- **PEP Template** — a Process with a PIN. Defines which fields to extract from evidence. Think of it like a schema: "extract voltage, temperature range, compliance status, material composition..." Each field has a name, category (electrical, mechanical, compliance, environmental, etc.), and data type.
- **PEP Output** — the result of running a template against evidence. Produces tokenized key-value pairs grouped by category. This is a Tier 2 child node (category: 'parse').

### 3b. Run PEP Modal
- **Step 1: Select Template** — choose from available PEP templates (mock list of 3-4 templates with different field sets). Or create a new template inline (name + field list).
- **Step 2: Select Evidence** — pick which evidence node(s) to parse (checkboxes)
- **Step 3: Processing** — mock progress bar (1-2 seconds)
- **Step 4: Results** — show extracted key-value pairs grouped by category. Each field shows: field name, extracted value, confidence indicator (high/medium/low). User can edit values or flag fields for review.
- **Step 5: Confirmation** — "Parse Complete" with PEP output PIN

On completion:
- Create a PEP output child node (category: 'parse', icon: '⊞', color: purple) as a Tier 2 artifact
- The PEP output stores the parsed fields as structured data
- These parsed fields become the basis for selective disclosure (owner picks which fields to share)

### 3c. Mock PEP templates
Create 2-3 templates in a new `pepTemplates.js` or inline in the modal:

```javascript
const PEP_TEMPLATES = [
  {
    id: 'pep-electronics',
    name: 'Electronics Component Profile',
    fields: [
      { name: 'Operating voltage', category: 'electrical', type: 'range' },
      { name: 'Power dissipation', category: 'electrical', type: 'value' },
      { name: 'Temperature range', category: 'environmental', type: 'range' },
      { name: 'Radiation tolerance', category: 'environmental', type: 'value' },
      { name: 'ITAR classification', category: 'compliance', type: 'text' },
      { name: 'RoHS status', category: 'compliance', type: 'boolean' },
      { name: 'Package type', category: 'mechanical', type: 'text' },
      { name: 'Lead count', category: 'mechanical', type: 'number' },
      { name: 'Material composition', category: 'material', type: 'text' },
      { name: 'Lot number', category: 'identification', type: 'text' },
    ],
  },
  // ... more templates
]
```

### 3d. Child layer rendering
When diving into an asset that has both evidence and PEP nodes, the child layer should show:
- Tier 1 (top): evidence nodes (orange)
- Tier 2 (below): PEP parse nodes (purple), connected to their source evidence via edges

Update `layoutChildren` in V2Canvas to handle multi-tier artifact layout.

---

## Phase 4: Connect Asset by PIN (Bob → Alice)

Bob clicks "+ Connect Asset" on his Avionics Module, enters Alice's PCB Substrate PIN, and sends a disclosure request.

### 4a. Provisional card
When Bob submits the request:
- A **provisional node** appears immediately on Bob's network, connected to Avionics Module via a dashed grey edge
- Provisional node treatment: dashed border (`strokeDasharray="4,3"` or CSS `border-style: dashed`), muted opacity (0.5-0.6), grey/dim colors, badge: "PROVISIONAL · Awaiting response"
- The provisional node shows the asset name and PIN from the request, but no health, no evidence, no evaluations
- Provisional nodes cannot be dived into, evaluated, or disclosed

### 4b. Data
Add a `provisionalNodes[]` state to V2App. Provisional nodes have a `provisional: true` flag. Merge into the nodes array alongside `addedNodes`. AssetNode checks `node.provisional` and renders the dashed/muted treatment.

### 4c. Request flow
The existing `RequestDisclosureModal` handles this. On completion (`setSubmitted(true)`), also create the provisional node + edge:

```javascript
onSubmitRequest={(pins, requirements, message) => {
  pins.forEach(pin => {
    const provNode = {
      id: `provisional-${pin}`,
      pin,
      name: `Pending: ${pin}`,  // will be replaced with real name on acceptance
      category: 'product',
      owner: '?',
      provisional: true,
      health: { ok: 0, warn: 0, bad: 0 },
      displayHealth: { ok: 0, warn: 0, bad: 0 },
      // ... minimal node fields
    }
    setProvisionalNodes(prev => [...prev, provNode])
    setAddedEdges(prev => [...prev, {
      id: `e-prov-${contextNode.id}-${pin}`,
      from: contextNode.id,
      to: `provisional-${pin}`,
      sdaType: 'provisional',  // new edge type: grey dashed
    }])
  })
}}
```

### 4d. Alice sees the request
When Bob sends the request, it should appear in Alice's pending requests (for demo purposes, add it to Alice's `pendingRequests` array dynamically, or pre-populate a second request in the static data).

---

## Phase 5: Connect Asset by Public Directory (Bob → Alice)

### 5a. Enable the "Browse Public Directory" path
In `RequestDisclosureModal.jsx`, the "Browse Public Directory" card is currently greyed out with "COMING SOON". Enable it.

### 5b. Public Asset Directory modal/step
When Bob clicks "Browse Public Directory":
- Show a searchable list of publicly listed assets (mock data — create a `publicAssets.js` with 10-15 assets from various fictional companies, including Alice's Connector Assembly and EMI Shield Assembly)
- Each listing shows: asset name, owner, category, PIN, brief description, available since date
- Search by name, owner, or category
- Click an asset → shows detail view with full description
- "Request Disclosure" button → proceeds to the requirements + message step of the existing Connect Asset flow

### 5c. Same provisional treatment
Requesting from the directory creates the same provisional node on Bob's network as the PIN flow.

---

## Phase 6: Accept Disclosures with Field Selection (Alice)

### 6a. Full disclosure acceptance
Already works from Batch 8.3. When Alice chooses "Full", all PEP fields are disclosed. The SDA and edge are created.

### 6b. Selective disclosure acceptance
When Alice chooses "Selective" in the response modal:
- **New step: Field Selection** — show all PEP-parsed fields from the asset's PEP output, grouped by category
- Each field has a checkbox. Alice checks the fields she wants to disclose.
- Categories can be toggled as groups (check/uncheck all fields in a category)
- Summary at bottom: "12 of 18 fields selected"
- The resulting SDA stores `disclosedFields[]` — the list of field IDs that were disclosed

### 6c. On Bob's side
When the disclosure is accepted:
- Bob's provisional node upgrades to a real node (remove `provisional: true`, add real name/owner/category from the response)
- Edge type changes from `provisional` (grey dashed) to `selective` (amber dashed) or `full` (blue solid)
- Node populates with evidence count and PEP field count (but health minibar stays empty until Bob runs an evaluation)

### 6d. Animation (Phase 10 refinement)
The provisional → real transition should animate: dashed border solidifies, color fills in, name updates, edge recolors.

---

## Phase 7: Requirements Library (Bob)

### 7a. Requirements Library modal
Accessible from the header toolbar (or a dedicated button in the sidebar area).
- **List view** — shows all of Bob's requirement sets. Each set has a name, description, field count, last used date.
- **Create new** — name, description, then add individual requirements:
  - Each requirement: title, description, field category it evaluates (maps to PEP field categories), pass criteria, evidence type expected
  - Can add/remove requirements
  - Save creates a new requirements set with a PIN
- **Mock data** — pre-populate 2-3 requirement sets (e.g. "MIL-PRF-55681 Compliance", "IPC-6012 Class 3 Qualification", "System Integration Requirements") with 5-10 requirements each

### 7b. Data
Store requirements sets in a `requirementsSets[]` state in V2App (or a new `requirementsData.js`). Each set:

```javascript
{
  id: 'reqset-001',
  pin: makePin('reqset-001'),
  name: 'MIL-PRF-55681 Compliance',
  description: 'Military specification for power regulation modules',
  requirements: [
    { id: 'req-1', title: 'Power output stability', fieldCategory: 'electrical', criteria: '±0.5% under load', evidenceType: 'test_report' },
    { id: 'req-2', title: 'Thermal dissipation', fieldCategory: 'electrical', criteria: '< 2W at rated current', evidenceType: 'test_report' },
    // ...
  ],
  createdBy: 'Bob Chen',
  created: '2026-03-01',
}
```

---

## Phase 8: Run Evaluation (Bob)

Port and adapt V1's EvaluationModal (5-phase: Setup → Processing → Results → Review → Complete).

### 8a. Key differences from V1
- Evaluations run against **PEP output fields**, not raw evidence
- The requirement set maps requirements to PEP field categories
- **Selective disclosure** means some fields are disclosed and some aren't — undisclosed fields produce "UNEVALUABLE" results (grey, not red)
- Results are per-field: each PEP field × each requirement = one claim
- Human review is always required

### 8b. Setup step
- Select asset to evaluate (pre-filled if opened from a node's "Run Evaluation" button)
- Select requirement set from the library
- Show credit cost estimate
- Show which PEP fields are available (and which are redacted if selective disclosure)

### 8c. Processing step
- Mock progress bar with stage labels ("Parsing evidence...", "Matching requirements...", "Generating claims...")
- 2-3 seconds duration

### 8d. Results step
- Table: Requirement | PEP Field | Result | Status
- Status: verified (green), failed (red), unevaluable (grey — field not disclosed)
- Triage: auto-approved (clear pass), needs review (borderline), flagged (clear fail or missing)

### 8e. Review step
- Items needing human review shown with actions: Confirm, Override→Pass, Override→Fail
- "Approve All" button for bulk confirm

### 8f. Complete step
- Summary: N verified, N failed, N unevaluable
- Claims written to the asset's evaluations array (via addedSDAs-like mechanism for evaluations)
- Health minibar updates on the asset and parent nodes
- Credit deduction displayed

### 8g. Data mutation
Add `addedEvaluations{}` to V2App: `{ [nodeId]: Evaluation[] }`. Merge into nodes alongside addedSDAs. When an evaluation is added, recompute `displayHealth` on the node and propagate to parent.

---

## Phase 9: Revoke Disclosures (Both Roles)

### 9a. Current state
DisclosuresTab has a "Revoke SDA" button with a confirm/cancel flow. Currently it just `alert('Revoked (demo)')`.

### 9b. Wire it up
On revoke confirmation:
- Remove the SDA from the node (add to a `removedSDAs` set, filter in the merge `useMemo`)
- Remove the corresponding edge
- If the other party's node has no remaining SDAs connecting it to the user's network, remove that node too (it was only visible because of the disclosure)
- Show confirmation: "Disclosure revoked. [Party] can no longer access this asset."

### 9c. Both sides
- Alice revokes → the edge disappears from her view, Bob's copy of the asset is unaffected (he still has the data he already evaluated, but can't re-evaluate)
- Bob revokes → the edge disappears from his view, the MicroCo asset node is removed if no other SDAs connect it

---

## Phase 10: Network Events Log (Both Roles)

### 10a. Events data
Create a `networkEvents[]` state in V2App. Every action generates an event:

```javascript
{
  id: 'evt-001',
  type: 'disclosure_accepted',  // or 'asset_registered', 'evidence_added', 'evaluation_completed', 'disclosure_revoked', 'request_sent', 'request_received', 'pep_completed'
  timestamp: '2026-03-15T14:30:00Z',
  actor: 'Alice',
  party: 'MicroCo',
  description: 'Accepted selective disclosure of PCB Substrate to GovCo',
  relatedNodes: ['pcb-sub', 'avionics'],
  relatedEdge: 'e-dynamic-avionics-pcb-sub',
}
```

### 10b. Events panel
Accessible from a bell/activity icon in the header (repurpose the existing notification inbox, or add a second panel).
- Chronological list of events, newest first
- Each event shows: icon by type, timestamp, actor, description
- Click an event → pan to and select the related node in the NetGraph
- Filter by event type

### 10c. Pre-populate with existing events
Generate events for the existing SDAs, evaluations, and the demo data so the log isn't empty at start.

---

## Phase 11: Animation Refinements

After all flows work, refine the experience with animations:

### 11a. Disclosure acceptance animation
When Alice accepts a disclosure:
1. Modal fades out
2. Canvas dims slightly (semi-transparent overlay)
3. If new node: card draws in at target position (border animates from dashed provisional to solid, content fades in)
4. Camera pans to show both the owner's asset and the connected asset
5. Edge line literally draws from one node to the other, camera following the line
6. Camera settles at a fit-to-both-nodes zoom
7. Overlay fades, normal interaction resumes

### 11b. Provisional → real card transition
When a provisional card becomes a real disclosure:
- Dashed border animates to solid
- Grey fill transitions to the category color tint
- "PROVISIONAL" badge fades out
- Name updates from "Pending: PIN-..." to the real asset name
- Edge color transitions from grey to the disclosure type color

### 11c. Minibar update animation
When an evaluation completes and the minibar changes:
- Brief flash/pulse on the health bar
- Green segments grow, red segments appear
- Parent nodes' minibars cascade-update with a slight delay

### 11d. Minibar achievement notification (future)
When a node's minibar changes due to a network event:
- Notification triggers
- Clicking it zooms to the node, blurs background
- Shows the node card large and centered
- Animates the minibar changes (before → after)
- Text log underneath shows what changed: "+3 verified" in green, "+1 failed" in red
- Like a Nintendo Switch round-end achievement summary

---

## Demo Product Assignments (Reference)

| Product | Owner | Demo Purpose |
|---------|-------|-------------|
| PCB Substrate | MicroCo | Bob requests via PIN (pending request exists) |
| EMI Shield Assembly | MicroCo | Alice posts to public directory, Bob discovers it |
| Thermal Interface Pad | MicroCo | Alice creates during Register Asset demo |
| Connector Assembly | MicroCo | Already in public directory, Bob finds and requests |
| Power Regulation Module | MicroCo | Already disclosed (selective), Bob already evaluated |
| Voltage Regulator IC | MicroCo | Already disclosed (full), Bob hasn't evaluated yet |

---

## Implementation Order

1. **Phase 0** — Fix edge rendering bugs (do this first, everything else depends on edges working)
2. **Phase 1** — Register Asset (both roles need this before anything else)
3. **Phase 2** — Add Evidence (Alice needs this before PEP)
4. **Phase 3** — PEP Template + Parse (Alice needs this before selective disclosure makes sense)
5. **Phase 4** — Connect Asset by PIN + provisional cards (Bob's primary flow)
6. **Phase 5** — Public Asset Directory (Bob's secondary flow)
7. **Phase 6** — Accept disclosures with field selection (closes the loop between Bob and Alice)
8. **Phase 7** — Requirements Library (Bob needs this before evaluations)
9. **Phase 8** — Run Evaluation (the core feature — depends on PEP'd + disclosed assets)
10. **Phase 9** — Revoke Disclosures (cleanup flow)
11. **Phase 10** — Network Events Log (visibility into all actions)
12. **Phase 11** — Animation refinements (polish pass after all flows work)

Work in batches of 4-8 tasks. QA each batch with numbered checklist items (action → expected result) before moving to the next. Update CLAUDE.md after each major batch sequence.

---

## Files to Read First

1. `CLAUDE.md` — project architecture, conventions, node schema
2. `V2-ROUND5-HANDOFF.md` — session log, known bugs, detailed debug guidance
3. `src/v2/v2Data.js` — data layer, makeNode, makeEvidenceNode, role builders
4. `src/v2/V2App.jsx` — root state, dynamic data merging, modal wiring
5. `src/v2/V2Canvas.jsx` — WebGL canvas, edge rendering (the bugs are here)
6. `src/v2/AssetNode.jsx` — node card rendering, StackPeeks, provisional treatment target
7. `src/components/modals/DisclosureResponseModal.jsx` — disclosure acceptance flow
8. `src/components/modals/RequestDisclosureModal.jsx` — connect asset flow
9. `src/components/DetailPanel/constants.js` — SDA_CONFIG, CATEGORY_CONFIG
