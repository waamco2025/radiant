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
- **Status:** ✅ Complete (Phase 9E-parallel initial approach → 9E-parallel.1 correction, commit 7d03982). Initial 9E-parallel approach lowered background opacity at base depth — wrong direction per Andrew's feedback: background matrix is intentional visual infrastructure and should stay at full brightness. 9E-parallel.1 corrected: restored uniform background opacity across all depths (0.28 dark / 0.32 light); brightened AssetNodeDot inner-circle ring stroke 1px → 1.5px and color `WARM_BORDER` (40% indigo blend) → `color-mix(in srgb, var(--accent-indigo) 70%, var(--border))`. Grid alignment was already in place via the existing `snapToGrid` function — no alignment work required. Contrast between nodes and background is now carried by the node dot's ring, not by dimming the background.

### 63. Mini/dot LOD warmer borders
- **Status:** ✅ Complete (Phase 9A.1.5). `WARM_BORDER` (40% indigo blend) extended to mini and dot LOD renderings — mini cards now match full cards; dots grow a 1px indigo ring so they don't fade into canvas at zoom-out. Red UNSAT borders unchanged.

### 100. Mini/dot LOD action buttons on hover
- **Status:** ✅ Complete (9A.6.1; reverted to click-only behavior in 9A.6.1.1 — hover-to-show was visually present but impractical as the pointer couldn't reach the buttons before they dismissed). Action bar renders at mini/dot LODs on node selection, matching full-card LOD behavior. `onV22CardAction` threading through AssetNodeMini + AssetNodeDot from 9A.6.1 is retained — that plumbing remains needed for click-selected action bar dispatch. The `forceActionBar` prop on AssetNode was removed.

### 108. Missing Amend Evaluation Agreement modal
- **Source:** Phase 9A.6.2 QA — Andrew noticed no modal exists for amending EAs.
- **Scope:** Medium.
- **Priority:** Medium.
- **Context:** `AmendDisclosureModal` exists (shipped Phase 6) but the EA-amendment counterpart was apparently not built. User can amend a DA via its edge → Amend affordance, but no equivalent path exists for EAs. Not strictly demo-blocking — users can work around by creating a new EA — but incomplete relative to the DA pattern.
- **Proposed fix:** Pattern-match `AmendDisclosureModal.jsx` into a new `AmendEvaluationAgreementModal.jsx`. Wire the Amend action from EA edges and from EA Detail Panel footers (matching DA parity).

### 107. Border shorthand vs. longhand style warning
- **Status:** ✅ Complete (Phase 9E-parallel, commit b29fdc9). Original diagnosis was "shorthand `border:` paired with a side-specific longhand like `borderTopColor`." Code audit during 9E-parallel found no such pattern in AssetNode.jsx. **Actual root cause:** React's style reconciler has trouble tracking `border-color` transitions when the border is set via shorthand `border: ...`. The warning fires because React updates the border across frames but can't consistently determine which color to apply. Fix: convert every shorthand paired with a `transition: border-color` to longhand (`borderWidth` + `borderStyle` + `borderColor`). Four call sites fixed in AssetNode.jsx: full-card selection border, full-card main div, mini selection border, mini main div. Dot-card borders and other static non-transitioning borders left as shorthand.

### 110. Edge glow + marching-ants animations (V2.1 restoration)
- **Source:** Phase 9B deviation — these effects existed in V2.1 but don't exist in V2.2.
- **Scope:** Medium.
- **Priority:** Medium.
- **Context:** V2.1 had two persistent edge animations: a glow effect on Full Disclosure edges, and marching-ants (animated dashed line) on Selective, Proof-only, and Provisional edges. Both effects were lost during V2.2 migration cleanup. Both should persist through selection state (additive brightening on top, not replacing). Reference V2.1 backups for original implementation.
- **Proposed fix:** Port the V2.1 edge-animation logic to V2Canvas.jsx. Glow likely a Three.js shader or post-processing effect; marching-ants is a stroke-dashoffset animation. Ensure both additively compose with selection brightening (+1.5px stroke, 65% white blend from 9A.1) and with Phase 9B's 30% hover brightening.

### 124. Revoked node unravel animation sequence
- **Source:** Andrew planning conversation during Phase 9D QA. Existed conceptually across prior discussions but never formally captured at this level of detail.
- **Status:** Open — deferred to Phase 9D.2. Phase 9D.1 scoped-out the animation per the task brief's explicit split allowance; V2Canvas has no edge-retraction infrastructure today, and the clockwise border unwind is its own focused workstream. 9D.1 ships the UX redo (modal → Detail Panel section + case-routed copy + dimmed revoked rows) so Dismiss today triggers immediate removal with the same state transitions the animation will wrap in 9D.2.
- **Scope:** Medium–Large (multi-stage animation with edge choreography and node-level transforms across potentially multiple connected nodes).
- **Priority:** Medium (demo polish; revocation is functional without it, but the animation meaningfully improves user comprehension of what's being removed from their network).
- **Context — the problem the animation solves:** When a revoked node is dismissed from the user's canvas, it disappears instantly. The user loses mental-map continuity — they can't see what edges were connected, what the spatial relationship to nearby nodes was, or visually track "this is being removed." This is a regression from V2.1's perceived quality even when the underlying revocation logic is correct.
- **Animation sequence (per revoked node + its connected edges):**
  - The animation plays when the user clicks the Dismiss button in a revoked node's Detail Panel. It animates the revoked node itself AND all other connected node cards in sequence.
  - **Phase 1 — Edge withdrawal (first ~400ms):** Every edge connected to the revoked node retracts from its endpoint into the card it's entering. Visually: the edge line "pulls back" into the card like a rope being reeled in, rather than fading out. Edges retract from both ends simultaneously if both endpoint cards are being dismissed together; otherwise from the revoked-node side only. Retraction eases out smoothly (not linear) — faster at the start, slowing as it disappears into the card edge.
  - **Phase 2 — Dashed border unwinding (middle ~600ms):** The revoked node's solid border transitions to a dashed pattern. The dashed border then "unwinds" clockwise around the card — as if the border itself is a continuous dashed line being unraveled from a starting point. The starting point can be the top-right corner (arbitrary convention) or wherever implementation makes cleanest. As each dash segment unwinds, it disappears — leaving progressively less border around the card until there's none.
  - **Phase 3 — Content erasure (middle ~400ms, overlapping with Phase 2 end):** The card's internal content (name, owner, badges, health minibar, etc.) fades out. Not all at once — stagger so type label fades first, name second, owner/badges third, minibar last. Fade timing: each element ~150ms, offsets of ~50ms between elements.
  - **Phase 4 — Card fade (final ~300ms):** The now-empty card's background fades to transparent. Simultaneously, the card's position translates very slightly (maybe 4-8px) toward its original edge origin points, or just slightly "settles downward" — subtle motion cue that emphasizes "going away."
  - **Total duration per node:** ~1.0-1.3 seconds depending on overlap. Tune per QA.
- **Choreography for multiple connected nodes:** When the revoked primary node is dismissed, any other nodes that were cascade-revoked alongside it (Eval Results in the current model, paired EAs' anchor nodes if applicable) should animate in the same sequence, but staggered:
  - Primary revoked node starts animation at t=0
  - First cascade-revoked node starts at t=~300ms
  - Second cascade-revoked node starts at t=~500ms
  - Stagger prevents the canvas from feeling like everything "exploded" simultaneously; reads as a connected sequence of related dismissals. The connecting edges between cascade-revoked nodes should retract in Phase 1 of whichever node starts the animation, from both sides.
- **Edge cases to surface during scoping:**
  - What if the user dismisses a revoked node while other canvas animations are still playing? Answer: queue the unravel, or force-complete prior animations first.
  - What if the user navigates away (role switch, different view) mid-animation? Answer: cleanup-complete the animation silently; state transitions aren't canvas-dependent.
  - Performance at scale — if a user has many cascade-revoked nodes (e.g., 10+ Eval Results tied to a revoked Claim), staggered sequential animation could feel slow. Consider grouping batches and animating them in parallel, or capping the stagger.
- **Not in scope for this item:** The visual treatment of the revoked node BEFORE Dismiss (that's backlog #112 / Phase 9D; REVOKED badge + border color + Detail Panel content are already shipped). The revocation notification behavior (works today: pan/zoom/select/open-panel).
- **Depends on:** Current 9D revocation logic (already shipped — commit b29fdc9). Pairs with #110 (V2.1 animation restoration — glow + marching ants). Both are animation-restoration work; could ship in a combined animation-focused phase. Pairs with #80 (Accepted-transfer animation sequence) as part of the broader "V2.2 feels polished when things enter and leave the canvas" theme.
- **Implementation notes (for later scoping):** Current V2Canvas uses Three.js for edge rendering and HTML overlays for cards. Edge retraction needs Three.js animation; card-level animation can be CSS transitions or framer-motion if added later. The clockwise border unwinding is the most visually distinctive element and also the most custom — likely requires a dedicated SVG or Three.js custom shader. Don't underestimate complexity of this one piece. Build a reusable "unravel" function that takes a node ID and optional cascade-ID list, so the same animation can be reused for other "node leaves the canvas" scenarios (future: expired agreements, explicit delete actions, etc.).

---

## Edge Interactions

### 6. Selected-edge state persistence through layer changes
- **Source:** Phase 3 open question
- **Scope:** Small
- **Context:** If user selects an edge then triggers a layer change (dive/surface), the highlight resets because material mutation doesn't survive rebuild.
- **Proposed fix:** Re-apply selected-edge material in the effect that handles layer changes. Low-priority given V2.2's empty child layer — matters more if we later reuse child layer.

### 7. Hover tooltip conflicts with edge menu position
- **Status:** ✅ Complete (Phase 9B). Resolved by unifying the hover tooltip and the click-menu into a single `EdgeHoverMenu` component — two modes (`hover` + `pinned`) on the same component rather than two competing surfaces. Hover state clears on edge click (when the pinned menu takes over), so no overlap.

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
- **Status:** ✅ Complete (Phase 9B). Unified into a single `EdgeHoverMenu` component with two modes: `hover` (cursor-anchored, pointer-events disabled, dismisses on mouse-leave) and `pinned` (click-point-anchored, clickable rows, dismisses on menu action / different edge / empty canvas click). The old separate `EdgeMenu.jsx` has been deleted. Edge lines brighten (30% white lerp) on hover; cursor-centered 12px SDA-colored dot renders under the cursor; tooltip anchors top-left of cursor with bottom-right fallback at viewport edges. Menu rows: View Disclosure Agreement (3-line: action label + SDA illustration with type label + endpoint-with-owner string); View Evaluation Agreement (2-line: action label + expiry, only when paired EA exists). Whole-row hover highlights for clickability. **Deviation vs. 9A.3 sketch:** no separate "on-edge hit-point dot" — the cursor-centered dot is the single visual anchor per Andrew's Phase 9B spec.

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
- **Status:** ✅ Complete (resolved by removal in Phase 9A.6.1.1). The DOT row has been removed from the Actor panel entirely. DOTs per canon X.1 identify data elements (Assets / Claims / Eval Results), not actors — actors have DIDs per canon X.2. Our `partyDot` field is a misnomer carried forward from V2.1 and we shouldn't surface it as "DOT" on the Actor Detail Panel. The Actor's PIN in the panel header serves as the user-facing identifier. Earlier 9A.6 + 9A.6.1 work on this row (CopyBadge wrapping, `partyDot` read fix) is superseded.

### 64. Asset DOT / hash / URI click-to-copy badge
- **Status:** ✅ Complete (Phase 9A.4 preamble). Applied `<CopyBadge value={...} truncated />` treatment to three long identifiers on the Asset Detail Panel: owner DOT, file hash, file URI. Matches the PIN treatment used elsewhere in the app. Null-value guard (`value ? <CopyBadge ... /> : '—'`) handles Assets registered via Phase 9A.3's Create Asset flow where `file.hash` is null pending a real hashing implementation. Per spec §3.2 the Asset has no distinct DOT — the file hash is the true per-Asset cryptographic identifier; the "DOT" label on the Asset panel refers to the party-level owner DOT.

### 101. Actor Detail Panel narrative fields cleanup
- **Status:** ✅ Complete (Phase 9A.6.1.1 Fix 1). Role, Vertical, and User rows removed from V22ActorPanel body. Role labels remain in the user-menu role switcher. The `role` / `vertical` / `user` fields stay on `makeActor` in v2_2Data.js for now (may be referenced elsewhere; removing from the data model is a separate cleanup).

### 103. Referenced Assets missing from Claim Detail Panel on counterparty canvas
- **Status:** ✅ Complete (Phase 9A.6.2.1). Root cause: two call sites in V2App.jsx (Claim Detail Panel referenced-Assets resolution + Run Evaluation evidence resolution) read `buildV22SharedArtifacts()` without merging provisionals, so newly-registered Assets never reached the counterparty view. Fix: replace with `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` at both sites. Latent since Phase 6.5 Option A — the code comment said "(incl. provisionals)" but the implementation never actually included them. Audit of the 13 `buildV22SharedArtifacts()` call sites in V2App.jsx identified 4 additional notification-metadata sites (accept / decline / eval-completed / amend-DA) where the seeded-only lookup would drop user-created Claim name + pin; those also fixed. The remaining 7 sites either already use the explicit `v22Provisionals.* ?? seeded` fallback pattern or source from seed-only data (AI Shopper public directory).

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
- **Status:** ✅ Superseded by #111 (Phase 9C shipped the Agreements section in Detail Panels; Amend on DAs wired from the row, Amend on EAs disabled pending #108).

### 111. Agreements section in node Detail Panels (primary access path for Amend / Revoke)
- **Status:** ✅ Complete (Phase 9C). Agreements section added to Actor, Asset, and Claim Detail Panels. DAs filtered per node (Actor: party is grantor or grantee; Asset: referenced in scope.assetIds or the granteeAssetId anchor; Claim: subject is this Claim). EAs same shape. Rows render type + subject name, counterparty, status/expiration, Amend / Revoke action labels on the right. Amend wired for DAs (opens `AmendDisclosureModal` for active DAs, `CombinedResponseModal` for provisionals). Amend for EAs + Revoke for both remain placeholder-disabled pending #108 + #112. Row click selects the edge (if one exists) and opens the appropriate agreement Detail Panel; an agreementId fallback handles DAs without canvas edges (e.g. suppressed internal Actor→Claim ownership per 9A.5 #83). Internal DAs render "Internal" in the counterparty slot with no action labels. Proof-of-Evaluation DAs render with no action labels (design deferred). Data sourced from `v22View.disclosureAgreements` + `v22View.evaluationAgreements` which already merge provisionals via `getV22DataForRole`. Supersedes #12.

### 112. Revocation flow restoration
- **Status:** ✅ Complete (Phase 9D; UX redo in Phase 9D.1). DAs + EAs both revocable by either grantor or grantee. `V22RevocationConfirmModal.jsx` (new) is the revoker-side confirmation with cascade warning. Revoke action labels in the 9C Agreements Section are functional — opens the Confirm modal. `makeRevocationRecord` factory + `revocationRecords` field on `v22Provisionals` provide the audit ledger; `_revokedMeta` annotations on DAs/EAs/Eval Results drive view-layer filtering in `buildViewForActor`. DA revocation cascades to paired EA + grantee's Eval Results under that EA; chained notifications (`v22-da-revoked` + `v22-ea-revoked` with `cascadedFromDa: true`) fire to the counterparty. EA-only revocation does NOT cascade. Proof-of-Evaluation DAs remain non-revocable by design. Self-revocation scoped out.
- **9D.1 UX redo (2026-04-22):** counterparty-side `V22RevocationNoticeModal` replaced with a Detail Panel pattern. Notification-click no longer mounts a modal — it pans/selects the Claim, opens the Detail Panel, and renders a shared `RevocationNoticeSection` inline at the top of the body. Grantee-side (Cases A/C) drives off existing `_revokedMeta` flagging in the REVOKED Claim branch; grantor-side (Cases B/D) drives off a new `v22ActiveRevocationNotice` state populated on notification click (cleared on Dismiss or role switch). Red-accented header callout (44px X icon + "Access Revoked" + case-routed one-line summary), message-from-revoker block, optional cascade summary line (lists only non-zero categories), and case-routed "What this means" explainer. Four copy cases: A (grantor-initiated DA, grantee sees), B (grantee-initiated DA, grantor sees), C (grantor-initiated EA, grantee sees), D (grantee-initiated EA, grantor sees). Revoked DA/EA rows render dimmed (`opacity: 0.5, pointerEvents: none`) in a new "Revoked" subsection of `AgreementsSection` — grantee pre-Dismiss context. `V22RevocationNoticeModal.jsx` retained as dead code pending #50 sweep; the import in V2App.jsx is commented out with a pointer. Unravel animation (#124) deferred to Phase 9D.2 — Dismiss today triggers immediate removal per 9D.
- **9D.1.1 corrections (2026-04-22):** seven fixes from 9D.1 QA. (1) Inline Dismiss in `RevocationNoticeSection` removed — single Dismiss now in the panel footer (REVOKED branch footer for Case A; added to standard footer when `revocationNotice` is active for Cases B/C/D). (2) DA + EA revoked agreement rows now show the revocation date (not original createdDate). (3) Grantee can also revoke — `showRevoke` gate on DA + EA rows widened to `(isGrantor || isGrantee)`. (4) Revoke button added to DA + EA Detail Panel footers (red outline; same gating as the Agreements Section row). (5) Case C notice rendering fixed — dropped `activeParty === node.owner` gate on `noticeForGrantor`; renamed to `noticeForPanel`; `viewerIsGrantor` computed per-panel so the section's case-routing handles all four cases correctly. (6) **Critical dismiss regression fix** — `handleV22DismissRevoked` now annotates provisionals with `_dismissedRevoked: true` instead of filtering them out. Filtering let the seeded (non-revoked) version reappear via `mergeProvisionals`'s mergeById; annotation keeps the provisional override in place while `buildViewForActor` pre-filters `_dismissedRevoked` items from every view output. (7) `RevocationNoticeSection` redesigned to match standard Detail Panel patterns — dropped the red-tinted full-width header + 44px X icon + modal-style Dismiss footer in favor of a `Section` + `Row` layout (From / Date / Cascade rows, red-accented Summary box with header summary + italic reason blockquote, consequence paragraph below). Mirrors the declined-branch structure.

### 48. Candidate preview before Request Agreement
- **Source:** Phase 7 scope boundary (spec §9)
- **Scope:** Small
- **Context:** Spec §9 lists "View a Claim's public-directory Detail Panel (owner, description, posted date, aggregate stats)" as a capability. Currently the candidate card jumps straight to Request Agreement. Add a secondary "Preview" CTA that opens a read-only panel showing what's publicly disclosed about the Claim (respecting the public DA's scope).

### 58. Export JSON (functional) + Export PDF (placeholder)
- **Source:** Phase 9A.3 preamble — handoff roster. **High priority.**
- **Scope:** Medium
- **Context:** Detail Panels for each artifact type (Asset, Claim, Parse Result, Eval Result, DA, EA) should offer Export actions. JSON export is trivial — serialise the `v22Artifact` (or the underlying artifact) and trigger a browser download; this is functional from day one. PDF export is placeholder-grade (stub button that opens a "coming soon" dialog or generates a minimal PDF via a lightweight library) — the intent is to surface the capability in the UI so client discussions around export formats have a visible hook.
- **Proposed fix:** Add a shared `<ExportActions>` strip to each Detail Panel footer, above the primary action. Two buttons: "Export JSON" (functional) + "Export PDF" (placeholder). Consider a single dropdown if footers get crowded.

### 116. Agreements section on Eval Result + Parse Result Detail Panels
- **Source:** Phase 9C QA — Andrew's observation that Eval Result panels don't show related Agreements.
- **Scope:** Small (pattern-match from 9C's Actor/Asset/Claim work)
- **Priority:** Medium
- **Context:** Phase 9C shipped the Agreements section on Actor, Asset, and Claim Detail Panels. Parse Result and Eval Result panels were explicitly out of scope. An Eval Result is the subject of at least one Proof-of-Evaluation DA (flowing from the evaluator back to the Claim owner), and may be subject to additional DAs if the owner chooses to disclose the Eval Result to a third party (e.g., Alice discloses Bob's Eval Result to Carol). Currently these aren't surfaced anywhere in the Eval Result's own panel. Same holds for Parse Results (if/when they become subject to their own DAs — today they're generally not, but §6 pull-in semantics may evolve).
- **Proposed fix:** Extend the 9C Agreements section pattern to V22EvalResultPanel and V22ParseResultPanel. Filter DAs by `subject.kind === 'evalResult'` and `subject.id === node.id` (Eval Result case); parse result filtering TBD per data model. Reuse existing row components from 9C — no new primitives needed.

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
- **Status:** ✅ Complete (Phase 9E-parallel, commit b29fdc9). V2Canvas signature cleaned of seven V2.1-era props (`onConnect`, `onDisclose`, `onAddEvidence`, `onParseEvidence`, `onRunEvaluation`, `onAmendEval`, `onCreateClaim`) + forward sites in full-card, `AssetNodeMini`, and `AssetNodeDot` branches. V2.2 nodes route card actions through `onV22CardAction` exclusively. V2App.jsx still passes these handler props to V2Canvas (now silently ignored by the receiver) — full V2App.jsx dead-prop cleanup deferred to #50.

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

### 114. Umbrella Disclosure concept + second seller role with pre-existing DA to Bob
- **Source:** Andrew planning conversation post-9C — modeling realistic procurement relationships.
- **Scope:** Medium
- **Priority:** High (enables #113's two-flow contrast)
- **Context:** Real procurement doesn't ad-hoc request disclosure on every transaction. Mature buyer-supplier relationships have framework agreements covering visibility broadly, with specific actions exercised under those frameworks. The platform supports this via "umbrella" Disclosure Agreements at the Radiant Network layer — a standing DA from a seller to a buyer covering the seller's entire published catalog. Set up administratively (out-of-app, like a master service agreement at onboarding); not a UX flow within Radiant. Adds a second seller role to demonstrate the contrast: Alice (cold relationship with Bob, must request both DA + EA) versus a new seller (warm relationship with Bob via umbrella, requests only EA).
- **Proposed implementation:**
  - **New seller actor** — likely "Helio Aerospace" / Dave@HelioCorp, or promote one of NovaFab/ElectroGrid/Precision Components from mock-cluster-of-dots to a real second supplier. Andrew to choose.
  - **Seed data:** the new seller has 2-3 published Claims in the Public Directory, plus a pre-existing umbrella DA to Bob covering all of those Claims. The umbrella DA exists in `v22Provisionals.disclosureAgreements` (or seed data) at boot.
  - **Visual treatment:** the umbrella renders at the Radiant Network layer rather than as a direct edge between actors. Decision needed during scoping: dedicated edge style? Implicit (just lets the cloud-layer Claims appear as visible to Bob)? Worth thinking through with #29 / #45 / #43 (Public Directory Cloud work).
- **Open question:** Does the umbrella cascade through Asset hierarchy (#70)? If a new Asset is added to a parent Program covered by an umbrella, does the umbrella auto-extend? Worth resolving as part of #70's design conversation.
- **Depends on:** Pairs with #113. Touches the Public Directory Cloud work (#29, #43, #45).

### 115. Evaluation Agreement terms checkboxes + metadata schema
- **Source:** Andrew planning conversation post-9C — making EA terms first-class.
- **Scope:** Small to Medium
- **Priority:** High (ships with #113)
- **Context:** When Alice grants Bob's Evaluation request, she ticks a series of predefined boxes that codify the terms of the agreement. These persist into the EA's metadata (`ea.metadata.terms[]`) as structured JSON. The platform doesn't enforce them programmatically — they're contract-style commitments recorded for audit and future legal-document attachment. Makes explicit that Requirements Sets in the EA are *one term among many*, not platform-enforced gating.
- **Proposed checkbox content (to ideate together when scoping):**
  - "Permitted Requirements Sets" — multi-select from Bob's proposed list, plus Alice's option to add others
  - "Evaluation results expire after [N days / never]"
  - "Bob may re-disclose Eval Results to [no one / specific parties / public]"
  - "Re-evaluation permitted [unlimited / N times / not permitted]"
  - "Self-evaluation by Alice required before Bob's evaluation [yes / no]"
  - Andrew to ideate the full list when picking up this work
- **Display:** EA Detail Panel shows the granted terms in a readable list (not raw JSON for the user — though raw JSON view could be a debug surface). Amend EA modal (#108) lets Alice modify any term mid-flight.
- **Future enhancement:** attach an actual legal document (PDF / structured agreement) to the EA, alongside the structured terms. Out of scope for first ship.
- **Depends on:** Pairs with #113. Scope finalization waits on Andrew's ideation pass on the term list.

### 119. "Evidence" → "Assets" terminology audit
- **Source:** Phase 9C QA — Andrew's copy observation. Extension of #17 (terminology reconciliation with client canon).
- **Scope:** Small
- **Priority:** Medium
- **Context:** "Evidence" became conversational shorthand during V2.1 for what are canonically Assets (referenced by Claims) + Parse Results (structured fields extracted from Assets). The shorthand persisted into V2.2 copy — Run Evaluation modal shows "Evidence in scope (N)", various body text references "evidence", internal variable names like `evidenceAssets`. None of this matches the client's canon terminology.
- **Proposed fix:** Audit pass across all V2.2 user-facing copy. Replace "Evidence" with the appropriate canonical term — "Assets" when referring to Asset nodes, "Parse Results" when referring to parsed fields, or "Referenced Assets" when context needs disambiguation. Update modal titles, button labels, body copy, tooltips, and any status text. Variable names can stay (they're internal) unless a rename is cheap as part of the same PR.
- **Specific instance flagged:** Run Evaluation modal title "Evidence in scope" → "Assets in scope". Audit at minimum all modal titles, labels, and FieldLabel copy across V22RunEvaluationModal, V22ParseEvidenceModal, AmendDisclosureModal, CombinedResponseModal, CombinedRequestModal.
- **Depends on:** Can ship independently; when #17 (full client-canon reconciliation) runs, absorb this.

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
- **Status:** ✅ Complete (Phase 9E-parallel.3, cleaned up in 9E-parallel.4). Initial implementation shipped in 9E-parallel.2 but didn't render in practice: the `!previewFile` guard meant selecting multiple files and then clicking any one (which naturally sets `previewFile` for inspection) immediately replaced the summary with that file's single-preview. Corrected in 9E-parallel.3 — precedence inverted to match macOS Finder column-view multi-select: when `selected.size > 1 && resolvedSelectedForSummary.length > 1`, the summary panel wins the right-pane slot regardless of `previewFile`.
- **9E-parallel.4 follow-up:** single-preview render condition tightened from `selected.size <= 1 && previewFile` → `selected.size === 1 && previewFile`. The `<=` allowed the pane to linger when the user unchecked all files (since `previewFile` persisted from the last row click). Also aligned 2 files in the `sentinel-program/manufacturing-reports` seed folder to share `2026-03-15` so the Modified-date-collapse code path is testable (`thermal-analysis-v2.pdf` retains `2026-03-10` so the range path also remains testable via mixed selections).

### 95. QS picker re-add files preserves custom labels
- **Source:** Phase 9A.6.1 QA.
- **Scope:** Small
- **Priority:** Medium
- **Status:** Under investigation — flagged as blocked on V22CreateAssetModal being in scope (Phase 9E-parallel.2). Root cause confirmed: V22CreateAssetModal's `handlePickerSelect` calls `setRows(newRows)` on every picker return, replacing the entire rows array and losing user-edited labels. Picker-only fix explored (accept `initialSelected` prop to pre-check files on re-open) but insufficient — the modal would still `setRows(newRows)` on return, overwriting labels. Clean fix requires editing V22CreateAssetModal's return handler to merge rows keyed by stable file identity (e.g., `filename + size` or `file.path`). Phase 9E-parallel.2 scope excluded V22CreateAssetModal. Defer to a follow-up phase with that file in scope.
- **Context:** In the Asset registration per-file review step, clicking "+ Add more files…" re-opens the picker. If the user already edited a custom label on an existing row, the current logic replaces the row set entirely on re-pick — labels reset to filename-stem defaults. Fix: merge the new picks into the existing row list (preserving `label` for rows whose file is re-picked, and appending new rows for newly-picked files). Removed files should still be removable via the ✕.

### 96. Local Storage tab: indicate destination folder for uploads
- **Status:** ✅ Complete (Phase 9E-parallel.2). Drop-zone copy now reads "Files will be uploaded to **{bucket}/uploads** in your Qualified Storage." with the path bolded (`fontWeight: 600`, `var(--text-secondary)`). Bucket wired through `LocalStoragePanel`'s new `bucket` prop, sourced from `data.bucket` (e.g. `s3://govco-qualified-storage`) — the same string shown in the picker's header bar.

### 97. Local Storage uploads default-checked + Select All toggle
- **Status:** ✅ Complete (Phase 9E-parallel.2). Two sub-changes: (1) Newly-uploaded local files auto-flip into `selected` at the `status: 'uploading' → 'ready'` transition, guarded by a `markedReady` latch and `mode !== 'single'`. (2) Select All / Deselect All text toggle renders between the drop zone and the file list, right-aligned, visible when `localFiles.length > 0 && mode !== 'single'` and at least one ready file exists. Toggles all ready local-file IDs as a single Set operation; QS-side selection (keyed by name, different ID space) is not touched. Matches the existing QS picker mode='multi' toggle-all affordance.

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

### 113. Split Combined Request into distinct Disclosure + Evaluation steps
- **Source:** Andrew planning conversation post-9C — clarification of the conceptual separation between visibility and capability.
- **Scope:** Medium
- **Priority:** High (conceptual clarity matters for client demos)
- **Context:** Today's `CombinedRequestModal` and `CombinedResponseModal` bundle "I want to see this Claim" and "I want to evaluate this Claim" into a single request/response cycle. The platform's data model already separates Disclosure Agreements (visibility) from Evaluation Agreements (capability), but the UX collapses them. This obscures an important conceptual distinction: a Disclosure grants only the right to look; an Evaluation grants the right to take a specific kind of action on what was disclosed, under recorded terms. Splitting the flow makes the model explicit, clarifies why Requirements Sets are courtesy-not-binding (they're one EA term among many), and sets up the umbrella concept (#114).
- **Proposed flow:**
  - **Cold request (no umbrella, see #114):** Bob explicitly requests Disclosure first → Alice accepts/declines/scopes. If accepted, Bob then requests Evaluation → Alice accepts/declines + ticks terms checkboxes (#115).
  - **Warm request (umbrella in place, #114):** Bob skips Disclosure step entirely (umbrella covers it) → goes directly to Evaluation request.
- **UI shape:** Either two sequential modals or a two-step modal with explicit Step 1 (Disclosure) → Step 2 (Evaluation). Same shape for the Response side.
- **Depends on:** #114 (umbrella demo data) for the warm-path showcase. Pairs with #115 (EA terms checkboxes).

### 117. Re-Run Evaluation: permissive Asset selection with audit metadata
- **Source:** Phase 9C QA observation, reversed mid-chat from the original locked-Assets framing to a permissive framing.
- **Scope:** Medium
- **Priority:** High
- **Context:** When Bob clicks "Re-Run Evaluation" on a Claim that has been amended (new Assets added, or existing Assets removed), the Asset selection step should be fully permissive — Bob can freely include, exclude, or add to the set of Assets being evaluated, including previously-evaluated ones. No locking. No hard rules preventing particular selections. This respects Bob's autonomy as evaluator: the platform's job is to record what was evaluated, not to enforce what *must* be evaluated. The originally-evaluated Asset set is pre-populated as the default selection, but it's a default, not a constraint.
- **Audit behavior:** Any deviation from the originally-evaluated Asset set is recorded in the new Eval Result's metadata — which Assets were added to this run, which were dropped, which carried over unchanged. Preserves evaluation traceability without constraining Bob's choices. Surfaced in the Eval Result Detail Panel under a "Changes from prior evaluation" section when applicable.
- **NEW badges:** Freshly disclosed Assets (since last evaluation) still carry a NEW badge in the Asset selection step, purely as an informational cue so Bob notices "there are new Assets available since I last evaluated." The badge is non-enforcing — Bob can still skip those Assets if he chooses.
- **Proposed fix:** V22RunEvaluationModal's evidence selection step — pre-populate with the previously-evaluated set as default selection. Render NEW badges on freshly-disclosed Assets. Allow full freedom to toggle any selection. On submit, diff the final selection against the previous evaluated set, store the diff in the new Eval Result's metadata. Surface the diff in the Eval Result Detail Panel.
- **Note on prior framing:** An earlier backlog draft framed previously-evaluated Assets as locked (non-removable in re-run), mirroring the AmendClaimModal lock where Alice can't remove evaluated Assets from her own Claim. That framing was reversed. The asymmetry is intentional: Alice locking evaluated Assets on her side preserves the integrity of evaluations Bob has already made; Bob's own re-run is a fresh evaluation event — he decides its scope.
- **Depends on:** Pairs with #106 (evidence picker removal). If #106 ships first and evaluation becomes Claim-level rather than Asset-picker-level, #117 reshapes around surfacing the diff in the review UI rather than via an explicit picker.

### 118. Bob's Asset shouldn't get NEW badge on disclosure accept
- **Source:** Phase 9C QA — Andrew's observation.
- **Scope:** Small
- **Priority:** Medium
- **Context:** When Bob sends a Disclosure Request from one of his Assets to Alice's Claim, and Alice accepts, Alice's Claim correctly appears on Bob's canvas with a NEW badge (it's new to Bob's view). Additionally, Bob's own anchor Asset also gets a NEW badge — but Bob's Asset isn't new; it's been on his canvas since he created it. The NEW treatment is a false signal.
- **Proposed fix:** In the disclosure-accept handler path, scope the `_isNew` flag to only the newly pulled-in artifacts (counterparty's Claim, their referenced Assets if scope includes them), not the requester's own anchor Asset. Likely a filter in the flag-stamping logic that checks `asset.owner === requesterParty` and skips the requester's own artifacts.

### 125. QS picker cross-tab mutual exclusion
- **Status:** ✅ Complete (Phase 9E-parallel.3). Selections in the Qualified Storage tab and Local Storage tab are now mutually exclusive. Tab-change handler clears `selected` and `previewFile` before flipping `source`, so the footer "Select N Files" count always reflects only the active tab. Silent reset — no warning modal. Edge case confirmed: 3 files selected in QS → switch to Local (selection clears) → upload 2 files (auto-select per #97, count = 2) → switch back to QS (selection count = 0; prior QS selection is NOT restored). Corrects 9E-parallel.2's #97 implementation which permitted accumulating selections across tabs.

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

### 120. Reference published Requirements Sets on a Claim (non-binding)
- **Source:** Client planning discussion post-9C.
- **Scope:** Medium (exploratory)
- **Priority:** Low (captured for later assessment)
- **Context:** Today Claims have no formal relationship to Requirements Sets — the relationship is established only when someone evaluates the Claim against a Requirements Set. The client suggested that a Claim owner (or anyone) could reference owner-created or publicly published Requirements Sets *on the Claim itself*, as a non-binding signal of intent: "this Claim is built to satisfy these standards." This would surface in the Claim's Detail Panel as a list of referenced Requirements Sets.
- **Implications:** Opens up a discoverability path — counterparties browsing the Public Directory could filter Claims by referenced standards. Pairs conceptually with #114 umbrella disclosures + #115 EA terms (if a Claim references a Requirements Set, an EA over that Claim is pre-suggested against that same set). Also pairs with #25 (Library Modal unification).
- **Open questions:** Can the reference change over the Claim's lifecycle? Who's authoritative for the reference (the Claim owner always, or does the Claim inherit references from its Assets)?

### 121. Evaluate a Claim against multiple Requirements Sets simultaneously
- **Source:** Client planning discussion post-9C.
- **Scope:** Medium
- **Priority:** Low (captured for later assessment)
- **Context:** Currently Run Evaluation is 1:1 — one Claim, one Requirements Set, one Eval Result. Real evaluations often cover multiple standards (e.g., "does this part meet both MIL-STD-810 AND RoHS AND ITAR export-control?"). Extending the modal to accept N Requirements Sets would produce either N distinct Eval Results (one per set) or a single Eval Result that rolls up multi-set satisfaction.
- **Open design questions:**
  - Single Eval Result (multi-set) vs. multiple Eval Results (one per set)? The former is cleaner in the netgraph; the latter preserves per-set separability for partial supersede/amend.
  - If multi-set, how does the Eval Result Detail Panel present per-set breakdown?
  - Interaction with #117 (permissive re-run) — what if Bob originally evaluated against Set A, and now wants to expand to Set A + Set B?
- **Depends on:** Pairs with #106 (remove evidence picker — if evaluations are Claim-level, multi-Set-at-once is more tractable).

### 122. Remove evidence from a Claim despite prior evaluation (e.g., expired license)
- **Source:** Client planning discussion post-9C.
- **Scope:** Medium
- **Priority:** Low (captured for later assessment)
- **Context:** Today the platform locks evaluated Assets — they can't be removed from a Claim's scope once referenced by an Eval Result, to preserve the integrity of historical evaluations. Client's scenario: an Asset like an expired operating license becomes invalid over time. The Claim owner should be able to remove the expired Asset, which would mark prior Eval Results as needing re-evaluation.
- **Implications:**
  - Breaks a current platform invariant (evaluation locks on the Claim-owner side). Needs to decide the new invariant — probably "removal triggers supersede-required state on prior Eval Results."
  - Adds a new Eval Result status beyond ACTIVE / SUPERSEDED — perhaps STALE or REQUIRES_RE-EVAL.
  - Counterparty-side effect: Bob's old Eval Result on Alice's Claim is now marked STALE. Notification to Bob. His canvas might badge it. If he cares, he re-runs.
  - Interaction with transfer flows (#73): if an Asset backs a Claim that's been disclosed, removing it has amend-cascade implications.
- **Open design questions:** Scope carefully before implementing — this is a model-level change, not a UX addition.

### 123. "Reverse AI Shopper" — publish an Evaluation Agreement as an open RFP
- **Source:** Client planning discussion post-9C.
- **Scope:** Large (exploratory)
- **Priority:** Low (captured for later assessment)
- **Context:** Flips the current AI Shopper model. Today, Bob (buyer) asks the platform "who can provide X?" and discovers sellers' published Claims. Proposed: Bob publishes an Evaluation Agreement as an RFP referencing specific Requirements Sets — "I'm looking for suppliers whose Claims can satisfy these requirements." Sellers discover the RFP, create Claims targeted at satisfying it (or point existing Claims at it), and engage the EA as grantees.
- **Implications:**
  - EAs become first-class discoverable objects in the Public Directory, not just downstream of disclosures.
  - Creates a new Claim-creation flow ("create a Claim targeting RFP X") — possibly auto-populates referenced Requirements Sets.
  - Shifts the directionality of the whole procurement model — sellers respond to buyer demand rather than buyers discovering seller supply.
  - Natural pair with #114 (umbrella disclosure) — a mature buyer with umbrella relationships could publish RFPs against their umbrella supplier pool without needing wide public visibility.
- **Open design questions:** Big one — does this change Radiant from "transparency infrastructure" to "procurement marketplace"? That's a positioning shift worth discussing with the client before scoping implementation.

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
- 2026-04-21: Phase 9A.6.1.1 — three small fixes. Actor Detail Panel stripped DOT / Role / Vertical / User rows (DOT concept applies to data elements per canon X.1, not actors — supersedes 9A.6 and 9A.6.1 work on that row). Mini/dot LOD action bar reverted to click-only (9A.6.1 Fix 4 hover behavior was impractical). Run Evaluation diagnostic console.log for #103 investigation added. Backlog #89, #100, #101 status updates.
- 2026-04-21: Phase 9A.6.2 — investigation phase for #103 (Create Claim multi-Asset loss). Exhaustive static code review of the four candidate root causes (nested CTA overwrite, stale submit closure, factory ID drop, materialization race) plus end-to-end programmatic simulation (5 seeded + 2 registered = 7 Assets, Claim created with 7 `referencedAssetIds`) — both clean. Bug not reproducible without driving the actual canvas UI (V2Canvas raycaster doesn't respond to DOM `dispatchEvent`). Per CLAUDE.md workflow rule on genuine ambiguity, shipping instrumentation without a guessed fix: new diagnostic `console.log` blocks at V22CreateClaimModal's `handleComplete` and V2App's `handleV22CreateClaimSubmit` (entry + factory output). The 9A.6.1.1 Run Evaluation diagnostic is retained. Issue 2 (orphan `forceActionBar` at AssetNode.jsx:414) was already resolved in 9A.6.1.1 — no-op confirmed. Filed #107 (border shorthand style warning — pre-existing, low-priority cleanup). #103 remains open pending fresh reproduction with diagnostic-log capture.
- 2026-04-21: Phase 9A.6.2.1 — #103 fixed. Root cause was two `buildV22SharedArtifacts()` call sites in V2App.jsx (Claim Detail Panel referenced-Assets + Run Evaluation evidence) that read seeded-only data without merging provisionals — newly-registered Assets never reached the counterparty view. Create Claim flow itself was clean end-to-end (the 9A.6.2 diagnostics would have confirmed this on next reproduction). Fix: wrap both with `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)`; exported `mergeProvisionals` from `v2_2Data.js`. Audit of the 13 call sites identified 4 additional notification-metadata sites (accept / decline / eval-completed / amend-DA Claim name + pin lookup) that needed the same fix — user-created Claims would otherwise land in notifications with null name/pin. Remaining 7 sites either already used the explicit `v22Provisionals.* ?? seeded` fallback pattern or source from seed-only data (AI Shopper public directory). All four 9A.6.2 diagnostic `console.log` blocks stripped. Filed #108 (missing Amend EA modal). Data-layer pre/post simulation: pre-fix returns 5 names, post-fix returns 7 names.
- 2026-04-21: Phase 9B — edge hover & selection polish. Shipped #7 and #59. New `EdgeHoverMenu.jsx` unifies the hover tooltip + click menu into a single component with two modes (hover / pinned). Edge lines brighten on hover (30% white lerp vs. selection's 65%); cursor-centered 12px SDA-colored dot renders under the cursor; tooltip anchors top-left of cursor with bottom-right fallback. Menu rows: View DA (action + SDA illustration with type + endpoint-with-owner) and View EA (action + expiry). Whole-row hover-highlighted for clickability. Click pins the tooltip at the click point until a row is clicked / different edge is clicked / empty canvas is clicked. Old `src/v2/EdgeMenu.jsx` deleted. TDZ fix for hover state ordering caught in-session.
- 2026-04-21: Phase 9B.1 — edge hover menu refinements. Cursor dot bumped 12px → 24px. Hover tooltip simplified into a header ("Select Edge to View") + 2-row options in rounded-rectangle containers (SDA illustration halved to 24px; "View Disclosure Agreement" standalone row removed in favour of "{Type} Disclosure Agreement" on the illustration row; "View " prefix dropped from the EA option). Clicked-state: header disappears, "View →" affordances fade in on the right of each option simultaneously (~200ms). Right padding reserved in all states so layout doesn't shift between hover and pinned. Pinned tooltip now tracks its world-space click point through the 9A.1.5 pan/zoom framing animation via a new `projectToViewport` method on V2Canvas's imperative handle + a RAF loop in V2App. Removed "Authorized Requirements Sets" section from the Evaluation Agreement Detail Panel (advisory per spec §10.5, not binding — labelling as "Authorized" implied enforcement that doesn't exist). Filed #110 (edge glow + marching-ants V2.1 restoration).
- 2026-04-21: Phase 9B.2 — edge hover bug fixes. Selective/dashed edges now brighten visibly on hover (type-aware blend: 50% on dashed/dotted, 30% on solid). Click-state brightening persistence hardened — extracted the apply-styling logic to a ref-backed helper invoked at the end of the rebuild effect, closing the race where a separate useEffect could skip and leave the edge un-brightened. World-space RAF tracking from 9B.1 §4 replaced with the spec's fade-during-animation fallback: tooltip hides while the pan/zoom framing animation runs (150ms opacity transition), reprojects and fades back in on completion (using the existing world-point capture). Option right padding bumped 48→80px so "View →" no longer overlaps long endpoint text. Cursor dot bumped 24→32px; raycaster threshold 8→12 and hide debounce 80→150ms for more reliable dot rendering. Filed #111 (Agreements section in node Detail Panels — supersedes #12) and #112 (Revocation flow restoration).
- 2026-04-21: Phase 9B.3 — edge menu anchors at the true world-space midpoint of the two endpoint cards, not the click point. Click point still used as the initial pre-animation anchor; the existing fade-during-animation effect reprojects to midpoint on completion. Radiant Network / endpoints without world positions still trigger the menu, but `worldX/worldY` resolve to null — the tooltip stays at its pre-animation click-point anchor (matching 9A.1.5 edge-select framing's skip-for-missing-positions behavior). Also cleaned up a stale `setEdgeMenuProjected` reference in the click handler left over from 9B.2 (would have thrown ReferenceError on first click).
- 2026-04-21: Phase 9C — Agreements section added to Actor / Asset / Claim Detail Panels. Each row shows type + subject name, counterparty, status / expiration with Amend / Revoke text labels on the right (Amend wired for DAs — opens AmendDisclosureModal for active / CombinedResponseModal for provisionals; Amend for EAs + Revoke for both remain placeholder pending #108 + #112). Row click selects the edge (when one exists) and opens the agreement Detail Panel; agreementId fallback handles DAs without canvas edges (suppressed internal Actor→Claim ownership per 9A.5 #83). Internal DAs render "Internal" with no action labels; Proof-of-Evaluation DAs render with no action labels per design. Data sourced from `v22View.disclosureAgreements` / `v22View.evaluationAgreements` (already merged with provisionals via `getV22DataForRole`) — no #103-style regression. #111 ✅ Complete; #12 ✅ Superseded.
- 2026-04-21: Phase 9D — Revocation flow restored and extended to EAs. DAs and EAs both revocable by either grantor or grantee. DA revocation cascades to paired EA + grantee's Eval Results under that EA with explicit warning surfaced in `V22RevocationConfirmModal` (new) before commit; chained notifications (`v22-da-revoked` + `v22-ea-revoked` with `cascadedFromDa`) fire to the counterparty. `V22RevocationNoticeModal` (new, pattern-matched from V2.1 `RevocationNoticeModal.jsx`) is the counterparty Dismiss surface — for grantor-initiated DA revocations, Dismiss also removes the revoked Claim + cascade-revoked EA + Eval Results from the grantee's canvas. `_revokedMeta` annotations on DAs/EAs/Eval Results drive view-layer filtering in `buildViewForActor`; `revocationRecords` ledger rides along via `mergeProvisionals` for audit. Revoke labels in the 9C Agreements Section are now functional (indigo hover); Proof-of-Evaluation DAs remain non-revocable by design with a defensive handler guard. REVOKED badge on Claim node + red border + "Disclosure revoked" message row pattern-match the DECLINED treatment. #112 ✅ Complete.
- 2026-04-21: Phase 9E-parallel — #51 V2.1 prop pruning + #107 border shorthand→longhand + initial #60 approach (reverted). Co-shipped with Phase 9D in commit b29fdc9 (the two parallel sessions collapsed into one commit — post-mortem: future parallel work should explicitly constrain each session to its own commit scope). Phase 9E-parallel.1 corrected #60: restored uniform background grid opacity, brightened AssetNodeDot inner-circle ring. #60 ✅ Complete at commit 7d03982. Phase 9E-parallel.2 (this entry): QS picker cluster (#94 ✅ multi-select summary, #96 ✅ destination folder indicator, #97 ✅ default-checked + Select All toggle, #95 under investigation — flagged blocked on V22CreateAssetModal being in scope) + doc reconciliation for #51, #60, #107.
- 2026-04-22: Phase 9D.1.1 — seven corrective fixes from 9D.1 QA. (1) Inline Dismiss removed from `RevocationNoticeSection`; single Dismiss now in footer. (2) Revocation date shown in DA + EA revoked rows. (3) Grantee can revoke — DA + EA row `showRevoke` widened to `(isGrantor || isGrantee)`. (4) Revoke button added to DA + EA Detail Panel footers (red outline; same gating). (5) Case C notice rendering — dropped `activeParty === node.owner` gate; `viewerIsGrantor` computed per-panel. (6) **Critical dismiss regression fix**: `handleV22DismissRevoked` now annotates `_dismissedRevoked: true` instead of filtering; `buildViewForActor` pre-filters the flag from every view output. Filtering previously let the seeded (non-revoked) version reappear via mergeProvisionals's mergeById. (7) `RevocationNoticeSection` redesigned to match standard Detail Panel patterns (Section + Row + red-accented Summary box + consequence paragraph), dropping the modal-ported red-tinted header + 44px X icon + inline dismiss footer.
- 2026-04-22: Phase 9D.1 — Revocation UX redo. V22RevocationNoticeModal removed from the notification-click path; click now pans/selects the target Claim and opens its Detail Panel with a shared `RevocationNoticeSection` at the top — red callout + case-routed copy (Cases A/B/C/D) + message block + cascade summary (when non-zero) + "What this means" explainer + inline Dismiss. Grantee-side (Cases A/C) drives off `_revokedMeta` in the REVOKED Claim branch; grantor-side (Cases B/D) drives off new `v22ActiveRevocationNotice` state. Revoked DAs + EAs now render dimmed (opacity 0.5, pointer-events-none) in a new "Revoked" subsection of `AgreementsSection` — grantee pre-Dismiss context. V22RevocationNoticeModal.jsx kept as dead code pending #50 sweep; V2App import commented out. #112 annotated with 9D.1 UX redo note. #124 (unravel animation) explicitly deferred to Phase 9D.2 per the task brief's split allowance — V2Canvas has no edge-retraction infrastructure and the clockwise border unwind is its own focused workstream. Dismiss today still triggers immediate removal per 9D; 9D.2 will wrap the same state transitions in the animation.
- 2026-04-22: Phase 9E-parallel.4 — two fast-followers from 9E-parallel.3 QA. (1) Single-preview render condition tightened to `selected.size === 1` so the pane hides on uncheck-all instead of lingering on the last-clicked file (previously `selected.size <= 1` which included the zero-selected case). (2) Aligned 2 files in `manufacturing-reports` seed folder to share `2026-03-15` so the summary's Modified-date-collapse path is testable; `thermal-analysis-v2.pdf` left at `2026-03-10` to keep the range path testable. No regressions on multi-select summary or cross-tab mutual exclusion.
- 2026-04-22: Phase 9E-parallel.3 — #94 correction + #97 cross-tab mutual exclusion + backlog file merge. #94 reopened and re-shipped: the 9E-parallel.2 implementation's `!previewFile` guard meant the summary panel never rendered in practice (clicking any row sets `previewFile`, flipping back to single-file preview immediately). Corrected by inverting precedence — multi-select summary wins the right-pane slot whenever `selected.size > 1 && resolvedSelectedForSummary.length > 1`, regardless of `previewFile`. Matches macOS Finder column-view behavior. #125 (new) filed and shipped: QS and Local Storage tab selections are now mutually exclusive — tab change clears `selected` + `previewFile` silently so the footer "Select N Files" count always reflects only the active tab. Merged #113–#124 from three reference files (`references/backlog-additions-disclosure-evaluation-split.md`, `references/backlog-additions-post-9c.md`, `references/backlog-addition-unravel-animation.md`) into categorical homes: #113 + #117 + #118 (Process Flows), #114 + #115 + #119 (Data Model & Content), #116 (Detail Panels), #120–#123 (Exploratory / Experimental), #124 (Visual & Rendering — revoked node unravel animation). Original #-IDs preserved; items filed as Open.
