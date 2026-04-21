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

### 100. Mini/dot LOD action buttons on hover
- **Status:** ✅ Complete (Phase 9A.6.1 Fix 4). V22ActionBar now renders on hover at mini AND dot LODs, not just full-card LOD. Root cause: AssetNodeMini and AssetNodeDot forwarded only legacy handlers (`onAddEvidence` / `onParseEvidence` / etc.) to their hover-tooltip AssetNode renderings; `onV22CardAction` was missing, so even when the tooltip rendered, V22ActionBar had no dispatcher. Additionally, the tooltip's inner AssetNode was only action-barred when selected. Fix: added `onV22CardAction` prop to both dot/mini components, forwarded to the tooltip card, plus a new `forceActionBar` prop on AssetNode that overrides the internal `isSelected || hovered` check when the tooltip is visible. V2Canvas now passes `onV22CardAction` to both LOD components.

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
- **Status:** ✅ Complete (Phase 9A.6 Gate B). See Process Flows #68 below for completion notes.

### 71. Restore provisional → disclosed card transform animation
- **Source:** Phase 9A.3 QA — existed in V2.1, lost during migration cleanup.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Card-level animation that played when a provisional node transitioned to disclosed (active). Distinct from backlog #9 (edge dashed-to-solid animation) — this is the node-card transform/reveal. Pairing both would give a full-fidelity provisional→active transition. Reference V2.1 backups for the original implementation.
- **Proposed fix:** Reinstate the V2.1 card transform keyframes in `AssetNode.jsx` (or CSS sibling). Trigger on `_showAsProvisional` flipping false after `handleV22Accept`.

### 76. Transfer accept — ownership edge on recipient canvas
- **Status:** ✅ Complete (Phase 9A.5 Gate A). On transfer accept, `handleV22TransferAccept` now emits a replacement ownership DA (`da-own-<assetId>`) with grantor = recipient. Previously the seeded DA still had grantor = sender, so `buildViewForActor` filtered it out of the recipient's view and no Actor → Asset edge derived. `mergeById` in `mergeProvisionals` handles id-based replacement. Runtime-verified against `getV22DataForRole` — pre-fix: null ownership edge; post-fix: `actor-govco → asset-prm-thermal`.

### 83. Claim-to-owner edge redundancy
- **Status:** ✅ Complete (Phase 9A.5 Gate C). Removed the Actor → Claim ownership edge branch from `deriveAgreementEdges`. Ownership cascades through referenced Assets (spec §3.4 requires `referencedAssetIds.length >= 1` on every Claim), so the Actor → Claim edge was visually redundant. Ownership DA stays in state for provenance; it just no longer draws a canvas edge. Verified: Alice's canvas now has 0 Actor → Claim edges.

---

## Detail Panels

### 87. Raw JSON tab on expanded Detail Panel modal
- **Status:** ✅ Verified (Phase 9A.5 Gate C). No code change required. The expanded Detail Panel modal referenced in the original task (an `ExpandedArtifactModal`-style surface with a raw-JSON tab) does not exist in the current V2.2 codebase — it was removed during Phase 8 cleanup. Data layer confirmed correct: `dot.lineage[]` populates properly on transfer accept + decline (verified via `makeDotObject` + `makeTransferRecord` exercise). Lineage rendering in Detail Panels is already tracked separately as #74 (Provenance lineage UI) — that's the surface where the lineage will actually render. When #74 is picked up, the implementer should use `JSON.stringify(asset.dot.lineage, null, 2)` (or an equivalent structured list) to surface lineage entries.

### 89. Actor Detail Panel DOT click-to-copy
- **Status:** ✅ Complete (9A.6 initial; field reference corrected in 9A.6.1). V22ActorPanel DOT row renders `<CopyBadge value={node.partyDot} truncated />`. The initial 9A.6 ship wrote `node.dot`, which Actor nodes don't consistently carry — the party-level DOT lives on `partyDot` (populated via `makeActor` in v2_2Data.js). `actorToNode` in the canvas adapter now surfaces both `dot` (V2.1 compat alias) and `partyDot` (canonical) so either read works.

### 64. Asset DOT / hash / URI click-to-copy badge
- **Status:** ✅ Complete (Phase 9A.4 preamble). Applied `<CopyBadge value={...} truncated />` treatment to three long identifiers on the Asset Detail Panel: owner DOT, file hash, file URI. Matches the PIN treatment used elsewhere in the app. Null-value guard (`value ? <CopyBadge ... /> : '—'`) handles Assets registered via Phase 9A.3's Create Asset flow where `file.hash` is null pending a real hashing implementation. Per spec §3.2 the Asset has no distinct DOT — the file hash is the true per-Asset cryptographic identifier; the "DOT" label on the Asset panel refers to the party-level owner DOT.

### 101. Actor Detail Panel narrative fields cleanup
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Low
- **Context:** V22ActorPanel currently renders Role, Vertical, and User rows under the Party section. These are V2.1 narrative fields that don't carry meaningful information at the party level in V2.2's model (the platform knows parties, not people or roles — see the 9A.5 resolved-box convention). Drop all three from the Actor panel; keep the role label ("buyer" / "seller" / "auditor") in the user-menu role switcher only.

### 103. Referenced Assets missing from Claim Detail Panel on counterparty canvas
- **Source:** Phase 9A.6.1 QA — regression.
- **Scope:** Medium
- **Priority:** **High — functional regression.**
- **Context:** On the counterparty canvas (e.g., Bob viewing Alice's disclosed Claim), the Claim Detail Panel's Referenced Assets section is empty. Related: Run Evaluation modal's evidence list is also empty in the same view. Likely view-builder regression in `buildViewForActor` — counterparty Assets aren't being pulled in for display even when the disclosed Claim references them. **9A.6.2 is the dedicated diagnostic phase for this pair of symptoms.**

### 104. Click-to-jump navigation from Detail Panel association lists
- **Source:** Phase 9A.6.1 QA — V2.1 capability lost in V2.2 migration.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** V2.1 Detail Panels supported clicking a node listed by association (e.g., a Referenced Asset in a Claim panel, an Eval Result in an Asset panel, etc.) to jump the canvas to that node and select it. V2.2 panels render these lists as static text. Restore the click-to-jump pattern: each associated-node item becomes a clickable row that calls the existing pan-to-selection helper (`canvasRef.current?.animatedPanToWithZoom`) and sets `sel`. Affects V22NodeDetailPanel and possibly the Agreement panels too.

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

### 102. Disclosure amendment notifications missing on counterparty side
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** **High — UX confusion.**
- **Context:** When Alice amends a Claim, Bob (counterparty) sees a NEW badge on the amended Claim without any notification context — he has no idea why the badge appeared. `handleV22AmendClaimSubmit` / `handleV22AmendDisclosureSubmit` should fire `v22-amendment` notifications to every counterparty with an active Disclosure Agreement on the affected Claim. Related to the CLAUDE.md "Reciprocal notifications for all party-to-party actions" convention added in 9A.5 — this is one of the known gaps that convention was supposed to cover. *(Filed — to be handled in a dedicated notifications-focused phase.)*

---

## Data Model & Content

### 65. Credit charge for Asset registration + Claim creation
- **Status:** ✅ Complete (Phase 9A.6 Gate A). `CREDITS_PER_ASSET = 5`, `CREDITS_PER_CLAIM = 25` constants in V2App.jsx. `CreditCostRow` shared component in ModalShared (teal on sufficient, red on insufficient). Submit disabled + label flips to "Insufficient Credits" when under-funded. Asset modal charges `CREDITS_PER_ASSET * N` for multi-file batches. Other V2.2 flows (ParseEvidence / RunEvaluation / CombinedRequest) remain free per client model.

### 70. Asset hierarchy — Asset-from-Asset registration
- **Source:** Phase 9A.3 QA — surfaces supply-chain / Program modelling needs. #84 consolidated into this item in 9A.5 (V1-era "register an Asset off another Asset" pattern is the same requirement in a different vocabulary).
- **Scope:** Medium
- **Priority:** **Blocked on design decision**
- **Context:** Enables structures like "Sentinel-4 Program" as a parent Asset with sub-Assets (individual modules, subsystems, mission-critical items). Today Assets are flat — all siblings under the Actor. Hierarchy would let users model Programs / Missions / supply chains with first-class parent→child Asset relationships. Concrete UX requirement from V1-era behaviour: a user should be able to open an existing Asset's panel and register a new Asset "beneath" it (the child Asset inherits the parent relationship automatically).
- **Design decision needed before build.** Three candidate models:
  - (a) Add `parentAssetId` field to Asset schema (spec §3.2 extension). Canvas renders parent-first, child indented. Query: all Assets with this parent.
  - (b) View-layer grouping only — no data-model change. Assets stay flat in storage, but the view builder groups them by `asset.metadata.parentAssetId` if present. Minimal blast radius.
  - (c) New edge type: `ParentAsset` edge. Fits the existing "everything is an edge" principle. Requires edge-derivation + rendering work.
- **Andrew to choose before scoping implementation.**

### 82. Parse Result DOT + layer placement
- **Source:** Phase 9A.5 planning — deferred due to missing architectural decision.
- **Scope:** Medium
- **Priority:** **Design blocker**
- **Context:** Parse Results today are parent-layer nodes without a DOT (only Assets, Claims, and Eval Results carry `dot` per spec §2.6). Open questions: (a) should Parse Results also have DOTs (would make them first-class identity-anchored artifacts, enabling Parse Result transfer + provenance lineage)? (b) should Parse Results live on a child layer under their source Asset rather than the parent layer (they're always derived, never standalone)? Both questions blocked on client decision — DOT semantics touch canon X.1–X.10 and layer placement touches the canvas density story.

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
- **Status:** ✅ Complete (Phase 9A.6 Gate B). V22CreateAssetModal rebuilt as a 3-step flow: Pick → Per-file review → Final review. Picker runs in `mode="multi"`; each selected file becomes its own Asset. Nested callers (V22CreateClaimModal + AmendClaimModal) receive array of new Asset ids and auto-select all N in their picker. Single-file is just N=1 — no separate code path.

### 67. Local-storage upload tab in QS picker
- **Status:** ✅ Complete (Phase 9A.6 Gate B). V22QualifiedStoragePicker gains a tab header: Qualified Storage | Local Storage. Local tab renders a drag+drop zone + file input, simulates upload (500–800ms per file with per-row progress bar), then the uploaded files are selectable alongside QS picks. On confirm, both sources merge into the payload. Mock URI synthesized under `{bucket}/uploads/{filename}`; file bytes are not actually stored (demo-only).

### 68. Hashing / processing sequence UI per file
- **Status:** ✅ Complete (9A.6 initial; reconciled with V2.1 pattern in 9A.6.1). Each file row now plays a three-state sequence — `pending` (queued) → `hashing` (amber "Hashing file..." + spinner, ~1000ms) → `endorsing` (blue "Endorsing on ledger..." + spinner, ~1200ms) → `done` (green ✓ "Hashed" + truncated CopyBadge with mock sha256). Multi-file stagger: 600ms between files so animations are visibly offset, matching V2.1's AddEvidenceModal parallel-staggered pattern. Hashes deterministic from `filename+size`. Continue disabled until every row reaches `done`.

### 69. User-editable Asset label
- **Status:** ✅ Complete (Phase 9A.6 Gate B). Each per-file row in V22CreateAssetModal renders an editable text input pre-populated with the filename-stem derivation. 100-char max, trimmed on submit. Empty label turns the input border red and blocks Continue. Value flows through `makeAssetRegistrationArtifacts`'s `name` param. Spec §3.2 updated to document `asset.name` as the user-facing display name with filename-stem default.

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
- **Status:** ✅ Complete (Phase 9A.4). Asset transfer flow with recipient acceptance shipped. V22TransferAssetModal drives a 2-step flow (Recipient + Note → Review); PIN resolution catches self, Radiant Network, and unknown PINs; on submit a provisional transfer lands on `v22Provisionals.transfers` and the sender's Asset renders a TRANSFERRING badge. Recipient receives a `v22-transfer-request` notification with inline Accept / Decline actions; Accept flips `asset.dot.ownerDid` to the recipient, appends an accepted transfer record to `asset.dot.lineage[]`, and materialises the Asset on the recipient's canvas with pan-to + NEW badge. Decline appends a declined transfer record (with optional reason) to the Asset's lineage without changing ownership. Sender receives a status notification (`v22-transfer-accepted` or `v22-transfer-declined`) in either case. Cancel-while-pending clears the provisional and dismisses the recipient's notification via `v22-transfer-cancelled` (no ledger record — per spec §11.7).
- **Known limitations carried to backlog:**
  - Claims and Eval Results are not yet transferable — backlog #72.
  - Asset-as-evidence-backing constraint not enforced; transferring an Asset that backs a disclosed Claim is permitted in demo but flagged — backlog #73.
  - Provenance lineage UI not yet surfaced in Detail Panels — backlog #74.
  - Transfer timeout not implemented; pending transfers stay pending indefinitely — backlog #75.

### 72. Extend Transferring to Claims and Eval Results
- **Source:** Phase 9A.4 — Assets-only scope limitation.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Canon X.5 applies uniformly across data elements; the UI patterns from Asset transfer (V22TransferAssetModal + notification Accept/Decline + `dot.lineage` append) should port directly to Claims and Eval Results. Open questions: does a Claim transfer bring its `referencedAssetIds[]` Assets along, or just the Claim? Does an Eval Result transfer require co-signing by the Claim owner (since the Eval Result is entangled with the Claim lineage)?

### 73. Transfer constraint — Asset backing a disclosed Claim
- **Source:** Phase 9A.4 — known limitation.
- **Scope:** Small
- **Priority:** Medium
- **Context:** Today an Asset can be transferred even if it's the sole evidence backing an active Claim disclosed under an inter-party Disclosure Agreement. The counterparty's view would then show a Claim referencing an Asset that's no longer the Claim owner's to disclose. Options: (a) block the transfer with a hard error, (b) render a warning in the transfer review step listing the affected DAs and require acknowledgment, (c) force the Claim to auto-revise (drop the transferred Asset from `referencedAssetIds[]`) on transfer completion. Client decision needed.

### 74. Provenance lineage UI in Detail Panels
- **Source:** Phase 9A.4 — `dot.lineage[]` is populated correctly but not yet visualised.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Every Asset, Claim, and Eval Result now carries `dot.lineage[]` — an append-only chronological list of state transitions (transfers so far; registration events in a later phase). Surface this in a new "Provenance" section on each Detail Panel: chronological list of entries (timestamp + from DID + to DID + status + optional reason). Filed under Detail Panels if moved.

### 75. Transfer timeout
- **Source:** Phase 9A.4 — recipient inaction creates an indefinite pending state.
- **Scope:** Small
- **Priority:** Low
- **Context:** Demo behaviour: pending transfers stay pending until the recipient accepts / declines or the sender cancels. Real implementation would need a configurable timeout (e.g., 14 days) after which pending transfers auto-decline. Also: a UI cue in the sender's TRANSFERRING badge showing days-until-timeout.

### 77. Transfer accept/decline response modal
- **Status:** ✅ Complete (Phase 9A.5 Gate B). New `V22TransferResponseModal.jsx` replaces the inline notification Accept/Decline buttons + decline-reason textarea. Matches the established V2.2 convention (notification is the entry point; the decision happens in a modal following `CombinedResponseModal`). Two phases: Decide → Reason (decline path only). Removed `v22DecliningTransfer` state and the inline UI blocks from the notification row. Spec §11.7 updated accordingly.

### 78. Transfer modal "Resolved" box shows party only
- **Status:** ✅ Complete (Phase 9A.5 Gate B). `V22TransferAssetModal`'s resolved-recipient chip now shows "Resolved: {party}" only — not "{user} @ {party}" + role. The platform knows parties, not people or roles. Review-step InfoRow also updated. CombinedRequestModal's resolution chip was already party-only.

### 79. PIN resolution error messaging split
- **Status:** ✅ Complete (Phase 9A.5 Gate B). `V22TransferAssetModal` now surfaces three semantically distinct messages for PIN resolution failures: (self) "You cannot transfer an Asset to yourself."; (Radiant Network) "Assets cannot be transferred to the Radiant Network."; (unknown) "No actor was found at this PIN. Check the recipient and try again." Self + Radiant Network cases are safe to message specifically because they're about the sender's own data; the unknown case stays generic to preserve the no-info-leak principle.

### 80. Accepted-transfer animation sequence on both canvases
- **Source:** Phase 9A.5 planning — deferred. Pairs with #71 and the broader animation-restoration phase.
- **Scope:** Medium–Large
- **Priority:** Medium
- **Context:** On transfer accept, the recipient-side reveal (pan-to + NEW badge) works; the sender-side UX is abrupt — the Asset vanishes from the sender's canvas without a retreat animation. Target: choreographed sequence on both canvases — sender canvas shows the Asset fading out with a short "transferred" micro-animation; recipient canvas shows the Asset arriving with a reveal pulse. Inventory V2.1 backup animations before rebuilding; there may be reusable patterns from V2.1's provisional → disclosed transform (#71) and the acceptance reveal path.

### 81. Reciprocal acceptance notification audit
- **Source:** Phase 9A.5 planning — pairs with animation work (#80). Explicit known gap: Disclosure Request acceptance doesn't currently notify the requester; the notification is the trigger for the provisional → whole-node transformation animation (#71).
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Inventory every party-to-party action that should reciprocally notify (Disclosure accept, Disclosure decline, Amend Claim, Amend Disclosure, Run Evaluation, Cancel Request, Transfer accept/decline/cancel, etc.) and verify each fires both directions. CLAUDE.md now codifies this as a convention ("Reciprocal notifications for all party-to-party actions") so new work should comply; this audit item closes the gap for existing flows. Known missing: Disclosure Request accept fires to grantee only (via `handleV22Accept`), not back to requester.

### 34. Register new Asset during Amend Claim flow
- **Status:** ✅ Complete (Phase 9A.3 Gate B). V22CreateAssetModal is the V2.2 Asset-registration flow. AmendClaimModal and V22CreateClaimModal both expose an inline "+ Register new Asset…" CTA that opens V22CreateAssetModal nested; on submit V2App builds the Asset via `makeAssetRegistrationArtifacts`, returns the new id to the parent modal, and the parent auto-selects it in its picker. Nested modal sits on its own backdrop so the parent stays dimmed until the user either cancels or completes.

### 37. Full Disclosure last-Asset deselect handling
- **Status:** ✅ Complete (Phase 9A). Deselecting all Assets no longer snaps back; an amber italic inline help line ("Select at least one Asset to continue.") renders beneath the count footer when the selection is empty. Continue button stays disabled (existing behaviour).

### 85. Disclosure Request Response + all Asset pickers: zero-default + scroll
- **Status:** ✅ Complete (Phase 9A.5 Gate C). `CombinedResponseModal`'s Full-disclosure Asset picker now defaults to zero selected (was priming all referenced Assets on step entry). Scroll container already present (`maxHeight: 260, overflowY: 'auto'`). Amber inline help text + disabled Continue unchanged. Audited peer pickers: `V22CreateClaimModal` already zero-default (or 1-preselect when opened from an Asset), scroll container present. `AmendClaimModal` already zero-default (additions-only), scroll present. `AmendDisclosureModal` pre-selects current scope intentionally — amendment semantics require that baseline. `V22RunEvaluationModal`'s evidence picker pre-selects all evidence but evidence is optional (self-attestation), so kept. `V22ParseEvidenceModal` single-select for templates — default-first is acceptable.

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

### 90. Notification bell tooltip persistence
- **Status:** ✅ Complete (Phase 9A.6 Gate C). Tooltip state persisted when `shouldRender` transitioned to false — V2App nulls the bell tooltip content while the inbox is open, the wrapper span unmounts (so mouseleave never fires) but `visible` stayed true. When content reappeared the tooltip popped back without a fresh hover. Fix: effect that clears `visible` when `shouldRender` becomes false, plus mousedown on the wrapper clears `visible` synchronously so clicking the bell dismisses the tooltip as expected.

### 91. Parse Template picker scroll box
- **Status:** ✅ Complete (Phase 9A.6 Gate C). V22ParseEvidenceModal's template list now renders inside a scroll container (`maxHeight: 300, overflowY: 'auto'`), matching the CLAUDE.md picker convention. Audited V22RunEvaluationModal's Requirements Set picker concurrently — applied same treatment. Other pickers (V22CreateClaimModal, AmendClaimModal, AmendDisclosureModal) already scroll.

### 88. Transfer cascade — Parse Results and dependent Claims on sender side
- **Source:** Phase 9A.5 QA — data integrity concern from 9A.4.
- **Scope:** Medium
- **Priority:** **Medium — data integrity**
- **Context:** When an Asset transfers out, its Parse Results orphan on the sender's canvas (should transfer with the Asset — they're derivatives per canon). Claims referencing only the transferred Asset are broken (need user decision in the transfer review step — warn / auto-revise to drop reference / block). Related to #73 (transfer constraint on disclosed Claims) but distinct: #73 is about the counterparty's visibility of disclosed Claims post-transfer, #88 is about the sender's own orphaned derivatives and broken Claim references.

### 94. QS picker preview pane multi-select summary
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** When multiple files are selected in the QS picker, the right-hand preview pane currently only shows the first-clicked file. For multi-select flows, replace the single-file preview with a summary: count ("3 files selected"), date range ("2026-03-10 to 2026-03-20"), aggregate total size, and a generic multi-doc icon. Keeps single-select behaviour unchanged.

### 95. QS picker re-add files preserves custom labels
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** In the Asset registration per-file review step, clicking "+ Add more files…" re-opens the picker. If the user already edited a custom label on an existing row, the current logic replaces the row set entirely on re-pick — labels reset to filename-stem defaults. Fix: merge the new picks into the existing row list (preserving `label` for rows whose file is re-picked, and appending new rows for newly-picked files). Removed files should still be removable via the ✕.

### 96. Local Storage tab: indicate destination folder for uploads
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Low
- **Context:** Local Storage uploads synthesise a URI under `{bucket}/uploads/{filename}`. Surface a small informational chip near the drop zone: "Uploading to s3://{bucket}/uploads/" so the user understands where the file "goes" after upload. Informational only — not full file-manager UX.

### 97. Local Storage uploads default-checked + Select All toggle
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** Local-uploaded files currently require the user to explicitly check each one before confirming. When someone drops 10 files, ticking each is friction. Default-check newly-uploaded files on upload complete, and expose a Select All / Deselect All toggle between the drop area and the file list. Matches `mode="multi"`'s QS picker toggle-all affordance.

### 98. Credit warning copy + add-credits modal link
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** When credits are insufficient, the CreditCostRow shows "Only 0 available" in red. Replace with "0 available" (drop the "Only") plus a small "Add credits →" link that opens a separate modal (layered above the current modal, on its own Backdrop). The sub-modal would offer demo credit grants (reuse V2App's existing +100 / reset credits affordances). Keeps the user in the Register/Claim flow rather than forcing a cancel-retry loop.

### 99. Create Claim picker: pre-selected + newly-registered Assets at top with NEW badges
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** In V22CreateClaimModal's Asset picker, pre-selected Assets (via `initialAssetIds` or nested Register auto-select) should float to the top of the list with a NEW badge so they're obvious. Clear the NEW badge after the user goes through a select-then-deselect cycle (confirming they've seen and considered the Asset). Pairs with the nested Register flow — freshly-created Assets land ticked but currently get lost in the full Asset list.

### 105. Run Evaluation modal: empty-evidence copy update
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Context:** When a Claim has no evidence (no referenced Assets or no parseable content), the Run Evaluation modal's evidence pane shows a generic empty state. Split by role: owner: "There is no evidence associated with this Claim. Add evidence to self-evaluate."; non-owner: "There is no evidence associated with this Claim. Ask the owner of this Claim to add evidence to evaluate." Surfaces the right next step.

### 106. Remove evidence picker from Run Evaluation modal
- **Source:** Phase 9A.6.1 QA — larger design question.
- **Scope:** Medium
- **Priority:** Medium
- **Context:** Evaluations are Claim-level, not Asset-level. Bob evaluates the Claim against requirements; all in-scope evidence is automatically included. When Alice amends the Claim (adds/removes Assets), Bob's evaluation is marked stale and re-runs against ALL evidence — no partial/selective combinations. Proposal: remove the evidence picker from V22RunEvaluationModal entirely; the modal becomes a review-rows-only surface. Pairs with #88 (transfer cascade) — both deal with Claim-vs-evidence boundary semantics and should be scoped together.

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

### 86. DID glossary entry in architecture-spec.md §2.6
- **Status:** ✅ Complete (Phase 9A.5 Gate C). §2.6 now expands DID on first use: "Decentralized Identifier (DID) — a W3C-standardized format for verifiable digital identities" with a link to [w3.org/TR/did-core/](https://www.w3.org/TR/did-core/).

### 93. Transfer file custody semantics (Model 1 pointer vs Model 2 replication)
- **Status:** ✅ Spec note shipped (Phase 9A.6.1 Fix 5). architecture-spec.md §11.7 now documents the prototype's working assumption: replication model — on accept, the file is independently held in each owner's qualified storage, both copies hashing identically. The alternative pointer model is acknowledged as cryptographically valid but operationally fragile. Design conversation pending with client to confirm production semantics.
- **Source:** Phase 9A.6.1 QA — arose from "how does the file actually move on transfer?" question.
- **Scope:** Small (spec note shipped; implementation follow-up is a future phase).
- **Priority:** Low (documentation complete; implementation implications can wait).

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
- 2026-04-20: Phase 9A.4 main — Transferring process shipped (Assets only); structured DOT data model added (`makeDotObject`, `makeTransferRecord`) with backward-compat aliases on existing factories; 7-process demo complete. Backlog: #33 ✅ Complete; added #72 (Claim + Eval Result transfer), #73 (transfer constraint on disclosed Claims), #74 (provenance lineage UI), #75 (transfer timeage). Runtime verified: Alice → Bob accept path + Alice → Carol decline path + sender cancel path + PIN resolution rejecting self / Radiant Network / unknown.
- 2026-04-20: Phase 9A.5 — fast-follower polish after 9A.4 demo completion. Eight items shipped (#76 transfer accept ownership edge, #77 transfer response modal, #78 resolved-box party-only, #79 PIN error split, #83 Claim-owner edge removal, #85 Asset-picker zero-default, #86 DID glossary, #87 raw-JSON tab verified); four items filed for future phases (#80 accepted-transfer animation, #81 reciprocal notification audit, #82 Parse Result DOT + layer placement, plus #84 consolidated into #70). Three cross-cutting UX conventions added to CLAUDE.md (accept-in-modal, picker-defaults + scroll, reciprocal notifications). Demo-blocking transfer accept edge regression resolved in Gate A.
- 2026-04-20: Phase 9A.6 — Asset registration batch. Shipped #65 (credits: `CREDITS_PER_ASSET = 5`, `CREDITS_PER_CLAIM = 25`, CreditCostRow shared component), #66 (multi-file Asset registration — 3-step flow with per-file rows, nested callers auto-select all N), #67 (Local Storage tab in QS picker with mock upload simulation), #68 (hashing sequence per file — 900ms rotating spinner + hex dance, deterministic mock sha256, spec §3.2 updated for `asset.name`), #69 (editable per-file label), #89 (Actor DOT CopyBadge), #90 (notification bell tooltip persistence — effect clearing `visible` when `shouldRender` goes false + mousedown dismissal), #91 (Parse Template + Requirements Set picker scroll). Filed #88 (transfer cascade — Parse Results + dependent Claims on sender side — data integrity concern from 9A.5 QA). No V2.1 HashingSequence reference file was placed before the phase; visual/timing pattern-matched to V2.2 processing UIs.
- 2026-04-20: Phase 9A.6.1 — corrective fixes after 9A.6 QA. Five fixes shipped: multi-file NEW badge regression (Fix 1 — reveal-id state extended to array form, all N assets now flagged), Actor DOT row empty (Fix 2 — V22ActorPanel now reads `node.partyDot`; actorToNode also exposes `partyDot` as a canonical alias), hashing sequence reconciled against V2.1's AddEvidenceModal (Fix 3 — three-state machine amber `Hashing file...` → blue `Endorsing on ledger...` → green ✓ `Hashed` + hash badge, 600ms stagger across files), mini/dot LOD action buttons on hover (Fix 4 — `onV22CardAction` now forwarded through both LOD components; new `forceActionBar` prop on AssetNode), transfer file custody spec note in architecture-spec.md §11.7 (Fix 5 — replication model documented as prototype assumption). Filed 14 new items #93–106 from 9A.6 QA surfaces. Items #68 and #89 retain ✅ Complete status with revision notes.
