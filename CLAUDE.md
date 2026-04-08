# Radiant by Provenance — V3 Prototype

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`. Run `npm run dev` for development, `npm run build` to verify. Build must pass clean before any batch is complete.

## Active Development: V3 Prototype

V3 lives at `/v3.html`. V2 at `/v2.html` (archived). V1 at `/index.html` (archived). Shared: `tokens.js`, `index.css`.

**All new work targets V3 unless explicitly stated.**

---

## Core Data Model — Actor + Object

The network has exactly two node types. No categories, no type flags, no ontological hierarchy.

### Actor
- A person, organization, or autonomous agent
- Has a DOT (transferable ownership title)
- Can enact processes on objects

### Object
- Anything — a label and a URI referencing an artifact in qualified storage
- Has a PIN (immutable identifier) and a DOT (ownership title)
- The platform does not know what the object represents
- All objects are structurally identical

### Artifacts
- Every object references exactly one artifact (a file in qualified storage)
- User-uploaded: PDFs, datasheets, certificates, any file
- Parse output: JSON with predictable schema (extracted fields)
- Evaluation output: JSON with predictable schema (requirements + SAT/UNSAT results)
- Disclosure agreement: JSON with terms, scope, parties
- Artifacts are hashed at registration; mismatch = invalidated
- The app interprets artifact content by schema recognition, not node type

### Identity
- **PIN** — Immutable object identifier. Full: `PIN-0x[64 hex chars]`. Displayed truncated.
- **DOT** — Transferable ownership title.

---

## Three Processes

| Process | Enacted By | On | Output |
|---------|-----------|-----|--------|
| **Parse** | Any actor with access | Any object | Parse result artifact (JSON → new object) |
| **Evaluate** | Any actor with access | Any object | Evaluation result artifact (JSON → new object) |
| **Disclose** | Object owner only | Any object to another actor | Disclosure agreement artifact (JSON → edge + new object) |

Any object can be parsed, evaluated, or disclosed. No process affinity enforcement. The platform allows nonsensical operations (evaluate an evaluation, parse a disclosure agreement).

---

## Relationships

### Edges = Disclosures
Every edge on the graph represents a disclosure agreement. Network topology IS the trust graph.

### Provenance (Structural Relationships)
Stored in artifact metadata, not in platform schema:
```json
{
  "provenance": {
    "derivedFrom": "PIN-0x...",
    "process": "parse | evaluate",
    "template": "...",
    "timestamp": "..."
  }
}
```

The app reads provenance to render parent-child trees. Supply chain structure is emergent from what users put in their artifacts.

### Children
An object's "children" = other objects whose artifacts reference it via provenance. Discovered by traversal, not by schema.

---

## Disclosure Model

### Three Types
| Type | Recipient Sees |
|------|---------------|
| **Full** | Object's artifact (raw file), all derived objects |
| **Selective** | Selected fields from parse output artifacts |
| **Proof-only** | SAT/UNSAT results from eval output artifacts only |

### Enforcement
Disclosure agreement artifact (JSON) specifies scope. App reads it to determine visibility. Both parties store the agreement artifact.

---

## Detail Panel

Two tabs for any object:
| Tab | Contents |
|-----|----------|
| **Children** | Objects referencing this one via provenance |
| **Disclosures** | Disclosure agreements involving this object |

Health minibars: derived by scanning children for evaluation-schema artifacts and aggregating SAT/UNSAT.

---

## Templates and Standards
- **Parse templates (PEP):** Define fields to extract. Per-actor, publishable.
- **Requirement sets (REP):** Define what to evaluate against. Per-actor, publishable.
- Both referenced by output artifacts but are not objects themselves.

---

## V3 Key Conventions

### No Emojis
All icons are SVG. No emoji characters. Unicode symbols (✓, ×, ⚠, ▸, ■, ◆, ◇, ◧) acceptable.

### CSS Variables
All components use CSS variables. Never hardcode colors. Use `color-mix()` for alpha.

### Timestamps
All objects use `date` + `dateTime` fields. Display: `YYYY-MM-DD · HH:MM UTC`.

### No Type Flags
No `isEvidence`, `isParse`, `isEvaluation`, `isClaim`. Objects are objects. Artifact schema determines rendering hints.

---

## Carried Forward from V2

### Reusable
- Three.js canvas (dot grid, edges, camera, LOD, pan/zoom, animations)
- Boot sequence (CAC login, golden ripple, network build)
- CSS theme system (dark/light)
- Modal shared components
- LOD system (full cards, mini cards, dots)
- Edge rendering (Line2, disclosure type styles)

### Rebuilt
- Node rendering → universal ObjectNode (artifact-aware)
- Detail panel → two tabs, content from artifact inspection
- Action system → three actions on any object
- Data layer → Actor + Object + Edge
- Health display → derived from artifact content
- Disclosure flow → artifact-aware
- Layout → provenance-based tree
