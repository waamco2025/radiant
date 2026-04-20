# V2.2 Polish Backlog

Running list of refinements, enhancements, and UX adjustments identified during V2.2 migration work. Intended to be addressed in a dedicated polish phase after Phase 7 is complete and the V2.1 code paths are deleted.

Claude Code: update this file as new items are identified during migration work. Do not address any item on this list during the migration itself unless it gates a Phase's acceptance criteria.

Each item includes:
- **Source** — which phase or conversation surfaced it
- **Scope** — rough effort estimate (Small / Medium / Large)
- **Depends on** — prerequisites, if any

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
- **Status:** ✅ Complete (Phase 6 carry-over fix). `_isNew` is now set in the adapter for the entire provisional duration; `setV22PanToClaimId` pans to the new provisional Claim on the requester's canvas.

---

## Detail Panels

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

---

## V1 File Cleanup

### 13. Delete V1 files
- **Status:** ✅ Complete (Phase 8). `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/ia-map-entry.jsx`, `src/data/`, `src/reference/`, and every `src/components/*.jsx` file outside `modals/` and `DetailPanel/` removed. `index.html` deleted. `vite.config.js` updated to drop the `main` input.

### 14. Delete V2.1-specific code paths
- **Status:** ✅ Complete (Phase 8). `V2_2_ENABLED` flag removed from `v2_2Data.js`. All 23 conditional sites in `V2App.jsx` collapsed. 13 V2.1 modal files deleted (`RequestDisclosureModal`, `DisclosureResponseModal`, `ReviseDisclosureModal`, V2.1 `RunEvaluationModal`, V2.1 `ParseEvidenceModal`, `RegisterAssetModal`, `AddEvidenceModal`, `CascadeModal`, `UpstreamPicker`, `CreateClaimModal`, `QualifiedStoragePicker`, `RevocationNoticeModal`, `PublishModal`). 10 V2.1 DetailPanel files deleted (`index.jsx`, `PanelShell.jsx`, `ChildrenTab.jsx`, `DisclosuresTab.jsx`, `EvalPanel.jsx`, `EvaluationsTab.jsx`, `EvidenceBlock.jsx`, `ParsedFieldsTab.jsx`, `ClaimsTable.jsx`, `constants.js`) plus all of `shared/` except `CopyBadge.jsx`. V2.1 merge pipeline in `V2App.jsx` (~270 lines) removed along with the V2.1-only state fields (`addedNodes`, `addedSDAs`, `addedEdges`, `addedChildren`, `removedSDAs`, `removedNodes`, `removedEdges`, `newlyDisclosedIds`). Bundle dropped from 638 kB → 345 kB (46% shrinkage).

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

---

## Process Flows

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

### 33. Transferring process (ownership transfer)
- **Source:** Spec §17.2
- **Scope:** Medium
- **Context:** Seventh process defined in the platform model but out of scope for V2.2 migration. Produces a new DOT (ownership token) that supersedes the previous owner's DOT on an Asset or Claim.

---

## Exploratory Ideas Not Yet Scoped

- Animation refinements — subchain morph, surface shared-element (V2 backlog #3)
- Timeline view — linear chronological view of events (V2 backlog #4)
- Satellite view — child nodes growing outward (V2 backlog #5)
- Chain effect flagging — counterfeit parts use case (V2 backlog #35)
- AI-led metadata search across public directory (V2 backlog #36)
- EvA character concept (V2 backlog #26)
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

---

## Phase 6.5 Discoveries (added during bug-fix pass)

### 34. Register new Asset during Amend Claim flow
- **Source:** Phase 6.5 #9 review — when the Amend Claim modal shows "no Assets available," the user must back out, register a new Asset elsewhere, then re-open the modal.
- **Scope:** Medium
- **Context:** AmendClaimModal currently only lists Assets the user already owns that aren't already referenced. There's no inline path to register a new Asset and immediately add it.
- **Proposed fix:** Add a "Register new Asset…" CTA inside AmendClaimModal that opens the (yet-to-be-built V2.2) CreateAssetModal as a nested modal; on successful registration, append the new Asset id to the modal's `selected` set and close the nested modal.

### 35. Edge-draw animation for new Amend Claim references
- **Source:** Phase 6.5 #12 review — when an amendment adds new Asset references, the new claim ↔ asset edges appear without animation.
- **Scope:** Small
- **Context:** Existing `_isNew` flag drives node reveals; needs an analogous edge-level signal so newly-derived edges from amendment also draw with V2Canvas's existing edge-draw animation pattern.
- **Proposed fix:** Tag the new claim-ref DAs with `_isNew: true` in the amendment factory output; have the canvas adapter pass that flag through to the derived edges; V2Canvas already animates edges with `_isNew` (see Phase 4 reveal infrastructure).

### 36. Option B — view builder pulls disclosed Assets onto grantee canvas
- **Source:** Phase 6.5 #5 — chose Option A (resolve evidence Assets from shared dataset in the eval modal) as the smaller change. Option B is the architecturally consistent counterpart.
- **Scope:** Medium
- **Context:** Today, counterparty Assets in scope of an active inter-party DA aren't pulled onto the grantee's canvas (only the Claim is, per §6 pull-in semantics). The eval modal works around this by resolving Assets directly from the shared dataset. Bob can't see the in-scope Assets on his canvas — he sees them only inside modals/panels.
- **Proposed fix:** Update `buildViewForActor` to also pull in Assets named in `da.scope.assetIds` for active inter-party DAs where the actor is grantee. Re-evaluate canvas density after; may pair with item #4 (Layout density improvements). Once landed, revert the Option A workaround in V2App's eval-modal mount (Phase 6.5 commit) and let the filter at line ~2680 work as-is.

### 37. Full Disclosure last-Asset deselect handling
- **Status:** ✅ Complete (Phase 9A). Deselecting all Assets no longer snaps back; an amber italic inline help line ("Select at least one Asset to continue.") renders beneath the count footer when the selection is empty. Continue button stays disabled (existing behaviour).

### 38. Run Evaluation review-stage UX improvements
- **Status:** ✅ Complete (Phase 9A). Three sub-items shipped: (1) `StatusChevronPicker` renders ◂ SATISFACTORY ▸ with full words, left chevron cycles back, right chevron + word cycle forward; (2) on supersede / re-evaluate, rows pre-populate `value`, `status`, AND `confidence` from the prior result (was hard-coded 0.9); (3) every row renders a confidence chip — null confidence shows `AWAITING AI` instead of the previous "chip missing" state.

### 39. Decline dismiss "ravel-out" animation
- **Source:** Phase 6.5+ #2 / #3 review
- **Scope:** Small
- **Context:** Dismissing a declined Claim removes it instantly from Bob's canvas. A short ravel-out animation (border collapse + edge fade) would communicate "this is going away" instead of a hard cut.

### 40. Node card action button reassessment post-migration
- **Status:** ✅ Complete (Phase 9A). V2.2 nodes route through a new `V22ActionBar` component that mirrors the Detail Panel footer one-to-one per type: ASSET (owner) → Request Agreement + Parse Evidence + Create Claim; CLAIM (owner) → Amend Claim + Self-Evaluate; CLAIM (non-owner + active EA) → Run Evaluation; EVAL RESULT (owner, not superseded) → Re-run Evaluation; PARSE RESULT / ACTOR → none. Single dispatch prop `onV22CardAction(actionName, node)` routes from card click → V2Canvas → V2App's action handlers, the same handlers V22NodeDetailPanel's footer fires. Legacy V2.1 ActionBar is retained as fallback for non-V2.2 nodes.

### 41. PDF file viewer in Run Evaluation processing/review stages
- **Source:** Phase 6.5+ #2 follow-on
- **Scope:** Medium
- **Context:** The Parse modal's evidence side currently shows file metadata only; the Run Eval modal does the same. A real (or stub) PDF viewer in the left split-pane would let evaluators read the evidence as they assess each row. Could reuse a lightweight PDF.js viewer.

### 42. "Re-Evaluate" entry point on existing Eval Result nodes
- **Status:** ✅ Complete (Phase 9A). V22EvalResultPanel's "Re-run Evaluation" footer button (owner, not superseded) now opens `V22RunEvaluationModal` with `lockedRequirementsSetId` set to the prior result's Req Set id. The modal renders a LOCKED card (indigo border, LOCKED pill, "To change Requirements Set, start a new evaluation from the Claim." explainer) instead of the picker. Evidence selection remains free; on submit the standard supersede rules apply. The prior result is also passed as `priorActiveResult`, which pre-populates review rows with the prior values/status/confidence (see item #38).

---

## Phase 7 Discoveries (Directory Layer + AI Shopper)

### 43. Clickable Directory Layer dots
- **Source:** Phase 7 scope boundary (spec §8.2 — "visual density only in V2.2")
- **Scope:** Medium
- **Context:** Each dot is backed by a public-directory Claim artifact already, so per-dot interactivity is a pure wiring task: on hover show the Claim name + owner + posted date; on click open a read-only preview panel with a "Request Agreement" CTA. Architecturally the dot data should come from a view builder helper (not hard-coded) so the three mock supplier clusters disappear once more real parties exist.

### 44. Radiant Network Actor node on owner canvas
- **Source:** Phase 7 gap — spec §3.6
- **Scope:** Small
- **Context:** §3.6 says the Radiant Network node appears on the user's canvas only if they have Claims publicly disclosed. On Alice's canvas today we derive the public-directory edges correctly but do NOT add a Radiant Network Actor node to the view. Add `isPublicDirectory` pseudo-actor to `buildViewForActor` when the actor has any DA where grantee.party === 'Radiant Network'.

### 45. Real dot-cloud data sourcing
- **Source:** Phase 7 placeholder implementation
- **Scope:** Medium
- **Context:** The three mock supplier clusters (ElectroGrid Ltd, NovaFab Inc, Precision Components Co) are visual-only. Replace with (a) real counts derived from any actor in the dataset with public-directory DAs, and (b) a realistic number of other parties once demo data grows. Also: the current random-seeded positions should transition to a force-directed or stratified layout at scale.

### 46. Corner-node morph on Directory entry/exit
- **Source:** Spec §8.1 — unimplemented in Phase 7
- **Scope:** Medium
- **Context:** Spec calls for the Radiant Network chrome button to morph mid-animation into the Directory Layer's corner anchor node (and vice versa on exit). Currently the two are visually distinct: the chrome icon stays in place, and the corner anchor fades in via the clip-path wipe. A continuous transform (translate + scale + shape interpolation) would sell the "one animation, not two" principle more convincingly.

### 47. Real AI Shopper result streaming
- **Source:** Phase 7 placeholder implementation
- **Scope:** Large
- **Context:** The mock agent returns results in a single 2.2s batch. A real LLM-backed shopper would stream candidates as the search runs. Keep the split-screen pattern, but let rows appear one at a time with a short delay, each with a per-row confidence score that updates as more context is gathered. UI shape is already designed to absorb this — `results` array just needs incremental append instead of single assignment in `runMockSearch`.

### 48. Candidate preview before Request Agreement
- **Source:** Phase 7 scope boundary (spec §9)
- **Scope:** Small
- **Context:** Spec §9 lists "View a Claim's public-directory Detail Panel (owner, description, posted date, aggregate stats)" as a capability. Currently the candidate card jumps straight to Request Agreement. Add a secondary "Preview" CTA that opens a read-only panel showing what's publicly disclosed about the Claim (respecting the public DA's scope).

---

## Phase 8 Discoveries (post-consolidation)

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

## Phase 8.5 Discoveries

### 52. "Human-validated" indicator on Eval/Parse review rows
- **Status:** ✅ Complete (Phase 9A item 10). `_aiOriginalValue` snapshot tracked per row from initialization (set to the AI's extracted value, or empty string for fresh rows). When `row.value !== row._aiOriginalValue` the modal + Detail Panel render a small amber pencil SVG next to the ConfidenceBadge with the tooltip "Human-edited from AI's original extraction." Persisted onto the submitted Parse Result `fields` and Eval Result `results` so the Detail Panel can render the pencil later. AI confidence remains unchanged by human edits (the Phase 8.5 rule).
