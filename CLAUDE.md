# Radiant by Provenance — Supply Chain Trust & Traceability Platform

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V2 Prototype

V2 lives at `/v2.html`. V1 at `/index.html`. Shared: `tokens.js`, `index.css`. V1 is feature-complete; V2 is under active development (Batches 1–17.0 complete, Phases 0–4 + 6 + 7 partial + 9 done).

**All new work targets V2 unless explicitly stated.**

---

## Data Model — Two-Layer Graph

The network has exactly two layers. All organizations and assets are parent-level nodes connected by horizontal edges. Evidence, PEP outputs, and evaluations are child-level nodes inside a single child layer per asset.

### Parent Layer (flat network)
- All 5P entities: Party, Product, Place, Process, Person
- Supply chain relationships = horizontal edges, not vertical dives
- Edge types: `full` (same-owner structural), `selective`, `proofonly`, `cascade`, `provisional`
- Actions: Connect Asset, Disclose, Add Evidence, Run Evaluation, View Chain, Exit Layer
- Actions are **owner-only** — you can only act on nodes you own
- Provisional nodes: `provisional: true` flag. Dashed border, muted opacity, no actions, "Awaiting owner response" text

### Child Layer (one per asset, artifact nodes only)
- Tier 1: **EVIDENCE** nodes (source documents, orange). PARSED/UNPARSED badge computed dynamically via `_isParsed` flag
- Tier 2: **PARSE** nodes (PEP extracted key-value fields, purple). Connected to source evidence via `sourceEvidenceId`. Category `'parse'`, `isParse: true`
- Tier 3: **EVALUATION** nodes (results + claims, indigo) — planned
- Parse nodes are **terminal** — no Connect, Disclose, or Add Evidence actions
- Evidence nodes get Add Evidence (on anchor) and Parse Evidence actions
- Accessed by diving into a parent-level asset
- Multi-tier layout: `layoutChildren` separates by category, uses `occupiedTier2Xs` set to prevent cross-evidence collision at tier 2

### Identity Model
- **PIN** — Full 256-bit hex: `PIN-0x[64 hex chars]`. Displayed truncated as `PIN-0x[4hex]...[4hex]` in badges. Copy always gives full string.
- **DOT** — transferable ownership title. Full 256-bit hex, same format as PIN. Hidden in prototype via CSS until DOT model is finalized.
- **Actor vs Object** — DLT-level distinction. Actors have cryptographic keys. Objects don't. The 5 Ps are a UX meta-layer on top.

### Disclosure Model
- **Requestor cannot dictate disclosure type.** They can only: specify asset by PIN, attach requirements, send a message.
- **Owner decides disclosure type:** Full, Selective, or Proof-only.
- **Full** — receiving party accesses all parsed data fields and can run evaluations.
- **Selective** — receiving party accesses owner-selected data fields only. Redaction is at the PEP field level (per-field, per-party).
- **Proof-only** — receiving party sees pass/fail results from owner's evaluations only. No data access.
- **Anti-spam:** All disclosures are invitation-driven. Sellers cannot push disclosures to buyers.

### Protocol Waterfall
Ingest → Curate → Consume: Register (DPP) → Prepare (PEP) → Share (SDP) → Evaluate (REP). PEP is the only process that touches raw evidence. All evaluations run against PEP output. SDP is the only mechanism granting access to curated data in Qualified Storage.

### Minibar Roll-up
- Parent asset minibar = aggregate of child-layer evaluation claims
- `displayHealth` field on each node: for nodes with evidence children, shows pure `childHealth` (avoids double-counting)
- Evidence nodes have minibars showing claims attributed to them

---

## V2 Architecture

### App Shell
- `V2App.jsx` — Root. Per-role keyed state (`perRoleState`), selection state, modal state, layer info. Passes `isOwner` and `activeParty`. Notification inbox with persistence. `findClearY` for collision-free node placement (bidirectional search). All modal completion handlers here.
- `V2Canvas.jsx` — Three.js WebGL canvas. `forwardRef` exposes `dive()` and `surface()`. `layoutChildren` handles multi-tier positioning. Root layer always-sync + child layer sync via `layerStackRef`. Edge legend with all 5 disclosure types + provisional.
- `AssetNode.jsx` — Node card overlay. Action bar gated on ownership + `isEvidence` + `isTerminalNode` + `isProvisional`. Provisional cards: dashed border, muted, "PROVISIONAL" badge, suppressed actions.

### Detail Panel (`src/components/DetailPanel/`)
- `index.jsx` — Entry. Tabs conditional. Provisional nodes get minimal "Awaiting Disclosure" panel. Parse nodes get "Parsed Fields" tab.
- `PanelShell.jsx` — Header (with description row), tabs, footer. Footer buttons gated on `isOwner`, `isEvidence`, `isParse`. Parse Evidence button for evidence nodes.
- `EvaluationsTab.jsx` — Asset nodes: eval panels + Run Evaluation. Evidence nodes: always-open EvidenceBlock + attributed claims.
- `DisclosuresTab.jsx` — SDA cards with click-to-pan on "Connected asset". Internal SDAs hide "Connected asset" row. Revoke flow.
- `ChildrenTab.jsx` — Child cards with node type tooltips. Parse nodes show field count instead of eval/claims. Owner alignment fixed.
- `ParsedFieldsTab.jsx` — Grouped field display for PEP parse nodes with confidence badges.
- `constants.js` — CATEGORY_CONFIG with `tipText` tooltips for each node type.

### Modals (`src/components/modals/`)
- `ModalShared.jsx` — Shared `Backdrop` with fade-out animation (150ms on Escape/backdrop-click). `_noBackdrop` prop for persistent backdrop. Mousedown tracking prevents click-drag dismissal.
- `RequestDisclosureModal.jsx` — Connect Asset. 3 steps. Step 2: PIN grid input (individual `<input>` rows with line numbers, paste splitting, add/remove buttons). Inline validation with debounced animation (pending → validating → result). `onValidatePins` prop for format/duplicate/existence checks. `onSubmitRequest` for batch provisional creation. Button label reflects valid count.
- `DisclosureResponseModal.jsx` — Respond to request. Accept/Decline. Owner chooses type. Truncated PIN badges.
- `RegisterAssetModal.jsx` — Single + Bulk CSV import tabs. Category SVG icons. `_noBackdrop`, `onBack`.
- `AddEvidenceModal.jsx` — File picker, auto-label from filename. Unique ID param prevents same-filename collision.
- `ParseEvidenceModal.jsx` — PEP template selection via custom dropdown (portal to document.body). Field preview scrollbox. Duplicate template detection (`existingParseTemplateIds`). All-templates-used amber message. PrimeRadiant spinner during processing. Credit cost display.
- `RevocationNoticeModal.jsx` — Read-only revocation notice. Red banner, asset details with PIN badge, disclosure type, revoker's message (or "No reason given"), explanatory text. Dismiss button.
- `RequirementsLibraryModal.jsx` — Library list view (all sets with expand/edit/delete) + editor view (create/edit with extraction/inference requirement types). Needs split-panel refactor per client feedback.
- `PublishModal.jsx` — Publish to directory. 3-4 steps.
- `CascadeModal.jsx` — Manage cascading disclosures.

### Data Layer (`src/v2/v2Data.js`)
Two roles:
- **Bob@GovCo** (buyer, 6 nodes: GovCo + Sentinel-4 + Propulsion + Avionics + Power Reg [selective, evaluated, with PEP] + VReg IC [full, not evaluated])
- **Alice@MicroCo** (seller, 8 nodes: MicroCo + 6 products + GovCo's Avionics Module. 1 pending request for PCB Substrate)

Key functions: `makeNode()`, `makeEvidenceNode(parentId, meta, owner, claims, uniqueId?)`, `makePepNode()`, `makePin()` (256-bit), `makeDot()` (256-bit), `resolvePin()` (cross-role lookup).

### PEP Templates (`src/v2/pepTemplates.js`)
3 templates: Electronics Component Profile (10 fields), Mechanical Assembly Profile (8 fields), Regulatory Compliance Profile (7 fields). `FIELD_CATEGORIES` for grouping. `generateMockParsedFields()` for mock data.

### Requirement Sets (`src/v2/requirementSets.js`)
Demo sets per role: Bob has 3 (MIL-PRF compliance, system integration, material compliance), Alice has 1 (incoming QC). Two requirement types: `extraction` (find a value) and `inference` (determine if condition holds). `getRequirementSetsForRole(roleId)` returns defaults.

---

## V2 Key Conventions

### Flat Parent Layer
All orgs and assets are peers. Supply chain = horizontal edges. Diving shows artifact children only.

### Ownership Gating
Connect, Disclose, Add Evidence, Parse Evidence hidden on non-owned nodes. Threaded via `activeParty` from V2App → V2Canvas → AssetNode. Also gates Detail Panel footer and DisclosuresTab.

### Terminal Nodes
Parse nodes (`isParse: true` or `category === 'parse'`) have no Connect, Disclose, or Add Evidence actions. Only View Chain and Exit Layer.

### Evidence Visibility
Evidence fields gated by `isOwner`: hash/block/retention always visible. Filename/URI/provider owner-only. Non-owners see amber notice.

### Health Display
Always use `displayHealth` (not `health`) for rendering. Handles roll-up logic for parent nodes with evidence children.

### CSS Variables
All components use CSS variables. Never hardcode colors. Use `color-mix(in srgb, var(--accent-*) N%, transparent)` for alpha.

### State Conventions
- Tab state: always-mounted with `display: none/block`.
- Modal Escape: capture-phase keydown + `stopPropagation()`.
- Notification persistence: `onClose` closes modal only. `onComplete` closes AND dismisses.

### Do NOT Modify (Unless Specified)
`V2SubgraphModal.jsx`, `LayerBorder.jsx`, `LayerPill.jsx`, `LayerTransitionOverlay.jsx`, `tokens.js`, `PrimeRadiant.jsx`, `V2BootScreen.jsx`, `demoData.js`

---

## V2 Node Schema

```javascript
{
  id, pin, dot, name, category, owner,
  parentId, children: Node[],
  health: { ok, warn: 0, bad },
  childHealth?, totalHealth?, displayHealth?,
  claimCount, displayClaimCount?,
  hasEvidence, hasStack, childCount,
  evidence?: { filename, hash, block, provider, uri, retention },
  evaluations: Evaluation[],
  sdas: SDA[],
  parsedFields?: ParsedField[],  // PEP parse nodes only
  x, y,
  isEvidence?: boolean,
  isParse?: boolean,
  sourceEvidenceId?: string,  // PEP parse nodes: links to parent evidence
  _isParsed?: boolean,  // evidence nodes: computed dynamically
  attributedClaims?: Claim[],
  isCascade?, cascadeVia?,
  upstreamSda?: { type, policy, owner, ownerDot },
  upstreamAssets?: Node[],
  provisional?: boolean,  // provisional nodes: awaiting disclosure response
  requestContext?: { requirements, message, date, contextNodeName, contextNodePin },
  _isNew?: boolean,  // freshly created nodes: renders NEW badge, cleared on deselection
  description?: string,
}
```

---

## Dynamic State (Per-Role Keyed)

V2App maintains `perRoleState` — an object keyed by role ID. Each role's state has:

```javascript
{
  addedNodes: [],       // Nodes created dynamically (registration, disclosure acceptance, provisional)
  addedSDAs: {},        // { [nodeId]: SDA[] } merged into matching nodes
  addedEdges: [],       // Edges created dynamically
  dismissedReqs: [],    // Request IDs dismissed from inbox
  addedChildren: {},    // { [parentNodeId]: childNode[] } — evidence + PEP nodes
  addedRequests: [],    // Cross-role pending requests, revocation notices, acceptance notices
  removedNodes: [],     // Node IDs to filter from static data (revocation)
  removedEdges: [],     // Edge IDs to filter from static data (revocation)
  removedSDAs: [],      // { nodeId, party, type, created } to filter from static data (revocation)
  newlyDisclosedIds: [], // node IDs that just received disclosure — drives NEW badge
  requirementSets: null, // null = use demo defaults; array = user-modified sets
}
```

All mutations persist across role switches (keyed state, not reset). Cross-role mutations write to the OTHER role's state directly (e.g. Alice accepting disclosure writes to Bob's state).

### useMemo Merge Pipeline
0. Filter `removedNodes` from static nodes
0b. Filter `removedEdges` from static edges
0c. Filter `removedSDAs` from static node SDAs
1. Merge `addedNodes` into `data.nodes`
2. Merge `addedSDAs` into matching nodes
3. Merge `addedChildren` into parent nodes (updates `hasStack`, `childCount`, `hasEvidence`)
4. Compute `_isParsed` flag on evidence nodes (checks sibling parse nodes)
5. Rebuild `nodeMap` (includes children)
6. Merge `addedEdges`
7. Merge `addedRequests` into `pendingRequests`

### Provisional → Real Upgrade
When owner accepts disclosure, `updateRoleState(otherRoleId, ...)` looks for `provisional-${reqNodeId}` in `addedNodes`. If found: replaces with real node (keeping position), recolors edge from `'provisional'` to actual disclosure type. If not found: creates fresh node (existing behavior).

### Revoke Disclosures
Ownership-aware handler: determines `ownAssetId` and `foreignNodeId` based on `node.owner === activeRole.party`, regardless of which panel initiated the revoke. Three steps:
1. Remove SDA from own asset (dynamic splice or `removedSDAs` tracking for static)
2. Remove foreign node + edge from own network (dynamic filter or `removedNodes`/`removedEdges` for static). Only removes foreign node if it has no remaining edges to other assets.
3. Remove own asset + edge from other role's network (same static/dynamic pattern). Adds revocation notification to other role's `addedRequests`.

### Notification Types
`addedRequests` carries four notification types distinguished by `type` field:
- **request** (default/no type field) — disclosure request, opens `DisclosureResponseModal`
- **revocation** (`type: 'revocation'`) — red badge, opens `RevocationNoticeModal`
- **acceptance** (`type: 'acceptance'`) — green badge, click dismisses + pans to asset
- **decline** (`type: 'decline'`) — red badge, click dismisses notification. Decline also removes provisional node + edges from requester's network.

### NEW Badge
`_isNew: true` set on all created nodes (registration, provisional, disclosure acceptance, provisional→real upgrade). Cleared when the node is deselected for the first time via `useEffect` watching `sel` changes. Renders green badge (real nodes) or grey badge (provisional).

### Child Layer Sync
`useEffect` in V2Canvas watches `rootNodeMap` for changes in parent node's children count. When it changes, rebuilds child layer nodes + edges using `layoutChildren` + `occupiedTier2Xs`. Uses `layerStackRef` (not `layerStack` in deps) to avoid circular dependency. Guarded by `transitioningRef.current`.

### Root Layer Always-Sync
`useEffect` always updates `layerStack[0]` from latest `rootNodes`/`rootEdges`, even when viewing child layers. Preserves deeper layers with `[updatedRoot, ...prev.slice(1)]`.

---

## Batch History

Complete: 1–3.6 (NetGraph + Detail Panel + cards), 4–4.6 (disclosure modals), 5–5.7 (cascade disclosures), 5.8 (evidence visibility), 6–6.6 (evidence as child nodes, minibar roll-up), 7–7.8 (flat parent layer, clean datasets, disclosure flow redesign, ownership gating, terminology update), 8–8.7 (Detail Panel fixes, per-role keyed state, direction-aware edges, cross-role disclosure reflection), 9–9.2 (Register Asset with bulk CSV import, collision avoidance), 10–10.1 (Add Evidence modal, addedChildren mechanism, child layer sync), 11 (Bulk CSV evidence URI auto-creates child nodes), 12–12.3 (PEP Parse: templates, modal, multi-tier layout, child layer sync fix, root always-sync), 13–13.4 (Refinements: click-to-pan, template dropdown, credit display, tooltips, backdrop fade-out, duplicate PEP prevention, PrimeRadiant spinner), 14–14.9 (Connect by PIN: provisional cards, cross-role requests, PIN validation grid, full 256-bit PINs, evidence ID uniqueness, provisional stacking fix, provisional detail panel with requirements, cancel request, bidirectional positioning, NEW badge), 15–15.3 (Revoke Disclosures: ownership-aware handler, removedNodes/removedEdges/removedSDAs, cross-role cleanup, revocation+acceptance notifications, RevocationNoticeModal), 16–16.4 (Selective Disclosure: field picker, field filtering, no-PEP warning, children copy to disclosed nodes, NEW badge role-switch fix), 17–17.7 (Requirements Library: data structure, CRUD modal, Connect Asset integration, split-panel rewrite, Escape fix, styling refinements, versioning with lineageId/version fields, collapsed-by-lineage left panel, New Version replaces Edit, immutable sets with always-append save, search clear button + result count, Create button moved to modal header, PanelShell-style tabs, read-only name in New Version, top bar button normalization with 36px icon boxes, pill height 36px, V1 footer link removed, nested lineage cards with inner version items, search auto-expand for older version matches, New Version button in title row, icon button bg unified with pill bg), 17.8 (Requirement set viewing in Connect Asset + Disclosure Response: ReqSetPicker with scrollbox/expandable details/version badges/lineage dedup, ReqSetCard with expandable requirements in StepReview, step numbering fix), 17.9 (Decline flow cross-role effects with provisional cleanup + decline notification, removed demo pending request, Proof-Only blocker consistency matching Selective pattern, widened Request Sent confirmation modal), 17.10 (Hide expiration/summary/cascade when blocked in StepTerms, summary title as FieldLabel above card, re-request deduplication fix filtering by undismissed pending requests only), 17.11 (Detail Panel clickable requirement set links opening library with initialSelectedId, CSV import parsing in Requirements Library replacing placeholder with working file upload + auto-populate form), 18.0 (Evaluation data layer: evaluationHelpers.js with CLAIM_STATUS/EVAL_STATUS/calculateEvalCost/generateMockAIResults/summarizeEvaluation, makeEvalNode in v2Data.js, updated CATEGORY_CONFIG evaluation entry), 18.1 (Run Evaluation Modal: 4-step flow — Setup with requirement set picker/cost estimate/credit balance check, AI Processing with PrimeRadiant spinner/cycling messages/auto-advance, Human Review with extraction inputs/inference toggles/status radios/summary bar, Confirmation with green checkmark/InfoRows. V2App wiring: evalContext state, canEvaluate gating on PEP children + access, onComplete creates evalNode via makeEvalNode + addedChildren + credit deduction + dive-and-select. PanelShell Run Evaluation footer button), 18.2 (Evaluation node gating + detail panel + review UX: AssetNode terminal gating extended to isEvaluation/category=evaluation with EVALUATION badge + claims subtitle, DetailPanel specialized eval panel with version/disclosure/status badges + summary bar + claim cards with colored left border + confidence coloring + credits used, PanelShell footer gating with isEvaluation prop, EvaluationsTab Run Evaluation button wired with canEvaluate/onRunEvaluation props, RunEvaluationModal review UX — fixed summary bar above scrollable body, Back button in step 3, remaining count in button label, wider modal at 760px for review step).

---

**QA format:** Numbered checklist items. Action → expected result.
**Session management:** Always update CLAUDE.md after batch sequences.
