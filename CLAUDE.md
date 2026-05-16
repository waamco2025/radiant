# Radiant by Provenance — Repository Operating Manual

Vite + React 19 single-page app. No TypeScript. All styling is inline JSX + CSS variables from `index.css`.

For historical phase notes (every per-phase completion entry from Phase 1 through Phase 16.1.5), see [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md). For the architectural model, see [`architecture-spec.md`](./architecture-spec.md). For the open / partial / deferred work queue, see [`polish-backlog.md`](./polish-backlog.md). For the Round 17 entry doc (per-phase load-in lists, conventions, demo roles, current state), see [`ROUND-17-CONTEXT.md`](./ROUND-17-CONTEXT.md).

**Commands:**
- `npm run dev` — development server
- `npm run build` — must pass clean before shipping any change

---

## Architecture

The canonical source of truth for the platform architecture is `architecture-spec.md` in the repo root. Read it first; return to this file only for repo conventions and Round-level state.

The architecture rests on two foundational rules:

1. **Assets are distinct from Claims.** Claims *reference* Assets; they don't *contain* them. Assets are first-class parent-layer nodes.
2. **Evaluation Agreements gate Claim visibility.** A Disclosure Agreement alone grants visibility; the paired Evaluation Agreement is what pulls another party's Claim onto your canvas.

There is one edge type (the Agreement Edge). Ownership, Proof-of-Evaluation, and Public Directory relationships are all modeled as implicit Disclosure Agreements on the same edge primitive. See spec §4 for the rationale.

### File layout

- `src/v2/` — application code (V2App, V2Canvas, DirectoryLayer, boot screen, PrimeRadiant, data model).
- `src/v3/` — archived V3 reference (UI patterns only, not active).
- `src/components/modals/` — modal components.
- `src/components/DetailPanel/` — node + agreement detail panels.
- `src/v2/animations/` — animation primitives (`reveal.js`, `unravel.js`).
- `src/assets/`, `src/index.css` — shared styling + static assets.
- Entry points: `index.html` (primary, renamed from `v2.html` in Phase 8.5), `v3.html` (archived reference).

### Demo actors

- **Bob Donloe** @ GovCo (buyer) — DOT: `DONLOE.BOB.J.1384297560`
- **Alice Nakamura** @ MicroCo (supplier)
- **Carol** @ AuditCo (auditor)
- **Dave** @ ChipCo (supplier — added Phase 11A; switchable role since 11C)
- Role switching via user menu; does not replay boot animation.

### Boot sequence

CAC login → Prime Radiant 3D → golden ripple → network build animation. Session storage key: `radiant-v2-booted`.

---

## Working Conventions

### Code style

- CSS variables always; never hardcode colors. Use `color-mix()` for alpha blends.
- SVG icons only. Unicode symbols (✓, ×, ▸, ◂, ■, ◆, ◇) are acceptable. No emojis.
- Timestamps use `date` + `dateTime` fields. Display format: `YYYY-MM-DD · HH:MM UTC`.
- Escape key handling: input/textarea focused → blur only; editor mode → exit to view; nothing focused → close modal.
- Click-to-copy on all PIN displays with visual feedback.
- Type labels (`ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`) in mono font, informational only — see spec §3. State badges (`PROVISIONAL` / `DECLINED` / `SUPERSEDED` / `NEW`) render as separate inline badges.

### UX patterns

- **Accept/decline in modals, not notifications.** Party-to-party action responses (accept, decline, amend, etc.) open a modal for the user's decision. The notification is the *entry point* — it surfaces that an action is required — but the decision itself happens in a modal following the Disclosure Response pattern (`CombinedResponseModal`). Do not embed accept/decline buttons inline within notification rows. When declining, the decline-reason textarea lives inside the modal, not inline.
- **Picker defaults + scroll containers.** Multi-select artifact pickers that require at least one selection (Assets, Claims, Requirements Sets, Eval Results, etc.) default to zero selected — force the user to make an explicit choice. Empty-state help text uses amber italic inline styling and states the requirement ("Select at least one Asset to continue."). Picker lists render inside scroll containers (`max-height` + `overflow-y: auto`, typically 240–320px) so they scale to N>>10 without breaking the modal layout. Optional pickers (e.g., evaluation evidence, which can be run as self-attestation) may sensibly pre-select, but default to zero whenever selection is required.
- **Reciprocal notifications for all party-to-party actions.** Every party-to-party action that requires counterparty acknowledgment (accept, decline, cancel, amend, etc.) MUST fire reciprocal notifications on each state change. A transfer request creates `v22-transfer-request` on the recipient; acceptance creates `v22-transfer-accepted` on the sender; decline creates `v22-transfer-declined`; cancellation creates `v22-transfer-cancelled`. Both sides see every transition in their notification chrome. Missing reciprocal notifications are bugs regardless of whether the state change is visible elsewhere in the UI.

### Autonomous workflow

- Work at `xhigh` effort.
- Perform a structured review against the task's acceptance criteria before declaring a change complete.
- **Runtime verification is required** for any change that touches a React component. Start the Vite dev server (`npm run dev`), confirm the app loads with no console errors, and exercise the affected flow. Build success and pure-data sanity scripts are insufficient — they don't catch TDZ errors, hook-rule violations, or other init-time exceptions. If a real browser isn't reachable, fall back to a JSDOM render check.
- **Seed-data probe pattern:** verify the data layer first, then the UI walkthrough. Standalone component probes verify the component in isolation, NOT the integration. Phase 15.0.1's factory bug (`makeEvaluationResult` silently dropping `evidenceAnchors`) shipped because the component was probed in isolation, never via the actual Detail Panel → Expand → Output user flow. Phase 15.6's auto-fill verification used the seed-data probe pattern (direct JS exec inside the dev server confirming the data transformation) and caught issues before declaring complete. Probe the path the user will actually take.
- When you hit a genuine ambiguity (a contradiction in the spec, a missing piece of information required for a correct decision), **stop and surface it.** Do not guess.
- The V2Canvas 3D raycaster does not respond to DOM-dispatched events — scripted UI walkthroughs of canvas-click flows are not possible from the agent session. The Directory Layer's Three.js Raycaster has the same limitation (documented since Phase 9A.6, re-confirmed in Phase 16.1.5). Manual mouse interaction is the canonical verification path for canvas clicks; data-layer probes + module-load verification are the structural backstops. Plan QA accordingly: mark canvas-click items as code-verified-only when they can't be exercised via scripted DOM events.

### Documentation conventions

- **Per-phase completion notes** go into [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md) under a new `### Phase X.Y completion notes (YYYY-MM-DD) — short title` heading. Each note covers what shipped, deviations from the brief, fold-ins, runtime verification, known scope boundaries, and a `**Status:** [x] Complete.` footer.
- **Spec changes** go into `architecture-spec.md` Changelog section as a `- **§X.Y — Phase Z:** ...` bullet. Substantial new behavior gets a new subsection inline at the relevant section.
- **Open backlog items** go into `polish-backlog.md` topic sections with `Status` + `Effort` fields. Completed items move to the bottom-of-file `## Completed` section preserving full Status entries.
- **In-app Changelog modal** entries go in `src/v2/V2App.jsx`'s Changelog releases array, prepended above the previous version. Footer version constant in V2App.jsx is also bumped for forward-progress phases.
- **Cross-role notification fan-out** is documented in `architecture-spec.md` §7.4 as new rows in the notification table.

### Footer version convention

- **Forward-progress phases roll the footer constant forward.** Phase 16.1.5 → footer reads `v0.16.1.5`.
- **Backtrack-hotfix versions leave the footer unchanged.** A backtrack-hotfix is a fix INSERTED into the Changelog modal between existing entries (e.g. Phase 14.6 inserted between 15.0 and 14.5 — the v0.14.6 entry sits in the modal between v0.15.0 and v0.14.5 in chronological order, but the footer stayed at v0.15.9 because the latest forward-progress phase was 15.6).
- **Round 16 caveat:** the "footer stays frozen" rule was over-applied across the entire 16.0.x cycle (footer held at v0.15.9 through 16.0.3). Phase 16.1.0 corrected this — those were forward phases and should have rolled the footer. The convention now: 16.0.x retroactively considered forward (but footer history kept as-is for the prototype), 16.1.0 onward rolls forward each forward-progress phase.

### Git workflow

**Phase commits go directly to `main`. The worktree feature is currently disabled — `git rev-parse --abbrev-ref HEAD` must return `main` before any code changes.** Do not create feature branches for prototype work. One Claude Code prompt = one phase = one commit. Phase boundaries get commits without exception, even within a single Claude Code session.

If a worktree session is in use (older convention), it must fast-forward into `main` and push at the phase boundary; the side branch is deleted afterward. Phase 16.1.4 shipped this way; Phase 16.1.5 onward shipped commit-to-main directly.

---

## Current state of the world

- **Footer version:** v0.16.2.0 (rolled forward during Phase 16.2; held at v0.16.2.0 across the 16.2.1 / 16.2.2 / 16.2.3 / 16.2.4 backtrack-hotfixes).

- **Last shipped phase:** **Phase 16.2.4 — Directory galactic view v2 (Voronoi packing + sunflower clusters).** `DirectoryLayer.jsx` redesigned end-to-end. **Canvas** shrinks 17280×11170 → 11520×7447 (MBP 16" at 15% zoom). `MIN_ZOOM` / `INITIAL_ZOOM` 0.1 → 0.15. **Voronoi packing**: Lloyd-iterated centroidal tessellation replaces polar Poisson disc; active Actor's seed pinned at bottom-center anchor (index 0); cells target area ∝ dot count via `stepFactor = 0.5 + 0.5*tanh(area_error)`. Iteration cap 10. **Sunflower clusters**: Vogel phyllotaxis around each Voronoi cell centroid with a reserved 6×3 cell `LABEL_HOLE` at the center. Inter-cluster buffer of `2 × DOT_GRID` enforced during dot acceptance. Umbrella items placed first so they occupy inner spiral arcs. **Centered Actor label**: PillboxLabel moved from above-grid to cluster center via `transform: translate(-50%, -50%)`. Three.js Actor-squares mesh kept (lifecycle symmetry) but rendered with `count=0`. **Umbrella outline**: convex hull of umbrella dots (Andrew's monotone-chain) offset outward by 1 DOT_GRID; amber stroke + 8% amber fill — reverts Phase 16.1.3 grey treatment per brief. L-shape rectangular construction removed. **Loading animation v2**: `playDirectoryLoadAnimation` extended with `umbrellaOutlines` + `setUmbrellaOpacity`; outlines fade 0 → 1 in sync with their cluster label. **d3-delaunay** added as dependency (`^6.0.4`). **Lloyd's convergence caveat**: at the 12-actor seed, max displacement after 10 iterations is ~194 wu (above 12-wu threshold); per brief, accept + `console.warn` rather than unilaterally raising the cap. Phase 16.2.5 (seed expansion to ~3k dots) is next in queue; 16.2.6 (Alice per-Claim grouping) follows. Phase 16.1.4 + 16.1.5 defensive settings + camera-init NaN guard preserved. Footer stays at v0.16.2.0 per backtrack-hotfix convention.

- **Phase 16.2.3 (prior phase):** Directory galactic view + loading animation. `DirectoryLayer.jsx` rewritten to use a bounded 17280×11170 design surface (matching 16" MBP logical resolution at 10% zoom) + radial polar Poisson disc fan-out + radial wave loading animation. **Canvas + zoom**: `MIN_ZOOM` 0.5 → 0.1; `INITIAL_ZOOM` set to 0.1; on every Directory entry (initial mount + role switch) camera resets to `(CANVAS_WIDTH/2, CANVAS_HEIGHT/2)` at zoom 0.1, showing the full canvas in an MBP viewport. Zoom-percentage display maps zoom × 100 directly. **Anchor** at `(8640, 8936)` — canvas-bottom-center, 20% up from the bottom edge; Carol (anonymous, no own cluster) still uses the same anchor as the polar origin. **Polar fan-out** replaces the Phase 16.2 deterministic-bbox-overlap loop: each non-active cluster picks (θ, r) via Poisson disc sampling — θ ∈ [-75°, +75°] from straight up, r ∈ [2000, ~8377]. Sort by descending Claim count; 50 retries with seed-perturbed samples; 12-cell buffer + canvas-bounds check. **Pan-bounds recompute per zoom** so at 0.1 the bounds collapse to a single point and at higher zoom they open up without revealing void beyond the canvas. **FIT** recalculates zoom from `min(viewport.w/CANVAS_WIDTH, viewport.h/CANVAS_HEIGHT)`. **Loading animation** (new helper `src/v2/directoryLoadAnimation.js`): cluster dots fade in via a radial wave emanating from the anchor on every entry (~3s total); per-dot t_start = d / waveSpeed (3000 wu/s); ramp opacity 0 → 1 over 200ms; labels fade in 100ms after first dot in their cluster. Dot opacity is realised via per-instance color multiplication on the existing InstancedMesh. Click on empty canvas during animation calls `skip()` and snaps to 1.0; dot clicks open Detail Panel normally without skipping; pan/zoom run independently. **#196 closed** — superseded by the polar Poisson disc fan-out. **Camera-init NaN guard** added: `updateCamera` bails when container width/height ≤ 0, preventing zero-frustum NaN from propagating through `worldToScreen` and breaking HTML overlay positioning. Phase 16.1.5 + 16.1.4 defensive settings intact. Footer stays at v0.16.2.0 per backtrack-hotfix convention.

- **Phase 16.2.2 (prior phase):** Parent canvas node spreading. Refactor of `buildV22Canvas` in `src/v2/v2_2Data.js` (the parent-canvas layout function). **Three coordinated changes**: (1) **chain-row coalescing**: each evaluation chain (one row per `chainOrigin`) is now y-anchored to its evaluator's `EA.granteeAssetId` Asset on canvas via a two-pass allocator (pass 1 — first chain at each anchor takes that anchor's y exactly; pass 2 — subsequent chains pick nearest non-colliding y via symmetric outward search). Chain successors (re-runs) share their origin's y so a chain reads as a single horizontal row. (2) **Increased grantee-direction x-gap**: `COL_PULLED_CLAIM` bumped 2100 → 2400 (downstream constants bumped similarly) so the gap between rightmost chain node and the pulled Claim is 400 world units — comfortably above the brief's ≥240 minimum. (3) **PoE column order on grantor-direction views**: `proofOfEvalPulledPoEs` moved from "between Claim and ER" (100-unit gap to Claim) to "right of ER" (matching `Claim → ER → PoE → counterparty Asset` order). **Architectural deviation surfaced**: both Bob's evaluations carry `granteeAssetId: bAvionics` in the seed, so the brief's "bAvionics for PRM eval, bThermal for VReg eval" example doesn't hold — strict per-chain anchor alignment is impossible when chains share an anchor; the two-pass allocator stacks them symmetrically. Zero node-overlap pairs across all four role views verified. Footer stays at v0.16.2.0 per backtrack-hotfix convention.

- **Phase 16.2.1 (prior phase):** `aVregTestReport` ownership DA bugfix. One-line fix in `buildV22SharedArtifacts` adding `aVregTestReport` to the `aliceOwnAssets` array. Phase 15.4 promoted the Asset to an unattached "floating" entry that Alice attaches to her VReg Claim during the Re-Run demo prereq, but omitted the Actor→Asset ownership DA. Result: the Asset rendered floating on Alice's parent canvas with no Full Disclosure edge to the MicroCo Actor card. New internal DA `da-own-asset-vreg-test-report` (grantor + grantee both MicroCo, subject `{kind:'asset', id: aVregTestReport.id}`, type: 'full'). Disclosure-agreements grows by exactly 1. Re-Run demo prereq flow unchanged — ownership and Claim-reference are orthogonal; Alice still amends VReg Claim to add `aVregTestReport` as a referenced Asset later. Footer stays at v0.16.2.0 per backtrack-hotfix convention.

- **Phase 16.2 (prior phase):** Directory Layer seed expansion. Round 17 opens. The Directory now hosts **12 new mock supplier Actors** representing the defense-electronics supply chain underneath Bob's Sentinel-4 satellite program: NovaFab (25 Claims), ElectroGrid (24), Precision Components (18), AvionicSys (17), Substrate Dynamics (16), Helix RF (11), Optech Sensors (10), SolarVantage (10), ThermaCore (9), CompoStruct (9), Photonix (4), Cryotek (4). Total: **157 new Claims, 157 stub Assets, and 628 new internal + public DAs** (1 own-asset + 1 own-claim + 1 claim-ref-asset + 1 public per Claim). Every new Actor is non-switchable (`user: null`, `credits: 0`) and discloses exclusively to the Radiant Network — **no umbrella DAs** to any of the four primary actors. The four existing actor seeds (Bob/GovCo, Alice/MicroCo, Carol/AuditCo, Dave/ChipCo) are frozen — none of their Claims, Assets, DAs, EAs, RFPs, PoEs, Eval Results, or Parse Results were modified. New exported helper `seedMockSupplierActor({ id, party, vertical, claimSpecs, baseDate })` in `v2_2Data.js` produces an Actor + Claims + 1 stub Asset per Claim + ownership DAs + public DAs in one call; a companion `pickDirectoryType(i, total)` interleaver assigns disclosure types per Claim targeting ~60% full / 25% selective / 15% proofonly so every cluster paints a visible indigo + amber + green mix (with a forced fixed pattern for n ≤ 4 to keep Photonix and Cryotek non-monotone). **DirectoryLayer placement-scaling patch**: the initial cluster x-spread band scales with cluster count `N` (`xSpread = Math.max(800, 600 × (N − 1))`) instead of the previous hardcoded 800-px band. With 14 non-own clusters on Bob's view the initial band is ~7800 px — comfortably enough that the 30-attempt up-zigzag retry no longer needs to compensate. Force-directed layout (#196) remains deferred. Phase 16.1.5's defensive `frustumCulled = false` + unbounded `boundingSphere` settings on every `InstancedMesh` left intact; Phase 16.1.4's `shouldMountScene` lifecycle pattern left intact.

- **Phase 16.1.5 (prior phase):** Hotfix: frustum culling + raycast bounding-sphere fix. Shared root cause for two QA issues from Phase 16.1.4 — `THREE.InstancedMesh.boundingSphere` auto-computed from underlying geometry vertices (which sit at world origin because instance positions live in per-instance matrices), so the cached sphere is tiny (radius = `DOT_RADIUS = 3`, centred at origin). Both the renderer's frustum check and the raycast pre-filter read this cached sphere — the tiny origin-sphere fell outside the camera frustum at high zoom and outside click rays at any zoom. Fix: on each InstancedMesh (dots + Actor squares + RFP), `frustumCulled = false` + `boundingSphere = new THREE.Sphere(origin, Infinity)`.

- **Phase 16.1.4 (prior phase):** Hotfix: scene-init `useEffect` declared `phase` in deps → cleanup fired on every internal phase transition (`opening → in`, `in → out`) → disposed populated InstancedMesh mid-flight; the downstream `useLayoutEffect` didn't re-run because React batched the false/true `threeReady` toggle into a single update with no net change. Fix: derive a stable `shouldMountScene = phase !== 'closed'` boolean and depend on that. Scene-init now runs setup only on `closed → non-closed` and cleanup only on `non-closed → closed`.

- **Phase 16.1.3 (prior phase):** Directory parent-parity fixes + disclosure-type-based dot colors. Nine items including: dot lifecycle hardened via `useLayoutEffect`; Actor square as hollow `ShapeGeometry` mesh (border scales with zoom); squareCell reserved in cluster layout (no overlap); zoom controls top:73; Detail Panel `bottom:28`; click pans camera to centre the dot with panel-aware offset; Request EA modal close stays on Directory; dot colors map to disclosure TYPE (full→indigo, selective→amber, proof-only→green) with neutral grey L-shape umbrella boundary; RFP as cyan hollow circle.

- **Phase 16.1.2 (prior phase):** Spatial model rewrite. Corner card removed; user's own cluster anchored at canvas-horizontal-center + bottom-third vertically; new `isUserVisible` flag for anonymous-actor case (Carol/AuditCo); Actor squares in Three.js; all edges dropped from Directory; 12-cell buffer between cluster bboxes; InstancedMesh persists across data changes. Filed #196 (force-directed layout, deferred).

- **Phase 16.1.1 (prior phase):** Three.js Directory hotfix — eleven QA fixes on top of 16.1.0 including wheel-zoom binding, sync render after InstancedMesh attach, 1-cell buffer around umbrella subset, cluster vertically centered on Actor square.

- **Phase 16.1.0 (prior phase):** Three.js migration. DirectoryLayer's rendering pipeline migrated from HTML/CSS dots + CSS-tiled background to Three.js scene + InstancedMesh dots + Points grid + scroll-zoom + drag-pan. Pan via drag, zoom via wheel (zoom-around-cursor); MIN_ZOOM=0.5, MAX_ZOOM=4.0. Three.js scope kept narrow (only dots + grid); HTML/SVG preserved for tooltip card, label pillboxes, umbrella borders. Filed #195 (Three.js edge migration, deferred).

- **Phase 16.0.x (prior phases):** 16.0 — Directory Layer foundations replacing Phase 7/11A/11B placeholder scaffolding (new visual model: dot matrix background, per-Actor clusters, hollow indigo Actor squares, per-role view filtering, `buildV22DirectoryDataForRole` view-builder, Dave/ChipCo catalog grown 2→14 Claims, skeletal `makeRfp` factory). 16.0.1, 16.0.2, 16.0.3 — layout polish + PDF.js worker fix + duplicate React key fix + curved Bezier umbrella edges + footer z-index bump. Closed #43 + #45. Filed #193, #194.

- **Active phase queue:** Round 17 in progress — **Phase 16.2 shipped**. Remaining: (1) **Phase 17.0** — RFP factory promotion + buyer post flow + clickable RFP dots + RFP Detail Panel; (2) **Phase 17.1** — Supplier discovery + self-evaluation response flow (new `makeRfpResponse` factory); (3) **Phase 17.2** — Buyer review surface + initiate formal Evaluation Agreement. After Round 17: Detail Panel cleanup (#58, #104, #116, #161, #180) → Cascading Disclosures (#26) → Netgraph cleanup (#4, #130) → Search/aggregate (#27) → Network Event Log (#30). See `ROUND-17-CONTEXT.md` for per-phase load-in lists.

---

## Round 16 retrospective

Round 16 focused entirely on the Directory Layer. Started from Phase 7/11A/11B placeholder scaffolding; ended at a Three.js-rendered, pan-zoom-capable, disclosure-type-coloured Directory with stable lifecycle and clickable dots. Lessons worth carrying forward:

- **`THREE.InstancedMesh` requires defensive culling settings.** Set `frustumCulled = false` AND override `boundingSphere = new THREE.Sphere(origin, Infinity)` on every InstancedMesh. The auto-computed bounding sphere is geometry-derived (origin-centred, tiny) and breaks BOTH renderer frustum culling AND raycast pre-filter at high zoom or when instances are far from origin. (Phase 16.1.5 root cause.)

- **`useEffect` deps including phase state machine values cause render-disposing-mid-flight bugs.** When a scene-init effect declares `phase` in its dep array, internal phase transitions trigger cleanup + recreate cycles that wipe populated meshes. Cure: derive a stable boolean (`shouldMountScene = phase !== 'closed'`) and depend on that. The downstream useLayoutEffect's deps must also be stable or include refs that update on each render. (Phase 16.1.4 root cause.)

- **Hybrid Three.js + HTML/SVG architecture for the Directory Layer.** Three.js renders the scene, background grid (Points), dot InstancedMesh, Actor squares (hollow ShapeGeometry InstancedMesh), and RFP hollow circles. HTML/SVG renders: tooltip card, label pillboxes, L-shape umbrella borders, zoom controls, "← Back to Network" exit chip, "RADIANT NETWORK" header pillbox. HTML overlays are projected from world to screen coords via a `worldToScreen` helper that runs on every camera change. Mouse handlers are React JSX event props on the container `<div>`, bound via `useCallback` with full deps — NOT `addEventListener` calls inside a long-lived useEffect.

- **Commit at every phase boundary without exception.** Round 16 lost track of this when 16.0.3 → 16.1.0 surfaced 13 unpushed phases at catchup time. The current workflow: one Claude Code prompt = one phase = one commit, direct to main. The worktree feature is currently disabled.

- **Forward-progress phases roll the footer constant forward; backtrack-hotfix versions don't.** A backtrack-hotfix is a version INSERTED into the Changelog modal between existing entries — these leave the footer unchanged because the latest forward-progress phase number stays canonical. The Round 16 "footer frozen at v0.15.9" rule across the entire 16.0.x cycle was an over-application of this convention; 16.1.0 corrected it.

---

## Phase log

The full per-phase completion log lives in [`CLAUDE-phase-log.md`](./CLAUDE-phase-log.md). It contains every phase note from Phase 1 (V2.2 data model foundation, 2026-04-17) through Phase 16.2.4 (Directory galactic view v2 — Voronoi + sunflower, 2026-05-16), in chronological order.

The original V2.2 migration ran in eight phases:

- [x] Phase 1: Data Model Foundation
- [x] Phase 2: Parent Layer Restructure
- [x] Phase 3: Edge Clickability + Agreement Panels
- [x] Phase 4: Combined Request + Response Flows
- [x] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [x] Phase 6: Amendment Flows
- [x] Phase 7: Directory Layer + AI Shopper (superseded by Round 16)
- [x] Phase 8: Consolidation + Cleanup

Post-migration work shipped through Phases 9A → 9E-parallel.x, 9D.1 → 9D.2.x, 10.x, 11A → 11E.1, 12.x, 13.x, 14.x (Badges), 15.x (PDF annotation), and 16.x (Directory Layer Three.js + lifecycle + bounding-sphere fixes). See `CLAUDE-phase-log.md` for the full narrative.
