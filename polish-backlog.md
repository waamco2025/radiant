# V2.2 Polish Backlog

Running list of refinements, enhancements, and UX adjustments identified during V2.2 migration work. Intended to be addressed in a dedicated polish phase after Phase 7 is complete and the V2.1 code paths are deleted.

Claude Code: update this file as new items are identified during migration work. Do not address any item on this list during the migration itself unless it gates a Phase's acceptance criteria.

Each item includes:
- **Source** — which phase or conversation surfaced it
- **Scope** — rough effort estimate (Small / Medium / Large)
- **Depends on** — prerequisites, if any

Item numbers are permanent IDs; they are never resequenced, so sections may read non-monotonically (e.g., `#1, #2, #3, #4, #5, #56, #57, #60, #63`) after later additions are filed into their categorical homes.

---

## Visual & Rendering

### 1. Warmer grey border on all nodes
- **Status:** ✅ Complete (Phase 9A). `warmBorder = color-mix(in srgb, var(--accent-indigo) 22%, var(--border))` — reads as a cool indigo-grey that stops node terminations from fading into the dark canvas without competing with indigo edges. Red UNSAT border treatment unchanged.

### 2. Visual distinction for counterparty-pulled-in nodes
- **Status:** ✅ Complete (Phase 9A). Counterparty cards (where `node.owner !== activeParty`, excluding Actor nodes) render a muted tint: `color-mix(in srgb, var(--bg-card) 82%, var(--bg-deep))`. Subtle flattening, no opacity/chip changes.

### 3. Subtle de-emphasis for internal/ownership edges
- **Status:** ✅ Complete (Phase 9A). Internal edges (where `edge.grantorParty === edge.granteeParty`, carried through from `deriveAgreementEdges`) now render at 70% of the default stroke width. Selected and NEW edges keep their emphasis regardless.

### 4. Layout density improvements
- **Source:** Phase 2 visual review
- **Scope:** Medium
- **Context:** Alice's canvas is crowded with Assets, Parse Results, Claims, and Eval Results all on the parent layer. Nodes overlap in edge paths; edge crossings are frequent.
- **Proposed fix:** Evaluate orthogonal edge routing, edge bundling, or tighter node clustering by relationship. May require V2Canvas refactor.

### 5. Node label truncation legibility
- **Status:** ✅ Complete (Phase 9A, expanded). Claim and Eval Result names wrap to two lines via `-webkit-line-clamp: 2`; Actor and Asset names stay on one line with ellipsis. Also in Phase 9A: vertical spacing above the name increased so the `CLAIM` / `EVAL RESULT` type badge no longer crowds the name, and the health minibar's wrapper flex-space-between-s the inner content so the whitespace between the owner row and the card edge equalises.

### 39. Decline dismiss "ravel-out" animation
- **Source:** Phase 6.5+ #2 / #3 review
- **Scope:** Small
- **Context:** Dismissing a declined Claim removes it instantly from Bob's canvas. A short ravel-out animation (border collapse + edge fade) would communicate "this is going away" instead of a hard cut.

### 40. Node card action button reassessment post-migration
- **Status:** ✅ Complete (Phase 9A). V2.2 nodes route through a new `V22ActionBar` component that mirrors the Detail Panel footer one-to-one per type: ASSET (owner) → Request Agreement + Parse Evidence + Create Claim; CLAIM (owner) → Amend Claim + Self-Evaluate; CLAIM (non-owner + active EA) → Run Evaluation; EVAL RESULT (owner, not superseded) → Re-run Evaluation; PARSE RESULT / ACTOR → none. Single dispatch prop `onV22CardAction(actionName, node)` routes from card click → V2Canvas → V2App's action handlers, the same handlers V22NodeDetailPanel's footer fires. Legacy V2.1 ActionBar is retained as fallback for non-V2.2 nodes.

### 44. Radiant Network Actor node on owner canvas
- **Source:** Phase 7 gap — spec §3.6
- **Scope:** Small
- **Context:** §3.6 says the Radiant Network node appears on the user's canvas only if they have Claims publicly disclosed. On Alice's canvas today we derive the public-directory edges correctly but do NOT add a Radiant Network Actor node to the view. Add `isPublicDirectory` pseudo-actor to `buildViewForActor` when the actor has any DA where grantee.party === 'Radiant Network'.

### 46. Corner-node morph on Directory entry/exit
- **Source:** Spec §8.1 — unimplemented in Phase 7
- **Scope:** Medium
- **Context:** Spec calls for the Radiant Network chrome button to morph mid-animation into the Directory Layer's corner anchor node (and vice versa on exit). Currently the two are visually distinct: the chrome icon stays in place, and the corner anchor fades in via the clip-path wipe. A continuous transform (translate + scale + shape interpolation) would sell the "one animation, not two" principle more convincingly.

### 52. "Human-validated" indicator on Eval/Parse review rows
- **Status:** ✅ Complete (Phase 9A item 10). `_aiOriginalValue` snapshot tracked per row from initialization (set to the AI's extracted value, or empty string for fresh rows). When `row.value !== row._aiOriginalValue` the modal + Detail Panel render a small amber pencil SVG next to the ConfidenceBadge with the tooltip "Human-edited from AI's original extraction." Persisted onto the submitted Parse Result `fields` and Eval Result `results` so the Detail Panel can render the pencil later. AI confidence remains unchanged by human edits (the Phase 8.5 rule).

### 56. Keyboard accessibility
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Medium
- **Context:** Flows today assume mouse input — canvas panning, edge clicks, modal chevron pickers, confidence cycling all fire on click without a clear keyboard equivalent. A pass to wire Tab/Arrow/Enter/Escape through each flow (modal traversal order, canvas-focus-ring, chevron picker via arrow keys, confidence cycle via Space) before a broader a11y audit.

### 57. Mobile/responsive (tablet-friendly max)
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Large
- **Context:** Layout is desktop-first; the canvas and Detail Panel both assume ≥1280px. Tablet is a realistic demo surface (iPad landscape ≈ 1024×768). Phone is out of scope. Audit: canvas pan/zoom ergonomics on touch, Detail Panel width on narrower viewports, modal widths, chrome icon spacing.

### 60. Dot-LOD alignment with background dot matrix
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Small
- **Context:** At dot-LOD zoom the node dots visually compete with the background dot-matrix grid. Consider aligning node-dot positions to grid intersections, or tuning the background dot density/opacity so node dots read as distinct. Child layer is currently unused, so this is a parent-layer-only concern.

### 63. Mini/dot LOD warmer borders
- **Status:** ✅ Complete (Phase 9A.1.5). `WARM_BORDER` (40% indigo blend) extended to mini and dot LOD renderings — mini cards now match full cards; dots grow a 1px indigo ring so they don't fade into canvas at zoom-out. Red UNSAT borders unchanged.

---

## Edge Interactions

### 6. Selected-edge state persistence through layer changes
- **Source:** Phase 3 open question
- **Scope:** Small
- **Context:** If user selects an edge then triggers a layer change (dive/surface), the highlight resets because material mutation doesn't survive rebuild.
- **Proposed fix:** Re-apply selected-edge material in the effect that handles layer changes. Low-priority given V2.2's empty child layer — matters more if we later reuse child layer.

### 7. Hover tooltip conflicts with edge menu position
- **Source:** Phase 3 visual review
- **Scope:** Small
- **Context:** When clicking an edge, the hover tooltip appears at the click position and covers the edge menu that appears immediately after.
- **Proposed fix:** Offset the edge menu position from the click point, or dismiss the tooltip on click before rendering the menu.

### 8. Glow indicators on edge-connected nodes
- **Status:** ✅ Complete (Phase 9A). The `v22DataWithReveal` memo stamps `_isEdgeEndpoint: true` on the two nodes touched by the currently-selected edge; AssetNode applies a static indigo glow (`box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-indigo) 35%, transparent)`) that sits 5px outside the card border. Distinct from the selected-node amber border so users can tell "I selected this" apart from "this is an edge endpoint." No animation/pulse per spec.

### 9. Richer provisional → active transition
- **Source:** Phase 4 deviation #3
- **Scope:** Medium
- **Context:** Current transition reuses V2.1's `_isNew` 900ms reveal. Works but doesn't visually express the "dashed edge becomes solid" state change.
- **Proposed fix:** Dashed-to-solid edge morph animation. May need custom V2Canvas edge animation logic.

### 10. "NEW" badge and pan-to-node on provisional creation
- **Source:** Phase 4 visual review
- **Scope:** Small
- **Context:** When a request creates a provisional node, the canvas should pan-and-zoom to it with a "NEW" badge — matching V2.1's existing behavior for newly-created nodes.
- **Status:** ✅ Complete (Phase 6 carry-over fix; clarified Phase 9A.4 preamble). `_isNew` persists on the node until the user deselects it; the NEW badge renders for the same duration. The 900ms reveal is a separate fade-in animation on initial render — not a NEW-badge timer. `setV22PanToClaimId` pans to the new provisional Claim on the requester's canvas.

### 35. Edge-draw animation for new Amend Claim references
- **Source:** Phase 6.5 #12 review — when an amendment adds new Asset references, the new claim ↔ asset edges appear without animation.
- **Scope:** Small
- **Context:** Existing `_isNew` flag drives node reveals; needs an analogous edge-level signal so newly-derived edges from amendment also draw with V2Canvas's existing edge-draw animation pattern.
- **Proposed fix:** Tag the new claim-ref DAs with `_isNew: true` in the amendment factory output; have the canvas adapter pass that flag through to the derived edges; V2Canvas already animates edges with `_isNew` (see Phase 4 reveal infrastructure).

### 59. Edge hover overhaul — tooltip IS the menu, on-edge dot, click to pin
- **Source:** Phase 9A.3 preamble — handoff roster. **High priority — Phase 9B target.**
- **Scope:** Medium
- **Context:** Today edge hover shows a raycaster-driven floating tooltip; edge click opens a separate `EdgeMenu` that overlays at the click point. These are two surfaces for the same relationship. Target: unify into a single hover-tooltip-that-is-also-the-menu — on hover, a small dot indicator appears on the edge itself at the raycaster hit point, the tooltip shows SDA type + endpoints + actionable rows (View DA / View EA), and clicking pins the tooltip so it persists through mouse-move (keeps the rich content accessible without the cursor-follow jitter). Phase 9A.2 left the existing edge hover on its ad-hoc implementation specifically so 9B has a clean base to extend.

### 62. Carry-over defects from 9A.2
- **Status:** ✅ Complete (Phase 9A.3 Gate C). All four defects addressed:
  - (a) Dot-LOD endpoint ring — re-geometred around the inner 8px dot (wrapper centre at 8,8) instead of the 16px wrapper. New dims `14×14` at `top: 1, left: 1` give a clean 3px halo. (Note: revisited Phase 9A.4 preamble — the 9A.3 ring geometry was correct, but the `data-card-id` wrapper was 16×20 due to line-box allocation + a 4px baseline offset on the child. Fix: explicit `width/height: 16` + `display: flex` on the wrapper so the child lands flush at (0,0) and the ring centres on the visual dot centre, not just mathematically.)
  - (b) Bell chrome button wrapped in `<Tooltip content="Notifications (N)">`; content suppressed when the inbox dropdown is open so the tooltip doesn't obscure the list.
  - (c) (d) Root cause was Tooltip's TooltipBody `zIndex: 6000` sitting *below* the Modal Backdrop's `zIndex: 10000`. Tooltips anchored inside a modal rendered, but under the modal's darkening backdrop — invisible to the user. Bumped to `10100`; chrome tooltips still work (canvas-level z doesn't regress) and in-modal tooltips now appear on top of the modal content.

### 68. Hashing / processing sequence UI per file
- **Source:** Phase 9A.3 QA — restore from V2.1 backups.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** After a file is selected (from Qualified Storage or local upload), show a brief visual sequence representing the file being hashed on the network and registered as immutable. The V2.1 implementation had this step between picker-close and review-card render; it was lost during V2.2 migration. Pairs with #66 (multi-file registration) and #67 (local-upload tab).
- **Proposed fix:** Pattern-match the V2.1 hashing sequence from reference backups. Drop it into V22CreateAssetModal between the picker step and the review step. Likely a small animation component with a progress bar + hash-display reveal.

### 71. Restore provisional → disclosed card transform animation
- **Source:** Phase 9A.3 QA — existed in V2.1, lost during migration cleanup.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Card-level animation that played when a provisional node transitioned to disclosed (active). Distinct from backlog #9 (edge dashed-to-solid animation) — this is the node-card transform/reveal. Pairing both would give a full-fidelity provisional→active transition. Reference V2.1 backups for the original implementation.
- **Proposed fix:** Reinstate the V2.1 card transform keyframes in `AssetNode.jsx` (or CSS sibling). Trigger on `_showAsProvisional` flipping false after `handleV22Accept`.

---

## Detail Panels

### 64. Asset DOT / hash / URI click-to-copy badge
- **Status:** ✅ Complete (Phase 9A.4 preamble). Applied `<CopyBadge value={...} truncated />` treatment to three long identifiers on the Asset Detail Panel: owner DOT, file hash, file URI. Matches the PIN treatment used elsewhere in the app. Null-value guard (`value ? <CopyBadge ... /> : '—'`) handles Assets registered via Phase 9A.3's Create Asset flow where `file.hash` is null pending a real hashing implementation. Per spec §3.2 the Asset has no distinct DOT — the file hash is the true per-Asset cryptographic identifier; the "DOT" label on the Asset panel refers to the party-level owner DOT.

### 11. Two-tab Overview/Artifact layout for DA and EA Detail Panels
- **Source:** Phase 3 visual review
- **Scope:** Medium
- **Context:** DA and EA Detail Panels currently use a flat layout. Node Detail Panels use Overview + Artifact tabs. Matching the node panel structure would give DA/EA panels a consistent mental model (Overview: parties, subject, scope, terms — Artifact: raw JSON viewer).
- **Proposed fix:** Refactor `DisclosureAgreementDetailPanel.jsx` and `EvaluationAgreementDetailPanel.jsx` to use the same tab structure as node DetailPanels, with a JSON artifact view under the Artifact tab.

### 12. Agreement amend actions accessible from node Detail Panels
- **Source:** Phase 3 visual review
- **Scope:** Medium
- **Context:** Amend DA and Amend EA are currently only accessible by clicking edges. Users expect to be able to take these actions from the relevant node's Detail Panel too (e.g., "Amend disclosure for this Claim" from the Claim's panel).
- **Proposed fix:** In node Detail Panels, list related Agreements in a section with per-Agreement Amend actions. Requires deciding which node "owns" which Agreement relationship visually.

### 48. Candidate preview before Request Agreement
- **Source:** Phase 7 scope boundary (spec §9)
- **Scope:** Small
- **Context:** Spec §9 lists "View a Claim's public-directory Detail Panel (owner, description, posted date, aggregate stats)" as a capability. Currently the candidate card jumps straight to Request Agreement. Add a secondary "Preview" CTA that opens a read-only panel showing what's publicly disclosed about the Claim (respecting the public DA's scope).

### 58. Export JSON (functional) + Export PDF (placeholder)
- **Source:** Phase 9A.3 preamble — handoff roster. **High priority.**
- **Scope:** Medium
- **Context:** Detail Panels for each artifact type (Asset, Claim, Parse Result, Eval Result, DA, EA) should offer Export actions. JSON export is trivial — serialise the `v22Artifact` (or the underlying artifact) and trigger a browser download; this is functional from day one. PDF export is placeholder-grade (stub button that opens a "coming soon" dialog or generates a minimal PDF via a lightweight library) — the intent is to surface the capability in the UI so client discussions around export formats have a visible hook.
- **Proposed fix:** Add a shared `<ExportActions>` strip to each Detail Panel footer, above the primary action. Two buttons: "Export JSON" (functional) + "Export PDF" (placeholder). Consider a single dropdown if footers get crowded.

---

## V1 File Cleanup

### 13. Delete V1 files
- **Status:** ✅ Complete (Phase 8). `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/ia-map-entry.jsx`, `src/data/`, `src/reference/`, and every `src/components/*.jsx` file outside `modals/` and `DetailPanel/` removed. `index.html` deleted. `vite.config.js` updated to drop the `main` input.

### 14. Delete V2.1-specific code paths
- **Status:** ✅ Complete (Phase 8). `V2_2_ENABLED` flag removed from `v2_2Data.js`. All 23 conditional sites in `V2App.jsx` collapsed. 13 V2.1 modal files deleted (`RequestDisclosureModal`, `DisclosureResponseModal`, `ReviseDisclosureModal`, V2.1 `RunEvaluationModal`, V2.1 `ParseEvidenceModal`, `RegisterAssetModal`, `AddEvidenceModal`, `CascadeModal`, `UpstreamPicker`, `CreateClaimModal`, `QualifiedStoragePicker`, `RevocationNoticeModal`, `PublishModal`). 10 V2.1 DetailPanel files deleted (`index.jsx`, `PanelShell.jsx`, `ChildrenTab.jsx`, `DisclosuresTab.jsx`, `EvalPanel.jsx`, `EvaluationsTab.jsx`, `EvidenceBlock.jsx`, `ParsedFieldsTab.jsx`, `ClaimsTable.jsx`, `constants.js`) plus all of `shared/` except `CopyBadge.jsx`. V2.1 merge pipeline in `V2App.jsx` (~270 lines) removed along with the V2.1-only state fields (`addedNodes`, `addedSDAs`, `addedEdges`, `addedChildren`, `removedSDAs`, `removedNodes`, `removedEdges`, `newlyDisclosedIds`). Bundle dropped from 638 kB → 345 kB (46% shrinkage).

### 49. Rename `src/v2/` to `src/` (or `src/app/`)
- **Source:** Phase 8 consolidation — deferred from the main cleanup pass.
- **Scope:** Medium
- **Context:** With V2.1 deleted and V2.2 the only shipped version, the `v2/` subdirectory is vestigial. Cascading import-path changes across every file (`src/components/modals/V22RunEvaluationModal.jsx` has `import PrimeRadiant from '../../v2/PrimeRadiant.jsx'` and similar relative-path stubs throughout) make this a high-blast-radius change. Should happen in a dedicated atomic pass with a codebase-wide find-and-replace, followed by a full build + runtime verification.

### 50. Dead V2.1 handler sweep in V2App.jsx
- **Source:** Phase 8 consolidation — some handlers deferred for focused pass.
- **Scope:** Medium
- **Context:** After the Phase 8 V2.1 modal + DetailPanel deletion, several V2.1-era handlers remain in `V2App.jsx` as dead code: `handlePanelViewChain`, `handlePanelExpandStack`, `handlePanelSurface`, `handleValidatePins`, `handleSubmitRequest`, plus state setters like `setClaimContext`, `setCascadeContext`, `setPublishNode`, `setReviseContext`, etc. Build tree-shakes these but they add file noise. Sweep them in a dedicated pass with no functional changes.

### 51. V2Canvas.jsx V2.1 prop pruning
- **Source:** Phase 8 audit
- **Scope:** Small
- **Context:** `V2Canvas.jsx` accepts several V2.1-only props that V2.2 no longer passes: `onConnect` (V2.2 passes `undefined`), `onDisclose`, `onAddEvidence`, `onParseEvidence`, `onRunEvaluation`, `onAmendEval`, `onCreateClaim`. These trace into V2Canvas's internal card-action-bar rendering. Prune the props from V2Canvas's signature and delete the corresponding card-action-bar code paths.

---

## Notifications

### 15. Notification system enhancements for V2.2 flows
- **Source:** Phase 4 open question #4
- **Scope:** Medium
- **Status:** Scheduled for Phase 5 (moved from backlog — basic accept/decline notifications). Further refinements (amendment notifications, proof-of-evaluation notifications) may come later.

### 16. Deep-linking from notifications
- **Source:** Phase 4 open question #4
- **Status:** Scheduled for Phase 5.

---

## Data Model & Content

### 65. Credit charge for Asset registration + Claim creation
- **Source:** Phase 9A.3 QA — client requirement.
- **Scope:** Small
- **Priority:** **High**
- **Context:** Phase 9A.3 shipped V22CreateAssetModal + V22CreateClaimModal without credit cost (matched the V2.2 no-credit pattern of ParseEvidence / RunEvaluation / CombinedRequest). Client considers credit accounting core to the Registering + Claiming processes. Re-add a credit cost: V2.1 precedent was 25 credits per Claim; pick a proportional value for Assets (5 or 10 credits looks right given evidence-file cost vs. full-Claim cost).
- **Proposed fix:** Reuse V2App's existing `credits` + `setCredits` state. Add a `CREDITS_PER_ASSET` + `CREDITS_PER_CLAIM` constant set near the top of the file. Gate submit on sufficient credits in both modals; render a credit-cost row in the review step matching V2.1's treatment. V2.2's other unilateral flows (Parse, self-evaluate) remain free per current behaviour; only Registering + Claiming get charged.

### 70. Asset hierarchy — Asset-from-Asset registration
- **Source:** Phase 9A.3 QA — surfaces supply-chain / Program modelling needs.
- **Scope:** Medium
- **Priority:** **Blocked on design decision**
- **Context:** Enables structures like "Sentinel-4 Program" as a parent Asset with sub-Assets (individual modules, subsystems, mission-critical items). Today Assets are flat — all siblings under the Actor. Hierarchy would let users model Programs / Missions / supply chains with first-class parent→child Asset relationships.
- **Design decision needed before build.** Three candidate models:
  - (a) Add `parentAssetId` field to Asset schema (spec §3.2 extension). Canvas renders parent-first, child indented. Query: all Assets with this parent.
  - (b) View-layer grouping only — no data-model change. Assets stay flat in storage, but the view builder groups them by `asset.metadata.parentAssetId` if present. Minimal blast radius.
  - (c) New edge type: `ParentAsset` edge. Fits the existing "everything is an edge" principle. Requires edge-derivation + rendering work.
- **Andrew to choose before scoping implementation.**

### 17. Terminology reconciliation with client canon
- **Source:** Andrew's client feedback post-spec-review
- **Scope:** Medium
- **Context:** Client analysis confirmed the architecture model holds, but noted deviations from their canon terminology. No structural changes required — just naming drift to reconcile.
- **Proposed fix:** After V2.2 stabilizes, update nomenclature (artifact names, field names, UI labels) to match client canon. Then update the architecture spec markdown to reflect the shipped reality. Client re-runs their analysis.

### 18. Third-actor Carol demo data expansion
- **Source:** Spec §7.3 (Story 3)
- **Scope:** Small
- **Context:** Carol's demo data currently covers only the AuditCo PRM audit scenario. Stories that walk through Carol disclosing her Eval Result to Bob may need richer seeded data.
- **Proposed fix:** Seed Carol with additional audit Claims and the full Story 3 flow (Carol → Bob proof-only disclosure).

### 19. Published standards data
- **Source:** Spec §17.1 (future direction), Phase 6 self-evaluation flow
- **Scope:** Small
- **Context:** Alice's self-evaluation story requires published Requirements Sets from external actors (OSHA, NIST, ISO). These exist in V2.1 demo data but need verification that they're reachable in V2.2.
- **Proposed fix:** Verify published standards are accessible from the Library modal in V2.2 mode. Add if missing.

### 36. Option B — view builder pulls disclosed Assets onto grantee canvas
- **Source:** Phase 6.5 #5 — chose Option A (resolve evidence Assets from shared dataset in the eval modal) as the smaller change. Option B is the architecturally consistent counterpart.
- **Scope:** Medium
- **Context:** Today, counterparty Assets in scope of an active inter-party DA aren't pulled onto the grantee's canvas (only the Claim is, per §6 pull-in semantics). The eval modal works around this by resolving Assets directly from the shared dataset. Bob can't see the in-scope Assets on his canvas — he sees them only inside modals/panels.
- **Proposed fix:** Update `buildViewForActor` to also pull in Assets named in `da.scope.assetIds` for active inter-party DAs where the actor is grantee. Re-evaluate canvas density after; may pair with item #4 (Layout density improvements). Once landed, revert the Option A workaround in V2App's eval-modal mount (Phase 6.5 commit) and let the filter at line ~2680 work as-is.

### 45. Real dot-cloud data sourcing
- **Source:** Phase 7 placeholder implementation
- **Scope:** Medium
- **Context:** The three mock supplier clusters (ElectroGrid Ltd, NovaFab Inc, Precision Components Co) are visual-only. Replace with (a) real counts derived from any actor in the dataset with public-directory DAs, and (b) a realistic number of other parties once demo data grows. Also: the current random-seeded positions should transition to a force-directed or stratified layout at scale.

### 53. Session persistence via localStorage
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Small
- **Context:** Current state (role, selection, provisional artifacts, notifications, in-progress modals) lives entirely in React memory. A page reload wipes everything. Persist the user-facing state slice to localStorage so demo sessions survive accidental refreshes. Be conservative about what's persisted — only what the user would expect to see after returning (role, provisionals, dismissedReqs), not ephemeral UI state (hover, pan/zoom mid-animation).

### 54. Total reset button in user menu
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Small
- **Depends on:** #53 (session persistence — reset is the dual).
- **Context:** Once session state persists, demos need a clear "blow it all away" exit. Add a "Reset demo" item to the user menu dropdown (next to role switcher) that clears localStorage, clears in-memory provisionals, and re-plays the boot sequence so the demo returns to first-load state.

### 61. Factory audit — flag preservation through `makeX`
- **Source:** Phase 9A.3 preamble — handoff roster. **Medium priority.**
- **Scope:** Small
- **Context:** Factory functions (`makeAsset`, `makeClaim`, `makeParseResult`, `makeEvaluationResult`, `makeDisclosureAgreement`, `makeEvaluationAgreement`) should preserve runtime-only flags on passed-in data without dropping them. Known flags: `_isNew`, `_isEdgeEndpoint`, `_edgeEndpointSide`, `_aiOriginalValue`, `confidence`, `_isDeclined`, `_declineMeta`, `_showAsProvisional`. Future additions should similarly round-trip. Audit each factory's output object construction — spread-then-override is the safe pattern; explicitly listing known fields risks dropping new flags silently.

---

## Process Flows

### 66. Multi-file Asset registration in single flow
- **Source:** Phase 9A.3 QA.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** V22CreateAssetModal currently registers exactly one Asset per flow (one file). Surveyors / operators onboarding a batch of evidence files (say, a whole program folder) have to run the flow N times. Enable multi-select in the QS picker + per-file rows in the review step → submit produces N Asset artifacts in one shot, all attached to the parent context (Actor, or the Asset picker that launched the nested flow). Pairs with #67 (local-upload tab) and #68 (per-file hashing sequence).
- **Proposed fix:** Reuse V22QualifiedStoragePicker's existing `mode="multi"` path (already implemented, unused in 9A.3). Extend V22CreateAssetModal with a per-file list step (each row shows filename + editable label per #69 + confidence badge). V2App's handler iterates and calls `makeAssetRegistrationArtifacts` once per file.

### 67. Local-storage upload tab in QS picker
- **Source:** Phase 9A.3 QA.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Today the picker only shows files pre-existing in Qualified Storage (mocked). Real users will want to upload from their machine. Add a tabbed UI: `[Qualified Storage | Local Storage]`. Local Storage path uploads the selected file through the app to the user's QS as a demo function, then proceeds through the normal Asset registration flow.
- **Proposed fix:** Tab switcher at the picker header. Local tab renders `<input type="file" multiple>` + drag-drop zone. On file select, a fake "uploading to QS" progress step runs, then the file gets inserted into the mock QS bucket (in-memory), then the user continues through the Asset-registration review step as if they'd picked it from QS. Pairs with #66 and #68.

### 69. User-editable Asset label
- **Source:** Phase 9A.3 QA — pairs with #68's per-file row UI.
- **Scope:** Small
- **Priority:** Medium
- **Context:** V22CreateAssetModal currently derives the Asset's display name from the filename stem (`power-supply-spec.pdf` → `power supply spec`). In the multi-file / batch flow (#66) each file should land with an editable label. Single-file flow could also benefit — user may want "Sentinel-4 PSU Spec" instead of the filename-stem default.
- **Proposed fix:** Add an editable text input to the review step, pre-populated with the derived label. Pass the user's final value through `makeAssetRegistrationArtifacts`'s `name` param. Spec §3.2 — name is already a field on the Asset schema (even though the Asset has no separate field today, makeAsset's `name` param is the slot).

### 20. Selective Disclosure: fields vs. assets scope
- **Source:** Phase 4 open question #5
- **Scope:** Small product decision, larger UX impact
- **Context:** Spec §2.3 says "Selective Disclosure references specific parsed fields." V2.1 also allowed asset-level selection. Current V2.2 implementation is fields-only.
- **Proposed fix:** Confirm with client whether asset-level scope is still needed. If yes, add asset selection to Selective disclosure flow. If no, document the constraint.

### 21. Per-Asset request entry point
- **Status:** ✅ Complete (Phase 6). `V22NodeDetailPanel`'s Asset panel renders a "Request Agreement" footer button; V2App stamps the Asset as the modal's anchor and pre-populates the request flow.

### 22. "Disclosure Declined" surface
- **Status:** ✅ Complete (Phase 5 / Phase 6). Decline records persist on `v22Provisionals.declineRecords`; declined Claim renders on requester's canvas with red DECLINED badge and decline reason; Dismiss CTA removes the record.

### 23. "Awaiting Response" state on provisional nodes
- **Status:** ✅ Complete (Phase 5 / Phase 6). `V22ClaimPanel` provisional branch shows AWAITING RESPONSE badge + request metadata; "Respond to Request" CTA for the grantor opens `CombinedResponseModal`; "Cancel Request" CTA for the grantee withdraws the provisional artifacts. Phase 6 carry-over also removed provisional pull-in from the grantor's canvas (notification-only) and added `'v22-request'` notification type so the grantor can respond from notifications.

### 33. Transferring process (ownership transfer)
- **Source:** Spec §17.2; bumped from Exploratory at Phase 9A.3 preamble for Phase 9A.4 scope.
- **Scope:** Medium
- **Phase 9A.4 scope:** Assets only (not Claims). Recipient acceptance required. Produces a new DOT that supersedes the previous owner's DOT on the Asset. Matches client's "DOT as car title" ownership-transfer model. Brings the Transferring process from "❌ Missing" → demo-complete, closing out the 7-process table.

### 34. Register new Asset during Amend Claim flow
- **Status:** ✅ Complete (Phase 9A.3 Gate B). V22CreateAssetModal is the V2.2 Asset-registration flow. AmendClaimModal and V22CreateClaimModal both expose an inline "+ Register new Asset…" CTA that opens V22CreateAssetModal nested; on submit V2App builds the Asset via `makeAssetRegistrationArtifacts`, returns the new id to the parent modal, and the parent auto-selects it in its picker. Nested modal sits on its own backdrop so the parent stays dimmed until the user either cancels or completes.

### 37. Full Disclosure last-Asset deselect handling
- **Status:** ✅ Complete (Phase 9A). Deselecting all Assets no longer snaps back; an amber italic inline help line ("Select at least one Asset to continue.") renders beneath the count footer when the selection is empty. Continue button stays disabled (existing behaviour).

### 38. Run Evaluation review-stage UX improvements
- **Status:** ✅ Complete (Phase 9A). Three sub-items shipped: (1) `StatusChevronPicker` renders ◂ SATISFACTORY ▸ with full words, left chevron cycles back, right chevron + word cycle forward; (2) on supersede / re-evaluate, rows pre-populate `value`, `status`, AND `confidence` from the prior result (was hard-coded 0.9); (3) every row renders a confidence chip — null confidence shows `AWAITING AI` instead of the previous "chip missing" state.

### 41. PDF file viewer in Run Evaluation processing/review stages
- **Source:** Phase 6.5+ #2 follow-on
- **Scope:** Medium
- **Context:** The Parse modal's evidence side currently shows file metadata only; the Run Eval modal does the same. A real (or stub) PDF viewer in the left split-pane would let evaluators read the evidence as they assess each row. Could reuse a lightweight PDF.js viewer.

### 42. "Re-Evaluate" entry point on existing Eval Result nodes
- **Status:** ✅ Complete (Phase 9A). V22EvalResultPanel's "Re-run Evaluation" footer button (owner, not superseded) now opens `V22RunEvaluationModal` with `lockedRequirementsSetId` set to the prior result's Req Set id. The modal renders a LOCKED card (indigo border, LOCKED pill, "To change Requirements Set, start a new evaluation from the Claim." explainer) instead of the picker. Evidence selection remains free; on submit the standard supersede rules apply. The prior result is also passed as `priorActiveResult`, which pre-populates review rows with the prior values/status/confidence (see item #38).

### 43. Clickable Directory Layer dots
- **Source:** Phase 7 scope boundary (spec §8.2 — "visual density only in V2.2")
- **Scope:** Medium
- **Context:** Each dot is backed by a public-directory Claim artifact already, so per-dot interactivity is a pure wiring task: on hover show the Claim name + owner + posted date; on click open a read-only preview panel with a "Request Agreement" CTA. Architecturally the dot data should come from a view builder helper (not hard-coded) so the three mock supplier clusters disappear once more real parties exist.

### 47. Real AI Shopper result streaming
- **Source:** Phase 7 placeholder implementation
- **Scope:** Large
- **Context:** The mock agent returns results in a single 2.2s batch. A real LLM-backed shopper would stream candidates as the search runs. Keep the split-screen pattern, but let rows appear one at a time with a short delay, each with a per-row confidence score that updates as more context is gathered. UI shape is already designed to absorb this — `results` array just needs incremental append instead of single assignment in `runMockSearch`.

### 55. Error states + edge-case review
- **Source:** Phase 9A.3 preamble — handoff roster.
- **Scope:** Medium
- **Context:** Each flow has happy-path error messaging but edge cases aren't systematically reviewed: PIN not found, self-PIN rejection, clipboard API failure, localStorage quota exceeded, network-offline (currently unused but will matter once a real backend arrives), modal cancelled mid-submit, role-switch during an open modal, decline/cancel from a revealed notification. Walk each V2.2 flow and surface where the failure mode is silent or ambiguous.

---

## Spec Updates

### 24. Update spec §4.4 with actual selected-edge values
- **Source:** Phase 3 deviation, confirmed by Andrew in Phase 4 review
- **Scope:** Small
- **Context:** Spec specifies 40% white blend + 0.5px stroke increase; implementation empirically required 65% / +1.5px for visibility on dashed/dotted edges. Update spec to reflect shipped values.
- **Status:** Scheduled as part of Phase 5's "also update spec" addendum.

---

## Future Features (from V2.1 backlog, carried forward)

Items from the V2.1 backlog (`radiant-v2-archive.md`) that remain relevant post-V2.2 migration:

### 25. Library Modal (unified Parse Templates + Req Sets + Published Standards)
- **Source:** Spec §12.2, V2.1 backlog #6
- **Scope:** Medium
- **Context:** Three-tab Library modal with lineage/versioning. Prep work for §17.1 Parsing/Evaluating unification.

### 26. Cascading Disclosures
- **Source:** V2.1 backlog #12
- **Scope:** Large
- **Context:** When Alice discloses an Asset to Bob, and Bob creates a Claim referencing Alice's Asset, the cascading disclosure behavior should propagate correctly through Bob's Claim to his own counterparties.

### 27. Search + aggregate metrics/filters
- **Source:** V2.1 backlog #6
- **Scope:** Medium
- **Context:** At scale, the canvas becomes hard to navigate. A search surface (find a PIN, filter by owner, filter by disclosure type) becomes useful.

### 28. Amend proof-only: select eval nodes not evidence
- **Source:** V2.1 backlog #18
- **Scope:** Medium
- **Context:** Proof-only disclosure amendments currently operate on evidence; should instead operate on Eval Result selection since proof-only shares eval results, not evidence.

### 29. Public Directory Cloud visualization
- **Source:** V2.1 backlog #23, Spec §8
- **Status:** ✅ Phase 7 placeholder shipped — `DirectoryLayer.jsx` renders 4 actor-party dot clusters (1 real + 3 mock suppliers) behind a circular-wipe transition. Full visualization (real force-directed layout, thousands of dots at scale, per-dot interactivity) tracked via items #43, #45, and #46.

### 30. Network Events Log
- **Source:** V2.1 backlog #24
- **Scope:** Large
- **Context:** Time-series log of all events (creations, disclosures, evaluations, amendments) across the user's network. Useful for audit and analysis.

---

## Exploratory / Experimental

### 31. Parse-less app branch (§17.1 unification)
- **Source:** Andrew's note from client architecture discussion
- **Scope:** Large, exploratory
- **Context:** Thesis: Parse Templates and Requirements Sets can be unified because Parsing is essentially Evaluation without criteria. A "self-evaluation with unified templates" architecture could replace Parsing entirely.
- **Status:** Explicit future direction per spec §17.1. Implement in V2.3 or later.

### 32. Multi-party agreements
- **Source:** Spec §17.4
- **Scope:** Exploratory
- **Context:** Current Agreements are two-party (grantor + grantee). Client model hints at support for additional participants. Keep `participants[]` array extensible in schemas.

---

## Exploratory Ideas Not Yet Scoped

- Animation refinements — subchain morph, surface shared-element (V2 backlog #3)
- Chain effect flagging — counterfeit parts use case (V2 backlog #35)
- Claim templates — bulk-create Claims across Assets (V2 backlog #28)

---

## Update Log

- 2026-04-18: Initial compilation from V2.2 migration conversation history (Phases 1-4).
- 2026-04-18: Phase 6 — items #10, #21, #22, #23 marked complete.
- 2026-04-19: Phase 6.5 bug-fix pass — added items #34, #35, #36 below for follow-up after migration stabilizes.
- 2026-04-19: Phase 6.5+ visual-review pass — added items #37, #38, #39, #40, #41, #42.
- 2026-04-19: Phase 7 — items #29 (Public Directory Cloud visualization) in-flight as placeholder; added Phase 7+ polish items #43, #44, #45, #46, #47, #48.
- 2026-04-19: Phase 8 consolidation — items #13 (Delete V1 files) and #14 (Delete V2.1-specific code paths) marked ✅ Complete; added Phase 8 polish items #49, #50, #51.
- 2026-04-19: Phase 8.5 bug-fix pass — five bugs fixed (confidence format mismatch, Carol missing from role switcher, white screen at base URL, eval confidence override on human edit, locked split-panel scroll); added polish item #52 for the richer human-validated indicator pattern.
- 2026-04-19: Phase 9A polish pass — items #1, #2, #3, #5, #8 sub-items, #37, #38, #40, #42, #52 all shipped. Card cleanup (item #5 in the visual section) expanded into two-line name wrap + badge spacing + minibar centering.
- 2026-04-19: Phase 9A.1 corrections pass — nine visual-review fixes + one bug fix applied on top of Phase 9A. Name wrap reverted to single-line ellipsis across all node types; card height bumped to 96px; type-badge padding tightened to 4px and margin-bottom bumped to 8px; warmer border bumped 22% → 40% indigo blend (DOM-verified as `rgb(70,78,130)` on unselected cards); counterparty tint strengthened to 55% bg-card + cooler shift via accent-blue; internal edge stroke factor dropped 0.7× → 0.5× with `edge.grantorParty`/`granteeParty` plumbing verified through `deriveAgreementEdges`; edge-endpoint glow replaced with a right-side 3px vertical indigo line (4px offset), edge's own selection brightening restored; status pill width pinned via `minWidth: 96` on the label slot (DOM-verified identical width across SAT/UNSAT/MISSING/N/A); AWAITING AI state removed — every seeded Requirement and PEP Template field now carries `aiValue` + `aiConfidence`, Run Eval + Parse modals pre-populate rows from those values; Full Disclosure single-Asset deselect bug fixed by guarding the priming `useEffect` on `action` change only (was re-priming on `selectedAssetIds` change, which snap-backed deselections).
- 2026-04-19: Phase 9A.1.5 polish pass — five items on top of 9A.1. (1) WARM_BORDER (40% indigo blend) extended to mini and dot LOD renderings — mini cards now match full cards, dots grow a 1px ring so they don't fade into the canvas at zoom-out; red UNSAT borders unchanged. (2) Minibar vertical centering via `marginBottom: 3` on the minibar wrapper — DOM-verified ~11px above / ~13px below (near-symmetric). (3) Status pill `minWidth` bumped 96 → 100 to kill the sub-pixel width flicker when cycling to UNSATISFACTORY — DOM-verified pixel-stable 139.25px across SAT/UNSAT/MISSING/N/A. (4) Edge-endpoint vertical line now renders on the INSIDE edge of each endpoint card (the side facing the partner). V2App's `v22DataWithReveal` memo stamps `_edgeEndpointSide: 'left' | 'right'` based on x-position comparison; AssetNode reads the flag and positions the 3px line at `left: -7` (left side, 4px gap) or `left: CARD_W + 4` (right side). (5) Edge-select pan+zoom framing — new useEffect in V2App keyed on `[selectedEdgeId, v22Data, sel, openAgreement]` computes the union bounding box of the two endpoint cards with 25% padding, target zoom clamped to [0.3, 1.5], and calls `animatedPanToWithZoom` with 600ms duration. Panel-aware: when a Detail Panel is open (sel on non-party node, or edge-agreement panel), the target midX is offset by `panelW/2 / zoom` so the rendered midpoint lands in the centre of the visible canvas area, not the full canvas. Skips edges where either endpoint lacks a world position (Radiant Network pseudo-actor).
- 2026-04-19: Phase 9A.2 — three defect fixes + new Tooltip primitive + app-wide sweep. **Defects:** (1) mini-LOD edge-endpoint indicator — 2px vertical indigo line at 3px offset on the mini card's inside edge, proportional to the full card's 3px/4px. (2) dot-LOD endpoint indicator — hollow 1.5px indigo ring around the dot, 4px wider than the dot's outer edge, suppressed when the dot is selected. (3) Edge brightening on selection regression fix — V2Canvas.jsx:2642 selection useEffect had `[selectedEdgeId]` deps but not the edge-rebuild triggers, so zooming or layer-changing wiped the selected-edge styling. Added `currentLayer.edges` and `zoom` to the deps so the brightening + stroke bump reapplies after every rebuild. **Tooltip primitive:** new `src/components/Tooltip.jsx` — portal-rendered, zero-delay, auto-positions above (flips below on viewport overflow), arrow pointer, `var(--bg-card)` / `var(--border)` / 6px radius / 6px 10px padding / 11px font / max 260px wrap / `pointer-events: none` / z-index 6000. API: `content` (string or JSX, empty → no-op), `position`, `mono`, `width`, `disabled`, `wrapperStyle` (preserves flex children). Wrapper span uses `display: inline-flex` so wrapped buttons/icons keep their layout. **Sweep:** replaced every `title=` attribute on interactive elements (V22NodeDetailPanel FooterButton + HumanEditedIcon; V22RunEvaluationModal HumanEditedIcon + StatusChevronPicker chevrons; V22ParseEvidenceModal HumanEditedIcon + confidence cycle; DisclosureAgreementDetailPanel + EvaluationAgreementDetailPanel amend buttons; CopyBadge in both `shared/CopyBadge.jsx` and `modals/ModalShared.jsx`; AmendClaimModal already-referenced row; AmendDisclosureModal evaluated-locked row; V2App chrome icons — theme toggle, Requirements Library, PEP Template Library, Radiant Network globe, AI Shopper magnifier, "Discovered via Public Directory" notification marker; DirectoryLayer exit-corner node). PortalTooltip in AssetNode.jsx deleted; StackBadge / GlobeBadge / EvidenceClip / ActionButton all now wrap with the shared primitive. `<Section title=...>` and `<ModalHeader title=...>` (component label props, not HTML tooltips) left untouched. **Known gap:** V2Canvas edge hover tooltip (raycaster-driven, cursor-tracking, multi-line rich content) left as-is per the task note that 9B will overhaul edge hover UX; LayerPill's tooltip also untouched since V2.2 never renders child layers. Browser spot-check verified three tooltip sites (chrome globe, Requirements Library icon, FooterButton "Request Agreement") render with `rgb(13,16,23)` background, 6px radius, 6px 10px padding, 11px font — zero delay on hover.
- 2026-04-19 (late): Phase 9A.3 preamble hygiene — added items #53–62 (handoff roster + 9A.2 defect carry-over) plus one new ✅ item (#63) for mini/dot LOD warmer borders; removed 4 unscoped exploratory items (Timeline view, Satellite view, AI-led metadata search, EvA character concept); bumped #33 Transferring from Exploratory to Process Flows (Phase 9A.4 target). Structural: merged Phase 6.5 / 7 / 8 / 8.5 Discoveries sections into categorical homes; numbers preserved, sort by number ascending within each section.
- 2026-04-20: Phase 9A.4 preamble — added items #64–71 (9A.3 QA surfaces + client DOT-badge request); #64 shipped in same session. Two 9A.3 defects fixed in same commit: nested QS picker z-index (surfaces 3 & 4 in QA), dot-LOD endpoint ring alignment (QA 8.1). Item #10 wording tightened to distinguish NEW badge (persists to deselection) from 900ms reveal (initial fade-in animation). Item #62(a) annotated with the 9A.4 follow-on fix (the 9A.3 ring geometry was mathematically correct, but the `data-card-id` wrapper had a 4px line-box offset that shifted the child dot down — wrapper now locked to `width/height: 16, display: flex`).
