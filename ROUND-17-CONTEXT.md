# Round 17 — Context

This is the canonical entry doc for Round 17. It identifies the phases planned, the files to attach per phase, the workflow conventions, and the project state as of Round 16 closeout.

---

## Round 17 scope

Round 17 has four planned phases, executed in order. Each is a single Claude Code prompt = one phase = one commit on `main`.

### 1. Phase 16.2 — Directory Layer seed expansion

- Add ~12 mock supplier Actors with varying cluster sizes (small 3-Claim catalogs through large 20+ Claim catalogs).
- Each mock Actor gets a `makeActor(...)` entry + seeded Claims + seeded DAs (mix of public, umbrella-to-Bob, and supplier-internal patterns).
- Validate spatial layout + 12-cell inter-cluster buffer + Three.js InstancedMesh at scale (~150+ dots across all clusters).
- Validate per-role view derivation under more clusters than the current 3-Actor seed exercises.
- **Likely surface:** the deferred #196 (force-directed cluster layout) becomes necessary if the current naive deterministic-bbox-overlap-check placement breaks down with many clusters; if so, ship #196 inline as part of 16.2 or file a 16.2.1 follow-up.
- **No new architectural primitives** — purely a seed-data + layout-scaling phase.

### 2. Phase 17.0 — RFP factory + buyer post flow

- Promote the skeletal `makeRfp` factory (Phase 16.0) to a full artifact with lifecycle states (`open`, `closed`, plus probably `withdrawn`).
- Build `PostRFPModal` — the buyer flow to create new RFPs. Fields: title, description, required Requirements Set(s), submission deadline, target supplier type (optional).
- RFP cyan hollow-circle dots become clickable, opening an **RFP Detail Panel** that shows: title, description, owner, required RS, open responses (none yet in 17.0), deadline.
- The pre-seeded "Sentinel-4 RF Module Compliance" RFP from Phase 16.0 becomes functional — clicking it opens the new Detail Panel.
- RFP Detail Panel mounts from the Directory Layer using the same pattern as Claim Detail Panels (`v22DirectorySelectedRfp` state).

### 3. Phase 17.1 — Supplier discovery + self-evaluation response flow

- Suppliers (Alice, Dave) browse RFPs on the Directory. RFP dots on Directory clickable for all actors (not just owner).
- New `makeRfpResponse` factory — links a Claim to an RFP it responds to. Carries self-evaluation results (the supplier runs their own Eval against the RFP's required RS).
- Supplier flow: pick matching Claim → run self-evaluation → submit response to RFP owner.
- New modal: `SubmitRfpResponseModal` (or similar) — wraps the Run Evaluation flow against the RFP's required RS, with the resulting Eval Result auto-attached as the response.
- Response notification fires on the RFP owner's inbox.

### 4. Phase 17.2 — Buyer review surface + initiate formal Evaluation

- Buyer (Bob) sees responses to his RFP via the RFP Detail Panel — list of responses with supplier name + summary metrics (SAT/UNSAT/MISSING counts on the supplier's self-eval).
- Review surface (likely a dedicated modal or expanded Detail Panel section) for side-by-side comparison of responses.
- Buyer initiates a formal Evaluation Agreement against a chosen response — the supplier's self-evaluation surfaces as the prior result; Bob's formal eval against the same RS becomes the binding evaluation.
- Composes with the existing Phase 11C EA-request flow + Phase 13 PoE finalization pattern.

After Round 17: Detail Panel cleanup (#58 / #104 / #116 / #161 / #180) → Cascading Disclosures (#26) → Netgraph cleanup (#4 / #130) → Search / aggregate (#27) → Network Event Log (#30).

---

## Round 16 recap (carried forward)

Round 16 ran ten sub-phases (16.0, 16.0.1, 16.0.2, 16.0.3, 16.1.0, 16.1.1, 16.1.2, 16.1.3, 16.1.4, 16.1.5) between 2026-05-08 and 2026-05-10. The scope was the Directory Layer end-to-end: started from Phase 7/11A/11B placeholder scaffolding (mock supplier clusters, ChipCo standalone cluster-click hit-area, cluster-click → materialized Claim card flow); ended at a Three.js-rendered, pan-zoom-capable, disclosure-type-coloured Directory with stable lifecycle and clickable dots.

Key architectural shifts: corner card removed (16.1.2) and user's own representation became a regular cluster anchored at canvas-horizontal-center + bottom-third vertically; rendering migrated HTML/CSS → Three.js InstancedMesh (16.1.0); dot colors became disclosure-type-based not visibility-scope-based (16.1.3); RFPs migrated filled green dot → cyan hollow circle (16.1.3); scene lifecycle stabilized via `shouldMountScene = phase !== 'closed'` boolean dep (16.1.4); InstancedMesh `frustumCulled = false` + `boundingSphere = unbounded` defensive setting required to avoid renderer/raycast bounding-sphere rejection at high zoom (16.1.5). Closed #43 + #45; filed deferred #193 / #194 / #195 / #196.

See `CLAUDE-phase-log.md` Round 16 entries + `architecture-spec.md` §8 + §8.5 for full detail.

---

## Per-phase load-in lists

Files to attach to the Project (or have ready for Claude Code) at the start of each phase prompt. These are the FOCUS files for the phase — Claude Code can read other files in-session as needed.

### Phase 16.2 — Seed expansion

- `src/v2/v2_2Data.js` (primary — adding mock Actors + their Claims + DAs)
- `src/v2/DirectoryLayer.jsx` (verify layout handles increased dot count + 12-cell buffer)
- `architecture-spec.md` §8 (reference for current visual model + per-role view rules)
- Optional: `src/v2/V2App.jsx` if any role-switching or initial state changes are needed

### Phase 17.0 — RFP factory + post flow

- `src/v2/v2_2Data.js` (RFP factory promotion + seed; lifecycle states)
- `src/v2/DirectoryLayer.jsx` (RFP click handler + onRfpDotClick prop wiring)
- `src/v2/V2App.jsx` (PostRFPModal mount + `v22DirectorySelectedRfp` state)
- **New file:** `src/components/modals/PostRFPModal.jsx` (to be created)
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` (new RFP Detail Panel rendering — likely `V22RfpPanel` component)
- Pattern reference: `src/components/DetailPanel/V22NodeDetailPanel.jsx` `V22ClaimPanel` for shape

### Phase 17.1 — Supplier response flow

- `src/v2/v2_2Data.js` (`makeRfpResponse` factory; new artifact type)
- `src/v2/DirectoryLayer.jsx` (supplier RFP-browsing — RFP dots clickable for all actors)
- `src/v2/V2App.jsx` (response flow modal mount + notification fan-out)
- **New file:** `src/components/modals/SubmitRfpResponseModal.jsx` (to be created — wraps Run Evaluation flow)
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` (RFP Detail Panel evolves to show responses placeholder for own-RFPs)
- Pattern reference: `src/components/modals/V22RunEvaluationModal.jsx` (the eval flow this composes with)

### Phase 17.2 — Buyer review surface

- `src/v2/V2App.jsx` (buyer review surface + EA-from-response wiring)
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` (RFP Detail Panel populated with responses list + review surface)
- `src/v2/v2_2Data.js` (linking response → EA flow; potentially new edge type or `_originRfpResponseId` decoration on the EA)
- Pattern reference: `src/components/modals/EARequestModal.jsx` (the formal-EA-request flow this composes with)
- Pattern reference: existing Phase 13 PoE finalization for the binding-evaluation pattern

---

## Workflow conventions

- **Commit directly to `main`.** The worktree feature is currently disabled.
- **One Claude Code prompt = one phase = one commit.** Phase boundaries get commits without exception, even within a single Claude Code session.
- **`git rev-parse --abbrev-ref HEAD` must return `main`** before any code changes.
- **QA checklists target ~10 items (max 15).** Each item: specific narrow action → expected result. Always append a paste-and-fill summary at the end (so Andrew can paste results back).
- **Prompts should include "Please notify me when you're finished."**
- **Footer version constant rolls forward each forward-progress phase.** Backtrack-hotfix versions (inserted between existing Changelog entries) leave the footer unchanged.
- **Runtime verification is required** for any change touching a React component — start the Vite dev server, exercise the affected flow in a real browser, attach screenshots/probes. Build success alone is insufficient.
- **Canvas-click flows can't be exercised via scripted DOM events** (Three.js Raycaster doesn't respond to `dispatchEvent`). Mark canvas-click QA items as "code-verified-only" when full programmatic verification isn't possible, and rely on Andrew for manual mouse-interaction QA.

---

## Branch discipline

Before any code changes in a session:

```bash
git rev-parse --abbrev-ref HEAD   # must return: main
```

After commit:

```bash
git log --oneline -3              # verify the new commit is on main
```

If `HEAD` returns anything other than `main`, surface to Andrew before proceeding — do NOT silently switch branches or create new ones.

---

## Demo roles + architecture rules

**Demo actors:**

- **Bob Donloe** @ GovCo (buyer) — DOT: `DONLOE.BOB.J.1384297560`
- **Alice Nakamura** @ MicroCo (supplier)
- **Carol** @ AuditCo (auditor — no own publications)
- **Dave** @ ChipCo (supplier — 14-Claim catalog as of Phase 16.0)

Role switching via the user menu in the chrome bar; does not replay the boot animation.

**Architecture rules (foundational):**

1. **Assets are distinct from Claims.** Claims *reference* Assets; they don't *contain* them. Assets are first-class parent-layer nodes.
2. **Evaluation Agreements gate Claim visibility on the parent canvas.** A Disclosure Agreement alone grants visibility for Directory Layer / aggregated views; the paired Evaluation Agreement is what pulls another party's Claim onto your parent canvas.
3. **Single edge type — the Agreement Edge.** Ownership, Proof-of-Evaluation, and Public Directory relationships are all modeled as implicit Disclosure Agreements on the same edge primitive.
4. **Three Disclosure types: Full, Selective, Proof-only.** Wired end-to-end through Phase 11D — canvas, edges, Detail Panel, Expand modal, modals.

See `architecture-spec.md` §1–§4 for the canonical statement of these rules.

---

## Current state at Round 17 entry (as of Phase 16.1.5 ship — 2026-05-10)

**Directory Layer (Round 16 final state):**

- Three.js rendered (scene + Points grid + dot InstancedMesh + Actor square InstancedMesh + RFP InstancedMesh)
- Pan via drag (left mouse button + drag); zoom via wheel (zoom-around-cursor); zoom controls top-right (+/-/FIT/%)
- `MIN_ZOOM = 0.5`, `MAX_ZOOM = 4.0`, `INITIAL_ZOOM = 1.5`
- Hover behaviors: dot whitens + cluster brightens + tooltip card (HTML overlay) appears
- Click on Claim dot: tooltip pins + Detail Panel opens + camera animates to centre the dot with panel-aware offset
- Disclosure-type-based dot colors: full→indigo, selective→amber, proof-only→green
- Neutral grey L-shape umbrella borders (SVG overlay projected from world coords)
- RFP dots: cyan hollow circles (`THREE.Mesh` with `ShapeGeometry`, border scales with zoom). Non-functional placeholders in Round 16; activate in Phase 17.0.
- Actor squares: hollow indigo squares (`THREE.Mesh` with hollow `ShapeGeometry` InstancedMesh, border scales with zoom). Positional anchors only; not interactive.
- User's own cluster (when `isUserVisible === true`) anchored at canvas-horizontal-center + bottom-third on initial load. Anonymous actors (Carol) render no own cluster.
- 12-cell inter-cluster buffer; naive deterministic placement (force-directed deferred — #196).
- Scene lifecycle stable across phase transitions (16.1.4 fix). `InstancedMesh.frustumCulled = false` + `boundingSphere = unbounded` on every InstancedMesh (16.1.5 fix) — required to avoid Three.js's auto-cull + raycast pre-filter rejection at high zoom.

**Seed data (minimal — Phase 16.2 will expand):**

- Bob @ GovCo — sees Dave's full ChipCo catalog (14 Claims, mix of indigo/amber/green via mixed DA types) via the seeded umbrella DA + Alice's 3 publicly-disclosed Claims + his own pre-seeded "Sentinel-4 RF Module Compliance" RFP
- Alice @ MicroCo — sees her own 3 publics + Bob's RFP + nothing else (no umbrella access to anyone)
- Dave @ ChipCo — sees his own 14 Claims + Bob's RFP + nothing else
- Carol @ AuditCo — anonymous actor; sees only public Claims from MicroCo + ChipCo + Bob's RFP. No own cluster.

**Footer constant:** `v0.16.1.5` in `V2App.jsx` line ~7758 (`v0.16.1.5 · Changelog`).

**Recent commits (top of `git log --oneline`):**

- `a60c27b Phase 16.1.5 — Hotfix: frustum culling + raycast bounding-sphere fix — v0.16.1.5`
- `30bb69d Phase 16.1.4 — Hotfix: Directory layer dot rendering regression from 16.1.3 — v0.16.1.4`
- `091b059 Phase 16.1.3 — Directory Layer parent-parity fixes + color scheme — v0.16.1.3`

---

## Outstanding backlog snapshot

Open items in `polish-backlog.md` worth flagging at Round 17 start:

- **#193** — V2App.jsx file split (Babel 500KB warning; `V2App.jsx` is ~8500 lines). Effort M, low priority.
- **#194** — Path-c migration: legacy /public PDFs to branded generator output (4 legacy PDFs still in seed). Effort M, low priority.
- **#195** — Three.js edge migration for Directory Layer (currently HTML/SVG; defer until edges return to Directory in some future phase). Effort M, low priority.
- **#196** — Force-directed cluster layout for scale (deferred from 16.1.2; may surface as needed during Phase 16.2 seed expansion). Effort M.
- **#182** — Amend Claim to include a PoE as an Asset (deferred from Phase 14.2). Effort M.
- **#185** — Asset-intrinsic anchor mechanism (production complement to Phase 15.6 auto-fill). Effort L.
- **#186** — RS template canonicalization (promote RS from reference-only triple to canonical requirements list). Effort L.
- **#190** — Badges become netgraph nodes. Effort L; composes with #4 + #130 + #26.
- **#26** — Cascading Disclosures (deferred to Phase 13; still deferred). XL effort; gates child-layer burial rules (#4).
- **#58** — Export JSON (functional) + Export PDF (placeholder) on Detail Panels. Effort S.
- **#104** — Click-to-jump navigation from Detail Panel association lists. Effort M.
- **#116** — Agreements section on Eval Result + Parse Result Detail Panels. Effort S.
- **#161** — Notification deep-link with diff highlighting in Detail Panel. Effort M.
- **#180** — Substantive Output content for DA / EA / Parse Result expand modals. Effort M.
- **#4** — Layout density improvements + child-layer burial rules (gated by #26). Effort L.
- **#130** — Netgraph cleanup (sibling to #4).
- **#27** — Search + aggregate metrics/filters. Effort M.
- **#30** — Network Events Log (audit timeline). Effort L.
- **#47**, **#123** — AI Shopper buildout (composes with the RFP work from Round 17).

See `polish-backlog.md` for the full list with Status / Effort / Source / Composition fields.

---

**Round 17 starts when Andrew opens the first 16.2 prompt.** Each phase prompt should be self-contained per the workflow conventions above. This doc is the "what's the state of the world" pointer — re-read it at the start of any Round 17 session to ground context.
