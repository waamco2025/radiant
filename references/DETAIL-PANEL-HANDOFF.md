# Detail Panel v2 — Claude Code Handoff

## Reference File

`detail-panel-v2-reference.html` — standalone interactive HTML/React prototype with four example panels across two verticals. Open in browser to explore all states, interactions, and data.

---

## Core Principle: One Node Type

There is **no type enum**. Every node on the network uses the same schema. The Detail Panel renders tabs based on which fields are populated:

| Field populated | Tab shown | Example |
|---|---|---|
| `evidence` object | Evaluations tab (with EVIDENCE section) | US Passport |
| `evaluations[]` non-empty | Evaluations tab (eval panels) | All nodes with evals |
| `children[]` non-empty | Children tab | Jane Torres, Power Regulation Module |
| `sdas[]` non-empty | Disclosures tab | All disclosed nodes |

A node can have any combination. A leaf node with just evidence shows 2 tabs. A hybrid node with evidence + children shows 3 tabs. A parent with only children shows 2 tabs (Children + Disclosures). The panel adapts — no branching on type.

---

## Node Schema

```typescript
interface Node {
  // Identity
  id: string                          // unique node ID
  pin: string                         // public identifier "PIN-0x7b2f...a3e1"
  name: string                        // display name
  category: 'person' | 'party' | 'place' | 'product' | 'process'

  // Ownership — always the party, never a person
  owner: string                       // party name
  dot: string                         // party DOT identifier (ownerDot internally)

  // Hierarchy
  parentId: string | null             // parent node ID
  children: Node[]                    // full child node objects (not IDs)
  
  // Health
  health: { ok: number, bad: number } // this node's own evaluation claims
  childHealth?: { ok: number, bad: number }  // sum of children's health (hybrid nodes)
  totalHealth?: { ok: number, bad: number }  // health + childHealth combined

  // Flags (drive UI behavior, not node "type")
  hasEvidence?: boolean               // true → show paperclip icon, EVIDENCE section
  hasStack?: boolean                  // true → show "⊞ Expand Stack" in footer
  childCount?: number                 // for display in summary line

  // Evidence (present when hasEvidence is true)
  evidence?: {
    filename: string                  // "PROV-J8847-7b2fa3e1.pdf"
    hash: string                      // SHA-256
    block: string                     // on-chain block ref
    provider: string                  // evidence provider
    uri: string                       // reference URI
    access: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC'
    retention: string                 // retention policy text
  }

  // Evaluations
  evaluations: Evaluation[]

  // SDAs
  sdas: SDA[]

  // Layout (for NetGraph)
  x: number
  y: number

  // Backward compat (v2 canvas reads these)
  claimCount: number                  // health.ok + health.bad (for node card minibar text)
}
```

### Child Node Shape (in `children[]`)

Children are full objects matching this subset — used by the Children tab cards:

```typescript
interface ChildNode {
  name: string
  category: string
  pin: string
  owner: string                       // may differ from parent (cascade case)
  ownerDot: string
  parentOwner: string                 // parent's owner — used to highlight different owners
  health: { ok: number, bad: number }
  lastEval: string | null             // date of most recent eval
  hasEvidence: boolean
  childCount: number                  // 0 for leaf, >0 if this child has its own children
  // Cascade indicators
  isCascade?: boolean
  cascadeVia?: string                 // "MicroCo (selective ← Murata Manufacturing)"
}
```

### Evaluation

```typescript
interface Evaluation {
  id: string                          // "eval-037"
  org: string                         // evaluating organization
  orgDot: string                      // org's DOT
  date: string                        // ISO date
  requirements: string                // requirement set name
  status: 'completed' | 'superseded'
  creditsUsed: number
  reviewer: string
  reviewDate: string
  claims: Claim[]
}

interface Claim {
  requirement: string                 // what was checked
  output: string                      // the result value
  type: 'direct' | 'inferred'
  status: 'verified' | 'contested'
  dispute?: {
    by: string
    date: string
    reason: string
  }
}
```

### SDA (Supply Chain Disclosure Agreement)

```typescript
interface SDA {
  id: string
  type: 'full' | 'selective' | 'proofonly' | 'cascade'
  party: string                       // counterparty name
  partyLabel?: string                 // optional grey suffix ("internal")
  partyDot: string
  created: string
  expires: string | null
  pins: string[]                      // PINs covered by this SDA
  isOwnerSDA?: boolean
  // Proof-only specific:
  poeResult?: string
  evalRef?: string
  // Cascade specific:
  chain?: CascadeHop[]
}

interface CascadeHop {
  from: string                        // granting party name
  to: string                          // receiving party name
  sdaType: string                     // "Selective", "Cascade (Selective)", etc.
  status: string                      // "Active · expires 2026-08-15"
}
```

**Cascade constraint rule:** each hop can maintain or downgrade permission, never upgrade. If Murata grants MicroCo Selective, MicroCo can cascade as Selective or Proof-only to GovCo, but never Full.

---

## SDA Types

| Type | Badge Style | Color | Description |
|------|-------------|-------|-------------|
| Full | Solid border | `#7e8ef8` (indigo) | Extraction + Inference — evaluator has full access |
| Selective | Dashed border | `#fbbf24` (amber) | Inference only — no raw data extraction |
| Proof-only | Dotted border | `#36d49a` (green) | POE pass/fail only — no evaluator access |
| Cascade | Dashed border | `#a78bfa` (purple) | Access passed through an intermediary |

Each badge has a tooltip explaining its permission level. The Permission row inside each SDA card also has a tooltip (slightly different wording).

---

## Component Hierarchy

```
PanelShell
├── Header
│   ├── Category icon + label + paperclip (if hasEvidence) + close button
│   ├── Name + PIN badge (click-to-copy)
│   ├── Owner + DOT badge (click-to-copy)
│   ├── HealthBar (node's OWN health only — not children)
│   └── Summary line
├── Tabs (full-width pillbox, counts in labels)
├── Content (scrollable, border-top separator)
│   ├── EvaluationsTab (if evidence or evaluations exist)
│   │   ├── 📎 EVIDENCE section header
│   │   ├── EvidenceBlock (collapsible, collapsed default, unfurl animation)
│   │   ├── EVALUATIONS header + count + ⊞/⊟ expand/collapse all + ✦ Run Evaluation
│   │   └── EvalPanel[] (each collapsible, all collapsed default)
│   │       ├── Header: org, date, stat pills (✓N ✕N), chevron
│   │       ├── Eval ID, metadata rows (Party DOT w/ tooltip, Requirements, Reviewer, Credits)
│   │       └── RESULTS row (count, chevron, ⛶ Expand, ↓ Download)
│   │           └── ClaimsTable (sticky header, scrollable at 8.5 rows, keyboard nav)
│   ├── ChildrenTab (if children exist)
│   │   ├── Description + ⊞/⊟ expand/collapse all
│   │   ├── ChildHealthBar (segmented by child, tooltips per segment)
│   │   └── Child cards (collapsible)
│   │       ├── Header: icon, name, 📎 (if evidence), 🔗 (if cascade), stat pills, chevron
│   │       └── Body: PIN, Owner + DOT (stacked, amber if different owner), Last eval, Claims, Children count, Via (cascade), "View Asset Details →"
│   └── DisclosuresTab (always present if sdas exist)
│       ├── Description + ⊞/⊟ expand/collapse all
│       ├── SDA cards (collapsible)
│       │   ├── Header: SDABadge + party name + optional label, chevron
│       │   ├── Body: Party DOT (w/ tooltip), Created, Expires, Permission (w/ tooltip), PINs
│       │   ├── Cascade chain visualization (purple, numbered hops) — if type === 'cascade'
│       │   └── Revoke SDA → confirm/cancel + contextual warning
│       └── ⇋ Disclose this Asset button
└── Footer (persistent, 3 buttons stretched full-width)
    ├── + Connect an Asset
    ├── ⊞ Expand Stack / ⊟ Return to Parent / ⊟ Surface
    └── ⛓ View Chain
```

---

## Key Interactions

### Paperclip → Evidence

Clicking the paperclip icon in the header: (1) switches to Evaluations tab, (2) waits two animation frames (double `requestAnimationFrame`), (3) opens the EvidenceBlock with a 250ms unfurl animation (`max-height` transition). The double-rAF ensures the tab is visible before the transition starts — without it, switching tabs and opening evidence in the same render skips the animation.

### Claims Table

Three columns: Requirement (width: `LW` = 170px) | Claim (flex: 1) | Result (width: 86px). Separated by `borderLeft` on each cell. Header row uses `alignItems: stretch` so column dividers run the full 34px header height.

- **Truncation**: both Requirement and Claim cells detect overflow via `scrollWidth > clientWidth` and show full text in tooltip on hover
- **Keyboard nav**: table has `tabIndex={0}`. Arrow Up/Down moves focus. Home/End jumps. Focused row gets `cardAlt` background + subtle outline, auto-scrolls into view.
- **Sticky header**: pins via `position: sticky; top: 0` when body scrolls. Body becomes scrollable at `MAX_ROWS` = 8.5 rows (`maxHeight: ROW_H * MAX_ROWS`).
- **Actions**: ⛶ Expand (modal, demo) and ↓ Download (CSV, demo) on the RESULTS title row

### Health Bars

- **Header HealthBar**: shows node's OWN health only (`health.ok` / `health.bad`). Empty bar (grey, no segments) if no evaluations — signals "not yet evaluated."
- **ChildHealthBar** (Children tab): segmented bar where each child's portion is proportional to its claim count. 6px gap between children, 2px gap between green/red within a segment, `borderRadius: 3` on all sides. Tooltip per segment shows child name + verified/failed counts. Uses `BarSeg` component with ref-based tooltips (not `<Tip>` wrapper, which breaks flex sizing).

### Cascade Chain Visualization

In the Disclosures tab, any SDA with `type: 'cascade'` and a `chain[]` array renders a purple-tinted box (`color-mix(in srgb, purple 4%, transparent)`) below the metadata rows. Each hop is a numbered circle (1, 2, 3...) with `{from} → {to}`, SDA type, and status. Reads top-to-bottom from original owner to current viewer. Supports any number of hops.

### Revoke Warnings (per SDA type)

| Type | Warning |
|------|---------|
| Full | Ownership disclosure — revoking archives asset, terminates all downstream disclosures |
| Selective | Revoking removes inference access, existing eval results marked as revoked |
| Proof-only | Revoking invalidates POE, badge marked as revoked |
| Cascade | Revoking removes cascaded access. If upstream SDA is also revoked, cascade auto-invalidates — two points of failure. |

### State Management

All tabs are **always-mounted** using `display:none/block` — not conditional rendering. This preserves open/closed state when switching tabs.

Eval panel state, evidence open state, and claims open state are all **lifted to the parent panel component**:
- `eo` — eval open states (object: index → boolean)
- `co` — claims open states (object: index → boolean)  
- `evOpen` — evidence block open (boolean)
- `expandAll()` opens all eval panels
- `collapseAll()` closes all eval panels and their results

Children tab and Disclosures tab manage their own expand/collapse state internally, with their own ⊞/⊟ buttons.

---

## Design Tokens

```javascript
const T = {
  bg:       "#090b10",   // page background
  surface:  "#0d1017",   // panel background
  card:     "#111620",   // card backgrounds
  cardAlt:  "#151b28",   // active/hover card state
  border:   "#1a2030",   // primary borders
  borderMd: "#232e40",   // column dividers in headers
  borderLt: "#2e3a4e",   // hover borders
  text:     "#e3e6ec",   // primary text
  textSec:  "#b4b9c8",   // secondary text
  textMut:  "#8892a8",   // muted (labels)
  textDim:  "#5e6880",   // dim (metadata)
  textFaint:"#343e52",   // faintest (disabled)
  accent:   "#7e8ef8",   // primary accent
  green:    "#36d49a",   // verified
  red:      "#f87171",   // failed/contested
  amber:    "#fbbf24",   // selective SDA, warnings, different-owner highlight
  blue:     "#60a5fa",   // product category
  cyan:     "#22d3ee",   // person category
  purple:   "#a78bfa",   // cascade SDA, chain indicators
  indigo:   "#818cf8",   // party category
};
```

Typography: `"DM Sans"` (body) + `"JetBrains Mono"` (data, badges, mono labels). Both already loaded by the V2 prototype via `index.css` (`--font-display` and `--font-mono`).

### Layout Constants

```javascript
const PW = 480;      // panel width
const G  = 18;       // gutter (content horizontal padding)
const LW = 170;      // label/requirement column width (shared between GR rows and ClaimsTable)
const BH = 34;       // button height
const ROW_H = 36;    // claims table row height
const MAX_ROWS = 8.5; // visible claims rows before scroll kicks in
```

`LW` is the single source of truth for column alignment. Both the `GR` metadata rows (eval/SDA details) and the ClaimsTable `Requirement` column use `width: LW`, so the dividing line aligns vertically across sections.

---

## Demo Examples in Reference

The reference file has four panel examples across two verticals:

### FastCo · Healthcare

| Toggle | Node | Tabs | Key Features |
|---|---|---|---|
| Evidence Node | US Passport | Evaluations · 4, Disclosures · 4 | Leaf node. All 4 SDA types (Full, Selective, Proof-only, Cascade to ClearCheck Credentialing via 2-hop chain from US Dept. of State). Superseded eval. Contested healthcare licensure claim. |
| Hybrid Node | Jane Torres | Evaluations · 1, Children · 3, Disclosures · 4 | Own evidence (employment record from FastCo HR) + 3 children. Engineering License child is cascaded from Oregon State Board of Nursing via 3-hop chain through NurseCredential Services. ChildHealthBar shows split proportions. Owner row stacks name + DOT. |

### GovCo · Supply Chain

| Toggle | Node | Tabs | Key Features |
|---|---|---|---|
| Hybrid Node | Power Regulation Module | Evaluations · 2, Children · 3, Disclosures · 2 | MicroCo-owned assembly. Own evidence (assembly test report) + 3 sub-components. Ceramic Capacitor Array child is cascade from Murata (amber owner highlight). PCB Substrate child has `childCount: 2` indicating deeper sub-assets. |
| Cascaded Node | Ceramic Capacitor Array | Evaluations · 2, Disclosures · 1 | Owned by Murata Manufacturing (header shows Murata as owner). Accessed by GovCo via cascade through MicroCo. 2-hop chain visualization. Contested tin whisker claim referencing GEIA-STD-0005-2. |

---

## Wiring to V2 Prototype

### Current Prototype State

- `V2Canvas.jsx` — WebGL NetGraph with Three.js, SDA-typed edge rendering, pan/zoom, layer dive transitions
- `AssetNode.jsx` — node card component, reads `node.category`, `node.name`, `node.owner`, `node.children`, `node.health`, `node.claimCount`
- `V2App.jsx` — app shell with top bar, theme toggle, canvas area, footer
- `demoData.js` — current demo data with `{ nodes, edges, nodeMap }` export
- `V2SubgraphModal.jsx` — stub modal (header + placeholder body)
- `tokens.js` — design tokens (V1 tier-type system, personas, verticals)
- `index.css` — CSS variables for dark/light themes, View Transition animations

No Detail Panel exists in V2 yet. No sidebar. No role switching.

### Integration Steps

1. **Panel container**: Add a 480px right panel to the layout in `V2App.jsx`. The NetGraph canvas resizes to `calc(100vw - 480px)` when a node is selected. Panel slides in on selection, out on close or empty-canvas click.

2. **Tab decision logic** (no type branching):
   ```javascript
   const tabs = []
   if (node.evidence || node.evaluations?.length)
     tabs.push({ id: 'evaluations', label: `Evaluations · ${node.evaluations?.length || 0}` })
   if (node.children?.length)
     tabs.push({ id: 'children', label: `Children · ${node.children.length}` })
   if (node.sdas?.length)
     tabs.push({ id: 'disclosures', label: `Disclosures · ${node.sdas.length}` })
   ```

3. **Health computation**:
   ```javascript
   function computeHealth(evaluations) {
     let ok = 0, bad = 0
     for (const ev of evaluations) {
       if (ev.status === 'superseded') continue
       for (const c of ev.claims) {
         if (c.status === 'verified') ok++
         else bad++
       }
     }
     return { ok, bad }
   }
   // node.health = own evals only
   // node.childHealth = sum of children's health
   // node.totalHealth = health + childHealth
   // node.claimCount = node.health.ok + node.health.bad (backward compat for AssetNode)
   ```

4. **Decompose into files**:
   ```
   components/DetailPanel/
   ├── index.jsx               // reads node fields, decides tabs, renders Shell
   ├── PanelShell.jsx          // shared layout: header, tabs, footer
   ├── EvaluationsTab.jsx      // evidence block + eval panels
   ├── ChildrenTab.jsx         // child cards + ChildHealthBar
   ├── DisclosuresTab.jsx      // SDA cards + cascade chain + revoke flow
   ├── ClaimsTable.jsx         // results table with keyboard nav
   ├── EvalPanel.jsx           // single evaluation card
   ├── EvidenceBlock.jsx       // collapsible evidence metadata (controlled)
   ├── shared/
   │   ├── CopyBadge.jsx
   │   ├── SDABadge.jsx
   │   ├── HealthBar.jsx
   │   ├── ChildHealthBar.jsx
   │   ├── GridRow.jsx         // GR component with optional labelTip
   │   ├── StatPills.jsx       // SC / SX
   │   └── Tooltip.jsx         // portal-based TT + Tip
   └── constants.js            // T, SDA, CAT, LW, BH, ROW_H, MAX_ROWS
   ```

5. **Edge types for NetGraph**: `V2Canvas.jsx` reads `edge.sdaType`. Four types:
   - `full` — solid, `#6b8aff`
   - `selective` — dashed, `#f59e0b`
   - `proofonly` — dotted, `#22c55e` (rename existing `derivative` key)
   - `cascade` — dashed, `#a78bfa` (replace existing `cascade` color if different)
   
   Remove unused edge types. Legend should show: Full Disclosure, Selective Disclosure, Proof-only Disclosure, Cascade Disclosure.

6. **Footer actions** — wire to:
   - `+ Connect an Asset` → ConnectAssetModal (not yet built)
   - `⊞ Expand Stack` / `⊟ Return to Parent` → navigation event to NetGraph
   - `⛓ View Chain` → SubchainModal
   - `✦ Run Evaluation` → EvaluationModal (not yet built)
   - `⇋ Disclose this Asset` → DisclosureModal (not yet built)
   - `Revoke SDA` → confirm flow already built in reference

7. **Results table actions**:
   - ⛶ Expand → full-screen modal with wider ClaimsTable
   - ↓ Download → serialize claims to CSV, trigger download

---

## Not Yet Built

Referenced in UI but need future implementation:

- Connect an Asset modal
- Evaluation modal (requirements library, credit cost, run)
- Disclosure request flow (paste PINs, select permission level)
- Results expand modal (full-screen claims table)
- CSV download
- Pin to Surface action on node hover (NetGraph)
- Subchain Modal content (stub exists, body is placeholder)
- Mission/Program grouping (named PIN collections with aggregate health)
- Node card PIN badge (truncated, click-to-copy)
- Node card minibar text update ("N verified · N failed" replacing "N claims")
