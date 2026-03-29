# Radiant by Provenance — Supply Chain Trust & Traceability Platform

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V2 Prototype

V2 lives at `/v2.html`. V1 at `/index.html`. Shared: `tokens.js`, `index.css`. V1 is feature-complete; V2 is under active development (Batches 1–29.3 complete).

**All new work targets V2 unless explicitly stated.**

---

## Data Model — Two-Layer Graph

The network has exactly two layers. All organizations and assets are parent-level nodes connected by horizontal edges. Evidence, PEP outputs, and evaluations are child-level nodes inside a single child layer per asset.

### Parent Layer (flat network)
- All 5P entities: Party, Product, Place, Process, Person
- Supply chain relationships = horizontal edges, not vertical dives
- Edge types: `full` (same-owner structural), `selective`, `proofonly`, `cascade`, `provisional`
- Actions: Connect Asset, Publish, Add Evidence, Run Evaluation, View Chain, Exit Layer
- Actions are **owner-only** — you can only act on nodes you own
- Provisional nodes: `provisional: true` flag. Dashed border, muted opacity, no actions, "Awaiting owner response" text
- Subchain view: third layer mode on same canvas, linear horizontal layout

### Child Layer (one per asset, artifact nodes only)
- Tier 1: **EVIDENCE** nodes (source documents, orange). PARSED/UNPARSED badge computed dynamically via `_isParsed` flag. **EVALUATION** nodes (results + claims, indigo).
- Tier 2: **PARSE** nodes (PEP extracted key-value fields, purple). Connected to source evidence via `sourceEvidenceId`. Category `'parse'`, `isParse: true`. Bidirectional spread from parent evidence.
- Parse nodes are **terminal** — no Connect, Publish, or Add Evidence actions
- Evidence nodes get Add Evidence (on anchor), Parse Evidence, and Run Evaluation actions
- Accessed by diving into a parent-level asset
- Multi-tier layout: `layoutChildren` separates by category, bidirectional collision avoidance at tier 2

### Identity Model
- **PIN** — Full 256-bit hex: `PIN-0x[64 hex chars]`. Displayed truncated as `PIN-0x[4hex]...[4hex]` in badges. Copy always gives full string.
- **DOT** — transferable ownership title. Full 256-bit hex, same format as PIN. Hidden in prototype via CSS until DOT model is finalized.
- **Actor vs Object** — DLT-level distinction. Actors have cryptographic keys. Objects don't. The 5 Ps are a UX meta-layer on top.

### Disclosure Model
- **Requestor cannot dictate disclosure type.** They can only: specify asset by PIN, attach requirements, send a message.
- **Owner decides disclosure type:** Full, Selective, or Proof-only.
- **Full** — receiving party accesses all parsed data fields and can run evaluations. Published to Radiant Network Public Directory = visible to everyone.
- **Selective** — receiving party accesses owner-selected data fields only. Redaction is at the PEP field level (per-field, per-party). Owner selects fields via StepFieldSelection.
- **Proof-only** — receiving party sees pass/fail results (SAT/UNSAT/MISS badges) from owner's evaluations only. No data values, confidence scores, or methodology (INF/EXT) visible.
- **Anti-spam:** All disclosures are invitation-driven. Sellers cannot push disclosures to buyers.
- **Three degrees planned:** Direct asset-to-asset, public directory, private catalogs.

### Protocol Waterfall
Ingest → Curate → Consume: Register (DPP) → Prepare (PEP) → Share (SDP) → Evaluate (REP). PEP is the only process that touches raw evidence. All evaluations run against PEP output. SDP is the only mechanism granting access to curated data in Qualified Storage.

### Minibar Roll-up
- Parent asset minibar = aggregate of child-layer evaluation claims
- `displayHealth` field on each node: for nodes with evidence children, shows pure `childHealth` (avoids double-counting)
- Evidence nodes have minibars showing claims attributed to them

---

## V2 Architecture

### App Shell
- `V2App.jsx` — Root. Per-role keyed state (`perRoleState`), selection state, modal state, layer info, subchain state, reveal animation state. Passes `isOwner` and `activeParty`. Notification inbox with persistence. `findClearY` for collision-free node placement. All modal completion handlers here. Footer with portal tooltip for QS indicator.
- `V2Canvas.jsx` — Three.js WebGL canvas. `forwardRef` exposes `dive()`, `surface()`, `panToWithZoom()`, `fitAll()`, `playWarpStreaks()`, `playLateralStreaks()`, `fadeOutCards()`, `fadeInCards()`. `layoutChildren` handles multi-tier positioning with bidirectional tier 2 spread. Root layer always-sync + child layer sync via `layerStackRef`. LOD_THRESHOLD = 0.66 — cards become dots below this zoom.
- `AssetNode.jsx` — Node card overlay. Action bar gated on ownership + `isEvidence` + `isTerminalNode` + `isProvisional`. Provisional cards: dashed border, grey selection outline, muted, "PROVISIONAL" badge, suppressed actions. Reveal animation: `revealPhase` prop drives border wipe, card flip (scaleY), badge color, and appearance swap via `_showAsProvisional` + `flipMidpoint`.

### Detail Panel (`src/components/DetailPanel/`)
- `index.jsx` — Entry. Tabs conditional. Provisional nodes get minimal "Awaiting Disclosure" panel. Parse nodes get parsed fields. Eval nodes get unified ClaimsTable.
- `PanelShell.jsx` — Header (with description row), tabs, footer. Footer buttons gated on `isOwner`, `isEvidence`, `isParse`.
- `EvaluationsTab.jsx` — Asset nodes: eval panels + Run Evaluation. Evidence nodes: always-open EvidenceBlock + attributed claims.
- `EvalPanel.jsx` — Expandable eval accordion. Summary bar + ClaimsTable. Expand-to-modal + CSV download.
- `DisclosuresTab.jsx` — SDA cards with click-to-pan. Revoke flow with unified warning design. ProofOnlyEvalDisplay with expandable claims. State resets on node change.
- `ChildrenTab.jsx` — Child cards with node type tooltips.
- `ParsedFieldsTab.jsx` — Grouped field display with expand-to-modal + CSV download.
- `shared/ClaimsTable.jsx` — Unified 3-line rows: label, description, value. INF/EXT + Conf% + SAT/UNSAT badges. `proofOnly` prop hides values/conf/type.
- `shared/DataTable.jsx` — Generic data table.
- `shared/TableActions.jsx` — Expand-to-modal + CSV download icon buttons. `claimsToCSV()` utility.
- `shared/TableModal.jsx` — Full-width modal for expanded tables.
- `constants.js` — CATEGORY_CONFIG, REVOKE_WARNINGS (contextual per type).

### Modals (`src/components/modals/`)
- `ModalShared.jsx` — Shared `Backdrop`, `SDATypeCard`, `ExpiryPicker`, etc. `_noBackdrop` for persistent backdrop.
- `RequestDisclosureModal.jsx` — Connect Asset. PIN grid input, directory browser, inline validation.
- `DisclosureResponseModal.jsx` — Respond to request. Accept/Decline. Owner chooses type. StepFieldSelection for selective. Exports `StepFieldSelection`.
- `RegisterAssetModal.jsx` — "Register Assets" (plural). Single + Bulk CSV tabs. Tab-style source selection: Local file / Qualified Storage.
- `AddEvidenceModal.jsx` — Tab-style source: Local file / Qualified Storage. Hash & Endorse animation plays in drop area after QS selection.
- `ParseEvidenceModal.jsx` — PEP template selection, field preview, duplicate detection, PrimeRadiant spinner.
- `RunEvaluationModal.jsx` — Split-view: PDF/parsed fields left, eval form right. Claims in page-like container.
- `RequirementsLibraryModal.jsx` — Library + editor. Search match highlighting in amber.
- `PublishModal.jsx` — "Publish to Directory" / "Radiant Network Public Directory." Steps: confirm → permission → field selection (selective) / eval selection (proof-only) → expiry. Selective: scrollboxes showing fields. Full: red warning about exposing all evidence. useRef for isAlreadyPublished.
- `QualifiedStoragePicker.jsx` — Full-screen takeover, centered 1100×720 file table. Mock S3 buckets per org. Radio buttons (single) / checkboxes (multi). File type filtering via `accept` prop. AWS S3 badge in header.
- `RevocationNoticeModal.jsx` — Read-only revocation notice.
- `CascadeModal.jsx` — Manage cascading disclosures.

### Data Layer
- `v2Data.js` — Two roles. Bob@GovCo (buyer), Alice@MicroCo (seller). Key: `makeNode()`, `makeEvidenceNode()`, `makePepNode()`, `makePin()`, `makeDot()`, `resolvePin()`.
- `pepTemplates.js` — 3 templates. `FIELD_CATEGORIES` for grouping. `generateMockParsedFields()`.
- `requirementSets.js` — Demo sets per role. `extraction` and `inference` types.
- `evaluationHelpers.js` — Mock AI evaluation generator. `CLAIM_STATUS` map.

---

## V2 Key Conventions

### No Emojis
All icons are SVG. No emoji characters anywhere in the app. Unicode symbols (✓, ✕, ⚠, ▸, ■, etc.) are acceptable.

### Flat Parent Layer
All orgs and assets are peers. Supply chain = horizontal edges. Diving shows artifact children only.

### Ownership Gating
Connect, Publish, Add Evidence, Parse Evidence hidden on non-owned nodes. Threaded via `activeParty` from V2App → V2Canvas → AssetNode.

### Terminal Nodes
Parse nodes (`isParse: true`) have no Connect, Publish, or Add Evidence actions. Only View Chain and Exit Layer.

### Evidence Visibility
Evidence fields gated by `isOwner`: hash/block/retention always visible. Filename/URI/provider owner-only.

### Health Display
Always use `displayHealth` (not `health`) for rendering.

### CSS Variables
All components use CSS variables. Never hardcode colors. Use `color-mix(in srgb, var(--accent-*) N%, transparent)` for alpha.

### Chevrons
All expand/collapse triangles (▸/▾) render at fontSize 20px app-wide, except the user menu dropdown (14px).

### State Conventions
- Tab state: always-mounted with `display: none/block`.
- Notification persistence: `onClose` closes modal only. `onComplete` closes AND dismisses.
- Revoke state: `exp`, `rev`, `revokeMessage` reset on `node.id` change via useEffect.

### Subchain Conventions
- Forward BFS from own party node for depth assignment. Unreached nodes go right.
- Party node lookup: match by `n.name`, not `n.owner` (MicroCo has `owner: null`).
- View Chain hidden on: focus node, party nodes, child layer nodes.
- Lateral streaks for enter/exit. Radial warp for child layer dive/surface.
- Fixed zoom 0.7 for enter/exit (above LOD_THRESHOLD 0.66).

### Provisional Card Reveal
- `_showAsProvisional`: card looks provisional until reveal animation plays
- `_wasProvisional`: triggers reveal only on upgraded provisionals (not all _isNew nodes)
- Reveal phases: zoom → border → flip → badge → panel → done
- Detail Panel switches to Disclosures tab during reveal
- Connected edge also stays provisional-styled until flip phase

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
  evidence?: { filename, hash, block, provider, uri, retention, localPath? },
  evaluations: Evaluation[],
  sdas: SDA[],
  parsedFields?: ParsedField[],
  x, y,
  isEvidence?: boolean,
  isParse?: boolean,
  isEvaluation?: boolean,
  sourceEvidenceId?: string,
  _isParsed?: boolean,
  attributedClaims?: Claim[],
  isCascade?, cascadeVia?,
  upstreamSda?: { type, policy, owner, ownerDot },
  upstreamAssets?: Node[],
  provisional?: boolean,
  requestContext?: { requirements, message, date, contextNodeName, contextNodePin },
  _isNew?: boolean,
  _wasProvisional?: boolean,
  _showAsProvisional?: boolean,
  _isDeclined?: boolean,
  fromDirectory?: boolean,
  description?: string,
  isNetworkNode?: boolean,
}
```

---

## Dynamic State (Per-Role Keyed)

V2App maintains `perRoleState` — an object keyed by role ID:

```javascript
{
  addedNodes: [],
  addedSDAs: {},        // { [nodeId]: SDA[] }
  addedEdges: [],
  dismissedReqs: [],
  addedChildren: {},    // { [parentNodeId]: childNode[] }
  addedRequests: [],
  removedNodes: [],
  removedEdges: [],
  removedSDAs: [],
  newlyDisclosedIds: [],
  requirementSets: null,
}
```

All mutations persist across role switches. Cross-role mutations write to the OTHER role's state directly.

### useMemo Merge Pipeline
0. Filter removedNodes/removedEdges/removedSDAs from static data
1. Merge addedNodes into data.nodes
2. Merge addedSDAs into matching nodes
3. Merge addedChildren into parent nodes
4. Compute _isParsed flag on evidence nodes
5. Rebuild nodeMap
6. Merge addedEdges
7. Merge addedRequests into pendingRequests

### Provisional → Real Upgrade
When owner accepts disclosure: replaces `provisional-${reqNodeId}` with real node (keeping position). Adds `_isNew: true`, `_wasProvisional: true`, `_showAsProvisional: true`. Edge upgraded from `'provisional'` to actual type with `_showAsProvisional: true`.

---

## Batch History

Complete: 1–3.6 (NetGraph + Detail Panel + cards), 4–4.6 (disclosure modals), 5–5.7 (cascade disclosures), 5.8 (evidence visibility), 6–6.6 (evidence as child nodes), 7–7.8 (flat parent layer), 8–8.7 (Detail Panel fixes, per-role state), 9–9.2 (Register Asset), 10–10.1 (Add Evidence), 11 (Bulk CSV evidence), 12–12.3 (PEP Parse), 13–13.4 (Refinements), 14–14.9 (Connect by PIN, provisional cards), 15–15.3 (Revoke Disclosures), 16–16.4 (Selective Disclosure), 17.0 (Requirements Library), 17.1–17.11 (Requirements Library refinements), 18.0–18.14 (Run Evaluation), 19.0–19.4 (Public Directory + Publish), 20.0–20.2 (Footer scaling, revocation fix, declined persistence), 21.0–21.3 (Design system unification, DataTable), 22.0–22.3 (Evidence file viewer, eval trigger change), 23.0–23.1k (Subchain view), 24.0–24.1 (Quick wins: warnings, badges, highlighting, card size), 25.0–25.2 (Selective field picker, revoke fixes, emoji removal, button rename), 26.0–26.3 (POE display, claims table harmonization, expand-to-modal, CSV download), 27.0 (Bidirectional PEP layout), 28.0–28.1 (Provisional card reveal animation, publish modal polish), 29.0–29.3 (Qualified Storage picker).

---

**QA format:** Numbered checklist items. Action → expected result → Succeeded / Failed.
**Session management:** Always update CLAUDE.md after batch sequences.
