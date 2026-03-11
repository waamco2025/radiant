# Radiant V2 Prototype — Session Handoff

**Date:** March 9, 2026
**Session:** PCN Prototyping Round 4 (this chat)
**Next:** PCN Prototyping Round 5

---

## What Was Built This Session

Starting from the V2 WebGL NetGraph canvas (built in Round 3), this session designed and implemented:

### Detail Panel (Batches 1–2.7)
- **Batch 1:** Data layer (`v2Data.js`) with role-aware datasets (Bob@GovCo buyer, Alice@MicroCo seller), role switcher in user menu, edge type rename (derivative→proofonly)
- **Batch 1.5:** Fixed role switching (key={roleId} on V2Canvas), removed header pillbox, grid-aligned node positions
- **Batch 2:** Full Detail Panel decomposed into 16 component files under `src/components/DetailPanel/`. Evaluations tab, Children tab, Disclosures tab, Claims table with keyboard nav, Evidence block with unfurl animation, cascade chain visualization, revoke flow
- **Batch 2.5:** Fixed child node selection (deep nodeMap), tab persistence on node switch, zoom controls offset, LayerBorder inset for panel
- **Batch 2.6:** Always show Evaluations tab (even empty), suppress panel for party nodes, reset tab/eval state on node change
- **Batch 2.7:** Added evidence objects to all leaf nodes, removed Access level row from EvidenceBlock

### Node Card Refresh (Batches 3–3.6)
- **Batch 3:** HealthBar red segment fix, minibar text "N · N" breakdown, userSelect none, paperclip icon for evidence nodes, pan-to-node vertical offset
- **Batch 3.5:** HealthBar gap between segments, paperclip hover/tooltip, horizontal pan offset for panel, Pin to Surface stub, forwardRef on V2Canvas for imperative actions, footer button wiring (View Chain, Expand Stack, Exit Layer, Surface)
- **Batch 3.6:** Pan offset direction fix, "Exit Layer" label unification, SVG pin icon, compact footer with hover-reveal labels, legend tooltip text updates

### Disclosure Modals (Batches 4–4.6)
- **Batch 4:** Three modal sequences (PublishModal, RequestDisclosureModal, DisclosureResponseModal), shared modal primitives, notification inbox with bell/badge/dropdown, wiring through V2App→V2Canvas→AssetNode→DetailPanel
- **Batch 4.5:** Escape key closes modals (capture phase prevents canvas handlers), footer "Connect Asset" label, ⇋ card button wired, notification clearing after response
- **Batch 4.6:** Proof-only disabled card brightened with ⚠ warning + "Run an evaluation →" link, CopyBadge "✓ Copied" alignment

### Reference Files Created
- `detail-panel-v2-reference.html` — 4 panel examples (FastCo evidence, FastCo hybrid, GovCo hybrid, GovCo cascade)
- `DETAIL-PANEL-HANDOFF.md` — full architecture, schemas, component hierarchy
- `disclosure-modals-reference.html` — 3 modal flows (publish, request, respond) with all step logic
- `attestation-comparison.jsx` — original subject-centric vs claim-centric comparison (project file, predates this session)

---

## Current File Structure (V2)

```
src/
├── V2App.jsx                    — App shell, role state, modal state, panel/canvas wiring
├── V2Canvas.jsx                 — WebGL Three.js canvas, forwardRef, dive/surface/pan
├── AssetNode.jsx                — Node card with action bar, evidence clip, health bar
├── V2SubgraphModal.jsx          — Subchain modal (stub, header + placeholder body)
├── V2BootScreen.jsx             — Boot animation
├── PrimeRadiant.jsx             — 3D logo (Three.js)
├── LayerBorder.jsx              — Decorative border for child layers
├── v2Data.js                    — Role-aware data with deep nodeMap, pendingRequests
├── tokens.js                    — V1 tier/type system (shared)
├── index.css                    — CSS variables, animations, themes
├── components/
│   ├── DetailPanel/
│   │   ├── index.jsx            — Entry: tab decision, state lifting, prop threading
│   │   ├── PanelShell.jsx       — Header, tabs, footer with hover-reveal buttons
│   │   ├── EvaluationsTab.jsx   — Evidence section + eval panels
│   │   ├── ChildrenTab.jsx      — ChildHealthBar + child cards
│   │   ├── DisclosuresTab.jsx   — SDA cards + cascade chain + revoke
│   │   ├── ClaimsTable.jsx      — Sticky header, keyboard nav, truncation
│   │   ├── EvalPanel.jsx        — Collapsible evaluation card
│   │   ├── EvidenceBlock.jsx    — Controlled, max-height unfurl animation
│   │   ├── constants.js         — Layout constants, SDA config, category config
│   │   └── shared/
│   │       ├── CopyBadge.jsx
│   │       ├── SDABadge.jsx
│   │       ├── HealthBar.jsx
│   │       ├── ChildHealthBar.jsx
│   │       ├── GridRow.jsx
│   │       ├── StatPills.jsx
│   │       └── Tooltip.jsx
│   └── modals/
│       ├── ModalShared.jsx      — Backdrop, ModalFrame, SDATypeCard, DecisionCard, etc.
│       ├── PublishModal.jsx     — Flow A: publish to directory (3-4 steps)
│       ├── RequestDisclosureModal.jsx — Flow B buyer: connect asset (3 steps)
│       └── DisclosureResponseModal.jsx — Flow B seller: accept/counter/decline (2 steps)
```

---

## Architecture Decisions (Finalized)

### Unified Node Model
No type enum. Every node has the same schema. Detail Panel inspects populated fields to decide tabs:
- `evidence` → show Evidence section in Evaluations tab
- `evaluations[]` → show eval panels (tab always shown regardless)
- `children[]` → show Children tab
- `sdas[]` → show Disclosures tab

### Node States (not types)
- **Evidence-bearing leaf:** has evidence + evaluations, no children
- **Parent/container:** has children, health aggregated from descendants
- **Hybrid:** has own evidence + evaluations AND children
- **Cascaded:** owned by a third party, accessed via cascade chain

### SDA Types
| Type | Badge | Color | Meaning |
|------|-------|-------|---------|
| Full | Solid border | Indigo #7e8ef8 | Extraction + inference |
| Selective | Dashed border | Amber #fbbf24 | Inference only, no extraction |
| Proof-only | Dotted border | Green #36d49a | POE pass/fail only |
| Cascade | Dashed border | Purple #a78bfa | Access through intermediary |

### Disclosure Model
- **Flow A (Public):** Seller publishes to directory with max permission level + expiration. Creates standing offer.
- **Flow B (Private):** Buyer requests by PIN → Seller accepts (match level), counters (downgrade only), or declines.
- **Anti-spam:** Sellers cannot push disclosures to buyers. All private disclosures originate from buyer requests.
- **Permission constraint:** Can only match or downgrade, never upgrade. Cascade ≤ upstream SDA.

### V2Canvas Integration
- V2Canvas wrapped in `forwardRef` with `useImperativeHandle` exposing `dive()` and `surface()`
- Reports layer changes via `onLayerChange` callback
- Accepts `panelWidth` prop to offset zoom controls and LayerBorder
- Threads `onSelect`, `onConnect`, `onDisclose` to AssetNode

---

## Data Schema (v2Data.js)

### Node
```typescript
{
  id, pin, name, category, owner, dot,
  parentId, children: Node[],
  health: { ok, warn: 0, bad },
  childHealth?, totalHealth?,
  hasEvidence, hasStack, childCount,
  evidence?: { filename, hash, block, provider, uri, retention },
  evaluations: Evaluation[],
  sdas: SDA[],
  x, y, claimCount
}
```

### Evaluation
```typescript
{
  id, org, orgDot, date, requirements, status,
  creditsUsed, reviewer, reviewDate,
  claims: [{ requirement, output, type, status, dispute? }]
}
```

### SDA
```typescript
{
  id, type, party, partyLabel?, partyDot,
  created, expires, pins[],
  isOwnerSDA?, poeResult?, evalRef?,
  chain?: [{ from, to, sdaType, status }]
}
```

### Roles
- Bob@GovCo (buyer, Government/Satellite, 2400 credits, 0 pending requests)
- Alice@MicroCo (seller, Electronics, 2400 credits, 2 pending requests)

---

## Known Issues / Refinements Backlog

### Bugs
- Edge lines disappear on initial load / role switch — restore when zoom changes (pre-existing Three.js needsUpdate issue)
- Light mode child layer background opacity too high
- CopyBadge normal state styling differs between Detail Panel and modals (Detail Panel shows truncated values differently)

### Deferred Features
- **Provisional card treatment** — dashed border, muted colors, "PROVISIONAL · Awaiting evaluation" badge. V1 implementation in `NetGraph.jsx` lines ~619-662 (approvalStates detection, strokeDasharray="4,3", var(--border-hover) stroke). Needs adaptation from card-pair (v1) to single card (v2).
- **Public Asset Directory** — greyed out in Flow B Step 1. Entry point: "+ Connect Asset" button. Header message: "Select an asset to connect to [node name]." Multiple requests attach as children of initiating node.
- **Cascade disclosure flow** — separate from Flow A/B. Initiated by intermediary forwarding an upstream SDA. Permission can only downgrade.
- **Evaluation modal sequence** — 5-phase: setup → AI processing → results triage → human review → POE issuance. Credit-based. Human review always required.
- **Sidebar / navigation redesign** — not started for v2
- **Network Updates port from v1** — notification system, activity log
- **Pin to Surface** — button exists (stub console.log), mechanics need data layer + parent layer rendering changes
- **Subchain Modal content** — stub exists, body is placeholder
- **Requirements sub-modal** — scrollable table of individual requirements within a requirement set (needed in disclosure flows and public directory)

### Polish Items
- SVG pin icon looks like a paddle — refine the path
- "Run an evaluation →" link in disabled Proof-only card needs wiring to evaluation modal
- Node card minibar: consider showing totalHealth (own + children) instead of just own health
- Double-click on Organization node should be disabled (it's the whole network)
- text-wrap: pretty should be added to index.css globally for the prototype

---

## V1 Deprecation Status

V1 at `/index.html`, V2 at `/v2.html`. Shared only: `tokens.js`, `index.css`, `AssetNode.jsx`.
V1 can be cut after the evaluation modal is built in V2 (the last major v1 feature not yet ported).

---

## Next Steps (Priority Order)

1. **Provisional card treatment** — adopt v1's dashed-border style as single card in v2. Appears when a disclosure request is sent, persists until accepted/rejected.
2. **Cascade disclosure flow design** — separate design session, then implementation
3. **Evaluation modal** — the core feature that generates claims, health bars, POE credentials
4. **Public Asset Directory** — enables Flow B path 2, closes the disclosure loop
5. **Sidebar redesign** — navigation, filtering, search
6. **Network Updates** — activity log, notification system beyond the current bell stub
