# Radiant by Provenance — V2.1 Prototype

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V2.1 (Claims Migration)

V2.1 modifies `src/v2/` in place (project backup taken before migration). Entry point: `/v2.html`. V3 at `/v3.html` (archived — reference for UI patterns). V1 at `/index.html` (archived). Shared: `tokens.js`, `index.css`.

**All V2.1 work happens in `src/v2/` and `src/components/`. No new directory.**

**V2.1 applies the Claims model + V3 UI improvements to the V2 codebase.**

---

## Core Concept: RICE Framework

The platform implements the RICE trust system:

| Letter | Concept | Implementation |
|--------|---------|----------------|
| **R** | Requirements | Requirement sets — what buyers demand from sellers |
| **I** | Incentives | Premiums/penalties for compliance (future feature) |
| **C** | Claims | Primary canvas nodes — seller assertions backed by evidence |
| **E** | Evidence | Files in qualified storage, referenced by Claims |

---

## Data Model

### Claims (Primary Canvas Nodes)
- A Claim is an assertion about a product, component, or capability
- Every Claim references ≥1 evidence file (no empty Claims)
- Claims are what get disclosed to other parties
- Claims are what get evaluated
- Claims carry the minibar (health rollup from all evaluations)
- Claim artifact is JSON in owner's qualified storage with a URI and hash
- Previously called "assets" or "containers" in V2

### Evidence (File References)
- Raw files in qualified storage: PDFs, datasheets, certificates, sensor data, photos
- Referenced by Claims, never disclosed independently
- Appear as child nodes in the child layer
- Displayed by URI + file metadata (filename, size, MIME type)
- NOT labeled as "Evidence" in the UI — shown as artifact references
- NOT labeled with category types (PRODUCT, PROCESS, etc.)

### Process Outputs (Children of Claims)
- Parse results: JSON with extracted fields + confidence scores
- Evaluation results: JSON with requirement assessments (SAT/UNSAT/MISSING)
- Appear as child nodes in the child layer
- Minibar on parent Claim rolls up from evaluation outputs

### Disclosure Agreements (Edges)
- Every edge on the canvas = a disclosure agreement
- JSON in both parties' qualified storage
- Defines: type (Full/Selective/Proof-Only), scope, terms, parties
- Network topology IS the trust graph

---

## Node Cards — Uniform Styling

All node cards use identical styling. No category labels, no category icons, no schema-based color tints.

**Full card shows:** Name, owner org, minibar (if applicable)
**Mini card shows:** Name, minibar bar (if applicable)
**Dot shows:** Colored dot only

Do NOT add category badges (PRODUCT, PARSE, EVALUATION, etc.) to node cards. The node type is determined by artifact schema, visible in the Detail Panel — not on the card.

---

## Detail Panel — Two Tabs

### Tab 1: Overview
Single scrollable view with four sections:

**Identity**
- PIN (click-to-copy)
- DOT
- Owner

**Provenance**
- Derived from: org name for root Claims, parent name (clickable → navigates) for children
- Process: "Claim Created" for Claims, "parse" / "evaluate" for outputs
- Timestamp

**Connections**
- Clickable list of connected nodes with directional arrows (→ / ←) and SDA type badges
- Clicking navigates + pans to the connected node

**Children**
- Minimalist clickable list with schema type label
- Clicking navigates + pans to the child

### Tab 2: Artifact
- Artifact URI in mono box
- Schema-specific content:
  - **Claim:** Evidence refs list, claim metadata
  - **Parse output:** Template name + owner, Results table, field count
  - **Eval output:** Template name + owner, Results table, SAT/MISSING/UNSAT summary
  - **Disclosure:** Type badge, parties, scope, terms
  - **Raw file:** Filename, size, MIME type
- Expand button (outward-arrow icon, no label) → modal with Results tab + JSON tab
- Parse and eval Results tables use identical row component (ArtifactRow)
- Parse rows: field name + value + confidence badge
- Eval rows: requirement name + value + status badge (SAT/UNSAT/MISSING) + criterion

### Pending Nodes
- Show restricted "Awaiting Disclosure" view instead of tabs
- Request details: asset name, owner, status, requested via, date, requirement sets, message
- No action buttons, no minibar
- "Cancel Request" link

---

## Three Processes

| Process | Enacted By | Output |
|---------|-----------|--------|
| **Parse** | Any actor with access | Parse result (JSON → child of Claim) |
| **Evaluate** | Any actor with access | Evaluation result (JSON → child of Claim) |
| **Disclose** | Claim owner | Disclosure agreement (JSON → edge between Claims) |

### Process Flow Layout
- Parse + Evaluate: vertical — parent node (top) → process panel (center) → output node (bottom)
- Disclose: horizontal — source node (left) → process panel (center) → recipient node (right)
- Panel widens to 1100px for split-panel review stage (evidence viewer left, review form right)
- Other stages use 620px panel width

### Evaluation States
Four states: **SAT** (green) → **UNSAT** (red) → **MISSING** (grey) → **N/A** (muted)
- N/A excluded from output artifact (not counted in minibar)
- MISSING maps to sat:false in output (evidence gap, not satisfactory)
- Cycle via chevron buttons (◂ ▸) or clicking the status badge

---

## Disclosure Model

### Requester's Role (Connect Asset)
- Provides: PIN of target asset, evaluation intent (requirement sets), message
- Does NOT set disclosure type, scope, or terms

### Responder's Role (Accept/Decline)
- Sets: disclosure type (Full/Selective/Proof-Only), scope (which evidence, include derivatives), terms (duration, expiry)
- Acceptance transitions provisional node → active node (reveal animation)

### Three Types
| Type | Recipient Sees | Edge Style |
|------|---------------|------------|
| **Full** | All evidence + all derivatives | Solid |
| **Selective** | Selected fields only | Dashed |
| **Proof-Only** | SAT/UNSAT results only | Dotted |
| **Pending** | Nothing (awaiting response) | Grey dashed |

---

## Templates + Requirement Sets

### Enriched Schema
Every field/requirement stores:
- `id`, `name`, `instruction`, `format`, `category`, `required`
- Requirement sets additionally: `criterion` per requirement
- Templates additionally: `context` (document type hints)

### Library Modal
- Three tabs: Parse Templates, Requirement Sets, Published Standards
- Two-panel: item list (left) + detail/editor (right)
- Lineage grouping with version expansion
- Create, version, publish flows
- Published standards: read-only, from public directory (OSHA, NIST, ISO demo data)

---

## Health System

### Minibar
Three segments: green (SAT), grey (MISSING), red (UNSAT)
- Stats: `N · N` (two-state) or `N · N · N` (three-state when missing > 0)
- Rolls up from evaluation output children
- Eval output nodes show own health (from their artifact)
- Parent Claims show aggregated health from all eval children
- Perspective-dependent: Alice sees all parties' evals, Bob sees only his own

### _pending Flag
- Suppresses minibar display
- Suppresses child visibility (BFS doesn't traverse through pending nodes)
- Shows "PROVISIONAL" label on node card
- Shows restricted Detail Panel view

---

## Key Conventions

### No Category Labels
No PRODUCT, PROCESS, PLACE, PERSON, PARTY on node cards. No colored icons. All cards identical.

### No Emojis
All icons are SVG. Unicode symbols (✓, ×, ▸, ◂, ■, ◆, ◇) acceptable.

### CSS Variables
All components use CSS variables. Never hardcode colors. Use `color-mix()` for alpha.

### Timestamps
`date` + `dateTime` fields. Display: `YYYY-MM-DD · HH:MM UTC`.

### Escape Key
Input/textarea focused → blur only. Editor mode → exit to view. Nothing focused → close modal.

### Click-to-Copy
All PIN displays should support click-to-copy with visual feedback.

---

## Demo Users

- **Bob Donloe** @ GovCo (buyer) — DOT: DONLOE.BOB.J.1384297560
- **Alice Nakamura** @ MicroCo (supplier)
- Role switching via user menu (does NOT replay boot animation)

## Boot Sequence
CAC login → Prime Radiant 3D → golden ripple → network build animation
Session storage key: `radiant-v2-booted`
