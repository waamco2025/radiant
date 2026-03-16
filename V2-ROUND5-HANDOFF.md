# Radiant V2 — Round 5 Handoff

**Date:** March 15, 2026
**Session:** Batches 5.8–8.4
**Next:** Round 5 — Edge fixes, provisional cards, disclosure animation, Evaluation Modal

---

## Session Summary

This session completed 20+ batches covering: evidence-as-nodes restructure, flat parent layer architecture, dataset cleanup for realistic two-party demo, disclosure flow redesign (owner decides type, no counter), ownership gating, terminology update (PEP-aware), Detail Panel fixes, and disclosure persistence (accepting a request creates SDAs, nodes, and edges dynamically).

---

## Current State

### What Works
- WebGL NetGraph with two roles: Bob@GovCo (buyer, 6 nodes) and Alice@MicroCo (seller, 8 nodes)
- Flat parent layer: all assets as peers, supply chain = horizontal edges
- Child layer: evidence nodes only (Tier 1 artifacts), accessible via dive
- Detail Panel: conditional tabs (Evaluations gated on ownership/content), Disclosures tab with asset names + PINs
- 3 disclosure modal flows: Publish (Flow A), Connect Asset (Flow B buyer, no level picker), Respond (Flow B seller, owner chooses type)
- Cascade disclosure management (Entry A in response modal, Entry B from Disclosures tab)
- Notification inbox with persistence (onClose vs onComplete)
- Ownership gating: Disclose + Connect buttons hidden on non-owned nodes
- Evidence field visibility gated by isOwner
- Disclosure persistence: accepting a request creates SDAs on both nodes + edge + node if needed
- Dot-level LOD with edge tooltips
- Stack spread on nodes with children + dive hint tooltip on selected nodes
- "View Asset Details" in Children tab wired (dives + selects child)
- Child-layer dot grid alignment fixed (buildGrid called after transition)

### Known Bugs — Priority for Round 5

**1. Edges disappear on role switch to Alice (HIGH)**
Edges render correctly for Bob on initial load, but switching to Alice shows no edges until zoom changes. The `dirtyRef.current = true` fix was applied but didn't fully resolve it. Likely a timing issue — edges are built before the renderer is ready after role switch, or the edge rebuild effect fires before the new layer data is fully committed.

Debug approach: add `console.log` in the edge rebuild `useEffect` to verify it fires and that `currentLayer.edges.length > 0`. Check if `edgeGroupRef.current` exists at that point. May need a `requestAnimationFrame` wrapper.

**2. Edge endpoints emerge from wrong positions on cards (HIGH)**
The simple horizontal offset (`CARD_W/2`) doesn't account for vertical distance between nodes. Edges between nodes at different y-positions (e.g. PCB Substrate at y=300 and Avionics at y=-200) need proper angle-based endpoint calculation.

The fix attempted a direction-based offset but it's producing endpoints above/below card centers instead of at the card edge intersection point.

Correct approach: ray-box intersection. Cast a ray from node A center toward node B center. Find where it exits node A's bounding box (CARD_W × CARD_H). That's the start point. Same for node B (ray from B toward A, exit point is the end). This naturally handles any angle:

```javascript
function edgeEndpoint(fromX, fromY, toX, toY, halfW, halfH) {
  const dx = toX - fromX
  const dy = toY - fromY
  if (dx === 0 && dy === 0) return { x: fromX, y: fromY }
  
  // Scale factor to reach the box edge
  const sx = halfW / Math.abs(dx || 0.001)
  const sy = halfH / Math.abs(dy || 0.001)
  const s = Math.min(sx, sy)
  
  return { x: fromX + dx * s, y: fromY + dy * s }
}
```

**Also:** edges should only use card-edge offsets at card-level zoom. At dot LOD, edges should connect center-to-center (dots are small enough that offsets look wrong). Gate the offset on `!isLOD` or on a zoom threshold.

**3. Edges disappear after completing disclosure flow (MEDIUM)**
After accepting PCB Substrate disclosure, all edges vanish. The disclosure completion triggers state updates (addedSDAs, addedEdges, dismissedReqs) which cause re-renders that may clear the edge group. The edge rebuild effect should catch this, but the timing may be off.

---

## Architecture Reference

### Two-Layer Graph
- Parent layer: all orgs + assets as peers, horizontal edges
- Child layer: evidence (Tier 1) → PEP/Parse (Tier 2, planned) → Evaluation (Tier 3, planned)
- Dive into a node shows its artifact children only

### Identity Model
- PIN: immutable identifier for every entity
- DOT: transferable ownership title (hidden in prototype via CSS)
- Actor vs Object: DLT-level distinction

### Disclosure Model
- Requestor cannot dictate type — owner decides Full/Selective/Proof-only
- Anti-spam: all disclosures invitation-driven
- Cascade: intermediary forwards access, capped at their own level

### Protocol Waterfall
Register (DPP) → Prepare (PEP) → Share (SDP) → Evaluate (REP)

### Dynamic Data
V2App maintains three mutation arrays that merge into the static role data:
- `addedNodes[]` — nodes created dynamically (e.g. when a disclosure reveals a new party's asset)
- `addedSDAs{}` — `{ [nodeId]: SDA[] }` merged into matching nodes
- `addedEdges[]` — edges created dynamically

All reset on role switch. Merged via `useMemo` before passing to V2Canvas.

---

## Datasets

### Bob@GovCo (buyer, 6 static nodes)
| Node | Owner | Children | Disclosure SDAs |
|------|-------|----------|----------------|
| GovCo | — | — | internal |
| Sentinel-4 Program | GovCo | — | internal |
| Propulsion System | GovCo | — | internal |
| Avionics Module | GovCo | — | internal + selective·MicroCo·PowerReg + full·MicroCo·VRegIC |
| Power Regulation Module | MicroCo | 1 evidence | selective·GovCo·Avionics |
| Voltage Regulator IC | MicroCo | 1 evidence | full·GovCo·Avionics |

### Alice@MicroCo (seller, 8 static nodes)
| Node | Owner | Children | Disclosure SDAs |
|------|-------|----------|----------------|
| MicroCo | — | — | internal |
| Avionics Module | GovCo | — | selective·MicroCo·PowerReg + full·MicroCo·VRegIC |
| Power Regulation Module | MicroCo | 1 evidence | selective·GovCo·Avionics + internal |
| Voltage Regulator IC | MicroCo | 1 evidence | full·GovCo·Avionics + internal |
| PCB Substrate | MicroCo | — | internal |
| EMI Shield Assembly | MicroCo | — | internal |
| Thermal Interface Pad | MicroCo | — | internal |
| Connector Assembly | MicroCo | — | internal |

**Pending request:** GovCo → PCB Substrate (with `connectTo: { id: 'avionics', name: 'Avionics Module' }`)

### Demo Product Assignments
| Product | Demo Purpose |
|---------|-------------|
| PCB Substrate | Bob requests via PIN (pending request exists) |
| EMI Shield Assembly | Alice posts to public directory, Bob discovers it |
| Thermal Interface Pad | Alice creates during Register Asset demo |
| Connector Assembly | Already in public directory, Bob finds and requests |

---

## Backlog — Priority Order

### Immediate (Round 5)
1. **Edge rendering fixes** — role-switch visibility, edge-endpoint geometry (ray-box intersection), post-disclosure edge rebuild
2. **Provisional cards** — when Bob sends a Connect Asset request, a dashed-border provisional card appears immediately on his network. Muted colors, "PROVISIONAL · Awaiting response" badge. Disappears on rejection, populates on acceptance.
3. **Disclosure acceptance animation** — modal fades → canvas dims → new node draws in → camera pans to source → edge line draws following camera → settle at fit view → overlay fades

### Near-term
4. **Evaluation Modal** — port v1's 5-phase flow (Setup → Processing → Results → Review → Complete) to v2 node schema + PEP model
5. **Register Asset modal** — create shell product + attach evidence via local file picker
6. **PEP 0.5** — evidence → tokenized key-value pairs, child-layer Tier 2 nodes
7. **Selective disclosure field-level redaction** — per-field, per-party, PEP output level

### Later
8. Public Asset Directory
9. Sidebar (aggregate metrics, search, filtering, node tree)
10. Programs/Missions
11. Owned vs non-owned card visual distinction
12. Double-click childless node at dot LOD — hover card persists on subchain modal
13. "View Asset Details" link pan-to wiring (currently dives but doesn't pan)
14. Minibar achievement notification (Nintendo Switch style)

### Visual Polish
- Stack spread fine-tuning
- Edge line endpoints at child layer
- Text contrast, font sizes, copy accuracy
- SVG pin icon refinement
- "Run an evaluation →" link wiring in disabled Proof-only card

---

## Key Files

### Data + App Shell
| File | Purpose |
|------|---------|
| `src/v2/v2Data.js` | Role-aware data, makeNode, makeEvidenceNode, shared SDAs |
| `src/v2/V2App.jsx` | Root state, dynamic data merging (addedNodes/SDAs/edges), modal wiring |
| `src/v2/V2Canvas.jsx` | WebGL canvas, edges, grid, dive/surface, edge hover detection |
| `src/v2/AssetNode.jsx` | Node card, StackPeeks, StackBadge, ActionBar, dive hint tooltip |

### Detail Panel
| File | Purpose |
|------|---------|
| `src/components/DetailPanel/index.jsx` | Tab logic (conditional mount), prop threading |
| `src/components/DetailPanel/PanelShell.jsx` | Header, footer (owner-gated buttons) |
| `src/components/DetailPanel/EvaluationsTab.jsx` | Eval panels + evidence block |
| `src/components/DetailPanel/EvalPanel.jsx` | Individual eval card (Party DOT removed) |
| `src/components/DetailPanel/DisclosuresTab.jsx` | SDA cards with assetName + assetPin, cascade management |
| `src/components/DetailPanel/ChildrenTab.jsx` | Child cards with "View Asset Details" wiring |
| `src/components/DetailPanel/constants.js` | SDA_CONFIG with PEP-aware terminology |

### Modals
| File | Purpose |
|------|---------|
| `src/components/modals/RequestDisclosureModal.jsx` | Connect Asset (no level picker) |
| `src/components/modals/DisclosureResponseModal.jsx` | Accept/Decline, owner chooses type, passes to onComplete |
| `src/components/modals/CascadeModal.jsx` | Manage cascading disclosures (reads upstreamAssets) |
| `src/components/modals/PublishModal.jsx` | Publish to directory |

---

## Documentation Files
- `CLAUDE.md` — project briefing for Claude Code (updated through Batch 7.8, needs 8.x additions)
- `V2-SESSION-HANDOFF.md` — this file
- `data-model-corrected.html` — Radiant Data Model reference (all entity/relationship Q&A)
- `trust-completeness.html` — Trust Completeness thesis + minibar dynamics

**Update CLAUDE.md before starting Round 5** with: dynamic data merging (addedNodes/SDAs/edges), disclosure persistence, conditional tab mounting, assetName/assetPin on SDAs, connectTo on pending requests, edge endpoint geometry TODO.
