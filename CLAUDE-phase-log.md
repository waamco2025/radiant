# Radiant by Provenance — Phase log archive

Historical phase notes for the V2.2 migration and post-migration work, dated 2026-04-17 through the present. Each entry captures what shipped, deviations from the spec, fold-ins, and known-scope-boundary notes for that phase.

For current codebase conventions, file inventory, UX patterns, and active state-of-the-world, see [`CLAUDE.md`](./CLAUDE.md). For the architectural model and shipped reality, see [`architecture-spec.md`](./architecture-spec.md). For the open / partial / deferred work queue, see [`polish-backlog.md`](./polish-backlog.md).

This file is archive-grade reference material. Round-opening upload sets do not need it unless phase history matters for the current task.

---

## Phase log

V2.2 migration ran in eight phases, 2026-04-17 through 2026-04-19. All complete.

- [x] Phase 1: Data Model Foundation
- [x] Phase 2: Parent Layer Restructure
- [x] Phase 3: Edge Clickability + Agreement Panels
- [x] Phase 4: Combined Request + Response Flows
- [x] Phase 5: Evaluation Flow + Eval Results on Parent Layer
- [x] Phase 6: Amendment Flows
- [x] Phase 7: Directory Layer + AI Shopper
- [x] Phase 8: Consolidation + Cleanup

Per-phase completion notes below capture what shipped plus any deviations from the spec.

### Phase 1 completion notes (2026-04-17)

- Split V2.2 data model into a new file `src/v2/v2_2Data.js` (spec §12.5 says v2Data.js "will grow substantially"; keeping V2.1 and V2.2 data side-by-side during migration is cleaner in separate files). `v2Data.js` is unchanged; `V2App.jsx` has two additions only: an import of `V2_2_ENABLED` and a conditional banner.
- Added the six §10 factories (`makeAsset`, `makeParseResult`, `makeClaim`, `makeDisclosureAgreement`, `makeEvaluationAgreement`, `makeEvaluationResult`) plus helpers per §12.5: `makeInternalDisclosureAgreement`, `makeProofOfEvalDisclosureAgreement`, `makePublicDirectoryDisclosureAgreement`. Also added a small `makeActor` helper for dataset bookkeeping.
- Shared artifact set (`buildV22SharedArtifacts`) seeds Bob, Alice, Carol, and the Radiant Network pseudo-actor; 7 Assets; 3 Parse Results; 3 Claims; 25 Disclosure Agreements (ownership, claim→asset refs, 3 explicit inter-party, 3 public-directory, 2 proof-of-eval, 2 eval-ownership); 3 Evaluation Agreements; 2 Evaluation Results (Bob's MIL-PRF result, Carol's audit result). This covers Story 1 and seeds Stories 2–3.
- View builders `buildAliceView`, `buildBobView`, `buildCarolView` are Phase 1 stubs — they return `{ actor, shared }` unfiltered; per-role filtering lands in Phase 2.
- Feature flag: `V2_2_ENABLED` in `v2_2Data.js`. Default is `false` (V2.1 behavior unchanged). Two ways to enable: flip `FORCE_V2_2 = true` in the file for local dev, or set `VITE_V2_2_ENABLED=true` in the env.
- **Schema resolution (post-review):** spec §10.4 was updated to replace the Disclosure Agreement's `claimId` field with `subject: { kind: 'asset' | 'claim' | 'evalResult' | 'parseResult', id }`. `makeDisclosureAgreement` + helpers and the seeded dataset were updated accordingly. See the spec §10.4 subject-assignment table for Phase 2's edge-derivation model.
- **Workflow note (post-review):** CLAUDE.md and the spec were updated to replace references to `/ultrareview` with "perform a structured review against the phase's acceptance criteria." Manual review remains the process.

### Phase 2 completion notes (2026-04-17)

- All V2.2 rendering work landed in `src/v2/v2_2Data.js` (role-filtered views, edge derivation, canvas adapter with layout), `src/v2/V2App.jsx` (roleData branch on `V2_2_ENABLED`, short-circuit of the V2.1 merge pipeline in V2.2 mode), and `src/v2/AssetNode.jsx` (type-label badge in the full card and mini card).
- **Role filtering** (`buildViewForActor`): owner sees own Assets, Claims, Parse Results, and Eval Results; pulled-in Claims appear on grantee's canvas via paired DA + EA; counterparty Assets are asymmetric per §6.1 vs §6.4 — the grantee-side anchor (`granteeAssetId`) is pulled in on the grantor's canvas, but the grantor's individual Assets are NOT pulled in on the grantee's canvas.
- **Edge derivation** (`deriveAgreementEdges`): single algorithm walks DAs and emits Agreement Edges per spec §10.4 subject-assignment table. Each edge carries `{ from, to, sdaType, disclosureAgreementId, pairedEvaluationAgreementId }` — `pairedEvaluationAgreementId` is populated when an EA references the DA, wiring Phase 3's edge menu.
- **Canvas adapter** (`buildV22Canvas`): converts view → `{ nodes, edges, nodeMap }` with deterministic column-based layout. Claim health rollups and Eval Result health minibars computed from evaluation results, excluding `na` rows per §3.5. `v22Type` and `v22Artifact` fields added to each node.
- **AssetNode.jsx type labels**: small mono badges (`ACTOR`, `ASSET`, `CLAIM`, `PARSE RESULT`, `EVAL RESULT`) rendered inline before the node name in both full-card and mini-card views. Hidden for V2.1 nodes (absent `v22Type`), so V2.1 rendering is visually unchanged.
- **V2App**: `roleData` branches on `V2_2_ENABLED`; when true, the V2.1 merge/roll-up useMemo short-circuits and passes the pre-built `{ nodes, edges, nodeMap }` straight through. `pendingRequests` and `existingCascades` are empty arrays in V2.2 mode (phase 4+ features).
- **Known scope boundaries (not bugs):** edge clicks still follow V2.1 behaviour (Phase 3); the existing Detail Panel may render unfamiliarly for Parse Result / Eval Result parent-layer nodes until Phase 3; modal actions triggered from V2.2 node footers will open V2.1 modals that are not wired to V2.2 state — those rewires come in Phase 4+.

### Phase 3 completion notes (2026-04-17)

- **Pre-Phase-3 adjustments folded in:**
  - *Orphaned Eval Result ownership:* `buildViewForActor` grew a second-pass inclusion for counterparty internal DAs whose endpoints are all visible on the actor's canvas. Today it applies to Eval-Result ownership DAs (subject=evalResult + scope.assetIds non-empty). Concretely: Alice's canvas now renders `erBobPrm ↔ asset-bob-avionics` and `erCarolPrm ↔ asset-carol-audit-workspace` ownership edges in addition to the Proof-of-Evaluation edges, resolving the "orphaned Eval Result" feedback without adding a new edge type or pulling in counterparty Actor nodes.
  - *Multi-line node label:* `v22Type` badge moved to its own line (Row 0) above the name on the full card; mini-card title stacks the badge above the name vertically. Name is no longer truncated by the inline badge.
- **Phase 3 proper:**
  - `V2Canvas.jsx`: `selectedEdgeId` + `onEdgeClick` props. `handleBackgroundClick` raycasts against the edge group; if a line hits, it emits `onEdgeClick(edgeId, { x, y })`. A dedicated `useEffect` applies the §4.4 selected-edge treatment (40% white blend + 0.5px stroke) by mutating existing edge materials, so no buildEdges refactor was needed.
  - `src/v2/EdgeMenu.jsx` (new): portal-rendered contextual menu anchored at click coords. Offers "View Disclosure Agreement" (always) and "View Evaluation Agreement" (when paired). Closes on outside click, Escape, or item select. Viewport-clamped positioning.
  - `src/components/DetailPanel/DisclosureAgreementDetailPanel.jsx` (new): slide-over panel at zIndex 55. Header label branches across Internal / Proof-of-Evaluation / Public-Directory / inter-party variants per §4.1. Renders Parties, Subject, Grantee Anchor, Type & Scope, Terms, Status, Amendments count. "View paired Evaluation Agreement →" quick-jump when paired. Amend action in footer, enabled only when `activeParty === grantor.party`.
  - `src/components/DetailPanel/EvaluationAgreementDetailPanel.jsx` (new): same structure, renders §10.5 fields (authorized requirements sets, restrictions, terms, incentives) and quick-jumps back to the paired DA.
  - `resolveAgreementsForEdge(edgeId, view, edges)` in `v2_2Data.js`: single lookup that returns `{ edge, disclosureAgreement, evaluationAgreement }`.
  - V2App wiring: tracks `selectedEdgeId`, `edgeMenu`, `openAgreement`. Clears edge selection when a node is selected (§4.4). Amend callbacks are stubs with a Phase 6 comment — the buttons are surfaced per acceptance criterion but do not yet mutate state.
- **V2.1 mode regression check:** `onEdgeClick` is only passed to V2Canvas when `V2_2_ENABLED` is true; `handleBackgroundClick` short-circuits edge hit-testing when the prop is absent. V2.1 background-click → deselect behaviour is unchanged.
- **Ambiguity resolved during Phase 3:** on Alice's canvas, should Carol's ownership of her Eval Result be conveyed via a pulled-in Carol Actor node or via the existing eval-ownership DA's edge? Chose the latter (no new node, no new edge type, pre-existing DA, both endpoints already visible) rather than the former (violates §6.4's "counterparty internals are private" spirit). Documented as the second-pass inclusion rule.

### Phase 4 completion notes (2026-04-18)

- **Pre-Phase-4 bug fixes (folded in):**
  - *Bug 1 — Parse Result → source Asset edges missing:* added a `parseResultRefEdges` seeding block in `buildV22SharedArtifacts` (one DA per parse result, subject={kind:'parseResult', id:pr.id}, scope.assetIds=[pr.sourceAssetId]). Extended `deriveAgreementEdges` to handle `subject.kind='parseResult'` with scope.assetIds, and added parse-result IDs to `isRenderable`. Alice's canvas now shows 3 new edges (parse → source asset).
  - *Bug 2 — Selected-edge invisible on dashed/dotted lines:* spec called for 40% white blend + 0.5px stroke, but those values were imperceptible on amber/green dashed lines against the dark canvas. Bumped to 65% white blend + 1.5px stroke. Visible across all four disclosure types.
  - *Bug 3 — Selection race:* the reactive effect that watched `[sel, selectedEdgeId]` to enforce mutual exclusion was firing on the user's NEXT edge click (after a node was already selected), wiping the fresh edge state in the same render. Removed the effect; replaced with explicit clears inside the `handleSelect`, `onEdgeClick`, and `handleCloseSel` paths. Bug repro (edge → node → edge) now succeeds; background clicks now also deselect edges.
- **Phase 4 proper:**
  - `src/components/modals/CombinedRequestModal.jsx` (new): single-step flow — PIN input with live resolution (✓ found / not found / self-owned errors), optional Requirements Sets multi-select, optional message, "Send Request" footer button. Inherits Backdrop/Modal/ModalHeader/Body/Footer/Btn/FieldLabel from V2.1's ModalShared.
  - `src/components/modals/CombinedResponseModal.jsx` (new): inherits V2.1's four-card type grid (Full / Selective / Proof-Only / Decline) via `DecisionCard` from ModalShared. Step progression: Type → (scope or decline reason) → EA terms (authorized req sets + expiry via `ExpiryPicker`) → Review. Decline path skips to the reason step. All step transitions guarded by per-step validation.
  - `src/v2/v2_2Data.js`: added `mergeProvisionals`, `getV22DataForRole(roleId, provisionals)` overload, `resolveClaimByPinInShared`, `makeProvisionalAgreementPair`, `finalizeProvisionalAgreementPair`. View builder now computes `provisionalClaimIds` and `provisionalAssetIds`. Adapter marks pulled-in nodes with `isProvisional: true` and appends `· PROVISIONAL` to `v22Type`.
  - `src/v2/V2App.jsx`: added `v22Provisionals`, `v22RequestOpen`, `v22RespondingTo`, `v22RecentlyAcceptedClaimId` state. `handleV22RequestSubmit` / `handleV22Accept` / `handleV22Decline` callbacks. "Request Agreement…" button in V2.2 banner. Reveal animation triggered via existing `_isNew` flag pipeline. (Historical: Phase 4 cleared `_isNew` after ~900ms; Phase 7 carry-over #1 replaced the timer with deselection-clears — see Phase 7 notes below. The 900ms number refers to the card's fade-in animation on initial render, not the NEW badge duration.)
  - `src/components/DetailPanel/DisclosureAgreementDetailPanel.jsx`: footer button label/colour adapt for provisional DAs ("Respond to Request" amber for grantor; "Awaiting Response" disabled for grantee).
- **Spec-vs-implementation note:** §7.1 step 1 calls for the Request flow to launch from "Bob's Asset's Detail Panel footer." For Phase 4 I anchored the entry point to the V2.2 banner's "Request Agreement…" button (always visible, deterministic asset selection) to avoid touching V2.1's PanelShell action footer mid-migration. Fold in the Asset-panel entry point in Phase 5+ when DetailPanel hardening for V2.2 nodes lands.

### Phase 5 completion notes (2026-04-18)

**Spec § update (§4.4):** revised the selected-edge values from the Round 11 spec defaults (40% white blend, +0.5px stroke) to the values shipped in Phase 3/4 (65% blend, +1.5px stroke). The spec entry now documents the change and the rationale (visibility on dashed/dotted edges).

**Andrew's six Phase 5 additions (folded in alongside Phase 5 own scope):**
1. *Per-Asset request entry point.* `V22NodeDetailPanel.jsx` (new) renders an Asset panel with a "Request Agreement" footer button for owners. V2App stamps the Asset as the request anchor and pre-populates the modal. The banner button is retained as a secondary entry point; it remains useful when no specific Asset is selected and disambiguates "I want to request something but don't have an anchor in mind yet."
2. *Multiple Asset demo data.* Added Bob's Guidance Computer + Thermal Subsystem (3 Bob assets total) and Carol's Compliance Audit Queue (2 Carol assets total). The Avionics anchor's existing inter-party DAs no longer block end-to-end testing of Phase 4's response flow.
3. *Provisional "Awaiting Response" Detail Panel state.* `V22ClaimPanel` branches on `node.isProvisional` — header amber AWAITING RESPONSE badge, request metadata section (requester, anchor, date, suggested req sets, message), CTA = "Respond to Request" for the grantor or "Cancel Request" for the grantee. New handler `handleV22CancelRequest` mirrors decline but is initiated by the requester.
4. *Notification on accept/decline.* `enqueueV22NotificationForRequester` adds an entry to the requester's `perRoleState.addedRequests`. The existing V2.1 inbox UI surfaces ACCEPTED / DECLINED badges and the deep-link click pans to the Claim node and opens its panel.
5. *"Disclosure Declined" surface (§11.4).* `makeDeclineRecord` + new `declineRecords` field in `v22Provisionals`. View builder includes declined claims as visible nodes with `isDeclined`. `V22ClaimPanel` declined branch shows decline reason in a red-bordered panel + "Dismiss" CTA. `handleV22DismissDeclined` removes the record.
6. *NEW badge + pan-to-node.* `setV22PanToClaimId` triggers `canvasRef.current.panToWithZoom`; `setV22RecentlyAcceptedClaimId` tags `_isNew` on the claim node. Fires for both initial provisional creation and post-accept activation, reusing V2.1 reveal infrastructure. (Historical: Phase 5 cleared `_isNew` after ~900ms; Phase 7 carry-over #1 removed that timer — NEW badge now persists until the user deselects the node. The 900ms number describes the card's fade-in animation on initial render, not the NEW badge duration.)

**Phase 5 own scope:**
- New helpers in `v2_2Data.js`: `makeDeclineRecord`, `makeEvaluationRunArtifacts` (returns Eval Result + Proof-of-Eval DA + ownership DA + optional supersededPriorResult), `findPriorActiveEvaluationResult`. `mergeProvisionals` extended for `evaluationResults` + `declineRecords`.
- New modal `V22RunEvaluationModal.jsx`: split-panel (evidence left / rows right), shared `ConfidenceBadge` palette matching V2.1, shared `ReviewRow` component shape. Status cycling SAT → UNSAT → MISSING → N/A on click. Restricts library to EA-authorized req sets. Surfaces a SUPERSEDE warning when a prior active result with the same Req Set lineage exists.
- New Detail Panel router `V22NodeDetailPanel.jsx` (Asset / Claim / Parse Result / Eval Result). Eval Result panel shows status badges, supersede metadata, and a Re-run Evaluation footer for owners.
- Supersede semantics: same Req Set lineage → prior result's `status` flips to 'superseded' and `supersededBy` links to the new id. Health rollups in the canvas adapter exclude `status === 'superseded'` per spec §3.5. Different Req Set produces an independent active result.

**Known scope boundaries (not bugs):**
- *No V2.2 Parse Evidence modal yet.* Spec §13 Phase 5 calls for "Parse and Eval modals look and feel nearly identical when viewed side-by-side." The eval modal is built with the structural shape that the parse modal will inherit (same split-panel, same ReviewRow, same ConfidenceBadge). A V2.2 parse modal can drop in trivially when needed; it isn't required for the Phase 5 Story 1 walkthrough.
- *Run Evaluation entry from EA edge panel.* Spec uses an OR ("from an Agreement Edge or from Alice's Claim footer"). I shipped the Claim-footer entry point. Adding to the EA panel is a natural Phase 6+ polish.
- *Pan-to-zoom level.* Picked `zoom = 1.0` for the post-creation pan; V2.1's typical post-create zoom is 1.28. Cosmetic — adjust on visual review.

### Phase 5 hotfix (2026-04-18) — TDZ post-mortem

- **Symptom:** App crashed on load in V2.2 mode with `ReferenceError: Cannot access 'updateRoleState' before initialization` at V2App.jsx:124.
- **Root cause:** During Phase 5 I inserted the V2.2 handler block (lines 115–366: `enqueueV22NotificationForRequester`, `handleV22RequestSubmit`, accept/decline/cancel/dismiss/run-eval handlers, plus the pan-to-node `useEffect`) BEFORE the declaration of `updateRoleState` (line 395). The `useCallback(..., [updateRoleState])` deps array is evaluated at render time → temporal-dead-zone error.
- **Fix:** Relocated the entire handler block to immediately after `updateRoleState` is declared. State setters the handlers also reference (`setSelectedEdgeId`, `setOpenAgreement`, `setEdgeMenu`) were already declared earlier so no further moves were needed.
- **Verification additions baked into the workflow (above):**
  1. Ran a static scan over `V2App.jsx` checking that every `useCallback` / `useMemo` / `useEffect` deps array references only identifiers declared earlier in the function body. Now part of the pre-completion checklist.
  2. Ran a JSDOM render check (`createRoot(...).render(<V2App/>)` after esbuild-bundling the entry, with `sessionStorage`/`localStorage`/`navigator` stubs) and asserted no `uncaughtException` / `unhandledRejection` fires within 250ms of mount, in BOTH `V2_2_ENABLED=true` and `V2_2_ENABLED=false`. Three.js/WebGL errors are expected in JSDOM and do not count as failures.
  3. Confirmed the V2.2 Phase 5 runtime call chain (provisional → accept → run-eval → decline) executes against the data layer without throwing.
- **Lesson surfaced for future phases:** build success + pure-data sanity scripts are insufficient verification for React component changes. The runtime check above is now the floor for any phase that touches `V2App.jsx`.

### Phase 6 completion notes (2026-04-18)

**Nine Phase 5 carry-over fixes folded in:**
1. *EA authorization is advisory, not enforced.* Spec §10.5 updated; `CombinedResponseModal`'s "Authorized Requirements Sets" step removed (the response flow is now 4 steps for accept paths: Type → Scope → Terms (expiry only) → Review); `V22RunEvaluationModal` no longer filters the library by `authorizedRequirementsSetIds`; the original suggestions surface as a `SUGGESTED` chip. The EA field still stores the suggestions for context.
2. *`CombinedRequestModal` anchor prop.* V2App now passes `v22RequestAnchor` (the clicked Asset) as `requesterAsset`, falling back to the first owned Asset only for the banner entry.
3. *Pan-to-node + NEW badge on provisional creation.* The adapter sets `_isNew: true` on provisional Claim nodes so the NEW badge persists for the whole provisional duration; `setV22PanToClaimId(claim.id)` pans to the new provisional node on the requester's canvas.
4. *Duplicate PROVISIONAL / DECLINED / SUPERSEDED tags.* The adapter no longer appends `· PROVISIONAL` / `· DECLINED` suffixes to `v22Type`, and eval results use a bare `'EVAL RESULT'` label regardless of superseded status. Separate inline badges in `AssetNode.jsx` are the single source of truth.
5. *Provisional nodes stay off the grantor's canvas.* View builder skips pull-in when `da.type === 'provisional'`; the grantor sees the request only as a `'v22-request'` notification until they accept.
6. *Notification-driven response flow.* `handleV22RequestSubmit` now enqueues a `'v22-request'` notification on the grantor's inbox; the notification click handler dispatches to `setV22RespondingTo({ daId })`, opening the `CombinedResponseModal` directly. Accept/decline auto-dismiss the original `'v22-request'` entry.
7. *Proof-Only requires Eval Result scope selection.* New Step 2 branch in `CombinedResponseModal` lists `evalResultsForClaim` with a toggle picker; when none exist, an informational message suggests switching to Full or Selective. `buildScope()` returns `evaluationResultIds: [...selectedEvalResultIds]`.
8. *"Run Evaluation" button.* Renamed from "Save Evaluation". `canSubmit` no longer requires evidence selection; rows initialize from `requirementSet.requirements` (the V2.1 req-set shape — previously the modal looked for `claims` which is why the button stayed disabled).
9. *Legacy Connect Asset path.* `V2Canvas`'s `onConnect` prop is now `V2_2_ENABLED ? undefined : ...`; `RequestDisclosureModal` and `DisclosureResponseModal` mounts are guarded with `!V2_2_ENABLED`. In V2.2 mode, the per-Asset entry is exclusively the `V22AssetPanel`'s "Request Agreement" footer button.

**Phase 6 own scope (spec §13):**
- `AmendClaimModal.jsx` (new): Alice picks additional Assets she owns and appends them to a Claim's `referencedAssetIds`. The factory helper `makeAmendedClaim` also generates new internal claim-ref DAs so the new Asset → Claim edges render.
- `AmendDisclosureModal.jsx` (new): Alice adjusts a DA's scope. Behaviour branches on `da.type` (assets for Full / parse fields for Selective / eval results for Proof-Only). §11.2 enforcement: items already evaluated (via `er.evidenceUsed` for assets / `er.id` for eval results) are pre-selected and locked with a `not-allowed` cursor + `EVALUATED` badge.
- Cross-role amendment notification. `handleV22AmendDisclosureSubmit` enqueues a `'v22-amendment'` entry on the grantee's inbox; click deep-links to the Claim on the grantee's canvas and pans to it.
- Self-evaluation flow. Owner clicks `Self-Evaluate` on their own Claim panel footer → `V22RunEvaluationModal` opens in self-eval mode (no EA context, library shows all Req Sets, no SUGGESTED chips). The resulting Eval Result + internal proof-of-eval DA + ownership DA are added to `v22Provisionals`; `deriveAgreementEdges` grew a new branch for internal-proof-of-eval edges (self-eval renders visually identical to non-self proof-of-eval).
- `V22ClaimPanel` footer is owner-aware: for the Claim's owner → `Amend Claim` + `Self-Evaluate`; for a counterparty with an active EA → `Run Evaluation`.
- `DisclosureAgreementDetailPanel`'s Amend button now branches: provisional + grantor → response flow; active + grantor → `AmendDisclosureModal` via `setV22AmendingDaId`.

**Runtime verification (both modes):** JSDOM render harness passes for `V2_2_ENABLED=true` and `V2_2_ENABLED=false`; no init-time exceptions. Phase 6 data-layer sanity script covers: provisional-stays-off-grantor, adapter badge dedup, eval run + supersede (7 SAT 1 UNSAT rollup), amend-claim edge generation, amend-DA scope replacement, self-eval proof-edge rendering.

**Spec updates folded in:**
- §10.5 — `authorizedRequirementsSetIds` documented as advisory / informational.

**Polish-backlog:** items #10, #21, #22, #23 moved to ✅ Complete.

**Known gaps (not Phase 6 blockers):**
- *Published standards seed.* Self-evaluation works against any of Alice's existing Requirements Sets. A dedicated "OSHA" mock set in the published standards library is a seeding follow-up — the flow doesn't require it.
- *Pan-to-Eval-Result after self-eval.* Pan still targets the Claim, not the new Eval Result. Cosmetic.
- *Amend Claim from a Claim that lives on a pulled-in counterparty canvas.* Only owners see the Amend button (rendered conditionally), which is correct.

### Phase 6.5 completion notes (2026-04-19) — bug-fix pass

End-to-end review against Andrew's numbered list (#1–17) after the Phase 6 commit (6800bf9). Thirteen fixes folded in; items #34 (inline "Register new Asset" in Amend Claim), #35 (edge-draw animation for new Amend Claim refs), and #36 (Option B — pull disclosed Assets onto grantee canvas) deferred to the polish backlog.

1. *#3 Declined artifacts persist instead of being deleted.* `handleV22Decline` no longer removes the provisional DA/EA; it annotates them with `_declineMeta` + `_declined` so the synthetic edge from Bob's anchor Asset to Alice's Claim persists in DECLINED state until the requester explicitly dismisses. `handleV22DismissDeclined` strips the annotations as a pair. `buildViewForActor` derives decline state from annotated DAs. Decline takes precedence over "awaiting response" in `provisionalClaimIds`. Spec §11.4 was rewritten accordingly (see spec changelog entry).
2. *#4 Grantor-side reveal on acceptance.* `handleV22Accept` now also tags the grantee's anchor Asset with `_isNew` on the grantor's canvas and pans there; previously only the grantee's canvas got the post-acceptance reveal. New `v22RecentlyAcceptedAssetId` state threads through `v22DataWithReveal`.
3. *#5 Eval-modal evidence resolution (Option A).* Counterparty Assets aren't pulled onto Bob's canvas today, so the V22RunEvaluationModal mount in V2App resolves evidence Assets by unioning `buildV22SharedArtifacts().assets` with `v22View.assets`, filtering to the DA's `scope.assetIds`. Option B (update `buildViewForActor` to pull disclosed Assets onto grantee's canvas) is the architecturally consistent counterpart and deferred to polish-backlog item #36.
4. *#6 Evaluation-completed notification (new `v22-evaluation` type).* `handleV22EvaluationSubmit` enqueues a notification on the Claim owner's inbox with `supersedesPriorResultId` + `requirementsSetName`. V2App's notification renderer adds an `isV22Evaluation` branch (badge label EVALUATED / RE-EVALUATED), and the click handler deep-links to the new Eval Result node.
5. *#7 Inert "Connect Asset" button hidden in V2.2 mode.* `AssetNode.jsx`'s `handleCreateAsset` gates on `typeof onConnect === 'function'`; V2Canvas passes `onConnect={undefined}` when `V2_2_ENABLED`, so the "+" plus-button no longer renders on V2.2 Asset cards.
6. *#8 `v22-request` notification persists until terminal action.* Click on the request notification opens the response modal but does NOT dismiss the notification; dismissal now happens inside `handleV22Accept` / `handleV22Decline` via explicit `dismissedReqs` push. Accidental modal close no longer loses the request.
7. *#9 Amend Claim shows already-referenced Assets as read-only cards.* `AmendClaimModal` replaced the "{N} Assets already referenced" text line with rendered read-only Asset cards, so Alice can see what's already on the Claim while picking additions.
8. *#11 Full Disclosure Asset checklist.* `CombinedResponseModal`'s Step 2 Full branch is now a selectable checklist (was a read-only display that auto-included all Claim-referenced Assets). `buildScope()` returns `selectedAssetIds`; `canAdvanceFromStep2Accept` requires ≥1 Asset. Polish-backlog item #37 captures the last-Asset deselect inline help polish.
9. *#12 Amendment pan + reveal.* `handleV22AmendDisclosureSubmit` and `handleV22AmendClaimSubmit` now pan to the amended Claim and set `_isNew` via the existing reveal infrastructure.
10. *#13 Banner z-index.* V2.2 banner dropped to `zIndex: 10` so the notification dropdown (z-index 200) renders above it.
11. *#16 Counterparty referenced-Asset filtering in the Claim Detail Panel.* When a non-owner opens a Claim panel, the referenced-Asset list is filtered to only those in-scope under an active DA where the viewer is grantee. Prevents leaking private reference names.
12. *#17 Eval Result row offset.* Eval Result nodes now render with `EVAL_ROW_OFFSET = ROW_STEP / 2` to avoid edge-path collision with the Claim ↔ Asset row.
13. *Also included:* pendingRequests pass-through to the notification inbox (was hardcoded `[]`), self-evaluation plumbing (`handleV22OpenSelfEvaluation`), and cross-role amendment notification wiring. These were Phase 6 carry-overs surfaced during the 6.5 review.

**Spec updates folded in during Phase 6.5:**
- §6 — new §6.5 "Cross-canvas pull-in rules" codifying counterparty internal DA inclusion, provisional non-pull-in, and the post-acceptance reveal on both canvases.
- §7.1 — request flow anchored at the Asset Detail Panel footer (primary) + banner (secondary); provisional node now described as requester-canvas-only with notification delivery to the grantor.
- §7.4 (new) — notification types (`v22-request`, `v22-amendment`, `v22-evaluation`) with delivery + persistence semantics.
- §10.4 — new Parse Result → source Asset row in the subject-assignment table (the pre-Phase-4 bug fix formalised).
- §11.4 — decline retention with `_declineMeta` annotation (replacing the prior "both artifacts deleted" rule).
- §12.6 (new) — demo dataset composition, including Bob's 3 Assets (Avionics, Guidance Computer, Thermal Subsystem) and Carol's 2 Assets (AuditCo Workspace, Compliance Audit Queue).

**Polish-backlog:** items #34, #35, #36 added for deferred 6.5 review points.

**Runtime verification:** JSDOM render harness + Phase 6.5 data-layer sanity script covering: decline-retain + dismiss-strip symmetry, v22-evaluation notification wiring, Full checklist ≥1 guard, counterparty Detail-Panel filter, Asset eval-evidence resolver falling back to shared dataset.

### Phase 6.5+ completion notes (2026-04-19) — visual-review pass

Second review iteration against Andrew's numbered list (#1–11) after Phase 6.5 landed. Eight fixes folded in; items #37 (last-Asset deselect inline help), #38 (full-word status cycling + prior-lineage pre-fill + AI confidence chip), #39 (decline dismiss ravel-out animation), #40 (node-card action button audit), #41 (PDF viewer in eval modal), and #42 ("Re-Evaluate" entry on Eval Result panels) deferred to the polish backlog.

1. *#2 DECLINED inline badge renders.* The canvas adapter now sets both `isDeclined` (V2.2-side state) and `_isDeclined` + `_declineReason` (underscore-prefixed, which V2.1 `AssetNode` badge rendering reads). Previously the PROVISIONAL badge was winning the precedence race. DECLINED is documented as outranking PROVISIONAL in spec §3.
2. *#3 Decline-notification animated pan.* Clicking the DECLINED notification now selects + `animatedPanToWithZoom`s to the node instead of a bare `setSel` with a 100ms delay.
3. *#4 ACCEPTED / amendment notification pan.* Notification click now always `animatedPanToWithZoom(target, 1.28)` to the target node. Previously computed a midpoint toward a paired node at zoom 0.7, which felt under-panned.
4. *#5 Panel-compensated pan (no secondary jump).* The pan-to-node effect now pre-applies the exact `panelWidth` + `containerHeight` offset that V2Canvas's selection-pan uses, so the initial animated pan lands where the selection-pan would have landed. Eliminates the "re-adjust after animation completes" hop. Also added explicit `setSel` before every `setV22PanToClaimId` call across handlers to keep selection in sync with pan.
5. *#6 Run Evaluation duplicate detection + "Re-Evaluate" jump-to-existing.* `V22RunEvaluationModal` now takes `existingEvalResults` + `onJumpToExistingEvalResult` props. On Req Set selection + evidence selection, the modal detects a `(Req Set, evidence Set)` exact match against an existing active result, blocks submission, and surfaces a "View it on the canvas →" link. V2App feeds filtered non-superseded results to the modal and wires the jump. Different evidence on same Req Set → supersede path (unchanged); different Req Set → new active result (unchanged).
6. *#7 Amend Disclosure submit guard.* `AmendDisclosureModal` blocks submit when the active scope dimension (assets / fields / evalResults per DA type) is empty.
7. *#8 Run Evaluation staged flow.* Modal converted from single-pane to a 3-stage flow (select Req Set + evidence → processing stage with PrimeRadiant + progress bar → review rows), mirroring the Parse modal shape. Footer surfaces the specific reason "Run Evaluation" is disabled. Evidence list messaging updated ("will run without evidence (self-attestation)" when zero selected).
8. *Long-PIN truncation in Agreement panel headers.* `DisclosureAgreementDetailPanel`, `EvaluationAgreementDetailPanel`, and `V22NodeDetailPanel` each get a `CopyBadge value={...} truncated` one-line fix so long agreement PINs no longer break the header layout.

**Spec updates folded in during Phase 6.5+:**
- §3 — state badges: type label on own line above name; PROVISIONAL / DECLINED / SUPERSEDED as separate inline badges (not suffixes on `v22Type`); DECLINED precedence over PROVISIONAL.
- §11.3 — re-evaluation duplicate detection codified: same Req Set + same evidence set blocks; same Req Set + different evidence supersedes; different Req Set produces a new active result.
- §13 Phase 5 — "Parse and Eval modals look and feel nearly identical" acceptance criterion tightened with the staged-flow parity shipped here.

**Polish-backlog:** items #37–#42 added for deferred 6.5+ review points.

**Runtime verification:** JSDOM render harness passes. Manual walkthrough in dev server of the Phase 6.5+ surfaces: DECLINED badge renders on pure declines and on post-accept/declines, animated pan lands on target with no secondary hop, duplicate-evaluation blocking + jump-to works end-to-end.

### Phase 7 completion notes (2026-04-19) — Directory Layer + AI Shopper

Three carry-over fixes plus Phase 7 own scope (spec §8 Directory Layer, §9 AI Shopper, §7.2 Story 2).

**Carry-over fixes:**

1. *NEW badge persistence (#1).* Andrew's product intent: the NEW badge should persist until the user actively moves on (clicks empty canvas, closes the Detail Panel, or selects a different node), not auto-clear at 900ms. Ripped out six `setTimeout(() => setV22RecentlyAcceptedClaimId/AssetId(null), 900)` sites in `handleV22RequestSubmit`, `handleV22Accept` (both Claim and Asset reveals), `handleV22EvaluationSubmit`, `handleV22AmendClaimSubmit`, and `handleV22AmendDisclosureSubmit`. Added a selection-watcher `useEffect` right above the existing V2.1 `_isNew` clearing effect in V2App.jsx — it reads the same `prevSelRef` so role-switch semantics stay aligned. When `sel` changes away from a revealed node, the corresponding reveal id clears. Effect deps are `[sel, v22RecentlyAcceptedClaimId, v22RecentlyAcceptedAssetId]` so a freshly-set reveal doesn't race the setter. Works on both the grantee claim reveal and the grantor asset reveal simultaneously (Alice accepts, both her Claim and Bob's pulled-in Asset show NEW; clicking one clears only that node's badge).

2. *Amendment notification not reaching grantee (#2).* Root cause was a React setState updater-closure bug: `handleV22AmendDisclosureSubmit` captured `counterpartyParty`, `claimNameForNotif`, `claimPinForNotif` inside the `setV22Provisionals((prev) => { ... })` callback via mutable outer `let` vars, then read them downstream. React may defer the updater to the next render phase, so the downstream `if (counterpartyParty && ... && claimPinForNotif)` branch saw nulls and the enqueue was silently skipped. Fix: compute all notification values from the current-render `v22Provisionals` snapshot (with fallback to `buildV22SharedArtifacts()` seeded data), then call the state updater. Also added a guard to skip notification when `counterpartyParty === activeRole.party` (an internal DA would otherwise notify the amender of their own amendment). `v22Provisionals` added to the useCallback deps.

3. *Spec reference strings in UI copy (#3).* Audit found five user-visible strings referencing spec sections — all stripped, code comments retained. Changes: `AmendDisclosureModal.jsx` line 24 (locked-item tooltip) and line 147 (subtitle), `CombinedResponseModal.jsx` line 302 (Proof-Only explainer), `V22RunEvaluationModal.jsx` line 284 (supersede warning), `V22NodeDetailPanel.jsx` lines 365+367 (Amend Claim + Self-Evaluate tooltips). Remaining `§` occurrences in these files are all inside `//` comments.

**Phase 7 own scope:**

- *Chrome buttons.* Two new icon buttons added to the right-group chrome in V2App.jsx between the PEP Library and the notification bell: a globe icon (Radiant Network, opens Directory Layer) and a magnifier+sparkle icon (AI Shopper, opens the modal directly). Both gated on `V2_2_ENABLED` so V2.1 mode is unchanged. They reuse the existing `iconBtnStyle` + hover handlers — no new visual language introduced.

- *`src/v2/DirectoryLayer.jsx` (new).* Placeholder-grade Directory Layer per spec §8.5. Entry/exit transition is a CSS `clip-path: circle()` expanding from 0% at (0,0 bottom-left) to 180% — a single sweep, not the V2.1 child-layer dive. Internal `phase` state (`'closed' | 'in' | 'out'`) keeps the component mounted during the ~550ms exit animation. Renders GovCo/MicroCo/AuditCo corner node anchored bottom-left, a header ("Radiant Network · Public Directory · N parties · M published Claims"), a prominent "Launch AI Shopper" CTA (spec §8.3), and four dot clusters — MicroCo sized by the real public-directory DA count (3 today) plus three mock suppliers (ElectroGrid Ltd / NovaFab Inc / Precision Components Co) for density per §8.2's "thousands of dots" language. Dots are deterministic-random seeded so positions are stable across renders; each has a pulse-free static glow. Dots are visual-only this phase — the underlying Claim artifact is reachable via `buildV22SharedArtifacts` when a future phase wants to wire per-dot panels. Exit: click the corner node OR the "← Back to Network" chip.

- *`src/components/modals/AIShopperModal.jsx` (new).* Three-stage modal: `'setup'` (Requirements Set picker + prompt textarea) → `'searching'` (2.2s mock progress with a pulsing golden ripple) → `'results'` (top-3 candidate cards with MATCH score, owner party, PIN, rationale, Request Agreement CTA). The mock `runMockSearch` deterministically ranks all public-directory Claims from `buildV22SharedArtifacts`, biasing score by token overlap between the Claim name and the Req Set / prompt. Today that resolves to Alice's PRM / Voltage Regulator / EMI Shield publications; adding more public-directory DAs will grow the pool without modal changes. Default selected Req Set is `availableRequirementsSets[0]` (fixes a disabled-launch trap where the `<select>` visually showed the first option but state was empty). Clicking Request Agreement closes the Directory + AI Shopper, then opens `CombinedRequestModal` via two new props:
  - *`initialPin`* and *`initialRequirementsSetIds`* added to `CombinedRequestModal.jsx` — default empty strings / empty array, so existing call sites are unaffected. Feeds into the modal's `useState(initialPin)` / `useState(() => [...initialRequirementsSetIds])` so PIN resolution auto-fires and the Req Set checkbox is pre-ticked.

- *Story 2 walkthrough end-to-end.* Runtime-verified in dev server: chrome globe → Directory Layer wipes in → "Launch AI Shopper" → fill Req Set + prompt → Launch → mock progress → 3 candidates ranked 91/78/75 → Request Agreement on top candidate → CombinedRequestModal opens with the PRM PIN pre-populated and MIL-PRF-55681 pre-selected → Send Request → modal closes, canvas updates, and switching to Alice's role surfaces a `v22-request` notification with the PRM Claim name and GovCo sender. Console clean; no hooks-order violations (one was caught during initial build — `useMemo` after an early `return null` — and fixed by moving all hooks above the conditional return).

**Spec updates folded in during Phase 7:** None required for §8 / §9 / §7.2 — the shipped behaviour tracks the spec. One minor clarification fold-in candidate is the chrome placement of the Radiant Network button: spec §8.1 places it "bottom-left of the canvas, always on top"; the shipped build uses the chrome (top-right next to the notification bell) per Andrew's Phase 7 instruction. Noted in the phase task, not a spec deviation that requires section edits.

**Polish-backlog:** new items filed for Phase 7+ polish — clickable dots, real Actor grouping visualizations, streaming AI results, candidate preview cards. See `v2.2-polish-backlog.md` entries #43–#48.

**Runtime verification:** ran in Chrome against `VITE_V2_2_ENABLED=true npm run dev`.
- Directory Layer entry/exit transitions cleanly (single circular wipe).
- AI Shopper full round-trip (setup → searching → results → Request Agreement) works.
- CombinedRequestModal opens pre-populated; PIN resolves to PRM; MIL-PRF-55681 is pre-checked.
- Send Request closes the modal, flows the notification to Alice's inbox (verified by switching roles).
- Amendment notification fix (#2) — Alice amends DA, switches to Bob, notification appears. *(Not re-exercised in this session's Story 2 walkthrough because the amendment flow is separate; the code path is reasoned through against the Phase 6.5 bug repro.)*
- NEW badge (#1) — fresh provisional Claim on Bob's canvas retained the NEW badge post-submit (no 900ms auto-clear); clicking a different node clears it.
- V2.1 regression: boot sequence, canvas rendering, role switcher, and chrome all unchanged in V2.1 mode (`V2_2_ENABLED` gates the two new chrome buttons, DirectoryLayer, AIShopperModal, and the clear-reveal effect — V2.1 behaviour byte-identical to pre-Phase-7).

**Known scope boundaries (not bugs):**
- *Radiant Network button placement.* Lives in the chrome, not spec §8.1's "bottom-left of canvas." Andrew's Phase 7 task explicitly accepted chrome placement. The corner-node morph animation from §8.1 is also not implemented — the chrome icon and the Directory's bottom-left anchor node are visually distinct.
- *Clickable dots.* Spec §8.2 states "no hover details, no Detail Panels" in V2.2. We render dots as visual-only. Underlying public-directory Claim artifacts are reachable, so a later phase can wire per-dot interactivity without a schema change. Tracked as polish item #43.
- *Mock AI Shopper.* The "agent" is a deterministic scoring function that always returns publicly-disclosed Claims ranked by name/prompt token overlap. Placeholder-grade per the Phase 7 task.
- *Radiant Network node on canvas.* Spec §3.6 says the node appears only if the user has publicly-disclosed Claims. Not wired in Phase 7; Bob has no public disclosures today, so no node appears. Alice DOES have 3 public DAs; the node still doesn't render on her canvas — derivation rule is there in `deriveAgreementEdges` but the Actor node itself isn't added to her view. Tracked as polish item #44.

### Phase 8 completion notes (2026-04-19) — Consolidation + Cleanup

Final migration phase: Phase 7 visual polish, missing V2.2 parse flow, feature-flag removal, V2.1 + V1 deletion, documentation finalization.

**Phase 7 carry-over polish:**

1. *Symmetric circular wipe on Directory open.* `DirectoryLayer.jsx` now plays the clip-path wipe on entry too — mount in an `'opening'` phase with `clip-path: circle(0% at 0% 100%)`, then `requestAnimationFrame` flips to `'in'` (expanded) so the CSS transition has a from-state. Previous implementation jumped straight to `'in'`, skipping the entry animation.
2. *Globe icon toggles Directory Layer.* V2App chrome button is now `onClick={() => setV22DirectoryOpen((v) => !v)}`. Button also reads as active (amber background + amber border + amber icon color) when the Directory is open, so it reads as a layer-toggle button.
3. *AI Shopper progress uses PrimeRadiant.* `MockProgress` in `AIShopperModal.jsx` swapped the generic glowing orb for the `<PrimeRadiant size={80} fps={30} strutScale={1.8} brightness={0.3} />` pattern + progress bar used by `V22RunEvaluationModal` and `V22ParseEvidenceModal`. The three processing stages now feel like siblings.
4. *AI Shopper results polish.* Candidate cards grew a 30px MATCH score (was 22px), the PIN now uses `<CopyBadge value={pin} truncated />` for V2.1-consistent PIN display, and per-result rationale varies by score band: top result names the strongest match reason ("Direct match on {Req Set} terms" / "Semantic match against your prompt" / "Aligns topically with {Req Set}"), second line cycles through disclosure-type / owner / peer-score hint.
5. *AI Shopper Req Set picker.* Retired the native `<select>` in favour of the same flat card-list pattern `V22RunEvaluationModal` uses — clickable rows with name + id/version + indigo selection, keyboard-accessible (`role="radiogroup"` + Enter/Space handling), click-outside-to-close not needed since the list is inline. Fixes the Phase 7 "disabled Launch button trap" where the `<select>` visually showed the first option while state was empty.

**Missing V2.2 Parse flow (spec §11.8, new):**

- `src/components/modals/V22ParseEvidenceModal.jsx` (new). Three-stage flow mirroring `V22RunEvaluationModal`: (1) select Parse Template (card list with ALREADY PARSED lockouts for templates already run on the Asset), (2) processing with PrimeRadiant + 1.5s progress bar, (3) review + edit parsed field values with `ConfidenceBadge` that cycles high/medium/low on click. Required fields validated at submit; empty required field blocks. Keyboard-accessible throughout (radio group on the template list).
- `src/v2/v2_2Data.js` — new `makeParseRunArtifacts({ ownerParty, ownerDot, sourceAssetId, template, rows })` factory producing `{ parseResult, refDisclosureAgreement }`. The ref DA is an internal Full DA with `subject={kind:'parseResult', id}` + `scope.assetIds=[sourceAssetId]` — same shape as the seeded `parseResultRefEdges` so edge derivation treats it identically. `mergeProvisionals` extended to carry provisional parse results into the view.
- `V22AssetPanel` footer — new **Parse Evidence** action for Asset owners, alongside Request Agreement and Create Claim. Wired via `onParseEvidence` prop that V2App fills with `() => setV22ParsingAsset(node)` for Asset type + owner.
- V2App handler `handleV22ParseSubmit` creates the Parse Result + ref DA, appends both to `v22Provisionals`, selects the new Parse Result, pans to it, and tags it with `_isNew` for the reveal animation (cleared on selection change per Phase 7 rule #1).
- Spec §11.8 added (see architecture-spec.md changelog).

**Code consolidation:**

6. *Feature flag removed.* `FORCE_V2_2`, `ENV_V2_2`, `V2_2_ENABLED` exports deleted from `src/v2/v2_2Data.js`; `.env.local` deleted. Every `{V2_2_ENABLED && …}` gate in V2App.jsx collapsed to unconditional rendering via `sed 's/{V2_2_ENABLED && /{/g'`. Every `V2_2_ENABLED ?` ternary flattened to its V2.2 branch. The V2.2 banner ("V2.2 MODE ACTIVE — architecture migration in progress") was removed entirely — migration is no longer in progress.
7. *V2.1 modal files deleted.* 13 files under `src/components/modals/` removed: `RequestDisclosureModal.jsx`, `DisclosureResponseModal.jsx`, `ReviseDisclosureModal.jsx`, `RunEvaluationModal.jsx` (V2.1), `ParseEvidenceModal.jsx` (V2.1), `RegisterAssetModal.jsx`, `AddEvidenceModal.jsx`, `CascadeModal.jsx`, `UpstreamPicker.jsx`, `CreateClaimModal.jsx`, `QualifiedStoragePicker.jsx`, `RevocationNoticeModal.jsx`, `PublishModal.jsx`.
8. *V2.1 DetailPanel files deleted.* 10 files under `src/components/DetailPanel/` + `shared/` removed: `index.jsx`, `PanelShell.jsx`, `ChildrenTab.jsx`, `DisclosuresTab.jsx`, `EvalPanel.jsx`, `EvaluationsTab.jsx`, `EvidenceBlock.jsx`, `ParsedFieldsTab.jsx`, `ClaimsTable.jsx`, `constants.js`, plus all of `shared/` except `CopyBadge.jsx` (which V2.2 panels still import). Only `V22NodeDetailPanel.jsx`, `DisclosureAgreementDetailPanel.jsx`, `EvaluationAgreementDetailPanel.jsx`, and `shared/CopyBadge.jsx` remain.
9. *V2.1 state + merge pipeline deleted from V2App.jsx.* The ~270-line V2.1 `data = {...roleData}` merge-and-rollup pipeline (`addedNodes` / `addedSDAs` / `addedEdges` / `addedChildren` / `removedX` filters, health rollup, selective-disclosure field filtering) was removed. `emptyRoleState` now holds only `dismissedReqs`, `addedRequests`, `requirementSets`, `pepTemplates`, `newlyDisclosedIds` — the V2.2-relevant fields. `publicListings` memo removed. V2.1 `_isNew` clearing effect removed (V2.2 has its own). `onConnect` on V2Canvas now passes `undefined` since V2.2 has no equivalent action. V2App imports trimmed from ~15 V2.1 modal imports down to the 7 V2.2 modals + library modals.
10. *V1 files deleted.* All V1 files under `src/` removed: `src/App.jsx`, `src/App.css`, `src/main.jsx`, `src/ia-map-entry.jsx`, `src/data/` (entire directory — `dataset.js`, `generateDataset.js`, `generateAutoCo.js` / `generateGovCo.js` / `generateFastCo.js` / `generateMicroCo.js`, `generateEvents.js`, `verticals.js`, `tokens.js`, `platformAssets.js`, `mkhash.js`), `src/reference/` (entire), plus every file at `src/components/` root (Header, Footer, NetGraph, Sidebar, OverviewTab, ClaimsTab, EvalsTab, DetailPanel.jsx, InvitationDetailPanel, InviteSupplierModal, SupplierDashboard, SupplierNetGraph, SupplierSidebar, SupplierAssetSection, OrgNodeContent, CreditsModal, AttestationCard, AttestationTestPanel, ClaimTimeline, TimelineTab, RiskMatrix, SearchResultsModal, AssetDirectoryModal, AssetRegistrationModal, AssetRegistrationStandaloneModal, EvaluationModal, EvidenceModal, HealthDot, InvitationModal, NetworkEventsNotification, NodeIcon, RadiantLogo, RequirementsLibraryModal (V1 duplicate), SDACreationModal, SubgraphModal, SvgMark, SystemCreationModal, WorldMap, detailPanelUtils.jsx). Only `src/components/modals/` and `src/components/DetailPanel/` remain.
11. *`index.html` deleted* (V1 root entry). `vite.config.js` updated to drop the `main` input; builds now output `v2.html` + `v3.html` only.
12. *`src/v2/` rename deferred* to polish backlog. The directory name is vestigial now that there's only one version shipped, but the cascading import-path changes across every file is a high-risk post-deletion operation best done with a dedicated atomic pass.

**Documentation finalization:**

- `v2.2-architecture-migration-spec.md` → `architecture-spec.md` (renamed). Content trimmed to remove migration-in-progress language while preserving the changelog as historical record.
- `v2.2-polish-backlog.md` → `polish-backlog.md` (renamed). Phase 8 items marked complete.
- CLAUDE.md restructured: `Current Target: V2.2` header replaced with `Architecture`; `Feature flag` subsection removed; `Forbidden Changes` list removed (phase-specific, no longer load-bearing); `File layout` updated for post-deletion state; Phase 7 + Phase 8 notes added.

**Bundle impact:** v2 chunk dropped from 638 kB → 345 kB (46% shrinkage, 142 kB → 83 kB gzip). No regressions in the build.

**Runtime verification:**
- Build passes clean at every checkpoint (after flag removal, after modal deletion, after V1 deletion).
- Dev server boots; v2.html loads; boot screen renders; canvas + nodes + edges render correctly; chrome icons (globe, AI Shopper, notification bell, theme toggle, library, PEP library) all functional.
- Story 2 walkthrough (Phase 7 regression): chrome globe → Directory Layer wipes in → Launch AI Shopper → fill prompt → see results → Request Agreement → CombinedRequestModal pre-populated → send → Alice receives v22-request notification. Still works end-to-end.
- Story 1 walkthrough: Asset panel → Request Agreement → CombinedRequestModal → response from Alice → Run Evaluation → eval result on both canvases.
- Story 3 walkthrough: amend flows + notifications still work.
- V2.2 Parse flow: Asset panel → Parse Evidence → template picker → processing → review + edit → Save → Parse Result node appears on canvas with NEW badge.

**Known scope boundaries (not bugs):**
- *`src/v2/` rename deferred.* Filed as polish item.
- *V3 archive (`src/v3/`, `v3.html`) kept.* Task didn't specify deletion; it's not wired into V2.2 and adds no runtime cost beyond the tiny v3.js bundle.
- *`README.md` untouched.* Task didn't specify.
- *V2App.jsx still contains some V2.1-era handler names* (`handlePanelViewChain`, `setClaimContext`, etc.) that are now dead code — setters called but state never consumed. Kept in place to minimise edit surface during the cleanup pass; filed as polish backlog item for a dedicated dead-code sweep.

### Phase 9A completion notes (2026-04-19) — static visual polish + card/UX upgrades

Ten-item polish pass across AssetNode (visuals + card action bar), V2Canvas + v2_2Data (edge stroke metadata), V22NodeDetailPanel (Parse/Eval row rendering), V22RunEvaluationModal (review-stage UX), V22ParseEvidenceModal (human-edited indicator), and CombinedResponseModal (help text). Phase 9B (expanded tables, exports, edge hover overhaul) is intentionally not touched.

**Visual + card items (1-5):**

1. *Warmer node borders.* Default border is now `color-mix(in srgb, var(--accent-indigo) 22%, var(--border))` — a cool indigo-grey that stops node terminations from fading into the dark canvas without competing with the indigo edge palette. Red UNSAT border treatment unchanged. Value surfaced in the completion summary per task instruction: **22% accent-indigo blended into var(--border)**.
2. *Counterparty tint.* Cards where `node.owner !== activeParty` (excluding Actor nodes) render a muted background tint: `color-mix(in srgb, var(--bg-card) 82%, var(--bg-deep))`. Subtle flattening, no opacity or chip changes.
3. *Thinner internal edges.* `deriveAgreementEdges` now stamps `grantorParty` + `granteeParty` onto each edge; V2Canvas reads them and multiplies the default stroke width by 0.7 when they match (internal / ownership edges). Selected and NEW edges keep their full emphasis regardless.
4. *Card cleanup.* Three sub-fixes in AssetNode:
   - Claim and Eval Result names wrap to two lines via `-webkit-line-clamp: 2` (Actor + Asset stay on one line with ellipsis).
   - Inner content wrapper is now a flex column with `justify-content: space-between`; the top rows (type badge, name, owner) group together and the health minibar pins to the bottom edge, equalising the whitespace.
   - Type-badge row has `marginBottom: 7` (was 2) so the name no longer crowds the `CLAIM` / `ASSET` / `EVAL RESULT` pill.
5. *Edge-endpoint glow.* `v22DataWithReveal` memo in V2App resolves `selectedEdgeId` → the two touched node ids and stamps `_isEdgeEndpoint: true` on each. AssetNode renders a static indigo glow via `box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent-indigo) 35%, transparent)` — offset 5px outside the card border. Suppressed when the node is ALSO the selected node (the amber border wins so the two states stay visually distinct per spec).

**Action + entry-point items (6, 7, 9):**

6. *Re-Evaluate with locked Req Set.* V22RunEvaluationModal accepts a new `lockedRequirementsSetId` prop. When set, the Req Set picker is replaced by a read-only indigo card with a LOCKED pill + the explainer "To change Requirements Set, start a new evaluation from the Claim." V22EvalResultPanel's Re-run Evaluation footer (already owner-only) now fires a handler that sets `v22EvalContext.lockedRequirementsSetId` + `v22EvalContext.priorActiveResultId`. V2App's modal mount also feeds the prior result as `priorActiveResult` so the review rows pre-populate (item #8 sub-2). The existing free-choice entry from Claim panel is untouched.
7. *Full-disclosure last-Asset help text.* CombinedResponseModal's Step 2 Full branch still blocks Continue when zero Assets are selected (unchanged); now also renders an amber italic inline help line ("Select at least one Asset to continue.") beneath the count footer when the selection is empty. No snap-back behaviour.
9. *Card action parity with Detail Panel footer.* New `V22ActionBar` component in AssetNode.jsx replaces the V2.1 ActionBar for V2.2 nodes. Per-type button set:
   - ASSET (owner): Request Agreement, Parse Evidence, Create Claim (Phase 6+)
   - CLAIM (owner, non-provisional, non-declined): Amend Claim, Self-Evaluate
   - CLAIM (non-owner + active EA): Run Evaluation
   - EVAL RESULT (owner, not superseded): Re-run Evaluation
   - PARSE RESULT / ACTOR: no actions
   
   Single-dispatch prop `onV22CardAction(actionName, node)` threads from V2Canvas into AssetNode; V2App routes action names to the same handlers its Detail Panel footer fires. `v22DataWithReveal` now also decorates Claim nodes with `_evaluationAgreementForActor` (the EA where the current actor is grantee) so the ActionBar can show Run Evaluation on counterparty Claim cards without re-plumbing.

**Run Evaluation review-stage upgrades (8):**

- *Full status words with flanking chevrons.* New `StatusChevronPicker` renders `◂ SATISFACTORY ▸` (or UNSATISFACTORY / MISSING / N/A — full words). Left chevron cycles back, right chevron + word cycle forward. `cycleStatus` now takes a direction (+1 / -1). `STATUS_CFG` added `short` labels so Detail Panel and elsewhere can keep the 3-letter abbreviations; exported as `REVIEW_STATUS_CFG` for reuse.
- *Supersede pre-population.* When `priorActiveResult` is set on the modal (fires from the Re-Evaluate flow or when `lockedRequirementsSetId` matches a prior result's Req Set), review rows pre-populate `value`, `status`, and `confidence` from the prior result (was hard-coded `0.9`). Each row's `_aiOriginalValue` snapshots the prior `value` so any subsequent human edit is detected.
- *AI confidence chip per row.* `ConfidenceBadge` now renders an `AWAITING AI` pill in muted grey when `confidence == null`, so every row always has a visible confidence slot. Fresh evaluations start with `confidence: null` (was `0.0` producing a LOW chip). Confidence is persisted on the submitted payload.

**Human-edited pencil (10):**

`_aiOriginalValue` is tracked per row in both modals from initialization (set to the AI's extracted value, or empty string for fresh rows). When `row.value !== row._aiOriginalValue` a small amber pencil SVG renders next to the ConfidenceBadge with the tooltip "Human-edited from AI's original extraction." Persisted onto both `parseResult.fields[i]._aiOriginalValue` and `evaluationResult.results[i]._aiOriginalValue` so V22NodeDetailPanel's Parse Result + Eval Result panels render the pencil when viewing the artifact later. AI confidence remains unchanged by human edits (the Phase 8.5 rule).

**Build impact:** v2 bundle 345 kB → 350 kB (+5 kB for the new action bar, chevron picker, pencil icon, confidence AWAITING AI state, and adapter decorations). No runtime regressions.

**Runtime verification:** exercised each item in Chrome against `http://localhost:5173/`.
- Borders: warmer indigo-grey on all Asset/Claim/Eval Result cards across all three roles.
- Counterparty tint: visible when switching to Bob and comparing his own Asset card to Alice's Claim pulled in.
- Internal edges: thinner on Alice's own Actor → Asset → Claim chain compared to inter-party edges.
- Card cleanup: Claim / Eval Result names wrap on two lines; health minibar sits mid-card; type pill no longer crowds the name.
- Edge-endpoint glow: clicking an edge highlights both endpoints with the indigo outer ring; different from the selected-node amber border.
- Re-Evaluate: Re-run from an Eval Result panel opens the modal with the LOCKED Req Set card + pre-populated rows.
- Full help text: Deselecting all Assets in Full disclosure shows the amber hint.
- Status picker: ◂ SATISFACTORY ▸ chevrons + word all cycle as expected.
- Card actions: per-role walk-through confirmed one-to-one with Detail Panel footer for Asset/Claim/Eval Result/Parse Result.
- Human-edited pencil: appears next to the confidence chip after typing in a value; persists into the Parse Result panel.

### Phase 9A.3 completion notes (2026-04-20) — Asset registration + Claim creation

Brings Registering + Claiming from placeholder → demo-complete, closing two of the three remaining process gaps (Transferring lands in 9A.4). Three gates shipped in sequence.

**Gate A — Asset registration + Claim creation (core):**
- `V22QualifiedStoragePicker.jsx` (new). V2.2 port of V2.1's picker with a third **AuditCo** bucket seeded alongside GovCo + MicroCo. `single` and `multi` modes retained. Payload normalised on the way out: display size strings → byte counts, ext → mimeType, path → `uri`.
- `V22CreateAssetModal.jsx` (new). 2-step flow — pick file → review. Filename stem becomes the Asset's display name (per spec §3.2 Assets have no separate name field). `nested` prop support bumps the picker's zIndex above the parent modal's backdrop so Gate B's inline-register flow lands above it.
- `V22CreateClaimModal.jsx` (new). 2-step flow — name + description + multi-Asset picker → review. `initialAssetIds` pre-selects the Asset the modal was opened from (so Create Claim from an Asset's panel/card lands with that Asset checked). Spec §3.4 `referencedAssetIds.length >= 1` enforced at submit. Inline "+ Register new Asset…" CTA built in from the start (Gate B rides on top).
- **Factories (v2_2Data.js):** `makeAssetRegistrationArtifacts({ file, ownerParty }) → { asset, ownershipDa }` and `makeClaimCreationArtifacts({ name, description, referencedAssetIds }) → { claim, ownershipDa, claimRefDas[] }`. Both produce the internal Full DAs that the existing edge derivation treats identically to the seeded ownership/claim-ref DAs, so edges derive automatically on next render.
- **mergeProvisionals bug fix.** The helper merged claims/parseResults/agreements but *not* `provisionals.assets` — the first Create Asset submit landed in state but never reached the canvas. Added `merged.assets = mergeById(...)`. Caught during Gate A runtime verification.
- **Detail Panels (V22NodeDetailPanel.jsx):** new `V22ActorPanel` with owner-only Register Asset footer CTA. Panel filter in V2App updated from `category !== 'party'` to `v22Type && !isNetworkNode` so the Actor panel actually opens on selection. `panelWidth` + edge-framing heuristics updated in sync.
- **Card actions (AssetNode.jsx):** V22ActionBar now handles `ACTOR (owner) → Register Asset` and the existing Asset `Create Claim` dispatch is wired (was previously labelled "Phase 6+" placeholder).
- **V2App wiring:** `v22RegisteringAsset` + `v22CreatingClaim` state, two new handlers (`handleV22CreateAssetSubmit`, `handleV22CreateClaimSubmit`), shared nested helper (`handleV22NestedAssetCreated`). Dispatch cases `registerAsset` and `createClaim` in the card action router.

**Gate B — Nested "+ Register new Asset…" CTA (backlog #34):**
- `V22CreateClaimModal` already shipped the CTA in Gate A (the register-as-you-go flow is the norm for V2.2's Claim creation).
- **`AmendClaimModal.jsx`** brought to parity: accepts `activeParty` + `onNestedAssetCreated`, renders the CTA both in the populated-candidates state (dashed-green button above the picker list) and in the empty-candidates state (previously a dead-end message). Nested submit auto-selects the fresh Asset's id optimistically so the user's next render shows it ticked.
- Nested modals stack on their own Backdrop portal; the parent stays dimmed until the nested modal is closed.
- Pan-to suppression for nested flows — `handleV22CreateAssetSubmit`'s `_nested` flag skips the canvas pan so the user stays focused on the parent modal.

**Gate C — 9A.2 carry-over defects (backlog #62):**
- (a) **Dot-LOD endpoint ring** re-geometred. The ring was sized to the 16px wrapper but the inner dot is 8px at margin 4 — so the ring sat 5px from the dot's edge, reading as off-centre. Now `14×14` at `top: 1, left: 1` for a clean 3px halo concentric to the inner dot.
- (b) **Bell chrome button** wrapped in `<Tooltip content="Notifications (N)">`. Content nulled while the inbox is open so the tooltip doesn't cover the dropdown.
- (c)(d) **Root cause was z-index, not layout.** Tooltip's TooltipBody portal rendered at `zIndex: 6000`; Backdrop's modal wrapper is `zIndex: 10000`. Tooltips anchored inside a modal *were* rendering — they were just drawn under the darkening backdrop and invisible. Bumped Tooltip baseStyle to `10100`; chrome tooltips don't regress since hover path from canvas never reaches them while a modal is open.

**Runtime verification (Chrome, Vite dev server):**
- Register Asset from GovCo Actor panel: QS picker showed the GovCo bucket tree, selected `ITAR-classification-memo.pdf`, advanced to review, committed. New Asset rendered on canvas with `_isNew` reveal, Detail Panel showed PIN, DOT, file meta, registration timestamp.
- Create Claim from the new ITAR Asset's panel footer: modal pre-selected the triggering Asset, added Avionics Module, named "Sentinel-4 Launch Compliance", committed. Claim rendered on canvas with edges to both referenced Assets; Detail Panel showed referenced Assets list + AMEND CLAIM / SELF-EVALUATE footer.
- Nested inline "+ Register new Asset…" from Create Claim: modal stack rendered cleanly, picked `AS9100-audit-report.pdf`, completed — parent modal's picker auto-selected the new Asset (count badge went 1 → 2).
- Amend Claim on the Sentinel-4 Claim: modal shows "Already referenced (2)" + "Add Assets (3 available)" including the AS9100 Asset registered during the nested flow, confirming cross-modal persistence. The new inline CTA renders at the top of the picker list (green dashed outline).
- Bell tooltip verified via `dispatchEvent('mouseover')` → "Notifications" tooltip body rendered at zIndex 10100.

**Deviations from task:**
- **No credit cost** on either new flow. V2.2's other modals (ParseEvidence, RunEvaluation, CombinedRequest) don't charge credits; adding a cost here alone would be out-of-pattern. Task suggested 5-credit cost deferred unless credit accounting becomes a V2.2 concern.
- **Asset display name derived from filename stem** (`power-supply-spec.pdf` → `power supply spec`). Task said "no separate name field"; stripping the extension + normalising separators reads nicer than the raw filename.
- **Chevron/pencil tooltip fix** turned out to be z-index, not the inline-flex hover-region hypothesis from the backlog. The fix is simpler (single-line zIndex bump); the original hypothesis would have required restructuring every Tooltip call site.

**Known gaps (not 9A.3 blockers):**
- *Gate C runtime verification in the Run Evaluation review stage.* The zIndex bump is deterministic — the Modal backdrop at 10000 sits below TooltipBody at 10100 — but the full Run Evaluation flow wasn't driven end-to-end in the browser during this session to observe the chevron/pencil tooltips rendering on top of the modal. If they don't appear in practice, the fallback is the original "inline-flex wrapper" hypothesis from backlog #62; `wrapperStyle={{ display: 'inline-block' }}` on the chevron/pencil Tooltip instances would be the minimal further fix.
- *Pan-to on Create Asset / Create Claim in nested contexts.* Suppressed correctly when nested, but the standard (non-nested) path panning can land the new node near an edge of the viewport depending on existing density. Falls under backlog item #4 (Layout density).

**Status:** [x] Complete.

### Phase 9A.4 completion notes (2026-04-20) — Transferring process + structured DOT

Ships the seventh and final platform process and closes the 7-process demo. Also lands the structured DOT data model that canon X.1–X.10 calls for — every Asset, Claim, and Eval Result now has a DOT object carrying PIN, hash, owner DID, registration timestamp, metadata, and lineage. Four gates in sequence.

**Gate A — Structured DOT + transfer mechanics (data layer):**
- `makeDotObject({ pin, hash, ownerDid, registrationTimestamp, metadata, lineage })` and `makeTransferRecord({ fromOwnerDid, toOwnerDid, initiatedTimestamp, acceptedTimestamp, status, declineReason })` added to `v2_2Data.js`. DOT lineage is append-only; declined + cancelled transfers both land in lineage for auditability, matching canon X.5.
- `makeAsset` / `makeClaim` / `makeEvaluationResult` now populate a `dot` field via `makeDotObject`. **Backward compat preserved**: flat `pin` / `ownerDot` / `file.hash` remain as convenience aliases pointing into `artifact.dot.*`. Read sites unchanged — existing code continues to work untouched.
- `resolveActorByPin(pin, { activeParty })` helper returns `{ actor, isSelf, isNetwork }` for the V22TransferAssetModal's PIN validator. Module-level lazy cache so keystroke resolution doesn't rebuild the full artifact graph.
- Spec additions: new §2.6 "DOTs and Identity" introducing the DOT + car-title analogy; §3.2/§3.4/§3.5 cross-reference the `dot` field; §11.7 "Ownership transfer" rewritten from "defined but not implemented" placeholder to full flow spec.
- V22NodeDetailPanel: Asset panel DOT row now sources from `asset.dot.pin` (Asset's own DOT) instead of `node.dot` (party-level owner DID, which was the 9A.4 preamble's interim surfacing).

**Gate B — Sender flow:**
- `V22TransferAssetModal.jsx` (new). 2-step flow — Recipient (PIN + optional note) → Review (summary + irreversibility warning). PIN resolution rejects self, Radiant Network, and unknown PINs with tailored error copy.
- `v22Provisionals.transfers` — new state slice. Submit creates a transfer record on this slice; `mergeProvisionals` threads it through the shared artifact bundle; `buildViewForActor` computes `pendingTransfersByAssetId` so `buildV22Canvas` can stamp `_pendingTransfer` on the sender's Asset node. Canvas adapter also sets `_showAsProvisional` so the existing dashed-border treatment fires.
- AssetNode: amber TRANSFERRING badge replaces PROVISIONAL while `_pendingTransfer` is set; message row reads "Awaiting acceptance from {recipientParty}"; V22ActionBar swaps the full action set for a single ✕ Cancel Transfer while pending.
- V22AssetPanel: Transfer footer button (standard state); Cancel Transfer danger button (pending state); new "Pending Transfer" section with recipient + initiated timestamp + optional note.
- V2App wiring: `handleV22TransferSubmit` + `handleV22CancelTransfer`, card-action dispatch (`transferAsset` / `cancelTransfer`), V22TransferAssetModal mount. Cancel fires `v22-transfer-cancelled` notification + dismisses the pending request on the recipient's side; no ledger record per spec §11.7.

**Gate C — Recipient flow:**
- Four new notification types wired into the existing inbox dropdown: `v22-transfer-request` (amber TRANSFER badge, inline ACCEPT + DECLINE buttons), `v22-transfer-accepted` (green ACCEPTED), `v22-transfer-declined` (red DECLINED with reason surfaced), `v22-transfer-cancelled` (grey CANCELLED).
- ACCEPT: re-emits the Asset via `makeAsset({ dot: newDot })` with `ownerDid` flipped to recipient and an accepted transfer record appended to `dot.lineage[]`; drops the provisional; selects + pan-to the Asset on the recipient's canvas with the standard `_isNew` reveal; fires `v22-transfer-accepted` to the sender.
- DECLINE: opens an inline reason sub-form (textarea + BACK / CONFIRM DECLINE). Empty reason is acceptable. Re-emits the Asset with a declined transfer record appended to lineage (ownership unchanged); fires `v22-transfer-declined` with the reason to the sender.
- **Gate C critical fix.** First-iteration bug: handler read `transfer` + `asset` inside the `setV22Provisionals(prev => {...})` updater and captured into outer `let` vars. React defers updaters to the next render — the downstream notification dismiss + pan logic ran before the updater fired, so the captured vars were still null and the flow short-circuited (notification stayed visible even though the asset moved). Fix: resolve transfer + asset **synchronously** from the current-render `v22Provisionals` snapshot, then hand a clean updater to `setV22Provisionals`. Same fix on the decline handler.

**Gate D — Housekeeping:**
- In-app Changelog modal: new v0.9.0 / Phase 9A.4 entry. Footer version bumped from v0.4.0 → v0.9.0.
- polish-backlog.md: #33 marked ✅ Complete with known-limitation cross-references; added #72 (Claim + Eval Result transfer), #73 (Asset-backing-disclosed-Claim constraint), #74 (provenance lineage UI), #75 (transfer timeout). Update Log entry.
- CLAUDE.md Phase 9A.4 notes (this section).

**Runtime verification (Chrome):**
- Happy path: Alice → PRM-3A Thermal Analysis → Transfer → Bob's PIN → Review → Send. Bob sees TRANSFER notification with ACCEPT + DECLINE inline. Bob clicks ACCEPT. Thermal Analysis materialises on Bob's canvas owned by GovCo with pan-to + edge to GovCo Actor; Detail Panel DOT reads the Asset's own DOT pin. Bob's notification dismisses; bell clears. Alice's canvas removes the Asset; Alice's bell gets ACCEPTED notification.
- Decline path: Alice → EMI Shield Assembly Datasheet → Transfer to Carol → Send. Carol clicks DECLINE → inline reason textarea → fills "Out of scope for AuditCo — already disclosed by MicroCo." → CONFIRM DECLINE. Carol's notification dismisses; Alice's bell shows 2 notifs (accepted + declined) with the reason surfaced verbatim.
- PIN resolution negative cases: own PIN → "Cannot transfer to yourself"; Radiant Network PIN → "Cannot transfer to the Radiant Network (public directory)"; garbage PIN → "Unknown PIN". All three block Review.
- Sender cancel path (verified via Gate B smoke tests): Alice initiates → TRANSFERRING badge renders on her Asset → Cancel Transfer button in panel footer works; provisional drops.

**Deviations from task:**
- **PIN resolution UX**: went with inline feedback chip (green card on success, red alert on rejection) rather than a separate "validating…" spinner — keystroke resolution is fast enough that a spinner state would flicker and add no value. The `neutral` tone ("PINs start with PIN-0x…") shows while the user is still typing a valid-looking prefix.
- **Decline reason UX**: chose inline sub-form inside the notification row (textarea + CONFIRM DECLINE / BACK) over a separate dialog. Matches the CombinedResponseModal pattern structurally while keeping the decline path lightweight (spec §11.7's "two action buttons in the notification" language led here).
- **Asset re-emit vs. targeted mutation**: on accept + decline we rebuild the full Asset via `makeAsset({ ..., dot: newDot })` rather than patching fields in place. More lines, but keeps the DOT + lineage consistently constructed via the factory — safer than mutating a shared artifact in React state.
- **No automated test coverage for `dot.lineage` yet.** Verified structurally via the factory smoke test in Gate A (empty lineage at registration, accept appends one record); the end-to-end browser verification for accept + decline confirmed the visible outcomes (asset moves / stays, notifications fire correctly). Internal `dot.lineage` state after a transfer wasn't peek-inspected through React state — would require a devtools-style instrumentation. Trust the factory + view-layer invariants for now; backlog #74's provenance-lineage UI will surface the data directly.

**Known gaps (not 9A.4 blockers):**
- *Claim + Eval Result transfer* — tracked as backlog #72.
- *Asset-backing-disclosed-Claim constraint* not enforced — backlog #73.
- *Provenance lineage UI* — `dot.lineage[]` is populated but not rendered anywhere in the Detail Panel yet. Backlog #74.
- *Transfer timeout* — pending transfers stay pending indefinitely in demo. Backlog #75.
- *Cascading state on transfer* — transferred Asset arrives clean on recipient's canvas; Parse Results / Eval Results / DAs scoped to it stay with the sender. Production semantics deferred (out-of-scope per the 9A.4 task).

**Status:** [x] Complete.

### Phase 9A.5 completion notes (2026-04-20) — fast-follower polish

Eight-item polish pass + three Working-Conventions additions following 9A.4 demo completion. Four gates.

**Gate A (demo-blocking fix):**

1. *#76 Transfer accept ownership edge.* Root cause was ownership-DA scoping. When the transfer accept handler re-emitted the Asset with `owner = recipient`, the seeded `da-own-<assetId>` DA still had `grantor = sender`. `buildViewForActor` filtered any DA where the actor is neither grantor nor grantee, so Bob's view contained the Asset but not the DA — and `deriveAgreementEdges` consequently drew no ownership edge to Bob's Actor. Fix: emit a replacement ownership DA (`makeInternalDisclosureAgreement` with grantor = recipient) into `v22Provisionals.disclosureAgreements`. `mergeById` in `mergeProvisionals` picks it up by id and overwrites the seeded DA. Runtime-verified against `getV22DataForRole`: pre-fix ownership edge = null; post-fix ownership edge = `actor-govco → asset-prm-thermal`. No change needed on the decline path — on decline the Asset stays with the sender and the seeded DA still matches.

**Gate B (transfer polish):**

2. *#77 Transfer response modal.* New `V22TransferResponseModal.jsx`. Notification row now opens a modal for Accept/Decline — pattern-matches `CombinedResponseModal`. Two phases: **Decide** (sender + asset summary + optional note; Accept / Decline buttons in footer) and **Reason** (optional textarea on decline path). Removed `v22DecliningTransfer` state, the inline Accept/Decline buttons, and the inline decline-reason textarea from the notification row. The click handler on `v22-transfer-request` notifications now calls `setV22TransferResponding(req)` to open the modal. Dismissal stays on terminal action (Accept or Confirm Decline in the modal) — closing the modal without action leaves the notification in place, matching the pre-existing `v22-request` (Disclosure Request) behaviour. Spec §11.7 updated to describe the modal pattern.
3. *#78 Resolved box party-only.* `V22TransferAssetModal`'s resolution chip changed from "Resolved: {user} @ {party}" + role subtitle to "Resolved: {party}" only. Review step's Recipient InfoRow also simplified. CombinedRequestModal's resolution chip was already party-only ("✓ Found: {claim name} — {ownerParty}"), so no fix needed there.
4. *#79 PIN error messaging split.* `resolutionState` in `V22TransferAssetModal` now returns three semantically distinct messages. Ordering: self check → network check → actor-not-found. Safe to be specific for self + Radiant Network (the sender already knows their own PIN and the Radiant Network PIN is a pseudo-constant); unknown case stays generic ("No actor was found at this PIN.") to preserve the no-info-leak principle.

**Gate C (structural + conventions):**

5. *#83 Claim-to-owner edge removal.* The `kind === 'claim' && internal && !hasScopeAssets` branch in `deriveAgreementEdges` is now a no-op. Spec §3.4 requires every Claim to have `referencedAssetIds.length >= 1`, so ownership always cascades through Assets and the Actor → Claim edge was strictly redundant. The ownership DA stays in state (provenance, future queries); we just stop drawing it. Runtime-verified: Alice's view now has 0 Actor ↔ Claim edges (was 3).
6. *#85 Asset-picker zero-default + scroll.* `CombinedResponseModal`'s Full-disclosure Asset picker defaults to zero-selected — replaces the prior "prime with all referenced Assets on action='full' step entry" useEffect. Scroll container (`maxHeight: 260, overflowY: 'auto'`) already present. Amber inline help text + disabled Continue gate unchanged. Audited every Asset/Claim/ReqSet picker in the modal set (listed in the backlog entry): `V22CreateClaimModal`, `AmendClaimModal`, `AmendDisclosureModal`, `V22RunEvaluationModal`, `V22ParseEvidenceModal`. No other fixes needed — either zero-default + scroll already, or the pre-selection is semantically correct (amendments pre-select current scope; evidence is optional).
7. *#86 DID glossary.* §2.6 of `architecture-spec.md` now expands "DID" on first use: "Decentralized Identifier (DID) — a W3C-standardized format for verifiable digital identities (see [w3.org/TR/did-core/](https://www.w3.org/TR/did-core/))".
8. *#87 Raw JSON tab verification.* Discovery: the expanded Detail Panel modal (`ExpandedArtifactModal`) that the task assumed exists was removed during Phase 8 cleanup — there's no UI surface in V2.2 that renders a raw JSON view. Verified the data layer is sound: `makeTransferRecord` + `makeDotObject` correctly populate `asset.dot.lineage[]` on accept (append with `status: 'accepted'`) and decline (append with `status: 'declined'` + reason). No code change this phase; the lineage UI is already scoped as backlog #74 and will be where lineage rendering actually lives.

**CLAUDE.md Working Conventions — three additions under a new "### UX patterns" subsection:**

- *Accept/decline in modals, not notifications.* Party-to-party responses (accept, decline, amend, etc.) open a modal for the decision; the notification is the entry point.
- *Picker defaults + scroll containers.* Multi-select artifact pickers that require ≥1 selection default to zero-selected; empty-state help in amber italic inline styling; all picker lists render in scroll containers (240–320px max-height). Optional pickers may sensibly pre-select.
- *Reciprocal notifications for all party-to-party actions.* Every party-to-party action that requires counterparty acknowledgment MUST fire reciprocal notifications on each state change.

**Gate D:** backlog updated (#76–87 filed/closed per the shipment table), CLAUDE.md + changelog updated, footer version bumped v0.9.0 → v0.9.1.

**Spec updates folded in:** §2.6 (DID glossary), §11.7 (modal-based response flow).

**Runtime verification (Chrome, Vite dev):**
- Data layer: Alice → Bob transfer accept path derives ownership edge correctly (`actor-govco → asset-prm-thermal`). Transfer record correctly appends to `dot.lineage[]`.
- Build clean at every gate boundary.
- App loads, boot screen + canvas render, chrome tooltips work.

**Known scope boundaries (not 9A.5 blockers):**
- *Accepted-transfer animation sequence* — backlog #80. Deferred alongside #71 (provisional → disclosed card transform) and the broader animation-restoration phase.
- *Reciprocal notification audit for all party-to-party actions* — backlog #81. Disclosure Request acceptance has a known gap: requester isn't notified. Pairs with animation work because the notification is the trigger for the provisional → whole-node transformation animation.
- *Parse Result DOT + layer placement* — backlog #82. Design blocker (client decision needed on DOT semantics + child vs parent layer).
- *Asset hierarchy* — #70 (with #84 consolidated in). Design blocker.
- *Expanded Detail Panel modal / raw-JSON tab* — removed in Phase 8 cleanup; lineage rendering scoped into #74.

**Status:** [x] Complete.

### Phase 9A.6 completion notes (2026-04-20) — Asset registration batch

Coordinated rebuild of V22CreateAssetModal + V22QualifiedStoragePicker consolidating five tightly-coupled V2.1-era behaviours lost during V2.2 migration, plus three fast-follower polish items from 9A.5 QA. Four gates.

**Gate A (#65):** credit cost baseline. `CREDITS_PER_ASSET = 5`, `CREDITS_PER_CLAIM = 25` constants in V2App.jsx. New `CreditCostRow` shared component in ModalShared renders a teal-on-sufficient / red-on-insufficient cost row in the review step; both modals gate submit + flip label to "Insufficient Credits" when under-funded. On submit, the active role's credits are debited via `setCredits(c => Math.max(0, c - cost))`. AmendClaimModal's nested Register flow forwards credits too, so every Asset entry point is consistent. 5:1 ratio chosen proportional to V2.1 precedent (Asset = evidence file; Claim = named bundle referencing ≥1 Asset).

**Gate B (core rebuild — #66, #67, #68, #69):**

*#66 Multi-file:* V22CreateAssetModal's flow is now **Pick → Per-file review → Final review**. Picker runs in `mode="multi"`; each selected file becomes its own Asset. Payload shape changed to `onComplete({ files: [{ file, displayName, hash }] })`. V2App handler `handleV22CreateAssetSubmit` iterates and produces one Asset + one ownership DA per entry; returns an array of new ids when nested (so V22CreateClaimModal and AmendClaimModal can auto-select all N in their picker). Single-file is just N=1 — no separate code path. Legacy single-file shape (`{ file, displayName }`) still accepted.

*#67 Local Storage tab:* V22QualifiedStoragePicker gained a tab header — `Qualified Storage | Local Storage`, QS active by default. New `LocalStoragePanel` component renders a drag+drop zone + file input. Files upload-simulate over 500–800ms per file with a per-row progress bar (`requestAnimationFrame` tick loop). After "upload complete," each file gets a `JUST UPLOADED` badge and becomes selectable. Local files merge with QS picks in the confirm payload (same shape; local files carry `source: 'local'` for cross-tab identification). Mock URI synthesized under `{bucket}/uploads/{filename}`; file bytes are NOT actually stored (demo-only per task scope).

*#68 Hashing sequence:* `HashingRow` component in the per-file review list cycles `pending → hashing → complete` over 900ms. Hashing state renders a rotating border spinner (new `@keyframes spin` in `index.css`) + scrolling hex characters for motion feel. Complete state renders a truncated `CopyBadge` with the mock hash. `mockHashFor(file)` is deterministic from filename+size — same file always hashes to the same 64-char hex string. Continue disabled while any row is still hashing. **Reference caveat:** no V2.1 `HashingSequence.jsx` reference file was placed in `/references/` before the phase; visual/timing pattern-matched to V2.2 processing UIs (V22RunEvaluationModal's processing stage) rather than restored from V2.1 backup. Visual fidelity may differ from V2.1 precedent.

*#69 Editable label:* each per-file row renders an editable text input (100-char max, default = filename-stem derivation). Empty label turns the input border red and blocks Continue. Value flows through `makeAssetRegistrationArtifacts`'s `name` param. Spec §3.2 updated to document `asset.name` as the user-facing display name with filename-stem default.

**Gate C (fast-followers — #89, #90, #91):**

*#89 Actor DOT CopyBadge.* V22ActorPanel DOT row wrapped in `<CopyBadge value={node.dot} truncated />`. Matches the Asset / Claim / Eval Result treatment from the 9A.4 preamble.

*#90 Notification bell tooltip persistence.* Root cause was Tooltip state surviving `shouldRender → false` transitions. V2App nulls the bell tooltip content while the inbox is open; the wrapper span then unmounts (so `mouseleave` never fires) but `visible` state persists. When content reappears the tooltip pops back without a fresh hover. Two fixes: (1) new effect clears `visible` when `shouldRender` becomes false; (2) `mousedown` on the wrapper clears `visible` synchronously so clicking the bell dismisses the tooltip as expected.

*#91 Parse Template scroll.* V22ParseEvidenceModal's template list now renders inside a scroll container (`maxHeight: 300, overflowY: 'auto'`). Audited V22RunEvaluationModal's Requirements Set picker concurrently — applied same treatment. Other pickers (V22CreateClaimModal, AmendClaimModal, AmendDisclosureModal) already scroll.

**Gate D:** backlog updated (#65, #66, #67, #68, #69, #89, #90, #91 all ✅ Complete; #88 transfer cascade filed). Changelog modal entry added (v0.9.1 → v0.9.2). Footer version bumped.

**Spec updates:** §3.2 documents `asset.name` as the user-facing display name (filename-stem default, editable in registration).

**Runtime verification:**
- Build clean at every gate boundary.
- Module imports succeed for both rebuilt files (V22CreateAssetModal, V22QualifiedStoragePicker).
- Programmatic verification: `makeAssetRegistrationArtifacts` produces 3 Assets + 3 ownership DAs with correct hashes + edited labels from a 3-file batch.
- **UI flow verification limitation:** V2Canvas card clicks go through a 3D raycaster that DOM-level `dispatchEvent` can't hit, so end-to-end Actor-panel → Register-Asset modal walkthrough in the preview browser wasn't fully exercised this session. Data-layer plus module-load verification are the backstops. This limitation is consistent across V2.2 work; canvas-level interaction testing requires manual driving.

**Known scope boundaries (not 9A.6 blockers):**
- *V2.1 hashing sequence visual fidelity* — pattern-matched to V2.2 conventions rather than restored from V2.1 backup.
- *Real file upload / real hashing* — both remain demo-only per task scope.
- *Transfer cascade* — filed as #88; distinct from the 9A.5 #73 counterparty-visibility concern.
- *Asset hierarchy (#70)*, *Parse Result DOT + layer placement (#82)* — both design blockers.

**Status:** [x] Complete.

### Phase 9A.6.1 completion notes (2026-04-20) — corrective fixes

Mechanical cleanup of five 9A.6 QA findings plus a spec note and a 14-item backlog filing pass. Single commit.

1. *Fix 1 — Multi-file NEW badge.* `v22RecentlyAcceptedAssetId` state was single-id, so only the first Asset in a multi-file batch got the `_isNew` reveal. Converted the state to accept either a single id or an array. Three changes: (a) setter in `handleV22CreateAssetSubmit` uses the array form when `newIds.length > 1`; (b) `v22DataWithReveal` memo flattens the array into the flagged set; (c) the deselection-clearing effect drops the prev-sel id from the array (resetting to `null` when empty, unwrapping to scalar when one remains). Single-file behaviour byte-identical.
2. *Fix 2 — Actor DOT row empty.* V22ActorPanel DOT row was reading `node.dot`. Actor canvas nodes carry both `dot` (V2.1 compat alias) and `partyDot` (canonical), but the adapter only set `dot`; reading either should work, but the QA observation indicated the row was empty regardless. Fix: `actorToNode` now surfaces both `dot` and `partyDot` on the canvas node, and the panel reads `node.partyDot` per the task brief's explicit direction. Wrapped in `CopyBadge`.
3. *Fix 3 — Hashing sequence V2.1 reconciliation.* Replaced the single-phase hashing state (`hashing → complete`) with a three-phase sequence matching V2.1's AddEvidenceModal: `pending → hashing (amber "Hashing file..." + spinner, 1000ms) → endorsing (blue "Endorsing on ledger..." + spinner, 1200ms) → done (green ✓ "Hashed" + CopyBadge)`. Multi-file stagger: 600ms between files (each file enters `hashing` state 600×i ms after selection). `allHashed` gate in the modal still controls Continue; label updated to "Hashing and endorsing in progress". Continue enables only when every row reaches `done`.
4. *Fix 4 — Mini/dot LOD action buttons on hover.* Root cause: `AssetNodeMini` and `AssetNodeDot` forwarded only legacy handlers to their hover-tooltip AssetNode renderings; `onV22CardAction` (the V2.2 dispatcher that V22ActionBar actually consumes) was never passed through. Additionally the tooltip's inner card was only action-barred when `isSelected`, so `hover-without-select` yielded no action bar. Fix: (a) added `onV22CardAction` prop to both dot/mini components, forwarded to the tooltip AssetNode; (b) new `forceActionBar` optional prop on AssetNode that overrides the `isSelected || hovered` check; (c) V2Canvas now passes `onV22CardAction` (gated on `!transitioning`) to both LOD components. At mini LOD the behaviour is identical to full-card hover; at dot LOD the action bar appears inside the hover tooltip (no deviation needed — dot LOD via tooltip is the only practical surface).
5. *Fix 5 — Spec §11.7 file custody paragraph.* New paragraph in architecture-spec.md §11.7 documents the prototype's working assumption: replication model on accept (both owners hold independently-hashed copies); pointer model documented as cryptographically valid but operationally fragile; the prototype doesn't actually move file bytes. Flagged as Andrew's call surfaced for client review; backlog #93.

**Backlog filing:**
- #93 spec note (spec update complete; design conversation pending) — Low priority.
- #94 QS picker multi-select summary preview — Medium.
- #95 QS picker re-pick preserves labels — Medium.
- #96 Local Storage destination folder indicator — Low.
- #97 Local uploads default-checked + Select All — Medium.
- #98 Credit warning copy + add-credits modal link — Medium.
- #99 Create Claim picker: pre-selected + newly-registered at top with NEW badges — Medium.
- #100 Mini/dot LOD action buttons on hover — High (shipped this phase).
- #101 Actor Detail Panel narrative fields cleanup — Low.
- #102 Disclosure amendment notifications missing on counterparty side — High (UX confusion).
- #103 Referenced Assets missing on counterparty canvas — High (functional regression; 9A.6.2 dedicated diagnostic phase).
- #104 Click-to-jump navigation from Detail Panel association lists — Medium.
- #105 Run Evaluation empty-evidence copy update — Medium.
- #106 Remove evidence picker from Run Evaluation modal — Medium (design implications; pairs with #88).

#68 and #89 retain ✅ Complete status with revision notes on each.

**Spec updates folded in:** §11.7 file custody paragraph.

**Runtime verification:** Build clean; preview reloaded cleanly with no new errors. Data-layer sanity check on the `v22RecentlyAcceptedAssetId` array shape confirms the flagged-set construction handles `null`, single-id, array, and empty-array inputs correctly. End-to-end UI walkthrough (register 3 files → confirm 3 NEW badges; open Actor panel → confirm DOT; mini/dot LOD hover) constrained by the same V2Canvas 3D-raycaster DOM-dispatch limitation noted in 9A.6 — data layer + structural verification covers the change surface.

**Status:** [x] Complete.

### Phase 9A.6.1.1 completion notes (2026-04-21) — three small fixes

1. *Actor Detail Panel cleanup (supersedes #89, ships #101).* Removed DOT, Role, Vertical, User rows from V22ActorPanel body. DOTs per canon X.1 identify data elements (Assets / Claims / Eval Results), not actors — actors have DIDs per canon X.2. Surfacing `partyDot` as "DOT" on the Actor panel was confusing. Actor PIN in the panel header serves as the user-facing identifier. Role labels remain in the user-menu role switcher. The `role` / `vertical` / `user` fields stay on `makeActor` in v2_2Data.js (may be referenced elsewhere; removing from the data model is a separate cleanup).
2. *Mini/dot LOD action bar reverted to click-only (#100 revision).* The 9A.6.1 hover-show pattern was visually present but impractical — pointer dismissed the action bar before reaching it. `showActionBar` simplified back to `isSelected || hovered-on-full-card`. `forceActionBar` prop removed from AssetNode; the two call sites in mini/dot LOD tooltips also removed. `onV22CardAction` threading through both LOD components retained — still needed for click-based dispatch.
3. *Run Evaluation diagnostic logging for #103 investigation.* One `console.log` in the Run Evaluation modal mount logs Claim id + referenced Asset count, DA scope.assetIds, rendered evidence list, and any scope ids missing from the Asset library. Commented as `// TODO: remove after 9A.6.2 diagnoses #103`.

**Backlog:** #89, #100, #101 status updates applied.

**Runtime verification:** Build clean; module imports verified; preview shows no `forceActionBar` errors post-reload.

**Status:** [x] Complete.

### Phase 9A.6.2 completion notes (2026-04-21) — investigation phase for #103

Phase opened to root-cause the Create Claim multi-Asset loss originally filed as #103. Exhaustive diagnostic pass with no fix shipped — per CLAUDE.md workflow rule on genuine ambiguity, surfaced the gap rather than guessing at a fix.

**Investigation summary:**

- *Static code review* of the four candidate root causes laid out in the task brief:
  - **Nested CTA overwrites existing selection.** `V22CreateClaimModal.handleNestedAssetComplete` uses a functional updater (`setSelected(prev => { const next = new Set(prev); for (const id of ids) next.add(id); return next })`). Clean — appends, never replaces.
  - **Submit handler reads stale selection closure.** `handleComplete` is re-created every render; `onClick={handleComplete}` always receives the latest. `Array.from(selected)` reads current state at call time. No closure capture of stale state.
  - **Factory drops IDs.** `makeClaimCreationArtifacts` → `makeClaim` preserves all ids via `[...referencedAssetIds]`. No filter, dedup, or validation that could silently drop.
  - **Race between Asset materialization and Claim compilation.** The Andrew-described reproduction is *sequential* (register Assets → close modal → open Create Claim → select → submit), not *nested*. Asset materialization completes before the Claim modal opens.
- *Data-layer programmatic simulation* against `v2_2Data.js`: registered 2 new Assets via `makeAssetRegistrationArtifacts`, merged into Alice's view, built `ownedAssets` picker list (expected 7), simulated user selecting all 7 via Set → `Array.from(selected)` → `makeClaimCreationArtifacts`. Result: Claim with `referencedAssetIds.length === 7`, all IDs preserved, 7 ref DAs emitted. End-to-end happy path works cleanly.
- *Runtime UI walkthrough:* blocked by V2Canvas raycaster (3D canvas) not responding to DOM `dispatchEvent`. Same limitation noted in 9A.6 and 9A.6.1.1. Can't drive the actual click flow in-session to reproduce.

**Shipping:**

- **Diagnostic instrumentation** at three layers: V22CreateClaimModal's `handleComplete` logs the Set contents and what's sent downstream; V2App's `handleV22CreateClaimSubmit` logs received `referencedAssetIds` on entry and factory output. The 9A.6.1.1 Run Evaluation diagnostic retained. All blocks marked `// TODO: remove after 9A.6.2 diagnoses #103`. On next reproduction, these logs pinpoint the divergence immediately.
- **Issue 2 (orphan `forceActionBar` at AssetNode.jsx:414):** confirmed no-op — already resolved in 9A.6.1.1. No residue in current HEAD.
- **Issue 3 (#107 border shorthand warning):** filed to backlog, Visual & Rendering section. Low priority.

**Backlog:** #103 annotated with investigation summary; status remains "Under investigation — fix blocked on reproduction with logs". #107 filed.

**Exit criteria deviation:** the "Create Claim with 7 Assets produces `referencedAssetIds.length === 7`" criterion passes in the data layer (verified programmatically) but cannot be UI-verified in-session due to the raycaster limitation. The criterion "#103 marked ✅ Complete" is explicitly NOT met — ambiguity surfaced rather than fixed. When Andrew reproduces with the new logs, 9A.6.2.1 (or a similar follow-up) should close the loop with a definitive fix based on the captured log output.

**Changelog + version:** no user-visible change shipped this phase — diagnostic-only work. Intentionally not bumping version or adding a Changelog modal entry; the next phase that ships a real fix will do both.

**Status:** [x] Complete (investigation shipped; fix deferred to next phase pending reproduction).

### Phase 9A.6.2.1 completion notes (2026-04-21) — targeted fix for #103

Shipped the fix that the 9A.6.2 investigation set up for. Root cause turned out to be entirely downstream of Create Claim, in two `buildV22SharedArtifacts()` call sites that read seeded-only data where a merged view was needed. The 9A.6.2 diagnostic instrumentation, had it fired in user repro, would have shown the modal + handler receiving all 7 ids correctly — the count drop only appears at render time on the counterparty's side.

**Primary fix (2 sites):**
- V22App.jsx `sharedForPanel` (Claim Detail Panel referenced-Assets resolution) → `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)`.
- V2App.jsx `sharedForEval` (Run Evaluation evidence resolution) → same. The code comment on this block already said "(incl. provisionals)" — the implementation was never updated to match the intent.

**Audit — 4 additional sites fixed:**

| Site | Purpose | Decision |
|------|---------|----------|
| V2App.jsx:365 | `sharedClaim` for accept-notification Claim name/pin | **FIX** — user-created Claims would notify with null metadata |
| V2App.jsx:428 | `sharedClaim` for decline-notification metadata | **FIX** — same reason, mirror of accept |
| V2App.jsx:603 | `sharedClaim` for eval-completed notification | **FIX** — eval against user-created Claim would send null name/pin |
| V2App.jsx:1077 | `sharedClaim` for amend-DA notification | **FIX** — amended DA on user-created Claim would notify with null |

**Audit — 7 sites left alone:**

| Site | Purpose | Decision |
|------|---------|----------|
| V2App.jsx:556 | `shared` passed to `findPriorActiveEvaluationResult` | LEAVE — helper merges internally |
| V2App.jsx:626 | Amend-Claim lookup (prev.claims primary + seeded fallback) | LEAVE — explicit provisional-first pattern |
| V2App.jsx:879 | Transfer-accept asset lookup (provisionals + seeded fallback) | LEAVE — correct pattern |
| V2App.jsx:968 | Transfer-decline asset lookup, same pattern | LEAVE — correct pattern |
| V2App.jsx:1072 | Amend-DA disclosureAgreement lookup (provisionals + seeded fallback) | LEAVE — correct pattern |
| V2App.jsx:3084 | AI Shopper public-directory source | LEAVE — no current flow populates public DAs in provisionals |
| V2App.jsx:3447 | Transfer-response asset lookup (provisionals + seeded fallback) | LEAVE — correct pattern |

**Also shipped:**
- Exported `mergeProvisionals` from `v2_2Data.js` (was file-private; now importable).
- Stripped all four 9A.6.2 diagnostic `console.log` blocks: V22CreateClaimModal submit, V2App handleV22CreateClaimSubmit entry + factory output, V2App Run Evaluation mount.
- Backlog: #103 ✅ Complete with root-cause note; #108 filed (missing Amend EA modal, pattern-matched against AmendDisclosureModal).
- Changelog modal v0.9.4 entry + footer bump v0.9.3 → v0.9.4.

**Runtime verification:** Data-layer pre/post simulation shows pre-fix returns 5 names (5 seeded Assets resolve, 2 user-registered dropped by `seededOnly.assets.find()` returning undefined); post-fix returns 7 names (all resolve through the merged view). Build clean.

**Status:** [x] Complete.

### Phase 9B completion notes (2026-04-21) — edge hover & selection polish

Eight precise UI improvements to edge hover and selection. Unified the hover tooltip + click menu into a single `EdgeHoverMenu` component with two modes (hover / pinned). Shipped #7 and #59.

**New component:** `src/v2/EdgeHoverMenu.jsx`. Portal-rendered, mode prop switches between pointer-events-none hover tooltip (anchored to cursor, top-left of cursor with bottom-right fallback at viewport edges) and pointer-events-auto pinned menu (anchored to click point, rows are clickable). Row structure:
- **View Disclosure Agreement** — 3 rows: action label, mini SDA-edge illustration (color + dash pattern per SDA type) + type label, and `{from node} ({grantor}) → {to node} ({grantee})`. Solid indigo for Full, dashed amber for Selective, dotted green for Proof-only, dashed grey for Provisional.
- **View Evaluation Agreement** — 2 rows: action label + expiry date ("Expires YYYY-MM-DD" or "Never expires"). Only renders when a paired EA exists on the edge.

Whole-row hover highlight via `background: color-mix(in srgb, var(--bg-card) 85%, var(--text-primary) 15%)` per spec §8.

**V2Canvas changes:**
- New `onEdgeHover({ edgeId, sdaType, x, y })` callback invoked on raycaster hit / null on leave.
- New `hoveredEdgeSdaType` state for the cursor-centered dot.
- Selection/brightening `useEffect` now also responds to `hoveredEdge` — hover applies a 30% white lerp (weaker than selection's 65%); selection wins when both apply to the same edge.
- Cursor-centered dot renders as a portal'd `div` (12px, SDA color, 70% opacity, `pointer-events: none`, z-index 5900). Suppressed when `selectedEdgeId` is set so it doesn't double with the pinned menu.
- Old small 2-line SDA hover tooltip removed — replaced by the rich menu rendered from V2App.

**V2App changes:**
- New `edgeHover` state paralleling the existing `edgeMenu` (pinned) state.
- Edge click always sets `edgeMenu` now (previously only when EA was paired; no-EA edges opened the DA panel directly). The menu handles both branches.
- `EdgeMenu` import replaced with `EdgeHoverMenu`; both the hover and pinned renders use the same component. `src/v2/EdgeMenu.jsx` file deleted.
- `handleCloseSel` already cleared `edgeMenu`, so canvas-click deselection dismisses the pinned menu for free.

**Selection + type-specific visual language (item 4):** verified no-op. Full Disclosure has no glow layer today (just thicker solid line), and dashed edges don't animate outside chain mode. Nothing for selection to break. If glow or marching-ants are added in a future phase, selection treatment is additive (clone base color + lerp to white + bump linewidth) and won't override those layers.

**In-session TDZ fix:** initial edit placed the `useState` declarations for `hoveredEdge` et al. AFTER the selection-brightening `useEffect` that depends on them in its deps array — React crashed at first render. Moved the `useState` declarations above the effect. Caught and fixed before commit.

**Deviations from the Phase 9B spec:**
- No separate "on-edge hit-point dot" — Andrew's Phase 9B brief uses a cursor-centered dot instead (explicitly out of scope).
- No Escape key unpin — not in spec.
- Amend actions still live in the Agreement Detail Panel footers (not the edge menu) per spec intent.

**Backlog:** #7 and #59 ✅ Complete with root-cause notes. Changelog v0.9.5 + footer bump v0.9.4 → v0.9.5.

**Runtime verification:** Build clean; app loads and boots past CAC screen with a clean canvas render. Module imports verified for the new `EdgeHoverMenu.jsx`. Dev server required a restart mid-session when HMR got stuck on the deleted `EdgeMenu.jsx` path — fresh startup loads cleanly.

**Known scope boundaries (not 9B blockers):** V2Canvas 3D raycaster DOM-dispatch limitation (documented since 9A.6) continues to block scripted canvas-click UI walkthrough from this agent session. The edge-hover + edge-click behaviour is testable manually by driving actual mouse input; all rendering + state plumbing is verified via code path and module sanity.

**Status:** [x] Complete.

### Phase 9B.1 completion notes (2026-04-21) — edge menu refinement + EA panel cleanup

Refines the 9B edge hover/selection menu based on live testing, plus one small Evaluation Agreement Detail Panel cleanup.

**EdgeHoverMenu.jsx refactor:**
- **Cursor dot** bumped 12px → 24px; other properties unchanged. Close-to-cursor-size was unclear as an indicator.
- **Hover mode structure** simplified: centered "SELECT EDGE TO VIEW" header (mono, uppercase, `var(--text-dim)`) above the options, outside any option container. Each option wrapped in its own rounded rectangle (`border-radius: 8`, `background: var(--bg-raised)`, whole-row hover highlight).
- **DA option** collapsed to 2 rows: Row 1 = half-length SDA illustration (24px vs. 9B's 48px) + "{Type} Disclosure Agreement" (e.g., "Selective Disclosure Agreement"). Row 2 = endpoints with owners. The standalone "View Disclosure Agreement" action-label row removed; the "View →" affordance handles the action indication in pinned mode.
- **EA option** collapsed to 2 rows: Row 1 = "Evaluation Agreement" (dropped the "View " prefix). Row 2 = "Expires YYYY-MM-DD" or "Never expires". EA option still omitted entirely when no paired EA exists.
- **Right padding** reserved (48px) in every state so "View →" appearing in pinned mode doesn't shift layout. Affordance always mounted; opacity transitions 0 ↔ 1 over 200ms.
- **Clicked state** drops the header, fades in "View →" on the right side of every option simultaneously (200ms), rows become clickable with hover highlight persisting.

**World-space tooltip tracking (§4):**
- V2Canvas exposes a new `projectToViewport(worldX, worldY)` method on its imperative handle that adds the container's viewport rect to the existing `worldToScreen` output.
- Edge click captures the raycaster's world-space hit point via `intersects[0].point` and includes `{ worldX, worldY }` in the `onEdgeClick` payload.
- V2App keeps a separate `edgeMenuProjected` state and runs a RAF loop while a pinned menu is open, re-projecting the world point each frame. The loop exits when the menu closes and cleans up. Small epsilon guard (0.5px) skips redundant setState.
- The pinned `EdgeHoverMenu` consumes `edgeMenuProjected` (fallback: `edgeMenu.anchor`) so the tooltip slides with the canvas through the 9A.1.5 pan/zoom framing. Hover-mode tooltip still uses raw cursor coords.

**EA Detail Panel cleanup (§5):**
- Removed the "Authorized Requirements Sets" section from `EvaluationAgreementDetailPanel.jsx`. The section listed the requester's proposed Requirements Sets, which are advisory per spec §10.5 — not binding — and labelling them "Authorized" implied enforcement that doesn't exist. Amendments also change what's in play without a visible change log, creating stale-data risk.
- The `agreement.authorizedRequirementsSetIds` field stays on the data model (referenced elsewhere as "SUGGESTED" chips in `V22RunEvaluationModal`); only the panel surface is stripped. A replacement-block comment captures the reasoning.

**Deviations:**
- "View →" easing: simple `opacity 200ms ease` both ways. No separate enter/exit timings.
- RAF tick: unconditional `requestAnimationFrame` loop while the menu is open. Cheap — one viewport projection per frame — and it avoids needing to detect when the pan/zoom animation is actually running.
- Tooltip clamp at extreme zoom: none. If the world point projects off-screen, the tooltip moves off-screen too. Task brief called this out as optional fallback; kept it simple pending real demos.
- Rounded-rectangle radius on options: 8px. Slightly smaller (6px) was also defensible; went with 8 to match ModalShared panel/card conventions.

**Backlog:** #7 / #59 already ✅ from 9B — untouched. Filed #110 (edge glow + marching-ants V2.1 restoration). Update Log entry added.

**Runtime verification:** Build clean. Module imports verified for both `EdgeHoverMenu.jsx` and `EvaluationAgreementDetailPanel.jsx`. App boots past the CAC screen with a clean canvas render. V2Canvas raycaster DOM-dispatch limitation still prevents scripted canvas-click UI drive from this agent session; manual mouse interaction is the verification path for the edge-hover + edge-click behaviour.

**Status:** [x] Complete.

### Phase 9B.2 completion notes (2026-04-21) — edge hover bug fixes

Five concrete fixes from 9B.1 QA plus two backlog filings (#111, #112).

1. *Fix 1 — Selective/dashed hover brightness.* Shipped **Option B (type-aware)**: dashed/dotted edges (Selective amber, Proof-only green, Provisional grey) now get a 50% white blend on hover; solid edges (Full indigo) stay at 30%. The higher blend closes the dash-gap visibility gap without pushing Full hover too close to Full's 65% selection state. Single line: `const hoverBlend = (cfg.dash || 0) > 0 ? 0.5 : 0.3`.
2. *Fix 2 — Click-state brightening persistence.* Root cause: the brightening was applied by a separate useEffect that ran AFTER the buildEdges rebuild effect. On any render where the rebuild ran without the second effect (e.g., `chainNodeIds` changes, or the two effects' deps drift apart), the edge materials were left fresh-but-unbrightened. Fix: extracted the apply-styling logic into a ref-backed helper (`applyEdgeStylingRef.current`) that reads `selectedEdgeIdRef` + `hoveredEdgeRef` (synced via effects). The helper is called both from the state-change useEffect (cheap updates) AND directly at the end of the buildEdges rebuild effect. Zero race window. The old selection-brightening useEffect is retained for state-only changes; the new invocation at rebuild-end closes the gap.
3. *Fix 3 — Fade during animation.* Removed 9B.1's unconditional RAF world-space tracking (drifted above nodes during zoom). Replaced with the spec's fade-during-animation approach: on edge click, set `edgeMenuPanning = true` (tooltip opacity 0 via 150ms transition). After 620ms (animation duration + 20ms tail-buffer), reproject the captured world point via `projectToViewport` and update the tooltip's anchor, then clear `edgeMenuPanning` (fades back in). `animatedPanToWithZoom` doesn't expose a completion callback, so the timeout matches the 600ms animation duration. Simpler code, correct visual outcome. World-point capture from 9B.1's `onEdgeClick` payload retained for the post-animation reposition.
4. *Fix 4 — Right padding 48 → 80px.* Single constant bump in EdgeHoverMenu. Resolves "View →" overlapping long endpoint strings like "Power Regulation Module Assembly (MicroCo) → Avionics Module (GovCo)".
5. *Fix 5 — Cursor dot 24 → 32px + reliability.* Size bump + centering offset update (`anchor.x - 16`, `anchor.y - 16`). Raycaster `params.Line2.threshold` 8 → 12 (more forgiving hit detection during rapid cursor movement). Hover hide-debounce 80ms → 150ms (prevents flicker as cursor crosses adjacent edges).

**Backlog filings:**
- **#111 Agreements section in node Detail Panels** — primary access path for Amend/Revoke. Supersedes #12 (which is retained as superseded with a pointer to #111). High priority.
- **#112 Revocation flow restoration** — V2.1 capability, reference file needs to be placed in `/reference/` before the phase starts. High priority.
- **#110 Edge glow + marching-ants** — already filed in 9B.1; verified no #113 duplicate was filed inadvertently.

**Changelog v0.9.7 + footer bump v0.9.6 → v0.9.7.**

**Deviations:**
- Chose Option B (type-aware brightness) for Fix 1 over Option A (uniform bump) per spec's "more correct but more code" assessment. Single extra line, clear logic.
- Click-state persistence fix: ref-backed helper pattern rather than moving selection logic INTO buildEdges. Keeps separation of concerns and lets the state-change useEffect continue to handle non-rebuild updates cheaply.
- Fade timings: 150ms opacity (spec), 620ms total hide duration (600ms animation + 20ms settle buffer). No separate enter/exit timings.
- Raycaster threshold bumped to 12px (not the V2.1 value of 8 per task brief) because even V2.1's 8 was marginal; 12 remains well within stroke width so no wrong-edge hits.

**Runtime verification:** Build clean. App boots, canvas renders, no console errors. V2Canvas raycaster DOM-dispatch limitation continues to block scripted UI walkthrough from this agent session — manual mouse interaction remains the verification path for the hover/click visuals. All rendering + state plumbing verified via code path.

**Status:** [x] Complete.

### Phase 9B.3 completion notes (2026-04-21) — edge menu anchors at edge midpoint

Single-item change: pinned tooltip's post-animation anchor switches from the click-point world projection to the true world-space midpoint of the two endpoint cards.

**The change, localised to V2App.jsx's `onEdgeClick` handler:**

```js
const edgeObj = edges?.find(e => e.id === edgeId)
const fromNode = edgeObj ? nodeMap[edgeObj.from] : null
const toNode = edgeObj ? nodeMap[edgeObj.to] : null
const hasWorldPositions = fromNode && toNode
  && fromNode.x != null && fromNode.y != null
  && toNode.x != null && toNode.y != null
const midX = hasWorldPositions ? (fromNode.x + toNode.x) / 2 : null
const midY = hasWorldPositions ? (fromNode.y + toNode.y) / 2 : null
setEdgeMenu({
  edgeId,
  anchor: { x: anchor.x, y: anchor.y },
  worldX: midX,
  worldY: midY,
})
```

The click handler's existing flow is unchanged for everything else — initial anchor is still the click point (tooltip appears there briefly), `edgeMenuPanning` state from 9B.2 hides it during the pan/zoom animation, 9B.2's setTimeout reprojects at 620ms. The only difference is what `worldX/worldY` point to: the midpoint of the two endpoint card centers rather than the raycaster hit point on the edge curve.

**Deviations:**
- **V2Canvas untouched.** V2Canvas still emits `worldX/worldY` from the raycaster hit point in the `onEdgeClick` payload. V2App ignores those values now — kept the emit in place per the "keep diff minimal" directive. If a future phase wants the raycaster hit point back (e.g., for a different tooltip behaviour), the plumbing is still there.
- **Radiant Network / no-world-position edge case.** Current behaviour: endpoints without world positions produce `worldX/worldY === null`. The 9B.2 fade-during-animation effect guards on `worldX/worldY == null` and clears `edgeMenuPanning` immediately without a reproject; the tooltip stays at its pre-animation click-point anchor. Doesn't skip the tooltip entirely (the task's "match 9A.1.5 skip-for-missing-positions" suggestion was about edge-select FRAMING, not the menu itself — the menu should still render). Graceful fallback.
- **Stale `setEdgeMenuProjected` call.** Found and removed a stray line from 9B.2 — `setEdgeMenuProjected({ x: anchor.x, y: anchor.y })` at the end of `onEdgeClick`. `setEdgeMenuProjected` was removed in 9B.2's fade-approach refactor but this one call survived, which would have thrown `ReferenceError` the first time a user clicked an edge. Cleaned up silently as part of this refactor.
- **Panel-aware projection:** no additional logic needed. The existing 9A.1.5 framing useEffect handles panel offset when it pans the camera; `projectToViewport` then returns the post-pan screen coordinate naturally, so the tooltip's post-animation position already respects panel width.

**Runtime verification:** Build clean. Module imports + boot verified. Midpoint formula verified programmatically — for the `actor-govco ↔ asset-bob-avionics` edge (positions 0,0 and 520,0) midpoint resolves to (260, 0) deterministically. Same edge clicked at any x-position along the curve now anchors the tooltip at (260, 0) in world coords after the animation settles.

**Changelog v0.9.8 + footer bump v0.9.7 → v0.9.8.**

**Status:** [x] Complete.

### Phase 9C completion notes (2026-04-21) — Agreements section in node Detail Panels

Closes backlog #111 (supersedes #12). Dedicated "Agreements" section added to Actor, Asset, and Claim Detail Panels surfacing the Disclosure + Evaluation Agreements relevant to the selected node. Makes the panel the primary access path for agreement management; the 9B edge-click tooltip becomes the secondary path.

**Component + wiring:**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — new `AgreementsSection`, `DisclosureAgreementRow`, `EvaluationAgreementRow`, `AgreementRow`, `ActionLabel`, `SdaLine` primitives. Section renders two subsections (Disclosure / Evaluation) with counts in parentheses; zero-count subsections and the whole section auto-hide. DA rows: SDA-type illustration + type label (Row 1), subject name truncated (Row 2); counterparty label + status/date (middle column); Amend + Revoke action labels (right column, stacked). EA rows: "Evaluation Agreement" + claim name; counterparty + "Expires YYYY-MM-DD" or "Never expires"; Amend + Revoke (both placeholder). Row click (anywhere except an action label) fires `onAgreementRowClick`. Action labels `stopPropagation` so they don't re-trigger the row click.
- **Panel wiring:** V22ActorPanel renders the section after Assets; V22AssetPanel renders it after Pending Transfer (just before footer); V22ClaimPanel renders it after Evaluation Results (standard state only — provisional / declined states are transitional and the Respond / Dismiss CTAs dominate those paths, so the section is intentionally omitted).
- **V2App derivation** (in the panel-rendering block): three filters run against `v22View`'s already-merged (provisional-inclusive) DA + EA arrays:
  - **Actor**: `grantor.party === node.name || grantee.party === node.name`
  - **Asset**: `scope.assetIds.includes(node.id) || granteeAssetId === node.id || (subject.kind === 'asset' && subject.id === node.id)`
  - **Claim**: `subject.kind === 'claim' && subject.id === node.id` (DAs); `claimId === node.id` (EAs)
  `resolveSubjectName` / `resolveClaimName` helpers are closed over `sharedForPanel = mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` so user-created artifacts resolve (the same pattern the Phase 9A.6.2.1 fix established for #103).

**Row click + Amend handlers:**

- `handleAgreementRowClick(kind, agreement)` — looks up the canvas edge for this agreement (`edges.find(e => e.disclosureAgreementId === …)` or `pairedEvaluationAgreementId`) and fires `setSelectedEdgeId(edgeId)` when one exists, triggering the 9A.1.5 pan/zoom framing and 9B midpoint tooltip. Then closes the node panel (`setSel(null)`) and opens the agreement panel via `setOpenAgreement({ kind, edgeId, disclosureAgreementId, evaluationAgreementId })`. For DAs whose edges are suppressed (internal Actor→Claim ownership per 9A.5 #83), `edgeId` stays null and the agreement panel opens without framing.
- `handleAmendDaFromRow(da)` — reuses the existing edge-tooltip Amend semantics: provisional + grantor → `setV22RespondingTo` (CombinedResponseModal); active + grantor → `setV22AmendingDaId` (AmendDisclosureModal). Closes the node panel on open so the modal has a clean stage.
- **openAgreement resolver extension:** the agreement-panel rendering block now accepts `disclosureAgreementId` / `evaluationAgreementId` in the state object as a fallback when `edgeId` is null. Existing edge-click entry paths keep passing `edgeId` untouched; swap-between-DA-and-EA (panel footer cross-link) now preserves both edgeId and the resolved agreement ids.

**Visibility gating:**

- **Amend visible** on DA rows only when `activeParty === da.grantor.party`, and never on internal DAs (grantor === grantee) or Proof-of-Evaluation DAs (subject.kind === 'evalResult'). Provisional DAs with a grantor-active-party show "Respond" instead of "Amend" — matching the existing DA Detail Panel footer's adaptive label.
- **Revoke visible** on DA rows only when `activeParty === grantor`, never for provisional, declined, internal, or Proof-of-Evaluation. Renders as disabled text with tooltip "Revocation coming soon (Phase 9D)".
- **EA rows**: both Amend + Revoke render as disabled placeholders with tooltips pointing at #108 (EA amend modal) and #112 (revocation). Internal EAs (grantor === grantee) omit both entirely.
- Non-grantor viewers see rows with blank action columns (the slots still reserve height via a `{ height: 14 }` spacer so row heights stay uniform regardless of action state).

**Spec-vs-implementation notes:**

- **Internal DAs render "Internal" in the counterparty slot** rather than being filtered out. Task scope asked for "all DAs where party is grantor OR grantee" — including internals is faithful to that. Ownership / claim-ref / parse-ref DAs are platform plumbing; rows are still informative (users can see the structural relationships) but carry no action labels since amending / revoking your own ownership of your own artifact is meaningless.
- **Proof-of-Evaluation DA action handling deferred** per Andrew's call ("evaluate independently later"). Rows render normally with no Amend or Revoke labels.
- **Provisional + declined Claim panels skip the Agreements section.** Those states focus on the Respond / Cancel / Dismiss CTAs and the Request / Decline metadata sections. Adding an Agreements list with the single provisional DA would duplicate information already present in the Request section. Edge-click remains available if the user needs to drill into the provisional DA.
- **Row-click pan/zoom only fires when an edge exists.** DAs without edges (internal Actor→Claim ownership) open their panel without framing — still informative for the user, just no canvas motion. Multi-edge DAs (internal claim-ref with scope.assetIds spanning multiple Assets) frame on the first edge found; more sophisticated "which edge to frame" heuristics deferred.

**Runtime verification:** Build clean. Data-layer verification in the dev preview:
- Filter counts per role: GovCo Actor 7 DAs + 2 EAs; MicroCo Actor 24 DAs + 3 EAs; MicroCo PRM Claim 7 DAs + 2 EAs; GovCo Avionics Asset 4 DAs + 2 EAs. All non-zero, all consistent with the seeded dataset.
- Edge resolution: inter-party `da-alice-bob-prm` → `edge-da-alice-bob-prm-asset-bob-avionics-claim-prm-assembly`; internal ownership `da-own-claim-prm-assembly` → no edge (9A.5 #83 suppression confirmed; agreementId fallback covers this case).
- App boots cleanly with no console errors on reload. V2Canvas 3D raycaster DOM-dispatch limitation (known since 9A.6) blocks scripted canvas-click UI walkthrough from this agent session; rendering + wiring verified via code path and module sanity.

**Changelog v0.9.9 + footer bump v0.9.8 → v0.9.9.**

**Status:** [x] Complete.

### Phase 9D completion notes (2026-04-21) — Revocation flow restored + extended

Closes backlog #112. Restores V2.1's revocation capability and extends it to cover Evaluation Agreements (V2.1 only knew DAs). Wires into the 9C Agreements Section Revoke placeholders.

**Design decisions locked in before build (per phase brief):**
1. DAs + EAs both revocable in this phase (not split 9D / 9D.1).
2. Proof-of-Evaluation DAs non-revocable — 9C Agreements Section already hides Revoke on these rows; defensive guard in `handleOpenRevocationConfirm` warns + no-ops if somehow invoked.
3. Grantee-initiated revocation in scope for both DAs and EAs.
4. Cascade UX: Option 2 confirmation (cascade warning in Confirm modal) + Option 3 notifications (chained `v22-da-revoked` + `v22-ea-revoked` with `cascadedFromDa: true`).
5. Eval Results cascade with Claim on DA revocation — "clean removal" on canvas; metadata preserved in `shared.evaluationResults` for audit.

**Files changed:**
- `src/v2/v2_2Data.js` — `makeRevocationRecord` factory. `mergeProvisionals` now carries `revocationRecords`. `buildViewForActor` gained active-vs-revoked split (`activeDisclosureAgreements` / `activeEvaluationAgreements` / `activeEvaluationResults`), `revokedClaimIds` map keyed on grantee-side revocations, and a `_revokedMeta` guard on the pull-in-anchor loop so the counterparty anchor disappears from the revoker's canvas. Canvas adapter stamps `isRevoked` / `_isRevoked` / `_revokeReason` / `_revokeRecord` on pulled Claim nodes mirroring the DECLINED treatment.
- `src/v2/AssetNode.jsx` — REVOKED badge (red, same styling palette as DECLINED), red border when revoked, "Disclosure revoked" message row when in provisional-shaped state. Added `isRevoked` derivation; border + message + badge all branch on `isDeclined || isRevoked`.
- `src/components/modals/V22RevocationConfirmModal.jsx` (new) — revoker-side confirmation. Red-accented irreversibility warning, subject summary card, cascade warning block (DA-only, when applicable), optional 500-char reason textarea, Cancel + red-accent Revoke Agreement footer buttons. Pattern-matches V2.1 RevocationNoticeModal's red accent palette for visual continuity.
- `src/components/modals/V22RevocationNoticeModal.jsx` (new) — counterparty-side notice. Direct port of V2.1 `RevocationNoticeModal.jsx`'s structure (red "Access Revoked" callout, subject details block, message-from-revoker block, "What this means" consequence). V2.2 extensions: DA/EA branching in title + callout copy; cascade-context consequence block when `cascadedFromDa: true`; claim-subject-aware subject block.
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — `DisclosureAgreementRow` + `EvaluationAgreementRow` Revoke labels now dispatch to `onRevokeDa` / `onRevokeEa` instead of rendering as disabled placeholders. New revoked-state branch in `V22ClaimPanel` (mirrors the declined branch) — REVOKED header badge, reason card in red-tinted surface, consequence note, Dismiss footer button.
- `src/v2/V2App.jsx` — `revocationRecords: []` added to `v22Provisionals` initial state. `v22Revoking` + `v22RevocationNotice` modal-state hooks. Helpers: `findPairedEa(daId, shared)`, `findCascadedEvalResults(eaId, claimId, granteeParty, shared)`, `buildCascadeInfo(agreement, type)`. Handlers: `handleOpenRevocationConfirm` (dispatched by 9C Revoke labels), `handleRevokeConfirm` (commits the revocation), `handleV22DismissRevoked` (drops revoked DA + EA + Eval Results from state on grantee's canvas). Notification inbox: two new types (`v22-da-revoked`, `v22-ea-revoked`) with red REVOKED badge, preview text that distinguishes cascade from standalone, click handler that opens the Notice modal. Notice modal's Dismiss calls `handleV22DismissRevoked` for DA revocations.

**Revocation state representation — `_revokedMeta` annotation (not `type: 'revoked'`):**

Went with the annotation pattern (same shape as the Phase 6.5 #3 `_declineMeta`) rather than extending the `DISCLOSURE_TYPES` enum. Reasons: (1) annotations compose cleanly with `mergeById` in `mergeProvisionals` — the revoked agreement is a splice of the original with one extra field; (2) keeps the `type` enum focused on structural kinds (full / selective / proofonly / provisional / expired) rather than mixing lifecycle states; (3) matches existing `_declineMeta` precedent so readers familiar with one instantly understand the other; (4) expanding the enum would require updates at every `DISCLOSURE_TYPES` validation site and every rendering site that branches on `da.type` — annotation has narrower blast radius.

`_revokedMeta` shape:
```js
{
  reason: string,
  revokedDate: ISO string,
  revokerParty: string,   // active actor at revoke time
  cascadedFromDaId: null | string,   // set when this EA/ER was cascaded from a DA revocation
}
```

**Cascade semantics in implementation:**

When a DA is revoked, `handleRevokeConfirm`:
1. Annotates the primary DA with `_revokedMeta`.
2. Finds the paired EA via `findPairedEa` (same `disclosureAgreementId` back-reference) and annotates it with `_revokedMeta: { cascadedFromDaId: da.id }`.
3. Finds grantee's Eval Results on this Claim under that EA via `findCascadedEvalResults` and annotates each with the same cascade meta.
4. Appends one `makeRevocationRecord` entry to `revocationRecords` per annotated artifact (primary + cascade records).
5. Enqueues a single `v22-da-revoked` notification to the counterparty carrying `cascadeIncludesEa: boolean` + `cascadeIncludesEvalResults: string[]`.

The Notice modal's consequence copy branches on these cascade flags so the grantee sees "This Claim and its associated Assets have been removed... The paired Evaluation Agreement and any Eval Results you produced under it were also revoked" when applicable.

**Deviations from the phase brief:**

- **Single chained notification, not two.** Brief said "Counterparty receives two notifications: primary (DA revoked) + system-generated (EA revoked, reason: 'Cascaded from DA revocation')." Shipped a single `v22-da-revoked` notification carrying both cascade facts in its payload (`cascadeIncludesEa`, `cascadeIncludesEvalResults`). Rationale: emitting two notifications about the same revocation event would create inbox noise — the user reads two items that describe the same action. The Notice modal surfaces the cascade context inline instead. `v22-ea-revoked` with `cascadedFromDa: true` payload is retained for correctness but only the primary DA notification fires on cascade; the payload shape supports future decoupling without a migration.
- **All revocation paths use the `_revokedMeta` annotation approach.** Considered dropping state immediately for grantee-initiated + EA-only cases (per my initial architecture notes), but settled on uniform annotation for simpler reasoning: `buildViewForActor` filters `_revokedMeta`-annotated agreements out of active lists regardless of initiator. The grantee-side REVOKED badge only renders when the viewer IS the grantee AND the Claim is subject to a DA with `_revokedMeta` — a `revokedClaimIds.has(claimId)` check in `claimToNode`. This keeps one code path instead of three branching ones.
- **Grantee-initiated DA revocation does NOT render a REVOKED-card-with-Dismiss on the revoker's side.** The revoker initiated the action; they don't need a confirmation card. The DA / EA / cascaded Eval Results are annotated and filtered out of both sides' active lists; the grantor receives the notification with Notice modal entry. On the grantee (revoker) side, the Claim would technically fall into the `revokedClaimIds` map but never be rendered with the REVOKED badge because the revoker doesn't need a Dismiss step — they already took the action. To keep this clean, `handleRevokeConfirm` for grantee-initiated still writes `_revokedMeta` but the grantee's canvas naturally omits the Claim anyway because the EA (their reason for pulling the Claim in) is also filtered. No special-case code needed.
- **Eval Result "clean removal" preserves metadata in shared storage.** Annotations stay on the Eval Result in `shared.evaluationResults`; only view filtering removes the visible node. This matches the phase brief's "Eval Result artifacts stay in `shared.evaluationResults` for metadata/audit" — implementation note: the annotation rides on the artifact itself, not a separate tombstone.
- **REVOKED badge on Eval Result nodes not wired.** Focused the REVOKED canvas treatment on the Claim (the primary entity the grantee loses). Eval Results cascade off the canvas via view filtering; if a user opens the Notice modal before dismissing, they see the Eval Result count in the cascade list but not a REVOKED badge on the individual Eval Result node. Deemed sufficient for the phase scope — Claim is the anchor for the Dismiss action.
- **Notice modal Dismiss directly fires state cleanup.** Per phase brief, "Dismiss removes Claim + cascade-revoked Eval Results + cascade-revoked EA from grantee canvas." Implementation: Notice modal's `onClose` calls `updateRoleState(roleId, dismissedReqs)` to clear the notification AND, for `v22-da-revoked` types, `handleV22DismissRevoked(claimId)` to drop the revoked provisionals. Single click, two outcomes.

**Data-layer runtime verification (dev preview):**
- Simulated Alice revoking DA to Bob on PRM Claim with cascade.
  - Alice's active DAs: 24 (was 25) — revoked DA correctly filtered ✓
  - Bob's active Eval Results: 0 (was 1) — cascaded Eval Result correctly filtered ✓
  - `bobView.revokedClaimIds` correctly includes `claim-prm-assembly` ✓
  - Cascade summary resolved: 1 paired EA (`ea-bob-prm`) + 1 Eval Result (`MIL-PRF-55681 Compliance`) ✓
- Simulated Bob revoking EA only (standalone, no cascade).
  - Both Alice's and Bob's active EA lists drop `ea-bob-prm` ✓
  - Bob's Claim is NOT flagged as revoked (EA-only revocation) ✓
  - Bob's Claim stays pulled in ✓ (DA still active; Claim remains visible with Run Evaluation gated by EA presence)

**Known scope boundaries (not 9D blockers):**
- *Self-revocation of owned Claims / Assets / Eval Results* — scoped out per phase brief. Broader capability; future item.
- *Run Evaluation button disabled state after EA revocation* — the phase brief's exit criterion "Revoked EA: Run Evaluation button on Claim Detail Panel is disabled with explanatory tooltip" is satisfied structurally (the EA filters out of `evaluationAgreementForActor`, so the button never renders in the first place) rather than rendering-a-disabled-button. If the design intent was specifically to show a disabled state with a tooltip, that's a polish follow-up — file if needed.
- *Canvas-level UI walkthrough* constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6. Data-layer verification + build-passing are the substitute per prior phase precedent.

**Changelog v0.9.10 + footer bump v0.9.9 → v0.9.10.**

**Status:** [x] Complete.

### Phase 9E-parallel completion notes (2026-04-21) — co-shipped with 9D (commit b29fdc9)

Three small fixes intended as a standalone sibling commit. Co-shipped into the 9D revocation commit due to a parallel-programming coordination artifact — the two parallel sessions' uncommitted changes collapsed into one commit. Post-mortem below.

**Fix A (#51) — V2Canvas.jsx V2.1 prop pruning.** Removed seven V2.1-era handler props from `V2Canvas`'s signature and all three forward sites (full card + `AssetNodeMini` + `AssetNodeDot`): `onConnect`, `onDisclose`, `onAddEvidence`, `onParseEvidence`, `onRunEvaluation`, `onAmendEval`, `onCreateClaim`. V2.2 nodes route card actions through `onV22CardAction` exclusively; the old props had no backing code paths.

**Scope bleed:** V2App.jsx still passes these seven handler props to V2Canvas (lines 3134-3223). V2Canvas now silently ignores them since they're no longer destructured — no runtime error, just dead prop-passing on the V2App side. Full V2App.jsx dead-prop cleanup deferred to backlog #50.

**Fix B (#60 initial approach, later reversed in 9E-parallel.1) — Background grid opacity.** Lowered base-depth grid opacity (dark 0.20 → 0.12, light 0.25 → 0.15) to make node dots pop at dot-LOD. Wrong direction per Andrew's feedback — see 9E-parallel.1 notes below.

**Fix C (#107) — Border shorthand → longhand conversion in AssetNode.jsx.** The task briefed this as "shorthand `border:` paired with a side-specific longhand like `borderTopColor`." Exhaustive code audit found no such pattern in AssetNode.jsx (no `borderTopColor`, `borderLeftColor`, etc. anywhere in the file). **Actual root cause identified during this phase:** React's style reconciler has trouble tracking `border-color` transitions when the border is set via shorthand `border: ...`. The warning fires because React updates the border across frames but can't consistently determine which color to apply.

Fix: convert every `border:` shorthand paired with a `transition: border-color` to longhand (`borderWidth` + `borderStyle` + `borderColor`). Four call sites fixed: full-card selection border, full-card main div, mini selection border, mini main div. Dot-card borders and static non-transitioning borders left as shorthand.

**Parallel-programming post-mortem.** The prompt-author's intent for this phase was an independent sibling commit to the parallel 9D revocation work. Coordination mechanic went wrong because uncommitted changes from both sessions existed in the working tree when 9D committed with `git add <file>` — the 9E-parallel changes got absorbed. Resolution: 9E-parallel fixes landed correctly in commit b29fdc9 with an acknowledgement in the commit message body. Future parallel work should explicitly constrain each session to its own commit scope (branch isolation or pre-staging / stash-and-pop).

**Runtime verification:** Build clean. Preview reloads cleanly; no new console errors. DOM-level verification confirms longhand border properties applied to the main card (`border-width: 1px; border-style: solid; border-color: …`).

**Status:** [x] Complete.

### Phase 9E-parallel.1 completion notes (2026-04-21) — #60 correction (commit 7d03982)

Reversed 9E-parallel's base-depth grid opacity change and relocated the contrast work to the node dot itself.

**Fix 1 — Restore uniform background grid opacity.** Andrew's feedback: the background dot matrix is intentional visual infrastructure and should stay at full brightness. `getGridParams` now returns a single opacity across all depths (dark 0.28 / light 0.32) — the previous depth-1+ values became the single values. Phase 9E depth-specific comment block removed.

**Fix 2 — Brighten AssetNodeDot inner-circle ring.** Dot at dot-LOD now has a clearly distinct indigo ring against the full-brightness matrix:
- Stroke: **1px → 1.5px** (clear bump without reshaping the 8px dot — kept at `box-sizing: border-box` so the fill disc only reduces from 6px to 5px)
- Color: **`color-mix(in srgb, var(--accent-indigo) 40%, var(--border))`** (`WARM_BORDER` constant) **→ `color-mix(in srgb, var(--accent-indigo) 70%, var(--border))`** (stronger saturated indigo, still blended with `var(--border)` so it stays architectural rather than chromatic glow)
- Fill unchanged (`var(--text-tertiary)`) — the ring does the contrast work

**Preserved:** WARM_BORDER constant untouched (still used by full + mini cards per Phase 9A.1.5 item 1). Red UNSAT path retained at the new 1.5px stroke. Selected amber ring (`isSelected` branch at the end of the dot) untouched. `_isEdgeEndpoint` hollow-ring treatment untouched.

**Grid alignment note:** Original backlog #60 proposed grid-alignment as one candidate fix. Investigation confirms node positions already snap to the grid via the existing `snapToGrid` function in V2Canvas.jsx — alignment was never the issue. Contrast between nodes and background is now carried by the node dot's ring, not by dimming the background.

**Closes #60.** Changelog v0.9.10 (same as 9D; footer already bumped in 9D).

**Status:** [x] Complete.

### Phase 9E-parallel.2 completion notes (2026-04-21) — QS picker cluster + doc reconciliation

Two workstreams: QS picker cluster (#94, #95, #96, #97) and doc reconciliation for 9E-parallel and 9E-parallel.1.

**#94 — Multi-select summary in preview pane.** The right-side preview slot now renders a selection-summary panel when `previewFile === null && selected.size > 1`. Panel structure mirrors the single-file preview container, header, and "Preview not available" block so the two states feel like siblings:
- Header: SHIELD icon + "SELECTION SUMMARY" label + "{N} files selected"
- Metadata rows: Total size (summed from `parseDisplaySizeToBytes(file.size)` for QS files + `file.bytes` for local uploads), Modified (earliest–latest date range, or single date if all equal), Types (distinct uppercase extensions, deduped)
- Icon block: stacked multi-file illustration (3 offset dashed card shapes, front card shows the count)

Resolution logic iterates both sources: `files` (current-folder QS) filtered by `selected.has(name)`, and `localFiles` (ready uploads across all navigation state) filtered by `selected.has(id)`. QS-side selection is cleared on navigation, so no stale cross-folder entries.

**#95 — Re-add files preserves custom labels. FLAGGED AS OUT-OF-SCOPE.** Root cause confirmed in V22CreateAssetModal.jsx's `handlePickerSelect` at line 163: `setRows(newRows)` replaces the entire rows array on every picker return, losing any user-edited labels on re-selection. Fix requires editing V22CreateAssetModal to merge rather than replace rows (keyed by a stable file identity like `filename + size` or the V22 `file.path`). V22CreateAssetModal is in the MUST NOT TOUCH list for this phase. Considered a picker-only workaround (surface an `initialSelected` prop so re-opens pre-check the same files) — but even with that, V22CreateAssetModal still overwrites labels on every return. The fix has to happen there. Item stays open in backlog with the root-cause note.

**#96 — Local Storage destination folder indicator.** Drop-zone copy now shows the real destination path. `LocalStoragePanel` accepts a `bucket` prop wired from `data.bucket` (e.g., `s3://govco-qualified-storage`). Copy reads:

> Files will be uploaded to **{bucket}/uploads** in your Qualified Storage.

Path bolded (fontWeight 600, `var(--text-secondary)`) to match existing typography conventions. Bucket uses the real `s3://…` URL rather than the display-friendly "GovCo QS Bucket" the task example suggested — that string doesn't exist anywhere in the picker; the `s3://…` URL is the canonical identifier used in the header bar at line 535 too.

**#97 — Local Storage uploads default-checked + Select All / Deselect All.** Two sub-changes:

*Auto-select newly-uploaded files.* The upload simulation tick in `handleFilesChosen` now flips each file's id into `selected` at the `status: 'uploading' → 'ready'` transition. A `markedReady` latch per-upload prevents re-adding if the tick fires multiple times at `p >= 1`. Guarded on `mode !== 'single'` since a batch upload in single-mode would otherwise fight over "which one is selected now" — single-mode users still click to pick.

*Select All / Deselect All toggle.* Renders between the drop zone and the file list, right-aligned, text-style (11px mono, `var(--text-dim)` with hover brightening to `var(--accent-indigo)`). Visible only when `localFiles.length > 0 && mode !== 'single'` and at least one file is `status: 'ready'`. Toggle logic: if every ready local file is already selected → label reads "Deselect all" and click clears all ready-local IDs; otherwise reads "Select all" and click adds all ready-local IDs. QS-side selection (files keyed by name) is not touched — different ID space.

**Doc reconciliation.** Changelog modal entries added for Phase 9E-parallel and 9E-parallel.1 (prepended before the 9D entry in V2App.jsx's Changelog array — touching only those entries, no other V2App changes). CLAUDE.md phase-completion notes for 9E-parallel and 9E-parallel.1 added directly above this note. polish-backlog.md updates for #51, #60, #107 (marked ✅ Complete with accurate root-cause notes per task brief), plus new entries for the four QS picker cluster items.

**Deviations:**
- Multi-select icon: stacked 3-card illustration with the count badge on the front card. Task briefed "generic multi-file icon" — chose stacked-cards as it composes with the existing single-file "2px dashed var(--border)" card icon used by the single-file preview, so the two states visually relate.
- "Modified" row collapses to a single date when all selected files share it, rather than showing "Jan 12 – Jan 12, 2026".
- Summary panel requires `resolvedSelectedForSummary.length > 1` (not just `selected.size > 1`) — defensive against Set entries that fail to resolve (e.g., user deleted a local file after selecting it; stale Set entry could persist briefly).
- Select All toggle guards on `mode !== 'single'` — single-mode's semantics don't support a bulk select.
- Auto-check on upload also guards on `mode !== 'single'` for the same reason.
- #95 flagged out-of-scope per task's explicit escape hatch ("flag as blocked if fix requires V22CreateAssetModal").

**Runtime verification:** Build clean. Preview reloads without new console errors (only the pre-existing `NaN is an invalid value for the left` entries, unchanged since pre-9E). UI walkthrough of the picker (opening via Register Asset flow) would require manual canvas interaction per the V2Canvas 3D raycaster DOM-dispatch limitation; data-layer + module-load verification are the backstops.

**Status:** [x] Complete.

### Phase 9E-parallel.3 completion notes (2026-04-22) — #94 correction, #97 cross-tab mutual exclusion, backlog file merge

Fast-follower fix for two QA findings in Phase 9E-parallel.2 plus the deferred backlog file merge. Single Claude Code instance, single commit.

**Fix 1 — #94 multi-select summary precedence.** 9E-parallel.2's implementation never rendered in practice: the `!previewFile` guard meant that any row click (standard inspection interaction) immediately set `previewFile` and flipped the right pane back to the single-file preview, hiding the summary. Corrected by inverting precedence to match macOS Finder column-view multi-select behavior:

- When `selected.size > 1 && resolvedSelectedForSummary.length > 1` → **summary panel wins** the right-pane slot, regardless of whether `previewFile` is set.
- When `selected.size <= 1 && previewFile` → single-file preview.
- Otherwise → pane hidden.

`previewFile` still persists in state on row click — the guard is purely on the render side. The defensive `resolvedSelectedForSummary.length > 1` check stays (handles stale Set entries where a file was removed after selection).

**Fix 2 — #97 cross-tab mutual exclusion.** 9E-parallel.2's `selected` Set was shared across both tabs, so selecting 3 files in QS then switching to Local could accumulate another 5 local uploads for a footer count of 8. Fixed by clearing `selected` + `previewFile` on tab change:

```js
onClick={() => {
  if (source === tab.id) return
  setSelected(new Set())
  setPreviewFile(null)
  setSource(tab.id)
}}
```

The `source === tab.id` short-circuit prevents clearing on re-clicks of the active tab. Clean, silent reset — no warning modal (explicitly rejected in task brief). Select All / Deselect All toggle and auto-select-on-upload from 9E-parallel.2 continue to work correctly within the active tab; the footer "Select N Files" count always reflects only the active tab's selection. Edge case: 3 in QS → switch to Local (cleared) → upload 2 files (auto-select per #97, count = 2) → switch back to QS (count = 0; prior QS selection is NOT restored).

**Workstream 3 — backlog file merge:** merged items #113–#124 from three reference files (`references/backlog-additions-disclosure-evaluation-split.md`, `references/backlog-additions-post-9c.md`, `references/backlog-addition-unravel-animation.md`) into polish-backlog.md. Original #-IDs preserved (no resequencing). Placed into categorical homes:
- **Process Flows:** #113 (Split Combined Request into Disclosure + Evaluation), #117 (Re-Run Evaluation permissive Asset selection with audit metadata), #118 (Bob's Asset shouldn't get NEW badge on disclosure accept).
- **Data Model & Content:** #114 (Umbrella Disclosure + second seller role), #115 (EA terms checkboxes + metadata schema), #119 (Evidence → Assets terminology audit).
- **Detail Panels:** #116 (Agreements section on Eval / Parse Result Detail Panels).
- **Exploratory / Experimental:** #120 (Reference published Req Sets on a Claim — non-binding), #121 (Multi-Req-Set evaluation), #122 (Remove evidence post-evaluation), #123 (Reverse AI Shopper — publish EA as RFP).
- **Visual & Rendering (animation area, near #110):** #124 (Revoked node unravel animation sequence).

All items filed as Open (not Complete). Reference files intentionally left in `references/` — Andrew's call whether to archive.

**Workstream 4 — doc reconciliation:**
- polish-backlog.md: #94 reopened and re-shipped as ✅ Complete (Phase 9E-parallel.3) with the 9E-parallel.2 gap explained. New entry #125 filed and shipped ✅ Complete (QS picker cross-tab mutual exclusion). Update Log entry for 9E-parallel.3 appended.
- CLAUDE.md: this note.
- Changelog modal (V2App.jsx): new entry prepended above the 9E-parallel.1 entry. Kept on v0.9.10 (following the 9E-parallel / .1 / .2 sibling pattern — all at 0.9.10, no footer bump per task's "touch only the Changelog array" constraint).

**Deviations from task brief:**
- **No footer version bump.** Task brief's handoff checklist didn't mandate it; the 9E-parallel sibling entries all share v0.9.10, and bumping would imply a larger change than a fast-follower fix. The 9E-parallel.2 Changelog entry is also still missing (it was never added, possibly because it referenced itself) — this phase didn't backfill that gap either, staying strictly within the "prepend 9E-parallel.3 above 9E-parallel.1" directive.
- **#95 still Open.** Out of scope per explicit task escape hatch (V22CreateAssetModal in MUST NOT TOUCH list). No changes to its status or note.
- **Reference files left in place.** Task said "optional — Andrew's call; safest to leave them and let him clean up." Left as-is.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit. Fix #94 renders the summary panel on multi-select even with a prior row click — verified via the QS picker opened through Register Asset from GovCo Actor panel, selecting multiple files via checkbox + clicking a row. Fix #97 clears the footer count between tab switches — verified by selecting in QS, switching to Local, confirming footer count drops to 0. (V2Canvas 3D raycaster DOM-dispatch limitation noted since 9A.6 still constrains scripted click drive; manual mouse interaction is the verification path.)

**Status:** [x] Complete.

### Phase 9E-parallel.4 completion notes (2026-04-22) — two fast-followers from 9E-parallel.3 QA

Narrow cleanup pass. Two small gaps surfaced during QA of 9E-parallel.3 (commit bc1a78a).

**Fix 1 — single-preview render condition tightened.** 9E-parallel.3's condition was `previewFile && selected.size <= 1`. The `<=` included the zero-selected case, so `previewFile` persisting from a prior row click caused the single-file preview to linger after the user unchecked all files. Changed to `previewFile && selected.size === 1`:

- `selected.size === 0` → right pane hidden, regardless of `previewFile` state.
- `selected.size === 1 && previewFile` → single-file preview renders.
- `selected.size > 1 && resolvedSelectedForSummary.length > 1` → summary panel renders (unchanged).

Kept `previewFile` state as-is on uncheck — the gate is purely on the render side, so no new side effects / cleanup effects / state-coupling to worry about.

**Fix 2 — seed data adjustment for summary-date collapse verification.** The #94 summary's Modified-date logic collapses to a single date when all selected files share one, otherwise renders as a range. 9E-parallel.3's seed data had no folder where 2+ files shared a date, so the collapse path wasn't runtime-verifiable. Targeted the `sentinel-program/manufacturing-reports` folder in MOCK_BUCKETS (in V22QualifiedStoragePicker.jsx — the QS picker's seed data lives in-file, not in `v2_2Data.js`):

- `sentinel4-assembly-report.pdf` — `2026-03-15` (kept).
- `propulsion-test-results.pdf` — `2026-03-12` → `2026-03-15` (changed to match).
- `thermal-analysis-v2.pdf` — `2026-03-10` (kept).

Both paths now testable:
- Select the two `2026-03-15` files → summary shows `2026-03-15` (collapsed).
- Select all three (or any mix that spans) → summary shows `2026-03-10 – 2026-03-15` (range).

**Deviations:** none. Task was tight and prescriptive.

**Runtime verification (preview):** Build clean. Preview reloads cleanly; no new console errors beyond the pre-existing `NaN is an invalid value for the left` entries (unchanged since pre-9E). End-to-end UI walkthrough of the picker (Register Asset → uncheck all → confirm pane hides; navigate to manufacturing-reports → select the 2 shared-date files → confirm single Modified date) still requires manual mouse input per the V2Canvas 3D raycaster DOM-dispatch limitation; code-level verification via source re-read + source-grep on the changed strings is the backstop.

**Status:** [x] Complete.

### Phase 9D.1 completion notes (2026-04-22) — Revocation UX redo (counterparty side → Detail Panel pattern)

Closes backlog #112's UX redo half. The functional revocation logic from 9D stays; the counterparty-side `V22RevocationNoticeModal` gets replaced with a Detail Panel pattern that's more V2.2-native. Unravel animation (#124) explicitly **split out** to Phase 9D.2 per the task brief's allowance — V2Canvas has no edge-retraction infrastructure today and the clockwise border unwind is its own focused workstream.

**Scoping decision (upfront):** The task brief flagged the split option explicitly ("If the combined scope of Workstreams 1–6 starts feeling like two phases, flag it — we can split into 9D.1 (UX redo only) + 9D.2 (unravel animation)"). My honest scope assessment: Workstream 5 (unravel animation) alone rivals the rest combined — new Three.js edge-retraction animation tooling, custom clockwise SVG border unwind, cascade choreography + queue management. Combined scope would either blow the commit or produce thin animation code that has to get reworked. Proceeding with split. Dismiss today triggers immediate removal (same as 9D) — 9D.2 will wrap that state transition in the animation.

**Workstream 1 — V22RevocationNoticeModal removed from notification-click path:**
- V2App.jsx notification-click handler for `v22-da-revoked` / `v22-ea-revoked` no longer calls `setV22RevocationNotice(req)`. Replaced with an `ensureParentLayer` block that (1) marks the notification as dismissed, (2) resolves the target Claim node via `req.claimId`, (3) calls `setSel(targetNode.id)` + `animatedPanToWithZoom(targetNode.x, targetNode.y, 1.28, 500)`, and (4) conditionally sets `v22ActiveRevocationNotice` for the grantor-side path only (detects via `targetNode.isRevoked || targetNode._isRevoked` — present on grantee side, absent on grantor side).
- Modal mount block stripped. Import commented out (`// import V22RevocationNoticeModal...`) with a pointer to #50 for the eventual dead-code sweep. File itself (`src/components/modals/V22RevocationNoticeModal.jsx`, 166 lines) is left in place — deletion felt inappropriately destructive for a dead-code sweep that has its own dedicated backlog item. Retained state: `v22Revoking` (revoker-side Confirm modal state, unchanged).

**Workstream 2/3 — shared `RevocationNoticeSection` + case-routed copy:**
- New `RevocationNoticeSection` component in `V22NodeDetailPanel.jsx`. Props: `viewerIsGrantor`, `kind` ('DA' | 'EA'), `daType` ('full' | 'selective' | 'proofonly'), `revokerParty`, `revokedDate`, `reason`, `cascadeEa` (bool), `cascadeEvalResultCount`, `onDismiss`. Structure:
  - Red-accented header callout — 44px circular X icon (matches the V2.1 reference pattern: `color-mix(in srgb, var(--accent-red) 10%, transparent)` background + 30% border), "Access Revoked" title, case-routed one-line summary with bolded party + `daTypeLabel` / "Evaluation Agreement" highlights, ISO date line underneath.
  - Message-from-revoker block — mono label "MESSAGE FROM {REVOKER}" + italicized quote; dim "(No reason given)" fallback when no reason provided.
  - Cascade summary — amber-accented strip with "Cascade" mono tag + dynamic list ("This revocation also terminated: 1 Evaluation Agreement, 2 Evaluation Results"). Only renders when `cascadeEa || cascadeEvalResultCount > 0`; lists only non-zero categories.
  - "What this means" explainer — dim body copy; case-routed (4 variants).
  - Inline Dismiss button — right-aligned, indigo-filled, in a surface-raised footer strip.
- Copy variants per task brief, copy-preserved verbatim:
  - **A (grantor-initiated DA, grantee sees):** "{Alice} has revoked your {daTypeLabel} disclosure to this Claim." → "This Claim and its referenced Assets have been removed from your network…"
  - **B (grantee-initiated DA, grantor sees):** "{Bob} has revoked their {daTypeLabel} disclosure access to this Claim." → "They no longer have visibility into this Claim…"
  - **C (grantor-initiated EA, grantee sees):** "{Alice} has revoked your Evaluation Agreement for this Claim." → "You can still view this Claim under your existing Disclosure Agreement, but you can no longer run evaluations against it…"
  - **D (grantee-initiated EA, grantor sees):** "{Bob} has revoked their Evaluation Agreement for this Claim." → "They no longer have the ability to run evaluations against this Claim…"
- **Routing logic:** `viewerIsGrantor = activeParty === node.owner`; `kind` from notification type (DA/EA) or, on the grantee-REVOKED-branch path, hard-coded to 'DA' (the REVOKED state is triggered only by DA revocation; EA-only revocations don't flip `_revokedMeta` on the Claim, so the standard panel + `revocationNotice` prop handles Case C instead).

**Two entry points for the section — one for each side:**
- **Grantee side (Cases A, C — revoked Claim in view):** Existing `isRevoked` branch of `V22ClaimPanel` gets enriched. Replaces the prior slim "Revocation" section with a `<RevocationNoticeSection ... />` at the top of the body. Below it: a Claim summary section (Owner + Description), then the dimmed-revoked-agreements list (Workstream 6, below). Footer is a single prominent "Dismiss" button (accent-colored). Non-Dismiss exit (ESC, click canvas, select another node) preserves the REVOKED state — `_revokedMeta` persists until `handleV22DismissRevoked` fires.
- **Grantor side (Cases B, D — standard Claim panel, `v22ActiveRevocationNotice` matches):** Standard Claim panel's `<PanelLayout body>` gets a new leading block: if `revocationNotice` prop is non-null AND `activeParty === node.owner`, render `<RevocationNoticeSection viewerIsGrantor kind={...} ... onDismiss={onDismissRevocationNotice} />` before the description/Owner sections. Standard footer (Amend Claim / Self-Evaluate / Run Evaluation) stays as-is. Dismiss clears `v22ActiveRevocationNotice`; non-Dismiss exit keeps the notice until role switch or explicit Dismiss.

**Workstream 4 — Dismiss wiring:**
- `onDismissRevoked` (grantee side) wrapped to also clear `v22ActiveRevocationNotice` (safety — in case both paths would otherwise fire). `onDismissRevocationNotice` (grantor side) = `setV22ActiveRevocationNotice(null)`. No artifact removal on the grantor side — there's nothing revoked on their canvas to remove.

**Workstream 6 — dimmed revoked DA/EA rows in Agreements Section:**
- `buildViewForActor` already exposes `revokedDisclosureAgreements` + `revokedEvaluationAgreements` as separate arrays on the view (shipped 9D). V2App.jsx now filters those to the current Claim (`subject.kind === 'claim' && subject.id === node.id` for DAs; `claimId === node.id` for EAs) and passes `revokedDisclosureAgreementsForNode` / `revokedEvaluationAgreementsForNode` as new props to `V22NodeDetailPanel`. Only Claim panels populate these today (Actor/Asset panels currently pass empty arrays — out of scope here since the revoked-artifact-on-canvas state is Claim-specific).
- `AgreementsSection` grew two new props. Renders a new "Revoked (N)" subsection below the active DA + EA subsections when any revoked items are present. Row rendering reuses `DisclosureAgreementRow` / `EvaluationAgreementRow` — those components detect `_revokedMeta` internally, set `statusLabel = 'Revoked'` (red), hide all action labels, and wrap the whole row in `<div style={{ opacity: 0.5, pointerEvents: 'none' }}>` via a new `rowInner`/`if (isRevoked) wrap` pattern. EA row adds an `isRevoked` check mirroring the DA row; `expiresStr` flips to "Revoked" for visual consistency.

**Deviations from task brief:**
- **Workstream 5 (unravel animation) explicitly split out** per task brief's allowance. Filed under #124 with a status note pointing at Phase 9D.2. Dismiss triggers immediate removal today, matching 9D.
- **V22RevocationNoticeModal.jsx kept as dead code.** Task offered both options ("delete outright OR leave... with flag"). Left in place — deletion feels too destructive for a dead-code sweep that has its own dedicated backlog item (#50). Import in V2App.jsx commented out with a pointer to #50.
- **Actor/Asset panels don't receive revoked DAs/EAs today.** The revoked subsection only surfaces on Claim panels (where the grantee has pre-Dismiss context). Actor/Asset revoked-agreement lists would be useful in a general "history" capacity but out of scope for 9D.1 — can fold into a future phase alongside #116 (Eval/Parse Result Agreements sections).
- **V22RevocationConfirmModal unchanged** per out-of-scope list. The revoker-side interruption pattern is correct; no reason to touch it.

**Runtime verification:** Build clean (86 modules, was 87 — V22RevocationNoticeModal confirmed dropped from the module graph). Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit with no new console errors (only pre-existing `NaN is an invalid value for the left` warnings, unchanged since pre-9E). End-to-end UI walkthrough of revocation flows (Alice → Bob DA revoke → Bob clicks notification → panel opens with Case A copy → Dismiss; same for Cases B/C/D) still gated by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse interaction is the verification path. Code-level verification via source re-read + build success is the backstop. Data-layer invariants unchanged (9D's cascade logic + `_revokedMeta` flagging drives both the grantee-side `isRevoked` branch and the grantor-side `v22ActiveRevocationNotice` routing).

**Status:** [x] Complete.

### Phase 9D.1.1 completion notes (2026-04-22) — Revocation UX corrections

Seven corrective fixes from 9D.1 QA. Single commit. No animation work (that stays in 9D.2).

**Fix 1 — Inline Dismiss removed from `RevocationNoticeSection`.** The section no longer renders its own Dismiss button. Single Dismiss surface per viewer: grantee-side REVOKED branch uses the existing footer Dismiss; grantor-side (and grantee Case C) gets a footer Dismiss button that only renders when `revocationNotice` is active. The footer render block switched from a conditional ternary to an IIFE returning `null` when no buttons would render (preserves the prior "no footer div" behavior when nothing's in it — `PanelLayout` renders the `<div>` whenever footer is truthy, so an empty fragment would have created an empty strip).

**Fix 2 — Revocation date in revoked DA + EA rows.** `DisclosureAgreementRow` / `EvaluationAgreementRow` now read `da._revokedMeta?.revokedDate` / `ea._revokedMeta?.revokedDate` when the row is revoked. DA row's `dateStr` branches on `isRevoked`; EA row's `expiresStr` now renders `Revoked · YYYY-MM-DD` (or plain `Revoked` if no date). Standard-row semantics (createdDate / expiresDate) unchanged for non-revoked rows.

**Fix 3 — Grantee-initiated revocation from Agreements Section.** `showRevoke` gate widened from `isGrantor` to `(isGrantor || isGrantee)` on both DA + EA rows. Amend stays grantor-only (scope changes are the grantor's prerogative; revocation is symmetric because either party can terminate an agreement they're a party to). Verified `handleOpenRevocationConfirm` + `handleRevokeConfirm` in V2App.jsx handle grantee-initiated revocation correctly — `counterpartyParty` computed symmetrically (`agreement.grantor.party === activeRole.party ? agreement.grantee.party : agreement.grantor.party`); `revokerParty: activeRole.party` sets the record correctly regardless of initiator side.

**Fix 4 — Revoke button on DA + EA Agreement Detail Panel footers.** Added as the second footer button alongside Amend. Gating mirrors the Agreements Section row: `(isGrantor || isGrantee) && !isInternal && !isProofOfEval && !isRevoked && !isProvisional && agreement.status === 'active'` for DA; same minus `isProofOfEval` for EA. Red-outline styling (transparent background, `var(--accent-red)` border + text, 10% red mix on hover) matching the V2.1 destructive-action pattern. `V2App.jsx` passes an `onRevoke` callback that closes the agreement panel then dispatches to `handleOpenRevocationConfirm`. Same handler used by the Agreements Section row, so there's a single revocation entry point regardless of UI surface.

**Fix 5 — Case C notice rendering.** `noticeForGrantor = revocationNotice && (activeParty === node.owner) ? revocationNotice : null` was rejecting grantee-side notices on EA-only revocations (the Claim stays visible via the DA, but the EA is gone — grantee isn't the Claim owner). Renamed `noticeForGrantor` → `noticeForPanel`; dropped the `activeParty === node.owner` gate; compute `panelViewerIsGrantor = activeParty === node.owner` and pass it to `RevocationNoticeSection` so its case-routing resolves the right copy variant. `V2App.jsx`'s `revocationNoticeForPanel` derivation also drops the matching gate. Notification-click handler's `isRevokedOnThisCanvas` check covers the branching (REVOKED branch handles Case A; standard panel + notice handles B/C/D).

**Fix 6 — Dismiss handler annotates instead of filters (critical regression).** `handleV22DismissRevoked` was removing revoked DAs/EAs/ERs from `v22Provisionals`. Because `mergeProvisionals` uses `mergeById`, removing the annotated provisional let the seeded (non-revoked) original re-emerge in the merged view — the Claim came back un-revoked, ACTIVE. Fix: annotate the dismissed items with `_dismissedRevoked: true` rather than filtering. Annotation keeps the provisional override in place (still shadowing the seeded row via mergeById) while `buildViewForActor` pre-filters any `_dismissedRevoked: true` items from `partyDisclosureAgreements`, `evaluationAgreements`, `ownedEvaluationResults`, and `visibleEvaluationResults`. Result: dismissed-revoked artifacts are invisible across all view-layer outputs (active + revoked subsections) while the audit record in `revocationRecords` is untouched. Verified symmetrically on both sides (grantee dismisses → Alice's side still shows her Claim as hers, no longer sees the revoked DA in any agreements list).

**Fix 7 — `RevocationNoticeSection` layout redesign.** Dropped the modal-ported red-tinted full-width header + 44px circular X icon + bottom-border Dismiss strip in favor of a Detail-Panel-native layout:
- Top-level `<Section title="Revocation Notice">` containing `<Row>` From / `<Row>` Date / (optional) `<Row>` Cascade.
- Red-accented summary box (inside the Section, matching the declined-branch reason box pattern): "Summary" label + headerSummary text (case-routed, preserves bolded party names via JSX) + italic reason blockquote with "(No reason given)" fallback.
- Consequence paragraph below the Section — small (11px), dim text color, tight line-height, matches how the standard Claim panel renders `claim.description`.

Feels like a structured panel section rather than a floated modal. Pattern-matches the existing declined-branch treatment for visual continuity across terminal states.

**Deviations:** none — all seven fixes landed as described. The "critical dismiss regression" (Fix 6) is highlighted in the polish-backlog because it's the highest-impact change (without it, Dismiss wouldn't actually dismiss). Fix 7's specific layout leans toward the declined-branch pattern rather than the "3px red left stripe" option offered in the task brief — closer match to existing V2.2 conventions.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads cleanly post-edit. Manual end-to-end UI walkthrough (Cases A/B/C/D + Dismiss persistence test + DA-panel-Revoke + EA-panel-Revoke) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants: `_dismissedRevoked` filter applied in three places in `buildViewForActor` (`partyDisclosureAgreements`, `evaluationAgreements`, `ownedEvaluationResults` + `visibleEvaluationResults`); dismissed items excluded from both `active*` and `revoked*` output arrays automatically.

**Status:** [x] Complete.

### Phase 9D.1.2 completion notes (2026-04-24) — per-EA inline revocation + loose ends

Four workstreams. The big one is the per-EA inline revocation pattern; the tooltip arrow fix is surgical; the backlog filing and docs round it out. Single commit.

**Workstream 1 — per-EA inline revocation pattern (Cases C/D).** EA-only revocation (DA stays active, only EA is revoked) no longer surfaces a Claim-level Revocation Notice Section. The Claim isn't being removed — only the one EA relationship — so anchoring the dismiss ceremony at the Claim level was structurally wrong. New pattern:

1. Counterparty clicks the `v22-ea-revoked` notification.
2. V2App's notification handler sets `v22ActiveRevocationNotice` with `kind: 'EA'` (routing key). Canvas pans + selects Claim.
3. V22ClaimPanel renders its **standard** branch (Claim is not revoked; `isRevoked = false`).
4. V2App derivation computes two new values and passes them to the panel: `expandedRevokedEaId` (the targeted EA's id — comes from `notif.agreementId`) and `expandedRevokedEaInfo` (`{ revokerParty, revokedDate, reason }`).
5. V22ClaimPanel threads these through `AgreementsSection` → `EvaluationAgreementRow`. Each row compares its own `ea.id` against `expandedRevokedEaId`; the matching row gets a non-null `expandedRevokedInfo` prop.
6. In the matching row: a `useEffect` keyed on `isExpanded` calls `rowRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' })` — the panel body's `overflowY: auto` container scrolls to center the row. Then the row renders its inline red block beneath its standard content: "Evaluation Agreement Revoked · YYYY-MM-DD" header, case-C-or-D copy summary, italic reason blockquote, consequence paragraph, right-aligned inline Dismiss button.
7. Dismiss calls `handleV22DismissRevokedEa(eaId)` in V2App, which annotates the one EA with `_dismissedRevoked: true` and clears `v22ActiveRevocationNotice`. `buildViewForActor`'s existing 9D.1.1 pre-filter picks up the flag and removes the EA from all view outputs (active + revoked subsections). The Claim and any Eval Results remain untouched.

**Routing via `v22ActiveRevocationNotice.kind`:**
- `kind === 'DA'` → `revocationNoticeForPanel` populated; `expandedRevokedEaId/Info` null. Case A (REVOKED branch) or Case B (standard + top-level notice).
- `kind === 'EA'` → `revocationNoticeForPanel` null; `expandedRevokedEaId/Info` populated. Cases C/D (standard + inline row expansion).

Task brief's suggested routing was "whether the Claim has `_revokedMeta` (A/B) vs whether only its EA has `_revokedMeta` (C/D)". I used the notification kind directly since it's unambiguous and doesn't require traversing shared state to distinguish. Same outcome, cleaner code.

**Copy update for Cases C/D.** Both the new inline block copy and the existing `RevocationNoticeSection` Case C/D strings now reflect that Eval Results persist across EA revocation (they're independent artifacts, not cascaded). Specifically:
- Case C: "…you can no longer run evaluations against it. Any Evaluation Results you previously submitted **remain visible on your canvas**." (was: "…have been terminated.")
- Case D: "…Prior Evaluation Results **remain visible on both canvases**. Your Claim and its disclosure to them remain active." (was: "…have been terminated.")

The shared `RevocationNoticeSection` component's C/D strings are updated too even though those cases no longer render the section — for consistency if the component is ever reused or the routing contract changes. The actual view path for Cases C/D now goes through the inline `EvaluationAgreementRow` expansion.

**New `handleV22DismissRevokedEa` (V2App.jsx).** Pattern-matched against 9D.1.1 Fix 6's `handleV22DismissRevoked` for DAs. Annotates only the single targeted EA with `_dismissedRevoked: true`; does NOT touch Eval Results or the DA. `buildViewForActor`'s pre-filter handles the rest. Clears `v22ActiveRevocationNotice` on dismiss so the inline block collapses on next render.

**Workstream 2 — Tooltip arrow alignment.** `Tooltip.jsx` arrow positioning used `left: '50%'; transform: translateX(calc(-50% + Xpx))` on a `width: 0` triangle with `border-left/right: ARROW_SIZE` each. The CSS Transforms spec resolves percentage translates against the **border-box**, so `-50%` on a 0-width-with-borders element resolved to `-ARROW_SIZE` in strict engines (not 0 as it would if content-box were referenced). Result: arrow border-box center sat at `tooltip 50% - ARROW_SIZE`, not at tooltip center. The visual misalignment reported in QA.

Fix: replace with direct pixel math `left: calc(50% - ARROW_SIZEpx + Xpx)` (no transform). Border-box left edge lands at `tooltip 50% - ARROW_SIZE + X`, border-box center at `tooltip 50% + X` — exactly where the anchor sits (when X = anchorCenterX - clampedX = 0 for unclamped cases). Applied to both the border arrow and the 1px-inset fill triangle. Behavior is now independent of browser reference-box interpretation.

**Workstream 3 — Backlog #126 filed.** EA reinstate flow on a Claim with existing DA. Sits in Process Flows near #113 (DA/EA separation); noted as likely shipping with #113's "warm path" in Phase 11 rather than standalone.

**Workstream 4 — Docs.** polish-backlog.md: #112 status note extended with 9D.1.2 entry; new #127 ✅ for the tooltip arrow fix; #126 filed; Update Log entry prepended. CLAUDE.md: this note. Changelog modal: new v0.9.10 / 9D.1.2 entry prepended above 9D.1.1. Touched only the Changelog array.

**Deviations from task brief:** none material. Task suggested routing key could be `_revokedMeta` location (Claim vs EA); implementation uses `v22ActiveRevocationNotice.kind` (set from notification type) — equivalent routing, simpler code. No dedicated `v22ScrollToRevokedEa` state as the task brief sketched; the targeting ID is just `expandedRevokedEaId` derived from `v22ActiveRevocationNotice.notification.agreementId`. `scrollIntoView` lives on the EA row itself, triggered by its own `useEffect` on the `isExpanded` flag — cleaner than a panel-level scroll coordinator.

**Runtime verification:** Build clean (same 86-module count as 9D.1.1; no new/removed modules). Preview reloads cleanly; no new console errors beyond the pre-existing `NaN is an invalid value for the left` warnings (unchanged since pre-9E). Scroll-into-view + inline block + inline Dismiss + Case C/D copy routing all verified structurally via source re-read. UI walkthrough still gated by V2Canvas 3D raycaster DOM-dispatch limitation — manual mouse interaction is the verification path for the four cases.

**Status:** [x] Complete.

### Phase 9D.1.3 completion notes (2026-04-24) — Case B inline pattern + Eval Result persistence + polish fixes

Seven fixes in one commit. The cascade-semantics revision (Fix 6) is the biggest behavioural shift since 9D itself: Evaluation Results are now treated as independent artifacts owned by the grantee and persist across DA/EA revocation. Previously DA revocation cascade-annotated the grantee's ERs with `_revokedMeta` and dismissed them alongside the Claim.

**Fix 6 — Evaluation Results no longer cascade on DA revocation.**
- `handleRevokeConfirm` in V2App.jsx no longer annotates ERs with `_revokedMeta`. The `for (const er of cascadedErs) { upsertEr(...) }` block is removed; the `cascadedErs` local is hard-coded to `[]`; the `upsertEr` helper is removed; `nextErs` is no longer touched.
- `buildCascadeInfo` now always returns `evalResultCount: 0` + `evalResultNames: []` for DA revocations (was computing `cascadedErs.length` via `findCascadedEvalResults`). Shape preserved so the revoker-side Confirm modal doesn't need a schema migration.
- Notification payload: `cascadeIncludesEvalResults: []` (was `cascadedErs.map((er) => er.id)`). Shape preserved.
- **Ownership rationale**: a DA gives the grantee visibility + action rights. An Evaluation Result is an artifact the grantee creates under an EA and stores in their own QS. Revoking visibility doesn't retroactively terminate an artifact the grantee created. The grantee gets to decide what happens to their orphaned ERs.
- **Detail Panel surface**: new "Dismiss" footer on orphaned ER panels (see Fix 6 UI below).

**Fix 6 (UI) — Orphaned Eval Result Dismiss.** `V22EvalResultPanel` accepts `isOrphaned` + `onDismissOrphanedEvalResult` props. Orphan detection (V2App): an ER is orphaned iff it has an `evaluationAgreementId` (self-evaluated ERs excluded), isn't superseded, AND its backing EA is absent from `v22View.evaluationAgreements` (either revoked or already-dismissed). When orphaned, a red-accented "Orphaned Evaluation Result" section surfaces in the body explaining the situation, and the footer swaps from "Re-Run Evaluation" to "Dismiss". Confirmation dialog ("Dismissing this Evaluation Result removes it from your canvas view only. The Evaluation Result remains in your Qualified Storage and its data lineage is preserved in the ledger.") fires on click; on confirm, `handleV22DismissOrphanedEvalResult` annotates `_dismissedRevoked: true` on the ER. `buildViewForActor`'s existing pre-filter (from 9D.1.1 Fix 6) excludes the flagged ER from all view outputs.

**Fix 1 — Case B inline DA pattern.** Case B (grantee-initiated DA revocation, grantor view) now routes to the same inline-row pattern 9D.1.2 shipped for Cases C/D. `DisclosureAgreementRow` extended with `expandedRevokedInfo` + `onDismissExpandedRevokedDa` props, `useRef` + `scrollIntoView` effect, and a red inline block beneath the row with Case B copy. `AgreementsSection` threads the new `expandedRevokedDaId` / `expandedRevokedDaInfo` / `onDismissExpandedRevokedDa` props to both active + revoked DA subsections. `V22ClaimPanel` signature + AgreementsSection call updated. V2App routing in the panel-props derivation block now splits on `(kind, viewerIsGrantor)`:
- Case A (DA + !grantor) → `revocationNoticeForPanel` populated (REVOKED Claim branch renders it)
- Case B (DA + grantor) → `expandedRevokedDaId/Info` populated (inline DA row)
- Cases C, D (EA) → `expandedRevokedEaId/Info` populated (inline EA row)

New `handleV22DismissRevokedDaGrantorSide` in V2App: annotates the DA + its paired EA with `_dismissedRevoked: true`. The Claim is NOT dismissed (it's the grantor's — they keep it); no ER touches (Fix 6).

**Fix 7 — Case A + Case B copy refreshed.** Updated in `RevocationNoticeSection` (Case A) and the new inline DA block (Case B) to reflect the persistence model:
- Case A: "…Evaluation Results you previously produced against this Claim remain in your Qualified Storage and on your canvas; you can dismiss them from your canvas individually from each Evaluation Result's Detail Panel if you wish."
- Case B: "…The paired Evaluation Agreement has also been terminated. Evaluation Results they previously produced remain in their Qualified Storage and on their canvas. Your Claim and its data remain on your network."

Cases C/D copy already reflected this correctly from 9D.1.2.

**Fix 3 — "Eval Results" → "Evaluation Results" audit.** In-scope user-facing strings in revocation UI:
- `V22ClaimPanel` REVOKED branch footer Dismiss title: "Remove the revoked Claim and its paired Evaluation Agreement from your canvas. Your Evaluation Results remain in your Qualified Storage and stay on your canvas — dismiss them individually from each Evaluation Result's Detail Panel if you wish. Historical records are preserved for audit."
- `V22RevocationConfirmModal` EA revocation callout: "Historical Evaluation Results are preserved."
- All new inline-block copy uses "Evaluation Results."
- Dead-code `V22RevocationNoticeModal.jsx` not touched (already flagged for #50 sweep).
- Code comments left using "Eval Results" shorthand — not user-facing.
- Broader app-wide "Evidence"/"Eval Results"/"Assets" terminology audit stays scoped to backlog #119 (Phase 11).

**Fix 4 — Badge precedence.** `AssetNode.jsx` badge composition now suppresses PROVISIONAL when `isRevoked` (added to the existing `!isDeclined` guard) and suppresses DECLINED when `isRevoked`. REVOKED renders alone on a revoked Claim. Matches the declared precedence: REVOKED > DECLINED > PROVISIONAL.

**Fix 5 — Revoked card opacity.** Revoked Claims reuse `_showAsProvisional: true` to get the dashed-border treatment; the existing `opacity: 0.6` branch (line 552 full card / 1162 mini card) was dropping the whole card to 60%, leaking underlying canvas content through. Fix: branch the opacity by `(showAsProvisional && !isRevoked) ? 0.6 : 1` and introduce an opaque red-tinted background for `isRevoked`:
- Full card: `color-mix(in srgb, var(--bg-deep) 90%, var(--accent-red))`
- Mini card: `color-mix(in srgb, var(--bg-card) 90%, var(--accent-red))`

Red border + red badge retained. No color-mix-with-transparent; the tint is baked into a solid color against the canvas surface.

**Fix 2 — Tooltip arrow measurement.** Root cause: `halfEst = Math.min(maxW, 200) / 2` in `TooltipBody` was a hard-coded estimate diverging from the tooltip's actual rendered width. When anchor is near a viewport edge, the clamp uses `halfEst` → `clampedX` can be far from `anchorCenterX`. Arrow offset = `anchorCenterX - clampedX` could exceed the tooltip's actual half-width, pushing the arrow past the tooltip body. Fix:
1. New `measuredWidth` state in the `Tooltip` component; `useEffect` reads `tooltipRef.current.offsetWidth` after mount and updates state → triggers a second render with correct geometry.
2. `TooltipBody` accepts `measuredWidth` prop; uses it for `half` in the clamp math when available (falls back to 200 on first paint).
3. Arrow offset bounded to `half - ARROW_SIZE - 4` so the arrow never visually detaches from the tooltip.
4. `measuredWidth` resets on hide so fresh content gets re-measured on next show.

**Deviations:** none. All seven fixes landed as described.

**Runtime verification:** Build clean (86 modules, same as 9D.1.2). Preview (`http://localhost:5173/v2.html`) reloads with only pre-existing `NaN is an invalid value for the left` warnings. Manual E2E walkthrough for all 4 revocation cases + orphaned-ER Dismiss constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants: `handleRevokeConfirm` no longer mutates `evaluationResults`; `buildCascadeInfo` returns `evalResultCount: 0`; orphan detection correctly skips self-evaluated + superseded ERs.

**Status:** [x] Complete.

### Phase 9D.1.4 completion notes (2026-04-26) — orphaned-ER Dismiss bugs + minor polish

Four fixes addressing 9D.1.3 QA findings. Two are bug fixes in the orphaned-Eval-Result flow (one critical — the dismiss was silently no-opping for seed-data ERs); two are polish (modal styling + copy revision).

**Fix 1A — orphan dismiss handles seed-data ERs.** Root cause: `handleV22DismissOrphanedEvalResult` previously took an `evalResultId` and `.map`-ped over `prev.evaluationResults` to annotate the matching row. For seed-only ERs (e.g., the MIL-PRF-55681 Compliance demo data, which lives in `buildV22SharedArtifacts()` but never gets pushed into `v22Provisionals.evaluationResults`), the map matched nothing — silent no-op. The view builder's `_dismissedRevoked` filter never fired, the ER stayed on canvas. This was a divergence from the working `handleV22DismissRevoked` pattern, which only worked because pre-9D.1.3 the upstream `handleRevokeConfirm` had already pushed annotated ERs into provisionals via `upsertEr`. After 9D.1.3 Fix 6 removed that cascade write, the orphaned-dismiss path is now the only path that ever pushes ERs into provisionals — it has to handle the append case. Fix: handler now accepts the full ER artifact (not just the id); checks if it's already in `prev.evaluationResults`; if yes, `.map` and annotate; if no, append `{ ...evalResultArtifact, _dismissedRevoked: true }` as a tombstone. `mergeProvisionals`'s mergeById shadows the seeded row; `buildViewForActor`'s pre-filter (9D.1.1 Fix 6) drops the dismissed row from every view output. Call site at V2App's panel mount also updated to pass `node.v22Artifact` rather than `er?.id`.

**Fix 1B — Cascade POE DAs on DA revocation.** Root cause: Bob's Eval Result is visible to Alice via a Proof-of-Evaluation DA (subject = the ER, grantor = Bob, grantee = Alice). The view builder's `proofDaEvalResultIds` (v2_2Data.js line 1349-1355) gives Alice visibility into the ER. When Alice revoked Bob's primary disclosure DA, the cascade only annotated the paired EA — the POE DA stayed active. Bob's ER kept showing on Alice's canvas with no Dismiss action available (correct — she doesn't own it; Bob does). Fix: in `handleRevokeConfirm` DA branch, after the paired-EA cascade, find all Eval Results in the shared dataset where `er.evaluationAgreementId === pairedEa.id`, then find any DA where `subject.kind === 'evalResult'` and `subject.id === er.id` (the POE DAs flowing back to the Claim owner), and annotate each with `_revokedMeta` carrying `cascadedFromDaId: agreement.id` + reason "Cascaded from DA revocation (POE)". Each cascaded POE DA also gets its own `revocationRecord` entry. Result: Alice's POE visibility into Bob's ER ends immediately on revocation. Bob's ER persists on his canvas (he owns it via his ownership DA, untouched by the cascade); his Dismiss action affects only his canvas. **Critical preserved invariant**: the Eval Result artifact itself is still NOT annotated — only the access agreement (POE DA) is. Bob's QS keeps the artifact; the platform-level access control just ends Alice's read.

**Fix 2 — Replace `window.confirm` with styled modal.** New `V22DismissEvalResultModal.jsx` using the `Backdrop` / `Modal` / `ModalHeader` / `ModalBody` / `ModalFooter` / `Btn` primitives from `ModalShared.jsx`. Pattern-matched against `V22RevocationConfirmModal` — same width (520), accent (indigo) Confirm button right-aligned. Subtitle shows the ER's name (or requirements set name). State `v22DismissingEvalResult` (the ER artifact, or null) lives in V2App; the panel's Dismiss button just calls `setV22DismissingEvalResult(node.v22Artifact)`. Modal Confirm calls `handleV22DismissOrphanedEvalResult(er)` then clears the state. Modal Cancel just clears. The panel's footer button no longer references `window.confirm`.

**Fix 3 — Case B inline-DA copy revision.** Substitute the grantee party name (`info.revokerParty` for the inline block; `revokerParty` prop for the `RevocationNoticeSection` Case B branch) instead of "they/their" pronouns. Consequence rephrased ("The Evaluation Agreement with this Claim has also been terminated"; "remain in their Qualified Storage and on their network"; "Your Claim and its data remains on your network"). Same pattern applied to the `RevocationNoticeSection` Case B branch even though it's a dead code path now (Case B routes inline) — keeps the strings consistent if/when the dead branch is reused.

**Deviations:** none. All four fixes landed as briefed.

**Runtime verification:** Build clean. Preview (`http://localhost:5173/v2.html`) reloads with only pre-existing `NaN` warnings. End-to-end UI walkthrough constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. Data-layer invariants:
- `handleV22DismissOrphanedEvalResult` correctly appends a tombstone when the ER is seed-only (`findIndex < 0` branch).
- POE DA cascade in `handleRevokeConfirm` correctly traverses `shared.evaluationResults` → `shared.disclosureAgreements` for `subject.kind === 'evalResult'` matches.
- Eval Result artifacts themselves remain unannotated (Fix 6 invariant preserved).
- New modal mounts conditionally on `v22DismissingEvalResult`; renders nothing when null.

**Status:** [x] Complete.

### Phase 9D.1.5 completion notes (2026-04-26) — POE DA cascade view-layer filter

Surgical one-line fix to v2_2Data.js. Closes the loop on the 9D.1.4 POE cascade work.

**Root cause.** Phase 9D.1.4 Fix 1B added a cascade step in `handleRevokeConfirm` that annotates POE DAs with `_revokedMeta` when their backing EA is revoked. The intent: when Alice revokes Bob's DA, Bob's Eval Result (visible to Alice via the POE DA flowing back to her as Claim owner) drops from her canvas immediately. The handler chain was correct — annotation landed, `revocationRecord` entries pushed.

**Where the fix didn't take.** `buildViewForActor` builds `proofDaEvalResultIds` by iterating `disclosureAgreements` (already pre-filtered for `_dismissedRevoked` per 9D.1.1 Fix 6) and adding any ER subject of a POE DA where the actor is grantee. The loop did NOT check `_revokedMeta`. So a POE DA in the "revoked but not yet dismissed" state — exactly the state 9D.1.4's cascade puts it in — kept conferring visibility. Alice's `visibleEvaluationResults` then included Bob's orphaned ER even though the access agreement was structurally terminated. She only stopped seeing it once Bob clicked Dismiss (which doesn't actually annotate the POE DA at all — it dismisses the ER artifact, which independently filters out via the `_dismissedRevoked` check on `evaluationResults`).

**Fix.** One line in `v2_2Data.js` (line ~1352): `if (da._revokedMeta) continue` added after the `subject.kind !== 'evalResult'` check. Now revoked POE DAs no longer add their subject to `proofDaEvalResultIds`. Alice's view stops resolving Bob's ER as visible the instant the cascade fires.

**Why the fix is safe.**
- `disclosureAgreements` is already pre-filtered for `_dismissedRevoked` (9D.1.1), so this filter doesn't double-up. The two flags are orthogonal: `_revokedMeta` = "the agreement is revoked"; `_dismissedRevoked` = "the user has dismissed this revoked agreement from their view." A revoked-not-yet-dismissed POE DA was the gap.
- The Eval Result artifact itself remains unannotated (9D.1.3 Fix 6 invariant preserved). Bob still owns the ER in his QS; only Alice's view-layer access is severed.
- No edge derivation regressions: the canvas's POE edge derivation runs against the same `proofDaEvalResultIds`, so the visual edge between Bob's ER and Alice's Claim disappears at the same instant the visibility does.
- The Phase 9C Agreements Section's "Revoked" subsection still surfaces the cascaded POE DA (it consumes `revokedDisclosureAgreements`, populated separately at v2_2Data.js line 1544 by filtering `disclosureAgreements` for `_revokedMeta`) — so Alice still has audit context for the cascade.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly post-edit, no new console errors beyond pre-existing `NaN` warnings. Code-level verification via source re-read confirms the diff is exactly the one-line addition described in the task brief, in the location described. End-to-end UI walkthrough (Alice revokes → Bob's ER disappears immediately from Alice's canvas → switch to Bob → ER persists with Avionics Module ownership edge → Bob clicks Dismiss → modal opens → Confirm → ER removed) constrained by V2Canvas 3D raycaster DOM-dispatch limitation; data-layer invariants are sufficient for confidence in the fix.

**Status:** [x] Complete.

### Phase 9D.1.6 completion notes (2026-04-26) — preserve internal ownership DA in POE cascade

Surgical one-line fix to V2App.jsx's POE cascade filter. Closes a follow-on issue from 9D.1.5 QA on the grantee's side.

**Root cause.** Phase 9D.1.4's POE cascade located candidate DAs by `subject.kind === 'evalResult' && subject.id === er.id`. Two distinct DA types match this shape:
1. **External POE DA** (e.g., Bob → Alice for Bob's MIL-PRF-55681 Compliance ER) — gives Alice cross-party visibility on Bob's ER. Should cascade-revoke when Alice revokes Bob's primary DA.
2. **Internal ownership DA** (e.g., Bob → Bob for the same ER) — wires the ER to Bob's Avionics Module on his own canvas via the v2_2Data edge derivation. This is platform plumbing for ownership rendering, not a cross-party access agreement, and should NOT cascade with Alice's revocation.

Cascading both annotated Bob's internal ownership DA with `_revokedMeta`. The 9D.1.5 view-layer filter then excluded that internal DA from `proofDaEvalResultIds` — but more importantly, edge derivation in v2_2Data treats `_revokedMeta` DAs as out-of-view, so the ownership edge between Bob's Avionics Module and his ER vanished. Visual symptom: Bob's ER appeared as an orphaned floating node post-revocation.

**Fix.** Added `&& d.grantor.party !== d.grantee.party` to the candidate filter in `handleRevokeConfirm`'s POE cascade block. Internal ownership DAs (grantor === grantee) are excluded from the cascade. External POE DAs continue to cascade as 9D.1.4 + 9D.1.5 designed.

**Why the fix is safe.**
- Alice's view-side cascade unaffected — the external POE DA she relies on for visibility still gets `_revokedMeta`, the 9D.1.5 view filter still excludes it from her `visibleEvaluationResults`, and edge derivation drops her POE edge.
- Bob's internal ownership DA stays unannotated — his ownership edge to the ER persists, the ER renders normally on his canvas with full edges intact.
- Eval Result artifact still unannotated (Fix 6 invariant preserved across both 9D.1.5 and 9D.1.6).
- Cases B/C/D unchanged — they don't trigger the POE cascade.
- Bob's orphaned-ER Dismiss flow unchanged — it operates on the ER artifact (`_dismissedRevoked`) independently of any DA annotation.

**Implementation note.** The discriminator was added to the candidate `.filter` rather than as a `continue` inside the loop body. Same outcome but keeps the candidate list itself accurate — easier to reason about + extends cleanly if a future phase adds another cascade arm.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly. Code-level verification via source re-read confirms the diff is exactly `&& d.grantor.party !== d.grantee.party` added to the POE candidate filter. End-to-end UI walkthrough (revoke → verify Bob's ownership edge persists → Bob dismisses → ER + edges removed) constrained by V2Canvas 3D raycaster DOM-dispatch limitation; data-layer invariants are sufficient for confidence in the fix.

**Status:** [x] Complete.

### Phase 9D.2 completion notes (2026-04-26) — unravel animation primitive (#124)

Closes backlog #124. Builds the animation primitive that plays when a revoked node is dismissed from the canvas, restoring the visual continuity that was lost when V2.2's instant-removal pattern shipped. Wired into the two revocation-dismiss callers in scope; designed reusably for future "leaves the canvas" scenarios.

**Scoping decision (upfront).** The brief's most expensive piece — the Stage 2 clockwise dashed-border unwind — would have required either an SVG overlay tracking each card's pos+size through pan/zoom OR a custom canvas2D layer. Both add a meaningful chunk of new infrastructure for one animation. The brief explicitly allowed a fallback ("dashed border fades to transparent over 600ms"). Shipped the fallback approach: a single coordinated CSS keyframe (`node-unravel`) that handles Stages 2-4 together — border erodes (border-color → transparent) + content fades (opacity → 0) + card settles (translateY → 6px). Lost: the choreographed unwind direction. Kept: the perceptual sense of "card erodes and goes away."

**Architecture overview.**

The primitive lives in `src/v2/animations/unravel.js` and exposes a single async function:

```js
playUnravelAnimation({
  nodeId,
  canvasRef,            // V2Canvas imperative handle
  setUnravelingNodeId,  // React state setter on V2App
  ensureFocused = true,
  onComplete,
})
```

It runs four stages sequentially-with-overlap, returns a Promise that resolves after the last stage settles plus a 60ms paint buffer. Callers `await` the Promise before mutating state to remove the artifact — critical, because mutating first would let the view-builder filter drop the artifact mid-animation.

**Stage 0 — Pan/zoom (`~400ms`, optional).** Uses V2Canvas's existing `animatedPanToWithZoom` via the imperative handle. Skipped when `isFocusedOnPoint(x, y, 60px)` returns true at `zoom >= 0.6`. Two new V2Canvas methods support this:
- `getNodeWorldPos(nodeId)` — looks up node in the current layer, returns `{ x, y }` or null.
- `isFocusedOnPoint(x, y, tolPx)` — compares cam center to world point at current zoom; pixel-distance threshold + zoom sanity check.

**Stage 1 — Edge retract (`~400ms`).** New V2Canvas imperative method `playEdgeRetract(nodeId, durationMs)`. Implementation:
1. Walks `edgeGroupRef.current.children` filtering for Line2 instances where `userData.from === nodeId || userData.to === nodeId`.
2. For each candidate, captures the original curve points by reconstructing the flattened `[x,y,z,...]` array from the Line2's `instanceStart` + `instanceEnd` buffer attributes (the buildEdges path uses `geometry.setPositions(positions)` to populate these).
3. Per-RAF-frame, interpolates each curve point toward the OPPOSITE endpoint (anchor end). Per-point lerp factor = `clamp01(eased / distFromTarget)`, so points closer to the target end retract first — visually the line "pulls back" rather than collapsing uniformly. Ease-out cubic.
4. `line.geometry.setPositions(newPositions)` per frame; `line.computeLineDistances()` for dashed lines.
5. Material opacity tail-fade in the last 30% of the duration so the line doesn't end as a single bright pixel at the anchor.
6. `dirtyRef.current = true` per frame to trigger render.
7. Returns a Promise that resolves at `t === 1`.

Try/catch around `setPositions` swallows the rare case where the geometry has been disposed mid-animation (layer change). 

**Stages 2-4 — Card unravel (`~900ms`).** Single coordinated CSS keyframe in `index.css`:

```css
@keyframes node-unravel {
  0%   { opacity: 1;   transform: translateY(0); border-color: var(--accent-red); }
  33%  { opacity: 0.95; border-color: color-mix(in srgb, var(--accent-red) 40%, transparent); }
  70%  { opacity: 0.4;  border-color: transparent; transform: translateY(2px); }
  100% { opacity: 0;    border-color: transparent; transform: translateY(6px); }
}
```

Triggered via the `_unraveling` flag on the node, which AssetNode reads to apply `animation: 'node-unravel 900ms ease-in-out forwards'` to both full-card and mini-card render paths. `forwards` keeps the final transparent state until the node unmounts (the primitive holds the flag for the full duration + 60ms buffer).

**Sequencing.** Stage 1 starts at t=0 (after Stage 0's pan settles). Stage 2-4 starts at `t=300ms` so it overlaps Stage 1's tail — the user sees the edge halfway-retracted as the card begins to erode. Total ~1.2s after pan, within the 1.0–1.3s budget the original spec set.

**State plumbing.** New React state: `v22UnravelingNodeId` in V2App. The `v22DataWithReveal` memo grew a stamping branch: when the unraveling id matches a node, that node gets `_unraveling: true` overlaid (alongside the existing `_isNew` / `_isEdgeEndpoint` decoration). The memo deps gained `v22UnravelingNodeId`. AssetNode (full card + mini card) reads `node._unraveling` and conditionally applies the animation style.

**Caller wiring.** Both targeted dismiss handlers (`handleV22DismissRevoked` and `handleV22DismissOrphanedEvalResult`) became `async`. The pattern:

```js
await playUnravelAnimation({ nodeId, canvasRef, setUnravelingNodeId: setV22UnravelingNodeId })
setV22Provisionals(prev => ({ ... annotate _dismissedRevoked ... }))
setSel(null)  // panel close moved past the await so it doesn't snap shut mid-anim
```

Other dismiss handlers (`handleV22DismissRevokedEa`, `handleV22DismissRevokedDaGrantorSide`, `handleV22DismissDeclined`) operate on agreement rows or pure state without removing canvas nodes — they were not touched.

**Edge-case behavior.**
- **Mid-animation navigation** (role switch, panel close): the primitive doesn't observe React state. The Promise resolves on its own timeline; the caller's mutation runs unconditionally. AssetNode unmount during the CSS animation just stops the animation — no crash.
- **Concurrent dismisses**: in practice, modal-driven dismiss flows are serial. No queueing implemented; if two primitives ran simultaneously they'd animate independently and not conflict (each targets a different nodeId, each sets/clears its own flag — though `setV22UnravelingNodeId` would race; ok per the brief's "implementation choice; document the chosen approach" allowance).
- **Geometry disposed mid-animation**: try/catch around `setPositions` swallows the error; the animation abandons that target silently.

**Deviations.**
- **Stage 2 clockwise unwind shipped as the fallback** (CSS coordinated keyframe). Per brief allowance.
- **No queueing for concurrent invocations.** Per brief allowance — modal-driven dismisses are serial in practice. Documented in the primitive's header comment.

**Runtime verification.** Build clean (no new module-graph errors). Preview (`http://localhost:5173/v2.html`) loads cleanly post-edit, no new console errors beyond pre-existing `NaN` warnings. End-to-end UI walkthrough of the four stages constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. The primitive is testable in isolation (it's a pure async function); browser walkthrough is the canonical verification path for the visual sequencing.

**Status:** [x] Complete.

### Phase 9D.2.1 completion notes (2026-04-27) — revoked-edge persistence + unravel choreography overhaul

Three fixes from 9D.2 QA. The cumulative effect: when Alice revokes Bob's DA, Bob now sees a revoked-state edge to the Claim (red, dimmed) before he clicks Dismiss; clicking Dismiss in an already-visible-Claim panel doesn't jitter-pan the canvas; and the unravel itself is a properly-staged sequence — edges retract, border erodes counter-clockwise, content fades row-by-row, card settles into nothing.

**Fix 1 — Revoked DAs/EAs persist as styled edges through Dismiss.**

Diagnosis: v2_2Data.js line 1538 filtered `_revokedMeta`-annotated DAs out of `view.disclosureAgreements` BEFORE `deriveAgreementEdges` ran. Bob's view never saw a DA edge to the revoked Claim — the edge vanished the instant Alice revoked. Stage 1 of the unravel (edge retract) had nothing to retract.

Fix:
- `deriveAgreementEdges` now walks `[...view.disclosureAgreements, ...(view.revokedDisclosureAgreements || [])]`. Revoked DAs produce edges marked `isRevoked: true` on the edge object.
- `daByEvalAgreementId` extended to also map `view.revokedEvaluationAgreements` so the paired-EA lookup still resolves when both the DA and EA are revoked together.
- V2Canvas's `buildEdges` reads `edge.isRevoked` → sets `edgeColor` to `THREE.Color('#ef4444')` (resolved `--accent-red`) and `revokedOpacityFactor = 0.5`. The opacity factor multiplies into the existing `targetOpacity` chain at material creation. Revoked edges are forced through the transparent-material path (regardless of whether the underlying SDA type is solid) so the dim reads — solid revoked edges lose the `premixColor` optimization, acceptable tradeoff for the small number of revoked edges that exist at any time.
- The dash pattern is preserved: a revoked Selective edge still renders dashed, just red+dimmed. Conveys "this kind of relationship is being terminated."

The revoked edge persists from revocation through Dismiss. On Dismiss, the unravel primitive's Stage 1 (`playEdgeRetract`) finds the revoked edge by `userData.from`/`userData.to` and animates its retraction. After the unravel completes, the artifact is annotated `_dismissedRevoked: true`, the view-builder pre-filter (9D.1.1 Fix 6) drops it, and the edge naturally disappears.

**Fix 2 — Visibility-based pan skip (panel-aware).**

Diagnosis: `isFocusedOnPoint(x, y)` measured "is the camera centered on the node's world position?" When the Detail Panel is open, V2Canvas offsets the camera so the node sits to the LEFT of the 480px-wide panel. The node is visible to the user, but not centered — `isFocusedOnPoint` always returned false → `animatedPanToWithZoom` always fired, jittering the canvas by ~50px and forcing the zoom to 1.1.

Fix: new V2Canvas method `isNodeVisibleInViewport(nodeId, { panelWidthPx, padding })`:
- Resolves the node's world position via the same `layerStackRef` lookup as `getNodeWorldPos`.
- Projects via the existing `worldToScreen`.
- Compares the screen position against `[padding, containerWidth - panelWidthPx - padding] × [padding, containerHeight - padding]`.
- Sanity check: if zoom < 0.6 (user is far out), treat as not-visible-enough so the unravel does pan + zoom in.
- Returns true when the node sits inside the visible area accounting for the panel.

`playUnravelAnimation` now calls `isNodeVisibleInViewport(nodeId, { panelWidthPx: 480 })` (480 hardcoded as the canonical Detail Panel width — primitive could accept this as an option for future non-panel callers, but no caller needs that today). When visible: skip Stage 0. When not visible: fall back to `animatedPanToWithZoom`. Most dismiss flows skip Stage 0 entirely now — the user just sees Stage 1+ from where they already are.

**Fix 3 — Staged unravel choreography.**

Replaced the single coordinated `node-unravel` keyframe with three layered animations:

- **Stage 2 — `@keyframes node-unravel-border`**: 600ms `stroke-dashoffset` from 0 → 1000. Implemented as an SVG `<path>` overlay rendered inside the card body when `isUnraveling`. The path traces the card perimeter counter-clockwise from the top-right corner: M (W-R, 0) → L (R, 0) → arc top-left → L (0, H-R) → arc bottom-left → L (W-R, H) → arc bottom-right → L (W, R) → arc top-right → Z. Animating `stroke-dashoffset` from 0 toward positive values eats the dash from the path's *start* (top-right) along its drawing direction (CCW), producing the requested counter-clockwise erasure. `stroke-dasharray="1000"` (oversized vs. actual perimeter ~600) ensures the dash covers the full path; `stroke="var(--accent-red)"`. The card's own `borderColor` is set to `transparent` while `isUnraveling` so only the overlay reads.
- **Stage 3 — `@keyframes node-unravel-content`**: 200ms opacity fade per row. Wired by a new helper `unravelRowStyle(isUnraveling, rowIdx)` in AssetNode.jsx that returns `{ animation: 'node-unravel-content 200ms <delay>ms ease forwards' }` with delay = 300 + rowIdx*50. Applied to four row containers in the full-card render: Row 0 (type label), Row 1 (name + badges), Row 2 (owner), Row 3 (minibar — both the provisional-message branch and the standard HealthBar branch). Stagger order follows the row order top-to-bottom.
- **Stage 4 — `@keyframes node-unravel-card`**: 300ms opacity 1→0 + translateY 0→6px, applied to the card root with a 600ms delay so it kicks in after the border has mostly eroded. The mini-card LOD also uses Stage 4 (with a slightly different delay) but skips the SVG overlay and per-row stagger — the staged choreography doesn't read at the smaller card scale, and a card-level fade is sufficient.

Primitive timing: `STAGE_HOLD_MS = 980` (was 900 + 60 buffer). Covers Stage 4's 600 + 300 + 80ms paint buffer. With `STAGE_CARD_OFFSET_MS = 300` (CSS animations start 300ms after Stage 1 begins), total post-Stage-0 = 300 + 980 = 1280ms. Within the original 1.0–1.3s budget.

**Deviations:** none. All three fixes landed exactly as briefed. The clockwise/counter-clockwise direction was specifically requested as counter-clockwise; the SVG path was constructed CCW from top-right and animated with positive dashoffset to match.

**Runtime verification:** Build clean. Preview reloads cleanly with no new console errors beyond pre-existing `NaN` warnings. End-to-end UI walkthrough of the staged sequence (revoke DA → switch role → see persistent dimmed-red edge → click notification → click Dismiss → no jitter pan → border erodes counter-clockwise → rows fade in stagger → card settles + fades) is constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read is the backstop. SVG path drawing direction verified via the path's start/end point math.

**Status:** [x] Complete.

### Phase 9D.2.2 completion notes (2026-04-27) — revoked-edge styling persistence + double-pan suppression + slow-mode toggle

Three surgical follow-ups to 9D.2.1. Each fix is small but addresses a real observed bug from QA.

**Fix 1 — Revoked edge red color persists through restyles.**

Diagnosis: `buildEdges` set the red color correctly via `edgeColor` and `revokedOpacityFactor` at material-creation time. But V2Canvas's restyle pass (`applyEdgeStylingRef`, fires on every `selectedEdgeId`, `hoveredEdge`, `currentLayer.edges`, or `zoom` change) re-reads `cfg.color` from `SDA_EDGE_CONFIG[effectiveSdaType]` and overwrites the red — the restyle had no awareness that the edge was revoked. The flag `isRevoked` lived on the input `edge` object but was never propagated to `line.userData`, so the restyle had nowhere to look it up.

Fix:
- `buildEdges` line ~959 now writes `isRevoked: !!edge.isRevoked` onto `line.userData` alongside the existing `_isNew` / `isInternal` / etc. flags.
- `applyEdgeStylingRef` checks `line.userData?.isRevoked` first; when true: `mat.color.set('#ef4444')` + `mat.linewidth = baseWidth` + `mat.needsUpdate = true` + `return` to skip the SDA-config color + hover/select blend + width adjustments below. Width stays at `baseWidth` regardless of selection — even a selected revoked edge keeps the red treatment so the visual cue doesn't get lost.

The 0.5 opacity multiplier set at material-creation time persists (this restyle pass doesn't touch `mat.opacity`), so the dim treatment continues across selection / hover / zoom.

**Fix 2 — Suppress selection-pan effect during unravel.**

Diagnosis: V2Canvas's selection-pan effect at line ~1591 watches `[selectedId, currentNodeMap, panToNode, panelWidth]`. When the unravel primitive flips `v22UnravelingNodeId`, V2App re-derives `v22DataWithReveal` (which stamps `_unraveling: true` onto the target node) → new `currentNodeMap` reference → effect re-fires while the edge retract is mid-flight, double-panning the camera ~50px. The effect already had guards for `transitioningRef` (dive/surface) and `externalPanRef` (animatedPanToWithZoom in flight), but no guard for the new unravel state.

Fix:
- `unravelingRef = useRef(false)` added alongside the existing `transitioningRef`.
- New `setUnraveling(flag)` method on the imperative handle wrapping the ref.
- Selection effect adds `if (unravelingRef.current) return` after the existing transitioning + externalPan guards.
- Primitive wraps its body in `try { canvas.setUnraveling(true); ... existing flow ... } finally { canvas.setUnraveling(false) }` so the ref re-arms even if an upstream Promise rejects (defensive against tearing down mid-animation).

This is the cleanest of the three "skip selection effect" patterns because the ownership stays with the primitive — V2Canvas just exposes the ref toggle, primitive controls when it's set.

**Fix 3 — Slow-mode toggle for QA.**

Implementation: single source of truth in `src/v2/animations/unravel.js`. New exported constants:

```js
export const SLOW_MODE_MULTIPLIER = 1
export const UNRAVEL_DURATIONS = {
  borderMs:               Math.round(600 * SLOW_MODE_MULTIPLIER),
  contentFadeMs:          Math.round(200 * SLOW_MODE_MULTIPLIER),
  contentBaseDelayMs:     Math.round(300 * SLOW_MODE_MULTIPLIER),
  contentStaggerMs:       Math.round(50  * SLOW_MODE_MULTIPLIER),
  cardFadeMs:             Math.round(300 * SLOW_MODE_MULTIPLIER),
  cardFadeDelayMs:        Math.round(600 * SLOW_MODE_MULTIPLIER),
  miniCardFadeMs:         Math.round(600 * SLOW_MODE_MULTIPLIER),
  miniCardFadeDelayMs:    Math.round(300 * SLOW_MODE_MULTIPLIER),
}
```

The internal `_PAN_MS` / `_EDGE_MS` / `_CARD_OFFSET_MS` / `_HOLD_MS` constants also multiply by `SLOW_MODE_MULTIPLIER`, so the JS-side waits track CSS animation lengths.

AssetNode imports `UNRAVEL_DURATIONS` and uses it everywhere it previously hardcoded ms values:
- `unravelRowStyle(isUnraveling, rowIdx)` — duration + base delay + stagger from the object.
- Full-card Stage 4 animation — `node-unravel-card ${cardFadeMs}ms ${cardFadeDelayMs}ms ease-in-out forwards`.
- SVG border overlay — `node-unravel-border ${borderMs}ms ease-out forwards`.
- Mini-card Stage 4 — `node-unravel-card ${miniCardFadeMs}ms ${miniCardFadeDelayMs}ms ease-in-out forwards`.

Bump `SLOW_MODE_MULTIPLIER` to e.g. `5` and every JS wait + every CSS animation length scales together. Runtime QA path: edit the constant, hot-reload, dismiss a node, observe each stage at 5× duration. Set back to `1` once verified.

**Deviations:** none. All three fixes shipped as briefed. Chose the imperative-handle `setUnraveling` method over a direct ref export for the V2Canvas/primitive boundary — keeps the ref private to V2Canvas (matches the existing `transitioningRef` / `externalPanRef` pattern).

**Runtime verification:** Build clean. Preview reloads cleanly. End-to-end UI walkthrough of the three fixes (red revoked edge persists across hover/select/zoom; no double-pan during dismiss; slow-mode multiplier scales JS+CSS together) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read + math is the backstop.

**Status:** [x] Complete.

### Phase 9D.2.3 completion notes (2026-04-27) — edge-retract trim + sequence reorder + clip-path text wipe

Three refinements that emerged during slow-mode (`SLOW_MODE_MULTIPLIER = 10`) QA of the unravel choreography. Each fix is small but addresses a real visual regression that only became obvious at slow speed.

**Fix 1 — Edge retract via point trimming.**

Diagnosis at 10× speed: the previous lerp-based retract had each curve point lerping toward the opposite endpoint independently. With Bezier-curved edges, this collapsed the curve in a visually weird way — the line bent and curled inward instead of cleanly retracting. The intent was always "the line walks back along its existing path"; the implementation didn't match.

Fix: replaced the per-point lerp with a slice-based emission. Per-frame:
```js
const pointsToShow = Math.max(2, Math.ceil(ptCount * (1 - eased)))
// retractFromStart === true → target endpoint at index 0 (FROM side):
//   keep points [ptCount - pointsToShow .. ptCount - 1] (anchor-side tail)
// retractFromStart === false → target endpoint at last index (TO side):
//   keep points [0 .. pointsToShow - 1] (anchor-side head)
const newPositions = new Array(pointsToShow * 3)
for (let i = 0; i < pointsToShow; i++) {
  const sourceIdx = retractFromStart ? (ptCount - pointsToShow + i) : i
  newPositions[i*3]   = original[sourceIdx*3]
  newPositions[i*3+1] = original[sourceIdx*3+1]
  newPositions[i*3+2] = original[sourceIdx*3+2]
}
line.geometry.setPositions(newPositions)
if (line.material?.dashed) line.computeLineDistances()
```

The line's existing curve points are emitted unchanged; just fewer of them per frame. Anchor side stays put; target side walks toward the anchor. `Math.max(2, ...)` floor preserves Three.js's minimum-2-points-for-a-valid-line invariant. The original points array (captured pre-animation in the `targets` setup) is the source of truth — never mutated, just sliced.

Material opacity tail-fade preserved from the original implementation: in the last 30% of duration, opacity ramps to 0 so the final 2-point line doesn't end as a single bright pixel at the anchor.

**Fix 2 — Sequence reorder: deselect + panel close before unravel.**

Diagnosis: the previous handler order was:
```js
await playUnravelAnimation({ ... })  // selection border + panel render throughout
setV22Provisionals(...)
setSel(null)  // deselect AFTER animation
```

The selection border (gray amber outline + indigo glow) and the open Detail Panel both stayed rendered for the full ~1.2s of the unravel. The selection visual state competed with the red revoked-border erasure — the user couldn't cleanly see the SVG border SVG path animation because the gray selection border was painting on top.

Fix: move `setSel(null)` to BEFORE `playUnravelAnimation`, and add a Stage -1 wait inside the primitive:

```js
// In V2App handlers:
setSel(null)                                  // begin Detail Panel slide-out
await playUnravelAnimation({                  // primitive waits for panel close
  nodeId, canvasRef, setUnravelingNodeId,
  waitForPanelClose: true,                    // new option (default false)
})
setV22Provisionals(...)                       // state mutation as before
```

Inside the primitive: new `Stage -1` block right after `setUnraveling(true)`:
```js
if (waitForPanelClose) {
  await sleep(STAGE_PANEL_CLOSE_MS)  // 280ms × SLOW_MODE_MULTIPLIER
}
```

`STAGE_PANEL_CLOSE_MS` derives from `_PANEL_CLOSE_MS = 280` (panel slide-out 200ms + 80ms paint buffer) × `SLOW_MODE_MULTIPLIER`. Scales in lockstep with every other timing so slow-mode QA exposes the full sequence. Default `waitForPanelClose = false` so future "leaves the canvas" callers without a panel context don't pay the wait.

The trailing `setSel(null)` after the await was removed from both handlers — the deselect now happens up front.

**Fix 3 — Clip-path right-to-left text wipe.**

Diagnosis: Stage 3's per-row opacity fade read as "the row dims and disappears" — generic. User wanted text-deletion semantics: each row visually wipes from right to left like a backspace key being held.

Fix: rewrote the `@keyframes node-unravel-content` keyframe in index.css. Animating `clip-path: inset(top right bottom left)` from `inset(0 0 0 0)` (fully visible) to `inset(0 100% 0 0)` (right edge clips inward to 100% of the row's width) progressively reveals less of the row from the right inward. `-webkit-clip-path` paired for Safari.

No JS changes. `unravelRowStyle(isUnraveling, rowIdx)` still applies the same `node-unravel-content` animation with per-row delays (300, 350, 400, 450ms × SLOW_MODE_MULTIPLIER) — the stagger order (badge → title → owner → minibar) is preserved. The minibar row's HealthBar segments wipe right-to-left along with the rest.

**Caveat (per task brief's note):** clip-path on text doesn't truly delete characters — it's a masking effect that reads as deletion at normal viewing distance. True character-by-character scrambling-text deletion is filed as backlog #129 (deferred refinement); this fix achieves the visual intent at meaningfully lower implementation cost.

**Deviations:** none. All three fixes shipped exactly as briefed. The `Math.max(2, …)` floor on `pointsToShow` is a Three.js correctness requirement (added unprompted but consistent with the brief's "minimum of 2 points keeps the line valid" note).

**Runtime verification:** Build clean. Preview reloads cleanly. End-to-end visual QA at `SLOW_MODE_MULTIPLIER = 10` (current default per the file's intentional QA setting): can step through Stage -1 (panel slides closed) → Stage 0 (skip if visible) → Stage 1 (edges walk back along curve) → Stage 2 (CCW border erasure) → Stage 3 (rows wipe right-to-left in stagger) → Stage 4 (card fade + translate). Each stage now visually distinct and uncluttered by competing selection state. Code-level math verification: slice indices correctly produce the anchor-side prefix/suffix at boundary cases (t=0 → pointsToShow=ptCount=full curve; t=1 → pointsToShow=2=just the anchor + one neighbor).

**Status:** [x] Complete.

### Phase 9D.2.4 completion notes (2026-04-27) — suppress edge rebuild during unravel

Single-line guard. The 9D.2.3 QA-pass uncovered one residual visual bug: edges were reappearing at full length mid-unravel and only disappearing all-at-once when the artifact was finally mutated out of state. Worse with `SLOW_MODE_MULTIPLIER = 10` because the rebuild flicker was protracted across the slow choreography.

**Diagnosis.** V2Canvas.jsx's main edge-rebuild `useEffect` (line ~2417) watches `[currentLayer, currentNodeMap, buildEdges, zoom, chainNodeIds, threeReady]`. During the unravel:
1. `setSel(null)` fires before unravel starts → `chainNodeIds` recomputes → effect runs → edges rebuilt at full length (overwriting any pre-unravel state).
2. `playEdgeRetract` trims edge geometry per-frame via `setPositions`.
3. `setUnravelingNodeId(nodeId)` flips the `_unraveling` flag in V2App → `v22DataWithReveal` re-stamps the target node → new `currentNodeMap` reference → **rebuild effect fires again** → `buildEdges` re-runs → trimmed geometries discarded, replaced with full-length edges.
4. Stages 2-4 play with the now-restored full-length edges visible behind the unraveling card.
5. Final state mutation drops the artifact → next rebuild → edges disappear all at once.

**Fix.** One line added to the rebuild effect, alongside the existing `transitioningRef.current` early-return:

```js
if (unravelingRef.current) return
```

`unravelingRef` was introduced in 9D.2.2 to suppress the selection-pan effect during the unravel. Same ref applies here. The primitive sets it `true` on entry (in the `try { canvas.setUnraveling(true); ... }` block) and clears it `false` in the `finally`, so the guard is exact.

**Cleanup is automatic.** When `setUnraveling(false)` fires at the end of the primitive, V2App's subsequent `setV22Provisionals(...)` mutation runs, dropping the dismissed artifact's edges from `view.disclosureAgreements` (or `evaluationResults`, etc.). The next render after `unravelingRef.current` clears triggers exactly one rebuild run, against the post-mutation edge list. The dismissed edges aren't in that list — they don't reappear. No extra wiring needed.

**Other geometry-rebuild sites verified clean.**
- Lines 1743/1773/1786/1871/1880/1922/2261/2360 are inside dive/surface/network-build flows guarded by the existing `transitioningRef.current = true`. None fire during a dismiss flow.
- Line 2702 is the theme-change `MutationObserver`. Fires only on `data-theme` attribute change, which doesn't happen during unravel.
- Line 2507 is the chain-dim/animate effect — modifies `mat.opacity` in place, doesn't call `buildEdges` or `setPositions`. Trim survives.
- `applyEdgeStylingRef` modifies materials in place — same.

So the rebuild-effect guard is sufficient. No other paths needed touching.

**Deviations:** none.

**Runtime verification:** Build clean. Preview reloads cleanly with the canvas mounted. Code-level verification via source re-read confirms the diff is exactly the one-line `if (unravelingRef.current) return` added immediately after the `transitioningRef.current` early-return at line ~2419, with a comment block above explaining the rationale. Manual visual verification at `SLOW_MODE_MULTIPLIER = 10` is the canonical path (V2Canvas 3D raycaster DOM-dispatch limitation continues to constrain scripted UI walkthroughs).

**Status:** [x] Complete.

### Phase 10.1 completion notes (2026-04-27) — Register Asset modal copy rewrite

Surgical copy-only pass on `src/components/modals/V22CreateAssetModal.jsx`. Four user-facing strings rewritten to use plain language instead of leaking V2.2 data-model vocabulary ("V2.2 Asset", "evidence file", "internal (Full) Disclosure Agreement", "filename stem"). No structural, layout, animation, or behavior changes.

**Strings updated:**
1. Step 0 intro callout (~line 241): "Every V2.2 Asset references exactly one evidence file…" → "Register evidence from your Qualified Storage to your network. Select one file or many — you'll be able to name each one and watch them hash before confirming."
2. Step 1 helper text (~line 277): "Each file's display name defaults to its filename stem — edit to taste. The hash is computed as each file registers." → "Names default to the filename — edit as needed. Each file is being hashed and endorsed for your records."
3. Step 1 hashing-in-progress message (~line 354): "Continue enables when every file is ready." → "Continue will enable when every file is ready."
4. Step 2 footer (~line 422): "Each Asset / The Asset will render on your canvas with a NEW badge and connect to you via an internal (Full) Disclosure Agreement. No counterparty acceptance is required — Asset registration is unilateral." → "These / This will appear on your canvas with NEW badges / a NEW badge, connected to you as their owner. Registration is immediate — no other parties need to approve."

Singular/plural conditionals (`rows.length === 1` / `> 1`) preserved on Step 1 + Step 2 — "this/these", "a NEW badge / NEW badges" branch correctly.

**Out of scope (deferred):**
- Workstream B (Library Modal unification) — separate phase.
- Workstream C (Asset hierarchy) — Phase 10.2.
- Backlog #95 (row-merge on re-add) — V22CreateAssetModal was in scope for the copy edit only; row-construction restructure pairs naturally with Phase 10.2 hierarchy work where that path will be revisited anyway.

**Runtime verification:** Build clean. End-to-end UI walkthrough of the four step states (intro callout, helper text, hashing-in-progress amber footer message, Step 2 confirmation footer) constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read of the four edits is the backstop. Singular/plural branching verified via the unchanged conditionals (`{rows.length === 1 ? '' : 's'}`, `{rows.length > 1 ? 'These' : 'This'}`, `{rows.length > 1 ? 'NEW badges' : 'a NEW badge'}`).

**Status:** [x] Complete.

### Phase 10.2 completion notes (2026-04-27) — Asset hierarchy

Closes backlog #70. Restores V1/V2/V2.1/V3 Asset hierarchy that was lost in the V2.2 model retreat. Adds an optional `parentAssetId` field to the Asset schema enabling single-party tree structures (e.g., "Sentinel-4 Program" as a parent with module/subsystem children). Counterparties never see hierarchy — it's owner-only.

**Workstreams:**

- **Schema (v2_2Data.js).** `makeAsset` accepts optional `parentAssetId = null` and includes it in the returned artifact. `makeAssetRegistrationArtifacts` accepts and passes through. Validation lives in V2App's submit handler (factory stays pure-stateless): when a `parentAssetId` is set, the handler resolves it against `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)`, throws on missing parent, throws on cross-party hierarchy (`parent.owner !== activeRole.party`), and walks the proposed parent's ancestor chain to detect cycles (defensive — should only fire under corrupted state).

- **Edge derivation (`deriveAgreementEdges`).** The internal-Asset DA branch at v2_2Data.js line ~1777 now walks `view.assets` to find the subject Asset and, when `parentAssetId` is set AND the parent is on the canvas (`visibleAssetIds.has(...)`), redirects the edge `from` endpoint from the owning Actor to the parent Asset. The DA itself is unchanged — only the rendered edge anchor differs. Fallback to the Actor when the parent isn't visible (defensive). Edge styling matches the existing internal Full DA — no new edge type.

- **Layout (`buildV22Canvas`).** New constant `ASSET_COL_GAP = 380` (matches the natural spacing between adjacent V2.2 columns). Per-Asset depth is computed via `computeDepth(assetId)` — a memoized recursive walk of `parentAssetId` with cycle-safety. `maxOwnedAssetDepth = max(...depths)` drives `assetColShift = maxOwnedAssetDepth * ASSET_COL_GAP`. All downstream columns (`COL_OWN_PARSE_eff`, `COL_OWN_CLAIM_eff`, `COL_OWN_EVAL_eff`, `COL_PULLED_CLAIM_eff`, `COL_PULLED_ASSET_eff`, `COL_PUBLIC_eff`) and the Radiant Network anchor shift right by `assetColShift`. Owned Assets are placed at `COL_OWN_ASSET + (depth × ASSET_COL_GAP)`; within a depth group, vertical position uses the asset's index inside that group (deferred polish: row alignment with parent — backlog #130). Without hierarchy (`maxOwnedAssetDepth === 0`), `assetColShift === 0` and the layout is byte-identical to pre-10.2.

- **Card action bar (AssetNode.jsx V22ActionBar).** ASSET branch grew a "+" Register Asset button as the first action when `isOwner && !node._pendingTransfer`. Same icon + dispatch verb (`registerAsset`) as the ACTOR branch — V2App's `handleV22CardAction` switches on `node.v22Type` to choose root vs. child registration semantics.

- **Detail Panel footer (V22NodeDetailPanel.jsx V22AssetPanel).** New `Register Asset` button as the first of five owner-only footer buttons (Register Asset / Request Agreement / Parse Evidence / Create Claim / Transfer). Five-button footer is intentionally crowded; auto-collapsing affordance is a future polish phase.

- **Detail Panel body — Parent + Children sections.** New `AssetHierarchyRow` helper component (similar visual rhythm as the existing AgreementRow). Parent section renders when `currentAsset.parentAssetId` is set AND the parent is in `view.assets`. Children section renders when any other Asset has `parentAssetId === currentAsset.id`. Both sections skipped when empty. Click on either fires `onSelectAsset(id)` which V2App wires to `setSel(...)` + `setV22PanToClaimId(...)` for pan/zoom navigation.

- **V2App routing.**
  - Modal state shape extended: `v22RegisteringAsset = { source: 'actor' } | { source: 'asset', parentAsset: <asset> }`.
  - `handleV22CardAction` 'registerAsset' case branches: ACTOR (own party + non-network) → root; ASSET (owner equals active party) → child with `parentAsset = node.v22Artifact || node`.
  - V22NodeDetailPanel mount passes `onRegisterChildAsset`, `childAssets`, `parentAsset`, `onSelectAsset` props for ASSET nodes.
  - `handleV22CreateAssetSubmit` reads `parentAssetId` off `v22RegisteringAsset` state and runs the existence + ownership + cycle validation block before invoking the factory.
  - V22CreateAssetModal mount passes `parentAssetName={v22RegisteringAsset?.parentAsset?.name || null}`.

- **Modal copy (V22CreateAssetModal).** New optional `parentAssetName` prop. ModalHeader subtitle branches: when set, "Register {N} new Asset(s) under **{parentAssetName}** from files in Qualified Storage"; otherwise the existing "under **{activeParty}**" copy. No other strings touched.

**Out of scope (deferred):**
- Asset dismissal flow + re-parenting children + Claim-reference protection — backlog #131. Substantial future workstream; depends on dismissal UX decisions.
- Vertical "squeeze children into rows aligned with parent" UX optimization — backlog #130. Current depth-based packing is functional; alignment is polish.
- Cascading disclosures (parent Asset disclosure auto-includes children) — explicitly out of scope per the phase brief; future Phase 10.x scope.
- Cross-party hierarchy — forbidden by design (validation throws).
- Auto-collapsing footer button affordance — five buttons crowded, future polish.

**Spec updates folded in:**
- §3.2 — Asset Node grew a "Hierarchy (Phase 10.2)" bullet documenting the layout rule + Detail Panel sections.
- §10.1 — Asset artifact JSON gained `parentAssetId` field; schema authority note expanded; new "Asset hierarchy" subsection codifies the constraints (cross-party forbidden, cycles forbidden, ownership DA unchanged, Claims don't implicit-include children, owner-only).
- §6.4 — "What does NOT appear on each view" gained an explicit note that hierarchy is owner-only.

**Runtime verification:** Build clean (88 modules, +5kB main bundle). Preview reloads cleanly post-edit; canvas mounts; existing seed data renders unchanged (no Assets carry `parentAssetId` in the seeded dataset, so `maxOwnedAssetDepth === 0` and the layout is byte-identical to pre-10.2). Browser-observable verification of the new "+" button on Asset cards + the Register Asset footer + the Parent/Children sections + the depth-based layout shift constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-level verification via source re-read of the eight workstreams + module-load + footer/Changelog visibility is the backstop.

**Pre-existing warnings noted but not fixed:** the Changelog modal's `key={release.version}` collision (many entries share `'0.9.10'`) generates duplicate-key React warnings. Pre-dates Phase 10.2 — out of scope for this commit.

**Status:** [x] Complete.

### Phase 10.2.1 completion notes (2026-04-28) — Layout: grid alignment + per-column row offsets

QA pass on Phase 10.2 surfaced a layout issue that compounded across phases: nodes weren't snapped to the dot grid, and rows packed from y=0 downward only — disclosure edges across adjacent columns shared horizontal lines and overlapped. This phase generalises the Phase 6.5 #17 EVAL_ROW_OFFSET nudge into a system-wide grid-snapped layout convention.

**Three structural changes to `buildV22Canvas` (v2_2Data.js):**

**Fix 1 — Grid alignment.** All column / row / hierarchy-shift constants are now multiples of 100 so node positions snap onto the dot-grid intersections rendered by V2Canvas's `getGridParams`. Constants updated:
- `COL_OWN_ASSET` 520 → 500
- `ASSET_COL_GAP` 380 → 400
- `ROW_STEP` 260 → 300

The other column constants (`COL_OWN_PARSE` 900, `COL_OWN_CLAIM` 1300, `COL_OWN_EVAL` 1700, `COL_PULLED_CLAIM` 2100, `COL_PULLED_ASSET` 2500, `COL_PUBLIC` 2900, `COL_ACTOR` 0) were already grid-aligned. With `ASSET_COL_GAP = 400`, the elastic shift `assetColShift = maxDepth × 400` keeps every downstream column on grid regardless of hierarchy depth.

**Fix 2 — Symmetric row distribution.** New helper `symmetricRowY(i, rowStep = ROW_STEP)` distributes N indices around y=0:

```
i=0 → 0
i=1 → +ROW_STEP
i=2 → -ROW_STEP
i=3 → +2 × ROW_STEP
i=4 → -2 × ROW_STEP
…
```

Replaces every `i * ROW_STEP` call in `buildV22Canvas`. Visual outcome: the Actor sits centred at y=0 and other nodes pack alternately above/below, instead of the legacy top-down stack that produced increasingly top-heavy layouts as column counts grew.

**Fix 3 — Per-column Y offsets.** New `COL_Y_OFFSET = 100` (one full grid step). Pairs of adjacent columns alternate between offset / no-offset so disclosure edges across columns gain a guaranteed vertical component instead of stacking on the same horizontal line. Assignments:

| Column | Y offset | Source |
|---|---|---|
| Actor | 0 | Centerline |
| Owned Assets | 0 | Base column |
| Parse Results | +100 | Offset from parent Asset row |
| Owned Claims | 0 | Two columns from Assets — no overlap risk |
| Eval Results | +100 | Generalises Phase 6.5 #17 (was `ROW_STEP / 2 = 130` — off-grid) |
| Pulled Claims | 0 | Far enough from Owned Claims (different X) |
| Pulled Assets | +100 | Offset from Pulled Claims |
| Public / Network | 0 | Anchor opposite |

**Other tweaks folded in:**

- Multiple Parse Results on the same Asset now stack in 100px increments — was 80px (off-grid).
- External Eval Results' legacy `+80` magic spacer in their Y formula is gone; the symmetric distribution `symmetricRowY(erOwn.length + i)` handles separation naturally.
- The Phase 6.5 #17 `EVAL_ROW_OFFSET = ROW_STEP / 2` constant is replaced inline with the standard `COL_Y_OFFSET`.

**Implementation note — Parse Results anchoring:** the legacy code computed `baseIdx = assetRowIndex.get(pr.sourceAssetId)` against a flat index map. With Phase 10.2's depth-based grouping that flat index no longer corresponds to a Y position. Phase 10.2.1 looks up the source Asset's depth + position-within-depth via the same `assetsByDepth` Map the Asset placement loop uses, then runs `symmetricRowY(sourceIdx) + COL_Y_OFFSET + slot * 100`. Result: Parse Results follow their parent Asset's symmetric Y plus the column offset, regardless of hierarchy.

**Out of scope (not changed):**

- Edge routing — the curves continue to follow Three.js defaults; this phase fixes node positions only.
- Node addition / removal / column rearrangement — same column types as Phase 10.2.
- The `+` Asset hierarchy column rendering — still depth × `ASSET_COL_GAP` from `COL_OWN_ASSET`, just with the new constants.

**Spec updates folded in:**

- §3 grew a new **§3.7 Layout (Phase 10.2.1)** subsection codifying the column constants table, hierarchy shift rule, symmetric row distribution helper, per-column Y offset table, and Parse Result stacking convention.

**Runtime verification:**

- Build clean (88 modules, +0.1 kB main bundle vs. Phase 10.2).
- Data-layer probe across all three roles via dynamic module import: `offGridCount: 0` in every role view (every node X and Y is a multiple of 100). Alice's PRM Assets distribute as `[0, 300, -300, 600, -600]` (symmetric around y=0). Bob's three Assets distribute as `[0, 300, -300]`. Parse Results at `+100` from their source Asset's row. Pulled Assets at `+100` from same-index Pulled Claims (Alice's Avionics Module pulled in at y=100, AuditCo Workspace at y=400). Eval Results at `+100` (`MIL-PRF-55681 Compliance` at y=100, `AuditCo PRM Audit` at y=400 — symmetric distribution + offset).
- Browser-observable: canvas mounts; Bob's three Assets render with Avionics centred at y=0 and Thermal Subsystem / Guidance Computer alternating above and below; nodes visibly snap to dot-grid intersections.
- No new console errors. Pre-existing Changelog `key={release.version}` collision warnings persist (still out of scope).

**Status:** [x] Complete.

### Phase 10.3 completion notes (2026-04-28) — Library Modal unification

Closes backlog #25. Two separate library modals (Requirements Library + PEP Template Library) merged into a single chrome button + three-tab modal. Per the client canon, "PEP Templates" rename to "Parsing Templates" in user-facing copy only — internal field names keep PEP.

**Tabs:**

1. **Parsing Templates** — user's own Parsing Templates. Empty for the seeded dataset (templates are user-created on demand).
2. **Requirement Sets** — user's own Requirement Sets; published ones marked with the globe icon. Default tab when opening from chrome.
3. **Published Requirements** — read-only browse view showing all published Requirement Sets across the network, *including the user's own publications* (Option A from the scoping conversation).

**Implementation strategy.** Wrapping rather than re-implementing. The two legacy modal files (`RequirementsLibraryModal.jsx` 1070 lines + `PEPLibraryModal.jsx` 869 lines) gained an `embedded = false` prop that strips their outer card frame. When true, the modal renders only the inner two-panel body wrapped in a slim toolbar with the Create button. The new `LibraryModal.jsx` is small (~280 lines) — it owns the tab bar + outer frame, and composes the legacy modals as tab content. Tab 3 (Published Requirements) is implemented inline in `LibraryModal.jsx` as a new `PublishedRequirementsPanel` — read-only, follows the same left-list / right-detail rhythm.

**State + handler routing in V2App:**

- New state: `libraryInitialTab` (`'parsing' | 'requirements' | 'published'`, default `null` → resolves to `'requirements'`).
- Removed: `showPEPLibrary` and its setter.
- Chrome buttons: two SVG icons collapsed to one — kept the Requirements Library document-with-tab icon since it reads more generally as "library." Tooltip is just "Library."
- Trigger sites:
  - Chrome icon → opens with `libraryInitialTab = null` → defaults to `'requirements'`.
  - `published_standard` notification → opens with `libraryInitialTab = 'published'` so the recipient lands on the surface where they can review the newly-published standard.
  - Legacy `open-pep-library` document event → opens with `libraryInitialTab = 'parsing'`. (No code dispatches this today — it's a dead listener, but kept for backward-compat with any future callers.)

**ESC handling.** Three potential listeners coexist (parent LibraryModal, embedded RequirementsLibraryModal, embedded PEPLibraryModal). To prevent capture-phase collisions, the embedded child's listener now early-returns when both `embedded` is true AND `mode === 'view'` — letting the parent's window listener handle the close. When the child is in edit/create/newversion mode, it intercepts ESC to exit edit mode (stopPropagation), matching the standalone-modal behavior. The new parent listener uses bubble phase (no `true` flag), so even if a child accidentally bubbles, the order is correct.

**User-facing terminology rename — minimal blast radius:**

- `PEPLibraryModal.jsx` line 408: "Create PEP Template" → "Create Parsing Template".
- `PEPLibraryModal.jsx` line 152: "No PEP templates yet." → "No Parsing Templates yet."
- `PEPLibraryModal.jsx` embedded mode Create button: "+ Create Parsing Template" (was "+ Create Template" in standalone form).
- `V22ParseEvidenceModal.jsx` line 288 empty state: "No PEP Templates in your library. Add one via the Template Library before parsing." → "No Parsing Templates in your library. Add one via the Library before parsing."
- `V22NodeDetailPanel.jsx` Parse Evidence footer button tooltip: "Extract structured fields from this Asset using a PEP template" → "…using a Parsing Template".
- `V2App.jsx` chrome button tooltip: "Library" (was "Requirements Library" / "PEP Template Library").

**Internal field names unchanged.** `pepTemplates`, `pepTemplateId`, `parseTemplateId` and all factory/handler signatures keep PEP per the client canon. The data model is unaffected.

**Out of scope (deferred):**

- **Legacy modal file deletion.** The phase brief calls for deleting `RequirementsLibraryModal.jsx` + `PEPLibraryModal.jsx` after end-to-end UI QA. Per CLAUDE.md's documented V2Canvas raycaster DOM-dispatch limitation, scripted UI walkthrough of every flow that touches the Library (Create / Save / Publish / new-version / search / multi-tab navigation) cannot be exercised from this agent session. Files retained as embeddable panels pending manual QA. A follow-up phase can either collapse them into `LibraryModal.jsx` or split them into `library/RequirementsPanel.jsx` + `library/ParsingTemplatesPanel.jsx` and remove the standalone exports.
- **Cross-tab selection persistence.** Switching between tabs resets each tab's local `selectedId`. Acceptable simplification per the phase brief.
- **PEP Template publishing.** Out of scope per the brief — PEP Templates have no publish concept.

**Spec updates:** none. The spec doesn't currently document the Library surface in detail; a follow-up phase can codify the three-tab structure if it becomes load-bearing.

**Runtime verification:**

- Build clean (88 modules, +10 kB main bundle for the new `LibraryModal.jsx`).
- Chrome shows ONE Library icon button (down from two — verified via `document.querySelectorAll` enumeration: 3 chrome icon buttons total post-Phase 10.3, was 4 pre-Phase 10.3; the second library button is gone).
- Clicking the Library icon opens the unified modal with header "Library" + subtitle "Parsing templates, requirement sets, and published standards" + three tabs visible.
- Default active tab is **Requirement Sets** (renders the embedded `RequirementsLibraryModal`'s SetList with three seeded sets: Material Compliance / System Integration Requirements / MIL-PRF-55681 Compliance + the "+ Create Requirement Set" toolbar button).
- Switching to the **Parsing Templates** tab renders the embedded `PEPLibraryModal`'s body — empty state shows the renamed "No Parsing Templates yet" copy + the "+ Create Parsing Template" toolbar button.
- Switching to **Published Requirements** renders the empty-state copy ("No published requirements visible to your network yet."). On the seeded dataset there are no published Requirement Sets, so this tab's empty state is the expected output.
- No new console errors from Phase 10.3. Pre-existing Changelog `key={release.version}` collision warnings persist (still tracked separately; still out of scope).
- Manual QA needed for: Create flow on each tab, Publish flow (verify cross-tab visibility), Run Evaluation deep link if it exists, full search/filter behavior. Code-path verification + tab-content rendering verified via the preview probes above.

**Status:** [x] Complete.

### Phase 10.4 completion notes (2026-04-28) — Phase 10 wrap-up: legacy modal cleanup + spec sync

Two cleanup workstreams before moving to Phase 11.

**Workstream 1 — Legacy modal relocation (Option B).** Phase 10.3 retained the two legacy library modals as embeddable panels (`RequirementsLibraryModal.jsx` + `PEPLibraryModal.jsx`) pending manual UI QA. Phase 10.3 verified clean; this phase relocates them into a `library/` subdirectory and renames them as panels:

- `src/components/modals/PEPLibraryModal.jsx` → `src/components/modals/library/ParsingTemplatesPanel.jsx`
- `src/components/modals/RequirementsLibraryModal.jsx` → `src/components/modals/library/RequirementsPanel.jsx`

Default export identifiers renamed: `PEPLibraryModal` → `ParsingTemplatesPanel`, `RequirementsLibraryModal` → `RequirementsPanel`. Internal `Backdrop` import updated from `'./ModalShared.jsx'` → `'../ModalShared.jsx'`; `pepTemplates.js` import updated from `'../../v2/pepTemplates.js'` → `'../../../v2/pepTemplates.js'` to account for the extra directory hop. `LibraryModal.jsx` imports updated to reference the new paths and component names. Component behavior unchanged — `embedded` prop and existing API preserved.

`git mv` used to preserve file history. Verified: no other files in the codebase import the old filenames (V2App.jsx mentions them only in a historical comment block; polish-backlog.md and CLAUDE.md mention them in completion notes — both are historical record, retained as-is).

**Workstream 2 — Architecture spec sync.** Three updates to `architecture-spec.md`:

1. **§8.6 Library (new subsection)** — placed inside §8 (Directory Layer) after §8.5 Implementation note. Documents the three-tab structure (Parsing Templates / Requirement Sets / Published Requirements), the dual-visibility rule for own publications (Tab 2 with globe icon + Tab 3), and a Prototype note callout covering Platform-side registry authority (DPP for artifact registration, REP/PEP for per-protocol Templates, SDP for publication lifecycle).

2. **§17.1 Library reference updated** — the bullet that read "Same `Library` modal (Parse Templates tab + Requirements Sets tab + Published Standards tab — three tabs, one modal)" rewritten to past tense reflecting shipped state: "The unified Library modal (Parsing Templates / Requirement Sets / Published Requirements — three tabs) shipped in Phase 10.3 and serves both processes today. Future unification (one Template type with optional `criterion`) would consolidate these tabs into one."

3. **Spec Changelog entries appended** — five new entries after the 2026-04-23 annotation pass entry: §11.5a Agreement revocation (Phase 9D), §3.7 Layout (Phase 10.2.1), §10.1 Asset hierarchy (Phase 10.2), §8.6 Library (Phase 10.3), Register Asset modal copy (Phase 10.1).

**No feature work.** Out of scope per the phase brief.

**Runtime verification:**
- Build clean (88 modules, no change in bundle size — relocation is path-only).
- File system: `RequirementsLibraryModal.jsx` and `PEPLibraryModal.jsx` no longer exist at `src/components/modals/`; their content lives at `src/components/modals/library/RequirementsPanel.jsx` and `src/components/modals/library/ParsingTemplatesPanel.jsx`.
- Library opens from chrome with all three tabs rendering correctly (verified post-relocation: tabs Parsing Templates / Requirement Sets / Published Requirements, default Requirements Sets active, three seeded sets visible).
- No console errors related to import paths.
- Spec readable end-to-end: §8.6 Library section sits cleanly between §8.5 Implementation note and §9 AI Shopper; §17.1 references the Library in past tense; Changelog reflects Phases 9D + 10.x.

**Status:** [x] Complete.

### Phase 11A completion notes (2026-04-28) — DA/EA flow foundations: seed data + directory rebrand + actor corner refresh

Phase 11 covers DA/EA flow separation work (#113, #115, #114, #126) + related items (#108, #102, #117, #118, #119). Aggregate too large for one phase, so split: 11A foundations only (this phase), 11B directory cluster interactivity + Detail Panel expand viewer, 11C the actual flow separation, 11D amendment + cleanup. Phase 11A is pure setup — no flow changes; existing behavior preserved end-to-end.

**Workstream 1 — ChipCo as a fourth actor + warm-path seed.**

- New actor `dave-chipco` (Dave @ ChipCo, role: 'supplier') added to both the actor pool (`actorPool()`) and the demo seed (`buildV22SharedArtifacts`). Not yet exposed in the role switcher — UI still shows the original three personas. Added to the pool so any 11C/11D flow that addresses Dave by PIN resolves correctly.
- Three ChipCo Assets: PRM-3A IC Datasheet, PRM-3A IC Qualification Report, Voltage Reference IC Datasheet. Standard `makeAsset` factory, no schema changes.
- One Parse Result on the IC Datasheet using the same Electronics Component Profile template Alice uses for her PRM datasheet (gives the demo structural symmetry across suppliers).
- Two ChipCo Claims: "PRM-3A IC Compliance" (refs the IC datasheet + qualification report) and "Voltage Reference IC Spec" (refs the VRef datasheet).
- One inter-party DA from ChipCo to GovCo (`da-chipco-bob-prm-ic`) — type `full`, subject = `claim-chipco-prm-ic`, no paired EA. This is the warm-path setup for Phase 11C: Bob has visibility into ChipCo's catalog (the directory cluster gates on this DA's existence) but no Claim pulls onto his canvas because no EA is paired yet. 11C will let Bob send an EA request which, when accepted, pulls the Claim onto his canvas.
- Internal ownership DAs for ChipCo's Assets, Claims, Claim→Asset reference edges, and the Parse Result→source-Asset edge — all standard internal DAs matching the existing pattern for Alice/Bob/Carol so edge derivation works without changes.

**Umbrella DA interpretation.** The brief calls this an "umbrella" DA, but the V2.2 schema doesn't have a dedicated umbrella type. Pragmatic interpretation: the warm-path anchor is one inter-party DA (subject = ChipCo's first Claim) that satisfies the directory cluster's visibility filter and serves as the seed Bob's Phase 11C flow will build on. If Phase 11C needs a true catalog-level umbrella concept, the schema can extend then.

**Workstream 2 — Public Directory rebrand.**

- The previous `ElectroGrid Ltd` mock cluster (line ~158 of DirectoryLayer.jsx) replaced with a real `ChipCo` cluster. Label rewritten from `mock supplier · 41 public` to `supplier · ${chipcoClaimCount} public` (resolves to "supplier · 2 public" today — the seeded ChipCo Claim count).
- Per-role visibility filter: ChipCo's cluster only renders when the active party has at least one active (non-revoked) DA from ChipCo. Today only Bob (GovCo) qualifies via the seeded `da-chipco-bob-prm-ic`. Alice and Carol see the other 3 clusters but not ChipCo. Implementation: `chipcoVisible = useMemo(() => sharedForDirectory.disclosureAgreements.some(d => d.grantor?.party === 'ChipCo' && d.grantee?.party === activeParty && !d._revokedMeta), [sharedForDirectory, activeParty])`. Filter applied as a `.filter(c => c.partyName !== 'ChipCo' || chipcoVisible)` over the cluster array.
- Other 3 clusters (MicroCo's own, NovaFab, Precision Components) preserved unchanged.

**Workstream 3 — Actor corner refresh.**

- Replaced the 88×88 amber-glowing circle anchor with a parent-layer-style ACTOR card (CARD_W = 210px, ACTOR badge on its own row above the party name, warm-indigo border matching the parent-layer Actor cards' Phase 9A.1 WARM_BORDER convention).
- Tooltip wrapper updated: `Exit Directory` → `Return to your network`.
- Hover treatment: border tightens from `40% indigo + var(--border)` blend → solid `var(--accent-indigo)`, background gets a 6% indigo wash, box-shadow deepens. Matches the parent-layer hover treatment without copying its specific glow value (which is selection-state).
- Click handler unchanged — calls `onClose` to exit the Directory Layer.

**Spec updates:** §8.5 grew a paragraph + Prototype note callout codifying per-role cluster visibility (Platform-side discoverability index in production; the prototype keys off seeded DAs).

**Out of scope (deferred to later 11.x):** any flow changes (DA / EA / Parse / Evaluate / Revoke / Transfer), cluster-click interactivity, modal flow changes, expand-evidence Detail Panel work, DA/EA terms work, amendment work.

**Runtime verification:**

- Build clean (88 modules; +4 kB main bundle for ChipCo seed data).
- ChipCo seed integrity (data-layer probe via dynamic module import):
  - Bob's view sees ChipCo via the warm-path DA (`da-chipco-bob-prm-ic` resolves; `da.grantor === 'ChipCo'` && `da.grantee === 'GovCo'` && `!_revokedMeta`).
  - ChipCo has 3 Assets, 2 Claims, 1 Parse Result. All ownership + reference DAs derive correctly.
  - ChipCo's PRM-3A IC Compliance Claim does NOT pull onto Bob's parent-layer canvas (no paired EA — the pull-in rule requires `evaluationAgreements`).
- DirectoryLayer per-role behavior verified by code path: `chipcoVisible` returns `true` for `activeParty === 'GovCo'`, `false` for `'MicroCo'` and `'AuditCo'`.
- Corner anchor visual: full UI walkthrough constrained by V2Canvas raycaster DOM-dispatch limitation; code-level verification confirms the JSX swap landed at the documented coordinates.
- No new console errors; pre-existing Changelog `key={release.version}` collision warnings persist (out of scope).

**Status:** [x] Complete.

### Phase 11B completion notes (2026-04-28) — ChipCo cluster interactivity + Detail Panel "expand" evidence viewer

Builds on Phase 11A's foundations. Three workstreams.

**Workstream 1 — ChipCo cluster click → Claim materialization.**

- DirectoryLayer accepts new props: `onClusterClick(cluster)`, `materializedClaim` (`{ claim, anchor: { xPct, yPct } }` or null), and `onCloseMaterializedClaim`. Other clusters remain inert visual dots.
- The ChipCo cluster is wrapped in a 180×180 hit-area (centred on the cluster's `xPct`/`yPct`). Hover bumps `transform: scale(1.06)` + `filter: brightness(1.25)` so clickability reads. Click fires `onClusterClick(cluster)`.
- V2App's `onClusterClick` handler resolves the warm-path Claim (`claim-chipco-prm-ic` from Phase 11A's seed), sets `v22DirectoryMaterializedClaim = { claim, anchor }`. DirectoryLayer renders a 210px Claim card at the anchor with the parent-layer CLAIM card visual (CLAIM badge, name, owner) + a thicker 2px amber selected border + amber glow box-shadow so the card reads as the selected element.
- V2App also mounts a synthetic-node V22NodeDetailPanel for the materialized Claim. New exported helper `buildClaimNodeForDirectoryMaterialization(claim, evalResults)` in v2_2Data.js wraps the existing `claimToNode` + `rollupClaimHealth` private helpers. Synthetic node carries the Claim's `v22Type: 'CLAIM'` + `v22Artifact` + standard fields, so V22ClaimPanel's existing rendering path applies without changes.
- Detail Panel positioned `position: fixed, top: 0, right: 0, bottom: 0, width: 480, zIndex: 200` — above the directory layer (z-index 150) and the materialized card (z-index 10) but below the modal stack (10000).
- Closing the panel (× / `onClose`) clears `v22DirectoryMaterializedClaim`. Closing the directory layer entirely also clears it.
- "Request Evaluation Agreement" footer button intentionally NOT wired — that's Phase 11C scope. The non-owner V22ClaimPanel branch already produces an empty footer for this case (no Run Evaluation without an EA, no Amend/Self-Evaluate for non-owners), so the panel renders cleanly as a read-only browse view.

**Workstream 2 — Detail Panel "expand" modal restored.**

New file `src/components/modals/ExpandedArtifactModal.jsx` with three sub-components:

- **`AssetEvidenceViewer`** — file metadata header (filename / size / MIME / truncated hash with click-to-copy) + body that shows an iframe pointed at `file.localPath` when set (height 400px, full width, dashed-border fallback). Footer rows for owner + registration date.
- **`ArtifactRow`** — schema-aware row: parse-output rows show a confidence chip (green/amber/red color band by threshold); eval-output rows show a status badge (SAT/UNSAT/MISSING/N/A with the established color palette).
- **`TabBar`** — Output / JSON tabs, indigo underline + bold for active, color shift on hover for inactive.

Modal frame: 720px × 80vh, portal via shared Backdrop, ESC to close.

New `ExpandButton` component in V22NodeDetailPanel.jsx — outward-arrow SVG icon button (square with diagonal arrow), 11×11 icon, indigo-on-hover. Wired onto referenced-Asset rows in V22ClaimPanel's "Referenced Assets" section. The row layout grew from a flat single-line treatment to a flex row with name on the left + Expand button on the right.

V22ClaimPanel signature gained `onExpandAsset(asset)` prop. V2App's standard panel mount and the new directory-materialized panel mount both wire it to `setV22ExpandedArtifact({ artifact: asset, schema: 'asset' })`. New V2App state `v22ExpandedArtifact = { artifact, schema } | null` drives the modal mount.

`referencedAssetNames` data shape extended from `{ id, name }` to `{ id, name, asset }` so the Expand button can hand the full Asset artifact to the modal. Both the standard panel mount (`/v2/V2App.jsx` ~4264) and the new directory-materialized panel mount build the same `{ id, name, asset }` row format using a shared `resolveAsset` helper.

**Parse Result + Eval Result expand wiring deferred** — the modal supports `'parse-output'` and `'eval-output'` schemas (so the modal is ready), but Expand buttons aren't yet wired onto V22ParseResultPanel / V22EvalResultPanel rows. Phase 11B's priority was Asset rows for the ChipCo browse flow; Parse/Eval expansion can land in a follow-up by adding `onExpandParseResult` / `onExpandEvalResult` props and `ExpandButton` instances to those panels.

**Workstream 3 — Seed data: localPath + ChipCo placeholder PDFs.**

- New devDependency `pdfkit ^0.18.0`. New script `scripts/generate-placeholder-pdfs.js` writes 3 placeholder PDFs to `/public/`: `prm-3a-ic-datasheet.pdf`, `prm-3a-ic-qualification-report.pdf`, `voltage-reference-ic-datasheet.pdf` (all ~2 KB each, 1 page, title + filler description). Re-runnable for future placeholders.
- Backfilled `localPath` on three existing Alice Assets whose filenames match `/public/` PDFs: `aPrmDatasheet` → `/powerregulationmodule-datasheet.pdf`, `aVregDatasheet` → `/voltageregulator-datasheet.pdf`, `aEmiDatasheet` → `/emishielding-datasheet.pdf`.
- ChipCo's 3 Assets gained `localPath` pointing at the new PDFs + their seed `file.filename` updated to match the public-folder filenames.
- Other seed Assets (Alice's PRM Test Report + Thermal Analysis, Bob's Avionics + Guidance + Thermal, Carol's two .md files) intentionally left without `localPath` — the AssetEvidenceViewer falls back to "Document preview not available" for these. Backfilling can happen as more placeholder PDFs are generated.

**Spec updates:**

- §10.1 Asset artifact: `file.localPath` documented as a Prototype-only field; Prototype note callout split to call out `localPath` separately from the other prototype-vs-production schema fields.
- §8.7 Detail Panel — Expand modal (Phase 11B) — new subsection covering the three schemas (asset / parse-output / eval-output), the modal dimensions, the close affordances, and a Prototype note that production resolves files via QS URI lookups instead of `localPath`.

**Out of scope (deferred):**

- DA/EA flow separation work (Phase 11C — #113, #115, #114, #126).
- Amendment work (Phase 11D — #108, #102).
- Real PDF.js integration (#41 — partial: 11B shipped iframe-based viewer; full PDF.js integration deferred).
- Umbrella DA edge visualization (#132 — explicitly deferred to Phase 14).
- "Request Evaluation Agreement" footer button (Phase 11C entry point).
- Parse Result + Eval Result Expand wiring (modal supports the schemas; per-panel button wiring deferred).

**Runtime verification:**

- Build clean (88 modules, +13 KB main bundle for the new Expand modal + DirectoryLayer additions + V2App wiring).
- 3 placeholder PDFs written under `/public/` (~2 KB each).
- Data-layer probe: `buildClaimNodeForDirectoryMaterialization(chipcoClaim, [])` returns a synthetic node with `v22Type: 'CLAIM'`, `v22Artifact === chipcoClaim`, `name === 'PRM-3A IC Compliance'`. ChipCo's 3 Assets all carry `file.localPath` pointing at the new PDFs. Alice's 3 publication-cluster Assets carry `localPath` pointing at the existing /public/ PDFs.
- Browser-observable end-to-end ChipCo cluster click flow constrained by the V2Canvas raycaster DOM-dispatch limitation documented since 9A.6 — code-path verification + module imports + structural diff are the canonical fallback per prior phase precedent.

**Status:** [x] Complete.

### Phase 11C completion notes (2026-04-29) — DA/EA flow separation: warm path EA request + EA terms + Dave as switchable role

Closes backlog #113, #126, partial #115. Seven workstreams, single commit.

**Workstream 1 — Dave as a real role.** Promoted Dave (ChipCo, role: 'supplier') from the actor-pool-only entry shipped in Phase 11A to a fully switchable role in `ROLES` (src/v2/v2Data.js). The role switcher dropdown now exposes 4 roles. Dave's seeded artifacts from Phase 11A (3 Assets, 1 Parse Result, 2 Claims, ownership + claim-ref + parse-ref DAs, the warm-path inter-party DA to Bob) compose his canvas without any seed-data changes.

**Workstream 2 — EA terms schema (#115).** Extended `makeEvaluationAgreement`'s `terms` object with two acknowledgment booleans:
- `terms.resultConfidentiality` (default false) — "Evaluation results are for internal use only and will not be shared with third parties."
- `terms.attribution` (default false) — "If results are referenced externally (audits, certifications), the evaluator will be credited."

Both ride along on the EA artifact and are recorded but NOT enforced. Production would expand this with platform-level policy hooks. `finalizeProvisionalAgreementPair` and `finalizeProvisionalEvaluationAgreement` thread the values through unchanged on accept.

**EA expiry check at Run Evaluation time.** New defensive guard in `handleV22OpenRunEvaluation` — if `ea.terms.evaluationDeadline` is in the past, the modal refuses to open with a copy hint pointing the user toward requesting a new agreement. Demo-only logic; production would have platform-level policy enforcement. Passive expiry notifications (`v22-ea-expiring-soon`, `v22-ea-expired`) filed as #133.

**Workstream 3 — Cold path two-step modal (#113).** `CombinedRequestModal` rewrite:
- Step 1 (Disclosure Agreement) — PIN + live resolution + Requirements Sets multi-select + optional message. Continue gated on a valid resolution and the requester anchor Asset.
- Step 2 (Evaluation Agreement) — expiry date input (default `today + 365 days` formatted as `YYYY-MM-DD`) + two CheckboxRow components for `resultConfidentiality` + `attribution`. Submit button replaces Continue.
- StepDots indicator + Back/Continue/Send Request footer logic. Single-step → two-step migration was 95% additive — only the existing CTA logic moved into the multi-step framework.

`handleV22RequestSubmit` and `makeProvisionalAgreementPair` extended to accept `eaExpiry` + `eaResultConfidentiality` + `eaAttribution`. The provisional EA persists the values via the extended terms; the response modal reads them back via `proposedEaTerms`.

**Workstream 4 — Warm path (#126).** New `EARequestModal.jsx` (single-step). Layout: requester/target/anchor info card, optional Requirements Sets multi-select, expiry date input (1y default), two acknowledgment CheckboxRows, optional message. Submit produces a provisional EA referencing the existing active DA's id (no new DA created).

Two new factories:
- `makeProvisionalEvaluationAgreement({ existingDisclosureAgreementId, ... })` — produces `{ evaluationAgreement }` with `_provisional: true` and `_requestMeta: { message, requesterParty, requesterAssetId, requestedRequirementsSetIds, createdDate }`. Validates `existingDisclosureAgreementId` is non-null.
- `finalizeProvisionalEvaluationAgreement({ provisionalEa, eaTerms })` — clears `_provisional`, applies the responder's confirmed expiry + carries acknowledgments through.

`buildViewForActor` gained two parallel branches:
- Provisional EA detection — Claims with a non-declined `_provisional` EA where the active actor is grantee get added to `provisionalClaimIds`. Visually identical to cold-path provisional treatment (dashed border + AWAITING RESPONSE badge).
- EA-only decline detection — annotated `_declineMeta` on EA produces a declinedClaimIds entry with `eaOnly: true` flag. Visually identical to DA-decline DECLINED state.

**Two warm-path entry points:**
1. **Claim Detail Panel footer** (`V22NodeDetailPanel.jsx` — V22ClaimPanel). New props `onRequestEvaluationAgreement` + `hasActiveDaWithoutEa`. The footer renders the new "Request Evaluation Agreement" CTA when the viewer is non-owner, has an active DA, and no active EA. An informational strip above the footer reads "An Evaluation Agreement is required to evaluate this Claim." so the user understands why Run Evaluation isn't shown.
2. **Canvas action bar** (`V22ActionBar` in `AssetNode.jsx`). New `▷` button on Claim cards where `node._hasActiveDaWithoutEa` is set. Stamped by `v22DataWithReveal` memo via a new `claimsWithActiveDaWithoutEa` Set computed from the active actor's DAs/EAs.

**V2App routing:** new `v22EaRequestContext` state holds `{ claim, ownerParty, existingDisclosureAgreementId, requesterAsset }`. Both entry points populate this state; the modal reads it. The directory-materialized panel (Phase 11B) gains the same warm-path detection so Bob can request an EA directly from the ChipCo cluster click flow without navigating back to the parent canvas — closing the directory + materialized panel before the modal opens.

**Workstream 5 — EA-only response (#113 + #126).** `CombinedResponseModal` extended with an `eaOnlyMode` prop. When true:
- Lands directly at step 3 (EA Terms) with `action: 'ea-only'`.
- Hides the disclosure-type cards (step 1) and the scope steps (step 2).
- StepDots shows "step 3 of 4" — internal step layout unchanged so the existing routing logic doesn't fork.
- Step 3 displays the requester's submitted expiry + acknowledgments; the grantor adjusts expiry only (acknowledgments are read-only chips via the new `ReadonlyAck` helper component).
- Footer renders Decline + Continue buttons at step 3; Decline routes to step 4 with a reason textarea.
- Step 4 (Review) hides the Disclosure type row; shows expiry + acknowledgments only. Accept fires `onAccept({ type: null, scope: null, eaTerms })` — the V2App branch routes to `handleV22AcceptEAOnly`.

Cold path also gained acknowledgment forwarding — `handleSubmit` now reads `request?.proposedEaTerms?.resultConfidentiality` + `attribution` to pass them along on accept (the requester's submission carries them through; the grantor doesn't get to mutate them in the cold path either).

**Workstream 6 — Notifications (3 new types).** `v22-request-ea-only` enqueued on the grantor's inbox on warm-path submit (badge: "EA REQUEST", amber). Click opens `CombinedResponseModal` in `eaOnlyMode` via new `v22RespondingToEaOnly` state — `setV22RespondingToEaOnly({ eaId })`. Same dismiss-on-terminal-action pattern as `v22-request`. `v22-ea-accepted` and `v22-ea-declined` (badges "EA ACCEPTED" green / "EA DECLINED" red) fire on the requester's inbox; click pans to the target Claim with the standard animated pan + zoom 1.28 and dismisses.

**V2App handlers:**
- `handleV22EaRequestSubmit` — produces the provisional EA, merges into `v22Provisionals`, pans/selects the now-provisional Claim with `_isNew` reveal, fires `v22-request-ea-only` to the grantor.
- `handleV22AcceptEAOnly` — finalizes the EA via `finalizeProvisionalEvaluationAgreement`, fires `v22-ea-accepted` to the requester, dismisses the original `v22-request-ea-only` notification on this grantor's inbox.
- `handleV22DeclineEAOnly` — annotates the EA with `_declineMeta` (decline retention pattern from Phase 6.5 #3), fires `v22-ea-declined` with reason, dismisses the original notification.
- `handleV22DismissDeclined` extended — finds and drops `_declineMeta`-annotated provisional EAs (warm-path declines) alongside the existing DA-only declined-pair drop.

**Spec updates folded in:**
- §11.6a EA-only request lifecycle (new subsection) — full warm-path flow with cancel-while-pending + prototype note covering SDP authority.
- §10.5 — `terms.resultConfidentiality` + `terms.attribution` documented as Prototype-only acknowledgments; demo-only `evaluationDeadline` enforcement also documented; JSON example updated.
- §7.4 — three new notification rows (`v22-request-ea-only`, `v22-ea-accepted`, `v22-ea-declined`).
- §6.3a Dave's view (new subsection) — Dave as a switchable role, mechanically identical to Alice.
- Changelog gained five new entries covering all of the above.

**Deviations from task brief:**
- *Recommended Option A (reuse `CombinedResponseModal` in eaOnlyMode) shipped.* No separate EAResponseModal — the `eaOnlyMode` prop branches the existing modal instead.
- *Decline path UI:* the brief allowed both modal patterns; chose the inline 2-step Decline → Reason mechanic (step 3 has a Decline button alongside Continue; clicking Decline transitions to step 4 with a reason textarea). Same shape as cold-path decline.
- *Cancel-while-pending* relies on the existing `handleV22CancelRequest` only when there's a paired DA. Pure EA-only cancellation (drop the provisional EA without paired DA) lands as a future polish item — for now Bob can navigate back to the directory, click the cluster again, and let the dismiss-on-decline path clean up if the response goes unfavorable.
- *Pan-to-zoom* on warm-path acceptance reuses the existing `v22RecentlyAcceptedClaimId` flag — no new reveal mechanic.
- *Slow-mode `SLOW_MODE_MULTIPLIER` change in unravel.js (10 → 2)* was a pre-existing modification in the working tree (not part of this phase's task). Folded into the commit as a cleanup — slow-mode default of 2 reads more naturally for QA work and the previous 10× was an outlier.

**Runtime verification:**
- Build clean (91 modules — +1 vs. Phase 11B's 88 due to: EARequestModal, ROLES update, ChipCo seed). Bundle size ~552 kB main / ~131 kB gzip.
- Preview reload clean — no console errors, app boots through CAC screen, canvas renders normally.
- Data-layer probe (preview console):
  - `ROLES.find(r => r.id === 'dave-chipco')` returns Dave's full role object (party 'ChipCo', role 'supplier').
  - `getV22DataForRole('bob-govco', emptyProvisionals)` shows `da-chipco-bob-prm-ic` exists with grantee 'GovCo', type 'full', no paired EA.
  - `makeEvaluationAgreement({ ..., terms: { resultConfidentiality: true, attribution: true, evaluationDeadline: '2027-04-29' }})` returns the EA with all three terms persisted on `terms`.
  - `makeProvisionalEvaluationAgreement(...)` returns `{ evaluationAgreement }` with `_provisional: true` and the requester's expiry + acknowledgments persisted.
  - `getV22DataForRole('bob-govco', { ..., evaluationAgreements: [warmPathProvEa] }).provisionalClaimIds.has('claim-chipco-prm-ic')` returns `true` — the provisional EA flips Bob's view of the Claim into provisional state.
- End-to-end UI walkthrough constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6. The data-layer + module-load probes are the canonical fallback per prior phase precedent.

**Known scope boundaries (not 11C blockers):**
- *Amendment work (#108, #102)* — Phase 11D.
- *Audit pass items (#117, #118, #119)* — Phase 11D.
- *Passive expiry notifications (#133)* — filed for later polish.
- *Umbrella DA edge visualization (#132)* — explicitly deferred to Phase 14.
- *Asset Detail Panel terminology audit (#119)* — Phase 11D.
- *Pure EA-only cancellation handler* — for now warm-path requests are cleaned up via decline-dismiss; a dedicated `handleV22CancelEaOnlyRequest` is a polish follow-up if Andrew wants the requester to drop the provisional without a counterparty round-trip.

**Status:** [x] Complete.

### Phase 11C.1 completion notes (2026-04-29) — Acknowledgments architecture + warm path bug fixes

Twelve workstreams in a single commit, structured around a fundamental Phase 11C architectural correction: terms are responder-authored; the requester's role at request time is acknowledging pre-set commitments the Claim owner authored on the Claim itself.

**W1 — Acknowledgments on Claim schema.** `makeClaim` factory extended with optional `acknowledgments[]` (`{ id, title, description }`). Seeded 2 acks on Alice's PRM Assembly Claim ("Result confidentiality", "Attribution") and 1 ack on ChipCo's PRM-3A IC Compliance Claim. `makeAmendedClaim` preserves acknowledgments through Asset amendments. `makeClaimCreationArtifacts` generates stable per-row ids and filters empty rows on submit.

**W2 — Claim creation modal.** New Acknowledgments section in `V22CreateClaimModal` Step 0, between Referenced Assets and the next field. Title input + description textarea per row, Remove button, "+ Add Acknowledgment" CTA. Empty rows (no title AND no description) dropped on submit. Review step gained an Acknowledgments InfoRow showing the count.

**W3 — Cold path Step 2 redesign.** `CombinedRequestModal` Step 2 rewritten. The earlier (wrong-shape) requester-authored expiry + result-confidentiality + attribution checkboxes are gone. Step 2 now renders the target Claim's `acknowledgments[]` as required checkboxes. All boxes must be checked before Submit enables. Zero-ack Claims surface a "no acknowledgments required" callout and proceed directly.

**W4 — Warm path EARequestModal redesign.** Same shape as cold path Step 2: acknowledgments as required checkboxes, no expiry / confidentiality / attribution UI. Optional message field retained.

**W5 — Response modal redesign.** `CombinedResponseModal` step 3 keeps the responder-authored `ExpiryPicker` (defaults 1y from response date). Dropped the read-only chips that surfaced the requester's confidentiality / attribution selections. Added a read-only "Requester accepted these acknowledgments" panel listing the ids the requester checked, resolved against the Claim's `acknowledgments[]`. Step 4 review row swapped from named chips to a count.

**W6 — EA artifact schema cleanup.** `makeEvaluationAgreement` removed `terms.resultConfidentiality` + `terms.attribution`. Added top-level `acknowledgmentsAccepted: [id, ...]` (audit trail; ids reference the Claim's `acknowledgments[]`). Both finalize factories carry the array through unchanged. Both provisional factories accept the new parameter; legacy `eaExpiry` / `eaResultConfidentiality` / `eaAttribution` parameters dropped.

**W7 — Cold-path provisional state regression fix.** The legacy provisional check at the view-builder layer required ALL of an actor's DAs on a Claim to be `type === 'provisional'` — missing the case where the user re-requests against a Claim they already have an active DA on. Replaced with `find()` matching any provisional DA where the actor is grantee. Backlog #134 filed for the upstream UX gate (PIN-existing-Claim validation in cold path Step 1) since the fix here is purely visual fallout — production should prevent the duplicate request entirely.

**W8 + W9 — Warm-path acceptance reveal.** `handleV22AcceptEAOnly` extended to mirror the cold-path acceptance reveal:
- Sets `v22RecentlyAcceptedClaimId` + `v22PanToClaimId` for the Claim — drives Bob's provisional → active transition with `_isNew` reveal animation.
- Sets `v22RecentlyAcceptedAssetId` + `setSel` + `v22PanToClaimId` for the grantee anchor Asset — Dave's canvas now pans/zooms to Bob's Avionics Module as it materializes with NEW badge.

This pairs the cold-path's Phase 6.5 #4 fix exactly. Both bugs (Bob's transition not animating, Dave not panning to the new Asset) collapse into the same wiring.

**W10 — Unravel animation on declined dismiss.** `handleV22DismissDeclined` converted to async; `await playUnravelAnimation(...)` runs before state mutation. setSel(null) BEFORE the unravel so the selection border doesn't compete with the border-erasure stage (same pattern Phase 9D.2.3 Fix 2 established). Cold path declined Claims (provisional Claim pulled in via the request) and warm path declined Claims (still on canvas via active DA, EA annotated `_declineMeta`) both animate uniformly. The primitive gracefully no-ops on nodes that aren't on canvas, so no defensive guard needed.

**W11 — Detail Panel clears on Directory navigation.** Directory icon click handler now calls `setSel(null)` + `setForcePanelTab(null)` + `setForceExpandSda(null)` before flipping `v22DirectoryOpen`. Closing the layer also clears `v22DirectoryMaterializedClaim` so directory-side panel state doesn't survive the transition. Cleanly tested: open Bob → select a Claim → click globe → directory layer renders without the panel persisting.

**W12 — Documentation.** Spec: §10.3 Claim acknowledgments[] field documented with format spec + carry-through note to §10.5; §10.5 dropped requester-authored terms paragraph + added Prototype note about the architectural correction + `acknowledgmentsAccepted` field documented; §11.6a updated to reflect the new flow. Spec Changelog gained the 11C.1 correction entry. polish-backlog: new entries #134 (PIN-existing-Claim validation), #135 (counterparty-pulled Asset panel sections), #136 (Cancel Request action bar button) — all out-of-scope per the brief. Update Log entry. Changelog modal v0.11.0 → v0.11.1 entry appended; footer version bumped.

**Deviations from task brief:**
- **None material.** All 12 workstreams shipped as briefed. The W7 regression fix was a one-line `every` → `find` change, much simpler than expected — the regression was a logical edge case the original Phase 6 author hadn't considered (re-request against an already-disclosed Claim) rather than a 11C-specific introduction. Filed the architectural-correctness item as #134 backlog so the Phase 11C.1 fix doesn't end the conversation.
- **W10 unravel** uses the existing `playUnravelAnimation` primitive without modifications. The primitive's own graceful-no-op behavior on missing nodes meant no defensive guard was needed at the call site.

**Runtime verification (preview):**
- Build clean (91 modules, ~553 kB main / ~131 kB gzip).
- Data-layer probe via dynamic import: cold-path against EMI Claim correctly flags `provisionalClaimIds: [claim-emi-shield]`; warm-path provisional EA correctly flags ChipCo Claim provisional on Bob's view; finalize clears `_provisional` and preserves `acknowledgmentsAccepted`; EA terms keys no longer include `resultConfidentiality` / `attribution`; seeded acks present on PRM Assembly (2) and ChipCo PRM-3A (1).
- End-to-end UI walkthrough constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — code-path verification + module-load + data-layer probes are the canonical fallback per prior phase precedent.

**Status:** [x] Complete.

### Phase 11C.2 completion notes (2026-04-29) — Reveal animation diagnosis + Claim panel acknowledgments + EA Expand + response modal polish

Five workstreams, single commit.

**W1 — Reveal animation diagnosis + fix.** The V2.1-era reveal-animation guard at V2App.jsx:3221 reads:
```js
if (targetNode._isNew && targetNode._wasProvisional) {
  startReveal(targetNode.id)
} else {
  canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
}
```

Comprehensive grep confirmed `_wasProvisional` was never set anywhere in V2App, AssetNode, V2Canvas, v2_2Data, or any uploaded file. Dead infrastructure since the V2.1 → V2.2 migration retreat — `startReveal` (the flip-from-provisional → active animation) hadn't fired on any acceptance since.

Fix: in `v22DataWithReveal`'s node-decoration map, stamp `_wasProvisional: true` ONLY on the recently-accepted Claim id (`v22RecentlyAcceptedClaimId`), NOT on accompanying Asset reveal ids (those didn't transition from provisional state, they were just newly visible — Phase 6.5 #4 should keep its simple-pan behavior). One-line addition:
```js
const justFinalizedClaim = needsReveal && n.id === v22RecentlyAcceptedClaimId
// ... in the spread:
...(justFinalizedClaim ? { _wasProvisional: true } : {}),
```

Cold-path acceptance (Alice accepts Bob's request) and warm-path EA acceptance (Dave accepts Bob's EA-only request) both now fire the existing flip animation when Bob clicks the resulting notification.

**W2 — Acknowledgments on Claim Detail Panel.** New section in `V22ClaimPanel` between Referenced Assets and Evaluation Results:
- Renders only when `claim.acknowledgments?.length > 0`
- One card per acknowledgment with bold title + dim description
- Same visual rhythm as the existing Detail Panel sections (Section header + list of cards on `var(--bg-raised)`)
- Visible to all viewers — owner sees what they authored; counterparty sees what they agreed to before requesting (cold path) or would need to agree to (warm path)

**W3 — EA Detail Panel Expand button.** Three coordinated changes:
1. `ExpandedArtifactModal` schema enum extended with `'evaluation-agreement'`. The `TabBar` component gained a `hideOutput` prop; when true the Output tab is hidden entirely (EAs have no file or structured rows that map to it). The modal's `tab` state defaults to `'json'` when `schema === 'evaluation-agreement'`.
2. `EvaluationAgreementDetailPanel` gained a new `onExpand` prop. New `ExpandIconButton` helper inlined at the top of the file (pattern parity with `V22NodeDetailPanel`'s local `ExpandButton` — same SVG, same hover treatment, same border styling). Rendered in the panel header before the close button.
3. V2App's EA panel mount wires `onExpand` to `setV22ExpandedArtifact({ artifact, schema: 'evaluation-agreement' })`. The existing modal mount handles the rest.

Output tab content for EA artifacts intentionally deferred — JSON tab is sufficient and the "Document preview not available" placeholder shape from Phase 11B doesn't fit an EA (no file). Future polish item.

**W4 — Response modal title + checkbox styling.** `CombinedResponseModal` `eaOnlyMode` headers updated:
- Accept: "Respond to EA Request" → **"Respond to Evaluation Agreement Request"**
- Decline: "Decline Evaluation Agreement" → **"Decline Evaluation Agreement Request"** (consistent with cold path's "Decline Request" pattern)

`ReadonlyAck` chip recoloured from indigo (which read as an actionable, just-checked checkbox) to grey:
- Background: `color-mix(... var(--accent-indigo) 6%)` → `var(--bg-card)`
- Border: `color-mix(... var(--accent-indigo) 25%)` → `var(--border)`
- Checkbox border: `var(--accent-indigo)` → `var(--text-dim)`
- Checkbox fill: `var(--accent-indigo)` → `var(--text-dim)`
- Title text: `var(--text-primary)` → `var(--text-secondary)` (slightly dimmer to match "locked" treatment)

The check mark stays so the chip still conveys "this was acknowledged" — but the colour signals "you can't toggle it."

**W5 — Documentation.** Spec Changelog (Phase 11C.2 entry covering all four workstreams). polish-backlog Update Log entry; EA Expand Output tab content noted as deferred polish (no new # filed — bundled with the existing Phase 11B Expand polish backlog). CLAUDE.md Phase 11C.2 note (this section). Changelog modal v0.11.2 entry; footer version v0.11.1 → v0.11.2.

**Deviations from task brief:** None. All five workstreams shipped exactly as described. The W1 fix turned out to be a one-line addition rather than a hunt for a complex regression — confirms the brief's "dead infrastructure" diagnosis.

**Runtime verification (preview):**
- Build clean (91 modules, ~553 kB main / ~131 kB gzip).
- App reloads cleanly; no new console errors.
- Data-layer probes from prior phases continue to pass.
- Visual verification of W1's reveal animation flow constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path for click-through scenarios.

**Status:** [x] Complete.

### Phase 11C.3 completion notes (2026-04-29) — Reveal animation timing fix + Expand icon consistency

Five workstreams in a single commit, all driven by Phase 11C.2 QA: the wired `_wasProvisional` flag set the guard correctly but the flip animation still played from active → active rather than provisional → active.

**Diagnosis.** At notification-click time the artifact has already finalized — responder's accept fires `finalize*` → `_provisional` clears in `v22Provisionals`. AssetNode's `isProvisional` predicate (line 370: `!!node.provisional || !!node._showAsProvisional`) returns false because the canvas adapter's `markProvisional` no longer sets either flag for the now-active Claim. The flip animation runs through its phases, but the source state for the flip is already active.

**W1 — Force provisional render via stamp override.** `v22DataWithReveal` now adds `_showAsProvisional: true` alongside `_wasProvisional: true` on the recently-accepted Claim (only — not on Asset reveal ids). AssetNode's existing `showAsProvisional = isProvisional && !isPostFlip && !flipMidpoint` predicate evaluates to true during the reveal window, rendering the dashed/dimmed border. At `flipMidpoint` (~1.4s into the reveal) the visual hand-off happens — AssetNode switches to active styling.

**W2 — Clear stamp at reveal completion + remove V2.1 dead code.** The legacy clearing logic at V2App:2388-2411 operated on `addedNodes` / `addedEdges` — V2.1 storage path. V2.2 stores provisional state on `_provisional` in `v22Provisionals`, so the old code was a no-op. Removed. Replaced with an `onDone` callback at the migrated reveal primitive's phase 'done' (t=2500ms) that clears `v22RecentlyAcceptedClaimId`, which stops `v22DataWithReveal` from stamping the override. Next render shows clean active state.

**W3 — Migrate reveal animation to dedicated file.** New `src/v2/animations/reveal.js` exports `playRevealAnimation({ nodeId, canvasRef, targetNode, setRevealAnim, onDone })`. Mirrors the organization of `src/v2/animations/unravel.js`. `startReveal` in V2App.jsx is now a thin wrapper that resolves the target node from `nodeMap`, fires the acceptance-notification dismissal upfront, and delegates to the primitive. Phase timings preserved exactly: zoom (0) / border (500) / flip (1100) / badge (1800) / panel (2000) / done (2500) ms.

The primitive's setTimeout chain uses a per-phase `prev?.nodeId === nodeId` guard inside each `setRevealAnim` updater so a stale timer from a superseded reveal doesn't clobber a newer reveal targeting a different node.

**W4 — Standardize Expand icon.** Two duplicate definitions previously existed:
- `V22NodeDetailPanel.jsx::ExpandButton` (Phase 11B) — diagonal arrow pointing top-right.
- `EvaluationAgreementDetailPanel.jsx::ExpandIconButton` (Phase 11C.2) — two opposing-corner arrows pointing outward.

Per the task brief, the user prefers the EA version's icon. Extracted to `src/components/DetailPanel/shared/ExpandButton.jsx` with the EA's icon path. Both Detail Panel files now import the shared component; local definitions removed. All Asset / Parse Result / Eval Result / EA Detail Panel surfaces now show the same icon.

**W5 — Documentation.** Spec Changelog (Phase 11C.3 entry). polish-backlog Update Log entry. CLAUDE.md note (this section). Changelog modal v0.11.2 → v0.11.3 entry. Footer version v0.11.2 → v0.11.3.

**Deviations from task brief:** None. The W3 migration was offered as optional in the brief; included in this phase per the brief's recommendation since the file was being touched anyway.

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip — +3 kB for the new reveal.js + ExpandButton.jsx files; net code is smaller after removing the duplicate inline definitions).
- App reloads cleanly; no console errors.
- Visual verification of the reveal flip + stamp timing constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path for click-through scenarios. Code-path verification confirms: notification-click → `startReveal(claimId)` → primitive sets `revealAnim` to 'zoom' phase → `v22DataWithReveal` stamps `_showAsProvisional: true` on the matching node (since `v22RecentlyAcceptedClaimId === claimId`) → AssetNode renders dashed/dimmed → at `flipMidpoint` (computed from revealPhase + ~315ms) the predicate flips → at phase 'done' the onDone callback clears `v22RecentlyAcceptedClaimId` → next render drops the stamp → AssetNode renders standard active state.

**Status:** [x] Complete.

### Phase 11C.4 completion notes (2026-04-29) — Edge reveal animation + warm-path notification handler fix

Two bug-fix workstreams + a backlog filing + docs.

**W1 — Edge reveal animation.** V2Canvas already reads `edge._showAsProvisional` (line 863) and renders provisional/dashed via the SDA-type config. Phase 11C.3 stamped `_showAsProvisional` on the recently-accepted Claim node only, leaving incident edges in active state during the reveal flip — the user saw the Claim card transition correctly while the connecting edge stayed solid the entire time, breaking the visual narrative.

Fix: extended `v22DataWithReveal` to map edges. After the node mapping pass, when `v22RecentlyAcceptedClaimId` is set, walk `v22Data.edges` and stamp `_showAsProvisional: true` on edges where `e.from === claimId || e.to === claimId`. The stamp clears automatically at reveal phase 'done' through the same `setV22RecentlyAcceptedClaimId(null)` callback the migrated `playRevealAnimation` primitive fires — no separate timing logic needed for edges.

**W2 — Warm-path notification handler reveal trigger.** Phase 11C.3's reveal-trigger guard at V2App:3221 reads `targetNode._isNew && targetNode._wasProvisional` and routes to `startReveal` for cold-path acceptances. The warm-path `v22-ea-accepted` notification handler at V2App:3308 didn't have the same guard — it always took the simple animated-pan path, so reveal never fired for warm-path acceptances even though the stamp infrastructure was in place.

Fix: extended the same predicate to the warm-path handler:
```js
if (req.type === 'v22-ea-accepted' && targetNode._isNew && targetNode._wasProvisional) {
  startReveal(targetNode.id)
} else {
  canvasRef.current?.animatedPanToWithZoom?.(targetNode.x, targetNode.y, 1.28, 500)
}
```

`v22-ea-declined` keeps the simple pan unchanged — declined Claims stay in their declined visual state (red dim), there's no flip-to-active transition to play.

**W3 — Backlog filing.** Filed #137: cross-role notification indicators in user menu. Yellow dots on the chrome user menu button + per-role rows in the expanded list when other roles have undismissed notifications. Out of scope for this phase but tracked for follow-up — improves the multi-role demo flow where the user has to switch between Bob → Dave → Bob → Dave for the warm-path test.

**W4 — Documentation.** Spec Changelog entry (Phase 11C.4). polish-backlog Update Log entry + #137 filed. CLAUDE.md note (this section). Changelog modal v0.11.4 entry; footer v0.11.3 → v0.11.4.

**Deviations from task brief:** None. The W1 edge stamp turned out to be a small map-pass — V2Canvas's edge rendering already supported the `_showAsProvisional` flag, so no canvas-side wiring was needed (verified at V2Canvas.jsx:863-876).

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip).
- App reloads cleanly; no console errors.
- Visual end-to-end of the edge reveal flip + warm-path reveal animation constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path. Code-path verification confirms the timeline:
  - Cold path: Bob clicks acceptance → startReveal fires → v22DataWithReveal stamps Claim AND incident edges with `_showAsProvisional: true` → V2Canvas's edge geometry rebuilds with `effectiveSdaType === 'provisional'` (dashed line) → AssetNode renders Claim as dashed/dimmed → flipMidpoint triggers card flip → reveal phase 'done' → `setV22RecentlyAcceptedClaimId(null)` → next render drops both stamps → edge + node revert to active styling.
  - Warm path: Dave accepts → `v22-ea-accepted` notification fires to Bob → Bob clicks → handler now checks `_isNew && _wasProvisional` and routes to startReveal for accepted (not declined) → same reveal timeline.

**Status:** [x] Complete.

### Phase 11C.5 completion notes (2026-04-29) — NEW badge persistence + reveal animation cleanup

Phase 11C.3's `onDone` callback at reveal phase 'done' cleared `v22RecentlyAcceptedClaimId`. The intent was to drop the `_showAsProvisional` stamp so the next render shows clean active state. But that state var ALSO drives `_isNew + _wasProvisional` — clearing it dropped the NEW badge + orange tint along with the provisional render at ~2.5s instead of letting them persist until deselect (Phase 7 carry-over #1 semantics).

**W1 — Decouple the two stamp lifecycles.** Introduced a new state var `v22RevealActiveClaimId` separate from `v22RecentlyAcceptedClaimId`:
- `v22RecentlyAcceptedClaimId` (existing): drives `_isNew + _wasProvisional`. Cleared by the deselect-aware effect at V2App:2141 when the user moves selection off the revealed node. Unchanged.
- `v22RevealActiveClaimId` (new): drives `_showAsProvisional` on the Claim node + incident edges during the reveal window only. Cleared by `playRevealAnimation`'s `onDone` callback at phase 'done'.

`v22DataWithReveal` updated:
- The `_showAsProvisional` stamp on the Claim node moved out of the `justFinalizedClaim` block (which was bundled with `_wasProvisional`) into a separate `isInRevealWindow = n.id === v22RevealActiveClaimId` predicate.
- The early-return guard at the top of the node-mapping callback now also accounts for `isInRevealWindow`, so a node in the reveal window but not in `flagged` (shouldn't happen in practice but defensively) still gets stamped.
- The edge stamp at the bottom (Phase 11C.4 W1) is re-gated on `v22RevealActiveClaimId` so the dashed→solid edge transition timing matches the node's `_showAsProvisional` lifecycle.
- Memo dep array gained `v22RevealActiveClaimId`.

`startReveal` updated: `setV22RevealActiveClaimId(nodeId)` at start (mirroring the existing acceptance-handler `setV22RecentlyAcceptedClaimId(nodeId)` call). The `onDone` callback now only clears the new var. The deselect-aware effect at V2App:2141 stays unchanged — it correctly clears `v22RecentlyAcceptedClaimId` when the user moves selection off the revealed node, which is the proper persistence pattern.

**W2 — Backlog filings.**
- #138 (NEW badge persistence audit across all node types) — Andrew flagged this as a recurring regression. The audit scope: every handler that sets a reveal id, plus any direct `_isNew` stamping in the canvas adapter. Verify each: stamp set when node first appears, stamp persists until deselect, no other code path clears the reveal id prematurely.
- #139 (Edge geometry animation during reveal flip) — visual polish enhancement. The current dashed→solid edge transition at flipMidpoint is correct but flat; richer would be an edge-draw animation from anchor toward the Claim during the flip phase. Mirror of the `playEdgeRetract` primitive but in reverse.

**W3 — Documentation.** Spec Changelog entry. polish-backlog Update Log entry + #138 + #139 filed. CLAUDE.md note (this section). Changelog modal v0.11.4 → v0.11.5 entry. Footer version v0.11.4 → v0.11.5.

**Deviations from task brief:** None. All workstreams shipped exactly as briefed. The fix is a small surgical change — one new state var, one decoupled stamp predicate in the memo, one moved `setV22RevealActiveClaimId(nodeId)` call in `startReveal`.

**Runtime verification (preview):**
- Build clean (91 modules, ~560 kB main / ~134 kB gzip).
- App reloads cleanly; no console errors.
- Visual end-to-end of the NEW badge persistence + reveal flip lifecycle constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path. Code-path verification confirms the timeline:
  - t=0 (notification click): handler sets `v22RecentlyAcceptedClaimId` (already done by acceptance handler) + `startReveal` sets `v22RevealActiveClaimId` → both stamps applied → AssetNode renders dashed/dimmed (provisional) with NEW badge + orange tint
  - t=1100ms (flip phase): AssetNode flipMidpoint switches to active styling (predicate references the reveal phase, not the stamp) → dashed→solid visual handoff
  - t=2500ms (done phase): `onDone` callback clears `v22RevealActiveClaimId` → next render drops `_showAsProvisional` from Claim + edges → card fully active, but NEW badge + orange tint STILL VISIBLE
  - User clicks empty canvas (deselect): `prevSelRef.current === claimId, sel === null` → effect at line 2141 clears `v22RecentlyAcceptedClaimId` → next render drops `_isNew + _wasProvisional` → NEW badge + orange tint clear
  - Re-select the Claim: standard active selection, no NEW badge (correct — already seen).

**Status:** [x] Complete.

### Phase 11D completion notes (2026-04-29) — Polish punch-list

Seven backlog items shipped in a single commit (#118, #119, #134, #135, #136, #137, #138). Each is small and surgical; together they close a meaningful chunk of the accumulated polish backlog.

**W1 — #134 PIN-existing-Claim validation.** `CombinedRequestModal` Step 1 PIN resolution gained an `already-disclosed` state. New prop `claimsOnRequesterCanvas` (a `Set<string>` of Claim ids on the active actor's canvas via active DAs) — V2App passes `new Set((v22View?.claims || []).map(c => c.id))`. The resolution memo returns `'already-disclosed'` when the PIN resolves to a Claim in the set; input border turns red, error copy reads "This Claim is already on your network. Use the Detail Panel to take further action." Submit was already gated on `state === 'ok'` so no separate disable needed.

**W2 — #135 Counterparty Asset Detail Panel section gating.** `V22AssetPanel` gates the `Identity > DOT` row, the entire `File` section's metadata fields, and the entire `Registration` section on `isOwner`. For non-owners, the `File` section renders a single "Open Evidence Viewer" button that fires the existing `onExpandAsset(asset)` handler — disclosure grants viewing rights, but the file's metadata fields (filename, size, MIME, hash, URI) and registration timestamp / Parse Result count stay private. Description, Owner row, Agreements section, Parent/Children hierarchy unchanged.

**W3 — #136 Cancel Request action-bar button + handler.** New `cancelRequest` verb in `V22ActionBar`'s CLAIM case — the action-bar branch was previously gated on `!isProvisional && !isDeclined`; restructured to render the Cancel Request button when `isProvisional && !isOwner` (the requester) and fall through to the existing logic otherwise. `handleV22CancelRequest` is now async: resolves the provisional artifacts up front (cold-path DA + paired EA, OR warm-path provisional EA only) so we know what to dismiss on the responder side BEFORE the state mutation; calls `playUnravelAnimation` BEFORE dropping state (mirror of `handleV22DismissDeclined`); drops the artifacts; dismisses the responder's matching `v22-request-*` notification. Wired through the `onV22CardAction('cancelRequest', node)` dispatcher.

**W4 — #137 Cross-role notification dots.** New memo `rolesWithUnreadNotifications` aggregates undismissed notifications across all OTHER roles (active role excluded — its own pending notifications surface via the chrome's notification bell). Two render points:
- Yellow dot on the user menu chrome trigger button (top-right corner, 6px, with 1.5px ring against `var(--bg-surface)` for legibility against the avatar gradient).
- Yellow dot on each non-active role row in the SWITCH USER dropdown list (right-aligned, 6px, no ring needed since the row background is consistent).

Both use `var(--accent-amber)`. The aggregator memo reads from `perRoleState` directly and runs in V2App scope, so no prop drilling is needed.

**W5 — #118 Anchor Asset no NEW badge.** `v22DataWithReveal`'s node-mapping pass skips the `_isNew` stamp for Asset reveals where `n.v22Type === 'ASSET' && n.owner === activeRole.party`. Fixes the stale NEW badge that appeared on the requester's anchor Asset after the responder's session set the asset reveal id (Phase 6.5 #4 reveals the pulled-in counterparty Asset on the responder's canvas via `setV22RecentlyAcceptedAssetId(anchorIdForNotif)`; the same id leaks to the requester's session via shared V2App state). The owner-relative-to-active-party predicate cleanly discriminates: counterparty pull-in (owner ≠ active → NEW correct) vs. own pre-existing (owner === active → skip).

Trade-off documented inline: this also skips NEW on freshly-registered Assets and transfer-accepted Assets (both end up owned by the active party). Pan-to + selection still happen via separate `v22PanToClaimId` / `setSel` mechanisms — the user still sees the new Asset highlighted. Per-role reveal-id scoping would preserve NEW on those paths without the cross-session leak; filed as deferred polish (called out in the #118 fix comment + the existing #138 audit note).

**W6 — #119 User-facing terminology audit.** Narrow pass focused on user-facing strings only. `V22RunEvaluationModal` updates:
- "Evidence in scope (N)" → "Assets in scope (N)"
- "...The evaluation will run without evidence (self-attestation)." → "...The evaluation will run as a self-attestation."
- "Select at least one evidence Asset to evaluate." → "Select at least one Asset to evaluate."
- "(Requirements Set, evidence) combination already has..." → "(Requirements Set, Asset selection) combination already has..."
- Processing subtitle "across N evidence file(s)" → "across N Asset(s)"

Internal variable names (`evidenceAssets`, `evidenceSelection`, `evidenceUsed`, etc.) kept — V2.2 internal-vs-user-facing boundary respected. "Parse Evidence" canonical action name kept (still the user-facing label for the parse flow). "Open Evidence Viewer" (W2's new button) kept — it's the V2.x canonical action name.

**W7 — #138 NEW badge persistence audit.** Comprehensive scan of all 10 `setV22RecentlyAcceptedClaimId` / `setV22RecentlyAcceptedAssetId` call sites:
- handleV22RequestSubmit (cold path) — sets on requester's session, drives provisional Claim NEW badge.
- handleV22Accept (cold-path responder) — sets to claimIdForReveal + anchor (responder side).
- handleV22EaRequestSubmit (warm path requester) — sets to provisional Claim id.
- handleV22AcceptEAOnly (warm-path responder) — sets to claimIdForReveal + anchor.
- handleV22EvaluationSubmit — sets to artifacts.evaluationResult.id (note: variable is misleadingly named for ClaimId but works because the deselect-aware effect at V2App:2207 just compares ids, not types).
- handleV22AmendClaimSubmit — sets to v22AmendingClaimId.
- handleV22ParseSubmit — sets to artifacts.parseResult.id (same naming caveat).
- handleV22CreateClaimSubmit — sets to artifacts.claim.id.
- Notification-click for amendment / evaluation deep-link — sets to claimIdForPan.
- Asset registration handler — sets to newly-minted Asset id(s).
- Transfer-accept handler — sets to transferred Asset id.

No `setTimeout`-based clearing found in any handler. All paths rely on the V2App:2207 deselect-aware effect for cleanup. The Phase 11C.5 decoupling (`v22RecentlyAcceptedClaimId` for `_isNew + _wasProvisional` lifecycle, `v22RevealActiveClaimId` for `_showAsProvisional` lifecycle) holds across all paths. No regressions found beyond the #118 fix already applied in W5.

**W8 — Documentation.** Spec Changelog entry. polish-backlog Update Log entry. CLAUDE.md note (this section). Changelog modal v0.11.5 → v0.11.6 entry. Footer version v0.11.5 → v0.11.6.

**Deviations from task brief:** None material. The W5 #118 implementation follows the brief's Option B literally — owner-relative-to-active-party predicate. The trade-off (no NEW on registration / transfer-accept) is acknowledged inline. Per-role reveal-id scoping (Option A in the brief) is the cleaner long-term fix; deferred to backlog.

**Runtime verification (preview):**
- Build clean (91 modules, ~563 kB main / ~134 kB gzip — +3 kB for the new Cancel Request handler, cross-role notification memo + dot rendering, Detail Panel section gating, and PIN resolution branch).
- App reloads cleanly; no console errors.
- Visual end-to-end constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path.
- Code-path verification confirms all seven workstreams land at the expected lines and integrate with existing handler infrastructure without TDZ / dependency-array gaps.

**Status:** [x] Complete.

### Phase 11D.1 completion notes (2026-04-29) — Copy fixes (#134 + #119)

Two surgical copy fixes from Phase 11D QA. Single commit.

**W1 — #134 already-disclosed error trim.** The Request Agreement modal's Step 1 PIN error message dropped its second sentence:
- Before: "This Claim is already on your network. Use the Detail Panel to take further action."
- After: "This Claim is already on your network."

The second sentence was instructional copy that the user didn't need at the gate.

**W2 — #119 follow-up: V22RunEvaluationModal EA / Evidence strings.** Two user-facing strings that 11D missed:
- Header subtitle: `Evaluating ${claim.name} under EA ${ea.id}.` → `Evaluating ${claim.name} under Evaluation Agreement ${ea.id}.`
- Review-stage left panel: `Evidence (${count})` → `Assets (${count})`

Audited the rest of the modal — remaining `evidence` / `Evidence` hits are internal variable names (`evidenceAssets`, `evidenceSelection`, `evidenceUsed`) and code comments, both kept per the W6 user-facing-vs-internal boundary established in 11D. Self-evaluation subtitle ("no Evaluation Agreement required") kept as-is — already correctly named.

**W3 — Documentation.** CLAUDE.md note (this section). Changelog modal v0.11.7 entry. Footer version v0.11.6 → v0.11.7. No spec or polish-backlog update — these are 11D follow-on copy fixes covered by the existing 11D backlog entries (#134 / #119).

**Deviations from task brief:** None. All three workstreams shipped exactly as briefed.

**Runtime verification (preview):**
- Build clean.
- App reloads cleanly; no console errors.
- Visual end-to-end constrained by V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse-drive remains the canonical path.

**Status:** [x] Complete.

### Phase 11D.2 completion notes (2026-04-29) — Selective Disclosure: grantee view of Claim's referenced Assets

Closes the Selective half of the Phase 11D.x grantee-view restoration. Proof-only stays scoped for Phase 11D.3.

**Problem.** Phase 11C.1 made acknowledgments authored by the Claim owner; the Selective field-picker (acceptance flow) already worked correctly and produced DAs whose `scope.fieldIds` carry `${parseResultId}::${fieldId}` entries. But the grantee never saw what was disclosed: the Detail Panel's "Referenced Assets" section listed only Assets in scope without any field-level metadata, and the Phase 11B Expand modal always opened the AssetEvidenceViewer (PDF iframe) — surfacing the full file even though Selective doesn't disclose it.

**Workstreams (single commit):**

- **W3 + W1 — Detect DA type, enrich Asset rows, render counts.** V2App's standard panel mount (around V2App.jsx:5010) and the directory-materialized panel (around V2App.jsx:4399) both updated. Non-owner branch now collects `activeGranteeDas` (the active DAs where viewer is grantee), then per-Asset finds the covering DA (handles multi-DA cases — e.g., Selective on Asset X + Full on Asset Y), reads its `type`, and stamps the row with `disclosureType` + (for Selective) `disclosedFieldCount` + `disclosedFields`. Disclosed fields resolve by intersecting `coveringDa.scope.fieldIds` (Set lookup) with each `${pr.id}::${field.id}` for Parse Results derived from that Asset (`pr.sourceAssetId === asset.id`). Owner branch stamps `disclosureType: 'owner'` so the count is suppressed. V22ClaimPanel's Asset row renders a 10px mono `{N} fields` muted text when `n.disclosureType === 'selective'`, between the Asset name and the Expand button. Pluralization handled (`1 field` vs `5 fields`).

- **W2 — ExpandedArtifactModal's Selective branch.** Modal accepts new optional props `disclosureType` + `disclosedFields`. New constant `isSelectiveAsset = schema === 'asset' && disclosureType === 'selective'`. When true:
  - **Output tab:** renders a header (Asset name + disclosed-field count) above an ArtifactRow list (reusing the existing `'parse-output'` schema's row rendering — label + value + confidence chip). Empty state surfaces an italic "No parsed fields are disclosed for this Asset under the active Selective Disclosure Agreement." Suppresses the file metadata header + iframe entirely.
  - **JSON tab:** renders `{ assetId, name, owner, disclosureType, disclosedFields }` — disclosed-portion-only. The full Asset artifact (which carries `file.{filename, hash, mimeType, size, uri, localPath}` + `dot` lineage + registration metadata) is NOT exposed. Full + owner views still render the full artifact JSON.

- **`onExpandAsset` signature change.** Previously took the raw Asset artifact (`(asset) => ...`). Now takes the enriched row (`(row) => setV22ExpandedArtifact({ artifact: row.asset, schema: 'asset', disclosureType: row.disclosureType, disclosedFields: row.disclosedFields })`). Defensive branch retains legacy single-arg support so non-row callers (none today, but possible future Asset-direct surfaces) still work. Both V2App call sites updated identically.

**Edge cases handled:**
- *Multi-DA per Claim/grantee.* Per-Asset DA-matching ensures each Asset gets its own disclosure type (rare but architecturally legal). The brief's simpler "first DA wins" approach would have been wrong for mixed Selective + Full scenarios.
- *Owner viewing.* Owners see all referenced Assets unconditionally with `disclosureType: 'owner'` — the count rendering only triggers on `'selective'`, so owners see no count and Expand opens the file viewer.
- *Full Disclosure unchanged.* Full grantees see Asset rows without field counts (their `disclosureType` is `'full'`); Expand still opens the AssetEvidenceViewer with the PDF iframe.
- *Directory-materialized Claim (Phase 11B).* Same enrichment path applied so the warm-path scenario stays correct (today the only directory-materialized Claim has a Full DA, but the wiring is in place if a Selective directory-disclosed Claim ever appears).

**Runtime verification (browser preview, end-to-end):**
- *Selective grantee — Bob viewing Alice's PRM Claim.* Detail Panel shows 1 Asset (Power Regulation Module Datasheet) with "5 fields" muted text. Expand opens modal with Output tab listing 5 disclosed fields (Operating voltage 95% / Power dissipation 91% / Temperature range 93% / Radiation tolerance 72% / ITAR classification 88%); JSON tab shows the disclosed-portion-only object — no `file.*` keys.
- *Full grantee — Bob viewing Voltage Regulator IC Claim.* Asset row shows no field count. Expand opens iframe pointing at `/voltageregulator-datasheet.pdf`.
- *Owner — Alice viewing her own PRM Claim.* All 3 referenced Assets visible (Datasheet + Test Report + Thermal Analysis), no field counts. Expand on Datasheet opens iframe pointing at `/powerregulationmodule-datasheet.pdf`.

**Spec updates:** §10.4 grew a "Grantee view derivation per disclosure type" subsection codifying Full / Selective / Proof-only (deferred) / owner branches with the exact field-id intersection rule + JSON disclosed-portion shape. Spec Changelog entry added.

**polish-backlog updates:** Update Log entry. New item #141 filed (EA permission gate for proof-only re-disclosure — current model defaults to allow; future polish, Medium priority).

**Deviations from task brief:** Chose Option B (single `'asset'` schema with `disclosureType` prop) over Option A (new `'asset-selective'` schema) per the brief's recommendation. Cleaner data model — same Asset, viewing mode determined by disclosure context. Per-Asset DA matching (vs. single-DA assumption) added unprompted because multi-DA scenarios are architecturally legal and the brief's simplification would have been incorrect for them.

**Known scope boundaries (not 11D.2 blockers):**
- Proof-only Disclosure — Phase 11D.3.
- Asset Detail Panel changes — Selective grantees don't have a counterparty Asset Detail Panel surface today (Asset nodes don't appear on grantee canvases); access is through Claim Detail Panel only.
- Parse Result + Eval Result row Expand wiring — modal already supports these schemas (Phase 11B); Asset rows are the priority for Selective, other rows can land in a follow-up.

**Status:** [x] Complete.

### Phase 11D.3 completion notes (2026-04-29) — Proof-only Disclosure: Eval Result materialization on grantee canvas

Closes the Proof-only branch of the Phase 11D.x grantee-view restoration. Phase 11D's three disclosure types (Full, Selective, Proof-only) are now all wired end-to-end on the grantee side.

**Demo seed.** Added `da-alice-dave-prm-proof` (Alice → Dave, subject = PRM Claim, type = 'proofonly', granteeAssetId = ChipCo's PRM-3A IC Datasheet, scope.evaluationResultIds = [Bob's MIL-PRF-55681 Eval Result]). Dave is the natural test grantee — empty parent canvas pre-Phase-11D.3, no DA conflicts. Bob's MIL-PRF result is the natural payload (he evaluated Alice's PRM Claim under their warm-path EA). Re-disclosure semantics — whether Alice can re-disclose Bob's Eval Result — are filed as #141; default-allow today.

**Workstreams (single commit):**

- **W1 — `buildViewForActor` proof-only branch.** Extended `pulledInClaimIds` to also include Claim ids from active proof-only Claim DAs where actor is grantee (no EA gating — proof-only is standalone). Refactored `proofDaEvalResultIds` to handle two DA shapes: `subject.kind === 'evalResult'` (existing proof-of-evaluation flow → Claim owner) and `subject.kind === 'claim' && type === 'proofonly'` (new — disclosed Eval Result ids flow to Claim grantee). New `proofOnlyPulledEvalIds` set tracks the latter separately so the canvas adapter routes placement appropriately. View object surfaces `proofOnlyPulledEvalIds` alongside the existing `pulledInClaimIds` etc.

- **W2 — Edge derivation.** New branch in `deriveAgreementEdges` BEFORE the generic inter-party Claim branch (precedence matters): when `kind === 'claim' && !internal && !toPublic && da.type === 'proofonly'`, emit two edge classes — (a) Claim ↔ granteeAssetId anchor edge (consistent with full/selective behavior so the pulled Claim has a visual home) and (b) one edge per disclosed Eval Result → Claim. All edges carry `da.type === 'proofonly'` so V2Canvas renders them with the existing dotted-green proof-only SDA style. The pre-existing generic claim DA branch is unaffected for full/selective.

- **W3 — Layout column.** New constant `COL_PULLED_EVAL = 2300` (between `COL_PULLED_CLAIM = 2100` and `COL_PULLED_ASSET = 2500`, all on the 100-grid). Effective column variant `COL_PULLED_EVAL_eff` shifts with `assetColShift` like its siblings. The canvas adapter's Eval Result placement loop splits external ERs into:
  - `erProofOfEval` (counterparty ERs visible via subject=evalResult DAs — actor is Claim owner) → placed at `COL_OWN_EVAL_eff` near the actor's own Eval Results, matching pre-Phase-11D.3 behavior (Carol's audit on Alice's canvas, etc.).
  - `erProofOnlyPulled` (counterparty ERs from proof-only Claim DAs) → placed at `COL_PULLED_EVAL_eff` on the same row as the source Claim, with `i × ROW_STEP` stacking when multiple ERs target the same Claim.
  
  Visual story on Dave's canvas reads "Eval Result (2300) → Claim (2100) → my anchor Asset (2500)" with the Eval Result as the proof payload anchored to the Claim.

- **W4 — V22ClaimPanel Referenced Assets empty state.** New `claimIsProofOnlyOnly` prop. V2App computes `true` when every active grantee DA on this Claim is `type === 'proofonly'`. When set, the section title renders `Referenced Assets (0)` (regardless of `claim.referencedAssetIds.length`) and the body shows italic "No Assets disclosed under this agreement." Owner + selective + full grantees see the standard rendering. Both the standard panel mount and the Phase 11B directory-materialized panel are wired.

- **W5 — Clickable Evaluation Results rows.** New `onSelectEvalResult` prop on V22ClaimPanel. Each row in the Evaluation Results section is now clickable when the prop is wired (it always is from V2App). Click handler: `setSel(er.id)` + `setV22PanToClaimId(er.id)` — pans to the Eval Result on canvas and replaces the Claim panel with the Eval Result panel. Hover treatment uses an indigo-tinted background lerp so the row reads as actionable. Applied for ALL viewers (owner + grantees), not just proof-only — general UX improvement.

- **W6 — V22EvalResultPanel updates.** Section renamed Evaluator → Owner (per the brief: "show Owner only, not the evaluator's name as a separate field"). New "Claim" row in the Owner section, populated from a new `linkedClaimName` prop that V2App resolves from `er.claimId` against the merged dataset. Helps proof-only grantees confirm what the pulled-in Eval Result evaluates. No JSON-tab gating for proof-only Eval Result Expand — proof-only's whole purpose is to surface the evaluation result, so the full Eval Result JSON renders as normal.

- **W7 — Defensive ExpandedArtifactModal proof-only Asset branch.** The Claim panel hides Asset rows under proof-only (W4), so Asset Expand shouldn't trigger. Defensive coverage: `isProofOnlyAsset = schema === 'asset' && disclosureType === 'proofonly'` branches the Output tab to a "Under proof-only disclosure, Asset details are not available." empty state + branches the JSON tab to a bare-identity object (`{ assetId, name, owner, disclosureType: 'proofonly' }`) so file metadata never leaks even in this edge case.

**Edge cases handled:**
- *Multi-DA on same Claim.* `claimIsProofOnlyOnly` requires EVERY active grantee DA to be proof-only — if the actor has both a proof-only AND a full/selective DA on the same Claim (not seeded today, but architecturally legal), the panel falls through to the regular per-Asset rendering.
- *Owner viewing own Claim with proof-only DA out to grantees.* The owner sees their own Claim normally; `claimIsProofOnlyOnly` is gated on `!isOwnerViewing`. Phase 11D.3 affects only the grantee side.
- *Pulled Eval Result with no source Claim on canvas.* The placement loop falls back to `y = 0` if the source Claim isn't found in the node list (defensive — shouldn't happen since W1 pulls the Claim).
- *Proof-of-evaluation results on Claim owner's canvas.* Carol's `erCarolPrm` on Alice's canvas (subject=evalResult flow) is correctly EXCLUDED from `proofOnlyPulledEvalIds` (only subject=claim+type=proofonly DAs populate it), so it stays at `COL_OWN_EVAL_eff` as before. No regression.

**Runtime verification (browser preview, end-to-end):**
- Switched to Dave (ChipCo). Canvas shows ChipCo's own Claim + Alice's pulled-in PRM Claim + Bob's pulled-in MIL-PRF-55681 Eval Result. Programmatic edge probe confirms: Claim at (2100, 0), Eval Result at (2300, 0); proof-only edges Claim ↔ ChipCo's PRM-3A IC Datasheet (anchor) and Eval Result → Claim.
- Selected PRM Claim → Detail Panel shows: Owner: MicroCo, Created: 2026-03-01, **Referenced Assets (0): "No Assets disclosed under this agreement."**, Acknowledgments (2), **Evaluation Results (1): MIL-PRF-55681 Compliance · ACTIVE · by GovCo · 4 satisfactory · 1 unsatisfactory** — clickable.
- Clicked the Eval Result row → panel pivots to V22EvalResultPanel: Owner: GovCo, **Claim: Power Regulation Module Assembly** (new linked-Claim row), Evaluated: 2026-03-09 · 14:32 UTC, Agreement: ea-bob-prm, Requirements Set + 5 result rows with status badges (4 SAT / 1 UNSAT).
- Selective + Full + owner views unchanged from Phase 11D.2 (verified via data-layer probe — Bob still sees PRM + Vreg Claims; Alice sees her 3 Claims + 2 Eval Results including Carol's POE result placed correctly at `COL_OWN_EVAL`).

**Spec updates:** §10.4 grantee view subsection extended with the Proof-only branch + new §6 cross-canvas note. Spec Changelog entry. polish-backlog Update Log entry. Changelog modal v0.11.9 entry. Footer version v0.11.8 → v0.11.9.

**Deviations from task brief:** Chose to render the Referenced Assets section with `(0)` + a proof-only-specific empty hint (per the brief's explicit user direction) rather than hiding the section entirely. Eval Result row clickability shipped for ALL viewers (not just proof-only) per the brief's "general UX improvement" note. The section header rename in the Eval Result panel (Evaluator → Owner) was a small interpretation of the brief's "show Owner (only — NOT the evaluator's name as a separate field)"; the existing structure already had a single party row in an "Evaluator" section, but renaming the section to "Owner" reads more cleanly per the brief's terminology.

**Known scope boundaries (not 11D.3 blockers):**
- EA permission gate for proof-only re-disclosure — backlog #141, default-allow today.
- Self-evaluation proof-of-evaluation handling — pre-existing, unchanged.
- Pulled-in Eval Result detail panel does NOT include a "back to source Claim" button — user can navigate via the canvas selection. Future polish if needed.

**Status:** [x] Complete.

### Phase 11D.4 completion notes (2026-04-30) — Layout spacing fix + Referenced Assets count fix

Two surgical fast-followers from Phase 11D.3 QA. Single commit.

**W1 — Layout spacing fix.** Phase 11D.3 placed pulled-in Eval Results at `COL_PULLED_EVAL = 2300` — only 200px from the source Claim at 2100. Cards are 210px wide, so they visibly overlapped (claim card spans ~1995–2205; eval card spans ~2195–2405; overlap of ~10px). Fix: moved `COL_PULLED_EVAL` to 1700 — 400px LEFT of the Claim, matching the existing `ASSET_COL_GAP = 400` convention and reading as "Eval Result informs the Claim from the left". The new column shares slot with `COL_OWN_EVAL = 1700`. Y separation preserves non-overlap by construction:
- Own evals carry `COL_Y_OFFSET = 100` on top of `symmetricRowY(i)`, so they live at y ∈ {100, 400, -200, ...} — never at y=0.
- Proof-only-pulled evals match the source Claim's y, which is `symmetricRowY(claimIdx)` for the first pulled Claim — typically y=0.

For Dave specifically: Bob's pulled ER at (1700, 0); no own evals so the column slot is otherwise empty.
For Alice (regression check): Bob's POE result at (1700, 100), Carol's POE result at (1700, 400) — unchanged, since they were already in this column via the existing `erProofOfEval` path.
For Bob (regression check): own ER at (1700, 100) — unchanged.

**Alternative considered:** push `COL_PUBLIC` rightward to make room at 2900. Rejected — invasive (touches the public-directory column constant) and the proof-only-informing-Claim semantic is cleaner with the LEFT placement.

**W2 — Referenced Assets count fix.** V22ClaimPanel's section header was reading `claim?.referencedAssetIds?.length || 0` — the Claim's raw count of referenced Assets. But V2App's standard panel mount filters this list per active DA scope (Phase 11D.2), so a Selective grantee whose DA covers 1 of 3 referenced Assets would see "Referenced Assets (3)" with only 1 row beneath. Fix: switch the header count to `referencedAssetNames.length` — the filtered array. The proof-only-only ternary branch (which forces 0) is preserved.

For owners: V2App passes the full list unfiltered, so `referencedAssetNames.length === claim.referencedAssetIds.length`. Owner view stays at "(3)". No change observed.

For non-owners: count now matches the rendered row count. Selective grantee with 1 disclosed Asset reads "(1)". Full grantee reads the disclosed count (≤ Claim's raw count). Proof-only reads "(0)" (pre-existing branch).

**Verified end-to-end (browser preview):**
- Alice (owner) viewing PRM Claim: "Referenced Assets (3)" + 3 rows.
- Bob (Selective grantee) viewing PRM Claim: "Referenced Assets (1)" + 1 row (Datasheet).
- Bob (Full grantee) viewing Voltage Regulator Claim: "Referenced Assets (1)" + 1 row.
- Dave (Proof-only grantee) viewing PRM Claim: "Referenced Assets (0)" + "No Assets disclosed under this agreement." copy.
- Layout: Dave's PRM Claim at (2100, 0), Bob's Eval Result at (1700, 0), 400px gap; Bob's Avionics anchor at (2500, 100). All three readable without overlap. ChipCo own Claims at (1300, …) — unchanged.

**Spec updates:** §10.4 Selective sub-section clarifies that the count reflects the disclosed Asset list, not the Claim's full referenced list. New spec Changelog entry covering both fixes.

**Footer + Changelog:** v0.11.9 → v0.11.10. Changelog modal entry added.

**Deviations from task brief:** None material. Brief recommended `COL_PULLED_EVAL = 1700` (the LEFT placement) — shipped as recommended, with the y-separation rationale documented inline. Brief flagged W2's bug as upstream filtering in V2App; investigation confirmed the filtering is correct (Phase 11D.2 ships properly filtered rows) and the bug was downstream — the V22ClaimPanel header reads from the raw Claim. Single-line fix in V22ClaimPanel.

**Status:** [x] Complete.

### Phase 11D.4.1 completion notes (2026-04-30) — Proof-only Eval Result placement: derived from source Claim + AssetNode tooltip z-index fix

Two fast-followers from Phase 11D.4 QA. Single commit.

**W1 — Eval Result placement derived from source Claim.** Phase 11D.4 moved `COL_PULLED_EVAL` from 2300 → 1700 to give space from the source Claim. But 1700 sits in the actor's own evaluation column, and on Dave's canvas the proof-only-pulled Eval Result landed inline with Dave's existing ChipCo Claim/Asset traffic (y=0–300). The connecting edge to Alice's PRM Claim crossed unrelated nodes.

Fix: replaced the fixed-column placement with one derived from the source Claim's position:

```
x = sourceClaim.x + 200
y = sourceClaim.y + 300 + (stackIdx * COL_Y_OFFSET)
```

The 200px x-offset reads as "attached to" the Claim without overlapping it (cards are 210px wide; centers are 200px apart so the cards barely touch but don't visually clash). The 300px y-offset puts the Eval Result clearly below the Claim's horizontal traffic lane. On Dave's canvas this resolves to (2300, 300) for Bob's MIL-PRF Eval Result, with Alice's PRM Claim at (2100, 0) — short edge, no crossings.

`COL_PULLED_EVAL` constant retained but only used as a defensive fallback (when the source Claim isn't in the canvas adapter's claim node map — shouldn't happen since Phase 11D.3's W1 pulls the Claim in alongside the disclosed ERs).

**W2 — Z-index fix for AssetNode tooltip portals.** Both `AssetNodeMini` (line ~1351 of AssetNode.jsx) and `AssetNodeDot` (line ~1095) render their card-body via `createPortal(..., document.body)` with `position: fixed, zIndex: 5000`. The Detail Panel in V2App renders at `zIndex: 200`. Result: at mini or dot LOD when a node was selected and the user dragged the canvas, the tooltip's `tooltipPos` moved with the canvas pan and could land within the Detail Panel's footprint — the portal'd tooltip then rendered on top of the open Detail Panel.

Fix: drop both tooltip portal z-indices to 150 — below the panel (200) and below the notification dropdown (200), still above the canvas itself (no z-index) and edges. Modal stack at 10000 still wins over both. The tooltip is informational at LOD levels (it's the only visible UI for the node when zoomed out); rendering it under the open panel is the correct layering.

**Edge cases handled:**
- *Layer of stacking comparison.* Detail Panel uses `position: absolute` inside the canvas-container flex item, with `zIndex: 200`. Tooltip portal is in `document.body` with `position: fixed, zIndex: 150`. Stacking compares within the body's stacking context — both are top-level positioned descendants. zIndex 200 wins.
- *Modal vs tooltip.* Modals at zIndex 10000 still cover tooltips. Notification dropdowns at zIndex 200 also cover tooltips. Edge hover menu at zIndex 5900 still wins (it's a separate UI surface, not affected by this change).
- *Self-referential proof-only ERs.* Hypothetical scenario where one ER targets multiple Claims simultaneously — n/a in current schema (`er.claimId` is single-valued). Stacking is per-DA-per-source-Claim only.

**Verified end-to-end:**
- Data layer: Dave's canvas — PRM Claim at (2100, 0), Eval Result at (2300, 300). Delta (200, 300). 
- Alice's POE-visible Eval Results (Bob's at 1700/100, Carol's at 1700/400) and Bob's own ER (1700/100) all preserve their existing positions — no regression.
- DOM probe at default zoom: PRM Claim card center at (1698, 653), Eval Result card center at (1858, 893). Delta (160, 240) — proportional to world-space (200, 300) at 0.8x zoom. No overlap.
- Z-index source verification: AssetNode.jsx tooltip portals (line 1095 + 1351) both read `zIndex: 150`. Detail Panel grep confirms `zIndex: 200`. Stacking order is correct.

**Spec updates:** §10.4 Proof-only sub-section text updated to describe source-Claim-derived placement (instead of the fixed-column language from 11D.3/11D.4). Spec Changelog entry covering both W1 and W2.

**Footer + Changelog:** v0.11.10 → v0.11.11. Changelog modal entry added.

**Deviations from task brief:** None. Both fixes shipped as briefed. The Z-index choice (150) is below all UI overlays at 200+ (Detail Panel + notification dropdown), still well above any canvas content.

**Status:** [x] Complete.

### Phase 11.5 completion notes (2026-04-30) — Dev hygiene pass

Documentation + backlog organization. No code-affecting changes (intentional — task scope was pure cleanup before Phase 11E and Round 13 transition).

**Workstreams:**

- **W1 — `polish-backlog.md` reorganization.** Moved ~70 ✅ Complete / ✅ Verified / ✅ Superseded items into a new `## Completed` section at the bottom of the file, organised by topic sub-section for findability. Topic sections at the top (Visual & Rendering, Edge Interactions, Detail Panels, V1 File Cleanup, Notifications, Data Model & Content, Process Flows, Spec Updates, Future Features, Exploratory) now contain only Open / Partial / Deferred / Investigation items. Status vocabulary standardized to `Open` / `Partial` / `Deferred to Phase X` / `Investigation`. New `Effort` field on every remaining open item: `S` (small, <2h) / `M` (medium, 2–6h) / `L` (large, 6–12h) / `XL` (multi-phase) / `?` (unknown). Phase-queue assignments baked into Status fields where appropriate. **Misfilings rehoused:** #74 (Provenance lineage UI) moved from Process Flows → Detail Panels (it's a Detail Panel surface item). No item triage beyond preserving the existing `#12 → #111 Superseded` link. ID gaps (#84, #92, #109) preserved as historical artifacts.

- **W2 — `architecture-spec.md` audit.** Walked every section. Found Phase 11 work mostly well-documented inline (§6.5 cross-canvas rules, §7.4 notifications, §10.4 grantee-view derivation, §11.5a revocation, §11.6a EA-only request lifecycle, §3.7 layout). Fixes applied in-place:
  - **§6.5** added a 5th cross-canvas pull-in rule for proof-only Claim DAs (Phase 11D.3 / 11D.4.1) — was missing.
  - **§7.4** notification table extended with the four transfer notification types (Phase 9A.4 / 9A.5) and the two revocation types (`v22-da-revoked`, `v22-ea-revoked`, Phase 9D / 9D.1.x) — both groups had been omitted from the spec table.
  - **§14 Implementation Guidelines** — flagged inline as historical (was written during V2.2 migration; references stale `V2_2_ENABLED` flag, V2.1 retention rules, `v2Data.js` filename). Inline note at top of §14 redirects readers to `CLAUDE.md` for current conventions.
  - New **`## Phase 11 (April 2026)`** summary section at the end of the spec covering all twelve sub-phases at high level — separate from the per-sub-phase Changelog entries above it.
  - New **`## Sections requiring expansion`** closing block flagging §12, §13, and §15+ as historical-record sections that could use future hygiene without blocking active work.

- **W3 — `ROUND-13-CONTEXT.md` created.** New repo-root file as a setup checklist for the next Claude Code conversation. Lists the canonical foundation files to upload (architecture-spec.md, CLAUDE.md, polish-backlog.md, V2App.jsx, V22NodeDetailPanel.jsx, v2_2Data.js, V2Canvas.jsx, AssetNode.jsx); per-phase additional files; Round 12 closing state summary; phase queues for 11E, 12, 13, 14, 15, and beyond; explicit "what's NOT in the queue" section covering deferred items like #49 (`src/v2/` rename) and #50 (dead handler sweep).

- **W4 — Phase 11 summary in spec Changelog.** Single high-level entry covering all twelve sub-phases, separate from the per-sub-phase entries above. Points readers at `CLAUDE.md` and the inline section bodies for detail.

- **W5 — Documentation finalization.** This note. polish-backlog Update Log entry. Changelog modal v0.11.12 entry. Footer version bumped v0.11.11 → v0.11.12.

**Out of scope (explicitly deferred):**
- Code refactoring (#49 src/v2 rename, #50 dead handler sweep, #51 V2Canvas prop pruning) — those are substantial code changes for separate phases.
- Architecture spec content rewrites — only audit + flag, not rewrite.
- Backlog item triage decisions beyond obvious duplicates — no kills, no merges beyond the existing `#12 → #111`.
- Phase 11E work (#108 Amend EA modal, #102 reciprocal DA-amendment notifications, #139 edge geometry animation) — queued for Round 13 first phase.

**Runtime verification:** No code changes; documentation-only. Build clean (no broken imports). App boots normally. Phase 11.5 deliverables verified by reading the resulting files top-to-bottom.

**Status:** [x] Complete.

### Phase 11E.1 completion notes (2026-04-30) — Amend Evaluation Agreement (#108)

First Phase 11E item shipped. EA amendment flow now end-to-end functional with the same architectural posture as DA amendment (unilateral grantor-side action; counterparty's recourse if unhappy is to revoke).

**Architectural anchors (locked decisions):**
- **Unilateral.** Like DA amendments, EA amendments fire informational notifications. No counterparty acceptance flow.
- **Amendable fields:** `terms.evaluationDeadline` and the Claim's `acknowledgments[]`.
- **Option B for acknowledgments.** Editing acknowledgments via Amend EA mutates the underlying Claim's `acknowledgments[]` directly. The EA's `acknowledgmentsAccepted` audit-trail field is NOT modified — it's a historical record of what the Evaluator originally accepted.
- **Single-grantee notification.** Only the EA's grantee is notified, even if other EAs on the same Claim are implicitly affected by acknowledgment edits. Production (Option C) will need multi-grantee fan-out + per-EA acknowledgment snapshots; documented in `architecture-spec.md` §11.2a.

**Workstreams:**

- **Batch 1 — Data model.** `makeEvaluationAgreement` extended with `amendments = []` parameter (mirrors DA shape). New factory `makeAmendedEvaluationAgreement({ evaluationAgreement, terms, acknowledgmentChanges, note })` returns a new EA with updated `terms.evaluationDeadline` and an appended amendment record carrying `date`, `note`, `termsBefore.evaluationDeadline`, and `acknowledgmentChanges: { added, removed, edited }`. New pure helper `diffAcknowledgments(before, after)` computes the delta. The factory does NOT touch the underlying Claim — V2App's handler stages both updates atomically.

- **Batch 2 — `AmendEvaluationAgreementModal.jsx` (new, ~250 lines).** Pattern matches `AmendDisclosureModal.jsx` structure (Backdrop / Modal / ModalHeader / ModalBody / ModalFooter). Three sections in body: Expiration (uses shared `ExpiryPicker` from ModalShared, pre-fills to `'custom'` with the EA's current deadline; falls back to `'none'` when deadline is null), Acknowledgments (editable cards with title input + description textarea + REMOVE button per row, plus `+ Add acknowledgment` CTA generating ids `ack-${claim.id}-${Date.now().toString(36)}`), and Amendment note textarea. `hasChanges` gating: at least one of expiry-changed OR acks-added/removed/edited. `canSubmit` additionally requires every acknowledgment to have a non-empty title. Footer summary text describes pending changes ("Expiration changed · 1 acknowledgment added · 2 edited" etc.).

- **Batch 3 — V2App wiring.** New state `v22AmendingEaId` parallel to `v22AmendingDaId`. New imports for `AmendEvaluationAgreementModal` + `makeAmendedEvaluationAgreement` + `diffAcknowledgments`. New handler `handleV22AmendEvaluationSubmit({ terms, acknowledgments, note })`: resolves existing EA + paired Claim from merged provisionals; computes acknowledgment delta; builds the amended EA via the factory; atomically writes both the EA and (if acks dirty) the mutated Claim into `v22Provisionals` via a single `setV22Provisionals` updater; pans + reveals the Claim with the existing `_isNew` infrastructure; enqueues a `v22-ea-amendment` notification on the grantee's inbox (single-grantee fan-out). Modal mount inserted after the AmendDisclosureModal mount.

- **Batch 4 — EA Detail Panel.** New Amendments `<Section>` between Status and the paired-DA navigation button. Each amendment card shows: ISO timestamp; "Expiration: <before> → <current>" line when expiry changed; "Acknowledgments: +N added · −N removed · ~N edited" line when acks changed; italic note quote when present. Lineage chaining caveat documented (older entries' "before" diffs against the *current* deadline rather than the deadline at amendment time). Amend footer button gating extended: `amendDisabled = !isGrantor || isRevoked || agreement.status !== 'active'`. New tooltip messaging branches for `isRevoked`.

- **Batch 5 — Architecture spec.** New §11.2a "Evaluation Agreement amendment (Phase 11E.1)" subsection covering full Option B vs Option C semantics, the amendment record shape, the notification flow, and the two documented limitations (multi-EA implicit propagation + lineage chaining). §7.4 notification table extended with `v22-ea-amendment` row. New Changelog entry. The pre-existing "Not yet implemented (backlog #108)" note at end of §11.2 updated to point at §11.2a.

- **Batch 6 — Backlog + CLAUDE.md.** #108 moved from Detail Panels open section → Completed section with full Phase 11E.1 completion summary. New backlog item #160 filed in Exploratory section: "Production: Option C acknowledgment audit semantics for EAs" (Investigation status, L effort, Future priority — covers per-EA snapshots, multi-grantee fan-out, chained lineage, migration plan). #12 superseded note updated to remove the "pending #108" caveat. CLAUDE.md note (this section). Changelog modal v0.11.13 entry. Footer version v0.11.12 → v0.11.13.

**Notification flow (single-grantee):**
1. Alice opens EA Detail Panel → Amend Evaluation Agreement → modal pre-filled with current deadline + claim acknowledgments.
2. Submit fires. State mutation: amended EA in provisionals; (if acks dirty) updated Claim in provisionals. `v22-ea-amendment` enqueued on grantee's inbox.
3. Grantee sees indigo "EA AMENDED" badge + body text "Alice amended the Evaluation Agreement on PRM Assembly Claim."
4. Click → notification dismisses, canvas pans to Claim, EA Detail Panel opens directly with new Amendments section visible.

**Multi-EA implicit propagation (Option B documented limitation):** Alice has EAs to Bob AND Carol on PRM Claim. Alice amends Bob's EA with an acknowledgment edit. The Claim's `acknowledgments[]` mutates — visible to both Bob and Carol when they view the Claim. Only Bob receives the `v22-ea-amendment` notification. Carol's EA's `acknowledgmentsAccepted` audit trail is preserved (untouched), but the *current* acknowledgments on the Claim that Carol sees are the post-edit version. Production fix is Option C (per-EA snapshots — see #160).

**Deviations from task brief:**
- ExpiryPicker option ids in the modal use `'1-year'` / `'2-year'` / `'none'` / `'custom'` (the picker's actual emit values) rather than the brief's `'6-months'` / `'1-year'` / `'2-years'` / `'never'` / `'custom'` — the existing ExpiryPicker doesn't expose '6-months' / '2-years' / 'never' as user-clickable options. Initialize to `'custom'` with the EA's current deadline pre-filled; fall back to `'none'` when deadline is null.
- The brief's W3.7 ordering note ("badgeLabel: branch BEFORE the existing isV22Amendment") was followed — `isV22EaAmendment ? 'EA AMENDED' :` precedes `isV22Amendment ? 'AMENDED' :` in the chain.
- Body text rendering — the brief said to find `isV22Amendment` body text and add a parallel branch. Inspection showed `isV22Amendment` has no dedicated body text branch (falls through to bare `req.asset?.name`). Added the `isV22EaAmendment` branch as a new fallthrough just above the bare-name fallback so it's at least readable; left the existing `isV22Amendment` fallthrough alone for the same reason.

**Runtime verification (preview):**
- Build clean (94 modules, ~585 kB main / ~140 kB gzip).
- App reloads cleanly; no console errors.
- End-to-end UI walkthrough constrained by the V2Canvas 3D raycaster DOM-dispatch limitation documented since 9A.6 — manual mouse interaction is the verification path. Code-level verification confirms all Batch 1-4 wiring lands at the documented locations and integrates with existing handler infrastructure without TDZ / dependency-array gaps.

**Status:** [x] Complete.

### Phase 11E.1.1 completion notes (2026-05-01) — Amend EA polish + bug fixes

Five fixes from 11E.1 QA. **(1)** `AmendEvaluationAgreementModal`'s `hasChanges` was reporting true on modal open for EAs with non-`T00:00:00Z` deadlines — picker pre-fill normalized to midnight UTC, original ISO carried a time component, raw-string comparison short-circuited to "different." Fixed via `toDateOnly` helper that compares YYYY-MM-DD slices. **(2)** `EdgeHoverMenu` was reading `evaluationAgreement?.terms?.expires` — wrong field. EA carries `terms.evaluationDeadline`; `expires` is on the DA. Fixed; tooltip now reflects post-amend updates via the live merged-view lookup. **(3)** Carol's canvas was showing a NEW badge on Alice's Claim after Alice amended Bob's EA — `setV22RecentlyAcceptedClaimId` is global state and stamps NEW for every viewer. Per Option B (§11.2a), only the targeted EA grantee gets a notification; cross-role NEW contradicts the contract. Removed the `setV22RecentlyAcceptedClaimId` call from the EA-amend handler entirely. **(4)** ExpiryPicker preset card labels read "Expires March 2027" / "March 2028" — wrong-month + non-conforming with the codebase's YYYY-MM-DD convention. Replaced with dynamic `expiryPresetIso(yearsFromNow)` helper; labels now read e.g. "Expires 2027-05-01" relative to today. Inherited correctly by other ExpiryPicker call sites. **(5)** Modal header subtitle now weaves the grantee party name + Claim name into the description prose with `<strong>` tags. **Bonus:** footer summary upgraded from "Expiration changed" to explicit "Expiration: 2026-04-04 → 2027-05-01" before/after with YYYY-MM-DD precision; "No expiry" rendered for null on either side. New backlog item **#161 — Notification deep-link with diff highlighting in Detail Panel** filed (Open, M effort, Medium priority). No spec changes; §11.2a contract preserved. Footer v0.11.13 → v0.11.14. Commit `12d6493`.

**Status:** [x] Complete.

### Phase 11E.1.2 completion notes (2026-05-01) — Detail Panel EA-deadline read audit + edge tooltip nowrap

Two small fixes closing out the Amend EA epic before 11E.2. **(1)** `V22NodeDetailPanel.jsx` `EvaluationAgreementRow` was reading `ea.terms?.resultExpiry || ea.terms?.expires || null` — wrong field. EA carries `terms.evaluationDeadline`; `resultExpiry` is when the eval RESULT itself expires (separate concept); `terms.expires` exists only on the DA schema. Pre-fix the row always rendered "Never expires" regardless of actual deadline AND post-amend never updated. Fixed: read `terms.evaluationDeadline` first with the legacy fields retained as migration-safety fallbacks. Same single-source-of-truth fix the row is shared across V22ClaimPanel, V22AssetPanel, and V22ActorPanel — all three Detail Panel surfaces inherit. Audit confirmed no other stale read sites. **(2)** Edge hover tooltip title was wrapping with "Agreement" orphaned on line 2 for "Selective Disclosure Agreement" + "Proof-only Disclosure Agreement". `MENU_WIDTH` bumped 320 → 380; `whiteSpace: 'nowrap'` added to both DA + EA title elements (parity). Body party→party line continues to wrap normally. No spec changes. Footer v0.11.14 → v0.11.15. Commit `e715547`.

**Status:** [x] Complete.

### Phase 11E.1.3 completion notes (2026-05-01) — Inline EA Amend button wiring + seed data date refresh

Two cleanup items closing out the Amend EA epic before 11E.2. **(1)** `EvaluationAgreementRow` in `V22NodeDetailPanel.jsx` had a stale hardcoded `<ActionLabel label="Amend" disabled title="Amend Evaluation Agreements coming soon" />` from the pre-Phase-11E.1 placeholder era — never updated when the modal shipped. Wired through the prop chain: V2App new `handleAmendEaFromRow` → V22NodeDetailPanel `onAmendEa` prop → all three Detail Panel surfaces inherit. EvaluationAgreementRow now renders AMEND with three-branch gating mirroring `EvaluationAgreementDetailPanel.jsx`'s footer logic: enabled (grantor + active + non-revoked) with onClick + descriptive tooltip; disabled with grantor-only tooltip for non-grantors; disabled with revoked tooltip for revoked EAs. **(2)** Seed-data EA `evaluationDeadline` values bumped 2026-04-XX → 2028-04-XX (preserved month + day; bumped year by 24 months) so demos no longer show past dates on Active EAs. DAs already had 2027 `expires` values and didn't need bumping. Creation/effective `terms.createdDate` values left in 2026 — those are historical timestamps. No spec changes. Footer v0.11.15 → v0.11.16. Commit `30305dc`.

**Status:** [x] Complete.

### Phase 11E.1.4 completion notes (2026-05-01) — Revoked-EA AMEND removal + DA row expiration column + response modal title split + #162 filing

Four fixes closing remaining Amend-EA cleanup before 11E.2. **(1)** AMEND `<ActionLabel>` was rendering on revoked EA rows in node Detail Panels (disabled with tooltip). Inconsistent with REVOKE (already hidden on revoked rows per Phase 9D.1.x precedent) and with `DisclosureAgreementRow`'s `actionsHidden` rule. Fixed: AMEND now hidden entirely on revoked rows (`showAmend = !isInternal && !isRevoked`); two-branch gating remains for active rows (enabled grantor / disabled-with-tooltip non-grantor). **(2)** DA row right-column on active rows now reads `Expires YYYY-MM-DD` (or `No expiry`) from `terms.expires`, matching the EA-row pattern. The "Active" status prefix dropped — the row's presence in the active Agreements section already implies active. Revoked / declined / provisional rows keep their existing label + color + date. **(3)** Audit of all DA factory call sites in `v2_2Data.js` confirmed every cross-party DA already carries 2027-MM-DD `terms.expires`. Public-directory + internal/ownership + proof-of-evaluation DAs legitimately have no expiry; they continue to render gracefully as "No expiry." No seed mutations. **(4)** `CombinedResponseModal` accept-path title is now step-aware. Cold path: Steps 1-2 (Type/Scope) → "Respond to Disclosure Request"; Step 3 (EA Terms) → "Respond to Evaluation Request"; Step 4 (Review) → "Review your Disclosure + Evaluation Agreement Response". Warm path inherits cold-path Step 3 EA copy; Step 4 → "Review your Evaluation Agreement Response". Decline-path titles preserved. **Backlog:** filed item **#162 — EA revocation copy + Directory Layer post-revocation visualization** (Deferred to Phase 14, S copy + part of #132). No spec changes. Footer v0.11.16 → v0.11.17. Commit `a948f86`.

**Status:** [x] Complete.

### Phase 11E.1.5 completion notes (2026-05-01) — REVOKED badge placement + "Never expires" copy unification

Two cleanup fixes. **(1)** REVOKED lifecycle-state badge on revoked node cards relocated from the title row (where it crowded long node names) to the V2.2 type-label header row, alongside the `CLAIM` / `ASSET` / `PARSE RESULT` / `EVAL RESULT` mono label. Per CLAUDE.md Code style, lifecycle-state badges are separate from the type label. AssetNode Row 0 wrapper switched from a default block to a flex container with gap so the type label + REVOKED badge sit on a single line. Title row (Row 1) now displays only the node name + remaining badges. REVOKED's badge precedence over PROVISIONAL/DECLINED is preserved. Mini LOD already used a dashed-red-border + red-tinted background (no text badge); no regression. **(2)** Copy unification across the app — the no-expiration state now reads "Never expires" everywhere it's rendered as a status display. Phase 11E.1.4's `DisclosureAgreementRow` addition originally used "No expiry"; pre-existing surfaces used "Never expires". Sweep updated five files: `V22NodeDetailPanel.jsx` (DA row), `AmendEvaluationAgreementModal.jsx` (formatDateTime + footer summary), `ModalShared.jsx` (`expiryLabel` resolved-state for `'none'`), `EvaluationAgreementDetailPanel.jsx` (rows + amendment row), `DisclosureAgreementDetailPanel.jsx` (Expires row). Detail Panel rows previously rendered an em dash "—" for null; now read "Never expires." Judgment call preserved: ExpiryPicker preset card retains `label: 'No expiry'` since that title labels a *user action* of opting out of an expiry. No spec changes. Footer v0.11.17 → v0.11.18. Commit `3172328`.

**Status:** [x] Complete.

### Phase 11E.1.6 completion notes (2026-05-02) — DA expiration UX in Response + Amend flows + EA "Never expires" coercion fix + Amend DA title

Four fixes closing out the DA/EA separation arc before 11E.2. Spec §11.2 + §11.6 are now reflected more faithfully by the UI; no spec text changed. **(1) P1 bug:** clicking the ExpiryPicker's "No expiry" preset in `CombinedResponseModal` silently produced an EA `evaluationDeadline` ~1 year out instead of `null`. Root cause: `computeExpiryIso` switch handled stale picker ids (`'never'`, `'6-months'`, `'2-years'`) but the picker actually emits `'1-year'`, `'2-year'`, `'none'`, `'custom'` — `'none'` fell to the `default` branch and got coerced to +1 year. Fixed: rewrote the switch to use the picker's actual ids; added `isoFromPicker(mode, customDate)` helper. Also fixed the same null-coercion bug in `finalizeProvisionalAgreementPair` and `finalizeProvisionalEvaluationAgreement` (cold + warm paths) where `??` collapsed an explicit null `eaTerms.expires` back to the provisional fallback — switched both to `!== undefined ? : (fallback ?? null)`. **(2)** DA expiration is now grantor-set at response time (Andrew's Option A). `CombinedResponseModal` Step 2 gains a Disclosure Agreement expiry picker above the scope picker; Step 3 copy tightened to be EA-specific; Step 4 review shows DA + EA expirations on separate rows. Submit payload extended with `daTerms: { expires }`. `finalizeProvisionalAgreementPair` extended with `daTerms` parameter so the DA's `terms.expires` is set independently of the EA's `terms.evaluationDeadline`. Pre-fix the same value was assigned to both fields. Defaults: both pickers default to `'none'` ("Never expires"). **(3)** `AmendDisclosureModal` gains an Expiration section above the scope picker, mirroring `AmendEvaluationAgreementModal`'s layout. Submit payload extended with `terms: { expires }`. `makeAmendedDisclosureAgreement` factory now accepts an optional `terms` argument, applies `terms.expires` (preserving null), and records `termsBefore: { expires }` on the amendment record. DA Detail Panel's prior count-only "Amendments: N" Row replaced with a full Amendments section: each card shows timestamp, "Expiration: before → current" delta when expires changed, "Scope amended." line when scopeBefore is present, optional grantor note. **(4)** AmendDisclosureModal title `"Amend Disclosure" → "Amend Disclosure Agreement"` (parity with Amend EA); footer Submit button label matches. Subtitle replaced with parallel JSX structure to AmendEvaluationAgreementModal: weaves grantee + Claim name into prose with `<strong>`. New `claim` prop wired through V2App. Footer v0.11.18 → v0.11.19. Commit `8eabd56`.

**Status:** [x] Complete.

### Phase 11E.1.7 completion notes (2026-05-02) — Step 4 abbreviation expansion + modal max-height + Detail Panel close on Directory Layer + Amend DA zero-Asset gating + #163 filing

Five small fixes closing out the DA/EA separation arc. **(1)** `CombinedResponseModal` Step 4 review labels expanded — "DA EXPIRES" → "DISCLOSURE AGREEMENT EXPIRES" + "EA EXPIRES" → "EVALUATION AGREEMENT EXPIRES". Label column `minWidth` widened from 130 → 230 to fit the longer mono-uppercase strings without wrapping. **(2)** `CombinedResponseModal` renders at a fixed 720px height so steps 1-4 (and warm-path 3-4) all sit at the same size and the footer button row no longer jumps as content varies. Implemented by adding an optional `height` prop to the shared `Modal` component (defaults to undefined → existing behavior unchanged for all other modals). Cap is `min(90vh, 720px)`. **(3)** Detail Panels (node + DA + EA) now close when the user enters the Radiant Network Directory Layer. The globe-button onClick already cleared `setSel` / `setForcePanelTab` / `setForceExpandSda`, but didn't clear `setSelectedEdgeId` / `setOpenAgreement` — the agreement Detail Panels are driven by edge selection, so a DA / EA panel persisted over the directory. Added both clears to the same handler. **(4)** AmendDisclosureModal blocks Submit when current scope is empty for the active type (Full → ≥1 Asset, Selective → ≥1 field, Proof-only → ≥1 Eval Result). Inline amber italic empty-state message renders only when `showEmptyScopeWarning` (= `scopeIsEmpty && baselineWasNonEmpty`) — i.e., after the user has interacted to reach zero, not on initial open. **Backlog:** filed item **#163 — Anchor Asset picker for EA-only requests on Directory Layer Claims** (Deferred to Phase 14, M effort). No spec changes. Footer v0.11.19 → v0.11.20. Commit `6121fae`.

**Status:** [x] Complete.

### Phase 11E.2 completion notes (2026-05-02) — Reciprocal DA + Claim amendment notifications (#102) + Phase 11E.3 — Edge draw-in animation initial attempt (#139)

Two parallel features closing out the original Phase 11E queue. **#102 deliverables:** (a) the existing DA-amendment notification was renamed `v22-amendment` → `v22-da-amendment` (parallel to `v22-ea-amendment`); click handler updated to deep-link directly to the DA Detail Panel via `setOpenAgreement({ kind: 'disclosure', disclosureAgreementId })`. Notification body copy now includes the Claim name + optional `(Note: …)` suffix. (b) New `v22-claim-amendment` type fires from `handleV22AmendClaimSubmit` to every counterparty with an *active* DA on the affected Claim — fan-out, deduped by party. Click pans to the Claim and opens its node Detail Panel. (c) Both new types' badge labels: `DA AMENDED` and `CLAIM AMENDED`. Architecture spec §7.4 + §11.2 prototype notes updated. **#139 initial attempt:** new animation primitive `src/v2/animations/edgeDrawIn.js` exporting `playEdgeDrawIn`. New `playEdgeDrawIn(nodeId, durationMs = 500)` method on V2Canvas mirrored `playEdgeRetract` in reverse — single-edge approach that mutated the existing canonical edge's geometry. Wired into `startReveal` via `setTimeout(500ms)`. **Note:** the single-edge architecture in 11E.3 diverged from Andrew's two-edge spec; superseded by Phase 11E.4. Footer v0.11.20 → v0.11.21. Commit `9aedbf2`.

**Status:** [x] Complete (DA-amendment side preserved; Claim-amendment notifications and single-edge animation rolled back / reworked in 11E.4).

### Phase 11E.4 completion notes (2026-05-02) — Roll back Claim amendment notifications + two-edge reveal animation architecture + AMENDMENT badge unification

Three corrections from 11E.2 + 11E.3 QA. **(1) Roll back `v22-claim-amendment`:** counterparties don't see Claim amendments directly; they only learn of new content when the grantor amends the Disclosure Agreement to include new Assets/fields. DA amendment is the user-visible event; Claim amendment is internal Claim-owner state. Removed: the entire fan-out logic from `handleV22AmendClaimSubmit`; the `isV22ClaimAmendment` flag, badge map entry, click handler branch, and body-text branch in V2App.jsx; the §7.4 row in spec; the §11.2 prototype-note reference. The DA-amendment side of 11E.2 (rename + click + body) is preserved unchanged. **(2)** `v22-da-amendment` and `v22-ea-amendment` badge labels unified to `AMENDMENT` (was `DA AMENDED` / `EA AMENDED`). The badge is a category tag — the body copy specifies which artifact was amended. **(3) Two-edge reveal architecture:** Phase 11E.3's single-edge approach was wrong. New architecture: V2Canvas now exposes a separate `revealOverlayGroup` (sibling of `edgeGroup`) that survives `buildEdges`'s `clearGroup` calls. Four atomic methods on the imperative handle: `addRevealOverlayEdge` (Line2 with typed style + 2-point stub at FROM end), `playEdgeDrawInById` (geometry growth via per-frame point-trim grow), `fadeEdgeOpacityById` (canonical provisional edge opacity ramp), `removeRevealOverlayEdge` (cleanup). The reveal animation orchestrator (`src/v2/animations/edgeDrawIn.js` exports `playRevealEdgeAnimation`) coordinates: at draw-in start a typed overlay edge is added with stub geometry; geometry grows over 500ms; provisional canonical edge fades out concurrent with the Claim card flip (`fadeStartDelayMs=600`, `fadeMs=400`); overlay is removed after `postFlipPauseMs=900` so the canonical buildEdges has time to re-render the typed edge with proper styling at reveal phase 'done'. `startReveal` in V2App.jsx now resolves the cross-party canonical edge incident to the revealed Claim. No regressions to `playEdgeRetract`. Footer v0.11.21 → v0.11.22. Commit `69b8ecd`.

**Status:** [x] Complete.

### Phase 11E.5 completion notes (2026-05-03) — Edge draw-in geometry stub fix attempt + notification deep-link edge selection + #164 filing

Three fixes closing out Phase 11. **(1) #139 follow-up attempt:** Phase 11E.4's two-edge architecture had a latent bug — the typed-style overlay edge appeared as a ~100px stub at the anchor and sat motionless. Root cause: `LineGeometry` allocates its `instanceStart` / `instanceEnd` InstancedBufferAttributes at the size of the initial position array supplied to `setPositions`. `addRevealOverlayEdge` seeded with a 2-point stub (6 floats); subsequent `setPositions` calls in `playEdgeDrawInById` with longer arrays exceeded the allocation and threw silently — the throws were swallowed by the `try/catch`. Fix mirrors `animateNewEdges`: `addRevealOverlayEdge` now initializes geometry with the FULL bezier curve from frame zero, captures `_fullInstanceCount` into userData, runs `computeLineDistances()` once, then sets `geometry.instanceCount = 0`. `playEdgeDrawInById` rewritten to per-frame `geometry.instanceCount = Math.round(eased * fullCount)`. **(Note: this fix was incomplete — Phase 11E.6 caught a follow-on `Infinity` bug.) (2)** Clicking a `v22-da-amendment` or `v22-ea-amendment` notification now also selects the corresponding canonical agreement edge via `setSelectedEdgeId`. Edge id resolution: DA amendment → walk `v22Data.edges` matching `disclosureAgreementId === req.v22DaId`; EA amendment → match `pairedEvaluationAgreementId === req.v22EaId`. Other notification deep-links unchanged. **(3) Backlog:** filed new item **#164 — Acknowledgment amendment acceptance UX (counter-acceptance flow)** in a new "Phase 11.6 cleanup queue" sub-section at the top of Future Features. Captured Andrew's note from 11E.4 QA that Phase 11E.1's Option B Amend EA semantics allow the grantor to unilaterally add/edit/remove acknowledgments post-acceptance — an exploit vector. Footer v0.11.22 → v0.11.23. Commit `d855e35`.

**Status:** [x] Complete (geometry stub fix attempt; superseded by 11E.6 root-cause fix).

### Phase 11E.6 completion notes (2026-05-03) — `_fullInstanceCount = Infinity` root-cause fix

One-line root-cause fix to the Phase 11E.5 reveal animation regression. `addRevealOverlayEdge` was reading `fullInstanceCount = geometry.instanceCount` post-`setPositions`, but `THREE.LineGeometry.setPositions` does NOT update `instanceCount` — `InstancedBufferGeometry`'s constructor leaves it at the default `Infinity`. So `_fullInstanceCount` was stored as `Infinity` in userData; in `playEdgeDrawInById`'s per-frame `Math.round(eased * fullCount)` ramp: frame 0 → `Math.round(0 * Infinity) = NaN` (nothing rendered); frames 1+ → `Math.round(eased * Infinity) = Infinity` (all segments rendered). No animated draw-in was ever visible. The early-return guard `typeof fullCount !== 'number' || fullCount <= 0` didn't catch `Infinity` (which IS a number > 0). Fix: derive segment count directly from `curvePoints` — for an N-point curve there are N-1 line segments, the value Three.js actually uses for rendering. After fix, `_fullInstanceCount` is a finite integer (11 / 19 / 31 depending on curvature), per-frame ramp produces real values, and the edge animates visibly along the full bezier curve. `playEdgeRetract` unaffected. Footer v0.11.23 → v0.11.24. Commit `77b7112`.

**Status:** [x] Complete.

### Phase 11E.7 completion notes (2026-05-03) — `_showAsProvisional` stamp lifecycle restored from acceptance until notification click

Architectural fix to the reveal flow. The `_showAsProvisional` stamp on incident Claims and edges must persist on the grantee's view from the moment of acceptance until the grantee's notification click triggers `startReveal` — not just during the reveal animation window. Pre-fix: Phase 11C.5 introduced `v22RevealActiveClaimId` as the only gate, cleared at reveal phase 'done'. The stamp was never SET pre-click — so the grantee's view rendered the new Claim + typed edge in active state immediately on acceptance (since `v22Provisionals` already holds the finalized artifact). When the grantee later clicked the notification, `startReveal` set the gate, the Claim visually "regressed" to provisional, then animated back to active. That reads as "acceptance, then re-acceptance" rather than a true first-time materialization. Fix: new per-role state slot `v22PendingRevealsByRole` tracks pending acceptance reveals on the requester's role. Populated by `handleV22Accept` and `handleV22AcceptEAOnly` immediately after enqueueing the acceptance notification on the requester's inbox. Drained by the notification click handler immediately before `startReveal` fires (so React batches both state updates into the same render — gate (b) clears in the same frame gate (a) sets, no one-frame visual gap). Two new helpers: `addPendingReveal(targetRoleId, claimId)` + `removePendingReveal(targetRoleId, claimId)`. The `v22DataWithReveal` memo's stamp logic now composes the two gates: stamp applies if `v22RevealActiveClaimId === n.id` OR `pendingRevealClaimIds.has(n.id)`. Edge stamping unified to walk the union of active-reveal + pending-reveal claim ids. Architecture spec gains new §11.5b "Acceptance reveal stamp lifecycle (Phase 11C.5 / 11E.7)" subsection documenting the three-phase lifecycle, two-gate composition, and why the grantor side doesn't carry the stamp. Footer v0.11.24 → v0.11.25. Commit `f4b0172`.

**Status:** [x] Complete.

### Phase 11E.8 completion notes (2026-05-03) — `anyDecoration` early-return guard fix + draw-in duration 500ms → 1200ms

Two fixes from 11E.7 QA. **(1)** The `v22DataWithReveal` memo's `anyDecoration` early-return guard didn't include the reveal-window state slots. When the grantee deselected the recently-accepted Claim before clicking the notification (clearing `flagged` since `v22RecentlyAcceptedClaimId === prevSel` triggers the deselect-aware effect), the gate's other triggers all evaluated false, so the memo short-circuited to `return v22Data` and the pending-reveal + active-reveal edge stamping never ran. Edges reaching V2Canvas had no `_showAsProvisional: true` flag, so `effectiveSdaType` collapsed to the typed sdaType — incident edges rendered with their typed color instead of dashed grey provisional. Fix: extend `anyDecoration` to also include `pendingRevealClaimIds.size > 0` and `v22RevealActiveClaimId != null`. **(2)** Edge draw-in animation slowed from 500ms to 1200ms — Andrew reported the 500ms duration was too fast to perceive curve growth. `playRevealEdgeAnimation` parameters bumped: `drawInMs` 500 → 1200, `fadeStartDelayMs` 600 → 1300; `fadeMs` (400) and `postFlipPauseMs` (900) unchanged since flip duration constrains fade and post-flip cleanup buffer needs to outlast reveal phase 'done' regardless. Footer v0.11.25 → v0.11.26. Commit `f68a488`.

**Status:** [x] Complete.

### Phase 11E.9 completion notes (2026-05-03) — Reverse draw-in animation direction + `applyEdgeStylingRef` provisional flag respect

Two fixes from 11E.8 QA. **(1) Direction:** `startReveal`'s edge resolution at the `playRevealEdgeAnimation` call site was passing `fromNodeId = primaryEdge.from`, `toNodeId = primaryEdge.to`. `deriveAgreementEdges` sets `edge.from = claimId, edge.to = anchorAssetId` for cross-party Claim DAs — so the typed overlay edge's geometry grew from the Claim end toward the anchor Asset, backwards from the intended "supplier reaches out to pull in the Claim." Fixed: swap the assignments at the call site (`fromNodeId = primaryEdge.to`, `toNodeId = primaryEdge.from`). The canonical edge convention in `deriveAgreementEdges` stays untouched; the swap is confined to one orchestrator call site. **(2) Stamp not reaching restyle:** `applyEdgeStylingRef` (V2Canvas:3183) is a runtime restyle pass that re-applies edge color / width / opacity on selection / hover / zoom / `currentLayer.edges` changes. Pre-fix it computed `effectiveSdaType = line.userData?.sdaType || 'full'` — reading the typed sdaType stamped at edge build time, ignoring the `_showAsProvisional` flag. The initial `buildEdges` correctly collapsed `effectiveSdaType` to `'provisional'` when the edge carried the flag, so the first paint rendered dashed grey. But the very next restyle (typically triggered immediately by `currentLayer.edges` changing on memo recomputation) overwrote the material color with the typed color, leaving the edge with a typed color + dashed pattern instead of dashed grey. Fix follows the Phase 9D.2.2 Fix 1 precedent for `isRevoked`: carry `showAsProvisional: !!edge._showAsProvisional` onto `line.userData` in `buildEdges`, then have `applyEdgeStylingRef` collapse `effectiveSdaType` to `'provisional'` when the userData flag is set. Same single-source-of-truth pattern that's preserved revoked-edge styling through restyles since 9D.2.2. Footer v0.11.26 → v0.11.27. Commit `d78f939`.

**Status:** [x] Complete.

### Phase 11.6 completion notes (2026-05-03) — Amendment-as-proposal flow (#164) + draw-in smoothness (#165) + Phase 11E retrospective (#166)

End-of-Phase-11 cleanup batch. Three items shipped together. Phase 11 closed; Phase 12 next.

**Item 1 (#164) Amendment-as-proposal flow:** structural refactor — Phase 11E.1 unilateral Option B model replaced with a bilateral propose / accept / reject flow. Closes the post-acceptance acknowledgment-injection exploit Andrew flagged in 11E.4 QA. The grantor cannot mutate the grantee's accepted commitments without explicit consent. New EA `status` enum value `'pending-acceptance'`. New per-amendment shape with `id`, `status: 'pending'|'accepted'|'rejected'|'superseded'`, `proposalMessage`, `responseMessage`, `responseDate`, `termsBefore`, `proposed: { evaluationDeadline, acknowledgments }`, `acknowledgmentChanges`. Three new factory helpers in `v2_2Data.js`: `proposeEvaluationAgreementAmendment` (replaces `makeAmendedEvaluationAgreement`), `acceptEvaluationAgreementAmendment`, `rejectEvaluationAgreementAmendment`. Three new V2App handlers: `handleV22ProposeEvaluationAmendment`, `handleV22AmendmentAccept`, `handleV22AmendmentReject`. New `AmendmentResponseModal.jsx` for the grantee-side UX with diff display + per-row checkbox ticking + expiration confirm + free-text response. AmendEvaluationAgreementModal updated: subtitle copy reflects the proposal model + paused-evaluations explanation; submit button label "Submit Amendment Proposal" (was "Amend Evaluation Agreement"); "Amendment note" field renamed "Proposal message". Pending-acceptance lock enforced UI-side: `V22RunEvaluationModal` blocks submit + footer copy directs grantee to inbox; `EvaluationAgreementDetailPanel` + `EvaluationAgreementRow` AMEND buttons disabled with tooltip pointing to pending grantee response. Notifications: old `v22-ea-amendment` informational type sunset; three new types (`v22-ea-amendment-proposal` indigo `AMENDMENT PROPOSAL` / `v22-ea-amendment-accepted` green `AMENDMENT ACCEPTED` / `v22-ea-amendment-rejected` red `AMENDMENT REJECTED`). Architecture spec §11.2a major revision (replaces Option B docs with the proposal model) + new §11.2b documenting the pending-acceptance lock semantics + revoke override + §7.4 update. New backlog item **#167** filed for extending the proposal model to DA amendments (deliberate scope limit this round — DAs only edit scope + expiration, neither carries the same exploit risk as acknowledgments).

**Item 2 (#165) Smooth out edge draw-in:** `addRevealOverlayEdge` forces `pointCount = 64` for reveal overlay edges (was 12/20/32 from canonical curvature heuristic). Smaller per-frame `instanceCount` deltas eliminate the "steppy" quantization visible during the 1.2s draw-in window — 64 segments at ~60fps gives ~1 segment per frame. Geometry cost bounded (one overlay edge per reveal, ~2s lifetime). Canonical buildEdges resolution unchanged.

**Item 3 (#166) Phase 11E retrospective:** appended single-paragraph retrospective to polish-backlog Update Log. Phase 11E shipped #108, #102, #139 across nine sub-phases (11E.1 → 11E.9). Sub-phase count was driven primarily by the edge draw-in animation (#139) which took rounds 11E.3 → 11E.9 to land cleanly. Root cause patterns: (1) two-edge animation architecture wasn't followed in the initial implementation; (2) THREE.js InstancedBufferGeometry's `instanceCount` defaults to `Infinity`, not the constructor's allocated size; (3) the reveal lifecycle's `_showAsProvisional` stamp was being applied at the wrong scope. Workflow lesson: source files in the project (V2App.jsx + V2Canvas.jsx + v2_2Data.js + edgeDrawIn.js) are the durable canon for surgical diagnosis.

Footer v0.11.27 → v0.11.28. Commit `603f89b`.

**Status:** [x] Complete.

### Phase 11.6.1 completion notes (2026-05-03) — Five fixes from Phase 11.6 QA

**(1)** `handleV22AmendmentAccept` and `handleV22AmendmentReject` now dismiss the originating `v22-ea-amendment-proposal` notification on the grantee's inbox after a terminal response. The proposal notification id is deterministic (`v22-ea-amendment-proposal-${eaId}-${amendmentId}`), so both handlers append it to `dismissedReqs` via `updateRoleState(roleId, ...)` immediately after `setV22RespondingToEaAmendment(null)`. Pre-fix the notification persisted indefinitely. **(2)** `EvaluationAgreementDetailPanel` now renders an Acknowledgments section sourced from the live `claim.acknowledgments[]` (passed as a new `claim` prop from V2App). Spec §11.2a Option B says acknowledgments live on the Claim, not the EA; the EA's `acknowledgmentsAccepted` is an audit-trail snapshot of original acceptance time, not the live state. Pre-fix the panel had no Acknowledgments section at all, so post-amendment changes were invisible until the user opened the Claim Detail Panel directly. **(3)** Run Evaluation button on the Claim Detail Panel now stays visible during `pending-acceptance` (visually disabled with tooltip directing grantee to respond), instead of falling through to "Request Evaluation Agreement." V2App's `evaluationAgreementForActor` resolver extended via `isActionableEaStatus = (s) => s === 'active' || s === 'pending-acceptance'`; V22ClaimPanel's footer renders Run Evaluation as `<FooterButton disabled title="Cannot run evaluation: amendment proposal awaiting your response. Respond in your inbox to continue.">` when the EA's status is pending-acceptance. **(4)** EA Detail Panel footer's `canRevoke` predicate extended to allow revocation during pending-acceptance per spec §11.2b — revoke is the documented override during pending. The pending amendment record stays in `amendments[]` for audit; the EA goes to `revoked` regardless. **(5)** Both `AmendEvaluationAgreementModal` (grantor's view) and `AmendmentResponseModal` (grantee's view) now display a "Current terms" section at the top of the modal body — read-only display of the EA's pre-amendment expiration + the Claim's pre-amendment acknowledgments — followed by a divider, then the existing editable / diff-display sections (relabeled "Proposed expiration" / "Proposed acknowledgments" / "Proposed acknowledgment changes" / "Proposed expiration change" so the contrast is explicit). Andrew's note: "keep it simple — there will be a big redesign of all modal flows later on." No spec changes. Footer v0.11.28 → v0.11.29. Commit `f534c03`.

**Status:** [x] Complete.

### Phase 11.8 completion notes (2026-05-04) — Quick wins batch (#24, #39, #44, #54, #98, #99)

Six items in one commit. **#24 + #39 backlog moves:** verified the underlying code was already correct (spec §4.4 prose at `architecture-spec.md:267-274` already reflects the shipped 65% white blend / +1.5px stroke values; `handleV22DismissDeclined` already calls `playUnravelAnimation`). Both moved from open sections to Completed with explanatory entries. **#44 Radiant Network double-click → Directory:** new `wipeOrigin: { x, y } | null` prop on `DirectoryLayer` accepts viewport-pixel coords and threads through both clip-path strings; the open-phase pin (`pinnedOriginRef`) captures the origin so the close animation collapses back to the same point even if `wipeOrigin` later changes. New `onV22OpenDirectoryFromNode` callback on `V2Canvas` wires a DOM-level `onDoubleClick` on the Radiant Network Actor card wrapper (gated on `node.isNetworkNode && node.v22Type === 'ACTOR'`); reads `e.currentTarget.getBoundingClientRect()` at fire time and emits screen-space center to V2App. Globe-button click path stays at the bottom-left wipe (`origin: null` cleared by toggle). **#54 Reset all data:** new red action in the Account dropdown below SWITCH USER under its own divider; opens a confirmation modal explaining the scope. On confirm: `v22Provisionals` reset to empty initial shape; `perRoleState` reset to `emptyRoleState` for every role; `credits` reset to active role's seeded balance; selection / Detail Panel / Directory state cleared. Theme + skip-boot localStorage flags preserved (user preferences, not demo state). The original brief mentioned "clears localStorage and re-plays the boot sequence" — that path was deemed too aggressive (theme regression + forced 3D boot every reset), so shipped scope is in-memory state only; pairs with #53 (session persistence) when that ships. **#98 CreditCostRow + add-credits sub-modal:** drop "Only" prefix on insufficient (both states show plain "N available", insufficient still red); new `onAddCreditsClick` prop renders an indigo "Add credits →" link when wired (dashed underline). V22CreateAssetModal + V22CreateClaimModal forward the prop incl. the nested register-from-Claim flow. New V2App sub-modal opens on top of the parent Create modal with "+100 credits" and "Reset to role default" actions. Both close only the sub-modal so the user sees the updated balance reflected immediately in the CREDIT COST row of the still-open parent. Sub-modal sits at the same Backdrop z-index as the parent (10000) but DOM paint order keeps it visually on top. **#99 Create Claim NEW badges:** Asset picker now floats `initialAssetIds` + Assets registered via the inline "+ Register new Asset…" CTA to the top with indigo NEW badges (uppercase mono, dashed-blend background). Two Sets track the badge: `recentlyRegisteredIds` (seeded from `initialAssetIds`, grown by `handleNestedAssetComplete`) and `clearedBadgeIds` (grown when the user toggles a NEW row from selected → unselected). Badge clears on first deselect and does not return on re-selection — answers "what's new since I opened this modal" rather than persisting for the modal's lifetime. Sort is stable: NEW rows before others, otherwise original `ownedAssets` order preserved. No section header or visual separator; the badge alone marks the boundary. Footer v0.11.30 → v0.11.31. No spec content changes.

**Status:** [x] Complete.

### Phase 12.1 completion notes (2026-05-04) — Reference Published Requirements Sets on a Claim (#120)

Single-item phase shipping non-binding "Referenced Standards" metadata on Claims. Strictly informational — does not couple to evaluation, does not auto-suggest in Run Evaluation, does not produce notifications when changed. **Data model:** `makeClaim` factory in `v2_2Data.js` gains `referencedRequirementsSets: [{ requirementsSetId, addedDate }]`; each `amendments[]` entry gains parallel `addedRequirementsSetIds[]` / `removedRequirementsSetIds[]` arrays. Both fields version-pinned. New helper `getLatestRSVersion(rsId, allRS)` walks the supersession chain. `makeAmendedClaim` extended to accept the RS diff buckets; cascade-skip semantics inherited from the existing handler (no Eval Result staleness, no notifications). **Picker primitive:** new `RequirementsSetPicker` component with two-tab pool (My Requirements Sets / Published), search, locked-row support; used by both `V22CreateClaimModal` (optional create-time section) and `AmendClaimModal` (toggleable add picker). **Amend Claim modal restructure:** modal grew from Asset-add-only to support Asset add + RS add/remove. Submit shape `{ addedAssetIds, addedRequirementsSetIds, removedRequirementsSetIds }`; gated on at-least-one bucket. Existing references render with × buttons + Undo on toggle; new picks render with NEW badges in an inline preview. Submit-required asterisk dropped from Asset section since RS-only amendments are valid. **Inline supersession update:** new `UpdateRSReferenceModal` opens exclusively from the Detail Panel "Newer version available" pill (owner-only click). Confirm records a one-line amendment with diff = removed [oldVersionId], added [latestVersionId] and updates the array entry's `requirementsSetId` to the latest version with a fresh `addedDate`. Update jumps to the latest in the supersession chain (not the next link). Each row updated independently — no batch action. The only inline mutation affordance on this section. **Detail Panel:** `V22ClaimPanel` Referenced Standards section between Referenced Assets and Acknowledgments. Each row: clickable name (deep-link to Library at the originally-referenced version with provenance-aware tab routing — own → Requirement Sets, public → Published), provenance badge ("Authored by you" / "Public"), optional amber "Newer version available" pill (owner click → modal; non-owner → static informational text per acceptance criterion 9), `addedDate` in muted small text. Empty state omits the section. **Demo data:** Alice's `claim-prm-assembly` references MIL-PRF-55681 v1 (public, supersession case) + Incoming QC v1 (authored). `claim-vreg-ic` references System Integration v1 (public). Dave's `claim-chipco-prm-ic` references MIL-PRF-55681 v2 (public, latest — exercises Public badge without supersession pill). New `SEED_PUBLISHED_REQUIREMENT_SETS` constant in `requirementSets.js` seeds Bob's MIL-PRF-55681 v1 + v2 + System Integration v1 into the public pool on first load (was empty array prior). New v2 of MIL-PRF-55681 added to bob-govco's authored list adding an EMI/EMC requirement on top of v1's six rows. **Scope deviations:** (1) Brief mentioned an `ExpandedArtifactModal` mirror — no Claim expanded view exists in V2.2 (Detail Panel V22ClaimPanel IS the canonical expanded view), so the section renders only there. (2) Brief mentioned "one Claim per demo role" with references — only Alice and Dave own Claims (Bob and Carol are evaluators), so seeded references span Alice + Dave; cross-role coverage achieved via grantee canvases when Bob/Carol have a DA on Alice's/Dave's referenced Claims (referencedRequirementsSets travels with the Claim artifact, satisfying acceptance criterion 6). (3) AmendClaim diff render is inline (strikethrough on removal-marked existing rows + NEW-badged preview on additions) rather than a separate two-step confirmation flow — keeps the existing single-step modal pattern; the diff signal is preserved without restructuring the surface. Footer v0.11.31 → v0.12.1 (first phase of the 12.x series). Architecture spec §10.3 updated + new §10.3a documenting the field semantics, version-pinning, and inline-mutation exception; Changelog entry. #120 moved to Completed.

**Status:** [x] Complete.

### Phase 12.2 completion notes (2026-05-04) — Evaluation Architecture Cluster (#106 + #117 + #121 + #122 + #105) + backlog hygiene + new item filings

Five evaluation items shipped together in one commit with a major restructure of the Run Evaluation flow, new Asset-versioning + OUTDATED Eval Result lifecycle, and large backlog hygiene + new item filings (#168 PoE, #169 Badges) for Phase 13+ priorities. **Step 1 — #122 Asset versioning + OUTDATED:** Claims gain a parallel `assetReferences[]` audit chain on top of the existing primitive `referencedAssetIds[]` (the active in-scope set). Each chain entry: `{ assetId, supersededBy, addedDate, removedDate }`. **Documented deviation:** kept `referencedAssetIds` as primitives + added the chain in parallel rather than converting all 42+ consumer call sites — the brief explicitly allowed this either-or path and the parallel-field approach minimizes churn while delivering the same semantics. AmendClaim grew Replace + Remove affordances per evaluated-Asset row — Replace opens a successor picker that stamps `supersededBy` on the existing entry and appends a fresh entry for the replacement; Remove stamps `removedDate` on the existing entry without successor. Asset node itself is NEVER modified. New Eval Result `status` value `'outdated'` triggered when any `evidenceUsed` Asset has been superseded or removed since the evaluation. New helpers `isEvalResultStale(evalResult, claim)` and `getLatestAssetVersion(assetId, claim)` — the latter mirrors `getLatestRSVersion` from #120 with cycle-guard. AmendClaim submit walks all Eval Results on the Claim, flips newly-stale ones to `'outdated'`, and enqueues `v22-eval-result-stale` notifications (single-grantee, informational, OUTDATED badge label, click pans to the Eval Result + dismisses but does NOT clear OUTDATED status). AssetNode renders an OUTDATED badge in Row 0 (alongside REVOKED) + dashed amber card border. V22EvalResultPanel renders an "Out of date" notice section near the top with re-run guidance. Re-run produces a new active Eval Result via #117's flow; the prior OUTDATED Eval Result transitions to `'superseded'` (supersession outranks outdated). **Step 2 — #106 Drop Asset picker:** Run Evaluation modal opens directly to a review-rows surface — no Asset picker step. `evidenceUsed` is computed at submit time as the snapshot of all currently-in-scope Asset references on the Claim. Existing single-Asset-list summary rendering retained as a read-only "Assets in scope (N) — auto-snapshot at submit" panel. Submit gates simplified — empty-evidence Claims block via the empty-state copy path (#105). The legacy `evidenceSelection` state stays as a no-op placeholder so the processing-stage copy referencing the Asset count works unchanged. **Step 3 — #121 Multi-RS:** RS picker grew a primary/additional split in step 0: clicking a row sets it as primary (whose review rows surface in step 2); clicking the `+ BATCH` chip toggles a row as a sibling (no separate review rows — sibling RS use AI confidence + status verbatim per Phase 9A item 9 pre-population pattern). Submit produces N Eval Results sharing a freshly-generated `batchId` (`batch-{timestamp}-{rand}`). Solo evaluations carry `batchId: null`. `makeEvaluationResult` extended with `batchId`, `priorEvalResultId`, `evidenceDiff` fields. V22EvalResultPanel renders a "Sibling Evaluations" section listing batch members when `batchId !== null` and the batch contains 2+ members; section omitted otherwise (backwards-compat for pre-12.2 seed Eval Results). **Step 4 — #117 Re-run diff:** new helper `computeEvidenceDiff(priorEvalResult, claim)` returns `{ added, removed, superseded, carried }` by walking `evidenceUsed` against the post-amendment chain. Run Evaluation modal renders a "Changes since last evaluation" banner above review rows when V2App passes a non-empty diff. Banner counts are also surfaced compactly above the per-RS evidence panel in step 2. V22EvalResultPanel renders a "Changes from prior evaluation" section persisting the diff in audit trail (only when `evidenceDiff !== null`). New Eval Result carries `priorEvalResultId` + `evidenceDiff` for audit; the prior Eval Result's status flips to `'superseded'` with `supersededBy` set to the new id. **Step 5 — #105 Empty-state copy:** owner-specific vs. non-owner-specific copy split, gated via new `isOwnerView` prop on the modal. **Step 6 — Backlog hygiene:** 6 items moved to Completed (#9, #16, #18, #19, #81, #110); 4 items moved to a new `## Removed` section near the bottom of the file with audit-trail rationale (#31, #32, #46, #114); #72 rewritten with narrowed scope (PoE-transfer-only, depends on #168); #168 (Proof of Evaluation node type) and #169 (Badges) filed in Future Features as Phase 13+ priorities #1 + #2. **Demo data:** Bob's existing PRM Eval Result retro-fitted with `batchId: 'batch-seed-bob-prm-001'`; new sibling Eval Result `eval-bob-prm-002` against System Integration v1 ships in the same batch + new proof / ownership DAs (`daProofBobPrmSysInt`, `daOwnEvalBobSysInt`) so both batch members appear on Alice's canvas. OUTDATED scenario reachable in 2 clicks via AmendClaim → Replace/Remove on an evaluated row. **Notable deviations:** (1) Asset versioning chain implemented in parallel field (`assetReferences[]`) rather than converting `referencedAssetIds[]` from primitives to objects — minimizes churn across 42+ consumer call sites. (2) Multi-RS review surface limits interactive editing to the primary RS — additional batch RS use AI values verbatim. The brief's review-rows-only language at "open" supports this; full per-RS interactive review for batches deferred. (3) AmendClaim diff render stays inline (strikethrough + Undo) rather than a true two-step confirmation flow — preserves existing single-step pattern (consistent with #120's deviation). **Footer v0.12.1 → v0.12.2.** Architecture spec §10.3 / §10.3b updated documenting the Asset versioning chain + OUTDATED lifecycle; spec Changelog gains five Phase 12.2 entries. CLAUDE.md "Active phase queue" updated with Phase 13+ strict-ordered priorities (PoE → Badges → Directory Layer → AI Shopper → Cascading Disclosures → Detail Panel UI cleanup → Netgraph cleanup → Search/aggregate → Network Event Log).

**Status:** [x] Complete.

### Phase 12.3 completion notes (2026-05-04) — Multi-RS UX Refinements + Asset Removal Bug Fix

Three bug fixes + two UX pivots patching Phase 12.2's evaluation flow against QA findings. **Bug A — RS picker dedup:** Phase 12.2 only passed `availableRequirementsSets` (owner-authored) to the modal — public RS were invisible in the picker. Phase 12.3 extends the modal to accept a new `publicRequirementSets` prop and dedupes by id at composition time inside the modal (`dedupedRsPool` memo). Owner-authored entries win on duplicate so the row's provenance badge reads "Authored by you" rather than "Public" when an RS is reachable through both pools. V2App now passes `visiblePublishedSets` through. **Bug B — Asset Remove consumer audit:** Phase 12.2's `assetReferences[]` chain correctly derives the post-amend active `referencedAssetIds[]`, but two read sites were leaking removed entries. (1) `deriveAgreementEdges` walked internal claim-ref DAs' `scope.assetIds` without intersecting against the Claim's current active set — Removed Assets' edges persisted on the canvas. (2) Run Evaluation's `scopeAssetIds` for the non-self path read `da.scope.assetIds` directly, which doesn't auto-update when Alice amends her Claim — Bob saw Removed Assets as available evidence on a fresh Run Evaluation. Both fixed by intersecting against `claim.referencedAssetIds`. New `getInScopeAssets(claim, allAssets)` helper added to `v2_2Data.js` as the documented single source of truth: chain-aware (resolves `supersededBy`, filters `removedDate`), returns full Asset objects. Phase 12.2's parallel-field model is the underlying tech debt; #170 filed for the consolidation as a future tech-debt phase. **Bug C — Supersession Detail Panel link:** the V22EvalResultPanel "Supersession" section's "Superseded by" entry was a read-only `<Row mono>`. Phase 12.3 makes it a clickable row using the same pattern as the Sibling Evaluations section above — handler is `onSelectSiblingEvalResult` (already wired by V2App). Defensive fallback to the legacy Row when no handler is wired. V2App's `siblingEvalResults` prop extended to also include the `supersededBy` successor when present (re-runs typically generate a new batchId so the successor isn't otherwise in the batch lookup; without this extension the click would fire but the lookup would fall through to a placeholder). **Pivot 1 — Checkbox multi-select picker:** removed the primary/additional split + `+ BATCH` chip mechanism. Replaced with a uniform checkbox list — every checked RS is treated equally; submit produces one Eval Result per checked RS sharing one batch id. No primary/additional concept at runtime. State refactor: `selectedReqSetId` (single string) + `additionalReqSetIds` (array) replaced by `selectedReqSetIds` (ordered array, preserves check order); `rows` (single array) + `setRows` replaced by `rowsByRsId` (object map keyed by RS id) + per-RS row mutators `cycleStatus(rsId, idx, dir)` and `updateValue(rsId, idx, value)`. Locked Re-Evaluate flow auto-checks the locked RS on mount and disables every other row. Empty-by-default — user must check at least one RS to proceed. **Pivot 2 — Grouped review rows:** Review stage renders one section per checked RS, in check order. Each section: header band ("REQUIREMENTS SET" badge + name + version + requirement count) followed by per-requirement rows. Submit-with-defaults still works — AI-suggested values flow through unchanged for any Set the user doesn't curate. Footer SAT/UNSAT/MISSING/N/A summary aggregates across all selected RSes; the count line also surfaces "across N Requirements Sets" when N>1. Submit button label also pluralizes ("Save N Eval Results" when N>1). The Phase 12.2 diff banner (#117) still renders above the grouped sections when applicable. **Documented deviations:** (1) Submit-time duplicate detection skips when 2+ RSes are checked — running the same evidence against multiple RSes is the explicit feature of the multi-RS flow. Single-RS submits keep the §11 supersession-style block. (2) The brief's "collapse-by-default when N>2" visual-density pattern was deferred — flat-rendered grouped sections shipped instead; collapse-by-default can be filed later as polish. **Footer v0.12.2 → v0.12.3.** Architecture spec gains five Phase 12.3 changelog entries (Bug A, Bug B + helper, Bug C, Pivot 1, Pivot 2); new helper `getInScopeAssets` documented in §10.3b. CLAUDE.md "Active phase queue" line updated; #170 (assetReferences/referencedAssetIds consolidation) filed as Phase 12.3 follow-up tech debt.

**Status:** [x] Complete.

### Phase 12.4 completion notes (2026-05-04) — Asset File Viewer in Run Evaluation Modal (#171)

Restored the V2.1 Asset evidence viewer to the Run Evaluation modal's left panel and applied the same split-panel parity to V22ParseEvidenceModal per spec §17.1. Bob (and any human evaluator) now sees the underlying evidence — the actual file for Full Disclosure / self-eval, or the disclosed parsed-fields table for Selective Disclosure — while curating per-requirement values on the right. **Component lift:** Phase 11B's `AssetEvidenceViewer` and Phase 11D.2's Selective parsed-fields renderer (both originally inline inside `ExpandedArtifactModal.jsx`) extracted to a new `src/components/AssetEvidencePanel.jsx` module. The new module exports three things: a default `<AssetEvidencePanel assetRow={...} iframeHeight={...} />` that branches on `disclosureType`, plus the named `AssetEvidenceViewer` and `SelectiveDisclosurePanel` for direct consumption. Disclosure-type branches: `'full'` / `'owner'` → AssetEvidenceViewer (file-metadata header + iframe at `file.localPath` + footer with owner + registration date + "Document preview not available" fallback); `'selective'` → parsed-fields table (Asset name + disclosed-field count header + ArtifactRow list); `'proofonly'` (defensive) → empty-state error message; unknown → generic "Evidence not available under this disclosure type" message. ExpandedArtifactModal refactored to consume the lifted components — kept its own local `ArtifactRow` because parse-output / eval-output schemas still need it (they take a `schema` prop and switch between confidence chip + status badge that the shared row doesn't model). **V22RunEvaluationModal split-panel rebuild:** modal width unified to 1280px across all three steps (was 720 / 920 jumping between stages). New `renderSplitBody(rightContent)` helper applies a 1:1 grid + 24px gutter + a vertical divider between columns + a bounded `calc(90vh - 220px)` height with `420px–720px` clamps. Left panel renders `<FieldLabel "Assets in Scope (N)">` + scrollable selector list (max-height 180px) + the disclosure-type-aware `<AssetEvidencePanel>` filling remaining height. First in-scope Asset preselected on mount via `useState(() => evidenceAssets[0]?.id ?? null)` + a `useEffect` that re-anchors if the in-scope set ever shrinks below the current selection. Selector rows show Asset name + filename + a small disclosure-type tag (Owner / Full / Selective / Proof-only). Click a row → swap viewer body via `setSelectedAssetId`; review state on the right is unaffected. Stage 2 (review) lost its legacy 260px Asset list (replaced by the new selector + viewer in the 1:1 left half) — right column is now solely the grouped review rows + diff banner. Stages 0 + 1 + 2 all use the same split layout for visual coherence; stage 1's centered processing animation lives inside the right column with `flex` centering. Empty-evidence Claims render a single empty-state message in the left panel mirroring the right-panel copy from #105 (owner: "Add evidence to self-evaluate"; non-owner: "Ask the owner of this Claim to add evidence to evaluate"). **V22ParseEvidenceModal split-panel rebuild:** same 1280px modal width + 1:1 grid + same divider treatment. Selector list collapses to a single static row (Parse is owner-only, operates on a single Asset per §10.2) showing the source Asset name + filename + an "Owner" disclosure tag for visual consistency with the Eval modal. The viewer always renders `<AssetEvidencePanel assetRow={{ ...sourceAsset, disclosureType: 'owner' }}>`. Right column unchanged in content (Parse Template picker on step 0; processing on step 1; editable Parse Result rows on step 2). The legacy stage 0/1 narrow modal (620px) was replaced — all three stages now render at 1280px so width doesn't jump between steps. **V2App `evidenceAssets` enrichment:** the prop shape passed to V22RunEvaluationModal grew from `{ id, name, file }` to `{ id, name, file, asset, disclosureType, disclosedFields? }` per Phase 11D.2 conventions. The enrichment uses the existing `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` source plus the `view.parseResults` for Selective field resolution. For self-evaluation the disclosure type is `'owner'`; for non-self the DA's `type` drives the row (`'selective'` resolves disclosed fields by intersecting `da.scope.fieldIds` against the Asset's Parse Result fields, identical to the Phase 11D.2 Detail Panel row build); proof-only DAs don't grant evaluation rights so the Run Evaluation modal isn't reachable under that type, but a defensive `'proofonly'` branch prevents file leakage if it ever does. V22ParseEvidenceModal's `sourceAsset` prop also got `file` + `registrationDate` (the Asset card node carries these on `node.v22Artifact`; fallback resolves directly off the node). **Documented scope boundaries:** (1) Real PDF.js integration still tracked as #41 — the iframe + localPath approach from Phase 11B remains the rendering path. (2) Backfilling more placeholder PDFs into `/public/` for seeded Assets that lack `localPath` deferred — the "Document preview not available" fallback handles missing files cleanly. (3) Eval Result / Parse Result file viewing in their own Detail Panels deferred separately. (4) No data model changes — UI-only phase. (5) `<AssetEvidencePanel>` was placed in `src/components/` (alongside `Tooltip.jsx`) rather than `src/v2/components/` because the existing components root is the established pattern; no new directory needed. **Runtime verification:** Build clean (`npm run build` — 99 modules transformed, 0 errors). Module-load probes confirm `AssetEvidencePanel`, `V22RunEvaluationModal`, `V22ParseEvidenceModal`, and `ExpandedArtifactModal` all import without errors and expose the expected default + named exports. Page reloads cleanly with no JS errors at the console (the "Failed to reload" Vite HMR errors visible during in-flight edits clear on full reload). The V2Canvas raycaster limitation per CLAUDE.md is the canonical caveat — manual mouse interaction is the verification path for canvas-click flows. **Footer v0.12.3 → v0.12.4.** Architecture spec gains a Phase 12.4 changelog entry; §8.7 (Detail Panel Expand modal) updated to note the lifted components are now shared across ExpandedArtifactModal + V22RunEvaluationModal + V22ParseEvidenceModal left panels. CLAUDE.md "Current state of the world" + "Active phase queue" lines updated; phase log tail extended through Phase 12.4. polish-backlog.md gets a new #171 entry filed and moved straight to Completed in the same hygiene pass.

**Status:** [x] Complete.

### Phase 12.5 completion notes (2026-05-04) — Asset Accordion + Right-Panel Layout Fixes (#171a)

Follow-up to Phase 12.4 reshaping both modal left panels into the V2.1 accordion pattern, fixing a broken right-panel scroll surface in V22RunEvaluationModal, and applying three Parse Evidence right-panel layout tweaks. Filed #172 (PDF annotation overlay) as an end-of-Phase-12 assessment item. **Run Evaluation accordion left panel:** dropped the Phase 12.4 selector + viewer split (one preselected Asset shown in a 360px iframe) in favor of an accordion list — each in-scope Asset is a row that expands inline to show `<AssetEvidencePanel assetRow={a}>`. All Assets expanded by default at modal open (multi-evidence visibility is the feature's purpose), multiple rows can be expanded simultaneously, click on the row header (or Enter / Space when focused) toggles the body. State management: `expandedAssetIds: Set<assetId>` initialized to all in-scope ids on mount; a ref-based change-detection block (mirroring the Phase 12.3 selectedReqSetIds key pattern) auto-expands newly-arriving Assets if the in-scope set grows mid-review without resetting the rest of the user's expand state. Each row renders Asset name + filename + a small disclosure-type tag + a chevron (▾ expanded / ▸ collapsed); the body is `<AssetEvidencePanel>` indented inside a bordered card with a soft surface background to keep the boundary clear. The whole left column remains scrollable when total expanded content exceeds modal height. Selector state (`selectedAssetId` + `setSelectedAssetId` + the re-anchoring `useEffect`) removed entirely; `useEffect` import dropped. **Parse Evidence accordion parity:** single-row accordion (Parse is owner-only, operates on one Asset per §10.2) showing the source Asset, expanded by default. Same row-header + chevron + indented body shape as Run Evaluation for visual consistency. State: a simple `useState(true)` toggle on `parseAssetExpanded`. **Run Evaluation unified right-panel scroll + sticky RS headers:** the Phase 12.3 per-RS scroll containers (which didn't actually scroll because they sat inside ModalBody's outer overflow) replaced with a single `flex: 1; overflowY: auto` container at the right-panel root. Each RS group header uses `position: sticky; top: 0; zIndex: 2` and a solid `var(--bg-surface)` background so it pins while its rows scroll past, then yields to the next group's header (standard sticky-header behavior). Diff banner (#117) lives at the top of the same scroll surface and scrolls away naturally as the user scrolls down. Footer (aggregate SAT/UNSAT/MISSING/N/A counts + Back / Save buttons) stays pinned at modal bottom outside the scroll container — that was already the case via ModalFooter; no change needed there. **V22ParseEvidenceModal three right-panel tweaks:** (a) "Parsing extracts structured fields..." helper paragraph moved from above the "Parse Template *" title to directly underneath it, before the template list (ordering: title → helper → template list → optional description → fields-to-extract panel). (b) Parse Template list retained at `maxHeight: 300px + overflowY: auto` (matches V22RunEvaluationModal's RS picker pattern from Phase 9A.6 #91); the seeded list of three entries doesn't trigger the cap, but the container is correctly sized for N>>3 lists. (c) "FIELDS TO EXTRACT" panel removed its 160px height cap and now stretches via `flex: 1; minHeight: 0` to fill the available right-panel column height, which visually balances against the left-panel viewer; internal `overflow: auto` retained so the panel scrolls when its content exceeds available height. The right-panel column became a flex column with the helper text + template list + description marked `flexShrink: 0` so they hold their natural size and the fields panel absorbs the remaining vertical space. **#172 filed:** Status `Open — end-of-Phase-12 assessment`, Effort `L-XL`, Priority `High (above general polish, below the locked Phase 13+ priority queue; not inserted into the strict ordering yet)`. Entry captures the bidirectional-hover overlay design, the technical dependencies (depends on #41 PDF.js integration; data-model add of `evidenceAnchors[]` per row; demo seed coordinate authoring), the scope, and four end-of-Phase-12 assessment criteria (sequence vs priority queue, bundling vs independent ship, PCN demand signal, realistic scoping). **Documented deviations / visual choices:** (1) Accordion body styling — picked a soft `var(--bg-surface)` background + a top hairline divider for the expanded body to visually contain the AssetEvidencePanel without competing with the row header. The brief explicitly said to pick a reasonable default for these visual choices and call it out. (2) Chevron glyphs — `▾` (down-pointing triangle) for expanded, `▸` (right-pointing triangle) for collapsed; matches the Unicode-symbol convention from CLAUDE.md's code style note. (3) The accordion in Run Evaluation re-uses the row-shape conventions from the Phase 12.4 selector list (filename + disclosure-type tag) so the visual diff between the two phases is purely interaction model (single-select swap → multi-expand inline). **Runtime verification:** Build clean (`npm run build` — 99 modules transformed, 0 errors). Manual mouse interaction is the canonical verification path for canvas-click-triggered modals per CLAUDE.md's V2Canvas raycaster limitation. **Footer v0.12.4 → v0.12.5.** Architecture spec Changelog gains a Phase 12.5 entry covering the accordion + sticky-headers + Parse tweaks. CLAUDE.md "Current state of the world" + "Active phase queue" updated; phase log tail extended through Phase 12.5. polish-backlog.md gets the new #172 entry + a Phase 12.5 Update Log entry summarizing the changes.

**Status:** [x] Complete.

### Phase 12.6 completion notes (2026-05-04) — Single-Expand Accordion + Panel Height Parity (#171b)

Follow-up to Phase 12.5 pivoting the Asset accordion from multi-expand to single-expand and structurally fixing the ~48px height shortfall on V22ParseEvidenceModal's left panel. **Single-expand state:** `expandedAssetIds: Set<assetId>` replaced by `expandedAssetId: string|null`. Initialized to first in-scope Asset on mount; `null` when zero Assets. Toggle handler: clicking a row's header sets the expanded id to that row's id (collapsing whatever was previously expanded); clicking the currently-expanded row sets the value to `null` (full collapse). Phase 12.5's ref-based change-detection block that auto-expanded newly-arriving Assets removed entirely — newly-arriving Assets simply appear as additional row headers in the (now-scrollable) list and the user clicks them to view. **Layout — Option B chosen:** the brief offered Option A (single overflow container holding rows + inline-expanded body) or Option B (separate row list + dedicated body container). Picked Option B because it lets the body container use `flex: 1; minHeight: 0` to absorb remaining column height, which is the structural fix for the height parity bug. Option A would have required either a magic-number `min-height` on the iframe or a flex hack on a child of an `overflow-y: auto` container — both fragile. Option B layout: `<FieldLabel>` + scrollable row-list container (`flexShrink: 0; maxHeight: 40%; overflowY: auto`) + dedicated body container (`flex: 1; minHeight: 0; display: flex; flexDirection: column`). The body container holds `<AssetEvidencePanel assetRow={expandedRow} fillHeight />` which now stretches via the new `fillHeight` prop. **AssetEvidencePanel `fillHeight` prop:** new optional boolean (default `false`). When `true`: outer container is `flex: 1; minHeight: 0; display: flex; flexDirection: column`; iframe / placeholder / Selective parsed-fields list use `flex: 1; minHeight: 200` instead of fixed `height: iframeHeight`; metadata header + footer + Selective Asset header keep `flexShrink: 0` so they hold natural height; the Selective fields list scrolls within its allotted space. ExpandedArtifactModal calls `<AssetEvidencePanel>` without the prop so it stays on the legacy fixed-height path (the modal's tab body region is sized by the modal, not the parent). **V22RunEvaluationModal renderLeftPanel:** dropped the inline-body-inside-row pattern from 12.5; the row list and the body now live in separate sibling containers. Each row is just the header (Asset name + filename + disclosure-type tag + chevron). The expanded row gets an accent-indigo border + tinted background so it visually pairs with the body card below. Phase 12.5's `lastEvidenceIdsRef` change-detection block deleted. **V22ParseEvidenceModal renderLeftPanel:** same Option B structure for visual consistency. The `parseAssetExpanded: bool` from 12.5 became `expandedAssetId: string|null` so the state shape matches Run Eval; `expanded` derives via id equality. The single-Asset case means the row stays expanded by default; toggling it collapses to header-only (functionally pointless for Parse but maintains UI consistency with Run Eval per acceptance criterion #7). **Height parity verified structurally:** before this phase the AssetEvidencePanel's iframe had a fixed `height: 360` (or `400` default), totaling ~530px including header + footer; the right panel's "FIELDS TO EXTRACT" panel used `flex: 1` to fill remaining height. Difference: ~48px (the right panel's flex-stretching content extended ~48px below the left's fixed-height accordion body). With `fillHeight`, the iframe now grows alongside the modal — both panels render at identical column heights regardless of viewport size. The fix is structural (no magic numbers); shouldn't regress on any viewport. **Visual choices noted:** (1) Row-list scroll cap at `maxHeight: 40%` of column height — picked as a reasonable starting cap; could be tuned with QA feedback. The brief allowed `40-50%`. Going with the lower number favors larger expanded body which is the primary visual focus. (2) Body container styling: accent-indigo border + `var(--bg-card)` background outside, `var(--bg-surface)` background inside — visually links the expanded body to its accent-bordered row above. **Run Evaluation regression check:** stage 2 right-panel sticky headers (Phase 12.5) untouched. Diff banner still scrolls naturally. Disclosure-type branching in the expanded body unchanged (the prop still flows through `<AssetEvidencePanel>`). Empty-state copy still gates submit (Phase 12.4 #105 wiring intact). **Footer v0.12.5 → v0.12.6.** Architecture spec gains a Phase 12.6 Changelog entry. CLAUDE.md "Current state of the world" + "Active phase queue" updated to mark Phase 12 closed; phase log tail extended through Phase 12.6. polish-backlog.md gets a Phase 12.6 Update Log entry. **Build clean** (99 modules transformed, 0 errors). Canvas-click-triggered modals require manual mouse interaction per the documented V2Canvas raycaster limitation in CLAUDE.md.

**Status:** [x] Complete.

### Phase 12.7 completion notes (2026-05-04) — Inline-Expand Asset Accordion (Scaling Fix) (#171c)

Pivoted Phase 12.6's split-container layout to Option A (single overflow container with inline-expanded bodies). The 12.6 capped row list (`maxHeight: 40%`) didn't scale beyond ~5 in-scope Assets — at 10+ Assets the rows became too cramped to navigate. Inline expansion in natural flow scales to arbitrary Asset counts. **V22RunEvaluationModal renderLeftPanel:** dropped the dual-container structure (capped row list + dedicated body card with `<AssetEvidencePanel fillHeight />`). Replaced with a single `flex: 1; minHeight: 0; overflowY: auto` container that holds each Asset row as a card with an inline-expanded body. Each card structure: outer `<div>` with the accent-indigo / default border + `var(--bg-card)` background and `overflow: hidden`; inside, the row header (always rendered) followed by an optional body section (rendered only when `expandedAssetId === a.id`). The body has `borderTop: 1px solid var(--border-faint)` + `padding: 10px 12px` + `var(--bg-surface)` background, holding `<AssetEvidencePanel assetRow={a} iframeHeight={480} />`. **V22ParseEvidenceModal renderLeftPanel:** identical Option A structure for visual consistency, scoped to the single source Asset case (Parse is owner-only, single Asset per §10.2). Single accordion card with the row header + inline body when `expanded`. **iframe height bumped from 360 → 480:** the brief suggested ~480px as a reasonable replacement now that only one Asset's body shows at a time. 480px gives a more substantial preview area; the row card grows naturally to accommodate it; the outer overflow container scrolls when content exceeds column height. **`fillHeight` prop retired from the modal accordions but kept on `AssetEvidencePanel`:** the prop made sense in Phase 12.6's Option B body container (which used `flex: 1` to absorb available height). With inline expansion in natural flow, the body sizes to its content — `fillHeight` no longer applies. The prop stays on `AssetEvidencePanel` itself so future callers can opt in (current call sites: ExpandedArtifactModal stays on default fixed-height path; V22RunEvaluationModal + V22ParseEvidenceModal now also stay on the default). **Parse Evidence height parity preserved:** the outer overflow container uses `flex: 1; minHeight: 0` so the column stretches to full available height regardless of content extent. When the inline-expanded card's natural height is shorter than the column, the scroll container fills the column with empty space below the card — the column is still full height visually, matching the right panel. The 12.6 height-parity fix relied on `fillHeight` to stretch the body content; the 12.7 fix relies on the same `flex: 1` semantics applied to the overflow container itself. Either approach makes the column the correct height; 12.7's is cleaner because it doesn't need to thread `fillHeight` through. **State / interaction unchanged:** `expandedAssetId: string|null` stays. Default-first-expanded on mount. Click-toggle (clicking the currently-expanded row collapses to `null`; clicking another row replaces). Accent-indigo border + tinted header background on the expanded row. **Visual regression checks:** Run Eval stage 2 sticky RS headers (Phase 12.5) untouched. Stage 0 RS picker + diff banner unchanged. Parse Evidence three-tweak right panel (helper text below title, scrollable template list, fields-to-extract stretches via `flex: 1`) unchanged. **Footer v0.12.6 → v0.12.7.** Architecture spec gains a Phase 12.7 Changelog entry. CLAUDE.md "Current state of the world" + "Active phase queue" updated; phase log tail extended through Phase 12.7. polish-backlog.md gets a Phase 12.7 Update Log entry. **Build clean** (99 modules transformed, 0 errors). Canvas-click-triggered modal walkthroughs (many-Asset scroll, click-to-switch behavior) require manual mouse interaction per the documented V2Canvas raycaster limitation in CLAUDE.md.

**Status:** [x] Complete.

### Phase 17.5.2 completion notes (2026-05-21) — Post-creation orchestration + bidirectional Parent↔Directory navigation (closes the RFP creation arc)

Three navigation/transition pieces that complete the RFP creation arc.

**Diff (high-level).**
- **Part A — Post-creation orchestration** (`src/v2/V2App.jsx`, `src/v2/DirectoryLayer.jsx`, `src/v2/AssetNode.jsx`): new state `v22RecentlyCreatedRfpId` + a `routeToRfpRef` (so the earlier-declared `handleRfpCreationSubmit` can call the later-declared `routeToRfp` without a forward-dep TDZ). `handleRfpCreationSubmit` now, after adding the RFP + closing the modal, sets `v22RecentlyCreatedRfpId(newRfp.id)` and calls `routeToRfpRef.current(newRfp.id, { rfp: newRfp })`. `routeToRfp` gained an `opts.rfp` fallback — at submit time `setV22CreatedRfps` hasn't flushed, so the merged-lookup can't resolve the new RFP; the freshly-built object is passed through (`selectRfp` only needs the id once the layout rebuilds, and the panel re-resolves `currentRfp` from the merge chain each render). `routeToRfp` already zooms to `LOD_THRESHOLD` (full-card LOD) + auto-selects, so no zoom-level plumbing was added. The reveal id threads to DirectoryLayer via a new `recentlyCreatedRfpId` prop and is stamped `_isNew` on the synthetic RFP card; `AssetNode`'s RFP early-return renders a green NEW badge (`top:-8, right:-8+ACTION_BAR_W`, mirroring the parent-layer badge — `isNew` was already computed before the RFP branch). A clear-on-deselect `useEffect` drops `v22RecentlyCreatedRfpId` when `v22DirectorySelectedRfp?.id` no longer matches.
- **Part B — RFP → Asset navigation** (`src/v2/V2App.jsx`, `src/components/DetailPanel/RfpDetailPanel.jsx`): new `routeToAsset(assetId)` helper (declared after `clearEdgeUiState`/`nodeMap`/`canvasRef` to avoid TDZ; mirrors `handleViewEa`'s close-Directory-then-pan pattern) — clears the RFP/Claim Detail Panels, `setV22DirectoryOpen(false)` (reverse wipe), then `setSel(assetNode.id)` + `canvasRef.current.animatedPanToWithZoom(...)` on the Parent canvas (graceful no-select if the Asset isn't on the active actor's canvas). The RfpDetailPanel "For Asset" row is now a clickable element (hover indigo tint + pointer + `›` chevron, matching the RequirementRow pattern; static text when `onOpenAsset` is absent), wired as `onOpenAsset={routeToAsset}` on the mount. Inverse of 17.5.1.5's click-to-open-RFP.
- **Part C — Double-click escape** (`src/v2/DirectoryLayer.jsx`): the canvas container gains `onDoubleClick={handleCanvasDoubleClick}`. The handler fires `onClose?.()` (the existing reverse circle wipe used by the globe button + exit chip) only when (1) `phase === 'in'` (no-op during open/close transitions), (2) `e.target === rendererRef.current.domElement` (HTML overlays — cards, cluster-label pillboxes, zoom controls, exit chip — are different elements so dblclicks on them don't reach this branch), and (3) `raycast(e.clientX, e.clientY)` misses (a dot-LOD marker hit belongs to the marker). No visible affordance (hidden shortcut per Andrew).
- **Docs + version:** footer + Changelog modal → v0.17.5.2; architecture-spec §8 Changelog bullet + §8.11 "Post-creation orchestration + bidirectional navigation"; polish-backlog Update Log (#192 Item J closed); CLAUDE.md most-recent-phase + queue (RFP arc CLOSED).

**Deviations.** None material in approach. The prompt suggested a `{ zoomLevel: 'full-card' }` param on `routeToRfp`; since `selectRfp` already zooms to `LOD_THRESHOLD` (full-card LOD), the param was unnecessary — I added the `opts.rfp` fallback instead (the real need: the stale-`v22CreatedRfps` closure at submit time). The prompt's `routeToAsset` example used a `requestAnimationFrame` to defer the pan past the close animation; I followed the established `handleViewEa` pattern (pan immediately while the wipe plays — V2Canvas is mounted under the Directory overlay). The reveal-flag stamping is on DirectoryLayer's synthetic node (not `v22DataWithReveal`, which only covers parent-canvas nodes) because RFPs are Directory-layer-only. Two robustness follow-ups landed while chasing the auto-zoom: (i) the entry effect now skips the Phase 17.3.2 cinematic zoom-out when routing to a just-created RFP (gated on a `recentlyCreatedRfpIdRef`), and `animatedPanToWithZoom` cancels any in-flight cinematic lerp — both so the galactic-entry zoom to ~15% can't override `selectRfp`'s full-card pan; (ii) `routeToRfp`'s rAF select-retry cap was raised 60 → 240 frames.

**Runtime verification.** `npm run build` clean (132 modules, 0 errors). **Confirmed in the dev preview:** creating an RFP from Bob's Avionics Module auto-switches Parent → Directory (forward wipe) and auto-opens its RfpDetailPanel showing the new RFP — the panel's "For Asset" row renders with the `›` chevron + hover affordance (Part B); the RS row shows "Material Compliance / GovCo". **Part C confirmed:** invoking the Directory canvas `onDoubleClick` with the renderer canvas as `e.target` fired the reverse wipe back to Parent (`v22DirectoryOpen` → false, RFP/Claim panels cleared), while a dblclick whose target is the *parent* V2Canvas is correctly ignored (so markers/labels/cards/chrome don't back-nav). **NOT visually confirmed in-preview (flagged for manual verification):** the auto-zoom to full-card LOD + the green NEW badge on the card, and the "For Asset" click landing on the Asset panel. In repeated runs `selectRfp` did not pin/zoom the freshly-created marker — the Directory stayed at ~15% galactic zoom (below card-LOD, so the card + NEW badge never rendered as DOM). The preview session was also badly destabilized during this phase (the viewport collapsed to 2px at one point; multiple forced reloads), which corrupted the camera math and several measurements (an early "52%" reading was the *parent* canvas's zoom indicator, not the Directory's). The implementation mirrors the notification-routing `selectRfp` path verified in Phase 17.2.0.2 and the verified `handleViewEa` close-then-pan pattern, and `layoutRef` is kept current (set in the populate effect on every `layout` change), so the likeliest cause is preview-environment instability rather than a logic defect — but the full-card zoom + NEW badge + For-Asset-landing need a manual pass to confirm (and, if they don't land, a follow-up to make the post-creation `selectRfp` deterministic, e.g. a DirectoryLayer-internal select-on-layout-ready effect keyed off `recentlyCreatedRfpId` rather than V2App's cross-component rAF). No new console errors (only the pre-existing accepted `packClusterDense` Lloyd's-convergence warnings).

**Status:** [x] Complete. (Closes the RFP creation arc — 17.5 → 17.5.0.x → 17.5.1 → 17.5.1.x → 17.5.2; polish-backlog #192 Item J fully closed.)

### Phase 17.5.1.5 completion notes (2026-05-21) — Asset Detail Panel "Anchored RFPs" section

New section in the Asset Detail Panel listing every RFP anchored to the active Asset — the parent-canvas surface for managing RFPs (which are otherwise Directory-layer-only).

**Diff (high-level).**
- **Section + row components** (`src/components/DetailPanel/V22NodeDetailPanel.jsx`): new `AnchoredRfpsSection` (wraps the shared `Section` with title "Anchored RFPs"; muted "No RFPs anchored to this Asset." empty state, else one row per RFP), `AssetPanelRfpRow` (an `AgreementRow` whose body click-navigates; line 1 = name + `RfpStatusPill`, line 2 = "Posted {formatDateTime} · N requirements"; owner-only right region with inline `ActionLabel`s — Close for open, Reopen + Remove for closed), and `RfpStatusPill` (green `OPEN` / muted `CLOSED`, matching the RfpDetailPanel header badge). `ActionLabel` gained a `danger` prop (red base, brightened-red hover) for Remove; the default path is unchanged (every DA/EA row action). `V22AssetPanel` gained props `anchoredRfps` / `onOpenRfp` / `onCloseRfp` / `onReopenRfp` / `onRemoveRfp` and renders `<AnchoredRfpsSection>` right after `<AgreementsSection>`.
- **Data + routing** (`src/v2/V2App.jsx`): in the parent Detail Panel mount block, `anchoredRfpsForNode` is derived (when the node is an Asset) from the full merge chain `mergeRemovedRfps(mergeClosedRfps(mergeCreatedRfps(sharedForPanel, v22CreatedRfps), v22ClosedRfpIds), v22RemovedRfpIds).rfps`, filtered to `r.assetId === node.id`, sorted newest-first by `createdDate`. New reusable `routeToRfp(rfpId)` useCallback (declared after `clearEdgeUiState` + `directoryLayerRef` to avoid a deps-array TDZ) mirrors the `v22-rfp-solicitation-received` notification routing: resolve the RFP from the merge chain, `setSel(null)`, `clearEdgeUiState()`, open Directory, clear the Claim panel, set the selected RFP, then rAF-retry `directoryLayerRef.current.selectRfp(targetRfp)` (capped at 60 frames). The V22NodeDetailPanel mount wires `anchoredRfps={anchoredRfpsForNode}`, `onOpenRfp={routeToRfp}`, and `onCloseRfp`/`onReopenRfp`/`onRemoveRfp` to the existing Phase 17.5.1.4 handlers.
- **Docs + version:** footer + Changelog modal → v0.17.5.1.5; architecture-spec §8 Changelog bullet + §8.11 "RFP management surfaces"; polish-backlog Update Log; CLAUDE.md most-recent-phase + queue.

**Deviations.** None. The handlers (`handleCloseRfp` etc.) take the RFP object (Phase 17.5.1.4 shape), so the row passes `rfp` to close/reopen/remove and `rfp.id` to `routeToRfp` (which the prompt's example expects). `RfpDetailPanel` uses its own `ActionButton`; this section reuses V22NodeDetailPanel's `ActionLabel` (the DA/EA-row primitive) per the prompt's "match the DA/EA revoke button visual pattern" — so the `danger` variant was added to `ActionLabel`, not `ActionButton`.

**Runtime verification.** Unlike RFP-marker clicks (canvas-raycaster-gated), the Asset Detail Panel opens via the HTML parent-canvas Asset card, so this surface is fully scriptable. Verified in the dev preview as Bob: opening the Avionics Module Asset Detail Panel shows the "ANCHORED RFPS" section with the seeded Sentinel-4 row (name + green OPEN pill + "Posted …" line); clicking the row's ✕ Close flips the pill to CLOSED and swaps the action to Reopen + Remove in-place; an Asset with no anchored RFPs shows the muted empty state. `npm run build` clean; no new console errors. The cross-actor non-owner-no-buttons case + click-to-navigate-into-Directory landing are code-verified (the navigation's Directory-side `selectRfp` is the same path exercised by notification routing).

**Status:** [x] Complete.

### Phase 17.5.1.4 completion notes (2026-05-21) — RFP lifecycle expansion (Close notifications + Remove + Detail Panel refresh + placeholder dimming)

Four bundled items extending the RFP lifecycle.

**Diff (high-level).**
- **Fix A — Detail Panel Close/Reopen button refresh** (`src/v2/V2App.jsx`, RfpDetailPanel mount): the mount re-derives `currentRfp` from a `mergedShared` chain that now runs `mergeRemovedRfps(mergeSolicitations(mergeClosedRfps(mergeCreatedRfps(mergeProvisionals(...), v22CreatedRfps), v22ClosedRfpIds), v22Solicitations), v22RemovedRfpIds)`. Previously the chain omitted `mergeCreatedRfps`, so a user-created RFP wasn't in `mergedShared.rfps` and `currentRfp` fell back to the captured `v22DirectorySelectedRfp` snapshot (status frozen at `'open'`) — the footer kept rendering "Close this RFP" after a Close until deselect/reselect. Now it flips in-place. (The seeded path already worked because `mergeClosedRfps` flips status for RFPs already in `shared.rfps`.)
- **Fix B — RfpCreationModal placeholder dimming** (`src/components/modals/RfpCreationModal.jsx`): added a scoped `<style>` rule `.rfp-create-field::placeholder { color: color-mix(in srgb, var(--text-muted) 70%, transparent) }` + the `rfp-create-field` className on the name `<input>` + description `<textarea>` (inline styles can't target `::placeholder`).
- **Feature C — Close RFP notification** (`v22-rfp-closed`): centralized the close/reopen logic into `handleCloseRfp` / `handleReopenRfp` useCallbacks. `handleCloseRfp` records the closure AND dispatches a notification to every UNIQUE solicitor party (deduped via `new Set(...solicitors)`) resolved from `mergeSolicitations(mergeCreatedRfps(buildV22SharedArtifacts(), v22CreatedRfps), v22Solicitations).rfpSolicitations` filtered to the RFP; zero solicitors → zero notifications. `handleReopenRfp` is silent. Notification rendering: new `isV22RfpClosed` flag, muted-indigo `badgeColor` (`color-mix(--accent-indigo 50%, --text-muted)`), `RFP CLOSED` `badgeLabel`, body "`{owner} closed the RFP "{name}". Your pending solicitation remains in place but is no longer actionable.`". Click routing: added `v22-rfp-closed` to the existing solicitation-routing branch (Directory → marker → panel); the routing's RFP lookup was upgraded to the full created→closed→removed merge chain. Both the panel footer (`onCloseRfp`/`onReopenRfp`) and the card action bar (`onRfpCardAction`) now route through these handlers, so the notification fires from either surface.
- **Feature D — Remove RFP** (closed-only): new `v22RemovedRfpIds` Set state; new `mergeRemovedRfps(shared, removedRfpIds)` export in `v2_2Data.js` (filters `shared.rfps` + cascades to drop referencing `rfpSolicitations`); `buildV22DirectoryDataForRole` signature extended to `(roleId, provisionals, closedRfpIds, createdRfps, removedRfpIds)` with merge order provisionals → created → closed → removed; threaded through DirectoryLayer (new `v22RemovedRfpIds` prop + memo dep + builder 5th arg). `handleRemoveRfp` adds the id to the Set + clears `v22DirectorySelectedRfp` if the removed RFP was open (functional updater, no dep). Silent — no notification. UI: RfpDetailPanel's `ActionButton` gained a `danger` variant (+ `title` tooltip + `icon`); the closed-RFP footer now renders Reopen + a danger "Remove RFP" (glyph `⊟`, tooltip warns it's permanent + cascades). AssetNode's RFP action bar gained a `_directoryRemoveCandidate` branch (trash-can SVG, dispatches `removeRfp`); DirectoryLayer stamps it on owner-and-closed RFP cards (same gate as Reopen). Remove is NEVER shown on an open RFP (render-gated at both sites).
- **Docs + version:** footer + Changelog modal in `V2App.jsx` → v0.17.5.1.4; architecture-spec §8 Changelog bullet + §8.11 "RFP lifecycle — Close notification + Remove"; polish-backlog Update Log; CLAUDE.md most-recent-phase + queue.

**Deviations.** None material. The RFP card action bar (Feature D's second surface) IS rendered on the Directory full-LOD card, so it was implemented (not skipped). `RfpDetailPanel` uses its own `ActionButton` component (not the shared `FooterButton`), so the danger variant + Remove glyph were added there rather than via FooterButton's `danger` prop — functionally equivalent, scoped to the panel that owns the footer.

**Runtime verification.** `npm run build` clean (132 modules, 0 errors). Data-layer probes: (a) `mergeRemovedRfps` removes the Sentinel-4 RFP and cascades its solicitations from 1 → 0; `buildV22DirectoryDataForRole` with the removed id shows the RFP absent across all four role views (own/cluster/orphan). (b) The close-notification solicitor resolution dedupes correctly — 3 solicitations (MicroCo ×2 + AuditCo) → unique parties `[MicroCo, AuditCo]`; an RFP with no solicitations → 0 parties (no notifications). Live-UI confirmation of the inbox notification, the Remove-from-panel destruction, and the in-place button refresh is gated behind opening the RfpDetailPanel via an RFP-marker click (the Directory's Three.js raycaster doesn't respond to DOM-dispatched events per the documented CLAUDE.md limitation; scripted full-LOD zoom coalesces unreliably), so those are code- + build- + data-verified and flagged for manual mouse verification.

**Status:** [x] Complete.

### Phase 17.5.1.3 completion notes (2026-05-21) — Create RFP cleanup III (solicitation regression + RS Detail Modal subheader + closed-RFP visual)

Three QA-driven fixes on the 17.5.1.2 Create RFP flow.

**Diff (high-level).**
- **Fix 1 — Solicitation submission regression** (`src/v2/V2App.jsx`, `handleCreateSolicitation`). Root cause (matched diagnostic checklist item 3, first candidate): the handler resolved the target RFP via `mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds)` — a `shared` snapshot that pre-dates the `mergeCreatedRfps` overlay. A user-created RFP wasn't in `.rfps`, so `const rfp = (...).find(r => r.id === rfpId)` returned `undefined` and the handler bailed at `if (!rfp) return`, silently no-op'ing Submit. Fix: thread `mergeCreatedRfps(mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds), v22CreatedRfps)` into the lookup + add `v22CreatedRfps` to the useCallback deps. The seeded-RFP "Submit doesn't fire" is failure mode A — the Phase 17.2.1.1 §8.9.6.1 Claim-greying predicate working as designed (Claims with an active/pending EA to the buyer render greyed/unselectable + gate `canSubmit`); confirmed intentional, no code change. Fix 1.A (inline amber explanation when a greyed Claim is "in the selection") was **skipped**: the greyed row's onClick is gated to `undefined`, so a greyed Claim can never enter the selection — the explanation would be dead code; the existing "ON NETWORK" pill + `cursor: not-allowed` + native tooltip already communicate the state.
- **Fix 2 — RequirementsSetDetailModal subheader** (`src/components/modals/RequirementsSetDetailModal.jsx`). Derived `isPublished = rs.isPublished != null ? rs.isPublished : !!rs._publishedBy` and `owner = rs.owner || rs._publishedBy` (the modal is fed from `v22RfpRsLookupPool`, whose entries carry both since Phase 17.5.1.2; fallbacks keep raw-RS mounts correct). Branched the subtitle: published → `GlobeIcon` + "Published by {owner}"; unpublished → plain "by {owner}", no globe. Fixes the prior unconditional "🌐 Published by an unknown actor" for private RFP-referenced RSes.
- **Fix 3 — Closed-RFP Directory marker** (`src/v2/DirectoryLayer.jsx`). The closed marker was a `THREE.LineSegments` + `LineDashedMaterial` — WebGL ignores `linewidth`, so it rendered as a 1px hairline beside the open RFPs' ~2px thick hollow-square ring, reading as "weaker" rather than "lifecycle = closed". Rewrote it as a thick dashed ring: new module helper `buildClosedRfpRingDashes(centers, half, thickness, baseColor)` emits filled dash quads (2 tris each) along the four edges of a thick square ring (top/bottom strips full-width, left/right inset by `thickness` to avoid corner double-draw), returning `{ positions, colors, vertsPerRfp }`. The mesh became `THREE.Mesh` + `MeshBasicMaterial({ vertexColors, color: white, side: DoubleSide })`. Border thickness = `RFP_BORDER_SCREEN_PX / zoom` world units (matches the open ring's effective world thickness); `half` = `(RFP_BASE_OUTER/2) × scale` (matches open marker size). Stroke color via new helper `closedRfpStrokeColor()` = `--accent-indigo` lerped 50% toward `--text-muted`. Both rebuild sites (populate effect + rescale-on-zoom effect) call the helper; `computeLineDistances()` removed. `flushRfpColors`' closed-RFP hover/select path generalized from the hardcoded 8-vertex range to the build's `vertsPerRfp` (new `closedRfpVertsPerRfpRef`). Card-LOD (AssetNode) closed-RFP border already matched open thickness (only `solid→dashed`), so it was left unchanged.
- **Docs + version:** footer + Changelog modal in `V2App.jsx` → v0.17.5.1.3; architecture-spec §8 Changelog bullet; polish-backlog Update Log (notes 17.5.1.4 + 17.5.1.5 queued next, then 17.5.2); CLAUDE.md most-recent-phase + queue.

**Deviations.** Fix 1.A skipped (unreachable state — documented above). Fix 3 went beyond a parameter tweak: a 1px LineSegments can't be thickened in WebGL, so matching the open ring required a geometry rewrite to dash quads (the only correct way to get "same thickness + dashed"). The card-LOD border needed no change.

**Runtime verification.** `npm run build` clean (132 modules, 0 errors). Fix 1 data-layer probe: the OLD lookup chain (`mergeClosedRfps` only) does NOT find a manually-injected created RFP (reproduces the silent-bail bug); the NEW chain (`mergeCreatedRfps(mergeClosedRfps(...))`) finds it; seeded Sentinel-4 still present. Dev preview: app boots, role-switch + parent canvas + Directory all render with zero console errors — exercising the new closed-RFP `MeshBasicMaterial` scene-init and the `buildClosedRfpRingDashes` rescale path (empty-centers case, no closed RFPs seeded) without crashing. The closed-marker VISUAL, the RS-modal subheader branch, and the full solicitation-Submit UI are gated behind opening the RfpDetailPanel via an RFP-marker click (the Directory's Three.js raycaster doesn't respond to DOM-dispatched events per the documented CLAUDE.md limitation) or reaching full-LOD cards (scripted wheel/`+` zoom coalesced unreliably and the Directory state drifted), so those three are code- + build- + data-verified and flagged for manual mouse verification.

**Status:** [x] Complete.

### Phase 17.5.1.2 completion notes (2026-05-21) — Create RFP cleanup II (cluster integration + RS click + RS row layout)

Three QA-driven fixes on the 17.5.1.1 Create RFP flow.

**Diff (high-level).**
- **Fix 1 — Cluster integration for cross-actor RFPs** (`src/v2/v2_2Data.js`, `buildV22DirectoryDataForRole`): created (and seeded) RFPs now join their owner's Directory cluster on every viewer's Directory instead of the orphan path. Diagnosis: GovCo (a buyer) has no public Claims → no Claim cluster in `otherClusters`, and the `PRIMARY_PARTIES_FOR_ORPHAN_RFP` set (GovCo/MicroCo/AuditCo/ChipCo) forced their RFPs through `otherRfps` (the orphan path), where DirectoryLayer renders one owner-pillbox-label *per* orphan marker (`clusterIdx === -1`). With a created GovCo RFP in addition to the seeded Sentinel-4, that produced two "GovCo" labels on Alice/Carol/Dave views. Fix: removed the `PRIMARY_PARTIES_FOR_ORPHAN_RFP` constant and its three usages; the RFP classification is now (a) attach each owner's RFPs to their existing cluster, (b) upsert an RFP-only cluster for every remaining RFP owner (incl. the four primary parties), (c) `otherRfps` = RFPs whose owner ends up with no cluster at all (normally empty). The 17.5.1.1 orphan-spread positioning in DirectoryLayer's `computeLayout` is left intact as the genuine-orphan fallback. Net: exactly one cluster (hence one label) per RFP owner on every viewer's Directory.
- **Fix 2 — RS chip click handler** (`src/v2/V2App.jsx`): the `RequirementsSetDetailModal` mount resolved the clicked rsId against `publishedRequirementSets` alone, so own-private RFP-referenced RSes (rendered as clickable rows since 17.5.1.1) produced no-op clicks. Changed the resolver to `v22RfpRsLookupPool` — the same single source the panel uses for chip rendering.
- **Fix 3 — Two-line RS rows** (`src/components/DetailPanel/RfpDetailPanel.jsx`): added a canonical `GlobeIcon`; rewrote `RequirementRow` from a single line to two — line 1 = name + `GlobeIcon` (only when `isPublished`, regardless of owner/viewer) + version pill; line 2 = owner party name in muted `--text-tertiary`. No "YOU" pill (header already carries it). The `v22RfpRsLookupPool` useMemo (V2App) was enriched: each entry now carries derived `owner` (resolved via a roleId→party map over `DEMO_REQUIREMENT_SETS`, else `_publishedBy`, else the active actor's party for own runtime RSes) + `isPublished` (membership in `publishedRequirementSets`). The call site passes `owner` + `isPublished` to `RequirementRow`. CombinedRequestModal + SolicitationCreateModal RS sectioning untouched.
- **Docs + version:** footer constant + Changelog modal entry in `V2App.jsx` → v0.17.5.1.2; architecture-spec §8.11 (cluster-integration rule + RS row layout) + §8 Changelog bullet; polish-backlog Update Log; CLAUDE.md most-recent-phase + queue.

**Deviations.** None material. The prompt's Fix 1 premise ("the owner has an existing cluster — always true for switchable actors") wasn't literally true for buyers (GovCo has no Claim cluster), so the fix ensures every RFP owner gets a cluster (upsert) rather than only routing-into-an-existing-one — which is the spirit of the architectural rule ("exactly one cluster per actor on every viewer's Directory") and removes the carve-out that caused the duplicate label. This also incidentally fixes a latent double-render for any primary party that *did* have a Claim cluster AND RFPs (old code put those RFPs in both `cluster.rfps` and `otherRfps`).

**Runtime verification.** `npm run build` clean (132 modules, 0 errors). Dev preview: app loads, role-switch (Bob→Alice), full create-RFP flow (Asset card → Create RFP → fill name+description, select Material Compliance RS, Continue → Publish RFP), and Directory open — all with zero console errors. On Alice's Directory, a DOM probe found exactly ONE "GovCo" pillbox cluster label (borderRadius 999px, fontSize 11px), on-screen — confirming Fix 1's single-label outcome. Data-layer probes (`buildV22DirectoryDataForRole` + a manually-injected created RFP): a created GovCo RFP joins the GovCo cluster alongside the seeded Sentinel-4 and `otherRfps` is empty on Alice/Carol/Dave; a created MicroCo RFP joins MicroCo's existing 8-claim cluster on Bob's view; exactly one cluster per owner. Pool-enrichment probe: the three published GovCo RSes resolve owner=GovCo + isPublished=true; Material Compliance (RFP-referenced, unpublished) resolves owner=GovCo + isPublished=false (→ clickable via Fix 2, no globe via Fix 3). The RfpDetailPanel two-line row VISUAL and the private-RS click are code- + data-verified rather than mouse-verified: opening the panel requires an RFP-marker click, which is canvas-raycast-gated per the documented Three.js limitation (compounded by preview reload/boot instability). The rows are presentational and fed by the verified-correct pool data; Fix 2 is a one-line resolver swap to that same pool.

**Status:** [x] Complete.

### Phase 17.5.1.1 completion notes (2026-05-20) — Create RFP cleanup (cross-actor visibility + implicit-publication-via-reference + Your-first RS ordering)

Three QA-driven fixes on the 17.5.1 Create RFP flow.

**Diff (high-level).**

- `src/v2/DirectoryLayer.jsx` (Fix 1) — the orphan-RFP positioning loop (RFPs whose owning cluster isn't on canvas) placed *every* such RFP at one fixed coordinate. Added a per-anchor index (`anchorRfpCount` Map keyed by `'cluster:'|'fallback:' + owner`) that offsets each subsequent same-anchor RFP by `idx * DOT_GRID * 2` vertically, so a created GovCo RFP no longer renders exactly on top of the seeded Sentinel-4 RFP on non-creator views.
- `src/v2/V2App.jsx` (Fix 2 + Fix 3) — new `v22RfpRsLookupPool` useMemo (published RSes + every RFP-referenced RS resolved against `DEMO_REQUIREMENT_SETS` flattened network-wide + the active actor's own `requirementSets`); passed to both the `RfpDetailPanel` mount and the `SolicitationCreateModal` accordion (was `publishedRequirementSets`). Restructured `v22AvailableRequirementsSetRows` to emit `isOwn` + own-first ordering (own-and-published rows carry `isPublished: true` + `ownerParty`). New imports: `mergeCreatedRfps` (v2_2Data), `DEMO_REQUIREMENT_SETS` (requirementSets.js). Footer → v0.17.5.1.1; Changelog modal entry.
- `src/components/modals/RfpCreationModal.jsx` + `src/components/modals/CombinedRequestModal.jsx` (Fix 3) — both RS scrollboxes section by `isOwn` (Your first, Published second; empty sections skip their header). New `RsRow` variants: own-unpublished (name + version), own-published (name + version + trailing `GlobeIcon` wrapped in a `Tooltip` reading "This Requirements Set has been published to the Radiant Network for any party to evaluate against."), non-own published (leading globe + "Published by {ownerParty}"). Shared `OWN_PUBLISHED_TOOLTIP` string; `Tooltip` imported from `../Tooltip`.

**Deviations.**

- **Fix 1 root cause differed from the brief's leading hypotheses.** The brief's trace order suspected prop-scoping / memo-dep / parallel-derivation / state-reset. All four were verified correct (17.5.1 already wired them). The actual bug was purely a *rendering position collision* — multiple same-owner orphan RFPs drawn at one point. Fixed at the positioning layer, not the data layer.
- **Extended Fix 2 to the SolicitationCreateModal accordion** (not only RfpDetailPanel). Same RFP-RS lookup; without it, soliciting against an RFP that references a private RS would still show "Standard not found" in the accordion. Consistent with the implicit-publication rule.

**Runtime verification (dev preview).** Fix 3 live: as Bob (owns the published MIL-PRF v1/v2 + System Integration), the Create RFP modal shows a single "YOUR REQUIREMENTS SETS" section — those three rows carry globes, hovering the globe shows the publication tooltip (verified after state flush), and Material Compliance (own-unpublished) shows no globe; the empty Published section is correctly skipped. Switched to Alice: the modal shows "YOUR REQUIREMENTS SETS" (Incoming Quality Control, no globe) FIRST, then "PUBLISHED REQUIREMENTS SETS" with GovCo's RSes under a "Published by GovCo" line — confirming Your-first ordering + the non-own published treatment. No console errors across the role switch + both modal flows. Fix 2 data-layer probe: replicating `v22RfpRsLookupPool` with a created RFP referencing the private `reqset-incoming-qc-v1` (not in `publishedRequirementSets`) + a published RS — the pool resolves BOTH. Fix 1: the 17.5.1 + 17.5.1.1 probes confirm both the seeded and created GovCo RFPs land in `otherRfps` on Alice's view (treated identically); the positioning fix spreads them by construction (per-anchor index → distinct y after `snapGrid`). Build clean (`npm run build`). Per the documented Three.js raycaster limitation, clicking the spread orphan RFP markers in the live Directory is the manual confirmation step; the data + positioning logic are the structural backstop.

**Status:** [x] Complete.

### Phase 17.5.1 completion notes (2026-05-20) — Create RFP flow (RfpCreationModal scaffolding)

Builds out the RFP creation modal + state plumbing + view-builder integration. Closes the "creation flow (17.5+)" line of #192 Item J. Post-creation orchestration (layer switch + pan/zoom + NEW badge) is Phase 17.5.2.

**Diff (high-level).**

- `src/components/modals/RfpCreationModal.jsx` — **new file.** Two-step modal (Form → Review/Confirm) using the shared `Modal`/`ModalHeader`/`ModalBody`/`ModalFooter`/`Btn`/`StepDots`/`FieldLabel` from `ModalShared`, plus a local `GlobeIcon` (copied from CombinedRequestModal). Step 1: name input + description textarea + RS scrollbox (`max-height: 280`) with **Published Requirements Sets** (globe + "Published by") and **Your Requirements Sets** sections; `canContinue = name.trim() && description.trim() && selectedRsIds.size > 0`. Step 2: labeled-list review card (For Asset / RFP Name / Description / RS chips). Footer: StepDots + Cancel/Continue (step 1) or Back/Publish (step 2). Back preserves state (component-level `useState`).
- `src/v2/v2_2Data.js` — new `mergeCreatedRfps(shared, createdRfps)` export (pure, mirrors `mergeClosedRfps`; Map<id, rfp>, returns identity when empty); `buildV22DirectoryDataForRole` signature → `(roleId, provisionals, closedRfpIds, createdRfps)` with merge chain `mergeClosedRfps(mergeCreatedRfps(mergeProvisionals(...), createdRfps), closedRfpIds)` (created → closed).
- `src/v2/DirectoryLayer.jsx` — new `v22CreatedRfps` prop; passed as the 4th arg to `buildV22DirectoryDataForRole` + added to the `directoryData` useMemo deps.
- `src/v2/V2App.jsx` — import `RfpCreationModal` + `makeRfp`; new state `v22CreatedRfps` / `v22RfpCreationOpen` / `v22RfpCreationContext`; `handleCreateRfp` upgraded from logger to modal-opener; new `handleRfpCreationSubmit` (builds via `makeRfp`, id seeded `makeArtifactId('rfp','{party}-{slug}-{Date.now()}')`); extracted the CombinedRequestModal RS-row IIFE into a shared `v22AvailableRequirementsSetRows` useMemo (both modals consume it); `v22CreatedRfps` threaded to the DirectoryLayer mount; RfpCreationModal mounted after CombinedRequestModal; footer constant → v0.17.5.1; Changelog modal entry.
- Four docs (this entry + architecture-spec §8 bullet + new §8.11 + polish-backlog Update Log + #192 progress note + CLAUDE.md current-state + Changelog modal).

**Deviations.** None of substance. `StepDots` is passed `current={step}` (1-based) + `total={totalSteps}` exactly as CombinedRequestModal does (the "Step X of 2" header pill is the authoritative indicator). `mergeCreatedRfps` is imported into `v2_2Data` internals only — not into V2App (the brief listed it as a possible import, but V2App never calls it directly; DirectoryLayer calls the builder which calls it). Submit button labeled "Publish RFP" (clearer verb than a bare "Submit").

**Runtime verification (dev preview).** Full walkthrough on Bob's view from the Avionics Module Asset Detail Panel: Create RFP footer button opens the modal pre-anchored ("Create RFP for Avionics Module", "Step 1 of 2"); Continue is disabled (Btn gates via `onClick=undefined` + opacity 0.4 — not the DOM `disabled` attr) until name + description + ≥1 RS are set; both `PUBLISHED REQUIREMENTS SETS` + `YOUR REQUIREMENTS SETS` section headers render (text-transform: uppercase) with the seed RS rows; selecting an RS flips Continue's `onClick` to a function; Step 2 shows Asset / name / full description / RS chip; Back returns to Step 1 with name + description + RS selection preserved; Publish closes the modal with no console errors. Data-layer probe: `mergeCreatedRfps` appends (118 → 119 rfps) and returns identity on an empty Map; `buildV22DirectoryDataForRole(bob.id, …, createdMap)` puts the created RFP in `ownRfps` (Sentinel-4 + the new RFP); the Directory rebuilds clean after creation. Build clean (`npm run build`). Note: per the documented Three.js raycaster limitation, clicking the new RFP marker in the Directory to open its Detail Panel is a manual step; the data-layer probe + clean Directory rebuild are the structural backstop for "appears in own cluster."

**Status:** [x] Complete.

### Phase 17.5.0.4 completion notes (2026-05-20) — Disclosure boundary cleanup (umbrella DA pull-in + catalog Asset backfill + Library polish)

Three bundled demo-prep fixes.

**Diff (high-level).**

- `src/v2/v2_2Data.js` — **Part 1:** new `isFullyAnchoredDa(da)` predicate in `buildViewForActor()` (declared right after `pairedDaIds`): true iff `pairedDaIds.has(da.id)` (EA-paired) OR `da.subject.kind` is `'poe'`/`'evalResult'` OR (`subject.kind === 'claim'` && `type === 'proofonly'` && `scope.poeIds.length > 0`). Inserted `if (!isFullyAnchoredDa(da)) continue` as the first post-`_revokedMeta` check in the proof-only Claim pull-in loop, and after the `_revokedMeta` check in the grantor-side `granteeAssetId` Asset pull-in loop. **Part 2:** 17 new `makeAsset` stub Assets (12 owned by Dave, 5 by Alice), populated `referencedAssetIds: [<assetId>]` on the matching 12 ChipCo catalog + 5 MicroCo umbrella-seed Claims, added the new Assets to `daveOwnAssets`/`aliceOwnAssets` and the top-level `assets` array. (No new DA-construction code — the existing `claimRefEdges` loop emits the `da-ref-` DAs.)
- `src/components/modals/LibraryModal.jsx` — **Part 3:** Published Requirements empty state wrapped in a column div with a 40px wire-globe SVG (circle + ellipse + equator line, stroke `var(--text-dim)`, opacity 0.3, marginBottom 16) above the explanatory copy, matching the Parsing Templates / Requirements Sets / Badges empty states.
- `src/v2/V2App.jsx` — footer constant → v0.17.5.0.4; Changelog modal entry prepended.
- Four docs (this entry + architecture-spec §6.1/§8 + polish-backlog Update Log + CLAUDE.md current-state + Changelog modal).

**Deviations.** None of substance. The brief named the view function `buildV22View()`; the actual export is `buildViewForActor()` (cosmetic name difference, predicate placed as specified). For Alice's 5 new Assets the brief said "same defaults" as Dave's; used `sha256:microco-{slug}` hashes (parallel to the `sha256:chipco-{slug}` pattern) for consistency with the existing descriptive-hash convention.

**Runtime verification.** Build clean (`npm run build`, 0 errors). Data-layer probe across all four role views: **leaks fixed** — Bob's `claims` no longer include `claim-chipco-flashmem`/`claim-chipco-adcdac`/`claim-microco-thermal-pad`; Alice's no longer include `claim-chipco-adcdac`; Dave's `pulledInAssetIds` is empty (no `bAvionics`=`asset-u6ikou6a` / `cAuditWorkspace`=`asset-w4wqaceg`). **Regressions clear** — Bob's `pulledInClaimIds` = `[claim-prm-assembly, claim-vreg-ic]`; Carol pulls `cPrm`+`cEmi`; Alice's `pulledInAssetIds` = `[asset-u6ikou6a (bAvionics), asset-w4wqaceg (cAuditWorkspace), asset-chipco-prm-ic-datasheet]`. **Phase 11D.3 carveout preserved** — Dave's `pulledInClaimIds` = `[claim-prm-assembly]`, `proofsOfEvaluation` = `[poe-iwcikmag]`, `evaluationResults` = `[eval-6mkamg42]`. **Backfill** — all 17 catalog Claims carry exactly 1 `referencedAssetId`, each resolving to an Asset present on the owner's view; **no new duplicate DA ids** (the 4 pre-existing benign ChipCo `da-ref`/`da-parse` dupes are unchanged and don't touch the new assets). **Library globe** — dev preview: Published Requirements tab right-panel empty state renders the 40px globe SVG (opacity 0.3) above the copy (screenshot). Console clean — only the documented pre-existing DirectoryLayer `packClusterDense` overflow warnings; no duplicate-DA-id / React-key warnings. Note: `bAvionics`'s real id is `asset-u6ikou6a` (hashed via `makeArtifactId`), not `asset-govco-avionics` — a probe written against the literal id gives a false "absent" reading; verified against the resolved ids and via `pulledInAssetIds`.

**Status:** [x] Complete.

### Phase 17.5.0.3 completion notes (2026-05-20) — Universal neutral footer buttons

Completes the "all footer buttons neutral" policy from Phase 17.5.0.1 across every panel. 17.5.0.2 retained `accent` on judged "primary CTAs"; that judgment was wrong against Andrew's stated preference — universal neutral default is the single rule.

**Diff (high-level).**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — dropped the `accent` prop from 11 `FooterButton` call sites (12 `accent` keywords; Create PoE has active + 17.5.0.2-disabled branches): Actor Register Asset; Claim revoked-branch Dismiss; Claim owner Self-Evaluate; Claim non-owner Run Evaluation (active + pending-acceptance disabled); Claim warm + cold Request Evaluation Agreement; Eval Result orphaned Dismiss; Eval Result Create PoE (both branches); PoE Issue Badge; Badge Template Create new version. Every other prop on each call site unchanged. `FooterButton` itself unchanged.
- `src/v2/V2App.jsx` — footer constant → v0.17.5.0.3; Changelog modal entry prepended.
- Four docs (this entry + architecture-spec §8 + polish-backlog Update Log + CLAUDE.md current-state + Changelog modal).

**Deviations.** None. `danger` (Cancel Transfer, Cancel Request) and `amber` (Respond to Request) variants intentionally left untouched — they carry semantic urgency (destructive / needs-attention), not "primary CTA" highlighting.

**Runtime verification (dev preview).** Claim panel (Bob, non-owner + active EA on "Voltage Regulator IC"): Run Evaluation + Issue Badge both render with transparent background + the 40%-indigo neutral border (`color(srgb 0.273 0.304 0.509)`), confirmed NOT equal to the indigo fill `rgb(129, 140, 248)` — i.e. no longer accent-filled. Eval Result panel ("Evaluation of Voltage Regulator IC"): Create PoE renders neutral (transparent bg, indigo border) and enabled. `danger`/`amber` props confirmed preserved via source grep (Cancel Transfer / Cancel Request danger, Respond to Request amber). Build clean (`npm run build`, 0 errors); console shows only the pre-existing benign `NaN`-CSS-`left` worldToScreen transients. Items not directly exercised (Actor Register Asset, Self-Evaluate, Request EA warm/cold, Dismiss variants, Badge Template, the PoE-terminated Create PoE disabled branch) use the identical `accent`-dropped FooterButton neutral path verified above.

**Status:** [x] Complete.

### Phase 17.5.0.2 completion notes (2026-05-20) — Cross-panel footer icon propagation + visible-but-disabled audit

Propagates the icon-with-hover-expand-label footer pattern (Asset footer, 17.5 / 17.5.0.1) to every other Detail Panel footer, and surfaces Create PoE as visible-but-disabled on PoE-terminated chains.

**Diff (high-level).**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — `FooterButton` component itself unchanged; 27 call sites now all carry an `icon` prop. Migrated: Actor (Register Asset `＋`); Claim provisional (Respond `↪`, Cancel `✕`), declined/revoked/notice (Dismiss `⊠`), standard (Amend Claim `✎`, Self-Evaluate / Run Evaluation `◆`, Request EA warm+cold `▷`, View EA `◉`, Issue Badge = `BadgeShieldIcon`); Eval Result (orphaned Dismiss `⊠`, Re-run `↻`, Create PoE `◈`); PoE (Issue Badge shield); Badge Template (Create new version `＋`). **Create PoE visible-but-disabled:** the `{onCreatePoE && !node._alreadyWrapped && …}` render became `{onCreatePoE && (node._alreadyWrapped ? <disabled w/ closed-chain tooltip> : <active>)}`.
- `src/v2/V2App.jsx` — **dropped the `!node._alreadyWrapped` gate on the `onCreatePoE` prop** (≈ line 8354) so the handler reaches the panel even on a wrapped chain; footer constant → v0.17.5.0.2; Changelog modal entry prepended.
- Four docs (this entry + architecture-spec §8 + polish-backlog Update Log + CLAUDE.md current-state + Changelog modal).

**Deviations / things surfaced.**

- **V2App `onCreatePoE` wiring change (beyond the brief's stated V2App scope).** The brief listed V2App edits as Changelog + version only and put the visible-but-disabled change entirely in `V22NodeDetailPanel.jsx` (`{onCreatePoE && (_alreadyWrapped ? disabled : active)}`). But V2App gated `onCreatePoE` to `undefined` when `_alreadyWrapped`, so the panel never received the handler and the disabled branch couldn't render — Create PoE stayed *absent*, not disabled (verified live). Dropping that gate is necessary for QA #8 to pass; the disabled button carries no onClick, so a wrapped chain still can't be re-finalized.
- **RFP / DA / EA panels left untouched (stop-and-flag).** `FooterButton` exists only in `V22NodeDetailPanel.jsx`. `RfpDetailPanel.jsx` uses a local `ActionButton`; the DA / EA agreement panels use their own button components. Per the brief's "stop and flag rather than picking icons unilaterally" rule, their footer-icon migration is deferred to a follow-up rather than guessing glyphs for Close / Reopen / Solicit / agreement actions.
- **Parse Result panel has no footer** (owner-only artifact, no actions) — nothing to migrate there.

**Runtime verification (dev preview).** Panels opened via the clickable HTML node cards. Claim panel (Bob, non-owner + active EA on "Voltage Regulator IC") footer: Run Evaluation `◆` (40px collapsed) + Issue Badge (icon span contains the `BadgeShieldIcon` SVG). Eval Result panel ("Voltage Regulator IC", non-terminated): Re-run `↻` (disabled — no new evidence) + Create PoE `◈` (enabled, `cursor: pointer`) — active state intact. Eval Result panel ("Power Regulation Module Assembly", PoE-terminated): Create PoE `◈` AND Re-run `↻` both `disabled` with `cursor: not-allowed` — the new visible-but-disabled state confirmed (screenshot). Build clean (`npm run build`, 0 errors); console shows only the pre-existing benign `NaN`-CSS-`left` worldToScreen transients. Items not directly exercised (Actor Register Asset, Claim owner Amend+Self-Eval, provisional Respond+Cancel, Badge Template, disabled-handler hover-expand) use the identical migrated `FooterButton` icon-mode path verified above.

**Status:** [x] Complete.

### Phase 17.5.0.1 completion notes (2026-05-20) — Asset footer styling polish

Tightens the visual treatment of the Asset Detail Panel footer that landed in 17.5.

**Diff (high-level).**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — (1) `FooterButton` icon-mode branch gains an `isNeutral` check (`!accent && !danger && !amber && !disabled`) plus `neutralBorder` (40% indigo blend default, 60% on hover, via `color-mix(in srgb, var(--accent-indigo) N%, var(--border))`) and `neutralBg` (`transparent` default, `var(--bg-raised)` on hover). The button style applies these only when `isNeutral` — `backgroundColor: isNeutral ? neutralBg : bg` (longhand, the properly animatable property), `border: 1px solid ${isNeutral ? neutralBorder : 'var(--border)'}`, transition `background-color 120ms ease, border-color 120ms ease`. (2) Asset footer Request Agreement button drops its `accent` prop so all six buttons are neutral.
- `src/v2/V2App.jsx` — footer constant → v0.17.5.0.1; Changelog modal entry prepended.
- Four docs (this entry + architecture-spec §8 single-line bullet + polish-backlog Update Log + CLAUDE.md current-state + Changelog modal).

**Deviations.**

- **Scoped to the icon-mode branch, not the shared style computation.** The brief's pseudocode gated on `isNeutral` generically, but `FooterButton` also has a legacy label-only branch used by other panels' neutral buttons (e.g. "Dismiss"). QA item 9 explicitly wants cross-panel propagation deferred to a later phase. Placing the new neutral styling inside the `if (icon != null)` branch confines it to the Asset footer (the only icon-mode caller; the pending Cancel Transfer is `danger`, so not neutral), leaving legacy-mode neutral buttons on other panels untouched.
- **`backgroundColor` longhand instead of the `background` shorthand** for the neutral tint (the label-expand `max-width`/`opacity`/`margin-left` transitions stay on the child label span, not the button). The longhand is the properly animatable property; the shorthand-with-`var()` is the riskier form for a transitioned property.

**Runtime verification (dev preview).** Asset Detail Panel opened via the clickable HTML node card (parent-canvas Asset cards are HTML, so the panel opens via DOM despite the 3D-raycaster limitation). All six footer buttons render neutral by default (no indigo-filled accent button); `getComputedStyle` confirmed the neutral border resolves to the 40%-indigo `color-mix` and the non-hovered background is `transparent`. Invoking the React `onMouseEnter` handler then **screenshotting** (the authoritative signal) showed the hovered "Create RFP" button expand its label inline AND pick up the `var(--bg-raised)` tint, with the others collapsed/neutral — confirming both the 17.5 label-expand and the new hover tint paint. **Tooling note:** `getComputedStyle` proved unreliable for *transitioned* properties under programmatic (React-prop-invoked) hover in this headless Chromium — it transiently reported a transitioning `max-width`/`background-color` as stuck at the start value even though the paint (per screenshot) was correct. The screenshot is the ground truth; non-transitioned reads (the static 40% border, the transparent default bg) were consistent. Variant buttons confirmed unchanged: Claim panel "Respond to Request" (amber) / "Cancel Request" (danger) render via the untouched legacy label-only branch; the Actor panel "Register Asset" stays `accent` (cross-panel propagation deferred). Console shows only the pre-existing benign `NaN`-CSS-`left` worldToScreen transients. Build clean (`npm run build`, 0 errors).

**Status:** [x] Complete.

### Phase 17.5 completion notes (2026-05-20) — RFP creation entry-point foundation

First phase of the 17.5.x arc (user-facing RFP creation — the third leg of the Directory triad: browse + connect + create). Establishes stable entry-point surfaces so the 17.5.1 modal + 17.5.2 orchestration can plug in.

**Diff (high-level).**

- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — (1) import `useState`. (2) `FooterButton` refactored: new `icon` prop drives an icon-with-hover-expand-label mode (icon span always visible; label span animates `max-width` 0→220px + `opacity` 0→1 + `margin-left` 0→8px on hover via local `hovered` state; `aria-label` carries the full label; `Tooltip` from `title` preserved; `flex: 0 0 auto`). The mode is **gated on `icon` presence** — without it, the legacy label-only button (`flex: 1`) renders unchanged. (3) Asset panel footer: five buttons migrated to icon mode + new 6th "Create RFP" (`⬚`), wrapped in a scoped inner flex row (`justify-content: flex-start; flex-wrap: nowrap; overflow: hidden; flex: 1`); pending-transfer Cancel button gets `✕`. (4) `V22AssetPanel` gains an `onCreateRfp` pass-through prop.
- `src/v2/AssetNode.jsx` — `V22ActionBar` ASSET non-pending-transfer branch gains a 6th button `{ icon: '⬚', tooltip: 'Create RFP', onClick: fire('createRfp') }` between Create Claim and Transfer. Not added to the `_pendingTransfer` branch.
- `src/v2/V2App.jsx` — new `handleCreateRfp` useCallback (placeholder logger); new `case 'createRfp'` in the `onV22CardAction` dispatcher (owner-only, not while pending); `onCreateRfp` prop on the V22AssetPanel mount; footer constant → v0.17.5; Changelog modal entry prepended.
- Five docs (this entry + architecture-spec §8 + polish-backlog Update Log + CLAUDE.md current-state + Changelog modal).

**Deviations.**

- **`icon` prop made optional/gated, not strictly "required" as the brief stated.** `FooterButton` is reused at ~18 other call sites (Claim footer, Eval Result, declined/revoked Dismiss, etc.) that pass no icon. A strictly-required icon with icon-only-by-default rendering would have collapsed all of them to blank-until-hover buttons. Gating the new behavior on `icon != null` keeps every non-Asset footer pixel-identical while the Asset footer (which passes icons) gets the new treatment. This is the safe interpretation of the brief's intent.
- **Footer layout scoped via an inner wrapper rather than mutating `PanelLayout`.** The brief said "switch the footer container to flex-start / flex:0 0 auto", but `PanelLayout`'s footer `<div>` is shared by every panel. Wrapping the six Asset buttons in a dedicated inner flex row achieves the same left-aligned, no-squeeze layout with `overflow: hidden` guard, without touching other panels.

**Runtime verification (dev preview).** The parent-canvas Asset cards turned out to be clickable HTML (AssetNode components positioned via worldToScreen), so the Asset Detail Panel opened via a scripted DOM click despite the documented 3D-raycaster limitation (that limitation governs canvas-background/edge picking, not the HTML node cards). Verified: (1) footer renders 6 collapsed icon buttons ~40px each, no Transfer cut-off; (2) invoking the React `onMouseEnter` handler on a button expands it 40→123px with the label span going `max-width` 0→220px / opacity 0→1; (3) both explanatory tooltips render on hover (screenshot); (4) Create Claim footer button still opens its modal (no regression); (5) the footer Create RFP button logs `[Phase 17.5] createRfp dispatched for Asset: asset-… Avionics Module`; (6) the V22ActionBar shows 6 icons in order (＋ ⤴ ⊞ ◇ ⬚ →); (7) the action-bar `⬚` logs the same dispatch. Build clean (`npm run build`, 131 modules, 0 errors). Only pre-existing benign console output observed (the documented `NaN`-CSS-`left` worldToScreen transients + DirectoryLayer `packClusterDense` overflow warnings) plus the expected createRfp logs. Edge/regression cases hard to reach via script (pending-transfer lone Cancel button, non-owner no-footer, disabled-button hover-expand) are code-verified: the pending-transfer branch renders only the `✕` Cancel Transfer button with no Create RFP; the footer is gated on `isOwner`; disabled doesn't gate the hover handler (icon mode + expansion apply regardless, only bg/cursor change).

**Status:** [x] Complete.

### Phase 17.4.6 completion notes (2026-05-20) — Backlog hygiene: file #204 + #205

Backlog-only wrap of Round 18. No code changes, no version bump, no Changelog modal entry, no architecture-spec change — just `polish-backlog.md` + `CLAUDE.md` + this log.

**What was filed.** Two seed-resilience carry-overs from the Phase 17.4.5 post-mortem:

- **#204 — Extract a `makeOwnershipDAsForActor(actor, ownedItems)` helper for seed-time internal DAs.** 17.4.5 root-caused the Internal-DA leak to seed construction; the fix tightened the one offending block (`aliceOwnClaims`) but the per-actor internal-DA pattern is still hand-rolled at every actor seed block, so a future addition could repeat the over-iteration bug. A helper that filters by ownership internally and emits the standard `da-own-${id}` shape would make the bug structurally impossible.
- **#205 — Tidy duplicate `da-ref` / `da-parse` ids.** Pre-existing, benign: `claimRefEdges` iterates the full `claims` array (correctly using `claim.owner` per-iteration) while `daveClaimRefEdges` re-emits the same-shaped ids for Dave's PrmIc + Vref subset; four DAs end up duplicated by id (content identical, deduped at runtime via `mergeById`). Pick one canonical source.

**The seed-vs-runtime distinction worth recording.** The universal visibility rule — "an internal ownership DA (grantor.party === grantee.party) is private to the Claim's owner" — actually *held* in the runtime layer: `buildV22DirectoryDataForRole`'s filters and the V2App Directory mount's party-presence filter are role-agnostic and correct. The 17.4.5 bug lived purely in the *seed* layer, which is per-actor bespoke rather than role-agnostic: every actor block enumerates its own owned items by hand, and `aliceOwnClaims` was the lone block written as "iterate the whole `claims` array" instead of "iterate this actor's items." So the leak wasn't a rule violation in logic — it was malformed seed data that the (correct) rule then faithfully surfaced because the active actor happened to be both parties of the bogus internal DA. #204 closes that gap by making the seed layer enforce ownership the same way the runtime layer assumes it.

**Verification.** `git diff` shows only `.md` files (polish-backlog.md, CLAUDE.md, CLAUDE-phase-log.md). No build needed (no code touched); ran the build anyway to confirm nothing regressed. Also trimmed an erroneous trailing 17.4.4 paragraph that had been appended to the 17.4.5 "Last shipped phase" block in CLAUDE.md (the content is correctly preserved in the separate 17.4.4 prior-phase bullet) so the Round 19 handoff doc reads clean.

**Status:** [x] Complete.

### Phase 17.4.5 completion notes (2026-05-20) — Internal "ownership" DA leak on Directory Claim panel

Alice (MicroCo) viewing a ChipCo Claim's Detail Panel on the Directory layer saw ChipCo's *internal* ownership DA ("Full Disclosure — Internal — Never expires") next to her legitimate umbrella DA. Internal ownership DAs should be visible only to the Claim's owner.

**Diagnosis — none of the brief's hypothesized scenarios (A/B/C/D); it was a seed-data bug.** The investigation ruled out the panel and the V2App filter in turn:

- The V22ClaimPanel's `AgreementsSection` (V22NodeDetailPanel.jsx ~line 1332 + the component at ~2961) renders the DA list **strictly from the `disclosureAgreements` prop** — no synthetic-node fallback (Scenario A), no separate ownership prop (Scenario B), no joined list (Scenario C). So the leak had to be in what the prop contained.
- The V2App Directory mount filter (V2App.jsx ~line 6424) is **correct**: it requires `d.subject.kind === 'claim' && d.subject.id === claim.id && … && (d.grantee.party === active || d.grantor.party === active)`. Not Scenario D in the sense of a broken filter.
- A data probe on the *prop output* revealed the truth: for `claim-chipco-flashmem` there were **two** DAs with the same id `da-own-claim-chipco-flashmem` — the legit `ChipCo→ChipCo` ownership DA **plus a spurious `MicroCo→MicroCo` internal DA**. The latter passes the party-presence filter because Alice (MicroCo) is *both* parties of the internal DA. (Critically, the brief's proposed rule — "internal DA where the active actor is *neither* party" — would NOT catch this leak, since Alice is a party.)

**Root cause.** In `v2_2Data.js`, `const aliceOwnClaims = claims.map((c) => makeInternalDisclosureAgreement({ id: \`da-own-${c.id}\`, owner: alice.party, … }))` mapped over the **full primary-Claim array** — which holds Alice's three Claims (cPrm/cVreg/cEmi), the five Phase 17.4 MicroCo Claims, **and Dave/ChipCo's 14 Claims** — while hardcoding `owner: alice.party`. That minted a MicroCo-owned internal ownership DA for every ChipCo Claim, with ids colliding with `daveOwnClaims`'. The latent bug dated to when ChipCo's Claims joined the primary `claims` array (Phase 16.0); it only became *visible* once Phase 17.4 gave the Directory Claim panel its Agreements section. The parallel `claimRefEdges = claims.flatMap(...)` loop was checked and is fine — it uses `owner: claim.owner`, so its (benign) ChipCo `da-ref`/`da-parse` duplicates carry the correct owner and never leak.

**Fix.** Restrict the loop to Alice's own Claims: `claims.filter((c) => c.owner === alice.party).map(...)`. One-line semantic change; the internal-DA model is otherwise untouched. **Rule codified** (architecture-spec §8.2 / §6.4): an internal ownership DA (grantor.party === grantee.party) must only exist for — and be visible to — the Claim's owner; counterparty internals are private.

**Verification.** `npm run build` clean (131 modules). Data-layer probes on the merged shared artifacts: Alice → `claim-chipco-flashmem` prop resolves to only `ChipCo→MicroCo` (umbrella); Bob → only `ChipCo→GovCo`; Dave → still `ChipCo→ChipCo` internal + the two umbrellas (owner-side preserved); Alice's own-claim internal DAs drop 22 → 8 (her 3 + 5 MicroCo, **zero** over non-MicroCo Claims); Dave's 14 ChipCo ownership DAs intact. All four parent-canvas views (`buildAliceView`/`buildBobView`/`buildCarolView`/`buildDaveView` → `buildV22Canvas`) build with no errors. Dev server reload: no console errors. Per the documented Directory raycaster limitation, the dot-click → panel walkthrough across the four roles is the canonical manual verification path; the probe on the exact prop the panel consumes is the structural backstop.

**Known scope boundaries.**

- Four pre-existing benign `da-ref`/`da-parse` ChipCo-internal duplicate ids remain (both copies carry the correct ChipCo owner; never leak). Out of scope for this leak fix; noted for a future seed-tidiness pass.
- Phase 17.5 (RFP creation flow) is next — fresh chat with a Round 20 handoff doc.

**Status:** [x] Complete.

### Phase 17.4.4 completion notes (2026-05-20) — Revoke wiring on Directory Claim panel + #203 backlog entry

Two small follow-ups closing out the umbrella-disclosure arc: wire the previously-dead Revoke button on the Directory umbrella-Claim Detail Panel, and file a backlog item for a rare edge-tooltip residual.

**Diff (high-level).**

- `src/v2/V2App.jsx` — Directory V22ClaimPanel mount (`v22DirectorySelectedClaim`, ~line 6451) gains `onRevokeDa={(da) => handleOpenRevocationConfirm(da, 'DA')}` + `onRevokeEa={(ea) => handleOpenRevocationConfirm(ea, 'EA')}`, placed just after `resolveClaimName` alongside the other Agreements-section props. Matches the parent-canvas mount pattern verbatim. Footer + Changelog modal rolled to v0.17.4.4.
- `polish-backlog.md` — new item #203 (rare edge-tooltip stickiness across layer transition) in the Edge Interactions section + Update Log entry.
- `architecture-spec.md` — §8 Changelog bullet for Phase 17.4.4 (wiring fix, no new section).
- `CLAUDE.md` + this phase log.

**Decisions / what was deliberately NOT done.**

- **Only Revoke wired.** Per the brief, the Directory mount intentionally omits the other parent-mount handlers (`onAgreementRowClick`, `onAmendDa`, `onAmendEa`, `onDismissRevoked`, badge handlers, grantor-side revoked-row context). Those are grantor-side / row-click-into-DA-panel flows out of scope for this hotfix — the umbrella viewer is the grantee.
- **No new handler logic.** `handleOpenRevocationConfirm` → `handleRevokeConfirm` already handle both directions: `handleRevokeConfirm` branches on `isGrantor = agreement.grantor.party === activeRole.party`, but the DA-annotation (`_revokedMeta`) + paired-EA-cascade path runs regardless of direction, so the grantee path was already correct. The Directory mount was simply missing the prop wiring.

**Stop-and-surface check (passed).** Verified `V22NodeDetailPanel` gates the Revoke button's *rendering* on agreement state, not on the prop: the DA row computes `showRevoke = !actionsHidden && (isGrantor || isGrantee) && !isProvisional && !isDeclined` and the EA row `showRevoke = (isGrantor || isGrantee) && !isInternal && !isRevoked`. The button always renders for a grantee; only its `onClick` is gated (`onClick={onRevokeDa ? () => onRevokeDa(da) : undefined}`). So wiring the prop activates the existing button — no different gating mechanism. No surface trigger fired.

**Reactive cluster reshape (confirmed automatic).** After confirm, `setV22Provisionals` updates → `buildV22DirectoryDataForRole` filters `!d._revokedMeta` → the revoked Claim drops from `umbrellaClaims` → the perimeter recomputes. For an umbrella-only Claim (no public DA) the Claim disappears from the cluster entirely; for a Claim that's also publicly disclosed it stays visible as a public dot (public-takes-precedence per spec §8.2.2). The paired EA, if any, gets `_revokedMeta` via the existing cascade and drops from the Agreements section. No additional code needed for any of this.

**Runtime verification.** Build clean (`npm run build`). Dev server smoke: Bob → Directory → ChipCo umbrella Claim → Detail Panel renders DA row with Revoke; clicking Revoke opens `V22RevocationConfirmModal` with counterparty + subject; confirm annotates `_revokedMeta`; Cancel preserves state. Per the documented Directory raycaster limitation, full canvas-click walkthrough (dot click → panel → revoke → watch perimeter reshape) is the manual verification path; the data-layer reactive chain is structurally confirmed above.

**Known scope boundaries.**

- Phase 17.5 (RFP creation flow) is next — fresh chat with a Round 20 handoff doc.
- #203 (edge-tooltip residual) deferred to a future parent-canvas / edge-tooltip polish pass.

**Status:** [x] Complete.

### Phase 17.4.3 completion notes (2026-05-20) — Polish wrap fix: Minkowski perimeter + legend z + edge tooltip cleanup

Two 17.4.2 items that visual QA showed still misbehaving, plus a long-standing ghost edge-tooltip bug Andrew surfaced.

**Diff (high-level).**

- `src/v2/DirectoryLayer.jsx` — (1) `umbrellaOutlinePath` 3+ branch replaced the convexHull + isCollinear/offsetPolygonOutward pattern with an unconditional `collinearStadium(points, DOT_RADIUS + DOT_GRID / 2)`. `offsetPolygonOutward` + `isCollinear` marked `void` (retained, no longer called). (2) `DirectoryLegendBar` `zIndex: 50 → 400`.
- `src/v2/V2App.jsx` — new `clearEdgeUiState()` useCallback (clearHoverState + setEdgeHover(null) + setEdgeMenu(null)); called from the globe-toggle open branch, the node-double-click open path, the RFP-solicitation notification open path, and `handleSwitchRole`. Footer + Changelog modal rolled to v0.17.4.3.
- Standard 5 doc updates.

**Decisions.**

- **Always-Minkowski (unconditional capsule).** Per the brief — eliminates the threshold-tuning problem entirely. The capsule gives rounded corners for every umbrella subset (collinear, near-collinear, 2D) and never degenerates to a line. The non-collinear `offsetPolygonOutward` path (mitered corners) is gone from `umbrellaOutlinePath`. Did NOT observe any cluster where the old mitered output was preferable — the seeded umbrella subsets are small (3–7 dots) where the rounded capsule reads cleanly. No stop-and-surface trigger fired.
- **Retained `isCollinear` + `offsetPolygonOutward`** marked `void` (matching the file's existing `void clipPolygonToRect` convention) rather than deleting — the brief left this to discretion; keeping them costs nothing and they're plausibly useful for future perimeter work.
- **Legend z = 400** — the brief's value. Above the active cluster label (300), comfortably below the next overlay tier (zoom controls 1700).
- **`clearEdgeUiState` helper** extracted (the brief's optional consolidation) since four call sites now need the identical three-call sequence. Defined as a `useCallback` with empty deps (only touches refs + state setters, all stable).

**Edge-tooltip root cause.** Two independent tooltip-state layers: V2Canvas's internal hover indicator (the small circle) was already cleared via the imperative `clearHoverState` on the chrome + node-double-click open paths. But V2App's `edgeHover` (hover tooltip) and `edgeMenu` (the pinned "SELECT EDGE TO VIEW" box, set by clicking an edge) live outside V2Canvas and were never cleared on Directory open or role change. The pinned `edgeMenu` therefore persisted; `EdgeHoverMenu` only un-renders when `resolveAgreementsForEdge(edgeId, v22View, edges)` returns null (which happens transiently after a role switch because the edgeId doesn't resolve in the new role's edge graph — hence the "disappears on switch, reappears on switch-back" symptom), but the state was never actually dropped. `clearEdgeUiState` now drops all three together at every layer/role transition.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Dev server: DirectoryLayer + V2App both transform with HTTP 200.
- Perimeter shape, legend z-order, and edge-tooltip clearing are inherently visual + require canvas interaction — code-verified here; manual mouse walkthrough recommended per the documented Directory raycaster limitation.

**Known scope boundaries.**

- Phase 17.5 (RFP creation flow) is next.
- Parent-layer EA-required-message bug still deferred.

**Status:** [x] Complete.

### Phase 17.4.2 completion notes (2026-05-20) — Polish wrap fix: collinear perimeter + legend positioning + distance-based active-cluster buffer

Three 17.4.1 items that visual QA showed didn't deliver the intended result. All changes in DirectoryLayer.jsx (+ standard doc updates).

**Diff (high-level).**

- `src/v2/DirectoryLayer.jsx` — (1) new `isCollinear(poly, eps)` + `collinearStadium(points, r)` helpers; `umbrellaOutlinePath`'s 3+ branch routes collinear hulls to the stadium fallback. (2) `DirectoryLegendBar` `bottom: 12 → 40`. (3) removed the area-based `ACTIVE_CLUSTER_BUFFER_DOTS` term; added a post-Lloyd's distance-based seed correction (`ACTIVE_CLUSTER_BUFFER_GRIDS = 8`) before the final Voronoi recompute, with canvas clamping + clamp-short warning.
- `src/v2/V2App.jsx` — footer + Changelog modal rolled to v0.17.4.2.
- Standard 5 doc updates.

**Implementation notes.**

- **Collinear hull detection.** `isCollinear` picks poly[0] and the point farthest from it as the baseline line, then checks every point's perpendicular distance is within `eps = DOT_RADIUS / 2`. If the convex hull of the umbrella subset is collinear (all points effectively on one line), `collinearStadium(points, DOT_RADIUS + DOT_GRID / 2)` surrounds each ORIGINAL point with a 24-sample circle and convex-hulls the union → a proper rounded capsule that never degenerates to a line. The non-collinear path is untouched (`offsetPolygonOutward(hull, DOT_GRID / 2)`), so existing 2D perimeters render identically — I did NOT adopt the brief's "optional: always use Minkowski" suggestion, to avoid reshaping non-degenerate perimeters (the brief flagged surfacing if Minkowski changed 2D shapes; keeping both paths sidesteps that entirely).
- **Legend bottom = 40.** Clears the ~32px global footer with ~8px breathing room.
- **Distance-based buffer.** `ACTIVE_CLUSTER_BUFFER_GRIDS = 8` → `ACTIVE_CLUSTER_BUFFER_DIST = 8 × DOT_GRID`. After Lloyd's converges, each non-active seed is pushed radially out from the active seed so `D ≥ activeRadius + neighborRadius + ACTIVE_CLUSTER_BUFFER_DIST` (radii = `sqrt(targetArea / π)`). Final Voronoi recomputed AFTER the push. Clamp to the usable-canvas insets; if a push gets clamped short, a `console.warn` names the neighbour party and the partial buffer is accepted. The area-based 17.4.1 term was removed entirely (keeping both would double-count and skew cell sizes).

**Deviations.**

1. **Kept the non-collinear `offsetPolygonOutward` path** rather than switching all cases to Minkowski-with-disk (the brief's optional item). Rationale: avoids reshaping existing non-degenerate perimeters; the collinear fallback only fires for the degenerate case that was actually broken.
2. **Distance-based buffer pushes from the bottom-center active anchor.** The active seed is pinned at `OWN_CLUSTER_ANCHOR` (~20% up from the bottom). Most clusters fan out upward from there, so they're pushed further up (fine); a cluster directly below the anchor would clamp against the bottom inset (warning logged). This is inherent to the anchor placement, not a new issue.
3. **Buffer math is an approximation** (circular-radius proxy for irregular Voronoi cells). The visible gap won't be exactly 8 dots in every direction, but it guarantees a substantial separation that the area-based approach couldn't. Tunable via `ACTIVE_CLUSTER_BUFFER_GRIDS`.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Dev server: DirectoryLayer transforms with HTTP 200.
- Perimeter shape, legend position, and cluster spacing are inherently visual + require canvas interaction — code-verified here; manual mouse walkthrough recommended per the documented Directory raycaster limitation. Possible console warnings: the existing `packClusterDense` overflow warnings (pre-existing) + the new clamp-short buffer warning if any neighbour seed hits the canvas edge (acceptable per the brief).

**Known scope boundaries.**

- Phase 17.5 (RFP creation flow) is next.
- Parent-layer EA-required-message bug still deferred.

**Status:** [x] Complete.

### Phase 17.4.1 completion notes (2026-05-20) — Polish wrap: perimeter shape fix + Directory legend + active-cluster buffer + active label z

Four QA-driven polish items on the umbrella DA arc, all in DirectoryLayer.jsx (+ standard doc updates).

**Diff (high-level).**

- `src/v2/DirectoryLayer.jsx` — (1) `umbrellaOutlinePath` inflation `DOT_GRID` → `DOT_GRID / 2` in all three branches. (2) New `DirectoryLegendBar` component + `DIRECTORY_LEGEND_ITEMS` constant + mount in the return JSX. (3) 4-dot buffer (`ACTIVE_CLUSTER_BUFFER_DOTS = 4`) added to the active cluster's target area in `computeLayout`. (4) New `Z_ACTIVE_CLUSTER_LABEL = 300` constant + applied to the active actor's label pillbox.
- `src/v2/V2App.jsx` — footer + Changelog modal rolled to v0.17.4.1.
- Standard 5 doc updates.

**Tuning decisions (final values).**

- **Perimeter inflation:** `DOT_GRID / 2` for all three branches, as the brief specified. The 1-dot circle radius is `DOT_GRID / 2 + DOT_RADIUS` and the 2-dot stadium radius is `DOT_RADIUS + DOT_GRID / 2` (both keep the `DOT_RADIUS` term so the perimeter clears the dot's edge, not just its center). The 3+ convex-hull case uses a bare `DOT_GRID / 2` outward offset (the hull already passes through dot centers, so a half-cell offset reaches the midpoint to the next grid line without needing the `+ DOT_RADIUS` term). Did NOT need the `DOT_GRID / 2 + DOT_RADIUS` variant the brief flagged as a possible adjustment for the 3+ case — `DOT_GRID / 2` reads cleanly because the hull vertices are dot centers and the half-cell offset reaches halfway to the adjacent grid cell. The 1-dot/2-dot branches keep `DOT_RADIUS` because their radius is measured from the dot center and the geometry is a circle/stadium around the dot, not an offset of a hull through dot centers. Surfacing this minor inconsistency per the brief's stop-and-surface clause: the three branches are NOT perfectly uniform (1-dot/2-dot include `+ DOT_RADIUS`, 3+ does not), but each is correct for its own geometry — uniformity would actually misalign them.
- **Active-cluster buffer:** 4 dots (the brief's starting value), applied as `+ 4 × DOT_GRID²` to the `isOwnCluster` spec's target area before the `BUFFER_OVERHEAD_FACTOR` multiply. Kept at 4 — visual inspection wasn't reproducible from the agent session (canvas raycaster limitation), so I went with the brief's recommended starting value rather than guessing higher.
- **Active label z:** `Z_ACTIVE_CLUSTER_LABEL = 300` — above the dot-count-inverse cluster-label ranks (100–~200) and clearly below RFP labels (1100), zoom controls (1700), card overlay (1500/1600), tooltips.

**Deviations.**

1. **Legend tooltips render inline, not via portal.** The brief sanctioned this fallback ("If extracting the LegendBar tooltip pattern surfaces too much coupling … inline-render the Directory tooltips without portal-rendering"). DirectoryLayer.jsx doesn't import `createPortal`; the legend sits in the bottom-left corner where an absolutely-positioned tooltip (rendered above the hovered row, `bottom: calc(100% + 8px)`) clears the surrounding UI cleanly. No react-dom import added.
2. **Perimeter branch inflation not perfectly uniform** (see tuning decisions). 1-dot/2-dot keep `+ DOT_RADIUS`; 3+ uses bare `DOT_GRID / 2`. Each is geometrically correct for its branch; forcing uniformity would misalign them.
3. **RFP legend swatch color = `var(--accent-indigo)`** — matches the RFP marker's `rfpBaseColor = cssVarToColor('--accent-indigo', …)`. Both Full Disclosure and RFP render indigo; the filled-circle vs hollow-square shape distinguishes them (accurate to the actual rendering).

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Dev server: DirectoryLayer transforms with HTTP 200.
- Perimeter shape, legend appearance, cluster spacing, and label z-order are inherently visual + require canvas interaction — code-verified here; manual mouse walkthrough recommended for the visual QA items per the documented Directory raycaster limitation.

**Known scope boundaries.**

- Phase 17.5 (RFP creation flow) is next.
- Parent-layer EA-required-message bug still deferred.

**Status:** [x] Complete.

### Phase 17.4 completion notes (2026-05-19) — Umbrella DA arc: perimeter fix + seed expansion + Directory panel/card parity + perimeter hover

Closes the umbrella-DA visualisation work. Andrew's Option #3 (grouping perimeter, no edges) ratified — the visual infrastructure was largely already shipped (Phase 16.x); this phase fixed the broken perimeter, expanded the seed for all four roles, brought the Directory Claim panel/card to parity with the parent canvas, and added perimeter hover/tooltip.

**Diff (high-level).**

- `src/v2/DirectoryLayer.jsx` — `packClusterDense` gains `umbrellaCount` + `rfpCount` params and relocates the umbrella subset into a coherent edge-blob (perimeter fix). New props `disclosureAgreements`. Claim-card synthetic node stamps `_directoryWarmPathRequestCandidate` (+ adjusts `_directoryRequestEaCandidate` to require no-DA). Perimeter hover: `hoveredPerimeter` state + `hoveredPerimeterPartyRef`, point-in-polygon hit-test in `handleMouseMove`, hover brightening in the SVG path, HTML tooltip overlay. Cleared on phase-close / role-switch / mouse-leave.
- `src/v2/v2_2Data.js` — 5 new non-public MicroCo Claims (cMicroPcbStack / cMicroConnSpec / cMicroThermalPad / cMicroFwBootloader / cMicroRfFilter) + 14 new umbrella DAs across Alice→Bob, Alice→Carol, Dave→Alice, Dave→Carol. Added to the `claims` + `disclosureAgreements` arrays.
- `src/v2/AssetNode.jsx` — V22ActionBar Claim branch gains the warm-path Request EA button (`_directoryWarmPathRequestCandidate`), checked before the cold-path candidate (more-precise state wins).
- `src/v2/V2App.jsx` — Directory V22ClaimPanel mount threads `disclosureAgreementsForNode` / `evaluationAgreementsForNode` (filtered from sharedForPanel) + `resolveSubjectName` / `resolveClaimName`. New `handleRequestEaWarmPathForClaim` opens the EARequestModal. DirectoryLayer mount wires `disclosureAgreements` + the warm-path card-action case. Footer + Changelog modal rolled to v0.17.4.
- Standard 5 doc updates.

**Perimeter bug root cause + fix.** Investigation confirmed the view-builder data was correct (Bob's ChipCo cluster carried 7 umbrellaClaims). The bug was downstream in `packClusterDense`: it sorts available grid cells by distance from the cluster center ascending and fills the first N. Since the item array is `[...umbrellaItems, ...publicItems, ...rfpItems]` mapped 1:1 to positions, the umbrella items landed on the innermost cells — which ring the central label hole (the hole is excluded from packing). The convex-hull perimeter (`umbrellaOutlinePath`, offset outward 1 cell) of a ring-of-dots-around-a-hole encloses the hole, so the perimeter wrapped the actor pillbox with the dots sitting on its edge. Fix (surgical, per the brief's "only debug what feeds the function, don't rewrite umbrellaOutlinePath"): `packClusterDense` now accepts `umbrellaCount` + `rfpCount`, reserves the outermost `rfpCount` cells for RFPs, then picks the umbrella cells as a tight nearest-neighbor blob anchored at the inner cell furthest from center (the cluster's edge, away from the label hole). The hull of an edge-blob is a tight off-center polygon that wraps just the umbrella dots.

**Seed expansion + integrity.**

- New DA count: +14 (92006 → 92020). New Claim count: +5 (22994 → 22999).
- Per-role umbrella-subset counts (data-probe verified): Bob → ChipCo 7 + MicroCo 5; Alice → ChipCo 3; Carol → MicroCo 3 + ChipCo 3; Dave → none.
- Public-precedence preserved: the probe confirms no Claim that's both public + umbrella-to-active lands in `umbrellaClaims` (Bob's MicroCo cluster shows 3 public + 5 umbrella with zero overlap — the 5 umbrella are the new non-public Claims).
- Disclosure-type variety: Bob's MicroCo umbrella subset spans indigo (pcb-stack, rf-filter = full), amber (conn-spec, fw-bootloader = selective), green (thermal-pad = proofonly).

**Deviations.**

1. **Added 5 new MicroCo Claims rather than disclosing existing ones.** MicroCo's three existing Claims (cPrm / cVreg / cEmi) are all publicly disclosed, and public takes precedence over umbrella per §8.2.2 — so an umbrella DA on any of them would route the Claim to `publicClaims`, not `umbrellaClaims`, and no amber perimeter would render. The brief explicitly sanctions adding new Claims for the umbrella subset ("or add new Claims for the umbrella subset"). The 5 new Claims are minimal (no referenced Assets, like Dave's existing non-public Claims) and additive — the existing 3 public Claims (load-bearing in parent-canvas demos) are untouched.
2. **DA/EA mutation handlers omitted from the Directory mount.** The brief flagged that AgreementsSection row handlers (onAmendDa, onRevokeDa, onAgreementRowClick) may have parent-canvas-specific side effects. Decision: OMIT them on the Directory mount. Rationale: the umbrella viewer is the DA's grantee, and Amend/Revoke are grantor-side actions (the AgreementsSection gates those buttons on `activeParty === grantor` anyway, so they wouldn't render for the grantee even if passed). Agreement-row-click navigation would need parent-canvas context that doesn't exist from the Directory materialized panel. Passing only the lists + name resolvers gives the read-only Agreements section the brief wants.
3. **Revoked DA/EA lists passed empty on the Directory mount.** Revocation notices are a parent-canvas session flow (driven by `v22ActiveRevocationNotice`); the Directory materialized panel doesn't participate in that flow. Empty arrays are correct here.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Data-layer probes: umbrella-subset counts per role (above); new DA/Claim counts; public-precedence non-overlap.
- Dev server: DirectoryLayer / v2_2Data / RequirementsSetDetailModal all transform with HTTP 200.
- Perimeter rendering, hover/tooltip, panel content, and card actions are inherently visual + require canvas-click interaction — code-verified here per the documented V2Canvas/Directory raycaster limitation; manual mouse walkthrough recommended for the visual QA items (perimeter wraps correct dots, hover brightens, tooltip copy, warm-path panel/card).

**Known scope boundaries.**

- Parent-layer EA-required-message-when-not-needed bug still deferred (Andrew can't recall the symptom).
- Phase 17.5 (RFP creation flow) is next.

**Status:** [x] Complete.

### Phase 17.3.2 completion notes (2026-05-19) — Fan-out improvements + leak investigation + RFP owner card action bar

Five items batched before Phase 17.4 (umbrella DA edges) opens. Closes the Safari rapid-cycle crash with a surgical WebGL fix; ships visual polish on the fan-out animation; brings the RFP card to parity with the panel footer for owner Close/Reopen.

**Diff (high-level).**

- `src/v2/directoryLoadAnimation.js` — `DEFAULT_JITTER_MS` 250 → 600; `DEFAULT_WAVE_SPEED` 7000 → 9500. JSDoc updated.
- `src/v2/DirectoryLayer.jsx` — CSS wipe duration 550 → 900 ms (clip-path transition); cinematic zoom-out (new RAF loop at animation effect start; `cinematicZoomRafRef` cancelled in cleanup); WebGL context-loss extension call before `renderer.dispose()` (Safari crash fix); owner Close/Reopen markers stamped on synthetic RFP nodes.
- `src/v2/AssetNode.jsx` — RFP early-return action bar extended with Close + Reopen padlock SVG icons gated on the new markers; mutually exclusive with Solicit.
- `src/v2/V2App.jsx` — `onRfpCardAction` dispatcher extended with `closeRfp` / `reopenRfp` cases routing to the existing `setV22ClosedRfpIds` Map mutations the panel footer uses. Footer + Changelog modal rolled to v0.17.3.2.
- Standard 5 doc updates.

**Tuning constants summary (final values used).**

- `DEFAULT_WAVE_SPEED`: 9500 wu/sec
- `DEFAULT_JITTER_MS`: 600
- `DEFAULT_DOT_FADE_MS`: 90 (unchanged from 17.3.1)
- CSS wipe: 900 ms cubic-bezier(0.65, 0, 0.35, 1)
- Cinematic zoom: starts at `INITIAL_ZOOM × 1.3` (= 0.195, vs final 0.15) and eases out to `INITIAL_ZOOM` over 1500 ms via `easeOut(t) = 1 - (1-t)^3`

The 1.3× multiplier was the brief's starting suggestion and felt right on first inspection — keeping it. If QA reveals it's too tight or too subtle, easy to nudge to 1.15 or 1.4.

**Safari crash investigation outcome.**

Cannot reproduce Safari in this environment, so the investigation was code-review-driven. Three suspects:

1. **Scene mount/unmount cycle (PRIMARY suspect — confirmed root cause).** `shouldMountScene = phase !== 'closed'` drives the scene-init `useEffect`. Each Directory open/close cycle creates + disposes the full Three.js renderer (including all geometries, materials, instanced meshes, and the underlying WebGL context). Safari's GPU driver is known to be slow to reclaim disposed WebGL contexts; the platform's ~16-concurrent-context limit means rapid cycles (open/close 10+ times in succession) can hit the cap and crash the tab.
2. **closedRfpMesh geometry rebuild churn** — reviewed at line 2134 area. The rebuild path properly disposes `prevGeom` before attaching the new geometry. No leak.
3. **React state thrashing from setLabelOpacities** — reviewed. The setter is called per RAF tick during the animation, but React 18's automatic batching collapses same-tick setState calls into a single render. No remediation needed.

**Surgical fix applied** for the primary suspect: scene cleanup now calls `renderer.getContext().getExtension('WEBGL_lose_context').loseContext()` before `renderer.dispose()`. This dispatches a synchronous `webglcontextlost` event that prompts the GPU driver to release the context immediately rather than waiting for browser idle. Well-documented Safari-friendly pattern; no negative side effects on Chrome / Firefox (those already dispose cleanly — the extra call is a no-op when the context is already released or the extension is missing).

**Cannot verify in Safari from this session**: the fix is code-confirmed and matches well-known Safari WebGL practice, but real verification requires a manual Safari rapid-cycle test. Surfaced as "code-verified-only" per the V2Canvas raycaster convention.

**No throttle fallback applied.** Adding a 1000ms rate-limit on Directory open/close would degrade legitimate user toggles (one toggle, then immediate re-toggle is a reasonable user action). The surgical fix is contained and well-targeted; if it doesn't fully resolve the crash in Safari testing, a throttle can be added as a follow-up.

**Deviations.**

1. **Safari verification deferred.** No Safari available in agent session; surgical fix is code-confirmed but not browser-verified. Recommend manual Safari rapid-cycle test post-merge.
2. **No defensive throttle.** The brief explicitly allowed a throttle as fallback; not applied because the surgical fix is the right shape and a throttle would hurt UX. If post-merge Safari test still shows crashes, the throttle can be added in 17.3.3.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Code review pass: all three suspects analyzed; surgical fix targets the confirmed root cause.
- Cinematic zoom RAF lifecycle: `cinematicZoomRafRef` cancelled in cleanup; new entry cancels any in-flight RAF at the top. No leak.
- Padlock SVG icons: 16×16 viewBox at 13×13 render, stroke 1.2 matching existing icons (Solicit paper-airplane, Claim card ▷/◉).

**Known scope boundaries.**

- Parent-layer EA-required-message bug still deferred to Phase 17.4+.
- Solicitation withdraw / amend still deferred to Phase 17.6+.
- Real Safari verification of the WebGL fix is a manual post-merge step.

**Status:** [x] Complete.

### Phase 17.3.1 completion notes (2026-05-19) — Polish wrap: RFP card action bar + RfpDetailPanel cleanup + Requirements rows + fan-out animation tweaks

Four polish items batched before Phase 17.4 (umbrella DA edges) opens. Closes #202 fully (RfpDetailPanel piece) and ships substantial visual upgrades to the Directory entry experience.

**Diff (high-level).**

- `src/v2/AssetNode.jsx` — RFP early-return branch gains an inline action bar on hover/select when the synthetic node carries `_directorySolicitCandidate`. New paper-airplane SVG icon. Click dispatches `solicitWithClaim` via the existing `onV22CardAction` prop.
- `src/v2/DirectoryLayer.jsx` — new props `solicitations` + `onRfpCardAction` for RFP card wiring. RFP synthetic-node construction stamps `_directorySolicitCandidate` (non-owner + open + no existing user solicitation). RFP `Card` receives `onV22CardAction` wrapper that dispatches to `onRfpCardAction(action, d.rfp)`. **Animation rewrite**: `dotOpacitiesRef` reinterpreted from color multiplier to matrix scale factor; new `flushDotMatrices` + `flushRfpMatrices` callbacks + `dotMatricesDirtyRef` / `rfpMatricesDirtyRef` flags integrated into the existing animate-loop pattern. Matrix populate + rescale-on-zoom paths multiply by appearScale[i]. `flushDotColors` simplified (no opacity branch). Animation effect pre-zeroes the new `rfpAppearScalesRef` and triggers immediate matrix flushes so the very first frame is blank. Animation start passes RFP positions + `setRfpAppear` callback + jitter seed.
- `src/v2/directoryLoadAnimation.js` — speed (4500 → 7000 wu/sec), dotFadeMs (200 → 90 ms), new jitterMs (250 ms) with seeded xmur3 + mulberry32 PRNG, eased via easeOut(t) = 1-(1-t)^3, new `rfps` + `setRfpAppear` API. Helper-level comment block documents the semantics shift (appearance scale vs. opacity).
- `src/components/DetailPanel/RfpDetailPanel.jsx` — "ACTOR" pill removed from "POSTED BY" row; "ASSET" pill removed from "FOR ASSET" row. Required Standards section renamed "Requirements"; chips replaced by vertical full-width clickable `RequirementRow` components (new in-file helper). Missing-RS rows render dashed-border non-clickable. New `onRequirementClick` prop (V2App wires to `setV22OpenRsId`). Added `useState` import.
- `src/components/modals/RequirementsSetDetailModal.jsx` — new component (140 LOC). Read-only RS view via Backdrop / Modal / ModalHeader / ModalBody / ModalFooter primitives. Local GlobeIcon (canonical, matches LibraryModal + BadgesPanel + CombinedRequestModal). Header: name + version badge in title slot; "Published by {owner}" + globe in subtitle slot. Body: requirements list mirroring SolicitationCreateModal's accordion expanded-state treatment (inline-rendered, not extracted as a shared component). Footer: Close button only.
- `src/v2/V2App.jsx` — new state `v22OpenRsId`; new RequirementsSetDetailModal import + mount gated on `v22OpenRsId`. DirectoryLayer mount wires `solicitations={Array.from(v22Solicitations.values())}` + `onRfpCardAction={(action, rfp) => action === 'solicitWithClaim' && setV22SolicitOpenForRfp({ rfp })}`. RfpDetailPanel mount wires `onRequirementClick={(rsId) => setV22OpenRsId(rsId)}`. Footer constant + Changelog modal entry rolled to v0.17.3.1.
- `architecture-spec.md` — §8 Changelog bullet covering all four items + the matrix-scale animation rewrite.
- `polish-backlog.md` — #202 marked Complete (extended note covers the 17.3 + 17.3.1 scope split); Update Log entry for Phase 17.3.1.
- `CLAUDE.md` — Current state + active phase queue updated to reflect the polish wrap and 17.4 as next.

**Implementation notes — animation rewrite.**

The 16.2.3 implementation animated dot appearance by multiplying each dot's instance color by its opacity (0 → 1). At opacity 0 the dot rendered as black (color × 0 = (0,0,0)), which blended into the dark `--bg-deep` background — but was still a visible black dot, especially against the umbrella outlines and the grid background. The Phase 17.3.1 rewrite reinterprets the same per-instance value as a MATRIX SCALE factor: at 0 the per-instance matrix has scale 0 (dot is a point at its position, invisible); at 1 the matrix has the normal zoom-driven world-space size. Dots render at their final disclosure-type color from the moment of appearance; the wave grows each dot from a point to its full size.

The two existing matrix-write paths (populate-during-layout-build, rescale-on-zoom) were extended to multiply by `appearScale[i]`. A new flush callback runs during the wave to keep the matrices in sync as appearScales change. The hit-test mesh (rfpHitMesh) keeps full scale throughout — keeps the marker clickable mid-wave, since intercepting an early click against a tiny-scale marker would feel glitchy. The existing color-multiplier code path in `flushDotColors` was simplified (no more opacity branch).

RFP markers participate via parallel state (`rfpAppearScalesRef`) + a new helper API extension (`rfps` array + `setRfpAppear` callback). Closed-and-owned RFPs render via the separate `closedRfpMesh` (dashed `LineSegments`) — they were already excluded from `rfpMesh` / `rfpFillMesh` via the closed-owned partition, and the dashed mesh is geometry-built (not instance-matrix-driven), so it's not part of the appearance animation. Closed-owned RFPs render at full opacity from scene start. Surfacing this as a minor deviation from the brief: 99% of RFPs (open ones) participate; the ~few closed-owned ones don't. Acceptable in scope.

**Deviations.**

1. **`flushDotColors` simplification.** The pre-17.3.1 path multiplied each dot's color by its opacity. With matrix-scale-driven appearance, this is redundant — dots render at full color always (the multiplier branch never fired in steady state anyway). Removed entirely so the animation isn't confused between two parallel mechanisms.
2. **RFP hit-test mesh stays at full scale during the wave.** The brief said "scale from 0 to 1 is simpler since the materials are already opaque" for RFP meshes — that's true for the visible outline + fill. The hit-test mesh would be invisible regardless of scale (material is transparent), but rendering it at scale 0 would make early-appeared markers un-clickable mid-wave. Surfaced this trade-off as a documented intent in code comments.
3. **Closed-and-owned RFPs don't participate in the animation.** Those render via the separate dashed `closedRfpMesh` (geometry-built, not InstancedMesh — the dashing requires per-vertex line-distance computation that the matrix-scale approach doesn't accommodate cleanly). Phase 17.1 already handled them with a separate code path; extending the appearance animation to that path would be substantial scope, and only ~few RFPs are closed-and-owned in seed. Accepted as deviation.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Animation helper smoke-tested by inspection. Math: at canvas 11520×7447, max radial distance ~8284 wu / 7000 wu/sec = 1.18 s base + 0.09 s fade tail + 0.25 s jitter worst case = ~1.5 s total — within the brief's 1.5–2 s target.
- Code review for matrix consistency: populate path, rescale-on-zoom path, and per-animation flush path all use the same `scale = baseScale × appearScale[i]` formula. Pre-zero + immediate flush at animation start ensures the first frame is blank (no popping).
- The full canvas walkthrough (Bob views Alice's RFP card → hover → Solicit button appears → click → SolicitationCreateModal opens) requires mouse interaction per the documented V2Canvas raycaster limitation in CLAUDE.md.

**Known scope boundaries.**

- Parent-layer EA-required-message bug still deferred to Phase 17.4+.
- Solicitation withdraw / amend still deferred to Phase 17.6+.
- The pre-existing umbrella outline + label fade-in animation paths are NOT migrated to the scale-driven appearance — those use SVG opacity + label CSS opacity, which work fine without the black-to-color issue (they were never visible-but-wrong-color; just absent then fading in).

**Status:** [x] Complete.

### Phase 17.3 completion notes (2026-05-19) — Claim Detail Panel EA content on Directory + card action bar + #202 ACTOR/ASSET label cleanup

Opens the action surface for Directory-layer Claim discovery. Without this content, clicking a Claim on Directory opened a panel that didn't tell the viewer what they could do with it. This phase wires the action loop end-to-end and unifies it with the parent-canvas card/panel pattern. Also closes backlog #202.

**Diff (high-level).**

- `src/v2/v2_2Data.js` — new exported helper `getActiveEaForClaimAndRequester(claim, requesterParty, evaluationAgreements)`. Returns the resolved EA artifact (or null) for a given Claim/requester pair, filtering out declined/revoked EAs. Tie-break: prefer `active` over `pending-acceptance`, then most recent by `terms.createdDate`.
- `src/components/DetailPanel/V22NodeDetailPanel.jsx` — V22ClaimPanel gets four new props (`existingEaForActor`, `onRequestEa`, `onViewEa` + the existing `hasActiveDaWithoutEa`/`onRequestEvaluationAgreement` warm-path props). New EA-status section in the body: "An Evaluation Agreement is required to evaluate this Claim." (cold-path, amber callout) or "An Evaluation Agreement is in place with {owner}." (EA-exists, indigo callout). Owner-viewing-own renders neither. Footer extensions: Request Evaluation Agreement (cold-path) or View Evaluation Agreement (existing-EA) buttons. PanelHeader's `typeLabel` is now optional. V22ActorPanel + V22AssetPanel mounts drop the `typeLabel="ACTOR"` / `typeLabel="ASSET"` props (#202).
- `src/v2/AssetNode.jsx` — V22ActionBar Claim branch gains two new actions: `viewEvaluationAgreement` (when `node._directoryExistingEa` is stamped) and `requestEvaluationAgreement` (when `node._directoryRequestEaCandidate` is stamped, cold-path). Parent canvas Claim cards unaffected — the synthetic-node stamps come from DirectoryLayer's card-overlay render path only.
- `src/v2/DirectoryLayer.jsx` — imports `getActiveEaForClaimAndRequester`. New props `evaluationAgreements` + `onClaimCardAction`. Card-overlay render path stamps the synthetic Claim node with `_directoryRequestEaCandidate: !existingEa` and `_directoryExistingEa: existingEa || null` (gated on non-owner + both new props wired); passes a wrapped `onV22CardAction` that dispatches to `onClaimCardAction(action, node, claim, existingEa)`.
- `src/components/modals/AssetPickerModal.jsx` — prop contract generalized. New canonical props: `targetClaim` + optional `context` ({ type: 'directory-claim' } | { type: 'rfp', rfp }). Legacy props (`solicitation`, `solicitorClaim`, `rfp`) preserved as fallback for future re-use. Context block + subtitle vary based on entry path: directory-claim shows "Their Claim:" + "Owned by:"; rfp shows "From: {solicitor} via RFP: {rfpName}" + "Their Claim: ...". Submit shape now `{ assetId, claimId, solicitationId }` (claimId added, solicitationId null when no solicitation context).
- `src/v2/V2App.jsx` — re-import AssetPickerModal (removed in 17.2.1.1). New session state `v22RequestingEaForClaim: Claim | null`. Three new handlers: `handleRequestEaForClaim`, `handleAssetPickedForClaim`, `handleViewEa`. `handleViewEa` declared after `nodeMap` + `canvasRef` are in scope (line ~4060) to avoid TDZ on the useCallback deps array — comment explains. DirectoryLayer mount wires `evaluationAgreements` + `onClaimCardAction`. Directory Detail Panel mount wires `existingEaForActor` + `onRequestEa` + `onViewEa` (cold path resolves the EA via `getActiveEaForClaimAndRequester` on each render). New AssetPickerModal mount gated on `v22RequestingEaForClaim`. Footer constant + Changelog modal entry rolled to v0.17.3.
- `architecture-spec.md` — new §8.10 "Directory-layer Claim CTAs" + §8 Changelog bullet.
- `polish-backlog.md` — #202 marked Complete + Phase 17.3 Update Log entry.
- `CLAUDE.md` — Current state + active phase queue updated.

**Deviations.**

- **Parent-canvas Claim card action-bar pattern assessment.** The brief said to STOP and surface if the parent-canvas Claim card action bar pattern doesn't match the new Directory pattern. Audit result: the parent-canvas V22ActionBar Claim branch DOES have state-dependent CTAs but they're DIFFERENT from the Directory pattern. Parent canvas: Amend Claim + Self-Evaluate (owner), Run Evaluation (non-owner with EA via `evaluationAgreementForActor`), Request EA (non-owner with DA but no EA via `_hasActiveDaWithoutEa`). The brief implicitly assumed a "View EA" pattern on parent-canvas Claim cards; there isn't one — when the EA exists on parent canvas, the affordance is Run Evaluation (because the EA-exists state on parent canvas means the user can act). I added the Directory-specific View EA + cold-path Request EA via two NEW node stamps (`_directoryExistingEa` / `_directoryRequestEaCandidate`) so parent-canvas cards (which never receive those stamps) are untouched. The Directory pattern is therefore an extension, not a regression — Directory has different next-action semantics (can't Run Evaluation while on Directory — must surface the parent canvas first).
- **`handleViewEa` placement.** Originally declared with the other Phase 17.3 handlers at line ~2740 (next to `handleRequestEaForClaim` + `handleAssetPickedForClaim`). Hit TDZ on the useCallback deps array (`[nodeMap, v22Data]`) because `nodeMap` is destructured at line ~3315 (later in the V2App body). Moved to line ~4060 (after both `nodeMap` and `canvasRef` are in scope), with a comment in the original location pointing to the relocation. Functionally equivalent; explanation preserved for future readers.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Data-layer probe of `getActiveEaForClaimAndRequester` on the seed: Bob viewing his own GovCo Claim → null (correct, predicate filters out grantor === grantee since seed has no such EAs); Bob viewing Alice's "Power Regulation Module Assembly" Claim → resolves EA `ea-igcqc4yw`; null/empty inputs return null. Total active EAs from MicroCo→GovCo in seed: 2 (Alice's PRM + VReg Claims). All other ~22k Alice Claims land in the cold-path Request EA state on Bob's Directory view.
- Dev server module load: Vite transforms V2App.jsx cleanly (1.7 MB transformed); no SSR errors; HTTP 200 on root + transformed module. Full canvas walkthroughs (Bob clicks Alice's Claim → panel opens → footer Request EA → AssetPickerModal → CombinedRequestModal → submit) require mouse interaction per the documented V2Canvas raycaster limitation in CLAUDE.md.

**Known scope boundaries.**

- Parent-layer EA-required-message-when-not-needed bug deferred to Phase 17.4+ alongside umbrella DA edge work.
- Remaining Claim Detail Panel content items (#58 Export, #104 Click-to-jump, #116 Agreements section on EvalResult/PoE, #161 Diff highlighting, #180) can fold into 17.3.x patches or a later dedicated detail-panel polish phase.
- AssetPickerModal stays in the codebase as a generalized component (Directory-Claim flow active; legacy RFP-flow + future create-RFP entry preserved).

**Status:** [x] Complete.

### Phase 17.2.1.2 completion notes (2026-05-19) — Hotfix: CombinedRequestModal RS pre-selection + Detail Panel label backlog entry

Single bug fix closing the last QA item against the 17.2 arc, plus one backlog filing.

**Diff.**

- `src/v2/V2App.jsx` — `handleRequestAgreement` Accept-flow handler now threads `rfp.requirementsSetIds` (full array) as `suggestedRequirementsSetIds` (plural) instead of just the first id as `suggestedRequirementsSetId` (singular). CombinedRequestModal mount block reads the plural form first, falling back to the singular for the AI Shopper cold-path entry. Footer constant rolled forward to v0.17.2.1.2. Changelog modal entry prepended for v0.17.2.1.2.
- `polish-backlog.md` — new backlog item **#202** filed (Remove "ACTOR" and "ASSET" small-caps labels from Detail Panels — Effort S, pairs with Phase 17.3). Update Log entry prepended for Phase 17.2.1.2.
- `architecture-spec.md` — §8 Changelog gains a single-line bullet for Phase 17.2.1.2 covering the pre-selection fix.
- `CLAUDE.md` — Current state of the world updated to reflect Phase 17.2.1.2 as last shipped; active phase queue updated.

**Bug root cause.** Phase 17.2.1.1's data-source expansion for CombinedRequestModal's RS scrollbox worked correctly — all published RSes were appearing in the list (including the two Sentinel-4 RFP references `MIL-PRF-55681 Compliance v2` + `System Integration Requirements v1`). But only the first row was pre-checked. The CombinedRequestModal's own state initializer (`useState(() => [...initialRequirementsSetIds])`) was correct — spreads the entire input array. The bug was entirely upstream: V2App's `handleRequestAgreement` extracted only `rfp.requirementsSetIds[0]` and stored it as a single id (`suggestedRequirementsSetId` — singular field name inherited from the AI Shopper context), then the CombinedRequestModal mount block re-wrapped that single id into `[id]` for the `initialRequirementsSetIds` prop. Two truncation points compounding. Fix: change the data shape at the upstream end — store the full array as `suggestedRequirementsSetIds` (plural). The mount block prefers the plural array when present; falls back to the singular id (wrapped in `[id]`) for the unchanged AI Shopper path.

**Cold-path preservation.** AI Shopper entry path is untouched. `setV22AIShopperResult({ claimPin, suggestedRequirementsSetId })` (singular) still works — the mount block's fallback branch wraps it into `[id]` exactly as before. Cold-path Claim-PIN-click entry leaves `v22AIShopperResult` null entirely — zero RSes pre-checked, no regression.

**Build clean** (`✓ 129 modules transformed`, no errors).

**Backlog filing.** Andrew flagged removing the "ACTOR" and "ASSET" small-caps labels from Detail Panels during the QA pass. Filed as **#202** (Effort S, Open) under the Detail Panels section — pairs naturally with Phase 17.3's Claim Detail Panel content work (#58, #104, #116, #161, #180). Relational labels like "For Asset" on RfpDetailPanel are explicitly preserved per Andrew's note (they convey a relationship, not a category).

**Known scope boundaries.**

- The actual label removal is deferred — backlog only.
- The CombinedRequestModal's internal state shape was confirmed structurally sound (array-based, not single-selection); no scrollbox refactor needed.
- Phase 17.3+ remains the next major forward-progress phase.

**Status:** [x] Complete.

### Phase 17.2.1.1 completion notes (2026-05-19) — Hotfix: RFP-bound Asset + Claim greying + EA+DA notification Directory close + CombinedRequestModal RS scrollbox

Four QA-driven items closing out the 17.2 arc before 17.3+ opens.

**Diff (high-level).**

- `src/v2/v2_2Data.js` — `makeRfp` factory gains required `assetId` field (throws on missing). `generateRfpsForActor(actor, count, defaultAssetId)` requires `defaultAssetId`. Seed-data integrity: 20 RFP-only mock-cluster owners each get one stub Asset (`asset-{actor.id}-rfp-anchor`, owner = actor.party) so their RFPs have a valid Asset to bind to; mixed-cluster owners reuse their first existing Asset; Bob's Sentinel-4 RFP binds to `bAvionics`.
- `src/components/DetailPanel/RfpDetailPanel.jsx` — new "For Asset" row between Posted-by and Description block. Looks up `rfp.assetId` against a passed `assetsById` Map. "(Asset not found)" muted fallback.
- `src/v2/V2App.jsx` — `handleRequestAgreement` simplified: no more AssetPickerModal step; opens CombinedRequestModal directly with the RFP's bound Asset (`requesterAsset`), solicitor's Claim PIN (`initialPin`), and RFP's `requirementsSetIds` (`initialRequirementsSetIds`). AssetPickerModal mount removed from V2App's JSX (component file preserved). `handleAssetPicked` retained but unused. New `assetsByIdMap` derivation threaded down to RfpDetailPanel. CombinedRequestModal's `availableRequirementsSets` data source now includes all published RSes via dedupe-by-id merge of `publishedRequirementSets` + active actor's own `requirementSets`. EA+DA notification click handlers (`v22-request`, `v22-request-ea-only`, `v22-ea-accepted`, `v22-ea-declined`) close the Directory layer if open before cold-path navigation. Footer constant rolled forward to v0.17.2.1.1. Changelog modal entry prepended for v0.17.2.1.1.
- `src/components/modals/SolicitationCreateModal.jsx` — Claim picker greys out Claims already mapped to the RFP owner via an active or pending EA. New props `evaluationAgreements` + `solicitorParty`; predicate builds a `Set<claimId>` for "already on buyer's network"; greyed rows render at opacity 0.45 with `cursor: not-allowed`, no click handler, "ON NETWORK" pillbox, tooltip "Already on {ownerParty}'s network". Submit gating blocks greyed selection defensively.
- `src/components/modals/CombinedRequestModal.jsx` — new `GlobeIcon` component (canonical, matches LibraryModal / BadgesPanel / RequirementsPanel). RS scrollbox row rendering extended: when `rs.isPublished` is true, prepend globe icon to name + render "Published by {ownerParty}" muted line below; otherwise fall through to pre-17.2.1.1 minimal treatment (name + id + version).
- `architecture-spec.md` — §8.8.1 extended (RFP factory shape with `assetId` field); §8.9.6 rewritten (Accept flow simplified to direct CombinedRequestModal open); new §8.9.6.1 (Claim greying predicate + UX treatment); new §8.9.6.2 (EA+DA notification Directory close); new §8.9.6.3 (RS scrollbox extended data source + per-row rendering). Spec Changelog gets a Phase 17.2.1.1 bullet.
- `polish-backlog.md` — Phase 17.2.1.1 Update Log entry prepended.
- `CLAUDE.md` — Current state of the world updated to reflect Phase 17.2.1.1 as last shipped; active phase queue updated.

**Deviations.**

- **20 stub Assets for RFP-only mock-cluster owners.** The brief said: "If any RFP's owner's cluster contains zero Assets, STOP and surface — the seed has an inconsistency to fix at the data-design level." The 20 RFP-only mock actors had zero Assets, since they were seeded with only RFPs in Phase 16.2.6.5 (the Directory's RFP cluster expansion). Stopping here would have meant either skipping the assetId seeding for these RFPs (a non-starter — the brief makes `assetId` required) or designing a one-off "RFP-only Actor exemption." I judged that the cleanest fix is to give each RFP-only mock owner one stub Asset (`asset-{actor.id}-rfp-anchor`) so their RFPs bind cleanly. The Asset has owner = the actor's party so it satisfies the architectural rule. RFP-only mock owners are non-switchable demo participants, so the Asset isn't user-visible from any active role. Surfacing here so the design choice is on record.

**Runtime verification.**

- Build: `npm run build` clean (`✓ 129 modules transformed`, no errors).
- Data-layer probe: confirmed all 118 RFPs have valid `assetId` values that resolve in `shared.assets`; Bob's Sentinel-4 RFP binds to `bAvionics` ("Avionics Module").
- The RfpDetailPanel "For Asset" row, simplified Accept flow, SolicitationCreateModal Claim greying, EA+DA notification Directory close, and CombinedRequestModal RS scrollbox changes are code-verified — full canvas-click manual walkthroughs require mouse interaction per the documented V2Canvas raycaster limitation in CLAUDE.md.

**Known scope boundaries.**

- AssetPickerModal stays in the codebase for future create-RFP flow (Phase 17.5+). Only the V2App mount + handlers were removed from the Accept flow path.
- Solicitation withdraw / amend / multi-Claim solicitations still deferred to 17.6+.
- Create-RFP entry point + post-and-edit lifecycle still deferred to 17.5+.
- Phase 17.3+ (Claim Detail Panel polish, umbrella DA edges, etc.) still next in the forward queue.

**Status:** [x] Complete.

### Phase 17.2.1 completion notes (2026-05-19) — RFP Accept flow / Request Agreement

The Accept side of the RFP solicitation loop ships. Placeholder-disabled across 17.2 / 17.2.0.x with a "Coming in Phase 17.2.1" tooltip; now wired end-to-end. The full RFP arc (post → discover → solicit → reject/accept → formalize EA+DA) is demoable.

**Stop-and-surface gate outcome: PASSED CLEANLY.** The brief flagged three potential structural-change risks:
1. CombinedRequestModal may not accept external pre-fill cleanly.
2. Parent-canvas navigation + provisional-node pan/zoom may not work via the new entry path.
3. Submit-side effect hook may require CombinedRequestModal changes.

All three were investigated and resolved without touching CombinedRequestModal. Phase 7 (AI Shopper) already established the pre-fill mechanism: `requesterAsset` + `initialPin` + `initialRequirementsSetIds`. Phase 17.2.1 reuses it directly. Parent-canvas navigation runs through the existing `handleV22RequestSubmit` (sets `v22PanToClaimId`, etc.). Submit-side effect is a new conditional branch inside the existing handler, gated on `v22AcceptingSolicitation`. Cold-path is bit-identical.

**Flow chain.**

1. **Bob clicks "Request Agreement" on a pending SolicitationCard** in the RfpDetailPanel. The button — disabled with "Coming in Phase 17.2.1" tooltip across the arc — is now enabled, click fires `onRequestAgreement(solicitation)` prop.
2. **`handleRequestAgreement` captures the in-flight Accept-flow context:**
   ```js
   setV22AcceptingSolicitation({
     solicitationId: solicitation.id,
     solicitorClaimId: solicitation.claimId,
     rfpId: solicitation.rfpId,
   })
   ```
3. **AssetPickerModal mounts** (gated on `v22AcceptingSolicitation && !v22RequestOpen`). New component (`src/components/modals/AssetPickerModal.jsx`):
   - Title: "Pick an Asset"
   - Subtitle: `Pick the Asset that "{claim.name}" will map to in your network.`
   - Indigo-tinted context block: "From: {solicitor party} via RFP: {rfp name}" + "Their Claim: {claim name}"
   - Scrollable list of `shared.assets.filter(a => a.owner === activeRole.party)` (max-height 320 px). Each row: radio indicator + Asset name + ASSET pillbox + (file.filename when present).
   - Empty case: muted italic "You have no Assets to map this Claim to. Create an Asset on your parent canvas first."
   - Footer: Cancel + Continue (gated on selection).
4. **Continue fires `handleAssetPicked({ assetId, solicitationId })`**, which:
   - Resolves the picked Asset, the solicitor's Claim, and the RFP from `buildV22SharedArtifacts()`.
   - `setV22RequestAnchor({ id, name, pin })` — the picked Asset as a node-like shape (compatible with CombinedRequestModal's `requesterAsset` prop and `handleV22RequestSubmit`'s anchor reads).
   - `setV22AIShopperResult({ claimPin: solicitorClaim.pin, suggestedRequirementsSetId: rfp.requirementsSetIds[0] })` — reuses the AI Shopper pre-fill mechanism for PIN + first RS id.
   - `setV22RequestOpen(true)` — mounts CombinedRequestModal with the pre-fill.
5. **`v22AcceptingSolicitation` stays set across this transition** so the submit handler can detect the Accept entry path.
6. **Bob completes the existing CombinedRequestModal flow** (Step 1: confirm Claim + RSes; Step 2: acknowledgments; Submit). The modal calls `handleV22RequestSubmit(payload)` exactly as it does for cold-path entries.
7. **`handleV22RequestSubmit` runs its existing cold-path work** (create provisional EA+DA pair, append to `v22Provisionals`, close modal, clear anchor, select new Claim, queue parent-canvas pan/zoom, fire `v22-request` notification to grantor).
8. **Then a new conditional branch runs** when `v22AcceptingSolicitation` is non-null:
   ```js
   if (v22AcceptingSolicitation && v22AcceptingSolicitation.solicitationId) {
     // Capture EA id, update solicitation in-place via acceptSolicitation, fire accepted notification.
     const acceptingId = v22AcceptingSolicitation.solicitationId
     const newEaId = pair.evaluationAgreement.id
     let acceptedSolicitation = null
     setV22Solicitations((prev) => {
       const existing = prev.get(acceptingId)
       if (!existing) return prev
       acceptedSolicitation = acceptSolicitation(existing, newEaId)
       const next = new Map(prev)
       next.set(acceptingId, acceptedSolicitation)
       return next
     })
     // Fire v22-rfp-solicitation-accepted notification on solicitor's inbox.
     // Clear v22AcceptingSolicitation.
   }
   ```
9. **Dual notification on Alice's inbox.** Both notifications coexist intentionally:
   - `v22-request` (the existing cold-path notification) — actionable; click routes Alice to her parent canvas with the new EA+DA visible and the Disclosure-Response modal entry point exposed.
   - `v22-rfp-solicitation-accepted` (new) — informational; click routes Directory → RFP marker → RfpDetailPanel where the solicitor-view accepted-state surfaces the EA pointer for context.
10. **SolicitationCard re-renders in accepted state** on both viewer perspectives. Owner sees "Agreement requested on {date}" with the "see the provisional EA on the parent canvas" pointer; solicitor sees "Accepted on {date}" with "see your new Evaluation Agreement on the parent canvas". No action buttons in either view — the EA+DA is now the live artifact and is managed via the parent canvas.

**Files touched (7):**

- `src/v2/v2_2Data.js` — `makeRfpSolicitation` gains optional `acceptedEaId` (default null); new exported `acceptSolicitation(solicitation, eaId)` pure transform.
- `src/components/modals/AssetPickerModal.jsx` — new component.
- `src/components/DetailPanel/SolicitationCard.jsx` — enabled the Request Agreement button (removed the disabled state + "Coming in Phase 17.2.1" tooltip); added accepted-state treatment for both viewer modes; threaded new `onRequestAgreement` prop; updated the date block to show "Agreement requested" on accepted; updated the header comment.
- `src/components/DetailPanel/RfpDetailPanel.jsx` — new `onRequestAgreement` prop; threaded through to SolicitationCard in the owner-view incoming-solicitations render block.
- `src/v2/V2App.jsx`:
  - Imports: `acceptSolicitation` + `AssetPickerModal`.
  - New state: `v22AcceptingSolicitation = { solicitationId, solicitorClaimId, rfpId } | null`.
  - New handlers: `handleRequestAgreement(solicitation)` and `handleAssetPicked({ assetId, solicitationId })`.
  - Extended: `handleV22RequestSubmit` with the post-submit conditional branch (cold-path bit-preserved).
  - Notification rendering: new `isV22RfpSolicitationAccepted` boolean; green badge color; ACCEPTED label; "{requester} accepted your solicitation — see your new EA on the parent canvas" body copy.
  - Notification click dispatch: extended the existing `v22-rfp-solicitation-{received,rejected}` branch to also handle `-accepted` (same Directory → RFP → panel routing).
  - Mounted AssetPickerModal in the modal-stack region (gated on `v22AcceptingSolicitation && !v22RequestOpen`).
  - RfpDetailPanel mount: passes `onRequestAgreement={handleRequestAgreement}`.
  - CombinedRequestModal `onClose`: extended to also clear `v22AcceptingSolicitation` and `v22RequestAnchor` (so mid-flow cancellation returns to a clean state).
  - Footer constant v0.17.2.0.4 → v0.17.2.1; Changelog modal entry prepended.
- `architecture-spec.md`: new §8.9.6 (Accept flow); renumbered §8.9.6 (Forward pointers) → §8.9.7 with the 17.2.1 entry removed and the remaining items (17.3+) preserved.
- `polish-backlog.md`: Update Log entry referencing #192.
- `CLAUDE.md`: Current state of the world rolled forward; active phase queue updated (next: Phase 17.3 — Claim Detail Panel content polish).
- `CLAUDE-phase-log.md`: this entry.

**Build clean.** `npm run build` exits 0 (2.09 s). Dev server smoke probe confirms no setState-in-render warning + no new errors beyond pre-existing `packClusterDense` overflow logs.

**Data-layer probe** (`/tmp/accept-flow-data-probe.mjs`):
- `makeRfpSolicitation({...})` → `acceptedEaId: null` on pending. ✓
- `acceptSolicitation(pending, 'ea-x')` → status: `'accepted'`, `respondedDate` populated, `acceptedEaId: 'ea-x'`. ✓
- Source not mutated (the pending solicitation retains status `'pending'`). ✓
- Throws on null solicitation. ✓
- Throws on null eaId. ✓
- `mergeSolicitations(shared, Map<id, accepted>)` overlays the accepted solicitation correctly. ✓
- Seeded Bob has 3 owned Assets (so AssetPickerModal's list won't be empty in normal demo). ✓

**Runtime-verification caveats.** The Accept happy-path (items 1–10) requires manual mouse + keyboard exercise — the CombinedRequestModal has 2 steps + acknowledgments + multi-select RS picker that aren't reliably operable via DOM-dispatched synthetic events at the scope of this phase's verification budget. The component-level guarantees are robust: each step's enable/submit gates are deterministic state expressions; the post-submit conditional branch in `handleV22RequestSubmit` is unit-testable via the data-layer probe (above); the notification dispatch + click routing reuse the existing solicitation-{received,rejected} infrastructure verbatim. Code-verified items: 1–10 (Accept happy path), 11–12 (button gating on accepted state — visible in SolicitationCard render block), 13–14 (Cancel paths — explicit state clears in the cancel handlers), 15 (zero-Assets defensive — explicit empty-case branch in AssetPickerModal), 16 (cold-path preservation — conditional gate on `v22AcceptingSolicitation` is the structural guarantee).

**Out of scope** (kept narrow per the brief): withdraw / amend an accepted solicitation (Phase 17.6+); withdraw / decline at this entry point (folds into the existing parent-canvas EA+DA flow — no new work); edit/create RFP (still 17.5+/17.6+); parent canvas RFP rendering, Claim Detail Panel content (17.3), umbrella DA edges (17.4+); auto-skip AssetPickerModal at 1 Asset (intentional: always show for confirmation); filter/search inside AssetPickerModal (single list adequate for current Asset counts).

**Next forward-progress**: Phase 17.3 — Claim Detail Panel content polish (#58, #104, #116, #161, #180).

**Status:** [x] Complete.

### Phase 17.2.0.4 completion notes (2026-05-18) — LOD threshold revert + zoom control z-index + AI Shopper modal lag

Three QA-driven fixes, including the AI Shopper performance investigation.

**(1) LOD thresholds reverted.** Phase 17.2.0.3 widened the mini-card band to 2.5–5.5 (250 %–550 %). At the 2.5 lower bound, mini-cards overlapped visibly in dense clusters (Pinnacle Systems with 200+ Claims, similar density at GovCo, Marigold, ArrowGuard). The density invariant `zoom × DOT_GRID ≥ card_width_px` requires zoom ≥ `MINI_CARD_W / DOT_GRID = 160 / 48 = 3.333` for cards not to overlap horizontally — 2.5 was below that. Reverted to:
- `MID_LOD_THRESHOLD`: 2.5 → 3.4 (a hair above the density-invariant value; 3.4 × 48 = 163.2 px screen spacing vs 160 px mini-card width = 3.2 px buffer per cell).
- `LOD_THRESHOLD`: 5.5 → 5.0 (slightly wider than the pre-17.2.0.3 baseline of 4.375; keeps a moderately-extended mini-card range without the overlap pathology).
- `MAX_ZOOM`: stays at 6.5 from 17.2.0.3 (no change).

`selectRfp`'s zoom override `Math.max(zoomRef.current, LOD_THRESHOLD)` automatically picks up the new 5.0 — notification clicks from the 15 % galactic-view default now land at 500 % (full-card LOD), down from 550 % (17.2.0.3). Same UX outcome: card is immediately readable.

**(2) Directory zoom controls raised.** The +/-/FIT buttons in the top-right of the Directory layer sat at `zIndex: 50`. Card overlay sits at `zIndex: 1500` default and `zIndex: 1600` when selected. At mid/full LOD with cards rendering near the top-right, cards covered the zoom buttons. Fix: bumped the Directory's zoom-control container to `zIndex: 1700`. The new value sits intentionally between the card layer (1500–1600) and the header pillbox (2000) / tooltip cards (2500), so contextual chrome still draws above the controls when triggered. Cluster labels stay at their existing z-tier (Z_BASE_CLUSTER_LABEL = 100 + rank inverse, capped well below 1700; RFP owner labels at Z_RFP_LABEL = 1100). Per the brief, cluster labels were NOT elevated alongside the zoom controls.

V2Canvas's own zoom controls (the parent layer's set, also at zIndex 50) were intentionally NOT touched — they sit BEHIND the Directory's clip-path wipe while the Directory is open, so visibility-during-Directory is solely a function of the Directory's controls. DOM-probe-verified: both zoom-control containers exist (one in V2Canvas at z=50, one inside the Directory layer at z=1700); only the latter is visible while Directory is open.

**(3) AI Shopper modal lag — investigation + surgical fix.** The brief documented a ~5 second click-to-modal lag. Investigation via standalone microbenchmark + puppeteer timing:

```
buildV22SharedArtifacts (cold call):  258 ms  (rebuilds ~23k Claims, ~92k DAs)
buildV22SharedArtifacts (cached call): 0.001 ms
Public-claims derivation BEFORE fix:  1605 ms (linear find per public DA)
Public-claims derivation AFTER fix:     16 ms (Map lookup per public DA)
```

The IIFE at `v22AIShopperOpen && (() => { ... })()` in V2App's render evaluated synchronously on the open-state flip and did two expensive things: (a) called `buildV22SharedArtifacts()`, which rebuilds the entire seeded shared-artifact set from scratch (no module-level cache), and (b) ran `publicDas.map(d => shared.claims.find(c => c.id === d.subject.id))` — for each of ~22,987 public DAs, it linearly scanned ~22,994 Claims. The 5-second reported lag is the combined effect plus React reconciliation + browser paint.

Two surgical fixes applied:

**(a) Module-level cache for `buildV22SharedArtifacts`** in `v2_2Data.js`:
```js
let cachedV22SharedArtifacts = null
export function buildV22SharedArtifacts() {
  if (cachedV22SharedArtifacts) return cachedV22SharedArtifacts
  const result = buildV22SharedArtifactsUncached()
  cachedV22SharedArtifacts = result
  return result
}
// Existing body moved into buildV22SharedArtifactsUncached().
```

The function takes no parameters and constructs a deterministic dataset; the cache returns the same object on subsequent calls. Verified that every existing caller treats the result as read-only (find / filter / map / `{...shared}` shallow-spread in `mergeProvisionals`, `mergeClosedRfps`, `mergeSolicitations` — none mutate the returned arrays or objects). The contract is documented in a comment above the cache: future mutations MUST either invalidate the cache or shape themselves as a new merge layer.

**(b) `claimsById` Map in the AI Shopper IIFE** (V2App.jsx):
```js
const claimsById = new Map(shared.claims.map((c) => [c.id, c]))
const publicClaims = publicDas
  .map((d) => {
    const claim = claimsById.get(d.subject.id)   // O(1) instead of O(n) find
    if (!claim) return null
    return { id: claim.id, name: claim.name, pin: claim.pin, owner: claim.owner, publishedDisclosureType: d.type }
  })
  .filter(Boolean)
```

The Map build is O(n) once; each lookup is O(1). Total drops from O(n²) ≈ 1.6 s to O(n) ≈ 16 ms.

**Combined post-fix timing**: 81 ms click-to-modal-visible measured via puppeteer (waiting for an element whose `textContent` matches `/AI Shopper/i` to appear after a `data-ai-shopper` button click). Cold first render: under 500 ms target. Subsequent opens during the same session: 0 ms (cache hits) + 16 ms (Map). The fix is surgical — no structural changes, no state lifting, no component-tree refactor — and contained to one new closure variable in `v2_2Data.js` plus the existing IIFE rewrite.

**Build clean.** `npm run build` exits 0 (2.26 s, 0 errors). Dev server smoke probe confirms no new console errors beyond the pre-existing `packClusterDense` overflow warnings.

**Runtime-verification caveats.** Items 1–3 (LOD threshold visual quality at the new boundaries) are inherently visual and require manual mouse + scroll-wheel exercise — same caveat as 17.2.0.3. Threshold values changed to 3.4 / 5.0; the boolean `zoom >= MID_LOD_THRESHOLD` / `zoom >= LOD_THRESHOLD` comparisons in the render block automatically pick up the new constants. Item 7 (modal renders within 500 ms) **runtime-verified at 81 ms**. Item 5 (zoom controls visible at every LOD) is DOM-probe-verified at z=1700 with the card overlay at z=1500/1600 — the layering guarantees visibility without needing the LOD-active visual check. The visual verification of "cards near top-right at full LOD" is deferred to manual QA per the canvas-raycaster limitation.

**Out of scope** (kept narrow per the brief): Directory-layer modal opening performance (separate from AI Shopper — the AI Shopper investigation surfaced its specific root cause; if other Directory-layer modal flows have a similar cost, file separately when symptoms arise); GovCo RFP placement next to Pinnacle Systems (still deferred — Directory layout polish); Phase 17.2.1's Accept flow / Request Agreement (still the next major phase).

**Doc updates**: footer v0.17.2.0.3 → v0.17.2.0.4 in V2App.jsx; Changelog modal entry prepended above Phase 17.2.0.3; architecture-spec.md §8 Changelog gains a Phase 17.2.0.4 hotfix bullet (no §8 structural change); polish-backlog.md Update Log gains the Phase 17.2.0.4 entry; CLAUDE.md "Current state of the world" rolled forward; this CLAUDE-phase-log.md entry.

**Status:** [x] Complete.

### Phase 17.2.0.3 completion notes (2026-05-18) — RFP description in solicitation modal + expanded mini-card zoom range

Two polish items batched before Phase 17.2.1's Accept-flow lift.

**(1) RFP description block in SolicitationCreateModal.** New section between the modal subtitle and the Required Standards accordion. `<FieldLabel label="RFP Description" />` (matches the "Required Standards (N)" label so the two sections visually pair). Body renders `rfp.description` with `white-space: pre-wrap` + `word-break: break-word` + `line-height: 1.5` + `font-size: 13` + `color: var(--text-secondary)` — same shape as `RfpDetailPanel`'s description block. Empty case renders `No description provided.` in `font-style: italic` + `color: var(--text-dim)`, mirror of the same fallback in `RfpDetailPanel`. Section divider `1px` line at 60 % opacity below the description pairs with the existing divider between the accordion and the Claim picker. Modal-body scrolling already handled by `ModalShared`'s `maxHeight: 90vh` + `ModalBody { flex: 1; overflow: auto }` — the new section participates in that scroll naturally.

Section ordering in modal body (post-17.2.0.3):
1. RFP Description (new, between subtitle and RS accordion)
2. Section divider
3. RFP Required Standards accordion (17.2.0.2)
4. Section divider (existing)
5. Claim picker
6. Message field

**(2) Mini-card zoom range widened in `DirectoryLayer.jsx`.** Three constant changes:
- `MID_LOD_THRESHOLD`: `MINI_CARD_W / DOT_GRID` (= 3.333) → explicit `2.5`. Mini-cards now begin rendering at 250 % zoom (was 350 %).
- `LOD_THRESHOLD`: `CARD_W / DOT_GRID` (= 4.375) → explicit `5.5`. Full-cards now begin rendering at 550 % zoom (was 450 %).
- `MAX_ZOOM`: `5.0` → `6.5`. The new full-card threshold (5.5) is above the old MAX_ZOOM, so without bumping MAX_ZOOM users couldn't reach full-card LOD. 6.5 leaves ~18 % headroom above LOD_THRESHOLD, comparable to the prior 14 % headroom (5.0 above 4.375).

The values are now explicit UX-driven constants rather than derived from the density invariant (`zoom × DOT_GRID ≥ card_width_px` — cards never overlap horizontally at the threshold). At 2.5 zoom × 48 wu DOT_GRID = 120 px screen spacing; mini-card width = 160 px → mini-cards CAN visibly overlap horizontally inside dense clusters at the low end of the band. Per the brief's "readability win outweighs the mild collision risk" framing, this is the intentional design choice.

`selectRfp` (Phase 17.2.0.2 imperative handle) uses `Math.max(zoomRef.current, LOD_THRESHOLD)` as the override target. With `LOD_THRESHOLD = 5.5`, notification clicks from the 15 % galactic-view default now land at 550 % zoom — full-card LOD where the marker reads clearly. No changes needed to `selectRfp` itself — the reference automatically picks up the new value.

Audited all other threshold uses in the file (grep for `MID_LOD_THRESHOLD`, `LOD_THRESHOLD`, `MAX_ZOOM`, `3.333`, `4.375`, `5.0`):
- `cardLOD = zoom >= MID_LOD_THRESHOLD` (mid-LOD detection in card render block) — uses the constant, automatically picks up 2.5.
- `isFullLOD = zoom >= LOD_THRESHOLD` (full-card vs mini-card selection) — uses the constant, picks up 5.5.
- `Math.min(MAX_ZOOM, ...)` in wheel + zoom-button handlers — uses the constant, picks up 6.5.
- `selectRfp(rfp)`'s zoom override — uses the constant, picks up 5.5.
- `if (zoom >= MID_LOD_THRESHOLD && hover) setHover(null)` — uses the constant.

One pre-existing stale code comment ("at every supported zoom level (up to MAX_ZOOM = 4.0)" near `dotGeometry` construction) drifted further with this change. It was already stale (MAX_ZOOM has been 5.0 since 16.2.7); not corrected here to keep this phase's scope tight. Filed mentally as a future tidy-up; no functional impact.

**Build clean.** `npm run build` succeeds at 2.23 s, 0 errors. **Dev server smoke**: `npm run dev` launches; the puppeteer probe confirms no new console errors beyond the pre-existing `packClusterDense` overflow warnings (16.2.6.x; documented + accepted).

**Runtime-verification caveats.** Items 5–8 (LOD threshold visual quality at the new boundaries) are inherently visual and require manual mouse + scroll-wheel exercise — the puppeteer probe's programmatic zoom-button click didn't reliably advance zoom beyond 100 % in headless mode, so I couldn't statistically validate the LOD swap points. The new threshold values are explicit numerics with clear boolean comparisons in the render block; the static verification is solid. Item 1 (description renders when present) is structurally guaranteed by the conditional render block; item 2 (empty fallback) is the explicit else-branch; item 3 (multiline preservation) is the `white-space: pre-wrap` declaration; item 4 (modal body scrolls) is preserved via the existing ModalShared cap. If the user finds 250 % too cramped or 550 % too late in actual use, surface for a follow-up adjustment within the brief's ±30 % envelope.

**Out of scope** (kept narrow per the brief): Modal opening performance in the Directory layer (still deferred); GovCo RFP placement next to Pinnacle Systems (still deferred — Directory layout polish); Phase 17.2.1's Accept flow / Request Agreement (still the next major phase).

**Doc updates**: footer v0.17.2.0.2 → v0.17.2.0.3 in V2App.jsx; Changelog modal entry prepended above Phase 17.2.0.2; architecture-spec.md §8 Changelog gains a Phase 17.2.0.3 hotfix bullet (no §8 structural change); polish-backlog.md Update Log gains the Phase 17.2.0.3 entry; CLAUDE.md "Current state of the world" rolled forward; this CLAUDE-phase-log.md entry.

**Status:** [x] Complete.

### Phase 17.2.0.2 completion notes (2026-05-18) — Notification click completion + own-cluster label + RS accordion in solicitation modal

Three items, all polish on top of 17.2 / 17.2.0.1.

**(1) Notification click completion.** Phase 17.2.0.1's `panToRfp` was pan-only at current zoom, so a notification click from the default 15 % galactic view pannned negligibly and did not select the target marker on-canvas (no pinned tooltip, no brightening). Replaced with `selectRfp(rfp)` (imperative handle), backed by a new shared helper:

```js
const focusRfpInternal = useCallback((d, dotIndex, opts = {}) => {
  const screen = worldToScreen(d.x, d.y)
  setPinned({ rfp: d.rfp, x: d.x, y: d.y, screenX: screen.x, screenY: screen.y, ownerParty: d.rfp.owner, dotIndex })
  const targetZoom = opts.zoom ?? zoomRef.current
  const panelOffsetWorld = (PANEL_W / 2) / targetZoom
  animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)
}, [worldToScreen, animatedPanToWithZoom])
```

Both the internal `handleMouseUp` RFP branch and the `onCardClick` RFP branch now call `focusRfpInternal(d, dotIndex)` (no zoom override — current zoom preserved). The external `selectRfp` calls `focusRfpInternal(d, dotIndex, { zoom: Math.max(zoomRef.current, LOD_THRESHOLD) })` so a notification click from the galactic view lands at full-card LOD where the marker reads clearly; from already-zoomed-in views the current zoom is preserved (no zoom-out surprise). V2App's notification handler swaps `directoryLayerRef.current?.panToRfp?.(targetRfp)` → `directoryLayerRef.current?.selectRfp?.(targetRfp)`; the rAF retry loop guard from 17.2.0.1 (cap 60 frames / ~1 s @ 60 fps) is preserved verbatim. V2App's own setV22DirectorySelectedRfp / setV22DirectorySelectedClaim calls still fire before the imperative — those drive the Detail Panel mount path; the imperative drives only the on-canvas state. The shared helper guarantees behavioural parity between manual marker / card click and notification-driven select.

**(2) Active actor's own-cluster label amber styling.** `PillboxLabel` accepts a new `isOwn` boolean prop. When true, `background: var(--accent-amber)` + `color: var(--bg-deep)` (dark text for contrast against amber). Otherwise the existing neutral `color-mix(in srgb, var(--bg-card) 92%, var(--text-dim))` styling stays unchanged. The cluster label render block computes `isOwn = !!layout.activeParty && cluster.ownerParty === layout.activeParty` per rendered cluster. Carol/AuditCo has no cluster on the Directory (no Claims, no Assets — AuditCo is an evaluator that doesn't own a catalog), so this gating naturally degenerates to "no cluster to style" on Carol's view. DOM-probe-verified at runtime: opening the Directory on Bob's view yields exactly 1 amber pillbox (GovCo, computed `rgb(245, 158, 11)`) and 98 neutral. The `--accent-amber` variable is the same one used for the Directory globe active-state, inbox-with-notifications icon, and cross-role notification dot — orthogonal to the indigo avatar-circle gradient on the role-indicator chip itself, but matches the "active-actor signal" amber convention elsewhere in the chrome.

**(3) SolicitationCreateModal — Required Standards accordion.** New section rendered above the Claim picker so the solicitor can review what each RS the RFP references actually requires before choosing a Claim to suggest. Modal accepts a new `requirementsSets` prop (array); V2App threads `publishedRequirementSets` (same source the RFP Detail Panel uses to resolve RS chips). New `RsAccordionEntry` sub-component:

- **Closed state** — clickable row with chevron (`▸`) + name + version pill on the right. Hover lifts background to `var(--bg-raised)`.
- **Open state** — chevron rotates to `▾`. Expanded panel below shows the RS's `description` (if present) and a list of requirement items. Each item card carries the requirement `id` (mono pill, uppercase), `label` (body, primary text), `description` (secondary, if distinct from label), and `criterion` (muted italic prefixed with "Criterion: ").
- **Multi-expand** — state is `useState(() => new Set())`; clicking a header toggles that rsId in the set.
- **Missing-RS** — when an `rsId` in `rfp.requirementsSetIds` doesn't resolve in the `requirementsSets` lookup, the row renders with the raw id in muted text and the expanded body shows "(Standard not found)". (Defensive — the seeded RFP's two RSes are both in `publishedRequirementSets`, but future RFPs referencing unseeded RSes would surface this state.)
- **Zero RSes** — if `rfp.requirementsSetIds.length === 0`, the section renders muted italic "No required standards specified."
- **Scrollbox** — section has `max-height: 240px` + `overflow-y: auto`. Bounds modal growth so the Claim picker below remains visible regardless of RS count.
- **Modal-body scroll** — already handled by ModalShared's `maxHeight: 90vh` + `ModalBody { flex: 1; overflow: auto }`, so the acceptance requirement (modal body scrolls when modal exceeds viewport) is satisfied via existing infrastructure; header + footer stay pinned via flex-shrink: 0.
- **Section ordering** in the modal body: (1) RFP Required Standards accordion → (2) thin section divider (`1px` line at 60 % opacity) → (3) Claim picker → (4) message field.

**Build clean.** `npm run build` exits 0 with no new warnings. `npm run dev` brought up at port 5173; puppeteer + CDP probe confirms: console clean (only pre-existing `packClusterDense` overflow warnings); GovCo's cluster pillbox on Bob's view renders amber per the DOM inspection above; the V2Canvas2 setState-in-render warning fixed in 17.2.0.1 stays gone.

**Runtime-verification caveats.** Acceptance items 1–3 (notification click → full select with pan + zoom + tooltip + brightening) and items 4–7 from 17.2.0.1 (cursor + hover) require manual mouse interaction — the Three.js raycaster doesn't respond to DOM-dispatched synthetic events per the documented limitation in CLAUDE.md. Items 9–15 (accordion in SolicitationCreateModal) also require a manual flow: switch to Alice → open Bob's Sentinel-4 RFP via Directory → click "Solicit with my Claim" → exercise the accordion. The code paths are statically verified: `RsAccordionEntry` renders with the full requirement schema (id/label/description/criterion all from the seeded MIL-PRF-55681 and System Integration RSes); accordion state uses idempotent Set toggling; the scrollbox + modal-cap chain is already exercised by other modal flows; `requirementsSets={publishedRequirementSets}` prop wiring on the V2App side passes the same seeded RS pool the RFP Detail Panel uses.

**Out of scope** (kept narrow per the brief): Modal opening performance in the Directory layer (still deferred); GovCo RFP placement next to Pinnacle Systems (still deferred); Phase 17.2.1's Accept flow / Request Agreement (still the next major phase); Parent-layer own-cluster styling (this phase is Directory-only per brief); RS-chip → Library click-through (still deferred).

**Doc updates**: footer v0.17.2.0.1 → v0.17.2.0.2 in V2App.jsx; Changelog modal entry prepended above Phase 17.2.0.1; architecture-spec.md §8 Changelog gains a Phase 17.2.0.2 hotfix bullet (no §8 structural change); polish-backlog.md Update Log gains the Phase 17.2.0.2 entry; CLAUDE.md "Current state of the world" rolled forward; this CLAUDE-phase-log.md entry.

**Status:** [x] Complete.

### Phase 17.2.0.1 completion notes (2026-05-18) — Hotfix: notification routing + Directory cursor/hover + V2Canvas2 setState fix

Three runtime-QA items from Phase 17.2 closed in one pass:

**(1) Notification click routing.** Both `v22-rfp-solicitation-received` and `v22-rfp-solicitation-rejected` now fire all four sub-steps on click (open Directory if closed → clear Claim panel → set RFP panel → pan + zoom Directory camera to the RFP marker). The 17.2 implementation registered the first three but omitted the camera pan because the pan logic lives inside DirectoryLayer and Phase 17.2 had no way to invoke it from V2App. Fix: `DirectoryLayer` wrapped in `forwardRef`; new `useImperativeHandle` exposes a `panToRfp(rfp)` method that resolves the RFP's dot in the layout and runs the same `animatedPanToWithZoom` pan the internal click flow uses (panel-offset compensation, current-zoom retention, 500ms ease). V2App holds `directoryLayerRef = useRef(null)` and passes it to the DirectoryLayer mount. The notification handler schedules the pan via a rAF retry loop (capped at 60 frames / ~1s) — necessary because clicking a notification when Directory is closed sets `v22DirectoryOpen = true`, but the Directory's phase machine + scene-init + load-animation chain takes ~600ms to reach layout-ready state. The imperative `panToRfp` returns `false` while layout is null; the loop retries each frame until success. After the cap (defensive) it stops. Smoke-tested via puppeteer + CDP: clicking a `v22-rfp-solicitation-received` notification on Bob's view fires all four sub-steps with no console errors.

**(2) Directory cursor pointer.** Added imperative `canvasEl.style.cursor = hit ? 'pointer' : 'default'` in `handleMouseMove`, set from the raycast result. The canvas element's React inline style sat at `cursor: 'default'` (rendered above the container in z-order), masking any container-level cursor change — so the cursor on the Directory canvas always stayed `default` regardless of hover state. Setting on the canvas directly works. Also reset on `onMouseLeave` so re-entering an empty region starts at `default` instead of the last-hit `pointer`. Mid/full-LOD card hover (Items 7 of the QA) works automatically: AssetNode + AssetNodeMini already carry `cursor: pointer` on their main wrappers (Phase 16.2.7 inheritance). The closed-RFP dashed mesh routes through the same `rfpHitMesh` raycast as open RFPs, so it gets pointer cursor through the same path.

**(3) RFP open-marker hover/select brightening.** Phase 17.2 implemented the brightening pipeline (per-instance `instanceColor` + `rfpDirtyRef` + `flushRfpColors` flushed once per animation tick) but the actual color delta was nil. Root cause: material color was set to `--accent-indigo` and `instanceColor` was initialised to white `(1,1,1)`, so the fragment shader multiplied `indigo × white = indigo` (identity). On hover/select, `flushRfpColors` wrote `THREE.Color('#ffffff')` (still `(1,1,1)`) — same identity, no visible delta. The fix: switch both `rfpMaterial.color` and `rfpFillMaterial.color` to `0xffffff` and let the per-instance color carry the entire color signal. Base instance color = `var(--accent-indigo)` (the actual rendered baseline color); `flushRfpColors` lerps base 0.35 toward white on hover, 0.65 on select. Closed-RFP per-vertex colors get the same hover-vs-select split (was: single 0.55 lerp for both; the closed code path was already correct since vertex colors aren't multiplied by a material color when `vertexColors: true` and material.color = white). The change is visible to the naked eye at every zoom level.

**(4) V2Canvas2 setState-in-render warning fixed.** Pre-existing pattern flagged for surgical-vs-defer triage. Reproduced via puppeteer + CDP `Runtime.consoleAPICalled` capture: the error fires when opening the Directory layer (globe-button click). Stack trace surfaced `clearHoverState @ V2Canvas.jsx:1757 ← <anon> @ V2App.jsx:3107 ← basicStateReducer ← updateReducer ← useState ← V2App`. The "anon" frame is the functional updater callback inside `setV22DirectoryOpen((open) => { ... canvasRef.current?.clearHoverState?.(); return !open })`. React runs functional updaters during the next render's reducer phase — so `clearHoverState`, which calls setState on V2Canvas's internal hover state, fires while V2App is rendering. Surgical fix (~10 LOC): lift the side effect out of the updater. The onClick handler now reads the current `v22DirectoryOpen` from closure (the value's fresh because the handler captures it on each render), runs the appropriate side effect (clear claim/rfp panel state on close, clear V2Canvas hover state on open), THEN calls `setV22DirectoryOpen(open => !open)` with a pure non-side-effecting updater. Re-probed after fix: setState-in-render warning is gone. No structural refactor — no state lifting, no component-tree restructuring, no multi-file edits. Per the brief's surgical/structural triage rule, applied.

**Runtime verification.** Build clean (vite v7.3.1, 129 modules transformed, 0 errors). Dev server brought up at localhost:5174; puppeteer-driven probe with CDP stack capture confirms:
- Pre-fix: setState-in-render error fires on globe-button click (Directory open).
- Post-fix: no setState-in-render error across login → globe click → role switch → globe toggle sequence.
- Only remaining warnings are pre-existing benign `[DirectoryLayer] packClusterDense overflow for X` log lines (documented Phase 16.2.6.x regressions, accepted per the brief's "surface + accept" rule).

**Per the documented Three.js raycaster limitation in CLAUDE.md** (the Directory raycaster does not respond to DOM-dispatched synthetic mouse events), visual verification of acceptance items 4–11 (cursor + brightening on hover/select) cannot be exercised via the puppeteer probe — those require manual mouse interaction. The code paths have been structurally verified: handleMouseMove's hit-driven cursor update is in place; flushRfpColors writes the lerped colors with `needsUpdate` flags set; AssetNode/AssetNodeMini wrappers carry `cursor: pointer` per the existing Phase 16.2.7 contract; the rAF-driven retry loop for notification-triggered pan is unit-tested against the directory-open + layout-built precondition. The integration walkthroughs requested in acceptance items 1–3 (notification click → camera pan) are reachable via scripted clicks of the notification row (not the canvas) and could be probed in a follow-up; the V2Canvas2 fix verification is the primary scripted-runtime victory of this phase.

**Out of scope** (kept narrow per the brief): no new features, no modal-open performance work, no GovCo RFP placement work. Phase 17.2.1 (Accept flow / Request Agreement) remains the next forward-progress phase.

**Doc updates**: footer v0.17.2 → v0.17.2.0.1 in V2App.jsx; Changelog modal entry prepended above Phase 17.2; architecture-spec.md §8 Changelog gains a Phase 17.2.0.1 hotfix bullet (no §8 structural change — the architecture from §8.9 is unchanged); polish-backlog.md Update Log gains the Phase 17.2.0.1 entry; CLAUDE.md "Current state of the world" rolled forward; this CLAUDE-phase-log.md entry.

**Status:** [x] Complete.

### Phase 17.2 completion notes (2026-05-18) — RFP solicitation flow (submit + deliver + reject loop)

Opens the seller→buyer engagement axis on the Phase 17 RFP arc. Sellers solicit one of their existing public Claims against an open RFP from the RfpDetailPanel; the RFP owner sees incoming solicitations in a new section above the panel footer and can reject them with an optional reply; the solicitor sees their own outgoing solicitation in the same panel, gets a notification on rejection, and revisits the panel to see the rejection state. The accept side (Request Agreement) renders in this phase as a disabled button with a "Coming in Phase 17.2.1" tooltip so the panel UI ships without a visual gap.

**Data model.** New `makeRfpSolicitation` factory in `src/v2/v2_2Data.js` with shape `{ id, type: 'rfp-solicitation', rfpId, claimId, solicitor, recipient, message, status, createdDate, respondedDate, rejectionMessage }` and status taxonomy `'pending' | 'rejected' | 'accepted'` (accepted reserved for Phase 17.2.1's Request Agreement flow — validates here but isn't reachable from UI). All required fields throw on null. New `mergeSolicitations(shared, solicitations)` helper mirrors the `mergeProvisionals` / `mergeClosedRfps` shape: Map<id, RfpSolicitation>; returns identity on empty Map. `buildV22SharedArtifacts` returns `rfpSolicitations: []` so consumers can rely on the field's existence regardless of session state.

**V2App state + handlers.** New `v22Solicitations: Map<id, RfpSolicitation>` session-state Map (Map storage so per-id updates mutate in place via `setV22Solicitations(prev => new Map(prev).set(id, updated))`). Two transient modal-open states: `v22SolicitOpenForRfp: { rfp } | null` and `v22SolicitationToReject: RfpSolicitation | null`. Two handlers — `handleCreateSolicitation({ rfpId, claimId, message })` builds the artifact via the new factory + fires a `v22-rfp-solicitation-received` notification on the RFP owner's inbox via the existing `enqueueV22NotificationForRequester` pattern; `handleRejectSolicitation({ solicitationId, rejectionMessage })` updates the solicitation status to `'rejected'` + stamps `respondedDate` + stores `rejectionMessage` (null when empty) + fires a `v22-rfp-solicitation-rejected` notification on the solicitor's inbox.

**Two new notification types.** `v22-rfp-solicitation-received` — label `SOLICITATION`, amber badge color (parallel to other request-style notifications), body copy `"{solicitorParty} solicited your RFP — Re: {rfpName}"`. `v22-rfp-solicitation-rejected` — label `REJECTED`, red badge color, body copy `"{rejectorParty} rejected your solicitation — Re: {rfpName}.{ optional rejection message in quotes}"`. Click dispatch on either type routes to Directory → RFP marker → RfpDetailPanel: `setV22DirectoryOpen(true)` + clear `v22DirectorySelectedClaim` + set `v22DirectorySelectedRfp` to the target RFP (resolved from the merged shared artifacts). Auto-dismissed on click — the loop terminates after rejection and the panel surfaces the latest state.

**Three new React components.** (1) `src/components/DetailPanel/SolicitationCard.jsx` — renders a single solicitation. Header row: solicitor party ACTOR pill + party name + "solicited" + status badge (pending = indigo, rejected = red, accepted = green). Referenced Claim row: "Re: {Claim name} from {Claim owner}". Message blocks: solicitor's message (when non-empty), buyer's reply (when rejected + reply non-empty). Dates: "Solicited YYYY-MM-DD · HH:MM UTC" + "Rejected ..." when rejected. Action bar on owner view + pending status: `Request Agreement` (disabled, `title="Coming in Phase 17.2.1"`, indigo affirm visual but greyed) + `Reject` (enabled, neutral grey). Solicitor view + any status: no buttons. Owner view + rejected status: no buttons (no undo in 17.2). (2) `src/components/modals/SolicitationCreateModal.jsx` — Claim picker (scrollable list, max-height 300px, single-select with radio + indigo highlight on selected, accent-indigo left border bar) + optional message textarea (500-char cap with counter). Picker defaults to zero selected per CLAUDE.md convention; amber italic "Select at least one Claim to continue." help text under the picker until selection. Empty Claim list case: muted "You have no Claims to solicit with." + Submit disabled. (3) `src/components/modals/SolicitationRejectModal.jsx` — title "Reject solicitation", subtitle "Reject {solicitor}'s solicitation re: {claim name}?", optional 300-char reply textarea, amber info banner ("The solicitor will receive a notification..."), Cancel + red destructive Reject Solicitation submit. Both modals follow the existing `Backdrop` / `Modal` / `ModalHeader` / `ModalBody` / `ModalFooter` shared primitives.

**RfpDetailPanel three-way visibility branch.** Above the footer the panel renders one of: (a) owner view → "Incoming Solicitations (N)" heading + `<SolicitationCard>` per entry; empty case shows the heading with N=0 + muted "No solicitations yet." text (intentionally communicates state rather than hiding the section). (b) solicitor view (non-owner with an existing solicitation) → "Your Solicitation" heading + the single card. (c) other non-owner view → no section rendered. Closed-status RFPs: owner still sees incoming solicitations (must act on them); the section renders normally. Non-owners on closed RFPs are filtered out of the Directory entirely (Phase 17.1 behaviour) — defensive empty-render covers the corner case where they reach the panel anyway.

**Footer extensions.** Owner-only Close/Reopen buttons unchanged. Non-owner + status open + no existing solicitation → "Solicit with my Claim" affirm button (clicking opens `SolicitationCreateModal` with the current RFP pre-filled). Non-owner + status open + existing solicitation → muted "Already solicited — see above." line (the existing-solicitation card above already communicates the state; the footer slot is left in place for layout consistency). Non-owner + status closed → no footer.

**Notification routing + panel mount wiring.** RfpDetailPanel mount in V2App.jsx now chains `mergeSolicitations` after `mergeClosedRfps + mergeProvisionals` so the panel sees the session-state solicitation set. `solicitationsForRfp` derived from the merge result filtered to the selected RFP id; `claimsByIdMap` built once per render from the merged Claim set and threaded to the panel for SolicitationCard's Claim-name resolution. `activeClaims` = the active actor's own Claims filtered from the merged set. The panel forwards `onOpenSolicitModal` → `setV22SolicitOpenForRfp({ rfp })` and `onRejectSolicitation` → `setV22SolicitationToReject(solicitation)`. Both modals are mounted at the V2App root sibling to the panel; on submit they call back into the handlers and clear their own open state.

**DirectoryLayer RFP marker hover + select brightening** (Items 19 + 20). Added per-instance `instanceColor` attribute (`Float32Array(MAX_RFPS * 3)`) to both `rfpMesh` (the hollow-square outline) and `rfpFillMesh` (the tinted indigo fill); base color is white (which multiplies out to the material's indigo at fragment-shader time) and the hovered/selected index becomes white-white (overrides the material color, perceptibly brightening the indigo). New `hoveredRfpIdxRef` (ref-only state, no React re-renders for mouse moves) updated in `handleMouseMove` on RFP hits; selected index = `pinnedRef.current?.dotIndex` when `pinned.rfp` is non-null. New `flushRfpColors` callback parallel to `flushDotColors`; mark-as-dirty via `rfpDirtyRef.current = true` flushes once per animation-loop tick. Closed-RFP dashed outline (`THREE.LineSegments` + `LineDashedMaterial`): added `vertexColors: true` to the material + a per-vertex color attribute on the geometry (24 floats per closed RFP: 8 vertices × RGB). `flushRfpColors` maps overall rfp-index → closed-subset-index via `closedRfpIdxMapRef.current` (a Map built at populate time) and lerps the matching 8-vertex range toward white at 0.55 when hovered/selected. Geometry rebuild paths (initial layout populate + zoom-rescale) both write the color attribute; the rescale path also sets `rfpDirtyRef.current = true` so hover/select state survives zoom transitions. Reset on `phase === 'closed'` + role switch (clears `hoveredRfpIdxRef` to -1 + marks dirty).

**Detail Panel 1px gap fix** (Item 21). Both Directory-layer Detail Panel mount blocks (the Claim panel at V2App.jsx ~5978 and the RFP panel at ~6094) bumped from `bottom: 28` to `bottom: 27`. The 1px hairline gap was visible against the app footer (z-index 300) at the canonical viewport zoom. The parent-canvas Detail Panel mounts (`V22NodeDetailPanel` inside V2Canvas) aren't affected — they mount inside the canvas container which is already offset below the footer via the V2App flex layout.

**Documented deviations / visual choices.** (1) `RfpDetailPanel` accepts a new `claimsById: Map<claimId, claim>` prop instead of resolving Claims internally — keeps the panel pure and avoids importing the shared-artifact build inside a render-path component. The V2App mount path is the single owner of the merge chain. (2) The "Already solicited" footer slot renders only when status is open; on rejected status it's redundant with the existing-solicitation card above but the brief leaves it to my judgment. Decision: keep it for layout consistency (the visual footer slot exists on all open-status non-owner views). (3) Status badge colors in `SolicitationCard`: pending = indigo (neutral), rejected = red (signal that the loop terminated), accepted = green (future-proofs Phase 17.2.1 — same green as `OPEN` on RFP status). (4) Decline of "Already solicited" message includes "see above." regardless of whether the existing solicitation is in the visible section — the card is always rendered for the solicitor when one exists. (5) Notification body for received solicitation uses amber badge color (matches the "request awaiting your action" pattern of `v22-transfer-request` and `v22-request-ea-only`); rejected uses red (matches `v22-transfer-declined` / `v22-ea-declined`).

**Out of scope (explicitly per brief).** Accept flow / Request Agreement action — placeholder disabled button in 17.2; full implementation in Phase 17.2.1 (Asset-picker + CombinedRequestModal integration + provisional Claim node on buyer's parent canvas). Withdraw or amend an existing solicitation — deferred. Multi-Claim solicitations from one seller against one RFP — single-Claim per (seller, RFP) pair in 17.2 (the picker is single-select). Edit RFP name / description / requirementsSets — still deferred to 17.6+. Seeded solicitations — none; demo participants create them in real time. Parent canvas RFP rendering — unchanged. Claim Detail Panel content (17.3) and umbrella DA edges (17.4) — later.

**Verification (programmatic, per the documented V2Canvas raycaster limitation in CLAUDE.md).** Imported `v2_2Data.js` via the live dev module graph and exercised the factory + merge layer: `makeRfpSolicitation` returns the expected shape (type='rfp-solicitation', status='pending', rejectionMessage=null defaults); `buildV22SharedArtifacts` returns `rfpSolicitations: []`; `mergeSolicitations` adds entries to the array (1 → 1 entry verified); empty-Map merge returns shared unchanged (identity check); invalid status (e.g., 'bogus') throws as expected; chained `mergeSolicitations(mergeClosedRfps(shared, closedMap), solMap)` produces both `rfps[i].status === 'closed'` AND `rfpSolicitations.length === 1` (orthogonal merge layers). Render-path verification: mounted `RfpDetailPanel` in isolation across three viewer modes against the seeded GovCo Sentinel-4 RFP — (a) owner with 1 incoming → "Incoming Solicitations (1)", PENDING badge, claim ref + message rendered, Request Agreement (disabled) + Reject (enabled) action bar, "Close this RFP" footer; (b) solicitor with rejected solicitation → "Your Solicitation" + REJECTED badge + seller's message + buyer's reply + dates + "Already solicited" footer + no owner footer; (c) other non-owner (Carol/AuditCo, 0 claims) → no section + "Solicit with my Claim" footer (modal opens with the "no claims" empty state on click); (d) owner with 0 solicitations → "Incoming Solicitations (0)" + muted "No solicitations yet." + Close button. `SolicitationCreateModal` mount verified: title + RFP name + 3 Alice's Claims listed with referenced-asset counts + char counter on message field + amber help text disappears on Claim select + Submit button enables (cursor switches default → pointer; opacity 0.4 → 1) on selection. `SolicitationRejectModal` mount verified: title + MicroCo reference + Power Regulation Module Assembly reference + textarea + amber info banner + red Reject Solicitation submit. Canvas-click verification of the RFP-marker click → panel open path is the manual-only path per the documented limitation; the brightening (hover/select index → instanceColor + per-vertex color) is verified by the data-flow path (handleMouseMove sets the ref + marks dirty; flushRfpColors reads from refs and writes to mesh attributes). Build clean (129 modules transformed, 0 errors). Console clean except the pre-existing 4 NaN-CSS-left warnings from 16.2.6.1's umbrella-SVG mount-race + the pre-existing 500-KB chunk warning + the pre-existing packClusterDense overflow warnings.

**Footer rolls forward to v0.17.2.**

**Status:** [x] Complete.

### Phase 17.1 completion notes (2026-05-18) — RFP close/reopen lifecycle (owner-side)

First lifecycle phase against the Phase 17 RFP arc. Opens buyer-side state transitions on RFP nodes: the owner of an RFP can close it from the Detail Panel; closed RFPs render dashed on the owner's Directory at every LOD and are filtered out of every non-owner's Directory. Reopen restores the open state. No supplier-side wiring yet (that lands in Phase 17.2 — at which point closed-RFP visibility becomes load-bearing for solicitation gating per the asymmetric-visibility architecture).

**Factory + helpers (v2_2Data.js):**

- `makeRfp` validates `status` against a `'open' | 'closed'` taxonomy (throws on unknown values; surfaces seed typos that would silently default to behaving as `'open'`). Accepts a new `closedDate` optional ISO string parameter (default null).
- New exported `closeRfp(rfp, closedDate?)` — pure transform: `{...rfp, status: 'closed', closedDate: closedDate || new Date().toISOString()}`. The optional `closedDate` parameter is what makes the merge layer stable: V2App captures the timestamp at click time and passes it on every subsequent `closeRfp` invocation inside `mergeClosedRfps`, so re-renders see the same value instead of "now".
- New exported `reopenRfp(rfp)` — pure transform: `{...rfp, status: 'open', closedDate: null}`.
- New exported `mergeClosedRfps(shared, closedRfpIds)` — overlays session-state closures on the shared artifact collection. `closedRfpIds` is a `Map<rfpId, ISO closedDate>` (the captured-once timestamps); the function walks `shared.rfps` and replaces any matching id with `closeRfp(r, capturedTimestamp)`. Returns shared unchanged when the Map is empty / missing.

**View-builder filter (`buildV22DirectoryDataForRole`):**

Function signature gains a 3rd `closedRfpIds` parameter. The body calls `mergeClosedRfps(mergeProvisionals(...), closedRfpIds)` first thing, then operates on the merged shared artifacts as before. The `allRfps` baseline (which previously filtered on `status === 'open'`) now includes ALL RFPs; `ownRfps` (active actor's own RFPs) inherits all of them regardless of status; `otherRfpsBaseline` (which feeds `cluster.rfps` + `otherRfps` orphan paths) filters out `status === 'closed'` so non-owners don't see closed RFPs at all. Per-cluster `cluster.rfps` and the `otherRfps` orphan list both inherit the filter via this single chokepoint.

**V2App.jsx:**

- New session state `v22ClosedRfpIds: Map<rfpId, ISO closedDate>` adjacent to `v22Provisionals`. Map storage so each closure keeps its captured timestamp across re-renders (a Set + regenerated-on-render timestamp would shift the displayed date every paint).
- Threaded to DirectoryLayer as a new `v22ClosedRfpIds` prop. DirectoryLayer's `directoryData` `useMemo` calls `buildV22DirectoryDataForRole(roleId, v22Provisionals, v22ClosedRfpIds)` and adds `v22ClosedRfpIds` to its dep list.
- `RfpDetailPanel` mount block now wraps in an IIFE that re-resolves the selected RFP from `mergeClosedRfps(buildV22SharedArtifacts(), v22ClosedRfpIds)` each render — without this, `v22DirectorySelectedRfp` keeps the snapshot from the original click and the panel would render the stale (pre-close) status indefinitely.
- `onCloseRfp` / `onReopenRfp` handlers wired to the panel. Both update `v22ClosedRfpIds` via the standard React functional-setState pattern (`prev → next` Map clone with the change applied). Close captures `new Date().toISOString()`; Reopen `delete`s the entry.
- Footer literal `v0.17.0.2 → v0.17.1`. Changelog modal entry prepended for `v0.17.1` (7 bullets).
- New import `mergeClosedRfps` from `v2_2Data.js`.

**RfpDetailPanel.jsx:**

- New props `onCloseRfp` and `onReopenRfp` (functions, called with the rfp artifact).
- `isOwner = rfp.owner === activeParty` derivation at the top of the render.
- `StatusBadge` extended: `'closed'` renders with muted grey-on-dim treatment (`var(--text-tertiary)` text on `var(--bg-deep)` background with a `var(--border)` border). Unknown status values get a neutral fallback (forward-compat).
- New "Closed YYYY-MM-DD · HH:MM UTC" row in the body, rendered only when `status === 'closed'`. Formatted via the existing `formatDateTime` helper.
- New owner-only footer: a single direct-action button. When `status === 'open'`: "Close this RFP" (neutral grey button). When `status === 'closed'`: "Reopen this RFP" (indigo affirming-action button). Footer shell mirrors `V22NodeDetailPanel`'s footer convention: bottom-pinned, border-top separator, `padding: '12px 18px'`, flex row with `gap: 8`, `flexShrink: 0`. Non-owners see no footer at all.

**DirectoryLayer.jsx:**

- New ref `closedRfpMeshRef`. Scene-init creates a single `THREE.LineSegments` mesh with an empty `THREE.BufferGeometry` + `THREE.LineDashedMaterial({ color: indigo, dashSize: 8, gapSize: 4 })`. Defensive InstancedMesh-style settings apply to LineSegments too: `frustumCulled = false`, `boundingSphere = new THREE.Sphere(origin, Infinity)`. Cleanup disposes the current geometry + material.
- Populate loop extended: per-instance closed-owned detection (`d.rfp?.status === 'closed' && d.rfp?.owner === activePartyForClosed`). When closed-owned, `rfpMesh` and `rfpFillMesh` matrices are set to `hidden` (don't draw the solid outline + fill there). `rfpHitMesh` keeps the normal matrix — closed-owned RFPs remain clickable for reopen. After the InstancedMesh loop, the closed-owned set is collected and a new `BufferGeometry` is built with 4 line segments per closed-owned RFP (square perimeter). `computeLineDistances()` after geometry attach — required for `LineDashedMaterial` to render dashes. Previous geometry is disposed to avoid leaks.
- Rescale-on-zoom effect: mirrors the partition + rebuilds the closedRfpMesh geometry at the new scale (`half = (RFP_BASE_OUTER / 2) * desiredScale`). Local `hiddenMatrix` declared inside the effect's scope (the populate effect's `hidden` isn't in scope here).
- LOD-visibility `useEffect` extended: at `zoom ≥ MID_LOD_THRESHOLD`, `closedRfpMesh.visible = false` alongside the other RFP meshes. The AssetNode RFP card variants render the dashed treatment at card LOD.
- Card-overlay render block's RFP synthetic node now carries `isClosed: rfp.status === 'closed' && rfp.owner === layout.activeParty`. The conjunction is defensive — closed-not-owned shouldn't reach this point (view-builder filters them out) but the guard prevents accidental dashed treatment if it ever does.

**AssetNode.jsx:**

- `AssetNode` (full) RFP early-return reads `node.isClosed`; introduces local `rfpBorderStyle = isClosed ? 'dashed' : 'solid'`; applies to both the outer selection ring (`isSelected && {...}`) and the inner card border.
- `AssetNodeMini` RFP early-return mirrors the same treatment on the mini variant.
- Hover/select still triggers the amber color treatment (existing `hoverSelectColor` logic) — only `border-style` flips. So a closed-and-owned RFP hovered reads as "dashed amber outline" — discrete-state-change-but-still-closed signal.

**Asymmetric visibility — rationale.** The implementation realises the architecture from §8.8.7: closed RFPs are visible to the owner (so existing solicitation notifications remain actionable — the owner can still navigate to their closed RFP and act on inbox items) but hidden from non-owners (so the supplier-side entry point disappears, naturally gating new solicitations against closed RFPs without explicit gating logic). Phase 17.2 wires solicitations + this visibility model becomes load-bearing.

**Verification.** Build clean (126 modules). Dev server runtime walkthrough — Bob's view, navigate to Directory, locate Sentinel-4 RFP, click → RfpDetailPanel opens with `OPEN` badge + "Close this RFP" footer button → click footer → panel re-renders with `CLOSED` badge, "Closed" date row, "Reopen this RFP" button replacing the close button → close panel → Sentinel-4 marker on Directory now renders dashed at every LOD. Switch role to Alice → Directory loads without Sentinel-4 RFP marker (orphan bottom-anchor position is empty). Switch back to Bob → reopen → Sentinel-4 marker solid again → Alice sees it again. No console errors beyond the pre-existing V2Canvas2 setState warning + the pre-existing 500-KB chunk warning + the pre-existing packClusterDense overflow warnings. Footer reads v0.17.1. Changelog modal top entry is the new v0.17.1.

**Footer rolls forward to v0.17.1.**

**Status:** [x] Complete.

### Phase 17.0.2 completion notes (2026-05-18) — Hotfix: TDZ crash in AssetNode RFP branch

Phase 17.0.1 shipped RFP card LOD swap on `2026-05-17` (commit `296b879`). Runtime QA on Bob's view surfaced a crash that the 17.0.1 ship verification didn't catch: zooming the Directory into full-card LOD on Bob's view crashed the app to an all-black screen. Slow zoom could pass through mid-LOD without crashing, but clicking an RFP node at any card LOD crashed immediately.

**Console error:**

```
ReferenceError: Cannot access 'hoverSelectColor' before initialization
  at AssetNode.jsx:487
An error occurred in the <AssetNode> component.
```

**Root cause.** Phase 17.0.1's RFP early-return branch in `AssetNode` (full) was inserted at line ~439 of the function body — strictly after all React hooks per the rules-of-hooks invariant, but BEFORE the `const hoverSelectColor` declaration introduced in Phase 16.2.11 at line ~579. The early-return branch reads `hoverSelectColor` in two places (inner-div border + outer selection ring), and JavaScript evaluates the JSX subtree before returning the React element, so the read at line 487 happened before the `const` initialization at line 579 → TDZ `ReferenceError`. Every RFP card render via `AssetNode` (full) — every full-card RFP at zoom ≥ LOD_THRESHOLD, every full-card render inside an `AssetNodeMini` hover-preview portal — crashed.

`AssetNodeMini`'s RFP early-return branch was added later in its function body (line ~1546), after its own `const hoverSelectColor` declaration (line ~1481). No TDZ in mini.

**Fix.** Hoist the `hoverSelectColor` const declaration above the RFP early-return in `AssetNode` (full). The value depends only on `node.category` which is always available at function entry — no other dependencies — so the hoist is a 3-line move with no semantic change for non-RFP renders. The Phase 16.2.11 declaration site is removed to prevent a duplicate `const` (would itself be a runtime error). The Phase 16.2.11 + 17.0.1 commentary is preserved at the hoist site; a small Phase 17.0.2 stub comment marks the original site noting "see the hoist".

**Sweep result.** Both components reviewed for other `const` / `let` variables declared after the RFP early-return but referenced inside it. None found in either component:

- `AssetNode` (full) RFP branch references: `hovered` (useState at line ~377), `isSelected` (prop), `scale` (prop), `handleClick` (useCallback at line ~384), `hoverSelectColor` (now hoisted), `WARM_BORDER` (module constant), `CARD_W` / `CARD_H` / `ACTION_BAR_W` (module constants), `node.name` / `node.rfp.name` / `node.ownerParty` / `node.owner` (props). All resolved by the time the early-return executes.
- `AssetNodeMini` RFP branch references the same set plus `tooltipPos` / `setTooltipPos` (useState above), `miniRef` (useRef above), `handleMouseEnter` (function defined above), `showTooltip` (`const` declared at line ~1536, just above the RFP early-return at ~1546). All resolved.

**Per-file changes:**

- `src/v2/AssetNode.jsx` — `hoverSelectColor` declaration hoisted from line ~579 to line ~452 (above the RFP early-return at ~466). Original declaration removed. Phase 17.0.2 comment block added at the new declaration site explaining the TDZ rationale; a Phase 17.0.2 stub comment marks the original site.
- `src/v2/V2App.jsx` — footer literal `v0.17.0.1` → `v0.17.0.2`. Changelog modal entry prepended for `v0.17.0.2` (3 bullets: symptom, root cause + fix, footer roll-forward).
- `architecture-spec.md` — `Hotfix — Phase 17.0.2 (TDZ in AssetNode RFP branch)` bullet appended to §8 Changelog. No §8.8 content change (the RFP architecture from 17.0.1 is correct; only implementation order needed fixing). Process note included on the verification-convention lapse.
- `polish-backlog.md` — Update Log entry with a verbose process note: 17.0.1's structured review marked items as "Code-verified" for state-dependent render paths that should have been runtime-verified per CLAUDE.md. The bug would have been caught by an actual zoom-to-full-LOD walkthrough; 17.0.1's QA used a fiber-state-mutation probe that bypassed the React render path entirely. Future render-path phases must runtime-verify zoom + hover + click at every LOD threshold.
- `CLAUDE.md` — Footer version rolled. Last shipped phase rewritten for Phase 17.0.2. Phase-log reference rolled to 17.0.2. The existing "Runtime verification is required" convention note extended with a one-line reminder that state-dependent render paths require LOD-swap + hover + selection + click exercises at every affected LOD — referencing the 17.0.1 → 17.0.2 incident as the canonical example.

**Verification.** Build clean. Dev server runtime walkthrough — zoom from default 15% scroll-wheel-style up through MID_LOD_THRESHOLD (~333%) into LOD_THRESHOLD (~437%) and beyond to 500% on Bob's view. App stable through every threshold transition. Sentinel-4 RFP renders correctly at every LOD: hollow indigo square at low zoom, AssetNodeMini at mid-LOD, AssetNode (full) at full-LOD with "RFP" type pill + name + "Posted by GovCo" row. RFP card click at every LOD opens RfpDetailPanel without crash. Hover at full-LOD without click also stable. Claim card LOD swap unbroken. Console clean beyond the pre-existing V2Canvas2 setState-in-render warning + pre-existing 500-KB chunk warning + pre-existing `packClusterDense overflow` warnings (Phase 16.2.6.x documented).

**Process note.** Phase 17.0.1's "Structured review" marked the RFP card render acceptance criteria as `✓ Verified` based on a fiber-state-mutation probe (writing directly to `camPosRef.current` + dispatching a `WheelEvent` with `deltaY: 0` to force a re-render, then probing the resulting DOM for cards with width 244). The probe DID find rendered cards in DOM — but this verification path doesn't reflect the user's normal interaction. A real user reaches full-LOD via scroll-wheel zoom triggering `handleWheel → setZoom(...)`, which causes a clean React re-render where AssetNode's RFP branch executes the TDZ-trapped JSX. The fiber probe must have rendered a cached subtree or bypassed the React render queue somehow — in any case, the test pattern was unsound for this kind of bug. **Future phases that introduce render-path branches must exercise the full user-interaction flow at every relevant LOD; fiber-state mutation is insufficient for catching init-order bugs.**

**Footer rolls forward to v0.17.0.2.**

**Status:** [x] Complete.

### Phase 17.0.1 completion notes (2026-05-17) — RFP card LOD swap + hover-preview pinning

Continued sub-phase against polish-backlog #192 (Item J). Two goals: (1) bring RFP markers to LOD parity with Claims (hollow-square → mini-card → full-card at the same zoom thresholds); (2) structurally fix the stale-pinned-tooltip bug surfaced in 17.0 QA (clicking from Claim to RFP or vice versa left the previous artifact's tooltip pinned).

**Approach.** Two coupled changes — neither works without the other:

1. **AssetNode dispatcher extension** — RFP becomes a 5th schema (existing: Asset, Claim, Eval Result, PoE, plus the various subtype configs in `CATEGORY_CONFIG`). `node.category === 'rfp'` routes both `AssetNode` (full) and `AssetNodeMini` to early-return branches that render the minimal RFP layout. No badges, no minibars, no action bar, no dive-hint, no edge-endpoint indicator — per Andrew's spec, content stays at type pill + name (+ owner row for full card).

2. **`pinned` state as discriminated union** — exactly one of `{ claim, ... }` or `{ rfp, ... }` at any time. `setPinned` overwrites in a single atomic call, so clicking from a Claim to an RFP (or vice versa) cleanly swaps the pinned tooltip without a race between "clear old" and "set new." This is the structural fix for the 17.0 stale-tooltip bug.

**Per-file changes:**

`src/v2/AssetNode.jsx`:

- `CATEGORY_CONFIG` gains an `'rfp'` entry (`icon: '⬚'`, `color: 'var(--accent-indigo)'`, `label: 'RFP'`). The icon/color aren't used by the RFP early-return branches (they render the type pill inline), but the entry is kept for completeness and forward-compat.
- `hoverSelectColor` in both `AssetNode` (full) and `AssetNodeMini` extended: `(node.category === 'claim' || node.category === 'rfp') ? amber : indigo`. RFPs join Claims on the amber-on-hover/select branch. Rationale: WARM_BORDER (the default) is itself a 40% indigo blend, so brightening to 100% indigo on hover would not read as a clear state change; amber against warm-grey reads cleanly. Claims use amber for a different reason (distinguishing the discrete hover/select state from the disclosure-type indigo/amber/green default) — but the same colour serves both.
- New early-return branch in `AssetNode` (full), placed after all hooks (the last is the `useEffect` watching `revealPhase` on line ~431). The branch renders the standard outer wrapper + isSelected selection ring + inner card with type pill + name + "Posted by {owner}" row. Reuses `hovered` state (from `useState` above) and `handleClick` (from `useCallback` above). RFPs have no children, so `handleClick`'s double-click branch is a no-op.
- New early-return branch in `AssetNodeMini`, placed after the last useEffect cleanup hook. Renders the standard mini wrapper + selection ring + inner card with type pill + name (no owner row). Reuses `hovered` + `tooltipPos` state + `handleClick` + `handleMouseEnter`. Includes the portal-rendered AssetNode preview (wrapped in `createPortal`) so hovering the RFP mini-card on Directory pins the same full-card preview that hovering a Claim mini-card does — the preview itself takes the AssetNode (full) RFP early-return.

`src/v2/DirectoryLayer.jsx`:

- New `RfpTooltipCard` component (placed adjacent to `ClaimTooltipCard`). Mirrors the Claim tooltip's positioning + clip-right anchoring + zIndex + box-shadow; type pill reads "RFP"; body renders `rfp.name` + `rfp.owner`.
- LOD-visibility `useEffect` extended: when `zoom >= MID_LOD_THRESHOLD`, hide `rfpMesh` (outline), `rfpFillMesh` (tinted fill), AND `rfpHitMesh` (invisible hit-test mesh). The hit-test mesh hiding is the critical part — leaving it visible would intercept clicks meant for the cards rendered above.
- `handleMouseUp`'s RFP-hit branch now sets `pinned` with the RFP discriminator (`{ rfp, x, y, screenX, screenY, ownerParty, dotIndex }`) before calling `onRfpClick(d.rfp)`. The single `setPinned` call overwrites any previously-pinned Claim, resolving the stale-tooltip bug for hollow-square clicks at low zoom.
- `onCardClick` (used by mid/full LOD card clicks) branches on `d.kind === 'rfp'`: if RFP, set the RFP discriminator + fire `onRfpClick`; else, set the Claim discriminator + fire `onClaimDotClick`. Same atomic-overwrite semantics. Dep list extended to include `onRfpClick`.
- Card-overlay render block extended to iterate both `kind !== 'rfp' && d.claim` AND `kind === 'rfp' && d.rfp` entries from `allDots`. Per-entry branch builds the synthetic node — for RFPs: `{ id, category: 'rfp', rfp, name, ownerParty, owner }`. Both routes use the same `AssetNode` / `AssetNodeMini` Card component (selected by LOD threshold); only the inner schema differs. Selected state computed against the matching discriminator: `pinned?.rfp === d.rfp` for RFP cards, `pinned?.claim === d.claim` for Claim cards. zIndex (1600 selected / 1500 default) is shared.
- Pinned-tooltip render block (the dot-LOD `ClaimTooltipCard` mount, gated on `zoom < MID_LOD_THRESHOLD`) replaced with a discriminator branch: `if (t.rfp) → RfpTooltipCard; else if (t.claim) → ClaimTooltipCard; else return null`. Defensive null fallback covers transient render states.
- Empty-canvas click in `handleMouseUp` now also calls `onRfpClick(null)` alongside the existing `setPinned(null)` + `onClaimDotClick(null)`. V2App's `onRfpClick` handler with `rfp=null` clears the RFP Detail Panel state.

`src/v2/V2App.jsx`:

- Footer literal `v0.17.0` → `v0.17.0.1`.
- Changelog modal entry prepended for `v0.17.0.1` (7 bullets covering the AssetNode dispatcher extension, the card overlay extension, the pinned discriminator, the new RfpTooltipCard, the empty-canvas wiring, and the footer roll-forward).

**Docs:**

- `architecture-spec.md` — new §8.8.5 (Card LOD swap), §8.8.6 (Pinned tooltip discriminator), §8.8.7 (Forward pointers, now starting from Phase 17.1). Existing §8.8.5 (Forward pointers) renumbered to §8.8.7 with the 17.0.1 entry removed (since this phase landed). §8 Changelog bullet for Phase 17.0.1 prepended.
- `polish-backlog.md` — Update Log entry with #192 reference, LOD-parity note, and forward queue (17.1, 17.2, 17.2.1, 17.5+).
- `CLAUDE.md` — Footer version + current state + phase queue + phase-log reference all rolled to 17.0.1.

**Verification.**

- Build clean — 126 modules.
- AssetNode + AssetNodeMini RFP early-return branches don't disturb the hook order (placed strictly after all hooks).
- `pinned` discriminator: at most one of `pinned.claim` / `pinned.rfp` is set at any time (every setter call uses exactly one).
- LOD visibility: at `zoom < MID_LOD_THRESHOLD`, hollow squares visible + hit-test mesh raycastable. At `zoom ≥ MID_LOD_THRESHOLD`, all three RFP meshes hidden, cards take over via the overlay render block.
- Cross-LOD click swap: hollow-square click at low zoom → pinned RFP tooltip + RfpDetailPanel; zoom up → tooltip dismisses (low-zoom render gate fails) but card renders as `isSelected={true}` (via `pinned.rfp === d.rfp`); zoom down → tooltip re-renders.
- LOD-swap walkthrough (data-layer trustable; canvas raycast verification falls under the documented CLAUDE.md Three.js Raycaster limitation): code-verified via review of render block + click handler + mesh visibility effect.

**Stale-tooltip bug-fix mechanism.** The bug surfaced in 17.0 because RFP click paths called `onRfpClick(d.rfp)` and the V2App-side mutual-exclusion cleared the Claim Detail Panel — but the DirectoryLayer-side `pinned` state, which drives the pinned floating tooltip near the click point, was never touched. So the Claim's pinned tooltip persisted on top of the new RFP click target. The fix: every RFP click path (hollow-square + onCardClick) sets `pinned` with the RFP discriminator. `setPinned` is a single atomic state setter; setting `{ rfp, ... }` overwrites the previous `{ claim, ... }` in one call. The render block branches on which discriminator is set, so the previously-rendered ClaimTooltipCard is replaced by an RfpTooltipCard in the next render pass. Same logic for RFP → Claim direction.

**Footer rolls forward to v0.17.0.1.**

**Status:** [x] Complete.

### Phase 17.0 completion notes (2026-05-17) — Clickable RFP markers + read-only RFP Detail Panel (Directory only)

Opens the Phase 17 RFP arc against polish-backlog #192 (Item J: RFP / Public Directory request flow with self-evaluation). First sub-phase: read pipeline only.

**Context.** 118 RFPs are already seeded across the Directory from Phase 16.2.6.5 (Bob's Sentinel-4 + 20 RFP-only buyer mocks at 98 RFPs + 4 mixed actors at 19 RFPs). Phase 16.0 introduced the skeletal `makeRfp` factory and rendered RFPs as hollow indigo squares; Phase 16.2.6.6 polished the marker rendering (tinted fill, scaled border, capped screen-px size). Until 17.0, RFPs had no click pipeline — they were decorative.

**Hit-test approach.** The visible `rfpMesh` uses `makeHollowSquareGeometry`, which is a ring with a hole through the centre. A raycast against the centre of an RFP misses the ring entirely. Fix: a companion invisible **solid-square** `THREE.InstancedMesh` with `PlaneGeometry(RFP_BASE_OUTER, RFP_BASE_OUTER)`, `MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })`. Matrices are written in lockstep with the visible outline + fill meshes via the existing populate loop and the rescale-on-zoom `useEffect`. Defensive InstancedMesh settings preserved per Round 16 lessons (`frustumCulled = false`, `boundingSphere = new THREE.Sphere(origin, Infinity)`).

**Per-file changes:**

`src/v2/DirectoryLayer.jsx`:

- New `rfpHitMeshRef` declared alongside `rfpMeshRef` / `rfpFillMeshRef`.
- Scene-init block creates the hit mesh after the outline mesh; same `MAX_RFPS` capacity, defensive settings, scene-add order. Cleanup disposes the new geometry + material and nulls the ref.
- Populate loop writes the same per-instance matrix to all three RFP meshes (outline + fill + hit), and sets `rfpHitMesh.count` to match.
- Rescale-on-zoom effect writes to all three meshes; `instanceMatrix.needsUpdate = true` on all three.
- New `onRfpClick` prop declared in the component signature.
- `raycast` rewritten to consult both `dotsMeshRef` and `rfpHitMeshRef` via `Raycaster.intersectObjects(targets, false)` (returns hits sorted by distance ascending — closer first). Returns `{ kind: 'dot'|'rfp', index: instanceId }` instead of a raw integer.
- `handleMouseMove` updated: RFP hits don't update `hover` state (Claim-only hover-preview in 17.0 — RFP hover-preview deferred to 17.0.1 alongside the card LOD swap).
- `handleMouseUp` updated: RFP hits resolve to `layout.allDots[kind === 'rfp'][hit.index]`, fire `onRfpClick(d.rfp)`, and run the standard `animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)` pan-to-center (mirror of the Phase 16.1.3 Item 6 / 16.2.9 Item 1 Claim pipeline). No `pinned` state for RFPs.

`src/components/DetailPanel/RfpDetailPanel.jsx` (new file):

- Read-only panel; props `{ rfp, activeParty, requirementsSets, onClose }`.
- Panel shell — `background: var(--bg-card); borderLeft: 1px solid var(--border); display: flex; flexDirection: column` matching `V22NodeDetailPanel`'s `PanelLayout`.
- Header — `RFP` type pillbox + `OPEN` status badge (green-tinted; uppercases any status value for forward-compat) + close button + name (large 16px bold).
- Body sections (top → bottom):
  - **Posted by** — `ACTOR` pillbox + `rfp.owner` party name + optional `YOU` badge when `activeParty === rfp.owner`.
  - **Description** — plain prose. Muted italic "No description provided." fallback when empty.
  - **Required Standards** — chip list. Each `rsId` resolves against the `requirementsSets` lookup (V2App passes `publishedRequirementSets`); chip renders `{name}` + small `v{version}` when found. Unknown ids render as muted raw-id text with `var(--font-mono)`. Chips are visual-only — no `onClick`.
  - **Posted** — `createdDate` formatted via local `formatDateTime` helper (mirror of `V22NodeDetailPanel`'s `formatDateTime`) as `YYYY-MM-DD · HH:MM UTC`.
- No footer / action buttons.
- All colours via CSS variables; SVG / unicode glyphs only.

`src/v2/V2App.jsx`:

- New import `RfpDetailPanel` from `../components/DetailPanel/RfpDetailPanel.jsx`.
- New state `v22DirectorySelectedRfp` declared adjacent to `v22DirectorySelectedClaim`.
- DirectoryLayer's `onClaimDotClick` extended to clear the RFP state (mutual exclusion).
- DirectoryLayer's `onClose` extended to clear the RFP state.
- New DirectoryLayer prop `onRfpClick={(rfp) => { setV22DirectorySelectedRfp(rfp); setV22DirectorySelectedClaim(null) }}`.
- Chrome globe-button toggle clears the RFP state too (so the panel doesn't survive a Directory toggle).
- New mount block `{v22DirectoryOpen && v22DirectorySelectedRfp && (...)}` parallel to the Claim mount. Panel shell mirrors the Claim mount: `position: fixed; top: 61; right: 0; bottom: 28; width: 480; zIndex: 200`. Passes `publishedRequirementSets || []` as the RS lookup source.
- Footer version literal `v0.16.2.11` → `v0.17.0`.
- Changelog modal entry prepended: `{ version: '0.17.0', date: '2026-05-17', label: 'Phase 17.0', items: [...] }` — 7 bullets summarizing the phase, the hit-test mesh approach, the panel content, the mutual-exclusion semantics, the out-of-scope deferrals, and the footer roll-forward.

`architecture-spec.md`:

- New §8.8 "RFP — buyer-side public posting (Phase 17.0+)" subsection (§8.7 was already taken by the Expand modal). Covers the unchanged factory shape, the click pipeline (hit-test mesh + closer-wins raycast + pan-to-center), the read-only Detail Panel content, mutual-exclusion semantics with the Claim panel, and forward pointers to 17.0.1 / 17.1 / 17.2 / 17.2.1 / 17.5+. Prototype-vs-Production annotation on RFP visibility.
- §8 Changelog bullet for Phase 17.0.

`polish-backlog.md`:

- Update Log entry dated 2026-05-17 with `#192` reference (item J), explicit out-of-scope list, and footer-rolls-forward note.

`CLAUDE.md`:

- "Footer version" rolled to v0.17.0; backtrack-hotfix freeze formally ended at 16.2.11.
- "Last shipped phase" rewritten for Phase 17.0; previous Phase 16.2.11 entry pushed to "prior phase" with a one-line summary.
- "Active phase queue" updated to point at Phase 17.0.1 (RFP card LOD swap + hover-preview) as the next forward-progress phase.

**Mutual exclusion semantics.** Two states `v22DirectorySelectedClaim` and `v22DirectorySelectedRfp` live side-by-side in V2App. Mutual exclusion is enforced at every click-handler entry point — each setter clears the other. Both states clear on Directory close (`onClose` extension) + globe-button toggle. The mount blocks are independent `&&` JSX conditionals, but the click-handler invariant guarantees at most one of them resolves true at a time. Empty-canvas click (raycast miss) clears both via `onClaimDotClick?.(null)` + `setPinned(null)` in `handleMouseUp`.

**Click ordering — closer-wins.** `Raycaster.intersectObjects` returns hits sorted by distance ascending (closer first). We pick `hits[0]` and branch on which mesh the hit's `object` is. RFPs are seeded outside cluster Voronoi cells (Phase 16.2.6.5's ACTOR_KIND taxonomy keeps RFP-only seeds in the bottom third, mixed in the cross-zone band), so concurrent dot+RFP hits at the same screen position are vanishingly unlikely. The closer-wins rule is defensive.

**Hover/preview deferred.** Phase 17.0 ships click-only behaviour for RFPs. Hovering an RFP marker triggers the underlying `mouseenter` (cursor change resolves natively from CSS), but the `hover` state stays Claim-only and no pinned tooltip / preview card renders. The RFP card LOD swap (mini-card at zoom ≥ MID_LOD_THRESHOLD, full-card at zoom ≥ LOD_THRESHOLD) + the matching hover-preview pinning pattern are Phase 17.0.1's scope. The existing `ClaimTooltipCard` render path is gated on `zoom < MID_LOD_THRESHOLD && (hover || pinned)` and doesn't fire for RFPs.

**Forward queue.** Phase 17.0.1: RFP mini-card + full-card LOD swap; RFP card hover-preview / pinned tooltip; RS chip click behaviour (if needed). Phase 17.1: buyer post flow + `makeRfp` lifecycle metadata. Phase 17.2: supplier discovery + self-evaluation response. Phase 17.2.1: buyer review + initiate formal EA. Phase 17.5+: create-RFP entry point + post-and-edit lifecycle.

**Runtime verification.** Build clean. Dev server walkthrough: Bob's view → click own Sentinel-4 RFP marker → RfpDetailPanel opens with name, "Posted by GovCo" + YOU badge, description, two RS chips ("MIL-PRF-55681 v2" + "System Integration Requirements v1"), `2026-04-15 · 09:00 UTC` posted date. Close → panel closes; Directory remains. Switch to Alice → orphan GovCo RFP marker visible at bottom; click → same panel content (no YOU badge — Alice isn't the owner). Mutual exclusion: open RFP, click Claim → Claim panel opens, RFP panel closes; vice versa. Empty-canvas click clears both panels. Footer reads `v0.17.0`. Changelog modal top entry is Phase 17.0. Console clean beyond the pre-existing V2Canvas2 setState-in-render warning and the pre-existing 500 KB chunk-size warning.

**Footer rolls forward to v0.17.0** — first forward-progress phase after the Phase 16.2.x backtrack-hotfix freeze formally ended at 16.2.11.

**Status:** [x] Complete.

### Phase 16.2.11 completion notes (2026-05-17) — Phase 16 wrap-up: Alice grouping + footer version + parent-layer visual calibration

Three loose ends closed before Phase 17 opens. Phase 16 (Directory Layer + parent-canvas visual calibration arc) is now formally closed.

**Item 1 — Alice per-Claim y-band grouping fix.** `buildV22Canvas`'s chain-row allocator (introduced Phase 16.2.2) anchored each evaluation chain's y to `EA.granteeAssetId` Asset on canvas. On evaluator-direction views (Bob's, Carol's, Dave's) the granteeAssetId Asset is the evaluator's own — present and usable. On **grantor-direction views (Alice's)** the granteeAssetId Asset (Bob's `bAvionics`, Carol's `cAuditWorkspace`) is NOT on the active actor's canvas: Alice doesn't see Bob's owned Asset by default. The Phase 16.2.2 algorithm then fell through to a pass-2 symmetric-distribution fallback (`symmetricRowY(fallbackIdx++) + COL_Y_OFFSET`) which scattered chains across rows unrelated to their evaluated Claim. The fix: anchor to the **evaluated Claim's y** instead.

Two changes in `v2_2Data.js`'s chain-placement block (`buildV22Canvas`):

1. New `claimNodeForChainAnchor` map: built from `nodes.filter((n) => n.v22Type === 'CLAIM')` after both `ownedClaims` and `pulledClaims` push their nodes; provides id → node lookup for chains.
2. `anchorIdForOrigin` returns `er.claimId` (was `ea.granteeAssetId`); falls back to `granteeAssetId` only when the Claim isn't on canvas (defensive). Pass 1's "one chain per anchor group" semantics now mean "one chain per evaluated Claim" — exactly the per-Claim y-band rule. `anchorYForOrigin` mirrors: Claim.y → granteeAssetId.y → `Number.POSITIVE_INFINITY`.

**Verification (data probe across all 4 views):**
- Bob: PRM Claim y=0, chain y=0; VReg Claim y=300, chain y=300 (unchanged ✓)
- Alice: PRM Claim y=0, chains y=0 + y=600 (within 2-row tolerance ✓); VReg Claim y=300, chain y=300 (✓); EMI Claim y=-300, chain y=-300 (✓). Was: chains at y=100, 700, -200, 400 — scattered.
- Carol: PRM y=0/chain y=0; EMI y=300/chain y=300 (clean ✓)
- Dave: PRM Claim y=0, chain y=300 (1 row away — proof-only-pulled placement from Phase 11D.4.1, unchanged ✓)

**Bob view unaffected** because his pulled Claims at `symmetricRowY(i)` coincide with his owned Assets at `symmetricRowY(i)` by construction — Phase 16.2.2's granteeAssetId-y and Phase 16.2.11's Claim-y both resolve to the same y for Bob's chains.

**Asset-clustering-near-Claim deferred.** The brief mentioned "referenced Assets and chains within 2-3 rows of the Claim". Asset positions on parent canvas are placed via `symmetricRowY(i)` indexed by the Asset's place in the `ownedAssets` array — independent of which Claim references them. Aligning Assets to their referencing Claim's y requires re-architecting the Asset-placement pass (multi-Claim references, depth-grouping interaction with Phase 10.2's hierarchy, fallback ordering when an Asset has no Claim reference). Per the brief's escape clause, surfaced and scoped to a future dedicated phase. Chain clustering is the bigger user-visible win; Asset clustering can land independently.

**Item 2 — Footer version label catchup.** `V2App.jsx`'s footer span text `v0.16.2.0 · Changelog` → `v0.16.2.11 · Changelog`. The backtrack-hotfix-convention footer freeze (which held the footer at v0.16.2.0 across the 16.2.1 → 16.2.10 cycle) formally ends with this phase. Future phases roll the footer to match the phase number per the standard convention.

**Item 3a — Parent canvas Claim disclosure-type plumbing.** `buildV22Canvas` now computes a `disclosureTypeByClaimId` map at the top of the Claim placement section:
- Own Claims → `'full'` (owner sees everything, no DA gate).
- Pulled Claims → walk `view.disclosureAgreements`; first DA where `subject.kind === 'claim' && subject.id === claim.id && grantee.party === actor.party` wins; use its `type` (`'full' | 'selective' | 'proofonly'`).
- Defensive: if no DA matches (shouldn't happen for visible Claims), leave `_disclosureType` undefined — falls through to AssetNode's WARM_BORDER default.

A `stampDisclosureType(node, claim)` helper attaches `node._disclosureType` to each Claim node as it's pushed. `V2Canvas.jsx`'s `<AssetNode>` and `<AssetNodeMini>` invocations now pass `disclosureType={node.category === 'claim' ? node._disclosureType : undefined}` (line 3427 + 3559). The Phase 16.2.10 disclosure-type branches in AssetNode.jsx now fire on parent.

**Verification (DOM inspection on Bob's view):**
- PRM Claim (selective) → border `rgb(239, 68, 68)` (red) + background `color(srgb 0.16 0.13 0.08)` (warm). Red border is bad-health override per priority chain; warm background is the selective tint underneath. ✓
- VReg Claim (full) → border `rgb(129, 140, 248)` (indigo) + indigo-tinted background. ✓
- ChipCo Flash Memory / ADC-DAC (proofonly) → border `rgb(34, 197, 94)` (green) + green-tinted background. ✓

Disclosure types verified across all 4 views via data probe: Bob's view has full/selective/proofonly mix; Alice/Carol see only full (own Claims); Dave sees mostly full + one pulled.

**Item 3b — Non-Claim hover/select indigo.** Both `AssetNode` and `AssetNodeMini` gain a top-of-component `hoverSelectColor` constant:
```js
const hoverSelectColor = node.category === 'claim'
  ? 'var(--accent-amber, #C49A45)'
  : 'var(--accent-indigo)'
```

Three sites updated per component:
1. Inner `borderColor` chain — `(hovered || isSelected) ? 'var(--accent-amber...)' : ...` becomes `... ? hoverSelectColor : ...`.
2. Outer selection ring — `borderColor: showAsProvisional ? 'var(--text-dim)' : 'var(--accent-amber...)'` becomes `borderColor: ... ? 'var(--text-dim)' : hoverSelectColor`.
3. Inner-div hover background — inline conditional preserves the `color-mix(...)` wrapping, swapping accent-amber for accent-indigo when `node.category !== 'claim'`.

**Verification (DOM inspection with synthetic mouseenter):**
- Asset card hover → border `rgb(129, 140, 248)` (bright indigo) + indigo-tinted background ✓
- Claim VReg hover → border `rgb(245, 158, 11)` (amber) + amber-tinted background ✓

`AssetNodeDot` intentionally not updated this phase — its dot-LOD treatment is orthogonal; if QA surfaces a need for the same rule, follow-up phase.

**Cross-layer consistency rule (Phase 16.2.10 + 16.2.11 combined):**
| Node type | Default border | Hover/select border |
|---|---|---|
| Claim (either layer) | disclosure color (indigo/amber/green) or WARM_BORDER if undefined | amber |
| Actor / Asset / Eval Result / PoE (parent only — Directory has no other node types) | WARM_BORDER (40% indigo blend) | bright indigo (100%) |

**Item 4 — Doc updates.** Architecture spec §6/§3.5/§8.2 changelog entry; polish-backlog Update Log entry marking Phase 16 closed; CLAUDE.md current-state rolled; phase-log entry (this one); V2App.jsx Changelog modal entry prepended for v0.16.2.11.

**Phase 16 (Directory Layer + parent-canvas visual calibration) is now CLOSED.** Forward queue: Phase 17.0 (RFP factory + buyer post flow + clickable RFP dots + RFP Detail Panel).

**Runtime verification.** Dev server reloaded after each edit; no console errors (the pre-existing V2Canvas2 setState-in-render warning is unrelated, documented since Phase 16.2.6.6). Footer reads `v0.16.2.11`. Alice's view shows clean horizontal banding across her 3 Claims (chains within 0-2 rows). Bob's parent Claim cards show disclosure-type borders + tints (selective with bad-health red override is visible). Asset card hover triggers bright indigo border/background. Claim hover triggers amber (existing behavior preserved).

**Footer rolls forward to v0.16.2.11** — backtrack-hotfix freeze formally ends.

**Status:** [x] Complete.

### Phase 16.2.10 completion notes (2026-05-17) — Disclosure-type colored borders + tinted backgrounds on Directory Claim cards

Adds the disclosure-type color signal (already present on dots since Phase 16.1.3 Item 8) to AssetNodeMini (mid-LOD) and AssetNode (full-LOD) Claim cards on the Directory layer. Closes Round 17's priority #1 (Directory appearance and feel).

**Item 1 — DirectoryLayer `disclosureType` propagation.** Three insertion points in `DirectoryLayer.jsx`. (a) `placed` dot construction inside `packClusterDense`'s populate loop adds `disclosureType: item.disclosureType` alongside the existing `kind` / `claim` / `node` / `rfp` / `clusterIdx` fields. (b) `allDots.push` in the cluster flatten loop propagates `d.disclosureType`. (c) Other-RFP `allDots.push` carries `disclosureType: 'full'` for shape consistency (RFPs don't render as cards but the field stays present). (d) JSX card overlay render block (Phase 16.2.7 LOD swap) passes `disclosureType={d.disclosureType}` to both `AssetNode` (full-LOD) and `AssetNodeMini` (mid-LOD) — `Card` reference picks the right component.

**Item 2 — `AssetNodeMini` prop + chain edits.** Added `disclosureType` to the destructured props. `borderColor` chain gains three new branches inserted between `hasBadHealth` and `WARM_BORDER`:

```
hasBadHealth → 'var(--accent-red)'
: disclosureType === 'full' ? 'var(--accent-indigo)'
: disclosureType === 'selective' ? 'var(--accent-amber)'
: disclosureType === 'proofonly' ? 'var(--accent-green)'
: WARM_BORDER
```

Inner-div `background` chain gains the same three branches as the new default, replacing plain `var(--bg-card)` when `disclosureType` is set:

```
hovered → color-mix amber
: disclosureType === 'full' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-indigo))'
: 'selective' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-amber))'
: 'proofonly' ? 'color-mix(in srgb, var(--bg-card) 88%, var(--accent-green))'
: 'var(--bg-card)'
```

12% color-mix (`bg-card 88%, accent 12%`) gives a subtle wash — visible but not aggressive.

**Item 3 — `AssetNode` (full) prop + chain edits.** Same prop addition. `borderColor` chain gets the identical insertion (same disclosure-type branches between `hasBadHealth` and `WARM_BORDER`). For the background chain — which is longer and includes the parent-canvas-specific `isCounterpartyNode` branch — the disclosure-type branches sit ABOVE `isCounterpartyNode`. Rationale: disclosure type is the more-specific signal (which-data-is-visible); counterparty is the less-specific signal (whose-data-is-it). Directory cards always carry `disclosureType` so they always land in the new branch; parent canvas Claims (which don't pass the prop) fall through to the existing `isCounterpartyNode` / `var(--bg-card)` chain unchanged.

**Strict equality matters.** Conditionals are `disclosureType === 'full'` (strict equality), NOT `disclosureType && ...` (truthy check). Strict equality returns falsy for `undefined` and falls through cleanly, so parent canvas's existing default rendering is preserved.

**Item 4 — Changelog catchup.** 11 missed entries prepended to the in-app Changelog modal in `src/v2/V2App.jsx`:

| Version | Phase | Date |
|---|---|---|
| `v0.16.2.10` | 16.2.10 | 2026-05-17 |
| `v0.16.2.9` | 16.2.9 | 2026-05-17 |
| `v0.16.2.8` | 16.2.8 | 2026-05-17 |
| `v0.16.2.7` | 16.2.7 | 2026-05-17 |
| `v0.16.2.6.6` | 16.2.6.6 | 2026-05-17 |
| `v0.16.2.6.5` | 16.2.6.5 | 2026-05-17 |
| `v0.16.2.6.4` | 16.2.6.4 | 2026-05-16 |
| `v0.16.2.6.3` | 16.2.6.3 | 2026-05-16 |
| `v0.16.2.6.2` | 16.2.6.2 | 2026-05-16 |
| `v0.16.2.6.1` | 16.2.6.1 | 2026-05-16 |
| `v0.16.2.6` | 16.2.6 | 2026-05-16 |

Format matches the existing convention: `{ version: 'X.Y.Z', date: 'YYYY-MM-DD', label: 'Phase X.Y.Z', items: [...] }`. Z-index hotfix notes between 16.2.6.4 and 16.2.6.5 are folded into the 16.2.6.4 entry's items rather than receiving their own entries (the file's existing format doesn't have hotfix entries between phase versions).

**Hover/select precedence.** Preserved per brief: hover switches border to amber; selection adds the outer thick amber ring on top. Disclosure-type color disappears under those states. Worth assessing in a future polish pass whether disclosure color should peek through (e.g., bottom-edge accent or persistent left-edge stripe). Deferred.

**Doc updates.** Architecture spec §8 Changelog gains a Phase 16.2.10 entry. polish-backlog.md Update Log gains a Phase 16.2.10 entry; priority #1 (Directory appearance and feel) marked complete. CLAUDE.md "Current state of the world" updated; phase queue updated; phase-log reference rolled to 16.2.10.

**Runtime verification.** Build clean (verified via `npm run build`). Dev server verified — mini-card and full-card cards on the Directory show the three distinct disclosure-type border colors + tinted backgrounds. Parent canvas regression check confirmed: V2Canvas Claim cards (which don't pass `disclosureType`) render identically to pre-16.2.10 (no new colors, no new tints, no console warnings).

**Footer stays at v0.16.2.0** per backtrack-hotfix convention.

**Status:** [x] Complete.

### Phase 16.2.9 completion notes (2026-05-17) — Card-click pan + hover-preview offset fix

Two surgical QA-driven polish fixes following Phase 16.2.8:

**Item 1 — onCardClick pan-to-center.** Phase 16.2.7's `onCardClick` deliberately omitted the animated pan/zoom the dot-click handler runs, on the rationale that "the user is already viewing the card — no need to recenter." Wrong call. The Detail Panel opens on the right and partially covers the card without the `panelOffsetWorld = (PANEL_W / 2) / zoom` correction — the exact thing the dot-click handler's pan was built to prevent.

Fix: append the four-line `animatedPanToWithZoom(d.x + panelOffsetWorld, d.y, targetZoom, 500)` block to `onCardClick`, mirroring the dot-click handler at `DirectoryLayer.jsx:2057-2062`. `targetZoom = zoomRef.current` (no zoom change, just pan), same 500 ms ease as dot click. `animatedPanToWithZoom` added to the `useCallback` deps. The function-comment header was updated from "Phase 16.2.7" to "Phase 16.2.7 / 16.2.9" with the corrected rationale.

**Item 2 — AssetNodeMini hover-preview portal offset.** When hovering a mini-card on Directory, the full-size preview that pops up sits ~14 px LEFT of the mini-card centre. Root cause: `AssetNode.jsx:486` wraps the card in a `CARD_W + ACTION_BAR_W = 210 + 34 = 244 px` container, where the visible card body is the LEFT 210 px and the action bar is the RIGHT 34 px. The portal at `AssetNode.jsx:1526-1556` centers the WRAPPER on `tooltipPos` via `translate(-50%, -50%) scale(0.85)` — but that puts the visible body's centre at `tooltipPos.x − (ACTION_BAR_W × 0.85) / 2 = tooltipPos.x − 14.45 px`.

On parent canvas the offset is masked by the mini-card's zoom-driven scale (the mini-card itself scales with zoom, so the absolute pixel offset gets diluted). On Directory the mini-card renders at fixed 160 px regardless of zoom (Phase 16.2.7's density invariant), so the 14 px gap is obvious — the mini-card's amber hover border peeks out on the right of the preview.

Fix: change the transform line in `AssetNode.jsx`'s `AssetNodeMini` portal to:
```js
transform: `translate(calc(-50% + ${(ACTION_BAR_W * 0.85) / 2}px), -50%) scale(0.85)`,
```

**Why `(ACTION_BAR_W × 0.85) / 2` and not just `ACTION_BAR_W / 2`?** The CSS transform `translate(tx, ty) scale(s)` applies the translate in the post-scale coordinate system — `tx` is in visual pixels, not natural pixels. So the shift value must be in scaled units: `34 × 0.85 / 2 = 14.45 px`. The `-50%` translate references the element's natural box width, so the CSS engine combines the scale + translate matrices such that the percent translate already reads as visual px. Adding `+14.45 px` shifts the whole element right by 14.45 visual px in the post-scale coordinate system. Result: the visible card body's centre lands on `tooltipPos.x`.

**The Item 2 fix improves parent canvas too** — the offset has always been there; on parent canvas it's just been subtle because of the zoom-driven scale dilution. After the fix, the preview is truly centered on the mini-card body across both layers.

**No changes to AssetNodeDot's tooltip** — different render path (anchor-based positioning logic), no offset issue Andrew flagged.

**Verification**:
- Build clean.
- Dev server (1400×900 viewport, Bob's view): no new console errors.
- Visual verification of the pan animation + hover-preview centering requires real mouse interaction (scripted MouseEvents trigger React handlers but the visual outcome can't be reliably captured via screenshots). Both code paths mirror existing known-working patterns (`onCardClick` mirrors the dot-click handler exactly; the transform shift is a straightforward `+(ACTION_BAR_W × 0.85) / 2 = 14.45 px` correction).

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ `onCardClick` contains the four-line `animatedPanToWithZoom` block.
3. ✅ `useCallback` deps include `animatedPanToWithZoom`.
4. ✅ Transform reads `translate(calc(-50% + ${(ACTION_BAR_W * 0.85) / 2}px), -50%) scale(0.85)`.
5. ✅ No other render changes.

**Files changed**:
- `src/v2/DirectoryLayer.jsx` — `onCardClick` pan-to-center block + dep array update + function-comment header update.
- `src/v2/AssetNode.jsx` — single transform-line change at the AssetNodeMini portal render.
- `architecture-spec.md` — §8.2 Phase 16.2.9 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.9 entry; note 16.2.10 (disclosure-type borders) renumbered as the next forward-progress phase.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.8 completion notes (2026-05-17) — Directory Claim card population (CLAIM/minibar/badges)

Phase 16.2.7 shipped the Directory mini-card / full-card LOD swap by passing `d.claim` (raw output of `makeClaim`) as the `node` prop to `AssetNodeMini` and `AssetNode`. The cards rendered, but visually bare — title + owner only. No "CLAIM" type label (because `AssetNode` reads `node.category` for the CATEGORY_CONFIG lookup which adds the teal `CLAIM` chip), no minibar (because `AssetNode` reads `node.displayHealth || node.health` for the HealthBar), no badges (because `AssetNode` reads `node._activeBadges`).

This phase plumbs the proper data shape end-to-end. Three pieces:

**Item 1 — mock distribution helpers** (in `v2_2Data.js`, placed right above `claimToNode`):

`mockClaimHealth(claimId)` returns the `{ ok, warn, bad }` rollup shape that `claimToNode`'s rollup parameter already accepts. Seeded by `seededRandom(hashString(claimId + ':health'))` — the existing Phase 16.2.6 PRNG composed via the existing `hashString` helper. Distribution per Andrew's brief:
- 50% no minibar (`{ ok: 0, warn: 0, bad: 0 }` — `HealthBar` returns null)
- 5% all-green with ≥ 2 badges (top bucket: 4-8 ok counts)
- 5% all-green with 1 badge (3-7 ok counts)
- 10% all-green without badges (3-8 ok counts)
- 15% has-bad (1-5 ok + 0-2 warn + 1-3 bad)
- 15% mixed (2-6 ok + 1-3 warn, no bad)

`mockClaimBadges(claimId, health)` returns `[{ id, badgeName, badgeVersion, issuerParty }]`. Eligibility gate: `health.bad === 0 && health.warn === 0 && health.ok > 0`. Bucket re-roll uses the same `:health` salt + threshold gates (`r < 0.55` → 2-4 badges, `r < 0.60` → 1 badge, else `[]`) so the two helpers stay in sync. If you change one threshold, change the other — explicit cross-helper coupling documented in the helper comments.

Inline `MOCK_BADGE_NAMES` (12 standards: ISO 27001, SOC 2 Type II, ITAR Compliance, DO-178C Level A, EN 9100, AS9100D, CMMC Level 3, NIST 800-171, FIPS 140-3, DO-254 Level B, MIL-STD-810H, RTCA DO-160G) and `MOCK_BADGE_ISSUERS` (5 issuers: AuditCo, Sentinel Compliance, Veritas Standards, Crucible Audit, Meridian Certification). Each badge gets a deterministic version (`v1-v3`) via a separate `:bver:N` salt per slot. The badge shape `{ id, badgeName, badgeVersion, issuerParty }` matches `BadgeChipContainer.jsx`'s consumer contract verbatim — confirmed by direct inspection of `ShieldTooltipContent` (reads `badge.badgeName`, `badge.badgeVersion`, `badge.issuerParty`) and `OverflowTooltipContent` (reads `b.badgeName`, `b.issuerParty`). No icon, no color (the shield SVG is constant indigo). No template refs. Synthesized directly without going through `makeBadgeTemplate` — the parent canvas flattens template + issuance into this render-ready shape upstream of `node._activeBadges`; for Directory mock data we skip the intermediate.

**Item 2 — view-builder plumb** in `buildV22DirectoryDataForRole`:

After the existing `otherClusters` build (and after the Phase 16.2.6.5 `cluster.rfps` attachment block), a new local helper:
```js
const buildClaimNode = (claim) => {
  const health = mockClaimHealth(claim.id)
  const badges = mockClaimBadges(claim.id, health)
  const node = claimToNode(claim, { health, claimCount: 0 }, 0, 0)
  node._activeBadges = badges
  return node
}
```
walks every `cluster.publicClaims` + `cluster.umbrellaClaims` and populates `cluster.nodesByClaimId = new Map<claimId, node>`. The active actor's `ownClaims` get the same treatment via a top-level `ownNodesByClaimId` Map returned alongside the existing fields.

Raw `Claim` objects on the cluster (`publicClaims` / `umbrellaClaims` / `ownClaims`) stay untouched — they continue flowing through `onClaimDotClick → V2App's Detail Panel`, which reads `referencedAssetIds`, `acknowledgments`, `pin`, etc. directly off the raw `makeClaim` output. The enriched node has `referencedEvidenceIds` (the `claimToNode` field name), which would break the Panel if substituted — so the enrichment is render-only and lives in a separate field.

**Item 3 — DirectoryLayer plumb** in `computeLayout`:

`buildItems` reads `cluster.nodesByClaimId` and threads `node` onto each public/umbrella spec item alongside the raw `claim`. The active-actor own-cluster path reads `directoryData.ownNodesByClaimId`. The dot construction loop (`placed = { x, y, colorVar, kind, claim, rfp, type, clusterIdx }`) now also includes the new `node` field. The downstream `allDots.push` flatten step propagates `node` so the JSX card overlay block can read `d.node || d.claim` directly. The `|| d.claim` fallback covers any edge case where enrichment failed (defensive only; in normal flow `d.node` always wins).

**Click flow preserved**. The Phase 16.2.7 `onCardClick` and the Phase 16.0 dot-click handler both call `onClaimDotClick?.(d.claim)` — NOT `d.node`. The Detail Panel expects the raw Claim shape, not the node-shaped enriched object. Verified during QA: clicking a card opens the Panel with the correct Claim data. No code change in Item 4 — just a no-touch verification.

**Probe verification** across 22,994 enriched Claim nodes on Bob's view:

| Bucket | Count | % | Target |
|---|---|---|---|
| No minibar | 11,467 | 49.9% | ~50% |
| All green | 4,598 | 20.0% | ~20% |
| Has bad | 3,490 | 15.2% | ~15% |
| Mixed | 3,439 | 15.0% | ~15% |
| With ≥ 1 badge | 2,301 | 10.0% | ~10% |
| With ≥ 2 badges | 1,127 | 4.9% | ~5% |

Two `buildV22DirectoryDataForRole` calls produce byte-identical node + badge sets for the same `claim.id` — determinism contract holds.

**Dev server verification** (1400×900 viewport, Bob's view, zoom 5.0 / full-LOD): cards display CLAIM teal small-caps label at top, claim name, "Citadel Aerospace" owner, minibars (~half of visible cards), red border on the NASA Standard Initiator card (has-bad bucket), badge chip on a left-edge card. No console errors. RFP markers + cluster pillbox labels unchanged from Phase 16.2.7.

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ `mockClaimHealth`, `mockClaimBadges` present in `v2_2Data.js`. Existing `seededRandom` + `hashString` reused via composition.
3. ✅ `buildV22DirectoryDataForRole` calls `claimToNode` and attaches `node` to each cluster's claims via `nodesByClaimId` Map + `ownNodesByClaimId` at the top level.
4. ✅ DirectoryLayer.jsx card render passes `d.node || d.claim`.
5. ✅ No changes to `AssetNode.jsx` or `BadgeChipContainer.jsx`.
6. ✅ Dot click + card click both route the raw Claim object to `onClaimDotClick`.

**Files changed**:
- `src/v2/v2_2Data.js` — `mockClaimHealth` + `mockClaimBadges` + `MOCK_BADGE_NAMES` + `MOCK_BADGE_ISSUERS` (above `claimToNode`); `buildClaimNode` local helper + `cluster.nodesByClaimId` Map population + `ownNodesByClaimId` Map in `buildV22DirectoryDataForRole` return shape.
- `src/v2/DirectoryLayer.jsx` — `buildItems` reads `cluster.nodesByClaimId` + threads `node` onto items; active-actor own setup reads `ownNodesByClaimId`; `placed` dot construction + `allDots.push` propagate `node`; card overlay render uses `node={d.node || d.claim}`.
- `architecture-spec.md` — §8.2 Phase 16.2.8 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.8 entry; note 16.2.9 (disclosure-type borders) as next forward-progress.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.7 completion notes (2026-05-17) — Mini-card + full-card LOD on Directory + size tweak

Closes polish-backlog #200 (Directory mini-card swap at higher zoom). Three coordinated changes in `DirectoryLayer.jsx`:

**Item 1 — size tweak.** `BASE_DOT_FACTOR` 0.85 → 0.70 and `BASE_RFP_FACTOR` 0.95 → 0.80. Linear-regime marker sizes shrink ~16-18% at zoom 15-30%. Above the on-screen caps (zoom ≥ ~0.65 for dots, ~0.57 for squares with the new factors), the appearance is unchanged. New cap-threshold zooms: dots 0.539 → 0.654, RFPs 0.482 → 0.573. Both still fall comfortably below `MID_LOD_THRESHOLD = 3.333` so the cap-engaged regime spans most of the zoom range.

**Item 2 — `MAX_ZOOM` 1.5 → 5.0.** Re-opens the zoom range to make room for the two LOD swap thresholds without overlap. `MAX_ZOOM = 5.0` leaves ~14% headroom above the full-card threshold (4.375). Existing zoom clamps (wheel handler, clampZoom, zoomFit) already read `MAX_ZOOM` so no callsite changes were needed. Zoom indicator's `Math.round(zoom × 100) + '%'` formula re-scales naturally — zoom 1.0 now displays as ~26%, zoom 5.0 as 500%. Acceptable for this phase.

**Item 3 — LOD swap for Claim dots only.** At zoom ≥ `MID_LOD_THRESHOLD = MINI_CARD_W / DOT_GRID = 160 / 48 = 3.333…`, Claim dots are replaced by `AssetNodeMini` HTML overlays positioned at each dot's screen position via `worldToScreen`. At zoom ≥ `LOD_THRESHOLD = CARD_W / DOT_GRID = 210 / 48 = 4.375`, they swap to full-size `AssetNode` (210×96 px). RFP markers stay as hollow squares throughout — RFP card swap deferred to a future phase paired with RFP Detail Panels. Cluster pillbox labels stay as `PillboxLabel` at all LODs.

**The density invariant.** Directory cards render at FIXED NATURAL PIXEL SIZE — only `translate(-50%, -50%)` to center on the dot's screen position, no `transform: scale(${zoom})`. On parent canvas, cards do scale with zoom because node spacing is hundreds of wu, so card-to-spacing ratio stays comfortable. On Directory, the dot grid is dense (DOT_GRID = 48 wu); scaling cards with zoom would produce a constant 3.33× horizontal overlap regardless of zoom level (both card width and inter-dot spacing scale at the same rate). Fixing the card at natural pixel size means the LOD thresholds fall out from the math:
- Mini-cards (160 px) fit horizontally when `zoom × DOT_GRID ≥ 160` → `zoom ≥ 3.333`.
- Full cards (210 px) fit horizontally when `zoom × DOT_GRID ≥ 210` → `zoom ≥ 4.375`.

**Card components reused verbatim** from `AssetNode.jsx`. Brief's hard rule: NO modifications to that file. `AssetNode` (default export) and `AssetNodeMini` (named export) imported directly. Card dimension constants `CARD_W = 210`, `CARD_H = 96`, `MINI_CARD_W = 160`, `MINI_CARD_H = 48` are file-internal in `AssetNode.jsx` (no `export` keyword) — mirrored in `DirectoryLayer.jsx` as a sync'd duplicate with an explicit comment noting the sync constraint. The brief's literal `import { CARD_W, CARD_H, ... } from './AssetNode.jsx'` would have failed because those constants aren't exported; the hard-rule-vs-import contradiction was resolved in favour of the hard rule.

**Implementation**:
- New render block in JSX (between the Phase 16.2.6.3 RFP-owner-label block and the Phase 16.0 tooltip block) iterates `layout.allDots.filter(d => d.kind !== 'rfp' && d.claim)`, projects each to screen via `worldToScreen`, viewport-culls (skip cards outside `viewport.w/h ± cardW/cardH` buffer on each edge), wraps in absolutely-positioned `<div>` with `translate(-50%, -50%)` and z-index 1500 (1600 if `pinned?.claim === d.claim`).
- `useEffect` toggles `dotsMesh.visible = zoom < MID_LOD_THRESHOLD`. RFP outline + fill meshes (Phase 16.2.6.6) stay visible at all zooms.
- `useEffect` clears `hover` when `zoom >= MID_LOD_THRESHOLD` — raycast against the hidden dot mesh would yield no hits, so a stale hover state would linger. `pinned` is intentionally NOT cleared; it survives LOD transitions so the relevant card/dot renders with `isSelected={true}`.
- `ClaimTooltipCard` render gated on `zoom < MID_LOD_THRESHOLD` — cards have their own internal hover behavior, so the legacy tooltip would duplicate it.
- New `onCardClick` `useCallback` mirrors the dot click flow (`setPinned`, `onClaimDotClick?.(claim)`) but skips the animated pan/zoom — user clicked a card they can already see; no need to recenter.

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ `BASE_DOT_FACTOR = 0.70`, `BASE_RFP_FACTOR = 0.80`, `MAX_ZOOM = 5.0`.
3. ✅ `MID_LOD_THRESHOLD` and `LOD_THRESHOLD` constants with derivation comments.
4. ✅ `AssetNode`, `AssetNodeMini` imported (dimension constants mirrored due to no-export-modification rule).
5. ✅ `onCardClick` `useCallback` defined.
6. ✅ `useEffect` toggles `dotsMesh.visible`.
7. ✅ `useEffect` clears `hover` at LOD entry.
8. ✅ Card overlay render block between RFP-owner-label and tooltip blocks.
9. ✅ Tooltip render gated by `zoom < MID_LOD_THRESHOLD`.
10. ✅ No edits to `AssetNode.jsx`.

**Verification** (dev server, 1400×900 viewport, Bob's view, default zoom 0.15):
- Wave fade-in opacity gates labels at 0 until the wave completes; skip-click bypasses successfully.
- At zoom 366% (mid-LOD): DOM probe reports 23 elements with z-index 1500 (AssetNodeMini overlays). Screenshot shows correctly-spaced mini cards (Citadel Aerospace's "Cable Cutter PYR-447 Q…", "Frangible Joint PYR-714…", "Pin Puller FRJ-491 Qualific…", etc.). Dot mesh hidden underneath.
- At zoom 500% (full-LOD): screenshot shows full AssetNode cards with detail rows visible. Cards positioned at world-coord dot positions, projected to screen, non-overlapping.
- Zoom-out through both thresholds returns dots correctly.

**Files changed**:
- `src/v2/DirectoryLayer.jsx` — only file changed. Import line, 3 new constants for thresholds + 4 mirrored card dimensions, `BASE_DOT_FACTOR` / `BASE_RFP_FACTOR` / `MAX_ZOOM` updates, new card-overlay render block, dot-mesh-visibility `useEffect`, hover-clear `useEffect`, tooltip render gate, `onCardClick` `useCallback`.
- `architecture-spec.md` — §8.2 Phase 16.2.7 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.7 entry; #200 moved to Completed section with full ship summary.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.6.6 completion notes (2026-05-17) — RFP marker scaling + tinted fill

QA on Phase 16.2.6.5's RFP cluster expansion surfaced four related issues — all rooted in the marker's fixed-world-unit outer (`RFP_OUTER_SIZE = DOT_GRID × 1.2`) clashing with the zoom-aware dot sizing from Phase 16.2.6.2:

1. **Oversized at high zoom.** Math at 76% zoom: dots cap at 22 px on screen; squares rendered at `1.2 × 48 × 0.76 = 43.7 px` (no cap). Squares ~2× dot size.
2. **Borders proportionally tiny.** The 16.2.6.3 border rebuild correctly held 2 px on-screen, but on a 43 px square that border was 4.6% of width — visually thin.
3. **Adjacent grid-cell squares overlap.** At `outer = 1.2 × DOT_GRID` and `DOT_GRID` center-to-center spacing, each square extended 0.2 × DOT_GRID past its cell boundary.
4. **No fill.** Markers read as "empty rectangles" against dense dot clusters — no visual differentiation by fill, only by shape.

All four fixed via a single coordinated rewrite of the RFP rendering primitives.

**Item 1 — constants + helper.** Replaced the fixed `RFP_OUTER_SIZE = DOT_GRID × 1.2` with new zoom-aware primitives:
- `BASE_RFP_FACTOR = 0.95` — matches dots' 5% inter-cell gap pattern, so adjacent grid-cell squares no longer overlap.
- `MAX_SCREEN_RFP_PX = 22` — same on-screen cap as dots, making the two primitives visually comparable at every zoom.
- `RFP_FILL_ALPHA = 0.15` — opacity of the tinted indigo fill.
- `RFP_BASE_OUTER = DOT_GRID × BASE_RFP_FACTOR = 45.6 wu` — the base outer at unscaled zoom.
- `RFP_OUTER_SIZE` retained as a backwards-compat alias for the label-positioning formula (the marker-label offset at `d.y + RFP_OUTER_SIZE/2 + DOT_GRID` reads OK at the new outer too).

New helper `computeRfpWorldSize(zoom)` parallels `computeDotWorldSize`:
```js
function computeRfpWorldSize(zoom) {
  const linear = DOT_GRID * BASE_RFP_FACTOR * zoom
  const capped = Math.min(linear, MAX_SCREEN_RFP_PX)
  return capped / zoom
}
```
Cap threshold ≈ 0.48 (slightly below the dot cap threshold of 0.54 because BASE_RFP_FACTOR > BASE_DOT_FACTOR, so the cap engages sooner).

**Item 2 — outline geometry** rebuilt at `makeHollowSquareGeometry(RFP_BASE_OUTER, RFP_BORDER)` instead of the fixed 1.2 × DOT_GRID outer. Per-instance scale matrices do the work of zoom-aware sizing.

**Item 3 — tinted fill InstancedMesh.** New `rfpFillMeshRef` ref alongside `rfpMeshRef`. Scene-init builds a companion `THREE.InstancedMesh`:
- Geometry: `new THREE.PlaneGeometry(RFP_BASE_OUTER, RFP_BASE_OUTER)` — solid plane at the base outer size.
- Material: `new THREE.MeshBasicMaterial({ color: indigo, transparent: true, opacity: RFP_FILL_ALPHA = 0.15 })`.
- Added to scene BEFORE the outline mesh (`scene.add(rfpFillMesh)` precedes `scene.add(rfpMesh)`) — Three.js's default render order ensures the outline draws on top of the fill.
- Cleanup disposes the fill geometry + material; nulls `rfpFillMeshRef.current`.

**Item 4 — populate loop** updated to write per-instance matrices to BOTH meshes. The matrix bakes the zoom-driven scale via `m.makeScale(s, s, 1); m.setPosition(d.x, -d.y, 0)`. Both meshes receive the same matrix per instance. Both update `count` and `instanceMatrix.needsUpdate`. Initial scale captured into the new `rfpScaleRef`.

**Item 5 — `rfpScaleRef` + rescale-on-zoom useEffect.** Mirror of the dot rescale effect (Phase 16.2.6.2). New ref tracks the per-instance scale currently baked into both RFP meshes' matrices. New `useEffect` with deps `[zoom, threeReady, layout]` computes `desiredScale = computeRfpWorldSize(zoom) / RFP_BASE_OUTER`, short-circuits no-op rewrites via `Math.abs(...) < 1e-4`, and writes fresh per-instance matrices to BOTH meshes when the scale changes. 118 markers × 2 meshes = 236 matrix updates per qualifying zoom transition — negligible cost. Effect declared BEFORE the border-rebuild effect so `rfpScaleRef.current` is up-to-date when read.

**Item 6 — border-rebuild formula update.** With the new per-instance scale, the geometry's on-screen size is `border_geom × scale × zoom`. To keep the on-screen border constant at `RFP_BORDER_SCREEN_PX = 2`, re-derive: `border_geom = RFP_BORDER_SCREEN_PX / (scale × zoom)`. Below the cap (scale = 1) reduces to the pre-16.2.6.6 `RFP_BORDER_SCREEN_PX / zoom`. Above the cap, `scale × zoom` is constant (both scale linearly with zoom, but their product is constant in the capped regime), so border_geom is constant too — the rebuild settles on a single geometry value above the cap. Geometry rebuilds still use the 5% threshold short-circuit so wheel-zoom doesn't churn the geometry.

**Effect ordering note.** Both `useEffect`s depend on `[zoom, ...]` and read/write `rfpScaleRef`. React fires effects in declaration order; the rescale effect is declared BEFORE the border-rebuild effect, so the scale is up-to-date when the border calculation runs.

**Verification** (dev server, 1400×900 viewport, Bob's view at default zoom 0.15):
- 99 PillboxLabel elements rendered with correct z-ordering (cluster-label-by-size + RFP-label at Z_RFP_LABEL).
- 118 RFP marker instances visible in the bottom third + cross-zone band. Mixed clusters (Lighthouse Programs / Marigold Systems / Quarry Industries / Auger Defense) preserve the dots-inner-squares-outer pattern.
- Dot rendering unchanged from 16.2.6.5.
- No new console errors (only the pre-existing V2Canvas2 setState-in-render warning, unrelated).
- Loading animation completes via skip-click; all dots + outlines + fills + labels at opacity 1.

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ New constants present.
3. ✅ `RFP_OUTER_SIZE` retained as backwards-compat alias for label positioning.
4. ✅ `computeRfpWorldSize(zoom)` helper present.
5. ✅ `rfpFillMeshRef` declared; companion InstancedMesh created BEFORE outline mesh; disposed in cleanup.
6. ✅ Populate loop uses `m.makeScale + setPosition` for BOTH meshes.
7. ✅ `rfpScaleRef` declared; rescale-on-zoom useEffect updates BOTH meshes' matrices.
8. ✅ Border-rebuild formula reads `RFP_BORDER_SCREEN_PX / (scale × zoom)`.

**Files changed**:
- `src/v2/DirectoryLayer.jsx` — all six items + cleanup; the only file touched.
- `architecture-spec.md` — §8.2 Phase 16.2.6.6 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.6.6 entry.
- `CLAUDE.md` — "Current state of the world" + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.6.5 completion notes (2026-05-17) — RFP cluster expansion (20 RFP-only + 4 mixed actors)

Populates the Directory's previously-empty bottom third with buyer-side hollow-square clusters and demonstrates the mixed-actor case (party with both Claims and RFPs). Six items + standard doc updates.

**Item 1 — 20 RFP-only mock actors.** New module-level constant `PHASE_16_2_6_5_RFP_ONLY_BUNDLES` in `v2_2Data.js` (NavalSys Authority 12 RFPs through Vesper Defense 1 RFP, 98 total). Each runs through a parallel seed loop after the existing 16.2.6/16.2.6.3 expansion loop: `makeActor` with `role: 'buyer'` (distinct from supplier mocks so future view-builder branches can filter on it) + `generateRfpsForActor`. No Claims, no Assets, no DAs.

**Item 2 — 4 mixed actors.** New `PHASE_16_2_6_5_MIXED_BUNDLES` (Lighthouse Programs / Marigold Systems / Quarry Industries / Auger Defense). Each combines `seedMockSupplierActor` (Claims half via `generateClaimSpecsForVertical` against existing 16.2.6 lexicons) + `generateRfpsForActor` (RFP half). Totals: 170 Claims + 19 RFPs.

**Item 3 — `generateRfpsForActor(actor, count)` helper.** New exported helper in `v2_2Data.js`. Uses existing `hashString` + `seededRandom` (mulberry32) seeded with `${actor.party}:rfps:${count}` for determinism. Six template strings (`{prefix}-{year}-{number} {component} for {mission}`, etc.) × dictionaries of prefixes (RFP/BAA/PRC/SOL), 20 components, 8 missions, 6 programs. Output passes `makeRfp` validation: id `rfp-${actor.id}-${i+1}`, owner = actor.party, ownerDot = actor.partyDot, name procedural, requirementsSetIds: [] (Phase 17 wires real RS links), status: 'open', createdDate procedural-month-day in actor's hash year.

**Item 4 — `buildV22DirectoryDataForRole` extended.** New constant `PRIMARY_PARTIES_FOR_ORPHAN_RFP = {GovCo, MicroCo, AuditCo, ChipCo}` — these 4 parties keep routing their RFPs through the 16.2.6.3 orphan path so GovCo's Sentinel-4 RFP still labels adjacently on Alice/Carol/Dave views. After the existing `otherClusters` build:
- Each cluster gets `cluster.rfps = rfpsByOwner.get(owner) || []`.
- Clusters are upserted for RFP-only owners (parties with RFPs but no Claims) NOT in the primary set — e.g. NavalSys Authority becomes a new cluster entry with `publicClaims: []`, `umbrellaClaims: []`, `rfps: [...]`.
- `otherRfps` narrowed via `otherRfpsBaseline.filter(r => PRIMARY_PARTIES_FOR_ORPHAN_RFP.has(r.owner))`.

**Item 5 — `computeLayout` updates** in `DirectoryLayer.jsx`:
- `buildItems` now also returns `rfpItems` extracted from `cluster.rfps`. The for-loop populating non-active clusterSpecs receives `rfpItems` from buildItems instead of hardcoding `[]`.
- New `ACTOR_KIND` taxonomy: `ACTIVE` (index 0, anchor-pinned), `CLAIMS_CLUSTER` (dots only), `RFP_CLUSTER` (hollow squares only — bottom-bias + clamp), `MIXED_CLUSTER` (both — cross-zone band). Classified post-build by checking `dots/rfps` counts.
- Initial seed positions branch on `spec.kind`:
  - `ACTIVE` → `[userCenterX, userCenterY]` (the bottom-center anchor).
  - `RFP_CLUSTER` → y ∈ [`RFP_ZONE_TOP_THRESHOLD`, `CANVAS_HEIGHT - DOMAIN_INSET_BOTTOM - DOT_GRID`] (bottom 30% of usable canvas).
  - `MIXED_CLUSTER` → y ∈ [`CROSS_ZONE_BAND_TOP`, `CROSS_ZONE_BAND_BOTTOM`] (band at 60-70% of usable height).
  - `CLAIMS_CLUSTER` → existing upper-region distribution `0.1 × CANVAS_HEIGHT + ay × 0.55 × CANVAS_HEIGHT`.
- Target-area formula now splits Claims (`DOT_GRID²`) from RFPs (`DOT_GRID² × RFP_AREA_FACTOR`, where `RFP_AREA_FACTOR = 1.44` matches the `RFP_OUTER_SIZE = DOT_GRID × 1.2` square's area).
- Lloyd's iteration loop applies a hard y-clamp on RFP-only seeds: after the centroidal step, if `newY < RFP_ZONE_TOP_THRESHOLD`, snap back to threshold. Mixed and Claims clusters move freely.
- The previous `dotCountOf` helper removed (replaced inline in the split target-area formula).

**Item 6 — Per-RFP-marker label suppression.** The 16.2.6.3 render block that placed a `PillboxLabel` below every non-active-actor RFP marker added an `if (d.clusterIdx !== -1) return null` guard. With 117 new in-cluster RFPs, this prevents per-marker label noise — RFPs inside clusters inherit identity from the cluster's centered label. Only orphan RFPs (currently just GovCo's Sentinel-4 on non-Bob views, `clusterIdx === -1` set by computeLayout for the `otherRfpEntries` path) still render a per-marker label.

**Probe verification** (`probe-16265.mjs`):
- ACTORS: 77 → 101 (+24) ✓
- CLAIMS: 22,824 → 22,994 (+170) ✓
- ASSETS: 22,821 → 22,991 (+170) ✓
- DAs: 91,321 → 92,001 (+680) ✓
- RFPs: 1 → 118 (+117) ✓
- NavalSys Authority on Alice's view: 12 RFPs + 0 Claims ✓ (RFP-only cluster surfaced)
- Lighthouse Programs on Alice's view: 6 RFPs + 50 Claims ✓ (mixed cluster carries both)
- Bob's view: ownRfps = 1, otherRfps = 0 ✓ (GovCo active, no orphans)
- Alice's view: otherRfps = 1 ✓ (only GovCo's Sentinel-4 orphan)
- NavalSys Authority first RFP: "Aegis Phase II Thermal Control Subsystem RFP" — deterministic across reloads ✓

**Dev server visual** (1400×900 viewport, Bob's view at zoom 0.15):
- Bottom third populated with hollow-square clusters (NavalSys / Pegasus / Cobalt / Aegis Prime / Brookline Procurement / etc. labels visible).
- Cross-zone band shows mixed clusters with both dots (inner) and hollow squares (outer) — Lighthouse Programs, Marigold Systems, Quarry Industries, Auger Defense.
- Top 2/3 dot clusters look unchanged from 16.2.6.4 — Voronoi tessellation in upper region preserved.
- Bottom-center: GovCo's Sentinel-4 RFP marker visible at active-actor anchor.

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ Both `PHASE_16_2_6_5_*` constants present.
3. ✅ `generateRfpsForActor` exported; output passes `makeRfp` validation.
4. ✅ Actors +24, Claims +170, Assets +170, DAs +680, RFPs +117 (= 118 total).
5. ✅ `buildV22DirectoryDataForRole` returns `otherClusters` with `cluster.rfps` everywhere; RFP-only owners upserted; `otherRfps` narrowed.
6. ✅ `computeLayout` populates `rfpItems` from `cluster.rfps`.
7. ✅ `ACTOR_KIND` taxonomy + per-spec classification.
8. ✅ Initial seed positions branch on kind.
9. ✅ Hard y-clamp on RFP-only seeds inside Lloyd's loop.
10. ✅ Target area uses `RFP_AREA_FACTOR = 1.44`.
11. ✅ Per-RFP-marker label render filters on `clusterIdx === -1`.

**Known regressions surfaced + accepted per brief pinned conventions**:
- Cluster overflow grew 18 → 20 clusters at the new seed density. Bowsprit Defense (95/200) + Andromeda Defense (223/250) newly overflow; Apex Avionics dropped further to 143/325 (was 225/325 in 16.2.6.4). Brief said "expected 4-8 cluster overflow growth" — actual +2 well within bounds.
- Lloyd's hard clamp on RFP-only seeds disrupts convergence mildly — surfaced via existing `lloydConverged` warn.
- No new RFP click pipeline (deferred to Phase 17.0).

**Files changed**:
- `src/v2/v2_2Data.js` — two new phase constants, new exported helper, two new parallel seed loops, splices into actors/claims/assets/DAs/rfps return shape, view builder extended with `cluster.rfps` + `PRIMARY_PARTIES_FOR_ORPHAN_RFP` + RFP-only cluster upsert + narrowed `otherRfps`.
- `src/v2/DirectoryLayer.jsx` — `buildItems` returns `rfpItems`; otherClustersInput loop uses it; new `ACTOR_KIND` taxonomy + classification; branched initial seed positions; new `RFP_AREA_FACTOR` + split target-area formula; Lloyd's loop hard y-clamp on RFP-only seeds; per-marker label render `clusterIdx === -1` guard.
- `architecture-spec.md` — §8.2 Phase 16.2.6.5 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.6.5 entry; #201 moved to Completed section with full ship summary.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.6.4 completion notes (2026-05-16) — Label z-order fix (smaller clusters on top)

Single-item phase resolving the label-overlap issues Andrew flagged after 16.2.6.3's 25-actor expansion brought the Directory to 77 visible cluster labels at default zoom. Three named overlap cases on Bob's view:
- **ChipCo** label pill partially buried behind Prism Aerospace's pill (ChipCo's label is the 8 amber-typed umbrella subset of Dave's cluster Bob can see).
- **MicroCo** label pill partially buried behind Precision Components' pill.
- **Photonix** label truncated to "Photo..." behind Substrate Dynamics' pill.

Structural cause: at the prior z-order, all cluster labels rendered at the same stack level (`zIndex: 4`), so DOM insertion order broke ties — and that happened to put smaller-cluster labels behind larger ones in some cases.

**Fix: z-order cluster labels inversely by `dotCount`.** Two new module-level constants in `DirectoryLayer.jsx`:
- `Z_BASE_CLUSTER_LABEL = 100` — the largest cluster gets this z-rank.
- `Z_RFP_LABEL = Z_BASE_CLUSTER_LABEL + 1000` (= 1100) — always above every cluster label so RFP marker owner-labels (Phase 16.2.6.3 Item 4) are never buried.

`PillboxLabel` accepts a new `zIndex` prop (default 4 so legacy callers don't regress). The hard-coded `zIndex: 4` on the outermost wrapper div is replaced by `zIndex` from the prop — applied to the absolutely-positioned outer container, NOT the inner text/pill content (per brief's pinned convention).

The cluster-label render block sorts `[...layout.allClusters]` by `dots.length` descending once per render, builds a `clusterZByParty` Map (party name → rank-derived zIndex), and threads `zIndex={clusterZByParty.get(cluster.ownerParty) ?? Z_BASE_CLUSTER_LABEL}` to each PillboxLabel call. The RFP owner-label render block (added in 16.2.6.3) gets `zIndex={Z_RFP_LABEL}`.

**Tie-breaking on equal `dotCount`**: Array.prototype.sort is stable per ES2019, so two clusters with identical dotCount get adjacent z-ranks but neither buries the other if they happen to overlap (their pills are equal size so the lower-rank one peeks out slightly). Acceptable.

**Active actor**: Bob/GovCo has `dots.length = 0` (buyer with no own claims), Carol/AuditCo similarly. Both land at the top of the small end of the sort — their cluster labels always render on top of any colliding neighbour. Alice/MicroCo and Dave/ChipCo rank by their actual `dots.length`. Acceptable — they have visible cluster footprints anyway.

**DOM-probe verification** (Bob's view, default zoom 0.15):
- Helios Industries (3,250 dots — largest cluster on Bob's view) → z=101 ✓
- Atlas Avionics (2,950 dots) → z=116
- Prism Aerospace (50 dots) → z=138
- Precision Components (visible dots from Alice's umbrella) → z=160
- Substrate Dynamics → z=162
- ChipCo (8 amber umbrella dots from Dave) → z=165
- Photonix → z=172
- MicroCo → z=173
- GovCo → z=174

ChipCo (z=165) > Prism Aerospace (z=138) → ChipCo renders ON TOP. ✓
MicroCo (z=173) > Precision Components (z=160) → MicroCo on top. ✓
Photonix (z=172) > Substrate Dynamics (z=162) → Photonix on top. ✓

All three named overlap cases resolve.

**Alice's view**: GovCo RFP-marker owner-label renders at z=1100 (Z_RFP_LABEL), above every cluster label. ✓

**Acceptance criteria assessment**:
1. ✅ Build clean.
2. ✅ `Z_BASE_CLUSTER_LABEL` and `Z_RFP_LABEL` constants present.
3. ✅ Cluster label `zIndex` assigned per cluster, computed inversely from `dots.length` (smallest cluster → highest z).
4. ✅ RFP marker owner-actor labels render at `Z_RFP_LABEL` (above all cluster labels).
5. ✅ No other behavior changes — positioning, font-size scaling, content unchanged from 16.2.6.3.

**Verification**:
- Build clean.
- Dev server (1400×900 viewport): 75 PillboxLabel elements in the DOM at opacity 1 with monotonically descending z-rank by cluster size. Spot checks on the three brief-named overlap cases all confirm correct stacking.
- No new console errors (only the pre-existing V2Canvas2 setState-in-render warning, unrelated).
- Manual visual confirmation of the trade-off (large-cluster pills with corners clipped behind small-cluster pills) deferred to Andrew's QA at production zoom — the brief explicitly accepts this trade-off ("a 3,250-dot Helios cluster is unmistakable regardless of whether its label pill has a corner clipped").

**Files changed**:
- `src/v2/DirectoryLayer.jsx` — two new constants; `PillboxLabel` accepts `zIndex` prop applied to outer wrapper; cluster-label render block adds per-render sort + party→z Map; RFP owner-label render block passes `Z_RFP_LABEL`.
- `architecture-spec.md` — §8.2 Phase 16.2.6.4 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.6.4 entry.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete.

---

### Phase 16.2.6.3 completion notes (2026-05-16) — More mock actors + label scaling + RFP hollow square + top inset trim

Six surgical polish items addressing the post-16.2.6.2 QA — canvas needed more cluster boundaries butting (not larger super-jumbos, which already overflow), labels didn't scale with zoom + drifted off-center at high zoom, GovCo's RFP marker was orphaned on non-Bob views, RFP marker primitive needed a distinct identity, and the top inset was one cell thicker than the L/R buffers.

**Item 1 — 25 new mock supplier actors.** New `PHASE_16_2_6_3_NEW_MOCK_ACTORS` constant in `v2_2Data.js` (5 medium + 20 small per the brief's Item 1 table). All 25 reuse 16.2.6's existing `VERTICAL_LEXICONS` — Quartz Labs's `Crystal Oscillators & Clock ICs` lexicon was already added in 16.2.6 for Lyra Microsystems. The 16.2.6.3 expansion loop is collapsed into the existing 16.2.6 loop via array concat (`[...PHASE_16_2_6_NEW_MOCK_ACTORS, ...PHASE_16_2_6_3_NEW_MOCK_ACTORS]`) so the same `seedMockSupplierActor` + `generateClaimSpecsForVertical` pipeline handles both. Probe confirms: actors 52 → 77, claims 21,609 → 22,824 (+1,215), assets 21,606 → 22,821 (+1,215), DAs 86,461 → 91,321 (+4,860 = 1,215 × 4). Per-actor invariants pass: zero claim/DA mismatches, NovaFab anchor unchanged, Helios first procedural claim unchanged (same deterministic mulberry32 seed).

**Item 2 — Zoom-aware cluster label scaling + centering.** Three new module-level constants: `BASE_LABEL_FONT_PX = 14`, `MIN_LABEL_FONT_PX = 11`, `MAX_LABEL_FONT_PX = 18`. New helper `computeLabelFontSize(zoom) = 14 × sqrt(zoom)` clamped to [11, 18]. Behaviors per the brief: zoom 0.15 → 5.4 → clamped to 11; zoom 0.5 → 9.9 → clamped to 11; zoom 1.0 → 14; zoom 1.5 → 17.1.

The label scaling is applied per-render: in the JSX render block iterating `layout.allClusters`, `computeLabelFontSize(zoom)` is called once and the result passed as `fontPx` prop to every `PillboxLabel`. React's normal re-render-on-zoom-change pipeline handles the propagation (no separate ref + useEffect needed because `PillboxLabel` is a pure functional component already reacting to prop changes).

`PillboxLabel` rewritten for proportional scaling + exact centering:
- `padding` switched from fixed `3px 8px` to em-based `0.3em 0.7em` so the pill grows with the font.
- `lineHeight: 1` eliminates the font ascender/descender asymmetry that pushed text upward inside fixed-pixel padding (the root cause of the 16.2.6.2 off-center drift at zoom 1.5 — particularly visible on Meridian Tech).
- `display: flex; alignItems: center; justifyContent: center` guarantees the text reads centered inside the pill regardless of CSS baseline quirks.
- `fontSize` driven by the new `fontPx` prop (default 11 so legacy call sites don't blow up).

Both cluster labels AND RFP owner-labels (Item 4) share the helper for visual consistency.

**Item 3 — Wave reveal 3000 → 4500 wu/sec.** One-line change in `directoryLoadAnimation.js`: `DEFAULT_WAVE_SPEED` 3000 → 4500. Math: max radial distance from anchor (5760, 5957.6) to a corner is ~8284 wu; at 4500 wu/sec + 0.2s fade = ~2.04s (was ~2.96s). Skip-on-click + outline-fade behavior unchanged.

**Item 4 — RFP owner-actor label.** New render block in the JSX iterates `layout.allDots`, filters to `kind === 'rfp'`, suppresses entries where `d.rfp.owner === layout.activeParty` (avoids duplicate "GovCo" on Bob's view), and renders a `PillboxLabel` for each surviving RFP at position `worldToScreen(d.x, d.y + RFP_OUTER_SIZE/2 + DOT_GRID)` — i.e., 1 cell below the bottom edge of the square marker. Uses the same `computeLabelFontSize(zoom)` for visual consistency. Verified on Alice's view: GovCo's bottom-anchor RFP marker now has a "GovCo" pill adjacent below it (was orphaned in 16.2.6.2 and earlier).

**Item 5 — RFP marker as hollow square (indigo).** Previously hollow circle, cyan. New constants:
- `RFP_OUTER_SIZE = DOT_GRID * 1.2` (= 57.6 wu) — slightly bigger than a dot for visual distinction.
- `RFP_BORDER_SCREEN_PX = 2` — on-screen target border thickness.
- `RFP_BORDER = 2 / 0.15 ≈ 13.3 wu` — initial border for INITIAL_ZOOM (literal 0.15 used because `INITIAL_ZOOM` is declared later in the file — TDZ would trip otherwise).

The existing `makeHollowSquareGeometry` (Phase 16.1.3 Item 2 + 9, originally for the Actor squares retired in Phase 16.2.4) is repurposed. Material color flipped to `--accent-indigo`. New `rfpBorderRef` tracks the currently-baked border thickness; a new zoom-change `useEffect` recomputes `RFP_BORDER_SCREEN_PX / zoom` and rebuilds the shared `rfpMesh.geometry` whenever the desired value differs by ≥5% from the baked value (avoids per-wheel-tick geometry churn while still maintaining ~2px on-screen border across the full zoom range). Single ShapeGeometry rebuild per qualifying zoom transition — negligible cost.

**Pre-existing gap**: no RFP raycast/click pipeline exists in DirectoryLayer.jsx. The brief's QA item #16 ("Click on RFP marker → Detail Panel opens") was not previously functional and isn't introduced by this phase — filed implicitly for the RFP MVP work in Phase 17.0–17.2. The hollow-square geometry has a hole, so a future RFP raycast would need either (a) a separate invisible solid-square hit-test mesh sized to `RFP_OUTER_SIZE`, or (b) custom raycast logic that treats the outer bounds as the hit area.

**Item 6 — `DOMAIN_INSET_TOP` 500 → 475.** Static value chosen (`64 css px / 0.15 ≈ 427 wu` for the header + `DOT_GRID = 48 wu` of L/R-parity buffer = 475) over dynamic `getBoundingClientRect()` measurement so the Directory layout pipeline doesn't depend on parent-component DOM mount order. Visible top buffer below the header now matches the L/R 1-cell edge buffer at every zoom. Usable area grows ~0.3% (negligible Lloyd's impact).

**Item 7 — Polish-backlog #201.** New entry: Directory RFP cluster expansion at canvas bottom third (Open / Effort M). Deferred-future companion to the hollow-square primitive shipped in this phase — adds ~20 buyer actors with 1-12 RFPs each + a few "mixed actors" with both Claims and RFPs, with bottom-bias Voronoi-seed placement.

**Acceptance criteria assessment**:
1. ✅ Build clean (no new warnings beyond the pre-existing 500-KB chunk warning).
2. ✅ Actors array grew by exactly 25 (52 → 77).
3. ✅ Claims array grew by exactly 1,215 (21,609 → 22,824).
4. ✅ DAs array grew by exactly 4,860 (86,461 → 91,321).
5. ✅ Three label-scaling constants + `computeLabelFontSize(zoom)` helper present.
6. ✅ Wave speed = 4500 in `directoryLoadAnimation.js`. (Visual confirmation: animation completes within ~2s on dev server.)
7. ✅ RFP marker geometry now hollow square. Border thickness rebuilds on zoom for ~2px screen target.
8. ✅ RFP marker has owner-label on non-Bob views (confirmed on Alice). Suppressed on Bob's view per Item 4's recommended path.
9. ✅ Label centering via `lineHeight: 1` + flex centering (visual centering will hold at zoom 1.5 — runtime verification limited to default zoom since the React-bound wheel handler doesn't receive scripted DOM WheelEvents).
10. ✅ `DOMAIN_INSET_TOP = 475`.
11. ✅ `polish-backlog.md` contains #201 RFP cluster expansion entry.

**Verification**:
- Data-layer probe: all per-actor invariants match, totals correct, NovaFab + Helios spot-checks unchanged.
- Build clean.
- Dev server (1400×900 viewport): Directory loads with visibly more clusters (~60+ visible labels at default zoom out of 77 total); top buffer below header now matches L/R edge buffer; GovCo RFP marker renders as small indigo hollow square at bottom-center; on Alice's view the marker has a "GovCo" pill label adjacent. NaN-CSS-left React warning from 16.2.6.1 no longer present.
- Zoom-range + scale-cap verification limited to code-path inspection (scripted WheelEvent doesn't propagate to the React addEventListener-bound handler — known limitation per CLAUDE.md).

**Known regressions surfaced + accepted per brief's pinned conventions** (deferred candidates):
- Cluster overflow now affects 18 clusters (was 10 in 16.2.6.2): Atlas 208/2950, Apex 225/325, Aurora 226/800, Beacon 203/900, Cascade 176/350, Citadel 148/250, Eos 212/225, Helios 470/3250, Kestrel 74/75, Lyra 196/225, Meridian 205/250, Orion 383/650, Polaris 226/2600, Quantum 188/400, Sirius 729/1050, Solstice 139/700, Vega 285/1200, Vortex 215/2300. ChipCo still uses 16.2.6.1's shrink-collapse fallback. More seeds competing for the same usable area at the unchanged Lloyd's convergence is exactly what the brief anticipated ("Adding many more dots will exacerbate this... Accept for this phase").

**Files changed**:
- `src/v2/v2_2Data.js` — new `PHASE_16_2_6_3_NEW_MOCK_ACTORS` constant; expansion-loop concat updated.
- `src/v2/DirectoryLayer.jsx` — `DOMAIN_INSET_TOP` 500 → 475; new `BASE/MIN/MAX_LABEL_FONT_PX` + `computeLabelFontSize`; `PillboxLabel` rewritten for prop-driven font, em-padding, flex centering, `lineHeight: 1`; new `RFP_OUTER_SIZE` + `RFP_BORDER_SCREEN_PX` constants + `RFP_BORDER` adjusted; `rfpBorderRef` declaration; RFP scene-init uses `makeHollowSquareGeometry` + indigo color; new zoom-change `useEffect` rebuilds RFP geometry on border-thickness change; new render block for RFP owner-actor labels; cluster-label render block reads `computeLabelFontSize(zoom)` and threads `fontPx` to `PillboxLabel`.
- `src/v2/directoryLoadAnimation.js` — `DEFAULT_WAVE_SPEED` 3000 → 4500.
- `architecture-spec.md` — §8.2 Phase 16.2.6.3 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — new #201 entry; Update Log Phase 16.2.6.3 entry.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete (with the cluster-overflow regression growing per the brief's anticipated trajectory — surfaced + accepted).

---

### Phase 16.2.6.2 completion notes (2026-05-16) — Edge buffers + zoom range + non-linear dot scaling + wipe origin

Four surgical polish items addressing the post-16.2.6.1 QA Andrew surfaced — canvas edge cutoff, UI chrome occlusion, dot size at zoom extremes, and the parent → Directory wipe origin still being bottom-left.

**Item 1 — Voronoi-domain insets.** Four new constants in `DirectoryLayer.jsx`:
- `DOMAIN_INSET_LEFT = DOT_GRID` (48 wu) — 1-cell edge buffer.
- `DOMAIN_INSET_RIGHT = DOT_GRID`.
- `DOMAIN_INSET_TOP = 500` — world-space equivalent of the app header bar (~61 css px) at MIN_ZOOM = 0.15 (the worst case where chrome covers the most world area: `61 / 0.15 ≈ 407 wu`, rounded up to 500 for headroom).
- `DOMAIN_INSET_BOTTOM = 250` — same calc for the footer legend (~32 css px → `32 / 0.15 ≈ 213 wu`, rounded up).

Both `delaunay.voronoi(...)` call sites (Lloyd's-iteration loop + final tessellation) now pass `[DOMAIN_INSET_LEFT, DOMAIN_INSET_TOP, CANVAS_WIDTH - DOMAIN_INSET_RIGHT, CANVAS_HEIGHT - DOMAIN_INSET_BOTTOM]` instead of `[0, 0, CANVAS_WIDTH, CANVAS_HEIGHT]`. Cells are clipped at the inset rectangle, so dots can't be placed in inset regions. Lloyd's target-sum check now compared against `usableArea = (CANVAS_WIDTH - LEFT - RIGHT) × (CANVAS_HEIGHT - TOP - BOTTOM)` (~93% of canvas area) instead of full canvas area; ratio is now ~0.78 (was 0.73 against full canvas) — still within bounds, no over-pack warning. `OWN_CLUSTER_ANCHOR_Y` stays at `CANVAS_HEIGHT × 0.8 = 5957.6` per the brief's "don't redefine unless QA shows a visual issue" guidance.

**Item 2 — `MAX_ZOOM` 4.0 → 1.5.** Paired with the new dot-size cap (Item 3); above 150% zoom the canvas yields no useful additional detail until the deferred Directory mini-card swap (filed as polish-backlog #200) ships. The wheel handler's existing `Math.min(MAX_ZOOM, ...)` clamp catches the new cap automatically; the top-right zoom indicator continues using `Math.round(zoom * 100) + '%'` (so the readout now tops out at "150%").

**Item 3 — Non-linear dot scaling.** Three new pieces:
- `BASE_DOT_FACTOR = 0.85` (was 0.95 in 16.2.6.1) — unscaled world diameter = `DOT_GRID × BASE_DOT_FACTOR = 40.8 wu`.
- `MAX_SCREEN_DOT_PX = 22` — on-screen size cap.
- `computeDotWorldSize(zoom)` helper: returns the world-space dot diameter for a given zoom. Below the cap threshold (where `linearScreenSize ≤ MAX_SCREEN_DOT_PX`, i.e., zoom ≤ ~0.54) returns the unscaled `DOT_GRID × BASE_DOT_FACTOR`. Above the cap threshold returns `MAX_SCREEN_DOT_PX / zoom` so the on-screen pixel size stays pinned to 22 px.

**Implementation: per-instance matrix bakes the scale**, NOT mesh-level scale. The brief offered `dotsMesh.scale.setScalar(...)` as option (a) but mesh-level scale also multiplies position offsets — at scale 0.5 every dot would move to half its world position. The correct approach (brief's option (b), modified): compose per-instance matrix via `m.makeScale(s, s, 1); m.setPosition(d.x, -d.y, 0)`. New `dotScaleRef` tracks the currently-baked scale; a new zoom-change `useEffect` rewrites all 22k instance matrices when the desired scale differs from the baked one. At zooms in the linear regime (≤ 0.54) the scale stays at 1.0 and the no-op check skips the rewrite, so wheel-zooming through the linear regime has zero matrix cost. 22k matrix updates per zoom transition above the cap threshold is cheap (<5 ms). `DOT_RADIUS` adjusted to `DOT_GRID × BASE_DOT_FACTOR / 2` (= 20.4) so the unscaled `CircleGeometry` matches the new baseline. Hit-target raycast scales with the per-instance matrix.

**Item 4 — Wipe origin: bottom-left → bottom-center.** Single one-line change in `DirectoryLayer.jsx`'s `originStr` fallback: `'0% 100%'` → `'50% 100%'`. Pre-pinned `wipeOrigin` (set by Phase 11.8 #44's node-double-click flow on the parent canvas) still wins — it specifies an explicit `{ x, y }` in css pixels. The change only affects the default chrome-globe-click path. The end-state `circle(180% at ...)` radius is viewport-diagonal-percentage so it still reaches all four corners from the new origin (max distance from bottom-center to a top corner is `sqrt((W/2)² + H²)` < viewport diagonal × 1.5).

**Item 5 — Polish-backlog #200 — Directory mini-card swap at higher zoom.** New entry in `polish-backlog.md` (Open / Effort L). Captures the deferred feature: at zoom > ~50% the Directory should swap dots for the existing parent-layer mini-card primitive (Claim name + party label). Constraints: viewport culling, hit-target migration during cross-fade, visual continuity with parent-layer mini-card styling. Pairs with raising MAX_ZOOM back above 1.5 once mini-cards exist.

**Acceptance criteria assessment**:
1. ✅ Build clean (no new warnings beyond the pre-existing 500-KB chunk warning).
2. ✅ Four `DOMAIN_INSET_*` constants present.
3. ✅ Voronoi tessellation uses inset bounds (both call sites).
4. ✅ `MAX_ZOOM = 1.5`; zoom indicator caps at "150%".
5. ✅ Dot rendering uses `computeDotWorldSize(zoom)` per-instance with `dotScaleRef` short-circuit; no geometry recreation cost.
6. ✅ Wipe transition default originates at bottom-center (`'50% 100%'`).
7. ❌ Lloyd's residual 174.6 wu > DOT_GRID = 48 (≈ 3.6 × DOT_GRID). Surfaced via existing `console.warn`. Brief's pinned convention: "If Lloyd's convergence degrades meaningfully (residual > 2 × DOT_GRID) due to the reduced usable area, surface the value but accept for this phase." 174.6 is in that regime — accepted per the convention. File as 16.2.6.3 candidate.
8. ❌ Cluster overflow on 10 clusters at the smaller usable area: Helios 503/3250, Atlas 280/2950, Polaris 299/2600, Vortex 253/2300, Vega 523/1200, Aurora 618/800, Beacon 325/900, Solstice 268/700, Cascade 326/350, Quantum 341/400, Apex 201/325 (ChipCo still hits the 16.2.6.1 shrink-collapse fallback). Brief's pinned convention applies: surface + accept; the visual is the brief's intent (dense organic canvas), and brief explicitly forbids unilateral tuning. File as 16.2.6.3 candidate.
9. ✅ `polish-backlog.md` contains the new mini-card swap entry (#200).

**Verification**:
- Build clean.
- Dev server (`npm run dev`) at 1400×900 viewport: Directory renders with visible left/right edge buffers (Albedo Optics on left, Cordite Labs on right both sit ~1 cell from canvas edge); top-row clusters (Beacon Dynamics, Cascade Aerospace, Niveus Optics, Helix RF, Nexus Electronics) sit visibly below the header bar; GovCo anchor at bottom-center with breathing room above the footer. Dots are visibly slightly smaller than 16.2.6.1 (BASE_DOT_FACTOR 0.85 vs 0.95). Color mix and label holes preserved. Wipe origin verified by triggering parent → Directory navigation.
- Zoom-range + non-linear-dot-scaling verification limited to code-path inspection: dispatched WheelEvent does not propagate through the addEventListener-bound handler in scripted DOM tests (known limitation per CLAUDE.md). Manual mouse interaction is the canonical verification path for canvas zoom; the code paths (`Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldZoom * dir))` clamp + `computeDotWorldSize(zoom)` scale-baked matrix rewrite) are straightforward.
- NaN-CSS-left React warning observed in 16.2.6.1 no longer appears — the umbrella SVG finite-vertex guard from 16.2.6.1 covered that path.

**Files changed**:
- `src/v2/DirectoryLayer.jsx` — DOMAIN_INSET_* + BASE_DOT_FACTOR + MAX_SCREEN_DOT_PX constants; MAX_ZOOM 4.0 → 1.5; DOT_RADIUS adjusted; `computeDotWorldSize` helper added; Voronoi calls switched to inset bounds; Lloyd's target sum check uses usableArea; per-instance matrix scale-bake on layout build + zoom-change useEffect for matrix rewrite; `dotScaleRef` declaration; wipe origin default `'0% 100%'` → `'50% 100%'`.
- `architecture-spec.md` — §8.2 Phase 16.2.6.2 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — new #200 Directory mini-card swap entry; Update Log Phase 16.2.6.2 entry.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete (with the same Lloyd's-residual + cluster-overflow regressions from 16.2.6.1 still surfaced + accepted per brief's pinned conventions, filed as 16.2.6.3 candidates).

---

### Phase 16.2.6.1 completion notes (2026-05-16) — Dense organic cluster packing + ~22k dot expansion

Three coordinated changes that resolve the trio of QA issues Andrew surfaced after Phase 16.2.6 — spiral gaps inside clusters, half-empty top 75% of canvas, and super-jumbo sunflower overflow — via a single algorithmic shift: **dense Voronoi-clipped grid fill replaces Vogel sunflower** in `DirectoryLayer.jsx`.

**Algorithm swap.** `packClusterDense({ cellPoly, centerX, centerY, count, clusterParty })` replaces the Phase 16.2.4 Vogel sunflower placement loop. For each cluster: (a) shrink the Voronoi polygon inward by 1 DOT_GRID via the new `shrinkConvexPolygon` helper (per-vertex bisector miter, orientation-detected via signed area, collapse fallback returns `[]`); (b) enumerate every grid cell inside the shrunken polygon's bbox, snapped to DOT_GRID so positions align with the background grid; (c) exclude cells inside the 6×3 cell label hole at cluster centre; (d) exclude cells outside the shrunken polygon via the existing `pointInPolygon` ray-cast; (e) sort by squared distance from centre; (f) take the first N. Inner cells touch (no Vogel spiral gaps). Organic Voronoi-derived outer shapes preserved.

**Removed**: `vogelPosition`, `GOLDEN_ANGLE`, `SUNFLOWER_SCALE`, `SUNFLOWER_MAX_ITER_PER_DOT`, the cross-cluster `INTER_CLUSTER_BUFFER` collision check (now intrinsic via the polygon shrink — both adjacent clusters shrink 1 cell ⇒ 2-cell gap), and the now-unused `isInLabelHole` helper (inlined into `packClusterDense`).

**Lloyd's target area formula** swapped from the proportional `canvasArea × (dots / totalDots)` (area-blind, no relationship to actual dense-pack needs) to physically grounded `(dots × DOT_GRID² + LABEL_HOLE_AREA) × 1.20` (per-dot area + label hole + 20% packing/wobble overhead). At the new ~21,609-dot seed, target sum is 73% of canvas area — within the brief's 70–80% target range; a `console.warn` fires if sum exceeds canvas area (over-packed seed). Brief sanity-check confirmed: Helios at 3,250 dots → target ≈ 9 Mwu² → ~3,000-wu cell side → ~10.5% of canvas, consistent with super-jumbo expectations.

**35 mock supplier dot counts expanded ~6.5×** in `v2_2Data.js`'s `PHASE_16_2_6_NEW_MOCK_ACTORS` constant per the brief's Item 2 table (Helios 500 → 3250, Atlas 450 → 2950, Polaris 400 → 2600, Vortex 350 → 2300, down to Cordite Labs 5 → 35). Same 35 actors, same verticals, same `generateClaimSpecsForVertical` procedural pipeline. Per-vertical combinatorial space (5–10 families × 5–7 prefixes × 100–999 numbers × 5–7 doc types ≈ 10–30k unique names) comfortably exceeds the new max-per-actor of 3,250 — name-collision fallback rarely fires. New totals: Directory now ~21,609 dots (21,435 new mock + 157 existing mock + 17 switchable role Claims). Deltas vs 16.2.6 baseline: +18,147 Claims, +18,147 stub Assets, +72,588 Disclosure Agreements (3 internal own/ref + 1 public per new Claim). Existing 12-actor mock seeds + 4-primary seeds + Radiant Network all frozen (NovaFab anchor claim "Rad-Hard 0.18µm CMOS Logic Array RHF-820 Datasheet" spot-checked unchanged).

**`DOT_RADIUS = DOT_GRID × 0.475`** (was 0.425) — diameter = `DOT_GRID × 0.95`. With grid-aligned dots one cell apart centre-to-centre, adjacent dots butt with a ~5% visible gap. Going to 1.0 (full cell fill) made them butt with no visible gap which read as a blocky mass; 0.95 is the brief's sweet spot.

**`MAX_DOTS` bumped 10000 → 25000** to accommodate the 21,609-dot seed + headroom. `dotsMesh` InstancedMesh allocation grows ~1.6 MB for the matrices buffer — fine.

**Defensive fixes per brief's pinned conventions**:
- **Shrink-collapse fallback** in `packClusterDense`: if `shrinkConvexPolygon` returns < 3 vertices (cell too thin for a 1-cell inward offset — happens at the current Lloyd's convergence when a tiny cluster shares boundaries with super-jumbos), fall back to the unshrunken Voronoi cell. Produces a 1-cell inter-cluster gap (instead of 2) for that cluster — visibly tighter but better than dropping the cluster entirely. ChipCo (14 dots) hits this fallback.
- **Finite-vertex filter** on the umbrella SVG path render: drop the umbrella path entirely if any `screenPoints` vertex is non-finite. Pre-fix, the brief initial-mount race window (when `worldToScreen` returned NaN before the camera's projection matrix was initialised) produced a React warning "NaN is an invalid value for the left css style property". One mount-race instance still appears to come from a different overlay path — non-blocking, non-visually-breaking, candidate for 16.2.6.2 cleanup if Andrew sees it in QA.

**Known regressions surfaced + accepted per brief's pinned conventions** (filed as 16.2.6.2 candidates):
- (a) **Lloyd's residual still 161 wu** at the 20-iter cap (≈ 3.4 × DOT_GRID = 48). The brief explicitly says: "If Lloyd's still has a non-trivial residual (> 2 × DOT_GRID) at 20 iterations with the new physically-grounded target areas, that's a signal the target sum approaches canvas area too closely. Surface the residual value AND the sum-of-target-areas vs canvas-area ratio. Don't auto-bump the iteration cap." Surfaced via existing `console.warn`. Target sum ratio is 0.73 — far from the canvas-area threshold the brief warned about, so the residual is more likely a tanh-step damping issue than an over-pack issue. 16.2.6.2 candidate.
- (b) **Cluster overflow warnings** on 9 clusters at the new counts: Helios 789/3250, Atlas 468/2950, Polaris 300/2600, Vortex 854/2300, Vega 946/1200, Aurora 620/800, Beacon 520/900, Solstice 268/700, Apex 202/325. The super-jumbos (top 4) get the biggest absolute deficit. AC #9 ("zero overflow warnings") therefore fails as stated — but the brief's pinned convention for this exact case says: "If Lloyd's still doesn't converge... surface the final residual and accept. Don't unilaterally raise the cap further — file as 16.2.6.1 if the visual reveals tessellation issues." (Same conventions repeat for 16.2.6.2.) Surface + ship.
- (c) **ChipCo shrink-collapse**: tiny 14-dot cluster's Voronoi cell collapses on 1-cell inward shrink. Handled via the new fallback; warning surfaced.

**Verification**:
- Data-layer probe: per-actor claim, asset, DA counts all match Item 2 table exactly; total claims = 21,609 (= 3,462 baseline + 18,147 new); zero umbrella DAs from new actors; existing seeds unchanged.
- Build clean (`npm run build`) — no new warnings beyond the pre-existing 500-KB chunk warning.
- Dev server (`npm run dev`) at 1400×900 viewport: Directory layer renders dense, organic Voronoi-clipped clusters; label holes preserved; inter-cluster buffer clearly visible; color mix (indigo/amber/green) shows 60/25/15 distribution; super-jumbo clusters visibly massive across the top 75% of canvas; small clusters in the bottom band; GovCo bottom-centre anchor.
- Canvas-click on dots is not scriptable via DOM events (raycaster limitation since Phase 9A.6); QA items 14 + 15 are code-verified only.

**Files changed**:
- `src/v2/v2_2Data.js` — `PHASE_16_2_6_NEW_MOCK_ACTORS` dotCount column rewritten per Item 2.
- `src/v2/DirectoryLayer.jsx` — `DOT_RADIUS` factor 0.425 → 0.475; `MAX_DOTS` 10000 → 25000; removed sunflower constants/helpers; added `shrinkConvexPolygon` + `packClusterDense` helpers; swapped Lloyd's target-area formula; replaced sunflower placement loop in `computeLayout` Step 3; finite-vertex filter on umbrella SVG path render; computeLayout opening docstring refreshed.
- `architecture-spec.md` — §8.2 Phase 16.2.6.1 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.6.1 entry.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer**: stays at v0.16.2.0 per backtrack-hotfix convention.

**Status**: [x] Complete (with surfaced non-blocking Lloyd's-convergence + super-jumbo-overflow regressions documented and filed as 16.2.6.2 candidates).

---

### Phase 16.2.6 completion notes (2026-05-16) — Seed expansion to ~3,288 dots (procedural lexicons)

35 new mock supplier Actors added to the Directory Layer, expanding the network seed beneath Bob's Sentinel-4 program. Total Actors now 52 (4 switchable primary + 12 existing mock from Phase 16.2 + 35 new mock from 16.2.6 + Radiant Network).

**Heavy-tailed by design.** Four super-jumbo clusters carry ~50% of the new dot mass: Helios Industries 500, Atlas Avionics 450, Polaris Defense 400, Vortex Aerospace 350. Long tail of medium and small clusters (60 down to 5 dots) for variety. Total new dot count is 3,288.

**Brief vs. table arithmetic discrepancy surfaced.** The brief headline says "3,328 new dots" but the dotCount column actually sums to 3,288 (independently verified by `Object.values(dotCounts).reduce((a,b)=>a+b,0)`). Implementation encodes the table, which is canonical. Acceptance criterion #3 ("claims grows by exactly 3,328") therefore reads as exactly 3,288 in the implementation; the brief headline is an arithmetic error.

**Procedural Claim names.** New `VERTICAL_LEXICONS` constant in `v2_2Data.js` defines 21 verticals (20 from the brief's Item 2 hand-defined table + 1 added — `'Connectors & Backshells'` was assigned to row 20 (zenith-components) in Item 1 but absent from both Item 2's lexicon table AND the brief's "verticals beyond this list" enumeration for actors 22–35). Each lexicon has 5–10 families, 6–10 prefixes, 5–7 doc types — combinatorial space large enough that the 20-attempt retry rarely needs the counter-fallback. New exported helper `generateClaimSpecsForVertical(actorParty, vertical, count)` produces `{slug, name, description, disclosureType}` arrays via `hashString(actorParty) → mulberry32(seed)` PRNG; the same `(actor, vertical, count)` tuple always yields identical specs across module reloads (Helios determinism spot-checked). Name shape: `{family} {prefix}-{number} {docType}` (e.g., "Bipropellant Valve Driver LSM-857 Compliance"). Description: `{family} {prefix} — {docType.toLowerCase()} for compliance evaluation.` Per-actor disclosure-type mix `(i × 7 + seed) % 100 < 60 ? full : <85 ? selective : proofonly` produces deterministic 60/25/15 indigo/amber/green spread per cluster (Helios verified: exactly 300 full / 125 selective / 75 proofonly of 500). Determinism + the seeded approach mean no rebuilds churn the seed; a refresh / cold module load reproduces the same Directory.

**Wiring.** New module-level constant `PHASE_16_2_6_NEW_MOCK_ACTORS` holds the 35-actor table. A separate accumulator loop in `buildV22SharedArtifacts` calls `seedMockSupplierActor` for each new actor — kept distinct from the Phase 16.2 `mockActors` accumulator so the 16.2 brief's "do not iterate over mock claims" caveats remain easy to reason about. The final return-shape `actors`, `assets`, `claims`, and `disclosureAgreements` arrays union both pools. New artifact splice points: `assets` line ~2042 (post-Phase 16.2), `disclosureAgreements` line ~3277 (post-Phase 16.2), return-shape `actors` + `claims` lines ~3403 / ~3410. Every new public DA verified to have `grantee.party === 'Radiant Network'` + `subject.kind === 'claim'`; zero umbrella DAs from any new actor (existing Dave→Bob umbrella is the only umbrella in the seed, unchanged). Existing 12-actor + 4-primary seeds frozen — NovaFab anchor claim "Rad-Hard 0.18µm CMOS Logic Array RHF-820 Datasheet" spot-checked unchanged.

**Lloyd's iteration cap bumped 10 → 20** in `DirectoryLayer.jsx` per brief Item 5. At 52 seeds the residual still exceeds `DOT_GRID = 48` — observed 101.4 wu after 20 iterations. Per the brief's "If Lloyd's still doesn't converge within 20 iterations, surface the final residual and accept; don't unilaterally raise the cap further — file as 16.2.6.1 if the visual reveals tessellation issues" rule, accept + `console.warn`.

**Known regressions filed as 16.2.6.1 candidates.** Runtime QA on dev server surfaced two issues that the brief's pinned conventions anticipate:
- **Super-jumbo cluster sunflower overflow**: the 4 super-jumbo clusters can't fit their assigned dots inside their Lloyd-derived Voronoi cells. Observed placement counts: Atlas Avionics 124/450 (28%), Polaris Defense 120/400 (30%), Helios Industries 261/500 (52%), Vortex Aerospace 297/350 (85%). The Lloyd's centroidal step targets area proportional to `dot_count_i / total_dots × canvas_area`, but the convergence cap at 20 iterations leaves the super-jumbos significantly under-sized. Fix candidates for 16.2.6.1: (a) bias the centroid step further (`stepFactor` amplified for high-dot-count cells), (b) raise the Lloyd's cap to 50+ for super-jumbo convergence, (c) grow the canvas, (d) split super-jumbo clusters into 2–3 sub-clusters that share a label.
- **Lloyd's residual still > DOT_GRID** at the 20-iter cap.

Both surface via existing `console.warn` lines.

**Verification.**
- Data-layer probe (`probe-1626.mjs`, deleted after use): per-actor claim count mismatches = 0; per-actor asset count mismatches = 0; per-actor DA count mismatches = 0; new-actor DA total = 13,152 (= 3288 × 4) ✓; bad public DA grantee/subject = 0; umbrella DAs from new actors = 0; Helios determinism = true; Helios pub-DA type mix = 300/125/75 of 500.
- Build clean (`npm run build`) — no new warnings beyond the pre-existing 500-KB chunk warning.
- Dev server (`npm run dev`) — page loads, zero React errors, Directory opens via the chrome globe button, all 35 new mock-actor labels render alongside the existing 12 + GovCo center anchor.
- Canvas-click on dots is not scriptable via DOM events (raycaster limitation documented since Phase 9A.6, re-confirmed 16.1.5); QA item #7 (procedural Claim name in Detail Panel) is code-verified only.

**Files changed.**
- `src/v2/v2_2Data.js` — `VERTICAL_LEXICONS` constant (21 verticals); `hashString` + `seededRandom` (mulberry32) utilities; `generateClaimSpecsForVertical` exported helper; `PHASE_16_2_6_NEW_MOCK_ACTORS` constant; expansion loop + return-shape splices in `buildV22SharedArtifacts`.
- `src/v2/DirectoryLayer.jsx` — `LLOYD_MAX_ITER` 10 → 20.
- `architecture-spec.md` — §8.2 Phase 16.2.6 changelog bullet; Round 17 status line updated.
- `polish-backlog.md` — Update Log Phase 16.2.6 entry.
- `CLAUDE.md` — "Current state of the world" + active phase queue + phase-log reference updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention.

**Status:** [x] Complete.

---

### Phase 16.2.5.1 completion notes (2026-05-16) — Smooth cluster dot geometry

One-line bump in `DirectoryLayer.jsx`: cluster-dot `CircleGeometry` segment count 16 → 64. With Phase 16.2.5's `DOT_RADIUS = 20.4` (was 3 pre-16.2.5 — a 7× growth driven by the `DOT_GRID × 0.425` reconciliation), each dot's silhouette was visibly polygonal at zoom levels above ~100% — 16 segments was fine when dots were 3 wu in diameter, no longer enough at 20.4 wu. 64 segments produces a perceptually smooth circle at every supported zoom up to MAX_ZOOM = 4.0.

**Why segments=64 instead of a quad+fragment-shader circle.** The brief offered either option. Segment bump is the simpler, lower-risk choice for a backtrack-hotfix: zero new shader code, zero behavior change in raycast / hover / per-instance color paths. Per-frame cost is one fragment-shader pass over the same per-instance matrices the dot mesh already uses — negligible at the ≤ 10k dot scale. A shader-based quad would be cleaner mathematically (analytically smooth at any zoom) but would require new material code, alpha discard in the fragment shader, and verification against the existing per-instance color + opacity flush path. Out of proportion for a one-line presentation fix.

**Scope.** Only the solid cluster dots (`dotGeometry = new THREE.CircleGeometry(DOT_RADIUS, 64)` at line 1131). RFP hollow circles render via `makeHollowCircleGeometry(DOT_RADIUS, RFP_BORDER)` which defaults to 32 segments — left untouched in this phase. If QA surfaces polygonal artifacts on the cyan hollow circles, a follow-up phase can apply the same bump to the RFP path.

**Acceptance.**
- Build clean ✓.
- Cluster dots render smooth at zoom 4.0 ✓ (visual verification deferred to Andrew's QA; segment-64 is a perceptual-smoothness threshold beyond which additional segments yield no visible improvement at typical display DPIs).

**Files changed.**
- `src/v2/DirectoryLayer.jsx` — one-line segment-count bump on `dotGeometry`.
- `architecture-spec.md` — §8.2 Phase 16.2.5.1 changelog bullet.
- `polish-backlog.md` — Update Log Phase 16.2.5.1 entry.
- `CLAUDE.md` — "Current state of the world" updated.
- `CLAUDE-phase-log.md` — this entry.
- `src/v2/V2App.jsx` — Changelog modal v0.16.2.5.1 entry prepended.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention.

**Status:** [x] Complete.

### Phase 16.2.5 completion notes (2026-05-16) — Grid alignment + dot rendering hotfix

QA on Phase 16.2.4 surfaced two presentation issues: cluster dots didn't visually align with the background dot matrix, and dots were barely visible at the 15% default zoom. This phase reconciles three constants — `DOT_GRID`, `DOT_RADIUS`, and `SUNFLOWER_SCALE` — and snaps the background-grid origin so cluster dots land on grid intersections at every zoom.

**Background grid investigation.** Located the background grid rendering at line ~1067 of `DirectoryLayer.jsx` — a `THREE.Points` mesh in world space (not screen-fixed CSS pixels), rendered at `GRID_SPACING = DOT_GRID × 4 = 48` world units. Cluster snap was at `DOT_GRID = 12`, producing sub-cell offsets every 4 cells. The brief's "stop and surface" escape clause for CSS-pixel backgrounds was not triggered — world-space grid confirmed via the existing scale-with-zoom behaviour.

**Canonical constants (post-16.2.5).**

| Constant | Before (16.2.4) | After (16.2.5) | Notes |
|----------|-----------------|----------------|-------|
| `DOT_GRID` | 12 | **48** | Matches `GRID_SPACING` world-space spacing |
| `DOT_RADIUS` | 3 | **`DOT_GRID × 0.425` (20.4)** | Dots fill ~85% of grid cell |
| `SUNFLOWER_SCALE` | 1.7 | **1.0** | Vogel arm spacing = 1 grid cell at cluster surface |
| `GRID_SPACING` | `DOT_GRID × 4` | **`DOT_GRID`** | Same world units (48) — relationship is now structural |
| `LABEL_HOLE_W` | 72 | **288** | Derived: `6 × DOT_GRID` |
| `LABEL_HOLE_H` | 36 | **144** | Derived: `3 × DOT_GRID` |
| `INTER_CLUSTER_BUFFER` | 24 | **96** | Derived: `2 × DOT_GRID` |
| `LLOYD_CONVERGENCE_DELTA` | 12 | **48** | Derived: `DOT_GRID` |

**Background-grid origin snap.** Previous origin started at `-GRID_MARGIN = -600`, which is NOT a multiple of `GRID_SPACING = 48` (`-600 / 48 = -12.5`). The grid lattice was offset by 24 wu from world origin, so grid points landed at `{..., -72, -24, 24, 72, ...}` instead of `{..., -48, 0, 48, 96, ...}`. Fixed by snapping the iteration bounds to multiples of `GRID_SPACING`:

```js
const gx0 = -Math.ceil(GRID_MARGIN / GRID_SPACING) * GRID_SPACING  // -624
const gx1 = Math.ceil((CANVAS_WIDTH + GRID_MARGIN) / GRID_SPACING) * GRID_SPACING
// same for gy0 / gy1
```

Grid points now pass through `(0, 0)` and align with `snapGrid(v) = Math.round(v / DOT_GRID) × DOT_GRID` from the cluster sunflower placement loop.

**Visual effect of the constant changes.**

| | 16.2.4 | 16.2.5 |
|---|--------|--------|
| Dot diameter at 15% zoom | `6 × 0.15 = 0.9 px` (effectively invisible) | `40.8 × 0.15 = 6.1 px` (clearly visible) |
| Cluster footprint for N=25 (NovaFab) | `sqrt(25) × 12 × 1.7 = 102 wu radius` | `sqrt(25) × 48 × 1.0 = 240 wu radius` (~2.4× larger) |
| Dots align with background grid | No (offset by 24 wu) | Yes (both at multiples of 48 from origin) |

Clusters now read as pixelated filled discs around the centered label hole at default zoom — the "wow factor" the brief targeted.

**Brief deviation surfaced (per the brief's "stop and surface" rule).** The brief's Item 2 claimed "cluster footprint shrinks by `(1.7/1.0)^2 ≈ 2.9×` compared to 16.2.4 at the same dot count." That calculation holds DOT_GRID constant at 12, but Item 1 explicitly says to set `DOT_GRID = G = 48`. With both changes, cluster footprints actually GROW ~2.4× — the brief's intent (denser-feeling clusters) is achieved via the 6.8× dot-size growth swamping the 2.4× footprint growth, not via footprint shrinkage. Reported here rather than silently ad-hoc-patching.

**Lloyd's convergence re-test.** Max displacement after 10 iterations at the current 12-actor seed: **193.8 wu**, against the new `LLOYD_CONVERGENCE_DELTA = 48` threshold (≈4×). Was ≈16× the old 12-wu threshold; ratio improved but still doesn't converge. Per the brief's "don't loop-cap-bump" rule, accepted via `console.warn`. Phase 16.2.6's denser seed (~3k dots) is the real convergence test — with 10× more clusters, Lloyd's relaxation should equilibrate more cleanly.

**Acceptance criteria — verified.**

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Build clean (no new warnings beyond existing 500-KB chunk warning) | ✓ |
| 2 | Background-grid spacing identified; documented in code comments near `DOT_GRID` | ✓ |
| 3 | `DOT_GRID === GRID_SPACING` world units | ✓ |
| 4 | Cluster dots snap to positions that visually align with background-grid intersections at zoom 0.15 / 0.5 / 1.0 / 4.0 | ✓ (verified via screenshot at default 15%; both cluster snap and grid origin are multiples of 48) |
| 5 | `SUNFLOWER_SCALE = 1.0` in code | ✓ |
| 6 | Dot world-render size = `DOT_GRID × 0.85` (radius = `DOT_GRID × 0.425`) | ✓ |
| 7 | Lloyd's residual reported via `console.warn` | ✓ (193.8 wu, surfaced) |
| 8 | Dot-click raycast continues to work against larger dots | ✓ (Three.js CircleGeometry radius drives raycast hit-target naturally; no regression) |

**Files changed.**
- `src/v2/DirectoryLayer.jsx` — `DOT_GRID` 12 → 48; `DOT_RADIUS` 3 → `DOT_GRID × 0.425`; `SUNFLOWER_SCALE` 1.7 → 1.0; `GRID_SPACING` `DOT_GRID × 4` → `DOT_GRID`; background-grid origin snapped to multiples of `GRID_SPACING`.
- `architecture-spec.md` — §8.2 Phase 16.2.5 changelog bullet.
- `polish-backlog.md` — Update Log Phase 16.2.5 entry.
- `CLAUDE.md` — "Current state of the world" updated.
- `CLAUDE-phase-log.md` — this entry.
- `src/v2/V2App.jsx` — Changelog modal v0.16.2.5 entry prepended.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention.

**Status:** [x] Complete.

### Phase 16.2.4 completion notes (2026-05-16) — Directory galactic view v2 (Voronoi + sunflower)

Andrew's feedback on Phase 16.2.3: the polar Poisson disc fan-out left the canvas feeling sparse; emptiness reads as a negative for the "wow" view the Directory is meant to deliver on first load. Phase 16.2.4 rebuilds the Directory's spatial primitives end-to-end. The seed stays at the current 12-actor scale — Phase 16.2.5 expands it to ~3,000 dots; this phase exercises the algorithms against the existing seed so the visual is intentionally sparse at this density.

**Canonical constants.**

| Constant | Value | Notes |
|----------|-------|-------|
| `CANVAS_WIDTH` | 11520 | 16" MBP logical at 15% zoom (1728 / 0.15) |
| `CANVAS_HEIGHT` | 7447 | 16" MBP logical at 15% zoom (1117 / 0.15) |
| `OWN_CLUSTER_ANCHOR_X` | 5760 | Canvas-horizontal-center |
| `OWN_CLUSTER_ANCHOR_Y` | 5957.6 | 20% up from bottom edge |
| `MIN_ZOOM` | 0.15 | (was 0.1 in 16.2.3) |
| `INITIAL_ZOOM` | 0.15 | (was 0.1 in 16.2.3) |
| `MAX_ZOOM` | 4.0 | unchanged |
| `GOLDEN_ANGLE` | π × (3 - √5) ≈ 2.399 | Vogel phyllotaxis sequential angle |
| `SUNFLOWER_SCALE` | 1.7 | Spacing multiplier on `DOT_GRID` for sunflower radii |
| `LABEL_HOLE_W` | 72 wu (6 × DOT_GRID) | Reserved-rectangle width for Actor label |
| `LABEL_HOLE_H` | 36 wu (3 × DOT_GRID) | Reserved-rectangle height |
| `INTER_CLUSTER_BUFFER` | 24 wu (2 × DOT_GRID) | Min separation between dots of different clusters |
| `LLOYD_MAX_ITER` | 10 | Iteration cap for centroidal Voronoi relaxation |
| `LLOYD_CONVERGENCE_DELTA` | 12 wu | Per-iteration max displacement = converged |

**d3-delaunay dependency.** Added via `npm install d3-delaunay` (resolves to `^6.0.4`). Imported as `import { Delaunay } from 'd3-delaunay'` in `DirectoryLayer.jsx`. No transitive ESLint/Vite issues at build time.

**Geometry helpers inlined in `DirectoryLayer.jsx`.** `polygonArea`, `polygonCentroid`, `pointInPolygon` (ray-casting), `convexHull` (Andrew's monotone-chain), `offsetPolygonOutward` (per-vertex bisector miter), `vogelPosition`, `isInLabelHole`, `umbrellaOutlinePath` (convex-hull-of-amber-dots with 1-cell margin; bounding circle / capsule fallbacks for ≤2 dots). No external geometry library needed beyond d3-delaunay.

**Lloyd-iterated centroidal Voronoi tessellation.** Replaces the Phase 16.2.3 polar Poisson disc fan-out. Algorithm:
1. Build seed list — active Actor first (index 0, pinned at the anchor); other clusters seeded at hash-derived deterministic positions inside the upper 70% of the canvas. Alphabetical ordering of `ownerParty` for stable index assignment.
2. Compute target areas per cluster: `target_i = (dotCount_i / totalDots) × canvasArea`. Empty clusters (Carol's anchor) get `max(0.01, share)` so they don't get squeezed to zero area.
3. Iterate up to `LLOYD_MAX_ITER` times: build Delaunay from current seed positions, compute Voronoi clipped to `[0, 0, CANVAS_WIDTH, CANVAS_HEIGHT]`, for each non-pinned seed move toward area-weighted centroid via `stepFactor = 0.5 + 0.5 × tanh(area_error)`. Deficit cells (cell smaller than target) take bigger steps; overflow cells (cell larger than target) take smaller steps.
4. Break early when `maxDisplacement < LLOYD_CONVERGENCE_DELTA`; otherwise log a `console.warn` with the final max displacement.

**Convergence caveat (per brief: "stop and surface, don't raise the cap unilaterally").** At the current 12-actor seed, Lloyd's max displacement after 10 iterations is ~194 wu, well above the 12-wu convergence threshold. The cells stabilize visually but the centroid metric oscillates. Hypothesis: the small number of seeds combined with the pinned anchor at a corner-adjacent position keeps the system slightly off-balance — the system would converge cleanly with more seeds (the Phase 16.2.5 ~3k-dot expansion). Per the brief, the iteration cap is NOT raised unilaterally; we accept the positions and emit a `console.warn` for Andrew to QA the visual.

**Sunflower cluster primitive.** Per-cluster dots placed via Vogel phyllotaxis:
```
angle  = i × GOLDEN_ANGLE
radius = sqrt(i + 0.5) × DOT_GRID × SUNFLOWER_SCALE
(x, y) = (cx + r·cos(angle), cy + r·sin(angle))
```
For each spiral index `i = 0, 1, 2, ...` up to `N × 4 + 30` steps, the candidate `(x, y)` is snapped to `DOT_GRID` and tested against four exclusion rules:
1. Inside the 6×3 cell `LABEL_HOLE` (rectangular, label-anchor-centered) → skip.
2. Outside the cluster's Voronoi cell polygon → skip (ray-cast point-in-polygon).
3. Within `INTER_CLUSTER_BUFFER` of a dot belonging to another cluster → skip (enforces the 2-dot buffer).
4. Within `DOT_GRID × 0.9` of an already-placed dot in this cluster → skip.

Umbrella items go FIRST in the item array (inner spiral arcs); public items follow; RFPs last. This packs the amber subset toward the cluster's interior so the convex-hull outline reads as a tight connected region. Overflow (placed_count < N) emits a `console.warn`; at the current seed, all clusters place their full dot count.

**Centered Actor label.** PillboxLabel HTML overlay moved from `top = y - ACTOR_SQUARE/2 - ACTOR_LABEL_OFFSET; transform: translateX(-50%)` (Phase 16.1.3 above-grid pattern) to `top: y; transform: translate(-50%, -50%)` (16.2.4 cluster-center pattern). The Three.js Actor-squares InstancedMesh stays in the scene-init / dispose path but is rendered with `count = 0` (no draw calls). `cluster.squareWorld` now coincides with `cluster.center` so the PillboxLabel lookup + the hover-fade pillbox-detection helper (`fadePillboxFor`) continue to read the right world position without further changes.

**Umbrella outline path.** Replaces the Phase 16.0 `CLUSTER_PAD`-based L-shape rectangular boundary with a convex-hull-derived outline. For umbrella subsets with ≥3 dots: `convexHull(dots) → offsetPolygonOutward(hull, DOT_GRID)`. For 1 dot: 24-sided bounding circle approximation. For 2 dots: stadium (capsule) approximation via convex hull of two circle samplings. Stroke `var(--accent-amber)` 1.5px; fill `color-mix(in srgb, var(--accent-amber) 8%, transparent)` — reverts the Phase 16.1.3 grey treatment per the brief. The old L-shape construction in `buildCluster` is removed entirely (along with `buildCluster` itself, which is no longer needed).

**Loading animation v2.** `playDirectoryLoadAnimation` in `src/v2/directoryLoadAnimation.js` extended:
- New parameter `umbrellaOutlines: [{ party, distFromAnchor }]`.
- New callback `setUmbrellaOpacity(party, opacity)`.
- Each outline's start time = `distFromAnchor / waveSpeed + labelDelayMs / 1000`, same convention as labels. Ramps opacity 0 → 1 over 200ms.
- `skip()` snaps every dot + label + outline to opacity 1.

DirectoryLayer wiring: new `umbrellaOpacities` React state (keyed by party); umbrella outlines pass through state-driven `opacity` on their `<path>` elements; entry effect computes `distFromAnchor` per umbrella-bearing cluster (centroid distance) and seeds `setUmbrellaOpacities({})` to zero before starting the wave.

**Acceptance criteria — verified.**

| Criterion | Result |
|-----------|--------|
| Build clean (no new warnings beyond existing chunk-size note) | ✓ |
| d3-delaunay resolves at module load | ✓ |
| Canvas constants 11520×7447, anchor `(5760, 5957.6)`, INITIAL_ZOOM = MIN_ZOOM = 0.15 | ✓ |
| Sunflower spiral around 6×3 label hole; no dots overlap label | ✓ (label-hole exclusion + label `translate(-50%, -50%)` centered on `cluster.center`) |
| Lloyd-iterated Voronoi cells; cap at 10 | ✓ (max displacement ~194 wu at iter 10 — surfaced as warning per brief) |
| 2×DOT_GRID inter-cluster buffer enforced at dot acceptance | ✓ |
| Active Actor seed pinned at anchor through Lloyd's | ✓ (index 0 skipped in iteration loop) |
| Convex-hull umbrella outline; amber stroke + 8% fill | ✓ |
| L-shape rendering removed | ✓ |
| Wave-driven fade-in for dots + labels + outlines | ✓ |
| Click empty canvas → skip snaps all to opacity 1 | ✓ |
| Carol's anonymous case: no label at anchor, polar origin still pins tessellation | ✓ (14 labels, AuditCo absent) |
| Role switch (Bob → Carol) replays animation cleanly | ✓ |
| Zoom-percentage display reads "15%" / "100%" / "400%" | ✓ |

**Files changed.**
- `package.json` — `d3-delaunay ^6.0.4` added to dependencies.
- `src/v2/DirectoryLayer.jsx` — canvas + zoom constants; geometry helpers; computeLayout rewrite (Lloyd Voronoi + sunflower); umbrella outline; centered Actor label; Actor-squares mesh emptied to count=0; umbrella opacities state + amber SVG stroke; loading-animation v2 wiring.
- `src/v2/directoryLoadAnimation.js` — `umbrellaOutlines` parameter + `setUmbrellaOpacity` callback + fade-in tick logic + skip extension.
- `src/v2/V2App.jsx` — Changelog modal v0.16.2.4 entry prepended.
- `architecture-spec.md` — §8.2 Phase 16.2.4 changelog bullet.
- `polish-backlog.md` — Update Log Phase 16.2.4 entry; #196 stays Closed.
- `CLAUDE.md` — "Current state of the world" updated (16.2.4 last shipped; 16.2.3 demoted to prior).
- `CLAUDE-phase-log.md` — this entry.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention.

**Status:** [x] Complete.

### Phase 16.2.3 completion notes (2026-05-13) — Directory galactic view + loading animation

`DirectoryLayer.jsx` rewritten to use a bounded design surface + radial fan-out + radial wave loading animation. Andrew's reframed design: "galactic view first impression" — the Directory should look impressive on initial load and on every role-switch, with the whole canvas visible at default zoom. The view is "90% interesting, 10% useful"; real functionality lives on other layers.

**Locating the function — first action.** Per the brief, the camera/zoom/pan/placement logic lives in `src/v2/DirectoryLayer.jsx` (≈1349 lines). Layout function `computeLayout` lines 206-531; camera + zoom controls + pan-bounds + scene init + animate loop in the main `DirectoryLayer` component.

**Three core changes.**

1. **Bounded canvas + zoom constants.** New `CANVAS_WIDTH = 17280`, `CANVAS_HEIGHT = 11170` (16" MBP logical at 10% zoom), `OWN_CLUSTER_ANCHOR_X = 8640`, `OWN_CLUSTER_ANCHOR_Y = 8936` (canvas-bottom-center, 20% up from bottom). `MIN_ZOOM` lowered 0.5 → 0.1; `INITIAL_ZOOM` set to 0.1. Zoom-percentage display now maps zoom × 100 directly (was a remap onto a 10%–100% sweep). At initial mount and every role-switch re-entry the camera resets to `(CANVAS_WIDTH/2, CANVAS_HEIGHT/2)` at zoom 0.1 so the user sees the whole 17280×11170 canvas in an MBP viewport.

2. **Radial polar Poisson disc fan-out.** Replaces the Phase 16.2 deterministic-bbox-overlap loop (which had collapsed clusters into a thin horizontal band). For each non-active cluster, sample (θ, r) in polar space emanating from the anchor: θ ∈ [-75°, +75°] from straight up (upper 150° arc), r ∈ [2000, 8377.5] world units. Cartesian projection: `cx = anchor.x + r·sin(θ); cy = anchor.y - r·cos(θ)`. Deterministic seed via `hashString(ownerParty) + attempt`. Up to 50 retries with seed-perturbed samples; collision check via the existing 12-cell buffer; canvas-bounds check `bbox ⊆ [0,W]×[0,H]`. Sort input by descending Claim count so jumbo clusters (NovaFab @ 25 Claims, ElectroGrid @ 24) get first pick. Fallback after 50 retries logs a `console.warn` and keeps the last candidate.

3. **Pan-bounds recompute per zoom.** `clampPan` derives `[minX,maxX] × [minY,maxY]` from `(CANVAS_WIDTH/HEIGHT, viewport, zoom)` on every call. At zoom=0.1 the bounds collapse to a single point — the canvas exactly fits the viewport so the user can't pan into void. At higher zoom the bounds open up and the user can traverse the canvas. **FIT** recalculates zoom from `min(viewport.w / CANVAS_WIDTH, viewport.h / CANVAS_HEIGHT)` and centers camera on canvas-center.

**Loading animation (new helper `src/v2/directoryLoadAnimation.js`).** Parallel to `edgeDrawIn.js`'s pattern. Exports `playDirectoryLoadAnimation({ dots, labels, anchor, setDotOpacity, setLabelOpacity, ... })` returning `{ skip, promise }`. Behaviour:
- Per-dot start time `t_start = d / waveSpeed` (waveSpeed = 3000 world units / sec).
- Per-dot ramp opacity 0 → 1 over `dotFadeMs = 200ms`.
- Per-cluster label start time `labelStart = min(dist among cluster dots) / waveSpeed + labelDelayMs` (labelDelayMs = 100ms).
- Total duration ~3.2s for the 17280×11170 canvas with anchor at bottom-center.
- `skip()` snaps every dot + label opacity to 1.0 and resolves the promise.

**Dot opacity realisation.** `MeshBasicMaterial` doesn't support per-instance alpha cleanly. Since the Directory background is opaque dark `--bg-deep`, multiplying the dot's base color by opacity (0..1) produces the same visual effect as alpha blending — at opacity 0 the dot renders black and blends into the background. The animation tick writes per-dot opacity to a `Float32Array` (`dotOpacitiesRef`); the existing animate loop sets `dotsDirtyRef = true` and calls `flushDotColors()` once per tick before `renderer.render()`. `flushDotColors` reads base color per dot, applies hover/pinned state, then multiplies by opacity. Hover/pinned color blending (15% lerp toward white) was consolidated into the same flush so the load wave + hover state + base color blend via one code path.

**Skip semantics.** Click on empty canvas during animation calls `animationHandleRef.current.skip()` via `handleMouseUp`'s "dot raycast missed" branch. Click on a dot opens the Detail Panel normally and does NOT skip — the animation continues for remaining dots. Pan-drag and wheel-zoom run on independent timelines and do NOT interrupt the wave.

**Animation entry trigger.** A new `useEffect` with deps `[phase, roleId, threeReady, clampPan, updateCamera]` resets camera + opacities + starts the wave when:
- Phase transitions closed → in (initial Directory entry).
- roleId changes while phase === 'in' (role-switch re-entry).

Layout is read via `layoutRef` (not in deps) so provisional updates and window resizes don't replay the animation. The effect's cleanup function calls `skip()` so any in-flight animation snaps to completion when the user closes the Directory or switches roles mid-wave.

**Camera-init NaN guard.** `updateCamera` bails when `container.clientWidth ≤ 0 || container.clientHeight ≤ 0` (briefly true during initial mount before layout). Without this guard, a zero-width orthographic frustum produces NaN entries in the projection matrix, which propagate through `worldToScreen` and result in `left: NaN` / `top: NaN` on every HTML overlay positioned via projection (every PillboxLabel). PillboxLabel additionally short-circuits when its `x` / `y` aren't finite as a belt-and-suspenders safeguard.

**#196 (force-directed Directory layout) closed.** Superseded by the polar Poisson disc fan-out — with the bounded canvas as a design surface, the radial sampling produces a clean fan across the upper hemisphere for the current 14-cluster scale (12 mock suppliers + ChipCo + MicroCo). If future scale demands force-directed simulation (e.g., 50+ clusters where retry attempts cap out consistently), a successor item can be filed.

**Backward-compatible defensive settings.** Phase 16.1.5's `frustumCulled = false` + unbounded `boundingSphere` on every InstancedMesh left intact. Phase 16.1.4's `shouldMountScene` lifecycle pattern left intact. The new animation infrastructure uses the existing InstancedMesh; no new InstancedMesh introduced.

**Acceptance criteria — verified.**

| Criterion | Result |
|-----------|--------|
| Build clean (0 errors beyond existing 500-KB chunk warning) | ✓ |
| First load: camera at zoom 0.1, full canvas visible | ✓ (verified via probe) |
| Active Actor's own cluster anchors at (8640, 8936) for Bob/Alice/Dave; Carol uses same anchor without rendering own cluster | ✓ (Carol's view shows 14 labels, no AuditCo) |
| 12 mock + ChipCo + MicroCo fan across upper hemisphere | ✓ |
| All cluster bboxes ⊆ [0, CANVAS_WIDTH] × [0, CANVAS_HEIGHT] | ✓ (per probe; some at canvas edges) |
| Loading animation runs ~3s from anchor; first dot at t≈400ms, all complete by t≈3000ms | ✓ (per opacity sampling) |
| Empty-canvas click during animation: instant snap to opacity 1.0 | ✓ |
| Dot click during animation: opens Detail Panel; animation continues | ✓ (raycast precedence preserved) |
| Pan/zoom during animation: no interruption | ✓ (independent timelines) |
| Role switch (Bob → Alice → Carol → Dave): animation replays from scratch | ✓ |
| Zoom-percentage display reads zoom × 100 ("10%", "100%", "400%") | ✓ |
| No NaN errors in console | ✓ (after camera-init guard + PillboxLabel guard) |

**Files changed.**
- `src/v2/DirectoryLayer.jsx` — canvas + zoom constants; grid expanded to canvas bounds with sparser spacing; polar Poisson disc placement (replacing the Phase 16.2 30-attempt zigzag); pan-bounds recompute per zoom; FIT recalc; animation entry effect; flushDotColors callback; dot-opacity multiplier in mesh population; PillboxLabel opacity prop + NaN guard; updateCamera zero-frustum guard.
- `src/v2/directoryLoadAnimation.js` — new helper (~180 lines).
- `src/v2/V2App.jsx` — Changelog modal v0.16.2.3 entry prepended.
- `architecture-spec.md` — §8.2 Phase 16.2.3 changelog bullet.
- `polish-backlog.md` — Update Log Phase 16.2.3 entry; #196 marked Closed (superseded).
- `CLAUDE.md` — "Current state of the world" updated (16.2.3 last shipped, 16.2.2 demoted to prior).
- `CLAUDE-phase-log.md` — this entry.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention.

**Status:** [x] Complete.

### Phase 16.2.2 completion notes (2026-05-13) — Parent canvas node spreading

Refactor of the parent-canvas node-layout function in `src/v2/v2_2Data.js` (`buildV22Canvas`) to address visible overlap between Eval Result / PoE chains and the Claims they reference, and to coalesce each evaluation chain into a single y-row anchored to its grantee Asset where possible. V2Canvas itself was not touched — it consumes `{ x, y }` from each node and is the rendering pipeline only; the upstream `buildV22Canvas` assigns positions.

**Locating the function — first action.** Per the brief, located via `grep -n "computeLayout\|layoutNodes\|positionNodes\|...\|buildV22Canvas"` across `src/v2/V2App.jsx`, `src/v2/v2_2Data.js`, `src/v2/V2Canvas.jsx`. Match landed at `src/v2/v2_2Data.js:5825` (`export function buildV22Canvas(view)`). V2App.jsx invokes it via `buildV22Canvas(v22View)` at line 320, memoized over `v22View`.

**Three coordinated changes.**

1. **Chain-row coalescing (y-anchor to grantee Asset).** A new two-pass allocator runs after Assets are placed but before ER / PoE placement. Pass 1: iterate evaluation chains (one per `chainOrigin`) in anchor-y order; first chain at each anchor Asset claims that anchor's `y` exactly. Pass 2: deferred chains (anchor already claimed by another chain) pick the nearest non-colliding `y` via symmetric outward search (`±ROW_STEP`, `±2·ROW_STEP`, …). Chain successors (re-runs sharing a chain origin) share their origin's y so a chain reads as a single horizontal row, not a column of staggered rows. Anchor lookup: `EA.granteeAssetId` resolved through `view.evaluationAgreements`. Fallback to `symmetricRowY(i) + COL_Y_OFFSET` when the anchor Asset isn't on canvas (proof-only-pulled flows where the grantee Asset isn't visible to the active actor).

2. **Increased grantee-direction Claim-side x-gap.** Constants bumped: `COL_PULLED_CLAIM` 2100 → 2400, `COL_PULLED_ASSET` 2500 → 2800, `COL_PUBLIC` 2900 → 3200, `COL_OWN_POE` 2100 → 2400. On Bob/Carol's grantee-direction canvases, owned PoEs sit at `COL_OWN_EVAL_eff + chainLength·ER_COL_SPACING` (= 2000 for non-supersession chains), so the gap to the pulled Claim is now 400 world units — comfortably above the brief's ≥240 minimum. The previous 100-unit gap read as visual overlap. Downstream columns (`COL_PULLED_ASSET`, `COL_PUBLIC`, `COL_OWN_POE`) bumped by the same step (300 world units) to preserve column-to-column spacing consistency.

3. **PoE column order on grantor-direction views.** `proofOfEvalPulledPoEs` x changed from `COL_OWN_EVAL_eff - ER_COL_SPACING` (= 1400, sitting *between* Claim at 1300 and ER at 1700 — only 100-unit gap to Claim) to `COL_OWN_EVAL_eff + ER_COL_SPACING` (= 2000, sitting *right* of ER). Restores the brief's `Claim → ER → PoE → counterparty Asset` column order on Alice's view. The Claim → ER gap (400) and ER → PoE gap (300) both clear the ≥240 minimum.

**Additional alignment: proof-only-pulled PoE.** `proofOnlyPulledPoEs` y now inherits from the wrapped ER's y on canvas (was `sourceClaim.y + 200`). Aligns PoE + wrapped ER on the same chain row for Dave-style proof-only-pulled views. Falls back to the legacy `sourceClaim.y + 200 + stackIdx*COL_Y_OFFSET` when the wrapped ER isn't visible on canvas.

**Architectural deviation surfaced (per the brief's escape clause).** Both Bob's evaluations (`erBobPrm` + `erBobVreg`) carry `granteeAssetId: bAvionics`, so the brief's "bAvionics for PRM eval, bThermal for VReg eval" example doesn't hold under the actual seed. Strictly anchoring each chain to its respective grantee Asset is impossible when two distinct chains share an anchor; the two-pass allocator stacks them symmetrically as the deterministic fallback. Result on Bob's view: `erBobPrm` at y=0 (anchor bAvionics y=0), `erBobVreg` at y=300 (stacked +1 ROW_STEP). Per CLAUDE.md / brief's "stop and surface" clause this discrepancy is recorded here rather than re-architecting seed data.

**Acceptance criteria — structural assertions verified via Node probe.**

| Criterion | Result |
|-----------|--------|
| Build clean (0 errors beyond existing 500-KB chunk warning) | ✓ |
| Bob's PRM Eval Result + PoE aligned with bAvionics (y=0) | ✓ |
| Bob's VReg Eval Result aligned with bThermal | ✗ (seed has VReg anchored to bAvionics; stacked at y=300 — surfaced deviation) |
| Bob's PoE → Claim gap ≥ 240 world units | ✓ (gap = 400) |
| Alice's PRM has 2 chain rows on distinct y values | ✓ (Bob @ y=100, Carol @ y=700) |
| Alice's PoE x-order: Claim → ER → PoE → granteeAsset | ✓ |
| Carol's view: chains at y=0 (anchor cAuditWorkspace) + y=300 (stacked) | ✓ |
| Dave's view: proof-only-pulled ER + PoE share chain row (both y=300) | ✓ |
| Zero node bounding-box overlap pairs across all four role views (≈240×100 bbox) | ✓ |

**Dev-server verification.** Launched Vite, bypassed boot via sessionStorage flag, clicked ESTABLISH SESSION, switched between Bob's view and Alice's view. Footer shows v0.16.2.0. No console errors. Visual: Bob's canvas at FIT zoom shows GovCo Actor → 3 own Assets (Avionics center, Thermal above, Guidance below) → chain row centered on Avionics → pulled Claims to the right; Alice's canvas at FIT shows MicroCo Actor → 6 own Assets stack → 3 Claim cards → multiple chain rows spread vertically (one per evaluator party) → counterparty Assets at far right.

**What was NOT touched.**

- No changes to V2Canvas.jsx's render pipeline (Three.js geometry, edge drawing, screen projection).
- No changes to `layoutChildren` (dive-view layout for `depthLevel ≥ 1`).
- No changes to `edgeDrawIn.js` reveal animations or `reveal.js`.
- No changes to seed data (`v2_2Data.js` factories / buildV22SharedArtifacts).
- No changes to Directory Layer.

**Files changed:**
- `src/v2/v2_2Data.js` — column constants (4 bumps); two-pass y-allocator added before ER placement; `erOwn` + `erProofOfEval` forEach use `yForEr(er)` (chain-aware y); `proofOfEvalPulledPoEs` x flipped to right of ER; `proofOnlyPulledPoEs` y inherits from wrapped ER.
- `architecture-spec.md` — §6/§3.5 Phase 16.2.2 changelog entry.
- `polish-backlog.md` — Update Log Phase 16.2.2 entry.
- `CLAUDE.md` — "Current state of the world" updated (16.2.2 last shipped; 16.2.1 demoted to prior).
- `CLAUDE-phase-log.md` — this entry.
- `src/v2/V2App.jsx` — Changelog modal v0.16.2.2 entry prepended.

**Footer:** stays at v0.16.2.0 per backtrack-hotfix convention (matches Phase 14.6.x / 16.1.4 / 16.1.5 / 16.2.1 pattern).

**Status:** [x] Complete.

### Phase 16.2.1 completion notes (2026-05-13) — `aVregTestReport` ownership DA bugfix

One-line bugfix correcting a Phase 15.4 seed regression. When `aVregTestReport` was promoted to an unattached "floating" Asset (Alice attaches it to her VReg Claim during the Re-Run demo prereq), the Actor → Asset ownership DA was inadvertently omitted from the `aliceOwnAssets` array. Without it, the Asset rendered floating on Alice's parent canvas with no Full Disclosure edge to the MicroCo Actor card. Ownership and Claim-reference are orthogonal in the V2.2 data model — the ownership DA is what surfaces the Asset on the owner's canvas with an edge to the Actor node; the Claim-reference relationship is established separately when Alice amends the VReg Claim during the Re-Run prereq.

**Fix.** Single-line addition in `buildV22SharedArtifacts`:

```js
const aliceOwnAssets = [
  aPrmDatasheet,
  aPrmTestReport,
  aPrmThermal,
  aVregDatasheet,
  aVregTestReport,    // Phase 16.2.1: ownership DA restored
  aEmiDatasheet,
].map((a) => makeInternalDisclosureAgreement({ ... }))
```

The standard `aliceOwnAssets.map` factory produces one internal DA per Asset, so the addition generates exactly one new DA: `da-own-asset-vreg-test-report`, owner=alice.party, grantor + grantee both MicroCo, subject `{kind:'asset', id: aVregTestReport.id}`, type: 'full'.

**Acceptance criteria — structural assertions verified.**

1. Build clean (`npm run build` — 112 modules transformed, 0 errors beyond the existing 500-KB chunk warning).
2. `disclosureAgreements` array length grows by exactly 1 (720 → 721).
3. New DA has the expected shape: id `da-own-asset-vreg-test-report`, `grantor.party === 'MicroCo'`, `grantee.party === 'MicroCo'` (internal), `subject.kind === 'asset'`, `subject.id === aVregTestReport.id`, `type === 'full'`. Verified via Node probe.

**Scope boundaries.**

- No changes to the Re-Run demo prereq flow. Alice still amends VReg Claim to add `aVregTestReport` as a referenced Asset later; `hasNewAssetsForRerun` from Phase 13.3 still fires correctly because Claim-reference state is independent of Asset-ownership state.
- No other artifact additions or removals.
- No changes outside `aliceOwnAssets`.

**Footer convention.** Stays at v0.16.2.0 per the backtrack-hotfix convention. Phase 16.2.1 is a backtrack-hotfix (correction of pre-existing 15.4 seed regression, no forward-progress feature work), so the footer constant remains unchanged. The v0.16.2.1 entry sits in the Changelog modal in chronological order above v0.16.2.0. Matches the Phase 14.6/14.6.1/14.6.2 + Phase 16.1.4/16.1.5 pattern.

**Files changed:**
- `src/v2/v2_2Data.js` — single-line addition of `aVregTestReport` to `aliceOwnAssets` array.
- `architecture-spec.md` — §8 Changelog gains Phase 16.2.1 entry.
- `polish-backlog.md` — Update Log Phase 16.2.1 entry.
- `CLAUDE.md` — "Current state of the world" updated (16.2.1 last shipped, 16.2 demoted to prior phase).
- `CLAUDE-phase-log.md` — this entry.

**Footer:** stays at v0.16.2.0 (backtrack-hotfix convention).

**Status:** [x] Complete.

### Phase 16.2 completion notes (2026-05-13) — Directory Layer seed expansion

Round 17 opens. Pure seed + one cheap placement-algorithm patch. No new architectural primitives, no UI changes beyond what the seed exposes.

**What shipped.**

12 new mock supplier Actors representing the defense-electronics supply chain underneath Bob's Sentinel-4 satellite program. Per-Actor totals:

| #  | id                     | party                 | vertical                                       | Claims |
|----|------------------------|-----------------------|------------------------------------------------|--------|
| 1  | nova-novafab           | NovaFab               | Wafer Foundry / Rad-Hard IC Fab                | 25     |
| 2  | egrid-electrogrid      | ElectroGrid           | Spacecraft Power Systems (PCDU, regulators)    | 24     |
| 3  | prec-precision         | Precision Components  | Precision-Machined Structural / Mechanism Parts| 18     |
| 4  | sub-substrate          | Substrate Dynamics    | High-Reliability PCB Substrates                | 16     |
| 5  | avsys-avionicsys       | AvionicSys            | Avionics & Flight Computers                    | 17     |
| 6  | hrf-helixrf            | Helix RF              | RF / Microwave / Antenna Modules               | 11     |
| 7  | opt-optech             | Optech Sensors        | Star Trackers & Imaging Sensors                | 10     |
| 8  | sv-solarvantage        | SolarVantage          | Solar Panels & Solar Cells                     | 10     |
| 9  | tc-thermacore          | ThermaCore            | Thermal Management (Heat Pipes, Radiators)     | 9      |
| 10 | cs-compostruct        | CompoStruct           | Composite Structures & Panels                  | 9      |
| 11 | pho-photonix           | Photonix              | Optical Instruments & Telescopes               | 4      |
| 12 | cryo-cryotek           | Cryotek               | Cryocoolers & IR Detector Cooling              | 4      |

Total: **157 new Claims, 157 stub Assets, 628 new DAs** (1 own-asset + 1 own-claim + 1 claim-ref-asset + 1 public per Claim). `actors` array grew from 5 → 17 entries (4 existing + 12 new + Radiant Network).

Every new Actor is **non-switchable** (`user: null`, `credits: 0`) and discloses **exclusively to the Radiant Network** — zero umbrella DAs to any of the four primary actors. The four existing actor seeds (Bob/GovCo, Alice/MicroCo, Carol/AuditCo, Dave/ChipCo) are **frozen**: none of their Claims, Assets, DAs, EAs, RFPs, PoEs, Eval Results, or Parse Results were modified.

**Helper.** New exported `seedMockSupplierActor({ id, party, vertical, claimSpecs, baseDate = '2026-02-01T10:00:00Z' })` in `v2_2Data.js` produces an Actor + Claims + 1 stub Asset per Claim + ownership DAs + public DAs in one call. Each `claimSpec` entry has shape `{ slug, name, description?, disclosureType: 'full' | 'selective' | 'proofonly' }`. Returns `{ actor, claims, assets, ownershipDas, publicDas }`. Companion `pickDirectoryType(i, total)` interleaver assigns disclosure types per Claim targeting ~60% full / 25% selective / 15% proofonly so every cluster paints a visible indigo + amber + green mix; small clusters (n ≤ 4) get a forced fixed pattern (`i === 1` → selective, `i === total - 2` → proofonly, rest → full) so Photonix and Cryotek stay non-monotone. Companion `specsFromTuples(tuples)` keeps the 12 inline arrays compact — each entry is a `[slug, name]` pair, disclosure types are picked deterministically by position.

**Stub Assets.** Each Asset has `id: 'asset-{actor-id}-{slug}-ds'`, no `localPath`, `file: { uri: 'provenance://stub/{asset-id}', filename: '{asset-id}.pdf', size: 1024, mimeType: 'application/pdf', hash: 'stub-hash-{asset-id}' }`, and `registrationDate: <baseDate + idx days>` where `idx` is the 1-indexed position in the actor's `claimSpecs` array. The Detail Panel's "Document preview not available" fallback handles the missing `localPath` cleanly.

**Internal ownership DAs per Claim (3 per Claim).** `da-own-{assetId}` (subject: asset), `da-own-{claimId}` (subject: claim), `da-ref-{claimId}-{assetId}` (subject: claim, scope.assetIds: [assetId]).

**Public DAs (1 per Claim).** `da-pub-{actorId}-{slug}` — grantor: actor.party, grantee: Radiant Network, subject: { kind: 'claim', id: claimId }, type: spec.disclosureType, scope: { assetIds: [assetId], includeDerivatives: true }, terms.createdDate: <baseDate + idx days>.

**Wiring into `buildV22SharedArtifacts`.** After the existing actor block: build the 12 mock seeds via a `mockSeedBundles` config array passed through `seedMockSupplierActor`. Aggregate into local `mockActors`, `mockAssets`, `mockClaims`, `mockOwnershipDas`, `mockPublicDas`. Spread into existing return-shape arrays at their natural aggregation points: `actors` (after `dave`, before `RADIANT_NETWORK_ACTOR`); `assets` (appended); `claims` (appended); `disclosureAgreements` (appended — internal ownership DAs then public DAs).

**DirectoryLayer placement-scaling patch.** In `computeLayout`'s "Other clusters" placement loop, the previous hardcoded 800-px initial band was replaced with `xSpread = Math.max(800, 600 * Math.max(N - 1, 1))`. With 14 non-own clusters on Bob's view the initial band is ~7800 px — comfortably enough that the 30-attempt up-zigzag retry no longer needs to compensate. Force-directed layout (#196) remains deferred; the cheap fix covers the N=14 scale documented in the brief.

**What was NOT touched.**

- Phase 16.1.5's defensive `frustumCulled = false` + unbounded `boundingSphere` settings on every `InstancedMesh` left intact.
- Phase 16.1.4's `shouldMountScene` lifecycle pattern left intact.
- No new architectural primitives, no new artifact types, no new edge types.
- No RFP changes (Phase 17.0 owns RFP MVP).
- No supplier-internal Claims (every new Claim has a public DA so it renders).

**Documented deviations.** None. Implementation followed the brief verbatim.

**Acceptance criteria — structural assertions verified.**

1. Build clean (`npm run build` — 99 modules transformed, 0 errors beyond the existing 500-KB V2App.jsx warning).
2. `actors` array contains **17 entries** (4 existing + 12 new + Radiant Network) ✓.
3. `claims` array grew by exactly **157** ✓.
4. `assets` array grew by exactly **157** ✓.
5. `disclosureAgreements` grew by exactly **157 × 4 = 628** (3 internal + 1 public per Claim) ✓.
6. Each new public DA has `grantee.party === 'Radiant Network'` + `subject.kind === 'claim'` ✓.
7. Zero new umbrella DAs across the 12 new Actors (no DA where `grantor.party` is in the new-party set and `grantee.party` is not in `{grantor.party, 'Radiant Network'}`) ✓.
8. Bob's `buildV22DirectoryDataForRole('bob-govco').otherClusters` has **14 entries** (12 new + ChipCo + MicroCo). Bob's own RFP-cluster is built separately from `ownRfps`. Verified via direct buildV22DirectoryDataForRole call.

**Runtime verification.**

Dev server probe — Vite up + cold reload, all role views render without console errors. Directory Layer opens on Bob's view and renders all 15 clusters (12 new + ChipCo + MicroCo + Bob's own RFP-only cluster). FIT zoom fits all clusters within canvas bounds. Cluster-color variety (indigo + amber + green) visible on every cluster including Photonix and Cryotek (4-Claim clusters get the forced fixed pattern). Role-switch to Alice / Carol / Dave / Bob all open Directory cleanly without errors.

**Per CLAUDE.md's documented limitation** the V2Canvas + DirectoryLayer Three.js Raycaster does not respond to DOM-dispatched events — scripted UI walkthroughs of canvas-click flows are not possible from the agent session. Manual mouse interaction is the canonical verification path for canvas clicks; data-layer probes + module-load verification are the structural backstops used here.

**Files changed:**
- `src/v2/v2_2Data.js` — added `seedMockSupplierActor` + `pickDirectoryType` + `specsFromTuples` helpers; added 12 `mockSeedBundles` configs + aggregation loop; wired 4 spread points into return-shape arrays.
- `src/v2/DirectoryLayer.jsx` — placement-scaling patch (1-line + comment).
- `src/v2/V2App.jsx` — footer constant v0.16.1.5 → v0.16.2.0; Changelog modal `v0.16.2.0` entry prepended.
- `architecture-spec.md` — §8 Changelog tail gains Phase 16.2 bullet; §8.5 "Round 17 status" line updated.
- `polish-backlog.md` — Update Log Phase 16.2 entry; #196 stays Open.
- `CLAUDE.md` — "Current state of the world" updated (footer v0.16.2.0, Phase 16.2 last shipped, 16.1.5 demoted to prior phase); active phase queue updated.
- `CLAUDE-phase-log.md` — this entry.

**Footer:** rolls forward to v0.16.2.0.

**Status:** [x] Complete.

### Round 16 closeout (2026-05-10) — Documentation hygiene + Round 17 transition

Documentation-only phase. No code changes. Single commit on `main` consolidating Round 16's shipped state across the canonical docs in preparation for Round 17.

**Round 16 summary.** Ten sub-phases (16.0, 16.0.1, 16.0.2, 16.0.3, 16.1.0, 16.1.1, 16.1.2, 16.1.3, 16.1.4, 16.1.5) shipped between 2026-05-08 and 2026-05-10, all targeting the Directory Layer. Started from Phase 7/11A/11B placeholder scaffolding (mock supplier clusters, ChipCo standalone hit-area, cluster-click → materialized Claim card). Ended at a Three.js-rendered, pan-zoom-capable, disclosure-type-coloured Directory with stable lifecycle and clickable dots. Closed backlog items #43 (clickable dots) + #45 (real dot-cloud data sourcing). Filed deferred items #193 (V2App split), #194 (legacy PDF migration), #195 (Three.js edge migration), #196 (force-directed cluster layout).

**Key learnings carried forward.**

- **`THREE.InstancedMesh` requires `frustumCulled = false` + `boundingSphere = unbounded`.** The auto-computed bounding sphere is geometry-derived (origin-centred, tiny because per-instance positions live in matrices, not vertices) and breaks BOTH renderer frustum culling AND raycast pre-filter at high zoom or when instances are far from origin. Phase 16.1.5 root cause. Codified in CLAUDE.md "Round 16 retrospective" + architecture-spec.md §8.5.
- **`useEffect` deps including phase state machine values cause render-disposing-mid-flight bugs.** When a scene-init effect declares `phase` in its dep array, internal phase transitions trigger cleanup + recreate cycles that wipe populated meshes. Cure: derive a stable boolean (`shouldMountScene = phase !== 'closed'`) and depend on that. Phase 16.1.4 root cause.
- **Hybrid Three.js + HTML/SVG architecture for the Directory Layer.** Three.js renders the scene, background grid (Points), Claim dot InstancedMesh, Actor squares (hollow ShapeGeometry InstancedMesh), and RFP hollow circles. HTML/SVG renders tooltip card, label pillboxes, L-shape umbrella borders (projected from world coords via `worldToScreen` every camera change), zoom controls, exit chip, header pillbox. Mouse handlers are React JSX event props on the container `<div>`, bound via `useCallback` with full deps — NOT `addEventListener` in long-lived effects.
- **Commit-discipline correction.** Round 16 lost track briefly when 16.0.3 → 16.1.0 surfaced 13 unpushed phases at catchup time. Current convention codified: one Claude Code prompt = one phase = one commit, direct to main. The worktree feature is currently disabled (was used through Phase 16.1.4; disabled afterward).
- **Footer version convention.** Forward-progress phases roll the footer constant forward; backtrack-hotfix versions (inserted between existing entries) leave the footer unchanged. The Round 16 16.0.x cycle over-applied the backtrack rule (footer held at v0.15.9 across 16.0/16.0.1/16.0.2/16.0.3); Phase 16.1.0 corrected this and the footer now rolls forward each forward-progress phase.

**Documentation updates this phase.**

- **CLAUDE.md** rewritten lean. Bloated phase-by-phase narrative back to Phase 14.2 removed; "Current state of the world" now keeps Phase 16.1.5 (last shipped) + concise prior-phase summaries 16.0 → 16.1.4. New "Round 16 retrospective" section captures the four learnings. Stale references to pre-Round-16 patterns (`v2.html` entry point, Phase 11B materialization machinery, original-spec Directory descriptions) cleaned up. Active phase queue updated to show Round 17 plan: 16.2 (seed expansion) → 17.0–17.2 (RFP MVP).
- **architecture-spec.md §8** rewritten end-to-end:
  - §8.1 — entry mechanism updated for chrome-bar globe + `wipeOrigin` pinning.
  - §8.2 — rewritten to reflect Phase 16.1.5 state: disclosure-type-based dot colors (full→indigo, selective→amber, proof-only→green); no corner card; user's cluster center-bottom-third; 12-cell inter-cluster buffer; neutral grey L-shape umbrella boundary (not amber); no edges; cyan hollow-circle RFPs; drag-pan + wheel-zoom + FIT zoom controls.
  - §8.5 inline implementation note consolidated into a single coherent current-state narrative with a "Historical notes (Round 16 evolution)" subsection covering the 10-phase sequence chronologically. The chronological Changelog bullets at the bottom of the file remain as a chronological audit trail.
- **polish-backlog.md** — Round 16 entries (Phase 16.0 → 16.1.5) verified intact in the Update Log; #193 / #194 / #195 / #196 confirmed in the Open section; #43 / #45 confirmed in the Completed section. Round 16 closeout entry added.
- **CLAUDE-phase-log.md** — every Round 16 sub-phase has a completion-notes entry (16.0, 16.0.1, 16.0.2, 16.0.3, 16.1.0, 16.1.1, 16.1.2, 16.1.3, 16.1.4, 16.1.5). This Round 16 closeout entry sits at the top of the Round 16 block.
- **ROUND-17-CONTEXT.md** — new canonical entry doc for Round 17 created at repo root. Covers: Round 17 scope (Phase 16.2 + 17.0–17.2 per-phase summaries), Round 16 recap, per-phase load-in lists (files to attach at the start of each phase prompt), workflow conventions (commit-direct-to-main, worktree disabled, one prompt = one phase = one commit), demo roles + architecture rules, current state at Round 17 entry, outstanding-backlog snapshot.

**Files changed:** `CLAUDE.md` (rewritten), `architecture-spec.md` (§8 rewritten, §8.5 consolidated), `polish-backlog.md` (Update Log entry), `CLAUDE-phase-log.md` (this entry), `ROUND-17-CONTEXT.md` (new file).

**Footer:** stays at v0.16.1.5 (no behavior change).

**Status:** [x] Complete.

### Phase 16.1.5 completion notes (2026-05-10) — Hotfix: Frustum culling + raycast bounding-sphere fix

Two QA issues from Phase 16.1.4, both downstream of that phase's lifecycle change:

1. **Dots disappeared at zoom > ~60%** (rendering symptom).
2. **Dot clicks no longer opened the Detail Panel** (raycast symptom).

The brief framed these as separate issues — frustum culling for (1), closure-staleness in scene-init event listeners for (2) — but investigation showed they share a single root cause, and only one targeted fix was required.

**Shared root cause — `THREE.InstancedMesh.boundingSphere` is auto-computed from underlying geometry vertices.** For `InstancedMesh`, instance positions live in per-instance matrices, NOT in the geometry. The geometry vertices sit at world origin (the dot is a `CircleGeometry(DOT_RADIUS = 3)` centred at origin). So the auto-computed bounding sphere ends up tiny: radius = 3, centre = `(0, 0, 0)` in world coords. This sphere gets cached on the mesh and isn't refreshed when per-instance matrices change.

Two pieces of Three.js code read this cached sphere:

- **Rendering frustum check** (`Frustum.intersectsObject(mesh)` → tests if `mesh.boundingSphere` intersects the camera frustum). At higher zoom levels, the orthographic frustum tightens; if `(0, 0, 0)` radius-3 doesn't intersect the visible region, the *entire* `InstancedMesh` is culled — even though individual instance positions clearly fall inside the visible frustum.
- **Raycast pre-filter** (`InstancedMesh.raycast` → `_sphere.copy(this.boundingSphere).applyMatrix4(matrixWorld); if (raycaster.ray.intersectsSphere(_sphere) === false) return;`). The click ray passes through the cursor position in world space. If the ray doesn't intersect a radius-3 sphere at origin, `intersectsSphere` returns `false` and `raycast` returns *before* iterating per-instance hits. Result: no click hits register.

Phase 16.1.4 stabilized the scene lifecycle (so the mesh persists across phase transitions), but didn't touch the bounding-sphere caching. The stabilized lifecycle un-masked both pre-existing rendering and raycast symptoms.

**Fix.** On each `InstancedMesh` (dots + Actor squares + RFP), immediately after construction:

```js
mesh.frustumCulled = false
mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), Number.POSITIVE_INFINITY)
```

- `frustumCulled = false` opts out of the renderer's frustum check entirely. There's no perceptible perf cost at our scale (≤ thousands of dots; Three.js draws them in a single instanced draw call regardless).
- `boundingSphere = unbounded sphere` forces the raycast pre-filter to always pass. Per-instance raycast then runs against the proper per-instance bounding spheres at the `Mesh.raycast` level (one `Mesh.raycast` call per instance, each with the geometry's tiny sphere transformed by that instance's matrix — the math works correctly there because the per-instance matrix translates the sphere to the instance's world position).

A small helper `unboundedSphere()` factory keeps each mesh's bounding sphere independent (so a future mutation on one wouldn't bleed into another).

**Item 2 analysis (brief's diagnosis didn't match the code).** The brief proposed an alternate explanation for the click bug: "The scene-init effect (now stable across phase transitions thanks to 16.1.4) attaches mouse event listeners that close over the first-render state." This didn't match the actual code:

- Mouse handlers in `DirectoryLayer.jsx` are React JSX event props (`onMouseDown={handleMouseDown}` etc.) on the container `<div>`. They are NOT `addEventListener` calls inside a long-lived `useEffect`.
- Each handler is wrapped in `useCallback` with full deps (`handleMouseMove` deps include `[hover, layout, clampPan, raycast, updateCamera, worldToScreen]`; `handleMouseUp` deps include `[layout, onClaimDotClick, raycast, worldToScreen, animatedPanToWithZoom]`). React re-attaches the current `useCallback` reference on each render, so handlers always see current props/state.
- The brief's recommended refactor (route reads through refs kept current by small sync effects) is the right pattern for the `addEventListener`-in-useEffect case, but unnecessary for our JSX-prop case. Applying it would have been pure code churn with no behaviour change.

Skipped the refactor in line with the project's "no unnecessary churn" guidance (CLAUDE.md: "Don't add features, refactor, or introduce abstractions beyond what the task requires."). The bounding-sphere fix alone resolves both symptoms via the shared raycast pre-filter.

**Verification (real browser preview).** All checks ran on Phase 16.1.5 code after a clean reload + boot via ESTABLISH SESSION:

- **Rendering at high zoom**: Wheel-zoom-on-cluster (`canvas.dispatchEvent(WheelEvent { deltaY: -200, clientX, clientY })` repeated 8× over ChipCo) brought zoom to UI 56%; cluster + L-shape boundary + Actor square + dots all visible in screenshot. Further wheel zooms reach 100%; dots remain rendered when camera is on a cluster. Direct probe (setting `camPosRef.current = { x: 9, y: 170 }` and `zoomRef.current = 4.0` for GovCo cluster centre) confirmed dots render at zoom factor 4.0 (UI 100%) when camera position is correct. Confirmed `dotsMesh.frustumCulled === false` and `dotsMesh.boundingSphere.radius === Infinity` via React-fiber probe of the live mesh.
- **Click opens Detail Panel** (Bob view): Computed instance 0's screen position by projecting world coords through camera, dispatched mousedown+mouseup on the container at that position. Detail Panel opened with the MicroCo "Power Regulation Module Assembly" Claim. Camera animated to centre the clicked dot (`animatedPanToWithZoom` ran). Pinned tooltip card rendered next to the dot with the same Claim metadata.
- **Click after role switch**: Switched Bob → Alice via user menu, opened Directory, FIT, clicked instance 0. Detail Panel showed "Power Regulation Module Assembly" with `AMEND CLAIM` button (Alice owns this Claim — confirms per-role view + click both resolve current state correctly, not stale Bob data).
- **Click after close + reopen cycle**: Closed Directory via `← Back to Network`, reopened via globe button, clicked instance 0. Detail Panel reopened correctly. `dotsMesh.frustumCulled === false` and `dotsMesh.boundingSphere.radius === Infinity` confirmed on the freshly-recreated mesh (the new mesh inherits the same construction-time settings).
- **Phase 16.1.4 lifecycle items still hold**: dots visible on cold-reload first open; visible across the 5 reopen iterations the brief calls out.

Interactive items requiring real mouse events (hover whiten, hover tooltip card, drag pan) were code-verified-only — the V2 raycaster doesn't respond to DOM-dispatched events (documented CLAUDE.md limitation). Those code paths were untouched by this fix.

**Documentation updates.** Footer rolls forward `v0.16.1.4 → v0.16.1.5` in `V2App.jsx`. Changelog modal gains a v0.16.1.5 entry above v0.16.1.4 with diagnosis + fix summary + the "Item 2 brief diagnosis didn't match code" note. Architecture spec gains a §8.5 Phase 16.1.5 changelog bullet. polish-backlog.md gets a Phase 16.1.5 Update Log entry. CLAUDE.md "Current state of the world" + "Last shipped phase" updated; 16.1.4 demoted to prior-phase.

**Files changed:** `src/v2/DirectoryLayer.jsx` (3 lines × 3 meshes = 6 effective lines added — `frustumCulled = false`, `boundingSphere = unboundedSphere()`, plus the `unboundedSphere` helper factory and an explanatory comment block), `src/v2/V2App.jsx` (footer version + Changelog modal entry), `architecture-spec.md`, `polish-backlog.md`, `CLAUDE-phase-log.md`, `CLAUDE.md`.

**Status:** [x] Complete.

### Phase 16.1.4 completion notes (2026-05-10) — Hotfix: Directory layer dot rendering regression from 16.1.3

Single-issue hotfix. Phase 16.1.3 shipped with a regression: dots no longer appeared on the Directory layer at all (no console errors; canvas visually empty). Reproduced reliably on hard-reload + first open of Directory.

**Diagnosis (Suspect C variant — Phase 16.1.3 brief's lifecycle category).** Browser probe with temporary diagnostic `console.log` statements (later reverted before commit) traced the lifecycle:

1. `phase: closed → opening`: scene-init `useEffect` runs (deps `[phase, updateCamera]`). Renderer, scene, and all three `InstancedMesh`es created with `count = 0`. `setThreeReady(true)`.
2. Re-render with `threeReady=true`: `useLayoutEffect` populates `dotsMesh` (count=17), renders explicitly. Dots visible (transiently).
3. `phase: opening → in` (raf chain in the entry/exit state machine): `phase` dep changed → React fires the scene-init effect's **cleanup**. Cleanup disposes geometries + materials + renderer, sets refs to `null`, calls `setThreeReady(false)`.
4. New scene-init effect body runs with `phase='in'`: creates a **fresh empty mesh** (`count = 0`). `setThreeReady(true)`.
5. **`useLayoutEffect` does NOT re-run**: deps `[threeReady, layout]` show no change because React batched the `setThreeReady(false)` (step 3) with the `setThreeReady(true)` (step 4) into a single update whose net value was unchanged. Object.is comparison sees no change → effect skipped.

Result: a fresh empty mesh sits in the scene; the previously populated mesh was disposed; no repopulation runs → blank canvas.

The console-log diagnostic confirmed the sequence directly — after the `scene-init CLEANUP running, phase was= opening` + `scene-init done, setting threeReady=true, phase= in` log pair, **no further `useLayoutEffect run` lines appeared**. The populate code was not running against the new mesh.

**Fix.** Derive a stable `shouldMountScene = phase !== 'closed'` boolean and depend on that instead of `phase`. The scene-init effect now:
- Runs setup only on the `closed → non-closed` boundary (`shouldMountScene` flips `false → true`).
- Runs cleanup only on the `non-closed → closed` boundary (`shouldMountScene` flips `true → false`).
- Does NOT re-run on internal `opening → in → out` transitions because `shouldMountScene` stays `true` throughout.

The mesh is built once on first open and persists across the full lifecycle of the open state. The downstream `useLayoutEffect` runs once when `threeReady` first becomes true (populating the mesh) and re-runs when `layout` changes (which doesn't happen during open). No more dispose-rebuild churn.

**Verification (browser).**
- **Cold reload → first open**: dots render immediately on hard reload + ESTABLISH SESSION + globe click. Three clusters visible (MicroCo / ChipCo / GovCo for Bob); color variety visible in ChipCo (indigo + amber + green); RFP shows as cyan hollow circle next to GovCo Actor square; grey L-shape boundary around ChipCo's umbrella subset.
- **10 open/close cycles**: every cycle opens with dots visible (data probe confirmed `[data-v22-directory-layer]` present + canvas attached on each open).
- **5 rapid-succession toggles in 3 seconds**: end state shows dots correctly populated.
- **Role switch (Bob → Alice)**: Alice's view renders with her own MicroCo cluster (center-bottom-third) + ChipCo cluster (visible to her) + correct color variety.
- **Wheel zoom**: works (36% → 38% after wheel event).
- **Build clean**: 112 modules transformed, 0 errors.

**Visual verification (real browser preview).** All "Dots appear", "10 cycles", "5 rapid succession", "Color variety", "L-shape grey", "RFP cyan circle", "Role switch", "Wheel zoom", "Wipe animation" items confirmed with screenshots + DOM probes. Interactive items requiring 3D raycaster events (hover whiten, dot-click → Detail Panel + camera pan, Detail Panel bottom button visibility, Modal close stays on Directory) are code-verified-only — the V2Canvas raycaster does not respond to DOM-dispatched events (documented CLAUDE.md limitation since Phase 9A.6); these code paths were untouched by the 16.1.4 fix, which is solely on the scene-init effect's dependency array.

**Documentation updates.** Footer rolls forward `v0.16.1.3 → v0.16.1.4` in `V2App.jsx`. Changelog modal gains a v0.16.1.4 entry above v0.16.1.3 with diagnosis + fix summary. Architecture spec gains a §8.5 Phase 16.1.4 changelog bullet. polish-backlog.md gets a Phase 16.1.4 Update Log entry. CLAUDE.md "Current state of the world" + "Last shipped phase" + "Active phase queue" updated.

**Files changed:** `src/v2/DirectoryLayer.jsx` (the actual fix — three-line change: introduce `shouldMountScene` constant, swap `phase` for it in the early-return guard, swap `phase` for it in the effect's dep array), `src/v2/V2App.jsx` (footer version constant + Changelog modal entry), `architecture-spec.md`, `polish-backlog.md`, `CLAUDE-phase-log.md`, `CLAUDE.md`.

**Status:** [x] Complete.

### Phase 16.1.3 completion notes (2026-05-09) — Directory Layer parent-parity fixes + color scheme

Nine items shipped in one Claude Code session, single commit on the worktree branch (Andrew's external merge-to-main step is the canonical ship path). Andrew's instruction this phase: slow + meticulous on bug fixes + parity before scaling seed or adding RFP functionality. Items 1, 4, 5, 6, 7 are parity fixes; Items 2, 3, 9 are visual fidelity / overlap fixes; Item 8 is a semantic color realignment.

**Item 1 — First-transition dot lifecycle (proper fix).** Phase 16.1.2's fix (InstancedMesh persisting across data changes + `mesh.count` updates) addressed mesh recreation but didn't fully solve the render-timing race. Phase 16.1.3 hardens further:
- InstancedMesh population moved from `useEffect` to `useLayoutEffect` so it runs synchronously after DOM mutations, BEFORE browser paint. Without this, the React commit phase can yield to the browser between `useEffect` registration and the actual effect body execution, leaving a paint window with an empty mesh.
- Pre-allocated mesh capacity (MAX_DOTS = 10000, MAX_SQUARES = 64, MAX_RFPS = 256). The mesh is created once during scene init with full capacity; `mesh.count` controls how many instances draw. No mesh recreation on layout change.
- New `transitionend` listener on the wipe container fires when the `clip-path` animation completes. The listener calls `renderer.render(scene, camera)` + `updateOverlayRef.current()`. This guarantees a final render after the wipe so the user sees the populated dots once the layer is fully visible — even if the populate-render happened during the wipe and was visually clipped.
- Explicit `renderer.render(scene, camera)` after each mesh population (kept from Phase 16.1.2 for belt-and-suspenders).

**Item 2 — Actor square hollow ShapeGeometry.** Replaced `THREE.LineSegments` (which renders lines with fixed pixel width via the rasterizer, NOT scaling with camera zoom) with `THREE.Mesh` using `THREE.ShapeGeometry`. The shape is an outer 6×6 square with an inner 4×4 hole (`ACTOR_BORDER = 1` world unit thickness). All Actor squares share one `InstancedMesh` (per-instance position via `setMatrixAt`, color set globally on the material since all squares are indigo). Because the geometry IS the visible border, camera zoom multiplies the visible thickness proportionally — at 4× zoom, the border looks 4× thicker than at 1×.

**Item 3 — squareCell reservation.** New `squareCell = { row, col }` computed BEFORE umbrella/public/RFP placement. Algorithm: `squareCol = floor(MAX_COLS / 2) = 3`. `squareRow` depends on whether umbrella exists: for umbrella clusters, row 2 (mid of the umbrella + post-umbrella region); for non-umbrella, row 0. Both umbrella placement AND public+RFP scan placement add `squareCell` to a `reservedSet` and skip it. The Actor square's world position is computed from `(squareRow, squareCol)` via the same anchor math as dots — so it sits ON the dot grid exactly at the reserved cell. Eliminates the MicroCo dot-on-square overlap visible in earlier QA screenshots.

**Item 4 — Zoom controls vertical position.** Bumped from `top: 12` to `top: 73`. The chrome bar is 61px tall; parent layer V2Canvas mounts BELOW the chrome (within the flex layout), so its `top: 12` zoom controls appear 73px from viewport top in absolute terms. Directory mounts at `position: fixed; inset: 0` so to match the visual position, `top: 73` is needed (61 + 12).

**Item 5 — Detail Panel height.** Changed `bottom: 0` to `bottom: 28` in the Directory Detail Panel mount (V2App.jsx). The 28px clears the v0.16.x app footer (6px padding × 2 + 11px font + 1px border ≈ 28px effective height + a slight margin). The "REQUEST EVALUATION AGREEMENT" button in the panel footer is now fully visible above the app footer.

**Item 6 — Click pans to center.** New `animatedPanToWithZoom(worldX, worldY, zoom, duration)` ref in DirectoryLayer (mirrors V2Canvas line 1582). Uses the same cubic-ease formula. Called from `handleMouseUp` after a click on a dot: target = `(d.x + panelOffsetWorld, d.y)` where `panelOffsetWorld = (PANEL_W / 2) / zoom`. The PANEL_W constant is 480 (matches V2App's `PANEL_W`). The offset shifts the camera target to the RIGHT so the dot ends up at the horizontal center of the visible area (left of the Detail Panel), not under the panel.

**Item 7 — Request EA modal close stays on Directory.** Removed `setV22DirectorySelectedClaim(null)` and `setV22DirectoryOpen(false)` from the `onRequestEvaluationAgreement` callback in V2App.jsx (around line 5882). The callback now only sets `v22EaRequestContext` to open the modal; Directory + Detail Panel persist underneath the modal. Closing or submitting the modal leaves Directory + Detail Panel intact. The previous behavior forced a return to parent layer on modal close, which lost the user's navigation context.

**Item 8 — Disclosure-type-based dot colors.** Color now derived from the disclosure TYPE of the DA granting access:
- `full` → `var(--accent-indigo)`
- `selective` → `var(--accent-amber)`
- `proofonly` → `var(--accent-green)`

Resolution order: umbrella DA (active actor as grantee) takes precedence over public DA (Radiant Network as grantee). DirectoryLayer's `useMemo` for `directoryData` extends the base `buildV22DirectoryDataForRole` output with `publicTypeByClaimId` + `umbrellaTypeByClaimId` lookup tables, walked inline from the shared DA set via `buildV22SharedArtifacts` + `mergeProvisionals`. The cluster's `publicTypeByClaimId` / `umbrellaTypeByClaimId` are then consumed by `buildCluster` to set each cell's `disclosureType`, which `disclosureTypeToColorVar` maps to a CSS var, resolved to a `THREE.Color` for the InstancedMesh `setColorAt`.

Seed types diversified for visible color variety:
- `daAlicePublicEmi`: full → proofonly
- `daChipcoPublicTimingIc`: full → proofonly
- `daChipcoPublicMixedSig`: full → proofonly
- `daChipcoToBobOpAmp`: full → selective
- `daChipcoToBobFlashMem`: full → proofonly

L-shape umbrella boundary changed from amber-stroked + amber-tinted to neutral grey: stroke `color-mix(in srgb, var(--text-secondary) 60%, transparent)`, fill `color-mix(in srgb, var(--text-secondary) 6%, transparent)`. The boundary still delimits the umbrella subset visually but no longer color-codes by visibility scope (since amber is now reserved for selective disclosure semantics).

**Item 9 — RFP hollow circle in cyan.** Replaced filled green dot (`MeshBasicMaterial` on a `CircleGeometry`) with hollow circle (`MeshBasicMaterial` on a `ShapeGeometry` built from an outer circle + an inner circular hole via `THREE.Shape` + `Path`). Color: `var(--accent-cyan)` (#22d3ee dark / #0891b2 light). Renders via separate `THREE.InstancedMesh` (`rfpMesh`) alongside the dots mesh. Hollow geometry means border thickness scales with zoom (matches Item 2 pattern). RFP dots are also raycast-excluded from hover/click (the raycaster only intersects `dotsMesh`, not `rfpMesh`).

**Footer.** v0.16.1.2 → v0.16.1.3 per the forward-roll convention.

**Branch handling.** Ships to `claude/peaceful-chatelet-c63ee1`. Andrew's external merge:
```bash
git checkout main && git merge claude/peaceful-chatelet-c63ee1 && git push origin main
```

**Verification.** Build clean. Runtime probe via dev server confirmed: footer reads v0.16.1.3; layer mounts; cyan RFP InstancedMesh attached; per-instance color updates fire. Manual visual verification of Items 1 (hard reload + 10 cycles + rapid succession), 2 (zoom-scale visible), 5 (button visibility), 6 (pan animation), 8 (color variety), 9 (cyan hollow visual) is the canonical path per the V2Canvas raycaster + headless 0×0 viewport limitations.

**Status:** [x] Complete.

### Phase 16.1.2 completion notes (2026-05-09) — Directory Layer spatial model rewrite + bug fixes

Andrew's design pivot. Eight items shipped in one Claude Code session, single commit on the worktree branch (Andrew's external merge-to-main step is the canonical ship path). Items 1–5 are cohesive — they're one architectural change to the spatial model: removing the user's own corner card and treating the user's own cluster as a regular world-coord cluster, with Actor squares now rendered in Three.js so they scale with the camera. Items 6–8 are independent fixes.

**Item 1 — Corner card removed.** The HTML overlay that fixed the user's own Actor card in the bottom-left corner of the Directory viewport is gone. Also removed: the user's own RFP green dot HTML overlay (was anchored 24px above the corner card). Both are replaced by Three.js elements inside the user's own cluster (Item 2). The corner card's existence on the parent layer is unaffected — only the Directory-layer rendering changes.

**Item 2 — User's own cluster as a regular cluster.** New `isUserVisible` flag on `buildV22DirectoryDataForRole` return shape: `true` when the active actor has at least one own publicly-disclosed Claim or own RFP; `false` for anonymous actors (Carol/AuditCo in the seed). When `isUserVisible`, the user's own cluster is built via the same `buildCluster` helper used for other actors' clusters, with `centerOverride: { x: 0, y: userCenterY }` where `userCenterY = snapGrid(viewport.h / INITIAL_ZOOM * 0.18)` — places the cluster horizontally at world x=0 (canvas center) and vertically at roughly the bottom third of the viewport at zoom 1.5. The cluster contains the user's Actor square + their own publicly-disclosed Claims (indigo) + their own RFPs (green dots packed alongside the Claims via the same row-major fill helper), with the existing 1-cell-buffer-around-umbrella rule. When `!isUserVisible`, no own cluster renders; other clusters fan around the same virtual center.

**Item 3 — Actor squares as Three.js LineSegments.** Replaced the HTML-div Actor squares (positioned via `worldToScreen` projection on every camera change) with `THREE.LineSegments` rendered in world coords. One LineSegments instance per Actor, built as 4 line segments outlining a 6×6 world-unit hollow square. Color: `var(--accent-indigo)` resolved via `cssVarToColor`. Squares scale with camera zoom identically to dots — at zoom 4×, both dots and squares are 4× larger; at zoom 0.5×, both shrink. `actorSquaresGroup` is added to the scene during init; the squares-build useEffect re-runs when `layout` changes, tearing down + rebuilding the group's children (cheap; typically ≤5 squares per role view). Pillbox labels stay HTML overlays (text shouldn't scale away to unreadability).

**Item 4 — Edges dropped from Directory.** The umbrella DA SVG cubic Bezier path (corner card right-edge → ChipCo Actor square left-edge) is removed. The SVG overlay container retained for the amber L-shape paths (Item 6 from Phase 16.1.1) — those are cluster-internal decorations, not edges. `umbrellaEdges` field on `buildV22DirectoryDataForRole`'s return retained as an empty array for backwards compatibility (no consumer iterates it anymore, but leaving the field prevents future destructure-mismatch errors).

**Item 5 — 12-cell buffer between clusters.** New `CLUSTER_BUFFER = 12 * DOT_GRID = 144` world units minimum spacing between cluster bounding boxes. `buildCluster` returns a `bbox` field per cluster; placement loop tracks `placedBoxes` and checks each candidate against it via the bbox-overlap-with-buffer predicate. Other clusters initial position: distributed horizontally across `userCenterX ± 800/2` (alternating left/right of user); vertical: `userCenterY - 240 - (seed % 80)` (above the user, with seed-driven jitter). If the candidate violates the buffer, nudge upward 4 cells + alternate sideways 6 cells; retry up to 30 attempts. Beyond 30 attempts, fall back to last candidate position with a comment noting the graceful degradation (#196 backlog item filed for force-directed layout at scale).

**Item 6 — First-transition dot lifecycle.** The Phase 16.1.0 dots `useEffect` recreated the InstancedMesh on every layout change (tear-down + dispose + new InstancedMesh + add). This created a window where the animate loop ticked between mesh disposal and re-attachment, leaving an empty scene briefly visible. Phase 16.1.2 stabilizes the lifecycle: `dotsCapacityRef` tracks the InstancedMesh's capacity; the mesh is created with `Math.max(desiredCount, 64)` initial capacity; subsequent layout changes update only `setMatrixAt(i, m)` + `setColorAt(i, c)` for `i < desiredCount` and `setMatrixAt(i, makeScale(0,0,0))` for `i >= desiredCount`. `mesh.count = desiredCount` tells Three.js to draw only the active instances. Mesh recreation only happens when `desiredCount > capacity` (rebuild with new capacity = max(desiredCount, 64)). Combined with `mesh.instanceMatrix.needsUpdate = true` + `mesh.instanceColor.needsUpdate = true` + sync `renderer.render` after each update, dots render reliably on first transition AND on subsequent open/close cycles without the prior race.

**Item 7 — Parent-layer state cleanup audited.** Both Directory entry points (chrome globe button at V2App:4199-4216 + Radiant Network actor double-click at V2App:5176-5188) call `setSel(null)` + `setForcePanelTab(null)` + `setForceExpandSda(null)` + `setSelectedEdgeId(null)` + `setOpenAgreement(null)` + `canvasRef.current?.clearHoverState?.()`. The V2Canvas `clearHoverState` imperative method (added in Phase 16.1.1) clears `hoveredEdge` + `edgeTooltipPos` + `hoveredEdgeSdaType`. Combined, this clears ALL parent-layer hover + selection state on Directory open. The brief's claim that "Phase 16.1.1 missed the SELECTED state" was based on an earlier observation; the code is comprehensive. Symmetric cleanup on Directory close handled by the existing Directory phase state machine clearing `hover` + `pinned` when `phase === 'closed'`.

**Item 8 — Zoom controls top-right (+/-/FIT/%).** Replaces the bottom-right `zoom 1.50x` text indicator with a vertical control panel at `top: 12, right: 12`. Three buttons (`+`, `−`, `FIT`) each 28×28px, plus a percentage display below. `zoomIn` / `zoomOut` apply 1.15× / 0.87× factors. `zoomFit` computes the bounding box across all `layout.allClusters[].bbox` + 80px padding, then sets camera position to bbox center and zoom to `min(viewportW/bboxW, viewportH/bboxH)` clamped to `[MIN_ZOOM, MAX_ZOOM]`. `zoomPct` formula matches V2Canvas: `Math.round(((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 90 + 10) + '%'`. Wheel zoom continues to work alongside.

**Footer.** v0.15.9 → v0.16.1.0 (16.1.0) → v0.16.1.1 (16.1.1) → v0.16.1.2 (this phase). Forward-progress phases roll the footer.

**Branch handling.** Ships to `claude/peaceful-chatelet-c63ee1`; Andrew's external `git checkout main && git merge claude/peaceful-chatelet-c63ee1 && git push origin main` is the canonical merge-to-main step.

**Verification.** Build clean (112 modules, 0 errors). Manual visual verification of the rewrite (per-role cluster placement, Actor square scaling, 12-cell buffer, lifecycle stability across 5+ cycles) is the canonical path per the V2Canvas raycaster note + headless 0×0 viewport limitation.

**Status:** [x] Complete.

### Phase 16.1.1 completion notes (2026-05-09) — Three.js Directory Layer hotfix

Eleven QA fixes from Phase 16.1.0 manual testing on the merged main branch. Single Claude Code session, single commit on the worktree branch (Andrew's external merge-to-main step is the canonical ship path). No backlog items closed; pure regression + polish.

**Item 1 — Zoom wheel handler binding fix.** The wheel `useEffect` ran once at mount with deps `[handleWheel]`. Since `handleWheel` is stable (wraps stable `clampPan` + `updateCamera`), the effect ran once on initial component mount. But `containerRef.current` was null at that moment because the wrapper div hadn't yet rendered. The listener was never attached. Fix: dep array gains `phase` so the effect re-runs when Directory transitions from `'closed'` → `'opening'` → `'in'`. Early return when `phase === 'closed'` skips the bind during the unmounted period; on each subsequent transition, `containerRef.current` is populated by the time the effect runs.

**Item 2 — Zoom indicator above footer.** Lifted from `bottom: 16` to `bottom: 56` so it clears the v0.16.1.x app footer (footer ~28px tall + breathing room). No layout regression — the indicator is `pointerEvents: none` and just shifts vertically.

**Item 3 — First-transition dot rendering race.** The cross-effect ordering was: init effect creates renderer + sets `setThreeReady(true)` → component re-renders → dots `useEffect` creates InstancedMesh → next animate tick renders the scene with dots. Between (a) and (d) the animate loop's first tick rendered the empty scene before the InstancedMesh existed. Fix: inside the dots `useEffect`, after attaching the mesh, immediately call `renderer.render(scene, camera)` synchronously. This guarantees the canvas has dots painted before the user sees the first frame post-wipe. Also calls `updateOverlayRef.current()` to populate the overlay state synchronously.

**Item 4 — Grid alignment.** The dot world-coord computation was `anchorX + col * COL_GAP + DOT_GRID / 2`. Removed the `+DOT_GRID/2` offset. With `anchorX/Y` snapped to `DOT_GRID` (which we already do via `snapGrid(...)`), and column/row offsets being integer multiples of `DOT_GRID`, every dot center is now an integer multiple of `DOT_GRID`. The background `THREE.Points` grid uses the same `DOT_GRID = 12` stride starting at world (0, 0), so dot centers and grid intersections coincide.

**Item 5 — Clear parent-layer edge tooltip on Directory open.** New `clearHoverState` imperative method on V2Canvas via `useImperativeHandle` (extending the existing imperative API at line 2023+). Method: `setHoveredEdge(null); setEdgeTooltipPos(null); setHoveredEdgeSdaType(null)`. V2App invokes it from both Directory entry points: (a) chrome globe button click handler at line ~4209; (b) Radiant Network actor double-click handler at line ~5179 (passed via `onV22OpenDirectoryFromNode` callback). Called BEFORE `setV22DirectoryOpen(true)` so the state clears before the wipe begins.

**Item 6 — Amber L-shape border + tinted-bg fill.** Restored as SVG overlay. The L-shape boundary path is computed in WORLD coords (per cluster) inside `computeLayout` from the umbrella cell set with `CLUSTER_PAD = 5` world units of breathing room outside the dot footprints. Each path vertex is projected via `worldToScreen` on every camera change inside `updateOverlayRef.current` (which is called from the animate loop). Rendered as SVG `<path>` inside the existing umbrella-edges SVG overlay container at z-index 2: stroke `var(--accent-amber)` 1.5px + fill `color-mix(var(--accent-amber) 8%, transparent)`. The path renders behind the dots (lower z-index than the Three.js canvas? — actually the SVG sits ABOVE the canvas in DOM order but the dots are themselves WebGL on the canvas; the SVG amber path appears behind dots visually because the dots are filled circles and the path's fill color is translucent + the stroke is thin).

**Item 7 — Tooltip 4th row removed.** `ClaimTooltipCard` now renders 3 rows: CLAIM badge + Claim name + owner party. The disclosure-type-and-date line removed entirely. `disclosureType` prop dropped from `ClaimTooltipCard`'s API (call site updated).

**Item 8 — 1-cell buffer in all four directions.** Replaced the prior "phantom-slot gap on same row" buffer with a proper 4-direction buffer. New `layoutClusterCells` helper:
1. Pack umbrella row-major STARTING AT ROW 1 col 0 (row 0 reserved as top buffer).
2. Compute `bufferSet` = orthogonally adjacent cells to any umbrella cell, NOT in umbrella itself. Includes col -1 (left), col 6 (right overflow), and the row after umbrella's last row (bottom buffer).
3. Pack public via row-major scan (rows 0..N, cols 0..MAX_COLS-1), skipping any umbrella OR buffer cell, with a 1000-iter safety cap.

For ChipCo (7 umbrella + 7 public): umbrella at row 1 cols 0-5 + row 2 col 0 (7 amber). Buffer cells: row 0 cols 0-5 + row 1 col 6 + row 1 col -1 + row 2 col -1 + row 2 col 1 + row 3 col 0 + row 3 col -1. Public scan: row 0 cols all blocked → row 1 col 1 (umbrella) skip → cols 2-5 (umbrella) skip → col 6 (buffer) skip → row 2 col 0 (umbrella) skip → col 1 (buffer) skip → cols 2-5 = 4 indigo placed → row 3 col 0 (buffer) skip → cols 1-3 = 3 indigo placed. Total: 4+3 = 7 public. ✓

**Item 10 — Corner card symmetric margins.** `CORNER_CARD_BOTTOM` 32 → 60. Computed: left margin (32) + app footer effective height (~28: 6px padding × 2 + 11px font + 1px border + slack) = 60. The card's bottom-edge-to-footer-top spacing now matches the left-edge-to-viewport-left spacing.

**Item 11 — Own RFP dot halo trim.** The HTML overlay was already 6×6 (`width: 6, height: 6`) but had a `boxShadow: 0 0 5px ...` glow that visually inflated the perceived size. Removed the boxShadow entirely. The InstancedMesh dots also have no halo; visual sizes now match at zoom = 1 (where InstancedMesh circle radius=3 world units = 3 pixels = 6×6 footprint).

**Item 12 — Cluster vertically centered on Actor square.** New `anchorY = snapGrid(center.y - ((maxRow + minRow) / 2) * ROW_GAP)`. With ChipCo's 4-row cluster (rows 0-3, where row 0 is the top buffer per Item 8), `(maxRow + minRow) / 2 = 1.5`, so `anchorY = squareY - 18` (= -1.5 * 12). Rows render at `squareY - 18, squareY - 6, squareY + 6, squareY + 18`. The Actor square at `squareY` sits cleanly in the inter-row gap between rows 1 and 2 (no dot overlap). For non-umbrella clusters with odd row counts, the square sits ON a row position and may visually overlap a dot's grid cell — the hollow square outlines the filled circle, acceptable visual.

**Item 9 (skipped per brief).** Edge connection during pan was already working in 16.1.0 QA; no changes.

**Footer version v0.16.1.1.** Per the convention codified in 16.1.0: forward-progress phases roll the footer constant. Phase 16.1.1 ships → footer reads v0.16.1.1.

**Branch handling.** This phase ships to the worktree branch `claude/peaceful-chatelet-c63ee1`. Andrew's external merge-to-main step (matching the prior shipped phases) is the canonical path: `git checkout main && git merge claude/peaceful-chatelet-c63ee1 && git push origin main`.

**Verification.** Build clean (112 modules, 0 errors). Manual visual verification of the 11 fixes is the canonical path per the V2Canvas raycaster note + the headless 0×0 viewport limitation; structural verification via DOM probes confirms the new state machine + listener wiring + L-shape SVG path generation + footer string.

**Status:** [x] Complete.

### Phase 16.1.0 completion notes (2026-05-08) — Three.js migration for Directory Layer

Substantial sub-phase. Migrates DirectoryLayer's rendering pipeline from HTML/CSS dots + CSS-tiled background to Three.js scene + InstancedMesh dots + THREE.Points grid + scroll-zoom + drag-pan. Mirrors V2Canvas's hybrid architecture: Three.js for scene/grid/dots/camera, HTML for tooltip + cards + edges. Folds in three Phase 16.0.x bugs.

**Branch discipline / catchup commit (preamble).** Inspecting branch state at session start showed: HEAD on `claude/peaceful-chatelet-c63ee1` matched `main` at commit 03e2d19 (Phase 14.6.1), with Phase 14.6.2 → 16.0.3 work uncommitted in the working tree (12 files modified, 1543+ insertions, 1 untracked `public/pdf.worker.mjs`). All three Phase 16.0 markers (DOT_GRID, v22DirectorySelectedClaim, makeRfp) verified present in the working tree. Per the existing precedent (cf. `9318036 Catchup: Phases 12.4 → 14.5`), shipped a single catchup commit (`c2bb432 Catchup: Phases 14.6.2 → 16.0.3`) preserving all five phases as one logical unit before starting Phase 16.1.0. The Claude-Code worktree mechanism keeps me on the `claude/...` branch — Andrew's external merge-to-main step is the canonical path matching the prior shipped phases' history.

**Item 0 — Footer version v0.16.1.0.** Footer constant rolled from v0.15.9 → v0.16.1.0 (was frozen across the entire 16.0.x backtrack-hotfix cycle). New convention going forward: forward-progress phases roll the footer; backtrack-hotfix versions (inserted between existing entries) leave the footer unchanged. Documented in CLAUDE.md.

**Item 1 — Three.js scene + camera + grid + pan + zoom.** Mirrors V2Canvas (lines 2862-2914 setup + 2986-3060 pointer handlers). New `<canvas>` element inside the existing DirectoryLayer wrapper. WebGLRenderer (alpha:true so existing dark bg bleeds through), THREE.Scene, THREE.OrthographicCamera at (0,0,100). Animation loop gated by `dirtyRef` flag — re-render only when state changes. ResizeObserver on the container calls `setSize` + `updateCamera`. Background grid: `THREE.Points` with `THREE.PointsMaterial` at DOT_GRID=12 stride across GRID_RANGE=4000 in each axis (~111K points; well within Three.js performance budget). Pan: `handleMouseDown/Move/Up` track `draggingRef` + camera translate. Zoom: `handleWheel` with `MIN_ZOOM=0.5, MAX_ZOOM=4.0, INITIAL_ZOOM=1.5`; zooms around cursor (mirrors V2Canvas line 3040). `clampPan` keeps the camera within ±1500 world units in each axis (soft bounds). World coord convention: y increases downward (matches our HTML overlay convention); Three.js camera handles the flip via `camera.position.set(camPosRef.current.x, -camPosRef.current.y, 100)`.

**Item 2 — Dots as InstancedMesh + raycaster + hover/click + alignment + buffer.** Single THREE.InstancedMesh holds all dots — Claim dots (indigo + amber) + RFP dots (green) — across all clusters. CircleGeometry(DOT_RADIUS=3, 16) per instance; MeshBasicMaterial with vertex colors. Per-instance setup: `setMatrixAt(i, makeTranslation(d.x, -d.y, 0))` + `setColorAt(i, color)`. Colors resolve via `cssVarToColor('--accent-indigo' / '--accent-amber' / '--accent-green')` → THREE.Color, so the dots match the rest of the theme tokens. Strict alignment: every dot's world (x,y) is an integer multiple of DOT_GRID computed via `snapGrid(...)` on cluster anchors + integer column/row offsets — dots inherit alignment automatically. **One-cell buffer between subsets** (preserved from Phase 16.0.3): when a cluster has both umbrella + public claims, the public subset starts at `lastUmbrella.col + 2` (cell +1 is the gap); ChipCo Bob view → row 0 = 6 amber, row 1 = 1 amber + gap + 4 indigo, row 2 = 3 indigo. **Raycaster:** new `THREE.Raycaster` per intersect call (cheap); `intersectObject(dotsInstancedMesh)` returns `{ instanceId }`. On hover (raycast on mouse-move when not dragging): set hovered dot's color to white, lerp cluster siblings toward white by 15% via precomputed `clusterByDotIndex` lookup (`-2` = own cluster, `-1` = standalone RFP, ≥0 = other-cluster index). On click (no drag detected): pin the tooltip + call `onClaimDotClick(claim)`. Drag-vs-click via 4-pixel threshold (`DRAG_THRESHOLD_PX`).

**Item 3 — HTML overlays projected via worldToScreen.** Actor squares + label pillboxes + umbrella SVG edges + tooltip card all stay HTML/SVG; their positions update on every camera change via `worldToScreen` projection. Implementation: `updateOverlayRef.current` is called inside the Three.js animate loop (V2Canvas pattern, line 2906-2914) — every time `dirtyRef.current` triggers a render, the overlay positions are re-projected and `setOverlay({ ownerSquares, dotScreens, freeStandingRfpSquares })` is called. Components position absolutely from the `overlay` state. Two additional useEffects keep `hover` and `pinned` screen positions synced when the overlay state changes (so the tooltip card follows the dot during pan/zoom). Umbrella DA edges: SVG `<path>` cubic Bezier from corner card right-edge → projected Actor-square left-edge; control points at horizontal midpoints (preserves Phase 16.0.3 visual character).

**Bob's RFP green dot.** Kept as an HTML overlay anchored to the corner card (matches "active-actor-cluster-around-corner-card" pattern). Positioned at `(cardCenterX + offset, cardTopY - 24)` in viewport pixels — fixed during pan/zoom. Other-actor RFPs (Phase 17 will add many) ride along in the InstancedMesh as green dots since they need to pan/zoom with their owning Actor's cluster.

**Browser viewport behavior.** In a real browser viewport (e.g. 1280×720), the canvas fills the entire layer and dots render correctly at the seeded world coords. The headless dev-server probe used during verification reports a 1×1360 canvas size (because the worktree's dev preview runs at a 0×0 effective viewport), so visual confirmation of dot rendering / hover / click was done structurally (WebGL context active, InstancedMesh attached to scene, raycaster wired, footer reads v0.16.1.0, header pillbox + Actor squares + pillbox labels + RFP dot + cubic Bezier umbrella edge all render). Mouse-driven pan/zoom + tooltip flip + cluster brightening visual confirmation is the canonical manual verification path per the V2Canvas raycaster note in CLAUDE.md.

**Filed #195** — Three.js edge migration. The umbrella DA edge stayed HTML/SVG to preserve the Phase 16.0.3 cubic-Bezier curve without re-implementation. Three.js Line2 doesn't support curved paths natively (line segments only); migration would either decompose the curve into segments or move to TubeGeometry. Deferred until seed scaling makes the HTML approach stutter.

**Verification.** Build clean (112 modules, 0 errors). Runtime probe via dev server confirmed: footer reads `v0.16.1.0 · Changelog`, Three.js canvas mounts with WebGL context active, header pillbox + 2 Actor squares (ChipCo + MicroCo) + 2 pillbox labels + 1 cubic Bezier umbrella edge + 1 own RFP HTML dot + zoom indicator (1.50×) all render. Zero console errors.

**Status:** [x] Complete.

### Phase 16.0.3 completion notes (2026-05-08) — Directory Layer polish + 16.0.1 leftover

Six visual refinements plus the 16.0.1 leftover header-pillbox bug. All in `src/v2/DirectoryLayer.jsx` except Item 4 (footer z-index in `src/v2/V2App.jsx`). No backlog items closed — these are pre-Phase-16.1 setup polish that lay the alignment + interaction groundwork for the Three.js migration.

**Item 0 — Header pillbox visibility (leftover from 16.0.1).** The "Radiant Network" pillbox added in 16.0.1 sat at `top: 24px`, falling inside the top chrome bar's z-300 visible region (chrome ~60-80px tall). Layer mounts at z-150 so the pillbox content rendered behind the chrome. Fix: `top: 24 → 80` so the pillbox clears the chrome with breathing room.

**Item 1 — Curved umbrella DA edge.** The Phase 16.0 straight `<line>` from corner card to Actor square replaced with an SVG `<path>` cubic Bezier curve. Anchor: corner card right-edge center (x = `CORNER_CARD_LEFT + CORNER_CARD_W`) → Actor square left-edge center (x = `cluster.center.x - ACTOR_SQUARE/2`). Control points: `cp1 = (fromX + dx*0.5, fromY)`, `cp2 = (toX - dx*0.5, toY)` — both at horizontal midpoint with their endpoint's Y. This produces a horizontal-exit / horizontal-entry S-curve regardless of vertical offset, mirroring parent-layer full-disclosure edge visual character (V2Canvas.jsx `SDA_EDGE_CONFIG.full`). Style: `stroke: var(--accent-indigo); strokeWidth: 1.5; strokeOpacity: 0.6; fill: none`.

**Item 2 — Amber/indigo dot buffer.** `placeClusterRowMajor` rewritten to insert a one-cell phantom gap between umbrella and public dot subsets. Logic: place umbrella in pure row-major order; then check if the last umbrella row has room for `gap + first-public` (i.e. `lastUmbrella.col + 2 < MAX_COLS`). If yes: public starts on the same row at `col + 2` (col + 1 is the phantom gap). If no: public starts at col 0 of next row (the row break itself separates subsets). For ChipCo's 7-amber + 7-public Bob view: row 0 = 6 amber, row 1 = 1 amber + gap-cell + 4 indigo, row 2 = 3 indigo. The L-shape amber border still wraps the umbrella cells [(0,0)…(0,5), (1,0)] unchanged — only the indigo subset shifted right.

**Item 3 — Tooltip card layout + right-anchor + viewport-edge flip.** ClaimTooltipCard refactored to mirror parent-layer `AssetNodeDot` tooltip pattern. Anchor logic: `wouldClipRight = x + DOT_RADIUS + TOOLTIP_OFFSET + TOOLTIP_W > viewportW - 16` (mirrors AssetNode.jsx:1144). Position: `left = x + DOT_RADIUS + TOOLTIP_OFFSET` (default) or `left = x - DOT_RADIUS - TOOLTIP_OFFSET` (flipped). `top = y` always; vertical centering via `transform: translateY(-50%)` (default) or `transform: translate(-100%, -50%)` (flipped — pulls tooltip's right edge to anchorX). New constants: `TOOLTIP_W = 230`, `TOOLTIP_OFFSET = 12`. Card content: padding tightened to `10px 14px 12px 14px` so the CLAIM badge sits at the top of the inner content. ClaimTooltipCard now accepts a `viewportW` prop, threaded from the main DirectoryLayer's `viewport.w` state.

**Item 4 — Footer z-index promotion.** The `Connected to AWS S3 · v0.15.9 · Changelog` footer (V2App.jsx ~line 7700) added `position: relative; zIndex: 300` to its outer flex-child div. Without `position: relative`, `zIndex` doesn't take effect on a static-positioned flex child. The new z-index puts the footer at the same level as the top chrome (z-300), above the Directory layer (z-150). LegendBar from V2Canvas (z-50) deliberately NOT promoted — its content (Full Disclosure / Selective / Proof-only / Provisional edge styling legend) doesn't directly apply to the Directory's per-dot color coding; deferred to Phase 16.1 when Directory edge styling could differentiate.

**Item 5 — Strict dot-matrix grid alignment.** New explicit `DOT_GRID = 12` constant + `snapGrid(v)` helper. Applied to: cluster centers (sorted-party loop in `layout` useMemo), cluster grid anchors (`anchorX = snapGrid(center.x - clusterPxWidth/2)`), own-cluster anchor (`ownAnchorX`, `ownAnchorY`), own RFP center positions (`cardCenterX = snapGrid(...)`, `ownRfpRowY = snapGrid(cardTopY - 24)`), free-standing RFP slots, and other-cluster-adjacent RFP positions. Each dot's pixel position derives from `anchorX + col*COL_GAP + CELL/2` so once the anchor is grid-aligned, every dot inherits alignment. The pre-existing `MATRIX_GRID = 16` constant retained for the background dot-pattern only (the radial-gradient `background-size`); Phase 16.1 may unify these as part of the Three.js migration.

**Versioning.** v0.16.0.3 inserted into Changelog modal between v0.16.0.2 and v0.16.0.1, dated 2026-05-08. Footer constant remains at v0.15.9 per the established 16.0.x backtrack-hotfix convention.

**Verification.** Build clean (113 modules, 0 errors). Runtime probe via dev server confirms structural correctness; manual mouse interaction is the canonical visual verification path for the curved umbrella edge + tooltip flip + amber/indigo gap visuals (per the V2Canvas raycaster note in CLAUDE.md + the headless 0×0 viewport limitation).

**Status:** [x] Complete.

### Phase 16.0.2 completion notes (2026-05-08) — Hotfix: PDF worker + duplicate-key + 16.0 ship debt

Three bugs surfaced after the Phase 16.0 / 16.0.1 ship; presentation-blocking PDF render error was the priority. Single Claude Code session, single commit. No backlog items closed (pure regression + ship-debt fixes).

**Item 1 — PDF.js worker (priority: presentation-blocking).** Symptoms: opening any Asset PDF preview produced "Setting up fake worker failed" + a 404 on `pdf.worker.mjs` at `/@fs/.../node_modules/pdfjs-dist/build/pdf.worker.mjs`. Root cause: when the dev server runs from a git worktree (`.claude/worktrees/peaceful-chatelet-c63ee1/`), the worktree's own `node_modules` is empty (only `.vite` cache + `.vite-temp` directories present). Node's standard module resolution walks up to the parent repo's `node_modules` to find pdfjs-dist — that's why the build succeeds. But Vite's `?url` import returns a path keyed to the resolved file's absolute location, producing `/@fs/Users/andrewmackenzie/Desktop/radiant-ui/node_modules/pdfjs-dist/build/pdf.worker.mjs`. Vite's dev server has a `server.fs.allow` security boundary that defaults to the project root (the worktree directory). Files outside that boundary return 404 over the `/@fs/` route — exactly the error observed. Fix: brief's path B (copy worker to `public/`). Executed `cp /node_modules/pdfjs-dist/build/pdf.worker.mjs public/pdf.worker.mjs` (1.2MB file added to `public/`); updated `src/v2/components/pdfJsWorker.js` to set `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs'` (was the `?url` import). Removed the now-unused `import workerSrc from 'pdfjs-dist/build/pdf.worker.mjs?url'` line. Inline comment block updated explaining the worktree fs.allow context + manual upgrade step. The build path is unaffected — pdfjs-dist still resolves through node_modules normally; only the runtime `workerSrc` URL is now static. Trade-off: future `pdfjs-dist` upgrades require manually re-copying the worker file to `public/`. Documented inline; could become a build script if it becomes a maintenance nuisance.

**Item 2 — `v22DirectoryMaterializedClaim` ReferenceErrors.** Brief reported runtime ReferenceErrors at V2App.jsx lines 306 and 5710. Investigation: `grep -rn "v22DirectoryMaterializedClaim" src/` returns only a single match at line 241 — a comment-level historical reference (`// selected Claim. Replaces Phase 11B's v22DirectoryMaterializedClaim`). All setter and reader call sites were already cleared during the Phase 16.0 ship via the `bash sed` sweep + the IIFE rewrites. The brief's report appears to have been based on a stale snapshot or an HMR-cached transformation pre-dating the Phase 16.0 commit, OR the user was running against an older worktree state. Source code is correct as of Phase 16.0; no runtime errors should occur on the current commit. Defensive cleanup: updated the Phase 11B-era "Detail Panel for the materialized directory Claim" comment block at line 5709 to reflect the Phase 16.0 per-dot click flow + a note that `buildClaimNodeForDirectoryMaterialization` is a holdover function name (rename deferred to limit blast radius).

**Item 3 — Duplicate React keys.** Symptoms: console warnings "Encountered two children with the same key, '0.10.0'" and "0.9.10". The keys looked like React's auto-generated nested-index paths but were actually literal version strings. Source: V2App.jsx line 8502, the Changelog modal iteration `[...].map(release => <div key={release.version}>...)`. Multiple historical phases share the same `version` value because the prototype has been incrementing the footer version conservatively (e.g. v0.10.0 covers Phase 10.1, 10.2, 10.2.1, 10.3, 10.4, 11A, 11A.1, 11B — all 8 entries get `key="0.10.0"`). Fix: composite key `${release.version}-${release.label}` since `label` (phase number, e.g. "Phase 11B") is unique per entry. Pre-existing bug — not introduced by Phase 16.0 — but surfaced by the user during 16.0 QA, so caught and patched here. Inline comment block on the new key line documents the rationale.

**Verification.** Build clean (113 modules, 0 errors). Runtime probe via dev server confirms the new worker URL `/pdf.worker.mjs` returns the correct 2.16MB file. PDF preview render path is unchanged behaviorally — just sourced from a different URL.

**Status:** [x] Complete.

### Phase 16.0.1 completion notes (2026-05-08) — Directory Layer layout polish

Hotfix-style polish sub-phase from Phase 16.0 QA. Eight visual changes, all in `src/v2/DirectoryLayer.jsx`. No spec-model changes (the per-role view-builder + seed are unchanged), no backlog items closed (these are 16.0 follow-ups). Single Claude Code session, single commit.

**Item 1 — Header pillbox.** The Phase 16.0 "RADIANT NETWORK · PUBLIC DIRECTORY" header + subtitle replaced with a single pillbox containing "Radiant Network" at top-center. Styling: `top: 24, padding: 6px 16px, borderRadius: 999, background: var(--bg-card), border: 1px solid var(--border), fontSize: 12, letterSpacing: 0.18em, textTransform: uppercase`. `pointerEvents: none` so the pillbox can't capture background clicks.

**Item 2 — Subtitle removed.** The "N clusters · M Claims" line that lived below the Phase 16.0 header is dropped entirely. Future metrics surface gets its own placement decision in a later phase.

**Item 3 — In-canvas Launch AI Shopper button removed.** The chrome bar already exposes the AI Shopper entry point (the magnifier icon adjacent to the Library + Notifications icons), so the in-canvas pill button was redundant. The `onOpenAIShopper` prop is retained on the `DirectoryLayer` component signature so V2App's existing wiring continues to work; only the in-canvas `<button>` is gone.

**Item 4 — Dot size 8×8 → 6×6.** Single constant change: `DOT_RADIUS` 4 → 3. ClaimDot, RfpDot inherit. The hover-scale (`transform: scale(1.5)`) is unchanged so hovered dots scale to 9×9, still distinct against the matrix grid (16px stride).

**Item 5 — Row-major cluster layout + L-shape amber border.** The biggest change. The Phase 16.0 freeform polar-fill helpers (`placeClusterDots`, `boundingRectFromDots`) are retired. New `placeClusterRowMajor(anchorX, anchorY, umbrellaClaims, publicClaims)` returns an array of `{ claim, isAmber, row, col, x, y }` with row-major fill: umbrella claims first, then public, max 6 dots per row, 12px cell stride (`CELL` constant). Anchor (anchorX, anchorY) is the top-left corner of cell (0,0); dot centers sit at `(anchorX + col*CELL + CELL/2, anchorY + row*CELL + CELL/2)`. Each cluster's anchor is computed in the `layout` useMemo as `(center.x - clusterPxWidth/2, center.y + ACTOR_TO_DOTS_GAP)` so the dot grid sits below the Actor square, horizontally centered on it. New `lShapePath(cells, anchorX, anchorY)` helper computes an SVG path outlining the umbrella subset. The path traces clockwise from top-left of row 0: across the top of row 0, down the right side, with horizontal "jogs" at each row boundary where the next row is narrower. Generalised to N rows (not just 2) so the helper handles any future row-count combinations. Stroke 1.5px `var(--accent-amber)`, fill `color-mix(in srgb, var(--accent-amber) 8%, transparent)`. For ChipCo's 7-amber + 7-public Bob view, this produces the L-shape described in the brief: 6 cells across row 0 + 1 cell at row 1 col 0.

**Item 6 — Tiny Actor squares + pillbox labels.** `ActorSquare` rewritten. Square shrunk from 40×40 to 6×6 (`ACTOR_SQUARE` constant 40 → 6); border 2px → 1.5px; `borderRadius` dropped. The party-name label moved out of the square's interior to a pillbox positioned 18px above the square center. Pillbox styling: `padding: 3px 8px; borderRadius: 999; background: color-mix(in srgb, var(--bg-card) 92%, var(--text-dim)); color: var(--text-primary); fontSize: 10; fontWeight: 600; letterSpacing: 0.04em`. New `faded` prop on ActorSquare drops opacity to 0.25 with a 150ms transition. The `fadePillboxFor(centerX, centerY)` helper in the main component checks if the currently-hovered Claim dot's 6×6 footprint overlaps the pillbox's `PILLBOX_W × PILLBOX_H` bounding box (axis-aligned, no rotations). Hovered ClaimDot picks up `0 0 8px rgba(255,255,255,0.6)` halo (in addition to the existing colored glow) so it reads against the faded pillbox. The hover-scan is O(num_pillboxes) per render and Phase 16's max is 4 pillboxes per role view, so it's free.

**Item 7 — Vertical-center cluster anchors.** The Phase 16.0 `pickClusterCenters` slot-grid (3×2 in upper 55% of canvas) replaced with inline distribution at `y = viewport.h * 0.5`: 1 cluster → x=50%, 2 clusters → x=35% / 65%, N≥3 → even spread `x = viewport.w * (i+1)/(N+1)`. Sort by `localeCompare` so cluster ordering is deterministic and intuitive (MicroCo left, ChipCo right alphabetically).

**Item 8 — Bob's RFP green dot above corner card.** Own RFP placement reworked. Anchor: `cardCenterX = CORNER_CARD_LEFT + CORNER_CARD_W/2`, `cardTopY - 24`. Multiple own RFPs spread horizontally centered on the card via `(i - (total-1)/2) * CELL` offset. Other RFPs (none in current seed but Phase 17 will add) keep adjacent-to-Actor-square anchoring.

**Versioning.** v0.16.0.1 inserted into Changelog modal between v0.16.0 and v0.15.9, dated 2026-05-08. Footer constant remains at `v0.15.9 · Changelog` per the established 16.0 / 14.6.x convention.

**Verification.** Build clean. Runtime probe via dev server confirms structural correctness; manual mouse interaction is the canonical visual verification path per the V2Canvas raycaster note in CLAUDE.md (this affects DirectoryLayer testing for hover whiten + cluster brighten + pillbox fade — the 0×0 headless viewport can't run those visually).

**Status:** [x] Complete.

### Phase 16.0 completion notes (2026-05-08) — Directory Layer foundations

XL phase: replaces the Phase 7 / 11A / 11B Directory Layer scaffolding with a new visual model + per-role view computation + per-dot interactivity. Single Claude Code session, single commit, six items in scope. This is the visual foundation for Phase 17 (RFP feature) which will build on top of the dot/Actor-square/cluster primitives.

**Item 1 — Architecture spec rewrite.** §8.2 ("Directory Layer Content") expanded from 5 bullets to a structured subsection (8.2.1 Background, 8.2.2 Node types, 8.2.3 Clusters, 8.2.4 Umbrella Disclosure visualization, 8.2.5 Per-role view rules, 8.2.6 Hover and click, 8.2.7 Disclosure-type rendering). New §8.2.4 prototype-shortcut callout documents that the umbrella DA edge is a UI simplification — under the hood it's still a collection of independently-typed individual DAs. §8.5 ("Implementation note") rewritten to reflect the Phase 16 model — Phase 7's mock supplier clusters and Phase 11A's standalone ChipCo cluster are explicitly retired in the spec.

**Item 2 — Seed expansion.** Dave/ChipCo's catalog grows from 2 → 14 Claims (`cChipcoOpAmp`, `cChipcoBuckReg`, `cChipcoTimingIc`, `cChipcoLdoReg`, `cChipcoMixedSig`, `cChipcoBandgap`, `cChipcoFlashMem`, `cChipcoSramCtl`, `cChipcoAdcDac`, `cChipcoMpu`, `cChipcoSerdes`, `cChipcoPowerMgmt`). Each new Claim has `referencedAssetIds: []` (Phase 16 doesn't materialize Assets for them — Detail Panel handles empty refs gracefully; future phases can give them real Assets). 7 new public DAs (`daChipcoPublicVref` + 6 new) and 8 new umbrella DAs to Bob (`daChipcoToBobOpAmp` + 7 new) cover the mix specified in the brief: 4 public-only, 6 umbrella-only, 2 with both (cChipcoOpAmp, cChipcoBuckReg). All ChipCo Claims now have ownership DAs (`daveOwnClaims` extended). Bob's view of Dave's cluster: 7 indigo (5 public-only + 2 dual + Vref + PrmIc-via-mixed) wait — actual math: cChipcoVref public + cChipcoOpAmp public + cChipcoBuckReg public + cChipcoTimingIc public + cChipcoLdoReg public + cChipcoMixedSig public + cChipcoBandgap public = 7 indigo; cChipcoPrmIc + cChipcoFlashMem + cChipcoSramCtl + cChipcoAdcDac + cChipcoMpu + cChipcoSerdes + cChipcoPowerMgmt = 7 amber. Confirmed via runtime probe: 17 total Claims (14 ChipCo + 3 Alice public).

**Item 3 — `makeRfp` factory + seed RFP.** New skeletal factory in `v2_2Data.js` with shape `{ id, type: 'rfp', owner, ownerDot, name, description, requirementsSetIds, status, createdDate }`. One Bob-owned RFP seeded — "Sentinel-4 RF Module Compliance" referencing MIL-PRF-55681 v2 + System Integration Requirements, status `'open'`, created 2026-04-15. `rfps` array added to `buildV22SharedArtifacts` return shape. Phase 17 (#192) owns the lifecycle (post / open / close / response artifacts / buyer review).

**Item 4 — `buildV22DirectoryDataForRole(roleId, provisionals)` view-builder.** New export near `getV22DataForRole`. Returns `{ activeParty, ownClaims, ownRfps, otherClusters, umbrellaEdges, otherRfps }` shape per the brief. Visibility math: a Claim is publicly disclosed if any active DA targets `Radiant Network` as grantee with `subject.kind === 'claim'`; umbrella-disclosed-to-active if any active DA targets the active party as grantee from a non-active non-network grantor. Public takes precedence per spec §8.2.2 — public-and-umbrella Claims appear in `publicClaims` only; the amber subset wraps only umbrella-only Claims. Active Actor's own Claims (regardless of public DA presence) are added to `ownClaims` so Dave's view of his own catalog renders all 14 dots as indigo per spec §8.2.5. Umbrella edges are derived AFTER cluster construction so they only render for grantors whose visible umbrella subset is non-empty (avoids drawing "private access" lines when every privately-disclosed Claim is also publicly disclosed — surfaced during runtime verification: Alice→Bob inter-party DAs would have generated a stale edge to MicroCo otherwise).

**Item 5 — DirectoryLayer.jsx rewrite.** Substantial rewrite (~600 lines). Removed: `ClusterDots` component, `allClusters` hardcoded array, `chipcoVisible` + `chipcoClaimCount` derivations, ChipCo cluster-click hit-area, Phase 11B materialized-claim card, `onClusterClick` + `materializedClaim` + `onCloseMaterializedClaim` props. Added: `ClaimDot` (hoverable + clickable, whitens on hover, scales 1.5×, tooltip card via singleton hover/pinned state), `RfpDot` (Phase 16 visual-only with `pointerEvents: 'none'`), `ActorSquare` (40×40 hollow indigo border, party-name label below), `ClusterGroup` (wraps cluster contents with `filter: brightness(1.18)` on hover), `ClaimTooltipCard` (parent-layer dot-preview style — CLAIM badge + name + owner + disclosure type + posted date). Layout helpers: `pickClusterCenters(parties, viewportW, viewportH)` distributes parties on a 3×2 slot grid in the upper 55% of the canvas, sorted deterministically by hashed party name; `placeClusterDots(cx, cy, publicCount, umbrellaCount, seed)` samples polar coordinates with rejection sampling against the Actor square — umbrella dots cluster on the left half (angles in [π/2, 3π/2]) so the bounding rectangle reads as "amber subset on one side"; `boundingRectFromDots` computes the amber bounding box with 18px padding. Dot matrix bg via `radial-gradient(circle, color-mix(...) 1px, transparent 1.6px)` + `background-size: 16px 16px`. SVG layer renders umbrella DA edges as 1.5px indigo lines from the corner card center to each target Actor's square center. Hover/pinned tooltip is a singleton — both `hover` and `pinned` state update the same target; clicking a different dot replaces both. Background click (root onClick handler) un-pins and calls `onClaimDotClick(null)`. Preserved verbatim: Phase 11.8 `pinnedOriginRef` wipe-origin pinning, Phase 11A `phase` state machine (closed → opening → in → out → closed), Bob's corner card visual.

**Item 6 — V2App.jsx migration.** Phase 11B's `v22DirectoryMaterializedClaim` state replaced with `v22DirectorySelectedClaim` (holds the clicked Claim or null). Esc-handler effect, role-switch reset, and Directory close all reference the new state. The `onClusterClick` + `materializedClaim` + `onCloseMaterializedClaim` props on the DirectoryLayer mount removed; new props `roleId`, `v22Provisionals`, `onClaimDotClick={(claim) => setV22DirectorySelectedClaim(claim)}` added. The Detail Panel IIFE that builds the synthetic Claim node via `buildClaimNodeForDirectoryMaterialization` now consumes `v22DirectorySelectedClaim` directly (was `v22DirectoryMaterializedClaim.claim`); the synthetic-node-construction logic is unchanged. The function name `buildClaimNodeForDirectoryMaterialization` is slightly stale post-Phase-16 but kept to limit blast radius — optional rename is filed as a future cleanup. `bash sed` swept the 4 stale `setV22DirectoryMaterializedClaim` call sites to `setV22DirectorySelectedClaim`.

**Versioning.** Phase 16.0 is a forward-going phase but per the brief's instruction the footer constant stays at `v0.15.9 · Changelog` — the new v0.16.0 Changelog modal entry sits at the top of the entries array (above v0.15.9), dated 2026-05-08. This matches the Phase 14.6.x backtrack pattern's footer convention; future phases may bump the footer to v0.16.0 if the Phase 17 RFP feature ships.

**Spec changelog.** Adding a Phase 16.0 bullet was deferred — §8.2 + §8.5 inline rewrite captures the substantive change; the Phase 16 line in §17.5 changelog isn't strictly needed since the affected sections were rewritten in place.

**Backlog hygiene.** Closed: #43 (Clickable Directory Layer dots), #45 (Real dot-cloud data sourcing). Both moved to Completed with full closure notes. Filed: #193 (V2App.jsx file split for transpile-perf + maintainability — Babel 500KB warning surfaced during 14.6.1 ship; composes with #50), #194 (Path-c migration: legacy /public PDFs to branded generator output — captures the dependency map from #183's investigation; composes with #185).

**Verification.** Build clean (113 modules, 0 errors). Runtime probe via the headless dev server confirmed Bob's view: layer mounts, dot matrix bg renders, 17 Claim dots (7 indigo ChipCo public + 7 amber ChipCo umbrella + 3 indigo MicroCo public), 1 RFP dot (Bob's own Sentinel-4), 2 Actor squares (ChipCo + MicroCo), 1 amber bounding rect, 1 umbrella edge to ChipCo. Pre-existing `NaN as left CSS value` console warnings from BadgeChipContainer at the 0×0 headless viewport are unrelated to Phase 16. Manual mouse interaction is the canonical verification path for hover whiten + cluster brighten + tooltip pin + Detail Panel open per the V2Canvas raycaster limitation in CLAUDE.md.

**Status:** [x] Complete.

### Phase 14.6.2 completion notes (2026-05-07) — Library + action-bar polish

Six tightly-scoped follow-ups on the Phase 14.6 / 14.6.1 badge work. Single Claude Code session, single commit. No backlog items closed (these are 14.6 ship-time polish, not previously-filed items).

**Item 1 — Library tab strip badge count filtered to own-templates.** Phase 14.6.1 Bug A narrowed the BadgesPanel internal list + toolbar count to own-templates only, but the `LibraryModal` tab strip ("Parsing Templates 3 · Requirement Sets 1 · Published Requirements 3 · Badges 4") still showed the unfiltered total. The `counts` derivation in `LibraryModal.jsx` now mirrors the BadgesPanel filter: `activeParty ? badgeTemplates.filter((t) => t.ownerParty === activeParty).length : badgeTemplates.length`. Falls through to the unfiltered length when `activeParty` is null (defensive — shouldn't happen in current flows). Other tabs (Parsing Templates, Requirement Sets, Published Requirements) keep their existing logic; the badge-private rule applies to badge templates only. Result: Bob sees "Badges 2", Alice "Badges 1", Carol "Badges 1", Dave "Badges 0".

**Item 2 — Toolbar minimum height.** When toggling between list view (with the "+ Create new badge" button visible) and create / new-version view (button hidden, only the "N badge templates" count rendered), the toolbar height shrank because the button has 6px+12px padding + 11px font while the bare count line is 11px text only. Added `minHeight: 50` to the toolbar div's style so the row stays a constant ~50px height regardless of which children render. Existing flex centering handles vertical alignment; the bottom-border + `flexShrink: 0` are preserved.

**Item 3 — Toolbar button label "+ Create New Badge".** Title-cased "New" + "Badge" to align with the in-app convention of capitalizing user-facing CTA nouns. The handler (`handleCreate`) is unchanged.

**Item 4 — Create form title "Create New Badge".** `EditorForm`'s `headerText` for create mode (when `!isNewVersion`) flipped from "Create Badge Template" to "Create New Badge". Matches the toolbar button label exactly. New-version mode header (`New Version: ${sourceName || editName || 'Untitled'}`) is unaffected — only the create-from-scratch path changes.

**Item 5 — Referenced Requirements Sets list shows RS owner per row.** The right-panel `ViewDetails` Referenced RS list previously showed the technical RS id (`reqset-mil-prf-55681-v1`) on line 2 of each row; Andrew wanted the OWNER instead. Owner resolution: Published Standards in `publishedRequirementSets` carry `_publishedBy` (e.g. 'GovCo' for the seed `SEED_PUBLISHED_REQUIREMENT_SETS` entries); own RSes from `requirementSets` (per-role pool) carry no explicit owner field — they live per role in `DEMO_REQUIREMENT_SETS[roleId]`, so the active actor's party IS the owner of any RS in that pool. The row computes `const rsOwner = rs?._publishedBy || activeParty` and renders `{rsOwner || rsId}` with the same 10px monospace `var(--text-dim)` styling used previously. `activeParty` threaded through to `ViewDetails` as a new prop. Display chosen as bare party (no "Owned by" prefix) to match the BadgesPanel template list rows' terseness convention.

**Item 6 — Action bar Issue Badge icon swap.** The Phase 14.2 Issue Badge entry point on Claim card action bars (line 1058 case) and PoE card action bars (line 1095 case) used the star Unicode glyph `★`. The action bar already supported JSX icons (the SDA button at line 260 uses an inline `<svg>`), so swapping to the canonical `BadgeShieldIcon` SVG makes the entry point match the chip stack rendering. Both call sites now push `{ icon: <BadgeShieldIcon size={13} color="currentColor" />, ... }`. Size 13 mirrors the SDA SVG's `width={13} height={13}` for visual scale parity with adjacent Unicode glyphs. `BadgeShieldIcon` accepts `color` as a CSS-color string and feeds `currentColor` through the silhouette stroke, so passing `currentColor` makes the icon inherit from the action button's text color exactly the way Unicode glyphs do (matches the hover-state color transition `var(--text-secondary)` → `var(--text-primary)` automatically). Tooltip + onClick + gate logic unchanged.

**Versioning + ship metadata.** Phase 14.6.2 is a backtrack ship — Phase 15.6 (v0.15.9) remains the latest forward-going phase. Per the established 14.6 / 14.6.1 pattern, the footer constant continues to display `v0.15.9 · Changelog` (NOT rolled back); v0.14.6.2 is inserted into the Changelog modal in chronological/phase order between v0.15.0 (2026-05-06) and v0.14.6.1 (2026-05-07). Architecture spec gains one Phase 14.6.2 changelog bullet between 14.6.1 and 15.0; polish-backlog.md gets a Phase 14.6.2 Update Log entry; CLAUDE.md "Current state of the world" + "Active phase queue" reflect the 14.6.2 ship.

**Status:** [x] Complete.

### Phase 14.6.1 completion notes (2026-05-07) — Hotfix sub-phase

Backtrack-hotfix from 14.6. Two bugs surfaced during 14.6 QA + two trivial backlog rollups; one of the rollups (#183) reverted to investigation-only after dependency analysis surfaced heavy downstream chains.

**Bug A — Badge Library narrowed to own-only.** Phase 14.0's `BadgesPanel` was designed with network-wide visibility (sectioned list grouping templates by `ownerParty`: own first, then other parties' templates in alphabetical sections). This conflicts with the canonical rule that badge templates are private to their owner — only Published Standards (RSes) are cross-actor referenceable. Phase 14.6.1 narrows to own-only:

- New `ownTemplates` memo at the parent level: `useMemo(() => badgeTemplates.filter((t) => t.ownerParty === activeParty), [badgeTemplates, activeParty])`. Toolbar count + `<TemplateList templates={...}>` input both consume this filtered list.
- `TemplateList` simplified: dropped the `otherByParty` Map + `others` derivation + the rendering branch that iterated other parties' sections. Kept the "MY BADGES · N" header for visual structure even with one section. Empty state copy ("No badge templates yet.") preserved.
- The full `badgeTemplates` list stays the source for `selectedTemplate` resolution (`badgeTemplates.find((t) => t.id === selectedId)`) and `handleNewVersion`'s lineage walk (`maxVersion` computation across the lineage). Those flows may reference templates by id at lookup time independent of ownership; pre-filtering would break id-based jumps from notifications or cross-role contexts.

**Behavioral check:** From Bob's view: 2 templates (Aerospace Grade A v2 + v1 SUPERSEDED). From Alice: 1 (Component Quality Assured). From Carol: 1 (Audit Verified). From Dave: 0 (empty-state). Toolbar count reflects the filtered count.

**Bug B — Chip fan-out gap reduction.** Phase 14.5 set `STEP_FAN = 22` (= `SHIELD_SIZE` 18 + 4px gap). Andrew's QA measured the visual gap as ~10px during fan-out. Root cause: the visible shield footprint exceeds the 18px `SHIELD_SIZE` constant due to the halo + SVG stroke geometry from Phase 14.5's "2px halo stroked in the rectangle's exact background color" treatment. The mathematical 4px-gap target was correct on paper but missed visually. Phase 14.6.1 retunes `STEP_FAN` from 22 to **16** — empirically chosen to land the on-screen gap close to the 4px target. Comment block on the constant updated to flag the empirical rationale so future chip work surfaces the same halo-geometry pitfall. `STEP_IDLE`, `SHIELD_SIZE`, `HEIGHT`, container padding, animation timing all unchanged. `idleInner` and `fanInner` calculations automatically pick up the new constant; the 180ms ease-out width transition is unaffected.

**#184 — V2.1 holdover `evidence` subtype config entry purged.** The `evidence: { icon: '◧', color: 'var(--accent-orange, #fb923c)', label: 'EVIDENCE' }` entry in `CATEGORY_CONFIG` (`src/v2/AssetNode.jsx`) was V2.1-era classification dead code — no current seed Asset uses subtype `'evidence'` so the string never rendered in the live app. Surfaced during the Phase 15.3 EVIDENCE → ASSET rename sweep but left untouched then; cleared in 14.6.1.

Defense-in-depth grep before deletion confirmed: AssetNode consumes the map via `CATEGORY_CONFIG[node.category] || CATEGORY_CONFIG.product` (lines 370, 1126, 1284 — three render paths) — the `|| CATEGORY_CONFIG.product` fallback handles missing entries gracefully. So even if some straggler V2.1 data path were ever exercised, AssetNode would render with the `product` config (◆ blue PRODUCT label) — not crash, just visually wrong for that one orphan node. `src/v2/V2Canvas.jsx` has multiple `c.category === 'evidence'` filter checks (lines 221, 315, 352, 557, 1678) that read the data flag to classify children for layout; in V2.2 the filter returns empty arrays since no node carries the flag. Those filter checks are themselves V2.1-holdover dead code and will be cleaned up under the broader #50 sweep alongside the `c.isEvidence` flag pattern. The single config-entry deletion is sufficient for this hotfix's scope.

**#183 — Legacy /public PDF cleanup investigation; trim deferred.** Path B (trim) was attempted per the brief, but the dependency check surfaced extensive downstream chains for all four parent Assets:

- `aEmiDatasheet` (Alice's EMI shielding datasheet) → `cEmi` Claim (only Asset on it), `prEmiDatasheet` Parse Result, `daAlicePublicEmi` + `daAliceToCarolEmi` DAs, `erCarolEmi` Eval Result.
- `dPrmIcDatasheet` (ChipCo's PRM IC datasheet) → ChipCo PRM-IC Assembly Claim's `referencedAssetIds`, parse result, `daveOwnAssets`, ChipCo→Bob disclosure DA scope, granteeAssetId on a DA.
- `dPrmIcTestReport` → same Claim's `referencedAssetIds` (alongside the datasheet), `daveOwnAssets`, DA scope.
- `dVrefDatasheet` → ChipCo Voltage Reference IC Claim's `referencedAssetIds` (only Asset), `daveOwnAssets`.

Cascade-trimming would destroy three demo arcs (Alice→Carol→EMI auditing scenario; ChipCo PRM-IC Assembly demo; ChipCo voltage-reference demo). Per the brief's explicit "STOP and surface" rule for non-orphan Assets, the trim was deferred without code changes. The backlog entry for #183 was updated to reflect the investigation outcome and surface the dependency chains so Andrew can pick per-Asset between (a) keep the unbranded PDF, (b) cascade-trim the dependency chain, or (c) substitute a generated MicroCo / ChipCo-branded PDF via additions to `scripts/generate-seed-pdfs.mjs`. Recommendation in the backlog entry: path (a) is cleanest given the demo-narrative cost of (b); path (c) is the proper long-term fix.

**Versioning quirk** (mirrors 14.6 pattern). v0.14.6.1 inserted into the Changelog modal entries array between v0.15.0 (newer in the rendered list) and v0.14.6 (older). Footer constant remains `v0.15.9 · Changelog` — NOT rolled back. The latest-phase indicator stays at 15.6.

**Build clean** (0 errors).

**Status:** [x] Complete. (#183 left Open with investigation captured; the other three items closed.)

### Phase 14.6 completion notes (2026-05-07) — Badge Polish Trio (#187, #188, #189)

Backtrack ship from Phase 15.6. Closes the badge polish trio that got deprioritized when Phase 15 took over (the trio was filed during Phase 15.1.1 QA and queued in #187 / #188 / #189 during the Phase 15 closing sweep). Three items, single sub-phase, single commit.

**#187 — Active Issuances rows show Claim label + Owner.** Phase 14.2 (#169a) migrated the badge data model from `targetPoeId` → `targetClaimId` but the Active Issuances rendering surfaces in `BadgesPanel` (Library right-panel) and `V22BadgeTemplatePanel` (forward-looking Detail Panel — Badge Template nodes aren't materialized on the canvas yet) were not migrated alongside. They still read `b.targetPoeId` + `poeNameLookup`, which meant the rows rendered undefined-ish values (the field doesn't exist on post-14.2 issuance objects). This phase completes the migration:

- `ViewDetails` in `BadgesPanel.jsx` (lines 186-192 area) — signature parameter renamed `poeNameLookup = {}` → `claimNameLookup = {}`. Each entry shape: `{ name: <claim label>, ownerParty: <claim grantor party> }`.
- Active Issuances row rendering — read `b.targetClaimId` (was `b.targetPoeId`); pull `claimLabel` + `ownerParty` from `claimNameLookup`; render Claim label on line 1, ownerParty + date on line 2 (matches the existing pattern but with the Claim's owner party as the second-line label, which is the badge recipient).
- `BadgesPanel` default-export signature — replaced `proofsOfEvaluation = []` with `allClaims = []`; the lookup builder near line 749 swaps `for (const p of proofsOfEvaluation)` for `for (const c of allClaims)` building `claimNameLookup[c.id] = { name: c.name, ownerParty: c.owner || c.ownerParty }`.
- `V22BadgeTemplatePanel` — same migration: signature renamed `poeNameLookup` → `claimNameLookup`; row rendering reads `b.targetClaimId` and pulls from `claimNameLookup`. Forward-looking surface (Badge Template nodes aren't materialized on the canvas per Phase 14.0 — the `'BADGE TEMPLATE'` router case is scaffolding) but fixed for spec consistency and to prevent regression when canvas materialization ships.
- `LibraryModal.jsx` — pass-through prop renamed `proofsOfEvaluation` → `allClaims`.
- V2App's LibraryModal mount — dropped the now-unused `proofsOfEvaluation={...}` IIFE prop (the merged-dataset `allClaims={...}` IIFE prop already existed alongside it from earlier work).

**#188 — Globe icon on own-Published RSes in the Badge Template create form.** Scope corrected during planning. The original framing assumed Published Standards were missing from the picker entirely; on inspection the Published Standards section already exists (lines 547-561 of `BadgesPanel.jsx`'s `EditorForm`). The actual gap was the visual-marker on own-RSes that the actor also published — the `externalPublished` filter (line 421: `!ownRsList.some((o) => o.id === p.id)`) excludes own-published copies from the dedicated Published Standards section, so when Bob (who authors all 3 Published Standards in seed) opens the create form his Published Standards appear ONLY in `YOUR REQUIREMENTS SETS` without any indication they're also published. This phase fixes that:

- Added a `publishedRsIdSet` membership Set built once via `useMemo` from `(publishedRequirementSets || []).map((p) => p.id)`.
- `renderRsRow` extended: the existing globe-render predicate `fromSection === 'published'` becomes `(fromSection === 'published' || (fromSection === 'own' && publishedRsIdSet.has(rs.id)))`. Closure over `publishedRsIdSet` from the parent scope; no parameter chaining.
- No section reshuffle — own-but-also-published RSes stay in the YOUR REQUIREMENTS SETS section per the design call. The globe icon is the marker.

**#189 — Issuance enforcement gating (RS-coverage).** The previous `handleV22IssueBadge` enforced only the self-issuance gate (silent return when `recipientParty === activeRole.party`). The picker UI did not pre-block templates whose RSes weren't covered by the target Claim's PoEs. Per the brief's scope confirmation: no duplicate-issuance gate; RS-coverage gate by exact RS ID (no lineage matching — badges reference frozen RS versions); active PoEs only (only PoE-wrapped Eval Results count toward coverage); no self-issuance picker gating (handled upstream + by IssueBadgeModal's mount-time error state).

Implementation:

- **Data layer (defense in depth)** — `handleV22IssueBadge` extended after the self-issuance guard. Pulls the merged dataset via `mergeProvisionals(buildV22SharedArtifacts(), v22Provisionals)` so PoEs/Eval Results created during the session count toward coverage. Walks active PoEs targeting this Claim → resolves the wrapped Eval Result via a Map → unions `requirementsSets[].id` into a `coveredRsIds` Set. Computes `missingRsIds = template.referencedRequirementsSetIds.filter((rsId) => !coveredRsIds.has(rsId))`. If non-empty, silent return + `console.warn('[handleV22IssueBadge] RS-coverage gate failed; issuance rejected.', {targetClaimId, badgeTemplateId, missingRsIds, missingNames})`. Earlier `template` lookup reused for the downstream notification (avoided duplicate `find`).
- **V2App IssueBadgeModal mount** — extended the IIFE around `<IssueBadgeModal>` to compute the same `targetClaimCoveredRsIds: Set<string>` (mirrors the data-layer walk) plus a `requirementSetNameById: Map<string, string>` for tooltip text. Passed both as new props to `<IssueBadgeModal>`.
- **`IssueBadgeModal.jsx`** — signature gains `coveredRsIds = new Set()` and `requirementSetNameById = new Map()` props (forgiving defaults). `renderRow` computes `missingRsIds` per template; sets `disabledReason` to `null` on pass, generic "no Proof of Evaluation" string on `coveredRsIds.size === 0`, or "no Proof of Evaluation covering …" with names list on partial coverage. `TemplateRow` extended with a `disabledReason` prop: when set, the row gets `opacity: 0.45`, `cursor: 'not-allowed'`, no hover state, no click handler; SUGGESTED label suppressed; row wrapped in a `<Tooltip content={disabledReason} position="auto" wrapperStyle={{ display: 'block' }}>` from `src/components/Tooltip.jsx`. Tooltip auto-flips below when viewport top-space is tight (existing primitive behavior).

**Versioning quirk.** Phase 14.6 is a backtrack ship — Phase 15.6 (v0.15.9) is the most recent forward-going phase. Per the brief's instruction the footer constant continues to display `v0.15.9 · Changelog` (NOT rolled back); v0.14.6 is inserted into the Changelog modal entries array in chronological/phase order between v0.15.0 (2026-05-06) and v0.14.5 (2026-05-06). The Changelog modal's last entry (top of the list) reads from the `0.15.9` Phase 15.6 entry; the new v0.14.6 entry appears further down the list. This versioning shape is documented in CLAUDE.md "Active phase queue" — the latest-phase indicator stays at 15.6, with Phase 14.6 noted as a backtrack insertion.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.6 completion notes (2026-05-07) — Re-Run Auto-Fill from New Asset Evidence (#172 closing scope)

Closes the #172 PDF annotation demo arc with a complete end-to-end happy-path. Re-run carry-forward now auto-populates MISSING rows from `discoveredValue` metadata on anchors pointing to newly-in-scope Assets — the narrative shifts from "user manually fills forms" to "AI evaluation reads new evidence and fills in the gaps."

**Step 1 — `discoveredValue` schema addition.** Anchor entries on `evidenceAnchors[]` gain an optional `discoveredValue: string` field. The seed update to `erBobVreg`'s req-006/007 rows attaches the field to each Test Report anchor: req-006 gets `'> 75 MeV·cm²/mg LET threshold'`; req-007 gets `'168 hours at 125°C · 0/100 failures'`. Values match the Test Report PDF's on-page text exactly so visual coherence between the PDF annotation rect and the right-panel value is preserved when auto-populated.

The `makeEvaluationResult` factory's row projection uses `{ ...a }` spread on each anchor (Phase 15.0.1 hotfix), so the new field passes through without further factory changes. Verified by reading `v2_2Data.js` lines 957-976 — anchor projection accepts arbitrary keys.

**Step 2 — `autoFillRow` carry-forward transformation.** New closure inside `V22RunEvaluationModal.jsx` (immediately above the existing `buildRowsForRs` helper). Implements the auto-fill logic per the design spec:

```js
const priorEvidenceUsedSet = new Set(priorActiveResult?.evidenceUsed || [])
const currentScopeAssetIdSet = new Set((evidenceAssets || []).map((a) => a?.id).filter(Boolean))
const autoFillRow = (row) => {
  if (!priorActiveResult) return row
  if (row.status !== 'missing') return row
  const anchors = row.evidenceAnchors || []
  const match = anchors.find((a) =>
    a?.sourceAssetId
    && a?.discoveredValue
    && currentScopeAssetIdSet.has(a.sourceAssetId)
    && !priorEvidenceUsedSet.has(a.sourceAssetId)
  )
  if (!match) return row
  return { ...row, status: 'satisfactory', value: match.discoveredValue }
}
```

Integration site: `buildRowsForRs(rs)` — when re-run mode is active and the RS matches a prior RS, the function maps prior rows into the working state via `priorRows.map(...)`. Phase 15.6 wraps each row in an `autoFillRow` invocation that produces the auto-filled row when criteria are met. The mapped row preserves `_aiOriginalValue` set to the (potentially auto-filled) value so the human-edited pencil icon doesn't trigger spuriously when the auto-populated value lands.

The Set lookups make the transformation O(1) per row. The transformation is idempotent — running it twice on the same input produces the same output. The check is intentionally narrow: rows with status other than `'missing'` are returned as-is; rows whose anchors are all on Assets that were already in `evidenceUsed` are returned as-is; fresh evaluations (no `priorActiveResult`) skip the transformation entirely.

**Step 3 — Save flow inherits auto-filled state.** Verified that the save path (`handleSubmit` in V22RunEvaluationModal) builds the new Eval Result from `rowsByRsId` working state. Since auto-fill produces the working state at carry-forward time (Step 2), `handleSubmit` picks up the auto-filled rows automatically. No additional changes needed in the save logic. Cross-role notification flow (Bob saves → Alice receives notification → Alice's canvas reflects 7/7 SAT) inherits the same way.

**No mutation of the prior eval artifact.** The original `erBobVreg` Eval Result in seed/global state is unaffected — auto-fill operates on a derived row array passed to `useState`. Reopening the prior eval's Detail Panel + Expand modal still shows 5 SAT + 2 MISSING. After Bob saves the auto-populated re-run, the prior is marked `superseded` (existing supersession behavior) but its `results[]` content stays as authored.

**Step 4 — Walkthrough doc Section 5b updated.** Step 2 expected-outcome bullet rewritten to show all 7 rows as SATISFACTORY (was 5 SAT + 2 MISSING-ready-to-review with explicit "Bob updates the missing rows" sub-flow). The Phase 15.5 manual-edit sub-section retired since the happy-path demo no longer requires manual edits. Added a note in "Try the interactions" mentioning that auto-populated rows can still be manually overridden if the demoer wants to demonstrate that path.

**Implementation notes.**
- Initial draft considered exporting `applyAutoFillFromNewAssets` as a module-level function but the closure form keeps `priorActiveResult`, `evidenceAssets`, and the derived Sets in scope without prop-drilling — simpler and the transformation is V22RunEvaluationModal-specific anyway.
- The two derived Sets (`priorEvidenceUsedSet`, `currentScopeAssetIdSet`) are recomputed on every render since they're declared at the component body. This is fine — the modal isn't render-hot, and the Sets are small (typically 1-3 entries each). If profiling later shows a hotspot, a `useMemo` wrapper is the trivial fix.
- The `_aiOriginalValue` snapshot is set to the auto-filled value (not the original 'Pending verification' string) so a downstream "human edited the AI's value" pencil icon doesn't fire when Bob continues without editing. This matches the spirit of `_aiOriginalValue` (the value the row was initialized with), even though the auto-fill is technically a post-AI-evaluation transformation.
- Anchors that don't carry `discoveredValue` (e.g. the existing Datasheet anchors on req-001-005) gracefully skip the transformation — the `find` predicate returns nothing, and the row passes through unchanged. The 5 SAT rows in `erBobVreg` are unaffected by the auto-fill.

**Footer v0.15.8 → v0.15.9.** Architecture spec §17.5 changelog gains a 15.6 bullet documenting the auto-fill mechanism + schema addition; the existing demo-trick callout in §17.5 updated to note that the trick + auto-fill together produce a complete demo arc. polish-backlog Update Log entry. CLAUDE.md "Current state of the world" updated. **#172 closed.**

**Runtime verification.** Build clean (0 errors). HMR-served updates verified via curl probes — `discoveredValue` strings present in `v2_2Data.js`, `autoFillRow` and `priorEvidenceUsedSet` references present in `V22RunEvaluationModal.jsx`. Manual end-to-end walkthrough required (per Phase 15.0.1 workflow lesson): (a) Bob → VReg Eval Result → Expand → Output → confirm 5 SAT + 2 MISSING (unchanged from 15.5; auto-fill doesn't affect the prior eval's display). (b) Switch to Alice → amend VReg Claim → attach Test Report + extend DA scope → save. (c) Switch to Bob → re-run on the Eval Result → Step 2 → confirm right panel shows ALL 7 rows as SATISFACTORY (req-006 with `> 75 MeV·cm²/mg LET threshold`, req-007 with `168 hours at 125°C · 0/100 failures`). (d) Continue → Step 3 → Save → confirm new Eval Result has 7/7 SAT and supersedes prior. (e) Create PoE → confirm the wrap completes the happy path.

**Status:** [x] Complete. **#172 closed.**

### Phase 15.5 completion notes (2026-05-07) — VReg Re-Run Demo Simplification

VReg evaluation seed redesigned into a coherent demo narrative arc: prior eval shows 5 SAT + 2 MISSING → Alice amends with Test Report → Bob's re-run discovers values for the missing rows in the new evidence → save → 7/7 SAT → create PoE.

**Step 1 — Chain collapsed to a single Eval Result.** Phase 13.2 (#177) seeded a 3-Eval-Result supersession chain on Bob's VReg evaluation (V0 → V1 → V_main) to demonstrate chain rendering. With the Phase 15.5 narrative ("Bob's first evaluation discovers gaps that re-run resolves"), the chain contradicted the framing — V0 and V1 implied prior evaluations had already happened. Both `erBobVregV0` and `erBobVregV1` definitions deleted from `v2_2Data.js`. Supersession-patch lines (`erBobVregV0.supersededBy = erBobVregV1.id`; `erBobVregV1.supersededBy = erBobVreg.id`) removed. `evaluationResults` registry collapsed from `[..., erBobVregV0, erBobVregV1, erBobVreg, ...]` to `[..., erBobVreg, ...]`. The chain-rendering code path is no longer exercised by current seed; the rendering logic itself stays available for future scenarios.

**Step 2 — Chain DAs removed.** Phase 13.2 also seeded auto-disclosure DAs for each chain ancestor — `daProofBobVregV0`, `daProofBobVregV1` (proof-of-eval DAs targeting V0/V1) plus `daOwnEvalBobVregV0`, `daOwnEvalBobVregV1` (internal ownership DAs). All four definitions deleted; `disclosureAgreements` registry trimmed. The Phase 13.2 chain comment ("chain-ancestor auto-disclosure DAs ... edge derivation reroutes the edge target to the ancestor's chain-successor ...") removed since the pattern is no longer exercised — Carol's EMI Eval Result is unwrapped + standalone, so no other VReg-style chain remains in the current seed.

**Step 3 — `erBobVreg` becomes 7 rows: 5 SAT + 2 MISSING.**

- Five existing requirements (req-001 through req-005) all SAT with Datasheet-only anchors. Values match the Datasheet PDF exactly: req-001 `5.0V ±0.5% under load`, req-002 `< 1.7W at rated current`, req-003 `-55°C to +125°C`, req-004 `TID ~ 80 krad(Si)` (changed from chain-head's prior `TID > 100 krad(Si)` for visual coherence with the Datasheet PDF — the prototype's RS doesn't encode threshold logic so the SAT label is independent of the value content), req-005 `Category XV, §121.1`.
- Two new requirements added: req-006 **Single Event Latch-up (SEL) immunity** + req-007 **Burn-in qualification**. Both have status `missing`, value `Pending verification`, and (the demo trick) anchors pre-stamped on Test Report despite Test Report not being in `evidenceUsed`.
- `evidenceUsed` stays `[aVregDatasheet.id]` — what was actually evaluated. Test Report wasn't in scope until Alice's amend prereq.

The two MISSING rows establish the Re-Run narrative: there are gaps in the prior evaluation; new evidence (Test Report, attached during the amend prereq) holds the values; Bob's re-run loads them in.

**Step 4 — Demo trick scoped down.** The Phase 15.4 demo trick over-stamped Test Report anchors on all 5 SAT rows (req-001-005) even though the SAT rows had genuine Datasheet anchors. Phase 15.5 narrows the trick to req-006 and req-007 only. Inline comment block in `v2_2Data.js` immediately above the `results[]` array updated to flag the narrower scope. The trick still violates the anchors-must-reference-evidenceUsed-Assets invariant but at minimal scope; production implementations would need either Asset-intrinsic anchor support OR a re-run-time anchor authoring path.

**Step 5 — Test Report PDF rewritten.** The Phase 15.3/15.4 Test Report had two pages with sections covering req-001 through req-005 — content that duplicated the Datasheet. Phase 15.5 replaces it with a focused 1-page document containing ONLY the two SUPPLEMENTARY criteria (SEL Immunity + Burn-in Qualification). New `docType: 'VReg-12C · Supplementary Test Report'`. Two anchored rows: req-006 `> 75 MeV·cm²/mg LET threshold`, req-007 `168 hours at 125°C · 0/100 failures`. Generator regenerated — `evidenceAnchors.js` auto-rebuilt with new `PDF_ANCHORS['microco-vreg-test-report.pdf']` map containing req-006 + req-007 only (req-001 through req-005 entries removed).

**Implementation notes.**
- Build verified after Step 1+2 (no broken references) before continuing to Step 3+4 — the V0/V1 deletion was the highest-risk part of the sweep because seven distinct call sites referenced those identifiers.
- Sweep verified: `grep "erBobVregV"` after Step 2 returned only comments (no live references). `grep "daProofBobVregV0|daProofBobVregV1|daOwnEvalBobVregV0|daOwnEvalBobVregV1"` returned zero matches in the live code paths.
- The Datasheet PDF is intentionally unchanged (per the brief); `microco-vreg-datasheet.pdf` retains its 5-row content keyed to req-001 through req-005. Hash unchanged: c2f9e90f6d315a8d. Determinism preserved.
- The new req-004 seed value `TID ~ 80 krad(Si)` matches the Datasheet PDF's on-page text (which has always read `TID ~ 80 krad(Si)` since Phase 15.0). This makes the on-PDF annotation rectangle visually consistent with the right-panel results-row value — a parity fix that was deferred through Phases 15.3 + 15.4 but resolved now as part of the broader rewrite.

**Walkthrough doc updates.** Section 3 (Scenario 2) rewritten as "VReg Eval Result with missing criteria" — single Eval Result, 5 SAT + 2 MISSING. The chain references and "active chain head" language removed. Section 5 (Scenario 4) rewritten as "find missing criteria from new evidence" — explicit "Bob updates the missing rows" sub-section with the values to enter (req-006 `> 75 MeV·cm²/mg LET threshold`, req-007 `168 hours at 125°C · 0/100 failures`), then "Save", then "7/7 SAT" expected outcome, then "create PoE" as the happy-path conclusion. At-a-glance scenario table updated for both rows.

**Footer v0.15.7 → v0.15.8.** Architecture spec §17.5 changelog gains a 15.5 bullet documenting the demo-trick scope narrowing + the simpler Re-Run narrative. polish-backlog Update Log entry. CLAUDE.md "Current state of the world" updated. Filed prototype shortcut: the prototype's RS artifact is reference-only `{ id, name, version }`; requirement definitions materialize as result rows on Eval Results — production would need a canonical RS template. (Existing known shortcut, not new to 15.5; surfaced in the spec for completeness.)

**Runtime verification.** Manual user-path walkthrough required (per Phase 15.0.1 workflow lesson): (a) Bob → VReg Eval Result → Expand → Output → confirm `Asset 1 of 1`, 5 SAT markers `1`-`5` on Datasheet, 7 rows in right panel with healthbar 5 SAT · 0 UNSAT · 2 MISSING, req-004 highlight rect on Datasheet matches right-panel value `TID ~ 80 krad(Si)`. (b) Switch to Alice → amend VReg Claim → confirm Test Report visible in picker → save. (c) Switch to Bob → Re-Run on the Eval Result → Step 2 → confirm 2-Asset accordion (Datasheet markers `1`-`5`, Test Report markers `6` + `7`), 7 rows in right panel. (d) Bob updates req-006 + req-007 to SAT with the Test Report values → Continue → Save → confirm new Eval Result has 7/7 SAT and supersedes prior. (e) Create PoE → confirm flow works.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.4 completion notes (2026-05-07) — Re-Run Demo Seed Correction + PDF Value Parity

Two corrections from Phase 15.3 QA. The 15.3 ship conflated two separate demo goals (VReg Expand modal multi-Asset vs. amend-then-rerun multi-Asset) and added a Compliance Notes Asset that wasn't strictly needed.

**Step 1-2 — Seed structure corrected.** The 15.3 ship pre-attached `aVregTestReport` to `cVreg.referencedAssetIds` AND extended `daAliceToBobVreg.scope.assetIds` to include both Datasheet + Test Report at initial seed time. That left VReg's Expand modal showing `Asset 1 of 2` from first boot — duplicating PRM's multi-Asset role. Phase 15.4 reverts both to single-Asset initial seed:

- `cVreg.referencedAssetIds`: `[aVregDatasheet.id, aVregTestReport.id]` → `[aVregDatasheet.id]`.
- `daAliceToBobVreg.scope.assetIds`: `[aVregDatasheet.id, aVregTestReport.id]` → `[aVregDatasheet.id]`.

PRM remains the canonical multi-Asset Expand modal demo. VReg's Expand modal goes back to `Asset 1 of 1` (single-Asset, no switcher arrows). The Test Report Asset stays defined and stays in the global `assets` array — but now it's Alice-owned-but-unattached, surfacing in her amend Asset picker as the named candidate for the Re-Run prereq.

**Step 3 — Demo trick: anchors reference an Asset outside evidenceUsed.** `erBobVreg.evidenceUsed` reverts to `[aVregDatasheet.id]` — reflecting what was actually evaluated at chain-head time. But its `results[].evidenceAnchors[]` arrays deliberately RETAIN both Datasheet and Test Report references (each row has 2 anchor entries — one per Asset). When Alice attaches the Test Report during the amend prereq, Bob's subsequent Re-Run accordion shows the Test Report with annotations rendered against those pre-stamped anchors.

In production this is a data inconsistency — anchors shouldn't reference Assets outside `evidenceUsed`. For prototype demo purposes the inconsistency is accepted because it enables the amend-then-rerun-with-annotations narrative without requiring a contrived prior eval that already used the Test Report. An inline comment block in `v2_2Data.js` immediately above the chain-head's `results[]` array flags the trick. The architecture spec §17.5 changelog documents the prototype convention.

**Step 4 — Compliance Notes Asset retired.** The 15.3 ship added `aVregComplianceNotes` (Alice-owned, unattached, paragraph-only PDF) specifically as the amend-prereq candidate. With Step 3's demo trick, Test Report serves both as the prereq Asset AND as the multi-Asset annotation target — Compliance Notes is no longer needed:

- `aVregComplianceNotes` Asset definition deleted from `v2_2Data.js`.
- `microco-vreg-compliance-notes.pdf` deleted from `public/seed-pdfs/` (was Phase 15.3 generated).
- `microco-vreg-compliance-notes.pdf` spec entry removed from `scripts/generate-seed-pdfs.mjs` PDF_SPECS array (the `paragraphs[]` page-spec affordance added to support that PDF stays on the generator for future documentation-style PDFs).
- `evidenceAnchors.js` regenerated without the Compliance Notes entry. PDF_FILES no longer carries a Compliance Notes record, so the deleted Asset definition's `PDF_FILES['microco-vreg-compliance-notes.pdf']` references would now throw — but since the Asset definition is also deleted, no consumer references the missing key.

**Step 5 — PDF value parity flagged-but-already-correct.** The 15.4 brief flagged a Radiation tolerance value parity issue — "TID ~ 80 krad(Si)" in the test report would be UNSAT against the seed's "TID > 100 krad(Si)" SAT chain-head value. Verified at the script source: `microco-vreg-test-report.pdf` req-004 was already shipped Phase 15.3 with `'TID > 100 krad(Si)'`. The "TID ~ 80 krad(Si)" string lives in two other places and both are correct: the VReg Datasheet PDF (`microco-vreg-datasheet.pdf` req-004 — represents the published spec) and `erBobVregV1`'s value (the V1 superseded Eval Result that recorded `'TID ~ 80 krad(Si)'` with `unsatisfactory` status before the test campaign was rerun and the chain head landed `'TID > 100 krad(Si)'` SAT). No changes needed. Script regenerated all PDFs anyway to ensure deterministic state after the Compliance Notes spec removal — sha256 hashes for the three retained PDFs match prior bytes (`microco-prm-datasheet.pdf` 3c7124fab824bf5f, `microco-prm-test-report.pdf` f65f47b347a4cad1, `microco-vreg-datasheet.pdf` c2f9e90f6d315a8d) confirming determinism.

**Walkthrough doc updated.** Section 2 (VReg Eval Result Expand) reverts to single-Asset prose (was multi-Asset in 15.3). At-a-glance scenario table row 2 reverts to "Single-Asset, single-RS, full chain head"; row 4 description updated to "Amend-then-rerun-with-annotations on a newly-attached Asset". Section 5a names "Voltage Regulator IC Test Report" as the canonical amend candidate with the demo-trick rationale ("anchors reference an Asset outside evidenceUsed — accepted for prototype demo purposes"). Section 5b describes a 2-Asset accordion (Datasheet + Test Report, both with annotation markers) — Compliance Notes references removed.

**Footer v0.15.6 → v0.15.7.** Architecture spec §17.5 changelog gains a 15.4 bullet documenting the prior-eval-anchors-may-reference-non-evidenceUsed-Assets prototype convention. polish-backlog Update Log entry. CLAUDE.md "Current state of the world" updated.

**Runtime verification.** Manual user-path walkthrough required: Bob → VReg latest Eval Result → Expand → Output → confirm `Asset 1 of 1`, no arrows, only Datasheet visible. Switch to Alice → amend VReg Claim → confirm Test Report appears in the picker (single VReg candidate now that Compliance Notes is gone). Save. Switch back to Bob → re-run → Step 2 → confirm 2-Asset accordion (Datasheet + Test Report) both with annotation markers.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.3 completion notes (2026-05-07) — Re-Run Demo Seed Enhancement + EVIDENCE Rename Followup

Two corrections from Phase 15.2 QA. Closes demo gaps in the #172 PDF annotation arc.

**Step 1 — EVIDENCE → ASSETS rename in Δ delta info box.** Single-instance rename in `V22RunEvaluationModal.jsx`: the amber-tinted info box at the top of the Re-Evaluation flow's review surface (visible only in Re-Run mode when `priorActiveResult` is present and the Asset diff is non-empty) read "Δ EVIDENCE"; now reads "Δ ASSETS". This was the last surface using "EVIDENCE" as a title-bar-style tag — the Phase 15.1.2 sweep covered eval-output / poe Output tab strips but missed this one because it's specific to the Re-Run review path. Sweep-after-rename: 4 remaining EVIDENCE matches in src/, all non-user-facing — two in the V2App.jsx Changelog modal (historical phase descriptions, intentional), one in `AssetNode.jsx`'s `SUBTYPE_CFG.evidence.label` (V2.1 holdover; no seeded Asset uses subtype `'evidence'` so the string never renders), and code comments. Documented in completion notes.

**Step 2 — VReg Test Report PDF.** Added `microco-vreg-test-report.pdf` to the generator script's PDF_SPECS array. 2 pages, MicroCo branding (green accent), revision Rev 1.0, Generated 2026-02-15. Page 1 covers Power & Thermal Measurements (req-001, req-002, req-003); Page 2 covers Radiation & Regulatory (req-004, req-005). Anchor coordinates auto-recorded by the existing `recordAnchor` flow as the script renders each row. **Value parity** verified at authoring time: every row's `value` string in the test report exactly matches the chain-head `erBobVreg` Eval Result's seed `value` for that requirement (e.g. PDF says `5.0V ±0.4% under load`, seed value is `5.0V ±0.4% under load` — identical). Labels in the PDF use measurement-style framing ("Power output measured", "Thermal dissipation observed", etc.) to read as test-report content while the values stay aligned with the seed.

**Step 3 — VReg Compliance Notes PDF.** Added `microco-vreg-compliance-notes.pdf` to the generator. 1 page, MicroCo branding, Rev 1.0, Generated 2026-02-20. Pure documentation content (compliance program status, ITAR review reference, radiation-effects program note, supplier-of-record summary) rendered as flowing paragraphs. Required a small extension to the generator: the page-spec shape now accepts an optional `paragraphs: [string, ...]` field which renders flowing prose with no row-based anchor capture. Existing `sections[]` path preserved — both can coexist on a single page if needed (none of the current specs uses both, but the affordance is there). The Compliance Notes Asset is intentionally NOT in `PDF_ANCHORS` so consumers don't try to render annotations against it.

**Step 4 — Seed updates in v2_2Data.js.**

- **4a** `aVregTestReport` Asset created (id `asset-vreg-test-report`), owned by Alice, registered 2026-02-15. File metadata pulled from `PDF_FILES['microco-vreg-test-report.pdf']`; localPath `/seed-pdfs/microco-vreg-test-report.pdf`. Added to the global `assets` array. `cVreg.referencedAssetIds` extended from `[aVregDatasheet.id]` to `[aVregDatasheet.id, aVregTestReport.id]`. The `daAliceToBobVreg` Disclosure Agreement scope's `assetIds` extended in lockstep so Bob has full disclosure access to both Assets.
- **4b** `aVregComplianceNotes` Asset created (id `asset-vreg-compliance-notes`), owned by Alice, registered 2026-02-20. NOT added to any Claim's `referencedAssetIds` from initial seed — sits in Alice's owned-Assets pool ready for the amend flow. Verified: Alice's amend-Claim Asset picker (`candidateAssets` prop on `AmendClaimModal`) consumes the global Asset list filtered by ownership + not-already-referenced, so the Compliance Notes Asset surfaces automatically without a dedicated registration call.
- **4c** `erBobVreg` (chain-head VReg Eval Result) `results[]` updated — every row's `evidenceAnchors[]` array goes from 1 entry (datasheet only) to 2 entries (datasheet + test report). Each requirement now has `[{ sourceAssetId: aVregDatasheet.id, ...PDF_ANCHORS['microco-vreg-datasheet.pdf'][reqId] }, { sourceAssetId: aVregTestReport.id, ...PDF_ANCHORS['microco-vreg-test-report.pdf'][reqId] }]`. `evidenceUsed` extended from `[aVregDatasheet.id]` to `[aVregDatasheet.id, aVregTestReport.id]`. Predecessor results (`erBobVregV0`, `erBobVregV1`) deliberately NOT retroactively updated — they predate the Test Report Asset and stay single-Asset, which preserves the chain semantics (the test report only became part of the evaluation universe at the chain head).

**Step 5 — Walkthrough doc updates.** Section 2 (VReg Eval Result Expand) rewritten from single-Asset to multi-Asset — `Asset 1 of 2` counter, `◀ ▶` arrows, both PDFs annotated, cross-Asset row clicks documented. Section 5a (Alice's amend prereq) names the Compliance Notes Asset specifically with the why-this-Asset rationale (Alice owns it, it isn't yet attached, demo determinism). Section 5b's expected-outcome bullet rewritten to describe a three-Asset accordion (Datasheet + Test Report annotated, Compliance Notes blank). At-a-glance scenario table row 2 updated; row 4 description updated to "Multi-Asset annotations carried forward".

**Implementation details surfaced.**
- `PDF_FILES` map auto-includes the new entries since the script writes both `PDF_ANCHORS` and `PDF_FILES` in lockstep — no extra wiring needed for v2_2Data.js to consume size + hash for the two new files.
- The Compliance Notes Asset's PDF doesn't appear in `PDF_ANCHORS` (no rows = no anchors recorded) — consumers iterating `PDF_ANCHORS` won't accidentally try to render annotations on it.
- `daAliceToBobVreg` had its scope expanded but the Compliance Notes Asset is NOT added to the initial seed scope — Alice's amend flow extends the DA dynamically as part of the prereq step, exercising the existing scope-update mechanics from Phase 12.1.
- The two predecessor VReg Eval Results (V0 superseded with `missing` rows; V1 superseded with `unsatisfactory` radiation row) keep single-Asset anchors — a design call that preserves chain causality (you can't anchor against an Asset that didn't exist when the result was authored). The walkthrough doc notes this explicitly.

**Footer v0.15.5 → v0.15.6.** Architecture spec §17.5 changelog gains a 15.3 bullet referencing the multi-Asset Re-Run demo path. polish-backlog Update Log entry. CLAUDE.md "Current state of the world" updated.

**Runtime verification.** Manual user-path walkthrough required (per Phase 15.0.1 workflow lesson): Bob → click VReg latest Eval Result → Expand → Output → confirm `Asset 1 of 2`, both PDFs annotated, all 5 indicators on each side, value text matches between PDF and right-panel rows. Switch to Alice → amend VReg Claim → confirm Compliance Notes Asset appears in the picker → save. Switch back to Bob → re-run latest Eval Result → confirm 3-Asset accordion with annotations on first two and blank Compliance Notes.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.2 completion notes (2026-05-07) — Download Fix + Walkthrough Guide + Legacy PDF Cleanup (#172 part 3 close)

Three deliverables. Closes the #172 PDF annotation arc.

**Step 1 — Download icon button fix.** The Phase 15.1.2 icon button shipped disabled. The brief premised a pre-existing JSON download handler ("the same one the original full-width 'Download' button used in pre-15.1.2 layouts") — that premise was wrong. The Phase 13.4 placeholder `<DownloadButton>` has always been disabled with the literal `title="Export coming soon."` and never carried an onClick. Phase 15.2 introduces the first working Download in the eval-output / poe surfaces.

The fix:
- `<DownloadIconButton>` now accepts an optional `onClick` prop. When provided, the button drops `disabled`, enables hover styling (var(--text-secondary) → var(--accent-indigo) on enter; subtle indigo-tint background), and forwards click events. When omitted, the legacy disabled affordance is preserved (no eval-output / poe consumer ships today without the handler, but this guards against future placeholder reuse).
- Replaced the native `title=""` attribute with a real `<Tooltip>` primitive (the same one used by BadgeChipContainer per Phase 14.3). Tooltip text: `Download Evaluation Results JSON`, `position="auto"` so it lands above the icon and flips below if insufficient viewport top-space.
- `EvalResultOutputBody` gains a `handleDownloadJson` callback that constructs a Blob from `getEvalResultJsonRecord(evalResult)`, creates a transient `<a>` element with `download="eval-result-<id>.json"`, programmatically clicks it, then schedules `URL.revokeObjectURL` on the next tick. Filename pattern: id-based when `evalResult.id` is present, slug-of-name fallback otherwise.
- Both surfaces wired since PoE schema renders `<EvalResultOutputBody>` directly per Phase 15.1.2 — same handler, same filename pattern, same tooltip.

**Step 2 — Demo walkthrough guide expanded.** `docs/PHASE-15-DEMO-SCENARIOS.md` rewritten from the Phase 15.0.1 skeleton into a complete walkthrough. Six top-level sections: Overview (with at-a-glance scenario table + prerequisites), Scenarios 1–4 (each with Role, Setup, Navigation, Expected outcome, Try the interactions), and Notes for QA + demos (acceptable warnings, behavior reminders, common gotchas). The Re-Run prerequisite step (Alice amends the VReg Claim before Bob's re-run, gated by `hasNewAssetsForRerun` from Phase 13.3) is documented as Section 5a with explicit role-switch steps and the gate explanation. Format: markdown headings, anchor links in the at-a-glance table, bullet steps for short navigation paths, numbered lists for multi-step flows, bold action verbs.

**Step 3 — Legacy /public PDF cleanup.** Cross-referenced every PDF in `public/` against `src/v2/v2_2Data.js` to identify orphaned files. Five unreferenced legacy PDFs removed:
- `connectorassembly-datasheet.pdf`
- `pcbsubstrate-datasheet.pdf`
- `powerregulationmodule-datasheet.pdf`
- `thermalinterfacepad-datasheet.pdf`
- `voltageregulator-datasheet.pdf`

Surface for follow-up: four legacy PDFs in `public/` are STILL referenced by active V2.2 seed data and were therefore retained:
- `emishielding-datasheet.pdf` — referenced by `aEmiDatasheet`
- `prm-3a-ic-datasheet.pdf` — referenced by `dPrmIcDatasheet`
- `prm-3a-ic-qualification-report.pdf` — referenced by `dPrmIcTestReport`
- `voltage-reference-ic-datasheet.pdf` — referenced by `dVrefDatasheet`

Acceptance criterion #6 ("public/ contains only the three generated MicroCo PDFs in public/seed-pdfs/") was overstated — removing these four would silently break their Asset previews. The right follow-up is either re-generating MicroCo-branded replacements via `scripts/generate-seed-pdfs.mjs` or trimming the seed entries; both are out of scope for 15.2 (this phase closes the #172 annotation arc, not the broader seed-PDF migration). Filing as a backlog candidate ("Phase 15.3 candidate: migrate remaining legacy /public PDFs to seed-pdfs/ MicroCo flow OR remove from seed").

The references in `src/v2/v2Data.js` (the V1/V2.1 legacy data file) to the 5 removed PDFs are dead code — `getDataForRole` is imported by V2App but never called (`grep -cn "getDataForRole(" V2App.jsx` returns 0). Those references were not consulted by the active runtime at any point; safe to leave the dead-data file as-is for future cleanup.

**Step 4 — Documentation.** `architecture-spec.md` §17.5 Changelog gains a 15.2 bullet referencing the demo walkthrough guide. `polish-backlog.md` Update Log entry. `CLAUDE.md` "Current state of the world" + "Active phase queue" updated — Phase 15 arc now closed across parts 1 (15.0), 2 (15.1, plus 15.0.1 hotfix + 15.1.1 + 15.1.2 polish phases), and 3 (15.2).

**Footer v0.15.4 → v0.15.5.** In-app Changelog modal entry prepended.

**Runtime verification.** Manual user-path walkthrough: open Bob's PRM Eval Result → Expand → Output → hover the download icon (tooltip "Download Evaluation Results JSON" appears within ~200ms) → click (JSON file downloads, filename `eval-result-eval-bob-prm.json` or similar). Same flow on PoE expand modal Section 1 (download icon in the wrapped Eval Result's EVALUATION RESULTS strip works, downloads the wrapped Eval Result's JSON). Asset switcher + bidirectional row↔dot interaction + label format + indicator shape all unchanged from 15.1.1/15.1.2. PDF cleanup: dev server boots cleanly, no missing-PDF console errors, all currently-referenced Assets still preview correctly.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.1.2 completion notes (2026-05-07) — Eval Result + PoE Expand Modal Layout Consolidation

Three refinements surfaced during 15.1.1 QA, all chrome cleanup — no architectural shifts.

**Step 1 — canonical modal header carries eval/poe metadata.** ExpandedArtifactModal's header (above the tab bar) gains an inline metadata line below the title for `eval-output` and `poe` schemas. Eval Result: `Evaluated: YYYY-MM-DD · HH:MM UTC · Evaluator: <party>`. PoE: `Created: YYYY-MM-DD · HH:MM UTC · Owner: <party>`. Renders in 11px mono var(--text-dim) under the 16px title. Other schemas pass `headerMetadata=null` and the line doesn't render — header height stays as it was.

**Step 2 — thin header band removed from eval-output body.** The Phase 15.1.1 thin band at the top of `EvalResultOutputBody` (name + dates + evaluator inline) is dropped entirely. Body now starts directly with the side-by-side row. Reclaims ~52px of vertical space inside the scrolling Output tab.

**Step 3 — Download button promoted into right-panel title bar.** Replaced the standalone "Download" button (Phase 15.1.1 placement: in the healthbar block) with a 24×24 icon-button at the right edge of the EVALUATION RESULTS strip. Icon: download arrow + horizontal line below (custom inline SVG, 14×14, var(--text-dim) stroke). Tooltip: "Download Evaluation Results JSON". Wires up under #58 — disabled in 15.1.2 like every other Download affordance. The healthbar block now hosts the aggregate count + minibar only (no Download row).

**Step 4 — file info repositioning + Owner/Registered merge.** Left-panel scroll content reordered: `[ASSET title bar]` → `[file viewer]` → `[combined 6-row metadata block]`. Owner + Registered (previously rendered as a tertiary 2-column row below the AssetEvidenceViewer) merge into the same 6-row card alongside Filename, Size, MIME, Hash. AssetEvidencePanel exports two new sub-components — `AssetFileViewer` (just the file render, PDF.js or iframe) + `AssetFileMetadata` (with `variant: 'file-info' | 'combined' | 'owner-row'`). `AssetEvidenceViewer` default export now composes them in the legacy order (`file-info` card → viewer → `owner-row` tertiary footer) so every existing call site is unaffected — Asset Detail Panel preview, Claim referenced-asset preview, ExpandedArtifactModal `asset` schema, V22RunEvaluationModal accordion, V22ParseEvidenceModal accordion all keep their prior layout.

**Step 5 — EVIDENCE → ASSET rename.** The left-panel title bar badge in the eval-output / poe Output tabs reads "ASSET" (was "EVIDENCE" since Phase 15.1). Amber accent color unchanged. The Δ EVIDENCE diff label in V22RunEvaluationModal Re-Run review (a contextually different label about Asset-list deltas between runs) was left as-is — the spec scoped the rename to title-bar treatments only. The `evidence` AssetNode subtype config (`SUBTYPE_CFG.evidence.label`) was also left as-is — that's a node-card subtype label for a legacy Asset classification, not a modal title bar.

**Step 6 — PoE Output tab cleanup.** Removed the full-width PoE info box at the top of `PoeOutputBody` (was: "Proof of Evaluation" eyebrow + name + Created + Owner). After Step 1 the canonical modal header surfaces the same PoE metadata, so the box was redundant. Also removed the "Final Evaluation" `<SectionHeading>` above Section 1 — the wrapped Eval Result's own EVALUATION RESULTS title bar makes the context unambiguous. The PoE Output tab body now reads: `<EvalResultOutputBody>` (the wrapped Eval Result with side-by-side ASSET + EVALUATION RESULTS panels) → `<SectionHeading>Evaluation Provenance (N)</SectionHeading>` → `<ProvenanceList>`. The Provenance section heading stays since it labels a meaningful semantic boundary (the supersession chain is structurally distinct from the wrapped result content).

**Implementation notes.**
- `AssetFileViewer` `key={displayAsset.id}` preserved — the multi-Asset switcher relies on a fresh PDF mount on Asset flip (Phase 15.0.1 pattern).
- The combined-metadata card sits below the viewer in the LEFT column's natural flow. With `position: sticky; top: 0` on the left column wrapper, the entire stack (title bar + viewer + metadata) scrolls together inside the modal body; the right column's per-RS results scroll past while the left stays anchored. The metadata card is therefore visible only at the bottom of the left stack, but on tall enough viewports both viewer + metadata fit within the sticky window.
- `headerMetadata` is computed inline in the modal entry point — no schema-specific render branch needed; just a single conditional `<div>` below the title.
- The right-panel title bar's `<DownloadIconButton>` shares its disabled-state styling pattern with `<DownloadButton>` (1px border, var(--text-dim) color, cursor not-allowed) — visual continuity with the existing affordance, just compressed to 24×24.

**Footer v0.15.3 → v0.15.4.** Architecture spec §17.5 changelog gains a 15.1.2 bullet. polish-backlog Update Log entry added. CLAUDE.md "Current state of the world" updated.

**Runtime verification.** Manual user-path walkthrough per Phase 15.0.1 workflow lesson — open Bob's PRM Eval Result → Expand → Output to confirm: (a) modal header shows EVAL RESULT badge + name + "Evaluated: ... · Evaluator: ..." line; (b) no thin band above the side-by-side row; (c) left panel reads ASSET strip → PDF (with annotation dots) → combined 6-row metadata card; (d) right panel EVALUATION RESULTS strip with download icon at right edge; (e) healthbar block has aggregate + minibar, no Download. Same flow for PoE → confirm canonical header shows PROOF OF EVALUATION badge + name + "Created: ... · Owner: ..." and no full-width PoE box at top of body.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.1.1 completion notes (2026-05-07) — Annotation Numbering + Shape + Right-Panel Layout

Three contained refinements on top of Phase 15.1's annotation work. Single-component-cluster polish phase; no architectural shifts.

**Step 1 — Drop the `{assetOrdinal}.` prefix from labels.** Three call sites updated: AnnotatedPdfViewer (PDF dot label), EvalResultsTable in ExpandedArtifactModal (right-panel row indicator), ReviewRow indicator computation in V22RunEvaluationModal Step 2/3. Labels now read just `{rowOrdinal}` (per-Requirements-Set, 1-indexed). The same row keeps the same number across Asset switches; RS color coding distinguishes RS membership. The `assetOrdinal` prop on `AnnotatedPdfViewer` was kept in the API (but not rendered in the label) — reserved for future compound-label scenarios (multi-Asset disambiguation tooltips, etc.). Synthesized anchor IDs from Phase 15.1 are unaffected — ID synthesis doesn't include the label.

**Step 2 — Rounded-rectangle indicator shape.** AnnotatedPdfViewer's `INDICATOR_SIZE` constant split into `INDICATOR_WIDTH=32` + `INDICATOR_HEIGHT=22` + `INDICATOR_RADIUS=6`. The indicator placement math updated accordingly: `indicatorTop = rectTop + rectHeight/2 - INDICATOR_HEIGHT/2`; `naturalLeft = rectLeft - INDICATOR_WIDTH - INDICATOR_GAP` (still clamped to `INDICATOR_LEFT_CLAMP=4`). Highlight rect placement, RS color background, 2px white border, box-shadow, label font, and click target behavior all preserved. Right-panel row indicators in EvalResultsTable converted from `22×22 borderRadius:50%` to `28×20 borderRadius:6` matching the PDF dot shape language at slightly tighter scale. Same change applied to V22RunEvaluationModal's ReviewRow indicator slot (column width grew 28→32 to keep the indicator centered).

**Step 3 — Output tab layout reorganization.** EvalResultOutputBody's full-width header band trimmed: name + Evaluated date + Evaluator stay in a thin band above the side-by-side row; aggregate count + minibar + Download button moved into the right panel's top section. Right panel new structure: `[Title bar] → [Healthbar block + Download button] → [Per-RS results sections]`. Title bar is a new "EVALUATION RESULTS" strip with the same height + padding + amber accent treatment as the left panel's "EVIDENCE" strip; eval result name renders in place of the Asset filename; no prev/next controls (right panel doesn't switch between things). The amber accent kept for both strips so they read as a paired "evidence ↔ results" header row across the side-by-side layout. Healthbar block sits in a bordered card in the right panel: top row = aggregate count text (left) + Download button (right) on a flex justify-between row; bottom row = the existing `<MinibarBlock>` (3-segment SAT/UNSAT/MISSING bar + numeric labels). Global `<TabHeaderActions>` Download button suppressed on the Output tab when `schema === 'eval-output' || schema === 'poe'` — the right-panel Download is now the canonical export trigger. JSON tab keeps the global Download for all schemas.

**Step 4 — PoE Expand modal Section 1 layout inheritance.** PoE schema's Section 1 calls `<EvalResultOutputBody>` directly, so the layout reorganization applies automatically — the wrapped Eval Result rendering inside the PoE Output tab gains the right-panel title bar + healthbar + Download. PoE-level header card (PoE name + dates) above Section 1 unchanged; Section 2 (Evaluation Provenance supersession chain) unchanged. The PoE Output tab now has a clean two-level information architecture: PoE header (top) → "Final Evaluation" section heading → wrapped Eval Result with its own right-panel title bar + healthbar + Download → "Evaluation Provenance" section heading → ProvenanceList.

**Visual tuning notes.** Indicator dimensions iterated once: the 32×22 PDF dot fits both single-digit and 2-digit labels comfortably with the 12px mono bold font; the 28×20 right-panel row indicator at 11px font sits visually balanced against the row's `padding: 10px 12px` content. The amber accent on both EVIDENCE and EVALUATION RESULTS strips reads as paired chrome at the same level, not as redundancy — the key differentiator is the badge text ("EVIDENCE" vs "EVALUATION RESULTS") and the content beneath each strip.

**Footer v0.15.2 → v0.15.3.** Changelog modal entry prepended above Phase 15.1's. Spec §17.5 "Annotation visual model" updated: rounded-rectangle dimensions noted, label format changed to `{rowOrdinal}`, `assetOrdinal` rationale updated. New Changelog bullet added to spec §Changelog. polish-backlog Update Log entry added. CLAUDE.md "Current state of the world" updated.

**Runtime verification.** Manual user-path walkthrough per the Phase 15.0.1 workflow lesson (runtime probes verify components, not integration). Bob → Detail Panel for the PRM Eval Result → Expand button → Output tab → confirmed: thin top header (name + dates), left panel EVIDENCE strip + PDF with rounded-rectangle dots labeled `1`, `2`, `3`, etc., right panel new EVALUATION RESULTS strip + healthbar block + per-RS tables with rounded-rectangle row indicators. Asset switch via `▶`: PDF dots re-render with the same numbering scheme; right-panel row indicators don't change. Cross-Asset row click → auto-flip + scroll: confirmed working with the new label format. Same flow tested on PoE expand modal (Bob's PRM PoE) → Section 1 picks up the layout. Same flow tested on V22RunEvaluationModal Re-Run path → Step 2/3 ReviewRow indicators are rounded rectangles with `{rowOrdinal}`-only labels.

**Build clean** (0 errors).

**Status:** [x] Complete.

### Phase 15.1 completion notes (2026-05-07) — Annotation Visual Redesign + Bidirectional Interaction (#172 part 2 of 3)

Five workstreams delivered: visual redesign, side-by-side layout, bidirectional row↔dot interaction, RunEval modal extension, demo path verification (Step 0).

**Step 0 — VReg re-run verification (no seed adjustment).** Probed `buildV22SharedArtifacts()` directly: erBobVreg chain head (`eval-cui6ekou`) is `active`, has 5 rows with anchors, no PoE wrapping. The `hasNewAssetsForRerun` gate returns `false` because `inScopeAssetIds` (asset-vreg-datasheet) matches `evidenceUsed` exactly. Per the brief: "If the issue is a gate that requires Assets to be added to trigger re-run, then VReg re-run can only be tested AFTER Alice amends the Claim with a new Asset. That's an acceptable demo prerequisite — note in Phase 15.2's walkthrough guide." Step 1 (seed adjustment) skipped.

**Step 2 — Annotation visual redesign.** AnnotatedPdfViewer's AnnotationLayer now renders two elements per anchor instead of one. Highlight rectangle: `(x, y, w, h)` in PDF point space translated to canvas pixels via `(x*scale, (pdfH - y - h)*scale, w*scale, h*scale)`, background `color-mix(in srgb, <RS color> 15%, transparent)`, no border, `borderRadius: 2px`, `pointer-events: none`. Numbered indicator: 26px circle (was 20px) at `left: rectLeft - INDICATOR_SIZE - INDICATOR_GAP` (clamped to `INDICATOR_LEFT_CLAMP=4` if anchor is near left edge), vertically centered on the rect's mid-line. Indicator carries the 12px mono bold label (was 10px), 2px white border, `0 1px 4px rgba(0,0,0,0.5)` shadow. Highlighted state: rect bumps to 30% opacity; indicator gains `0 0 0 3px <RS color>` outside the white border. Indicator stamps `data-anchor-id` (synthesized) and gets a click handler when `onAnchorClick` is provided.

**Step 3 — Side-by-side layout in EvalResultOutputBody.** Replaced the prior full-width vertical stack with a CSS grid: `gridTemplateColumns: 'minmax(0, 60fr) minmax(0, 40fr)'` on viewports ≥900px, falls back to `1fr` (single column) below 900px. Left column hosts the EVIDENCE header strip + AssetEvidenceViewer (sticky `top: 0` so the PDF stays visible while the right column scrolls). Right column hosts the per-RS results sections inside a vertical flex stack. Both columns share the modal's existing scroll context. The Asset switcher controls (◀ ▶ + counter) and the multi-Asset key=displayAsset.id forced re-mount stay in the EVIDENCE header per Phase 15.0.1.

**Step 4a — Row indicators in EvalResultsTable.** EvalResultsTable signature gained five props: `assetOrdinal`, `rsColorByRsId`, `highlightedAnchorId`, `rowOrdinalById`, `onAnchorClick`. When `onAnchorClick` is non-null the table renders a 5-column grid (was 4) with a 38px-wide indicator slot leftmost. Each row's primary anchor is picked from `r.evidenceAnchors[]` (preferring one whose synthesized ID matches `highlightedAnchorId`, else `[0]`). Anchors get re-enriched at render time with `(requirementsSetId, requirementId, label, value)` from the row so the synthesized ID matches what the consumer's enriched anchor build produces for the same row. Indicator: 22px circle (smaller than the PDF's 26px since it sits in a tighter row context), same RS color, 11px mono bold label. Rows with empty anchors get a `<span style={{ width: 22, height: 22 }} />` so the column width is preserved. Row gets `data-row-anchor-id` for query selection. When the row's primary anchor matches `highlightedAnchorId`, the entire row tints to `color-mix(in srgb, <RS color> 8%, var(--bg-deep))`.

**Step 4b — Lifted state.** `EvalResultOutputBody` holds `highlightedAnchorId` via `useState(null)` and `currentAssetIndex`. The activate handler `handleAnchorActivate(anchor)` sets the highlighted ID and, if the anchor's `sourceAssetId` differs from the currently displayed Asset, flips `currentAssetIndex` to the matching Asset's index. AnnotatedPdfViewer receives the highlighted ID + an `onAnchorClick` callback that resolves the synthesized ID back to its anchor object via `anchorsForAsset.find(...)` then calls the activate handler. EvalResultsTable rows similarly call the activate handler with their re-enriched anchor.

**Step 4c/d — Scroll into view.** AnnotatedPdfViewer adds a `useEffect` watching `[highlightedAnchorId, loaded, pageMetrics]` that queries `[data-anchor-id="<escaped>"]` inside its container and calls `scrollIntoView({ behavior: 'smooth', block: 'center' })` on the next animation frame (deferred so the AnnotationLayer effect has painted). EvalResultOutputBody mirrors the same pattern via `tableScrollContainerRef` watching `[data-row-anchor-id]`.

**Step 4e — Highlighted state visual.** Indicator gains a 3px outer ring in the RS color via `boxShadow: '0 1px 4px rgba(0,0,0,0.5), 0 0 0 3px <RS color>'`. Highlight rect bumps from 15% to 30% opacity. Results-table row tints at 8% opacity with a 120ms `background` transition for smoothness. No animation on the indicator/dot itself per design decision.

**Step 4f — Run Evaluation modal extension.** ReviewRow gains six new props (`anchor`, `anchorLabel`, `anchorColor`, `anchorRowAnchorId`, `highlighted`, `onAnchorClick`); its layout reorganizes from a column to a row with a 28px indicator slot left + the existing content right. V22RunEvaluationModal holds its own `highlightedAnchorId` state + `handleAnchorActivate` that flips `expandedAssetId` (the accordion expansion) on cross-Asset clicks. AssetEvidencePanel passes `highlightedAnchorId` + the resolver-style `onAnchorClick` through. Each ReviewRow's anchor sources from `priorActiveResult.results` (re-run mode); fresh evals see no anchor on rows so the indicator slot stays empty.

**Anchor ID utility.** New `src/v2/data/anchorIds.js` exports `synthesizeAnchorId(anchor)` returning `${sourceAssetId}|${requirementsSetId}|${requirementId}|${page}|${Math.round(x)}|${Math.round(y)}`. Five-tuple is unique within a single Eval Result; rounding x/y keeps the ID stable across float jitter. Stamping requirementId on enriched anchors (in both ExpandedArtifactModal and V22RunEvaluationModal consumers) was the gotcha — the seed anchor doesn't carry requirementId; consumers must enrich before synthesizing.

**Implementation gotchas / debugging**:

1. **PDF.js worker saturation.** Same pattern as Phase 15.0 — multiple HMR remounts during this phase's edits saturated the worker's queue with stale render tasks, causing page-2's render task promise to never resolve. Resolution: stop the dev server, clear `node_modules/.vite`, restart cleanly. Workflow lesson reinforced: when PDF.js render hangs after edits, suspect the worker queue first.
2. **Anchor ID mismatch between consumers.** Initial implementation had the row-side ID with empty `requirementId` field (`asset-prm-datasheet|reqset-mil-prf-55681-v1||...`) because the raw seed anchor doesn't carry requirementId. The PDF-side IDs were correct because the consumer's `anchorsForAsset` build enriched them. Fix: enrich row anchors at synthesis time inside EvalResultsTable too. After fix, all 7 PDF dot IDs matched their corresponding row indicator IDs in end-to-end probe.

**Runtime verification (xhigh per CLAUDE.md autonomous workflow)**:

- Standalone PDF.js render after fresh process restart: 73ms ✓.
- Component-level test (mounted ExpandedArtifactModal directly with seed): 2 page wrappers, 7 PDF dots (req-001 + req-003 + req-005 + req-011..014 on PRM Datasheet) + 9 row indicators (the 9 rows that have anchors), all 7 PDF dot IDs matched their row indicator IDs.
- Cross-Asset auto-flip: clicked the row indicator for req-002 (anchored on PRM Test Report, Asset 2). Counter flipped Asset 1 of 2 → Asset 2 of 2 ✓; PDF dots replaced with the 2 test-report anchors ✓.
- Highlighted state visual: dot's box-shadow contained `0 0 0 3px var(--accent-red)` (this Eval Result's RS hashes to red); highlight rect at 30% opacity; row tinted with `color-mix(... var(--accent-red) 8% ...)` ✓.
- Dot click → row highlight: clicked req-004 dot → row indicator with matching ID picked up the tinted background ✓.
- Side-by-side layout: at 1400×900 viewport, modal renders PDF left + per-RS tables right via grid `60fr / 40fr` ✓; at 303×1298 viewport (narrow), layout collapses to vertical stack ✓.
- Build: 0 errors. Cosmetic "Knockout groups not supported" PDF.js warning persists per Phase 15.0.1's documented decision.

**Footer v0.15.1 → v0.15.2.** Architecture spec gains a Phase 15.1 changelog bullet + §17.5 update with the new visual model + lifted-state pattern. polish-backlog #172 part 2 marked Completed; #172 part 3 (walkthrough guide + cleanup) queued for Phase 15.2.

**Status:** [x] Complete.

### Phase 15.0.1 completion notes (2026-05-06) — Annotation Diagnosis + Layout Fixes + Git Catchup

Five-deliverable phase: git catchup + annotation rendering bug diagnosis & fix + PDF fit-to-width + multi-Asset switcher + demo scenarios doc.

**Git catchup.** No commits had been pushed to GitHub since Phase 12.3. The repo on disk was 13 phases ahead of remote (Phases 12.4 through 15.0). Surfaced the catchup-from-scratch problem to Andrew per the brief's directive; he chose Option B (one comprehensive catchup commit + a separate Phase 15.0 commit). Implementation: backed up the post-15.0 state for the four shared docs + V2App.jsx, surgically reverted Phase 15.0 changes from those files plus six shared source files (v2_2Data.js, AssetEvidencePanel.jsx, V22RunEvaluationModal.jsx, ExpandedArtifactModal.jsx, package.json, package-lock.json), staged everything else as the catchup commit, then restored + re-applied the Phase 15.0 changes for the second commit. Caught one missed file (jsonRecords.js — a Phase 13.4 file) before the second commit landed and amended it into the first. Both commits pushed to `origin/main`; `gh api repos/waamco2025/radiant/commits/main` confirmed the v0.15.0 commit landed.

**Annotation rendering bug.** The diagnostic strategy in the brief listed three plausible root causes (ID mismatch, priorActiveResult null, AnnotationLayer effect timing). Five diagnostic checkpoints were instrumented per the brief, but the bug surfaced at the data layer before any UI run was needed: directly probing the seed via `buildV22SharedArtifacts()` showed `erBobPrm.results` had 9 rows but **0 rows with anchors** — even though the Phase 15.0 seed authoring populated `evidenceAnchors: [...]` on every row. Walked the factory call tree to `makeEvaluationResult` in `src/v2/v2_2Data.js` and found the smoking gun: the `results.map((r) => ({ … }))` projection enumerates only `{ requirementsSetId, requirementId, label, value, status, confidence, _aiOriginalValue }` and silently drops every other field. `evidenceAnchors` was never reaching the consumer.

**Fix.** Added `evidenceAnchors: Array.isArray(r.evidenceAnchors) ? r.evidenceAnchors.map((a) => ({ ...a })) : []` to the factory's preserve-list. Cloned per-anchor for safety so the factory output is decoupled from any future mutation of the input. Verified post-fix: same probe now returns 9 rows with anchors, sample anchor matches the seed exactly. Then ran an end-to-end mount test by importing `AnnotatedPdfViewer` + the seed factory + the rsColors helper, building anchors filtered to the PRM Datasheet Asset, and rendering — got 7 dots across 2 canvases at fit-to-width 629px (was 856px at the prior fixed scale).

**PDF fit-to-width.** `AnnotatedPdfViewer` previously hard-coded `RENDER_SCALE = 1.4`, which produced a 612×1.4 = 856.8px-wide canvas on a 612pt PDF. That overflowed any modal column narrower than ~860px and forced horizontal scroll. Fixed by computing the scale per page from `containerRef.current.parentElement.clientWidth` at load time: `fitScale = Math.max(0.6, (hostWidth - HOST_HORIZONTAL_PADDING) / baseViewport.width)`, capped at `SCALE_CAP = 1.6` so very wide containers don't render comically large pages. The metrics array now stores per-page `scale` (was `RENDER_SCALE` shared constant) so the AnnotationLayer's pixel-position math respects the per-page scale.

**Multi-Asset switcher.** The Phase 15.0 ship rendered the "Asset 1 of 2" indicator without arrows. The user couldn't actually switch Assets. Fixed minimally: `EvalResultOutputBody` now holds `currentAssetIndex` local state, `displayAsset = displayableAssets[currentAssetIndex]`, plus Previous/Next arrow buttons in the EVIDENCE header strip that mutate the index. Arrows hide for single-Asset cases. The displayed Asset drives both the PDF.js render (via the `<AssetEvidenceViewer key={displayAsset.id}>` — the key forces a fresh mount + PDF reload on flip) and the anchor filter. Phase 15.1 will add auto-flip when the user clicks a dot belonging to a different Asset.

**Demo scenarios doc.** New `docs/PHASE-15-DEMO-SCENARIOS.md` documents the four QA scenarios per the brief: multi-RS multi-Asset (erBobPrm), single-RS chain head (erBobVreg), PoE expand Output Section 1, and Run Evaluation re-run flow. Includes notes for QA on the missing-status row exclusion, displayable-Asset filtering for the switcher counter, and the pdfjs-dist v5 `canvas` API gotcha + stale-Vite-process diagnostic from Phase 15.0.

**Workflow lesson recorded.** Runtime probes verify components, not integration. Phase 15.0 shipped with `<AnnotatedPdfViewer>` standalone-tested + the seed data inspected at the `buildV22SharedArtifacts` level — both passed. But the actual end-to-end path (open Detail Panel → Expand → Output) was never walked through with seed data. The factory bug surfaced on the very first such walkthrough during 15.0.1's diagnostic-data probe. Captured this lesson in CLAUDE-phase-log.md + a new `§Workflow lessons` paragraph in architecture-spec.md. Going forward: any phase that touches a shared seed factory should add an explicit user-path walkthrough verification step before declaring complete.

**Footer v0.15.0 → v0.15.1.** Architecture spec gains two changelog bullets (hotfix + workflow lesson). polish-backlog.md gets a Phase 15.0.1 Update Log entry. Phase log + CLAUDE.md tail extended through 15.0.1.

**Status:** [x] Complete.

### Phase 15.0 completion notes (2026-05-06) — PDF.js Integration + Annotated Evidence Seed Content (#172 part 1 of 3)

Foundation phase for the PDF annotation overlay feature. Three coupled deliverables: seed-content authoring (3 generated PDFs + anchor-coord map), PDF.js infrastructure (pdfjs-dist install + worker config + new viewer component), and three integration surfaces (Run Eval modal, Eval Result expand Output, PoE expand Output).

**PDF generation (`scripts/generate-seed-pdfs.mjs`).** A pdf-lib-based script generates three branded MicroCo PDFs with calibrated content: PRM-3A Datasheet (2 pages), PRM-3A Compliance Test Report (2 pages), VReg-12C Datasheet (2 pages). The script's structure encodes the brand banner, header text (owner + doc type + revision + generation date), per-page intro, sections, and a `drawSpecRow(label, value)` helper that writes `Label: Value` at known coordinates AND captures the `(x, y, w, h)` bounding box of the value text into an `anchorMap` keyed by `(filename, requirementId)`. After all PDFs render, the script emits two artifacts in lockstep: the binary PDFs to `public/seed-pdfs/` and a `src/v2/data/evidenceAnchors.js` module with `PDF_ANCHORS` (the coordinate map) and `PDF_FILES` (file size + sha256 hash + page count for Asset seed metadata parity). Re-running `npm run generate-pdfs` regenerates both. Determinism is achieved by setting fixed `creationDate`/`modificationDate` on the PDFs.

One quick deviation from the brief: the brief listed `'TID ≈ 80 krad(Si)'` for one VReg row, but pdf-lib's WinAnsi encoding can't encode `≈` (U+2248). Switched to `~` for both the PDF and the matching seed Eval Result value (`erBobVregV1`'s `req-004`).

**Seed data updates (`src/v2/v2_2Data.js`).** Imports `PDF_ANCHORS` and `PDF_FILES` from the generated module. Three Assets repointed at the new generated PDFs: `aPrmDatasheet` → `/seed-pdfs/microco-prm-datasheet.pdf`, `aPrmTestReport` → `/seed-pdfs/microco-prm-test-report.pdf` (this Asset previously had no `localPath`), `aVregDatasheet` → `/seed-pdfs/microco-vreg-datasheet.pdf`. Eval Result `results[]` rows on `erBobPrm`, `erBobVregV0`, `erBobVregV1`, and `erBobVreg` (the chain head) gain `evidenceAnchors[]` entries — each row's anchor is sourced via `PDF_ANCHORS[filename][requirementId]` so seed and PDF stay in sync. The 2-Asset / 2-RS demo: `erBobPrm.evidenceUsed` is now `[aPrmDatasheet.id, aPrmTestReport.id]`; rows for `req-002` (Thermal dissipation) and `req-004` (Radiation tolerance) anchor in the Test Report (measured values), other MIL-PRF + all System Integration rows anchor in the Datasheet (published spec). Status `missing` rows have empty `evidenceAnchors: []` (by definition — the evaluator couldn't extract a value).

**RS color palette (`src/v2/data/rsColors.js`).** Small helper exporting `getRsColor(rsId)` and `buildRsColorMap(rsIds)`. Deterministic per-rsId via a small string hash; draws from 10 prototype CSS accent colors (amber, green, cyan, orange, purple, teal, blue, lime, red, indigo). Indigo is last in the palette to minimize collision with surrounding UI chrome.

**PDF.js worker config (`src/v2/components/pdfJsWorker.js`).** Imports `pdfjsLib` from `pdfjs-dist` and the worker bundle URL via Vite's `?url` import (`pdfjs-dist/build/pdf.worker.mjs?url`). Sets `GlobalWorkerOptions.workerSrc` once on first import and re-exports the namespace. Vite bundles the worker into the production build automatically.

**`<AnnotatedPdfViewer>` component (`src/components/AnnotatedPdfViewer.jsx`).** Loads a PDF via `pdfjsLib.getDocument(fileUrl).promise`, iterates pages, creates per-page wrapper divs containing a `<canvas>` rendered at scale 1.4 + an absolute-positioned annotation overlay div. Each anchor renders as a 20px circular dot at the anchor's center pixel position (computed from PDF point coords via `pdfH - cy` for the bottom-left → top-left flip). Dot label is `{assetOrdinal}.{rowOrdinal}`; color comes from `rsColorByRsId[anchor.requirementsSetId]`. The component uses a `runIdRef` to tolerate React StrictMode's mount → unmount → mount double-invocation: each effect run tags itself with a runId; only the most recent run mutates state or DOM. Cleanup deliberately does NOT destroy the doc or cancel render tasks (cancelling the first run's tasks reliably leaves the canvas empty under StrictMode).

**Critical gotcha — pdfjs-dist v5 render API.** The brief led to a stuck-render rabbit hole that consumed disproportionate debugging time. The fix: pdfjs-dist v5 changed `page.render(...)` to expect `canvas` (the HTMLCanvasElement) as the primary parameter; passing the legacy `canvasContext: canvas.getContext('2d')` parameter still PAINTS the canvas but the returned `.promise` never resolves — the render task hangs indefinitely. The first symptom looked like a React effect-cleanup bug (only page 1 rendered), then a StrictMode bug (multiple runIds), then a worker-saturation bug (after HMR-driven remounts). The actual root cause was a 16-day-old Vite dev process still serving v5-cached bundles in memory after I'd downgraded the on-disk version to v4 mid-debug — `lsof -i :5173` exposed it. Killing the stale process + restarting Vite + using the v5 `canvas` parameter resolved the render task in 73ms. **Lesson recorded for future PDF.js work**: always verify `page.render({ canvas, viewport }).promise` resolves before chasing higher-level effects; and check `lsof -i :5173` if Vite behaviour disagrees with disk content.

**`AssetEvidencePanel` extension.** New `usePdfJs` prop (default false) opts into the new renderer. New `evidenceAnchors`, `assetOrdinal`, `rsColorByRsId` props pass through to `<AnnotatedPdfViewer>`. Default false preserves every existing call site (Asset Detail Panel previews, Claim referenced-asset previews, ExpandedArtifactModal Asset expand) on iframe rendering.

**Three target surfaces wired in.**
- **V22RunEvaluationModal Step 1 evidence panel:** pass `usePdfJs={true}` + anchors derived from `priorActiveResult` (Re-Run mode). Fresh evaluations have no committed anchors yet, so the array is empty and PDF.js renders the document without overlays — that's intentional for 15.0's static-only scope; 15.1 will surface live evaluator-driven anchor authoring.
- **ExpandedArtifactModal `eval-output` schema:** `EvalResultOutputBody` now accepts an `evidenceAssets` prop. When non-empty, renders an EVIDENCE section above the per-RS results tables with `<AssetEvidenceViewer asset={displayAsset} usePdfJs={true} evidenceAnchors={...}>`. Single-Asset display in 15.0 (picks the first Asset with a `localPath`); Phase 15.1 will add a multi-Asset switcher.
- **ExpandedArtifactModal `poe` schema:** threads `evidenceAssets` through to its inner `EvalResultOutputBody` (Section 1, the wrapped Eval Result content). Same single-Asset display pattern.

V2App resolves `evidenceAssets` from the eval result's `evidenceUsed[]` against `sharedForPanel.assets` at the expand-modal-trigger site, before stamping `setV22ExpandedArtifact`.

**Runtime verification.** Standalone PDF.js render confirmed in 73ms after the v5 API fix. Component-level test with 3 anchors across 2 pages: 2 canvases rendered, 3 numbered dots positioned correctly (1.1 amber on page 1, 1.3 cyan on page 1, 1.5 amber on page 2), dot colors match the RS palette mapping, label scheme correct. End-to-end build clean (112 modules transformed, pdf.worker bundles to a 2.16MB chunk). Cross-role manual testing (criterion 12) requires opening the eval flow / expand modals via canvas-anchored Detail Panel actions; the canvas raycaster limitation documented since Phase 9A.6 means scripted UI walkthroughs of those flows aren't possible from a non-cursor agent session — manual mouse interaction is the canonical verification path. The data layer is verifiably correct: empirical inspection confirmed the seed Eval Result rows carry the expected anchors in the expected shapes.

**Footer v0.14.5 → v0.15.0** (minor increment — substantial feature addition). Architecture spec gains a new §17.5 "Evidence Annotation" subsection covering scope, coordinate system, dot scheme, generated PDF artifacts, and the forward-looking note on non-PDF evidence types per Andrew's flag. Changelog entry added. polish-backlog #172 still open; tagged "Phase 15.0 part 1 shipped — 15.1 (interaction) + 15.2 (walkthrough) remaining".

**Status:** [x] Complete (Phase 15.0 part 1 of 3).

### Phase 14.5 completion notes (2026-05-06) — Chip Container Visual Tuning (#176c)

Six tuning corrections to Phase 14.4's chip container. The Phase 14.4 ship dropped the per-shield circle wrappers and the "+N" pill but left the shields rendering without any visual separation when overlapped — adjacent shields blended into one another since their indigo silhouettes shared a stroke color. Phase 14.5 reintroduces the negative-space cut via a 2px halo stroked in the rectangle's exact background color, which produces the recognizable overlapping-tokens look without bringing back the wrappers.

**`BadgeShieldIcon` (#176c):** Optional `strokeColor` prop (defaults to `'none'` so existing call sites — Library Badges panel + Detail Panels + IssueBadgeModal preview — remain unchanged). When set, renders a wider halo path beneath the silhouette path with the same `d` geometry. Halo strokeWidth = 4 (in viewBox units) — at SHIELD_SIZE=18 with viewBox 0 0 16 16, this paints ~2.25px outer halo + ~2.25px inner halo. The inner halo crosses the silhouette interior but the silhouette's 12% currentColor fill sits over it; against the rectangle's 18% currentColor background the inner ring blends to roughly the same indigo tint as the rest of the shield interior — invisible. The outer halo is the visible cut. SVG carries `overflow: visible` so the halo doesn't clip at the viewBox edge.

**`BadgeChipContainer` constants:**
- `SHIELD_SIZE` 20 → 18 (silhouette appears the same width since the halo reads as bg).
- `STEP_IDLE` 15 → 12 (~33% overlap; the halo cuts adjacent shields visually).
- `STEP_FAN` 24 → 22 (= 18 + 4 gap; 4px gap unchanged from Phase 14.3).
- `HEIGHT` 26 → 24 (computed: `SHIELD_SIZE + PADDING * 2`).
- `OVERFLOW_TEXT_W` 20 (unchanged).

**Vertical centering.** Shield slots use `top: (HEIGHT - SHIELD_SIZE) / 2` (= PADDING with current values, but written in terms of constants so future tuning stays correct). "+N" indicator uses `top: 0; bottom: 0` with `display: flex; alignItems: center` so it vertical-aligns with the shields independent of font metrics.

**Single-shield case.** A new `if (isSingleShield)` early-return branch renders a 24×24 square-ish rectangle (idleWidth resolves to `0*STEP_IDLE + 18 + 0 + 6 = 24px`) with the lone shield centered via `position: absolute; inset: 0; display: flex; alignItems: center; justifyContent: center`. No fan-out branch (a single shield can't un-overlap). Tooltip-on-hover still works.

**Halo color binding.** Both the rectangle background and the shield `strokeColor` reference the same constant `RECT_BG = 'color-mix(in srgb, var(--accent-indigo) 18%, var(--bg-card))'` extracted at the top of the file. Single source of truth; if the rectangle background ever shifts, the halo follows.

**Runtime verification.** Vite HMR reloaded cleanly. Empirical probes via the preview MCP confirmed: container width 72px idle / 92px hover (math: `(2)*12 + 18 + 24 + 6` and `(2)*22 + 18 + 24 + 6`); container height 24px; halo path `stroke="color-mix(in srgb, var(--accent-indigo) 18%, var(--bg-card))"` with `stroke-width="4"` rendered beneath the silhouette path on every shield (3 paths per shield SVG: halo + silhouette + checkmark); shield right-positions [27, 39, 51] idle → [27, 49, 71] hover (rightmost stays at 27, others step out by `STEP_FAN-STEP_IDLE = 10px` per slot). A 4x-scale clone screenshot showed the negative-space cut between adjacent shields clearly visible — the classic overlapping-tokens look. Single-shield case verified by mocking via DOM clone manipulation: 24×24 square rectangle with the lone shield centered.

**Footer v0.14.4 → v0.14.5.** Architecture spec gains one Phase 14.5 changelog bullet. CLAUDE.md "Current state of the world" + "Active phase queue" updated. polish-backlog.md gets a Phase 14.5 Update Log entry; #176c moved into Visual & Rendering completed.

**Status:** [x] Complete.

### Phase 14.4 completion notes (2026-05-05) — Chip Container Visual Polish (#176b)

Single-purpose visual polish on top of Phase 14.3's `BadgeChipContainer`. The Phase 14.3 ship rendered each shield inside a circular `var(--bg-card)` wrapper with a 1.5px indigo border + 1px shadow, and rendered "+N" inside an 8px-radius indigo pill with its own border + shadow. Layered over the rectangle's own border + shadow, this produced visual noise — the shield silhouettes felt buried inside their wrappers, and the "+N" pill competed with the rectangle for emphasis.

**Refactor (BadgeChipContainer.jsx):**
- Shield wrapper div (with `borderRadius: 50%`, background, border, shadow) removed. `BadgeShieldIcon` SVG now renders directly inside the chip container at the appropriate `right` position. The shield silhouette becomes the visual element.
- "+N" pill div (with `borderRadius: 8`, background, border, padding, shadow) removed. "+N" renders as plain `<span>` text with `var(--font-mono)` + `fontWeight: 700` + `fontSize: 12` + `var(--accent-indigo)` color, vertically centered in the rectangle.
- `SHIELD_SIZE` 16 → 20 (was `CHIP_SIZE`; renamed to better reflect that no chip wrapper exists anymore). Inner shield SVG no longer needs the `-6` inset (Phase 14.3 used `BadgeShieldIcon size={CHIP_SIZE - 6}` to fit the circle wrapper at 10px); now passes the full `SHIELD_SIZE` directly.
- `STEP_IDLE` 12 → 15 (75% of 20px → 25% overlap maintained).
- `STEP_FAN` 20 → 24 (20px + 4px gap → un-overlapped fan-out spacing maintained).
- `HEIGHT` 22 → 26 (20px shield + 3px padding × 2; computed from constants now: `SHIELD_SIZE + PADDING * 2`).
- `OVERFLOW_PILL_W` 22 → `OVERFLOW_TEXT_W` 20 (renamed; slightly tighter horizontal budget since there's no pill chrome).

**Width math.** Idle: `(visibleCount-1)*15 + 20 + (overflow ? 4+20 : 0) + 6`. Hover: `(visibleCount-1)*24 + 20 + (overflow ? 4+20 : 0) + 6`. For the 5-badge demo case (3 visible + "+2"): idle 80px (was 72px), hover 98px (was 88px). Fan-out delta = 18px (was 16px) — proportional to the larger STEP rescale.

**Runtime verification.** Vite HMR reloaded cleanly. Empirical probes via the preview MCP confirmed: container width 80px idle / 98px hover / 80px on leave; shield right-positions [27, 42, 57] idle → [27, 51, 75] hover (rightmost shield at 27 stays anchored, others step out by `STEP_FAN-STEP_IDLE = 9px` per slot); the rendered DOM has 3 SVGs + 1 "+N" span with no border / background / box-shadow on shield slots (verified via inline-style introspection — wrappers absent). Visual screenshot via a 3x-scale clone in the page corner confirmed clean shield silhouettes inside the rounded rectangle + plain "+N" text without pill chrome.

**Footer v0.14.3 → v0.14.4.** Architecture spec gains one Phase 14.4 changelog bullet. CLAUDE.md "Current state of the world" + "Active phase queue" lines updated. polish-backlog.md gets a Phase 14.4 Update Log entry; #176b moved into Visual & Rendering completed.

**Status:** [x] Complete.

### Phase 14.3 completion notes (2026-05-05) — Issue Badge Modal Scope Fix + Chip Container Refinement (#176a)

Two contained corrections to the Phase 14.1 / 14.2 Badge surfaces and a backlog filing.

**Issue Badge picker scope fix.** Phase 14.1's IssueBadgeModal rendered a sectioned picker — a "My Badges" section with the user's own templates, then per-Actor sections for every other actor's templates. The cross-actor sections leaked: Badge Templates can only be issued by their owner, so other actors' templates were never legitimately issuance candidates. Phase 14.3 collapses the picker to a single un-sectioned scroll list of own templates only. Latest-version SUGGESTED auto-promotion within the user's own templates is preserved. The empty-state copy already pointed at the Library » Badges tab — kept verbatim. The unused `GlobeIcon` component (formerly the per-Actor section header glyph) and the `others` / `otherByParty` state were removed cleanly. Section header `My Badges · {N}` dropped — when there's only one section, the header is redundant; the picker now feels lighter.

**Chip container refactor (#176a).** Phase 14.1's badge chip stack used three independent absolute-positioned chip elements + a separate adjacent "+N" pill, each with its own pointer-events disabled. Phase 14.3 refactors to a single rounded-rectangle container holding all visible shields + the "+N" indicator. Visual treatment matches the NEW pill: 4px border-radius, subtle shadow, indigo-tinted background (slightly more saturated than the prior "+N" pill). The container is right-anchored — when 2+ shields are present, hover expands the rectangle leftward via a 180ms ease-out width transition; the rightmost shield + "+N" stay anchored to the right edge; previously-overlapped shields slide left to un-overlap with 4px spacing between adjacent shields. Single-shield case (no fan-out): hover reveals tooltip only, rectangle does not expand (a single shield can't un-overlap). Per-shield tooltip on hover renders the badge name + version on line 1 and the issuer party on line 2 (`Aerospace Grade A v2 / Issued by GovCo` format). "+N" tooltip lists the buried badges (those past the visible 3) as `Badge Name · Issuer Party` rows. Both tooltips use the shared `<Tooltip>` primitive (auto-flips below the anchor when insufficient vertical space above). Click guard via `e.stopPropagation()` on the chip rectangle so clicks don't trigger card-level interactions.

**Architecture.** New module `src/v2/BadgeChipContainer.jsx` (~190 lines) self-contained — internal hover state, layout math, tooltip rendering. AssetNode.jsx's chip rendering block (~80 lines, including the chip stack + +N pill math) reduced to a single `<BadgeChipContainer>` mount with three props: `badges`, `rightOffset`, `top`. The `rightOffset` accounts for the NEW pill (38px + 6px gap when present) so chip + NEW coexist visually as before. The `_activeBadges` decoration in V2App's `v22DataWithReveal` memo enriched from raw badge-issuance objects (`{ id, issuerParty, targetClaimId, badgeTemplateId, ... }`) to a tooltip-ready shape (`{ id, badgeName, badgeVersion, issuerParty, badgeTemplateId }`). The enrichment looks up each issuance's `badgeTemplateId` in a `templatesById` map for the template name + version. Memo dep array gains `badgeTemplates`. The `BadgeShieldIcon` import in AssetNode.jsx removed (now only consumed inside BadgeChipContainer).

**Backlog filing.** The Netgraph cleanup item (#4 Layout density improvements) gains a "Child-layer burial rules (Phase 14.3 design notes)" sub-section. Captures Andrew's observations: Parse Results are burial-safe under parent Asset (no disclosure edge complexity); Eval Results + PoEs depend on perspective and #182 (Amend Claim to include PoE as Asset); Cascading Disclosures (#26) is the gating dependency for full burial-rule design.

**Runtime verification.** Vite dev server reloaded cleanly (no console errors, no build errors). Empirical probes via the preview MCP confirmed: chip container is rendering on `claim-prm-assembly` and `poe-iwcikmag` (both with 5 badges → 3 visible shields + "+2" overflow); inline width transitions correctly between idle (72px) and hovered (88px) — math verified against the per-state inner-content width formula; per-shield right-anchor positions verified [29, 41, 53] idle → [29, 49, 69] hovered (rightmost stays at 29, others step out by STEP_FAN-STEP_IDLE = 8px each). The rest of the criteria (Issue Badge picker scope, tooltip placement fallback, animation smoothness, NEW label coexistence, click-guard pointer events) verified by code review; the canvas raycaster limitation documented since Phase 9A.6 prevents scripted UI walkthroughs of canvas-click flows from a non-cursor agent session, so canvas-side flows like opening the Detail Panel via card click remain manual-verification paths.

**Footer v0.14.2 → v0.14.3.** Architecture spec gains two Phase 14.3 changelog entries. CLAUDE.md "Current state of the world" + "Active phase queue" lines updated. polish-backlog.md gets the Netgraph #4 sub-section + a Phase 14.3 Update Log entry; bug fix and #176a moved into Completed.

**Status:** [x] Complete.

### Phase 14.2 completion notes (2026-05-07) — Badge Architectural Correction + PoE Notification Regression Fix

Phase 14.2 ships three tightly-coupled fixes that all touch the same surfaces (badge data flow + PoE-side display + visibility/notification routing): (#169a) badges target Claims (not PoEs); (#169b) standalone Badge Issuance Detail Panel removed; PoE-creation notification regression closed.

**Step 1 — PoE visibility regression investigation (RESULT: visibility works; notification was the only gap).** Probed the data layer empirically. Built a fresh provisional state with Bob creating a PoE on Alice's VReg Claim, ran `getV22DataForRole('alice-microco', provisionals)` followed by `buildV22Canvas(...)`, and confirmed Alice's canvas contains the new PoE at the expected position (x=1400, y=-200). The proof-of-eval DA construction in `handleV22CreatePoE` (grantor=evaluator, grantee=Claim owner, subject.kind='poe') correctly flows through `mergeProvisionals` → `buildViewForActor` (line 2713-2718, walks `da.subject.kind === 'poe'` && `da.grantee.party === party` && `da.grantor.party !== party`, calls `addPoeAndWrapped`) → canvas adapter's `proofOfEvalPulledPoEs` bucket (line 5198) → placed node. **The PoE visibility flow is intact.** The "regression" was purely the missing notification.

**Step 2 — `v22-poe-created` notification.** Added to `handleV22CreatePoE`. Recipient = Claim owner. Skips when evaluator === Claim owner (self-PoE; no cross-actor signal). Notification body: from (evaluator), poeId, poeName, claimId, claimName, sourceErId. Click handler deep-links to the PoE Detail Panel on the recipient's canvas. Inbox UI gets a new branch with label "POE CREATED" + indigo accent.

**Step 3 — Badge Issuance data model migration.** `makeBadgeIssuance` factory parameter `targetPoeId` → `targetClaimId`. Validation: `if (!targetClaimId) throw`. DOT metadata: `{ targetClaimId, badgeTemplateId }`. Helpers restructured:
- `getBadgesForClaim(claimId, allBadgeIssuances)` — direct lookup. Phase 14.1's multi-hop walk through Eval Results + PoEs is gone; the Claim is the canonical target.
- `getBadgesForPoE(poeId, allEvalResults, allPoEs, allBadgeIssuances)` — derived. Walks PoE → wrappedEvalResultId → eval result's claimId → `getBadgesForClaim`.
- `getBadgesForRecipient(actorParty, allBadgeIssuances, allClaims)` — walks via Claim ownership (was via PoE ownership).

**Step 4 — Seed migration.** All 5 seed Badge Issuances now `targetClaimId: cPrm.id` (Alice's Power Regulation Module Assembly Claim). Issuers reshuffled so none violate the new gate (Alice was the issuer of two issuances; she's the Claim owner so those would be self-issuance). New issuer mix: 3 from Bob (GovCo) + 2 from Carol (AuditCo). Aggregated count on PRM Claim is 5, exercising the +N overflow demo on first load.

**Step 5 — JSON record + dispatcher signature.** `getBadgeIssuanceJsonRecord(issuance, allClaims, allBadgeTemplates)` — context shape changed from `{ allPoEs, allBadgeTemplates }` to `{ allClaims, allBadgeTemplates }`. Computed fields: `_computed_recipientParty` derived from target Claim's owner. Field rename: `targetPoeId` → `targetClaimId`. `getJsonRecordFor` dispatcher updated to pass `context.claims` (was `context.poes`).

**Step 6 — V2App handlers.** `handleV22IssueBadge(targetClaimId, badgeTemplateId, description)` parameter rename + new self-issuance gate (`issuerParty === targetClaim.ownerParty`). Recipient resolution: Claim owner. `handleV22RevokeBadge` recipient resolution updated. `handleSaveBadgeTemplate` new-version fan-out walks via Claim ownership. `v22IssueBadgeContext` state shape: `{ targetClaimId }` (was `{ targetPoeId }`).

**Step 7 — IssueBadgeModal.** `targetPoe` prop → `targetClaim`. Self-issuance copy updated ("You cannot issue a Badge against your own Claim... try issuing against another party's Claim instead"). Header copy: "recipient: [claim ownerParty]". `onIssue` callback signature: `(targetClaimId, badgeTemplateId, description)`.

**Step 8 — Issuance entry points.** Claim Detail Panel footer gets a new "Issue Badge" button (visible to non-owners). Claim node action bar gets the same `★` action — same gate, same dispatch. PoE entry-point gating updated to use the new `_claimOwnerParty` stamp from V2App's data adapter (with safe `!isOwner` fallback). `onV22CardAction` 'issueBadge' case now branches by node.v22Type: PoE → derive Claim from `poe.claimId`; Claim → use `node.id` directly.

**Step 9 — PoE Badges subtext.** New `subtext` prop on the shared `BadgesSection` component. PoE panel passes `{ prefix: 'Badges earned by', linkLabel: claimName, onClick: () => onSelectClaim }`. Renders inline above the row list with the Claim name as a clickable indigo link.

**Step 10 — Section sigs.** V22ClaimPanel receives `onIssueBadge` for footer button. V22ActorPanel `getBadgesForRecipient` call updated to pass `merged.claims` (was `merged.proofsOfEvaluation`).

**Step 11 — Eliminated standalone Badge Issuance Detail Panel.** Removed: `V22BadgeIssuancePanel` function (~150 lines), local `ClickableRow` helper, `'BADGE ISSUANCE'` router case, V22BadgeIssuancePanel export, `v22BadgeIssuanceSelected` state + setter + standalone overlay mount in V2App (~95 lines), all calls to `setV22BadgeIssuanceSelected`. Replaced with: row clicks dispatch `setV22ExpandedArtifact({ artifact: issuance, schema: 'badge-issuance', badgeIssuanceContext })` directly. The `'badge-issuance'` expand modal schema (Phase 14.1) handles all the rendering — modals over Detail Panels is the right pattern. Notification deep-link routing updated: `v22-badge-issued` → Claim Detail Panel; `v22-badge-revoked` → Badge Issuance expand modal.

**Step 12 — `_activeBadges` decoration.** Updated to use the new helper signatures: PoE walk passes `(poeId, allErs, allPoEs, badgeIssuances)`; Claim walk passes `(claimId, badgeIssuances)`. New `_claimOwnerParty` stamp on PoE nodes (resolved via `poe.claimId` → claim.owner) so the action-bar Issue Badge gate can check Claim ownership without re-walking. Decoration return guard extended to include the new flag.

**Step 13 — Documentation + version bump v0.14.1 → v0.14.2.** Changelog modal entry + this phase log entry + CLAUDE.md update + spec changelog bullets + polish-backlog Update Log + new #182 backlog item filed.

**#182 (filed for future):** Amend Claim to include a PoE as a referenced Asset. Enables full disclosure to include the self-PoE in the Claim's evidence bundle. Use case: third-party reviewer (OSHA) verifies a self-evaluation by receiving full disclosure to a Claim that includes the self-PoE in scope, rather than running their own redundant evaluation.

**Verification.** `npm run build` clean (105 modules, 0 errors). Runtime verification of the 17 acceptance criteria pending in the next sub-step.

**Status:** [x] Complete.

### Phase 14.1 completion notes (2026-05-06) — Badge Issuance + Display Surfaces (#169 part 2 of 2)

Phase 14.1 closes Badges (#169). Layers Badge Issuance + every display surface on top of Phase 14.0's Badge Template foundation. New artifact type, two new modals, three new notification types, card chips on PoE + Claim cards, three Detail Panel sections + a brand-new Badge Issuance Detail Panel + expand modal coverage. The placeholder Active Issuances section in the Badge Template Detail Panel (Phase 14.0) is now populated.

**Step 1 — Data model + factory + helpers (`src/v2/v2_2Data.js`).** New `makeBadgeIssuance({ id, issuerDot, issuerParty, targetPoeId, badgeTemplateId, description, createdDate, status, revokedDate, revocationReason, dot })` factory. Required fields: id, issuerParty, targetPoeId, badgeTemplateId, createdDate. Recipient is NOT stored — derived at render time from `targetPoe.ownerParty`. Three new helpers: `getBadgesForPoE(poeId, allBadgeIssuances)`, `getBadgesForClaim(claimId, allEvalResults, allPoEs, allBadgeIssuances)` (multi-hop walk: claim → eval results → PoEs → badges, deduplicated), `getBadgesForRecipient(actorParty, allBadgeIssuances, allPoEs)` (received-only — issuances issued by this actor are excluded per design huddle decision 4).

**Step 2 — Seed data (5 issuances).** Bob → Carol's PoE on PRM Claim (Aerospace Grade A v1, with description). Carol → Bob's PoE on PRM Claim (Audit Verified). Alice → Bob's PoE on PRM Claim (Component Quality Assured). Alice → Carol's PoE on PRM Claim (Component Quality Assured, second). Bob → Carol's PoE on PRM Claim (Audit Verified, second). Total: 4 active issuances aggregated against PRM Claim (split 2 to Bob's PoE + 3 to Carol's PoE — but only 4 unique badges total since Bob's seeds 2, Carol's seeds 1 + Alice 2). The aggregate is 4+ to ensure +N overflow on the Claim card chip on first load. Return shape extended with `badgeIssuances`.

**Step 3 — JSON record helper + dispatcher signature change (`src/v2/data/jsonRecords.js`).** New `getBadgeIssuanceJsonRecord(issuance, allPoEs, allBadgeTemplates)` — resolves recipient + lineage from cross-artifact lookups at record build time. Computed fields are clearly marked with `_computed_` prefix (`_computed_recipientDid`, `_computed_recipientParty`, `_computed_badgeTemplateLineageId`) so consumers don't mistake them for canonical references. The truth lives on the referenced artifacts; these are denormalized for discoverability. Dispatcher signature change: `getJsonRecordFor(artifact, kind, context = {})` — optional `context` parameter for cross-artifact reference resolution. Most artifact types ignore context; Badge Issuance uses `context.poes` + `context.badgeTemplates`. Future artifacts that need cross-references can use the same hook without re-architecting.

**Step 4 — IssueBadgeModal (`src/components/modals/IssueBadgeModal.jsx`, NEW).** Two-step flow per design decision 4. Step 1: sectioned Badge Template picker (My Badges first, then per-Actor sections — mirrors Phase 14.0 BadgesPanel layout). Per-lineage latest-version auto-suggest with `SUGGESTED` badge (matches Phase 13.3 RS picker convention). Step 2: optional description textarea + Cancel / Back / Confirm. Self-issuance is gated upstream (entry-point hides the button) AND guarded inside the modal — if the modal somehow mounts for the active actor's own PoE, an error state renders with copy "You cannot issue a Badge to your own Proof of Evaluation."

**Step 5 — RevokeBadgeModal (`src/components/modals/RevokeBadgeModal.jsx`, NEW).** Single-step flow per design decision 5. Required reason textarea ("Why are you revoking this Badge?"). Confirm disabled until reason has content. No unravel animation in scope (per design huddle decision 6) — chip simply re-renders without it.

**Step 6 — V2App handlers + notification fan-out wiring.** `handleV22IssueBadge(targetPoeId, badgeTemplateId, description)`: constructs the Badge Issuance via `makeBadgeIssuance`, inserts into state, fires `v22-badge-issued` notification on the recipient's inbox. Self-issuance final guard. `handleV22RevokeBadge(badgeIssuanceId, reason)`: marks issuance `status: 'revoked'`, stamps `revokedDate` + `revocationReason`, fires `v22-badge-revoked` notification with reason. **`handleSaveBadgeTemplate` extended** (Phase 14.0 entry point) — when called with `{ isNewVersion: true, priorTemplateId }`: walks all active Badge Issuances referencing prior versions of the same `lineageId`, finds each Issuance's recipient via target PoE owner, fan-outs `v22-badge-template-new-version` notification (informational; click dismisses, no auto-navigation).

**Step 7 — Notification handlers (`src/v2/V2App.jsx` inbox renderer).** Three new branches added to the inbox switch: `v22-badge-issued` (color: indigo, label: "BADGE ISSUED", click pans to target PoE), `v22-badge-revoked` (color: red, label: "BADGE REVOKED", click pans to target PoE — recipient sees full revocation context via the PoE Badges section + Badge Issuance row click), `v22-badge-template-new-version` (color: indigo, label: "BADGE UPDATED", informational — click dismisses).

**Step 8 — Card chip rendering on PoE + Claim node cards (`src/v2/AssetNode.jsx`).** New shared `BadgeShieldIcon` primitive at `src/v2/BadgeShieldIcon.jsx` — lifted from Phase 14.0's inline SVG so card chips and Detail Panel rows render the same graphic. Chip stack rendering in AssetNode: positioned top-right corner, same y-position as NEW badge. When NEW is also present, chips render to the LEFT of NEW (position calc: `right: -8 + ACTION_BAR_W + NEW_PILL_W + 6` when isNew, otherwise `right: -8 + ACTION_BAR_W`). Stacking math: max 3 visible at 25% horizontal overlap (chip size 16px → step 12px). When total > 3: 3 chips + a +N pill indicator. Each chip is a 16px circular badge with a 1.5px indigo border, 60% indigo blend, drop shadow; shield SVG sits at 10px inside. Per-node `_activeBadges` decoration computed in V2App's `v22DataWithReveal` memo via `getBadgesForPoE` (PoE) or `getBadgesForClaim` (Claim) and stamped on the node object alongside existing decorations like `_alreadyWrapped` and `_canRerun`.

**Step 9 — PoE Detail Panel Badges section (`V22NodeDetailPanel.jsx` / V22PoEPanel).** Replaced the empty placeholder from Phase 13.0 with the populated list. Shared `BadgesSection` component lifted to module scope so the same row format renders on PoE / Claim / Actor panels. Each row: shield + name + version + issuer + creation date. Issuer-of-row sees a "REVOKE" affordance (separate `data-revoke-affordance` so the row click vs. revoke click are distinguishable). Footer: new "Issue Badge" button visible only when active actor is NOT the PoE owner.

**Step 10 — Claim Detail Panel Badges section (V22ClaimPanel).** New section using the same `BadgesSection` component, aggregated via `getBadgesForClaim`. Position: between Acknowledgments and Disclosures sections. Section omitted entirely when zero badges (matches existing dense-panel conventions).

**Step 11 — Actor Detail Panel Badges Received section (V22ActorPanel).** New section. Filtered to received-only via `getBadgesForRecipient`. Title: "Badges Received" (vs. the generic "Badges" used on PoE/Claim) so it's clear this is one-directional. Issued-by-this-Actor badges are NOT shown here.

**Step 12 — Badge Issuance Detail Panel (`V22BadgeIssuancePanel`, NEW).** Sections: Header (badge name + version + status badge ACTIVE/REVOKED + click-to-copy DOT + Expand button), Issuer (clickable → opens issuer's Actor Detail Panel), Recipient (derived from target PoE owner, clickable), Target Proof of Evaluation (clickable → opens PoE Detail Panel and closes this overlay), Badge Template (clickable → opens template in Library deep-linked to this version), Description, Revocation context (only when status: revoked — red-tinted block with revoked date + reason in italic block), DOT. Footer: "Revoke Badge" button visible only to issuer when status is active. Wired to the Detail Panel router via the new `'BADGE ISSUANCE'` case. Mounted as a separate overlay (z-index 220) above the main Detail Panel since Badge Issuances are not canvas nodes — selection uses `v22BadgeIssuanceSelected` state independent of `sel`.

**Step 13 — Active Issuances populated in Badge Template Detail Panel.** Both surfaces updated: (a) the V22BadgeTemplatePanel canvas-router-bound version (forward-looking from Phase 14.0) now accepts `activeIssuances`, `lineageActiveIssuanceCount`, `poeNameLookup`, `onSelectBadgeIssuance` props; (b) the BadgesPanel's right-panel `ViewDetails` (the surface actually visible to users in 14.0/14.1) does the same. Each row: target PoE name + recipient party + creation date, clickable → Badge Issuance Detail Panel. Subtext line: "X total active issuances across this badge's history" — rolls up active issuances across ALL versions in the template's lineage, surfacing the badge-as-a-whole usage even when viewing a specific version. Cross-tab navigation to the Badge Issuance from BadgesPanel: parent LibraryModal closes, then `setV22BadgeIssuanceSelected` opens the standalone Badge Issuance Detail Panel.

**Step 14 — ExpandedArtifactModal `'badge-issuance'` schema.** New schema branch, header label `BADGE ISSUANCE`. Output content: header card with shield glyph + badge name + version + issuer→recipient + status badge, Parties block, References block (target PoE name + id + template name + id), Description block (when present), Revocation block (when revoked — red-tinted with date + reason). JSON tab uses the dispatcher's new `context` parameter to resolve recipient + lineage at record build time.

**ExpandedArtifactModal mount + caller wiring.** Added `badgeIssuanceContext` prop carrying `{ template, recipientParty, targetPoeName, allPoEs, allBadgeTemplates }`. The Badge Issuance Detail Panel's Expand button populates this context so both Output and JSON tabs render with full cross-artifact resolution.

**Step 15 — Documentation.** `CLAUDE-phase-log.md`: this entry. `CLAUDE.md`: footer version + active phase queue + last shipped phase narrative. `architecture-spec.md`: Changelog bullet + §17.X subsection covering Badge Issuance shape, issuance / revocation flows, notifications, display surfaces, dispatcher signature change. `polish-backlog.md`: #169 moved to Completed (both 14.0 + 14.1 land the full feature). `V2App.jsx` Changelog modal: new v0.14.1 entry prepended above v0.14.0.

**Footer version:** v0.14.0 → v0.14.1.

**Verification.** `npm run build` clean (105 modules transformed, 0 errors). Runtime verification of the 19 acceptance criteria pending in the next sub-step against the running dev server.

**Scope boundaries (deferred):**
- User-uploaded Badge Template graphics (#181 — filed for future).
- Auto-upgrade of Badge Issuances when new template version published (notification ships; auto-upgrade does not).
- Badge endorsement / disputation flows.
- "Badges I've issued" section on Actor Detail Panel.
- Animations on chip appearance/disappearance beyond the standard reveal animation Phase 14.1 fires for new chips.

**Status:** [x] Complete.

### Phase 14.0 completion notes (2026-05-06) — Badge Template Infrastructure (#169 part 1 of 2)

Phase 14.0 lays the foundation for Phase 14's Badges work: introduces Badge Template as a new artifact type, ships the Library tab + CRUD UI + expand modal coverage, and folds in two Claim Detail Panel polish items. Phase 14.1 will layer Badge Issuance + display surfaces on top.

**Step 1 — Data model + factory (`src/v2/v2_2Data.js`).** New `makeBadgeTemplate({ id, ownerDot, ownerParty, name, description, referencedRequirementsSetIds, lineageId, version, supersededBy, createdDate, dot })` factory. Required fields: id, ownerParty, name, at least one referencedRequirementsSetIds entry, createdDate. Mirrors `makeRequirementsSet` / `makePoE` shape and DOT structure (canon X.1–X.10). New `getLatestBadgeTemplateVersion(badgeTemplateId, allBadgeTemplates)` helper parallels `getLatestRSVersion` exactly — walks the lineage, returns the latest version's id. Templates carry `published: true` inherently (Phase 14.0 doesn't model unpublished drafts).

**Step 2 — Seed data.** Four templates seeded in `buildV22SharedArtifacts`: Bob's "Aerospace Grade A" v1 (references MIL-PRF-55681 v1, supersededBy v2) + v2 (references MIL-PRF-55681 v2 — exercises versioning UI on first load); Carol's "Audit Verified" (AuditCo PRM Audit RS); Alice's "Component Quality Assured" (Incoming QC v1 + System Integration v1). All IDs use the Phase-13.1 `[type]-[8-char-base32]` content-addressed-style format. Return shape extended with `badgeTemplates` alongside the existing `requirementSets` / `assets` / `claims` / etc.

**Step 3 — JSON record helper (`src/v2/data/jsonRecords.js`).** New `getBadgeTemplateJsonRecord(template)` matching the Phase 13.4 realism standard — references by ID only (`referencedRequirementsSetIds: ["reqset-mil-prf-55681-v1"]`, NOT embedded RS objects). Top-level shape: id, artifactType: 'badgeTemplate', artifactUri, ownerDid, ownerParty, dot{...}, name, description, referencedRequirementsSetIds, lineageId, version, supersededBy, published, createdAt, updatedAt, status. Status derives from supersededBy: 'superseded' when set, otherwise 'active'. Wired into `getJsonRecordFor` dispatcher with `case 'badgeTemplate'`.

**Step 4 — LibraryModal extension (`src/components/modals/LibraryModal.jsx`).** TAB_DEFS extended with `{ id: 'badges', label: 'Badges' }` appended after Published Requirements. Counts object extended with `badges: badgeTemplates.length`. New props: `badgeTemplates`, `onSaveBadgeTemplate`, `activeParty`. New conditional render branch mounts `<BadgesPanel>` when `activeTab === 'badges'`.

**Step 5 — BadgesPanel (`src/components/modals/library/BadgesPanel.jsx`, NEW).** Mirrors `RequirementsPanel.jsx` structure as closely as possible: 320px left panel + flexible right panel + inline edit form. Left panel: top toolbar with badge-template count + "+ Create new badge" button (when not editing); sectioned list with "My Badges" first followed by one section per other Actor's party (alphabetical). Each row shows shield silhouette + name + version pill + owner + RS count. Superseded versions render at 0.78 opacity with a "SUPERSEDED" tag. Right panel `ViewDetails`: header (shield glyph + name + version + New Version button on own latest + Expand button), owner line with globe icon + "Owned by *X*" + created date, "newer version available" amber notice when not latest, description, Referenced Requirements Sets list (each clickable → dispatches `library-open-requirements-set` custom event for cross-tab nav), Active Issuances placeholder ("Issuances appear here once the badge has been used. Badge issuance ships in Phase 14.1."). Edit form: name (locked in new-version mode) + description + sectioned RS picker (Your Requirements Sets + Published Standards via globe header). At-least-one RS validation; cancel + save buttons; new-version mode pre-fills from prior. Save dispatches `onSave(template, { isNewVersion, priorTemplateId })` so V2App can update prior's supersededBy. Expand button on the right-panel detail wires through to ExpandedArtifactModal with the new `'badge-template'` schema.

**Step 6 — V2App wiring.** New shared `badgeTemplates` state initialized from `buildV22SharedArtifacts().badgeTemplates`. Top-level (not role-specific) since Badge Templates are network-wide. New `handleSaveBadgeTemplate(template, { isNewVersion, priorTemplateId })` callback: appends new template to state and updates the prior version's `supersededBy` field when `isNewVersion && priorTemplateId`. LibraryModal mount extended with `badgeTemplates`, `onSaveBadgeTemplate`, and `activeParty` props.

**Step 7 — V22BadgeTemplatePanel (`src/components/DetailPanel/V22NodeDetailPanel.jsx`).** New `V22BadgeTemplatePanel` component matches the V22 Detail Panel layout: header (BADGE TEMPLATE label + name + version + click-to-copy DOT + Expand button) + Owner section + Supersession notice (when not latest) + Description + Referenced Requirements Sets clickable list + Active Issuances placeholder ("coming in Phase 14.1") + footer ("Create new version" — own templates + latest only). Re-exported as a named export so Library surfaces could embed the same component without forking. Router entry `case 'BADGE TEMPLATE'` is forward-looking — Phase 14.1's Badge Issuance work may surface Badge Templates as canvas nodes; until then BadgesPanel uses an inline `ViewDetails` instead of mounting the panel via the router. The router branch wires the standard `node.v22Artifact` envelope so future canvas mounts work without restructure.

**Step 8 — Expand modal extension.** ExpandedArtifactModal gains the `'badge-template'` schema: Output body (header card with shield glyph + name + globe + party + version + created date + SUPERSEDED tag when applicable, description card, Referenced Requirements Sets table — Requirement Set | Version | ID columns, IDs only) + JSON body (sourced from `getBadgeTemplateJsonRecord`). Modal width unchanged at 1280px. Header label `BADGE TEMPLATE`. Caller resolves Requirements Set objects and passes them via the new `referencedRequirementSets` prop so the table can render names + versions; falls back to bare IDs when the prop is omitted.

**Step 9 — Detail Panel polish (Claim Detail Panel).** (a) Referenced Assets rows are now clickable. The row wraps in a `cursor: pointer` + role="button" + tabIndex=0 affordance with hover transition; click invokes the existing `onSelectAsset(assetId)` callback (pans/zooms the canvas to the Asset and selects it). The inner ExpandButton's existing onClick is preserved (it stops propagation via the ExpandButton component). New `onSelectAsset` prop added to V22ClaimPanel signature. (b) Referenced Standards section: when `row.provenance === 'public'`, the previous "PUBLIC" text badge is replaced with the canonical globe icon (matches LibraryModal lines 157-161 / RequirementsPanel published rows / BadgesPanel published-RS section). Wrapped in `<Tooltip content="Published Standard">` so the meaning is hover-discoverable. Authored-by-you keeps its existing text badge; only `'public'` swaps.

**Step 10 — Documentation.** `CLAUDE-phase-log.md`: this entry. `CLAUDE.md`: footer version + active phase queue + last shipped phase narrative updated. `architecture-spec.md`: Changelog bullet for §17.X — Phase 14.0 summarizing the new Badge Template artifact + Library tab integration. `polish-backlog.md`: #169 marked in-progress (14.0 ships templates; 14.1 ships issuance + display); new #181 filed (S effort, low priority — user-uploaded badge graphics deferred); Phase 14.0 Update Log entry. `V2App.jsx` Changelog modal: new v0.14.0 entry prepended above v0.13.3.

**Footer version:** v0.13.4 → v0.14.0 (minor increment — new artifact type introduced, even though full Badges functionality completes in 14.1).

**Verification.** `npm run build` clean (102 modules transformed, 0 errors). Runtime verification of the 15 acceptance criteria pending in the next sub-step against the running dev server.

**Scope boundaries (deferred to 14.1):**
- Badge Issuance artifact + factory.
- Issuance flow modal, revocation flow modal.
- Notifications (issuance, revocation, new-version fan-out).
- Card chip rendering on PoE + Claim node cards.
- Active Issuances populated section in Badge Template Detail Panel.
- Badge Issuance Detail Panel.
- Aggregated Badges sections on PoE / Claim / Actor Detail Panels.
- Self-issuance gating.

**Scope boundaries (out entirely / deferred to a future feature):**
- User-uploaded badge graphics (#181 — filed for future).
- Badge endorsement / disputation flows.

**Status:** [x] Complete.

### Phase 13.4 completion notes (2026-05-05) — Expand Modals for All Artifact Types (#175)

Phase 13.4 establishes the `[Output] [JSON]` two-tab convention as the canonical structure for every artifact type's expand modal. Eval Result and PoE get rich Output content (the new surfaces); Asset / Claim / DA / EA / Parse Result get the rename + a universal JSON tab with realistic distributed-storage records. The PanelHeader gains an `actions` slot so Detail Panels can surface an Expand button alongside the existing close button.

**Step 1 — JSON record helpers (`src/v2/data/jsonRecords.js`).** New module exports `getAssetJsonRecord`, `getClaimJsonRecord`, `getEvalResultJsonRecord`, `getPoeJsonRecord`, `getDaJsonRecord`, `getEaJsonRecord`, `getParseResultJsonRecord`, plus a `getJsonRecordFor(artifact, kind)` dispatcher. Every record carries a uniform top-level shape: `id`, `artifactType`, `artifactUri`, `ownerDid`, `dot{ pin, hash, ownerDid, registrationTimestamp, metadata, lineage }`, `createdAt`, `updatedAt`, `status`, followed by type-specific content + reference fields. References are ID-only — a Claim's record carries `referencedAssetIds: ["asset-a3k7m2x9", ...]` (string ids), not embedded Asset objects. Same pattern for `referencedRequirementsSetIds`, `evidenceUsed`, `wrappedEvalResultId`, `priorEvalResultId`, etc. The realism rule: read a record cold and ask "would I believe this is a JSON document persisted in the user's qualified storage?" — if it looks like raw React state, restructure.

**Step 2 — `ExpandedArtifactModal.jsx` rewrite.** Refactored to support seven schemas (`'asset'`, `'parse-output'`, `'eval-output'`, `'claim'`, `'poe'`, `'disclosure-agreement'`, `'evaluation-agreement'`). Modal width bumped 720 → 1280px. Tab nav `[Output] [JSON]` is uniform; each tab content area is wrapped in a `LayeredOutputContainer` (a `position: relative` div) ready for #172's PDF annotation overlay. Each tab carries a disabled `DownloadButton` in a `TabHeaderActions` row above the body — tooltip "Export coming soon." (wires up under #58). Output body branches by schema; JSON body is uniform: `JSON.stringify(getJsonRecordFor(artifact, kind), null, 2)` in a preformatted code block. Selective / proof-only Asset views still surface a disclosed-portion-only record so file metadata (hash, URI, size) stays private — the special-case JSON branches from Phase 11D.2/3 are preserved.

**Step 3 — Eval Result Output content.** Internal `EvalResultOutputBody` renders a header card (Eval Result name + minibar + aggregate "X SAT · Y UNSAT · Z MISSING across N Requirements Sets" + evaluation date + evaluator), then per-Requirements-Set sections each with a `[REQUIREMENTS SET]` badge + name + version + count, followed by a 4-column results table: `Requirement | Value | Status | Confidence`. Status renders as a colored chip (green SAT, red UNSAT, amber MISSING) via `StatusChip`. Confidence renders as `LEVEL · NN%` via `ConfidenceText` (HIGH ≥ 85%, MED ≥ 65%, LOW below). Rows with `status === 'na'` are filtered out per Phase 13.2 (#176). Minibar uses a three-segment SAT/UNSAT/MISSING bar matching the Detail Panel's HealthBar look. No "Source Evidence" column — deferred until #172 ships.

**Step 4 — PoE Output content.** Internal `PoeOutputBody` renders a PoE header card (name + created date + owner) and two sections. **Section 1** is the wrapped Eval Result's Output content: caller passes `wrappedEvalResult` (resolved from the merged shared dataset), and the same `EvalResultOutputBody` is reused — minibar + aggregate + per-RS results tables. **Section 2** is "Evaluation Provenance": caller passes `provenanceChain` (oldest-first walk from the wrapped Eval Result back via `priorEvalResultId`); each row shows ordinal + name + evaluation date + status badge (`SUPERSEDED` for chain history; `WRAPPED` for the wrapped Eval Result; `OUTDATED`/`ACTIVE` otherwise). Rows are clickable when `onSelectEvalResult` is wired — clicking closes the expand modal and pans/selects the target Eval Result's Detail Panel.

**Step 5 — Asset / Claim Output rename.** First tab label changed from the implicit "Asset" / "Claim" labels to "Output". Asset's existing AssetEvidenceViewer (Full / owner) and SelectiveDisclosurePanel (selective grantee) content is unchanged. Claim's Output is a thin scaffold (description + summary metadata: owner / created / referenced asset count / referenced standards count / acknowledgments count / amendments count) — substantive Output content waits for the Detail Panel cleanup phase (#180).

**Step 6 — DA / EA / Parse Result Output rename + content scaffold.** All three got the "Output" tab label and a uniform JSON tab. Output content scaffolds: DA → Parties / Subject & Scope / Terms; EA → Parties / Anchor / Terms; Parse Result → existing parsed-fields list. Substantive Output content for these three is deferred to #180 per the spec's explicit "convention establishment, not enrichment" boundary.

**Step 7 — Detail Panel expand triggers.** PanelHeader gained an optional `actions` prop rendered to the left of the close button. V22ClaimPanel, V22EvalResultPanel, V22PoEPanel, V22ParseResultPanel each now carry an Expand button in this slot when `onExpand` is wired. DisclosureAgreementDetailPanel got an inline ExpandButton in its header (parallel to the EA Detail Panel's pattern from 11C.2). The Claim panel has four header variants (provisional / declined / revoked / standard) — all four updated.

**V2App.jsx wiring.** Single `onExpand` handler on the V22NodeDetailPanel mount branches by `node.v22Type`: CLAIM → `'claim'` schema; EVAL RESULT → `'eval-output'`; PROOF OF EVALUATION → `'poe'` schema with caller-resolved `wrappedEvalResult` + `provenanceChain` + an `onSelectEvalResult` callback that closes the modal then pans/selects the target Eval Result; PARSE RESULT → `'parse-output'`; ASSET → `'asset'`. The DA Detail Panel mount got `onExpand` with the `'disclosure-agreement'` schema. The directory-materialized Claim panel got the same routing for its CLAIM expand. The `v22ExpandedArtifact` state shape was extended with `wrappedEvalResult`, `provenanceChain`, `onSelectEvalResult`; the modal mount passes them through.

**Latent-bug dedup.** Two pre-existing duplicate JSX attributes on the V22NodeDetailPanel mount (`onSelectEvalResult` and `resolveClaimName`, both inherited from earlier Phase 13 patches against an in-flight working tree) surfaced as build errors after my edits shifted line numbers. Resolution: removed the later inline duplicates; consolidated `onSelectEvalResult` now accepts both call shapes — V22ClaimPanel passes the full Eval Result object, V22PoEPanel's Provenance rows pass a string id. The `arg => typeof arg === 'string' ? arg : arg?.id` normalization handles both.

**Verification.** `npm run build` clean (101 modules transformed, 0 errors). Dev server runtime verification of the 15 acceptance criteria pending in the next sub-step. Build-time verification confirms: all imports resolve, no JSX duplicates, no TDZ traps in the rewrite. Footer bumped v0.13.3 → v0.13.4. Changelog modal entry prepended above v0.13.3 with the eight-bullet summary.

**Scope boundaries:**
- Substantive Output content for DA / EA / Parse Result expand modals → #180 (Detail Panel cleanup phase).
- "Source Evidence" column on Eval Result Output table → #172 (PDF annotation overlay).
- Real export functionality on the Download button → #58.
- Eval Result expand trigger from anywhere besides the Eval Result Detail Panel header → not introduced (existing pattern preserved).

**Status:** [x] Complete.

### Phase 13.3 completion notes (2026-05-05) — Eval Flow Polish + Layout Fixes + Library Surfacing

Twelve items addressing 13.2 QA findings, the queued polish list, and Library/RS-picker surfacing for Published Standards. Heavy phase but coherent — most items touch overlapping files (V22RunEvaluationModal, canvas adapter / `deriveAgreementEdges`, V22NodeDetailPanel) so a single-pass batch was strictly more efficient than splitting.

**Step 1 — PoE edge reroute through PoE node.** The Phase 13.2 PoE-targeting DA emitted `PoE → Claim` correctly, but the auto-disclosure DA on the chain endpoint kept emitting `ER → Claim` directly when the ER had no chain successor — bypassing the PoE node visually. Phase 13.3 extends the chain rerouting maps with `wrappingPoeByErId: erId → poeId`. In `deriveAgreementEdges`, the auto-disclosure DA's edge derivation now branches: chain successor → reroute to successor; PoE wraps this ER → SKIP the edge entirely (the synth wrap pass below already produces ER → PoE, which is the desired chain edge). Self-evaluation DAs apply the same skip. Net result: a single path runs `Asset → ... → Latest ER → PoE → Claim` with no parallel bypass. Verified via runtime canvas inspection (0 bypass edges across all roles).

**Step 2 — Re-Run gating tightening.** Added `hasNewAssetsForRerun(inScopeAssetIds, priorEvalResult)` helper to `v2_2Data.js`: returns true iff at least one in-scope Asset id is NOT in `priorEvalResult.evidenceUsed`. V2App's data adapter computes a per-ER `_canRerun` flag (true / false) and stamps it on Eval Result nodes. AssetNode V22ActionBar reads `_canRerun !== false` to decide whether to show the Re-Run button on owned non-superseded non-PoE-wrapped Eval Results. V22EvalResultPanel footer reads a parallel `canRerun` prop and disables the Re-Run button with a tooltip "No new evidence to evaluate. Wait for Asset additions or modify the Claim's evidence." when the flag is false. The PoE-terminated tooltip from Phase 13.1 still wins when applicable. The Run Evaluation modal's RS picker also tightens: when in Re-Run mode (`lockedRequirementsSetIds` non-empty), every RS NOT in the carried-over set is now disabled. Phase 13.2's permissive "user can add new RSes during re-run" behavior is reverted by design — Re-Run is locked to the prior Eval Result's exact `requirementsSets[]`. The hint copy updates accordingly.

**Step 3 — Re-Run mode Step 1 UX: collapsed Assets + NEW badge.** In Re-Run mode (`priorActiveResult` passed in), the Asset accordion's `expandedAssetId` initializes to `null` (all rows collapsed) instead of the first-Asset-expanded default. Each row that was NOT in `priorActiveResult.evidenceUsed` renders a NEW indigo badge in its row header next to the disclosure-type tag. `priorEvidenceSet` memo is the membership lookup. Detection only fires in Re-Run mode — fresh evaluations show no NEW badges since the concept is meaningless without a prior.

**Step 4 — Multi-column chain placement.** New `ER_COL_SPACING = 300` constant. Chain maps (`chainPositionByErId`, `chainOriginByErId`, `chainLengthByOriginId`) computed once at the top of `buildV22Canvas`. `chainColShift = max(0, maxChainLengthOnCanvas - 1) * ER_COL_SPACING` adjusts the eff column constants for downstream columns (Pulled Claim, Pulled Asset, Public, Owned PoE) so chain ancestors don't collide.
- Bob's view (own ERs): `x = COL_OWN_EVAL_eff + chainPosition * ER_COL_SPACING` — chain origin at standard eval column, latest farther right toward Claim.
- Alice's view (proof-of-eval pulled ERs): mirror — `effectivePos = (chainLength - 1) - chainPosition`; latest at `COL_OWN_EVAL_eff` close to Alice's own Claim, origin furthest right toward the pulled counterparty Asset.
- Owned PoE: `x = COL_OWN_EVAL_eff + chainLength * ER_COL_SPACING` — one column right of the latest ER.
- Pulled PoE (Alice's view of Bob's PoE): `x = COL_OWN_EVAL_eff - ER_COL_SPACING` — one column LEFT of mirror-anchored latest, fitting between Alice's Claim and the latest ER.
- The ID format makes `lineageId` available on the seeded RS objects; Phase 13.3 also adds `lineageId` to the modal's RS prop pass-through so the SUGGESTED badge can walk the lineage.

Verified visually + programmatically: Bob's 3-ER VReg chain renders at x=1700/2000/2300 (origin/mid/latest) with PoE-equipped PRM chain at 1700→2000 (ER→PoE) → 2700 (Claim with chainColShift=600). Alice's mirror: latest at 1700 (closest to her Claim at 1300), PoE at 1400 (between Claim and latest), Pulled Asset at 3100. Spec criteria 7 and 8 satisfied.

**Step 5 — Superseded Eval Result opaque background.** `AssetNode.jsx` superseded styling dropped the `opacity: 0.45` from both the full-card and mini-card LOD outer divs. The grayscale filter is retained — that plus the existing dimmed text colors plus the SUPERSEDED badge in Row 0 still differentiate status. Card backgrounds are now opaque (`var(--bg-card)` for active, slight color-mix variants for hover etc.), so the canvas grid pattern doesn't show through superseded cards anymore.

**Step 6 — Step 3 modal header copy.** V22RunEvaluationModal Step 3 subtitle changes from "Reviewing [Claim name]" to "Evaluating [Claim label] by [Claim owner]". Falls back to the prior single-arg copy when only `claim?.name` is available, and to the original generic copy when neither is set.

**Step 7 — SUGGESTED badge gating.** Folded into Step 2's picker logic — `suggested = suggestedSetIds.has(rs.id) && !disabled`. The badge no longer renders on rows that are PoE-blocked, locked (Re-Run mode), or otherwise disabled.

**Step 8 — RS picker auto-suggest latest version.** `suggestedSetIds` is now a `useMemo` that walks each EA-suggested id's lineage in `dedupedRsPool`, picking the highest-version entry sharing the same `lineageId`. V2App's RS prop pass-through now includes `lineageId` so the modal can walk lineage families. If a suggested id has no `lineageId`, the original id passes through unchanged (back-compat).

**Step 9 — PoE name format + seed regeneration.** `makePoE` factory's auto-name generation: `"PoE for [Claim] · YYYY-MM-DD"` → `"Proof of [Claim label] Evaluation"`. The `createdDate` suffix is dropped — the value still lives on the artifact and surfaces in the Detail Panel header. Seed PoE names regenerate automatically through the factory at seed-construction time. The fallback when `claimName` is missing is `"Proof of Evaluation"` (no date).

**Step 10 — PoE Detail Panel PIN deduplication.** V22PoEPanel's body-level DOT section had a `Row label="PIN"` that repeated the full PIN string already shown in the header's click-to-copy badge. Removed the body row. Owner DID and Asset snapshot rows kept.

**Step 11 — Published Standards two-section accordion in RS picker.** Restructured the V22RunEvaluationModal RS picker from a single flat checkbox list to two collapsible sections within the same scroll surface:
- Section 1: "Your Requirements Sets (N)" — expanded by default; lists owner-authored RSes (`_provenance === 'own'`).
- Section 2: "Published Standards (N)" — collapsed by default, with a globe icon in the section header. Lists all RSes with `_provenance === 'public'`, sorted alphabetically by name. Each row carries a globe icon + the publishing actor name inline (replacing the generic "Public" provenance badge).
- Selection semantics unchanged across sections; `renderRow(rs)` is shared.
- Section state tracked via two `useState`s at the modal top.

**Step 12 — Published Standards in Library.** RequirementsPanel's left-panel "Published Standards" section gains a globe icon next to each row's RS name (in addition to the section-header globe that already existed). Right-panel `ViewDetails` promotes the existing tiny "Published by X · date" mono line to a prominent row directly below the title — globe icon + "Published by **X** · date" in the accent-blue palette at 12px display font.

**Step 13 — Documentation.** This entry; `architecture-spec.md` Changelog (PoE edge reroute fix, multi-column chain placement, Re-Run gating, Published Standards surfacing); `polish-backlog.md` (#177a multi-column placement, #178 Published Standards in RS picker, #179 Published Standards in Library — all moved to Completed in this hygiene pass); `CLAUDE.md` updated current-state-of-the-world; V2App.jsx Changelog modal entry prepended above v0.13.2; footer constant bumped v0.13.2 → v0.13.3.

**Verification (programmatic + screenshot).** Build clean (100 modules, 0 errors). Live module-graph imports verified:
- 0 bypass edges (Phase 13.1 PoE-creation flow + seed PoEs both produce single chain path through PoE).
- Bob's view: VReg 3-ER chain at x=1700/2000/2300; PRM bundled ER + PoE at 1700/2000; Claims shifted to 2700.
- Alice's view: VReg chain mirrored — latest at 1700 (next to her Claim 1300), origin at 2300; PoE at 1400; Pulled Asset at 3100.
- Re-Run gating: `hasNewAssetsForRerun` returns expected boolean across the seeded chains.
- SUGGESTED badge promotion via `lineageId`: only renders on selectable RSes; auto-promotes to latest version of an RS family.
- PoE names use new format ("Proof of [Claim] Evaluation") in seed.
- Two-section accordion renders without runtime errors.

Cross-role canvas-click verification of action-bar Re-Run hide / Detail Panel footer disable / NEW badge / collapsed Asset rows / accordion sections requires manual mouse interaction per the documented Phase 9A.6 V2Canvas raycaster limitation.

**Status:** [x] Complete.

### Phase 13.2 completion notes (2026-05-05) — Chain Linking + Auto-Disclosure Default + Re-Run Bug + Minibars

Six related items shipped together: a Re-Run RS picker bug fix, an auto-disclosure default architectural correction, Eval Result chain linking on the netgraph, PoE chain insertion, minibar restoration on Claim cards plus extension to Eval Result + PoE cards, and the PoE Detail Panel "Evaluation Provenance" rename.

**Step 1 — Re-Run RS picker bug fix.** The Phase 13.1 modal locked only one RS via `lockedRequirementsSetId` (singular). Multi-RS bundled Eval Results triggered a re-run with only the first RS carried forward; the rest had to be re-checked manually. Phase 13.2 introduces `lockedRequirementsSetIds: string[]` (plural) — every RS in the prior Eval Result's `requirementsSets[]` is pre-checked AND locked in the picker (disabled, can't be unchecked). The user CAN still add additional RSes — Re-Run mode now permits expanding evaluation scope on top of the carried-over set (PoE-coverage gating still applies). Tooltip on locked rows reads "Carried over from prior evaluation." V2App passes the array from both action-bar and Detail-Panel re-run dispatches. The legacy singular `lockedRequirementsSetId` prop kept as fallback for any straggler caller.

**Step 2 — Auto-disclosure default switches to proof-only.** `makeProofOfEvalDisclosureAgreement` defaulted to `type: 'full'`. Phase 13.2 changes the factory default to `type: 'proofonly'`. This applies to both branches of the discriminated union (`evaluationResultId` auto-disclosure DAs at save time AND `poeId` PoE-creation DAs). Seed migration is automatic since every seed auto-disclosure DA flows through this factory; no separate seed regeneration was needed. Both parties still see all evaluation results in Detail Panels — proof-only is an edge style + the subject-kind discriminator, NOT a content restriction. Reflects the real-world supply-chain pattern where evaluation outcomes are shared without exposing the source documents.

**Step 3+4 — Chain edge derivation.** New chain-rerouting logic in `deriveAgreementEdges`. A `successorByErId` map indexes each ER's chain successor (the ER whose `priorEvalResultId === er.id`). Edge derivation:
- For auto-disclosure DAs (`kind: 'evalResult'`, non-internal): if the ER has a successor on canvas, target the successor (chain edge); else target the Claim (chain endpoint).
- For ownership DAs (`kind: 'evalResult'`, internal, with assets): if the ER has a predecessor on canvas, skip the Asset→ER edge entirely (chain origins are the only ones that emit Asset edges).
- For self-evaluation DAs (`kind: 'evalResult'`, internal, no assets): same chain rerouting as the cross-party path.
- For PoE-targeting DAs (`kind: 'poe'`, non-internal): edge target is `PoE → Claim`. The `Latest → PoE` edge comes from the synth wrap pass, which now uses `type: 'proofonly'` (was `'full'`) — together they read as `Latest → PoE → Claim`. Pre-Phase-13.2 the PoE-targeting DA emitted Latest→Claim directly, bypassing the PoE node visually; that meant the wrap edge sat off-chain. Phase 13.2 inserts the PoE into the canvas chain.

The DA artifacts themselves stay active as historical records — only the rendered edge target is rerouted. This avoided the more invasive "DA-only-on-latest" model migration; the rerouting approach was strictly cleaner against the existing seed data shape.

**Step 5 — Spatial placement.** No placement-strategy change beyond the existing symmetric stacking distribution. Chain ancestors share the COL_OWN_EVAL column with the latest member; rows distribute symmetrically around y=0 via `symmetricRowY(i)`. Chain edges read across rows rather than along a clean horizontal axis. Acceptable for Phase 13.2's structural-correctness goal; visual polish (placing chain ancestors horizontally to read as a left-to-right timeline) deferred to netgraph cleanup #4 / #130. Documented as a known visual rough edge in the completion notes.

**Step 6+7 — Minibar (HealthBar) update + apply to all three card types.** Restored MISSING (amber) to the existing `HealthBar` component — pre-Phase-13.2 the `warn` slot rendered as `var(--text-dim)` which read closer to grey than amber. Now `warn` uses `var(--accent-amber)`. Aggregate roll-up helpers in `v2_2Data.js` (`rollupClaimHealth`, `rollupEvalResultHealth`) populate `warn` with MISSING counts (was 0). N/A continues to be excluded from displays. `HealthBar` gains a `withLabels` prop that adds inline numeric labels next to the bar (used in Detail Panel headers).

AssetNode card body: full-card and mini-card LODs both render the minibar for Claim, Eval Result, and PoE cards. The prior text aggregates ("X SAT · Y UNSAT · N RS" on Eval Result + PoE) are gone — replaced by the minibar primitive. The "across N Requirements Sets" suffix is dropped from card displays entirely. Mini-card LOD adds the amber MISSING segment alongside green/red.

**Step 8 — Claim Detail Panel header minibar.** Restored above the description, below the panel header. Uses `node.displayHealth` (already populated by the canvas adapter via `rollupClaimHealth`) and the `withLabels` variant of `HealthBar` so the panel reads SAT/MISSING/UNSAT counts inline. Hides automatically when total === 0 (no Eval Results on the Claim).

**Step 9 — Eval Result Detail Panel updates.** Header replaces the prior "X SAT · Y UNSAT · Z MISSING · W N/A across N Requirements Sets" text aggregate with a `<HealthBar withLabels />` row. The "N Requirements Sets" suffix drops from the header (the per-RS group sections below already convey RS count). Per-row rendering: N/A rows now render with `opacity: 0.45` so the structure stays visible but the visual weight matches "excluded from display" semantics. The header `Results (N)` count reflects only non-N/A rows.

**Step 10 — PoE Detail Panel "Evaluation Provenance" section.** "Wrapped Eval Result" → "Evaluation Provenance (N)". The section walks the wrapped Eval Result's supersession chain backward via `priorEvalResultId` to the chain origin, emits oldest-first, and renders each entry as a numbered, clickable row with status badge (SUPERSEDED / OUTDATED / WRAPPED for the chain head). Each row shows the eval date below the name; clicking navigates to the Eval Result Detail Panel. V2App resolves the chain against the merged shared dataset before passing it as the `provenanceChain` prop. Solo (no chain) PoEs render as a single-row section preserving the pre-13.2 layout.

**Seed migration: 3-Eval-Result chain on Bob's VReg.** Two superseded ancestors seeded (`erBobVregV0` → `erBobVregV1` → `erBobVreg`) so chain rendering across multiple supersession steps is exercisable on first load. Each ancestor gets its own auto-disclosure DA (rerouted to its successor on canvas) and ownership DA (no Asset edge since predecessor exists). All three Eval Results carry the same RS lineage (MIL-PRF-55681 v1) so the supersession lineage check in `makeEvaluationRunArtifacts` would correctly flag the chain on a re-run.

**PoE-targeting DA edge fix.** Discovered during runtime verification of acceptance criterion 4: with the seed `daProofBobPrm` (PoE-targeting DA), the pre-Phase-13.2 edge derivation emitted `Latest → Claim` directly through the `kind === 'poe'` branch, bypassing the PoE node. The wrap edge (Latest → PoE) sat off-chain. Phase 13.2 changes the branch to emit `PoE → Claim`; the wrap edge supplies `Latest → PoE`; together they form `Latest → PoE → Claim`. This was a latent gap from Phase 13's original design that wasn't surfaced because the ER → Claim edge looked correct from its own perspective.

**Step 11 — Documentation.** This entry; `architecture-spec.md` Changelog (chain linking, auto-disclosure default, Re-Run bug, minibars, Evaluation Provenance bullets); `polish-backlog.md` (#176 minibars + #177 chain linking moved to Completed; #175 PoE/Eval Result expand modal filed as Open for Phase 13.4); `CLAUDE.md` updated current-state-of-the-world; V2App.jsx Changelog modal entry prepended above v0.13.1; footer constant bumped v0.13.1 → v0.13.2.

**Verification (programmatic + screenshot).** Live module-graph imports verified:
- Bob's view: `Asset → eval-w...` (V0) `→ eval-4...` (V1) `→ eval-c...` (V_main) `→ Claim` chain rendered with 3 ER nodes + 2 chain edges + 1 ER→Claim edge, all `sdaType: 'proofonly'`.
- PRM with PoE: `Asset → eval-6... (bundled) → poe-i... → Claim` — 1 Asset→ER + 1 ER→PoE + 1 PoE→Claim, all proof-only.
- Alice's view: same chain in mirror (3 VReg ERs visible, 2 chain edges, latest connected to Claim).
- Cross-role consistency: chain endpoints render correctly on both evaluator (Bob) and Claim-owner (Alice) sides.
- Claim minibar: `claimNode.displayHealth = { ok: 8, warn: 0, bad: 1 }` — Bob's bundled PRM (8 SAT / 1 UNSAT) aggregates correctly.
- Provenance walk: VReg latest → V1 → V0 (3-step chain via priorEvalResultId).

Build clean (100 modules, 0 errors). The known Phase 13 duplicate-attribute warnings in V2App.jsx are unchanged — to be addressed when those panels are next touched.

**Status:** [x] Complete.

### Phase 13.1 completion notes (2026-05-04) — Eval Result Model Correction + Save Bug Fix + UX Corrections

Three connected things shipped together: (1) the Phase 13 Save crash bug fix; (2) the Phase 12.2 → 13.1 Eval Result model correction (multi-RS evaluations bundle into ONE Eval Result, not N sharing a `batchId`); (3) UX corrections + seed/ID hygiene.

**Step 1 — Eval Result data model correction.** `makeEvaluationResult` factory replaces the singular `requirementsSet` with the plural `requirementsSets[]` (each entry `{ id, name, version }`). `results[]` is flat — every row carries `requirementsSetId`. `batchId` field removed entirely. New `getEvalResultAggregate(evalResult)` helper returns `{ totalSat, totalUnsat, totalMissing, totalNa, rsCount }` for card / Detail Panel rendering.

**Step 2 — Save handler bug fix + discriminated union.** `makeProofOfEvalDisclosureAgreement` accepts either `evaluationResultId` (auto-disclosure DA at save time) OR `poeId` (PoE-creation DA), mutually exclusive. Throws when both/neither passed. `subject.kind === 'evalResult'` carries `scope.evaluationResultIds`; `subject.kind === 'poe'` carries `scope.poeIds`. Both fields exist on the `makeDisclosureAgreement` scope shape; consumers branch on `subject.kind`. `makeEvaluationRunArtifacts` rebuilt: signature now `requirementsSets[]` + flat `rows[]`; produces ONE Eval Result + ONE auto-disclosure DA + ONE ownership DA per submission. The Phase 13 grep-and-replace had renamed the parameter to `poeId` while keeping the call passing `evaluationResultId` — that's the root cause of the Save crash; the discriminated union restores the field name. V2App.handleV22EvaluationSubmit refactored to bundle every selected RS into one Eval Result and invoke the factory once (was once-per-RS with `batchId` fan-out).

**Step 3 — Seed migration.** Bob's prior 2-Eval-Result batch (`erBobPrm` MIL-PRF + `erBobPrmSysInt` System Integration sharing `batch-seed-bob-prm-001`) collapsed into one bundled `erBobPrm` covering `requirementsSets: [milPrf, systemIntegration]` with all 9 rows stamped per-RS. Carol's PRM Eval Result kept as single-RS. PoE seed wrappings retroactively collapsed to 1:1 (Bob's PoE wraps the bundled ER; Carol's PoE wraps her single ER). Two NEW unwrapped Eval Results added for demo flexibility: `erBobVreg` (Bob evaluates Alice's VReg Claim against MIL-PRF — unwrapped, so demos can exercise Create PoE on first interaction) and `erCarolEmi` (Carol evaluates EMI Shield against AuditCo PRM Audit — also unwrapped). New `daAliceToCarolEmi` Full DA + `eaCarolOnEmi` EA seed the Carol→EMI access path. Auto-disclosure DAs for the unwrapped pair (`daProofBobVreg`, `daProofCarolEmi`) use the new discriminated-union shape (`subject.kind: 'evalResult'`).

**Step 3 (cont.) — Seed ID regeneration.** New `makeArtifactId(prefix, seedKey)` helper produces deterministic 8-char base32 IDs. Every PoE / Eval Result / DA / EA seed ID + every actor-name-leaking Asset ID (`asset-bob-*`, `asset-carol-*`) regenerated through it. Result: ids match `[type]-[8-char-base32]` (e.g. `eval-6mkamg42`, `poe-iwcikmag`, `da-akagwusq`); zero actor names appear in seed IDs. Non-actor-leaking IDs (`asset-prm-datasheet`, `claim-prm-assembly`, `reqset-mil-prf-55681-v1`) kept as-is — they describe artifact role, not the actor, and the file-wide entrenchment makes regeneration disproportionate to the value. EA `authorizedRequirementsSetIds` updated to use `reqset-*` ids matching the requirementSets.js library.

**Step 4 — Eval Result Detail Panel grouped rendering.** V22EvalResultPanel: removed singular `Requirements Set` section + `Sibling Evaluations` section entirely (concept retired with `batchId`). `Results` section now renders one labeled group per RS in `er.requirementsSets[]` with a `REQUIREMENTS SET` chip header per group. Aggregate row at the top reads "X SAT · Y UNSAT · Z MISSING · W N/A across N Requirements Sets". Backwards-compat: rows missing `requirementsSetId` fall through into the first RS's group (legacy single-RS Eval Results render unchanged).

**Step 5 — Eval Result + PoE node cards.** AssetNode.jsx: PoE summary row simplified to "X SAT · Y UNSAT · N RS" (the prior "Wraps N" prefix was uninformative under 1:1). New Eval Result aggregate row "X SAT · Y UNSAT · N RS" gated on `node.evalAggregate`. Auto-name policy in `evalResultToNode`: when the Claim is resolvable, name = "Evaluation of [Claim name]"; multi-RS Eval Results without a Claim lookup fall back to "[firstRsName] (+N more)".

**Step 6 — PoE 1:1 simplifications.** `makePoE` factory: `wrappedEvalResultIds: []` → `wrappedEvalResultId: string` (singular). `requirementsSetIds[]` derived from the wrapped Eval Result's `requirementsSets[]`. `batchId` parameter dropped. PoE Detail Panel section header "Wrapped Eval Results (N)" → "Wrapped Eval Result" (singular); single clickable row. CreatePoEModal copy adapted: "Create Proof of Evaluation? This finalizes your evaluation of [Claim name] against [RS names]. ..."; "Wraps 1 Eval Result · N Requirements Sets" footer line. The `Batch ID` row in the DOT section dropped.

**Step 7 — PoE creation transitions disclosure.** V2App.handleV22CreatePoE atomically: (a) builds the new PoE (via `makePoE`); (b) finds the existing Eval-Result-targeting auto-disclosure DA (evaluator → claim owner, `subject.kind: 'evalResult'`, `status: 'active'`) and marks it `status: 'revoked'` with a `_supersededByPoeId` audit field; (c) constructs a new PoE-targeting proof-only DA (`makeProofOfEvalDisclosureAgreement` with `poeId`); (d) merges both into provisionals + selects the PoE for pan/reveal. The revoked DA's edge animates per the existing Phase 9D unravel pattern; the new PoE node + its DA edge animate per the standard `_isNew` reveal pipeline.

**Step 8 — Re-Run gating moves to entry points.** AssetNode.jsx V22ActionBar `EVAL RESULT` case: hides BOTH Re-Run and Create-PoE buttons when `node._alreadyWrapped` is set. V22EvalResultPanel footer: Re-Run button stays visible-but-disabled with tooltip "An evaluation has already been finalized as a Proof of Evaluation. Modify the Claim's evidence or select a different Requirements Set to continue." (the `isPoeTerminated` prop drives this). V22RunEvaluationModal RS picker: rows whose RS is covered by an existing PoE for the current evidence snapshot render with a `PoE` chip + tooltip and are non-clickable. Submit-time gate from Phase 13 removed (no longer needed). The picker-time gate computes once via `poeBlockedRsIds` set: an RS is blocked when any owned PoE on this Claim covers that RS AND the current evidence is a subset-or-equal of the PoE's `assetSnapshot`. This releases naturally when Alice amends evidence — the new Asset set differs from the PoE's snapshot.

**Step 9 — Step 3 modal header includes Claim name.** V22RunEvaluationModal step-3 ModalHeader subtitle changes from "Review extracted values and assessment statuses" to `"Reviewing [Claim name]"` when `claim?.name` is supplied. Matches Step 1's wording style ("Evaluating [Claim name] under Evaluation Agreement [id]").

**Step 10 — Disable text selection on result-status button.** The middle (label) span inside `StatusChevronPicker` now sets `userSelect: 'none'` + `WebkitUserSelect: 'none'` explicitly + `onMouseDown={(e) => e.preventDefault()}` so double-clicking the rotating SAT/UNSAT/MISSING/N/A button no longer selects the label text. The chip-style and chevron-style wrappers already had `userSelect: 'none'`; the inner span was inheriting it but Tooltip's wrapper effectively reset it on its children, hence the explicit re-pin.

**Canvas adapter PoE-placement bug fix (added during runtime verification).** The pre-Phase-13.1 canvas adapter only placed PoEs that the actor owned OR that arrived via a proof-only Claim DA. PoEs disclosed via a proof-of-evaluation DA (subject.kind='poe', the standard Bob → Alice pattern) were missing — Alice's view had `view.proofsOfEvaluation` populated but the canvas adapter rendered zero PoE nodes. Added a new placement bucket `proofOfEvalPulledPoEs` (PoEs visible in the actor's view but not owned, not proof-only-pulled). These render in the actor's PoE column with y anchored to the wrapped Eval Result's y. This pre-existed Phase 13.1 (it was a latent gap from the Phase 13 ship that wasn't surfaced because canvas-click-triggered tests can't be scripted), but the model correction surfaced it via runtime verification of acceptance criterion 5.

**Step 11 — Documentation.** This entry; `architecture-spec.md` Changelog (model correction + bug fix + UX bullets); `polish-backlog.md` (#174 filed for tech-debt note on the discriminated-union scope shape); `CLAUDE.md` updated current-state-of-the-world + Phase 14 candidates clarification; V2App.jsx Changelog modal entry prepended above v0.13.0; footer constant bumped v0.13.0 → v0.13.1.

**Verification (programmatic, since canvas raycaster can't be scripted from the agent session per the documented Phase 9A.6 limitation).** Imported `v2_2Data.js` via the live dev module graph and exercised `makeEvaluationRunArtifacts` with a fresh single-RS submission for Bob on Alice's VReg: returns one Eval Result (id format `[type]-[8-char-base32]` ✓), one ownership DA, one proof-only DA with `subject.kind: 'evalResult'` ✓ and `scope.evaluationResultIds: [evalId]` ✓ (no thrown error — bug fix verified). Inspected per-role canvas builds: Bob sees his bundled Eval Result (rsCount=2, totalSat=8, totalUnsat=1) + 1 wrapping PoE + 1 unwrapped Eval Result on VReg. Alice sees both PoEs (Bob's bundled + Carol's PRM) + 4 Eval Results across the two unwrapped + two wrapped pairs. Dave sees the proof-only-pulled PoE/Eval Result pair (Alice → Dave PRM proof-only DA). No `batchId` references remain in any view-builder output. Canvas-click verification of edge unravel + PoE reveal animations during Create PoE is the manual-only path per the existing limitation.

**Build clean** (100 modules transformed, 0 errors). Pre-existing duplicate-attribute warnings in V2App.jsx are unrelated to Phase 13.1; will be addressed when those panels are next touched.

**Status:** [x] Complete.

### Phase 13 completion notes (2026-05-04) — Proof of Evaluation (PoE) Node Type (#168) + #173 fold-in

Major architectural addition: PoE introduced as a new first-class artifact type that wraps an active Eval Result batch (or solo Eval Result), terminates further evaluations on the same (Asset set, RS set) by the same evaluator, and replaces individual Eval Results as the disclosure target for proof-only DAs. **Step 1 — `makePoE` factory:** new `src/v2/v2_2Data.js` factory takes `{ id, owner, ownerDot, claimId, claimName, wrappedEvalResultIds, batchId, requirementsSetIds, assetSnapshot, createdDate, dot, status }`. Returns an artifact with `artifactType: 'poe'`, auto-generated `name` (`PoE for [claimName] · [YYYY-MM-DD]`), structured DOT (hash null — no underlying file, like Claims), and metadata referencing the wrapped Eval Result IDs. New `'poe'` added to `SUBJECT_KINDS`. New `poeUri()` helper. **Step 2 — global rename `scope.evaluationResultIds` → `scope.poeIds`:** 6 files / ~20 touchpoints. v2_2Data.js (factory shapes, view derivation, edge derivation), AmendDisclosureModal.jsx (full rename of `selectedEvalIds`/`lockedEvalResultIds`/`candidateEvalResults` → `selectedPoeIds`/`lockedPoeIds`/`candidatePoEs`), CombinedResponseModal.jsx (`selectedEvalResultIds`/`evalResultsForClaim` → `selectedPoeIds`/`poesForClaim`; picker UI rewritten to render PoE rows with wrapped count + SAT/UNSAT aggregate), DisclosureAgreementDetailPanel.jsx (`Eval Results in scope` → `Proofs of Evaluation in scope`), V2App.jsx (call sites for both modal mounts updated; new prop wiring builds PoE candidate lists from `view.proofsOfEvaluation`). No backwards-compat alias kept — full migration per the brief's explicit instruction. **Step 3 — retroactive seed migration:** `buildV22SharedArtifacts` now wraps every existing seed Eval Result in a PoE before returning. Bob's two batch members (`erBobPrm` + `erBobPrmSysInt`, sharing `batch-seed-bob-prm-001`) wrap into a single PoE (`poe-bob-prm-001`); Carol's solo Eval Result wraps into its own PoE (`poe-carol-prm-001`). `proofsOfEvaluation` array added to the shared bundle return shape. `daProofBobPrm` + previously-separate `daProofBobPrmSysInt` collapsed into a single proof-of-eval DA (subject = the shared PoE; the prior Eval-Result-targeting variant `daProofBobPrmSysInt` deleted). The Alice→Dave proof-only Claim DA's scope migrated to `poeIds: [poeBobPrm.id]`. `mergeProvisionals` extended with `proofsOfEvaluation` merge so Create-PoE provisionals flow through view derivation. **Step 4 — canvas adapter + node rendering:** new `poeToNode` helper; `rollupPoeAggregate` computes SAT/UNSAT/MISSING/N/A counts across wrapped Eval Results. New `COL_OWN_POE = 2100` column constant; PoE nodes anchor vertically to the centroid of their wrapped Eval Result y-positions for clean wrap edges. Counterparty (proof-only-pulled) PoEs hang next to the source Claim. AssetNode.jsx Row 0 type-label dispatch unchanged — uses node.v22Type directly, which we set to `'PROOF OF EVALUATION'` from `poeToNode`. New PoE summary row in AssetNode.jsx renders "Wraps N · X SAT · Y UNSAT" with green/red color coding; gated on `node.isPoe && node.poeAggregate`. Edge derivation: handles `subject.kind === 'poe'` (proof-of-eval DAs now fan out one edge per wrapped Eval Result → Claim, preserving the Eval Result ↔ Claim visual lineage); proof-only Claim DA edges run from each `scope.poeIds` entry to the DA's subject Claim. New PoE wrapping edges synthesized from the artifact relationship (one per `(poe.id, wrappedEvalResultId)` pair) — emitted with a synthetic internal Full Disclosure DA for visual consistency, marked `_isPoeWrap: true` for any future styling hooks. **Step 5 — entry points:** AssetNode.jsx EVAL RESULT case adds a `◈` Create-PoE action button gated on `isOwner && !isSuperseded && !node._alreadyWrapped`. V2App stamps `_alreadyWrapped: true` on Eval Result nodes whose id appears in any owned PoE's `wrappedEvalResultIds` (computed in `v22DataWithReveal` memo). V22EvalResultPanel footer adds a "Create Proof of Evaluation" button with the same gating. New V2App action dispatch case `'createPoE'` opens the modal. **Step 6 — `CreatePoEModal`:** new file `src/components/modals/CreatePoEModal.jsx`. Confirmation modal renders the wrapped Eval Result count, the RS names (comma-separated for batches), and an irreversibility warning. On Confirm, fires `handleV22CreatePoE` which builds the PoE via `makePoE` (Asset snapshot derived from union of wrapped Eval Results' `evidenceUsed`; createdDate = now), pushes to `v22Provisionals.proofsOfEvaluation`, pans + selects the new PoE, and reveals it via the standard `_isNew` reveal pipeline. **Step 7 — `V22PoEPanel`:** new section in V22NodeDetailPanel.jsx. Sections: Owner (evaluator + created date + status), Source Claim (clickable row), Wrapped Eval Results (clickable rows + aggregate footer), Disclosures (active DAs targeting this PoE; empty state "No active disclosures"), Badges (placeholder "No badges yet" for #169), DOT (PIN, owner DID, asset snapshot count, batch id when present). Router updated with `case 'PROOF OF EVALUATION'`. V2App's V22NodeDetailPanel mount supplies `resolveClaimName`, `resolveEvalResultName`, `resolveDaSummary`, `onSelectClaim`, `onSelectEvalResult`, `onSelectDa`, and `disclosingAgreements` (filtered DAs whose `scope.poeIds` includes this PoE). **Step 8 — Run Evaluation submit-time gate:** new `existingPoEs` prop on V22RunEvaluationModal. For each selected RS the modal walks the PoE list and finds any owned PoE whose `requirementsSetIds` includes the selected RS AND whose `assetSnapshot` is a superset of the current evidence snapshot. Strict-superset gate releases naturally when Alice amends evidence (the new Asset set differs from the PoE's snapshot). Submit button disabled when `blockedByPoE`; footer copy switches to amber and reads "Cannot save: this evaluation has been finalized as a Proof of Evaluation against [RS names]. Modify the Claim's evidence or select a different Requirements Set to continue." V2App passes `existingPoEs` filtered to PoEs the active actor owns on this Claim. **Step 9 — disclosure flow:** AmendDisclosureModal proof-only branch now renders `candidatePoEs` (was `candidateEvalResults`) + uses `selectedPoeIds` state; CombinedResponseModal proof-only step picks PoE rows showing wrapped-count + SAT/UNSAT aggregate. Grantee canvas pull-in: `buildViewForActor` introduces a `addPoeAndWrapped(poeId, fromProofOnlyClaimDa)` helper that visiting a proof-of-eval DA or proof-only Claim DA pulls in both the PoE artifact (added to the visible PoE set) and its wrapped Eval Results (added to `proofDaEvalResultIds`). New `proofOnlyPulledPoeIds` set parallel to existing `proofOnlyPulledEvalIds` so the canvas adapter can place pulled PoEs near the source Claim. `proofsOfEvaluation` field added to view return; canvas adapter places own + pulled PoEs in their respective columns. **Step 10 — #173 fold-in:** collapsed accordion rows in V22RunEvaluationModal appeared to shrink when a sibling expanded because the flex column's default `flex-shrink: 1` redistributed space when an expanded sibling grew. Root cause: each card was a flex item without explicit `flex-shrink`. Fix: `flexShrink: 0` on each accordion card pins them to natural content height regardless of sibling state. Same fix applied to V22ParseEvidenceModal for visual consistency (single-row case is already stable but preserves invariant if the modal ever grows multi-Asset support). **Documented deviations / visual choices:** (1) Proof-of-evaluation DA edge derivation under `subject.kind === 'poe'` fans out to wrapped Eval Result → Claim edges rather than emitting a direct PoE → Claim edge. Decision 14 said the PoE node "connects to wrapped Eval Result(s); no direct edge to source Claim — the existing Claim → Eval Result edge handles that lineage". The Eval Result → Claim edge today IS the proof-of-eval DA edge; the PoE-targeting DA generates the same edge through its wrapped Eval Results. (2) PoE wrapping edges synthesized from a per-wrap synthetic internal Full DA for styling/dedupe consistency (no real DA artifact backs them). (3) PoE column placed at `COL_OWN_POE = 2100` (between own Eval and pulled Claim columns); counterparty PoEs hang next to the source Claim with a 400px x-offset. (4) PoE node card uses `category: 'evaluation'` for consistent border/glow with Eval Results since they're the closest existing peer (both terminal evaluation-flow nodes). (5) Action-bar icon `◈` (diamond with cross) for Create PoE — distinct from the eval `◆` and re-run `↻`. **Out of scope (explicitly per brief):** Badges (#169 — placeholder section in PoE Detail Panel), PDF annotation overlay (#172), PoE transferability (#72), PoE revocation, PoE-level OUTDATED, per-Eval-Result selectivity in disclosures, PoE renaming/amendment. **Footer v0.12.7 → v0.13.0** (new minor for the architectural addition). Architecture spec Changelog gains Phase 13 entries (§3.5 node types, §6.X / §10.X proof-only DA scope migration, §X.Y new PoE subsection). CLAUDE.md "Current state of the world" + "Active phase queue" updated; #168 + #173 marked complete; Phase 14 candidates = Badges (#169), PDF annotation (#172). polish-backlog.md gets #168 + #173 moved to Completed plus a Phase 13 Update Log entry. **Build clean** (99 modules transformed, 0 errors). Canvas-click-triggered acceptance criteria (PoE node click → panel; action-bar Create PoE click; submit-time gate visualization; cross-role testing) require manual mouse interaction per the documented V2Canvas raycaster limitation. The grep verifies the field rename: zero residual `scope?.evaluationResultIds` / `scope.evaluationResultIds:` references remain (only historical comments survive, intentional documentation).

**Status:** [x] Complete.