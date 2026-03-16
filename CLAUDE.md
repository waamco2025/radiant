# Radiant by Provenance — Supply Chain Trust & Traceability Platform

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V2 Prototype

V2 lives at `/v2.html`. V1 at `/index.html`. Shared: `tokens.js`, `index.css`. V1 is feature-complete; V2 is under active development (Batches 1–7.8 complete).

**All new work targets V2 unless explicitly stated.**

---

## Data Model — Two-Layer Graph

The network has exactly two layers. All organizations and assets are parent-level nodes connected by horizontal edges. Evidence, PEP outputs, and evaluations are child-level nodes inside a single child layer per asset.

### Parent Layer (flat network)
- All 5P entities: Party, Product, Place, Process, Person
- Supply chain relationships = horizontal edges, not vertical dives
- Edge types: `full` (same-owner structural), `selective`, `proofonly`, `cascade`
- Actions: Connect Asset, Disclose, Run Evaluation, View Chain
- Actions are **owner-only** — you can only act on nodes you own

### Child Layer (one per asset, artifact nodes only)
- Tier 1: **EVIDENCE** nodes (source documents, orange)
- Tier 2: **PARSE** nodes (PEP tokenized key-value pairs, purple) — planned
- Tier 3: **EVALUATION** nodes (results + claims, indigo) — planned
- No Disclose or Connect actions on child-layer nodes
- Accessed by diving into a parent-level asset

### Identity Model
- **PIN** — immutable identifier for every entity (orgs, assets, evidence, evaluations, requirements)
- **DOT** — transferable ownership title. Not a PIN. A struct with its own identifier. References the owner's org PIN. Hidden in prototype via `[data-badge-type="dot"] { display: none !important; }` in `index.css` until DOT model is finalized.
- **Actor vs Object** — DLT-level distinction. Actors have cryptographic keys (humans, AI agents, orgs). Objects don't (everything else). The 5 Ps are a UX meta-layer on top.

### Disclosure Model
- **Requestor cannot dictate disclosure type.** They can only: specify asset by PIN, attach requirements, send a message.
- **Owner decides disclosure type:** Full, Selective, or Proof-only.
- **Full** — receiving party accesses all parsed data fields and can run evaluations.
- **Selective** — receiving party accesses owner-selected data fields only. Redaction is at the PEP field level (per-field, per-party). Undisclosed fields produce grey minibar segments.
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
- `V2App.jsx` — Root. Role state, selection state, modal state. Passes `isOwner` and `activeParty`. Notification inbox with persistence (onClose vs onComplete split).
- `V2Canvas.jsx` — Three.js WebGL canvas. `forwardRef` exposes `dive()` and `surface()`. Threads `activeParty` for ownership gating. Dot grid rebuilds on dive/surface. Edge legend tooltips use current disclosure terminology.
- `AssetNode.jsx` — Node card overlay. Action bar gated on ownership + `isEvidence`. Owner-only: Connect Asset, Disclose. All nodes: Pin, Dive/Exit, View Chain. HealthBar renders `displayHealth`.

### Detail Panel (`src/components/DetailPanel/`)
- `index.jsx` — Entry. Tabs conditional: Evaluations shows if node has evals, evidence children, or is owned by user. Disclosures hidden for evidence nodes.
- `PanelShell.jsx` — Header, tabs, footer. Footer buttons gated on `isOwner` and `isEvidence`.
- `EvaluationsTab.jsx` — Asset nodes: eval panels + Run Evaluation. Evidence nodes: always-open EvidenceBlock + attributed claims. Evidence field visibility gated by `isOwner`.
- `DisclosuresTab.jsx` — SDA cards (no Party DOT row), "Disclosure type" label, Manage Cascading Disclosures reads `node.upstreamAssets`. Disclose button owner-only.
- `constants.js` — CATEGORY_CONFIG: person, party, place, product, process, evidence, parse, evaluation. SDA_CONFIG uses PEP-aware terminology.

### Modals (`src/components/modals/`)
- `RequestDisclosureModal.jsx` — Connect asset. 3 steps (path → PINs → requirements + message). **No level picker.** Owner determines type.
- `DisclosureResponseModal.jsx` — Respond to request. Accept/Decline only (no Counter). Owner chooses Full/Selective/Proof-only. `onComplete` dismisses notification; `onClose` preserves it. Cascade section gated by `hasCascadableAssets`.
- `PublishModal.jsx` — Publish to directory. 3-4 steps.
- `CascadeModal.jsx` — Manage cascading disclosures. Reads `node.upstreamAssets`.

### Data Layer (`src/v2/v2Data.js`)
Two roles:
- **Bob@GovCo** (buyer, 6 nodes: GovCo + Sentinel-4 + Propulsion + Avionics + Power Reg [selective, evaluated] + VReg IC [full, not evaluated])
- **Alice@MicroCo** (seller, 8 nodes: MicroCo + 6 products + GovCo's Avionics Module. 1 pending request for PCB Substrate)

`makeNode()` returns: `displayHealth`, `displayClaimCount`, `isEvidence`, `upstreamAssets`.
`makeEvidenceNode()` creates evidence child nodes with `isEvidence: true`, `attributedClaims`.

---

## V2 Key Conventions

### Flat Parent Layer
All orgs and assets are peers. Supply chain = horizontal edges. Diving shows artifact children only.

### Ownership Gating
Both Disclose and Connect buttons hidden on non-owned nodes. Threaded via `activeParty` from V2App → V2Canvas → AssetNode. Also gates Detail Panel footer and DisclosuresTab.

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
  x, y,
  isEvidence?: boolean,
  attributedClaims?: Claim[],
  isCascade?, cascadeVia?,
  upstreamSda?: { type, policy, owner, ownerDot },
  upstreamAssets?: Node[],
}
```

---

## Batch History

Complete: 1–3.6 (NetGraph + Detail Panel + cards), 4–4.6 (disclosure modals), 5–5.7 (cascade disclosures), 5.8 (evidence visibility), 6–6.6 (evidence as child nodes, minibar roll-up), 7–7.8 (flat parent layer, clean datasets, disclosure flow redesign, ownership gating, terminology update), 8–8.4 (Detail Panel fixes, disclosure persistence, network effect on acceptance, edge rendering WIP).

---

## Dynamic Data (Batch 8.2+)

V2App maintains three mutation arrays merged into static role data via `useMemo`:
- `addedNodes[]` — nodes created dynamically (disclosure acceptance reveals new party's asset)
- `addedSDAs{}` — `{ [nodeId]: SDA[] }` merged into matching nodes
- `addedEdges[]` — edges created dynamically

All reset on role switch. `DisclosureResponseModal.onComplete(disclosureType)` creates SDAs on both the target asset and the connecting node, plus an edge between them.

Pending request schema includes `connectTo: { id, name, pin, category, owner }` — identifies which of the requestor's assets initiated the request.

SDA schema includes `assetName` and `assetPin` — the connected asset's name and PIN. Shown in DisclosuresTab as "Connected asset" row. When null, falls back to the node's own name/PIN.

## Known Edge Rendering Bugs

1. Edges disappear on role switch to Alice until zoom changes (dirtyRef timing issue)
2. Edge endpoints use center-to-center instead of card-edge intersection (needs ray-box calculation)
3. Edges disappear after disclosure completion (state update clears edge group)

See `V2-ROUND5-HANDOFF.md` for detailed debug guidance.

**QA format:** Numbered checklist items. Action → expected result.
**Session management:** Always update CLAUDE.md after batch sequences.
