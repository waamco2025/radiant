# Radiant by Provenance — Supply Chain Traceability Platform

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V2 Prototype

V2 lives at `/v2.html`. V1 at `/index.html`. Shared: `tokens.js`, `index.css`. V1 is feature-complete (Batches 27a–39); V2 is under active development (Batches 1–4.6 complete).

**All new work targets V2 unless explicitly stated.**

---

## V2 Architecture

### App Shell
- `src/v2/V2App.jsx` — Root. Role state, selection state, modal state, layer info, all callback wiring. Imports DetailPanel + 3 disclosure modals.
- `src/v2/V2Canvas.jsx` — Three.js WebGL canvas wrapped in `forwardRef`. Exposes `dive()` and `surface()` via `useImperativeHandle`. Props: `panelWidth`, `onLayerChange`, `onSelect`, `onConnect`, `onDisclose`, `onOpenSubgraph`.
- `src/v2/AssetNode.jsx` — Node card as HTML overlay on canvas. Action bar with hover buttons: + Connect Asset, ⇋ Disclose, Pin to Surface (child layer), ⊞ Dive / ⊟ Exit Layer, ⛓ View Chain. HealthBar renders `{ok, warn, bad}` with green/amber/red segments + 1px gap.

### Detail Panel (`src/components/DetailPanel/`)
- `index.jsx` — Entry. Reads node fields to decide tabs. Lifts eval/evidence state. Always shows Evaluations tab (even if empty — it's the "Run Evaluation" entry point).
- `PanelShell.jsx` — Header (category, name, PIN, owner, DOT, health bar, summary), pillbox tabs, scrollable content, footer with hover-reveal icon buttons (+ Connect Asset, nav button, Pin, ⛓ View Chain).
- `EvaluationsTab.jsx` — 📎 EVIDENCE section (collapsible, unfurl animation) + eval panels with expand/collapse all + ✦ Run Evaluation button.
- `ChildrenTab.jsx` — ChildHealthBar (per-child segments, 6px gap, ref-based tooltips) + child cards. Owner row stacks name + DOT vertically, highlights amber when owner ≠ parentOwner.
- `DisclosuresTab.jsx` — SDA cards with cascade chain visualization, revoke flow with per-type warnings, ⇋ Disclose this Asset button.
- `ClaimsTable.jsx` — 3-column (Requirement | Claim | Result), sticky header, keyboard nav (arrows/home/end), truncation tooltips, scrollable at 8.5 rows.
- `shared/` — CopyBadge ("✓ Copied"), SDABadge, HealthBar, ChildHealthBar, GridRow (with labelTip), StatPills, Tooltip (portal-based).
- `constants.js` — PANEL_W=480, GUTTER=18, LABEL_W=170, BTN_H=34, ROW_H=36, MAX_ROWS=8.5, SDA_CONFIG, CATEGORY_CONFIG, REVOKE_WARNINGS.

### Modals (`src/components/modals/`)
- `ModalShared.jsx` — Backdrop (Escape handler via capture phase + stopPropagation), ModalFrame, ModalHeader, ModalBody, ModalFooter, StepDots, Btn, FieldLabel, InfoRow, CopyBadge, SDATypeCard (hover effect, disabled state with ⚠ warning + "Run an evaluation →" link), DecisionCard.
- `PublishModal.jsx` — Flow A: seller publishes to directory. 3 steps (4 if proof-only: adds eval multi-select). Proof-only disabled when no completed evaluations.
- `RequestDisclosureModal.jsx` — Flow B buyer: connect asset. 3 steps (path selection → PINs + level → requirements + message + review). "Browse Public Directory" path greyed out with COMING SOON badge.
- `DisclosureResponseModal.jsx` — Flow B seller: respond to request. 2 steps (review + decide → set terms or decline). Accept locks level. Counter only shows strict downgrades. Width 720px.

### Data Layer
- `src/v2/v2Data.js` — `getDataForRole(roleId)` returns `{ nodes, edges, nodeMap, pendingRequests }`. `nodeMap` includes children recursively via `addChildrenToMap`. Two roles:
  - Bob@GovCo (buyer, Government/Satellite, 2400 credits, 0 pending requests)
  - Alice@MicroCo (seller, Electronics, 2400 credits, 2 pending requests from GovCo + Orbital Systems)

### Supporting
- `V2SubgraphModal.jsx` — Stub (header + placeholder body)
- `V2BootScreen.jsx` — Boot animation
- `PrimeRadiant.jsx` — 3D logo (Three.js)
- `LayerBorder.jsx` — Decorative border for child layers, accepts `rightInset` for panel offset

---

## V2 Key Conventions

### No Node Type Enum
Every node uses the same schema. Detail Panel renders tabs based on populated fields — not a type field. A node with `evidence` + `children` shows 3 tabs. A node with only `evaluations` shows 1 tab.

### Health Object
`{ ok: number, warn: number, bad: number }` — `warn` is always 0 currently. AssetNode's HealthBar reads all three fields. **Include `warn: 0` in every health object.**

### SDA Types
| Type | Badge border | Color | Meaning |
|------|-------------|-------|---------|
| Full | Solid | Indigo #7e8ef8 | Extraction + inference |
| Selective | Dashed | Amber #fbbf24 | Inference only, no extraction |
| Proof-only | Dotted | Green #36d49a | POE pass/fail only, no evidence access, no further evals |
| Cascade | Dashed | Purple #a78bfa | Access through intermediary |

Permissions can only match or downgrade, never upgrade. Cascade ≤ upstream SDA.

### Disclosure Model
- **Flow A (Public):** Seller publishes to directory with max permission level + expiration.
- **Flow B (Private):** Buyer requests by PIN → Seller accepts/counters/declines. Counter only offers strict downgrades.
- **Anti-spam:** Sellers cannot push disclosures to buyers. All private disclosures originate from buyer requests.

### CSS Variables
All components use CSS variables from `index.css`. Never hardcode colors. Key variables:
- `--bg-deep`, `--bg-card`, `--bg-surface`, `--bg-raised`, `--bg-hover`
- `--border`, `--border-hover`
- `--text-primary`, `--text-secondary`, `--text-tertiary`, `--text-dim`
- `--accent-indigo`, `--accent-green`, `--accent-red`, `--accent-amber`, `--accent-purple`
- `--font-display` (DM Sans), `--font-mono` (JetBrains Mono)
- Use `color-mix(in srgb, var(--accent-*) N%, transparent)` for alpha — NOT hex-alpha.

### State Conventions
- **Tab state:** All Detail Panel tabs always-mounted with `display: none/block`. Never conditional rendering.
- **Modal Escape:** Backdrop uses capture-phase keydown listener with `stopPropagation()` to prevent V2Canvas surface transitions.
- **V2Canvas ref:** `forwardRef` + `useImperativeHandle` exposes `dive(node)` and `surface()`. V2App holds the ref.
- **Layer changes:** V2Canvas reports via `onLayerChange({ depth, anchorId })`. V2App uses this for Detail Panel footer button labels.

### Do NOT Modify (Unless Specified)
`V2SubgraphModal.jsx`, `LayerBorder.jsx`, `tokens.js`, `PrimeRadiant.jsx`, `V2BootScreen.jsx`

---

## V2 Reference Files

Located in `/references/`:
- `detail-panel-v2-reference.html` — Interactive HTML with 4 panel examples (FastCo evidence, FastCo hybrid, GovCo hybrid, GovCo cascade)
- `DETAIL-PANEL-HANDOFF.md` — Full architecture, node schema, component hierarchy, interaction specs
- `disclosure-modals-reference.html` — Interactive HTML with 3 modal flows (publish, request, respond)
- `V2-SESSION-HANDOFF.md` — Full session log with build history, known issues, next steps

**Read reference files when implementing features they document.** They contain exact layout, spacing, interaction patterns, and data shapes.

---

## V2 Node Schema

```javascript
{
  id, pin, name, category, owner, dot,
  parentId, children: Node[],
  health: { ok, warn: 0, bad },
  childHealth?, totalHealth?,
  hasEvidence, hasStack, childCount,
  evidence?: { filename, hash, block, provider, uri, retention },
  evaluations: [{ id, org, orgDot, date, requirements, status, creditsUsed, reviewer, reviewDate,
    claims: [{ requirement, output, type: 'direct'|'inferred', status: 'verified'|'contested', dispute? }]
  }],
  sdas: [{ id, type, party, partyLabel?, partyDot, created, expires, pins[],
    isOwnerSDA?, poeResult?, evalRef?,
    chain?: [{ from, to, sdaType, status }]
  }],
  x, y, claimCount
}
```

---

## V2 Provisional Card (Planned)

When a buyer sends a disclosure request via Connect Asset, a provisional card appears immediately as a child of the initiating node. Dashed border (`strokeDasharray="4,3"`), `var(--border-hover)` stroke, "PROVISIONAL · Awaiting response" badge. V1 implementation reference: `src/components/NetGraph.jsx` lines ~619-662 (approvalStates detection, provisional styling).

---

## V1 Reference (Feature-Complete)

V1 is at `/index.html`. All IA Map features implemented (Batches 27a–39). Key components for reference:

- `App.jsx` — Root (~55KB). Buyer/supplier modes, credits, SDA mutations, approval states, evidence requests, cascade requests.
- `NetGraph.jsx` — SVG network graph with provisional node styling, convergence edges.
- `DetailPanel.jsx` — 4-tab buyer panel (Overview/Evals/Claims/Timeline), 2-tab supplier panel. Takeover pattern for evidence.
- `EvaluationModal.jsx` — 5-phase: Setup → Processing → Results → Review → Complete. PRNG-seeded, triage, human review, evidence-aware re-evaluation.
- `SDACreationModal.jsx` — 4-step wizard. Invitation-driven entry.
- `AssetDirectoryModal.jsx` — Platform-wide asset browse.

---

## Working Pattern

Andrew uses Chat (Claude Opus) for feature design and prompt writing. Prompts sent verbatim to Claude Code (Sonnet) for execution. After each batch: screenshots, task-by-task QA, fix batches. Living documentation files (CLAUDE.md, reference files) enable clean handoffs between sessions.

**Batch numbering:** V2 batches: 1, 1.5, 2, 2.5, 2.6, 2.7, 3, 3.5, 3.6, 4, 4.5, 4.6 (complete).

**QA format:** Numbered checklist items. Each is a specific testable assertion (action → expected result).

**Session management:** Always update CLAUDE.md after completing a batch sequence before restarting Claude Code.
